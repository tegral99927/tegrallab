// main.js - Top page controller

import { initCardData } from "./api/scryfall.js";
import { deckRegistry } from "./decks/registry.js";
import { showDeckStatistics } from "./ui/statistics.js";
import { Modal } from "./ui/modal.js";
import { escapeHtml } from "./utils/helpers.js";
import { CardCache } from "./api/cache.js";

async function init() {
  await initCardData();

  populateDeckThumbnails();
  renderScenarios();
  bindDeckButtons();
}

function populateDeckThumbnails() {
  // MoMa thumbnails
  const momaContainer = document.getElementById("key-cards-moma");
  if (momaContainer) {
    const momaDeck = deckRegistry.get("moma");
    if (momaDeck) {
      let thumbs = "";
      for (const cardName of (momaDeck.keyCards || [])) {
        const meta = CardCache.get(cardName);
        const imgUri = meta && meta.imageUri ? meta.imageUri : "";
        if (imgUri) {
          thumbs += `<img src="${imgUri}" alt="${escapeHtml(cardName)}" class="key-card-thumb" title="${escapeHtml(meta.jaName || cardName)}">`;
        }
      }
      momaContainer.innerHTML = thumbs;
    }
  }

  // Lotus thumbnails
  const lotusContainer = document.getElementById("key-cards-lotus");
  if (lotusContainer) {
    const lotusDeck = deckRegistry.get("lotus");
    if (lotusDeck) {
      let thumbs = "";
      for (const cardName of (lotusDeck.keyCards || [])) {
        const meta = CardCache.get(cardName);
        const imgUri = meta && meta.imageUri ? meta.imageUri : "";
        if (imgUri) {
          thumbs += `<img src="${imgUri}" alt="${escapeHtml(cardName)}" class="key-card-thumb" title="${escapeHtml(meta.jaName || cardName)}">`;
        }
      }
      lotusContainer.innerHTML = thumbs;
    }
  }
}

function bindDeckButtons() {
  // Bind view list and stats buttons
  document.querySelectorAll(".btn-view-decklist").forEach(btn => {
    btn.onclick = () => {
      const deckId = btn.dataset.id;
      const deck = deckRegistry.get(deckId);
      if (deck) showDecklistModal(deck);
    };
  });

  document.querySelectorAll(".btn-view-stats").forEach(btn => {
    btn.onclick = () => {
      const deckId = btn.dataset.id;
      const deck = deckRegistry.get(deckId);
      if (deck) showDeckStatistics(deck.id, deck.nameJa || deck.name);
    };
  });
}

function showDecklistModal(deck) {
  let mainboardHtml = `<ul style="list-style:none;padding:0;margin-bottom:14px;font-size:13px;line-height:1.6;">`;
  let mainTotal = 0;
  for (const item of (deck.mainboard || [])) {
    mainTotal += item.count;
    const meta = CardCache.get(item.name);
    const jaName = meta ? meta.jaName : item.name;
    mainboardHtml += `<li><strong>${item.count}</strong> 《${escapeHtml(jaName)}》 <span style="color:var(--text-muted);font-size:11px;">(${escapeHtml(item.name)})</span></li>`;
  }
  mainboardHtml += `</ul>`;

  let sideboardHtml = `<ul style="list-style:none;padding:0;font-size:13px;line-height:1.6;">`;
  let sbTotal = 0;
  for (const item of (deck.sideboard || [])) {
    sbTotal += item.count;
    const meta = CardCache.get(item.name);
    const jaName = meta ? meta.jaName : item.name;
    sideboardHtml += `<li><strong>${item.count}</strong> 《${escapeHtml(jaName)}》 <span style="color:var(--text-muted);font-size:11px;">(${escapeHtml(item.name)})</span></li>`;
  }
  sideboardHtml += `</ul>`;

  const contentHtml = `
    <div style="font-size:13px;margin-bottom:12px;color:var(--text-muted);">
      出典: ${escapeHtml(deck.source || "公式リスト")}<br>
      ${deck.rulesNotice ? `<div style="margin-top:6px;color:var(--accent-gold);background:#1a1710;padding:8px;border-radius:4px;border:1px solid #4a3b10;">${escapeHtml(deck.rulesNotice)}</div>` : ""}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <div>
        <h4 style="border-bottom:1px solid var(--border-color);padding-bottom:4px;margin-bottom:8px;">メインデッキ (${mainTotal}枚)</h4>
        ${mainboardHtml}
      </div>
      <div>
        <h4 style="border-bottom:1px solid var(--border-color);padding-bottom:4px;margin-bottom:8px;">サイドボード (${sbTotal}枚)</h4>
        ${sideboardHtml}
      </div>
    </div>
  `;

  Modal.show({
    title: `デッキリスト - ${deck.nameJa || deck.name}`,
    contentHtml,
    buttons: [
      {
        text: "このデッキで一人回し",
        className: "btn-primary",
        action: () => {
          window.location.href = `simulator.html?deck=${deck.id}&mode=goldfish`;
        }
      },
      { text: "閉じる", action: () => Modal.close() }
    ]
  });
}

function renderScenarios() {
  const container = document.getElementById("scenario-cards-container");
  if (!container) return;
  container.innerHTML = "";

  const decks = deckRegistry.getAll();
  for (const deck of decks) {
    for (const sc of (deck.scenarios || [])) {
      const cardEl = document.createElement("div");
      cardEl.style.background = "var(--bg-card)";
      cardEl.style.border = "1px solid var(--border-color)";
      cardEl.style.borderRadius = "6px";
      cardEl.style.padding = "14px";
      cardEl.style.display = "flex";
      cardEl.style.flexDirection = "column";
      cardEl.style.justifyContent = "space-between";

      cardEl.innerHTML = `
        <div>
          <div style="font-size:11px;color:var(--accent-blue);font-weight:600;margin-bottom:4px;">${escapeHtml(deck.nameJa || deck.name)}</div>
          <h4 style="font-size:15px;margin-bottom:6px;">${escapeHtml(sc.title)}</h4>
          <p style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">${escapeHtml(sc.goal)}</p>
        </div>
        <a href="simulator.html?deck=${deck.id}&mode=scenario&scenario=${sc.id}">
          <button class="btn-primary" style="width:100%;">シナリオ開始 ❯</button>
        </a>
      `;

      container.appendChild(cardEl);
    }
  }
}

// Guaranteed execution even if DOMContentLoaded already fired
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
