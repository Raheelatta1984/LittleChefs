# 🍳 Chef Universe — Complete Build Guide (AI Agent Edition)

> **Repository:** https://github.com/Raheelatta1984/LittleChefs
> **Purpose:** Full documentation of the app so any AI agent can rebuild, review, or update it exactly.
> **Last Updated:** Latest changes — AI Smart Search, In‑App YouTube, Fair‑Play Points, Rewards Shop.

---

## 1. 🎯 What This App Is

**Chef Universe** is a kid-friendly (all‑ages) cooking discovery game/app. A child (or adult) signs in with a name, picks an avatar character and a chef level, then can **search for ANY recipe in the world** — by dish name OR by pasting a recipe‑site URL. The app has an **AI Smart Search engine** that:

1. Checks the built‑in recipe library first,
2. Asks clarifying questions (cuisine style + continent),
3. Searches online via the free **TheMealDB API** + a curated **Top‑10 Chef Recipes** library,
4. Shows a **top‑10 results list** for the user to PICK one,
5. Shows a **single‑recipe confirmation screen** — **never loads until the user explicitly clicks "✓ Yes, That's Exactly It!"**,
6. Loads the **full recipe with real food photo, ingredients, steps, and an embedded YouTube video that plays INSIDE the app** (no external redirects).

After actually following the cooking steps step‑by‑step (with an **anti‑cheat timer + honesty confirmation**), the user earns **50 points** which they can spend in a **Rewards Shop**:
- Option 1: Unlock a surprise recipe (**200 pts**)
- Option 2: Decorate a living room with furniture (sofa **1000 pts**, little plant **100 pts**)
- Option 3: Build a custom buddy character (skin colours **50 pts**, rainbow fantasy skins **400 pts**, cool outfits **800–1000 pts**, accessories)

All progress (points, owned items, buddy, awarded recipes, custom recipes) persists in `localStorage`.

---

## 2. 🧱 Tech Stack

- **Framework:** React 18 + TypeScript
- **Build tool:** Vite 7 (`vite-plugin-singlefile` → outputs ONE `dist/index.html` with all JS/CSS inlined)
- **Styling:** Tailwind CSS (via `@import "tailwindcss"` in `src/index.css`)
- **No backend required** — 100% client‑side app (great for Vercel/Netlify/GitHub Pages static hosting)
- **Data persistence:** `localStorage`
- **Free online recipe API:** TheMealDB (`https://www.themealdb.com/api/json/v1/1/...`) — no API key needed
- **YouTube embeds:** `youtube-nocookie.com/embed/ID?playsinline=1` (in‑app playback)

### Install & run

```bash
npm install       # install deps
npm run dev       # local dev server
npm run build     # production build → dist/index.html (single file!)
npm start         # preview build
```

### Dependencies (package.json essentials)

```json
{
  "dependencies": {
    "react": "^18.x", "react-dom": "^18.x", "lucide-react": "^0.x"
  },
  "devDependencies": {
    "vite": "^7.x", "@vitejs/plugin-react": "^4.x", "typescript": "^5.x",
    "tailwindcss": "^4.x", "vite-plugin-singlefile": "^x.x.x"
  }
}
```

---

## 3. 🗂️ Project Structure (every file & role)

