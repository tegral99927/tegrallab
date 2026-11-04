/**
 * TimeLess - app.js
 * メインアプリケーション制御・イベントハンドリング
 */

import { DEFAULT_STATE, saveState, loadState, clearState, exportToJSON, validateAndParseJSON } from './storage.js';
import { ScheduleManager, DAY_NAMES, DAY_NAMES_EN, TIME_BLOCKS } from './schedule.js';
import { renderUIChart } from './charts.js';
import { renderExportCanvas, RESOLUTIONS } from './renderer.js';

// アプリケーション状態
let appState = null;
let scheduleManager = null;
let isDragging = false;
let dragAction = true; // true = 選択, false = 解除
let renderDebounceTimer = null;

// DOM要素参照
const elements = {
  themeSelect: document.getElementById('themeSelect'),
  btnExportJSON: document.getElementById('btnExportJSON'),
  importFile: document.getElementById('importFile'),
  btnResetAll: document.getElementById('btnResetAll'),

  // Profile
  userName: document.getElementById('userName'),
  userTimezone: document.getElementById('userTimezone'),
  userVoiceChat: document.getElementById('userVoiceChat'),
  userComment: document.getElementById('userComment'),
  avatarPreview: document.getElementById('avatarPreview'),
  avatarInput: document.getElementById('avatarInput'),
  avatarDropZone: document.getElementById('avatarDropZone'),
  avatarControls: document.getElementById('avatarControls'),
  avatarZoom: document.getElementById('avatarZoom'),
  btnResetAvatar: document.getElementById('btnResetAvatar'),

  // Schedule
  templateSelect: document.getElementById('templateSelect'),
  scheduleGrid: document.getElementById('scheduleGrid'),
  btnSelectWeekdays: document.getElementById('btnSelectWeekdays'),
  btnClearWeekdays: document.getElementById('btnClearWeekdays'),
  btnSelectWeekends: document.getElementById('btnSelectWeekends'),
  btnClearWeekends: document.getElementById('btnClearWeekends'),
  btnSelectAll: document.getElementById('btnSelectAll'),
  btnClearAll: document.getElementById('btnClearAll'),
  copySourceDay: document.getElementById('copySourceDay'),
  btnCopyDay: document.getElementById('btnCopyDay'),
  pasteTargetDay: document.getElementById('pasteTargetDay'),
  btnPasteDay: document.getElementById('btnPasteDay'),

  // Stats
  statWeeklyTotal: document.getElementById('statWeeklyTotal'),
  statWeekdayTotal: document.getElementById('statWeekdayTotal'),
  statWeekendTotal: document.getElementById('statWeekendTotal'),
  statPeakDay: document.getElementById('statPeakDay'),
  statPeakHour: document.getElementById('statPeakHour'),

  // Environments
  customFormatInput: document.getElementById('customFormatInput'),
  btnAddCustomFormat: document.getElementById('btnAddCustomFormat'),
  customFormatList: document.getElementById('customFormatList'),

  // Notes
  notesInput: document.getElementById('notesInput'),
  noteCharCounter: document.getElementById('noteCharCounter'),

  // Preview & Export
  previewCanvas: document.getElementById('previewCanvas'),
  canvasLoading: document.getElementById('canvasLoading'),
  uiWeekdayChart: document.getElementById('uiWeekdayChart'),
  uiWeekendChart: document.getElementById('uiWeekendChart'),
  exportResolution: document.getElementById('exportResolution'),
  exportFormat: document.getElementById('exportFormat'),
  jpegQualityGroup: document.getElementById('jpegQualityGroup'),
  jpegQuality: document.getElementById('jpegQuality'),
  jpegQualityVal: document.getElementById('jpegQualityVal'),
  btnDownload: document.getElementById('btnDownload'),
  btnCopyClipboard: document.getElementById('btnCopyClipboard'),
  toastContainer: document.getElementById('toastContainer')
};

/**
 * トーストメッセージ表示
 */
