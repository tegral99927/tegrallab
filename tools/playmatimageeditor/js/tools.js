/**
 * PlaymatImageEditor - js/tools.js
 * 編集ツール（選択・変形・ペン・消しゴム・図形・テキスト・スポイト・TCGゾーン配置）
 */

import { ShapeLayer, PaintLayer, TextLayer, ImageLayer } from './layers.js';

export const TOOL_TYPES = {
  SELECT: 'select',
  HAND: 'hand',
  PEN: 'pen',
  ERASER: 'eraser',
  TEXT: 'text',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  LINE: 'line',
  EYEDROPPER: 'eyedropper',
  BUCKET: 'bucket',
  TCG_ZONE: 'tcg_zone'
};

export class ToolManager {
  constructor(editor) {
    this.editor = editor;
    this.activeTool = TOOL_TYPES.SELECT;
    
    // ツールパラメータ
    this.brushSize = 10;
    this.brushOpacity = 1.0;
    this.brushColor = '#38bdf8';
    this.brushHardness = 1.0; // 0.0 - 1.0
    
    // 図形パラメータ
    this.shapeFillColor = 'rgba(56, 189, 248, 0.15)';
    this.shapeStrokeColor = '#38bdf8';
    this.shapeStrokeWidth = 3;
    this.shapeBorderRadius = 12;

    // TCGパラメータ
    this.tcgCardFormat = 'standard'; // 'standard' (63x88mm) or 'mini' (59x86mm)
    this.tcgZoneLabel = 'DECK';

    // 内部ドラッグ・操作状態
    this.isMouseDown = false;
    this.startPos = { x: 0, y: 0 };
    this.lastPos = { x: 0, y: 0 };
    this.activeHandle = null; // 'nw', 'se', 'rot', etc.
    this.dragStartLayerProps = null;
    this.tempShapeLayer = null;
    this.strokePoints = [];
  }

  setTool(tool) {
    this.activeTool = tool;
    this.editor.render();
  }

