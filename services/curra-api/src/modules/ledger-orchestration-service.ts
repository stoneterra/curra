import { LedgerPostingService } from "@curra/ledger";

export class LedgerOrchestrationService {
  constructor(private readonly postingService: LedgerPostingService) {}

  buildPayrollAccrualJournal(params: {
    journalId: string;
    tenantId: string;
    companyId: string;
    payrollRunId: string;
    currencyCode: string;
    grossTotalMinor: number;
    payeMinor: number;
    nssfMinor: number;
    netTotalMinor: number;
  }) {
    return this.postingService.buildJournal({
      journalId: params.journalId,
      tenantId: params.tenantId,
      companyId: params.companyId,
      referenceType: "payroll_run",
      referenceId: params.payrollRunId,
      lines: [
        {
          accountCode: "PAYROLL_EXPENSE",
          side: "debit",
          amountMinor: params.grossTotalMinor,
          currencyCode: params.currencyCode,
          description: "Payroll gross expense"
        },
        {
          accountCode: "PAYE_PAYABLE",
          side: "credit",
          amountMinor: params.payeMinor,
          currencyCode: params.currencyCode,
          description: "PAYE payable"
        },
        {
          accountCode: "NSSF_PAYABLE",
          side: "credit",
          amountMinor: params.nssfMinor,
          currencyCode: params.currencyCode,
          description: "NSSF payable"
        },
        {
          accountCode: "NET_SALARY_PAYABLE",
          side: "credit",
          amountMinor: params.netTotalMinor,
          currencyCode: params.currencyCode,
          description: "Net salary payable"
        }
      ]
    });
  }
}
