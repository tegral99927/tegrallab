/**
 * TimeLess - storage.js
 * ブラウザローカル保存（IndexedDB + LocalStorage フォールバック）およびJSON入出力管理
 */

export const THEMES = ['midnight', 'emerald', 'violet', 'monochrome', 'light'];

export const DEFAULT_STATE = {
  version: 1,
  profile: {
    name: 'Player',
    timezone: 'JST (UTC+9)',
    comment: '',
    avatar: null, // dataURL string
    avatarZoom: 1,
    avatarX: 0,
    avatarY: 0
  },
  // 7日間 (0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日) × 24時間 (0..23)
  schedule: [
    // Mon - Fri: 20:00〜23:00 (default example)
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,false],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true],
    // Sat - Sun: 13:00〜18:00, 20:00〜24:00
    [false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,false,false,true,true,true,true],
    [false,false,false,false,false,false,false,false,false,false,false,false,false,true,true,true,true,true,false,false,true,true,true,false]
  ],
  environments: {
    paper: {
      id: 'paper',
      name: '紙・リモート',
      enabled: true,
      formats: ['Commander', 'Modern']
    },
    arena: {
      id: 'arena',
      name: 'Arena',
      enabled: true,
      formats: ['Standard', 'Explorer']
    },
    mo: {
      id: 'mo',
      name: 'Magic Online',
      enabled: false,
      formats: ['Pauper', 'Legacy']
    }
  },
  customFormats: [],
  notes: 'SpellTableまたはDiscordにて対戦可能です。\n初心者歓迎、お気軽にどうぞ！',
  theme: 'midnight',
  exportSettings: {
    resolution: '2560x1440',
    format: 'png',
    quality: 0.92
  }
};

const DB_NAME = 'TimeLess_DB';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';
const LS_BACKUP_KEY = 'timeless_state_v1';

let idb = null;

// IndexedDB 初期化
async function getDB() {
  if (idb) return idb;
  if (!('indexedDB' in window)) return null;

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (event) => {
        idb = event.target.result;
        resolve(idb);
      };
      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * データをローカルに保存
 * @param {Object} state
 */
export async function saveState(state) {
  const clone = JSON.parse(JSON.stringify(state));
  let savedToIDB = false;

  try {
    const db = await getDB();
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(clone, 'current_state');
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
      savedToIDB = true;
    }
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to LocalStorage', err);
  }

  // LocalStorage バックアップ（アバターが大きい場合は省いて設定のみバックアップ）
  try {
    const backupState = { ...clone };
    if (!savedToIDB && backupState.profile?.avatar && backupState.profile.avatar.length > 500000) {
      // LocalStorage容量オーバー防止
      backupState.profile.avatar = null;
    }
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(backupState));
  } catch (err) {
    console.warn('LocalStorage save failed', err);
  }
}

/**
 * データをローカルから復元
 * @returns {Promise<Object>}
 */
export async function loadState() {
  try {
    const db = await getDB();
    if (db) {
      const state = await new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('current_state');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (state) {
        return mergeWithDefault(state);
      }
    }
  } catch (err) {
    console.warn('IndexedDB load failed', err);
  }

  // LocalStorage フォールバック
  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return mergeWithDefault(parsed);
    }
  } catch (err) {
    console.warn('LocalStorage load failed', err);
  }

  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

/**
 * デフォルト値とマージして破損・欠損項目を補完
 */
function mergeWithDefault(raw) {
  const base = JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!raw || typeof raw !== 'object') return base;

  return {
    version: raw.version || 1,
    profile: {
      name: typeof raw.profile?.name === 'string' ? raw.profile.name.slice(0, 50) : base.profile.name,
      timezone: typeof raw.profile?.timezone === 'string' ? raw.profile.timezone.slice(0, 30) : base.profile.timezone,
      comment: typeof raw.profile?.comment === 'string' ? raw.profile.comment.slice(0, 100) : base.profile.comment,
      avatar: typeof raw.profile?.avatar === 'string' ? raw.profile.avatar : null,
      avatarZoom: typeof raw.profile?.avatarZoom === 'number' ? raw.profile.avatarZoom : 1,
      avatarX: typeof raw.profile?.avatarX === 'number' ? raw.profile.avatarX : 0,
      avatarY: typeof raw.profile?.avatarY === 'number' ? raw.profile.avatarY : 0
    },
    schedule: sanitizeSchedule(raw.schedule, base.schedule),
    environments: {
      paper: {
        id: 'paper',
        name: '紙・リモート',
        enabled: Boolean(raw.environments?.paper?.enabled),
        formats: Array.isArray(raw.environments?.paper?.formats) ? raw.environments.paper.formats : base.environments.paper.formats
      },
      arena: {
        id: 'arena',
        name: 'Arena',
        enabled: Boolean(raw.environments?.arena?.enabled),
        formats: Array.isArray(raw.environments?.arena?.formats) ? raw.environments.arena.formats : base.environments.arena.formats
      },
      mo: {
        id: 'mo',
        name: 'Magic Online',
        enabled: Boolean(raw.environments?.mo?.enabled),
        formats: Array.isArray(raw.environments?.mo?.formats) ? raw.environments.mo.formats : base.environments.mo.formats
      }
    },
    customFormats: Array.isArray(raw.customFormats) ? raw.customFormats.map(f => String(f).slice(0, 30)).filter(Boolean) : [],
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 300) : base.notes,
    theme: THEMES.includes(raw.theme) ? raw.theme : base.theme,
    exportSettings: {
      resolution: ['1920x1080', '2560x1440', '3200x1800', '2400x1350'].includes(raw.exportSettings?.resolution)
        ? raw.exportSettings.resolution
        : base.exportSettings.resolution,
      format: ['png', 'jpeg'].includes(raw.exportSettings?.format) ? raw.exportSettings.format : 'png',
      quality: typeof raw.exportSettings?.quality === 'number' ? Math.max(0.5, Math.min(1.0, raw.exportSettings.quality)) : 0.92
    }
  };
}

function sanitizeSchedule(rawSchedule, defaultSchedule) {
  if (!Array.isArray(rawSchedule) || rawSchedule.length !== 7) {
    return defaultSchedule;
  }
  return rawSchedule.map(dayArr => {
    if (!Array.isArray(dayArr) || dayArr.length !== 24) {
      return Array(24).fill(false);
    }
    return dayArr.map(cell => Boolean(cell));
  });
}

/**
 * 初期状態へリセット
 */
export async function clearState() {
  try {
    const db = await getDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    }
  } catch (e) {
    console.warn(e);
  }
  try {
    localStorage.removeItem(LS_BACKUP_KEY);
  } catch (e) {
    console.warn(e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

/**
 * JSONエクスポート用文字列生成
 */
export function exportToJSON(state) {
  const exportData = {
    app: 'TimeLess',
    exportedAt: new Date().toISOString(),
    data: state
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * JSONインポートのバリデーションと読み込み
 */
export function validateAndParseJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'JSON形式が正しくありません。' };
    }
    const stateData = parsed.data || parsed;
    if (!stateData || typeof stateData !== 'object') {
      return { success: false, error: '有効なTimeLessデータが見つかりません。' };
    }
    const sanitized = mergeWithDefault(stateData);
    return { success: true, data: sanitized };
  } catch (err) {
    return { success: false, error: 'JSONの解析に失敗しました: ' + err.message };
  }
}

