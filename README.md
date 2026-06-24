# Zillow Finder

Internal real-estate search tool. Runs Apify scrapers and stores normalized
property data. Next.js 16 (App Router) + Supabase (Postgres, Auth, RLS).

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4, shadcn-style UI
- Dark theme by default
- Supabase: Postgres + Auth + Row Level Security + Vault (encrypted tokens)
- Deploys to Vercel

## Setup

1. Create a Supabase project.

2. Apply the migrations in `supabase/migrations/` in order. Either use the
   Supabase CLI:

   ```bash
   supabase db push
   ```

   or paste each file (`0001`, `0002`, `0003`) into the Supabase SQL editor and
   run them in order.

3. Copy env vars and fill them in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | client + server | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key (RLS protects data) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS — never exposed to the browser |
   | `SEED_ADMIN_USERNAME` | seed script | First admin username |
   | `SEED_ADMIN_PASSWORD` | seed script | First admin password |

4. Seed the first admin (idempotent):

   ```bash
   npm run seed
   ```

5. Run the dev server:

   ```bash
   npm run dev
   ```

   Log in at `/login` with the seeded admin username + password.

## Auth model

- Accounts are **username + password**. There is no public signup.
- Usernames map to a synthetic internal email (`<username>@zillowfinder.internal`)
  so Supabase Auth has an email to key on. That email is never shown.
- Login resolves username → user (server-side, service role) → signs in with the
  anon client so the session cookie is set.
- Only admins can create users (Users page), add credentials (Credentials page),
  and add data sources (Data Sources page).

## Security notes

- Route protection lives in `src/proxy.ts` (Next.js 16 renamed middleware to
  "proxy"). It redirects unauthenticated users to `/login`. Authorization
  (admin gating) is enforced in pages and server actions via `requireAdmin()`.
- Provider API tokens are stored in **Supabase Vault** (encrypted at rest). Only
  the `vault_secret_id` is kept on `api_credentials`. Tokens are written/read
  only in server actions via SECURITY DEFINER RPCs that are revoked from the
  `anon`/`authenticated` roles. Tokens are never sent to the client or logged.
- The service role key is only imported from server-only modules
  (`src/lib/supabase/admin.ts`, guarded by `server-only`).
- No `localStorage` is used anywhere; sessions live in HTTP-only cookies.

## Project layout

```
src/
  app/
    login/                 # username/password login (public)
    auth/actions.ts        # logout
    (app)/                 # authenticated shell (top nav + role gating)
      dashboard/ searches/ results/ settings/
      data-sources/ credentials/ users/   # admin-only
  components/ui/           # shadcn-style primitives
  lib/
    supabase/{client,server,admin}.ts
    auth.ts types.ts env.ts utils.ts
  proxy.ts                 # route protection (was middleware)
supabase/migrations/       # 0001 schema, 0002 RLS, 0003 vault helpers
scripts/seed-admin.mjs     # npm run seed
```

## Phase 2 — Search engine + STR-revenue valuation (USA only)

### How it works

- Everything is driven by `actor_configs` + `api_credentials` + `app_settings`.
  Adding a data source = inserting an `actor_config` row (and an
  `api_credential` if it needs a key). No code changes.
- Two provider kinds: `apify` (start → poll → fetch dataset, never `.call()`)
  and `http_api` (REST with a bearer token from Vault).
- Two input modes per config: `url` (paste a search URL) and `form` (render
  fields from `input_fields`, deep-merge into `input_template` by replacing
  `{{placeholders}}`).

### Migrations

Apply `0004` (STR + deal columns, caches) and `0005` (seed the Zillow
`actor_config`) in addition to Phase 1's `0001`–`0003`.

### Running a search

1. Admin (or a user with `can_run_searches`) opens Searches → New search.
2. Pick the Zillow data source, paste a `for_rent` URL that contains
   `?searchQueryState=` (apply filters on zillow.com and copy the URL — that's
   how arbitrary filters flow through), set Max results, choose a credential or
   Auto, confirm the estimated max cost, and Run.
3. The run starts async on Apify; the page polls
   `/api/searches/[id]/status` until it finishes. Results upsert on
   `(source, external_id)`, so re-running the same area de-dupes.

### Locked actor schemas

- Zillow `maxcopell/zillow-scraper`: input is only `searchUrls` +
  `extractionMethod` (no in-input item cap). The runner caps cost with Apify's
  platform-level `maxItems` run option.
- Airbnb `tri_angle/airbnb-scraper`: `locationQueries`, `maxResults`,
  `minBedrooms`, `currency`; output `price.amount`, `rating.reviewsCount`.

### STR-revenue valuation

- Three interchangeable adapters behind one interface (`getRevenue`):
  `apify_airbnb` (default, area-based, runs on the Apify key), `airdna`
  (`http_api`, inactive until a token is added — fails gracefully with a
  "needs credential" state), and `airroi` (`http_api`, self-serve).
- Results cache per `(provider, city, state, beds)` in `str_market_cache`, so
  the same area is paid for once, not once per property.
- Enrichment is re-runnable without re-scraping Zillow (it operates on stored
  results) and writes `result_enrichment` with ADR, occupancy, monthly/annual
  revenue, spread, and a deal verdict.

### Deal evaluation

- `app_settings`: `cost_haircut_pct` (default 25), `min_monthly_spread`,
  `min_revenue_to_rent_ratio`.
- `net = str_monthly_revenue × (1 − haircut/100)`,
  `spread = net − rent`, `ratio = str_monthly_revenue / rent`.
- Verdict: Good if spread and ratio both clear; Marginal if one clears; else
  Poor. Changing thresholds in Settings re-derives verdicts with no API calls.

### Budget guard

Runs before every paid execution (Apify runs and STR calls). It picks the
active credential for the provider with the most remaining monthly headroom
(or a manual override), rejects the run if the credential or the global budget
would be exceeded while `hard_stop` is on, and after completion increments
`results_used`, writes a `usage_log` row, and honors monthly resets.

### Tests

`npm run test` runs the deal-evaluation unit tests (Node's built-in runner).
