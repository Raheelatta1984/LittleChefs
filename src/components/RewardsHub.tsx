import { useState } from "react";
import {
  ACCESSORIES,
  BASE_CHARACTERS,
  NEW_RECIPE_COST,
  OUTFITS,
  ROOM_ITEMS,
  SKIN_TONES,
  SURPRISE_RECIPES,
  totalCostOf,
  type Buddy,
  type RoomItem,
} from "../data/rewards";
import { CSSCharacter } from "./CSSCharacter";
import { playDing, playPop } from "../utils/audio";

type RewardsTab = "recipe" | "room" | "character";

type RewardsHubProps = {
  points: number;
  ownedItems: string[];
  myCharacter: Buddy | null;
  onBuyItem: (item: RoomItem) => void;
  onSaveBuddy: (buddy: Buddy, cost: number) => void;
  onSurpriseRecipe: (recipeName: string) => void;
  onRestart: () => void;
};

const ROOM_BACKGROUND =
  "https://images.pexels.com/photos/7147284/pexels-photo-7147284.jpeg?auto=compress&cs=tinysrgb&w=1200";

export function RewardsHub({
  points,
  ownedItems,
  myCharacter,
  onBuyItem,
  onSaveBuddy,
  onSurpriseRecipe,
  onRestart,
}: RewardsHubProps) {
  const [tab, setTab] = useState<RewardsTab>("recipe");
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);

  const [baseId, setBaseId] = useState(myCharacter?.baseId ?? BASE_CHARACTERS[0].id);
  const [skinId, setSkinId] = useState(myCharacter?.skinId ?? SKIN_TONES[0].id);
  const [outfitId, setOutfitId] = useState(myCharacter?.outfitId ?? OUTFITS[0].id);
  const [accessoryId, setAccessoryId] = useState(myCharacter?.accessoryId ?? ACCESSORIES[0].id);

  const base = BASE_CHARACTERS.find((b) => b.id === baseId) ?? BASE_CHARACTERS[0];
  const skin = SKIN_TONES.find((s) => s.id === skinId) ?? SKIN_TONES[0];
  const outfit = OUTFITS.find((o) => o.id === outfitId) ?? OUTFITS[0];
  const accessory = ACCESSORIES.find((a) => a.id === accessoryId) ?? ACCESSORIES[0];
  const buddyCost = totalCostOf(skinId, outfitId, accessoryId);

  const roomBuddySkin = myCharacter ? SKIN_TONES.find((s) => s.id === myCharacter.skinId) : undefined;
  const roomBuddyOutfit = myCharacter ? OUTFITS.find((o) => o.id === myCharacter.outfitId) : undefined;
  const roomBuddyAccessory = myCharacter ? ACCESSORIES.find((a) => a.id === myCharacter.accessoryId) : undefined;
  const ownedRoomItems = ROOM_ITEMS.filter((item) => ownedItems.includes(item.id));

  function pickSurprise(name: string) {
    playDing();
    onSurpriseRecipe(name);
  }

  function surpriseMe() {
    const name = SURPRISE_RECIPES[Math.floor(Math.random() * SURPRISE_RECIPES.length)];
    pickSurprise(name);
  }

  function saveBuddy() {
    playDing();
    onSaveBuddy(
      { baseId, baseImage: base.image, skinId, outfitId, accessoryId },
      buddyCost
    );
  }

  function confirmRestart() {
    playDing();
    setShowRestartConfirm(false);
    onRestart();
  }

  const tabButton = (id: RewardsTab, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => { playPop(); setTab(id); }}
      className={`flex-1 rounded-2xl px-2 py-2.5 text-sm font-black transition active:scale-95 ${
        tab === id ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
      aria-pressed={tab === id}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h3 className="text-2xl font-black text-slate-800">🎁 Rewards Shop</h3>
        <p className="mt-1 inline-block rounded-full bg-amber-100 px-4 py-1.5 font-black text-amber-700 ring-1 ring-amber-200">
          ⭐ {points} points
        </p>
      </div>

      <div className="flex gap-2">
        {tabButton("recipe", "🎲 Surprise Recipe")}
        {tabButton("room", "🏠 Living Room")}
        {tabButton("character", "🤖 AI Buddy Studio")}
      </div>

      {tab === "recipe" && (
        <section className="space-y-4" aria-label="Surprise recipe">
          <p className="text-center text-sm font-bold text-slate-600">
            Spend <span className="font-black text-amber-600">{NEW_RECIPE_COST}⭐</span> to unlock a recipe — it loads straight into your kitchen!
          </p>
          <button
            type="button"
            onClick={surpriseMe}
            disabled={points < NEW_RECIPE_COST}
            className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          >
            🎁 Surprise Me! ({NEW_RECIPE_COST}⭐)
          </button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SURPRISE_RECIPES.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => pickSurprise(name)}
                disabled={points < NEW_RECIPE_COST}
                className="rounded-2xl bg-orange-50 px-2 py-3 text-sm font-extrabold text-slate-700 ring-1 ring-orange-100 transition hover:bg-orange-100 active:scale-95 disabled:opacity-40"
              >
                {name}
                <span className="mt-0.5 block text-xs font-black text-amber-600">{NEW_RECIPE_COST}⭐</span>
              </button>
            ))}
          </div>
          {points < NEW_RECIPE_COST && (
            <p className="text-center text-xs font-bold text-slate-400">Cook a NEW recipe to earn 50⭐ each time!</p>
          )}
        </section>
      )}

      {tab === "room" && (
        <section className="space-y-4" aria-label="Living room">
          {/* Photographic living room (Pexels 7147284, darkened + amber blend) */}
          <div
            className="relative h-72 overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/10"
            style={{ backgroundImage: `url(${ROOM_BACKGROUND})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
            <div className="absolute inset-0 bg-amber-900/25 mix-blend-multiply" aria-hidden="true" />
            <div className="absolute inset-0 bg-black/20" aria-hidden="true" />
            <p className="absolute left-3 top-3 rounded-full bg-black/45 px-3 py-1 text-xs font-black text-white">🛋️ My Living Room</p>

            {/* Owned items standing on the floor */}
            <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-end justify-center gap-x-2 gap-y-1">
              {ownedRoomItems.length === 0 && (
                <p className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white">Your room is empty — buy something cozy below!</p>
              )}
              {ownedRoomItems.map((item) => (
                <span
                  key={item.id}
                  title={item.name}
                  className="text-5xl leading-none drop-shadow-[0_10px_6px_rgba(0,0,0,0.55)]"
                  style={{ animation: "pop 0.5s ease-out" }}
                  aria-label={item.name}
                >
                  {item.emoji}
                </span>
              ))}
            </div>

            {/* Custom buddy resting in the room */}
            {myCharacter && (
              <div className="absolute bottom-3 right-3 w-24" style={{ animation: "pop 0.5s ease-out" }}>
                <div className="relative rounded-2xl border-4 border-white bg-white shadow-2xl">
                  <CSSCharacter
                    baseImage={myCharacter.baseImage}
                    name="My buddy"
                    skinColor={roomBuddySkin?.color}
                    accessoryEmoji={roomBuddyAccessory?.emoji}
                    outfitName={roomBuddyOutfit?.name}
                    outfitEmoji={roomBuddyOutfit?.emoji}
                    className="h-28 w-full rounded-xl"
                  />
                </div>
                <span className="absolute -left-2 -top-3 text-lg" aria-hidden="true">✨</span>
                <span className="absolute -right-3 top-6 text-sm" aria-hidden="true">✨</span>
                {roomBuddyOutfit && (
                  <p className="mt-1 text-center text-[10px] font-black leading-tight text-white drop-shadow">
                    {roomBuddyOutfit.emoji} {roomBuddyOutfit.name}
                  </p>
                )}
              </div>
            )}
          </div>

          {(
            [
              ["furniture", "🛋️ Furniture (600–2000⭐)"],
              ["decor", "🖼️ Décor (300–550⭐)"],
              ["little", "🌱 Little Items (60–250⭐)"],
            ] as const
          ).map(([category, heading]) => (
            <div key={category}>
              <h4 className="mb-2 font-black text-slate-700">{heading}</h4>
              <div className="grid grid-cols-2 gap-2">
                {ROOM_ITEMS.filter((item) => item.category === category).map((item) => {
                  const owned = ownedItems.includes(item.id);
                  const affordable = points >= item.price;
                  return (
                    <div key={item.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                      <span className="text-3xl" aria-hidden="true">{item.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-slate-700">{item.name}</span>
                        <span className="block text-xs font-black text-amber-600">{item.price}⭐</span>
                      </span>
                      <button
                        type="button"
                        disabled={owned || !affordable}
                        onClick={() => { playDing(); onBuyItem(item); }}
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition active:scale-95 ${
                          owned
                            ? "bg-emerald-100 text-emerald-600"
                            : affordable
                              ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow"
                              : "bg-slate-200 text-slate-400"
                        }`}
                      >
                        {owned ? "✓ Owned" : "Buy"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "character" && (
        <section className="space-y-5" aria-label="AI Buddy Studio">
          {/* Live preview */}
          <div className="mx-auto w-48">
            <CSSCharacter
              baseImage={base.image}
              name={base.name}
              skinColor={skin.color}
              accessoryEmoji={accessory.emoji}
              outfitName={outfit.name}
              outfitEmoji={outfit.emoji}
              className="aspect-square w-full shadow-xl ring-4 ring-white"
            />
            <p className="mt-2 text-center text-xs font-bold text-slate-500">Live preview — tint, badge & outfit ribbon update as you choose!</p>
          </div>

          {/* Step 1: base portraits */}
          <div>
            <h4 className="mb-2 font-black text-slate-700">1️⃣ Select AI Character</h4>
            <div className="grid grid-cols-4 gap-2">
              {BASE_CHARACTERS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { playPop(); setBaseId(b.id); }}
                  aria-pressed={baseId === b.id}
                  aria-label={b.name}
                  className={`overflow-hidden rounded-2xl transition active:scale-95 ${baseId === b.id ? "ring-4 ring-amber-400" : "ring-1 ring-slate-200 hover:ring-2 hover:ring-orange-300"}`}
                >
                  <img src={b.image} alt={b.name} className="aspect-square w-full object-cover" loading="lazy" />
                  <span className="block truncate px-1 py-1 text-center text-[10px] font-extrabold text-slate-600">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: skin & aura colours */}
          <div>
            <h4 className="mb-2 font-black text-slate-700">2️⃣ Skin & Aura Colour</h4>
            <div className="grid grid-cols-2 gap-2">
              {SKIN_TONES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { playPop(); setSkinId(s.id); }}
                  aria-pressed={skinId === s.id}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition active:scale-95 ${skinId === s.id ? "bg-amber-50 ring-2 ring-amber-400" : "bg-slate-50 ring-1 ring-slate-200"}`}
                >
                  <span className="h-7 w-7 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold text-slate-700">{s.name}{s.fantasy ? " 🌈" : ""}</span>
                    <span className="block text-xs font-black text-amber-600">{s.price}⭐</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: outfits */}
          <div>
            <h4 className="mb-2 font-black text-slate-700">3️⃣ Outfit Style</h4>
            <div className="grid grid-cols-2 gap-2">
              {OUTFITS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { playPop(); setOutfitId(o.id); }}
                  aria-pressed={outfitId === o.id}
                  className={`rounded-2xl px-3 py-2.5 text-left transition active:scale-95 ${outfitId === o.id ? "bg-pink-50 ring-2 ring-pink-400" : "bg-slate-50 ring-1 ring-slate-200"}`}
                >
                  <span className="block text-sm font-extrabold text-slate-700">{o.emoji} {o.name}</span>
                  <span className="block text-xs font-black text-amber-600">{o.price}⭐</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: accessories */}
          <div>
            <h4 className="mb-2 font-black text-slate-700">4️⃣ Fun Accessories</h4>
            <div className="grid grid-cols-2 gap-2">
              {ACCESSORIES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { playPop(); setAccessoryId(a.id); }}
                  aria-pressed={accessoryId === a.id}
                  className={`rounded-2xl px-3 py-2.5 text-left transition active:scale-95 ${accessoryId === a.id ? "bg-sky-50 ring-2 ring-sky-400" : "bg-slate-50 ring-1 ring-slate-200"}`}
                >
                  <span className="block text-sm font-extrabold text-slate-700">{a.emoji} {a.name}</span>
                  <span className="block text-xs font-black text-amber-600">{a.price}⭐</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={saveBuddy}
            disabled={points < buddyCost}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 py-3 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-40"
          >
            Save My Buddy ({buddyCost}⭐)
          </button>
          {points < buddyCost && (
            <p className="-mt-3 text-center text-xs font-bold text-slate-400">You need {buddyCost - points} more ⭐ for this buddy combo.</p>
          )}
        </section>
      )}

      {/* Restart */}
      <div className="border-t border-slate-100 pt-4">
        {!showRestartConfirm ? (
          <button
            type="button"
            onClick={() => { playPop(); setShowRestartConfirm(true); }}
            className="w-full rounded-2xl bg-red-500 py-3 font-black text-white shadow transition hover:bg-red-600 active:scale-95"
          >
            🔄 Restart My Points & Items
          </button>
        ) : (
          <div className="space-y-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200" role="alertdialog" aria-label="Confirm restart">
            <p className="text-center font-black text-red-600">Restart everything?</p>
            <p className="text-center text-sm font-semibold text-slate-600">
              Points go to 0 and your items & buddy are cleared. Recipes you already earned points for stay earned (no re-farming!).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setShowRestartConfirm(false)} className="rounded-2xl bg-white py-2.5 font-black text-slate-600 ring-1 ring-slate-200 transition active:scale-95">
                Keep Mine
              </button>
              <button type="button" onClick={confirmRestart} className="rounded-2xl bg-red-500 py-2.5 font-black text-white shadow transition active:scale-95">
                Yes, Restart 🔄
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
