// hand.js - Hand zone rendering and actions

import { createCardElement } from "./card.js";
import { Actions } from "../engine/actions.js";
import { Modal } from "./modal.js";

let activeMenu = null;

export function renderHand(game, containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  closeActiveMenu();

  const hand = game.state.player.hand;
  for (const card of hand) {
    const cardEl = createCardElement(card, {
      onClick: (c, el, e) => showHandMenu(game, c, el, e),
      onInspect: (c) => Modal.inspectCard(c)
    });
    containerEl.appendChild(cardEl);
  }
}

function showHandMenu(game, card, cardEl, event) {
  closeActiveMenu();

  const menu = document.createElement("div");
  menu.className = "action-popover";

  const typeLine = (card.metadata.typeLine || "").toLowerCase();
  const isLand = typeLine.includes("land");

  // Play Land
  if (isLand) {
    const playBtn = document.createElement("button");
    playBtn.className = "action-popover-item";
    playBtn.textContent = "🌍 土地をプレイ";
    playBtn.onclick = () => {
      closeActiveMenu();
      const res = Actions.playLand(game, card.instanceId);
      if (!res.success) {
        alert(res.message);
      }
      game.notifyStateChange();
    };
    menu.appendChild(playBtn);
  } else {
    // Cast Spell
    const castBtn = document.createElement("button");
    castBtn.className = "action-popover-item";
    castBtn.textContent = "✨ 呪文を唱える";
    castBtn.onclick = () => {
      closeActiveMenu();
      const manaCost = card.metadata.manaCost || "";
      if (manaCost.includes("X")) {
        Modal.inputX(`《${card.name}》の X の値を指定`, 99, (xVal) => {
          const res = Actions.castSpell(game, card.instanceId, { xValue: xVal, autoResolve: true });
          if (!res.success) alert(res.message);
          game.notifyStateChange();
        });
      } else {
        const res = Actions.castSpell(game, card.instanceId, { autoResolve: true });
        if (!res.success) alert(res.message);
        game.notifyStateChange();
      }
    };
    menu.appendChild(castBtn);
  }

  // Cycling
  const def = card.cardDef;
  if (def && def.cyclingCost) {
    const cycleBtn = document.createElement("button");
    cycleBtn.className = "action-popover-item";
    cycleBtn.textContent = `🚴 サイクリング (${def.cyclingCost})`;
    cycleBtn.onclick = () => {
      closeActiveMenu();
      const res = Actions.cycleCard(game, card.instanceId, { autoResolve: true });
      if (!res.success) alert(res.message);
      game.notifyStateChange();
    };
    menu.appendChild(cycleBtn);
  }

  // Discard to Graveyard
  const discardBtn = document.createElement("button");
  discardBtn.className = "action-popover-item";
  discardBtn.textContent = "🗑 墓地に捨てる";
  discardBtn.onclick = () => {
    closeActiveMenu();
    game.history.savePoint(`手動ディスカード: 《${card.name}》`);
    game.playerDiscard(card.instanceId);
    game.notifyStateChange();
  };
  menu.appendChild(discardBtn);

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
  menu.style.top = `${Math.max(10, rect.top - 160)}px`;

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
