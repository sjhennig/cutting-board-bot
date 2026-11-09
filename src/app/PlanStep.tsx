import type { ReactNode } from 'react';
import { SOURCES_CHECKED, type StageId, type Tip } from '../data/tips';
import { WOOD_VAULT } from '../data/woodVault';
import type { CatalogBoard } from '../data/woodVault';
import { formatLength, panelWidth, type PlannedBoard } from '../engine';
import type { Update } from './App';
import { designSpecies, patternInfo, type Design, type DesignState } from './design';
import { ArrangeDiagram, FlattenDiagram, StockCutDiagram } from './diagrams';
import { buildGuide } from './guide';
import { BoardPreview, Notices, PanelPreview, Swatch, speciesName } from './parts';

/** The stages that make up the cut list. The rest appear only with full instructions. */
const CUT_LIST_STAGES: StageId[] = ['wood', 'strips', 'panel', 'slice', 'arrange', 'flatten'];

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
  const { recipe, board, plan, rips, purchase } = design;
  const panel = recipe.panels[0]!;
  const info = patternInfo(state.pattern);
  const width = panelWidth(panel);
  const slices = recipe.slices.length;
  const panelCount = recipe.panels.length;
  const slicesPerPanel = Math.max(...board.panels.map((report) => report.slicesAvailable));
  const grid = (recipe.columns ?? 1) > 1;
  const tilt = panel.bevel;
  const turnedOver = recipe.slices.some((slice) => slice.over);
  const flipped = recipe.slices.flatMap((slice, index) => (slice.flip ? [index + 1] : []));
  const trimmed = width - board.length > 0.01;
  const blocked = design.notices.some((notice) => notice.level === 'problem');
  const percent = (part: number): string => `${Math.round((part / board.waste.supplied) * 100)}%`;
  const lost = board.waste.supplied - board.waste.board - board.waste.panelLeftover;

  const boardName = (planned: PlannedBoard): string => `${speciesName(planned.species)} board ${planned.copy}`;
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
    const row = {
      species: planned.species,
      lengths: `${planned.segments.length} × ${show(panel.length)}`,
      rip: noRip
        ? 'No ripping: already the right width'
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
      previous.name = `${speciesName(planned.species)} boards ${previous.first} ${previous.last - previous.first === 1 ? 'and' : 'to'} ${previous.last} (each)`;
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

  const order = panel.strips.map((strip) => `${speciesName(strip.species)} ${show(strip.width)}`);

  const guide = state.showGuide;
  const stages = buildGuide(state, design).filter((stage) => guide || CUT_LIST_STAGES.includes(stage.id));
  const sizeOf = (stockId: string): { width: number; length: number } | undefined =>
    state.woodMode === 'buy'
      ? purchase.find((line) => line.board.id === stockId)?.board
      : state.stock.find((item) => item.id === stockId);

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
              Sizes are from <a href={WOOD_VAULT.url}>{WOOD_VAULT.name}</a>. Boards often arrive up to 1/4 in. shorter
              than listed; this plan allows for that. Consider adding one spare of each wood in case a board has a flaw.
            </p>
          </>
        ) : (
          <p className="help">The table in the next step shows which of your boards are used.</p>
        )}
      </>
    ),
    strips: (
      <>
        <p>
          Every strip is <strong>{show(panel.length)}</strong> long.{' '}
          {anyRipping
            ? 'Cut each board to that length first, then rip it into strips.'
            : 'Cut each board to that length.'}
        </p>
        {tilt !== undefined && (
          <p>
            Rip with the blade tilted <strong>{tilt} degrees</strong>, so every strip has slanted sides. The widths
            below are measured along the face of the board. The first strip off each board keeps one square edge: set
            two of these aside for the outside of the panel, and trim the square edge off the rest with one more tilted
            cut.
          </p>
        )}
        {oneLengthEach && (
          <p className="help">
            That length gives exactly the slices you need. If you would like a spare slice or two, leave the boards
            longer: the extra just becomes more slices.
          </p>
        )}
        <table>
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
                <td>{row.rip}</td>
                <td>{row.offcuts}</td>
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
                <th scope="col">{tilt !== undefined ? 'Strip width' : 'Set fence to'}</th>
                <th scope="col">Wood</th>
                <th scope="col">Strips</th>
              </tr>
            </thead>
            <tbody>
              {rips.map((line, index) => (
                <tr key={index}>
                  <td>{show(line.ripWidth)}</td>
                  <td>
                    <Swatch species={line.species} /> {speciesName(line.species)}
                  </td>
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
        <p>
          {panelCount > 1 && `Make ${panelCount} identical panels. For each one, lay `}
          {panelCount === 1 && 'Lay '}
          out {plural(panel.strips.length, 'strip')} side by side in this order and glue them edge to edge.
          {tilt !== undefined &&
            ' All the slants must lean the same way, with the two square edges on the outside.'}{' '}
          {panelCount > 1 ? 'Each panel' : 'The panel'} will be <strong>{show(width)}</strong> wide,{' '}
          {show(panel.thickness)} thick and {show(panel.length)} long.
        </p>
        <ol className="strip-order">
          {order.map((label, index) => (
            <li key={index}>
              <Swatch species={panel.strips[index]!.species} /> {label}
            </li>
          ))}
        </ol>
      </>
    ),
    slice: (
      <>
        <p>
          {panelCount > 1
            ? `Square one end of each panel, then crosscut each into ${plural(slicesPerPanel, 'slice')}. You need `
            : 'Square one end of the panel, then crosscut it into '}
          <strong>{plural(slices, 'slice')}</strong>
          {panelCount > 1 && ' in all'}, each <strong>{show(recipe.cut.sliceThickness)}</strong> thick. Use a crosscut
          sled with a stop block so every slice is identical. Number the slices in order as they come off the saw.
        </p>
        <p className="help">
          The slices are cut {show(recipe.flattenPerFace * 2)} thicker than the finished board to leave room for
          flattening.
        </p>
      </>
    ),
    arrange: (
      <>
        <p>
          {grid
            ? 'Stand each tile so the end grain faces up.'
            : 'Roll each slice a quarter turn so the end grain faces up.'}{' '}
          {info.arrange}
          {flipped.length > 0 && state.pattern === 'chaotic' && ` Slices to turn: ${flipped.join(', ')}.`}
        </p>
        <p>
          {grid
            ? 'Check the pattern against the picture. Glue the tiles of each row together first, then glue the rows to each other.'
            : 'Check the pattern against the picture, then glue the slices together.'}
        </p>
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

  const diagrams: Partial<Record<StageId, { picture: ReactNode; caption: string }>> = {
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
      picture: <PanelPreview recipe={recipe} cuts={false} />,
      caption: 'The glued panel from above. Strip 1 is at the top.',
    },
    slice: {
      picture: <PanelPreview recipe={recipe} />,
      caption: 'Dashed lines are the crosscuts. The first cut squares the end.',
    },
    arrange: {
      picture: (
        <ArrangeDiagram recipe={recipe} label={`The ${slices} slices in order, end grain up. ${info.arrange}`} />
      ),
      caption:
        (grid
          ? 'The tiles in position, end grain up, before they are pushed together.'
          : 'The slices in order, end grain up, before they are pushed together.') +
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

  return (
    <div className="plan">
      <h2>{guide ? 'Your build instructions' : 'Your cut list'}</h2>
      <p className="lead">
        A {info.name.toLowerCase()} board in {designSpecies(state).map(speciesName).join(' and ')}, finishing at{' '}
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
        {!guide && (
          <figure>
            <PanelPreview recipe={recipe} />
            <figcaption>First glue-up, with the slices marked</figcaption>
          </figure>
        )}
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
          {percent(board.waste.board)} of the panel ends up in the board. {percent(lost)} is lost to saw cuts, squaring
          and flattening
          {board.waste.panelLeftover > 1 ? `, and ${percent(board.waste.panelLeftover)} is spare panel.` : '.'}
        </p>
        {guide && <p className="help">Tip sources were last read on {SOURCES_CHECKED}.</p>}
      </section>
    </div>
  );
}
