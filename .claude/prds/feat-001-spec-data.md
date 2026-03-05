# PRD: feat-001 — Data Model & Domain Model

> Sub-file 2 of 4. Part of `feat-001-spec.md`.
> Contents: Database migration, table definition, domain entities, value objects.

---

## Data Model

### New Tables

#### `users`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Internal primary key — used as FK across all MMF tables |
| `clerk_user_id` | `TEXT` | NOT NULL | — | Clerk's user ID (`user_2abc3XYZ...`). NOT a UUID. TEXT only. |
| `email` | `TEXT` | NOT NULL | — | Normalised (lowercase, trimmed) email. Sourced from JWT claim. |
| `display_name` | `TEXT` | NULL | `NULL` | User-chosen display name. Max 255 characters by character count. |
| `bio` | `TEXT` | NULL | `NULL` | Free-text bio. Max 500 characters by character count. |
| `avatar_url` | `TEXT` | NULL | `NULL` | URL to avatar image. No liveness validation. Must point to non-application domain. |
| `account_status` | `TEXT` | NOT NULL | `'pending_verification'` | One of: `pending_verification`, `active`, `suspended`, `deactivated`. Never `deleted` (deleted rows are hard-deleted). |
| `onboarding_completed` | `BOOLEAN` | NOT NULL | `FALSE` | True when user has selected a role and reached the home surface. |
| `onboarding_step` | `TEXT` | NULL | `NULL` | Last completed onboarding step. Values: `null`, `'role_selection'`, `'profiling'`, `'notifications'`, `'complete'`. |
| `roles` | `TEXT[]` | NOT NULL | `ARRAY[]::TEXT[]` | Role array. Values: `backer`, `creator`, `reviewer`, `administrator`, `super_administrator`. Minimum 1 entry once `active`. |
| `notification_prefs` | `JSONB` | NOT NULL | See default below | Notification preference flags per category. |
| `kyc_status` | `TEXT` | NOT NULL | `'not_started'` | KYC stub for feat-001. Values: `not_started`, `pending`, `in_review`, `verified`, `failed`, `expired`. Only `not_started` is used until feat-002. |
| `last_seen_at` | `TIMESTAMPTZ` | NULL | `NULL` | Updated on every `auth/sync` call. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Row creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | Last update timestamp. Auto-updated by trigger. |

**`notification_prefs` default JSONB value:**

```json
{
  "campaign_updates": true,
  "milestone_completions": true,
  "contribution_confirmations": true,
  "recommendations": true,
  "security_alerts": true,
  "platform_announcements": false
}
```

**Indexes:**

| Index Name | Column(s) | Reason |
|------------|-----------|--------|
| `idx_users_clerk_user_id` | `clerk_user_id` | Primary lookup path from JWT `sub` claim |
| `idx_users_email` | `email` | Duplicate email detection, profile lookups |
| `idx_users_account_status` | `account_status` | Filter by status in admin queries |

**Constraints:**

| Constraint | Definition |
|------------|------------|
| `PRIMARY KEY` | `id` |
| `UNIQUE` | `clerk_user_id` — prevents duplicate MMF records for the same Clerk user |
| `CHECK account_status` | `account_status IN ('pending_verification', 'active', 'suspended', 'deactivated')` |
| `CHECK kyc_status` | `kyc_status IN ('not_started', 'pending', 'in_review', 'verified', 'failed', 'expired')` |
| `CHECK roles_not_empty` | Only enforced when `account_status = 'active'`: application layer ensures this. DB constraint: `array_length(roles, 1) IS NULL OR array_length(roles, 1) >= 0` (array may be empty for `pending_verification`). The application service sets `roles = ARRAY['backer']` atomically on activation. |
| `CHECK onboarding_step` | `onboarding_step IS NULL OR onboarding_step IN ('role_selection', 'profiling', 'notifications', 'complete')` |
| `TRIGGER users_updated_at` | `BEFORE UPDATE` — calls `update_updated_at_column()` |

**Design note on `email` column:** The `email` column does NOT have a `UNIQUE` constraint. Clerk can, in rare edge cases (unverified SSO email matching existing account), create two Clerk users with the same email. The `clerk_user_id` UNIQUE constraint is the authoritative deduplication key. Duplicate emails are handled at the Clerk layer, not the MMF layer.

