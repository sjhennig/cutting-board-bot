import { lengthForSlices, slicesFromLength } from './board';
import { boundingBox, clip, polygonArea } from './geometry';
import type { BoardResult, Cell, PanelReport, Point, Recipe } from './types';

/**
 * Tumbling blocks: a board that looks like a stack of cubes.
 *
 * The method follows two published builds that agree with each other:
 *   This Old House, "How To Make a 3D Cube Cutting Board"
 *     https://www.thisoldhouse.com/kitchens/how-to-make-cube-cutting-board
 *   LumberJocks, jfk4032, "Tumbling block cutting board techniques, lessons learned and tips"
 *     https://www.lumberjocks.com/threads/tumbling-block-cutting-board-techniques-lessons-learned-and-tips-for-cutting-and-assembly.347458/
 *
 * 1. Rip sticks with a diamond (60/120 degree rhombus) cross-section from boards of one
 *    thickness, with the blade tilted 30 degrees from upright (60 degrees from the table).
 * 2. Glue one stick of each of three woods into a six-sided log.
 * 3. Crosscut each log into six-sided pieces, called pucks here.
 * 4. Lay the pucks end grain up like a honeycomb, all turned the same way, with pucks cut
 *    in half filling the ends of the rows. Glue, flatten and trim square.
 *
 * Neither guide gives the size of the diamond. It follows from the geometry: all four sides
 * are equal, and two of them are the faces of the board, so the side is the board's
 * thickness divided by sin 60.
 */

/** Blade tilt from upright for the diamond sticks, in degrees. */
export const TUMBLING_TILT = 30;

const SIN60 = Math.sin(Math.PI / 3);

export interface TumblingOptions {
  /** The top of each cube, then its left face, then its right face. */
  species: [string, string, string];
  /** Thickness of the boards the sticks are ripped from. */
  stockThickness: number;
  /** Whole pucks in each row. */
  columns: number;
  rows: number;
  /** Thickness of each puck, before flattening. */
  puckThickness: number;
  kerf: number;
  endTrim: number;
  flattenPerFace: number;
  /** The longest log that can be made, usually the length of the longest board. */
  maxLogLength?: number;
}

/** One puck, or half of one, in its place on the bench before the board is trimmed. */
export interface Puck {
  row: number;
  half: boolean;
  /** The three diamonds of the puck (two and a bit of them for a half). */
  cells: Cell[];
}

export interface TumblingResult {
  /** Length of each side of the diamond, and of the six-sided log. */
  side: number;
  /** Width of a puck across its flat sides: twice the stock thickness. */
  acrossFlats: number;
  columns: number;
  rows: number;
  /** Pucks to cut, including those that are cut in half. */
  pucks: number;
  /** How many of the pucks are cut in half to fill the ends of the rows. */
  pucksToHalve: number;
  logs: number;
  pucksPerLog: number;
  logLength: number;
  /** The logs as a recipe, so the cut planner and the shopping list can treat them as panels. */
  recipe: Recipe;
  board: BoardResult;
  layout: Puck[];
  /** The rectangle the glued-up pucks are trimmed to, in the coordinates of `layout`. */
  trim: { left: number; right: number; top: number; bottom: number };
}

/** The three diamonds of a puck centred at (cx, cy), point up. */
function puckCells(cx: number, cy: number, side: number, half: number, species: string[], index: number): Cell[] {
  const centre: Point = [cx, cy];
  const top: Point = [cx, cy - side];
  const bottom: Point = [cx, cy + side];
  const upperLeft: Point = [cx - half, cy - side / 2];
  const lowerLeft: Point = [cx - half, cy + side / 2];
  const upperRight: Point = [cx + half, cy - side / 2];
  const lowerRight: Point = [cx + half, cy + side / 2];
  const diamonds: Point[][] = [
    [centre, upperLeft, top, upperRight],
    [centre, bottom, lowerLeft, upperLeft],
    [centre, upperRight, lowerRight, bottom],
  ];
  return diamonds.map((points, face) => ({
    ...boundingBox(points),
    species: species[face] as string,
    slice: index,
    points,
  }));
}

const clipCells = (cells: Cell[], a: number, b: number, c: number): Cell[] =>
  cells.flatMap((cell) => {
    const points = clip(cell.points as Point[], a, b, c);
    return points.length >= 3 && polygonArea(points) > 1e-6 ? [{ ...cell, ...boundingBox(points), points }] : [];
  });

