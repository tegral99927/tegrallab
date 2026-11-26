/**
 * Mulligan Lab - Deck List Parser
 * Parses MTG Arena, MTGO, text format, Japanese names, set/collector codes,
 * and partitions maindeck, sideboard, commander, and companion.
 */

const DeckParser = (() => {
  // Format rules definition
  const FORMAT_RULES = {
    standard: { minMain: 60, maxMain: null, maxCopies: 4, label: 'スタンダード' },
    pioneer: { minMain: 60, maxMain: null, maxCopies: 4, label: 'パイオニア' },
    modern: { minMain: 60, maxMain: null, maxCopies: 4, label: 'モダン' },
    legacy: { minMain: 60, maxMain: null, maxCopies: 4, label: 'レガシー' },
    vintage: { minMain: 60, maxMain: null, maxCopies: 4, label: 'ヴィンテージ' },
    pauper: { minMain: 60, maxMain: null, maxCopies: 4, label: 'パウパー' },
    commander: { minMain: 99, maxMain: 99, maxCopies: 1, label: '統率者戦 (EDH)' },
    brawl: { minMain: 59, maxMain: 99, maxCopies: 1, label: 'ブロール' },
    historic: { minMain: 60, maxMain: null, maxCopies: 4, label: 'ヒストリック' },
    timeless: { minMain: 60, maxMain: null, maxCopies: 4, label: 'タイムレス' },
    limited: { minMain: 40, maxMain: null, maxCopies: null, label: 'リミテッド' },
    custom: { minMain: 1, maxMain: null, maxCopies: null, label: 'カスタム' }
  };

  /**
   * Parses raw deck list text into structured sections.
   * @param {string} text - Raw input string
   * @returns {{
   *   mainboard: Array<{count: number, name: string, set?: string, collector_number?: string, rawLine: string}>,
   *   sideboard: Array<{count: number, name: string, set?: string, collector_number?: string, rawLine: string}>,
   *   commander: Array<{count: number, name: string, set?: string, collector_number?: string, rawLine: string}>,
   *   companion: Array<{count: number, name: string, set?: string, collector_number?: string, rawLine: string}>,
   *   unparsed: Array<{lineIndex: number, line: string, reason: string}>,
   *   totalMainCount: number,
   *   totalSideCount: number
   * }}
   */
  function parseDeckText(text) {
    if (!text || typeof text !== 'string') {
      return {
        mainboard: [],
        sideboard: [],
        commander: [],
        companion: [],
        unparsed: [],
        totalMainCount: 0,
        totalSideCount: 0
      };
    }

    const lines = text.split(/\r?\n/);
    let currentSection = 'mainboard';

    const rawSections = {
      mainboard: [],
      sideboard: [],
      commander: [],
      companion: []
    };
    const unparsed = [];

    // Section header matchers
    const sectionPatterns = [
      { name: 'commander', regex: /^(?:commander|統率者|comm)(?:\s*:)?\s*$/i },
      { name: 'companion', regex: /^(?:companion|相棒)(?:\s*:)?\s*$/i },
      { name: 'sideboard', regex: /^(?:sideboard|side|サイドボード|サイド)(?:\s*:)?\s*$/i },
      { name: 'mainboard', regex: /^(?:deck|main|mainboard|メインデッキ|メイン)(?:\s*:)?\s*$/i }
    ];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();

      // Skip blank lines
      if (!rawLine) continue;

      // Check for comments
      if (rawLine.startsWith('//') || rawLine.startsWith('#')) {
        const commentContent = rawLine.replace(/^[/#\s]+/, '').trim().toLowerCase();
        // Check if comment denotes a section switch
        if (commentContent.includes('sideboard') || commentContent === 'side') {
          currentSection = 'sideboard';
          continue;
        } else if (commentContent.includes('commander')) {
          currentSection = 'commander';
          continue;
        } else if (commentContent.includes('companion')) {
          currentSection = 'companion';
          continue;
        } else if (commentContent.includes('deck') || commentContent.includes('main')) {
          currentSection = 'mainboard';
          continue;
        }
        continue; // ignore normal comment
      }

      // Check section headers
      let isHeader = false;
      for (const sp of sectionPatterns) {
        if (sp.regex.test(rawLine)) {
          currentSection = sp.name;
          isHeader = true;
          break;
        }
      }
      if (isHeader) continue;

      // Check SB: prefix (common in MTGO / text exports)
      let targetSection = currentSection;
      let lineToParse = rawLine;
      if (/^SB:\s*/i.test(lineToParse)) {
        targetSection = 'sideboard';
        lineToParse = lineToParse.replace(/^SB:\s*/i, '').trim();
      }

      // Parse card line
      const cardEntry = parseCardLine(lineToParse, rawLine);
      if (cardEntry) {
        rawSections[targetSection].push(cardEntry);
      } else {
        unparsed.push({
          lineIndex: i,
          line: rawLine,
          reason: '枚数またはカード名の形式を認識できませんでした'
        });
      }
    }

    // Consolidate duplicates within each section
    const mainboard = consolidateList(rawSections.mainboard);
    const sideboard = consolidateList(rawSections.sideboard);
    const commander = consolidateList(rawSections.commander);
    const companion = consolidateList(rawSections.companion);

    const totalMainCount = mainboard.reduce((sum, c) => sum + c.count, 0);
    const totalSideCount = sideboard.reduce((sum, c) => sum + c.count, 0);

    return {
      mainboard,
      sideboard,
      commander,
      companion,
      unparsed,
      totalMainCount,
      totalSideCount
    };
  }

  /**
   * Parses individual line for count, name, set, collector number.
   * Examples:
   * "4 Consider (MID) 44"
   * "4x Consider [MID] 44"
   * "4 Consider"
   * "Consider x4"
   * "Consider 4"
   * "4 考慮 (MID) 44"
   * "4 考慮"
   */
  function parseCardLine(line, rawLine) {
    if (!line) return null;

    let count = 1;
    let cardName = '';
    let setCode = null;
    let collectorNumber = null;

    // Pattern 1: Leading count with optional 'x' or 'X': "4 Consider...", "4x Consider..."
    const leadingCountMatch = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);

    // Pattern 2: Trailing count: "Consider x4" or "Consider 4"
    const trailingCountMatch = !leadingCountMatch ? line.match(/^(.+?)\s+[xX]?(\d+)$/) : null;

    let rest = '';
    if (leadingCountMatch) {
      count = parseInt(leadingCountMatch[1], 10);
      rest = leadingCountMatch[2].trim();
    } else if (trailingCountMatch) {
      count = parseInt(trailingCountMatch[2], 10);
      rest = trailingCountMatch[1].trim();
    } else {
      // No explicit count found, default to 1 card
      rest = line.trim();
      count = 1;
    }

    if (!rest || count <= 0) return null;

    // Extract set and collector number: (SET) 123 or [SET] 123 or (SET:123)
    const setMatch = rest.match(/[\(\[]([A-Za-z0-9]{3,6})(?::|\s+)?([A-Za-z0-9\-\*★]+)?[\)\]](?:\s*([A-Za-z0-9\-\*★]+))?/);
    if (setMatch) {
      setCode = setMatch[1].toUpperCase();
      collectorNumber = setMatch[2] || setMatch[3] || null;
      // Remove set/collector part to get pure card name
      cardName = rest.replace(setMatch[0], '').replace(collectorNumber ? collectorNumber : '', '').trim();
    } else {
      cardName = rest.trim();
    }

    // Clean up extraneous trailing digits or marks if any
    cardName = cardName.replace(/\s+\*F\*$/i, '').trim(); // MTGO foil indicator

    if (!cardName) return null;

    return {
      count,
      name: cardName,
      set: setCode,
      collector_number: collectorNumber,
      rawLine
    };
  }

  /**
   * Aggregates identical cards in the same list.
   */
  function consolidateList(cardList) {
    const map = new Map();

    for (const item of cardList) {
      const key = (item.name + (item.set ? `__${item.set}` : '') + (item.collector_number ? `__${item.collector_number}` : '')).toLowerCase();
      if (map.has(key)) {
        const existing = map.get(key);
        existing.count += item.count;
      } else {
        map.set(key, { ...item });
      }
    }

    return Array.from(map.values());
  }

  /**
   * Validates deck against format constraints and returns non-blocking warnings.
   */
  function validateDeckFormat(mainCount, formatKey = 'modern') {
    const rule = FORMAT_RULES[formatKey] || FORMAT_RULES.modern;
    const warnings = [];

    if (rule.minMain && mainCount < rule.minMain) {
      warnings.push(`${rule.label} の規定枚数（${rule.minMain}枚）未満です（現在: ${mainCount}枚）。シミュレーションは可能ですが、実際の構築規則と異なります。`);
    } else if (rule.maxMain && mainCount > rule.maxMain) {
      warnings.push(`${rule.label} の上限枚数（${rule.maxMain}枚）を超えています（現在: ${mainCount}枚）。`);
    }

    return {
      isValid: warnings.length === 0,
      warnings,
      formatRule: rule
    };
  }

  /**
   * Generates standard text export for a deck.
   */
  function formatDeckToText(mainboard, sideboard = [], commander = []) {
    let output = '';

    if (commander && commander.length > 0) {
      output += 'Commander\n';
      commander.forEach(c => {
        output += `${c.count} ${c.name}${c.set ? ` (${c.set}) ${c.collector_number || ''}` : ''}\n`;
      });
      output += '\n';
    }

    output += 'Deck\n';
    mainboard.forEach(c => {
      output += `${c.count} ${c.name}${c.set ? ` (${c.set}) ${c.collector_number || ''}` : ''}\n`;
    });

    if (sideboard && sideboard.length > 0) {
      output += '\nSideboard\n';
      sideboard.forEach(c => {
        output += `${c.count} ${c.name}${c.set ? ` (${c.set}) ${c.collector_number || ''}` : ''}\n`;
      });
    }

    return output.trim();
  }

  return {
    parseDeckText,
    parseCardLine,
    validateDeckFormat,
    formatDeckToText,
    FORMAT_RULES
  };
})();
