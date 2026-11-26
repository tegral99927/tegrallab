// mana.js - Mana pool and cost management (W, U, B, R, G, C)

export const MANA_COLORS = ["W", "U", "B", "R", "G", "C"];

export class ManaPool {
  constructor(initial = {}) {
    this.W = initial.W || 0;
    this.U = initial.U || 0;
    this.B = initial.B || 0;
    this.R = initial.R || 0;
    this.G = initial.G || 0;
    this.C = initial.C || 0;
  }

  total() {
    return this.W + this.U + this.B + this.R + this.G + this.C;
  }

  add(color, amount = 1) {
    const col = color.toUpperCase();
    if (MANA_COLORS.includes(col)) {
      this[col] += amount;
    }
  }

  empty() {
    this.W = 0;
    this.U = 0;
    this.B = 0;
    this.R = 0;
    this.G = 0;
    this.C = 0;
  }

  clone() {
    return new ManaPool({
      W: this.W,
      U: this.U,
      B: this.B,
      R: this.R,
      G: this.G,
      C: this.C
    });
  }

  toObject() {
    return {
      W: this.W,
      U: this.U,
      B: this.B,
      R: this.R,
      G: this.G,
      C: this.C
    };
  }
}

/**
 * Parses mana cost string (e.g. "{2}{U}{U}", "{X}{U}", "{C}", "{1}{G/U}")
 * Returns: { generic: 2, W: 0, U: 2, B: 0, R: 0, G: 0, C: 0, isX: false }
 */
export function parseManaCost(costStr) {
  const parsed = {
    generic: 0,
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
    isX: false,
    xCount: 0
  };

  if (!costStr) return parsed;

  const matches = costStr.match(/\{([^}]+)\}/g) || [];
  for (const m of matches) {
    const sym = m.replace(/[{}]/g, "").toUpperCase();
    if (sym === "X") {
      parsed.isX = true;
      parsed.xCount += 1;
    } else if (MANA_COLORS.includes(sym)) {
      parsed[sym] += 1;
    } else if (!isNaN(parseInt(sym, 10))) {
      parsed.generic += parseInt(sym, 10);
    }
  }

  return parsed;
}

/**
 * Checks if mana pool can pay parsed cost with optional xValue.
 */
export function canPayManaCost(pool, parsedCost, xValue = 0) {
  const reqGeneric = parsedCost.generic + (parsedCost.isX ? parsedCost.xCount * xValue : 0);
  
  // Check specific colors and colorless C
  for (const col of MANA_COLORS) {
    if (pool[col] < parsedCost[col]) {
      return false;
    }
  }

  // Calculate remaining mana available for generic cost
  let remainingTotal = 0;
  for (const col of MANA_COLORS) {
    remainingTotal += (pool[col] - parsedCost[col]);
  }

  return remainingTotal >= reqGeneric;
}

/**
 * Automatically deducts mana from pool to pay the parsed cost.
 * Spends exact required colors first, then spends colorless C for generic,
 * then spends colored mana with least impact (or most plentiful).
 */
export function payManaCost(pool, parsedCost, xValue = 0, preferredPayment = null) {
  if (!canPayManaCost(pool, parsedCost, xValue)) {
    return false;
  }

  // If player specified preferred payment breakdown
  if (preferredPayment) {
    for (const col of MANA_COLORS) {
      if ((preferredPayment[col] || 0) > pool[col]) return false;
    }
    for (const col of MANA_COLORS) {
      pool[col] -= (preferredPayment[col] || 0);
    }
    return true;
  }

  // 1. Pay colored and required colorless C
  for (const col of MANA_COLORS) {
    pool[col] -= parsedCost[col];
  }

  // 2. Pay generic mana
  let genericToPay = parsedCost.generic + (parsedCost.isX ? parsedCost.xCount * xValue : 0);

  // Spend C first for generic
  if (genericToPay > 0 && pool.C > 0) {
    const spendC = Math.min(pool.C, genericToPay);
    pool.C -= spendC;
    genericToPay -= spendC;
  }

  // Spend remaining colors in order: R, G, B, W, U (preserve U/G for combos if possible, spend most abundant)
  while (genericToPay > 0) {
    // Find color with max available mana
    let bestCol = null;
    let maxVal = -1;
    for (const col of ["R", "B", "W", "G", "U", "C"]) {
      if (pool[col] > maxVal && pool[col] > 0) {
        maxVal = pool[col];
        bestCol = col;
      }
    }

    if (!bestCol) break;

    pool[bestCol] -= 1;
    genericToPay -= 1;
  }

  return genericToPay === 0;
}
