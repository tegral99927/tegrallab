// scryfall.js - Scryfall API integration with pre-bundled card metadata

import { CardCache } from "./cache.js";
import { CARD_METADATA } from "./cards-data.js";

// Pre-populate synchronously immediately on module load
if (CARD_METADATA) {
  CardCache.populateBulk(CARD_METADATA);
}

export async function initCardData() {
  // Already populated synchronously from CARD_METADATA
  return Promise.resolve();
}

export function getCardMetadata(cardName) {
  if (!cardName) return null;
  const cached = CardCache.get(cardName);
  if (cached) return cached;

  return {
    name: cardName,
    baseName: cardName,
    jaName: cardName,
    oracleId: null,
    manaCost: "",
    cmc: 0,
    typeLine: "Card",
    oracleText: "",
    colors: [],
    imageUri: "assets/card-back.png"
  };
}

export function fetchCardsCollection(cardNames) {
  const results = {};
  for (const name of cardNames) {
    results[name] = getCardMetadata(name);
  }
  return results;
}
