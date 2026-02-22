-- Curra staging seed for Cogni Labs (Uganda payroll pilot)
-- Date: 2026-02-22

BEGIN;

INSERT INTO companies (
  id,
  tenant_id,
  legal_name,
  trading_name,
  registration_no,
  tin,
  country_code,
  currency_code,
  plan_tier,
  status
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Cogni Labs Ltd',
  'Cogni Labs',
  NULL,
  '1042468655',
  'UG',
  'UGX',
  'starter',
  'active'
)
ON CONFLICT (id) DO UPDATE
SET
  legal_name = EXCLUDED.legal_name,
  trading_name = EXCLUDED.trading_name,
  tin = EXCLUDED.tin,
  country_code = EXCLUDED.country_code,
  currency_code = EXCLUDED.currency_code,
  updated_at = now();

INSERT INTO payroll_periods (
  id,
  tenant_id,
  company_id,
  period_start,
  period_end,
  pay_date,
  status
)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  DATE '2026-02-01',
  DATE '2026-02-28',
  DATE '2026-02-28',
  'open'
)
ON CONFLICT (id) DO UPDATE
SET
  period_start = EXCLUDED.period_start,
  period_end = EXCLUDED.period_end,
  pay_date = EXCLUDED.pay_date,
  updated_at = now();

COMMIT;
