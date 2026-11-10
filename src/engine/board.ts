import { boundingBox, clipToRange } from './geometry';
import type { BoardResult, Cell, Panel, PanelReport, Piece, Point, Recipe, SliceSpec } from './types';
import { EPS } from './units';

/** How far the slanted side of a bevelled strip leans over the panel's thickness. */
export const bevelOffset = (panel: Panel): number =>
  panel.bevel ? panel.thickness * Math.tan((panel.bevel * Math.PI) / 180) : 0;

/** Width of the glued panel. A bevelled panel loses one lean, shared between its two square-edged outer strips. */
export const panelWidth = (panel: Panel): number =>
  panel.strips.reduce((sum, strip) => sum + strip.width, 0) - bevelOffset(panel);

/**
 * How many slices of `sliceThickness` a panel of `length` yields.
 * Each slice costs its thickness plus one kerf, except that the last needs no kerf after it.
 */
export function slicesFromLength(length: number, sliceThickness: number, kerf: number, endTrim = 0): number {
  const usable = length - endTrim;
  if (usable < sliceThickness - EPS) return 0;
  return Math.floor((usable + kerf + EPS) / (sliceThickness + kerf));
}

/** Shortest panel that yields `count` slices. The inverse of `slicesFromLength`. */
export function lengthForSlices(count: number, sliceThickness: number, kerf: number, endTrim = 0): number {
  if (count <= 0) return 0;
  return count * sliceThickness + (count - 1) * kerf + endTrim;
}

/**
 * Decide which of `widths` are ripped out of each piece of width `binWidth`, losing one
 * kerf between neighbouring rips. First-fit, widest first. Returns, for each piece used,
 * the positions in `widths` of what is cut from it.
 */
export function packPieces(widths: number[], binWidth: number, kerf: number): number[][] {
  const bins: number[][] = [];
  const remaining: number[] = [];
  const order = widths.map((_, index) => index).sort((a, b) => (widths[b] as number) - (widths[a] as number));
  for (const index of order) {
    const width = widths[index] as number;
    let bin = remaining.findIndex((space) => space >= width - EPS);
    if (bin === -1) {
      bin = bins.length;
      bins.push([]);
      remaining.push(binWidth);
    }
    (bins[bin] as number[]).push(index);
    remaining[bin] = (remaining[bin] as number) - width - kerf;
  }
  return bins;
}

/** How many pieces of width `binWidth` are needed to rip out all of `widths`. */
export const packWidths = (widths: number[], binWidth: number, kerf: number): number =>
  packPieces(widths, binWidth, kerf).length;

const sliceHeight = (slice: SliceSpec, panel: Panel): number => slice.ripTo ?? panel.thickness;

/**
 * Put every slice in its place on the bench, end grain up, before anything is trimmed.
 * Slices fill rows of `recipe.columns` pieces; with one column each slice is a full row.
 */
export function layoutPieces(recipe: Recipe): Piece[] {
  const panelsById = new Map(recipe.panels.map((panel) => [panel.id, panel]));
  const columns = recipe.columns ?? 1;
  const pieces: Piece[] = [];
  let rowTop = 0;
  let rowHeight = 0;
  let x = 0;

  recipe.slices.forEach((slice, index) => {
    const panel = panelsById.get(slice.panel) as Panel;
    const column = index % columns;
    if (column === 0) {
      rowTop += rowHeight;
      rowHeight = 0;
      x = 0;
    }
    const along = panelWidth(panel);
    const across = sliceHeight(slice, panel);
    const turned = slice.turn === true;
    const width = turned ? across : along;
    const height = turned ? along : across;
    if (column > 0 && Math.abs(height - rowHeight) > EPS) {
      throw new Error('Pieces that sit side by side in a row must be the same height.');
    }
    rowHeight = height;

    const left = x + (slice.shift ?? 0);
    const strips = slice.flip && !panel.bevel ? [...panel.strips].reverse() : panel.strips;
    const lean = bevelOffset(panel);
    let offset = 0;
    const cells: Cell[] = [];
    for (const strip of strips) {
      const start = offset;
      offset += strip.width;
      if (!panel.bevel) {
        cells.push(
          turned
            ? { x: left, y: rowTop + start, width: across, height: strip.width, species: strip.species, slice: index }
            : { x: left + start, y: rowTop, width: strip.width, height: across, species: strip.species, slice: index },
        );
        continue;
      }
      // A slanted strip, seen on the end grain: a parallelogram, cut square at the panel's edges.
      let points: Point[] = clipToRange(
        [
          [start - lean, 0],
          [start + strip.width - lean, 0],
          [start + strip.width, across],
          [start, across],
        ],
        0,
        along,
      );
      if (points.length < 3) continue;
      // End for end is a half turn on the bench; turning over mirrors the slant.
      if (slice.flip) points = points.map(([px, py]) => [along - px, across - py]);
      if (slice.over) points = points.map(([px, py]) => [px, across - py]);
      points = points.map(([px, py]) => [px + left, py + rowTop]);
      cells.push({ ...boundingBox(points), species: strip.species, slice: index, points });
    }

    pieces.push({
      slice: index,
      row: Math.floor(index / columns),
      column,
      x: left,
      y: rowTop,
      width,
      height,
      flipped: slice.flip === true,
      turned,
      over: slice.over === true,
      cells,
    });
    x += width;
  });
  return pieces;
}

