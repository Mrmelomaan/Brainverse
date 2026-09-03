# Handoff: Brainverse — Infinite Canvas Brain Dump Dashboard

## Overview
Brainverse is a private, single-user "external brain": an infinite pannable/zoomable space canvas where notes live inside floating areas (clusters). The canvas reshuffles between three views (Categories / Projects / Priority), notes are captured through a frictionless quick-add popup with keyword auto-routing, and every note can be opened for editing and commenting. Target deployment: a custom subdomain (CNAME) with Google login restricted to one account.

## About the Design Files
`Brainverse.dc.html` is a **design reference built in HTML** — a working prototype that shows intended look and behaviour. It is not production code to copy. Recreate it in the app framework (recommended below), using its conventions. The prototype's logic (layout algorithm, focus/zoom math, routing rules, drifter animation) is compact JavaScript and can be ported nearly 1:1.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and interactions are final. Recreate pixel-accurately.

## Recommended stack (no existing codebase — repo `Mrmelomaan/Brainverse` is empty)
- **Next.js 15 (App Router) + TypeScript**, deployed on **Vercel** (custom subdomain via CNAME to `cname.vercel-dns.com`).
- **Clerk** for auth: Google OAuth only. Enforce single user via Clerk **Allowlist** (Restrictions → Allowlist → the one Gmail address) and disable sign-ups. Middleware protects every route; unauthenticated → Clerk sign-in.
- **Persistence:** Vercel Postgres/Neon with Drizzle, or Supabase. Single `notes` table (schema below). Prototype uses `localStorage`; keep an optimistic local cache and sync.
- Fonts via `next/font/google`: Oxygen (400, 700), Space Grotesk (400, 500).
- Icons: **Hugeicons** (MIT). Prototype loads them from Iconify (`https://api.iconify.design/hugeicons:<name>.svg?color=%23<hex>`); in production install `@hugeicons/react` or `@iconify/react` and bundle.

## Data model
```ts
type Note = {
  id: string;
  text: string;
  category: 'sport'|'food'|'habits'|'business'|null;
  project: 'vita'|'mb'|'acq'|'client'|null;
  priority: 1|2|3|null;
  done: boolean;
  comments: { id: string; text: string; at: string /* ISO */ }[];
  createdAt: string; // creation order is the tiebreak sort
};
type View = 'category'|'project'|'priority';
type Focus = null | { type:'cluster'; key:string } | { type:'note'; key:string; noteId:string };
// persisted per user: notes[], view, rails: { _un:boolean; _done:boolean } (collapsed state)
```

### Dimensions (labels, icons, hues)
Categories: Sport `dumbbell-01` hue 150 · Food `restaurant-02` hue 60 · Habits `repeat` hue 310 · Business `briefcase-01` hue 240.
Projects: Vita `smart-phone-01` · Mooi Bekeken `camera-01` · Aquisitie `target-01` · Client projects `user-group` (later: one per named client).
Priorities: P1 · Now `flash` · P2 · Soon `clock-01` · P3 · Someday `moon`.
System areas: Unsorted `inbox` · Done `checkmark-circle-02`. Comment bubble `comment-01`, delete `delete-02`.

## Screens / Views

### 1. Canvas (single screen, full viewport)
Background: `radial-gradient(ellipse at 30% 20%, #1c1130 0%, #120a1f 55%, #0b0616 100%)`, `overflow:hidden; touch-action:none; cursor:grab` (grabbing while dragging).

