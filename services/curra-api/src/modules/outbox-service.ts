import type { OutboxRepository } from "../repositories/outbox-repository.js";

export interface OutboxEvent {
  eventId: string;
  eventType: string;
  eventVersion: string;
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  publishedAt?: string | null;
}

export class OutboxService {
  constructor(private readonly repository: OutboxRepository) {}

  enqueue(event: Omit<OutboxEvent, "createdAt" | "publishedAt">): Promise<OutboxEvent> {
    return this.repository.enqueue(event);
  }

  listByTenant(tenantId: string): Promise<OutboxEvent[]> {
    return this.repository.listByTenant(tenantId);
  }
}
