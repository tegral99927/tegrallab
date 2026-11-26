// targeting.js - Target validation for spells and abilities

export const TARGET_TYPES = {
  PERMANENT: "permanent",
  LAND: "land",
  CREATURE: "creature",
  ARTIFACT: "artifact",
  ARTIFACT_OR_CREATURE_OR_LAND: "artifact_or_creature_or_land",
  PLAYER: "player",
  CARD_IN_GRAVEYARD: "card_in_graveyard",
  CARD_IN_LIBRARY: "card_in_library",
  SPELL_ON_STACK: "spell_on_stack"
};

export function getLegalTargets(game, targetReq, sourceCard = null) {
  const targets = [];
  const type = targetReq.type;

  if (type === TARGET_TYPES.PLAYER) {
    if (targetReq.mustBeOpponent) {
      targets.push({ type: "player", id: "opponent", name: "対戦相手 (Opponent)" });
    } else if (targetReq.mustBeSelf) {
      targets.push({ type: "player", id: "player", name: "自分 (You)" });
    } else {
      targets.push({ type: "player", id: "player", name: "自分 (You)" });
      targets.push({ type: "player", id: "opponent", name: "対戦相手 (Opponent)" });
    }
    return targets;
  }

  if (type === TARGET_TYPES.CARD_IN_GRAVEYARD) {
    const gy = game.state.player.graveyard;
    for (const card of gy) {
      if (matchesFilter(card, targetReq.filter)) {
        targets.push({ type: "card", id: card.instanceId, card, name: card.name });
      }
    }
    return targets;
  }

  // Battlefield permanents
  const battlefield = game.state.player.battlefield;
  for (const card of battlefield) {
    // If target cannot be source
    if (targetReq.excludeSource && sourceCard && card.instanceId === sourceCard.instanceId) {
      continue;
    }

    // Hexproof check (can target own cards freely)
    if (card.controller !== "player" && hasHexproof(card)) {
      continue;
    }

    const typeLine = (card.metadata.typeLine || "").toLowerCase();
    let isMatch = false;

    if (type === TARGET_TYPES.PERMANENT) isMatch = true;
    else if (type === TARGET_TYPES.LAND && typeLine.includes("land")) isMatch = true;
    else if (type === TARGET_TYPES.CREATURE && typeLine.includes("creature")) isMatch = true;
    else if (type === TARGET_TYPES.ARTIFACT && typeLine.includes("artifact")) isMatch = true;
    else if (type === TARGET_TYPES.ARTIFACT_OR_CREATURE_OR_LAND) {
      if (typeLine.includes("artifact") || typeLine.includes("creature") || typeLine.includes("land")) {
        isMatch = true;
      }
    }

    if (isMatch && matchesFilter(card, targetReq.filter)) {
      targets.push({
        type: "card",
        id: card.instanceId,
        card,
        name: card.name,
        tapped: card.tapped
      });
    }
  }

  return targets;
}

function hasHexproof(card) {
  const text = (card.metadata.oracleText || "").toLowerCase();
  return text.includes("hexproof") || (card.cardDef && card.cardDef.hasHexproof);
}

function matchesFilter(card, filter) {
  if (!filter) return true;
  if (filter.tapped !== undefined && card.tapped !== filter.tapped) return false;
  if (filter.type) {
    const typeLine = (card.metadata.typeLine || "").toLowerCase();
    if (!typeLine.includes(filter.type.toLowerCase())) return false;
  }
  return true;
}
