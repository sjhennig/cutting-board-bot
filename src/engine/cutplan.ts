import { bevelOffset } from './board';
import type { Recipe } from './types';
import { EPS } from './units';

/** A kind of board the user owns or can buy. */
export interface StockBoard {
  id: string;
  species: string;
  thickness: number;
  width: number;
  length: number;
  quantity: number;
}

/** A strip the design needs: one piece of one panel. */
export interface StripNeed {
  panel: string;
  species: string;
  /** Width across the panel. */
  width: number;
  /** Panel thickness. */
  thickness: number;
  /** Panel length. */
  length: number;
  /** Blade tilt from vertical, in degrees, when the strip has slanted sides. */
  bevel?: number;
}

export interface PlannedStrip extends StripNeed {
  /** Fence setting for the rip cut. */
  ripWidth: number;
  /**
   * `flat`: the stock's thickness becomes the panel's thickness.
   * `onEdge`: the strip is ripped to the panel's thickness and stood on edge, so the
   * stock's thickness becomes the strip's width in the panel.
   */
  orientation: 'flat' | 'onEdge';
  /** Set when the stock is thicker than needed and must be planed down to this first. */
  planeTo?: number;
}

/** A length crosscut from a stock board, then ripped into strips. */
export interface PlannedSegment {
  length: number;
  strips: PlannedStrip[];
  /** Width of the offcut left after ripping. */
  leftoverWidth: number;
}

export interface PlannedBoard {
  stockId: string;
  species: string;
  /** Which of the `quantity` identical boards this is, from 1. */
  copy: number;
  segments: PlannedSegment[];
  leftoverLength: number;
}

export interface Shortfall extends StripNeed {
  count: number;
}

export interface CutPlan {
  boards: PlannedBoard[];
  /** Strips no stock board could supply. Empty when the design fits the stock. */
  shortfalls: Shortfall[];
}

/** Every strip the recipe's panels are made of. */
export function stripNeeds(recipe: Recipe): StripNeed[] {
  return recipe.panels.flatMap((panel) =>
    panel.strips.map((strip) => ({
      panel: panel.id,
      species: strip.species,
      width: strip.width,
      thickness: panel.thickness,
      length: panel.length,
      ...(panel.bevel ? { bevel: panel.bevel } : {}),
    })),
  );
}

interface OpenSegment {
  board: PlannedBoard;
  stock: StockBoard;
  segment: PlannedSegment;
  remainingWidth: number;
  /** Blade tilt the segment is being ripped at; 0 for square cuts. */
  bevel: number;
}

interface Fit {
  ripWidth: number;
  orientation: 'flat' | 'onEdge';
  planeTo?: number;
}

/** How far a slanted strip leans over its thickness. */
const leanOf = (need: StripNeed): number =>
  bevelOffset({ id: need.panel, strips: [], thickness: need.thickness, length: need.length, bevel: need.bevel });

/** A tilted blade removes a wider strip of the board's face than a square one. */
const kerfFor = (need: StripNeed, kerf: number): number =>
  need.bevel ? kerf / Math.cos((need.bevel * Math.PI) / 180) : kerf;

/** How a strip could be cut from a stock board, or null if it cannot. */
function fitStrip(need: StripNeed, stock: StockBoard): Fit | null {
  if (stock.species !== need.species || stock.length < need.length - EPS) return null;

  if (need.bevel) {
    // Slanted strips lie flat, and the first cut on each board wastes one lean of width.
    if (stock.thickness < need.thickness - EPS || stock.width < need.width + leanOf(need) - EPS) return null;
    const fit: Fit = { ripWidth: need.width, orientation: 'flat' };
    if (stock.thickness > need.thickness + EPS) fit.planeTo = need.thickness;
    return fit;
  }

  const fits: Fit[] = [];
  if (stock.thickness >= need.thickness - EPS) {
    const fit: Fit = { ripWidth: need.width, orientation: 'flat' };
    if (stock.thickness > need.thickness + EPS) fit.planeTo = need.thickness;
    fits.push(fit);
  }
  if (stock.thickness >= need.width - EPS) {
    const fit: Fit = { ripWidth: need.thickness, orientation: 'onEdge' };
    if (stock.thickness > need.width + EPS) fit.planeTo = need.width;
    fits.push(fit);
  }
  // Prefer no planing, then the simpler flat orientation.
  fits.sort(
    (a, b) =>
      Number(a.planeTo !== undefined) - Number(b.planeTo !== undefined) ||
      Number(a.orientation === 'onEdge') - Number(b.orientation === 'onEdge'),
  );
  return fits.find((fit) => fit.ripWidth <= stock.width + EPS) ?? null;
}

