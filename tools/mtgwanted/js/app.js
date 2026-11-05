/**
 * MTGWanted - app.js
 * アプリケーションコントローラー、DOMイベント、リアクティブプレビュー、画像エクスポート、支援案内
 */

import {
  CONFIG,
  THEMES,
  SIZES,
  BORDER_STYLES,
  PAPER_TEXTURES,
  STATUS_OPTIONS,
  DATE_FORMATS,
  STANDARD_FORMATS,
  PRESETS,
  getDefaultState,
  loadState,
  saveState,
  resetState,
  exportJson,
  importJson,
  downscaleAvatar
} from './storage.js';

import { renderPoster } from './renderer.js';

// 現在のアプリケーション状態
let state = loadState();
let renderTimeout = null;
let saveTimeout = null;

// DOM要素の参照
const dom = {};

/**
 * アプリケーション初期化
 */
document.addEventListener('DOMContentLoaded', () => {
  cacheDomElements();
  initPresetButtons();
  initFormatCheckboxes();
  initFormValues();
  bindEvents();

  // 初回レンダリング
  triggerRender();
});

/**
 * DOM要素のキャッシュ
 */
function cacheDomElements() {
  dom.posterCanvas = document.getElementById('posterCanvas');
  dom.previewContainer = document.getElementById('previewContainer');
  dom.overflowWarningBanner = document.getElementById('overflowWarningBanner');
  dom.btnSwitchLongPoster = document.getElementById('btnSwitchLongPoster');
  dom.toastContainer = document.getElementById('toastContainer');
  dom.donationCard = document.getElementById('donationCard');
  dom.btnDismissDonation = document.getElementById('btnDismissDonation');
  dom.boothLink = document.getElementById('boothLink');

  // プリセット
  dom.presetContainer = document.getElementById('presetContainer');

  // プロフィール
  dom.playerName = document.getElementById('playerName');
  dom.playerHandle = document.getElementById('playerHandle');
  dom.avatarFile = document.getElementById('avatarFile');
  dom.btnRemoveAvatar = document.getElementById('btnRemoveAvatar');
  dom.avatarZoom = document.getElementById('avatarZoom');
  dom.avatarZoomVal = document.getElementById('avatarZoomVal');
  dom.avatarX = document.getElementById('avatarX');
  dom.avatarY = document.getElementById('avatarY');
  dom.btnResetAvatarPos = document.getElementById('btnResetAvatarPos');
  dom.avatarShapeCircle = document.getElementById('avatarShapeCircle');
  dom.avatarShapeSquare = document.getElementById('avatarShapeSquare');
  dom.avatarSepia = document.getElementById('avatarSepia');
  dom.avatarSepiaGroup = document.getElementById('avatarSepiaGroup');
  dom.avatarSepiaIntensity = document.getElementById('avatarSepiaIntensity');
  dom.avatarSepiaVal = document.getElementById('avatarSepiaVal');

  // スケジュール（日時）
  dom.slotsContainer = document.getElementById('slotsContainer');
  dom.btnAddSlot = document.getElementById('btnAddSlot');
  dom.dateFormat = document.getElementById('dateFormat');
  dom.timeNegotiableGlobal = document.getElementById('timeNegotiableGlobal');
  dom.anytimeWelcomeGlobal = document.getElementById('anytimeWelcomeGlobal');

  // 環境 & フォーマット
  dom.envInPerson = document.getElementById('envInPerson');
  dom.envInPersonGroup = document.getElementById('envInPersonGroup');
  dom.inPersonLocation = document.getElementById('inPersonLocation');
  dom.envRemote = document.getElementById('envRemote');
  dom.envRemoteGroup = document.getElementById('envRemoteGroup');
  dom.remoteTool = document.getElementById('remoteTool');
  dom.envArena = document.getElementById('envArena');
  dom.envMo = document.getElementById('envMo');
  dom.formatsContainer = document.getElementById('formatsContainer');
  dom.customFormat = document.getElementById('customFormat');

  // 募集メモ
  dom.notesText = document.getElementById('notesText');
  dom.notesCharCount = document.getElementById('notesCharCount');
  dom.quickTagButtons = document.querySelectorAll('.quick-tag-btn');

  // ポスターデザイン
  dom.themeCards = document.querySelectorAll('.theme-card');
  dom.posterTitle = document.getElementById('posterTitle');
  dom.posterSubtitle = document.getElementById('posterSubtitle');
  dom.customFooter = document.getElementById('customFooter');
  dom.posterSize = document.getElementById('posterSize');
  dom.posterStatus = document.getElementById('posterStatus');
  dom.borderStyle = document.getElementById('borderStyle');
  dom.paperTexture = document.getElementById('paperTexture');
  dom.ornamentDensity = document.getElementById('ornamentDensity');
  dom.iconSize = document.getElementById('iconSize');
  dom.textAlign = document.getElementById('textAlign');
  dom.fontSizeScale = document.getElementById('fontSizeScale');
  dom.fontSizeScaleVal = document.getElementById('fontSizeScaleVal');

  // エクスポート・アクション
  dom.exportFormat = document.getElementById('exportFormat');
  dom.jpegQualityGroup = document.getElementById('jpegQualityGroup');
  dom.jpegQuality = document.getElementById('jpegQuality');
  dom.jpegQualityVal = document.getElementById('jpegQualityVal');
  dom.btnDownload = document.getElementById('btnDownload');
  dom.btnCopyClipboard = document.getElementById('btnCopyClipboard');

  // 設定管理
  dom.btnExportJson = document.getElementById('btnExportJson');
  dom.btnImportJson = document.getElementById('btnImportJson');
  dom.jsonFileInput = document.getElementById('jsonFileInput');
  dom.btnResetAll = document.getElementById('btnResetAll');
}