**Sky layer (behind world, pointer-events none):**
- 170 stars, seeded random positions in a layer inset −20%; size 1–2.2px (15% are 2.2–3.6px with `0 0 6px 1px rgba(255,255,255,.6)` glow); opacity .35–1; twinkle `@keyframes tw {0%,100%{opacity:.2}50%{opacity:1}}` 2.5–7.5s ease-in-out, staggered negative delay. Parallax: `translate(pan.x*.12, pan.y*.12)`.
- Planet: 380px circle at `left:-120px; bottom:-160px`, `radial-gradient(circle at 35% 30%, oklch(48% 0.14 300), oklch(30% 0.1 290) 45%, #0d0716)`, shadow `0 0 80px rgba(150,110,255,.15), inset -40px -30px 80px rgba(0,0,0,.6)`, ring 560×120 ellipse border `2px rgba(255,255,255,.14)` rotated −18°. Parallax ×.05.
- 5 drifters (rocket, satellite, astronaut, cat, comet), CSS-shape sketches in `#d9d2ea` / `#8f86a6` (see prototype `sky()` for exact geometry), opacity .55. On load each gets random: direction (left/right), vertical position 6–84%, duration 150–260s (comet 80–120s), negative delay 0–200s, spin direction and spin period 45–110s. Keyframes: `driftR` translateX −20vw→120vw, `driftL` reverse, comet `diagR` translate(−20vw,−10vh)→(120vw,45vh) / `diagL` mirrored; the comet is rotated `atan2(.55·vh, dir·1.4·vw)` so the head leads and the tail trails. Tweak `ambientMotion`: subtle (×1), lively (durations ×.35), off (no twinkle/spin). Tweak `showDrifters`.

**World layer:** `transform-origin:0 0; transform: translate(pan) scale(zoom)`. Transition `transform .85s cubic-bezier(.2,.8,.2,1)` only when a programmatic "glide" is happening (focus, back, view switch, rail toggle); none while dragging/wheeling.

**Top bar** (absolute, full width, padding 22px 28px desktop / 14px mobile, backdrop `linear-gradient(180deg, rgba(18,10,31,.92), rgba(18,10,31,.6) 65%, transparent)`, pointer-events only on children):
- Left: wordmark "BRAINVERSE" Oxygen 700 16px (13px mobile), letter-spacing .28em uppercase, `#f3eefc`, text-shadow `0 0 18px rgba(201,184,255,.55)`. When focused: pill button "← Overview" (cluster focus) / "← Area" (note focus): Oxygen 9.5px .16em uppercase, padding 8px 12px, border `1px rgba(255,255,255,.16)`, bg `rgba(255,255,255,.06)`, blur 10px. Meta "NN OPEN · NN DONE" Oxygen 10px .14em `rgba(236,230,245,.4)` (hidden on mobile and when focused).
- Right: view switcher pill (padding 4px, gap 4px, bg `rgba(255,255,255,.05)`, border `1px rgba(255,255,255,.1)`, blur 12px). Buttons CATEGORIES / PROJECTS / PRIORITY: Oxygen 10px .16em uppercase, padding 9px 14px, min-height 34px, radius 999. Active: bg `rgba(255,255,255,.14)`, border `rgba(255,255,255,.3)`, color `#f3eefc`; inactive: transparent, `rgba(236,230,245,.55)`; hover white.

**Floating area (cluster)** — absolutely positioned in world space, `width W`, `transform: translate(x,y)` with `transition: transform .8s cubic-bezier(.2,.8,.2,1), opacity .45s, width .5s`.
- Padding 18px 16px 16px, radius 22px, border `1px rgba(255,255,255,.08)` (hover .16), bg `rgba(255,255,255,.028)` (focused `.05`), inset highlight `inset 0 1px 0 rgba(255,255,255,.05)`. Cursor pointer (default when it is the focused cluster).
- Header (flex, space-between, margin-bottom 14px): icon 28px (opacity .95) + title Oxygen 700 18px, letter-spacing .02em, normal case (e.g. "Sport", "Mooi Bekeken", "Unsorted") `#f3eefc` text-shadow `0 0 16px rgba(243,238,252,.35)`; right side count zero-padded ("03") Oxygen 10px .1em `rgba(236,230,245,.4)`, plus collapse button on rails (24px circle, border `1px rgba(255,255,255,.14)`, bg `.05`, glyph ‹ › ▴ ▾).
- Empty state text "Nothing here yet" 13px italic `rgba(236,230,245,.32)`.
- Notes grid: flex-wrap, gap 10px; each note `flex:1 1 calc(50% - 5px); min-width 130px`.
- **Collapsed rail** (Unsorted/Done only): width 56px, min-height 200px, padding 16px 12px, column layout: icon 20px, vertical label (`writing-mode: vertical-rl`, Oxygen 700 11px .04em, normal case), count, expand button. On mobile the collapsed rail is a 52px-high full-width row.

