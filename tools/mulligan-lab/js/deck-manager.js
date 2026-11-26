/**
 * Mulligan Lab - Deck Manager
 * Manages active deck state, card roles/tags, Scryfall metadata synchronization,
 * auto-categorization heuristics, and deck versions.
 */

const DeckManager = (() => {
  // Pre-defined system tags with distinct palette colors
  const DEFAULT_TAGS = [
    { id: 'tag_land', name: '土地', color: '#4ade80', isSystem: true },
    { id: 'tag_untap_land', name: 'アンタップイン土地', color: '#10b981', isSystem: true },
    { id: 'tag_tap_land', name: 'タップイン土地', color: '#059669', isSystem: true },
    { id: 'tag_ramp', name: 'マナ加速', color: '#f59e0b', isSystem: true },
    { id: 'tag_early', name: '初動', color: '#38bdf8', isSystem: true },
    { id: 'tag_draw', name: 'ドロー', color: '#60a5fa', isSystem: true },
    { id: 'tag_cantrip', name: 'キャントリップ', color: '#93c5fd', isSystem: true },
    { id: 'tag_tutor', name: 'サーチ', color: '#a855f7', isSystem: true },
    { id: 'tag_combo_a', name: 'コンボパーツA', color: '#ec4899', isSystem: true },
    { id: 'tag_combo_b', name: 'コンボパーツB', color: '#f43f5e', isSystem: true },
    { id: 'tag_combo_c', name: 'コンボパーツC', color: '#fb7185', isSystem: true },
    { id: 'tag_combo_start', name: 'コンボ始動カード', color: '#d946ef', isSystem: true },
    { id: 'tag_key', name: 'キーカード', color: '#eab308', isSystem: true },
    { id: 'tag_finisher', name: 'フィニッシャー', color: '#ef4444', isSystem: true },
    { id: 'tag_removal', name: '除去', color: '#dc2626', isSystem: true },
    { id: 'tag_counter', name: '打ち消し', color: '#2563eb', isSystem: true },
    { id: 'tag_discard', name: '手札破壊', color: '#64748b', isSystem: true },
    { id: 'tag_anti_hate', name: '妨害対策', color: '#14b8a6', isSystem: true },
    { id: 'tag_graveyard_hate', name: '墓地対策', color: '#8b5cf6', isSystem: true },
    { id: 'tag_unwanted', name: 'キープしたくないカード', color: '#78716c', isSystem: true }
  ];

  // Active in-memory deck state
  let currentDeck = null;
  let cardMetadata = new Map(); // key (card name lower) -> Scryfall normalized data

  /**
   * Initializes or loads a new deck structure.
   */
  function createBlankDeck(name = '新規デッキ', format = 'modern') {
    return {
      id: 'deck_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name,
      format: format,
      mainboard: [],
      sideboard: [],
      commander: [],
      companion: [],
      cardTags: {}, // cardNameLower -> array of tagNames
      customTags: [], // user-defined tag objects { id, name, color }
      mdfcLandSettings: {}, // cardNameLower -> boolean (treat as land)
      keepConditions: getDefaultKeepConditions(),
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function getDefaultKeepConditions() {
    return {
      id: 'root',
      type: 'group',
      operator: 'AND',
      children: [
        {
          id: 'rule_land_range',
          type: 'rule',
          field: 'lands',
          min: 2,
          max: 4
        },
        {
          id: 'rule_early_or_key',
          type: 'group',
          operator: 'OR',
          children: [
            { id: 'rule_sub_early', type: 'rule', field: 'tag', tag: '初動', min: 1 },
            { id: 'rule_sub_key', type: 'rule', field: 'tag', tag: 'キーカード', min: 1 },
            { id: 'rule_sub_cantrip', type: 'rule', field: 'tag', tag: 'キャントリップ', min: 1 }
          ]
        }
      ]
    };
  }

  /**
   * Returns default sample deck (Modern Izzet Murktide) with full card list & metadata.
   */
  function getSampleDeck() {
    const deck = createBlankDeck('Modern - Izzet Murktide (サンプル)', 'modern');
    deck.mainboard = [
      { count: 4, name: 'Dragon\'s Rage Channeler', set: 'MH2', collector_number: '121' },
      { count: 4, name: 'Murktide Regent', set: 'MH2', collector_number: '52' },
      { count: 4, name: 'Ragavan, Nimble Pilferer', set: 'MH2', collector_number: '138' },
      { count: 4, name: 'Consider', set: 'MID', collector_number: '44' },
      { count: 4, name: 'Counterspell', set: 'MH2', collector_number: '267' },
      { count: 4, name: 'Lightning Bolt', set: 'CLB', collector_number: '187' },
      { count: 4, name: 'Mishra\'s Bauble', set: '2XM', collector_number: '274' },
      { count: 4, name: 'Preordain', set: 'M11', collector_number: '70' },
      { count: 4, name: 'Unholy Heat', set: 'MH2', collector_number: '145' },
      { count: 2, name: 'Spell Pierce', set: 'NEO', collector_number: '80' },
      { count: 4, name: 'Flooded Strand', set: 'MH3', collector_number: '220' },
      { count: 4, name: 'Polluted Delta', set: 'MH3', collector_number: '224' },
      { count: 4, name: 'Scalding Tarn', set: 'MH2', collector_number: '254' },
      { count: 3, name: 'Spirebluff Canal', set: 'OTJ', collector_number: '270' },
      { count: 3, name: 'Steam Vents', set: 'RVR', collector_number: '288' },
      { count: 3, name: 'Island', set: 'UNF', collector_number: '236' },
      { count: 1, name: 'Mountain', set: 'UNF', collector_number: '243' }
    ];
    deck.sideboard = [
      { count: 2, name: 'Blood Moon' },
      { count: 2, name: 'Flusterstorm' },
      { count: 2, name: 'Subtlety' },
      { count: 2, name: 'Surgical Extraction' }
    ];

    // Pre-assigned tags for sample deck
    deck.cardTags = {
      'dragon\'s rage channeler': ['初動', 'キーカード'],
      'murktide regent': ['フィニッシャー', 'キーカード'],
      'ragavan, nimble pilferer': ['初動', 'マナ加速', 'キーカード'],
      'consider': ['キャントリップ', 'ドロー', '初動'],
      'counterspell': ['打ち消し'],
      'lightning bolt': ['除去', '初動'],
      'mishra\'s bauble': ['キャントリップ', '初動'],
      'preordain': ['キャントリップ', 'ドロー', '初動'],
      'unholy heat': ['除去', '初動'],
      'spell pierce': ['打ち消し', '妨害対策'],
      'flooded strand': ['土地', 'アンタップイン土地'],
      'polluted delta': ['土地', 'アンタップイン土地'],
      'scalding tarn': ['土地', 'アンタップイン土地'],
      'spirebluff canal': ['土地', 'アンタップイン土地'],
      'steam vents': ['土地', 'アンタップイン土地'],
      'island': ['土地', 'アンタップイン土地'],
      'mountain': ['土地', 'アンタップイン土地']
    };

    return deck;
  }

  /**
   * Applies automated tag heuristics to cards based on Scryfall metadata.
   */
  function autoCategorizeCards(cards, metaMap) {
    const updatedTags = {};

    for (const card of cards) {
      const key = card.name.toLowerCase().trim();
      const meta = metaMap.get(key);
      const tags = new Set();

      if (meta) {
        const type = (meta.type_line || '').toLowerCase();
        const oracle = (meta.oracle_text || '').toLowerCase();
        const cmc = meta.cmc || 0;

        // Land detection
        if (meta.isLand || type.includes('land')) {
          tags.add('土地');
          if (oracle.includes('enters the battlefield tapped') && !oracle.includes('unless')) {
            tags.add('タップイン土地');
          } else {
            tags.add('アンタップイン土地');
          }
        } else {
          // Removal
          if (oracle.includes('destroy target') || oracle.includes('exile target') || oracle.includes('deals damage to any target') || oracle.includes('deals damage to target')) {
            tags.add('除去');
          }
          // Counterspell
          if (oracle.includes('counter target') && (type.includes('instant') || oracle.includes('flash'))) {
            tags.add('打ち消し');
          }
          // Tutor / Search
          if (oracle.includes('search your library for')) {
            tags.add('サーチ');
          }
          // Cantrip / Draw
          if (oracle.includes('draw a card') && cmc <= 2) {
            tags.add('キャントリップ');
            tags.add('ドロー');
          } else if (oracle.includes('draw ') && oracle.includes('card')) {
            tags.add('ドロー');
          }
          // Mana Ramp
          if (oracle.includes('add {') || oracle.includes('search your library for a basic land card')) {
            tags.add('マナ加速');
          }
          // Discard
          if (oracle.includes('target player discards') || oracle.includes('target opponent reveals their hand')) {
            tags.add('手札破壊');
          }
          // Graveyard hate
          if (oracle.includes('exile all cards from') || oracle.includes('exile target card from a graveyard')) {
            tags.add('墓地対策');
          }
          // Early play candidate
          if (cmc <= 1) {
            tags.add('初動');
          }
        }
      }

      if (tags.size > 0) {
        updatedTags[key] = Array.from(tags);
      }
    }

    return updatedTags;
  }

  function getCurrentDeck() {
    return currentDeck;
  }

  function setCurrentDeck(deck) {
    currentDeck = deck;
  }

  function getCardMetadata(cardName) {
    if (!cardName) return null;
    return cardMetadata.get(cardName.toLowerCase().trim()) || null;
  }

  function setCardMetadata(cardName, data) {
    if (!cardName || !data) return;
    cardMetadata.set(cardName.toLowerCase().trim(), data);
  }

  function getAllAvailableTags() {
    const custom = (currentDeck && currentDeck.customTags) || [];
    return [...DEFAULT_TAGS, ...custom];
  }

  function addCustomTag(name, color) {
    if (!currentDeck) return null;
    if (!currentDeck.customTags) currentDeck.customTags = [];

    const existing = getAllAvailableTags().find(t => t.name.toLowerCase() === name.toLowerCase().trim());
    if (existing) return existing;

    const newTag = {
      id: 'tag_custom_' + Date.now(),
      name: name.trim(),
      color: color || '#6366f1',
      isSystem: false
    };
    currentDeck.customTags.push(newTag);
    return newTag;
  }

  function assignTagToCard(cardName, tagName) {
    if (!currentDeck) return;
    if (!currentDeck.cardTags) currentDeck.cardTags = {};
    const key = cardName.toLowerCase().trim();
    if (!currentDeck.cardTags[key]) currentDeck.cardTags[key] = [];

    if (!currentDeck.cardTags[key].includes(tagName)) {
      currentDeck.cardTags[key].push(tagName);
    }
  }

  function removeTagFromCard(cardName, tagName) {
    if (!currentDeck || !currentDeck.cardTags) return;
    const key = cardName.toLowerCase().trim();
    if (!currentDeck.cardTags[key]) return;

    currentDeck.cardTags[key] = currentDeck.cardTags[key].filter(t => t !== tagName);
  }

  function getTagsForCard(cardName) {
    if (!currentDeck || !currentDeck.cardTags) return [];
    return currentDeck.cardTags[cardName.toLowerCase().trim()] || [];
  }

  return {
    DEFAULT_TAGS,
    createBlankDeck,
    getDefaultKeepConditions,
    getSampleDeck,
    autoCategorizeCards,
    getCurrentDeck,
    setCurrentDeck,
    getCardMetadata,
    setCardMetadata,
    getAllAvailableTags,
    addCustomTag,
    assignTagToCard,
    removeTagFromCard,
    getTagsForCard
  };
})();
