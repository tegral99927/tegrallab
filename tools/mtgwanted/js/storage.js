/**
 * MTGWanted - storage.js
 * 設定、プリセット、LocalStorage永続化、JSON入出力、安全な画像リサイズ
 */

export const CONFIG = {
  APP_NAME: 'MTGWanted',
  VERSION: '1.0.0',
  BOOTH_URL: 'https://tegrallab.booth.pm/', // 開発者支援BOOTHリンク（空文字の場合は非表示）
  STORAGE_KEY: 'mtgwanted_data_v1',
  MAX_AVATAR_DIM: 512, // LocalStorage容量保護のためのアバター最大解像度
  AUTO_SAVE_DEBOUNCE_MS: 400
};

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'Classic Wanted',
    desc: '黄ばんだ羊皮紙、焦げ茶、クラシック木版装飾',
    bg: '#f4ebd0',
    bgEdge: '#d6be90',
    text: '#2c1808',
    textMuted: '#5d3c1f',
    accent: '#8c241c',
    border: '#2c1808',
    boxBg: '#ebdcb8',
    boxBorder: '#7d4a20',
    stamp: '#a82415'
  },
  dark: {
    id: 'dark',
    name: 'Dark Outlaw',
    desc: '黒・濃茶、夜の無法者風ダークスタイル',
    bg: '#1c1714',
    bgEdge: '#120e0d',
    text: '#ebdcc5',
    textMuted: '#bda88c',
    accent: '#c97e3a',
    border: '#c97e3a',
    boxBg: '#27201c',
    boxBorder: '#8c5828',
    stamp: '#d94328'
  },
  bounty: {
    id: 'bounty',
    name: 'Red Bounty',
    desc: '深紅と焦げ茶、賞金首ポスター風',
    bg: '#f7ede2',
    bgEdge: '#e5d1be',
    text: '#2b160a',
    textMuted: '#683719',
    accent: '#a62419',
    border: '#a62419',
    boxBg: '#faeee3',
    boxBorder: '#b33529',
    stamp: '#b51b0e'
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Western',
    desc: '装飾を整理した現代的ウェスタンスタイル',
    bg: '#faf6ef',
    bgEdge: '#ede4d4',
    text: '#26221f',
    textMuted: '#63584e',
    accent: '#594435',
    border: '#3b322a',
    boxBg: '#f2ede2',
    boxBorder: '#6d5e50',
    stamp: '#8a2b1f'
  }
};

export const SIZES = {
  landscape: {
    id: 'landscape',
    label: '標準横長',
    width: 1600,
    height: 900,
    desc: '1600 × 900 (16:9 / Discord・Bluesky最適)'
  },
  landscape_hd: {
    id: 'landscape_hd',
    label: '高解像度横長',
    width: 1920,
    height: 1080,
    desc: '1920 × 1080 (16:9 FHD)'
  },
  square: {
    id: 'square',
    label: '正方形',
    width: 1200,
    height: 1200,
    desc: '1200 × 1200 (1:1 / SNSプロフィール・タイムライン)'
  },
  portrait: {
    id: 'portrait',
    label: '縦長ポスター',
    width: 1200,
    height: 1600,
    desc: '1200 × 1600 (3:4 / 西部劇クラシック手配書)'
  },
  long_portrait: {
    id: 'long_portrait',
    label: '長尺ポスター',
    width: 1200,
    height: 1900,
    desc: '1200 × 1900 (情報量が多い募集用)'
  }
};

export const BORDER_STYLES = {
  triple: 'トリプル木版枠（太枠＋細枠＋四隅飾り）',
  ornate: 'オーナメント枠（クラシック唐草＆星）',
  rope: 'ロープ調ヴィンテージ枠',
  simple: 'シンプル二重枠'
};

export const PAPER_TEXTURES = {
  parchment: '羊皮紙（エイジング＆まだら）',
  grain: 'ヴィンテージ粒子（かすれ）',
  rough: '粗挽きクラフト（荒い質感）',
  clean: 'スムースアンティーク（控えめ）'
};

export const STATUS_OPTIONS = {
  recruiting: {
    id: 'recruiting',
    label: '募集中 (スタンプなし)',
    stamp: null
  },
  matched: {
    id: 'matched',
    label: '対戦相手決定 (MATCH FOUND)',
    stamp: 'MATCH FOUND'
  },
  closed: {
    id: 'closed',
    label: '募集終了 (CLOSED)',
    stamp: 'CLOSED'
  }
};

export const DATE_FORMATS = {
  western: '西部劇風装飾形式 (✦ 11/07 [SAT] 20:00 ✦)',
  japanese: '日本語形式 (11月7日(土) 20:00〜)',
  english: '英語形式 (NOV 07 SAT 20:00 -)'
};

