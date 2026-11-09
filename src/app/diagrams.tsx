import { layoutPieces, type PlannedBoard, type Recipe } from '../engine';
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
  const pieces = layoutPieces(recipe);
  const grid = (recipe.columns ?? 1) > 1;
  const average = pieces.reduce((sum, piece) => sum + piece.height, 0) / pieces.length;
  const gap = average * (grid ? 0.18 : 0.35);
  const text = Math.max(average * 0.55, 6);
  const margin = grid ? 0 : text * 2.2;
  const marked = pieces.some((piece) => piece.flipped || piece.over);

  const minX = Math.min(...pieces.map((piece) => piece.x));
  const maxX = Math.max(...pieces.map((piece) => piece.x + piece.width + (grid ? piece.column * gap : 0)));
  const bottom = Math.max(...pieces.map((piece) => piece.y + piece.height + piece.row * gap));

  // Where the glued board is trimmed square, when shifted slices leave ragged ends.
  const trim = recipe.trimEnds ?? 0;
  const left = Math.max(...pieces.filter((piece) => piece.column === 0).map((piece) => piece.x)) + trim;
  const right = Math.min(...pieces.map((piece) => piece.x + piece.width)) - trim;
  const trimmed = !grid && (left - minX > 0.01 || maxX - right > 0.01);

  return (
    <svg
      className="diagram arrange"
      viewBox={`${minX - margin} ${-gap} ${maxX - minX + margin * (marked ? 2 : 1.1)} ${bottom + gap * 2}`}
      role="img"
      aria-label={label}
    >
      {pieces.map((piece) => {
        const dx = grid ? piece.column * gap : 0;
        const dy = piece.row * gap;
        return (
          <g key={piece.slice} transform={`translate(${dx} ${dy})`}>
            {!grid && (
              <text
                x={minX - margin * 0.3}
                y={piece.y + piece.height / 2}
                fontSize={text}
                textAnchor="end"
                dominantBaseline="central"
              >
                {piece.slice + 1}
              </text>
            )}
            {piece.cells.map((cell, index) =>
              cell.points ? (
                <polygon
                  key={index}
                  points={cell.points.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill={speciesColor(cell.species)}
                  {...OUTLINE}
                />
              ) : (
                <rect
                  key={index}
                  x={cell.x}
                  y={cell.y}
                  width={cell.width}
                  height={cell.height}
                  fill={speciesColor(cell.species)}
                  {...OUTLINE}
                />
              ),
            )}
            {(piece.flipped || piece.over) && (
              <text x={maxX + margin * 0.25} y={piece.y + piece.height / 2} fontSize={text} dominantBaseline="central">
                {piece.over ? '⇅' : '⇄'}
              </text>
            )}
          </g>
        );
      })}
      {trimmed && (
        <>
          <line className="cut-line" x1={left} x2={left} y1={-gap} y2={bottom + gap} />
          <line className="cut-line" x1={right} x2={right} y1={-gap} y2={bottom + gap} />
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
