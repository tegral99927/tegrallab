/**
 * vibullet - Cyberpunk Spec Generator
 */

const STORAGE_KEY = 'vibullet_data_v1';

// DOM Elements
const els = {
    name: document.getElementById('productName'),
    overview: document.getElementById('productOverview'),
    tech: document.getElementById('techStack'),
    features: document.getElementById('features'),
    preview: document.getElementById('preview-area'),
    print: document.getElementById('print-content'),
    toast: document.getElementById('toast'),
    supportModal: document.getElementById('support-modal'),
    closeModalBtn: document.getElementById('close-modal-btn')
};

// Initialize
window.onload = () => {
    loadData();
};

/**
 * Save current state to localStorage
 */
function autoSave() {
    const data = {
        name: els.name.value,
        overview: els.overview.value,
        tech: els.tech.value,
        features: els.features.value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Load state from localStorage
 */
function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            els.name.value = data.name || '';
            els.overview.value = data.overview || '';
            els.tech.value = data.tech || '';
            els.features.value = data.features || '';
            generateSpec(false); // Generate preview on load without toast
        } catch (e) {
            console.error('Failed to load data', e);
        }
    }
}

/**
 * Generate the specification text
 */
function generateSpec(showNotify = true) {
    const name = els.name.value.trim();
    const overview = els.overview.value.trim();
    const techList = parseList(els.tech.value);
    const featureList = parseList(els.features.value);

    let output = [];

    // 1. Header & Overview
    output.push(`##プロダクトの概要・名前##`);
    output.push(name || '（プロダクト名未定）');
    if (overview) {
        output.push(overview);
    }
    output.push('');

    // 2. Tech Stack
    if (techList.length > 0) {
        output.push(`##使用する技術・言語##`);
        techList.forEach(item => output.push(`・${item}`));
        output.push('');
    }

    // 3. Features
    if (featureList.length > 0) {
        output.push(`##機能##`);
        featureList.forEach(item => output.push(`・${item}`));
        output.push('');
    }

    const finalString = output.join('\n').trim();

    // Update Textarea
    els.preview.value = finalString;

    // Update Print Content
    let printHTML = `<h1>仕様書: ${name}</h1>`;
    printHTML += `<div style="margin-bottom:20px;"><strong>概要:</strong><br>${overview.replace(/\n/g, '<br>')}</div>`;

    if (techList.length > 0) {
        printHTML += `<h2>使用する技術・言語</h2><ul>${techList.map(t => `<li>${t}</li>`).join('')}</ul>`;
    }
    if (featureList.length > 0) {
        printHTML += `<h2>機能</h2><ul>${featureList.map(f => `<li>${f}</li>`).join('')}</ul>`;
    }
    els.print.innerHTML = printHTML;

    if (showNotify) showToast('PREVIEW UPDATED // 生成完了');
}

/**
 * Helper to parse textarea content into a clean list
 */
function parseList(text) {
    if (!text) return [];
    return text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

/**
 * Copy to Clipboard + Show Modal
 */
function copyToClipboard() {
    els.preview.select();
    document.execCommand('copy');
    showToast('COPIED TO CLIPBOARD // コピー完了');
    setTimeout(showSupportModal, 500);
}

/**
 * Show toast message
 */
function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    setTimeout(() => {
        els.toast.classList.remove('show');
    }, 2000);
}

/**
 * Download content as file + Show Modal
 */
function downloadFile(type) {
    const content = els.preview.value;
    if (!content) return;

    let filename = 'specification';
    const prodName = els.name.value.trim();
    if (prodName) {
        filename = prodName.replace(/[\\/:*?"<>|]/g, '_'); // Sanitize
    }

    let mimeType = 'text/plain';
    if (type === 'md') {
        filename += '.md';
        mimeType = 'text/markdown';
    } else {
        filename += '.txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('FILE DOWNLOADED // 保存完了');
    setTimeout(showSupportModal, 1000);
}

/**
 * PDF Print
 */
function printPDF() {
    window.print();
    setTimeout(showSupportModal, 1000);
}

/**
 * Export inputs as JSON
 */
function exportJSON() {
    const data = {
        name: els.name.value,
        overview: els.overview.value,
        tech: els.tech.value,
        features: els.features.value
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    let filename = 'vibullet_backup';
    if (data.name) filename += `_${data.name.replace(/[\\/:*?"<>|]/g, '_')}`;
    filename += '.json';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('CONFIG SAVED // 設定保存完了');
}

/**
 * Import inputs from JSON
 */
function importJSON(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data && typeof data === 'object') {
                els.name.value = data.name || '';
                els.overview.value = data.overview || '';
                els.tech.value = data.tech || '';
                els.features.value = data.features || '';

                autoSave();
                generateSpec(false);
                showToast('CONFIG LOADED // 設定読込完了');
            } else {
                alert('Invalid JSON File');
            }
        } catch (err) {
            alert('Failed to load file: ' + err.message);
        }
        input.value = '';
    };
    reader.readAsText(file);
}

/**
 * Reset all data
 */
function resetData() {
    if (confirm('RESET ALL DATA? \n入力内容をすべて削除しますか？')) {
        localStorage.removeItem(STORAGE_KEY);
        els.name.value = '';
        els.overview.value = '';
        els.tech.value = '';
        els.features.value = '';
        generateSpec(false);
        showToast('SYSTEM RESET // リセット完了');
    }
}

/**
 * Modal Logic
 */
function showSupportModal() {
    els.supportModal.classList.remove('hidden');
}

els.closeModalBtn.addEventListener('click', () => {
    els.supportModal.classList.add('hidden');
});

els.supportModal.addEventListener('click', (e) => {
    if (e.target === els.supportModal) {
        els.supportModal.classList.add('hidden');
    }
});
