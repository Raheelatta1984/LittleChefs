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

### AI onboarding (import)
| Method | Path | Purpose |
|---|---|---|
| `POST` | `/imports` | `{ inputValue }` — URL, YouTube link, pasted description or dish name. Returns a **review draft** + warnings + confidence |
| `GET` | `/imports/:id` | Inspect a previous import |
| `POST` | `/imports/:id/confirm` | Save the (optionally edited) draft into my book; also adds it to the shared catalogue when my role may publish |

Import methods: `jsonld` (schema.org Recipe), `youtube` (video metadata + description),
`heuristic` (HTML/text parsing), `llm` (AI structuring, requires `LLM_API_KEY`).

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
| `POST` | `/uploads` | `{ dataUrl }` (png/jpg/webp ≤ 4 MB) → `/uploads/<file>` |

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
* Rate limits: auth (40 / 10 min), imports (20 / 5 min), uploads (40 / 10 min) per IP.
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
