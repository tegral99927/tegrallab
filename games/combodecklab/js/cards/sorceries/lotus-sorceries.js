// lotus-sorceries.js - Sorceries for Lotus Field Combo

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Hidden Strings
// You may tap or untap target permanent, then you may tap or untap another target permanent.
// Cipher (Then you may exile this spell card encoded on a creature you control...)
export const HiddenStrings = createCardDefinition({
  name: "Hidden Strings",
  spellEffect: (game, item) => {
    // Untap up to two lands (especially Lotus Field / Thespian's Stage)
    const tappedLands = game.state.player.battlefield.filter(c => {
      const isLand = (c.metadata.typeLine || "").toLowerCase().includes("land");
      return isLand && c.tapped;
    });

    let count = 0;
    for (const land of tappedLands) {
      if (count >= 2) break;
      land.tapped = false;
      count++;
      game.log(`《見えざる糸》により《${land.name}》をアンタップしました。`, "action");
    }

    if (count === 0) {
      game.log("《見えざる糸》: アンタップするパーマネントがありませんでした。", "info");
    }

    // Cipher option: if creature exists, can encode
    const creature = game.state.player.battlefield.find(c => (c.metadata.typeLine || "").toLowerCase().includes("creature"));
    if (creature && item.sourceCard) {
      creature.cipherSpells.push(item.sourceCard.name);
      game.moveCard(item.sourceCard.instanceId, ZONES.EXILE);
      game.log(`《見えざる糸》を《${creature.name}》に暗号化（追放）しました。`, "action");
    }
  }
});

// Pore Over the Pages
// Draw three cards, each untap up to two lands, then discard a card.
export const PoreOverThePages = createCardDefinition({
  name: "Pore Over the Pages",
  spellEffect: (game) => {
    // 1. Draw three cards
    game.log("《ページへの没頭》: カードを3枚引きます。", "draw");
    game.playerDraw(3);

    // 2. Untap up to two lands
    const tappedLands = game.state.player.battlefield.filter(c => {
      const isLand = (c.metadata.typeLine || "").toLowerCase().includes("land");
      return isLand && c.tapped;
    });

    let count = 0;
    for (const land of tappedLands) {
      if (count >= 2) break;
      land.tapped = false;
      count++;
      game.log(`《ページへの没頭》により《${land.name}》をアンタップしました。`, "action");
    }

    // 3. Discard a card
    if (game.state.player.hand.length > 0) {
      // Discard least critical card (e.g. extra land or duplicate)
      const toDiscard = game.state.player.hand[0];
      game.playerDiscard(toDiscard.instanceId);
    }
  }
});

// Sylvan Scrying
// Search your library for a land card, reveal it, put it into your hand, then shuffle.
export const SylvanScrying = createCardDefinition({
  name: "Sylvan Scrying",
  spellEffect: (game) => {
    const lib = game.state.player.library;
    // Prefer Lotus Field if not on field, else Thespian's Stage, else any land
    const hasField = game.state.player.battlefield.some(c => c.name.includes("Lotus Field"));
    const preferredLand = hasField ? "Thespian's Stage" : "Lotus Field";

    let foundIdx = lib.findIndex(c => c.name.includes(preferredLand));
    if (foundIdx === -1) {
      foundIdx = lib.findIndex(c => (c.metadata.typeLine || "").toLowerCase().includes("land"));
    }

    if (foundIdx !== -1) {
      const card = lib.splice(foundIdx, 1)[0];
      const fresh = card.movedTo(ZONES.HAND);
      game.zoneManager.add(fresh, ZONES.HAND);
      game.syncZoneReferences();
      game.log(`《森の占術》: ライブラリーから《${fresh.name}》を手札に加えました。`, "action");
    } else {
      game.log("《森の占術》: ライブラリーに土地カードが見つかりませんでした。", "info");
    }

    game.shuffleLibrary();
  }
});

// Approach of the Second Sun
// If this spell was cast from your hand and you've already cast another spell named Approach of the Second Sun this game, you win the game. Otherwise, you gain 7 life and you put Approach of the Second Sun into its owner's library seventh from the top.
export const ApproachOfTheSecondSun = createCardDefinition({
  name: "Approach of the Second Sun",
  spellEffect: (game, item) => {
    // Check cast history
    const castHistory = game.state.player.spellsCastHistory || [];
    const approachCasts = castHistory.filter(h => h.name.includes("Approach of the Second Sun"));

    // If this is the second (or later) cast and was from hand
    if (approachCasts.length >= 2) {
      game.state.player.hasWon = true;
      game.state.player.winReason = "《副陽の接近》を2回唱えたため、特殊勝利しました！";
      game.log("★★★ 《副陽の接近》の勝利条件を達成！ ゲームに勝利しました！ ★★★", "win");
      return;
    }

    // First cast: gain 7 life and put 7th from top
    game.state.player.life += 7;
    game.log("《副陽の接近》: 7点のライフを得ました。（現在のライフ: " + game.state.player.life + "）", "life");

    // Put into library seventh from top
    if (item.sourceCard) {
      game.zoneManager.remove(item.sourceCard.instanceId);
      const fresh = item.sourceCard.movedTo(ZONES.LIBRARY);
      const lib = game.zoneManager.get(ZONES.LIBRARY);
      // "seventh from top" means insert at index (lib.length - 6) since pop() takes from end
      const insertIdx = Math.max(0, lib.length - 6);
      lib.splice(insertIdx, 0, fresh);
      game.syncZoneReferences();
      game.log("《副陽の接近》をライブラリーの上から7枚目に置きました。", "action");
    }
  }
});

