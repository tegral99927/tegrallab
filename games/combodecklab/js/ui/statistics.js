// statistics.js - Practice statistics visualization

import { Storage } from "../utils/storage.js";
import { Modal } from "./modal.js";
import { escapeHtml } from "../utils/helpers.js";

export function showDeckStatistics(deckId, deckName) {
  const stats = Storage.getStats(deckId);

  const total = stats.gamesPlayed;
  const wins = stats.wins;
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  const fastest = stats.fastestWinTurn !== null ? `ターン ${stats.fastestWinTurn}` : "記録なし";

  // Calculate average win turn
  let turnSum = 0;
  let winCountWithTurn = 0;
  for (const [turnStr, count] of Object.entries(stats.turnWins || {})) {
    const t = parseInt(turnStr, 10);
    turnSum += t * count;
    winCountWithTurn += count;
  }
  const avgTurn = winCountWithTurn > 0 ? (turnSum / winCountWithTurn).toFixed(2) : "-";

  // Build Turn distribution bar chart
  let turnDistHtml = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">`;
  const maxTurnWins = Math.max(1, ...Object.values(stats.turnWins || {}));
  for (let t = 1; t <= 7; t++) {
    const count = stats.turnWins[t] || 0;
    const pct = ((count / maxTurnWins) * 100).toFixed(0);
    turnDistHtml += `
      <div style="display:flex;align-items:center;gap:10px;font-size:12px;">
        <span style="width:50px;color:var(--text-muted);">T${t} キル</span>
        <div style="flex:1;background:#1a1e27;height:18px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--accent-blue);height:100%;width:${pct}%;min-width:${count > 0 ? "10px" : "0"};transition:width 0.3s ease;"></div>
        </div>
        <span style="width:30px;text-align:right;font-weight:600;">${count}</span>
      </div>
    `;
  }
  turnDistHtml += `</div>`;

  // History list
  let historyHtml = `
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:12px;">
      <thead>
        <tr style="border-bottom:1px solid var(--border-color);color:var(--text-muted);text-align:left;">
          <th style="padding:6px;">日時</th>
          <th style="padding:6px;">結果</th>
          <th style="padding:6px;">ターン</th>
          <th style="padding:6px;">マリガン</th>
          <th style="padding:6px;">Undo</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (stats.history.length === 0) {
    historyHtml += `<tr><td colspan="5" style="padding:10px;text-align:center;color:var(--text-muted);">まだ一人回しの記録がありません</td></tr>`;
  } else {
    for (const h of stats.history.slice(0, 10)) {
      const isWin = h.outcome === "win";
      const dateStr = new Date(h.date).toLocaleDateString();
      historyHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
          <td style="padding:6px;">${dateStr}</td>
          <td style="padding:6px;color:${isWin ? "var(--accent-green)" : "var(--accent-red)};font-weight:600;">${isWin ? "勝利" : "敗北"}</td>
          <td style="padding:6px;">T${h.turn}</td>
          <td style="padding:6px;">${h.mulligans}回</td>
          <td style="padding:6px;">${h.undoUsed ? "使用" : "未使用"}</td>
        </tr>
      `;
    }
  }
  historyHtml += `</tbody></table>`;

  const contentHtml = `
    <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;text-align:center;margin-bottom:16px;">
      <div style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);">
        <div style="font-size:11px;color:var(--text-muted);">練習回数</div>
        <div style="font-size:18px;font-weight:bold;">${total}</div>
      </div>
      <div style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);">
        <div style="font-size:11px;color:var(--text-muted);">勝率</div>
        <div style="font-size:18px;font-weight:bold;color:var(--accent-green);">${winRate}%</div>
      </div>
      <div style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);">
        <div style="font-size:11px;color:var(--text-muted);">最速勝利</div>
        <div style="font-size:18px;font-weight:bold;color:var(--accent-gold);">${fastest}</div>
      </div>
      <div style="background:#161a22;padding:10px;border-radius:6px;border:1px solid var(--border-color);">
        <div style="font-size:11px;color:var(--text-muted);">平均勝利ターン</div>
        <div style="font-size:18px;font-weight:bold;">${avgTurn}</div>
      </div>
    </div>

    <h4 style="font-size:13px;border-bottom:1px solid var(--border-color);padding-bottom:4px;">ターン別コンボ成立数</h4>
    ${turnDistHtml}

    <h4 style="font-size:13px;border-bottom:1px solid var(--border-color);padding-bottom:4px;margin-top:16px;">直近の一人回し履歴 (最新10件)</h4>
    ${historyHtml}

    <div style="font-size:11px;color:var(--text-muted);margin-top:16px;background:#14171d;padding:8px;border-radius:4px;">
      ※本統計はユーザー自身の一人回し（先攻・対戦相手の妨害なし想定）の実績値であり、実戦環境における勝率やデッキの理論上の成功率を示すものではありません。
    </div>
  `;

  Modal.show({
    title: `練習統計 - ${deckName}`,
    contentHtml,
    buttons: [{ text: "閉じる", action: () => Modal.close() }]
  });
}
