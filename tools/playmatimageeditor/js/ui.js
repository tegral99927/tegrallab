/**
 * PlaymatImageEditor - js/ui.js
 * UI連携、モーダル、プロパティパネル、レイヤーパネル、ドネーションカード、プレビュー
 */

import { mmToPx, pxToMm, calculateEffectiveDpi, ServiceStatus } from './presets.js';
import { TOOL_TYPES } from './tools.js';
import { ImageLayer, deserializeLayer } from './layers.js';

export class UIManager {
  constructor(editor, toolManager, presetManager, storageManager, exportManager, config = {}) {
    this.editor = editor;
    this.tools = toolManager;
    this.presets = presetManager;
    this.storage = storageManager;
    this.exporter = exportManager;
    this.config = {
      boothUrl: config.boothUrl || 'https://booth.pm/', // 開発者が設定可能
      maxDonationShowPerSession: 2,
      ...config
    };

    this.donationShowCount = 0;
    this.initDOMElements();
    this.bindEvents();
    this.updateStatus();
    this.renderLayerList();
  }

  initDOMElements() {
    // ツールボタン群
    this.toolButtons = document.querySelectorAll('[data-tool]');
    
    // パネル
    this.layersListEl = document.getElementById('layers-list');
    this.propertiesPanelEl = document.getElementById('properties-panel');
    this.noSelectionMsgEl = document.getElementById('no-selection-msg');
    this.propsContentEl = document.getElementById('props-content');

    // ステータスバー要素
    this.statusCanvasSizeEl = document.getElementById('status-canvas-size');
    this.statusDpiEl = document.getElementById('status-dpi');
    this.statusZoomEl = document.getElementById('status-zoom');
    this.statusCoordsEl = document.getElementById('status-coords');
    this.statusLayerEl = document.getElementById('status-layer');
    this.statusQualityEl = document.getElementById('status-quality');
    this.statusSaveStateEl = document.getElementById('status-save-state');

    // モーダル群
    this.modalNew = document.getElementById('modal-new');
    this.modalExport = document.getElementById('modal-export');
    this.modalPreview = document.getElementById('modal-preview');
    this.modalHelp = document.getElementById('modal-help');
    this.modalDonation = document.getElementById('modal-donation');
    this.toastContainer = document.getElementById('toast-container');
  }

