/**
 * MTGCollectionSummary - deck-validator.js
 * Comprehensive format validator, Commander eligibility, color identity,
 * Game Changers detection, and EDH bracket evaluation.
 */

(function (window) {
  'use strict';

  const DeckValidator = {};

  // Formats definition
  DeckValidator.FORMATS = {
    commander: {
      name: 'コマンダー (EDH)',
      minDeckSize: 100,
      maxDeckSize: 100,
      maxSideboard: 0,
      maxCopies: 1,
      isSingleton: true,
      requiresCommander: true,
      scryfallKey: 'commander'
    },
    pauper_edh: {
      name: 'パウパーEDH (pEDH)',
      minDeckSize: 100,
      maxDeckSize: 100,
      maxSideboard: 0,
      maxCopies: 1,
      isSingleton: true,
      requiresCommander: true,
      scryfallKey: 'paupercommander'
    },
    brawl: {
      name: 'ブロール (Brawl)',
      minDeckSize: 60,
      maxDeckSize: 100,
      maxSideboard: 0,
      maxCopies: 1,
      isSingleton: true,
      requiresCommander: true,
      scryfallKey: 'brawl'
    },
    standard: {
      name: 'スタンダード',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'standard'
    },
    pioneer: {
      name: 'パイオニア',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'pioneer'
    },
    modern: {
      name: 'モダン',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'modern'
    },
    legacy: {
      name: 'レガシー',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'legacy'
    },
    vintage: {
      name: 'ヴィンテージ',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'vintage'
    },
    pauper: {
      name: 'パウパー',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'pauper'
    },
    historic: {
      name: 'ヒストリック',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'historic'
    },
    explorer: {
      name: 'エクスプローラー',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'explorer'
    },
    alchemy: {
      name: 'アルケミー',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'alchemy'
    },
    timeless: {
      name: 'タイムレス',
      minDeckSize: 60,
      maxDeckSize: Infinity,
      maxSideboard: 15,
      maxCopies: 4,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: 'timeless'
    },
    casual: {
      name: 'カジュアル (自由構築)',
      minDeckSize: 1,
      maxDeckSize: Infinity,
      maxSideboard: Infinity,
      maxCopies: Infinity,
      isSingleton: false,
      requiresCommander: false,
      scryfallKey: null
    }
  };

  // Cards exempt from the copy limit
  DeckValidator.UNLIMITED_COPY_CARDS = new Set([
    'Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes',
    'Snow-Covered Plains', 'Snow-Covered Island', 'Snow-Covered Swamp',
    'Snow-Covered Mountain', 'Snow-Covered Forest',
    '平地', '島', '沼', '山', '森', '荒地',
    '冠雪の平地', '冠雪の島', '冠雪の沼', '冠雪の山', '冠雪の森',
    'Relentless Rats', '執拗なネズミ',
    'Rat Colony', 'ネズミの群棲',
    'Shadowborn Apostle', '使徒の呼び声', '影生まれの使徒',
    'Persistent Petitioners', '執拗な請願者',
    'Dragon\'s Approach', 'ドラゴンの接近',
    'Slime Against Humanity', '人類への粘質',
    'Hare Apparent', '野兎の親族'
  ]);

  // Game Changers / Saltiest / Top EDH Staples list for Commander Bracket & analysis
  DeckValidator.GAME_CHANGERS = [
    'Sol Ring', 'Mana Crypt', 'Jeweled Lotus', 'Mox Diamond', 'Chrome Mox',
    'Mana Vault', 'Grim Monolith', 'Ancient Tomb', 'Dockside Extortionist',
    'Rhystic Study', 'Smothering Tithe', 'Esper Sentinel', 'Mystic Remora',
    'The One Ring', 'Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal',
    'Fierce Guardianship', 'Force of Will', 'Mana Drain', 'Deflecting Swat',
    'Cyclonic Rift', 'Thassa\'s Oracle', 'Underworld Breach', 'Ad Nauseam',
    'Teferi\'s Protection', 'Necropotence', 'Drannith Magistrate', 'Opposition Agent',
    'Orcish Bowmasters', 'Survival of the Fittest', 'Gaea\'s Cradle'
  ];

  // Check if a card is an unlimited copy card
  DeckValidator.isUnlimitedCopies = function (card) {
    if (!card) return false;
    const name = card.name || '';
    const nameJa = card.name_ja || '';
    if (DeckValidator.UNLIMITED_COPY_CARDS.has(name) || DeckValidator.UNLIMITED_COPY_CARDS.has(nameJa)) {
      return true;
    }
    // Check Oracle text for "A deck can have any number of cards named"
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('any number of cards named') || text.includes('任意の枚数の');
  };

  // Check if card is legal as a Commander
  DeckValidator.isCommanderEligible = function (card) {
    if (!card) return { eligible: false, reason: 'カードが存在しません' };

    const typeLine = card.type_line || '';
    const oracleText = card.oracle_text || '';
    const isLegendary = typeLine.includes('Legendary') || typeLine.includes('伝説の');
    const isCreature = typeLine.includes('Creature') || typeLine.includes('クリーチャー');
    const canBeCommander =
      oracleText.includes('can be your commander') ||
      oracleText.includes('統率者として使用できる') ||
      oracleText.includes('Grist, the Hunger Tide'); // Grist special ruling

    if (isLegendary && isCreature) {
      return { eligible: true, reason: '伝説のクリーチャー' };
    }
    if (isLegendary && canBeCommander) {
      return { eligible: true, reason: '「統率者として使用できる」能力を持つ伝説のカード' };
    }
    if (canBeCommander) {
      return { eligible: true, reason: '「統率者として使用できる」能力を持つカード' };
    }

    return {
      eligible: false,
      reason: '統率者は通常「伝説のクリーチャー」または「統率者として指定できる」テキストを持つカードである必要があります。'
    };
  };

  // Partner / Background / Multiple Commander compatibility check
  DeckValidator.canPartnerTogether = function (c1, c2) {
    if (!c1 || !c2) return { canPartner: false, reason: '2枚の統率者が必要です' };

    const t1 = (c1.oracle_text || '').toLowerCase();
    const t2 = (c2.oracle_text || '').toLowerCase();
    const type1 = c1.type_line || '';
    const type2 = c2.type_line || '';

    // 1. Generic "Partner" (共闘)
    const hasGenericPartner1 = /\bpartner\b/.test(t1) && !t1.includes('partner with') && !t1.includes('doctor\'s companion');
    const hasGenericPartner2 = /\bpartner\b/.test(t2) && !t2.includes('partner with') && !t2.includes('doctor\'s companion');
    if (hasGenericPartner1 && hasGenericPartner2) {
      return { canPartner: true, mechanism: '共闘 (Partner)' };
    }

    // 2. Specific "Partner with [Name]"
    const partnerWithRegex1 = /partner with ([^\n.(]+)/i.exec(c1.oracle_text || '');
    if (partnerWithRegex1) {
      const targetName = partnerWithRegex1[1].trim().toLowerCase();
      if ((c2.name || '').toLowerCase().includes(targetName)) {
        return { canPartner: true, mechanism: `共闘（${c2.name}と共闘）` };
      }
    }
    const partnerWithRegex2 = /partner with ([^\n.(]+)/i.exec(c2.oracle_text || '');
    if (partnerWithRegex2) {
      const targetName = partnerWithRegex2[1].trim().toLowerCase();
      if ((c1.name || '').toLowerCase().includes(targetName)) {
        return { canPartner: true, mechanism: `共闘（${c1.name}と共闘）` };
      }
    }

    // 3. Choose a Background (背景選択) + Background (背景)
    const hasChooseBackground1 = t1.includes('choose a background') || t1.includes('背景選択');
    const hasChooseBackground2 = t2.includes('choose a background') || t2.includes('背景選択');
    const isBackground1 = type1.includes('Background') || type1.includes('背景');
    const isBackground2 = type2.includes('Background') || type2.includes('背景');

    if ((hasChooseBackground1 && isBackground2) || (hasChooseBackground2 && isBackground1)) {
      return { canPartner: true, mechanism: '背景選択 (Choose a Background)' };
    }

    // 4. Friends forever (ずっと友達)
    if (t1.includes('friends forever') && t2.includes('friends forever')) {
      return { canPartner: true, mechanism: 'ずっと友達 (Friends forever)' };
    }

    // 5. Doctor's companion
    const isDoctor1 = type1.includes('Time Lord') && type1.includes('Doctor');
    const isDoctor2 = type2.includes('Time Lord') && type2.includes('Doctor');
    const isDoctorCompanion1 = t1.includes("doctor's companion") || t1.includes('ドクターのコンパニオン');
    const isDoctorCompanion2 = t2.includes("doctor's companion") || t2.includes('ドクターのコンパニオン');

    if ((isDoctor1 && isDoctorCompanion2) || (isDoctor2 && isDoctorCompanion1)) {
      return { canPartner: true, mechanism: "ドクターのコンパニオン (Doctor's Companion)" };
    }

    return {
      canPartner: false,
      reason: '2枚の統率者に「共闘」「背景選択」「ずっと友達」「ドクターのコンパニオン」などの有効な組み合わせが見つかりません。'
    };
  };

  // Combine color identities of commanders
  DeckValidator.getCombinedColorIdentity = function (commanders) {
    if (!commanders || commanders.length === 0) return [];
    const colorsSet = new Set();
    commanders.forEach((cmd) => {
      if (cmd && Array.isArray(cmd.color_identity)) {
        cmd.color_identity.forEach((c) => colorsSet.add(c));
      }
    });
    return Utils.sortColors(Array.from(colorsSet));
  };

  // Check if a card's color identity conforms to commander's color identity
  DeckValidator.isCardColorAllowed = function (cardColors, commanderColors) {
    if (!cardColors || cardColors.length === 0) return true; // Colorless cards are always allowed
    const cmdSet = new Set(commanderColors || []);
    return cardColors.every((c) => cmdSet.has(c));
  };

  // Comprehensive Deck Validation
  /**
   * @param {Object} deck
   * {
   *   format: string,
   *   commanders: Array<Card>,
   *   companions: Array<Card>,
   *   mainboard: Array<{ card: Card, count: number }>,
   *   sideboard: Array<{ card: Card, count: number }>,
   *   maybeboard: Array<{ card: Card, count: number }>
   * }
   */
  DeckValidator.validateDeck = function (deck) {
    const formatKey = (deck.format || 'casual').toLowerCase();
    const rule = DeckValidator.FORMATS[formatKey] || DeckValidator.FORMATS.casual;

    const errors = [];
    const warnings = [];
    const notices = [];

    const commanders = deck.commanders || [];
    const companions = deck.companions || [];
    const mainboard = deck.mainboard || [];
    const sideboard = deck.sideboard || [];

    // Calculate total counts
    const commanderCount = commanders.reduce((sum, c) => sum + (c.count || 1), 0);
    const mainCount = mainboard.reduce((sum, item) => sum + (item.count || 1), 0);
    const sideCount = sideboard.reduce((sum, item) => sum + (item.count || 1), 0);
    const totalCount = (rule.requiresCommander ? commanderCount : 0) + mainCount;

    // 1. Deck Size Check
    if (rule.requiresCommander) {
      if (totalCount !== rule.minDeckSize) {
        errors.push(
          `${rule.name}は統率者を含めてちょうど${rule.minDeckSize}枚である必要があります（現在: 統率者${commanderCount}枚 + メイン${mainCount}枚 = 計${totalCount}枚）。`
        );
      }
    } else {
      if (totalCount < rule.minDeckSize) {
        errors.push(`${rule.name}の最小デッキ枚数は${rule.minDeckSize}枚です（現在: ${totalCount}枚）。`);
      }
      if (sideCount > rule.maxSideboard) {
        errors.push(`${rule.name}のサイドボード上限は${rule.maxSideboard}枚です（現在: ${sideCount}枚）。`);
      }
    }

    // 2. Commander Requirements & Legitimacy
    let cmdColorIdentity = [];
    if (rule.requiresCommander) {
      if (commanders.length === 0) {
        errors.push(`${rule.name}には少なくとも1枚の統率者を指定する必要があります。`);
      } else if (commanders.length === 1) {
        const cmdCheck = DeckValidator.isCommanderEligible(commanders[0]);
        if (!cmdCheck.eligible) {
          warnings.push(`統率者「${commanders[0].display_name || commanders[0].name}」: ${cmdCheck.reason}`);
        }
        cmdColorIdentity = commanders[0].color_identity || [];
      } else if (commanders.length === 2) {
        const partnerCheck = DeckValidator.canPartnerTogether(commanders[0], commanders[1]);
        if (!partnerCheck.canPartner) {
          errors.push(
            `統率者の組み合わせ不正: 「${commanders[0].display_name || commanders[0].name}」と「${commanders[1].display_name || commanders[1].name}」: ${partnerCheck.reason}`
          );
        } else {
          notices.push(`複数統率者ルール適用: ${partnerCheck.mechanism}`);
        }
        cmdColorIdentity = DeckValidator.getCombinedColorIdentity(commanders);
      } else {
        errors.push(`統率者は最大2枚までです（現在: ${commanders.length}枚）。`);
        cmdColorIdentity = DeckValidator.getCombinedColorIdentity(commanders);
      }
    }

    // 3. Card Copy Counts and Singleton / 4-of check
    const cardCounts = new Map();

    const registerCard = (c, count, section) => {
      if (!c) return;
      const key = (c.name || '').trim();
      const current = cardCounts.get(key) || { count: 0, card: c, sections: [] };
      current.count += count;
      current.sections.push(section);
      cardCounts.set(key, current);
    };

    commanders.forEach((c) => registerCard(c, c.count || 1, '統率者'));
    mainboard.forEach((item) => registerCard(item.card, item.count || 1, 'メイン'));
    sideboard.forEach((item) => registerCard(item.card, item.count || 1, 'サイド'));

    cardCounts.forEach((info, cardName) => {
      const card = info.card;
      const total = info.count;

      if (!DeckValidator.isUnlimitedCopies(card)) {
        if (rule.isSingleton && total > 1) {
          errors.push(
            `ハイランダー制限違反: 「${card.display_name || cardName}」が合計${total}枚含まれています（許可: 1枚）。`
          );
        } else if (!rule.isSingleton && total > rule.maxCopies) {
          errors.push(
            `投入枚数制限超過: 「${card.display_name || cardName}」が合計${total}枚含まれています（最大: ${rule.maxCopies}枚）。`
          );
        }
      }

      // Check format legality via Scryfall legalities field
      if (rule.scryfallKey && card.legalities) {
        const legality = card.legalities[rule.scryfallKey];
        if (legality === 'banned') {
          errors.push(`禁止カード: 「${card.display_name || cardName}」は${rule.name}で禁止されています。`);
        } else if (legality === 'restricted' && total > 1) {
          errors.push(`制限カード: 「${card.display_name || cardName}」は${rule.name}で1枚制限です。`);
        } else if (legality === 'not_legal') {
          warnings.push(`使用不可: 「${card.display_name || cardName}」は${rule.name}では原則として使用できません。`);
        }
      }

      // 4. Color Identity check for Commander / Brawl
      if (rule.requiresCommander && cmdColorIdentity.length >= 0) {
        const cardIdentity = card.color_identity || [];
        if (!DeckValidator.isCardColorAllowed(cardIdentity, cmdColorIdentity)) {
          const illegalColors = cardIdentity.filter((c) => !cmdColorIdentity.includes(c));
          errors.push(
            `固有色違反: 「${card.display_name || cardName}」の色 [${illegalColors.join(',')}] は統率者の固有色 [${cmdColorIdentity.join(',') || '無色'}] に含まれていません。`
          );
        }
      }
    });

    // 5. EDH Game Changers calculation
    const gameChangersFound = [];
    const allCards = [
      ...commanders,
      ...mainboard.map((m) => m.card),
      ...sideboard.map((s) => s.card)
    ];

    allCards.forEach((c) => {
      if (!c) return;
      const name = c.name || '';
      if (DeckValidator.GAME_CHANGERS.includes(name) && !gameChangersFound.includes(name)) {
        gameChangersFound.push(name);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      notices,
      commanderColorIdentity: cmdColorIdentity,
      gameChangersCount: gameChangersFound.length,
      gameChangersList: gameChangersFound
    };
  };

  window.DeckValidator = DeckValidator;
})(window);

