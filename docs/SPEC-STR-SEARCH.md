# Spec: STR-Focused Zillow Search (Phase 3)

## Summary

Replace the current "paste a Zillow URL" flow with a **state-selector-driven search** that finds short-term rental properties on Zillow across US states. The system searches Zillow for properties suitable for STR arbitrage, enriches them with AirDNA revenue estimates, extracts owner/contact information, and deduplicates across runs — always prioritizing unsearched areas.

---

## 1. State Selector (Default Search Mode)

### 1.1 State List

All 50 US states where STR is available:

```
Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut,
Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa,
Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan,
Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada,
New Hampshire, New Jersey, New Mexico, New York, North Carolina,
North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island,
South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia,
Washington, West Virginia, Wisconsin, Wyoming
```

### 1.2 UI Behavior

- All 50 states are **checked by default** (pre-selected).
- A "Select All / Deselect All" toggle at the top.
- User **unticks** states they do NOT want to search.
- States are displayed in a scrollable multi-column checkbox grid (alphabetical).
- A counter badge shows "X of 50 selected."

### 1.3 Data Model

New constant file: `src/lib/constants/us-states.ts`

```ts
export const US_STR_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  // ... all 50
] as const;
```

The selected states are stored in `searches.input_params` as:
```json
{ "states": ["AL", "AK", "AZ", ...], "mode": "states" }
```

---

## 2. Search Flow

### 2.1 Default Mode (State Selector)

1. User opens Searches → New Search.
2. Selects states (all checked by default).
3. Optionally sets: max results per state, min beds, max rent.
4. Clicks "Run."
5. System generates one Zillow search URL per selected state (for_rent listings filtered for STR-suitable properties).
6. Each state becomes a **sub-run** under one parent search. States are queued and executed sequentially or in batches (respecting budget).
7. Results upsert on `(source, external_id)` — no duplicates across runs.

### 2.2 URL Construction

For each state, the system builds a Zillow `for_rent` URL targeting that state. The `searchQueryState` JSON encodes:
- `regionSelection`: state-level region (Zillow state region IDs stored in a lookup table)
- `filterState`: for_rent = true, any user-specified filters (beds, price)

This means the system needs a **Zillow region ID per state** mapping (static lookup, scraped once or hardcoded).

### 2.3 Sub-Run Architecture

```
searches (parent)
  ├── search_runs (child: state = "FL", status = "succeeded", result_count = 150)
  ├── search_runs (child: state = "TX", status = "running")
  └── search_runs (child: state = "CA", status = "pending")
```

