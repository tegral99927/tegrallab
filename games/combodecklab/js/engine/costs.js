// costs.js - Additional and alternative cost handling

import { parseManaCost, canPayManaCost, payManaCost } from "./mana.js";
import { ZONES } from "./zones.js";

export function canPayAllCosts(game, costDef, sourceCard, xValue = 0) {
  // 1. Mana cost
  if (costDef.mana) {
    const parsed = typeof costDef.mana === "string" ? parseManaCost(costDef.mana) : costDef.mana;
    if (!canPayManaCost(game.state.player.manaPool, parsed, xValue)) {
      return false;
    }
  }

  // 2. Tap cost
  if (costDef.tap) {
    if (!sourceCard || sourceCard.tapped) return false;
    if (sourceCard.metadata && (sourceCard.metadata.typeLine || "").toLowerCase().includes("creature")) {
      if (sourceCard.summoningSickness) return false;
    }
  }

  // 3. Discard cost
  if (costDef.discardCount) {
    const handCount = game.state.player.hand.length;
    // Exclude source card if it is in hand (cannot discard itself to pay its own spell cost unless specified)
    const available = sourceCard && sourceCard.zone === ZONES.HAND ? handCount - 1 : handCount;
    if (available < costDef.discardCount) return false;
  }

  // 4. Sacrifice cost
  if (costDef.sacrificeSelf) {
    if (!sourceCard || sourceCard.zone !== ZONES.BATTLEFIELD) return false;
  }

  // 5. Life cost
  if (costDef.payLife) {
    if (game.state.player.life < costDef.payLife) return false;
  }

  return true;
}

export function payAllCosts(game, costDef, sourceCard, xValue = 0, options = {}) {
  // Mana
  if (costDef.mana) {
    const parsed = typeof costDef.mana === "string" ? parseManaCost(costDef.mana) : costDef.mana;
    const paid = payManaCost(game.state.player.manaPool, parsed, xValue, options.preferredPayment);
    if (!paid) return false;
  }

  // Tap
  if (costDef.tap && sourceCard) {
    sourceCard.tapped = true;
  }

  // Discard
  if (costDef.discardCount) {
    if (options.discardCardIds && options.discardCardIds.length === costDef.discardCount) {
      for (const id of options.discardCardIds) {
        game.playerDiscard(id);
      }
    } else {
      // Auto pick first available cards from hand
      let count = 0;
      const hand = [...game.state.player.hand];
      for (const c of hand) {
        if (sourceCard && c.instanceId === sourceCard.instanceId) continue;
        game.playerDiscard(c.instanceId);
        count++;
        if (count >= costDef.discardCount) break;
      }
    }
  }

  // Sacrifice
  if (costDef.sacrificeSelf && sourceCard) {
    game.moveCard(sourceCard.instanceId, ZONES.GRAVEYARD);
  }

  // Life
  if (costDef.payLife) {
    game.state.player.life -= costDef.payLife;
  }

  return true;
}
