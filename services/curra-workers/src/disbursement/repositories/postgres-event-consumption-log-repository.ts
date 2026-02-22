import type { DbClient } from '../../db/postgres-client.js';
import type { EventConsumptionLogRepository, OutboxEventRecord } from '../types.js';

interface StatusRow {
  status: string;
}

export class PostgresEventConsumptionLogRepository implements EventConsumptionLogRepository {
  constructor(private readonly db: DbClient) {}

  async acquire(consumerName: string, event: OutboxEventRecord): Promise<'acquired' | 'already_succeeded'> {
    const inserted = await this.db.query<StatusRow>(
      `
      INSERT INTO event_consumption_log (
        consumer_name, event_id, tenant_id, event_type, status
      ) VALUES (
        $1, $2, $3, $4, 'processing'
      )
      ON CONFLICT (consumer_name, event_id) DO NOTHING
      RETURNING status
      `,
      [consumerName, event.eventId, event.tenantId, event.eventType]
    );

    if (inserted.rows.length > 0) {
      return 'acquired';
    }

    const existing = await this.db.query<StatusRow>(
      `
      SELECT status
      FROM event_consumption_log
      WHERE consumer_name = $1
        AND event_id = $2
      `,
      [consumerName, event.eventId]
    );

    const status = existing.rows[0]?.status;
    if (status === 'succeeded') {
      return 'already_succeeded';
    }

    await this.db.query(
      `
      UPDATE event_consumption_log
      SET status = 'processing',
          attempt_count = attempt_count + 1,
          last_attempt_at = now(),
          updated_at = now()
      WHERE consumer_name = $1
        AND event_id = $2
      `,
      [consumerName, event.eventId]
    );

    return 'acquired';
  }

  async markSucceeded(consumerName: string, eventId: string): Promise<void> {
    await this.db.query(
      `
      UPDATE event_consumption_log
      SET status = 'succeeded',
          processed_at = now(),
          last_attempt_at = now(),
          updated_at = now(),
          last_error = NULL
      WHERE consumer_name = $1
        AND event_id = $2
      `,
      [consumerName, eventId]
    );
  }

  async markFailed(consumerName: string, eventId: string, errorMessage: string): Promise<void> {
    await this.db.query(
      `
      UPDATE event_consumption_log
      SET status = 'failed',
          last_error = $3,
          last_attempt_at = now(),
          updated_at = now()
      WHERE consumer_name = $1
        AND event_id = $2
      `,
      [consumerName, eventId, errorMessage]
    );
  }
}
