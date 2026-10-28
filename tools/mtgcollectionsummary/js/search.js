/**
 * MTGCollectionSummary - search.js
 * Scryfall Card Search interface, advanced filters, grid/list presentation,
 * and detailed interactive card modal with multi-face support.
 */

(function (window) {
  'use strict';

  class SearchManager {
    constructor() {
      this.currentResults = [];
      this.currentPage = 1;
      this.hasMore = false;
      this.lastQuery = '';
      this.viewMode = 'grid'; // 'grid' | 'list'
      this.activeCard = null;
      this.activeFaceIndex = 0;
    }

    // Build Scryfall search query from UI filter controls
    buildQueryString(filters) {
      const parts = [];

      if (filters.name && filters.name.trim()) {
        const nameVal = filters.name.trim();
        // Check if query contains Japanese characters
        const isJa = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(nameVal);
        if (isJa) {
          parts.push(`include:extras (name:"${nameVal}" or printed_name:"${nameVal}")`);
        } else {
          parts.push(`"${nameVal}"`);
        }
      }

      // Colors
      if (filters.colors && filters.colors.length > 0) {
        const cStr = filters.colors.join('');
        const cMode = filters.colorMode || '>='; // '=', '>=', '<='
        parts.push(`c${cMode}${cStr}`);
      }

      // Color Identity (Commander)
      if (filters.colorIdentity && filters.colorIdentity.length > 0) {
        const idStr = filters.colorIdentity.join('');
        parts.push(`id<=${idStr}`);
      }

      // Card Type
      if (filters.type && filters.type !== 'all') {
        parts.push(`t:${filters.type}`);
      }

      // CMC
      if (filters.cmc !== undefined && filters.cmc !== '') {
        const op = filters.cmcOp || '=';
        parts.push(`cmc${op}${filters.cmc}`);
      }

      // Rarity
      if (filters.rarity && filters.rarity !== 'all') {
        parts.push(`r:${filters.rarity}`);
      }

      // Format
      if (filters.format && filters.format !== 'all') {
        parts.push(`f:${filters.format}`);
      }

      // Oracle text
      if (filters.oracleText && filters.oracleText.trim()) {
        parts.push(`o:"${filters.oracleText.trim()}"`);
      }

      return parts.join(' ');
    }

    // Execute Search
    async executeSearch(filters, page = 1) {
      this.currentPage = page;
      const queryString = this.buildQueryString(filters);
      this.lastQuery = queryString;

      if (!queryString) {
        this.currentResults = [];
        this.hasMore = false;
        return { data: [], total_cards: 0, has_more: false };
      }

      const res = await Scryfall.search(queryString, page);
      if (page === 1) {
        this.currentResults = res.data || [];
      } else {
        this.currentResults.push(...(res.data || []));
      }
      this.hasMore = res.has_more;

      // Filter by ownership if requested
      if (filters.ownership && filters.ownership !== 'all') {
        const ownedNames = new Set(Collection.items.map((i) => i.name));
        if (filters.ownership === 'owned') {
          this.currentResults = this.currentResults.filter((c) => ownedNames.has(c.name));
        } else if (filters.ownership === 'unowned') {
          this.currentResults = this.currentResults.filter((c) => !ownedNames.has(c.name));
        }
      }

      return {
        data: this.currentResults,
        total_cards: res.total_cards,
        has_more: this.hasMore
      };
    }

    // Open Card Detail Modal
    openCardModal(card) {
      this.activeCard = card;
      this.activeFaceIndex = 0;

      const modal = document.getElementById('card-detail-modal');
      if (!modal) return;

      this.renderCardModalContent();
      modal.classList.add('visible');
    }

    closeCardModal() {
      const modal = document.getElementById('card-detail-modal');
      if (modal) modal.classList.remove('visible');
      this.activeCard = null;
    }

    // Flip face for double-faced / adventure cards
    flipActiveCardFace() {
      if (!this.activeCard || !this.activeCard.faces || this.activeCard.faces.length < 2) return;
      this.activeFaceIndex = this.activeFaceIndex === 0 ? 1 : 0;
      this.renderCardModalContent();
    }

    renderCardModalContent() {
      const card = this.activeCard;
      if (!card) return;

      const modalBody = document.getElementById('card-modal-body');
      if (!modalBody) return;

      const isMultiFace = card.faces && card.faces.length > 1;
      const currentFace = isMultiFace ? card.faces[this.activeFaceIndex] : null;

      const displayImg = isMultiFace
        ? (this.activeFaceIndex === 1 ? card.image_uri_back || currentFace?.image_uri : card.image_uri)
        : card.image_uri;

      const displayName = currentFace ? (currentFace.name_ja || currentFace.name) : (card.name_ja || card.name);
      const enName = currentFace ? currentFace.name : card.name;
      const manaCostHtml = Utils.renderManaCost(currentFace ? currentFace.mana_cost : card.mana_cost);
      const oracleText = (currentFace ? currentFace.oracle_text : card.oracle_text) || '（テキストなし）';
      const printedText = card.printed_text ? `<div class="card-printed-text"><strong>日本語テキスト:</strong> ${Utils.escapeHtml(card.printed_text)}</div>` : '';

      // Legalities Table
      const formatKeys = ['standard', 'pioneer', 'modern', 'legacy', 'vintage', 'commander', 'pauper'];
      let legalitiesHtml = '<div class="legalities-grid">';
      formatKeys.forEach((fmt) => {
        const leg = card.legalities ? card.legalities[fmt] || 'not_legal' : 'not_legal';
        const legClass = leg === 'legal' ? 'leg-legal' : leg === 'banned' ? 'leg-banned' : leg === 'restricted' ? 'leg-restricted' : 'leg-not-legal';
        const legLabel = leg === 'legal' ? '使用可' : leg === 'banned' ? '禁止' : leg === 'restricted' ? '制限' : '不可';
        legalitiesHtml += `<div class="leg-pill ${legClass}"><span class="leg-name">${fmt.toUpperCase()}:</span> ${legLabel}</div>`;
      });
      legalitiesHtml += '</div>';

      // Target Deck and Section options
      const decks = DeckBuilder.decks || [];
      const currentDeckId = DeckBuilder.currentDeck ? DeckBuilder.currentDeck.id : (decks[0]?.id || '');
      const isCmdFmt = DeckBuilder.currentDeck?.format === 'commander' || DeckBuilder.currentDeck?.format === 'brawl';
      const canCmd = DeckValidator.isCommanderEligible(card).eligible;
      const defaultSec = (isCmdFmt && canCmd && (DeckBuilder.currentDeck?.commanders || []).length === 0) ? 'commanders' : 'mainboard';

      const deckOptionsHtml = decks.length > 0
        ? decks.map((d) => `<option value="${d.id}" ${d.id === currentDeckId ? 'selected' : ''}>${Utils.escapeHtml(d.name)}</option>`).join('')
        : '<option value="__new__">＋ 新規デッキを自動作成</option>';

      modalBody.innerHTML = `
        <div class="card-modal-layout">
          <div class="card-modal-image-col">
            <div class="card-modal-img-wrap">
              <img src="${displayImg || 'assets/card-back.png'}" alt="${Utils.escapeHtml(card.name)}" class="card-modal-img" onerror="this.src='https://cards.scryfall.io/back.png'" />
              ${
                isMultiFace
                  ? `<button type="button" class="btn btn-secondary btn-flip-card" id="btn-flip-face"><span class="icon">🔄</span> 変身 / 裏面 (${this.activeFaceIndex === 0 ? '表面' : '裏面'})</button>`
                  : ''
              }
            </div>
            <div class="card-modal-prices">
              <span class="price-tag">Normal: $${card.prices?.usd || '-'}</span>
              <span class="price-tag">Foil: $${card.prices?.usd_foil || '-'}</span>
              <a href="${card.scryfall_uri}" target="_blank" rel="noopener noreferrer" class="link-scryfall">Scryfallで見る ↗</a>
            </div>
          </div>
          <div class="card-modal-info-col">
            <h2 class="card-modal-title">${Utils.escapeHtml(displayName)}</h2>
            <div class="card-modal-subtitle">${Utils.escapeHtml(enName)}</div>
            <div class="card-modal-meta">
              <div class="mana-display">${manaCostHtml}</div>
              <div class="type-display">${Utils.escapeHtml(currentFace ? currentFace.type_line : card.type_line)}</div>
              <div class="set-display">${Utils.escapeHtml(card.set_name || card.set)} (#${card.collector_number}) · ${card.rarity.toUpperCase()}</div>
            </div>
            <div class="card-oracle-box">
              <div class="oracle-text">${Utils.escapeHtml(oracleText).replace(/\n/g, '<br>')}</div>
              ${printedText}
            </div>
            <div class="card-modal-section-title">フォーマット使用可否</div>
            ${legalitiesHtml}
            <div class="card-modal-deck-row" style="margin-top: 14px; margin-bottom: 8px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <select id="modal-select-deck" style="padding: 6px 10px; font-size: 13px; flex: 2; min-width: 160px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                ${deckOptionsHtml}
              </select>
              <select id="modal-select-section" style="padding: 6px 10px; font-size: 13px; flex: 1; min-width: 120px; background: var(--bg-card); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px;">
                <option value="mainboard" ${defaultSec === 'mainboard' ? 'selected' : ''}>メインボード</option>
                <option value="commanders" ${defaultSec === 'commanders' ? 'selected' : ''}>統率者 (Cmd)</option>
                <option value="sideboard">サイドボード</option>
                <option value="maybeboard">候補 (Maybe)</option>
              </select>
            </div>
            <div class="card-modal-actions">
              <button type="button" class="btn btn-primary" id="btn-add-modal-to-deck">＋ デッキに追加</button>
              <button type="button" class="btn btn-secondary" id="btn-add-modal-to-col">＋ コレクション登録</button>
              <button type="button" class="btn btn-outline" id="btn-add-modal-to-wish">★ ウィッシュリスト</button>
            </div>
          </div>
        </div>
      `;

      // Attach button listeners inside modal
      const btnFlip = document.getElementById('btn-flip-face');
      if (btnFlip) {
        btnFlip.addEventListener('click', () => this.flipActiveCardFace());
      }

      const btnToDeck = document.getElementById('btn-add-modal-to-deck');
      if (btnToDeck) {
        btnToDeck.addEventListener('click', async () => {
          let deck = DeckBuilder.currentDeck;
          const deckSelect = document.getElementById('modal-select-deck');
          if (deckSelect) {
            if (deckSelect.value === '__new__') {
              deck = await DeckBuilder.createDeck('新規デッキ', 'commander');
            } else {
              deck = DeckBuilder.decks.find((d) => d.id === deckSelect.value) || deck;
            }
          }
          if (!deck) {
            if (DeckBuilder.decks.length > 0) {
              deck = DeckBuilder.setCurrentDeck(DeckBuilder.decks[0]);
            } else {
              deck = await DeckBuilder.createDeck('新規デッキ', 'commander');
            }
          } else {
            DeckBuilder.setCurrentDeck(deck);
          }

          const secSelect = document.getElementById('modal-select-section');
          const targetSection = secSelect ? secSelect.value : 'mainboard';

          DeckBuilder.addCard(card, targetSection, 1);
          const secName = targetSection === 'commanders' ? '統率者' : targetSection === 'sideboard' ? 'サイドボード' : targetSection === 'maybeboard' ? '候補' : 'メインボード';
          Utils.toast(`デッキ「${deck.name}」の${secName}に追加しました`, 'success');

          if (window.App && typeof window.App.renderDeckbuilder === 'function') {
            window.App.renderDeckbuilder();
          }
        });
      }

      const btnToCol = document.getElementById('btn-add-modal-to-col');
      if (btnToCol) {
        btnToCol.addEventListener('click', async () => {
          await Collection.addCard(card, { count: 1 });
          Utils.toast(`コレクションに「${card.display_name || card.name}」を1枚登録しました`, 'success');
          if (window.App && typeof window.App.renderDashboard === 'function') {
            window.App.renderDashboard();
          }
          if (window.App && typeof window.App.renderCollection === 'function') {
            window.App.renderCollection();
          }
        });
      }

      const btnToWish = document.getElementById('btn-add-modal-to-wish');
      if (btnToWish) {
        btnToWish.addEventListener('click', async () => {
          if (window.App && window.App.addToWishlist) {
            await window.App.addToWishlist(card);
            Utils.toast(`ウィッシュリストに「${card.display_name || card.name}」を追加しました`, 'success');
          } else {
            Utils.toast('ウィッシュリストに追加しました', 'success');
          }
        });
      }
    }
  }

  window.Search = new SearchManager();
})(window);

