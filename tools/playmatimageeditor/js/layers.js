/**
 * PlaymatImageEditor - js/layers.js
 * レイヤーモデルおよび描画オブジェクト管理モジュール
 */

import { calculateEffectiveDpi } from './presets.js';

let nextLayerId = 1;
export function generateLayerId() {
  return 'layer_' + Date.now() + '_' + (nextLayerId++);
}

/**
 * 基本レイヤークラス
 */
export class BaseLayer {
  constructor(options = {}) {
    this.id = options.id || generateLayerId();
    this.name = options.name || 'レイヤー';
    this.type = options.type || 'base';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 100;
    this.height = options.height || 100;
    this.rotation = options.rotation || 0; // 度数法 0-360
    this.opacity = options.opacity !== undefined ? options.opacity : 1.0;
    this.visible = options.visible !== undefined ? options.visible : true;
    this.locked = options.locked !== undefined ? options.locked : false;
  }

  // 中心座標
  get centerX() {
    return this.x + this.width / 2;
  }

  get centerY() {
    return this.y + this.height / 2;
  }

  // 点がこのレイヤーのバウンディングボックス内にあるか判定（回転考慮）
  containsPoint(px, py) {
    if (!this.visible || this.locked) return false;
    
    // 中心を原点にして逆回転
    const rad = -this.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    
    const localX = cos * dx - sin * dy;
    const localY = sin * dx + cos * dy;
    
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    
    return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
  }

  // 描画基底メソッド
  render(ctx, scale = 1, isExport = false) {
    if (!this.visible) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.opacity));
    
    // アフィン変換
    ctx.translate(this.centerX * scale, this.centerY * scale);
    if (this.rotation !== 0) {
      ctx.rotate(this.rotation * (Math.PI / 180));
    }
    
    this.renderContent(ctx, scale, isExport);
    ctx.restore();
  }

  renderContent(ctx, scale, isExport) {
    // 派生クラスでオーバーライド
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
      opacity: this.opacity,
      visible: this.visible,
      locked: this.locked
    };
  }
}

/**
 * 背景レイヤー
 */
export class BackgroundLayer extends BaseLayer {
  constructor(options = {}) {
    super({ ...options, name: options.name || '背景', type: 'background' });
    this.color = options.color || '#ffffff';
    this.transparent = options.transparent || false;
    this.locked = true; // 背景は通常ロック
  }

  renderContent(ctx, scale, isExport) {
    const w = this.width * scale;
    const h = this.height * scale;
    if (this.transparent) {
      if (!isExport) {
        // 表示用チェッカーパターン
        drawCheckerPattern(ctx, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.fillStyle = this.color;
      ctx.fillRect(-w / 2, -h / 2, w, h);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      color: this.color,
      transparent: this.transparent
    };
  }
}

function drawCheckerPattern(ctx, x, y, w, h, size = 16) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const cols = Math.ceil(w / size);
  const rows = Math.ceil(h / size);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#e2e8f0' : '#ffffff';
      ctx.fillRect(x + c * size, y + r * size, size, size);
    }
  }
  ctx.restore();
}

/**
 * 画像レイヤー
 */
export class ImageLayer extends BaseLayer {
  constructor(options = {}) {
    super({ ...options, name: options.name || '画像', type: 'image' });
    this.image = options.image || null; // HTMLImageElement
    this.src = options.src || '';       // Base64 DataURL
    this.origWidth = options.origWidth || (this.image ? this.image.naturalWidth : this.width);
    this.origHeight = options.origHeight || (this.image ? this.image.naturalHeight : this.height);
    this.flipX = options.flipX || false;
    this.flipY = options.flipY || false;
    this.brightness = options.brightness !== undefined ? options.brightness : 100; // 0-200%
    this.contrast = options.contrast !== undefined ? options.contrast : 100;       // 0-200%
    this.saturation = options.saturation !== undefined ? options.saturation : 100;   // 0-200%
    this.filterCanvas = null; // フィルタ適用キャッシュ

    // 画像の自動ロードと再描画トリガー
    if (!this.image && this.src && typeof Image !== 'undefined') {
      this.image = new Image();
      this.image.onload = () => {
        if (!this.origWidth) this.origWidth = this.image.naturalWidth;
        if (!this.origHeight) this.origHeight = this.image.naturalHeight;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('playmat:imageready'));
        }
      };
      this.image.src = this.src;
    } else if (this.image && !this.image.complete) {
      this.image.onload = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('playmat:imageready'));
        }
      };
    }
  }

  // 実効DPIの取得 (横幅基準)
  getEffectiveDpi(dpiScale, docWidthMm) {
    if (!this.origWidth || !this.width || !docWidthMm) return 300;
    // 画面論理幅に対するこの画像の印刷サイズ(mm)
    const printWidthMm = (this.width / (docWidthMm * (dpiScale || 1))) * docWidthMm;
    return calculateEffectiveDpi(this.origWidth, printWidthMm);
  }

  renderContent(ctx, scale, isExport) {
    if (!this.image && !this.src) return;
    
    const w = this.width * scale;
    const h = this.height * scale;

    ctx.save();
    // 反転
    if (this.flipX || this.flipY) {
      ctx.scale(this.flipX ? -1 : 1, this.flipY ? -1 : 1);
    }

    // フィルタ設定
    const b = this.brightness;
    const c = this.contrast;
    const s = this.saturation;
    const hasFilter = (b !== 100 || c !== 100 || s !== 100);

    if (hasFilter && ctx.filter) {
      ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    }

    if (this.image && this.image.complete && this.image.naturalWidth > 0) {
      ctx.drawImage(this.image, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      src: this.src || (this.image ? this.image.src : ''),
      origWidth: this.origWidth,
      origHeight: this.origHeight,
      flipX: this.flipX,
      flipY: this.flipY,
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation
    };
  }
}

