# Brainverse

A private, single-user "external brain": an infinite space canvas where notes live in floating areas, reshuffled by Categories / Projects / Priority. Built from the design handoff in `design_handoff_brainverse/`.

Live: https://brainverse.mooibekeken.nl (Google login, one allowed account).

## Stack

- Next.js 16 (App Router, TypeScript), deployed on Vercel
- Auth.js v5 with Google OAuth; access limited to the email(s) in `OWNER_EMAIL`
- Postgres (Neon / Supabase / Vercel Postgres) via Drizzle; tables are created automatically on first use
- Fonts via `next/font` (Oxygen, Space Grotesk); Hugeicons bundled from `@iconify-json/hugeicons` (`npm run icons`)

## Local development

```bash
cp .env.example .env.local   # fill in AUTH_SECRET at least
DEV_LOGIN=1 npm run dev      # adds a "Dev login" button on /login (development builds only)
```

Without `DATABASE_URL` the app runs in local-only mode: notes are kept in the browser's localStorage and the top bar shows `LOCAL ONLY`.

## Environment variables

| Name | What |
| --- | --- |
| `AUTH_SECRET` | Random secret for session cookies (`npx auth secret` or `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth web client. Redirect URI: `https://brainverse.mooibekeken.nl/api/auth/callback/google` |
| `OWNER_EMAIL` | The Google account that may sign in (comma-separate for more) |
| `DATABASE_URL` | Postgres connection string (pooled). Optional: without it the app is local-only |
| `DEV_LOGIN` | `1` enables the passwordless dev door. Only honoured when `NODE_ENV=development`, so never on Vercel |

## Google Calendar

Every note tile has a small calendar button, and the note panel has a "Plan on Google Calendar" block (date, time, duration). Both open Google Calendar's event editor prefilled with the note text, its comments and a link back; nothing is written to the calendar until you press Save there. No Calendar API scopes are needed, so the Google OAuth client only ever asks for basic profile + email.

## Deploying

1. Push to GitHub; the Vercel project is connected to the repo, so `main` deploys to production.
2. In Vercel → Settings → Environment Variables set the variables above.
3. Storage: Vercel → Storage → Create → Neon (or paste any Postgres URL as `DATABASE_URL`). Tables appear on first request.
4. Domain: `brainverse.mooibekeken.nl` is added to the project; DNS needs a CNAME `brainverse` → `cname.vercel-dns.com`.

## Keyboard

`N` new note · `Shift+Enter` new note inside the current area · `Tab`/`Shift+Tab` cycle views · `↑` dive in · `↓` step out · `←`/`→` siblings · `Esc` back/close.
