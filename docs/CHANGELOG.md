# Changelog

## [1.0.4] - 2026-03-04

### Updated

- Removed legacy platform-specific deployment references from public documentation.
- Removed the legacy platform-specific deployment guide from the public docs set.

## [1.0.3] - 2026-03-04

### Updated

- `docs/DELIVERY_NOTES.md` now reflects completed delivery status and final deployment outcome.
- `docs/LIVE_DEMO.md` delivery tracking now marks milestone issues as closed.
- `docs/OPERATIONS.md` deployment references now align with live Railway validation and runtime operations.

## [1.0.2] - 2026-03-04

### Updated

- `docs/LIVE_DEMO.md` now reflects Railway as the active deployment target.
- Replaced walkthrough video placeholder with a full written reviewer walkthrough.
- Updated live demo health endpoint label from planned to live.

## [1.0.1] - 2026-03-04

### Added

- Formal delivery tracking and lessons-learned document:
  - `docs/DELIVERY_NOTES.md`

### Updated

- `README.md` documentation index with deployment and delivery-note links.
- `docs/OPERATIONS.md` deployment-path handoff to runtime operations guidance.
- `docs/LIVE_DEMO.md` hosting target and deployment checkpoints.

## [1.0.0] - 2026-03-04

### Added

- Full Node.js + Express webhook reliability service scaffold.
- Stripe signature verification with raw payload handling.
- SQLite-backed event persistence with idempotent insert by Stripe event ID.
- Processing state machine with retry-safe claiming and terminal failure tracking.
- Exponential backoff retry worker for transient failures.
- Structured logging and health endpoint for visibility.
- Manual replay endpoint and CLI replay script.
- Unit tests and integration tests for core webhook path.
- Dockerfile, Docker Compose workflow, and Render deployment blueprint.
- GitHub Actions CI pipeline for lint/test/build.
- Public and operational documentation set:
  - `README.md`
  - `docs/HIGH_LEVEL.md`
  - `docs/MID_LEVEL.md`
  - `docs/LOW_LEVEL.md`
  - `docs/OPERATIONS.md`
  - `docs/TESTING.md`
  - `docs/LIVE_DEMO.md`
