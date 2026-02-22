import { Pool } from "pg";
import type { DbClient } from "./types.js";

class PgDbClient implements DbClient {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[] };
  }
}

let singleton: PgDbClient | null = null;

export function getPostgresClient(): DbClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Postgres repository mode.");
  }

  if (!singleton) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    singleton = new PgDbClient(pool);
  }

  return singleton;
}
