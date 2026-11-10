import { panelWidth, reRipPlan, slicesFromLength, type Panel, type Recipe } from '../engine';

/** Panels that are glued up and sliced identically, so the cut list describes them once. */
export interface PanelGroup {
  /** The ids of the panels in the group, such as A, B and C. */
  ids: string[];
  /** One of the panels; the others are the same. */
  panel: Panel;
  /** Where `panel` is in `Recipe.panels`. */
  index: number;
  width: number;
  /** Slices to crosscut from each panel in the group. */
  slicesEach: number;
}

const sameBuild = (a: Panel, b: Panel): boolean =>
  a.thickness === b.thickness &&
  a.length === b.length &&
  a.bevel === b.bevel &&
  a.strips.length === b.strips.length &&
  a.strips.every(
    (strip, index) => strip.species === b.strips[index]?.species && strip.width === b.strips[index]?.width,
  );

/** The different kinds of panel in a recipe, in order. Most designs have one. */
export function panelGroups(recipe: Recipe): PanelGroup[] {
  const { sliceThickness, kerf, endTrim } = recipe.cut;
  const groups: PanelGroup[] = [];
  recipe.panels.forEach((panel, index) => {
    const match = groups.find((group) => sameBuild(group.panel, panel));
    if (match) {
      match.ids.push(panel.id);
      return;
    }
    groups.push({
      ids: [panel.id],
      panel,
      index,
      width: panelWidth(panel),
      slicesEach: slicesFromLength(panel.length, sliceThickness, kerf, endTrim),
    });
  });
  return groups;
}

/** "panel A", or "panels A to C" for a group of identical panels. */
export function groupName(group: PanelGroup): string {
  const { ids } = group;
  if (ids.length === 1) return `panel ${ids[0]}`;
  return `panels ${ids[0]} ${ids.length === 2 ? 'and' : 'to'} ${ids[ids.length - 1]}`;
}

/** Slices that are ripped into the same narrower pieces, so the fence table lists them once. */
export interface ReRipRow {
  /** The panel the slices come from. */
  panel: string;
  /** How many slices are ripped this way. */
  slices: number;
  /** The widths to rip from each, widest first. */
  widths: number[];
}

/** How the slices of each panel are ripped into narrower pieces. Empty when slices are used whole. */
export function reRipRows(recipe: Recipe): ReRipRow[] {
  const rows: ReRipRow[] = [];
  for (const panel of recipe.panels) {
    for (const slice of reRipPlan(panel, recipe) ?? []) {
      const match = rows.find(
        (row) =>
          row.panel === panel.id &&
          row.widths.length === slice.widths.length &&
          row.widths.every((width, index) => Math.abs(width - (slice.widths[index] as number)) < 0.01),
      );
      if (match) match.slices += 1;
      else rows.push({ panel: panel.id, slices: 1, widths: slice.widths });
    }
  }
  return rows;
}
