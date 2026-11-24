// Level generator: seeded spanning tree -> tile shapes -> scramble. Pure, no DOM.
// CAREFUL: Journey and Daily levels are regenerated from their seeds every time. Any change to the order or number
// of rng() calls in here changes every existing level. tests/levels.test.js snapshots a few to catch that.
import { makeRng, hashString } from './rng.js'
import { DIRS, opposite, neighbor, rotN, orientations, popcount, flood, parBetween } from './grid.js'

const RUN_BIAS = 0.6       // chance to keep growing from the newest tile (long runs) instead of a random one (branches)
const STRAIGHT_BIAS = 0.45 // chance to carry straight on when that is possible
const CROSS_CHANCE = 0.2 // share of tiles that are allowed a fourth connection

/**
 * def: { seed, w, h, wrap?, lock? (0..1 share of bolted tiles), scramble? (only this many tiles are turned; default all) }
 * Returns a level: { w, h, wrap, seed, source, sol, start, locked, par, lamps }
 *  - sol[i]    connection mask of tile i when solved
 *  - start[i]  mask at the start of play
 *  - locked[i] 1 if bolted down (always starts solved)
 */
export function generate(def) {
  const w = def.w | 0, h = def.h | 0, wrap = !!def.wrap, n = w * h
  if (w < 2 || h < 2 || (wrap && (w < 3 || h < 3))) throw new Error('board too small')
  const rng = makeRng(def.seed >>> 0)
  const g = { w, h, wrap, source: 0 }

  // --- grow a spanning tree
  // Keep the source off the rim on bigger boards so it has room to branch.
  const inset = !wrap && w >= 5 && h >= 5 ? 1 : 0
  g.source = (inset + rng.int(h - inset * 2)) * w + inset + rng.int(w - inset * 2)
  const sol = new Uint8Array(n), inTree = new Uint8Array(n), cameFrom = new Int8Array(n).fill(-1), cap = new Uint8Array(n)
  for (let i = 0; i < n; i++) cap[i] = rng() < CROSS_CHANCE ? 4 : 3
  const link = (a, d, b) => { sol[a] |= 1 << d; sol[b] |= 1 << opposite(d); inTree[b] = 1; cameFrom[b] = d }
  const active = [g.source]; inTree[g.source] = 1
  const cand = []
  while (active.length) {
    const at = rng() < RUN_BIAS ? active.length - 1 : rng.int(active.length)
    const c = active[at]
    cand.length = 0
    if (popcount(sol[c]) < cap[c]) for (let d = 0; d < 4; d++) { const j = neighbor(g, c, d); if (j >= 0 && !inTree[j]) cand.push(d) }
    if (!cand.length) { active.splice(at, 1); continue }
    let d = cand[rng.int(cand.length)]
    if (cameFrom[c] >= 0 && cand.includes(cameFrom[c]) && rng() < STRAIGHT_BIAS) d = cameFrom[c]
    const j = neighbor(g, c, d)
    link(c, d, j); active.push(j)
  }
  // Tiles boxed in by full neighbours: attach them anyway (this is where most crosses come from).
  for (let left = true; left;) {
    left = false
    for (let i = 0; i < n; i++) {
      if (inTree[i]) continue
      left = true
      const opts = []
      for (let d = 0; d < 4; d++) { const j = neighbor(g, i, d); if (j >= 0 && inTree[j]) opts.push(d) }
      if (!opts.length) continue
      opts.sort((a, b) => popcount(sol[neighbor(g, i, a)]) - popcount(sol[neighbor(g, i, b)]))
      const d = opts[0]; link(neighbor(g, i, d), opposite(d), i)
    }
  }

  // --- bolt some tiles down
  const locked = new Uint8Array(n)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) { const j = rng.int(i + 1); const t = order[i]; order[i] = order[j]; order[j] = t }
  const lockCount = Math.min(n - 2, Math.round((def.lock || 0) * n))
  for (let k = 0, done = 0; k < n && done < lockCount; k++) { if (orientations(sol[order[k]]) > 1) { locked[order[k]] = 1; done++ } }

  // --- scramble
  const start = Uint8Array.from(sol)
  const free = order.filter((i) => !locked[i] && orientations(sol[i]) > 1)
  if (def.scramble == null) {
    // A uniform random quarter turn is a uniform pick among the tile's distinct orientations.
    for (const i of free) start[i] = rotN(sol[i], rng.int(4))
  } else {
    for (let k = 0; k < Math.min(def.scramble, free.length); k++) {
      const i = free[k], o = orientations(sol[i])
      start[i] = rotN(sol[i], 1 + rng.int(o - 1))
    }
  }
  // Never hand over a board that is already solved (stored solution or any other one).
  for (let k = 0; flood(g, start).solved && k < free.length; k++) start[free[k]] = rotN(start[free[k]], 1)

  let lamps = 0
  for (let i = 0; i < n; i++) if (i !== g.source && popcount(sol[i]) === 1) lamps++
  return { w, h, wrap, seed: def.seed >>> 0, source: g.source, sol, start, locked, par: parBetween(start, sol), lamps }
}

const hex = (arr) => Array.from(arr, (v) => v.toString(16)).join('')
/** A short fingerprint of a generated level, used by the snapshot tests. */
export function levelHash(level) {
  return hashString(`${level.w}x${level.h}|${level.wrap ? 1 : 0}|${level.source}|${hex(level.sol)}|${hex(level.start)}|${hex(level.locked)}`).toString(16).padStart(8, '0')
}

/** Steps from the source in the solved board, used to give hints near the lit part first. */
export function solutionDepth(level) { return flood(level, level.sol).depth }

export { DIRS }
