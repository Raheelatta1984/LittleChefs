# Chef Universe — API & Data Model

Base URL: `/api` (Vite proxies it to `http://127.0.0.1:8787` in development).

Auth: `Authorization: Bearer <token>` returned by `POST /chefs` or `POST /chefs/sign-in`.

---

## 1. Roles and what they may do

| Role id | Label | Ages | Publish to shared catalogue | Grown-up required | Max batch |
|---|---|---|---|---|---|
| `junior` | Junior Chef | 10–14 | ✗ | ✓ | 8 |
| `teen` | Teen Chef | 15–19 | ✓ | ✗ | 16 |
| `adult` | Adult Chef | Adults | ✓ | ✗ | 40 |
| `master` | Master Chef | Pro | ✓ | ✗ | 100 |

Every chef owns a **private recipe book**. This is enforced by PostgreSQL row-level
security, not by the UI (see §5).

---

## 2. Endpoints

### Auth & profile
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/roles` | Role list + capabilities (public) |
| `POST` | `/chefs` | Create a chef profile, returns `{ chef, token }` |
| `POST` | `/chefs/sign-in` | Sign back in with name + role (+ PIN if set) |
| `POST` | `/chefs/sign-out` | Revoke the current token |
| `GET` | `/me` | Current chef profile |
| `PATCH` | `/me` | Update name / avatar / PIN |
| `POST` | `/me/cook-completion` | Award 50 points once per unique cooked dish |

### Internal-first search
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/search?q=` | My recipes → shared catalogue → `needsOnboarding` |

```json
{
  "query": "chicken biryani",
  "normalisedQuery": "chicken biryani",
  "myRecipes": [],
  "sharedMatches": [{ "catalogueId": "…", "title": "Chicken Biryani", "ingredientCount": 12, "stepCount": 8 }],
  "needsOnboarding": false,
  "message": "Found in the shared recipe catalogue — we can copy it into your book instantly."
}
```

`sharedMatches` never contains the id or name of the chef who imported the recipe.

### Private recipe book
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/recipes` | List my recipes |
| `GET` | `/recipes/:id` | One recipe (404 for any other chef) |
| `POST` | `/recipes` | Create manually |
| `PUT` | `/recipes/:id` | Replace ingredients/steps |
| `DELETE` | `/recipes/:id` | Remove from my book |
| `POST` | `/catalogue/:id/claim` | Copy a shared recipe into my book |
| `GET` | `/catalogue?q=` | Browse shared catalogue (no owner data) |
| `GET` | `/catalogue/:id` | Full shared recipe (no owner data) |

### In-app recipe & YouTube browser
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/browser/navigate?url=` | SSRF-guarded fetch of a recipe website or web search; returns sanitized `srcDoc` HTML (with link-click interception), extracted recipe cards, and `detectedRecipe` when on a recipe page |
| `GET` | `/browser/youtube?q=` | Searches YouTube or opens a channel/video URL; returns playable video cards (`ytInitialData` + metadata) and `detectedRecipe` when available |

### AI onboarding (import)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/imports` | `{ inputValue, allowAiFallback?, draftHint? }` — URL, YouTube link, pasted description or **dish name**. Returns a **review draft** + warnings + confidence |
| `POST` | `/imports/ocr` | `{ dataUrl, title? }` — 📷 scan a recipe photo/screenshot (Tesseract OCR, on-server). Returns `{ job, ocrText, ocrConfidence }`; the job is in `review` like any import, and `ocrText` lets the chef fix the scan and re-read it as a text import |
| `GET` | `/imports/:id` | Inspect a previous import |
| `POST` | `/imports/:id/confirm` | Save the (optionally edited) draft into my book; also adds it to the shared catalogue when my role may publish |

Import methods: `jsonld` (schema.org Recipe), `youtube` (video metadata + description),
`heuristic` (HTML/text parsing — understands Food Fusion trailing quantities, `tbs`, group
captions, Roman-Urdu repeats), `ocr` (photo scan), `catalogue` (internal reuse),
`llm` (AI structuring, requires `LLM_API_KEY`), `manual` (starter draft).

