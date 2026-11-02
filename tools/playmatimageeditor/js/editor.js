/**
 * PlaymatImageEditor - js/editor.js
 * メインエディタエンジン、ビューポート、印刷ガイド、Undo/Redo、描画パイプライン
 */

import { BackgroundLayer, ImageLayer, PaintLayer, TextLayer, ShapeLayer, deserializeLayer } from './layers.js';
import { mmToPx } from './presets.js';

export class Editor {
  constructor(canvasElement, containerElement) {
    this.viewCanvas = canvasElement;
    this.ctx = this.viewCanvas.getContext('2d');
    this.container = containerElement;

    // キャンバス設定 (論理原稿サイズ)
    this.canvasConfig = {
      presetId: 'orangekoubou_standard',
      docWidthMm: 630,
      docHeightMm: 380,
      finishWidthMm: 600,
      finishHeightMm: 350,
      bleedMm: 15,
      safeAreaMm: 5,
      dpi: 350,
      width: 8681,   // docWidthMm @ dpi
      height: 5236,  // docHeightMm @ dpi
      backgroundColor: '#1e293b',
      transparentBg: false
    };

    // ガイド表示設定
    this.guides = {
      visible: true,
      showBleed: true,
      showFinish: true,
      showSafeArea: true,
      showGrid: false,
      gridSize: 50,
      snapToGuides: true
    };

    // ビューポート (表示倍率・移動量)
    this.viewport = {
      zoom: 1.0,
      panX: 0,
      panY: 0
    };

    // レイヤー一覧 (インデックス0が最背面、最後尾が最前面)
    this.layers = [];
    this.selectedLayerId = null;

    // スナップ補助線
    this.activeSnapGuides = []; // [{type: 'v'|'h', pos: number}]

    // Undo / Redo スタック (最低50履歴)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 60;
    this.isHistoryLocked = false;

    // アニメーションフレーム管理
    this.needsRedraw = true;
    this.rafId = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('playmat:imageready', () => this.requestRedraw());
    }

