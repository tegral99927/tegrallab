/**
 * Mulligan Lab - London Mulligan Engine
 * Accurate MTG London Mulligan implementation with Fisher-Yates shuffle,
 * seedable PRNG (Mulberry32), free mulligan logic, and combinatorial bottom evaluation.
 */

const Mulligan = (() => {
  /**
   * Mulberry32 Seedable PRNG
   * Produces reproducible 32-bit floating point pseudorandom numbers [0, 1)
   */
  function createPRNG(seed) {
    if (seed === undefined || seed === null || seed === '') {
      return Math.random;
    }
    // Hash string seed to 32-bit int if string
    let s = 0;
    if (typeof seed === 'string') {
      for (let i = 0; i < seed.length; i++) {
        s = Math.imul(31, s) + seed.charCodeAt(i) | 0;
      }
    } else {
      s = seed | 0;
    }

    return function() {
      let t = s += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Performs in-place Fisher-Yates shuffle on array.
   */
  function shuffleArray(array, rng = Math.random) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }

  /**
   * Helper to build a reliable direct Scryfall image URL
   */
  function getScryfallDirectImageUrl(name, set, collector_number) {
    if (set && collector_number) {
      return `https://api.scryfall.com/cards/${set.toLowerCase()}/${encodeURIComponent(collector_number)}?format=image`;
    }
    return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image`;
  }

  /**
   * Expands mainboard deck list into individual unique card instances.
   * Only mainboard cards are included in the library for mulligans.
   * metaLookup can be either a function (cardName => meta) or a Map.
   */
  function buildLibrary(mainboard, metaLookup = null, tagMap = {}, mdfcSettings = {}) {
    const library = [];
    let instanceIdCounter = 0;

    for (const entry of mainboard) {
      const count = entry.count || 1;
      const cardName = entry.name;
      const key = cardName.toLowerCase().trim();

      // Resolve metadata safely
      let meta = null;
      if (typeof metaLookup === 'function') {
        meta = metaLookup(cardName) || metaLookup(key);
      } else if (metaLookup && typeof metaLookup.get === 'function') {
        meta = metaLookup.get(key) || metaLookup.get(cardName);
      }

      const tags = tagMap[key] || (meta ? meta.tags : []) || [];

      // Determine land status considering MDFC settings
      let isLand = meta ? meta.isLand : false;
      if (!meta) {
        const lower = cardName.toLowerCase();
        if (lower.includes('island') || lower.includes('plains') || lower.includes('swamp') ||
            lower.includes('mountain') || lower.includes('forest') || lower.includes('strand') ||
            lower.includes('tarn') || lower.includes('delta') || lower.includes('canal') ||
            lower.includes('vents') || lower.includes('pool') || lower.includes('grave') ||
            lower.includes('catacomb') || lower.includes('foothills') || lower.includes('flat') ||
            lower.includes('heath') || lower.includes('shrine') || lower.includes('foundry') ||
            lower.includes('garden') || lower.includes('mesa') || lower.includes('rainforest') ||
            lower.includes('wastes')) {
          isLand = true;
        }
      }
      if (mdfcSettings[key] !== undefined) {
        isLand = !!mdfcSettings[key];
      }

      // Determine Japanese and English image URLs
      const directJa = (entry.set && entry.collector_number)
        ? `https://api.scryfall.com/cards/${entry.set.toLowerCase()}/${encodeURIComponent(entry.collector_number)}/ja?format=image`
        : null;
      const directEn = getScryfallDirectImageUrl(cardName, entry.set, entry.collector_number, 'en');

      let imageUriJa = directJa;
      let imageUriEn = directEn;

      if (meta) {
        if (meta.image_uri_ja) imageUriJa = meta.image_uri_ja;
        if (meta.image_uri_en) imageUriEn = meta.image_uri_en;
        if (meta.lang === 'ja' && meta.image_uri) imageUriJa = meta.image_uri;
      }

      const prefLang = (typeof Storage !== 'undefined' && Storage.getSettings)
        ? (Storage.getSettings().cardLanguage || 'ja')
        : 'ja';

      const activeImageUri = prefLang === 'en' ? imageUriEn : (imageUriJa || imageUriEn);

      for (let i = 0; i < count; i++) {
        library.push({
          instanceId: `card_${instanceIdCounter++}`,
          name: cardName,
          key: key,
          set: entry.set || (meta ? meta.set : ''),
          collector_number: entry.collector_number || (meta ? meta.collector_number : ''),
          cmc: meta ? meta.cmc : 0,
          mana_cost: meta ? meta.mana_cost : '',
          type_line: meta ? meta.type_line : '',
          isLand: isLand,
          colors: meta ? meta.colors : [],
          mana_sources: meta ? meta.mana_sources : (isLand ? ['C'] : []),
          tags: [...tags],
          image_uri: activeImageUri,
          image_uri_ja: imageUriJa,
          image_uri_en: imageUriEn
        });
      }
    }

    return library;
  }

  /**
   * Determines whether the current mulligan qualifies for free mulligan.
   */
  function isFreeMulliganAllowed(format, freeMulliganRule, mulliganCount) {
    if (mulliganCount !== 0) return false; // only the 1st mulligan can be free
    if (freeMulliganRule === 'always') return true;
    if (freeMulliganRule === 'never') return false;

    // 'auto' rule: Commander and Brawl formats have 1 free mulligan
    const f = (format || '').toLowerCase();
    return f.includes('commander') || f.includes('edh') || f.includes('brawl');
  }

  /**
   * Calculates the exact number of cards that must be placed on the bottom
   * of the library under London Mulligan rules.
   */
  function getCardsToBottomCount(mulliganCount, format, freeMulliganRule) {
    if (mulliganCount <= 0) return 0;
    const hasFree = (freeMulliganRule === 'always') ||
      (freeMulliganRule === 'auto' && (format === 'commander' || format === 'brawl'));

    const effectiveMulligans = hasFree ? Math.max(0, mulliganCount - 1) : mulliganCount;
    return effectiveMulligans;
  }

  /**
   * Simulates full London Mulligan cycle:
   * Returns library and draws 7 cards.
   */
  function drawOpeningHand(library, rng = Math.random) {
    const deckCopy = [...library];
    shuffleArray(deckCopy, rng);
    const hand = deckCopy.splice(0, 7);
    return {
      hand,
      library: deckCopy
    };
  }

  /**
   * Executes a mulligan step:
   * Merges hand and remaining library, shuffles, and draws 7 cards.
   */
  function executeMulligan(currentHand, remainingLibrary, rng = Math.random) {
    const combined = [...currentHand, ...remainingLibrary];
    shuffleArray(combined, rng);
    const newHand = combined.splice(0, 7);
    return {
      hand: newHand,
      library: combined
    };
  }

  /**
   * Given 7 cards in hand and bottomCount N, generates all combinations of keeping
   * (7 - N) cards. Used by automated simulation to find the optimal keep hand.
   */
  function getSubsetsOfSize(array, size) {
    const result = [];
    function backtrack(start, current) {
      if (current.length === size) {
        result.push([...current]);
        return;
      }
      for (let i = start; i < array.length; i++) {
        current.push(array[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    backtrack(0, []);
    return result;
  }

  return {
    createPRNG,
    shuffleArray,
    buildLibrary,
    isFreeMulliganAllowed,
    getCardsToBottomCount,
    drawOpeningHand,
    executeMulligan,
    getSubsetsOfSize
  };
})();
