import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { getRuntimeContext } from "../runtime-context.js";

export const payrollRunsRoute: FastifyPluginAsync = async (app) => {
  const runtime = getRuntimeContext();
  const { repositories, outbox, payrollRuns: payrollRunService } = runtime;

  app.log.info({ persistenceMode: repositories.mode }, "Initialized payroll runs route.");

  app.post("/", async (request, reply) => {
    const body = request.body as {
      tenantId: string;
      companyId: string;
      periodId: string;
      countryCode: string;
      currencyCode: string;
      sourceWallet?: string;
      periodStart: string;
      periodEnd: string;
      employees: Array<{
        employeeId: string;
        baseSalaryMinor: number;
        taxableEarningsMinor: number;
        additionalEarningsMinor: number;
        payoutBeneficiaryName?: string;
        payoutBeneficiaryAccount?: string;
        payoutBeneficiaryCountryCode?: string;
        payoutDestinationCountryCode?: string;
        payoutDestinationNetwork?: string;
      }>;
    };

    const draft = await payrollRunService.createDraft(body);
    return reply.code(201).send(draft);
  });

  app.post("/:payrollRunId/finalize", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const finalized = await payrollRunService.finalizeRun(params.payrollRunId);

      await outbox.enqueue({
        eventId: randomUUID(),
        eventType: "NetPayDisbursementRequested",
        eventVersion: "1.0.0",
        tenantId: finalized.tenantId,
        correlationId: finalized.payrollRunId,
        idempotencyKey: `${finalized.payrollRunId}:netpay:request:v1`,
        payload: {
          payrollRunId: finalized.payrollRunId,
          currencyCode: finalized.currencyCode,
          sourceWallet: finalized.sourceWallet,
          totalAmountMinor: finalized.disbursementLineItems.reduce((sum, item) => sum + item.amountMinor, 0),
          lineItems: finalized.disbursementLineItems
        }
      });

      return reply.code(200).send(finalized);
    } catch (error) {
      return reply.code(400).send({
        error: "PAYROLL_FINALIZE_FAILED",
        message: error instanceof Error ? error.message : "Unknown payroll finalization error."
      });
    }
  });

  app.get("/", async (request) => {
    const query = request.query as { tenantId: string };
    return {
      runs: await payrollRunService.listByTenant(query.tenantId),
      outbox: await outbox.listByTenant(query.tenantId)
    };
  });
};
