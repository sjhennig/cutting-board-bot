/**
 * A design is a recipe: the panels to glue up, how to slice them, and how to arrange the slices.
 * The preview, the cut list and the instructions are all derived from it.
 *
 * All lengths are millimetres.
 *
 * Board axes, looking down at the finished board:
 *   x runs along each slice (across the strips of the original panel)
 *   y runs across the slices (the order they are glued in)
 */

export interface Strip {
  species: string;
  /** Width across the panel. Becomes the cell's x size on the finished board. */
  width: number;
}

/** A long-grain glue-up of strips, edge to edge. */
export interface Panel {
  id: string;
  strips: Strip[];
  /** Thickness of the panel. Becomes each slice's y size unless the slice is re-ripped. */
  thickness: number;
  /** Length along the grain. Determines how many slices the panel yields. */
  length: number;
}

export interface Cut {
  /** Distance between crosscuts. Becomes the board's thickness before flattening. */
  sliceThickness: number;
  /** Width of material the saw blade removes. */
  kerf: number;
  /** Length removed from the panel to square its end before slicing. */
  endTrim: number;
}

/** One piece in the finished board, in glue-up order. */
export interface SliceSpec {
  /** Which panel this piece is cut from. */
  panel: string;
  /** Turn the piece end for end, reversing the order of its strips. */
  flip?: boolean;
  /** Slide the piece along x by this distance. */
  shift?: number;
  /** Re-rip the piece to this y size, narrower than the panel thickness. */
  ripTo?: number;
}

export interface Recipe {
  panels: Panel[];
  cut: Cut;
  slices: SliceSpec[];
  /** Material removed from each face when flattening the glued board. */
  flattenPerFace: number;
  /** Extra length cut from each end of the board after glue-up, beyond squaring shifted slices. */
  trimEnds?: number;
}

/** A rectangle of one species on the finished board's surface. */
export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
  species: string;
  /** Index into `Recipe.slices`. */
  slice: number;
}

export interface PanelReport {
  id: string;
  width: number;
  /** Slices the panel's length can yield. */
  slicesAvailable: number;
  /** Slices the design needs from this panel. */
  slicesNeeded: number;
  /** Shortest panel that yields `slicesNeeded` slices. */
  lengthNeeded: number;
  /** Panel length left over after the needed slices are cut. */
  leftoverLength: number;
}

/** Where the wood in the panels ends up, as volumes in cubic millimetres. */
export interface WasteReport {
  supplied: number;
  /** The finished board. */
  board: number;
  /** Squaring the panel ends. */
  endTrim: number;
  /** Sawdust from crosscutting slices. */
  crosscutKerf: number;
  /** Unused panel length. */
  panelLeftover: number;
  /** Offcuts and sawdust from re-ripping slices narrower. */
  reRip: number;
  /** Ends cut off the glued board to square it. */
  boardTrim: number;
  /** Removed when flattening both faces. */
  flattening: number;
}

export interface BoardResult {
  /** Finished size along x. */
  length: number;
  /** Finished size along y. */
  width: number;
  /** Finished thickness after flattening. */
  thickness: number;
  cells: Cell[];
  panels: PanelReport[];
  waste: WasteReport;
}
