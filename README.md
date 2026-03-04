# Stripe Webhook Reliability Service

This service provides durable, idempotent Stripe webhook processing for production environments. It is designed to prevent dropped events, block duplicate downstream execution, and recover cleanly from transient failures.

## Core guarantees

- Stripe signature verification on every webhook request.
- Persistent event storage before downstream processing.
- Idempotency enforcement by unique Stripe `event.id`.
- Replay-safe processing with atomic event claiming.
- Exponential-backoff retries for transient failures.
- Operational visibility through structured logs and `/health`.

## Technology stack

- Node.js 20+
- Express
- Stripe SDK
- SQLite (`better-sqlite3`)
- Pino structured logging
- Vitest + Supertest
- GitHub Actions CI
- Docker + Docker Compose

## Local quick start

1. Install dependencies:
```bash
npm install
```
2. Create environment file:
```bash
cp .env.example .env
```
3. Start the service:
```bash
npm run dev
```
4. Verify health:
```bash
curl http://localhost:3000/health
```

## Quality commands

- Full test suite: `npm test`
- Unit tests: `npm run test:unit`
- Integration tests: `npm run test:integration`
- Lint: `npm run lint`
- Build: `npm run build`

## Docker workflow

1. Build and run:
```bash
docker compose up --build
```
2. Validate health endpoint:
```bash
curl http://localhost:3000/health
```

## Stripe webhook simulation flow

1. Start Stripe CLI forwarding:
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```
2. Set `.env` `STRIPE_WEBHOOK_SECRET` from Stripe CLI output.
3. Trigger a test event:
```bash
stripe trigger payment_intent.succeeded
```

## Manual replay

Failed events can be requeued and replayed:

```bash
npm run replay -- evt_123456789
```

## Documentation index

- [Live demo and fallback walkthrough](docs/LIVE_DEMO.md)
- [High-level architecture](docs/HIGH_LEVEL.md)
- [Mid-level implementation map](docs/MID_LEVEL.md)
- [Low-level behavior and state transitions](docs/LOW_LEVEL.md)
- [Operations runbook](docs/OPERATIONS.md)
- [Testing strategy](docs/TESTING.md)
- [Changelog](docs/CHANGELOG.md)

## Delivery tracking

- GitHub project: `https://github.com/users/MSulSal/projects/4`
- Milestone issues: `https://github.com/MSulSal/stripe-webhook-reliability-service/issues`
