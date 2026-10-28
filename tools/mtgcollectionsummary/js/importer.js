/**
 * MTGCollectionSummary - importer.js
 * Multi-format deck list parser (Arena JP/EN, Hareruya, MTGO, Moxfield, Archidekt, CSV, JSON)
 * with robust section detection, comment ignoring, Scryfall batch collection matching,
 * and interactive preview verification.
 */

(function (window) {
  'use strict';

  const Importer = {};

  // Detect import format
  Importer.detectFormat = function (text) {
    if (!text || typeof text !== 'string') return 'unknown';
    const trimmed = text.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (e) {}
    }

    if (
      trimmed.includes('Commander\n') ||
      trimmed.includes('統率者\n') ||
      trimmed.includes('Deck\n') ||
      trimmed.includes('デッキ\n')
    ) {
      return 'arena';
    }

    const firstLine = trimmed.split('\n')[0].toLowerCase();
    if (firstLine.includes(',') && (firstLine.includes('name') || firstLine.includes('count') || firstLine.includes('card'))) {
      return 'csv';
    }

    if (trimmed.includes('SB:') || trimmed.includes('// Commander') || trimmed.includes('// Sideboard')) {
      return 'mtgo';
    }

    return 'text';
  };

  // Normalize fullwidth characters, spaces, and brackets
  Importer.normalizeInputText = function (text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\u3000]/g, ' ') // fullwidth spaces to space
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)) // fullwidth ASCII/digits to halfwidth
      .replace(/[’‘`]/g, "'") // normalize quotes
      .replace(/[“”]/g, '"')
      .replace(/[【〔［]/g, '[')
      .replace(/[】〕］]/g, ']')
      .replace(/[（]/g, '(')
      .replace(/[）]/g, ')');
  };

  /**
   * Parse deck text into structured entries:
   * [{ section: 'main'|'commander'|'sideboard'|'maybeboard'|'companion', count: number, name: string, set: string, number: string, raw: string }]
   */
  Importer.parseText = function (rawText) {
    const normalizedText = Importer.normalizeInputText(rawText);
    const lines = normalizedText.split(/\r?\n/);
    const parsedEntries = [];
    let currentSection = 'main';

    const sectionMap = {
      'commander': 'commander',
      'commanders': 'commander',
      '統率者': 'commander',
      'deck': 'main',
      'デッキ': 'main',
      'main': 'main',
      'mainboard': 'main',
      'メインボード': 'main',
      'sideboard': 'sideboard',
      'side': 'sideboard',
      'サイドボード': 'sideboard',
      'サイド': 'sideboard',
      'companion': 'companion',
      '相棒': 'companion',
      'maybeboard': 'maybeboard',
      'maybe': 'maybeboard',
      'considering': 'maybeboard',
      'メイボード': 'maybeboard'
    };

    // Category / group headers that should NOT be treated as cards
    const ignoredCategoryHeaders = new Set([
      'creature', 'creatures', 'クリーチャー',
      'instant', 'instants', 'インスタント',
      'sorcery', 'sorceries', 'ソーサリー',
      'artifact', 'artifacts', 'アーティファクト',
      'enchantment', 'enchantments', 'エンチャント',
      'planeswalker', 'planeswalkers', 'プレインズウォーカー',
      'land', 'lands', '土地',
      'battle', 'battles', 'バトル',
      'spell', 'spells', '呪文',
      'other', 'others', 'その他',
      'draw', 'ramp', 'removal', 'wipes', 'tutors',
      'token', 'tokens', 'トークン',
      'flex', 'flex slots', 'cuts', 'cut'
    ]);

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line) continue;

      // Clean line for section check (strip leading //, #, [, ])
      const cleanHeader = line
        .replace(/^[/#\[\]\s*]+|[/#\[\]\s*]+$/g, '')
        .replace(/\s*\(\d+\)$/, '') // remove trailing count like "Creatures (20)"
        .trim()
        .toLowerCase();

      // 1. Check if line is a recognized section header
      if (sectionMap[cleanHeader]) {
        currentSection = sectionMap[cleanHeader];
        continue;
      }

      // 2. Check if line is a category header (e.g. "// Lands (36)", "Creatures (25)")
      if (ignoredCategoryHeaders.has(cleanHeader)) {
        if (currentSection === 'commander' || currentSection === 'companion') {
          currentSection = 'main';
        }
        continue;
      }

      // 3. Skip pure comments or metadata lines
      if (/^(\/\/|#|\/\*)/.test(line)) {
        continue;
      }
      if (/^(about|name|format|export|exported from|decklist)\b/i.test(line)) {
        continue;
      }

      // Check inline section marker like "SB: 2 Duress" or "Sideboard: 2 Duress"
      let lineSection = currentSection;
      if (/^(sb|sideboard):\s*/i.test(line)) {
        lineSection = 'sideboard';
        line = line.replace(/^(sb|sideboard):\s*/i, '');
      }

      // Strip common trailing metadata/foil flags: *F*, *FOIL*, (Foil), [Foil], ★
      line = line.replace(/\s*(\*F\*|\*FOIL\*|\*E\*|\(Foil\)|\[Foil\]|Foil|★)\s*$/i, '').trim();

      let count = 1;
      let cardName = '';
      let set = '';
      let collectorNumber = '';

      // Pattern 1: Japanese bracketed: "1《太陽の指輪》" or "1 <太陽の指輪>"
      const bracketMatch = /^(\d+)[xX枚\s]*[《<](.+?)[》>]/.exec(line);
      if (bracketMatch) {
        count = parseInt(bracketMatch[1], 10) || 1;
        cardName = bracketMatch[2].trim();
      } else {
        // Extract leading count: "1 Sol Ring...", "4x Llanowar...", "4枚 ラノワール..."
        const leadingCountMatch = /^(\d+)[xX枚\s]+(.+)$/.exec(line);
        let restOfLine = line;
        if (leadingCountMatch) {
          count = parseInt(leadingCountMatch[1], 10) || 1;
          restOfLine = leadingCountMatch[2].trim();
        }

        // Pattern 2: (SET) NUM or (SET)
        const m1 = /\(([A-Za-z0-9_]{3,6})\)(?:\s+([A-Za-z0-9_★*-]+))?\s*$/.exec(restOfLine);
        // Pattern 3: [SET:NUM]
        const m2 = /\[([A-Za-z0-9_]{3,6})[:\/]([A-Za-z0-9_★*-]+)\]\s*$/.exec(restOfLine);
        // Pattern 4: [SET] NUM or [SET]
        const m3 = /\[([A-Za-z0-9_]{3,6})\](?:\s+([A-Za-z0-9_★*-]+))?\s*$/.exec(restOfLine);

        if (m1) {
          set = m1[1].toUpperCase();
          collectorNumber = m1[2] ? m1[2].trim() : '';
          cardName = restOfLine.substring(0, m1.index).trim();
        } else if (m2) {
          set = m2[1].toUpperCase();
          collectorNumber = m2[2].trim();
          cardName = restOfLine.substring(0, m2.index).trim();
        } else if (m3) {
          set = m3[1].toUpperCase();
          collectorNumber = m3[2] ? m3[2].trim() : '';
          cardName = restOfLine.substring(0, m3.index).trim();
        } else {
          cardName = restOfLine.trim();
        }
      }

      // Clean up card name from lingering brackets or quotes
      cardName = cardName.replace(/^[《<"']+|[》>"']+$/g, '').trim();

      // If after cleanup the card name is empty or looks like a header, skip
      if (!cardName || ignoredCategoryHeaders.has(cardName.toLowerCase())) {
        continue;
      }

      parsedEntries.push({
        section: lineSection,
        count: count,
        name: cardName,
        set: set,
        number: collectorNumber,
        raw: lines[i]
      });
    }

    return parsedEntries;
  };

  /**
   * Parse CSV format
   */
  Importer.parseCSVDeck = function (csvText) {
    const { header, rows } = Utils.parseCSV(csvText);
    const entries = [];

    // Identify column mappings
    const findCol = (candidates) => {
      return header.find((h) => candidates.includes(h.toLowerCase()));
    };

    const nameCol = findCol(['name', 'card name', 'カード名', 'card']);
    const countCol = findCol(['count', 'qty', 'quantity', '枚数']);
    const setCol = findCol(['set', 'set code', 'edition', 'セット']);
    const numCol = findCol(['number', 'collector number', 'cn', 'コレクター番号']);
    const secCol = findCol(['section', 'board', 'セクション']);

    rows.forEach((r) => {
      const name = nameCol ? r[nameCol] : r[header[0]];
      if (!name) return;
      const count = countCol ? parseInt(r[countCol], 10) || 1 : 1;
      const set = setCol ? r[setCol] : '';
      const number = numCol ? r[numCol] : '';
      let section = 'main';
      if (secCol && r[secCol]) {
        const s = r[secCol].toLowerCase();
        if (s.includes('cmd') || s.includes('統率者')) section = 'commander';
        else if (s.includes('side') || s.includes('サイド')) section = 'sideboard';
        else if (s.includes('maybe') || s.includes('メイ')) section = 'maybeboard';
        else if (s.includes('comp') || s.includes('相棒')) section = 'companion';
      }

      entries.push({
        section,
        count,
        name: name.trim(),
        set: set.trim().toUpperCase(),
        number: number.trim(),
        raw: JSON.stringify(r)
      });
    });

    return entries;
  };

  /**
   * Parse JSON format
   */
  Importer.parseJSONDeck = function (jsonText) {
    try {
      const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
      const entries = [];

      // Check if it's our full deck format or similar
      if (data && (data.mainboard || data.commanders || data.sideboard)) {
        (data.commanders || []).forEach((c) => {
          entries.push({
            section: 'commander',
            count: c.count || 1,
            name: c.name || c.display_name,
            set: c.set || '',
            number: c.collector_number || '',
            raw: c.name
          });
        });
        (data.companions || []).forEach((c) => {
          entries.push({
            section: 'companion',
            count: 1,
            name: c.name || c.display_name,
            set: c.set || '',
            number: c.collector_number || '',
            raw: c.name
          });
        });
        (data.mainboard || []).forEach((item) => {
          const c = item.card || item;
          entries.push({
            section: 'main',
            count: item.count || 1,
            name: c.name || c.display_name,
            set: c.set || '',
            number: c.collector_number || '',
            raw: c.name
          });
        });
        (data.sideboard || []).forEach((item) => {
          const c = item.card || item;
          entries.push({
            section: 'sideboard',
            count: item.count || 1,
            name: c.name || c.display_name,
            set: c.set || '',
            number: c.collector_number || '',
            raw: c.name
          });
        });
        (data.maybeboard || []).forEach((item) => {
          const c = item.card || item;
          entries.push({
            section: 'maybeboard',
            count: item.count || 1,
            name: c.name || c.display_name,
            set: c.set || '',
            number: c.collector_number || '',
            raw: c.name
          });
        });
        return entries;
      }

      // Check if it's an array of items
      if (Array.isArray(data)) {
        data.forEach((item) => {
          const name = item.name || item.card_name || item.card?.name || '';
          if (!name) return;
          entries.push({
            section: item.section || 'main',
            count: item.count || item.qty || 1,
            name: name,
            set: item.set || item.edition || '',
            number: item.collector_number || item.number || '',
            raw: JSON.stringify(item)
          });
        });
        return entries;
      }

      return [];
    } catch (e) {
      console.warn('JSON deck parse error:', e);
      return [];
    }
  };

  /**
   * Detect recommended deck format based on entries
   */
  Importer.detectDeckFormat = function (entries) {
    if (!entries || entries.length === 0) return 'casual';
    const hasCommander = entries.some((e) => e.section === 'commander');
    const totalCount = entries.reduce((s, e) => s + (e.count || 1), 0);

    if (hasCommander || totalCount === 100) {
      return 'commander';
    }
    if (totalCount === 60) {
      return 'standard';
    }
    return 'casual';
  };

  /**
   * Match parsed entries against Scryfall card database using:
   * 1. IndexedDB cache
   * 2. Scryfall batch /cards/collection
   * 3. 5-Stage Automated Fallback Search (Scryfall.resolveCard)
   * 4. Automatic second pass for any stubbornly unmatched cards
   */
  Importer.matchCards = async function (entries, onProgress = null) {
    const matched = [];
    const unmatched = [];
    const pending = [];

    // Phase 1: Fast Cache Check
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (onProgress) {
        onProgress(i + 1, entries.length, entry.name, 'キャッシュ確認中');
      }

      let card = null;
      if (window.DB) {
        if (entry.set && entry.number) {
          card = await window.DB.getCache(`id_${entry.set.toLowerCase()}_${entry.number}`);
        }
        if (!card) {
          card = await window.DB.getCache(`named_${encodeURIComponent(entry.name)}_${entry.set ? entry.set.toLowerCase() : 'all'}`);
        }
        if (!card) {
          card = await window.DB.getCache(`named_${encodeURIComponent(entry.name)}_all`);
        }
      }

      if (card) {
        if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(entry.name)) {
          card.name_ja = entry.name;
          card.display_name = entry.name;
        }
        matched.push({ ...entry, card, recognized: true });
      } else {
        pending.push({ index: i, entry });
      }
    }

    // Phase 2: Batch Collection Query
    if (pending.length > 0) {
      const batchIdentifiers = [];
      pending.forEach(({ entry }) => {
        const isJa = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(entry.name);
        if (entry.set && entry.number) {
          batchIdentifiers.push({ set: entry.set.toLowerCase(), collector_number: entry.number });
        } else if (!isJa && entry.name) {
          batchIdentifiers.push({ name: entry.name });
        }
      });

      const batchResultsMap = new Map();
      if (batchIdentifiers.length > 0 && Scryfall.getCollection) {
        try {
          if (onProgress) {
            onProgress(matched.length, entries.length, '一括高速照合中...', 'Scryfallバッチ処理');
          }
          const fetchedCards = await Scryfall.getCollection(batchIdentifiers);
          fetchedCards.forEach((c) => {
            if (!c) return;
            if (c.set && c.collector_number) {
              batchResultsMap.set(`${c.set.toUpperCase()}_${c.collector_number}`, c);
            }
            if (c.name) {
              batchResultsMap.set(c.name.toLowerCase(), c);
            }
          });
        } catch (e) {
          console.warn('Batch collection lookup failed:', e);
        }
      }

      // Phase 3: 5-Stage Automated Fallback Search for each card
      for (let p = 0; p < pending.length; p++) {
        const { entry } = pending[p];
        if (onProgress) {
          onProgress(matched.length + p + 1, entries.length, entry.name, '自動多段階照合中');
        }

        let card = null;

        // Check if resolved by batch
        if (entry.set && entry.number) {
          card = batchResultsMap.get(`${entry.set}_${entry.number}`);
        }
        if (!card && entry.name) {
          card = batchResultsMap.get(entry.name.toLowerCase());
        }

        // Run multi-stage resolver
        if (!card) {
          if (Scryfall.resolveCard) {
            card = await Scryfall.resolveCard(entry.name, entry.set, entry.number);
          } else {
            card = await Scryfall.getCardByName(entry.name, entry.set || null);
          }
        }

        if (card) {
          if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(entry.name)) {
            card.name_ja = entry.name;
            card.display_name = entry.name;
          }
          matched.push({
            ...entry,
            card: card,
            recognized: true
          });
        } else {
          unmatched.push({
            ...entry,
            card: null,
            recognized: false
          });
        }
      }
    }

    // Phase 4: Automatic Second Sweep for any stubbornly unmatched cards (Fuzzy relaxation)
    if (unmatched.length > 0 && Scryfall.resolveCard) {
      const stillUnmatched = [];
      for (let u = 0; u < unmatched.length; u++) {
        const item = unmatched[u];
        if (onProgress) {
          onProgress(entries.length, entries.length, item.name, '未認識カード再試行中');
        }

        // Strip parentheses, brackets, or suffixes
        const simplified = item.name
          .replace(/\(.*?\)/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/#.*$/, '')
          .trim();

        let retryCard = null;
        if (simplified && simplified !== item.name) {
          retryCard = await Scryfall.resolveCard(simplified, item.set, item.number);
        }

        // Try without punctuation
        if (!retryCard) {
          const noPunct = item.name.replace(/[^\w\s\u3040-\u30ff\u3400-\u9fff]/g, ' ').replace(/\s+/g, ' ').trim();
          if (noPunct && noPunct !== item.name && noPunct !== simplified) {
            retryCard = await Scryfall.resolveCard(noPunct);
          }
        }

        if (retryCard) {
          matched.push({
            ...item,
            card: retryCard,
            recognized: true
          });
        } else {
          stillUnmatched.push(item);
        }
      }

      unmatched.length = 0;
      unmatched.push(...stillUnmatched);
    }

    return { matched, unmatched };
  };

  /**
   * Convert matched entries into standard deck structure
   */
  Importer.buildDeckFromEntries = function (matchedEntries, deckName = 'インポートされたデッキ', format = 'casual') {
    const deck = {
      id: Utils.generateId('deck'),
      name: deckName,
      format: format,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      favorite: false,
      tags: ['インポート'],
      memo: '',
      bracket: 2,
      commanders: [],
      companions: [],
      mainboard: [],
      sideboard: [],
      maybeboard: []
    };

    matchedEntries.forEach((entry) => {
      const card = entry.card;
      if (!card) return;

      const item = {
        card: card,
        count: entry.count || 1,
        categories: []
      };

      if (entry.section === 'commander') {
        const cmdCard = Utils.clone(card);
        cmdCard.count = entry.count || 1;
        deck.commanders.push(cmdCard);
      } else if (entry.section === 'companion') {
        const compCard = Utils.clone(card);
        compCard.count = entry.count || 1;
        deck.companions.push(compCard);
      } else if (entry.section === 'sideboard') {
        deck.sideboard.push(item);
      } else if (entry.section === 'maybeboard') {
        deck.maybeboard.push(item);
      } else {
        deck.mainboard.push(item);
      }
    });

    return deck;
  };

  window.Importer = Importer;
})(window);
