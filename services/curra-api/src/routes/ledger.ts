import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { LedgerPostingService } from "@curra/ledger";
import { LedgerOrchestrationService } from "../modules/ledger-orchestration-service.js";

const ledgerOrchestrationService = new LedgerOrchestrationService(new LedgerPostingService());

export const ledgerRoute: FastifyPluginAsync = async (app) => {
  app.post("/payroll-accrual", async (request, reply) => {
    const body = request.body as {
      tenantId: string;
      companyId: string;
      payrollRunId: string;
      currencyCode: string;
      grossTotalMinor: number;
      payeMinor: number;
      nssfMinor: number;
      netTotalMinor: number;
    };

    try {
      const journal = ledgerOrchestrationService.buildPayrollAccrualJournal({
        journalId: randomUUID(),
        tenantId: body.tenantId,
        companyId: body.companyId,
        payrollRunId: body.payrollRunId,
        currencyCode: body.currencyCode,
        grossTotalMinor: body.grossTotalMinor,
        payeMinor: body.payeMinor,
        nssfMinor: body.nssfMinor,
        netTotalMinor: body.netTotalMinor
      });

      return reply.code(201).send(journal);
    } catch (error) {
      return reply.code(400).send({
        error: "LEDGER_POSTING_FAILED",
        message: error instanceof Error ? error.message : "Unknown ledger posting error."
      });
    }
  });
};

