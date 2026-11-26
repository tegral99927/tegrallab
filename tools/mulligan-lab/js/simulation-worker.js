/**
 * Mulligan Lab - Simulation Web Worker
 * High-performance Monte Carlo simulation for automated London Mulligan.
 * Operates entirely on lightweight structures without DOM or network dependencies.
 */

let isCancelled = false;

// PRNG: Mulberry32
function createPRNG(seed) {
  if (seed === undefined || seed === null || seed === '') {
    return Math.random;
  }
  let s = 0;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      s = Math.imul(31, s) + seed.charCodeAt(i) | 0;
    }
  } else {
    s = seed | 0;
  }

  return function() {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle
function shuffle(array, rng) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

// Generates combinations C(n, k)
function getSubsetsOfSize(array, size) {
  if (size >= array.length) return [array];
  if (size <= 0) return [[]];
  const result = [];
  function backtrack(start, current) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// Condition AST Evaluator (Zero eval / Function usage)
function evaluateHand(handCards, ast) {
  if (!ast) return true;

  function evalNode(node) {
    if (!node) return true;
    if (node.type === 'group') {
      const op = node.operator || 'AND';
      const children = node.children || [];
      if (children.length === 0) return true;

      if (op === 'AND') {
        for (let i = 0; i < children.length; i++) {
          if (!evalNode(children[i])) return false;
        }
        return true;
      } else if (op === 'OR') {
        for (let i = 0; i < children.length; i++) {
          if (evalNode(children[i])) return true;
        }
        return false;
      } else if (op === 'NOT') {
        return !evalNode(children[0]);
      }
      return true;
    }

    if (node.type === 'rule') {
      if (node.field === 'lands') {
        let lands = 0;
        for (let i = 0; i < handCards.length; i++) {
          if (handCards[i].isLand) lands++;
        }
        const min = node.min !== undefined ? node.min : 0;
        const max = node.max !== undefined ? node.max : 99;
        return lands >= min && lands <= max;
      }
      if (node.field === 'tag') {
        const target = node.tag;
        let count = 0;
        for (let i = 0; i < handCards.length; i++) {
          if (handCards[i].tags && handCards[i].tags.indexOf(target) !== -1) count++;
        }
        const min = node.min !== undefined ? node.min : 1;
        const max = node.max !== undefined ? node.max : 99;
        return count >= min && count <= max;
      }
      if (node.field === 'card') {
        const target = (node.cardName || '').toLowerCase().trim();
        let count = 0;
        for (let i = 0; i < handCards.length; i++) {
          if (handCards[i].key === target) count++;
        }
        const min = node.min !== undefined ? node.min : 1;
        const max = node.max !== undefined ? node.max : 99;
        return count >= min && count <= max;
      }
      if (node.field === 'color') {
        const target = node.color || 'W';
        let count = 0;
        for (let i = 0; i < handCards.length; i++) {
          if (handCards[i].mana_sources && handCards[i].mana_sources.indexOf(target) !== -1) count++;
        }
        return count >= (node.min || 1);
      }
      if (node.field === 'not_card') {
        const target = (node.cardName || '').toLowerCase().trim();
        for (let i = 0; i < handCards.length; i++) {
          if (handCards[i].key === target) return false;
        }
        return true;
      }
      if (node.field === 'cmc') {
        const target = node.cmc || 0;
        let count = 0;
        for (let i = 0; i < handCards.length; i++) {
          if (!handCards[i].isLand && handCards[i].cmc === target) count++;
        }
        return count >= (node.min || 1);
      }
    }
    return true;
  }

  return evalNode(ast);
}

// Card score heuristic when picking among valid subsets for bottoming
function scoreHand(hand) {
  let score = 0;
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i];
    if (c.isLand) score += 2;
    if (c.tags) {
      if (c.tags.indexOf('キーカード') !== -1) score += 5;
      if (c.tags.indexOf('初動') !== -1) score += 3;
      if (c.tags.indexOf('キャントリップ') !== -1) score += 2;
    }
  }
  return score;
}

