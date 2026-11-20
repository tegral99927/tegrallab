/**
 * app.js - メインアプリケーションコントローラー
 */

import { APP_CONFIG } from "./config.js";
import { state } from "./state.js";
import { i18n } from "./i18n.js";
import { autocompleteCardName, fetchCardByName } from "./scryfall.js";
import { DECK_TEMPLATES } from "./templates.js";
import { analyzeDecklist } from "./deck-parser.js";
import { updatePreviewDOM } from "./sheet-renderer.js";
import { downloadSheetPNG, copySheetToClipboard, shareSheetWeb, printSheet } from "./sheet-export.js";
import { getSavedDecks, saveDeck, deleteDeck, duplicateDeck, exportDeckToJson, validateAndParseDeckJson } from "./storage.js";
import { generateShareUrl, parseShareUrl } from "./share.js";

// DOM要素キャッシュ
const elements = {
  // モード・言語・テーマ
  modeSimpleBtn: document.getElementById("mode-simple-btn"),
  modeDetailedBtn: document.getElementById("mode-detailed-btn"),
  langSelect: document.getElementById("lang-select"),
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  sheetThemeToggleBtn: document.getElementById("sheet-theme-toggle-btn"),

  // スマホ用タブ切替
  mobileTabForm: document.getElementById("mobile-tab-form"),
  mobileTabPreview: document.getElementById("mobile-tab-preview"),
  formPane: document.getElementById("form-pane"),
  previewPane: document.getElementById("preview-pane"),

  // 統率者関連
  commanderSearchInput: document.getElementById("commander-search-input"),
  commanderSuggestions: document.getElementById("commander-suggestions"),
  commanderSelectedContainer: document.getElementById("commander-selected-container"),
  addPartnerBtn: document.getElementById("add-partner-btn"),
  commanderDescInput: document.getElementById("commander-desc-input"),

  // ブラケット & ゲームチェンジャー
  bracketButtons: document.querySelectorAll(".bracket-btn"),
  bracketWarningBox: document.getElementById("bracket-warning-box"),
  gcCountInput: document.getElementById("gc-count-input"),
  gcCountPlusBtn: document.getElementById("gc-count-plus"),
  gcCountMinusBtn: document.getElementById("gc-count-minus"),
  gcSourceTag: document.getElementById("gc-source-tag"),

  // 特徴 & 希望
  featureChipsContainer: document.getElementById("feature-chips-container"),
  customFeatureInput: document.getElementById("custom-feature-input"),
  addCustomFeatureBtn: document.getElementById("add-custom-feature-btn"),
  playPrefChipsContainer: document.getElementById("play-pref-chips-container"),
  avoidPrefChipsContainer: document.getElementById("avoid-pref-chips-container"),

  // 詳細モード項目
  detailedSection: document.getElementById("detailed-fields-section"),
  deckNameInput: document.getElementById("deck-name-input"),
  winConditionsInput: document.getElementById("win-conditions-input"),
  comboDescriptionInput: document.getElementById("combo-description-input"),
  approxTurnInput: document.getElementById("approx-turn-input"),
  proxyStatusSelect: document.getElementById("proxy-status-select"),
  additionalNotesInput: document.getElementById("additional-notes-input"),

  // デッキリスト解析
  decklistTextarea: document.getElementById("decklist-textarea"),
  analyzeDecklistBtn: document.getElementById("analyze-decklist-btn"),
  decklistResultBox: document.getElementById("decklist-result-box"),

  // テンプレート
  templateButtons: document.querySelectorAll(".template-btn"),

  // プレビュー & 出力
  sheetPreviewContainer: document.getElementById("sheet-preview-container"),
  btnExportPng: document.getElementById("btn-export-png"),
  btnCopyImage: document.getElementById("btn-copy-image"),
  btnShareUrl: document.getElementById("btn-share-url"),
  btnPrintSheet: document.getElementById("btn-print-sheet"),
  sheetTypeSelect: document.getElementById("sheet-type-select"),

  // デッキ管理
  btnSaveDeck: document.getElementById("btn-save-deck"),
  btnLoadDecks: document.getElementById("btn-load-decks"),
  btnNewDeck: document.getElementById("btn-new-deck"),
  btnExportJson: document.getElementById("btn-export-json"),
  jsonFileInput: document.getElementById("json-file-input"),
  deckListModal: document.getElementById("deck-list-modal"),
  closeModalBtn: document.getElementById("close-modal-btn"),
  deckListItems: document.getElementById("deck-list-items"),

  // ドネーションモーダル
  donationModal: document.getElementById("donation-modal"),
  closeDonationBtn: document.getElementById("close-donation-btn"),

  // トースト
  toast: document.getElementById("app-toast")
};

