# Domain Knowledge

> Accumulated domain knowledge from implementation cycles. Updated by agents as they learn.

## Key Domain Concepts

- **Campaign**: A crowdfunding campaign for a Mars mission project. Has a funding goal (USD cents), deadline, and milestones.
- **Contribution**: A backer's financial contribution to a campaign. Amount in USD integer cents.
- **Escrow**: Segregated holding of campaign funds. One escrow account per campaign. Ledger entries are append-only and immutable.
- **Milestone**: A campaign checkpoint that triggers fund disbursement when verified.
- **Disbursement**: Release of escrowed funds to campaign creator. Requires dual admin approval.

## Financial Rules

- Single currency: USD
- All amounts stored as integer cents (minor units)
- JSON serialisation: amounts as strings, never numbers
- No floating point arithmetic for money — ever
- Escrow ledger is append-only and immutable

## User Roles

- **Backer**: Browses campaigns, makes contributions, tracks funded projects
- **Creator**: Creates and manages campaigns, submits milestones
- **Reviewer**: Reviews campaign proposals against curation criteria before campaigns go live
- **Administrator**: Platform management, campaign moderation
- **Super Administrator**: Full system access, disbursement final approval

## Infrastructure Conventions

- **Local dev**: Docker Compose stack with PostgreSQL 16, backend, frontend, dbmate
- **Database migrations**: dbmate (`ghcr.io/amacneil/dbmate`), files in `db/migrations/` at repo root
- **Logging**: Pino (structured JSON) with pino-http middleware, pino-pretty for dev only
- **Environment variables**: `.env` never committed; `.env.example` documents all vars with placeholders
- **Mock adapters**: `MOCK_[SERVICE]=true/false` env vars to toggle mock/real adapters
- **Package naming**: `@mmf/backend`, `@mmf/frontend` (npm workspace namespace)
