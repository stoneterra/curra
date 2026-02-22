import type { FastifyPluginAsync } from "fastify";
import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { getRuntimeContext } from "../runtime-context.js";

function verifySignature(rawBody: string, signatureHeader: string, webhookSecret: string): boolean {
  const computed = createHmac("sha512", webhookSecret).update(rawBody).digest("hex");
  const left = Buffer.from(signatureHeader, "utf8");
  const right = Buffer.from(computed, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export const eversendWebhooksRoute: FastifyPluginAsync = async (app) => {
  const { outbox } = getRuntimeContext();

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  app.post("/eversend", async (request, reply) => {
    const webhookSecret = process.env.EVERSEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return reply.code(503).send({
        error: "WEBHOOK_CONFIG_MISSING",
        message: "EVERSEND_WEBHOOK_SECRET is not configured."
      });
    }

    const signatureHeader = String(request.headers["x-eversend-signature"] ?? "");
    const rawBody = String(request.body ?? "");

    if (!signatureHeader || !verifySignature(rawBody, signatureHeader, webhookSecret)) {
      return reply.code(401).send({
        error: "INVALID_SIGNATURE",
        message: "Webhook signature verification failed."
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return reply.code(400).send({
        error: "INVALID_JSON",
        message: "Webhook body is not valid JSON."
      });
    }

    const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : "external-unmapped";
    const callbackKeySource =
      (typeof payload.eventId === "string" && payload.eventId) ||
      (typeof payload.id === "string" && payload.id) ||
      (typeof payload.reference === "string" && payload.reference) ||
      createHash("sha256").update(rawBody).digest("hex");

    await outbox.enqueue({
      eventId: randomUUID(),
      eventType: "EversendCallbackReceived",
      eventVersion: "1.0.0",
      tenantId,
      correlationId: callbackKeySource,
      idempotencyKey: `eversend:callback:${callbackKeySource}`,
      payload
    });

    return reply.code(200).send({ accepted: true });
  });
};