/**
 * プリセットボタンの動的生成
 */
function initPresetButtons() {
  if (!dom.presetContainer) return;
  dom.presetContainer.innerHTML = '';

  Object.entries(PRESETS).forEach(([key, preset]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    btn.innerHTML = `<strong>${preset.name}</strong><span class="preset-chip-desc">${preset.desc}</span>`;
    btn.addEventListener('click', () => applyPreset(key));
    dom.presetContainer.appendChild(btn);
  });
}

/**
 * フォーマットチェックボックスの動的生成
 */
function initFormatCheckboxes() {
  if (!dom.formatsContainer) return;
  dom.formatsContainer.innerHTML = '';

  STANDARD_FORMATS.forEach(fmt => {
    const label = document.createElement('label');
    label.className = 'format-pill-label';
    const isChecked = (state.formats || []).includes(fmt);

    label.innerHTML = `
      <input type="checkbox" value="${fmt}" ${isChecked ? 'checked' : ''} class="format-checkbox">
      <span class="format-pill-text">${fmt}</span>
    `;

    label.querySelector('input').addEventListener('change', (e) => {
      const checked = e.target.checked;
      let current = [...(state.formats || [])];
      if (checked && !current.includes(fmt)) {
        current.push(fmt);
      } else if (!checked) {
        current = current.filter(f => f !== fmt);
      }
      state.formats = current;
      scheduleSaveAndRender();
    });

    dom.formatsContainer.appendChild(label);
  });
}

/**
 * フォーム要素へ現在の状態を同期
 */
