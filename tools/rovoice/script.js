/**
 * RoVoice - Robot Voice Changer Script
 * Handles AudioContext, Effect Chain, Visuals, and MP3 Encoding.
 * V4: Dual Preview (Raw vs Robot) for Files
 */

// UI Elements
const startBtn = document.getElementById('start-btn');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const saveBtn = document.getElementById('save-btn');
const saveRawBtn = document.getElementById('save-raw-btn');
const statusText = document.getElementById('status-text');
const pulseIndicator = document.querySelector('.pulse-indicator');
const canvas = document.getElementById('waveform-canvas');
const canvasCtx = canvas.getContext('2d');
const audioPreview = document.getElementById('audio-preview');
const recordGroup = document.getElementById('record-group');
const exportGroup = document.getElementById('export-group');
const filenameInput = document.getElementById('filename-input');
const supportModal = document.getElementById('support-modal');
const closeModalBtn = document.getElementById('close-modal-btn');

// Tabs & File Input
const tabMic = document.getElementById('tab-mic');
const tabFile = document.getElementById('tab-file');
const fileInputContainer = document.getElementById('file-input-container');
const audioUpload = document.getElementById('audio-upload');
const fileNameDisplay = document.getElementById('file-name-display');
const filePlaybackControls = document.getElementById('file-playback-controls');
const filePlayRawBtn = document.getElementById('file-play-raw-btn');
const filePlayRobotBtn = document.getElementById('file-play-robot-btn');
const fileStopBtn = document.getElementById('file-stop-btn');

// Sliders / Parameters (Live)
const pitchSlider = document.getElementById('pitch-slider');
const pitchVal = document.getElementById('pitch-val');
const depthSlider = document.getElementById('depth-slider');
const depthVal = document.getElementById('depth-val');
const distortionSlider = document.getElementById('distortion-slider');
const distortionVal = document.getElementById('distortion-val');
const delaySlider = document.getElementById('delay-slider');
const delayVal = document.getElementById('delay-val');
const feedbackSlider = document.getElementById('feedback-slider');
const feedbackVal = document.getElementById('feedback-val');

// Audio Context & Nodes
let audioCtx;
let micSource;
let fileBuffer;
let fileSource;
let activeSourceNode;

let analyser;
// Live Destinations
let destProcessed;
let destRaw;

let recorderProcessed;
let recorderRaw;
let chunksProcessed = [];
let chunksRaw = [];
let blobProcessed = null;
let blobRaw = null;

// Live Effect State (for updating parameters)
let liveOsc;
let liveDepthGain;
let liveDistortion;
let liveDelay;
let liveFeedback;

// State
let isInitialized = false;
let isRecording = false;
let isFileMode = false;
let isFilePlaying = false;

// --- INITIALIZATION ---
startBtn.addEventListener('click', async () => {
    if (isInitialized) return;

    try {
        statusText.textContent = "システム起動中...";
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micSource = audioCtx.createMediaStreamSource(stream);

        setupLiveGraph();

        // Initial setup only if in mic mode (default)
        if (!isFileMode) connectLiveMic();

        setupVisualizer();

        isInitialized = true;
        updateUIInitialized();

        statusText.textContent = "準備完了 // マイク入力中";
        pulseIndicator.classList.add('active');

    } catch (err) {
        console.error("Init Error:", err);
        statusText.textContent = "エラー: " + err.name;
        alert("マイクへのアクセスに失敗しました。");
    }
});

function updateUIInitialized() {
    startBtn.textContent = "システム稼働中";
    startBtn.classList.remove('primary');
    startBtn.classList.add('success');
    startBtn.disabled = true;
    recordGroup.classList.add('active');
    recordBtn.disabled = false;
}