/** Work out the finished board, the panel requirements and the waste for a recipe. */
export function buildBoard(recipe: Recipe): BoardResult {
  const { cut, slices, flattenPerFace } = recipe;
  const trimEnds = recipe.trimEnds ?? 0;
  validate(recipe);

  const pieces = layoutPieces(recipe);
  const rowCount = (pieces[pieces.length - 1]?.row ?? 0) + 1;
  const rows = Array.from({ length: rowCount }, (_, row) => pieces.filter((piece) => piece.row === row));

  // The board spans only the x range that every row covers; the rest is trimmed off.
  const left = Math.max(...rows.map((row) => row[0]!.x)) + trimEnds;
  const right = Math.min(...rows.map((row) => row[row.length - 1]!.x + row[row.length - 1]!.width)) - trimEnds;
  if (right - left <= EPS) {
    throw new Error('The slices are shifted or trimmed so far that nothing is left of the board.');
  }
  const length = right - left;
  const width = rows.reduce((sum, row) => sum + row[0]!.height, 0);

  const cells: Cell[] = [];
  for (const cell of pieces.flatMap((piece) => piece.cells)) {
    if (cell.points) {
      const points = clipToRange(cell.points, left, right).map(([px, py]): Point => [px - left, py]);
      if (points.length >= 3) cells.push({ ...cell, ...boundingBox(points), points });
      continue;
    }
    const start = Math.max(cell.x, left);
    const end = Math.min(cell.x + cell.width, right);
    if (end - start > EPS) cells.push({ ...cell, x: start - left, width: end - start });
  }

  const panels = recipe.panels.map((panel) => reportPanel(panel, recipe));
  const panelsById = new Map(recipe.panels.map((panel) => [panel.id, panel]));

  // Follow the wood through each step so that every cubic millimetre is accounted for.
  const t = cut.sliceThickness;
  const waste = {
    supplied: 0,
    board: 0,
    endTrim: 0,
    crosscutKerf: 0,
    panelLeftover: 0,
    reRip: 0,
    boardTrim: 0,
    flattening: length * width * 2 * flattenPerFace,
  };
  recipe.panels.forEach((panel, index) => {
    const report = panels[index] as PanelReport;
    const section = report.width * panel.thickness;
    const cutCount = Math.min(report.slicesNeeded, report.slicesAvailable);
    const afterTrim = panel.length - cut.endTrim;
    const kerfLength = Math.max(0, Math.min(cutCount * cut.kerf, afterTrim - cutCount * t));
    const placed = slices.filter((slice) => slice.panel === panel.id);
    const placedArea = placed.reduce((sum, slice) => sum + sliceHeight(slice, panel), 0);

    waste.supplied += section * panel.length;
    waste.endTrim += section * cut.endTrim;
    waste.crosscutKerf += section * kerfLength;
    waste.panelLeftover += section * (afterTrim - cutCount * t - kerfLength);
    waste.reRip += (cutCount * panel.thickness - placedArea) * report.width * t;
  });
  const placedVolume = slices.reduce((sum, slice) => {
    const panel = panelsById.get(slice.panel) as Panel;
    return sum + panelWidth(panel) * sliceHeight(slice, panel) * t;
  }, 0);
  waste.boardTrim = placedVolume - length * width * t;

  const thickness = t - 2 * flattenPerFace;
  waste.board = length * width * thickness;
  return { length, width, thickness, cells, panels, waste };
}

/** How many slices must be crosscut from a panel to supply every piece the design takes from it. */
export function slicesNeededFrom(panel: Panel, recipe: Recipe): number {
  const mine = recipe.slices.filter((slice) => slice.panel === panel.id);
  if (mine.every((slice) => slice.ripTo === undefined)) return mine.length;
  // Several narrow re-ripped pieces can come out of one slice, so pack them.
  return packWidths(
    mine.map((slice) => sliceHeight(slice, panel)),
    panel.thickness,
    recipe.cut.kerf,
  );
}

/** One crosscut slice of a panel, and the narrower pieces it is ripped into. */
export interface SliceRips {
  /** The pieces cut from this slice, widest first, as positions in `Recipe.slices`. */
  pieces: number[];
  /** The width of each piece. */
  widths: number[];
  /** Width of the slice left over once the pieces are cut. */
  offcut: number;
}

