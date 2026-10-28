/**
 * MTGCollectionSummary - deckbuilder.js
 * Deck creation, editing, versioning, hand simulator, deck comparison,
 * and collection shortage / multi-deck conflict analyzer.
 */

(function (window) {
  'use strict';

  class DeckBuilderManager {
    constructor() {
      this.decks = [];
      this.currentDeck = null;
      this.history = []; // For Undo / Redo
      this.historyIndex = -1;
      this.handState = {
        library: [],
        hand: [],
        mulliganCount: 0,
        turnCount: 1
      };
    }

    normalizeSection(section) {
      const s = (section || 'mainboard').toLowerCase().trim();
      if (s === 'main' || s === 'mainboard') return 'mainboard';
      if (s === 'side' || s === 'sideboard') return 'sideboard';
      if (s === 'maybe' || s === 'maybeboard') return 'maybeboard';
      if (s === 'commander' || s === 'commanders' || s === 'cmd') return 'commanders';
      if (s === 'companion' || s === 'companions') return 'companions';
      return 'mainboard';
    }

    migrateDeckSections(deck) {
      if (!deck) return;
      if (Array.isArray(deck.main) && deck.main.length > 0) {
        deck.mainboard = deck.mainboard || [];
        deck.mainboard.push(...deck.main);
        delete deck.main;
      }
      if (Array.isArray(deck.side) && deck.side.length > 0) {
        deck.sideboard = deck.sideboard || [];
        deck.sideboard.push(...deck.side);
        delete deck.side;
      }
      if (Array.isArray(deck.maybe) && deck.maybe.length > 0) {
        deck.maybeboard = deck.maybeboard || [];
        deck.maybeboard.push(...deck.maybe);
        delete deck.maybe;
      }
      if (Array.isArray(deck.commander) && deck.commander.length > 0) {
        deck.commanders = deck.commanders || [];
        deck.commanders.push(...deck.commander);
        delete deck.commander;
      }
      if (!Array.isArray(deck.commanders)) deck.commanders = [];
      if (!Array.isArray(deck.companions)) deck.companions = [];
      if (!Array.isArray(deck.mainboard)) deck.mainboard = [];
      if (!Array.isArray(deck.sideboard)) deck.sideboard = [];
      if (!Array.isArray(deck.maybeboard)) deck.maybeboard = [];
    }

    async load() {
      if (window.DB) {
        this.decks = await window.DB.getAll('decks');
        this.decks.forEach((d) => this.migrateDeckSections(d));
      }
      return this.decks;
    }

    // Create a new empty deck
    async createDeck(name = '新規デッキ', format = 'commander') {
      const newDeck = {
        id: Utils.generateId('deck'),
        name: name,
        format: format,
        bracket: 2,
        favorite: false,
        tags: [],
        memo: '',
        commanders: [],
        companions: [],
        mainboard: [],
        sideboard: [],
        maybeboard: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.decks.push(newDeck);
      if (window.DB) {
        await window.DB.put('decks', newDeck);
      }
      this.currentDeck = newDeck;
      this.saveHistoryState();
      return newDeck;
    }

    // Rename deck
    async renameDeck(deckId, newName) {
      const cleanName = (newName || '').trim();
      if (!cleanName) return null;

      const deck = this.decks.find((d) => d.id === deckId);
      if (!deck) return null;

      const oldName = deck.name;
      deck.name = cleanName;
      deck.updated_at = new Date().toISOString();

      if (this.currentDeck && this.currentDeck.id === deckId) {
        this.currentDeck.name = cleanName;
        this.currentDeck.updated_at = deck.updated_at;
      }

      if (window.DB) {
        await window.DB.put('decks', deck);
      }

      this.saveHistoryState();
      return { oldName, newName: cleanName };
    }

    // Set current active deck
    setCurrentDeck(deckOrId) {
      if (typeof deckOrId === 'string') {
        this.currentDeck = this.decks.find((d) => d.id === deckOrId) || null;
      } else {
        this.currentDeck = deckOrId;
      }
      if (this.currentDeck) {
        this.migrateDeckSections(this.currentDeck);
      }
      this.history = [];
      this.historyIndex = -1;
      this.saveHistoryState();
      return this.currentDeck;
    }

    // Update current deck
    async saveCurrentDeck() {
      if (!this.currentDeck) return;
      this.currentDeck.updated_at = new Date().toISOString();
      const idx = this.decks.findIndex((d) => d.id === this.currentDeck.id);
      if (idx !== -1) {
        this.decks[idx] = this.currentDeck;
      } else {
        this.decks.push(this.currentDeck);
      }
      if (window.DB) {
        await window.DB.put('decks', this.currentDeck);
      }
    }

    // Duplicate deck
    async duplicateDeck(deckId) {
      const src = this.decks.find((d) => d.id === deckId);
      if (!src) return null;

      const dup = Utils.clone(src);
      dup.id = Utils.generateId('deck');
      dup.name = `${src.name} のコピー`;
      dup.created_at = new Date().toISOString();
      dup.updated_at = new Date().toISOString();

      this.decks.push(dup);
      if (window.DB) {
        await window.DB.put('decks', dup);
      }
      return dup;
    }

    // Delete deck
    async deleteDeck(deckId) {
      this.decks = this.decks.filter((d) => d.id !== deckId);
      if (this.currentDeck && this.currentDeck.id === deckId) {
        this.currentDeck = null;
      }
      if (window.DB) {
        await window.DB.delete('decks', deckId);
      }
      return true;
    }

    // Card Manipulation in Current Deck
    addCard(cardData, section = 'mainboard', count = 1) {
      if (!this.currentDeck && this.decks.length > 0) {
        this.currentDeck = this.decks[0];
      }
      if (!this.currentDeck || !cardData) return;

      this.migrateDeckSections(this.currentDeck);
      const sec = this.normalizeSection(section);

      if (sec === 'commanders') {
        if (!this.currentDeck.commanders) this.currentDeck.commanders = [];
        const existing = this.currentDeck.commanders.find((c) => c.name === cardData.name);
        if (!existing) {
          this.currentDeck.commanders.push(cardData);
        }
      } else if (sec === 'companions') {
        if (!this.currentDeck.companions) this.currentDeck.companions = [];
        const existing = this.currentDeck.companions.find((c) => c.name === cardData.name);
        if (!existing) {
          this.currentDeck.companions.push(cardData);
        }
      } else {
        const board = this.currentDeck[sec] || (this.currentDeck[sec] = []);
        const existing = board.find((item) => item.card && item.card.name === cardData.name);
        if (existing) {
          existing.count = (existing.count || 1) + count;
        } else {
          board.push({
            card: cardData,
            count: count,
            categories: []
          });
        }
      }

      this.saveHistoryState();
      this.saveCurrentDeck();
    }

    updateCardCount(cardName, section, count) {
      if (!this.currentDeck) return;
      this.migrateDeckSections(this.currentDeck);
      const sec = this.normalizeSection(section);

      if (sec === 'commanders') {
        if (count <= 0) {
          this.currentDeck.commanders = (this.currentDeck.commanders || []).filter((c) => c.name !== cardName);
        }
      } else if (sec === 'companions') {
        if (count <= 0) {
          this.currentDeck.companions = (this.currentDeck.companions || []).filter((c) => c.name !== cardName);
        }
      } else {
        const board = this.currentDeck[sec];
        if (!board) return;
        const item = board.find((i) => i.card && i.card.name === cardName);
        if (item) {
          if (count <= 0) {
            this.currentDeck[sec] = board.filter((i) => i.card && i.card.name !== cardName);
          } else {
            item.count = count;
          }
        }
      }

      this.saveHistoryState();
      this.saveCurrentDeck();
    }

    moveCardSection(cardName, fromSection, toSection) {
      if (!this.currentDeck || fromSection === toSection) return;
      this.migrateDeckSections(this.currentDeck);

      const fromSec = this.normalizeSection(fromSection);
      const toSec = this.normalizeSection(toSection);
      if (fromSec === toSec) return;

      let cardData = null;
      let count = 1;
      let categories = [];

      // Extract from fromSec
      if (fromSec === 'commanders') {
        cardData = (this.currentDeck.commanders || []).find((c) => c.name === cardName);
        this.currentDeck.commanders = (this.currentDeck.commanders || []).filter((c) => c.name !== cardName);
      } else if (fromSec === 'companions') {
        cardData = (this.currentDeck.companions || []).find((c) => c.name === cardName);
        this.currentDeck.companions = (this.currentDeck.companions || []).filter((c) => c.name !== cardName);
      } else {
        const board = this.currentDeck[fromSec];
        if (board) {
          const item = board.find((i) => i.card && i.card.name === cardName);
          if (item) {
            cardData = item.card;
            count = item.count;
            categories = item.categories || [];
            this.currentDeck[fromSec] = board.filter((i) => i.card && i.card.name !== cardName);
          }
        }
      }

      if (!cardData) return;

      // Insert into toSec
      if (toSec === 'commanders') {
        if (!this.currentDeck.commanders) this.currentDeck.commanders = [];
        this.currentDeck.commanders.push(cardData);
      } else if (toSec === 'companions') {
        if (!this.currentDeck.companions) this.currentDeck.companions = [];
        this.currentDeck.companions.push(cardData);
      } else {
        const targetBoard = this.currentDeck[toSec] || (this.currentDeck[toSec] = []);
        const existing = targetBoard.find((i) => i.card && i.card.name === cardName);
        if (existing) {
          existing.count += count;
        } else {
          targetBoard.push({ card: cardData, count, categories });
        }
      }

      this.saveHistoryState();
      this.saveCurrentDeck();
    }

    setCardCategories(cardName, section, categories) {
      if (!this.currentDeck) return;
      this.migrateDeckSections(this.currentDeck);
      const sec = this.normalizeSection(section);
      const board = this.currentDeck[sec];
      if (!board) return;
      const item = board.find((i) => i.card && i.card.name === cardName);
      if (item) {
        item.categories = categories;
        this.saveCurrentDeck();
      }
    }

    // Undo / Redo
    saveHistoryState() {
      if (!this.currentDeck) return;
      const snapshot = JSON.stringify(this.currentDeck);
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(snapshot);
      if (this.history.length > 30) this.history.shift();
      this.historyIndex = this.history.length - 1;
    }

    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentDeck = JSON.parse(this.history[this.historyIndex]);
        this.saveCurrentDeck();
        return true;
      }
      return false;
    }

    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.currentDeck = JSON.parse(this.history[this.historyIndex]);
        this.saveCurrentDeck();
        return true;
      }
      return false;
    }

    // Version Snapshots
    async saveVersionSnapshot(deckId, note = '') {
      const deck = this.decks.find((d) => d.id === deckId) || this.currentDeck;
      if (!deck) return null;

      const versionRecord = {
        id: Utils.generateId('ver'),
        deck_id: deck.id,
        deck_name: deck.name,
        snapshot: Utils.clone(deck),
        note: note,
        created_at: new Date().toISOString()
      };

      if (window.DB) {
        await window.DB.put('deck_versions', versionRecord);
      }
      return versionRecord;
    }

    async getVersions(deckId) {
      if (window.DB) {
        const list = await window.DB.getByIndex('deck_versions', 'deck_id', deckId);
        return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      return [];
    }

    async restoreVersion(versionId) {
      if (window.DB) {
        const ver = await window.DB.get('deck_versions', versionId);
        if (ver && ver.snapshot) {
          const restored = Utils.clone(ver.snapshot);
          restored.updated_at = new Date().toISOString();
          await window.DB.put('decks', restored);
          const idx = this.decks.findIndex((d) => d.id === restored.id);
          if (idx !== -1) this.decks[idx] = restored;
          if (this.currentDeck && this.currentDeck.id === restored.id) {
            this.currentDeck = restored;
          }
          return restored;
        }
      }
      return null;
    }

    // Deck Diff Comparison (between version A and version B, or deck A and deck B)
    compareDecks(deckA, deckB) {
      const mapA = new Map();
      const mapB = new Map();

      const register = (map, card, count) => {
        if (!card) return;
        const name = card.name;
        map.set(name, {
          card: card,
          count: (map.get(name)?.count || 0) + count
        });
      };

      (deckA.commanders || []).forEach((c) => register(mapA, c, 1));
      (deckA.mainboard || []).forEach((i) => register(mapA, i.card, i.count || 1));
      (deckA.sideboard || []).forEach((i) => register(mapA, i.card, i.count || 1));

      (deckB.commanders || []).forEach((c) => register(mapB, c, 1));
      (deckB.mainboard || []).forEach((i) => register(mapB, i.card, i.count || 1));
      (deckB.sideboard || []).forEach((i) => register(mapB, i.card, i.count || 1));

      const common = [];
      const uniqueA = [];
      const uniqueB = [];
      const countDiffs = [];

      mapA.forEach((infoA, name) => {
        if (mapB.has(name)) {
          const infoB = mapB.get(name);
          common.push({ name, card: infoA.card, countA: infoA.count, countB: infoB.count });
          if (infoA.count !== infoB.count) {
            countDiffs.push({ name, card: infoA.card, diff: infoA.count - infoB.count });
          }
        } else {
          uniqueA.push({ name, card: infoA.card, count: infoA.count });
        }
      });

      mapB.forEach((infoB, name) => {
        if (!mapA.has(name)) {
          uniqueB.push({ name, card: infoB.card, count: infoB.count });
        }
      });

      // Stats comparison
      const statsA = Statistics.analyzeDeck(deckA);
      const statsB = Statistics.analyzeDeck(deckB);

      return {
        common,
        uniqueA,
        uniqueB,
        countDiffs,
        statsA,
        statsB,
        cmcDiff: parseFloat((statsA.avgCmc - statsB.avgCmc).toFixed(2)),
        landDiff: statsA.landCount - statsB.landCount,
        priceDiff: parseFloat((statsA.estimatedPriceUsd - statsB.estimatedPriceUsd).toFixed(2))
      };
    }

    // Match Deck with Collection
    matchWithCollection(deck, collectionItems, strict = false) {
      if (!deck || !collectionItems) return { ownedCount: 0, missingCount: 0, ownedRatio: 0, missingCards: [] };

      // Build collection inventory map
      const colInventory = new Map();
      collectionItems.forEach((col) => {
        const key = strict
          ? `${col.name}_${col.set}_${col.collector_number}_${col.foil}`
          : col.name;
        colInventory.set(key, (colInventory.get(key) || 0) + (col.count || 0));
      });

      let totalNeeded = 0;
      let totalOwned = 0;
      const missingCards = [];

      const checkCard = (card, count) => {
        if (!card) return;
        totalNeeded += count;
        const key = strict
          ? `${card.name}_${card.set}_${card.collector_number}_false`
          : card.name;
        const owned = colInventory.get(key) || 0;
        const matched = Math.min(count, owned);
        totalOwned += matched;

        // Deduct used inventory
        colInventory.set(key, Math.max(0, owned - count));

        if (matched < count) {
          missingCards.push({
            card: card,
            name: card.display_name || card.name,
            needed: count,
            owned: matched,
            shortage: count - matched,
            price_usd: card.prices?.usd || 0
          });
        }
      };

      (deck.commanders || []).forEach((c) => checkCard(c, 1));
      (deck.mainboard || []).forEach((item) => checkCard(item.card, item.count || 1));

      const ownedRatio = totalNeeded > 0 ? Math.round((totalOwned / totalNeeded) * 100) : 100;
      return {
        totalNeeded,
        ownedCount: totalOwned,
        missingCount: totalNeeded - totalOwned,
        ownedRatio,
        missingCards
      };
    }

    // Multi-Deck Shortage Analyzer (Analyzes card conflicts when building multiple decks simultaneously)
    analyzeMultiDeckShortages(deckIds, collectionItems) {
      const selectedDecks = this.decks.filter((d) => deckIds.includes(d.id));
      const requiredCounts = new Map(); // Card Name -> { card: Card, totalRequired: number, deckUsage: Array<{ deckName: string, count: number }> }

      selectedDecks.forEach((deck) => {
        const register = (card, count) => {
          if (!card) return;
          const name = card.name;
          const current = requiredCounts.get(name) || {
            card: card,
            totalRequired: 0,
            deckUsage: []
          };
          current.totalRequired += count;
          current.deckUsage.push({ deckName: deck.name, count });
          requiredCounts.set(name, current);
        };

        (deck.commanders || []).forEach((c) => register(c, 1));
        (deck.mainboard || []).forEach((item) => register(item.card, item.count || 1));
      });

      // Sum owned count in collection
      const ownedMap = new Map();
      collectionItems.forEach((col) => {
        const name = col.name;
        ownedMap.set(name, (ownedMap.get(name) || 0) + (col.count || 0));
      });

      const shortages = [];
      requiredCounts.forEach((info, name) => {
        // Skip basic lands
        if (DeckValidator.UNLIMITED_COPY_CARDS.has(name)) return;

        const owned = ownedMap.get(name) || 0;
        if (owned < info.totalRequired) {
          shortages.push({
            name: info.card.display_name || name,
            english_name: name,
            card: info.card,
            totalRequired: info.totalRequired,
            owned: owned,
            shortage: info.totalRequired - owned,
            deckUsage: info.deckUsage,
            price_usd: info.card.prices?.usd || 0
          });
        }
      });

      shortages.sort((a, b) => b.shortage - a.shortage);
      return shortages;
    }

    // Opening Hand Simulator
    initHandSimulator(deck) {
      if (!deck) return;

      // Build library from mainboard (excluding commanders)
      const library = [];
      (deck.mainboard || []).forEach((item) => {
        for (let i = 0; i < (item.count || 1); i++) {
          library.push(Utils.clone(item.card));
        }
      });

      // Shuffle using Fisher-Yates
      for (let i = library.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [library[i], library[j]] = [library[j], library[i]];
      }

      this.handState = {
        library: library,
        hand: [],
        mulliganCount: 0,
        turnCount: 1
      };

      // Draw initial 7 cards
      this.drawCards(7);
      return this.handState;
    }

    drawCards(n = 1) {
      for (let i = 0; i < n; i++) {
        if (this.handState.library.length > 0) {
          this.handState.hand.push(this.handState.library.shift());
        }
      }
      return this.handState;
    }

    mulligan(type = 'london') {
      if (!this.currentDeck) return;
      this.handState.mulliganCount++;
      // Return cards to library, shuffle, draw 7
      this.initHandSimulator(this.currentDeck);
      return this.handState;
    }
  }

  window.DeckBuilder = new DeckBuilderManager();
})(window);

