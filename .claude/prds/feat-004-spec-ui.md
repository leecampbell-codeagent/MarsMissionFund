# PRD: feat-004 — Frontend Specification, Edge Cases & Testing

> Sub-file 3 of 3. Part of `feat-004-spec.md`.
> Contents: Frontend functional requirements, components, state management, edge cases, testing requirements.

---

## Frontend Specification

### New API Client

**File:** `packages/frontend/src/api/public-campaign-api.ts`

Follows the pattern of `packages/frontend/src/api/campaign-api.ts`.
These functions use the UNAUTHENTICATED API client (no Clerk JWT required).
Create a `publicClient` helper or call `fetch` directly without the Authorization header.

```typescript
export interface PublicCampaignSearchParams {
  readonly q?: string;
  readonly category?: string | string[];
  readonly status?: 'active' | 'funded' | 'ending_soon';
  readonly sort?: 'newest' | 'ending_soon' | 'most_funded' | 'least_funded';
  readonly limit?: number;
  readonly offset?: number;
}

export interface PublicCampaignListItem {
  readonly id: string;
  readonly title: string;
  readonly shortDescription: string | null;
  readonly category: string | null;
  readonly heroImageUrl: string | null;
  readonly status: 'live' | 'funded';
  readonly fundingGoalCents: string | null;    // string — never parse to Number (G-024)
  readonly totalRaisedCents: string;           // string — never parse to Number (G-024)
  readonly contributorCount: number;
  readonly fundingPercentage: number | null;
  readonly deadline: string | null;            // ISO 8601 UTC string
  readonly daysRemaining: number | null;
  readonly launchedAt: string | null;          // ISO 8601 UTC string
  readonly creatorName: string | null;
}

export interface PublicCampaignDetail extends PublicCampaignListItem {
  readonly description: string | null;
  readonly fundingCapCents: string | null;     // string — never parse to Number (G-024)
  readonly milestones: Milestone[];
  readonly teamMembers: TeamMember[];
  readonly riskDisclosures: RiskDisclosure[];
  readonly budgetBreakdown: BudgetItem[];
  readonly alignmentStatement: string | null;
  readonly tags: string[];
}

export interface PaginatedCampaigns {
  readonly data: PublicCampaignListItem[];
  readonly pagination: {
    readonly total: number;
    readonly limit: number;
    readonly offset: number;
  };
}

export interface CategoryStats {
  readonly category: string;
  readonly campaignCount: number;
  readonly activeCampaignCount: number;
  readonly totalRaisedCents: string;   // Always '0' in feat-004
  readonly contributorCount: number;   // Always 0 in feat-004
}

export async function searchPublicCampaigns(
  params: PublicCampaignSearchParams,
): Promise<PaginatedCampaigns>

export async function getPublicCampaign(id: string): Promise<PublicCampaignDetail>

export async function getCategoryStats(category: string): Promise<{ data: CategoryStats }>
```

Note: The `Milestone`, `TeamMember`, `RiskDisclosure`, and `BudgetItem` types must match the
backend domain model exactly (G-034). Import from or align with `packages/frontend/src/types/campaign.ts`:
- `Milestone`: `{ id, title, description, fundingBasisPoints: number, targetDate: string | null }`
- `TeamMember`: `{ id, name, role, bio: string | null }`
- `RiskDisclosure`: `{ id, risk, mitigation }`
- `BudgetItem`: `{ id, category, description, estimatedCents: string, notes?: string }`

**Monetary display helpers** (add to `packages/frontend/src/utils/format.ts` or equivalent):

```typescript
// Display cents as dollars (string → display string)
export function formatCents(cents: string): string {
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
}

// Display basis points as percentage string
export function formatBasisPoints(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}%`;
}

