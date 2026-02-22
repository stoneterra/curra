import type { OutboxEvent } from "../modules/outbox-service.js";

export interface OutboxRepository {
  enqueue(event: Omit<OutboxEvent, "createdAt" | "publishedAt">): Promise<OutboxEvent>;
  listByTenant(tenantId: string): Promise<OutboxEvent[]>;
}

export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events: OutboxEvent[] = [];
  private readonly byTenantAndKey = new Map<string, OutboxEvent>();

  async enqueue(event: Omit<OutboxEvent, "createdAt" | "publishedAt">): Promise<OutboxEvent> {
    const key = `${event.tenantId}:${event.idempotencyKey}`;
    const existing = this.byTenantAndKey.get(key);
    if (existing) {
      return existing;
    }

    const created: OutboxEvent = {
      ...event,
      createdAt: new Date().toISOString()
    };
    this.events.push(created);
    this.byTenantAndKey.set(key, created);
    return created;
  }

  async listByTenant(tenantId: string): Promise<OutboxEvent[]> {
    return this.events.filter((event) => event.tenantId === tenantId);
  }
}
