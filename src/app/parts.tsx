import { useEffect, useId, useState, type ReactNode } from 'react';
import { speciesById } from '../data/species';
import { formatLength, parseLength, type BoardResult, type Recipe, type Unit } from '../engine';
import type { Notice } from './design';

export const speciesName = (id: string): string => speciesById(id)?.name ?? id;
export const speciesColor = (id: string): string => speciesById(id)?.color ?? '#b9a48a';

/** A text box for a length. Accepts fractions such as 1-5/8 and shows what it understood. */
export function LengthInput(props: {
  label: string;
  value: number;
  unit: Unit;
  onChange: (mm: number) => void;
  hint?: ReactNode;
}) {
  const { label, value, unit, onChange, hint } = props;
  const id = useId();
  const [text, setText] = useState(() => formatLength(value, unit));
  const [error, setError] = useState<string | null>(null);

  // Follow changes made elsewhere: a unit switch, a preset button, a reset.
  useEffect(() => {
    setText(formatLength(value, unit));
    setError(null);
  }, [value, unit]);

  const commit = (): void => {
    try {
      const mm = parseLength(text, unit);
      if (mm <= 0) throw new Error('Enter a size greater than zero.');
      setError(null);
      setText(formatLength(mm, unit));
      if (Math.abs(mm - value) > 0.001) onChange(mm);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That is not a length.');
    }
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="text"
        value={text}
        aria-invalid={error !== null}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      <p id={`${id}-hint`} className={error ? 'hint error' : 'hint'}>
        {error ?? hint}
      </p>
    </div>
  );
}

export function Swatch({ species }: { species: string }) {
  return <span className="swatch" style={{ background: speciesColor(species) }} aria-hidden="true" />;
}

export function Notices({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="notices">
      {notices.map((notice, index) => (
        <li key={index} className={notice.level}>
          <strong>{notice.level === 'problem' ? 'Needs fixing' : 'Worth knowing'}</strong>
          {notice.message}
        </li>
      ))}
    </ul>
  );
}

/** The finished board, looking down on the end grain. */
export function BoardPreview({ board, label }: { board: BoardResult; label: string }) {
  return (
    <svg
      className="board"
      viewBox={`0 0 ${board.length} ${board.width}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      {board.cells.map((cell, index) => (
        <rect
          key={index}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          fill={speciesColor(cell.species)}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth={0.4}
        />
      ))}
    </svg>
  );
}

/** The first glue-up, seen from above, with the crosscut lines marked. */
export function PanelPreview({ recipe, panelIndex = 0 }: { recipe: Recipe; panelIndex?: number }) {
  const panel = recipe.panels[panelIndex];
  if (!panel) return null;
  const width = panel.strips.reduce((sum, strip) => sum + strip.width, 0);
  const { sliceThickness, kerf, endTrim } = recipe.cut;
  const needed = recipe.slices.filter((slice) => slice.panel === panel.id).length;
  const cuts = Array.from({ length: needed + 1 }, (_, index) => endTrim + index * (sliceThickness + kerf));

  let y = 0;
  return (
    <svg
      className="panel"
      viewBox={`0 0 ${panel.length} ${width}`}
      role="img"
      aria-label={`The glued panel: ${panel.strips.length} strips side by side, with ${needed} slices marked across it`}
      preserveAspectRatio="xMidYMid meet"
    >
      {panel.strips.map((strip, index) => {
        const top = y;
        y += strip.width;
        return (
          <rect
            key={index}
            x={0}
            y={top}
            width={panel.length}
            height={strip.width}
            fill={speciesColor(strip.species)}
            stroke="rgba(0,0,0,0.18)"
            strokeWidth={0.4}
          />
        );
      })}
      {cuts
        .filter((x) => x <= panel.length + 0.01)
        .map((x, index) => (
          <line key={index} x1={x} x2={x} y1={0} y2={width} className="cut-line" />
        ))}
    </svg>
  );
}
