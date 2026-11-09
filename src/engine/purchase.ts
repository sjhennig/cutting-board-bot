import { planStrips, stripNeeds, type CutPlan, type PlannedBoard, type Shortfall, type StockBoard, type StripNeed } from './cutplan';
import type { Recipe } from './types';
import { EPS } from './units';

/** A board size that can be bought, in any quantity. */
export type BuyableBoard = Omit<StockBoard, 'quantity'>;

export interface PurchaseLine {
  board: BuyableBoard;
  quantity: number;
}

export interface Purchase {
  /** What to buy. */
  lines: PurchaseLine[];
  /** How to cut what is bought. */
  plan: CutPlan;
}

export interface PurchaseOptions {
  kerf: number;
  /** When false, boards that would need planing thinner are not considered. */
  canPlane: boolean;
}

interface Choice {
  lines: PurchaseLine[];
  boards: PlannedBoard[];
  volume: number;
}

const volumeOf = (board: BuyableBoard): number => board.thickness * board.width * board.length;

/** The cheapest single board size, by volume of wood bought, that supplies all of `needs`. */
function bestSingleProduct(needs: StripNeed[], catalog: BuyableBoard[], options: PurchaseOptions): Choice | null {
  let best: Choice | null = null;
  for (const board of catalog) {
    const plan = planStrips(needs, [{ ...board, quantity: needs.length }], options.kerf);
    if (plan.shortfalls.length > 0) continue;
    const planes = plan.boards.some((planned) =>
      planned.segments.some((segment) => segment.strips.some((strip) => strip.planeTo !== undefined)),
    );
    if (planes && !options.canPlane) continue;

    const quantity = plan.boards.length;
    const volume = quantity * volumeOf(board);
    const better =
      best === null ||
      volume < best.volume - EPS ||
      (Math.abs(volume - best.volume) <= EPS && quantity < (best.lines[0]?.quantity ?? Infinity));
    if (better) best = { lines: [{ board, quantity }], boards: plan.boards, volume };
  }
  return best;
}

/**
 * Choose what to buy from a catalog to build a recipe, and how to cut it.
 *
 * For each species it compares buying one board size for everything against buying a
 * size for each strip width, and takes whichever uses less wood. Board sizes that match
 * a strip exactly, such as ready-made blanks, win naturally because nothing is wasted.
 */
export function suggestPurchase(recipe: Recipe, catalog: BuyableBoard[], options: PurchaseOptions): Purchase {
  const needs = stripNeeds(recipe);
  const lines: PurchaseLine[] = [];
  const boards: PlannedBoard[] = [];
  const shortfalls: Shortfall[] = [];

  for (const species of new Set(needs.map((need) => need.species))) {
    const mine = needs.filter((need) => need.species === species);
    const products = catalog.filter((board) => board.species === species);

    const together = bestSingleProduct(mine, products, options);

    const widths = [...new Set(mine.map((need) => need.width))];
    const parts = widths.map((width) =>
      bestSingleProduct(mine.filter((need) => need.width === width), products, options),
    );
    const separate: Choice | null = parts.every((part): part is Choice => part !== null)
      ? {
          lines: parts.flatMap((part) => part.lines),
          boards: parts.flatMap((part) => part.boards),
          volume: parts.reduce((sum, part) => sum + part.volume, 0),
        }
      : null;

    const choice = separate && (!together || separate.volume < together.volume - EPS) ? separate : together;
    if (!choice) {
      for (const need of mine) {
        const existing = shortfalls.find(
          (entry) => entry.panel === need.panel && Math.abs(entry.width - need.width) <= EPS,
        );
        if (existing) existing.count += 1;
        else shortfalls.push({ ...need, count: 1 });
      }
      continue;
    }

    // Number the copies of each board size across the whole purchase.
    for (const line of choice.lines) {
      const existing = lines.find((entry) => entry.board.id === line.board.id);
      const offset = existing?.quantity ?? 0;
      for (const board of choice.boards.filter((planned) => planned.stockId === line.board.id)) {
        boards.push({ ...board, copy: board.copy + offset });
      }
      if (existing) existing.quantity += line.quantity;
      else lines.push({ ...line });
    }
  }

  return { lines, plan: { boards, shortfalls } };
}
