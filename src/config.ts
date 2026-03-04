import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const downstreamModeSchema = z.enum(["log", "http"]);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: logLevelSchema.default("info"),
  STRIPE_API_KEY: z.string().min(1, "STRIPE_API_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  DATABASE_PATH: z.string().min(1).default("./data/webhooks.db"),
  MAX_PROCESSING_ATTEMPTS: z.coerce.number().int().min(1).max(25).default(6),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().min(100).max(120_000).default(2000),
  RETRY_MAX_DELAY_MS: z.coerce.number().int().min(500).max(3_600_000).default(60_000),
  RETRY_POLL_INTERVAL_MS: z.coerce.number().int().min(250).max(120_000).default(2000),
  RETRY_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(20),
  DOWNSTREAM_MODE: downstreamModeSchema.default("log"),
  DOWNSTREAM_URL: z.string().optional(),
  DOWNSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5000),
  ADMIN_TOKEN: z.string().optional()
});

export interface AppConfig {
  NODE_ENV: z.infer<typeof nodeEnvSchema>;
  PORT: number;
  LOG_LEVEL: z.infer<typeof logLevelSchema>;
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  DATABASE_PATH: string;
  MAX_PROCESSING_ATTEMPTS: number;
  RETRY_BASE_DELAY_MS: number;
  RETRY_MAX_DELAY_MS: number;
  RETRY_POLL_INTERVAL_MS: number;
  RETRY_BATCH_SIZE: number;
  DOWNSTREAM_MODE: z.infer<typeof downstreamModeSchema>;
  DOWNSTREAM_URL?: string;
  DOWNSTREAM_TIMEOUT_MS: number;
  ADMIN_TOKEN?: string;
}

export const loadConfig = (source: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.parse(source);
  const trimmedDownstreamUrl = parsed.DOWNSTREAM_URL?.trim();

  if (parsed.DOWNSTREAM_MODE === "http" && !trimmedDownstreamUrl) {
    throw new Error("DOWNSTREAM_URL is required when DOWNSTREAM_MODE=http");
  }

  if (trimmedDownstreamUrl) {
    void new URL(trimmedDownstreamUrl);
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    LOG_LEVEL: parsed.LOG_LEVEL,
    STRIPE_API_KEY: parsed.STRIPE_API_KEY,
    STRIPE_WEBHOOK_SECRET: parsed.STRIPE_WEBHOOK_SECRET,
    DATABASE_PATH: path.resolve(parsed.DATABASE_PATH),
    MAX_PROCESSING_ATTEMPTS: parsed.MAX_PROCESSING_ATTEMPTS,
    RETRY_BASE_DELAY_MS: parsed.RETRY_BASE_DELAY_MS,
    RETRY_MAX_DELAY_MS: parsed.RETRY_MAX_DELAY_MS,
    RETRY_POLL_INTERVAL_MS: parsed.RETRY_POLL_INTERVAL_MS,
    RETRY_BATCH_SIZE: parsed.RETRY_BATCH_SIZE,
    DOWNSTREAM_MODE: parsed.DOWNSTREAM_MODE,
    DOWNSTREAM_URL: trimmedDownstreamUrl,
    DOWNSTREAM_TIMEOUT_MS: parsed.DOWNSTREAM_TIMEOUT_MS,
    ADMIN_TOKEN: parsed.ADMIN_TOKEN?.trim() || undefined
  };
};
