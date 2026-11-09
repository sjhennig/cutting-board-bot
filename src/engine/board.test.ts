import { describe, expect, it } from 'vitest';
import { buildBoard, lengthForSlices, packWidths, slicesFromLength } from './board';
import { brick, chaotic, checkerboard, illusion3d, stripes } from './patterns';
import type { Recipe, WasteReport } from './types';
import { inch } from './units';

/** 1/64 in., the accuracy the plan asks of hand-checked designs. */
const SIXTY_FOURTH = inch(1 / 64);
const closeTo = (actual: number, inches: number): void =>
  expect(Math.abs(actual - inch(inches))).toBeLessThan(SIXTY_FOURTH);

function wasteTotal(waste: WasteReport): number {
  const { supplied: _supplied, ...parts } = waste;
  return Object.values(parts).reduce((sum, part) => sum + part, 0);
}

const speciesAt = (recipe: Recipe, x: number, y: number): string | undefined =>
  buildBoard(recipe).cells.find(
    (cell) => x >= cell.x && x < cell.x + cell.width && y >= cell.y && y < cell.y + cell.height,
  )?.species;

describe('slice arithmetic', () => {
  it('counts slices from a 24 in. panel', () => {
    // 24 - 1/2 trim = 23-1/2 usable. Each slice costs 1-1/2 + 1/8 = 1-5/8.
    // 14 slices need 14 x 1-1/2 + 13 x 1/8 = 22-5/8; 15 would need 24-1/4.
    expect(slicesFromLength(inch(24), inch(1.5), inch(1 / 8), inch(0.5))).toBe(14);
  });

  it('does not charge a kerf after the last slice', () => {
    // Four 2 in. slices and three 1/8 in. kerfs are exactly 8-3/8 in.
    expect(slicesFromLength(inch(8.375), inch(2), inch(1 / 8))).toBe(4);
    expect(slicesFromLength(inch(8.37), inch(2), inch(1 / 8))).toBe(3);
  });

  it('gives no slices from a panel shorter than one slice', () => {
    expect(slicesFromLength(inch(1), inch(1.5), inch(1 / 8))).toBe(0);
  });

  it('sizes a panel for a number of slices, and the two agree', () => {
    const length = lengthForSlices(12, inch(1.5), inch(1 / 8), inch(0.5));
    closeTo(length, 19.875);
    expect(slicesFromLength(length, inch(1.5), inch(1 / 8), inch(0.5))).toBe(12);
  });

  it('packs re-ripped widths into as few slices as it can', () => {
    // 48 wide with a 3 kerf: 33+9, 33+9, 24+15+3, 24+15, 5+5.
    expect(packWidths([33, 33, 24, 24, 15, 15, 9, 9, 5, 5, 3], 48, 3)).toBe(5);
    expect(packWidths([10, 10], 23, 3)).toBe(1);
    expect(packWidths([10, 10], 22, 3)).toBe(2);
  });
});

describe('checkerboard', () => {
  // Hand check: 8 strips of 1-1/2 in. make a 12 in. panel. 12 slices of 1-1/2 in. stock
  // stack to 18 in. Flattening takes 1/16 in. off each face of the 1-1/2 in. slices.
  const recipe = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 12, cellWidth: inch(1.5) });
  const board = buildBoard(recipe);

  it('matches the hand-checked dimensions', () => {
    closeTo(board.length, 12);
    closeTo(board.width, 18);
    closeTo(board.thickness, 1.375);
    closeTo(board.panels[0]!.lengthNeeded, 19.875);
    expect(board.panels[0]!.slicesNeeded).toBe(12);
    expect(board.cells).toHaveLength(96);
  });

  it('alternates species in both directions', () => {
    const cell = inch(1.5);
    for (let row = 0; row < 12; row++) {
      for (let column = 0; column < 8; column++) {
        const expected = (row + column) % 2 === 0 ? 'maple' : 'walnut';
        expect(speciesAt(recipe, (column + 0.5) * cell, (row + 0.5) * cell)).toBe(expected);
      }
    }
  });

  it('uses a shift and one extra strip when the column count is odd', () => {
    const odd = checkerboard({ species: ['maple', 'walnut'], columns: 7, rows: 4, cellWidth: inch(1.5) });
    expect(odd.panels[0]!.strips).toHaveLength(8);
    const result = buildBoard(odd);
    closeTo(result.length, 10.5);
    const cell = inch(1.5);
    expect(speciesAt(odd, 0.5 * cell, 0.5 * cell)).not.toBe(speciesAt(odd, 0.5 * cell, 1.5 * cell));
    expect(speciesAt(odd, 0.5 * cell, 0.5 * cell)).not.toBe(speciesAt(odd, 1.5 * cell, 0.5 * cell));
  });
});

