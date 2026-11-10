import type { Point } from './types';

/** Keep the part of a convex polygon where `a*x + b*y <= c`. */
export function clip(polygon: Point[], a: number, b: number, c: number): Point[] {
  const inside = ([x, y]: Point): number => c - (a * x + b * y);
  const result: Point[] = [];
  polygon.forEach((current, index) => {
    const next = polygon[(index + 1) % polygon.length] as Point;
    const dCurrent = inside(current);
    const dNext = inside(next);
    if (dCurrent >= 0) result.push(current);
    if ((dCurrent > 0 && dNext < 0) || (dCurrent < 0 && dNext > 0)) {
      const t = dCurrent / (dCurrent - dNext);
      result.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  });
  return result;
}

/** Keep the part of a convex polygon between two x values. */
export const clipToRange = (polygon: Point[], left: number, right: number): Point[] =>
  clip(clip(polygon, -1, 0, -left), 1, 0, right);

export function polygonArea(points: Point[]): number {
  let twice = 0;
  points.forEach(([x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length] as Point;
    twice += x * nextY - nextX * y;
  });
  return Math.abs(twice) / 2;
}

export function boundingBox(points: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
