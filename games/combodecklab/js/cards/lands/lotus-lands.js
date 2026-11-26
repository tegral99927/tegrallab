// lotus-lands.js - Lands for Lotus Field Combo

import { createCardDefinition } from "../common.js";
import { ZONES } from "../../engine/zones.js";

// Lotus Field
// Hexproof. Lotus Field enters the battlefield tapped.
// When Lotus Field enters the battlefield, sacrifice two lands.
// {T}: Add three mana of any one color.
export const LotusField = createCardDefinition({
  name: "Lotus Field",
  entersTapped: true,
  hasHexproof: true,
  etbTrigger: (game, sourceCard) => {
    // Sacrifice two lands
    const lands = game.state.player.battlefield.filter(c => {
      const type = (c.metadata.typeLine || "").toLowerCase();
      return type.includes("land");
    });

    if (lands.length <= 2) {
      // Must sacrifice all available lands including Lotus Field itself if not enough
      game.log("《睡蓮の原野》のETB能力: 生け贄に捧げる土地が2枚以下のため、すべての土地（原野を含む）を生け贄に捧げます。", "warning");
      for (const l of lands) {
        game.moveCard(l.instanceId, ZONES.GRAVEYARD);
      }
    } else {
      let sacCount = 0;
      for (const l of lands) {
        if (l.instanceId !== sourceCard.instanceId && sacCount < 2) {
          game.moveCard(l.instanceId, ZONES.GRAVEYARD);
          game.log(`《睡蓮の原野》のETB能力により、《${l.name}》を生け贄に捧げました。`, "action");
          sacCount++;
        }
      }
      if (sacCount < 2) {
        game.moveCard(sourceCard.instanceId, ZONES.GRAVEYARD);
      }
    }
  },
  manaAbilities: [
    {
      name: "青マナ {U}{U}{U} を加える",
      color: "U",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 青マナ {U}{U}{U} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("U", 3);
        game.log("《睡蓮の原野》から青マナ {U}{U}{U} を加えました。", "mana");
      }
    },
    {
      name: "緑マナ {G}{G}{G} を加える",
      color: "G",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 緑マナ {G}{G}{G} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 3);
        game.log("《睡蓮の原野》から緑マナ {G}{G}{G} を加えました。", "mana");
      }
    },
    {
      name: "黒マナ {B}{B}{B} を加える",
      color: "B",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 黒マナ {B}{B}{B} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("B", 3);
        game.log("《睡蓮の原野》から黒マナ {B}{B}{B} を加えました。", "mana");
      }
    },
    {
      name: "白マナ {W}{W}{W} を加える",
      color: "W",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 白マナ {W}{W}{W} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("W", 3);
        game.log("《睡蓮の原野》から白マナ {W}{W}{W} を加えました。", "mana");
      }
    },
    {
      name: "赤マナ {R}{R}{R} を加える",
      color: "R",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: 赤マナ {R}{R}{R} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("R", 3);
        game.log("《睡蓮の原野》から赤マナ {R}{R}{R} を加えました。", "mana");
      }
    }
  ]
});

// Thespian's Stage
// {T}: Add {C}.
// {2}, {T}: Thespian's Stage becomes a copy of target land, except it has this ability.
export const ThespiansStage = createCardDefinition({
  name: "Thespian's Stage",
  manaAbilities: [
    {
      name: "無色マナ生成",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {C}を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("C", 1);
        game.log("《演劇の舞台》から {C} を1点加えました。", "mana");
      }
    }
  ],
  activatedAbilities: [
    {
      name: "土地のコピー",
      cost: { mana: "{2}", tap: true },
      isManaAbility: false,
      description: "{2}, {T}: 対象の土地1つを対象とする。演劇の舞台はその土地のコピーになり、この能力を得る。",
      effect: (game, sourceCard, targets) => {
        // Find target land on battlefield
        const target = targets && targets.length > 0 ? targets[0] : null;
        let targetCard = null;
        if (target && target.type === "card") {
          targetCard = game.findCard(target.id);
        } else {
          // Default to Lotus Field if present on battlefield
          targetCard = game.state.player.battlefield.find(c => c.name.includes("Lotus Field") && c.instanceId !== sourceCard.instanceId);
        }

        if (!targetCard) {
          game.log("《演劇の舞台》: コピー対象となる土地が存在しません。", "warning");
          return;
        }

        // Copy attributes of target land without triggering ETB (CR 707.2)
        sourceCard.copiedFrom = targetCard.name;
        sourceCard.name = targetCard.name;
        sourceCard.metadata = { ...targetCard.metadata };
        
        // Retain Thespian's Stage copy ability while adopting target's abilities
        const targetDef = targetCard.cardDef;
        sourceCard.cardDef = {
          ...targetDef,
          activatedAbilities: [
            ...(targetDef.activatedAbilities || []),
            ThespiansStage.activatedAbilities[0] // retains copy ability
          ]
        };

        game.log(`《演劇の舞台》は《${targetCard.name}》のコピーになりました！（戦場に出直したわけではないため、生け贄能力は誘発しません）`, "action");
      }
    }
  ]
});

