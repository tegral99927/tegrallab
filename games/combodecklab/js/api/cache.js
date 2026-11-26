// cache.js - Card metadata caching in memory & LocalStorage

const CACHE_PREFIX = "scry_card_";

export const CardCache = {
  memoryCache: new Map(),

  get(cardName) {
    if (!cardName) return null;
    const clean = cardName.trim().toLowerCase();
    if (this.memoryCache.has(clean)) {
      return this.memoryCache.get(clean);
    }
    try {
      const stored = localStorage.getItem(CACHE_PREFIX + clean);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.memoryCache.set(clean, parsed);
        return parsed;
      }
    } catch (e) {
      // Storage error ignore
    }
    return null;
  },

  set(cardName, metadata) {
    if (!cardName || !metadata) return;
    const clean = cardName.trim().toLowerCase();
    this.memoryCache.set(clean, metadata);
    try {
      localStorage.setItem(CACHE_PREFIX + clean, JSON.stringify(metadata));
    } catch (e) {
      // Storage quota ignore
    }
  },

  populateBulk(metadataMap) {
    for (const [name, meta] of Object.entries(metadataMap)) {
      const clean = name.trim().toLowerCase();
      this.memoryCache.set(clean, meta);
      if (meta.name) {
        this.memoryCache.set(meta.name.trim().toLowerCase(), meta);
      }
      if (meta.baseName) {
        this.memoryCache.set(meta.baseName.trim().toLowerCase(), meta);
      }
    }
  }
};
