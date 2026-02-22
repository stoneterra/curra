# Curra Decisions Log

Last updated: 2026-02-22
Owner: Stone

## Active defaults

1. Payroll frequency at MVP: Monthly only.
2. Uganda statutory scope at MVP: PAYE + NSSF only.
3. Deployment platform: Cloud Run.
4. Auth provider: Auth0.
5. Billing integration timing: Stripe in MVP.
6. Eversend integration mode: sandbox-first with official API contracts and webhook signature verification.
7. Payment rail architecture: provider-pluggable interface (`CURRA_PAYOUT_PROVIDER`), with `eversend` as current default.
8. Secondary demo rail enabled: `manual` stub provider for provider-switch demonstrations without code changes.

## Eversend baseline (approved to implement now)

1. Base URL: `https://api.eversend.co/v1`
2. Token endpoint: `GET /auth/token`
3. Payout quotation endpoint: `POST /payouts/quotation`
4. Payout endpoint: `POST /payouts`
5. Webhook signature header: `x-eversend-signature`
6. Webhook signature verification method: `HMAC SHA512(rawBody, webhookSecret)`
7. Live credentials will be provided by Stone later.

## Notes

These defaults are active unless Stone explicitly changes them.
