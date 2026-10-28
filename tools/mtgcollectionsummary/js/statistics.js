/**
 * MTGCollectionSummary - statistics.js
 * Deck statistical analysis, hypergeometric probability modeling,
 * and pure SVG responsive charts without external dependencies.
 */

(function (window) {
  'use strict';

  const Statistics = {};

  // Analyze deck metrics
  Statistics.analyzeDeck = function (deck) {
    if (!deck) return null;

    const commanders = deck.commanders || [];
    const companions = deck.companions || [];
    const mainboard = deck.mainboard || [];
    const sideboard = deck.sideboard || [];
    const maybeboard = deck.maybeboard || [];

    // All active cards in the main configuration
    const activeItems = [
      ...commanders.map((c) => ({ card: c, count: c.count || 1, section: 'commander' })),
      ...mainboard.map((item) => ({ ...item, section: 'main' }))
    ];

    const totalCards = activeItems.reduce((sum, i) => sum + (i.count || 1), 0);
    const sideCards = sideboard.reduce((sum, i) => sum + (i.count || 1), 0);

    // Type Breakdown
    const types = {
      creature: 0,
      instant: 0,
      sorcery: 0,
      artifact: 0,
      enchantment: 0,
      planeswalker: 0,
      battle: 0,
      land: 0,
      other: 0
    };

    // Color Breakdown (mana cost pips & color identities)
    const colorPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const cardColors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, Multi: 0 };

    // Mana Curve (excluding lands)
    const manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
    let nonLandCount = 0;
    let totalCmc = 0;
    const nonLandCmcs = [];

    // Rarities
    const rarities = { common: 0, uncommon: 0, rare: 0, mythic: 0, special: 0 };

    // Role / Custom Categories
    const roles = {
      'ランプ (Ramp)': 0,
      'ドロー (Draw)': 0,
      'サーチ (Tutors)': 0,
      '単体除去 (Removal)': 0,
      '全体除去 (Wipes)': 0,
      '打ち消し (Counters)': 0,
      '墓地対策 (GY Hate)': 0,
      '防護 (Protection)': 0,
      'コンボ (Combo)': 0,
      '土地 (Lands)': 0,
      'その他 (Other)': 0
    };

    // Pricing
    let estimatedPriceUsd = 0;

    activeItems.forEach(({ card, count, categories }) => {
      if (!card) return;
      const cnt = count || 1;
      const typeLine = card.type_line || '';
      const isLand = typeLine.includes('Land') || typeLine.includes('土地');

      // Price
      const price = parseFloat(card.prices?.usd) || 0;
      estimatedPriceUsd += price * cnt;

      // Types (may overlap e.g. Artifact Creature)
      let matchedAnyType = false;
      if (typeLine.includes('Creature') || typeLine.includes('クリーチャー')) { types.creature += cnt; matchedAnyType = true; }
      if (typeLine.includes('Instant') || typeLine.includes('インスタント')) { types.instant += cnt; matchedAnyType = true; }
      if (typeLine.includes('Sorcery') || typeLine.includes('ソーサリー')) { types.sorcery += cnt; matchedAnyType = true; }
      if (typeLine.includes('Artifact') || typeLine.includes('アーティファクト')) { types.artifact += cnt; matchedAnyType = true; }
      if (typeLine.includes('Enchantment') || typeLine.includes('エンチャント')) { types.enchantment += cnt; matchedAnyType = true; }
      if (typeLine.includes('Planeswalker') || typeLine.includes('プレインズウォーカー')) { types.planeswalker += cnt; matchedAnyType = true; }
      if (typeLine.includes('Battle') || typeLine.includes('バトル')) { types.battle += cnt; matchedAnyType = true; }
      if (isLand) { types.land += cnt; matchedAnyType = true; }
      if (!matchedAnyType) types.other += cnt;

      // CMC & Mana Curve
      if (!isLand) {
        nonLandCount += cnt;
        const cmc = Math.floor(card.cmc || 0);
        totalCmc += (card.cmc || 0) * cnt;
        for (let k = 0; k < cnt; k++) nonLandCmcs.push(card.cmc || 0);

        if (cmc <= 0) manaCurve[0] += cnt;
        else if (cmc >= 7) manaCurve['7+'] += cnt;
        else manaCurve[cmc] += cnt;
      }

      // Rarity
      const r = (card.rarity || 'common').toLowerCase();
      if (rarities[r] !== undefined) rarities[r] += cnt;
      else rarities.common += cnt;

      // Colors
      const colors = card.colors || [];
      if (colors.length === 0) {
        cardColors.C += cnt;
      } else if (colors.length > 1) {
        cardColors.Multi += cnt;
      } else {
        cardColors[colors[0]] = (cardColors[colors[0]] || 0) + cnt;
      }

      // Mana Pips in cost
      const manaCost = card.mana_cost || '';
      const pips = manaCost.match(/\{([WUBRGC])\}/g) || [];
      pips.forEach((p) => {
        const symbol = p.replace(/[{}]/g, '');
        if (colorPips[symbol] !== undefined) {
          colorPips[symbol] += cnt;
        }
      });

      // Role classification (Preset tags or card text heuristic)
      const userCats = Array.isArray(categories) ? categories : [];
      let categorized = false;
      if (userCats.length > 0) {
        userCats.forEach((cat) => {
          if (roles[cat] !== undefined) {
            roles[cat] += cnt;
            categorized = true;
          }
        });
      }

      // Automatic fallback categorization if no custom tags
      if (!categorized) {
        if (isLand) {
          roles['土地 (Lands)'] += cnt;
        } else {
          const text = ((card.oracle_text || '') + ' ' + (card.type_line || '')).toLowerCase();
          if (text.includes('search your library for a land') || text.includes('add {') || text.includes('mana pool')) {
            roles['ランプ (Ramp)'] += cnt;
          } else if (text.includes('draw a card') || text.includes('draws a card') || text.includes('draw two') || text.includes('draw three') || text.includes('draw x cards')) {
            roles['ドロー (Draw)'] += cnt;
          } else if (text.includes('counter target')) {
            roles['打ち消し (Counters)'] += cnt;
          } else if (text.includes('destroy all') || text.includes('exile all') || text.includes('each creature')) {
            roles['全体除去 (Wipes)'] += cnt;
          } else if (text.includes('destroy target') || text.includes('exile target') || text.includes('deals') && text.includes('target creature')) {
            roles['単体除去 (Removal)'] += cnt;
          } else if (text.includes('search your library')) {
            roles['サーチ (Tutors)'] += cnt;
          } else if (text.includes('graveyard') && (text.includes('exile') || text.includes('cannot'))) {
            roles['墓地対策 (GY Hate)'] += cnt;
          } else if (text.includes('hexproof') || text.includes('indestructible') || text.includes('protection from')) {
            roles['防護 (Protection)'] += cnt;
          } else {
            roles['その他 (Other)'] += cnt;
          }
        }
      }
    });

    // Average & Median CMC
    const avgCmc = nonLandCount > 0 ? totalCmc / nonLandCount : 0;
    nonLandCmcs.sort((a, b) => a - b);
    let medianCmc = 0;
    if (nonLandCmcs.length > 0) {
      const mid = Math.floor(nonLandCmcs.length / 2);
      medianCmc = nonLandCmcs.length % 2 !== 0 ? nonLandCmcs[mid] : (nonLandCmcs[mid - 1] + nonLandCmcs[mid]) / 2;
    }

    // Opening hand land distribution (7 cards)
    const landCount = types.land;
    const landProbabilities = Utils.calculateOpeningHandLands(totalCards, landCount, 7);

    return {
      totalCards,
      mainCards: mainboard.reduce((s, i) => s + (i.count || 1), 0),
      commanderCards: commanders.reduce((s, c) => s + (c.count || 1), 0),
      sideCards,
      landCount,
      nonLandCount,
      types,
      colorPips,
      cardColors,
      manaCurve,
      avgCmc: parseFloat(avgCmc.toFixed(2)),
      medianCmc: parseFloat(medianCmc.toFixed(1)),
      estimatedPriceUsd: parseFloat(estimatedPriceUsd.toFixed(2)),
      rarities,
      roles,
      landProbabilities
    };
  };

  /**
   * Render SVG Mana Curve Bar Chart
   */
  Statistics.renderManaCurveSVG = function (manaCurve, width = 450, height = 220) {
    const keys = ['0', '1', '2', '3', '4', '5', '6', '7+'];
    const values = keys.map((k) => manaCurve[k] || 0);
    const maxVal = Math.max(...values, 5);

    const padding = { top: 25, right: 20, bottom: 35, left: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barWidth = Math.floor(chartW / keys.length) - 8;

    let barsSVG = '';
    keys.forEach((key, i) => {
      const val = manaCurve[key] || 0;
      const barH = (val / maxVal) * chartH;
      const x = padding.left + i * (chartW / keys.length) + 4;
      const y = padding.top + chartH - barH;

      barsSVG += `
        <g class="chart-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="url(#barGradient)" class="chart-bar" />
          <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" fill="var(--text-primary, #fff)" font-size="11" font-weight="bold">${val > 0 ? val : ''}</text>
          <text x="${x + barWidth / 2}" y="${height - 12}" text-anchor="middle" fill="var(--text-secondary, #aaa)" font-size="12">${key}</text>
        </g>
      `;
    });

    return `
      <svg viewBox="0 0 ${width} ${height}" class="stat-svg-chart" style="width:100%; height:auto;">
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4f46e5" />
            <stop offset="100%" stop-color="#3730a3" />
          </linearGradient>
        </defs>
        <line x1="${padding.left}" y1="${padding.top + chartH}" x2="${width - padding.right}" y2="${padding.top + chartH}" stroke="var(--border-color, #444)" stroke-width="1" />
        ${barsSVG}
      </svg>
    `;
  };

  /**
   * Render SVG Horizontal Distribution Bars (Colors / Types / Roles)
   */
  Statistics.renderDistributionBars = function (dataMap, colorMap = {}, title = '') {
    const total = Object.values(dataMap).reduce((a, b) => a + b, 0);
    if (total === 0) return '<div class="chart-empty">データがありません</div>';

    let html = '<div class="dist-chart-container">';
    Object.keys(dataMap).forEach((label) => {
      const val = dataMap[label] || 0;
      if (val === 0) return;
      const pct = ((val / total) * 100).toFixed(1);
      const bg = colorMap[label] || 'var(--accent-color, #6366f1)';

      html += `
        <div class="dist-bar-item">
          <div class="dist-bar-header">
            <span class="dist-bar-label">${Utils.escapeHtml(label)}</span>
            <span class="dist-bar-val">${val}枚 (${pct}%)</span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${pct}%; background-color: ${bg};"></div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  };

  window.Statistics = Statistics;
})(window);

