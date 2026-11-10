# Cutting Board Designer: build plan

A browser-based designer that takes the wood a person has (or can buy), lets them pick an end grain pattern, and produces a cut list and step-by-step build instructions.

## 1. How far to trust the research behind this plan

The first round of research ran with most websites blocked. A second round, after woodvault.com, mtmwood.com and thewoodwhisperer.com were opened up, read those three sites directly.

| Area                                                                 | Confidence          | What it rests on                                                        |
| -------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Wood Vault catalog                                                   | High                | Product listings read directly (November 2026)                          |
| MTM Wood 3D board method                                             | High for one design | MTM Wood's own free plan, "3D End Grain Cutting Board #1", read in full |
| Open-source designers (CBDJS, MvRens/CuttingBoard)                   | High                | Repositories read directly                                              |
| Slice-based pattern geometry (checkerboard, brick, stripes, chevron) | High                | Simple arithmetic, consistent with excerpts                             |
| Tumbling blocks geometry                                             | Medium              | Trigonometry is sound; build sequence is from search excerpts           |
| Build tips in the app                                                | High                | Every tip's source page read in full on 9 November 2026                 |
| cuttingboarddesigner.com                                             | High                | Used directly in a browser                                              |
| Other designers (CBdesigner, Cutting Board Studio)                   | Low                 | Search excerpts only                                                    |
| Species hardness figures                                             | Low                 | Recalled, not checked against the Wood Database                         |

Phase 0 below closes the remaining gaps before anything is shown to users as fact.

## 2. What existing tools get wrong

| Tool                                 | What it does well                                                                                                                              | Where it falls short                                                                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CBDJS (web, open source)             | Models both glue-ups, accounts for kerf, reports waste                                                                                         | No unit labels, no sideways shift (so no brick pattern), no cut list, no instructions                                                                                                                                                    |
| MvRens/CuttingBoard (web, archived)  | Multiple source panels, metric and decimal inches, save to file                                                                                | No kerf, no cut list, no fractional inches                                                                                                                                                                                               |
| CBdesigner (Windows, 2008)           | Kerf setting, material list, PDF                                                                                                               | Windows-only, dated, checkerboard-family patterns only                                                                                                                                                                                   |
| cuttingboarddesigner.com (web, free) | The strongest competitor: about a dozen patterns including chevron, weave and pinwheel; wood textures; build steps; share links; cost estimate | Pattern is typed as a code ("1W 1M 1W"); starts from abstract numbers, not real boards; wood needed is one slab per species in decimal inches (28.675in); no kerf setting visible; build steps say to plane the finished end grain board |
| Cutting Board Studio (web, beta)     | Reported 3D preview and yield figures                                                                                                          | Unverified; needs a hands-on look in Phase 0                                                                                                                                                                                             |

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

- **Laminate:** one or more panels, each an ordered list of strips (species, width) at one thickness `T` and length `L`.
- **Cut:** slice thickness `t`, kerf `k`, cut angle (90 degrees unless stated).
- **Arrange:** an ordered list of slices, each naming the panel it came from, plus any of: flip end for end, rotate, shift sideways, or re-rip to a narrower width.

Multiple panels and per-slice re-ripping are needed for the 3D boards (see section 4). Building them into the model from the start avoids a rewrite later.

A pattern is a preset that writes a recipe from a few friendly inputs (target size, species, cell size).

### Geometry for the slice family

| Quantity                           | Formula                                                                |
| ---------------------------------- | ---------------------------------------------------------------------- |
| Panel width                        | `W = sum of strip widths`                                              |
| Slices from a panel                | `N = floor((L + k) / (t + k))`, less one or two for squaring the ends  |
| Board length                       | `W`, less any trim from shifting                                       |
| Board width                        | `N x T`                                                                |
| Board thickness                    | `t` minus flattening allowance (default 1/16 in. per face per glue-up) |
| Panel length needed for `N` slices | `N(t + k) - k` plus about 1 in. for squaring                           |
| Surface cell size                  | `strip width x T`; square cells need strip width equal to `T`          |

Second-generation cuts lose another kerf per cut and another flattening pass, so the pattern repeat shrinks slightly each generation. The engine must carry this through; it is the detail that hand calculations usually miss.

