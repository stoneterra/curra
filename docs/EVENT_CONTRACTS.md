# Curra Canonical Event Contracts

Last updated: 2026-02-22
Status: Active

## 1) Event envelope

All events must contain:

1. `event_id` (UUID)
2. `event_type` (string)
3. `event_version` (semver string)
4. `occurred_at` (UTC ISO-8601)
5. `producer` (service name)
6. `tenant_id` (UUID)
7. `correlation_id` (UUID/string)
8. `idempotency_key` (string)
9. `payload` (typed object)

## 2) Curra-produced events

### `PayrollRunFinalized`

Payload fields:

1. `payroll_run_id`
2. `company_id`
3. `period_id`
4. `country_code`
5. `currency`
6. `gross_total_minor`
7. `net_total_minor`
8. `statutory_total_minor`
9. `employee_count`
10. `adapter_version`
11. `rule_set_id`
12. `finalized_at`

### `VerifiedIncomeUpdated`

Payload fields:

1. `employee_id`
2. `payroll_run_id`
3. `period_id`
4. `country_code`
5. `gross_income_minor`
6. `taxable_income_minor`
7. `net_income_minor`
8. `deductions_total_minor`
9. `payment_frequency`
10. `effective_date`

### `NetPayDisbursementRequested`

Payload fields:

1. `payroll_run_id`
2. `instruction_batch_id`
3. `country_code`
4. `currency`
5. `total_amount_minor`
6. `line_items[]`:
   - `employee_id`
   - `destination_ref`
   - `amount_minor`
7. `requested_at`

### `StatutoryRemittanceRequested`

Payload fields:

1. `payroll_run_id`
2. `period_id`
3. `country_code`
4. `authority`
5. `currency`
6. `amount_minor`
7. `due_date`
8. `requested_at`

### `EmployeeTerminated`

Payload fields:

1. `employee_id`
2. `company_id`
3. `country_code`
4. `termination_date`
5. `reason_code`
6. `final_payroll_period_id`
7. `outstanding_deduction_minor`

## 3) Future events (Advance Engine domain)

1. `AdvanceOffered`
2. `AdvanceAccepted`
3. `AdvanceRepaymentScheduled`
4. `AdvanceRepaymentCollected`
5. `AdvanceDefaultTriggered`

Curra consumes these via versioned contracts when enabled by phase scope.

## 4) Delivery guarantees and safety

1. Delivery: at-least-once.
2. Consumers must be replay-safe.
3. Dedupe key: `event_id + consumer_name`.
4. All producers use outbox + transactional write.
5. Schema changes require `event_version` bump.

