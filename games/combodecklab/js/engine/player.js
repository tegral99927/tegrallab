// player.js - Player state model

import { ManaPool } from "./mana.js";

export class Player {
  constructor() {
    this.life = 20;
    this.manaPool = new ManaPool();
    this.library = [];
    this.hand = [];
    this.battlefield = [];
    this.graveyard = [];
    this.exile = [];
    this.sideboard = [];

    // Turn tracking
    this.landsPlayedThisTurn = 0;
    this.maxLandPlaysThisTurn = 1;
    this.spellsCastThisTurn = 0;
    this.spellsCastHistory = []; // list of { name, cardId, turn, fromHand }
    this.cardsDrawnThisTurn = 0;
    this.mulligansCount = 0;
    this.isPlayFirst = true;

    // Victory/Loss
    this.hasWon = false;
    this.hasLost = false;
    this.lossReason = null;
    this.winReason = null;
  }
}
