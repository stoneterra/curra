# Inputs Required From Stone (Next)

Last updated: 2026-02-22

## Provided inputs (recorded)

1. Pilot legal name: `Cogni Labs Ltd`
2. Pilot TIN: `1042468655` (extracted from `/Users/stoneatwine/Downloads/Cogni Labs TIN Certificate.pdf` on 2026-02-22)
3. NSSF employer code: `NS035707`
4. Country code: `UG`
5. Currency: `UGX`
6. First payroll date: `2026-02-28`

## Inference applied for build defaults

1. Payroll frequency is monthly (already approved default).
2. First payroll period is set as:
   - `period_start`: `2026-02-01`
   - `period_end`: `2026-02-28`
   - `pay_date`: `2026-02-28`

## Remaining open inputs before live payroll execution

1. Eversend live integration details:
   - Base URL
   - Authentication method
   - Required idempotency header format
   - Callback signature verification method
2. None.

## Active default statutory configuration (implemented)

1. Uganda PAYE monthly bands (from research draft) are active in:
   - `/Users/stoneatwine/Curra Project/packages/country-adapter-ug/src/rules.2026-02.json`
2. Uganda NSSF rates are active in:
   - `/Users/stoneatwine/Curra Project/packages/country-adapter-ug/src/rules.2026-02.json`
