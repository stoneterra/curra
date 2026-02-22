import type { PayoutGateway } from '../disbursement/types.js';

export class ManualPayoutGateway implements PayoutGateway {
  async createPayoutQuotation(request: {
    amountMinor: number;
    currency: string;
    sourceWallet?: string;
    destinationCountryCode: string;
    destinationNetwork: string;
  }): Promise<unknown> {
    return {
      provider: 'manual',
      action: 'quotation_recorded',
      request,
      requiresHumanApproval: true
    };
  }

  async createPayout(request: {
    amountMinor: number;
    currency: string;
    sourceWallet?: string;
    beneficiaryName: string;
    beneficiaryAccount: string;
    beneficiaryCountryCode: string;
    reference: string;
    idempotencyKey: string;
  }): Promise<unknown> {
    return {
      provider: 'manual',
      action: 'payout_recorded',
      request,
      status: 'pending_manual_execution'
    };
  }
}
