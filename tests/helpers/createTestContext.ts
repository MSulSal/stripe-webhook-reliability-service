import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type Stripe from "stripe";

import { createApp } from "../../src/app.js";
import type { AppConfig } from "../../src/config.js";
import { createDatabase, type DatabaseHandle } from "../../src/db/database.js";
import { createLogger } from "../../src/lib/logger.js";
import { WebhookEventRepository } from "../../src/repositories/webhookEventRepository.js";
import type { DownstreamHandler } from "../../src/services/downstreamDispatcher.js";
import { EventProcessor } from "../../src/services/eventProcessor.js";
import { StripeSignatureVerifier } from "../../src/services/stripeSignatureVerifier.js";

export interface TestContext {
  app: ReturnType<typeof createApp>;
  config: AppConfig;
  database: DatabaseHandle;
  repository: WebhookEventRepository;
  signatureVerifier: StripeSignatureVerifier;
  downstreamCalls: string[];
  cleanup: () => void;
}

export const createTestConfig = (databasePath: string): AppConfig => ({
  NODE_ENV: "test",
  PORT: 0,
  LOG_LEVEL: "silent",
  STRIPE_API_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test_secret",
  DATABASE_PATH: databasePath,
  MAX_PROCESSING_ATTEMPTS: 4,
  RETRY_BASE_DELAY_MS: 50,
  RETRY_MAX_DELAY_MS: 2000,
  RETRY_POLL_INTERVAL_MS: 50,
  RETRY_BATCH_SIZE: 10,
  DOWNSTREAM_MODE: "log",
  DOWNSTREAM_TIMEOUT_MS: 2000,
  ADMIN_TOKEN: "test-admin-token"
});

export const createTestContext = (overrideDownstream?: DownstreamHandler): TestContext => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stripe-webhook-reliability-"));
  const databasePath = path.join(tempDir, "webhooks-test.db");
  const config = createTestConfig(databasePath);

  const database = createDatabase(databasePath);
  const repository = new WebhookEventRepository(database);
  const logger = createLogger(config);
  const signatureVerifier = new StripeSignatureVerifier(config.STRIPE_WEBHOOK_SECRET, config.STRIPE_API_KEY);

  const downstreamCalls: string[] = [];
  const downstreamHandler: DownstreamHandler =
    overrideDownstream ??
    (async (event: Stripe.Event): Promise<void> => {
      downstreamCalls.push(event.id);
    });

  const processor = new EventProcessor({
    config,
    repository,
    downstreamHandler,
    logger
  });

  const app = createApp({
    config,
    logger,
    repository,
    processor,
    signatureVerifier
  });

  return {
    app,
    config,
    database,
    repository,
    signatureVerifier,
    downstreamCalls,
    cleanup: () => {
      repository.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };
};
