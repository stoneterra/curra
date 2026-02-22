import type { DbClient } from '../../db/postgres-client.js';
import type { OutboxEventRecord, OutboxEventRepository } from '../types.js';

interface OutboxRow {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: OutboxEventRecord['payload'];
  correlation_id: string;
  idempotency_key: string;
}

export class PostgresOutboxEventRepository implements OutboxEventRepository {
  constructor(private readonly db: DbClient) {}

  async listPendingNetPayEvents(limit: number): Promise<OutboxEventRecord[]> {
    const result = await this.db.query<OutboxRow>(
      `
      SELECT id, tenant_id, event_type, payload, correlation_id, idempotency_key
      FROM event_outbox
      WHERE event_type = 'NetPayDisbursementRequested'
        AND published_at IS NULL
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows.map((row) => ({
      eventId: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      payload: row.payload,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key
    }));
  }

  async markPublished(eventId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE event_outbox
      SET published_at = now()
      WHERE id = $1
      `,
      [eventId]
    );
  }
}