export function showToast(message, duration = 3000) {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

/**
 * 初期化処理
 */
async function initApp() {
  // 保存されたデータのロード
  appState = await loadState();
  scheduleManager = new ScheduleManager(appState.schedule);

  // テーマ適用
  applyTheme(appState.theme || 'midnight');

  // UI入力項目の反映
  syncUIFromState();

  // 7x24グリッドのDOM生成
  buildScheduleGrid();

  // イベントリスナーの登録
  setupEventListeners();

  // 統計更新 & プレビューレンダリング
  updateScheduleStats();
  requestCanvasRender();
}

/**
 * StateからUIへ反映
 */
function syncUIFromState() {
  if (elements.themeSelect) elements.themeSelect.value = appState.theme;

  // プロフィール
  if (elements.userName) elements.userName.value = appState.profile.name || '';
  if (elements.userTimezone) elements.userTimezone.value = appState.profile.timezone || 'JST (UTC+9)';
  if (elements.userVoiceChat) elements.userVoiceChat.value = appState.profile.voiceChat || 'ok';
  if (elements.userComment) elements.userComment.value = appState.profile.comment || '';

  if (appState.profile.avatar) {
    elements.avatarPreview.src = appState.profile.avatar;
    elements.avatarControls.style.display = 'flex';
    elements.avatarZoom.value = appState.profile.avatarZoom || 1;
  } else {
    elements.avatarPreview.src = 'assets/icons/default-avatar.svg';
    elements.avatarControls.style.display = 'none';
  }

  // 環境チェックボックス
  ['paper', 'arena', 'mo'].forEach(envId => {
    const chk = document.getElementById(`env_${envId}`);
    const envBox = document.querySelector(`.env-box[data-env="${envId}"]`);
    const isEnabled = Boolean(appState.environments[envId]?.enabled);
    if (chk) chk.checked = isEnabled;
    if (envBox) envBox.classList.toggle('active', isEnabled);

    // フォーマットチェックボックス
    const selectedFormats = appState.environments[envId]?.formats || [];
    const container = document.getElementById(`formats_${envId}`);
    if (container) {
      container.querySelectorAll('input[type="checkbox"]').forEach(fChk => {
        fChk.checked = selectedFormats.includes(fChk.value);
      });
    }
  });

  // カスタムフォーマットタグ
  renderCustomFormatTags();

  // 補足メモ
  if (elements.notesInput) {
    elements.notesInput.value = appState.notes || '';
    updateNoteCharCounter();
  }

  // エクスポート設定
  if (elements.exportResolution) elements.exportResolution.value = appState.exportSettings.resolution;
  if (elements.exportFormat) {
    elements.exportFormat.value = appState.exportSettings.format;
    elements.jpegQualityGroup.style.display = appState.exportSettings.format === 'jpeg' ? 'block' : 'none';
  }
  if (elements.jpegQuality) {
    elements.jpegQuality.value = appState.exportSettings.quality;
    elements.jpegQualityVal.textContent = `${Math.round(appState.exportSettings.quality * 100)}%`;
  }
}

/**
 * 7×24 スケジュールグリッドのDOM構築
 */
function buildScheduleGrid() {
  const container = elements.scheduleGrid;
  if (!container) return;
  container.innerHTML = '';

  // 1. コーナーセル (左上)
  const corner = document.createElement('div');
  corner.className = 'grid-cell-corner';
  corner.textContent = '時間＼曜';
  container.appendChild(corner);

  // 2. 曜日ヘッダー (7列)
  for (let d = 0; d < 7; d++) {
    const isWeekend = d >= 5;
    const header = document.createElement('div');
    header.className = `day-header-cell ${isWeekend ? 'weekend' : ''}`;
    header.id = `dayHeader_${d}`;

    const title = document.createElement('div');
    title.className = 'day-header-title';
    title.textContent = `${DAY_NAMES[d]} (${DAY_NAMES_EN[d]})`;

    const hours = document.createElement('div');
    hours.className = 'day-header-hours';
    hours.id = `dayHours_${d}`;
    hours.textContent = `${scheduleManager.getDayHours(d)}h`;

    const btnRow = document.createElement('div');
    btnRow.className = 'day-header-btn-row';

    const btnAll = document.createElement('button');
    btnAll.type = 'button';
    btnAll.className = 'day-mini-btn';
    btnAll.textContent = '全選';
    btnAll.title = `${DAY_NAMES[d]}曜日を全選択`;
    btnAll.addEventListener('click', () => {
      scheduleManager.setDayAll(d, true);
      refreshScheduleCellsForDay(d);
      onScheduleChanged();
    });

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.className = 'day-mini-btn';
    btnClear.textContent = '解除';
    btnClear.title = `${DAY_NAMES[d]}曜日を全解除`;
    btnClear.addEventListener('click', () => {
      scheduleManager.setDayAll(d, false);
      refreshScheduleCellsForDay(d);
      onScheduleChanged();
    });

    btnRow.appendChild(btnAll);
    btnRow.appendChild(btnClear);

    header.appendChild(title);
    header.appendChild(hours);
    header.appendChild(btnRow);
    container.appendChild(header);
  }

  // 3. 24時間 × 7列 のグリッドセル
  for (let h = 0; h < 24; h++) {
    // 左端の時間ラベル
    const timeLabel = document.createElement('div');
    timeLabel.className = `time-label-cell ${h % 6 === 0 ? 'major-tick' : ''}`;
    timeLabel.textContent = `${h}:00`;
    container.appendChild(timeLabel);

    // 7曜日分のセル
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement('div');
      cell.className = 'schedule-cell';
      cell.dataset.day = d;
      cell.dataset.hour = h;
      cell.tabIndex = 0;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `${DAY_NAMES[d]}曜日 ${h}:00〜${(h+1)%24}:00`);

      if (h % 6 === 0) cell.classList.add('major-row');
      if (scheduleManager.getCell(d, h)) cell.classList.add('active');

      // マウス操作
      cell.addEventListener('mousedown', (e) => handleCellMouseDown(d, h, e));
      cell.addEventListener('mouseenter', () => handleCellMouseEnter(d, h));

      // キーボード操作 (SpaceまたはEnterでトグル、矢印キーで移動)
      cell.addEventListener('keydown', (e) => handleCellKeyDown(d, h, e));

      container.appendChild(cell);
    }
  }

  // タッチ操作（スマホ用ドラッグ）
  setupTouchDrag(container);
}