// Display funding progress percentage
export function formatFundingPercentage(percentage: number | null): string {
  if (percentage === null) return 'N/A';
  return `${percentage.toFixed(0)}%`;
}
```

---

### Pages

#### Campaign Discovery Page (Search & Browse)

**Route:** `/campaigns`
**Auth:** Not required — page is accessible to anonymous users
**File:** `packages/frontend/src/pages/CampaignDiscoveryPage.tsx` (default export for routing)

**Data requirements:**
- TanStack Query: `useQuery` keyed on `['publicCampaigns', searchParams]` calling `searchPublicCampaigns(params)`
- URL state: all filter/sort/pagination state stored in URL search params (React Router `useSearchParams`)
- No server-side state mutation (read-only page)

**Functional requirements:**

1. **Search input**: Free-text input bound to `q` URL param. Debounced (300ms) before triggering a new query. Clearing the input clears the `q` param.
2. **Category filter**: Multi-select control bound to `category` URL param (multi-value). Selecting/deselecting categories updates the URL and triggers a new query. Displays human-readable category names (map from value to label, see label map below).
3. **Status filter**: Single-select bound to `status` URL param. Options: "All", "Active", "Funded", "Ending Soon".
4. **Sort control**: Single-select bound to `sort` URL param. Options: "Newest", "Ending Soon", "Most Funded", "Least Funded". Default when not set: "Newest".
5. **Campaign list**: Renders `<CampaignCard>` components for each item in `data.data`. Handle loading state (skeleton cards), empty state ("No campaigns found matching your search"), and error state ("Unable to load campaigns. Please try again.").
6. **Pagination**: "Load More" button or page navigation. Clicking "Load More" increments `offset` by current `limit` and merges new results into existing list. Alternatively, show page numbers using `pagination.total` and `pagination.limit`.
7. **URL round-trip**: All filter/sort/pagination state must survive page refresh and be shareable as a URL.
8. **Total count display**: Show "N campaigns found" using `pagination.total` from the response.
9. **Category browse shortcut**: The URL `/campaigns?category=propulsion` is a valid category browse URL; the category filter is pre-selected.

**Category label map** (value → display label):

| Value | Display Label |
|-------|--------------|
| `propulsion` | Propulsion |
| `entry_descent_landing` | Entry, Descent & Landing |
| `power_energy` | Power & Energy |
| `habitats_construction` | Habitats & Construction |
| `life_support_crew_health` | Life Support & Crew Health |
| `food_water_production` | Food & Water Production |
| `in_situ_resource_utilisation` | In-Situ Resource Utilisation |
| `radiation_protection` | Radiation Protection |
| `robotics_automation` | Robotics & Automation |
| `communications_navigation` | Communications & Navigation |

**State management:**
- `useSearchParams()` for URL-backed filter state
- `useQuery(['publicCampaigns', params], () => searchPublicCampaigns(params))` with `staleTime: 30_000` (30 seconds)
- Local state: search input value (controlled, debounced before writing to URL param)
- No global state needed

---

#### Campaign Detail Page

**Route:** `/campaigns/:id`
**Auth:** Not required — page is accessible to anonymous users
**File:** `packages/frontend/src/pages/CampaignDetailPage.tsx` (default export for routing)

**Data requirements:**
- TanStack Query: `useQuery(['publicCampaign', id], () => getPublicCampaign(id))` with `staleTime: 30_000`
- On 404 response (campaign not found or not public): render a `NotFoundMessage` component with link back to `/campaigns`
- No mutations (read-only page in feat-004 — contribution action is feat-005)

**Functional requirements:**

1. **Hero section**: Display `heroImageUrl` as a full-width hero image. If `heroImageUrl` is null, render a placeholder image (use CSS gradient background from `--gradient-surface-card` — not a broken `<img>`).
2. **Campaign header**: Display `title` (using `--font-display` / Bebas Neue, uppercase), `category` badge (label from category map), `status` badge ("Live" or "Fully Funded"), `creatorName` (display "Creator" if null).
3. **Funding progress section**: Display:
   - Progress bar: width = `Math.min(fundingPercentage ?? 0, 100)%`. If `fundingPercentage` is null, show progress bar at 0%.
   - Percentage text: `formatFundingPercentage(fundingPercentage)` (e.g., "0%" in feat-004 stub)
   - Amount raised: `formatCents(totalRaisedCents)` (e.g., "$0.00" in feat-004 stub)
   - Goal: `formatCents(fundingGoalCents)` if not null, otherwise "Goal TBD"
   - Contributor count: `N backers` (0 in feat-004 stub)
   - Days remaining: `daysRemaining !== null ? "${daysRemaining} days left" : "No deadline"`. If `daysRemaining === 0`, display "Last day!"
4. **CTA button**: "Back This Mission" button linking to the contribution flow (feat-005 route `/campaigns/:id/contribute`). In feat-004, this button is rendered but disabled or links to a placeholder — the contribution page does not exist yet. The button uses `--gradient-action-primary` (primary CTA per brand spec). One primary CTA per viewport.
   - Button state for `funded` campaign: remains active (funded campaigns continue accepting contributions per L4-002 Section 7.4). In feat-004 with stub data, the cap is never reached.
5. **Description section**: Render `description` as plain text with `white-space: pre-wrap` (G-028). If null, do not render the section.
6. **Milestones section**: Render each milestone as a card: `title`, `description`, `fundingBasisPoints` displayed as `formatBasisPoints(fundingBasisPoints)`, `targetDate` if non-null. If `milestones` is empty array, render "No milestones defined."
7. **Team section**: Render each team member: `name`, `role`, `bio` (if non-null). Minimum one member guaranteed at submission. If `teamMembers` is empty (data anomaly), render "Team information unavailable."
8. **Risk Disclosures section**: Render each disclosure: `risk`, `mitigation`. If `riskDisclosures` is empty (data anomaly), do not render the section.
9. **Alignment Statement section**: Display `alignmentStatement` if non-null. Label: "Mars Mission Alignment". If null, do not render.
10. **Tags**: Display `tags` as badges if non-empty. If empty, do not render.
11. **Loading state**: Skeleton layout (title, hero, progress bar placeholders) while query is loading.
12. **Error state**: Generic error message "Unable to load this campaign. Please try again." with retry button.

**State management:**
- `useParams()` for `id`
- `useQuery` for campaign data
- No local state beyond query state

---

#### Category Stats (Inline on Discovery Page)

The category stats endpoint (`GET /api/v1/public/campaigns/stats?category=X`) is consumed
when a single category is selected in the filter.

**File:** `packages/frontend/src/components/CategoryStatsBar.tsx`

**Data requirements:**
- TanStack Query: `useQuery(['categoryStats', category], () => getCategoryStats(category), { enabled: !!category })`
- Only fetched when exactly one category is selected (multi-category selection shows no stats bar)

**Functional requirements:**
1. When one category is selected in the filter, display a stats bar below the filter controls showing:
   - Category name (from label map)
   - Total campaigns: `data.campaignCount`
   - Active campaigns: `data.activeCampaignCount`
   - Total raised: `formatCents(data.totalRaisedCents)` (displays "$0.00" in feat-004 stub)
2. When multiple categories are selected or none is selected, do not render the stats bar.
3. Loading state: show a skeleton bar.

---

### New Components

#### `<CampaignCard>`

**File:** `packages/frontend/src/components/CampaignCard.tsx`

```typescript
interface CampaignCardProps {
  readonly campaign: PublicCampaignListItem;
}
```

**Renders:**
- Hero image (with null placeholder handling)
- Title (truncated to 2 lines via CSS `line-clamp`)
- Short description (truncated to 2 lines, omitted if null)
- Category badge
- Status badge: "Live" for `live`, "Fully Funded" for `funded`
- "Ending Soon" badge: shown when `daysRemaining !== null && daysRemaining <= 7 && campaign.status === 'live'`
- Funding progress bar: `Math.min(fundingPercentage ?? 0, 100)%` width
- `formatCents(totalRaisedCents)` raised of `formatCents(fundingGoalCents)` goal
- Days remaining: `daysRemaining` days left (or "Last day!" for 0, "Closed" if deadline passed and status is funded)
- Creator name: "by [creatorName]" (display "by Creator" if null)
- Clickable — entire card links to `/campaigns/:id`

**Handles all states:**
- Normal: all fields present
- No hero image: CSS gradient placeholder
- Null `shortDescription`: title only
- Null `fundingGoalCents`: no goal amount shown; progress bar at 0%
- Null `daysRemaining`: no days remaining shown
- `fundingPercentage > 100`: progress bar renders at 100% width (capped visually) but text shows actual percentage

#### `<FundingProgressBar>`

**File:** `packages/frontend/src/components/FundingProgressBar.tsx`

```typescript
interface FundingProgressBarProps {
  readonly fundingPercentage: number | null;
  readonly totalRaisedCents: string;
  readonly fundingGoalCents: string | null;
  readonly contributorCount: number;
}
```

**Renders:**
- Progress bar element: `width: Math.min(percentage, 100)%` — visual cap at 100%
- Text: `formatCents(totalRaisedCents)` raised
- Text: `formatFundingPercentage(fundingPercentage)` of `formatCents(fundingGoalCents)` goal
- Text: `contributorCount` backers
- Uses `--color-status-success` for funded (100%+) progress fill; `--gradient-action-primary` for active progress fill

#### `<CampaignStatusBadge>`

**File:** `packages/frontend/src/components/CampaignStatusBadge.tsx`

```typescript
interface CampaignStatusBadgeProps {
  readonly status: 'live' | 'funded';
  readonly daysRemaining?: number | null;
}
```

**Renders:**
- `funded` → "Fully Funded" badge in `--color-status-success`
- `live` with `daysRemaining <= 7` → "Ending Soon" badge in `--color-status-warning`
- `live` otherwise → "Live" badge

---

## React Router Setup

**File:** `packages/frontend/src/router.tsx` (or equivalent routing config)

Add routes:
```typescript
{ path: '/campaigns', element: <CampaignDiscoveryPage /> }
{ path: '/campaigns/:id', element: <CampaignDetailPage /> }
```

These routes do NOT require authentication wrappers (no `<ProtectedRoute>` or equivalent).
If the existing router uses a protected layout, these routes must be outside that layout.

---

## Edge Cases

All edge cases from the research document with defined expected behaviour:

| # | Scenario | Expected Behaviour | Layer | Test Type |
|---|----------|--------------------|-------|-----------|
| 1 | `funding_goal_cents = null` on live campaign | Backend: `fundingPercentage: null`. Frontend: progress bar at 0%, no goal amount shown. | Backend + Frontend | Unit |
| 2 | `deadline = null` on live campaign | Backend: `daysRemaining: null`. Frontend: "No deadline" text shown. | Serializer + Frontend | Unit |
| 3 | `hero_image_url = null` | Frontend: render CSS gradient placeholder, not a broken `<img>` | Frontend | Component |
| 4 | `milestones = []` (empty array) | Frontend: render "No milestones defined." text — no empty list | Frontend | Component |
| 5 | `short_description = null` | Search result card renders title only, no crash | Frontend | Component |
| 6 | `title` at maximum 200 chars | Card handles text overflow via `line-clamp` CSS — no layout break | Frontend | Component |
| 7 | Search term with SQL special chars (`%`, `_`, `'`, `\`) | Parameterised query protects against SQL injection. `websearch_to_tsquery` handles these safely. | Backend | Integration |
| 8 | Search term with only whitespace | Trimmed to `''` by Zod transform. Treated as empty — returns all campaigns sorted by newest. | Backend | Integration |
| 9 | Search term that matches no campaigns | `200 OK` with `{ "data": [], "pagination": { "total": 0 } }` — not 404 | Backend | Integration |
| 10 | Category value not in 10-category enum | `400 VALIDATION_ERROR` from Zod. Error message names the invalid value. | Backend | Integration |
| 11 | `total_raised_cents` equals `funding_goal_cents` (future state) | Status is the source of truth for "Fully Funded" badge, not percentage. Percentage may be 100 while status is still `live`. | Domain + Frontend | Unit |
| 12 | `total_raised_cents` exceeds `funding_goal_cents` (future state, cap > goal) | Backend returns actual amount. Frontend progress bar caps visually at 100% width but shows actual percentage text. | Frontend | Component |
| 13 | `total_raised_cents = '0'` (feat-004 stub) | Progress bar renders at 0%, not as error state | Frontend | Component |
| 14 | `funding_goal_cents` is null on a live campaign (data anomaly) | Backend returns `fundingPercentage: null`. Frontend handles null progress gracefully (0% bar). | Both | Unit |
| 15 | Campaign transitions `live` → `funded` during search request | Response may include campaign in either status — both are publicly visible. No application-level concern. | None (benign) | — |
| 16 | Campaign transitions `live` → `suspended` mid-page-view | Detail page shows point-in-time snapshot. Subsequent `GET /public/campaigns/:id` returns 404 (suspended is not public). | Backend | Integration |
| 17 | `clerkMiddleware()` populates `req.auth` — anonymous user has `userId: null` | Public router handlers must NOT call `requireAuth`. Calling `getClerkAuth(req)` is safe if needed; returns `null` for anonymous. | Backend | Integration |
| 18 | `requireAuth` currently on existing `/api/v1/campaigns` mount | Public routes MUST be on separate router at `/api/v1/public/campaigns` (G-036). Never add public routes to existing campaign router. | Architecture | — |
| 19 | `users.display_name = null` for creator | `creatorName: null` in response. Frontend displays "Creator" as fallback text. | Both | Unit |
| 20 | Non-UTF-8 characters in `q` param | Express rejects malformed URLs at HTTP layer before reaching handler. | HTTP | — |
| 21 | `q` exceeds 200 characters | `400 VALIDATION_ERROR` from Zod `max(200)` rule. | Backend | Integration |
| 22 | Anonymous user bookmarks URL for a campaign later suspended | Subsequent `GET /public/campaigns/:id` returns `404 NOT_FOUND` — do not reveal status. | Backend | Integration |
| 23 | `?sort=invalid` in URL | `400 VALIDATION_ERROR` — Zod enum validation fails. | Backend | Integration |
| 24 | `status=ending_soon` filter with no campaigns within 7 days | `200 OK` with empty array — not an error. | Backend | Integration |
| 25 | `?category=propulsion&category=power_energy` (multi-value) | Array passed to `= ANY($1::TEXT[])` — both categories returned. (G-039) | Backend | Integration |
| 26 | `funded` campaign detail page — CTA behaviour | "Back This Mission" CTA renders as active (not disabled). Cap is never reached in feat-004 stub. | Frontend | Component |
| 27 | `offset=0, limit=20` (default pagination) | First 20 results returned. `pagination.total` = total matching count. | Backend | Integration |
| 28 | `limit=101` (exceeds max) | `400 VALIDATION_ERROR` — Zod `max(100)` validation. | Backend | Integration |
| 29 | Very large `offset` (e.g., 10000) | Accepted by backend — PostgreSQL handles efficiently for demo dataset. Frontend should not generate such offsets in normal use. | Backend | Integration |
| 30 | Empty database (no live or funded campaigns) | All public endpoints return empty arrays and zero stats — no errors. | Backend | Integration |
| 31 | Campaign with 10 milestones and 20 team members (maximum) | Detail endpoint returns all JSONB data — no truncation. | Backend | Integration |
| 32 | `websearch_to_tsquery` returns NULL for empty input (G-037) | Guarded: `WHERE ($1 = '' OR search_vector @@ ...)`. Empty `q` returns all campaigns. | Backend | Integration |
| 33 | `tsvector` GIN index not built before first request | Migration must run before deployment. If index is missing, query falls back to sequential scan — slow but not broken. Migration ordering is a deployment concern, not runtime. | Infra | — |
| 34 | `sort=ending_soon` with campaigns that have `deadline = null` | `deadline IS NOT NULL` partial index and `ORDER BY c.deadline ASC NULLS LAST` excludes null-deadline campaigns from meaningful sort position. | Backend | Integration |
| 35 | Search results when `q` is empty and `status=ending_soon` is set | Returns all public campaigns with deadline within 7 days, sorted by deadline ASC — no FTS filter applied. | Backend | Integration |
| 36 | Category stats for a category with zero campaigns | Returns `{ campaignCount: 0, activeCampaignCount: 0, totalRaisedCents: '0', contributorCount: 0 }` — no error. | Backend | Integration |
| 37 | `GET /stats` route order — must come before `GET /:id` | `/stats` registered first in router (G-023). Otherwise `stats` would be matched as a campaign ID. | Architecture | Integration |
| 38 | `GET /api/v1/public/campaigns/stats` with no `category` param | `400 VALIDATION_ERROR` — category is required. | Backend | Integration |

