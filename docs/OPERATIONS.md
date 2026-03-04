# Operations Runbook

## Deployment references

- Live deployment validation and URL: `docs/LIVE_DEMO.md`
- VM self-hosted deployment guide: `docs/DEPLOY_ORACLE_FREE.md`
- This runbook focuses on runtime operations after deployment is complete.

## Environment variables

Required:

- `STRIPE_API_KEY`
- `STRIPE_WEBHOOK_SECRET`

Core runtime:

- `PORT` (default `3000`)
- `DATABASE_PATH` (default `./data/webhooks.db`)
- `LOG_LEVEL` (default `info`)

Retry tuning:

- `MAX_PROCESSING_ATTEMPTS` (default `6`)
- `RETRY_BASE_DELAY_MS` (default `2000`)
- `RETRY_MAX_DELAY_MS` (default `60000`)
- `RETRY_POLL_INTERVAL_MS` (default `2000`)
- `RETRY_BATCH_SIZE` (default `20`)

Downstream:

- `DOWNSTREAM_MODE=log|http`
- `DOWNSTREAM_URL` (required for `http`)
- `DOWNSTREAM_TIMEOUT_MS` (default `5000`)

Admin replay guard:

- `ADMIN_TOKEN` (optional)

## Start and stop

- Development: `npm run dev`
- Production build: `npm run build && npm start`
- Docker: `docker compose up --build`

## Health checks

- Endpoint: `GET /health`
- Success criteria: returns `200` with `status: "ok"`

## Alerting suggestions

- Alert if `failed` count > 0 for more than 5 minutes.
- Alert if `retry_pending` count grows steadily.
- Alert on repeated `Webhook persistence failure` logs.

## Replay failed event

HTTP admin endpoint:

```bash
curl -X POST \
  -H "x-admin-token: $ADMIN_TOKEN" \
  http://localhost:3000/admin/events/evt_123/retry
```

CLI replay:

```bash
npm run replay -- evt_123
```

## Disaster recovery

1. Preserve `DATABASE_PATH` file and associated WAL files.
2. Restore DB file to new instance.
3. Start service with same config.
4. Retry worker will resume `retry_pending` events automatically.