### Geometry for the rhombus family (tumbling blocks, hexagons)

This family does not fit the slice model, so it gets its own small engine.

- Sticks are ripped to a 60/120 degree rhombus cross-section with the blade tilted 30 degrees from vertical.
- Rhombus side `s = T / sin 60 = 1.155 T`, where `T` is the stock thickness.
- Each rip loses `k / cos 30 = 1.155 k` of width.
- One stick of each of three tones glues into a hexagonal log, `2T` across the flats.
- Logs tile as a honeycomb, then the whole block is crosscut into boards.

## 4. Pattern library

| Pattern                        | Level        | Engine            | How it is made                                                                      |
| ------------------------------ | ------------ | ----------------- | ----------------------------------------------------------------------------------- |
| Stripes (even or varied width) | Beginner     | Slice             | No rearranging, or mirror alternate slices                                          |
| Checkerboard                   | Beginner     | Slice             | Two species, even strip count, flip alternate slices                                |
| Brick                          | Beginner     | Slice             | Shift alternate slices by half a strip; trim the ends                               |
| Chaotic                        | Beginner     | Slice             | Random strip widths, random shift per slice                                         |
| Plaid                          | Intermediate | Slice             | Thin accent strips in both generations                                              |
| Framed                         | Intermediate | Slice             | End grain border blocks only; never long grain                                      |
| Basket weave                   | Intermediate | Slice             | Square tiles of three strips laid in a grid, alternate tiles turned a quarter turn  |
| Chevron / zigzag               | Intermediate | Slice             | Strips ripped with the blade tilted 30 degrees; alternate slices turned upside down |
| Pixel art                      | Intermediate | Slice             | One panel recipe per distinct row                                                   |
| Tumbling blocks                | Advanced     | Rhombus           | Three tones, hexagonal logs                                                         |
| 3D illusion (MTM style)        | Advanced     | Slice, two panels | Shrinking strip widths, slices re-ripped to shrinking widths                        |

### What Phase 4 changed

The first version of this plan assumed a chevron needs a second glue-up, sawn at an angle. That wastes two large corners of the slab. The better method, and the one cuttingboarddesigner.com uses, is a single glue-up of strips ripped with a tilted blade: each strip then shows as a slanted band on the end grain, and turning alternate slices upside down mirrors the slant into a zigzag. The engine models that, and no second-generation machinery was needed.

Pixel art is not built yet. Plaid and framed were added once the interface could handle two different panels in one design (section 11).

### How the 3D illusion board is made (confirmed from MTM Wood's plan)

The effect comes from rectangles that shrink towards the centre in both directions. It is a single-generation board, not a two-generation one as first assumed.

1. Make two panels of light and dark strips. The second is a colour negative of the first.
2. Strip widths shrink towards the centre and grow again. In MTM's plan, in mm: 38, 29, 24, 19, 15, 12, 9, 7, 5, 4, 3, then back out, alternating tone (21 strips). Each step is roughly three quarters of the last.
3. Crosscut both panels into slices (42 mm in the plan, which sets board thickness) and turn them end grain up.
4. Re-rip each slice to a width from the same shrinking sequence: 33, 24, 15, 9, 5, 3 mm from panel one; 29, 19, 12, 7, 4 mm from panel two.
5. Interleave the slices, alternating panels, in the same shrink-then-grow order, and glue.

Practical notes from the plan: cut strips 1 to 1.5 mm oversize and sand to final size; edge strips are made 5 mm wider and trimmed after glue-up; align by eye on the centre rectangles, because slices slip under clamp pressure and cannot be corrected.

The other 3D variants (steps, weave) are still unconfirmed. MTM sells plans for those; they stay out of scope unless a source is found.

## 5. User experience

A five-step guided flow, with a live preview visible throughout.

1. **Your shop.** Units (fractional inches or metric), blade kerf (1/8 or 3/32 in.), and which tools the user owns. Tool answers change the instructions later: no jointer means recommending pre-surfaced stock; no drum sander means the router sled route.
2. **Your wood.** Three ways in:
   - _Start from a kit:_ pick a pre-populated pack and the app fills in the boards.
   - _I have boards:_ enter species and dimensions.
   - _Tell me what to buy:_ skip this step, set a target board size, and get a shopping list at the end.
