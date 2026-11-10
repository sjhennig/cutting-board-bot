import { lengthForSlices, sizePanels, slicesFromLength } from './board';
import type { Panel, Recipe, SliceSpec, Strip } from './types';
import { inch } from './units';

/** Settings every pattern shares. */
export interface Shop {
  /** Thickness of the strips, and so of the panel. */
  panelThickness: number;
  /** Distance between crosscuts. */
  sliceThickness: number;
  kerf: number;
  endTrim: number;
  flattenPerFace: number;
}

export const defaultShop: Shop = {
  panelThickness: inch(1.5),
  sliceThickness: inch(1.5),
  kerf: inch(1 / 8),
  endTrim: inch(1 / 2),
  flattenPerFace: inch(1 / 16),
};

/** A recipe with one panel, sized to yield exactly the slices it needs. */
function singlePanelRecipe(strips: Strip[], slices: Omit<SliceSpec, 'panel'>[], shop: Shop): Recipe {
  return sizePanels({
    panels: [{ id: 'A', strips, thickness: shop.panelThickness, length: 0 }],
    cut: { sliceThickness: shop.sliceThickness, kerf: shop.kerf, endTrim: shop.endTrim },
    slices: slices.map((slice) => ({ panel: 'A', ...slice })),
    flattenPerFace: shop.flattenPerFace,
  });
}

const times = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

const cycle = (species: string[], index: number): string => species[index % species.length] as string;

function requireSpecies(species: string[], minimum: number, pattern: string): void {
  if (species.length < minimum) {
    throw new Error(`A ${pattern} needs at least ${minimum} species.`);
  }
}

function requireCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a whole number of 1 or more.`);
}

/** Stripes running the full width of the board. Every slice sits the same way round. */
export function stripes(options: { strips: Strip[]; rows: number; shop?: Shop }): Recipe {
  requireCount(options.rows, 'Rows');
  return singlePanelRecipe(
    options.strips,
    times(options.rows, () => ({})),
    options.shop ?? defaultShop,
  );
}

/**
 * Checkerboard. Strips alternate between the species; every other slice is turned end for end.
 * With an odd number of columns a flip changes nothing, so alternate slices are slid over by
 * one cell instead, which needs one extra strip in the panel.
 */
export function checkerboard(options: {
  species: string[];
  columns: number;
  rows: number;
  cellWidth: number;
  shop?: Shop;
}): Recipe {
  const { species, columns, rows, cellWidth } = options;
  requireSpecies(species, 2, 'checkerboard');
  requireCount(columns, 'Columns');
  requireCount(rows, 'Rows');
  const shop = options.shop ?? defaultShop;

  // Flipping only works when the strip order reversed is offset by one species.
  const flipWorks = species.length === 2 && columns % 2 === 0;
  const stripCount = flipWorks ? columns : columns + 1;
  const strips = times(stripCount, (index) => ({ species: cycle(species, index), width: cellWidth }));
  const slices = times(rows, (row) => {
    if (row % 2 === 0) return {};
    return flipWorks ? { flip: true } : { shift: cellWidth };
  });
  return singlePanelRecipe(strips, slices, shop);
}

/**
 * Brick (running bond). Every other slice is slid over by half a brick, and the
 * overhanging half bricks are cut off after glue-up.
 */
export function brick(options: {
  species: string[];
  columns: number;
  rows: number;
  brickWidth: number;
  shop?: Shop;
}): Recipe {
  const { species, columns, rows, brickWidth } = options;
  requireSpecies(species, 1, 'brick pattern');
  requireCount(columns, 'Columns');
  requireCount(rows, 'Rows');

  const strips = times(columns, (index) => ({ species: cycle(species, index), width: brickWidth }));
  const slices = times(rows, (row) => (row % 2 === 0 ? {} : { shift: brickWidth / 2 }));
  return singlePanelRecipe(strips, slices, options.shop ?? defaultShop);
}

/** Small deterministic random number generator, so a seed always gives the same board. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chaotic. Strips of random widths and species, with slices randomly turned end for end.
 * Neighbouring strips never share a species.
 */
export function chaotic(options: {
  species: string[];
  /** Widths to choose from. */
  widths: number[];
  /** The panel is filled until it is at least this wide. */
  boardLength: number;
  rows: number;
  seed: number;
  shop?: Shop;
}): Recipe {
  const { species, widths, boardLength, rows, seed } = options;
  requireSpecies(species, 2, 'chaotic pattern');
  requireCount(rows, 'Rows');
  if (widths.length === 0 || widths.some((width) => width <= 0)) {
    throw new Error('A chaotic pattern needs at least one strip width, all greater than zero.');
  }

  const random = mulberry32(seed);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)] as T;

  const strips: Strip[] = [];
  let total = 0;
  while (total < boardLength) {
    const previous = strips[strips.length - 1]?.species;
    const strip = { species: pick(species.filter((name) => name !== previous)), width: pick(widths) };
    strips.push(strip);
    total += strip.width;
  }
  const slices = times(rows, () => (random() < 0.5 ? {} : { flip: true }));
  return singlePanelRecipe(strips, slices, options.shop ?? defaultShop);
}

/**
 * The step widths of MTM Wood's "3D End Grain Cutting Board #1", edge to centre, in mm.
 * Source: https://mtmwood.com/download/3D1_for_13_planer.pdf
 */
export const MTM_3D_STEPS = [33, 29, 24, 19, 15, 12, 9, 7, 5, 4, 3];

/**
 * 3D illusion board. Rectangles shrink towards the centre in both directions.
 *
 * Two panels are glued from strips whose widths step down to the centre and back out, the
 * second a colour negative of the first. Slices are re-ripped to the same sequence of
 * widths and glued alternately from each panel. The result is square.
 */
export function illusion3d(options: {
  dark: string;
  light: string;
  /** Widths from the edge to the centre. The centre width is used once. */
  steps?: number[];
  /** Extra width on the two edge strips, cut off after glue-up. */
  edgeExtra?: number;
  shop?: Shop;
}): Recipe {
  const steps = options.steps ?? MTM_3D_STEPS;
  const edgeExtra = options.edgeExtra ?? 5;
  const shop = options.shop ?? { ...defaultShop, panelThickness: 48, sliceThickness: 42, kerf: 3 };
  if (steps.length < 2) throw new Error('A 3D illusion board needs at least two step widths.');
  if (shop.panelThickness < Math.max(...steps)) {
    throw new Error('The panel must be at least as thick as the widest step.');
  }

  // Edge to centre, then back out: 33, 29, ... 4, 3, 4, ... 29, 33.
  const sequence = [...steps, ...steps.slice(0, -1).reverse()];
  const last = sequence.length - 1;
  const stripsFor = (first: string, second: string): Strip[] =>
    sequence.map((width, index) => ({
      species: index % 2 === 0 ? first : second,
      width: index === 0 || index === last ? width + edgeExtra : width,
    }));

  const slices: SliceSpec[] = sequence.map((width, index) => ({
    panel: index % 2 === 0 ? 'A' : 'B',
    ripTo: width,
  }));
  const cut = { sliceThickness: shop.sliceThickness, kerf: shop.kerf, endTrim: shop.endTrim };
  const makePanel = (id: string, first: string, second: string): Panel => ({
    id,
    strips: stripsFor(first, second),
    thickness: shop.panelThickness,
    length: 0,
  });

  return sizePanels({
    panels: [makePanel('A', options.dark, options.light), makePanel('B', options.light, options.dark)],
    cut,
    slices,
    flattenPerFace: shop.flattenPerFace,
    trimEnds: edgeExtra,
  });
}

/**
 * Basket weave. Square tiles, each made of a few strips, laid in a grid with every other
 * tile turned a quarter turn. The tiles are slices of one square-section log, so the
 * strips together must be exactly as wide as the stock is thick.
 */
export function basketWeave(options: {
  /** The outer wood of each tile, then the inner wood. */
  species: string[];
  columns: number;
  rows: number;
  /** How many strips make one tile. */
  stripsPerTile?: number;
  /**
   * The longest log that can be made, usually the length of the longest board. The tiles
   * are split across as many identical logs as that needs.
   */
  maxLogLength?: number;
  shop?: Shop;
}): Recipe {
  const { species, columns, rows } = options;
  const stripsPerTile = options.stripsPerTile ?? 3;
  requireSpecies(species, 2, 'basket weave');
  requireCount(columns, 'Columns');
  requireCount(rows, 'Rows');
  if (!Number.isInteger(stripsPerTile) || stripsPerTile < 2) {
    throw new Error('A basket weave tile needs at least 2 strips.');
  }
  const shop = options.shop ?? defaultShop;

  const tile = shop.panelThickness;
  const strips = times(stripsPerTile, (index) => ({
    species: (index === 0 || index === stripsPerTile - 1 ? species[0] : species[1]) as string,
    width: tile / stripsPerTile,
  }));
  const total = columns * rows;
  const { sliceThickness, kerf, endTrim } = shop;
  const fits =
    options.maxLogLength === undefined ? total : slicesFromLength(options.maxLogLength, sliceThickness, kerf, endTrim);
  if (fits < 1) throw new Error('The longest board is too short to cut even one tile from.');
  const logs = Math.ceil(total / fits);
  const perLog = Math.ceil(total / logs);

  return {
    // Every log is the same length, so they can be glued up and sliced identically.
    panels: times(logs, (log) => ({
      id: String.fromCharCode(65 + log),
      strips,
      thickness: tile,
      length: lengthForSlices(perLog, sliceThickness, kerf, endTrim),
    })),
    cut: { sliceThickness, kerf, endTrim },
    slices: times(total, (index) => {
      const row = Math.floor(index / columns);
      const panel = String.fromCharCode(65 + Math.floor(index / perLog));
      return (row + (index % columns)) % 2 === 1 ? { panel, turn: true } : { panel };
    }),
    flattenPerFace: shop.flattenPerFace,
    columns,
  };
}

/**
 * Chevron. Strips are ripped with a tilted blade, so on the end grain each one shows as a
 * slanted band. Every other slice is turned upside down, which mirrors the slant and
 * makes a zigzag. The two outer strips keep one square edge, so nothing is trimmed.
 */
export function chevron(options: {
  species: string[];
  columns: number;
  rows: number;
  /** Strip width, measured along the face of the board. */
  stripWidth: number;
  /** Blade tilt from vertical, in degrees. */
  bevel?: number;
  shop?: Shop;
}): Recipe {
  const { species, columns, rows, stripWidth } = options;
  requireSpecies(species, 2, 'chevron');
  requireCount(columns, 'Columns');
  requireCount(rows, 'Rows');
  const shop = options.shop ?? defaultShop;

  const strips = times(columns, (index) => ({ species: cycle(species, index), width: stripWidth }));
  const slices = times(rows, (row) => (row % 2 === 0 ? {} : { over: true }));
  const recipe = singlePanelRecipe(strips, slices, shop);
  return sizePanels({
    ...recipe,
    panels: recipe.panels.map((panel) => ({ ...panel, bevel: options.bevel ?? 30 })),
  });
}

/**
 * Plaid. Squares of one wood divided by thin lines of another, running both ways.
 *
 * Panel A has wide strips of the main wood with thin line strips between them; its slices
 * are the rows of squares. Panel B has the same widths in the line wood, with thin strips
 * of the crossing wood; its slices are re-ripped to the line width and laid between the rows.
 */
export function plaid(options: {
  /** The squares, then the lines, then the small squares where lines cross (the main wood if not given). */
  species: string[];
  columns: number;
  rows: number;
  cellWidth: number;
  /** Width of the thin lines, in both directions. */
  lineWidth: number;
  shop?: Shop;
}): Recipe {
  const { species, columns, rows, cellWidth, lineWidth } = options;
  requireSpecies(species, 2, 'plaid');
  requireCount(columns, 'Columns');
  requireCount(rows, 'Rows');
  const shop = options.shop ?? defaultShop;
  if (lineWidth <= 0 || lineWidth > shop.panelThickness) {
    throw new Error('The lines of a plaid must be narrower than the strips are thick.');
  }
  const [main, line, crossing = main] = species as [string, string, string?];

  const stripsFor = (wide: string, thin: string): Strip[] =>
    times(2 * columns - 1, (index) =>
      index % 2 === 0 ? { species: wide, width: cellWidth } : { species: thin, width: lineWidth },
    );
  const slices: SliceSpec[] = times(2 * rows - 1, (index) =>
    index % 2 === 0 ? { panel: 'A' } : { panel: 'B', ripTo: lineWidth },
  );
  const panels: Panel[] = [{ id: 'A', strips: stripsFor(main, line), thickness: shop.panelThickness, length: 0 }];
  // A board one row deep has no lines across it, and so no second panel.
  if (rows > 1) panels.push({ id: 'B', strips: stripsFor(line, crossing), thickness: shop.panelThickness, length: 0 });

  return sizePanels({
    panels,
    cut: { sliceThickness: shop.sliceThickness, kerf: shop.kerf, endTrim: shop.endTrim },
    slices,
    flattenPerFace: shop.flattenPerFace,
  });
}

/**
 * Framed. A centre field with a border of another wood, all of it end grain.
 *
 * Panel A is the centre strips with a border strip at each side. Panel B is border wood
 * right across; one piece of it goes at the top and one at the bottom, re-ripped to the
 * border width when that is less than the strip thickness.
 */
export function framed(options: {
  /** The centre woods, then the border wood last. Two centre woods make a checkerboard. */
  species: string[];
  /** Columns in the centre. Made even when the centre is a checkerboard. */
  columns: number;
  /** Rows in the centre. */
  rows: number;
  cellWidth: number;
  borderWidth: number;
  shop?: Shop;
}): Recipe {
  const { species, rows, cellWidth } = options;
  requireSpecies(species, 2, 'framed board');
  requireCount(options.columns, 'Columns');
  requireCount(rows, 'Rows');
  const shop = options.shop ?? defaultShop;
  const borderWidth = Math.min(options.borderWidth, shop.panelThickness);
  if (borderWidth <= 0) throw new Error('The border needs a width greater than zero.');

  const border = species[species.length - 1] as string;
  const centre = species.slice(0, -1).slice(0, 2);
  const checker = centre.length === 2;
  // Turning a slice end for end only swaps the squares when there is an even number of them.
  const columns = checker ? Math.max(2, options.columns + (options.columns % 2)) : options.columns;

  const edge: Strip = { species: border, width: borderWidth };
  const middle = times(columns, (index) => ({ species: cycle(centre, index), width: cellWidth }));
  const whole = borderWidth > shop.panelThickness - 0.01;
  const cap: SliceSpec = whole ? { panel: 'B' } : { panel: 'B', ripTo: borderWidth };

  return sizePanels({
    panels: [
      { id: 'A', strips: [edge, ...middle, edge], thickness: shop.panelThickness, length: 0 },
      {
        id: 'B',
        strips: [edge, ...middle.map((strip) => ({ ...strip, species: border })), edge],
        thickness: shop.panelThickness,
        length: 0,
      },
    ],
    cut: { sliceThickness: shop.sliceThickness, kerf: shop.kerf, endTrim: shop.endTrim },
    slices: [
      cap,
      ...times(rows, (row): SliceSpec => (checker && row % 2 === 1 ? { panel: 'A', flip: true } : { panel: 'A' })),
      cap,
    ],
    flattenPerFace: shop.flattenPerFace,
  });
}
