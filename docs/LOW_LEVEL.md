# Low-Level Behavior

## Signature validation

- Route uses `express.raw({ type: "application/json" })`.
- Raw bytes and `stripe-signature` are passed to `stripe.webhooks.constructEvent`.
- Any verification failure returns `400 Invalid Stripe signature`.

## Idempotency enforcement

- `event_id` is the SQLite primary key.
- Insert uses `ON CONFLICT(event_id) DO NOTHING`.
- If insert does not change rows, event is treated as duplicate and skipped.

## Processing claim

To avoid double-processing, events are claimed atomically:

```sql
UPDATE webhook_events
SET status='processing', process_attempts=process_attempts+1
WHERE event_id=? AND status IN ('received', 'retry_pending')
```

If claim fails, another worker already owns it or it is complete.

## Error classification

Transient errors include:

- `DownstreamError(transient=true)`
- network timeout/dns/reset style failures (`ETIMEDOUT`, `ECONNRESET`, etc.)

Non-transient errors become `failed`.

## Retry scheduling

- Transient failure writes:
`status='retry_pending'`, `next_retry_at`, `last_error`
- Retry worker polls by:
`status='retry_pending' AND next_retry_at <= now`
- Due events are claimed and processed through the same state machine.

## Health endpoint response shape

```json
{
  "status": "ok",
  "service": "stripe-webhook-reliability-service",
  "now": "2026-03-04T12:00:00.000Z",
  "uptimeSeconds": 123,
  "events": {
    "total": 4,
    "byStatus": {
      "received": 0,
      "processing": 0,
      "processed": 3,
      "retry_pending": 1,
      "failed": 0
    }
  }
}
```
