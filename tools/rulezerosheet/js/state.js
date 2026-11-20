/**
 * state.js - アプリの状態管理 (Reactive State Store)
 */

import { APP_CONFIG } from "./config.js";

function createDefaultDeck() {
  return {
    schemaVersion: APP_CONFIG.schemaVersion,
    deckId: "deck_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    deckName: "",
    commanders: [
      {
        id: "",
        name: "",
        printedName: "",
        imageUrl: "",
        manaCost: "",
        typeLine: "",
        colorIdentity: []
      }
    ],
    bracket: 2,
    gameChangerCount: 0,
    gameChangerCountSource: "manual", // 'manual' | 'automatic' | 'overridden'
    gameChangerCards: [],
    commanderDescription: "",
    deckFeatures: ["戦闘ダメージ中心"],
    winConditions: "",
    comboDescription: "",
    interactionFeatures: [],
    playPreferences: ["ゆっくり遊びたい", "勝敗より交流重視"],
    avoidPreferences: ["大量土地破壊は避けたい", "長時間のロックは避けたい"],
    proxyStatus: "none",
    approxWinTurn: "8+ turns",
    additionalNotes: "",
    sheetType: "quick",   // 'quick' | 'detailed'
    sheetTheme: "dark",   // 'dark' | 'light'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

class AppState {
  constructor() {
    this.currentMode = "simple"; // 'simple' | 'detailed'
    this.currentLang = "ja";     // 'ja' | 'en'
    this.uiTheme = "dark";       // 'dark' | 'light'
    this.activeDeck = createDefaultDeck();
    this.savedDecks = [];
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, payload) {
    this.listeners.forEach(fn => {
      try {
        fn(event, payload, this);
      } catch (e) {
        console.error("State listener error:", e);
      }
    });
  }

  setMode(mode) {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.notify("mode_change", mode);
    }
  }

  setLang(lang) {
    if (this.currentLang !== lang) {
      this.currentLang = lang;
      this.notify("lang_change", lang);
    }
  }

  setUiTheme(theme) {
    if (this.uiTheme !== theme) {
      this.uiTheme = theme;
      this.notify("ui_theme_change", theme);
    }
  }

  updateDeck(partial, silent = false) {
    this.activeDeck = {
      ...this.activeDeck,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    if (!silent) {
      this.notify("deck_update", this.activeDeck);
    }
  }

  setCommander(index, commanderData) {
    const list = [...this.activeDeck.commanders];
    list[index] = { ...commanderData };
    this.updateDeck({ commanders: list });
  }

  addCommander(commanderData = { id: "", name: "", printedName: "", imageUrl: "", manaCost: "", typeLine: "", colorIdentity: [] }) {
    if (this.activeDeck.commanders.length < 2) {
      const list = [...this.activeDeck.commanders, commanderData];
      this.updateDeck({ commanders: list });
    }
  }

  removeCommander(index) {
    if (this.activeDeck.commanders.length > 1) {
      const list = this.activeDeck.commanders.filter((_, i) => i !== index);
      this.updateDeck({ commanders: list });
    }
  }

  resetDeck() {
    this.activeDeck = createDefaultDeck();
    this.notify("deck_reset", this.activeDeck);
  }

  loadDeck(deckData) {
    // スキーマ互換性チェックとフォールバック
    const defaultDeck = createDefaultDeck();
    this.activeDeck = {
      ...defaultDeck,
      ...deckData,
      commanders: Array.isArray(deckData.commanders) && deckData.commanders.length > 0
        ? deckData.commanders
        : defaultDeck.commanders,
      deckFeatures: Array.isArray(deckData.deckFeatures) ? deckData.deckFeatures : defaultDeck.deckFeatures,
      playPreferences: Array.isArray(deckData.playPreferences) ? deckData.playPreferences : defaultDeck.playPreferences,
      avoidPreferences: Array.isArray(deckData.avoidPreferences) ? deckData.avoidPreferences : defaultDeck.avoidPreferences,
      updatedAt: new Date().toISOString()
    };
    this.notify("deck_loaded", this.activeDeck);
  }
}

export const state = new AppState();
