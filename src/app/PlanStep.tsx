import { WOOD_VAULT } from '../data/woodVault';
import type { CatalogBoard } from '../data/woodVault';
import { formatLength, panelWidth, type PlannedBoard } from '../engine';
import { designSpecies, patternInfo, type Design, type DesignState } from './design';
import { BoardPreview, Notices, PanelPreview, Swatch, speciesName } from './parts';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export function PlanStep({ state, design, error }: { state: DesignState; design: Design | null; error: string | null }) {
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
  const slices = board.panels[0]!.slicesNeeded;
  const flipped = recipe.slices.flatMap((slice, index) => (slice.flip ? [index + 1] : []));
  const trimmed = width - board.length > 0.01;
  const blocked = design.notices.some((notice) => notice.level === 'problem');
  const percent = (part: number): string => `${Math.round((part / board.waste.supplied) * 100)}%`;
  const lost = board.waste.supplied - board.waste.board - board.waste.panelLeftover;

  const boardName = (planned: PlannedBoard): string => `${speciesName(planned.species)} board ${planned.copy}`;
  const totalBoards = plan.boards.length;

  // One row per board, with identical boards merged: "Hard maple boards 1 to 5".
  interface BoardRow { key: string; species: string; first: number; last: number; name: string; lengths: string; rip: string; offcuts: string }
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
      rip: noRip ? 'No ripping: already the right width' : [...widths].map(([size, count]) => `${count} × ${size}`).join(', '),
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
      previous.name = `${speciesName(planned.species)} boards ${previous.first} ${previous.last - previous.first === 1 ? "and" : "to"} ${previous.last} (each)`;
    } else {
      boardRows.push({ ...row, key: `${planned.stockId}-${planned.copy}`, first: planned.copy, last: planned.copy, name: boardName(planned) });
    }
  }
  const oneLengthEach = plan.boards.every((planned) => planned.segments.length === 1);

  // Describe the glue-up order as runs: "Hard maple, Black walnut" repeated.
  const order = panel.strips.map((strip) => `${speciesName(strip.species)} ${show(strip.width)}`);

  return (
    <div className="plan">
      <h2>Your cut list</h2>
      <p className="lead">
        A {info.name.toLowerCase()} board in {designSpecies(state).map(speciesName).join(' and ')}, finishing at{' '}
        <strong>
          {show(board.length)} × {show(board.width)} × {show(board.thickness)} thick
        </strong>
        .
      </p>

      <Notices notices={design.notices} />
      {blocked && (
        <p className="empty">The steps below assume the problems above are fixed. Go back to change the design.</p>
      )}

      <div className="plan-previews">
        <figure>
          <PanelPreview recipe={recipe} />
          <figcaption>First glue-up, with the slices marked</figcaption>
        </figure>
        <figure>
          <BoardPreview board={board} label="The finished board" />
          <figcaption>Finished board</figcaption>
        </figure>
      </div>

      <section>
        <h3>
          <span className="number">1</span>
          {state.woodMode === 'buy' ? 'Buy your wood' : 'Gather your boards'}
        </h3>
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
                      <td>{item.line === 'blank' ? 'Cutting board blank' : item.line === 'thick' ? 'Thick surfaced board' : 'Surfaced board'}</td>
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
              than listed; this plan allows for that. Consider adding one spare of each wood in case a board has a
              flaw.
            </p>
          </>
        ) : (
          <p className="help">The table in step 2 shows which of your boards are used.</p>
        )}
      </section>

      <section>
        <h3>
          <span className="number">2</span>Cut the strips
        </h3>
        <p>
          Every strip is <strong>{show(panel.length)}</strong> long.{' '}
          {anyRipping ? 'Cut each board to that length first, then rip it into strips.' : 'Cut each board to that length.'}
        </p>
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
                  Plane the {speciesName(line.species)} down to {show(line.planeTo!)} before ripping, so every strip
                  is the same thickness.
                </li>
              ))}
            {rips
              .filter((line) => line.orientation === 'onEdge')
              .map((line, index) => (
                <li key={`edge-${index}`}>
                  The {speciesName(line.species)} strips are ripped {show(line.ripWidth)} wide and then stood on edge
                  in the glue-up, so the board's thickness becomes the strip's width.
                </li>
              ))}
          </ul>
        )}

        {anyRipping && (
        <table className="fence">
          <caption>Fence settings for ripping</caption>
          <thead>
            <tr>
              <th scope="col">Set fence to</th>
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
      </section>

      <section>
        <h3>
          <span className="number">3</span>Glue the strips into a panel
        </h3>
        <p>
          Lay out {plural(panel.strips.length, 'strip')} side by side in this order and glue them edge to edge. The
          panel will be <strong>{show(width)}</strong> wide, {show(panel.thickness)} thick and {show(panel.length)}{' '}
          long.
        </p>
        <ol className="strip-order">
          {order.map((label, index) => (
            <li key={index}>
              <Swatch species={panel.strips[index]!.species} /> {label}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>
          <span className="number">4</span>Slice the panel
        </h3>
        <p>
          Square one end of the panel, then crosscut it into <strong>{plural(slices, 'slice')}</strong>, each{' '}
          <strong>{show(recipe.cut.sliceThickness)}</strong> thick. Use a crosscut sled with a stop block so every
          slice is identical. Number the slices in order as they come off the saw.
        </p>
        <p className="help">
          The slices are cut {show(recipe.flattenPerFace * 2)} thicker than the finished board to leave room for
          flattening.
        </p>
      </section>

      <section>
        <h3>
          <span className="number">5</span>Arrange and glue the slices
        </h3>
        <p>
          Roll each slice a quarter turn so the end grain faces up. {info.arrange}
          {flipped.length > 0 && state.pattern === 'chaotic' && ` Slices to turn: ${flipped.join(', ')}.`}
        </p>
        <p>Check the pattern against the picture above, then glue the slices together.</p>
      </section>

      <section>
        <h3>
          <span className="number">6</span>Trim and flatten
        </h3>
        <p>
          {trimmed
            ? `Trim both ends square, taking the board to ${show(board.length)} long. `
            : 'Trim the edges just enough to clean them up. '}
          Flatten both faces down to <strong>{show(board.thickness)}</strong> thick.
        </p>
        <p className="help">
          Flatten with a router sled or a drum sander. Do not run an end grain board through a thickness planer: the
          knives can catch the fibres and throw or shatter the board.
        </p>
      </section>

      <section>
        <h3>Where the wood goes</h3>
        <p>
          {percent(board.waste.board)} of the panel ends up in the board. {percent(lost)} is lost to saw cuts,
          squaring and flattening
          {board.waste.panelLeftover > 1 ? `, and ${percent(board.waste.panelLeftover)} is spare panel.` : '.'}
        </p>
      </section>
    </div>
  );
}
