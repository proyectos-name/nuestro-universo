import { APP_CONFIG } from './config.js';
import {
  LOCAL_ASSETS,
  bindAudioWithFallback,
  bindImageWithFallback,
  fetchLyricsFile
} from './assets.js';
import { findActiveLyricIndex, formatTime, parseLrc } from './lrcParser.js';

/**
 * Controlador del reproductor musical y la letra sincronizada (.lrc).
 */
export class MusicPlayerController {
  /**
   * @param {{ onSongEnded?: () => void }} options
   */
  constructor(options = {}) {
    this.onSongEnded = options.onSongEnded || (() => {});

    // Elementos del DOM
    this.audio = document.getElementById('audio-element');
    this.coverImg = document.getElementById('song-cover');
    this.coverGlow = document.getElementById('cover-frame');
    this.titleEl = document.getElementById('song-title');
    this.artistEl = document.getElementById('song-artist');
    this.playBtn = document.getElementById('play-pause-btn');
    this.iconPlay = document.getElementById('icon-play');
    this.iconPause = document.getElementById('icon-pause');
    this.progressBar = document.getElementById('progress-bar');
    this.currentTimeEl = document.getElementById('current-time');
    this.totalDurationEl = document.getElementById('total-duration');
    this.audioErrorEl = document.getElementById('audio-error');
    this.lyricsViewport = document.getElementById('lyrics-viewport');
    this.lyricsList = document.getElementById('lyrics-list');
    this.lyricsStatusEl = document.getElementById('lyrics-status');

    // Estado interno
    this.lyricLines = [];
    this.activeIndex = -1;
    this.isSeeking = false;
    this.rafId = null;
    this.hasAudioError = false;
    this.userScrollingUntil = 0;

    this.init();
  }

  init() {
    this.titleEl.textContent = APP_CONFIG.music.defaultTitle;
    this.artistEl.textContent = APP_CONFIG.music.defaultArtist;

    bindImageWithFallback(this.coverImg, LOCAL_ASSETS.songCover);
    bindAudioWithFallback(this.audio, LOCAL_ASSETS.songAudio, (msg) => {
      this.showAudioError(msg);
    });

    this.bindEvents();
    this.loadLyrics();
    this.updateProgressVisual(0);
  }

  bindEvents() {
    this.playBtn.addEventListener('click', () => this.togglePlay());

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
      this.updatePlayState(true);
      this.startSyncLoop();
    });

    this.audio.addEventListener('pause', () => {
      this.updatePlayState(false);
      this.stopSyncLoop();
      this.syncLyrics(true);
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) {
        this.syncProgress();
      }
      this.syncLyrics();
    });

    this.audio.addEventListener('seeked', () => {
      this.userScrollingUntil = 0;
      this.syncProgress();
      this.syncLyrics(true);
    });

    this.audio.addEventListener('ended', () => {
      this.updatePlayState(false);
      this.stopSyncLoop();
      this.onSongEnded();
    });

    // Manejo de barra de progreso (compatible con mouse y táctil)
    this.progressBar.addEventListener('input', () => {
      this.isSeeking = true;
      const pct = parseFloat(this.progressBar.value) || 0;
      const duration = this.audio.duration || 0;
      const previewTime = (pct / 100) * duration;
      this.currentTimeEl.textContent = formatTime(previewTime);
      this.updateProgressVisual(pct);
    });

    this.progressBar.addEventListener('change', () => {
      const pct = parseFloat(this.progressBar.value) || 0;
      const duration = this.audio.duration || 0;
      if (duration > 0) {
        this.audio.currentTime = (pct / 100) * duration;
      }
      this.isSeeking = false;
      this.userScrollingUntil = 0;
      this.syncLyrics(true);
    });

    // Pausar autoscroll brevemente si el usuario explora la letra manualmente
    const pauseAutoScroll = () => {
      this.userScrollingUntil = Date.now() + 2800;
    };
    this.lyricsViewport.addEventListener('wheel', pauseAutoScroll, { passive: true });
    this.lyricsViewport.addEventListener('touchstart', pauseAutoScroll, { passive: true });
  }

  async loadLyrics() {
    this.showLyricsStatus(
      'Cargando letra sincronizada...',
      'Sincronizando versos con las estrellas',
      'loading'
    );

    const result = await fetchLyricsFile(LOCAL_ASSETS.lyricsLrc);

    if (!result.ok) {
      this.showLyricsStatus(
        'No se pudo leer la letra sincronizada',
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

    if (!parsed.lines.length) {
      this.showLyricsStatus(
        'Letra aún sin versos sincronizados',
        'El archivo letra/letra.lrc está vacío o no contiene marcas de tiempo [mm:ss.xx]. Puedes escuchar la canción completa y continuar cuando desees.',
        'empty'
      );
      return;
    }

    this.lyricLines = parsed.lines;
    this.renderLyrics();
  }

  renderLyrics() {
    this.lyricsStatusEl.hidden = true;
    this.lyricsList.hidden = false;
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
        if (!Number.isFinite(this.audio.duration)) return;
        this.audio.currentTime = line.time;
        this.userScrollingUntil = 0;
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

  syncLyrics(forceScroll = false) {
    if (!this.lyricLines.length) return;

    const newIndex = findActiveLyricIndex(this.lyricLines, this.audio.currentTime);
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
      // El navegador puede requerir interacción directa si no vino de un clic
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
    this.audio.currentTime = 0;
    this.userScrollingUntil = 0;
    this.syncProgress();
    this.syncLyrics(true);
    this.play();
  }

  reset() {
    this.pause();
    this.audio.currentTime = 0;
    this.userScrollingUntil = 0;
    this.syncProgress();
    this.syncLyrics(true);
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

  showAudioError(message) {
    this.hasAudioError = true;
    this.audioErrorEl.textContent = message;
    this.audioErrorEl.hidden = false;
    this.playBtn.disabled = true;
  }

  hideAudioError() {
    this.audioErrorEl.hidden = true;
    this.playBtn.disabled = false;
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
