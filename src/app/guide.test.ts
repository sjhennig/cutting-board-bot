import { describe, expect, it } from 'vitest';
import { SOURCES_CHECKED, TIPS, type StageId } from '../data/tips';
import { inch } from '../engine';
import { PATTERNS, defaultState, makeDesign, type DesignState } from './design';
import { buildGuide, needsRipping } from './guide';

const guideFor = (state: DesignState) => buildGuide(state, makeDesign(state));
const tipIds = (state: DesignState, stage: StageId): string[] =>
  guideFor(state)
    .find((entry) => entry.id === stage)!
    .tips.map((tip) => tip.id);

const woods = (pattern: { minSpecies: number }): string[] =>
  pattern.minSpecies > 2 ? ['hard-maple', 'cherry', 'black-walnut'] : defaultState.buySpecies;

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

const tumblingState: DesignState = {
  ...defaultState,
  pattern: 'tumbling',
  stripThickness: inch(0.75),
  buySpecies: ['hard-maple', 'cherry', 'black-walnut'],
};

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
    const cubes = new Set(guideFor(tumblingState).flatMap((stage) => stage.tips.map((tip) => tip.id)));
    for (const tip of TIPS) expect(shown.has(tip.id) || ripped.has(tip.id) || cubes.has(tip.id), tip.id).toBe(true);
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

  it('explains tilted rips for a chevron', () => {
    const state: DesignState = { ...defaultState, pattern: 'chevron', cellWidth: inch(1), stripThickness: inch(0.75) };
    const strips = guideFor(state).find((stage) => stage.id === 'strips')!;
    expect(strips.steps.join(' ')).toContain('Tilt the blade to 30 degrees');
    expect(strips.steps.join(' ')).toContain('one square edge');
  });

  it('explains the several panels of a basket weave', () => {
    const state: DesignState = { ...defaultState, pattern: 'basketweave', stripThickness: inch(1.5) };
    const guide = guideFor(state);
    expect(guide.find((stage) => stage.id === 'panel')!.steps[0]).toMatch(/^You are making \d+ identical panels/);
    expect(guide.find((stage) => stage.id === 'arrange')!.steps.join(' ')).toContain('quarter turn');
  });

  it('walks through the two panels and the re-ripping of a 3D illusion board', () => {
    const pattern = PATTERNS.find((entry) => entry.id === 'illusion3d')!;
    const guide = guideFor({ ...defaultState, ...pattern.defaults, pattern: 'illusion3d' });
    expect(guide.map((stage) => stage.id)).toEqual([
      'wood',
      'strips',
      'panel',
      'slice',
      'rerip',
      'arrange',
      'flatten',
      'sand',
      'finish',
      'care',
    ]);
    const steps = (id: StageId): string => guide.find((stage) => stage.id === id)!.steps.join(' ');
    expect(steps('strips')).toContain('9-1/8" for panel A and 7-3/8" for panel B');
    expect(steps('panel')).toContain('2 different panels: panel A and panel B');
    expect(steps('slice')).toContain('Cut 5 slices from panel A and 4 slices from panel B');
    expect(steps('rerip')).toContain('Set the fence to the widest width');
    expect(steps('arrange')).toContain('panel A and panel B in turn');
    expect(steps('flatten')).toContain('Trim both ends square');
    // Ripping thin pieces from short slices gets the same safety advice as ripping strips.
    expect(guide.find((stage) => stage.id === 'rerip')!.tips.map((tip) => tip.id)).toEqual([
      'rip-safely',
      'oversize-narrow',
    ]);
  });

  it('has a re-ripping stage only for boards with slices cut narrower', () => {
    for (const pattern of PATTERNS) {
      const state = { ...defaultState, ...pattern.defaults, pattern: pattern.id, buySpecies: woods(pattern) };
      const narrower = makeDesign(state).recipe.slices.some((slice) => slice.ripTo !== undefined);
      expect(
        guideFor(state).some((stage) => stage.id === 'rerip'),
        pattern.id,
      ).toBe(narrower);
    }
    expect(guideFor(defaultState).some((stage) => stage.id === 'rerip')).toBe(false);
  });

  it('describes sticks, logs and pucks for tumbling blocks', () => {
    const guide = guideFor(tumblingState);
    expect(guide.map((stage) => stage.title).slice(1, 6)).toEqual([
      'Cut the diamond sticks',
      'Glue the sticks into logs',
      'Slice the logs into pucks',
      'Arrange and glue the pucks',
      'Trim and flatten',
    ]);
    const steps = (id: StageId): string => guide.find((stage) => stage.id === id)!.steps.join(' ');
    expect(steps('strips')).toContain('30 degrees from upright, which is 60 degrees from the table');
    expect(steps('strips')).toContain('7/8" wide on the face');
    expect(steps('arrange')).toMatch(/Saw \d+ of the pucks in half from point to point/);
    expect(steps('arrange')).toContain('Hard maple diamond at the top');
    // Advice written for flat panels is left out; the advice from the two cube builds is added.
    const tips = (id: StageId): string[] => guide.find((stage) => stage.id === id)!.tips.map((tip) => tip.id);
    expect(tips('panel')).toEqual(['wrap-logs', 'glue-choice']);
    expect(tips('strips')).toEqual(expect.arrayContaining(['angle-gauge', 'test-three-woods', 'rip-safely']));
    expect(tips('arrange')).toContain('row-at-a-time');
    // Those tips appear for no other pattern.
    expect(guideFor(defaultState).flatMap((stage) => stage.tips.map((tip) => tip.id))).not.toContain('wrap-logs');
  });

  it('describes the trim for a brick board', () => {
    const text = guideFor({ ...defaultState, pattern: 'brick', cellWidth: inch(2.5) })
      .find((stage) => stage.id === 'flatten')!
      .steps.join(' ');
    expect(text).toContain('Trim both ends square');
  });
});