// Emergent Ultimatum
// Search your library for three monocolored cards, each with a different name. An opponent chooses one of those cards. Shuffle that card into your library. You may cast the other two cards without paying their mana costs.
export const EmergentUltimatum = createCardDefinition({
  name: "Emergent Ultimatum",
  spellEffect: (game) => {
    const lib = game.state.player.library;
    // Search 3 key spells: Omniscience, Peer into the Abyss, Dark Petition / Approach
    const candidates = ["Omniscience", "Peer into the Abyss", "Dark Petition", "Approach of the Second Sun", "Pore Over the Pages"];
    const foundCards = [];

    for (const name of candidates) {
      const idx = lib.findIndex(c => c.name.includes(name));
      if (idx !== -1) {
        foundCards.push(lib.splice(idx, 1)[0]);
        if (foundCards.length === 3) break;
      }
    }

    if (foundCards.length < 3) {
      game.log("《出現の根本原理》: ライブラリーに対象カードが不足しています。", "warning");
      return;
    }

    game.log(`《出現の根本原理》で公開された3枚: ${foundCards.map(c => `《${c.name}》`).join(", ")}`, "action");

    // Opponent choice: opponent returns Omniscience or Peer into Abyss to library, leaving the other two
    const returnedCard = foundCards[0]; // Opponent shuffles Omniscience back
    const castCard1 = foundCards[1];
    const castCard2 = foundCards[2];

    const freshReturn = returnedCard.movedTo(ZONES.LIBRARY);
    lib.push(freshReturn);
    game.shuffleLibrary();
    game.log(`対戦相手は《${returnedCard.name}》を選びました。ライブラリーに戻してシャッフルします。`, "info");

    // Cast the other two without paying mana cost
    for (const toCast of [castCard1, castCard2]) {
      const freshCast = toCast.movedTo(ZONES.HAND);
      game.zoneManager.add(freshCast, ZONES.HAND);
      game.syncZoneReferences();
      game.log(`《${toCast.name}》をマナ・コストを支払わずに唱えます！`, "cast");
      // Use Actions.castSpell with free casting
      import("../../engine/actions.js").then(({ Actions }) => {
        Actions.castSpell(game, freshCast.instanceId, { useOmniscience: true, autoResolve: true });
      });
    }
  }
});

// Peer into the Abyss
// Target player draws cards equal to half the number of cards in their library, rounded up, and loses half their life, rounded up.
export const PeerIntoTheAbyss = createCardDefinition({
  name: "Peer into the Abyss",
  spellEffect: (game) => {
    const halfLib = Math.ceil(game.state.player.library.length / 2);
    const halfLife = Math.ceil(game.state.player.life / 2);

    game.state.player.life -= halfLife;
    game.log(`《深淵への覗き込み》: ライフを ${halfLife} 点失い、カードを ${halfLib} 枚引きます！`, "action");
    game.playerDraw(halfLib);
    game.checkStateBasedActions();
  }
});

// Dark Petition
// Search your library for a card, put that card into your hand, then shuffle.
// Spell mastery — If there are two or more instant and/or sorcery cards in your graveyard, add {B}{B}{B}.
export const DarkPetition = createCardDefinition({
  name: "Dark Petition",
  spellEffect: (game) => {
    // Check spell mastery
    const gy = game.state.player.graveyard;
    const instantOrSorceryCount = gy.filter(c => {
      const type = (c.metadata.typeLine || "").toLowerCase();
      return type.includes("instant") || type.includes("sorcery");
    }).length;

    const lib = game.state.player.library;
    // Prefer Approach of the Second Sun or Emergent Ultimatum
    let idx = lib.findIndex(c => c.name.includes("Approach of the Second Sun"));
    if (idx === -1) idx = lib.findIndex(c => c.name.includes("Emergent Ultimatum"));
    if (idx === -1 && lib.length > 0) idx = lib.length - 1;

    if (idx !== -1) {
      const card = lib.splice(idx, 1)[0];
      const fresh = card.movedTo(ZONES.HAND);
      game.zoneManager.add(fresh, ZONES.HAND);
      game.syncZoneReferences();
      game.log(`《闇の誓願》: ライブラリーから《${fresh.name}》を手札に加えました。`, "action");
    }

    game.shuffleLibrary();

    if (instantOrSorceryCount >= 2) {
      game.state.player.manaPool.add("B", 3);
      game.log("魔術名声達成！ 黒マナ {B}{B}{B} を3点加えました。", "mana");
    }
  }
});

// Mastermind's Acquisition
// Choose one —
// • Search your library for a card, put it into your hand, then shuffle.
// • Put a card you own from outside the game into your hand.
export const MastermindsAcquisition = createCardDefinition({
  name: "Mastermind's Acquisition",
  spellEffect: (game) => {
    // Look in sideboard first for win-con (e.g. Approach of the Second Sun)
    const sb = game.state.player.sideboard;
    const approachInSb = sb.find(c => c.name.includes("Approach of the Second Sun"));

    if (approachInSb) {
      game.zoneManager.remove(approachInSb.instanceId);
      const fresh = approachInSb.movedTo(ZONES.HAND);
      game.zoneManager.add(fresh, ZONES.HAND);
      game.syncZoneReferences();
      game.log(`《首謀者の収得》: サイドボード（ゲーム外）から《${fresh.name}》を手札に加えました！`, "action");
    } else {
      // Search library
      const lib = game.state.player.library;
      if (lib.length > 0) {
        const card = lib.pop();
        const fresh = card.movedTo(ZONES.HAND);
        game.zoneManager.add(fresh, ZONES.HAND);
        game.syncZoneReferences();
        game.shuffleLibrary();
        game.log(`《首謀者の収得》: ライブラリーから《${fresh.name}》を手札に加えました。`, "action");
      }
    }
  }
});