describe('brick', () => {
  // Hand check: 6 bricks of 3 in. make an 18 in. panel. Sliding alternate slices 1-1/2 in.
  // leaves 16-1/2 in. common to all slices. 8 slices of 1-1/2 in. stock stack to 12 in.
  const recipe = brick({ species: ['maple', 'walnut'], columns: 6, rows: 8, brickWidth: inch(3) });
  const board = buildBoard(recipe);

  it('matches the hand-checked dimensions', () => {
    closeTo(board.length, 16.5);
    closeTo(board.width, 12);
    closeTo(board.thickness, 1.375);
  });

  it('staggers the joints of neighbouring rows by half a brick', () => {
    const joints = (row: number): number[] =>
      board.cells
        .filter((cell) => cell.slice === row && cell.x > 0)
        .map((cell) => Math.round((cell.x / inch(1)) * 1000) / 1000);
    expect(joints(0)).toEqual([1.5, 4.5, 7.5, 10.5, 13.5]);
    expect(joints(1)).toEqual([3, 6, 9, 12, 15]);
  });
});

describe('3D illusion board', () => {
  // Checked against MTM Wood's plan "A 3D End Grain Cutting Board #1 for 13 in. planer".
  const recipe = illusion3d({ dark: 'walnut', light: 'maple' });
  const board = buildBoard(recipe);
  const tally = (panel: number, species: string): Record<number, number> => {
    const counts: Record<number, number> = {};
    for (const strip of recipe.panels[panel]!.strips) {
      if (strip.species === species) counts[strip.width] = (counts[strip.width] ?? 0) + 1;
    }
    return counts;
  };

  it('needs the strips the plan lists', () => {
    expect(recipe.panels[0]!.strips).toHaveLength(21);
    expect(tally(0, 'walnut')).toEqual({ 3: 1, 5: 2, 9: 2, 15: 2, 24: 2, 38: 2 });
    expect(tally(0, 'maple')).toEqual({ 4: 2, 7: 2, 12: 2, 19: 2, 29: 2 });
    // The second panel is the colour negative of the first.
    expect(tally(1, 'maple')).toEqual(tally(0, 'walnut'));
    expect(tally(1, 'walnut')).toEqual(tally(0, 'maple'));
  });

  it('re-rips the slices to the widths the plan lists, alternating panels', () => {
    const fromPanel = (id: string): number[] =>
      recipe.slices.filter((slice) => slice.panel === id).map((slice) => slice.ripTo!).sort((a, b) => b - a);
    expect(fromPanel('A')).toEqual([33, 33, 24, 24, 15, 15, 9, 9, 5, 5, 3]);
    expect(fromPanel('B')).toEqual([29, 29, 19, 19, 12, 12, 7, 7, 4, 4]);
    expect(recipe.slices.map((slice) => slice.panel).join('')).toBe('ABABABABABABABABABABA');
  });

  it('makes a square board with 33 mm edge rectangles', () => {
    expect(board.length).toBeCloseTo(317, 6);
    expect(board.width).toBeCloseTo(317, 6);
    const corner = board.cells[0]!;
    expect(corner.width).toBeCloseTo(33, 6);
    expect(corner.height).toBeCloseTo(33, 6);
  });

  it('gets several narrow pieces out of each slice', () => {
    expect(board.panels.map((panel) => panel.slicesNeeded)).toEqual([5, 4]);
  });

  it('is symmetrical about both centre lines', () => {
    const at = (x: number, y: number) => speciesAt(recipe, x, y);
    for (const [x, y] of [[10, 10], [50, 125], [158, 158], [200, 40]] as const) {
      expect(at(x, y)).toBe(at(317 - x, y));
      expect(at(x, y)).toBe(at(x, 317 - y));
    }
  });
});

