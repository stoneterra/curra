import { EversendClient } from '../eversend/client.js';
import { assertEversendConfig, readEversendConfig } from '../eversend/config.js';
import type { PayoutGateway } from '../disbursement/types.js';
import { ManualPayoutGateway } from './manual-payout-gateway.js';

export interface PayoutProviderSelection {
  provider: string;
  gateway: PayoutGateway;
  providerMeta: Record<string, unknown>;
}

export function createPayoutGateway(strict: boolean): PayoutProviderSelection {
  const provider = (process.env.CURRA_PAYOUT_PROVIDER ?? 'eversend').toLowerCase();

  if (provider === 'eversend') {
    const config = readEversendConfig();
    assertEversendConfig(config);
    return {
      provider,
      gateway: new EversendClient(config),
      providerMeta: {
        baseUrl: config.baseUrl
      }
    };
  }

  if (provider === 'manual') {
    return {
      provider,
      gateway: new ManualPayoutGateway(),
      providerMeta: {
        mode: 'stub'
      }
    };
  }

  if (strict) {
    throw new Error(`Unsupported payout provider '${provider}'.`);
  }

  throw new Error(`Unsupported payout provider '${provider}'. Set CURRA_PAYOUT_PROVIDER=eversend|manual.`);
}
