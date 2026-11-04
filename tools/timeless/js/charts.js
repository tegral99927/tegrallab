/**
 * TimeLess - charts.js
 * 24時間円グラフ（平日/休日リングチャート）描画
 */

export const THEME_PALETTES = {
  midnight: {
    bg: '#0B1020',
    panel: '#151C30',
    panelSub: '#1E2742',
    border: '#29334B',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    accent: '#38BDF8',
    accentRgb: '56, 189, 248',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    track: '#1B243B',
    gridLine: '#202C45'
  },
  emerald: {
    bg: '#071712',
    panel: '#0D261E',
    panelSub: '#14352B',
    border: '#1E4A3C',
    text: '#ECFDF5',
    textMuted: '#6EE7B7',
    accent: '#10B981',
    accentRgb: '16, 185, 129',
    accentGlow: 'rgba(16, 185, 129, 0.35)',
    track: '#123127',
    gridLine: '#183F32'
  },
  violet: {
    bg: '#110C22',
    panel: '#1A1336',
    panelSub: '#251C4A',
    border: '#3C2F6E',
    text: '#F5F3FF',
    textMuted: '#C4B5FD',
    accent: '#A855F7',
    accentRgb: '168, 85, 247',
    accentGlow: 'rgba(168, 85, 247, 0.35)',
    track: '#201842',
    gridLine: '#2D225C'
  },
  monochrome: {
    bg: '#111114',
    panel: '#1A1A1F',
    panelSub: '#26262E',
    border: '#3B3B47',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    accent: '#E2E8F0',
    accentRgb: '226, 232, 240',
    accentGlow: 'rgba(226, 232, 240, 0.3)',
    track: '#22222A',
    gridLine: '#2E2E38'
  },
  light: {
    bg: '#F8FAFC',
    panel: '#FFFFFF',
    panelSub: '#F1F5F9',
    border: '#CBD5E1',
    text: '#0F172A',
    textMuted: '#64748B',
    accent: '#0284C7',
    accentRgb: '2, 132, 199',
    accentGlow: 'rgba(2, 132, 199, 0.25)',
    track: '#E2E8F0',
    gridLine: '#E2E8F0'
  }
};

/**
 * 24時間リンググラフを描画
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Object} options
 */
export function drawDonutChart(ctx, {
  cx,
  cy,
  radius,
  innerRadius,
  title,
  subtitle,
  data, // 24要素の配列: [{ hour, ratio, activeDays, totalDays }]
  averageHours,
  palette,
  scale = 1
}) {
  ctx.save();

  // 1. 背景円リング（トラック）
  const hourAngle = (Math.PI * 2) / 24;
  const startOffset = -Math.PI / 2; // 0:00が真上

  // トラック全体の描画
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.arc(cx, cy, innerRadius, Math.PI * 2, 0, true);
  ctx.fillStyle = palette.track;
  ctx.fill();

  // 2. 24時間セグメントの描画
  const gap = 0.025; // セグメント間のわずかな隙間（ラジアン）
  for (let h = 0; h < 24; h++) {
    const item = data[h];
    const aStart = startOffset + h * hourAngle + gap / 2;
    const aEnd = startOffset + (h + 1) * hourAngle - gap / 2;

    if (item.ratio > 0) {
      // 選択率に応じた不透明度 (0.3〜1.0)
      const alpha = 0.25 + item.ratio * 0.75;
      
      // 比率に応じた外径の微小スケーリングで視覚的厚みを強調
      const currentRadius = innerRadius + (radius - innerRadius) * (0.6 + 0.4 * item.ratio);

      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, aStart, aEnd, false);
      ctx.arc(cx, cy, innerRadius, aEnd, aStart, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(${palette.accentRgb}, ${alpha.toFixed(2)})`;
      ctx.fill();

      // 100%の場合はわずかなハイライト縁取り
      if (item.ratio === 1) {
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1 * scale;
        ctx.stroke();
      }
    } else {
      // 未選択時のわずかな仕切り線
      ctx.beginPath();
      ctx.arc(cx, cy, radius, aStart, aEnd, false);
      ctx.arc(cx, cy, innerRadius, aEnd, aStart, true);
      ctx.closePath();
      ctx.strokeStyle = palette.gridLine;
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();
    }
  }

  // 3. 6時間ごとの主目盛り線と数字ラベル (0, 6, 12, 18)
  const majorHours = [0, 6, 12, 18];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  majorHours.forEach(h => {
    const angle = startOffset + h * hourAngle;
    
    // 目盛り線
    const tickInner = innerRadius - 4 * scale;
    const tickOuter = radius + 6 * scale;
    const x1 = cx + Math.cos(angle) * tickInner;
    const y1 = cy + Math.sin(angle) * tickInner;
    const x2 = cx + Math.cos(angle) * tickOuter;
    const y2 = cy + Math.sin(angle) * tickOuter;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // 時刻ラベル
    const labelDist = radius + 18 * scale;
    const lx = cx + Math.cos(angle) * labelDist;
    const ly = cy + Math.sin(angle) * labelDist;

    ctx.font = `700 ${Math.max(11, Math.round(13 * scale))}px "Inter", "Segoe UI", sans-serif`;
    ctx.fillStyle = palette.text;
    ctx.fillText(`${h}:00`, lx, ly);
  });

  // 4. リング中央のテキスト情報
  // タイトル
  ctx.font = `800 ${Math.max(13, Math.round(15 * scale))}px "Inter", "Noto Sans JP", sans-serif`;
  ctx.fillStyle = palette.accent;
  ctx.fillText(title, cx, cy - 28 * scale);

  // サブタイトル（英語または補足）
  if (subtitle) {
    ctx.font = `700 ${Math.max(10, Math.round(12 * scale))}px "Noto Sans JP", sans-serif`;
    ctx.fillStyle = palette.textMuted;
    ctx.fillText(subtitle, cx, cy - 14 * scale);
  }

  // 1日平均時間 (大きく太く表示)
  ctx.font = `900 ${Math.max(24, Math.round(32 * scale))}px "Inter", sans-serif`;
  ctx.fillStyle = palette.text;
  ctx.fillText(averageHours, cx, cy + 9 * scale);

  // 単位
  ctx.font = `700 ${Math.max(10, Math.round(11 * scale))}px "Noto Sans JP", sans-serif`;
  ctx.fillStyle = palette.textMuted;
  ctx.fillText('平均時間 / 日', cx, cy + 28 * scale);

  ctx.restore();
}

/**
 * HTML canvas要素への描画（高DPI対応）
 */
export function renderUIChart(canvasEl, data, averageHours, title, subtitle, themeKey = 'midnight') {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvasEl.clientWidth || 220;
  const height = canvasEl.clientHeight || 220;

  canvasEl.width = width * dpr;
  canvasEl.height = height * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const palette = THEME_PALETTES[themeKey] || THEME_PALETTES.midnight;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const innerRadius = radius * 0.62;

  drawDonutChart(ctx, {
    cx,
    cy,
    radius,
    innerRadius,
    title,
    subtitle,
    data,
    averageHours: String(averageHours) + 'h',
    palette,
    scale: 1
  });
}