---

## Testing Requirements

### Unit Tests

**File:** `packages/backend/src/campaign/application/campaign-app-service.test.ts`

- [ ] `searchPublicCampaigns` — delegates to repository, returns result unchanged
- [ ] `getPublicCampaign` — returns detail for existing public campaign
- [ ] `getPublicCampaign` — throws `CampaignNotFoundError` when repository returns null
- [ ] `getCategoryStats` — returns stats from repository

**File:** `packages/backend/src/campaign/api/public-campaign-serializer.test.ts`

- [ ] `serializePublicCampaignListItem` — `daysRemaining` computed correctly (future deadline)
- [ ] `serializePublicCampaignListItem` — `daysRemaining: 0` when deadline is in the past
- [ ] `serializePublicCampaignListItem` — `daysRemaining: null` when deadline is null
- [ ] `serializePublicCampaignListItem` — `fundingGoalCents` as string, not number
- [ ] `serializePublicCampaignListItem` — `totalRaisedCents: '0'` stub value preserved
- [ ] `serializePublicCampaignDetail` — includes all JSONB fields
- [ ] `serializeCategoryStats` — all fields present

**File:** `packages/frontend/src/components/CampaignCard.test.tsx`

- [ ] Renders campaign with all fields present — happy path
- [ ] Renders placeholder when `heroImageUrl` is null
- [ ] Renders title only when `shortDescription` is null
- [ ] Renders "No goal set" or hides goal when `fundingGoalCents` is null
- [ ] Renders "Fully Funded" badge when `status === 'funded'`
- [ ] Renders "Ending Soon" badge when `daysRemaining <= 7` and `status === 'live'`
- [ ] Does NOT render "Ending Soon" when `daysRemaining > 7`
- [ ] Long title (200 chars) does not break card layout

