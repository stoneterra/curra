import type { EmployeePayrollInput, PayrollInput } from "@curra/domain-core";
import { randomUUID } from "node:crypto";
import { CountryAdapterRegistry } from "./country-adapter-registry.js";
import { OutboxService } from "./outbox-service.js";
import { PayrollComputationService } from "./payroll-computation-service.js";
import type {
  PayrollEmployeeBreakdownSnapshot,
  PayrollRunFinalizationSnapshot,
  PayrollRunRecord,
  PayrollRunRepository
} from "../repositories/payroll-run-repository.js";

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
  employerTin?: string;
  employerNssfCode?: string;
  employees: EmployeePayrollInput[];
  status: "draft" | "finalized";
  finalizationSnapshot?: PayrollRunFinalizationSnapshot;
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

export interface EmployeePayrollBreakdown {
  employeeId: string;
  beneficiaryName: string;
  grossMinor: number;
  payeMinor: number;
  employeeNssfMinor: number;
  employerNssfMinor: number;
  totalDeductionsMinor: number;
  netMinor: number;
  currencyCode: string;
  payoutBeneficiaryAccount: string;
  payoutBeneficiaryCountryCode: string;
  payoutDestinationCountryCode: string;
  payoutDestinationNetwork: string;
}

export interface PayrollRunOutputs {
  run: PayrollRunDraft;
  computedAt: string;
  mode: "draft_recompute" | "finalized_snapshot";
  adapterMetadata: {
    countryCode: string;
    adapterVersion: string;
    ruleSetId: string;
    effectiveFrom: string;
  };
  grossTotalMinor: number;
  deductionsTotalMinor: number;
  netTotalMinor: number;
  currencyCode: string;
  sourceWallet: string;
  payeTotalMinor: number;
  employeeNssfTotalMinor: number;
  employerNssfTotalMinor: number;
  validationWarnings: string[];
  employeeBreakdowns: EmployeePayrollBreakdown[];
  remittanceInstructions: Array<{
    authority: "URA" | "NSSF";
    amountMinor: number;
    currencyCode: string;
    dueDate: string;
  }>;
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
      const replayCompute = this.computeService.compute(computeInput, draft.employees);
      const replaySnapshot =
        draft.finalizationSnapshot ??
        this.buildFinalizationSnapshot(
          draft,
          replayCompute,
          selectedSourceWallet,
          this.buildValidationWarnings(draft, replayCompute.netTotalMinor)
        );
      const replayLineItems = this.buildDisbursementLineItems(draft, replaySnapshot.employeeBreakdowns);

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
        grossTotalMinor: replaySnapshot.grossTotalMinor,
        netTotalMinor: replaySnapshot.netTotalMinor,
        currencyCode: draft.currencyCode,
        sourceWallet: selectedSourceWallet,
        disbursementLineItems: replayLineItems
      };
    }

    const result = this.computeService.compute(computeInput, draft.employees);
    const warnings = this.buildValidationWarnings(draft, result.netTotalMinor);
    const finalizationSnapshot = this.buildFinalizationSnapshot(
      draft,
      result,
      selectedSourceWallet,
      warnings
    );
    const disbursementLineItems = this.buildDisbursementLineItems(draft, finalizationSnapshot.employeeBreakdowns);
    await this.repository.markFinalized(payrollRunId, finalizationSnapshot);

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

  async getRunOutputs(payrollRunId: string): Promise<PayrollRunOutputs> {
    const run = await this.repository.getById(payrollRunId);
    if (!run) {
      throw new Error("Payroll run not found.");
    }

    if (run.status === "finalized" && run.finalizationSnapshot) {
      return this.toOutputsFromSnapshot(run, run.finalizationSnapshot);
    }

    const computeInput: PayrollInput = {
      tenantId: run.tenantId,
      companyId: run.companyId,
      payrollRunId: run.payrollRunId,
      countryCode: run.countryCode,
      currencyCode: run.currencyCode,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd
    };

    const result = this.computeService.compute(computeInput, run.employees);
    const selectedSourceWallet = run.sourceWallet?.trim() || run.currencyCode;
    const warnings = this.buildValidationWarnings(run, result.netTotalMinor);
    const draftSnapshot = this.buildFinalizationSnapshot(run, result, selectedSourceWallet, warnings);

    return {
      run,
      computedAt: draftSnapshot.computedAt,
      mode: "draft_recompute",
      adapterMetadata: draftSnapshot.adapterMetadata,
      grossTotalMinor: draftSnapshot.grossTotalMinor,
      deductionsTotalMinor: draftSnapshot.deductionsTotalMinor,
      netTotalMinor: draftSnapshot.netTotalMinor,
      currencyCode: draftSnapshot.currencyCode,
      sourceWallet: draftSnapshot.sourceWallet,
      payeTotalMinor: draftSnapshot.payeTotalMinor,
      employeeNssfTotalMinor: draftSnapshot.employeeNssfTotalMinor,
      employerNssfTotalMinor: draftSnapshot.employerNssfTotalMinor,
      validationWarnings: draftSnapshot.validationWarnings,
      employeeBreakdowns: draftSnapshot.employeeBreakdowns,
      remittanceInstructions: draftSnapshot.remittanceInstructions
    };
  }

  private buildDisbursementLineItems(
    run: PayrollRunDraft,
    employeeBreakdowns: Array<{
      employeeId: string;
      beneficiaryName: string;
      netMinor: number;
      payoutBeneficiaryAccount: string;
      payoutBeneficiaryCountryCode: string;
      payoutDestinationCountryCode: string;
      payoutDestinationNetwork: string;
    }>
  ): NetPayDisbursementLineItem[] {
    return employeeBreakdowns.map((line) => {
      return {
        employeeId: line.employeeId,
        beneficiaryName: line.beneficiaryName,
        beneficiaryAccount: line.payoutBeneficiaryAccount,
        beneficiaryCountryCode: line.payoutBeneficiaryCountryCode,
        destinationCountryCode: line.payoutDestinationCountryCode,
        destinationNetwork: line.payoutDestinationNetwork,
        amountMinor: line.netMinor,
        currencyCode: run.currencyCode,
        reference: `PAYROLL-${run.payrollRunId}-${line.employeeId}`,
        idempotencyKey: `${run.payrollRunId}:${line.employeeId}:netpay:v1`
      };
    });
  }

  private buildFinalizationSnapshot(
    run: PayrollRunDraft,
    result: ReturnType<PayrollComputationService["compute"]>,
    sourceWallet: string,
    validationWarnings: string[]
  ): PayrollRunFinalizationSnapshot {
    const employeeBreakdowns: PayrollEmployeeBreakdownSnapshot[] = run.employees.map((employee) => {
      const grossMinor = employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor;
      const payeMinor = result.statutoryDeductions
        .filter((line) => line.employeeId === employee.employeeId && line.deductionType === "PAYE")
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const employeeNssfMinor = result.statutoryDeductions
        .filter((line) => line.employeeId === employee.employeeId && line.deductionType === "NSSF")
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const employerNssfMinor = result.employerContributions
        .filter((line) => line.employeeId === employee.employeeId && line.contributionType === "NSSF")
        .reduce((sum, line) => sum + line.amountMinor, 0);
      const totalDeductionsMinor = payeMinor + employeeNssfMinor;
      const netMinor = Math.max(0, grossMinor - totalDeductionsMinor);

      return {
        employeeId: employee.employeeId,
        beneficiaryName: employee.payoutBeneficiaryName ?? employee.employeeId,
        grossMinor,
        payeMinor,
        employeeNssfMinor,
        employerNssfMinor,
        totalDeductionsMinor,
        netMinor,
        currencyCode: run.currencyCode,
        payoutBeneficiaryAccount: employee.payoutBeneficiaryAccount ?? "",
        payoutBeneficiaryCountryCode: employee.payoutBeneficiaryCountryCode ?? "UG",
        payoutDestinationCountryCode: employee.payoutDestinationCountryCode ?? "UG",
        payoutDestinationNetwork: employee.payoutDestinationNetwork ?? "mobile_money"
      };
    });

    return {
      computedAt: new Date().toISOString(),
      adapterMetadata: {
        countryCode: result.adapterMetadata.countryCode,
        adapterVersion: result.adapterMetadata.adapterVersion,
        ruleSetId: result.adapterMetadata.ruleSetId,
        effectiveFrom: result.adapterMetadata.effectiveFrom
      },
      grossTotalMinor: result.grossTotalMinor,
      deductionsTotalMinor: result.deductionsTotalMinor,
      netTotalMinor: result.netTotalMinor,
      currencyCode: run.currencyCode,
      sourceWallet,
      payeTotalMinor: employeeBreakdowns.reduce((sum, line) => sum + line.payeMinor, 0),
      employeeNssfTotalMinor: employeeBreakdowns.reduce((sum, line) => sum + line.employeeNssfMinor, 0),
      employerNssfTotalMinor: employeeBreakdowns.reduce((sum, line) => sum + line.employerNssfMinor, 0),
      employeeBreakdowns,
      remittanceInstructions: result.remittanceInstructions,
      validationWarnings
    };
  }

  private toOutputsFromSnapshot(run: PayrollRunDraft, snapshot: PayrollRunFinalizationSnapshot): PayrollRunOutputs {
    return {
      run,
      computedAt: snapshot.computedAt,
      mode: "finalized_snapshot",
      adapterMetadata: snapshot.adapterMetadata,
      grossTotalMinor: snapshot.grossTotalMinor,
      deductionsTotalMinor: snapshot.deductionsTotalMinor,
      netTotalMinor: snapshot.netTotalMinor,
      currencyCode: snapshot.currencyCode,
      sourceWallet: snapshot.sourceWallet,
      payeTotalMinor: snapshot.payeTotalMinor,
      employeeNssfTotalMinor: snapshot.employeeNssfTotalMinor,
      employerNssfTotalMinor: snapshot.employerNssfTotalMinor,
      validationWarnings: snapshot.validationWarnings,
      employeeBreakdowns: snapshot.employeeBreakdowns,
      remittanceInstructions: snapshot.remittanceInstructions
    };
  }

  private buildValidationWarnings(run: PayrollRunDraft, netTotalMinor: number): string[] {
    const warnings: string[] = [];
    if (!run.employerTin?.trim()) {
      warnings.push("Missing employer TIN.");
    }
    if (!run.employerNssfCode?.trim()) {
      warnings.push("Missing employer NSSF code.");
    }
    if (netTotalMinor <= 0) {
      warnings.push("Run net pay is zero or negative.");
    }
    const inactiveEmployees = run.employees.filter((employee) => employee.employmentStatus?.toLowerCase() === "inactive");
    if (inactiveEmployees.length > 0) {
      warnings.push(`Inactive employees included: ${inactiveEmployees.length}.`);
    }
    return warnings;
  }
}
