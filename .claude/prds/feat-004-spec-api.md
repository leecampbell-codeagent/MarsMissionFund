# PRD: feat-004 — Port Interfaces, Application Service & API Endpoints

> Sub-file 2 of 3. Part of `feat-004-spec.md`.
> Contents: Port interfaces, mock adapter behaviour, application service, API endpoint contracts.

---

## Port Interfaces

### Extended `CampaignRepository`

**File:** `packages/backend/src/campaign/ports/campaign-repository.port.ts`

Add the following methods to the existing `CampaignRepository` interface.
Do NOT modify existing methods.

```typescript
import type {
  PublicSearchOptions,
  PublicSearchResult,
} from '../application/campaign-app-service.js';
import type { CampaignCategory } from '../domain/value-objects/campaign-category.js';
import type { CategoryStats, PublicCampaignDetail } from '../application/campaign-app-service.js';

// Append to existing CampaignRepository interface:
export interface CampaignRepository {
  // ... existing methods unchanged ...

  /**
   * Full-text search with filters, sort, and pagination.
   * Returns only campaigns with status IN ('live', 'funded').
   * Joins users table for creatorName.
   * Creator name matched via to_tsvector at query time (G-038).
   */
  searchPublicCampaigns(options: PublicSearchOptions): Promise<PublicSearchResult>;

  /**
   * Returns a single public campaign by ID.
   * Returns null if the campaign does not exist OR if its status is not 'live' or 'funded'.
   * Used by public detail endpoint — never leaks non-public campaign existence.
   */
  findPublicById(id: string): Promise<PublicCampaignDetail | null>;

  /**
   * Aggregate stats for a single category.
   * campaignCount: COUNT of live+funded campaigns in the category.
   * activeCampaignCount: COUNT of live campaigns in the category.
   * totalRaisedCents: '0' (stub — no contributions table in feat-004).
   * contributorCount: 0 (stub).
   */
  getCategoryStats(category: CampaignCategory): Promise<CategoryStats>;
}
```

**Method contracts:**

| Method | Params | Returns | Notes |
|--------|--------|---------|-------|
| `searchPublicCampaigns` | `options: PublicSearchOptions` | `Promise<PublicSearchResult>` | FTS + filter + sort + pagination. Returns `{ items, total }`. `total` is the count without pagination applied (for pagination UI). |
| `findPublicById` | `id: string` | `Promise<PublicCampaignDetail \| null>` | Returns `null` for non-existent OR non-public status. Never throws NOT_FOUND — caller handles null. |
| `getCategoryStats` | `category: CampaignCategory` | `Promise<CategoryStats>` | Aggregate query. Never returns null — zero counts are valid. |

---

### SQL Implementation Guidance

#### `searchPublicCampaigns` query

```sql
SELECT
  c.id,
  c.title,
  c.short_description,
  c.category,
  c.hero_image_url,
  c.status,
  c.funding_goal_cents::TEXT AS funding_goal_cents,
  c.deadline,
  c.launched_at,
  u.display_name AS creator_name,
  ts_rank(c.search_vector, websearch_to_tsquery('english', $1)) AS rank
FROM campaigns c
JOIN users u ON c.creator_user_id = u.id
WHERE c.status IN ('live', 'funded')
  -- Status filter
  AND (
    $2::TEXT IS NULL OR (
      CASE $2::TEXT
        WHEN 'active'      THEN c.status = 'live'
        WHEN 'funded'      THEN c.status = 'funded'
        WHEN 'ending_soon' THEN c.status IN ('live', 'funded')
                                AND c.deadline <= NOW() + INTERVAL '7 days'
                                AND c.deadline >= NOW()
        ELSE TRUE
      END
    )
  )
  -- Category filter (multi-value)
  AND ($3::TEXT[] IS NULL OR c.category = ANY($3::TEXT[]))
  -- Full-text search guard (G-037)
  AND (
    $1 = ''
    OR c.search_vector @@ websearch_to_tsquery('english', $1)
    OR to_tsvector('english', COALESCE(u.display_name, '')) @@ websearch_to_tsquery('english', $1)
  )
ORDER BY
  CASE WHEN $4::TEXT = 'newest'      THEN NULL END DESC,
  CASE WHEN $4::TEXT = 'newest'      THEN c.launched_at END DESC NULLS LAST,
  CASE WHEN $4::TEXT = 'ending_soon' THEN c.deadline END ASC NULLS LAST,
  CASE WHEN $4::TEXT = 'most_funded' THEN c.funding_goal_cents END DESC NULLS LAST,
  CASE WHEN $4::TEXT = 'least_funded' THEN c.funding_goal_cents END ASC NULLS LAST,
  -- Default sort: relevance when q present, newest otherwise
  CASE WHEN $1 != '' AND $4::TEXT IS NULL THEN ts_rank(c.search_vector, websearch_to_tsquery('english', $1)) END DESC,
  c.launched_at DESC NULLS LAST
LIMIT $5 OFFSET $6
```

