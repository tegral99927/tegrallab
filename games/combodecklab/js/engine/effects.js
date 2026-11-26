// effects.js - Reusable effect execution primitives

import { ZONES } from "./zones.js";

export const Effects = {
  // Draw cards
  draw(game, targetPlayer = "player", count = 1) {
    if (targetPlayer === "player") {
      return game.playerDraw(count);
    } else {
      const drawn = game.state.opponent.draw(count);
      game.log(`対戦相手がカードを ${drawn.length} 枚引きました。（残り ${game.state.opponent.library.length} 枚）`, "info");
      game.checkStateBasedActions();
      return drawn;
    }
  },

  // Discard cards
  discard(game, targetPlayer = "player", count = 1, cardIds = null) {
    if (targetPlayer === "player") {
      if (cardIds && cardIds.length > 0) {
        for (const id of cardIds) {
          game.playerDiscard(id);
        }
      } else {
        const hand = [...game.state.player.hand];
        for (let i = 0; i < Math.min(count, hand.length); i++) {
          game.playerDiscard(hand[i].instanceId);
        }
      }
    } else {
      const discarded = game.state.opponent.discardAll();
      game.log(`対戦相手が手札をすべて（${discarded}枚）捨てました。`, "info");
    }
  },

  // Tap or untap permanents
  untap(game, cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    const untappedCards = [];
    for (const id of ids) {
      const card = game.findCard(id);
      if (card && card.zone === ZONES.BATTLEFIELD) {
        card.tapped = false;
        untappedCards.push(card);
        game.log(`《${card.name}》をアンタップしました。`, "action");
      }
    }
    return untappedCards;
  },

  tap(game, cardIds) {
    const ids = Array.isArray(cardIds) ? cardIds : [cardIds];
    const tappedCards = [];
    for (const id of ids) {
      const card = game.findCard(id);
      if (card && card.zone === ZONES.BATTLEFIELD) {
        card.tapped = true;
        tappedCards.push(card);
        game.log(`《${card.name}》をタップしました。`, "action");
      }
    }
    return tappedCards;
  },

  // Search library for card matching filter
  searchLibrary(game, filterFn, destinationZone = ZONES.HAND) {
    const library = game.state.player.library;
    const matches = library.filter(filterFn);
    return matches;
  },

  // Return card from graveyard
  returnFromGraveyard(game, cardId, toZone = ZONES.HAND) {
    const card = game.findCard(cardId);
    if (card && card.zone === ZONES.GRAVEYARD) {
      const moved = game.moveCard(cardId, toZone);
      game.log(`墓地から《${moved.name}》を${toZone === ZONES.HAND ? "手札へ戻しました" : "戦場に出しました"}。`, "action");
      return moved;
    }
    return null;
  }
};
