/**
 * PlaymatImageEditor - js/app.js
 * アプリケーションエントリーポイント、グローバルイベント、ショートカット、初期化
 */

import { Editor } from './editor.js';
import { ToolManager, TOOL_TYPES } from './tools.js';
import { PresetManager } from './presets.js';
import { StorageManager } from './storage.js';
import { ExportManager } from './export.js';
import { UIManager } from './ui.js';
import { ImageLayer, deserializeLayer } from './layers.js';

// グローバル設定 (BOOTH URLはここから簡単に変更可能)
const APP_CONFIG = {
  boothUrl: 'https://tegral.booth.pm/', // 開発者のBOOTH支援ページURL
  maxDonationShowPerSession: 2
};

document.addEventListener('DOMContentLoaded', async () => {
  const canvasEl = document.getElementById('main-viewport-canvas');
  const containerEl = document.getElementById('canvas-workspace');

  if (!canvasEl || !containerEl) {
    console.error('キャンバスまたはコンテナ要素が見つかりません。');
    return;
  }

  // 1. 各マネージャーの生成
  const editor = new Editor(canvasEl, containerEl);
  const toolManager = new ToolManager(editor);
  const presetManager = new PresetManager();
  const storageManager = new StorageManager();
  const exportManager = new ExportManager(editor);
  const uiManager = new UIManager(editor, toolManager, presetManager, storageManager, exportManager, APP_CONFIG);

  // 2. キャンバスへのポインタイベント登録 (マウス / タッチ / ペン)
  let isSpacePressed = false;

  const getCanvasEventPos = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const canvasPos = editor.clientToCanvas(clientX, clientY);
    return {
      canvasPos,
      clientPos: { x: clientX, y: clientY }
    };
  };

  canvasEl.addEventListener('pointerdown', (e) => {
    canvasEl.setPointerCapture(e.pointerId);
    const { canvasPos, clientPos } = getCanvasEventPos(e);
    toolManager.onPointerDown({ spaceKey: isSpacePressed, ...e }, canvasPos, clientPos);
  });

  canvasEl.addEventListener('pointermove', (e) => {
    const { canvasPos, clientPos } = getCanvasEventPos(e);
    toolManager.onPointerMove({ spaceKey: isSpacePressed, ...e }, canvasPos, clientPos);
  });

  canvasEl.addEventListener('pointerup', (e) => {
    try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
    toolManager.onPointerUp(e);
  });

  canvasEl.addEventListener('pointercancel', (e) => {
    try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}
    toolManager.onPointerUp(e);
  });

  // 3. マウスホイールによるズーム
  containerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    editor.setZoom(editor.viewport.zoom * zoomFactor, e.clientX, e.clientY);
    uiManager.updateStatus();
  }, { passive: false });

  // 4. キーボードショートカット
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    // スペースキー長押しで一時ハンドモード
    if (e.code === 'Space' && !isTyping && !isSpacePressed) {
      isSpacePressed = true;
      containerEl.style.cursor = 'grab';
    }

    if (isTyping) return; // 入力フォーム中はショートカットをスキップ

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    // Undo / Redo
    if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      editor.undo();
    } else if ((isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z') || (isCtrlOrCmd && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      editor.redo();
    }

    // 保存 (Ctrl+S)
    if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
      e.preventDefault();
      uiManager.saveProjectFile();
    }

    // 削除 (Delete / Backspace)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editor.selectedLayerId) {
        e.preventDefault();
        editor.removeLayer(editor.selectedLayerId);
      }
    }

    // 選択解除 (Escape)
    if (e.key === 'Escape') {
      editor.deselectAll();
      uiManager.closeAllModals();
    }

    // ツールショートカット
    switch (e.key.toLowerCase()) {
      case 'v':
        uiManager.setActiveToolButton(TOOL_TYPES.SELECT);
        toolManager.setTool(TOOL_TYPES.SELECT);
        break;
      case 'h':
        uiManager.setActiveToolButton(TOOL_TYPES.HAND);
        toolManager.setTool(TOOL_TYPES.HAND);
        break;
      case 'p':
        uiManager.setActiveToolButton(TOOL_TYPES.PEN);
        toolManager.setTool(TOOL_TYPES.PEN);
        break;
      case 'e':
        uiManager.setActiveToolButton(TOOL_TYPES.ERASER);
        toolManager.setTool(TOOL_TYPES.ERASER);
        break;
      case 't':
        uiManager.setActiveToolButton(TOOL_TYPES.TEXT);
        toolManager.setTool(TOOL_TYPES.TEXT);
        break;
      case 'i':
        uiManager.setActiveToolButton(TOOL_TYPES.EYEDROPPER);
        toolManager.setTool(TOOL_TYPES.EYEDROPPER);
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isSpacePressed = false;
      containerEl.style.cursor = 'default';
    }
  });

  // 5. ドラッグ＆ドロップで画像追加
  const handleDropFiles = (files) => {
    for (const file of files) {
      if (file.name.endsWith('.playmat.json') || file.type === 'application/json') {
        // プロジェクトファイル
        storageManager.importProjectFile(file).then(data => {
          editor.updateCanvasConfig(data.canvas);
          editor.layers = data.layers.map(l => deserializeLayer(l));
          editor.selectedLayerId = null;
          editor.fitToScreen();
          editor.recordHistory('プロジェクト読込');
          uiManager.renderLayerList();
          uiManager.updateStatus();
          uiManager.showToast('プロジェクトを復元しました', 'success');
        }).catch(err => uiManager.showToast(err.message, 'error'));
      } else {
        const isImage = (file.type && file.type.startsWith('image/')) || /\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name);
        if (isImage) {
          uiManager.loadImageFile(file);
        }
      }
    }
  };

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
  });

  containerEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    containerEl.classList.add('drag-over');
  });

  containerEl.addEventListener('dragleave', () => {
    containerEl.classList.remove('drag-over');
  });

  containerEl.addEventListener('drop', (e) => {
    e.preventDefault();
    containerEl.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files || []);
    handleDropFiles(files);
  });

  // 6. クリップボード貼り付け (Ctrl+V)
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          uiManager.loadImageFile(file);
          uiManager.showToast('クリップボードから画像を貼り付けました', 'info');
        }
      }
    }
  });

  // 7. テーマ切り替え (Dark / Light)
  const themeToggleBtn = document.getElementById('btn-toggle-theme');
  const storedTheme = localStorage.getItem('playmat_image_editor_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', storedTheme);
  if (themeToggleBtn) {
    themeToggleBtn.textContent = storedTheme === 'light' ? '🌙' : '☀️';
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('playmat_image_editor_theme', next);
      themeToggleBtn.textContent = next === 'light' ? '🌙' : '☀️';
      editor.requestRedraw();
    });
  }

  // 8. ウィンドウリサイズ対応
  window.addEventListener('resize', () => {
    editor.requestRedraw();
  });

  // 9. 自動保存の開始 & 起動時バックアップ確認
  storageManager.startAutoSave(() => {
    return {
      version: 1,
      appName: 'PlaymatImageEditor',
      canvas: editor.canvasConfig,
      layers: editor.layers.map(l => l.serialize()),
      updatedAt: Date.now()
    };
  });

  // 前回のバックアップ復元確認
  try {
    const backup = await storageManager.loadFromIndexedDB();
    if (backup && backup.data && backup.data.layers && backup.data.layers.length > 1) {
      const dateStr = new Date(backup.savedAt).toLocaleString('ja-JP');
      const shouldRestore = window.confirm(`前回の編集データが見つかりました（${dateStr} 保存）。\n復元しますか？`);
      if (shouldRestore) {
        const data = storageManager.validateProjectData(backup.data);
        editor.updateCanvasConfig(data.canvas);
        editor.layers = data.layers.map(l => deserializeLayer(l));
        editor.selectedLayerId = null;
        editor.fitToScreen();
        uiManager.renderLayerList();
        uiManager.updateStatus();
        uiManager.showToast('前回の作業状態を復元しました', 'success');
      }
    }
  } catch (err) {
    console.warn('バックアップの復元チェック失敗:', err);
  }

  // 初回リサイズ＆フィット
  setTimeout(() => {
    editor.fitToScreen();
  }, 100);
});