3. **Pick a pattern.** A gallery labelled by difficulty. Patterns the user's wood cannot make are shown greyed out with the reason ("needs three contrasting species").
4. **Tune it.** A few sliders (board size, cell size, species order). The preview shows the first panel, the slices, and the finished board, with an animation of the cut-and-flip step, which is the part beginners find hardest to picture.
5. **Your plan.** Cut list, optional step-by-step instructions, and a printable version.

Guard rails run continuously and explain themselves in plain language:

- Finished thickness under 1-1/4 in. (prone to warping).
- Strips too narrow to rip safely, or slices too short to crosscut safely.
- Open-pored or soft species (red oak, ash, pine), flagged with the reason.
- More boards needed than the user has, with the shortfall stated.

## 6. Wood sourcing

The Wood Vault (woodvault.com) is an Ottawa-area Canadian retailer. Its listings, read directly in November 2026, suit pre-populated options well.

| Product                | Thickness                              | Width                         | Length         | Species                                                                                                      |
| ---------------------- | -------------------------------------- | ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| Cutting board packs    | 1-5/8 in.                              | makes a 12 in. panel          | 12 or 24 in.   | Hardwood (walnut, maple, cherry); Tropical (padauk, purpleheart, limba); Exotic (sapele, purpleheart, limba) |
| Cutting board blanks   | 1-5/8 in.                              | 3/4, 1 or 1-1/4 in.           | 24 in.         | Cherry, limba, maple, padauk, purpleheart, sapele, walnut                                                    |
| Surfaced boards, thick | 1-5/8 in. (maple and poplar 1-1/2 in.) | mostly 5-1/4 in.              | 24, 36, 47 in. | About 30 species                                                                                             |
| Surfaced boards, thin  | 1/2 or 3/4 in.                         | 3-1/2 to 9-1/4 in. by species | 24, 36, 47 in. | About 45 species                                                                                             |

Points that affect the design:

- **Blanks are the natural beginner route.** They arrive ready to glue, so a first board needs no jointer or planer.
- **Thick maple is 1-1/2 in., while most other species are 1-5/8 in.** Mixing them leaves steps in the panel. The app must warn about this and add a planing step.
- **Listed dimensions can vary by 1/4 in.** The app should tell users to measure their boards and let them correct the numbers.
- **47 in. is the longest length that ships.**
- **Wood Vault sells limba in its own cutting board packs**, although it is softer and more open-pored than ideal. The app flags it with an explanation and does not block it.

**Catalog approach: a hand-entered file, with nothing fetched from the site.** Wood Vault's terms of service prohibit crawling or scraping. The catalog (`src/data/woodVault.ts`) is built from the project's own Wood Vault reference document, and holds only species, dimensions and the supplier's rules: no prices, descriptions or images. Each line records where it came from.

Three things in the catalog go beyond the reference document, all read from product pages in November 2026:

- **Cutting board blanks.** The reference document covers surfaced boards only.
- **Hard maple, red oak and white oak widths.** The document inferred 4-3/4 in. and asked for verification; the product pages list 5-1/4, 7-1/4 and 9-1/4 in.
- **Thick hard maple at 1-1/2 in.**

Cutting board packs are not in the catalog yet, because the width of the strips in a pack is not confirmed.

Each species also carries a display colour, a hardness figure and a food-suitability flag. The hardness figures still need checking against the Wood Database.

## 7. Outputs

**Cut list.** Grouped by stage so it reads in build order:

- Boards to buy or pull from stock.
- Rip cuts: species, count, width, from which board.
- Crosscuts: slice thickness, count, stop-block setting.
- A waste summary (kerf, trim, flattening) and what is left over.

**Instructions.** Generated from the recipe, one step per operation, each with a diagram of the workpiece at that point. Tips attach to the step where they apply, each with its source link. Examples:

- Flatten end grain with a router sled or drum sander, not a thickness planer. (Confirmed: the Wood Whisperer article and its readers report kickback, shattered blades and destroyed boards.)
- Use a crosscut sled with a stop block; never the rip fence and miter gauge together.
- Titebond III gives roughly twice the open time of Titebond II; glue large boards in sub-assemblies.
- Sand through the grits to 220; finish with mineral oil, then oil and beeswax.
- A care card to hand over with a gifted board.

Where sources disagree, the app says so instead of picking a side silently. Planing is the clearest case: MTM Wood does plane end grain, with sacrificial rails and passes of 0.3 to 0.5 mm, while the Wood Whisperer advises never doing it. The app recommends the sled or sander and presents planing as an expert-only option with those precautions.

## 8. Technical approach

- **A static web app.** It runs entirely in the browser, needs no server or accounts, and can be hosted free on GitHub Pages.
- **TypeScript, React, Vite.** Mainstream and well documented, which keeps the project maintainable.
- **Geometry engine as a separate module with no interface code.** This is the part that must be right, so it gets thorough automated tests: known designs with hand-checked answers, plus checks such as "wood used plus waste equals wood supplied".
- **Drawing in SVG.** Sharp at any zoom and prints cleanly, which also gives the printable plan for free.
- **Designs saved in the browser and shareable as a link.**

## 9. Phases

| Phase                           | Delivers                                                   | Done when                                                                                          |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 0. Verify                       | Research gaps closed (see section 10)                      | Each low-confidence row in section 1 is confirmed or the feature is cut                            |
| 1. Engine (done)                | Recipe model, slice geometry, cut list data, tests         | Hand-checked checkerboard and brick designs match to 1/64 in.                                      |
| 2. First usable version (done)  | Guided flow, four beginner patterns, kit catalog, cut list | A new user gets from a kit to a printed cut list unaided                                           |
| 3. Instructions (done)          | Step-by-step guide, sourced tips, print layout             | Every step has a diagram; every tip has a checked link                                             |
| 4. Intermediate patterns (done) | Basket weave and chevron                                   | Chevron and basket weave render and produce correct cut lists                                      |
| 5. Advanced patterns (started)  | Rhombus engine, tumbling blocks, 3D illusion board (done)  | 3D board reproduces MTM's published dimensions; tumbling blocks verified against a published build |
| 6. Polish                       | Grain textures, share links, cost estimate, shopping list  | -                                                                                                  |

Phases 1 to 3 are the product. Phases 4 to 6 add range and can be reordered.

## 10. Open items

1. **Sites not yet read.** www.instructables.com and www.lumberjocks.com, for tumbling block build guides; www.thecraftycatsman.com, for the Cutting Board Studio competitor.
2. **Cutting board packs.** Confirm how many strips of what width each pack contains.
3. **Competitor to try by hand.** Cutting Board Studio.
4. **USDA sanitising advice.** The USDA cutting board page refuses automated visits, so its bleach-sanitising advice is not in the app. Read it by hand before adding.
5. **Tumbling blocks.** Confirm the build sequence against a published guide.

## 11. Status and where to pick up

Updated 10 November 2026, at the end of the second working session. Read this section first.

### Completed

| Area                | What exists                                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry engine     | Recipe model, finished size, surface layout, slice counts, which pieces to rip from each slice, full waste breakdown, cut planner, purchase planner, design checks (`src/engine`)        |
| Patterns in the app | Checkerboard, brick, stripes, chaotic (beginner); basket weave, chevron, plaid, framed (intermediate); MTM Wood's 3D illusion board (advanced)                                           |
| Designer            | Five steps: shop, wood, pattern, size, cut list. Buy from the Wood Vault catalog or enter your own boards. Design remembered in the browser, and shareable as a link                     |
| Outputs             | Cut list in build order; optional full instructions with diagrams, numbered steps, sanding, oiling and care; print layout for both. Both handle designs with more than one kind of panel |
| Tips                | Twenty, each citing a source read in full on 9 November 2026; disagreements between sources are shown                                                                                    |
| Data                | Species list with food-suitability ratings; hand-entered Wood Vault catalog (surfaced boards and cutting board blanks)                                                                   |
| Project hygiene     | 161 unit tests and 17 end-to-end browser tests; formatting, type, unit and browser checks on every push; automatic publishing of `main` to GitHub Pages once switched on                 |

