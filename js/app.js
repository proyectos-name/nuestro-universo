import { APP_CONFIG } from './config.js';
import {
  LOCAL_ASSETS,
  applyBackgroundWithFallback,
  bindImageWithFallback
} from './assets.js';
import { parseRawDateString, validateAccessDate } from './dateAuth.js';
import { MusicPlayerController } from './player.js';

/**
 * Controlador principal del flujo de pantallas de la experiencia.
 */
class RomanticUniverseApp {
  constructor() {
    this.stages = {
      login: document.getElementById('stage-login'),
      welcome: document.getElementById('stage-welcome'),
      music: document.getElementById('stage-music'),
      finale: document.getElementById('stage-finale')
    };

    this.currentStage = 'login';
    this.endedTransitionTimer = null;

    this.player = new MusicPlayerController({
      onSongEnded: () => this.handleSongEnded(),
      onPlaybackActivity: () => this.clearEndedTimer()
    });

    this.initAssets();
    this.initContent();
    this.initLogin();
    this.initNavigation();
  }

  initAssets() {
    const loginBgEl = document.getElementById('login-bg-layer');
    const avengersImgEl = document.getElementById('avengers-hero-img');
    const pandaImgEl = document.getElementById('panda-hero-img');

    applyBackgroundWithFallback(loginBgEl, LOCAL_ASSETS.loginBackground);
    bindImageWithFallback(avengersImgEl, LOCAL_ASSETS.avengersTeam);
    bindImageWithFallback(pandaImgEl, LOCAL_ASSETS.pandaHeart);
  }

  initContent() {
    // Login
    document.getElementById('login-badge').textContent = APP_CONFIG.login.badge;
    document.getElementById('login-title').textContent = APP_CONFIG.login.title;
    document.getElementById('login-subtitle').textContent = APP_CONFIG.login.subtitle;
    document.getElementById('login-submit-btn').textContent = APP_CONFIG.login.buttonText;

    // Bienvenida
    document.getElementById('welcome-badge').textContent = APP_CONFIG.welcome.badge;
    document.getElementById('welcome-title').textContent = APP_CONFIG.welcome.title;
    document.getElementById('welcome-message').textContent = APP_CONFIG.welcome.message;
    document.getElementById('welcome-continue-btn').textContent =
      APP_CONFIG.welcome.buttonText;

    // Música
    document.getElementById('to-finale-btn').textContent =
      APP_CONFIG.music.nextSceneLabel;

    // Final con panda
    document.getElementById('finale-badge').textContent = APP_CONFIG.finale.badge;
    document.getElementById('finale-title').textContent = APP_CONFIG.finale.title;
    document.getElementById('finale-dedication').textContent =
      APP_CONFIG.finale.dedication;
    document.getElementById('finale-signature').textContent =
      APP_CONFIG.finale.signature;
    document.getElementById('replay-song-btn').textContent =
      APP_CONFIG.finale.replaySongText;
    document.getElementById('restart-app-btn').textContent =
      APP_CONFIG.finale.restartExperienceText;

    const letterContainer = document.getElementById('finale-letter-body');
    letterContainer.innerHTML = '';
    APP_CONFIG.finale.letterParagraphs.forEach((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      letterContainer.appendChild(p);
    });
  }

  initLogin() {
    const form = document.getElementById('login-form');
    const shell = document.getElementById('date-input-shell');
    const dayInput = document.getElementById('date-day');
    const monthInput = document.getElementById('date-month');
    const yearInput = document.getElementById('date-year');
    const segments = [dayInput, monthInput, yearInput];
    const maxLengths = [2, 2, 4];
    const toggleBtn = document.getElementById('toggle-password-btn');
    const errorEl = document.getElementById('login-error');
    const card = document.getElementById('login-card');

    const clearError = () => {
      if (!errorEl.hidden) {
        errorEl.hidden = true;
        shell.classList.remove('is-invalid');
      }
    };

    const focusAtEnd = (el) => {
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // Algunos navegadores móviles no permiten setSelectionRange en type="password"
      }
    };

