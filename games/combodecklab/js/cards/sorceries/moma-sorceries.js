// moma-sorceries.js - Sorceries for MoMa

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Time Spiral
// Exile Time Spiral. Each player shuffles their hand and graveyard into their library, then draws seven cards. You untap up to six lands.
export const TimeSpiral = createCardDefinition({
  name: "Time Spiral",
  spellEffect: (game, item) => {
    // 1. Exile Time Spiral itself
    if (item.sourceCard) {
      game.moveCard(item.sourceCard.instanceId, ZONES.EXILE);
      game.log("《時のらせん》を追放しました。", "action");
    }

    // 2. Player shuffles hand and graveyard into library
    const handCards = [...game.state.player.hand];
    const graveCards = [...game.state.player.graveyard];

    for (const c of handCards) {
      game.zoneManager.remove(c.instanceId);
      const fresh = c.movedTo(ZONES.LIBRARY);
      game.zoneManager.add(fresh, ZONES.LIBRARY);
    }

    for (const c of graveCards) {
      game.zoneManager.remove(c.instanceId);
      const fresh = c.movedTo(ZONES.LIBRARY);
      game.zoneManager.add(fresh, ZONES.LIBRARY);
    }

    game.syncZoneReferences();
    game.shuffleLibrary();

    // 3. Opponent shuffles hand and graveyard into library
    game.state.opponent.shuffleHandAndGraveyardIntoLibrary();

    // 4. Each player draws 7 cards
    game.log("各プレイヤーがカードを7枚引きます。", "draw");
    game.playerDraw(7);
    game.state.opponent.draw(7);

    // 5. Untap up to six lands
    const lands = game.state.player.battlefield.filter(c => {
      const type = (c.metadata.typeLine || "").toLowerCase();
      return type.includes("land") && c.tapped;
    });

    let untapCount = 0;
    for (const l of lands) {
      if (untapCount >= 6) break;
      l.tapped = false;
      untapCount++;
    }

    game.log(`《時のらせん》により、土地を ${untapCount} 枚アンタップしました！`, "action");
    game.notifyStateChange();
  }
});

// Windfall
// Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.
export const Windfall = createCardDefinition({
  name: "Windfall",
  spellEffect: (game) => {
    // Discard player hand
    const playerHand = [...game.state.player.hand];
    const playerDiscardCount = playerHand.length;
    for (const c of playerHand) {
      game.playerDiscard(c.instanceId);
    }

    // Discard opponent hand
    const oppDiscardCount = game.state.opponent.discardAll();

    const maxDiscard = Math.max(playerDiscardCount, oppDiscardCount);
    game.log(`《意外な授かり物》: プレイヤーは ${playerDiscardCount} 枚、対戦相手は ${oppDiscardCount} 枚の手札を捨てました。（最大値: ${maxDiscard}枚）`, "action");

    // Each player draws maxDiscard
    if (maxDiscard > 0) {
      game.playerDraw(maxDiscard);
      game.state.opponent.draw(maxDiscard);
    }

    game.checkStateBasedActions();
  }
});