    this.initDefaultProject();
    this.startRenderLoop();
  }

  initDefaultProject() {
    this.layers = [];
    // 背景レイヤー
    const bg = new BackgroundLayer({
      width: this.canvasConfig.width,
      height: this.canvasConfig.height,
      color: this.canvasConfig.backgroundColor,
      transparent: this.canvasConfig.transparentBg
    });
    this.layers.push(bg);
    this.selectedLayerId = null;
    this.history = [];
    this.historyIndex = -1;
    this.recordHistory('新規作成');
    this.fitToScreen();
  }

  // キャンバス設定の変更（プリセット変更時等）
  updateCanvasConfig(newConfig) {
    this.canvasConfig = { ...this.canvasConfig, ...newConfig };
    
    // 背景レイヤーのサイズ更新
    const bg = this.layers.find(l => l.type === 'background');
    if (bg) {
      bg.width = this.canvasConfig.width;
      bg.height = this.canvasConfig.height;
      bg.color = this.canvasConfig.backgroundColor;
      bg.transparent = this.canvasConfig.transparentBg;
    }

    this.fitToScreen();
    this.recordHistory('キャンバス設定変更');
    this.requestRedraw();
  }

  // 画面に合わせる
  fitToScreen() {
    if (!this.container) return;
    const cw = this.container.clientWidth;
    const ch = this.container.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    // 余白を考慮
    const padding = 60;
    const availW = cw - padding * 2;
    const availH = ch - padding * 2;

    const scaleX = availW / this.canvasConfig.width;
    const scaleY = availH / this.canvasConfig.height;
    const zoom = Math.min(scaleX, scaleY, 1.5); // 最大1.5倍

    this.viewport.zoom = Math.max(0.02, zoom);
    // 中央に配置
    this.viewport.panX = Math.round((cw - this.canvasConfig.width * this.viewport.zoom) / 2);
    this.viewport.panY = Math.round((ch - this.canvasConfig.height * this.viewport.zoom) / 2);
    this.requestRedraw();
  }

  setZoom(zoom, centerClientX = null, centerClientY = null) {
    const prevZoom = this.viewport.zoom;
    const newZoom = Math.max(0.01, Math.min(5.0, zoom));
    if (prevZoom === newZoom) return;

    if (centerClientX !== null && centerClientY !== null && this.container) {
      const rect = this.container.getBoundingClientRect();
      const cx = centerClientX - rect.left;
      const cy = centerClientY - rect.top;

      // ズーム中心を保つパン補正
      this.viewport.panX = cx - ((cx - this.viewport.panX) / prevZoom) * newZoom;
      this.viewport.panY = cy - ((cy - this.viewport.panY) / prevZoom) * newZoom;
    } else if (this.container) {
      const cx = this.container.clientWidth / 2;
      const cy = this.container.clientHeight / 2;
      this.viewport.panX = cx - ((cx - this.viewport.panX) / prevZoom) * newZoom;
      this.viewport.panY = cy - ((cy - this.viewport.panY) / prevZoom) * newZoom;
    }

    this.viewport.zoom = newZoom;
    this.requestRedraw();
  }

  // スクリーン座標 -> キャンバス論理座標の変換
  clientToCanvas(clientX, clientY) {
    const rect = this.viewCanvas.getBoundingClientRect();
    const viewX = clientX - rect.left;
    const viewY = clientY - rect.top;

    const canvasX = (viewX - this.viewport.panX) / this.viewport.zoom;
    const canvasY = (viewY - this.viewport.panY) / this.viewport.zoom;
    return { x: canvasX, y: canvasY };
  }

  // キャンバス論理座標 -> スクリーン座標
  canvasToClient(canvasX, canvasY) {
    return {
      x: canvasX * this.viewport.zoom + this.viewport.panX,
      y: canvasY * this.viewport.zoom + this.viewport.panY
    };
  }

  // レイヤー取得・選択操作
  getSelectedLayer() {
    if (!this.selectedLayerId) return null;
    return this.layers.find(l => l.id === this.selectedLayerId) || null;
  }

  getLayerAt(canvasX, canvasY) {
    // 最前面から逆順に走査
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const l = this.layers[i];
      if (l.type === 'background') continue;
      if (l.containsPoint(canvasX, canvasY)) {
        return l;
      }
    }
    return null;
  }

  selectLayer(id) {
    this.selectedLayerId = id;
    this.requestRedraw();
    window.dispatchEvent(new CustomEvent('playmat:layerselected', { detail: { layer: this.getSelectedLayer() } }));
  }

  deselectAll() {
    this.selectedLayerId = null;
    this.requestRedraw();
    window.dispatchEvent(new CustomEvent('playmat:layerselected', { detail: { layer: null } }));
  }

  addLayer(layer) {
    this.layers.push(layer);
    this.selectLayer(layer.id);
    this.requestRedraw();
    window.dispatchEvent(new CustomEvent('playmat:layerschanged'));
  }

  removeLayer(id) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index !== -1 && this.layers[index].type !== 'background') {
      const removed = this.layers.splice(index, 1)[0];
      if (this.selectedLayerId === id) {
        this.selectedLayerId = this.layers[this.layers.length - 1]?.id || null;
      }
      this.recordHistory(`レイヤー [${removed.name}] を削除`);
      this.requestRedraw();
      window.dispatchEvent(new CustomEvent('playmat:layerschanged'));
      window.dispatchEvent(new CustomEvent('playmat:layerselected', { detail: { layer: this.getSelectedLayer() } }));
      return true;
    }
    return false;
  }

  duplicateLayer(id) {
    const orig = this.layers.find(l => l.id === id);
    if (!orig || orig.type === 'background') return null;

    const serialized = orig.serialize();
    serialized.id = undefined;
    serialized.name = orig.name + ' (コピー)';
    serialized.x += 30;
    serialized.y += 30;

    const cloned = deserializeLayer(serialized, orig.image);
    const index = this.layers.indexOf(orig);
    this.layers.splice(index + 1, 0, cloned);
    this.selectLayer(cloned.id);
    this.recordHistory(`レイヤー [${orig.name}] を複製`);
    this.requestRedraw();
    window.dispatchEvent(new CustomEvent('playmat:layerschanged'));
    return cloned;
  }

  moveLayerOrder(id, direction) {
    // direction: 'up' | 'down' | 'top' | 'bottom'
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1 || this.layers[index].type === 'background') return;

    const layer = this.layers[index];
    const minIndex = 1; // 0は常に背景
    const maxIndex = this.layers.length - 1;

    let targetIndex = index;
    if (direction === 'up') targetIndex = Math.min(maxIndex, index + 1);
    else if (direction === 'down') targetIndex = Math.max(minIndex, index - 1);
    else if (direction === 'top') targetIndex = maxIndex;
    else if (direction === 'bottom') targetIndex = minIndex;

    if (targetIndex !== index) {
      this.layers.splice(index, 1);
      this.layers.splice(targetIndex, 0, layer);
      this.recordHistory(`レイヤー順序変更`);
      this.requestRedraw();
      window.dispatchEvent(new CustomEvent('playmat:layerschanged'));
    }
  }

  // 整列機能
  alignSelected(alignment) {
    const layer = this.getSelectedLayer();
    if (!layer || layer.type === 'background' || layer.locked) return;

    const cw = this.canvasConfig.width;
    const ch = this.canvasConfig.height;

    switch (alignment) {
      case 'left':
        layer.x = 0;
        break;
      case 'center-h':
        layer.x = Math.round((cw - layer.width) / 2);
        break;
      case 'right':
        layer.x = cw - layer.width;
        break;
      case 'top':
        layer.y = 0;
        break;
      case 'center-v':
        layer.y = Math.round((ch - layer.height) / 2);
        break;
      case 'bottom':
        layer.y = ch - layer.height;
        break;
      case 'fit': {
        // キャンバス全体にフィット (アスペクト比維持で収める)
        const scale = Math.min(cw / layer.width, ch / layer.height);
        layer.width = Math.round(layer.width * scale);
        layer.height = Math.round(layer.height * scale);
        layer.x = Math.round((cw - layer.width) / 2);
        layer.y = Math.round((ch - layer.height) / 2);
        break;
      }
      case 'cover': {
        // キャンバス全体を覆う
        const scale = Math.max(cw / layer.width, ch / layer.height);
        layer.width = Math.round(layer.width * scale);
        layer.height = Math.round(layer.height * scale);
        layer.x = Math.round((cw - layer.width) / 2);
        layer.y = Math.round((ch - layer.height) / 2);
        break;
      }
    }
    this.recordHistory(`整列 (${alignment})`);
    this.requestRedraw();
  }

  // スナップ判定と補助線生成
  checkSnapping(layer) {
    this.activeSnapGuides = [];
    if (!this.guides.snapToGuides) return;

    const threshold = 15 / this.viewport.zoom; // 許容距離
    const cw = this.canvasConfig.width;
    const ch = this.canvasConfig.height;

    // キャンバス中央
    const midX = cw / 2;
    const midY = ch / 2;

    if (Math.abs(layer.centerX - midX) < threshold) {
      layer.x = midX - layer.width / 2;
      this.activeSnapGuides.push({ type: 'v', pos: midX });
    }
    if (Math.abs(layer.centerY - midY) < threshold) {
      layer.y = midY - layer.height / 2;
      this.activeSnapGuides.push({ type: 'h', pos: midY });
    }
  }

  clearSnapGuides() {
    this.activeSnapGuides = [];
  }

  // スポイト用ピクセルサンプリング
  samplePixelColor(canvasX, canvasY) {
    if (canvasX < 0 || canvasX >= this.canvasConfig.width || canvasY < 0 || canvasY >= this.canvasConfig.height) {
      return null;
    }
    // オフスクリーンCanvasで現在位置を描画して取得
    const off = document.createElement('canvas');
    off.width = 1;
    off.height = 1;
    const offCtx = off.getContext('2d');
    offCtx.translate(-canvasX, -canvasY);

    for (const l of this.layers) {
      if (l.visible) l.render(offCtx, 1, false);
    }
    const pixel = offCtx.getImageData(0, 0, 1, 1).data;
    return `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${(pixel[3] / 255).toFixed(2)})`;
  }

  // Undo / Redo
  recordHistory(actionName = '操作') {
    if (this.isHistoryLocked) return;

    // 現在より先の履歴を破棄
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const snapshot = {
      actionName,
      canvasConfig: { ...this.canvasConfig },
      layers: this.layers.map(l => l.serialize()),
      selectedLayerId: this.selectedLayerId
    };

    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    window.dispatchEvent(new CustomEvent('playmat:historychanged', {
      detail: {
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        action: actionName
      }
    }));
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  undo() {
    if (!this.canUndo()) return;
    this.historyIndex--;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  redo() {
    if (!this.canRedo()) return;
    this.historyIndex++;
    this.restoreSnapshot(this.history[this.historyIndex]);
  }

  restoreSnapshot(snapshot) {
    this.isHistoryLocked = true;
    try {
      this.canvasConfig = { ...snapshot.canvasConfig };
      this.layers = snapshot.layers.map(data => deserializeLayer(data));
      this.selectedLayerId = snapshot.selectedLayerId;
      this.requestRedraw();
      window.dispatchEvent(new CustomEvent('playmat:layerschanged'));
      window.dispatchEvent(new CustomEvent('playmat:layerselected', { detail: { layer: this.getSelectedLayer() } }));
      window.dispatchEvent(new CustomEvent('playmat:historychanged', {
        detail: {
          canUndo: this.canUndo(),
          canRedo: this.canRedo(),
          action: snapshot.actionName
        }
      }));
    } finally {
      this.isHistoryLocked = false;
    }
  }

  // 描画ループ
  requestRedraw() {
    this.needsRedraw = true;
  }

  startRenderLoop() {
    const loop = () => {
      if (this.needsRedraw) {
        this.render();
        this.needsRedraw = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  render() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (this.viewCanvas.width !== width || this.viewCanvas.height !== height) {
      this.viewCanvas.width = width;
      this.viewCanvas.height = height;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // 背景ワークスペース色
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // ビューポートトランスフォーム適用
    ctx.translate(this.viewport.panX, this.viewport.panY);
    ctx.scale(this.viewport.zoom, this.viewport.zoom);

    // キャンバス外側の影
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 30 / this.viewport.zoom;
    ctx.shadowOffsetY = 15 / this.viewport.zoom;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvasConfig.width, this.canvasConfig.height);
    ctx.restore();

    // 1. 各レイヤーを描画
    for (const layer of this.layers) {
      if (layer.visible) {
        layer.render(ctx, 1, false);
      }
    }

    // 2. 印刷ガイドの描画 (画面上のみ)
    if (this.guides.visible) {
      this.renderPrintGuides(ctx);
    }

    // 3. スナップ補助線
    this.renderSnapGuides(ctx);

    // 4. 選択中オブジェクトのバウンディングボックスとハンドル
    const selected = this.getSelectedLayer();
    if (selected && selected.type !== 'background') {
      this.renderSelectionHandles(ctx, selected);
    }

    ctx.restore();
  }

  // 印刷ガイドラインの描画
  renderPrintGuides(ctx) {
    const dpi = this.canvasConfig.dpi;
    const bleedPx = mmToPx(this.canvasConfig.bleedMm, dpi);
    const safePx = mmToPx(this.canvasConfig.safeAreaMm, dpi);

    const docW = this.canvasConfig.width;
    const docH = this.canvasConfig.height;

    const finishX = bleedPx;
    const finishY = bleedPx;
    const finishW = Math.max(1, docW - bleedPx * 2);
    const finishH = Math.max(1, docH - bleedPx * 2);

    const safeX = finishX + safePx;
    const safeY = finishY + safePx;
    const safeW = Math.max(1, finishW - safePx * 2);
    const safeH = Math.max(1, finishH - safePx * 2);

    const lineWidth = Math.max(1.5, 2 / this.viewport.zoom);

    ctx.save();

    // A. 塗り足し領域の警告ストライプ（外周 bleed 領域）
    if (this.guides.showBleed && bleedPx > 0) {
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([8 / this.viewport.zoom, 6 / this.viewport.zoom]);
      ctx.strokeRect(0, 0, docW, docH);

      // 塗り足し枠外表示
      ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
      ctx.beginPath();
      ctx.rect(0, 0, docW, docH);
      ctx.rect(finishX, finishY, finishW, finishH);
      ctx.fill('evenodd');
    }

    // B. 仕上がり線（断裁カットライン：水色/青）
    if (this.guides.showFinish) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = lineWidth * 1.5;
      ctx.setLineDash([]);
      ctx.strokeRect(finishX, finishY, finishW, finishH);
    }

    // C. セーフエリア線（文字・重要絵柄の推奨内側枠：シアン破線）
    if (this.guides.showSafeArea) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([6 / this.viewport.zoom, 6 / this.viewport.zoom]);
      ctx.strokeRect(safeX, safeY, safeW, safeH);
    }

    ctx.restore();
  }

  // スナップガイド描画
  renderSnapGuides(ctx) {
    if (!this.activeSnapGuides.length) return;
    ctx.save();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5 / this.viewport.zoom;
    ctx.setLineDash([4 / this.viewport.zoom, 4 / this.viewport.zoom]);

    for (const g of this.activeSnapGuides) {
      ctx.beginPath();
      if (g.type === 'v') {
        ctx.moveTo(g.pos, -500);
        ctx.lineTo(g.pos, this.canvasConfig.height + 500);
      } else {
        ctx.moveTo(-500, g.pos);
        ctx.lineTo(this.canvasConfig.width + 500, g.pos);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 選択枠・変形ハンドルの描画
  renderSelectionHandles(ctx, layer) {
    ctx.save();
    ctx.translate(layer.centerX, layer.centerY);
    if (layer.rotation !== 0) {
      ctx.rotate(layer.rotation * (Math.PI / 180));
    }

    const hw = layer.width / 2;
    const hh = layer.height / 2;
    const handleRadius = 6 / this.viewport.zoom;
    const rotOffset = 26 / this.viewport.zoom;

    // バウンディングボックス外枠
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2 / this.viewport.zoom;
    ctx.setLineDash([]);
    ctx.strokeRect(-hw, -hh, layer.width, layer.height);

    // 回転ノブへの接続線
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, -hh - rotOffset);
    ctx.strokeStyle = '#6366f1';
    ctx.stroke();

    // ハンドル群
    const handleCoords = [
      { x: -hw, y: -hh }, { x: 0, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: 0 },    { x: hw, y: hh },  { x: 0, y: hh },
      { x: -hw, y: hh },  { x: -hw, y: 0 },
      { x: 0, y: -hh - rotOffset, isRot: true } // 回転ノブ
    ];

    for (const h of handleCoords) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = h.isRot ? '#a855f7' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2 / this.viewport.zoom;
      ctx.stroke();
    }

    ctx.restore();
  }
}

