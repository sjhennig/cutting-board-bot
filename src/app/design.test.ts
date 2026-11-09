import { describe, expect, it } from 'vitest';
import { inch, type StockBoard } from '../engine';
import { PATTERNS, defaultState, makeDesign, suggestedStripThickness, type DesignState } from './design';

const own = (species: string, thickness: number, quantity: number): StockBoard => ({
  id: `${species}-${thickness}`, species, thickness: inch(thickness), width: inch(5.25), length: inch(24), quantity,
});

describe('makeDesign', () => {
  it('gives a first-time visitor a buildable board with nothing to fix', () => {
    const design = makeDesign(defaultState);
    expect(design.notices).toEqual([]);
    expect(design.board.length).toBeCloseTo(inch(15), 6);
    expect(design.board.width).toBeCloseTo(inch(13), 6);
    expect(design.board.thickness).toBeCloseTo(inch(1.5), 6);
    // Twelve blanks, none of which needs ripping.
    expect(design.purchase.map((line) => line.quantity)).toEqual([6, 6]);
    expect(design.plan.boards.every((board) => board.segments[0]!.leftoverWidth === 0)).toBe(true);
  });

  it.each(PATTERNS.map((pattern) => pattern.id))('builds a %s board from the default woods', (pattern) => {
    const design = makeDesign({ ...defaultState, pattern });
    expect(design.plan.shortfalls).toEqual([]);
    expect(design.board.cells.length).toBeGreaterThan(0);
  });

  it('rounds the requested size to whole pieces', () => {
    const design = makeDesign({ ...defaultState, boardLength: inch(15.4), boardWidth: inch(12.2) });
    expect(design.columns).toBe(12);
    expect(design.rows).toBe(8);
  });

  it('explains when a pattern needs more woods', () => {
    expect(() => makeDesign({ ...defaultState, buySpecies: ['hard-maple'] })).toThrow(/needs at least 2 woods/);
    expect(() => makeDesign({ ...defaultState, buySpecies: [] })).toThrow(/Choose at least one wood/);
  });

  it('says exactly what is missing from the user\'s own boards', () => {
    const state: DesignState = {
      ...defaultState, woodMode: 'have', pattern: 'brick', cellWidth: inch(3), stripThickness: inch(1.5), canPlane: true,
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.625, 2)],
    };
    const problems = makeDesign(state).notices.filter((notice) => notice.level === 'problem').map((notice) => notice.message);
    expect(problems).toEqual([
      'Not enough Hard maple: 1 more strip needed, 3" wide, 1-1/2" thick and 16-1/8" long.',
      'Not enough Black walnut: 1 more strip needed, 3" wide, 1-1/2" thick and 16-1/8" long.',
    ]);
  });

  it('will not plan on planing when there is no planer', () => {
    const state: DesignState = {
      ...defaultState, woodMode: 'have', cellWidth: inch(1.5), stripThickness: inch(1.5), boardLength: inch(9), canPlane: false,
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.625, 2)],
    };
    expect(makeDesign(state).notices.some((notice) => notice.message.includes('no planer'))).toBe(true);
    expect(makeDesign({ ...state, canPlane: true }).notices).toEqual([]);
  });

  it('warns about unsuitable woods and tight boards', () => {
    const oak = makeDesign({ ...defaultState, buySpecies: ['hard-maple', 'red-oak'], cellWidth: inch(1.5) });
    expect(oak.notices.some((notice) => notice.message.startsWith('Red oak:'))).toBe(true);

    const tight: DesignState = {
      ...defaultState, woodMode: 'have', cellWidth: inch(1.5), stripThickness: inch(1.5), boardLength: inch(9), boardWidth: inch(19.5),
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.5, 2)],
    };
    // 13 slices need 23 in. of a 24 in. board.
    expect(makeDesign(tight).notices.some((notice) => notice.message.includes('to spare'))).toBe(true);
  });

  it('suggests a strip thickness every chosen wood can supply', () => {
    const state: DesignState = { ...defaultState, woodMode: 'have', stock: [own('hard-maple', 1.5, 1), own('black-walnut', 1.625, 1)] };
    expect(suggestedStripThickness(state)).toBeCloseTo(inch(1.5), 6);
    expect(suggestedStripThickness(defaultState)).toBeNull();
  });
});