**Note tile** — solid fill, no border, radius 14px, padding 12px 12px 10px, shadow `0 6px 20px rgba(0,0,0,.25)`, hover `brightness(1.06)`, cursor pointer.
- Fill by category: `oklch(85% 0.12 <hue>)` (done: `oklch(78% 0.12 <hue>)`); no category: `#ece6f5` (done `#cfc7dd`). Done notes also opacity .6 and line-through.
- Text: Space Grotesk 500 14px / 1.35, `#120a1f`, `text-wrap: pretty`, padding-right 22px.
- Meta row (margin-top 10px, gap 8px, min-height 14px): 14px icons (`#120a1f`, opacity .75) for the *other* dimensions — Categories view shows project + priority icons, Projects view shows category + priority, Priority view shows project + category. Right-aligned comment bubble icon 13px + count (11px) when comments exist.
- Done toggle: 20px circle top 9px right 9px, border `1.5px rgba(18,10,31,.4)`, transparent; done: bg `#120a1f`, `✓` in `#f3eefc`; hover fills `#120a1f`.
- New/changed note flashes `bv-flash 1.2s` (expanding white shadow).

**Quick-add FAB:** 60px circle, bottom-right 32px (mobile: bottom 26px centered), `radial-gradient(circle at 30% 30%, #e6dcff, #a98cff 45%, #6b45e6)`, border `1px rgba(255,255,255,.3)`, shadow `0 0 34px rgba(169,140,255,.55), 0 10px 30px rgba(0,0,0,.4)`, "+" 30px weight 300 `#120a1f`, hover scale 1.06. Hidden on mobile while the note panel is open. Keyboard: `N` opens.

**Toast:** centered, bottom 112px (104 mobile), padding 10px 16px, radius 999, bg `rgba(255,255,255,.1)`, border `.18`, blur 12px, Oxygen 10px .16em uppercase, `bv-pop .3s`, auto-hide 2.2s. Messages: "Auto-routed to Sport", "Dropped in Vita", "Dropped in Unsorted", "Moved to Done", "Back on the canvas", "Note deleted".

### 2. Quick-add popup ("Brain dump")
Full-screen scrim `rgba(8,4,16,.62)` + blur 6px; click scrim or Esc closes. Card max-width 520px (mobile: bottom sheet, padding 0 10px 10px), radius 24px, padding 22px 22px 18px, bg `rgba(255,255,255,.09)`, border `1px rgba(255,255,255,.16)`, blur 24px saturate 1.2, shadow `0 30px 80px rgba(0,0,0,.5)`, `bv-pop .25s`.
- Header: "Brain dump" Oxygen 11px .22em uppercase `#c9b8ff`; hint "Enter to add · Esc to close" 11px `rgba(236,230,245,.4)`.
- Textarea (autofocus) placeholder "What's on your mind?", 20px/1.35 `#f3eefc`, transparent, caret `#c9b8ff`, 3 rows. Enter submits (Shift+Enter newline).
- Three chip rows on a grid `60px 1fr`, row-gap 12px: labels LIFE / PROJECT / PRIORITY (Oxygen 9px .18em uppercase `rgba(236,230,245,.4)`). Chips: height 30px, padding 0 10px 0 8px, radius 999, 12px text, 13px icon, gap 6px. Unselected: bg `rgba(255,255,255,.06)`, border `rgba(255,255,255,.14)`, text `#cfc7dd`; selected: dark text `#120a1f`, no border, bg `rgba(255,255,255,.9)` — category chips use their hue `oklch(85% 0.12 hue)`. Click a selected chip to clear it (priority stays unset by default).
- Footer: routing hint 12px `rgba(236,230,245,.45)` — "Tags optional, it finds its own cluster" / "Looks like Sport, will route there" / "Ready to drop" / "No match yet, lands in Unsorted". Button "Drop it": Oxygen 10px .18em 700, padding 12px 20px, `linear-gradient(135deg,#c9b8ff,#7f5cf0)`, `#120a1f`, shadow `0 0 24px rgba(169,140,255,.4)`; opacity .45 while empty.