/**
 * How each slice of a panel is ripped into narrower pieces, or null when the panel's
 * slices are used whole. Matches `slicesNeededFrom`: one entry for each slice.
 */
export function reRipPlan(panel: Panel, recipe: Recipe): SliceRips[] | null {
  const mine = recipe.slices.flatMap((slice, index) => (slice.panel === panel.id ? [{ slice, index }] : []));
  if (mine.every(({ slice }) => slice.ripTo === undefined)) return null;
  const heights = mine.map(({ slice }) => sliceHeight(slice, panel));
  return packPieces(heights, panel.thickness, recipe.cut.kerf).map((bin) => {
    const widths = bin.map((position) => heights[position] as number);
    const used = widths.reduce((sum, width) => sum + width, 0) + widths.length * recipe.cut.kerf;
    return {
      pieces: bin.map((position) => (mine[position] as { index: number }).index),
      widths,
      offcut: Math.max(0, panel.thickness - used),
    };
  });
}

/** A copy of the recipe with each panel exactly long enough for the slices it must yield. */
export function sizePanels(recipe: Recipe): Recipe {
  const { cut } = recipe;
  return {
    ...recipe,
    panels: recipe.panels.map((panel) => ({
      ...panel,
      length: lengthForSlices(slicesNeededFrom(panel, recipe), cut.sliceThickness, cut.kerf, cut.endTrim),
    })),
  };
}

function reportPanel(panel: Panel, recipe: Recipe): PanelReport {
  const { cut } = recipe;
  const slicesNeeded = slicesNeededFrom(panel, recipe);
  const lengthNeeded = lengthForSlices(slicesNeeded, cut.sliceThickness, cut.kerf, cut.endTrim);

  return {
    id: panel.id,
    width: panelWidth(panel),
    slicesAvailable: slicesFromLength(panel.length, cut.sliceThickness, cut.kerf, cut.endTrim),
    slicesNeeded,
    lengthNeeded,
    leftoverLength: Math.max(0, panel.length - lengthNeeded),
  };
}

function validate(recipe: Recipe): void {
  const { cut, slices, panels } = recipe;
  if (panels.length === 0) throw new Error('A design needs at least one panel.');
  if (slices.length === 0) throw new Error('A design needs at least one slice.');
  if (cut.sliceThickness <= 0) throw new Error('Slice thickness must be greater than zero.');
  if (cut.kerf < 0 || cut.endTrim < 0 || recipe.flattenPerFace < 0) {
    throw new Error('Kerf, end trim and flattening allowance cannot be negative.');
  }
  if (cut.sliceThickness - 2 * recipe.flattenPerFace <= 0) {
    throw new Error('Flattening would remove the whole board. Use thicker slices.');
  }

  const columns = recipe.columns ?? 1;
  if (!Number.isInteger(columns) || columns < 1) throw new Error('Columns must be a whole number of 1 or more.');
  if (columns > 1 && slices.length % columns !== 0) {
    throw new Error('The last row of tiles is incomplete.');
  }

  const ids = new Set<string>();
  for (const panel of panels) {
    if (ids.has(panel.id)) throw new Error(`Two panels are both called "${panel.id}".`);
    ids.add(panel.id);
    if (panel.strips.length === 0) throw new Error(`Panel "${panel.id}" has no strips.`);
    if (panel.thickness <= 0 || panel.length <= 0) {
      throw new Error(`Panel "${panel.id}" needs a thickness and length greater than zero.`);
    }
    if (panel.bevel !== undefined) {
      if (!(panel.bevel > 0 && panel.bevel < 60)) {
        throw new Error(`Panel "${panel.id}" needs a blade tilt between 0 and 60 degrees.`);
      }
      if (panel.strips.some((strip) => strip.width <= bevelOffset(panel))) {
        throw new Error(
          `The strips in panel "${panel.id}" are too narrow for this blade tilt and thickness. Use wider strips, thinner stock or less tilt.`,
        );
      }
    }
    if (panel.strips.some((strip) => strip.width <= 0)) {
      throw new Error(`Every strip in panel "${panel.id}" needs a width greater than zero.`);
    }
  }

  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  slices.forEach((slice, index) => {
    const panel = byId.get(slice.panel);
    if (!panel) throw new Error(`Slice ${index + 1} refers to a panel "${slice.panel}" that does not exist.`);
    if (panel.bevel !== undefined && (slice.ripTo !== undefined || slice.turn)) {
      throw new Error(
        `Slice ${index + 1} is cut from a bevelled panel, so it cannot be re-ripped or turned a quarter turn.`,
      );
    }
    if (slice.ripTo !== undefined && (slice.ripTo <= 0 || slice.ripTo > panel.thickness + EPS)) {
      throw new Error(
        `Slice ${index + 1} cannot be ripped to ${slice.ripTo} mm: panel "${panel.id}" is only ${panel.thickness} mm thick.`,
      );
    }
  });
}
