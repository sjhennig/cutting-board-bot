# Cutting Board Designer: build plan

A browser-based designer that takes the wood a person has (or can buy), lets them pick an end grain pattern, and produces a cut list and step-by-step build instructions.

## 1. How far to trust the research behind this plan

The research was done from an environment whose network blocks most websites. Only github.com pages were read in full. Everything else comes from search-result excerpts or from geometric reasoning.

| Area | Confidence | What it rests on |
|---|---|---|
| Open-source designers (CBDJS, MvRens/CuttingBoard) | High | Repositories read directly |
| Other designers (CBdesigner, Cutting Board Studio, iOS apps) | Low | Search excerpts only |
| Slice-based pattern geometry (checkerboard, brick, stripes, chevron) | High | Simple arithmetic, consistent with excerpts |
| Tumbling blocks geometry | Medium | Trigonometry is sound; build sequence is from excerpts |
| MTM Wood style 3D boards | Low | Reasoning only; no source confirmed strip widths or sequences |
| Wood Vault catalog | Medium-low | Search excerpts of woodvault.com; prices may be stale |
| Build tips | Medium | Reputable sources identified, but pages not read in full |

Phase 0 below exists to close these gaps before anything is shown to users as fact.

## 2. What existing tools get wrong

| Tool | What it does well | Where it falls short |
|---|---|---|
| CBDJS (web, open source) | Models both glue-ups, accounts for kerf, reports waste | No unit labels, no sideways shift (so no brick pattern), no cut list, no instructions |
| MvRens/CuttingBoard (web, archived) | Multiple source panels, metric and decimal inches, save to file | No kerf, no cut list, no fractional inches |
| CBdesigner (Windows, 2008) | Kerf setting, material list, PDF | Windows-only, dated, checkerboard-family patterns only |
| Cutting Board Studio (web, beta) | Reported 3D preview and yield figures | Unverified; needs a hands-on look in Phase 0 |

The gaps this project targets:

1. **No tool starts from real boards.** They ask for abstract strip widths, not "I have two 3/4 x 5-1/4 x 24 maple boards".
2. **No tool writes instructions.** At best they give dimensions and waste.
3. **Allowances are incomplete.** Kerf is sometimes counted; flattening, squaring and trim losses never are.
4. **Pattern coverage is narrow.** Brick, chaotic and 3D patterns have no confirmed support anywhere.
5. **No guard rails.** Nothing warns about unsafe slice sizes, unsuitable species or long-grain borders.
6. **Fractional inches are missing**, which is how most North American woodworkers measure.

## 3. Core idea: a design is a recipe, not a picture

Every end grain board is built by repeating the same loop: glue strips into a panel, cut the panel into slices, rearrange the slices, glue again. The app stores a design as that sequence of operations.

This matters because the preview, the cut list and the instructions are then all generated from one source. They cannot disagree with each other, and any design the app can draw is one the user can build.

A recipe is a list of generations. Each generation has:

- **Laminate:** an ordered list of strips (species, width), all at one thickness `T` and length `L`.
- **Cut:** slice thickness `t`, kerf `k`, cut angle (90 degrees unless stated).
- **Arrange:** per slice, any of flip end for end, rotate, shift sideways by a distance.

A pattern is a preset that writes a recipe from a few friendly inputs (target size, species, cell size).

### Geometry for the slice family

| Quantity | Formula |
|---|---|
| Panel width | `W = sum of strip widths` |
| Slices from a panel | `N = floor((L + k) / (t + k))`, less one or two for squaring the ends |
| Board length | `W`, less any trim from shifting |
| Board width | `N x T` |
| Board thickness | `t` minus flattening allowance (default 1/16 in. per face per glue-up) |
| Panel length needed for `N` slices | `N(t + k) - k` plus about 1 in. for squaring |
| Surface cell size | `strip width x T`; square cells need strip width equal to `T` |

Second-generation cuts lose another kerf per cut and another flattening pass, so the pattern repeat shrinks slightly each generation. The engine must carry this through; it is the detail that hand calculations usually miss.

### Geometry for the rhombus family (tumbling blocks, hexagons)

This family does not fit the slice model, so it gets its own small engine.

- Sticks are ripped to a 60/120 degree rhombus cross-section with the blade tilted 30 degrees from vertical.
- Rhombus side `s = T / sin 60 = 1.155 T`, where `T` is the stock thickness.
- Each rip loses `k / cos 30 = 1.155 k` of width.
- One stick of each of three tones glues into a hexagonal log, `2T` across the flats.
- Logs tile as a honeycomb, then the whole block is crosscut into boards.

## 4. Pattern library

| Pattern | Level | Engine | How it is made |
|---|---|---|---|
| Stripes (even or varied width) | Beginner | Slice | No rearranging, or mirror alternate slices |
| Checkerboard | Beginner | Slice | Two species, even strip count, flip alternate slices |
| Brick | Beginner | Slice | Shift alternate slices by half a strip; trim the ends |
| Chaotic | Beginner | Slice | Random strip widths, random shift per slice |
| Plaid | Intermediate | Slice | Thin accent strips in both generations |
| Framed | Intermediate | Slice | End grain border blocks only; never long grain |
| Basket weave | Intermediate | Slice | Square logs of three strips, alternate tiles turned 90 degrees |
| Chevron / zigzag | Intermediate | Slice, 2 generations | Striped end grain slab re-cut at an angle, alternates flipped |
| Pixel art | Intermediate | Slice | One panel recipe per distinct row |
| Tumbling blocks | Advanced | Rhombus | Three tones, hexagonal logs |
| 3D steps / bulge / weave | Advanced | Slice, 2 generations | Graded strip widths, mirrored or shifted slices |