// --- CORE EFFECT LOGIC (Reusable) ---
function applyEffects(context, sourceNode, isLive = false) {
    const modGain = context.createGain();
    modGain.gain.value = 0.5;

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = parseFloat(pitchSlider.value);
    osc.start();

    const depthGain = context.createGain();
    depthGain.gain.value = parseFloat(depthSlider.value);

    osc.connect(depthGain);
    depthGain.connect(modGain.gain);

    const distNode = context.createWaveShaper();
    distNode.curve = makeDistortionCurve(parseFloat(distortionSlider.value));
    distNode.oversample = '4x';

    const dNode = context.createDelay(1.0);
    dNode.delayTime.value = parseFloat(delaySlider.value);

    const fbGain = context.createGain();
    fbGain.gain.value = parseFloat(feedbackSlider.value);

    const mGain = context.createGain();
    mGain.gain.value = 1.0;

    // Wiring
    sourceNode.connect(modGain);
    modGain.connect(distNode);
    distNode.connect(dNode);
    distNode.connect(mGain);

    dNode.connect(fbGain);
    fbGain.connect(dNode);
    dNode.connect(mGain);

    if (isLive) {
        liveOsc = osc;
        liveDepthGain = depthGain;
        liveDistortion = distNode;
        liveDelay = dNode;
        liveFeedback = fbGain;
    }

    return mGain;
}

// --- LIVE GRAPH ---
function setupLiveGraph() {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    destProcessed = audioCtx.createMediaStreamDestination();
    destRaw = audioCtx.createMediaStreamDestination();
}

function connectLiveMic() {
    if (activeSourceNode) activeSourceNode.disconnect();
    activeSourceNode = micSource;

    // Mic is ALWAYS connected to destinations for recording
    activeSourceNode.connect(analyser);
    activeSourceNode.connect(destRaw);

    const effectOutput = applyEffects(audioCtx, activeSourceNode, true);
    effectOutput.connect(destProcessed);

    setupSliderListeners();
}

// Play File with specific mode ('raw' or 'robot')
function connectFilePlayback(sourceNode, mode) {
    if (activeSourceNode) activeSourceNode.disconnect();
    activeSourceNode = sourceNode;

    activeSourceNode.connect(analyser);

    // For FILE PLAYBACK, we connect to audioCtx.destination to HEAR it.
    // ALSO connect to destProcessed/destRaw if we want to support Real-time Recording of the file playback.

    // 1. Raw Path (for hearing)
    if (mode === 'raw') {
        const gain = audioCtx.createGain();
        gain.gain.value = 1.0;
        activeSourceNode.connect(gain);
        gain.connect(audioCtx.destination);

        // Also connect to raw recorder logic if needed, but 'auto-convert' is preferred for files.
        // We'll simplisticly connect to destRaw just in case user hits record.
        activeSourceNode.connect(destRaw);
    }

    // 2. Robot Path (for hearing)
    if (mode === 'robot') {
        const effectOutput = applyEffects(audioCtx, activeSourceNode, true);
        effectOutput.connect(audioCtx.destination); // Hear it
        effectOutput.connect(destProcessed); // Record it
        setupSliderListeners();
    }
}

function setupSliderListeners() {
    pitchSlider.oninput = (e) => {
        if (liveOsc) liveOsc.frequency.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.01);
        pitchVal.textContent = e.target.value + " Hz";
    };
    depthSlider.oninput = (e) => {
        if (liveDepthGain) liveDepthGain.gain.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.01);
        depthVal.textContent = Math.round(e.target.value * 100) + "%";
    };
    distortionSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        if (liveDistortion) liveDistortion.curve = makeDistortionCurve(val);
        distortionVal.textContent = val;
    };
    delaySlider.oninput = (e) => {
        if (liveDelay) liveDelay.delayTime.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.01);
        delayVal.textContent = e.target.value + " s";
    };
    feedbackSlider.oninput = (e) => {
        if (liveFeedback) liveFeedback.gain.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.01);
        feedbackVal.textContent = Math.round(e.target.value * 100) + "%";
    };
}

function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    if (amount === 0) {
        for (let i = 0; i < n_samples; ++i) curve[i] = (i / (n_samples / 2)) - 1;
        return curve;
    }
    for (let i = 0; i < n_samples; ++i) {
        let x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

function setupVisualizer() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#00f3ff';
        canvasCtx.beginPath();
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }
    draw();
}

