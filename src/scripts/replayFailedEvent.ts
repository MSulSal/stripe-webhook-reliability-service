import { loadConfig } from "../config.js";
import { createDatabase } from "../db/database.js";
import { createLogger } from "../lib/logger.js";
import { WebhookEventRepository } from "../repositories/webhookEventRepository.js";
import { createDownstreamDispatcher } from "../services/downstreamDispatcher.js";
import { EventProcessor } from "../services/eventProcessor.js";

const run = async (): Promise<void> => {
  const eventId = process.argv[2];
  if (!eventId) {
    console.error("Usage: npm run replay -- <stripe_event_id>");
    process.exit(1);
  }

  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabase(config.DATABASE_PATH);
  const repository = new WebhookEventRepository(database);

  try {
    const queued = repository.enqueueFailedEventForRetry(eventId);
    if (!queued) {
      console.error(`Event ${eventId} is not in failed state or does not exist.`);
      process.exitCode = 1;
      return;
    }

    const downstreamHandler = createDownstreamDispatcher(config, logger.child({ component: "downstream" }));
    const processor = new EventProcessor({
      config,
      repository,
      downstreamHandler,
      logger: logger.child({ component: "processor" })
    });
    const outcome = await processor.processByEventId(eventId);
    logger.info({ eventId, outcome }, "manual replay completed");
  } finally {
    repository.close();
  }
};

void run();
