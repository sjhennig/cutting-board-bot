# Cutting Board Designer: build plan

A browser-based designer that takes the wood a person has (or can buy), lets them pick an end grain pattern, and produces a cut list and step-by-step build instructions.

## 1. How far to trust the research behind this plan

The first round of research ran with most websites blocked. A second round, after woodvault.com, mtmwood.com and thewoodwhisperer.com were opened up, read those three sites directly.

| Area | Confidence | What it rests on |
|---|---|---|
| Wood Vault catalog | High | Product listings read directly (November 2026) |
| MTM Wood 3D board method | High for one design | MTM Wood's own free plan, "3D End Grain Cutting Board #1", read in full |
| Open-source designers (CBDJS, MvRens/CuttingBoard) | High | Repositories read directly |
| Slice-based pattern geometry (checkerboard, brick, stripes, chevron) | High | Simple arithmetic, consistent with excerpts |
| Planer safety tip | High | Wood Whisperer article read in full |
| Tumbling blocks geometry | Medium | Trigonometry is sound; build sequence is from search excerpts |
| Other build tips | Medium | Reputable sources identified, but pages not read in full |
| Other designers (CBdesigner, Cutting Board Studio, cuttingboarddesigner.com) | Low | Search excerpts only, or not reachable |
| Species hardness figures | Low | Recalled, not checked against the Wood Database |

Phase 0 below closes the remaining gaps before anything is shown to users as fact.

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

- **Laminate:** one or more panels, each an ordered list of strips (species, width) at one thickness `T` and length `L`.
- **Cut:** slice thickness `t`, kerf `k`, cut angle (90 degrees unless stated).
- **Arrange:** an ordered list of slices, each naming the panel it came from, plus any of: flip end for end, rotate, shift sideways, or re-rip to a narrower width.

Multiple panels and per-slice re-ripping are needed for the 3D boards (see section 4). Building them into the model from the start avoids a rewrite later.

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
| 3D illusion (MTM style) | Advanced | Slice, two panels | Shrinking strip widths, slices re-ripped to shrinking widths |

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

The Wood Vault (woodvault.com) is an Ottawa-area Canadian retailer. Its listings, read directly in November 2026, suit pre-populated options well.

| Product | Thickness | Width | Length | Species |
|---|---|---|---|---|
| Cutting board packs | 1-5/8 in. | makes a 12 in. panel | 12 or 24 in. | Hardwood (walnut, maple, cherry); Tropical (padauk, purpleheart, limba); Exotic (sapele, purpleheart, limba) |
| Cutting board blanks | 1-5/8 in. | 3/4, 1 or 1-1/4 in. | 24 in. | Cherry, limba, maple, padauk, purpleheart, sapele, walnut |
| Surfaced boards, thick | 1-5/8 in. (maple and poplar 1-1/2 in.) | mostly 5-1/4 in. | 24, 36, 47 in. | About 30 species |
| Surfaced boards, thin | 1/2 or 3/4 in. | 3-1/2 to 9-1/4 in. by species | 24, 36, 47 in. | About 45 species |

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

| Phase | Delivers | Done when |
|---|---|---|
| 0. Verify | Research gaps closed (see section 10) | Each low-confidence row in section 1 is confirmed or the feature is cut |
| 1. Engine (done) | Recipe model, slice geometry, cut list data, tests | Hand-checked checkerboard and brick designs match to 1/64 in. |
| 2. First usable version | Guided flow, four beginner patterns, kit catalog, cut list | A new user gets from a kit to a printed cut list unaided |
| 3. Instructions | Step-by-step guide, sourced tips, print layout | Every step has a diagram; every tip has a checked link |
| 4. Intermediate patterns | Second-generation and angled cuts | Chevron and basket weave render and produce correct cut lists |
| 5. Advanced patterns | Rhombus engine, tumbling blocks, 3D illusion board | 3D board reproduces MTM's published dimensions; tumbling blocks verified against a published build |
| 6. Polish | Grain textures, share links, cost estimate, shopping list | - |

Phases 1 to 3 are the product. Phases 4 to 6 add range and can be reordered.

## 10. Open items

1. **Sites still blocked.** Several addresses only work with the "www." prefix, which is treated as a separate site. To allow: www.cuttingboarddesigner.com, www.wood-database.com, www.instructables.com, www.lumberjocks.com, www.thecraftycatsman.com, www.titebond.com, www.finewoodworking.com, www.thisoldhouse.com, www.wwgoa.com, www.fsis.usda.gov.
2. **Cutting board packs.** Confirm how many strips of what width each pack contains.
3. **Competitors to try by hand.** cuttingboarddesigner.com and Cutting Board Studio, once reachable.
4. **Remaining tip sources.** Glue figures, finishing and care advice need their pages read in full.
5. **Tumbling blocks.** Confirm the build sequence against a published guide.
