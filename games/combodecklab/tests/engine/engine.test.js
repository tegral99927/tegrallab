// engine.test.js - Common game engine tests

import { PRNG } from "../../js/engine/random.js";
import { Game } from "../../js/engine/game.js";
import { ZONES } from "../../js/engine/zones.js";
import { parseManaCost, canPayManaCost, payManaCost, ManaPool } from "../../js/engine/mana.js";
import { Rules } from "../../js/engine/rules.js";
import { Actions } from "../../js/engine/actions.js";

export function runEngineTests(assert) {
  // Test 1: PRNG Shuffle Determinism
  {
    const seed = 12345;
    const prng1 = new PRNG(seed);
    const prng2 = new PRNG(seed);
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    prng1.shuffle(arr1);
    prng2.shuffle(arr2);

    assert.deepEqual(arr1, arr2, "同一シードによるFisher-Yatesシャッフルの完全な決定論的一致");

    // Different seed produces different shuffle
    const prng3 = new PRNG(99999);
    const arr3 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    prng3.shuffle(arr3);
    assert.notDeepEqual(arr1, arr3, "異なるシードでは異なるシャッフル結果が得られること");
  }

  // Test 2: Mana parsing and payment logic
  {
    const pool = new ManaPool({ U: 2, C: 2, R: 1 });
    const cost1 = parseManaCost("{2}{U}{U}");
    assert.equal(cost1.generic, 2, "マナコスト不特定マナパース");
    assert.equal(cost1.U, 2, "マナコスト色マナパース");

    assert.ok(canPayManaCost(pool, cost1), "マナプールに十分なマナがある場合の支払い検証");

    // Pay cost
    const paid = payManaCost(pool, cost1);
    assert.ok(paid, "コスト支払い成功");
    assert.equal(pool.U, 0, "支払い後の青マナプール減少");
    assert.equal(pool.C, 0, "無色マナCが優先して不特定マナ支払いに充当されること");
    assert.equal(pool.R, 1, "無関係な赤マナが保持されること");

    // Fail payment if insufficient
    const cost2 = parseManaCost("{3}{G}");
    assert.notOk(canPayManaCost(pool, cost2), "不足マナの支払い判定がfalseを返すこと");
  }

  // Test 3: Zone movement and card recreation
  {
    const game = new Game({ seed: 100 });
    game.practiceAddCard("Test Card", ZONES.HAND);
    const handCard = game.state.player.hand[0];
    const originalId = handCard.instanceId;

    // Move to battlefield
    const bfCard = game.moveCard(originalId, ZONES.BATTLEFIELD);
    assert.equal(bfCard.zone, ZONES.BATTLEFIELD, "戦場への領域移動");
    assert.notEqual(bfCard.instanceId, originalId, "CR 400.7: 領域移動時に新しいオブジェクトIDが付与されること");
    assert.equal(game.state.player.hand.length, 0, "手札から消えていること");
    assert.equal(game.state.player.battlefield.length, 1, "戦場に追加されていること");
  }

  // Test 4: Land play restriction
  {
    const game = new Game({ seed: 200 });
    game.practiceAddCard("Island", ZONES.HAND);
    game.practiceAddCard("Island", ZONES.HAND);

    const land1 = game.state.player.hand[0];
    const res1 = Actions.playLand(game, land1.instanceId);
    assert.ok(res1.success, "1枚目の土地プレイが成功すること");
    assert.equal(game.state.player.landsPlayedThisTurn, 1, "土地プレイ回数のカウント");

    const land2 = game.state.player.hand[0];
    const res2 = Actions.playLand(game, land2.instanceId);
    assert.notOk(res2.success, "同一ターン2枚目の土地プレイが制限により拒否されること");
  }

  // Test 5: Stack LIFO order and resolution
  {
    const game = new Game({ seed: 300 });
    let resolved = [];

    game.stack.push({
      name: "Spell 1",
      type: "spell",
      effect: () => resolved.push(1)
    });
    game.stack.push({
      name: "Spell 2",
      type: "spell",
      effect: () => resolved.push(2)
    });

    game.resolveStack();
    assert.deepEqual(resolved, [2], "スタック先頭（後入れ）のSpell 2が先に解決されること (LIFO)");

    game.resolveStack();
    assert.deepEqual(resolved, [2, 1], "スタックの残りが順次解決されること");
    assert.ok(game.stack.isEmpty(), "全解決後にスタックが空になること");
  }

  // Test 6: Undo / Redo state preservation
  {
    const game = new Game({ seed: 400 });
    game.practiceAddMana("U", 3);
    const initialCalls = game.prng.calls;

    // Next action
    game.practiceAddMana("U", 5);
    assert.equal(game.state.player.manaPool.U, 8, "マナ加算後");

    // Undo
    game.undo();
    assert.equal(game.state.player.manaPool.U, 3, "Undoによってマナプールが復元されること");

    // Redo
    game.redo();
    assert.equal(game.state.player.manaPool.U, 8, "Redoによってマナプールが再適用されること");
  }

  // Test 7: London Mulligan
  {
    const game = new Game({
      seed: 500,
      deckData: {
        mainboard: [
          { name: "Island", count: 30 },
          { name: "Tolarian Academy", count: 30 }
        ]
      }
    });

    assert.equal(game.state.player.hand.length, 7, "初期手札7枚");
    Rules.mulligan(game);
    assert.equal(game.state.player.mulligansCount, 1, "マリガン回数が1にカウント");
    assert.equal(game.state.player.hand.length, 7, "マリガン後も7枚引くこと");

    // Keep hand and return 1 card
    const cardToBottom = game.state.player.hand[0].instanceId;
    const keepRes = Rules.keepHand(game, [cardToBottom]);
    assert.ok(keepRes.success, "キープ成功");
    assert.equal(game.state.player.hand.length, 6, "マリガン1回分カードがボトムに戻り手札6枚になること");
  }

  // Test 8: Win / Loss conditions
  {
    const game = new Game({ seed: 600 });
    game.state.opponent.library = [];
    game.state.opponent.draw(1);
    game.checkStateBasedActions();
    assert.ok(game.state.opponent.hasLost, "空のライブラリーからドローで対戦相手敗北フラグ");
    assert.ok(game.state.player.hasWon, "対戦相手の敗北によりプレイヤー勝利判定");
  }
}
