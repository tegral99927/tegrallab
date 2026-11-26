// card.js - Card DOM rendering and interaction

import { escapeHtml } from "../utils/helpers.js";

export function createCardElement(card, options = {}) {
  const el = document.createElement("div");
  el.className = `card-item ${card.tapped ? "tapped" : ""}`;
  el.dataset.id = card.instanceId;
  el.dataset.name = card.name;

  const meta = card.metadata || {};
  const imageUri = meta.imageUri || "";

  if (imageUri) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.src = imageUri;
    img.alt = meta.jaName || meta.name || card.name;
    img.loading = "lazy";
    img.onerror = () => {
      // Fallback if image fails to load
      img.replaceWith(createFallbackContent(card, meta));
    };
    el.appendChild(img);
  } else {
    el.appendChild(createFallbackContent(card, meta));
  }

  // Tapped indicator badge or overlay badge if copied/counters
  if (card.copiedFrom) {
    const copyBadge = document.createElement("div");
    copyBadge.className = "card-overlay-badge";
    copyBadge.textContent = "Copy";
    el.appendChild(copyBadge);
  }

  // Card click callback
  if (options.onClick) {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      options.onClick(card, el, e);
    });
  }

  // Double click or right click for inspection
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (options.onInspect) {
      options.onInspect(card);
    }
  });

  return el;
}

function createFallbackContent(card, meta) {
  const div = document.createElement("div");
  div.className = "card-fallback";
  div.innerHTML = `
    <div>
      <div class="card-fallback-name">${escapeHtml(meta.jaName || meta.name || card.name)}</div>
      <div class="card-fallback-cost">${escapeHtml(meta.manaCost || "")}</div>
    </div>
    <div class="card-fallback-type">${escapeHtml(meta.typeLine || "")}</div>
  `;
  return div;
}
