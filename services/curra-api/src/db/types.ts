export interface QueryResultRow {
  [key: string]: unknown;
}

export interface DbClient {
  query<T = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
