// controls.js - Mana pool, Turn controls and Stack viewer

import { PHASE_NAMES_JA } from "../engine/turn.js";
import { Rules } from "../engine/rules.js";
import { Modal } from "./modal.js";

export function setupControls(game, elements) {
  const {
    manaContainer,
    turnBadge,
    passTurnBtn,
    undoBtn,
    redoBtn,
    stackContainer,
    resolveStackBtn,
    mulliganControls,
    oppStats
  } = elements;

  // Render Mana Pool
  function updateManaPool() {
    if (!manaContainer) return;
    const pool = game.state.player.manaPool;
    const colors = [
      { key: "W", label: "白" },
      { key: "U", label: "青" },
      { key: "B", label: "黒" },
      { key: "R", label: "赤" },
      { key: "G", label: "緑" },
      { key: "C", label: "無色" }
    ];

    manaContainer.innerHTML = "";
    for (const c of colors) {
      const val = pool[c.key] || 0;
      const item = document.createElement("div");
      item.className = "pool-item";
      item.title = `クリックでマナ増減 (${c.label})`;
      item.innerHTML = `
        <span class="mana-badge mana-${c.key.toLowerCase()}">${c.key}</span>
        <span class="pool-val">${val}</span>
      `;
      item.onclick = (e) => {
        // Left click: add 1. Shift or right click: remove 1
        if (e.shiftKey) {
          if (pool[c.key] > 0) pool[c.key] -= 1;
        } else {
          game.practiceAddMana(c.key, 1);
        }
        game.notifyStateChange();
      };
      manaContainer.appendChild(item);
    }
  }

  // Render Turn and Phase
  function updateTurn() {
    if (turnBadge) {
      const phaseName = PHASE_NAMES_JA[game.turn.currentPhase] || game.turn.currentPhase;
      const landsPlayed = game.state.player.landsPlayedThisTurn;
      const maxLands = game.state.player.maxLandPlaysThisTurn;
      const storm = game.state.player.spellsCastThisTurn;
      turnBadge.innerHTML = `ターン ${game.turn.turnNumber} | ${phaseName} | 土地: ${landsPlayed}/${maxLands} | 呪文: ${storm}`;
    }

    if (oppStats) {
      oppStats.innerHTML = `
        <span>対戦相手ライフ: <strong>${game.state.opponent.life}</strong></span>
        <span>手札: <strong>${game.state.opponent.hand.length}</strong></span>
        <span>ライブラリー: <strong>${game.state.opponent.library.length}</strong></span>
        <span>墓地: <strong>${game.state.opponent.graveyard.length}</strong></span>
      `;
    }

    if (undoBtn) undoBtn.disabled = !game.history.canUndo();
    if (redoBtn) redoBtn.disabled = !game.history.canRedo();
  }

  // Render Stack
  function updateStack() {
    if (!stackContainer) return;
    stackContainer.innerHTML = "";

    const items = game.stack.items;
    if (items.length === 0) {
      stackContainer.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:4px;">スタックは空です</div>`;
      if (resolveStackBtn) resolveStackBtn.disabled = true;
      return;
    }

    if (resolveStackBtn) resolveStackBtn.disabled = false;

    // Show items top to bottom (LIFO: last item is top)
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const div = document.createElement("div");
      div.className = `stack-item-card ${item.type}`;
      div.innerHTML = `
        <span><strong>${i === items.length - 1 ? "▲ " : ""}${item.name}</strong></span>
        <span style="font-size:10px;color:var(--text-muted);">${item.type}</span>
      `;
      stackContainer.appendChild(div);
    }
  }

  // Pass Turn click
  if (passTurnBtn) {
    passTurnBtn.onclick = () => {
      game.passTurn();
    };
  }

  // Undo click
  if (undoBtn) {
    undoBtn.onclick = () => {
      game.undo();
    };
  }

  // Redo click
  if (redoBtn) {
    redoBtn.onclick = () => {
      game.redo();
    };
  }

  // Resolve Stack click
  if (resolveStackBtn) {
    resolveStackBtn.onclick = () => {
      game.resolveStack();
    };
  }

  // Initial update
  updateManaPool();
  updateTurn();
  updateStack();

  // Subscribe to changes
  game.onStateChange(() => {
    updateManaPool();
    updateTurn();
    updateStack();
  });
}
