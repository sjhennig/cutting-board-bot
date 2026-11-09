import { describe, expect, it } from 'vitest';
import { woodVaultBoards } from '../data/woodVault';
import { checkerboard, chaotic, defaultShop } from './patterns';
import { suggestPurchase } from './purchase';
import { inch } from './units';

const catalog = woodVaultBoards();
const shop = { ...defaultShop, panelThickness: inch(1.625) };
const summary = (purchase: ReturnType<typeof suggestPurchase>): string[] =>
  purchase.lines.map((line) => `${line.quantity} x ${line.board.id}`).sort();

describe('suggestPurchase', () => {
  it('buys ready-made blanks when they match the strips', () => {
    const recipe = checkerboard({
      species: ['hard-maple', 'black-walnut'],
      columns: 8,
      rows: 8,
      cellWidth: inch(1.25),
      shop,
    });
    const purchase = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: true });
    expect(purchase.plan.shortfalls).toEqual([]);
    expect(summary(purchase)).toEqual([
      '4 x wood-vault/black-walnut/blank/1_625x1_25x24',
      '4 x wood-vault/hard-maple/blank/1_625x1_25x24',
    ]);
  });

  it('buys wider boards when no blank matches, and plans the rips', () => {
    // 1-1/2 in. strips: no blank is that wide. Thick walnut is 1-5/8 in., so nothing needs planing.
    const recipe = checkerboard({
      species: ['cherry', 'black-walnut'],
      columns: 6,
      rows: 8,
      cellWidth: inch(1.5),
      shop,
    });
    const purchase = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: false });
    expect(purchase.plan.shortfalls).toEqual([]);
    expect(summary(purchase)).toEqual([
      '1 x wood-vault/black-walnut/thick/1_625x5_25x24',
      '1 x wood-vault/cherry/thick/1_625x5_25x24',
    ]);
    expect(purchase.plan.boards.map((board) => board.segments[0]!.strips.length)).toEqual([3, 3]);
  });

  it('skips boards that need planing when there is no planer', () => {
    // Thick hard maple is 1-1/2 in.; a 1-3/8 in. panel would need it planed down.
    const thin = { ...defaultShop, panelThickness: inch(1.375) };
    const recipe = checkerboard({
      species: ['hard-maple', 'cherry'],
      columns: 4,
      rows: 4,
      cellWidth: inch(1.5),
      shop: thin,
    });
    const withPlaner = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: true });
    const without = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: false });
    expect(withPlaner.plan.shortfalls).toEqual([]);
    const usesPlaning = (purchase: typeof without): boolean =>
      purchase.plan.boards.some((board) =>
        board.segments.some((segment) => segment.strips.some((strip) => strip.planeTo !== undefined)),
      );
    expect(usesPlaning(without)).toBe(false);
  });

  it('reports strips that nothing in the catalog can supply', () => {
    const recipe = checkerboard({
      species: ['hard-maple', 'unobtainium'],
      columns: 4,
      rows: 4,
      cellWidth: inch(1.25),
      shop,
    });
    const purchase = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: true });
    expect(purchase.plan.shortfalls.map(({ species, count }) => [species, count])).toEqual([['unobtainium', 2]]);
    expect(purchase.lines).toHaveLength(1);
  });

  it('supplies every strip of a design with mixed widths', () => {
    const recipe = chaotic({
      species: ['hard-maple', 'black-walnut', 'cherry'],
      widths: [inch(0.75), inch(1), inch(1.25)],
      boardLength: inch(12),
      rows: 8,
      seed: 5,
      shop,
    });
    const purchase = suggestPurchase(recipe, catalog, { kerf: inch(1 / 8), canPlane: true });
    expect(purchase.plan.shortfalls).toEqual([]);
    const supplied = purchase.plan.boards.reduce(
      (sum, board) => sum + board.segments.reduce((n, segment) => n + segment.strips.length, 0),
      0,
    );
    expect(supplied).toBe(recipe.panels[0]!.strips.length);
    const bought = purchase.lines.reduce((sum, line) => sum + line.quantity, 0);
    expect(bought).toBe(purchase.plan.boards.length);
  });
});
