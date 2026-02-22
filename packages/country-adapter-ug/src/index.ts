import {
  type CountryAdapter,
  type EmployeePayrollInput,
  type EmployerContributionLine,
  type PayrollInput,
  type RemittanceInstruction,
  type StatutoryDeductionLine
} from "@curra/domain-core";
import rules from "./rules.2026-02.json" with { type: "json" };

type PayeBand = {
  upToMinor: number | null;
  rateBps: number;
  baseTaxMinor: number;
  baseFloorMinor: number;
};

const UGANDA_ADAPTER_VERSION = rules.adapterVersion;
const UGANDA_RULE_SET_ID = rules.ruleSetId;

function percentOf(amountMinor: number, rateBps: number): number {
  return Math.floor((amountMinor * rateBps) / 10000);
}

function computePayeMonthly(taxableMonthlyMinor: number): number {
  for (const band of rules.paye.bandsMinor as PayeBand[]) {
    const inBand = band.upToMinor === null || taxableMonthlyMinor <= band.upToMinor;
    if (!inBand) {
      continue;
    }

    const taxableExcess = Math.max(0, taxableMonthlyMinor - band.baseFloorMinor);
    return band.baseTaxMinor + percentOf(taxableExcess, band.rateBps);
  }

  throw new Error("Paye configuration invalid: no matching band.");
}

function dueDateFollowingMonth(periodEnd: string, dayOfMonth: number): string {
  const date = new Date(`${periodEnd}T00:00:00.000Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const nextMonth = new Date(Date.UTC(year, month + 1, dayOfMonth));
  return nextMonth.toISOString().slice(0, 10);
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be an integer in minor units.`);
  }
}

export class UgandaAdapter implements CountryAdapter {
  validatePayrollInputs(input: PayrollInput, employees: EmployeePayrollInput[]): void {
    if (input.countryCode !== "UG") {
      throw new Error("UgandaAdapter only supports countryCode 'UG'.");
    }

    for (const employee of employees) {
      assertPositiveInteger(employee.baseSalaryMinor, "baseSalaryMinor");
      assertPositiveInteger(employee.taxableEarningsMinor, "taxableEarningsMinor");
      assertPositiveInteger(employee.additionalEarningsMinor, "additionalEarningsMinor");
    }
  }

  computeStatutoryDeductions(input: PayrollInput, employees: EmployeePayrollInput[]): StatutoryDeductionLine[] {
    this.validatePayrollInputs(input, employees);

    return employees.flatMap((employee) => {
      const grossMonthlyMinor = employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor;
      const taxableMonthlyMinor = employee.baseSalaryMinor + employee.taxableEarningsMinor;

      const payeMinor = computePayeMonthly(taxableMonthlyMinor);
      const employeeNssfMinor = percentOf(grossMonthlyMinor, rules.nssf.employeeRateBps);

      return [
        {
          employeeId: employee.employeeId,
          deductionType: "PAYE",
          amountMinor: payeMinor,
          authority: "URA"
        },
        {
          employeeId: employee.employeeId,
          deductionType: "NSSF",
          amountMinor: employeeNssfMinor,
          authority: "NSSF"
        }
      ];
    });
  }

  computeEmployerContributions(input: PayrollInput, employees: EmployeePayrollInput[]): EmployerContributionLine[] {
    this.validatePayrollInputs(input, employees);

    return employees.map((employee) => {
      const grossMonthlyMinor = employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor;
      return {
        employeeId: employee.employeeId,
        contributionType: "NSSF",
        amountMinor: percentOf(grossMonthlyMinor, rules.nssf.employerRateBps),
        authority: "NSSF"
      };
    });
  }

  generateRemittanceInstructions(
    input: PayrollInput,
    deductions: StatutoryDeductionLine[],
    contributions: EmployerContributionLine[]
  ): RemittanceInstruction[] {
    const totalUra = deductions
      .filter((line) => line.authority === "URA")
      .reduce((sum, line) => sum + line.amountMinor, 0);

    const totalNssf = deductions
      .filter((line) => line.authority === "NSSF")
      .reduce((sum, line) => sum + line.amountMinor, 0) + contributions.reduce((sum, line) => sum + line.amountMinor, 0);

    return [
      {
        authority: "URA",
        amountMinor: totalUra,
        currencyCode: input.currencyCode,
        dueDate: dueDateFollowingMonth(input.periodEnd, rules.remittance.dayOfFollowingMonth)
      },
      {
        authority: "NSSF",
        amountMinor: totalNssf,
        currencyCode: input.currencyCode,
        dueDate: dueDateFollowingMonth(input.periodEnd, rules.remittance.dayOfFollowingMonth)
      }
    ];
  }

  versionMetadata() {
    return {
      countryCode: "UG",
      adapterVersion: UGANDA_ADAPTER_VERSION,
      ruleSetId: UGANDA_RULE_SET_ID,
      effectiveFrom: rules.effectiveFrom
    };
  }
}