Parameters: `[$1: q, $2: statusFilter|null, $3: categories[]|null, $4: sort|null, $5: limit, $6: offset]`

The total count query uses the same WHERE clause with `COUNT(*)` and no LIMIT/OFFSET.

#### `findPublicById` query

```sql
SELECT
  c.id,
  c.title,
  c.short_description,
  c.description,
  c.category,
  c.hero_image_url,
  c.status,
  c.funding_goal_cents::TEXT AS funding_goal_cents,
  c.funding_cap_cents::TEXT AS funding_cap_cents,
  c.deadline,
  c.launched_at,
  c.milestones,
  c.team_members,
  c.risk_disclosures,
  c.budget_breakdown,
  c.alignment_statement,
  c.tags,
  u.display_name AS creator_name
FROM campaigns c
JOIN users u ON c.creator_user_id = u.id
WHERE c.id = $1
  AND c.status IN ('live', 'funded')
```

Returns `null` (no row) for non-existent or non-public campaigns.

#### `getCategoryStats` query

```sql
SELECT
  COUNT(*) FILTER (WHERE status IN ('live', 'funded')) AS campaign_count,
  COUNT(*) FILTER (WHERE status = 'live') AS active_campaign_count
FROM campaigns
WHERE category = $1
```

---

### In-Memory Adapter

**File:** `packages/backend/src/campaign/adapters/in-memory-campaign-repository.adapter.ts`

Add implementations for the three new methods to the existing `InMemoryCampaignRepository`.

**`searchPublicCampaigns` in-memory behaviour:**
- Filter campaigns by `status IN ['live', 'funded']`
- If `options.q` is non-empty, filter by `title.toLowerCase().includes(q.toLowerCase())` or `description?.toLowerCase().includes(q.toLowerCase())`
  (simplified FTS for in-memory — sufficient for unit tests)
- Apply `status` filter per mapping: `active` → `live`, `funded` → `funded`, `ending_soon` → deadline within 7 days
- Apply `categories` filter: `category in options.categories`
- Apply sort: `newest` = by `launchedAt DESC`, `ending_soon` = by `deadline ASC`, `most_funded`/`least_funded` = by `fundingGoalCents DESC/ASC`
- Apply pagination: `items = sorted.slice(offset, offset + limit)`, `total = sorted.length`
- `creatorName` = `null` for all items (no user lookup in in-memory adapter — use `null`)
- `totalRaisedCents = '0'`, `contributorCount = 0`, `fundingPercentage = 0` (or `null` if goal is null)

**`findPublicById` in-memory behaviour:**
- Find campaign by id where `status IN ['live', 'funded']`
- Return `null` if not found or status not public
- Map all fields including JSONB arrays; set `creatorName: null`, `totalRaisedCents: '0'`, `contributorCount: 0`, `fundingPercentage: 0`

**`getCategoryStats` in-memory behaviour:**
- Filter by `category = category AND status IN ['live', 'funded']`
- Return `{ category, campaignCount, activeCampaignCount, totalRaisedCents: '0', contributorCount: 0 }`

---

## Zod Schemas

### `publicCampaignSearchSchema`

**File:** `packages/backend/src/campaign/api/schemas/public-campaign-search.schema.ts`

```typescript
import { z } from 'zod';
import { CAMPAIGN_CATEGORIES } from '../../domain/value-objects/campaign-category.js';

export const PUBLIC_SORT_OPTIONS = ['newest', 'ending_soon', 'most_funded', 'least_funded'] as const;
export const PUBLIC_STATUS_FILTERS = ['active', 'funded', 'ending_soon'] as const;

export const publicCampaignSearchSchema = z.object({
  q: z
    .string()
    .max(200, 'Search term must not exceed 200 characters')
    .optional()
    .transform((v) => v?.trim() ?? ''),
  category: z
    .union([
      z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]]),
      z.array(z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]])),
    ])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return Array.isArray(v) ? v : [v];
    }),
  status: z.enum(PUBLIC_STATUS_FILTERS).optional(),
  sort: z.enum(PUBLIC_SORT_OPTIONS).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'limit must not exceed 100')),
  offset: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : 0))
    .pipe(z.number().int().min(0, 'offset must be non-negative')),
});

export type PublicCampaignSearchQuery = z.infer<typeof publicCampaignSearchSchema>;
```

