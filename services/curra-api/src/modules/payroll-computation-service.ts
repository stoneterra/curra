import type { EmployeePayrollInput, PayrollComputationResult, PayrollInput } from "@curra/domain-core";
import { CountryAdapterRegistry } from "./country-adapter-registry.js";

export class PayrollComputationService {
  constructor(private readonly adapterRegistry: CountryAdapterRegistry) {}

  compute(input: PayrollInput, employees: EmployeePayrollInput[]): PayrollComputationResult {
    const adapter = this.adapterRegistry.resolve(input.countryCode);

    adapter.validatePayrollInputs(input, employees);

    const statutoryDeductions = adapter.computeStatutoryDeductions(input, employees);
    const employerContributions = adapter.computeEmployerContributions(input, employees);
    const remittanceInstructions = adapter.generateRemittanceInstructions(
      input,
      statutoryDeductions,
      employerContributions
    );

    const grossTotalMinor = employees.reduce(
      (sum, employee) => sum + employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor,
      0
    );

    const deductionsTotalMinor = statutoryDeductions.reduce((sum, deduction) => sum + deduction.amountMinor, 0);
    const netTotalMinor = grossTotalMinor - deductionsTotalMinor;

    if (netTotalMinor < 0) {
      throw new Error("Computed net payroll cannot be negative.");
    }

    return {
      grossTotalMinor,
      deductionsTotalMinor,
      netTotalMinor,
      statutoryDeductions,
      employerContributions,
      remittanceInstructions,
      adapterMetadata: adapter.versionMetadata()
    };
  }
}