// Main simulation runner
function runSimulation(params) {
  const {
    library, // Array of { id, key, isLand, cmc, tags, mana_sources }
    iterations = 1000,
    maxMulligans = 4,
    conditionAST,
    format = 'modern',
    freeMulliganRule = 'auto',
    seed = null
  } = params;

  isCancelled = false;
  const rng = createPRNG(seed);

  const isFreeApplicable = (freeMulliganRule === 'always') ||
    (freeMulliganRule === 'auto' && (format === 'commander' || format === 'brawl'));

  let keptAt7 = 0;
  let keptAt6 = 0;
  let keptAt5 = 0;
  let keptAt4OrLess = 0;
  let totalMulligans = 0;
  let totalKeptHandSize = 0;
  let conditionSuccesses = 0;
  let forcedKeeps = 0;
  let freeMulligansUsed = 0;

  const keptLandCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };
  const deckSize = library.length;
  const deckWorkBuffer = new Array(deckSize);

  const PROGRESS_INTERVAL = Math.max(100, Math.floor(iterations / 20));

  for (let trial = 0; trial < iterations; trial++) {
    if (isCancelled) {
      postMessage({ type: 'cancelled' });
      return;
    }

    // Report progress periodically
    if (trial % PROGRESS_INTERVAL === 0) {
      postMessage({
        type: 'progress',
        progress: trial / iterations,
        current: trial,
        total: iterations
      });
    }

    // Copy library to buffer
    for (let i = 0; i < deckSize; i++) deckWorkBuffer[i] = library[i];
    shuffle(deckWorkBuffer, rng);

    // Initial 7
    let currentHand = deckWorkBuffer.slice(0, 7);
    let mulliganCount = 0;
    let keptHand = null;
    let meetsCondition = evaluateHand(currentHand, conditionAST);

    if (meetsCondition) {
      keptHand = currentHand;
      keptAt7++;
      totalKeptHandSize += 7;
      conditionSuccesses++;
    } else {
      // Mulligan cycle
      while (mulliganCount < maxMulligans) {
        if (mulliganCount === 0 && isFreeApplicable) {
          freeMulligansUsed++;
        }
        mulliganCount++;
        totalMulligans++;

        const paidMulls = isFreeApplicable ? Math.max(0, mulliganCount - 1) : mulliganCount;
        const bottomNeeded = paidMulls;
        const targetHandSize = 7 - bottomNeeded;

        // Reshuffle and draw 7
        shuffle(deckWorkBuffer, rng);
        const drawn7 = deckWorkBuffer.slice(0, 7);

        if (bottomNeeded === 0) {
          if (evaluateHand(drawn7, conditionAST)) {
            keptHand = drawn7;
            conditionSuccesses++;
            break;
          }
        } else {
          // Check subsets of size (7 - bottomNeeded)
          const subsets = getSubsetsOfSize(drawn7, targetHandSize);
          let bestValidSubset = null;
          let bestScore = -1;

          for (let s = 0; s < subsets.length; s++) {
            const sub = subsets[s];
            if (evaluateHand(sub, conditionAST)) {
              const sc = scoreHand(sub);
              if (sc > bestScore) {
                bestScore = sc;
                bestValidSubset = sub;
              }
            }
          }

          if (bestValidSubset) {
            keptHand = bestValidSubset;
            conditionSuccesses++;
            break;
          }
        }
      }

      // If loop finished without keeping: forced keep on the last drawn 7
      if (!keptHand) {
        forcedKeeps++;
        const paidMulls = isFreeApplicable ? Math.max(0, mulliganCount - 1) : mulliganCount;
        const bottomNeeded = paidMulls;
        const targetHandSize = Math.max(1, 7 - bottomNeeded);
        const subsets = getSubsetsOfSize(deckWorkBuffer.slice(0, 7), targetHandSize);
        // Pick subset with best card score
        let bestSub = subsets[0];
        let bestSc = -1;
        for (let s = 0; s < subsets.length; s++) {
          const sc = scoreHand(subsets[s]);
          if (sc > bestSc) {
            bestSc = sc;
            bestSub = subsets[s];
          }
        }
        keptHand = bestSub || [];
      }

      // Record kept hand size metrics
      const handSize = keptHand.length;
      totalKeptHandSize += handSize;
      if (handSize === 7) keptAt7++;
      else if (handSize === 6) keptAt6++;
      else if (handSize === 5) keptAt5++;
      else keptAt4OrLess++;
    }

    // Track land distribution in kept hand
    let landsInHand = 0;
    for (let i = 0; i < keptHand.length; i++) {
      if (keptHand[i].isLand) landsInHand++;
    }
    if (landsInHand >= 5) keptLandCounts['5+']++;
    else keptLandCounts[landsInHand] = (keptLandCounts[landsInHand] || 0) + 1;
  }

  // Calculate final statistics
  const keep7Rate = keptAt7 / iterations;
  const keep6Rate = keptAt6 / iterations;
  const keep5Rate = keptAt5 / iterations;
  const keep4Rate = keptAt4OrLess / iterations;

  const successRate = conditionSuccesses / iterations;
  const forcedKeepRate = forcedKeeps / iterations;
  const avgMulligans = totalMulligans / iterations;
  const avgHandSize = totalKeptHandSize / iterations;
  const freeMulliganRate = freeMulligansUsed / iterations;

  // 95% Wald Confidence Interval for keep7
  const se7 = Math.sqrt((keep7Rate * (1 - keep7Rate)) / iterations);
  const ci7 = {
    lower: Math.max(0, keep7Rate - 1.96 * se7),
    upper: Math.min(1, keep7Rate + 1.96 * se7),
    margin: 1.96 * se7
  };

  postMessage({
    type: 'complete',
    results: {
      iterations,
      keep7Rate,
      keep6Rate,
      keep5Rate,
      keep4Rate,
      avgMulligans: avgMulligans.toFixed(2),
      avgHandSize: avgHandSize.toFixed(2),
      successRate,
      forcedKeepRate,
      freeMulliganRate,
      ci7,
      keptLandCounts
    }
  });
}

// Worker message dispatcher
self.onmessage = function(e) {
  const { type, payload } = e.data;
  if (type === 'start') {
    runSimulation(payload);
  } else if (type === 'cancel') {
    isCancelled = true;
  }
};