/**
 * マウスセルドラッグ処理
 */
function handleCellMouseDown(day, hour, e) {
  if (e.button !== 0) return; // 左クリックのみ
  e.preventDefault();
  isDragging = true;
  // 開始セルの反転値をこのドラッグ中の統一アクションに決定
  dragAction = !scheduleManager.getCell(day, hour);
  scheduleManager.setCell(day, hour, dragAction);
  updateCellDOM(day, hour, dragAction);
}

function handleCellMouseEnter(day, hour) {
  if (!isDragging) return;
  if (scheduleManager.getCell(day, hour) !== dragAction) {
    scheduleManager.setCell(day, hour, dragAction);
    updateCellDOM(day, hour, dragAction);
  }
}

function handleCellKeyDown(day, hour, e) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    const nextVal = scheduleManager.toggleCell(day, hour);
    updateCellDOM(day, hour, nextVal);
    onScheduleChanged();
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    let targetDay = day;
    let targetHour = hour;
    if (e.key === 'ArrowUp') targetHour = Math.max(0, hour - 1);
    if (e.key === 'ArrowDown') targetHour = Math.min(23, hour + 1);
    if (e.key === 'ArrowLeft') targetDay = Math.max(0, day - 1);
    if (e.key === 'ArrowRight') targetDay = Math.min(6, day + 1);

    const targetCell = elements.scheduleGrid.querySelector(`.schedule-cell[data-day="${targetDay}"][data-hour="${targetHour}"]`);
    if (targetCell) targetCell.focus();
  }
}

