import { speciesById, speciesWarnings } from '../data/species';
import { woodVaultBoards } from '../data/woodVault';
import {
  basketWeave,
  brick,
  buildBoard,
  chaotic,
  checkDesign,
  checkerboard,
  chevron,
  illusion3d,
  inch,
  MTM_3D_STEPS,
  planCuts,
  ripList,
  stripes,
  suggestPurchase,
  formatLength,
  type BoardResult,
  type CutPlan,
  type PurchaseLine,
  type Recipe,
  type RipLine,
  type Shop,
  type StockBoard,
  type Unit,
} from '../engine';

export type PatternId = 'checkerboard' | 'brick' | 'stripes' | 'chaotic' | 'basketweave' | 'chevron' | 'illusion3d';

export interface PatternInfo {
  id: PatternId;
  name: string;
  blurb: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  minSpecies: number;
  /** What the "cell width" setting is called for this pattern, or null if the pattern does not use it. */
  cellLabel: string | null;
  /** True when the board is always square, so only one size is asked for. */
  square?: boolean;
  /** Settings that suit this pattern, applied when it is chosen. */
  defaults?: Partial<DesignState>;
  /** What to do with the slices before the second glue-up. */
  arrange: string;
}

/** Side of MTM Wood's 3D board: its step widths out to the centre and back. */
export const ILLUSION_SIDE = 2 * MTM_3D_STEPS.reduce((sum, step) => sum + step, 0) - (MTM_3D_STEPS.at(-1) as number);
/** Extra width on the two edge strips of a 3D board, trimmed off after glue-up. */
const ILLUSION_EDGE_EXTRA = 5;

export const PATTERNS: PatternInfo[] = [
  {
    id: 'checkerboard',
    name: 'Checkerboard',
    blurb: 'The classic. Two woods in alternating squares.',
    level: 'Beginner',
    minSpecies: 2,
    cellLabel: 'Square width',
    arrange: 'Turn every second slice end for end, so each square sits next to the other wood.',
  },
  {
    id: 'brick',
    name: 'Brick',
    blurb: 'Rows offset by half a brick, like a wall. Works with one wood or several.',
    level: 'Beginner',
    minSpecies: 1,
    cellLabel: 'Brick length',
    arrange: 'Slide every second slice sideways by half a brick. The ends are trimmed square after glue-up.',
  },
  {
    id: 'stripes',
    name: 'Stripes',
    blurb: 'The simplest board: bands of wood running end to end.',
    level: 'Beginner',
    minSpecies: 1,
    cellLabel: 'Stripe width',
    arrange: 'Keep every slice the same way round so the stripes line up.',
  },
  {
    id: 'chaotic',
    name: 'Chaotic',
    blurb: 'Random widths and flipped rows. Forgiving, and great for mixed offcuts.',
    level: 'Beginner',
    minSpecies: 2,
    cellLabel: 'Widest strip',
    arrange: 'Turn the marked slices end for end. Small misalignments will not show in this pattern.',
  },
  {
    id: 'basketweave',
    name: 'Basket weave',
    blurb: 'Square tiles of three strips, every other one turned, so the strips seem to weave.',
    level: 'Intermediate',
    minSpecies: 2,
    cellLabel: null,
    // 1-1/2 in. tiles are three 1/2 in. strips, which 1/2 in. boards supply with no planing.
    defaults: { stripThickness: inch(1.5) },
    arrange:
      'Lay the tiles out in a grid. Turn every second tile a quarter turn, like the squares of a checkerboard, so its strips run across its neighbours.',
  },
  {
    id: 'chevron',
    name: 'Chevron',
    blurb: 'Zigzag bands. The strips are ripped with the blade tilted, so each one slants.',
    level: 'Intermediate',
    minSpecies: 2,
    cellLabel: 'Strip width',
    // 3/4 in. boards come in every wood at the same thickness, so nothing needs planing.
    defaults: { cellWidth: inch(1), stripThickness: inch(0.75) },
    arrange: 'Turn every second slice upside down. This mirrors its slant, so the bands zigzag and meet at each joint.',
  },
  {
    id: 'illusion3d',
    name: '3D illusion',
    blurb: 'Rectangles that shrink towards the centre, so the flat board seems to bulge. Many thin, precise pieces.',
    level: 'Advanced',
    minSpecies: 2,
    cellLabel: null,
    square: true,
    // The size of MTM Wood's published board, so its widths are used unchanged.
    defaults: { boardLength: ILLUSION_SIDE, boardWidth: ILLUSION_SIDE, stripThickness: inch(1.625) },
    arrange:
      'Lay the pieces out in the order shown, taking them from panel A and panel B in turn: widest at the two edges, narrowest in the centre. Every piece sits the same way round.',
  },
];

