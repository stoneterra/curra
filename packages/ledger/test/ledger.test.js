import test from 'node:test';
import assert from 'node:assert/strict';
import { LedgerPostingService } from '../dist/index.js';

const service = new LedgerPostingService();

test('LedgerPostingService enforces balanced journals', () => {
  assert.throws(
    () =>
      service.buildJournal({
        journalId: 'j1',
        tenantId: 't1',
        companyId: 'c1',
        referenceType: 'payroll_run',
        referenceId: 'r1',
        lines: [
          {
            accountCode: 'A',
            side: 'debit',
            amountMinor: 100,
            currencyCode: 'UGX',
            description: 'd'
          },
          {
            accountCode: 'B',
            side: 'credit',
            amountMinor: 90,
            currencyCode: 'UGX',
            description: 'c'
          }
        ]
      }),
    /Unbalanced journal/i
  );
});

test('LedgerPostingService emits debit/credit split lines', () => {
  const journal = service.buildJournal({
    journalId: 'j2',
    tenantId: 't1',
    companyId: 'c1',
    referenceType: 'payroll_run',
    referenceId: 'r2',
    lines: [
      {
        accountCode: 'A',
        side: 'debit',
        amountMinor: 100,
        currencyCode: 'UGX',
        description: 'd'
      },
      {
        accountCode: 'B',
        side: 'credit',
        amountMinor: 100,
        currencyCode: 'UGX',
        description: 'c'
      }
    ]
  });

  assert.equal(journal.lines[0].debitMinor, 100);
  assert.equal(journal.lines[0].creditMinor, 0);
  assert.equal(journal.lines[1].debitMinor, 0);
  assert.equal(journal.lines[1].creditMinor, 100);
});
