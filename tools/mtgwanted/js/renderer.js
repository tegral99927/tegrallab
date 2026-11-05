/**
 * MTGWanted - renderer.js
 * 西部劇「WANTED」ポスター HTML5 Canvas レンダラー
 * 16:9横長、正方形、縦長、長尺の全比率に完全対応
 */

import { THEMES, SIZES } from './storage.js';

// roundRect ポリフィル（古いブラウザ対応）
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// 画像キャッシュ
const imageCache = new Map();

/**
 * 画像（DataURLまたはURL）を非同期ロードしてキャッシュ
 */
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src));
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn('[MTGWanted] Failed to load image:', src);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * 曜日の計算 (0:日, 1:月, ...)
 */
function getDayInfo(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return null;

  const dayIdx = d.getDay();
  const jaDays = ['日', '月', '火', '水', '木', '金', '土'];
  const enDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const enMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return {
    year,
    month: month + 1,
    day,
    jaDay: jaDays[dayIdx],
    enDay: enDays[dayIdx],
    enMonth: enMonths[month],
    isWeekend: dayIdx === 0 || dayIdx === 6
  };
}

/**
 * メイン描画関数
 */
export async function renderPoster(state, targetCanvas, options = {}) {
  const sizePreset = SIZES[state.poster?.size] || SIZES.landscape;
  const width = sizePreset.width;
  const height = sizePreset.height;

  if (targetCanvas.width !== width || targetCanvas.height !== height) {
    targetCanvas.width = width;
    targetCanvas.height = height;
  }

  const ctx = targetCanvas.getContext('2d');
  const theme = THEMES[state.poster?.theme] || THEMES.classic;

  // 1. 背景の羊皮紙・ヴィンテージテクスチャ描画
  drawAgedPaper(ctx, width, height, theme, state.poster?.paperTexture);

  // 2. 西部劇調の外枠・四隅オーナメント描画
  drawBordersAndCorners(ctx, width, height, theme, state.poster?.borderStyle, state.poster?.ornamentDensity);

  // 3. アバター画像のロード
  let avatarImg = null;
  if (state.profile?.avatar) {
    avatarImg = await loadImage(state.profile.avatar);
  }

  // 4. 比率に応じたレイアウト描画
  let overflowWarning = false;
  if (sizePreset.id === 'landscape' || sizePreset.id === 'landscape_hd') {
    overflowWarning = drawLandscapeLayout(ctx, width, height, state, theme, avatarImg);
  } else {
    overflowWarning = drawVerticalLayout(ctx, width, height, state, theme, avatarImg, sizePreset.id);
  }

  // 5. 募集ステータススタンプ描画（対戦相手決定 / 募集終了）
  if (state.poster?.status && state.poster.status !== 'recruiting') {
    drawStatusStamp(ctx, width, height, state.poster.status, theme, sizePreset.id);
  }

  return {
    success: true,
    width,
    height,
    overflowWarning
  };
}

/**
 * 羊皮紙・ヴィンテージ紙の背景描画
 */
