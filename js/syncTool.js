import { APP_CONFIG } from './config.js';
import {
  LOCAL_ASSETS,
  bindAudioWithFallback,
  fetchLyricsFile
} from './assets.js';
import {
  findActiveLyricIndex,
  formatLrcTimestamp,
  formatTime,
  parseLrc,
  parseTimestampInput,
  serializeLrc
} from './lrcParser.js';

/**
 * Herramienta de desarrollo para sincronizar manualmente letra/letra.lrc con musica/cancion.mp3.
 */
class ManualLrcSyncTool {
  constructor() {
    this.audio = document.getElementById('tool-audio');
    this.playBtn = document.getElementById('tool-play-btn');
    this.rewindBtn = document.getElementById('tool-rewind-btn');
    this.forwardBtn = document.getElementById('tool-forward-btn');
    this.rateSelect = document.getElementById('tool-rate-select');
    this.progressEl = document.getElementById('tool-progress');
    this.currentTimeEl = document.getElementById('tool-current-time');
    this.durationEl = document.getElementById('tool-duration');
    this.markBtn = document.getElementById('tool-mark-btn');
    this.undoBtn = document.getElementById('tool-undo-btn');
    this.resetTimesBtn = document.getElementById('tool-reset-times-btn');
    this.exportDownloadBtn = document.getElementById('tool-download-btn');
    this.exportCopyBtn = document.getElementById('tool-copy-btn');
    this.exportValidationEl = document.getElementById('tool-export-validation');
    this.statusBanner = document.getElementById('tool-status-banner');
    this.previewActiveEl = document.getElementById('tool-preview-active');
    this.linesContainer = document.getElementById('tool-lines-list');
    this.outputPreviewEl = document.getElementById('tool-lrc-output');
    this.progressCountEl = document.getElementById('tool-marked-count');

    this.items = []; // Array<{ text: string, time: number | null }>
    this.cursorIndex = 0;
    this.historyStack = [];
    this.isSeeking = false;
    this.rafId = null;

    this.init();
  }

  async init() {
    bindAudioWithFallback(this.audio, LOCAL_ASSETS.songAudio, (msg) => {
      this.setStatus(msg, 'error');
    });

    this.bindEvents();
    await this.loadProjectLyrics();
  }

  bindEvents() {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.rewindBtn.addEventListener('click', () => this.seekBy(-5));
    this.forwardBtn.addEventListener('click', () => this.seekBy(5));

    this.rateSelect.addEventListener('change', () => {
      const rate = parseFloat(this.rateSelect.value);
      if (Number.isFinite(rate)) this.audio.playbackRate = rate;
    });

    this.markBtn.addEventListener('click', () => this.markNextLine());
    this.undoBtn.addEventListener('click', () => this.undoLastMark());
    this.resetTimesBtn.addEventListener('click', () => this.clearAllTimes());
    this.exportDownloadBtn.addEventListener('click', () => this.downloadLrc());
    this.exportCopyBtn.addEventListener('click', () => this.copyLrc());

    this.audio.addEventListener('loadedmetadata', () => {
      this.durationEl.textContent = formatTime(this.audio.duration);
      this.updateProgressUI();
    });

    this.audio.addEventListener('play', () => {
      this.playBtn.textContent = 'Pausar (P)';
      this.startLoop();
    });

    this.audio.addEventListener('pause', () => {
      this.playBtn.textContent = 'Reproducir (P)';
      this.stopLoop();
      this.updateLivePreview();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) this.updateProgressUI();
      this.updateLivePreview();
    });

    this.audio.addEventListener('seeked', () => {
      this.updateProgressUI();
      this.updateLivePreview();
    });

    this.progressEl.addEventListener('input', () => {
      this.isSeeking = true;
      const pct = parseFloat(this.progressEl.value) || 0;
      const preview = (pct / 100) * (this.audio.duration || 0);
      this.currentTimeEl.textContent = formatTime(preview);
    });

    this.progressEl.addEventListener('change', () => {
      const pct = parseFloat(this.progressEl.value) || 0;
      if (Number.isFinite(this.audio.duration)) {
        this.audio.currentTime = (pct / 100) * this.audio.duration;
      }
      this.isSeeking = false;
    });

