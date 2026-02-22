import type { EmployeePayrollInput, PayrollInput } from "@curra/domain-core";
import { randomUUID } from "node:crypto";
import { CountryAdapterRegistry } from "./country-adapter-registry.js";
import { OutboxService } from "./outbox-service.js";
import { PayrollComputationService } from "./payroll-computation-service.js";
import type { PayrollRunRecord, PayrollRunRepository } from "../repositories/payroll-run-repository.js";

export interface PayrollRunDraft {
  payrollRunId: string;
  tenantId: string;
  companyId: string;
  periodId: string;
  countryCode: string;
  currencyCode: string;
  sourceWallet?: string;
  periodStart: string;
  periodEnd: string;
  employees: EmployeePayrollInput[];
  status: "draft" | "finalized";
  createdAt: string;
}

export interface NetPayDisbursementLineItem {
  employeeId: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryCountryCode: string;
  destinationCountryCode: string;
  destinationNetwork: string;
  amountMinor: number;
  currencyCode: string;
  reference: string;
  idempotencyKey: string;
}

export class PayrollRunService {
  private readonly computeService: PayrollComputationService;

  constructor(
    private readonly repository: PayrollRunRepository,
    private readonly outbox: OutboxService
  ) {
    this.computeService = new PayrollComputationService(new CountryAdapterRegistry());
  }

  async createDraft(input: Omit<PayrollRunDraft, "payrollRunId" | "status" | "createdAt">): Promise<PayrollRunDraft> {
    const payrollRunId = randomUUID();
    const draftInput: Omit<PayrollRunRecord, "status" | "createdAt"> = {
      ...input,
      payrollRunId
    };

    return this.repository.createDraft(draftInput);
  }

  async finalizeRun(
    payrollRunId: string
  ): Promise<{
    tenantId: string;
    payrollRunId: string;
    status: "finalized";
    grossTotalMinor: number;
    netTotalMinor: number;
    currencyCode: string;
    sourceWallet: string;
    disbursementLineItems: NetPayDisbursementLineItem[];
  }> {
    const draft = await this.repository.getById(payrollRunId);
    if (!draft) {
      throw new Error("Payroll run not found.");
    }

    const selectedSourceWallet = draft.sourceWallet?.trim() || draft.currencyCode;

    const computeInput: PayrollInput = {
      tenantId: draft.tenantId,
      companyId: draft.companyId,
      payrollRunId: draft.payrollRunId,
      countryCode: draft.countryCode,
      currencyCode: draft.currencyCode,
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd
    };

    if (draft.status === "finalized") {
      const replayResult = this.computeService.compute(computeInput, draft.employees);
      const replayLineItems = this.buildDisbursementLineItems(draft, replayResult.statutoryDeductions);

      await this.outbox.enqueue({
        eventId: randomUUID(),
        eventType: "PayrollRunFinalized",
        eventVersion: "1.0.0",
        tenantId: draft.tenantId,
        correlationId: draft.payrollRunId,
        idempotencyKey: `${draft.payrollRunId}:finalized:v1`,
        payload: {
          payrollRunId: draft.payrollRunId,
          status: "finalized_replay"
        }
      });

      return {
        tenantId: draft.tenantId,
        payrollRunId: draft.payrollRunId,
        status: "finalized",
        grossTotalMinor: replayResult.grossTotalMinor,
        netTotalMinor: replayResult.netTotalMinor,
        currencyCode: draft.currencyCode,
        sourceWallet: selectedSourceWallet,
        disbursementLineItems: replayLineItems
      };
    }

    const result = this.computeService.compute(computeInput, draft.employees);
    const disbursementLineItems = this.buildDisbursementLineItems(draft, result.statutoryDeductions);
    await this.repository.markFinalized(payrollRunId);

    await this.outbox.enqueue({
      eventId: randomUUID(),
      eventType: "PayrollRunFinalized",
      eventVersion: "1.0.0",
      tenantId: draft.tenantId,
      correlationId: draft.payrollRunId,
      idempotencyKey: `${draft.payrollRunId}:finalized:v1`,
      payload: {
        payrollRunId: draft.payrollRunId,
        companyId: draft.companyId,
        periodId: draft.periodId,
        countryCode: draft.countryCode,
        currency: draft.currencyCode,
        grossTotalMinor: result.grossTotalMinor,
        netTotalMinor: result.netTotalMinor,
        statutoryTotalMinor: result.deductionsTotalMinor,
        employeeCount: draft.employees.length,
        adapterVersion: result.adapterMetadata.adapterVersion,
        ruleSetId: result.adapterMetadata.ruleSetId,
        finalizedAt: new Date().toISOString()
      }
    });

    return {
      tenantId: draft.tenantId,
      payrollRunId: draft.payrollRunId,
      status: "finalized",
      grossTotalMinor: result.grossTotalMinor,
      netTotalMinor: result.netTotalMinor,
      currencyCode: draft.currencyCode,
      sourceWallet: selectedSourceWallet,
      disbursementLineItems
    };
  }

  listByTenant(tenantId: string): Promise<PayrollRunDraft[]> {
    return this.repository.listByTenant(tenantId);
  }

  private buildDisbursementLineItems(
    draft: PayrollRunDraft,
    statutoryDeductions: Array<{ employeeId: string; amountMinor: number }>
  ): NetPayDisbursementLineItem[] {
    return draft.employees.map((employee) => {
      const grossMinor = employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor;
      const deductionsMinor = statutoryDeductions
        .filter((line) => line.employeeId === employee.employeeId)
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const netMinor = Math.max(0, grossMinor - deductionsMinor);

      return {
        employeeId: employee.employeeId,
        beneficiaryName: employee.payoutBeneficiaryName ?? employee.employeeId,
        beneficiaryAccount: employee.payoutBeneficiaryAccount ?? "",
        beneficiaryCountryCode: employee.payoutBeneficiaryCountryCode ?? "UG",
        destinationCountryCode: employee.payoutDestinationCountryCode ?? "UG",
        destinationNetwork: employee.payoutDestinationNetwork ?? "mobile_money",
        amountMinor: netMinor,
        currencyCode: draft.currencyCode,
        reference: `PAYROLL-${draft.payrollRunId}-${employee.employeeId}`,
        idempotencyKey: `${draft.payrollRunId}:${employee.employeeId}:netpay:v1`
      };
    });
  }
}
