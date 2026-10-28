/**
 * MTGCollectionSummary - utils.js
 * Utility functions for math, formatting, sanitization, CSV, and helpers.
 */

(function (window) {
  'use strict';

  const Utils = {};

  // Escape HTML to prevent XSS
  Utils.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Generate unique ID
  Utils.generateId = function (prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 7)}`;
  };

  // Deep clone
  Utils.clone = function (obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.warn('Clone error:', e);
      return obj;
    }
  };

  // Debounce function
  Utils.debounce = function (func, wait = 300) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  };

  // Format date (YYYY-MM-DD HH:mm)
  Utils.formatDate = function (dateVal) {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  };

  // Format currency
  Utils.formatCurrency = function (amount, currency = 'USD', jpyRate = 150) {
    const num = Number(amount) || 0;
    if (currency === 'JPY') {
      const val = Math.round(num * jpyRate);
      return `¥${val.toLocaleString('ja-JP')}`;
    }
    if (currency === 'EUR') {
      return `€${num.toFixed(2)}`;
    }
    return `$${num.toFixed(2)}`;
  };

  // Download a string as a file
  Utils.downloadFile = function (filename, content, mimeType = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Read file as text
  Utils.readFileAsText = function (file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  // Copy text to clipboard
  Utils.copyToClipboard = async function (text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      console.warn('Clipboard API failed, trying fallback', e);
    }
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
    document.body.removeChild(textarea);
    return success;
  };

  // --- Hypergeometric Distribution Math ---
  // Calculates nCr (combinations) using log-gamma / log factorials to prevent overflow
  Utils.logFactorials = [];
  Utils.getLogFactorial = function (n) {
    if (n < 0) return 0;
    if (Utils.logFactorials[n] !== undefined) {
      return Utils.logFactorials[n];
    }
    let val = 0;
    for (let i = 1; i <= n; i++) {
      val += Math.log(i);
      Utils.logFactorials[i] = val;
    }
    return Utils.logFactorials[n];
  };

  Utils.logCombination = function (n, r) {
    if (r < 0 || r > n) return -Infinity;
    if (r === 0 || r === n) return 0;
    return Utils.getLogFactorial(n) - Utils.getLogFactorial(r) - Utils.getLogFactorial(n - r);
  };

  Utils.combination = function (n, r) {
    if (r < 0 || r > n) return 0;
    if (r === 0 || r === n) return 1;
    return Math.round(Math.exp(Utils.logCombination(n, r)));
  };

  /**
   * Hypergeometric probability P(X = k)
   * N = Population size (deck size, e.g. 99 or 60)
   * K = Success states in population (e.g. number of lands, or 4 copies)
   * n = Sample size (e.g. 7 for opening hand)
   * k = Observed successes (e.g. 3 lands)
   */
  Utils.hypergeometric = function (k, N, K, n) {
    if (k < 0 || k > n || k > K || n - k > N - K) return 0;
    const logProb =
      Utils.logCombination(K, k) +
      Utils.logCombination(N - K, n - k) -
      Utils.logCombination(N, n);
    return Math.exp(logProb);
  };

  /**
   * Cumulative Hypergeometric P(X >= k)
   */
  Utils.hypergeometricAtLeast = function (k, N, K, n) {
    if (k <= 0) return 1;
    if (k > Math.min(n, K)) return 0;
    let sum = 0;
    const maxK = Math.min(n, K);
    for (let i = k; i <= maxK; i++) {
      sum += Utils.hypergeometric(i, N, K, n);
    }
    return Math.min(1, Math.max(0, sum));
  };

  /**
   * Calculate full opening hand land probability distribution
   * @param {number} deckSize e.g. 99 (excluding commander) or 60
   * @param {number} landCount e.g. 36
   * @param {number} handSize default 7
   * @returns {Array<{lands: number, prob: number, cumulative: number}>}
   */
  Utils.calculateOpeningHandLands = function (deckSize, landCount, handSize = 7) {
    const results = [];
    let cum = 0;
    for (let k = 0; k <= handSize; k++) {
      const p = Utils.hypergeometric(k, deckSize, landCount, handSize);
      cum += p;
      results.push({
        lands: k,
        probability: p,
        percentage: (p * 100).toFixed(1) + '%'
      });
    }
    return results;
  };

  /**
   * Calculate probability of drawing at least 'copiesNeeded' of a card with 'copiesInDeck'
   * by turn 'turn' (on the play or on the draw).
   */
  Utils.calculateTurnDrawProb = function (deckSize, copiesInDeck, turn = 1, onPlay = true, copiesNeeded = 1) {
    const drawnCards = 7 + (turn - 1) + (onPlay ? 0 : 1);
    const actualDraw = Math.min(deckSize, drawnCards);
    return Utils.hypergeometricAtLeast(copiesNeeded, deckSize, copiesInDeck, actualDraw);
  };

  // Simple CSV parser and stringifier
  Utils.parseCSV = function (text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];
    
    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const header = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      if (vals.length > 0 && (vals.length > 1 || vals[0] !== '')) {
        const rowObj = {};
        header.forEach((h, idx) => {
          rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        rows.push(rowObj);
      }
    }
    return { header, rows };
  };

  Utils.toCSV = function (headers, rows) {
    const escapeVal = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const headerLine = headers.map(h => escapeVal(h)).join(',');
    const dataLines = rows.map(row => {
      return headers.map(h => escapeVal(row[h] !== undefined ? row[h] : '')).join(',');
    });
    return [headerLine, ...dataLines].join('\r\n');
  };

  // Convert mana cost string like "{2}{U}{B}" to HTML representations
  Utils.renderManaCost = function (manaCost) {
    if (!manaCost) return '';
    // Replace {X} with styled span
    return manaCost.replace(/\{([A-Z0-9/]+)\}/g, (match, p1) => {
      const clean = p1.toLowerCase().replace('/', '');
      return `<span class="mana-symbol mana-${clean}" title="${match}">${p1}</span>`;
    });
  };

  // Extract color identity letters into readable order W, U, B, R, G, C
  Utils.sortColors = function (colors) {
    if (!colors || !Array.isArray(colors)) return [];
    const order = { 'W': 1, 'U': 2, 'B': 3, 'R': 4, 'G': 5, 'C': 6 };
    return [...colors].sort((a, b) => (order[a] || 99) - (order[b] || 99));
  };

  // Toast notification system
  Utils.toast = function (message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<span class="toast-message">${Utils.escapeHtml(message)}</span>`;
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('visible'), 10);
    // Remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  };

  window.Utils = Utils;
})(window);
