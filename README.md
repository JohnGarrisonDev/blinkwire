# Blinkwire

A calm rotate-the-tiles wiring puzzle for [Oddvale Games](https://games.oddvale.com/blinkwire/).

The lamps of Oddvale are sleepy little eyes. Turn the wire tiles until every one of them is joined to **the Big Eye** and blinks awake. A board is solved when every tile is lit and no wire end is left loose.

- **Journey:** 60 fixed levels in 6 chapters (3x3 up to 9x11), with bolted tiles and wrap-around boards later on. Up to 3 stars each.
- **Daily:** one board per calendar day, the same for everyone, with a streak and a copyable, spoiler-free result.
- **Free play:** endless random boards, 4x4 to 12x12, wrap and bolts optional.

Designed, built and updated by AI models. No build step, no dependencies, no network requests.

## Run it

Any static file server works. From the hub repo:

```
node ../oddvale-games/scripts/serve.mjs . 4303
```

then open http://127.0.0.1:4303/ . Add `?debug` to the URL to get a `window.__game` hook for automated play-testing (`__game.solve()`, `__game.state()`, ...).

## Test it

```
node --test tests/
```

(`node --test` on its own works too.) The tests cover the generator, power flood-fill, win check, par, stars, daily seeds, the save format, and snapshot the 60 Journey levels.

## Controls

| | Turn | Turn back | Pin |
|---|---|---|---|
| Touch | tap | two-finger tap, or flip the Turn button | long-press, or Pin mode |
| Mouse | click | right-click or Shift-click | long-press, or Pin mode |
| Keyboard | Space / Enter / E (arrows or WASD move) | Shift+Space / Q | P |

`Z` undo, `H` hint, `R` restart, `Esc` menu.

## Layout

```
index.html          page shell (from the hub's kit/template.html)
game.json           metadata the hub reads
cover.webp          cover art (supplied separately)
kit/                copy of the hub kit. Do not edit; re-copy from the hub to update
src/main.js         app state, screen flow, frame loop, saving, debug hook
src/ui.js           DOM overlays: title, level select, free-play setup, HUD, toolbar, modals
src/game.css        styles for everything inside the stage
src/render.js       canvas drawing: tiles, wires, eyes, wrap stubs, confetti
src/boardview.js    per-board animation state: spins, the power wave, hint flash
src/input.js        pointer gestures on the canvas
src/audio.js        synth sound effects
src/fx.js           confetti pool
src/logic/          pure rules, no DOM, shared with the tests
  rng.js            seeded rng (copy of the kit's)
  grid.js           tile masks, rotation, neighbours, power flood-fill, win check, par
  generate.js       level generator + level fingerprint
  levels.js         the 60 Journey levels
  daily.js          daily seeds, streaks, share text
  session.js        a board in play: turn, undo, pin, hint, snapshot/restore
  stars.js          star thresholds
  save.js           save schema + sanitiser
tests/              node --test
```

See [AGENTS.md](AGENTS.md) for architecture notes, the level format, and the ideas backlog.

## License
Code is MIT licensed, see [LICENSE](LICENSE). The fonts in `kit/fonts/` (Fraunces, Figtree, DM Mono) are under the SIL Open Font License 1.1. The Oddvale name and mark are not covered by the MIT license.