  // マウス/タッチ開始
  onPointerDown(e, canvasPos, clientPos) {
    this.isMouseDown = true;
    this.startPos = { ...canvasPos };
    this.lastPos = { ...canvasPos };

    if (this.activeTool === TOOL_TYPES.HAND || e.spaceKey) {
      this.dragStartViewport = { x: this.editor.viewport.panX, y: this.editor.viewport.panY };
      this.clientStartPos = { ...clientPos };
      return;
    }

    if (this.activeTool === TOOL_TYPES.SELECT) {
      // 1. 変形ハンドルの当たり判定
      const selected = this.editor.getSelectedLayer();
      if (selected) {
        const handle = this.hitTestHandles(selected, canvasPos.x, canvasPos.y);
        if (handle) {
          this.activeHandle = handle;
          this.dragStartLayerProps = {
            x: selected.x,
            y: selected.y,
            width: selected.width,
            height: selected.height,
            rotation: selected.rotation,
            centerX: selected.centerX,
            centerY: selected.centerY
          };
          return;
        }
      }

      // 2. レイヤーの当たり判定 (最前面から走査)
      const clickedLayer = this.editor.getLayerAt(canvasPos.x, canvasPos.y);
      if (clickedLayer && clickedLayer.type !== 'background') {
        this.editor.selectLayer(clickedLayer.id);
        this.activeHandle = 'move';
        this.dragStartLayerProps = {
          x: clickedLayer.x,
          y: clickedLayer.y,
          centerX: clickedLayer.centerX,
          centerY: clickedLayer.centerY
        };
      } else {
        // 何もない場所をクリック -> 選択解除
        this.editor.deselectAll();
      }
      this.editor.render();
      return;
    }

    if (this.activeTool === TOOL_TYPES.PEN || this.activeTool === TOOL_TYPES.ERASER) {
      let paintLayer = this.editor.getSelectedLayer();
      if (!paintLayer || paintLayer.type !== 'paint' || paintLayer.locked) {
        // ペイントレイヤーが選択されていなければ、新規ペイントレイヤーを作成
        paintLayer = new PaintLayer({
          x: 0,
          y: 0,
          width: this.editor.canvasConfig.width,
          height: this.editor.canvasConfig.height,
          name: this.activeTool === TOOL_TYPES.ERASER ? 'ペイント' : '手描きレイヤー'
        });
        this.editor.addLayer(paintLayer);
      }
      this.strokePoints = [{ ...canvasPos }];
      this.drawBrushPoint(paintLayer, canvasPos.x, canvasPos.y, true);
      this.editor.render();
      return;
    }

    if (this.activeTool === TOOL_TYPES.EYEDROPPER) {
      this.pickColorAt(canvasPos.x, canvasPos.y);
      return;
    }

    if (this.activeTool === TOOL_TYPES.RECT || this.activeTool === TOOL_TYPES.ELLIPSE || this.activeTool === TOOL_TYPES.LINE) {
      // 図形ドラッグ開始
      this.tempShapeLayer = new ShapeLayer({
        x: canvasPos.x,
        y: canvasPos.y,
        width: 1,
        height: 1,
        shapeType: this.activeTool,
        fillColor: this.shapeFillColor,
        strokeColor: this.shapeStrokeColor,
        strokeWidth: this.shapeStrokeWidth,
        borderRadius: this.shapeBorderRadius,
        name: this.getShapeDefaultName(this.activeTool)
      });
      return;
    }

    if (this.activeTool === TOOL_TYPES.TCG_ZONE) {
      // カードゾーンの配置 (クリック位置を中心にカード比率で配置)
      this.addTcgCardZone(canvasPos.x, canvasPos.y);
      return;
    }

    if (this.activeTool === TOOL_TYPES.TEXT) {
      // テキストレイヤー配置
      const newText = new TextLayer({
        x: canvasPos.x,
        y: canvasPos.y,
        text: 'ここをクリックして編集',
        color: this.brushColor,
        fontSize: Math.round(this.editor.canvasConfig.height * 0.05) // キャンバス高さの5%目安
      });
      this.editor.addLayer(newText);
      this.setTool(TOOL_TYPES.SELECT);
      this.editor.selectLayer(newText.id);
      this.editor.recordHistory('テキスト追加');
      return;
    }

    if (this.activeTool === TOOL_TYPES.BUCKET) {
      const selected = this.editor.getSelectedLayer();
      if (selected && selected.type === 'paint') {
        // ペイントレイヤー全塗り
        selected.ctx.fillStyle = this.brushColor;
        selected.ctx.fillRect(0, 0, selected.canvas.width, selected.canvas.height);
        this.editor.render();
        this.editor.recordHistory('塗りつぶし');
      } else {
        // 背景色の変更
        this.editor.canvasConfig.backgroundColor = this.brushColor;
        this.editor.canvasConfig.transparentBg = false;
        const bgLayer = this.editor.layers.find(l => l.type === 'background');
        if (bgLayer) {
          bgLayer.color = this.brushColor;
          bgLayer.transparent = false;
        }
        this.editor.render();
        this.editor.recordHistory('背景色変更');
      }
      return;
    }
  }

