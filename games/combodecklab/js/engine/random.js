// random.js - Seeded PRNG (Mulberry32) & Deterministic Fisher-Yates shuffle

export class PRNG {
  constructor(seed = null) {
    this.initialSeed = seed !== null && seed !== undefined ? seed : PRNG.generateSeed();
    this.state = this.hashSeed(this.initialSeed);
    this.calls = 0;
  }

  static generateSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  hashSeed(seed) {
    if (typeof seed === "string") {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
      }
      return h >>> 0;
    }
    return (Number(seed) || 1) >>> 0;
  }

  // Returns float in [0, 1)
  next() {
    this.calls++;
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max]
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // In-place Fisher-Yates shuffle
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getState() {
    return {
      initialSeed: this.initialSeed,
      state: this.state,
      calls: this.calls
    };
  }

  restoreState(saved) {
    this.initialSeed = saved.initialSeed;
    this.state = saved.state;
    this.calls = saved.calls;
  }
}
