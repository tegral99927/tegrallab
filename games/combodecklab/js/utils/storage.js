// storage.js - LocalStorage & Session persistence

const STORAGE_PREFIX = "combodecklab_";

export const Storage = {
  get(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      console.warn("Storage.get error:", e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage.set error:", e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.warn("Storage.remove error:", e);
    }
  },

  // Deck statistics
  getStats(deckId) {
    return this.get(`stats_${deckId}`, {
      gamesPlayed: 0,
      completedGames: 0,
      wins: 0,
      losses: 0,
      aborted: 0,
      fastestWinTurn: null,
      turnWins: {}, // { "1": count, "2": count, "3": count, ... }
      history: [] // [{ date, result, turn, mulligans, undoUsed, seed }]
    });
  },

  saveGameResult(deckId, result) {
    const stats = this.getStats(deckId);
    stats.gamesPlayed += 1;
    if (result.outcome === "win") {
      stats.completedGames += 1;
      stats.wins += 1;
      const turn = result.turn;
      stats.turnWins[turn] = (stats.turnWins[turn] || 0) + 1;
      if (stats.fastestWinTurn === null || turn < stats.fastestWinTurn) {
        stats.fastestWinTurn = turn;
      }
    } else if (result.outcome === "loss") {
      stats.completedGames += 1;
      stats.losses += 1;
    } else {
      stats.aborted += 1;
    }

    stats.history.unshift({
      date: new Date().toISOString(),
      outcome: result.outcome,
      turn: result.turn,
      mulligans: result.mulligans,
      undoUsed: result.undoUsed,
      seed: result.seed,
      notes: result.notes || ""
    });

    if (stats.history.length > 100) {
      stats.history = stats.history.slice(0, 100);
    }

    this.set(`stats_${deckId}`, stats);
    return stats;
  }
};
