/**
 * storage.js - localStorageによる複数デッキ管理 & JSONインポート/エクスポート
 */

import { APP_CONFIG } from "./config.js";

/**
 * 保存済み全デッキの取得
 * @returns {object[]}
 */
export function getSavedDecks() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKey);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn("Failed to read saved decks:", e);
    return [];
  }
}

/**
 * デッキの保存または更新
 * @param {object} deck
 * @returns {boolean}
 */
export function saveDeck(deck) {
  try {
    if (!deck || !deck.deckId) return false;

    // 画像URLやカード識別子のみを保存（巨大なBase64等は除去）
    const cleanDeck = {
      ...deck,
      schemaVersion: APP_CONFIG.schemaVersion,
      updatedAt: new Date().toISOString()
    };

    const list = getSavedDecks();
    const existingIndex = list.findIndex(d => d.deckId === cleanDeck.deckId);

    if (existingIndex >= 0) {
      list[existingIndex] = cleanDeck;
    } else {
      list.unshift(cleanDeck);
    }

    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(list));
    localStorage.setItem(APP_CONFIG.activeDeckKey, cleanDeck.deckId);
    return true;
  } catch (e) {
    console.error("Save deck failed:", e);
    return false;
  }
}

/**
 * デッキの削除
 * @param {string} deckId
 */
export function deleteDeck(deckId) {
  try {
    const list = getSavedDecks().filter(d => d.deckId !== deckId);
    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("Delete deck failed:", e);
    return false;
  }
}

/**
 * デッキの複製
 * @param {object} deck
 * @returns {object} 新しいデッキ
 */
export function duplicateDeck(deck) {
  const newDeck = {
    ...deck,
    deckId: "deck_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    deckName: `${deck.deckName || "Deck"} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  saveDeck(newDeck);
  return newDeck;
}

/**
 * デッキデータをJSONファイルとしてダウンロード
 * @param {object} deck
 */
export function exportDeckToJson(deck) {
  const cleanDeck = {
    ...deck,
    schemaVersion: APP_CONFIG.schemaVersion,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(cleanDeck, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `${(deck.deckName || "rule0_deck").replace(/[/\\?%*:|"<>]/g, "_")}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * JSON文字列をパースしてバリデーション
 * @param {string} jsonString
 * @returns {{ success: boolean, deck?: object, error?: string }}
 */
export function validateAndParseDeckJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object") {
      return { success: false, error: "Invalid JSON format" };
    }

    // 必須項目の確認と安全なデフォルト値への補正
    const validated = {
      schemaVersion: parsed.schemaVersion || 1,
      deckId: "deck_" + Date.now().toString(36),
      deckName: typeof parsed.deckName === "string" ? parsed.deckName.slice(0, 100) : "Imported Deck",
      commanders: Array.isArray(parsed.commanders) ? parsed.commanders.slice(0, 2) : [],
      bracket: (parsed.bracket >= 1 && parsed.bracket <= 5) ? parsed.bracket : 2,
      gameChangerCount: typeof parsed.gameChangerCount === "number" ? Math.max(0, parsed.gameChangerCount) : 0,
      gameChangerCountSource: parsed.gameChangerCountSource || "manual",
      gameChangerCards: Array.isArray(parsed.gameChangerCards) ? parsed.gameChangerCards : [],
      commanderDescription: typeof parsed.commanderDescription === "string" ? parsed.commanderDescription.slice(0, 300) : "",
      deckFeatures: Array.isArray(parsed.deckFeatures) ? parsed.deckFeatures : [],
      winConditions: typeof parsed.winConditions === "string" ? parsed.winConditions.slice(0, 300) : "",
      comboDescription: typeof parsed.comboDescription === "string" ? parsed.comboDescription.slice(0, 300) : "",
      interactionFeatures: Array.isArray(parsed.interactionFeatures) ? parsed.interactionFeatures : [],
      playPreferences: Array.isArray(parsed.playPreferences) ? parsed.playPreferences : [],
      avoidPreferences: Array.isArray(parsed.avoidPreferences) ? parsed.avoidPreferences : [],
      proxyStatus: typeof parsed.proxyStatus === "string" ? parsed.proxyStatus : "none",
      approxWinTurn: typeof parsed.approxWinTurn === "string" ? parsed.approxWinTurn : "",
      additionalNotes: typeof parsed.additionalNotes === "string" ? parsed.additionalNotes.slice(0, 500) : "",
      sheetType: parsed.sheetType === "detailed" ? "detailed" : "quick",
      sheetTheme: parsed.sheetTheme === "light" ? "light" : "dark",
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return { success: true, deck: validated };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
