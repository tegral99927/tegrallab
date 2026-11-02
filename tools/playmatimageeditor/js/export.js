/**
 * PlaymatImageEditor - js/export.js
 * 高解像度レンダリング、DPIメタデータ注入、画像書き出しモジュール
 */

/**
 * 高解像度エクスポート管理クラス
 */
export class ExportManager {
  constructor(editor) {
    this.editor = editor;
  }

  /**
   * 推定ファイルサイズを計算 (バイト)
   */
  estimateFileSize(width, height, format = 'png', jpegQuality = 0.92) {
    const pixels = width * height;
    if (format === 'png') {
      // 圧縮PNGはおおよそ 1ピクセルあたり 0.8〜2.5バイト (平均1.5バイト)
      return Math.round(pixels * 1.5);
    } else {
      // JPEGは品質に応じて 0.15〜0.6バイト/ピクセル
      const factor = 0.1 + (jpegQuality * 0.45);
      return Math.round(pixels * factor);
    }
  }

  /**
   * 人間に読みやすいバイトサイズ文字列
   */
  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * 画像書き出しの実行
   * @param {Object} options 
   *   - format: 'png' | 'jpeg'
   *   - quality: 0.1 - 1.0 (jpegのみ)
   *   - scale: 1.0 (原寸), 0.5 など
   *   - filename: 保存名
   *   - onProgress: 進捗コールバック (percent, message)
   */
  async exportImage(options = {}) {
    const {
      format = 'png',
      quality = 0.95,
      scale = 1.0,
      filename = 'playmat_artwork',
      onProgress = () => {}
    } = options;

    const baseWidth = this.editor.canvasConfig.width;
    const baseHeight = this.editor.canvasConfig.height;
    const targetW = Math.round(baseWidth * scale);
    const targetH = Math.round(baseHeight * scale);
    const dpi = Math.round(this.editor.canvasConfig.dpi * scale);

    onProgress(10, '出力キャンバスを初期化中...');

    // ブラウザのCanvas最大サイズチェック
    const MAX_DIMENSION = 16384; // 主要モダンブラウザの上限目安
    if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
      throw new Error(`出力解像度がブラウザの描画限界（最大${MAX_DIMENSION}px）を超えています。書き出し倍率を下げるかピクセル数を調整してください。`);
    }

    // オフスクリーンCanvas作成
    const offCanvas = document.createElement('canvas');
    offCanvas.width = targetW;
    offCanvas.height = targetH;
    const ctx = offCanvas.getContext('2d', { alpha: format === 'png' });

    if (!ctx) {
      throw new Error('Canvas 2Dコンテキストの生成に失敗しました（メモリ不足の可能性があります）。');
    }

    onProgress(30, 'レイヤーを高精細レンダリング中...');

    // 背景処理 (JPEGの場合は強制的に白背景または設定色)
    if (format === 'jpeg' || !this.editor.canvasConfig.transparentBg) {
      ctx.fillStyle = this.editor.canvasConfig.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // レイヤー描画（最背面から最前面へ）
    // ガイド線や選択ハンドルは含めない
    const layers = this.editor.layers;
    const total = layers.length;

    for (let i = 0; i < total; i++) {
      const layer = layers[i];
      if (layer.visible && layer.type !== 'background') {
        layer.render(ctx, scale, true);
      }
      const pct = 30 + Math.round((i + 1) / total * 40);
      onProgress(pct, `レイヤー [${layer.name}] を処理中...`);
    }

    onProgress(75, '画像データをエンコード中...');

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((resolve, reject) => {
      offCanvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('画像のエンコードに失敗しました。'));
      }, mimeType, quality);
    });

    onProgress(85, 'DPIメタデータを注入中...');

    // DPIメタデータの挿入
    let finalBlob = blob;
    try {
      const arrayBuffer = await blob.arrayBuffer();
      let modifiedBuffer = null;
      if (format === 'png') {
        modifiedBuffer = insertPngDpi(arrayBuffer, dpi);
      } else if (format === 'jpeg') {
        modifiedBuffer = insertJpegDpi(arrayBuffer, dpi);
      }
      if (modifiedBuffer) {
        finalBlob = new Blob([modifiedBuffer], { type: mimeType });
      }
    } catch (e) {
      console.warn('DPIメタデータ注入をスキップしました:', e);
    }

    onProgress(95, 'ダウンロードを準備中...');

    const extension = format === 'jpeg' ? '.jpg' : '.png';
    const finalFilename = filename.toLowerCase().endsWith(extension) ? filename : `${filename}${extension}`;

    // ダウンロードトリガー
    const downloadUrl = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    onProgress(100, '書き出し完了');

    return {
      success: true,
      filename: finalFilename,
      width: targetW,
      height: targetH,
      dpi: dpi,
      size: finalBlob.size
    };
  }
}