// Botanical Sanctum
export const BotanicalSanctum = createCardDefinition({
  name: "Botanical Sanctum",
  entersTapped: false,
  manaAbilities: [
    {
      name: "緑マナ {G} を加える",
      color: "G",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {G} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 1);
        game.log("《植物の聖域》から緑マナ {G} を1点加えました。", "mana");
      }
    },
    {
      name: "青マナ {U} を加える",
      color: "U",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {U} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("U", 1);
        game.log("《植物の聖域》から青マナ {U} を1点加えました。", "mana");
      }
    }
  ]
});

// Yavimaya Coast
export const YavimayaCoast = createCardDefinition({
  name: "Yavimaya Coast",
  manaAbilities: [
    {
      name: "無色マナ {C} を加える (ダメージなし)",
      color: "C",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {C} を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("C", 1);
        game.log("《ヤヴィマヤの沿岸》から無色マナ {C} を1点加えました。", "mana");
      }
    },
    {
      name: "緑マナ {G} を加える (1点ダメージ)",
      color: "G",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {G} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 1);
        game.state.player.life -= 1;
        game.log("《ヤヴィマヤの沿岸》から緑マナ {G} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "青マナ {U} を加える (1点ダメージ)",
      color: "U",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {U} を加える。あなたに1点のダメージ。",
      effect: (game) => {
        game.state.player.manaPool.add("U", 1);
        game.state.player.life -= 1;
        game.log("《ヤヴィマヤの沿岸》から青マナ {U} を加え、1点のダメージを受けました。", "mana");
        game.checkStateBasedActions();
      }
    }
  ]
});

// Mana Confluence
export const ManaConfluence = createCardDefinition({
  name: "Mana Confluence",
  manaAbilities: [
    {
      name: "青マナ {U} (1点ライフ支払い)",
      color: "U",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}, 1点ライフ: {U} を加える。",
      effect: (game) => {
        game.state.player.life -= 1;
        game.state.player.manaPool.add("U", 1);
        game.log("《マナの合流点》から青マナ {U} を加え、1点のライフを支払いました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "緑マナ {G} (1点ライフ支払い)",
      color: "G",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}, 1点ライフ: {G} を加える。",
      effect: (game) => {
        game.state.player.life -= 1;
        game.state.player.manaPool.add("G", 1);
        game.log("《マナの合流点》から緑マナ {G} を加え、1点のライフを支払いました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "黒マナ {B} (1点ライフ支払い)",
      color: "B",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}, 1点ライフ: {B} を加える。",
      effect: (game) => {
        game.state.player.life -= 1;
        game.state.player.manaPool.add("B", 1);
        game.log("《マナの合流点》から黒マナ {B} を加え、1点のライフを支払いました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "白マナ {W} (1点ライフ支払い)",
      color: "W",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}, 1点ライフ: {W} を加える。",
      effect: (game) => {
        game.state.player.life -= 1;
        game.state.player.manaPool.add("W", 1);
        game.log("《マナの合流点》から白マナ {W} を加え、1点のライフを支払いました。", "mana");
        game.checkStateBasedActions();
      }
    },
    {
      name: "赤マナ {R} (1点ライフ支払い)",
      color: "R",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}, 1点ライフ: {R} を加える。",
      effect: (game) => {
        game.state.player.life -= 1;
        game.state.player.manaPool.add("R", 1);
        game.log("《マナの合流点》から赤マナ {R} を加え、1点のライフを支払いました。", "mana");
        game.checkStateBasedActions();
      }
    }
  ]
});

// Boseiju, Who Endures
export const BoseijuWhoEndures = createCardDefinition({
  name: "Boseiju, Who Endures",
  manaAbilities: [
    {
      name: "母聖樹のマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {G}を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 1);
        game.log("《耐え抜くもの、母聖樹》から {G} を1点加えました。", "mana");
      }
    }
  ]
});

// Forest
export const Forest = createCardDefinition({
  name: "Forest",
  manaAbilities: [
    {
      name: "森のマナ能力",
      cost: { tap: true },
      isManaAbility: true,
      description: "{T}: {G}を加える。",
      effect: (game) => {
        game.state.player.manaPool.add("G", 1);
        game.log("《森》から {G} を1点加えました。", "mana");
      }
    }
  ]
});
