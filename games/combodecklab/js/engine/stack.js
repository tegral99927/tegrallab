// stack.js - MTG Stack management (LIFO)

import { generateInstanceId } from "../utils/helpers.js";
import { ZONES } from "./zones.js";

export class StackItem {
  constructor({
    type = "spell", // "spell" | "ability" | "trigger"
    sourceCard,
    name,
    effect,
    targets = [],
    xValue = 0,
    modes = null,
    costPaid = null
  }) {
    this.id = generateInstanceId("stack");
    this.type = type;
    this.sourceCard = sourceCard;
    this.name = name || (sourceCard ? sourceCard.name : "Effect");
    this.effect = effect;
    this.targets = targets;
    this.xValue = xValue;
    this.modes = modes;
    this.costPaid = costPaid;
    this.timestamp = Date.now();
  }
}

export class MTGStack {
  constructor() {
    this.items = [];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  push(item) {
    this.items.push(item);
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items.length > 0 ? this.items[this.items.length - 1] : null;
  }

  clear() {
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  // Resolves the top object on the stack
  resolveTop(game) {
    if (this.isEmpty()) return null;

    const item = this.pop();
    game.log(`${item.name} が解決されます。`, "stack");

    // Target legality check (CR 608.2b)
    if (item.targets && item.targets.length > 0) {
      let allIllegal = true;
      for (const target of item.targets) {
        if (target.type === "player") {
          allIllegal = false; // Player is always legal target in goldfish
        } else if (target.type === "card") {
          // Verify card still exists in expected zone
          const current = game.findCard(target.id);
          if (current) {
            allIllegal = false;
          }
        }
      }

      if (allIllegal) {
        game.log(`${item.name} は対象が不適正になったため、立ち消え（解決失敗）しました。`, "warning");
        if (item.type === "spell" && item.sourceCard) {
          game.moveCard(item.sourceCard.instanceId, ZONES.GRAVEYARD);
        }
        return item;
      }
    }

    // Execute effect function
    if (typeof item.effect === "function") {
      try {
        item.effect(game, item);
      } catch (e) {
        console.error("Effect execution error:", e);
        game.log(`効果解決中にエラーが発生しました: ${e.message}`, "error");
      }
    }

    // Spell movement after resolution (CR 608.2m)
    // Instants and Sorceries go to graveyard unless card effect moved them elsewhere (e.g. Time Spiral exiles itself, Approach goes to library)
    if (item.type === "spell" && item.sourceCard) {
      const card = game.findCard(item.sourceCard.instanceId);
      if (card && card.zone === ZONES.STACK) {
        const typeLine = (card.metadata.typeLine || "").toLowerCase();
        if (typeLine.includes("instant") || typeLine.includes("sorcery")) {
          game.moveCard(card.instanceId, ZONES.GRAVEYARD);
        } else {
          // Permanent enters battlefield
          game.moveCard(card.instanceId, ZONES.BATTLEFIELD);
          // Check ETB triggers
          game.checkETB(card);
        }
      }
    }

    // Run State-Based Actions
    game.checkStateBasedActions();

    return item;
  }
}
