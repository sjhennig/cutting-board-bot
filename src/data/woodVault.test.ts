import { describe, expect, it } from 'vitest';
import { buildBoard } from '../engine/board';
import { planCuts } from '../engine/cutplan';
import { checkerboard, defaultShop } from '../engine/patterns';
import { inch } from '../engine/units';
import { speciesById } from './species';
import { WOOD_VAULT_LINES, woodVaultBoards } from './woodVault';

const boards = woodVaultBoards();
const find = (species: string, line: string, width: number, listed: number) =>
  boards.find(
    (board) =>
      board.species === species &&
      board.line === line &&
      Math.abs(board.width - inch(width)) < 0.01 &&
      Math.abs(board.listedLength - inch(listed)) < 0.01,
  )!;

describe('Wood Vault catalog', () => {
  it('knows every species it lists', () => {
    for (const line of WOOD_VAULT_LINES) expect(speciesById(line.species), line.species).toBeDefined();
  });

  it('gives every board a unique id', () => {
    expect(new Set(boards.map((board) => board.id)).size).toBe(boards.length);
  });

  it('counts on boards arriving 1/4 in. under the listed length', () => {
    const board = find('cherry', 'thick', 5.25, 36);
    expect(board.length).toBeCloseTo(inch(35.75), 6);
    expect(board.thickness).toBeCloseTo(inch(1.625), 6);
  });

  it('never lists a board longer than ships as standard', () => {
    expect(Math.max(...boards.map((board) => board.listedLength))).toBeCloseTo(inch(47), 6);
  });

  it('builds a checkerboard from blanks with no ripping or planing', () => {
    // Eight 1-1/4 in. blanks, 1-5/8 in. thick, make a 10 in. panel.
    const shop = { ...defaultShop, panelThickness: inch(1.625), sliceThickness: inch(1.5) };
    const recipe = checkerboard({ species: ['hard-maple', 'black-walnut'], columns: 8, rows: 12, cellWidth: inch(1.25), shop });
    const stock = ['hard-maple', 'black-walnut'].map((species) => ({ ...find(species, 'blank', 1.25, 24), quantity: 4 }));

    const board = buildBoard(recipe);
    expect(board.length).toBeCloseTo(inch(10), 6);
    expect(board.width).toBeCloseTo(inch(19.5), 6);
    // 12 slices need 19-7/8 in. of the 23-3/4 in. that can be counted on.
    expect(board.panels[0]!.lengthNeeded).toBeLessThan(stock[0]!.length);

    const plan = planCuts(recipe, stock);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.boards).toHaveLength(8);
    for (const planned of plan.boards) {
      const [strip] = planned.segments[0]!.strips;
      expect(planned.segments[0]!.strips).toHaveLength(1);
      expect(strip!.orientation).toBe('flat');
      expect(strip!.planeTo).toBeUndefined();
      expect(planned.segments[0]!.leftoverWidth).toBe(0);
    }
  });
});

describe('species warnings', () => {
  it('flags unsuitable species once each and passes good ones', async () => {
    const { speciesWarnings } = await import('./species');
    const warnings = speciesWarnings(['hard-maple', 'red-oak', 'limba', 'red-oak', 'black-walnut']);
    expect(warnings.map(({ level, species }) => [level, species])).toEqual([
      ['avoid', 'red-oak'],
      ['caution', 'limba'],
    ]);
    expect(warnings[0]!.message).toBe('Red oak: Large open pores soak up moisture and food.');
  });
});