**Auto-routing** (only when neither category nor project chosen; first regex match wins, case-insensitive):
`run|gym|padel|train|stretch|bike|swim|workout`→Sport · `meal|eat|food|snack|sugar|cook|lunch|dinner`→Food · `read|sleep|phone|habit|journal|meditat|wake`→Habits · `invoice|rate|tax|numbers|revenue|boekhoud|kvk`→Business · `vita`→Vita · `blog|portfolio|site|website|seo|mooi bekeken`→Mooi Bekeken · `lead|linkedin|follow.?up|acquisitie|aquisitie|pitch|offerte`→Aquisitie · `client|klant|deliver|shoot`→Client projects. Extend with an LLM classifier later if wanted.

### 3. Note panel (edit + comments)
Opens together with note focus. Desktop ≥900px: `right:24px; top:50%; translateY(-50%); width:380px; max-height:calc(100vh - 48px)`; 640–900: bottom-centered `width:min(480px, 100vw - 32px)`, max-height 52vh; mobile: bottom sheet `left/right 10px; bottom 10px; max-height 58vh`. Radius 24px, padding 20px 20px 16px, border `1px` tinted `oklch(80% 0.13 hue / .35)` (neutral `rgba(255,255,255,.25)`), bg `linear-gradient(180deg, oklch(80% 0.13 hue / .14), rgba(255,255,255,.07))` (neutral `rgba(255,255,255,.09)`), blur 24px, `bv-pop .25s`. Sections gap 14px.
- Header "Note" (Oxygen 11px .22em uppercase `#c9b8ff`) + 28px × close (back one level).
- Textarea bound to note text, 18px/1.35, edits save immediately.
- Chip grid identical to quick-add, bound to the note (toggle to set/change/remove category, project, priority).
- Comments block (top border `1px rgba(255,255,255,.1)`): label "Comments · N". Carousel: ‹ › buttons 30px wide radius 12px; card padding 12px 36px 12px 14px, radius 14px, bg `rgba(255,255,255,.07)`, border `.12`; comment text 14px/1.4; footer 11px `rgba(236,230,245,.4)` with timestamp ("Thu 21:38" — use locale short weekday + HH:mm) and position "2 / 5". Trash icon button 24px top-right (opacity .55 → 1 on hover) deletes the shown comment. Input placeholder "Add a comment, Enter to save": padding 10px 12px, radius 12px, bg `.05`, border `.12`, focus border `rgba(201,184,255,.6)`; Enter appends and jumps to the new comment.
- Footer: "Delete note" pill (border `.16`, bg `.05`, hover red `#ff9a9a`) and "Mark done"/"Reopen" pill — white `rgba(255,255,255,.92)` with `#120a1f` 700 text.

## Layout algorithm (world coordinates)
- Desktop: `W=340`, rail width 280 (collapsed 56), `gapX=44`, `gapY=44`. Unsorted rail at x=0 (always left). Centre grid starts at `x0 = leftW + gapX`, columns `cols = clamp(floor((vw − 48 − leftW − rightW − gapX) / (W+gapX)), 1, 3)`; clusters fill row by row, each row's y = previous row top + max estimated height in that row + gapY (tops aligned per row). Done rail at `x0 + cols·(W+gapX)` (always right). `worldW = x0 + cols·(W+gapX) + rightW`.
- Mobile (<640): single column `W = min(360, vw−28)`: Unsorted row on top, clusters, Done row at bottom.
- Estimated cluster height `74 + rows·94 + (rows−1)·10` (44 if empty), rows = ceil(n/2). Measure real heights in production if you want tighter packing.
- Overview fit: `zoom = min(1, (vw−32)/worldW)`, `pan = ((vw − worldW·zoom)/2, 120)` (96 mobile). Recompute on view switch, rail toggle, resize.
- Sorting inside an area (Categories/Projects views): P1 → P2 → P3, then unprioritised in creation order. Priority view groups by priority; Unsorted holds notes without the current view's dimension; Done holds `done:true` in every view.

