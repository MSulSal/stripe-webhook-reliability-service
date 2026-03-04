import express, { type NextFunction, type Request, type Response } from "express";
import type pino from "pino";

import type { AppConfig } from "./config.js";
import { asyncRoute, getErrorMessage } from "./lib/errorHandling.js";
import { createRequestLoggerMiddleware } from "./lib/requestLogger.js";
import type { WebhookEventRepository } from "./repositories/webhookEventRepository.js";
import type { EventProcessor } from "./services/eventProcessor.js";
import type { StripeSignatureVerifier } from "./services/stripeSignatureVerifier.js";

export interface AppDependencies {
  config: AppConfig;
  logger: pino.Logger;
  repository: WebhookEventRepository;
  processor: EventProcessor;
  signatureVerifier: StripeSignatureVerifier;
}

const rejectIfMissingAdminToken = (
  request: Request,
  response: Response,
  next: NextFunction,
  adminToken?: string
): void => {
  if (!adminToken) {
    next();
    return;
  }

  const providedToken = request.header("x-admin-token");
  if (providedToken !== adminToken) {
    request.log.warn({ requestId: request.requestId }, "admin endpoint access denied");
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};

export const createApp = (dependencies: AppDependencies) => {
  const app = express();
  app.disable("x-powered-by");

  app.use(createRequestLoggerMiddleware(dependencies.logger));

  app.get(
    "/health",
    asyncRoute(async (_request: Request, response: Response): Promise<void> => {
      const summary = dependencies.repository.getHealthSummary();
      response.status(200).json({
        status: "ok",
        service: "stripe-webhook-reliability-service",
        now: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        events: summary
      });
    })
  );

  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    asyncRoute(async (request: Request, response: Response): Promise<void> => {
      const signatureHeader = request.header("stripe-signature");
      if (!signatureHeader) {
        request.log.warn({ requestId: request.requestId }, "missing stripe-signature header");
        response.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      if (!Buffer.isBuffer(request.body)) {
        request.log.warn({ requestId: request.requestId }, "invalid raw payload body");
        response.status(400).json({ error: "Invalid webhook payload format" });
        return;
      }

      const rawPayload = request.body;
      let stripeEvent;
      try {
        stripeEvent = dependencies.signatureVerifier.verifyAndConstructEvent(rawPayload, signatureHeader);
      } catch (error) {
        request.log.warn(
          {
            requestId: request.requestId,
            error: getErrorMessage(error)
          },
          "stripe signature verification failed"
        );
        response.status(400).json({ error: "Invalid Stripe signature" });
        return;
      }

      let inserted = false;
      try {
        const insertResult = dependencies.repository.insertIfMissing({
          event: stripeEvent,
          payload: rawPayload.toString("utf8"),
          signature: signatureHeader
        });
        inserted = insertResult.inserted;
      } catch (error) {
        request.log.error(
          {
            requestId: request.requestId,
            error: getErrorMessage(error)
          },
          "failed to persist webhook event"
        );
        response.status(500).json({ error: "Webhook persistence failure" });
        return;
      }

      if (!inserted) {
        request.log.info(
          {
            eventId: stripeEvent.id
          },
          "duplicate webhook event skipped"
        );
        response.status(200).json({
          received: true,
          duplicate: true
        });
        return;
      }

      const outcome = await dependencies.processor.processByEventId(stripeEvent.id);
      response.status(200).json({
        received: true,
        duplicate: false,
        outcome
      });
    })
  );

  app.use(express.json({ limit: "1mb" }));

  app.post(
    "/admin/events/:eventId/retry",
    (request: Request, response: Response, next: NextFunction) =>
      rejectIfMissingAdminToken(request, response, next, dependencies.config.ADMIN_TOKEN),
    asyncRoute(async (request: Request, response: Response): Promise<void> => {
      const { eventId } = request.params;
      const queued = dependencies.repository.enqueueFailedEventForRetry(eventId);
      if (!queued) {
        response.status(404).json({
          queued: false,
          message: "Event not found in failed state"
        });
        return;
      }

      const outcome = await dependencies.processor.processByEventId(eventId);
      response.status(202).json({
        queued: true,
        outcome
      });
    })
  );

  app.use((_request: Request, response: Response) => {
    response.status(404).json({ error: "Route not found" });
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    request.log.error(
      {
        error: getErrorMessage(error)
      },
      "unhandled application error"
    );
    response.status(500).json({
      error: "Internal server error"
    });
  });

  return app;
};
