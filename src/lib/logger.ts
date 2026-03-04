import pino from "pino";

import type { AppConfig } from "../config.js";

export const createLogger = (config: Pick<AppConfig, "LOG_LEVEL">): pino.Logger =>
  pino({
    name: "stripe-webhook-reliability-service",
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err
    }
  });
