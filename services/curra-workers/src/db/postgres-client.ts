import { Pool } from 'pg';

export interface DbClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

class PgClient implements DbClient {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[] };
  }
}

let singleton: PgClient | null = null;

export function getPostgresClient(): DbClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for worker processing.');
  }

  if (!singleton) {
    singleton = new PgClient(new Pool({ connectionString: process.env.DATABASE_URL }));
  }

  return singleton;
}
