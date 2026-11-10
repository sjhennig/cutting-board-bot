import type { ReactNode } from 'react';
import { SOURCES_CHECKED, type StageId, type Tip } from '../data/tips';
import { WOOD_VAULT } from '../data/woodVault';
import type { CatalogBoard } from '../data/woodVault';
import { formatLength, type PlannedBoard } from '../engine';
import type { Update } from './App';
import { designSpecies, fitToStock, patternInfo, type Design, type DesignState } from './design';
import { ArrangeDiagram, FlattenDiagram, HoneycombDiagram, LogDiagram, StockCutDiagram } from './diagrams';
import { buildGuide } from './guide';
import { groupName, panelGroups, reRipRows } from './panels';
import { BoardPreview, Notices, PanelPreview, Swatch, speciesName } from './parts';

/** The stages that make up the cut list. The rest appear only with full instructions. */
const CUT_LIST_STAGES: StageId[] = ['wood', 'strips', 'panel', 'slice', 'rerip', 'arrange', 'flatten'];

function TipCard({ tip }: { tip: Tip }) {
  const links = (sources: Tip['sources']): ReactNode =>
    sources.map((source, index) => (
      <span key={source.url}>
        {index > 0 && '; '}
        <a href={source.url}>{source.name}</a>
      </span>
    ));
  return (
    <li className="tip">
      <strong>{tip.title}</strong>
      <p>{tip.text}</p>
      <p className="source">Source: {links(tip.sources)}</p>
      {tip.otherView && (
        <p className="other-view">
          <strong>Another view.</strong> {tip.otherView.text}{' '}
          <span className="source">Source: {links(tip.otherView.sources)}</span>
        </p>
      )}
    </li>
  );
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
/** A list joined with "; ", shown one item to a line. */
const lines = (text: string): ReactNode => text.split('; ').map((line, index) => <div key={index}>{line}</div>);
/** A pattern name in the middle of a sentence: "Basket weave" becomes "basket weave", "3D illusion" stays. */
export const inSentence = (name: string): string => name.replace(/^[A-Z](?=[a-z])/, (letter) => letter.toLowerCase());
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const list = (items: string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function PlanStep({
  state,
  update,
  design,
  error,
}: {
  state: DesignState;
  update: Update;
  design: Design | null;
  error: string | null;
}) {
  if (!design) {
    return (
      <>
        <h2>Your cut list</h2>
        <p className="empty">{error} Go back a step to fix this.</p>
      </>
    );
  }

  const show = (mm: number): string => formatLength(mm, state.unit);
  const { recipe, board, plan, rips, purchase, tumbling } = design;
  // Most designs have one kind of panel. Some have several, each with its own strips and length.
  const groups = panelGroups(recipe);
  const several = groups.length > 1;
  const info = patternInfo(state.pattern);
  const slices = recipe.slices.length;
  const panelCount = recipe.panels.length;
  const slicesPerPanel = Math.max(...board.panels.map((report) => report.slicesAvailable));
  const grid = (recipe.columns ?? 1) > 1;
  const tilt = groups.find((group) => group.panel.bevel !== undefined)?.panel.bevel;
  const stripLengths = [...new Set(groups.map((group) => show(group.panel.length)))];
  const reRips = reRipRows(recipe);
  const reRipped = reRips.length > 0;
  const reRippedCount = recipe.slices.filter((slice) => slice.ripTo !== undefined).length;
  const width = Math.max(...groups.map((group) => group.width));
  const turnedOver = recipe.slices.some((slice) => slice.over);
  const flipped = recipe.slices.flatMap((slice, index) => (slice.flip ? [index + 1] : []));
  const trimmed = width - board.length > 0.01;
  const blocked = design.notices.some((notice) => notice.level === 'problem');
  const percent = (part: number): string => `${Math.round((part / board.waste.supplied) * 100)}%`;
  const lost = board.waste.supplied - board.waste.board - board.waste.panelLeftover;

  const sizeOf = (stockId: string): { thickness: number; width: number; length: number } | undefined =>
    state.woodMode === 'buy'
      ? purchase.find((line) => line.board.id === stockId)?.board
      : state.stock.find((item) => item.id === stockId);
  // When one wood comes in several sizes, the size is part of the board's name.
  const sizesOf = (species: string): number =>
    new Set(plan.boards.filter((planned) => planned.species === species).map((planned) => planned.stockId)).size;
  const woodName = (planned: PlannedBoard): string => {
    const size = sizeOf(planned.stockId);
    return sizesOf(planned.species) > 1 && size
      ? `${speciesName(planned.species)} ${show(size.thickness)} × ${show(size.width)}`
      : speciesName(planned.species);
  };
  const boardName = (planned: PlannedBoard): string => `${woodName(planned)} board ${planned.copy}`;
  const totalBoards = plan.boards.length;

  // One row per board, with identical boards merged: "Hard maple boards 1 to 5".
  interface BoardRow {
    key: string;
    species: string;
    first: number;
    last: number;
    name: string;
    planned: PlannedBoard;
    lengths: string;
    rip: string;
    offcuts: string;
  }
  const boardRows: BoardRow[] = [];
  let anyRipping = false;
  for (const planned of plan.boards) {
    const widths = new Map<string, number>();
    for (const strip of planned.segments.flatMap((segment) => segment.strips)) {
      const key = show(strip.ripWidth);
      widths.set(key, (widths.get(key) ?? 0) + 1);
    }
    const noRip = planned.segments.every((segment) => segment.strips.length === 1 && segment.leftoverWidth < 0.01);
    if (!noRip) anyRipping = true;
    const offcuts = planned.segments
      .filter((segment) => segment.leftoverWidth > 0.5)
      .map((segment) => `${show(segment.leftoverWidth)} × ${show(segment.length)} strip`);
    if (planned.leftoverLength > 0.5) offcuts.push(`${show(planned.leftoverLength)} off the end`);
    const tally = (items: string[]): string => {
      const counts = new Map<string, number>();
      for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
      return [...counts].map(([size, count]) => `${count} × ${size}`).join(', ');
    };
    const pieceLengths = new Set(planned.segments.map((segment) => show(segment.length)));
    const row = {
      species: planned.species,
      lengths: tally(planned.segments.map((segment) => show(segment.length))),
      rip: noRip
        ? 'No ripping: already the right width'
        : pieceLengths.size > 1
          ? // Lengths for different panels: say which strips come from which.
            planned.segments
              .map(
                (segment) =>
                  `${show(segment.length)} piece: ${tally(segment.strips.map((strip) => show(strip.ripWidth)))}`,
              )
              .join('; ')
          : [...widths].map(([size, count]) => `${count} × ${size}`).join(', '),
      offcuts: offcuts.length > 0 ? offcuts.join('; ') : 'Nothing',
    };
    const previous = boardRows[boardRows.length - 1];
    if (
      previous &&
      previous.species === row.species &&
      previous.lengths === row.lengths &&
      previous.rip === row.rip &&
      previous.offcuts === row.offcuts &&
      previous.key.startsWith(`${planned.stockId}-`)
    ) {
      previous.last = planned.copy;
      previous.name = `${woodName(planned)} boards ${previous.first} ${previous.last - previous.first === 1 ? 'and' : 'to'} ${previous.last} (each)`;
    } else {
      boardRows.push({
        ...row,
        key: `${planned.stockId}-${planned.copy}`,
        first: planned.copy,
        last: planned.copy,
        name: boardName(planned),
        planned,
      });
    }
  }
  const oneLengthEach = plan.boards.every((planned) => planned.segments.length === 1);

  const guide = state.showGuide;
  const stages = buildGuide(state, design).filter((stage) => guide || CUT_LIST_STAGES.includes(stage.id));

  const content: Partial<Record<StageId, ReactNode>> = {
    wood: (
      <>
        <p className="headline">{plural(totalBoards, 'board')} in total.</p>
        {state.woodMode === 'buy' ? (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="col">How many</th>
                  <th scope="col">Wood</th>
                  <th scope="col">Product</th>
                  <th scope="col">Size (thick × wide × long)</th>
                </tr>
              </thead>
              <tbody>
                {purchase.map((line) => {
                  const item = line.board as CatalogBoard;
                  return (
                    <tr key={item.id}>
                      <td className="count">{line.quantity}</td>
                      <td>
                        <Swatch species={item.species} /> {speciesName(item.species)}
                      </td>
                      <td>
                        {item.line === 'blank'
                          ? 'Cutting board blank'
                          : item.line === 'thick'
                            ? 'Thick surfaced board'
                            : 'Surfaced board'}
                      </td>
                      <td>
                        {show(item.thickness)} × {show(item.width)} × {show(item.listedLength)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="help">
              Sizes are from <a href={WOOD_VAULT.url}>{WOOD_VAULT.name}</a>, as a reference. Boards often arrive up to
              1/4 in. shorter than listed; this plan allows for that. Consider adding one spare of each wood in case a
              board has a flaw.
            </p>
            <div className="presets own-sizes">
              <button
                type="button"
                className="chip"
                onClick={() =>
                  update(
                    fitToStock(state, {
                      woodMode: 'have',
                      excluded: [],
                      stock: purchase.map((line, index) => ({
                        id: `own-${Date.now()}-${index}`,
                        species: line.board.species,
                        thickness: line.board.thickness,
                        width: line.board.width,
                        length: line.board.length,
                        quantity: line.quantity,
                      })),
                    }),
                  )
                }
              >
                My boards are a different size
              </button>
              <span>Copies this list to the Your wood step, where you can enter what you measure.</span>
            </div>
          </>
        ) : (
          <p className="help">The table in the next step shows which of your boards are used.</p>
        )}
      </>
    ),
    strips: (
      <>
        {stripLengths.length === 1 ? (
          <p>
            Every {tumbling ? 'stick' : 'strip'} is <strong>{stripLengths[0]}</strong> long.{' '}
            {anyRipping
              ? `Cut each board to that length first, then rip it into ${tumbling ? 'sticks' : 'strips'}.`
              : 'Cut each board to that length.'}
          </p>
        ) : (
          <p>
            The panels are different lengths:{' '}
            {list(groups.map((group) => `strips for ${groupName(group)} are ${show(group.panel.length)} long`))}.{' '}
            {anyRipping
              ? 'Cut each board into those lengths first, then rip each length into the strips listed for it.'
              : 'Cut each board into those lengths.'}{' '}
            Keep the strips for each panel in their own stack.
          </p>
        )}
        {tumbling && (
          <p>
            Rip with the blade tilted <strong>{tilt} degrees from upright</strong> ({90 - (tilt ?? 0)} degrees from the
            table), so every stick is a diamond with four equal sides of <strong>{show(tumbling.side)}</strong>. The
            widths below are measured along the face of the board. The first cut on each board only makes the slanted
            edge: that offcut is waste.
          </p>
        )}
        {tilt !== undefined && !tumbling && (
          <p>
            Rip with the blade tilted <strong>{tilt} degrees</strong>, so every strip has slanted sides. The widths
            below are measured along the face of the board. The first strip off each board keeps one square edge: set
            two of these aside for the outside of the panel, and trim the square edge off the rest with one more tilted
            cut.
          </p>
        )}
        {oneLengthEach && !tumbling && (
          <p className="help">
            That length gives exactly the slices you need. If you would like a spare slice or two, leave the boards
            longer: the extra just becomes more slices.
          </p>
        )}
        <table className="cuts">
          <thead>
            <tr>
              <th scope="col">Board</th>
              <th scope="col">Cut to length</th>
              <th scope="col">Rip into</th>
              <th scope="col">Left over</th>
            </tr>
          </thead>
          <tbody>
            {boardRows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <Swatch species={row.species} /> {row.name}
                </th>
                <td>{row.lengths}</td>
                <td>{lines(row.rip)}</td>
                <td>{lines(row.offcuts)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rips.some((line) => line.planeTo !== undefined || line.orientation === 'onEdge') && (
          <ul className="notes">
            {rips
              .filter((line) => line.planeTo !== undefined)
              .map((line, index) => (
                <li key={`plane-${index}`}>
                  Plane the {speciesName(line.species)} down to {show(line.planeTo!)} before ripping, so every strip is
                  the same thickness.
                </li>
              ))}
            {rips
              .filter((line) => line.orientation === 'onEdge')
              .map((line, index) => (
                <li key={`edge-${index}`}>
                  The {speciesName(line.species)} strips are ripped {show(line.ripWidth)} wide and then stood on edge in
                  the glue-up, so the board's thickness becomes the strip's width.
                </li>
              ))}
          </ul>
        )}

        {anyRipping && (
          <table className="fence">
            <caption>
              {tilt !== undefined ? `Rips, with the blade tilted ${tilt} degrees` : 'Fence settings for ripping'}
            </caption>
            <thead>
              <tr>
                <th scope="col">{tumbling ? 'Stick width' : tilt !== undefined ? 'Strip width' : 'Set fence to'}</th>
                <th scope="col">Wood</th>
                {stripLengths.length > 1 && <th scope="col">Strip length</th>}
                <th scope="col">{tumbling ? 'Sticks' : 'Strips'}</th>
              </tr>
            </thead>
            <tbody>
              {rips.map((line, index) => (
                <tr key={index}>
                  <td>{show(line.ripWidth)}</td>
                  <td>
                    <Swatch species={line.species} /> {speciesName(line.species)}
                  </td>
                  {stripLengths.length > 1 && <td>{show(line.length)}</td>}
                  <td className="count">{line.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    ),
    panel: (
      <>
        {several && (
          <p>
            Make {groups.length} different panels: {list(groups.map(groupName))}. Each has its own strip order.
          </p>
        )}
        {groups.map((group, groupIndex) => {
          const copies = group.ids.length;
          const first = groups[0]!.panel.strips;
          const sameWidths =
            groupIndex > 0 &&
            group.panel.strips.length === first.length &&
            group.panel.strips.every((strip, index) => strip.width === first[index]!.width);
          return (
            <div key={group.ids[0]} className="panel-group">
              {several && <h4>{capital(groupName(group))}</h4>}
              <p>
                {copies > 1 && `Make ${copies} identical panels. For each one, lay `}
                {copies === 1 && 'Lay '}
                out {plural(group.panel.strips.length, 'strip')} side by side in this order and glue them edge to edge.
                {group.panel.bevel !== undefined &&
                  ' All the slants must lean the same way, with the two square edges on the outside.'}{' '}
                {copies > 1 ? 'Each panel' : 'The panel'} will be <strong>{show(group.width)}</strong> wide,{' '}
                {show(group.panel.thickness)} thick and {show(group.panel.length)} long.
                {sameWidths && ` The widths are the same as ${groupName(groups[0]!)}; only the woods differ.`}
              </p>
              <ol className="strip-order">
                {group.panel.strips.map((strip, index) => (
                  <li key={index}>
                    <Swatch species={strip.species} /> {speciesName(strip.species)} {show(strip.width)}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </>
    ),
    slice: (
      <>
        {several || reRipped ? (
          <p>
            Square one end of {panelCount > 1 ? 'each panel' : 'the panel'}, then crosscut{' '}
            <strong>
              {list(
                groups.map(
                  (group) =>
                    `${several ? groupName(group) : 'it'} into ${plural(group.slicesEach, 'slice')}${group.ids.length > 1 ? ' each' : ''}`,
                ),
              )}
            </strong>
            , each <strong>{show(recipe.cut.sliceThickness)}</strong> thick. Use a crosscut sled with a stop block so
            every slice is identical.{several && ' Write the letter of its panel on each slice.'}
          </p>
        ) : (
          <p>
            {panelCount > 1
              ? `Square one end of each panel, then crosscut each into ${plural(slicesPerPanel, 'slice')}. You need `
              : 'Square one end of the panel, then crosscut it into '}
            <strong>{plural(slices, 'slice')}</strong>
            {panelCount > 1 && ' in all'}, each <strong>{show(recipe.cut.sliceThickness)}</strong> thick. Use a crosscut
            sled with a stop block so every slice is identical. Number the slices in order as they come off the saw.
          </p>
        )}
        <p className="help">
          The slices are cut {show(recipe.flattenPerFace * 2)} thicker than the finished board to leave room for
          flattening.
        </p>
      </>
    ),
    rerip: (
      <>
        <p>
          {reRippedCount === slices ? (
            <>
              Rip each slice along its length into narrower pieces, as listed. That makes the{' '}
              <strong>{plural(slices, 'piece')}</strong> of the board.
            </>
          ) : (
            <>
              Rip the slices listed here along their length into narrower pieces. That makes{' '}
              <strong>{plural(reRippedCount, 'narrow piece')}</strong>; the other slices are used whole.
            </>
          )}{' '}
          Set the fence once for each width and cut every piece of that width before moving it.
        </p>
        <table className="fence">
          <caption>Pieces to rip from each slice</caption>
          <thead>
            <tr>
              {several && <th scope="col">From</th>}
              <th scope="col">Slices</th>
              <th scope="col">Rip each into</th>
            </tr>
          </thead>
          <tbody>
            {reRips.map((row, index) => (
              <tr key={index}>
                {several && <td>Panel {row.panel}</td>}
                <td className="count">{row.slices}</td>
                <td>{row.widths.map(show).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="help">
          Write {several ? 'the panel letter and ' : ''}the width on each piece as you cut it. They are hard to tell
          apart later.
        </p>
      </>
    ),
    arrange: (
      <>
        <p>
          {grid
            ? 'Stand each tile so the end grain faces up.'
            : reRipped
              ? 'Stand each piece so the end grain faces up.'
              : 'Roll each slice a quarter turn so the end grain faces up.'}{' '}
          {info.arrange}
          {flipped.length > 0 && state.pattern === 'chaotic' && ` Slices to turn: ${flipped.join(', ')}.`}
        </p>
        <p>
          {grid
            ? 'Check the pattern against the picture. Glue the tiles of each row together first, then glue the rows to each other.'
            : `Check the pattern against the picture, then glue the ${reRipped ? 'pieces' : 'slices'} together.`}
        </p>
        {reRipped && (
          <ol className="strip-order">
            {recipe.slices.map((slice, index) => (
              <li key={index}>
                {several && `Panel ${slice.panel}, `}
                {slice.ripTo !== undefined ? show(slice.ripTo) : 'whole slice'}
                {slice.flip && ', turned end for end'}
              </li>
            ))}
          </ol>
        )}
      </>
    ),
    flatten: (
      <>
        <p>
          {trimmed
            ? `Trim both ends square, taking the board to ${show(board.length)} long. `
            : 'Trim the edges just enough to clean them up. '}
          Flatten both faces down to <strong>{show(board.thickness)}</strong> thick.
        </p>
        {!guide && (
          <p className="help">
            Flatten with a router sled or a drum sander. Do not run an end grain board through a thickness planer: the
            knives can catch the fibres and throw or shatter the board.
          </p>
        )}
      </>
    ),
  };

  // One picture for each kind of panel, labelled when there is more than one.
  const panelPictures = (cuts: boolean): ReactNode =>
    several ? (
      <div className="stock-cuts">
        {groups.map((group) => (
          <div key={group.ids[0]}>
            <PanelPreview recipe={recipe} panelIndex={group.index} cuts={cuts} />
            <span>{capital(groupName(group))}</span>
          </div>
        ))}
      </div>
    ) : (
      <PanelPreview recipe={recipe} cuts={cuts} />
    );

  let diagrams: Partial<Record<StageId, { picture: ReactNode; caption: string }>> = {
    strips: {
      picture: (
        <div className="stock-cuts">
          {boardRows.map((row) => {
            const size = sizeOf(row.planned.stockId);
            return size ? (
              <div key={row.key}>
                <StockCutDiagram
                  planned={row.planned}
                  width={size.width}
                  length={size.length}
                  kerf={state.kerf}
                  label={`${row.name}: cut to length, then ${row.rip.toLowerCase()}`}
                />
                <span>{row.name}</span>
              </div>
            ) : null;
          })}
        </div>
      ),
      caption: 'Each board from above. Coloured areas are strips; hatched areas are left over.',
    },
    panel: {
      picture: panelPictures(false),
      caption: several
        ? 'Each glued panel from above. Strip 1 is at the top.'
        : 'The glued panel from above. Strip 1 is at the top.',
    },
    slice: {
      picture: panelPictures(true),
      caption: 'Dashed lines are the crosscuts. The first cut squares the end.',
    },
    arrange: {
      picture: (
        <ArrangeDiagram
          recipe={recipe}
          showPanels={several}
          label={`The ${slices} ${reRipped ? 'pieces' : 'slices'} in order, end grain up. ${info.arrange}`}
        />
      ),
      caption:
        (grid
          ? 'The tiles in position, end grain up, before they are pushed together.'
          : `The ${reRipped ? 'pieces' : 'slices'} in order, end grain up, before they are pushed together.`) +
        (several ? ' The letter is the panel each piece is cut from.' : '') +
        (flipped.length > 0 ? ' ⇄ marks a slice turned end for end.' : '') +
        (turnedOver ? ' ⇅ marks a slice turned upside down.' : '') +
        (trimmed ? ' Dashed lines show where the ends are trimmed.' : ''),
    },
    flatten: {
      picture: (
        <FlattenDiagram
          length={board.length}
          sliceThickness={recipe.cut.sliceThickness}
          perFace={recipe.flattenPerFace}
          label={`The board from the side: ${show(recipe.flattenPerFace)} is removed from each face`}
        />
      ),
      caption: `The board from the side. The hatched layers, ${show(recipe.flattenPerFace)} on each face, are removed. Thickness is drawn at double scale.`,
    },
  };

  if (tumbling) {
    // Sticks, logs and pucks in place of strips, panels and slices.
    const woods = tumbling.recipe.panels[0]!.strips.map((strip) => strip.species);
    const spare = tumbling.logs * tumbling.pucksPerLog - tumbling.pucks;
    content.panel = (
      <>
        <p>
          Glue one stick of each wood into a six-sided log, with the woods in the same order round every log. Make{' '}
          <strong>{plural(tumbling.logs, 'log')}</strong>, each {show(tumbling.acrossFlats)} across its flat sides and{' '}
          {show(tumbling.logLength)} long. Wrap each log tightly with painter's tape or strong rubber bands while the
          glue sets.
        </p>
        <ol className="strip-order">
          {woods.map((species, index) => (
            <li key={species}>
              <Swatch species={species} /> {speciesName(species)}:{' '}
              {['the top', 'the left face', 'the right face'][index]} of each cube
            </li>
          ))}
        </ol>
      </>
    );
    content.slice = (
      <>
        <p>
          Square one end of each log, then crosscut {tumbling.logs > 1 ? 'each' : 'it'} into{' '}
          <strong>{plural(tumbling.pucksPerLog, 'puck')}</strong>, each{' '}
          <strong>{show(recipe.cut.sliceThickness)}</strong> thick. You need {tumbling.pucks} pucks
          {spare > 0 ? `, so ${spare === 1 ? 'one is' : `${spare} are`} spare` : ''}. Use a stop block so every puck is
          identical.
        </p>
        <p className="help">
          The pucks are cut {show(recipe.flattenPerFace * 2)} thicker than the finished board to leave room for
          flattening.
        </p>
      </>
    );
    content.arrange = (
      <>
        <p>
          Saw <strong>{plural(tumbling.pucksToHalve, 'puck')}</strong> in half from point to point, through the middle
          of the {speciesName(woods[0]!)} diamond. Stand every puck end grain up with the {speciesName(woods[0]!)}{' '}
          diamond at the top.
        </p>
        <p>
          Lay out <strong>{plural(tumbling.rows, 'row')}</strong> of {plural(tumbling.columns, 'whole puck')} and one
          half puck. The half goes at the right-hand end of the first row, the left-hand end of the second, and so on.
          Check the pattern against the picture, then glue one row at a time.
        </p>
      </>
    );
    content.flatten = (
      <>
        <p>
          Trim all four edges square, taking the board to {show(board.length)} by {show(board.width)}. Flatten both
          faces down to <strong>{show(board.thickness)}</strong> thick.
        </p>
        {!guide && (
          <p className="help">
            Flatten with a router sled or a drum sander. Do not run an end grain board through a thickness planer: the
            knives can catch the fibres and throw or shatter the board.
          </p>
        )}
      </>
    );
    diagrams = {
      strips: diagrams.strips!,
      panel: {
        picture: <LogDiagram tumbling={tumbling} label="The end of a log: three diamond sticks, one of each wood" />,
        caption: 'The end of a log. Three diamond sticks make one cube.',
      },
      arrange: {
        picture: (
          <HoneycombDiagram
            tumbling={tumbling}
            label={`${tumbling.rows} rows of ${tumbling.columns} pucks and a half puck, laid out like a honeycomb`}
          />
        ),
        caption: 'The pucks in position, end grain up. The dashed line shows where the glued board is trimmed.',
      },
      flatten: diagrams.flatten!,
    };
  }

  return (
    <div className="plan">
      <h2>{guide ? 'Your build instructions' : 'Your cut list'}</h2>
      <p className="lead">
        A {inSentence(info.name)} board in {designSpecies(state).map(speciesName).join(' and ')}, finishing at{' '}
        <strong>
          {show(board.length)} × {show(board.width)} × {show(board.thickness)} thick
        </strong>
        .
      </p>

      <fieldset className="view-toggle">
        <legend className="visually-hidden">How much detail to show</legend>
        <div className="choices">
          <label className={guide ? 'choice' : 'choice selected'}>
            <input type="radio" name="detail" checked={!guide} onChange={() => update({ showGuide: false })} />
            <span className="title">Cut list only</span>
            <span className="detail">Sizes and counts, for the workshop wall.</span>
          </label>
          <label className={guide ? 'choice selected' : 'choice'}>
            <input type="radio" name="detail" checked={guide} onChange={() => update({ showGuide: true })} />
            <span className="title">Full instructions</span>
            <span className="detail">Every step, with pictures, tips, sanding and finishing.</span>
          </label>
        </div>
      </fieldset>

      <Notices notices={design.notices} />
      {blocked && (
        <p className="empty">The steps below assume the problems above are fixed. Go back to change the design.</p>
      )}

      <div className="plan-previews">
        {!guide &&
          !tumbling &&
          groups.map((group) => (
            <figure key={group.ids[0]}>
              <PanelPreview recipe={recipe} panelIndex={group.index} />
              <figcaption>
                {several
                  ? `${capital(groupName(group))}, with the slices marked`
                  : 'First glue-up, with the slices marked'}
              </figcaption>
            </figure>
          ))}
        <figure>
          <BoardPreview board={board} label="The finished board" />
          <figcaption>Finished board</figcaption>
        </figure>
      </div>

      {stages.map((stage, index) => {
        const diagram = diagrams[stage.id];
        return (
          <section key={stage.id}>
            <h3>
              <span className="number">{index + 1}</span>
              {stage.title}
            </h3>
            {content[stage.id]}
            {guide && (
              <>
                {diagram && (
                  <figure className="step-diagram">
                    {diagram.picture}
                    <figcaption>{diagram.caption}</figcaption>
                  </figure>
                )}
                <h4>{stage.id === 'care' ? 'Care card' : 'Step by step'}</h4>
                <ol className="substeps">
                  {stage.steps.map((step, stepIndex) => (
                    <li key={stepIndex}>{step}</li>
                  ))}
                </ol>
                {stage.tips.length > 0 && (
                  <>
                    <h4>{stage.id === 'care' ? 'Care' : 'Tips'}</h4>
                    <ul className="tips">
                      {stage.tips.map((tip) => (
                        <TipCard key={tip.id} tip={tip} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        );
      })}

      <section>
        <h3>Where the wood goes</h3>
        <p>
          {percent(board.waste.board)} of the wood in the {tumbling ? 'logs' : panelCount > 1 ? 'panels' : 'panel'} ends
          up in the board. {percent(lost)} is lost to saw cuts, squaring and flattening
          {board.waste.panelLeftover > 1 ? `, and ${percent(board.waste.panelLeftover)} is spare panel.` : '.'}
        </p>
        {guide && <p className="help">Tip sources were read on or after {SOURCES_CHECKED}.</p>}
      </section>
    </div>
  );
}
