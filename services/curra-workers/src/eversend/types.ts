export interface EversendConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  sourceWalletDefault?: string;
  timeoutMs: number;
}

export interface EversendTokenResponse {
  token: string;
  expiresAt?: string;
}

export interface PayoutQuotationRequest {
  amountMinor: number;
  currency: string;
  sourceWallet?: string;
  destinationCountryCode: string;
  destinationNetwork: string;
}

export interface PayoutRequest {
  amountMinor: number;
  currency: string;
  sourceWallet?: string;
  beneficiaryName: string;
  beneficiaryAccount: string;
  beneficiaryCountryCode: string;
  reference: string;
  idempotencyKey: string;
}

export interface EversendApiResponse<T> {
  data: T;
  status: string;
}