/**
 * タッチによる連続ドラッグ選択
 */
function setupTouchDrag(container) {
  let touchDragging = false;
  let touchAction = true;

  container.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('schedule-cell')) {
      touchDragging = true;
      const day = parseInt(target.dataset.day, 10);
      const hour = parseInt(target.dataset.hour, 10);
      touchAction = !scheduleManager.getCell(day, hour);
      scheduleManager.setCell(day, hour, touchAction);
      updateCellDOM(day, hour, touchAction);
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (!touchDragging) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && target.classList.contains('schedule-cell')) {
      const day = parseInt(target.dataset.day, 10);
      const hour = parseInt(target.dataset.hour, 10);
      if (scheduleManager.getCell(day, hour) !== touchAction) {
        scheduleManager.setCell(day, hour, touchAction);
        updateCellDOM(day, hour, touchAction);
      }
    }
  }, { passive: true });

  const endTouch = () => {
    if (touchDragging) {
      touchDragging = false;
      onScheduleChanged();
    }
  };
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);
}

/**
 * 単一セルのDOM表示更新
 */
function updateCellDOM(day, hour, isActive) {
  const cell = elements.scheduleGrid.querySelector(`.schedule-cell[data-day="${day}"][data-hour="${hour}"]`);
  if (cell) {
    cell.classList.toggle('active', isActive);
  }
  // 曜日ヘッダーの時間表示更新
  const dayHoursEl = document.getElementById(`dayHours_${day}`);
  if (dayHoursEl) {
    dayHoursEl.textContent = `${scheduleManager.getDayHours(day)}h`;
  }
}

/**
 * 1曜日全体のセル表示更新
 */
function refreshScheduleCellsForDay(day) {
  for (let h = 0; h < 24; h++) {
    updateCellDOM(day, h, scheduleManager.getCell(day, h));
  }
}

/**
 * グリッド全体のセル表示更新
 */
function refreshAllScheduleCells() {
  for (let d = 0; d < 7; d++) {
    refreshScheduleCellsForDay(d);
  }
}

/**
 * スケジュール変更時の反映処理
 */
function onScheduleChanged() {
  appState.schedule = scheduleManager.getGrid();
  updateScheduleStats();
  saveState(appState);
  requestCanvasRender();
}

/**
 * 統計情報の更新
 */
function updateScheduleStats() {
  elements.statWeeklyTotal.textContent = `${scheduleManager.getTotalHours()}h`;
  elements.statWeekdayTotal.textContent = `${scheduleManager.getWeekdayHours()}h`;
  elements.statWeekendTotal.textContent = `${scheduleManager.getWeekendHours()}h`;

  const peakDay = scheduleManager.getPeakDay();
  elements.statPeakDay.textContent = peakDay.hours > 0 ? `${peakDay.name}曜日 (${peakDay.hours}h)` : 'なし';

  const peakHour = scheduleManager.getPeakHourRange();
  elements.statPeakHour.textContent = peakHour.allEmpty ? 'なし' : peakHour.label;
}

/**
 * テーマ切り替え
 */
function applyTheme(themeKey) {
  document.documentElement.dataset.theme = themeKey;
  appState.theme = themeKey;
  saveState(appState);
  requestCanvasRender();
}

/**
 * メモ文字数カウント更新
 */
function updateNoteCharCounter() {
  const len = elements.notesInput.value.length;
  elements.noteCharCounter.textContent = `${len} / 300`;
}

/**
 * カスタムフォーマットタグの描画
 */
function renderCustomFormatTags() {
  const container = elements.customFormatList;
  if (!container) return;
  container.innerHTML = '';

  (appState.customFormats || []).forEach((fmt, idx) => {
    const item = document.createElement('span');
    item.className = 'custom-tag-item';
    item.textContent = fmt;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'custom-tag-delete';
    delBtn.innerHTML = '&times;';
    delBtn.title = '削除';
    delBtn.addEventListener('click', () => {
      appState.customFormats.splice(idx, 1);
      saveState(appState);
      renderCustomFormatTags();
      requestCanvasRender();
    });

    item.appendChild(delBtn);
    container.appendChild(item);
  });
}

