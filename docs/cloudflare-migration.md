# TINA — Cloudflare migration runbook (one-vendor)

This branch (`cloudflare-migration`) moves TINA off Netlify + Supabase onto a
single vendor: **Cloudflare Pages (hosting) + Worker (API) + D1 (database)**,
with auth built into the Worker. The live `main` (Netlify + Supabase) keeps
running until you cut over.

## Architecture

| Concern | Before | After |
|---|---|---|
| Hosting | Netlify | Cloudflare Pages (`dist/`) |
| API / functions | Netlify Function `ai-proxy` | `dist/_worker.js` (`cloudflare/worker/`) |
| Database | Supabase Postgres | **D1** (`cloudflare/schema.sql`) |
| Auth | Supabase Auth | Worker JWT + PBKDF2 on D1 (`cloudflare/worker/auth.ts`) |
| Access control (RLS) | Postgres RLS | Worker data layer (`cloudflare/worker/data.ts`) |
| Realtime presence | Supabase Realtime | **no-op for now** (Durable Objects = follow-up) |

The client uses a supabase-js-compatible shim (`src/lib/cfClient.ts`), so the
feature code was not rewritten — every `supabase.from(...)` / `supabase.auth`
call now hits the Worker.

## One-time setup (you run these — they need your Cloudflare account)

```bash
# 1. Create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create tina-db

# 2. Create the schema (remote = the deployed DB)
wrangler d1 execute tina-db --file=cloudflare/schema.sql --remote

# 3. Secrets (Pages project). JWT_SECRET = any long random string.
#    Use NEW Gemini/HF keys (rotate the old exposed ones).
wrangler pages secret put JWT_SECRET
wrangler pages secret put GEMINI_API_KEY
wrangler pages secret put HF_API_KEY
#    Optional: comma-separated admin emails (default jewoong.moon@gmail.com)
wrangler pages secret put ADMIN_EMAILS
```

## Build + deploy

```bash
npm run cf:deploy      # = vite build + bundle worker + wrangler pages deploy dist
```

`npm run build` produces `dist/` (static assets) and `dist/_worker.js` (the
bundled Worker). Pages serves the assets and routes `/api/*` to the Worker.

## Local development

```bash
npm run build
wrangler pages dev dist --d1 DB=tina-db    # serves assets + Worker + local D1
```

(`npm run dev` still runs the Vite UI alone, but `/api/*` calls 404 without the
Worker — use `wrangler pages dev` to exercise auth/data/AI locally.)

## Data migration (Supabase → D1)

The schema translation is: `uuid → TEXT`, `timestamptz → ISO TEXT`,
`text[]`/`jsonb → JSON TEXT`, `boolean → 0/1`. To move existing rows:

1. Export each table from Supabase (SQL editor → CSV, or `pg_dump --data-only`).
2. Transform: stringify array/json columns, convert booleans to 0/1, timestamps
   to ISO. (A small Node script over the CSVs is the easiest path.)
3. Import: `wrangler d1 execute tina-db --file=migrated.sql --remote`.

**Auth caveat (important):** Supabase does not let you export password hashes,
so existing students cannot be migrated with working logins. Options:
- **Re-signup (recommended at a term boundary):** students sign up again; their
  email is unchanged, so prior sessions can be re-linked by email if you import
  the `profiles` rows (without `password_hash`) and have them set a password on
  first login. (A "first login sets your password" flow can be added later.)
- Or start the D1 corpus fresh and keep the Supabase export only for research.

## Cutover

1. Deploy to a Pages **preview** URL, smoke-test signup → chat → report →
   admin dashboard.
2. Point the custom domain (or the class link) at the Pages project.
3. Keep Netlify + Supabase up for a rollback window, then retire.

## Still on Cloudflare's side after cutover

- **Presence** (the "N other learners active" indicator) is a no-op until a
  Durable Object is added; it simply shows nobody else for now.
- The Netlify files (`netlify.toml`, `netlify/functions/`, `tina-api-proxy.sql`)
  remain in the repo as the rollback path; delete them once cutover is verified.
