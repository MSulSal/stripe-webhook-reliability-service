# Oracle Always Free Deployment (Beginner-Safe)

This guide deploys the service to Oracle Cloud Infrastructure (OCI) Always Free with HTTPS and a public `/health` endpoint.

## Goal

After this guide completes, the service is publicly available at:

- `https://<your-domain>/health`
- `https://<your-domain>/webhooks/stripe`

## What is needed before starting

- Oracle Cloud account (already created).
- Domain name with DNS control (for example, Cloudflare, Namecheap, GoDaddy).
- Stripe account with access to API keys and webhooks.
- Local terminal with `ssh` available.

## Safety rule for secrets

- Do not paste secrets in chat or commit them to git.
- Keep real values only in server `.env` files with restricted permissions (`chmod 600 .env`).
- Keep `.env.example` as placeholders only.

## Step 1: Create a compartment

In OCI Console:

1. Open `Identity & Security -> Compartments`.
2. Create compartment name: `stripe-webhook-reliability`.
3. Suggested description:
`Dedicated compartment for the Stripe webhook reliability service infrastructure, networking, and operations resources.`

## Step 2: Create the compute instance

In OCI Console:

1. Open `Compute -> Instances -> Create instance`.
2. Name: `stripe-webhook-service`.
3. Image: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS.
4. Shape: `VM.Standard.A1.Flex` (Always Free eligible).
5. Suggested shape config: `1 OCPU`, `6 GB RAM`.
6. Add SSH public key.
7. Place the instance in the `stripe-webhook-reliability` compartment.

## Step 3: Reserve and attach a static public IP

In OCI Console:

1. Open `Networking -> Public IPs -> Create reserved public IP`.
2. Attach it to the instance primary private IP.
3. Copy and save this IP. It is needed for DNS.

## Step 4: Open network ports

Add ingress rules to the subnet Security List or attached NSG:

- TCP `22` source: personal public IP only.
- TCP `80` source: `0.0.0.0/0`.
- TCP `443` source: `0.0.0.0/0`.

## Step 5: Point domain DNS to the VM

Create an `A` record in DNS:

- Host: `webhooks` (or preferred subdomain).
- Value: reserved OCI public IP.
- TTL: `300` (or provider default).

Verify DNS propagation:

```bash
nslookup webhooks.yourdomain.com
```

Expected: returned IP matches OCI reserved public IP.

## Step 6: Connect to the VM

```bash
ssh ubuntu@<OCI_PUBLIC_IP>
```

If username differs, OCI Console instance page shows the correct SSH format.

## Step 7: Install Docker and dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## Step 8: Clone and prepare the service

```bash
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/MSulSal/stripe-webhook-reliability-service.git
cd stripe-webhook-reliability-service
cp .env.example .env
chmod 600 .env
mkdir -p data
```

## Step 9: Configure environment variables

Edit `.env` and set at least:

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

STRIPE_API_KEY=sk_test_replace_me
STRIPE_WEBHOOK_SECRET=whsec_pending

DATABASE_PATH=./data/webhooks.db

MAX_PROCESSING_ATTEMPTS=6
RETRY_BASE_DELAY_MS=2000
RETRY_MAX_DELAY_MS=60000
RETRY_POLL_INTERVAL_MS=2000
RETRY_BATCH_SIZE=20

DOWNSTREAM_MODE=log
DOWNSTREAM_TIMEOUT_MS=5000
```

For real downstream forwarding, use:

```env
DOWNSTREAM_MODE=http
DOWNSTREAM_URL=https://your-downstream-endpoint.example.com/events
```

## Step 10: Start the service with Docker

Bind app port to localhost only (recommended when using reverse proxy):

```bash
cat > docker-compose.override.yml <<'EOF'
services:
  webhook-service:
    ports:
      - "127.0.0.1:3000:3000"
EOF
```

Start:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:3000/health
```

Expected: HTTP 200 response with `status: "ok"`.

## Step 11: Enable HTTPS with Caddy

Install Caddy:

```bash
sudo apt install -y caddy
```

Configure `/etc/caddy/Caddyfile`:

```caddy
webhooks.yourdomain.com {
  reverse_proxy 127.0.0.1:3000
  encode gzip zstd
}
```

Apply:

```bash
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl https://webhooks.yourdomain.com/health
```

Expected: valid HTTPS response from `/health`.

## Step 12: Wire Stripe webhook endpoint

In Stripe Dashboard:

1. Open `Developers -> Webhooks -> Add endpoint`.
2. Endpoint URL:
`https://webhooks.yourdomain.com/webhooks/stripe`
3. Select event types needed by the product.
4. Copy the generated signing secret (`whsec_...`).
5. Update server `.env` `STRIPE_WEBHOOK_SECRET=<real_whsec_value>`.
6. Restart containers:

```bash
docker compose up -d
```

## Step 13: Validate acceptance criteria

Run these checks:

1. Public health:
```bash
curl https://webhooks.yourdomain.com/health
```

2. Invalid signature rejection:
```bash
curl -i -X POST https://webhooks.yourdomain.com/webhooks/stripe \
  -H "content-type: application/json" \
  -H "stripe-signature: t=1,v1=bad" \
  -d '{"id":"evt_bad","object":"event","type":"charge.succeeded"}'
```
Expected: `400`.

3. Duplicate safety:
- Send Stripe test event.
- Resend same Stripe event from dashboard.
- Confirm logs show first processing and duplicate skip.

4. Integration visibility:
```bash
docker compose logs --tail=200 webhook-service
```

## Step 14: Keep free-tier charge risk low

1. Do not upgrade the OCI account to Pay As You Go.
2. Use only Always Free resources.
3. Configure billing budget alerts at low thresholds.
4. Keep resource inventory small and explicit.

## Day-2 operations

Update deployment:

```bash
cd /opt/stripe-webhook-reliability-service
git pull
docker compose up -d --build
```

Check service:

```bash
docker compose ps
docker compose logs -f webhook-service
curl https://webhooks.yourdomain.com/health
```
