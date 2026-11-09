/**
 * Lengths are stored in millimetres everywhere in the engine.
 * Inches exist only at the edges: parsing what a person typed and formatting what they read.
 */

export const MM_PER_INCH = 25.4;

/** Two lengths closer than this are treated as equal (about 1/2500 in.). */
export const EPS = 0.01;

export type Unit = 'in' | 'mm';

export const inch = (inches: number): number => inches * MM_PER_INCH;
export const toInches = (mm: number): number => mm / MM_PER_INCH;

export const nearlyEqual = (a: number, b: number, tolerance = EPS): boolean => Math.abs(a - b) <= tolerance;

/**
 * Parse a length as a woodworker would write it and return millimetres.
 * Accepts `1-5/8`, `1 5/8"`, `5/8 in`, `1.5`, `38mm`, `3.8 cm`.
 * A bare number uses `defaultUnit`.
 */
export function parseLength(text: string, defaultUnit: Unit = 'in'): number {
  const match = text
    .trim()
    .toLowerCase()
    .match(/^(.*?)\s*("|in|in\.|inch|inches|mm|cm)?$/);
  const body = match?.[1]?.trim() ?? '';
  const suffix = match?.[2];

  const value = parseNumber(body);
  if (value === null || value < 0) {
    throw new Error(`"${text}" is not a length. Try something like 1-5/8 or 40mm.`);
  }

  if (suffix === 'mm') return value;
  if (suffix === 'cm') return value * 10;
  if (suffix !== undefined) return inch(value);
  return defaultUnit === 'in' ? inch(value) : value;
}

function parseNumber(body: string): number | null {
  const decimal = body.match(/^\d+(\.\d+)?$|^\.\d+$/);
  if (decimal) return Number(body);

  // "5/8", "1-5/8" or "1 5/8"
  const fraction = body.match(/^(?:(\d+)[\s-]+)?(\d+)\s*\/\s*(\d+)$/);
  if (!fraction) return null;
  const whole = Number(fraction[1] ?? 0);
  const numerator = Number(fraction[2]);
  const denominator = Number(fraction[3]);
  if (denominator === 0) return null;
  return whole + numerator / denominator;
}

/**
 * Format millimetres as fractional inches, rounded to the nearest 1/`denominator`
 * and reduced: 41.275 -> `1-5/8"`.
 */
export function formatInches(mm: number, denominator = 32): string {
  const totalParts = Math.round(toInches(mm) * denominator);
  const sign = totalParts < 0 ? '-' : '';
  const parts = Math.abs(totalParts);
  const whole = Math.floor(parts / denominator);
  let numerator = parts % denominator;
  let reduced = denominator;
  while (numerator > 0 && numerator % 2 === 0 && reduced % 2 === 0) {
    numerator /= 2;
    reduced /= 2;
  }

  if (numerator === 0) return `${sign}${whole}"`;
  if (whole === 0) return `${sign}${numerator}/${reduced}"`;
  return `${sign}${whole}-${numerator}/${reduced}"`;
}

export function formatLength(mm: number, unit: Unit, denominator = 32): string {
  if (unit === 'in') return formatInches(mm, denominator);
  const rounded = Math.round(mm * 10) / 10;
  return `${rounded} mm`;
}
