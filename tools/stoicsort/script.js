// StoicSort Logic

// DOM Elements
const thoughtInput = document.getElementById('thought-input');
const addBtn = document.getElementById('add-btn');
const listControllable = document.getElementById('list-controllable');
const listUncontrollable = document.getElementById('list-uncontrollable');
const countControllable = document.getElementById('count-controllable');
const countUncontrollable = document.getElementById('count-uncontrollable');
const finalizeBtn = document.getElementById('finalize-btn');

// Modal Elements
const sortModal = document.getElementById('sort-modal');
const currentItemText = document.getElementById('current-item-text');
const btnYes = document.getElementById('btn-yes');
const btnNo = document.getElementById('btn-no');

const resultView = document.getElementById('result-view');
const resultListContainer = document.getElementById('result-list-container');
const supportModal = document.getElementById('support-modal');
const closeSupportBtn = document.getElementById('close-support-btn');

// State
let items = [];
let pendingItemText = '';

// --- Initialization ---
function init() {
    loadItems();
    renderItems();
}

// --- Event Listeners ---
addBtn.addEventListener('click', handleAdd);
thoughtInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAdd();
});

btnYes.addEventListener('click', () => confirmItem(true));
btnNo.addEventListener('click', () => confirmItem(false));

finalizeBtn.addEventListener('click', showResult);
closeSupportBtn.addEventListener('click', () => supportModal.classList.add('hidden'));

// --- Core Logic ---

function handleAdd() {
    const text = thoughtInput.value.trim();
    if (!text) return;

    pendingItemText = text;
    // Show Modal
    currentItemText.textContent = pendingItemText;
    sortModal.classList.remove('hidden');
    thoughtInput.value = '';
}

function confirmItem(isControllable) {
    const newItem = {
        id: Date.now(),
        text: pendingItemText,
        isControllable: isControllable,
        createdAt: new Date().toISOString()
    };

    items.push(newItem);
    saveItems();
    renderItems();
    sortModal.classList.add('hidden');
}

function deleteItem(id) {
    items = items.filter(item => item.id !== id);
    saveItems();
    renderItems();
}

function saveItems() {
    localStorage.setItem('stoicItems', JSON.stringify(items));
}

function loadItems() {
    const stored = localStorage.getItem('stoicItems');
    if (stored) {
        items = JSON.parse(stored);
    }
}

function renderItems() {
    listControllable.innerHTML = '';
    listUncontrollable.innerHTML = '';

    let cCount = 0;
    let uCount = 0;

    items.forEach(item => {
        const el = document.createElement('div');
        el.className = `item ${item.isControllable ? 'type-controllable' : 'type-uncontrollable'}`;
        el.innerHTML = `
            <span>${escapeHtml(item.text)}</span>
            <button class="delete-btn" onclick="deleteItem(${item.id})">×</button>
        `;

        if (item.isControllable) {
            listControllable.appendChild(el);
            cCount++;
        } else {
            listUncontrollable.appendChild(el);
            uCount++;
        }
    });

    countControllable.textContent = cCount;
    countUncontrollable.textContent = uCount;

    // Scroll to bottom
    listControllable.scrollTop = listControllable.scrollHeight;
    listUncontrollable.scrollTop = listUncontrollable.scrollHeight;
}

function showResult() {
    const controllables = items.filter(i => i.isControllable);
    if (controllables.length === 0) {
        alert("No controllable items to focus on yet.");
        return;
    }

    resultListContainer.innerHTML = '';
    controllables.forEach(item => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.textContent = item.text;
        resultListContainer.appendChild(div);
    });

    resultView.classList.remove('hidden');
}

function resetAll() {
    if (confirm("Are you sure you want to reset everything?")) {
        items = [];
        saveItems();
        renderItems();
        resultView.classList.add('hidden');
    }
}


// --- Export Functions ---

async function exportImage(format) {
    const element = document.getElementById('export-target');
    try {
        const canvas = await html2canvas(element, {
            backgroundColor: '#000000',
            scale: 2
        });

        const link = document.createElement('a');
        link.download = `stoicsort_result.${format}`;
        link.href = canvas.toDataURL(`image/${format === 'png' ? 'png' : 'jpeg'}`);
        link.click();

        supportModal.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        alert("Export failed.");
    }
}

function exportPDF() {
    const element = document.getElementById('export-target');
    html2canvas(element, { scale: 2, backgroundColor: '#000000' }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save("stoicsort_result.pdf");

        supportModal.classList.remove('hidden');
    });
}


// --- Utilities ---
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// Start
init();