export function tumblingBlocks(options: TumblingOptions): TumblingResult {
  const { species, stockThickness, columns, rows, puckThickness, kerf, endTrim, flattenPerFace } = options;
  if (new Set(species).size < 3) throw new Error('Tumbling blocks need three different woods.');
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1) {
    throw new Error('Columns and rows must be whole numbers of 1 or more.');
  }
  if (stockThickness <= 0 || puckThickness <= 0) throw new Error('Sizes must be greater than zero.');
  if (puckThickness - 2 * flattenPerFace <= 0) {
    throw new Error('Flattening would remove the whole board. Use thicker pucks.');
  }

  const half = stockThickness;
  const side = stockThickness / SIN60;

  // Rows of point-up pucks. Every other row starts half a puck over, and a half puck fills
  // the gap that leaves, so all rows are the same length.
  const layout: Puck[] = [];
  const rowLength = (2 * columns + 1) * half;
  let index = 0;
  for (let row = 0; row < rows; row += 1) {
    const cy = side + 1.5 * side * row;
    const shifted = row % 2 === 1;
    if (shifted) {
      layout.push({ row, half: true, cells: clipCells(puckCells(0, cy, side, half, species, index), -1, 0, 0) });
      index += 1;
    }
    for (let column = 0; column < columns; column += 1) {
      const cx = (shifted ? 2 : 1) * half + 2 * half * column;
      layout.push({ row, half: false, cells: puckCells(cx, cy, side, half, species, index) });
      index += 1;
    }
    if (!shifted) {
      layout.push({
        row,
        half: true,
        cells: clipCells(puckCells(rowLength, cy, side, half, species, index), 1, 0, rowLength),
      });
      index += 1;
    }
  }

  // Sawing a puck in half loses half a kerf from each half, so the row ends are trimmed by
  // that much. The points along the top and bottom rows are trimmed off.
  const trim = { left: kerf / 2, right: rowLength - kerf / 2, top: side / 2, bottom: 1.5 * side * rows };
  const length = trim.right - trim.left;
  const width = trim.bottom - trim.top;
  let cells = layout.flatMap((puck) => puck.cells);
  cells = clipCells(cells, -1, 0, -trim.left);
  cells = clipCells(cells, 1, 0, trim.right);
  cells = clipCells(cells, 0, -1, -trim.top);
  cells = clipCells(cells, 0, 1, trim.bottom);
  cells = cells.map((cell) => {
    const points = (cell.points as Point[]).map(([x, y]): Point => [x - trim.left, y - trim.top]);
    return { ...cell, ...boundingBox(points), points };
  });

  const pucksToHalve = Math.ceil(rows / 2);
  const pucks = columns * rows + pucksToHalve;
  const fits =
    options.maxLogLength === undefined ? pucks : slicesFromLength(options.maxLogLength, puckThickness, kerf, endTrim);
  if (fits < 1) throw new Error('The longest board is too short to cut even one puck from.');
  const logs = Math.ceil(pucks / fits);
  const pucksPerLog = Math.ceil(pucks / logs);
  const logLength = lengthForSlices(pucksPerLog, puckThickness, kerf, endTrim);

  const recipe: Recipe = {
    panels: Array.from({ length: logs }, (_, log) => ({
      id: String.fromCharCode(65 + (log % 26)) + (log >= 26 ? String(Math.floor(log / 26)) : ''),
      strips: species.map((name) => ({ species: name, width: side })),
      thickness: stockThickness,
      length: logLength,
      bevel: TUMBLING_TILT,
    })),
    cut: { sliceThickness: puckThickness, kerf, endTrim },
    slices: Array.from({ length: pucks }, (_, puck) => {
      const log = Math.floor(puck / pucksPerLog);
      return { panel: String.fromCharCode(65 + (log % 26)) + (log >= 26 ? String(Math.floor(log / 26)) : '') };
    }),
    flattenPerFace,
  };

  // Where the wood goes. A log's cross-section is three diamonds, each `side` by `stockThickness`.
  const section = 3 * side * stockThickness;
  const thickness = puckThickness - 2 * flattenPerFace;
  const supplied = logs * section * logLength;
  const cut = logs * pucksPerLog;
  const waste = {
    supplied,
    board: length * width * thickness,
    endTrim: logs * section * endTrim,
    crosscutKerf: logs * section * (pucksPerLog - 1) * kerf,
    panelLeftover: (cut - pucks) * section * puckThickness,
    reRip: 0,
    boardTrim: pucks * section * puckThickness - length * width * puckThickness,
    flattening: length * width * 2 * flattenPerFace,
  };
  const panels: PanelReport[] = recipe.panels.map((panel) => ({
    id: panel.id,
    width: 2 * half,
    slicesAvailable: pucksPerLog,
    slicesNeeded: recipe.slices.filter((slice) => slice.panel === panel.id).length,
    lengthNeeded: logLength,
    leftoverLength: 0,
  }));

  return {
    side,
    acrossFlats: 2 * half,
    columns,
    rows,
    pucks,
    pucksToHalve,
    logs,
    pucksPerLog,
    logLength,
    recipe,
    board: { length, width, thickness, cells, panels, waste },
    layout,
    trim,
  };
}
