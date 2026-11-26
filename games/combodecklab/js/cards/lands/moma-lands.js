// moma-lands.js - Lands for MoMa

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Tolarian Academy
// {T}: Add {U} for each artifact you control.
export const TolarianAcademy = createCardDefinition({
  name: "Tolarian Academy",
  oracleId: "00000000-0000-0000-0000-000000000001",
  manaAbilities: [
    {
      name: "アカデミーのマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: あなたがコントロールするアーティファクト1つにつき{U}を加える。",
      effect: (game, sourceCard) => {
        // Count artifacts on battlefield
        const bf = game.state.player.battlefield;
        let count = 0;
        for (const c of bf) {
          const typeLine = (c.metadata.typeLine || "").toLowerCase();
          if (typeLine.includes("artifact")) {
            count++;
          }
        }
        game.state.player.manaPool.add("U", count);
        game.log(`《トレイリアのアカデミー》から青マナ {U} を ${count} 点加えました。（アーティファクト数: ${count}）`, "mana");
      }
    }
  ]
});

// Ancient Tomb
// {T}: Add {C}{C}. Ancient Tomb deals 2 damage to you.
export const AncientTomb = createCardDefinition({
  name: "Ancient Tomb",
  manaAbilities: [
    {
      name: "墳墓のマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {C}{C}を加える。古えの墳墓はあなたに2点のダメージを与える。",
      effect: (game, sourceCard) => {
        game.state.player.manaPool.add("C", 2);
        game.state.player.life -= 2;
        game.log("《古えの墳墓》から {C}{C} を加え、2点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    }
  ]
});

// Island
// {T}: Add {U}.
export const Island = createCardDefinition({
  name: "Island",
  manaAbilities: [
    {
      name: "島の基本マナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {U}を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("U", 1);
        game.log("《島》から {U} を1点加えました。", "mana");
      }
    }
  ]
});

// City of Brass
export const CityOfBrass = createCardDefinition({
  name: "City of Brass",
  manaAbilities: [
    {
      name: "青マナ {U} (1点ダメージ)",
      color: "U",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {U} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("U", 1);
        game.state.player.life -= 1;
        game.log("《真鍮の都》から青マナ {U} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "緑マナ {G} (1点ダメージ)",
      color: "G",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {G} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 1);
        game.state.player.life -= 1;
        game.log("《真鍮の都》から緑マナ {G} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "黒マナ {B} (1点ダメージ)",
      color: "B",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {B} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("B", 1);
        game.state.player.life -= 1;
        game.log("《真鍮の都》から黒マナ {B} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "白マナ {W} (1点ダメージ)",
      color: "W",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {W} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("W", 1);
        game.state.player.life -= 1;
        game.log("《真鍮の都》から白マナ {W} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "赤マナ {R} (1点ダメージ)",
      color: "R",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {R} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("R", 1);
        game.state.player.life -= 1;
        game.log("《真鍮の都》から赤マナ {R} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    }
  ]
});
