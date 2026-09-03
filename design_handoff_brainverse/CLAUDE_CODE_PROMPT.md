# Claude Code kickoff prompt

Paste this into Claude Code from the root of the Brainverse repo:

---

Read `design_handoff_brainverse/README.md` and open `design_handoff_brainverse/Brainverse.dc.html` as the visual/behavioural reference. Build Brainverse as a Next.js 15 (App Router, TypeScript) app:

1. Scaffold the project, add Clerk with Google OAuth only, disable sign-ups, allowlist a single email from `OWNER_EMAIL` env, protect all routes with middleware.
2. Add Postgres (Neon or Vercel Postgres) with Drizzle. Table `notes` per the README data model; scope every row to the owner's Clerk userId.
3. Recreate the canvas exactly as specified (fonts via next/font, Hugeicons icons bundled, inline-style or CSS-module styling). Port the layout, focus/zoom, pan/pinch and auto-routing logic from the prototype's logic class.
4. Optimistic local state with server sync (server actions or route handlers). Keep `view` and rail collapsed state per user.
5. Add `vercel.json`/README notes for deploying to Vercel with a custom subdomain via CNAME and the Clerk production domain.

Work in small commits; run `npm run build` before finishing.
---
