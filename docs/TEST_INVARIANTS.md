# Curra Test Invariants

Last updated: 2026-02-22
Status: Blocking

These invariants are mandatory and are CI blockers.

## 1) Ledger integrity

1. Debits equal credits per journal.
2. No line has both debit and credit non-zero.
3. No negative debit/credit values.
4. Posted entries are immutable.

## 2) Monetary correctness

1. All money fields are integer minor units.
2. Float usage in money path fails validation/build.
3. Currency must be explicit in computations and postings.

## 3) Tenant isolation

1. Every tenant table is tenant-scoped.
2. Cross-tenant read/write attempts must fail.
3. RLS policies must be active for tenant tables.

## 4) Idempotency and replay safety

1. Replaying same inbound event creates no duplicate side effects.
2. Replaying same outbound request does not create duplicate transfer.
3. Duplicate callback processing remains safe and deterministic.

## 5) Payroll consistency

1. Payroll totals from compute match totals posted to ledger.
2. Statutory deductions cannot produce invalid negative payable state in valid flows.
3. Finalized runs preserve immutable adapter metadata.

## 6) Adapter contract conformance

Each country adapter must pass:

1. Interface contract tests.
2. Golden fixture tests for statutory outputs.
3. Regression tests against previous rule sets (where applicable).

## 7) Failure-flow resilience

Must test:

1. Employee termination pre/post period cutoff.
2. Salary drop affecting deductions and net pay.
3. Employer shortfall during disbursement.
4. Partial deduction/repayment allocation.

