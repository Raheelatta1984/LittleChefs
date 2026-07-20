import { useState, useEffect } from "react";
import { playDing, playSquish } from "../utils/audio";

// Playful animated countdown timer for kids
export function InteractiveTimer({ initialMinutes }: { initialMinutes: number }) {
  const [secondsLeft, setSecondsLeft] = useState(initialMinutes * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    setSecondsLeft(initialMinutes * 60);
    setIsActive(false);
  }, [initialMinutes]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
        if (Math.random() > 0.7) {
          playSquish(); // cute rhythmic tick
        }
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      playDing();
      setIsActive(false);
    }
    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="mt-4 rounded-2xl border-2 border-orange-200 bg-orange-50/70 p-4 text-center shadow-inner">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-orange-600">
          ⏱️ Kids Kitchen Timer
        </span>
        <button
          onClick={() => {
            setSecondsLeft(initialMinutes * 60);
            setIsActive(false);
          }}
          className="rounded-lg bg-orange-200 px-2 py-1 text-xs font-bold text-orange-800 transition hover:bg-orange-300"
        >
          Reset
        </button>
      </div>

      <div className="my-3 text-3xl font-black tabular-nums text-slate-800">
        {mins.toString().padStart(2, "0")}:{secs.toString().padStart(2, "0")}
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => {
            setIsActive(!isActive);
            playDing();
          }}
          className={`rounded-xl px-4 py-2 text-sm font-extrabold text-white shadow transition active:scale-95 ${
            isActive
              ? "bg-red-500 hover:bg-red-600 shadow-red-200"
              : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
          }`}
        >
          {isActive ? "Pause ⏸️" : secondsLeft === 0 ? "Done! 🎉" : "Start Timer ⏱️"}
        </button>
      </div>

      {secondsLeft === 0 && (
        <p className="mt-2 text-xs font-bold text-emerald-600 animate-pulse">
          🔔 Beep Beep! Time is up! Ask a grown-up to help!
        </p>
      )}
    </div>
  );
}

type StepGameType = "stir" | "crack" | "flip" | "chop" | "none";

// Helper to decide if step warrants a mini sensory interaction
export function getGameType(stepText: string): StepGameType {
  const text = stepText.toLowerCase();
  if (text.includes("stir") || text.includes("mix") || text.includes("whisk") || text.includes("blend")) {
    return "stir";
  }
  if (text.includes("crack") || text.includes("egg") || text.includes("eggs")) {
    return "crack";
  }
  if (text.includes("flip") || text.includes("turn over")) {
    return "flip";
  }
  if (text.includes("cut") || text.includes("slice") || text.includes("chop") || text.includes("peel") || text.includes("tear")) {
    return "chop";
  }
  return "none";
}

export function InteractiveCookingWidget({ stepText }: { stepText: string }) {
  const gameType = getGameType(stepText);

  // Parse time for timers: matches "X minutes" or "X-Y minutes"
  const timeMatch = stepText.match(/(\d+)(?:\s*–\s*|\s*-\s*)?(\d+)?\s*minutes/i);
  const minutes = timeMatch ? parseInt(timeMatch[1], 10) : 0;

  return (
    <div className="mt-4 space-y-4">
      {minutes > 0 && <InteractiveTimer initialMinutes={minutes} />}

      {gameType !== "none" && (
        <div className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/50 p-4 text-center">
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-rose-500">
            🎮 Chef Sensory Mini-Game!
          </p>

          {gameType === "stir" && <StirGame />}
          {gameType === "crack" && <CrackGame />}
          {gameType === "flip" && <FlipGame />}
          {gameType === "chop" && <ChopGame />}
        </div>
      )}
    </div>
  );
}

