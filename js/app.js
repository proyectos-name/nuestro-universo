import { APP_CONFIG } from './config.js';
import {
  LOCAL_ASSETS,
  applyBackgroundWithFallback,
  bindImageWithFallback
} from './assets.js';
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
      onSongEnded: () => this.handleSongEnded()
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
    document.getElementById('password-input').placeholder = APP_CONFIG.login.placeholder;
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
    const input = document.getElementById('password-input');
    const toggleBtn = document.getElementById('toggle-password-btn');
    const errorEl = document.getElementById('login-error');
    const card = document.getElementById('login-card');

    toggleBtn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      toggleBtn.setAttribute('aria-pressed', String(!showing));
      toggleBtn.setAttribute(
        'aria-label',
        showing ? 'Mostrar fecha' : 'Ocultar fecha'
      );
      toggleBtn.classList.toggle('is-visible', !showing);
    });

    input.addEventListener('input', () => {
      if (!errorEl.hidden) {
        errorEl.hidden = true;
        input.classList.remove('is-invalid');
      }
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const entered = input.value.trim();

      if (!entered) {
        this.showLoginError(APP_CONFIG.login.errorEmpty, errorEl, input, card);
        return;
      }

      if (entered !== APP_CONFIG.accessCode) {
        this.showLoginError(APP_CONFIG.login.errorInvalid, errorEl, input, card);
        return;
      }

      errorEl.hidden = true;
      input.classList.remove('is-invalid');
      this.goToStage('welcome');
    });
  }

  showLoginError(message, errorEl, input, card) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    input.classList.add('is-invalid');
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
      this.player.restartAndPlay();
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
      const input = document.getElementById('password-input');
      const errorEl = document.getElementById('login-error');
      input.value = '';
      input.type = 'password';
      input.classList.remove('is-invalid');
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
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new RomanticUniverseApp();
});
