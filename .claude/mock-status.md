# Mock Status

> Tracks which external services are currently mocked vs. integrated with real adapters.
> Updated by infra-engineer-agent after each feature.

| Service | Status | Mock Adapter | Real Adapter | Manual Task | Notes |
|---------|--------|-------------|-------------|-------------|-------|
| Payments (Stripe) | Mocked | TBD | TBD | TBD | `MOCK_PAYMENTS=true` in `.env.example` |
| KYC (Veriff) | Mocked | TBD | TBD | TBD | `MOCK_KYC=true` in `.env.example` |
| Email (AWS SES) | Mocked | TBD | TBD | TBD | `MOCK_EMAIL=true` in `.env.example` |
| Auth (Clerk) | Not yet integrated | N/A | TBD | TBD | Will be added in feat-003 |
| Analytics (PostHog) | Not yet integrated | N/A | TBD | TBD | Future feature |
| Database (PostgreSQL) | Real (local) | N/A | `postgres:16-alpine` via Docker Compose | N/A | Local dev via Docker Compose |
