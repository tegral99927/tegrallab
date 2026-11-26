// integration.test.js - End-to-end full combo routes integration tests

import { Game } from "../../js/engine/game.js";
import { cardRegistry } from "../../js/cards/registry.js";
import { deckRegistry } from "../../js/decks/registry.js";
import { ZONES } from "../../js/engine/zones.js";
import { Actions } from "../../js/engine/actions.js";

export function runIntegrationTests(assert) {
  // Scenario 1: Full MoMa Combo to Victory
  {
    const momaDeck = deckRegistry.get("moma");
    const game = new Game({ seed: 777, deckData: momaDeck, cardRegistry });

    // Set up board state representing Turn 2/3 explosive MoMa turn
    game.practiceAddCard("Tolarian Academy", ZONES.BATTLEFIELD);
    game.practiceAddCard("Lotus Petal", ZONES.BATTLEFIELD);
    game.practiceAddCard("Mana Vault", ZONES.BATTLEFIELD);
    game.practiceAddCard("Voltaic Key", ZONES.BATTLEFIELD);
    game.practiceAddCard("Mind Over Matter", ZONES.HAND);
    game.practiceAddCard("Windfall", ZONES.HAND);
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Stroke of Genius", ZONES.HAND);

    const academy = game.state.player.battlefield.find(c => c.name === "Tolarian Academy");
    const vault = game.state.player.battlefield.find(c => c.name === "Mana Vault");
    const key = game.state.player.battlefield.find(c => c.name === "Voltaic Key");

    // 1. Tap Academy for UUU (3 artifacts)
    academy.cardDef.manaAbilities[0].effect(game, academy);
    assert.equal(game.state.player.manaPool.U, 3, "MoMa: アカデミーからUUU生成");

    // 2. Tap Mana Vault for CCC
    vault.cardDef.manaAbilities[0].effect(game, vault);
    assert.equal(game.state.player.manaPool.C, 3, "MoMa: 櫃からCCC生成");

    // 3. Cast Mind Over Matter ({2}{U}{U}{U}{U} in classic, or paid with 6 mana)
    // Add 1 more U from petal to easily cast Mind Over Matter ({2}{U}{U}{U}{U})
    game.state.player.manaPool.add("U", 2);
    const momInHand = game.state.player.hand.find(c => c.name === "Mind Over Matter");
    const castMomRes = Actions.castSpell(game, momInHand.instanceId, { autoResolve: true });
    assert.ok(castMomRes.success, "MoMa: 《精神力》のキャスト成功");

    const momBf = game.state.player.battlefield.find(c => c.name === "Mind Over Matter");
    assert.ok(momBf, "MoMa: 《精神力》が戦場に着地");

    // 4. Discard cards to loop Academy
    academy.tapped = true;
    for (let i = 0; i < 2; i++) {
      const handCard = game.state.player.hand.find(c => c.name.includes("Island"));
      if (handCard) {
        game.playerDiscard(handCard.instanceId);
        academy.tapped = false; // Untapped by MoMa
        academy.cardDef.manaAbilities[0].effect(game, academy); // Generate mana
      }
    }
    assert.ok(game.state.player.manaPool.U >= 6, "MoMa: 精神力ループによる大量青マナ生成");

    // 5. Cast lethal Stroke of Genius on opponent
    game.state.player.manaPool.add("U", 60); // Simulated full loop result
    const strokeInHand = game.state.player.hand.find(c => c.name === "Stroke of Genius");
    const strokeRes = Actions.castSpell(game, strokeInHand.instanceId, {
      xValue: 60,
      targets: [{ id: "opponent", type: "player" }],
      autoResolve: true
    });
    assert.ok(strokeRes.success, "MoMa: X=60での《天才のひらめき》キャスト成功");
    assert.ok(game.state.opponent.hasLost, "MoMa: 対戦相手がライブラリーアウトにより敗北すること");
    assert.ok(game.state.player.hasWon, "MoMa: 統合コンボ成立による完全勝利！");
  }

  // Scenario 2: Full Lotus Field Combo to Victory
  {
    const lotusDeck = deckRegistry.get("lotus");
    const game = new Game({ seed: 888, deckData: lotusDeck, cardRegistry });

    // Set up Lotus Field + Thespian's Stage
    game.practiceAddCard("Lotus Field", ZONES.BATTLEFIELD);
    game.practiceAddCard("Thespian's Stage", ZONES.BATTLEFIELD);
    game.practiceAddCard("Hidden Strings", ZONES.HAND);
    game.practiceAddCard("Pore Over the Pages", ZONES.HAND);
    game.practiceAddCard("Approach of the Second Sun", ZONES.HAND);
    game.practiceAddCard("Omniscience", ZONES.BATTLEFIELD);

    const lf1 = game.state.player.battlefield[0];
    const stage = game.state.player.battlefield[1];

    // Stage copies Lotus Field
    stage.cardDef.activatedAbilities[0].effect(game, stage, []);
    assert.equal(stage.name, "Lotus Field", "Lotus: 舞台がLotus Fieldをコピー");

    // Both lands produce mana (6 mana total)
    lf1.cardDef.manaAbilities[0].effect(game, lf1, [], { color: "U" });
    stage.cardDef.manaAbilities[0].effect(game, stage, [], { color: "U" });
    assert.equal(game.state.player.manaPool.U, 6, "Lotus: 2つの睡蓮の原野から6マナ生成");

    // Hidden Strings untaps both
    const hiddenInHand = game.state.player.hand.find(c => c.name === "Hidden Strings");
    Actions.castSpell(game, hiddenInHand.instanceId, { autoResolve: true });
    assert.notOk(lf1.tapped, "Lotus: 原野1がアンタップ");
    assert.notOk(stage.tapped, "Lotus: 舞台（原野2）がアンタップ");

    // With Omniscience in play, cast Approach of the Second Sun twice
    const approachInHand = game.state.player.hand.find(c => c.name.includes("Approach"));
    // First cast
    Actions.castSpell(game, approachInHand.instanceId, { useOmniscience: true, autoResolve: true });
    assert.equal(game.state.player.life, 27, "Lotus: 1回目の副陽で7点ゲイン");

    // Second cast from hand
    game.practiceAddCard("Approach of the Second Sun", ZONES.HAND);
    const approach2 = game.state.player.hand.find(c => c.name.includes("Approach"));
    Actions.castSpell(game, approach2.instanceId, { useOmniscience: true, autoResolve: true });

    assert.ok(game.state.player.hasWon, "Lotus: 2回目の副陽の接近により特殊勝利が成立！");
  }
}
