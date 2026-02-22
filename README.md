# Curra Project

This repository contains the Curra payroll platform build, starting with Uganda MVP and country-ready architecture for future expansion (Kenya, Nigeria, Ghana, Cameroon, Rwanda, UK).

Authoritative operating standard:

- `/Users/stoneatwine/Curra Project/docs/ENGINEERING_PLAYBOOK.md`

## Current milestone

Milestone 3 in progress: persisted payroll run API + ledger posting endpoint + outbox + Eversend worker scaffold.

## Current status (2026-02-22)

1. Workspace tooling installed and configured (Node 20, pnpm, PostgreSQL client).
2. Monorepo typecheck and build are passing.
3. API smoke-tested in memory mode (`/`, `/health`, payroll draft create/list, ledger accrual post).
4. Payroll finalize intentionally blocked until Uganda statutory legal fixtures are approved and encoded.
5. Invariant tests are active for `money` and `ledger` packages.

## Assumptions currently applied

1. Uganda MVP scope includes PAYE + NSSF only.
2. No stablecoin or crypto logic exists in Curra.
3. Multi-country support is adapter-driven and introduced progressively.
4. No production deployment is executed without explicit Stone approval.

## Immediate next input from Stone

See `/Users/stoneatwine/Curra Project/docs/STONE_INPUTS_REQUIRED.md`.

## Local setup

See `/Users/stoneatwine/Curra Project/docs/LOCAL_SETUP.md`.
