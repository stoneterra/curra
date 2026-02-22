# Country Adapter Specification

Last updated: 2026-02-22
Status: Active

## 1) Goal

Keep core payroll engine country-agnostic while supporting statutory payroll logic per country through adapter modules.

## 2) Adapter interface contract

Each adapter must implement:

1. `validatePayrollInputs(input): ValidationResult`
2. `computeStatutoryDeductions(input): DeductionComputation`
3. `computeEmployerContributions(input): EmployerContributionComputation`
4. `generateRemittanceInstructions(input): RemittanceInstruction[]`
5. `versionMetadata(): AdapterMetadata`

`AdapterMetadata` must contain:

1. `country_code`
2. `adapter_version`
3. `rule_set_id`
4. `effective_from`
5. `effective_to` (nullable)

## 3) Inputs and outputs

### Required normalized input

1. Employee compensation lines.
2. Taxable/non-taxable classifications.
3. Payroll period boundaries.
4. Employee status flags.
5. Company statutory config.

### Required output

1. Deduction lines in minor units.
2. Employer contribution lines in minor units.
3. Remittance instruction objects with authority, amount, due date.
4. Adapter metadata for immutable run storage.

## 4) Versioning rules

1. Rules are immutable once published.
2. New legal change => new `rule_set_id`.
3. Finalized payroll run stores adapter metadata and cannot be recomputed with different rules unless explicitly migrated as a new run.
4. Rule changes require fixture updates and passing certification tests.

## 5) Boundary rules

Adapters may contain:

1. Statutory formulas.
2. Thresholds, banding, reliefs.
3. Authority remittance formats and due-date logic.

Adapters may not contain:

1. Ledger posting logic.
2. Tenant authorization logic.
3. External transfer execution logic.
4. UI/state orchestration logic.

## 6) Country rollout order

Phase order for onboarding after Uganda:

1. Kenya
2. Rwanda
3. Nigeria
4. Ghana
5. Cameroon
6. UK

This can be adjusted by Stone based on market priorities.

