# Notes for the next AI

Blinkwire is an Oddvale Games title. Read the hub's `GAME_GUIDE.md` first (no build step, no dependencies, relative URLs, localStorage only, strict CSP: no inline scripts, no `eval`). This file is what you need on top of that.

## Architecture in one minute

- `src/logic/*` is pure: no DOM, no clock, no `window`. Everything about the rules lives there and is covered by `tests/`. Keep it that way; if a rule changes, change it there and add a test.
- `src/main.js` owns the app: one `app` object (current mode, level, session, view), the `actions` table (every button click lands here by name), the frame loop and all saving.
- `src/ui.js` builds the DOM overlays once and exposes dumb setters (`setHud`, `openSolved`, ...). It never touches game state. Buttons carry `data-act="name"`; a single click listener calls `actions[name](dataset, element)`.
- `src/render.js` draws the canvas every frame: paper, board plate, tiles, wires, eyes. `src/boardview.js` holds the animation state that sits on top of a session (spin angles, the time each tile lights up, hint flash). Logic is instant; visuals catch up.
- The canvas fills the whole stage. The DOM layouts contain an empty `.slot` element; `main.js` measures it (`ui.slot`) and `layoutBoard` fits the board inside. So layout is CSS: move the slot, the board follows.
- Layout switch: `main.js` adds `.portrait` to the stage when it is taller than wide (this also works in full screen), and sets the `.ui` font-size from the stage size. All sizes in `game.css` are in `em`.
- The stage is always cream paper, also in dark mode. The brand tokens are pinned to light values inside `.ui`.

### Tiles

A tile is a 4-bit mask of connections: north 1, east 2, south 4, west 8. Rotating clockwise is a bit rotation (`rotCW`). Kind is derived from the mask: 1 bit = lamp (or the source), 2 = straight or corner, 3 = tee, 4 = cross. The source is just the tile at `level.source`; it turns like any other.

`flood(grid, masks)` returns which tiles are powered, their depth from the source, the direction back to the source, and the number of loose ends. Solved = every tile powered and zero loose ends. Because the generated solution is a spanning tree and shapes never change, that also means no loops.

### Moves, par, stars

