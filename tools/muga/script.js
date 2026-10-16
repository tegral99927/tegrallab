/**
 * Muga (無我) — Audio & Interaction Engine
 * Philosophy: "Nothing to achieve. Simply surrender to sound."
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Application State
  // ---------------------------------------------------------------------------
  const State = {
    IDLE: 'idle',           // Initial waiting state
    LOADING: 'loading',     // Fetching playlist or audio resource
    PLAYING: 'playing',     // Actively playing audio
    PAUSED: 'paused',       // Paused by user
    FADING_OUT: 'fading_out', // Gracefully stopping via fade-out
    ENDED: 'ended'          // Naturally completed, stillness remains
  };

  let currentState = State.IDLE;
  let playlist = [];
  let userVolume = 0.8;
  let isMuted = false;
  let currentFadeFactor = 0; // 0.0 to 1.0
  let fadeAnimFrameId = null;
  let naturalFadeInitiated = false;

  // Web Audio & HTML5 Audio references
  let audioCtx = null;
  let gainNode = null;
  let sourceNode = null;
  const audio = new Audio();
  audio.preload = 'auto';

  // ---------------------------------------------------------------------------
  // DOM Elements
  // ---------------------------------------------------------------------------
  const scenes = {
    idle: document.getElementById('scene-idle'),
    playing: document.getElementById('scene-playing'),
    ended: document.getElementById('scene-ended')
  };

  const playBtn = document.getElementById('play-btn');
  const replayBtn = document.getElementById('replay-btn');
  const pauseResumeBtn = document.getElementById('pause-resume-btn');
  const stopBtn = document.getElementById('stop-btn');
  const volumeSlider = document.getElementById('volume-slider');
  const muteBtn = document.getElementById('mute-btn');
  const toast = document.getElementById('message-toast');
  const liveStatus = document.getElementById('live-status');
  const ensoWrapper = document.getElementById('enso-wrapper');

  // SVG Icons for buttons
  const pauseIconSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1"></rect>
      <rect x="14" y="4" width="4" height="16" rx="1"></rect>
    </svg>`;
  const playIconSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="6,4 20,12 6,20"></polygon>
    </svg>`;
  const volumeHighSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
    </svg>`;
  const volumeMutedSvg = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    </svg>`;

  // ---------------------------------------------------------------------------
  // Accessibility Live Announcer & Toast Notification
  // ---------------------------------------------------------------------------
  function announce(message) {
    if (liveStatus) {
      liveStatus.textContent = message;
    }
  }

  let toastTimeout = null;
  function showToast(message, durationMs = 4000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, durationMs);
  }

  // ---------------------------------------------------------------------------
  // UI Scene Management
  // ---------------------------------------------------------------------------
  function switchScene(activeKey) {
    Object.keys(scenes).forEach(key => {
      const el = scenes[key];
      if (!el) return;
      if (key === activeKey) {
        el.classList.add('active');
        el.removeAttribute('aria-hidden');
      } else {
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
      }
    });

    if (activeKey === 'playing') {
      document.body.classList.add('playing');
    } else {
      document.body.classList.remove('playing');
    }
  }

  // ---------------------------------------------------------------------------
  // Web Audio Context & Gain Initializer
  // ---------------------------------------------------------------------------
  function initAudioContext() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        sourceNode = audioCtx.createMediaElementSource(audio);
        gainNode = audioCtx.createGain();
        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
      }
    } catch (e) {
      console.warn('[Muga] Web Audio API init fallback to HTML5 Audio volume:', e);
      audioCtx = null;
      gainNode = null;
    }
  }

  function applyEffectiveVolume() {
    const targetGain = isMuted ? 0 : userVolume * currentFadeFactor;
    if (gainNode && audioCtx) {
      gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, targetGain)), audioCtx.currentTime);
    } else {
      audio.volume = Math.max(0, Math.min(1, targetGain));
    }
  }

  // ---------------------------------------------------------------------------
  // Smooth Fade Engine
  // ---------------------------------------------------------------------------
  function cancelCurrentFade() {
    if (fadeAnimFrameId !== null) {
      cancelAnimationFrame(fadeAnimFrameId);
      fadeAnimFrameId = null;
    }
  }

  /**
   * Smoothly interpolate currentFadeFactor to targetFactor over durationMs
   */
  function fadeTo(targetFactor, durationMs, onComplete) {
    cancelCurrentFade();

    const startFactor = currentFadeFactor;
    const diff = targetFactor - startFactor;
    if (Math.abs(diff) < 0.001 || durationMs <= 0) {
      currentFadeFactor = targetFactor;
      applyEffectiveVolume();
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      // Smooth sinusoidal ease in/out
      const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      currentFadeFactor = startFactor + diff * ease;
      applyEffectiveVolume();

      if (progress < 1.0) {
        fadeAnimFrameId = requestAnimationFrame(step);
      } else {
        currentFadeFactor = targetFactor;
        applyEffectiveVolume();
        fadeAnimFrameId = null;
        if (onComplete) onComplete();
      }
    }

    fadeAnimFrameId = requestAnimationFrame(step);
  }

  // ---------------------------------------------------------------------------
  // Playlist Management
  // ---------------------------------------------------------------------------
  async function loadPlaylist() {
    if (playlist.length > 0) return playlist;

    try {
      const response = await fetch('music/playlist.json', { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Playlist is empty or invalid format');
      }
      playlist = data.map(item => (typeof item === 'string' ? item.trim() : ''))
                     .filter(item => item.length > 0);
      if (playlist.length === 0) {
        throw new Error('No valid tracks found in playlist');
      }
      return playlist;
    } catch (err) {
      console.error('[Muga] Failed to load playlist.json:', err);
      showToast('まだ音楽がありません。');
      announce('まだ音楽がありません。');
      throw err;
    }
  }

  function pickRandomTrack(list) {
    if (!list || list.length === 0) return null;
    const index = Math.floor(Math.random() * list.length);
    return list[index];
  }

  // ---------------------------------------------------------------------------
  // Playback Control
  // ---------------------------------------------------------------------------
  async function startPlayback() {
    if (currentState === State.PLAYING || currentState === State.LOADING) return;

    currentState = State.LOADING;
    naturalFadeInitiated = false;
    cancelCurrentFade();

    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (e) {
        console.warn('[Muga] Could not resume AudioContext:', e);
      }
    }

    let tracks;
    try {
      tracks = await loadPlaylist();
    } catch (e) {
      currentState = State.IDLE;
      switchScene('idle');
      return;
    }

    const selectedTrack = pickRandomTrack(tracks);
    if (!selectedTrack) {
      showToast('まだ音楽がありません。');
      announce('まだ音楽がありません。');
      currentState = State.IDLE;
      switchScene('idle');
      return;
    }

    // Set audio source
    const trackUrl = `music/${encodeURIComponent(selectedTrack)}`;
    audio.src = trackUrl;
    currentFadeFactor = 0;
    applyEffectiveVolume();

    try {
      await audio.play();
      currentState = State.PLAYING;
      switchScene('playing');
      updatePauseResumeBtn(true);
      announce('音楽が始まりました。目を閉じて、ただ音に身を委ねてください。');

      // Fade-in over 3 seconds
      fadeTo(1.0, 3000);
    } catch (err) {
      console.error('[Muga] Playback failed:', err);
      currentState = State.IDLE;
      switchScene('idle');
      showToast('音楽を再生できませんでした。');
      announce('音楽を再生できませんでした。');
    }
  }

  function pausePlayback() {
    if (currentState !== State.PLAYING) return;
    // Micro fade-out before pausing (250ms) to avoid click/pop
    fadeTo(0, 250, () => {
      audio.pause();
      currentState = State.PAUSED;
      updatePauseResumeBtn(false);
      announce('一時停止しました。');
    });
  }

  async function resumePlayback() {
    if (currentState !== State.PAUSED) return;

    if (audioCtx && audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch (e) {
        console.warn('[Muga] Could not resume AudioContext:', e);
      }
    }

    try {
      await audio.play();
      currentState = State.PLAYING;
      updatePauseResumeBtn(true);
      announce('再開しました。');
      // Micro fade-in back to full volume (300ms)
      fadeTo(1.0, 300);
    } catch (err) {
      console.error('[Muga] Resume failed:', err);
      showToast('音楽を再生できませんでした。');
    }
  }

  function togglePauseResume() {
    if (currentState === State.PLAYING) {
      pausePlayback();
    } else if (currentState === State.PAUSED) {
      resumePlayback();
    }
  }

  function updatePauseResumeBtn(isPlaying) {
    if (!pauseResumeBtn) return;
    if (isPlaying) {
      pauseResumeBtn.innerHTML = pauseIconSvg;
      pauseResumeBtn.setAttribute('aria-label', '音楽を一時停止');
      pauseResumeBtn.setAttribute('title', '一時停止');
    } else {
      pauseResumeBtn.innerHTML = playIconSvg;
      pauseResumeBtn.setAttribute('aria-label', '音楽を再開');
      pauseResumeBtn.setAttribute('title', '再開');
    }
  }

  function stopPlayback(toEndedScene = false) {
    if (currentState === State.IDLE || currentState === State.FADING_OUT) return;

    currentState = State.FADING_OUT;
    announce('音をフェードアウトして停止します。');

    // 3-second gentle stop fade-out
    fadeTo(0, 3000, () => {
      audio.pause();
      audio.currentTime = 0;
      naturalFadeInitiated = false;

      if (toEndedScene) {
        currentState = State.ENDED;
        switchScene('ended');
        announce('音が終わりました。この静けさも、そのままに。');
      } else {
        currentState = State.IDLE;
        switchScene('idle');
        announce('停止しました。');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Natural Track Ending Handlers
  // ---------------------------------------------------------------------------
  audio.addEventListener('timeupdate', () => {
    // If track is near completion (last 5 seconds), trigger gentle natural fade-out
    if (currentState === State.PLAYING && !naturalFadeInitiated && audio.duration && !isNaN(audio.duration)) {
      const remaining = audio.duration - audio.currentTime;
      if (remaining > 0 && remaining <= 5.0) {
        naturalFadeInitiated = true;
        const fadeDurationMs = Math.max(1000, Math.floor(remaining * 1000));
        fadeTo(0, fadeDurationMs);
      }
    }
  });

  audio.addEventListener('ended', () => {
    // Audio completed naturally -> Enter Ended scene into pure stillness
    cancelCurrentFade();
    currentFadeFactor = 0;
    applyEffectiveVolume();
    audio.pause();
    audio.currentTime = 0;
    naturalFadeInitiated = false;

    currentState = State.ENDED;
    switchScene('ended');
    announce('音が終わりました。この静けさも、そのままに。');
  });

  audio.addEventListener('error', (e) => {
    console.error('[Muga] Audio element error:', e, audio.error);
    cancelCurrentFade();
    currentState = State.IDLE;
    switchScene('idle');
    showToast('音楽を再生できませんでした。');
    announce('音楽を再生できませんでした。');
  });

  // ---------------------------------------------------------------------------
  // Volume Controls
  // ---------------------------------------------------------------------------
  function updateVolumeUI() {
    if (volumeSlider) {
      volumeSlider.value = isMuted ? 0 : Math.round(userVolume * 100);
      volumeSlider.setAttribute('aria-valuenow', volumeSlider.value);
    }
    if (muteBtn) {
      muteBtn.innerHTML = (isMuted || userVolume === 0) ? volumeMutedSvg : volumeHighSvg;
      muteBtn.setAttribute('aria-label', isMuted ? 'ミュート解除' : '音声をミュート');
      muteBtn.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    }
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      userVolume = val;
      if (isMuted && val > 0) {
        isMuted = false;
      }
      applyEffectiveVolume();
      updateVolumeUI();
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      applyEffectiveVolume();
      updateVolumeUI();
    });
  }

  // ---------------------------------------------------------------------------
  // Event Listeners for Buttons
  // ---------------------------------------------------------------------------
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      startPlayback();
    });
  }

  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      startPlayback();
    });
  }

  if (pauseResumeBtn) {
    pauseResumeBtn.addEventListener('click', () => {
      togglePauseResume();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopPlayback(false);
    });
  }

  // Keyboard Accessibility
  window.addEventListener('keydown', (e) => {
    // Ignore key commands if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (currentState === State.IDLE || currentState === State.ENDED) {
        startPlayback();
      } else if (currentState === State.PLAYING || currentState === State.PAUSED) {
        togglePauseResume();
      }
    } else if (e.code === 'Escape') {
      if (currentState === State.PLAYING || currentState === State.PAUSED) {
        e.preventDefault();
        stopPlayback(false);
      }
    }
  });

  // Initial setup
  updateVolumeUI();
  switchScene('idle');
  console.log('[Muga] Application initialized. Standing in stillness.');
})();
