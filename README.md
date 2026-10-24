# 🍳 Chef Universe — Kids Cooking App (V3)

**Chef Universe** (repo: LittleChefs) is a kid-friendly, all-ages cooking app. Pick a chef avatar,
enter your name, choose a **chef role** — then search for **ANY recipe in the world** by dish name or
by pasting a recipe-site / YouTube link.

V3 adds a **real PostgreSQL back end**: every chef gets a **private recipe book** guarded by
row-level security, recipes found online are **imported and mapped step-by-step with images**,
and an **onboarding interview** scales every ingredient to the number of people and writes the
**shopping list** before cooking starts.

## ✨ Highlights

### 🍛 Dish-Name AI Onboarding Cascade + 📷 OCR Scan (V3.3 — the 404 fix)
- **Just type the dish** — “Chicken Balochi Karahi from Food Fusion” now hunts automatically:
  your book → shared catalogue → the chef's own website (Food Fusion first when you ask for it) →
  **YouTube, where the recipe is read from the video description** → AI draft. A search-results
  link (e.g. `foodfusion.com/?s=…`) is followed to the real recipe page behind it.
- **Food Fusion format, understood** — quantity-at-the-end lines (`Sabut dhania (Coriander seeds) ½ tbs`),
  Roman-Urdu names, group captions and the duplicated Urdu block all parse into scalable
  ingredients and clean steps (no AI key needed).
- **📷 Scan / OCR onboarding** — when simple import can't read a source, snap a photo or screenshot:
  on-server Tesseract OCR reads it (English data bundled, photos never leave the server), you can
  fix the scanned words and re-read, then the normal AI-onboarding flow maps portions + shopping list.
  Website failures now offer one-tap **▶️ YouTube** and **📷 Scan** rescues instead of a dead end.
- **The “Something went wrong (404)” bug is fixed at the root**: production previously deployed the
  static app with **no API at all** — and, once the API existed, `api/[...path].js` still only
  matched a *single* path segment, so nested calls like `/api/chefs/sign-in` 404ed. The repo now
  ships one flat Vercel function (`api/index.js`) that every `/api/*` path is rewritten to
  (`vercel.json` + `npm run build:api`), with the original path carried through the rewrite; unknown
  routes and cold-start failures return helpful JSON, never a bare platform 404.

### ✨ What's New Tab & In-App Recipe + YouTube Browser (V3.2)
- **✨ What's New tab for every user** — accessible from the Welcome screen, top navigation bar, and Kitchen home with unread indicators and 1-tap feature launchers.
- **🌐📺 Internal Website & YouTube Channel Browser** — chef website links and YouTube channel searches load **inside Chef Universe** instead of redirecting out of the app.
- **🃏 Recipe Picker + 🖥️ Sandboxed Live Page View** — inspect extracted recipe cards or browse the sanitized webpage (with link-click interception so every click stays inside the app) and watch YouTube videos via `youtube-nocookie` embeds.
- **🤖 1-Tap AI-Powered Onboarding for Every User** — pick the exact recipe or cooking video inside the Internal Browser and import the complete recipe (ingredients, steps, timings, photos) straight into portion scaling & aisle-grouped shopping list generation.

### 🔐 Private, role-scoped recipe books (Postgres + RLS)
- Four cooking roles: **Junior Chef** (10–14), **Teen Chef** (15–19), **Adult Chef**, **Master Chef**.
- Each chef has their own book. A chef can open, edit, cook and delete **only their own** recipes —
  enforced in the database (`FORCE ROW LEVEL SECURITY`), not just hidden in the UI.
- No cross-recipe browsing: search, list, read, update and delete are all scoped to the signed-in chef.
- Optional 4-digit PIN (scrypt-hashed), bearer tokens stored only as hashes.

### 🔎 Internal-first lookup — reuse without leaking
When anyone searches a dish:
1. **Your own book** is checked first.
2. Then the **shared catalogue** of canonical recipes (seeded with the 54 built-in recipes +
   whatever senior chefs import). A match is copied into your book instantly as a **private copy**,
   with the public source credited — never the chef who imported it.
3. **Only if neither matches** does AI onboarding import it from the web.

So the same dish is never imported twice, yet no chef can see another chef's book, notes or photos.

### 🛡️ Load protection — caches, Bloom filters & rate limits
Every tap used to mean a round-trip to Postgres. The API now sheds load before it ever reaches the
database, and degrades gracefully when someone (or a buggy client) hammers it:

* **Session cache + negative cache** — a validated bearer token reuses its chef profile for 30 s;
  made-up or expired tokens are cached as "no" for 10 s, so a flood of junk credentials costs *zero*
  queries. Sign-out, profile edits and point awards invalidate immediately.