/**
 * PNGバイナリに pHYs (DPI) チャンクを挿入する
 * @param {ArrayBuffer} arrayBuffer 
 * @param {number} dpi 
 */
function insertPngDpi(arrayBuffer, dpi) {
  const bytes = new Uint8Array(arrayBuffer);
  // PNGシグネチャ確認 (89 50 4E 47 0D 0A 1A 0A)
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47) {
    return arrayBuffer;
  }

  // 1メートルあたりのピクセル数: 1 inch = 0.0254 m
  const pixelsPerMeter = Math.round(dpi / 0.0254);

  // pHYsチャンク構造:
  // 長さ: 9バイト (4バイト) -> 00 00 00 09
  // タイプ: "pHYs" (4バイト) -> 70 48 59 73
  // X: 4バイト (Big Endian)
  // Y: 4バイト (Big Endian)
  // Unit: 1バイト (1 = meter)
  // CRC: 4バイト (Big Endian)
  const physChunk = new Uint8Array(12 + 9);
  const view = new DataView(physChunk.buffer);

  // Length
  view.setUint32(0, 9);
  // Type: pHYs
  physChunk[4] = 0x70;
  physChunk[5] = 0x48;
  physChunk[6] = 0x59;
  physChunk[7] = 0x73;
  // Data: X, Y, Unit
  view.setUint32(8, pixelsPerMeter);
  view.setUint32(12, pixelsPerMeter);
  physChunk[16] = 1; // meter

  // CRC計算 (Type + Data)
  const crc = crc32(physChunk.subarray(4, 17));
  view.setUint32(17, crc);

  // IHDRチャンクの直後 (オフセット 8 + 4(len) + 4(IHDR) + 13(data) + 4(crc) = 33バイト目) に挿入
  const ihdrEndOffset = 33;
  const result = new Uint8Array(bytes.length + physChunk.length);
  result.set(bytes.subarray(0, ihdrEndOffset), 0);
  result.set(physChunk, ihdrEndOffset);
  result.set(bytes.subarray(ihdrEndOffset), ihdrEndOffset + physChunk.length);

  return result.buffer;
}

/**
 * JPEGバイナリに JFIF 解像度単位 (DPI) を設定する
 */
function insertJpegDpi(arrayBuffer, dpi) {
  const bytes = new Uint8Array(arrayBuffer);
  // JPEG SOI (0xFF 0xD8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    return arrayBuffer;
  }

  // 2バイト目以降のマーカー走査
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] === 0xFF && bytes[offset + 1] === 0xE0) {
      // APP0 (JFIF) マーカー
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      // "JFIF\0"
      if (bytes[offset + 4] === 0x4A && bytes[offset + 5] === 0x46 && bytes[offset + 6] === 0x49 && bytes[offset + 7] === 0x46) {
        // 解像度単位 (offset + 11): 1 = dots per inch, 2 = dots per cm
        bytes[offset + 11] = 1;
        // X density (offset + 12, 13)
        bytes[offset + 12] = (dpi >> 8) & 0xFF;
        bytes[offset + 13] = dpi & 0xFF;
        // Y density (offset + 14, 15)
        bytes[offset + 14] = (dpi >> 8) & 0xFF;
        bytes[offset + 15] = dpi & 0xFF;
        return bytes.buffer;
      }
      offset += 2 + length;
    } else if (bytes[offset] === 0xFF && (bytes[offset + 1] === 0xDA || bytes[offset + 1] === 0xD9)) {
      break;
    } else if (bytes[offset] === 0xFF) {
      const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + len;
    } else {
      offset++;
    }
  }

  return arrayBuffer;
}

// CRC32計算ユーティリティ
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function crc32(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

