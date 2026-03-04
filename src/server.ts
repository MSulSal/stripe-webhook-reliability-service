import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db/database.js";
import { createLogger } from "./lib/logger.js";
import { WebhookEventRepository } from "./repositories/webhookEventRepository.js";
import { createDownstreamDispatcher } from "./services/downstreamDispatcher.js";
import { EventProcessor } from "./services/eventProcessor.js";
import { RetryWorker } from "./services/retryWorker.js";
import { StripeSignatureVerifier } from "./services/stripeSignatureVerifier.js";

const config = loadConfig();
const logger = createLogger(config);
const database = createDatabase(config.DATABASE_PATH);
const repository = new WebhookEventRepository(database);

const signatureVerifier = new StripeSignatureVerifier(config.STRIPE_WEBHOOK_SECRET, config.STRIPE_API_KEY);
const downstreamHandler = createDownstreamDispatcher(config, logger.child({ component: "downstream" }));
const processor = new EventProcessor({
  config,
  repository,
  downstreamHandler,
  logger: logger.child({ component: "processor" })
});
const retryWorker = new RetryWorker({
  config,
  repository,
  processor,
  logger: logger.child({ component: "retry-worker" })
});

const app = createApp({
  config,
  logger,
  repository,
  processor,
  signatureVerifier
});

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "server started");
});

retryWorker.start();

const shutdown = (): void => {
  logger.info("shutdown initiated");
  retryWorker.stop();
  server.close(() => {
    repository.close();
    logger.info("server shutdown complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
