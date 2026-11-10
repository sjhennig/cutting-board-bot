# Cutting Board Designer

A browser-based designer for end grain cutting boards. It takes the wood you have, lets you pick a pattern, and produces a cut list and build instructions.

See [PLAN.md](PLAN.md) for the full plan. Phases 1 to 4 are built, and Phase 5 is started: the geometry engine, a five-step designer that ends in a printable cut list, optional step-by-step instructions with sourced tips, four intermediate patterns, and the first advanced one, MTM Wood's 3D illusion board.

## Using the designer

1. **Your shop:** units, saw blade width, and whether you have a planer.
2. **Your wood:** pick woods to buy from The Wood Vault, or enter boards you already have.
3. **Pattern:** checkerboard, brick, stripes or chaotic for beginners; basket weave, chevron, plaid or framed for a step up; the 3D illusion board for a challenge.
4. **Size:** the board you want, with a live preview and warnings.
5. **Cut list:** what to buy, how to cut each board, and the glue-up order. Switch on "Full instructions" for a picture and tips at every step, plus sanding, oiling and care. Print either from here.

Your design is remembered in your browser between visits. "Copy a link to this design" on the last step makes a link that opens the same design for anyone; the design travels in the link itself, so nothing is stored on a server.

## The engine

`src/engine` works out a board from a recipe: the panels to glue up, how to slice them, and how to arrange the slices.

| File          | What it does                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `types.ts`    | The recipe and result shapes                                                                            |
| `units.ts`    | Reads and writes fractional inches and metric                                                           |
| `board.ts`    | Finished size, surface layout, slices needed, where the waste goes, which pieces to rip from each slice |
| `patterns.ts` | One function for each pattern, from stripes to the 3D illusion board                                    |
| `cutplan.ts`  | Which stock board each strip is cut from, and what is missing                                           |
| `purchase.ts` | What to buy from a catalog for a design                                                                 |
| `checks.ts`   | Warnings: panel too short, board too thin, pieces too narrow                                            |

`src/data` holds the species list (with food-suitability ratings), the Wood Vault catalog, and the build tips.

### Adding a tip

Tips live in `src/data/tips.ts`. Each one must name a source that you have opened and read, and say only what that source says. Where good sources disagree, record the other view in `otherView`. Update `SOURCES_CHECKED` when you re-read the sources.

`src/app` is the interface. `design.ts` turns the user's choices into a recipe and collects the warnings; `panels.ts` groups identical panels so the cut list describes each kind once; `share.ts` makes and reads share links, and checks every saved or shared design field by field before using it; the other files are the screens.

`e2e` holds the end-to-end tests: a real browser clicks through all five steps for every pattern.

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

```bash
npm run check
```

```bash
npx playwright install chromium
```

```bash
npm run e2e
```

`npm run check` runs the formatting check, the type check and the tests, as the automatic checks on GitHub do. Run it before committing. `npm run format` fixes formatting.

`npm run e2e` runs the end-to-end tests in a real browser. It needs the browser downloaded once, which is what the `playwright install` line does. The automatic checks on GitHub run these tests too.

`npm run build` writes the finished site to `dist/`. Pushing to `main` publishes it to GitHub Pages, once Pages is set to "GitHub Actions" in the repository settings.
