# Claude Context — Zillow Finder

## Project Summary

Internal STR (short-term rental) arbitrage tool. Scrapes Zillow for rental listings by owner, estimates Airbnb revenue, identifies profitable deals.

## What's Been Built (as of June 25, 2026)

### Core Features
- **State selector search** — all 50 US states pre-checked, user unticks what they don't want
- **ZIP code scraper** — uses `maxcopell/zillow-zip-search` (only working scraper, URL-based ones are all blocked)
- **Owner filtering** — `homeType: Houses+Townhomes` at API level + post-filter rejects `buildingName`/`multifamily`
- **STR revenue enrichment** — `malikgen/airbnb-revenue-calculator` via start+poll (Vercel 10s limit)
- **Deal evaluation** — spread = STR revenue - rent, verdict: Good/Marginal/Poor
- **Real-time logs** — `/searches/[id]` page with live polling, state grid, progress bar
- **Batch enrichment** — "Enrich All STR" button on Results page, processes one at a time
- **Archive** — hide listings from view, toggle to see archived
- **PWA** — installable on all devices

### Auth & Security
- Username/password login (no public signup)
- Supabase Auth + RLS + Vault (encrypted API tokens)
- Admin creates users, manages credentials
- Service role key server-only

### Deployment
- Vercel free plan (10s timeout), region iad1
- Supabase free tier
- Apify free plan ($5/month, 8GB RAM)

## Current State of Scrapers (June 25, 2026)

| Scraper | Status | Notes |
|---------|--------|-------|
| `maxcopell/zillow-zip-search` | ✅ Working | ZIP codes, forRent filter, homeType filter |
| `maxcopell/zillow-scraper` | ❌ Blocked | URL-based, "Failed requests: 1", 0 items always |
| `igolaizola/zillow-scraper-ppe` | ❌ Blocked | URL-based, 0 items |
| `malikgen/airbnb-revenue-calculator` | ✅ Working | STR revenue data |

## Key Technical Decisions

1. **ZIP scraper over URL scraper** — Zillow blocks URL-based scraping as of June 2026
2. **Start+poll pattern** — all Apify calls use start (fast) → client polls (every 3-5s) to work within 10s Vercel timeout
3. **Owner detection is post-filter** — no FRBO API filter exists for Zillow rentals. We filter `homeType: Houses+Townhomes` at scraper level and reject `buildingName`/`multifamily` results
4. **STR cache** — keyed on (provider, city, state, beds) so same market is only paid for once
5. **Sequential state execution** — one state at a time to stay within Apify RAM limits

## Database Migrations

Applied in order: 0001 → 0008. If starting fresh, apply all in `supabase/migrations/`.

Key migrations:
- 0006: `search_state_runs`, owner columns, state regions, app_settings additions
- 0007: `search_logs` table
- 0008: `archived` boolean on results

## Environment

- macOS development
- Node.js 25.6.1
- Next.js 16.2.9
- Supabase project: `vxpymepqshovvuidqixr`
- Two Apify credentials in vault (one exhausted, one active: "Random1")

## What the User Wants Next (likely)

- More owner-specific results (Zillow limitation — no true FRBO filter)
- Contact info extraction (requires detail page scraping, expensive)
- Better STR accuracy
- The app to actually produce profitable deal leads consistently