let searchAbortController = null;

/**
 * 初期化処理
 */
export function initApp() {
  // 1. ローカルストレージまたはURLからの初期化
  const sharedDeck = parseShareUrl();
  if (sharedDeck) {
    state.loadDeck(sharedDeck);
    showToast("共有URLからデッキを復元しました");
  } else {
    const saved = getSavedDecks();
    const lastActiveId = localStorage.getItem(APP_CONFIG.activeDeckKey);
    const active = saved.find(d => d.deckId === lastActiveId) || saved[0];
    if (active) {
      state.loadDeck(active);
    }
  }

  // 言語初期化
  const savedLang = localStorage.getItem(APP_CONFIG.langKey) || (navigator.language.startsWith("en") ? "en" : "ja");
  setLanguage(savedLang);

  // テーマ初期化
  const savedTheme = localStorage.getItem(APP_CONFIG.themeKey) || "dark";
  setAppTheme(savedTheme);

  // イベントリスナー登録
  bindEvents();

  // 画面初期反映
  renderAll();

  // 状態変更リスナー
  state.subscribe((event, payload) => {
    if (event === "deck_update" || event === "deck_loaded" || event === "deck_reset") {
      renderAll();
      // 自動保存
      saveDeck(state.activeDeck);
    } else if (event === "mode_change") {
      updateModeUI();
      renderPreview();
    } else if (event === "lang_change") {
      i18n.applyToDOM();
      renderAll();
    } else if (event === "ui_theme_change") {
      document.body.className = `theme-${payload}`;
    }
  });
}

/**
 * イベントのバインド
 */
