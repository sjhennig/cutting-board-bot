import { describe, expect, it } from 'vitest';
import { basketWeave, checkerboard, illusion3d } from '../engine';
import { groupName, panelGroups, reRipRows } from './panels';

describe('panelGroups', () => {
  it('finds one kind of panel in a simple board', () => {
    const recipe = checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 6, cellWidth: 30 });
    const groups = panelGroups(recipe);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.slicesEach).toBe(6);
    expect(groupName(groups[0]!)).toBe('panel A');
  });

  it('treats the identical logs of a basket weave as one kind', () => {
    const recipe = basketWeave({ species: ['maple', 'walnut'], columns: 10, rows: 9, maxLogLength: 600 });
    expect(recipe.panels.length).toBeGreaterThan(2);
    const groups = panelGroups(recipe);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.ids).toHaveLength(recipe.panels.length);
    expect(groupName(groups[0]!)).toMatch(/^panels A to [B-Z]$/);
  });

  it('keeps the two panels of a 3D illusion board apart', () => {
    const recipe = illusion3d({ dark: 'walnut', light: 'maple' });
    const groups = panelGroups(recipe);
    expect(groups.map(groupName)).toEqual(['panel A', 'panel B']);
    expect(groups.map((group) => group.slicesEach)).toEqual([5, 4]);
    expect(groups.map((group) => group.index)).toEqual([0, 1]);
  });
});

describe('reRipRows', () => {
  it('is empty when slices are used whole', () => {
    expect(reRipRows(checkerboard({ species: ['maple', 'walnut'], columns: 8, rows: 6, cellWidth: 30 }))).toEqual([]);
  });

  it('lists identical slices once, and accounts for every piece', () => {
    const recipe = illusion3d({ dark: 'walnut', light: 'maple' });
    const rows = reRipRows(recipe);
    expect(rows[0]).toEqual({ panel: 'A', slices: 2, widths: [33, 9] });
    expect(rows.reduce((sum, row) => sum + row.slices * row.widths.length, 0)).toBe(recipe.slices.length);
    expect(rows.filter((row) => row.panel === 'A').reduce((sum, row) => sum + row.slices, 0)).toBe(5);
    expect(rows.filter((row) => row.panel === 'B').reduce((sum, row) => sum + row.slices, 0)).toBe(4);
  });
});