/**
 * ペイントレイヤー (ラスター手描き)
 */
export class PaintLayer extends BaseLayer {
  constructor(options = {}) {
    super({ ...options, name: options.name || 'ペイント', type: 'paint' });
    this.canvas = null; // オフスクリーンCanvas
    this.initCanvas(this.width, this.height, options.initialData);
  }

  initCanvas(w, h, dataUrl = null) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.round(w));
    this.canvas.height = Math.max(1, Math.round(h));
    this.ctx = this.canvas.getContext('2d');
    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    }
  }

  resizeBuffer(w, h) {
    const oldCanvas = this.canvas;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(1, Math.round(w));
    this.canvas.height = Math.max(1, Math.round(h));
    this.ctx = this.canvas.getContext('2d');
    if (oldCanvas) {
      this.ctx.drawImage(oldCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }
    this.width = w;
    this.height = h;
  }

  renderContent(ctx, scale, isExport) {
    if (!this.canvas) return;
    const w = this.width * scale;
    const h = this.height * scale;
    ctx.drawImage(this.canvas, -w / 2, -h / 2, w, h);
  }

  serialize() {
    return {
      ...super.serialize(),
      dataUrl: this.canvas ? this.canvas.toDataURL('image/png') : ''
    };
  }
}

/**
 * テキストレイヤー (ベクターテキスト)
 */
export class TextLayer extends BaseLayer {
  constructor(options = {}) {
    super({ ...options, name: options.name || 'テキスト', type: 'text' });
    this.text = options.text || 'テキスト入力';
    this.fontFamily = options.fontFamily || 'sans-serif';
    this.fontSize = options.fontSize || 48; // 論理px
    this.color = options.color || '#ffffff';
    this.bold = options.bold || false;
    this.italic = options.italic || false;
    this.align = options.align || 'center'; // left, center, right
    this.strokeColor = options.strokeColor || '#000000';
    this.strokeWidth = options.strokeWidth || 0; // 0なら縁取りなし
    this.shadowColor = options.shadowColor || 'rgba(0,0,0,0.5)';
    this.shadowBlur = options.shadowBlur || 0;
    this.shadowOffsetX = options.shadowOffsetX || 0;
    this.shadowOffsetY = options.shadowOffsetY || 0;
    this.lineHeight = options.lineHeight || 1.3;
    this.letterSpacing = options.letterSpacing || 0;
    this.updateMetrics();
  }

  updateMetrics() {
    // 仮想Canvasで文字列のサイズを測り幅・高さを自動更新
    const off = document.createElement('canvas');
    const ctx = off.getContext('2d');
    const weight = this.bold ? 'bold' : 'normal';
    const style = this.italic ? 'italic' : 'normal';
    ctx.font = `${style} ${weight} ${this.fontSize}px ${this.fontFamily}`;

    const lines = this.text.split('\n');
    let maxW = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      if (metrics.width > maxW) maxW = metrics.width;
    }
    const pad = Math.max(this.strokeWidth * 2, 8);
    this.width = Math.max(60, maxW + pad * 2);
    this.height = Math.max(30, (lines.length * this.fontSize * this.lineHeight) + pad * 2);
  }

  renderContent(ctx, scale, isExport) {
    const sFontSize = this.fontSize * scale;
    const weight = this.bold ? 'bold' : 'normal';
    const style = this.italic ? 'italic' : 'normal';
    ctx.font = `${style} ${weight} ${sFontSize}px ${this.fontFamily}`;
    ctx.textAlign = this.align;
    ctx.textBaseline = 'middle';

    if (this.shadowBlur > 0) {
      ctx.shadowColor = this.shadowColor;
      ctx.shadowBlur = this.shadowBlur * scale;
      ctx.shadowOffsetX = this.shadowOffsetX * scale;
      ctx.shadowOffsetY = this.shadowOffsetY * scale;
    }

    const lines = this.text.split('\n');
    const lineStep = this.fontSize * this.lineHeight * scale;
    const totalH = (lines.length - 1) * lineStep;
    let startY = -totalH / 2;

    let targetX = 0;
    if (this.align === 'left') targetX = -(this.width * scale) / 2 + 10 * scale;
    else if (this.align === 'right') targetX = (this.width * scale) / 2 - 10 * scale;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const y = startY + (i * lineStep);

      // 縁取り
      if (this.strokeWidth > 0) {
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth * scale * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, targetX, y);
      }

      // 文字本体
      ctx.fillStyle = this.color;
      ctx.fillText(line, targetX, y);
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      color: this.color,
      bold: this.bold,
      italic: this.italic,
      align: this.align,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur,
      shadowOffsetX: this.shadowOffsetX,
      shadowOffsetY: this.shadowOffsetY,
      lineHeight: this.lineHeight,
      letterSpacing: this.letterSpacing
    };
  }
}