  // マウス/タッチ移動
  onPointerMove(e, canvasPos, clientPos) {
    if (!this.isMouseDown) return;

    if (this.activeTool === TOOL_TYPES.HAND || e.spaceKey) {
      const dx = clientPos.x - this.clientStartPos.x;
      const dy = clientPos.y - this.clientStartPos.y;
      this.editor.viewport.panX = this.dragStartViewport.x + dx;
      this.editor.viewport.panY = this.dragStartViewport.y + dy;
      this.editor.render();
      return;
    }

    if (this.activeTool === TOOL_TYPES.SELECT) {
      const selected = this.editor.getSelectedLayer();
      if (!selected || !this.activeHandle) return;

      const dx = canvasPos.x - this.startPos.x;
      const dy = canvasPos.y - this.startPos.y;

      if (this.activeHandle === 'move') {
        selected.x = this.dragStartLayerProps.x + dx;
        selected.y = this.dragStartLayerProps.y + dy;
        
        // スナップ補助線処理
        this.editor.checkSnapping(selected);
      } else if (this.activeHandle === 'rot') {
        // 回転操作
        const angleRad = Math.atan2(canvasPos.y - this.dragStartLayerProps.centerY, canvasPos.x - this.dragStartLayerProps.centerX);
        let deg = (angleRad * 180 / Math.PI) + 90;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15; // 15度刻み
        selected.rotation = (deg + 360) % 360;
      } else {
        // ハンドル拡大縮小
        this.applyResize(selected, this.activeHandle, canvasPos, e.shiftKey);
      }

      this.editor.render();
      return;
    }

    if (this.activeTool === TOOL_TYPES.PEN || this.activeTool === TOOL_TYPES.ERASER) {
      const paintLayer = this.editor.getSelectedLayer();
      if (paintLayer && paintLayer.type === 'paint') {
        this.strokePoints.push({ ...canvasPos });
        this.drawBrushStroke(paintLayer, this.lastPos, canvasPos);
        this.editor.render();
      }
      this.lastPos = { ...canvasPos };
      return;
    }

    if (this.tempShapeLayer) {
      let w = canvasPos.x - this.startPos.x;
      let h = canvasPos.y - this.startPos.y;

      if (e.shiftKey) {
        // 正方形・真円
        const maxSide = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * maxSide;
        h = Math.sign(h) * maxSide;
      }

      this.tempShapeLayer.x = w >= 0 ? this.startPos.x : this.startPos.x + w;
      this.tempShapeLayer.y = h >= 0 ? this.startPos.y : this.startPos.y + h;
      this.tempShapeLayer.width = Math.max(2, Math.abs(w));
      this.tempShapeLayer.height = Math.max(2, Math.abs(h));
      this.editor.render();
      return;
    }
  }

  // マウス/タッチ終了
  onPointerUp(e) {
    if (!this.isMouseDown) return;
    this.isMouseDown = false;

    if (this.activeTool === TOOL_TYPES.SELECT && this.activeHandle) {
      this.activeHandle = null;
      this.editor.clearSnapGuides();
      this.editor.recordHistory('オブジェクト変形');
    }

    if ((this.activeTool === TOOL_TYPES.PEN || this.activeTool === TOOL_TYPES.ERASER) && this.strokePoints.length > 0) {
      this.strokePoints = [];
      this.editor.recordHistory(this.activeTool === TOOL_TYPES.PEN ? 'ペン描画' : '消しゴム');
    }

    if (this.tempShapeLayer) {
      if (this.tempShapeLayer.width > 5 || this.tempShapeLayer.height > 5) {
        this.editor.addLayer(this.tempShapeLayer);
        this.editor.selectLayer(this.tempShapeLayer.id);
        this.editor.recordHistory('図形追加');
      }
      this.tempShapeLayer = null;
      this.setTool(TOOL_TYPES.SELECT);
    }
  }

  // スポイト機能
  pickColorAt(canvasX, canvasY) {
    const color = this.editor.samplePixelColor(canvasX, canvasY);
    if (color) {
      this.brushColor = color;
      this.shapeStrokeColor = color;
      window.dispatchEvent(new CustomEvent('playmat:colorpicked', { detail: { color } }));
      this.setTool(TOOL_TYPES.SELECT);
    }
  }

  // TCGゾーン追加
  addTcgCardZone(centerX, centerY) {
    // スタンダード: 63mm x 88mm, ミニ: 59mm x 86mm
    const isStandard = this.tcgCardFormat === 'standard';
    const cardWMm = isStandard ? 63 : 59;
    const cardHMm = isStandard ? 88 : 86;
    const dpi = this.editor.canvasConfig.dpi;

    const wPx = Math.round((cardWMm / 25.4) * dpi);
    const hPx = Math.round((cardHMm / 25.4) * dpi);

    const zone = new ShapeLayer({
      x: centerX - wPx / 2,
      y: centerY - hPx / 2,
      width: wPx,
      height: hPx,
      shapeType: 'tcg_zone',
      fillColor: 'rgba(56, 189, 248, 0.12)',
      strokeColor: '#38bdf8',
      strokeWidth: Math.max(2, Math.round(dpi / 100)),
      borderRadius: Math.round(dpi / 35),
      strokeDash: [Math.round(dpi / 40), Math.round(dpi / 50)],
      label: this.tcgZoneLabel,
      name: `TCG枠 (${this.tcgZoneLabel})`
    });

    this.editor.addLayer(zone);
    this.editor.selectLayer(zone.id);
    this.editor.recordHistory('TCGゾーン枠追加');
    this.setTool(TOOL_TYPES.SELECT);
  }