/**
 * Decide which stock board each strip is cut from.
 *
 * Widest strips are placed first. Each goes into a length already cut for the same panel
 * length if it fits; otherwise a new length is crosscut from a board with enough left.
 * This is a good plan, not a guaranteed optimum.
 */
export function planCuts(recipe: Recipe, stock: StockBoard[], kerf = recipe.cut.kerf): CutPlan {
  return planStrips(stripNeeds(recipe), stock, kerf);
}

/** As `planCuts`, for any list of strips. */
export function planStrips(allNeeds: StripNeed[], stock: StockBoard[], kerf: number): CutPlan {
  const boards: PlannedBoard[] = stock.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      stockId: item.id,
      species: item.species,
      copy: index + 1,
      segments: [],
      leftoverLength: item.length,
    })),
  );
  const stockById = new Map(stock.map((item) => [item.id, item]));
  const open: OpenSegment[] = [];
  const shortfalls: Shortfall[] = [];

  const needs = [...allNeeds].sort((a, b) => b.width - a.width);
  for (const need of needs) {
    const place = (target: OpenSegment, fit: Fit): void => {
      target.segment.strips.push({ ...need, ...fit });
      target.remainingWidth -= fit.ripWidth + kerfFor(need, kerf);
      target.segment.leftoverWidth = Math.max(0, target.remainingWidth);
    };

    // 1. A length already cut, with room left.
    let placed = false;
    for (const target of open) {
      const fit = fitStrip(need, target.stock);
      const sameLength = Math.abs(target.segment.length - need.length) <= EPS;
      const sameTilt = target.bevel === (need.bevel ?? 0);
      if (fit && sameLength && sameTilt && target.remainingWidth >= fit.ripWidth - EPS) {
        place(target, fit);
        placed = true;
        break;
      }
    }
    if (placed) continue;

    // 2. A new length from a board that still has enough.
    for (const board of boards) {
      const item = stockById.get(board.stockId) as StockBoard;
      const fit = fitStrip(need, item);
      if (!fit || board.leftoverLength < need.length - EPS) continue;
      const segment: PlannedSegment = { length: need.length, strips: [], leftoverWidth: item.width };
      board.segments.push(segment);
      board.leftoverLength = Math.max(0, board.leftoverLength - need.length - kerf);
      const target: OpenSegment = {
        board,
        stock: item,
        segment,
        remainingWidth: item.width - (need.bevel ? leanOf(need) : 0),
        bevel: need.bevel ?? 0,
      };
      open.push(target);
      place(target, fit);
      placed = true;
      break;
    }
    if (placed) continue;

    const existing = shortfalls.find(
      (entry) =>
        entry.panel === need.panel && entry.species === need.species && Math.abs(entry.width - need.width) <= EPS,
    );
    if (existing) existing.count += 1;
    else shortfalls.push({ ...need, count: 1 });
  }

  return { boards: boards.filter((board) => board.segments.length > 0), shortfalls };
}

export interface RipLine {
  species: string;
  ripWidth: number;
  length: number;
  count: number;
  orientation: 'flat' | 'onEdge';
  planeTo?: number;
  /** Blade tilt from vertical, in degrees. */
  bevel?: number;
}

/** The rip cuts in a plan, with identical cuts grouped so the fence is set once for each. */
export function ripList(plan: CutPlan): RipLine[] {
  const lines: RipLine[] = [];
  for (const board of plan.boards) {
    for (const segment of board.segments) {
      for (const strip of segment.strips) {
        const line = lines.find(
          (entry) =>
            entry.species === strip.species &&
            entry.orientation === strip.orientation &&
            entry.planeTo === strip.planeTo &&
            entry.bevel === strip.bevel &&
            Math.abs(entry.ripWidth - strip.ripWidth) <= EPS &&
            Math.abs(entry.length - segment.length) <= EPS,
        );
        if (line) line.count += 1;
        else {
          lines.push({
            species: strip.species,
            ripWidth: strip.ripWidth,
            length: segment.length,
            count: 1,
            orientation: strip.orientation,
            ...(strip.bevel !== undefined ? { bevel: strip.bevel } : {}),
            ...(strip.planeTo !== undefined ? { planeTo: strip.planeTo } : {}),
          });
        }
      }
    }
  }
  return lines.sort((a, b) => a.species.localeCompare(b.species) || b.ripWidth - a.ripWidth);
}
