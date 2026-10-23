# 🍳 Chef Universe — Kids Cooking App (V3)

**Chef Universe** (repo: LittleChefs) is a kid-friendly, all-ages cooking app. Pick a chef avatar,
enter your name, choose a **chef role** — then search for **ANY recipe in the world** by dish name or
by pasting a recipe-site / YouTube link.

V3 adds a **real PostgreSQL back end**: every chef gets a **private recipe book** guarded by
row-level security, recipes found online are **imported and mapped step-by-step with images**,
and an **onboarding interview** scales every ingredient to the number of people and writes the
**shopping list** before cooking starts.

## ✨ Highlights

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
| `npm test` | 58 tests: RLS isolation, scaling, aisles, importers, SSRF, full API |
| `npm run typecheck` | Type-check app + server |

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
