import { describe, expect, it } from 'vitest';
import { buildBoard, reRipPlan } from './board';
import { framed, plaid } from './patterns';
import type { BoardResult } from './types';

const shop = { panelThickness: 40, sliceThickness: 42, kerf: 3, endTrim: 12, flattenPerFace: 1.5 };

/** Which wood is at a point on the finished board. */
const at = (board: BoardResult, x: number, y: number): string | undefined =>
  board.cells.find((cell) => x >= cell.x && x < cell.x + cell.width && y >= cell.y && y < cell.y + cell.height)
    ?.species;

const wasteAddsUp = (board: BoardResult): void => {
  const { supplied, ...parts } = board.waste;
  const total = Object.values(parts).reduce((sum, part) => sum + part, 0);
  expect(total).toBeCloseTo(supplied, 3);
};

describe('plaid', () => {
  // Three squares of 30 mm by two rows of 40 mm, divided by 6 mm lines.
  const recipe = plaid({
    species: ['maple', 'walnut', 'cherry'],
    columns: 3,
    rows: 2,
    cellWidth: 30,
    lineWidth: 6,
    shop,
  });
  const board = buildBoard(recipe);

  it('is squares and lines across, rows and lines down', () => {
    expect(board.length).toBeCloseTo(3 * 30 + 2 * 6, 6);
    expect(board.width).toBeCloseTo(2 * 40 + 6, 6);
  });

  it('puts the main wood in the squares, the line wood between, and the third wood at the crossings', () => {
    expect(at(board, 15, 20)).toBe('maple'); // a square
    expect(at(board, 33, 20)).toBe('walnut'); // a line running down
    expect(at(board, 15, 43)).toBe('walnut'); // a line running across
    expect(at(board, 33, 43)).toBe('cherry'); // where they cross
    expect(at(board, 51, 60)).toBe('maple'); // a square in the second row
  });

  it('uses the main wood at the crossings when there are only two woods', () => {
    const two = buildBoard(
      plaid({ species: ['maple', 'walnut'], columns: 3, rows: 2, cellWidth: 30, lineWidth: 6, shop }),
    );
    expect(at(two, 33, 43)).toBe('maple');
  });

  it('cuts all the cross lines from as few slices of the second panel as will hold them', () => {
    const tall = plaid({ species: ['maple', 'walnut'], columns: 3, rows: 6, cellWidth: 30, lineWidth: 6, shop });
    // Five 6 mm pieces with 3 mm cuts between them: 42 mm, so they need two 40 mm slices.
    expect(buildBoard(tall).panels.map((panel) => panel.slicesNeeded)).toEqual([6, 2]);
    expect(reRipPlan(tall.panels[0]!, tall)).toBeNull();
    expect(reRipPlan(tall.panels[1]!, tall)!.map((slice) => slice.widths.length)).toEqual([4, 1]);
  });

  it('needs no second panel for a single row', () => {
    const one = plaid({ species: ['maple', 'walnut'], columns: 3, rows: 1, cellWidth: 30, lineWidth: 6, shop });
    expect(one.panels).toHaveLength(1);
    expect(buildBoard(one).width).toBeCloseTo(40, 6);
  });

  it('accounts for all the wood', () => wasteAddsUp(board));

  it('refuses lines wider than the strips are thick', () => {
    expect(() =>
      plaid({ species: ['maple', 'walnut'], columns: 3, rows: 2, cellWidth: 30, lineWidth: 50, shop }),
    ).toThrow(/narrower than the strips are thick/);
  });
});

describe('framed', () => {
  // A 4 by 3 checkerboard centre of 30 by 40 mm cells, with a 25 mm cherry border.
  const recipe = framed({
    species: ['maple', 'walnut', 'cherry'],
    columns: 4,
    rows: 3,
    cellWidth: 30,
    borderWidth: 25,
    shop,
  });
  const board = buildBoard(recipe);

  it('adds the border to every side', () => {
    expect(board.length).toBeCloseTo(4 * 30 + 2 * 25, 6);
    expect(board.width).toBeCloseTo(3 * 40 + 2 * 25, 6);
  });

  it('has border wood all the way round and a checkerboard inside', () => {
    for (const [x, y] of [
      [5, 5],
      [85, 5],
      [165, 5],
      [5, 85],
      [165, 85],
      [5, 165],
      [85, 165],
      [165, 165],
    ] as const) {
      expect(at(board, x, y), `${x},${y}`).toBe('cherry');
    }
    expect(at(board, 30, 30)).toBe('maple');
    expect(at(board, 60, 30)).toBe('walnut');
    expect(at(board, 30, 70)).toBe('walnut');
    expect(at(board, 60, 70)).toBe('maple');
  });

  it('rips both border pieces from one slice when they fit', () => {
    // 25 + 3 + 25 is more than 40, so each border piece needs its own slice.
    expect(board.panels.map((panel) => panel.slicesNeeded)).toEqual([3, 2]);
    const narrow = framed({ species: ['maple', 'cherry'], columns: 4, rows: 3, cellWidth: 30, borderWidth: 15, shop });
    expect(buildBoard(narrow).panels.map((panel) => panel.slicesNeeded)).toEqual([3, 1]);
  });

  it('makes the centre columns even for a checkerboard, and leaves a plain centre alone', () => {
    const odd = framed({
      species: ['maple', 'walnut', 'cherry'],
      columns: 5,
      rows: 3,
      cellWidth: 30,
      borderWidth: 25,
      shop,
    });
    expect(odd.panels[0]!.strips).toHaveLength(6 + 2);
    const plain = framed({ species: ['maple', 'cherry'], columns: 5, rows: 3, cellWidth: 30, borderWidth: 25, shop });
    expect(plain.panels[0]!.strips).toHaveLength(5 + 2);
    expect(plain.slices.some((slice) => slice.flip)).toBe(false);
    expect(at(buildBoard(plain), 100, 100)).toBe('maple');
  });

  it('uses whole slices for a border as wide as the strips are thick', () => {
    const wide = framed({ species: ['maple', 'cherry'], columns: 4, rows: 3, cellWidth: 30, borderWidth: 60, shop });
    expect(wide.slices.every((slice) => slice.ripTo === undefined)).toBe(true);
    expect(buildBoard(wide).width).toBeCloseTo(5 * 40, 6);
    expect(buildBoard(wide).length).toBeCloseTo(4 * 30 + 2 * 40, 6);
  });

  it('accounts for all the wood', () => wasteAddsUp(board));
});