function initFormValues() {
  // プロフィール
  dom.playerName.value = state.profile.name || '';
  dom.playerHandle.value = state.profile.handle || '';
  dom.avatarZoom.value = state.profile.avatarZoom || 1;
  dom.avatarZoomVal.textContent = `${Math.round((state.profile.avatarZoom || 1) * 100)}%`;
  dom.avatarX.value = state.profile.avatarX || 0;
  dom.avatarY.value = state.profile.avatarY || 0;

  if (state.profile.avatarShape === 'square') {
    dom.avatarShapeSquare.checked = true;
  } else {
    dom.avatarShapeCircle.checked = true;
  }

  dom.avatarSepia.checked = state.profile.avatarSepia;
  dom.avatarSepiaGroup.style.display = state.profile.avatarSepia ? 'block' : 'none';
  dom.avatarSepiaIntensity.value = state.profile.avatarSepiaIntensity ?? 75;
  dom.avatarSepiaVal.textContent = `${state.profile.avatarSepiaIntensity ?? 75}%`;

  dom.btnRemoveAvatar.style.display = state.profile.avatar ? 'inline-flex' : 'none';

  // スケジュールスロット
  renderSlotsList();
  dom.dateFormat.value = state.schedule.dateFormat || 'western';
  dom.timeNegotiableGlobal.checked = Boolean(state.schedule.timeNegotiableGlobal);
  dom.anytimeWelcomeGlobal.checked = Boolean(state.schedule.anytimeWelcomeGlobal);

  // 環境
  dom.envInPerson.checked = Boolean(state.environments.paper_inperson);
  dom.envInPersonGroup.style.display = state.environments.paper_inperson ? 'block' : 'none';
  dom.inPersonLocation.value = state.environments.inPersonLocation || '';

  dom.envRemote.checked = Boolean(state.environments.paper_remote);
  dom.envRemoteGroup.style.display = state.environments.paper_remote ? 'block' : 'none';
  dom.remoteTool.value = state.environments.remoteTool || '';

  dom.envArena.checked = Boolean(state.environments.arena);
  dom.envMo.checked = Boolean(state.environments.mo);

  dom.customFormat.value = state.customFormat || '';

  // メモ
  dom.notesText.value = state.notes || '';
  dom.notesCharCount.textContent = (state.notes || '').length;

  // デザイン
  dom.posterTitle.value = state.poster.title || 'WANTED';
  dom.posterSubtitle.value = state.poster.subtitle || 'OPPONENT WANTED';
  dom.customFooter.value = state.poster.customFooter || 'REWARD: GLORIOUS BATTLE & HONOR';
  dom.posterSize.value = state.poster.size || 'landscape';
  dom.posterStatus.value = state.poster.status || 'recruiting';
  dom.borderStyle.value = state.poster.borderStyle || 'triple';
  dom.paperTexture.value = state.poster.paperTexture || 'parchment';
  dom.ornamentDensity.value = state.poster.ornamentDensity || 'normal';
  dom.iconSize.value = state.poster.iconSize || 'large';
  dom.textAlign.value = state.poster.textAlign || 'center';
  dom.fontSizeScale.value = state.poster.fontSizeScale || 1.0;
  dom.fontSizeScaleVal.textContent = `${Math.round((state.poster.fontSizeScale || 1.0) * 100)}%`;

  // テーマカードのアクティブ表示
  dom.themeCards.forEach(card => {
    if (card.dataset.theme === state.poster.theme) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // エクスポート設定
  dom.exportFormat.value = state.exportSettings?.format || 'png';
  dom.jpegQuality.value = state.exportSettings?.jpegQuality || 0.92;
  dom.jpegQualityVal.textContent = `${Math.round((state.exportSettings?.jpegQuality || 0.92) * 100)}%`;
  dom.jpegQualityGroup.style.display = dom.exportFormat.value === 'jpeg' ? 'block' : 'none';

  // BOOTHリンク
  if (CONFIG.BOOTH_URL && dom.boothLink) {
    dom.boothLink.href = CONFIG.BOOTH_URL;
  }
}

/**
 * 日時候補スロットの動的DOM構築
 */
function renderSlotsList() {
  if (!dom.slotsContainer) return;
  dom.slotsContainer.innerHTML = '';

  const slots = state.schedule?.slots || [];

  slots.forEach((slot, index) => {
    const card = document.createElement('div');
    card.className = 'slot-card';
    card.dataset.id = slot.id;

    card.innerHTML = `
      <div class="slot-header">
        <span class="slot-badge">候補 ${index + 1}</span>
        <div class="slot-controls">
          <button type="button" class="btn-slot-move" data-action="up" title="上に移動" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-slot-move" data-action="down" title="下に移動" ${index === slots.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn-slot-delete" data-action="delete" title="削除">✕</button>
        </div>
      </div>
      <div class="slot-body">
        <div class="form-row">
          <div class="form-col">
            <label class="control-label">日付</label>
            <input type="date" class="form-input slot-date" value="${slot.date || ''}">
          </div>
          <div class="form-col">
            <label class="control-label">開始時刻</label>
            <input type="time" class="form-input slot-start" value="${slot.startTime || ''}">
          </div>
          <div class="form-col">
            <label class="control-label">終了時刻</label>
            <input type="time" class="form-input slot-end" value="${slot.endTime || ''}">
          </div>
        </div>
        <div class="slot-sub-row">
          <label class="checkbox-label">
            <input type="checkbox" class="slot-nego" ${slot.negotiable ? 'checked' : ''}>
            <span>時間相談可</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" class="slot-any" ${slot.anytime ? 'checked' : ''}>
            <span>終日OK</span>
          </label>
          <input type="text" class="form-input slot-custom" placeholder="自由追記（例: 週末夜のみ）" value="${slot.customText || ''}">
        </div>
      </div>
    `;

    // 入力イベント
    card.querySelector('.slot-date').addEventListener('change', (e) => {
      slot.date = e.target.value;
      scheduleSaveAndRender();
    });
    card.querySelector('.slot-start').addEventListener('change', (e) => {
      slot.startTime = e.target.value;
      scheduleSaveAndRender();
    });
    card.querySelector('.slot-end').addEventListener('change', (e) => {
      slot.endTime = e.target.value;
      scheduleSaveAndRender();
    });
    card.querySelector('.slot-nego').addEventListener('change', (e) => {
      slot.negotiable = e.target.checked;
      scheduleSaveAndRender();
    });
    card.querySelector('.slot-any').addEventListener('change', (e) => {
      slot.anytime = e.target.checked;
      scheduleSaveAndRender();
    });
    card.querySelector('.slot-custom').addEventListener('input', (e) => {
      slot.customText = e.target.value;
      scheduleSaveAndRender();
    });

    // スロット並び替え・削除
    card.querySelector('[data-action="up"]')?.addEventListener('click', () => {
      if (index > 0) {
        const temp = slots[index - 1];
        slots[index - 1] = slots[index];
        slots[index] = temp;
        renderSlotsList();
        scheduleSaveAndRender();
      }
    });

    card.querySelector('[data-action="down"]')?.addEventListener('click', () => {
      if (index < slots.length - 1) {
        const temp = slots[index + 1];
        slots[index + 1] = slots[index];
        slots[index] = temp;
        renderSlotsList();
        scheduleSaveAndRender();
      }
    });

    card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      state.schedule.slots = slots.filter((_, i) => i !== index);
      renderSlotsList();
      scheduleSaveAndRender();
      showToast('日時候補を削除しました');
    });

    dom.slotsContainer.appendChild(card);
  });
}

