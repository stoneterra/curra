import { useEffect, useMemo, useState } from 'react';

type RunStatus = 'draft' | 'finalized';

interface PayrollRun {
  payrollRunId: string;
  tenantId: string;
  companyId: string;
  periodId: string;
  countryCode: string;
  currencyCode: string;
  sourceWallet?: string;
  periodStart: string;
  periodEnd: string;
  employerTin?: string;
  employerNssfCode?: string;
  status: RunStatus;
  createdAt: string;
}

interface OutboxEvent {
  eventId: string;
  eventType: string;
  correlationId: string;
  idempotencyKey: string;
  createdAt: string;
  publishedAt?: string | null;
  payload: {
    payrollRunId?: string;
    sourceWallet?: string;
    totalAmountMinor?: number;
  };
}

interface RunsResponse {
  runs: PayrollRun[];
  outbox: OutboxEvent[];
}

interface PayrollRunSummary {
  run: PayrollRun;
  computedAt: string;
  mode: 'draft_recompute' | 'finalized_snapshot';
  adapterMetadata: {
    countryCode: string;
    adapterVersion: string;
    ruleSetId: string;
    effectiveFrom: string;
  };
  grossTotalMinor: number;
  deductionsTotalMinor: number;
  netTotalMinor: number;
  currencyCode: string;
  sourceWallet: string;
  payeTotalMinor: number;
  employeeNssfTotalMinor: number;
  employerNssfTotalMinor: number;
  validationWarnings: string[];
  employeeBreakdowns: Array<{
    employeeId: string;
    beneficiaryName: string;
    grossMinor: number;
    payeMinor: number;
    employeeNssfMinor: number;
    employerNssfMinor: number;
    totalDeductionsMinor: number;
    netMinor: number;
    currencyCode: string;
    payoutBeneficiaryAccount: string;
    payoutBeneficiaryCountryCode: string;
    payoutDestinationCountryCode: string;
    payoutDestinationNetwork: string;
  }>;
  remittanceInstructions: Array<{
    authority: 'URA' | 'NSSF';
    amountMinor: number;
    currencyCode: string;
    dueDate: string;
  }>;
}

interface EmployeeInput {
  employeeId: string;
  baseSalaryMinor: number;
  taxableEarningsMinor: number;
  additionalEarningsMinor: number;
  employmentStatus?: 'active' | 'inactive';
  payoutBeneficiaryName: string;
  payoutBeneficiaryAccount: string;
  payoutBeneficiaryCountryCode: string;
  payoutDestinationCountryCode: string;
  payoutDestinationNetwork: string;
}

interface Settings {
  apiBaseUrl: string;
  tenantId: string;
  companyId: string;
  periodId: string;
  countryCode: string;
  currencyCode: string;
  employerTin: string;
  employerNssfCode: string;
  defaultSourceWallet: string;
  payoutProvider: 'manual' | 'eversend';
}

const SETTINGS_KEY = 'curra_ops_settings_v1';

const defaultSettings: Settings = {
  apiBaseUrl: 'https://curra-api-e3nk3kbbva-uc.a.run.app',
  tenantId: '11111111-1111-1111-1111-111111111111',
  companyId: '22222222-2222-2222-2222-222222222222',
  periodId: '33333333-3333-3333-3333-333333333333',
  countryCode: 'UG',
  currencyCode: 'UGX',
  employerTin: '1042486655',
  employerNssfCode: 'NS035707',
  defaultSourceWallet: 'UGX',
  payoutProvider: 'manual'
};

const sampleEmployees: EmployeeInput[] = [
  {
    employeeId: 'emp-001',
    baseSalaryMinor: 2500000,
    taxableEarningsMinor: 0,
    additionalEarningsMinor: 0,
    payoutBeneficiaryName: 'Vanessa Kiconco',
    payoutBeneficiaryAccount: '256700000001',
    payoutBeneficiaryCountryCode: 'UG',
    payoutDestinationCountryCode: 'UG',
    payoutDestinationNetwork: 'mobile_money'
  },
  {
    employeeId: 'emp-002',
    baseSalaryMinor: 2156923,
    taxableEarningsMinor: 0,
    additionalEarningsMinor: 0,
    payoutBeneficiaryName: 'Joan Tinkasiimire Kebirungi',
    payoutBeneficiaryAccount: '256700000002',
    payoutBeneficiaryCountryCode: 'UG',
    payoutDestinationCountryCode: 'UG',
    payoutDestinationNetwork: 'mobile_money'
  }
];