Note: Express parses multi-value query params (`?category=propulsion&category=power_energy`) as
an array. The Zod schema handles both single string and array forms.

### `categoryStatsQuerySchema`

Inline in the router or in the same schema file:

```typescript
export const categoryStatsQuerySchema = z.object({
  category: z.enum(CAMPAIGN_CATEGORIES as [string, ...string[]], {
    required_error: 'category is required',
    invalid_type_error: 'category must be one of the valid campaign categories',
  }),
});
```

---

## Application Service Methods

**File:** `packages/backend/src/campaign/application/campaign-app-service.ts`

Add the following three methods to the existing `CampaignAppService` class.
These methods have NO auth parameters — they are public by design.
They perform no KYC checks, role checks, or ownership checks.

### `searchPublicCampaigns`

```typescript
async searchPublicCampaigns(
  options: PublicSearchOptions
): Promise<PublicSearchResult>
```

**Orchestration:**

1. Delegate directly to `this.campaignRepository.searchPublicCampaigns(options)`
2. Return the result unchanged — no domain logic required for read-only public search
3. No auth checks, no role checks, no KYC checks

**Error handling:**
- Repository errors propagate as 500 (no domain-level errors expected for this read operation)

### `getPublicCampaign`

```typescript
async getPublicCampaign(campaignId: string): Promise<PublicCampaignDetail>
```

**Orchestration:**

1. Call `this.campaignRepository.findPublicById(campaignId)`
2. If result is `null`, throw `CampaignNotFoundError` (maps to 404)
3. Return the `PublicCampaignDetail`

**Error handling:**
- `null` result → throw `CampaignNotFoundError` → controller returns `404 NOT_FOUND`
- Both "campaign does not exist" and "campaign is not publicly visible" return `CampaignNotFoundError` — do not distinguish (security: do not reveal existence of non-public campaigns)

### `getCategoryStats`

```typescript
async getCategoryStats(category: CampaignCategory): Promise<CategoryStats>
```

**Orchestration:**

1. Validate that `category` is a valid `CampaignCategory` value (Zod handles this at the controller layer; service trusts validated input)
2. Delegate to `this.campaignRepository.getCategoryStats(category)`
3. Return the result

**Error handling:**
- Invalid category value is caught by Zod before reaching the service
- Repository errors propagate as 500

---

## API Endpoints

### Router

**File:** `packages/backend/src/campaign/api/public-campaign-router.ts`

**Mount point in `app.ts`:** `app.use('/api/v1/public/campaigns', createPublicCampaignRouter(...))`

IMPORTANT: This router must be mounted WITHOUT `requireAuth`. `clerkMiddleware()` is already global
and will populate `req.auth` for all requests; the public router ignores it. (G-036)

Route registration order (G-023):
1. `GET /stats` — literal path before `/:id`
2. `GET /` — search/browse list
3. `GET /:id` — parameterised detail

```typescript
export function createPublicCampaignRouter(
  campaignAppService: CampaignAppService,
  logger: Logger,
): Router
```

---

### `GET /api/v1/public/campaigns`

**Description:** Search and browse public campaigns with full-text search, filters, and pagination.
**Auth:** None required. `clerkMiddleware()` is global but this route does not call `requireAuth`.
**Rate limiting:** Standard rate limiting applies (global Express rate limiter).

**Query parameters:**

| Param | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `q` | `string` | No | `''` | Max 200 chars. Trimmed. Empty = no FTS filter. |
| `category` | `string \| string[]` | No | none | One or more values from `CAMPAIGN_CATEGORIES`. Multi-value via repeated param. |
| `status` | `'active' \| 'funded' \| 'ending_soon'` | No | none | Enum. |
| `sort` | `'newest' \| 'ending_soon' \| 'most_funded' \| 'least_funded'` | No | `'newest'` | Enum. |
| `limit` | `integer` | No | `20` | Min 1, max 100. |
| `offset` | `integer` | No | `0` | Min 0. |

