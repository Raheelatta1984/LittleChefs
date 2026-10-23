export const POINTS_PER_RECIPE = 50;
export const NEW_RECIPE_COST = 200;

export type RoomItemCategory = "furniture" | "decor" | "little";

export type RoomItem = {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: RoomItemCategory;
};

export const ROOM_ITEMS: RoomItem[] = [
  { id: "sofa", name: "Cozy Sofa", emoji: "🛋️", price: 1000, category: "furniture" },
  { id: "armchair", name: "Comfy Armchair", emoji: "💺", price: 800, category: "furniture" },
  { id: "bookshelf", name: "Wooden Bookshelf", emoji: "📚", price: 900, category: "furniture" },
  { id: "tv", name: "Big Screen TV", emoji: "📺", price: 1500, category: "furniture" },
  { id: "piano", name: "Grand Piano", emoji: "🎹", price: 2000, category: "furniture" },
  { id: "coffeetable", name: "Coffee Table", emoji: "🪑", price: 600, category: "furniture" },
  { id: "painting", name: "Wall Painting", emoji: "🖼️", price: 350, category: "decor" },
  { id: "floorlamp", name: "Floor Lamp", emoji: "🛋️", price: 300, category: "decor" },
  { id: "rug", name: "Cozy Rug", emoji: "🧶", price: 400, category: "decor" },
  { id: "clock", name: "Wall Clock", emoji: "🕰️", price: 320, category: "decor" },
  { id: "fireplace", name: "Fireplace", emoji: "🔥", price: 550, category: "decor" },
  { id: "curtains", name: "Sunny Curtains", emoji: "🪟", price: 380, category: "decor" },
  { id: "plant", name: "Little Plant", emoji: "🌱", price: 100, category: "little" },
  { id: "vase", name: "Flower Vase", emoji: "💐", price: 120, category: "little" },
  { id: "cushion", name: "Squishy Cushion", emoji: "🟧", price: 80, category: "little" },
  { id: "teddy", name: "Teddy Bear", emoji: "🧸", price: 150, category: "little" },
  { id: "frame", name: "Picture Frame", emoji: "📸", price: 90, category: "little" },
  { id: "candles", name: "Candle Set", emoji: "🕯️", price: 60, category: "little" },
  { id: "fruitbowl", name: "Fruit Bowl", emoji: "🍎", price: 110, category: "little" },
  { id: "books", name: "Story Books Stack", emoji: "📖", price: 250, category: "little" },
];

export type SkinTone = {
  id: string;
  name: string;
  color: string;
  price: number;
  fantasy?: boolean;
};

export const SKIN_TONES: SkinTone[] = [
  { id: "porcelain", name: "Porcelain Glow", color: "#FFE0BD", price: 50 },
  { id: "sand", name: "Warm Sand", color: "#F1C27D", price: 50 },
  { id: "honey", name: "Honey Gold", color: "#E0AC69", price: 50 },
  { id: "bronze", name: "Sun Bronze", color: "#C68642", price: 50 },
  { id: "cocoa", name: "Rich Cocoa", color: "#8D5524", price: 50 },
  { id: "espresso", name: "Deep Espresso", color: "#6B4226", price: 50 },
  { id: "rainbowpink", name: "🌈 Rainbow Pink Aura", color: "#FF6EC7", price: 400, fantasy: true },
  { id: "rainbowpurple", name: "🌈 Galaxy Purple Aura", color: "#9B5DE5", price: 400, fantasy: true },
  { id: "rainbowcyan", name: "🌈 Ocean Cyan Aura", color: "#00C9A7", price: 400, fantasy: true },
  { id: "rainbowgold", name: "🌈 Sunshine Gold Aura", color: "#FEE440", price: 400, fantasy: true },
];

export type Outfit = {
  id: string;
  name: string;
  emoji: string;
  price: number;
};

export const OUTFITS: Outfit[] = [
  { id: "casual", name: "Casual Explorer", emoji: "👕", price: 100 },
  { id: "sporty", name: "Sporty Star", emoji: "🏃", price: 150 },
  { id: "artist", name: "Little Artist", emoji: "🎨", price: 200 },
  { id: "prochef", name: "Pro Chef", emoji: "👨‍🍳", price: 300 },
  { id: "superhero", name: "Superhero", emoji: "🦸", price: 800 },
  { id: "wizard", name: "Wizard", emoji: "🧙", price: 850 },
  { id: "princess", name: "Princess", emoji: "👸", price: 900 },
  { id: "astronaut", name: "Astronaut", emoji: "🧑‍🚀", price: 1000 },
];

export type Accessory = {
  id: string;
  name: string;
  emoji: string;
  price: number;
};

export const ACCESSORIES: Accessory[] = [
  { id: "flower", name: "Flower", emoji: "🌸", price: 100 },
  { id: "bow", name: "Pretty Bow", emoji: "🎀", price: 120 },
  { id: "glasses", name: "Smart Glasses", emoji: "👓", price: 150 },
  { id: "shades", name: "Cool Shades", emoji: "🕶️", price: 200 },
  { id: "headphones", name: "Headphones", emoji: "🎧", price: 250 },
  { id: "medal", name: "Gold Medal", emoji: "🥇", price: 500 },
  { id: "crown", name: "Royal Crown", emoji: "👑", price: 600 },
];

export const SURPRISE_RECIPES: string[] = [
  "Pancakes",
  "Chicken Biryani",
  "Butter Chicken",
  "Chicken Mandi",
  "Beef Nihari",
  "Tres Leches Cake",
  "Pizza",
  "Sushi",
  "Tacos",
  "Waffles",
  "Mac & Cheese",
  "Brownies",
  "Samosa",
  "Mango Lassi",
  "Haleem",
];

export type BaseCharacter = {
  id: string;
  name: string;
  image: string;
};

export const BASE_CHARACTERS: BaseCharacter[] = [
  { id: "girl1", name: "Braided Chef", image: "/images/characters/girl1.jpg" },
  { id: "girl2", name: "Bow Chef", image: "/images/characters/girl2.jpg" },
  { id: "girl3", name: "Curly Chef", image: "/images/characters/girl3.jpg" },
  { id: "boy1", name: "Spiky Chef", image: "/images/characters/boy1.jpg" },
  { id: "char1", name: "Elf Chef", image: "/images/characters/char1.jpg" },
  { id: "char2", name: "Wizard Chef", image: "/images/characters/char2.jpg" },
  { id: "char3", name: "Astronaut Chef", image: "/images/characters/char3.jpg" },
  { id: "char4", name: "Superhero Chef", image: "/images/characters/char4.jpg" },
];

export type Buddy = {
  baseId: string;
  baseImage: string;
  skinId: string;
  outfitId: string;
  accessoryId: string;
};

export type PlayerState = {
  points: number;
  ownedItems: string[];
  myCharacter: Buddy | null;
  awardedRecipes: string[];
};

export function totalCostOf(skinId: string, outfitId: string, accessoryId: string): number {
  const skin = SKIN_TONES.find((s) => s.id === skinId);
  const outfit = OUTFITS.find((o) => o.id === outfitId);
  const accessory = ACCESSORIES.find((a) => a.id === accessoryId);
  return (skin?.price ?? 0) + (outfit?.price ?? 0) + (accessory?.price ?? 0);
}
