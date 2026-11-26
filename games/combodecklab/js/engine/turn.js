// turn.js - Turn and phase management

export const PHASES = {
  UNTAP: "untap",
  UPKEEP: "upkeep",
  DRAW: "draw",
  PRECOMBAT_MAIN: "main1",
  BEGIN_COMBAT: "begin_combat",
  DECLARE_ATTACKERS: "declare_attackers",
  POSTCOMBAT_MAIN: "main2",
  END_STEP: "end",
  CLEANUP: "cleanup"
};

export const PHASE_NAMES_JA = {
  [PHASES.UNTAP]: "アンタップ・ステップ",
  [PHASES.UPKEEP]: "アップキープ・ステップ",
  [PHASES.DRAW]: "ドロー・ステップ",
  [PHASES.PRECOMBAT_MAIN]: "メインフェイズ 1",
  [PHASES.BEGIN_COMBAT]: "戦闘開始ステップ",
  [PHASES.DECLARE_ATTACKERS]: "攻撃クリーチャー指定ステップ",
  [PHASES.POSTCOMBAT_MAIN]: "メインフェイズ 2",
  [PHASES.END_STEP]: "終了ステップ",
  [PHASES.CLEANUP]: "クリンナップ・ステップ"
};

export class TurnManager {
  constructor(game) {
    this.game = game;
    this.turnNumber = 1;
    this.currentPhase = PHASES.PRECOMBAT_MAIN; // start ready to act
    this.activePlayer = "player";
  }

  // Check if player has sorcery timing
  isSorceryTiming() {
    return (
      this.activePlayer === "player" &&
      (this.currentPhase === PHASES.PRECOMBAT_MAIN || this.currentPhase === PHASES.POSTCOMBAT_MAIN) &&
      this.game.stack.isEmpty()
    );
  }

  // Pass to next turn
  passTurn() {
    this.game.log(`--- ターン ${this.turnNumber} 終了 ---`, "turn");

    // Cleanup phase: empty mana pool
    this.game.state.player.manaPool.empty();

    // Increment turn
    this.turnNumber += 1;
    this.activePlayer = "player";
    this.currentPhase = PHASES.PRECOMBAT_MAIN;

    // Reset per-turn player counters
    this.game.state.player.landsPlayedThisTurn = 0;
    this.game.state.player.maxLandPlaysThisTurn = 1;
    this.game.state.player.spellsCastThisTurn = 0;
    this.game.state.player.cardsDrawnThisTurn = 0;

    this.game.log(`=== ターン ${this.turnNumber} 開始 ===`, "turn");

    // 1. Untap step
    this.game.untapAllPermanents();

    // 2. Upkeep triggers (if any)
    this.game.checkUpkeep();

    // 3. Draw step (draw a card unless turn 1 and playing first)
    if (!(this.turnNumber === 1 && this.game.state.player.isPlayFirst)) {
      this.game.playerDraw(1);
    } else {
      this.game.log("先攻第1ターンのため、通常のドローはスキップされます。", "info");
    }
  }
}