**Page-clutter filter** (`server/services/importer/clean.ts`) runs on every import — JSON-LD,
page text, YouTube description, OCR and LLM output. It removes nutrition panels, ratings,
review widgets (including their dates and internal tokens), print/save/shop buttons, sponsored
and related-recipe blocks, and copyright footers; it also collapses the screen-reader duplicate
that supermarket sites emit (`2 tsp olive oil 2teaspoons olive oil`). Ingredient/method sections
end at the first *Nutrition / Description / Reviews / You might also like* heading, and servings
and total time are read line-by-line (`Serve is for 6 people` → 6, `Prep 10m` + `Cook 30m` → 40).
When lines were dropped the job's `warnings[]` says so.

**Dish-name cascade** (`inputValue: "Chicken Balochi Karahi from Food Fusion"`):
1. My book → shared catalogue — only a *strong* title match short-circuits; a weaker relative
   (seeded "Chicken Karahi") is kept as a clearly-labelled last resort, never substituted silently.
2. Website — the requested chef's own site search (Food Fusion, SooperChef, Hebbars Kitchen,
   Ranveer Brar, Cakes by MK) then a general web search; best recipe cards are imported normally.
   Listing/search URLs (`?s=…`) are also followed one hop when pasted directly as a link.
3. YouTube — `"<channel> <dish> recipe"` search; top videos are opened and the recipe is parsed
   from the **video description** (+ captions when present).
4. AI draft from the dish name (only with `LLM_API_KEY`).
5. Otherwise `400` with `details: { next: ["youtube","ocr","paste"], tried: [...] }` — the UI
   turns this into one-tap YouTube / OCR-scan / paste rescues. It never returns a bare 404.

### Onboarding interview → portions → shopping list
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/recipes/:id/onboarding` | `{ servings, mealOccasion, dietary[], pantry[] }` → scaled ingredients, portion guidance, persisted shopping list |
| `GET` | `/shopping-lists/:id` | Re-open a saved list |
| `PATCH` | `/shopping-lists/:id/items/:itemId` | Tick an item |
| `POST` | `/shopping-lists/:id/complete` | Mark shopping done |

`mealOccasion`: `breakfast` · `lunch` · `dinner` · `late-night-snack`.

Scaling is `servings / baseServings`, rounded for real kitchens (`1.67×` of 3 cups → `5 cups`;
eggs round to whole eggs; "to taste" is never scaled). Shopping lists are de-duplicated by
ingredient, quantities are summed when units agree, and items are grouped by supermarket aisle.

### Media
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/uploads` | `{ dataUrl }` (png/jpg/webp ≤ 4 MB) → `/api/uploads/<file>` (also served at legacy `/uploads/<file>` locally) |

---

## 3. Data model (abridged)

```
roles                    capability matrix (rank, can_publish, max_batch_servings…)
chefs                    id, display_name, role_id, avatar, pin_hash, points, awarded_recipes
chef_sessions            hashed bearer tokens with expiry

catalogue_recipes        shared canonical recipes (dedupe_key unique) + created_by_chef (never returned)
catalogue_aliases        alternative names for internal matching
catalogue_ingredients    quantity, unit, item, prep_note, group_name, scalable, raw_text
catalogue_steps          position, instruction, duration, temperature, image_url, tip
catalogue_media          hero / step / video media with credit

chef_recipes             MY private copy (chef_id + dedupe_key unique)
chef_recipe_ingredients  my quantities and notes
chef_recipe_steps        my step order, instructions and photos

onboarding_sessions      servings, meal_occasion, dietary[], pantry[], scale_factor, status
shopping_lists           one per onboarding run
shopping_list_items      aisle, item, quantity_text, checked, already_at_home
import_jobs              input, status, method, confidence, warnings[], draft jsonb
```

---

## 4. Internal-first lookup (how "same recipe" works without cross-visibility)

1. **My book** — matched on `chef_id + dedupe_key`, then fuzzy title matching.
2. **Shared catalogue** — exact key, normalised title, alias, then fuzzy matching
   (`isSameDish`: containment or ≥ 0.75 Jaccard token overlap).
3. **Nothing internal** → `needsOnboarding: true` → AI import.

