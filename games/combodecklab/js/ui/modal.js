// modal.js - Modal dialogs manager

import { escapeHtml } from "../utils/helpers.js";

let activeBackdrop = null;

export const Modal = {
  show({ title, contentHtml, buttons = [{ text: "閉じる", action: () => Modal.close() }] }) {
    Modal.close();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop active";

    const content = document.createElement("div");
    content.className = "modal-content";

    content.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button class="btn-outline modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
      <div class="modal-footer"></div>
    `;

    const footer = content.querySelector(".modal-footer");
    for (const btnDef of buttons) {
      const btn = document.createElement("button");
      btn.textContent = btnDef.text;
      btn.className = btnDef.className || "btn-outline";
      btn.onclick = () => {
        if (btnDef.action) btnDef.action();
        if (btnDef.close !== false) Modal.close();
      };
      footer.appendChild(btn);
    }

    content.querySelector(".modal-close-btn").onclick = () => Modal.close();
    backdrop.onclick = (e) => {
      if (e.target === backdrop) Modal.close();
    };

    backdrop.appendChild(content);
    document.body.appendChild(backdrop);
    activeBackdrop = backdrop;
  },

  close() {
    if (activeBackdrop) {
      activeBackdrop.remove();
      activeBackdrop = null;
    }
  },

  // Inspect single card
  inspectCard(card) {
    const meta = card.metadata || {};
    const imgHtml = meta.imageUri
      ? `<img src="${meta.imageUri}" style="width:240px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.5);">`
      : "";

    const contentHtml = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div style="flex-shrink:0;">${imgHtml}</div>
        <div style="flex:1;min-width:260px;">
          <h2 style="font-size:18px;margin-bottom:4px;">${escapeHtml(meta.jaName || meta.name || card.name)}</h2>
          <div style="color:var(--text-muted);font-size:12px;margin-bottom:8px;">${escapeHtml(meta.name || "")} | ${escapeHtml(meta.manaCost || "")}</div>
          <div style="font-weight:600;margin-bottom:8px;">${escapeHtml(meta.typeLine || "")}</div>
          <div style="background:#161a22;padding:12px;border-radius:6px;border:1px solid var(--border-color);white-space:pre-wrap;font-size:13px;line-height:1.6;">${escapeHtml(meta.oracleText || "テキストなし")}</div>
          <div style="margin-top:12px;font-size:12px;color:var(--text-muted);">
            状態: ${card.tapped ? "タップ状態" : "アンタップ状態"}<br>
            領域: ${card.zone}<br>
            ${card.copiedFrom ? `コピー元: ${escapeHtml(card.copiedFrom)}` : ""}
          </div>
        </div>
      </div>
    `;

    Modal.show({
      title: "カード詳細",
      contentHtml,
      buttons: [{ text: "閉じる", action: () => Modal.close() }]
    });
  },

  // Pick target permanent or card
  pickTarget(title, targetList, onSelect) {
    let listHtml = `<div style="display:flex;flex-direction:column;gap:8px;max-height:360px;overflow-y:auto;">`;
    for (const item of targetList) {
      listHtml += `
        <button class="target-select-btn" data-id="${item.id}" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;text-align:left;background:var(--bg-surface);border:1px solid var(--border-color);">
          <span><strong>${escapeHtml(item.name)}</strong></span>
          <span style="font-size:12px;color:var(--text-muted);">${item.tapped ? "(タップ状態)" : "(アンタップ)"}</span>
        </button>
      `;
    }
    listHtml += `</div>`;

    Modal.show({
      title,
      contentHtml: listHtml,
      buttons: [{ text: "キャンセル", action: () => Modal.close() }]
    });

    const btns = document.querySelectorAll(".target-select-btn");
    btns.forEach(b => {
      b.onclick = () => {
        const id = b.dataset.id;
        const selected = targetList.find(t => t.id === id);
        Modal.close();
        if (onSelect) onSelect(selected);
      };
    });
  },

  // Input X value
  inputX(title, maxAllowed = 99, onConfirm) {
    const contentHtml = `
      <div style="padding:10px 0;">
        <label style="display:block;margin-bottom:8px;">Xの値を指定してください (0 〜 ${maxAllowed}):</label>
        <input type="number" id="x-value-input" min="0" max="${maxAllowed}" value="3" style="width:100%;padding:10px;background:#101318;border:1px solid var(--border-color);color:#fff;border-radius:4px;font-size:16px;">
      </div>
    `;

    Modal.show({
      title,
      contentHtml,
      buttons: [
        {
          text: "決定",
          className: "btn-primary",
          action: () => {
            const val = parseInt(document.getElementById("x-value-input").value, 10) || 0;
            if (onConfirm) onConfirm(val);
          }
        },
        { text: "キャンセル", action: () => Modal.close() }
      ]
    });
  }
};
