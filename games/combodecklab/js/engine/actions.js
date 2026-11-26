// actions.js - Player actions execution layer

import { Rules } from "./rules.js";
import { ZONES } from "./zones.js";
import { parseManaCost, canPayManaCost, payManaCost } from "./mana.js";
import { StackItem } from "./stack.js";
import { canPayAllCosts, payAllCosts } from "./costs.js";

export const Actions = {
  // Play a land from hand
  playLand(game, cardInstanceId) {
    const card = game.findCard(cardInstanceId);
    if (!card || card.zone !== ZONES.HAND) {
      return { success: false, message: "手札に対象の土地が見つかりません。" };
    }

    if (!Rules.canPlayLand(game, card)) {
      return { success: false, message: "今はこの土地をプレイできません（タイミングまたは今ターンの土地権上限）。" };
    }

    game.history.savePoint(`土地プレイ: 《${card.name}》`);

    // Move to battlefield
    game.zoneManager.remove(cardInstanceId);
    const fresh = card.movedTo(ZONES.BATTLEFIELD);

    // Check if card enters tapped (e.g. Lotus Field)
    if (fresh.cardDef && fresh.cardDef.entersTapped) {
      fresh.tapped = true;
    }

    game.zoneManager.add(fresh, ZONES.BATTLEFIELD);
    game.syncZoneReferences();

    game.state.player.landsPlayedThisTurn += 1;
    game.log(`土地をプレイしました: 《${fresh.name}》`, "action");

    // Check ETB triggers (Lotus Field sacrifice 2 lands, etc.)
    game.checkETB(fresh);
    game.checkStateBasedActions();

    return { success: true, card: fresh };
  },

  // Cast a spell from hand or outside/graveyard
  castSpell(game, cardInstanceId, options = {}) {
    const card = game.findCard(cardInstanceId);
    if (!card) {
      return { success: false, message: "対象のカードが見つかりません。" };
    }

    // Check cost
    const manaCostStr = options.alternativeCost || (card.metadata ? card.metadata.manaCost : "");
    const parsed = parseManaCost(manaCostStr);
    const xValue = options.xValue || 0;

    // Check if Omniscience applies (free casting)
    const hasOmniscience = game.hasOmniscience() && options.useOmniscience !== false;
    if (!hasOmniscience) {
      if (!canPayManaCost(game.state.player.manaPool, parsed, xValue)) {
        return { success: false, message: `マナコスト ${manaCostStr} を支払うためのマナが不足しています。` };
      }
    }

    game.history.savePoint(`呪文キャスト: 《${card.name}》`);

    // Pay mana cost if not free
    if (!hasOmniscience) {
      payManaCost(game.state.player.manaPool, parsed, xValue, options.preferredPayment);
      game.log(`マナコストを支払いました: ${manaCostStr || "{0}"}`, "mana");
    } else {
      game.log(`《全知》の効果により、マナ・コストを支払わずに唱えました。`, "info");
    }

    // Move card from current zone to Stack
    game.zoneManager.remove(cardInstanceId);
    const stackCard = card.movedTo(ZONES.STACK);
    game.zoneManager.add(stackCard, ZONES.STACK);
    game.syncZoneReferences();

    // Increment storm/cast count
    game.state.player.spellsCastThisTurn += 1;
    game.state.player.spellsCastHistory.push({
      name: card.name,
      cardId: card.instanceId,
      turn: game.turn.turnNumber,
      fromHand: card.zone === ZONES.HAND
    });

    game.log(`呪文を唱えました: 《${card.name}》 (スタックに追加)`, "cast");

    // Create StackItem
    const spellEffect = card.cardDef && card.cardDef.spellEffect ? card.cardDef.spellEffect : null;

    const stackItem = new StackItem({
      type: "spell",
      sourceCard: stackCard,
      name: `呪文: 《${card.name}》`,
      effect: spellEffect,
      targets: options.targets || [],
      xValue: xValue,
      modes: options.modes || null
    });

    game.stack.push(stackItem);

    // In goldfish mode, if no response desired, optionally resolve immediately or wait for manual resolve
    if (options.autoResolve) {
      game.resolveStack();
    }

    return { success: true, stackItem };
  },

  // Activate an ability on a permanent
  activateAbility(game, cardInstanceId, abilityIndex, options = {}) {
    const card = game.findCard(cardInstanceId);
    if (!card) return { success: false, message: "パーマネントが見つかりません。" };

    const def = card.cardDef;
    if (!def || !def.activatedAbilities || !def.activatedAbilities[abilityIndex]) {
      return { success: false, message: "指定された起動型能力が見つかりません。" };
    }

    const ability = def.activatedAbilities[abilityIndex];

    // Check costs
    if (!canPayAllCosts(game, ability.cost, card, options.xValue || 0)) {
      return { success: false, message: "能力の起動コストを支払えません。" };
    }

    game.history.savePoint(`能力起動: 《${card.name}》 - ${ability.name}`);

    // Pay costs
    payAllCosts(game, ability.cost, card, options.xValue || 0, options);

    // If it is a mana ability, resolve immediately without stack
    if (ability.isManaAbility) {
      if (typeof ability.effect === "function") {
        ability.effect(game, card, options.targets || [], options);
      }
      game.checkStateBasedActions();
      return { success: true, isManaAbility: true };
    }

    // Otherwise, put ability on stack
    const stackItem = new StackItem({
      type: "ability",
      sourceCard: card,
      name: `能力: 《${card.name}》 - ${ability.name}`,
      effect: (g, item) => {
        if (typeof ability.effect === "function") {
          ability.effect(g, card, item.targets, options);
        }
      },
      targets: options.targets || [],
      xValue: options.xValue || 0
    });

    game.stack.push(stackItem);
    game.log(`能力を起動しました: 《${card.name}》 - ${ability.name} (スタックに追加)`, "action");

    if (options.autoResolve) {
      game.resolveStack();
    }

    return { success: true, stackItem };
  },

  // Cycle a card from hand (e.g. Vizier of Tumbling Sands)
  cycleCard(game, cardInstanceId, options = {}) {
    const card = game.findCard(cardInstanceId);
    if (!card || card.zone !== ZONES.HAND) {
      return { success: false, message: "手札にカードが見つかりません。" };
    }

    const def = card.cardDef;
    if (!def || !def.cyclingCost) {
      return { success: false, message: "このカードはサイクリング能力を持っていません。" };
    }

    const parsedCost = parseManaCost(def.cyclingCost);
    if (!canPayManaCost(game.state.player.manaPool, parsedCost)) {
      return { success: false, message: `サイクリングコスト ${def.cyclingCost} を支払えません。` };
    }

    game.history.savePoint(`サイクリング: 《${card.name}》`);

    // Pay mana
    payManaCost(game.state.player.manaPool, parsedCost);

    // Discard the card
    game.moveCard(cardInstanceId, ZONES.GRAVEYARD);
    game.log(`《${card.name}》をサイクリングしました。`, "action");

    // Triggered ability on cycling (e.g. Vizier of Tumbling Sands untap target permanent)
    if (def.cyclingTrigger) {
      const triggerItem = new StackItem({
        type: "trigger",
        sourceCard: card,
        name: `誘発型能力: 《${card.name}》サイクリング誘発`,
        effect: def.cyclingTrigger,
        targets: options.targets || []
      });
      game.stack.push(triggerItem);
      game.log(`《${card.name}》のサイクリング時誘発型能力がスタックに乗りました。`, "trigger");
    }

    // Draw a card from cycling (resolves after trigger or puts draw effect on stack)
    const drawItem = new StackItem({
      type: "ability",
      sourceCard: card,
      name: `サイクリングのドロー: 《${card.name}》`,
      effect: (g) => {
        g.playerDraw(1);
      }
    });
    game.stack.push(drawItem);

    if (options.autoResolve) {
      game.resolveStack();
    }

    return { success: true };
  }
};
