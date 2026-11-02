/**
 * PlaymatImageEditor - js/storage.js
 * 独自JSON保存 (.playmat.json) および IndexedDB 自動保存モジュール
 */

const DB_NAME = 'PlaymatImageEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'autosave';
const AUTOSAVE_KEY = 'project_backup';

export class StorageManager {
  constructor() {
    this.db = null;
    this.autoSaveEnabled = true;
    this.autoSaveInterval = 30000; // 30秒ごと
    this.timerId = null;
    this.hasUnsavedChanges = false;
    this.initIndexedDB();
  }

  async initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return;
    }
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => {
        console.warn('IndexedDBオープン失敗:', e);
        resolve(null);
      };
    });
  }

  // 自動保存の開始
  startAutoSave(getProjectDataCallback) {
    this.stopAutoSave();
    if (!this.autoSaveEnabled) return;

    this.timerId = setInterval(async () => {
      if (this.hasUnsavedChanges && typeof getProjectDataCallback === 'function') {
        try {
          const data = getProjectDataCallback();
          if (data) {
            await this.saveToIndexedDB(data);
            this.hasUnsavedChanges = false;
            window.dispatchEvent(new CustomEvent('playmat:autosaved', { detail: { time: new Date() } }));
          }
        } catch (err) {
          console.warn('自動保存エラー:', err);
        }
      }
    }, this.autoSaveInterval);
  }

  stopAutoSave() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  markUnsaved() {
    this.hasUnsavedChanges = true;
  }

  markSaved() {
    this.hasUnsavedChanges = false;
  }

  async saveToIndexedDB(projectData) {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
          data: projectData,
          savedAt: Date.now()
        };
        const req = store.put(record, AUTOSAVE_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e);
      } catch (e) {
        reject(e);
      }
    });
  }

  async loadFromIndexedDB() {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return null;

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(AUTOSAVE_KEY);
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve({
              data: req.result.data,
              savedAt: req.result.savedAt
            });
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async clearIndexedDB() {
    if (!this.db) await this.initIndexedDB();
    if (!this.db) return;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(AUTOSAVE_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  /**
   * プロジェクトデータを.playmat.jsonとしてダウンロード
   */
  exportProjectFile(projectData, filename = 'playmat_project.playmat.json') {
    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.playmat.json') ? filename : `${filename}.playmat.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.markSaved();
  }

  /**
   * ファイルから.playmat.jsonを読み込みパース＆検証
   */
  async importProjectFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('ファイルが指定されていません。'));
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = e.target.result;
          const parsed = JSON.parse(raw);
          const validated = this.validateProjectData(parsed);
          resolve(validated);
        } catch (err) {
          reject(new Error('ファイル読み込みまたはJSON解析に失敗しました: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込み中にエラーが発生しました。'));
      reader.readAsText(file);
    });
  }

  /**
   * プロジェクトデータの検証とサニタイズ
   */
  validateProjectData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('無効なプロジェクトデータ形式です。');
    }
    if (!data.canvas || typeof data.canvas !== 'object') {
      throw new Error('キャンバス設定が含まれていません。');
    }
    if (!Array.isArray(data.layers)) {
      throw new Error('レイヤー情報が不正です。');
    }

    // キャンバス設定の安全化
    const safeCanvas = {
      width: Math.max(100, Math.min(20000, Number(data.canvas.width) || 2000)),
      height: Math.max(100, Math.min(20000, Number(data.canvas.height) || 1200)),
      dpi: Math.max(72, Math.min(1200, Number(data.canvas.dpi) || 350)),
      bleedMm: Math.max(0, Number(data.canvas.bleedMm) || 0),
      safeAreaMm: Math.max(0, Number(data.canvas.safeAreaMm) || 0),
      docWidthMm: Number(data.canvas.docWidthMm) || 0,
      docHeightMm: Number(data.canvas.docHeightMm) || 0,
      finishWidthMm: Number(data.canvas.finishWidthMm) || 0,
      finishHeightMm: Number(data.canvas.finishHeightMm) || 0,
      presetId: String(data.canvas.presetId || 'custom'),
      backgroundColor: String(data.canvas.backgroundColor || '#ffffff'),
      transparentBg: Boolean(data.canvas.transparentBg)
    };

    // レイヤーの検証
    const safeLayers = [];
    for (const l of data.layers) {
      if (!l || typeof l !== 'object' || !l.type) continue;
      safeLayers.push({
        ...l,
        id: String(l.id || ('layer_' + Math.random().toString(36).substr(2, 9))),
        name: String(l.name || 'レイヤー').slice(0, 50),
        x: Number(l.x) || 0,
        y: Number(l.y) || 0,
        width: Math.max(1, Number(l.width) || 10),
        height: Math.max(1, Number(l.height) || 10),
        rotation: Number(l.rotation) || 0,
        opacity: Math.max(0, Math.min(1, Number(l.opacity) !== undefined ? Number(l.opacity) : 1)),
        visible: l.visible !== undefined ? Boolean(l.visible) : true,
        locked: Boolean(l.locked)
      });
    }

    return {
      version: 1,
      appName: 'PlaymatImageEditor',
      canvas: safeCanvas,
      layers: safeLayers,
      updatedAt: Date.now()
    };
  }
}
