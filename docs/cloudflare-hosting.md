# TINA hosting — Cloudflare Pages (Supabase stays the backend)

TINA runs on exactly two vendors: **Cloudflare Pages** serves the app and the
server-side AI proxy; **Supabase** remains the database + auth. Nothing about
learner accounts, data, or RLS lives anywhere else. (The heavier
`cloudflare-migration` branch that replaces Supabase with D1 is a separate,
unused experiment — the keyless public demo at tina-7kw.pages.dev runs it.)

- **Class / production app**: https://tina-adie.pages.dev (Pages project
  `tina-adie`, configured in `wrangler.toml`)

## How it fits together

- `functions/api/ai-proxy.ts` — the server-side AI proxy as a **Cloudflare
  Pages Function**. Holds the Gemini/HF keys (Pages secrets), verifies the
  learner's Supabase JWT, model allowlists, best-effort per-user rate limit;
  Gemini/HF are called over REST. Falls back to free Workers AI (`[ai]`
  binding) when no Gemini secret is set.
- `src/services/aiProxy.ts` — the client posts to **`/api/ai-proxy`**.
- `public/_redirects` — SPA fallback. `wrangler.toml` — project config.
- `npm run cf:dev` (local, app + Function) · `npm run cf:deploy` (publish).

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

# 3) push the build (functions/ auto-compiles on Pages)
npx wrangler pages deploy            # uses wrangler.toml (name=tina-adie, dir=dist)

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

## Smoke test after a deploy

- Open the `*.pages.dev` URL → sign in (Supabase) → start a chat. The reply
  should stream (proves the Pages Function reaches Gemini with the secret).
- The guide deep link works with no backend: `…/login?guide=learner`.

## Supabase settings that reference the host URL

- **Auth → URL Configuration → Redirect URLs** must include
  `https://tina-adie.pages.dev/reset-password` (password reset lands there).
- The reset-password email template loads the mascot from
  `https://tina-adie.pages.dev/tina-mascot.png` — if the template was pasted
  into the Supabase dashboard before the host change, re-paste
  `supabase/email-templates/reset-password.html`.

## Notes

- Rotate the Gemini + HF keys if an old client bundle ever exposed them.
- The optional Supabase migration `tina-api-proxy.sql` enables the per-user rate
  limit; without it the proxy still works (feature-detected).
