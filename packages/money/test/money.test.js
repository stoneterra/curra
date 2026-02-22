import test from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../dist/index.js';

test('Money enforces integer minor units', () => {
  assert.throws(() => new Money(10.5, 'UGX'), /integer minor units/i);
  assert.doesNotThrow(() => new Money(10, 'UGX'));
});

test('Money rejects mixed-currency arithmetic', () => {
  const a = new Money(100, 'UGX');
  const b = new Money(100, 'USD');
  assert.throws(() => a.add(b), /different currencies/i);
});

test('Money arithmetic is deterministic in minor units', () => {
  const a = new Money(1200, 'UGX');
  const b = new Money(300, 'UGX');
  assert.equal(a.add(b).amountMinor, 1500);
  assert.equal(a.subtract(b).amountMinor, 900);
});
