import type { BoardResult, Cell, Panel, PanelReport, Recipe, SliceSpec } from './types';
import { EPS } from './units';

export const panelWidth = (panel: Panel): number => panel.strips.reduce((sum, strip) => sum + strip.width, 0);

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
 * How many pieces of width `binWidth` are needed to rip out all of `widths`,
 * losing one kerf between neighbouring rips. First-fit, widest first.
 */
export function packWidths(widths: number[], binWidth: number, kerf: number): number {
  const remaining: number[] = [];
  for (const width of [...widths].sort((a, b) => b - a)) {
    const bin = remaining.findIndex((space) => space >= width - EPS);
    if (bin === -1) {
      remaining.push(binWidth - width - kerf);
    } else {
      remaining[bin] = (remaining[bin] ?? 0) - width - kerf;
    }
  }
  return remaining.length;
}

const sliceHeight = (slice: SliceSpec, panel: Panel): number => slice.ripTo ?? panel.thickness;

/** Work out the finished board, the panel requirements and the waste for a recipe. */
export function buildBoard(recipe: Recipe): BoardResult {
  const { cut, slices, flattenPerFace } = recipe;
  const trimEnds = recipe.trimEnds ?? 0;
  validate(recipe);

  const panelsById = new Map(recipe.panels.map((panel) => [panel.id, panel]));
  const panelOf = (slice: SliceSpec): Panel => panelsById.get(slice.panel) as Panel;

  // The board spans only the x range that every slice covers; the rest is trimmed off.
  const left = Math.max(...slices.map((slice) => slice.shift ?? 0)) + trimEnds;
  const right = Math.min(...slices.map((slice) => (slice.shift ?? 0) + panelWidth(panelOf(slice)))) - trimEnds;
  if (right - left <= EPS) {
    throw new Error('The slices are shifted or trimmed so far that nothing is left of the board.');
  }
  const length = right - left;

  const cells: Cell[] = [];
  let y = 0;
  slices.forEach((slice, index) => {
    const panel = panelOf(slice);
    const height = sliceHeight(slice, panel);
    const strips = slice.flip ? [...panel.strips].reverse() : panel.strips;
    let x = slice.shift ?? 0;
    for (const strip of strips) {
      const start = Math.max(x, left);
      const end = Math.min(x + strip.width, right);
      if (end - start > EPS) {
        cells.push({
          x: start - left,
          y,
          width: end - start,
          height,
          species: strip.species,
          slice: index,
        });
      }
      x += strip.width;
    }
    y += height;
  });
  const width = y;
  const thickness = cut.sliceThickness - 2 * flattenPerFace;

  const panels = recipe.panels.map((panel) => reportPanel(panel, recipe));

  // Follow the wood through each step so that every cubic millimetre is accounted for.
  const t = cut.sliceThickness;
  const waste = {
    supplied: 0,
    board: length * width * thickness,
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
    waste.boardTrim += (report.width - length) * placedArea * t;
  });

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

  const ids = new Set<string>();
  for (const panel of panels) {
    if (ids.has(panel.id)) throw new Error(`Two panels are both called "${panel.id}".`);
    ids.add(panel.id);
    if (panel.strips.length === 0) throw new Error(`Panel "${panel.id}" has no strips.`);
    if (panel.thickness <= 0 || panel.length <= 0) {
      throw new Error(`Panel "${panel.id}" needs a thickness and length greater than zero.`);
    }
    if (panel.strips.some((strip) => strip.width <= 0)) {
      throw new Error(`Every strip in panel "${panel.id}" needs a width greater than zero.`);
    }
  }

  const byId = new Map(panels.map((panel) => [panel.id, panel]));
  slices.forEach((slice, index) => {
    const panel = byId.get(slice.panel);
    if (!panel) throw new Error(`Slice ${index + 1} refers to a panel "${slice.panel}" that does not exist.`);
    if (slice.ripTo !== undefined && (slice.ripTo <= 0 || slice.ripTo > panel.thickness + EPS)) {
      throw new Error(
        `Slice ${index + 1} cannot be ripped to ${slice.ripTo} mm: panel "${panel.id}" is only ${panel.thickness} mm thick.`,
      );
    }
  });
}