function StirGame() {
  const [stirs, setStirs] = useState(0);
  const isDone = stirs >= 5;

  function handleStir() {
    if (isDone) return;
    setStirs((s) => s + 1);
    playSquish();
    if (stirs + 1 === 5) {
      playDing();
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-rose-700">
        Tap the bowl to stir the ingredients! ({stirs}/5)
      </p>
      <div className="flex justify-center">
        <button
          onClick={handleStir}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 border-4 border-rose-200 shadow-md transition duration-200 ${
            isDone ? "bg-amber-100 border-amber-300" : "active:scale-95 active:rotate-12"
          }`}
        >
          <div className="absolute text-5xl select-none">🥣</div>
          {!isDone && <div className="absolute top-2 right-2 text-3xl animate-bounce">🥄</div>}
          {isDone && <div className="absolute top-2 right-2 text-2xl">✨</div>}
        </button>
      </div>
      {isDone && (
        <p className="mt-2 text-xs font-bold text-emerald-600 animate-pulse">
          🎉 Mix complete! You are a super stirrer!
        </p>
      )}
    </div>
  );
}

function CrackGame() {
  const [taps, setTaps] = useState(0);
  const isDone = taps >= 3;

  function handleTap() {
    if (isDone) return;
    setTaps((t) => t + 1);
    playSquish();
    if (taps + 1 === 3) {
      playDing();
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-rose-700">
        Gently tap the egg on the bowl to crack it! ({taps}/3)
      </p>
      <div className="flex justify-center">
        <button
          onClick={handleTap}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-orange-50 border-4 border-rose-200 shadow-md transition duration-200 ${
            isDone ? "bg-amber-100 border-amber-300" : "active:scale-90"
          }`}
        >
          <div className="text-5xl select-none">
            {taps === 0 ? "🥚" : taps === 1 ? "🍳" : taps === 2 ? "🍳" : "🍳🐣"}
          </div>
          {!isDone && (
            <div className="absolute -top-2 -right-2 rounded-full bg-rose-400 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider animate-bounce">
              Tap!
            </div>
          )}
        </button>
      </div>
      {isDone && (
        <p className="mt-2 text-xs font-bold text-emerald-600 animate-pulse">
          🍳 Egg cracked beautifully! Nice work!
        </p>
      )}
    </div>
  );
}

function FlipGame() {
  const [flipped, setFlipped] = useState(false);

  function handleFlip() {
    setFlipped(!flipped);
    playSquish();
    playDing();
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-rose-700">
        Slide the spatula underneath and flip it!
      </p>
      <div className="flex justify-center gap-6">
        <button
          onClick={handleFlip}
          className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-orange-50 border-4 border-rose-200 shadow-md transition duration-300 active:scale-90"
        >
          <div
            className={`text-5xl select-none transition-transform duration-500 ${
              flipped ? "rotate-180 scale-110" : "rotate-0"
            }`}
          >
            🥞
          </div>
          <div className="absolute bottom-1 right-1 text-2xl">🥄</div>
        </button>
      </div>
      {flipped && (
        <p className="mt-2 text-xs font-bold text-emerald-600 animate-pulse">
          🥞 Perfect flip! Golden brown on both sides!
        </p>
      )}
    </div>
  );
}

function ChopGame() {
  const [chops, setChops] = useState(0);
  const isDone = chops >= 4;

  function handleChop() {
    if (isDone) return;
    setChops((c) => c + 1);
    playSquish();
    if (chops + 1 === 4) {
      playDing();
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-rose-700">
        Tap the cutting board to chop up the items safely! ({chops}/4)
      </p>
      <div className="flex justify-center">
        <button
          onClick={handleChop}
          className={`relative flex h-20 w-36 items-center justify-center rounded-xl bg-amber-50 border-4 border-amber-300 shadow-md transition duration-150 ${
            isDone ? "bg-emerald-50 border-emerald-300" : "active:scale-95"
          }`}
        >
          <div className="absolute text-3xl top-1/2 left-1/4 -translate-y-1/2 select-none">
            {chops === 0 ? "🥕" : chops === 1 ? "🥦" : chops === 2 ? "🍎" : "🥑"}
          </div>
          <div className="absolute text-4xl top-1/2 right-1/4 -translate-y-1/2 select-none">
            🔪
          </div>
          {!isDone && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-400 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider animate-bounce">
              Chop!
            </div>
          )}
        </button>
      </div>
      {isDone && (
        <p className="mt-2 text-xs font-bold text-emerald-600 animate-pulse">
          🥕 Everything is chopped safely like a master chef!
        </p>
      )}
    </div>
  );
}