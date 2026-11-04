/**
 * TimeLess - renderer.js
 * 16:9 高解像度画像（2560x1440 等）出力用専用レンダラー
 */

import { DAY_NAMES, DAY_NAMES_EN } from './schedule.js';
import { THEME_PALETTES, drawDonutChart } from './charts.js';

export const RESOLUTIONS = {
  '1920x1080': { width: 1920, height: 1080, label: '1920×1080 (Full HD)' },
  '2560x1440': { width: 2560, height: 1440, label: '2560×1440 (2K・標準)' },
  '3200x1800': { width: 3200, height: 1800, label: '3200×1800 (高解像度)' },
  '2400x1350': { width: 2400, height: 1350, label: '2400×1350 (SNS共有最適化)' }
};

// 基準となる論理解像度
const BASE_W = 2560;
const BASE_H = 1440;

/**
 * 角丸四角形ヘルパー
 */
function roundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

/**
 * 複数行テキストの折り返し描画
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const lines = [];
  const paragraphs = text.split('\n');

  for (const para of paragraphs) {
    let currentLine = '';
    for (let i = 0; i < para.length; i++) {
      const char = para[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
        if (lines.length >= maxLines) break;
      } else {
        currentLine = testLine;
      }
    }
    if (lines.length >= maxLines) break;
    lines.push(currentLine);
  }

  const renderedLines = lines.slice(0, maxLines);
  for (let i = 0; i < renderedLines.length; i++) {
    ctx.fillText(renderedLines[i], x, y + i * lineHeight);
  }
  return renderedLines.length * lineHeight;
}

/**
 * 画像を非同期ロード
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * メイン描画エンジン
 * @param {HTMLCanvasElement} canvas 
 * @param {Object} state 
 * @param {ScheduleManager} scheduleManager 
 * @param {Object} options 
 */