**File:** `packages/frontend/src/components/FundingProgressBar.test.tsx`

- [ ] Progress bar width is 0% when `totalRaisedCents === '0'`
- [ ] Progress bar width is capped at 100% when `fundingPercentage > 100`
- [ ] Displays `null` fundingPercentage as "N/A"

**File:** `packages/frontend/src/components/CampaignStatusBadge.test.tsx`

- [ ] Renders "Fully Funded" for `status === 'funded'`
- [ ] Renders "Ending Soon" for `status === 'live'` with `daysRemaining <= 7`
- [ ] Renders "Live" for `status === 'live'` with `daysRemaining > 7`
- [ ] Renders "Live" when `daysRemaining` is null

### Integration Tests

**File:** `packages/backend/src/campaign/api/public-campaign-router.test.ts`

These tests use the in-memory adapter. No real database.

**`GET /api/v1/public/campaigns`:**
- [ ] Returns `200 OK` with empty array when no public campaigns exist
- [ ] Returns `200 OK` with campaigns in `live` and `funded` status
- [ ] Does NOT return campaigns in `draft`, `submitted`, `under_review`, `approved`, `rejected`, `suspended` status
- [ ] Anonymous request (no Authorization header) succeeds with `200 OK`
- [ ] `?q=nuclear` filters results by title match (in-memory contains check)
- [ ] `?category=propulsion` filters by category
- [ ] `?category=propulsion&category=power_energy` filters by multiple categories
- [ ] `?category=invalid` returns `400 VALIDATION_ERROR`
- [ ] `?status=active` returns only `live` campaigns
- [ ] `?status=funded` returns only `funded` campaigns
- [ ] `?sort=invalid` returns `400 VALIDATION_ERROR`
- [ ] `?limit=101` returns `400 VALIDATION_ERROR`
- [ ] `?limit=-1` returns `400 VALIDATION_ERROR`
- [ ] `?limit=5&offset=0` returns at most 5 results
- [ ] Response includes `pagination.total`, `pagination.limit`, `pagination.offset`
- [ ] `totalRaisedCents` is always `'0'` in response
- [ ] `contributorCount` is always `0` in response
- [ ] `fundingPercentage` is `0.00` when fundingGoalCents is set
- [ ] `fundingPercentage` is `null` when fundingGoalCents is null
- [ ] `daysRemaining` is computed correctly (future deadline)
- [ ] `daysRemaining` is `0` when deadline is in the past
- [ ] `daysRemaining` is `null` when deadline is null

