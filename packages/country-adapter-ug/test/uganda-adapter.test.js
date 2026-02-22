import test from 'node:test';
import assert from 'node:assert/strict';
import { UgandaAdapter } from '../dist/index.js';

const adapter = new UgandaAdapter();

const input = {
  tenantId: 't1',
  companyId: 'c1',
  payrollRunId: 'r1',
  countryCode: 'UG',
  currencyCode: 'UGX',
  periodStart: '2026-02-01',
  periodEnd: '2026-02-28'
};

test('UgandaAdapter computes PAYE and NSSF deductions', () => {
  const employees = [
    {
      employeeId: 'e1',
      baseSalaryMinor: 100000000,
      taxableEarningsMinor: 0,
      additionalEarningsMinor: 0
    }
  ];

  const deductions = adapter.computeStatutoryDeductions(input, employees);

  const paye = deductions.find((line) => line.deductionType === 'PAYE');
  const nssf = deductions.find((line) => line.deductionType === 'NSSF');

  assert.equal(paye.amountMinor, 20200000);
  assert.equal(nssf.amountMinor, 5000000);
});

test('UgandaAdapter computes employer NSSF and remittance due dates', () => {
  const employees = [
    {
      employeeId: 'e1',
      baseSalaryMinor: 100000000,
      taxableEarningsMinor: 0,
      additionalEarningsMinor: 0
    }
  ];

  const deductions = adapter.computeStatutoryDeductions(input, employees);
  const contributions = adapter.computeEmployerContributions(input, employees);
  const remittance = adapter.generateRemittanceInstructions(input, deductions, contributions);

  const ura = remittance.find((line) => line.authority === 'URA');
  const nssf = remittance.find((line) => line.authority === 'NSSF');

  assert.equal(contributions[0].amountMinor, 10000000);
  assert.equal(ura.amountMinor, 20200000);
  assert.equal(nssf.amountMinor, 15000000);
  assert.equal(ura.dueDate, '2026-03-15');
  assert.equal(nssf.dueDate, '2026-03-15');
});