    // Atajos de teclado: Espacio / Enter para marcar frase, P para play/pausa, flechas para +/-5s
    document.addEventListener('keydown', (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        this.markNextLine();
      } else if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        this.togglePlay();
      } else if (event.code === 'ArrowLeft') {
        event.preventDefault();
        this.seekBy(-5);
      } else if (event.code === 'ArrowRight') {
        event.preventDefault();
        this.seekBy(5);
      }
    });
  }

  async loadProjectLyrics() {
    const result = await fetchLyricsFile(LOCAL_ASSETS.lyricsLrc);
    if (!result.ok) {
      this.setStatus(result.reason, 'error');
      return;
    }

    const parsed = parseLrc(result.content);
    if (parsed.hasTimestamps && parsed.lines.length > 0) {
      this.items = parsed.lines.map((line) => ({
        text: line.text,
        time: line.time
      }));
      this.cursorIndex = this.items.length;
      this.setStatus(
        `Archivo cargado (${result.path}) con ${this.items.length} versos ya sincronizados. Puedes ajustar cualquier tiempo y volver a exportar.`,
        'info'
      );
    } else if (parsed.plainLines.length > 0) {
      this.items = parsed.plainLines.map((text) => ({
        text,
        time: null
      }));
      this.cursorIndex = 0;
      this.setStatus(
        `Archivo cargado (${result.path}): ${this.items.length} versos listos para marcar manualmente.`,
        'info'
      );
    } else {
      this.setStatus('El archivo de letra está vacío.', 'error');
    }

    this.renderLines();
    this.refreshExportPreview();
  }

  renderLines() {
    this.linesContainer.innerHTML = '';

    this.items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'sync-row';
      if (index === this.cursorIndex) row.classList.add('is-cursor');
      if (item.time !== null) row.classList.add('is-marked');
      row.dataset.index = String(index);

      const idxBadge = document.createElement('span');
      idxBadge.className = 'sync-index';
      idxBadge.textContent = String(index + 1).padStart(2, '0');

      const timeInput = document.createElement('input');
      timeInput.type = 'text';
      timeInput.className = 'sync-time-input';
      timeInput.placeholder = '--:--.--';
      timeInput.value = item.time !== null ? formatLrcTimestamp(item.time) : '';
      timeInput.setAttribute('aria-label', `Tiempo del verso ${index + 1}`);

      timeInput.addEventListener('change', () => {
        if (!timeInput.value.trim()) {
          this.items[index].time = null;
          this.renderLines();
          this.refreshExportPreview();
          return;
        }
        const parsedSec = parseTimestampInput(timeInput.value);
        if (parsedSec === null) {
          timeInput.classList.add('is-invalid');
          return;
        }
        timeInput.classList.remove('is-invalid');
        this.items[index].time = parsedSec;
        timeInput.value = formatLrcTimestamp(parsedSec);
        this.renderLines();
        this.refreshExportPreview();
      });

      const nudgeMinus = document.createElement('button');
      nudgeMinus.type = 'button';
      nudgeMinus.className = 'mini-btn';
      nudgeMinus.textContent = '-0.1s';
      nudgeMinus.addEventListener('click', () => this.nudgeLine(index, -0.1));

      const nudgePlus = document.createElement('button');
      nudgePlus.type = 'button';
      nudgePlus.className = 'mini-btn';
      nudgePlus.textContent = '+0.1s';
      nudgePlus.addEventListener('click', () => this.nudgeLine(index, 0.1));

      const stampHereBtn = document.createElement('button');
      stampHereBtn.type = 'button';
      stampHereBtn.className = 'mini-btn mini-btn--accent';
      stampHereBtn.textContent = 'Marcar aquí';
      stampHereBtn.title = 'Asignar el tiempo actual del audio a esta frase';
      stampHereBtn.addEventListener('click', () => {
        this.historyStack.push({ index, prevTime: this.items[index].time });
        this.items[index].time = this.audio.currentTime || 0;
        this.cursorIndex = Math.min(this.items.length, index + 1);
        this.renderLines();
        this.refreshExportPreview();
      });

      const previewLineBtn = document.createElement('button');
      previewLineBtn.type = 'button';
      previewLineBtn.className = 'mini-btn';
      previewLineBtn.textContent = '▶';
      previewLineBtn.title = 'Escuchar desde 1.5s antes de este verso';
      previewLineBtn.disabled = item.time === null;
      previewLineBtn.addEventListener('click', () => {
        if (item.time === null) return;
        this.audio.currentTime = Math.max(0, item.time - 1.5);
        this.audio.play().catch(() => {});
      });

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'mini-btn mini-btn--danger';
      clearBtn.textContent = '✕';
      clearBtn.title = 'Limpiar tiempo de este verso';
      clearBtn.disabled = item.time === null;
      clearBtn.addEventListener('click', () => {
        this.historyStack.push({ index, prevTime: this.items[index].time });
        this.items[index].time = null;
        this.cursorIndex = index;
        this.renderLines();
        this.refreshExportPreview();
      });

      const textEl = document.createElement('span');
      textEl.className = 'sync-lyric-text';
      textEl.textContent = item.text;
      textEl.title = 'Clic para seleccionar como siguiente verso a marcar';
      textEl.addEventListener('click', () => {
        this.cursorIndex = index;
        this.renderLines();
      });

      const controlsWrap = document.createElement('div');
      controlsWrap.className = 'sync-row-controls';
      controlsWrap.append(
        timeInput,
        nudgeMinus,
        nudgePlus,
        stampHereBtn,
        previewLineBtn,
        clearBtn
      );

      row.append(idxBadge, textEl, controlsWrap);
      this.linesContainer.appendChild(row);
    });

    const markedCount = this.items.filter((i) => i.time !== null).length;
    this.progressCountEl.textContent = `${markedCount} / ${this.items.length} marcados`;
    this.undoBtn.disabled = this.historyStack.length === 0;
  }

  markNextLine() {
    if (!this.items.length) return;
    if (this.cursorIndex >= this.items.length) {
      this.setStatus(
        '¡Todos los versos están marcados! Ya puedes probar la vista previa o exportar el archivo LRC.',
        'info'
      );
      return;
    }

    const idx = this.cursorIndex;
    this.historyStack.push({ index: idx, prevTime: this.items[idx].time });
    this.items[idx].time = this.audio.currentTime || 0;
    this.cursorIndex += 1;

    this.renderLines();
    this.refreshExportPreview();
    this.scrollCursorIntoView();
  }

  undoLastMark() {
    const last = this.historyStack.pop();
    if (!last) return;
    this.items[last.index].time = last.prevTime;
    this.cursorIndex = last.index;
    this.renderLines();
    this.refreshExportPreview();
    this.scrollCursorIntoView();
  }

  clearAllTimes() {
    this.historyStack = [];
    this.items.forEach((item) => {
      item.time = null;
    });
    this.cursorIndex = 0;
    this.renderLines();
    this.refreshExportPreview();
  }

  nudgeLine(index, deltaSeconds) {
    const current = this.items[index].time;
    const base = current === null ? this.audio.currentTime || 0 : current;
    this.items[index].time = Math.max(0, base + deltaSeconds);
    this.renderLines();
    this.refreshExportPreview();
  }

  scrollCursorIntoView() {
    const target = this.linesContainer.querySelector('.sync-row.is-cursor');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  refreshExportPreview() {
    const lrcText = this.buildLrcOutput();
    this.outputPreviewEl.value = lrcText;
    this.validateExportReadiness();
  }

  validateExportReadiness() {
    if (!this.items.length) {
      this.exportValidationEl.dataset.ready = 'false';
      this.exportValidationEl.textContent = 'No hay versos cargados.';
      return { ready: false, message: 'No hay versos cargados para exportar.' };
    }

    const missingIndices = [];
    const outOfOrderIndices = [];
    let prevTime = -1;

    this.items.forEach((item, idx) => {
      if (item.time === null || !Number.isFinite(item.time)) {
        missingIndices.push(idx);
        return;
      }
      if (item.time < prevTime) {
        outOfOrderIndices.push(idx);
      }
      prevTime = item.time;
    });

    if (missingIndices.length > 0) {
      const sample = missingIndices
        .slice(0, 5)
        .map((i) => i + 1)
        .join(', ');
      const suffix = missingIndices.length > 5 ? '...' : '';
      const msg = `Faltan ${missingIndices.length} de ${this.items.length} frases por marcar (líneas: ${sample}${suffix}).`;
      this.exportValidationEl.dataset.ready = 'false';
      this.exportValidationEl.textContent = msg;
      return { ready: false, message: msg, firstMissingIndex: missingIndices[0] };
    }

    if (outOfOrderIndices.length > 0) {
      const lines = outOfOrderIndices.map((i) => i + 1).join(', ');
      const msg = `Hay tiempos menores al verso anterior en línea(s): ${lines}. Corrige antes de exportar.`;
      this.exportValidationEl.dataset.ready = 'false';
      this.exportValidationEl.textContent = msg;
      return { ready: false, message: msg, firstMissingIndex: outOfOrderIndices[0] };
    }

    this.exportValidationEl.dataset.ready = 'true';
    this.exportValidationEl.textContent = `${this.items.length} / ${this.items.length} frases marcadas en orden — LRC definitivo listo ✓`;
    return { ready: true, message: 'OK' };
  }

  buildLrcOutput() {
    const markedInOrder = this.items.filter((item) => item.time !== null);

    return serializeLrc({
      title: APP_CONFIG.music.defaultTitle,
      artist: APP_CONFIG.music.defaultArtist,
      lines: markedInOrder
    });
  }

  downloadLrc() {
    const check = this.validateExportReadiness();
    if (!check.ready) {
      this.setStatus(check.message, 'error');
      if (typeof check.firstMissingIndex === 'number') {
        this.cursorIndex = check.firstMissingIndex;
        this.renderLines();
        this.scrollCursorIntoView();
      }
      return;
    }

    const lrcText = this.buildLrcOutput();
    const blob = new Blob([lrcText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'letra.lrc';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.setStatus(
      'Archivo LRC definitivo descargado (36/36 frases). Reemplaza letra/letra.lrc.txt con este contenido.',
      'info'
    );
  }

  async copyLrc() {
    const check = this.validateExportReadiness();
    if (!check.ready) {
      this.setStatus(check.message, 'error');
      if (typeof check.firstMissingIndex === 'number') {
        this.cursorIndex = check.firstMissingIndex;
        this.renderLines();
        this.scrollCursorIntoView();
      }
      return;
    }

    const lrcText = this.buildLrcOutput();
    try {
      await navigator.clipboard.writeText(lrcText);
      this.setStatus('LRC definitivo copiado al portapapeles (36/36 frases).', 'info');
    } catch {
      this.outputPreviewEl.select();
      this.setStatus('Selecciona y copia el texto del recuadro LRC manualmente.', 'info');
    }
  }

  togglePlay() {
    if (this.audio.paused) {
      this.audio.play().catch(() => {});
    } else {
      this.audio.pause();
    }
  }

  seekBy(seconds) {
    if (!Number.isFinite(this.audio.duration)) return;
    this.audio.currentTime = Math.min(
      Math.max(0, this.audio.currentTime + seconds),
      this.audio.duration
    );
  }

  updateProgressUI() {
    const current = this.audio.currentTime || 0;
    const duration = this.audio.duration || 0;
    this.currentTimeEl.textContent = formatTime(current);
    if (duration > 0) {
      this.progressEl.value = ((current / duration) * 100).toFixed(2);
    }
  }

  updateLivePreview() {
    const marked = this.items
      .map((item, idx) => ({ ...item, idx }))
      .filter((item) => item.time !== null)
      .sort((a, b) => a.time - b.time);

    if (!marked.length) {
      this.previewActiveEl.textContent = 'Marca versos para ver la vista previa en vivo';
      return;
    }

    const activePos = findActiveLyricIndex(marked, this.audio.currentTime, 0);
    if (activePos < 0) {
      this.previewActiveEl.textContent = '♪ (Esperando primer verso marcado)';
    } else {
      this.previewActiveEl.textContent = marked[activePos].text;
    }

    const activeIdx = activePos >= 0 ? marked[activePos].idx : -1;
    const rows = this.linesContainer.children;
    for (let i = 0; i < rows.length; i += 1) {
      rows[i].classList.toggle('is-playing-line', i === activeIdx);
    }
  }

  startLoop() {
    this.stopLoop();
    const tick = () => {
      if (!this.audio.paused && !this.audio.ended) {
        if (!this.isSeeking) this.updateProgressUI();
        this.updateLivePreview();
        this.rafId = requestAnimationFrame(tick);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setStatus(message, type) {
    this.statusBanner.textContent = message;
    this.statusBanner.dataset.type = type;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ManualLrcSyncTool();
});
