# Live Demo

## Delivery tracking

- Project board: `https://github.com/users/MSulSal/projects/4`
- Milestone issues: `#1` to `#9` in this repository (closed)

## Public health endpoint

- Live public URL: `https://stripe-webhook-reliability-service-production.up.railway.app/health`
- Current local URL: `http://localhost:3000/health`

Deployment artifacts are published and running on Railway.

## Deployment checkpoints

1. Railway service is deployed from `main`.
2. Persistent volume is mounted at `/app/data`.
3. Environment variables are configured in Railway.
4. Stripe endpoint is configured with production webhook URL.
5. `/health` is publicly accessible.

## Validation walkthrough

Reviewer validation flow:

1. Open `https://stripe-webhook-reliability-service-production.up.railway.app/health` and confirm `status: "ok"`.
2. In Stripe Dashboard, send a test event to the production endpoint.
3. Confirm webhook delivery is `2xx` in Stripe.
4. Resend the same event from Stripe Events to validate duplicate handling.
5. Verify logs and `/health` event counters reflect expected processing state.
