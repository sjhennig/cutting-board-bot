/**
 * Build tips, each tied to the stage where it applies.
 *
 * Every tip rests on at least one source that was opened and read on the date given.
 * A tip whose source could not be read does not belong here. Where good sources disagree,
 * `otherView` says so instead of hiding it.
 */
export type StageId = 'wood' | 'strips' | 'panel' | 'slice' | 'arrange' | 'flatten' | 'sand' | 'finish' | 'care';

export interface Source {
  name: string;
  url: string;
}

export interface Tip {
  id: string;
  stage: StageId;
  title: string;
  text: string;
  sources: Source[];
  /** A credible source that does it differently. */
  otherView?: { text: string; sources: Source[] };
  /** Only shown when the design calls for it. */
  when?: 'narrow-pieces' | 'needs-ripping' | 'shifted-slices';
}

/** The date the sources below were last opened and read. */
export const SOURCES_CHECKED = '2026-11-09';

const MTM_PLAN: Source = {
  name: 'MTM Wood, "A 3D End Grain Cutting Board #1" plan',
  url: 'https://mtmwood.com/download/3D1_for_13_planer.pdf',
};
const MTM_CARE: Source = {
  name: 'MTM Wood, "Rules of care of boards"',
  url: 'https://mtmwood.com/en/index.php?route=information/information&information_id=11',
};
const TITEBOND_3: Source = {
  name: 'Titebond III Ultimate Wood Glue, product page',
  url: 'https://www.titebond.com/product/glues/e8d40b45-0ab3-49f7-8a9c-b53970f736af',
};
const TITEBOND_2: Source = {
  name: 'Titebond II Premium Wood Glue, product page',
  url: 'https://www.titebond.com/product/glues/2ef3e95d-48d2-43bc-8e1b-217a38930fa2',
};
const FWW_TABLE_SAW: Source = {
  name: 'Fine Woodworking, "Safety Manual: Table Saw"',
  url: 'https://www.finewoodworking.com/2009/04/01/safety-manual-tablesaw',
};
const FWW_FINISHES: Source = {
  name: 'Fine Woodworking, "Food Safe Wood Finishes"',
  url: 'https://www.finewoodworking.com/project-guides/woodworking-basics/food-safe-finishes',
};
const WWGOA_PLANER: Source = {
  name: 'WoodWorkers Guild of America, "Running an End Grain Cutting Board in a Planer?"',
  url: 'https://www.wwgoa.com/video/running-end-grain-cutting-board-planer',
};
const TOH_BOARD: Source = {
  name: 'This Old House, "How to Make a Wood Cutting Board"',
  url: 'https://www.thisoldhouse.com/how-to-make-an-end-grain-wood-cutting-board',
};
const TWW_PLANER: Source = {
  name: 'The Wood Whisperer, "End-grain Through the Planer? Bad Idea!"',
  url: 'https://thewoodwhisperer.com/articles/end-grain-through-the-planer/',
};
const TWW_FINISH: Source = {
  name: 'The Wood Whisperer, "Cutting Board Finish: Oil vs Varnish"',
  url: 'https://thewoodwhisperer.com/articles/cutting-board-finish/',
};