/** Blade tilt for chevron strips, in degrees from vertical. */
export const CHEVRON_TILT = 30;
/** Strips in each basket weave tile. */
export const WEAVE_STRIPS = 3;

export const patternInfo = (id: PatternId): PatternInfo => PATTERNS.find((pattern) => pattern.id === id) as PatternInfo;

export interface DesignState {
  unit: Unit;
  kerf: number;
  canPlane: boolean;
  /** `buy`: the app chooses boards from the catalog. `have`: the user lists their own. */
  woodMode: 'buy' | 'have';
  /** Woods to use when buying, in pattern order. */
  buySpecies: string[];
  /** The user's own boards. */
  stock: StockBoard[];
  /** Woods from the user's own boards to leave out of the design. */
  excluded: string[];
  pattern: PatternId;
  cellWidth: number;
  /** Thickness of the strips in the first glue-up. Sets the height of each row. */
  stripThickness: number;
  boardLength: number;
  boardWidth: number;
  /** Finished thickness, after flattening. */
  boardThickness: number;
  seed: number;
  /** Show full instructions on the last step, not just the cut list. */
  showGuide: boolean;
}

export const END_TRIM = inch(1 / 2);
export const FLATTEN_PER_FACE = inch(1 / 16);
/** Warn when a board has less than this to spare along its length. */
export const MIN_SLACK = inch(1);

export const defaultState: DesignState = {
  unit: 'in',
  kerf: inch(1 / 8),
  canPlane: false,
  woodMode: 'buy',
  buySpecies: ['hard-maple', 'black-walnut'],
  stock: [],
  excluded: [],
  pattern: 'checkerboard',
  cellWidth: inch(1.25),
  stripThickness: inch(1.625),
  boardLength: inch(15),
  boardWidth: inch(13),
  boardThickness: inch(1.5),
  seed: 1,
  showGuide: false,
};

/** The woods the design uses, in order. */
export function designSpecies(state: DesignState): string[] {
  if (state.woodMode === 'buy') return state.buySpecies;
  const owned = [...new Set(state.stock.map((board) => board.species))];
  return owned.filter((species) => !state.excluded.includes(species));
}

export interface Notice {
  level: 'problem' | 'caution';
  message: string;
}

export interface Design {
  recipe: Recipe;
  board: BoardResult;
  plan: CutPlan;
  rips: RipLine[];
  /** Boards to buy. Empty when the user is working from their own boards. */
  purchase: PurchaseLine[];
  notices: Notice[];
  columns: number;
  rows: number;
}

const count = (target: number, size: number): number => Math.max(1, Math.round(target / size));

