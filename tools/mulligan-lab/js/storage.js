/**
 * Mulligan Lab - Storage Layer (IndexedDB & LocalStorage)
 * Handles offline persistence, Scryfall cache, history, backups, and CSV export.
 */

const Storage = (() => {
  const DB_NAME = 'MulliganLabDB';
  const DB_VERSION = 1;
  const SETTINGS_KEY = 'mulligan_lab_settings';
  const ACTIVE_DECK_KEY = 'mulligan_lab_active_deck_id';
  const PRESETS_KEY = 'mulligan_lab_condition_presets';

  let dbPromise = null;

  // Initialize IndexedDB
  function getDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('cards_cache')) {
            db.createObjectStore('cards_cache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('decks')) {
            db.createObjectStore('decks', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('training_history')) {
            const histStore = db.createObjectStore('training_history', { keyPath: 'id' });
            histStore.createIndex('deckId', 'deckId', { unique: false });
            histStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };

        request.onerror = (event) => {
          console.error('IndexedDB open failed:', event.target.error);
          reject(event.target.error);
        };
      });
    }
    return dbPromise;
  }

  // Generic IndexedDB helper
  async function performTransaction(storeName, mode, operation) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;

      try {
        result = operation(store);
      } catch (err) {
        reject(err);
        return;
      }

      tx.oncomplete = () => resolve(result ? result.result : undefined);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Cards Cache ---
  async function getCachedCard(key) {
    try {
      const db = await getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cards_cache', 'readonly');
        const store = tx.objectStore('cards_cache');
        const req = store.get(key.toLowerCase().trim());
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function cacheCard(key, data) {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('cards_cache', 'readwrite');
        const store = tx.objectStore('cards_cache');
        const req = store.put({
          key: key.toLowerCase().trim(),
          data: data,
          timestamp: Date.now()
        });
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn('Failed to cache card in IndexedDB:', err);
    }
  }

  // --- Decks ---
  async function getAllDecks() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly');
      const store = tx.objectStore('decks');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getDeck(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly');
      const store = tx.objectStore('decks');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveDeck(deck) {
    if (!deck.id) deck.id = 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    deck.updatedAt = Date.now();
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      const store = tx.objectStore('decks');
      const req = store.put(deck);
      req.onsuccess = () => resolve(deck);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function deleteDeck(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('decks', 'readwrite');
      const store = tx.objectStore('decks');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- Training History ---
  async function saveTrainingRecord(record) {
    if (!record.id) record.id = 'train_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    if (!record.timestamp) record.timestamp = Date.now();
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('training_history', 'readwrite');
      const store = tx.objectStore('training_history');
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAllHistory() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('training_history', 'readonly');
      const store = tx.objectStore('training_history');
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        records.sort((a, b) => b.timestamp - a.timestamp);
        resolve(records);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function clearHistory() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('training_history', 'readwrite');
      const store = tx.objectStore('training_history');
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- LocalStorage Settings & Presets ---
  const defaultSettings = {
    theme: 'dark',
    cardLanguage: 'ja', // 'ja' (prefer Japanese) or 'en'
    freeMulligan: 'auto',
    initialHandSize: 7,
    landScrewThreshold: 1,
    landFloodThreshold: 5,
    maxMulligans: 4,
    playDrawPreference: 'play'
  };

  function getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function getActiveDeckId() {
    try {
      return localStorage.getItem(ACTIVE_DECK_KEY) || null;
    } catch {
      return null;
    }
  }

  function setActiveDeckId(id) {
    try {
      if (id) localStorage.setItem(ACTIVE_DECK_KEY, id);
      else localStorage.removeItem(ACTIVE_DECK_KEY);
    } catch {}
  }

  function getConditionPresets() {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveConditionPresets(presets) {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {}
  }

  // --- Backup & Restore ---
  async function exportAllDataJSON() {
    const decks = await getAllDecks();
    const history = await getAllHistory();
    const settings = getSettings();
    const presets = getConditionPresets();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      appName: 'Mulligan Lab',
      settings,
      presets,
      decks,
      history
    };
  }

  async function importAllDataJSON(data) {
    if (!data || typeof data !== 'object' || data.appName !== 'Mulligan Lab') {
      throw new Error('無効なMulligan Labバックアップファイル形式です。');
    }

    if (data.settings) saveSettings(data.settings);
    if (Array.isArray(data.presets)) saveConditionPresets(data.presets);

    if (Array.isArray(data.decks)) {
      for (const deck of data.decks) {
        if (deck.id) await saveDeck(deck);
      }
    }

    if (Array.isArray(data.history)) {
      for (const record of data.history) {
        if (record.id) await saveTrainingRecord(record);
      }
    }

    return true;
  }

  async function resetAllData() {
    const db = await getDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['cards_cache', 'decks', 'training_history'], 'readwrite');
      tx.objectStore('cards_cache').clear();
      tx.objectStore('decks').clear();
      tx.objectStore('training_history').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });

    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(ACTIVE_DECK_KEY);
    localStorage.removeItem(PRESETS_KEY);
  }

  // --- CSV Export Helper with BOM ---
  function exportCSV(filename, headers, rows) {
    // Add UTF-8 BOM so Excel opens Japanese characters correctly
    const BOM = '\uFEFF';
    const escapeCol = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(escapeCol).join(',');
    const bodyLines = rows.map((row) => row.map(escapeCol).join(','));
    const csvContent = BOM + [headerLine, ...bodyLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    getCachedCard,
    cacheCard,
    getAllDecks,
    getDeck,
    saveDeck,
    deleteDeck,
    saveTrainingRecord,
    getAllHistory,
    clearHistory,
    getSettings,
    saveSettings,
    getActiveDeckId,
    setActiveDeckId,
    getConditionPresets,
    saveConditionPresets,
    exportAllDataJSON,
    importAllDataJSON,
    resetAllData,
    exportCSV
  };
})();