function drawAgedPaper(ctx, width, height, theme, textureType = 'parchment') {
  ctx.save();

  // 基本ベースグラデーション
  const grad = ctx.createRadialGradient(
    width * 0.5, height * 0.48, Math.min(width, height) * 0.2,
    width * 0.5, height * 0.5, Math.max(width, height) * 0.75
  );
  grad.addColorStop(0, theme.bg);
  grad.addColorStop(0.7, theme.bg);
  grad.addColorStop(1, theme.bgEdge);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // テクスチャタイプに応じたプロシージャル粒子と染み
  if (textureType !== 'clean') {
    // 粗い繊維と紙の粒状感（シード固定の疑似ノイズで描画のブレを防止）
    const step = textureType === 'rough' ? 14 : 20;
    const opacity = textureType === 'rough' ? 0.045 : (textureType === 'grain' ? 0.038 : 0.025);

    ctx.fillStyle = theme.text;
    ctx.globalAlpha = opacity;

    // 擬似ノイズパターン
    for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const rand = n - Math.floor(n);
        if (rand > 0.65) {
          const dotSize = (rand * 2.5) + (textureType === 'rough' ? 1.5 : 0.8);
          ctx.beginPath();
          ctx.arc(x + rand * 6, y + (1 - rand) * 6, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 羊皮紙特有の経年染み（ウォータースポット）
    if (textureType === 'parchment' || textureType === 'rough') {
      ctx.globalAlpha = 0.04;
      const stains = [
        { x: width * 0.15, y: height * 0.25, r: 120 },
        { x: width * 0.82, y: height * 0.72, r: 160 },
        { x: width * 0.28, y: height * 0.85, r: 90 },
        { x: width * 0.75, y: height * 0.18, r: 110 }
      ];
      stains.forEach(s => {
        const sGrad = ctx.createRadialGradient(s.x, s.y, s.r * 0.3, s.x, s.y, s.r);
        sGrad.addColorStop(0, theme.accent);
        sGrad.addColorStop(0.8, theme.textMuted);
        sGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // 四隅と外縁のバーン・ヴィネットシャドウ
  ctx.globalAlpha = 0.15;
  const edgeGrad = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.45,
    width / 2, height / 2, Math.max(width, height) * 0.72
  );
  edgeGrad.addColorStop(0, 'transparent');
  edgeGrad.addColorStop(1, theme.id === 'dark' ? '#000000' : '#4a280c');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * 西部劇の枠線と四隅オーナメント描画
 */
function drawBordersAndCorners(ctx, width, height, theme, borderStyle = 'triple', ornamentDensity = 'normal') {
  ctx.save();
  ctx.strokeStyle = theme.border;
  ctx.fillStyle = theme.border;

  const m = 32; // 外側余白
  const innerW = width - m * 2;
  const innerH = height - m * 2;

  // 1. 最外枠（極太木版枠）
  ctx.lineWidth = borderStyle === 'simple' ? 4 : 8;
  ctx.strokeRect(m, m, innerW, innerH);

  // 2. 二重枠・ロープ枠
  if (borderStyle !== 'simple') {
    const gap = 12;
    if (borderStyle === 'rope') {
      // ロープ調ステッチ
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(m + gap, m + gap, innerW - gap * 2, innerH - gap * 2);
      ctx.setLineDash([]);
    } else {
      // 細二重線
      ctx.lineWidth = 2;
      ctx.strokeRect(m + gap, m + gap, innerW - gap * 2, innerH - gap * 2);
      if (borderStyle === 'triple') {
        ctx.lineWidth = 1;
        ctx.strokeRect(m + gap + 6, m + gap + 6, innerW - (gap + 6) * 2, innerH - (gap + 6) * 2);
      }
    }
  }

  // 3. 四隅のオーナメント
  if (ornamentDensity !== 'minimal') {
    const corners = [
      { x: m, y: m, dx: 1, dy: 1 },
      { x: width - m, y: m, dx: -1, dy: 1 },
      { x: m, y: height - m, dx: 1, dy: -1 },
      { x: width - m, y: height - m, dx: -1, dy: -1 }
    ];

    corners.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.dx, c.dy);

      // 三角形コーナーブラケット
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(44, 0);
      ctx.lineTo(0, 44);
      ctx.closePath();
      ctx.fill();

      // コーナースタッド・星
      ctx.fillStyle = theme.accent;
      drawStar(ctx, 16, 16, 5, 8, 3.5);
      ctx.fill();

      if (ornamentDensity === 'high') {
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 52, 0, Math.PI * 0.5);
        ctx.stroke();
      }

      ctx.restore();
    });
  }

  ctx.restore();
}

/**
 * 星型パス生成ユーティリティ
 */
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;

  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;

    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

/**
 * 西部劇風装飾ライン（横仕切り線）
 */
function drawWesternDivider(ctx, cx, cy, length, theme) {
  ctx.save();
  const half = length / 2;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;

  // 左右のライン
  ctx.beginPath();
  ctx.moveTo(cx - half, cy);
  ctx.lineTo(cx - 24, cy);
  ctx.moveTo(cx + 24, cy);
  ctx.lineTo(cx + half, cy);
  ctx.stroke();

  // 中央の星オーナメント
  ctx.fillStyle = theme.accent;
  drawStar(ctx, cx, cy, 5, 10, 4.5);
  ctx.fill();

  // 左右の小さな丸スタッド
  ctx.fillStyle = theme.border;
  ctx.beginPath();
  ctx.arc(cx - 36, cy, 3, 0, Math.PI * 2);
  ctx.arc(cx + 36, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 【横長レイアウト (16:9)】 1600x900 / 1920x1080
 * 左：巨大アイコン＋名前＋SNS、右：WANTED見出し＋DUEL TIME＋環境/フォーマット＋募集メモ
 */
function drawLandscapeLayout(ctx, width, height, state, theme, avatarImg) {
  ctx.save();
  const scale = width / 1600; // 1920等の比率スケーリング
  let overflowWarning = false;

  // 上部マージン
  const topY = 60 * scale;

  // === 左カラム（プレイヤー情報） ===
  const leftColX = 75 * scale;
  const leftColW = 460 * scale;
  const colCenter = leftColX + leftColW / 2;

  // アイコンサイズ算出
  let avatarBoxSize = 340 * scale;
  if (state.poster?.iconSize === 'xlarge') avatarBoxSize = 390 * scale;
  if (state.poster?.iconSize === 'medium') avatarBoxSize = 290 * scale;

  const avatarBoxY = topY + 40 * scale;

  // アイコン描画
  drawAvatar(ctx, colCenter, avatarBoxY + avatarBoxSize / 2, avatarBoxSize, state.profile, theme, avatarImg);

  // プレイヤー名
  const nameY = avatarBoxY + avatarBoxSize + 48 * scale;
  ctx.fillStyle = theme.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(38 * scale)}px Georgia, 'Palatino Linotype', 'Times New Roman', serif`;
  const nameText = state.profile?.name || 'Planeswalker';
  ctx.fillText(nameText, colCenter, nameY, leftColW - 20);

  // SNS ID
  if (state.profile?.handle) {
    const handleY = nameY + 36 * scale;
    ctx.fillStyle = theme.textMuted;
    ctx.font = `italic 700 ${Math.round(20 * scale)}px Georgia, 'Palatino Linotype', serif`;
    ctx.fillText(state.profile.handle, colCenter, handleY, leftColW - 20);
  }

  // 左カラムと右カラムを隔てる縦装飾線
  const dividerX = leftColX + leftColW + 35 * scale;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dividerX, topY + 20 * scale);
  ctx.lineTo(dividerX, height - 70 * scale);
  ctx.stroke();

  // 縦線の上下オーナメント
  ctx.fillStyle = theme.accent;
  drawStar(ctx, dividerX, topY + 20 * scale, 5, 8 * scale, 3.5 * scale);
  ctx.fill();
  drawStar(ctx, dividerX, height - 70 * scale, 5, 8 * scale, 3.5 * scale);
  ctx.fill();

  // === 右カラム（WANTED、日時、フォーマット、募集要項） ===
  const rightColX = dividerX + 45 * scale;
  const rightColW = (width - 70 * scale) - rightColX;
  const rightCenter = rightColX + rightColW / 2;

  let currentY = topY + 10 * scale;

  // 1. WANTED 見出し
  const titleText = (state.poster?.title || 'WANTED').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 木版ドロップシャドウ
  ctx.fillStyle = theme.id === 'dark' ? '#000000' : 'rgba(100, 60, 20, 0.25)';
  ctx.font = `900 ${Math.round(76 * scale)}px Georgia, 'Palatino Linotype', serif`;
  ctx.fillText(titleText, rightCenter + 3 * scale, currentY + 3 * scale, rightColW);

  // 見出し本体
  ctx.fillStyle = theme.text;
  ctx.fillText(titleText, rightCenter, currentY, rightColW);
  currentY += 82 * scale;

  // サブタイトル
  const subtitleText = state.poster?.subtitle || 'OPPONENT WANTED';
  ctx.fillStyle = theme.accent;
  ctx.font = `bold ${Math.round(21 * scale)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(subtitleText, rightCenter, currentY, rightColW);
  currentY += 32 * scale;

  // 装飾仕切り線
  drawWesternDivider(ctx, rightCenter, currentY, rightColW * 0.85, theme);
  currentY += 26 * scale;

  // 2. 対戦日時（DUEL TIME） - 最重要要素
  ctx.fillStyle = theme.text;
  ctx.font = `900 ${Math.round(22 * scale)}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = state.poster?.textAlign === 'left' ? 'left' : 'center';
  const duelHeaderX = state.poster?.textAlign === 'left' ? rightColX + 10 * scale : rightCenter;
  ctx.fillText('◆  DUEL TIME  ◆', duelHeaderX, currentY);
  currentY += 34 * scale;

  // 日時候補リストのレンダリング
  const slots = state.schedule?.slots || [];
  const validSlots = slots.filter(s => s.date || s.startTime || s.customText);

  if (validSlots.length > 0) {
    const slotFontSize = Math.min(Math.round(26 * scale * (state.poster?.fontSizeScale || 1)), 34 * scale);
    ctx.font = `700 ${slotFontSize}px Georgia, 'Times New Roman', serif`;

    validSlots.forEach(slot => {
      const slotText = formatSlotText(slot, state.schedule?.dateFormat);
      ctx.fillStyle = theme.text;
      ctx.fillText(slotText, duelHeaderX, currentY, rightColW - 20 * scale);
      currentY += slotFontSize + 10 * scale;
    });
  } else {
    ctx.font = `italic 700 ${Math.round(22 * scale)}px Georgia, serif`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText('日時自由 / いつでも歓迎 (TIME FLEXIBLE)', duelHeaderX, currentY);
    currentY += 32 * scale;
  }

  // 時間相談可 / いつでも歓迎 バッジ
  const flags = [];
  if (state.schedule?.timeNegotiableGlobal) flags.push('TIME NEGOTIABLE (時間相談可)');
  if (state.schedule?.anytimeWelcomeGlobal) flags.push('ANYTIME WELCOME (いつでも歓迎)');

  if (flags.length > 0) {
    ctx.font = `bold ${Math.round(15 * scale)}px Georgia, serif`;
    ctx.fillStyle = theme.accent;
    ctx.fillText(flags.join('  |  '), duelHeaderX, currentY, rightColW);
    currentY += 26 * scale;
  }

  currentY += 10 * scale;

  // 3. 対戦環境 & フォーマット
  const badges = [];
  if (state.environments?.paper_inperson) {
    const loc = state.environments.inPersonLocation ? ` (${state.environments.inPersonLocation})` : '';
    badges.push(`対面${loc}`);
  }
  if (state.environments?.paper_remote) {
    const tool = state.environments.remoteTool ? ` (${state.environments.remoteTool})` : '';
    badges.push(`紙リモート${tool}`);
  }
  if (state.environments?.arena) badges.push('MTG Arena');
  if (state.environments?.mo) badges.push('Magic Online');

  // フォーマット一覧
  const fmts = [...(state.formats || [])];
  if (state.customFormat) fmts.push(state.customFormat);
  fmts.forEach(f => badges.push(f));

  if (badges.length > 0) {
    currentY = drawBadgeList(ctx, rightColX, currentY, rightColW, badges, theme, scale, state.poster?.textAlign);
    currentY += 14 * scale;
  }

  // 4. 募集要項メモ（テキストボックス）
  const remainingH = (height - 65 * scale) - currentY;
  if (remainingH > 70 * scale && state.notes) {
    overflowWarning = drawNotesBox(ctx, rightColX, currentY, rightColW, remainingH, state.notes, theme, scale);
  }

  // 5. フッター装飾・モットー
  const footerY = height - 48 * scale;
  const footerText = state.poster?.customFooter || 'REWARD: GLORIOUS BATTLE & HONOR';
  ctx.fillStyle = theme.textMuted;
  ctx.font = `bold italic ${Math.round(14 * scale)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, width / 2, footerY, width - 160 * scale);

  ctx.restore();
  return overflowWarning;
}

/**
 * 【縦長 / 正方形 / 長尺レイアウト】
 */
function drawVerticalLayout(ctx, width, height, state, theme, avatarImg, sizeType) {
  ctx.save();
  const scale = width / 1200;
  let overflowWarning = false;
  const cx = width / 2;

  let currentY = 55 * scale;

  // 1. WANTED 見出し
  const titleText = (state.poster?.title || 'WANTED').toUpperCase();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const titleSize = Math.round((sizeType === 'square' ? 70 : 88) * scale);
  // ドロップシャドウ
  ctx.fillStyle = theme.id === 'dark' ? '#000000' : 'rgba(100, 60, 20, 0.25)';
  ctx.font = `900 ${titleSize}px Georgia, 'Palatino Linotype', serif`;
  ctx.fillText(titleText, cx + 3 * scale, currentY + 3 * scale, width - 140 * scale);

  ctx.fillStyle = theme.text;
  ctx.fillText(titleText, cx, currentY, width - 140 * scale);
  currentY += titleSize + 10 * scale;

  // サブタイトル
  const subtitleText = state.poster?.subtitle || 'OPPONENT WANTED';
  ctx.fillStyle = theme.accent;
  ctx.font = `bold ${Math.round(22 * scale)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(subtitleText, cx, currentY, width - 140 * scale);
  currentY += 34 * scale;

  // 仕切り線
  drawWesternDivider(ctx, cx, currentY, width * 0.75, theme);
  currentY += 30 * scale;

  // 2. アバターアイコン描画
  let avatarBoxSize = sizeType === 'square' ? 270 * scale : 340 * scale;
  if (state.poster?.iconSize === 'xlarge') avatarBoxSize += 50 * scale;
  if (state.poster?.iconSize === 'medium') avatarBoxSize -= 40 * scale;

  drawAvatar(ctx, cx, currentY + avatarBoxSize / 2, avatarBoxSize, state.profile, theme, avatarImg);
  currentY += avatarBoxSize + 22 * scale;

  // プレイヤー名
  ctx.fillStyle = theme.text;
  ctx.font = `900 ${Math.round(36 * scale)}px Georgia, 'Palatino Linotype', serif`;
  const nameText = state.profile?.name || 'Planeswalker';
  ctx.fillText(nameText, cx, currentY, width - 160 * scale);
  currentY += 40 * scale;

  // SNS ID
  if (state.profile?.handle) {
    ctx.fillStyle = theme.textMuted;
    ctx.font = `italic 700 ${Math.round(20 * scale)}px Georgia, serif`;
    ctx.fillText(state.profile.handle, cx, currentY, width - 160 * scale);
    currentY += 30 * scale;
  }

  currentY += 10 * scale;

  // 3. DUEL TIME
  ctx.fillStyle = theme.text;
  ctx.font = `900 ${Math.round(24 * scale)}px Georgia, 'Times New Roman', serif`;
  ctx.fillText('◆  DUEL TIME  ◆', cx, currentY);
  currentY += 36 * scale;

  const slots = state.schedule?.slots || [];
  const validSlots = slots.filter(s => s.date || s.startTime || s.customText);

  if (validSlots.length > 0) {
    const slotFontSize = Math.min(Math.round(26 * scale * (state.poster?.fontSizeScale || 1)), 34 * scale);
    ctx.font = `700 ${slotFontSize}px Georgia, 'Times New Roman', serif`;

    validSlots.forEach(slot => {
      const slotText = formatSlotText(slot, state.schedule?.dateFormat);
      ctx.fillStyle = theme.text;
      ctx.fillText(slotText, cx, currentY, width - 140 * scale);
      currentY += slotFontSize + 10 * scale;
    });
  } else {
    ctx.font = `italic 700 ${Math.round(22 * scale)}px Georgia, serif`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText('日時自由 / いつでも歓迎 (TIME FLEXIBLE)', cx, currentY);
    currentY += 32 * scale;
  }

  // フラグ
  const flags = [];
  if (state.schedule?.timeNegotiableGlobal) flags.push('TIME NEGOTIABLE (時間相談可)');
  if (state.schedule?.anytimeWelcomeGlobal) flags.push('ANYTIME WELCOME (いつでも歓迎)');

  if (flags.length > 0) {
    ctx.font = `bold ${Math.round(15 * scale)}px Georgia, serif`;
    ctx.fillStyle = theme.accent;
    ctx.fillText(flags.join('  |  '), cx, currentY, width - 140 * scale);
    currentY += 28 * scale;
  }

  currentY += 12 * scale;

  // 4. 環境 & フォーマット バッジ
  const badges = [];
  if (state.environments?.paper_inperson) {
    const loc = state.environments.inPersonLocation ? ` (${state.environments.inPersonLocation})` : '';
    badges.push(`対面${loc}`);
  }
  if (state.environments?.paper_remote) {
    const tool = state.environments.remoteTool ? ` (${state.environments.remoteTool})` : '';
    badges.push(`紙リモート${tool}`);
  }
  if (state.environments?.arena) badges.push('MTG Arena');
  if (state.environments?.mo) badges.push('Magic Online');

  const fmts = [...(state.formats || [])];
  if (state.customFormat) fmts.push(state.customFormat);
  fmts.forEach(f => badges.push(f));

  if (badges.length > 0) {
    const boxW = width - 160 * scale;
    currentY = drawBadgeList(ctx, 80 * scale, currentY, boxW, badges, theme, scale, 'center');
    currentY += 16 * scale;
  }

  // 5. 募集要項メモ
  const remainingH = (height - 65 * scale) - currentY;
  if (remainingH > 70 * scale && state.notes) {
    const notesBoxW = width - 160 * scale;
    overflowWarning = drawNotesBox(ctx, 80 * scale, currentY, notesBoxW, remainingH, state.notes, theme, scale);
  }

  // フッター
  const footerY = height - 48 * scale;
  const footerText = state.poster?.customFooter || 'REWARD: GLORIOUS BATTLE & HONOR';
  ctx.fillStyle = theme.textMuted;
  ctx.font = `bold italic ${Math.round(14 * scale)}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footerText, cx, footerY, width - 160 * scale);

  ctx.restore();
  return overflowWarning;
}

/**
 * 日時テキストの書式生成
 */
function formatSlotText(slot, format = 'western') {
  if (slot.customText && !slot.date && !slot.startTime) {
    return slot.customText;
  }

  const dayInfo = getDayInfo(slot.date);
  let timeStr = '';
  if (slot.startTime && slot.endTime) {
    timeStr = `${slot.startTime} - ${slot.endTime}`;
  } else if (slot.startTime) {
    timeStr = `${slot.startTime} -`;
  }

  let result = '';

  if (format === 'japanese') {
    // 11月7日(土) 20:00 〜 23:00
    if (dayInfo) {
      result += `${dayInfo.month}月${dayInfo.day}日(${dayInfo.jaDay}) `;
    }
    if (timeStr) {
      result += timeStr.replace('-', '〜');
    }
  } else if (format === 'english') {
    // NOV 07 SAT 20:00 - 23:00
    if (dayInfo) {
      const dd = String(dayInfo.day).padStart(2, '0');
      result += `${dayInfo.enMonth} ${dd} ${dayInfo.enDay} `;
    }
    if (timeStr) result += timeStr;
  } else {
    // 西部劇風装飾 (✦ 11/07 [SAT] 20:00 - 23:00 ✦)
    result += '✦ ';
    if (dayInfo) {
      const mm = String(dayInfo.month).padStart(2, '0');
      const dd = String(dayInfo.day).padStart(2, '0');
      result += `${mm}/${dd} [${dayInfo.enDay}] `;
    }
    if (timeStr) result += `${timeStr} `;
    result += '✦';
  }

  if (slot.customText) {
    result += ` (${slot.customText})`;
  }

  return result.trim();
}

/**
 * プレイヤーアバター描画（フレーム、写真、セピア加工、オリジナルシルエット）
 */
function drawAvatar(ctx, cx, cy, size, profile, theme, avatarImg) {
  ctx.save();
  const isCircle = profile?.avatarShape !== 'square';
  const radius = size / 2;

  // 1. フレームの影
  ctx.shadowColor = theme.id === 'dark' ? 'rgba(0,0,0,0.8)' : 'rgba(70,40,15,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;

  // 2. 外枠
  ctx.fillStyle = theme.boxBg;
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 6;

  if (isCircle) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.roundRect(cx - radius, cy - radius, size, size, 8);
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowColor = 'transparent';

  // 二重線
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  if (isCircle) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(cx - radius + 8, cy - radius + 8, size - 16, size - 16);
  }

  // 3. クリッピング領域を設定して画像またはシルエットを描画
  ctx.save();
  ctx.beginPath();
  if (isCircle) {
    ctx.arc(cx, cy, radius - 12, 0, Math.PI * 2);
  } else {
    ctx.rect(cx - radius + 12, cy - radius + 12, size - 24, size - 24);
  }
  ctx.clip();

  if (avatarImg) {
    // セピア加工
    if (profile.avatarSepia) {
      const sepiaVal = profile.avatarSepiaIntensity ?? 75;
      ctx.filter = `sepia(${sepiaVal}%) contrast(115%) brightness(95%)`;
    }

    const zoom = profile.avatarZoom || 1.0;
    const panX = profile.avatarX || 0;
    const panY = profile.avatarY || 0;

    const imgAspect = avatarImg.width / avatarImg.height;
    let dw = size;
    let dh = size;

    if (imgAspect > 1) {
      dw = size * imgAspect;
    } else {
      dh = size / imgAspect;
    }

    dw *= zoom;
    dh *= zoom;

    const dx = cx - dw / 2 + panX;
    const dy = cy - dh / 2 + panY;

    ctx.drawImage(avatarImg, dx, dy, dw, dh);
    ctx.filter = 'none';

    // 写真のヴィネットシャドウ
    const vGrad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius - 12);
    vGrad.addColorStop(0, 'transparent');
    vGrad.addColorStop(1, 'rgba(40, 20, 5, 0.35)');
    ctx.fillStyle = vGrad;
    ctx.fill();
  } else {
    // オリジナル西部劇シルエット描画
    drawCowboySilhouette(ctx, cx, cy, size - 24, theme);
  }

  ctx.restore();

  // 四隅の飾り鋲（スクエア時）
  if (!isCircle) {
    ctx.fillStyle = theme.accent;
    const studs = [
      { x: cx - radius + 16, y: cy - radius + 16 },
      { x: cx + radius - 16, y: cy - radius + 16 },
      { x: cx - radius + 16, y: cy + radius - 16 },
      { x: cx + radius - 16, y: cy + radius - 16 }
    ];
    studs.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

/**
 * 西部劇カウボーイシルエット（未設定時オリジナル素材）
 */
function drawCowboySilhouette(ctx, cx, cy, innerSize, theme) {
  ctx.save();
  const s = innerSize / 300;

  // 背景の温かいアンティークトーン
  const bGrad = ctx.createRadialGradient(cx, cy, 20 * s, cx, cy, 140 * s);
  bGrad.addColorStop(0, theme.id === 'dark' ? '#2c221a' : '#eedbb7');
  bGrad.addColorStop(1, theme.id === 'dark' ? '#17120e' : '#cfb689');
  ctx.fillStyle = bGrad;
  ctx.fillRect(cx - innerSize / 2, cy - innerSize / 2, innerSize, innerSize);

  ctx.fillStyle = theme.id === 'dark' ? '#0f0c0a' : '#2b1708';
  ctx.strokeStyle = theme.id === 'dark' ? '#0f0c0a' : '#2b1708';

  // 1. カウボーイハット
  // クラウン（頭頂部）
  ctx.beginPath();
  ctx.moveTo(cx - 35 * s, cy - 25 * s);
  ctx.bezierCurveTo(cx - 38 * s, cy - 75 * s, cx - 15 * s, cy - 85 * s, cx, cy - 75 * s);
  ctx.bezierCurveTo(cx + 15 * s, cy - 85 * s, cx + 38 * s, cy - 75 * s, cx + 35 * s, cy - 25 * s);
  ctx.closePath();
  ctx.fill();

  // ブリム（つば）
  ctx.beginPath();
  ctx.ellipse(cx, cy - 20 * s, 85 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // ハットバンド
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 32 * s, cy - 24 * s);
  ctx.lineTo(cx + 32 * s, cy - 24 * s);
  ctx.stroke();

  // 2. 頭部・首
  ctx.fillStyle = theme.id === 'dark' ? '#0f0c0a' : '#2b1708';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10 * s, 26 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // バンダナ（ワイルドラグ）
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(cx - 24 * s, cy + 30 * s);
  ctx.lineTo(cx + 24 * s, cy + 30 * s);
  ctx.lineTo(cx, cy + 65 * s);
  ctx.closePath();
  ctx.fill();

  // 3. 肩・コート
  ctx.fillStyle = theme.id === 'dark' ? '#0f0c0a' : '#2b1708';
  ctx.beginPath();
  ctx.moveTo(cx - 100 * s, cy + 150 * s);
  ctx.bezierCurveTo(cx - 95 * s, cy + 65 * s, cx - 45 * s, cy + 45 * s, cx - 20 * s, cy + 48 * s);
  ctx.lineTo(cx, cy + 65 * s);
  ctx.lineTo(cx + 20 * s, cy + 48 * s);
  ctx.bezierCurveTo(cx + 45 * s, cy + 45 * s, cx + 95 * s, cy + 65 * s, cx + 100 * s, cy + 150 * s);
  ctx.closePath();
  ctx.fill();

  // 胸の保安官スターバッジ
  ctx.fillStyle = '#d4af37';
  drawStar(ctx, cx - 40 * s, cy + 85 * s, 5, 8 * s, 3.5 * s);
  ctx.fill();

  ctx.restore();
}

/**
 * 環境 & フォーマットのバッジタグ一覧描画
 */
function drawBadgeList(ctx, startX, startY, maxWidth, badges, theme, scale, align = 'center') {
  ctx.save();
  const fontSize = Math.round(15 * scale);
  ctx.font = `bold ${fontSize}px Georgia, serif`;
  ctx.textBaseline = 'middle';

  const badgeH = 28 * scale;
  const paddingX = 14 * scale;
  const gapX = 8 * scale;
  const gapY = 8 * scale;

  // バッジの寸法を事前計算
  const measured = badges.map(b => ({
    text: b,
    w: ctx.measureText(b).width + paddingX * 2
  }));

  // 行ごとにグループ化
  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  measured.forEach(item => {
    if (currentLineWidth + item.w > maxWidth && currentLine.length > 0) {
      lines.push({ items: currentLine, totalW: currentLineWidth - gapX });
      currentLine = [item];
      currentLineWidth = item.w + gapX;
    } else {
      currentLine.push(item);
      currentLineWidth += item.w + gapX;
    }
  });
  if (currentLine.length > 0) {
    lines.push({ items: currentLine, totalW: currentLineWidth - gapX });
  }

  let lineY = startY;

  lines.forEach(line => {
    let itemX = startX;
    if (align === 'center') {
      itemX = startX + (maxWidth - line.totalW) / 2;
    }

    line.items.forEach(badge => {
      // バッジ背景
      ctx.fillStyle = theme.boxBg;
      ctx.strokeStyle = theme.boxBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(itemX, lineY, badge.w, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      // バッジテキスト
      ctx.fillStyle = theme.text;
      ctx.textAlign = 'center';
      ctx.fillText(badge.text, itemX + badge.w / 2, lineY + badgeH / 2);

      itemX += badge.w + gapX;
    });

    lineY += badgeH + gapY;
  });

  ctx.restore();
  return lineY;
}

/**
 * 募集要項メモボックス（自動改行・自動フォント縮小・はみ出し警告）
 */
function drawNotesBox(ctx, boxX, boxY, boxW, boxH, notes, theme, scale) {
  ctx.save();

  // ボックス背景
  ctx.fillStyle = theme.id === 'dark' ? 'rgba(39, 32, 28, 0.65)' : 'rgba(235, 220, 184, 0.55)';
  ctx.strokeStyle = theme.boxBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.stroke();

  // 見出しリボン「NOTES」
  ctx.fillStyle = theme.accent;
  ctx.font = `bold italic ${Math.round(13 * scale)}px Georgia, serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('MEMO / RECRUITMENT NOTES:', boxX + 14 * scale, boxY + 10 * scale);

  const innerX = boxX + 16 * scale;
  const innerY = boxY + 30 * scale;
  const innerW = boxW - 32 * scale;
  const innerH = boxH - 40 * scale;

  // テキスト自動改行 & 収まるフォントサイズ探索
  let fontSize = Math.round(18 * scale);
  const minFontSize = Math.round(12 * scale);
  let lines = [];
  let lineHeight = fontSize * 1.45;
  let fits = false;

  while (fontSize >= minFontSize) {
    lineHeight = fontSize * 1.45;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Meiryo', sans-serif`;
    lines = wrapText(ctx, notes, innerW);
    const totalTextH = lines.length * lineHeight;

    if (totalTextH <= innerH) {
      fits = true;
      break;
    }
    fontSize -= 1;
  }

  // テキスト描画（収まらない場合でも勝手に省略せず全て描画し、警告フラグを返す）
  ctx.fillStyle = theme.text;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Meiryo', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let currentTextY = innerY;
  lines.forEach(line => {
    if (currentTextY + lineHeight <= boxY + boxH - 4 * scale) {
      ctx.fillText(line, innerX, currentTextY, innerW);
    } else {
      // 枠外に少し超えても描画（消去は厳禁）
      ctx.fillText(line, innerX, currentTextY, innerW);
    }
    currentTextY += lineHeight;
  });

  ctx.restore();
  return !fits; // 収まりきらなかった場合は警告フラグ true
}

/**
 * 日本語対応のテキスト自動改行
 */
function wrapText(ctx, text, maxWidth) {
  const paragraphs = text.split('\n');
  const allLines = [];

  paragraphs.forEach(para => {
    if (!para) {
      allLines.push('');
      return;
    }

    let line = '';
    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const testLine = line + char;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line.length > 0) {
        allLines.push(line);
        line = char;
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) {
      allLines.push(line);
    }
  });

  return allLines;
}

/**
 * 募集ステータススタンプ描画（MATCH FOUND / CLOSED）
 */
function drawStatusStamp(ctx, width, height, status, theme, sizeType) {
  ctx.save();
  const scale = width / 1600;
  const isMatched = status === 'matched';
  const stampText = isMatched ? 'MATCH FOUND' : 'CLOSED';
  const subText = isMatched ? '対戦相手決定' : '募集終了';

  // 位置：横長ではアバター右上〜中央、縦長ではアバター中央〜上
  let stampX = width * 0.28;
  let stampY = height * 0.42;

  if (sizeType !== 'landscape' && sizeType !== 'landscape_hd') {
    stampX = width * 0.5;
    stampY = height * 0.35;
  }

  ctx.translate(stampX, stampY);
  ctx.rotate(-14 * (Math.PI / 180)); // 斜め傾き

  const stampColor = theme.stamp || '#b31b0e';
  const boxW = Math.round(360 * scale);
  const boxH = Math.round(100 * scale);

  ctx.globalAlpha = 0.88;

  // ラバースタンプの破線外枠
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 5 * scale;
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // 二重内枠
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(-boxW / 2 + 6 * scale, -boxH / 2 + 6 * scale, boxW - 12 * scale, boxH - 12 * scale);

  // スタンプテキスト
  ctx.fillStyle = stampColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.round(42 * scale)}px 'Impact', 'Arial Black', Georgia, sans-serif`;
  ctx.fillText(stampText, 0, -8 * scale);

  ctx.font = `bold ${Math.round(18 * scale)}px sans-serif`;
  ctx.fillText(subText, 0, 26 * scale);

  ctx.restore();
}
