import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import type pino from "pino";

export const createRequestLoggerMiddleware =
  (logger: pino.Logger) => (request: Request, response: Response, next: NextFunction): void => {
    const requestIdHeader = request.header("x-request-id");
    const requestId = requestIdHeader && requestIdHeader.trim().length > 0 ? requestIdHeader : randomUUID();
    const startedAt = Date.now();

    request.requestId = requestId;
    request.log = logger.child({
      requestId,
      method: request.method,
      path: request.path
    });

    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      request.log.info(
        {
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        },
        "request completed"
      );
    });

    next();
  };
