import { TIPS, type StageId, type Tip } from '../data/tips';
import { formatLength, panelWidth } from '../engine';
import { NARROW } from '../engine/checks';
import { patternInfo, type Design, type DesignState } from './design';

export interface GuideStage {
  id: StageId;
  title: string;
  /** What to do, in order. */
  steps: string[];
  tips: Tip[];
}

/** True when any board has to be ripped, as opposed to blanks that are already the right width. */
export function needsRipping(design: Design): boolean {
  return design.plan.boards.some((board) =>
    board.segments.some((segment) => segment.strips.length > 1 || segment.leftoverWidth > 0.01),
  );
}

function hasNarrowPieces(design: Design): boolean {
  const { recipe } = design;
  return (
    recipe.panels.some((panel) => panel.strips.some((strip) => strip.width < NARROW)) ||
    recipe.slices.some((slice) => slice.ripTo !== undefined && slice.ripTo < NARROW)
  );
}

/** The step-by-step instructions for a design, with the tips that apply at each stage. */
export function buildGuide(state: DesignState, design: Design): GuideStage[] {
  const show = (mm: number): string => formatLength(mm, state.unit);
  const { recipe, board } = design;
  const panel = recipe.panels[0]!;
  const info = patternInfo(state.pattern);
  const ripping = needsRipping(design);
  const narrow = hasNarrowPieces(design);
  const slices = recipe.slices.length;
  const panelCount = recipe.panels.length;
  const tilt = panel.bevel;
  const grid = (recipe.columns ?? 1) > 1;
  const trimmed = panelWidth(panel) - board.length > 0.01;
  const planing = design.rips.some((line) => line.planeTo !== undefined);

  const applies = (tip: Tip): boolean =>
    tip.when === undefined || (tip.when === 'needs-ripping' && ripping) || (tip.when === 'narrow-pieces' && narrow);
  const tipsFor = (id: StageId): Tip[] => TIPS.filter((tip) => tip.stage === id && applies(tip));

  const stages: Omit<GuideStage, 'tips'>[] = [
    {
      id: 'wood',
      title: state.woodMode === 'buy' ? 'Buy your wood' : 'Gather your boards',
      steps: [
        'Look over each board for cracks, loose knots and twist. Keep any flawed board as your spare.',
        'Measure the real thickness, width and length of every board. If any differs from the list, go back and enter what you measured.',
      ],
    },
    {
      id: 'strips',
      title: 'Cut the strips',
      steps: [
        ...(planing ? ['Plane the thicker boards down first, so that all your boards are the same thickness.'] : []),
        `Crosscut each board to ${show(panel.length)}, as shown in the table.`,
        ...(tilt !== undefined
          ? [
              `Tilt the blade to ${tilt} degrees. Rip a short offcut first and check the slant with a protractor or bevel gauge.`,
              'Rip the strips, keeping the same face of the board up for every cut so that all the slants match.',
              'Keep two strips that still have one square edge for the outside of the panel. Trim the square edge off the others with a tilted cut.',
            ]
          : ripping
            ? [
                'Set the rip fence to the first width in the fence table and rip every strip of that width before moving the fence. This keeps strips of the same width identical.',
              ]
            : []),
        'Stack the strips by wood so they are easy to lay out.',
      ],
    },
    {
      id: 'panel',
      title: 'Glue the strips into a panel',
      steps: [
        ...(panelCount > 1 ? [`You are making ${panelCount} identical panels. Repeat these steps for each.`] : []),
        'Lay the strips out dry, in the order shown, on a flat surface. Check the order against the picture.',
        ...(tilt !== undefined
          ? [
              'Check that every slant leans the same way. Slanted faces slide under clamp pressure, so tighten gently and watch that the ends stay lined up.',
            ]
          : []),
        'Spread glue evenly over one of each pair of faces that meet, then press the strips together.',
        'Clamp across the panel until a thin line of glue squeezes out along every joint. Keep the ends lined up and the faces flush.',
        'Scrape off the squeezed-out glue once it has turned rubbery. Leave the panel clamped for 24 hours.',
        'Flatten both faces of the panel so the strips are flush with each other.',
      ],
    },
    {
      id: 'slice',
      title: 'Slice the panel',
      steps: [
        'Trim one end of the panel square on a crosscut sled.',
        `Clamp a stop block to the sled ${show(recipe.cut.sliceThickness)} from the blade.`,
        `Push the squared end against the stop and cut. Repeat until you have ${slices} slices${panelCount > 1 ? ' from all the panels together' : ''}.`,
        grid
          ? 'Stack the tiles as they come off the saw. They are all alike, so their order does not matter.'
          : 'Number each slice in pencil as it comes off the saw, so you can keep them in order.',
      ],
    },
    {
      id: 'arrange',
      title: 'Arrange and glue the slices',
      steps: [
        grid
          ? 'Stand each tile so the end grain faces up.'
          : 'Roll each slice a quarter turn so the end grain faces up, keeping them in numbered order.',
        info.arrange,
        'Check the dry layout against the picture before you open the glue.',
        ...(grid
          ? [
              'Glue one row of tiles at a time: spread glue on the faces that meet, press the tiles together and clamp along the row. Keep each row straight against a flat edge.',
              'When the rows are dry, glue them to each other, lining up the joints between tiles.',
            ]
          : ['Spread glue on the faces that meet, press the slices together, and clamp across them.']),
        'Leave the board clamped for 24 hours.',
      ],
    },
    {
      id: 'flatten',
      title: 'Trim and flatten',
      steps: [
        trimmed
          ? `Trim both ends square, along the dashed lines in the picture, to bring the board to ${show(board.length)} long.`
          : 'Trim the four edges just enough to make them clean and square.',
        `Flatten one face, turn the board over and flatten the other, working down to ${show(board.thickness)} thick.`,
        'Check with a straightedge that the board does not rock on a flat surface.',
      ],
    },
    {
      id: 'sand',
      title: 'Sand',
      steps: [
        'Sand both faces, working up through the grits to 220. End grain sands slowly, so be patient with the first grit: it does most of the work.',
        'Ease all the edges and corners.',
        'Brush or vacuum off the dust.',
      ],
    },
    {
      id: 'finish',
      title: 'Oil the board',
      steps: [
        'Apply the oil generously to every surface, including the edges and the underside.',
        'Let it soak in, wipe off what is left, and apply it again.',
        'Finish with the oil and beeswax mix, then buff with a clean cloth once it has dried.',
      ],
    },
    {
      id: 'care',
      title: 'Looking after it',
      steps: ['If the board is a gift, pass these on with it.'],
    },
  ];

  return stages.map((stage) => ({ ...stage, tips: tipsFor(stage.id) }));
}
