// moma-instants.js - Instants for MoMa

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Stroke of Genius
// Target player draws X cards.
export const StrokeOfGenius = createCardDefinition({
  name: "Stroke of Genius",
  spellEffect: (game, item) => {
    const xValue = item.xValue || 0;
    // Determine target player (default to opponent if lethal, or player for draw)
    let targetPlayer = "player";
    if (item.targets && item.targets.length > 0) {
      targetPlayer = item.targets[0].id === "opponent" ? "opponent" : "player";
    } else {
      // Auto-target: if xValue >= opponent library, target opponent for lethal mill
      if (xValue >= game.state.opponent.library.length) {
        targetPlayer = "opponent";
      } else {
        targetPlayer = "player";
      }
    }

    if (targetPlayer === "player") {
      game.log(`《天才のひらめき》: あなたがカードを ${xValue} 枚引きます。`, "cast");
      game.playerDraw(xValue);
    } else {
      game.log(`《天才のひらめき》: 対戦相手を対象に指定！ 対戦相手がカードを ${xValue} 枚引きます。（相手の残りデッキ: ${game.state.opponent.library.length}枚）`, "cast");
      game.state.opponent.draw(xValue);
      game.checkStateBasedActions();
    }
  }
});

// Turnabout
// Choose artifact, creature, or land. Tap all permanents of the chosen type that target player controls, or untap all permanents of the chosen type that target player controls.
export const Turnabout = createCardDefinition({
  name: "Turnabout",
  spellEffect: (game, item) => {
    const chosenType = (item.modes && item.modes.type) || "land";
    const action = (item.modes && item.modes.action) || "untap";

    const bf = game.state.player.battlefield;
    let count = 0;

    for (const card of bf) {
      const typeLine = (card.metadata.typeLine || "").toLowerCase();
      if (typeLine.includes(chosenType)) {
        if (action === "untap") {
          card.tapped = false;
        } else {
          card.tapped = true;
        }
        count++;
      }
    }

    game.log(`《転換》により、すべての ${chosenType} (${count}枚) を${action === "untap" ? "アンタップ" : "タップ"}しました！`, "action");
  }
});

// Intuition
// Search your library for three cards and reveal them. An opponent chooses one. Put that card into your hand and the rest into your graveyard.
export const Intuition = createCardDefinition({
  name: "Intuition",
  spellEffect: (game) => {
    const lib = game.state.player.library;
    if (lib.length < 3) {
      game.log("《直観》: ライブラリーのカードが3枚未満です。", "warning");
      return;
    }

    // Default auto-search 3 key cards (e.g. Time Spiral, Mind Over Matter, Turnabout)
    const card1 = lib.pop();
    const card2 = lib.pop();
    const card3 = lib.pop();

    // In goldfish mode, player/opponent gives player the most favorable or first card
    const freshHand = card1.movedTo(ZONES.HAND);
    game.zoneManager.add(freshHand, ZONES.HAND);

    const freshGrave1 = card2.movedTo(ZONES.GRAVEYARD);
    game.zoneManager.add(freshGrave1, ZONES.GRAVEYARD);

    const freshGrave2 = card3.movedTo(ZONES.GRAVEYARD);
    game.zoneManager.add(freshGrave2, ZONES.GRAVEYARD);

    game.syncZoneReferences();
    game.shuffleLibrary();
    game.log(`《直観》: 《${freshHand.name}》を手札に加え、残りの《${freshGrave1.name}》《${freshGrave2.name}》を墓地に置きました。`, "action");
  }
});
