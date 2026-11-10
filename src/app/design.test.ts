import { describe, expect, it } from 'vitest';
import { inch, type StockBoard } from '../engine';
import { PATTERNS, biggestBoard, defaultState, makeDesign, suggestedStripThickness, type DesignState } from './design';

const own = (species: string, thickness: number, quantity: number): StockBoard => ({
  id: `${species}-${thickness}`,
  species,
  thickness: inch(thickness),
  width: inch(5.25),
  length: inch(24),
  quantity,
});

const woods = (pattern: { minSpecies: number }): string[] =>
  pattern.minSpecies > 2 ? ['hard-maple', 'cherry', 'black-walnut'] : defaultState.buySpecies;

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

  it.each(PATTERNS)('builds a $name board from catalog woods, with nothing to fix', (pattern) => {
    // Choosing a pattern in the app applies its defaults. Tumbling blocks need a third wood.
    const design = makeDesign({
      ...defaultState,
      ...pattern.defaults,
      pattern: pattern.id,
      buySpecies: woods(pattern),
    });
    expect(design.plan.shortfalls).toEqual([]);
    expect(design.notices.filter((notice) => notice.level === 'problem')).toEqual([]);
    expect(design.board.cells.length).toBeGreaterThan(0);
  });

  it('builds a basket weave from 1/2 in. boards stood on edge, in several logs', () => {
    const pattern = PATTERNS.find((entry) => entry.id === 'basketweave')!;
    const design = makeDesign({ ...defaultState, ...pattern.defaults, pattern: 'basketweave' });
    // 15 by 13 in. in 1-1/2 in. tiles: 10 by 9.
    expect([design.columns, design.rows]).toEqual([10, 9]);
    expect(design.board.length).toBeCloseTo(inch(15), 6);
    expect(design.recipe.panels.length).toBeGreaterThan(1);
    expect(design.rips.every((line) => line.orientation === 'onEdge' && line.planeTo === undefined)).toBe(true);
    expect(design.purchase.every((line) => Math.abs(line.board.thickness - inch(0.5)) < 0.01)).toBe(true);
  });

  it('builds a chevron from 3/4 in. boards with tilted rips', () => {
    const pattern = PATTERNS.find((entry) => entry.id === 'chevron')!;
    const design = makeDesign({ ...defaultState, ...pattern.defaults, pattern: 'chevron' });
    expect(design.rips.every((line) => line.bevel === 30)).toBe(true);
    expect(design.purchase.every((line) => Math.abs(line.board.thickness - inch(0.75)) < 0.01)).toBe(true);
    // 15 strips of 1 in., less one lean of 3/4 x tan 30.
    expect(design.board.length).toBeCloseTo(inch(15) - inch(0.75) * Math.tan(Math.PI / 6), 6);
    expect(design.notices.some((notice) => notice.message.includes('not taken from a published build guide'))).toBe(
      true,
    );
  });

  describe('3D illusion board', () => {
    const pattern = PATTERNS.find((entry) => entry.id === 'illusion3d')!;
    const state: DesignState = { ...defaultState, ...pattern.defaults, pattern: 'illusion3d' };

    it("uses MTM Wood's published sizes exactly when working in millimetres", () => {
      const design = makeDesign({ ...state, unit: 'mm', canPlane: true });
      expect(design.board.length).toBeCloseTo(317, 6);
      expect(design.board.width).toBeCloseTo(317, 6);
      expect(design.recipe.slices.map((slice) => slice.ripTo).slice(0, 11)).toEqual([
        33, 29, 24, 19, 15, 12, 9, 7, 5, 4, 3,
      ]);
      expect(design.recipe.panels.map((panel) => panel.strips[0]!.width)).toEqual([38, 38]);
      expect(design.plan.shortfalls).toEqual([]);
    });

    it('rounds every width to 1/32 in. when working in inches', () => {
      const design = makeDesign(state);
      for (const slice of design.recipe.slices) {
        const parts = slice.ripTo! / inch(1 / 32);
        expect(parts).toBeCloseTo(Math.round(parts), 6);
      }
      expect(design.board.length).toBeCloseTo(design.board.width, 6);
      expect(design.board.length).toBeCloseTo(inch(12.5), 6);
    });

    it('scales the widths to the size asked for', () => {
      const design = makeDesign({ ...state, unit: 'mm', boardLength: 250, canPlane: true });
      expect(Math.abs(design.board.length - 250)).toBeLessThan(6);
      expect(design.board.width).toBeCloseTo(design.board.length, 6);
    });

    it('says what to do when the strips are too thin for the widest piece', () => {
      expect(() => makeDesign({ ...state, stripThickness: inch(0.75) })).toThrow(/Use strips at least 1-5\/16" thick/);
    });

    it('can be bought in millimetres without a planer', () => {
      // The 38 mm maple edge strips come from a 38.1 mm (1-1/2 in.) board stood on edge.
      const design = makeDesign({ ...state, unit: 'mm' });
      expect(design.plan.shortfalls).toEqual([]);
      expect(design.notices.filter((notice) => notice.level === 'problem')).toEqual([]);
    });

    it('says when a planer would shorten the shopping list', () => {
      const without = makeDesign(state);
      const hint = without.notices.find((notice) => notice.message.includes('With a thickness planer'));
      expect(hint?.message).toMatch(/has \d+ boards of 5 kinds.*would be 2 boards of 2 kinds/);
      expect(hint?.message).toContain('strips 1-1/2" thick');
      const withPlaner = makeDesign({ ...state, canPlane: true, stripThickness: inch(1.5) });
      expect(withPlaner.purchase).toHaveLength(2);
      expect(withPlaner.notices.some((notice) => notice.message.includes('With a thickness planer'))).toBe(false);
    });

    it('credits the plan it follows', () => {
      expect(makeDesign(state).notices.some((notice) => notice.message.includes("MTM Wood's published plan"))).toBe(
        true,
      );
    });
  });

  it('builds a plaid from blanks for the squares and ripped strips for the lines', () => {
    const design = makeDesign({ ...defaultState, pattern: 'plaid' });
    // 15 by 13 in.: ten 1-1/4 in. squares and nine 1/4 in. lines; seven 1-5/8 in. rows and six lines.
    expect([design.columns, design.rows]).toEqual([10, 7]);
    expect(design.board.length).toBeCloseTo(inch(10 * 1.25 + 9 * 0.25), 6);
    expect(design.board.width).toBeCloseTo(inch(7 * 1.625 + 6 * 0.25), 6);
    expect(design.recipe.panels).toHaveLength(2);
    expect(design.notices.every((notice) => notice.level === 'caution')).toBe(true);
  });

  it('builds a framed board: a plain centre with two woods, a checkerboard with three', () => {
    const two = makeDesign({ ...defaultState, pattern: 'framed' });
    expect(two.board.length).toBeCloseTo(inch(15), 6);
    expect(two.board.cells[0]!.species).toBe('black-walnut');
    expect(two.recipe.slices.some((slice) => slice.flip)).toBe(false);

    const three = makeDesign({
      ...defaultState,
      pattern: 'framed',
      buySpecies: ['hard-maple', 'black-walnut', 'cherry'],
    });
    expect(three.board.cells[0]!.species).toBe('cherry');
    expect(three.recipe.slices.some((slice) => slice.flip)).toBe(true);
    expect(three.columns % 2).toBe(0);
    expect(three.plan.shortfalls).toEqual([]);
  });

  describe('tumbling blocks', () => {
    const pattern = PATTERNS.find((entry) => entry.id === 'tumbling')!;
    const state: DesignState = {
      ...defaultState,
      ...pattern.defaults,
      pattern: 'tumbling',
      buySpecies: woods(pattern),
    };

    it('needs three woods', () => {
      expect(() => makeDesign({ ...state, buySpecies: defaultState.buySpecies })).toThrow(/needs at least 3 woods/);
    });

    it('makes cubes twice as wide as the boards are thick, from 3/4 in. boards with tilted rips', () => {
      const design = makeDesign(state);
      const { tumbling } = design;
      expect(tumbling!.acrossFlats).toBeCloseTo(inch(1.5), 6);
      // Ten whole 1-1/2 in. pucks and a half, less the saw cut that halves a puck: the nearest to 15 in.
      expect(design.columns).toBe(10);
      expect(design.board.length).toBeCloseTo(inch(10.5 * 1.5 - 1 / 8), 6);
      expect(Math.abs(design.board.width - inch(13))).toBeLessThan(inch(0.75));
      expect(design.rips.every((line) => line.bevel === 30)).toBe(true);
      expect(design.purchase.every((line) => Math.abs(line.board.thickness - inch(0.75)) < 0.01)).toBe(true);
      expect(design.purchase.map((line) => line.board.species).sort()).toEqual([
        'black-walnut',
        'cherry',
        'hard-maple',
      ]);
      expect(design.notices.some((notice) => notice.message.includes('This Old House'))).toBe(true);
    });

    it('makes bigger cubes, and fewer pucks, from thicker boards', () => {
      const thin = makeDesign(state).tumbling!;
      const thick = makeDesign({ ...state, stripThickness: inch(1.5), canPlane: true }).tumbling!;
      expect(thick.pucks).toBeLessThan(thin.pucks / 3);
    });
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

  it("says exactly what is missing from the user's own boards", () => {
    const state: DesignState = {
      ...defaultState,
      woodMode: 'have',
      pattern: 'brick',
      cellWidth: inch(3),
      stripThickness: inch(1.5),
      canPlane: true,
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.625, 2)],
    };
    const problems = makeDesign(state)
      .notices.filter((notice) => notice.level === 'problem')
      .map((notice) => notice.message);
    expect(problems).toEqual([
      'Not enough Hard maple: 1 more strip needed, 3" wide, 1-1/2" thick and 16-1/8" long.',
      'Not enough Black walnut: 1 more strip needed, 3" wide, 1-1/2" thick and 16-1/8" long.',
    ]);
  });

  it('will not plan on planing when there is no planer', () => {
    const state: DesignState = {
      ...defaultState,
      woodMode: 'have',
      cellWidth: inch(1.5),
      stripThickness: inch(1.5),
      boardLength: inch(9),
      canPlane: false,
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.625, 2)],
    };
    expect(makeDesign(state).notices.some((notice) => notice.message.includes('no planer'))).toBe(true);
    expect(makeDesign({ ...state, canPlane: true }).notices).toEqual([]);
  });

  it('warns about unsuitable woods and tight boards', () => {
    const oak = makeDesign({ ...defaultState, buySpecies: ['hard-maple', 'red-oak'], cellWidth: inch(1.5) });
    expect(oak.notices.some((notice) => notice.message.startsWith('Red oak:'))).toBe(true);

    const tight: DesignState = {
      ...defaultState,
      woodMode: 'have',
      cellWidth: inch(1.5),
      stripThickness: inch(1.5),
      boardLength: inch(9),
      boardWidth: inch(19.5),
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.5, 2)],
    };
    // 13 slices need 23 in. of a 24 in. board.
    expect(makeDesign(tight).notices.some((notice) => notice.message.includes('to spare'))).toBe(true);
  });

  it('suggests a strip thickness every chosen wood can supply', () => {
    const state: DesignState = {
      ...defaultState,
      woodMode: 'have',
      stock: [own('hard-maple', 1.5, 1), own('black-walnut', 1.625, 1)],
    };
    expect(suggestedStripThickness(state)).toBeCloseTo(inch(1.5), 6);
    expect(suggestedStripThickness(defaultState)).toBeNull();
  });

  describe('biggestBoard', () => {
    const state: DesignState = {
      ...defaultState,
      woodMode: 'have',
      cellWidth: inch(1.5),
      stripThickness: inch(1.5),
      boardLength: inch(30),
      boardWidth: inch(26),
      stock: [own('hard-maple', 1.5, 2), own('black-walnut', 1.5, 2)],
    };

    it('finds a size the wood can make when the size asked for is too big', () => {
      expect(makeDesign(state).plan.shortfalls.length).toBeGreaterThan(0);
      const size = biggestBoard(state)!;
      const design = makeDesign({ ...state, ...size });
      expect(design.plan.shortfalls).toEqual([]);
      expect(design.notices.filter((notice) => notice.level === 'problem')).toEqual([]);
      // Two boards of each wood give six 1-1/2 in. strips each: twelve columns.
      expect(design.columns).toBe(12);
      expect(size.boardLength).toBeCloseTo(inch(18), 6);
      expect(size.boardLength).toBeCloseTo(design.board.length, 6);
    });

    it('cannot be bettered by asking for a little more', () => {
      const size = biggestBoard(state)!;
      const more = { boardLength: size.boardLength + inch(1.5), boardWidth: size.boardWidth + inch(1.5) };
      const design = makeDesign({ ...state, ...more });
      const fits = design.plan.shortfalls.length === 0 && design.notices.every((notice) => notice.level !== 'problem');
      expect(fits).toBe(false);
    });

    it('grows a small board as well as shrinking a big one', () => {
      const small = { ...state, boardLength: inch(6), boardWidth: inch(5.2) };
      expect(biggestBoard(small)!.boardLength).toBeGreaterThan(inch(12));
    });

    it('has nothing to offer when the wood cannot make the pattern, or is being bought', () => {
      expect(biggestBoard({ ...state, stock: [own('hard-maple', 1.5, 2)] })).toBeNull();
      expect(biggestBoard(defaultState)).toBeNull();
    });
  });
});