const sampleEmployeesJson = JSON.stringify(sampleEmployees, null, 2);

export function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings;
    }

    try {
      return { ...defaultSettings, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch {
      return defaultSettings;
    }
  });

  const [periodStart, setPeriodStart] = useState('2026-02-01');
  const [periodEnd, setPeriodEnd] = useState('2026-02-28');
  const [sourceWallet, setSourceWallet] = useState(settings.defaultSourceWallet);
  const [employeesJson, setEmployeesJson] = useState(sampleEmployeesJson);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [outbox, setOutbox] = useState<OutboxEvent[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [summary, setSummary] = useState<PayrollRunSummary | null>(null);
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setDraftReady(false);
  }, [employeesJson, periodStart, periodEnd, sourceWallet, settings.employerTin, settings.employerNssfCode]);

  const apiBase = useMemo(() => settings.apiBaseUrl.replace(/\/$/, ''), [settings.apiBaseUrl]);

  function parseEmployees(): EmployeeInput[] {
    const employees = JSON.parse(employeesJson) as EmployeeInput[];
    if (!Array.isArray(employees) || employees.length === 0) {
      throw new Error('Employees JSON must be a non-empty array.');
    }
    return employees;
  }

  function buildDraftWarnings(employees: EmployeeInput[]): string[] {
    const warnings: string[] = [];
    if (!settings.employerTin.trim()) {
      warnings.push('Missing employer TIN.');
    }
    if (!settings.employerNssfCode.trim()) {
      warnings.push('Missing employer NSSF code.');
    }
    const inactiveCount = employees.filter((employee) => employee.employmentStatus === 'inactive').length;
    if (inactiveCount > 0) {
      warnings.push(`Inactive employees included: ${inactiveCount}.`);
    }
    const zeroOrNegative = employees.filter((employee) => employee.baseSalaryMinor <= 0).length;
    if (zeroOrNegative > 0) {
      warnings.push(`Employees with zero/negative salary: ${zeroOrNegative}.`);
    }
    return warnings;
  }

  async function loadRuns() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/payroll-runs?tenantId=${encodeURIComponent(settings.tenantId)}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Load failed (${response.status}): ${text}`);
      }
      const data = (await response.json()) as RunsResponse;
      setRuns(data.runs ?? []);
      setOutbox(data.outbox ?? []);
      if (!selectedRunId && data.runs.length > 0) {
        setSelectedRunId(data.runs[0]?.payrollRunId ?? '');
      }
      setNotice({ type: 'ok', message: `Loaded ${data.runs.length} runs and ${data.outbox.length} outbox events.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unknown load failure.' });
    } finally {
      setBusy(false);
    }
  }

  async function createDraft() {
    setBusy(true);
    setNotice(null);

    try {
      const employees = parseEmployees();

      const payload = {
        tenantId: settings.tenantId,
        companyId: settings.companyId,
        periodId: settings.periodId,
        countryCode: settings.countryCode,
        currencyCode: settings.currencyCode,
        employerTin: settings.employerTin.trim(),
        employerNssfCode: settings.employerNssfCode.trim(),
        sourceWallet: sourceWallet.trim(),
        periodStart,
        periodEnd,
        employees
      };

      const response = await fetch(`${apiBase}/payroll-runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Create draft failed (${response.status}): ${text}`);
      }

      const draft = (await response.json()) as PayrollRun;
      setNotice({ type: 'ok', message: `Draft created: ${draft.payrollRunId}` });
      setDraftReady(false);
      await loadRuns();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unknown create failure.' });
    } finally {
      setBusy(false);
    }
  }

  async function finalizeRun(runId: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/payroll-runs/${runId}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Finalize failed (${response.status}): ${text}`);
      }

      setNotice({ type: 'ok', message: `Run finalized: ${runId}` });
      await loadRuns();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unknown finalize failure.' });
    } finally {
      setBusy(false);
    }
  }

  async function loadSummary(runId: string) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/payroll-runs/${runId}/summary`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Summary failed (${response.status}): ${text}`);
      }
      const data = (await response.json()) as PayrollRunSummary;
      setSummary(data);
      setSelectedRunId(runId);
      setNotice({ type: 'ok', message: `Loaded summary for run ${runId.slice(0, 8)}.` });
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unknown summary failure.' });
    } finally {
      setBusy(false);
    }
  }

  function exportUrl(runId: string, path: string): string {
    return `${apiBase}/payroll-runs/${runId}${path}`;
  }

  function patchSettings(partial: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function reviewDraft() {
    setNotice(null);
    try {
      const employees = parseEmployees();
      const warnings = buildDraftWarnings(employees);
      setReviewWarnings(warnings);
      setDraftReady(true);
      setNotice({
        type: warnings.length === 0 ? 'ok' : 'error',
        message:
          warnings.length === 0
            ? `Review complete: ${employees.length} employees ready for draft creation.`
            : `Review found ${warnings.length} warning(s). Resolve if needed, then create draft.`
      });
    } catch (error) {
      setDraftReady(false);
      setReviewWarnings([]);
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Unknown review failure.' });
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="card">
          <h2>Curra Ops</h2>
          <p>Thin operator frontend preview on live API.</p>
          <span className="badge">Backend stable, UI thin</span>
        </div>

        <div className="card grid">
          <h3>Workspace Settings</h3>
          <Field label="API Base URL">
            <input value={settings.apiBaseUrl} onChange={(e) => patchSettings({ apiBaseUrl: e.target.value })} />
          </Field>
          <Field label="Tenant ID">
            <input value={settings.tenantId} onChange={(e) => patchSettings({ tenantId: e.target.value })} />
          </Field>
          <Field label="Company ID">
            <input value={settings.companyId} onChange={(e) => patchSettings({ companyId: e.target.value })} />
          </Field>
          <Field label="Period ID (UUID)">
            <input value={settings.periodId} onChange={(e) => patchSettings({ periodId: e.target.value })} />
          </Field>
          <Field label="Country">
            <input value={settings.countryCode} onChange={(e) => patchSettings({ countryCode: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Payroll Currency">
            <input value={settings.currencyCode} onChange={(e) => patchSettings({ currencyCode: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Employer TIN">
            <input value={settings.employerTin} onChange={(e) => patchSettings({ employerTin: e.target.value })} />
          </Field>
          <Field label="Employer NSSF Code">
            <input value={settings.employerNssfCode} onChange={(e) => patchSettings({ employerNssfCode: e.target.value })} />
          </Field>
          <Field label="Default Source Wallet">
            <input
              value={settings.defaultSourceWallet}
              onChange={(e) => {
                const next = e.target.value.toUpperCase();
                patchSettings({ defaultSourceWallet: next });
                setSourceWallet(next);
              }}
            />
          </Field>
          <Field label="Preferred Provider (UI only)">
            <select
              value={settings.payoutProvider}
              onChange={(e) => patchSettings({ payoutProvider: e.target.value as 'manual' | 'eversend' })}
            >
              <option value="manual">manual</option>
              <option value="eversend">eversend</option>
            </select>
          </Field>
          <button className="secondary" onClick={loadRuns} disabled={busy}>
            Refresh Runs
          </button>
        </div>
      </aside>

      <main className="main">
        {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}

        <section className="card">
          <h3>Guided Payroll Run</h3>
          <p className="muted">Step 1: review inputs. Step 2: create draft. Step 3: finalize from runs table.</p>
          <div className="grid two">
            <Field label="Period Start">
              <input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="YYYY-MM-DD" />
            </Field>
            <Field label="Period End">
              <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="YYYY-MM-DD" />
            </Field>
          </div>
          <Field label="Source Wallet Override (any provider-supported currency code)">
            <input value={sourceWallet} onChange={(e) => setSourceWallet(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Employees JSON">
            <textarea value={employeesJson} onChange={(e) => setEmployeesJson(e.target.value)} />
          </Field>
          <div className="actions">
            <button className="secondary" onClick={reviewDraft} disabled={busy}>
              Review Inputs
            </button>
            <button onClick={createDraft} disabled={busy || !draftReady}>
              Create Draft (Step 2)
            </button>
            <button className="ghost" onClick={() => setEmployeesJson(sampleEmployeesJson)} disabled={busy}>
              Reset Sample
            </button>
          </div>
          {!draftReady ? <p className="muted" style={{ marginTop: 10 }}>Run review first to enable draft creation.</p> : null}
          {reviewWarnings.length > 0 ? (
            <div className="notice error" style={{ marginTop: 10 }}>
              {reviewWarnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h3>Payroll Runs</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Status</th>
                <th>Period</th>
                <th>Currency</th>
                <th>Source Wallet</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.payrollRunId}>
                  <td className="mono">{run.payrollRunId.slice(0, 8)}</td>
                  <td>{run.status}</td>
                  <td>
                    {run.periodStart} - {run.periodEnd}
                  </td>
                  <td>{run.currencyCode}</td>
                  <td>{run.sourceWallet ?? run.currencyCode}</td>
                  <td>{new Date(run.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="ghost" disabled={busy} onClick={() => void loadSummary(run.payrollRunId)}>
                      View
                    </button>{' '}
                    <button className="ghost" disabled={busy || run.status !== 'draft'} onClick={() => finalizeRun(run.payrollRunId)}>
                      Finalize
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Outbox Events</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Run</th>
                <th>Source Wallet</th>
                <th>Total</th>
                <th>Published</th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((event) => (
                <tr key={event.eventId}>
                  <td>{event.eventType}</td>
                  <td className="mono">{event.correlationId.slice(0, 8)}</td>
                  <td>{event.payload?.sourceWallet ?? '-'}</td>
                  <td>{event.payload?.totalAmountMinor ?? '-'}</td>
                  <td>{event.publishedAt ? new Date(event.publishedAt).toLocaleString() : 'pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <h3>Run Outputs</h3>
          {!summary ? <p>Select a run and click View.</p> : null}
          {summary ? (
            <>
              <div className="grid two">
                <div>
                  <strong>Run:</strong> <span className="mono">{summary.run.payrollRunId}</span>
                </div>
                <div>
                  <strong>Mode:</strong> {summary.mode}
                </div>
                <div>
                  <strong>Period:</strong> {summary.run.periodStart} - {summary.run.periodEnd}
                </div>
                <div>
                  <strong>Computed:</strong> {new Date(summary.computedAt).toLocaleString()}
                </div>
                <div>
                  <strong>Gross:</strong> {summary.grossTotalMinor}
                </div>
                <div>
                  <strong>Deductions:</strong> {summary.deductionsTotalMinor}
                </div>
                <div>
                  <strong>Net:</strong> {summary.netTotalMinor}
                </div>
                <div>
                  <strong>Source Wallet:</strong> {summary.sourceWallet}
                </div>
                <div>
                  <strong>Rule Set:</strong> {summary.adapterMetadata.ruleSetId}
                </div>
                <div>
                  <strong>Adapter Version:</strong> {summary.adapterMetadata.adapterVersion}
                </div>
                <div>
                  <strong>PAYE Total:</strong> {summary.payeTotalMinor}
                </div>
                <div>
                  <strong>NSSF Employee Total:</strong> {summary.employeeNssfTotalMinor}
                </div>
                <div>
                  <strong>NSSF Employer Total:</strong> {summary.employerNssfTotalMinor}
                </div>
              </div>
              {summary.validationWarnings.length > 0 ? (
                <div className="notice error" style={{ marginTop: 12 }}>
                  {summary.validationWarnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}

              <div className="actions" style={{ marginTop: 12 }}>
                <a href={exportUrl(summary.run.payrollRunId, '/exports/payroll-register.csv')} target="_blank" rel="noreferrer">
                  <button className="secondary">Payroll Register CSV</button>
                </a>
                <a href={exportUrl(summary.run.payrollRunId, '/exports/paye-remittance.csv')} target="_blank" rel="noreferrer">
                  <button className="secondary">PAYE Remittance CSV</button>
                </a>
                <a href={exportUrl(summary.run.payrollRunId, '/exports/nssf-remittance.csv')} target="_blank" rel="noreferrer">
                  <button className="secondary">NSSF Remittance CSV</button>
                </a>
                <a href={exportUrl(summary.run.payrollRunId, '/exports/statutory-summary.csv')} target="_blank" rel="noreferrer">
                  <button className="secondary">Combined Statutory CSV</button>
                </a>
                <a
                  href={exportUrl(summary.run.payrollRunId, '/exports/disbursement-instructions.csv')}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button className="secondary">Disbursement CSV</button>
                </a>
              </div>

              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Gross</th>
                    <th>PAYE</th>
                    <th>NSSF (Emp)</th>
                    <th>NSSF (Er)</th>
                    <th>Net</th>
                    <th>Payslip</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.employeeBreakdowns.map((line) => (
                    <tr key={line.employeeId}>
                      <td>{line.beneficiaryName}</td>
                      <td>{line.grossMinor}</td>
                      <td>{line.payeMinor}</td>
                      <td>{line.employeeNssfMinor}</td>
                      <td>{line.employerNssfMinor}</td>
                      <td>{line.netMinor}</td>
                      <td>
                        <a
                          href={exportUrl(summary.run.payrollRunId, `/payslips/${line.employeeId}?format=html`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function Field(props: { label: string; children: JSX.Element }) {
  return (
    <div>
      <label>{props.label}</label>
      {props.children}
    </div>
  );
}