export const STANDARD_FORMATS = [
  'スタンダード',
  'パイオニア',
  'モダン',
  'レガシー',
  'ヴィンテージ',
  'パウパー',
  'コマンダー（EDH）',
  'ブロール',
  'ヒストリック',
  'エクスプローラー',
  'タイムレス',
  'アルケミー',
  'リミテッド'
];

export const PRESETS = {
  arena_rank: {
    name: 'アリーナランク対戦',
    desc: 'MTG Arenaでのランク戦・BO3競技調整向け',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'ARENA DUEL WANTED',
        customFooter: 'REWARD: GLORIOUS BATTLE & HONOR'
      },
      environments: {
        arena: true,
        mo: false,
        paper_remote: false,
        remoteTool: '',
        paper_inperson: false,
        inPersonLocation: ''
      },
      formats: ['スタンダード', 'タイムレス'],
      customFormat: '',
      notes: 'MTG Arenaにてランク戦・BO3の対戦相手を募集！\nデッキ調整やサイドボード戦歓迎です。気軽に対戦しましょう！'
    }
  },
  arena_casual: {
    name: 'アリーナカジュアル',
    desc: 'ブロールやファンデッキでの気軽な対戦',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'CASUAL BRAWL & FUN',
        customFooter: 'FOR FUN & GLORY'
      },
      environments: {
        arena: true,
        mo: false,
        paper_remote: false,
        remoteTool: '',
        paper_inperson: false,
        inPersonLocation: ''
      },
      formats: ['ブロール', 'スタンダード', 'ヒストリック'],
      customFormat: '',
      notes: 'ブロールまたはカジュアル構築戦の対戦相手募集！\n自作ファンデッキやシナジー重視デッキで楽しく遊びましょう。初心者の方もお気軽にどうぞ！'
    }
  },
  commander: {
    name: 'コマンダー募集',
    desc: '統率者戦（EDH）のリモート・対面4人募集',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'COMMANDER PLAYERS WANTED',
        customFooter: 'DEAD OR ALIVE / CASUAL COMMANDER'
      },
      environments: {
        arena: false,
        mo: false,
        paper_remote: true,
        remoteTool: 'SpellTable / Discord',
        paper_inperson: false,
        inPersonLocation: ''
      },
      formats: ['コマンダー（EDH）'],
      customFormat: '',
      notes: '統率者戦（EDH）対戦メンバー募集！\n想定ブラケット: 2〜3（カジュアル寄り・即死コンボ控えめ）\nDiscord通話あり、プロキシ相談可、観戦歓迎です！'
    }
  },
  paper_remote: {
    name: '紙のリモート対戦',
    desc: 'SpellTable等を利用した実カード遠隔対戦',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'REMOTE DUEL WANTED',
        customFooter: 'HIGH NOON SPELLTABLE DUEL'
      },
      environments: {
        arena: false,
        mo: false,
        paper_remote: true,
        remoteTool: 'SpellTable',
        paper_inperson: false,
        inPersonLocation: ''
      },
      formats: ['モダン', 'パイオニア'],
      customFormat: '',
      notes: 'SpellTableでのリモート対戦相手を募集します。\nカメラ手元撮影でBO3対戦希望。VCあり（Discord）でお願いします！'
    }
  },
  paper_store: {
    name: '店舗・対面対戦',
    desc: 'カードショップやイベント会場での直接対戦',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'TABLETOP DUEL WANTED',
        customFooter: 'HONORABLE COWBOY SHOWDOWN'
      },
      environments: {
        arena: false,
        mo: false,
        paper_remote: false,
        remoteTool: '',
        paper_inperson: true,
        inPersonLocation: '都内カードショップ / フリースペース'
      },
      formats: ['コマンダー（EDH）', 'モダン'],
      customFormat: '',
      notes: '実店舗での対面フリー対戦相手を募集しています！\n初心者の方も大歓迎です。対戦希望の方はSNSのリプかDMでお気軽にお声がけください。'
    }
  },
  free_duel: {
    name: 'フリー募集',
    desc: '対戦環境・フォーマットを柔軟に相談',
    data: {
      poster: {
        title: 'WANTED',
        subtitle: 'OPPONENT WANTED',
        customFooter: 'ANY CHALLENGER WELCOME'
      },
      environments: {
        arena: true,
        mo: false,
        paper_remote: true,
        remoteTool: 'SpellTable',
        paper_inperson: false,
        inPersonLocation: ''
      },
      formats: ['コマンダー（EDH）', 'スタンダード', 'モダン', 'パウパー'],
      customFormat: '',
      notes: 'MTG対戦相手を広く募集中！\n対戦形式やフォーマットは柔軟に調整可能です。いつでも気軽に対戦申し込みしてください！'
    }
  }
};

