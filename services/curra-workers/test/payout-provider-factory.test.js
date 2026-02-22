import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayoutGateway } from '../dist/providers/payout-gateway-factory.js';

test('factory selects manual provider when configured', async () => {
  process.env.CURRA_PAYOUT_PROVIDER = 'manual';
  const selected = createPayoutGateway(false);

  assert.equal(selected.provider, 'manual');

  const q = await selected.gateway.createPayoutQuotation({
    amountMinor: 1000,
    currency: 'UGX',
    destinationCountryCode: 'UG',
    destinationNetwork: 'mobile_money'
  });

  const p = await selected.gateway.createPayout({
    amountMinor: 1000,
    currency: 'UGX',
    beneficiaryName: 'Demo',
    beneficiaryAccount: '256700000004',
    beneficiaryCountryCode: 'UG',
    reference: 'ref-1',
    idempotencyKey: 'idem-1'
  });

  assert.equal(q.provider, 'manual');
  assert.equal(p.status, 'pending_manual_execution');
});

test('factory rejects unsupported providers in strict mode', () => {
  process.env.CURRA_PAYOUT_PROVIDER = 'unsupported';
  assert.throws(() => createPayoutGateway(true), /Unsupported payout provider/i);
});
