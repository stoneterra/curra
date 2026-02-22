# Stone Input Pack (Research Draft for Approval)

Date prepared: 2026-02-22
Purpose: Proposed values for `/Users/stoneatwine/Curra Project/docs/STONE_INPUTS_REQUIRED.md`
Status: Draft pending Stone approval

## 1) Uganda PAYE rule table for MVP (resident individuals)

Proposed annual bands (UGX):

1. 0 to 2,820,000 -> 0%
2. 2,820,001 to 4,020,000 -> 10% of excess over 2,820,000
3. 4,020,001 to 4,920,000 -> 120,000 + 20% of excess over 4,020,000
4. 4,920,001 to 120,000,000 -> 300,000 + 30% of excess over 4,920,000
5. Above 120,000,000 -> 34,824,000 + 40% of excess over 120,000,000

Derived monthly withholding bands (inference from annual rates):

1. 0 to 235,000 -> 0%
2. 235,001 to 335,000 -> 10% of excess over 235,000
3. 335,001 to 410,000 -> 10,000 + 20% of excess over 335,000
4. 410,001 to 10,000,000 -> 25,000 + 30% of excess over 410,000
5. Above 10,000,000 -> 2,902,000 + 40% of excess over 10,000,000

Suggested effective date to configure: `2026-02-22` until superseded.

## 2) Uganda NSSF rules for MVP

Proposed:

1. Employee contribution: 5% of gross monthly wage.
2. Employer contribution: 10% of gross monthly wage.
3. Total standard contribution: 15% of gross monthly wage.
4. Payment due: within 15 days following month-end (operationally use 15th of following month).

Suggested effective date to configure: `2026-02-22` until superseded.

## 3) Statutory remittance operational defaults (MVP)

Proposed operational rules:

1. PAYE return + payment due date: 15th day of following month.
2. NSSF contribution due date: 15th day of following month.
3. If due date falls on non-business day, submit by prior business day to reduce penalty risk.
4. Remittance reference format:
   - PAYE: `PAYE-{TIN}-{YYYYMM}`
   - NSSF: `NSSF-{EMPLOYER_CODE}-{YYYYMM}`

Note: reference formats above are Curra internal defaults and must be validated against employer filing practice.

## 4) Eversend sandbox integration details (research-backed baseline)

Proposed baseline:

1. API base URL: `https://api.eversend.co/v1`
2. Auth token endpoint: `GET /auth/token`
3. Payout quotation endpoint: `POST /payouts/quotation`
4. Payout creation endpoint: `POST /payouts`
5. Webhook signature header: `x-eversend-signature`
6. Signature verification: `HMAC SHA512(rawBody, webhookSecret)` and compare to header.
7. Callback response handling: return HTTP 2xx (ideally 200) only after successful internal persistence.

Open item (cannot be confirmed from public docs alone):

1. Official idempotency header/field requirement for payouts (likely via request reference field; verify in sandbox with Eversend support).

## 5) Pilot company setup values (to be provided by Stone)

Pending Stone:

1. Legal name
2. TIN
3. NSSF employer code
4. Country code (`UG`)
5. Currency (`UGX`)
6. First payroll period dates

## 6) Confidence and validation flags

1. PAYE annual bands: High confidence.
2. PAYE monthly band conversion: Medium confidence (derived from annual schedule).
3. NSSF 5%/10%/15% and due date: High confidence.
4. PAYE due date as 15th: Medium confidence (supported by multiple sources; still verify with tax counsel or URA account manager before first live payroll).
5. Eversend webhook verification details: High confidence.
6. Eversend idempotency specifics: Low confidence until sandbox confirmation.

## Sources

1. PwC Uganda individual tax rates (last reviewed 12 Jan 2026): https://taxsummaries.pwc.com/uganda/individual/taxes-on-personal-income
2. URA page showing resident individual annual tax schedule: https://ura.go.ug/sw/ufugaji-wa-mifugo/
3. NSSF Uganda membership (5% + 10%, paid by 15th): https://www.nssfug.org/about-us/membership/
4. NSSF Act summary text (15% standard contribution within 15 days): https://ulii.org/akn/ug/act/1985/8/eng%402022-01-07
5. Eversend API overview: https://eversend.readme.io/reference/api-overview
6. Eversend token endpoint: https://eversend.readme.io/reference/get-token
7. Eversend payout quotation endpoint: https://eversend.readme.io/reference/create-payout-quotation
8. Eversend payout endpoint: https://eversend.readme.io/reference/create-payout-transaction-beneficiary
9. Eversend webhook verification details: https://eversend.readme.io/reference/webhooks
10. TPCA schedule timing (secondary summary): https://www.rsm.global/uganda/insights/tax-insights/key-highlights-tax-procedures-code-act

