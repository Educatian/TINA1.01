# TINA web hosting on Cloudflare Pages (Supabase stays the backend)

This moves **web hosting only** from Netlify to Cloudflare Pages. Supabase
remains the database + auth, exactly as before. Nothing about learner accounts,
data, or RLS changes — so there is **no student re-signup** (unlike the heavier
`cloudflare-migration` branch, which replaces Supabase with D1).

## What changed in the repo

- `functions/api/ai-proxy.ts` — the server-side AI proxy as a **Cloudflare Pages
  Function** (the Workers-native, dependency-free twin of
  `netlify/functions/ai-proxy.mts`). Same contract, auth (Supabase JWT), model
  allowlists, and best-effort rate limit; Gemini/HF are called over REST.
- `src/services/aiProxy.ts` — the client now posts to the host-neutral path
  **`/api/ai-proxy`** (a native Function on Pages; a redirect on Netlify).
- `netlify.toml` — redirects `/api/ai-proxy` → the Netlify Function, so the old
  host keeps working during cutover / rollback.
- `wrangler.toml`, `public/_redirects` (SPA fallback), `npm run cf:deploy`.

## Deploy (you run this — secrets are yours)

The build bakes the **public** Supabase values into the bundle, so set those at
build time; the **server-side** keys are Pages secrets read by the Function.

### Option A — Wrangler (direct deploy)

```bash
# 1) one-time: log in
npx wrangler login

# 2) build with the public Supabase env (client bundle)
#    put these in .env (vite reads it) or export them:
#      VITE_SUPABASE_URL=...   VITE_SUPABASE_ANON_KEY=...
npm run build

# 3) create the Pages project + push the build (functions/ auto-compiles)
npx wrangler pages deploy            # uses wrangler.toml (name=tina, dir=dist)

# 4) set the server-side secrets the Function reads (once)
npx wrangler pages secret put GEMINI_API_KEY
npx wrangler pages secret put HF_API_KEY
npx wrangler pages secret put SUPABASE_URL
npx wrangler pages secret put SUPABASE_ANON_KEY
# re-deploy so the secrets are bound:
npm run cf:deploy
```

### Option B — Git integration (Cloudflare dashboard)

1. Pages → Create → connect `Educatian/TINA1.01`, branch `main`.
2. Build command `npm run build`, output dir `dist` (Functions auto-detected
   from `functions/`).
3. Settings → Environment variables, add for Production **and** Preview:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build-time, client) and
   `GEMINI_API_KEY`, `HF_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   (runtime, Function). Mark the keys as encrypted/secret.

## Smoke test before flipping DNS

- Open the `*.pages.dev` URL → sign in (Supabase) → start a chat. The reply
  should stream (proves the Pages Function reaches Gemini with the secret).
- The guide deep link works with no backend: `…/login?guide=learner`.

## Cut over

Point the production domain at the Pages project (Cloudflare dashboard → Pages →
Custom domains). Keep Netlify up until the Pages URL is verified; roll back by
repointing the domain. The `netlify.toml` redirect means the same client build
runs on either host.

## Notes

- Rotate the Gemini + HF keys if the old Netlify bundle ever exposed them.
- The optional Supabase migration `tina-api-proxy.sql` enables the per-user rate
  limit; without it the proxy still works (feature-detected).
