import { getPostgresClient } from "./db/postgres-client.js";
import { NetPayDisbursementWorker } from "./disbursement/worker.js";
import { PostgresOutboxEventRepository } from "./disbursement/repositories/postgres-outbox-event-repository.js";
import { PostgresEventConsumptionLogRepository } from "./disbursement/repositories/postgres-event-consumption-log-repository.js";
import { createPayoutGateway } from "./providers/payout-gateway-factory.js";

async function bootstrap() {
  const strict = (process.env.CURRA_REQUIRE_EXTERNALS ?? "false").toLowerCase() === "true";
  const mode = (process.env.CURRA_WORKER_MODE ?? "polling").toLowerCase();

  try {
    const providerSelection = createPayoutGateway(strict);
    const db = getPostgresClient();
    const outboxRepository = new PostgresOutboxEventRepository(db);
    const consumptionLogRepository = new PostgresEventConsumptionLogRepository(db);
    const worker = new NetPayDisbursementWorker(
      outboxRepository,
      consumptionLogRepository,
      providerSelection.gateway,
      process.env.CURRA_DISBURSEMENT_CONSUMER_NAME ?? "netpay-disbursement-worker"
    );

    const pollIntervalMs = Number(process.env.CURRA_DISBURSEMENT_POLL_INTERVAL_MS ?? 5000);
    const batchSize = Number(process.env.CURRA_DISBURSEMENT_BATCH_SIZE ?? 20);
    let inFlight = false;

    const tick = async (): Promise<void> => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        const result = await worker.processBatch(batchSize);
        if (result.processed > 0 || result.failed > 0) {
          console.log(
            JSON.stringify({
              service: "curra-workers",
              worker: "netpay-disbursement",
              result
            })
          );
        }
      } finally {
        inFlight = false;
      }
    };

    if (mode === "oneshot") {
      await tick();
      console.log(
        JSON.stringify({
          service: "curra-workers",
          status: "completed_oneshot"
        })
      );
      return worker;
    }

    void tick();
    setInterval(() => {
      void tick();
    }, pollIntervalMs);

    console.log(
      JSON.stringify({
        service: "curra-workers",
        status: "ready",
        mode,
        payoutProvider: {
          provider: providerSelection.provider,
          ...providerSelection.providerMeta
        },
        disbursementWorker: {
          enabled: true,
          consumerName: process.env.CURRA_DISBURSEMENT_CONSUMER_NAME ?? "netpay-disbursement-worker",
          pollIntervalMs,
          batchSize
        }
      })
    );

    return worker;
  } catch (error) {
    if (strict) {
      throw error;
    }

    console.log(
      JSON.stringify({
        service: "curra-workers",
        status: "ready_with_warnings",
        warning:
          error instanceof Error ? error.message : "Eversend configuration missing; running without external connector."
      })
    );
    return null;
  }
}

void bootstrap();
