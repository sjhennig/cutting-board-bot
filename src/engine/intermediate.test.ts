import { describe, expect, it } from 'vitest';
import { bevelOffset, buildBoard, layoutPieces, panelWidth } from './board';
import { planCuts, ripList, type StockBoard } from './cutplan';
import { polygonArea } from './geometry';
import { basketWeave, chevron, defaultShop } from './patterns';
import type { Cell, Recipe } from './types';
import { inch } from './units';

const cellArea = (cell: Cell): number => (cell.points ? polygonArea(cell.points) : cell.width * cell.height);

/** Which wood is at a point on the finished board. Works for slanted cells too. */
function speciesAt(recipe: Recipe, x: number, y: number): string | undefined {
  const inside = (cell: Cell): boolean => {
    if (!cell.points) return x >= cell.x && x < cell.x + cell.width && y >= cell.y && y < cell.y + cell.height;
    // The point is inside a convex polygon if it is on the same side of every edge.
    const signs = cell.points.map(([ax, ay], index) => {
      const [bx, by] = cell.points![(index + 1) % cell.points!.length]!;
      return Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));
    });
    return signs.every((sign) => sign >= 0) || signs.every((sign) => sign <= 0);
  };
  return buildBoard(recipe).cells.find(inside)?.species;
}

function wasteBalances(recipe: Recipe): void {
  const { supplied, ...parts } = buildBoard(recipe).waste;
  const total = Object.values(parts).reduce((sum, part) => sum + part, 0);
  expect(total / supplied).toBeCloseTo(1, 9);
  for (const part of Object.values(parts)) expect(part).toBeGreaterThanOrEqual(-1e-6);
}

describe('basket weave', () => {
  // Hand check: 1-1/2 in. stock makes 1-1/2 in. square tiles of three 1/2 in. strips.
  // 8 by 6 tiles is 12 by 9 in., from 48 slices of one log.
  const recipe = basketWeave({ species: ['hard-maple', 'black-walnut'], columns: 8, rows: 6 });
  const board = buildBoard(recipe);

  it('matches the hand-checked dimensions', () => {
    expect(board.length).toBeCloseTo(inch(12), 6);
    expect(board.width).toBeCloseTo(inch(9), 6);
    expect(board.panels[0]!.slicesNeeded).toBe(48);
    expect(panelWidth(recipe.panels[0]!)).toBeCloseTo(inch(1.5), 6);
    // 48 slices of 1-1/2 in., 47 kerfs of 1/8 in. and 1/2 in. of squaring.
    expect(board.panels[0]!.lengthNeeded).toBeCloseTo(inch(78.375), 6);
  });

  it('makes each tile maple, walnut, maple', () => {
    expect(recipe.panels[0]!.strips.map((strip) => strip.species)).toEqual([
      'hard-maple',
      'black-walnut',
      'hard-maple',
    ]);
  });

  it('turns every other tile a quarter turn', () => {
    const tile = inch(1.5);
    // First tile: strips side by side, so the middle column is walnut top to bottom.
    expect(speciesAt(recipe, tile * 0.5, tile * 0.1)).toBe('black-walnut');
    expect(speciesAt(recipe, tile * 0.1, tile * 0.5)).toBe('hard-maple');
    // Its neighbour is turned: the middle row is walnut left to right.
    expect(speciesAt(recipe, tile * 1.1, tile * 0.5)).toBe('black-walnut');
    expect(speciesAt(recipe, tile * 1.5, tile * 0.1)).toBe('hard-maple');
    // The tile below the first is turned too, checkerboard fashion.
    expect(speciesAt(recipe, tile * 0.1, tile * 1.5)).toBe('black-walnut');
    expect(layoutPieces(recipe).filter((piece) => piece.turned)).toHaveLength(24);
  });

  it('covers the board exactly and accounts for all the wood', () => {
    const area = board.cells.reduce((sum, cell) => sum + cellArea(cell), 0);
    expect(area).toBeCloseTo(board.length * board.width, 3);
    wasteBalances(recipe);
  });

  it('splits the tiles across identical logs when one would be too long', () => {
    // A 24 in. board yields 14 tiles, so 48 tiles need 4 logs of 12.
    const split = basketWeave({ species: ['hard-maple', 'black-walnut'], columns: 8, rows: 6, maxLogLength: inch(24) });
    expect(split.panels.map((panel) => panel.id)).toEqual(['A', 'B', 'C', 'D']);
    expect(new Set(split.panels.map((panel) => panel.length)).size).toBe(1);
    expect(split.panels[0]!.length).toBeCloseTo(inch(19.875), 6);
    const result = buildBoard(split);
    expect(result.panels.map((panel) => panel.slicesNeeded)).toEqual([12, 12, 12, 12]);
    expect(result.cells).toEqual(board.cells);
    wasteBalances(split);

    // 50 tiles do not divide evenly: 4 logs sized for 13, with two spare tiles.
    const uneven = buildBoard(
      basketWeave({ species: ['hard-maple', 'black-walnut'], columns: 10, rows: 5, maxLogLength: inch(24) }),
    );
    expect(uneven.panels.map((panel) => panel.slicesNeeded)).toEqual([13, 13, 13, 11]);
    expect(uneven.panels.map((panel) => panel.slicesAvailable)).toEqual([13, 13, 13, 13]);
  });

  it('rejects a last row that is not full', () => {
    expect(() => buildBoard({ ...recipe, slices: recipe.slices.slice(0, 47) })).toThrow(/incomplete/);
  });
});

