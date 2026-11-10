import type { BoardResult, Recipe } from './types';
import { inch } from './units';

/** `problem`: the board cannot be built as designed. `caution`: it can, but think first. */
export interface Warning {
  level: 'problem' | 'caution';
  code: 'panel-too-short' | 'thin-board' | 'narrow-strip' | 'narrow-slice';
  message: string;
}

/** Below this finished thickness an end grain board is prone to warping. */
export const MIN_THICKNESS = inch(1.25);
/** Strips and slices narrower than this are hard to cut safely and accurately. */
export const NARROW = inch(0.25);

/** Things about a design the user should know before cutting wood. */
export function checkDesign(recipe: Recipe, board: BoardResult): Warning[] {
  const warnings: Warning[] = [];

  for (const panel of board.panels) {
    if (panel.slicesAvailable < panel.slicesNeeded) {
      warnings.push({
        level: 'problem',
        code: 'panel-too-short',
        message:
          `Panel ${panel.id} yields ${panel.slicesAvailable} slices but the design needs ` +
          `${panel.slicesNeeded}. Make the panel longer or the slices thinner.`,
      });
    }
  }

  if (board.thickness < MIN_THICKNESS) {
    warnings.push({
      level: 'caution',
      code: 'thin-board',
      message:
        'The finished board is under 1-1/4 in. thick. Thin end grain boards warp more easily; ' +
        'cut thicker slices if your stock allows.',
    });
  }

  if (recipe.panels.some((panel) => panel.strips.some((strip) => strip.width < NARROW))) {
    warnings.push({
      level: 'caution',
      code: 'narrow-strip',
      message:
        'Some strips are under 1/4 in. wide. Rip them with a thin-rip jig or on a band saw, ' +
        'cut them oversize and sand to width.',
    });
  }

  if (recipe.slices.some((slice) => slice.ripTo !== undefined && slice.ripTo < NARROW)) {
    warnings.push({
      level: 'caution',
      code: 'narrow-slice',
      message:
        'Some slices are re-cut to under 1/4 in. Short end grain pieces this thin are fragile; ' +
        'cut them oversize and sand to size.',
    });
  }

  return warnings;
}
