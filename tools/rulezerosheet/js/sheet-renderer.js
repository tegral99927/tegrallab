/**
 * sheet-renderer.js - リアルタイムプレビューおよび1600x900高解像度PNG画像描画エンジン
 * プレビューと出力画像が100%完全一致するようCanvas直接描画方式を採用
 */

import { APP_CONFIG } from "./config.js";
import { i18n } from "./i18n.js";

// 画像プリロード＆キャッシュ用
const imageCache = new Map();
let latestRenderToken = 0;

/**
 * 画像を非同期ロード（CORS対応、キャッシュ利用）
 * @param {string} url
 * @returns {Promise<HTMLImageElement|null>}
 */
export function loadImageAsync(url) {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url));
  }

  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      console.warn("Failed to load image for canvas:", url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * タグの注意レベル・カテゴリ判定
 * @param {string} tagText
 * @returns {"severe-caution" | "caution" | "avoid" | "pref" | "feature"}
 */
export function getTagCategory(tagText) {
  if (!tagText) return "feature";
  const text = String(tagText).trim();
  const lower = text.toLowerCase();

  // 1. 避けたい展開（⚠️またはキーワード）
  if (text.startsWith("⚠️") || lower.includes("避けたい") || lower.includes("avoid")) {
    return "avoid";
  }

  // 2. 最重要注意項目（無限コンボ、2枚コンボ、土地破壊、スタックス、追加ターンなど）
  if (
    lower.includes("無限") ||
    lower.includes("infinite") ||
    lower.includes("2枚コンボ") ||
    lower.includes("2-card") ||
    lower.includes("土地破壊") ||
    lower.includes("mld") ||
    lower.includes("スタックス") ||
    lower.includes("stax") ||
    lower.includes("ロック") ||
    lower.includes("lock") ||
    lower.includes("追加ターン") ||
    lower.includes("extra turn")
  ) {
    return "severe-caution";
  }

  // 3. 注意・事前共有項目（コンボ、プロキシ、全体除去、打ち消し、サーチなど）
  if (
    lower.includes("コンボ") ||
    lower.includes("combo") ||
    lower.includes("プロキシ") ||
    lower.includes("proxy") ||
    lower.includes("全体除去") ||
    lower.includes("board wipe") ||
    lower.includes("打ち消し") ||
    lower.includes("counter") ||
    lower.includes("サーチ") ||
    lower.includes("tutor")
  ) {
    return "caution";
  }

  // 4. ポジティブな対戦希望
  if (
    lower.includes("歓迎") ||
    lower.includes("welcome") ||
    lower.includes("ゆっくり") ||
    lower.includes("chill") ||
    lower.includes("ok") ||
    lower.includes("調整中") ||
    lower.includes("testing")
  ) {
    return "pref";
  }

  return "feature";
}

/**
 * カテゴリごとの配色取得
 */
export function getTagColors(category, isDark) {
  switch (category) {
    case "severe-caution":
      return {
        bg: isDark ? "rgba(239, 68, 68, 0.24)" : "#fee2e2",
        border: isDark ? "rgba(239, 68, 68, 0.75)" : "#ef4444",
        text: isDark ? "#f87171" : "#b91c1c"
      };
    case "avoid":
      return {
        bg: isDark ? "rgba(244, 63, 94, 0.24)" : "#ffe4e6",
        border: isDark ? "rgba(244, 63, 94, 0.75)" : "#f43f5e",
        text: isDark ? "#fb7185" : "#be123c"
      };
    case "caution":
      return {
        bg: isDark ? "rgba(245, 158, 11, 0.24)" : "#fef3c7",
        border: isDark ? "rgba(245, 158, 11, 0.75)" : "#f59e0b",
        text: isDark ? "#fbbf24" : "#b45309"
      };
    case "pref":
      return {
        bg: isDark ? "rgba(16, 185, 129, 0.20)" : "#dcfce7",
        border: isDark ? "rgba(16, 185, 129, 0.65)" : "#16a34a",
        text: isDark ? "#4ade80" : "#15803d"
      };
    case "feature":
    default:
      return {
        bg: isDark ? "rgba(56, 189, 248, 0.16)" : "#e0f2fe",
        border: isDark ? "rgba(56, 189, 248, 0.50)" : "#0284c7",
        text: isDark ? "#38bdf8" : "#0369a1"
      };
  }
}

/**
 * プロキシ状態の表示文字列取得
 */
export function getProxyStatusText(status, lang = "ja") {
  if (status === "some") {
    return lang === "ja" ? "一部プロキシあり" : "Some Proxies";
  } else if (status === "full") {
    return lang === "ja" ? "フルプロキシ" : "Full Proxy";
  } else if (status === "none") {
    return lang === "ja" ? "なし（すべて本物）" : "None (100% Genuine)";
  }
  return "";
}

/**
 * プレビュー更新
 * Canvasによる直接描画を行い、Webプレビューとエクスポート画像の「完全な一致」を保証
 * @param {HTMLElement} container
 * @param {object} deck
 * @param {string} lang
 */
export async function updatePreviewDOM(container, deck, lang = "ja") {
  if (!container) return;

  let canvas = container.querySelector("#sheet-preview-canvas");
  if (!canvas) {
    container.innerHTML = "";
    canvas = document.createElement("canvas");
    canvas.id = "sheet-preview-canvas";
    canvas.width = APP_CONFIG.sheetWidth;
    canvas.height = APP_CONFIG.sheetHeight;
    container.appendChild(canvas);
  }

  // 1600x900 Canvasを更新描画
  await renderSheetToCanvas(deck, lang, canvas);
}

/**
 * 1600x900の高解像度PNG画像をCanvas APIで描画
 * 余白のバランスを自動最適化し、文字が詰まりすぎずスペースを最大限美しく活用
 * @param {object} deck
 * @param {string} lang
 * @param {HTMLCanvasElement|null} targetCanvas
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderSheetToCanvas(deck, lang = "ja", targetCanvas = null) {
  const currentToken = ++latestRenderToken;
  const width = APP_CONFIG.sheetWidth;
  const height = APP_CONFIG.sheetHeight;

  const canvas = targetCanvas || document.createElement("canvas");
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const ctx = canvas.getContext("2d");

  const bracket = APP_CONFIG.brackets.find(b => b.id === deck.bracket) || APP_CONFIG.brackets[1];
  const isDark = deck.sheetTheme !== "light";
  const isQuick = deck.sheetType !== "detailed";

  // 1. 背景描画
  if (isDark) {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#0b0f17");
    bgGradient.addColorStop(0.5, "#111827");
    bgGradient.addColorStop(1, "#0d131f");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 高級感のある繊細なグリッドアクセントライン
    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  } else {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#f8fafc");
    bgGradient.addColorStop(1, "#edf2f7");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 外枠（MTGゴールドフレーム）
  ctx.strokeStyle = isDark ? "rgba(212, 175, 55, 0.45)" : "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // 内側の細枠
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // 2. 左側: コマンダーカード画像描画 (MTG縦横比 1 : 1.3968)
  const leftX = 55;
  const leftY = 65;
  const cardH = 760;
  const cardW = 544;

  const validCmds = (deck.commanders || []).filter(c => c && (c.name || c.imageUrl));

  // 画像非同期ロード
  let img1 = null;
  let img2 = null;
  if (validCmds.length === 1 && validCmds[0].imageUrl) {
    img1 = await loadImageAsync(validCmds[0].imageUrl);
  } else if (validCmds.length > 1) {
    if (validCmds[0]?.imageUrl) img1 = await loadImageAsync(validCmds[0].imageUrl);
    if (validCmds[1]?.imageUrl) img2 = await loadImageAsync(validCmds[1].imageUrl);
  }

  // 非同期ロード中にさらに新しい描画リクエストが発生した場合は中断
  if (targetCanvas && currentToken !== latestRenderToken) {
    return canvas;
  }

  if (validCmds.length === 0) {
    drawCardPlaceholder(ctx, leftX, leftY, cardW, cardH, lang === "ja" ? "コマンダーカード" : "Commander Card", isDark);
  } else if (validCmds.length === 1) {
    const cmd = validCmds[0];
    if (img1) {
      drawShadowedImage(ctx, img1, leftX, leftY, cardW, cardH, 18);
    } else {
      drawCardPlaceholder(ctx, leftX, leftY, cardW, cardH, cmd.printedName || cmd.name || "Commander", isDark);
    }
  } else {
    // 2枚コマンダー（共闘・パートナー）: 本格的な重なり表示
    const pCardW = 430;
    const pCardH = 600;

    if (img1) {
      drawShadowedImage(ctx, img1, leftX, leftY + 10, pCardW, pCardH, 16);
    } else {
      drawCardPlaceholder(ctx, leftX, leftY + 10, pCardW, pCardH, validCmds[0].name || "Partner 1", isDark);
    }

    if (img2) {
      drawShadowedImage(ctx, img2, leftX + 115, leftY + 150, pCardW, pCardH, 16);
    } else {
      drawCardPlaceholder(ctx, leftX + 115, leftY + 150, pCardW, pCardH, validCmds[1].name || "Partner 2", isDark);
    }
  }

  // 3. 右側: 情報エリア (バランスの良い垂直レイアウト計算)
  const rightX = 645;
  const contentWidth = width - rightX - 55; // 約900px
  let currY = 58;

  // --- ヘッダー ---
  const deckTitle = deck.deckName || (lang === "ja" ? "コマンダールールゼロシート" : "Commander Rule 0 Sheet");
  ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(deckTitle.toUpperCase(), rightX, currY);
  currY += 44; // デッキ名とコマンダーカード名の間にゆとりのある行間を確保

  const cmdNames = validCmds
    .map(c => lang === "ja" ? (c.printedName || c.name) : (c.name || c.printedName))
    .filter(Boolean)
    .join(" & ") || (lang === "ja" ? "コマンダー未設定" : "No Commander Set");

  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  // コマンダー名が長い場合は自動調整
  ctx.font = "900 40px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  if (ctx.measureText(cmdNames).width > contentWidth) {
    ctx.font = "900 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  }
  ctx.fillText(truncateText(ctx, cmdNames, contentWidth), rightX, currY);
  currY += 46;

  if (deck.commanderDescription) {
    ctx.fillStyle = isDark ? "#94a3b8" : "#475569";
    ctx.font = "italic 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    currY = wrapText(ctx, `“${deck.commanderDescription}”`, rightX, currY, contentWidth, 28, 2);
    currY += 16;
  } else {
    currY += 10;
  }

  // --- パワーバナー (ブラケット & ゲームチェンジャー) ---
  const bannerY = currY;
  const bannerH = 118;
  const bracketW = 490;
  const gcW = contentWidth - bracketW - 20;

  // Bracket Box
  drawRoundedRect(ctx, rightX, bannerY, bracketW, bannerH, 14, bracket.badgeBg, bracket.borderColor, 2.5);

  ctx.fillStyle = bracket.badgeColor;
  ctx.font = "900 56px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`BRACKET ${bracket.id}`, rightX + 24, bannerY + 60);

  const bracketName = lang === "ja" ? bracket.nameJa : bracket.nameEn;
  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(bracketName, rightX + 24, bannerY + 100);

  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`• ${bracket.expectedTurn}`, rightX + 230, bannerY + 100);

  // Game Changers Box
  const gcX = rightX + bracketW + 20;
  const isOverGcLimit = bracket.maxGameChangers < 90 && deck.gameChangerCount > bracket.maxGameChangers;

  if (isOverGcLimit) {
    drawRoundedRect(ctx, gcX, bannerY, gcW, bannerH, 14, isDark ? "rgba(239, 68, 68, 0.20)" : "#fee2e2", "#ef4444", 2.5);
    ctx.fillStyle = "#f87171";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("⚠️ OVER BRACKET LIMIT", gcX + 20, bannerY + 36);
    ctx.fillStyle = "#ef4444";
  } else {
    drawRoundedRect(ctx, gcX, bannerY, gcW, bannerH, 14, isDark ? "rgba(255,255,255,0.05)" : "#ffffff", isDark ? "rgba(255,255,255,0.18)" : "#cbd5e1", 2);
    ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
    ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("GAME CHANGERS", gcX + 20, bannerY + 36);
    ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
  }

  ctx.font = "900 62px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`${deck.gameChangerCount || 0}`, gcX + 20, bannerY + 100);

  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const gcSourceText = deck.gameChangerCountSource === "automatic" ? "Deck Scanned" : "Self-Reported";
  ctx.fillText(gcSourceText, gcX + 105, bannerY + 95);

  currY = bannerY + bannerH;

  // --- コンテンツ量に応じた適応型余白（スペースを美しく均等配分） ---
  const features = deck.deckFeatures || [];
  const playPrefs = deck.playPreferences || [];
  const avoidPrefs = (deck.avoidPreferences || []).map(a => `⚠️ ${a.replace(/^⚠️\s*/, '')}`);
  const combinedPrefs = [...playPrefs, ...avoidPrefs];

  const hasDetailedInfo = Boolean(
    deck.winConditions ||
    deck.comboDescription ||
    deck.approxWinTurn ||
    (deck.proxyStatus && deck.proxyStatus !== "none")
  );
  const showDetailed = (!isQuick || hasDetailedInfo);

  // タグ設定 (快適で見やすいゆとりのあるサイズ)
  const tagConfig = {
    font: "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    height: 38,
    paddingH: 14,
    gapX: 8,
    gapY: 8,
    radius: 7
  };

  // 高さの予測計算
  const featuresMeasure = measureTagRows(ctx, features, contentWidth, tagConfig);
  const prefsMeasure = measureTagRows(ctx, combinedPrefs, contentWidth, tagConfig);

  let numDetailRows = 0;
  if (showDetailed) {
    if (deck.winConditions) numDetailRows++;
    if (deck.comboDescription) numDetailRows++;
    if (deck.approxWinTurn) numDetailRows++;
    if (deck.proxyStatus && deck.proxyStatus !== "none") numDetailRows++;
  }

  const contentEstimatedH =
    (28 + featuresMeasure.height) +
    (showDetailed && numDetailRows > 0 ? (numDetailRows * 34 + 8) : 0) +
    (28 + prefsMeasure.height) +
    (deck.additionalNotes ? 52 : 0);

  const availableHeight = 840 - currY;
  const remainingSpace = Math.max(0, availableHeight - contentEstimatedH);

  // 余白の均等配分（最小20px、最大38px）
  const sectionCount = 2 + (showDetailed && numDetailRows > 0 ? 1 : 0) + (deck.additionalNotes ? 1 : 0);
  const sectionGap = Math.max(18, Math.min(36, Math.floor(remainingSpace / (sectionCount + 1))));

  currY += sectionGap;

  // --- 1. 特徴タグ（全件表示、省略なし） ---
  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(lang === "ja" ? "デッキの特徴 (Deck Features)" : "Deck Features", rightX, currY);
  currY += 26;

  currY = drawTagList(ctx, features, rightX, currY, contentWidth, tagConfig, isDark);
  currY += sectionGap;

  // --- 2. 詳細情報（入力値がある場合は確実に表示） ---
  if (showDetailed && numDetailRows > 0) {
    const detailLabelFont = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const detailValueFont = "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const detailStep = 34;

    if (deck.winConditions) {
      drawTextPair(ctx, rightX, currY, "🎯 " + (lang === "ja" ? "主な勝ち筋:" : "Win Condition:"), deck.winConditions, contentWidth, isDark, "#38bdf8", detailValueFont, detailLabelFont);
      currY += detailStep;
    }
    if (deck.comboDescription) {
      drawTextPair(ctx, rightX, currY, "⚡ " + (lang === "ja" ? "コンボ・成立条件:" : "Combos:"), deck.comboDescription, contentWidth, isDark, "#fbbf24", detailValueFont, detailLabelFont);
      currY += detailStep;
    }
    if (deck.approxWinTurn) {
      drawTextPair(ctx, rightX, currY, "⏱️ " + (lang === "ja" ? "想定決着ターン:" : "Target Turn:"), deck.approxWinTurn, contentWidth, isDark, isDark ? "#94a3b8" : "#64748b", detailValueFont, detailLabelFont);
      currY += detailStep;
    }
    if (deck.proxyStatus && deck.proxyStatus !== "none") {
      drawTextPair(ctx, rightX, currY, "🃏 " + (lang === "ja" ? "プロキシ:" : "Proxies:"), getProxyStatusText(deck.proxyStatus, lang), contentWidth, isDark, "#c084fc", detailValueFont, detailLabelFont);
      currY += detailStep;
    }

    currY += sectionGap - 10;
  }

  // --- 3. 対戦希望・マナー（全件表示） ---
  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(lang === "ja" ? "対戦前の希望・相談事項 (Pre-Game Expectations)" : "Pre-Game Expectations & Preferences", rightX, currY);
  currY += 26;

  currY = drawTagList(ctx, combinedPrefs, rightX, currY, contentWidth, tagConfig, isDark);

  // --- 4. 自由メモ ---
  if (deck.additionalNotes) {
    currY += sectionGap;
    const notesBoxH = 46;
    drawRoundedRect(ctx, rightX, currY, contentWidth, notesBoxH, 8, isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0", 1);
    ctx.fillStyle = isDark ? "#cbd5e1" : "#334155";
    ctx.font = "17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`💬 ${truncateText(ctx, deck.additionalNotes, contentWidth - 40)}`, rightX + 16, currY + 29);
  }

  // --- フッター ---
  const footerY = height - 42;
  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Commander Rule Zero Sheet Maker • Powered by Scryfall API", rightX, footerY);

  ctx.textAlign = "right";
  ctx.fillText("Tegral Lab • tegrallab.com", width - 55, footerY);
  ctx.textAlign = "left";

  return canvas;
}

// ---------------- ヘルパー描画関数 ----------------

function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke, strokeWidth = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
  ctx.restore();
}

function drawShadowedImage(ctx, img, x, y, width, height, radius) {
  ctx.save();

  // カードシャドウ
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 8;

  // 画像クリップ＆描画
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = "#000";
  ctx.fill(); // シャドウ発生用ベース

  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();

  // カード境界線
  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();

  ctx.restore();
}

function drawCardPlaceholder(ctx, x, y, width, height, title, isDark) {
  drawRoundedRect(ctx, x, y, width, height, 18, isDark ? "#1e293b" : "#e2e8f0", isDark ? "#475569" : "#cbd5e1", 2);
  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
}

/**
 * タグの高さを事前計測
 */
function measureTagRows(ctx, tags, maxWidth, tagConfig) {
  if (!tags || tags.length === 0) return { rows: 0, height: 0 };
  let curX = 0;
  let rows = 1;
  const { height: tagH, paddingH, gapX, gapY, font } = tagConfig;
  ctx.font = font;

  for (let i = 0; i < tags.length; i++) {
    const rawTag = tags[i];
    const category = getTagCategory(rawTag);
    let displayTag = rawTag;
    if (category === "severe-caution" && !rawTag.startsWith("⚠️") && !rawTag.startsWith("⚡")) {
      displayTag = `⚠️ ${rawTag}`;
    } else if (category === "caution" && !rawTag.startsWith("⚡") && !rawTag.startsWith("⚠️")) {
      displayTag = `⚡ ${rawTag}`;
    }
    const textWidth = ctx.measureText(displayTag).width;
    const tagW = Math.min(textWidth + paddingH * 2, maxWidth);

    if (curX + tagW > maxWidth && curX > 0) {
      curX = 0;
      rows++;
    }
    curX += tagW + gapX;
  }
  return { rows, height: rows * tagH + (rows - 1) * gapY };
}

/**
 * タグ一覧を省略せずにすべて描画する
 * 行を折り返し、注意・警告タグは配色を変えて描画
 */
function drawTagList(ctx, tags, x, y, maxWidth, tagConfig, isDark) {
  if (!tags || tags.length === 0) return y;

  let curX = x;
  let curY = y;
  const { height: tagH, paddingH, gapX, gapY, radius, font } = tagConfig;

  ctx.font = font;

  for (let i = 0; i < tags.length; i++) {
    const rawTag = tags[i];
    const category = getTagCategory(rawTag);
    const colors = getTagColors(category, isDark);

    let displayTag = rawTag;
    if (category === "severe-caution" && !rawTag.startsWith("⚠️") && !rawTag.startsWith("⚡")) {
      displayTag = `⚠️ ${rawTag}`;
    } else if (category === "caution" && !rawTag.startsWith("⚡") && !rawTag.startsWith("⚠️")) {
      displayTag = `⚡ ${rawTag}`;
    }

    const textWidth = ctx.measureText(displayTag).width;
    const tagW = Math.min(textWidth + paddingH * 2, maxWidth);

    if (curX + tagW > x + maxWidth && curX > x) {
      curX = x;
      curY += tagH + gapY;
    }

    drawRoundedRect(ctx, curX, curY, tagW, tagH, radius, colors.bg, colors.border, 1.5);
    ctx.fillStyle = colors.text;
    ctx.font = font;
    ctx.fillText(truncateText(ctx, displayTag, tagW - paddingH * 1.5), curX + paddingH, curY + tagH * 0.68);

    curX += tagW + gapX;
  }

  return curY + tagH;
}

function drawTextPair(ctx, x, y, label, text, maxWidth, isDark, labelColor, font, labelFont) {
  ctx.fillStyle = labelColor || (isDark ? "#94a3b8" : "#64748b");
  ctx.font = labelFont || "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(label, x, y);

  const labelW = ctx.measureText(label).width + 12;
  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = font || "600 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const availW = maxWidth - labelW;
  if (ctx.measureText(text).width <= availW) {
    ctx.fillText(text, x + labelW, y);
  } else {
    // 少し長い場合はフォントを微縮小して可能な限りそのまま描画
    ctx.font = font.replace(/\d+(\.\d+)?px/, (m) => `${Math.max(13, parseFloat(m) * 0.9)}px`);
    ctx.fillText(truncateText(ctx, text, availW), x + labelW, y);
  }
}

function truncateText(ctx, text, maxWidth) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "...").width > maxWidth) {
    t = t.substring(0, t.length - 1);
  }
  return t + "...";
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = text.split("");
  let line = "";
  let linesCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n];
      y += lineHeight;
      linesCount++;
      if (linesCount >= maxLines - 1) {
        ctx.fillText(truncateText(ctx, text.substring(n), maxWidth), x, y);
        return y + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
  return y + lineHeight;
}
