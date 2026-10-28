/**
 * MTGCollectionSummary - exporter.js
 * Deck export engine supporting Arena (EN/JP), Hareruya, MTGO, TXT, CSV, JSON
 * with sorting, section grouping, and roundtrip consistency.
 */

(function (window) {
  'use strict';

  const Exporter = {};

  // Sort helper
  Exporter.sortCards = function (items, sortBy = 'type') {
    const sorted = [...items];
    if (sortBy === 'name') {
      sorted.sort((a, b) => (a.card.name || '').localeCompare(b.card.name || ''));
    } else if (sortBy === 'cmc') {
      sorted.sort((a, b) => (a.card.cmc || 0) - (b.card.cmc || 0));
    } else if (sortBy === 'count') {
      sorted.sort((a, b) => (b.count || 1) - (a.count || 1));
    } else {
      // Default: Sort by primary card type then CMC then name
      const getTypeOrder = (typeLine = '') => {
        if (typeLine.includes('Creature')) return 1;
        if (typeLine.includes('Planeswalker')) return 2;
        if (typeLine.includes('Instant')) return 3;
        if (typeLine.includes('Sorcery')) return 4;
        if (typeLine.includes('Artifact')) return 5;
        if (typeLine.includes('Enchantment')) return 6;
        if (typeLine.includes('Battle')) return 7;
        if (typeLine.includes('Land')) return 8;
        return 9;
      };
      sorted.sort((a, b) => {
        const orderA = getTypeOrder(a.card.type_line);
        const orderB = getTypeOrder(b.card.type_line);
        if (orderA !== orderB) return orderA - orderB;
        if ((a.card.cmc || 0) !== (b.card.cmc || 0)) {
          return (a.card.cmc || 0) - (b.card.cmc || 0);
        }
        return (a.card.name || '').localeCompare(b.card.name || '');
      });
    }
    return sorted;
  };

  /**
   * Export deck to specific format string
   * @param {Object} deck
   * @param {string} format 'arena_en'|'arena_ja'|'hareruya'|'mtgo'|'txt'|'csv'|'json'
   * @param {Object} options { lang: 'ja'|'en', sortBy: 'type'|'cmc'|'name'|'count', includeSet: true, includeSideboard: true, includeMaybeboard: false }
   */
  Exporter.exportDeck = function (deck, format = 'arena_en', options = {}) {
    const opts = Object.assign(
      {
        lang: 'ja',
        sortBy: 'type',
        includeSet: true,
        includeSideboard: true,
        includeMaybeboard: false
      },
      options
    );

    if (format === 'json') {
      return JSON.stringify(deck, null, 2);
    }

    if (format === 'csv') {
      return Exporter.toCSV(deck, opts);
    }

    const commanders = deck.commanders || [];
    const mainboard = Exporter.sortCards(deck.mainboard || [], opts.sortBy);
    const sideboard = Exporter.sortCards(deck.sideboard || [], opts.sortBy);
    const maybeboard = Exporter.sortCards(deck.maybeboard || [], opts.sortBy);
    const companions = deck.companions || [];

    const getCardName = (card) => {
      if (!card) return '';
      if (opts.lang === 'ja' && card.name_ja) {
        return card.name_ja;
      }
      return card.name || card.display_name || '';
    };

    const formatLine = (count, card, isMTGO = false) => {
      const name = getCardName(card);
      if (isMTGO) {
        return `${count} ${card.name}`;
      }
      if (opts.includeSet && card.set && card.collector_number) {
        return `${count} ${name} (${card.set}) ${card.collector_number}`;
      }
      return `${count} ${name}`;
    };

    const lines = [];

    if (format === 'arena_ja') {
      if (commanders.length > 0) {
        lines.push('統率者');
        commanders.forEach((c) => lines.push(formatLine(c.count || 1, c)));
        lines.push('');
      }
      if (companions.length > 0) {
        lines.push('相棒');
        companions.forEach((c) => lines.push(formatLine(1, c)));
        lines.push('');
      }
      lines.push('デッキ');
      mainboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));

      if (opts.includeSideboard && sideboard.length > 0) {
        lines.push('');
        lines.push('サイドボード');
        sideboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));
      }
      if (opts.includeMaybeboard && maybeboard.length > 0) {
        lines.push('');
        lines.push('メイボード');
        maybeboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));
      }
    } else if (format === 'arena_en' || format === 'hareruya') {
      if (commanders.length > 0) {
        lines.push('Commander');
        commanders.forEach((c) => lines.push(formatLine(c.count || 1, c)));
        lines.push('');
      }
      if (companions.length > 0) {
        lines.push('Companion');
        companions.forEach((c) => lines.push(formatLine(1, c)));
        lines.push('');
      }
      lines.push('Deck');
      mainboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));

      if (opts.includeSideboard && sideboard.length > 0) {
        lines.push('');
        lines.push('Sideboard');
        sideboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));
      }
      if (opts.includeMaybeboard && maybeboard.length > 0) {
        lines.push('');
        lines.push('Maybeboard');
        maybeboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card)));
      }
    } else if (format === 'mtgo') {
      if (commanders.length > 0) {
        lines.push('// Commander');
        commanders.forEach((c) => lines.push(formatLine(c.count || 1, c, true)));
        lines.push('');
      }
      lines.push('// Mainboard');
      mainboard.forEach((item) => lines.push(formatLine(item.count || 1, item.card, true)));

      if (opts.includeSideboard && sideboard.length > 0) {
        lines.push('');
        lines.push('// Sideboard');
        sideboard.forEach((item) => lines.push(`SB: ${formatLine(item.count || 1, item.card, true)}`));
      }
    } else {
      // Generic plain TXT
      if (commanders.length > 0) {
        lines.push('// Commander');
        commanders.forEach((c) => lines.push(`${c.count || 1} ${getCardName(c)}`));
        lines.push('');
      }
      lines.push('// Mainboard');
      mainboard.forEach((item) => lines.push(`${item.count || 1} ${getCardName(item.card)}`));

      if (opts.includeSideboard && sideboard.length > 0) {
        lines.push('');
        lines.push('// Sideboard');
        sideboard.forEach((item) => lines.push(`${item.count || 1} ${getCardName(item.card)}`));
      }
      if (opts.includeMaybeboard && maybeboard.length > 0) {
        lines.push('');
        lines.push('// Maybeboard');
        maybeboard.forEach((item) => lines.push(`${item.count || 1} ${getCardName(item.card)}`));
      }
    }

    return lines.join('\n');
  };

  // Export to CSV
  Exporter.toCSV = function (deck, options = {}) {
    const headers = ['Section', 'Count', 'Name', 'Name (JA)', 'Set', 'Collector Number', 'Mana Cost', 'Type', 'Rarity', 'Price (USD)'];
    const rows = [];

    const addCardRow = (section, count, card) => {
      if (!card) return;
      rows.push({
        'Section': section,
        'Count': count,
        'Name': card.name || '',
        'Name (JA)': card.name_ja || '',
        'Set': card.set || '',
        'Collector Number': card.collector_number || '',
        'Mana Cost': card.mana_cost || '',
        'Type': card.type_line || '',
        'Rarity': card.rarity || '',
        'Price (USD)': card.prices?.usd || 0
      });
    };

    (deck.commanders || []).forEach((c) => addCardRow('Commander', c.count || 1, c));
    (deck.companions || []).forEach((c) => addCardRow('Companion', 1, c));
    (deck.mainboard || []).forEach((item) => addCardRow('Main', item.count || 1, item.card));
    if (options.includeSideboard) {
      (deck.sideboard || []).forEach((item) => addCardRow('Sideboard', item.count || 1, item.card));
    }
    if (options.includeMaybeboard) {
      (deck.maybeboard || []).forEach((item) => addCardRow('Maybeboard', item.count || 1, item.card));
    }

    return Utils.toCSV(headers, rows);
  };

  window.Exporter = Exporter;
})(window);

