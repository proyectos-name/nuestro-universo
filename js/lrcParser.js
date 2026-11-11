/**
 * Parser y utilidades para archivos de letra sincronizada (.lrc).
 * - Detecta si el archivo contiene marcas de tiempo válidas ([mm:ss.xx]).
 * - Si solo contiene texto plano, conserva íntegramente las líneas originales sin inventar tiempos.
 */

const TIME_TAG_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG_REGEX = /^\[([a-zA-Z]+):(.*)\]$/;

/**
 * Analiza el contenido de un archivo .lrc.
 * @param {string} rawText
 * @returns {{
 *   hasTimestamps: boolean,
 *   meta: { title?: string, artist?: string, album?: string, offsetMs: number },
 *   lines: Array<{ time: number, text: string }>,
 *   plainLines: string[]
 * }}
 */
export function parseLrc(rawText) {
  const meta = { offsetMs: 0 };
  const syncedLines = [];
  const plainLines = [];

  if (!rawText || typeof rawText !== 'string') {
    return { hasTimestamps: false, meta, lines: [], plainLines };
  }

  const normalized = rawText.replace(/^\uFEFF/, '');
  const rawLines = normalized.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // 1. Buscar etiquetas de tiempo [mm:ss.xx]
    TIME_TAG_REGEX.lastIndex = 0;
    const timestamps = [];
    let match;

    while ((match = TIME_TAG_REGEX.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fracRaw = match[3] || '0';
      const fraction =
        fracRaw.length === 1
          ? parseInt(fracRaw, 10) / 10
          : fracRaw.length === 2
            ? parseInt(fracRaw, 10) / 100
            : parseInt(fracRaw.slice(0, 3), 10) / 1000;

      timestamps.push(minutes * 60 + seconds + fraction);
    }

    if (timestamps.length > 0) {
      const text = trimmed.replace(TIME_TAG_REGEX, '').trim();
      for (const time of timestamps) {
        syncedLines.push({
          time,
          text: text || '♪'
        });
      }
      continue;
    }

    // 2. Verificar si es una etiqueta de metadatos [ti:...], [ar:...], [offset:...]
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
      continue;
    }

    // 3. Línea de texto plano sin marcas de tiempo (se conserva íntegra)
    plainLines.push(trimmed);
  }

  const hasTimestamps = syncedLines.length > 0;
  const offsetSec = meta.offsetMs / 1000;

  const sortedLines = syncedLines
    .map((item) => ({
      time: Math.max(0, item.time + offsetSec),
      text: item.text
    }))
    .sort((a, b) => a.time - b.time);

  return {
    hasTimestamps,
    meta,
    lines: sortedLines,
    plainLines
  };
}

/**
 * Encuentra el índice de la línea activa para audio.currentTime considerando un desfase en ms.
 * @param {Array<{ time: number, text: string }>} lines
 * @param {number} currentTime
 * @param {number} [offsetMs=0] Positivo retrasa la letra; negativo la adelanta
 * @returns {number}
 */
export function findActiveLyricIndex(lines, currentTime, offsetMs = 0) {
  if (!lines.length) return -1;

  const effectiveTime = currentTime - offsetMs / 1000;
  if (effectiveTime < lines[0].time) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let active = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= effectiveTime + 0.04) {
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

/**
 * Formatea segundos al estándar LRC mm:ss.xx.
 * @param {number} seconds
 * @returns {string}
 */
export function formatLrcTimestamp(seconds) {
  const safe = Number.isFinite(seconds) && seconds >= 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.round((safe - Math.floor(safe)) * 100);
  if (centis === 100) {
    return formatLrcTimestamp(Math.floor(safe) + 1);
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Convierte un formato [mm:ss.xx] o mm:ss.xx a segundos. Devuelve null si es inválido.
 * @param {string} input
 * @returns {number | null}
 */
export function parseTimestampInput(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/^\[|\]$/g, '');
  const match = cleaned.match(/^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
  if (!match) return null;

  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (secs >= 60) return null;

  const fracRaw = match[3] || '0';
  const frac =
    fracRaw.length === 1
      ? parseInt(fracRaw, 10) / 10
      : fracRaw.length === 2
        ? parseInt(fracRaw, 10) / 100
        : parseInt(fracRaw.slice(0, 3), 10) / 1000;

  return mins * 60 + secs + frac;
}

/**
 * Serializa líneas sincronizadas a texto LRC estándar.
 * @param {{ title?: string, artist?: string, lines: Array<{ time: number | null, text: string }> }} payload
 * @returns {string}
 */
export function serializeLrc({ title, artist, lines }) {
  const output = [];
  if (title) output.push(`[ti:${title}]`);
  if (artist) output.push(`[ar:${artist}]`);
  if (output.length) output.push('');

  for (const item of lines) {
    if (item.time === null || !Number.isFinite(item.time)) continue;
    output.push(`[${formatLrcTimestamp(item.time)}] ${item.text}`);
  }

  return `${output.join('\n')}\n`;
}
