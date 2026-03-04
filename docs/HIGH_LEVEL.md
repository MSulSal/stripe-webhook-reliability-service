# High-Level Design

## Objective

I need to process Stripe webhooks without losing events and without processing the same event twice downstream.

## Reliability model

I treat Stripe webhook intake and downstream processing as two separate concerns:

1. Intake must be authentic and durable.
2. Processing must be idempotent and retry-safe.

Because I persist first, a transient downstream outage cannot drop events.

## Key guarantees

- Signature verification blocks spoofed traffic.
- Event persistence ensures restart-safe recovery.
- Event ID uniqueness provides idempotency.
- Retry queue handles transient downstream outages.
- Failed events remain visible for manual replay.

## Components

- `POST /webhooks/stripe`: validates, stores, and triggers processing.
- `WebhookEventRepository`: persistence and event lifecycle state.
- `EventProcessor`: processing state machine and retry policy.
- `RetryWorker`: polling loop for due retry events.
- `GET /health`: runtime and event-state summary.

## Event lifecycle

`received` -> `processing` -> `processed`

`received` -> `processing` -> `retry_pending` -> `processing` -> ...

`received` -> `processing` -> `failed`

## Failure strategy

- Invalid signatures: rejected with `400`.
- Persistence failure: returns `500`, allowing Stripe redelivery.
- Transient processing failure: persisted and retried automatically.
- Permanent processing failure: stored as `failed` for manual replay.
