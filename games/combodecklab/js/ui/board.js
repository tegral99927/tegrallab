// board.js - Battlefield rendering

import { createCardElement } from "./card.js";
import { Actions } from "../engine/actions.js";
import { Modal } from "./modal.js";

let activeMenu = null;

export function renderBoard(game, containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  closeActiveMenu();

  const battlefield = game.state.player.battlefield;

  const lands = [];
  const nonLands = [];

  for (const card of battlefield) {
    const typeLine = (card.metadata.typeLine || "").toLowerCase();
    if (typeLine.includes("land")) {
      lands.push(card);
    } else {
      nonLands.push(card);
    }
  }

  // Non-lands row
  if (nonLands.length > 0) {
    const rowTitle = document.createElement("div");
    rowTitle.className = "battlefield-row-title";
    rowTitle.textContent = "クリーチャー / アーティファクト / エンチャント";
    containerEl.appendChild(rowTitle);

    const nonLandsRow = document.createElement("div");
    nonLandsRow.className = "battlefield-row";
    for (const card of nonLands) {
      const cardEl = createCardElement(card, {
        onClick: (c, el, e) => showPermanentMenu(game, c, el, e),
        onInspect: (c) => Modal.inspectCard(c)
      });
      nonLandsRow.appendChild(cardEl);
    }
    containerEl.appendChild(nonLandsRow);
  }

  // Lands row
  const landsRowTitle = document.createElement("div");
  landsRowTitle.className = "battlefield-row-title";
  landsRowTitle.textContent = `土地 (${lands.length}枚)`;
  containerEl.appendChild(landsRowTitle);

  const landsRow = document.createElement("div");
  landsRow.className = "battlefield-row";
  for (const card of lands) {
    const cardEl = createCardElement(card, {
      onClick: (c, el, e) => showPermanentMenu(game, c, el, e),
      onInspect: (c) => Modal.inspectCard(c)
    });
    landsRow.appendChild(cardEl);
  }
  containerEl.appendChild(landsRow);
}

function showPermanentMenu(game, card, cardEl, event) {
  closeActiveMenu();

  const menu = document.createElement("div");
  menu.className = "action-popover";

  const def = card.cardDef || {};
  const manaAbilities = def.manaAbilities || [];
  const activatedAbilities = def.activatedAbilities || [];

  // Mana abilities
  if (manaAbilities.length > 0 && !card.tapped) {
    manaAbilities.forEach((ma, idx) => {
      const btn = document.createElement("button");
      btn.className = "action-popover-item";
      btn.textContent = `⚡ マナ生成: ${ma.name}`;
      btn.onclick = () => {
        closeActiveMenu();
        if (typeof ma.effect === "function") {
          game.history.savePoint(`マナ能力起動: 《${card.name}》`);
          if (ma.cost && ma.cost.tap) card.tapped = true;
          if (ma.cost && ma.cost.sacrificeSelf) game.moveCard(card.instanceId, "graveyard");
          ma.effect(game, card);
          game.notifyStateChange();
        }
      };
      menu.appendChild(btn);
    });
  }

  // Activated abilities
  if (activatedAbilities.length > 0) {
    activatedAbilities.forEach((aa, idx) => {
      const btn = document.createElement("button");
      btn.className = "action-popover-item";
      btn.textContent = `▶ 能力起動: ${aa.name}`;
      btn.onclick = () => {
        closeActiveMenu();
        Actions.activateAbility(game, card.instanceId, idx, { autoResolve: true });
        game.notifyStateChange();
      };
      menu.appendChild(btn);
    });
  }

  // Manual tap / untap toggle
  const toggleTapBtn = document.createElement("button");
  toggleTapBtn.className = "action-popover-item";
  toggleTapBtn.textContent = card.tapped ? "🔄 アンタップする" : "⤵ タップする";
  toggleTapBtn.onclick = () => {
    closeActiveMenu();
    game.history.savePoint(`${card.tapped ? "手動アンタップ" : "手動タップ"}: 《${card.name}》`);
    card.tapped = !card.tapped;
    game.log(`手動操作: 《${card.name}》を${card.tapped ? "タップ" : "アンタップ"}しました。`, "action");
    game.notifyStateChange();
  };
  menu.appendChild(toggleTapBtn);

  // Inspect detail
  const inspectBtn = document.createElement("button");
  inspectBtn.className = "action-popover-item";
  inspectBtn.textContent = "🔍 詳細を見る";
  inspectBtn.onclick = () => {
    closeActiveMenu();
    Modal.inspectCard(card);
  };
  menu.appendChild(inspectBtn);

  // Position popover
  const rect = cardEl.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.max(10, rect.top - 120)}px`;

  document.body.appendChild(menu);
  activeMenu = menu;

  const onDocClick = (e) => {
    if (!menu.contains(e.target)) {
      closeActiveMenu();
      document.removeEventListener("click", onDocClick);
    }
  };
  setTimeout(() => document.addEventListener("click", onDocClick), 50);
}

function closeActiveMenu() {
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}
