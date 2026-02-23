# Curra Project

This repository contains the Curra payroll platform build, starting with Uganda MVP and country-ready architecture for future expansion (Kenya, Nigeria, Ghana, Cameroon, Rwanda, UK).

Authoritative operating standard:

- `/Users/stoneatwine/Curra Project/docs/ENGINEERING_PLAYBOOK.md`

## Current milestone

Milestone 4 in progress: Uganda payroll-first delivery (guided operator flow, immutable finalized snapshots, statutory/export pack).

## Current status (2026-02-23)

1. Workspace tooling installed and configured (Node 20, pnpm, PostgreSQL client).
2. Monorepo typecheck and build are passing.
3. API smoke-tested in memory mode (`/`, `/health`, payroll draft create/list, ledger accrual post).
4. Payroll finalize now stores immutable snapshot outputs (locked adapter/rule metadata).
5. Golden fixture tests are active for Uganda (`Cogni Labs Feb 2026`) plus API invariants.

## Assumptions currently applied

1. Uganda MVP scope includes PAYE + NSSF only.
2. No stablecoin or crypto logic exists in Curra.
3. Multi-country support is adapter-driven and introduced progressively.
4. No production deployment is executed without explicit Stone approval.

## Immediate next input from Stone

See `/Users/stoneatwine/Curra Project/docs/STONE_INPUTS_REQUIRED.md`.

## Local setup

See `/Users/stoneatwine/Curra Project/docs/LOCAL_SETUP.md`.

## Operator frontend preview

Thin operator frontend is available at:

- `/Users/stoneatwine/Curra Project/services/curra-ops`

Run locally:

```bash
cd "/Users/stoneatwine/Curra Project"
pnpm --filter @curra/curra-ops dev
```

Default API target:

- `https://curra-api-e3nk3kbbva-uc.a.run.app`

Primary payroll export endpoints:

- `GET /payroll-runs/:payrollRunId/exports/payroll-register.csv`
- `GET /payroll-runs/:payrollRunId/exports/paye-remittance.csv`
- `GET /payroll-runs/:payrollRunId/exports/nssf-remittance.csv`
- `GET /payroll-runs/:payrollRunId/exports/disbursement-instructions.csv`