```
/
├── index.html                         # Vite root HTML (title: "Chef Universe — Kids Cooking App")
├── vite.config.ts                     # Vite config w/ react plugin + singlefile plugin
├── tsconfig.json
├── package.json
├── public/images/characters/          # AI‑generated avatar portraits (girl1-3, boy1, char1-6 .jpg)
│   ├── girl1.jpg ... girl3.jpg
│   ├── boy1.jpg
│   └── char1.jpg ... char6.jpg
└── src/
    ├── main.tsx                       # React entry
    ├── index.css                      # @import "tailwindcss" + @keyframes pop + shake
    ├── App.tsx                        # ★ MONOLITH: all screens + logic (welcome, kitchen, recipe, cooking, done, rewards)
    ├── components/
    │   ├── SmartRecipeFinder.tsx      # ★ AI Search modal: internal→online→Top10→confirm→save
    │   ├── YouTubePlayer.tsx          # ★ In‑app YouTube player (youtube-nocookie embed)
    │   ├── RewardsHub.tsx             # ★ Rewards shop: 3 tabs (surprise recipe, living room, buddy creator)
    │   ├── InteractiveWidget.tsx      # ★ Cooking mode widgets: per-step timers + sensory mini-games
    │   └── CSSCharacter.tsx           # Character portrait renderer + avatar buttons
    ├── data/
    │   ├── recipes.ts                 # ★ Built-in recipe library + findRecipe() coverage-matching + generic template engine
    │   ├── topChefs.ts                # ★ Curated top-10 chef recipes (TheMealDb IDs, inspiredBy names, continents)
    │   ├── famousChefs.ts             # ★ Famous chefs/YouTubers by region & country for "❌ Not This" → AI Top-Chef mode
    │   └── rewards.ts                 # ★ Rewards catalog: POINTS_PER_RECIPE=50, NEW_RECIPE_COST=200, ROOM_ITEMS, SKIN_TONES, OUTFITS, ACCESSORIES
    ├── utils/
    │   ├── audio.ts                   # WebAudio sounds: playPop, playDing, playSuccess, speakText (TTS), stopSpeaking
    │   └── cn.ts                      # className merge helper
    └── styles/
        ├── characters.css             # legacy character styles
        └── css-characters.css         # legacy character styles
```

---

## 4. 🧭 Screen Flow & State Machines

### 4.1 App Screens (`App.tsx`)

`Screen = "welcome" | "kitchen" | "recipe" | "cooking" | "done" | "rewards"`

Transition graph:

```
welcome —(Start with valid name)→ kitchen
kitchen —(AI search completes)→ recipe
recipe —(Start Cooking)→ cooking
cooking —("I Finished!" last step)→ [CONFIRMATION MODAL: "Did you ACTUALLY make this recipe?"]
   ✓ Yes → confirms → +50 pts → done
   ⏳ Not yet → stays on same step, NO points
done —(Cook something new)→ kitchen
kitchen —(points ⭐ button)→ rewards
rewards —(Back/Close)→ kitchen
```

### 4.2 Navigation System (Home + Back)

Implemented inside `App.tsx`:

- `setScreen` wrapper named `navigate(to)` pushes current screen onto a `history: Screen[]` stack.
- **`goBack()`** = pops one history entry → goes to the PREVIOUS screen (never straight home). Disabled when history has ≤1 item.
- **`goHome()`** = resets history to `[kitchen]` → shows Home/Kitchen. Both buttons rendered on sticky top bar on ALL non‑welcome screens.
- Home button styled: gradient orange→pink "🏠 Home". Back button: white "← Back".

### 4.3 Welcome Flow (Onboarding)

`WelcomeScreen` collects:
1. **Character avatar** — grid of `CHARACTERS` (6 images from `public/images/characters/`)
2. **Your name** — required, input shakes (`animate-shake`) if empty
3. **Chef Level** (`AGE_OPTIONS`): Little Chef (5‑9 🧒), Junior Chef (10‑14 👦), Teen Chef (15‑19 🧑), Home Chef (Adults 👨‍🍳), Master Chef (Pro 👩‍🍳)
4. **START COOKING! 🚀** button

---

## 5. 🔮 AI Smart Search — The ONLY Search in the App

Location: `src/components/SmartRecipeFinder.tsx` (modal, mounted when `showSmartFinder` state true in `App.tsx`).

### 5.1 Input modes

- Type a dish name directly, e.g. `"tres leches cake"`
- **Paste a full URL** e.g. `https://preppykitchen.com/tres-leches-cake/` → smart parser extracts `"tres leches cake"` automatically (detects `http://`, `https://`, `www.`, or `domain.tld` patterns, then strips protocol, path separators, file extensions, URL‑encodings).

### 5.2 Flow (STAGES)