export const TIPS: Tip[] = [
  {
    id: 'same-thickness',
    stage: 'strips',
    title: 'Get every strip the same thickness',
    text: 'Check that all your boards are the same thickness before you rip them. Any difference shows up as steps in the glued panel and gaps in the finished board.',
    sources: [MTM_PLAN],
  },
  {
    id: 'rip-safely',
    stage: 'strips',
    when: 'needs-ripping',
    title: 'Rip against the fence, with a push stick',
    text: 'Use the rip fence for ripping, keep a riving knife or splitter fitted to prevent kickback, and use push sticks to keep your hands away from the blade.',
    sources: [FWW_TABLE_SAW],
  },
  {
    id: 'oversize-narrow',
    stage: 'strips',
    when: 'narrow-pieces',
    title: 'Cut narrow pieces oversize',
    text: 'Saw thin strips 1 to 1.5 mm (about 1/16 in.) over size and sand them down to the final width. It is far more accurate than trying to saw them exactly.',
    sources: [MTM_PLAN],
  },
  {
    id: 'glue-choice',
    stage: 'panel',
    title: 'Use a waterproof glue with a long open time',
    text: 'Titebond III is rated waterproof and gives you 8 to 10 minutes before the glue starts to grab, against 3 to 5 minutes for Titebond II. The maker states both are FDA-compliant for indirect food contact, such as cutting boards.',
    sources: [TITEBOND_3, TITEBOND_2],
  },
  {
    id: 'alternate-grain',
    stage: 'panel',
    title: 'Vary the growth rings from strip to strip',
    text: 'Look at the end of each strip and turn the strips so the curve of the rings changes direction from one to the next. This helps the finished block resist warping and splitting when it gets wet.',
    sources: [TOH_BOARD],
  },
  {
    id: 'clamp-evenly',
    stage: 'panel',
    title: 'Clamp from both faces, a little at a time',
    text: 'Place clamps square to the edge, snug them lightly, turn the panel over and add clamps on the other face. Then tighten them all gradually with the same force. Leave it for 24 hours.',
    sources: [MTM_PLAN],
  },
  {
    id: 'plane-panel',
    stage: 'panel',
    title: 'This is the one time a planer is fine',
    text: 'Once the glue is dry, flatten the panel before you slice it. The grain still runs along the panel at this stage, so a thickness planer is safe to use here.',
    sources: [WWGOA_PLANER],
  },
  {
    id: 'no-fence-and-gauge',
    stage: 'slice',
    title: 'Never use the rip fence and the miter gauge together',
    text: 'Crosscut with a sled or the miter gauge, and rip with the fence: never both at once. It is one of the basic table saw safety rules.',
    sources: [FWW_TABLE_SAW],
  },
  {
    id: 'mark-slices',
    stage: 'arrange',
    title: 'Mark the top of every slice',
    text: 'Once the slices are turned end grain up, mark the top face of each and keep them that way round. It makes for a more accurate pattern.',
    sources: [MTM_PLAN],
  },
  {
    id: 'assembly-time',
    stage: 'arrange',
    title: 'Work inside the glue’s assembly time',
    text: 'Titebond III allows 20 to 25 minutes in total from first spreading glue to full clamp pressure, and Titebond II only 10 to 15. Lay everything out and rehearse before you open the bottle.',
    sources: [TITEBOND_3, TITEBOND_2],
  },
  {
    id: 'slices-slip',
    stage: 'arrange',
    title: 'Watch for slices sliding as you clamp',
    text: 'Slices skate on wet glue as the clamps tighten, and it cannot be corrected once the glue sets. Line the pattern up by eye, tighten slowly, and keep checking.',
    sources: [MTM_PLAN],
  },
  {
    id: 'no-planer',
    stage: 'flatten',
    title: 'Do not put an end grain board through a planer',
    text: 'Use a router sled or a drum sander. Planer knives can catch the upright fibres: woodworkers report boards thrown back, shattered boards and broken planer blades.',
    sources: [TWW_PLANER],
    otherView: {
      text: 'Some experienced makers do plane end grain. They glue sacrificial strips to the ends first, take off only 0.3 to 0.5 mm per pass, and cut the strips off afterwards. Treat this as an expert technique.',
      sources: [MTM_PLAN, TOH_BOARD],
    },
  },
  {
    id: 'grit-steps',
    stage: 'sand',
    title: 'Never more than double the grit',
    text: 'End grain shows scratches, so do not skip ahead. Each sandpaper grit should be no more than twice the one before: 80, then 120, then 180 or 220.',
    sources: [MTM_PLAN],
  },
  {
    id: 'round-edges',
    stage: 'sand',
    title: 'Ease every edge and corner',
    text: 'Round all sharp edges and corners with a sanding block, or a router with a round-over bit.',
    sources: [MTM_PLAN, TOH_BOARD],
  },
  {
    id: 'mineral-oil',
    stage: 'finish',
    title: 'Soak it with food-grade mineral oil',
    text: 'Rub mineral oil onto every side, wait 20 minutes, wipe off the excess, then apply it again. Oil all sides: treating one face only can make the board bend.',
    sources: [TOH_BOARD, MTM_CARE],
    otherView: {
      text: 'Marc Spagnuolo of The Wood Whisperer prefers a thinned varnish ("salad bowl finish") soaked into the wood without building a surface film.',
      sources: [TWW_FINISH],
    },
  },
  {
    id: 'board-butter',
    stage: 'finish',
    title: 'Top it with oil and beeswax',
    text: 'A mix of about four or five parts mineral oil to one part beeswax gives a more water-repellent surface. Warm the oil gently to melt the wax in: on high heat it can catch fire.',
    sources: [MTM_PLAN, FWW_FINISHES],
  },
  {
    id: 'no-cooking-oil',
    stage: 'finish',
    title: 'Do not use cooking oils',
    text: 'Vegetable, corn, sunflower and olive oils turn rancid in the wood and pass the taste on to food.',
    sources: [WWGOA_PLANER, MTM_CARE],
  },
  {
    id: 'feet',
    stage: 'finish',
    title: 'Consider adding feet',
    text: 'MTM Wood finishes its boards with rubber or silicone feet, fixed with stainless steel screws.',
    sources: [MTM_PLAN],
  },
  {
    id: 'care-water',
    stage: 'care',
    title: 'Keep it out of the dishwasher',
    text: 'Never put an end grain board in a dishwasher, and do not leave it wet or standing in water.',
    sources: [MTM_CARE],
  },
  {
    id: 'care-oil',
    stage: 'care',
    title: 'Oil it about once a month',
    text: 'Re-oil at least monthly, and more often in winter when heating dries the air. Use mineral oil, or the oil and beeswax mix.',
    sources: [MTM_CARE],
  },
];
