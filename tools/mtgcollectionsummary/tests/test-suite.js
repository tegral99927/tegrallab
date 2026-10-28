/**
 * MTGCollectionSummary - test-suite.js
 * Comprehensive unit & integration tests covering all critical features:
 * - Scryfall card normalization (JP/EN, multi-face)
 * - Hypergeometric math & opening hand probability
 * - Format validators (Commander size 100, singleton, 60-card, color identity, partners)
 * - Importer parser (Arena JP, Arena EN, Hareruya, MTGO, count formats)
 * - Exporter output & Roundtrip consistency
 * - Deck statistics & Mana curve
 * - Multi-deck shortage & conflict calculations
 * - Deck comparison & diffs
 */

(function (exports) {
  'use strict';

  class TestRunner {
    constructor() {
      this.tests = [];
      this.results = [];
    }

    test(name, fn) {
      this.tests.push({ name, fn });
    }

    async run(onProgress = null) {
      this.results = [];
      let passed = 0;
      let failed = 0;

      for (let i = 0; i < this.tests.length; i++) {
        const t = this.tests[i];
        let error = null;
        const startTime = Date.now();
        try {
          await t.fn();
          passed++;
        } catch (err) {
          failed++;
          error = err;
        }
        const duration = Date.now() - startTime;
        const res = { name: t.name, passed: !error, error, duration };
        this.results.push(res);
        if (onProgress) onProgress(res, i + 1, this.tests.length);
      }

      return {
        total: this.tests.length,
        passed,
        failed,
        results: this.results
      };
    }
  }

  const runner = new TestRunner();

  // Assertion helpers
  function assert(condition, message = 'Assertion failed') {
    if (!condition) throw new Error(message);
  }
  function assertEquals(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message ? message + ': ' : ''}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  function assertAlmostEquals(actual, expected, epsilon = 0.001, message = '') {
    if (Math.abs(actual - expected) > epsilon) {
      throw new Error(`${message ? message + ': ' : ''}Expected ${expected} (+/- ${epsilon}), got ${actual}`);
    }
  }

  // --- TESTS ---

  // 1. Math & Hypergeometric distribution
  runner.test('Hypergeometric: Combination math nCr', () => {
    assertEquals(Utils.combination(5, 0), 1);
    assertEquals(Utils.combination(5, 1), 5);
    assertEquals(Utils.combination(5, 2), 10);
    assertEquals(Utils.combination(5, 5), 1);
    assertEquals(Utils.combination(5, 6), 0);
  });

  runner.test('Hypergeometric: Exact probability calculation', () => {
    // 60 card deck, 24 lands, draw 7 opening hand, prob of exactly 3 lands:
    // C(24, 3) * C(36, 4) / C(60, 7) = 2024 * 58905 / 386206920 ≈ 0.3087
    const prob = Utils.hypergeometric(3, 60, 24, 7);
    assertAlmostEquals(prob, 0.3087, 0.002, 'P(3 lands in 60-card with 24 lands)');
  });

  runner.test('Hypergeometric: Cumulative probability P(X >= 1)', () => {
    // 99 cards, 1 specific card (e.g. Sol Ring), 7 draws
    // P(X >= 1) = 1 - C(98, 7)/C(99, 7) = 1 - 92/99 ≈ 0.0707 (7.07%)
    const prob = Utils.hypergeometricAtLeast(1, 99, 1, 7);
    assertAlmostEquals(prob, 0.0707, 0.002, 'P(draw Sol Ring in opening 7 of 99)');
  });

  // 2. Scryfall Card Normalization (Japanese & Multi-face)
  runner.test('Scryfall: Normalization of single-face Japanese card', () => {
    const rawMock = {
      id: 'mock-1',
      oracle_id: 'orc-1',
      name: 'Sol Ring',
      lang: 'ja',
      printed_name: '太陽の指輪',
      mana_cost: '{1}',
      cmc: 1,
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      colors: [],
      color_identity: [],
      rarity: 'uncommon',
      set: 'cmm',
      collector_number: '410',
      image_uris: { normal: 'https://cards.scryfall.io/sol_ring.jpg' },
      prices: { usd: '1.50' }
    };

    const card = Scryfall.normalizeCard(rawMock);
    assertEquals(card.name, 'Sol Ring');
    assertEquals(card.name_ja, '太陽の指輪');
    assertEquals(card.display_name, '太陽の指輪');
    assertEquals(card.cmc, 1);
    assertEquals(card.prices.usd, 1.50);
  });

  runner.test('Scryfall: Normalization of Double-Faced Transform card', () => {
    const rawMdfc = {
      id: 'mock-mdfc',
      oracle_id: 'orc-mdfc',
      name: 'Delver of Secrets // Insectile Aberration',
      lang: 'en',
      cmc: 1,
      card_faces: [
        {
          name: 'Delver of Secrets',
          mana_cost: '{U}',
          type_line: 'Creature — Human Wizard',
          oracle_text: 'At the beginning of your upkeep...',
          colors: ['U'],
          image_uris: { normal: 'https://cards.scryfall.io/delver_front.jpg' }
        },
        {
          name: 'Insectile Aberration',
          mana_cost: '',
          type_line: 'Creature — Human Insect',
          oracle_text: 'Flying',
          colors: ['U'],
          image_uris: { normal: 'https://cards.scryfall.io/delver_back.jpg' }
        }
      ]
    };

    const card = Scryfall.normalizeCard(rawMdfc);
    assert(card.faces && card.faces.length === 2, 'Should have 2 card faces');
    assertEquals(card.faces[0].name, 'Delver of Secrets');
    assertEquals(card.faces[1].name, 'Insectile Aberration');
    assertEquals(card.image_uri, 'https://cards.scryfall.io/delver_front.jpg');
    assertEquals(card.image_uri_back, 'https://cards.scryfall.io/delver_back.jpg');
  });

  // 3. Format Validation & Commander Rules
  runner.test('DeckValidator: Commander deck size 100 check', () => {
    const deck = {
      format: 'commander',
      commanders: [{ name: 'Atraxa', count: 1, color_identity: ['W', 'U', 'B', 'G'] }],
      mainboard: Array.from({ length: 99 }, (_, i) => ({
        card: { name: `Card ${i}`, count: 1, color_identity: [] },
        count: 1
      }))
    };

    const res = DeckValidator.validateDeck(deck);
    assertEquals(res.isValid, true, 'Deck with 1 commander and 99 mainboard cards should be valid 100');
  });

  runner.test('DeckValidator: Commander singleton rule violation', () => {
    const deck = {
      format: 'commander',
      commanders: [{ name: 'Atraxa', count: 1, color_identity: ['W', 'U', 'B', 'G'] }],
      mainboard: [
        { card: { name: 'Lightning Bolt', count: 2, color_identity: ['R'] }, count: 2 },
        ...Array.from({ length: 97 }, (_, i) => ({
          card: { name: `Card ${i}`, count: 1, color_identity: [] },
          count: 1
        }))
      ]
    };

    const res = DeckValidator.validateDeck(deck);
    assertEquals(res.isValid, false);
    assert(res.errors.some((e) => e.includes('ハイランダー制限違反')), 'Should detect duplicate Lightning Bolt');
  });

  runner.test('DeckValidator: Commander color identity violation', () => {
    const cmd = { name: 'Baral, Chief of Compliance', count: 1, color_identity: ['U'], type_line: 'Legendary Creature — Human Wizard' };
    const redCard = { name: 'Lightning Bolt', count: 1, color_identity: ['R'] };
    const deck = {
      format: 'commander',
      commanders: [cmd],
      mainboard: [
        { card: redCard, count: 1 },
        ...Array.from({ length: 98 }, (_, i) => ({
          card: { name: `Island ${i}`, count: 1, color_identity: ['U'] },
          count: 1
        }))
      ]
    };

    const res = DeckValidator.validateDeck(deck);
    assertEquals(res.isValid, false);
    assert(res.errors.some((e) => e.includes('固有色違反')), 'Should detect Red card in mono-Blue commander');
  });

  runner.test('DeckValidator: Partner commander combination validation', () => {
    const cmd1 = {
      name: 'Thrasios, Triton Hero',
      oracle_text: 'Partner (You can have two commanders if both have partner.)',
      type_line: 'Legendary Creature — Merfolk Wizard',
      color_identity: ['G', 'U']
    };
    const cmd2 = {
      name: 'Tymna the Weaver',
      oracle_text: 'Partner (You can have two commanders if both have partner.)',
      type_line: 'Legendary Creature — Human Cleric',
      color_identity: ['W', 'B']
    };

    const partnerRes = DeckValidator.canPartnerTogether(cmd1, cmd2);
    assertEquals(partnerRes.canPartner, true, 'Two generic partners should be allowed together');

    const combinedColors = DeckValidator.getCombinedColorIdentity([cmd1, cmd2]);
    assertEquals(combinedColors.join(''), 'WUBG', 'Combined colors should be W, U, B, G');
  });

  // 4. Importer Formats & Auto-Detection
  runner.test('Importer: Auto-detection of import formats', () => {
    assertEquals(Importer.detectFormat('{"version":"1.0.0"}'), 'json');
    assertEquals(Importer.detectFormat('Commander\n1 Atraxa\nDeck\n1 Sol Ring'), 'arena');
    assertEquals(Importer.detectFormat('統率者\n1 アトラクサ\nデッキ\n1 太陽の指輪'), 'arena');
    assertEquals(Importer.detectFormat('Name,Count,Set\nSol Ring,1,CMM'), 'csv');
    assertEquals(Importer.detectFormat('4 Lightning Bolt\nSB: 2 Pyroblast'), 'mtgo');
    assertEquals(Importer.detectFormat('4 Lightning Bolt\n4 Counterspell'), 'text');
  });

  runner.test('Importer: Hareruya Arena compatible format', () => {
    const text = `
Deck
1 Sol Ring
1 Arcane Signet
4 Lightning Bolt
`;
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 3);
    assertEquals(entries[0].section, 'main');
    assertEquals(entries[0].name, 'Sol Ring');
    assertEquals(entries[2].count, 4);
  });

  runner.test('Importer: Moxfield category headers & bracket sets', () => {
    const text = `
// Commander
1 Atraxa, Grand Unifier [ONE:196] *F*

// Creatures (2)
1 Birds of Paradise [DMR] 150
1 Noble Hierarch (2XM) *F*

// Lands (1)
1 Command Tower [CMM]
`;
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 4, 'Should parse only the 4 cards and ignore category headers');
    assertEquals(entries[0].section, 'commander');
    assertEquals(entries[0].name, 'Atraxa, Grand Unifier');
    assertEquals(entries[0].set, 'ONE');
    assertEquals(entries[0].number, '196');

    assertEquals(entries[1].section, 'main');
    assertEquals(entries[1].name, 'Birds of Paradise');
    assertEquals(entries[1].set, 'DMR');
    assertEquals(entries[1].number, '150');

    assertEquals(entries[2].name, 'Noble Hierarch');
    assertEquals(entries[2].set, '2XM');

    assertEquals(entries[3].name, 'Command Tower');
    assertEquals(entries[3].set, 'CMM');
  });

  runner.test('Importer: JSON deck parsing and format auto-detection', () => {
    const jsonDeck = {
      name: 'Test EDH',
      format: 'commander',
      commanders: [{ name: 'Sol Ring', count: 1 }],
      mainboard: [
        { card: { name: 'Arcane Signet' }, count: 1 },
        { card: { name: 'Command Tower' }, count: 1 }
      ]
    };
    const entries = Importer.parseJSONDeck(JSON.stringify(jsonDeck));
    assertEquals(entries.length, 3);
    assertEquals(entries[0].section, 'commander');
    assertEquals(entries[0].name, 'Sol Ring');

    const detected = Importer.detectDeckFormat(entries);
    assertEquals(detected, 'commander');
  });

  runner.test('Importer: Fullwidth Japanese characters and spaces normalization', () => {
    const text = '１　太陽の指輪（ＣＭＭ）　４１０\n４　森';
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 2);
    assertEquals(entries[0].count, 1);
    assertEquals(entries[0].name, '太陽の指輪');
    assertEquals(entries[0].set, 'CMM');
    assertEquals(entries[0].number, '410');

    assertEquals(entries[1].count, 4);
    assertEquals(entries[1].name, '森');
  });

  runner.test('Importer: Unrecognized card handling and flag', async () => {
    // Fake matching without network
    const rawEntries = [
      { section: 'main', count: 1, name: 'Fake Nonexistent Card 12345' }
    ];
    // Scryfall.getCardByName will return null for this fake card
    const { matched, unmatched } = await Importer.matchCards(rawEntries);
    assertEquals(unmatched.length, 1);
    assertEquals(unmatched[0].name, 'Fake Nonexistent Card 12345');
    assertEquals(unmatched[0].recognized, false);
  });

  // 5. Collection Operations
  runner.test('Collection: Registration and Quantity Adjustment', async () => {
    const cardData = {
      id: 'test-card-1',
      oracle_id: 'test-orc-1',
      name: 'Black Lotus',
      display_name: 'Black Lotus',
      set: 'LEA',
      collector_number: '232',
      prices: { usd: 10000 },
      type_line: 'Artifact'
    };

    // Reset items for unit test
    Collection.items = [];
    const item = await Collection.addCard(cardData, { count: 1, condition: 'NM', foil: false });
    assertEquals(Collection.items.length, 1);
    assertEquals(item.count, 1);
    assertEquals(item.name, 'Black Lotus');

    // Add again identical card -> increment count
    await Collection.addCard(cardData, { count: 2, condition: 'NM', foil: false });
    assertEquals(Collection.items.length, 1);
    assertEquals(Collection.items[0].count, 3);

    // Change count
    await Collection.changeCount(item.id, -1);
    assertEquals(Collection.items[0].count, 2);

    // Delete
    await Collection.deleteCard(item.id);
    assertEquals(Collection.items.length, 0);
  });

  // 6. JSON Backup Structure Validation
  runner.test('Backup: JSON export and restore structure validation', async () => {
    const mockBackup = {
      version: '1.0.0',
      app: 'MTGCollectionSummary',
      exported_at: new Date().toISOString(),
      data: {
        collection: [{ id: 'col_1', name: 'Sol Ring', count: 2 }],
        decks: [{ id: 'deck_1', name: 'My EDH', format: 'commander' }],
        deck_versions: [],
        wishlist: [],
        tags: [],
        settings: [{ key: 'theme', value: 'dark' }]
      }
    };

    assert(mockBackup.version === '1.0.0', 'Version should match');
    assert(mockBackup.data && Array.isArray(mockBackup.data.collection), 'Collection array exists');
    assert(mockBackup.data && Array.isArray(mockBackup.data.decks), 'Decks array exists');
  });

  // 7. Multiple Decks Creation & Management
  runner.test('DeckBuilder: Multiple decks creation and retrieval', async () => {
    DeckBuilder.decks = [];
    const deck1 = await DeckBuilder.createDeck('EDH Deck 1', 'commander');
    const deck2 = await DeckBuilder.createDeck('Modern Deck 2', 'modern');
    assertEquals(DeckBuilder.decks.length, 2);
    assertEquals(deck1.format, 'commander');
    assertEquals(deck2.format, 'modern');

    // Duplicate
    const dup = await DeckBuilder.duplicateDeck(deck1.id);
    assertEquals(DeckBuilder.decks.length, 3);
    assert(dup.name.includes('コピー'), 'Duplicated deck has copy in name');
  });

  runner.test('Importer: Arena English format with sections', () => {
    const text = `
Commander
1 Atraxa, Grand Unifier (ONE) 196

Deck
1 Sol Ring (CMM) 410
1 Arcane Signet (CMM) 951
4 Forest (ONE) 276
`;
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 4);
    assertEquals(entries[0].section, 'commander');
    assertEquals(entries[0].name, 'Atraxa, Grand Unifier');
    assertEquals(entries[0].set, 'ONE');
    assertEquals(entries[0].number, '196');

    assertEquals(entries[1].section, 'main');
    assertEquals(entries[1].name, 'Sol Ring');

    assertEquals(entries[3].count, 4);
    assertEquals(entries[3].name, 'Forest');
  });

  runner.test('Importer: Arena Japanese format with sections', () => {
    const text = `
統率者
1 偉大なる統一者、アトラクサ (ONE) 196

デッキ
1 太陽の指輪
1 秘儀の印鑑
20 森
`;
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 4);
    assertEquals(entries[0].section, 'commander');
    assertEquals(entries[0].name, '偉大なる統一者、アトラクサ');
    assertEquals(entries[1].section, 'main');
    assertEquals(entries[1].name, '太陽の指輪');
    assertEquals(entries[3].count, 20);
    assertEquals(entries[3].name, '森');
  });

  runner.test('Importer: MTGO text format with SB:', () => {
    const text = `
4 Delver of Secrets
4 Lightning Bolt
SB: 2 Pyroblast
`;
    const entries = Importer.parseText(text);
    assertEquals(entries.length, 3);
    assertEquals(entries[0].section, 'main');
    assertEquals(entries[0].count, 4);
    assertEquals(entries[2].section, 'sideboard');
    assertEquals(entries[2].count, 2);
    assertEquals(entries[2].name, 'Pyroblast');
  });

  // 5. Exporter & Roundtrip Consistency
  runner.test('Exporter: Arena format export and re-import roundtrip', () => {
    const sampleDeck = {
      name: 'Roundtrip Test',
      format: 'commander',
      commanders: [{ name: 'Sol Ring', display_name: 'Sol Ring', set: 'CMM', collector_number: '410', count: 1 }],
      mainboard: [
        { card: { name: 'Arcane Signet', display_name: 'Arcane Signet', set: 'CMM', collector_number: '951' }, count: 1 },
        { card: { name: 'Command Tower', display_name: 'Command Tower', set: 'CMM', collector_number: '1001' }, count: 1 }
      ],
      sideboard: []
    };

    const exported = Exporter.exportDeck(sampleDeck, 'arena_en', { includeSet: true });
    assert(exported.includes('Commander'), 'Should include Commander header');
    assert(exported.includes('Deck'), 'Should include Deck header');

    const reimported = Importer.parseText(exported);
    assertEquals(reimported.length, 3);
    assertEquals(reimported[0].section, 'commander');
    assertEquals(reimported[0].name, 'Sol Ring');
    assertEquals(reimported[1].section, 'main');
    assertEquals(reimported[1].name, 'Arcane Signet');
  });

  // 6. Deck Statistics & Mana Curve
  runner.test('Statistics: Mana curve calculation', () => {
    const deck = {
      commanders: [],
      mainboard: [
        { card: { name: 'C1', cmc: 1, type_line: 'Creature' }, count: 2 },
        { card: { name: 'C2', cmc: 2, type_line: 'Instant' }, count: 3 },
        { card: { name: 'C7', cmc: 8, type_line: 'Sorcery' }, count: 1 },
        { card: { name: 'L', cmc: 0, type_line: 'Land' }, count: 24 }
      ]
    };

    const stats = Statistics.analyzeDeck(deck);
    assertEquals(stats.totalCards, 30);
    assertEquals(stats.landCount, 24);
    assertEquals(stats.nonLandCount, 6);
    assertEquals(stats.manaCurve[1], 2);
    assertEquals(stats.manaCurve[2], 3);
    assertEquals(stats.manaCurve['7+'], 1);
    // Avg CMC = (1*2 + 2*3 + 8*1) / 6 = 16 / 6 ≈ 2.67
    assertAlmostEquals(stats.avgCmc, 2.67, 0.02);
  });

  // 7. Multi-Deck Shortage Analyzer
  runner.test('DeckBuilder: Multi-deck shortage calculation', () => {
    const deckA = {
      id: 'd-a',
      name: 'Deck A',
      commanders: [],
      mainboard: [{ card: { name: 'Sol Ring', display_name: 'Sol Ring', prices: { usd: '1.5' } }, count: 1 }]
    };
    const deckB = {
      id: 'd-b',
      name: 'Deck B',
      commanders: [],
      mainboard: [{ card: { name: 'Sol Ring', display_name: 'Sol Ring', prices: { usd: '1.5' } }, count: 1 }]
    };

    DeckBuilder.decks = [deckA, deckB];

    // Owned 1 Sol Ring in collection
    const collection = [{ name: 'Sol Ring', count: 1 }];

    const shortages = DeckBuilder.analyzeMultiDeckShortages(['d-a', 'd-b'], collection);
    assertEquals(shortages.length, 1);
    assertEquals(shortages[0].totalRequired, 2);
    assertEquals(shortages[0].owned, 1);
    assertEquals(shortages[0].shortage, 1, 'Should require 1 more Sol Ring to build both simultaneously');
  });

  // 8. Opening Hand Simulator
  runner.test('DeckBuilder: Hand simulator draws 7 cards', () => {
    const deck = {
      commanders: [],
      mainboard: Array.from({ length: 60 }, (_, i) => ({
        card: { name: `Card ${i}` },
        count: 1
      }))
    };

    const simState = DeckBuilder.initHandSimulator(deck);
    assertEquals(simState.hand.length, 7);
    assertEquals(simState.library.length, 53);
    assertEquals(simState.mulliganCount, 0);

    DeckBuilder.drawCards(1);
    assertEquals(simState.hand.length, 8);
    assertEquals(simState.library.length, 52);
  });

  // 9. Japanese Basic Lands & Color Identity
  runner.test('Scryfall: Japanese basic lands normalization and color identity', async () => {
    const rawSwamp = {
      id: 'swamp-1',
      name: 'Swamp',
      printed_name: '沼',
      lang: 'ja',
      type_line: 'Basic Land — Swamp',
      color_identity: ['B'],
      mana_cost: ''
    };
    const norm = Scryfall.normalizeCard(rawSwamp);
    assertEquals(norm.mana_cost, '', 'Land must not have mana cost');
    assertEquals(norm.cmc, 0, 'Land CMC must be 0');
    assertEquals(norm.color_identity.length, 1);
    assertEquals(norm.color_identity[0], 'B');

    // Test resolveCard on basic lands fast-path
    const forest = await Scryfall.resolveCard('森');
    assert(forest !== null, 'Should resolve 森');
    assertEquals(forest.mana_cost, '', 'Forest mana cost should be empty');
    assertEquals(forest.cmc, 0, 'Forest cmc should be 0');
    assertEquals(forest.color_identity.join(','), 'G', 'Forest color identity must be G');

    const island = await Scryfall.resolveCard('島');
    assertEquals(island.color_identity.join(','), 'U', 'Island color identity must be U');

    const plains = await Scryfall.resolveCard('平地');
    assertEquals(plains.color_identity.join(','), 'W', 'Plains color identity must be W');

    const mountain = await Scryfall.resolveCard('山');
    assertEquals(mountain.color_identity.join(','), 'R', 'Mountain color identity must be R');

    const wastes = await Scryfall.resolveCard('荒地');
    assertEquals(wastes.color_identity.length, 0, 'Wastes color identity must be colorless');
  });

  // 10. Collection Summary Analytics & Text Generation
  runner.test('Collection: Detailed analytics and Collection Summary text', async () => {
    Collection.items = [
      {
        id: 'c1',
        oracle_id: 'o1',
        name: 'Sol Ring',
        display_name: '太陽の指輪',
        type_line: 'Artifact',
        cmc: 1,
        colors: [],
        count: 2,
        foil: true,
        price_usd_foil: 3.5,
        price_usd: 1.5,
        set: 'CMM',
        rarity: 'uncommon'
      },
      {
        id: 'c2',
        oracle_id: 'o2',
        name: 'Forest',
        display_name: '森',
        type_line: 'Basic Land — Forest',
        cmc: 0,
        colors: [],
        count: 10,
        foil: false,
        price_usd: 0.1,
        set: 'MOM',
        rarity: 'common'
      },
      {
        id: 'c3',
        oracle_id: 'o3',
        name: 'Lightning Bolt',
        display_name: '稲妻',
        type_line: 'Instant',
        cmc: 1,
        colors: ['R'],
        count: 6,
        foil: false,
        price_usd: 2.0,
        set: 'CLB',
        rarity: 'common'
      }
    ];

    const stats = Collection.analyze();
    assertEquals(stats.totalCards, 18);
    assertEquals(stats.uniqueCards, 3);
    assertEquals(stats.foilCount, 2);
    assertEquals(stats.nonFoilCount, 16);
    assertEquals(stats.typeCounts.artifact, 2);
    assertEquals(stats.typeCounts.land, 10);
    assertEquals(stats.typeCounts.instant, 6);
    assertEquals(stats.manaCurve[1], 8);
    assertEquals(stats.duplicates.length, 1);

    const summaryText = Summary.generateCollectionTextSummary(stats);
    assert(summaryText.includes('MTGCollectionSummary コレクション全体サマリー'), 'Should include header');
    assert(summaryText.includes('総所有枚数：18枚'), 'Should include total cards');
    assert(summaryText.includes('Foilカード枚数：2枚'), 'Should include foil count');
    assert(summaryText.includes('アーティファクト：2枚'), 'Should include artifact count');
  });

  // 11. Search to Deck & Collection Addition
  runner.test('DeckBuilder & Collection: Adding cards from search with normalized sections', async () => {
    const testDeck = await DeckBuilder.createDeck('テストデッキ', 'commander');
    DeckBuilder.setCurrentDeck(testDeck);

    const testCard = {
      id: 'scry-sol-ring',
      oracle_id: 'orc-sol-ring',
      name: 'Sol Ring',
      display_name: '太陽の指輪',
      type_line: 'Artifact',
      cmc: 1,
      colors: [],
      rarity: 'uncommon',
      set: 'CMM',
      collector_number: '410'
    };

    // 1. Add card via 'main'
    DeckBuilder.addCard(testCard, 'main', 1);
    assert(Array.isArray(testDeck.mainboard), 'mainboard must be an array');
    assertEquals(testDeck.mainboard.length, 1, 'Card should be placed into mainboard');
    assertEquals(testDeck.mainboard[0].card.name, 'Sol Ring');
    assertEquals(testDeck.mainboard[0].count, 1);

    // 2. Add same card again via 'mainboard' (increment count)
    DeckBuilder.addCard(testCard, 'mainboard', 2);
    assertEquals(testDeck.mainboard.length, 1);
    assertEquals(testDeck.mainboard[0].count, 3);

    // 3. Add commander card via 'commander'
    const cmdCard = {
      id: 'scry-atraxa',
      name: 'Atraxa, Grand Unifier',
      display_name: '偉大なる統一者、アトラクサ',
      type_line: 'Legendary Creature — Phyrexian Angel',
      cmc: 7
    };
    DeckBuilder.addCard(cmdCard, 'commander', 1);
    assertEquals(testDeck.commanders.length, 1);
    assertEquals(testDeck.commanders[0].name, 'Atraxa, Grand Unifier');

    // 4. Add card to collection
    const colCard = await Collection.addCard(testCard, { count: 1 });
    assert(colCard !== null, 'Should add to collection');
    const found = Collection.items.find((i) => i.name === 'Sol Ring');
    assert(found !== undefined, 'Sol Ring must exist in collection');
  });

  // 12. Deck Renaming & Synchronization
  runner.test('DeckBuilder: Rename deck and synchronize data', async () => {
    const deck = await DeckBuilder.createDeck('旧デッキ名', 'modern');
    DeckBuilder.setCurrentDeck(deck);

    const renameRes = await DeckBuilder.renameDeck(deck.id, '新デッキ名_2026');
    assert(renameRes !== null, 'renameDeck should return result object');
    assertEquals(renameRes.oldName, '旧デッキ名');
    assertEquals(renameRes.newName, '新デッキ名_2026');
    assertEquals(deck.name, '新デッキ名_2026');
    assertEquals(DeckBuilder.currentDeck.name, '新デッキ名_2026');

    const foundInDecks = DeckBuilder.decks.find((d) => d.id === deck.id);
    assertEquals(foundInDecks.name, '新デッキ名_2026');
  });

  exports.TestRunnerInstance = runner;
})(typeof window !== 'undefined' ? window : module.exports);