1. **`search` stage** — input + **continent selector** (🌍 All Regions, 🥢 Asian, 🥖 European, 🌎 Americas, 🌍 African). If text already typed in kitchen search box, modal opens PRE‑FILLED (`initialQuery` prop).
2. First checks **internal library** via `findRecipe(foodQuery)`:
   - If found & not generic (real built‑in), immediately jump to **confirm** stage with that recipe (confidence 100%, source "Built‑in Chef Universe Recipe").
   - **Never loads automatically — require user confirmation.**
3. If **not found / isGeneric** → `'clarify'` stage:
   - Ask **cuisine style** (Any Style 🌍, American 🇺🇸, Pakistani 🇵🇰, Indian 🇮🇳, Spanish 🇪🇸, Italian 🇮🇹, Japanese 🇯🇵, Chinese 🇨🇳).
   - Button: "Show Top 10 Chef Results →" triggers `fetchTop10()`.
4. **`fetchTop10()`** gathers:
   - (a) Curated `TOP_10_CHEF_RECIPES` filtered by chosen continent + name‑matching.
   - (b) Live `https://www.themealdb.com/api/json/v1/1/search.php?s=<query>` results (first 8), filtered by continent via the `AREA_TO_CONTINENT` mapping.
   - Reranks so matching cuisine selections float to top; slices to top 10 → stage `'top10'`.
5. **`top10` stage** — vertical list of 1‑10 results each with thumbnail, name, `[#n]. Title`, `Category • Area [⭐ Top Chef]`, and a → arrow. User **must tap ONE specific recipe**. Back button returns to clarify.
6. **`loadRecipe(item)`** — `lookup.php?i=<mealId>` gets the FULL TheMealDB record (all strIngredient1‑20, strInstructions, strMealThumb, strYoutube). For curated `topchef` entries:
   - Replaces name with curated `name`
   - Source: `Inspired by <inspiredBy> • Video: TheMealDB Kitchen` — **NEVER claims video is by a specific chef**
   - `youtubeVideo` ALWAYS uses the **recipe's own official TheMealDB `strYoutube`** (dish‑relevant), `image` fallback from curated thumb.
   - Then jumps to **confirm** stage.
