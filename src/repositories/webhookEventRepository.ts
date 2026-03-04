import type Stripe from "stripe";

import type { DatabaseHandle } from "../db/database.js";

export type WebhookEventStatus = "received" | "processing" | "processed" | "retry_pending" | "failed";

interface StoredWebhookEventRow {
  event_id: string;
  event_type: string;
  payload: string;
  signature: string;
  stripe_created: number;
  livemode: number;
  status: WebhookEventStatus;
  process_attempts: number;
  next_retry_at: number | null;
  last_error: string | null;
  processed_at: number | null;
  first_seen_at: number;
  updated_at: number;
}

export interface StoredWebhookEvent {
  eventId: string;
  eventType: string;
  payload: string;
  signature: string;
  stripeCreated: number;
  livemode: boolean;
  status: WebhookEventStatus;
  processAttempts: number;
  nextRetryAt: number | null;
  lastError: string | null;
  processedAt: number | null;
  firstSeenAt: number;
  updatedAt: number;
}

export interface HealthSummary {
  total: number;
  byStatus: Record<WebhookEventStatus, number>;
}

const mapRow = (row: StoredWebhookEventRow): StoredWebhookEvent => ({
  eventId: row.event_id,
  eventType: row.event_type,
  payload: row.payload,
  signature: row.signature,
  stripeCreated: row.stripe_created,
  livemode: row.livemode === 1,
  status: row.status,
  processAttempts: row.process_attempts,
  nextRetryAt: row.next_retry_at,
  lastError: row.last_error,
  processedAt: row.processed_at,
  firstSeenAt: row.first_seen_at,
  updatedAt: row.updated_at
});

export class WebhookEventRepository {
  public constructor(private readonly database: DatabaseHandle) {}

  public insertIfMissing(args: {
    event: Stripe.Event;
    payload: string;
    signature: string;
    now?: number;
  }): { inserted: boolean; record: StoredWebhookEvent } {
    const now = args.now ?? Date.now();
    const runResult = this.database
      .prepare(
        `INSERT INTO webhook_events (
          event_id,
          event_type,
          payload,
          signature,
          stripe_created,
          livemode,
          status,
          process_attempts,
          next_retry_at,
          last_error,
          processed_at,
          first_seen_at,
          updated_at
        ) VALUES (
          @event_id,
          @event_type,
          @payload,
          @signature,
          @stripe_created,
          @livemode,
          'received',
          0,
          NULL,
          NULL,
          NULL,
          @first_seen_at,
          @updated_at
        )
        ON CONFLICT(event_id) DO NOTHING`
      )
      .run({
        event_id: args.event.id,
        event_type: args.event.type,
        payload: args.payload,
        signature: args.signature,
        stripe_created: args.event.created,
        livemode: args.event.livemode ? 1 : 0,
        first_seen_at: now,
        updated_at: now
      });

    const record = this.getByEventId(args.event.id);
    if (!record) {
      throw new Error(`Failed to load stored event after insert attempt for ${args.event.id}`);
    }

    return {
      inserted: runResult.changes === 1,
      record
    };
  }

  public getByEventId(eventId: string): StoredWebhookEvent | null {
    const row = this.database
      .prepare(
        `SELECT
          event_id,
          event_type,
          payload,
          signature,
          stripe_created,
          livemode,
          status,
          process_attempts,
          next_retry_at,
          last_error,
          processed_at,
          first_seen_at,
          updated_at
        FROM webhook_events
        WHERE event_id = ?`
      )
      .get(eventId) as StoredWebhookEventRow | undefined;

    return row ? mapRow(row) : null;
  }

  public claimForProcessing(eventId: string, now: number = Date.now()): boolean {
    const runResult = this.database
      .prepare(
        `UPDATE webhook_events
        SET
          status = 'processing',
          process_attempts = process_attempts + 1,
          next_retry_at = NULL,
          updated_at = @updated_at
        WHERE
          event_id = @event_id
          AND status IN ('received', 'retry_pending')`
      )
      .run({
        event_id: eventId,
        updated_at: now
      });

    return runResult.changes === 1;
  }

  public markProcessed(eventId: string, now: number = Date.now()): void {
    this.database
      .prepare(
        `UPDATE webhook_events
        SET
          status = 'processed',
          processed_at = @processed_at,
          last_error = NULL,
          next_retry_at = NULL,
          updated_at = @updated_at
        WHERE event_id = @event_id`
      )
      .run({
        event_id: eventId,
        processed_at: now,
        updated_at: now
      });
  }

  public markRetryPending(eventId: string, nextRetryAt: number, lastError: string, now: number = Date.now()): void {
    this.database
      .prepare(
        `UPDATE webhook_events
        SET
          status = 'retry_pending',
          next_retry_at = @next_retry_at,
          last_error = @last_error,
          updated_at = @updated_at
        WHERE event_id = @event_id`
      )
      .run({
        event_id: eventId,
        next_retry_at: nextRetryAt,
        last_error: lastError,
        updated_at: now
      });
  }

  public markFailed(eventId: string, lastError: string, now: number = Date.now()): void {
    this.database
      .prepare(
        `UPDATE webhook_events
        SET
          status = 'failed',
          next_retry_at = NULL,
          last_error = @last_error,
          updated_at = @updated_at
        WHERE event_id = @event_id`
      )
      .run({
        event_id: eventId,
        last_error: lastError,
        updated_at: now
      });
  }

  public fetchDueRetryEventIds(now: number = Date.now(), limit: number = 20): string[] {
    const rows = this.database
      .prepare(
        `SELECT event_id
        FROM webhook_events
        WHERE status = 'retry_pending' AND next_retry_at IS NOT NULL AND next_retry_at <= @now
        ORDER BY next_retry_at ASC
        LIMIT @limit`
      )
      .all({
        now,
        limit
      }) as Array<{ event_id: string }>;

    return rows.map((row) => row.event_id);
  }

  public enqueueFailedEventForRetry(eventId: string, now: number = Date.now()): boolean {
    const runResult = this.database
      .prepare(
        `UPDATE webhook_events
        SET
          status = 'retry_pending',
          next_retry_at = @next_retry_at,
          updated_at = @updated_at
        WHERE event_id = @event_id AND status = 'failed'`
      )
      .run({
        event_id: eventId,
        next_retry_at: now,
        updated_at: now
      });

    return runResult.changes === 1;
  }

  public getHealthSummary(): HealthSummary {
    const summary: HealthSummary = {
      total: 0,
      byStatus: {
        received: 0,
        processing: 0,
        processed: 0,
        retry_pending: 0,
        failed: 0
      }
    };

    const rows = this.database
      .prepare(
        `SELECT status, COUNT(1) as count
        FROM webhook_events
        GROUP BY status`
      )
      .all() as Array<{ status: WebhookEventStatus; count: number }>;

    for (const row of rows) {
      summary.byStatus[row.status] = row.count;
      summary.total += row.count;
    }

    return summary;
  }

  public close(): void {
    this.database.close();
  }
}
