export interface NetPayDisbursementLineItem {
  employeeId: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryCountryCode: string;
  destinationCountryCode: string;
  destinationNetwork: string;
  amountMinor: number;
  currencyCode: string;
  reference: string;
  idempotencyKey: string;
}

export interface NetPayDisbursementRequestedPayload {
  payrollRunId: string;
  currencyCode: string;
  sourceWallet?: string;
  totalAmountMinor: number;
  lineItems: NetPayDisbursementLineItem[];
}

export interface OutboxEventRecord {
  eventId: string;
  tenantId: string;
  eventType: string;
  payload: NetPayDisbursementRequestedPayload;
  correlationId: string;
  idempotencyKey: string;
}

export interface OutboxEventRepository {
  listPendingNetPayEvents(limit: number): Promise<OutboxEventRecord[]>;
  markPublished(eventId: string): Promise<void>;
}

export interface EventConsumptionLogRepository {
  acquire(consumerName: string, event: OutboxEventRecord): Promise<'acquired' | 'already_succeeded'>;
  markSucceeded(consumerName: string, eventId: string): Promise<void>;
  markFailed(consumerName: string, eventId: string, errorMessage: string): Promise<void>;
}

export interface PayoutGateway {
  createPayoutQuotation(request: {
    amountMinor: number;
    currency: string;
    sourceWallet?: string;
    destinationCountryCode: string;
    destinationNetwork: string;
  }): Promise<unknown>;
  createPayout(request: {
    amountMinor: number;
    currency: string;
    sourceWallet?: string;
    beneficiaryName: string;
    beneficiaryAccount: string;
    beneficiaryCountryCode: string;
    reference: string;
    idempotencyKey: string;
  }): Promise<unknown>;
}
