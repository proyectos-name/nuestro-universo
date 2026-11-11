import { APP_CONFIG } from './config.js';
import {
  LOCAL_ASSETS,
  bindAudioWithFallback,
  bindImageWithFallback,
  fetchLyricsFile
} from './assets.js';
import { findActiveLyricIndex, formatTime, parseLrc } from './lrcParser.js';

const OFFSET_STORAGE_KEY = 'nuestro-universo-lrc-offset-ms';
const SKIP_SECONDS = 10;
const OFFSET_STEP_MS = 100;

/**
 * Controlador del reproductor musical y la letra sincronizada (.lrc).
 * Utiliza HTMLAudioElement.currentTime como fuente única del tiempo real.
 */
export class MusicPlayerController {
  /**
   * @param {{ onSongEnded?: () => void, onPlaybackActivity?: () => void }} options
   */
  constructor(options = {}) {
    this.onSongEnded = options.onSongEnded || (() => {});
    this.onPlaybackActivity = options.onPlaybackActivity || (() => {});

    // Elementos del reproductor
    this.audio = document.getElementById('audio-element');
    this.coverImg = document.getElementById('song-cover');
    this.coverGlow = document.getElementById('cover-frame');
    this.titleEl = document.getElementById('song-title');
    this.artistEl = document.getElementById('song-artist');
    this.startPlaybackBtn = document.getElementById('start-playback-btn');
    this.playBtn = document.getElementById('play-pause-btn');
    this.rewindBtn = document.getElementById('rewind-btn');
    this.forwardBtn = document.getElementById('forward-btn');
    this.restartSongBtn = document.getElementById('restart-song-btn');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.progressBar = document.getElementById('progress-bar');
    this.currentTimeEl = document.getElementById('current-time');
    this.totalDurationEl = document.getElementById('total-duration');
    this.endedBannerEl = document.getElementById('ended-transition-banner');
    this.audioErrorEl = document.getElementById('audio-error');

    // Elementos de la letra y ajuste de desfase
    this.lyricsPillEl = document.getElementById('lyrics-pill');
    this.lyricsHintEl = document.getElementById('lyrics-hint');
    this.offsetControlsEl = document.getElementById('sync-offset-controls');
    this.offsetMinusBtn = document.getElementById('offset-minus-btn');
    this.offsetPlusBtn = document.getElementById('offset-plus-btn');
    this.offsetValueEl = document.getElementById('sync-offset-value');
    this.offsetResetBtn = document.getElementById('offset-reset-btn');
    this.lyricsViewport = document.getElementById('lyrics-viewport');
    this.lyricsList = document.getElementById('lyrics-list');
    this.lyricsStatusEl = document.getElementById('lyrics-status');

    // Estado interno
    this.isSyncedMode = false;
    this.lyricLines = [];
    this.activeIndex = -1;
    this.isSeeking = false;
    this.hasStartedOnce = false;
    this.rafId = null;
    this.hasAudioError = false;
    this.userScrollingUntil = 0;
    this.syncOffsetMs = this.loadSavedOffset();

    this.init();
  }

