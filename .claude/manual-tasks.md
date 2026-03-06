# Manual Tasks

> Tasks that require human action — external service setup, API key provisioning, etc.
> Updated by infrastructure engineer agent after each feature cycle.

## Status Key

- Not started — TODO
- IN PROGRESS — Being worked on
- DONE — Completed

---

## Database Schema (feat-002)

The core PostgreSQL schema has been deployed via dbmate migrations. All seven migration files
covering the five bounded contexts (Account, KYC, Campaign, Payments/Escrow, Contributions) are
in place in `db/migrations/`. No manual steps are required — schema deployment is fully automated
via `dbmate up`.

*No manual tasks for feat-002. The database schema is ready for application features (feat-003+).*

---

*Future tasks will be added here as features requiring external services are built (Clerk, Stripe, Veriff, AWS SES).*
