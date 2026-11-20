/**
 * sheet-renderer.js - シートのHTMLプレビュー更新およびCanvas (1600x900) 描画
 */

import { APP_CONFIG } from "./config.js";
import { i18n } from "./i18n.js";

// 画像のプリロード＆キャッシュ用
const imageCache = new Map();

/**
 * 画像を非同期ロード（CORS対応、失敗時はnull）
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
 * プレビューDOMの更新
 * @param {HTMLElement} container
 * @param {object} deck
 * @param {string} lang
 */
export function updatePreviewDOM(container, deck, lang = "ja") {
  if (!container) return;

  const bracket = APP_CONFIG.brackets.find(b => b.id === deck.bracket) || APP_CONFIG.brackets[1];
  const isDark = deck.sheetTheme !== "light";
  const isQuick = deck.sheetType !== "detailed";

  // 統率者画像HTML
  let commanderImgsHtml = "";
  if (deck.commanders && deck.commanders.length > 0) {
    const validCmds = deck.commanders.filter(c => c.name || c.imageUrl);
    if (validCmds.length === 0) {
      commanderImgsHtml = `
        <div class="sheet-card-placeholder">
          <div class="placeholder-icon">🂠</div>
          <div class="placeholder-text">${lang === "ja" ? "コマンダーを選択してください" : "Select a Commander"}</div>
        </div>
      `;
    } else {
      commanderImgsHtml = validCmds.map((c, i) => {
        const displayName = lang === "ja" ? (c.printedName || c.name) : (c.name || c.printedName);
        if (c.imageUrl) {
          return `
            <div class="sheet-card-img-wrap ${validCmds.length > 1 ? 'is-partner' : ''}">
              <img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(displayName)}" class="sheet-commander-img" crossorigin="anonymous" />
            </div>
          `;
        } else {
          return `
            <div class="sheet-card-placeholder ${validCmds.length > 1 ? 'is-partner' : ''}">
              <div class="placeholder-icon">⚔️</div>
              <div class="placeholder-text">${escapeHtml(displayName || "Commander")}</div>
            </div>
          `;
        }
      }).join("");
    }
  }

  // コマンダー名
  const cmdNames = (deck.commanders || [])
    .map(c => lang === "ja" ? (c.printedName || c.name) : (c.name || c.printedName))
    .filter(Boolean)
    .join(" & ") || (lang === "ja" ? "コマンダー未設定" : "No Commander Set");

  // デッキ名
  const deckTitle = deck.deckName || (lang === "ja" ? "コマンダールールゼロシート" : "Commander Rule 0 Sheet");

  // ブラケット名
  const bracketName = lang === "ja" ? bracket.nameJa : bracket.nameEn;
  const bracketDesc = lang === "ja" ? bracket.descriptionJa : bracket.descriptionEn;

  // 特徴タグ
  const featuresHtml = (deck.deckFeatures || []).map(f => `
    <span class="sheet-tag feature-tag">${escapeHtml(f)}</span>
  `).join("");

  // 対戦希望タグ
  const playPrefsHtml = (deck.playPreferences || []).map(p => `
    <span class="sheet-tag pref-tag">${escapeHtml(p)}</span>
  `).join("");

  // 避けたい展開タグ
  const avoidPrefsHtml = (deck.avoidPreferences || []).map(a => `
    <span class="sheet-tag avoid-tag">⚠️ ${escapeHtml(a)}</span>
  `).join("");

  // 詳細モード用の項目
  let detailedSectionHtml = "";
  if (!isQuick) {
    detailedSectionHtml = `
      <div class="sheet-detail-grid">
        ${deck.winConditions ? `
          <div class="detail-item">
            <span class="detail-label">🎯 ${lang === "ja" ? "主な勝ち筋" : "Win Condition"}:</span>
            <span class="detail-value">${escapeHtml(deck.winConditions)}</span>
          </div>
        ` : ""}
        ${deck.comboDescription ? `
          <div class="detail-item">
            <span class="detail-label">⚡ ${lang === "ja" ? "コンボ・成立条件" : "Combos"}:</span>
            <span class="detail-value">${escapeHtml(deck.comboDescription)}</span>
          </div>
        ` : ""}
        ${deck.approxWinTurn ? `
          <div class="detail-item">
            <span class="detail-label">⏱️ ${lang === "ja" ? "想定決着ターン" : "Decisive Turn"}:</span>
            <span class="detail-value">${escapeHtml(deck.approxWinTurn)}</span>
          </div>
        ` : ""}
      </div>
    `;
  }

  // 警告表示
  const isOverGcLimit = bracket.maxGameChangers < 90 && deck.gameChangerCount > bracket.maxGameChangers;
  const gcWarningHtml = isOverGcLimit ? `
    <div class="sheet-gc-warning">
      ⚠️ Bracket ${bracket.id} allows up to ${bracket.maxGameChangers} Game Changers (${deck.gameChangerCount} registered)
    </div>
  ` : "";

  // HTML組み立て
  container.className = `sheet-preview-card theme-${deck.sheetTheme || 'dark'} ${isQuick ? 'mode-quick' : 'mode-detailed'}`;
  container.innerHTML = `
    <div class="sheet-inner">
      <!-- 左ペイン: カード画像 -->
      <div class="sheet-left-col">
        <div class="sheet-cards-container">
          ${commanderImgsHtml}
        </div>
      </div>

      <!-- 右ペイン: 情報 -->
      <div class="sheet-right-col">
        <!-- ヘッダー -->
        <div class="sheet-header">
          <div class="sheet-deck-title">${escapeHtml(deckTitle)}</div>
          <div class="sheet-commander-names">${escapeHtml(cmdNames)}</div>
          ${deck.commanderDescription ? `<div class="sheet-cmd-desc">${escapeHtml(deck.commanderDescription)}</div>` : ""}
        </div>

        <!-- パワーステータス (ブラケット & ゲームチェンジャー) -->
        <div class="sheet-power-row">
          <div class="sheet-bracket-box" style="--bracket-color: ${bracket.badgeColor}; --bracket-bg: ${bracket.badgeBg}; --bracket-border: ${bracket.borderColor};">
            <div class="bracket-num-badge">BRACKET ${bracket.id}</div>
            <div class="bracket-name-title">${escapeHtml(bracketName)}</div>
            <div class="bracket-turn-estimate">${escapeHtml(bracket.expectedTurn)}</div>
          </div>

          <div class="sheet-gc-box">
            <div class="gc-header-label">GAME CHANGERS</div>
            <div class="gc-number-count">${deck.gameChangerCount || 0}</div>
            <div class="gc-source-tag">${deck.gameChangerCountSource === 'automatic' ? 'Deck Scanned' : 'Self-Reported'}</div>
          </div>
        </div>
        ${gcWarningHtml}

        <!-- デッキの特徴 -->
        <div class="sheet-section">
          <div class="sheet-section-title">${lang === "ja" ? "デッキの特徴" : "Deck Features"}</div>
          <div class="sheet-tags-wrap">
            ${featuresHtml || `<span class="empty-hint">${lang === "ja" ? "特徴未選択" : "No features specified"}</span>`}
          </div>
        </div>

        <!-- 詳細モード追加情報 -->
        ${detailedSectionHtml}

        <!-- 対戦希望・マナー -->
        <div class="sheet-section pref-section">
          <div class="sheet-section-title">${lang === "ja" ? "対戦前の希望・相談事項" : "Pre-Game Expectations & Preferences"}</div>
          <div class="sheet-tags-wrap">
            ${playPrefsHtml}
            ${avoidPrefsHtml}
          </div>
        </div>

        ${deck.additionalNotes ? `
          <div class="sheet-notes-box">
            <span class="notes-icon">💬</span>
            <span class="notes-text">${escapeHtml(deck.additionalNotes)}</span>
          </div>
        ` : ""}

        <!-- フッター -->
        <div class="sheet-footer">
          <span class="footer-app-name">Commander Rule Zero Sheet Maker</span>
          <span class="footer-brand">Tegral Lab • tegrallab.com</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * 1600x900の高解像度PNG画像をCanvas APIで描画
 * @param {object} deck
 * @param {string} lang
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderSheetToCanvas(deck, lang = "ja") {
  const width = APP_CONFIG.sheetWidth;
  const height = APP_CONFIG.sheetHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const bracket = APP_CONFIG.brackets.find(b => b.id === deck.bracket) || APP_CONFIG.brackets[1];
  const isDark = deck.sheetTheme !== "light";
  const isQuick = deck.sheetType !== "detailed";

  // 背景色・グラデーション
  if (isDark) {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#0b0f17");
    bgGradient.addColorStop(0.5, "#111827");
    bgGradient.addColorStop(1, "#0d131f");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 微細なグリッド・アクセントライン
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
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

  // 外枠
  ctx.strokeStyle = isDark ? "rgba(212, 175, 55, 0.4)" : "#cbd5e1";
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // 内側の細枠
  ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // --- 左側: 統率者カード画像描画 (プレビューと同じく大迫力で配置) ---
  const leftX = 50;
  const leftY = 50;
  const cardH = 780;
  const cardW = 560; // MTGカード標準比率 (約 1 : 1.39)

  const validCmds = (deck.commanders || []).filter(c => c && (c.name || c.imageUrl));
  if (validCmds.length === 0) {
    // プレースホルダー枠
    drawCardPlaceholder(ctx, leftX + 10, leftY + 10, cardW, cardH, lang === "ja" ? "コマンダーカード" : "Commander Card", isDark);
  } else if (validCmds.length === 1) {
    const cmd = validCmds[0];
    const img = cmd.imageUrl ? await loadImageAsync(cmd.imageUrl) : null;
    if (img) {
      drawRoundedImage(ctx, img, leftX + 10, leftY + 10, cardW, cardH, 20);
    } else {
      drawCardPlaceholder(ctx, leftX + 10, leftY + 10, cardW, cardH, cmd.printedName || cmd.name || "Commander", isDark);
    }
  } else {
    // 2枚コマンダー（共闘・パートナー）: プレビューに合わせて大きく重なり描画
    const pCardW = 440;
    const pCardH = 614;
    // 1枚目 (上・左寄)
    const img1 = validCmds[0].imageUrl ? await loadImageAsync(validCmds[0].imageUrl) : null;
    if (img1) {
      drawRoundedImage(ctx, img1, leftX, leftY + 10, pCardW, pCardH, 16);
    } else {
      drawCardPlaceholder(ctx, leftX, leftY + 10, pCardW, pCardH, validCmds[0].name || "Partner 1", isDark);
    }
    // 2枚目 (下・右寄)
    const img2 = validCmds[1].imageUrl ? await loadImageAsync(validCmds[1].imageUrl) : null;
    if (img2) {
      drawRoundedImage(ctx, img2, leftX + 150, leftY + 170, pCardW, pCardH, 16);
    } else {
      drawCardPlaceholder(ctx, leftX + 150, leftY + 170, pCardW, pCardH, validCmds[1].name || "Partner 2", isDark);
    }
  }

  // --- 右側: 情報エリア (プレビューと同じ大きく見やすいタイポグラフィ) ---
  const rightX = 660;
  let currY = 65;
  const contentWidth = width - rightX - 55;

  // 1. デッキ名 & コマンダー名
  const deckTitle = deck.deckName || (lang === "ja" ? "コマンダールールゼロシート" : "Commander Rule 0 Sheet");
  ctx.fillStyle = isDark ? "#fbbf24" : "#b45309";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(deckTitle.toUpperCase(), rightX, currY);
  currY += 50;

  const cmdNames = (deck.commanders || [])
    .map(c => lang === "ja" ? (c.printedName || c.name) : (c.name || c.printedName))
    .filter(Boolean)
    .join(" & ") || (lang === "ja" ? "コマンダー未設定" : "No Commander Set");

  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = "900 48px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(truncateText(ctx, cmdNames, contentWidth), rightX, currY);
  currY += 40;

  if (deck.commanderDescription) {
    ctx.fillStyle = isDark ? "#94a3b8" : "#475569";
    ctx.font = "italic 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    currY = wrapText(ctx, `“${deck.commanderDescription}”`, rightX, currY, contentWidth, 34, 2);
    currY += 16;
  } else {
    currY += 14;
  }

  // 2. ブラケット & ゲームチェンジャー バナー (特大サイズで明瞭)
  const bannerY = currY;
  const bannerH = 130;
  const bracketW = 490;
  const gcW = contentWidth - bracketW - 20;

  // Bracket Box
  drawRoundedRect(ctx, rightX, bannerY, bracketW, bannerH, 14, bracket.badgeBg, bracket.borderColor, 3);

  // Bracket Number Badge
  ctx.fillStyle = bracket.badgeColor;
  ctx.font = "900 64px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`BRACKET ${bracket.id}`, rightX + 24, bannerY + 68);

  // Bracket Name & Details
  const bracketName = lang === "ja" ? bracket.nameJa : bracket.nameEn;
  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(bracketName, rightX + 24, bannerY + 108);

  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`• ${bracket.expectedTurn}`, rightX + 260, bannerY + 108);

  // Game Changers Box
  const gcX = rightX + bracketW + 20;
  drawRoundedRect(ctx, gcX, bannerY, gcW, bannerH, 14, isDark ? "rgba(255,255,255,0.05)" : "#ffffff", isDark ? "rgba(255,255,255,0.2)" : "#cbd5e1", 2);

  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("GAME CHANGERS", gcX + 22, bannerY + 40);

  ctx.fillStyle = isDark ? "#38bdf8" : "#0284c7";
  ctx.font = "900 70px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`${deck.gameChangerCount || 0}`, gcX + 22, bannerY + 108);

  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const gcSourceText = deck.gameChangerCountSource === "automatic" ? "Deck Scanned" : "Self-Reported";
  ctx.fillText(gcSourceText, gcX + 115, bannerY + 102);

  currY = bannerY + bannerH + 34;

  // 3. 特徴タグ
  ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(lang === "ja" ? "デッキの特徴 (Deck Features)" : "Deck Features", rightX, currY);
  currY += 32;

  const features = deck.deckFeatures || [];
  currY = drawTagList(ctx, features, rightX, currY, contentWidth, isDark ? "rgba(56, 189, 248, 0.15)" : "#e0f2fe", isDark ? "#38bdf8" : "#0369a1", isDark ? "#38bdf8" : "#0284c7", 2);
  currY += 28;

  // 4. 詳細項目 (詳細モードのみ)
  if (!isQuick) {
    if (deck.winConditions) {
      drawTextPair(ctx, rightX, currY, "🎯 " + (lang === "ja" ? "主な勝ち筋:" : "Win Condition:"), deck.winConditions, contentWidth, isDark);
      currY += 44;
    }
    if (deck.comboDescription) {
      drawTextPair(ctx, rightX, currY, "⚡ " + (lang === "ja" ? "コンボ・成立条件:" : "Combos:"), deck.comboDescription, contentWidth, isDark);
      currY += 44;
    }
    if (deck.approxWinTurn) {
      drawTextPair(ctx, rightX, currY, "⏱️ " + (lang === "ja" ? "想定決着ターン:" : "Target Turn:"), deck.approxWinTurn, contentWidth, isDark);
      currY += 44;
    }
    currY += 10;
  }

  // 5. 対戦希望・マナー
  ctx.fillStyle = isDark ? "#e2e8f0" : "#1e293b";
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(lang === "ja" ? "対戦前の希望・相談事項 (Pre-Game Expectations)" : "Pre-Game Expectations & Preferences", rightX, currY);
  currY += 32;

  const playPrefs = deck.playPreferences || [];
  const avoidPrefs = (deck.avoidPreferences || []).map(a => `⚠️ ${a}`);
  const combinedPrefs = [...playPrefs, ...avoidPrefs];
  currY = drawTagList(ctx, combinedPrefs, rightX, currY, contentWidth, isDark ? "rgba(16, 185, 129, 0.15)" : "#dcfce7", isDark ? "#4ade80" : "#15803d", isDark ? "#4ade80" : "#16a34a", 2);

  // メモ
  if (deck.additionalNotes) {
    currY += 26;
    drawRoundedRect(ctx, rightX, currY, contentWidth, 54, 10, isDark ? "rgba(255,255,255,0.04)" : "#f8fafc", isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0", 1);
    ctx.fillStyle = isDark ? "#cbd5e1" : "#334155";
    ctx.font = "20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`💬 ${truncateText(ctx, deck.additionalNotes, contentWidth - 40)}`, rightX + 18, currY + 34);
  }

  // フッター (下部に整列)
  const footerY = height - 45;
  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Commander Rule Zero Sheet Maker • Powered by Scryfall API", rightX, footerY);

  ctx.textAlign = "right";
  ctx.fillText("Tegral Lab • tegrallab.com", width - 55, footerY);
  ctx.textAlign = "left";

  return canvas;
}

// ヘルパー描画関数

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

function drawRoundedImage(ctx, img, x, y, width, height, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, width, height);
  ctx.restore();

  // カード枠のシャドウ・境界線
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();
  ctx.restore();
}

function drawCardPlaceholder(ctx, x, y, width, height, title, isDark) {
  drawRoundedRect(ctx, x, y, width, height, 16, isDark ? "#1e293b" : "#e2e8f0", isDark ? "#475569" : "#cbd5e1", 2);
  ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
}

function drawTagList(ctx, tags, x, y, maxWidth, bg, textCol, borderCol, maxRows = 2) {
  if (!tags || tags.length === 0) return y;

  let curX = x;
  let curY = y;
  const paddingH = 16;
  const tagH = 42;
  let rowIndex = 0;

  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const textWidth = ctx.measureText(tag).width;
    const tagW = textWidth + paddingH * 2;

    if (curX + tagW > x + maxWidth) {
      rowIndex++;
      if (rowIndex >= maxRows) {
        // 残り件数を小さなバッジで描画して打ち止め
        const remaining = tags.length - i;
        if (remaining > 0) {
          const moreText = `+${remaining}`;
          const moreW = ctx.measureText(moreText).width + 20;
          drawRoundedRect(ctx, curX, curY, moreW, tagH, 8, bg, borderCol, 1);
          ctx.fillStyle = textCol;
          ctx.fillText(moreText, curX + 10, curY + 27);
        }
        break;
      }
      curX = x;
      curY += tagH + 10;
    }

    drawRoundedRect(ctx, curX, curY, tagW, tagH, 8, bg, borderCol, 1);
    ctx.fillStyle = textCol;
    ctx.fillText(tag, curX + paddingH, curY + 27);

    curX += tagW + 10;
  }

  return curY + tagH;
}

function drawTextPair(ctx, x, y, label, text, maxWidth, isDark) {
  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(label, x, y);

  const labelW = ctx.measureText(label).width + 12;
  ctx.fillStyle = isDark ? "#ffffff" : "#0f172a";
  ctx.font = "600 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(truncateText(ctx, text, maxWidth - labelW), x + labelW, y);
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
        // 残りを省略
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
