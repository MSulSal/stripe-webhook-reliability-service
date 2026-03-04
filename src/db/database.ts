import fs from "node:fs";
import path from "node:path";

import BetterSqlite3 from "better-sqlite3";

export type DatabaseHandle = InstanceType<typeof BetterSqlite3>;

export const createDatabase = (databasePath: string): DatabaseHandle => {
  const resolvedPath = path.resolve(databasePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const database = new BetterSqlite3(resolvedPath);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.exec(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      signature TEXT NOT NULL,
      stripe_created INTEGER NOT NULL,
      livemode INTEGER NOT NULL CHECK (livemode IN (0, 1)),
      status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'processed', 'retry_pending', 'failed')),
      process_attempts INTEGER NOT NULL DEFAULT 0,
      next_retry_at INTEGER,
      last_error TEXT,
      processed_at INTEGER,
      first_seen_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_events_status_next_retry
      ON webhook_events (status, next_retry_at);

    CREATE INDEX IF NOT EXISTS idx_webhook_events_updated_at
      ON webhook_events (updated_at DESC);
  `);

  return database;
};
