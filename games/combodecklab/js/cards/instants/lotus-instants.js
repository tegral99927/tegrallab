// lotus-instants.js - Instants for Lotus Field Combo

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Impulse
// Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.
export const Impulse = createCardDefinition({
  name: "Impulse",
  oracleId: "3b890885-3642-4f76-9d6a-542ca0248a32",
  spellEffect: (game) => {
    const lib = game.state.player.library;
    const viewCount = Math.min(4, lib.length);

    if (viewCount === 0) {
      game.log("《衝動》: ライブラリーにカードがありません。", "warning");
      return;
    }

    // Top cards from library
    const topCards = [];
    for (let i = 0; i < viewCount; i++) {
      topCards.push(lib.pop());
    }

    // Pick best combo piece among top cards
    // Priority: Lotus Field > Thespian's Stage > Hidden Strings > Pore Over the Pages > Emergent Ultimatum > others
    const priority = ["Lotus Field", "Thespian's Stage", "Hidden Strings", "Pore Over the Pages", "Emergent Ultimatum", "Approach of the Second Sun", "Sylvan Scrying", "Vizier of Tumbling Sands"];
    let chosenIdx = 0;
    for (const name of priority) {
      const idx = topCards.findIndex(c => c.name.includes(name));
      if (idx !== -1) {
        chosenIdx = idx;
        break;
      }
    }

    const chosenCard = topCards.splice(chosenIdx, 1)[0];
    const freshHand = chosenCard.movedTo(ZONES.HAND);
    game.zoneManager.add(freshHand, ZONES.HAND);
    game.log(`《衝動》: 上から${viewCount}枚見て《${freshHand.name}》を手札に加えました。`, "action");

    // Put remaining on bottom of library
    for (const restCard of topCards) {
      const freshBottom = restCard.movedTo(ZONES.LIBRARY);
      game.zoneManager.add(freshBottom, ZONES.LIBRARY, "bottom");
    }

    game.syncZoneReferences();
  }
});
