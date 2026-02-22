import type {
  PayoutGateway,
  EventConsumptionLogRepository,
  OutboxEventRecord,
  OutboxEventRepository
} from './types.js';

export class NetPayDisbursementWorker {
  constructor(
    private readonly outboxRepository: OutboxEventRepository,
    private readonly consumptionLogRepository: EventConsumptionLogRepository,
    private readonly payoutGateway: PayoutGateway,
    private readonly consumerName: string
  ) {}

  async processBatch(limit: number): Promise<{ processed: number; skipped: number; failed: number }> {
    const events = await this.outboxRepository.listPendingNetPayEvents(limit);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const event of events) {
      const outcome = await this.processEvent(event);
      if (outcome === 'processed') {
        processed += 1;
      } else if (outcome === 'skipped') {
        skipped += 1;
      } else {
        failed += 1;
      }
    }

    return { processed, skipped, failed };
  }

  private async processEvent(event: OutboxEventRecord): Promise<'processed' | 'skipped' | 'failed'> {
    const acquisition = await this.consumptionLogRepository.acquire(this.consumerName, event);

    if (acquisition === 'already_succeeded') {
      await this.outboxRepository.markPublished(event.eventId);
      return 'skipped';
    }

    try {
      const selectedSourceWallet = event.payload.sourceWallet?.trim() || event.payload.currencyCode;

      for (const lineItem of event.payload.lineItems) {
        if (!lineItem.beneficiaryAccount) {
          throw new Error(`Missing beneficiary account for employee ${lineItem.employeeId}.`);
        }

        await this.payoutGateway.createPayoutQuotation({
          amountMinor: lineItem.amountMinor,
          currency: lineItem.currencyCode,
          sourceWallet: selectedSourceWallet,
          destinationCountryCode: lineItem.destinationCountryCode,
          destinationNetwork: lineItem.destinationNetwork
        });

        await this.payoutGateway.createPayout({
          amountMinor: lineItem.amountMinor,
          currency: lineItem.currencyCode,
          sourceWallet: selectedSourceWallet,
          beneficiaryName: lineItem.beneficiaryName,
          beneficiaryAccount: lineItem.beneficiaryAccount,
          beneficiaryCountryCode: lineItem.beneficiaryCountryCode,
          reference: lineItem.reference,
          idempotencyKey: lineItem.idempotencyKey
        });
      }

      await this.consumptionLogRepository.markSucceeded(this.consumerName, event.eventId);
      await this.outboxRepository.markPublished(event.eventId);
      return 'processed';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.consumptionLogRepository.markFailed(this.consumerName, event.eventId, message);
      return 'failed';
    }
  }
}
