// opponent.js - Goldfish opponent model

import { generateInstanceId } from "../utils/helpers.js";
import { ZONES } from "./zones.js";

export class Opponent {
  constructor() {
    this.life = 20;
    this.library = [];
    this.hand = [];
    this.battlefield = [];
    this.graveyard = [];
    this.exile = [];
    this.hasLost = false;
    this.lossReason = null;

    this.initDeck();
  }

  initDeck(cardCount = 60) {
    this.library = [];
    this.hand = [];
    this.graveyard = [];
    this.exile = [];
    this.battlefield = [];
    this.hasLost = false;
    this.lossReason = null;

    // Populate with 60 virtual cards
    for (let i = 1; i <= cardCount; i++) {
      this.library.push({
        instanceId: generateInstanceId("opp_card"),
        name: `Opponent Card ${i}`,
        owner: "opponent",
        controller: "opponent",
        zone: ZONES.LIBRARY,
        metadata: {
          name: `Opponent Card ${i}`,
          typeLine: "Card",
          imageUri: "assets/card-back.png"
        }
      });
    }

    // Draw initial 7 cards
    for (let i = 0; i < 7; i++) {
      if (this.library.length > 0) {
        const c = this.library.pop();
        c.zone = ZONES.HAND;
        this.hand.push(c);
      }
    }
  }

  draw(count = 1) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.library.length === 0) {
        this.hasLost = true;
        this.lossReason = "ライブラリーアウト（空のライブラリーからドロー）";
        break;
      }
      const c = this.library.pop();
      c.zone = ZONES.HAND;
      this.hand.push(c);
      drawn.push(c);
    }
    return drawn;
  }

  discardAll() {
    const discarded = [...this.hand];
    for (const c of discarded) {
      c.zone = ZONES.GRAVEYARD;
      this.graveyard.push(c);
    }
    this.hand = [];
    return discarded.length;
  }

  shuffleHandAndGraveyardIntoLibrary() {
    const all = [...this.hand, ...this.graveyard, ...this.library];
    this.hand = [];
    this.graveyard = [];
    for (const c of all) {
      c.zone = ZONES.LIBRARY;
    }
    // Simple shuffle for virtual deck
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    this.library = all;
  }
}
