/**
 * Mulligan Lab - Analysis Engine & Pure SVG Charts
 * Theoretical Hypergeometric probability calculations, mana curve analysis,
 * turn progression projections, and standalone vector graph rendering.
 */

const Analysis = (() => {
  // Precomputed log-factorials for ultra-fast, overflow-safe binomial coefficients
  const MAX_LOG_FACT = 500;
  const logFactCache = new Float64Array(MAX_LOG_FACT);
  logFactCache[0] = 0;
  logFactCache[1] = 0;
  for (let i = 2; i < MAX_LOG_FACT; i++) {
    logFactCache[i] = logFactCache[i - 1] + Math.log(i);
  }

  function logBinomial(n, k) {
    if (k < 0 || k > n) return -Infinity;
    if (k === 0 || k === n) return 0;
    return logFactCache[n] - logFactCache[k] - logFactCache[n - k];
  }

  /**
   * Calculates exact hypergeometric PMF: P(X = k)
   * N: Population size (deck size, e.g. 60)
   * K: Number of successes in population (e.g. 24 lands)
   * n: Sample size (hand size, e.g. 7)
   * k: Exact successes drawn (e.g. 3 lands)
   */
  function hypergeometricPMF(N, K, n, k) {
    if (k < 0 || k > n || k > K || (n - k) > (N - K)) return 0;
    const logP = logBinomial(K, k) + logBinomial(N - K, n - k) - logBinomial(N, n);
    return Math.exp(logP);
  }

  /**
   * Calculates exact cumulative hypergeometric probability: P(X >= k)
   */
  function hypergeometricCDFOrMore(N, K, n, k) {
    let sum = 0;
    const maxK = Math.min(n, K);
    for (let x = k; x <= maxK; x++) {
      sum += hypergeometricPMF(N, K, n, x);
    }
    return Math.min(1, Math.max(0, sum));
  }

  /**
   * Calculates 95% Wald Confidence Interval for proportion p over sample M
   */
  function calcConfidenceInterval95(p, M) {
    if (M <= 0) return { lower: 0, upper: 0, margin: 0 };
    const se = Math.sqrt((p * (1 - p)) / M);
    const margin = 1.96 * se;
    return {
      lower: Math.max(0, p - margin),
      upper: Math.min(1, p + margin),
      margin: margin
    };
  }

  /**
   * Full statistical analysis of a deck's opening 7-card hand.
   */
  function analyzeDeck(deck) {
    if (!deck || !deck.mainboard || deck.mainboard.length === 0) {
      return null;
    }

    const mainboard = deck.mainboard;
    const totalCards = mainboard.reduce((s, c) => s + c.count, 0);
    const metaMap = DeckManager.getCardMetadata;
    const tagsMap = deck.cardTags || {};

    let totalLands = 0;
    let totalSpells = 0;
    let spellCmcSum = 0;
    let deckCmcSum = 0;
    const cmcDistribution = { 0: 0, 1: 0, 2: 3, 3: 0, 4: 0, 5: 0, '6+': 0 };
    const colorSources = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const tagCounts = {};

    // Tally cards
    for (const card of mainboard) {
      const count = card.count || 1;
      const key = card.name.toLowerCase().trim();
      const meta = metaMap(key);
      const isLand = meta ? meta.isLand : false;
      const cmc = meta ? meta.cmc : 0;
      const tags = tagsMap[key] || [];

      if (isLand) {
        totalLands += count;
      } else {
        totalSpells += count;
        spellCmcSum += cmc * count;
      }
      deckCmcSum += cmc * count;

      // Mana curve bucket
      if (!isLand) {
        if (cmc >= 6) cmcDistribution['6+'] += count;
        else cmcDistribution[cmc] = (cmcDistribution[cmc] || 0) + count;
      }

      // Color sources
      if (meta && meta.mana_sources) {
        meta.mana_sources.forEach(c => {
          if (colorSources[c] !== undefined) colorSources[c] += count;
        });
      }

      // Tag counts
      tags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + count;
      });
    }

    // Land distribution (0 to 7 lands in 7-card hand)
    const landProbabilities = [];
    let expectedLands = 0;
    for (let k = 0; k <= 7; k++) {
      const p = hypergeometricPMF(totalCards, totalLands, 7, k);
      const pCum = hypergeometricCDFOrMore(totalCards, totalLands, 7, k);
      landProbabilities.push({ count: k, exact: p, atLeast: pCum });
      expectedLands += k * p;
    }

    // Land screw / flood thresholds from settings
    const settings = Storage.getSettings();
    const screwThreshold = parseInt(settings.landScrewThreshold, 10); // e.g. <= 1
    const floodThreshold = parseInt(settings.landFloodThreshold, 10); // e.g. >= 5

    let screwRate = 0;
    let floodRate = 0;
    for (let k = 0; k <= screwThreshold; k++) screwRate += landProbabilities[k].exact;
    for (let k = floodThreshold; k <= 7; k++) floodRate += landProbabilities[k].exact;

    // Tag probabilities
    const tagStats = [];
    for (const [tag, count] of Object.entries(tagCounts)) {
      const p1 = hypergeometricCDFOrMore(totalCards, count, 7, 1);
      const p2 = hypergeometricCDFOrMore(totalCards, count, 7, 2);
      tagStats.push({
        tag,
        deckCount: count,
        pAtLeast1: p1,
        pAtLeast2: p2
      });
    }
    tagStats.sort((a, b) => b.deckCount - a.deckCount);

    return {
      totalCards,
      totalLands,
      totalSpells,
      expectedLands,
      avgSpellCmc: totalSpells > 0 ? (spellCmcSum / totalSpells).toFixed(2) : 0,
      avgDeckCmc: totalCards > 0 ? (deckCmcSum / totalCards).toFixed(2) : 0,
      cmcDistribution,
      landProbabilities,
      screwRate,
      floodRate,
      tagStats,
      colorSources
    };
  }

  /**
   * Projects cumulative probability of drawing target card/tag by Turn T (T1 to T10).
   * Play: hand size = 7 + (T - 1)
   * Draw: hand size = 7 + T
   */
  function projectTurnProgression(deckSize, targetCopies, maxTurn = 10, isPlay = true) {
    const points = [];
    for (let turn = 1; turn <= maxTurn; turn++) {
      const drawnCards = 7 + (isPlay ? (turn - 1) : turn);
      const prob = hypergeometricCDFOrMore(deckSize, targetCopies, drawnCards, 1);
      points.push({ turn, prob });
    }
    return points;
  }

  // ==========================================================================
  // PURE SVG CHART RENDERERS (No external library dependencies)
  // ==========================================================================

  /**
   * Renders a vertical Bar Chart in SVG.
   * containerId: DOM element ID
   * data: Array<{ label: string, value: number, secondaryValue?: number, tooltip?: string }>
   */
  function renderBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 220;
    const padding = { top: 20, right: 16, bottom: 32, left: 40 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = options.maxVal !== undefined ? options.maxVal : Math.max(...data.map(d => d.value), 0.05);
    const barWidth = Math.max(12, Math.min(36, chartW / (data.length * 1.5)));
    const barGap = (chartW - (barWidth * data.length)) / (data.length + 1);

    const barColor = options.color || '#6366f1';

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; font-family: sans-serif;">`;

    // Grid lines (0%, 25%, 50%, 75%, 100% of maxVal)
    for (let i = 0; i <= 4; i++) {
      const val = (maxVal * i) / 4;
      const y = padding.top + chartH - (chartH * (i / 4));
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color, #27344f)" stroke-dasharray="2,2" stroke-width="1"/>`;
      svg += `<text x="${padding.left - 6}" y="${y + 4}" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">${options.isPercent ? (val * 100).toFixed(0) + '%' : val.toFixed(options.decimals || 0)}</text>`;
    }

    // Bars
    data.forEach((d, idx) => {
      const x = padding.left + barGap + idx * (barWidth + barGap);
      const barH = maxVal > 0 ? (d.value / maxVal) * chartH : 0;
      const y = padding.top + chartH - barH;

      svg += `
        <g class="chart-bar-group" tabIndex="0">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${d.color || barColor}">
            <title>${d.label}: ${options.isPercent ? (d.value * 100).toFixed(1) + '%' : d.value}</title>
          </rect>
          <text x="${x + barWidth / 2}" y="${y - 4}" fill="var(--text-primary, #fff)" font-size="10" font-weight="600" text-anchor="middle">
            ${options.isPercent ? (d.value * 100).toFixed(0) + '%' : (d.value > 0 ? d.value : '')}
          </text>
          <text x="${x + barWidth / 2}" y="${height - padding.bottom + 16}" fill="var(--text-secondary, #cbd5e1)" font-size="11" text-anchor="middle">
            ${d.label}
          </text>
        </g>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  /**
   * Renders a Horizontal Bar Chart in SVG.
   * Useful for Tag probabilities.
   */
  function renderHorizontalBarChart(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:2rem;">データがありません</div>';
      return;
    }

    const itemHeight = 28;
    const width = container.clientWidth || 320;
    const height = Math.max(160, data.length * itemHeight + 20);
    const labelW = 100;
    const barMaxW = width - labelW - 50;

    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; font-family: sans-serif;">`;

    data.forEach((d, idx) => {
      const y = idx * itemHeight + 10;
      const barW = Math.max(2, d.value * barMaxW);

      svg += `
        <text x="${labelW - 8}" y="${y + 14}" fill="var(--text-secondary, #cbd5e1)" font-size="11" font-weight="500" text-anchor="end">${d.label}</text>
        <rect x="${labelW}" y="${y}" width="${barMaxW}" height="18" rx="4" fill="var(--bg-secondary, #161e30)" />
        <rect x="${labelW}" y="${y}" width="${barW}" height="18" rx="4" fill="${d.color || '#06b6d4'}">
          <title>${d.label}: ${(d.value * 100).toFixed(1)}%</title>
        </rect>
        <text x="${labelW + barW + 6}" y="${y + 14}" fill="var(--text-primary, #fff)" font-size="11" font-weight="600">${(d.value * 100).toFixed(0)}%</text>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  /**
   * Renders a Line Chart in SVG.
   * Useful for Turn Progression.
   */
  function renderLineChart(containerId, dataPoints, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 240;
    const padding = { top: 20, right: 24, bottom: 32, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; font-family: sans-serif;">`;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (chartH * (i / 4));
      const val = (i * 25);
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color, #27344f)" stroke-dasharray="2,2" stroke-width="1"/>`;
      svg += `<text x="${padding.left - 8}" y="${y + 4}" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">${val}%</text>`;
    }

    if (dataPoints && dataPoints.length > 0) {
      const stepX = chartW / (dataPoints.length - 1);
      const pointsStr = dataPoints.map((pt, idx) => {
        const x = padding.left + idx * stepX;
        const y = padding.top + chartH - (pt.prob * chartH);
        return `${x},${y}`;
      }).join(' ');

      // Fill area under line
      const firstX = padding.left;
      const lastX = padding.left + (dataPoints.length - 1) * stepX;
      const bottomY = padding.top + chartH;
      const areaPath = `M ${firstX},${bottomY} L ${pointsStr.replace(/ /g, ' L ')} L ${lastX},${bottomY} Z`;

      svg += `<path d="${areaPath}" fill="rgba(99, 102, 241, 0.15)" />`;
      svg += `<polyline points="${pointsStr}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;

      // Data dots & turn labels
      dataPoints.forEach((pt, idx) => {
        const x = padding.left + idx * stepX;
        const y = padding.top + chartH - (pt.prob * chartH);

        svg += `
          <circle cx="${x}" cy="${y}" r="4" fill="#6366f1" stroke="#ffffff" stroke-width="2">
            <title>第${pt.turn}ターン: ${(pt.prob * 100).toFixed(1)}%</title>
          </circle>
          <text x="${x}" y="${bottomY + 18}" fill="var(--text-secondary, #cbd5e1)" font-size="10" text-anchor="middle">T${pt.turn}</text>
        `;
      });
    }

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  /**
   * Renders Grouped Bar Chart for Deck Comparison.
   */
  function renderGroupedBarChart(containerId, categories, seriesA, seriesB) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 240;
    const padding = { top: 20, right: 20, bottom: 40, left: 45 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const groupW = chartW / categories.length;
    const barW = Math.max(8, (groupW - 20) / 2);

    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="display:block; font-family: sans-serif;">`;

    // Grid lines 0% to 100%
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (chartH * (i / 4));
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="var(--border-color, #27344f)" stroke-dasharray="2,2"/>`;
      svg += `<text x="${padding.left - 6}" y="${y + 4}" fill="var(--text-muted, #94a3b8)" font-size="10" text-anchor="end">${i * 25}%</text>`;
    }

    categories.forEach((cat, idx) => {
      const groupX = padding.left + idx * groupW;
      const valA = seriesA[idx] || 0;
      const valB = seriesB[idx] || 0;

      const hA = valA * chartH;
      const hB = valB * chartH;
      const yA = padding.top + chartH - hA;
      const yB = padding.top + chartH - hB;

      const xA = groupX + (groupW - barW * 2) / 2;
      const xB = xA + barW + 2;

      svg += `
        <rect x="${xA}" y="${yA}" width="${barW}" height="${hA}" rx="3" fill="#6366f1">
          <title>${cat} (デッキA): ${(valA * 100).toFixed(1)}%</title>
        </rect>
        <rect x="${xB}" y="${yB}" width="${barW}" height="${hB}" rx="3" fill="#06b6d4">
          <title>${cat} (デッキB): ${(valB * 100).toFixed(1)}%</title>
        </rect>
        <text x="${groupX + groupW / 2}" y="${height - padding.bottom + 16}" fill="var(--text-secondary, #cbd5e1)" font-size="10" text-anchor="middle">${cat}</text>
      `;
    });

    svg += `</svg>`;
    container.innerHTML = svg;
  }

  return {
    hypergeometricPMF,
    hypergeometricCDFOrMore,
    calcConfidenceInterval95,
    analyzeDeck,
    projectTurnProgression,
    renderBarChart,
    renderHorizontalBarChart,
    renderLineChart,
    renderGroupedBarChart
  };
})();