- Every quarter turn costs one move, in either direction. Undo refunds the move.
- Par = fewest clockwise taps from the scramble to the stored solution (a straight is at most 1 away, a cross 0). Turning counter-clockwise can therefore finish under par; that is intended and the solve card celebrates it.
- Stars (`stars.js`): 3 if moves <= par + max(1, 10%), 2 if moves <= par + max(4, 50%), else 1. Using a hint caps the level at 2.
- Hints flash a tile that differs from the target solution, nearest the source first. A few boards (about one in ten, mostly wrap) have more than one solution; any of them counts as solved (`flood`). Since 1.3 the target is `nearestSolution(level, cur, pinned)` in `src/logic/solve.js`: a small constraint search (arc consistency on arm matches, branch and bound on tiles that differ from the player's board, a wrong pinned tile counts double) that keeps the stored solution on ties and when its node budget (12000) runs out. Worst case seen: about 60 ms on a 12x12 wrap board from a full scramble on desktop; usually a few ms. The title demo passes `{ stored: true }` so it walks the stored answer. `countSolutions` there is for tests (`tests/solve.test.js` finds shipped boards with a second answer and checks hints never fight it).
- Par and stars still use the stored solution, so a different answer can need more or fewer turns than par.

## Level format and seeds (read before touching the generator)

Levels are never stored. They are regenerated from a small definition every time:

```
{ seed, w, h, wrap, lock, scramble }
```

- `lock` is the share of tiles bolted in place (0..1). `scramble` (tutorials only) turns just that many tiles.
- Journey definitions are rows in `src/logic/levels.js`. The seed of level `i` is `hashString('blinkwire/journey/' + (i + 1))` unless a row sets `seed`.
- The daily definition comes from `dailyDef(dateKey)` in `daily.js`, seeded from the local date.

Consequence: **any change to `generate.js`, `rng.js`, or the order/number of `rng()` calls silently changes every Journey level and every Daily board.** Players' stars, bests and in-progress boards are tied to the old boards, and two players on different versions would get different dailies.

`tests/levels.test.js` holds a fingerprint (`levelHash`) of all 60 Journey levels and `tests/daily.test.js` of three dated dailies. If those tests fail, you changed the boards. Do not paste in new hashes to make them pass. If you want a different generator (better shapes, a new tile type), add it as a new code path chosen by a field in the definition (for example `gen: 2`) and leave the old path exactly as it is, so old rows still produce the same boards.

A saved in-progress board is validated against the regenerated level when loaded (`session.js` `restore`): wrong length, or a tile that is not a rotation of the level's tile, and the save is dropped instead of crashing.

### Adding a chapter

1. Append a new object to `CHAPTERS` in `levels.js` with exactly 10 rows. Never insert in the middle or reorder: stars are stored by level index.
2. Keep width <= 9 (a test enforces it) and height >= width, so the board stays tappable on a 360px phone. Bigger means taller.
3. Play every new level. If a seed gives an ugly or unfair board, set `seed:` on that row to pick another.
4. Add the chapter's hashes to `JOURNEY_SNAPSHOT` and update the counts in the first test of `tests/levels.test.js`, the level-select total, `game.json` description, README and CHANGELOG.

### Adding a tile type or variant

- A new rule flag (like `wrap`): add it to the definition, thread it through `generate` (after all existing `rng()` calls, or behind a `gen` switch), handle it in `flood`/`neighbor` if it changes connectivity, draw it in `render.js`, show a chip in `startBoard` (`main.js`), save it in `persist` and `sanitize` for free play, and add tests.
- A new tile shape: masks only describe four arms, so anything richer (one-way wires, bridges, switches) needs a parallel per-tile array on the level (like `locked`). Remember `snapshot`/`restore`.
- Keep colour from being the only signal. Lit wires have a pale core line and moving dots; loose lit ends get a pink spark; bolts are drawn as bolts.

## Free-play setup (1.3)

Two columns in landscape (preview | options), one in portrait (a smaller preview beside its caption on top). The preview `.mini` is a DOM grid sized by `--w`/`--h`; the source dot sits in the middle, bolts follow a fixed pattern (it is a picture, not the real board), and wrap adds dashed edges. `freeFeel()` in `main.js` turns size, wrap and bolts into Breezy / Steady / Tricky / Tough (shown as a word on a coloured pill).

- Bolts in the preview come from `boltAt(i, w, h)` in `ui.js`, a small integer hash (about one tile in ten, scattered).

## Result card and copying (1.3)

`main.js` adds `.short` to the stage when it is landscape and under 520px tall (a phone on its side). There the solved card is two columns: results on the left, streak, days, the copy box, buttons and the vote on the right; in full screen it keeps clear of the exit button with right padding. `.ui .btn` has `min-height: 44px`. Copy result tries the clipboard API, then `execCommand`; if both fail, `showShareBox` puts the text in a read-only, selected `textarea.sharebox` (on an upright phone the days row hides to make room). Share text ends with `https://games.oddvale.com/blinkwire/`. Not checked with the daily vote showing (the API is not served locally).

## Player input (kit/talk.js)

`kit/talk.js` is the hub's anonymous input widget (copy, do not edit). `main.js` calls `tellUs` once for the `#tell-us` card under the stage, and `dailyTalk` on the daily solved card (`ui.openSolved({ talk: true })` returns an empty `.talk-slot`), with `score` = moves of the first solve from `save.daily.history` (fewer is better; single API board). Everything stays hidden when the API is unreachable.

## Save data

One blob at `oddvale:blinkwire`. The schema is documented at the top of `src/logic/save.js`; `sanitize()` rebuilds a clean save from whatever it finds, so always add new fields there with a default. Each mode keeps one in-progress board (`progress.journey / daily / free`), written after every move and every 5 seconds while the clock runs. `last` remembers which mode was on screen so a reload drops the player straight back into the board.

## Testing by hand

Serve the folder (see README) and open `/?debug`. `window.__game` then has `state()`, `solve(leave)` (taps tiles into place through the real code path, optionally leaving some), `turn(i, dir)`, `pin(i)`, `tilePoint(i)` (client coordinates for synthetic pointer events), plus `app`, `save`, `actions`. Check desktop and a 390x800 phone size, mouse, touch and keyboard, and keep the console clean.

`node --test tests/` works because of `tests/index.js` (newer Node treats the folder as a module). If you add a test file, import it there.

## Balance and feel notes

- Generator knobs are at the top of `generate.js`: `RUN_BIAS` (long runs vs branches), `STRAIGHT_BIAS`, `CROSS_CHANCE`. Current mix on 8x8: about 23% lamps, 30% straights, 27% corners, 19% tees, well under 1% crosses. Do not retune them in place (see above).
- Wrap boards are much harder than flat ones of the same size; chapter 4 restarts at 4x4 for that reason, and bolts make wrap boards friendlier.
- The power wave is capped at about 0.65 s however long the wire is; lamp blips climb a pentatonic scale by share of lamps lit.
- Tile size on a 360px-wide phone at 9 columns is about 33px. Do not go wider.

## Phones and full screen (1.2.0)

- The kit's `wireChrome({ stage, orientation: 'portrait' })` gives full screen on every phone (native, or the iPhone "focus" fallback; both add `.stage.is-full`); native full screen locks to portrait on Android because boards are never wider than tall.
- The canvas is inset by the safe areas in full screen, so `ui.slot()` is measured against the **canvas** (not the stage), and `game.css` insets `.ui` by the same amounts. Keep the two in step.
- Nothing sits under the kit's 44px exit button: in full screen the portrait `.hud-top` and the menu `.bar`s get 50px right padding, the landscape board/title slot 60px right margin, modals 60px top padding.
- `input.js` reports `press(index)` while a pointer is down on a tile; `render.js` draws a bold ring (`opts.press`) so the finger never hides which tile will turn. Sliding more than 14px cancels the tap and the ring.
- `setHud` adds `.tight` (drops the word "moves") when the stats row would overflow, not only on long numbers.
- `haptic()` from the kit on turn, refusal, long-press pin and solve.

## Known weak spots

- Phone landscape (1.3): `game.css` uses a 2:1 stage and `max-width: (100dvh - 62px) * 2` under `(orientation: landscape) and (max-height: 500px)`, so an 844x390 phone gets a 656x328 stage (was 470x294); the stage then exactly fills the viewport under the 62px top bar. Wider stages lift `maxFreeW` to 12 there, so a 12x12 free board gets about 24px tiles sideways (9x12 was already possible before).
- The free-play note about the 9-wide cap is computed when the screen opens, not on resize.
- Par is measured to the stored answer only; a player solving another answer may beat or miss par for that reason.
- The canvas redraws every frame even when nothing moves (the pulse dots always move). Fine on phones so far, but an idle-throttle would save battery.
- No colour-blind or high-contrast toggle beyond the built-in non-colour cues.

## Ideas backlog

- A light twist tile for a chapter 7: "sleepy fog" (tiles hidden until a neighbour is lit), one-way diodes, or twin tiles that turn together.
- Second source colour: two Big Eyes, lamps tinted by who feeds them, mixing where they meet.
- Daily archive: play past days from the history strip (no streak credit).
- Per-level best time on the level buttons. (The "PAR" stamp for at-or-under-par solves shipped in 1.3: `showLevels` computes pars with `journeyPar(i)`, cached.)
- Unique-solution generator pass (reject or patch boards with more than one solution), as `gen: 2`.
- Zoom and pan for 12x12 on small phones, which would lift the 9-column cap.
- A share image (canvas to PNG of the lit board silhouette, no wires) next to the text result.
- Gentle ambient music loop built from the lamp scale, off by default.
- Hint levels: first flash the tile, second press turns it for you.
