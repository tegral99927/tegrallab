// simulator.js - Simulator page controller

import { initCardData } from "./api/scryfall.js";
import { cardRegistry } from "./cards/registry.js";
import { deckRegistry } from "./decks/registry.js";
import { Game } from "./engine/game.js";
import { Rules } from "./engine/rules.js";
import { ZONES } from "./engine/zones.js";
import { renderBoard } from "./ui/board.js";
import { renderHand } from "./ui/hand.js";
import { setupControls } from "./ui/controls.js";
import { setupLogger } from "./ui/logger.js";
import { Modal } from "./ui/modal.js";
import { Storage } from "./utils/storage.js";
import { escapeHtml } from "./utils/helpers.js";

let game = null;
let currentDeck = null;
let currentMode = "goldfish"; // "goldfish" | "practice" | "scenario"
let currentScenario = null;

async function init() {
  await initCardData();

  const urlParams = new URLSearchParams(window.location.search);
  const deckId = urlParams.get("deck") || "moma";
  currentMode = urlParams.get("mode") || "goldfish";
  const scenarioId = urlParams.get("scenario");
  const customSeed = urlParams.get("seed") ? parseInt(urlParams.get("seed"), 10) : null;

  currentDeck = deckRegistry.get(deckId) || deckRegistry.get("moma");

  // Populate deck selector
  const deckSelect = document.getElementById("deck-select");
  if (deckSelect) {
    deckSelect.innerHTML = "";
    for (const d of deckRegistry.getAll()) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.nameJa || d.name;
      opt.selected = d.id === currentDeck.id;
      deckSelect.appendChild(opt);
    }

    deckSelect.onchange = () => {
      const selectedId = deckSelect.value;
      if (selectedId !== currentDeck.id) {
        window.location.href = `simulator.html?deck=${selectedId}&mode=${currentMode}`;
      }
    };
  }

  // Mode badge setup
  const modeBadge = document.getElementById("mode-badge");

  if (currentMode === "practice") {
    modeBadge.textContent = "フリープラクティス";
    modeBadge.style.color = "var(--accent-gold)";
    document.getElementById("btn-practice-menu").style.display = "inline-block";
  } else if (currentMode === "scenario") {
    modeBadge.textContent = "シナリオ特訓";
    modeBadge.style.color = "var(--accent-green)";
    document.getElementById("btn-scenario-info").style.display = "inline-block";
    currentScenario = (currentDeck.scenarios || []).find(s => s.id === scenarioId) || currentDeck.scenarios[0];
  } else {
    modeBadge.textContent = "一人回しモード";
    modeBadge.style.color = "#58a6ff";
  }

  // Initialize game
  startNewGame(customSeed);
}

function startNewGame(seed = null) {
  game = new Game({
    seed: seed,
    deckData: currentDeck,
    cardRegistry: cardRegistry,
    mode: currentMode
  });

  // Seed display & copy
  const seedDisplay = document.getElementById("seed-display");
  seedDisplay.textContent = `Seed: ${game.prng.initialSeed}`;
  document.getElementById("btn-copy-seed").onclick = () => {
    navigator.clipboard.writeText(String(game.prng.initialSeed)).then(() => {
      alert(`シード値 [${game.prng.initialSeed}] をコピーしました！`);
    });
  };

  // If scenario mode, apply initial scenario state
  if (currentMode === "scenario" && currentScenario) {
    applyScenario(currentScenario);
  }

  // Bind controls & logger
  setupControls(game, {
    manaContainer: document.getElementById("mana-pool-container"),
    turnBadge: document.getElementById("turn-badge"),
    passTurnBtn: document.getElementById("btn-pass-turn"),
    undoBtn: document.getElementById("btn-undo"),
    redoBtn: document.getElementById("btn-redo"),
    stackContainer: document.getElementById("stack-items-container"),
    resolveStackBtn: document.getElementById("btn-resolve-stack"),
    oppStats: document.getElementById("opp-stats")
  });

  setupLogger(
    game,
    document.getElementById("game-log-container"),
    document.getElementById("btn-copy-log"),
    document.getElementById("btn-export-log")
  );

  // Setup UI components and zone watchers
  const bfContainer = document.getElementById("battlefield-container");
  const handContainer = document.getElementById("hand-container");

  function refreshUI() {
    renderBoard(game, bfContainer);
    renderHand(game, handContainer);
    updateZoneCounts();
    checkGameOver();
  }

  game.onStateChange(() => {
    refreshUI();
  });

  // Toolbar bottom buttons
  document.getElementById("btn-view-graveyard").onclick = () => showZoneModal("墓地", ZONES.GRAVEYARD);
  document.getElementById("btn-view-exile").onclick = () => showZoneModal("追放領域", ZONES.EXILE);
  document.getElementById("btn-view-sideboard").onclick = () => showZoneModal("サイドボード", ZONES.SIDEBOARD);
  document.getElementById("btn-view-library").onclick = () => {
    if (currentMode === "practice") {
      showZoneModal("ライブラリー (フリー閲覧)", ZONES.LIBRARY);
    } else {
      alert("通常の一人回しでは非公開情報のライブラリーを直接見ることはできません。フリープラクティスモードをご利用ください。");
    }
  };

  // Mulligan & Keep
  document.getElementById("btn-mulligan").onclick = () => {
    Rules.mulligan(game);
  };

  document.getElementById("btn-keep").onclick = () => {
    const needed = game.state.player.mulligansCount;
    if (needed === 0) {
      document.getElementById("mulligan-toolbar").style.display = "none";
      game.log("手札をキープしました！", "success");
      return;
    }

    // Prompt user to select N cards to put to bottom
    const hand = game.state.player.hand;
    const targetList = hand.map(c => ({ id: c.instanceId, name: c.name, tapped: false }));
    Modal.pickTarget(`キープ処理: ライブラリーボトムへ戻すカードを選択 (残り${needed}枚)`, targetList, (selected) => {
      Rules.keepHand(game, [selected.id]);
      document.getElementById("mulligan-toolbar").style.display = "none";
      game.notifyStateChange();
    });
  };

  // Reset button
  document.getElementById("btn-restart").onclick = () => {
    if (confirm("ゲームをリセットして初めからやり直しますか？")) {
      startNewGame();
    }
  };

  // Scenario Info button
  if (currentScenario) {
    document.getElementById("btn-scenario-info").onclick = () => {
      showScenarioModal(currentScenario);
    };
  }

  // Free practice menu
  document.getElementById("btn-practice-menu").onclick = () => {
    showPracticeToolsModal();
  };

  refreshUI();
}

