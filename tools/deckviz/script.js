lucide.createIcons();

    // ================= 状態管理 =================
    const state = {
      fileName: '無題のデザイン',
      elements: [],
      selectedId: null,
      isDragging: false,
      isResizing: false,
      isEditingText: false,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { x: 0, y: 0, w: 0, h: 0, aspect: 1, handle: '' },
      canvasScale: 1,
      canvasWidth: 1200,
      canvasHeight: 675,
      bgColor: '#1e293b',
      isMobile: false,
      zIndexCounter: 1,
      isPanelOpen: true
    };

    // ================= DOM要素 =================
    const els = {
      sidebar: document.getElementById('sidebar-container'),
      sheetHandle: document.getElementById('bottom-sheet-handle'),
      sheetTitle: document.getElementById('sheet-title'),
      menuIcon: document.getElementById('menu-icon'),
      tabs: document.querySelectorAll('.tab-btn'),
      panes: document.querySelectorAll('.tab-pane'),
      panelTitle: document.getElementById('panel-title'),
      canvasContainer: document.getElementById('canvas-container'),
      canvasWrapperOuter: document.getElementById('canvas-wrapper-outer'),
      canvasWrapper: document.getElementById('canvas-wrapper'),
      canvas: document.getElementById('canvas'),
      elementsLayer: document.getElementById('elements-layer'),
      guide: document.getElementById('canvas-guide'),
      floatingToolbar: document.getElementById('floating-toolbar'),
      rotateBtn: document.getElementById('floating-rotate-btn'),
      deleteBtn: document.getElementById('floating-delete-btn'),
      searchForm: document.getElementById('search-form'),
      searchInput: document.getElementById('search-input'),
      searchLangJa: document.getElementById('search-lang-ja'),
      searchResults: document.getElementById('search-results'),
      fileNamePC: document.getElementById('file-name-pc'),
      fileNameMobile: document.getElementById('file-name-mobile'),
      saveBtnPC: document.getElementById('save-btn-pc'),
      saveBtnMobile: document.getElementById('save-btn-mobile'),
      toast: document.getElementById('toast'),
      canvasSizePC: document.getElementById('canvas-size-pc'),
      canvasSizeMobile: document.getElementById('canvas-size-mobile'),
      bgColorPC: document.getElementById('bg-color-pc'),
      bgColorMobile: document.getElementById('bg-color-mobile'),
      exportPngBtn: document.getElementById('export-png-btn'),
      exportJpegBtn: document.getElementById('export-jpeg-btn'),
      exportPngBtnMobile: document.getElementById('export-png-btn-mobile'),
      exportJpegBtnMobile: document.getElementById('export-jpeg-btn-mobile'),
      textControls: document.getElementById('text-controls'),
      floatingFontSize: document.getElementById('floating-font-size'),
      floatingFontColor: document.getElementById('floating-font-color'),
      zUpBtn: document.getElementById('floating-zup-btn'),
      zDownBtn: document.getElementById('floating-zdown-btn')
    };

    // ================= ファイル名・保存機能 =================
    function updateFileName(newName) {
      const name = newName.trim() || '無題のデザイン';
      state.fileName = name;
      els.fileNamePC.textContent = name;
      els.fileNameMobile.textContent = name;
      autoSave();
    }

    [els.fileNamePC, els.fileNameMobile].forEach(el => {
      el.addEventListener('blur', (e) => updateFileName(e.target.textContent));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      });
    });

    function showToast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      setTimeout(() => els.toast.classList.remove('show'), 2000);
    }

    function autoSave() {
      const data = { fileName: state.fileName, elements: state.elements, zIndexCounter: state.zIndexCounter, canvasWidth: state.canvasWidth, canvasHeight: state.canvasHeight, bgColor: state.bgColor };
      localStorage.setItem('mtg_canvas_save', JSON.stringify(data));
    }

    function saveManual() {
      autoSave();
      showToast('保存しました');
    }

    els.saveBtnPC.addEventListener('click', saveManual);
    els.saveBtnMobile.addEventListener('click', saveManual);

    const handleCanvasSizeChange = (e) => {
      const [w, h] = e.target.value.split('x').map(Number);
      state.canvasWidth = w;
      state.canvasHeight = h;
      els.canvasSizePC.value = e.target.value;
      els.canvasSizeMobile.value = e.target.value;
      handleResize();
      autoSave();
    };
    els.canvasSizePC.addEventListener('change', handleCanvasSizeChange);
    els.canvasSizeMobile.addEventListener('change', handleCanvasSizeChange);

    const handleBgColorChange = (e) => {
      const color = e.target.value;
      state.bgColor = color;
      els.bgColorPC.value = color;
      els.bgColorMobile.value = color;
      document.documentElement.style.setProperty('--canvas-bg', color);
      autoSave();
    };
    els.bgColorPC.addEventListener('input', handleBgColorChange);
    els.bgColorMobile.addEventListener('input', handleBgColorChange);

    function loadData() {
      const json = localStorage.getItem('mtg_canvas_save');
      if (json) {
        try {
          const data = JSON.parse(json);
          state.fileName = data.fileName || '無題のデザイン';
          state.elements = data.elements || [];
          state.zIndexCounter = data.zIndexCounter || 1;
          state.canvasWidth = data.canvasWidth || 1200;
          state.canvasHeight = data.canvasHeight || 675;
          state.bgColor = data.bgColor || '#1e293b';

          els.fileNamePC.textContent = state.fileName;
          els.fileNameMobile.textContent = state.fileName;
          els.canvasSizePC.value = `${state.canvasWidth}x${state.canvasHeight}`;
          els.canvasSizeMobile.value = `${state.canvasWidth}x${state.canvasHeight}`;
          els.bgColorPC.value = state.bgColor;
          els.bgColorMobile.value = state.bgColor;
          document.documentElement.style.setProperty('--canvas-bg', state.bgColor);

          els.elementsLayer.innerHTML = '';
          state.elements.forEach(renderCanvasElement);
          if (state.elements.length > 0) els.guide.style.display = 'none';

          // 保存されたキャンバスサイズ等に基づいてスケールを再計算
          handleResize();
        } catch(e) { console.error('Load failed', e); }
      }
    }

    // ================= レスポンシブ＆スケール制御 =================
    function handleResize() {
      state.isMobile = window.innerWidth < 768;

      if (state.isMobile) {
        els.floatingToolbar.classList.add('pos-mobile');
        els.floatingToolbar.classList.remove('pos-pc');
        if(!state.isPanelOpen) els.sidebar.classList.add('collapsed');
        else els.sidebar.classList.remove('collapsed');
      } else {
        els.sidebar.classList.remove('collapsed');
        els.floatingToolbar.classList.add('pos-pc');
        els.floatingToolbar.classList.remove('pos-mobile');
      }

      document.querySelectorAll('.action-hint').forEach(el => el.textContent = state.isMobile ? 'タップして追加' : 'ドラッグ＆ドロップで追加');

      const padding = state.isMobile ? 16 : 48;
      const containerW = els.canvasContainer.clientWidth;
      const containerH = state.isMobile ? (window.innerHeight - 56 - 40) : els.canvasContainer.clientHeight;

      const availW = Math.max(containerW - padding * 2, 100);
      const availH = Math.max(containerH - padding * 2, 100);

      const scaleX = availW / state.canvasWidth;
      const scaleY = availH / state.canvasHeight;

      state.canvasScale = Math.min(scaleX, scaleY, 1);

      els.canvasWrapper.style.transform = `scale(${state.canvasScale})`;
      const outerW = state.canvasWidth * state.canvasScale;
      const outerH = state.canvasHeight * state.canvasScale;
      els.canvasWrapperOuter.style.width = `${outerW}px`;
      els.canvasWrapperOuter.style.height = `${outerH}px`;

      els.canvas.style.width = `${state.canvasWidth}px`;
      els.canvas.style.height = `${state.canvasHeight}px`;
    }
    window.addEventListener('resize', handleResize);

    // ================= UI制御 (タブ、ボトムシート) =================
    function toggleMobilePanel() {
      if (!state.isMobile) return;
      state.isPanelOpen = !state.isPanelOpen;
      if (state.isPanelOpen) els.sidebar.classList.remove('collapsed');
      else els.sidebar.classList.add('collapsed');
    }
    els.sheetHandle.addEventListener('click', toggleMobilePanel);

    const tabTitles = { search: 'カード検索', text: 'テキスト', shape: '図形・枠' };
    els.tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        els.tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        els.panes.forEach(pane => pane.classList.add('hidden'));
        document.getElementById(`tab-${target}`).classList.remove('hidden');
        els.panelTitle.textContent = tabTitles[target];
        els.sheetTitle.textContent = tabTitles[target];
        if(state.isMobile && !state.isPanelOpen) toggleMobilePanel();
      });
    });

    // ================= Scryfall API検索 =================
    async function fetchCards(query, langJa) {
      if (!query || query.trim() === '') {
        els.searchResults.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 20px; font-size: 14px;">検索キーワードを入力してください</div>`;
        return;
      }
      els.searchResults.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 20px;">検索中...</div>`;
      try {
        let finalQuery = langJa && !query.includes('lang:') ? `${query} lang:ja` : query;
        let res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(finalQuery)}`);
        let data = await res.json();
        if (data.object === 'error' && langJa) {
           res = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`);
           data = await res.json();
        }
        if (data.object === 'error') els.searchResults.innerHTML = `<div style="color: var(--danger); text-align: center; margin-top: 20px;">見つかりません</div>`;
        else renderSearchResults(data.data || []);
      } catch (err) { els.searchResults.innerHTML = `<div style="color: var(--danger); text-align: center; margin-top: 20px;">通信エラー</div>`; }
    }

    function getCardImageUrl(card) {
      if (card.image_uris && card.image_uris.normal) return card.image_uris.normal;
      if (card.card_faces && card.card_faces[0].image_uris) return card.card_faces[0].image_uris.normal;
      return null;
    }

    function renderSearchResults(cards) {
      els.searchResults.innerHTML = '<div class="card-grid" id="card-grid"></div>';
      const grid = document.getElementById('card-grid');
      cards.forEach(card => {
        const imgUrl = getCardImageUrl(card);
        if (!imgUrl) return;
        const div = document.createElement('div');
        div.className = 'draggable-item card-item';
        div.draggable = true;
        div.dataset.type = 'card'; div.dataset.imageUrl = imgUrl;
        div.innerHTML = `<img src="${imgUrl}" loading="lazy">${state.isMobile ? '<div class="mobile-tap-hint">タップ</div>' : ''}`;
        setupDraggableItem(div);
        grid.appendChild(div);
      });
    }
    els.searchForm.addEventListener('submit', (e) => { e.preventDefault(); fetchCards(els.searchInput.value, els.searchLangJa.checked); });

    // ================= キャンバス要素追加 =================
    function addElementToCanvas(itemData, x = null, y = null) {
      els.guide.style.display = 'none';

      let width = 200, height = 200;
      if (itemData.type === 'card') { width = 250; height = 350; }
      else if (itemData.type === 'text') { width = 300; height = 80; }
      else if (itemData.type === 'shape') {
        if(itemData.shape === 'arrow' || itemData.shape === 'line' || itemData.shape === 'dashed') { width = 200; height = 40; }
        else if(itemData.shape === 'commander') { width = 270; height = 370; }
        else { width = 120; height = 120; }
      }

      const finalX = x !== null ? x : (state.canvasWidth / 2 - width / 2);
      const finalY = y !== null ? y : (state.canvasHeight / 2 - height / 2);

      const id = 'el_' + Date.now();
      state.zIndexCounter++;

      const elData = { id, type: itemData.type, x: finalX, y: finalY, width, height, rotation: 0, zIndex: state.zIndexCounter, ...itemData };
      if (itemData.type === 'text') {
        elData.fontSize = elData.fontSize || 48;
        elData.fontColor = elData.fontColor || '#ffffff';
      }
      state.elements.push(elData);

      renderCanvasElement(elData);
      selectElement(id);
      autoSave();

      if (state.isMobile && state.isPanelOpen) {
        toggleMobilePanel();
      }
    }

    function setupDraggableItem(el) {
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ ...el.dataset }));
        e.dataTransfer.effectAllowed = 'copy';
      });
      el.addEventListener('click', () => {
        addElementToCanvas({ ...el.dataset });
      });
    }
    document.querySelectorAll('.draggable-item').forEach(setupDraggableItem);

    els.canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    els.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      try {
        const itemData = JSON.parse(e.dataTransfer.getData('text/plain'));
        const rect = els.canvas.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / state.canvasScale;
        const dropY = (e.clientY - rect.top) / state.canvasScale;
        let w = 200, h = 200;
        if(itemData.type === 'card') { w = 250; h = 350; }
        else if(itemData.type === 'text') { w = 300; h = 80; }
        else if(itemData.shape === 'arrow' || itemData.shape === 'line' || itemData.shape === 'dashed') { w = 200; h = 40; }
        else if(itemData.shape === 'commander') { w = 270; h = 370; }
        else { w = 120; h = 120; }
        addElementToCanvas(itemData, dropX - w / 2, dropY - h / 2);
      } catch (err) {}
    });

    // ================= キャンバス要素のレンダリング =================
    function renderCanvasElement(elData) {
      const div = document.createElement('div');
      div.id = elData.id;
      div.className = `canvas-element type-${elData.type}`;
      if(elData.type === 'shape') div.style.borderRadius = '0';

      updateElementStyle(div, elData);

      ['nw', 'ne', 'sw', 'se'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.addEventListener('mousedown', (e) => handleResizeStart(e, elData.id, pos));
        handle.addEventListener('touchstart', (e) => handleResizeStart(e, elData.id, pos), {passive:false});
        div.appendChild(handle);
      });

      const content = document.createElement('div');
      content.style.width = '100%'; content.style.height = '100%';

      if (elData.type === 'card') {
        const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(elData.imageUrl)}`;
        content.innerHTML = `<img src="${proxyUrl}" draggable="false" crossorigin="anonymous">`;
      } else if (elData.type === 'text') {
        content.className = 'canvas-text-el';
        const textContent = document.createElement('div');
        textContent.className = 'text-content';
        textContent.innerText = elData.text;
        textContent.spellcheck = false;
        textContent.style.fontSize = `${elData.fontSize || 48}px`;
        textContent.style.color = elData.fontColor || '#ffffff';
        content.appendChild(textContent);

        const startEdit = (e) => {
          e.stopPropagation();
          state.isEditingText = true;
          textContent.contentEditable = "true";
          textContent.focus();
          document.execCommand('selectAll', false, null);
          div.classList.remove('dragging');
        };

        div.addEventListener('dblclick', startEdit);
        let lastTap = 0;
        div.addEventListener('touchend', (e) => {
          const current = new Date().getTime();
          if (current - lastTap < 300 && current - lastTap > 0) {
            startEdit(e);
            e.preventDefault();
          }
          lastTap = current;
        });

        textContent.addEventListener('blur', () => {
          textContent.contentEditable = "false";
          state.isEditingText = false;
          elData.text = textContent.innerText;
          autoSave();
        });
        textContent.addEventListener('keydown', (e) => {
          e.stopPropagation();
          // Enter での確定動作を削除し、デフォルトの改行を許可する
        });

      } else if (elData.type === 'shape') {
         content.className = 'shape-svg';
         if(elData.shape === 'arrow') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M10,50 L80,50 M80,20 L100,50 L80,80" stroke="var(--success)" fill="none" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`;
         } else if(elData.shape === 'rect') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="2" y="2" width="96" height="96" fill="transparent" stroke="var(--success)" stroke-width="4" vector-effect="non-scaling-stroke" rx="8"/></svg>`;
         } else if(elData.shape === 'circle') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="48" fill="transparent" stroke="var(--success)" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`;
         } else if(elData.shape === 'diamond') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,2 98,50 50,98 2,50" fill="rgba(30,41,59,0.8)" stroke="var(--success)" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`;
         } else if(elData.shape === 'commander') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 250 350" preserveAspectRatio="none">
              <rect x="4" y="4" width="242" height="342" fill="rgba(30,41,59,0.3)" stroke="#fbbf24" stroke-width="6" rx="12" stroke-dasharray="10 5" vector-effect="non-scaling-stroke"/>
              <text x="125" y="40" fill="#fbbf24" font-size="24" text-anchor="middle" font-weight="bold" font-family="sans-serif">COMMANDER</text>
            </svg>`;
         } else if(elData.shape === 'line') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke="var(--success)" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>`;
         } else if(elData.shape === 'dashed') {
           content.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke="var(--success)" stroke-width="4" stroke-dasharray="8 4" vector-effect="non-scaling-stroke"/></svg>`;
         }
      }

      div.appendChild(content);

      const handleStart = (e) => {
        if(state.isEditingText) return;
        if(e.target.classList.contains('resize-handle')) return;
        e.stopPropagation();
        if (e.type === 'touchstart') document.body.style.overflow = 'hidden';
        selectElement(elData.id);
        state.isDragging = true;
        div.classList.add('dragging');
        const cx = e.clientX || (e.touches && e.touches[0].clientX);
        const cy = e.clientY || (e.touches && e.touches[0].clientY);
        state.dragOffset = { x: (cx / state.canvasScale) - elData.x, y: (cy / state.canvasScale) - elData.y };
      };

      div.addEventListener('mousedown', handleStart);
      div.addEventListener('touchstart', handleStart, { passive: false });

      els.elementsLayer.appendChild(div);
    }

    function updateElementStyle(domEl, elData) {
      domEl.style.left = `${elData.x}px`;
      domEl.style.top = `${elData.y}px`;
      domEl.style.width = `${elData.width}px`;
      domEl.style.height = `${elData.height}px`;
      domEl.style.zIndex = elData.zIndex;
      domEl.style.transform = `rotate(${elData.rotation}deg)`;
    }

    // ================= 操作 (選択、移動、リサイズ、回転、削除) =================
    function selectElement(id) {
      state.selectedId = id;
      document.querySelectorAll('.canvas-element').forEach(el => el.classList.toggle('selected', el.id === id));
      if (id) {
        els.floatingToolbar.classList.remove('hidden');
        const elData = state.elements.find(el => el.id === id);
        if (elData && elData.type === 'text') {
          els.textControls.classList.remove('hidden');
          els.floatingFontSize.value = elData.fontSize || 48;
          els.floatingFontColor.value = elData.fontColor || '#ffffff';
        } else {
          els.textControls.classList.add('hidden');
        }
      } else {
        els.floatingToolbar.classList.add('hidden');
        els.textControls.classList.add('hidden');
      }
    }

    els.floatingFontSize.addEventListener('input', (e) => {
      if (!state.selectedId) return;
      const elData = state.elements.find(el => el.id === state.selectedId);
      if (elData && elData.type === 'text') {
        elData.fontSize = Number(e.target.value);
        const domEl = document.getElementById(state.selectedId);
        if (domEl) {
          const tc = domEl.querySelector('.text-content');
          if(tc) tc.style.fontSize = `${elData.fontSize}px`;
        }
        autoSave();
      }
    });

    els.floatingFontColor.addEventListener('input', (e) => {
      if (!state.selectedId) return;
      const elData = state.elements.find(el => el.id === state.selectedId);
      if (elData && elData.type === 'text') {
        elData.fontColor = e.target.value;
        const domEl = document.getElementById(state.selectedId);
        if (domEl) {
          const tc = domEl.querySelector('.text-content');
          if(tc) tc.style.color = elData.fontColor;
        }
        autoSave();
      }
    });

    els.rotateBtn.addEventListener('click', () => {
      if(!state.selectedId) return;
      const elData = state.elements.find(el => el.id === state.selectedId);
      if(elData) {
        elData.rotation = (elData.rotation + 90) % 360;
        const domEl = document.getElementById(state.selectedId);
        if(domEl) updateElementStyle(domEl, elData);
        autoSave();
      }
    });

    // Z軸制御（前面へ・背面へ）
    els.zUpBtn.addEventListener('click', () => {
      if(!state.selectedId) return;
      const elData = state.elements.find(el => el.id === state.selectedId);
      if(elData) {
        state.zIndexCounter++;
        elData.zIndex = state.zIndexCounter;
        const domEl = document.getElementById(state.selectedId);
        if(domEl) domEl.style.zIndex = elData.zIndex;
        autoSave();
      }
    });

    els.zDownBtn.addEventListener('click', () => {
      if(!state.selectedId) return;
      const elData = state.elements.find(el => el.id === state.selectedId);
      if(elData) {
        // 最小のzIndexを見つけてその下に入れる
        const minZ = Math.min(...state.elements.map(e => e.zIndex || 1));
        elData.zIndex = Math.max(0, minZ - 1);
        const domEl = document.getElementById(state.selectedId);
        if(domEl) domEl.style.zIndex = elData.zIndex;
        autoSave();
      }
    });

    function deleteElement(id) {
      const idx = state.elements.findIndex(el => el.id === id);
      if (idx > -1) {
        state.elements.splice(idx, 1);
        const domEl = document.getElementById(id);
        if (domEl) domEl.remove();
        if (state.selectedId === id) selectElement(null);
        if (state.elements.length === 0) els.guide.style.display = 'flex';
        autoSave();
      }
    }
    els.deleteBtn.addEventListener('click', () => { if (state.selectedId) deleteElement(state.selectedId); });
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId && !state.isEditingText && e.target.tagName.toLowerCase() !== 'input') {
        deleteElement(state.selectedId);
      }
    });

    const cancelSelection = (e) => {
      if (e.target === els.canvasContainer || e.target === els.canvas || e.target === els.elementsLayer || e.target === els.canvasWrapperOuter) selectElement(null);
    };
    els.canvasContainer.addEventListener('mousedown', cancelSelection);
    els.canvasContainer.addEventListener('touchstart', cancelSelection, {passive: true});

    function handleResizeStart(e, id, handlePos) {
      e.stopPropagation(); e.preventDefault();
      state.isResizing = true;
      selectElement(id);
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      const elData = state.elements.find(el => el.id === id);
      state.resizeStart = { x: cx, y: cy, w: elData.width, h: elData.height, xPos: elData.x, yPos: elData.y, aspect: elData.width / elData.height, handle: handlePos };
    }

    const handleMove = (e) => {
      if (!state.selectedId) return;
      const cx = e.clientX || (e.touches && e.touches[0].clientX);
      const cy = e.clientY || (e.touches && e.touches[0].clientY);
      if (cx === undefined) return;

      const elData = state.elements.find(el => el.id === state.selectedId);
      if (!elData) return;

      if (state.isResizing) {
        if (e.type === 'touchmove') e.preventDefault();

        const dx = (cx - state.resizeStart.x) / state.canvasScale;
        const dy = (cy - state.resizeStart.y) / state.canvasScale;
        const handle = state.resizeStart.handle;

        let newW = state.resizeStart.w;
        let newH = state.resizeStart.h;
        let newX = state.resizeStart.xPos;
        let newY = state.resizeStart.yPos;

        if (elData.type === 'card' || elData.shape === 'commander') {
          let delta = 0;
          if (handle === 'se') delta = Math.max(dx, dy);
          else if (handle === 'nw') delta = Math.min(dx, dy) * -1;
          else if (handle === 'ne') delta = Math.max(dx, -dy);
          else if (handle === 'sw') delta = Math.max(-dx, dy);

          newW = Math.max(50, state.resizeStart.w + delta);
          newH = newW / state.resizeStart.aspect;

          if (handle === 'nw') {
            newX = state.resizeStart.xPos - (newW - state.resizeStart.w);
            newY = state.resizeStart.yPos - (newH - state.resizeStart.h);
          } else if (handle === 'ne') {
            newY = state.resizeStart.yPos - (newH - state.resizeStart.h);
          } else if (handle === 'sw') {
            newX = state.resizeStart.xPos - (newW - state.resizeStart.w);
          }
        } else if (elData.shape === 'arrow' || elData.shape === 'line' || elData.shape === 'dashed') {
          // 線・矢印は幅のみ伸縮、高さ固定
          if (handle.includes('e')) newW = Math.max(20, state.resizeStart.w + dx);
          if (handle.includes('w')) {
            newW = Math.max(20, state.resizeStart.w - dx);
            if (newW > 20) newX = state.resizeStart.xPos + dx;
          }
          newH = state.resizeStart.h; // 高さ固定
        } else {
          if (handle.includes('e')) newW = Math.max(20, state.resizeStart.w + dx);
          if (handle.includes('w')) {
            newW = Math.max(20, state.resizeStart.w - dx);
            if (newW > 20) newX = state.resizeStart.xPos + dx;
          }
          if (handle.includes('s')) newH = Math.max(20, state.resizeStart.h + dy);
          if (handle.includes('n')) {
            newH = Math.max(20, state.resizeStart.h - dy);
            if (newH > 20) newY = state.resizeStart.yPos + dy;
          }
        }

        elData.width = newW;
        elData.height = newH;
        elData.x = newX;
        elData.y = newY;

        const domEl = document.getElementById(state.selectedId);
        if (domEl) updateElementStyle(domEl, elData);

      } else if (state.isDragging) {
        if (e.type === 'touchmove') e.preventDefault();
        elData.x = (cx / state.canvasScale) - state.dragOffset.x;
        elData.y = (cy / state.canvasScale) - state.dragOffset.y;
        const domEl = document.getElementById(state.selectedId);
        if (domEl) updateElementStyle(domEl, elData);
      }
    };

    const handleEnd = () => {
      if (state.isDragging || state.isResizing) {
        state.isDragging = false;
        state.isResizing = false;
        document.body.style.overflow = '';
        if(state.selectedId){
          const domEl = document.getElementById(state.selectedId);
          if (domEl) domEl.classList.remove('dragging');
        }
        autoSave();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    // ================= エクスポート処理 =================
    // 編集画面のDOM描画をそのまま画像化するため、html2canvasを使用。
    // 文字崩れの根本原因であるCSS transform: scale() を一時的に解除してからキャプチャする。

    let html2canvasLoaded = false;
    function loadHtml2Canvas() {
      return new Promise((resolve, reject) => {
        if (html2canvasLoaded) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => { html2canvasLoaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function exportImage(format) {
      if (!els.canvas) return;
      showToast('画像生成中...');
      selectElement(null);

      try {
        await loadHtml2Canvas();
      } catch(e) {
        showToast('ライブラリ読み込み失敗');
        return;
      }

      // ---- エクスポート前の状態を保存 ----
      const savedTransform = els.canvasWrapper.style.transform;
      const savedOuterW = els.canvasWrapperOuter.style.width;
      const savedOuterH = els.canvasWrapperOuter.style.height;
      const savedTransition = els.canvasWrapper.style.transition;
      const savedBoxShadow = els.canvas.style.boxShadow;
      const savedBorder = els.canvas.style.border;
      const savedCanvasTransition = els.canvas.style.transition;

      // ---- 一時的にスケールを1倍に戻し、影・枠線を消す ----
      els.canvasWrapper.style.transition = 'none';
      els.canvas.style.transition = 'none';
      els.canvasWrapper.style.transform = 'scale(1)';
      els.canvasWrapperOuter.style.width = `${state.canvasWidth}px`;
      els.canvasWrapperOuter.style.height = `${state.canvasHeight}px`;
      els.canvas.style.boxShadow = 'none';
      els.canvas.style.border = 'none';

      // 中央配置を解除して左上起点にする（横長キャンバスのオフセット修正）
      const savedAlignItems = els.canvasContainer.style.alignItems;
      const savedJustifyContent = els.canvasContainer.style.justifyContent;
      els.canvasContainer.style.alignItems = 'flex-start';
      els.canvasContainer.style.justifyContent = 'flex-start';

      // スクロール位置を左上にリセット
      els.canvasContainer.scrollTop = 0;
      els.canvasContainer.scrollLeft = 0;

      // DOMの再レイアウトを確実に完了させてからキャプチャ
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      try {
        const canvas = await html2canvas(els.canvas, {
          useCORS: true,
          allowTaint: false,
          backgroundColor: null,
          width: state.canvasWidth,
          height: state.canvasHeight,
          scale: 1,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0
        });

        const link = document.createElement('a');
        link.download = `${state.fileName}.${format}`;
        link.href = canvas.toDataURL(`image/${format === 'jpg' ? 'jpeg' : 'png'}`, 0.92);
        link.click();
        showToast('エクスポートしました');
      } catch (err) {
        console.error('Export error', err);
        showToast('エクスポートに失敗しました');
      } finally {
        // ---- すべてを元に戻す ----
        els.canvasWrapper.style.transform = savedTransform;
        els.canvasWrapperOuter.style.width = savedOuterW;
        els.canvasWrapperOuter.style.height = savedOuterH;
        els.canvas.style.boxShadow = savedBoxShadow;
        els.canvas.style.border = savedBorder;
        els.canvasContainer.style.alignItems = savedAlignItems;
        els.canvasContainer.style.justifyContent = savedJustifyContent;
        requestAnimationFrame(() => {
          els.canvasWrapper.style.transition = savedTransition;
          els.canvas.style.transition = savedCanvasTransition;
        });
      }
    }

    els.exportPngBtn.addEventListener('click', () => exportImage('png'));
    els.exportJpegBtn.addEventListener('click', () => exportImage('jpg'));
    els.exportPngBtnMobile.addEventListener('click', () => exportImage('png'));
    els.exportJpegBtnMobile.addEventListener('click', () => exportImage('jpg'));

    // ================= 初期化 =================
    handleResize();
    loadData();

    // ================= ファンコンテンツ・ポリシー モーダル =================
    const fcModal = document.getElementById('fan-content-modal');
    const fcCloseBtn = document.getElementById('close-modal-btn');
    if (fcModal && fcCloseBtn) {
      if (!localStorage.getItem('deckviz_fc_accepted')) {
        fcModal.classList.remove('hidden');
      } else {
        fcModal.classList.add('hidden');
      }
      fcCloseBtn.addEventListener('click', () => {
        fcModal.classList.add('hidden');
        localStorage.setItem('deckviz_fc_accepted', 'true');
      });
    }