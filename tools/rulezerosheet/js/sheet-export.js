/**
 * sheet-export.js - PNGエクスポート、クリップボードコピー、Web Share、印刷
 */

import { renderSheetToCanvas } from "./sheet-renderer.js";

/**
 * シートをPNG画像としてダウンロード
 * @param {object} deck
 * @param {string} lang
 */
export async function downloadSheetPNG(deck, lang = "ja") {
  const previewCanvas = document.getElementById("sheet-preview-canvas");
  const canvas = previewCanvas || await renderSheetToCanvas(deck, lang);
  const deckName = (deck.deckName || "rule0_sheet").replace(/[/\\?%*:|"<>]/g, "_");
  const filename = `${deckName}_bracket${deck.bracket}.png`;

  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/**
 * シート画像をクリップボードにコピー (Clipboard API)
 * @param {object} deck
 * @param {string} lang
 * @returns {Promise<boolean>} 成功したかどうか
 */
export async function copySheetToClipboard(deck, lang = "ja") {
  if (!navigator.clipboard || !window.ClipboardItem) {
    return false;
  }

  try {
    const previewCanvas = document.getElementById("sheet-preview-canvas");
    const canvas = previewCanvas || await renderSheetToCanvas(deck, lang);
    return new Promise(resolve => {
      canvas.toBlob(async blob => {
        if (!blob) {
          resolve(false);
          return;
        }
        try {
          const item = new ClipboardItem({ "image/png": blob });
          await navigator.clipboard.write([item]);
          resolve(true);
        } catch (err) {
          console.warn("Clipboard write failed:", err);
          resolve(false);
        }
      }, "image/png");
    });
  } catch (err) {
    console.warn("copySheetToClipboard error:", err);
    return false;
  }
}

/**
 * Web Share API による共有
 * @param {object} deck
 * @param {string} lang
 */
export async function shareSheetWeb(deck, lang = "ja") {
  const previewCanvas = document.getElementById("sheet-preview-canvas");
  const canvas = previewCanvas || await renderSheetToCanvas(deck, lang);
  return new Promise(resolve => {
    canvas.toBlob(async blob => {
      if (!blob) {
        resolve(false);
        return;
      }
      const filename = `commander_rule0_sheet.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: deck.deckName || "Commander Rule 0 Sheet",
            text: `Commander: ${(deck.commanders || []).map(c => c.name).join(" & ")} | Bracket ${deck.bracket}`,
            files: [file]
          });
          resolve(true);
        } catch (e) {
          if (e.name !== "AbortError") {
            console.warn("Web share error:", e);
          }
          resolve(false);
        }
      } else {
        // フォールバック: PNGダウンロード
        downloadSheetPNG(deck, lang);
        resolve(true);
      }
    }, "image/png");
  });
}

/**
 * シート印刷 (print.css使用)
 */
export function printSheet() {
  window.print();
}
