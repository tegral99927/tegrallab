// lotus-creatures.js - Creatures for Lotus Field Combo

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Vizier of Tumbling Sands
// {T}: Untap another target permanent.
// Cycling {1}{U}
// When you cycle Vizier of Tumbling Sands, untap target permanent.
export const VizierOfTumblingSands = createCardDefinition({
  name: "Vizier of Tumbling Sands",
  activatedAbilities: [
    {
      name: "侍臣のアンタップ能力",
      cost: { tap: true },
      isManaAbility: false,
      description: "{T}: 他の対象のパーマネント1つをアンタップする。",
      effect: (game, sourceCard, targets) => {
        let targetCard = null;
        if (targets && targets.length > 0 && targets[0].type === "card") {
          targetCard = game.findCard(targets[0].id);
        } else {
          // Default: untap Lotus Field or most valuable tapped land
          targetCard = game.state.player.battlefield.find(c => c.tapped && c.instanceId !== sourceCard.instanceId);
        }

        if (targetCard) {
          targetCard.tapped = false;
          game.log(`《砂時計の侍臣》の効果により、《${targetCard.name}》をアンタップしました。`, "action");
        }
      }
    }
  ],
  cyclingCost: "{1}{U}",
  cyclingTrigger: (game, item) => {
    // Untap target permanent on cycling
    let targetCard = null;
    if (item.targets && item.targets.length > 0 && item.targets[0].type === "card") {
      targetCard = game.findCard(item.targets[0].id);
    } else {
      // Default: Lotus Field or Thespian's Stage or any tapped land
      targetCard = game.state.player.battlefield.find(c => {
        const isLand = (c.metadata.typeLine || "").toLowerCase().includes("land");
        return isLand && c.tapped;
      });
      if (!targetCard) {
        targetCard = game.state.player.battlefield.find(c => c.tapped);
      }
    }

    if (targetCard) {
      targetCard.tapped = false;
      game.log(`《砂時計の侍臣》のサイクリング誘発により、《${targetCard.name}》をアンタップしました！`, "action");
    }
  }
});

// Arboreal Grazer
// Reach. When Arboreal Grazer enters the battlefield, you may put a land card from your hand onto the battlefield tapped.
export const ArborealGrazer = createCardDefinition({
  name: "Arboreal Grazer",
  etbTrigger: (game, sourceCard) => {
    // Look for a land in hand
    const landInHand = game.state.player.hand.find(c => (c.metadata.typeLine || "").toLowerCase().includes("land"));
    if (landInHand) {
      game.zoneManager.remove(landInHand.instanceId);
      const fresh = landInHand.movedTo(ZONES.BATTLEFIELD);
      fresh.tapped = true; // enters tapped
      game.zoneManager.add(fresh, ZONES.BATTLEFIELD);
      game.syncZoneReferences();
      game.log(`《樹上の草食獣》のETB効果により、手札から《${fresh.name}》をタップ状態で戦場に出しました。`, "action");
      game.checkETB(fresh);
    } else {
      game.log("《樹上の草食獣》: 手札に土地カードがありません。", "info");
    }
  }
});
