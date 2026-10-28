/**
 * MTGCollectionSummary - scryfall.js
 * Scryfall API integration with Japanese-first display, rate limiting,
 * multi-face handling, and IndexedDB caching.
 */

(function (window) {
  'use strict';

  const SCRYFALL_BASE = 'https://api.scryfall.com';
  const RATE_LIMIT_DELAY = 100; // ms between requests to respect Scryfall limits

  const SET_ALIASES = {
    'DAR': 'DOM',
    'MPS_KLD': 'MPS',
    'MPS_AKH': 'MP2',
    'FRF_UGIN': 'FRF',
    'CON': 'CON_'
  };

  const BASIC_LANDS_MAP = {
    '森': { name: 'Forest', color_identity: ['G'] },
    '島': { name: 'Island', color_identity: ['U'] },
    '沼': { name: 'Swamp', color_identity: ['B'] },
    '山': { name: 'Mountain', color_identity: ['R'] },
    '平地': { name: 'Plains', color_identity: ['W'] },
    '荒地': { name: 'Wastes', color_identity: [] },
    '冠雪の森': { name: 'Snow-Covered Forest', color_identity: ['G'] },
    '冠雪の島': { name: 'Snow-Covered Island', color_identity: ['U'] },
    '冠雪の沼': { name: 'Snow-Covered Swamp', color_identity: ['B'] },
    '冠雪の山': { name: 'Snow-Covered Mountain', color_identity: ['R'] },
    '冠雪の平地': { name: 'Snow-Covered Plains', color_identity: ['W'] },
    '冠雪の荒地': { name: 'Snow-Covered Wastes', color_identity: [] },
    'Forest': { name: 'Forest', color_identity: ['G'] },
    'Island': { name: 'Island', color_identity: ['U'] },
    'Swamp': { name: 'Swamp', color_identity: ['B'] },
    'Mountain': { name: 'Mountain', color_identity: ['R'] },
    'Plains': { name: 'Plains', color_identity: ['W'] },
    'Wastes': { name: 'Wastes', color_identity: [] },
    'Snow-Covered Forest': { name: 'Snow-Covered Forest', color_identity: ['G'] },
    'Snow-Covered Island': { name: 'Snow-Covered Island', color_identity: ['U'] },
    'Snow-Covered Swamp': { name: 'Snow-Covered Swamp', color_identity: ['B'] },
    'Snow-Covered Mountain': { name: 'Snow-Covered Mountain', color_identity: ['R'] },
    'Snow-Covered Plains': { name: 'Snow-Covered Plains', color_identity: ['W'] },
    'Snow-Covered Wastes': { name: 'Snow-Covered Wastes', color_identity: [] }
  };

  class ScryfallClient {
    constructor() {
      this.queue = [];
      this.isProcessingQueue = false;
      this.lastRequestTime = 0;
      this.SET_ALIASES = SET_ALIASES;
      this.BASIC_LANDS_MAP = BASIC_LANDS_MAP;
    }

    // Queue request to prevent exceeding Scryfall 50-100ms rate limits
    async request(url, options = {}) {
      return new Promise((resolve, reject) => {
        this.queue.push({ url, options, resolve, reject });
        this.processQueue();
      });
    }

    async processQueue() {
      if (this.isProcessingQueue || this.queue.length === 0) return;
      this.isProcessingQueue = true;

      while (this.queue.length > 0) {
        const item = this.queue.shift();
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        if (elapsed < RATE_LIMIT_DELAY) {
          await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY - elapsed));
        }

        try {
          const res = await fetch(item.url, item.options);
          this.lastRequestTime = Date.now();

          if (res.status === 429) {
            // Backoff on rate limit
            console.warn('Scryfall 429 Rate limited. Waiting 1.5 seconds...');
            await new Promise((r) => setTimeout(r, 1500));
            // Put item back at the front of the queue
            this.queue.unshift(item);
            continue;
          }

          if (!res.ok) {
            let errorJson = null;
            try {
              errorJson = await res.json();
            } catch (e) {}
            const err = new Error(
              errorJson && errorJson.details
                ? errorJson.details
                : `Scryfall request error: ${res.status}`
            );
            err.status = res.status;
            err.details = errorJson;
            item.reject(err);
            continue;
          }

          const data = await res.json();
          item.resolve(data);
        } catch (err) {
          item.reject(err);
        }
      }

      this.isProcessingQueue = false;
    }

    // Format raw Scryfall card into unified normalized card model
    normalizeCard(raw) {
      if (!raw) return null;

      // Detect Japanese localization if available
      let nameJa = '';
      let printedText = '';
      if (raw.lang === 'ja') {
        nameJa = raw.printed_name || raw.name;
        printedText = raw.printed_text || '';
      }

      // Check card faces (for Transform, Modal DFC, Adventure, Split)
      const isMultiFace = Array.isArray(raw.card_faces) && raw.card_faces.length > 1;
      let primaryImage = '';
      let secondaryImage = '';
      let faces = [];

      if (isMultiFace) {
        faces = raw.card_faces.map((face) => {
          const faceImg = face.image_uris
            ? face.image_uris.normal || face.image_uris.small
            : '';
          return {
            name: face.name,
            name_ja: face.printed_name || '',
            mana_cost: face.mana_cost || '',
            type_line: face.type_line || '',
            oracle_text: face.oracle_text || '',
            image_uri: faceImg,
            power: face.power,
            toughness: face.toughness,
            loyalty: face.loyalty
          };
        });

        primaryImage =
          raw.image_uris?.normal ||
          raw.card_faces[0].image_uris?.normal ||
          raw.card_faces[0].image_uris?.small ||
          '';
        secondaryImage =
          raw.card_faces[1]?.image_uris?.normal ||
          raw.card_faces[1]?.image_uris?.small ||
          '';
      } else {
        primaryImage =
          raw.image_uris?.normal ||
          raw.image_uris?.small ||
          '';
      }

      // Fallback display name (Japanese first if available)
      const displayName = nameJa || raw.name;

      const typeLine = raw.type_line || (raw.card_faces ? raw.card_faces[0]?.type_line : '') || '';
      const isLand = /land|土地/i.test(typeLine);

      let manaCost = raw.mana_cost || (raw.card_faces ? raw.card_faces[0]?.mana_cost : '') || '';
      let cmc = raw.cmc !== undefined ? raw.cmc : 0;
      if (isLand) {
        manaCost = '';
        cmc = 0;
      }

      let colorIdentity = Array.isArray(raw.color_identity) ? [...raw.color_identity] : [];
      let colors = raw.colors || (raw.card_faces ? raw.card_faces[0]?.colors : []) || [];
      if (isLand) {
        colors = [];
      }

      const cleanLandJa = (nameJa || '').trim();
      const cleanLandEn = (raw.name || '').trim();
      if (BASIC_LANDS_MAP[cleanLandJa]) {
        colorIdentity = [...BASIC_LANDS_MAP[cleanLandJa].color_identity];
      } else if (BASIC_LANDS_MAP[cleanLandEn]) {
        colorIdentity = [...BASIC_LANDS_MAP[cleanLandEn].color_identity];
      }

      return {
        id: raw.id,
        oracle_id: raw.oracle_id || raw.id,
        name: raw.name,
        name_ja: nameJa,
        display_name: displayName,
        lang: raw.lang || 'en',
        mana_cost: manaCost,
        cmc: cmc,
        type_line: typeLine,
        oracle_text: raw.oracle_text || '',
        printed_text: printedText,
        colors: colors,
        color_identity: colorIdentity,
        rarity: raw.rarity || 'common',
        set: (raw.set || '').toUpperCase(),
        set_name: raw.set_name || '',
        collector_number: raw.collector_number || '',
        image_uri: primaryImage,
        image_uri_back: secondaryImage,
        faces: faces,
        prices: {
          usd: parseFloat(raw.prices?.usd) || 0,
          usd_foil: parseFloat(raw.prices?.usd_foil) || 0,
          eur: parseFloat(raw.prices?.eur) || 0,
          jpy: 0 // Will compute based on USD or Scryfall if available
        },
        legalities: raw.legalities || {},
        scryfall_uri: raw.scryfall_uri || `https://scryfall.com/card/${raw.set}/${raw.collector_number}`,
        raw: raw
      };
    }

    // Search cards with query and options
    async search(query, page = 1) {
      if (!query || query.trim() === '') return { total_cards: 0, data: [], has_more: false };
      const trimmed = query.trim();
      const cacheKey = `search_${encodeURIComponent(trimmed)}_p${page}`;

      if (window.DB) {
        const cached = await window.DB.getCache(cacheKey);
        if (cached) return cached;
      }

      // Construct Scryfall query
      // If query contains Japanese characters (Hiragana, Katakana, CJK Unified Ideographs),
      // we check both Oracle search and lang:ja / printed name.
      let scryfallQuery = trimmed;
      const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(trimmed);

      if (hasJapanese && !trimmed.includes('lang:')) {
        // Query printed text/name or search with lang:ja
        scryfallQuery = `include:extras (name:"${trimmed}" or printed_name:"${trimmed}")`;
      }

      const url = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(scryfallQuery)}&page=${page}&include_multilingual=true`;

      try {
        const res = await this.request(url);
        const normalizedList = (res.data || []).map((c) => this.normalizeCard(c));
        const result = {
          total_cards: res.total_cards || normalizedList.length,
          has_more: !!res.has_more,
          next_page: res.next_page || null,
          data: normalizedList
        };

        if (window.DB) {
          await window.DB.setCache(cacheKey, result);
        }

        return result;
      } catch (err) {
        // If specific search fails and has Japanese, try general search without quotes
        if (hasJapanese) {
          try {
            const fallbackUrl = `${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(trimmed)}&include_multilingual=true`;
            const fbRes = await this.request(fallbackUrl);
            const normalizedList = (fbRes.data || []).map((c) => this.normalizeCard(c));
            return {
              total_cards: fbRes.total_cards || normalizedList.length,
              has_more: !!fbRes.has_more,
              data: normalizedList
            };
          } catch (e2) {}
        }
        console.warn('Scryfall search error:', err.message);
        return { total_cards: 0, has_more: false, data: [] };
      }
    }

    // Autocomplete card names
    async autocomplete(query) {
      if (!query || query.trim().length < 2) return [];
      const trimmed = query.trim();
      const cacheKey = `ac_${encodeURIComponent(trimmed)}`;

      if (window.DB) {
        const cached = await window.DB.getCache(cacheKey);
        if (cached) return cached;
      }

      const url = `${SCRYFALL_BASE}/cards/autocomplete?q=${encodeURIComponent(trimmed)}`;
      try {
        const res = await this.request(url);
        const data = res.data || [];
        if (window.DB) {
          await window.DB.setCache(cacheKey, data);
        }
        return data;
      } catch (e) {
        return [];
      }
    }

    // Get card by exact or fuzzy name
    async getCardByName(name, set = null) {
      if (!name) return null;
      const cleanName = name.trim();
      const cacheKey = `named_${encodeURIComponent(cleanName)}_${set || 'all'}`;

      if (window.DB) {
        const cached = await window.DB.getCache(cacheKey);
        if (cached) return cached;
      }

      let url = `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(cleanName)}`;
      if (set) {
        url += `&set=${encodeURIComponent(set.toLowerCase())}`;
      }

      try {
        const raw = await this.request(url);
        const card = this.normalizeCard(raw);
        if (window.DB && card) {
          await window.DB.setCache(cacheKey, card);
        }
        return card;
      } catch (err) {
        // If fuzzy failed, try searching in Japanese if it has Japanese characters
        const hasJapanese = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(cleanName);
        if (hasJapanese) {
          const searchRes = await this.search(cleanName, 1);
          if (searchRes.data && searchRes.data.length > 0) {
            return searchRes.data[0];
          }
        }
        return null;
      }
    }

    // Helper to find exact match in search results
    findBestMatch(cards, target) {
      if (!cards || cards.length === 0) return null;
      const lower = (target || '').toLowerCase().trim();
      // 1. Exact match on name_ja, printed_name, name, or display_name
      const exact = cards.find(
        (c) =>
          (c.name_ja && c.name_ja.toLowerCase().trim() === lower) ||
          (c.printed_name && c.printed_name.toLowerCase().trim() === lower) ||
          (c.name && c.name.toLowerCase().trim() === lower) ||
          (c.raw?.printed_name && c.raw.printed_name.toLowerCase().trim() === lower) ||
          (c.display_name && c.display_name.toLowerCase().trim() === lower)
      );
      if (exact) return exact;

      // 2. Starts with target
      const starts = cards.find(
        (c) =>
          (c.name_ja && c.name_ja.toLowerCase().trim().startsWith(lower)) ||
          (c.name && c.name.toLowerCase().trim().startsWith(lower))
      );
      if (starts) return starts;

      return cards[0];
    }

    // 5-Stage Automated Fallback Card Resolver
    async resolveCard(name, set = '', collectorNumber = '') {
      if (!name && !collectorNumber) return null;

      const cleanName = (name || '').trim();
      const cleanSet = (set || '').trim().toUpperCase();
      const normSet = (this.SET_ALIASES[cleanSet] || cleanSet).toLowerCase();
      const cleanNumber = (collectorNumber || '').trim();
      const isJa = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(cleanName);

      // --- Fast-path: Basic Lands (Japanese or English) ---
      const basicInfo = this.BASIC_LANDS_MAP[cleanName];
      if (basicInfo) {
        const engName = basicInfo.name;
        try {
          let landUrl = `${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(engName)}`;
          if (normSet) landUrl += `&set=${normSet}`;
          const res = await this.request(landUrl);
          if (res) {
            const card = this.normalizeCard(res);
            card.name_ja = isJa ? cleanName : (card.name_ja || cleanName);
            card.display_name = cleanName;
            card.mana_cost = '';
            card.cmc = 0;
            card.colors = [];
            card.color_identity = [...basicInfo.color_identity];
            return card;
          }
        } catch (e) {
          return {
            id: `basic-${engName.toLowerCase().replace(/\s+/g, '-')}`,
            oracle_id: `basic-${engName.toLowerCase().replace(/\s+/g, '-')}`,
            name: engName,
            name_ja: isJa ? cleanName : '',
            display_name: cleanName,
            lang: isJa ? 'ja' : 'en',
            mana_cost: '',
            cmc: 0,
            type_line: `基本土地 ― ${cleanName}`,
            oracle_text: `({T}: 加える。)`,
            printed_text: `({T}: 加える。)`,
            colors: [],
            color_identity: [...basicInfo.color_identity],
            rarity: 'common',
            set: cleanSet || 'BASIC',
            set_name: cleanSet || 'Basic Land',
            collector_number: cleanNumber || '',
            image_uri: '',
            prices: { usd: 0, usd_foil: 0, eur: 0, jpy: 0 }
          };
        }
      }

      // Check DB cache first
      if (window.DB) {
        if (normSet && cleanNumber) {
          const cached = await window.DB.getCache(`id_${normSet}_${cleanNumber}`);
          if (cached) return cached;
        }
        if (cleanName) {
          const cached = await window.DB.getCache(`named_${encodeURIComponent(cleanName)}_${normSet || 'all'}`);
          if (cached) return cached;
          const cachedAll = await window.DB.getCache(`named_${encodeURIComponent(cleanName)}_all`);
          if (cachedAll) return cachedAll;
        }
      }

      // --- Attempt 1: Direct Set & Collector Number ---
      if (normSet && cleanNumber) {
        try {
          const directUrl = `${SCRYFALL_BASE}/cards/${normSet}/${cleanNumber}`;
          const res = await this.request(directUrl);
          if (res) {
            const card = this.normalizeCard(res);
            if (isJa) { card.name_ja = cleanName; card.display_name = cleanName; }
            return card;
          }
        } catch (e) {}
      }

      // --- Attempt 2: Exact Name / Japanese Search with Set if provided ---
      if (cleanName) {
        if (isJa) {
          const jaQuery = normSet 
            ? `include:extras s:${normSet} (name:"${cleanName}" or printed_name:"${cleanName}")`
            : `include:extras (name:"${cleanName}" or printed_name:"${cleanName}")`;
          const res = await this.search(jaQuery, 1);
          if (res.data && res.data.length > 0) {
            const card = this.findBestMatch(res.data, cleanName);
            if (card) {
              card.name_ja = cleanName;
              card.display_name = cleanName;
              return card;
            }
          }
        } else {
          try {
            let exactUrl = `${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(cleanName)}`;
            if (normSet) exactUrl += `&set=${normSet}`;
            const res = await this.request(exactUrl);
            if (res) return this.normalizeCard(res);
          } catch (e) {}
        }
      }

      // --- Attempt 3: Retry without Set (Ignore Set Code in case of mismatch) & Normalized Diacritics ---
      const deaccented = cleanName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/æ/gi, 'ae')
        .replace(/œ/gi, 'oe')
        .replace(/[’‘`]/g, "'")
        .replace(/[“”]/g, '"')
        .trim();

      if (cleanName) {
        if (isJa) {
          const res = await this.search(`include:extras (name:"${cleanName}" or printed_name:"${cleanName}")`, 1);
          if (res.data && res.data.length > 0) {
            const card = this.findBestMatch(res.data, cleanName);
            if (card) {
              card.name_ja = cleanName;
              card.display_name = cleanName;
              return card;
            }
          }
        } else {
          try {
            const fuzzyUrl = `${SCRYFALL_BASE}/cards/named?fuzzy=${encodeURIComponent(deaccented)}`;
            const res = await this.request(fuzzyUrl);
            if (res) return this.normalizeCard(res);
          } catch (e) {}
        }
      }

      // --- Attempt 4: Split Cards & Double-Faced Front Face ---
      let frontFace = '';
      if (cleanName.includes('//')) {
        frontFace = cleanName.split('//')[0].trim();
      } else if (cleanName.includes('/')) {
        frontFace = cleanName.split('/')[0].trim();
      } else if (cleanName.includes(' & ')) {
        frontFace = cleanName.split(' & ')[0].trim();
      }

      if (frontFace && frontFace !== cleanName) {
        const subCard = await this.getCardByName(frontFace);
        if (subCard) {
          if (isJa) { subCard.name_ja = cleanName; subCard.display_name = cleanName; }
          return subCard;
        }
      }

      // --- Attempt 5: Permissive Autocomplete & Token Cleaning ---
      if (!isJa && deaccented.length >= 3) {
        try {
          const suggestions = await this.autocomplete(deaccented.substring(0, 20));
          if (suggestions && suggestions.length > 0) {
            const exactRes = await this.request(`${SCRYFALL_BASE}/cards/named?exact=${encodeURIComponent(suggestions[0])}`);
            if (exactRes) return this.normalizeCard(exactRes);
          }
        } catch (e) {}
      }

      if (cleanName) {
        try {
          const cleanTerms = deaccented.replace(/[^\w\s\u3040-\u30ff\u3400-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleanTerms.length >= 3) {
            const res = await this.search(`include:extras ${cleanTerms}`, 1);
            if (res.data && res.data.length > 0) {
              const card = this.findBestMatch(res.data, cleanName);
              if (card) {
                if (isJa) { card.name_ja = cleanName; card.display_name = cleanName; }
                return card;
              }
            }
          }
        } catch (e) {}
      }

      return null;
    }

    // Get card by Scryfall ID
    async getCardById(id) {
      if (!id) return null;
      const cacheKey = `id_${id}`;

      if (window.DB) {
        const cached = await window.DB.getCache(cacheKey);
        if (cached) return cached;
      }

      const url = `${SCRYFALL_BASE}/cards/${id}`;
      try {
        const raw = await this.request(url);
        const card = this.normalizeCard(raw);
        if (window.DB && card) {
          await window.DB.setCache(cacheKey, card);
        }
        return card;
      } catch (err) {
        console.warn('Get card by ID failed:', id, err);
        return null;
      }
    }

    // Get card printings (all versions of this card)
    async getCardPrintings(oracleId) {
      if (!oracleId) return [];
      const cacheKey = `printings_${oracleId}`;

      if (window.DB) {
        const cached = await window.DB.getCache(cacheKey);
        if (cached) return cached;
      }

      const url = `${SCRYFALL_BASE}/cards/search?order=released&q=oracleid%3A${oracleId}&unique=prints`;
      try {
        const res = await this.request(url);
        const list = (res.data || []).map((c) => this.normalizeCard(c));
        if (window.DB) {
          await window.DB.setCache(cacheKey, list);
        }
        return list;
      } catch (e) {
        return [];
      }
    }

    // Batch query cards using /cards/collection
    // identifiers: Array<{ id?: string, name?: string, set?: string, collector_number?: string }>
    async getCollection(identifiers) {
      if (!identifiers || identifiers.length === 0) return [];
      const results = [];
      const batchSize = 75; // Scryfall limit per collection request

      for (let i = 0; i < identifiers.length; i += batchSize) {
        const chunk = identifiers.slice(i, i + batchSize);
        const url = `${SCRYFALL_BASE}/cards/collection`;
        try {
          const res = await this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: chunk })
          });
          if (res.data) {
            results.push(...res.data.map((c) => this.normalizeCard(c)));
          }
        } catch (e) {
          console.warn('Batch collection query failed for chunk', e);
        }
      }

      return results;
    }
  }

  window.Scryfall = new ScryfallClient();
})(window);

