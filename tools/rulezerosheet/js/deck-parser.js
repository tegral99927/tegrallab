/**
 * deck-parser.js - デッキリストのパースとゲームチェンジャー集計
 */

import { detectGameChangers, findGameChanger } from "./game-changers.js";

/**
 * デッキリストテキストを行ごとに解析
 * @param {string} text
 * @returns {{ cards: { count: number, name: string, isCommander: boolean }[], totalCount: number, commanderNames: string[] }}
 */
export function parseDecklistText(text) {
  if (!text) {
    return { cards: [], totalCount: 0, commanderNames: [] };
  }

  const lines = text.split(/\r?\n/);
  const cards = [];
  const commanderNames = [];
  let currentSection = "deck"; // "commander", "deck", "sideboard"

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    // セクションヘッダー検出 (例: // Commander, [Commander], COMMANDER, etc.)
    const sectionMatch = line.match(/^(\/\/|#|\[)?\s*(commander|commanders|deck|main|maindeck|sideboard|maybeboard)\s*(\]|:)?$/i);
    if (sectionMatch) {
      const secName = sectionMatch[2].toLowerCase();
      if (secName.includes("commander")) {
        currentSection = "commander";
      } else if (secName.includes("sideboard") || secName.includes("maybeboard")) {
        currentSection = "sideboard";
      } else {
        currentSection = "deck";
      }
      continue;
    }

    // コメント行スキップ
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // 枚数とカード名の抽出
    // パターン1: "1x Sol Ring (C19) 221 *F*"
    // パターン2: "1 Sol Ring"
    // パターン3: "Sol Ring"
    let count = 1;
    let cardName = line;

    const countMatch = line.match(/^(\d+)[xX]?\s+(.+)$/);
    if (countMatch) {
      count = parseInt(countMatch[1], 10);
      cardName = countMatch[2];
    }

    // セット略称・コレクター番号・Foil表記・言語表記のクリーンアップ (例: " (MH2) 123 *F*", " [NEO:123]")
    cardName = cardName
      .replace(/\s*\([^)]*\)\s*\d*(\s*\*F\*)?$/i, "")
      .replace(/\s*\[[^\]]*\]\s*\d*(\s*\*F\*)?$/i, "")
      .replace(/\s*\*F\*\s*$/i, "")
      .replace(/\s*#\d+\s*$/, "")
      .trim();

    if (!cardName) continue;

    const isCmd = (currentSection === "commander");
    if (isCmd && !commanderNames.includes(cardName)) {
      commanderNames.push(cardName);
    }

    cards.push({
      count,
      name: cardName,
      isCommander: isCmd
    });
  }

  const totalCount = cards.reduce((sum, c) => sum + c.count, 0);

  return { cards, totalCount, commanderNames };
}

/**
 * デッキリストからGame Changersの集計を行う
 * @param {string} text
 * @returns {{ totalCards: number, gameChangers: object[], gcCount: number, commanderNames: string[] }}
 */
export function analyzeDecklist(text) {
  const parsed = parseDecklistText(text);
  const cardNames = parsed.cards.map(c => c.name);
  const detected = detectGameChangers(cardNames);

  return {
    totalCards: parsed.totalCount,
    gameChangers: detected.cards,
    gcCount: detected.count,
    commanderNames: parsed.commanderNames
  };
}
