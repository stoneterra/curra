import type { DbClient } from "../db/types.js";
import type { OutboxEvent } from "../modules/outbox-service.js";
import type { OutboxRepository } from "./outbox-repository.js";

interface OutboxRow {
  id: string;
  tenant_id: string;
  event_type: string;
  event_version: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  correlation_id: string;
  created_at: string;
  published_at: string | null;
}

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: DbClient) {}

  async enqueue(event: Omit<OutboxEvent, "createdAt" | "publishedAt">): Promise<OutboxEvent> {
    const result = await this.db.query<OutboxRow>(
      `
      INSERT INTO event_outbox (
        id, tenant_id, event_type, event_version, payload, idempotency_key, correlation_id
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7
      )
      ON CONFLICT (tenant_id, idempotency_key)
      DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING id, tenant_id, event_type, event_version, payload, idempotency_key, correlation_id, created_at, published_at
      `,
      [
        event.eventId,
        event.tenantId,
        event.eventType,
        event.eventVersion,
        JSON.stringify(event.payload),
        event.idempotencyKey,
        event.correlationId
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to enqueue outbox event.");
    }

    return {
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      tenantId: row.tenant_id,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key,
      payload: row.payload,
      createdAt: row.created_at,
      publishedAt: row.published_at
    };
  }

  async listByTenant(tenantId: string): Promise<OutboxEvent[]> {
    const result = await this.db.query<OutboxRow>(
      `
      SELECT id, tenant_id, event_type, event_version, payload, idempotency_key, correlation_id, created_at, published_at
      FROM event_outbox
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 200
      `,
      [tenantId]
    );

    return result.rows.map((row) => ({
      eventId: row.id,
      eventType: row.event_type,
      eventVersion: row.event_version,
      tenantId: row.tenant_id,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key,
      payload: row.payload,
      createdAt: row.created_at,
      publishedAt: row.published_at
    }));
  }
}
