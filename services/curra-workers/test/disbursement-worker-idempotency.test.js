import test from 'node:test';
import assert from 'node:assert/strict';
import { NetPayDisbursementWorker } from '../dist/disbursement/worker.js';

class FakeOutboxRepository {
  constructor(events) {
    this.events = events;
    this.published = new Set();
  }

  async listPendingNetPayEvents(limit) {
    return this.events.filter((event) => !this.published.has(event.eventId)).slice(0, limit);
  }

  async markPublished(eventId) {
    this.published.add(eventId);
  }
}

class FakeConsumptionLogRepository {
  constructor() {
    this.state = new Map();
  }

  async acquire(consumerName, event) {
    const key = `${consumerName}:${event.eventId}`;
    const current = this.state.get(key);

    if (!current) {
      this.state.set(key, { status: 'processing', attempts: 1 });
      return 'acquired';
    }

    if (current.status === 'succeeded') {
      return 'already_succeeded';
    }

    this.state.set(key, { status: 'processing', attempts: current.attempts + 1 });
    return 'acquired';
  }

  async markSucceeded(consumerName, eventId) {
    this.state.set(`${consumerName}:${eventId}`, { status: 'succeeded', attempts: this.state.get(`${consumerName}:${eventId}`)?.attempts ?? 1 });
  }

  async markFailed(consumerName, eventId, errorMessage) {
    this.state.set(`${consumerName}:${eventId}`, {
      status: 'failed',
      attempts: this.state.get(`${consumerName}:${eventId}`)?.attempts ?? 1,
      errorMessage
    });
  }
}

class FlakyEversendGateway {
  constructor() {
    this.quotationCalls = 0;
    this.payoutCalls = 0;
    this.payoutIdempotencyKeys = [];
    this.failFirstPayout = true;
  }

  async createPayoutQuotation() {
    this.quotationCalls += 1;
    return { ok: true };
  }

  async createPayout(request) {
    this.payoutCalls += 1;
    this.payoutIdempotencyKeys.push(request.idempotencyKey);

    if (this.failFirstPayout) {
      this.failFirstPayout = false;
      throw new Error('temporary payout failure');
    }

    return { ok: true };
  }
}

function makeEvent() {
  return {
    eventId: '11111111-1111-1111-1111-111111111111',
    tenantId: 'tenant-1',
    eventType: 'NetPayDisbursementRequested',
    correlationId: 'run-1',
    idempotencyKey: 'run-1:netpay:request:v1',
    payload: {
      payrollRunId: 'run-1',
      currencyCode: 'UGX',
      totalAmountMinor: 1000,
      lineItems: [
        {
          employeeId: 'emp-1',
          beneficiaryName: 'Emp 1',
          beneficiaryAccount: '256700000001',
          beneficiaryCountryCode: 'UG',
          destinationCountryCode: 'UG',
          destinationNetwork: 'mobile_money',
          amountMinor: 1000,
          currencyCode: 'UGX',
          reference: 'PAYROLL-run-1-emp-1',
          idempotencyKey: 'run-1:emp-1:netpay:v1'
        }
      ]
    }
  };
}

test('worker retries failed events and uses stable payout idempotency key', async () => {
  const outbox = new FakeOutboxRepository([makeEvent()]);
  const logs = new FakeConsumptionLogRepository();
  const gateway = new FlakyEversendGateway();
  const worker = new NetPayDisbursementWorker(outbox, logs, gateway, 'netpay-disbursement-worker');

  const first = await worker.processBatch(10);
  assert.equal(first.processed, 0);
  assert.equal(first.failed, 1);

  const second = await worker.processBatch(10);
  assert.equal(second.processed, 1);
  assert.equal(second.failed, 0);

  const third = await worker.processBatch(10);
  assert.equal(third.processed, 0);
  assert.equal(third.failed, 0);

  assert.equal(gateway.payoutCalls, 2);
  assert.deepEqual(gateway.payoutIdempotencyKeys, ['run-1:emp-1:netpay:v1', 'run-1:emp-1:netpay:v1']);
});
