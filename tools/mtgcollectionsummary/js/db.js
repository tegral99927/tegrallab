/**
 * MTGCollectionSummary - db.js
 * IndexedDB persistence layer for collection, decks, versions, wishlist, cache, and settings.
 */

(function (window) {
  'use strict';

  const DB_NAME = 'MTGCollectionSummaryDB';
  const DB_VERSION = 1;

  class StorageDB {
    constructor() {
      this.db = null;
      this.initPromise = null;
    }

    init() {
      if (this.initPromise) return this.initPromise;

      this.initPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          console.error('IndexedDB is not supported in this browser.');
          reject(new Error('IndexedDB not supported'));
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Collection store
          if (!db.objectStoreNames.contains('collection')) {
            const colStore = db.createObjectStore('collection', { keyPath: 'id' });
            colStore.createIndex('oracle_id', 'oracle_id', { unique: false });
            colStore.createIndex('name', 'name', { unique: false });
            colStore.createIndex('name_ja', 'name_ja', { unique: false });
            colStore.createIndex('set', 'set', { unique: false });
          }

          // Decks store
          if (!db.objectStoreNames.contains('decks')) {
            const deckStore = db.createObjectStore('decks', { keyPath: 'id' });
            deckStore.createIndex('format', 'format', { unique: false });
            deckStore.createIndex('updated_at', 'updated_at', { unique: false });
            deckStore.createIndex('favorite', 'favorite', { unique: false });
          }

          // Deck versions store
          if (!db.objectStoreNames.contains('deck_versions')) {
            const verStore = db.createObjectStore('deck_versions', { keyPath: 'id' });
            verStore.createIndex('deck_id', 'deck_id', { unique: false });
            verStore.createIndex('created_at', 'created_at', { unique: false });
          }

          // Wishlist store
          if (!db.objectStoreNames.contains('wishlist')) {
            const wishStore = db.createObjectStore('wishlist', { keyPath: 'id' });
            wishStore.createIndex('oracle_id', 'oracle_id', { unique: false });
            wishStore.createIndex('name', 'name', { unique: false });
            wishStore.createIndex('priority', 'priority', { unique: false });
            wishStore.createIndex('status', 'status', { unique: false });
          }

          // Tags store
          if (!db.objectStoreNames.contains('tags')) {
            db.createObjectStore('tags', { keyPath: 'name' });
          }

          // Settings store
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }

          // Scryfall Cache store
          if (!db.objectStoreNames.contains('scryfall_cache')) {
            const cacheStore = db.createObjectStore('scryfall_cache', { keyPath: 'key' });
            cacheStore.createIndex('updated_at', 'updated_at', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('IndexedDB open error:', event.target.error);
          reject(event.target.error);
        };
      });

      return this.initPromise;
    }

    async getTransaction(storeName, mode = 'readonly') {
      const db = await this.init();
      return db.transaction(storeName, mode);
    }

    async getAll(storeName) {
      const tx = await this.getTransaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async get(storeName, key) {
      const tx = await this.getTransaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async getByIndex(storeName, indexName, value) {
      const tx = await this.getTransaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      return new Promise((resolve, reject) => {
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async put(storeName, value) {
      const tx = await this.getTransaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async bulkPut(storeName, items) {
      if (!items || items.length === 0) return true;
      const tx = await this.getTransaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        items.forEach(item => store.put(item));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }

    async delete(storeName, key) {
      const tx = await this.getTransaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }

    async clear(storeName) {
      const tx = await this.getTransaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      return new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    }

    // Settings helpers
    async getSetting(key, defaultValue = null) {
      const record = await this.get('settings', key);
      return record ? record.value : defaultValue;
    }

    async setSetting(key, value) {
      return this.put('settings', { key, value, updated_at: new Date().toISOString() });
    }

    // Scryfall Cache helpers (TTL = 7 days default)
    async getCache(key, ttlDays = 7) {
      const cached = await this.get('scryfall_cache', key);
      if (!cached) return null;
      const now = Date.now();
      const age = now - (cached.timestamp || 0);
      if (age > ttlDays * 24 * 60 * 60 * 1000) {
        // Expired
        return null;
      }
      return cached.data;
    }

    async setCache(key, data) {
      try {
        await this.put('scryfall_cache', {
          key,
          data,
          timestamp: Date.now(),
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Cache write failed:', e);
      }
    }

    // Full export for JSON backup
    async exportBackup() {
      const collection = await this.getAll('collection');
      const decks = await this.getAll('decks');
      const deck_versions = await this.getAll('deck_versions');
      const wishlist = await this.getAll('wishlist');
      const tags = await this.getAll('tags');
      const settings = await this.getAll('settings');

      return {
        version: '1.0.0',
        app: 'MTGCollectionSummary',
        exported_at: new Date().toISOString(),
        data: {
          collection,
          decks,
          deck_versions,
          wishlist,
          tags,
          settings
        }
      };
    }

    // Full or merge restore
    async importBackup(backupData, mode = 'merge') {
      if (!backupData || !backupData.data) {
        throw new Error('無効なバックアップデータ形式です。');
      }

      const { collection, decks, deck_versions, wishlist, tags, settings } = backupData.data;

      if (mode === 'replace') {
        // Wipe existing stores
        await this.clear('collection');
        await this.clear('decks');
        await this.clear('deck_versions');
        await this.clear('wishlist');
        await this.clear('tags');
        await this.clear('settings');
      }

      if (Array.isArray(collection)) await this.bulkPut('collection', collection);
      if (Array.isArray(decks)) await this.bulkPut('decks', decks);
      if (Array.isArray(deck_versions)) await this.bulkPut('deck_versions', deck_versions);
      if (Array.isArray(wishlist)) await this.bulkPut('wishlist', wishlist);
      if (Array.isArray(tags)) await this.bulkPut('tags', tags);
      if (Array.isArray(settings)) await this.bulkPut('settings', settings);

      return true;
    }
  }

  window.DB = new StorageDB();
})(window);