**`GET /api/v1/public/campaigns/stats`:**
- [ ] Returns `200 OK` with correct counts for valid category
- [ ] Returns `200 OK` with zero counts when no campaigns exist for category
- [ ] Missing `?category` returns `400 VALIDATION_ERROR`
- [ ] Invalid `?category=invalid` returns `400 VALIDATION_ERROR`
- [ ] `totalRaisedCents` is `'0'` in response
- [ ] `campaignCount` counts both `live` and `funded` campaigns
- [ ] `activeCampaignCount` counts only `live` campaigns

**`GET /api/v1/public/campaigns/:id`:**
- [ ] Returns `200 OK` with full detail for `live` campaign
- [ ] Returns `200 OK` with full detail for `funded` campaign
- [ ] Returns `404 NOT_FOUND` for `draft` campaign (any non-public status)
- [ ] Returns `404 NOT_FOUND` for non-existent UUID
- [ ] Anonymous request succeeds with `200 OK`
- [ ] Response includes `milestones`, `teamMembers`, `riskDisclosures`, `budgetBreakdown`
- [ ] Response includes `totalRaisedCents: '0'` and `contributorCount: 0`
- [ ] Malformed (non-UUID) ID returns `404 NOT_FOUND` (not 400 — public endpoint)

### In-Memory Adapter Tests

