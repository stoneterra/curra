# Uganda UAT: Manual Rail Then Eversend Rail

Last updated: 2026-02-22
Company: `Cogni Labs Ltd`

## Scope for this run

1. Country: `UG`
2. Currency: `UGX`
3. Payroll period: `2026-02-01` to `2026-02-28`
4. Pay date rule: `28th of every month`
5. Phase A rail: `manual`
6. Phase B rail: `eversend`

## Preconditions

1. API is live:
   - `https://curra-api-e3nk3kbbva-uc.a.run.app/health`
2. Worker job exists:
   - `curra-disbursement-worker`
3. Eversend credentials are set in Secret Manager for the worker runtime.
4. Payroll payload file exists:
   - `/Users/stoneatwine/Curra Project/docs/fixtures/cogni-labs-ug-payroll-2026-02.json`

## 1) Create payroll draft

```bash
curl -sS -X POST "https://curra-api-e3nk3kbbva-uc.a.run.app/payroll-runs" \
  -H "content-type: application/json" \
  --data-binary @"/Users/stoneatwine/Curra Project/docs/fixtures/cogni-labs-ug-payroll-2026-02.json"
```

Save `payrollRunId` from the response.

## 2) Finalize payroll run

```bash
export RUN_ID="<paste-payrollRunId>"
curl -sS -X POST "https://curra-api-e3nk3kbbva-uc.a.run.app/payroll-runs/${RUN_ID}/finalize" \
  -H "content-type: application/json" \
  -d '{}'
```

This emits `NetPayDisbursementRequested` outbox events.

## 3) Phase A: process with manual rail

Set worker env:

1. `CURRA_PAYOUT_PROVIDER=manual`
2. `CURRA_REQUIRE_EXTERNALS=true`

Run one worker execution and validate:

1. Outbox events are marked published.
2. No retries for same event (`event_consumption_log` shows single successful consumption per event and consumer).
3. Provider response status is `pending_manual_execution`.

## 4) Phase B: switch to Eversend rail

Set worker env:

1. `CURRA_PAYOUT_PROVIDER=eversend`
2. `CURRA_REQUIRE_EXTERNALS=true`
3. `EVERSEND_BASE_URL=https://api.eversend.co/v1`
4. `EVERSEND_CLIENT_ID` from Secret Manager.
5. `EVERSEND_CLIENT_SECRET` from Secret Manager.
6. `EVERSEND_WEBHOOK_SECRET` from Secret Manager.

Run one worker execution and validate:

1. Quotations and payouts are attempted for each line item.
2. Idempotency keys from each line item are sent.
3. Re-run worker without new events and confirm no duplicate disbursements.

## 5) Pass criteria

1. Payroll finalization succeeds with deterministic totals.
2. Manual rail run succeeds and is replay-safe.
3. Eversend rail run succeeds and is replay-safe.
4. `event_consumption_log` prevents double-processing for same consumer/event.
5. No tenant bleed in any query output.

## 6) Human support needed from Stone

1. Confirm final beneficiary accounts for live Eversend payouts.
2. Approve whether first live disbursement is full batch or a 2-employee canary.
3. Confirm remittance ops owner for PAYE/NSSF filing after run closes.
