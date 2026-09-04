# Brainverse

An invite-only "external brain": an infinite space canvas where notes live in floating areas, reshuffled by Categories / Projects / Priority. Built from the design handoff in `design_handoff_brainverse/`.

Live: https://brainverse.mooibekeken.nl (Google login; only emails on the invite list get in, everyone else lands in a waiting room).

## Stack

- Next.js 16 (App Router, TypeScript), deployed on Vercel (Hobby, region `fra1`)
- Auth.js v5 with Google OAuth. Any verified Google account can hold a session; the invite list (`allowed_emails` table) decides who may enter. Checked on every data request, so removing an email locks the door at once.
- Neon Postgres (Frankfurt) via Drizzle. Schema changes are versioned in `drizzle/` and applied by hand from a laptop.
- Fonts via `next/font` (Oxygen, Space Grotesk); Hugeicons bundled from `@iconify-json/hugeicons` (`npm run icons`)
- No AI, no analytics, no third-party scripts. Google Calendar is a prefilled link, not an API.

## How access works

1. Someone signs in with Google. If their email is on the list they are in; if not, they see the waiting room, which shows the address they used and asks them to message Rob. Their attempt is recorded in `access_requests` (one row per Google account, never expires).
2. Rob adds them from his laptop: `npm run db:allow -- add jan@gmail.com "Jan from padel" --prod`. They reload and walk in. No deploy.
3. `npm run db:allow -- list --prod` shows who is in and who is waiting.
4. Every account gets four tutorial notes on its first load. Categories are fixed; projects are per user and created inside the app.
5. Users can export everything as JSON and delete their own account from the menu. Deleting also removes their invite.

Rows are keyed on the Google `sub` id (`users.id`), never the email, so an email change does not orphan anyone's notes.

## Local development

You need a database: the app no longer runs without one. Make a Neon branch for development (Neon console → Branches) and put its URLs in `.env.local`.

```bash
cp .env.example .env.local     # fill in AUTH_SECRET, DATABASE_URL (dev branch), DEV_LOGIN=1
npm run db:migrate             # applies drizzle/ to the dev branch
DEV_LOGIN=1 npm run dev        # adds a "Dev login" button on /login (development builds only)
```

The dev login bypasses the invite list and signs in as `DEV_EMAIL` (default `dev@localhost`).

## Database scripts

All of these read `.env.local` by default and `.env.production.local` with `--prod`. Fetch the latter once with:

```bash
vercel env pull --environment=production .env.production.local
```

| Command | What |
| --- | --- |
| `npm run db:backup -- --prod` | Dumps every table to `backups/brainverse-prod-<time>.json`. **Run before every migration.** No `pg_dump` needed. |
| `npm run db:restore -- backups/<file>.json --prod --yes` | Replaces every table with the backup's contents. |
| `npm run db:generate` | After editing `db/schema.ts`: writes `drizzle/NNNN_*.sql`. Read the SQL before applying it. |
| `npm run db:migrate -- --prod` | Applies pending migrations. Never runs on deploy. |
| `npm run db:allow -- add\|remove\|list …` | The invite list. |
| `npm run db:migrate-owner -- <email> --prod` | One-off: moves rows keyed on an email to that account's `sub`. See the script header. |

Neon's free plan keeps a short point-in-time window (hours). The JSON backup is the real safety net.

## Environment variables

| Name | What |
| --- | --- |
| `AUTH_SECRET` | Random secret for session cookies (`npx auth secret` or `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth web client. Redirect URI: `https://brainverse.mooibekeken.nl/api/auth/callback/google`. The consent screen must be user type **External** and **published**, or only Workspace accounts can sign in. Only `email` and `profile` scopes are used, so no verification review is needed. |
| `DATABASE_URL` | Pooled Postgres connection string. Required. |
| `DATABASE_URL_UNPOOLED` | Direct connection, used by migrations and backups. Optional, falls back to `DATABASE_URL`. |
| `DEV_LOGIN` / `DEV_EMAIL` | `1` enables the passwordless dev door. Only honoured when `NODE_ENV=development`, so never on Vercel. |

`OWNER_EMAIL` is gone: the invite list lives in the database.

## Going live with the invite list (first time)

1. `vercel env pull --environment=production .env.production.local`
2. `npm run db:backup -- --prod`
3. `npm run db:migrate -- --prod`
4. `npm run db:allow -- add hallo@mooibekeken.nl "Rob" --prod`
5. Deploy (push to `main`). Sign in once; this creates your `users` row and plants the tutorial notes.
6. `npm run db:migrate-owner -- hallo@mooibekeken.nl --prod` moves your existing notes and prefs to the new key. Reload.
7. Remove `OWNER_EMAIL` from the Vercel project's environment variables.
8. Google Cloud console → OAuth consent screen: switch from Internal to External, then Publish.

## Google Calendar

Every note tile has a small calendar button, and the note panel has a "Plan on Google Calendar" block (date, time, duration). Both open Google Calendar's event editor prefilled with the note text, its comments and a link back; nothing is written to the calendar until you press Save there. No Calendar API scopes are needed.

## Deploying

1. Push to GitHub; the Vercel project is connected to the repo, so `main` deploys to production.
2. Migrations are **not** part of the deploy. Apply them first from your laptop (see above).
3. Domain: `brainverse.mooibekeken.nl` is added to the project; DNS needs a CNAME `brainverse` → `cname.vercel-dns.com`.

## Keyboard

`N` new note · `Shift+Enter` new note inside the current area · `Tab`/`Shift+Tab` cycle views · `↑` dive in · `↓` step out · `←`/`→` siblings · `Esc` back/close.

## Touch

On phones (viewport under 640px): pinch out (spread two fingers) over an area or note to zoom into it, pinch in to step back out; swipe `←`/`→` to cycle views in the overview or to move between sibling areas/notes. A pinch that stops halfway settles back onto the current level. One finger drags to pan; tapping `+` while an area is focused drops the new note into that area.