**File:** `packages/backend/src/campaign/adapters/in-memory-campaign-repository.adapter.test.ts`

Add tests for new methods:
- [ ] `searchPublicCampaigns` — returns only live/funded campaigns
- [ ] `searchPublicCampaigns` — applies q filter (title match)
- [ ] `searchPublicCampaigns` — applies category filter
- [ ] `searchPublicCampaigns` — applies status filter (active, funded, ending_soon)
- [ ] `searchPublicCampaigns` — applies sort (newest, ending_soon)
- [ ] `searchPublicCampaigns` — applies pagination (limit, offset)
- [ ] `searchPublicCampaigns` — returns total count
- [ ] `findPublicById` — returns detail for live campaign
- [ ] `findPublicById` — returns null for non-public campaign
- [ ] `findPublicById` — returns null for non-existent id
- [ ] `getCategoryStats` — returns correct counts
- [ ] `getCategoryStats` — returns zeros for empty category

### E2E / Frontend Tests

**File:** `packages/frontend/src/pages/CampaignDiscoveryPage.test.tsx`

- [ ] Renders loading skeleton while data is fetching
- [ ] Renders campaign cards when data loads
- [ ] Renders "No campaigns found" empty state
- [ ] Renders error state on API failure
- [ ] Typing in search input updates URL `?q=` param after debounce
- [ ] Selecting a category filter updates URL `?category=` param
- [ ] Selecting "Funded" status updates URL `?status=funded`
- [ ] Changing sort updates URL `?sort=` param
- [ ] URL state survives navigation (filters preserved on back-navigation)

**File:** `packages/frontend/src/pages/CampaignDetailPage.test.tsx`

- [ ] Renders all campaign detail fields for live campaign
- [ ] Renders "Fully Funded" badge for funded campaign
- [ ] Renders placeholder when heroImageUrl is null
- [ ] Renders "No milestones defined" for empty milestones
- [ ] Renders 404 message for non-existent campaign (mock 404 response)
- [ ] Renders loading skeleton while data is fetching
- [ ] Renders error state on API failure
- [ ] "Back This Mission" CTA button is present and accessible
- [ ] Days remaining displays correctly for future deadline
- [ ] "Last day!" displays when daysRemaining is 0
