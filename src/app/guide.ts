import { speciesById } from '../data/species';
import { TIPS, type StageId, type Tip } from '../data/tips';
import { formatLength, panelWidth, TUMBLING_TILT } from '../engine';
import { NARROW } from '../engine/checks';
import { patternInfo, type Design, type DesignState } from './design';
import { groupName, panelGroups } from './panels';

/** Tips about gluing and flattening a flat panel, which a six-sided log is not. */
const PANEL_ONLY_TIPS = ['alternate-grain', 'clamp-evenly', 'plane-panel'];

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
  const groups = panelGroups(recipe);
  const several = groups.length > 1;
  const panel = groups[0]!.panel;
  const reRipped = recipe.slices.some((slice) => slice.ripTo !== undefined);
  const info = patternInfo(state.pattern);
  const ripping = needsRipping(design);
  const narrow = hasNarrowPieces(design);
  const slices = recipe.slices.length;
  const panelCount = recipe.panels.length;
  const tilt = groups.find((group) => group.panel.bevel !== undefined)?.panel.bevel;
  const grid = (recipe.columns ?? 1) > 1;
  const trimmed = Math.max(...recipe.panels.map(panelWidth)) - board.length > 0.01;
  const planing = design.rips.some((line) => line.planeTo !== undefined);
  const { tumbling } = design;

  const applies = (tip: Tip): boolean =>
    // Advice about flat panels and their clamps does not fit six-sided logs.
    !(tumbling && PANEL_ONLY_TIPS.includes(tip.id)) &&
    (tip.when === undefined ||
      (tip.when === 'needs-ripping' && ripping) ||
      (tip.when === 'narrow-pieces' && narrow) ||
      (tip.when === 'tumbling' && tumbling !== undefined));
  // Ripping slices into pieces is ripping again, so the same advice applies.
  const tipsFor = (id: StageId): Tip[] =>
    TIPS.filter((tip) =>
      id === 'rerip'
        ? tip.stage === 'strips' && tip.when !== undefined && applies(tip)
        : tip.stage === id && applies(tip),
    );
  const lengths = new Set(groups.map((group) => show(group.panel.length)));
  const list = (items: string[]): string =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

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
        lengths.size === 1
          ? `Crosscut each board to ${show(panel.length)}, as shown in the table.`
          : `Crosscut each board into the lengths shown in the table: ${list(
              groups.map((group) => `${show(group.panel.length)} for ${groupName(group)}`),
            )}. Keep the strips for each panel in their own stack.`,
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
      title: panelCount > 1 ? 'Glue the strips into panels' : 'Glue the strips into a panel',
      steps: [
        ...(several
          ? [
              `You are making ${groups.length} different panels: ${list(groups.map(groupName))}. Each has its own strip order. Repeat these steps for each.`,
            ]
          : panelCount > 1
            ? [`You are making ${panelCount} identical panels. Repeat these steps for each.`]
            : []),
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
      title: panelCount > 1 ? 'Slice the panels' : 'Slice the panel',
      steps: [
        panelCount > 1
          ? 'Trim one end of each panel square on a crosscut sled.'
          : 'Trim one end of the panel square on a crosscut sled.',
        `Clamp a stop block to the sled ${show(recipe.cut.sliceThickness)} from the blade.`,
        several || reRipped
          ? `Push the squared end against the stop and cut. Cut ${list(
              groups.map((group) => `${group.slicesEach} slices from ${several ? groupName(group) : 'the panel'}`),
            )}.`
          : `Push the squared end against the stop and cut. Repeat until you have ${slices} slices${panelCount > 1 ? ' from all the panels together' : ''}.`,
        grid
          ? 'Stack the tiles as they come off the saw. They are all alike, so their order does not matter.'
          : several
            ? 'Write the letter of its panel on each slice as it comes off the saw.'
            : 'Number each slice in pencil as it comes off the saw, so you can keep them in order.',
      ],
    },
    ...(reRipped
      ? [
          {
            id: 'rerip' as const,
            title: 'Rip the slices into pieces',
            steps: [
              'Lay a slice on the saw table with a sawn, end grain face down and one long edge against the rip fence.',
              'Set the fence to the widest width in the table and rip that piece from every slice that lists it before moving the fence. Then work down through the widths.',
              'The slices are short and the pieces thin: use a push block that rides over the piece and keeps it against the fence.',
              ...(narrow ? ['Cut the narrowest pieces a little over size and sand them down to width.'] : []),
              `Write ${several ? 'the panel letter and ' : ''}the width on each piece as it is cut.`,
            ],
          },
        ]
      : []),
    {
      id: 'arrange',
      title: reRipped ? 'Arrange and glue the pieces' : 'Arrange and glue the slices',
      steps: [
        grid
          ? 'Stand each tile so the end grain faces up.'
          : reRipped
            ? 'Stand each piece so the end grain faces up.'
            : 'Roll each slice a quarter turn so the end grain faces up, keeping them in numbered order.',
        info.arrange,
        'Check the dry layout against the picture before you open the glue.',
        ...(grid
          ? [
              'Glue one row of tiles at a time: spread glue on the faces that meet, press the tiles together and clamp along the row. Keep each row straight against a flat edge.',
              'When the rows are dry, glue them to each other, lining up the joints between tiles.',
            ]
          : [
              `Spread glue on the faces that meet, press the ${reRipped ? 'pieces' : 'slices'} together, and clamp across them.`,
            ]),
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

  if (tumbling) {
    // Tumbling blocks are sticks, logs and pucks, not strips, panels and slices.
    const [top] = tumbling.recipe.panels[0]!.strips;
    const topName = speciesById(top!.species)?.name ?? top!.species;
    const replace = (id: StageId, title: string, steps: string[]): void => {
      const stage = stages.find((entry) => entry.id === id)!;
      stage.title = title;
      stage.steps = steps;
    };
    replace('strips', 'Cut the diamond sticks', [
      ...(planing ? ['Plane the thicker boards down first, so that all your boards are the same thickness.'] : []),
      `Crosscut each board to ${show(tumbling.logLength)}, as shown in the table.`,
      `Tilt the blade ${TUMBLING_TILT} degrees from upright, which is ${90 - TUMBLING_TILT} degrees from the table.`,
      'Rip a slanted edge along each board first. That narrow offcut is waste.',
      `Rip the sticks, ${show(tumbling.side)} wide on the face, with the slanted edge against the fence and the same face up for every cut.`,
      'Measure all four sides of the first stick. They must be equal: move the fence until they are, then rip the rest.',
      'Tape one stick of each wood together dry. They should close into a six-sided log with no gaps.',
    ]);
    replace('panel', 'Glue the sticks into logs', [
      `You are making ${tumbling.logs === 1 ? 'one log' : `${tumbling.logs} identical logs`}, each from one stick of each wood.`,
      'Lay the three sticks side by side, sharp edges together, and spread glue thinly on the faces that will meet.',
      'Close them into a six-sided log, with the woods in the same order round every log.',
      'Wrap the log tightly along its whole length with painter’s tape or strong rubber bands.',
      'Leave the logs wrapped until the glue has set, then unwrap them and scrape off any glue. Wait 24 hours before sawing.',
    ]);
    replace('slice', 'Slice the logs into pucks', [
      'Trim one end of each log square.',
      `Clamp a stop block ${show(recipe.cut.sliceThickness)} from the blade.`,
      `Cut ${tumbling.pucksPerLog} pucks from each log: you need ${tumbling.pucks} in all.`,
      'Rub the fuzz off the edges of each puck with fine sandpaper. Do not sand the six sides, or the angles will change.',
    ]);
    replace('arrange', 'Arrange and glue the pucks', [
      `Saw ${tumbling.pucksToHalve} of the pucks in half from point to point, through the middle of the ${topName} diamond.`,
      'Fix two straight boards to the bench at a right angle, over wax paper, to build against.',
      `Lay everything out dry, end grain up, with the ${topName} diamond at the top of every puck. Each row is ${tumbling.columns} whole pucks and one half; the half goes at the right of the first row, the left of the second, and so on.`,
      'Glue one whole row at a time against the straight boards, and scrape the squeezed-out glue from the open joints before adding the next row.',
      'Clamp gently from the sides, watching that the rows do not lift. Leave the board clamped for 24 hours.',
    ]);
    replace('flatten', 'Trim and flatten', [
      `Trim all four edges square, along the dashed lines in the picture, to ${show(board.length)} by ${show(board.width)}.`,
      `Flatten one face, turn the board over and flatten the other, working down to ${show(board.thickness)} thick.`,
      'Check with a straightedge that the board does not rock on a flat surface.',
    ]);
  }

  return stages.map((stage) => ({ ...stage, tips: tipsFor(stage.id) }));
}