    const applyPastedDate = (rawText) => {
      const parsed = parseRawDateString(rawText);
      if (!parsed) return false;

      dayInput.value = parsed.day.slice(0, 2);
      monthInput.value = parsed.month.slice(0, 2);
      yearInput.value = parsed.year.slice(0, 4);
      clearError();

      if (yearInput.value.length > 0) {
        focusAtEnd(yearInput);
      } else if (monthInput.value.length > 0) {
        focusAtEnd(monthInput);
      } else {
        focusAtEnd(dayInput);
      }
      return true;
    };

    // Hacer clic en el contenedor o en las barras "/" enfoca el primer campo incompleto
    shell.addEventListener('click', (event) => {
      if (event.target.tagName === 'INPUT') return;
      const firstIncomplete =
        segments.find((seg, idx) => seg.value.length < maxLengths[idx]) || yearInput;
      focusAtEnd(firstIncomplete);
    });

    segments.forEach((seg, idx) => {
      seg.addEventListener('input', () => {
        clearError();
        const digits = seg.value.replace(/\D/g, '');
        const maxLen = maxLengths[idx];

        // Si el navegador o teclado ingresó más dígitos de los permitidos, distribuir al siguiente campo
        if (digits.length > maxLen && idx < segments.length - 1) {
          seg.value = digits.slice(0, maxLen);
          const overflow = digits.slice(maxLen);
          const next = segments[idx + 1];
          next.value = `${overflow}${next.value.replace(/\D/g, '')}`.slice(
            0,
            maxLengths[idx + 1]
          );
          focusAtEnd(next);
          return;
        }

        seg.value = digits.slice(0, maxLen);

        // Avance automático cuando el campo se completa al final
        let caretAtEnd = true;
        try {
          caretAtEnd = seg.selectionStart === seg.value.length;
        } catch {
          caretAtEnd = true;
        }

        if (seg.value.length === maxLen && caretAtEnd && idx < segments.length - 1) {
          segments[idx + 1].focus();
        }
      });

      seg.addEventListener('keydown', (event) => {
        // Permitir avanzar con separadores manuales (/, ., -, espacio)
        if (
          (event.key === '/' ||
            event.key === '.' ||
            event.key === '-' ||
            event.key === ' ') &&
          idx < segments.length - 1
        ) {
          event.preventDefault();
          if (seg.value.length > 0) {
            segments[idx + 1].focus();
          }
          return;
        }

        // Retroceso natural con Backspace entre segmentos
        if (event.key === 'Backspace' && idx > 0) {
          let atStart = seg.value.length === 0;
          try {
            atStart =
              seg.value.length === 0 ||
              (seg.selectionStart === 0 && seg.selectionEnd === 0);
          } catch {
            atStart = seg.value.length === 0;
          }

          if (atStart) {
            event.preventDefault();
            const prev = segments[idx - 1];
            if (seg.value.length === 0 && prev.value.length > 0) {
              prev.value = prev.value.slice(0, -1);
            }
            focusAtEnd(prev);
            clearError();
          }
          return;
        }

        // Navegación natural con flechas izquierda / derecha
        if (event.key === 'ArrowLeft' && idx > 0) {
          try {
            if (seg.selectionStart === 0 && seg.selectionEnd === 0) {
              event.preventDefault();
              focusAtEnd(segments[idx - 1]);
            }
          } catch {
            // Ignorar
          }
        } else if (event.key === 'ArrowRight' && idx < segments.length - 1) {
          try {
            if (seg.selectionStart === seg.value.length) {
              event.preventDefault();
              segments[idx + 1].focus();
            }
          } catch {
            // Ignorar
          }
        }
      });

      seg.addEventListener('paste', (event) => {
        const text = event.clipboardData?.getData('text') || '';
        if (applyPastedDate(text)) {
          event.preventDefault();
        }
      });
    });

