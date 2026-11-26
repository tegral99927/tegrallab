// state.js - GameState snapshot and serialization

import { deepClone } from "../utils/helpers.js";

export class GameState {
  constructor(player, opponent, zoneManager, turnManager, prng) {
    this.player = player;
    this.opponent = opponent;
    this.zoneManager = zoneManager;
    this.turn = turnManager;
    this.prng = prng;
    this.undoUsed = false;
  }

  // Creates a complete serializable snapshot of the current state
  createSnapshot() {
    return {
      player: {
        life: this.player.life,
        manaPool: this.player.manaPool.toObject(),
        landsPlayedThisTurn: this.player.landsPlayedThisTurn,
        maxLandPlaysThisTurn: this.player.maxLandPlaysThisTurn,
        spellsCastThisTurn: this.player.spellsCastThisTurn,
        spellsCastHistory: deepClone(this.player.spellsCastHistory),
        cardsDrawnThisTurn: this.player.cardsDrawnThisTurn,
        mulligansCount: this.player.mulligansCount,
        isPlayFirst: this.player.isPlayFirst,
        hasWon: this.player.hasWon,
        hasLost: this.player.hasLost,
        lossReason: this.player.lossReason,
        winReason: this.player.winReason
      },
      opponent: {
        life: this.opponent.life,
        hasLost: this.opponent.hasLost,
        lossReason: this.opponent.lossReason,
        libraryCount: this.opponent.library.length,
        handCount: this.opponent.hand.length,
        graveyardCount: this.opponent.graveyard.length,
        battlefieldCount: this.opponent.battlefield.length
      },
      zones: {
        library: deepClone(this.zoneManager.get("library")),
        hand: deepClone(this.zoneManager.get("hand")),
        battlefield: deepClone(this.zoneManager.get("battlefield")),
        graveyard: deepClone(this.zoneManager.get("graveyard")),
        exile: deepClone(this.zoneManager.get("exile")),
        stack: deepClone(this.zoneManager.get("stack")),
        sideboard: deepClone(this.zoneManager.get("sideboard")),
        outside: deepClone(this.zoneManager.get("outside"))
      },
      turn: {
        turnNumber: this.turn.turnNumber,
        currentPhase: this.turn.currentPhase,
        activePlayer: this.turn.activePlayer
      },
      prng: this.prng.getState(),
      undoUsed: this.undoUsed
    };
  }

  // Restore game state from snapshot
  restoreSnapshot(game, snapshot) {
    // Player
    game.state.player.life = snapshot.player.life;
    Object.assign(game.state.player.manaPool, snapshot.player.manaPool);
    game.state.player.landsPlayedThisTurn = snapshot.player.landsPlayedThisTurn;
    game.state.player.maxLandPlaysThisTurn = snapshot.player.maxLandPlaysThisTurn;
    game.state.player.spellsCastThisTurn = snapshot.player.spellsCastThisTurn;
    game.state.player.spellsCastHistory = deepClone(snapshot.player.spellsCastHistory);
    game.state.player.cardsDrawnThisTurn = snapshot.player.cardsDrawnThisTurn;
    game.state.player.mulligansCount = snapshot.player.mulligansCount;
    game.state.player.isPlayFirst = snapshot.player.isPlayFirst;
    game.state.player.hasWon = snapshot.player.hasWon;
    game.state.player.hasLost = snapshot.player.hasLost;
    game.state.player.lossReason = snapshot.player.lossReason;
    game.state.player.winReason = snapshot.player.winReason;

    // Opponent
    game.state.opponent.life = snapshot.opponent.life;
    game.state.opponent.hasLost = snapshot.opponent.hasLost;
    game.state.opponent.lossReason = snapshot.opponent.lossReason;
    // Re-adjust opponent virtual counts if changed
    if (snapshot.opponent.libraryCount !== game.state.opponent.library.length) {
      game.state.opponent.initDeck(snapshot.opponent.libraryCount + snapshot.opponent.handCount);
    }

    // Zones
    for (const [zoneName, cardList] of Object.entries(snapshot.zones)) {
      game.zoneManager.zones[zoneName] = deepClone(cardList);
      // Link card definitions back to card instances
      for (const card of game.zoneManager.zones[zoneName]) {
        if (game.cardRegistry) {
          card.cardDef = game.cardRegistry.get(card.name);
        }
      }
    }

    // Update player zone references
    game.state.player.library = game.zoneManager.get("library");
    game.state.player.hand = game.zoneManager.get("hand");
    game.state.player.battlefield = game.zoneManager.get("battlefield");
    game.state.player.graveyard = game.zoneManager.get("graveyard");
    game.state.player.exile = game.zoneManager.get("exile");
    game.state.player.sideboard = game.zoneManager.get("sideboard");

    // Turn
    game.turn.turnNumber = snapshot.turn.turnNumber;
    game.turn.currentPhase = snapshot.turn.currentPhase;
    game.turn.activePlayer = snapshot.turn.activePlayer;

    // PRNG
    game.prng.restoreState(snapshot.prng);
    game.state.undoUsed = true;
  }
}
