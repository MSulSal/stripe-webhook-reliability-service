import type pino from "pino";
import type Stripe from "stripe";

import type { AppConfig } from "../config.js";
import { DownstreamError } from "../lib/errors.js";
import { getErrorMessage } from "../lib/errorHandling.js";
import type { WebhookEventRepository } from "../repositories/webhookEventRepository.js";
import type { DownstreamHandler } from "./downstreamDispatcher.js";

export type ProcessingOutcome = "processed" | "duplicate" | "scheduled_retry" | "failed" | "skipped";

export interface EventProcessorDependencies {
  config: Pick<AppConfig, "MAX_PROCESSING_ATTEMPTS" | "RETRY_BASE_DELAY_MS" | "RETRY_MAX_DELAY_MS">;
  repository: WebhookEventRepository;
  downstreamHandler: DownstreamHandler;
  logger: pino.Logger;
  now?: () => number;
}

const transientErrorCodes = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);

export const calculateBackoffDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const exponent = Math.max(0, attempt - 1);
  const delay = baseDelayMs * 2 ** exponent;
  return Math.min(delay, maxDelayMs);
};

export const serializeError = (error: unknown): string => {
  if (error instanceof DownstreamError) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      transient: error.transient,
      details: error.details
    });
  }

  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message
    });
  }

  return JSON.stringify({
    message: String(error)
  });
};

export const isTransientError = (error: unknown): boolean => {
  if (error instanceof DownstreamError) {
    return error.transient;
  }

  if (error && typeof error === "object" && "transient" in error) {
    return (error as { transient?: unknown }).transient === true;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && transientErrorCodes.has(code)) {
      return true;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("timeout") || message.includes("temporarily") || message.includes("network");
  }

  return false;
};

export class EventProcessor {
  private readonly now: () => number;

  public constructor(private readonly dependencies: EventProcessorDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  public async processByEventId(eventId: string): Promise<ProcessingOutcome> {
    const existing = this.dependencies.repository.getByEventId(eventId);
    if (!existing) {
      this.dependencies.logger.warn({ eventId }, "event not found during processing");
      return "skipped";
    }

    if (existing.status === "processed") {
      return "duplicate";
    }

    const claimed = this.dependencies.repository.claimForProcessing(eventId, this.now());
    if (!claimed) {
      const latest = this.dependencies.repository.getByEventId(eventId);
      if (latest?.status === "processed") {
        return "duplicate";
      }

      return "skipped";
    }

    const claimedRecord = this.dependencies.repository.getByEventId(eventId);
    if (!claimedRecord) {
      this.dependencies.logger.error({ eventId }, "event disappeared after claim");
      return "failed";
    }

    let parsedEvent: Stripe.Event;
    try {
      parsedEvent = JSON.parse(claimedRecord.payload) as Stripe.Event;
    } catch (error) {
      const serializedError = serializeError(error);
      this.dependencies.repository.markFailed(eventId, serializedError, this.now());
      this.dependencies.logger.error(
        {
          eventId,
          error: getErrorMessage(error)
        },
        "failed to parse stored event payload"
      );
      return "failed";
    }

    try {
      await this.dependencies.downstreamHandler(parsedEvent);
      this.dependencies.repository.markProcessed(eventId, this.now());
      this.dependencies.logger.info(
        {
          eventId,
          attempts: claimedRecord.processAttempts
        },
        "event processed successfully"
      );
      return "processed";
    } catch (error) {
      const serializedError = serializeError(error);
      const isTransient = isTransientError(error);
      const attempts = claimedRecord.processAttempts;

      if (isTransient && attempts < this.dependencies.config.MAX_PROCESSING_ATTEMPTS) {
        const delayMs = calculateBackoffDelay(
          attempts,
          this.dependencies.config.RETRY_BASE_DELAY_MS,
          this.dependencies.config.RETRY_MAX_DELAY_MS
        );
        const nextRetryAt = this.now() + delayMs;
        this.dependencies.repository.markRetryPending(eventId, nextRetryAt, serializedError, this.now());
        this.dependencies.logger.warn(
          {
            eventId,
            attempts,
            nextRetryAt
          },
          "event processing failed with transient error, retry scheduled"
        );
        return "scheduled_retry";
      }

      this.dependencies.repository.markFailed(eventId, serializedError, this.now());
      this.dependencies.logger.error(
        {
          eventId,
          attempts,
          error: getErrorMessage(error)
        },
        "event processing failed permanently"
      );
      return "failed";
    }
  }
}
