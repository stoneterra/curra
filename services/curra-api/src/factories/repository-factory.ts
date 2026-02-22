import { getPostgresClient } from "../db/postgres-client.js";
import { InMemoryOutboxRepository, type OutboxRepository } from "../repositories/outbox-repository.js";
import {
  InMemoryPayrollRunRepository,
  type PayrollRunRepository
} from "../repositories/payroll-run-repository.js";
import { PostgresOutboxRepository } from "../repositories/postgres-outbox-repository.js";
import { PostgresPayrollRunRepository } from "../repositories/postgres-payroll-run-repository.js";

export interface Repositories {
  payrollRuns: PayrollRunRepository;
  outbox: OutboxRepository;
  mode: "memory" | "postgres";
}

export function createRepositories(): Repositories {
  const mode = (process.env.CURRA_PERSISTENCE_MODE ?? "memory").toLowerCase();

  if (mode === "postgres") {
    const db = getPostgresClient();
    return {
      payrollRuns: new PostgresPayrollRunRepository(db),
      outbox: new PostgresOutboxRepository(db),
      mode: "postgres"
    };
  }

  return {
    payrollRuns: new InMemoryPayrollRunRepository(),
    outbox: new InMemoryOutboxRepository(),
    mode: "memory"
  };
}