describe('chevron', () => {
  // Hand check: 1-1/2 in. stock and a 30 degree tilt lean each strip by 1.5 x tan 30 = 0.866 in.
  // Ten 1-1/2 in. strips make 15 in., less one lean: 14.134 in. Eight slices stack to 12 in.
  const recipe = chevron({ species: ['hard-maple', 'black-walnut'], columns: 10, rows: 8, stripWidth: inch(1.5) });
  const board = buildBoard(recipe);
  const lean = bevelOffset(recipe.panels[0]!);

  it('matches the hand-checked dimensions', () => {
    expect(lean).toBeCloseTo(inch(0.866025), 3);
    expect(board.length).toBeCloseTo(inch(15) - lean, 6);
    expect(board.length).toBeCloseTo(inch(14.134), 1);
    expect(board.width).toBeCloseTo(inch(12), 6);
    expect(board.thickness).toBeCloseTo(inch(1.375), 6);
  });

  it('needs no trimming, because the outer strips keep a square edge', () => {
    expect(board.waste.boardTrim).toBeCloseTo(0, 3);
    wasteBalances(recipe);
  });

  it('covers the board exactly with slanted cells', () => {
    const area = board.cells.reduce((sum, cell) => sum + cellArea(cell), 0);
    expect(area).toBeCloseTo(board.length * board.width, 3);
    expect(board.cells.every((cell) => cell.points !== undefined)).toBe(true);
  });

  it('slants each strip by the lean across a slice', () => {
    const row = inch(1.5);
    // The joint between strips 1 and 2 is at 1-1/2 in. less the lean at the top of the first
    // slice, and at 1-1/2 in. at its bottom.
    const joint = inch(1.5) - lean;
    expect(speciesAt(recipe, joint - 1, 0.5)).toBe('hard-maple');
    expect(speciesAt(recipe, joint + 1, 0.5)).toBe('black-walnut');
    expect(speciesAt(recipe, inch(1.5) - 1, row - 0.5)).toBe('hard-maple');
    expect(speciesAt(recipe, inch(1.5) + 1, row - 0.5)).toBe('black-walnut');
  });

  it('mirrors every other slice, so the bands zigzag and meet at the joints', () => {
    const row = inch(1.5);
    for (const x of [20, 75, 130, 200, 300]) {
      for (const dy of [2, 10, 25]) {
        // Slices 1 and 2 mirror each other about the joint between them, as do 2 and 3.
        expect(speciesAt(recipe, x, row - dy)).toBe(speciesAt(recipe, x, row + dy));
        expect(speciesAt(recipe, x, 2 * row - dy)).toBe(speciesAt(recipe, x, 2 * row + dy));
      }
    }
  });

  it('rejects strips too narrow for the tilt', () => {
    expect(() => buildBoard(chevron({ species: ['a', 'b'], columns: 6, rows: 4, stripWidth: inch(0.5) }))).toThrow(
      /too narrow for this blade tilt/,
    );
  });
});

describe('cutting bevelled strips', () => {
  const recipe = chevron({ species: ['hard-maple', 'black-walnut'], columns: 10, rows: 8, stripWidth: inch(1.5) });
  const stock = (species: string, quantity: number): StockBoard => ({
    id: species,
    species,
    thickness: inch(1.5),
    width: inch(5.25),
    length: inch(24),
    quantity,
  });

  it('allows for the lean and the wider tilted kerf on each board', () => {
    // 5-1/4 in. less a 0.866 in. lean leaves 4.384 in. Each strip takes 1-1/2 in. plus a
    // kerf of 1/8 / cos 30 = 0.144 in. Two fit (3.289 in.); a third would need 4.789 in.
    const plan = planCuts(recipe, [stock('hard-maple', 3), stock('black-walnut', 3)]);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.boards.map((board) => board.segments[0]!.strips.length)).toEqual([2, 2, 1, 2, 2, 1]);
  });

  it('records the blade tilt for the cut list', () => {
    const lines = ripList(planCuts(recipe, [stock('hard-maple', 3), stock('black-walnut', 3)]));
    expect(lines.map((line) => [line.species, line.count, line.bevel])).toEqual([
      ['black-walnut', 5, 30],
      ['hard-maple', 5, 30],
    ]);
  });

  it('will not use a blank the same width as the strip', () => {
    const blank: StockBoard = { ...stock('hard-maple', 9), width: inch(1.5) };
    const plan = planCuts(recipe, [blank, stock('black-walnut', 3)]);
    expect(plan.shortfalls.map((entry) => [entry.species, entry.count])).toEqual([['hard-maple', 5]]);
  });

  it('keeps the shop defaults in step with the test numbers', () => {
    expect(defaultShop.panelThickness).toBeCloseTo(inch(1.5), 6);
  });
});
