import { describe, expect, it } from 'vitest';
import { SOURCES_CHECKED, TIPS, type StageId } from '../data/tips';
import { inch } from '../engine';
import { defaultState, makeDesign, type DesignState } from './design';
import { buildGuide, needsRipping } from './guide';

const guideFor = (state: DesignState) => buildGuide(state, makeDesign(state));
const tipIds = (state: DesignState, stage: StageId): string[] =>
  guideFor(state)
    .find((entry) => entry.id === stage)!
    .tips.map((tip) => tip.id);

describe('tips', () => {
  it('gives every tip a source with a secure link', () => {
    expect(SOURCES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const tip of TIPS) {
      const sources = [...tip.sources, ...(tip.otherView?.sources ?? [])];
      expect(tip.sources.length, tip.id).toBeGreaterThan(0);
      for (const source of sources) {
        expect(source.url, tip.id).toMatch(/^https:\/\//);
        expect(source.name.length, tip.id).toBeGreaterThan(5);
      }
    }
  });

  it('gives every tip a unique id', () => {
    expect(new Set(TIPS.map((tip) => tip.id)).size).toBe(TIPS.length);
  });

  it('presents the other view where good sources disagree about planing', () => {
    const planer = TIPS.find((tip) => tip.id === 'no-planer')!;
    expect(planer.stage).toBe('flatten');
    expect(planer.otherView?.sources.length).toBeGreaterThan(0);
  });
});

describe('buildGuide', () => {
  it('covers the build from buying wood to looking after the board', () => {
    expect(guideFor(defaultState).map((stage) => stage.id)).toEqual([
      'wood',
      'strips',
      'panel',
      'slice',
      'arrange',
      'flatten',
      'sand',
      'finish',
      'care',
    ]);
  });

  it('gives every stage something to do, and every stage after the first a tip', () => {
    for (const stage of guideFor(defaultState)) {
      expect(stage.steps.length, stage.id).toBeGreaterThan(0);
      if (stage.id !== 'wood') expect(stage.tips.length, stage.id).toBeGreaterThan(0);
    }
  });

  it('uses every tip somewhere', () => {
    const narrow = { ...defaultState, cellWidth: inch(0.2), boardLength: inch(3), canPlane: true };
    const shown = new Set(
      [...guideFor(defaultState), ...guideFor(narrow)].flatMap((stage) => stage.tips.map((tip) => tip.id)),
    );
    const ripped = new Set(
      guideFor({ ...defaultState, cellWidth: inch(1.5) }).flatMap((stage) => stage.tips.map((tip) => tip.id)),
    );
    for (const tip of TIPS) expect(shown.has(tip.id) || ripped.has(tip.id), tip.id).toBe(true);
  });

  it('leaves out ripping advice when the blanks need no ripping', () => {
    expect(needsRipping(makeDesign(defaultState))).toBe(false);
    expect(tipIds(defaultState, 'strips')).toEqual(['same-thickness']);
    expect(
      guideFor(defaultState)
        .find((stage) => stage.id === 'strips')!
        .steps.join(' '),
    ).not.toContain('rip fence');
  });

  it('adds ripping advice when boards must be ripped', () => {
    const state = { ...defaultState, cellWidth: inch(1.5), buySpecies: ['cherry', 'black-walnut'] };
    expect(needsRipping(makeDesign(state))).toBe(true);
    expect(tipIds(state, 'strips')).toContain('rip-safely');
  });

  it('states the real numbers for this design', () => {
    const text = guideFor(defaultState)
      .flatMap((stage) => stage.steps)
      .join(' ');
    expect(text).toContain('Crosscut each board to 14-3/8"');
    expect(text).toContain('Clamp a stop block to the sled 1-5/8" from the blade');
    expect(text).toContain('until you have 8 slices');
    expect(text).toContain('working down to 1-1/2" thick');
  });

  it('describes the trim for a brick board', () => {
    const text = guideFor({ ...defaultState, pattern: 'brick', cellWidth: inch(2.5) })
      .find((stage) => stage.id === 'flatten')!
      .steps.join(' ');
    expect(text).toContain('Trim both ends square');
  });
});