**Validation:** Use `publicCampaignSearchSchema` on `req.query`. Failure returns `400 VALIDATION_ERROR`.

**Success response:** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "shortDescription": "string | null",
      "category": "string | null",
      "heroImageUrl": "string | null",
      "status": "live | funded",
      "fundingGoalCents": "string | null",
      "totalRaisedCents": "0",
      "contributorCount": 0,
      "fundingPercentage": 0.00,
      "deadline": "ISO8601 UTC string | null",
      "daysRemaining": "integer | null",
      "launchedAt": "ISO8601 UTC string | null",
      "creatorName": "string | null"
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

**Field notes:**
- `fundingGoalCents`: BIGINT returned as string (G-024). Null if not set.
- `totalRaisedCents`: Always `'0'` in feat-004 (stub). String (G-024).
- `contributorCount`: Always `0` in feat-004 (stub). Integer.
- `fundingPercentage`: `null` when `fundingGoalCents` is null; otherwise `(totalRaisedCents / fundingGoalCents) * 100`. In feat-004 this is always `0.00` (since `totalRaisedCents = '0'`). Number (not string).
- `daysRemaining`: Computed by the serializer: `ceil((deadline_ms - now_ms) / (1000 * 60 * 60 * 24))`. `null` when `deadline` is null. Value of `0` means deadline has passed or is today.
- `creatorName`: `users.display_name`. Null if display_name is null.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| `400` | `VALIDATION_ERROR` | Query param fails Zod validation (invalid category, sort, limit, offset) |
| `500` | `INTERNAL_ERROR` | Unexpected database error |

---

### `GET /api/v1/public/campaigns/stats`

**Description:** Aggregate statistics for a single campaign category.
**Auth:** None required.

**Query parameters:**

| Param | Type | Required | Validation |
|-------|------|----------|------------|
| `category` | `string` | Yes | Must be one of `CAMPAIGN_CATEGORIES`. |

**Validation:** Use `categoryStatsQuerySchema` on `req.query`. Missing or invalid category returns `400 VALIDATION_ERROR`.

**Success response:** `200 OK`

```json
{
  "data": {
    "category": "propulsion",
    "campaignCount": 12,
    "activeCampaignCount": 8,
    "totalRaisedCents": "0",
    "contributorCount": 0
  }
}
```

**Field notes:**
- `campaignCount`: Count of `live` + `funded` campaigns in the category.
- `activeCampaignCount`: Count of `live` campaigns in the category.
- `totalRaisedCents`: Always `'0'` in feat-004. String (G-024). Stub pending feat-005.
- `contributorCount`: Always `0` in feat-004. Integer. Stub pending feat-005.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| `400` | `VALIDATION_ERROR` | Missing `category` or invalid category value |
| `500` | `INTERNAL_ERROR` | Unexpected database error |

---

### `GET /api/v1/public/campaigns/:id`

**Description:** Full public detail for a single live or funded campaign.
**Auth:** None required.

**Path parameters:**
- `id` — UUID string. Any non-UUID format returns `404 NOT_FOUND` (do not return 400 for malformed IDs on public endpoints — security: do not distinguish malformed from non-existent).

**Validation:** None beyond extracting `req.params.id` as a string. PostgreSQL will reject non-UUID
format gracefully and return no rows.