export async function renderExportCanvas(canvas, state, scheduleManager, options = {}) {
  const resKey = options.resolution || state.exportSettings?.resolution || '2560x1440';
  const res = RESOLUTIONS[resKey] || RESOLUTIONS['2560x1440'];
  const width = res.width;
  const height = res.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 基準解像度 (2560x1440) に対するスケール
  const scale = width / BASE_W;
  ctx.save();
  ctx.scale(scale, scale);

  const themeKey = state.theme || 'midnight';
  const palette = THEME_PALETTES[themeKey] || THEME_PALETTES.midnight;

  // 1. 全体背景描画
  const bgGrad = ctx.createLinearGradient(0, 0, BASE_W, BASE_H);
  bgGrad.addColorStop(0, palette.bg);
  bgGrad.addColorStop(1, palette.panel);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  // 背景装飾（洗練されたグリッドパターン）
  ctx.strokeStyle = palette.gridLine;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  const gridSize = 80;
  for (let gx = 0; gx < BASE_W; gx += gridSize) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, BASE_H);
    ctx.stroke();
  }
  for (let gy = 0; gy < BASE_H; gy += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(BASE_W, gy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // 外枠アクセントボーダー
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  roundRect(ctx, 24, 24, BASE_W - 48, BASE_H - 48, 20);
  ctx.stroke();

  // 2. ヘッダー描画 (Y: 48〜170)
  const headerX = 60;
  const headerY = 56;
  const headerW = BASE_W - 120;
  const headerH = 120;

  const summaryBadgeW = 200;
  const summaryBadgeX = headerX + headerW - summaryBadgeW - 20;

  // ヘッダー背景パネル
  roundRect(ctx, headerX, headerY, headerW, headerH, 16);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 左側：オリジナルロゴアイコン
  const logoX = headerX + 24;
  const logoY = headerY + 18;
  const logoSize = 84;

  // ロゴ外周円
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 - 4, 0, Math.PI * 2);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // ロゴ内部の幾何学砂時計・時計モチーフ
  const lcx = logoX + logoSize / 2;
  const lcy = logoY + logoSize / 2;
  ctx.fillStyle = palette.accent;
  // 上三角形
  ctx.beginPath();
  ctx.moveTo(lcx - 18, lcy - 22);
  ctx.lineTo(lcx + 18, lcy - 22);
  ctx.lineTo(lcx, lcy - 2);
  ctx.closePath();
  ctx.fill();
  // 下三角形
  ctx.beginPath();
  ctx.moveTo(lcx - 18, lcy + 22);
  ctx.lineTo(lcx + 18, lcy + 22);
  ctx.lineTo(lcx, lcy + 2);
  ctx.closePath();
  ctx.fill();
  // 中央光点
  ctx.beginPath();
  ctx.arc(lcx, lcy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // ブランドタイトル
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 40px "Montserrat", "Inter", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.fillText('TimeLess', logoX + logoSize + 20, headerY + 54);

  // サブタイトルバッジ
  ctx.font = '600 13px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.accent;
  ctx.fillText('PLAYER AVAILABILITY SCHEDULE', logoX + logoSize + 22, headerY + 84);

  // 垂直ディバイダー
  ctx.beginPath();
  ctx.moveTo(logoX + logoSize + 270, headerY + 24);
  ctx.lineTo(logoX + logoSize + 270, headerY + headerH - 24);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ユーザープロフィールエリア
  const profX = logoX + logoSize + 300;
  const avatarSize = 76;
  const avatarCenterX = profX + avatarSize / 2;
  const avatarCenterY = headerY + headerH / 2;

  // アバター描画
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  let avatarImg = null;
  if (state.profile?.avatar) {
    avatarImg = await loadImage(state.profile.avatar);
  }

  if (avatarImg) {
    const zoom = state.profile.avatarZoom || 1;
    const offX = state.profile.avatarX || 0;
    const offY = state.profile.avatarY || 0;
    const minDim = Math.min(avatarImg.width, avatarImg.height);
    const sw = minDim / zoom;
    const sh = minDim / zoom;
    const sx = Math.max(0, Math.min(avatarImg.width - sw, (avatarImg.width - sw) / 2 + offX));
    const sy = Math.max(0, Math.min(avatarImg.height - sh, (avatarImg.height - sh) / 2 + offY));
    ctx.drawImage(avatarImg, sx, sy, sw, sh, profX, avatarCenterY - avatarSize / 2, avatarSize, avatarSize);
  } else {
    // デフォルトアバター
    ctx.fillStyle = palette.panelSub;
    ctx.fillRect(profX, avatarCenterY - avatarSize / 2, avatarSize, avatarSize);
    ctx.fillStyle = palette.textMuted;
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY - 8, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY + 36, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // アバター外周リング
  ctx.beginPath();
  ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ユーザー名 & タイムゾーン
  const nameX = profX + avatarSize + 22;
  const playerName = (state.profile?.name && state.profile.name.trim()) ? state.profile.name.trim() : 'Player';
  const tzText = state.profile?.timezone || 'JST (UTC+9)';

  // タイムゾーンバッジの横幅を先に計算
  ctx.font = '600 14px "Inter", sans-serif';
  const tzMetrics = ctx.measureText(tzText);
  const tzBadgeW = tzMetrics.width + 24;
  const tzBadgeH = 28;

  // ユーザー名のフォントを設定して幅を正確に計測（長い場合は自動縮小して被りを防止）
  let nameFontSize = 32;
  ctx.font = `800 ${nameFontSize}px "Inter", "Noto Sans JP", sans-serif`;
  let nameMetrics = ctx.measureText(playerName);
  const maxAvailableNameWidth = summaryBadgeX - nameX - tzBadgeW - 40;

  while (nameMetrics.width > maxAvailableNameWidth && nameFontSize > 18) {
    nameFontSize -= 2;
    ctx.font = `800 ${nameFontSize}px "Inter", "Noto Sans JP", sans-serif`;
    nameMetrics = ctx.measureText(playerName);
  }

  // ユーザー名の描画
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.text;
  ctx.fillText(playerName, nameX, headerY + 54);

  // タイムゾーンバッジの描画（ユーザー名の末尾から適正な余白を空けて配置）
  const tzBadgeX = nameX + nameMetrics.width + 18;
  const tzBadgeY = headerY + 28;

  roundRect(ctx, tzBadgeX, tzBadgeY, tzBadgeW, tzBadgeH, 14);
  ctx.fillStyle = palette.panelSub;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '600 14px "Inter", sans-serif';
  ctx.fillStyle = palette.accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tzText, tzBadgeX + tzBadgeW / 2, tzBadgeY + tzBadgeH / 2);

  // プロフィールコメント（任意）
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (state.profile?.comment && state.profile.comment.trim()) {
    ctx.font = '500 16px "Noto Sans JP", sans-serif';
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(state.profile.comment.trim(), nameX, headerY + 90);
  }

  // ヘッダー右端：総合アクティブ時間サマリーバッジ
  const totalHours = scheduleManager.getTotalHours();
  roundRect(ctx, summaryBadgeX, headerY + 20, summaryBadgeW, headerH - 40, 12);
  ctx.fillStyle = palette.panelSub;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '600 12px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('週間合計活動可能', summaryBadgeX + summaryBadgeW / 2, headerY + 48);

  ctx.font = '800 28px "Inter", sans-serif';
  ctx.fillStyle = palette.accent;
  ctx.fillText(`${totalHours} 時間`, summaryBadgeX + summaryBadgeW / 2, headerY + 84);

  // 3. メインエリア配置
  // メインエリア高さ: 1040px (Y: 196〜1236)
  const mainY = 196;
  const mainH = 1040;

  // 左側：週間スケジュールテーブル (幅 1600px)
  const schedW = 1600;
  const schedX = headerX;
  drawScheduleTable(ctx, schedX, mainY, schedW, mainH, scheduleManager, palette);

  // 右側：円グラフ早見表 ＆ 環境・フォーマット表示 (幅 800px)
  const rightX = schedX + schedW + 40;
  const rightW = headerW - schedW - 40;
  await drawRightPanel(ctx, rightX, mainY, rightW, mainH, state, scheduleManager, palette);

  // 4. フッターエリア (Y: 1256〜1396)
  const footerY = 1256;
  const footerH = 130;
  drawFooter(ctx, headerX, footerY, headerW, footerH, state, scheduleManager, palette);

  ctx.restore();
}

/**
 * 週間スケジュールテーブル描画
 */
function drawScheduleTable(ctx, x, y, width, height, scheduleManager, palette) {
  // コンテナカード
  roundRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const pad = 20;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  // テーブル寸法
  const timeColW = 68; // 時間軸ラベル列
  const dayColW = (innerW - timeColW) / 7;
  const headerRowH = 50; // 曜日ヘッダー
  const gridH = innerH - headerRowH;
  const rowH = gridH / 24; // 24時間各行の高さ (約38px)

  // 曜日ヘッダー描画
  for (let d = 0; d < 7; d++) {
    const dx = innerX + timeColW + d * dayColW;
    const isWeekend = d >= 5;

    roundRect(ctx, dx + 3, innerY, dayColW - 6, headerRowH - 6, 8);
    ctx.fillStyle = isWeekend ? (palette.panelSub) : palette.panelSub;
    ctx.fill();
    ctx.strokeStyle = isWeekend ? palette.accent : palette.border;
    ctx.lineWidth = isWeekend ? 1.5 : 1;
    ctx.stroke();

    // 曜日テキスト
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Inter", "Noto Sans JP", sans-serif';
    ctx.fillStyle = isWeekend ? palette.accent : palette.text;
    ctx.fillText(`${DAY_NAMES[d]} (${DAY_NAMES_EN[d]})`, dx + dayColW / 2, innerY + 18);

    // 曜日の活動可能時間バッジ
    const dayH = scheduleManager.getDayHours(d);
    ctx.font = '600 11px "Inter", sans-serif';
    ctx.fillStyle = dayH > 0 ? palette.accent : palette.textMuted;
    ctx.fillText(`${dayH}h`, dx + dayColW / 2, innerY + 34);
  }

  // 時間軸ラベル & グリッドセル描画
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let h = 0; h < 24; h++) {
    const ry = innerY + headerRowH + h * rowH;

    // 6時間ごとのガイドハイライト背景
    if (h % 6 === 0) {
      ctx.fillStyle = palette.gridLine;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(innerX, ry, innerW, rowH);
      ctx.globalAlpha = 1.0;
    }

    // 時間ラベル
    ctx.font = '600 12px "Inter", sans-serif';
    ctx.fillStyle = (h % 6 === 0) ? palette.accent : palette.textMuted;
    ctx.fillText(`${h}:00`, innerX + timeColW - 12, ry + rowH / 2);

    // 7日分のセル
    for (let d = 0; d < 7; d++) {
      const cx = innerX + timeColW + d * dayColW;
      const isSelected = scheduleManager.getCell(d, h);

      const cellPad = 2.5;
      const cellX = cx + cellPad;
      const cellY = ry + cellPad;
      const cellW = dayColW - cellPad * 2;
      const cellH = rowH - cellPad * 2;

      roundRect(ctx, cellX, cellY, cellW, cellH, 4);

      if (isSelected) {
        ctx.fillStyle = palette.accent;
        ctx.fill();

        // アクティブセル内の視覚的アクセント（微小バー）
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.35;
        roundRect(ctx, cellX + 4, cellY + cellH / 2 - 1, cellW - 8, 2, 1);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = palette.track;
        ctx.fill();
        ctx.strokeStyle = palette.gridLine;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // グリッド下端の24:00ラインラベル
  ctx.font = '600 11px "Inter", sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('24:00', innerX + timeColW - 12, innerY + headerRowH + gridH);
}

/**
 * 右側パネル（平日/休日円グラフ ＆ プレイ環境・フォーマット）
 */
async function drawRightPanel(ctx, x, y, width, height, state, scheduleManager, palette) {
  // コンテナカード
  roundRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const pad = 24;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = width - pad * 2;

  // 上部：24時間リンググラフ早見表 (高さ約 480px)
  const chartsH = 460;
  roundRect(ctx, innerX, innerY, innerW, chartsH, 12);
  ctx.fillStyle = palette.panelSub;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // グラフカードタイトル
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 18px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.fillText('24時間 活動帯早見表', innerX + 18, innerY + 34);

  ctx.font = '500 12px "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('色の濃さ＝選択日数率 (平日: /5日, 休日: /2日)', innerX + 18, innerY + 54);

  // 2つのリンググラフ（平日 & 休日）
  const chartY = innerY + 230;
  const chartR = 125;
  const innerR = 75;

  // 1. 平日グラフ
  const weekdayData = scheduleManager.getHourlyRatios([0, 1, 2, 3, 4]);
  const weekdayAvg = scheduleManager.getAverageWeekdayHours();
  const c1x = innerX + innerW * 0.28;

  drawDonutChart(ctx, {
    cx: c1x,
    cy: chartY,
    radius: chartR,
    innerRadius: innerR,
    title: 'WEEKDAYS',
    subtitle: '月〜金',
    data: weekdayData,
    averageHours: `${weekdayAvg}h`,
    palette,
    scale: 1.15
  });

  // 2. 休日グラフ
  const weekendData = scheduleManager.getHourlyRatios([5, 6]);
  const weekendAvg = scheduleManager.getAverageWeekendHours();
  const c2x = innerX + innerW * 0.72;

  drawDonutChart(ctx, {
    cx: c2x,
    cy: chartY,
    radius: chartR,
    innerRadius: innerR,
    title: 'WEEKENDS',
    subtitle: '土・日',
    data: weekendData,
    averageHours: `${weekendAvg}h`,
    palette,
    scale: 1.15
  });

  // グラフ凡例バー（下部）
  const legendY = innerY + chartsH - 36;
  ctx.textAlign = 'left';
  ctx.font = '500 12px "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('選択率: 0%', innerX + 30, legendY + 12);

  // グラデーションバー
  const barX = innerX + 110;
  const barW = innerW - 220;
  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, palette.track);
  grad.addColorStop(1, palette.accent);
  ctx.fillStyle = grad;
  roundRect(ctx, barX, legendY + 2, barW, 12, 6);
  ctx.fill();

  ctx.fillText('100%', barX + barW + 12, legendY + 12);

  // 下部：対応プレイ環境・フォーマット表示 (Y: innerY + chartsH + 20)
  const envY = innerY + chartsH + 20;
  const envH = height - (chartsH + pad * 2 + 20);

  roundRect(ctx, innerX, envY, innerW, envH, 12);
  ctx.fillStyle = palette.panelSub;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  // タイトル
  ctx.textAlign = 'left';
  ctx.font = '700 18px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.fillText('対応プレイ環境 & フォーマット', innerX + 18, envY + 34);

  // 環境カードリスト
  const envKeys = ['paper', 'arena', 'mo'];
  const envList = envKeys.map(k => state.environments?.[k]).filter(Boolean);

  let curEnvY = envY + 54;
  const envItemH = 135;

  envList.forEach((env) => {
    const isEnabled = env.enabled;
    const cardX = innerX + 14;
    const cardW = innerW - 28;

    roundRect(ctx, cardX, curEnvY, cardW, envItemH, 8);
    ctx.fillStyle = isEnabled ? palette.panel : palette.track;
    ctx.fill();
    ctx.strokeStyle = isEnabled ? palette.accent : palette.gridLine;
    ctx.lineWidth = isEnabled ? 1.5 : 1;
    ctx.stroke();

    // 環境アイコン & ラベル
    ctx.textAlign = 'left';
    ctx.font = '700 16px "Inter", "Noto Sans JP", sans-serif';
    ctx.fillStyle = isEnabled ? palette.accent : palette.textMuted;

    // 独自抽象アイコン描画
    drawEnvIcon(ctx, cardX + 14, curEnvY + 14, env.id, isEnabled, palette);

    ctx.fillText(env.name, cardX + 46, curEnvY + 28);

    // 状態インジケーター
    ctx.font = '600 11px "Inter", sans-serif';
    const statusText = isEnabled ? 'READY' : 'OFF';
    const stMetrics = ctx.measureText(statusText);
    roundRect(ctx, cardX + cardW - stMetrics.width - 24, curEnvY + 12, stMetrics.width + 16, 20, 10);
    ctx.fillStyle = isEnabled ? `rgba(${palette.accentRgb}, 0.2)` : palette.panelSub;
    ctx.fill();
    ctx.fillStyle = isEnabled ? palette.accent : palette.textMuted;
    ctx.fillText(statusText, cardX + cardW - stMetrics.width - 16, curEnvY + 26);

    // フォーマットタグ一覧
    const formats = (env.formats || []).concat(state.customFormats || []);
    let tagX = cardX + 14;
    let tagY = curEnvY + 52;
    const tagH = 26;

    if (formats.length === 0 || !isEnabled) {
      ctx.font = '400 13px "Noto Sans JP", sans-serif';
      ctx.fillStyle = palette.textMuted;
      ctx.fillText(isEnabled ? 'フォーマット未設定' : '現在非対応', tagX, tagY + 16);
    } else {
      formats.slice(0, 7).forEach(fmt => {
        ctx.font = '600 12px "Inter", sans-serif';
        const tw = ctx.measureText(fmt).width + 18;
        if (tagX + tw > cardX + cardW - 14) {
          tagX = cardX + 14;
          tagY += tagH + 8;
        }

        roundRect(ctx, tagX, tagY, tw, tagH, 6);
        ctx.fillStyle = isEnabled ? palette.panelSub : palette.gridLine;
        ctx.fill();
        ctx.strokeStyle = isEnabled ? palette.border : 'transparent';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isEnabled ? palette.text : palette.textMuted;
        ctx.fillText(fmt, tagX + 9, tagY + 18);

        tagX += tw + 8;
      });
    }

    curEnvY += envItemH + 12;
  });
}

/**
 * 環境ごとの抽象アイコン描画 (MTG等の著作権ロゴは一切使用せず自作幾何学アイコン)
 */
function drawEnvIcon(ctx, x, y, id, isEnabled, palette) {
  ctx.save();
  ctx.strokeStyle = isEnabled ? palette.accent : palette.textMuted;
  ctx.fillStyle = isEnabled ? palette.accent : palette.textMuted;
  ctx.lineWidth = 1.5;

  if (id === 'paper') {
    // 抽象カード2枚の重ね合わせ
    roundRect(ctx, x + 2, y + 2, 12, 16, 2);
    ctx.stroke();
    roundRect(ctx, x + 6, y + 6, 12, 16, 2);
    ctx.stroke();
  } else if (id === 'arena') {
    // デジタルディスプレイ / モニター
    roundRect(ctx, x + 2, y + 2, 18, 14, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 11, y + 16);
    ctx.lineTo(x + 11, y + 20);
    ctx.moveTo(x + 6, y + 20);
    ctx.lineTo(x + 16, y + 20);
    ctx.stroke();
  } else {
    // Magic Online: グリッド・ノードアイコン
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 16, y + 6, 3, 0, Math.PI * 2);
    ctx.arc(x + 11, y + 16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + 16, y + 6);
    ctx.lineTo(x + 11, y + 16);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * フッターエリア（補足メモ ＆ 補助ラベル・カラー凡例）
 */
function drawFooter(ctx, x, y, width, height, state, scheduleManager, palette) {
  const hasNotes = Boolean(state.notes && state.notes.trim());

  // メモ欄（存在する場合）
  if (hasNotes) {
    const memoW = width - 420;
    roundRect(ctx, x, y, memoW, height, 12);
    ctx.fillStyle = palette.panel;
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // メモヘッダー
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 14px "Inter", "Noto Sans JP", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText('■ 補足メモ / コメント', x + 20, y + 28);

    // メモ本文（複数行対応・自動折り返し）
    ctx.font = '500 15px "Noto Sans JP", sans-serif';
    ctx.fillStyle = palette.text;
    wrapText(ctx, state.notes.trim(), x + 20, y + 54, memoW - 40, 24, 3);
  }

  // 右側：カラー凡例 ＆ クレジット
  const infoX = hasNotes ? (x + width - 390) : x;
  const infoW = hasNotes ? 390 : width;

  roundRect(ctx, infoX, y, infoW, height, 12);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 凡例表示
  const pad = 24;
  const legendY = y + 34;

  // アクティブ凡例
  roundRect(ctx, infoX + pad, legendY - 12, 18, 18, 4);
  ctx.fillStyle = palette.accent;
  ctx.fill();

  ctx.textAlign = 'left';
  ctx.font = '600 13px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.text;
  ctx.fillText('対戦可能 (Available)', infoX + pad + 26, legendY + 2);

  // 非アクティブ凡例
  roundRect(ctx, infoX + pad + 180, legendY - 12, 18, 18, 4);
  ctx.fillStyle = palette.track;
  ctx.fill();
  ctx.strokeStyle = palette.gridLine;
  ctx.stroke();

  ctx.fillStyle = palette.textMuted;
  ctx.fillText('対戦不可', infoX + pad + 206, legendY + 2);

  // 最多活動時間帯
  const peak = scheduleManager.getPeakHourRange();
  ctx.font = '500 13px "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.textMuted;
  const peakLabel = peak.allEmpty ? '未設定' : `${peak.label} (最多)`;
  ctx.fillText(`ピーク時間帯: ${peakLabel}`, infoX + pad, y + 74);

  // クレジット & 非公式表記
  ctx.font = '500 11px "Inter", "Noto Sans JP", sans-serif';
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('TimeLess • Independent & Unofficial Match Availability Generator', infoX + pad, y + 106);
}

