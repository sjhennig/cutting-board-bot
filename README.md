# Cutting Board Designer

A browser-based designer for end grain cutting boards. It takes the wood you have, lets you pick a pattern, and produces a cut list and build instructions.

See [PLAN.md](PLAN.md) for the full plan. Phases 1 and 2 are built: the geometry engine, and a five-step designer that ends in a printable cut list.

## Using the designer

1. **Your shop:** units, saw blade width, and whether you have a planer.
2. **Your wood:** pick woods to buy from The Wood Vault, or enter boards you already have.
3. **Pattern:** checkerboard, brick, stripes or chaotic.
4. **Size:** the board you want, with a live preview and warnings.
5. **Cut list:** what to buy, how to cut each board, and the glue-up order. Print it from here.

Your design is remembered in your browser between visits.

## The engine

`src/engine` works out a board from a recipe: the panels to glue up, how to slice them, and how to arrange the slices.

| File          | What it does                                                       |
| ------------- | ------------------------------------------------------------------ |
| `types.ts`    | The recipe and result shapes                                       |
| `units.ts`    | Reads and writes fractional inches and metric                      |
| `board.ts`    | Finished size, surface layout, slices needed, where the waste goes |
| `patterns.ts` | Stripes, checkerboard, brick, chaotic and the 3D illusion board    |
| `cutplan.ts`  | Which stock board each strip is cut from, and what is missing      |
| `purchase.ts` | What to buy from a catalog for a design                            |
| `checks.ts`   | Warnings: panel too short, board too thin, pieces too narrow       |

`src/data` holds the species list (with food-suitability ratings) and the Wood Vault catalog.

`src/app` is the interface. `design.ts` turns the user's choices into a recipe and collects the warnings; the other files are the screens.

## Running it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` writes the finished site to `dist/`. Pushing to `main` publishes it to GitHub Pages, once Pages is set to "GitHub Actions" in the repository settings.
