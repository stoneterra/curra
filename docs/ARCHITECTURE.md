# Curra Architecture Baseline (Phase 1 + Multi-Country Readiness)

Last updated: 2026-02-22
Status: Active

## 1) Product boundaries

### Curra owns

1. Employer and employee payroll records.
2. Payroll run lifecycle.
3. Deterministic payroll computation orchestration.
4. Double-entry payroll ledger.
5. Disbursement/remittance orchestration requests.
6. Audit logging and RBAC.

### Curra does not own

1. Lending offers, pricing, or underwriting.
2. Loan lifecycle management.
3. Stablecoin logic or treasury.

## 2) Hard architecture boundaries

1. No cross-product shared database tables.
2. Integration only via APIs/events.
3. Immutable ledger entries as financial truth.
4. Integer minor units for all money values.
5. Country statutory logic only in country adapters.

## 3) Core services

1. `CorePayrollEngine`
2. `CountryAdapterRegistry`
3. `PayrollComputationService`
4. `LedgerPostingService`
5. `DisbursementOrchestrator` (Eversend abstraction)
6. `EventPublisher` (outbox-backed)
7. `AuditLogService`

## 4) Data ownership

Curra DB tables (tenant-scoped):

1. `companies`
2. `employees`
3. `payroll_periods`
4. `payroll_runs`
5. `earnings_lines`
6. `deduction_lines`
7. `ledger_accounts`
8. `ledger_entries`
9. `audit_logs`

## 5) Multi-country readiness model

Country is a configuration and adapter concern, not a core engine fork.

1. Core engine remains country-agnostic.
2. Country adapters implement statutory contract.
3. Finalized runs persist adapter metadata:
   - `country_code`
   - `adapter_version`
   - `rule_set_id`
4. New country rollout requires certification gates from playbook.

## 6) Runtime lifecycle (Phase 1)

1. Company and employee data loaded.
2. Payroll period created.
3. Run computed via adapter.
4. Run approved/finalized.
5. Ledger postings created atomically.
6. Events emitted from outbox.
7. Eversend orchestration handles disbursement/remittance.
8. Status callbacks reconcile outcome state.

## 7) Known implementation assumptions

1. Uganda is first live country.
2. Payroll frequency starts with monthly and can expand by config.
3. Advance-related deductions are instruction-capable only in Phase 1.

