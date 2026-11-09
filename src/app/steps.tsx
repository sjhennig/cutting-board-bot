import { useState } from 'react';
import { SPECIES, speciesById } from '../data/species';
import { WOOD_VAULT, WOOD_VAULT_LINES, woodVaultBoards } from '../data/woodVault';
import { formatLength, inch, type StockBoard } from '../engine';
import type { Update } from './App';
import {
  PATTERNS,
  designSpecies,
  makeDesign,
  patternInfo,
  suggestedStripThickness,
  type Design,
  type DesignState,
} from './design';
import { BoardPreview, LengthInput, Swatch, speciesName } from './parts';

interface StepProps {
  state: DesignState;
  update: Update;
}

const KERFS = [
  { value: inch(1 / 8), label: 'Standard blade', detail: '1/8 in. Most table saw blades.' },
  { value: inch(3 / 32), label: 'Thin-kerf blade', detail: '3/32 in. Marked "thin kerf" on the blade.' },
];

export function ShopStep({ state, update }: StepProps) {
  const standardKerf = KERFS.some((kerf) => Math.abs(kerf.value - state.kerf) < 0.01);
  return (
    <>
      <h2>Tell us about your shop</h2>
      <p className="lead">Three quick questions, so the numbers in your cut list match your tools.</p>

      <fieldset>
        <legend>How do you measure?</legend>
        <div className="choices">
          {(['in', 'mm'] as const).map((unit) => (
            <label key={unit} className={state.unit === unit ? 'choice selected' : 'choice'}>
              <input type="radio" name="unit" checked={state.unit === unit} onChange={() => update({ unit })} />
              <span className="title">{unit === 'in' ? 'Inches' : 'Millimetres'}</span>
              <span className="detail">{unit === 'in' ? 'Fractions, such as 1-5/8"' : 'Such as 41 mm'}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Which saw blade will you use?</legend>
        <p className="help">
          Every cut turns a little wood into sawdust. That width is called the kerf, and it adds up over many cuts.
        </p>
        <div className="choices">
          {KERFS.map((kerf) => (
            <label key={kerf.label} className={Math.abs(state.kerf - kerf.value) < 0.01 ? 'choice selected' : 'choice'}>
              <input
                type="radio"
                name="kerf"
                checked={Math.abs(state.kerf - kerf.value) < 0.01}
                onChange={() => update({ kerf: kerf.value })}
              />
              <span className="title">{kerf.label}</span>
              <span className="detail">{kerf.detail}</span>
            </label>
          ))}
        </div>
        <details open={!standardKerf}>
          <summary>My blade is a different width</summary>
          <LengthInput label="Kerf" value={state.kerf} unit={state.unit} onChange={(kerf) => update({ kerf })} />
        </details>
      </fieldset>

      <fieldset>
        <legend>Can you plane boards thinner?</legend>
        <p className="help">
          A thickness planer lets you bring boards of different thicknesses down to match. Without one, the designer
          only uses boards that are already the right thickness.
        </p>
        <div className="choices">
          {[
            { value: false, title: 'No planer', detail: 'Use boards as they come.' },
            { value: true, title: 'I have a planer', detail: 'Mixed thicknesses are fine.' },
          ].map((option) => (
            <label key={option.title} className={state.canPlane === option.value ? 'choice selected' : 'choice'}>
              <input
                type="radio"
                name="planer"
                checked={state.canPlane === option.value}
                onChange={() => update({ canPlane: option.value })}
              />
              <span className="title">{option.title}</span>
              <span className="detail">{option.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

const RATING: Record<string, string> = { good: 'Good choice', caution: 'Use with care', avoid: 'Not recommended' };
const catalogSpecies = [...new Set(WOOD_VAULT_LINES.map((line) => line.species))];
const ratingOrder = { good: 0, caution: 1, avoid: 2 };
const sortedCatalogSpecies = [...catalogSpecies].sort(
  (a, b) =>
    ratingOrder[speciesById(a)?.suitability ?? 'avoid'] - ratingOrder[speciesById(b)?.suitability ?? 'avoid'] ||
    speciesName(a).localeCompare(speciesName(b)),
);

export function WoodStep({ state, update }: StepProps) {
  return (
    <>
      <h2>Choose your wood</h2>
      <fieldset>
        <legend>Where is the wood coming from?</legend>
        <div className="choices">
          <label className={state.woodMode === 'buy' ? 'choice selected' : 'choice'}>
            <input type="radio" name="mode" checked={state.woodMode === 'buy'} onChange={() => update({ woodMode: 'buy' })} />
            <span className="title">I need to buy wood</span>
            <span className="detail">Pick your woods and get a shopping list from {WOOD_VAULT.name}.</span>
          </label>
          <label className={state.woodMode === 'have' ? 'choice selected' : 'choice'}>
            <input type="radio" name="mode" checked={state.woodMode === 'have'} onChange={() => update({ woodMode: 'have' })} />
            <span className="title">I already have boards</span>
            <span className="detail">Enter what you have and design around it.</span>
          </label>
        </div>
      </fieldset>

      {state.woodMode === 'buy' ? <BuyWood state={state} update={update} /> : <OwnWood state={state} update={update} />}
    </>
  );
}

function BuyWood({ state, update }: StepProps) {
  const toggle = (id: string): void => {
    const chosen = state.buySpecies.includes(id)
      ? state.buySpecies.filter((species) => species !== id)
      : [...state.buySpecies, id];
    update({ buySpecies: chosen });
  };

  return (
    <fieldset>
      <legend>Which woods would you like?</legend>
      <p className="help">
        Choose two contrasting woods for most patterns. Hard, tight-grained woods make the best cutting boards.
      </p>
      <div className="species-grid">
        {sortedCatalogSpecies.map((id) => {
          const species = speciesById(id);
          const selected = state.buySpecies.includes(id);
          return (
            <label key={id} className={selected ? 'species selected' : 'species'}>
              <input type="checkbox" checked={selected} onChange={() => toggle(id)} />
              <Swatch species={id} />
              <span className="title">{speciesName(id)}</span>
              <span className={`rating ${species?.suitability ?? ''}`}>{RATING[species?.suitability ?? 'avoid']}</span>
              {species?.note && <span className="detail">{species.note}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function OwnWood({ state, update }: StepProps) {
  const show = (mm: number): string => formatLength(mm, state.unit);
  const [draft, setDraft] = useState({
    species: 'hard-maple',
    thickness: inch(1.625),
    width: inch(5.25),
    length: inch(24),
    quantity: 1,
  });
  const sizes = woodVaultBoards().filter((board) => board.species === draft.species);

  const add = (): void => {
    const board: StockBoard = { ...draft, id: `own-${Date.now()}-${state.stock.length}` };
    update({ stock: [...state.stock, board] });
  };
  const setQuantity = (id: string, quantity: number): void =>
    update({ stock: state.stock.map((board) => (board.id === id ? { ...board, quantity } : board)) });

  return (
    <fieldset>
      <legend>Your boards</legend>
      {state.stock.length === 0 ? (
        <p className="empty">No boards yet. Add your first one below.</p>
      ) : (
        <table className="stock">
          <thead>
            <tr>
              <th scope="col">Wood</th>
              <th scope="col">Thick</th>
              <th scope="col">Wide</th>
              <th scope="col">Long</th>
              <th scope="col">How many</th>
              <th scope="col">
                <span className="visually-hidden">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.stock.map((board) => (
              <tr key={board.id}>
                <th scope="row">
                  <Swatch species={board.species} /> {speciesName(board.species)}
                </th>
                <td>{show(board.thickness)}</td>
                <td>{show(board.width)}</td>
                <td>{show(board.length)}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={board.quantity}
                    aria-label={`How many ${speciesName(board.species)} boards`}
                    onChange={(event) => setQuantity(board.id, Math.max(1, Number(event.target.value) || 1))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="link"
                    aria-label={`Remove ${speciesName(board.species)} board`}
                    onClick={() => update({ stock: state.stock.filter((item) => item.id !== board.id) })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="add-board">
        <h3>Add a board</h3>
        <p className="help">Measure the board itself. Listed sizes are often a little off.</p>
        <div className="row">
          <div className="field">
            <label htmlFor="add-species">Wood</label>
            <select
              id="add-species"
              value={draft.species}
              onChange={(event) => setDraft({ ...draft, species: event.target.value })}
            >
              {[...SPECIES]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((species) => (
                  <option key={species.id} value={species.id}>
                    {species.name}
                  </option>
                ))}
            </select>
          </div>
          {sizes.length > 0 && (
            <div className="field">
              <label htmlFor="add-size">Fill in a {WOOD_VAULT.name} size</label>
              <select
                id="add-size"
                value=""
                onChange={(event) => {
                  const board = sizes.find((size) => size.id === event.target.value);
                  if (board) setDraft({ ...draft, thickness: board.thickness, width: board.width, length: board.length });
                }}
              >
                <option value="">Choose a size…</option>
                {sizes.map((size) => (
                  <option key={size.id} value={size.id}>
                    {show(size.thickness)} × {show(size.width)} × {show(size.listedLength)}
                    {size.line === 'blank' ? ' (cutting board blank)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="row">
          <LengthInput label="Thickness" value={draft.thickness} unit={state.unit} onChange={(thickness) => setDraft({ ...draft, thickness })} />
          <LengthInput label="Width" value={draft.width} unit={state.unit} onChange={(width) => setDraft({ ...draft, width })} />
          <LengthInput label="Length" value={draft.length} unit={state.unit} onChange={(length) => setDraft({ ...draft, length })} />
          <div className="field narrow">
            <label htmlFor="add-quantity">How many</label>
            <input
              id="add-quantity"
              type="number"
              min={1}
              max={99}
              value={draft.quantity}
              onChange={(event) => setDraft({ ...draft, quantity: Math.max(1, Number(event.target.value) || 1) })}
            />
          </div>
        </div>
        <button type="button" onClick={add}>
          Add board
        </button>
      </div>
    </fieldset>
  );
}

export function PatternStep({ state, update }: StepProps) {
  const available = designSpecies(state).length;
  return (
    <>
      <h2>Pick a pattern</h2>
      <p className="lead">All four are good first boards. You can change your mind at any time.</p>
      <div className="pattern-grid">
        {PATTERNS.map((pattern) => {
          const enough = available >= pattern.minSpecies;
          let thumbnail = null;
          try {
            const sample = makeDesign({ ...state, pattern: pattern.id });
            thumbnail = <BoardPreview board={sample.board} label={`${pattern.name} pattern`} />;
          } catch {
            // Not buildable with the current woods; the card explains why.
          }
          return (
            <label
              key={pattern.id}
              className={[
                'pattern',
                state.pattern === pattern.id ? 'selected' : '',
                enough ? '' : 'unavailable',
              ].join(' ')}
            >
              <input
                type="radio"
                name="pattern"
                checked={state.pattern === pattern.id}
                disabled={!enough}
                onChange={() => update({ pattern: pattern.id })}
              />
              <span className="thumbnail">{thumbnail}</span>
              <span className="title">{pattern.name}</span>
              <span className="detail">
                {enough ? pattern.blurb : `Needs ${pattern.minSpecies} woods. Go back and add another.`}
              </span>
            </label>
          );
        })}
      </div>
    </>
  );
}

const BLANK_WIDTHS = [inch(0.75), inch(1), inch(1.25)];

export function TuneStep({ state, update, design }: StepProps & { design: Design | null }) {
  const info = patternInfo(state.pattern);
  const show = (mm: number): string => formatLength(mm, state.unit);
  const species = designSpecies(state);
  const suggested = suggestedStripThickness(state);
  const owned = [...new Set(state.stock.map((board) => board.species))];

  const move = (index: number, by: number): void => {
    const order = [...state.buySpecies];
    const target = index + by;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target] as string, order[index] as string];
    update({ buySpecies: order });
  };

  return (
    <>
      <h2>Set the size</h2>
      <p className="lead">
        Enter the board you would like. The designer rounds to whole pieces, so the finished size on the right may
        differ slightly.
      </p>

      <fieldset>
        <legend>Finished board</legend>
        <div className="row">
          <LengthInput label="Length" value={state.boardLength} unit={state.unit} onChange={(boardLength) => update({ boardLength })} />
          <LengthInput label="Width" value={state.boardWidth} unit={state.unit} onChange={(boardWidth) => update({ boardWidth })} />
          <LengthInput
            label="Thickness"
            value={state.boardThickness}
            unit={state.unit}
            onChange={(boardThickness) => update({ boardThickness })}
            hint="1-1/2 in. or more resists warping."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>Pieces</legend>
        <div className="row">
          <LengthInput
            label={info.cellLabel}
            value={state.cellWidth}
            unit={state.unit}
            onChange={(cellWidth) => update({ cellWidth })}
            hint={design ? `${design.columns} across the board.` : undefined}
          />
          <LengthInput
            label="Strip thickness"
            value={state.stripThickness}
            unit={state.unit}
            onChange={(stripThickness) => update({ stripThickness })}
            hint={
              design
                ? `The thickness of your boards. Each row is this deep: ${design.rows} rows.`
                : 'The thickness of your boards.'
            }
          />
        </div>

        {state.woodMode === 'buy' && (
          <div className="presets">
            <span>Ready-made blank widths, no ripping needed:</span>
            {BLANK_WIDTHS.map((width) => (
              <button
                key={width}
                type="button"
                className={Math.abs(state.cellWidth - width) < 0.01 ? 'chip selected' : 'chip'}
                onClick={() => update({ cellWidth: width, stripThickness: inch(1.625) })}
              >
                {show(width)}
              </button>
            ))}
          </div>
        )}
        {suggested !== null && Math.abs(suggested - state.stripThickness) > 0.01 && (
          <div className="presets">
            <span>Your boards suggest a strip thickness of</span>
            <button type="button" className="chip" onClick={() => update({ stripThickness: suggested })}>
              {show(suggested)}
            </button>
          </div>
        )}
        {state.pattern === 'chaotic' && (
          <div className="presets">
            <button type="button" className="chip" onClick={() => update({ seed: state.seed + 1 })}>
              Shuffle the pattern
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>Woods in this board</legend>
        {state.woodMode === 'buy' ? (
          <ol className="order">
            {state.buySpecies.map((id, index) => (
              <li key={id}>
                <Swatch species={id} />
                <span className="title">{speciesName(id)}</span>
                <button type="button" className="link" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${speciesName(id)} earlier`}>
                  Move up
                </button>
                <button
                  type="button"
                  className="link"
                  disabled={index === state.buySpecies.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${speciesName(id)} later`}
                >
                  Move down
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <ul className="order">
            {owned.map((id) => (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!state.excluded.includes(id)}
                    onChange={() =>
                      update({
                        excluded: state.excluded.includes(id)
                          ? state.excluded.filter((item) => item !== id)
                          : [...state.excluded, id],
                      })
                    }
                  />
                  <Swatch species={id} />
                  <span className="title">{speciesName(id)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {species.length === 0 && <p className="empty">No woods chosen yet. Go back to "Your wood" to add some.</p>}
      </fieldset>
    </>
  );
}
