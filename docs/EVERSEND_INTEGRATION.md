# Eversend Integration Contract (Sandbox First)

Last updated: 2026-02-22
Status: Active for implementation

## Source baseline

Official docs used:

1. API overview: https://eversend.readme.io/reference/api-overview
2. Token: https://eversend.readme.io/reference/get-token
3. Payout quotation: https://eversend.readme.io/reference/create-payout-quotation
4. Payout creation: https://eversend.readme.io/reference/create-payout-transaction-beneficiary
5. Webhooks: https://eversend.readme.io/reference/webhooks

## MVP integration scope

1. Generate auth token from Eversend.
2. Create payout quotation.
3. Create payout request.
4. Verify incoming webhook signatures.
5. Persist request/callback correlation IDs and idempotency keys in Curra outbox/state.

## Webhook URL (curra.ai)

Use:

1. `https://api.curra.ai/webhooks/eversend`

Route implemented in API:

1. `POST /webhooks/eversend`

## Config

Required env vars:

1. `EVERSEND_BASE_URL` default `https://api.eversend.co/v1`
2. `EVERSEND_CLIENT_ID`
3. `EVERSEND_CLIENT_SECRET`
4. `EVERSEND_WEBHOOK_SECRET`
5. `EVERSEND_SOURCE_WALLET` (sandbox funding wallet id)

Optional env vars:

1. `EVERSEND_TIMEOUT_MS` default `15000`

## Security and reliability rules

1. Never log secrets.
2. Always attach and persist our idempotency key as request reference metadata.
3. Verify `x-eversend-signature` using `HMAC SHA512(rawBody, EVERSEND_WEBHOOK_SECRET)`.
4. Reject callbacks with invalid signatures.
5. Callback handlers must be replay-safe.

## Auth request specifics (validated 2026-02-22)

Token request expects these headers:

1. `clientid`
2. `clientsecret`

## Pending item for live launch

1. Confirm provider-native idempotency header or field semantics with live account manager/support before production cutover.
