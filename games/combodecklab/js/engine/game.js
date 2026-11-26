// game.js - Main Game controller facade

import { PRNG } from "./random.js";
import { Player } from "./player.js";
import { Opponent } from "./opponent.js";
import { ZoneManager, ZONES, CardInstance } from "./zones.js";
import { MTGStack } from "./stack.js";
import { TurnManager } from "./turn.js";
import { Rules } from "./rules.js";
import { GameState } from "./state.js";
import { HistoryManager } from "./history.js";
import { Actions } from "./actions.js";
import { CardCache } from "../api/cache.js";

export class Game {
  constructor({ seed = null, deckData = null, cardRegistry = null, mode = "goldfish" } = {}) {
    this.mode = mode; // "goldfish" | "practice" | "scenario"
    this.prng = new PRNG(seed);
    this.cardRegistry = cardRegistry;
    this.deckData = deckData;

    this.player = new Player();
    this.opponent = new Opponent();
    this.zoneManager = new ZoneManager();
    this.stack = new MTGStack();
    this.turn = new TurnManager(this);

    this.state = new GameState(this.player, this.opponent, this.zoneManager, this.turn, this.prng);
    this.history = new HistoryManager(this);

    this.logHistory = [];
    this.logListeners = [];
    this.stateListeners = [];

    if (deckData) {
      this.initGame(deckData);
    }
  }

  onLog(fn) {
    this.logListeners.push(fn);
  }

  onStateChange(fn) {
    this.stateListeners.push(fn);
  }

  notifyStateChange() {
    for (const fn of this.stateListeners) {
      try { fn(this); } catch (e) { console.error("state listener error:", e); }
    }
  }

  log(message, type = "info") {
    const entry = {
      timestamp: new Date().toLocaleTimeString(),
      turn: this.turn.turnNumber,
      message,
      type
    };
    this.logHistory.push(entry);
    for (const fn of this.logListeners) {
      try { fn(entry); } catch (e) { console.error("log listener error:", e); }
    }
  }

  syncZoneReferences() {
    this.state.player.library = this.zoneManager.get(ZONES.LIBRARY);
    this.state.player.hand = this.zoneManager.get(ZONES.HAND);
    this.state.player.battlefield = this.zoneManager.get(ZONES.BATTLEFIELD);
    this.state.player.graveyard = this.zoneManager.get(ZONES.GRAVEYARD);
    this.state.player.exile = this.zoneManager.get(ZONES.EXILE);
    this.state.player.sideboard = this.zoneManager.get(ZONES.SIDEBOARD);
    this.state.player.outside = this.zoneManager.get(ZONES.OUTSIDE);
  }

  findCard(instanceId) {
    return this.zoneManager.find(instanceId);
  }

  moveCard(instanceId, toZone, position = "top", preserveState = false) {
    const moved = this.zoneManager.move(instanceId, toZone, position, preserveState);
    this.syncZoneReferences();
    this.notifyStateChange();
    return moved;
  }

  // Check if player has Omniscience on battlefield
  hasOmniscience() {
    return this.state.player.battlefield.some(c => c.name === "Omniscience");
  }

  // Initialize deck and start game
  initGame(deckData, startHand = 7) {
    this.deckData = deckData;
    this.zoneManager = new ZoneManager();
    this.state.zoneManager = this.zoneManager; // Ensure GameState points to new ZoneManager
    this.syncZoneReferences();

    // Build mainboard
    for (const item of (deckData.mainboard || [])) {
      const cardDef = this.cardRegistry ? this.cardRegistry.get(item.name) : { name: item.name };
      const metadata = CardCache.get(item.name) || {
        name: item.name,
        baseName: item.name,
        manaCost: "",
        typeLine: "Card",
        oracleText: ""
      };

      for (let i = 0; i < item.count; i++) {
        const card = new CardInstance(cardDef, metadata, "player");
        this.zoneManager.add(card, ZONES.LIBRARY);
      }
    }

    // Build sideboard
    for (const item of (deckData.sideboard || [])) {
      const cardDef = this.cardRegistry ? this.cardRegistry.get(item.name) : { name: item.name };
      const metadata = CardCache.get(item.name) || {
        name: item.name,
        baseName: item.name,
        manaCost: "",
        typeLine: "Card",
        oracleText: ""
      };

      for (let i = 0; i < item.count; i++) {
        const card = new CardInstance(cardDef, metadata, "player");
        this.zoneManager.add(card, ZONES.SIDEBOARD);
      }
    }

    this.syncZoneReferences();

    // Shuffle library
    this.shuffleLibrary();

    // Reset turn and players
    this.player.life = 20;
    this.player.manaPool.empty();
    this.player.mulligansCount = 0;
    this.player.hasWon = false;
    this.player.hasLost = false;
    this.opponent.initDeck(60);

    this.turn.turnNumber = 1;
    this.turn.currentPhase = "main1";

    // Draw opening hand
    this.playerDraw(startHand, false);

    this.log(`ゲーム開始！ デッキ: ${deckData.nameJa || deckData.name} (Seed: ${this.prng.initialSeed})`, "system");
    this.log(`初期手札7枚を引きました。マリガンまたはキープを選択してください。`, "info");

    this.history.clear();
    this.history.savePoint("ゲーム開始");
    this.notifyStateChange();
  }

