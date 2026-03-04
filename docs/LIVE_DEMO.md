# Live Demo

## Delivery tracking

- Project board: `https://github.com/users/MSulSal/projects/4`
- Milestone issues: `#1` to `#9` in this repository

## Public health endpoint

- Planned public URL: `https://webhooks.yourdomain.com/health`
- Current local URL: `http://localhost:3000/health`

Deployment artifacts and Oracle deployment instructions are prepared for publication.

## Deployment checkpoints

1. Oracle VM is created with static public IP.
2. DNS `A` record points domain to OCI IP.
3. HTTPS reverse proxy is active.
4. Stripe endpoint is configured with production URL.
5. `/health` is publicly accessible.

## Cold-start fallback walkthrough

- Walkthrough video placeholder: `https://www.loom.com/share/REPLACE_WITH_PUBLISHED_VIDEO_ID`

The fallback walkthrough video should cover:

1. Cloning the repository.
2. Creating `.env`.
3. Starting with Docker.
4. Sending a Stripe test webhook.
5. Verifying deduplication and `/health`.