/**
 * イベントリスナーのバインド
 */
function bindEvents() {
  // 1. プロフィールイベント
  dom.playerName.addEventListener('input', (e) => {
    state.profile.name = e.target.value;
    scheduleSaveAndRender();
  });

  dom.playerHandle.addEventListener('input', (e) => {
    state.profile.handle = e.target.value;
    scheduleSaveAndRender();
  });

  dom.avatarFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('画像を読み込み中...');
      const downscaled = await downscaleAvatar(file);
      state.profile.avatar = downscaled;
      dom.btnRemoveAvatar.style.display = 'inline-flex';
      scheduleSaveAndRender();
      showToast('アバター画像を設定しました');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.btnRemoveAvatar.addEventListener('click', () => {
    state.profile.avatar = null;
    dom.avatarFile.value = '';
    dom.btnRemoveAvatar.style.display = 'none';
    scheduleSaveAndRender();
    showToast('アバターを初期シルエットに戻しました');
  });

  dom.avatarZoom.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.profile.avatarZoom = val;
    dom.avatarZoomVal.textContent = `${Math.round(val * 100)}%`;
    scheduleSaveAndRender();
  });

  dom.avatarX.addEventListener('input', (e) => {
    state.profile.avatarX = parseInt(e.target.value, 10);
    scheduleSaveAndRender();
  });

  dom.avatarY.addEventListener('input', (e) => {
    state.profile.avatarY = parseInt(e.target.value, 10);
    scheduleSaveAndRender();
  });

  dom.btnResetAvatarPos.addEventListener('click', () => {
    state.profile.avatarX = 0;
    state.profile.avatarY = 0;
    state.profile.avatarZoom = 1.0;
    dom.avatarX.value = 0;
    dom.avatarY.value = 0;
    dom.avatarZoom.value = 1.0;
    dom.avatarZoomVal.textContent = '100%';
    scheduleSaveAndRender();
  });

  dom.avatarShapeCircle.addEventListener('change', () => {
    state.profile.avatarShape = 'circle';
    scheduleSaveAndRender();
  });

  dom.avatarShapeSquare.addEventListener('change', () => {
    state.profile.avatarShape = 'square';
    scheduleSaveAndRender();
  });

  dom.avatarSepia.addEventListener('change', (e) => {
    state.profile.avatarSepia = e.target.checked;
    dom.avatarSepiaGroup.style.display = e.target.checked ? 'block' : 'none';
    scheduleSaveAndRender();
  });

  dom.avatarSepiaIntensity.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    state.profile.avatarSepiaIntensity = val;
    dom.avatarSepiaVal.textContent = `${val}%`;
    scheduleSaveAndRender();
  });

  // 2. スケジュールイベント
  dom.btnAddSlot.addEventListener('click', () => {
    const slots = state.schedule.slots || [];
    if (slots.length >= 8) {
      showToast('日時候補は最大8件までです', 'warning');
      return;
    }
    slots.push({
      id: `slot_${Date.now()}`,
      date: '',
      startTime: '',
      endTime: '',
      negotiable: true,
      anytime: false,
      customText: ''
    });
    renderSlotsList();
    scheduleSaveAndRender();
    showToast('日時候補を追加しました');
  });

  dom.dateFormat.addEventListener('change', (e) => {
    state.schedule.dateFormat = e.target.value;
    scheduleSaveAndRender();
  });

  dom.timeNegotiableGlobal.addEventListener('change', (e) => {
    state.schedule.timeNegotiableGlobal = e.target.checked;
    scheduleSaveAndRender();
  });

  dom.anytimeWelcomeGlobal.addEventListener('change', (e) => {
    state.schedule.anytimeWelcomeGlobal = e.target.checked;
    scheduleSaveAndRender();
  });

  // 3. 環境 & フォーマットイベント
  dom.envInPerson.addEventListener('change', (e) => {
    state.environments.paper_inperson = e.target.checked;
    dom.envInPersonGroup.style.display = e.target.checked ? 'block' : 'none';
    scheduleSaveAndRender();
  });

  dom.inPersonLocation.addEventListener('input', (e) => {
    state.environments.inPersonLocation = e.target.value;
    scheduleSaveAndRender();
  });

  dom.envRemote.addEventListener('change', (e) => {
    state.environments.paper_remote = e.target.checked;
    dom.envRemoteGroup.style.display = e.target.checked ? 'block' : 'none';
    scheduleSaveAndRender();
  });

  dom.remoteTool.addEventListener('input', (e) => {
    state.environments.remoteTool = e.target.value;
    scheduleSaveAndRender();
  });

  dom.envArena.addEventListener('change', (e) => {
    state.environments.arena = e.target.checked;
    scheduleSaveAndRender();
  });

  dom.envMo.addEventListener('change', (e) => {
    state.environments.mo = e.target.checked;
    scheduleSaveAndRender();
  });

  dom.customFormat.addEventListener('input', (e) => {
    state.customFormat = e.target.value;
    scheduleSaveAndRender();
  });

  // 4. メモイベント
  dom.notesText.addEventListener('input', (e) => {
    state.notes = e.target.value;
    dom.notesCharCount.textContent = e.target.value.length;
    scheduleSaveAndRender();
  });

  dom.quickTagButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (!tag) return;
      if (dom.notesText.value) {
        dom.notesText.value += (dom.notesText.value.endsWith('\n') ? '' : '\n') + tag;
      } else {
        dom.notesText.value = tag;
      }
      state.notes = dom.notesText.value;
      dom.notesCharCount.textContent = dom.notesText.value.length;
      scheduleSaveAndRender();
    });
  });

  // はみ出し警告バナーの長尺ポスター切り替えボタン
  dom.btnSwitchLongPoster?.addEventListener('click', () => {
    state.poster.size = 'long_portrait';
    dom.posterSize.value = 'long_portrait';
    scheduleSaveAndRender();
    showToast('長尺ポスターサイズに変更しました');
  });

  // 5. デザイン設定イベント
  dom.themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const selected = card.dataset.theme;
      state.poster.theme = selected;
      dom.themeCards.forEach(c => c.classList.toggle('active', c.dataset.theme === selected));
      scheduleSaveAndRender();
    });
  });

  dom.posterTitle.addEventListener('input', (e) => {
    state.poster.title = e.target.value;
    scheduleSaveAndRender();
  });

  dom.posterSubtitle.addEventListener('input', (e) => {
    state.poster.subtitle = e.target.value;
    scheduleSaveAndRender();
  });

  dom.customFooter.addEventListener('input', (e) => {
    state.poster.customFooter = e.target.value;
    scheduleSaveAndRender();
  });

  dom.posterSize.addEventListener('change', (e) => {
    state.poster.size = e.target.value;
    scheduleSaveAndRender();
  });

  dom.posterStatus.addEventListener('change', (e) => {
    state.poster.status = e.target.value;
    scheduleSaveAndRender();
  });

  dom.borderStyle.addEventListener('change', (e) => {
    state.poster.borderStyle = e.target.value;
    scheduleSaveAndRender();
  });

  dom.paperTexture.addEventListener('change', (e) => {
    state.poster.paperTexture = e.target.value;
    scheduleSaveAndRender();
  });

  dom.ornamentDensity.addEventListener('change', (e) => {
    state.poster.ornamentDensity = e.target.value;
    scheduleSaveAndRender();
  });

  dom.iconSize.addEventListener('change', (e) => {
    state.poster.iconSize = e.target.value;
    scheduleSaveAndRender();
  });

  dom.textAlign.addEventListener('change', (e) => {
    state.poster.textAlign = e.target.value;
    scheduleSaveAndRender();
  });

  dom.fontSizeScale.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.poster.fontSizeScale = val;
    dom.fontSizeScaleVal.textContent = `${Math.round(val * 100)}%`;
    scheduleSaveAndRender();
  });

  // 6. 画像エクスポート
  dom.exportFormat.addEventListener('change', (e) => {
    const isJpeg = e.target.value === 'jpeg';
    state.exportSettings.format = isJpeg ? 'jpeg' : 'png';
    dom.jpegQualityGroup.style.display = isJpeg ? 'block' : 'none';
    scheduleSaveAndRender();
  });

  dom.jpegQuality.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.exportSettings.jpegQuality = val;
    dom.jpegQualityVal.textContent = `${Math.round(val * 100)}%`;
    scheduleSaveAndRender();
  });

  dom.btnDownload.addEventListener('click', handleDownload);
  dom.btnCopyClipboard.addEventListener('click', handleCopyClipboard);

  // 7. 支援案内カードの閉じるボタン
  dom.btnDismissDonation?.addEventListener('click', () => {
    dom.donationCard.style.display = 'none';
  });

  // 8. 設定管理
  dom.btnExportJson.addEventListener('click', () => {
    exportJson(state);
    showToast('設定JSONファイルを書き出しました');
  });

  dom.btnImportJson.addEventListener('click', () => {
    dom.jsonFileInput.click();
  });

  dom.jsonFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importJson(file);
      state = imported;
      saveState(state);
      initFormatCheckboxes();
      initFormValues();
      scheduleSaveAndRender();
      showToast('設定を読み込みました');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  dom.btnResetAll.addEventListener('click', () => {
    if (confirm('すべての入力内容とカスタマイズを初期化してもよろしいですか？')) {
      state = resetState();
      initFormatCheckboxes();
      initFormValues();
      scheduleSaveAndRender();
      showToast('初期状態にリセットしました');
    }
  });
}