  bindEvents() {
    // ツール切り替えボタン
    this.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.setActiveToolButton(tool);
        this.tools.setTool(tool);
      });
    });

    // カスタムイベント監視
    window.addEventListener('playmat:layerselected', (e) => {
      this.updatePropertiesPanel(e.detail.layer);
      this.renderLayerList();
      this.updateStatus();
    });

    window.addEventListener('playmat:layerschanged', () => {
      this.renderLayerList();
      this.updateStatus();
      this.storage.markUnsaved();
      this.updateSaveStatus('未保存の変更');
    });

    window.addEventListener('playmat:historychanged', (e) => {
      this.updateUndoRedoButtons(e.detail.canUndo, e.detail.canRedo);
      this.storage.markUnsaved();
      this.updateSaveStatus('未保存の変更');
    });

    window.addEventListener('playmat:autosaved', () => {
      this.updateSaveStatus('自動保存済み');
      this.showToast('自動保存しました', 'info', 2000);
    });

    // キャンバス上のマウス座標追従
    this.editor.viewCanvas.addEventListener('mousemove', (e) => {
      const pos = this.editor.clientToCanvas(e.clientX, e.clientY);
      if (this.statusCoordsEl) {
        this.statusCoordsEl.textContent = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;
      }
    });

    // ズームバー・ボタン
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.editor.setZoom(this.editor.viewport.zoom * 1.2);
      this.updateStatus();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.editor.setZoom(this.editor.viewport.zoom / 1.2);
      this.updateStatus();
    });
    document.getElementById('btn-zoom-fit')?.addEventListener('click', () => {
      this.editor.fitToScreen();
      this.updateStatus();
    });
    document.getElementById('btn-zoom-100')?.addEventListener('click', () => {
      this.editor.setZoom(1.0);
      this.updateStatus();
    });

    // 整列ボタン群
    document.querySelectorAll('[data-align]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editor.alignSelected(btn.dataset.align);
      });
    });

    // ガイド表示切り替え
    document.getElementById('chk-guide-visible')?.addEventListener('change', (e) => {
      this.editor.guides.visible = e.target.checked;
      this.editor.requestRedraw();
    });
    document.getElementById('chk-guide-bleed')?.addEventListener('change', (e) => {
      this.editor.guides.showBleed = e.target.checked;
      this.editor.requestRedraw();
    });
    document.getElementById('chk-guide-finish')?.addEventListener('change', (e) => {
      this.editor.guides.showFinish = e.target.checked;
      this.editor.requestRedraw();
    });
    document.getElementById('chk-guide-safe')?.addEventListener('change', (e) => {
      this.editor.guides.showSafeArea = e.target.checked;
      this.editor.requestRedraw();
    });

    // トップバーのアクションボタン
    document.getElementById('btn-new')?.addEventListener('click', () => this.openNewModal());
    document.getElementById('btn-export')?.addEventListener('click', () => this.openExportModal());
    document.getElementById('btn-preview')?.addEventListener('click', () => this.openPreviewModal());
    document.getElementById('btn-save-project')?.addEventListener('click', () => this.saveProjectFile());
    document.getElementById('btn-open-project')?.addEventListener('click', () => document.getElementById('input-file-project')?.click());
    document.getElementById('input-file-project')?.addEventListener('change', (e) => this.handleProjectFileSelect(e));
    document.getElementById('btn-help')?.addEventListener('click', () => this.openHelpModal());

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', () => this.editor.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.editor.redo());

    // レイヤー追加ボタン
    const triggerImageUpload = () => {
      const input = document.getElementById('input-file-image');
      if (input) {
        input.value = '';
        input.click();
      }
    };
    document.getElementById('btn-add-image')?.addEventListener('click', triggerImageUpload);
    document.getElementById('btn-add-image-tool')?.addEventListener('click', triggerImageUpload);
    document.getElementById('input-file-image')?.addEventListener('change', (e) => this.handleImageFileSelect(e));
    document.getElementById('btn-add-text')?.addEventListener('click', () => {
      this.tools.setTool(TOOL_TYPES.TEXT);
      this.setActiveToolButton(TOOL_TYPES.TEXT);
    });
    document.getElementById('btn-add-paint')?.addEventListener('click', () => {
      this.tools.setTool(TOOL_TYPES.PEN);
      this.setActiveToolButton(TOOL_TYPES.PEN);
    });

    // レイヤー操作ボタン
    document.getElementById('btn-layer-up')?.addEventListener('click', () => {
      if (this.editor.selectedLayerId) this.editor.moveLayerOrder(this.editor.selectedLayerId, 'up');
    });
    document.getElementById('btn-layer-down')?.addEventListener('click', () => {
      if (this.editor.selectedLayerId) this.editor.moveLayerOrder(this.editor.selectedLayerId, 'down');
    });
    document.getElementById('btn-layer-duplicate')?.addEventListener('click', () => {
      if (this.editor.selectedLayerId) this.editor.duplicateLayer(this.editor.selectedLayerId);
    });
    document.getElementById('btn-layer-delete')?.addEventListener('click', () => {
      if (this.editor.selectedLayerId) this.editor.removeLayer(this.editor.selectedLayerId);
    });

    // モーダルの閉じるボタン
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) this.closeAllModals();
      });
    });
  }

  setActiveToolButton(tool) {
    this.toolButtons.forEach(btn => {
      if (btn.dataset.tool === tool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  updateUndoRedoButtons(canUndo, canRedo) {
    const uBtn = document.getElementById('btn-undo');
    const rBtn = document.getElementById('btn-redo');
    if (uBtn) uBtn.disabled = !canUndo;
    if (rBtn) rBtn.disabled = !canRedo;
  }

  updateSaveStatus(text) {
    if (this.statusSaveStateEl) {
      this.statusSaveStateEl.textContent = text;
      this.statusSaveStateEl.className = text.includes('未保存') ? 'status-unsaved' : 'status-saved';
    }
  }

  updateStatus() {
    const cfg = this.editor.canvasConfig;
    if (this.statusCanvasSizeEl) {
      this.statusCanvasSizeEl.textContent = `${cfg.docWidthMm}×${cfg.docHeightMm}mm (${cfg.width}×${cfg.height}px)`;
    }
    if (this.statusDpiEl) {
      this.statusDpiEl.textContent = `${cfg.dpi} DPI`;
    }
    if (this.statusZoomEl) {
      this.statusZoomEl.textContent = `${Math.round(this.editor.viewport.zoom * 100)}%`;
    }
    if (this.statusLayerEl) {
      const selected = this.editor.getSelectedLayer();
      this.statusLayerEl.textContent = selected ? `選択: ${selected.name}` : '未選択';
    }

    // 印刷品質チェック
    this.checkPrintQuality();
  }

  checkPrintQuality() {
    let warning = null;
    const cfg = this.editor.canvasConfig;

    for (const l of this.editor.layers) {
      if (l.type === 'image') {
        const effDpi = l.getEffectiveDpi(cfg.dpi / 350, cfg.docWidthMm);
        if (effDpi < 200) {
          warning = `画像 [${l.name}] の実効DPIが低めです (${effDpi} DPI)`;
          break;
        }
      }
    }

    if (this.statusQualityEl) {
      if (warning) {
        this.statusQualityEl.textContent = `⚠️ ${warning}`;
        this.statusQualityEl.className = 'status-warning';
        this.statusQualityEl.title = '拡大しすぎると印刷時に画像が粗くなる可能性があります';
      } else {
        this.statusQualityEl.textContent = `✓ 印刷解像度OK`;
        this.statusQualityEl.className = 'status-ok';
        this.statusQualityEl.title = '現在のレイヤー配置は印刷推奨品質を満たしています';
      }
    }
  }

  // レイヤーリストの描画
  renderLayerList() {
    if (!this.layersListEl) return;
    this.layersListEl.innerHTML = '';

    // 最前面が上に来るよう逆順で表示
    for (let i = this.editor.layers.length - 1; i >= 0; i--) {
      const layer = this.editor.layers[i];
      const isSelected = layer.id === this.editor.selectedLayerId;

      const item = document.createElement('div');
      item.className = `layer-item ${isSelected ? 'selected' : ''} ${layer.locked ? 'locked' : ''}`;
      item.dataset.layerId = layer.id;

      // アイコン
      const icon = this.getLayerIcon(layer.type);

      item.innerHTML = `
        <button class="layer-btn-vis" title="${layer.visible ? '非表示にする' : '表示する'}">
          ${layer.visible ? '👁️' : '🚫'}
        </button>
        <span class="layer-icon">${icon}</span>
        <span class="layer-name" title="${escapeHtml(layer.name)}">${escapeHtml(layer.name)}</span>
        <button class="layer-btn-lock" title="${layer.locked ? 'ロック解除' : 'ロック'}">
          ${layer.locked ? '🔒' : '🔓'}
        </button>
      `;

      // クリックで選択
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.layer-btn-vis') && !e.target.closest('.layer-btn-lock')) {
          this.editor.selectLayer(layer.id);
        }
      });

      // 表示/非表示トグル
      item.querySelector('.layer-btn-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        layer.visible = !layer.visible;
        this.editor.requestRedraw();
        this.renderLayerList();
      });

      // ロックトグル
      item.querySelector('.layer-btn-lock').addEventListener('click', (e) => {
        e.stopPropagation();
        if (layer.type === 'background') return; // 背景は常時ロック
        layer.locked = !layer.locked;
        this.editor.requestRedraw();
        this.renderLayerList();
      });

      this.layersListEl.appendChild(item);
    }
  }

  getLayerIcon(type) {
    switch (type) {
      case 'image': return '🖼️';
      case 'paint': return '🎨';
      case 'text': return '🔤';
      case 'shape': return '📐';
      case 'background': return '🏁';
      default: return '📄';
    }
  }

  // プロパティパネルの更新
  updatePropertiesPanel(layer) {
    if (!this.propertiesPanelEl) return;

    if (!layer || layer.type === 'background') {
      if (this.noSelectionMsgEl) this.noSelectionMsgEl.style.display = 'block';
      if (this.propsContentEl) this.propsContentEl.style.display = 'none';
      return;
    }

    if (this.noSelectionMsgEl) this.noSelectionMsgEl.style.display = 'none';
    if (this.propsContentEl) this.propsContentEl.style.display = 'block';

    const container = this.propsContentEl;
    container.innerHTML = '';

    // 基本プロパティ (名前, X, Y, W, H, 回転, 不透明度)
    const baseSection = document.createElement('div');
    baseSection.className = 'prop-section';
    baseSection.innerHTML = `
      <div class="prop-title">基本プロパティ</div>
      <div class="prop-row">
        <label>名前</label>
        <input type="text" id="prop-name" value="${escapeHtml(layer.name)}" class="input-text">
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>X (px)</label>
          <input type="number" id="prop-x" value="${Math.round(layer.x)}" class="input-num">
        </div>
        <div class="prop-field">
          <label>Y (px)</label>
          <input type="number" id="prop-y" value="${Math.round(layer.y)}" class="input-num">
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>幅 (px)</label>
          <input type="number" id="prop-w" value="${Math.round(layer.width)}" class="input-num" min="1">
        </div>
        <div class="prop-field">
          <label>高さ (px)</label>
          <input type="number" id="prop-h" value="${Math.round(layer.height)}" class="input-num" min="1">
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>回転 (度)</label>
          <input type="number" id="prop-rot" value="${Math.round(layer.rotation)}" class="input-num" min="0" max="360">
        </div>
        <div class="prop-field">
          <label>不透明度 (%)</label>
          <input type="number" id="prop-opacity" value="${Math.round(layer.opacity * 100)}" class="input-num" min="0" max="100">
        </div>
      </div>
    `;
    container.appendChild(baseSection);

    // バインド
    baseSection.querySelector('#prop-name').addEventListener('input', (e) => {
      layer.name = e.target.value;
      this.renderLayerList();
    });
    baseSection.querySelector('#prop-x').addEventListener('change', (e) => {
      layer.x = Number(e.target.value);
      this.editor.requestRedraw();
    });
    baseSection.querySelector('#prop-y').addEventListener('change', (e) => {
      layer.y = Number(e.target.value);
      this.editor.requestRedraw();
    });
    baseSection.querySelector('#prop-w').addEventListener('change', (e) => {
      layer.width = Math.max(1, Number(e.target.value));
      this.editor.requestRedraw();
    });
    baseSection.querySelector('#prop-h').addEventListener('change', (e) => {
      layer.height = Math.max(1, Number(e.target.value));
      this.editor.requestRedraw();
    });
    baseSection.querySelector('#prop-rot').addEventListener('change', (e) => {
      layer.rotation = (Number(e.target.value) + 360) % 360;
      this.editor.requestRedraw();
    });
    baseSection.querySelector('#prop-opacity').addEventListener('input', (e) => {
      layer.opacity = Math.max(0, Math.min(1, Number(e.target.value) / 100));
      this.editor.requestRedraw();
    });

    // レイヤータイプ別セクション
    if (layer.type === 'image') {
      this.renderImageProps(container, layer);
    } else if (layer.type === 'text') {
      this.renderTextProps(container, layer);
    } else if (layer.type === 'shape') {
      this.renderShapeProps(container, layer);
    }
  }

  // 画像プロパティ
  renderImageProps(container, layer) {
    const cfg = this.editor.canvasConfig;
    const effDpi = layer.getEffectiveDpi(cfg.dpi / 350, cfg.docWidthMm);
    const isLowDpi = effDpi < 200;

    const imgSection = document.createElement('div');
    imgSection.className = 'prop-section';
    imgSection.innerHTML = `
      <div class="prop-title">画像・印刷品質</div>
      <div class="prop-dpi-box ${isLowDpi ? 'warning' : 'ok'}">
        <div class="dpi-val">実効解像度: <strong>${effDpi} DPI</strong></div>
        <div class="dpi-desc">${isLowDpi ? '⚠️ 解像度が低めです。拡大しすぎると粗くなる恐れがあります。' : '✓ 印刷に十分な高画質です'}</div>
        <div class="orig-size">元サイズ: ${layer.origWidth} × ${layer.origHeight} px</div>
      </div>
      <div class="prop-row-buttons">
        <button id="btn-flip-h" class="btn-sub ${layer.flipX ? 'active' : ''}">左右反転</button>
        <button id="btn-flip-v" class="btn-sub ${layer.flipY ? 'active' : ''}">上下反転</button>
      </div>
      <div class="prop-row">
        <label>明るさ (${layer.brightness}%)</label>
        <input type="range" id="prop-bright" min="0" max="200" value="${layer.brightness}">
      </div>
      <div class="prop-row">
        <label>コントラスト (${layer.contrast}%)</label>
        <input type="range" id="prop-contrast" min="0" max="200" value="${layer.contrast}">
      </div>
      <div class="prop-row">
        <label>彩度 (${layer.saturation}%)</label>
        <input type="range" id="prop-sat" min="0" max="200" value="${layer.saturation}">
      </div>
    `;
    container.appendChild(imgSection);

    imgSection.querySelector('#btn-flip-h').addEventListener('click', (e) => {
      layer.flipX = !layer.flipX;
      e.target.classList.toggle('active', layer.flipX);
      this.editor.requestRedraw();
      this.editor.recordHistory('左右反転');
    });
    imgSection.querySelector('#btn-flip-v').addEventListener('click', (e) => {
      layer.flipY = !layer.flipY;
      e.target.classList.toggle('active', layer.flipY);
      this.editor.requestRedraw();
      this.editor.recordHistory('上下反転');
    });
    imgSection.querySelector('#prop-bright').addEventListener('input', (e) => {
      layer.brightness = Number(e.target.value);
      this.editor.requestRedraw();
    });
    imgSection.querySelector('#prop-contrast').addEventListener('input', (e) => {
      layer.contrast = Number(e.target.value);
      this.editor.requestRedraw();
    });
    imgSection.querySelector('#prop-sat').addEventListener('input', (e) => {
      layer.saturation = Number(e.target.value);
      this.editor.requestRedraw();
    });
  }

  // テキストプロパティ
  renderTextProps(container, layer) {
    const textSection = document.createElement('div');
    textSection.className = 'prop-section';
    textSection.innerHTML = `
      <div class="prop-title">テキスト編集</div>
      <div class="prop-row">
        <label>テキスト内容</label>
        <textarea id="prop-text-content" rows="3" class="input-textarea">${escapeHtml(layer.text)}</textarea>
      </div>
      <div class="prop-row">
        <label>フォント</label>
        <select id="prop-font-family" class="input-select">
          <option value="sans-serif">標準ゴシック (sans-serif)</option>
          <option value="'Hiragino Sans', 'Meiryo', sans-serif">ヒラギノ / メイリオ</option>
          <option value="'Yu Gothic', sans-serif">游ゴシック</option>
          <option value="serif">明朝体 (serif)</option>
          <option value="'Shippori Mincho', serif">しっぽり明朝</option>
          <option value="monospace">等幅 (monospace)</option>
          <option value="Impact, fantasy">Impact (太字英語)</option>
        </select>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>文字サイズ</label>
          <input type="number" id="prop-font-size" value="${Math.round(layer.fontSize)}" class="input-num" min="8" max="500">
        </div>
        <div class="prop-field">
          <label>文字色</label>
          <input type="color" id="prop-text-color" value="${layer.color}">
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>太字 / 斜体</label>
          <div class="btn-group-sm">
            <button id="btn-text-bold" class="btn-sub ${layer.bold ? 'active' : ''}"><b>B</b></button>
            <button id="btn-text-italic" class="btn-sub ${layer.italic ? 'active' : ''}"><i>I</i></button>
          </div>
        </div>
        <div class="prop-field">
          <label>揃え</label>
          <select id="prop-text-align" class="input-select">
            <option value="left" ${layer.align === 'left' ? 'selected' : ''}>左揃え</option>
            <option value="center" ${layer.align === 'center' ? 'selected' : ''}>中央揃え</option>
            <option value="right" ${layer.align === 'right' ? 'selected' : ''}>右揃え</option>
          </select>
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>縁取り幅</label>
          <input type="number" id="prop-stroke-w" value="${layer.strokeWidth}" class="input-num" min="0" max="50">
        </div>
        <div class="prop-field">
          <label>縁取り色</label>
          <input type="color" id="prop-stroke-c" value="${layer.strokeColor}">
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>影のぼかし</label>
          <input type="number" id="prop-shadow-b" value="${layer.shadowBlur}" class="input-num" min="0" max="50">
        </div>
        <div class="prop-field">
          <label>影の色</label>
          <input type="color" id="prop-shadow-c" value="${layer.shadowColor.startsWith('#') ? layer.shadowColor : '#000000'}">
        </div>
      </div>
    `;
    container.appendChild(textSection);

    const txtInput = textSection.querySelector('#prop-text-content');
    txtInput.addEventListener('input', (e) => {
      layer.text = e.target.value;
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-font-family').value = layer.fontFamily;
    textSection.querySelector('#prop-font-family').addEventListener('change', (e) => {
      layer.fontFamily = e.target.value;
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-font-size').addEventListener('change', (e) => {
      layer.fontSize = Math.max(8, Number(e.target.value));
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-text-color').addEventListener('input', (e) => {
      layer.color = e.target.value;
      this.editor.requestRedraw();
    });
    textSection.querySelector('#btn-text-bold').addEventListener('click', (e) => {
      layer.bold = !layer.bold;
      e.target.classList.toggle('active', layer.bold);
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#btn-text-italic').addEventListener('click', (e) => {
      layer.italic = !layer.italic;
      e.target.classList.toggle('active', layer.italic);
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-text-align').addEventListener('change', (e) => {
      layer.align = e.target.value;
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-stroke-w').addEventListener('change', (e) => {
      layer.strokeWidth = Math.max(0, Number(e.target.value));
      layer.updateMetrics();
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-stroke-c').addEventListener('input', (e) => {
      layer.strokeColor = e.target.value;
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-shadow-b').addEventListener('change', (e) => {
      layer.shadowBlur = Math.max(0, Number(e.target.value));
      this.editor.requestRedraw();
    });
    textSection.querySelector('#prop-shadow-c').addEventListener('input', (e) => {
      layer.shadowColor = e.target.value;
      this.editor.requestRedraw();
    });
  }

  // 図形プロパティ
  renderShapeProps(container, layer) {
    const shapeSection = document.createElement('div');
    shapeSection.className = 'prop-section';
    shapeSection.innerHTML = `
      <div class="prop-title">図形設定</div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>塗りつぶし色</label>
          <input type="color" id="prop-shape-fill" value="${layer.fillColor.startsWith('#') ? layer.fillColor : '#38bdf8'}">
        </div>
        <div class="prop-field">
          <label>枠線の色</label>
          <input type="color" id="prop-shape-stroke" value="${layer.strokeColor.startsWith('#') ? layer.strokeColor : '#38bdf8'}">
        </div>
      </div>
      <div class="prop-grid-2">
        <div class="prop-field">
          <label>線の太さ</label>
          <input type="number" id="prop-shape-sw" value="${layer.strokeWidth}" class="input-num" min="0" max="40">
        </div>
        <div class="prop-field">
          <label>角丸の半径</label>
          <input type="number" id="prop-shape-r" value="${layer.borderRadius || 0}" class="input-num" min="0" max="100">
        </div>
      </div>
      ${layer.shapeType === 'tcg_zone' ? `
        <div class="prop-row">
          <label>ゾーン名ラベル</label>
          <input type="text" id="prop-shape-label" value="${escapeHtml(layer.label || '')}" class="input-text">
        </div>
      ` : ''}
    `;
    container.appendChild(shapeSection);

    shapeSection.querySelector('#prop-shape-fill').addEventListener('input', (e) => {
      layer.fillColor = e.target.value;
      this.editor.requestRedraw();
    });
    shapeSection.querySelector('#prop-shape-stroke').addEventListener('input', (e) => {
      layer.strokeColor = e.target.value;
      this.editor.requestRedraw();
    });
    shapeSection.querySelector('#prop-shape-sw').addEventListener('change', (e) => {
      layer.strokeWidth = Math.max(0, Number(e.target.value));
      this.editor.requestRedraw();
    });
    shapeSection.querySelector('#prop-shape-r').addEventListener('change', (e) => {
      layer.borderRadius = Math.max(0, Number(e.target.value));
      this.editor.requestRedraw();
    });
    const labelInput = shapeSection.querySelector('#prop-shape-label');
    if (labelInput) {
      labelInput.addEventListener('input', (e) => {
        layer.label = e.target.value;
        this.editor.requestRedraw();
      });
    }
  }

  // --- モーダル制御 ---
  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }

  openNewModal() {
    this.closeAllModals();
    if (!this.modalNew) return;
    this.modalNew.classList.add('active');

    // プリセット一覧を描画
    const selectEl = document.getElementById('new-preset-select');
    if (selectEl) {
      selectEl.innerHTML = '';
      this.presets.getAll().forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const statusBadge = p.status === ServiceStatus.VERIFIED ? '【公式確認済】' : 
                            p.status === ServiceStatus.VERIFIED_TEMPLATE_REQ ? '【公式確認・要テンプレ】' : '【未確認】';
        opt.textContent = `${statusBadge} ${p.serviceName} - ${p.presetName} (${p.finishWidthMm}×${p.finishHeightMm}mm)`;
        selectEl.appendChild(opt);
      });

      selectEl.value = this.editor.canvasConfig.presetId || this.presets.getAll()[0].id;
      this.updateNewModalFields(selectEl.value);
      selectEl.onchange = () => this.updateNewModalFields(selectEl.value);
    }

    // 作成実行ボタン
    const submitBtn = document.getElementById('btn-create-canvas');
    if (submitBtn) {
      submitBtn.onclick = () => {
        this.createNewCanvasFromModal();
        this.closeAllModals();
      };
    }
  }

  updateNewModalFields(presetId) {
    const preset = this.presets.getById(presetId);
    if (!preset) return;

    document.getElementById('new-doc-w-mm').value = preset.docWidthMm;
    document.getElementById('new-doc-h-mm').value = preset.docHeightMm;
    document.getElementById('new-bleed-mm').value = preset.bleedMm;
    document.getElementById('new-safe-mm').value = preset.safeAreaMm;
    document.getElementById('new-dpi').value = preset.recommendedDpi;
    
    // px計算
    const wPx = preset.pixelWidth || mmToPx(preset.docWidthMm, preset.recommendedDpi);
    const hPx = preset.pixelHeight || mmToPx(preset.docHeightMm, preset.recommendedDpi);
    document.getElementById('new-calc-px').textContent = `${wPx} × ${hPx} px`;

    // 注意書き
    const noticeEl = document.getElementById('new-preset-notice');
    if (noticeEl) {
      let statusHtml = '';
      if (preset.status === ServiceStatus.VERIFIED) {
        statusHtml = `<span class="badge-verified">✓ 公式仕様確認済み</span>`;
      } else if (preset.status === ServiceStatus.VERIFIED_TEMPLATE_REQ) {
        statusHtml = `<span class="badge-template">⚠️ 専用テンプレート必須</span>`;
      } else {
        statusHtml = `<span class="badge-unverified">ℹ️ 仕様未確認（手動入力推奨）</span>`;
      }
      noticeEl.innerHTML = `
        <div class="notice-header">${statusHtml} <strong>${escapeHtml(preset.serviceName)}</strong></div>
        <p class="notice-body">${escapeHtml(preset.notes)}</p>
        ${preset.colorNotice ? `<p class="notice-color">🎨 ${escapeHtml(preset.colorNotice)}</p>` : ''}
        ${preset.referenceUrl ? `<p><a href="${escapeHtml(preset.referenceUrl)}" target="_blank" rel="noopener">公式仕様ページを確認 ↗</a></p>` : ''}
      `;
    }
  }

  createNewCanvasFromModal() {
    const docWMm = Number(document.getElementById('new-doc-w-mm').value);
    const docHMm = Number(document.getElementById('new-doc-h-mm').value);
    const bleedMm = Number(document.getElementById('new-bleed-mm').value);
    const safeMm = Number(document.getElementById('new-safe-mm').value);
    const dpi = Number(document.getElementById('new-dpi').value);
    const bgColor = document.getElementById('new-bg-color').value;
    const isTrans = document.getElementById('new-bg-trans').checked;
    const presetId = document.getElementById('new-preset-select').value;

    const width = mmToPx(docWMm, dpi);
    const height = mmToPx(docHMm, dpi);
    const finishWMm = Math.max(1, docWMm - bleedMm * 2);
    const finishHMm = Math.max(1, docHMm - bleedMm * 2);

    this.editor.updateCanvasConfig({
      presetId,
      docWidthMm: docWMm,
      docHeightMm: docHMm,
      finishWidthMm: finishWMm,
      finishHeightMm: finishHMm,
      bleedMm,
      safeAreaMm: safeMm,
      dpi,
      width,
      height,
      backgroundColor: bgColor,
      transparentBg: isTrans
    });

    this.editor.initDefaultProject();
    this.updateStatus();
    this.showToast('新規キャンバスを作成しました', 'success');
  }

  openExportModal() {
    this.closeAllModals();
    if (!this.modalExport) return;
    this.modalExport.classList.add('active');

    const cfg = this.editor.canvasConfig;
    document.getElementById('export-orig-info').textContent = 
      `${cfg.docWidthMm}×${cfg.docHeightMm}mm / ${cfg.width}×${cfg.height}px (${cfg.dpi} DPI)`;

    const updateEstimate = () => {
      const format = document.querySelector('input[name="export-format"]:checked')?.value || 'png';
      const scale = Number(document.querySelector('input[name="export-scale"]:checked')?.value || 1.0);
      const quality = Number(document.getElementById('export-quality-slider')?.value || 95) / 100;
      
      const outW = Math.round(cfg.width * scale);
      const outH = Math.round(cfg.height * scale);
      const outDpi = Math.round(cfg.dpi * scale);
      const estimatedBytes = this.exporter.estimateFileSize(outW, outH, format, quality);

      document.getElementById('export-res-preview').textContent = `${outW} × ${outH} px (${outDpi} DPI)`;
      document.getElementById('export-size-estimate').textContent = `約 ${this.exporter.formatBytes(estimatedBytes)}`;
    };

    document.querySelectorAll('input[name="export-format"], input[name="export-scale"]').forEach(el => {
      el.onchange = updateEstimate;
    });
    document.getElementById('export-quality-slider').oninput = (e) => {
      document.getElementById('export-quality-val').textContent = e.target.value + '%';
      updateEstimate();
    };

    updateEstimate();

    // 書き出し開始ボタン
    document.getElementById('btn-start-export').onclick = async () => {
      await this.runExportProcess();
    };
  }

  async runExportProcess() {
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'png';
    const scale = Number(document.querySelector('input[name="export-scale"]:checked')?.value || 1.0);
    const quality = Number(document.getElementById('export-quality-slider')?.value || 95) / 100;
    const filename = document.getElementById('export-filename')?.value || 'playmat_artwork';

    const progBox = document.getElementById('export-progress-box');
    const progBar = document.getElementById('export-progress-bar');
    const progMsg = document.getElementById('export-progress-msg');
    const submitBtn = document.getElementById('btn-start-export');

    progBox.style.display = 'block';
    submitBtn.disabled = true;

    try {
      const result = await this.exporter.exportImage({
        format,
        quality,
        scale,
        filename,
        onProgress: (pct, msg) => {
          progBar.style.width = pct + '%';
          progMsg.textContent = msg;
        }
      });

      this.showToast(`ダウンロードを開始しました (${this.exporter.formatBytes(result.size)})`, 'success');
      this.closeAllModals();

      // ドネーションカードの表示チェック
      this.triggerDonationCard();
    } catch (err) {
      progMsg.textContent = 'エラー: ' + err.message;
      this.showToast(err.message, 'error', 5000);
    } finally {
      submitBtn.disabled = false;
      progBox.style.display = 'none';
    }
  }

  triggerDonationCard() {
    // セッション内の頻度制御 (上限回数未満かつBOOTH URLが存在する場合)
    if (!this.config.boothUrl || this.donationShowCount >= this.config.maxDonationShowPerSession) {
      return;
    }
    this.donationShowCount++;
    setTimeout(() => {
      this.openDonationModal();
    }, 1200); // 保存直後の少し落ち着いたタイミングで表示
  }

  openDonationModal() {
    this.closeAllModals();
    if (!this.modalDonation) return;

    const linkBtn = document.getElementById('btn-booth-donate');
    if (linkBtn && this.config.boothUrl) {
      linkBtn.href = this.config.boothUrl;
      linkBtn.style.display = 'inline-block';
    } else if (linkBtn) {
      linkBtn.style.display = 'none';
    }

    this.modalDonation.classList.add('active');
  }

  openPreviewModal() {
    this.closeAllModals();
    if (!this.modalPreview) return;
    this.modalPreview.classList.add('active');

    // プレビューCanvasの描画
    const previewCanvas = document.getElementById('preview-mockup-canvas');
    if (!previewCanvas) return;

    const pw = 800;
    const ph = 460;
    previewCanvas.width = pw;
    previewCanvas.height = ph;
    const pctx = previewCanvas.getContext('2d');

    pctx.clearRect(0, 0, pw, ph);

    // 背景デスク風グラデーション
    const bgGrad = pctx.createRadialGradient(pw / 2, ph / 2, 50, pw / 2, ph / 2, pw / 2);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
    pctx.fillStyle = bgGrad;
    pctx.fillRect(0, 0, pw, ph);

    // プレイマット角丸ラバーマット描画
    const matW = 700;
    const matH = Math.round(matW * (this.editor.canvasConfig.finishHeightMm / this.editor.canvasConfig.finishWidthMm));
    const matX = (pw - matW) / 2;
    const matY = (ph - matH) / 2;
    const radius = 24;

    pctx.save();
    // プレイマットの立体的な影
    pctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    pctx.shadowBlur = 25;
    pctx.shadowOffsetY = 12;

    pctx.beginPath();
    pctx.roundRect(matX, matY, matW, matH, radius);
    pctx.fillStyle = '#0f172a';
    pctx.fill();
    pctx.restore();

    // プレイマットクリッピング描画 (仕上がり領域のみ表示)
    pctx.save();
    pctx.beginPath();
    pctx.roundRect(matX, matY, matW, matH, radius);
    pctx.clip();

    // オフスクリーンCanvasで現在絵を描画
    const off = document.createElement('canvas');
    off.width = this.editor.canvasConfig.width;
    off.height = this.editor.canvasConfig.height;
    const octx = off.getContext('2d');
    if (!this.editor.canvasConfig.transparentBg) {
      octx.fillStyle = this.editor.canvasConfig.backgroundColor;
      octx.fillRect(0, 0, off.width, off.height);
    }
    for (const l of this.editor.layers) {
      if (l.visible && l.type !== 'background') l.render(octx, 1, true);
    }

    // 塗り足し分を除いた仕上がり領域を matX, matY にフィットして描画
    const bleedPx = mmToPx(this.editor.canvasConfig.bleedMm, this.editor.canvasConfig.dpi);
    const finW = off.width - bleedPx * 2;
    const finH = off.height - bleedPx * 2;
    pctx.drawImage(off, bleedPx, bleedPx, finW, finH, matX, matY, matW, matH);

    // プレイマットのステッチ（縫い目）風エッジハイライト
    pctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    pctx.lineWidth = 1.5;
    pctx.setLineDash([4, 3]);
    pctx.stroke();

    pctx.restore();

    // セーフエリア外の文字チェック
    this.checkPreviewSafeArea();
  }

  checkPreviewSafeArea() {
    const listEl = document.getElementById('preview-warning-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const cfg = this.editor.canvasConfig;
    const bleedPx = mmToPx(cfg.bleedMm, cfg.dpi);
    const safePx = mmToPx(cfg.safeAreaMm, cfg.dpi);

    const safeMinX = bleedPx + safePx;
    const safeMinY = bleedPx + safePx;
    const safeMaxX = cfg.width - (bleedPx + safePx);
    const safeMaxY = cfg.height - (bleedPx + safePx);

    let hasIssue = false;
    for (const l of this.editor.layers) {
      if (l.type === 'text' && l.visible) {
        if (l.x < safeMinX || l.y < safeMinY || (l.x + l.width) > safeMaxX || (l.y + l.height) > safeMaxY) {
          const item = document.createElement('div');
          item.className = 'warn-item';
          item.textContent = `⚠️ テキスト [${l.name}] がセーフエリア（安全印刷領域）からはみ出しています。断裁で切れる可能性があります。`;
          listEl.appendChild(item);
          hasIssue = true;
        }
      }
    }

    if (!hasIssue) {
      const okItem = document.createElement('div');
      okItem.className = 'ok-item';
      okItem.textContent = '✓ 重要テキストはすべてセーフエリア内に収まっています。';
      listEl.appendChild(okItem);
    }
  }

  openHelpModal() {
    this.closeAllModals();
    if (!this.modalHelp) return;
    this.modalHelp.classList.add('active');
  }

  // プロジェクト保存 / 読み込み
  saveProjectFile() {
    const projectData = {
      version: 1,
      appName: 'PlaymatImageEditor',
      canvas: this.editor.canvasConfig,
      layers: this.editor.layers.map(l => l.serialize()),
      createdAt: Date.now()
    };
    this.storage.exportProjectFile(projectData, 'my_playmat.playmat.json');
    this.showToast('.playmat.json ファイルを保存しました', 'success');
  }

  async handleProjectFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await this.storage.importProjectFile(file);
      this.editor.updateCanvasConfig(data.canvas);
      this.editor.layers = data.layers.map(l => deserializeLayer(l));
      this.editor.selectedLayerId = null;
      this.editor.fitToScreen();
      this.editor.recordHistory('プロジェクト読込');
      this.renderLayerList();
      this.updateStatus();
      this.showToast('プロジェクトを復元しました', 'success');
    } catch (err) {
      this.showToast(err.message, 'error', 4000);
    } finally {
      e.target.value = '';
    }
  }

  // 画像ファイル読み込み
  handleImageFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach(file => this.loadImageFile(file));
    e.target.value = '';
  }

  loadImageFile(file) {
    if (!file) return;

    // MIMEタイプまたは拡張子による柔軟な画像形式判定
    const isImageMime = file.type && file.type.toLowerCase().startsWith('image/');
    const isImageExt = /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name || '');
    if (!isImageMime && !isImageExt) {
      this.showToast('対応画像形式はPNG, JPEG, WebP等の画像ファイルです。', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const img = new Image();
      img.onload = () => {
        // キャンバスサイズに合わせて初期配置（最大幅80%に収める）
        const cw = this.editor.canvasConfig.width;
        const ch = this.editor.canvasConfig.height;

        let w = img.naturalWidth || 800;
        let h = img.naturalHeight || 600;
        const maxW = cw * 0.8;
        const maxH = ch * 0.8;

        if (w > maxW || h > maxH) {
          const s = Math.min(maxW / w, maxH / h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }

        const x = Math.round((cw - w) / 2);
        const y = Math.round((ch - h) / 2);

        const imgLayer = new ImageLayer({
          image: img,
          src: dataUrl,
          name: (file.name || '画像').replace(/\.[^/.]+$/, ''),
          x,
          y,
          width: w,
          height: h,
          origWidth: img.naturalWidth || w,
          origHeight: img.naturalHeight || h
        });

        this.editor.addLayer(imgLayer);
        this.editor.recordHistory(`画像 [${imgLayer.name}] を追加`);
        this.renderLayerList();
        this.editor.requestRedraw();
        this.showToast(`画像 [${imgLayer.name}] を読み込みました`, 'info');
      };
      img.onerror = () => {
        this.showToast('画像のデコードに失敗しました（破損しているか未対応の形式です）。', 'error');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      this.showToast('画像ファイルの読み取り中にエラーが発生しました。', 'error');
    };
    reader.readAsDataURL(file);
  }

  // トースト通知
  showToast(message, type = 'info', duration = 3000) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

