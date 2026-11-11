/**
 * Parser para archivos de letra sincronizada (.lrc).
 * Soporta formatos [mm:ss.xx], [mm:ss.xxx], [mm:ss:xx], [mm:ss],
 * múltiples marcas de tiempo por línea y etiquetas de metadatos ([ti:], [ar:], [offset:]).
 */

const TIME_TAG_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG_REGEX = /^\[([a-zA-Z]+):(.*)\]$/;

/**
 * Convierte una cadena de archivo .lrc en metadatos y líneas ordenadas cronológicamente.
 * @param {string} rawText
 * @returns {{ meta: { title?: string, artist?: string, album?: string, offsetMs: number }, lines: Array<{ time: number, text: string }> }}
 */
export function parseLrc(rawText) {
  const meta = { offsetMs: 0 };
  const lines = [];

  if (!rawText || typeof rawText !== 'string') {
    return { meta, lines };
  }

  const normalized = rawText.replace(/^\uFEFF/, '');
  const rawLines = normalized.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Buscar todas las etiquetas de tiempo en la línea
    TIME_TAG_REGEX.lastIndex = 0;
    const timestamps = [];
    let match;

    while ((match = TIME_TAG_REGEX.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      // Normalizar centésimas (2 dígitos) o milésimas (3 dígitos) a segundos
      const fraction =
        fracRaw.length === 1
          ? parseInt(fracRaw, 10) / 10
          : fracRaw.length === 2
            ? parseInt(fracRaw, 10) / 100
            : parseInt(fracRaw.slice(0, 3), 10) / 1000;

      const totalSeconds = minutes * 60 + seconds + fraction;
      timestamps.push(totalSeconds);
    }

    if (timestamps.length > 0) {
      const text = trimmed.replace(TIME_TAG_REGEX, '').trim();
      for (const time of timestamps) {
        lines.push({
          time,
          text: text || '♪'
        });
      }
      continue;
    }

    // Procesar metadatos si no hay etiquetas de tiempo
    const metaMatch = trimmed.match(META_TAG_REGEX);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key === 'ti' && value) meta.title = value;
      else if (key === 'ar' && value) meta.artist = value;
      else if (key === 'al' && value) meta.album = value;
      else if (key === 'offset' && value) {
        const parsedOffset = parseInt(value, 10);
        if (!Number.isNaN(parsedOffset)) meta.offsetMs = parsedOffset;
      }
    }
  }

  // Aplicar offset si existe y ordenar cronológicamente
  const offsetSec = meta.offsetMs / 1000;
  const adjusted = lines
    .map((item) => ({
      time: Math.max(0, item.time + offsetSec),
      text: item.text
    }))
    .sort((a, b) => a.time - b.time);

  return { meta, lines: adjusted };
}

/**
 * Encuentra el índice de la línea activa para el tiempo actual del audio.
 * @param {Array<{ time: number, text: string }>} lines
 * @param {number} currentTime
 * @returns {number} Índice activo o -1 si aún no comienza la primera línea
 */
export function findActiveLyricIndex(lines, currentTime) {
  if (!lines.length || currentTime < lines[0].time) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let active = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= currentTime + 0.05) {
      active = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return active;
}

/**
 * Formatea segundos a mm:ss.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
