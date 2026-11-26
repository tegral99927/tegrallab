/**
 * Mulligan Lab - Scryfall API Integration
 * Complies with Scryfall rate limits, batch collection API, dual-faced cards,
 * Japanese language fallback, and local IndexedDB caching.
 */

const Scryfall = (() => {
  const API_BASE = 'https://api.scryfall.com';
  const REQUEST_DELAY_MS = 100; // 100ms between requests per Scryfall guidelines
  const COLLECTION_CHUNK_SIZE = 75; // Max cards per /cards/collection request
  const FALLBACK_CARD_BACK = 'assets/images/card-back.svg';

  let requestQueue = [];
  let isProcessingQueue = false;
  let isRateLimited = false;

  // Enqueue a fetch request with rate limit delay
  function enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ fn, resolve, reject });
      processQueue();
    });
  }

  async function processQueue() {
    if (isProcessingQueue || requestQueue.length === 0) return;
    if (isRateLimited) return;

    isProcessingQueue = true;
    const { fn, resolve, reject } = requestQueue.shift();

    try {
      const result = await fn();
      resolve(result);
    } catch (err) {
      if (err.status === 429) {
        console.warn('Scryfall 429 Rate Limited. Pausing queue for 2 seconds...');
        isRateLimited = true;
        // Re-insert failed request to front of queue
        requestQueue.unshift({ fn, resolve, reject });
        setTimeout(() => {
          isRateLimited = false;
          isProcessingQueue = false;
          processQueue();
        }, 2000);
        return;
      }
      reject(err);
    }

    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, REQUEST_DELAY_MS);
  }

  // Raw HTTP request wrapper
  async function scryfallFetch(url, options = {}) {
    const headers = {
      'Accept': 'application/json;q=0.9,*/*;q=0.8',
      ...(options.headers || {})
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const err = new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
      err.status = response.status;
      try {
        err.details = await response.json();
      } catch {}
      throw err;
    }
    return await response.json();
  }

  /**
   * Normalizes raw Scryfall Card object into our standardized application model.
   * Handles DFCs, adventures, split cards, image fallbacks.
   */
  function normalizeCardData(card) {
    if (!card) return null;

    let faces = [];
    let primaryImage = FALLBACK_CARD_BACK;
    let secondaryImage = null;

    if (card.card_faces && card.card_faces.length > 0) {
      faces = card.card_faces.map((f, idx) => {
        let fImg = FALLBACK_CARD_BACK;
        if (f.image_uris) {
          fImg = f.image_uris.normal || f.image_uris.large || f.image_uris.border_crop || f.image_uris.small;
        } else if (card.image_uris) {
          fImg = card.image_uris.normal || card.image_uris.large || card.image_uris.border_crop;
        }
        return {
          name: f.name || card.name,
          printed_name: f.printed_name || null,
          mana_cost: f.mana_cost || '',
          type_line: f.type_line || '',
          oracle_text: f.oracle_text || '',
          colors: f.colors || [],
          image_uri: fImg
        };
      });

      primaryImage = faces[0].image_uri;
      if (faces.length > 1) {
        secondaryImage = faces[1].image_uri;
      }
    } else if (card.image_uris) {
      primaryImage = card.image_uris.normal || card.image_uris.large || card.image_uris.border_crop || card.image_uris.small;
    }

    // Japanese printed name or default name
    const jaName = card.printed_name || (faces[0] && faces[0].printed_name) || null;

    // Japanese & English image URL resolution
    const isJaCard = card.lang === 'ja';
    let imageUriEn = null;
    let imageUriJa = null;

    if (isJaCard) {
      imageUriJa = primaryImage;
      imageUriEn = (card.set && card.collector_number)
        ? `https://api.scryfall.com/cards/${card.set.toLowerCase()}/${encodeURIComponent(card.collector_number)}?format=image`
        : primaryImage;
    } else {
      imageUriEn = primaryImage;
      imageUriJa = (card.set && card.collector_number)
        ? `https://api.scryfall.com/cards/${card.set.toLowerCase()}/${encodeURIComponent(card.collector_number)}/ja?format=image`
        : null;
    }

    // Detect Land & Mana sources
    const typeLine = card.type_line || (faces[0] && faces[0].type_line) || '';
    const isLand = typeLine.toLowerCase().includes('land');
    const oracleText = card.oracle_text || faces.map(f => f.oracle_text).join('\n') || '';

    // Detect basic colors produced or cards colors
    const colors = card.colors || (faces[0] ? faces[0].colors : []) || [];
    const colorIdentity = card.color_identity || [];

    // Mana sources detection (W, U, B, R, G, C)
    const produces = card.produced_mana || [];
    const manaSources = new Set(produces);
    if (isLand) {
      if (typeLine.includes('Plains') || oracleText.includes('{W}')) manaSources.add('W');
      if (typeLine.includes('Island') || oracleText.includes('{U}')) manaSources.add('U');
      if (typeLine.includes('Swamp') || oracleText.includes('{B}')) manaSources.add('B');
      if (typeLine.includes('Mountain') || oracleText.includes('{R}')) manaSources.add('R');
      if (typeLine.includes('Forest') || oracleText.includes('{G}')) manaSources.add('G');
      if (typeLine.includes('Wastes') || oracleText.includes('{C}')) manaSources.add('C');
      if (oracleText.includes('any color') || oracleText.includes('mana of any type')) {
        ['W', 'U', 'B', 'R', 'G'].forEach(c => manaSources.add(c));
      }
    }

    return {
      id: card.id,
      oracle_id: card.oracle_id,
      name: card.name,
      printed_name: jaName,
      lang: card.lang,
      mana_cost: card.mana_cost || (faces[0] ? faces[0].mana_cost : ''),
      cmc: card.cmc || 0,
      type_line: typeLine,
      isLand: isLand,
      oracle_text: oracleText,
      colors: colors,
      color_identity: colorIdentity,
      mana_sources: Array.from(manaSources),
      set: card.set ? card.set.toUpperCase() : '',
      collector_number: card.collector_number || '',
      rarity: card.rarity || 'common',
      image_uri: (Storage.getSettings().cardLanguage === 'en' ? imageUriEn : (imageUriJa || imageUriEn)),
      image_uri_ja: imageUriJa,
      image_uri_en: imageUriEn,
      secondary_image_uri: secondaryImage,
      faces: faces,
      legalities: card.legalities || {},
      is_dfc: faces.length > 1
    };
  }

  /**
   * Fetches multiple cards in bulk using /cards/collection.
   * Checks cache first; only unknown cards are requested from Scryfall.
   * @param {Array<{name: string, set?: string, collector_number?: string}>} cardQueries
   * @param {Function} onProgress (optional callback for progress)
   */
  async function fetchCardsBatch(cardQueries, onProgress) {
    const results = new Map();
    const uncachedQueries = [];

    // 1. Check local IndexedDB cache
    for (const q of cardQueries) {
      const cacheKey = q.set && q.collector_number
        ? `${q.set.toLowerCase()}:${q.collector_number.toLowerCase()}`
        : q.name.toLowerCase().trim();

      const cached = await Storage.getCachedCard(cacheKey);
      if (cached) {
        results.set(q.name.toLowerCase().trim(), cached);
        if (q.set && q.collector_number) {
          results.set(`${q.set.toLowerCase()}:${q.collector_number.toLowerCase()}`, cached);
        }
      } else {
        uncachedQueries.push(q);
      }
    }

    if (onProgress) {
      onProgress({
        cached: results.size,
        total: cardQueries.length,
        fetching: uncachedQueries.length
      });
    }

    if (uncachedQueries.length === 0) {
      return results;
    }

    // 2. Partition uncached queries into chunks of COLLECTION_CHUNK_SIZE
    const chunks = [];
    for (let i = 0; i < uncachedQueries.length; i += COLLECTION_CHUNK_SIZE) {
      chunks.push(uncachedQueries.slice(i, i + COLLECTION_CHUNK_SIZE));
    }

    let completedChunks = 0;

    for (const chunk of chunks) {
      const identifiers = chunk.map(q => {
        if (q.set && q.collector_number) {
          return { set: q.set.toLowerCase(), collector_number: q.collector_number.toString() };
        }
        return { name: q.name };
      });

      try {
        const responseData = await enqueueRequest(() =>
          scryfallFetch(`${API_BASE}/cards/collection`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers })
          })
        );

        if (responseData && responseData.data) {
          for (const rawCard of responseData.data) {
            const normalized = normalizeCardData(rawCard);
            if (!normalized) continue;

            const nameKey = normalized.name.toLowerCase().trim();
            const setKey = `${normalized.set.toLowerCase()}:${normalized.collector_number.toLowerCase()}`;

            results.set(nameKey, normalized);
            results.set(setKey, normalized);

            // Cache in IndexedDB
            await Storage.cacheCard(nameKey, normalized);
            await Storage.cacheCard(setKey, normalized);
            if (normalized.printed_name) {
              const jaKey = normalized.printed_name.toLowerCase().trim();
              results.set(jaKey, normalized);
              await Storage.cacheCard(jaKey, normalized);
            }
          }
        }

        // Handle cards that collection failed to find (not_found)
        if (responseData && responseData.not_found && responseData.not_found.length > 0) {
          for (const nf of responseData.not_found) {
            const queryName = nf.name || (chunk.find(c => c.set === nf.set && c.collector_number === nf.collector_number)?.name);
            if (queryName) {
              // Try fallback individual search for Japanese or partial names
              try {
                const singleCard = await fetchSingleCardFallback(queryName);
                if (singleCard) {
                  const norm = normalizeCardData(singleCard);
                  const nameKey = queryName.toLowerCase().trim();
                  results.set(nameKey, norm);
                  results.set(norm.name.toLowerCase().trim(), norm);
                  await Storage.cacheCard(nameKey, norm);
                  await Storage.cacheCard(norm.name.toLowerCase().trim(), norm);
                }
              } catch (e) {
                console.warn(`Card not found on Scryfall fallback: ${queryName}`, e);
              }
            }
          }
        }
      } catch (err) {
        console.error('Scryfall batch collection failed for chunk:', err);
      }

      completedChunks++;
      if (onProgress) {
        onProgress({
          cached: results.size,
          total: cardQueries.length,
          fetching: Math.max(0, uncachedQueries.length - completedChunks * COLLECTION_CHUNK_SIZE)
        });
      }
    }

    return results;
  }

  /**
   * Fallback search for a single card by exact or fuzzy name, including Japanese names.
   */
  async function fetchSingleCardFallback(queryName) {
    const trimmed = queryName.trim();
    // 1. Try named fuzzy
    try {
      return await enqueueRequest(() =>
        scryfallFetch(`${API_BASE}/cards/named?fuzzy=${encodeURIComponent(trimmed)}`)
      );
    } catch {}

    // 2. Try search by query (handles Japanese name search: lang:ja or "!カード名")
    try {
      const searchRes = await enqueueRequest(() =>
        scryfallFetch(`${API_BASE}/cards/search?q=${encodeURIComponent('!"' + trimmed + '" or (lang:ja "' + trimmed + '")')}`)
      );
      if (searchRes && searchRes.data && searchRes.data.length > 0) {
        return searchRes.data[0];
      }
    } catch {}

    return null;
  }

  return {
    fetchCardsBatch,
    fetchSingleCardFallback,
    normalizeCardData,
    FALLBACK_CARD_BACK
  };
})();
