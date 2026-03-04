# Changelog

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
