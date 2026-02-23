import type { EmployeePayrollInput } from "@curra/domain-core";

export interface PayrollEmployeeBreakdownSnapshot {
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

export interface PayrollRunFinalizationSnapshot {
  computedAt: string;
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
  employeeBreakdowns: PayrollEmployeeBreakdownSnapshot[];
  remittanceInstructions: Array<{
    authority: "URA" | "NSSF";
    amountMinor: number;
    currencyCode: string;
    dueDate: string;
  }>;
  validationWarnings: string[];
}

export interface PayrollRunRecord {
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

export interface PayrollRunRepository {
  createDraft(input: Omit<PayrollRunRecord, "status" | "createdAt">): Promise<PayrollRunRecord>;
  getById(payrollRunId: string): Promise<PayrollRunRecord | null>;
  markFinalized(payrollRunId: string, snapshot: PayrollRunFinalizationSnapshot): Promise<void>;
  listByTenant(tenantId: string): Promise<PayrollRunRecord[]>;
}

export class InMemoryPayrollRunRepository implements PayrollRunRepository {
  private readonly store = new Map<string, PayrollRunRecord>();

  async createDraft(input: Omit<PayrollRunRecord, "status" | "createdAt">): Promise<PayrollRunRecord> {
    const record: PayrollRunRecord = {
      ...input,
      status: "draft",
      createdAt: new Date().toISOString()
    };
    this.store.set(record.payrollRunId, record);
    return record;
  }

  async getById(payrollRunId: string): Promise<PayrollRunRecord | null> {
    return this.store.get(payrollRunId) ?? null;
  }

  async markFinalized(payrollRunId: string, snapshot: PayrollRunFinalizationSnapshot): Promise<void> {
    const record = this.store.get(payrollRunId);
    if (!record) {
      throw new Error("Payroll run not found.");
    }
    record.status = "finalized";
    record.finalizationSnapshot = snapshot;
    this.store.set(payrollRunId, record);
  }

  async listByTenant(tenantId: string): Promise<PayrollRunRecord[]> {
    return Array.from(this.store.values()).filter((record) => record.tenantId === tenantId);
  }
}
