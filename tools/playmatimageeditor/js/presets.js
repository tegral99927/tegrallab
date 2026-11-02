/**
 * PlaymatImageEditor - js/presets.js
 * プレイマット印刷プリセット管理および寸法変換モジュール
 */

export const ServiceStatus = {
  VERIFIED: 'verified',                     // 公式確認済み
  VERIFIED_TEMPLATE_REQ: 'verified_template',// 公式確認済み（専用テンプレート必須）
  UNVERIFIED: 'unverified'                  // 公式仕様未確認（手動入力推奨）
};

// 標準印刷プリセット一覧
export const DEFAULT_PRESETS = [
  {
    id: 'orangekoubou_standard',
    serviceName: 'オレンジ工房.com',
    presetName: 'プレイマット (通常仕上がり)',
    status: ServiceStatus.VERIFIED,
    finishWidthMm: 600,
    finishHeightMm: 350,
    bleedMm: 15, // 各辺15mm塗り足し -> 原稿630×380mm
    docWidthMm: 630,
    docHeightMm: 380,
    recommendedDpi: 350,
    pixelWidth: 8681, // 630 / 25.4 * 350 = 8681.1
    pixelHeight: 5236, // 380 / 25.4 * 350 = 5236.2
    safeAreaMm: 5, // 仕上がり線から内側5mm (重要絵柄・文字)
    format: 'RGB推奨 (PNG / PSD / TIFF)',
    colorNotice: 'RGBカラーモード推奨。CMYKで入稿する場合は発色変化にご注意ください。',
    notes: '仕上がりサイズ600×350mm、原稿サイズ630×380mm（上下左右に塗り足し各15mm）。350dpi。',
    referenceUrl: 'https://www.orangekoubou.com/goods/goods_playmat.php'
  },
  {
    id: 'printon_standard',
    serviceName: 'プリントオン',
    presetName: 'ラバープレイマット (600×350mm)',
    status: ServiceStatus.VERIFIED_TEMPLATE_REQ,
    finishWidthMm: 600,
    finishHeightMm: 350,
    bleedMm: 3, // 公式テンプレートに合わせた目安塗り足し
    docWidthMm: 606,
    docHeightMm: 356,
    recommendedDpi: 350,
    pixelWidth: 8350, // テンプレート準拠目安
    pixelHeight: 4906,
    safeAreaMm: 8, // 仕上がりから十分な余裕推奨
    format: '公式テンプレートPSD推奨 / 高解像度画像',
    colorNotice: 'RGB/CMYK対応。入稿時は公式案内をご確認ください。',
    notes: '【重要】プリントオンは必ず公式サイトより専用テンプレートをダウンロードして使用してください。本ツールの寸法計算だけで完全対応しているとは保証されません。本ツールで作成した画像はテンプレートに貼り付けてご活用ください。',
    referenceUrl: 'https://www.print-on.jp/doujin/comic/goods/playmat.htm'
  },
  {
    id: 'pixivfactory_standard',
    serviceName: 'pixivFACTORY',
    presetName: 'プレイマット (通常サイズ目安)',
    status: ServiceStatus.UNVERIFIED,
    finishWidthMm: 600,
    finishHeightMm: 350,
    bleedMm: 5,
    docWidthMm: 610,
    docHeightMm: 360,
    recommendedDpi: 350,
    pixelWidth: 8406,
    pixelHeight: 4961,
    safeAreaMm: 10,
    format: 'PNG / JPEG / PSD',
    colorNotice: 'RGB形式で入稿。',
    notes: 'pixivFACTORYは3サイズ展開されています。具体的な推奨ピクセル数は公式エディター側での自動配置等で変動するため、未確認として扱います。入稿前にpixivFACTORYの仕様を必ず確認し、必要に応じてカスタムサイズで調整してください。',
    referenceUrl: 'https://factory.pixiv.net/products/playmat'
  },
  {
    id: 'pixivfactory_half',
    serviceName: 'pixivFACTORY',
    presetName: 'プレイマット (ハーフサイズ目安)',
    status: ServiceStatus.UNVERIFIED,
    finishWidthMm: 350,
    finishHeightMm: 300,
    bleedMm: 5,
    docWidthMm: 360,
    docHeightMm: 310,
    recommendedDpi: 350,
    pixelWidth: 4961,
    pixelHeight: 4272,
    safeAreaMm: 8,
    format: 'PNG / JPEG',
    colorNotice: 'RGB形式。',
    notes: 'ハーフサイズ目安（未確認プリセット）。入稿前に公式推奨値をご確認ください。',
    referenceUrl: 'https://factory.pixiv.net/products/playmat'
  },
  {
    id: 'general_tcg_300',
    serviceName: '汎用TCG印刷',
    presetName: 'スタンダード (600×350mm / 300dpi)',
    status: ServiceStatus.UNVERIFIED,
    finishWidthMm: 600,
    finishHeightMm: 350,
    bleedMm: 5,
    docWidthMm: 610,
    docHeightMm: 360,
    recommendedDpi: 300,
    pixelWidth: 7205,
    pixelHeight: 4252,
    safeAreaMm: 10,
    format: 'PNG / JPEG',
    colorNotice: '一般的な同人・海外オンデマンド印刷向け。',
    notes: '一般的な300dpiの汎用設定です。',
    referenceUrl: ''
  },
  {
    id: 'general_tcg_24x14',
    serviceName: '海外TCG印刷 (Inked Gaming等)',
    presetName: '24×14インチ (約610×356mm / 300dpi)',
    status: ServiceStatus.UNVERIFIED,
    finishWidthMm: 609.6,
    finishHeightMm: 355.6,
    bleedMm: 6.35, // 0.25 inch bleed -> 24.5 x 14.5 inch
    docWidthMm: 622.3,
    docHeightMm: 368.3,
    recommendedDpi: 300,
    pixelWidth: 7350,
    pixelHeight: 4350,
    safeAreaMm: 12.7, // 0.5 inch safe zone
    format: 'PNG / JPEG',
    colorNotice: 'RGB入稿。',
    notes: '米国の標準的な24×14インチプレイマットサイズです。',
    referenceUrl: ''
  }
];

