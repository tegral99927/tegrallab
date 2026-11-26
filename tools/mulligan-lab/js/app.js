/**
 * Mulligan Lab - Application Bootstrap
 * Initializes storage, restores active deck (or loads sample deck on first run),
 * mounts UI event listeners, and starts the initial session.
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize UI shell
    UI.setupNavigation();
    UI.setupThemeToggle();
    UI.setupLanguageToggle();
    UI.setupDeckManagement();
    UI.setupTrainingUI();
    UI.setupConditionBuilderAndSimulation();
    UI.setupRolesTab();
    UI.setupHistoryTab();
    UI.setupCompareTab();
    UI.setupSettingsTab();
    UI.setupCardZoomModal();

    // 2. Load active deck from IndexedDB or restore sample
    const activeDeckId = Storage.getActiveDeckId();
    let currentDeck = null;

    if (activeDeckId) {
      currentDeck = await Storage.getDeck(activeDeckId);
    }

    if (!currentDeck) {
      // First visit: use sample deck
      currentDeck = DeckManager.getSampleDeck();
      await Storage.saveDeck(currentDeck);
      Storage.setActiveDeckId(currentDeck.id);
    }

    DeckManager.setCurrentDeck(currentDeck);
    UI.updateHeaderDeckBadge(currentDeck);

    // Sync input fields in Deck tab
    const nameInput = document.getElementById('deck-name-input');
    const formatSelect = document.getElementById('deck-format-select');
    const textarea = document.getElementById('deck-import-textarea');
    if (nameInput) nameInput.value = currentDeck.name;
    if (formatSelect) formatSelect.value = currentDeck.format || 'modern';
    if (textarea && currentDeck.mainboard) {
      textarea.value = DeckParser.formatDeckToText(currentDeck.mainboard, currentDeck.sideboard, currentDeck.commander);
    }

    // 3. Render initial views and start initial training game immediately
    UI.renderCurrentDeckView();
    UI.renderConditionBuilder();
    Training.startNewGame();

    // 4. In background: fetch Scryfall metadata (or load from IndexedDB cache)
    if (currentDeck.mainboard && currentDeck.mainboard.length > 0) {
      Scryfall.fetchCardsBatch(currentDeck.mainboard).then(fetchedMap => {
        fetchedMap.forEach((meta, key) => {
          DeckManager.setCardMetadata(key, meta);
        });
        // Update views and active cards with complete Scryfall data
        UI.renderCurrentDeckView();
        Training.updateCardMetadata();
      }).catch(err => {
        console.warn('Scryfall background fetch error:', err);
      });
    }

    // Wire up turn progression chart target change listener
    const turnTargetSelect = document.getElementById('turn-sim-target-select');
    const turnOrderSelect = document.getElementById('turn-sim-play-draw-select');
    if (turnTargetSelect) {
      turnTargetSelect.addEventListener('change', () => UI.updateTurnProgressionChart());
    }
    if (turnOrderSelect) {
      turnOrderSelect.addEventListener('change', () => UI.updateTurnProgressionChart());
    }

    const recalcAnalysisBtn = document.getElementById('btn-recalc-analysis');
    if (recalcAnalysisBtn) {
      recalcAnalysisBtn.addEventListener('click', () => {
        UI.renderAnalysisTab();
        UI.showToast('分析を再計算しました', 'info');
      });
    }

  } catch (err) {
    console.error('Mulligan Lab initialization error:', err);
  }
});