  // ブラシ点描画
  drawBrushPoint(layer, x, y, isStart = false) {
    const ctx = layer.ctx;
    ctx.save();
    if (this.activeTool === TOOL_TYPES.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = this.brushColor;
      ctx.globalAlpha = this.brushOpacity;
    }
    
    // スケール考慮 (ペイントレイヤー内部座標系)
    const localX = x - layer.x;
    const localY = y - layer.y;
    
    ctx.beginPath();
    ctx.arc(localX, localY, this.brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ブラシ線描画 (補間)
  drawBrushStroke(layer, from, to) {
    const ctx = layer.ctx;
    ctx.save();
    if (this.activeTool === TOOL_TYPES.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.brushColor;
      ctx.globalAlpha = this.brushOpacity;
    }

    ctx.lineWidth = this.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lx1 = from.x - layer.x;
    const ly1 = from.y - layer.y;
    const lx2 = to.x - layer.x;
    const ly2 = to.y - layer.y;

    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
    ctx.restore();
  }

  // リサイズハンドルの当たり判定
  hitTestHandles(layer, px, py) {
    const handles = this.getHandlePositions(layer);
    const hitRadius = 10 / this.editor.viewport.zoom; // 画面上10px相当

    for (const [name, pos] of Object.entries(handles)) {
      const dist = Math.hypot(px - pos.x, py - pos.y);
      if (dist <= hitRadius) return name;
    }
    return null;
  }

  // ハンドル位置の計算
  getHandlePositions(layer) {
    const cx = layer.centerX;
    const cy = layer.centerY;
    const hw = layer.width / 2;
    const hh = layer.height / 2;
    const rad = layer.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotPoint = (lx, ly) => ({
      x: cx + (cos * lx - sin * ly),
      y: cy + (sin * lx + cos * ly)
    });

    const rotOffset = 26 / this.editor.viewport.zoom;

    return {
      nw: rotPoint(-hw, -hh),
      n: rotPoint(0, -hh),
      ne: rotPoint(hw, -hh),
      e: rotPoint(hw, 0),
      se: rotPoint(hw, hh),
      s: rotPoint(0, hh),
      sw: rotPoint(-hw, hh),
      w: rotPoint(-hw, 0),
      rot: rotPoint(0, -hh - rotOffset)
    };
  }

  applyResize(layer, handle, canvasPos, lockAspect) {
    const start = this.dragStartLayerProps;
    const origW = start.width;
    const origH = start.height;
    
    // 中心からの相対ベクトルを逆回転
    const rad = -start.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = canvasPos.x - start.centerX;
    const dy = canvasPos.y - start.centerY;
    const localX = cos * dx - sin * dy;
    const localY = sin * dx + cos * dy;

    let newW = origW;
    let newH = origH;

    if (handle.includes('e')) newW = Math.max(10, localX * 2);
    if (handle.includes('w')) newW = Math.max(10, -localX * 2);
    if (handle.includes('s')) newH = Math.max(10, localY * 2);
    if (handle.includes('n')) newH = Math.max(10, -localY * 2);

    if (lockAspect || layer.type === 'image') {
      const aspect = origW / origH;
      if (Math.abs(newW - origW) > Math.abs(newH - origH)) {
        newH = newW / aspect;
      } else {
        newW = newH * aspect;
      }
    }

    layer.width = Math.round(newW);
    layer.height = Math.round(newH);
    layer.x = Math.round(start.centerX - layer.width / 2);
    layer.y = Math.round(start.centerY - layer.height / 2);

    if (layer.type === 'text') {
      layer.updateMetrics();
    }
  }

  getShapeDefaultName(type) {
    switch (type) {
      case 'rect': return '長方形';
      case 'ellipse': return '円・楕円';
      case 'line': return '直線';
      default: return '図形';
    }
  }
}

