// cards.test.js - Individual card mechanics tests

import { Game } from "../../js/engine/game.js";
import { cardRegistry } from "../../js/cards/registry.js";
import { ZONES } from "../../js/engine/zones.js";
import { Actions } from "../../js/engine/actions.js";

export function runCardTests(assert) {
  // 1. Tolarian Academy
  {
    const game = new Game({ seed: 101, cardRegistry });
    game.practiceAddCard("Tolarian Academy", ZONES.BATTLEFIELD);
    game.practiceAddCard("Lotus Petal", ZONES.BATTLEFIELD);
    game.practiceAddCard("Mana Vault", ZONES.BATTLEFIELD);
    game.practiceAddCard("Voltaic Key", ZONES.BATTLEFIELD);

    const academy = game.state.player.battlefield.find(c => c.name === "Tolarian Academy");
    // Trigger mana ability
    academy.cardDef.manaAbilities[0].effect(game, academy);
    assert.equal(game.state.player.manaPool.U, 3, "アーティファクト3枚存在時にTolarian Academyから青3マナ生成");
  }

  // 2. Mind Over Matter
  {
    const game = new Game({ seed: 102, cardRegistry });
    game.practiceAddCard("Mind Over Matter", ZONES.BATTLEFIELD);
    game.practiceAddCard("Tolarian Academy", ZONES.BATTLEFIELD);
    game.practiceAddCard("Island", ZONES.HAND);

    const academy = game.state.player.battlefield.find(c => c.name === "Tolarian Academy");
    academy.tapped = true; // start tapped

    const mom = game.state.player.battlefield.find(c => c.name === "Mind Over Matter");
    const ability = mom.cardDef.activatedAbilities[0];

    // Activate: discard Island, untap Tolarian Academy
    const handCard = game.state.player.hand[0];
    game.playerDiscard(handCard.instanceId);
    ability.effect(game, mom, [{ type: "card", id: academy.instanceId }], { action: "untap" });

    assert.notOk(academy.tapped, "《精神力》の効果により《トレイリアのアカデミー》がアンタップされること");
    assert.equal(game.state.player.hand.length, 0, "手札を1枚消費していること");
  }

  // 3. Time Spiral
  {
    const game = new Game({ seed: 103, cardRegistry });
    // Add library cards so player can draw 7
    for (let i = 0; i < 15; i++) {
      game.practiceAddCard("Island", ZONES.LIBRARY);
    }
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Mana Vault", ZONES.GRAVEYARD);
    game.practiceAddCard("Island", ZONES.BATTLEFIELD);
    game.practiceAddCard("Island", ZONES.BATTLEFIELD);
    // Tap the two lands
    game.state.player.battlefield.forEach(c => c.tapped = true);

    game.practiceAddCard("Time Spiral", ZONES.STACK);
    const spiral = game.zoneManager.get(ZONES.STACK)[0];

    // Execute Time Spiral
    spiral.cardDef.spellEffect(game, { sourceCard: spiral });

    const exiledSpiral = game.state.player.exile.find(c => c.name === "Time Spiral");
    assert.ok(exiledSpiral, "《時のらせん》自身が追放領域に移動すること");
    assert.equal(game.state.player.hand.length, 7, "各プレイヤーが7枚ドローすること");
    const untappedLands = game.state.player.battlefield.filter(c => !c.tapped);
    assert.equal(untappedLands.length, 2, "土地がアンタップされること");
  }

  // 4. Windfall
  {
    const game = new Game({ seed: 104, cardRegistry });
    for (let i = 0; i < 15; i++) {
      game.practiceAddCard("Island", ZONES.LIBRARY);
    }
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Island", ZONES.HAND); // 3 in hand
    // Opponent has 7 in hand by default

    const windfall = cardRegistry.get("Windfall");
    windfall.spellEffect(game);

    assert.equal(game.state.player.hand.length, 7, "対戦相手の7枚（最大値）を参照して7枚ドローすること");
  }

  // 5. Stroke of Genius
  {
    const game = new Game({ seed: 105, cardRegistry });
    game.state.opponent.library = game.state.opponent.library.slice(0, 10); // 10 cards left

    const stroke = cardRegistry.get("Stroke of Genius");
    // Cast Stroke with X=15 targeting opponent
    stroke.spellEffect(game, {
      xValue: 15,
      targets: [{ id: "opponent", type: "player" }]
    });

    assert.ok(game.state.opponent.hasLost, "残り10枚の対戦相手にX=15でStrokeを撃つとライブラリーアウトで敗北すること");
    assert.ok(game.state.player.hasWon, "対戦相手のライブラリーアウトによりプレイヤーが勝利すること");
  }

  // 6. Lotus Field
  {
    const game = new Game({ seed: 106, cardRegistry });
    game.practiceAddCard("Forest", ZONES.BATTLEFIELD);
    game.practiceAddCard("Island", ZONES.BATTLEFIELD);

    // Play Lotus Field
    game.practiceAddCard("Lotus Field", ZONES.HAND);
    const lfHand = game.state.player.hand[0];
    const res = Actions.playLand(game, lfHand.instanceId);

    assert.ok(res.success, "Lotus Fieldのプレイ成功");
    const lfBf = game.state.player.battlefield.find(c => c.name === "Lotus Field");
    assert.ok(lfBf.tapped, "Lotus Fieldがタップ状態で戦場に出ること");

    // The two previous lands should be sacrificed
    assert.equal(game.state.player.battlefield.length, 1, "土地2枚が生け贄に捧げられLotus Fieldのみ残ること");
    assert.equal(game.state.player.graveyard.length, 2, "生け贄に捧げられた土地が墓地にあること");

    // Untap and test mana ability
    lfBf.tapped = false;
    lfBf.cardDef.manaAbilities[0].effect(game, lfBf, [], { color: "U" });
    assert.equal(game.state.player.manaPool.U, 3, "Lotus Fieldから青3マナが生成されること");
  }

  // 7. Thespian's Stage copying Lotus Field
  {
    const game = new Game({ seed: 107, cardRegistry });
    game.practiceAddCard("Lotus Field", ZONES.BATTLEFIELD);
    game.practiceAddCard("Thespian's Stage", ZONES.BATTLEFIELD);

    const stage = game.state.player.battlefield.find(c => c.name === "Thespian's Stage");
    const copyAbility = stage.cardDef.activatedAbilities[0];

    // Activate copy
    copyAbility.effect(game, stage, []);

    assert.equal(stage.name, "Lotus Field", "演劇の舞台がLotus Fieldのコピーになること");
    assert.equal(game.state.player.battlefield.length, 2, "戦場に出直したわけではないため土地の生け贄は誘発しないこと");
  }

  // 8. Hidden Strings & Pore Over the Pages
  {
    const game = new Game({ seed: 108, cardRegistry });
    game.practiceAddCard("Lotus Field", ZONES.BATTLEFIELD);
    game.practiceAddCard("Thespian's Stage", ZONES.BATTLEFIELD);
    game.state.player.battlefield.forEach(c => c.tapped = true);

    const hidden = cardRegistry.get("Hidden Strings");
    hidden.spellEffect(game, {});

    const untapped = game.state.player.battlefield.filter(c => !c.tapped);
    assert.equal(untapped.length, 2, "《見えざる糸》で土地2枚がアンタップされること");
  }

  // 9. Approach of the Second Sun
  {
    const game = new Game({ seed: 109, cardRegistry });
    const approach = cardRegistry.get("Approach of the Second Sun");

    // First cast
    game.state.player.spellsCastHistory.push({ name: "Approach of the Second Sun", fromHand: true });
    approach.spellEffect(game, { sourceCard: { instanceId: "app_1", movedTo: () => ({ instanceId: "app_fresh" }) } });
    assert.equal(game.state.player.life, 27, "1回目のキャストで7点ライフゲイン");
    assert.notOk(game.state.player.hasWon, "1回目のキャストでは勝利しないこと");

    // Second cast
    game.state.player.spellsCastHistory.push({ name: "Approach of the Second Sun", fromHand: true });
    approach.spellEffect(game, { sourceCard: { instanceId: "app_2" } });
    assert.ok(game.state.player.hasWon, "2回目のキャストで特殊勝利が成立すること！");
  }

  // 10. Impulse
  {
    const game = new Game({ seed: 110, cardRegistry });
    game.practiceAddCard("Island", ZONES.LIBRARY);
    game.practiceAddCard("Forest", ZONES.LIBRARY);
    game.practiceAddCard("Lotus Field", ZONES.LIBRARY);
    game.practiceAddCard("Hidden Strings", ZONES.LIBRARY);

    const impulse = cardRegistry.get("Impulse");
    impulse.spellEffect(game);

    assert.equal(game.state.player.hand.length, 1, "《衝動》により手札に1枚加わること");
    assert.equal(game.state.player.hand[0].name, "Lotus Field", "《衝動》の優先度選択により上位カード《Lotus Field》が手札に加わること");
    assert.equal(game.state.player.library.length, 3, "残りの3枚がライブラリーボトムへ戻ること");
  }
}