## Interactions & Behaviour
- **Pan:** pointer drag anywhere on the canvas (mouse or touch). Only start capturing/panning after 4px of movement so plain clicks still reach areas/notes. `moved` flag suppresses click handlers after a drag.
- **Zoom:** wheel (`zoom *= exp(−deltaY·0.0018)`, clamp .3–3.4, about cursor) and two-finger pinch (about midpoint). `preventDefault` on wheel (passive:false).
- **Focus levels:** overview → area → note.
  - Click area: `scale = clamp(min((vw−40)/w, (vh−150)/h), .6, 1.9)`, centre horizontally, top ≥ 96px; other areas fade to opacity 0 and become non-interactive.
  - Click note: measure its DOM rect → world rect; `scale = clamp(min(380/nw, (vh−200)/nh), 1.2, 3)` (mobile `clamp(min((vw−60)/nw, .34·vh/nh), 1, 2.6)`); centre note in the region left of the panel (`(vw−420)/2`) or at 22% height on mobile; sibling notes dim to opacity .18; panel opens.
  - Back one level: zoom out below `focusZoom·0.8` (wheel or pinch), Esc, click empty canvas, the ← button, or × on the panel. A 700ms cooldown after each focus change ignores further zoom so one gesture lands exactly on the next level.
- **Collapse rails:** button in header; collapsed rail click expands. Persist per user. Recentre overview after toggle (unless focused).
- **Mark done:** tile checkbox or panel button → moves to Done (flash + toast). Reopen from Done.
- **Delete note:** from panel, returns to area focus.
- **Keyboard (all ignored while typing in a field):**
  - `N` opens quick-add. `Shift+Enter` opens quick-add *here*: inside an area it preselects that area's category / project / priority (matching the current view); from a focused note it first glides back to the area (~450ms), then opens the popup.
  - `Tab` / `Shift+Tab` cycle the views Categories → Projects → Priority (returns to overview).
  - `↑` dives one level deeper (overview → first non-rail area → its first note); `↓` steps back out one level.
  - `←` / `→` move between siblings at the current level: areas (skipping collapsed rails) in area focus, notes in display order in note focus; wraps at the ends. Note focus re-measures the target tile's DOM rect and maps it through the world's live transform matrix (so it works mid-glide).
  - `Esc` closes the popup or steps back one level. In the quick-add textarea Enter submits, Shift+Enter inserts a newline.
- Persist: notes, view, rail state. Prototype uses localStorage keys `brainverse.notes|view|rails`.

## Auth & deployment requirements
- Google OAuth only via Clerk; allowlist exactly one email; block sign-up; protect all routes (middleware `auth.protect()`); API routes check `userId` matches the owner id from env.
- Custom subdomain: add domain in Vercel, create CNAME `brain` (or chosen name) → `cname.vercel-dns.com`. Set Clerk production instance domain accordingly.
- Everything is private; no sharing, no public routes besides the sign-in page.

## Design tokens
Colors: bg `#120a1f` (deep `#0b0616`, mid `#1c1130`), text `#f3eefc` / `#ece6f5`, muted `rgba(236,230,245,.4–.55)`, lavender accent `#c9b8ff`, violet `#7f5cf0` / `#6b45e6` / `#a98cff`, ink `#120a1f`, note neutral `#ece6f5`, danger `#ff9a9a`. Category hues (oklch, L 85% C .12): 150 / 60 / 310 / 240.
Type: Oxygen 700 for wordmark, area titles, labels and buttons (wordmark/tabs/small labels uppercase with .16–.28em tracking; area titles normal case 18px .02em); Space Grotesk 400/500 for note text and UI copy.
Radii: 999 pills · 24 panels · 22 areas · 14 notes/cards · 12 inputs.
Glass: `rgba(255,255,255,.05–.11)` + `backdrop-filter: blur(10–24px)`.
Motion: glide `.8–.85s cubic-bezier(.2,.8,.2,1)`; pop `.25–.3s`; opacity `.4–.45s`.

## Assets
- Hugeicons (MIT) via Iconify in the prototype; bundle in production.
- Google Fonts: Oxygen, Space Grotesk.
- Sky objects are pure CSS shapes (no image assets). Owner may later supply SVG/PNG icons for the drifters.

## Files
- `Brainverse.dc.html` — the full prototype (template + logic in one file; requires `support.js` runtime to run standalone, but all values above are lifted from it).
- `github.md` — repo association (`Mrmelomaan/Brainverse`, currently empty).