  shuffleLibrary() {
    const lib = this.zoneManager.get(ZONES.LIBRARY);
    this.prng.shuffle(lib);
    this.log("ライブラリーをシャッフルしました。", "action");
    this.notifyStateChange();
  }

  playerDraw(count = 1, checkSBA = true) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const lib = this.zoneManager.get(ZONES.LIBRARY);
      if (lib.length === 0) {
        this.state.player.hasLost = true;
        this.state.player.lossReason = "空のライブラリーからカードを引こうとしました（ライブラリーアウト）。";
        this.log("空のライブラリーからカードを引こうとしたため、敗北しました。", "error");
        break;
      }
      const card = lib.pop();
      const fresh = card.movedTo(ZONES.HAND);
      this.zoneManager.add(fresh, ZONES.HAND);
      this.state.player.cardsDrawnThisTurn += 1;
      drawn.push(fresh);
      this.log(`カードを引きました: 《${fresh.name}》`, "draw");
    }
    this.syncZoneReferences();
    if (checkSBA) {
      this.checkStateBasedActions();
    }
    this.notifyStateChange();
    return drawn;
  }

  playerDiscard(instanceId) {
    const card = this.findCard(instanceId);
    if (!card || card.zone !== ZONES.HAND) return null;

    const moved = this.moveCard(instanceId, ZONES.GRAVEYARD);
    this.log(`手札から《${moved.name}》を捨てました。`, "action");
    return moved;
  }

  untapAllPermanents() {
    const bf = this.zoneManager.get(ZONES.BATTLEFIELD);
    for (const card of bf) {
      // Check if permanent untaps normally (e.g. Mana Vault does not untap during untap step)
      if (card.cardDef && card.cardDef.doesNotUntapDuringUntapStep) {
        continue;
      }
      card.tapped = false;
      card.summoningSickness = false;
    }
    this.log("すべてのパーマネントをアンタップしました。", "turn");
    this.notifyStateChange();
  }

  checkUpkeep() {
    const bf = this.zoneManager.get(ZONES.BATTLEFIELD);
    for (const card of bf) {
      if (card.cardDef && card.cardDef.upkeepTrigger) {
        card.cardDef.upkeepTrigger(this, card);
      }
    }
  }

  checkETB(card) {
    if (card.cardDef && card.cardDef.etbTrigger) {
      card.cardDef.etbTrigger(this, card);
    }
  }

  checkStateBasedActions() {
    Rules.checkStateBasedActions(this);
    this.notifyStateChange();
  }

  resolveStack() {
    const item = this.stack.resolveTop(this);
    this.notifyStateChange();
    return item;
  }

  resolveAllStack() {
    while (!this.stack.isEmpty()) {
      this.resolveStack();
    }
  }

  // Pass turn
  passTurn() {
    this.history.savePoint("ターン終了");
    this.turn.passTurn();
    this.notifyStateChange();
  }

  // Undo / Redo
  undo() {
    const ok = this.history.undo();
    if (ok) {
      this.syncZoneReferences();
      this.notifyStateChange();
    }
    return ok;
  }

  redo() {
    const ok = this.history.redo();
    if (ok) {
      this.syncZoneReferences();
      this.notifyStateChange();
    }
    return ok;
  }

  // Free practice manipulation
  practiceAddMana(color, amount = 1) {
    this.history.savePoint(`マナ追加: ${color} x${amount}`);
    this.state.player.manaPool.add(color, amount);
    this.log(`マナプールに ${color} を ${amount} 点追加しました。`, "mana");
    this.notifyStateChange();
  }

  practiceSetLife(amount) {
    this.history.savePoint(`ライフ変更: ${amount}`);
    this.state.player.life = amount;
    this.log(`ライフを ${amount} に設定しました。`, "info");
    this.notifyStateChange();
  }

  practiceAddCard(cardName, targetZone = ZONES.HAND) {
    this.history.savePoint(`カード生成: 《${cardName}》 -> ${targetZone}`);
    const cardDef = this.cardRegistry ? this.cardRegistry.get(cardName) : { name: cardName };
    const metadata = CardCache.get(cardName) || {
      name: cardName,
      baseName: cardName,
      manaCost: "",
      typeLine: "Card",
      oracleText: ""
    };
    const card = new CardInstance(cardDef, metadata, "player");
    card.zone = targetZone;
    this.zoneManager.add(card, targetZone);
    this.syncZoneReferences();
    this.log(`練習用カード《${cardName}》を ${targetZone} に追加しました。`, "info");
    this.notifyStateChange();
  }
}
