# 🍳 Chef Universe — Kids Cooking App (V2)

**Chef Universe** (repo: LittleChefs) is a kid-friendly, all-ages cooking discovery app.
Pick a chef avatar, enter your name, choose a chef level, then search for **ANY recipe in the
world** — by dish name or by pasting a recipe-site URL.

## ✨ Highlights (V2)

- **🔮 AI Smart Recipe Finder — the only search:** built-in library first → cuisine/continent
  clarifier → curated Top-10 Chef Recipes + live [TheMealDB](https://www.themealdb.com) results →
  tap ONE result → confirmation screen. **Nothing loads until you tap “✓ Yes, That's Exactly It!”**
  Confirmed recipes persist to `localStorage["chefUniverseCustomRecipes"]`.
- **📹 In-app YouTube:** dish videos (always each recipe's own TheMealDB `strYoutube`) play
  *inside* the app via a `youtube-nocookie` click-to-play player — no redirects.
- **🍳 Honest recipe library:** real built-in recipes (Tres Leches, Cakes by MK cakes, Beef
  Nihari, Chicken Biryani, Butter Chicken, Daal, Samosa, Haleem, Seekh/Chapli Kabab, Pulao,
  Chicken Mandi, Karahi, Mango Lassi, Masala Chai, Rooh Afza, French Toast + kids' classics)
  matched by fair coverage scoring — generic words like “cake” can never hijack
  “tres leches cake”. Unknown dishes get an honestly-labelled *Universal Chef* template recipe.
- **⭐ Fair-play points (50 per recipe, once per unique dish):** mandatory 6-second per-step
  read countdown, then “Did you ACTUALLY make this recipe?” honesty confirmation before points.
- **🎁 Rewards Shop:** surprise recipes (200⭐), a photo-real living room to decorate
  (20 items, 60–2000⭐), and an AI Buddy Studio (8 base portraits, 10 skin/aura colours
  including 🌈 rainbow fantasies, 8 outfits, 7 accessories) — your buddy rests in your room.
- **🧭 Everywhere navigation:** sticky “🏠 Home” + history-based “← Back” + ⭐ points shortcut.
- Progress (`{ points, ownedItems, myCharacter, awardedRecipes }`) persists in
  `localStorage["chefUniverse"]`.

## 📚 Full specification

See **[AGENT_BUILD_GUIDE.md](./AGENT_BUILD_GUIDE.md)** — the complete “AI Agent Edition” build
guide describing every file, screen, state machine, price and rule of the V2 spec.

## 🚀 Run it

```bash
npm install
npm run dev     # local dev server
npm run build   # production build → ONE self-contained dist/index.html (vite-plugin-singlefile)
npm run preview # preview the build
```

## 🧱 Tech

React + TypeScript + Vite 7 · Tailwind CSS 4 · 100% client-side (no backend) ·
TheMealDB free API (no key) · localStorage persistence ·
avatar portraits in `public/images/characters/`.