/**
 * 図形レイヤー (長方形、角丸長方形、楕円、直線、TCGゾーン枠)
 */
export class ShapeLayer extends BaseLayer {
  constructor(options = {}) {
    super({ ...options, name: options.name || '図形', type: 'shape' });
    this.shapeType = options.shapeType || 'rect'; // rect, roundrect, ellipse, line, tcg_zone
    this.fillColor = options.fillColor !== undefined ? options.fillColor : 'rgba(56, 189, 248, 0.2)';
    this.strokeColor = options.strokeColor || '#38bdf8';
    this.strokeWidth = options.strokeWidth !== undefined ? options.strokeWidth : 3;
    this.strokeDash = options.strokeDash || []; // [5, 5] 等
    this.borderRadius = options.borderRadius || 12;
    this.label = options.label || ''; // TCGゾーン用ラベル（例: "MAIN DECK", "GRAVEYARD"）
  }

  renderContent(ctx, scale, isExport) {
    const w = this.width * scale;
    const h = this.height * scale;
    const hw = w / 2;
    const hh = h / 2;

    ctx.save();
    if (this.strokeDash && this.strokeDash.length > 0) {
      ctx.setLineDash(this.strokeDash.map(d => d * scale));
    }
    ctx.lineWidth = this.strokeWidth * scale;
    ctx.strokeStyle = this.strokeColor;
    ctx.fillStyle = this.fillColor;

    ctx.beginPath();
    switch (this.shapeType) {
      case 'rect':
        if (this.fillColor && this.fillColor !== 'transparent') ctx.fillRect(-hw, -hh, w, h);
        if (this.strokeWidth > 0) ctx.strokeRect(-hw, -hh, w, h);
        break;

      case 'roundrect':
      case 'tcg_zone': {
        const r = Math.min(this.borderRadius * scale, hw, hh);
        roundRectPath(ctx, -hw, -hh, w, h, r);
        if (this.fillColor && this.fillColor !== 'transparent') ctx.fill();
        if (this.strokeWidth > 0) ctx.stroke();

        // TCGゾーンラベル
        if (this.label) {
          ctx.setLineDash([]);
          ctx.fillStyle = this.strokeColor;
          ctx.font = `bold ${Math.max(12, Math.round(14 * scale))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(this.label, 0, 0);
        }
        break;
      }

      case 'ellipse':
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        if (this.fillColor && this.fillColor !== 'transparent') ctx.fill();
        if (this.strokeWidth > 0) ctx.stroke();
        break;

      case 'line':
        ctx.beginPath();
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw, hh);
        if (this.strokeWidth > 0) ctx.stroke();
        break;
    }
    ctx.restore();
  }

  serialize() {
    return {
      ...super.serialize(),
      shapeType: this.shapeType,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      strokeDash: this.strokeDash,
      borderRadius: this.borderRadius,
      label: this.label
    };
  }
}

function roundRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * レイヤーインスタンスをシリアライズデータから復元
 */
export function deserializeLayer(data, imageElement = null) {
  switch (data.type) {
    case 'background':
      return new BackgroundLayer(data);
    case 'image': {
      const layer = new ImageLayer(data);
      if (imageElement) {
        layer.image = imageElement;
      } else if (data.src) {
        const img = new Image();
        img.src = data.src;
        layer.image = img;
      }
      return layer;
    }
    case 'paint':
      return new PaintLayer({ ...data, initialData: data.dataUrl });
    case 'text':
      return new TextLayer(data);
    case 'shape':
      return new ShapeLayer(data);
    default:
      return new BaseLayer(data);
  }
}

