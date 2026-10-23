import { useEffect, useState } from "react";
import type { ChefProfile, Role } from "../../shared/types";
import { api, ApiClientError, type AuthState } from "../lib/api";

export type GateCharacter = { id: string; name: string; title: string; image: string; emoji: string };

const ROLE_FALLBACK: Role[] = [
  { id: "junior", label: "Junior Chef", ages: "10–14", emoji: "👦", rank: 2, description: "Learns the basics with a grown-up nearby.", canPublish: false, requiresGrownup: true, maxBatchServings: 8 },
  { id: "teen", label: "Teen Chef", ages: "15–19", emoji: "🧑", rank: 3, description: "Cooks independently and can share recipes.", canPublish: true, requiresGrownup: false, maxBatchServings: 16 },
  { id: "adult", label: "Adult Chef", ages: "Adults", emoji: "👨‍🍳", rank: 4, description: "Runs the family kitchen.", canPublish: true, requiresGrownup: false, maxBatchServings: 40 },
  { id: "master", label: "Master Chef", ages: "Pro", emoji: "👩‍🍳", rank: 5, description: "Professional standards and recipe authoring.", canPublish: true, requiresGrownup: false, maxBatchServings: 100 },
];

export function ChefGate({
  characters,
  onAuthed,
  onClose,
}: {
  characters: GateCharacter[];
  onAuthed: (auth: AuthState) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [roles, setRoles] = useState<Role[]>(ROLE_FALLBACK);
  const [name, setName] = useState("");
  const [role, setRole] = useState("junior");
  const [avatar, setAvatar] = useState(characters[0]?.id ?? "girl1");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.roles()
      .then((list) => {
        if (!cancelled && list.length) {
          setRoles(list);
          setRole((current) => (list.some((entry) => entry.id === current) ? current : list[0].id));
        }
      })
      .catch(() => {
        /* offline: keep the fallback role list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRole = roles.find((entry) => entry.id === role) ?? roles[0];

  async function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Please type a chef name with at least 2 letters.");
      return;
    }
    if (pin && !/^\d{4}$/.test(pin)) {
      setError("The PIN must be exactly 4 digits (or leave it empty).");
      return;
    }

    setBusy(true);
    try {
      const auth: AuthState =
        mode === "create"
          ? await api.createChef({ displayName: name.trim(), role, avatar, pin: pin || null })
          : await api.signIn({ displayName: name.trim(), role, pin: pin || null });
      onAuthed(auth);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "We could not open your kitchen. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Chef sign in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl font-black text-slate-800">🔐 My Chef Kitchen</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Your recipes are private. Only you can open your own recipe book.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in"
            className="rounded-full bg-slate-100 px-3 py-2 font-black text-slate-500 transition active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["create", "signin"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setMode(option);
                setError(null);
              }}
              className={`rounded-2xl py-2.5 font-black transition active:scale-95 ${
                mode === option
                  ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {option === "create" ? "✨ New chef" : "👋 I'm back"}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-black text-slate-600" htmlFor="chef-name">
          Chef name
        </label>
        <input
          id="chef-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder="e.g. Amina"
          className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-bold outline-none focus:border-orange-400"
          autoComplete="off"
        />

        <p className="mt-4 text-sm font-black text-slate-600">Pick your chef role</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {roles.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setRole(entry.id)}
              aria-pressed={role === entry.id}
              className={`rounded-2xl border-2 p-2.5 text-left transition active:scale-[0.98] ${
                role === entry.id
                  ? "border-orange-400 bg-orange-50"
                  : "border-slate-200 bg-white hover:border-orange-200"
              }`}
            >
              <span className="block text-sm font-black text-slate-800">
                {entry.emoji} {entry.label}
              </span>
              <span className="block text-[11px] font-bold text-slate-400">Ages {entry.ages}</span>
            </button>
          ))}
        </div>
        {selectedRole && (
          <p className="mt-2 rounded-2xl bg-sky-50 p-3 text-xs font-semibold text-sky-800 ring-1 ring-sky-100">
            {selectedRole.description}
            {selectedRole.requiresGrownup ? " A grown-up must help with heat and knives." : ""}
            {` Up to ${selectedRole.maxBatchServings} eaters per batch.`}
          </p>
        )}

        {mode === "create" && (
          <>
            <p className="mt-4 text-sm font-black text-slate-600">Pick your buddy</p>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
              {characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => setAvatar(character.id)}
                  aria-pressed={avatar === character.id}
                  aria-label={`${character.name} the ${character.title}`}
                  className={`shrink-0 rounded-2xl border-2 p-1 transition active:scale-95 ${
                    avatar === character.id ? "border-orange-400" : "border-transparent"
                  }`}
                >
                  <img src={character.image} alt="" className="h-14 w-14 rounded-xl object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mt-4 block text-sm font-black text-slate-600" htmlFor="chef-pin">
          Secret 4-digit PIN <span className="font-bold text-slate-400">(optional)</span>
        </label>
        <input
          id="chef-pin"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="••••"
          className="mt-1 w-full rounded-2xl border-2 border-slate-200 px-4 py-3 font-black tracking-[0.5em] outline-none focus:border-orange-400"
          autoComplete="off"
        />

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700 ring-1 ring-red-200" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="mt-4 w-full rounded-3xl bg-gradient-to-r from-orange-500 to-pink-500 py-3.5 font-black text-white shadow-lg transition active:scale-95 disabled:opacity-60"
        >
          {busy ? "Opening your kitchen…" : mode === "create" ? "Open my private kitchen 🔓" : "Sign in to my kitchen 🔑"}
        </button>
        <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
          No email needed — your recipes stay on this kitchen's server and only your chef profile can see them.
        </p>
      </div>
    </div>
  );
}

export function ChefBadge({ chef, onOpen }: { chef: ChefProfile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-2xl bg-white px-3 py-1.5 shadow ring-1 ring-orange-100 transition active:scale-95"
      aria-label={`Signed in as ${chef.displayName}, ${chef.roleLabel}`}
    >
      <span className="text-lg" aria-hidden="true">{chef.roleEmoji}</span>
      <span className="text-left">
        <span className="block text-xs font-black text-slate-700">{chef.displayName}</span>
        <span className="block text-[10px] font-bold text-slate-400">{chef.roleLabel}</span>
      </span>
    </button>
  );
}