  loadSavedOffset() {
    try {
      const raw = localStorage.getItem(OFFSET_STORAGE_KEY);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) return parsed;
      }
    } catch {
      // Ignorar si localStorage no está disponible
    }
    return APP_CONFIG.music.defaultSyncOffsetMs || 0;
  }

  saveOffset() {
    try {
      localStorage.setItem(OFFSET_STORAGE_KEY, String(this.syncOffsetMs));
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  init() {
    this.titleEl.textContent = APP_CONFIG.music.defaultTitle;
    this.artistEl.textContent = APP_CONFIG.music.defaultArtist;

    bindImageWithFallback(this.coverImg, LOCAL_ASSETS.songCover);
    bindAudioWithFallback(this.audio, LOCAL_ASSETS.songAudio, (msg) => {
      this.showAudioError(msg);
    });

    this.bindEvents();
    this.updateOffsetUI();
    this.loadLyrics();
    this.updateProgressVisual(0);
    this.updateStartButtonVisibility();
  }

  bindEvents() {
    this.startPlaybackBtn.addEventListener('click', () => {
      this.onPlaybackActivity();
      this.play();
    });

    this.playBtn.addEventListener('click', () => {
      this.onPlaybackActivity();
      this.togglePlay();
    });

    this.rewindBtn.addEventListener('click', () => {
      this.seekBy(-SKIP_SECONDS);
    });

    this.forwardBtn.addEventListener('click', () => {
      this.seekBy(SKIP_SECONDS);
    });

    this.restartSongBtn.addEventListener('click', () => {
      this.onPlaybackActivity();
      this.restartAndPlay();
    });

    this.offsetMinusBtn.addEventListener('click', () => {
      this.adjustSyncOffset(-OFFSET_STEP_MS);
    });

    this.offsetPlusBtn.addEventListener('click', () => {
      this.adjustSyncOffset(OFFSET_STEP_MS);
    });

    this.offsetResetBtn.addEventListener('click', () => {
      this.syncOffsetMs = 0;
      this.saveOffset();
      this.updateOffsetUI();
      this.syncLyrics(true);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.hasAudioError = false;
      this.hideAudioError();
      this.totalDurationEl.textContent = formatTime(this.audio.duration);
      this.syncProgress();
    });

    this.audio.addEventListener('canplay', () => {
      this.hasAudioError = false;
      this.hideAudioError();
    });

    this.audio.addEventListener('play', () => {
      this.hasStartedOnce = true;
      this.hideEndedBanner();
      this.updateStartButtonVisibility();
      this.updatePlayState(true);
      this.startSyncLoop();
    });

    this.audio.addEventListener('pause', () => {
      this.updatePlayState(false);
      this.stopSyncLoop();
      this.syncLyrics(false);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) {
        this.syncProgress();
      }
      this.syncLyrics();
    });

    this.audio.addEventListener('seeked', () => {
      this.userScrollingUntil = 0;
      this.hideEndedBanner();
      this.syncProgress();
      this.syncLyrics(true);
    });

    this.audio.addEventListener('ended', () => {
      this.updatePlayState(false);
      this.stopSyncLoop();
      this.syncProgress();
      this.showEndedBanner();
      this.onSongEnded();
    });

    // Barra de progreso interactiva (mouse y táctil)
    this.progressBar.addEventListener('input', () => {
      this.isSeeking = true;
      const pct = parseFloat(this.progressBar.value) || 0;
      const duration = this.audio.duration || 0;
      const previewTime = (pct / 100) * duration;
      this.currentTimeEl.textContent = formatTime(previewTime);
      this.updateProgressVisual(pct);
    });

    this.progressBar.addEventListener('change', () => {
      this.onPlaybackActivity();
      const pct = parseFloat(this.progressBar.value) || 0;
      const duration = this.audio.duration || 0;
      if (duration > 0) {
        this.audio.currentTime = (pct / 100) * duration;
        this.hasStartedOnce = true;
        this.updateStartButtonVisibility();
      }
      this.isSeeking = false;
      this.userScrollingUntil = 0;
      this.syncLyrics(true);
    });

    // Pausar autoscroll brevemente si el usuario explora manualmente
    const pauseAutoScroll = () => {
      this.userScrollingUntil = Date.now() + 2800;
    };
    this.lyricsViewport.addEventListener('wheel', pauseAutoScroll, { passive: true });
    this.lyricsViewport.addEventListener('touchstart', pauseAutoScroll, { passive: true });
  }

  seekBy(deltaSeconds) {
    if (this.hasAudioError || !Number.isFinite(this.audio.duration)) return;
    this.onPlaybackActivity();
    const nextTime = Math.min(
      Math.max(0, this.audio.currentTime + deltaSeconds),
      this.audio.duration
    );
    this.audio.currentTime = nextTime;
    this.hasStartedOnce = true;
    this.userScrollingUntil = 0;
    this.updateStartButtonVisibility();
    this.syncProgress();
    this.syncLyrics(true);
  }

  adjustSyncOffset(deltaMs) {
    this.syncOffsetMs = Math.max(-5000, Math.min(5000, this.syncOffsetMs + deltaMs));
    this.saveOffset();
    this.updateOffsetUI();
    this.syncLyrics(true);
  }

  updateOffsetUI() {
    const sign = this.syncOffsetMs > 0 ? '+' : '';
    this.offsetValueEl.textContent = `${sign}${this.syncOffsetMs} ms`;
    this.offsetResetBtn.hidden = this.syncOffsetMs === 0;
  }

  async loadLyrics() {
    this.showLyricsStatus(
      'Cargando letra...',
      'Preparando los versos de nuestra canción',
      'loading'
    );

    const result = await fetchLyricsFile(LOCAL_ASSETS.lyricsLrc);

    if (!result.ok) {
      this.isSyncedMode = false;
      this.offsetControlsEl.hidden = true;
      this.showLyricsStatus(
        'No se pudo leer el archivo de letra',
        result.reason,
        'error'
      );
      return;
    }

    const parsed = parseLrc(result.content);

    if (parsed.meta.title) {
      this.titleEl.textContent = parsed.meta.title;
    }
    if (parsed.meta.artist) {
      this.artistEl.textContent = parsed.meta.artist;
    }

    if (parsed.hasTimestamps && parsed.lines.length > 0) {
      this.isSyncedMode = true;
      this.lyricLines = parsed.lines;
      this.lyricsPillEl.textContent = 'LETRA EN VIVO';
      this.lyricsHintEl.textContent = 'Toca un verso para saltar';
      this.offsetControlsEl.hidden = false;
      this.renderSyncedLyrics();
      return;
    }

    if (parsed.plainLines.length > 0) {
      this.isSyncedMode = false;
      this.lyricLines = [];
      this.lyricsPillEl.textContent = 'LETRA COMPLETA';
      this.lyricsHintEl.textContent = 'Modo lectura (sin tiempos LRC)';
      this.offsetControlsEl.hidden = true;
      this.renderPlainLyrics(parsed.plainLines);
      return;
    }

    this.isSyncedMode = false;
    this.offsetControlsEl.hidden = true;
    this.showLyricsStatus(
      'Letra aún vacía',
      'El archivo de letra todavía no tiene versos cargados.',
      'empty'
    );
  }

  renderSyncedLyrics() {
    this.lyricsStatusEl.hidden = true;
    this.lyricsList.hidden = false;
    this.lyricsList.classList.remove('lyrics-list--plain');
    this.lyricsList.innerHTML = '';

    const fragment = document.createDocumentFragment();

    this.lyricLines.forEach((line, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'lyric-line';
      item.dataset.index = String(idx);
      item.textContent = line.text;
      item.setAttribute('aria-label', `Ir a ${formatTime(line.time)}: ${line.text}`);

      item.addEventListener('click', () => {
        if (this.hasAudioError || !Number.isFinite(this.audio.duration)) return;
        this.onPlaybackActivity();
        this.audio.currentTime = line.time;
        this.hasStartedOnce = true;
        this.userScrollingUntil = 0;
        this.updateStartButtonVisibility();
        this.syncLyrics(true);
        if (this.audio.paused) {
          this.play();
        }
      });

      fragment.appendChild(item);
    });

    this.lyricsList.appendChild(fragment);
    this.activeIndex = -1;
    this.syncLyrics(true);
  }

  renderPlainLyrics(plainLines) {
    this.lyricsStatusEl.hidden = true;
    this.lyricsList.hidden = false;
    this.lyricsList.classList.add('lyrics-list--plain');
    this.lyricsList.innerHTML = '';

    const notice = document.createElement('p');
    notice.className = 'lyrics-plain-note';
    notice.textContent =
      'Letra original en modo lectura (aún sin marcas de tiempo LRC).';
    this.lyricsList.appendChild(notice);

    const fragment = document.createDocumentFragment();
    plainLines.forEach((text) => {
      const p = document.createElement('p');
      p.className = 'lyric-line-plain';
      p.textContent = text;
      fragment.appendChild(p);
    });

    this.lyricsList.appendChild(fragment);
    this.lyricsViewport.scrollTo({ top: 0, behavior: 'auto' });
  }

  syncLyrics(forceScroll = false) {
    if (!this.isSyncedMode || !this.lyricLines.length) return;

    const newIndex = findActiveLyricIndex(
      this.lyricLines,
      this.audio.currentTime,
      this.syncOffsetMs
    );
    if (newIndex === this.activeIndex && !forceScroll) return;

    const children = this.lyricsList.children;

    if (this.activeIndex >= 0 && children[this.activeIndex]) {
      children[this.activeIndex].classList.remove('is-active');
    }

    for (let i = 0; i < children.length; i += 1) {
      children[i].classList.toggle('is-past', i < newIndex);
    }

    this.activeIndex = newIndex;

    if (newIndex >= 0 && children[newIndex]) {
      const activeEl = children[newIndex];
      activeEl.classList.add('is-active');

      const canAutoScroll = forceScroll || Date.now() > this.userScrollingUntil;
      if (canAutoScroll) {
        const viewportHeight = this.lyricsViewport.clientHeight;
        const targetTop =
          activeEl.offsetTop - viewportHeight / 2 + activeEl.clientHeight / 2;

        this.lyricsViewport.scrollTo({
          top: Math.max(0, targetTop),
          behavior: forceScroll ? 'auto' : 'smooth'
        });
      }
    } else if (forceScroll) {
      this.lyricsViewport.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  syncProgress() {
    const duration = this.audio.duration;
    const current = this.audio.currentTime || 0;

    this.currentTimeEl.textContent = formatTime(current);

    if (Number.isFinite(duration) && duration > 0) {
      const pct = Math.min(100, Math.max(0, (current / duration) * 100));
      this.progressBar.value = pct.toFixed(2);
      this.updateProgressVisual(pct);
    } else {
      this.progressBar.value = '0';
      this.updateProgressVisual(0);
    }
  }

  updateProgressVisual(percent) {
    this.progressBar.style.setProperty('--progress', `${percent}%`);
  }

  startSyncLoop() {
    this.stopSyncLoop();
    const tick = () => {
      if (!this.audio.paused && !this.audio.ended) {
        if (!this.isSeeking) {
          this.syncProgress();
        }
        this.syncLyrics();
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopSyncLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  async play() {
    if (this.hasAudioError) return;
    try {
      await this.audio.play();
    } catch {
      this.updatePlayState(false);
    }
  }

  pause() {
    this.audio.pause();
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  restartAndPlay() {
    this.hideEndedBanner();
    this.audio.currentTime = 0;
    this.userScrollingUntil = 0;
    this.syncProgress();
    this.syncLyrics(true);
    this.play();
  }

  reset() {
    this.pause();
    this.hideEndedBanner();
    this.audio.currentTime = 0;
    this.hasStartedOnce = false;
    this.userScrollingUntil = 0;
    this.updateStartButtonVisibility();
    this.syncProgress();
    this.syncLyrics(true);
    if (!this.isSyncedMode) {
      this.lyricsViewport.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  updateStartButtonVisibility() {
    const shouldShowStart =
      !this.hasAudioError &&
      !this.hasStartedOnce &&
      this.audio.paused &&
      (this.audio.currentTime || 0) < 0.25;
    this.startPlaybackBtn.hidden = !shouldShowStart;
  }

  updatePlayState(isPlaying) {
    this.iconPlay.hidden = isPlaying;
    this.iconPause.hidden = !isPlaying;
    this.playBtn.setAttribute(
      'aria-label',
      isPlaying ? 'Pausar canción' : 'Reproducir canción'
    );
    this.coverGlow.classList.toggle('is-playing', isPlaying);
  }

  showEndedBanner() {
    this.endedBannerEl.hidden = false;
  }

  hideEndedBanner() {
    this.endedBannerEl.hidden = true;
  }

  showAudioError(message) {
    this.hasAudioError = true;
    this.audioErrorEl.textContent = message;
    this.audioErrorEl.hidden = false;
    this.startPlaybackBtn.hidden = true;
    this.playBtn.disabled = true;
    this.rewindBtn.disabled = true;
    this.forwardBtn.disabled = true;
    this.restartSongBtn.disabled = true;
  }

  hideAudioError() {
    this.audioErrorEl.hidden = true;
    this.playBtn.disabled = false;
    this.rewindBtn.disabled = false;
    this.forwardBtn.disabled = false;
    this.restartSongBtn.disabled = false;
    this.updateStartButtonVisibility();
  }

  showLyricsStatus(title, detail, type) {
    this.lyricsList.hidden = true;
    this.lyricsStatusEl.hidden = false;
    this.lyricsStatusEl.dataset.state = type;
    this.lyricsStatusEl.innerHTML = `
      <p class="lyrics-status-title">${title}</p>
      <p class="lyrics-status-detail">${detail}</p>
    `;
  }
}
