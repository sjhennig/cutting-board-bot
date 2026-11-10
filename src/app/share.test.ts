import { describe, expect, it } from 'vitest';
import { inch } from '../engine';
import { PATTERNS, defaultState, makeDesign, type DesignState } from './design';
import { cleanState, decodeDesign, designFromHash, encodeDesign, shareLink } from './share';

const own: DesignState = {
  ...defaultState,
  unit: 'mm',
  woodMode: 'have',
  pattern: 'brick',
  cellWidth: inch(3),
  canPlane: true,
  showGuide: true,
  seed: 7,
  excluded: ['cherry'],
  stock: [
    { id: 'own-0', species: 'hard-maple', thickness: inch(1.5), width: inch(5.25), length: inch(24), quantity: 2 },
    { id: 'own-1', species: 'black-walnut', thickness: inch(1.625), width: inch(5.25), length: inch(24), quantity: 3 },
  ],
};

describe('share links', () => {
  it('carries a design there and back unchanged', () => {
    expect(decodeDesign(encodeDesign(own))).toEqual(own);
    for (const pattern of PATTERNS) {
      const state = { ...defaultState, ...pattern.defaults, pattern: pattern.id };
      expect(decodeDesign(encodeDesign(state)), pattern.id).toEqual(state);
    }
  });

  it('keeps the link short by leaving out settings that are still the defaults', () => {
    // Only the wood mode is always written, so the link survives a change of default.
    expect(encodeDesign(defaultState)).toBe('eyJ3b29kTW9kZSI6ImhhdmUifQ'); // {"woodMode":"have"}
    expect(encodeDesign({ ...defaultState, pattern: 'brick' }).length).toBeLessThan(60);
  });

  it('still opens links made when buying was the default', () => {
    // {"pattern":"chevron"}: made before own boards became the default, so it means "buy".
    const old = decodeDesign('eyJwYXR0ZXJuIjoiY2hldnJvbiJ9')!;
    expect(old.woodMode).toBe('buy');
    expect(old.pattern).toBe('chevron');
  });

  it('uses only characters that are safe in a link', () => {
    expect(encodeDesign(own)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('builds a link on the current page and reads it back', () => {
    const link = shareLink(own, 'https://example.org/designer/#d=old');
    expect(link.startsWith('https://example.org/designer/#d=')).toBe(true);
    expect(designFromHash(new URL(link).hash)).toEqual(own);
  });

  it('ignores an address that carries no design', () => {
    expect(designFromHash('')).toBeNull();
    expect(designFromHash('#top')).toBeNull();
    expect(designFromHash('#d=not base64!')).toBeNull();
    expect(designFromHash('#d=bm90IGpzb24')).toBeNull(); // "not json"
    expect(designFromHash('#d=WzEsMl0')).toBeNull(); // "[1,2]"
  });
});

describe('cleanState', () => {
  it('returns the defaults for anything that is not a design', () => {
    for (const input of [null, undefined, 'x', 3, []]) expect(cleanState(input)).toEqual(defaultState);
  });

  it('keeps what is valid and replaces what is not', () => {
    const cleaned = cleanState({
      unit: 'furlongs',
      kerf: -1,
      canPlane: 'yes',
      pattern: 'houndstooth',
      cellWidth: 30,
      boardLength: Infinity,
      boardWidth: '300',
      seed: 1.5,
      buySpecies: ['cherry', 'unobtainium', 'cherry', 4],
      extra: 'ignored',
    });
    expect(cleaned).toEqual({ ...defaultState, cellWidth: 30, buySpecies: ['cherry'] });
  });

  it('drops boards that are not boards, and renumbers the rest', () => {
    const cleaned = cleanState({
      stock: [
        { id: 'same', species: 'cherry', thickness: 20, width: 100, length: 600, quantity: 500 },
        { id: 'same', species: 'cherry', thickness: 20, width: 100, length: 600 },
        { species: 'cherry', thickness: 0, width: 100, length: 600, quantity: 1 },
        { species: 'plastic', thickness: 20, width: 100, length: 600, quantity: 1 },
        'board',
      ],
    });
    expect(cleaned.stock.map((board) => [board.id, board.quantity])).toEqual([
      ['own-0', 99],
      ['own-1', 1],
    ]);
  });

  it('never produces a design that crashes the designer', () => {
    const hostile = cleanState({ pattern: 'illusion3d', boardLength: 9000, stripThickness: 0.001, stock: [{}] });
    // It may not be buildable, but it fails with a message, not a crash.
    try {
      makeDesign(hostile);
    } catch (problem) {
      expect(problem).toBeInstanceOf(Error);
    }
  });
});
