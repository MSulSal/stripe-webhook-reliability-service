# Stripe Webhook Reliability Service

I built this service to make Stripe webhook handling safe and repeatable in production. It protects downstream systems from duplicate processing, preserves every received event, and retries transient failures with backoff.

## What this service guarantees

- I verify every webhook with Stripe signature validation.
- I persist every valid event before processing.
- I enforce idempotency by unique Stripe `event.id`.
- I process each event at most once in steady state.
- I retry transient downstream failures from persisted state.
- I expose structured operational visibility through logs and `/health`.

## Stack

- Node.js 20+
- Express
- Stripe SDK
- SQLite (`better-sqlite3`)
- Pino structured logging
- Vitest + Supertest
- GitHub Actions CI
- Docker + Docker Compose

## Quick start (local)

1. Install dependencies:
```bash
npm install
```
2. Create local environment config:
```bash
cp .env.example .env
```
3. Run the service:
```bash
npm run dev
```
4. Verify health:
```bash
curl http://localhost:3000/health
```

## Test commands

- Run all tests: `npm test`
- Unit only: `npm run test:unit`
- Integration only: `npm run test:integration`
- Lint: `npm run lint`
- Build: `npm run build`

## Docker

1. Build and run:
```bash
docker compose up --build
```
2. Check health:
```bash
curl http://localhost:3000/health
```

## Stripe webhook test flow

1. Start Stripe CLI forwarding:
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```
2. Set `STRIPE_WEBHOOK_SECRET` in `.env` from CLI output.
3. Trigger a test event:
```bash
stripe trigger payment_intent.succeeded
```

## Manual replay of failed events

If an event reaches `failed` status, I can requeue and replay it:

```bash
npm run replay -- evt_123456789
```

## Documentation map

- [Live demo and cold-start fallback](docs/LIVE_DEMO.md)
- [High-level architecture](docs/HIGH_LEVEL.md)
- [Mid-level implementation map](docs/MID_LEVEL.md)
- [Low-level behavior and state transitions](docs/LOW_LEVEL.md)
- [Operations runbook](docs/OPERATIONS.md)
- [Testing strategy and commands](docs/TESTING.md)
- [Project changelog](docs/CHANGELOG.md)