**Success response:** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "title": "string",
    "shortDescription": "string | null",
    "description": "string | null",
    "category": "string | null",
    "heroImageUrl": "string | null",
    "status": "live | funded",
    "fundingGoalCents": "string | null",
    "fundingCapCents": "string | null",
    "totalRaisedCents": "0",
    "contributorCount": 0,
    "fundingPercentage": 0.00,
    "deadline": "ISO8601 UTC string | null",
    "daysRemaining": "integer | null",
    "launchedAt": "ISO8601 UTC string | null",
    "creatorName": "string | null",
    "milestones": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "fundingBasisPoints": 5000,
        "targetDate": "YYYY-MM-DD | null"
      }
    ],
    "teamMembers": [
      {
        "id": "uuid",
        "name": "string",
        "role": "string",
        "bio": "string | null"
      }
    ],
    "riskDisclosures": [
      {
        "id": "uuid",
        "risk": "string",
        "mitigation": "string"
      }
    ],
    "budgetBreakdown": [
      {
        "id": "uuid",
        "category": "string",
        "description": "string",
        "estimatedCents": "string",
        "notes": "string | undefined"
      }
    ],
    "alignmentStatement": "string | null",
    "tags": ["string"]
  }
}
```

**Field notes:**
- All fields same as list endpoint plus full content fields.
- `milestones`, `teamMembers`, `riskDisclosures`, `budgetBreakdown`: full JSONB arrays — no truncation.
- `budgetBreakdown[].estimatedCents`: BIGINT as string (G-024).
- `milestones[].fundingBasisPoints`: integer; frontend displays as `(basisPoints / 100).toFixed(2) + '%'`.

**Error responses:**

| Status | Code | When |
|--------|------|------|
| `404` | `NOT_FOUND` | Campaign does not exist OR campaign status is not `live` or `funded` |
| `500` | `INTERNAL_ERROR` | Unexpected database error |

---

## Serializer

**File:** `packages/backend/src/campaign/api/public-campaign-serializer.ts`

### `serializePublicCampaignListItem`

```typescript
export function serializePublicCampaignListItem(
  item: PublicCampaignListItem,
  now: Date,
): Record<string, unknown>
```

Computes `daysRemaining` from `item.deadline` and `now`:

```typescript
function computeDaysRemaining(deadline: Date | null, now: Date): number | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}
```

Returns:
```typescript
{
  id: item.id,
  title: item.title,
  shortDescription: item.shortDescription,
  category: item.category,
  heroImageUrl: item.heroImageUrl,
  status: item.status,
  fundingGoalCents: item.fundingGoalCents,     // string | null
  totalRaisedCents: item.totalRaisedCents,     // '0'
  contributorCount: item.contributorCount,     // 0
  fundingPercentage: item.fundingPercentage,   // 0.00 | null
  deadline: item.deadline?.toISOString() ?? null,
  daysRemaining: computeDaysRemaining(item.deadline, now),
  launchedAt: item.launchedAt?.toISOString() ?? null,
  creatorName: item.creatorName,               // string | null
}
```

### `serializePublicCampaignDetail`

```typescript
export function serializePublicCampaignDetail(
  detail: PublicCampaignDetail,
  now: Date,
): Record<string, unknown>
```

Returns all fields from `serializePublicCampaignListItem` plus:
```typescript
{
  ...serializePublicCampaignListItem(detail, now),
  description: detail.description,
  fundingCapCents: detail.fundingCapCents,
  milestones: detail.milestones,
  teamMembers: detail.teamMembers,
  riskDisclosures: detail.riskDisclosures,
  budgetBreakdown: detail.budgetBreakdown,
  alignmentStatement: detail.alignmentStatement,
  tags: detail.tags,
}
```

### `serializeCategoryStats`

```typescript
export function serializeCategoryStats(stats: CategoryStats): Record<string, unknown>
```

Returns:
```typescript
{
  category: stats.category,
  campaignCount: stats.campaignCount,
  activeCampaignCount: stats.activeCampaignCount,
  totalRaisedCents: stats.totalRaisedCents,   // '0'
  contributorCount: stats.contributorCount,   // 0
}
```

---

## `app.ts` Changes

**File:** `packages/backend/src/app.ts`

Add the public campaigns router mount point.
It must be mounted WITHOUT `requireAuth` and WITHOUT `clerkMiddleware` (clerkMiddleware is already global).

```typescript
// Existing authenticated routes — UNCHANGED
app.use('/api/v1/campaigns', requireAuth, createCampaignRouter(...));

// NEW: Anonymous public routes — no requireAuth
app.use('/api/v1/public/campaigns', createPublicCampaignRouter(campaignAppService, logger));
```

The `/api/v1/public/campaigns` route must be registered AFTER `/health` but order relative to
`/api/v1/campaigns` does not matter (they have different prefixes).

---

## `composition-root.ts` Changes

**File:** `packages/backend/src/composition-root.ts`

The `CampaignAppService` instance already exists.
Pass it to `createPublicCampaignRouter` when setting up `app.ts`.
No new service instances needed — the three new methods are on the existing service.

---

## Error Handling

The existing error-handler middleware maps domain errors to HTTP responses.
`CampaignNotFoundError` already maps to `404 NOT_FOUND`.
No new error codes are introduced for feat-004.

```
CampaignNotFoundError → 404 { error: { code: 'NOT_FOUND', message: 'Campaign not found' } }
ValidationError (Zod) → 400 { error: { code: 'VALIDATION_ERROR', message: '...', details: [...] } }
```
