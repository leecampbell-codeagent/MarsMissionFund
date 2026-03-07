# Infrastructure Rules

> Applied to all files in `infra/**` and migration files

## Terraform

- All AWS resources managed by Terraform — no manual console changes
- Modules reusable across environments (dev/prod) — parameterised with variables
- Tag every resource: Project, Environment, ManagedBy
- `terraform fmt` before committing — no formatting drift
- `terraform validate` must pass
- `terraform plan` must show only expected changes
- No hardcoded AWS account IDs or regions — use variables
- No wildcard IAM permissions — principle of least privilege
- No public S3 buckets
- No open security groups (0.0.0.0/0) except CloudFront ingress
- Secrets via AWS Secrets Manager or SSM Parameter Store — never in .tf files

## Migrations

- Managed by **dbmate** (Docker image: `amacneil/dbmate`) — NOT custom application code
- Files live in `db/migrations/` at the project root (NOT inside any package)
- Timestamp naming: `YYYYMMDDHHMMSS_[description].sql` (dbmate default format)
- Each file has `-- migrate:up` and `-- migrate:down` sections
- dbmate tracks applied migrations in `schema_migrations` table automatically
- Run locally: `dbmate up` (via docker-compose service or direct binary)
- Run in CI/CD: `dbmate up` as a step before application deployment
- Append-only — never modify existing migrations
- Do NOT wrap migrations in `BEGIN; ... COMMIT;` — dbmate wraps each migration in a transaction automatically
- `CREATE TABLE IF NOT EXISTS` where possible
- Monetary columns: `BIGINT` (integer cents) — never FLOAT/DOUBLE/REAL/NUMERIC for money
- All tables: `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Date columns: `TIMESTAMPTZ` — never TIMESTAMP without timezone
- Index on every FK column
- Index on every column used in WHERE/ORDER BY
- Explicit ON DELETE on every FK
- CHECK constraints for domain invariants
- `updated_at` auto-update trigger

## Environment Config

- `.env` is NEVER committed — in `.gitignore`
- `.env.example` IS committed — documents all required variables with placeholders
- Every new env var added to `.env.example`
- Feature flags for mock/real adapter switching: `MOCK_[SERVICE]=true/false`
- No secrets in code — environment variables only

## Cost Awareness

- MMF is a workshop sample app — use smallest viable instance sizes
- Document cost implications for anything over $50/month
- Prefer serverless/pay-per-use where appropriate
