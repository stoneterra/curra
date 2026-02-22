import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  EversendApiResponse,
  EversendConfig,
  EversendTokenResponse,
  PayoutQuotationRequest,
  PayoutRequest
} from "./types.js";

export class EversendClient {
  private cachedToken: string | null = null;

  constructor(private readonly config: EversendConfig) {}

  async getToken(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    const url = `${this.config.baseUrl}/auth/token`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        clientid: this.config.clientId,
        clientsecret: this.config.clientSecret
      },
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Eversend token request failed with status ${response.status}: ${errorBody}`);
    }

    const payload = (await response.json()) as EversendApiResponse<EversendTokenResponse> | EversendTokenResponse;
    const token = "data" in payload ? payload.data.token : payload.token;

    if (!token) {
      throw new Error("Eversend token response did not include token.");
    }

    this.cachedToken = token;
    return token;
  }

  async createPayoutQuotation(request: PayoutQuotationRequest): Promise<unknown> {
    if (!Number.isInteger(request.amountMinor) || request.amountMinor <= 0) {
      throw new Error("Payout quotation amount must be a positive integer minor unit value.");
    }

    const sourceWallet = request.sourceWallet?.trim() || this.config.sourceWalletDefault?.trim();
    if (!sourceWallet) {
      throw new Error("sourceWallet is required for Eversend payout quotation.");
    }

    const payoutType = request.destinationNetwork === "mobile_money" ? "momo" : request.destinationNetwork;

    const token = await this.getToken();
    const response = await fetch(`${this.config.baseUrl}/payouts/quotation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sourceWallet,
        amount: request.amountMinor,
        type: payoutType,
        destinationCountry: request.destinationCountryCode,
        destinationCurrency: request.currency,
        amountType: "SOURCE"
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Eversend payout quotation failed with status ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  async createPayout(request: PayoutRequest): Promise<unknown> {
    if (!Number.isInteger(request.amountMinor) || request.amountMinor <= 0) {
      throw new Error("Payout amount must be a positive integer minor unit value.");
    }

    const sourceWallet = request.sourceWallet?.trim() || this.config.sourceWalletDefault?.trim();
    if (!sourceWallet) {
      throw new Error("sourceWallet is required for Eversend payout.");
    }

    const token = await this.getToken();

    const response = await fetch(`${this.config.baseUrl}/payouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sourceWallet,
        amount: request.amountMinor,
        destinationCurrency: request.currency,
        beneficiary: {
          name: request.beneficiaryName,
          account: request.beneficiaryAccount,
          countryCode: request.beneficiaryCountryCode
        },
        reference: request.reference,
        metadata: {
          idempotencyKey: request.idempotencyKey
        }
      }),
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Eversend payout failed with status ${response.status}: ${errorBody}`);
    }

    return response.json();
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!signatureHeader) {
      return false;
    }

    const computed = createHmac("sha512", this.config.webhookSecret).update(rawBody).digest("hex");

    const headerBuf = Buffer.from(signatureHeader, "utf8");
    const computedBuf = Buffer.from(computed, "utf8");

    if (headerBuf.length !== computedBuf.length) {
      return false;
    }

    return timingSafeEqual(headerBuf, computedBuf);
  }
}
