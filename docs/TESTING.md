# Testing Guide

## Test scope

I cover both behavior layers:

- Unit tests for signature verification and processing state transitions.
- Integration tests for the full webhook HTTP path.

## Commands

- Full suite with coverage: `npm test`
- Unit only: `npm run test:unit`
- Integration only: `npm run test:integration`
- Lint: `npm run lint`
- Build: `npm run build`

## Current core assertions

Unit:

- Valid Stripe signature is accepted.
- Invalid signature is rejected.
- Events process exactly once.
- Transient downstream errors schedule retries.
- Non-transient errors move events to failed.

Integration:

- Valid webhook persists and processes.
- Duplicate webhook does not process twice.
- Invalid signature is rejected and not persisted.

## CI quality gate

GitHub Actions runs in this order:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
