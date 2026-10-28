/**
 * MTGCollectionSummary - app.js
 * Application master controller, tab routing, UI view renderer,
 * and event binding.
 */

(function (window) {
  'use strict';

  class AppController {
    constructor() {
      this.currentTab = 'dashboard';
      this.theme = 'dark';
      this.currency = 'USD';
      this.selectedColIds = new Set();
      this.wishlistItems = [];
      this.activeDeckFilter = 'all';
    }

    async init() {
      try {
        // 1. Initialize DB
        await DB.init();

        // 2. Load User Settings
        this.theme = (await DB.getSetting('theme')) || 'dark';
        this.currency = (await DB.getSetting('currency')) || 'USD';
        this.applyTheme(this.theme);

        // 3. Load Data
        await Collection.load();
        await DeckBuilder.load();
        this.wishlistItems = (await DB.getAll('wishlist')) || [];

        // 4. Default Deck Setup if none exists
        if (DeckBuilder.decks.length === 0) {
          const sampleDeck = await DeckBuilder.createDeck('サンプル EDH デッキ', 'commander');
          // Add basic sample cards to demonstrate immediately
          DeckBuilder.setCurrentDeck(sampleDeck);
        } else {
          DeckBuilder.setCurrentDeck(DeckBuilder.decks[0]);
        }

        // 5. Setup UI & Bind Events
        this.setupNavigation();
        this.setupSearchEvents();
        this.setupCollectionEvents();
        this.setupDeckbuilderEvents();
        this.setupImportExportEvents();
        this.setupWishlistEvents();
        this.setupSettingsEvents();
        this.setupGlobalShortcuts();

        // 6. Render Initial Tab
        this.switchTab('dashboard');

        console.log('MTGCollectionSummary initialized successfully.');
      } catch (err) {
        console.error('Initialization error:', err);
        Utils.toast('アプリ初期化中にエラーが発生しました: ' + err.message, 'error');
      }
    }

    // --- Tab Navigation & Routing ---
    setupNavigation() {
      const navLinks = document.querySelectorAll('.nav-item');
      navLinks.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.getAttribute('data-tab');
          if (target) this.switchTab(target);
        });
      });

      // Quick links on dashboard
      document.body.addEventListener('click', (e) => {
        const link = e.target.closest('[data-go-tab]');
        if (link) {
          e.preventDefault();
          const tab = link.getAttribute('data-go-tab');
          this.switchTab(tab);
        }
      });
    }

    switchTab(tabName) {
      this.currentTab = tabName;

      // Update active nav button
      document.querySelectorAll('.nav-item').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
      });

      // Show target tab section
      document.querySelectorAll('.tab-section').forEach((sec) => {
        sec.classList.toggle('active', sec.id === `tab-${tabName}`);
      });

      // Refresh view data
      switch (tabName) {
        case 'dashboard':
          this.renderDashboard();
          break;
        case 'collection':
          this.renderCollection();
          break;
        case 'decks':
          this.renderDeckList();
          break;
        case 'deckbuilder':
          this.renderDeckbuilder();
          break;
        case 'search':
          // Keep current search view
          break;
        case 'summary':
          this.renderSummaryAndStats();
          break;
        case 'wishlist':
          this.renderWishlist();
          break;
        case 'importer':
          this.renderImporter();
          break;
        case 'settings':
          this.renderSettings();
          break;
      }

      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    }

    // --- Theme Controller ---
    applyTheme(theme) {
      this.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      const toggleBtn = document.getElementById('btn-theme-toggle');
      if (toggleBtn) {
        toggleBtn.innerHTML = theme === 'dark' ? '☀️ ライト' : '🌙 ダーク';
      }
    }

    async toggleTheme() {
      const nextTheme = this.theme === 'dark' ? 'light' : 'dark';
      this.applyTheme(nextTheme);
      await DB.setSetting('theme', nextTheme);
    }

    // --- Dashboard View ---
    renderDashboard() {
      const colStats = Collection.analyze();
      const totalDecks = DeckBuilder.decks.length;

      const statTotalCards = document.getElementById('dash-stat-total-cards');
      const statUniqueCards = document.getElementById('dash-stat-unique-cards');
      const statTotalDecks = document.getElementById('dash-stat-total-decks');
      const statTotalValue = document.getElementById('dash-stat-total-value');

      if (statTotalCards) statTotalCards.textContent = colStats.totalCards.toLocaleString();
      if (statUniqueCards) statUniqueCards.textContent = colStats.uniqueCards.toLocaleString();
      if (statTotalDecks) statTotalDecks.textContent = totalDecks;
      if (statTotalValue) statTotalValue.textContent = Utils.formatCurrency(colStats.totalValueUsd, this.currency);

      // Recent Decks List
      const recentListContainer = document.getElementById('dash-recent-decks');
      if (recentListContainer) {
        const sorted = [...DeckBuilder.decks].sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        );
        if (sorted.length === 0) {
          recentListContainer.innerHTML = '<div class="empty-state">デッキがまだありません。「新規デッキ作成」から作成してみましょう。</div>';
        } else {
          recentListContainer.innerHTML = sorted.slice(0, 4).map((d) => {
            const cmd = d.commanders && d.commanders[0];
            const mainCount = (d.mainboard || []).reduce((s, i) => s + (i.count || 1), 0);
            const cmdCount = (d.commanders || []).length;
            const total = mainCount + cmdCount;
            return `
              <div class="deck-card" data-deck-id="${d.id}">
                <div class="deck-card-thumb" style="background-image: url('${cmd ? cmd.image_uri : 'assets/card-back.png'}')"></div>
                <div class="deck-card-content">
                  <div class="deck-card-badge">${(d.format || 'CASUAL').toUpperCase()}</div>
                  <h3 class="deck-card-title">${Utils.escapeHtml(d.name)}</h3>
                  <div class="deck-card-meta">
                    <span>${total}枚</span> · <span>更新: ${Utils.formatDate(d.updated_at)}</span>
                  </div>
                </div>
                <div class="deck-card-actions">
                  <button type="button" class="btn btn-sm btn-primary btn-open-deck" data-deck-id="${d.id}">編集</button>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // Quick High Value Cards
      const highValContainer = document.getElementById('dash-high-value-cards');
      if (highValContainer) {
        if (colStats.highValueList.length === 0) {
          highValContainer.innerHTML = '<div class="empty-state">高額カードはまだ登録されていません。</div>';
        } else {
          highValContainer.innerHTML = colStats.highValueList.slice(0, 5).map((c) => {
            return `
              <div class="high-val-row">
                <img src="${c.image_uri || 'https://cards.scryfall.io/back.png'}" class="high-val-img" alt="" />
                <div class="high-val-info">
                  <div class="high-val-name">${Utils.escapeHtml(c.display_name || c.name)}</div>
                  <div class="high-val-set">${c.set} #${c.collector_number} ${c.foil ? '✨Foil' : ''}</div>
                </div>
                <div class="high-val-price">$${c.unitPrice.toFixed(2)}</div>
              </div>
            `;
          }).join('');
        }
      }
    }

    // --- Collection View ---
    renderCollection() {
      const q = document.getElementById('col-filter-query')?.value || '';
      const set = document.getElementById('col-filter-set')?.value || '';
      const rarity = document.getElementById('col-filter-rarity')?.value || '';
      const foil = document.getElementById('col-filter-foil')?.value || 'all';
      const sortBy = document.getElementById('col-sort-select')?.value || 'name_asc';

      const filtered = Collection.filter({ query: q, set, rarity, foil });
      const sorted = Collection.sort(filtered, sortBy);

      const tableBody = document.getElementById('col-table-body');
      const countDisplay = document.getElementById('col-item-count');

      if (countDisplay) {
        const totalOwnedInView = sorted.reduce((s, i) => s + (i.count || 0), 0);
        countDisplay.textContent = `表示中: ${sorted.length}種 (${totalOwnedInView}枚)`;
      }

      if (!tableBody) return;

      if (sorted.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center empty-state">該当するカードがコレクションにありません。</td></tr>`;
        return;
      }

      tableBody.innerHTML = sorted.map((item) => {
        const isChecked = this.selectedColIds.has(item.id);
        const price = item.foil ? (item.price_usd_foil || item.price_usd || 0) : (item.price_usd || 0);
        return `
          <tr data-col-id="${item.id}" class="${isChecked ? 'row-selected' : ''}">
            <td><input type="checkbox" class="col-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}></td>
            <td>
              <div class="col-card-cell">
                <img src="${item.image_uri || 'https://cards.scryfall.io/back.png'}" class="col-thumb" alt="" loading="lazy" />
                <div class="col-card-names">
                  <span class="col-card-primary">${Utils.escapeHtml(item.display_name || item.name)}</span>
                  <span class="col-card-secondary">${Utils.escapeHtml(item.name)}</span>
                </div>
              </div>
            </td>
            <td><span class="badge badge-set">${item.set}</span> #${item.collector_number}</td>
            <td><span class="badge badge-rarity badge-${item.rarity}">${item.rarity.toUpperCase()}</span></td>
            <td>${item.foil ? '<span class="badge badge-foil">✨ Foil</span>' : '<span class="text-muted">通常</span>'}</td>
            <td><span class="badge badge-condition">${item.condition || 'NM'}</span></td>
            <td>
              <div class="qty-control">
                <button type="button" class="btn-qty btn-qty-minus" data-id="${item.id}">-</button>
                <span class="qty-val">${item.count}</span>
                <button type="button" class="btn-qty btn-qty-plus" data-id="${item.id}">+</button>
              </div>
            </td>
            <td>$${price.toFixed(2)}</td>
            <td>
              <div class="action-buttons-cell">
                <button type="button" class="btn btn-xs btn-outline btn-col-to-deck" data-id="${item.id}" title="デッキに追加">＋Deck</button>
                <button type="button" class="btn btn-xs btn-danger btn-col-delete" data-id="${item.id}" title="削除">✕</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    setupCollectionEvents() {
      // Filter changes
      ['col-filter-query', 'col-filter-set', 'col-filter-rarity', 'col-filter-foil', 'col-sort-select'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener('input', Utils.debounce(() => this.renderCollection(), 200));
        }
      });

      // Quantity adjustments and actions delegation
      const tableBody = document.getElementById('col-table-body');
      if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
          const btnPlus = e.target.closest('.btn-qty-plus');
          const btnMinus = e.target.closest('.btn-qty-minus');
          const btnDelete = e.target.closest('.btn-col-delete');
          const btnToDeck = e.target.closest('.btn-col-to-deck');
          const chk = e.target.closest('.col-checkbox');

          if (btnPlus) {
            const id = btnPlus.getAttribute('data-id');
            await Collection.changeCount(id, 1);
            this.renderCollection();
          } else if (btnMinus) {
            const id = btnMinus.getAttribute('data-id');
            await Collection.changeCount(id, -1);
            this.renderCollection();
          } else if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            if (confirm('このカードをコレクションから削除しますか？')) {
              await Collection.deleteCard(id);
              this.selectedColIds.delete(id);
              this.renderCollection();
              Utils.toast('コレクションから削除しました', 'info');
            }
          } else if (btnToDeck) {
            const id = btnToDeck.getAttribute('data-id');
            const item = Collection.items.find((i) => i.id === id);
            if (item && DeckBuilder.currentDeck) {
              DeckBuilder.addCard(item, 'main', 1);
              Utils.toast(`デッキ「${DeckBuilder.currentDeck.name}」に追加しました`, 'success');
            } else {
              Utils.toast('対象のデッキを選択してください', 'warning');
            }
          } else if (chk) {
            const id = chk.getAttribute('data-id');
            if (chk.checked) this.selectedColIds.add(id);
            else this.selectedColIds.delete(id);
          }
        });
      }

      // Select All Checkbox
      const chkAll = document.getElementById('col-check-all');
      if (chkAll) {
        chkAll.addEventListener('change', (e) => {
          const checked = e.target.checked;
          const visibleCheckboxes = document.querySelectorAll('.col-checkbox');
          visibleCheckboxes.forEach((cb) => {
            cb.checked = checked;
            const id = cb.getAttribute('data-id');
            if (checked) this.selectedColIds.add(id);
            else this.selectedColIds.delete(id);
          });
          this.renderCollection();
        });
      }

      // Batch Delete
      const btnBatchDel = document.getElementById('btn-col-batch-delete');
      if (btnBatchDel) {
        btnBatchDel.addEventListener('click', async () => {
          if (this.selectedColIds.size === 0) {
            Utils.toast('選択されたカードがありません', 'warning');
            return;
          }
          if (confirm(`選択中の ${this.selectedColIds.size} 件のカードを削除しますか？`)) {
            await Collection.batchDelete(Array.from(this.selectedColIds));
            this.selectedColIds.clear();
            this.renderCollection();
            Utils.toast('一括削除しました', 'success');
          }
        });
      }

      // Open Card Search from Collection
      const btnOpenSearch = document.getElementById('btn-col-add-card');
      if (btnOpenSearch) {
        btnOpenSearch.addEventListener('click', () => {
          this.switchTab('search');
        });
      }
    }

    // --- Deck List View ---
    renderDeckList() {
      const container = document.getElementById('deck-list-grid');
      if (!container) return;

      if (DeckBuilder.decks.length === 0) {
        container.innerHTML = '<div class="empty-state">デッキがありません。「＋ 新規デッキ作成」ボタンを押してデッキを作成しましょう。</div>';
        return;
      }

      container.innerHTML = DeckBuilder.decks.map((deck) => {
        const cmd = deck.commanders && deck.commanders[0];
        const mainCount = (deck.mainboard || []).reduce((s, i) => s + (i.count || 1), 0);
        const cmdCount = (deck.commanders || []).length;
        const total = mainCount + cmdCount;
        const validation = DeckValidator.validateDeck(deck);

        return `
          <div class="deck-card ${deck.favorite ? 'deck-card-fav' : ''}">
            <div class="deck-card-thumb" style="background-image: url('${cmd ? cmd.image_uri : 'assets/card-back.png'}')"></div>
            <div class="deck-card-content">
              <div class="deck-card-top-row">
                <span class="badge badge-format">${(deck.format || 'CASUAL').toUpperCase()}</span>
                ${validation.isValid ? '<span class="badge badge-success">✓ 適合</span>' : `<span class="badge badge-warning">⚠ ${validation.errors.length}件の警告</span>`}
                ${deck.favorite ? '⭐' : ''}
              </div>
              <h3 class="deck-card-title">${Utils.escapeHtml(deck.name)}</h3>
              <div class="deck-card-meta">
                <span>枚数: ${total}枚</span> · <span>ブラケット: ${deck.bracket || 2}</span>
              </div>
              <div class="deck-card-date">更新: ${Utils.formatDate(deck.updated_at)}</div>
            </div>
            <div class="deck-card-actions">
              <button type="button" class="btn btn-sm btn-primary btn-open-deck" data-deck-id="${deck.id}">ビルダーで開く</button>
              <button type="button" class="btn btn-sm btn-outline btn-rename-deck" data-deck-id="${deck.id}" title="デッキ名を変更">✏️ 名前</button>
              <button type="button" class="btn btn-sm btn-outline btn-dup-deck" data-deck-id="${deck.id}" title="複製">複製</button>
              <button type="button" class="btn btn-sm btn-danger btn-del-deck" data-deck-id="${deck.id}" title="削除">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }

    setupDeckbuilderEvents() {
      // Global Deck List actions
      document.body.addEventListener('click', async (e) => {
        const btnOpen = e.target.closest('.btn-open-deck');
        const btnRename = e.target.closest('.btn-rename-deck');
        const btnDup = e.target.closest('.btn-dup-deck');
        const btnDel = e.target.closest('.btn-del-deck');

        if (btnOpen) {
          const id = btnOpen.getAttribute('data-deck-id');
          DeckBuilder.setCurrentDeck(id);
          this.switchTab('deckbuilder');
        } else if (btnRename) {
          const id = btnRename.getAttribute('data-deck-id');
          const targetDeck = DeckBuilder.decks.find((d) => d.id === id);
          if (targetDeck) {
            const newName = prompt('新しいデッキ名を入力してください:', targetDeck.name);
            if (newName && newName.trim() && newName.trim() !== targetDeck.name) {
              await this.handleDeckRenamed(id, newName.trim());
              Utils.toast(`デッキ名を「${newName.trim()}」に変更しました`, 'success');
            }
          }
        } else if (btnDup) {
          const id = btnDup.getAttribute('data-deck-id');
          await DeckBuilder.duplicateDeck(id);
          this.renderDeckList();
          Utils.toast('デッキを複製しました', 'success');
        } else if (btnDel) {
          const id = btnDel.getAttribute('data-deck-id');
          if (confirm('本当にこのデッキを削除しますか？')) {
            await DeckBuilder.deleteDeck(id);
            this.renderDeckList();
            Utils.toast('デッキを削除しました', 'info');
          }
        }
      });

      // New Deck Button
      const btnNewDeck = document.getElementById('btn-new-deck');
      if (btnNewDeck) {
        btnNewDeck.addEventListener('click', async () => {
          const name = prompt('デッキ名を入力してください:', '新規デッキ');
          if (!name) return;
          const format = prompt('フォーマットを入力してください (commander, standard, modern, pioneer, legacy, pauper, brawl, casual):', 'commander');
          const validFormat = DeckValidator.FORMATS[format] ? format : 'casual';
          const newDeck = await DeckBuilder.createDeck(name, validFormat);
          DeckBuilder.setCurrentDeck(newDeck);
          this.switchTab('deckbuilder');
        });
      }

      // Deck Info Inputs
      const deckNameInput = document.getElementById('deck-name-input');
      const deckFormatSelect = document.getElementById('deck-format-select');
      const deckBracketSelect = document.getElementById('deck-bracket-select');

      if (deckNameInput) {
        deckNameInput.addEventListener('change', async () => {
          if (DeckBuilder.currentDeck) {
            const newName = deckNameInput.value.trim();
            if (newName && newName !== DeckBuilder.currentDeck.name) {
              await this.handleDeckRenamed(DeckBuilder.currentDeck.id, newName);
              Utils.toast(`デッキ名を「${newName}」に更新・同期しました`, 'info');
            }
          }
        });
      }

      if (deckFormatSelect) {
        deckFormatSelect.addEventListener('change', () => {
          if (DeckBuilder.currentDeck) {
            DeckBuilder.currentDeck.format = deckFormatSelect.value;
            DeckBuilder.saveCurrentDeck();
            this.renderDeckbuilder();
          }
        });
      }

      if (deckBracketSelect) {
        deckBracketSelect.addEventListener('change', () => {
          if (DeckBuilder.currentDeck) {
            DeckBuilder.currentDeck.bracket = parseInt(deckBracketSelect.value, 10) || 2;
            DeckBuilder.saveCurrentDeck();
            this.renderDeckbuilder();
          }
        });
      }

      // Deck Builder Undo / Redo
      const btnUndo = document.getElementById('btn-deck-undo');
      const btnRedo = document.getElementById('btn-deck-redo');
      if (btnUndo) {
        btnUndo.addEventListener('click', () => {
          if (DeckBuilder.undo()) {
            this.renderDeckbuilder();
            Utils.toast('元に戻しました', 'info');
          }
        });
      }
      if (btnRedo) {
        btnRedo.addEventListener('click', () => {
          if (DeckBuilder.redo()) {
            this.renderDeckbuilder();
            Utils.toast('やり直しました', 'info');
          }
        });
      }

      // Hand Simulator Button
      const btnSimHand = document.getElementById('btn-open-simulator');
      if (btnSimHand) {
        btnSimHand.addEventListener('click', () => {
          this.openHandSimulatorModal();
        });
      }

      // Deck Version Snapshot Button
      const btnSnapshot = document.getElementById('btn-deck-snapshot');
      if (btnSnapshot) {
        btnSnapshot.addEventListener('click', async () => {
          if (!DeckBuilder.currentDeck) return;
          const note = prompt('バージョンメモ（例: 「土地34枚に調整」「新セットカード追加」など）:');
          if (note !== null) {
            await DeckBuilder.saveVersionSnapshot(DeckBuilder.currentDeck.id, note);
            Utils.toast('スナップショットを保存しました', 'success');
          }
        });
      }

      // Multi-deck Shortage Analyzer Button
      const btnMultiShortage = document.getElementById('btn-multi-deck-shortage');
      if (btnMultiShortage) {
        btnMultiShortage.addEventListener('click', () => {
          this.openMultiDeckShortageModal();
        });
      }

      // Compare Decks Button
      const btnCompareDecks = document.getElementById('btn-deck-compare');
      if (btnCompareDecks) {
        btnCompareDecks.addEventListener('click', () => {
          this.openDeckCompareModal();
        });
      }
    }

    // --- Deck Builder View Render ---
    renderDeckbuilder() {
      const deck = DeckBuilder.currentDeck;
      if (!deck) {
        const wrap = document.getElementById('deckbuilder-content');
        if (wrap) wrap.innerHTML = '<div class="empty-state">デッキが選択されていません。「デッキ一覧」から選択してください。</div>';
        return;
      }

      // Update Header Controls
      const deckNameInput = document.getElementById('deck-name-input');
      const deckFormatSelect = document.getElementById('deck-format-select');
      const deckBracketSelect = document.getElementById('deck-bracket-select');

      if (deckNameInput) deckNameInput.value = deck.name || '';
      if (deckFormatSelect) deckFormatSelect.value = deck.format || 'commander';
      if (deckBracketSelect) deckBracketSelect.value = deck.bracket || 2;

      // Run Deck Validation
      const validation = DeckValidator.validateDeck(deck);
      const validationBox = document.getElementById('deck-validation-box');
      if (validationBox) {
        if (validation.isValid && validation.warnings.length === 0) {
          validationBox.innerHTML = '<div class="alert alert-success">✓ すべてのフォーマット構築条件を満たしています。</div>';
        } else {
          let messages = '';
          validation.errors.forEach((err) => {
            messages += `<div class="val-error">❌ ${Utils.escapeHtml(err)}</div>`;
          });
          validation.warnings.forEach((warn) => {
            messages += `<div class="val-warning">⚠️ ${Utils.escapeHtml(warn)}</div>`;
          });
          validation.notices.forEach((note) => {
            messages += `<div class="val-notice">ℹ️ ${Utils.escapeHtml(note)}</div>`;
          });
          validationBox.innerHTML = messages;
        }
      }

      // Render Commanders
      const cmdContainer = document.getElementById('deck-commanders-list');
      if (cmdContainer) {
        if ((deck.commanders || []).length === 0) {
          cmdContainer.innerHTML = '<div class="empty-state-sm">統率者が設定されていません。「カード検索」から統率者を追加してください。</div>';
        } else {
          cmdContainer.innerHTML = deck.commanders.map((c) => {
            return `
              <div class="deck-card-item cmd-item">
                <img src="${c.image_uri || 'https://cards.scryfall.io/back.png'}" class="deck-item-thumb" alt="" />
                <div class="deck-item-info">
                  <div class="deck-item-name">${Utils.escapeHtml(c.display_name || c.name)}</div>
                  <div class="deck-item-meta">${c.mana_cost || ''} · ${c.type_line || ''}</div>
                </div>
                <div class="deck-item-actions">
                  <button type="button" class="btn btn-xs btn-outline btn-move-cmd-main" data-name="${Utils.escapeHtml(c.name)}">メインへ移動</button>
                  <button type="button" class="btn btn-xs btn-danger btn-del-cmd" data-name="${Utils.escapeHtml(c.name)}">✕</button>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // Group Mainboard by Card Type
      const mainContainer = document.getElementById('deck-mainboard-list');
      if (mainContainer) {
        const sortedItems = Exporter.sortCards(deck.mainboard || [], 'type');
        const totalMain = (deck.mainboard || []).reduce((s, i) => s + (i.count || 1), 0);

        const mainCountHeader = document.getElementById('deck-main-count-header');
        if (mainCountHeader) mainCountHeader.textContent = `(${totalMain}枚)`;

        if (sortedItems.length === 0) {
          mainContainer.innerHTML = '<div class="empty-state-sm">メインボードにカードがありません。「カード検索」からカードを追加してください。</div>';
        } else {
          mainContainer.innerHTML = sortedItems.map((item) => {
            const card = item.card;
            return `
              <div class="deck-card-item">
                <div class="deck-item-qty-wrap">
                  <button type="button" class="btn-qty btn-main-minus" data-name="${Utils.escapeHtml(card.name)}">-</button>
                  <span class="qty-val">${item.count}</span>
                  <button type="button" class="btn-qty btn-main-plus" data-name="${Utils.escapeHtml(card.name)}">+</button>
                </div>
                <div class="deck-item-info" data-card-name="${Utils.escapeHtml(card.name)}">
                  <span class="deck-item-name">${Utils.escapeHtml(card.display_name || card.name)}</span>
                  <span class="deck-item-cost">${Utils.renderManaCost(card.mana_cost)}</span>
                </div>
                <div class="deck-item-actions">
                  <button type="button" class="btn btn-xs btn-outline btn-to-side" data-name="${Utils.escapeHtml(card.name)}" title="サイドへ移動">Side</button>
                  <button type="button" class="btn btn-xs btn-danger btn-del-main" data-name="${Utils.escapeHtml(card.name)}" title="削除">✕</button>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // Sideboard & Maybeboard
      const sideContainer = document.getElementById('deck-sideboard-list');
      if (sideContainer) {
        const sideItems = deck.sideboard || [];
        const totalSide = sideItems.reduce((s, i) => s + (i.count || 1), 0);
        const sideCountHeader = document.getElementById('deck-side-count-header');
        if (sideCountHeader) sideCountHeader.textContent = `(${totalSide}枚)`;

        sideContainer.innerHTML = sideItems.map((item) => {
          return `
            <div class="deck-card-item">
              <span class="qty-val">${item.count}</span>
              <span class="deck-item-name">${Utils.escapeHtml(item.card.display_name || item.card.name)}</span>
              <button type="button" class="btn btn-xs btn-outline btn-to-main" data-name="${Utils.escapeHtml(item.card.name)}">Mainへ</button>
              <button type="button" class="btn btn-xs btn-danger btn-del-side" data-name="${Utils.escapeHtml(item.card.name)}">✕</button>
            </div>
          `;
        }).join('');
      }

      // Attach Deck Item Manipulation Listeners
      this.attachDeckItemListeners();
    }

    attachDeckItemListeners() {
      const container = document.getElementById('deckbuilder-content');
      if (!container) return;

      container.onclick = async (e) => {
        const btnPlus = e.target.closest('.btn-main-plus');
        const btnMinus = e.target.closest('.btn-main-minus');
        const btnDelMain = e.target.closest('.btn-del-main');
        const btnToSide = e.target.closest('.btn-to-side');
        const btnToMain = e.target.closest('.btn-to-main');
        const btnDelSide = e.target.closest('.btn-del-side');
        const btnDelCmd = e.target.closest('.btn-del-cmd');
        const btnMoveCmd = e.target.closest('.btn-move-cmd-main');

        if (btnPlus) {
          const name = btnPlus.getAttribute('data-name');
          const item = (DeckBuilder.currentDeck.mainboard || []).find((i) => i.card.name === name);
          if (item) {
            DeckBuilder.updateCardCount(name, 'main', item.count + 1);
            this.renderDeckbuilder();
          }
        } else if (btnMinus) {
          const name = btnMinus.getAttribute('data-name');
          const item = (DeckBuilder.currentDeck.mainboard || []).find((i) => i.card.name === name);
          if (item) {
            DeckBuilder.updateCardCount(name, 'main', item.count - 1);
            this.renderDeckbuilder();
          }
        } else if (btnDelMain) {
          const name = btnDelMain.getAttribute('data-name');
          DeckBuilder.updateCardCount(name, 'main', 0);
          this.renderDeckbuilder();
        } else if (btnToSide) {
          const name = btnToSide.getAttribute('data-name');
          DeckBuilder.moveCardSection(name, 'main', 'sideboard');
          this.renderDeckbuilder();
        } else if (btnToMain) {
          const name = btnToMain.getAttribute('data-name');
          DeckBuilder.moveCardSection(name, 'sideboard', 'main');
          this.renderDeckbuilder();
        } else if (btnDelSide) {
          const name = btnDelSide.getAttribute('data-name');
          DeckBuilder.updateCardCount(name, 'sideboard', 0);
          this.renderDeckbuilder();
        } else if (btnDelCmd) {
          const name = btnDelCmd.getAttribute('data-name');
          DeckBuilder.updateCardCount(name, 'commander', 0);
          this.renderDeckbuilder();
        } else if (btnMoveCmd) {
          const name = btnMoveCmd.getAttribute('data-name');
          DeckBuilder.moveCardSection(name, 'commander', 'main');
          this.renderDeckbuilder();
        }
      };
    }

    // --- Search View Setup ---
    setupSearchEvents() {
      const searchInput = document.getElementById('search-input');
      const searchForm = document.getElementById('search-filter-form');
      const btnViewGrid = document.getElementById('btn-view-grid');
      const btnViewList = document.getElementById('btn-view-list');
      const btnLoadMore = document.getElementById('btn-search-load-more');

      const triggerSearch = async (page = 1) => {
        const filters = {
          name: searchInput ? searchInput.value : '',
          colors: Array.from(document.querySelectorAll('.filter-color-chk:checked')).map((c) => c.value),
          colorMode: document.getElementById('filter-color-mode')?.value || '>=',
          type: document.getElementById('filter-type')?.value || 'all',
          rarity: document.getElementById('filter-rarity')?.value || 'all',
          format: document.getElementById('filter-format')?.value || 'all',
          ownership: document.getElementById('filter-ownership')?.value || 'all',
          oracleText: document.getElementById('filter-oracle')?.value || ''
        };

        const loader = document.getElementById('search-loader');
        if (loader) loader.classList.remove('hidden');

        try {
          const res = await Search.executeSearch(filters, page);
          this.renderSearchResults();
          if (btnLoadMore) {
            btnLoadMore.style.display = res.has_more ? 'block' : 'none';
          }
        } finally {
          if (loader) loader.classList.add('hidden');
        }
      };

      if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(() => triggerSearch(1), 400));
      }

      if (searchForm) {
        searchForm.addEventListener('change', () => triggerSearch(1));
        searchForm.addEventListener('submit', (e) => {
          e.preventDefault();
          triggerSearch(1);
        });
      }

      if (btnLoadMore) {
        btnLoadMore.addEventListener('click', () => {
          triggerSearch(Search.currentPage + 1);
        });
      }

      if (btnViewGrid && btnViewList) {
        btnViewGrid.addEventListener('click', () => {
          Search.viewMode = 'grid';
          btnViewGrid.classList.add('active');
          btnViewList.classList.remove('active');
          this.renderSearchResults();
        });
        btnViewList.addEventListener('click', () => {
          Search.viewMode = 'list';
          btnViewList.classList.add('active');
          btnViewGrid.classList.remove('active');
          this.renderSearchResults();
        });
      }

      // Modal close button
      const btnCloseModal = document.getElementById('btn-close-card-modal');
      const modalBg = document.getElementById('card-detail-modal');
      if (btnCloseModal) btnCloseModal.addEventListener('click', () => Search.closeCardModal());
      if (modalBg) {
        modalBg.addEventListener('click', (e) => {
          if (e.target === modalBg) Search.closeCardModal();
        });
      }
    }

    renderSearchResults() {
      const container = document.getElementById('search-results-container');
      if (!container) return;

      const results = Search.currentResults;
      if (results.length === 0) {
        container.innerHTML = '<div class="empty-state">該当するカードが見つかりませんでした。条件を変更して再検索してください。</div>';
        return;
      }

      if (Search.viewMode === 'grid') {
        container.innerHTML = `
          <div class="search-grid">
            ${results.map((c) => {
              return `
                <div class="search-card-tile" data-card-id="${c.id}">
                  <img src="${c.image_uri || 'https://cards.scryfall.io/back.png'}" class="search-card-img" alt="${Utils.escapeHtml(c.name)}" loading="lazy" />
                  <div class="search-card-overlay">
                    <div class="search-card-overlay-name">${Utils.escapeHtml(c.display_name || c.name)}</div>
                    <div class="search-card-overlay-actions">
                      <button type="button" class="btn btn-xs btn-primary btn-quick-deck" data-card-id="${c.id}">＋Deck</button>
                      <button type="button" class="btn btn-xs btn-secondary btn-quick-col" data-card-id="${c.id}">＋Col</button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>カード名</th>
                  <th>マナコスト</th>
                  <th>タイプ</th>
                  <th>セット</th>
                  <th>レアリティ</th>
                  <th>価格</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${results.map((c) => {
                  return `
                    <tr data-card-id="${c.id}">
                      <td><strong>${Utils.escapeHtml(c.display_name || c.name)}</strong><br><small class="text-muted">${Utils.escapeHtml(c.name)}</small></td>
                      <td>${Utils.renderManaCost(c.mana_cost)}</td>
                      <td>${Utils.escapeHtml(c.type_line)}</td>
                      <td>${c.set}</td>
                      <td><span class="badge badge-rarity badge-${c.rarity}">${c.rarity.toUpperCase()}</span></td>
                      <td>$${c.prices?.usd || '-'}</td>
                      <td>
                        <button type="button" class="btn btn-xs btn-primary btn-quick-deck" data-card-id="${c.id}">＋Deck</button>
                        <button type="button" class="btn btn-xs btn-secondary btn-quick-col" data-card-id="${c.id}">＋Col</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // Delegate click to open modal or quick add
      container.onclick = async (e) => {
        const btnDeck = e.target.closest('.btn-quick-deck');
        const btnCol = e.target.closest('.btn-quick-col');
        const tile = e.target.closest('[data-card-id]');

        if (btnDeck) {
          e.stopPropagation();
          const cardId = btnDeck.getAttribute('data-card-id');
          const card = results.find((c) => c.id === cardId);
          if (card) {
            let deck = DeckBuilder.currentDeck;
            if (!deck && DeckBuilder.decks.length > 0) {
              deck = DeckBuilder.setCurrentDeck(DeckBuilder.decks[0]);
            } else if (!deck) {
              deck = await DeckBuilder.createDeck('新規デッキ', 'commander');
            }
            DeckBuilder.addCard(card, 'mainboard', 1);
            Utils.toast(`デッキ「${deck.name}」に追加しました`, 'success');
            if (typeof this.renderDeckbuilder === 'function') this.renderDeckbuilder();
          }
        } else if (btnCol) {
          e.stopPropagation();
          const cardId = btnCol.getAttribute('data-card-id');
          const card = results.find((c) => c.id === cardId);
          if (card) {
            await Collection.addCard(card, { count: 1 });
            Utils.toast(`コレクションに「${card.display_name || card.name}」を追加しました`, 'success');
            if (typeof this.renderDashboard === 'function') this.renderDashboard();
            if (typeof this.renderCollection === 'function') this.renderCollection();
          }
        } else if (tile) {
          const cardId = tile.getAttribute('data-card-id');
          const card = results.find((c) => c.id === cardId);
          if (card) Search.openCardModal(card);
        }
      };
    }

    // --- Deck Renaming & Full Synchronization ---
    async handleDeckRenamed(deckId, newName) {
      if (!deckId || !newName) return;
      const cleanName = newName.trim();
      if (!cleanName) return;

      const result = await DeckBuilder.renameDeck(deckId, cleanName);
      if (!result) return;
      const { oldName } = result;

      // 1. Sync Wishlist items that referenced the old deck name
      if (Array.isArray(this.wishlistItems)) {
        let wishUpdated = 0;
        for (const item of this.wishlistItems) {
          if (item.linked_deck === oldName) {
            item.linked_deck = cleanName;
            if (window.DB) await window.DB.put('wishlist', item);
            wishUpdated++;
          }
        }
        if (wishUpdated > 0 && typeof this.renderWishlist === 'function') {
          this.renderWishlist();
        }
      }

      // 2. Update deck name input in Deckbuilder if active
      const deckNameInput = document.getElementById('deck-name-input');
      if (deckNameInput && DeckBuilder.currentDeck && DeckBuilder.currentDeck.id === deckId) {
        if (deckNameInput.value !== cleanName) deckNameInput.value = cleanName;
      }

      // 3. Update Summary target selector and active view
      this.populateSummaryTargetSelect();
      if (this.currentTab === 'summary') {
        this.renderSummaryAndStats();
      }

      // 4. Update Card Modal target deck options if present
      const modalSelectDeck = document.getElementById('modal-select-deck');
      if (modalSelectDeck) {
        const opt = modalSelectDeck.querySelector(`option[value="${deckId}"]`);
        if (opt) opt.textContent = cleanName;
      }

      // 5. Update Deck List
      if (typeof this.renderDeckList === 'function') {
        this.renderDeckList();
      }

      // 6. Update Dashboard Recent Decks
      if (typeof this.renderDashboard === 'function') {
        this.renderDashboard();
      }

      // 7. Update Importer / Exporter if active
      if (typeof this.renderImporter === 'function') {
        this.renderImporter();
      }
    }

    // Populate & synchronize Summary Target Selector UI
    populateSummaryTargetSelect() {
      const targetSelect = document.getElementById('summary-target-select');
      const segColCount = document.getElementById('seg-col-count');
      const btnSegCol = document.getElementById('btn-seg-collection');
      const targetBadge = document.getElementById('summary-target-badge');

      const totalColCards = Collection.items.reduce((s, i) => s + (i.count || 1), 0);
      if (segColCount) segColCount.textContent = `${totalColCards.toLocaleString()}枚`;

      if (targetSelect) {
        const currentVal = this.summaryTarget || targetSelect.value || (DeckBuilder.currentDeck ? DeckBuilder.currentDeck.id : '__collection__');
        let optionsHtml = `<option value="__collection__">📦 コレクション全体 (合計 ${totalColCards.toLocaleString()}枚)</option>`;
        if (DeckBuilder.decks && DeckBuilder.decks.length > 0) {
          optionsHtml += '<optgroup label="── 🎴 構築デッキ一覧 ──">';
          DeckBuilder.decks.forEach((d) => {
            const cardCnt = (d.commanders?.length || 0) + (d.mainboard?.length || 0) + (d.sideboard?.length || 0);
            optionsHtml += `<option value="${d.id}" ${d.id === currentVal ? 'selected' : ''}>🎴 [${(d.format || 'casual').toUpperCase()}] ${Utils.escapeHtml(d.name)} (${cardCnt}枚)</option>`;
          });
          optionsHtml += '</optgroup>';
        }
        targetSelect.innerHTML = optionsHtml;
        targetSelect.value = currentVal;
        this.summaryTarget = targetSelect.value;

        // Visual highlights for Segment button, Dropdown, and Badge
        const isCol = this.summaryTarget === '__collection__';
        if (btnSegCol) {
          btnSegCol.classList.toggle('active', isCol);
        }
        targetSelect.classList.toggle('active-picker', !isCol);

        if (targetBadge) {
          if (isCol) {
            targetBadge.className = 'badge badge-primary';
            targetBadge.textContent = '📦 コレクション全体';
          } else {
            const currentDeck = DeckBuilder.decks.find((d) => d.id === this.summaryTarget) || DeckBuilder.currentDeck;
            targetBadge.className = 'badge badge-format';
            targetBadge.textContent = `🎴 [${(currentDeck?.format || 'casual').toUpperCase()}] ${currentDeck ? currentDeck.name : 'デッキ'}`;
          }
        }
      }
    }

    // --- Summary & Statistics View ---
    renderSummaryAndStats() {
      const summaryWrap = document.getElementById('summary-view-content');
      if (!summaryWrap) return;

      const titleElem = document.getElementById('summary-view-title');
      const targetSelect = document.getElementById('summary-target-select');
      const btnSegCol = document.getElementById('btn-seg-collection');

      // Populate target selector controls
      this.populateSummaryTargetSelect();

      // Bind Segment button
      if (btnSegCol) {
        btnSegCol.onclick = () => {
          this.summaryTarget = '__collection__';
          this.populateSummaryTargetSelect();
          this.renderSummaryAndStats();
        };
      }

      // Bind Target Select dropdown
      if (targetSelect) {
        targetSelect.onchange = () => {
          this.summaryTarget = targetSelect.value;
          if (this.summaryTarget !== '__collection__') {
            const chosenDeck = DeckBuilder.decks.find((d) => d.id === this.summaryTarget);
            if (chosenDeck) DeckBuilder.setCurrentDeck(chosenDeck);
          }
          this.populateSummaryTargetSelect();
          this.renderSummaryAndStats();
        };
      }

      const isCollection = (this.summaryTarget === '__collection__') || (!DeckBuilder.currentDeck && (!DeckBuilder.decks || DeckBuilder.decks.length === 0));

      const colorPalette = {
        W: '#f8fafc',
        U: '#38bdf8',
        B: '#64748b',
        R: '#f87171',
        G: '#4ade80',
        C: '#94a3b8',
        Multi: '#fbbf24'
      };

      const btnCopySummary = document.getElementById('btn-copy-summary');
      const btnDownloadSummary = document.getElementById('btn-download-summary');
      const btnPrintSummary = document.getElementById('btn-print-summary');
      const btnAddMissingToWish = document.getElementById('btn-missing-to-wishlist');
      const subtableTitle = document.getElementById('stat-subtable-title');
      const subtableHead = document.getElementById('stat-subtable-head');
      const subtableBody = document.getElementById('stat-hyper-table-body');
      const summaryBox = document.getElementById('summary-text-box');

      if (isCollection) {
        // --- Render Collection Summary ---
        if (titleElem) titleElem.textContent = '📦 コレクション全体のサマリー・統計';
        const colStats = Collection.analyze();

        // 6 Stat Boxes (Labels & Values)
        const statBoxes = document.querySelectorAll('#tab-summary .dash-stats-grid .stat-box');
        if (statBoxes && statBoxes.length >= 6) {
          statBoxes[0].querySelector('.stat-label').textContent = 'コレクション総枚数';
          statBoxes[0].querySelector('.stat-value').textContent = `${colStats.totalCards}枚`;

          statBoxes[1].querySelector('.stat-label').textContent = '土地 / 非土地';
          const landCnt = colStats.typeCounts?.land || 0;
          statBoxes[1].querySelector('.stat-value').textContent = `${landCnt}枚 / ${colStats.totalCards - landCnt}枚`;

          statBoxes[2].querySelector('.stat-label').textContent = 'ユニーク種別 / 版数';
          statBoxes[2].querySelector('.stat-value').textContent = `${colStats.uniqueCards}種 / ${colStats.uniquePrintings}版`;

          statBoxes[3].querySelector('.stat-label').textContent = '推定総市場価値 (USD)';
          statBoxes[3].querySelector('.stat-value').textContent = `$${colStats.totalValueUsd.toFixed(2)}`;

          statBoxes[4].querySelector('.stat-label').textContent = 'Foil / 通常';
          statBoxes[4].querySelector('.stat-value').textContent = `${colStats.foilCount}枚 / ${colStats.nonFoilCount}枚`;

          statBoxes[5].querySelector('.stat-label').textContent = '余剰カード (5枚以上)';
          const missingElem = statBoxes[5].querySelector('.stat-value');
          missingElem.textContent = `${colStats.duplicates.length} 種類`;
          missingElem.style.color = 'var(--text-primary)';
        }

        // Charts
        const manaCurveContainer = document.getElementById('stat-mana-curve-chart');
        if (manaCurveContainer) {
          manaCurveContainer.innerHTML = Statistics.renderManaCurveSVG(colStats.manaCurve);
        }

        const colorDistContainer = document.getElementById('stat-color-dist');
        if (colorDistContainer) {
          colorDistContainer.innerHTML = Statistics.renderDistributionBars(colStats.colorCounts, colorPalette);
        }

        const typeDistContainer = document.getElementById('stat-type-dist');
        if (typeDistContainer) {
          typeDistContainer.innerHTML = Statistics.renderDistributionBars(colStats.typeCounts);
        }

        // Subtable: Top High Value Cards
        if (subtableTitle) subtableTitle.textContent = 'コレクション高額カード Top 10';
        if (subtableHead) {
          subtableHead.innerHTML = '<tr><th>カード名</th><th>仕様 / セット</th><th>参考価格 (単価)</th></tr>';
        }
        if (subtableBody) {
          if (!colStats.highValueList || colStats.highValueList.length === 0) {
            subtableBody.innerHTML = '<tr><td colspan="3" class="text-center empty-state">カード価格データがありません</td></tr>';
          } else {
            subtableBody.innerHTML = colStats.highValueList.map((c) => {
              return `
                <tr>
                  <td><strong>${Utils.escapeHtml(c.display_name || c.name)}</strong></td>
                  <td><span class="badge ${c.foil ? 'badge-foil' : 'badge-condition'}">${c.foil ? '★Foil' : '通常'}</span> ${c.set} #${c.collector_number}</td>
                  <td><strong>$${c.unitPrice.toFixed(2)}</strong> <span style="font-size: 11px; color: var(--text-muted);">(x${c.count})</span></td>
                </tr>
              `;
            }).join('');
          }
        }

        // Summary Text
        const summaryText = Summary.generateCollectionTextSummary(colStats);
        if (summaryBox) summaryBox.value = summaryText;

        if (btnAddMissingToWish) btnAddMissingToWish.style.display = 'none';

        // Action buttons
        if (btnCopySummary) {
          btnCopySummary.onclick = async () => {
            await Utils.copyToClipboard(summaryText);
            Utils.toast('コレクションサマリーをクリップボードにコピーしました', 'success');
          };
        }
        if (btnDownloadSummary) {
          btnDownloadSummary.onclick = () => {
            Utils.downloadFile('collection_summary.txt', summaryText);
          };
        }
        if (btnPrintSummary) {
          btnPrintSummary.onclick = () => {
            Summary.exportPDF('MTGCollectionSummary - コレクション全体サマリー', summaryText);
          };
        }

      } else {
        // --- Render Deck Summary ---
        const deck = DeckBuilder.decks.find((d) => d.id === this.summaryTarget) || DeckBuilder.currentDeck;
        if (!deck) {
          if (titleElem) titleElem.textContent = 'サマリー・統計分析';
          return;
        }

        if (titleElem) titleElem.textContent = `🎴 [${(deck.format || 'casual').toUpperCase()}] ${deck.name} - デッキサマリー`;
        const stats = Statistics.analyzeDeck(deck);
        const matchResult = DeckBuilder.matchWithCollection(deck, Collection.items, false);

        // 6 Stat Boxes
        const statBoxes = document.querySelectorAll('#tab-summary .dash-stats-grid .stat-box');
        if (statBoxes && statBoxes.length >= 6) {
          statBoxes[0].querySelector('.stat-label').textContent = 'デッキ総枚数';
          statBoxes[0].querySelector('.stat-value').textContent = stats.totalCards;

          statBoxes[1].querySelector('.stat-label').textContent = '土地 / 非土地';
          statBoxes[1].querySelector('.stat-value').textContent = `${stats.landCount}枚 / ${stats.nonLandCount}枚`;

          statBoxes[2].querySelector('.stat-label').textContent = '平均マナ総量 (CMC)';
          statBoxes[2].querySelector('.stat-value').textContent = stats.avgCmc;

          statBoxes[3].querySelector('.stat-label').textContent = '推定デッキ価格';
          statBoxes[3].querySelector('.stat-value').textContent = `$${stats.estimatedPriceUsd.toFixed(2)}`;

          statBoxes[4].querySelector('.stat-label').textContent = 'コレクション所有率';
          statBoxes[4].querySelector('.stat-value').textContent = `${matchResult.ownedRatio}%`;

          statBoxes[5].querySelector('.stat-label').textContent = '不足カード枚数';
          const missingElem = statBoxes[5].querySelector('.stat-value');
          missingElem.textContent = `${matchResult.missingCount}枚`;
          missingElem.style.color = matchResult.missingCount > 0 ? 'var(--danger-color)' : 'var(--text-primary)';
        }

        // Charts
        const manaCurveContainer = document.getElementById('stat-mana-curve-chart');
        if (manaCurveContainer) {
          manaCurveContainer.innerHTML = Statistics.renderManaCurveSVG(stats.manaCurve);
        }

        const colorDistContainer = document.getElementById('stat-color-dist');
        if (colorDistContainer) {
          colorDistContainer.innerHTML = Statistics.renderDistributionBars(stats.cardColors, colorPalette);
        }

        const typeDistContainer = document.getElementById('stat-type-dist');
        if (typeDistContainer) {
          typeDistContainer.innerHTML = Statistics.renderDistributionBars(stats.types);
        }

        // Subtable: Hypergeometric Opening Hand Table
        if (subtableTitle) subtableTitle.textContent = '初手土地枚数確率 (超幾何分布 / 7枚)';
        if (subtableHead) {
          subtableHead.innerHTML = '<tr><th>土地枚数</th><th>確率</th><th>グラフ</th></tr>';
        }
        if (subtableBody) {
          subtableBody.innerHTML = stats.landProbabilities.map((row) => {
            return `
              <tr>
                <td><strong>${row.lands} 枚</strong></td>
                <td>${row.percentage}</td>
                <td>
                  <div class="dist-bar-track">
                    <div class="dist-bar-fill" style="width: ${row.percentage}; background-color: var(--accent-color, #4f46e5);"></div>
                  </div>
                </td>
              </tr>
            `;
          }).join('');
        }

        // Text Summary Output
        const summaryText = Summary.generateTextSummary(deck, stats, matchResult);
        if (summaryBox) summaryBox.value = summaryText;

        if (btnAddMissingToWish) btnAddMissingToWish.style.display = '';

        // Summary Export Buttons
        if (btnCopySummary) {
          btnCopySummary.onclick = async () => {
            await Utils.copyToClipboard(summaryText);
            Utils.toast('サマリーをクリップボードにコピーしました', 'success');
          };
        }
        if (btnDownloadSummary) {
          btnDownloadSummary.onclick = () => {
            Utils.downloadFile(`${deck.name}_summary.txt`, summaryText);
          };
        }
        if (btnPrintSummary) {
          btnPrintSummary.onclick = () => {
            Summary.exportPDF(`${deck.name} - デッキサマリー`, summaryText);
          };
        }
        if (btnAddMissingToWish) {
          btnAddMissingToWish.onclick = async () => {
            if (matchResult.missingCards.length === 0) {
              Utils.toast('不足カードはありません', 'info');
              return;
            }
            let added = 0;
            for (const m of matchResult.missingCards) {
              await this.addToWishlist(m.card, m.shortage, deck.name);
              added++;
            }
            Utils.toast(`${added} 件の不足カードをウィッシュリストに登録しました`, 'success');
          };
        }
      }
    }

    // --- Wishlist Management ---
    async addToWishlist(card, count = 1, linkedDeck = '') {
      if (!card) return;
      const item = {
        id: Utils.generateId('wish'),
        oracle_id: card.oracle_id || card.id,
        name: card.name,
        display_name: card.display_name || card.name_ja || card.name,
        count: count,
        priority: 'medium', // high, medium, low
        target_price: card.prices?.usd || 0,
        linked_deck: linkedDeck,
        memo: '',
        status: 'wanted', // wanted, acquired
        image_uri: card.image_uri || '',
        created_at: new Date().toISOString()
      };
      this.wishlistItems.push(item);
      if (DB) await DB.put('wishlist', item);
      return item;
    }

    renderWishlist() {
      const container = document.getElementById('wishlist-table-body');
      if (!container) return;

      if (this.wishlistItems.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="text-center empty-state">ウィッシュリストにカードがありません。</td></tr>';
        return;
      }

      container.innerHTML = this.wishlistItems.map((item) => {
        return `
          <tr data-wish-id="${item.id}" class="${item.status === 'acquired' ? 'row-acquired' : ''}">
            <td>
              <div class="col-card-cell">
                <img src="${item.image_uri || 'https://cards.scryfall.io/back.png'}" class="col-thumb" alt="" />
                <div>
                  <strong>${Utils.escapeHtml(item.display_name)}</strong><br>
                  <small class="text-muted">${Utils.escapeHtml(item.name)}</small>
                </div>
              </div>
            </td>
            <td>${item.count}枚</td>
            <td><span class="badge badge-priority-${item.priority}">${item.priority.toUpperCase()}</span></td>
            <td>$${item.target_price || '-'}</td>
            <td>${Utils.escapeHtml(item.linked_deck || '-')}</td>
            <td>
              <button type="button" class="btn btn-xs ${item.status === 'acquired' ? 'btn-success' : 'btn-outline'} btn-toggle-wish-status" data-id="${item.id}">
                ${item.status === 'acquired' ? '✓ 入手済' : '未入手'}
              </button>
            </td>
            <td>
              <button type="button" class="btn btn-xs btn-danger btn-del-wish" data-id="${item.id}">✕</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    setupWishlistEvents() {
      const container = document.getElementById('wishlist-table-body');
      if (container) {
        container.onclick = async (e) => {
          const btnStatus = e.target.closest('.btn-toggle-wish-status');
          const btnDel = e.target.closest('.btn-del-wish');

          if (btnStatus) {
            const id = btnStatus.getAttribute('data-id');
            const item = this.wishlistItems.find((w) => w.id === id);
            if (item) {
              item.status = item.status === 'acquired' ? 'wanted' : 'acquired';
              await DB.put('wishlist', item);
              this.renderWishlist();
            }
          } else if (btnDel) {
            const id = btnDel.getAttribute('data-id');
            this.wishlistItems = this.wishlistItems.filter((w) => w.id !== id);
            await DB.delete('wishlist', id);
            this.renderWishlist();
            Utils.toast('ウィッシュリストから削除しました', 'info');
          }
        };
      }
    }

    // --- Import / Export View Setup ---
    setupImportExportEvents() {
      // Import Parse & Match
      const btnParseImport = document.getElementById('btn-parse-import');
      const importTextarea = document.getElementById('import-input-text');
      const importFile = document.getElementById('import-file-input');

      if (importFile) {
        importFile.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await Utils.readFileAsText(file);
          if (importTextarea) importTextarea.value = text;
        });
      }

      if (btnParseImport) {
        btnParseImport.addEventListener('click', async () => {
          const raw = importTextarea ? importTextarea.value : '';
          if (!raw.trim()) {
            Utils.toast('インポートするテキストを入力してください', 'warning');
            return;
          }

          const formatType = Importer.detectFormat(raw);
          let entries = [];
          if (formatType === 'json') {
            entries = Importer.parseJSONDeck(raw);
          } else if (formatType === 'csv') {
            entries = Importer.parseCSVDeck(raw);
          } else {
            entries = Importer.parseText(raw);
          }

          if (entries.length === 0) {
            Utils.toast('カードリストを認識できませんでした', 'error');
            return;
          }

          const progressBox = document.getElementById('import-progress-box');
          if (progressBox) progressBox.classList.remove('hidden');

          const { matched, unmatched } = await Importer.matchCards(entries, (cur, total, name, stage) => {
            if (progressBox) {
              progressBox.textContent = `カード照合中: ${cur} / ${total} (${name}) [${stage || '処理中'}]`;
            }
          });

          if (progressBox) progressBox.classList.add('hidden');

          // Render Import Preview
          this.renderImportPreview(matched, unmatched);
        });
      }

      // Export Buttons
      const btnExportCopy = document.getElementById('btn-export-copy');
      const btnExportDownload = document.getElementById('btn-export-download');
      const exportFormatSelect = document.getElementById('export-format-select');

      const getExportContent = () => {
        const deck = DeckBuilder.currentDeck;
        if (!deck) return '';
        const fmt = exportFormatSelect ? exportFormatSelect.value : 'arena_ja';
        const lang = document.getElementById('export-lang-select')?.value || 'ja';
        const sort = document.getElementById('export-sort-select')?.value || 'type';
        const incSet = document.getElementById('export-include-set')?.checked ?? true;
        const incSide = document.getElementById('export-include-side')?.checked ?? true;
        return Exporter.exportDeck(deck, fmt, { lang, sortBy: sort, includeSet: incSet, includeSideboard: incSide });
      };

      if (exportFormatSelect) {
        exportFormatSelect.addEventListener('change', () => {
          const text = getExportContent();
          const area = document.getElementById('export-output-text');
          if (area) area.value = text;
        });
      }

      if (btnExportCopy) {
        btnExportCopy.addEventListener('click', async () => {
          const text = getExportContent();
          await Utils.copyToClipboard(text);
          Utils.toast('エクスポートデータをコピーしました', 'success');
        });
      }

      if (btnExportDownload) {
        btnExportDownload.addEventListener('click', () => {
          const text = getExportContent();
          const deck = DeckBuilder.currentDeck;
          const fmt = exportFormatSelect ? exportFormatSelect.value : 'txt';
          const ext = fmt === 'json' ? 'json' : fmt === 'csv' ? 'csv' : 'txt';
          Utils.downloadFile(`${deck ? deck.name : 'deck'}.${ext}`, text);
        });
      }
    }

    renderImporter() {
      // Refresh current export box
      const exportArea = document.getElementById('export-output-text');
      if (exportArea && DeckBuilder.currentDeck) {
        exportArea.value = Exporter.exportDeck(DeckBuilder.currentDeck, 'arena_ja');
      }
    }

    renderImportPreview(initialMatched, initialUnmatched) {
      const previewModal = document.getElementById('import-preview-modal');
      const previewBody = document.getElementById('import-preview-body');
      if (!previewModal || !previewBody) return;

      let matched = [...initialMatched];
      let unmatched = [...initialUnmatched];
      const autoFormat = Importer.detectDeckFormat(matched);

      const updateUI = () => {
        const totalCards = matched.reduce((s, i) => s + (i.count || 1), 0);
        const cmdCount = matched.filter((m) => m.section === 'commander').reduce((s, i) => s + (i.count || 1), 0);
        const mainCount = matched.filter((m) => m.section === 'main').reduce((s, i) => s + (i.count || 1), 0);
        const sideCount = matched.filter((m) => m.section === 'sideboard').reduce((s, i) => s + (i.count || 1), 0);

        previewBody.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
              <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">デッキ名:</label>
              <input type="text" id="import-deck-name" value="インポートデッキ (${new Date().toLocaleDateString('ja-JP')})" style="font-size: 14px;" />
            </div>
            <div>
              <label style="font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px;">フォーマット設定:</label>
              <select id="import-format-select" style="font-size: 14px;">
                <option value="commander" ${autoFormat === 'commander' ? 'selected' : ''}>コマンダー (EDH)</option>
                <option value="pauper_edh">パウパーEDH</option>
                <option value="brawl">ブロール</option>
                <option value="standard" ${autoFormat === 'standard' ? 'selected' : ''}>スタンダード</option>
                <option value="pioneer">パイオニア</option>
                <option value="modern">モダン</option>
                <option value="legacy">レガシー</option>
                <option value="vintage">ヴィンテージ</option>
                <option value="pauper">パウパー</option>
                <option value="historic">ヒストリック</option>
                <option value="casual" ${autoFormat === 'casual' ? 'selected' : ''}>カジュアル (自由)</option>
              </select>
            </div>
          </div>

          <div class="dash-stats-grid" style="grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px;">
            <div class="stat-box" style="padding: 10px;">
              <span class="stat-label">総枚数</span>
              <span class="stat-value" style="font-size: 18px;">${totalCards}枚</span>
            </div>
            <div class="stat-box" style="padding: 10px;">
              <span class="stat-label">統率者</span>
              <span class="stat-value" style="font-size: 18px;">${cmdCount}枚</span>
            </div>
            <div class="stat-box" style="padding: 10px;">
              <span class="stat-label">メイン</span>
              <span class="stat-value" style="font-size: 18px;">${mainCount}枚</span>
            </div>
            <div class="stat-box" style="padding: 10px;">
              <span class="stat-label">サイド</span>
              <span class="stat-value" style="font-size: 18px;">${sideCount}枚</span>
            </div>
          </div>

          ${
            unmatched.length > 0
              ? `
              <div class="alert alert-warning" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <strong>未認識カード (${unmatched.length} 件):</strong>
                  <button type="button" class="btn btn-xs btn-primary" id="btn-auto-retry-all">⚡ 全件自動再照合 (5段階探索)</button>
                </div>
                <p style="font-size: 12px; margin-bottom: 8px;">カード名を修正して「再検索」するか、「全件自動再照合」で表記ゆれ・変身面・スペルミスを自動探索できます。</p>
                <div class="unmatched-list" style="display: flex; flex-direction: column; gap: 6px;">
                  ${unmatched.map((u, idx) => `
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <span class="badge badge-warning">${u.count}枚</span>
                      <input type="text" class="input-fix-unmatched" data-idx="${idx}" value="${Utils.escapeHtml(u.name)}" style="flex: 1; padding: 4px 8px; font-size: 12px;" />
                      <button type="button" class="btn btn-xs btn-outline btn-research-unmatched" data-idx="${idx}">🔍 再検索</button>
                    </div>
                  `).join('')}
                </div>
              </div>
              `
              : ''
          }

          <div style="margin-bottom: 12px; font-size: 13px; font-weight: bold;">
            認識済みカード (${matched.length} 種類)
          </div>
          <div class="table-responsive" style="max-height: 220px; overflow-y: auto; margin-bottom: 16px;">
            <table class="data-table">
              <thead>
                <tr><th style="width: 50px;">枚数</th><th>カード名</th><th>セクション</th><th>セット</th></tr>
              </thead>
              <tbody>
                ${matched.map((m) => `
                  <tr>
                    <td><strong>${m.count}</strong></td>
                    <td>${Utils.escapeHtml(m.card.display_name || m.card.name)}</td>
                    <td><span class="badge ${m.section === 'commander' ? 'badge-format' : 'badge-condition'}">${m.section}</span></td>
                    <td>${m.card.set || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--border-color); padding-top: 16px;">
            <button type="button" class="btn btn-outline" id="btn-cancel-import">キャンセル</button>
            <button type="button" class="btn btn-secondary" id="btn-confirm-import-merge">＋ 現在のデッキに追加</button>
            <button type="button" class="btn btn-secondary" id="btn-confirm-import-replace">⚡ 現在のデッキを置換</button>
            <button type="button" class="btn btn-primary" id="btn-confirm-import-new">新規デッキとして作成</button>
          </div>
        `;

        // Bind interactive events inside modal
        document.getElementById('btn-cancel-import').onclick = () => {
          previewModal.classList.remove('visible');
        };

        // Auto-retry all unmatched cards with 5-stage progressive search
        const btnAutoRetry = document.getElementById('btn-auto-retry-all');
        if (btnAutoRetry) {
          btnAutoRetry.onclick = async () => {
            btnAutoRetry.disabled = true;
            btnAutoRetry.textContent = '自動探索中 (5段階)...';
            let recovered = 0;
            const remaining = [];

            for (let i = 0; i < unmatched.length; i++) {
              const u = unmatched[i];
              let card = null;
              if (Scryfall.resolveCard) {
                card = await Scryfall.resolveCard(u.name, u.set, u.number);
              } else {
                card = await Scryfall.getCardByName(u.name);
              }

              if (card) {
                matched.push({ ...u, card, recognized: true });
                recovered++;
              } else {
                remaining.push(u);
              }
            }

            unmatched.length = 0;
            unmatched.push(...remaining);

            if (recovered > 0) {
              Utils.toast(`${recovered} 件のカードを自動照合しました！`, 'success');
            } else {
              Utils.toast('自動再照合で一致するカードが見つかりませんでした', 'info');
            }
            updateUI();
          };
        }

        // Fix & re-search individual unmatched cards
        document.querySelectorAll('.btn-research-unmatched').forEach((btn) => {
          btn.onclick = async () => {
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            const input = document.querySelector(`.input-fix-unmatched[data-idx="${idx}"]`);
            if (!input) return;
            const newName = input.value.trim();
            if (!newName) return;

            btn.disabled = true;
            btn.textContent = '検索中...';
            let card = null;
            if (Scryfall.resolveCard) {
              card = await Scryfall.resolveCard(newName);
            } else {
              card = await Scryfall.getCardByName(newName);
            }

            if (card) {
              const item = unmatched.splice(idx, 1)[0];
              item.card = card;
              item.name = newName;
              item.recognized = true;
              matched.push(item);
              Utils.toast(`「${card.display_name || card.name}」を照合しました`, 'success');
              updateUI();
            } else {
              btn.disabled = false;
              btn.textContent = '🔍 再検索';
              Utils.toast(`「${newName}」が見つかりませんでした`, 'warning');
            }
          };
        });

        // Helper to automatically add all imported cards to Collection
        const autoAddToCollection = async () => {
          let addedCount = 0;
          for (const m of matched) {
            if (m.card) {
              await Collection.addCard(m.card, {
                count: m.count || 1,
                set: m.card.set || m.set,
                collector_number: m.card.collector_number || m.number,
                foil: !!m.foil
              });
              addedCount += (m.count || 1);
            }
          }
          if (typeof this.renderDashboard === 'function') this.renderDashboard();
          return addedCount;
        };

        // 1. Create as New Deck
        document.getElementById('btn-confirm-import-new').onclick = async () => {
          const nameInput = document.getElementById('import-deck-name');
          const formatInput = document.getElementById('import-format-select');
          const deckName = nameInput ? nameInput.value.trim() : 'インポートデッキ';
          const selectedFormat = formatInput ? formatInput.value : 'commander';

          const addedCount = await autoAddToCollection();

          const newDeck = Importer.buildDeckFromEntries(matched, deckName, selectedFormat);
          DeckBuilder.decks.push(newDeck);
          DeckBuilder.setCurrentDeck(newDeck);
          await DeckBuilder.saveCurrentDeck();

          previewModal.classList.remove('visible');
          this.renderDeckList();
          this.switchTab('deckbuilder');
          Utils.toast(`新規デッキ「${deckName}」を作成し、${addedCount}枚をコレクションに追加しました`, 'success');
        };

        // 2. Append to Current Deck (Merge)
        document.getElementById('btn-confirm-import-merge').onclick = async () => {
          if (!DeckBuilder.currentDeck) {
            Utils.toast('対象のデッキが選択されていません', 'warning');
            return;
          }
          const addedCount = await autoAddToCollection();
          matched.forEach((entry) => {
            DeckBuilder.addCard(entry.card, entry.section, entry.count);
          });
          previewModal.classList.remove('visible');
          this.switchTab('deckbuilder');
          Utils.toast(`デッキ「${DeckBuilder.currentDeck.name}」にカードを追加し、${addedCount}枚をコレクションに追加しました`, 'success');
        };

        // 3. Replace Current Deck
        document.getElementById('btn-confirm-import-replace').onclick = async () => {
          if (!DeckBuilder.currentDeck) {
            Utils.toast('対象のデッキが選択されていません', 'warning');
            return;
          }
          if (!confirm(`現在のデッキ「${DeckBuilder.currentDeck.name}」の内容をこのインポートリストで完全に上書きしますか？`)) {
            return;
          }
          const addedCount = await autoAddToCollection();
          const formatInput = document.getElementById('import-format-select');
          const selectedFormat = formatInput ? formatInput.value : DeckBuilder.currentDeck.format;

          const temp = Importer.buildDeckFromEntries(matched, DeckBuilder.currentDeck.name, selectedFormat);
          DeckBuilder.currentDeck.format = selectedFormat;
          DeckBuilder.currentDeck.commanders = temp.commanders;
          DeckBuilder.currentDeck.companions = temp.companions;
          DeckBuilder.currentDeck.mainboard = temp.mainboard;
          DeckBuilder.currentDeck.sideboard = temp.sideboard;
          DeckBuilder.currentDeck.maybeboard = temp.maybeboard;

          await DeckBuilder.saveCurrentDeck();
          previewModal.classList.remove('visible');
          this.switchTab('deckbuilder');
          Utils.toast(`デッキ「${DeckBuilder.currentDeck.name}」を置換し、${addedCount}枚をコレクションに追加しました`, 'success');
        };
      };

      updateUI();
      previewModal.classList.add('visible');

      const btnClose = document.getElementById('btn-close-import-modal');
      if (btnClose) {
        btnClose.onclick = () => previewModal.classList.remove('visible');
      }
    }

    // --- Settings View ---
    renderSettings() {
      const curSelect = document.getElementById('setting-currency-select');
      if (curSelect) curSelect.value = this.currency;
    }

    setupSettingsEvents() {
      // Theme toggle
      const btnTheme = document.getElementById('btn-theme-toggle');
      if (btnTheme) btnTheme.addEventListener('click', () => this.toggleTheme());

      // Currency change
      const curSelect = document.getElementById('setting-currency-select');
      if (curSelect) {
        curSelect.addEventListener('change', async () => {
          this.currency = curSelect.value;
          await DB.setSetting('currency', this.currency);
          Utils.toast('通貨設定を更新しました', 'info');
        });
      }

      // JSON Backup Export
      const btnExportAll = document.getElementById('btn-backup-export');
      if (btnExportAll) {
        btnExportAll.addEventListener('click', async () => {
          const backup = await DB.exportBackup();
          const jsonStr = JSON.stringify(backup, null, 2);
          const dateStr = new Date().toISOString().split('T')[0];
          Utils.downloadFile(`MTGCollectionSummary_backup_${dateStr}.json`, jsonStr, 'application/json');
          Utils.toast('バックアップJSONをダウンロードしました', 'success');
        });
      }

      // JSON Backup Restore
      const fileRestore = document.getElementById('backup-file-input');
      if (fileRestore) {
        fileRestore.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const text = await Utils.readFileAsText(file);
            const json = JSON.parse(text);
            const mode = confirm('既存の全データを消去して上書き復元しますか？\n（「OK」で全置換、「キャンセル」でマージ取り込み）')
              ? 'replace'
              : 'merge';
            await DB.importBackup(json, mode);
            await Collection.load();
            await DeckBuilder.load();
            this.wishlistItems = await DB.getAll('wishlist');
            Utils.toast('バックアップの復元が完了しました', 'success');
            this.switchTab('dashboard');
          } catch (err) {
            Utils.toast('復元に失敗しました: ' + err.message, 'error');
          }
        });
      }

      // Clear Cache
      const btnClearCache = document.getElementById('btn-clear-cache');
      if (btnClearCache) {
        btnClearCache.addEventListener('click', async () => {
          if (confirm('Scryfallの検索キャッシュをクリアしますか？')) {
            await DB.clear('scryfall_cache');
            Utils.toast('キャッシュをクリアしました', 'info');
          }
        });
      }
    }

    // --- Opening Hand Simulator Modal ---
    openHandSimulatorModal() {
      const deck = DeckBuilder.currentDeck;
      if (!deck) return;

      const modal = document.getElementById('hand-simulator-modal');
      const body = document.getElementById('simulator-modal-body');
      if (!modal || !body) return;

      DeckBuilder.initHandSimulator(deck);

      const renderSim = () => {
        const state = DeckBuilder.handState;
        body.innerHTML = `
          <div class="sim-controls">
            <button type="button" class="btn btn-sm btn-primary" id="btn-sim-mulligan">マリガン (引き直し)</button>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-sim-draw1">＋1枚ドロー (ターン進める)</button>
            <button type="button" class="btn btn-sm btn-outline" id="btn-sim-reset">最初から</button>
            <span class="sim-meta">手札: ${state.hand.length}枚 | ライブラリー残: ${state.library.length}枚 | マリガン回数: ${state.mulliganCount}</span>
          </div>
          <div class="sim-cards-grid">
            ${state.hand.map((c) => {
              return `
                <div class="sim-card-item">
                  <img src="${c.image_uri || 'https://cards.scryfall.io/back.png'}" class="sim-card-img" alt="${Utils.escapeHtml(c.name)}" />
                  <div class="sim-card-name">${Utils.escapeHtml(c.display_name || c.name)}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        document.getElementById('btn-sim-mulligan').onclick = () => {
          DeckBuilder.mulligan();
          renderSim();
        };
        document.getElementById('btn-sim-draw1').onclick = () => {
          DeckBuilder.drawCards(1);
          renderSim();
        };
        document.getElementById('btn-sim-reset').onclick = () => {
          DeckBuilder.initHandSimulator(deck);
          renderSim();
        };
      };

      renderSim();
      modal.classList.add('visible');

      const btnClose = document.getElementById('btn-close-sim-modal');
      if (btnClose) btnClose.onclick = () => modal.classList.remove('visible');
    }

    // --- Multi-Deck Shortage Analyzer Modal ---
    openMultiDeckShortageModal() {
      const modal = document.getElementById('multi-shortage-modal');
      const body = document.getElementById('multi-shortage-body');
      if (!modal || !body) return;

      const allDecks = DeckBuilder.decks;
      let selectedDeckIds = allDecks.map((d) => d.id);

      const render = () => {
        const shortages = DeckBuilder.analyzeMultiDeckShortages(selectedDeckIds, Collection.items);

        body.innerHTML = `
          <div class="multi-shortage-deck-picker">
            <strong>対象デッキを選択:</strong>
            <div class="deck-checkboxes">
              ${allDecks.map((d) => `
                <label class="deck-chk-label">
                  <input type="checkbox" class="multi-deck-chk" data-id="${d.id}" ${selectedDeckIds.includes(d.id) ? 'checked' : ''}>
                  ${Utils.escapeHtml(d.name)}
                </label>
              `).join('')}
            </div>
          </div>
          <div class="multi-shortage-summary">
            同時構築時の不足カード: <strong>${shortages.length} 種類</strong>
          </div>
          <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="data-table">
              <thead>
                <tr><th>カード名</th><th>総必要枚数</th><th>所持枚数</th><th>不足枚数</th><th>使用デッキ</th></tr>
              </thead>
              <tbody>
                ${
                  shortages.length === 0
                    ? '<tr><td colspan="5" class="text-center empty-state">選択したデッキ群のカードはすべてコレクション内に揃っています！</td></tr>'
                    : shortages.map((s) => `
                        <tr>
                          <td><strong>${Utils.escapeHtml(s.name)}</strong></td>
                          <td>${s.totalRequired}</td>
                          <td>${s.owned}</td>
                          <td><span class="text-danger font-bold">-${s.shortage}</span></td>
                          <td><small>${s.deckUsage.map((u) => `${u.deckName} (${u.count})`).join(', ')}</small></td>
                        </tr>
                      `).join('')
                }
              </tbody>
            </table>
          </div>
        `;

        document.querySelectorAll('.multi-deck-chk').forEach((chk) => {
          chk.onchange = () => {
            const id = chk.getAttribute('data-id');
            if (chk.checked) selectedDeckIds.push(id);
            else selectedDeckIds = selectedDeckIds.filter((x) => x !== id);
            render();
          };
        });
      };

      render();
      modal.classList.add('visible');

      const btnClose = document.getElementById('btn-close-multi-modal');
      if (btnClose) btnClose.onclick = () => modal.classList.remove('visible');
    }

    // --- Deck Compare Modal ---
    openDeckCompareModal() {
      const modal = document.getElementById('deck-compare-modal');
      const body = document.getElementById('deck-compare-body');
      if (!modal || !body || DeckBuilder.decks.length < 2) {
        Utils.toast('デッキ比較には少なくとも2つのデッキが必要です', 'warning');
        return;
      }

      let deckAId = DeckBuilder.currentDeck ? DeckBuilder.currentDeck.id : DeckBuilder.decks[0].id;
      let deckBId = DeckBuilder.decks.find((d) => d.id !== deckAId)?.id || DeckBuilder.decks[1].id;

      const render = () => {
        const deckA = DeckBuilder.decks.find((d) => d.id === deckAId);
        const deckB = DeckBuilder.decks.find((d) => d.id === deckBId);
        const comp = DeckBuilder.compareDecks(deckA, deckB);

        body.innerHTML = `
          <div class="compare-selectors">
            <div>
              <label>デッキ A:</label>
              <select id="compare-select-a" class="form-control">
                ${DeckBuilder.decks.map((d) => `<option value="${d.id}" ${d.id === deckAId ? 'selected' : ''}>${Utils.escapeHtml(d.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>デッキ B:</label>
              <select id="compare-select-b" class="form-control">
                ${DeckBuilder.decks.map((d) => `<option value="${d.id}" ${d.id === deckBId ? 'selected' : ''}>${Utils.escapeHtml(d.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="compare-stats-row">
            <div class="stat-box"><span class="stat-label">共通カード</span><span class="stat-value">${comp.common.length}種</span></div>
            <div class="stat-box"><span class="stat-label">デッキA固有</span><span class="stat-value">${comp.uniqueA.length}種</span></div>
            <div class="stat-box"><span class="stat-label">デッキB固有</span><span class="stat-value">${comp.uniqueB.length}種</span></div>
            <div class="stat-box"><span class="stat-label">平均CMC差 (A - B)</span><span class="stat-value">${comp.cmcDiff > 0 ? '+' : ''}${comp.cmcDiff}</span></div>
          </div>
        `;

        document.getElementById('compare-select-a').onchange = (e) => {
          deckAId = e.target.value;
          render();
        };
        document.getElementById('compare-select-b').onchange = (e) => {
          deckBId = e.target.value;
          render();
        };
      };

      render();
      modal.classList.add('visible');

      const btnClose = document.getElementById('btn-close-compare-modal');
      if (btnClose) btnClose.onclick = () => modal.classList.remove('visible');
    }

    // --- Global Shortcuts ---
    setupGlobalShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Press '/' to search
        if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.switchTab('search');
          const s = document.getElementById('search-input');
          if (s) s.focus();
        }
        // Press 'Escape' to close open modal
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal-overlay.visible').forEach((m) => {
            m.classList.remove('visible');
          });
        }
        // Ctrl+Z / Ctrl+Y
        if (e.ctrlKey && e.key === 'z') {
          if (this.currentTab === 'deckbuilder') {
            e.preventDefault();
            DeckBuilder.undo();
            this.renderDeckbuilder();
          }
        }
      });
    }
  }

  window.App = new AppController();
  window.addEventListener('DOMContentLoaded', () => {
    window.App.init();
  });
})(window);