/**
 * 初期状態生成関数
 */
export function getDefaultState() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t_yyyy = tomorrow.getFullYear();
  const t_mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const t_dd = String(tomorrow.getDate()).padStart(2, '0');

  return {
    version: 1,
    profile: {
      name: 'Planeswalker',
      handle: '@YourHandle',
      avatar: null, // data URL string
      avatarZoom: 1.0,
      avatarX: 0,
      avatarY: 0,
      avatarShape: 'circle', // 'circle' | 'square'
      avatarSepia: true,
      avatarSepiaIntensity: 75
    },
    poster: {
      title: 'WANTED',
      subtitle: 'OPPONENT WANTED',
      customFooter: 'REWARD: GLORIOUS BATTLE & HONOR',
      status: 'recruiting', // 'recruiting' | 'matched' | 'closed'
      theme: 'classic',
      size: 'landscape',
      borderStyle: 'triple',
      paperTexture: 'parchment',
      ornamentDensity: 'normal', // 'high' | 'normal' | 'minimal'
      textAlign: 'center', // 'center' | 'left'
      fontSizeScale: 1.0, // 0.8 ~ 1.2
      iconSize: 'large' // 'medium' | 'large' | 'xlarge'
    },
    schedule: {
      dateFormat: 'western',
      timeNegotiableGlobal: true,
      anytimeWelcomeGlobal: false,
      slots: [
        {
          id: 'slot_1',
          date: `${yyyy}-${mm}-${dd}`,
          startTime: '20:00',
          endTime: '23:00',
          negotiable: false,
          anytime: false,
          customText: ''
        },
        {
          id: 'slot_2',
          date: `${t_yyyy}-${t_mm}-${t_dd}`,
          startTime: '13:00',
          endTime: '18:00',
          negotiable: true,
          anytime: false,
          customText: ''
        },
        {
          id: 'slot_3',
          date: '',
          startTime: '21:00',
          endTime: '',
          negotiable: true,
          anytime: false,
          customText: '週末夜相談可'
        }
      ]
    },
    environments: {
      paper_inperson: false,
      inPersonLocation: '',
      paper_remote: true,
      remoteTool: 'SpellTable',
      arena: true,
      mo: false
    },
    formats: ['コマンダー（EDH）', 'モダン'],
    customFormat: '',
    notes: '初心者歓迎！カジュアル対戦希望です。\nVCあり（Discord）、BO3歓迎。お気軽にリプまたはDMください！',
    exportSettings: {
      format: 'png',
      jpegQuality: 0.92
    }
  };
}

/**
 * LocalStorageから状態を読み込み
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw);
    return sanitizeState(parsed);
  } catch (err) {
    console.warn('[MTGWanted] LocalStorage load failed, using default state:', err);
    return getDefaultState();
  }
}

/**
 * LocalStorageへ状態を保存
 */
export function saveState(state) {
  try {
    const cleanState = sanitizeState(state);
    const serialized = JSON.stringify(cleanState);
    localStorage.setItem(CONFIG.STORAGE_KEY, serialized);
    return { success: true };
  } catch (err) {
    console.error('[MTGWanted] LocalStorage save failed:', err);
    // QuotaExceededError の場合のフォールバック（アバター除去して再試行）
    if (err.name === 'QuotaExceededError' && state.profile?.avatar) {
      try {
        const fallbackState = { ...state, profile: { ...state.profile, avatar: null } };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(fallbackState));
        return {
          success: false,
          warning: '画像サイズが大きいため、アバター画像を除いた設定のみ保存されました。'
        };
      } catch (e2) {
        return { success: false, error: 'ブラウザの保存容量制限を超えています。' };
      }
    }
    return { success: false, error: err.message };
  }
}

/**
 * 状態をリセット
 */
export function resetState() {
  try {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
  } catch (e) {
    // ignore
  }
  return getDefaultState();
}

/**
 * 安全な状態サニタイズ（型チェックと欠損補完）
 */
