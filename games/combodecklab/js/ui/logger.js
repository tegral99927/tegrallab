// logger.js - Game log viewer and export

import { escapeHtml } from "../utils/helpers.js";

export function setupLogger(game, containerEl, copyBtn = null, exportBtn = null) {
  if (!containerEl) return;

  function appendLog(entry) {
    const div = document.createElement("div");
    div.className = `log-entry ${entry.type || "info"}`;
    div.innerHTML = `<span class="log-time">[${entry.timestamp} T${entry.turn}]</span> ${escapeHtml(entry.message)}`;
    containerEl.appendChild(div);
    containerEl.scrollTop = containerEl.scrollHeight;
  }

  // Initial populate
  containerEl.innerHTML = "";
  for (const entry of game.logHistory) {
    appendLog(entry);
  }

  // Subscribe to new logs
  game.onLog((entry) => {
    appendLog(entry);
  });

  // Copy to clipboard
  if (copyBtn) {
    copyBtn.onclick = () => {
      const text = game.logHistory.map(e => `[${e.timestamp} T${e.turn}] ${e.message}`).join("\n");
      navigator.clipboard.writeText(text).then(() => {
        alert("ゲームログをクリップボードにコピーしました！");
      }).catch(err => {
        console.error("Copy failed:", err);
      });
    };
  }

  // Export to text file
  if (exportBtn) {
    exportBtn.onclick = () => {
      const text = game.logHistory.map(e => `[${e.timestamp} T${e.turn}] ${e.message}`).join("\n");
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `combodecklab-log-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }
}