### What the second session changed

- **The cut list and instructions no longer assume one panel.** Panels that are built identically (the logs of a basket weave) are described once; panels that differ (the two of the 3D board) each get their own strip order, length and picture. This is the change plaid and framed boards were waiting for.
- **A new build stage, "Rip the slices into pieces",** appears for designs whose slices are cut narrower. The engine now says which pieces come from which slice, not just how many slices are needed.
- **The 3D illusion board is in the pattern gallery.** It is always square. At 317 mm it uses MTM Wood's widths to the millimetre; other sizes scale them, and in inches every width is rounded to 1/32 in. so the numbers on the cut list are the numbers to set on the saw.
- **Plaid and framed boards were added** on top of that. Plaid is squares divided by 1/4 in. lines both ways; the cross lines are thin pieces ripped from a second panel. Framed puts a border of the last wood round a plain centre (two woods) or a checkerboard (three). Borders and lines are end grain, as section 4 requires.
- **Boards within 0.15 mm of the thickness wanted are used as they are.** Without this a 38 mm strip could not come from a 38.1 mm (1-1/2 in.) board unless it was planed.
- **The designer says when a planer would shorten the shopping list.** Maple and walnut are sold in different thicknesses, so the 3D board in those woods draws maple from four products; with a planer and 1-1/2 in. strips it is two boards.
- **Share links.** "Copy a link to this design" on the last step. The design travels in the link, so there is still no server. Saved and shared designs are now checked field by field, so a damaged link or an old saved design cannot break the page.
- **"Make the biggest board my wood allows"** on the size step, for people working from boards they already have.
- **A tighter print layout:** smaller type, pictures and margins on paper only.
- **A purchase planner bug was fixed.** When one board size was the best choice for several strip widths, the cut plan listed those boards several times over and bought one board per width. The first end-to-end test of the 3D board exposed it. No earlier pattern triggered it, because each needed one strip width per wood.

### Outstanding

**Needs a person**

- Switch on GitHub Pages: Settings, Pages, Source, "GitHub Actions". The site is not live until this is done.
- Try the designer as a real user and note what is confusing. Nobody but the author has used it yet.
- Confirm what a Wood Vault cutting board pack contains (how many strips, how wide), so packs can join the catalog.
- Read the USDA cutting board page by hand if bleach-sanitising advice is wanted in the care card.
- Check the 3D board's step-by-step wording against MTM Wood's plan. The sizes and the order of work are from the plan; the detail of each step (how to hold a slice when ripping it, for example) was worked out from the geometry, and the app says so.

**Patterns**

- Plaid line width is fixed at 1/4 in., and a framed border is as wide as one block. Both could be settings. Their build steps are worked out from geometry, not a published guide, and the app says so.
- Tumbling blocks. Needs its own geometry (60 degree rhombus sticks in hexagonal logs, section 3) and a published build guide to check against. Not started.
- Pixel art. Not started.
- Chevron tilt is fixed at 30 degrees. Its build steps are worked out from geometry and have not been checked against a published guide.

**Designer**

- The biggest-board button keeps the proportions you set and tries sizes in 3% steps. It does not try other proportions, strip widths or patterns.
- The cut planner places each strip in the first board with room. For the 3D board that can pair a 5/32 in. piece with a wide one in the same slice, which is awkward to saw. A smarter pairing would help.
- Animated view of the cut-and-flip step. A still diagram covers it for now.
- Printed length: the default cut list is two pages and its full instructions seven (they were three and ten); the 3D board's are five and eleven. Pictures and tips are kept whole, which still leaves some part-empty pages.

**Polish (Phase 6)**

- Wood grain textures in previews, cost estimate.

**Verification**

- The end-to-end tests check that every pattern reaches a cut list with nothing to fix and no errors. They do not check that pictures look right, or the printed layout.
- Species hardness figures were never checked and are not used in the app.
- Competitors not yet tried: Cutting Board Studio (thecraftycatsman.com).

### Recommended next session

1. **Tumbling blocks**, the largest remaining piece of new geometry. Read a published build guide first (section 10, item 5).
2. Pixel art.

If real-user feedback arrives first, let it reorder this list.