/** Turn the user's choices into a recipe. Throws with a readable message if they do not make a board. */
export function makeRecipe(state: DesignState): { recipe: Recipe; columns: number; rows: number } {
  const species = designSpecies(state);
  const info = patternInfo(state.pattern);
  if (species.length < info.minSpecies) {
    throw new Error(
      species.length === 0
        ? 'Choose at least one wood to see your board.'
        : `A ${info.name.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase())} board needs at least ${info.minSpecies} woods. Add another wood, or pick a different pattern.`,
    );
  }
  if (state.cellWidth <= 0 || state.stripThickness <= 0 || state.boardThickness <= 0) {
    throw new Error('Sizes must be greater than zero.');
  }

  const shop: Shop = {
    panelThickness: state.stripThickness,
    sliceThickness: state.boardThickness + 2 * FLATTEN_PER_FACE,
    kerf: state.kerf,
    endTrim: END_TRIM,
    flattenPerFace: FLATTEN_PER_FACE,
  };
  const rows = count(state.boardWidth, state.stripThickness);
  const cell = state.cellWidth;

  switch (state.pattern) {
    case 'checkerboard': {
      const columns = count(state.boardLength, cell);
      return { recipe: checkerboard({ species, columns, rows, cellWidth: cell, shop }), columns, rows };
    }
    case 'brick': {
      // Half a brick is trimmed away, so one more brick is needed than fits the length.
      const columns = count(state.boardLength + cell / 2, cell);
      return { recipe: brick({ species, columns, rows, brickWidth: cell, shop }), columns, rows };
    }
    case 'stripes': {
      const columns = count(state.boardLength, cell);
      const strips = Array.from({ length: columns }, (_, index) => ({
        species: species[index % species.length] as string,
        width: cell,
      }));
      return { recipe: stripes({ strips, rows, shop }), columns, rows };
    }
    case 'basketweave': {
      // Tiles are square, as wide as the stock is thick.
      const tile = state.stripThickness;
      const columns = count(state.boardLength, tile);
      const longest =
        state.woodMode === 'buy'
          ? Math.max(...woodVaultBoards().map((board) => board.length))
          : Math.min(
              ...species
                .slice(0, 2)
                .map((id) =>
                  Math.max(0, ...state.stock.filter((board) => board.species === id).map((board) => board.length)),
                ),
            );
      const recipe = basketWeave({
        species,
        columns,
        rows,
        stripsPerTile: WEAVE_STRIPS,
        maxLogLength: longest,
        shop,
      });
      return { recipe, columns, rows };
    }
    case 'chevron': {
      const lean = state.stripThickness * Math.tan((CHEVRON_TILT * Math.PI) / 180);
      const columns = count(state.boardLength + lean, cell);
      return {
        recipe: chevron({ species, columns, rows, stripWidth: cell, bevel: CHEVRON_TILT, shop }),
        columns,
        rows,
      };
    }
    case 'illusion3d': {
      // MTM Wood's widths, scaled to the size asked for and rounded to marks on a ruler.
      const grid = state.unit === 'in' ? inch(1 / 32) : 0.5;
      const snap = (mm: number): number => Math.max(grid, Math.round(mm / grid) * grid);
      const scale = state.boardLength / ILLUSION_SIDE;
      const steps = MTM_3D_STEPS.map((step) => snap(step * scale));
      const widest = Math.max(...steps);
      if (state.stripThickness < widest - 0.01) {
        const show = (mm: number): string => formatLength(mm, state.unit);
        throw new Error(
          `A 3D illusion board this size has pieces ${show(widest)} wide, which are cut from the thickness of the strips. ` +
            `Use strips at least ${show(widest)} thick, or make the board smaller.`,
        );
      }
      const recipe = illusion3d({
        dark: species[0] as string,
        light: species[1] as string,
        steps,
        edgeExtra: snap(ILLUSION_EDGE_EXTRA),
        shop,
      });
      const across = recipe.slices.length;
      return { recipe, columns: across, rows: across };
    }
    case 'chaotic': {
      const recipe = chaotic({
        species,
        // With 1-1/4 in. as the widest, these are the three ready-made blank widths.
        widths: [cell * 0.6, cell * 0.8, cell],
        boardLength: state.boardLength,
        rows,
        seed: state.seed,
        shop,
      });
      return { recipe, columns: recipe.panels[0]?.strips.length ?? 0, rows };
    }
  }
}

