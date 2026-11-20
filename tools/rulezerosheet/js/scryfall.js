/**
 * scryfall.js - Scryfall API クライアント
 * レートリミット配慮、オートコンプリート、検索、両面カード対応、CollectionバッチAPI
 */

import { APP_CONFIG } from "./config.js";

// メモリ内キャッシュ
const cardCache = new Map();
let lastRequestTime = 0;

/**
 * Scryfallのガイドライン（リクエスト間隔 50-100ms）に従うためのレート制限待機
 */
async function rateLimitDelay() {
  const minInterval = 100;
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < minInterval) {
    await new Promise(res => setTimeout(res, minInterval - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * カード名オートコンプリート
 * @param {string} query
 * @param {AbortSignal} signal
 * @returns {Promise<string[]>}
 */
export async function autocompleteCardName(query, signal) {
  if (!query || query.trim().length < 2) return [];
  const cleanQ = query.trim();

  // キャッシュ確認
  const cacheKey = `ac_${cleanQ.toLowerCase()}`;
  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey);
  }

  await rateLimitDelay();

  try {
    const url = `${APP_CONFIG.scryfall.baseUrl}/cards/autocomplete?q=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];

    const data = await res.json();
    const suggestions = data.data || [];
    cardCache.set(cacheKey, suggestions);
    return suggestions;
  } catch (err) {
    if (err.name === "AbortError") return [];
    console.warn("Autocomplete error:", err);
    return [];
  }
}

/**
 * カード情報検索（完全一致 or あいまい検索）
 * 日本語名や英語名に対応
 * @param {string} name
 * @param {AbortSignal} signal
 * @returns {Promise<object|null>}
 */
export async function fetchCardByName(name, signal) {
  if (!name || !name.trim()) return null;
  const cleanName = name.trim();
  const cacheKey = `card_${cleanName.toLowerCase()}`;

  if (cardCache.has(cacheKey)) {
    return cardCache.get(cacheKey);
  }

  await rateLimitDelay();

  try {
    // 統率者検索を優先するため、まずは named?fuzzy を試行
    // 日本語の場合は search?q=lang:any で検索
    let card = null;
    const isJapanese = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf]/.test(cleanName);

    if (isJapanese) {
      // Scryfall search API with multilingual support
      const searchUrl = `${APP_CONFIG.scryfall.baseUrl}/cards/search?q=${encodeURIComponent(`!"${cleanName}" or (name:"${cleanName}" lang:ja)`)}&include_multilingual=true`;
      const res = await fetch(searchUrl, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          card = data.data[0];
        }
      }
    }

    if (!card) {
      const url = `${APP_CONFIG.scryfall.baseUrl}/cards/named?fuzzy=${encodeURIComponent(cleanName)}`;
      const res = await fetch(url, { signal });
      if (res.ok) {
        card = await res.json();
      }
    }

    if (!card) return null;

    const formatted = formatCardData(card);
    cardCache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    if (err.name === "AbortError") return null;
    console.warn("Fetch card error:", err);
    return null;
  }
}

/**
 * Scryfallカードオブジェクトから必要な情報を安全に抽出
 */
export function formatCardData(card) {
  let imageUrl = "";
  let printedName = card.printed_name || "";

  // 両面カード（Transform / Modal Double-Faced）対応
  if (card.card_faces && card.card_faces.length > 0) {
    const face0 = card.card_faces[0];
    if (face0.image_uris) {
      imageUrl = face0.image_uris.normal || face0.image_uris.large || face0.image_uris.png || "";
    }
    if (!printedName && face0.printed_name) {
      printedName = face0.printed_name;
    }
  }

  // 単面カードまたは全体画像
  if (!imageUrl && card.image_uris) {
    imageUrl = card.image_uris.normal || card.image_uris.large || card.image_uris.png || "";
  }

  return {
    id: card.id || "",
    name: card.name || "",
    printedName: printedName || card.name,
    imageUrl: imageUrl,
    manaCost: card.mana_cost || (card.card_faces ? card.card_faces[0].mana_cost : "") || "",
    typeLine: card.printed_type_line || card.type_line || "",
    colorIdentity: card.color_identity || [],
    scryfallUri: card.scryfall_uri || ""
  };
}

/**
 * デッキリスト一括取得 (Collection API: 最大75枚/リクエスト)
 * @param {string[]} cardNames
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchCollectionBatch(cardNames) {
  const result = new Map();
  if (!cardNames || cardNames.length === 0) return result;

  // 75枚ずつのチャンクに分割
  const chunkSize = 75;
  const chunks = [];
  for (let i = 0; i < cardNames.length; i += chunkSize) {
    chunks.push(cardNames.slice(i, i + chunkSize));
  }

  for (const chunk of chunks) {
    await rateLimitDelay();
    try {
      const identifiers = chunk.map(name => ({ name: name.trim() }));
      const res = await fetch(`${APP_CONFIG.scryfall.baseUrl}/cards/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers })
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data.data) {
        data.data.forEach(card => {
          const formatted = formatCardData(card);
          result.set(card.name.toLowerCase(), formatted);
          if (card.printed_name) {
            result.set(card.printed_name.toLowerCase(), formatted);
          }
        });
      }
    } catch (e) {
      console.warn("Collection batch error:", e);
    }
  }

  return result;
}
