# DnyanSetu

**Knowledge, opportunities and student services — all in one place.**

DnyanSetu is the student web platform for **Chhatrapati Shivajiraje Mahavidyalaya, Udgir** (Kisan Shikshan Prasarak Mandal's). It brings a college's study material, practice tests, question papers, scholarships and student-led services together behind a single bilingual (English / मराठी) interface.

🔗 **Live:** [www.dnyansetu.online](https://www.dnyansetu.online)

---

## Features

- **📚 Subject-wise Notes** — Unit-wise notes uploaded by faculty, sorted by branch, semester and subject. Members only (notes are faculty material).
- **📝 Quiz & Practice Tests** — Beginner, Intermediate and Advanced practice sets per year and branch. Clear all three to unlock the final exam; attempts are recorded against the student's account.
- **📄 Question Papers** — Links out to the college's own previous-year question paper archive (UG + PG, all semesters), kept current by the college.
- **🎓 Scholarships** — Government and institutional scholarships with eligibility and required documents.
- **🩸 RaktSetu** — The student blood-donation network. A full section inside the same site, on the same domain and sign-in, connecting patients who need blood with student and staff volunteers nearby. Runs its own push-notification and email alert flow.

Notes and quizzes require an account; question papers, scholarships and RaktSetu stay open so prospective students can see what the college offers.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | **Vite 6** + **React 18** (code-split, lazy-loaded pages) |
| Icons / UI | lucide-react |
| Auth + Database | **Supabase** (email + Google sign-in, Postgres, Row-Level Security) |
| File uploads | **Cloudinary** (signed uploads only) |
| Transactional email | **Resend** (RaktSetu alerts) |
| Web push | **web-push** (VAPID) |
| Serverless API | **Vercel** functions under `/api` + a daily cron |
| Hosting | Vercel |

Until the Supabase keys are set, the app runs on offline demo data and says so in a banner.

---

## Project structure

```
dyansetu/
├── api/                      # Vercel serverless functions
│   ├── _lib/                 # shared server helpers (supabase admin, alerts, tokens)
│   ├── cron/daily.js         # daily job: keeps Supabase awake, expires old requests
│   ├── raktsetu/             # push-subscription, requests, unsubscribe
│   ├── legacy-login.js       # legacy (Firebase) account migration
│   └── sign-upload.js        # signs Cloudinary uploads server-side
├── src/
│   ├── App.jsx               # app shell, routing, landing page
│   ├── quiz/                 # practice tests
│   ├── notes/                # subject notes
│   ├── raktsetu/             # blood-donation network
│   ├── legal/                # terms & privacy
│   ├── data/                 # quiz banks, note streams, scholarship resources
│   ├── lib/                  # supabase, auth, profiles, i18n, admin session
│   └── utils/
├── supabase/migrations/      # database schema & security (0001…0009)
├── scripts/                  # RLS checks, upload-signing tests, quiz smoke tests
├── SETUP.md                  # full setup walkthrough
└── SUPABASE-SETUP.md         # Supabase-specific walkthrough
```

---

## Getting started

### Prerequisites
- Node.js **24.x**
- Free accounts: [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com), [Resend](https://resend.com)

### Run locally

```bash
npm install
npm run dev        # http://localhost:5173 — the /api functions run too
npm run build      # production build into dist/
npm run preview    # preview the production build
```

### Environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill it in. Keys with a
`VITE_` prefix are compiled into the browser bundle; everything else stays on
the server. **Never** give the Cloudinary API secret or the Supabase service
role key a `VITE_` prefix.

| Client (`VITE_`) | Server |
| --- | --- |
| `VITE_SUPABASE_URL` | `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `VITE_CLOUDINARY_CLOUD_NAME` | `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_UPLOAD_PRESET` |
| `VITE_VAPID_PUBLIC_KEY` | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` |
| | `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_DAILY_LIMIT` / `RESEND_MONTHLY_LIMIT` |
| | `RAKTSETU_UNSUBSCRIBE_SECRET` / `CRON_SECRET` / `PUBLIC_SITE_URL` |

Full setup instructions, including the Cloudinary signed upload preset and the
Supabase walkthrough, are in **[SETUP.md](SETUP.md)** and
**[SUPABASE-SETUP.md](SUPABASE-SETUP.md)**.

### Checks

```bash
npm run test:upload   # upload signing refuses forged/expired sessions
npm run check:rls     # database security (RLS) rules
```

---

## Administration

A single address holds the admin role, and the database enforces it
(`admin_email()` in `supabase/migrations/0001_core.sql`) — no one can grant
themselves admin from the browser. To move the role: change that function,
re-run the migration, and update `ADMIN_EMAIL` in `src/App.jsx`.

---

## Deployment

Push to `main` on GitHub; **Vercel** builds and deploys automatically. A daily
Vercel cron (`/api/cron/daily`) keeps the free Supabase project awake, expires
old blood requests and applies RaktSetu's data-retention rules.

---

## License

© Chhatrapati Shivajiraje Mahavidyalaya, Udgir. All rights reserved unless a
`LICENSE` file states otherwise.
