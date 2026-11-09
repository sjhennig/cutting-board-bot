import { panelWidth, type PlannedBoard, type Recipe } from '../engine';
import { speciesColor } from './parts';

const OUTLINE = { stroke: 'rgba(0,0,0,0.25)', strokeWidth: 0.5 };

/** Diagonal hatching for wood that is cut away or left over. */
function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill="#efe9df" />
        <line x1="0" y1="0" x2="0" y2="6" stroke="#b5aa9a" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

/** One stock board seen from above, showing where to crosscut and rip it. */
export function StockCutDiagram(props: {
  planned: PlannedBoard;
  width: number;
  length: number;
  kerf: number;
  label: string;
}) {
  const { planned, width, length, kerf, label } = props;
  const hatch = `hatch-${planned.stockId.replace(/[^a-z0-9]/gi, '')}-${planned.copy}`;
  let x = 0;
  return (
    <svg className="diagram stock-cut" viewBox={`0 0 ${length} ${width}`} role="img" aria-label={label}>
      <Hatch id={hatch} />
      <rect x={0} y={0} width={length} height={width} fill={`url(#${hatch})`} {...OUTLINE} />
      {planned.segments.map((segment, index) => {
        const left = x;
        x += segment.length + kerf;
        let y = 0;
        return (
          <g key={index}>
            {segment.strips.map((strip, stripIndex) => {
              const top = y;
              y += strip.ripWidth + kerf;
              return (
                <rect
                  key={stripIndex}
                  x={left}
                  y={top}
                  width={segment.length}
                  height={strip.ripWidth}
                  fill={speciesColor(strip.species)}
                  {...OUTLINE}
                />
              );
            })}
            {left + segment.length < length - 0.5 && (
              <line className="cut-line" x1={left + segment.length} x2={left + segment.length} y1={0} y2={width} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The slices laid out end grain up, in glue-up order, before they are pushed together. */
export function ArrangeDiagram({ recipe, label }: { recipe: Recipe; label: string }) {
  const panels = new Map(recipe.panels.map((panel) => [panel.id, panel]));
  const heights = recipe.slices.map((slice) => slice.ripTo ?? panels.get(slice.panel)!.thickness);
  const average = heights.reduce((sum, height) => sum + height, 0) / heights.length;
  const gap = average * 0.35;
  const text = Math.max(average * 0.55, 6);
  const margin = text * 2.2;

  const shifts = recipe.slices.map((slice) => slice.shift ?? 0);
  const widths = recipe.slices.map((slice) => panelWidth(panels.get(slice.panel)!));
  const extent = Math.max(...shifts.map((shift, index) => shift + (widths[index] ?? 0)));
  const trim = recipe.trimEnds ?? 0;
  const left = Math.max(...shifts) + trim;
  const right = Math.min(...shifts.map((shift, index) => shift + (widths[index] ?? 0))) - trim;
  const trimmed = left > 0.01 || extent - right > 0.01;
  const anyFlip = recipe.slices.some((slice) => slice.flip);
  const totalHeight = heights.reduce((sum, height) => sum + height + gap, 0) - gap;

  let y = 0;
  return (
    <svg
      className="diagram arrange"
      viewBox={`${-margin} ${-gap} ${extent + margin * (anyFlip ? 2 : 1.1)} ${totalHeight + gap * 2}`}
      role="img"
      aria-label={label}
    >
      {recipe.slices.map((slice, index) => {
        const panel = panels.get(slice.panel)!;
        const height = heights[index] ?? 0;
        const top = y;
        y += height + gap;
        const strips = slice.flip ? [...panel.strips].reverse() : panel.strips;
        let x = slice.shift ?? 0;
        return (
          <g key={index}>
            <text x={-margin * 0.3} y={top + height / 2} fontSize={text} textAnchor="end" dominantBaseline="central">
              {index + 1}
            </text>
            {strips.map((strip, stripIndex) => {
              const start = x;
              x += strip.width;
              return (
                <rect
                  key={stripIndex}
                  x={start}
                  y={top}
                  width={strip.width}
                  height={height}
                  fill={speciesColor(strip.species)}
                  {...OUTLINE}
                />
              );
            })}
            {slice.flip && (
              <text x={extent + margin * 0.25} y={top + height / 2} fontSize={text} dominantBaseline="central">
                ⇄
              </text>
            )}
          </g>
        );
      })}
      {trimmed && (
        <>
          <line className="cut-line" x1={left} x2={left} y1={-gap} y2={totalHeight + gap} />
          <line className="cut-line" x1={right} x2={right} y1={-gap} y2={totalHeight + gap} />
        </>
      )}
    </svg>
  );
}

/** The board seen from the side, showing the layer removed from each face. */
export function FlattenDiagram(props: { length: number; sliceThickness: number; perFace: number; label: string }) {
  const { length, sliceThickness, perFace, label } = props;
  // Thickness is drawn at double scale so the thin layers are visible.
  const scale = 2;
  const height = sliceThickness * scale;
  const layer = perFace * scale;
  return (
    <svg className="diagram flatten" viewBox={`0 0 ${length} ${height}`} role="img" aria-label={label}>
      <Hatch id="hatch-flatten" />
      <rect x={0} y={0} width={length} height={height} fill="#d9c7a6" {...OUTLINE} />
      <rect x={0} y={0} width={length} height={layer} fill="url(#hatch-flatten)" {...OUTLINE} />
      <rect x={0} y={height - layer} width={length} height={layer} fill="url(#hatch-flatten)" {...OUTLINE} />
    </svg>
  );
}
