export type MinorUnit = number;

export interface AdapterMetadata {
  countryCode: string;
  adapterVersion: string;
  ruleSetId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface PayrollInput {
  tenantId: string;
  companyId: string;
  payrollRunId: string;
  countryCode: string;
  currencyCode: string;
  periodStart: string;
  periodEnd: string;
}

export interface EmployeePayrollInput {
  employeeId: string;
  baseSalaryMinor: MinorUnit;
  taxableEarningsMinor: MinorUnit;
  additionalEarningsMinor: MinorUnit;
  payoutBeneficiaryName?: string;
  payoutBeneficiaryAccount?: string;
  payoutBeneficiaryCountryCode?: string;
  payoutDestinationCountryCode?: string;
  payoutDestinationNetwork?: string;
}

export interface StatutoryDeductionLine {
  employeeId: string;
  deductionType: "PAYE" | "NSSF";
  amountMinor: MinorUnit;
  authority: "URA" | "NSSF";
}

export interface EmployerContributionLine {
  employeeId: string;
  contributionType: "NSSF";
  amountMinor: MinorUnit;
  authority: "NSSF";
}

export interface RemittanceInstruction {
  authority: "URA" | "NSSF";
  amountMinor: MinorUnit;
  currencyCode: string;
  dueDate: string;
}

export interface CountryAdapter {
  validatePayrollInputs(input: PayrollInput, employees: EmployeePayrollInput[]): void;
  computeStatutoryDeductions(input: PayrollInput, employees: EmployeePayrollInput[]): StatutoryDeductionLine[];
  computeEmployerContributions(input: PayrollInput, employees: EmployeePayrollInput[]): EmployerContributionLine[];
  generateRemittanceInstructions(
    input: PayrollInput,
    deductions: StatutoryDeductionLine[],
    contributions: EmployerContributionLine[]
  ): RemittanceInstruction[];
  versionMetadata(): AdapterMetadata;
}

export interface PayrollComputationResult {
  grossTotalMinor: MinorUnit;
  deductionsTotalMinor: MinorUnit;
  netTotalMinor: MinorUnit;
  statutoryDeductions: StatutoryDeductionLine[];
  employerContributions: EmployerContributionLine[];
  remittanceInstructions: RemittanceInstruction[];
  adapterMetadata: AdapterMetadata;
}
