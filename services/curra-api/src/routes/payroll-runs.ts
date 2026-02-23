import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { getRuntimeContext } from "../runtime-context.js";

function toCsvValue(value: string | number): string {
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
    return `"${raw.replaceAll("\"", "\"\"")}"`;
  }
  return raw;
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0] ?? {});
  const headerLine = headers.map((header) => toCsvValue(header)).join(",");
  const body = rows
    .map((row) => headers.map((header) => toCsvValue(row[header] ?? "")).join(","))
    .join("\n");
  return `${headerLine}\n${body}\n`;
}

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
      employerTin?: string;
      employerNssfCode?: string;
      employees: Array<{
        employeeId: string;
        baseSalaryMinor: number;
        taxableEarningsMinor: number;
        additionalEarningsMinor: number;
        employmentStatus?: "active" | "inactive";
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

  app.get("/:payrollRunId/summary", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      return reply.code(200).send(output);
    } catch (error) {
      return reply.code(404).send({
        error: "PAYROLL_RUN_NOT_FOUND",
        message: error instanceof Error ? error.message : "Unknown payroll run output error."
      });
    }
  });

  app.get("/:payrollRunId/payslips", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      return reply.code(200).send({
        payrollRunId: output.run.payrollRunId,
        tenantId: output.run.tenantId,
        companyId: output.run.companyId,
        countryCode: output.run.countryCode,
        currencyCode: output.currencyCode,
        periodStart: output.run.periodStart,
        periodEnd: output.run.periodEnd,
        payslips: output.employeeBreakdowns
      });
    } catch (error) {
      return reply.code(404).send({
        error: "PAYSLIPS_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown payslip error."
      });
    }
  });

  app.get("/:payrollRunId/payslips/:employeeId", async (request, reply) => {
    const params = request.params as { payrollRunId: string; employeeId: string };
    const query = request.query as { format?: string };

    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const payslip = output.employeeBreakdowns.find((line) => line.employeeId === params.employeeId);
      if (!payslip) {
        return reply.code(404).send({
          error: "EMPLOYEE_PAYSLIP_NOT_FOUND",
          message: "Employee not found in payroll run."
        });
      }

      if (query.format === "html") {
        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Payslip ${payslip.employeeId}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #0f172a; }
      .card { border: 1px solid #dbe5f3; border-radius: 12px; padding: 16px; max-width: 760px; }
      h1 { margin: 0 0 12px; font-size: 20px; }
      .meta { margin-bottom: 14px; font-size: 13px; color: #475569; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 8px 0; border-bottom: 1px solid #edf2fa; }
      td:last-child { text-align: right; font-family: ui-monospace, Menlo, Consolas, monospace; }
      .net { font-weight: 700; font-size: 17px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Payslip</h1>
      <div class="meta">
        Employee: ${payslip.beneficiaryName} (${payslip.employeeId})<br/>
        Payroll Run: ${output.run.payrollRunId}<br/>
        Period: ${output.run.periodStart} to ${output.run.periodEnd}<br/>
        Currency: ${payslip.currencyCode}
      </div>
      <table>
        <tr><td>Gross Pay</td><td>${payslip.grossMinor}</td></tr>
        <tr><td>PAYE</td><td>${payslip.payeMinor}</td></tr>
        <tr><td>NSSF Employee</td><td>${payslip.employeeNssfMinor}</td></tr>
        <tr><td>NSSF Employer</td><td>${payslip.employerNssfMinor}</td></tr>
        <tr><td>Total Deductions</td><td>${payslip.totalDeductionsMinor}</td></tr>
        <tr class="net"><td>Net Pay</td><td>${payslip.netMinor}</td></tr>
      </table>
    </div>
  </body>
</html>`;
        return reply.type("text/html; charset=utf-8").send(html);
      }

      return reply.code(200).send({
        payrollRunId: output.run.payrollRunId,
        periodStart: output.run.periodStart,
        periodEnd: output.run.periodEnd,
        currencyCode: payslip.currencyCode,
        payslip
      });
    } catch (error) {
      return reply.code(404).send({
        error: "PAYSLIP_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown payslip error."
      });
    }
  });

  app.get("/:payrollRunId/exports/payroll-register.csv", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const rows = output.employeeBreakdowns.map((line) => ({
        payroll_run_id: output.run.payrollRunId,
        employee_id: line.employeeId,
        employee_name: line.beneficiaryName,
        currency: line.currencyCode,
        gross_minor: line.grossMinor,
        paye_minor: line.payeMinor,
        nssf_employee_minor: line.employeeNssfMinor,
        nssf_employer_minor: line.employerNssfMinor,
        deductions_total_minor: line.totalDeductionsMinor,
        net_minor: line.netMinor
      }));
      const csv = toCsv(rows);
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="payroll-register-${params.payrollRunId}.csv"`)
        .send(csv);
    } catch (error) {
      return reply.code(404).send({
        error: "PAYROLL_REGISTER_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown payroll register export error."
      });
    }
  });

  app.get("/:payrollRunId/exports/statutory-summary.csv", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const authorityTotals = output.employeeBreakdowns.reduce(
        (acc, line) => {
          acc.URA += line.payeMinor;
          acc.NSSF += line.employeeNssfMinor;
          return acc;
        },
        { URA: 0, NSSF: 0 }
      );

      const rows = [
        ...output.remittanceInstructions.map((instruction) => ({
          payroll_run_id: output.run.payrollRunId,
          authority: instruction.authority,
          amount_minor: instruction.amountMinor,
          currency: instruction.currencyCode,
          due_date: instruction.dueDate
        })),
        {
          payroll_run_id: output.run.payrollRunId,
          authority: "URA_EMPLOYEE_PAYE_ONLY",
          amount_minor: authorityTotals.URA,
          currency: output.currencyCode,
          due_date: ""
        },
        {
          payroll_run_id: output.run.payrollRunId,
          authority: "NSSF_EMPLOYEE_ONLY",
          amount_minor: authorityTotals.NSSF,
          currency: output.currencyCode,
          due_date: ""
        },
        {
          payroll_run_id: output.run.payrollRunId,
          authority: "NSSF_EMPLOYER_ONLY",
          amount_minor: output.employerNssfTotalMinor,
          currency: output.currencyCode,
          due_date: ""
        }
      ];
      const csv = toCsv(rows);
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="statutory-summary-${params.payrollRunId}.csv"`)
        .send(csv);
    } catch (error) {
      return reply.code(404).send({
        error: "STATUTORY_EXPORT_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown statutory export error."
      });
    }
  });

  app.get("/:payrollRunId/exports/disbursement-instructions.csv", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const rows = output.employeeBreakdowns.map((line) => ({
        payroll_run_id: output.run.payrollRunId,
        employee_id: line.employeeId,
        beneficiary_name: line.beneficiaryName,
        beneficiary_account: line.payoutBeneficiaryAccount,
        beneficiary_country_code: line.payoutBeneficiaryCountryCode,
        destination_country_code: line.payoutDestinationCountryCode,
        destination_network: line.payoutDestinationNetwork,
        net_amount_minor: line.netMinor,
        payout_currency: line.currencyCode,
        source_wallet: output.sourceWallet
      }));
      const csv = toCsv(rows);
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="disbursement-instructions-${params.payrollRunId}.csv"`)
        .send(csv);
    } catch (error) {
      return reply.code(404).send({
        error: "DISBURSEMENT_EXPORT_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown disbursement export error."
      });
    }
  });

  app.get("/:payrollRunId/exports/paye-remittance.csv", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const instruction = output.remittanceInstructions.find((line) => line.authority === "URA");
      const rows = [
        {
          payroll_run_id: output.run.payrollRunId,
          authority: "URA",
          deduction_type: "PAYE",
          amount_minor: output.payeTotalMinor,
          currency: output.currencyCode,
          due_date: instruction?.dueDate ?? "",
          employer_tin: output.run.employerTin ?? ""
        }
      ];
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="paye-remittance-${params.payrollRunId}.csv"`)
        .send(toCsv(rows));
    } catch (error) {
      return reply.code(404).send({
        error: "PAYE_EXPORT_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown PAYE export error."
      });
    }
  });

  app.get("/:payrollRunId/exports/nssf-remittance.csv", async (request, reply) => {
    const params = request.params as { payrollRunId: string };
    try {
      const output = await payrollRunService.getRunOutputs(params.payrollRunId);
      const instruction = output.remittanceInstructions.find((line) => line.authority === "NSSF");
      const rows = [
        {
          payroll_run_id: output.run.payrollRunId,
          authority: "NSSF",
          employee_amount_minor: output.employeeNssfTotalMinor,
          employer_amount_minor: output.employerNssfTotalMinor,
          total_amount_minor: output.employeeNssfTotalMinor + output.employerNssfTotalMinor,
          currency: output.currencyCode,
          due_date: instruction?.dueDate ?? "",
          employer_nssf_code: output.run.employerNssfCode ?? ""
        }
      ];
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="nssf-remittance-${params.payrollRunId}.csv"`)
        .send(toCsv(rows));
    } catch (error) {
      return reply.code(404).send({
        error: "NSSF_EXPORT_NOT_AVAILABLE",
        message: error instanceof Error ? error.message : "Unknown NSSF export error."
      });
    }
  });
};