---

### Migration File

**Filename:** `db/migrations/20260305130000_create_users_table.sql`

```sql
-- migrate:up
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id        TEXT        NOT NULL UNIQUE,
  email                TEXT        NOT NULL,
  display_name         TEXT,
  bio                  TEXT,
  avatar_url           TEXT,
  account_status       TEXT        NOT NULL DEFAULT 'pending_verification'
                                   CHECK (account_status IN (
                                     'pending_verification',
                                     'active',
                                     'suspended',
                                     'deactivated'
                                   )),
  onboarding_completed BOOLEAN     NOT NULL DEFAULT FALSE,
  onboarding_step      TEXT
                                   CHECK (onboarding_step IS NULL OR onboarding_step IN (
                                     'role_selection',
                                     'profiling',
                                     'notifications',
                                     'complete'
                                   )),
  roles                TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  notification_prefs   JSONB       NOT NULL DEFAULT '{
    "campaign_updates": true,
    "milestone_completions": true,
    "contribution_confirmations": true,
    "recommendations": true,
    "security_alerts": true,
    "platform_announcements": false
  }'::JSONB,
  kyc_status           TEXT        NOT NULL DEFAULT 'not_started'
                                   CHECK (kyc_status IN (
                                     'not_started',
                                     'pending',
                                     'in_review',
                                     'verified',
                                     'failed',
                                     'expired'
                                   )),
  last_seen_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_user_id ON users (clerk_user_id);
CREATE INDEX idx_users_email         ON users (email);
CREATE INDEX idx_users_account_status ON users (account_status);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- migrate:down
BEGIN;

DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP INDEX IF EXISTS idx_users_account_status;
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_clerk_user_id;
DROP TABLE IF EXISTS users;

COMMIT;
```

**Notes:**
- Timestamp must be after the existing migration `20260305120000`. Use `20260305130000`.
- The `update_updated_at_column()` function is created by the prior migration and is available here.
- `ON DELETE` behaviour for future FK references to `users.id`: other tables should use `ON DELETE SET NULL` (for audit/financial records) or `ON DELETE CASCADE` (for purely derived data). This is defined in the feature that creates those tables, not here.

---

## Domain Model

**Bounded context directory:** `packages/backend/src/account/`

### Entities

#### `User`