When chef B "claims" a catalogue recipe, a **full copy** is written to B's private book
(`chef_recipes` + children) with `catalogue_id` retained for provenance. B never sees A's
notes, edits, photos, rating or identity — only the canonical content and its public source.

---

## 4b. Load shedding (caches, Bloom filter, negative caching)

The read paths are protected in four layers, cheapest first:

1. **In-process caches** (`server/lib/cache.ts`) — bounded LRU maps with per-entry TTLs.
   * `sessions` — token hash → chef profile (30 s). Unknown tokens are cached as `null`
     for 10 s (negative cache), so junk bearer tokens never reach Postgres.
   * `internal-lookup` — per-chef search results, misses included (20 s / 15 s).
   * `catalogue-list`, `chef-catalogue-ids`, `catalogue-recipe` — shared catalogue rows,
     the chef's owned catalogue ids and full recipe payloads.
   * `roles` — static reference data (5 min).
   Every write invalidates the entries it affects: saving/claiming/deleting a recipe clears that
   chef's lookups; catalogue inserts clear the catalogue caches and the lookup cache.
2. **Bloom filter** (`server/lib/bloom.ts` + `server/services/catalogueIndex.ts`) — holds every
   catalogue dedupe key, normalised title and title token. A search whose tokens are *all* absent
   from the filter cannot match by exact key, containment or Jaccard similarity, so both catalogue
   queries (and the 500-row fuzzy scan) are skipped. False positives are harmless (they just hit the
   DB); the filter is fed on every catalogue write and rebuilt from the database every 60 s.
3. **Request coalescing** — `singleFlight` merges concurrent identical loads (ten simultaneous
   searches for one dish = one query).
4. **Databases** — the remaining reads are index-backed (`003_performance_indexes.sql`).

Caches are process-local, so with several API instances the worst case is one TTL of staleness
(`CACHE_*` env vars in `.env.example` control every window). Set `CACHE_ENABLED=false` to bypass the
whole layer.

---

## 5. Security model

* The API runs every user-data statement inside a transaction that does
  `SET LOCAL ROLE chef_app` + `set_config('app.chef_id', …)`, with **`FORCE ROW LEVEL SECURITY`**
  on all chef-owned tables. A forgotten `WHERE chef_id = …` still returns zero rows.
* Tests cover: cross-chef reads, updates, deletes, list leakage, search leakage,
  shopping-list access and onboarding access.
* Import fetching is SSRF-guarded: http/https only, DNS resolution checked against private,
  loopback, link-local and CGNAT ranges, redirect cap, byte cap and timeout.
* Passwords/PINs: optional 4-digit PIN hashed with scrypt + random salt.
* Tokens: 32-byte random, stored only as SHA-256 hashes, 30-day expiry.
* Rate limits (token bucket, per chef when signed in, per IP otherwise):
  * global — 600 requests / minute on every `/api` call,
  * auth (`/chefs`, `/chefs/sign-in`) — 40 / 10 min,
  * imports (`/imports`, `/imports/ocr`) — 20 / 5 min,
  * uploads — 40 / 10 min,
  * browsing — 60 / 5 min.

  A limited response is `429` with `Retry-After` seconds and `RateLimit-Limit`,
  `RateLimit-Remaining`, `RateLimit-Reset` headers:
  `{ "error": "rate_limited", "retryAfter": 12, "message": "Too many requests. Please wait 12 seconds and try again." }`
* Caching (`Cache-Control`) is set per route: static roles `public, max-age=300`;
  shared catalogue list/detail `private, max-age=15–60`; personal recipe book `no-store`;
  health `no-store`. `GET /api/health` also reports cache hit rates and the Bloom-filter size.
* Catalogue responses never select `created_by_chef`.

---

## 6. Errors

```json
{ "error": "bad_request", "message": "Human friendly explanation.", "details": [] }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input / unreadable recipe |
| 401 | Missing or invalid token |
| 404 | Recipe not in *your* book (also used to hide other chefs' recipes) |
| 409 | Duplicate chef name, or import already saved |
| 413 | Upload/page too large |
| 429 | Rate limited |
| 502 | The source website could not be read |
