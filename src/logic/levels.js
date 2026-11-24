// The Journey: 60 fixed levels in 6 chapters of 10. Pure data + helpers.
// Each row: [w, h, flags]. flags: wrap, lock (share of bolted tiles), scramble (tutorial: only this many tiles turned),
// tip (one-line prompt), seed (override; otherwise derived from the level number).
// Boards are never wider than 9 so they stay tappable on a 360px phone; big boards grow taller instead.
// DO NOT reorder or edit shipped rows: players' stars are stored by level index. Add new chapters at the end.
import { generate } from './generate.js'
import { hashString } from './rng.js'

const W = { wrap: true }
export const CHAPTERS = [
  {
    name: 'First Light', blurb: 'Small boards. Learn the ropes.',
    levels: [
      [3, 3, { scramble: 1, tip: 'Tap a tile to turn it. Join the wire to the Big Eye.' }],
      [3, 3, { scramble: 3, tip: 'Light every eye. Power flows out from the Big Eye.' }],
      [4, 4, { scramble: 5, tip: 'No loose ends: every wire end must meet another wire.' }],
      [4, 4, { tip: 'Now a properly scrambled one. Edges are a good place to start.' }],
      [4, 4, {}], [4, 5, {}], [5, 5, {}], [5, 5, {}], [5, 5, {}], [5, 6, {}],
    ],
  },
  {
    name: 'Back Alleys', blurb: 'More tiles, more turns.',
    levels: [
      [5, 5, { tip: 'Sure about a tile? Long-press to pin it in place.' }],
      [5, 6, {}], [5, 6, {}], [6, 6, {}], [6, 6, {}], [6, 6, {}], [6, 7, {}], [6, 7, {}], [7, 7, {}], [7, 7, {}],
    ],
  },
  {
    name: 'Bolted Down', blurb: 'Some tiles are fixed. Build off them.',
    levels: [
      [6, 6, { lock: 0.22, tip: 'Bolted tiles are already right and cannot turn. Build off them.' }],
      [6, 6, { lock: 0.18 }], [6, 7, { lock: 0.16 }], [7, 7, { lock: 0.16 }], [7, 7, { lock: 0.14 }],
      [7, 7, { lock: 0.12 }], [7, 8, { lock: 0.12 }], [7, 8, { lock: 0.12 }], [8, 8, { lock: 0.12 }], [8, 8, { lock: 0.1 }],
    ],
  },
  {
    name: 'Round the Bend', blurb: 'Wires that leave one edge come back on the other.',
    levels: [
      [4, 4, { ...W, lock: 0.2, tip: 'This board wraps: a wire leaving one edge comes back in on the opposite side.' }],
      [4, 4, { ...W, tip: 'The stubs outside the board show where edge wires are heading.' }],
      [4, 5, W], [5, 5, { ...W, lock: 0.16 }], [5, 5, W], [5, 5, W],
      [5, 6, { ...W, lock: 0.12 }], [6, 6, { ...W, lock: 0.15 }], [6, 6, { ...W, lock: 0.08 }], [6, 6, W],
    ],
  },
  {
    name: 'Long Wires', blurb: 'Big boards. Pin as you go.',
    levels: [
      [7, 8, {}], [8, 8, {}], [8, 8, { lock: 0.08 }], [8, 9, {}], [8, 9, { lock: 0.08 }],
      [8, 9, {}], [8, 10, { lock: 0.08 }], [8, 10, {}], [9, 9, { lock: 0.06 }], [9, 9, {}],
    ],
  },
  {
    name: 'The Whole Valley', blurb: 'Everything at once.',
    levels: [
      [8, 8, { lock: 0.1 }], [6, 7, { ...W, lock: 0.12 }], [9, 9, {}], [7, 7, { ...W, lock: 0.12 }], [9, 10, { lock: 0.05 }],
      [7, 8, { ...W, lock: 0.1 }], [9, 10, {}], [8, 8, { ...W, lock: 0.12 }], [9, 11, { lock: 0.05 }], [9, 11, {}],
    ],
  },
]

export const PER_CHAPTER = 10
export const LEVEL_COUNT = CHAPTERS.length * PER_CHAPTER

/** Seed for journey level i (0-based) unless the row overrides it. Fixed forever. */
export const journeySeed = (i) => hashString(`blinkwire/journey/${i + 1}`)

/** The definition (not yet generated) of journey level i. */
export function journeyDef(i) {
  const chapter = (i / PER_CHAPTER) | 0, n = i % PER_CHAPTER
  const [w, h, f] = CHAPTERS[chapter].levels[n]
  return { index: i, chapter, n, w, h, wrap: !!f.wrap, lock: f.lock || 0, scramble: f.scramble ?? null, tip: f.tip || '', seed: f.seed ?? journeySeed(i) }
}

export const journeyLevel = (i) => generate(journeyDef(i))
/** "3-7" style label. */
export const levelLabel = (i) => `${((i / PER_CHAPTER) | 0) + 1}-${(i % PER_CHAPTER) + 1}`
/** Level i is open when it is the first one or the one before it has been solved. */
export const isUnlocked = (stars, i) => i === 0 || (stars[i - 1] | 0) > 0