**File:** `packages/backend/src/account/domain/models/user.ts`

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` (UUID) | Internal MMF identifier |
| `clerkUserId` | `string` | Clerk user ID — `user_<KSUID>`. Never UUID. |
| `email` | `string` | Normalised (lowercase, trimmed) email address |
| `displayName` | `string \| null` | Optional display name |
| `bio` | `string \| null` | Optional bio text |
| `avatarUrl` | `string \| null` | Optional avatar URL |
| `accountStatus` | `AccountStatus` | Current lifecycle state |
| `onboardingCompleted` | `boolean` | Whether onboarding flow has been completed |
| `onboardingStep` | `OnboardingStep \| null` | Last completed onboarding step |
| `roles` | `Role[]` | Assigned roles. Empty until `active`. |
| `notificationPrefs` | `NotificationPreferences` | Per-category notification flags |
| `kycStatus` | `KycStatus` | KYC verification status. `not_started` for feat-001. |
| `lastSeenAt` | `Date \| null` | Last sync timestamp |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |

**Private constructor:** The constructor is `private`. All external code uses `create()` or `reconstitute()`.

**Factory method — `create()`:**

```typescript
static create(input: CreateUserInput): User
```

`CreateUserInput`:
| Field | Type | Validation |
|-------|------|------------|
| `clerkUserId` | `string` | Required, non-empty, must match pattern `user_` prefix OR be any non-empty string (Clerk format) |
| `email` | `string` | Required, valid email format (lowercased and trimmed by caller before passing) |
| `displayName` | `string \| undefined` | Optional, max 255 characters by char count |
| `bio` | `string \| undefined` | Optional, max 500 characters by char count |
| `avatarUrl` | `string \| undefined` | Optional, must be a valid URL if provided |
| `accountStatus` | `AccountStatus` | Required |

Validation rules enforced by `create()`:
- `clerkUserId` must be non-empty — throws `InvalidClerkUserIdError` if empty
- `email` must pass email regex — throws `InvalidEmailError` if malformed
- `displayName` if provided and non-empty: max 255 characters — throws `DisplayNameTooLongError`
- `bio` if provided and non-empty: max 500 characters — throws `BioTooLongError`
- `avatarUrl` if provided: must be a valid absolute URL — throws `InvalidAvatarUrlError`

Sets defaults:
- `id`: new UUID
- `onboardingCompleted`: `false`
- `onboardingStep`: `null`
- `roles`: `[]`
- `notificationPrefs`: `NotificationPreferences.defaults()`
- `kycStatus`: `KycStatus.NotStarted`
- `lastSeenAt`: `null`
- `createdAt`, `updatedAt`: `new Date()`

**Reconstitution — `reconstitute()`:**

```typescript
static reconstitute(data: UserData): User
```

`UserData` mirrors all `User` properties as plain types. No validation is performed — data is trusted as coming from the database.

**Business methods:**

```typescript
activate(): User
```
- Returns a new `User` with `accountStatus = AccountStatus.Active` and `roles` containing `Role.Backer` if not already present.
- Throws `AlreadyActiveError` if `accountStatus` is already `Active`.
- Does NOT throw if called on a user who is `Suspended` — returns activated user (reinstatement path).

```typescript
assignRole(role: Role, actorClerkUserId: string): User
```
- Returns a new `User` with the given role appended to `roles` (no-op if already assigned).
- Throws `SuperAdminAssignmentForbiddenError` if `role === Role.SuperAdministrator` — this role can only be assigned via `assignSuperAdminRole()` which requires the actor to have `Role.SuperAdministrator`.
- Throws `RoleRequiresKycError` if `role === Role.Creator` — note: this does NOT prevent the role being added; it is the responsibility of the application service to gate Creator-specific features via `kycStatus`. The role IS added; a separate check gates feature access.

Actually, per L4-001 Section 3.1: "The role may be assigned before KYC is complete, but Creator-gated features are inaccessible until verification succeeds." Therefore `assignRole` does NOT throw for Creator. Remove `RoleRequiresKycError` from this method.

```typescript
assignRole(role: Role): User
```
- Returns a new `User` with the role appended if not already present; returns unchanged `User` if already present.
- Throws `SuperAdminAssignmentForbiddenError` if `role === Role.SuperAdministrator`.
- Does not validate KYC — that is the application service's responsibility.

```typescript
removeRole(role: Role): User
```
- Returns a new `User` with the role removed.
- Throws `CannotRemoveBackerRoleError` if `role === Role.Backer` and it is the only remaining role (a user must retain at least one role while `active`).
- Throws `RoleNotAssignedError` if the user does not have the given role.

```typescript
updateProfile(input: UpdateProfileInput): User
```
- Returns a new `User` with updated `displayName`, `bio`, and/or `avatarUrl`.
- Input validation same as `create()` field rules.
- Empty string for `displayName` or `bio` stored as `null`.

```typescript
updateNotificationPrefs(prefs: Partial<NotificationPreferences>): User
```
- Returns a new `User` with merged notification preferences.
- Throws `SecurityAlertsCannotBeDisabledError` if `prefs.securityAlerts === false`.

```typescript
touchLastSeen(): User
```
- Returns a new `User` with `lastSeenAt` set to `new Date()`.

---

### Value Objects

#### `AccountStatus`

**File:** `packages/backend/src/account/domain/value-objects/account-status.ts`

```typescript
enum AccountStatus {
  PendingVerification = 'pending_verification',
  Active              = 'active',
  Suspended           = 'suspended',
  Deactivated         = 'deactivated',
}
```

Serialises to/from the `TEXT` column values above.

#### `Role`

**File:** `packages/backend/src/account/domain/value-objects/role.ts`

```typescript
enum Role {
  Backer             = 'backer',
  Creator            = 'creator',
  Reviewer           = 'reviewer',
  Administrator      = 'administrator',
  SuperAdministrator = 'super_administrator',
}
```

The full set of valid role values. No other string is a valid role. Zod schema on API validates against this enum.

#### `KycStatus`

**File:** `packages/backend/src/account/domain/value-objects/kyc-status.ts`

```typescript
enum KycStatus {
  NotStarted = 'not_started',
  Pending    = 'pending',
  InReview   = 'in_review',
  Verified   = 'verified',
  Failed     = 'failed',
  Expired    = 'expired',
}
```

Only `NotStarted` is set in feat-001. The full enum is defined here for feat-002 to use.

#### `OnboardingStep`

**File:** `packages/backend/src/account/domain/value-objects/onboarding-step.ts`

```typescript
enum OnboardingStep {
  RoleSelection = 'role_selection',
  Profiling     = 'profiling',
  Notifications = 'notifications',
  Complete      = 'complete',
}
```

#### `NotificationPreferences`

**File:** `packages/backend/src/account/domain/value-objects/notification-preferences.ts`

```typescript
interface NotificationPreferences {
  readonly campaignUpdates:           boolean;
  readonly milestoneCompletions:      boolean;
  readonly contributionConfirmations: boolean;
  readonly recommendations:           boolean;
  readonly securityAlerts:            true;  // Always true — not a generic boolean
  readonly platformAnnouncements:     boolean;
}
```

`securityAlerts` is typed as literal `true` — the type system makes it impossible to set it to `false`.

Static method:

```typescript
static defaults(): NotificationPreferences
```

Returns:
```typescript
{
  campaignUpdates:           true,
  milestoneCompletions:      true,
  contributionConfirmations: true,
  recommendations:           true,
  securityAlerts:            true,
  platformAnnouncements:     false,
}
```

Serialisation: JSONB column uses snake_case keys. Domain VO uses camelCase. The repository adapter is responsible for the conversion.

**JSONB key mapping (DB → Domain):**

| DB key (`JSONB`) | Domain property (`NotificationPreferences`) |
|------------------|---------------------------------------------|
| `campaign_updates` | `campaignUpdates` |
| `milestone_completions` | `milestoneCompletions` |
| `contribution_confirmations` | `contributionConfirmations` |
| `recommendations` | `recommendations` |
| `security_alerts` | `securityAlerts` |
| `platform_announcements` | `platformAnnouncements` |

---

### Domain Errors

**File:** `packages/backend/src/account/domain/errors/account-errors.ts`

All domain errors extend a base `DomainError` class:

```typescript
abstract class DomainError extends Error {
  abstract readonly code: string;
}
```

| Error Class | `code` | When Thrown |
|-------------|--------|-------------|
| `InvalidClerkUserIdError` | `INVALID_CLERK_USER_ID` | `create()` — empty `clerkUserId` |
| `InvalidEmailError` | `INVALID_EMAIL` | `create()` — malformed email |
| `DisplayNameTooLongError` | `DISPLAY_NAME_TOO_LONG` | `create()` / `updateProfile()` — > 255 chars |
| `BioTooLongError` | `BIO_TOO_LONG` | `create()` / `updateProfile()` — > 500 chars |
| `InvalidAvatarUrlError` | `INVALID_AVATAR_URL` | `create()` / `updateProfile()` — not a valid absolute URL |
| `AlreadyActiveError` | `ALREADY_ACTIVE` | `activate()` — user is already `Active` |
| `SuperAdminAssignmentForbiddenError` | `SUPER_ADMIN_ASSIGNMENT_FORBIDDEN` | `assignRole()` — attempt to assign `SuperAdministrator` |
| `CannotRemoveBackerRoleError` | `CANNOT_REMOVE_BACKER_ROLE` | `removeRole()` — Backer is the only remaining role |
| `RoleNotAssignedError` | `ROLE_NOT_ASSIGNED` | `removeRole()` — user does not have the role |
| `SecurityAlertsCannotBeDisabledError` | `SECURITY_ALERTS_MANDATORY` | `updateNotificationPrefs()` — `securityAlerts: false` |
| `UserNotFoundError` | `USER_NOT_FOUND` | Repository — user lookup returns null |
| `UserAlreadyExistsError` | `USER_ALREADY_EXISTS` | Upsert conflict — should not surface; handled by ON CONFLICT |




