* **Bloom filter over the shared catalogue** — an in-memory index of every catalogue title, its
  dedupe key and its tokens. When a dish cannot possibly be in the catalogue ("moonbeam comet pie")
  the search skips both the catalogue query *and* the 500-row fuzzy fallback. It only ever answers
  "definitely not" (never hiding a real recipe), is updated on every write and is rebuilt from the
  database at most once a minute.
* **Negative caching for lookups** — repeat searches and 404s (missing `catalogue/:id`) are
  remembered briefly, so a chef refreshing the same dead end is answered from memory. Writes
  (save, claim, delete, import confirm) invalidate that chef's entries straight away.
* **Coalesced requests** — concurrent identical lookups share one query (`single-flight`), so ten
  taps in the same second cost one database read. The web app also de-duplicates identical GETs.
* **Cached shared catalogue** — catalogue rows are chef-independent and cached per search shape,
  while "is it in my book?" is one small cached id set instead of a per-row subquery.
* **Token-bucket rate limiting** — the old fixed window was replaced by a smooth token bucket with
  bounded, self-expiring state (no timers, no unbounded memory). Every `/api` call is capped at
  600/min per chef (per IP when signed out) on top of the route limits below, and answers `429` with
  `Retry-After` + `RateLimit-*` headers and a friendly message.
* **Hot-path indexes** — migration `003_performance_indexes.sql` adds the missing indexes for
  sign-in (`role_id, lower(display_name)`), per-chef title lookups, ownership checks, import history,
  onboarding and shopping lists.

`GET /api/health` now reports cache hit rates, Bloom-filter size and the limiter configuration, so
you can see the effect without a profiler. Everything is tunable through `CACHE_*` / `RATE_LIMIT_*`
environment variables (see `.env.example`) and can be switched off entirely with `CACHE_ENABLED=false`.

### 🤖 AI recipe onboarding (website · YouTube · pasted text)
- Accepts a recipe URL, a YouTube video link, a pasted video description, or just a dish name.
- Extraction order: `schema.org` JSON-LD → YouTube metadata + description → heuristic HTML/text
  parsing → optional LLM structuring (any OpenAI-compatible endpoint).
- **Page-clutter cleaner (V3.4)** — only real food reaches your list. A dedicated filter
  (`server/services/importer/clean.ts`) drops nutrition panels (`30.8g`, `1970kJ / 468Cal`,
  `23% of daily energy intake`), star ratings, review widgets and their dates
  (`March 2021`, `12 March 2024`, `2026-10-23T11:03-04:00`), "Print / Save Recipe / Copy text /
  Add to list / Shop recipe" buttons, sponsored blocks, related-recipe carousels and copyright
  footers. It also collapses the screen-reader duplicate most supermarket sites emit
  (`2 tsp extra virgin olive oil 2teaspoons extra virgin olive oil` → one ingredient). Sections
  end at the first "Nutrition / Description / Reviews / You might also like" heading, so the
  method never swallows a review widget — and the review screen tells you how many lines were
  left out.
- **Correct servings and timing** — `Serve is for 6 people` sets 6 servings (instead of grabbing
  the first number it finds), and `Prep 10m` + `Cook 30m` becomes a 40-minute total.
- **Clean titles** — `Healthier Spaghetti Bolognese Recipe | Woolworths` imports as
  `Healthier Spaghetti Bolognese Recipe`; the shop name never becomes part of the recipe name.
- Produces a full mapping: metadata · **ordered steps** with duration/temperature/photo ·
  **ingredients** with quantity/unit/prep note/group · **hero + per-step images** · **provenance**.
- **You review and edit everything** before it is saved to your private book.
- Import failures (paywalls, unreadable pages, no recipe in the description) return honest,
  human-readable messages — never a fabricated recipe.
- Sites that serve a cut-down page to bots are fetched with a browser-style agent
  (`IMPORT_USER_AGENT`, see `.env.example`), so the importer sees the same server-rendered
  recipe a chef sees.

### 🍽️ Onboarding interview → portions → shopping list
- **How many people are eating?** — every quantity is rescaled with kitchen-friendly rounding
  (`3 cups × 1.67 → 5 cups`, eggs stay whole, "to taste" is never scaled).
- **Breakfast / Lunch / Dinner / Late-night snack** — portion guidance adapts to the meal.
- Allergies & diets + what's already in your pantry.
- A **de-duplicated, aisle-grouped shopping list** is saved before cooking, tickable in the shop,
  and copy/print friendly.
- Role safety caps: a Junior Chef's batch is capped at 8 eaters, with a friendly explanation.

### Everything from V2 still works
- 🔮 AI Smart Finder (built-in library → cuisine clarifier → curated chefs → TheMealDB)
- 🤖 AI Top-Chef mode (“Not This”) with regional chef suggestions
- 📹 In-app YouTube (click-to-play, `youtube-nocookie`)
- ⭐ Fair-play points — now awarded **by the server**, once per unique dish
- 🎁 Rewards shop, living room, AI Buddy Studio

