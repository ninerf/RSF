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
