/**
 * Mulligan Lab - Training Mode Engine
 * Manages interactive mulligan training, London mulligan bottom card selection,
 * blind mode, turn progression draws, and keep reason logging.
 */

const Training = (() => {
  // Current game session state
  let state = {
    deck: null,
    library: [],
    hand: [],
    initial7: [], // first hand drawn in this session
    handsHistory: [], // array of 7-card hands seen each mulligan
    bottomCards: [], // cards moved to bottom
    mulliganCount: 0,
    isKept: false,
    selectedBottomIds: [], // card instanceIds picked to go to bottom
    playOrder: 'play', // 'play' or 'draw'
    isBlindMode: false,
    currentTurn: 1,
    opponentArchetype: 'unknown',
    selectedReasons: new Set(),
    userMemo: '',
    freeMulliganUsed: false
  };

  // Callbacks registered by UI
  let onStateChangeCallback = null;

  function setOnStateChange(cb) {
    onStateChangeCallback = cb;
  }

  function notifyChange() {
    if (onStateChangeCallback) onStateChangeCallback({ ...state });
  }

  /**
   * Starts a brand new game training session with the current deck.
   */
  function startNewGame() {
    const deck = DeckManager.getCurrentDeck();
    if (!deck || !deck.mainboard || deck.mainboard.length === 0) {
      return false;
    }

    state.deck = deck;
    state.mulliganCount = 0;
    state.isKept = false;
    state.handsHistory = [];
    state.bottomCards = [];
    state.selectedBottomIds = [];
    state.currentTurn = 1;
    state.selectedReasons.clear();
    state.userMemo = '';
    state.freeMulliganUsed = false;

    // Build fresh library instances and draw 7
    const fullLibrary = Mulligan.buildLibrary(
      deck.mainboard,
      DeckManager.getCardMetadata, // metadata lookup
      deck.cardTags || {},
      deck.mdfcLandSettings || {}
    );

    const { hand, library } = Mulligan.drawOpeningHand(fullLibrary);
    state.library = library;
    state.hand = hand;
    state.initial7 = [...hand];
    state.handsHistory.push([...hand]);

    notifyChange();
    return true;
  }

  /**
   * User chooses to Mulligan.
   */
  function mulligan() {
    if (state.isKept) return;

    const settings = Storage.getSettings();
    const maxMull = parseInt(settings.maxMulligans, 10) || 4;

    if (state.mulliganCount >= maxMull) {
      if (!confirm(`最大マリガン回数（${maxMull}回）に達しています。このままマリガンを続行しますか？`)) {
        return;
      }
    }

    // Check if free mulligan applies
    if (state.mulliganCount === 0 && Mulligan.isFreeMulliganAllowed(state.deck.format, settings.freeMulligan, 0)) {
      state.freeMulliganUsed = true;
    }

    state.mulliganCount++;
    state.selectedBottomIds = [];

    // Re-shuffle hand + library and draw 7
    const { hand, library } = Mulligan.executeMulligan(state.hand, state.library);
    state.hand = hand;
    state.library = library;
    state.handsHistory.push([...hand]);

    notifyChange();
  }

  /**
   * User toggles selection of a card to be sent to the bottom of the library.
   */
  function toggleBottomCard(instanceId) {
    if (state.isKept) return;

    const needed = getBottomCardsNeeded();
    const index = state.selectedBottomIds.indexOf(instanceId);

    if (index > -1) {
      // Deselect
      state.selectedBottomIds.splice(index, 1);
    } else {
      // Select if not already at limit
      if (state.selectedBottomIds.length < needed) {
        state.selectedBottomIds.push(instanceId);
      }
    }

    notifyChange();
  }

  function getBottomCardsNeeded() {
    const settings = Storage.getSettings();
    return Mulligan.getCardsToBottomCount(state.mulliganCount, state.deck ? state.deck.format : 'modern', settings.freeMulligan);
  }

  /**
   * User confirms Keep.
   */
  async function keep() {
    if (state.isKept) return;

    const needed = getBottomCardsNeeded();
    if (state.selectedBottomIds.length !== needed) {
      alert(`有償マリガン${needed}回分、ライブラリーの一番下に送るカードを${needed}枚選択してください。（現在: ${state.selectedBottomIds.length}枚選択中）`);
      return false;
    }

    // Move selected cards from hand to bottom of library
    const keptHand = [];
    const bottomed = [];

    for (const card of state.hand) {
      if (state.selectedBottomIds.includes(card.instanceId)) {
        bottomed.push(card);
      } else {
        keptHand.push(card);
      }
    }

    state.hand = keptHand;
    state.bottomCards = bottomed;
    // Add bottomed cards to bottom of library
    state.library.push(...bottomed);
    state.isKept = true;

    // Check condition evaluation
    const conditionEval = evaluateHand(state.hand, state.deck.keepConditions);

    // Save session record to history in IndexedDB
    const record = {
      deckId: state.deck.id,
      deckName: state.deck.name,
      playOrder: state.playOrder,
      opponentArchetype: state.opponentArchetype,
      mulliganCount: state.mulliganCount,
      initialHand: state.initial7.map(c => c.name),
      finalHand: state.hand.map(c => c.name),
      bottomCards: state.bottomCards.map(c => c.name),
      reasons: Array.from(state.selectedReasons),
      userMemo: state.userMemo,
      conditionMatch: conditionEval.satisfied,
      conditionDetails: conditionEval.details
    };

    await Storage.saveTrainingRecord(record);

    notifyChange();
    return true;
  }

  /**
   * Advances turn and draws card(s).
   */
  function advanceTurn(targetTurn = null) {
    if (!state.isKept) return;

    const nextTurn = targetTurn || (state.currentTurn + 1);
    while (state.currentTurn < nextTurn && state.library.length > 0) {
      state.currentTurn++;

      // Check whether turn includes a normal draw
      // On the play: Turn 1 has no draw. Turn 2+ has draw.
      // On the draw: Turn 1 has draw. Turn 2+ has draw.
      let shouldDraw = true;
      if (state.currentTurn === 1 && state.playOrder === 'play') {
        shouldDraw = false;
      }

      if (shouldDraw && state.library.length > 0) {
        const drawnCard = state.library.shift(); // draw top card
        state.hand.push(drawnCard);
      }
    }

    notifyChange();
  }

  /**
   * Reorders cards in hand (drag-and-drop or tap reordering).
   */
  function reorderHand(sourceInstanceId, targetInstanceId) {
    const srcIndex = state.hand.findIndex(c => c.instanceId === sourceInstanceId);
    const dstIndex = state.hand.findIndex(c => c.instanceId === targetInstanceId);

    if (srcIndex > -1 && dstIndex > -1 && srcIndex !== dstIndex) {
      const [movedCard] = state.hand.splice(srcIndex, 1);
      state.hand.splice(dstIndex, 0, movedCard);
      notifyChange();
    }
  }

  function togglePlayDraw() {
    state.playOrder = state.playOrder === 'play' ? 'draw' : 'play';
    notifyChange();
  }

  function randomizePlayDraw() {
    state.playOrder = Math.random() < 0.5 ? 'play' : 'draw';
    notifyChange();
  }

  function toggleReason(reasonText) {
    if (state.selectedReasons.has(reasonText)) {
      state.selectedReasons.delete(reasonText);
    } else {
      state.selectedReasons.add(reasonText);
    }
    notifyChange();
  }

  function setUserMemo(memo) {
    state.userMemo = memo;
  }

  function setOpponentArchetype(arch) {
    state.opponentArchetype = arch;
    notifyChange();
  }

  function toggleBlindMode(isBlind) {
    state.isBlindMode = isBlind;
    notifyChange();
  }

  /**
   * Evaluates hand against Keep Conditions AST safely without eval().
   */
  function evaluateHand(handCards, conditionAST) {
    if (!conditionAST) return { satisfied: true, details: [] };

    const details = [];

    function evalNode(node) {
      if (!node) return true;

      if (node.type === 'group') {
        const op = node.operator || 'AND';
        const children = node.children || [];
        if (children.length === 0) return true;

        if (op === 'AND') {
          return children.every(c => evalNode(c));
        } else if (op === 'OR') {
          return children.some(c => evalNode(c));
        } else if (op === 'NOT') {
          return !evalNode(children[0]);
        }
        return true;
      }

      if (node.type === 'rule') {
        let pass = false;
        let count = 0;
        let ruleDesc = '';

        if (node.field === 'lands') {
          count = handCards.filter(c => c.isLand).length;
          const min = node.min !== undefined ? node.min : 0;
          const max = node.max !== undefined ? node.max : 99;
          pass = count >= min && count <= max;
          ruleDesc = `土地: ${min}〜${max}枚 (実際: ${count}枚)`;
        } else if (node.field === 'tag') {
          const targetTag = node.tag || '';
          count = handCards.filter(c => (c.tags || []).includes(targetTag)).length;
          const min = node.min !== undefined ? node.min : 1;
          const max = node.max !== undefined ? node.max : 99;
          pass = count >= min && count <= max;
          ruleDesc = `タグ「${targetTag}」: ${min}〜${max}枚 (実際: ${count}枚)`;
        } else if (node.field === 'card') {
          const targetCard = (node.cardName || '').toLowerCase().trim();
          count = handCards.filter(c => c.name.toLowerCase().trim() === targetCard).length;
          const min = node.min !== undefined ? node.min : 1;
          const max = node.max !== undefined ? node.max : 99;
          pass = count >= min && count <= max;
          ruleDesc = `カード「${node.cardName}」: ${min}〜${max}枚 (実際: ${count}枚)`;
        } else if (node.field === 'cmc') {
          const targetCmc = node.cmc || 0;
          count = handCards.filter(c => !c.isLand && c.cmc === targetCmc).length;
          const min = node.min !== undefined ? node.min : 1;
          pass = count >= min;
          ruleDesc = `CMC ${targetCmc}: ${min}枚以上 (実際: ${count}枚)`;
        } else if (node.field === 'color') {
          const targetColor = node.color || 'W';
          const sources = handCards.reduce((acc, c) => {
            if (c.mana_sources && c.mana_sources.includes(targetColor)) return acc + 1;
            return acc;
          }, 0);
          pass = sources >= (node.min || 1);
          ruleDesc = `色マナ供給「{${targetColor}}」: 1以上 (実際: ${sources})`;
        } else if (node.field === 'not_card') {
          const targetCard = (node.cardName || '').toLowerCase().trim();
          const present = handCards.some(c => c.name.toLowerCase().trim() === targetCard);
          pass = !present;
          ruleDesc = `「${node.cardName}」が含まれないこと (実際: ${present ? '含有' : 'なし'})`;
        }

        details.push({ rule: ruleDesc, passed: pass });
        return pass;
      }

      return true;
    }

    const satisfied = evalNode(conditionAST);
    return { satisfied, details };
  }

  /**
   * Review mode (復習モード): loads past recorded session back into the engine.
   */
  function loadReviewSession(record) {
    const deck = DeckManager.getCurrentDeck();
    if (!deck) return;

    state.deck = deck;
    state.mulliganCount = record.mulliganCount || 0;
    state.playOrder = record.playOrder || 'play';
    state.opponentArchetype = record.opponentArchetype || 'unknown';
    state.isKept = false;
    state.selectedReasons = new Set(record.reasons || []);
    state.userMemo = record.userMemo || '';
    state.selectedBottomIds = [];

    // Reconstruct hand objects from card names
    const metaMap = DeckManager.getCardMetadata;
    const library = Mulligan.buildLibrary(deck.mainboard, metaMap, deck.cardTags, deck.mdfcLandSettings);

    const reconstructedHand = [];
    for (const cardName of record.finalHand || record.initialHand || []) {
      const matchIndex = library.findIndex(c => c.name.toLowerCase() === cardName.toLowerCase());
      if (matchIndex > -1) {
        reconstructedHand.push(library.splice(matchIndex, 1)[0]);
      }
    }

    state.hand = reconstructedHand;
    state.library = library;
    state.initial7 = [...reconstructedHand];

    notifyChange();
  }

  /**
   * Updates card instances in memory when Scryfall metadata finishes loading.
   */
  function updateCardMetadata() {
    const metaLookup = DeckManager.getCardMetadata;
    const prefLang = Storage.getSettings().cardLanguage || 'ja';

    const updateCard = (c) => {
      const meta = metaLookup(c.name);
      if (meta) {
        if (meta.image_uri_ja) c.image_uri_ja = meta.image_uri_ja;
        if (meta.image_uri_en) c.image_uri_en = meta.image_uri_en;
        c.image_uri = prefLang === 'en'
          ? (c.image_uri_en || meta.image_uri)
          : (c.image_uri_ja || c.image_uri_en || meta.image_uri);

        c.isLand = meta.isLand;
        c.cmc = meta.cmc;
        c.mana_cost = meta.mana_cost;
        c.type_line = meta.type_line;
        c.colors = meta.colors;
        c.mana_sources = meta.mana_sources;
      }
    };

    state.hand.forEach(updateCard);
    state.library.forEach(updateCard);
    state.initial7.forEach(updateCard);
    notifyChange();
  }

  /**
   * Switches active image language between 'ja' (Japanese) and 'en' (English).
   */
  function switchCardLanguage(lang) {
    const update = (c) => {
      c.image_uri = lang === 'en'
        ? (c.image_uri_en || c.image_uri)
        : (c.image_uri_ja || c.image_uri_en || c.image_uri);
    };
    state.hand.forEach(update);
    state.library.forEach(update);
    state.initial7.forEach(update);
    notifyChange();
  }

  function getState() {
    return { ...state };
  }

  return {
    setOnStateChange,
    startNewGame,
    mulligan,
    toggleBottomCard,
    getBottomCardsNeeded,
    keep,
    advanceTurn,
    reorderHand,
    togglePlayDraw,
    randomizePlayDraw,
    toggleReason,
    setUserMemo,
    setOpponentArchetype,
    toggleBlindMode,
    evaluateHand,
    loadReviewSession,
    updateCardMetadata,
    switchCardLanguage,
    getState
  };
})();
