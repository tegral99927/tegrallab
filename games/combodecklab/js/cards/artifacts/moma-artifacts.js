// moma-artifacts.js - Artifacts for MoMa

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Lotus Petal
// {T}, Sacrifice Lotus Petal: Add one mana of any color.
export const LotusPetal = createCardDefinition({
  name: "Lotus Petal",
  manaAbilities: [
    {
      name: "ペタルのマナ能力",
      cost: { tap: true, sacrificeSelf: true },
      isManaAbility: true,
      description: "{T}, 水蓮の花びらを生け贄に捧げる: 好きな色1色のマナ1点を加える。",
      effect: (game, sourceCard, targets, options = {}) => {
        const color = options.color || "U";
        game.state.player.manaPool.add(color, 1);
        game.log(`《水蓮の花びら》を生け贄に捧げ、{${color}} を1点加えました。`, "mana");
      }
    }
  ]
});

// Mana Vault
// Mana Vault doesn't untap during your untap step.
// {T}: Add {C}{C}{C}.
export const ManaVault = createCardDefinition({
  name: "Mana Vault",
  doesNotUntapDuringUntapStep: true,
  manaAbilities: [
    {
      name: "魔力の櫃のマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {C}{C}{C}を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("C", 3);
        game.log("《魔力の櫃》から {C}{C}{C} を加えました。", "mana");
      }
    }
  ],
  activatedAbilities: [
    {
      name: "アップキープ時のアンタップ",
      cost: { mana: "{4}" },
      isManaAbility: false,
      description: "{4}: 魔力の櫃をアンタップする。（あなたのアップキープにのみ起動できる）",
      effect: (game, sourceCard) => {
        sourceCard.tapped = false;
        game.log("《魔力の櫃》をアンタップしました。", "action");
      }
    }
  ]
});

// Mox Diamond
// If Mox Diamond would enter the battlefield, you may discard a land card instead. If you do, put Mox Diamond onto the battlefield. If you don't, put it into its owner's graveyard.
// {T}: Add one mana of any color.
export const MoxDiamond = createCardDefinition({
  name: "Mox Diamond",
  etbTrigger: (game, sourceCard) => {
    // Look for a land in hand to discard
    const landInHand = game.state.player.hand.find(c => (c.metadata.typeLine || "").toLowerCase().includes("land"));
    if (landInHand) {
      game.playerDiscard(landInHand.instanceId);
      game.log(`《モックス・ダイアモンド》のETB効果により、手札から土地《${landInHand.name}》を捨てました。`, "action");
    } else {
      game.moveCard(sourceCard.instanceId, ZONES.GRAVEYARD);
      game.log("《モックス・ダイアモンド》: 手札に土地カードがないため、墓地に置かれました。", "warning");
    }
  },
  manaAbilities: [
    {
      name: "モックスのマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 好きな色1色のマナ1点を加える。",
      effect: (game, sourceCard, targets, options = {}) => {
        const color = options.color || "U";
        game.state.player.manaPool.add(color, 1);
        game.log(`《モックス・ダイアモンド》から {${color}} を1点加えました。`, "mana");
      }
    }
  ]
});

// Voltaic Key
// {1}, {T}: Untap target artifact.
export const VoltaicKey = createCardDefinition({
  name: "Voltaic Key",
  activatedAbilities: [
    {
      name: "キーのアンタップ能力",
      cost: { mana: "{1}", tap: true },
      isManaAbility: false,
      description: "{1}, {T}: 対象のアーティファクト1つをアンタップする。",
      effect: (game, sourceCard, targets) => {
        let targetCard = null;
        if (targets && targets.length > 0 && targets[0].type === "card") {
          targetCard = game.findCard(targets[0].id);
        } else {
          // Default: Untap tapped artifact with highest priority (Mana Vault, etc.)
          targetCard = game.state.player.battlefield.find(c => {
            const isArt = (c.metadata.typeLine || "").toLowerCase().includes("artifact");
            return isArt && c.tapped && c.instanceId !== sourceCard.instanceId;
          });
        }

        if (targetCard) {
          targetCard.tapped = false;
          game.log(`《通電式キー》の効果により、アーティファクト《${targetCard.name}》をアンタップしました。`, "action");
        } else {
          game.log("《通電式キー》: アンタップ対象のアーティファクトがありません。", "warning");
        }
      }
    }
  ]
});

// Scroll Rack
// {1}, {T}: Exile any number of cards from your hand face down. Put that many cards from the top of your library into your hand. Then look at the exiled cards and put them on top of your library in any order.
export const ScrollRack = createCardDefinition({
  name: "Scroll Rack",
  activatedAbilities: [
    {
      name: "巻物棚の入替能力",
      cost: { mana: "{1}", tap: true },
      isManaAbility: false,
      description: "{1}, {T}: 手札のカードを任意の枚数ライブラリートップと入れ替える。",
      effect: (game) => {
        const hand = [...game.state.player.hand];
        const swapCount = Math.min(hand.length, 3); // Swap up to 3 cards
        if (swapCount === 0) return;

        const drawn = [];
        for (let i = 0; i < swapCount; i++) {
          if (game.state.player.library.length > 0) {
            const c = game.state.player.library.pop();
            const fresh = c.movedTo(ZONES.HAND);
            game.zoneManager.add(fresh, ZONES.HAND);
            drawn.push(fresh);
          }
        }

        for (let i = 0; i < drawn.length; i++) {
          const toPut = hand[i];
          game.zoneManager.remove(toPut.instanceId);
          const fresh = toPut.movedTo(ZONES.LIBRARY);
          game.zoneManager.add(fresh, ZONES.LIBRARY, "top");
        }

        game.syncZoneReferences();
        game.log(`《巻物棚》により手札とライブラリーのカード ${drawn.length} 枚を入れ替えました。`, "action");
      }
    }
  ]
});