New table: `search_state_runs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| search_id | uuid | FK → searches |
| state_code | text | e.g. "FL" |
| status | text | pending/running/succeeded/failed |
| apify_run_id | text | |
| result_count | int | |
| error | text | |
| started_at | timestamptz | |
| finished_at | timestamptz | |

The parent `searches` row tracks overall progress. Its status becomes "succeeded" when all sub-runs complete (or "partial" if some fail).

---

## 3. Owner vs. Management Company Filter

### 3.1 New Columns on `results`

| Column | Type | Notes |
|--------|------|-------|
| owner_name | text | From Zillow listing data |
| owner_type | text | `owner` or `management` |
| contact_phone | text | If available |
| contact_email | text | If available |
| broker_name | text | Listing broker/agent name |

### 3.2 Classification Logic

The Zillow scraper returns broker/agent info in `hdpData.homeInfo`. Classification:

- If the listing shows an individual name (no LLC, no "Property Management", no "Realty", no "Group") → `owner`
- If the listing shows a company name, LLC, or management keyword → `management`
- Heuristic keywords for `management`: LLC, Inc, Corp, Realty, Properties, Management, Group, Capital, Investments, Partners, Homes (configurable list in `app_settings`)

### 3.3 Search Filter

- Checkbox in the search form: **"Owner-listed only"** (default: unchecked).
- When checked, results classified as `management` are still stored but hidden from the default results view.
- Results page also gets an "Owner type" filter dropdown: All / Owner / Management.

### 3.4 Contact Info

- If Zillow provides owner phone/email → stored directly.
- If not available → the `detail_url` (link to original Zillow listing) serves as the fallback. The UI shows "Contact info unavailable — view listing" with a link.
- Future enhancement: enrichment step to look up owner contact via property records APIs.

---

## 4. AirDNA Revenue Enrichment

### 4.1 Flow

After a search completes (or on-demand), the system enriches results with AirDNA:

1. For each result, look up `str_market_cache` by `(provider='airdna', city, state, beds)`.
2. If cache hit → use cached values.
3. If cache miss → call AirDNA API for that market.
4. Write `result_enrichment`: ADR, occupancy, monthly revenue, annual revenue.
5. Compute deal verdict using existing logic.

### 4.2 AirDNA Adapter

Provider kind: `http_api`. Requires an AirDNA API credential in `api_credentials`.

Endpoint pattern: `GET /api/v2/market/{market_id}/rental-metrics` (or equivalent based on AirDNA's current API).

Input: city, state, bedrooms.  
Output: ADR, occupancy rate, monthly revenue estimate.

### 4.3 Fallback

If no AirDNA credential exists → enrichment step shows "AirDNA credential required" (graceful failure, same as current behavior). The existing `apify_airbnb` adapter remains as a secondary fallback option selectable in settings.

### 4.4 Cache

`str_market_cache` keyed on `(provider, city, state, beds)`. TTL: 30 days (configurable in `app_settings`). After TTL, the next enrichment run re-fetches.

---

## 5. Deduplication & State Prioritization

### 5.1 Result-Level Dedup

Already exists: `results` table has `unique (source, external_id)`. Upsert ensures no duplicate listings across runs.

### 5.2 State-Level Prioritization

When running a multi-state search, the system **prioritizes states that have been searched least recently** (or never):

1. Query `search_state_runs` for the last successful run per state.
2. Sort selected states by `last_searched_at ASC NULLS FIRST` (never-searched states go first).
3. Execute in that order.

This means if a user ran FL and TX yesterday, then today selects all 50 states, the system processes the other 48 states first before re-running FL and TX.

### 5.3 Duplicate-Aware Result Count

The UI shows per-state: "150 results (23 new, 127 already seen)" so the user knows they're not paying for redundant data.

### 5.4 Skip-Already-Searched Option

Optional checkbox: **"Skip states searched in the last N days"** (default N = 7, configurable). If checked, states with a successful run within N days are automatically skipped (greyed out in the selector with a "last searched X days ago" label).

---

## 6. Results Output

### 6.1 Card Layout (per result)

Each result card displays:

| Field | Source |
|-------|--------|
| **Photo** | Zillow `imgSrc` |
| **Address** | Zillow |
| **City, State** | Zillow |
| **Beds / Baths / Sqft** | Zillow |
| **Monthly Rent** | Zillow price |
| **Owner Name** | Zillow broker/agent field |
| **Owner Type** | Badge: "Owner" (green) or "Mgmt" (amber) |
| **Contact** | Phone/email if available, else "View listing" link |
| **STR Monthly Revenue** | AirDNA enrichment |
| **STR Annual Revenue** | AirDNA enrichment |
| **ADR / Occupancy** | AirDNA enrichment |
| **Spread** | Revenue − Rent (green/red) |
| **Deal Verdict** | Good / Marginal / Poor badge |
| **STR Legality Note** | If city has one |
| **Zillow Link** | Opens original listing |

### 6.2 Filters (Results Page)

- Min/Max rent
- Min beds / Min baths
- State (multi-select or dropdown)
- City
- Owner type: All / Owner / Management
- Deal verdict: All / Good / Marginal / Poor
- Has contact info: All / Yes / No

### 6.3 Sorting

- Spread (highest first) — default
- STR monthly revenue (highest first)
- Rent (lowest first)
- Days on market (fewest first)
- Newest first (by listing date)

### 6.4 Pagination

24 cards per page (existing behavior).

---

## 7. Advanced Search (Secondary Mode)

### 7.1 Access

A "Switch to Advanced Search" link/button below the default state selector form. Toggles the UI to the current URL-paste mode.

### 7.2 Advanced Mode Features

- Paste a Zillow `for_rent` URL directly (existing behavior, unchanged).
- Optional: target specific cities/metros within a state.
- Optional: specify Zillow filters beyond what the state-mode generates (property type, HOA, etc.).
- Everything else (enrichment, dedup, owner classification) still applies to results from advanced searches.

### 7.3 Switching Back

A "Switch to Default Search" link returns to the state selector view.

---

## 8. Schema Changes (Migration 0006)

```sql
-- 8.1 New table: search_state_runs (sub-runs per state)
create table if not exists public.search_state_runs (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches (id) on delete cascade,
  state_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  apify_run_id text,
  result_count int not null default 0,
  new_result_count int not null default 0,
  error text,
  started_at timestamptz,
  finished_at timestamptz
);
create index on public.search_state_runs (search_id);
create index on public.search_state_runs (state_code, finished_at desc);

