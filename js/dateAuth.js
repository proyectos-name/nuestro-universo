/**
 * Normalización y validación flexible de la fecha de acceso (18 / 01 / 2005).
 */

const TARGET_DAY = 18;
const TARGET_MONTH = 1;
const TARGET_YEAR = 2005;

/**
 * Extrae día, mes y año desde una cadena libre (18012005, 18/01/2005, 18 1 05, 18.01.2005, 18-01-2005).
 * @param {string} rawInput
 * @returns {{ day: string, month: string, year: string } | null}
 */
export function parseRawDateString(rawInput) {
  if (typeof rawInput !== 'string') return null;
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // Caso con separadores: /, ., -, o espacios
  const separated = trimmed.split(/[\s/.\-]+/).filter(Boolean);
  if (separated.length === 3) {
    const day = separated[0].replace(/\D/g, '');
    const month = separated[1].replace(/\D/g, '');
    const year = separated[2].replace(/\D/g, '');
    return { day, month, year };
  }

  // Caso continuo de solo dígitos: 18012005 (8) o 180105 (6)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 8) {
    return {
      day: digitsOnly.slice(0, 2),
      month: digitsOnly.slice(2, 4),
      year: digitsOnly.slice(4, 8)
    };
  }
  if (digitsOnly.length === 6) {
    return {
      day: digitsOnly.slice(0, 2),
      month: digitsOnly.slice(2, 4),
      year: digitsOnly.slice(4, 6)
    };
  }

  return null;
}

/**
 * Normaliza y valida la fecha ingresada frente al 18 de enero de 2005.
 * Acepta objeto { day, month, year } o cadena libre.
 * @param {string | { day: string, month: string, year: string }} input
 * @returns {{ valid: boolean, reason: 'ok' | 'empty' | 'incomplete' | 'impossible' | 'mismatch', normalized: string | null }}
 */
export function validateAccessDate(input) {
  let parts;

  if (typeof input === 'string') {
    if (!input.trim()) {
      return { valid: false, reason: 'empty', normalized: null };
    }
    parts = parseRawDateString(input);
    if (!parts) {
      return { valid: false, reason: 'incomplete', normalized: null };
    }
  } else if (input && typeof input === 'object') {
    const day = String(input.day || '').replace(/\D/g, '');
    const month = String(input.month || '').replace(/\D/g, '');
    const year = String(input.year || '').replace(/\D/g, '');
    if (!day && !month && !year) {
      return { valid: false, reason: 'empty', normalized: null };
    }
    parts = { day, month, year };
  } else {
    return { valid: false, reason: 'empty', normalized: null };
  }

  const { day: dayStr, month: monthStr, year: yearStr } = parts;

  if (
    !dayStr ||
    !monthStr ||
    !yearStr ||
    dayStr.length > 2 ||
    monthStr.length > 2 ||
    (yearStr.length !== 2 && yearStr.length !== 4)
  ) {
    return { valid: false, reason: 'incomplete', normalized: null };
  }

  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  let year = parseInt(yearStr, 10);

  if (yearStr.length === 2) {
    // Interpreta el año abreviado de 2 dígitos dentro del siglo 2000 (05 -> 2005)
    year = 2000 + year;
  }

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return { valid: false, reason: 'impossible', normalized: null };
  }

  // Verificar fecha real de calendario (rechaza 31/02/2005, 29/02/2005, etc.)
  const calendarDate = new Date(year, month - 1, day);
  if (
    calendarDate.getFullYear() !== year ||
    calendarDate.getMonth() !== month - 1 ||
    calendarDate.getDate() !== day
  ) {
    return { valid: false, reason: 'impossible', normalized: null };
  }

  const normalized = `${String(day).padStart(2, '0')}/${String(month).padStart(
    2,
    '0'
  )}/${year}`;

  if (day === TARGET_DAY && month === TARGET_MONTH && year === TARGET_YEAR) {
    return { valid: true, reason: 'ok', normalized };
  }

  return { valid: false, reason: 'mismatch', normalized };
}
