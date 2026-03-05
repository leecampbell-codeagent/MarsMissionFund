# Manual Tasks

> Steps that cannot be automated — require human action in third-party dashboards.
> Maintained by the Infrastructure Engineer agent.
> Updated: 2026-03-05 (reviewed for feat-003 — no new tasks required)

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

---

## Task #3 — Veriff KYC Integration

**Service:** Veriff (https://veriff.com)
**Blocked feature:** feat-002 real KYC (the stub adapter is already working for local demo)
**Status:** ⬜ TODO
**Priority:** Low (stub works for demo)

### What This Enables

Real identity verification for Mars Mission Fund creators — Veriff performs document and selfie checks and returns a verified/rejected outcome via webhook, replacing the auto-approving stub adapter.

### Steps

1. Go to https://station.veriff.com and sign in (or create a Veriff account — contact sales@veriff.com for a sandbox account if you do not have one).

2. **Create an integration:**
   - In the left sidebar, go to **Integrations**.
   - Click **"New integration"**.
   - Name: `Mars Mission Fund`
   - Environment: select **Sandbox** for testing; **Production** when going live.
   - Click **"Create"**.

3. **Copy your API credentials** — shown on the integration detail page:
   - `API Key` → copy and set as `VERIFF_API_KEY` in your `.env` file.
   - The API key is used by the backend to create verification sessions.

4. **Configure the webhook endpoint:**
   - On the integration detail page, find **"Webhooks"** or **"Notifications"**.
   - Click **"Add endpoint"**.
   - URL: `https://your-domain.com/api/v1/webhooks/veriff`
     (For local testing, use a tunnelling tool such as ngrok — see Verification section below.)
   - Enable the following event types:
     - `verification.decision` — fired when Veriff reaches a final approved/declined decision
   - Click **"Save"**.
   - On the webhook detail page, copy the **"HMAC Secret"** (or "Signing Secret") — set it as `VERIFF_WEBHOOK_SECRET` in your `.env`.

5. **Set `MOCK_KYC=false`** in your `.env` to disable the stub and activate the real Veriff adapter.

6. **Implement the real Veriff adapter** (backend engineer task):
   - Create `packages/backend/src/kyc/adapters/veriff-kyc-provider.adapter.ts` implementing `KycVerificationPort`.
   - Use the Veriff Node.js SDK (`@veriff/incontext-sdk` or the REST API directly).
   - The `initiateSession()` method should create a Veriff session via `POST https://stationapi.veriff.com/v1/sessions` and return `{ sessionId, outcome: 'pending' }`.
   - The final decision arrives via webhook — implement `POST /api/v1/webhooks/veriff` to receive the `verification.decision` event, validate the HMAC signature using `VERIFF_WEBHOOK_SECRET`, and call `kycAppService.handleVeriffDecision()`.

7. **Wire the real adapter in the composition root:**
   - In `packages/backend/src/composition-root.ts`, replace the stub instantiation when `MOCK_KYC=false`:
     ```typescript
     const kycProvider: KycVerificationPort = mockKyc
       ? new StubKycVerificationAdapter(true)
       : new VeriffKycProviderAdapter(process.env.VERIFF_API_KEY!);
     ```

### Config Required

```bash
VERIFF_API_KEY=your_veriff_api_key_here          # → add to .env
VERIFF_WEBHOOK_SECRET=your_veriff_hmac_secret    # → add to .env
MOCK_KYC=false                                   # → change from true to false in .env
```

### Verification

**Test API key works (sandbox):**
```bash
curl -X POST https://stationapi.veriff.com/v1/sessions \
  -H "Content-Type: application/json" \
  -H "X-AUTH-CLIENT: $VERIFF_API_KEY" \
  -d '{"verification": {"callback": "https://your-domain.com", "person": {"firstName": "Test", "lastName": "User"}, "document": {"type": "PASSPORT", "country": "US"}, "lang": "en"}}'
# Expect: 201 response with a sessionId and a verification URL
```

**Test webhook delivery locally** (using ngrok or similar):
```bash
npx ngrok http 3001
# Copy the HTTPS tunnel URL and update your Veriff webhook endpoint URL
# Complete a sandbox verification in the Veriff demo flow — check backend logs for webhook receipt
```

**Confirm stub is disabled:**
```bash
# With MOCK_KYC=false, calling POST /api/v1/kyc/submit should create a real Veriff session
# and return kycStatus: 'pending' (not 'verified') until the webhook arrives
```

### Currently Mocked By

- `packages/backend/src/kyc/adapters/stub-kyc-provider.adapter.ts`
- Will be replaced by: `packages/backend/src/kyc/adapters/veriff-kyc-provider.adapter.ts`




