/**
 * キャンバスプレビュー＆UIチャートの非同期描画リクエスト (Debounce)
 */
function requestCanvasRender() {
  if (renderDebounceTimer) clearTimeout(renderDebounceTimer);
  renderDebounceTimer = setTimeout(async () => {
    // UIリングチャート更新
    const weekdayData = scheduleManager.getHourlyRatios([0, 1, 2, 3, 4]);
    const weekdayAvg = scheduleManager.getAverageWeekdayHours();
    renderUIChart(elements.uiWeekdayChart, weekdayData, weekdayAvg, '平日 (月〜金)', 'WEEKDAYS', appState.theme);

    const weekendData = scheduleManager.getHourlyRatios([5, 6]);
    const weekendAvg = scheduleManager.getAverageWeekendHours();
    renderUIChart(elements.uiWeekendChart, weekendData, weekendAvg, '休日 (土・日)', 'WEEKENDS', appState.theme);

    // プレビュー用キャンバス描画
    if (elements.previewCanvas) {
      await renderExportCanvas(elements.previewCanvas, appState, scheduleManager, {
        resolution: appState.exportSettings.resolution
      });
    }
  }, 60);
}

/**
 * 全イベントリスナー設定
 */
function setupEventListeners() {
  // マウスドラッグ終了検知
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      onScheduleChanged();
    }
  });

  // テーマ選択
  elements.themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });

  // ユーザー名
  elements.userName.addEventListener('input', (e) => {
    appState.profile.name = e.target.value;
    saveState(appState);
    requestCanvasRender();
  });

  // タイムゾーン
  elements.userTimezone.addEventListener('change', (e) => {
    appState.profile.timezone = e.target.value;
    saveState(appState);
    requestCanvasRender();
  });

  // ボイスチャット
  if (elements.userVoiceChat) {
    elements.userVoiceChat.addEventListener('change', (e) => {
      appState.profile.voiceChat = e.target.value;
      saveState(appState);
      requestCanvasRender();
    });
  }

  // 一言コメント
  elements.userComment.addEventListener('input', (e) => {
    appState.profile.comment = e.target.value;
    saveState(appState);
    requestCanvasRender();
  });

  // アバターアップロード
  elements.avatarInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      showToast('PNG、JPEG、WebP形式の画像を選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      appState.profile.avatar = loadEvt.target.result;
      appState.profile.avatarZoom = 1;
      elements.avatarPreview.src = appState.profile.avatar;
      elements.avatarControls.style.display = 'flex';
      elements.avatarZoom.value = 1;
      saveState(appState);
      requestCanvasRender();
      showToast('アイコン画像を登録しました');
    };
    reader.readAsDataURL(file);
  });

  // アバターズーム
  elements.avatarZoom.addEventListener('input', (e) => {
    appState.profile.avatarZoom = parseFloat(e.target.value);
    saveState(appState);
    requestCanvasRender();
  });

  // アバターリセット
  elements.btnResetAvatar.addEventListener('click', () => {
    appState.profile.avatar = null;
    appState.profile.avatarZoom = 1;
    elements.avatarPreview.src = 'assets/icons/default-avatar.svg';
    elements.avatarControls.style.display = 'none';
    elements.avatarInput.value = '';
    saveState(appState);
    requestCanvasRender();
    showToast('デフォルトアイコンに戻しました');
  });

  // テンプレート選択
  elements.templateSelect.addEventListener('change', (e) => {
    const templateId = e.target.value;
    if (!templateId) return;

    const confirmed = window.confirm('現在のスケジュールが上書きされます。よろしいですか？');
    if (confirmed) {
      scheduleManager.applyTemplate(templateId);
      refreshAllScheduleCells();
      onScheduleChanged();
      showToast('テンプレートを適用しました');
    }
    elements.templateSelect.value = '';
  });

  // 一括操作ボタン
  elements.btnSelectWeekdays.addEventListener('click', () => {
    scheduleManager.setWeekdays(true);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  elements.btnClearWeekdays.addEventListener('click', () => {
    scheduleManager.setWeekdays(false);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  elements.btnSelectWeekends.addEventListener('click', () => {
    scheduleManager.setWeekends(true);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  elements.btnClearWeekends.addEventListener('click', () => {
    scheduleManager.setWeekends(false);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  elements.btnSelectAll.addEventListener('click', () => {
    scheduleManager.setAll(true);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  elements.btnClearAll.addEventListener('click', () => {
    scheduleManager.setAll(false);
    refreshAllScheduleCells();
    onScheduleChanged();
  });

  // よく使う時間帯プリセットボタン
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const blockKey = btn.dataset.block;
      // 全曜日に適用
      scheduleManager.applyTimeBlock(blockKey, [0, 1, 2, 3, 4, 5, 6], true);
      refreshAllScheduleCells();
      onScheduleChanged();
      showToast(`${TIME_BLOCKS[blockKey]?.label}の時間帯を一括適用しました`);
    });
  });

  // 曜日のコピー・貼り付け
  elements.btnCopyDay.addEventListener('click', () => {
    const srcDay = parseInt(elements.copySourceDay.value, 10);
    scheduleManager.copyDay(srcDay);
    showToast(`${DAY_NAMES[srcDay]}曜日のスケジュールをコピーしました`);
  });

  elements.btnPasteDay.addEventListener('click', () => {
    if (!scheduleManager.hasCopiedDay()) {
      showToast('先にコピーする曜日を選択してください');
      return;
    }
    const targetDay = parseInt(elements.pasteTargetDay.value, 10);
    scheduleManager.pasteDay(targetDay);
    refreshScheduleCellsForDay(targetDay);
    onScheduleChanged();
    showToast(`${DAY_NAMES[targetDay]}曜日にスケジュールを貼り付けました`);
  });

  // 環境チェックボックス
  ['paper', 'arena', 'mo'].forEach(envId => {
    const chk = document.getElementById(`env_${envId}`);
    if (chk) {
      chk.addEventListener('change', (e) => {
        appState.environments[envId].enabled = e.target.checked;
        const envBox = document.querySelector(`.env-box[data-env="${envId}"]`);
        if (envBox) envBox.classList.toggle('active', e.target.checked);
        saveState(appState);
        requestCanvasRender();
      });
    }

    // フォーマットチェックボックス
    const formatsContainer = document.getElementById(`formats_${envId}`);
    if (formatsContainer) {
      formatsContainer.addEventListener('change', () => {
        const checkedList = Array.from(formatsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
        appState.environments[envId].formats = checkedList;
        saveState(appState);
        requestCanvasRender();
      });
    }
  });

  // カスタムフォーマット追加
  const addCustomFormat = () => {
    const val = elements.customFormatInput.value.trim();
    if (!val) return;
    if (appState.customFormats.includes(val)) {
      showToast('そのフォーマットは既に追加されています');
      return;
    }
    appState.customFormats.push(val);
    elements.customFormatInput.value = '';
    saveState(appState);
    renderCustomFormatTags();
    requestCanvasRender();
  };

  elements.btnAddCustomFormat.addEventListener('click', addCustomFormat);
  elements.customFormatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomFormat();
    }
  });

  // 補足メモ
  elements.notesInput.addEventListener('input', (e) => {
    appState.notes = e.target.value;
    updateNoteCharCounter();
    saveState(appState);
    requestCanvasRender();
  });

  // 解像度変更
  elements.exportResolution.addEventListener('change', (e) => {
    appState.exportSettings.resolution = e.target.value;
    saveState(appState);
    requestCanvasRender();
  });

  // 画像形式変更
  elements.exportFormat.addEventListener('change', (e) => {
    appState.exportSettings.format = e.target.value;
    elements.jpegQualityGroup.style.display = e.target.value === 'jpeg' ? 'block' : 'none';
    saveState(appState);
  });

  // JPEG画質スライダー
  elements.jpegQuality.addEventListener('input', (e) => {
    const q = parseFloat(e.target.value);
    appState.exportSettings.quality = q;
    elements.jpegQualityVal.textContent = `${Math.round(q * 100)}%`;
    saveState(appState);
  });

  // 画像ダウンロード実行
  elements.btnDownload.addEventListener('click', async () => {
    const resKey = appState.exportSettings.resolution;
    const format = appState.exportSettings.format;
    const quality = appState.exportSettings.quality;

    elements.canvasLoading.style.display = 'flex';

    try {
      // 一時的な高解像度レンダリング用Canvas
      const exportCanvas = document.createElement('canvas');
      await renderExportCanvas(exportCanvas, appState, scheduleManager, { resolution: resKey });

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const fileExt = format === 'jpeg' ? 'jpg' : 'png';
      const safeName = (appState.profile.name || 'Player').trim().replace(/[/\\?%*:|"<>]/g, '_');
      const fileName = `TimeLess_${safeName}_WeeklySchedule.${fileExt}`;

      exportCanvas.toBlob((blob) => {
        elements.canvasLoading.style.display = 'none';
        if (!blob) {
          showToast('画像の生成に失敗しました');
          return;
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`画像を保存しました: ${fileName}`);
      }, mimeType, quality);
    } catch (err) {
      elements.canvasLoading.style.display = 'none';
      console.error(err);
      showToast('ダウンロード処理中にエラーが発生しました');
    }
  });

  // クリップボードに画像をコピー
  elements.btnCopyClipboard.addEventListener('click', async () => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      showToast('お使いのブラウザはクリップボード画像コピーに非対応です。ダウンロードをご利用ください。');
      return;
    }

    elements.canvasLoading.style.display = 'flex';
    try {
      const exportCanvas = document.createElement('canvas');
      // クリップボードコピーは一般的なFull HDまたは標準解像度で最適化
      await renderExportCanvas(exportCanvas, appState, scheduleManager, { resolution: appState.exportSettings.resolution });

      exportCanvas.toBlob(async (blob) => {
        elements.canvasLoading.style.display = 'none';
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          showToast('クリップボードに画像をコピーしました！Discord等にそのまま貼り付け可能です。');
        } catch (clipboardErr) {
          console.error(clipboardErr);
          showToast('クリップボードへの書き込みが拒否されました。');
        }
      }, 'image/png');
    } catch (err) {
      elements.canvasLoading.style.display = 'none';
      console.error(err);
      showToast('コピー処理中にエラーが発生しました');
    }
  });

  // JSONエクスポート
  elements.btnExportJSON.addEventListener('click', () => {
    const jsonStr = exportToJSON(appState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeless_settings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('設定JSONをエクスポートしました');
  });

  // JSONインポート
  elements.importFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvt) => {
      const result = validateAndParseJSON(loadEvt.target.result);
      if (!result.success) {
        showToast(result.error);
        return;
      }

      appState = result.data;
      scheduleManager = new ScheduleManager(appState.schedule);
      await saveState(appState);

      applyTheme(appState.theme);
      syncUIFromState();
      refreshAllScheduleCells();
      updateScheduleStats();
      requestCanvasRender();
      showToast('設定JSONを読み込みました');
    };
    reader.readAsText(file);
    elements.importFile.value = '';
  });

  // 全設定初期化
  elements.btnResetAll.addEventListener('click', async () => {
    const confirmed = window.confirm('すべての設定とスケジュールを初期状態に戻しますか？');
    if (!confirmed) return;

    appState = await clearState();
    scheduleManager = new ScheduleManager(appState.schedule);

    applyTheme(appState.theme);
    syncUIFromState();
    refreshAllScheduleCells();
    updateScheduleStats();
    requestCanvasRender();
    showToast('初期状態にリセットしました');
  });
}

// 起動
document.addEventListener('DOMContentLoaded', initApp);

