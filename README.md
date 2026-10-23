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
  static app with **no API at all**, so every `/api/*` call 404ed. The repo now ships a Vercel
  serverless API (`vercel.json` + `api/[...path].js` + `npm run build:api`); unknown routes and
  cold-start failures return helpful JSON, never a bare platform 404.

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

### 🤖 AI recipe onboarding (website · YouTube · pasted text)
- Accepts a recipe URL, a YouTube video link, a pasted video description, or just a dish name.
- Extraction order: `schema.org` JSON-LD → YouTube metadata + description → heuristic HTML/text
  parsing → optional LLM structuring (any OpenAI-compatible endpoint).
- Produces a full mapping: metadata · **ordered steps** with duration/temperature/photo ·
  **ingredients** with quantity/unit/prep note/group · **hero + per-step images** · **provenance**.
- **You review and edit everything** before it is saved to your private book.
- Import failures (paywalls, unreadable pages, no recipe in the description) return honest,
  human-readable messages — never a fabricated recipe.

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
npm run dev:api        # http://localhost:8787

# terminal 2 — web app (proxies /api → 8787)
npm run dev            # http://localhost:5173
```

The first API start creates the database, runs migrations and seeds the built-in recipes.
`.env` is optional; copy `.env.example` to change anything.

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite web app (proxies `/api` and `/uploads` to the API) |
| `npm run dev:api` | API server with watch mode on port 8787 |
| `npm run build` | Production build → one self-contained `dist/index.html` |
| `npm run server` / `npm start` | API server (also serves `dist/` when built) |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Load built-in recipes into the shared catalogue |
| `npm run db:reset` | Delete the local PGlite data and rebuild |
| `npm run build:api` | Compile the API to `dist-server/` (used by the Vercel function) |
| `npm test` | 91 tests: RLS isolation, scaling, aisles, importers, dish cascade, OCR, SSRF, full API |
| `npm run typecheck` | Type-check app + server |

### ▲ Deploying to Vercel (static app + serverless API)

The repo is deploy-ready: `vercel.json` builds the single-file app **and** compiles the API, and
`api/[...path].js` runs the full Express server as one catch-all function — so `/api/search`,
`/api/imports`, `/api/imports/ocr`, `/api/browser/*` etc. all work in production.
**Deploying only the static build (no `api/` function) is what caused the “Something went wrong (404)” bug.**

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
