import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UgandaAdapter } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturePath = path.resolve(__dirname, '../../../docs/fixtures/cogni-labs-ug-payroll-2026-02.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const adapter = new UgandaAdapter();

const input = {
  tenantId: fixture.tenantId,
  companyId: fixture.companyId,
  payrollRunId: 'golden-cogni-2026-02',
  countryCode: fixture.countryCode,
  currencyCode: fixture.currencyCode,
  periodStart: fixture.periodStart,
  periodEnd: fixture.periodEnd
};

test('UgandaAdapter golden fixture computes deterministic totals for Cogni Feb 2026', () => {
  const deductions = adapter.computeStatutoryDeductions(input, fixture.employees);
  const contributions = adapter.computeEmployerContributions(input, fixture.employees);
  const remittance = adapter.generateRemittanceInstructions(input, deductions, contributions);
  const metadata = adapter.versionMetadata();

  const grossTotalMinor = fixture.employees.reduce(
    (sum, employee) => sum + employee.baseSalaryMinor + employee.taxableEarningsMinor + employee.additionalEarningsMinor,
    0
  );
  const payeTotalMinor = deductions
    .filter((line) => line.deductionType === 'PAYE')
    .reduce((sum, line) => sum + line.amountMinor, 0);
  const employeeNssfTotalMinor = deductions
    .filter((line) => line.deductionType === 'NSSF')
    .reduce((sum, line) => sum + line.amountMinor, 0);
  const employerNssfTotalMinor = contributions.reduce((sum, line) => sum + line.amountMinor, 0);
  const netTotalMinor = grossTotalMinor - payeTotalMinor - employeeNssfTotalMinor;
  const ura = remittance.find((line) => line.authority === 'URA');
  const nssf = remittance.find((line) => line.authority === 'NSSF');

  assert.equal(metadata.ruleSetId, 'UG-PAYE-NSSF-2026-02');
  assert.equal(metadata.adapterVersion, '2026.02.2');
  assert.equal(grossTotalMinor, 34814318);
  assert.equal(payeTotalMinor, 0);
  assert.equal(employeeNssfTotalMinor, 1740712);
  assert.equal(employerNssfTotalMinor, 3481428);
  assert.equal(netTotalMinor, 33073606);
  assert.equal(ura?.amountMinor, 0);
  assert.equal(nssf?.amountMinor, 5222140);
  assert.equal(ura?.dueDate, '2026-03-15');
  assert.equal(nssf?.dueDate, '2026-03-15');
});
