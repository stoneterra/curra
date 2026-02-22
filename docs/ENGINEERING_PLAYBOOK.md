# Curra Engineering Playbook

Owner: Stone (Product/Business Owner) + Codex (Implementation Engineer)
Applies to: All work in `/Users/stoneatwine/Curra Project`
Status: Active
Last updated: 2026-02-22

## 1) Purpose

This playbook is the binding engineering operating standard for Curra build execution.
It is designed to:

1. Ship Uganda payroll MVP quickly.
2. Preserve hard architecture boundaries for multi-country scale.
3. Prevent AI coding mistakes in money, ledger, and tenancy domains.
4. Keep implementation consistent across all modules and future contributors.

## 2) Authority and Roles

Only two parties are authorized on this project:

1. Stone
2. Codex (AI engineer)

Decision authority:

1. Stone approves product scope, go-live, legal/compliance decisions.
2. Codex executes implementation under this playbook.
3. Any conflict between speed and financial correctness resolves in favor of correctness.

## 3) Non-Negotiable System Rules

1. No shared DB tables across Curra, Advance Engine, Terra, CreditOS, Eversend.
2. Integration across products is APIs + events only.
3. Ledger-first: all financial truth comes from immutable double-entry entries.
4. No mutable `balance` field as source of truth.
5. All money is integer minor units. No floats anywhere.
6. Payroll math lives in one deterministic module only.
7. Ledger posting lives in one deterministic module only.
8. Every table is tenant-scoped; tenant isolation enforced at DB and query layer.
9. Every external call must be idempotent.
10. Every event consumer must be replay-safe.
11. Country statutory logic only in country adapters; never in core engine.
12. AI is never allowed to calculate or override money math rules.

## 4) Repo Structure Standard

Use this baseline layout:

```text
/Users/stoneatwine/Curra Project
  /docs
    ENGINEERING_PLAYBOOK.md
    ARCHITECTURE.md
    EVENT_CONTRACTS.md
    COUNTRY_ADAPTER_SPEC.md
    TEST_INVARIANTS.md
  /services
    /curra-api
    /curra-workers
  /packages
    /domain-core
    /country-adapter-ug
    /country-adapter-ke
    /country-adapter-ng
    /country-adapter-gh
    /country-adapter-cm
    /country-adapter-rw
    /country-adapter-uk
    /money
    /ledger
    /event-schemas
```

If implementation starts before full scaffold, preserve these boundary principles anyway.

## 5) AI Coding Guardrails

### 5.1 AI Allowed Scope

AI may implement:

1. CRUD APIs and validation.
2. DB migrations and indexes.
3. Event serializers/deserializers.
4. Worker orchestration and retries.
5. Test scaffolds and fixture runners.
6. Country adapter scaffolding (without inventing legal rules).
7. Documentation updates aligned to approved specs.

### 5.2 AI Forbidden Scope

AI must not:

1. Invent payroll/tax/legal formulas without approved spec.
2. Duplicate payroll math outside central compute module.
3. Duplicate ledger postings outside central posting module.
4. Introduce floats for monetary values.
5. Remove tenant filters or bypass RLS.
6. Add cross-service direct DB reads/writes.
7. Modify finalized ledger entries (only reversal journals).
8. Change event schemas without versioning and contract updates.

### 5.3 Required AI Workflow

For every implementation task:

1. Confirm the target contract/spec first.
2. Implement smallest safe change.
3. Add or update tests in same change.
4. Run relevant test suite.
5. Verify no invariant regressions.
6. Record architectural impact in docs when needed.

## 6) Single Source of Truth Modules

Mandatory canonical modules:

1. `PayrollComputationService`: all payroll math.
2. `LedgerPostingService`: all journal postings.
3. `DeductionWaterfall`: pure function allocation.
4. `CountryAdapterRegistry`: selects adapter by country + version + rule set.

No other module may perform equivalent calculations.

## 7) CI/CD Quality Gates (Blocking)

Every PR/change must pass:

1. Unit tests.
2. Integration tests.
3. Invariant test suite.
4. Replay/idempotency tests.
5. Tenant isolation tests.
6. Event contract compatibility checks.
7. Lint/static rules preventing forbidden patterns.

Automatic hard-fail conditions:

1. Debit/credit imbalance.
2. Float usage in money paths.
3. Non-tenant-scoped query in tenant domain.
4. Duplicate event side effects on replay.
5. Statutory logic detected in core engine.
6. Event schema changed without version bump.

## 8) Invariant Suite (Must Always Hold)

1. Debits equal credits per journal.
2. No ledger line has both debit and credit non-zero.
3. All money fields are integer minor units.
4. Tenant A cannot read/write Tenant B data.
5. Reconstructable state from ledger + event replay.
6. No negative statutory payable from valid posting sequence.
7. Finalized payroll run stores immutable adapter metadata:
   - `country_code`
   - `adapter_version`
   - `rule_set_id`

## 9) PR Template (Use for Every Change)

```md
## Summary
- What changed
- Why this change exists

## Contract/Spec Reference
- Source document(s):
- Confirmed fields/interfaces used:

## Risk Level
- [ ] Low
- [ ] Medium
- [ ] High (money/ledger/tenancy/security)

## Invariants Impacted
- [ ] Debits = credits
- [ ] Integer money only
- [ ] Tenant isolation
- [ ] Replay/idempotency
- [ ] Adapter boundary integrity
- Notes:

## Tests Added/Updated
- Unit:
- Integration:
- Invariant:
- Replay:

## Manual Validation
- Steps run:
- Result:

## Rollback Plan
- Revert strategy:
- Data correction strategy (if financial):
```

## 10) Country Onboarding Gate Checklist

A new country adapter can only move forward if all gates pass:

1. Legal/statutory rules documented and reviewed.
2. Adapter implementation completed with versioned rule set.
3. Golden fixtures approved.
4. Invariant suite passes.
5. Remittance instruction mapping validated.
6. Pilot parallel payroll run passes defined variance threshold.
7. Go-live approval by Stone.

## 11) Secure Change Policy

1. No destructive data fixes directly on production tables.
2. Financial corrections use reversal journals + explicit audit trail.
3. Sensitive data stored minimally; hash/tokenize where possible.
4. Every privileged action emits audit log entry.
5. Secrets never hardcoded; managed through environment secret manager.

## 12) Build Start Sequence (Immediate)

When starting implementation from scratch:

1. Create core docs first:
   - `ARCHITECTURE.md`
   - `EVENT_CONTRACTS.md`
   - `COUNTRY_ADAPTER_SPEC.md`
   - `TEST_INVARIANTS.md`
2. Scaffold domain packages with boundary tests.
3. Implement Uganda adapter first.
4. Add empty adapter stubs for KE, NG, GH, CM, RW, UK.
5. Wire CI gates before broad feature expansion.

## 13) Change Control

Any change to this playbook requires:

1. Explicit request by Stone.
2. Update committed to this file.
3. Reason for change documented in the update.

Until changed, this file remains authoritative.