describe('waste accounting', () => {
  const recipes: [string, Recipe][] = [
    ['stripes', stripes({ strips: [{ species: 'maple', width: 30 }, { species: 'walnut', width: 12 }], rows: 9 })],
    ['checkerboard', checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 12, cellWidth: inch(1.5) })],
    ['odd checkerboard', checkerboard({ species: ['maple', 'walnut'], columns: 7, rows: 5, cellWidth: inch(1) })],
    ['brick', brick({ species: ['maple', 'walnut', 'cherry'], columns: 6, rows: 8, brickWidth: inch(3) })],
    ['chaotic', chaotic({ species: ['maple', 'walnut', 'cherry'], widths: [10, 20, 35], boardLength: 300, rows: 10, seed: 7 })],
    ['3D illusion', illusion3d({ dark: 'walnut', light: 'maple' })],
  ];

  it.each(recipes)('accounts for all the wood in a %s board', (_name, recipe) => {
    const { waste } = buildBoard(recipe);
    expect(wasteTotal(waste) / waste.supplied).toBeCloseTo(1, 9);
    for (const part of Object.values(waste)) expect(part).toBeGreaterThanOrEqual(-1e-6);
  });

  it('accounts for all the wood when the panel is longer than needed', () => {
    const recipe = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 6, cellWidth: inch(1.5) });
    recipe.panels[0]!.length = inch(24);
    const board = buildBoard(recipe);
    expect(wasteTotal(board.waste) / board.waste.supplied).toBeCloseTo(1, 9);
    expect(board.panels[0]!.slicesAvailable).toBe(14);
    expect(board.waste.panelLeftover).toBeGreaterThan(0);
  });
});

describe('chaotic', () => {
  const options = { species: ['maple', 'walnut', 'cherry'], widths: [10, 20, 35], boardLength: 300, rows: 10 };

  it('gives the same board for the same seed and a different one otherwise', () => {
    expect(chaotic({ ...options, seed: 3 })).toEqual(chaotic({ ...options, seed: 3 }));
    expect(chaotic({ ...options, seed: 3 })).not.toEqual(chaotic({ ...options, seed: 4 }));
  });

  it('never puts the same species in neighbouring strips', () => {
    const { strips } = chaotic({ ...options, seed: 11 }).panels[0]!;
    strips.forEach((strip, index) => {
      if (index > 0) expect(strip.species).not.toBe(strips[index - 1]!.species);
    });
    expect(buildBoard(chaotic({ ...options, seed: 11 })).length).toBeGreaterThanOrEqual(300);
  });
});

describe('invalid recipes', () => {
  const good = checkerboard({ species: ['maple', 'walnut'], columns: 4, rows: 4, cellWidth: 30 });

  it('explains what is wrong', () => {
    expect(() => buildBoard({ ...good, slices: [{ panel: 'Z' }] })).toThrow(/does not exist/);
    expect(() => buildBoard({ ...good, slices: [{ panel: 'A', ripTo: 500 }] })).toThrow(/only/);
    expect(() => buildBoard({ ...good, slices: [] })).toThrow(/at least one slice/);
    expect(() => buildBoard({ ...good, trimEnds: 100 })).toThrow(/nothing is left/);
    expect(() => buildBoard({ ...good, flattenPerFace: 100 })).toThrow(/thicker slices/);
    expect(() => checkerboard({ species: ['maple'], columns: 4, rows: 4, cellWidth: 30 })).toThrow(/2 species/);
  });
});
