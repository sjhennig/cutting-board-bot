import { describe, expect, it } from 'vitest';
import { planCuts } from './cutplan';
import { polygonArea } from './geometry';
import { tumblingBlocks } from './tumbling';
import type { Cell, Point } from './types';
import { inch } from './units';

const options = {
  species: ['maple', 'cherry', 'walnut'] as [string, string, string],
  stockThickness: 30,
  columns: 4,
  rows: 5,
  puckThickness: 40,
  kerf: 3,
  endTrim: 12,
  flattenPerFace: 1.5,
};
const result = tumblingBlocks(options);
const side = 30 / Math.sin(Math.PI / 3);
const area = (cells: Cell[]): number => cells.reduce((sum, cell) => sum + polygonArea(cell.points as Point[]), 0);

describe('tumbling blocks', () => {
  it('makes a diamond whose four sides are equal: stock thickness over sin 60', () => {
    expect(result.side).toBeCloseTo(34.641, 3);
    expect(result.acrossFlats).toBe(60);
    // Every diamond of a whole puck has four sides of that length and corners of 60 and 120 degrees.
    const whole = result.layout.find((puck) => !puck.half)!;
    for (const cell of whole.cells) {
      const points = cell.points as Point[];
      points.forEach(([x, y], index) => {
        const [nx, ny] = points[(index + 1) % 4]!;
        expect(Math.hypot(nx - x, ny - y)).toBeCloseTo(side, 6);
      });
      expect(polygonArea(points)).toBeCloseTo(side * 30, 6);
    }
  });

  it('makes each whole puck a regular hexagon of three woods', () => {
    const whole = result.layout.find((puck) => !puck.half)!;
    expect(whole.cells.map((cell) => cell.species)).toEqual(['maple', 'cherry', 'walnut']);
    expect(area(whole.cells)).toBeCloseTo(((3 * Math.sqrt(3)) / 2) * side ** 2, 6);
  });

  it('fills the end of every row with half a puck', () => {
    const halves = result.layout.filter((puck) => puck.half);
    expect(halves).toHaveLength(5);
    for (const puck of halves) expect(area(puck.cells)).toBeCloseTo(((3 * Math.sqrt(3)) / 4) * side ** 2, 6);
    // Five halves come from three pucks, with one half to spare.
    expect(result.pucksToHalve).toBe(3);
    expect(result.pucks).toBe(4 * 5 + 3);
  });

  it('trims to a rectangle with no gaps and no overlaps', () => {
    // Nine half-widths of 30 mm, less the kerf lost sawing pucks in half.
    expect(result.board.length).toBeCloseTo(9 * 30 - 3, 6);
    // Rows are 1.5 sides apart; the points at top and bottom are cut off.
    expect(result.board.width).toBeCloseTo(side * (1.5 * 5 - 0.5), 6);
    expect(area(result.board.cells)).toBeCloseTo(result.board.length * result.board.width, 3);
    for (const cell of result.board.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(-1e-6);
      expect(cell.y).toBeGreaterThanOrEqual(-1e-6);
      expect(cell.x + cell.width).toBeLessThanOrEqual(result.board.length + 1e-6);
      expect(cell.y + cell.height).toBeLessThanOrEqual(result.board.width + 1e-6);
    }
  });

  it('shows each wood in equal measure, give or take the trimmed edges', () => {
    const share = (species: string): number =>
      area(result.board.cells.filter((cell) => cell.species === species)) / (result.board.length * result.board.width);
    for (const species of options.species) expect(Math.abs(share(species) - 1 / 3)).toBeLessThan(0.06);
  });

  it('splits the pucks across identical logs that fit the stock', () => {
    // 23 pucks of 40 mm with 3 mm cuts: a 600 mm board yields 13, so two logs of 12.
    const limited = tumblingBlocks({ ...options, maxLogLength: 600 });
    expect([limited.logs, limited.pucksPerLog]).toEqual([2, 12]);
    expect(limited.logLength).toBeCloseTo(12 * 40 + 11 * 3 + 12, 6);
    expect(limited.recipe.panels).toHaveLength(2);
    expect(limited.recipe.slices).toHaveLength(23);
    expect(result.logs).toBe(1);
  });

  it('accounts for all the wood', () => {
    for (const each of [result, tumblingBlocks({ ...options, maxLogLength: 600 })]) {
      const { supplied, ...parts } = each.board.waste;
      expect(Object.values(parts).reduce((sum, part) => sum + part, 0)).toBeCloseTo(supplied, 3);
      for (const part of Object.values(parts)) expect(part).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('rips the sticks with a tilted blade, wasting the first cut on each board', () => {
    // 3/4 in. boards 5-1/4 in. wide: the sticks are 0.866 in. on the face.
    const real = tumblingBlocks({
      ...options,
      stockThickness: inch(0.75),
      puckThickness: inch(1.625),
      kerf: inch(1 / 8),
      maxLogLength: inch(24),
    });
    const stock = options.species.map((species) => ({
      id: species,
      species,
      thickness: inch(0.75),
      width: inch(5.25),
      length: inch(24),
      quantity: 3,
    }));
    const plan = planCuts(real.recipe, stock);
    expect(plan.shortfalls).toEqual([]);
    const strips = plan.boards.flatMap((board) => board.segments.flatMap((segment) => segment.strips));
    expect(strips).toHaveLength(3 * real.logs);
    expect(strips.every((strip) => strip.bevel === 30 && strip.orientation === 'flat')).toBe(true);
    expect(strips[0]!.ripWidth).toBeCloseTo(inch(0.75) / Math.sin(Math.PI / 3), 6);
  });

  it('refuses fewer than three different woods', () => {
    expect(() => tumblingBlocks({ ...options, species: ['maple', 'maple', 'walnut'] })).toThrow(
      /three different woods/,
    );
  });
});