export class PresetManager {
  constructor() {
    this.storageKey = 'playmat_image_editor_custom_presets_v1';
    this.presets = [];
    this.loadPresets();
  }

  loadPresets() {
    this.presets = [...DEFAULT_PRESETS];
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const customList = JSON.parse(stored);
        if (Array.isArray(customList)) {
          this.presets.push(...customList);
        }
      }
    } catch (e) {
      console.warn('カスタムプリセットの読み込みに失敗しました:', e);
    }
  }

  saveCustomPresets() {
    const customList = this.presets.filter(p => p.isCustom);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(customList));
    } catch (e) {
      console.error('カスタムプリセットの保存に失敗しました:', e);
    }
  }

  getAll() {
    return this.presets;
  }

  getById(id) {
    return this.presets.find(p => p.id === id) || this.presets[0];
  }

  addCustomPreset(presetData) {
    const newPreset = {
      ...presetData,
      id: 'custom_' + Date.now(),
      isCustom: true,
      status: ServiceStatus.UNVERIFIED
    };
    this.presets.push(newPreset);
    this.saveCustomPresets();
    return newPreset;
  }

  deleteCustomPreset(id) {
    const index = this.presets.findIndex(p => p.id === id && p.isCustom);
    if (index !== -1) {
      this.presets.splice(index, 1);
      this.saveCustomPresets();
      return true;
    }
    return false;
  }

  exportPresetsAsJson() {
    const customList = this.presets.filter(p => p.isCustom);
    return JSON.stringify(customList, null, 2);
  }

  importPresetsFromJson(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) throw new Error('配列形式ではありません');
      let count = 0;
      for (const item of parsed) {
        if (item.presetName && item.docWidthMm && item.docHeightMm && item.recommendedDpi) {
          const sanitized = {
            id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            serviceName: String(item.serviceName || 'カスタム'),
            presetName: String(item.presetName),
            status: ServiceStatus.UNVERIFIED,
            finishWidthMm: Number(item.finishWidthMm) || Number(item.docWidthMm),
            finishHeightMm: Number(item.finishHeightMm) || Number(item.docHeightMm),
            bleedMm: Number(item.bleedMm) || 0,
            docWidthMm: Number(item.docWidthMm),
            docHeightMm: Number(item.docHeightMm),
            recommendedDpi: Number(item.recommendedDpi) || 350,
            pixelWidth: Number(item.pixelWidth) || mmToPx(item.docWidthMm, item.recommendedDpi),
            pixelHeight: Number(item.pixelHeight) || mmToPx(item.docHeightMm, item.recommendedDpi),
            safeAreaMm: Number(item.safeAreaMm) || 5,
            format: String(item.format || 'PNG'),
            colorNotice: String(item.colorNotice || ''),
            notes: String(item.notes || ''),
            referenceUrl: String(item.referenceUrl || ''),
            isCustom: true
          };
          this.presets.push(sanitized);
          count++;
        }
      }
      this.saveCustomPresets();
      return { success: true, count };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

/**
 * mmからピクセルへの統一変換式: px = Math.round(mm / 25.4 * dpi)
 */
export function mmToPx(mm, dpi) {
  if (!mm || !dpi) return 0;
  return Math.round((Number(mm) / 25.4) * Number(dpi));
}

/**
 * ピクセルからmmへの変換式: mm = (px * 25.4 / dpi)
 */
export function pxToMm(px, dpi) {
  if (!px || !dpi) return 0;
  return Number(((Number(px) * 25.4) / Number(dpi)).toFixed(1));
}

/**
 * 画像の実効DPI計算
 * @param {number} pixelDim 画像の元ピクセル数 (幅または高さ)
 * @param {number} printMmMm 印刷上の仕上がり寸法 (mm)
 * @returns {number} 実効DPI
 */
export function calculateEffectiveDpi(pixelDim, printMmMm) {
  if (!pixelDim || !printMmMm || printMmMm <= 0) return 0;
  const inches = printMmMm / 25.4;
  return Math.round(pixelDim / inches);
}

