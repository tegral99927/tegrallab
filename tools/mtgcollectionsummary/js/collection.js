/**
 * MTGCollectionSummary - collection.js
 * Comprehensive card collection management, batch operations,
 * filtering, analytics, and duplicate detection.
 */

(function (window) {
  'use strict';

  class CollectionManager {
    constructor() {
      this.items = [];
    }

    async load() {
      if (window.DB) {
        this.items = await window.DB.getAll('collection');
      }
      return this.items;
    }

    // Add card to collection
    async addCard(cardData, options = {}) {
      if (!cardData) return null;

      const id = options.id || Utils.generateId('col');
      const item = {
        id: id,
        oracle_id: cardData.oracle_id || cardData.id,
        card_id: cardData.id,
        name: cardData.name,
        name_ja: cardData.name_ja || '',
        display_name: cardData.display_name || cardData.name_ja || cardData.name,
        set: (options.set || cardData.set || '').toUpperCase(),
        set_name: cardData.set_name || '',
        collector_number: String(options.collector_number || cardData.collector_number || ''),
        count: parseInt(options.count, 10) || 1,
        foil: !!options.foil,
        condition: options.condition || 'NM', // NM, SP, MP, HP, D
        language: options.language || (cardData.lang === 'ja' ? 'ja' : 'en'),
        purchase_price: parseFloat(options.purchase_price) || 0,
        purchase_date: options.purchase_date || new Date().toISOString().split('T')[0],
        location: options.location || 'ストレージ',
        memo: options.memo || '',
        tags: Array.isArray(options.tags) ? options.tags : [],
        mana_cost: cardData.mana_cost || '',
        cmc: cardData.cmc || 0,
        type_line: cardData.type_line || '',
        colors: cardData.colors || [],
        color_identity: cardData.color_identity || [],
        rarity: cardData.rarity || 'common',
        image_uri: cardData.image_uri || '',
        price_usd: parseFloat(cardData.prices?.usd) || 0,
        price_usd_foil: parseFloat(cardData.prices?.usd_foil) || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if an identical record already exists (same oracle_id, set, collector_number, foil, condition, language)
      const existing = this.items.find(
        (i) =>
          i.oracle_id === item.oracle_id &&
          i.set === item.set &&
          i.collector_number === item.collector_number &&
          i.foil === item.foil &&
          i.condition === item.condition &&
          i.language === item.language &&
          i.location === item.location
      );

      if (existing) {
        existing.count += item.count;
        existing.updated_at = new Date().toISOString();
        if (window.DB) await window.DB.put('collection', existing);
        return existing;
      }

      this.items.push(item);
      if (window.DB) {
        await window.DB.put('collection', item);
      }
      return item;
    }

    // Update collection record
    async updateCard(id, updates) {
      const idx = this.items.findIndex((i) => i.id === id);
      if (idx === -1) return null;

      const updated = {
        ...this.items[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (updated.count <= 0) {
        return this.deleteCard(id);
      }

      this.items[idx] = updated;
      if (window.DB) {
        await window.DB.put('collection', updated);
      }
      return updated;
    }

    // Adjust card quantity
    async changeCount(id, delta) {
      const item = this.items.find((i) => i.id === id);
      if (!item) return null;
      const newCount = item.count + delta;
      return this.updateCard(id, { count: newCount });
    }

    // Delete single card record
    async deleteCard(id) {
      this.items = this.items.filter((i) => i.id !== id);
      if (window.DB) {
        await window.DB.delete('collection', id);
      }
      return true;
    }

    // Batch operations
    async batchDelete(ids) {
      const idSet = new Set(ids);
      this.items = this.items.filter((i) => !idSet.has(i.id));
      if (window.DB) {
        for (const id of ids) {
          await window.DB.delete('collection', id);
        }
      }
      return true;
    }

    async batchUpdateLocation(ids, newLocation) {
      const updatedList = [];
      for (const id of ids) {
        const item = this.items.find((i) => i.id === id);
        if (item) {
          item.location = newLocation;
          item.updated_at = new Date().toISOString();
          updatedList.push(item);
        }
      }
      if (window.DB && updatedList.length > 0) {
        await window.DB.bulkPut('collection', updatedList);
      }
      return updatedList;
    }

    async batchAddTag(ids, tag) {
      if (!tag) return;
      const updatedList = [];
      for (const id of ids) {
        const item = this.items.find((i) => i.id === id);
        if (item) {
          if (!item.tags) item.tags = [];
          if (!item.tags.includes(tag)) {
            item.tags.push(tag);
            item.updated_at = new Date().toISOString();
            updatedList.push(item);
          }
        }
      }
      if (window.DB && updatedList.length > 0) {
        await window.DB.bulkPut('collection', updatedList);
      }
      return updatedList;
    }

    // Filter collection
    filter(criteria = {}) {
      return this.items.filter((item) => {
        if (criteria.query) {
          const q = criteria.query.toLowerCase();
          const matchName = (item.name || '').toLowerCase().includes(q);
          const matchNameJa = (item.name_ja || '').toLowerCase().includes(q);
          const matchSet = (item.set || '').toLowerCase().includes(q);
          const matchMemo = (item.memo || '').toLowerCase().includes(q);
          if (!matchName && !matchNameJa && !matchSet && !matchMemo) return false;
        }

        if (criteria.set && item.set !== criteria.set.toUpperCase()) return false;
        if (criteria.rarity && item.rarity !== criteria.rarity) return false;
        if (criteria.location && item.location !== criteria.location) return false;
        if (criteria.condition && item.condition !== criteria.condition) return false;
        if (criteria.foil !== undefined && criteria.foil !== 'all') {
          const isFoil = criteria.foil === 'foil' || criteria.foil === true;
          if (item.foil !== isFoil) return false;
        }
        if (criteria.tag && (!item.tags || !item.tags.includes(criteria.tag))) return false;

        if (criteria.type) {
          const t = criteria.type.toLowerCase();
          if (!(item.type_line || '').toLowerCase().includes(t)) return false;
        }

        return true;
      });
    }

    // Sort collection
    sort(items, sortBy = 'name_asc') {
      const list = [...items];
      list.sort((a, b) => {
        switch (sortBy) {
          case 'name_asc':
            return (a.display_name || a.name).localeCompare(b.display_name || b.name);
          case 'name_desc':
            return (b.display_name || b.name).localeCompare(a.display_name || a.name);
          case 'price_desc': {
            const pA = a.foil ? (a.price_usd_foil || a.price_usd || 0) : (a.price_usd || 0);
            const pB = b.foil ? (b.price_usd_foil || b.price_usd || 0) : (b.price_usd || 0);
            return pB - pA;
          }
          case 'count_desc':
            return b.count - a.count;
          case 'date_desc':
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          default:
            return 0;
        }
      });
      return list;
    }

    // Collection Analytics
    analyze() {
      const totalCards = this.items.reduce((s, i) => s + (i.count || 0), 0);
      const uniqueCards = new Set(this.items.map((i) => i.oracle_id || i.name)).size;
      const uniquePrintings = this.items.length;

      let totalValueUsd = 0;
      let foilCount = 0;
      const setCounts = {};
      const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, Multi: 0 };
      const rarityCounts = { common: 0, uncommon: 0, rare: 0, mythic: 0, special: 0 };
      const typeCounts = {
        creature: 0,
        instant: 0,
        sorcery: 0,
        artifact: 0,
        enchantment: 0,
        planeswalker: 0,
        battle: 0,
        land: 0,
        other: 0
      };
      const manaCurve = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
      const duplicates = [];

      this.items.forEach((item) => {
        const cnt = item.count || 1;
        const price = item.foil
          ? item.price_usd_foil || item.price_usd || 0
          : item.price_usd || 0;
        totalValueUsd += price * cnt;

        if (item.foil) foilCount += cnt;

        // Card types
        const t = (item.type_line || '').toLowerCase();
        let matchedType = false;
        if (t.includes('creature') || t.includes('クリーチャー')) { typeCounts.creature += cnt; matchedType = true; }
        if (t.includes('instant') || t.includes('インスタント')) { typeCounts.instant += cnt; matchedType = true; }
        if (t.includes('sorcery') || t.includes('ソーサリー')) { typeCounts.sorcery += cnt; matchedType = true; }
        if (t.includes('artifact') || t.includes('アーティファクト')) { typeCounts.artifact += cnt; matchedType = true; }
        if (t.includes('enchantment') || t.includes('エンチャント')) { typeCounts.enchantment += cnt; matchedType = true; }
        if (t.includes('planeswalker') || t.includes('プレインズウォーカー')) { typeCounts.planeswalker += cnt; matchedType = true; }
        if (t.includes('battle') || t.includes('バトル')) { typeCounts.battle += cnt; matchedType = true; }
        if (t.includes('land') || t.includes('土地')) { typeCounts.land += cnt; matchedType = true; }
        if (!matchedType) typeCounts.other += cnt;

        // Mana Curve (excluding lands)
        const isLand = t.includes('land') || t.includes('土地');
        if (!isLand) {
          const cmc = Math.floor(item.cmc || 0);
          if (cmc >= 7) manaCurve['7+'] += cnt;
          else if (cmc >= 0 && cmc <= 6) manaCurve[cmc] += cnt;
          else manaCurve[0] += cnt;
        }

        // Set
        const set = item.set || 'OTHER';
        setCounts[set] = (setCounts[set] || 0) + cnt;

        // Rarity
        const r = (item.rarity || 'common').toLowerCase();
        if (rarityCounts[r] !== undefined) rarityCounts[r] += cnt;
        else rarityCounts.common += cnt;

        // Colors
        const colors = item.colors || [];
        if (colors.length === 0) colorCounts.C += cnt;
        else if (colors.length > 1) colorCounts.Multi += cnt;
        else colorCounts[colors[0]] = (colorCounts[colors[0]] || 0) + cnt;

        // Duplicates (cards with count > 4, excluding basic lands)
        const isBasic = (item.type_line || '').toLowerCase().includes('basic') || (item.type_line || '').includes('基本');
        if (!isBasic && cnt > 4) {
          duplicates.push({ item, excess: cnt - 4 });
        }
      });

      // Top 10 High Value Cards
      const highValueList = [...this.items]
        .map((i) => ({
          ...i,
          unitPrice: i.foil ? (i.price_usd_foil || i.price_usd || 0) : (i.price_usd || 0)
        }))
        .filter((i) => i.unitPrice > 0)
        .sort((a, b) => b.unitPrice - a.unitPrice)
        .slice(0, 10);

      return {
        totalCards,
        uniqueCards,
        uniquePrintings,
        foilCount,
        nonFoilCount: totalCards - foilCount,
        totalValueUsd: parseFloat(totalValueUsd.toFixed(2)),
        setCounts,
        colorCounts,
        rarityCounts,
        typeCounts,
        manaCurve,
        highValueList,
        duplicates
      };
    }
  }

  window.Collection = new CollectionManager();
})(window);

