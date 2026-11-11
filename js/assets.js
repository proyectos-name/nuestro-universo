/**
 * Resolución segura de recursos locales existentes en el proyecto.
 * Prioriza los nombres exactos presentes actualmente en las carpetas locales
 * y mantiene compatibilidad con extensiones simples (por ejemplo, si se renombran).
 */
export const LOCAL_ASSETS = {
  loginBackground: [
    'img/fondo-login.png',
    'img/fondo-login.webp',
    'img/fondo-login.jpg'
  ],
  avengersTeam: [
    'img/avengers-equipo.png.png',
    'img/avengers-equipo.png'
  ],
  songCover: [
    'img/portada-cancion.jpg',
    'img/portada-cancion.png'
  ],
  pandaHeart: [
    'img/panda-corazon.png.png',
    'img/panda-corazon.png'
  ],
  songAudio: [
    'musica/cancion.mp3.mp3',
    'musica/cancion.mp3'
  ],
  lyricsLrc: [
    'letra/letra.lrc',
    'letra/letra.lrc.txt'
  ]
};

/**
 * Carga una imagen probando las rutas candidatas hasta encontrar una válida.
 * Evita errores 404 innecesarios probando primero el recurso existente.
 * @param {HTMLImageElement} imgElement
 * @param {string[]} candidates
 * @param {() => void} [onAllFailed]
 */
export function bindImageWithFallback(imgElement, candidates, onAllFailed) {
  if (!imgElement || !candidates.length) return;
  let index = 0;

  const tryNext = () => {
    if (index >= candidates.length) {
      if (typeof onAllFailed === 'function') onAllFailed();
      return;
    }
    imgElement.src = candidates[index];
    index += 1;
  };

  imgElement.addEventListener('error', tryNext);
  tryNext();
}

/**
 * Resuelve y aplica una imagen de fondo CSS mediante un elemento Image en memoria.
 * @param {HTMLElement} targetElement
 * @param {string[]} candidates
 */
export function applyBackgroundWithFallback(targetElement, candidates) {
  if (!targetElement || !candidates.length) return;
  let index = 0;

  const tryLoad = () => {
    if (index >= candidates.length) return;
    const src = candidates[index];
    index += 1;

    const probe = new Image();
    probe.onload = () => {
      targetElement.style.backgroundImage = `url("${src}")`;
      targetElement.classList.add('bg-loaded');
    };
    probe.onerror = tryLoad;
    probe.src = src;
  };

  tryLoad();
}

/**
 * Configura el elemento <audio> probando las rutas candidatas ante un error de carga.
 * @param {HTMLAudioElement} audioElement
 * @param {string[]} candidates
 * @param {(message: string) => void} onFatalError
 */
export function bindAudioWithFallback(audioElement, candidates, onFatalError) {
  if (!audioElement || !candidates.length) return;
  let index = 0;
  const tried = [];

  const tryNext = () => {
    if (index >= candidates.length) {
      if (typeof onFatalError === 'function') {
        onFatalError(
          `No se pudo cargar el audio local (rutas probadas: ${tried.join(', ')}).`
        );
      }
      return;
    }
    const candidate = candidates[index];
    tried.push(candidate);
    audioElement.src = candidate;
    audioElement.load();
    index += 1;
  };

  audioElement.addEventListener('error', tryNext);
  tryNext();
}

/**
 * Lee el primer archivo .lrc disponible desde las rutas locales candidatas.
 * @param {string[]} candidates
 * @returns {Promise<{ ok: boolean, content?: string, path?: string, reason?: string }>}
 */
export async function fetchLyricsFile(candidates) {
  const isFileProtocol = window.location.protocol === 'file:';
  let emptyFallback = null;
  const errors = [];

  for (const path of candidates) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (response.ok) {
        const content = await response.text();
        if (content.trim().length > 0) {
          return { ok: true, content, path };
        }
        if (!emptyFallback) {
          emptyFallback = { ok: true, content, path };
        }
      } else {
        errors.push(`${path} (HTTP ${response.status})`);
      }
    } catch (err) {
      errors.push(`${path} (${err?.message || 'error de red'})`);
    }
  }

  if (emptyFallback) {
    return emptyFallback;
  }

  return {
    ok: false,
    reason: isFileProtocol
      ? 'La página se abrió con file://. Ábrela mediante un servidor HTTP local (por ejemplo: python -m http.server 8000 o Live Server) para leer la letra.'
      : `No se pudo cargar ningún archivo de letra (${errors.join(' | ')}).`
  };
}
