import type pino from "pino";

import type { AppConfig } from "../config.js";
import { getErrorMessage } from "../lib/errorHandling.js";
import type { WebhookEventRepository } from "../repositories/webhookEventRepository.js";
import type { EventProcessor } from "./eventProcessor.js";

interface RetryWorkerDependencies {
  config: Pick<AppConfig, "RETRY_POLL_INTERVAL_MS" | "RETRY_BATCH_SIZE">;
  repository: WebhookEventRepository;
  processor: EventProcessor;
  logger: pino.Logger;
  now?: () => number;
}

export class RetryWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly now: () => number;

  public constructor(private readonly dependencies: RetryWorkerDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.dependencies.config.RETRY_POLL_INTERVAL_MS);

    this.timer.unref();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async tick(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const dueEventIds = this.dependencies.repository.fetchDueRetryEventIds(
        this.now(),
        this.dependencies.config.RETRY_BATCH_SIZE
      );

      for (const eventId of dueEventIds) {
        await this.dependencies.processor.processByEventId(eventId);
      }
    } catch (error) {
      this.dependencies.logger.error(
        {
          error: getErrorMessage(error)
        },
        "retry worker tick failed"
      );
    } finally {
      this.running = false;
    }
  }
}
