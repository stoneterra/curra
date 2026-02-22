export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  occurredAt: string;
  producer: string;
  tenantId: string;
  correlationId: string;
  idempotencyKey: string;
  payload: TPayload;
}

export interface PayrollRunFinalizedPayload {
  payrollRunId: string;
  companyId: string;
  periodId: string;
  countryCode: string;
  currency: string;
  grossTotalMinor: number;
  netTotalMinor: number;
  statutoryTotalMinor: number;
  employeeCount: number;
  adapterVersion: string;
  ruleSetId: string;
  finalizedAt: string;
}

export type PayrollRunFinalizedEvent = EventEnvelope<PayrollRunFinalizedPayload>;
