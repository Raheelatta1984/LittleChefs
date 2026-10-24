/**
 * Dependency-free Bloom filters.
 *
 * A Bloom filter answers "is this key *definitely* absent?" in O(k) with a few
 * hundred bytes, which lets the API skip a database round-trip for dish names
 * that cannot possibly be in the shared catalogue. It is deliberately one-sided:
 *
 *   mightContain(key) === false  ->  the key is definitely NOT in the set
 *   mightContain(key) === true   ->  "maybe" — always confirm against the database
 *
 * False positives only cost a query (the old behaviour); false negatives would
 * hide real recipes, so callers must add every write to the filter and rebuild
 * it from the database on a schedule (see services/catalogueIndex.ts).
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a — first independent hash. */
function fnv1a(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** djb2-xor with an avalanche step — second independent hash. */
function djb2xor(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ value.charCodeAt(index)) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  return hash >>> 0;
}

export type BloomFilterStats = {
  capacity: number;
  items: number;
  bitCount: number;
  hashCount: number;
  /** Share of bits set (0–1). Above ~0.5 the filter is losing its usefulness. */
  saturation: number;
  /** Estimated current false-positive rate. */
  falsePositiveRate: number;
};

/** A fixed-size Bloom filter sized from the expected item count and error rate. */
export class BloomFilter {
  private readonly bits: Uint32Array;
  private readonly bitCount: number;
  private readonly hashCount: number;
  private readonly capacity: number;
  private items = 0;
  private setBits = 0;

  constructor(expectedItems = 1_000, falsePositiveRate = 0.01) {
    const capacity = Math.max(1, Math.ceil(expectedItems));
    const rate = Math.min(0.5, Math.max(1e-6, falsePositiveRate));
    // m = -n·ln(p) / ln(2)²
    const bitCount = Math.max(64, Math.ceil((-capacity * Math.log(rate)) / Math.LN2 ** 2));
    this.capacity = capacity;
    this.bitCount = bitCount;
    this.bits = new Uint32Array(Math.ceil(bitCount / 32));
    // k = (m/n)·ln(2), clamped to [1, 16]
    this.hashCount = Math.min(16, Math.max(1, Math.round((bitCount / capacity) * Math.LN2)));
  }

  /** Adds a key. Safe to call repeatedly. */
  add(key: string): void {
    const [first, second] = BloomFilter.hashes(key);
    const step = second | 1; // odd step so positions cycle across the array
    for (let index = 0; index < this.hashCount; index += 1) {
      const position = BloomFilter.position(first, step, index, this.bitCount);
      const word = position >>> 5;
      const mask = 1 << (position & 31);
      const current = this.bits[word] ?? 0;
      if ((current & mask) === 0) {
        this.bits[word] = current | mask;
        this.setBits += 1;
      }
    }
    this.items += 1;
  }

  /** `false` means "definitely not present"; `true` means "maybe present". */
  mightContain(key: string): boolean {
    const [first, second] = BloomFilter.hashes(key);
    const step = second | 1;
    for (let index = 0; index < this.hashCount; index += 1) {
      const position = BloomFilter.position(first, step, index, this.bitCount);
      const word = this.bits[position >>> 5] ?? 0;
      if ((word & (1 << (position & 31))) === 0) return false;
    }
    return true;
  }

  clear(): void {
    this.bits.fill(0);
    this.items = 0;
    this.setBits = 0;
  }

  get size(): number {
    return this.items;
  }

  get estimate(): number {
    const exponent = (-this.hashCount * this.items) / this.bitCount;
    return (1 - Math.exp(exponent)) ** this.hashCount;
  }

  stats(): BloomFilterStats {
    return {
      capacity: this.capacity,
      items: this.items,
      bitCount: this.bitCount,
      hashCount: this.hashCount,
      saturation: this.setBits / this.bitCount,
      falsePositiveRate: Number(this.estimate.toFixed(5)),
    };
  }

  private static hashes(key: string): [number, number] {
    return [fnv1a(key), djb2xor(key)];
  }

  /**
   * Double hashing: position i = (h1 + i·h2) mod m. The intermediate sum stays
   * well inside the exact-integer range of a double (±2^37) and is folded to a
   * positive index, because a negative modulo would index outside the array
   * and silently produce false negatives.
   */
  private static position(first: number, step: number, index: number, bitCount: number): number {
    const sum = first + index * step;
    return ((sum % bitCount) + bitCount) % bitCount;
  }
}

/**
 * A growable Bloom filter: every slice is sized for a known capacity, and a new
 * (larger, tighter) slice is appended when the previous one fills up. Lookups
 * check every slice and additions go to the newest, so keys are never lost —
 * memory keeps a fixed error rate as the catalogue grows.
 */
export class ScalableBloomFilter {
  private readonly initialCapacity: number;
  private readonly falsePositiveRate: number;
  private readonly slices: BloomFilter[] = [];
  private sliceCapacity: number;

  constructor(options: { initialCapacity?: number; falsePositiveRate?: number } = {}) {
    this.initialCapacity = Math.max(16, options.initialCapacity ?? 1_024);
    this.falsePositiveRate = Math.min(0.5, Math.max(1e-6, options.falsePositiveRate ?? 0.01));
    this.sliceCapacity = this.initialCapacity;
    this.slices.push(this.newSlice());
  }

  add(key: string): void {
    const active = this.slices[this.slices.length - 1];
    if (!active || active.size >= this.sliceCapacity) {
      this.sliceCapacity *= 2;
      this.slices.push(this.newSlice());
    }
    this.slices[this.slices.length - 1].add(key);
  }

  mightContain(key: string): boolean {
    return this.slices.some((slice) => slice.mightContain(key));
  }

  clear(): void {
    this.slices.length = 0;
    this.sliceCapacity = this.initialCapacity;
    this.slices.push(this.newSlice());
  }

  get size(): number {
    return this.slices.reduce((total, slice) => total + slice.size, 0);
  }

  stats(): { slices: BloomFilterStats[]; items: number } {
    return {
      items: this.size,
      slices: this.slices.map((slice) => slice.stats()),
    };
  }

  private newSlice(): BloomFilter {
    // Each slice is tighter than the last so the combined error stays bounded.
    const exponent = this.slices.length;
    const rate = this.falsePositiveRate * 0.5 ** exponent;
    return new BloomFilter(this.sliceCapacity, rate);
  }
}