function updateZoneCounts() {
  document.getElementById("count-graveyard").textContent = game.state.player.graveyard.length;
  document.getElementById("count-exile").textContent = game.state.player.exile.length;
  document.getElementById("count-sideboard").textContent = game.state.player.sideboard.length;
  document.getElementById("count-library").textContent = game.state.player.library.length;
}

function showZoneModal(title, zoneName) {
  const cards = game.zoneManager.get(zoneName);
  let content = `<div style="display:flex;flex-wrap:wrap;gap:10px;max-height:400px;overflow-y:auto;padding:8px;">`;
  if (cards.length === 0) {
    content += `<div style="color:var(--text-muted);width:100%;text-align:center;padding:20px;">この領域にはカードがありません</div>`;
  } else {
    for (const c of cards) {
      const meta = c.metadata || {};
      content += `
        <div style="background:var(--bg-surface);border:1px solid var(--border-color);padding:8px;border-radius:6px;width:140px;font-size:12px;">
          <strong>${escapeHtml(meta.jaName || meta.name || c.name)}</strong>
          <div style="color:var(--accent-gold);font-size:10px;">${escapeHtml(meta.manaCost || "")}</div>
          <div style="color:var(--text-muted);font-size:10px;">${escapeHtml(meta.typeLine || "")}</div>
        </div>
      `;
    }
  }
  content += `</div>`;

  Modal.show({
    title: `${title} (${cards.length}枚)`,
    contentHtml: content,
    buttons: [{ text: "閉じる", action: () => Modal.close() }]
  });
}

function applyScenario(scenario) {
  game.history.savePoint(`シナリオ適用: ${scenario.title}`);

  // Clear current zones
  game.state.player.hand = [];
  game.state.player.battlefield = [];
  game.zoneManager.zones[ZONES.HAND] = [];
  game.zoneManager.zones[ZONES.BATTLEFIELD] = [];

  const init = scenario.initialState || {};

  // Battlefield
  for (const item of (init.battlefield || [])) {
    game.practiceAddCard(item.name, ZONES.BATTLEFIELD);
    const placed = game.state.player.battlefield[game.state.player.battlefield.length - 1];
    if (placed && item.tapped) placed.tapped = true;
  }

  // Hand
  for (const item of (init.hand || [])) {
    game.practiceAddCard(item.name, ZONES.HAND);
  }

  // Mana
  if (init.mana) {
    for (const [col, val] of Object.entries(init.mana)) {
      game.state.player.manaPool[col] = val;
    }
  }

  game.syncZoneReferences();
  game.log(`シナリオ開始: ${scenario.title}`, "system");
  game.log(`目標: ${scenario.goal}`, "info");

  // Show scenario modal at start
  setTimeout(() => showScenarioModal(scenario), 200);
}

function showScenarioModal(scenario) {
  Modal.show({
    title: `シナリオ: ${scenario.title}`,
    contentHtml: `
      <div style="font-size:14px;line-height:1.6;">
        <h4 style="color:var(--accent-gold);margin-bottom:6px;">🎯 達成目標</h4>
        <p style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);margin-bottom:14px;">${escapeHtml(scenario.goal)}</p>
        <h4 style="color:var(--accent-blue);margin-bottom:6px;">💡 ヒント</h4>
        <p style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);">${escapeHtml(scenario.hint)}</p>
      </div>
    `,
    buttons: [{ text: "了解", className: "btn-primary", action: () => Modal.close() }]
  });
}

