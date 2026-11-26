// rules.js - MTG Rules enforcement

import { ZONES } from "./zones.js";

export const Rules = {
  // Check if player can play a land
  canPlayLand(game, card) {
    if (!game.turn.isSorceryTiming()) return false;
    if (game.state.player.landsPlayedThisTurn >= game.state.player.maxLandPlaysThisTurn) return false;
    const typeLine = (card.metadata.typeLine || "").toLowerCase();
    return typeLine.includes("land");
  },

  // Check if player can cast a spell
  canCastSpell(game, card) {
    const typeLine = (card.metadata.typeLine || "").toLowerCase();
    const isInstant = typeLine.includes("instant");
    const hasFlash = (card.metadata.oracleText || "").toLowerCase().includes("flash");

    // Timing check
    if (!isInstant && !hasFlash) {
      if (!game.turn.isSorceryTiming()) return false;
    }

    // Mana / Cost check: is there at least potential to pay?
    // In free practice or if mana allows:
    return true;
  },

  // State-Based Actions (CR 704)
  checkStateBasedActions(game) {
    let triggered = false;

    // 1. Player life <= 0
    if (game.state.player.life <= 0 && !game.state.player.hasLost) {
      game.state.player.hasLost = true;
      game.state.player.lossReason = "ライフが0以下になりました。";
      game.log("プレイヤーのライフが0以下になったため敗北しました。", "error");
      triggered = true;
    }

    // 2. Opponent life <= 0
    if (game.state.opponent.life <= 0 && !game.state.player.hasWon) {
      game.state.player.hasWon = true;
      game.state.player.winReason = "対戦相手のライフが0以下になりました。";
      game.log("対戦相手のライフが0以下になったため勝利しました！", "win");
      triggered = true;
    }

    // 3. Opponent library out flag
    if (game.state.opponent.hasLost && !game.state.player.hasWon) {
      game.state.player.hasWon = true;
      game.state.player.winReason = "対戦相手がライブラリーアウトしました（空のライブラリーからドロー）。";
      game.log("対戦相手が空のライブラリーからカードを引こうとしたため、勝利しました！", "win");
      triggered = true;
    }

    // 4. Legend Rule (CR 704.5j)
    // If a player controls two or more legendary permanents with the same name, they choose one and put the rest into graveyard
    const legendaryMap = new Map();
    const toGrave = [];

    for (const card of game.state.player.battlefield) {
      const typeLine = (card.metadata.typeLine || "").toLowerCase();
      if (typeLine.includes("legendary")) {
        const name = card.name;
        if (legendaryMap.has(name)) {
          // Already have one; the newest duplicate is put into graveyard
          toGrave.push(card);
        } else {
          legendaryMap.set(name, card);
        }
      }
    }

    for (const card of toGrave) {
      game.log(`レジェンド・ルールにより、重複した伝説のパーマネント《${card.name}》が墓地に置かれます。`, "info");
      game.moveCard(card.instanceId, ZONES.GRAVEYARD);
      triggered = true;
    }

    return triggered;
  },

  // London Mulligan:
  // Shuffle hand back to library, draw 7 cards.
  // When kept, put N cards from hand to bottom of library (where N = mulligansCount).
  mulligan(game) {
    const hand = [...game.state.player.hand];
    for (const c of hand) {
      game.moveCard(c.instanceId, ZONES.LIBRARY);
    }
    game.shuffleLibrary();

    game.state.player.mulligansCount += 1;
    game.log(`ロンドン・マリガンを実行しました（マリガン回数: ${game.state.player.mulligansCount}）。7枚引きます。`, "info");

    game.playerDraw(7, false); // Draw 7
  },

  keepHand(game, bottomCardIds = []) {
    const neededBottom = game.state.player.mulligansCount;
    if (bottomCardIds.length < neededBottom) {
      return { success: false, message: `マリガン回数分（${neededBottom}枚）のカードをライブラリーボトムへ戻してください。` };
    }

    for (const id of bottomCardIds.slice(0, neededBottom)) {
      const card = game.findCard(id);
      if (card) {
        game.log(`キープ処理: 《${card.name}》をライブラリーの一番下へ戻しました。`, "info");
        game.zoneManager.remove(id);
        const fresh = card.movedTo(ZONES.LIBRARY);
        game.zoneManager.add(fresh, ZONES.LIBRARY, "bottom");
        // Update player.library reference
        game.state.player.library = game.zoneManager.get(ZONES.LIBRARY);
        game.state.player.hand = game.zoneManager.get(ZONES.HAND);
      }
    }

    game.log("手札をキープしました。ゲームを開始します！", "success");
    return { success: true };
  }
};
