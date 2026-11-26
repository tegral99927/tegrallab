// registry.js - Deck Registry (Provides curated, fully supported decks only)

import { MomaDeck } from "./moma.js";
import { LotusDeck } from "./lotus.js";

export class DeckRegistry {
  constructor() {
    this.decks = new Map();
    this.register(MomaDeck);
    this.register(LotusDeck);
  }

  register(deck) {
    if (deck && deck.id) {
      this.decks.set(deck.id, deck);
    }
  }

  get(id) {
    return this.decks.get(id) || null;
  }

  getAll() {
    return Array.from(this.decks.values());
  }
}

export const deckRegistry = new DeckRegistry();
