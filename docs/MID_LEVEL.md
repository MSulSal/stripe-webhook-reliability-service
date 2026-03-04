# Mid-Level Implementation

## Module map

- `src/server.ts`: composition root and process lifecycle.
- `src/app.ts`: HTTP routes and request-level control flow.
- `src/config.ts`: environment validation and defaults.
- `src/db/database.ts`: SQLite initialization and schema.
- `src/repositories/webhookEventRepository.ts`: persistence API.
- `src/services/stripeSignatureVerifier.ts`: Stripe signature verification.
- `src/services/eventProcessor.ts`: event state machine + retry decisions.
- `src/services/retryWorker.ts`: scheduled retry execution loop.
- `src/services/downstreamDispatcher.ts`: downstream dispatch behavior.

## Webhook request path

1. Receive raw JSON payload on `/webhooks/stripe`.
2. Verify `stripe-signature`.
3. Parse Stripe event.
4. Insert event row if it is new.
5. If duplicate, return `200` without downstream work.
6. If new, process immediately.
7. On transient error, schedule retry and return `200`.

## Data model

The `webhook_events` table tracks:

- event identity (`event_id`, `event_type`)
- original payload (`payload`, `signature`)
- Stripe metadata (`stripe_created`, `livemode`)
- lifecycle state (`status`)
- retry metadata (`process_attempts`, `next_retry_at`, `last_error`)
- timing (`first_seen_at`, `updated_at`, `processed_at`)

## Retry algorithm

- Backoff is exponential and capped:
`delay = min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2^(attempt-1))`
- A retry is only scheduled while:
`process_attempts < MAX_PROCESSING_ATTEMPTS`
- Retries are pulled in batches by `RetryWorker`.

## Operational control

- `/health` returns aggregate state counts.
- `/admin/events/:eventId/retry` requeues failed events.
- `npm run replay -- <event_id>` requeues and processes from CLI.
