# Live Demo

## Public health endpoint

- Planned public URL: `https://stripe-webhook-reliability-service.onrender.com/health`
- Current local URL: `http://localhost:3000/health`

I prepared deployment artifacts (`Dockerfile`, `render.yaml`, CI workflow) so I can publish quickly once hosting account access is available.

## Cold-start fallback walkthrough

- Walkthrough video placeholder: `https://www.loom.com/share/REPLACE_WITH_PUBLISHED_VIDEO_ID`

I will publish this as a short runbook recording that shows:

1. Cloning the repository.
2. Creating `.env`.
3. Starting with Docker.
4. Sending a Stripe test webhook.
5. Verifying deduplication and `/health`.