7. **`confirm` stage** — shows:
   - Header pill: "Recipe Found Online/Inside App!" + source + confidence %
   - **Food image** (full width, rounded)
   - Name, time/difficulty/servings badges
   - First 4 ingredient lines + "+N more..."
   - **Embedded YouTubePlayer** (plays inside app)
   - Text: *"Is this the recipe you're looking for?"*
   - **❌ Not This** → **`aiChefs` stage (AI Top-Chef mode)**: remembers the rejected recipe (by name for built-ins, by TheMealDB meal ID for online recipes — never the whole dish, so another chef's version stays available), detects the dish's relevant **region & country** (`detectChefRegion` in `famousChefs.ts`, from cuisine/continent/dish keywords), re-searches TheMealDB tuned to that region, and displays **numbered famous-chef options** for the user to choose from — e.g. for biryani: **1. Food Fusion 🇵🇰, 2. Ranveer Brar 🇮🇳, 3. Sanjeev Kapoor Khazana 🇮🇳…** Region/country chips (South Asia, Pakistan, India, East & SE Asia, Europe, Middle East & Africa, Americas, Australia, Baking) let the user correct the region, and the dish name can be edited and re-searched. Each chef card offers:
     - **“👩‍🍳 Cook \<Chef\> Style in the App”** → `chooseChef()` finds the best in-app version in that chef's regional style (TheMealDB, preferring the chef's cuisine areas, skipping rejected meal IDs; honest Universal fallback offline) and shows it on the **same confirm gate** — still nothing loads without “✓ Yes”.
     - **“🌐 Search \<Chef\>'s Website”** / **“📺 Search on YouTube”** → deliberate, grown-up-labelled **searches** for the dish on that chef's own official site/channel (never a fabricated recipe URL or video ID; the in-app video is still only the recipe's own TheMealDB `strYoutube`).
     - Fresh online recipes for the region are listed below the chefs too; tapping one goes through the same confirm gate. “Not This” from an AI-chef recipe returns to `aiChefs` with that chef marked “↩️ Tried” and sunk to the bottom. The Recipe screen also has a **“❌ Not This Recipe? Ask AI Top Chefs”** button (`initialMode="aiChefs"` + `rejectedRecipeName`/`rejectedMealId` props) that opens this same stage directly. Confirmed chef-style recipes carry `chefName/chefCountry/chefWebsiteSearchUrl/chefYouTubeSearchUrl` (on `Recipe`) so the Recipe screen shows the “inspired by \<Chef\>” box with the official website/YouTube searches.
   - **✓ Yes, That's Exactly It!** → `confirmYes()` → stage `'loading'` → `saveRecipeToStorage()` → `onRecipeFound(recipe)` → App loads recipe and closes modal.

   **THIS IS THE NUMBER ONE RULE: Never show a recipe/result to the user as their final recipe until they explicitly confirm YES that it matches what they were looking for.**

### 5.3 `FoundRecipe` type additions

```ts
type FoundRecipe = Recipe & {
  source?: string; sourceUrl?: string; confidence?: number;
  isOnline?: boolean; image?: string; youtubeVideo?: string;
};
```

### 5.4 Persistence

- Saved recipes logged to `localStorage["chefUniverseCustomRecipes"]` (JSON array).
- Duplicate prevention by name.
- Shown at bottom of search stage as "💾 N custom recipe(s) saved".

---

## 6. 🍳 Built‑in Recipe Library (`src/data/recipes.ts`)

### 6.1 Structure

```ts
type Recipe = {
  name: string; emoji: string; time: string;
  difficulty: "Super Easy" | "Easy" | "A Little Tricky";
  servings: string; ingredients: string[]; steps: string[];
  tip: string;
  isGeneric?: boolean;      // true for template fallbacks
  image?: string;           // food photo URL (new field)
  youtubeVideo?: string;    // YouTube URL or ID (new field)
  source?: string; sourceUrl?: string; // attribution text (new fields)
};
```

### 6.2 Included REAL recipes (no fake/made‑up content)

Tres Leches Cake, Cakes by MK Moist Chocolate Cake, Cakes by MK Soft Vanilla Cake, Cakes by MK Eggless Red Velvet Cake, Chocolate Loaf Cake (MK), Pancakes, Beef Nihari, Chicken Biryani, Butter Chicken, Daal, Samosa, Mango Lassi, Masala Chai, Haleem, Seekh Kabab, Chapli Kabab, Chicken Pulao, Chicken Mandi, Karahi, Rooh Afza, plus Sushi, Pasta, Mac & Cheese, Tacos, Pizza, Burrito, Waffles, French Toast, Brownies, Cupcakes, Cookies, Fruit Kabobs, Pancakes_special, Burrito, Handlebars etc.

### 6.3 Search‑matching algorithm (`findRecipe`)

`keywordMap: { keys: string[]; id: string }[]` pairs recipe IDs with search phrases.

1. **Exact whole‑query match** → instant win.
2. **Coverage matching**: For each keyword, compute how many **query words the keyword explains** (with singular/plural normalization — "cakes"↔"cake"). Require **≥60% coverage** AND the phrase to appear contiguously. Score = `key.length × coverage`, pick highest.
3. Skip `GENERIC_SINGLE` words (`cake`, `rice`, `soup`, `chicken`, `egg`, `eggs`, `fish`, `meat`, `drink`, `juice`) unless exact/plural match — **this prevents "tres leches cake" from being hijacked by plain "cake"**.
4. Fuzzy word match: whole‑key‑in‑query, skipping `GENERIC_SINGLE`.
5. Fallback: `generateGenericRecipe(name)` builds a **real, step‑by‑step generic recipe** (meat, rice, curry, soup, dessert, bread, drink, salad, bbq, pasta, desi_sweet, snack, egg templates with proper ingredient lists and steps), marked `isGeneric: true`.

### 6.4 Generic — never claims exact authenticity

The app shows an honest "Universal Chef Recipe ready" banner for `isGeneric` recipes, plus **safe unblocked search links**: Food Fusion, **Cakes by MK (`cakesbymk.com/?s=...`)**, Google Safe Search, DuckDuckGo (unblocked), and a "📺 MK Video Tutorial" button. These external links only appear in the generic banner — never redirect unexpectedly.

---

## 7. 📹 In‑App YouTube Player (`src/components/YouTubePlayer.tsx`)

Requirements: **NO external links, NO new windows, NO redirects.**

- Takes `youtubeIdOrUrl` prop (accepts raw 11‑char ID, `watch?v=`, `youtu.be/`, `embed/`, `live/`, `shorts/` formats).
- Extracts ID via regex chain.
- Initial state: **click‑to‑play thumbnail** (`img.youtube.com/vi/<id>/hqdefault.jpg`) with red ▶ button + "Tap to play inside the app" caption.
- On click → renders `<iframe>` with src:
  `https://www.youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1&playsinline=1`
  → plays **directly inside the app UI** (no fullscreen redirect).
- Footer bar with "🎬 Recipe Video" and a Minimize button to return to thumbnail.
- Used in TWO places:
  1. SmartRecipeFinder **confirm** stage (preview before confirming)
  2. RecipeScreen (recipe detail page) below the header, show when `recipe.youtubeVideo` exists

---

## 8. 🏆 Top 10 Chef Recipes (`src/data/topChefs.ts`)

Curated list linking to TheMealDB dish IDs where the **official recipe video** lives:

```ts
type TopChefRecipe = {
  id: string;          // TheMealDB recipe ID for full data fetch + official video!
  name: string;
  inspiredBy: string;  // e.g. "Gordon Ramsay's British classics" (inspiration only, NOT "video by this chef")
  cuisine: string;
  continent: "europe" | "asia" | "americas" | "africa";
  emoji: string;
  thumb: string;       // TheMealDB thumbnail URL
};
```

Current 10: Beef & Mustard Pie (Gordon Ramsay style), Arrabiata Pasta (Jamie Oliver), Chicken Handi Curry (Sanjeev Kapoor), Mediterranean Lamb Tagine (North African), Teriyaki Chicken Casserole (Natasha's Kitchen), Poutine Fries (Joshua Weissman), English Breakfast Pancakes (Cakes by MK), Chicken Quenelles (French), Chocolate Soufflé (Preppy Kitchen), Honey Teriyaki Salmon (Japanese).

Additional exports: `CONTINENTS`, `AREA_TO_CONTINENT` (maps ~50 TheMealDB area names → 4 continents), `getTopRecipesByContinent(c)`.

> **Fairness rule:** chef names are *inspiration only*. Never claim a video is made by that chef. The video is always the dish‑relevant official TheMealDB video.

---

## 9. 🎁 Rewards System (`src/data/rewards.ts` + `src/components/RewardsHub.tsx`)

### 9.1 Points economy

- `POINTS_PER_RECIPE = 50`
- `NEW_RECIPE_COST = 200` (surprise recipe unlock)
- `totalCost` of buddy = skinPrice + outfitPrice + accessoryPrice

### 9.2 Anti‑Cheat / Fair‑Play Rules (App.tsx + CookingScreen)

1. **⏳ Mandatory 6‑second per‑step timer** — every time a new cooking step starts, the "Next Step" button shows a live countdown (`Read step... (5s...4s...)`) and becomes tappable only after **6 seconds**. Resets on going back.
2. **👨‍🍳 "Did you ACTUALLY make this recipe?" modal** — shown at the final step. Options:
   - `✓ Yes! I Really Made It!` → awards points → done screen
   - `⏳ Not yet...` → closes modal, stays on step, **NO points**
3. **Once per unique recipe** — `awardedRecipes: Set<string>` tracks recipe names that already earned points; repeat cooks show grey banner "**✓ Already Earned Points for This Recipe!** cook something NEW".
4. **Persisted** to localStorage alongside `{ points, ownedItems, myCharacter, awardedRecipes }`.
5. Ngarg arrows aren't allowed to cheat: only the name‑validated `initialQuery` in the SmartRecipeFinder modal.

### 9.3 RewardsHub Tabs

- **Tab "recipe"**: Spend 200⭐ → unlock a surprise recipe from `SURPRISE_RECIPES` list (15 foods incl. Pancakes, Biryani, Butter Chicken, Mandi, etc.) → immediately loads it in recipe view and jumps to recipe screen.
- **Tab "room"**: Home‑design living room with a **realistic photographic interior background** (Pexels artwork 7147284 filtered with darkening + amber blend). 20 buyable `ROOM_ITEMS` (furniture 600–2000⭐, decor 300–550⭐, little items 60–250⭐). Purchases appear as large emoji icons **standing on the floor** with shadows + pop animation. The custom **buddy** (`character.baseImage`) appears as a small bordered portrait card **resting in the room** with sparkles + outfit badge + overlay skin‑aura tint.
- **Tab "character"**: AI Buddy Studio with 4 steps:
  1. **Select AI Character** — 8 ready base portraits (grid of `/images/characters/...` images)
  2. **Skin & Aura Colour** — 6 realistic tones (50⭐ cheap) + 4 fantasy rainbow (400⭐ marked with 🌈)
  3. **Outfit Style** — 8 options: casual (100‑150⭐), Pro Chef (300⭐), Superhero (800⭐), Wizard (850⭐), Princess (900⭐), Astronaut (1000⭐)
  4. **Fun Accessories** — flower (100⭐), bow (120⭐), glasses (150⭐), shades (200⭐), headphones (250⭐), medal (500⭐), crown (600⭐)
  Preview card shows live AI image with colour tint overlay + accessory emoji badge + outfit ribbon at bottom. Save button shows total cost.

### 9.4 Restart Points

Red "🔄 Restart My Points & Items" button with confirm dialog → resets points to 0, clears ownedItems, clears myCharacter (keeps awarded recipes intact by design to prevent re‑farming... actually currently resets points/items but awardedRecipes persisted; in current build reset points only).

---

## 10. 🚀 Vercel Deployment

Works perfectly **as‑is** for static deployment:

1. `npm run build` → creates `dist/index.html` (self‑contained, includes all JS+CSS inlined by `vite-plugin-singlefile`)
2. Vercell will serve the static build automatically from the repo
3. For URL‑routes / SPA fallback, ensure Vercel builds from Vite correctly (default Next detection works for plain Vite too)
4. To update after push to GitHub → Vercel auto‑redeploys on push to `main` branch

---

## 11. ✅ Latest Changes (Most Recent Work — This Is "Version 2" Spec)

1. **AI Smart Recipe Finder** (complete system): internal→clarify→continent filter→Top10 online results→single‑select→confirm→persist; URL‑parsing; TheMealDB API integration (free, no key)
2. **YouTube videos play INSIDE the app** via `youtube-nocookie.com/embed/ID?playsinline=1`, click‑to‑play thumbnail insertions in the finder confirm stage AND the recipe detail screen
3. **Honest recipe‑matching fix**: coverage‑based word matching (≥60%) in `findRecipe()` so generic one‑word keys like "cake" can't hijack "tres leches cake" anymore; singular/plural normalization
4. **Honest chef attribution**: removed fabricated YouTube IDs from `topChefs.ts`; videos now come exclusively from each recipe's own official TheMealDB `strYoutube` (dish‑relevant); chef names clearly labeled "Inspired by…"
5. **Real Tres Leches Cake recipe** added built‑in (classic 3‑milk sponge, Preppy Kitchen style)
6. **Top‑10 chef recipes** library with real TheMealDB meals
7. **Navigation improvements**: sticky top bar with Orange "🏠 Home" + "← Back" (history‑based backward navigation, never straight home)
8. **Fair‑play points gating**: 6‑second per‑step countdown + explicit "Did you ACTUALLY make this recipe?" confirmation required before awarding points; per‑unique‑recipe dedup; grey "already earned" banner in done screen
9. **Single unified AI search**: removed old normal search; the kitchen now has ONE AI search box that opens SmartRecipeFinder prefilled; suggestion chips also open AI finder prefilled

---

## 12. 🧑‍🍳 End‑to‑End Usage Example

1. Open app → choose character girl2.jpg, name "Ayesha", Little Chef, tap Start!
2. Kitchen home (avatar + ⭐ points top‑right + 🏠 Home/← Back top‑left)
3. Tap AI Smart Chef Search box, type "tres leches cake" → enter
4. Modal pre-filled, choose continent All Regions → tap Find Recipe
5. Found internally! → confirm screen shows recipe summary → tap "✓ Yes, That's Exactly It!"
6. Modal closes, RecipeScreen appears with recipe details + ingredients + YouTube video inside app
7. Tap Start Cooking → read 6‑second countdown → tap through each step → final step → "I Finished! 🎉"
8. Confirmation modal: "Did you ANCED actually cook?" → tap "✓ Yes" → +50 points!
9. Tap "🎁 Spend My Points!" → choose Living Room tab → buy Cozy Sofa (1000 remaining if 0 saved) → buy Plant (100) → buddy rests on the rug!

---

## 13. 📝 Notes for the Next Agent

- Keep `findRecipe()` coverage logic intact; don't revert to the old "longest‑key‑wins" version — it caused hijacking bugs.
- When adding new recipes: add to `recipeBook` + `keywordMap` (variations, plurals, spelling quirks like "roo afsa" → roohafza).
- Every new external recipe lookup MUST go through the SmartRecipeFinder confirmation gate — never auto‑display to the user as their recipe without explicit "Yes".
- Videos: only `strYoutube` from TheMealDB or equivalent verified dish‑relevant URLs, embedded via YouTubePlayer. Never hardcode unverified YouTube IDs.
- The points economy balance: 50 per recipe, 200 for surprise, 100–2000 for items, 50–1000 for buddy parts — preserve.
- Keep everything in ONE `src/App.tsx` for screens + children as separate small components under `src/components/` for cleanliness.

═══════════════════════════════════════════════════
END OF DOCUMENT — copy/paste safe for agent review & rebuild.

---

## 14. 🆕 V3 — Private Postgres kitchens, role access & AI recipe onboarding

> This section supersedes the "no backend" statements in §2 for anything recipe-related.
> The React client still works standalone (localStorage demo mode), but the real app now runs
> against a PostgreSQL API in `server/`.

### 14.1 Architecture

```
Browser (React 19 + Vite)
   │  same-origin /api (Vite proxies in dev, Express serves dist/ in prod)
   ▼
Express 5 API  (server/)
   │  migrations + seed + services
   ▼
PostgreSQL 16  — PGlite (WASM, local) or hosted via DATABASE_URL
```

- `server/index.ts` — boot: create DB → migrate → seed built-ins → listen on `0.0.0.0:8787`.
- `server/db/` — driver abstraction (`pglite.ts`, `postgres.ts`), `migrate.ts`, `seed.ts`,
  `migrations/001_init.sql` (schema) and `002_rls.sql` (grants + policies).
- `server/services/` — `normalise.ts` (dish/ingredient identity), `recipes.ts` (private book +
  catalogue + internal search), `scaling.ts` (portion maths), `shopping.ts` (aisles + consolidation),
  `onboarding.ts` (interview → plan → shopping list), `importer/*` (fetch, JSON-LD, YouTube, text, LLM).
- `server/routes/` — `auth`, `recipes`, `import`, `catalogue`, `uploads`.
- `shared/types.ts` — types used by both the API and the React app.

### 14.2 Roles

`roles` table drives capabilities (rank, `can_publish`, `requires_grownup`, `max_batch_servings`):

| id | label | publish | grown-up | max batch |
|---|---|---|---|---|
| junior | Junior Chef (10–14) | ✗ | ✓ | 8 |
| teen | Teen Chef (15–19) | ✓ | ✗ | 16 |
| adult | Adult Chef | ✓ | ✗ | 40 |
| master | Master Chef (Pro) | ✓ | ✗ | 100 |

### 14.3 Ownership enforcement

Every user-data query runs inside `db.withChef(chefId, tx => …)`:

```sql
BEGIN;
SET LOCAL ROLE chef_app;
SELECT set_config('app.chef_id', $1, true);
-- …queries, subject to FORCE ROW LEVEL SECURITY…
COMMIT;
```

Policies compare `chef_id = app_chef_id()`; child tables use `EXISTS (… chef_recipes …)`.
Even a query with a missing `WHERE` clause returns zero rows for the wrong chef.

### 14.4 Internal-first search

`findInternalMatches()` → own recipes (RLS) → shared catalogue (exact key, normalised title,
alias, fuzzy `isSameDish`) → `needsOnboarding: true`.
Claiming a catalogue recipe copies the full content into `chef_recipes`; `created_by_chef`
is stored only on `catalogue_recipes` and never selected by the API.

### 14.5 AI onboarding flow

`POST /api/imports` → `importRecipe()`:

1. `classifyInput` → url | youtube | text | dish
2. website: fetch (SSRF-guarded) → JSON-LD Recipe → fallback page heuristic → optional LLM
   youtube: oEmbed + watch-page description → text parser → optional LLM
   text: heading/bullet parser → optional LLM
   dish: LLM only (honest error without a key)
3. `tidyDraft` (positions, dedupe, caps) + `confidenceOf` + `warningsFor`
4. Job stored as `review` — the UI shows an editable review before `POST /imports/:id/confirm`.

Per-step images come from the source where present; otherwise the UI shows a labelled placeholder
(no invented photos).

### 14.6 Onboarding interview, portions and shopping list

- `runOnboarding()` clamps servings to the role's `max_batch_servings` (with a friendly reminder),
  computes `factor = servings / baseServings`, scales every ingredient with unit-aware rounding,
  and adapts portion guidance by meal (breakfast 80 %, lunch/dinner 100 %, late-night 60 %).
- `buildShoppingList()` maps each ingredient to an aisle (longest keyword match, head-noun bonus),
  merges duplicates (sums matching units, joins mismatched ones), marks pantry items
  `already_at_home`, and returns aisle-ordered groups.
- `onboarding_sessions`, `shopping_lists` and `shopping_list_items` persist the whole plan so the
  list survives a reload and can be ticked off in the shop.

### 14.7 Client additions

| File | Role |
|---|---|
| `src/lib/api.ts` | Typed API client, token storage (`chefUniverseAuth`), friendly offline error |
| `src/lib/adapters.ts` | DB recipe / scaled plan → legacy `Recipe` for the cooking screens |
| `src/components/ChefGate.tsx` | Create/sign in a chef, pick role, avatar, optional PIN |
| `src/components/MyRecipes.tsx` | Private book list, filter, delete, import CTA |
| `src/components/DbRecipeDetail.tsx` | DB recipe with per-step images + "Prep & shopping list" |
| `src/components/RecipeImporter.tsx` | Import → review/edit → save to my book |
| `src/components/OnboardingFlow.tsx` | People/meal/diet/pantry interview → scaled plan + shopping list |
| `src/components/InternalMatches.tsx` | Internal-first results + claim, or "import with AI" |

`App.tsx` gains screens `myRecipes`, `dbRecipe`, `onboarding`, an internal-first search path and a
server-authoritative points call (`POST /me/cook-completion`).

### 14.8 Tests

`npm test` runs `tests/*.test.ts` on in-memory PGlite:

- `ownership.test.ts` — cross-chef read/update/delete/list/search isolation, catalogue privacy
- `scaling.test.ts` — quantity parsing, rounding, fractions, egg handling
- `shopping.test.ts` — aisle mapping, de-duplication, pantry exclusion, group ordering
- `normalise.test.ts` — title/alias matching, generic-word guards
- `importer.test.ts` — JSON-LD, description parsing, fixture site, failure paths, SSRF
- `api.test.ts` — full HTTP journey: import → confirm → search → claim → onboarding →
  shopping tick-off → points → uploads → PIN auth

### 14.9 Constraints & honest limitations

- Sandbox has no Postgres binary or Docker ⇒ PGlite is the default driver; hosted Postgres works
  via `DATABASE_URL` and the identical SQL.
- Website imports need outbound internet from wherever the API runs.
- Paywalled/JS-only pages and videos without a transcript/description cannot be imported;
  the API explains why and offers manual entry.
- The demo web app still runs without the API (localStorage mode) so a static build is never broken.
