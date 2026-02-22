export type LedgerSide = "debit" | "credit";

export interface JournalLineInput {
  accountCode: string;
  side: LedgerSide;
  amountMinor: number;
  currencyCode: string;
  description: string;
}

export interface JournalLine {
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
  currencyCode: string;
  description: string;
}

export interface BuiltJournal {
  journalId: string;
  tenantId: string;
  companyId: string;
  referenceType: "payroll_run" | "disbursement" | "remittance" | "adjustment";
  referenceId: string;
  lines: JournalLine[];
}

export class LedgerPostingService {
  buildJournal(params: {
    journalId: string;
    tenantId: string;
    companyId: string;
    referenceType: BuiltJournal["referenceType"];
    referenceId: string;
    lines: JournalLineInput[];
  }): BuiltJournal {
    const builtLines = params.lines.map((line) => {
      if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
        throw new Error("Ledger line amount must be a positive integer in minor units.");
      }

      return {
        accountCode: line.accountCode,
        debitMinor: line.side === "debit" ? line.amountMinor : 0,
        creditMinor: line.side === "credit" ? line.amountMinor : 0,
        currencyCode: line.currencyCode,
        description: line.description
      };
    });

    const totalDebits = builtLines.reduce((sum, line) => sum + line.debitMinor, 0);
    const totalCredits = builtLines.reduce((sum, line) => sum + line.creditMinor, 0);

    if (totalDebits !== totalCredits) {
      throw new Error("Unbalanced journal: total debits must equal total credits.");
    }

    return {
      journalId: params.journalId,
      tenantId: params.tenantId,
      companyId: params.companyId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      lines: builtLines
    };
  }
}