function bindEvents() {
  // モード切替
  elements.modeSimpleBtn?.addEventListener("click", () => state.setMode("simple"));
  elements.modeDetailedBtn?.addEventListener("click", () => state.setMode("detailed"));

  // 言語選択
  elements.langSelect?.addEventListener("change", (e) => setLanguage(e.target.value));

  // テーマ切替
  elements.themeToggleBtn?.addEventListener("click", () => {
    const nextTheme = state.uiTheme === "dark" ? "light" : "dark";
    setAppTheme(nextTheme);
  });

  // シートテーマ切替
  elements.sheetThemeToggleBtn?.addEventListener("click", () => {
    const nextSheetTheme = state.activeDeck.sheetTheme === "light" ? "dark" : "light";
    state.updateDeck({ sheetTheme: nextSheetTheme });
  });

  // シートタイプ切替 (Quick / Detailed)
  elements.sheetTypeSelect?.addEventListener("change", (e) => {
    state.updateDeck({ sheetType: e.target.value });
  });

  // スマホタブ切替
  elements.mobileTabForm?.addEventListener("click", () => setMobileTab("form"));
  elements.mobileTabPreview?.addEventListener("click", () => setMobileTab("preview"));

  // 統率者検索オートコンプリート
  let debounceTimer = null;
  elements.commanderSearchInput?.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    if (query.length < 2) {
      hideSuggestions();
      return;
    }
    debounceTimer = setTimeout(() => handleCommanderSearch(query), APP_CONFIG.scryfall.autocompleteDelay);
  });

  elements.commanderSearchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = elements.commanderSearchInput.value.trim();
      if (val) {
        selectCommanderByName(val, 0);
        hideSuggestions();
      }
    }
  });

  // 2枚目統率者追加
  elements.addPartnerBtn?.addEventListener("click", () => {
    state.addCommander({ id: "", name: "", printedName: "", imageUrl: "", manaCost: "", typeLine: "", colorIdentity: [] });
  });

  // 統率者概要
  elements.commanderDescInput?.addEventListener("input", (e) => {
    state.updateDeck({ commanderDescription: e.target.value });
  });

  // ブラケットボタン
  elements.bracketButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const b = parseInt(btn.dataset.bracket, 10);
      state.updateDeck({ bracket: b });
    });
  });

  // ゲームチェンジャーカウンター
  elements.gcCountInput?.addEventListener("change", (e) => {
    const count = Math.max(0, parseInt(e.target.value, 10) || 0);
    state.updateDeck({ gameChangerCount: count, gameChangerCountSource: "manual" });
  });
  elements.gcCountPlusBtn?.addEventListener("click", () => {
    state.updateDeck({
      gameChangerCount: (state.activeDeck.gameChangerCount || 0) + 1,
      gameChangerCountSource: "manual"
    });
  });
  elements.gcCountMinusBtn?.addEventListener("click", () => {
    state.updateDeck({
      gameChangerCount: Math.max(0, (state.activeDeck.gameChangerCount || 0) - 1),
      gameChangerCountSource: "manual"
    });
  });

  // 特徴カスタム追加
  elements.addCustomFeatureBtn?.addEventListener("click", () => addCustomFeature());
  elements.customFeatureInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomFeature();
    }
  });

  // 詳細モードの入力項目
  elements.deckNameInput?.addEventListener("input", (e) => state.updateDeck({ deckName: e.target.value }));
  elements.winConditionsInput?.addEventListener("input", (e) => state.updateDeck({ winConditions: e.target.value }));
  elements.comboDescriptionInput?.addEventListener("input", (e) => state.updateDeck({ comboDescription: e.target.value }));
  elements.approxTurnInput?.addEventListener("input", (e) => state.updateDeck({ approxWinTurn: e.target.value }));
  elements.proxyStatusSelect?.addEventListener("change", (e) => state.updateDeck({ proxyStatus: e.target.value }));
  elements.additionalNotesInput?.addEventListener("input", (e) => state.updateDeck({ additionalNotes: e.target.value }));

  // デッキリスト解析
  elements.analyzeDecklistBtn?.addEventListener("click", handleDecklistAnalysis);

  // テンプレートボタン
  elements.templateButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tid = btn.dataset.template;
      applyTemplate(tid);
    });
  });

  // 画像出力 & コピー & 共有
  elements.btnExportPng?.addEventListener("click", async () => {
    showToast(i18n.t("exportPng") + "...");
    await downloadSheetPNG(state.activeDeck, state.currentLang);
    setTimeout(() => openDonationModal(), 800);
  });

  elements.btnCopyImage?.addEventListener("click", async () => {
    showToast(i18n.t("copyImage") + "...");
    const ok = await copySheetToClipboard(state.activeDeck, state.currentLang);
    if (ok) {
      showToast(i18n.t("copiedSuccess"));
      setTimeout(() => openDonationModal(), 800);
    } else {
      showToast(i18n.t("copyFailed"));
    }
  });

  elements.btnShareUrl?.addEventListener("click", async () => {
    const url = generateShareUrl(state.activeDeck);
    const cmdName = (state.activeDeck.commanders || []).map(c => c.name).filter(Boolean).join(" & ");
    const shareTitle = `${state.activeDeck.deckName || 'Commander Rule 0 Sheet'} (Bracket ${state.activeDeck.bracket})`;

    // スマホ等でWeb Share APIが利用可能な場合はネイティブ共有
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareTitle} - ${cmdName}`,
          url: url
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }

    // PCまたはWeb Share非対応時はクリップボードにコピー
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        showToast(i18n.t("urlCopied"));
      }).catch(() => {
        prompt("Share URL:", url);
      });
    } else {
      prompt("Share URL:", url);
    }
  });

  elements.btnPrintSheet?.addEventListener("click", () => {
    printSheet();
  });

  // デッキ管理操作
  elements.btnSaveDeck?.addEventListener("click", () => {
    saveDeck(state.activeDeck);
    showToast("デッキを保存しました！");
  });

  elements.btnNewDeck?.addEventListener("click", () => {
    if (confirm("新しいデッキを作成しますか？")) {
      state.resetDeck();
      showToast("新規デッキを作成しました");
    }
  });

  elements.btnLoadDecks?.addEventListener("click", openDeckListModal);
  elements.closeModalBtn?.addEventListener("click", closeDeckListModal);
  elements.deckListModal?.addEventListener("click", (e) => {
    if (e.target === elements.deckListModal) closeDeckListModal();
  });

  elements.btnExportJson?.addEventListener("click", () => {
    exportDeckToJson(state.activeDeck);
  });

  elements.jsonFileInput?.addEventListener("change", handleJsonImport);

  // ドネーションモーダル開閉
  elements.closeDonationBtn?.addEventListener("click", closeDonationModal);
  elements.donationModal?.addEventListener("click", (e) => {
    if (e.target === elements.donationModal) closeDonationModal();
  });

  // 外側クリックでオートコンプリート候補を閉じる
  document.addEventListener("click", (e) => {
    if (!elements.commanderSearchInput?.contains(e.target) && !elements.commanderSuggestions?.contains(e.target)) {
      hideSuggestions();
    }
  });
}

/**
 * 統率者検索処理
 */
async function handleCommanderSearch(query) {
  if (searchAbortController) {
    searchAbortController.abort();
  }
  searchAbortController = new AbortController();

  elements.commanderSuggestions.innerHTML = `<li class="searching-item">${i18n.t("searching")}</li>`;
  elements.commanderSuggestions.style.display = "block";

  try {
    const suggestions = await autocompleteCardName(query, searchAbortController.signal);
    if (!suggestions || suggestions.length === 0) {
      // 候補なし、直接カード検索を試みる
      elements.commanderSuggestions.innerHTML = `
        <li class="custom-card-item" data-name="${escapeHtml(query)}">
          「${escapeHtml(query)}」を決定する
        </li>
      `;
    } else {
      elements.commanderSuggestions.innerHTML = suggestions.slice(0, 8).map(name => `
        <li class="suggestion-item" data-name="${escapeHtml(name)}">${escapeHtml(name)}</li>
      `).join("");
    }

    elements.commanderSuggestions.querySelectorAll("li").forEach(li => {
      li.addEventListener("click", () => {
        const selectedName = li.dataset.name;
        if (selectedName) {
          selectCommanderByName(selectedName, 0);
        }
        hideSuggestions();
      });
    });
  } catch (err) {
    if (err.name !== "AbortError") {
      hideSuggestions();
    }
  }
}

function hideSuggestions() {
  if (elements.commanderSuggestions) {
    elements.commanderSuggestions.style.display = "none";
  }
}

/**
 * カード名からScryfall情報を取得して統率者にセット
 */
async function selectCommanderByName(cardName, targetIndex = 0) {
  showToast(`${cardName} を読み込み中...`);
  const cardData = await fetchCardByName(cardName);

  if (cardData) {
    state.setCommander(targetIndex, cardData);
    showToast(`${cardData.printedName || cardData.name} を設定しました`);
  } else {
    // 取得できなかった場合は手動名としてセット
    state.setCommander(targetIndex, {
      id: "",
      name: cardName,
      printedName: cardName,
      imageUrl: "",
      manaCost: "",
      typeLine: "Legendary Creature",
      colorIdentity: []
    });
    showToast(`${cardName}（手動名）を設定しました`);
  }
}

/**
 * 特徴チップの初期化と描画
 */
function renderFeatureChips() {
  if (!elements.featureChipsContainer) return;

  const standardFeatures = [
    { key: "featCombat", ja: "戦闘ダメージ中心", en: "Combat Damage Focused" },
    { key: "featCombo", ja: "コンボ中心", en: "Combo Centric" },
    { key: "featInfinite", ja: "無限コンボあり", en: "Infinite Combos Included" },
    { key: "featTwoCardCombo", ja: "2枚コンボあり", en: "2-Card Combos Present" },
    { key: "featCommanderDep", ja: "統率者依存度高め", en: "Commander Dependent" },
    { key: "featControl", ja: "コントロール中心", en: "Heavy Control" },
    { key: "featCounter", ja: "打ち消し多め", en: "Counterspell Rich" },
    { key: "featBoardWipe", ja: "全体除去多め", en: "Frequent Board Wipes" },
    { key: "featStax", ja: "スタックス・ロック要素あり", en: "Stax / Lock Elements" },
    { key: "featGraveyard", ja: "墓地利用", en: "Graveyard Synergy" },
    { key: "featTokens", ja: "トークン大量生成", en: "Mass Token Generation" },
    { key: "featTutors", ja: "サーチ多め", en: "Tutor Heavy" },
    { key: "featExtraTurns", ja: "追加ターンあり", en: "Extra Turns Included" },
    { key: "featMLD", ja: "大量土地破壊あり", en: "Mass Land Destruction" },
    { key: "featProxy", ja: "プロキシ使用あり", en: "Proxies Used" }
  ];

  const currentFeatures = new Set(state.activeDeck.deckFeatures || []);

  elements.featureChipsContainer.innerHTML = standardFeatures.map(item => {
    const text = state.currentLang === "ja" ? item.ja : item.en;
    const isSelected = currentFeatures.has(item.ja) || currentFeatures.has(item.en);
    return `
      <button type="button" class="chip-btn ${isSelected ? 'active' : ''}" data-val-ja="${item.ja}" data-val-en="${item.en}">
        ${escapeHtml(text)}
      </button>
    `;
  }).join("");

  // カスタム追加されたタグのチップ
  state.activeDeck.deckFeatures?.forEach(f => {
    const isStd = standardFeatures.some(sf => sf.ja === f || sf.en === f);
    if (!isStd) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip-btn custom-chip active";
      btn.innerHTML = `${escapeHtml(f)} <span class="chip-remove" data-remove="${escapeHtml(f)}">×</span>`;
      btn.dataset.valJa = f;
      btn.dataset.valEn = f;
      elements.featureChipsContainer.appendChild(btn);
    }
  });

  // クリックイベント
  elements.featureChipsContainer.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      if (e.target.classList.contains("chip-remove")) {
        e.stopPropagation();
        const removeVal = e.target.dataset.remove;
        const nextList = (state.activeDeck.deckFeatures || []).filter(v => v !== removeVal);
        state.updateDeck({ deckFeatures: nextList });
        return;
      }

      const val = state.currentLang === "ja" ? btn.dataset.valJa : btn.dataset.valEn;
      const list = [...(state.activeDeck.deckFeatures || [])];
      const idx = list.indexOf(btn.dataset.valJa);
      const idxEn = list.indexOf(btn.dataset.valEn);

      if (idx >= 0 || idxEn >= 0) {
        if (idx >= 0) list.splice(idx, 1);
        if (idxEn >= 0) list.splice(idxEn, 1);
      } else {
        list.push(val);
      }
      state.updateDeck({ deckFeatures: list });
    });
  });
}

function addCustomFeature() {
  const input = elements.customFeatureInput;
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  const list = [...(state.activeDeck.deckFeatures || [])];
  if (!list.includes(val)) {
    list.push(val);
    state.updateDeck({ deckFeatures: list });
  }
  input.value = "";
}

/**
 * 対戦希望チップの描画
 */
function renderPrefChips() {
  const playPrefs = [
    { ja: "ゆっくり遊びたい", en: "Chill & Relaxed Game" },
    { ja: "勝敗より交流重視", en: "Social Fun over Winning" },
    { ja: "適度に競技的なゲームがしたい", en: "Focused & Competitive Spirit" },
    { ja: "コンボありでもOK", en: "Combos Welcomed" },
    { ja: "高速コンボも歓迎", en: "Fast Combos OK" },
    { ja: "長期戦歓迎", en: "Happy with Long Grinds" },
    { ja: "短時間の対戦希望", en: "Quick Match Preferred" },
    { ja: "初心者歓迎", en: "Beginners Welcome" },
    { ja: "デッキ調整中", en: "Deck in Testing / Tuning" }
  ];

  const avoidPrefs = [
    { ja: "大量土地破壊は避けたい", en: "Prefer No Mass Land Denial" },
    { ja: "長時間のロックは避けたい", en: "Prefer to Avoid Heavy Stax Locks" },
    { ja: "頻繁な追加ターンは避けたい", en: "Prefer Minimal Extra Turns" },
    { ja: "極端な高速コンボは避けたい", en: "Prefer No Early Combos (T1-4)" },
    { ja: "一方的な展開は避けたい", en: "Prefer No Non-Games" },
    { ja: "カジュアルに楽しみたい", en: "Looking for Friendly Vibes" }
  ];

  renderChipGroup(elements.playPrefChipsContainer, playPrefs, state.activeDeck.playPreferences || [], (newList) => {
    state.updateDeck({ playPreferences: newList });
  });

  renderChipGroup(elements.avoidPrefChipsContainer, avoidPrefs, state.activeDeck.avoidPreferences || [], (newList) => {
    state.updateDeck({ avoidPreferences: newList });
  });
}

function renderChipGroup(container, items, currentList, onChange) {
  if (!container) return;
  const set = new Set(currentList);

  container.innerHTML = items.map(item => {
    const text = state.currentLang === "ja" ? item.ja : item.en;
    const isSelected = set.has(item.ja) || set.has(item.en);
    return `
      <button type="button" class="chip-btn ${isSelected ? 'active' : ''}" data-val-ja="${item.ja}" data-val-en="${item.en}">
        ${escapeHtml(text)}
      </button>
    `;
  }).join("");

  container.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = state.currentLang === "ja" ? btn.dataset.valJa : btn.dataset.valEn;
      const list = [...currentList];
      const idxJa = list.indexOf(btn.dataset.valJa);
      const idxEn = list.indexOf(btn.dataset.valEn);

      if (idxJa >= 0 || idxEn >= 0) {
        if (idxJa >= 0) list.splice(idxJa, 1);
        if (idxEn >= 0) list.splice(idxEn, 1);
      } else {
        list.push(val);
      }
      onChange(list);
    });
  });
}

/**
 * 選択済み統率者カードUIの描画
 */
function renderSelectedCommanders() {
  if (!elements.commanderSelectedContainer) return;
  const commanders = state.activeDeck.commanders || [];

  elements.commanderSelectedContainer.innerHTML = commanders.map((cmd, idx) => {
    const displayName = state.currentLang === "ja" ? (cmd.printedName || cmd.name) : (cmd.name || cmd.printedName);
    return `
      <div class="selected-commander-card">
        ${cmd.imageUrl ? `
          <img src="${escapeHtml(cmd.imageUrl)}" alt="${escapeHtml(displayName)}" class="commander-thumb" />
        ` : `
          <div class="commander-thumb-placeholder">🂠</div>
        `}
        <div class="commander-info">
          <div class="commander-title">${escapeHtml(displayName || "（コマンダー未選択）")}</div>
          <div class="commander-sub">${escapeHtml(cmd.typeLine || "")} ${cmd.manaCost ? `• ${cmd.manaCost}` : ""}</div>
        </div>
        ${commanders.length > 1 ? `
          <button type="button" class="btn-remove-commander" data-idx="${idx}" title="解除">✕</button>
        ` : ""}
      </div>
    `;
  }).join("");

  elements.commanderSelectedContainer.querySelectorAll(".btn-remove-commander").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.removeCommander(idx);
    });
  });

  // 2枚目ボタンの表示・非表示
  if (elements.addPartnerBtn) {
    elements.addPartnerBtn.style.display = commanders.length >= 2 ? "none" : "inline-block";
  }
}

/**
 * ブラケットUI更新
 */
function renderBracketUI() {
  const currentB = state.activeDeck.bracket || 2;
  elements.bracketButtons.forEach(btn => {
    const b = parseInt(btn.dataset.bracket, 10);
    btn.classList.toggle("active", b === currentB);
  });

  // 警告チェック
  const bracket = APP_CONFIG.brackets.find(b => b.id === currentB) || APP_CONFIG.brackets[1];
  const gcCount = state.activeDeck.gameChangerCount || 0;
  if (elements.bracketWarningBox) {
    if (bracket.maxGameChangers < 90 && gcCount > bracket.maxGameChangers) {
      elements.bracketWarningBox.style.display = "block";
      elements.bracketWarningBox.textContent = i18n.t("bracketWarning", {
        limit: bracket.maxGameChangers,
        count: gcCount
      });
    } else {
      elements.bracketWarningBox.style.display = "none";
    }
  }
}

/**
 * 全UIの同期描画
 */
function renderAll() {
  const deck = state.activeDeck;

  // 統率者
  renderSelectedCommanders();
  if (elements.commanderDescInput) elements.commanderDescInput.value = deck.commanderDescription || "";

  // ブラケット
  renderBracketUI();

  // ゲームチェンジャー
  if (elements.gcCountInput) elements.gcCountInput.value = deck.gameChangerCount || 0;
  if (elements.gcSourceTag) {
    elements.gcSourceTag.textContent = deck.gameChangerCountSource === "automatic"
      ? i18n.t("gcSourceAuto")
      : i18n.t("gcSourceManual");
  }

  // 特徴 & 希望
  renderFeatureChips();
  renderPrefChips();

  // 詳細モード項目
  if (elements.deckNameInput) elements.deckNameInput.value = deck.deckName || "";
  if (elements.winConditionsInput) elements.winConditionsInput.value = deck.winConditions || "";
  if (elements.comboDescriptionInput) elements.comboDescriptionInput.value = deck.comboDescription || "";
  if (elements.approxTurnInput) elements.approxTurnInput.value = deck.approxWinTurn || "";
  if (elements.proxyStatusSelect) elements.proxyStatusSelect.value = deck.proxyStatus || "none";
  if (elements.additionalNotesInput) elements.additionalNotesInput.value = deck.additionalNotes || "";
  if (elements.sheetTypeSelect) elements.sheetTypeSelect.value = deck.sheetType || "quick";

  // プレビュー描画
  renderPreview();
}

/**
 * プレビュー更新
 */
function renderPreview() {
  updatePreviewDOM(elements.sheetPreviewContainer, state.activeDeck, state.currentLang);
}

/**
 * モード切替UIの更新
 */
function updateModeUI() {
  const isSimple = state.currentMode === "simple";
  elements.modeSimpleBtn?.classList.toggle("active", isSimple);
  elements.modeDetailedBtn?.classList.toggle("active", !isSimple);

  if (elements.detailedSection) {
    elements.detailedSection.style.display = isSimple ? "none" : "block";
  }

  // クイックシート/詳細シートの初期推奨
  if (isSimple && state.activeDeck.sheetType !== "quick") {
    state.updateDeck({ sheetType: "quick" });
  }
}

/**
 * スマホ用タブ切替
 */
function setMobileTab(tab) {
  const isForm = tab === "form";
  elements.mobileTabForm?.classList.toggle("active", isForm);
  elements.mobileTabPreview?.classList.toggle("active", !isForm);

  if (elements.formPane) elements.formPane.classList.toggle("mobile-hidden", !isForm);
  if (elements.previewPane) elements.previewPane.classList.toggle("mobile-hidden", isForm);

  if (!isForm) {
    renderPreview();
  }
}

/**
 * 言語設定
 */
function setLanguage(lang) {
  state.setLang(lang);
  i18n.setLang(lang);
  localStorage.setItem(APP_CONFIG.langKey, lang);
  if (elements.langSelect) elements.langSelect.value = lang;
  i18n.applyToDOM();
  renderAll();
}

/**
 * アプリUIテーマ設定
 */
function setAppTheme(theme) {
  state.setUiTheme(theme);
  localStorage.setItem(APP_CONFIG.themeKey, theme);
  document.documentElement.setAttribute("data-theme", theme);
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
  }
}

/**
 * デッキリスト解析処理
 */
function handleDecklistAnalysis() {
  const text = elements.decklistTextarea?.value || "";
  if (!text.trim()) {
    showToast("デッキリストを入力してください");
    return;
  }

  const result = analyzeDecklist(text);
  state.updateDeck({
    gameChangerCount: result.gcCount,
    gameChangerCountSource: "automatic",
    gameChangerCards: result.gameChangers.map(c => c.en)
  });

  // 統率者が検出され、まだ統率者がセットされていない場合は自動セット
  if (result.commanderNames.length > 0 && (!state.activeDeck.commanders[0] || !state.activeDeck.commanders[0].name)) {
    selectCommanderByName(result.commanderNames[0], 0);
  }

  if (elements.decklistResultBox) {
    elements.decklistResultBox.style.display = "block";
    elements.decklistResultBox.innerHTML = `
      <div class="result-summary">
        ${i18n.t("analyzeResult", { total: result.totalCards, gc: result.gcCount })}
      </div>
      ${result.gameChangers.length > 0 ? `
        <div class="gc-found-list">
          Game Changers: ${result.gameChangers.map(c => `<span class="gc-found-badge">${c.en}</span>`).join(" ")}
        </div>
      ` : ""}
    `;
  }

  showToast(`解析完了: Game Changers ${result.gcCount}枚`);
}

/**
 * テンプレート適用
 */
function applyTemplate(tplId) {
  const tpl = DECK_TEMPLATES[tplId];
  if (!tpl) return;

  const isJa = state.currentLang === "ja";
  state.updateDeck({
    bracket: tpl.bracket,
    gameChangerCount: tpl.gameChangerCount,
    deckFeatures: isJa ? [...tpl.features] : [...tpl.featuresEn],
    winConditions: isJa ? tpl.winConditionsJa : tpl.winConditionsEn,
    comboDescription: isJa ? tpl.comboDescriptionJa : tpl.comboDescriptionEn,
    playPreferences: isJa ? [...tpl.playPreferencesJa] : [...tpl.playPreferencesEn],
    avoidPreferences: isJa ? [...tpl.avoidPreferencesJa] : [...tpl.avoidPreferencesEn],
    approxWinTurn: tpl.approxWinTurn
  });

  showToast(i18n.t("templateApplied"));
}

/**
 * 保存済みデッキ一覧モーダル
 */
function openDeckListModal() {
  const modal = elements.deckListModal;
  const listEl = elements.deckListItems;
  if (!modal || !listEl) return;

  const saved = getSavedDecks();
  if (saved.length === 0) {
    listEl.innerHTML = `<li class="empty-list">保存されたデッキはありません</li>`;
  } else {
    listEl.innerHTML = saved.map(d => {
      const cmdName = (d.commanders || []).map(c => c.printedName || c.name).filter(Boolean).join(" & ") || "統率者なし";
      return `
        <li class="deck-list-item ${d.deckId === state.activeDeck.deckId ? 'active' : ''}">
          <div class="deck-item-info">
            <div class="deck-item-name">${escapeHtml(d.deckName || "名称未設定")}</div>
            <div class="deck-item-meta">
              ${escapeHtml(cmdName)} • Bracket ${d.bracket} • GC: ${d.gameChangerCount}
            </div>
          </div>
          <div class="deck-item-actions">
            <button type="button" class="btn-sm btn-load" data-id="${d.deckId}">読み込む</button>
            <button type="button" class="btn-sm btn-dup" data-id="${d.deckId}">複製</button>
            <button type="button" class="btn-sm btn-del" data-id="${d.deckId}">削除</button>
          </div>
        </li>
      `;
    }).join("");

    listEl.querySelectorAll(".btn-load").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const target = saved.find(d => d.deckId === id);
        if (target) {
          state.loadDeck(target);
          closeDeckListModal();
          showToast("デッキを読み込みました");
        }
      });
    });

    listEl.querySelectorAll(".btn-dup").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const target = saved.find(d => d.deckId === id);
        if (target) {
          const dup = duplicateDeck(target);
          state.loadDeck(dup);
          closeDeckListModal();
          showToast("デッキを複製しました");
        }
      });
    });

    listEl.querySelectorAll(".btn-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm("このデッキを削除してもよろしいですか？")) {
          deleteDeck(id);
          openDeckListModal();
        }
      });
    });
  }

  modal.classList.add("open");
}

function closeDeckListModal() {
  elements.deckListModal?.classList.remove("open");
}

/**
 * ドネーションモーダル
 */
function openDonationModal() {
  elements.donationModal?.classList.add("open");
}

function closeDonationModal() {
  elements.donationModal?.classList.remove("open");
}

/**
 * JSONファイルインポート
 */
function handleJsonImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const res = validateAndParseDeckJson(event.target.result);
    if (res.success && res.deck) {
      state.loadDeck(res.deck);
      saveDeck(res.deck);
      showToast("JSONからデッキをインポートしました");
    } else {
      alert("JSON読み込みエラー: " + (res.error || "不正なフォーマットです"));
    }
    e.target.value = "";
  };
  reader.readAsText(file);
}

/**
 * トーストメッセージ表示
 */
let toastTimer = null;
function showToast(message) {
  const toast = elements.toast;
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// DOMContentLoaded時に初期化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