function showPracticeToolsModal() {
  const contentHtml = `
    <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;">
      <div>
        <label style="font-weight:600;display:block;margin-bottom:4px;">任意のカードを追加 (実装済みカードのみ):</label>
        <select id="practice-card-select" style="width:100%;padding:8px;background:#101318;color:#fff;border:1px solid var(--border-color);border-radius:4px;">
          ${cardRegistry.getAll().map(c => `<option value="${c.name}">${c.name}</option>`).join("")}
        </select>
        <div style="margin-top:6px;display:flex;gap:6px;">
          <button class="btn-outline" id="practice-btn-add-hand">手札に追加</button>
          <button class="btn-outline" id="practice-btn-add-bf">戦場に追加</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border-color);padding-top:10px;">
        <label style="font-weight:600;display:block;margin-bottom:4px;">マナプール直接追加 (+5点):</label>
        <div style="display:flex;gap:6px;">
          <button class="btn-outline" onclick="window.practiceMana('U')">青 {U}</button>
          <button class="btn-outline" onclick="window.practiceMana('G')">緑 {G}</button>
          <button class="btn-outline" onclick="window.practiceMana('B')">黒 {B}</button>
          <button class="btn-outline" onclick="window.practiceMana('W')">白 {W}</button>
          <button class="btn-outline" onclick="window.practiceMana('C')">無色 {C}</button>
        </div>
      </div>
    </div>
  `;

  window.practiceMana = (col) => {
    game.practiceAddMana(col, 5);
  };

  Modal.show({
    title: "フリープラクティスツール",
    contentHtml,
    buttons: [{ text: "閉じる", action: () => Modal.close() }]
  });

  document.getElementById("practice-btn-add-hand").onclick = () => {
    const cardName = document.getElementById("practice-card-select").value;
    game.practiceAddCard(cardName, ZONES.HAND);
    Modal.close();
  };
  document.getElementById("practice-btn-add-bf").onclick = () => {
    const cardName = document.getElementById("practice-card-select").value;
    game.practiceAddCard(cardName, ZONES.BATTLEFIELD);
    Modal.close();
  };
}

let gameOverHandled = false;
function checkGameOver() {
  if (gameOverHandled) return;

  if (game.state.player.hasWon) {
    gameOverHandled = true;
    const turn = game.turn.turnNumber;
    if (currentMode === "goldfish") {
      Storage.saveGameResult(currentDeck.id, {
        outcome: "win",
        turn: turn,
        mulligans: game.state.player.mulligansCount,
        undoUsed: game.state.undoUsed,
        seed: game.prng.initialSeed
      });
    }

    Modal.show({
      title: "🎉 勝利！コンボ達成！",
      contentHtml: `
        <div style="text-align:center;padding:16px;">
          <h2 style="color:var(--accent-gold);margin-bottom:8px;">CONGRATULATIONS!</h2>
          <p style="font-size:16px;margin-bottom:12px;"><strong>${escapeHtml(game.state.player.winReason || "コンボが成立しました！")}</strong></p>
          <div style="background:#161a22;padding:12px;border-radius:6px;border:1px solid var(--border-color);display:inline-block;text-align:left;font-size:13px;">
            <div>達成ターン: <strong>ターン ${turn}</strong></div>
            <div>マリガン回数: <strong>${game.state.player.mulligansCount} 回</strong></div>
            <div>Undo使用: <strong>${game.state.undoUsed ? "あり" : "なし"}</strong></div>
            <div>乱数シード: <strong>${game.prng.initialSeed}</strong></div>
          </div>
        </div>
      `,
      buttons: [
        {
          text: "もう一度プレイ",
          className: "btn-primary",
          action: () => {
            gameOverHandled = false;
            startNewGame();
          }
        },
        { text: "閉じる", action: () => Modal.close() }
      ]
    });
  } else if (game.state.player.hasLost) {
    gameOverHandled = true;
    if (currentMode === "goldfish") {
      Storage.saveGameResult(currentDeck.id, {
        outcome: "loss",
        turn: game.turn.turnNumber,
        mulligans: game.state.player.mulligansCount,
        undoUsed: game.state.undoUsed,
        seed: game.prng.initialSeed
      });
    }

    Modal.show({
      title: "💀 敗北",
      contentHtml: `
        <div style="text-align:center;padding:16px;">
          <p style="color:var(--accent-red);font-size:15px;margin-bottom:12px;">${escapeHtml(game.state.player.lossReason || "敗北しました。")}</p>
        </div>
      `,
      buttons: [
        {
          text: "リトライ",
          className: "btn-primary",
          action: () => {
            gameOverHandled = false;
            startNewGame();
          }
        },
        { text: "閉じる", action: () => Modal.close() }
      ]
    });
  }
}

// Guaranteed execution even if DOMContentLoaded already fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    init().catch(err => console.error("Simulator init error:", err));
  });
} else {
  init().catch(err => console.error("Simulator init error:", err));
}