export function sanitizeState(input) {
  const def = getDefaultState();
  if (!input || typeof input !== 'object') return def;

  const state = {
    version: def.version,
    profile: {
      name: String(input.profile?.name ?? def.profile.name).slice(0, 50),
      handle: String(input.profile?.handle ?? def.profile.handle).slice(0, 50),
      avatar: typeof input.profile?.avatar === 'string' && input.profile.avatar.startsWith('data:image/')
        ? input.profile.avatar
        : null,
      avatarZoom: Math.min(Math.max(Number(input.profile?.avatarZoom ?? 1), 0.5), 3),
      avatarX: Math.min(Math.max(Number(input.profile?.avatarX ?? 0), -200), 200),
      avatarY: Math.min(Math.max(Number(input.profile?.avatarY ?? 0), -200), 200),
      avatarShape: ['circle', 'square'].includes(input.profile?.avatarShape)
        ? input.profile.avatarShape
        : 'circle',
      avatarSepia: Boolean(input.profile?.avatarSepia ?? true),
      avatarSepiaIntensity: Math.min(Math.max(Number(input.profile?.avatarSepiaIntensity ?? 75), 0), 100)
    },
    poster: {
      title: String(input.poster?.title ?? def.poster.title).slice(0, 30),
      subtitle: String(input.poster?.subtitle ?? def.poster.subtitle).slice(0, 40),
      customFooter: String(input.poster?.customFooter ?? def.poster.customFooter).slice(0, 60),
      status: ['recruiting', 'matched', 'closed'].includes(input.poster?.status)
        ? input.poster.status
        : 'recruiting',
      theme: THEMES[input.poster?.theme] ? input.poster.theme : 'classic',
      size: SIZES[input.poster?.size] ? input.poster.size : 'landscape',
      borderStyle: BORDER_STYLES[input.poster?.borderStyle] ? input.poster.borderStyle : 'triple',
      paperTexture: PAPER_TEXTURES[input.poster?.paperTexture] ? input.poster.paperTexture : 'parchment',
      ornamentDensity: ['high', 'normal', 'minimal'].includes(input.poster?.ornamentDensity)
        ? input.poster.ornamentDensity
        : 'normal',
      textAlign: ['center', 'left'].includes(input.poster?.textAlign)
        ? input.poster.textAlign
        : 'center',
      fontSizeScale: Math.min(Math.max(Number(input.poster?.fontSizeScale ?? 1), 0.8), 1.2),
      iconSize: ['medium', 'large', 'xlarge'].includes(input.poster?.iconSize)
        ? input.poster.iconSize
        : 'large'
    },
    schedule: {
      dateFormat: DATE_FORMATS[input.schedule?.dateFormat] ? input.schedule.dateFormat : 'western',
      timeNegotiableGlobal: Boolean(input.schedule?.timeNegotiableGlobal ?? true),
      anytimeWelcomeGlobal: Boolean(input.schedule?.anytimeWelcomeGlobal ?? false),
      slots: Array.isArray(input.schedule?.slots)
        ? input.schedule.slots.slice(0, 8).map((s, idx) => ({
            id: s.id || `slot_${idx + 1}`,
            date: String(s.date ?? '').slice(0, 15),
            startTime: String(s.startTime ?? '').slice(0, 10),
            endTime: String(s.endTime ?? '').slice(0, 10),
            negotiable: Boolean(s.negotiable),
            anytime: Boolean(s.anytime),
            customText: String(s.customText ?? '').slice(0, 40)
          }))
        : def.schedule.slots
    },
    environments: {
      paper_inperson: Boolean(input.environments?.paper_inperson),
      inPersonLocation: String(input.environments?.inPersonLocation ?? '').slice(0, 60),
      paper_remote: Boolean(input.environments?.paper_remote),
      remoteTool: String(input.environments?.remoteTool ?? '').slice(0, 50),
      arena: Boolean(input.environments?.arena),
      mo: Boolean(input.environments?.mo)
    },
    formats: Array.isArray(input.formats)
      ? input.formats.filter(f => typeof f === 'string').slice(0, 15)
      : def.formats,
    customFormat: String(input.customFormat ?? '').slice(0, 40),
    notes: String(input.notes ?? def.notes).slice(0, 500),
    exportSettings: {
      format: input.exportSettings?.format === 'jpeg' ? 'jpeg' : 'png',
      jpegQuality: Math.min(Math.max(Number(input.exportSettings?.jpegQuality ?? 0.92), 0.5), 1.0)
    }
  };

  return state;
}

/**
 * JSONエクスポート
 */
export function exportJson(state) {
  const clean = sanitizeState(state);
  const jsonStr = JSON.stringify(clean, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `MTGWanted_Settings_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * JSONインポート
 */
export function importJson(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('ファイルが選択されていません。'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const validated = sanitizeState(parsed);
        resolve(validated);
      } catch (err) {
        reject(new Error('JSONファイルの読み込みに失敗しました。形式が正しくありません。'));
      }
    };
    reader.onerror = () => reject(new Error('ファイル読み込み中にエラーが発生しました。'));
    reader.readAsText(file);
  });
}

/**
 * アップロード画像を安全に縮小（LocalStorage容量対策・レンダリング高速化）
 */
export function downscaleAvatar(file, maxDim = CONFIG.MAX_AVATAR_DIM) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // JPEG/PNG形式
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('画像ファイルのデコードに失敗しました。'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ファイル読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