/**
 * プリセットの適用
 */
function applyPreset(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  const hasUserData = Boolean(
    state.profile.name !== 'Planeswalker' ||
    state.profile.handle !== '@YourHandle' ||
    state.profile.avatar ||
    (state.notes && state.notes !== getDefaultState().notes)
  );

  if (hasUserData) {
    if (!confirm(`プリセット「${preset.name}」を適用しますか？\n（入力済みの環境やフォーマット、募集要項が上書きされます。プレイヤー情報は保持されます。）`)) {
      return;
    }
  }

  // プリセットデータの反映（プレイヤー情報は保持）
  state.poster.title = preset.data.poster.title;
  state.poster.subtitle = preset.data.poster.subtitle;
  state.poster.customFooter = preset.data.poster.customFooter;
  state.environments = { ...preset.data.environments };
  state.formats = [...preset.data.formats];
  state.customFormat = preset.data.customFormat;
  state.notes = preset.data.notes;

  initFormatCheckboxes();
  initFormValues();
  scheduleSaveAndRender();
  showToast(`プリセット「${preset.name}」を適用しました`);
}

/**
 * レンダリングと保存のデバウンス呼び出し
 */
function scheduleSaveAndRender() {
  clearTimeout(renderTimeout);
  renderTimeout = setTimeout(() => {
    triggerRender();
  }, 40);

  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const res = saveState(state);
    if (res.warning) showToast(res.warning, 'warning');
  }, CONFIG.AUTO_SAVE_DEBOUNCE_MS);
}

