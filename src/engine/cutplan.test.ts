import { describe, expect, it } from 'vitest';
import { buildBoard } from './board';
import { checkDesign } from './checks';
import { planCuts, ripList, type StockBoard } from './cutplan';
import { checkerboard, defaultShop, illusion3d } from './patterns';
import { inch } from './units';

// Wood Vault's thick surfaced boards: maple is 1-1/2 in., walnut 1-5/8 in.
const maple: StockBoard = { id: 'maple-thick', species: 'maple', thickness: inch(1.5), width: inch(5.25), length: inch(24), quantity: 2 };
const walnut: StockBoard = { id: 'walnut-thick', species: 'walnut', thickness: inch(1.625), width: inch(5.25), length: inch(24), quantity: 2 };

const recipe = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 12, cellWidth: inch(1.5) });

describe('planCuts', () => {
  it('rips three 1-1/2 in. strips from each 5-1/4 in. board', () => {
    // Three strips and three 1/8 in. kerfs use 4-7/8 in., leaving 3/8 in.: no room for a fourth.
    const plan = planCuts(recipe, [maple, walnut]);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.boards.map((board) => [board.stockId, board.copy, board.segments[0]!.strips.length])).toEqual([
      ['maple-thick', 1, 3],
      ['maple-thick', 2, 1],
      ['walnut-thick', 1, 3],
      ['walnut-thick', 2, 1],
    ]);
    expect(plan.boards[0]!.segments[0]!.leftoverWidth).toBeCloseTo(inch(0.375), 6);
    // 24 in. board, less a 19-7/8 in. length and one kerf.
    expect(plan.boards[0]!.leftoverLength).toBeCloseTo(inch(4), 6);
  });

  it('flags stock that is thicker than the panel for planing', () => {
    const lines = ripList(planCuts(recipe, [maple, walnut]));
    expect(lines).toEqual([
      { species: 'maple', ripWidth: inch(1.5), length: recipe.panels[0]!.length, count: 4, orientation: 'flat' },
      { species: 'walnut', ripWidth: inch(1.5), length: recipe.panels[0]!.length, count: 4, orientation: 'flat', planeTo: inch(1.5) },
    ]);
  });

  it('reports what is missing when there is not enough stock', () => {
    const plan = planCuts(recipe, [{ ...maple, quantity: 1 }]);
    expect(plan.shortfalls.map(({ species, count }) => [species, count]).sort()).toEqual([
      ['maple', 1],
      ['walnut', 4],
    ]);
  });

  it('rejects boards that are too short for the panel', () => {
    const plan = planCuts(recipe, [{ ...maple, length: inch(12) }, walnut]);
    expect(plan.shortfalls.find((entry) => entry.species === 'maple')?.count).toBe(4);
  });

  it('cuts two panel lengths from one long board', () => {
    const short = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 6, cellWidth: inch(1.5) });
    // Each length is 10-1/8 in.; a 24 in. board gives two.
    const plan = planCuts(short, [{ ...maple, quantity: 1 }, { ...walnut, quantity: 1 }]);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.boards.map((board) => board.segments.length)).toEqual([2, 2]);
  });

  it('stands strips on edge when the stock is thinner than the panel', () => {
    // 3/4 in. boards cannot lie flat in a 1-1/2 in. panel, but ripped to 1-1/2 in. and
    // stood on edge each one becomes a 3/4 in. wide strip.
    const thin = (species: string): StockBoard => ({
      id: `${species}-thin`, species, thickness: inch(0.75), width: inch(5.25), length: inch(24), quantity: 2,
    });
    const fine = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 6, cellWidth: inch(0.75) });
    const plan = planCuts(fine, [thin('maple'), thin('walnut')]);
    expect(plan.shortfalls).toEqual([]);
    const strips = plan.boards.flatMap((board) => board.segments.flatMap((segment) => segment.strips));
    expect(strips).toHaveLength(8);
    for (const strip of strips) {
      expect(strip.orientation).toBe('onEdge');
      expect(strip.ripWidth).toBeCloseTo(inch(1.5), 6);
      expect(strip.planeTo).toBeUndefined();
    }
  });
});

describe('checkDesign', () => {
  const codes = (r: typeof recipe): string[] => checkDesign(r, buildBoard(r)).map((warning) => warning.code);

  it('passes a sound design', () => {
    expect(codes(recipe)).toEqual([]);
  });

  it('flags a panel too short for the slices needed', () => {
    const short = structuredClone(recipe);
    short.panels[0]!.length = inch(12);
    const warnings = checkDesign(short, buildBoard(short));
    expect(warnings[0]).toMatchObject({ level: 'problem', code: 'panel-too-short' });
    expect(warnings[0]!.message).toContain('yields 7 slices but the design needs 12');
  });

  it('flags a thin board', () => {
    const thin = checkerboard({
      species: ['maple', 'walnut'], columns: 8, rows: 12, cellWidth: inch(1.5),
      shop: { ...defaultShop, sliceThickness: inch(1) },
    });
    expect(codes(thin)).toEqual(['thin-board']);
  });

  it('flags the narrow strips and slices of the 3D board', () => {
    expect(codes(illusion3d({ dark: 'walnut', light: 'maple' }))).toEqual(['narrow-strip', 'narrow-slice']);
  });
});
