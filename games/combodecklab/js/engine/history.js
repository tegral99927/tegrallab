// history.js - Undo / Redo history management

export class HistoryManager {
  constructor(game, maxHistory = 100) {
    this.game = game;
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
  }

  // Push current state to undo stack before executing action
  savePoint(actionDescription = "") {
    const snapshot = this.game.state.createSnapshot();
    snapshot.actionDescription = actionDescription;
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;

    // Current state becomes redo point
    const currentSnapshot = this.game.state.createSnapshot();
    this.redoStack.push(currentSnapshot);

    const prevSnapshot = this.undoStack.pop();
    this.game.state.restoreSnapshot(this.game, prevSnapshot);
    this.game.log(`アンドゥを実行しました: [${prevSnapshot.actionDescription || "直前の操作"}] を取り消しました。`, "info");
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    // Current state becomes undo point
    const currentSnapshot = this.game.state.createSnapshot();
    this.undoStack.push(currentSnapshot);

    const nextSnapshot = this.redoStack.pop();
    this.game.state.restoreSnapshot(this.game, nextSnapshot);
    this.game.log(`リドゥを実行しました: [${nextSnapshot.actionDescription || "操作"}] を再適用しました。`, "info");
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