-- 8.2 Add owner/contact columns to results
alter table public.results
  add column if not exists owner_name text,
  add column if not exists owner_type text check (owner_type in ('owner', 'management')),
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists broker_name text;

-- 8.3 Add search mode + skip_days to app_settings
alter table public.app_settings
  add column if not exists default_search_mode text not null default 'states',
  add column if not exists skip_states_within_days int not null default 7,
  add column if not exists str_cache_ttl_days int not null default 30,
  add column if not exists management_keywords text[] not null default
    '{LLC,Inc,Corp,Realty,Properties,Management,Group,Capital,Investments,Partners,Homes}';

-- 8.4 Add search_mode to searches for tracking
alter table public.searches
  add column if not exists search_mode text not null default 'states'
    check (search_mode in ('states', 'url'));

-- 8.5 Zillow state region IDs (static lookup for URL construction)
create table if not exists public.zillow_state_regions (
  state_code text primary key,
  state_name text not null,
  zillow_region_id int not null
);

-- 8.6 RLS for new tables
alter table public.search_state_runs enable row level security;
alter table public.zillow_state_regions enable row level security;

create policy "search_state_runs_select_auth" on public.search_state_runs
  for select using (auth.uid() is not null);
create policy "zillow_state_regions_select_auth" on public.zillow_state_regions
  for select using (auth.uid() is not null);
```

---

## 9. Updated Result Mapping (Zillow Actor)

The `result_mapping` in `actor_configs` for the Zillow scraper needs these additions:

```json
{
  "owner_name": "brokerName",
  "broker_name": "brokerName",
  "contact_phone": "hdpData.homeInfo.brokerPhone"
}
```

Owner type classification happens post-mapping in the result mapper (not in the scraper itself).

---

## 10. UI Wireframe (New Search Page)

```
┌─────────────────────────────────────────────────────┐
│ New Search                                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ☑ Select All (50/50)              [Deselect All]   │
│                                                     │
│  ┌─────────────┬─────────────┬─────────────┐       │
│  │ ☑ Alabama   │ ☑ Montana   │ ☑ Oregon    │       │
│  │ ☑ Alaska    │ ☑ Nebraska  │ ☑ Pennsylv. │       │
│  │ ☑ Arizona   │ ☑ Nevada    │ ☑ Rhode Is. │       │
│  │ ...         │ ...         │ ...         │       │
│  └─────────────┴─────────────┴─────────────┘       │
│                                                     │
│  Options:                                           │
│  ┌──────────────────┐ ┌──────────────────┐         │
│  │ Max results/state│ │ Min bedrooms     │         │
│  │ [200]            │ │ [Any]            │         │
│  └──────────────────┘ └──────────────────┘         │
│  ┌──────────────────┐ ┌──────────────────┐         │
│  │ Max monthly rent │ │ Credential       │         │
│  │ [$___]           │ │ [Auto]           │         │
│  └──────────────────┘ └──────────────────┘         │
│                                                     │
│  ☐ Owner-listed only                                │
│  ☑ Skip states searched in last [7] days            │
│                                                     │
│  [Run Search]                                       │
│                                                     │
│  ─── or ───                                         │
│  Switch to Advanced Search (paste URL)              │
└─────────────────────────────────────────────────────┘
```

---

## 11. Execution Order

1. User submits with N states selected.
2. System creates parent `searches` row (`search_mode = 'states'`).
3. System creates N `search_state_runs` rows (status = `pending` or `skipped`).
4. States are sorted: never-searched first, then oldest-searched first.
5. States within `skip_states_within_days` are marked `skipped` (if that option is on).
6. Remaining states execute sequentially (one Apify run per state).
7. Each run: build Zillow URL → start scraper → poll → upsert results → classify owner type → mark sub-run succeeded.
8. After all sub-runs: trigger AirDNA enrichment on new results.
9. Parent search status = "succeeded" (or "partial" if some states failed).

---

## 12. Cost Estimate Display

Before confirming, show:
```
Searching X states · ~Y results max · Est. cost: $Z
(States skipped: A — searched within 7 days)
```

---

## 13. Future Enhancements (Out of Scope for Now)

- Owner contact enrichment via property records API (county assessor data).
- City/metro targeting within states (advanced mode).
- Airbnb comp scraping per-listing (not per-market).
- Auto-scheduling (run all states on a weekly cadence).
- Export results to CSV/Google Sheets.