The 3D row is the least certain. It is scheduled last and depends on Phase 0 confirming the method from real build guides.

## 5. User experience

A five-step guided flow, with a live preview visible throughout.

1. **Your shop.** Units (fractional inches or metric), blade kerf (1/8 or 3/32 in.), and which tools the user owns. Tool answers change the instructions later: no jointer means recommending pre-surfaced stock; no drum sander means the router sled route.
2. **Your wood.** Three ways in:
   - *Start from a kit:* pick a pre-populated pack and the app fills in the boards.
   - *I have boards:* enter species and dimensions.
   - *Tell me what to buy:* skip this step, set a target board size, and get a shopping list at the end.
3. **Pick a pattern.** A gallery labelled by difficulty. Patterns the user's wood cannot make are shown greyed out with the reason ("needs three contrasting species").
4. **Tune it.** A few sliders (board size, cell size, species order). The preview shows the first panel, the slices, and the finished board, with an animation of the cut-and-flip step, which is the part beginners find hardest to picture.
5. **Your plan.** Cut list, optional step-by-step instructions, and a printable version.

Guard rails run continuously and explain themselves in plain language:

- Finished thickness under 1-1/4 in. (prone to warping).
- Strips too narrow to rip safely, or slices too short to crosscut safely.
- Open-pored or soft species (red oak, ash, pine), flagged with the reason.
- More boards needed than the user has, with the shortfall stated.

## 6. Wood sourcing

The Wood Vault (woodvault.com) appears to be an Ottawa-area Canadian retailer. Its range suits pre-populated options well:

- **Cutting board packs:** 12 strips, 1-5/8 in. thick, 12 or 24 in. long, in domestic (walnut, maple, cherry) and tropical mixes.
- **Strip blanks:** 1-5/8 in. thick, 24 in. long, in widths from 1/4 to 1-1/4 in.
- **Surfaced boards:** 1/2, 3/4 and 1-5/8 in. thick; 24, 36 and 47 in. long.

Approach: a hand-curated catalog file in the repository, not live scraping. Each entry holds species, dimensions and a link to the product page, with no prices.

Reasons: the site's terms of use have not been read, prices mix two currencies and go stale, and a static file keeps the app free of any server. If the terms allow it, a refresh script can be added later.

Each species also carries a display colour, a hardness figure and a food-suitability flag. The hardness figures need checking against the Wood Database in Phase 0.

## 7. Outputs

**Cut list.** Grouped by stage so it reads in build order:

- Boards to buy or pull from stock.
- Rip cuts: species, count, width, from which board.
- Crosscuts: slice thickness, count, stop-block setting.
- A waste summary (kerf, trim, flattening) and what is left over.

**Instructions.** Generated from the recipe, one step per operation, each with a diagram of the workpiece at that point. Tips attach to the step where they apply, each with its source link. Examples:

- Flatten end grain with a router sled or drum sander, not a thickness planer.
- Use a crosscut sled with a stop block; never the rip fence and miter gauge together.
- Titebond III gives roughly twice the open time of Titebond II; glue large boards in sub-assemblies.
- Sand through the grits to 220; finish with mineral oil, then oil and beeswax.
- A care card to hand over with a gifted board.

Where sources disagree (planing with sacrificial strips, raising the grain, finish choice), the app says so instead of picking a side silently.

## 8. Technical approach

- **A static web app.** It runs entirely in the browser, needs no server or accounts, and can be hosted free on GitHub Pages.
- **TypeScript, React, Vite.** Mainstream and well documented, which keeps the project maintainable.
- **Geometry engine as a separate module with no interface code.** This is the part that must be right, so it gets thorough automated tests: known designs with hand-checked answers, plus checks such as "wood used plus waste equals wood supplied".
- **Drawing in SVG.** Sharp at any zoom and prints cleanly, which also gives the printable plan for free.
- **Designs saved in the browser and shareable as a link.**

## 9. Phases

| Phase | Delivers | Done when |
|---|---|---|
| 0. Verify | Research gaps closed (see section 10) | Each low-confidence row in section 1 is confirmed or the feature is cut |
| 1. Engine | Recipe model, slice geometry, cut list data, tests | Hand-checked checkerboard and brick designs match to 1/64 in. |
| 2. First usable version | Guided flow, four beginner patterns, kit catalog, cut list | A new user gets from a kit to a printed cut list unaided |
| 3. Instructions | Step-by-step guide, sourced tips, print layout | Every step has a diagram; every tip has a checked link |
| 4. Intermediate patterns | Second-generation and angled cuts | Chevron and basket weave render and produce correct cut lists |
| 5. Advanced patterns | Rhombus engine, tumbling blocks, 3D boards | Tumbling blocks verified against a published build |
| 6. Polish | Grain textures, share links, cost estimate, shopping list | - |

Phases 1 to 3 are the product. Phases 4 to 6 add range and can be reordered.

## 10. Open items

1. **Network access.** Allow woodvault.com, wood-database.com, mtmwood.com, instructables.com, thewoodwhisperer.com and lumberjocks.com in the environment's network settings so Phase 0 can read sources in full.
2. **Confirm the supplier.** Is woodvault.com (Canadian) the intended Wood Vault?
3. **Wood Vault terms of use.** Read before deciding whether the catalog may ever be imported automatically.
4. **MTM-style 3D boards.** Confirm the real method, or drop them from scope.
5. **Cutting Board Studio.** Try it by hand; it is the closest modern competitor.
