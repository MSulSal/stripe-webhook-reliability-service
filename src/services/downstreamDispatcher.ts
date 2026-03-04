import type pino from "pino";
import type Stripe from "stripe";

import type { AppConfig } from "../config.js";
import { DownstreamError } from "../lib/errors.js";
import { getErrorMessage } from "../lib/errorHandling.js";

export type DownstreamHandler = (event: Stripe.Event) => Promise<void>;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

export const createDownstreamDispatcher = (
  config: Pick<AppConfig, "DOWNSTREAM_MODE" | "DOWNSTREAM_URL" | "DOWNSTREAM_TIMEOUT_MS">,
  logger: pino.Logger
): DownstreamHandler => {
  if (config.DOWNSTREAM_MODE === "log") {
    return async (event: Stripe.Event): Promise<void> => {
      logger.info(
        {
          eventId: event.id,
          eventType: event.type
        },
        "processed event in local log mode"
      );
    };
  }

  const downstreamUrl = config.DOWNSTREAM_URL;
  if (!downstreamUrl) {
    throw new Error("DOWNSTREAM_URL is required in http mode");
  }

  return async (event: Stripe.Event): Promise<void> => {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), config.DOWNSTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(downstreamUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": event.id,
          "x-stripe-event-id": event.id
        },
        body: JSON.stringify(event),
        signal: abortController.signal
      });

      if (response.status >= 500) {
        throw new DownstreamError(`Downstream server error (${response.status})`, true, {
          statusCode: response.status
        });
      }

      if (response.status >= 400) {
        throw new DownstreamError(`Downstream rejected event (${response.status})`, false, {
          statusCode: response.status
        });
      }
    } catch (error) {
      if (error instanceof DownstreamError) {
        throw error;
      }

      if (isAbortError(error)) {
        throw new DownstreamError("Downstream request timed out", true);
      }

      throw new DownstreamError("Downstream request failed", true, {
        cause: getErrorMessage(error)
      });
    } finally {
      clearTimeout(timeout);
    }
  };
};
