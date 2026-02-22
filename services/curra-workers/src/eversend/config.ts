import type { EversendConfig } from "./types.js";

export function readEversendConfig(): EversendConfig {
  return {
    baseUrl: process.env.EVERSEND_BASE_URL ?? "https://api.eversend.co/v1",
    clientId: process.env.EVERSEND_CLIENT_ID ?? "",
    clientSecret: process.env.EVERSEND_CLIENT_SECRET ?? "",
    webhookSecret: process.env.EVERSEND_WEBHOOK_SECRET ?? "",
    sourceWalletDefault: process.env.EVERSEND_SOURCE_WALLET ?? "",
    timeoutMs: Number(process.env.EVERSEND_TIMEOUT_MS ?? 15000)
  };
}

export function assertEversendConfig(config: EversendConfig): void {
  if (!config.clientId) {
    throw new Error("EVERSEND_CLIENT_ID is required.");
  }
  if (!config.clientSecret) {
    throw new Error("EVERSEND_CLIENT_SECRET is required.");
  }
  if (!config.webhookSecret) {
    throw new Error("EVERSEND_WEBHOOK_SECRET is required.");
  }
}
