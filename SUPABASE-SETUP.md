# Supabase, Google sign-in and RaktSetu — setup

This is everything that needs a dashboard click. Do the parts in order. Until
Part 1 is done the site runs on offline demo data and says so in a banner.

Keys go in two places: `hac/.env.local` for your own computer, and Vercel →
Project → Settings → Environment Variables for the live site. The full list
with comments is in [.env.example](.env.example).

---

## Part 1 — Create the Supabase project (free tier)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Name it `dnyansetu`, region **Mumbai (ap-south-1)**, set a strong database
   password and keep it somewhere safe.
2. When it is ready: **Project Settings → API**. Copy:
   - **Project URL** → `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(secret — server only,
     never with a `VITE_` prefix, never pasted in chat)*
3. **SQL Editor → New query**. Paste all of
   [supabase/migrations/0001_core.sql](supabase/migrations/0001_core.sql) → **Run**.
   Then the same for [0002_raktsetu.sql](supabase/migrations/0002_raktsetu.sql).
   Both are safe to run again.
4. **Authentication → Sign In / Providers → Email**:
   - keep **Email** enabled
   - turn **Confirm email OFF**. Supabase's built-in mailer sends only 2 emails
     an hour, and only to your own team, so real students could never confirm.
     With it off, sign-up needs no email at all.
5. **Authentication → URL Configuration**:
   - Site URL: `https://www.dnyansetu.online`
   - Redirect URLs: add `https://www.dnyansetu.online/**` and `http://localhost:5173/**`

## Part 2 — Google sign-in

1. [console.cloud.google.com](https://console.cloud.google.com) → create a
   project `DnyanSetu` (or reuse the Firebase one — it is a Google Cloud project too).
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding):
   - App name **DnyanSetu**, support email `smuiqac@gmail.com`, upload the
     DnyanSetu logo
   - Authorized domain: `dnyansetu.online`
   - App home page `https://www.dnyansetu.online`, privacy policy
     `https://www.dnyansetu.online/privacy`, terms `https://www.dnyansetu.online/terms`
   - Audience: **External**, then **Publish app** (otherwise only test users can sign in)
3. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://www.dnyansetu.online`, `http://localhost:5173`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows this exact URL on its Google provider page)
4. Supabase → **Authentication → Sign In / Providers → Google** → enable, paste the
   **Client ID** and **Client secret** → Save.

The Google screen will say "Continue to `<project-ref>.supabase.co`". Showing
your own domain there is a paid Supabase add-on; the DnyanSetu name and logo
from step 2 are what make it look trustworthy for now.

## Part 3 — Existing Firebase users (done 2026-09-26)

All 9 Firebase accounts were copied into Supabase with their roles and quiz
history. Each one gets their Supabase password the first time they log in with
their old password (`api/legacy-login.js` checks it against Firebase, which is
kept running for exactly this). Keep `FIREBASE_API_KEY` set until all of them
have logged in once; after that the endpoint and the Firebase project can go.

## Part 4 — RaktSetu alerts

### Web push (free)
```
npx web-push generate-vapid-keys
```
- Public key → `VAPID_PUBLIC_KEY` **and** `VITE_VAPID_PUBLIC_KEY`
- Private key → `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:smuiqac@gmail.com`

Generate these once. Changing them later invalidates every browser's subscription.

### Email (Resend, free: 100/day, 3,000/month)
1. [resend.com](https://resend.com) → sign up → **Domains → Add domain** →
   `dnyansetu.online`, region Mumbai if offered.
2. Resend shows DNS records (MX + TXT for SPF on a `send` subdomain, a DKIM TXT,
   and a DMARC TXT). Add each one in **Vercel → your team → Domains →
   dnyansetu.online → DNS Records** (the domain's nameservers point to Vercel,
   so Hostinger's DNS page does nothing). Wait for Resend to show **Verified**.
   If Resend does not suggest DMARC, add: name `_dmarc`, TXT,
   `v=DMARC1; p=none; rua=mailto:smuiqac@gmail.com`.
3. **API Keys → Create** (sending access) → `RESEND_API_KEY`.
4. `RESEND_FROM=RaktSetu <alerts@dnyansetu.online>`
5. New domains often land in spam at first. Send yourself a test request to a
   Gmail address and mark it "Not spam" once.

Optional: to let students reset forgotten passwords, Supabase → **Authentication
→ Emails → SMTP Settings** → host `smtp.resend.com`, port 465, user `resend`,
password = a Resend API key, sender `DnyanSetu <no-reply@dnyansetu.online>`.
These count against the same 100/day, which is why `RESEND_DAILY_LIMIT` is 90.

### Other secrets
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Run it twice: one value for `RAKTSETU_UNSUBSCRIBE_SECRET`, one for `CRON_SECRET`.

## Part 5 — Vercel

**Settings → Environment Variables** — add every name from `.env.example`
except the `RLS_TEST_*` ones, for Production (and Preview if you use it).
Then redeploy.

`vercel.json` already sets up:
- a daily cron (`/api/cron/daily`, 08:00 IST) that keeps the free Supabase
  project from pausing after 7 idle days and closes expired requests
- a 60-second limit for the request endpoint so a large alert fan-out finishes

Vercel's Hobby plan is for non-commercial use — fine for a free college
service. Adding ads or paid features would need Pro.

## Part 6 — Check before going live

1. `npm run build` — must pass.
2. `npm run test:upload` — upload signing refuses forged tokens.
3. **RLS check** — the most important one. Create two throwaway accounts on the
   site, give both a RaktSetu profile, post one request as the first, put their
   logins in `.env.local` as `RLS_TEST_A_EMAIL/PASSWORD` and
   `RLS_TEST_B_EMAIL/PASSWORD`, then `npm run check:rls`. Every line must say
   `ok`. Delete the test accounts afterwards.
