# Chef Universe — Postgres + Role-Scoped Recipes + AI Onboarding Spec

> **Status:** ✅ Implemented (V3). This document is kept as the design record;
> see [`README.md`](../README.md) and [`API.md`](./API.md) for how it shipped.
> **Prepared:** 2026-10-23
> **Repo:** `Raheelatta1984/LittleChefs` · branch `arena/11a95fc7-littlechefs`

---

## 1. Current-state check (done)

| Question | Answer |
|---|---|
| Is there a PostgreSQL database in this app? | **No.** |
| Is there any backend/server? | **No.** |
| Where does data live today? | React state + `localStorage` (`chefUniverse`, `chefUniverseCustomRecipes`, rewards/buddy state in `RewardsHub`). |
| Stack today | React 19 + TypeScript + Vite 7 + Tailwind 4, built to a single static `dist/index.html`. External calls only: TheMealDB API, YouTube embeds, image CDNs. |
| Any auth / user accounts? | No — the "chef level" is a cosmetic onboarding dropdown (`Little / Junior / Teen / Home / Master`), not a role or identity. |
| Any recipe persistence beyond the browser? | No. Uninstalling the browser profile loses everything. |

**Conclusion:** Postgres, a server API, user identity, role-based access control, recipe/step/image mapping and the AI onboarding flow all need to be built from scratch.

---

## 2. Rephrased requirement (what you asked for, in precise terms)

### R1 — Add a real PostgreSQL persistence layer
Move recipes (and the new onboarding/shopping-list data) from `localStorage` into PostgreSQL behind an API. Keep local state only as an offline cache. Provide schema migrations, seed data (the existing built-in recipes in `src/data/recipes.ts`), and environment-based configuration.

### R2 — Role-based ownership, one private recipe book per chef
Four cooking roles, mapped onto the app's existing chef levels:

| Role | App label | Existing level id |
|---|---|---|
| Junior chef | Junior Chef (10–14) | `junior` |
| Teen chef | Teen Chef (15–19) | `teen` |
| Adult | Home Chef (Adults) | `home` |
| Master chef | Master Chef (Pro) | `master` |

- Every recipe has an **owner** (a chef account) and a **visibility = private** by default.
- A chef can list, read, edit, cook and delete **only their own** recipes.
- No chef can browse, search, guess or read another chef's recipe book — enforced **server-side on every query**, not just hidden in the UI (Postgres Row-Level Security + explicit `owner_id` checks in the API).
- Points, rewards, buddy/room state stay per-chef as they are today.

### R3 — Internal-first lookup without cross-visibility
When any chef searches for a dish (or pastes a URL):

1. **Own recipe book** is searched first.
2. **Shared internal canonical catalogue** is searched second (normalised dish name + aliases + source URL + source video ID + ingredient fingerprint). This is what makes "anyone searching the same recipe picks it up internally" work.
3. **Only if neither matches** does the AI onboarding / online import run.

How the privacy conflict is resolved:

- There are two tables: `recipe_catalogue` (system-owned canonical recipe content extracted from public sources) and `chef_recipes` (the chef's private instance: notes, edits, photos, ratings, cook history).
- A hit in the catalogue is **copied into the requesting chef's private book** ("claim"), with provenance attributed to the original public source — **never** to the chef who imported it. The original chef's notes, personal photos, tweaks and identity are not exposed.
- A chef's genuinely personal creation can be marked `shareable = false`, which excludes it from the canonical index entirely — nobody else can even detect it exists.
- This is the only design that satisfies both rules simultaneously. A stricter "nothing is ever reused" reading would force a fresh AI/online import for every chef for the same dish, which is exactly what you asked to avoid.

### R4 — AI onboarding: import a recipe from a website or YouTube
Inputs accepted: a recipe page URL, a YouTube video/channel URL, or pasted YouTube description text.

The importer must produce and **persist a complete mapping**:

- recipe → metadata (name, cuisine, difficulty, total time, base servings, tips, description)
- recipe → **ordered steps**, each with instruction text, duration/temperature where available, and its own image
- recipe → **ingredients** with quantity, unit, item, preparation note, and grouping
- recipe → **media** (hero image + per-step images) with source credit
- recipe → **provenance** (source URL, video ID/channel, author, import timestamp, extraction confidence)

Onboarding UX:
1. Paste URL / description → **"Fetching…"** job.
2. Server extracts schema.org `Recipe` JSON-LD and OpenGraph data first, then falls back to an LLM for unstructured pages/descriptions.
3. **Review screen** shows the parsed recipe with confidence warnings; the chef can edit anything before saving.
4. Only on explicit confirmation is the recipe written to the chef's private book (plus a canonical catalogue entry if it is reusable).
5. Failure, paywall, geo-block or unsupported source → clear, human error message and manual-entry fallback (never a silent empty recipe).

### R5 — Onboarding questions, portion scaling, shopping list
After the recipe is confirmed, the onboarding "interview" asks:

- **How many people are eating?** (defaults to the recipe's base servings)
- **Which meal is this for?** Breakfast · Lunch · Dinner · Late-night snack
- Optional: dietary constraints / allergies / pantry items already at home

The server then:
- **recalculates every ingredient quantity** by `requested_servings / base_servings`, with human-friendly rounding ("1½ cups", "2 eggs"), and scales portion size guidance.
- adjusts suggested serving/portion notes per meal occasion (e.g. lighter breakfast portion vs main dinner portion) and meal-time prep hints.
- produces a **consolidated shopping list** grouped by supermarket aisle (produce, dairy, meat, pantry, spices, bakery, frozen, other), de-duplicated across ingredients, with quantities, tick-off checkboxes, and "already at home" exclusions.
- persists the list so it survives a page reload and can be opened in-store; supports copy / print / share.
- shows the list **before cooking starts**, with an explicit "everything is in the kitchen" confirmation gate.

### R6 — Integrate into the existing app
- Chef level selection becomes a real **role sign-in** (name + role, optional 4-digit PIN).
- Smart Recipe Finder order becomes: my recipes → internal catalogue → online/AI import → confirmation.
- Recipe page reads ingredients/steps/images from the DB, keeps the existing scoring/points logic (50 pts, read timer, honesty check), and adds the shopping-list flow.
- My Recipes screen: private book, filters by role/dish, edit and delete.
- Existing localStorage users get a one-time migration prompt to import their saved custom recipes.

### R7 — Non-functional requirements
- Parameterised SQL / ORM (no string concatenation), validated inputs, rate-limited import endpoints.
- SSRF protection on URL fetching (block private IP ranges, allow-list http/https, size/time limits).
- Migration + seed scripts, `.env.example`, README updates, automated tests for ownership isolation, scaling maths, dedupe matching and shopping-list consolidation.
- No secrets committed; images kept out of git.

---

## 3. Proposed data model (draft)

```
chefs                id, display_name, role, pin_hash, avatar, level, created_at
roles                id (junior|teen|home|master), label, can_publish, min_age
recipes_catalogue    id, dedupe_key (unique), title, cuisine, base_servings,
                     total_minutes, difficulty, description, hero_image_url,
                     source_type (web|youtube|builtin), source_url, source_video_id,
                     source_author, shareable, created_at
recipe_aliases       id, catalogue_id, alias_normalised
recipe_ingredients   id, catalogue_id, position, quantity, unit, item,
                     prep_note, group_name, scalable
recipe_steps         id, catalogue_id, position, instruction, duration_seconds,
                     temperature_c, image_url
recipe_media         id, catalogue_id, kind (hero|step|video), url, credit
chef_recipes         id, chef_id, catalogue_id?, title, base_servings, notes,
                     visibility, created_at, updated_at   -- private working copy
chef_recipe_steps    id, chef_recipe_id, position, instruction, image_url
chef_recipe_ingredients id, chef_recipe_id, position, quantity, unit, item,
                     prep_note, group_name, scalable
onboarding_sessions  id, chef_id, chef_recipe_id, servings, meal_occasion,
                     dietary_json, status, created_at
shopping_lists       id, chef_id, onboarding_session_id, servings, meal_occasion,
                     status (draft|ready|shopping|done), created_at
shopping_list_items  id, shopping_list_id, aisle, item, quantity_text,
                     checked, already_at_home, source_ingredient_ids
import_jobs          id, chef_id, input_type (url|text), input_value,
                     status, error, confidence, raw_payload_json, created_at
```

Access rule of thumb: `chef_recipes`, `chef_recipe_*`, `onboarding_sessions`, `shopping_lists` are RLS-scoped to `chef_id = current_chef()`; catalogue tables are read-only to the API service and never expose owner identity.

---

## 4. How well this can be implemented (honest assessment)

| Area | Feasibility | Notes |
|---|---|---|
| Postgres schema + migrations + seed | **High** | Standard, well understood. |
| API + ownership isolation | **High** | Server-side enforcement and tests are straightforward. |
| Internal-first dedupe / claim flow | **High** | Normalised key + aliases + source identity; no fuzzy ML needed (trigram optional). |
| Recipe page + private book UI | **High** | Fits the existing React app cleanly. |
| Deterministic website import | **High** | schema.org JSON-LD covers most recipe sites; needs fixtures for offline testing. |
| YouTube description parsing | **Medium–High** | Metadata + description heuristics work; LLM materially improves step splitting. |
| LLM structuring of arbitrary text | **High with a key, Medium without** | Provider adapter (OpenAI/Gemini/Anthropic) + strict JSON schema; deterministic parser as fallback. |
| Per-step images | **Medium** | Most sources only have a hero image. Plan: use source images where present, otherwise a clearly-labelled generated step illustration/placeholder. Cannot invent real photos of the actual dish. |
| Portion scaling + shopping list | **High** | Deterministic maths with unit-aware rounding; the interesting work is ingredient normalisation. |
| Running Postgres **in this sandbox** | **Constrained** | No Postgres binary and no Docker here. Options in §5. |

What I will **not** overclaim: the AI extraction quality depends on the chosen model/key, and scraping some sites (paywalls, JS-only pages, YouTube without transcripts) will fail — those cases get a clear manual-entry path rather than fabricated data.

---

## 5. Environment decision needed: where does Postgres run?

This sandbox has **no `postgres`/`psql` binary and no Docker**, and package installs are limited to npm/PyPI/GitHub. So:

- **Option A (recommended for this build):** embed **PGlite** (`@electric-sql/pglite` — the real Postgres engine compiled to WASM) for local development, with the identical SQL schema and migrations. Production/Vercel switches to a hosted Postgres (Neon/Supabase/Vercel Postgres) purely via `DATABASE_URL` using `pg`/Drizzle. Everything is testable here today, no Docker required.
- **Option B:** you provide a hosted `DATABASE_URL` now; I point the API at it. Risk: sandbox egress may block that host.
- **Option C:** ship `docker-compose.yml` + standard `pg` setup only, and I cannot run/verify it in this sandbox — weaker guarantee.

I would proceed with **A**, structured so that B is a one-line env change.

---

## 6. Open questions (please answer with your action request)

1. **Roles:** confirm "term chef" means **Teen Chef**, and confirm the final role list is exactly Junior / Teen / Adult (Home) / Master — or should **Little Chef** remain as a fifth, more restricted role?
2. **Sign-in:** lightweight chef profile (name + role + optional PIN, kid-friendly, no email) for now, or full email/password accounts?
3. **AI provider:** do you have an API key you want wired in (OpenAI / Gemini / other), or should I build the provider-agnostic adapter with a deterministic no-key fallback first?
4. **Database target:** PGlite locally now with `DATABASE_URL` swap for production (Option A), or do you have a hosted Postgres URL to use (Option B)?
5. **Images:** local `/uploads` + DB metadata (simple, self-contained) or object storage (S3/Vercel Blob) from day one?
6. **Scope for the first PR:** everything in R1–R6 above, or should the first PR stop at Postgres + roles + private books + internal dedupe, with AI onboarding in a follow-up?

---

## 7. Delivery plan once approved

1. Backend scaffold + env config + migrations + seed (existing built-in recipes).
2. Auth/roles + RLS ownership policies + isolation tests.
3. Internal-first lookup and copy-on-claim flow.
4. Import pipeline (JSON-LD → heuristics → LLM adapter) with fixtures and review UI.
5. Onboarding interview, portion scaling, shopping list, persistence.
6. Frontend integration, localStorage migration, README/`.env.example`.
7. Build + tests, PR from `arena/11a95fc7-littlechefs` into `main`, merge, then clean up non-`main` branches — noting that the active session branch should be deleted last/after the session ends to avoid breaking this workspace.
