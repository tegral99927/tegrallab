/**
 * Mulligan Lab - UI Controller
 * Bridges business logic with the DOM, manages tab switching, modals, toasts,
 * Keep Condition Builder GUI, training rendering, charts, and deck comparison.
 */

const UI = (() => {
  let activeTab = 'tab-deck';
  let simulationWorker = null;
  let activeZoomFaceIndex = 0;
  let activeZoomCard = null;

  // --- Toast Notifications ---
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  // --- Modals Management ---
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  // --- Tabs Navigation ---
  function setupNavigation() {
    const tabBtns = document.querySelectorAll('.nav-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        switchTab(targetId);
      });
    });
  }

  function switchTab(targetTabId) {
    activeTab = targetTabId;

    // Update buttons
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === targetTabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // On-demand refresh for specific tabs
    if (targetTabId === 'tab-analysis') {
      renderAnalysisTab();
    } else if (targetTabId === 'tab-roles') {
      renderRolesTab();
    } else if (targetTabId === 'tab-history') {
      renderHistoryTab();
    } else if (targetTabId === 'tab-compare') {
      populateCompareDeckSelects();
    }
  }

  // --- Theme Toggle ---
  function setupThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    const icon = document.getElementById('theme-icon');
    const settings = Storage.getSettings();

    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      icon.textContent = theme === 'dark' ? '🌙' : '☀️';
      settings.theme = theme;
      Storage.saveSettings(settings);
    }

    applyTheme(settings.theme || 'dark');

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  // --- Language Toggle ---
  function setupLanguageToggle() {
    const btn = document.getElementById('btn-lang-toggle');
    const textEl = document.getElementById('lang-btn-text');
    if (!btn) return;

    function updateLangUI(lang) {
      if (textEl) {
        textEl.textContent = lang === 'ja' ? '🇯🇵 日本語' : '🇺🇸 EN';
      }
      btn.title = `カード言語切替 (現在: ${lang === 'ja' ? '日本語優先' : '英語のみ'})`;
    }

    const settings = Storage.getSettings();
    updateLangUI(settings.cardLanguage || 'ja');

    btn.addEventListener('click', () => {
      const current = Storage.getSettings().cardLanguage || 'ja';
      const next = current === 'ja' ? 'en' : 'ja';
      settings.cardLanguage = next;
      Storage.saveSettings(settings);
      updateLangUI(next);

      // Sync select dropdown in settings if visible
      const select = document.getElementById('setting-card-language');
      if (select) select.value = next;

      Training.switchCardLanguage(next);
      renderCurrentDeckView();
      showToast(`カード言語を「${next === 'ja' ? '日本語優先' : '英語のみ'}」に変更しました`, 'info');
    });
  }

  // --- Header Badge ---
  function updateHeaderDeckBadge(deck) {
    const nameEl = document.getElementById('header-deck-name');
    const countEl = document.getElementById('header-deck-count');
    if (!deck) {
      nameEl.textContent = 'デッキ未読込';
      countEl.textContent = '0枚';
      return;
    }
    const totalCount = deck.mainboard.reduce((s, c) => s + c.count, 0);
    nameEl.textContent = deck.name;
    countEl.textContent = `${totalCount}枚`;
  }

  // ==========================================================================
  // TAB 1: Deck Management UI
  // ==========================================================================
  function setupDeckManagement() {
    const importBtn = document.getElementById('btn-parse-and-import');
    const clearBtn = document.getElementById('btn-clear-deck-input');
    const sampleBtn = document.getElementById('btn-load-sample-deck');
    const saveBtn = document.getElementById('btn-save-current-deck');
    const textarea = document.getElementById('deck-import-textarea');
    const fileInput = document.getElementById('deck-file-input');
    const dropzone = document.getElementById('deck-file-dropzone');
    const formatSelect = document.getElementById('deck-format-select');
    const nameInput = document.getElementById('deck-name-input');
    const exportBtn = document.getElementById('btn-export-deck-text');
    const showSavedBtn = document.getElementById('btn-show-saved-decks');
    const loadSavedBtn = document.getElementById('btn-load-selected-deck');
    const deleteSavedBtn = document.getElementById('btn-delete-selected-deck');

    // Parse & Import
    importBtn.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (!text) {
        showToast('デッキリストを入力してください', 'warning');
        return;
      }

      const format = formatSelect.value;
      const deckName = nameInput.value.trim() || '新規デッキ';

      importBtn.disabled = true;
      document.getElementById('import-btn-text').textContent = '解析中...';
      const statusEl = document.getElementById('import-status-text');

      const parsed = DeckParser.parseDeckText(text);

      // Handle unparsed lines warning
      const unparsedWrap = document.getElementById('unparsed-warning-container');
      const unparsedList = document.getElementById('unparsed-list');
      unparsedList.innerHTML = '';
      if (parsed.unparsed.length > 0) {
        unparsedWrap.style.display = 'block';
        parsed.unparsed.forEach(u => {
          const li = document.createElement('li');
          li.textContent = `行 ${u.lineIndex + 1}: ${u.line} (${u.reason})`;
          unparsedList.appendChild(li);
        });
      } else {
        unparsedWrap.style.display = 'none';
      }

      // Fetch Scryfall metadata in batch
      statusEl.textContent = 'Scryfallからカード情報を取得中...';
      const queryList = [...parsed.mainboard, ...parsed.sideboard, ...parsed.commander];
      const fetchedMap = await Scryfall.fetchCardsBatch(queryList, (p) => {
        statusEl.textContent = `カード取得中: ${p.cached + (p.total - p.fetching)} / ${p.total}`;
      });

      // Update DeckManager
      fetchedMap.forEach((val, key) => {
        DeckManager.setCardMetadata(key, val);
      });

      let deck = DeckManager.getCurrentDeck();
      if (!deck) {
        deck = DeckManager.createBlankDeck(deckName, format);
      } else {
        deck.name = deckName;
        deck.format = format;
      }

      deck.mainboard = parsed.mainboard;
      deck.sideboard = parsed.sideboard;
      deck.commander = parsed.commander;
      deck.companion = parsed.companion;

      // Auto-tag candidates if not already set
      if (!deck.cardTags || Object.keys(deck.cardTags).length === 0) {
        deck.cardTags = DeckManager.autoCategorizeCards(deck.mainboard, fetchedMap);
      }

      DeckManager.setCurrentDeck(deck);
      await Storage.saveDeck(deck);
      Storage.setActiveDeckId(deck.id);

      renderCurrentDeckView();
      updateHeaderDeckBadge(deck);

      importBtn.disabled = false;
      document.getElementById('import-btn-text').textContent = 'リスト解析 & Scryfall取得';
      statusEl.textContent = 'インポート完了！';
      showToast(`デッキ「${deck.name}」を正常にインポートしました`, 'success');

      // Start new training session automatically
      Training.startNewGame();
    });

    // Clear
    clearBtn.addEventListener('click', () => {
      textarea.value = '';
      document.getElementById('unparsed-warning-container').style.display = 'none';
    });

    // Load Sample Deck
    sampleBtn.addEventListener('click', async () => {
      const sample = DeckManager.getSampleDeck();
      nameInput.value = sample.name;
      formatSelect.value = sample.format;
      textarea.value = DeckParser.formatDeckToText(sample.mainboard, sample.sideboard);

      DeckManager.setCurrentDeck(sample);
      await Storage.saveDeck(sample);
      Storage.setActiveDeckId(sample.id);

      // Pre-fetch Scryfall info for sample cards
      const fetchedMap = await Scryfall.fetchCardsBatch(sample.mainboard);
      fetchedMap.forEach((val, key) => DeckManager.setCardMetadata(key, val));

      renderCurrentDeckView();
      updateHeaderDeckBadge(sample);
      Training.startNewGame();
      showToast('サンプルデッキ（Modern Murktide）を読み込みました', 'info');
    });

    // Save
    saveBtn.addEventListener('click', async () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck) {
        showToast('保存するデッキがありません', 'warning');
        return;
      }
      deck.name = nameInput.value.trim() || deck.name;
      deck.format = formatSelect.value || deck.format;
      await Storage.saveDeck(deck);
      showToast('デッキをブラウザに保存しました', 'success');
      updateHeaderDeckBadge(deck);
    });

    // File Drag & Drop
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        readFile(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        readFile(fileInput.files[0]);
      }
    });

    function readFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        textarea.value = e.target.result;
        nameInput.value = file.name.replace(/\.[^/.]+$/, '');
        showToast(`ファイル「${file.name}」を読み込みました`, 'info');
      };
      reader.readAsText(file);
    }

    // Export text
    exportBtn.addEventListener('click', () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck) return;
      const text = DeckParser.formatDeckToText(deck.mainboard, deck.sideboard, deck.commander);
      navigator.clipboard.writeText(text).then(() => {
        showToast('デッキテキストをクリップボードにコピーしました', 'success');
      }).catch(() => {
        alert(text);
      });
    });

    // Saved Decks selector
    showSavedBtn.addEventListener('click', async () => {
      const panel = document.getElementById('saved-decks-selector-panel');
      if (panel.style.display === 'none') {
        const decks = await Storage.getAllDecks();
        const select = document.getElementById('saved-decks-select');
        select.innerHTML = '';
        if (decks.length === 0) {
          select.innerHTML = '<option value="">保存済みデッキはありません</option>';
        } else {
          decks.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = `${d.name} (${d.mainboard ? d.mainboard.reduce((s, c) => s + c.count, 0) : 0}枚)`;
            select.appendChild(opt);
          });
        }
        panel.style.display = 'block';
      } else {
        panel.style.display = 'none';
      }
    });

    loadSavedBtn.addEventListener('click', async () => {
      const select = document.getElementById('saved-decks-select');
      const id = select.value;
      if (!id) return;
      const deck = await Storage.getDeck(id);
      if (deck) {
        DeckManager.setCurrentDeck(deck);
        Storage.setActiveDeckId(deck.id);
        nameInput.value = deck.name;
        formatSelect.value = deck.format || 'modern';
        textarea.value = DeckParser.formatDeckToText(deck.mainboard, deck.sideboard, deck.commander);

        // Fetch missing metadata
        const fetchedMap = await Scryfall.fetchCardsBatch(deck.mainboard);
        fetchedMap.forEach((val, key) => DeckManager.setCardMetadata(key, val));

        renderCurrentDeckView();
        updateHeaderDeckBadge(deck);
        Training.startNewGame();
        showToast(`デッキ「${deck.name}」を開きました`, 'success');
      }
    });

    deleteSavedBtn.addEventListener('click', async () => {
      const select = document.getElementById('saved-decks-select');
      const id = select.value;
      if (!id) return;
      if (confirm('このデッキを削除してもよろしいですか？')) {
        await Storage.deleteDeck(id);
        select.querySelector(`option[value="${id}"]`)?.remove();
        showToast('デッキを削除しました', 'info');
      }
    });
  }

  function renderCurrentDeckView() {
    const container = document.getElementById('current-deck-cards-list');
    const summaryEl = document.getElementById('deck-count-summary');
    const deck = DeckManager.getCurrentDeck();

    if (!deck || !deck.mainboard || deck.mainboard.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">左側のエリアからデッキをインポートしてください</div>';
      summaryEl.textContent = '総枚数: 0枚 (土地: 0, 呪文: 0)';
      return;
    }

    const total = deck.mainboard.reduce((s, c) => s + c.count, 0);
    const metaMap = DeckManager.getCardMetadata;
    let lands = 0;
    let spells = 0;

    container.innerHTML = '';
    deck.mainboard.forEach(card => {
      const meta = metaMap(card.name);
      const isLand = meta ? meta.isLand : false;
      if (isLand) lands += card.count;
      else spells += card.count;

      const tags = DeckManager.getTagsForCard(card.name);

      const row = document.createElement('div');
      row.className = 'deck-card-row';
      row.innerHTML = `
        <div class="deck-card-info">
          <span class="deck-card-count">${card.count}</span>
          <span class="deck-card-name" title="クリックして詳細を表示">${card.name}</span>
        </div>
        <div class="deck-card-tags">
          ${tags.map(t => `<span class="badge badge-primary">${t}</span>`).join('')}
        </div>
      `;

      row.querySelector('.deck-card-name').addEventListener('click', () => {
        openCardZoomModal(card.name);
      });

      container.appendChild(row);
    });

    summaryEl.textContent = `総枚数: ${total}枚 (土地: ${lands}, 呪文: ${spells})`;
  }

  // ==========================================================================
  // TAB 2: Mulligan Training UI
  // ==========================================================================
  function setupTrainingUI() {
    const keepBtn = document.getElementById('btn-do-keep');
    const mulliganBtn = document.getElementById('btn-do-mulligan');
    const newGameBtn = document.getElementById('btn-do-new-game');
    const toggleOrderBtn = document.getElementById('btn-toggle-play-draw');
    const randomOrderBtn = document.getElementById('btn-random-play-draw');
    const blindModeCheck = document.getElementById('training-mode-toggle');
    const memoInput = document.getElementById('training-user-memo');
    const archetypeSelect = document.getElementById('train-opponent-archetype');

    // Draw advance buttons
    const drawOneBtn = document.getElementById('btn-draw-one-card');
    const advance3Btn = document.getElementById('btn-advance-to-turn-3');
    const advance5Btn = document.getElementById('btn-advance-to-turn-5');

    keepBtn.addEventListener('click', async () => {
      await Training.keep();
    });

    mulliganBtn.addEventListener('click', () => {
      Training.mulligan();
    });

    newGameBtn.addEventListener('click', () => {
      Training.startNewGame();
    });

    toggleOrderBtn.addEventListener('click', () => Training.togglePlayDraw());
    randomOrderBtn.addEventListener('click', () => Training.randomizePlayDraw());

    blindModeCheck.addEventListener('change', (e) => {
      Training.toggleBlindMode(e.target.checked);
    });

    memoInput.addEventListener('input', (e) => {
      Training.setUserMemo(e.target.value);
    });

    archetypeSelect.addEventListener('change', (e) => {
      Training.setOpponentArchetype(e.target.value);
    });

    // Reason chips
    document.querySelectorAll('#training-reasons-chips .reason-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const reason = chip.getAttribute('data-reason');
        Training.toggleReason(reason);
      });
    });

    drawOneBtn.addEventListener('click', () => Training.advanceTurn());
    advance3Btn.addEventListener('click', () => Training.advanceTurn(3));
    advance5Btn.addEventListener('click', () => Training.advanceTurn(5));

    // Register training state change listener
    Training.setOnStateChange(renderTrainingView);
  }

  function renderTrainingView(state) {
    // Toolbar stats
    document.getElementById('train-hand-count').textContent = state.hand.length;
    document.getElementById('train-mulligan-count').textContent = state.mulliganCount;
    document.getElementById('train-library-count').textContent = state.library.length;
    document.getElementById('train-turn-order').textContent = state.playOrder === 'play' ? '先攻' : '後攻';

    const landsInHand = state.hand.filter(c => c.isLand).length;
    document.getElementById('train-land-count').textContent = state.isBlindMode && !state.isKept ? '?' : landsInHand;

    const needed = Training.getBottomCardsNeeded();
    const remainingNeeded = Math.max(0, needed - state.selectedBottomIds.length);
    document.getElementById('train-bottom-needed').textContent = state.isKept ? 0 : remainingNeeded;

    // Bottom prompt banner
    const bottomPrompt = document.getElementById('bottom-selection-prompt');
    if (!state.isKept && needed > 0) {
      bottomPrompt.style.display = 'block';
      document.getElementById('bottom-cards-needed-text').textContent = remainingNeeded;
    } else {
      bottomPrompt.style.display = 'none';
    }

    // Action buttons states
    document.getElementById('btn-do-keep').disabled = state.isKept;
    document.getElementById('btn-do-mulligan').disabled = state.isKept;

    // Post keep turn bar
    const postKeepPanel = document.getElementById('training-post-keep-panel');
    if (state.isKept) {
      postKeepPanel.style.display = 'block';
      document.getElementById('current-training-turn').textContent = `ターン ${state.currentTurn}`;
      const notice = (state.currentTurn === 1 && state.playOrder === 'play') ? '先攻T1は通常ドローなし' : 'ドロー完了';
      document.getElementById('turn-draw-notice').textContent = notice;
    } else {
      postKeepPanel.style.display = 'none';
    }

    // Hand cards grid
    const handGrid = document.getElementById('training-hand-cards');
    handGrid.innerHTML = '';

    state.hand.forEach((card) => {
      const isSelected = state.selectedBottomIds.includes(card.instanceId);
      const bottomOrder = state.selectedBottomIds.indexOf(card.instanceId) + 1;

      const cardWrapper = document.createElement('div');
      cardWrapper.className = `mtg-card-wrapper ${isSelected ? 'is-bottom-selected' : ''}`;
      cardWrapper.draggable = true;
      cardWrapper.setAttribute('data-id', card.instanceId);
      if (isSelected) cardWrapper.setAttribute('data-bottom-order', bottomOrder);

      // Card image with Japanese preference and automatic English fallback
      const img = document.createElement('img');
      img.className = 'mtg-card-img';

      const prefLang = Storage.getSettings().cardLanguage || 'ja';
      const directJa = (card.set && card.collector_number)
        ? `https://api.scryfall.com/cards/${card.set.toLowerCase()}/${encodeURIComponent(card.collector_number)}/ja?format=image`
        : null;
      const directEn = (card.set && card.collector_number)
        ? `https://api.scryfall.com/cards/${card.set.toLowerCase()}/${encodeURIComponent(card.collector_number)}?format=image`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image`;

      const jaSrc = card.image_uri_ja || directJa;
      const enSrc = card.image_uri_en || directEn;

      const primarySrc = (prefLang === 'en') ? enSrc : (jaSrc || enSrc);
      img.src = primarySrc;
      img.alt = card.name;
      img.loading = 'lazy';
      img.setAttribute('data-en-fallback', enSrc);

      img.onerror = function() {
        const enFallback = this.getAttribute('data-en-fallback');
        if (enFallback && this.src !== enFallback) {
          // If Japanese image 404s (e.g. card has no Japanese print in that set), fall back to English image
          this.src = enFallback;
        } else if (!this.src.endsWith('card-back.svg')) {
          this.src = 'assets/images/card-back.svg';
        }
      };
      cardWrapper.appendChild(img);

      // Card Zoom button
      const overlayActions = document.createElement('div');
      overlayActions.className = 'card-overlay-actions';
      overlayActions.innerHTML = `<button type="button" class="card-zoom-btn" title="拡大表示">🔍</button>`;
      overlayActions.querySelector('.card-zoom-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openCardZoomModal(card.name);
      });
      cardWrapper.appendChild(overlayActions);

      // Tags strip (hidden in blind mode before keep)
      if (!state.isBlindMode || state.isKept) {
        if (card.tags && card.tags.length > 0) {
          const tagsStrip = document.createElement('div');
          tagsStrip.className = 'card-tags-strip';
          tagsStrip.innerHTML = card.tags.slice(0, 3).map(t => `<span class="badge badge-primary">${t}</span>`).join('');
          cardWrapper.appendChild(tagsStrip);
        }
      }

      // Tap / Click to select bottom card or swap
      cardWrapper.addEventListener('click', () => {
        if (!state.isKept && needed > 0) {
          Training.toggleBottomCard(card.instanceId);
        }
      });

      // Drag and drop reordering
      setupCardDragAndDrop(cardWrapper, card.instanceId);

      handGrid.appendChild(cardWrapper);
    });

    // Reason chips selection state
    document.querySelectorAll('#training-reasons-chips .reason-chip').forEach(chip => {
      const reason = chip.getAttribute('data-reason');
      if (state.selectedReasons.has(reason)) {
        chip.classList.add('selected');
      } else {
        chip.classList.remove('selected');
      }
    });

    // Conditions Feedback (Blind mode hides during contemplation)
    const feedbackList = document.getElementById('training-condition-feedback-list');
    feedbackList.innerHTML = '';

    if (state.isBlindMode && !state.isKept) {
      feedbackList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">ブラインドモード中: キープ判断後に分析結果が表示されます。</div>';
    } else {
      const deck = state.deck;
      if (deck && deck.keepConditions) {
        const evalResult = Training.evaluateHand(state.hand, deck.keepConditions);
        if (evalResult.details.length === 0) {
          feedbackList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">キープ条件が設定されていません。</div>';
        } else {
          evalResult.details.forEach(item => {
            const div = document.createElement('div');
            div.className = 'condition-item-status';
            div.innerHTML = `
              <span class="status-icon ${item.passed ? 'success' : 'fail'}">${item.passed ? '✔' : '✖'}</span>
              <span>${item.rule}</span>
            `;
            feedbackList.appendChild(div);
          });
        }
      }
    }
  }

  function setupCardDragAndDrop(el, instanceId) {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', instanceId);
      el.classList.add('dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== instanceId) {
        Training.reorderHand(sourceId, instanceId);
      }
    });
  }

  // ==========================================================================
  // TAB 3: Opening Hand Analysis UI
  // ==========================================================================
  function renderAnalysisTab() {
    const deck = DeckManager.getCurrentDeck();
    if (!deck) return;

    const stats = Analysis.analyzeDeck(deck);
    if (!stats) return;

    // Land distribution
    const landData = stats.landProbabilities.map(p => ({
      label: `${p.count}枚`,
      value: p.exact,
      color: (p.count >= 2 && p.count <= 4) ? '#10b981' : '#f59e0b'
    }));
    Analysis.renderBarChart('chart-land-distribution', landData, { isPercent: true });

    // Land stats table
    const landTableBody = document.getElementById('table-land-stats-body');
    landTableBody.innerHTML = '';
    stats.landProbabilities.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>土地 ${p.count} 枚</td>
        <td class="numeric">${(p.exact * 100).toFixed(1)}%</td>
        <td class="numeric">${(p.atLeast * 100).toFixed(1)}%</td>
      `;
      landTableBody.appendChild(tr);
    });

    document.getElementById('stat-avg-lands').textContent = stats.expectedLands.toFixed(2);
    document.getElementById('stat-land-screw-flood').textContent = ((stats.screwRate + stats.floodRate) * 100).toFixed(1);

    // Tags distribution
    const tagBarData = stats.tagStats.slice(0, 8).map(t => ({
      label: t.tag,
      value: t.pAtLeast1,
      color: '#06b6d4'
    }));
    Analysis.renderHorizontalBarChart('chart-tags-distribution', tagBarData);

    const tagsTableBody = document.getElementById('table-tags-stats-body');
    tagsTableBody.innerHTML = '';
    stats.tagStats.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.tag}</td>
        <td class="numeric">${t.deckCount}枚</td>
        <td class="numeric">${(t.pAtLeast1 * 100).toFixed(1)}%</td>
        <td class="numeric">${(t.pAtLeast2 * 100).toFixed(1)}%</td>
      `;
      tagsTableBody.appendChild(tr);
    });

    // Mana Curve
    const cmcData = Object.entries(stats.cmcDistribution).map(([cmc, count]) => ({
      label: cmc,
      value: count,
      color: '#6366f1'
    }));
    Analysis.renderBarChart('chart-mana-curve', cmcData, { isPercent: false });
    document.getElementById('stat-avg-spell-cmc').textContent = stats.avgSpellCmc;
    document.getElementById('stat-avg-deck-cmc').textContent = stats.avgDeckCmc;

    // Color Sources Chips
    const colorChips = document.getElementById('color-sources-stat-chips');
    colorChips.innerHTML = '';
    const colorLabels = { W: '白', U: '青', B: '黒', R: '赤', G: '緑', C: '無色' };
    const colorBgs = { W: '#f8fafc', U: '#38bdf8', B: '#a1a1aa', R: '#f87171', G: '#4ade80', C: '#cbd5e1' };

    Object.entries(stats.colorSources).forEach(([col, count]) => {
      if (count > 0) {
        const span = document.createElement('span');
        span.className = 'badge';
        span.style.background = 'var(--bg-secondary)';
        span.style.border = `1px solid ${colorBgs[col] || '#ccc'}`;
        span.style.color = 'var(--text-primary)';
        span.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${colorBgs[col]}; margin-right:4px;"></span> ${colorLabels[col]}: ${count}枚 (${((count / stats.totalCards) * 100).toFixed(0)}%)`;
        colorChips.appendChild(span);
      }
    });

    // Turn Progression Target Selector
    const targetSelect = document.getElementById('turn-sim-target-select');
    targetSelect.innerHTML = '';
    targetSelect.innerHTML += `<option value="land">土地 (${stats.totalLands}枚)</option>`;
    stats.tagStats.forEach(t => {
      targetSelect.innerHTML += `<option value="tag_${t.tag}">タグ: ${t.tag} (${t.deckCount}枚)</option>`;
    });

    updateTurnProgressionChart();
  }

  function updateTurnProgressionChart() {
    const deck = DeckManager.getCurrentDeck();
    if (!deck) return;

    const stats = Analysis.analyzeDeck(deck);
    if (!stats) return;

    const targetVal = document.getElementById('turn-sim-target-select').value;
    const playOrder = document.getElementById('turn-sim-play-draw-select').value;
    const isPlay = playOrder === 'play';

    let count = stats.totalLands;
    if (targetVal.startsWith('tag_')) {
      const tagName = targetVal.replace('tag_', '');
      const t = stats.tagStats.find(x => x.tag === tagName);
      count = t ? t.deckCount : 0;
    }

    const points = Analysis.projectTurnProgression(stats.totalCards, count, 10, isPlay);
    Analysis.renderLineChart('chart-turn-progression', points);
  }

  // ==========================================================================
  // TAB 4: Keep Conditions Builder & Simulation UI
  // ==========================================================================
  function setupConditionBuilderAndSimulation() {
    const addRuleBtn = document.getElementById('btn-add-condition-rule');
    const addGroupBtn = document.getElementById('btn-add-condition-group');
    const runSimBtn = document.getElementById('btn-run-simulation');
    const cancelSimBtn = document.getElementById('btn-cancel-simulation');
    const iterSelect = document.getElementById('sim-iterations-select');
    const customIterWrap = document.getElementById('sim-custom-iter-wrap');

    iterSelect.addEventListener('change', () => {
      customIterWrap.style.display = iterSelect.value === 'custom' ? 'block' : 'none';
    });

    addRuleBtn.addEventListener('click', () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck || !deck.keepConditions) return;
      if (!deck.keepConditions.children) deck.keepConditions.children = [];

      deck.keepConditions.children.push({
        id: 'rule_' + Date.now(),
        type: 'rule',
        field: 'lands',
        min: 2,
        max: 4
      });
      renderConditionBuilder();
    });

    addGroupBtn.addEventListener('click', () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck || !deck.keepConditions) return;
      if (!deck.keepConditions.children) deck.keepConditions.children = [];

      deck.keepConditions.children.push({
        id: 'group_' + Date.now(),
        type: 'group',
        operator: 'OR',
        children: [
          { id: 'rule_sub_' + Date.now(), type: 'rule', field: 'tag', tag: 'キーカード', min: 1 }
        ]
      });
      renderConditionBuilder();
    });

    // Run Simulation
    runSimBtn.addEventListener('click', () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck || !deck.mainboard || deck.mainboard.length === 0) {
        showToast('シミュレーション対象のデッキがありません', 'warning');
        return;
      }

      let iters = parseInt(iterSelect.value, 10);
      if (iterSelect.value === 'custom') {
        iters = parseInt(document.getElementById('sim-custom-iterations').value, 10) || 10000;
      }

      const seed = document.getElementById('sim-random-seed').value.trim();
      const maxMulls = parseInt(document.getElementById('sim-max-mulligans').value, 10) || 4;
      const settings = Storage.getSettings();

      // Build lightweight payload for worker
      const metaMap = DeckManager.getCardMetadata;
      const fullLibrary = Mulligan.buildLibrary(deck.mainboard, metaMap, deck.cardTags, deck.mdfcLandSettings);
      const lightweightLibrary = fullLibrary.map(c => ({
        id: c.instanceId,
        key: c.key,
        name: c.name,
        isLand: c.isLand,
        cmc: c.cmc,
        tags: c.tags,
        mana_sources: c.mana_sources
      }));

      // Worker setup
      if (simulationWorker) simulationWorker.terminate();
      simulationWorker = new Worker('js/simulation-worker.js');

      runSimBtn.style.display = 'none';
      cancelSimBtn.style.display = 'inline-flex';
      const progressWrap = document.getElementById('sim-progress-bar-wrap');
      const progressFill = document.getElementById('sim-progress-bar-fill');
      const progressLabel = document.getElementById('sim-progress-label');
      progressWrap.style.display = 'block';
      progressLabel.style.display = 'block';
      progressFill.style.width = '0%';
      progressLabel.textContent = `0 / ${iters} 回計算中...`;

      simulationWorker.postMessage({
        type: 'start',
        payload: {
          library: lightweightLibrary,
          iterations: iters,
          maxMulligans: maxMulls,
          conditionAST: deck.keepConditions,
          format: deck.format,
          freeMulliganRule: settings.freeMulligan,
          seed: seed
        }
      });

      simulationWorker.onmessage = (e) => {
        const data = e.data;
        if (data.type === 'progress') {
          const pct = Math.floor(data.progress * 100);
          progressFill.style.width = `${pct}%`;
          progressLabel.textContent = `${data.current} / ${data.total} 回 (${pct}%)`;
        } else if (data.type === 'complete') {
          progressFill.style.width = '100%';
          progressLabel.textContent = '完了！';
          runSimBtn.style.display = 'inline-flex';
          cancelSimBtn.style.display = 'none';
          setTimeout(() => {
            progressWrap.style.display = 'none';
            progressLabel.style.display = 'none';
          }, 800);
          renderSimulationResults(data.results);
          showToast('自動マリガンシミュレーションが完了しました', 'success');
        } else if (data.type === 'cancelled') {
          progressWrap.style.display = 'none';
          progressLabel.style.display = 'none';
          runSimBtn.style.display = 'inline-flex';
          cancelSimBtn.style.display = 'none';
          showToast('シミュレーションを中断しました', 'info');
        }
      };
    });

    cancelSimBtn.addEventListener('click', () => {
      if (simulationWorker) {
        simulationWorker.postMessage({ type: 'cancel' });
      }
    });

    // Presets modal
    document.getElementById('btn-open-condition-presets').addEventListener('click', () => {
      renderConditionPresetsList();
      openModal('modal-condition-presets');
    });
    document.getElementById('btn-close-condition-presets').addEventListener('click', () => {
      closeModal('modal-condition-presets');
    });

    document.getElementById('btn-save-as-new-preset').addEventListener('click', () => {
      const name = document.getElementById('preset-new-name-input').value.trim();
      const deck = DeckManager.getCurrentDeck();
      if (!name || !deck) return;
      const presets = Storage.getConditionPresets();
      presets.push({
        id: 'preset_' + Date.now(),
        name,
        conditions: JSON.parse(JSON.stringify(deck.keepConditions))
      });
      Storage.saveConditionPresets(presets);
      document.getElementById('preset-new-name-input').value = '';
      renderConditionPresetsList();
      showToast('プリセットを保存しました', 'success');
    });
  }

  function renderConditionBuilder() {
    const container = document.getElementById('condition-builder-root');
    const deck = DeckManager.getCurrentDeck();
    if (!container || !deck || !deck.keepConditions) return;

    container.innerHTML = '';
    renderConditionNode(deck.keepConditions, container, true);
  }

  function renderConditionNode(node, parentEl, isRoot = false) {
    if (node.type === 'group') {
      const groupEl = document.createElement('div');
      groupEl.className = 'condition-group-node';

      const headerEl = document.createElement('div');
      headerEl.className = 'condition-group-header';

      // Operator selector
      const opSelect = document.createElement('select');
      opSelect.className = 'form-select';
      opSelect.style.width = 'auto';
      opSelect.innerHTML = `
        <option value="AND" ${node.operator === 'AND' ? 'selected' : ''}>すべての条件を満たす (AND)</option>
        <option value="OR" ${node.operator === 'OR' ? 'selected' : ''}>いずれかの条件を満たす (OR)</option>
        <option value="NOT" ${node.operator === 'NOT' ? 'selected' : ''}>条件を満たさないこと (NOT)</option>
      `;
      opSelect.addEventListener('change', () => {
        node.operator = opSelect.value;
      });
      headerEl.appendChild(opSelect);

      if (!isRoot) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger btn-sm';
        delBtn.textContent = '✕ グループ削除';
        delBtn.addEventListener('click', () => {
          removeNodeFromTree(node.id);
          renderConditionBuilder();
        });
        headerEl.appendChild(delBtn);
      }

      groupEl.appendChild(headerEl);

      const childrenContainer = document.createElement('div');
      (node.children || []).forEach(child => {
        renderConditionNode(child, childrenContainer, false);
      });
      groupEl.appendChild(childrenContainer);

      parentEl.appendChild(groupEl);
    } else if (node.type === 'rule') {
      const row = document.createElement('div');
      row.className = 'condition-rule-row';

      // Rule Field Selector
      const fieldSelect = document.createElement('select');
      fieldSelect.className = 'form-select';
      fieldSelect.style.width = 'auto';
      fieldSelect.innerHTML = `
        <option value="lands" ${node.field === 'lands' ? 'selected' : ''}>土地枚数</option>
        <option value="tag" ${node.field === 'tag' ? 'selected' : ''}>指定タグの枚数</option>
        <option value="card" ${node.field === 'card' ? 'selected' : ''}>指定カードの枚数</option>
        <option value="color" ${node.field === 'color' ? 'selected' : ''}>色マナ供給源</option>
        <option value="cmc" ${node.field === 'cmc' ? 'selected' : ''}>指定マナ総量(CMC)</option>
        <option value="not_card" ${node.field === 'not_card' ? 'selected' : ''}>カードが含まれないこと</option>
      `;

      fieldSelect.addEventListener('change', () => {
        node.field = fieldSelect.value;
        renderConditionBuilder();
      });
      row.appendChild(fieldSelect);

      // Value inputs depending on field
      if (node.field === 'lands') {
        row.innerHTML += `
          <span>最小:</span> <input type="number" class="form-control" style="width:70px;" value="${node.min !== undefined ? node.min : 2}" min="0" max="7" data-field="min">
          <span>〜 最大:</span> <input type="number" class="form-control" style="width:70px;" value="${node.max !== undefined ? node.max : 4}" min="0" max="7" data-field="max">
        `;
      } else if (node.field === 'tag') {
        const tags = DeckManager.getAllAvailableTags();
        const tagSelect = document.createElement('select');
        tagSelect.className = 'form-select';
        tagSelect.style.width = 'auto';
        tags.forEach(t => {
          tagSelect.innerHTML += `<option value="${t.name}" ${node.tag === t.name ? 'selected' : ''}>${t.name}</option>`;
        });
        tagSelect.addEventListener('change', () => node.tag = tagSelect.value);
        if (!node.tag && tags.length > 0) node.tag = tags[0].name;
        row.appendChild(tagSelect);
        row.innerHTML += `
          <span>が最小</span> <input type="number" class="form-control" style="width:70px;" value="${node.min !== undefined ? node.min : 1}" min="1" max="7" data-field="min">
          <span>枚以上</span>
        `;
      } else if (node.field === 'card') {
        const deck = DeckManager.getCurrentDeck();
        const cardSelect = document.createElement('select');
        cardSelect.className = 'form-select';
        cardSelect.style.width = 'auto';
        (deck.mainboard || []).forEach(c => {
          cardSelect.innerHTML += `<option value="${c.name}" ${node.cardName === c.name ? 'selected' : ''}>${c.name}</option>`;
        });
        cardSelect.addEventListener('change', () => node.cardName = cardSelect.value);
        if (!node.cardName && deck.mainboard.length > 0) node.cardName = deck.mainboard[0].name;
        row.appendChild(cardSelect);
        row.innerHTML += `
          <span>が最小</span> <input type="number" class="form-control" style="width:70px;" value="${node.min !== undefined ? node.min : 1}" min="1" max="4" data-field="min">
          <span>枚以上</span>
        `;
      } else if (node.field === 'color') {
        row.innerHTML += `
          <select class="form-select" style="width:auto;" data-field="color">
            <option value="W" ${node.color === 'W' ? 'selected' : ''}>白 {W}</option>
            <option value="U" ${node.color === 'U' ? 'selected' : ''}>青 {U}</option>
            <option value="B" ${node.color === 'B' ? 'selected' : ''}>黒 {B}</option>
            <option value="R" ${node.color === 'R' ? 'selected' : ''}>赤 {R}</option>
            <option value="G" ${node.color === 'G' ? 'selected' : ''}>緑 {G}</option>
          </select>
          <span>が 1 枚以上</span>
        `;
      } else if (node.field === 'cmc') {
        row.innerHTML += `
          <span>CMC:</span> <input type="number" class="form-control" style="width:70px;" value="${node.cmc || 1}" min="0" max="15" data-field="cmc">
          <span>が最小</span> <input type="number" class="form-control" style="width:70px;" value="${node.min || 1}" min="1" max="7" data-field="min">
          <span>枚以上</span>
        `;
      } else if (node.field === 'not_card') {
        const deck = DeckManager.getCurrentDeck();
        const cardSelect = document.createElement('select');
        cardSelect.className = 'form-select';
        cardSelect.style.width = 'auto';
        (deck.mainboard || []).forEach(c => {
          cardSelect.innerHTML += `<option value="${c.name}" ${node.cardName === c.name ? 'selected' : ''}>${c.name}</option>`;
        });
        cardSelect.addEventListener('change', () => node.cardName = cardSelect.value);
        row.appendChild(cardSelect);
        row.innerHTML += `<span>を含まない</span>`;
      }

      // Input change listeners
      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
          const field = inp.getAttribute('data-field');
          node[field] = parseInt(inp.value, 10);
        });
      });
      row.querySelectorAll('select[data-field]').forEach(sel => {
        sel.addEventListener('change', () => {
          const field = sel.getAttribute('data-field');
          node[field] = sel.value;
        });
      });

      // Remove rule button
      const delRuleBtn = document.createElement('button');
      delRuleBtn.className = 'btn btn-danger btn-sm';
      delRuleBtn.textContent = '✕';
      delRuleBtn.title = '条件を削除';
      delRuleBtn.addEventListener('click', () => {
        removeNodeFromTree(node.id);
        renderConditionBuilder();
      });
      row.appendChild(delRuleBtn);

      parentEl.appendChild(row);
    }
  }

  function removeNodeFromTree(nodeId) {
    const deck = DeckManager.getCurrentDeck();
    if (!deck || !deck.keepConditions) return;

    function searchAndRemove(parent) {
      if (!parent.children) return false;
      const idx = parent.children.findIndex(c => c.id === nodeId);
      if (idx > -1) {
        parent.children.splice(idx, 1);
        return true;
      }
      for (const child of parent.children) {
        if (child.type === 'group') {
          if (searchAndRemove(child)) return true;
        }
      }
      return false;
    }
    searchAndRemove(deck.keepConditions);
  }

  function renderSimulationResults(res) {
    const panel = document.getElementById('sim-results-panel');
    panel.style.display = 'block';

    document.getElementById('sim-summary-timestamp').textContent = `試行: ${res.iterations.toLocaleString()}回 (${new Date().toLocaleTimeString()})`;

    // Hand size distribution
    const handSizeData = [
      { label: '7枚', value: res.keep7Rate, color: '#10b981' },
      { label: '6枚', value: res.keep6Rate, color: '#38bdf8' },
      { label: '5枚', value: res.keep5Rate, color: '#f59e0b' },
      { label: '4枚以下', value: res.keep4Rate, color: '#ef4444' }
    ];
    Analysis.renderBarChart('chart-sim-handsize', handSizeData, { isPercent: true });

    // Land count in kept hands
    const landData = Object.entries(res.keptLandCounts).map(([k, count]) => ({
      label: `${k}枚`,
      value: count / res.iterations,
      color: '#6366f1'
    }));
    Analysis.renderBarChart('chart-sim-mulligans', landData, { isPercent: true });

    // Key metrics tiles
    document.getElementById('sim-stat-keep7').textContent = `${(res.keep7Rate * 100).toFixed(1)}%`;
    document.getElementById('sim-ci-keep7').textContent = `95% CI: [${(res.ci7.lower * 100).toFixed(1)}% - ${(res.ci7.upper * 100).toFixed(1)}%]`;
    document.getElementById('sim-stat-success-rate').textContent = `${(res.successRate * 100).toFixed(1)}%`;
    document.getElementById('sim-stat-avg-handsize').textContent = `${res.avgHandSize} 枚`;
    document.getElementById('sim-stat-avg-mulligans').textContent = `${res.avgMulligans} 回`;
    document.getElementById('sim-stat-forced-keep').textContent = `${(res.forcedKeepRate * 100).toFixed(1)}%`;
  }

  function renderConditionPresetsList() {
    const container = document.getElementById('presets-list-container');
    const presets = Storage.getConditionPresets();
    container.innerHTML = '';

    if (presets.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:1rem; text-align:center;">保存されたプリセットはありません</div>';
      return;
    }

    presets.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'deck-card-row';
      row.innerHTML = `
        <span><strong>${p.name}</strong></span>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-primary btn-sm btn-load-preset">適用</button>
          <button type="button" class="btn btn-danger btn-sm btn-del-preset">削除</button>
        </div>
      `;

      row.querySelector('.btn-load-preset').addEventListener('click', () => {
        const deck = DeckManager.getCurrentDeck();
        if (deck) {
          deck.keepConditions = JSON.parse(JSON.stringify(p.conditions));
          renderConditionBuilder();
          closeModal('modal-condition-presets');
          showToast(`プリセット「${p.name}」を適用しました`, 'success');
        }
      });

      row.querySelector('.btn-del-preset').addEventListener('click', () => {
        presets.splice(idx, 1);
        Storage.saveConditionPresets(presets);
        renderConditionPresetsList();
        showToast('プリセットを削除しました', 'info');
      });

      container.appendChild(row);
    });
  }

  // ==========================================================================
  // TAB 5: Card Roles & Tags UI
  // ==========================================================================
  function setupRolesTab() {
    const autoTagBtn = document.getElementById('btn-auto-tag-deck');
    const newTagBtn = document.getElementById('btn-open-create-tag-modal');
    const checkAll = document.getElementById('roles-check-all');

    autoTagBtn.addEventListener('click', () => {
      const deck = DeckManager.getCurrentDeck();
      if (!deck) return;
      const metaMap = new Map();
      deck.mainboard.forEach(c => {
        const meta = DeckManager.getCardMetadata(c.name);
        if (meta) metaMap.set(c.name.toLowerCase().trim(), meta);
      });
      deck.cardTags = DeckManager.autoCategorizeCards(deck.mainboard, metaMap);
      renderRolesTab();
      showToast('カード役割の自動分類を再適用しました', 'success');
    });

    newTagBtn.addEventListener('click', () => {
      openModal('modal-create-tag');
    });

    document.getElementById('btn-cancel-create-tag').addEventListener('click', () => {
      closeModal('modal-create-tag');
    });

    document.getElementById('btn-confirm-create-tag').addEventListener('click', () => {
      const name = document.getElementById('custom-tag-name-input').value.trim();
      const color = document.getElementById('custom-tag-color-input').value;
      if (!name) return;
      DeckManager.addCustomTag(name, color);
      closeModal('modal-create-tag');
      renderRolesTab();
      showToast(`タグ「${name}」を作成しました`, 'success');
    });

    checkAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.card-role-row-check');
      checkboxes.forEach(cb => cb.checked = checkAll.checked);
    });
  }

  function renderRolesTab() {
    const deck = DeckManager.getCurrentDeck();
    if (!deck) return;

    // Tags palette
    const palette = document.getElementById('roles-all-tags-palette');
    palette.innerHTML = '';
    const tags = DeckManager.getAllAvailableTags();
    tags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip clickable';
      chip.style.borderLeft = `4px solid ${t.color}`;
      chip.textContent = t.name;

      // Click on chip adds tag to all checked cards
      chip.addEventListener('click', () => {
        const checkedRows = document.querySelectorAll('.card-role-row-check:checked');
        if (checkedRows.length === 0) {
          showToast('タグを付与したいカードにチェックを入れてください', 'info');
          return;
        }
        checkedRows.forEach(cb => {
          const cardName = cb.getAttribute('data-card-name');
          DeckManager.assignTagToCard(cardName, t.name);
        });
        renderRolesTable();
        showToast(`選択したカードにタグ「${t.name}」を付与しました`, 'success');
      });

      palette.appendChild(chip);
    });

    renderRolesTable();
  }

  function renderRolesTable() {
    const deck = DeckManager.getCurrentDeck();
    const tbody = document.getElementById('roles-cards-tbody');
    tbody.innerHTML = '';

    if (!deck || !deck.mainboard) return;

    const metaMap = DeckManager.getCardMetadata;

    deck.mainboard.forEach(card => {
      const meta = metaMap(card.name);
      const tags = DeckManager.getTagsForCard(card.name);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="checkbox" class="card-role-row-check" data-card-name="${card.name}"></td>
        <td>${card.count}</td>
        <td><strong>${card.name}</strong></td>
        <td>${meta ? meta.type_line : '-'}</td>
        <td>${meta ? meta.mana_cost : '-'}</td>
        <td>
          <div class="card-assigned-tags" style="display:flex; flex-wrap:wrap; gap:0.25rem;">
            ${tags.map(t => `<span class="badge badge-primary tag-removable" data-tag="${t}">${t} &times;</span>`).join('')}
          </div>
        </td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-add-tag-to-card">+ タグ</button>
        </td>
      `;

      // Remove tag click
      tr.querySelectorAll('.tag-removable').forEach(tagSpan => {
        tagSpan.addEventListener('click', () => {
          const tName = tagSpan.getAttribute('data-tag');
          DeckManager.removeTagFromCard(card.name, tName);
          renderRolesTable();
        });
      });

      // Quick add tag dropdown
      tr.querySelector('.btn-add-tag-to-card').addEventListener('click', () => {
        const tagName = prompt(`「${card.name}」に付与するタグ名を入力:`, 'キーカード');
        if (tagName) {
          DeckManager.assignTagToCard(card.name, tagName.trim());
          renderRolesTable();
        }
      });

      tbody.appendChild(tr);
    });
  }

  // ==========================================================================
  // TAB 6: Training History UI
  // ==========================================================================
  function setupHistoryTab() {
    const clearBtn = document.getElementById('btn-clear-history');
    const exportCsvBtn = document.getElementById('btn-export-history-csv');

    clearBtn.addEventListener('click', async () => {
      if (confirm('すべてのトレーニング履歴を消去してもよろしいですか？')) {
        await Storage.clearHistory();
        renderHistoryTab();
        showToast('トレーニング履歴を消去しました', 'info');
      }
    });

    exportCsvBtn.addEventListener('click', async () => {
      const history = await Storage.getAllHistory();
      if (history.length === 0) {
        showToast('エクスポートする履歴がありません', 'warning');
        return;
      }

      const headers = ['日時', 'デッキ名', '先攻/後攻', '想定相手', 'マリガン回数', '最終手札枚数', '条件成立', '判断理由', '手札カード', 'メモ'];
      const rows = history.map(h => [
        new Date(h.timestamp).toLocaleString('ja-JP'),
        h.deckName,
        h.playOrder === 'play' ? '先攻' : '後攻',
        h.opponentArchetype,
        h.mulliganCount,
        h.finalHand ? h.finalHand.length : 7,
        h.conditionMatch ? '適合' : '不一致',
        (h.reasons || []).join('; '),
        (h.finalHand || []).join('; '),
        h.userMemo || ''
      ]);

      Storage.exportCSV(`mulligan_history_${Date.now()}.csv`, headers, rows);
    });

    document.getElementById('btn-close-history-detail').addEventListener('click', () => {
      closeModal('modal-history-detail');
    });
  }

  async function renderHistoryTab() {
    const history = await Storage.getAllHistory();
    const tbody = document.getElementById('history-records-tbody');
    tbody.innerHTML = '';

    const total = history.length;
    document.getElementById('hist-stat-total').textContent = total;

    if (total === 0) {
      document.getElementById('hist-stat-keep-rate').textContent = '0%';
      document.getElementById('hist-stat-avg-mull').textContent = '0.0';
      document.getElementById('hist-stat-match-rate').textContent = '0%';
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding:2rem;">履歴がありません</td></tr>';
      return;
    }

    const keep7Count = history.filter(h => h.mulliganCount === 0).length;
    const matchCount = history.filter(h => h.conditionMatch).length;
    const totalMulls = history.reduce((s, h) => s + (h.mulliganCount || 0), 0);

    document.getElementById('hist-stat-keep-rate').textContent = `${((keep7Count / total) * 100).toFixed(1)}%`;
    document.getElementById('hist-stat-avg-mull').textContent = (totalMulls / total).toFixed(2);
    document.getElementById('hist-stat-match-rate').textContent = `${((matchCount / total) * 100).toFixed(1)}%`;

    history.slice(0, 50).forEach(record => {
      const tr = document.createElement('tr');
      const dateStr = new Date(record.timestamp).toLocaleTimeString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      tr.innerHTML = `
        <td>${dateStr}</td>
        <td>${record.deckName}</td>
        <td>${record.playOrder === 'play' ? '先攻' : '後攻'}</td>
        <td>${record.opponentArchetype}</td>
        <td class="numeric">${record.mulliganCount}回</td>
        <td class="numeric">${record.finalHand ? record.finalHand.length : 7}枚</td>
        <td><span class="badge ${record.conditionMatch ? 'badge-success' : 'badge-warning'}">${record.conditionMatch ? '適合' : '不一致'}</span></td>
        <td>${(record.reasons || []).slice(0, 2).join(', ')}</td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm btn-open-detail">詳細/復習</button>
        </td>
      `;

      tr.querySelector('.btn-open-detail').addEventListener('click', () => {
        openHistoryDetailModal(record);
      });

      tbody.appendChild(tr);
    });
  }

  function openHistoryDetailModal(record) {
    const body = document.getElementById('history-detail-body');
    body.innerHTML = `
      <div style="margin-bottom:1rem;">
        <strong>日時:</strong> ${new Date(record.timestamp).toLocaleString()} |
        <strong>デッキ:</strong> ${record.deckName} |
        <strong>先攻/後攻:</strong> ${record.playOrder === 'play' ? '先攻' : '後攻'} |
        <strong>想定相手:</strong> ${record.opponentArchetype}
      </div>
      <div style="margin-bottom:1rem;">
        <h4>最終手札 (${record.finalHand ? record.finalHand.length : 7}枚 / マリガン: ${record.mulliganCount}回):</h4>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
          ${(record.finalHand || []).map(c => `<span class="tag-chip">${c}</span>`).join('')}
        </div>
      </div>
      ${record.bottomCards && record.bottomCards.length > 0 ? `
        <div style="margin-bottom:1rem;">
          <h4>ライブラリーの一番下に送ったカード:</h4>
          <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
            ${record.bottomCards.map(c => `<span class="tag-chip" style="color:var(--danger);">${c}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      <div style="margin-bottom:1rem;">
        <strong>記録された理由:</strong> ${(record.reasons || []).join(', ') || 'なし'}<br>
        <strong>メモ:</strong> ${record.userMemo || 'なし'}
      </div>
    `;

    const reviewBtn = document.getElementById('btn-load-review-session');
    reviewBtn.onclick = () => {
      Training.loadReviewSession(record);
      closeModal('modal-history-detail');
      switchTab('tab-training');
      showToast('過去の手札を復習モードで読み込みました', 'info');
    };

    openModal('modal-history-detail');
  }

  // ==========================================================================
  // TAB 7: Deck Comparison UI
  // ==========================================================================
  function setupCompareTab() {
    const runBtn = document.getElementById('btn-run-deck-comparison');
    runBtn.addEventListener('click', () => {
      runDeckComparison();
    });
  }

  async function populateCompareDeckSelects() {
    const decks = await Storage.getAllDecks();
    const selA = document.getElementById('compare-deck-a-select');
    const selB = document.getElementById('compare-deck-b-select');
    selA.innerHTML = '';
    selB.innerHTML = '';

    decks.forEach((d, idx) => {
      const optA = document.createElement('option');
      optA.value = d.id;
      optA.textContent = d.name;
      if (idx === 0) optA.selected = true;
      selA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = d.id;
      optB.textContent = d.name;
      if (idx === 1) optB.selected = true;
      selB.appendChild(optB);
    });
  }

  async function runDeckComparison() {
    const selA = document.getElementById('compare-deck-a-select');
    const selB = document.getElementById('compare-deck-b-select');

    if (!selA.value || !selB.value) {
      showToast('比較する2つのデッキを選択してください', 'warning');
      return;
    }

    const deckA = await Storage.getDeck(selA.value);
    const deckB = await Storage.getDeck(selB.value);
    if (!deckA || !deckB) return;

    const statsA = Analysis.analyzeDeck(deckA);
    const statsB = Analysis.analyzeDeck(deckB);
    if (!statsA || !statsB) return;

    const resultsArea = document.getElementById('compare-results-area');
    resultsArea.style.display = 'block';

    const categories = ['土地期待値', '土地2〜4枚率', '土地事故率'];
    const p24A = statsA.landProbabilities.filter(p => p.count >= 2 && p.count <= 4).reduce((s, p) => s + p.exact, 0);
    const p24B = statsB.landProbabilities.filter(p => p.count >= 2 && p.count <= 4).reduce((s, p) => s + p.exact, 0);
    const accidentA = statsA.screwRate + statsA.floodRate;
    const accidentB = statsB.screwRate + statsB.floodRate;

    const seriesA = [statsA.expectedLands / 7, p24A, accidentA];
    const seriesB = [statsB.expectedLands / 7, p24B, accidentB];

    Analysis.renderGroupedBarChart('chart-compare-bars', categories, seriesA, seriesB);

    // Table rows
    const tbody = document.getElementById('compare-table-tbody');
    tbody.innerHTML = '';

    function addRow(label, valA, valB, isPercent = true) {
      const tr = document.createElement('tr');
      const diff = valB - valA;
      const diffStr = isPercent
        ? `${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)} pp`
        : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`;
      const diffColor = diff > 0 ? 'var(--success)' : (diff < 0 ? 'var(--danger)' : 'var(--text-muted)');

      tr.innerHTML = `
        <td>${label}</td>
        <td class="numeric">${isPercent ? (valA * 100).toFixed(1) + '%' : valA}</td>
        <td class="numeric">${isPercent ? (valB * 100).toFixed(1) + '%' : valB}</td>
        <td class="numeric" style="color:${diffColor}; font-weight:700;">${diffStr}</td>
      `;
      tbody.appendChild(tr);
    }

    addRow('総デッキ枚数', statsA.totalCards, statsB.totalCards, false);
    addRow('採用土地枚数', statsA.totalLands, statsB.totalLands, false);
    addRow('平均初期手札土地枚数', statsA.expectedLands.toFixed(2), statsB.expectedLands.toFixed(2), false);
    addRow('土地適正率 (2〜4枚)', p24A, p24B, true);
    addRow('土地事故率 (スクリュー+フラッド)', accidentA, accidentB, true);
    addRow('呪文平均CMC', statsA.avgSpellCmc, statsB.avgSpellCmc, false);
  }

  // ==========================================================================
  // TAB 8: Settings UI
  // ==========================================================================
  function setupSettingsTab() {
    const freeMullSelect = document.getElementById('setting-free-mulligan');
    const handSizeInput = document.getElementById('setting-initial-hand-size');
    const screwSelect = document.getElementById('setting-land-screw-threshold');
    const floodSelect = document.getElementById('setting-land-flood-threshold');
    const exportJsonBtn = document.getElementById('btn-export-backup-json');
    const importJsonBtn = document.getElementById('btn-import-backup-json');
    const backupFileInput = document.getElementById('backup-file-input');
    const resetBtn = document.getElementById('btn-reset-all-data');

    const settings = Storage.getSettings();
    freeMullSelect.value = settings.freeMulligan || 'auto';
    handSizeInput.value = settings.initialHandSize || 7;
    screwSelect.value = settings.landScrewThreshold !== undefined ? settings.landScrewThreshold : 1;
    floodSelect.value = settings.landFloodThreshold !== undefined ? settings.landFloodThreshold : 5;

    const langSelect = document.getElementById('setting-card-language');
    if (langSelect) {
      langSelect.value = settings.cardLanguage || 'ja';
      langSelect.addEventListener('change', () => {
        settings.cardLanguage = langSelect.value;
        Storage.saveSettings(settings);
        const textEl = document.getElementById('lang-btn-text');
        if (textEl) {
          textEl.textContent = settings.cardLanguage === 'ja' ? '🇯🇵 日本語' : '🇺🇸 EN';
        }
        Training.switchCardLanguage(settings.cardLanguage);
        renderCurrentDeckView();
        showToast('カード表示言語設定を保存しました', 'success');
      });
    }

    [freeMullSelect, handSizeInput, screwSelect, floodSelect].forEach(el => {
      el.addEventListener('change', () => {
        settings.freeMulligan = freeMullSelect.value;
        settings.initialHandSize = parseInt(handSizeInput.value, 10) || 7;
        settings.landScrewThreshold = parseInt(screwSelect.value, 10);
        settings.landFloodThreshold = parseInt(floodSelect.value, 10);
        Storage.saveSettings(settings);
        showToast('設定を保存しました', 'success');
      });
    });

    // Export JSON Backup
    exportJsonBtn.addEventListener('click', async () => {
      const data = await Storage.exportAllDataJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mulligan_lab_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import JSON Backup
    importJsonBtn.addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', () => {
      if (backupFileInput.files && backupFileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target.result);
            await Storage.importAllDataJSON(data);
            showToast('バックアップデータを正常に復元しました。再読み込みします...', 'success');
            setTimeout(() => window.location.reload(), 1000);
          } catch (err) {
            alert('復元エラー: ' + err.message);
          }
        };
        reader.readAsText(backupFileInput.files[0]);
      }
    });

    // Reset All Data
    resetBtn.addEventListener('click', async () => {
      if (confirm('警告: すべてのデッキ、履歴、設定を初期化します。よろしいですか？')) {
        await Storage.resetAllData();
        showToast('全データを初期化しました。再読み込みします...', 'info');
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }

  // ==========================================================================
  // Card Zoom Modal
  // ==========================================================================
  function setupCardZoomModal() {
    const modal = document.getElementById('modal-card-zoom');
    const closeBtn = document.getElementById('btn-close-card-zoom');
    const flipBtn = document.getElementById('btn-zoom-flip-face');

    closeBtn.addEventListener('click', () => closeModal('modal-card-zoom'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('modal-card-zoom');
    });

    flipBtn.addEventListener('click', () => {
      if (activeZoomCard && activeZoomCard.faces && activeZoomCard.faces.length > 1) {
        activeZoomFaceIndex = (activeZoomFaceIndex === 0) ? 1 : 0;
        renderZoomFace(activeZoomCard, activeZoomFaceIndex);
      }
    });
  }

  function openCardZoomModal(cardName) {
    const meta = DeckManager.getCardMetadata(cardName);
    activeZoomCard = meta;
    activeZoomFaceIndex = 0;

    const modal = document.getElementById('modal-card-zoom');
    const flipBtn = document.getElementById('btn-zoom-flip-face');

    if (!meta) {
      document.getElementById('zoom-card-name').textContent = cardName;
      document.getElementById('zoom-card-title-en').textContent = cardName;
      const zoomImg = document.getElementById('zoom-card-image');
      zoomImg.src = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}&format=image`;
      zoomImg.onerror = function() { this.src = 'assets/images/card-back.svg'; };
      document.getElementById('zoom-card-mana').textContent = '';
      document.getElementById('zoom-card-type').textContent = '';
      document.getElementById('zoom-card-oracle').textContent = 'カード詳細データをScryfallから取得中またはオフラインです。';
      document.getElementById('zoom-card-tags').innerHTML = '';
      flipBtn.style.display = 'none';
      openModal('modal-card-zoom');
      return;
    }

    flipBtn.style.display = meta.is_dfc ? 'block' : 'none';
    renderZoomFace(meta, 0);

    const tags = DeckManager.getTagsForCard(cardName);
    const tagsContainer = document.getElementById('zoom-card-tags');
    tagsContainer.innerHTML = tags.map(t => `<span class="badge badge-primary">${t}</span>`).join('') || '<span style="color:var(--text-muted); font-size:0.8rem;">設定なし</span>';

    openModal('modal-card-zoom');
  }

  function renderZoomFace(meta, faceIndex) {
    const face = (meta.faces && meta.faces.length > faceIndex) ? meta.faces[faceIndex] : meta;
    const jaName = meta.printed_name || face.printed_name || meta.name;
    const prefLang = Storage.getSettings().cardLanguage || 'ja';

    const directJa = (meta.set && meta.collector_number)
      ? `https://api.scryfall.com/cards/${meta.set.toLowerCase()}/${encodeURIComponent(meta.collector_number)}/ja?format=image`
      : null;
    const directEn = (meta.set && meta.collector_number)
      ? `https://api.scryfall.com/cards/${meta.set.toLowerCase()}/${encodeURIComponent(meta.collector_number)}?format=image`
      : (face.image_uri || meta.image_uri);

    const jaImg = meta.image_uri_ja || directJa;
    const enImg = meta.image_uri_en || directEn || 'assets/images/card-back.svg';
    const primaryImg = prefLang === 'en' ? enImg : (jaImg || enImg);

    document.getElementById('zoom-card-name').textContent = jaName;
    document.getElementById('zoom-card-title-en').textContent = face.name;

    const zoomImgEl = document.getElementById('zoom-card-image');
    zoomImgEl.src = primaryImg;
    zoomImgEl.setAttribute('data-en-fallback', enImg);
    zoomImgEl.onerror = function() {
      const enFallback = this.getAttribute('data-en-fallback');
      if (enFallback && this.src !== enFallback) {
        this.src = enFallback;
      } else if (!this.src.endsWith('card-back.svg')) {
        this.src = 'assets/images/card-back.svg';
      }
    };

    document.getElementById('zoom-card-mana').textContent = face.mana_cost || '';
    document.getElementById('zoom-card-type').textContent = face.type_line || '';
    document.getElementById('zoom-card-oracle').textContent = face.oracle_text || 'テキストなし';

    let statsStr = `セット: ${meta.set} #${meta.collector_number} | レアリティ: ${meta.rarity.toUpperCase()}`;
    if (meta.isLand) {
      statsStr += ` | 供給マナ: ${meta.mana_sources.join(', ')}`;
    }
    document.getElementById('zoom-card-stats').textContent = statsStr;
  }

  return {
    setupNavigation,
    switchTab,
    setupThemeToggle,
    setupLanguageToggle,
    updateHeaderDeckBadge,
    setupDeckManagement,
    renderCurrentDeckView,
    setupTrainingUI,
    renderTrainingView,
    renderAnalysisTab,
    updateTurnProgressionChart,
    setupConditionBuilderAndSimulation,
    renderConditionBuilder,
    setupRolesTab,
    renderRolesTab,
    setupHistoryTab,
    renderHistoryTab,
    setupCompareTab,
    setupSettingsTab,
    setupCardZoomModal,
    openCardZoomModal,
    showToast
  };
})();
