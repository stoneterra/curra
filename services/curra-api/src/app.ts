import Fastify from "fastify";
import { ACTIVE_DEFAULTS } from "./config/defaults.js";
import { healthRoute } from "./routes/health.js";
import { payrollRunsRoute } from "./routes/payroll-runs.js";
import { ledgerRoute } from "./routes/ledger.js";
import { eversendWebhooksRoute } from "./routes/eversend-webhooks.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  app.get("/", async () => ({
    name: "Curra API",
    phase: "Phase 1",
    defaults: ACTIVE_DEFAULTS
  }));

  await app.register(healthRoute);
  await app.register(payrollRunsRoute, { prefix: "/payroll-runs" });
  await app.register(ledgerRoute, { prefix: "/ledger" });
  await app.register(eversendWebhooksRoute, { prefix: "/webhooks" });
  return app;
}