    toggleBtn.addEventListener('click', () => {
      const showing = dayInput.type === 'text';
      const nextType = showing ? 'password' : 'text';
      segments.forEach((seg) => {
        seg.type = nextType;
      });
      toggleBtn.setAttribute('aria-pressed', String(!showing));
      toggleBtn.setAttribute(
        'aria-label',
        showing ? 'Mostrar fecha' : 'Ocultar fecha'
      );
      toggleBtn.classList.toggle('is-visible', !showing);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = validateAccessDate({
        day: dayInput.value,
        month: monthInput.value,
        year: yearInput.value
      });

      if (result.reason === 'empty') {
        this.showLoginError(APP_CONFIG.login.errorEmpty, errorEl, shell, card);
        return;
      }

      if (result.reason === 'incomplete') {
        this.showLoginError(APP_CONFIG.login.errorIncomplete, errorEl, shell, card);
        return;
      }

      if (!result.valid) {
        this.showLoginError(APP_CONFIG.login.errorInvalid, errorEl, shell, card);
        return;
      }

      errorEl.hidden = true;
      shell.classList.remove('is-invalid');
      this.goToStage('welcome');
    });
  }

  showLoginError(message, errorEl, shell, card) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    shell.classList.add('is-invalid');
    card.classList.remove('shake');
    // Forzar reflow para reiniciar animación de vibración suave
    void card.offsetWidth;
    card.classList.add('shake');
  }

  initNavigation() {
    const welcomeBtn = document.getElementById('welcome-continue-btn');
    const toFinaleBtn = document.getElementById('to-finale-btn');
    const replaySongBtn = document.getElementById('replay-song-btn');
    const restartAppBtn = document.getElementById('restart-app-btn');

    welcomeBtn.addEventListener('click', () => {
      this.goToStage('music');
    });

    toFinaleBtn.addEventListener('click', () => {
      this.clearEndedTimer();
      this.player.pause();
      this.goToStage('finale');
    });

    replaySongBtn.addEventListener('click', () => {
      this.clearEndedTimer();
      this.goToStage('music');
      this.player.restartAndPlay();
    });

    restartAppBtn.addEventListener('click', () => {
      this.clearEndedTimer();
      this.player.reset();
      const shell = document.getElementById('date-input-shell');
      const toggleBtn = document.getElementById('toggle-password-btn');
      const errorEl = document.getElementById('login-error');

      ['date-day', 'date-month', 'date-year'].forEach((id) => {
        const el = document.getElementById(id);
        el.value = '';
        el.type = 'password';
      });
      toggleBtn.setAttribute('aria-pressed', 'false');
      toggleBtn.setAttribute('aria-label', 'Mostrar fecha');
      toggleBtn.classList.remove('is-visible');
      shell.classList.remove('is-invalid');
      errorEl.hidden = true;
      this.goToStage('login');
    });
  }

  handleSongEnded() {
    this.clearEndedTimer();
    this.endedTransitionTimer = window.setTimeout(() => {
      if (this.currentStage === 'music') {
        this.goToStage('finale');
      }
    }, 1200);
  }

  clearEndedTimer() {
    if (this.endedTransitionTimer !== null) {
      clearTimeout(this.endedTransitionTimer);
      this.endedTransitionTimer = null;
    }
  }

  goToStage(nextKey) {
    if (!this.stages[nextKey] || nextKey === this.currentStage) return;

    const prevStage = this.stages[this.currentStage];
    const nextStage = this.stages[nextKey];

    prevStage.classList.remove('is-active');
    prevStage.setAttribute('aria-hidden', 'true');

    nextStage.classList.add('is-active');
    nextStage.setAttribute('aria-hidden', 'false');
    nextStage.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.currentStage = nextKey;

    if (nextKey === 'music') {
      this.player.onEnterStage();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RomanticUniverseApp();
});
