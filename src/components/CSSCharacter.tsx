type CSSCharacterProps = {
  baseImage: string;
  name?: string;
  skinColor?: string;
  accessoryEmoji?: string;
  outfitName?: string;
  outfitEmoji?: string;
  className?: string;
};

// Portrait renderer: base image + skin/aura tint overlay + accessory emoji badge + outfit ribbon.
export function CSSCharacter({
  baseImage,
  name,
  skinColor,
  accessoryEmoji,
  outfitName,
  outfitEmoji,
  className = "",
}: CSSCharacterProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-pink-100 ${className}`}>
      <img
        src={baseImage}
        alt={name ?? "Chef character portrait"}
        className="block h-full w-full object-cover"
        loading="lazy"
      />
      {skinColor && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30 mix-blend-multiply"
          style={{ backgroundColor: skinColor }}
        />
      )}
      {accessoryEmoji && (
        <div
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl shadow-md ring-2 ring-white"
        >
          {accessoryEmoji}
        </div>
      )}
      {(outfitName || outfitEmoji) && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-r from-orange-500 via-pink-500 to-fuchsia-500 px-2 py-1.5 text-xs font-extrabold text-white shadow">
          {outfitEmoji && <span aria-hidden="true">{outfitEmoji}</span>}
          {outfitName && <span className="truncate">{outfitName}</span>}
        </div>
      )}
    </div>
  );
}

type AvatarButtonProps = {
  image: string;
  name: string;
  isSelected: boolean;
  onClick: () => void;
  badge?: string;
};

export function AvatarButton({ image, name, isSelected, onClick, badge }: AvatarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Choose ${name}`}
      aria-pressed={isSelected}
      className={`group relative flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-all duration-300 active:scale-95 ${
        isSelected ? "scale-105 ring-4 ring-amber-400 ring-offset-1" : "hover:-translate-y-1 hover:scale-105"
      }`}
    >
      <span className="relative block w-full overflow-hidden rounded-xl shadow-lg">
        <img src={image} alt={name} className="aspect-square w-full object-cover" loading="lazy" />
        {badge && (
          <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs shadow">
            {badge}
          </span>
        )}
        {isSelected && (
          <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white shadow">
            ✓
          </span>
        )}
      </span>
      <span className="max-w-full truncate text-xs font-extrabold text-slate-700">{name}</span>
    </button>
  );
}
