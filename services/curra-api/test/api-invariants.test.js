import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { buildApp } from '../dist/app.js';
import { resetRuntimeContextForTests } from '../dist/runtime-context.js';

test('tenant-scoped payroll run listing returns only requested tenant', async () => {
  process.env.CURRA_PERSISTENCE_MODE = 'memory';
  resetRuntimeContextForTests();
  const app = await buildApp();

  const bodyA = {
    tenantId: 'tenant-A',
    companyId: 'company-A',
    periodId: 'period-A',
    countryCode: 'UG',
    currencyCode: 'UGX',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    employees: [
      {
        employeeId: 'emp-A',
        baseSalaryMinor: 100000000,
        taxableEarningsMinor: 0,
        additionalEarningsMinor: 0
      }
    ]
  };

  const bodyB = {
    tenantId: 'tenant-B',
    companyId: 'company-B',
    periodId: 'period-B',
    countryCode: 'UG',
    currencyCode: 'UGX',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    employees: [
      {
        employeeId: 'emp-B',
        baseSalaryMinor: 100000000,
        taxableEarningsMinor: 0,
        additionalEarningsMinor: 0
      }
    ]
  };

  await app.inject({ method: 'POST', url: '/payroll-runs', payload: bodyA });
  await app.inject({ method: 'POST', url: '/payroll-runs', payload: bodyB });

  const resA = await app.inject({ method: 'GET', url: '/payroll-runs?tenantId=tenant-A' });
  const parsedA = resA.json();

  assert.equal(parsedA.runs.length, 1);
  assert.equal(parsedA.runs[0].tenantId, 'tenant-A');

  await app.close();
});

test('eversend webhook replay is idempotent for same callback key', async () => {
  process.env.CURRA_PERSISTENCE_MODE = 'memory';
  process.env.EVERSEND_WEBHOOK_SECRET = 'test-secret';
  resetRuntimeContextForTests();
  const app = await buildApp();

  const payload = {
    eventId: 'evt-123',
    tenantId: 'tenant-A',
    status: 'success'
  };

  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha512', 'test-secret').update(rawBody).digest('hex');

  const first = await app.inject({
    method: 'POST',
    url: '/webhooks/eversend',
    headers: {
      'content-type': 'application/json',
      'x-eversend-signature': signature
    },
    payload: rawBody
  });

  const second = await app.inject({
    method: 'POST',
    url: '/webhooks/eversend',
    headers: {
      'content-type': 'application/json',
      'x-eversend-signature': signature
    },
    payload: rawBody
  });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);

  const listed = await app.inject({ method: 'GET', url: '/payroll-runs?tenantId=tenant-A' });
  const parsed = listed.json();
  const callbackEvents = parsed.outbox.filter((event) => event.eventType === 'EversendCallbackReceived');

  assert.equal(callbackEvents.length, 1);

  await app.close();
});

test('finalize emits NetPayDisbursementRequested with line items and payout idempotency keys', async () => {
  process.env.CURRA_PERSISTENCE_MODE = 'memory';
  resetRuntimeContextForTests();
  const app = await buildApp();

  const created = await app.inject({
    method: 'POST',
    url: '/payroll-runs',
    payload: {
      tenantId: 'tenant-C',
      companyId: 'company-C',
      periodId: 'period-C',
      countryCode: 'UG',
      currencyCode: 'UGX',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      employees: [
        {
          employeeId: 'emp-C',
          baseSalaryMinor: 100000000,
          taxableEarningsMinor: 0,
          additionalEarningsMinor: 0,
          payoutBeneficiaryName: 'Emp C',
          payoutBeneficiaryAccount: '256700000003',
          payoutBeneficiaryCountryCode: 'UG',
          payoutDestinationCountryCode: 'UG',
          payoutDestinationNetwork: 'mobile_money'
        }
      ]
    }
  });

  const runId = created.json().payrollRunId;

  const finalized = await app.inject({
    method: 'POST',
    url: `/payroll-runs/${runId}/finalize`,
    payload: {}
  });
  assert.equal(finalized.statusCode, 200);

  const listed = await app.inject({ method: 'GET', url: '/payroll-runs?tenantId=tenant-C' });
  const parsed = listed.json();
  const disbursement = parsed.outbox.find((event) => event.eventType === 'NetPayDisbursementRequested');

  assert.ok(disbursement);
  assert.equal(disbursement.payload.lineItems.length, 1);
  assert.equal(disbursement.payload.lineItems[0].idempotencyKey, `${runId}:emp-C:netpay:v1`);
  assert.equal(disbursement.payload.lineItems[0].amountMinor, 74800000);

  await app.close();
});

test('finalized run summary is served from immutable snapshot with locked adapter metadata', async () => {
  process.env.CURRA_PERSISTENCE_MODE = 'memory';
  resetRuntimeContextForTests();
  const app = await buildApp();

  const created = await app.inject({
    method: 'POST',
    url: '/payroll-runs',
    payload: {
      tenantId: 'tenant-D',
      companyId: 'company-D',
      periodId: 'period-D',
      countryCode: 'UG',
      currencyCode: 'UGX',
      sourceWallet: 'UGX',
      employerTin: '1042486655',
      employerNssfCode: 'NS035707',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      employees: [
        {
          employeeId: 'emp-D',
          employmentStatus: 'active',
          baseSalaryMinor: 2500000,
          taxableEarningsMinor: 0,
          additionalEarningsMinor: 0,
          payoutBeneficiaryName: 'Employee D',
          payoutBeneficiaryAccount: '256700000099',
          payoutBeneficiaryCountryCode: 'UG',
          payoutDestinationCountryCode: 'UG',
          payoutDestinationNetwork: 'mobile_money'
        }
      ]
    }
  });

  const runId = created.json().payrollRunId;
  const finalized = await app.inject({ method: 'POST', url: `/payroll-runs/${runId}/finalize`, payload: {} });
  assert.equal(finalized.statusCode, 200);

  const summary = await app.inject({ method: 'GET', url: `/payroll-runs/${runId}/summary` });
  assert.equal(summary.statusCode, 200);
  const body = summary.json();

  assert.equal(body.mode, 'finalized_snapshot');
  assert.equal(body.adapterMetadata.ruleSetId, 'UG-PAYE-NSSF-2026-02');
  assert.equal(body.adapterMetadata.adapterVersion, '2026.02.2');
  assert.equal(body.grossTotalMinor, 2500000);
  assert.equal(body.netTotalMinor, 2375000);
  assert.equal(body.payeTotalMinor, 0);
  assert.equal(body.employeeNssfTotalMinor, 125000);
  assert.equal(body.employerNssfTotalMinor, 250000);
  assert.equal(body.validationWarnings.length, 0);

  const payeExport = await app.inject({ method: 'GET', url: `/payroll-runs/${runId}/exports/paye-remittance.csv` });
  const nssfExport = await app.inject({ method: 'GET', url: `/payroll-runs/${runId}/exports/nssf-remittance.csv` });
  assert.equal(payeExport.statusCode, 200);
  assert.equal(nssfExport.statusCode, 200);
  assert.match(payeExport.body, /URA/);
  assert.match(nssfExport.body, /NSSF/);

  await app.close();
});
