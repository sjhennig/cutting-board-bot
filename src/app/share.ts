import { speciesById } from '../data/species';
import type { StockBoard } from '../engine';
import { PATTERNS, defaultState, type DesignState } from './design';

/**
 * Saving a design and sharing it as a link.
 *
 * A link carries the whole design in the part of the address after `#d=`, so nothing is
 * stored on a server. Whatever arrives that way, or from the browser's storage, is
 * checked field by field: anything missing or wrong falls back to the default.
 */

const LINK_KEY = 'd';
/** A design has a handful of boards. This stops a hand-made link from flooding the planner. */
const MAX_BOARDS = 50;
/** Ten metres: longer than any board, and enough to reject nonsense. */
const MAX_LENGTH = 10_000;

const isLength = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= MAX_LENGTH;
const isSpecies = (value: unknown): value is string => typeof value === 'string' && speciesById(value) !== undefined;
const speciesList = (value: unknown): string[] | null =>
  Array.isArray(value) ? [...new Set(value.filter(isSpecies))] : null;

function stockBoard(value: unknown, index: number): StockBoard | null {
  if (typeof value !== 'object' || value === null) return null;
  const { species, thickness, width, length, quantity } = value as Record<string, unknown>;
  if (!isSpecies(species) || !isLength(thickness) || !isLength(width) || !isLength(length)) return null;
  const count = typeof quantity === 'number' && Number.isInteger(quantity) ? Math.min(99, Math.max(1, quantity)) : 1;
  // Ids are made afresh so that they are always unique.
  return { id: `own-${index}`, species, thickness, width, length, quantity: count };
}

/** A complete, valid design from anything: a saved design, a shared link, or rubbish. */
export function cleanState(input: unknown): DesignState {
  if (typeof input !== 'object' || input === null) return defaultState;
  const raw = input as Record<string, unknown>;
  const length = (key: keyof DesignState): number => (isLength(raw[key]) ? raw[key] : (defaultState[key] as number));
  const flag = (key: keyof DesignState): boolean =>
    typeof raw[key] === 'boolean' ? raw[key] : (defaultState[key] as boolean);

  return {
    unit: raw.unit === 'mm' || raw.unit === 'in' ? raw.unit : defaultState.unit,
    kerf: length('kerf'),
    canPlane: flag('canPlane'),
    woodMode: raw.woodMode === 'have' || raw.woodMode === 'buy' ? raw.woodMode : defaultState.woodMode,
    buySpecies: speciesList(raw.buySpecies) ?? defaultState.buySpecies,
    stock: Array.isArray(raw.stock)
      ? raw.stock
          .slice(0, MAX_BOARDS)
          .map(stockBoard)
          .filter((board): board is StockBoard => board !== null)
      : defaultState.stock,
    excluded: speciesList(raw.excluded) ?? defaultState.excluded,
    pattern: PATTERNS.find((pattern) => pattern.id === raw.pattern)?.id ?? defaultState.pattern,
    cellWidth: length('cellWidth'),
    stripThickness: length('stripThickness'),
    boardLength: length('boardLength'),
    boardWidth: length('boardWidth'),
    boardThickness: length('boardThickness'),
    seed: typeof raw.seed === 'number' && Number.isSafeInteger(raw.seed) ? raw.seed : defaultState.seed,
    showGuide: flag('showGuide'),
  };
}

// Text to and from the URL-safe form of base64, which needs no escaping in a link.
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** The part of a link that carries a design: only the settings that differ from the defaults. */
export function encodeDesign(state: DesignState): string {
  const changed: Record<string, unknown> = {};
  for (const key of Object.keys(defaultState) as (keyof DesignState)[]) {
    if (JSON.stringify(state[key]) !== JSON.stringify(defaultState[key])) changed[key] = state[key];
  }
  return toBase64Url(JSON.stringify(changed));
}

/** The design a link carries, or null if the text is not one. */
export function decodeDesign(text: string): DesignState | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(text));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return cleanState(parsed);
  } catch {
    return null;
  }
}

/** A link to this page that opens with the given design. */
export function shareLink(state: DesignState, page: string): string {
  return `${page.split('#')[0]}#${LINK_KEY}=${encodeDesign(state)}`;
}

/** The design in a page address, if it has one. */
export function designFromHash(hash: string): DesignState | null {
  const match = hash.match(new RegExp(`^#${LINK_KEY}=([A-Za-z0-9_-]+)$`));
  return match ? decodeDesign(match[1] as string) : null;
}