---

## 🚀 Run it

```bash
npm install

# terminal 1 — API + PostgreSQL (embedded PGlite, no Docker needed)
npm run dev            # starts the API + web app together; open http://localhost:5173

# Optional: run only the API in a separate terminal
npm run dev:api        # http://localhost:8787
```

The first API start creates the database, runs migrations and seeds the built-in recipes.
`.env` is optional; copy `.env.example` to change anything.

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the API and Vite web app together; Vite proxies `/api` and `/uploads` to the API |
| `npm run dev:api` | API server with watch mode on port 8787 |
| `npm run build` | Production build → one self-contained `dist/index.html` **plus** the compiled API (`dist-server/`), verified by `scripts/verify-api-build.mjs` so a static-only deploy can never ship silently |
| `npm run server` / `npm start` | API server (also serves `dist/` when built) |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Load built-in recipes into the shared catalogue |
| `npm run db:reset` | Delete the local PGlite data and rebuild |
| `npm run build:api` | Compile the API to `dist-server/` (used by the Vercel function) |
| `npm test` | 143 tests: RLS isolation, scaling, aisles, importers (incl. a recorded Woolworths recipe page), page-clutter filtering, dish cascade, OCR, SSRF, full API, Vercel routing |
| `npm run typecheck` | Type-check app + server |

### ▲ Deploying to Vercel (static app + serverless API)

The repo is deploy-ready: `vercel.json` builds the single-file app **and** compiles the API into one
flat function, `api/index.js`, which runs the full Express server. Every `/api/*` path reaches it
through an explicit rewrite — `"/api/(.*)"` → `"/api?__path=/$1"` — because Vercel's file-system
routing only supports *single-segment* parameters in `api/` (a `[...path].js` catch-all never matches
`/api/chefs/sign-in` or `/api/recipes/:id`) and because a rewrite hands the function its destination
URL, so the requested path is carried in `__path` and rebuilt in `server/vercel.ts` before Express
routing. So `/api/search`, `/api/imports/ocr`, `/api/browser/*` etc. all work in production.
**Deploying only the static build (no `api/` function) is what caused the “Something went wrong (404)” bug**;
`npm run build` fails rather than ship a deployment whose API is missing or unroutable.

- **Recommended:** set `DATABASE_URL` (Neon / Supabase / Vercel Postgres) + `DATABASE_SSL=true` in
  Vercel → Project → Settings → Environment Variables. Migrations + the 54 built-in recipes seed
  automatically on first request.
- **Demo mode (no env vars):** the API falls back to embedded PGlite stored in `/tmp`. It works, but
  `/tmp` is wiped whenever Vercel recycles an instance, so chefs/recipes may reset — use a real
  `DATABASE_URL` for anything you want to keep.
- Optional: `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` enable AI structuring of messy pages and
  AI dish drafting (the website/YouTube/OCR cascade works without them).
- Verify a deploy with `GET https://<your-app>.vercel.app/api/health` → `{"ok":true,…}`.

### Using a real PostgreSQL server

The app ships with **PGlite** — the actual PostgreSQL engine compiled to WASM — so local dev needs
no Docker. For production, point `DATABASE_URL` at any Postgres (Neon, Supabase, RDS or the
included `docker-compose.yml`) and everything else stays the same:

```bash
docker compose up -d
DATABASE_URL=postgres://chef:chef@localhost:5432/chefuniverse npm run db:migrate
DATABASE_URL=postgres://chef:chef@localhost:5432/chefuniverse npm run server
```

### Optional AI structuring

Without a key the importer still reads `schema.org` recipes and YouTube descriptions.
For messy pages, add an OpenAI-compatible endpoint:

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-…
LLM_MODEL=gpt-4o-mini
```

---

## 🧱 Tech

React 19 + TypeScript + Vite 7 · Tailwind CSS 4 · Express 5 API ·
PostgreSQL 16 (PGlite locally, `pg` for hosted) · Zod validation · `node:test`
· in-process TTL/LRU caches + Bloom filter + token-bucket limiter (no extra dependencies)
TheMealDB for online search · `youtube-nocookie` embeds.

**Docs:** [API & data model](./docs/API.md) ·
[Postgres + role + AI onboarding spec](./docs/POSTGRES_RECIPE_PLATFORM_SPEC.md) ·
[full build guide](./AGENT_BUILD_GUIDE.md)

## 🔒 Privacy notes for grown-ups

- Recipes, notes and photos live in **your chef's** rows and are protected by database RLS.
- The shared catalogue stores *recipe content only*; the importing chef's identity is kept
  for provenance and is never returned by any API response.
- Imported pages are fetched with SSRF protection, size/time limits and redirect caps.
- No email address or real name is required — a chef name and optional PIN is enough.
