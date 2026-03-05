# Manual Tasks

> Steps that cannot be automated — require human action in third-party dashboards.
> Maintained by the Infrastructure Engineer agent.
> Updated: 2026-03-05

---

## Task #1 — Clerk Application Setup

**Service:** Clerk (https://clerk.com)
**Blocked feature:** feat-001 (Account Registration and Authentication)
**Status:** TODO
**Priority:** High

### What This Enables

Users can register and sign in to Mars Mission Fund using email/password, Google SSO, or Microsoft SSO; Clerk issues session tokens that the backend validates on every request.

### Steps

1. Go to https://dashboard.clerk.com and sign in (or create a free account).

2. Click **"Create application"**.
   - Application name: `Mars Mission Fund`
   - Under "How will your users sign in?", enable:
     - Email address (with password)
     - Google
     - Microsoft
   - Click **"Create application"**.

3. **Copy your API keys** — shown immediately after creation on the "API Keys" page:
   - `CLERK_PUBLISHABLE_KEY` → starts with `pk_test_`
   - `CLERK_SECRET_KEY` → starts with `sk_test_`
   - Add both to your `.env` file.
   - Set `VITE_CLERK_PUBLISHABLE_KEY` to the same value as `CLERK_PUBLISHABLE_KEY`.

4. **Enable enumeration protection** (security requirement — see gotcha G-007):
   - In the left sidebar, go to **Configure > Restrictions**.
   - Find **"Email enumeration protection"** and enable it.
   - Click **"Save"**.

5. **Confirm session token version is v2** (see gotcha G-008):
   - In the left sidebar, go to **Configure > Sessions**.
   - Under "Token version", ensure it shows **v2**.
   - If it shows v1, click the upgrade button to migrate to v2.

6. **Configure JWT template to include role claim** (see gotcha G-002):
   - In the left sidebar, go to **Configure > Sessions**.
   - Find **"Customize session token"** and click **"Edit"**.
   - Add the following claim to the JSON template:
     ```json
     {
       "role": "{{user.publicMetadata.role}}"
     }
     ```
   - Keep the template minimal — embedding large metadata causes cookie size issues (see gotcha G-005).
   - Click **"Save"**.

7. **Enable Google OAuth provider**:
   - In the left sidebar, go to **User & Authentication > Social connections**.
   - Find **Google** and toggle it on.
   - For a development environment, the default shared credentials are fine.
   - For production, create a Google OAuth app at https://console.cloud.google.com and enter your own Client ID and Secret.

8. **Enable Microsoft OAuth provider**:
   - Still on **User & Authentication > Social connections**.
   - Find **Microsoft** and toggle it on.
   - For production, create an app registration at https://portal.azure.com.

9. **Register the Clerk webhook endpoint**:
   - In the left sidebar, go to **Configure > Webhooks**.
   - Click **"Add endpoint"**.
   - URL: `https://your-domain.com/api/v1/webhooks/clerk`
     (For local testing, use a tunnelling tool — see Verification section below.)
   - Under **"Subscribe to events"**, enable:
     - `user.created`
     - `user.updated`
   - Click **"Create"**.
   - On the endpoint detail page, find **"Signing Secret"** — click the eye icon to reveal it.
   - Copy the value (starts with `whsec_`) and set it as `CLERK_WEBHOOK_SECRET` in your `.env`.

### Config Required

```bash
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here        # → add to .env
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here  # → add to .env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here  # → add to .env
CLERK_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here  # → add to .env
MOCK_AUTH=false  # → Clerk is always a real integration
```

### Verification

**Test API key works:**
```bash
curl https://api.clerk.com/v1/users \
  -H "Authorization: Bearer $CLERK_SECRET_KEY"
# Expect: {"data": [], "total_count": 0} (empty users list)
```

**Test webhook delivery locally** (using ngrok or similar):
```bash
npx ngrok http 3001
# Copy the HTTPS tunnel URL and update your Clerk webhook endpoint URL
# Register with email/password in the app — check backend logs for webhook receipt
```

**Test JWT template is applied:**
After signing in via the frontend, inspect the session token using:
```bash
# Paste the JWT from browser devtools → Application → Cookies → __session
# Decode at https://jwt.io and verify the "role" claim is present in the payload
```

### Currently Mocked By

Clerk auth is a real integration — it is never mocked in production code.
In tests, `@clerk/express` is mocked at the module level (see gotcha G-012).

---

## Task #2 — Local PostgreSQL Database Setup

**Service:** PostgreSQL (via Docker Compose)
**Blocked feature:** feat-001 (Account Registration and Authentication)
**Status:** TODO
**Priority:** High

### What This Enables

The local development database is running and all migrations have been applied, so the backend can start and persist user records.

### Steps

1. Ensure Docker Desktop (or Docker Engine) is installed and running.

2. From the project root, start the PostgreSQL service:
   ```bash
   docker compose up -d postgres
   ```
   Wait for it to be healthy (check with `docker compose ps`).

3. Run all database migrations:
   ```bash
   docker compose run --rm migrate
   ```
   Expected output:
   ```
   Applying: 20260305120000_add_updated_at_trigger.sql
   Applying: 20260305130000_create_users_table.sql
   ```

4. Verify the database is ready:
   ```bash
   docker compose exec postgres psql -U mmf -d mmf_dev -c "\dt"
   # Expect: schema_migrations and users tables listed
   ```

5. Copy `.env.example` to `.env` and fill in your Clerk keys (from Task #1):
   ```bash
   cp .env.example .env
   # Edit .env with your real Clerk keys
   ```

### Config Required

```bash
DATABASE_URL=postgresql://mmf:mmf_password@localhost:5432/mmf_dev  # → add to .env
POSTGRES_USER=mmf                                                    # → add to .env
POSTGRES_PASSWORD=mmf_password                                      # → add to .env
POSTGRES_DB=mmf_dev                                                  # → add to .env
```

### Verification

```bash
docker compose exec postgres psql -U mmf -d mmf_dev -c "SELECT COUNT(*) FROM users;"
# Expect: count = 0 (empty table, ready for use)
```

### Currently Mocked By

PostgreSQL is the real database — it is never mocked. The `in-memory-user-repository.adapter.ts` is used in unit tests only (not a database mock).




























