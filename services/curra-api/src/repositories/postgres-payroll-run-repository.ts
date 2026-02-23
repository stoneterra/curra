import type { DbClient } from "../db/types.js";
import type {
  PayrollRunFinalizationSnapshot,
  PayrollRunRecord,
  PayrollRunRepository
} from "./payroll-run-repository.js";

interface PayrollRunRow {
  id: string;
  tenant_id: string;
  company_id: string;
  period_id: string;
  country_code: string;
  status: "draft" | "finalized";
  created_at: string;
  metadata_json: {
    currencyCode: string;
    sourceWallet?: string;
    periodStart: string;
    periodEnd: string;
    employerTin?: string;
    employerNssfCode?: string;
    employees: PayrollRunRecord["employees"];
    finalizationSnapshot?: PayrollRunFinalizationSnapshot;
  };
}

export class PostgresPayrollRunRepository implements PayrollRunRepository {
  constructor(private readonly db: DbClient) {}

  async createDraft(input: Omit<PayrollRunRecord, "status" | "createdAt">): Promise<PayrollRunRecord> {
    const row = await this.db.query<PayrollRunRow>(
      `
      WITH next_run AS (
        SELECT COALESCE(MAX(run_number), 0) + 1 AS run_number
        FROM payroll_runs
        WHERE tenant_id = $2 AND company_id = $3 AND period_id = $4
      )
      INSERT INTO payroll_runs (
        id, tenant_id, company_id, period_id, run_number, status, country_code, adapter_name, adapter_version, rule_set_id, metadata_json
      )
      SELECT
        $1, $2, $3, $4, next_run.run_number, 'draft', $5, 'country-adapter', 'pending', 'pending', $6::jsonb
      FROM next_run
      RETURNING id, tenant_id, company_id, period_id, country_code, status, created_at, metadata_json
      `,
      [
        input.payrollRunId,
        input.tenantId,
        input.companyId,
        input.periodId,
        input.countryCode,
        JSON.stringify({
          currencyCode: input.currencyCode,
          sourceWallet: input.sourceWallet,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          employerTin: input.employerTin,
          employerNssfCode: input.employerNssfCode,
          employees: input.employees
        })
      ]
    );

    const created = row.rows[0];
    if (!created) {
      throw new Error("Failed to create payroll draft.");
    }

    return {
      payrollRunId: created.id,
      tenantId: created.tenant_id,
      companyId: created.company_id,
      periodId: created.period_id,
      countryCode: created.country_code,
      currencyCode: input.currencyCode,
      ...(input.sourceWallet ? { sourceWallet: input.sourceWallet } : {}),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      ...(input.employerTin ? { employerTin: input.employerTin } : {}),
      ...(input.employerNssfCode ? { employerNssfCode: input.employerNssfCode } : {}),
      employees: input.employees,
      status: created.status,
      createdAt: created.created_at
    };
  }

  async getById(payrollRunId: string): Promise<PayrollRunRecord | null> {
    const result = await this.db.query<PayrollRunRow>(
      `
      SELECT id, tenant_id, company_id, period_id, country_code, status, created_at, metadata_json
      FROM payroll_runs
      WHERE id = $1
      `,
      [payrollRunId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      payrollRunId: row.id,
      tenantId: row.tenant_id,
      companyId: row.company_id,
      periodId: row.period_id,
      countryCode: row.country_code,
      currencyCode: row.metadata_json.currencyCode,
      ...(row.metadata_json.sourceWallet ? { sourceWallet: row.metadata_json.sourceWallet } : {}),
      periodStart: row.metadata_json.periodStart,
      periodEnd: row.metadata_json.periodEnd,
      ...(row.metadata_json.employerTin ? { employerTin: row.metadata_json.employerTin } : {}),
      ...(row.metadata_json.employerNssfCode ? { employerNssfCode: row.metadata_json.employerNssfCode } : {}),
      employees: row.metadata_json.employees,
      status: row.status,
      ...(row.metadata_json.finalizationSnapshot ? { finalizationSnapshot: row.metadata_json.finalizationSnapshot } : {}),
      createdAt: row.created_at
    };
  }

  async markFinalized(payrollRunId: string, snapshot: PayrollRunFinalizationSnapshot): Promise<void> {
    await this.db.query(
      `
      UPDATE payroll_runs
      SET
        status = 'finalized',
        adapter_version = $2,
        rule_set_id = $3,
        gross_total_minor = $4,
        net_total_minor = $5,
        statutory_total_minor = $6,
        metadata_json = jsonb_set(COALESCE(metadata_json, '{}'::jsonb), '{finalizationSnapshot}', $7::jsonb, true),
        updated_at = now()
      WHERE id = $1
      `,
      [
        payrollRunId,
        snapshot.adapterMetadata.adapterVersion,
        snapshot.adapterMetadata.ruleSetId,
        snapshot.grossTotalMinor,
        snapshot.netTotalMinor,
        snapshot.deductionsTotalMinor,
        JSON.stringify(snapshot)
      ]
    );
  }

  async listByTenant(tenantId: string): Promise<PayrollRunRecord[]> {
    const result = await this.db.query<PayrollRunRow>(
      `
      SELECT id, tenant_id, company_id, period_id, country_code, status, created_at, metadata_json
      FROM payroll_runs
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      payrollRunId: row.id,
      tenantId: row.tenant_id,
      companyId: row.company_id,
      periodId: row.period_id,
      countryCode: row.country_code,
      currencyCode: row.metadata_json.currencyCode,
      ...(row.metadata_json.sourceWallet ? { sourceWallet: row.metadata_json.sourceWallet } : {}),
      periodStart: row.metadata_json.periodStart,
      periodEnd: row.metadata_json.periodEnd,
      ...(row.metadata_json.employerTin ? { employerTin: row.metadata_json.employerTin } : {}),
      ...(row.metadata_json.employerNssfCode ? { employerNssfCode: row.metadata_json.employerNssfCode } : {}),
      employees: row.metadata_json.employees,
      status: row.status,
      ...(row.metadata_json.finalizationSnapshot ? { finalizationSnapshot: row.metadata_json.finalizationSnapshot } : {}),
      createdAt: row.created_at
    }));
  }
}
