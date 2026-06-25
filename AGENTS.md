<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Context for AI Agents

## What This Is

Zillow Finder — an internal STR (Short-Term Rental) arbitrage research tool. Finds rental properties listed by owners on Zillow, estimates their Airbnb revenue potential, and identifies profitable deals.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4
- Supabase (Postgres + Auth + RLS + Vault)
- Apify (scraping platform) for Zillow + Airbnb data
- Deployed on Vercel (free plan, 10s function timeout)
- PWA enabled (installable)

## Current Architecture

### Scraping: `maxcopell/zillow-zip-search` (Apify)
- Only working Zillow scraper — all URL-based scrapers are blocked by Zillow as of June 2026
- Input: ZIP codes + filters (forRent, homeType, priceMax, bedsMin)
- When ownerOnly: adds `homeType: ["Houses", "Townhomes"]` to exclude apartments
- Post-filter: rejects results with `buildingName` or `multifamily` in marketingTreatments

### STR Revenue: `malikgen/airbnb-revenue-calculator` (Apify)
- Provides ADR, occupancy (90-day forward), monthly/annual revenue from real Airbnb calendar data
- Called via start+poll pattern (each request <10s for Vercel free plan)
- Cached per (city, state, beds) in `str_market_cache`

### Search Flow
1. User selects states (all 50 pre-checked) → each state maps to 2-3 major cities with ZIP codes
2. System creates sub-runs per state, prioritized by never-searched-first
3. Each sub-run calls ZIP scraper → results upserted (deduped on source+external_id)
4. Owner classification happens post-scrape
5. Auto-enrichment with STR revenue after all states complete
6. Manual "Calculate STR" button per result + "Enrich All STR" batch button

### Key Limitations
- **No FRBO filter exists** — Zillow has no "For Rent By Owner" API parameter for rentals
- **No contact info in search results** — Zillow hides phone/email. Only available on detail pages
- **Apify free plan**: $5/month credits, 8GB RAM limit (runs get stuck if exceeded)
- **Vercel free plan**: 10s function timeout — use start+poll pattern for long operations

## Database (Supabase)

Migrations applied: 0001-0008. Key tables:
- `searches` — parent search records (search_mode: 'states' | 'url')
- `search_state_runs` — sub-run per state within a search
- `search_logs` — activity log per search (for real-time UI)
- `results` — normalized listings (unique on source+external_id)
- `result_enrichment` — STR revenue data per result
- `str_market_cache` — cached revenue lookups per (provider, city, state, beds)
- `api_credentials` — tokens stored via Vault (encrypted)
- `app_settings` — singleton config row

## File Layout

```
src/
  app/
    (app)/                    # authenticated shell
      searches/               # state selector + search management
        [id]/page.tsx         # real-time logs view
      results/                # listing cards + filters + batch enrich
      guide/                  # how-to documentation
      credentials/ users/ settings/ data-sources/
    api/
      searches/[id]/status/   # poll search progress
      searches/[id]/logs/     # activity log feed
      results/enrich/         # single result STR (start+poll)
      results/enrich-batch/   # batch status endpoint
    login/                    # username/password auth
  components/
    state-selector.tsx        # 50-state checkbox grid
    top-nav.tsx               # main navigation
  lib/
    constants/us-states.ts    # state codes
    constants/us-cities.ts    # cities with ZIP codes per state
    search-engine.ts          # orchestrates searches (start, poll, finalize)
    search-logger.ts          # writes to search_logs
    providers/
      apify.ts                # Apify provider (start/poll runs)
      result-mapper.ts        # maps raw scraper output → results table
    str/
      airbnb-apify.ts         # STR revenue adapter (malikgen actor)
      enrich.ts               # enrichment orchestrator
    budget.ts                 # credential selection, budget checks
    credentials.ts            # vault token read, monthly reset
  proxy.ts                    # route protection (auth middleware)
```

## Credentials (env vars on Vercel)

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)

API tokens (Apify etc.) stored in Supabase Vault, managed via Credentials page.

## Known Issues / TODO

- URL-based Zillow scraper (`maxcopell/zillow-scraper`) is blocked — monitor for fix
- FRBO keyword filtering doesn't work with ZIP scraper
- Contact info requires detail page scraping (expensive, not implemented)
- `afanasenko/zillow-property-agent-data-scraper` could provide owner data but is likely URL-based and blocked
- Archive feature needs migration 0008 applied (`alter table results add column archived boolean default false`)
- Apify free plan RAM limit causes stuck runs — need to abort manually at console.apify.com
