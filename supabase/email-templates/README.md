# TINA — Supabase email templates

Branded (Nanobanana-style) emails for the Supabase Auth flows.

## Password reset — install

> Email delivery already works (the default Supabase reset email sends fine).
> This just swaps the look to the TINA brand. Two ways:

**A) One command (Management API).** Get a token from
https://supabase.com/dashboard/account/tokens, then:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_xxx"
powershell -File supabase/apply-email-template.ps1
```

(In this session prefix with `!` so it runs in your shell.)

**B) Dashboard paste (no token).**

1. Supabase Dashboard → **Authentication → Email Templates → "Reset Password"**.
2. **Subject:** `Reset your TINA password 🍌`
3. **Message body (HTML):** paste the contents of [`reset-password.html`](./reset-password.html).
   Keep the `{{ .ConfirmationURL }}` variable — Supabase fills it with the
   one-time recovery link.

## Required redirect URL

The app sends the reset link back to `/reset-password`. Add it to the allow-list:

- Supabase Dashboard → **Authentication → URL Configuration → Redirect URLs** →
  add `https://tina-adie1.netlify.app/reset-password` (and your local
  `http://localhost:3000/reset-password` for dev).

## Notes

- The mascot image is loaded from `https://tina-adie1.netlify.app/tina-mascot.png`
  (absolute URL — email clients can't use relative paths). If you move the
  primary domain, update that `<img src>`.
- Everything is inline-styled + table-based for Gmail / Outlook / Apple Mail
  compatibility.
- Signup is auto-confirm (`mailer_autoconfirm: true`), so there is no
  confirmation email; this reset template is the main learner-facing mail.