// --- TABS & FILE HANDLING ---
tabMic.addEventListener('click', () => {
    if (isRecording) return;
    isFileMode = false;
    tabMic.classList.add('active');
    tabFile.classList.remove('active');
    fileInputContainer.classList.add('hidden');
    filePlaybackControls.classList.add('hidden');

    exportGroup.classList.add('disabled');
    exportGroup.classList.remove('active');
    saveBtn.classList.remove('active');

    stopFilePlayback();

    if (isInitialized && micSource) {
        connectLiveMic();
        statusText.textContent = "準備完了 // マイク入力中";
    }
});

tabFile.addEventListener('click', () => {
    if (isRecording) return;
    if (!isInitialized) {
        alert("先にシステムを起動してください。");
        return;
    }
    isFileMode = true;
    tabFile.classList.add('active');
    tabMic.classList.remove('active');
    fileInputContainer.classList.remove('hidden');
    filePlaybackControls.classList.remove('hidden');

    if (fileBuffer) {
        statusText.textContent = "準備完了 // プレビュー・自動変換可能";
        exportGroup.classList.remove('disabled');
        exportGroup.classList.add('active');
    } else {
        statusText.textContent = "ファイルを選択してください";
    }
});

audioUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    fileNameDisplay.textContent = file.name;

    statusText.textContent = "ファイルを読み込み中...";
    stopFilePlayback();

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const arrayBuffer = ev.target.result;
        try {
            fileBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            statusText.textContent = "読み込み完了 // プレビュー・自動変換可能";
            exportGroup.classList.remove('disabled');
            exportGroup.classList.add('active');
        } catch (err) {
            console.error(err);
            statusText.textContent = "デコードエラー";
            alert("音声ファイルの読み込みに失敗しました。");
        }
    };
    reader.readAsArrayBuffer(file);
});

function playFile(mode) {
    if (!fileBuffer) return;
    stopFilePlayback();

    fileSource = audioCtx.createBufferSource();
    fileSource.buffer = fileBuffer;

    connectFilePlayback(fileSource, mode);

    fileSource.onended = () => {
        isFilePlaying = false;
        updateFileButtons(false);
    };

    fileSource.start(0);
    isFilePlaying = true;
    updateFileButtons(true);
    statusText.textContent = (mode === 'raw') ? "原音再生中..." : "ロボ再生中...";
}

function stopFilePlayback() {
    if (fileSource && isFilePlaying) {
        try { fileSource.stop(); } catch (e) { }
    }
    isFilePlaying = false;
    updateFileButtons(false);
}

function updateFileButtons(isPlaying) {
    if (isPlaying) {
        filePlayRawBtn.disabled = true;
        filePlayRobotBtn.disabled = true;
        fileStopBtn.disabled = false;
        filePlayRawBtn.classList.add('disabled');
        filePlayRobotBtn.classList.add('disabled');
        fileStopBtn.classList.remove('disabled');
    } else {
        filePlayRawBtn.disabled = false;
        filePlayRobotBtn.disabled = false;
        fileStopBtn.disabled = true;
        filePlayRawBtn.classList.remove('disabled');
        filePlayRobotBtn.classList.remove('disabled');
        fileStopBtn.classList.add('disabled');
        statusText.textContent = isFileMode ? "準備完了 // プレビュー・自動変換可能" : "準備完了";
    }
}

filePlayRawBtn.addEventListener('click', () => playFile('raw'));
filePlayRobotBtn.addEventListener('click', () => playFile('robot'));
fileStopBtn.addEventListener('click', stopFilePlayback);


// --- RECORDING ---
recordBtn.addEventListener('click', () => {
    chunksProcessed = [];
    chunksRaw = [];

    recorderProcessed = new MediaRecorder(destProcessed.stream);
    recorderProcessed.ondataavailable = (e) => { if (e.data.size > 0) chunksProcessed.push(e.data); };

    recorderRaw = new MediaRecorder(destRaw.stream);
    recorderRaw.ondataavailable = (e) => { if (e.data.size > 0) chunksRaw.push(e.data); };

    recorderProcessed.onstop = () => {
        statusText.textContent = "録音完了 // データ処理中";
        blobProcessed = new Blob(chunksProcessed, { type: 'audio/webm' });

        const audioURL = URL.createObjectURL(blobProcessed);
        audioPreview.src = audioURL;

        exportGroup.classList.add('active');
        saveBtn.classList.remove('disabled');
        saveRawBtn.classList.remove('disabled');
    };

    recorderRaw.onstop = () => {
        blobRaw = new Blob(chunksRaw, { type: 'audio/webm' });
    };

    recorderProcessed.start();
    recorderRaw.start();
    isRecording = true;

    recordBtn.disabled = true;
    stopBtn.disabled = false;
    recordBtn.classList.add('disabled');
    stopBtn.classList.remove('disabled');

    statusText.textContent = "録音中...";
    statusText.classList.add('blink');
});

