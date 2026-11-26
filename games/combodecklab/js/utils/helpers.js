// helpers.js - Utility functions

let idCounter = 1;

export function generateInstanceId(prefix = "card") {
  return `${prefix}_${Date.now()}_${idCounter++}_${Math.random().toString(36).substring(2, 7)}`;
}

export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const cloned = {};
  for (const key of Object.keys(obj)) {
    cloned[key] = deepClone(obj[key]);
  }
  return cloned;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatManaSymbols(manaCost) {
  if (!manaCost) return "";
  // Replaces {W}, {U}, {B}, {R}, {G}, {C}, {1}, {X} with badge spans
  return manaCost.replace(/\{([^}]+)\}/g, (match, sym) => {
    const s = sym.toLowerCase();
    return `<span class="mana-symbol mana-${s}" title="${sym}">{${sym}}</span>`;
  });
}