/**
 * ポスターレンダリングの実行
 */
async function triggerRender() {
  if (!dom.posterCanvas) return;
  try {
    const result = await renderPoster(state, dom.posterCanvas);

    // テキストはみ出し警告バナーの制御
    if (dom.overflowWarningBanner) {
      if (result.overflowWarning) {
        dom.overflowWarningBanner.style.display = 'flex';
      } else {
        dom.overflowWarningBanner.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('[MTGWanted] Render error:', err);
  }
}

/**
 * 画像ダウンロード処理
 */
async function handleDownload() {
  showToast('ポスター画像を生成中...');
  await triggerRender();

  const isJpeg = state.exportSettings?.format === 'jpeg';
  const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
  const quality = isJpeg ? (state.exportSettings?.jpegQuality || 0.92) : undefined;
  const ext = isJpeg ? 'jpg' : 'png';

  const todayStr = new Date().toISOString().split('T')[0];
  const filename = `MTGWanted_${todayStr}.${ext}`;

  dom.posterCanvas.toBlob((blob) => {
    if (!blob) {
      showToast('画像の生成に失敗しました', 'error');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`画像をダウンロードしました (${filename})`, 'success');

    // 正常保存後に任意の支援案内カードを表示
    if (CONFIG.BOOTH_URL && dom.donationCard) {
      dom.donationCard.style.display = 'block';
    }
  }, mimeType, quality);
}

/**
 * クリップボードへの画像直接コピー
 */
async function handleCopyClipboard() {
  if (!navigator.clipboard || !window.ClipboardItem) {
    showToast('お使いのブラウザはクリップボードへの画像コピーに対応していません。ダウンロードボタンをご利用ください。', 'warning');
    return;
  }

  showToast('画像をクリップボードに準備中...');
  await triggerRender();

  dom.posterCanvas.toBlob(async (blob) => {
    if (!blob) {
      showToast('画像の生成に失敗しました', 'error');
      return;
    }

    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      showToast('クリップボードに画像をコピーしました！Discord等にそのまま貼り付けできます', 'success');

      if (CONFIG.BOOTH_URL && dom.donationCard) {
        dom.donationCard.style.display = 'block';
      }
    } catch (err) {
      console.warn('[MTGWanted] Clipboard write error:', err);
      showToast('クリップボードへのコピーに失敗しました。ダウンロードをご利用ください。', 'error');
    }
  }, 'image/png');
}

/**
 * トースト通知表示ユーティリティ
 */
function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  dom.toastContainer.appendChild(toast);

  // アニメーション表示
  setTimeout(() => toast.classList.add('show'), 10);

  // 3.5秒後に消去
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