/** Everything the interface shows for the current choices. */
export function makeDesign(state: DesignState): Design {
  const { recipe, columns, rows } = makeRecipe(state);
  const board = buildBoard(recipe);
  const notices: Notice[] = [];
  const show = (mm: number): string => formatLength(mm, state.unit);

  let plan: CutPlan;
  let purchase: PurchaseLine[] = [];
  if (state.woodMode === 'buy') {
    const suggestion = suggestPurchase(recipe, woodVaultBoards(), { kerf: state.kerf, canPlane: state.canPlane });
    plan = suggestion.plan;
    purchase = suggestion.lines;
    for (const species of new Set(plan.shortfalls.map((entry) => entry.species))) {
      const name = speciesById(species)?.name ?? species;
      notices.push({
        level: 'problem',
        message:
          `The Wood Vault catalog has no ${name} board that makes these strips` +
          (state.canPlane ? '.' : ' without planing.') +
          ' Try a different strip thickness or width, or another wood.',
      });
    }
  } else {
    plan = planCuts(recipe, state.stock);
    for (const entry of plan.shortfalls) {
      const name = speciesById(entry.species)?.name ?? entry.species;
      notices.push({
        level: 'problem',
        message:
          `Not enough ${name}: ${entry.count} more strip${entry.count === 1 ? '' : 's'} needed, ` +
          `${show(entry.width)} wide, ${show(entry.thickness)} thick and ${show(entry.length)} long.`,
      });
    }
    const needsPlaning = plan.boards.some((planned) =>
      planned.segments.some((segment) => segment.strips.some((strip) => strip.planeTo !== undefined)),
    );
    if (needsPlaning && !state.canPlane) {
      notices.push({
        level: 'problem',
        message:
          'Some of your boards are thicker than the strips and would need planing down, but you said you have no planer. ' +
          'Set the strip thickness to match your thinnest board.',
      });
    }
  }

  for (const warning of checkDesign(recipe, board)) notices.push(warning);

  if (state.pattern === 'chevron') {
    notices.push({
      level: 'caution',
      message:
        'The steps for this pattern are worked out from its geometry, not taken from a published build guide. ' +
        'Rip a short test piece first to check your blade tilt and fence setting.',
    });
  }
  if (state.pattern === 'basketweave') {
    notices.push({
      level: 'caution',
      message:
        `Each tile must be exactly square: its ${WEAVE_STRIPS} strips together must measure the same as the ` +
        'thickness of your boards. Measure a glued panel before slicing it, and trim it square if needed.',
    });
  }

  if (state.pattern === 'illusion3d') {
    notices.push({
      level: 'caution',
      message:
        "The sizes follow MTM Wood's published plan for this board. The order of work is theirs; the detail of each " +
        'step here is worked out from the geometry. Make a test cut before each new fence setting.',
    });
    if (designSpecies(state).length > 2) {
      notices.push({ level: 'caution', message: 'This pattern uses only the first two woods in your list.' });
    }
  }

  for (const planned of plan.boards) {
    const used = planned.segments.reduce((sum, segment) => sum + segment.length, 0);
    const slack = planned.leftoverLength;
    if (slack < MIN_SLACK && planned.segments.length > 0) {
      const name = speciesById(planned.species)?.name ?? planned.species;
      notices.push({
        level: 'caution',
        message:
          `A ${name} board has only ${show(slack)} to spare along its length (${show(used)} is used). ` +
          'Measure it before cutting; boards are often a little short.',
      });
      break;
    }
  }

  for (const warning of speciesWarnings(designSpecies(state))) {
    notices.push({ level: 'caution', message: warning.message });
  }

  return { recipe, board, plan, rips: ripList(plan), purchase, notices, columns, rows };
}

/** A sensible strip thickness for the user's own boards: one every chosen wood can supply. */
export function suggestedStripThickness(state: DesignState): number | null {
  const species = designSpecies(state);
  if (state.woodMode !== 'have' || species.length === 0) return null;
  const thickest = species.map((id) =>
    Math.max(...state.stock.filter((board) => board.species === id).map((board) => board.thickness)),
  );
  return Math.min(...thickest);
}
