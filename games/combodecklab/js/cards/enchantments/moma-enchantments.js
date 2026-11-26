// moma-enchantments.js - Mind Over Matter for MoMa

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Mind Over Matter
// Discard a card: Tap or untap target artifact, creature, or land.
export const MindOverMatter = createCardDefinition({
  name: "Mind Over Matter",
  activatedAbilities: [
    {
      name: "手札を捨ててタップ/アンタップ",
      cost: { discardCount: 1 },
      isManaAbility: false,
      description: "手札を1枚捨てる: 対象のアーティファクト、クリーチャー、土地1つをタップまたはアンタップする。",
      effect: (game, sourceCard, targets, options = {}) => {
        let targetCard = null;
        if (targets && targets.length > 0 && targets[0].type === "card") {
          targetCard = game.findCard(targets[0].id);
        } else {
          // Default choice: Tolarian Academy or Lotus Field if tapped, or any tapped land
          targetCard = game.state.player.battlefield.find(c => {
            const isMatch = (c.name.includes("Tolarian Academy") || c.name.includes("Lotus Field") || (c.metadata.typeLine || "").toLowerCase().includes("land"));
            return isMatch && c.tapped;
          });
          // If no tapped land, choose any untapped permanent to tap
          if (!targetCard) {
            targetCard = game.state.player.battlefield[0];
          }
        }

        if (targetCard) {
          const action = options.action || (targetCard.tapped ? "untap" : "tap");
          if (action === "untap") {
            targetCard.tapped = false;
            game.log(`《精神力》の効果により、手札を捨てて《${targetCard.name}》をアンタップしました！`, "action");
          } else {
            targetCard.tapped = true;
            game.log(`《精神力》の効果により、手札を捨てて《${targetCard.name}》をタップしました。`, "action");
          }
        } else {
          game.log("《精神力》: 対象となるパーマネントがありません。", "warning");
        }
      }
    }
  ]
});
