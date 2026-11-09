# Cutting Board Designer

A browser-based designer for end grain cutting boards. It takes the wood you have, lets you pick a pattern, and produces a cut list and build instructions.

See [PLAN.md](PLAN.md) for the full plan. Phase 1, the geometry engine, is built; there is no user interface yet.

## The engine

`src/engine` works out a board from a recipe: the panels to glue up, how to slice them, and how to arrange the slices.

| File | What it does |
|---|---|
| `types.ts` | The recipe and result shapes |
| `units.ts` | Reads and writes fractional inches and metric |
| `board.ts` | Finished size, surface layout, slices needed, where the waste goes |
| `patterns.ts` | Stripes, checkerboard, brick, chaotic and the 3D illusion board |
| `cutplan.ts` | Which stock board each strip is cut from, and what is missing |
| `checks.ts` | Warnings: panel too short, board too thin, pieces too narrow |

## Running the tests

```bash
npm install
```

```bash
npm test
```

```bash
npm run typecheck
```