stopBtn.addEventListener('click', () => {
    if (!isRecording) return;
    recorderProcessed.stop();
    recorderRaw.stop();
    isRecording = false;

    recordBtn.disabled = false;
    stopBtn.disabled = true;
    recordBtn.classList.remove('disabled');
    stopBtn.classList.add('disabled');
    statusText.classList.remove('blink');
});


// --- EXPORT LOGIC ---
saveBtn.addEventListener('click', async () => {
    if (isFileMode && fileBuffer) {
        statusText.textContent = "自動変換中 (高速レンダリング)...";
        saveBtn.disabled = true;
        try {
            const offlineCtx = new OfflineAudioContext(1, fileBuffer.length, fileBuffer.sampleRate);
            const source = offlineCtx.createBufferSource();
            source.buffer = fileBuffer;
            const effectOutput = applyEffects(offlineCtx, source, false);
            effectOutput.connect(offlineCtx.destination);
            source.start(0);
            const renderedBuffer = await offlineCtx.startRendering();
            await encodeBufferToMp3(renderedBuffer, "robot_auto");
            statusText.textContent = "変換＆保存完了！";
        } catch (e) { console.error(e); statusText.textContent = "変換エラー"; }
        finally { saveBtn.disabled = false; }
    } else {
        if (!blobProcessed) return;
        statusText.textContent = "MP3変換中...";
        saveBtn.disabled = true;
        try {
            const arrayBuffer = await blobProcessed.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            await encodeBufferToMp3(audioBuffer, "robot_rec");
            statusText.textContent = "保存完了";
        } catch (e) { console.error(e); statusText.textContent = "エラー"; }
        finally { saveBtn.disabled = false; }
    }
});

saveRawBtn.addEventListener('click', async () => {
    if (isFileMode && fileBuffer) {
        await encodeBufferToMp3(fileBuffer, "original");
        return;
    }
    if (!blobRaw) return;
    statusText.textContent = "原音保存中...";
    try {
        const arrayBuffer = await blobRaw.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await encodeBufferToMp3(audioBuffer, "original_rec");
        statusText.textContent = "保存完了";
    } catch (e) { statusText.textContent = "エラー"; }
});

async function encodeBufferToMp3(audioBuffer, suffix) {
    const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 128);
    const samples = audioBuffer.getChannelData(0);
    const sampleBlock = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        sampleBlock[i] = s;
    }
    const mp3Data = [];
    const mp3Tmp = mp3Encoder.encodeBuffer(sampleBlock);
    if (mp3Tmp.length > 0) mp3Data.push(mp3Tmp);
    const mp3Tail = mp3Encoder.flush();
    if (mp3Tail.length > 0) mp3Data.push(mp3Tail);

    const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
    const url = URL.createObjectURL(mp3Blob);
    const link = document.createElement('a');
    link.href = url;
    let fname = filenameInput.value || "rovoice";
    fname += "_" + suffix + ".mp3";
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Show support modal after save trigger
    setTimeout(showSupportModal, 1000);
}

// --- MODAL LOGIC ---
function showSupportModal() {
    supportModal.classList.remove('hidden');
}

closeModalBtn.addEventListener('click', () => {
    supportModal.classList.add('hidden');
});

// Close modal on outside click (optional but good UX)
supportModal.addEventListener('click', (e) => {
    if (e.target === supportModal) {
        supportModal.classList.add('hidden');
    }
});

window.addEventListener('resize', () => {
    canvas.width = canvas.parentElement.clientWidth;
});
canvas.width = canvas.parentElement.clientWidth;
canvas.height = 150;
