// Find the solution of a board that is closest to what the player has now. Pure, no DOM.
// A few boards (mostly wrap boards) have more than one solution. The win check (`flood`) already accepts any of them;
// this lets the hint accept them too, so it never fights a player who is heading for a correct alternative.
import { neighbor, opposite, rotN, flood } from './grid.js'

/** Distinct orientations of each tile (a bolted tile has only its solved one). */
function options(level) {
  const n = level.w * level.h, opts = new Array(n)
  for (let i = 0; i < n; i++) {
    if (level.locked[i]) { opts[i] = [level.sol[i]]; continue }
    const list = []
    for (let k = 0; k < 4; k++) { const m = rotN(level.sol[i], k); if (!list.includes(m)) list.push(m) }
    opts[i] = list
  }
  return opts
}

/**
 * The solution nearest to `cur` (fewest tiles in a different orientation; a pinned tile that would have to move counts
 * double, so the player's pins are respected when they can be). Ties and searches that run out of budget keep the
 * stored solution, so on a board with one answer this always returns `level.sol`.
 * Returns { sol: Uint8Array, cost, complete } where `complete` is false if the node budget ran out.
 */
export function nearestSolution(level, cur, pinned = null, budget = 12000) {
  const n = level.w * level.h, opts = options(level)
  const tileCost = (i, m) => (m === cur[i] ? 0 : pinned && pinned[i] ? 2 : 1)
  let best = level.sol, bestCost = 0
  for (let i = 0; i < n; i++) bestCost += tileCost(i, level.sol[i])
  if (bestCost === 0) return { sol: Uint8Array.from(best), cost: 0, complete: true }

  // neighbours once: nb[i * 4 + d] = tile index or -1 (off the board)
  const nb = new Int32Array(n * 4)
  for (let i = 0; i < n; i++) for (let d = 0; d < 4; d++) nb[i * 4 + d] = neighbor(level, i, d)

  // domain: bit k set = option k of tile i is still possible
  const full = new Uint8Array(n)
  for (let i = 0; i < n; i++) full[i] = (1 << opts[i].length) - 1

  // which arm values (bit 0 = no arm, bit 1 = arm) tile i can still show in direction d
  const armSet = (dom, i, d) => {
    let s = 0
    const o = opts[i]
    for (let k = 0; k < o.length; k++) if (dom[i] & (1 << k)) s |= (o[k] >> d) & 1 ? 2 : 1
    return s
  }
  const queue = new Int32Array(n * 8)
  /** Arc consistency. Returns false on a wipe-out. */
  function propagate(dom, start) {
    let head = 0, tail = 0
    for (const i of start) queue[tail++] = i
    const inQ = new Uint8Array(n)
    for (const i of start) inQ[i] = 1
    while (head < tail) {
      const i = queue[head++ % queue.length]; inQ[i] = 0
      for (let d = 0; d < 4; d++) {
        const j = nb[i * 4 + d]
        const allowed = j < 0 ? 1 : armSet(dom, j, opposite(d)) // off the board: no arm allowed
        const o = opts[i]
        let nd = dom[i]
        for (let k = 0; k < o.length; k++) if (nd & (1 << k) && !(allowed & ((o[k] >> d) & 1 ? 2 : 1))) nd &= ~(1 << k)
        if (nd === 0) return false
        if (nd !== dom[i]) {
          dom[i] = nd
          for (let e = 0; e < 4; e++) { const t = nb[i * 4 + e]; if (t >= 0 && !inQ[t]) { inQ[t] = 1; queue[tail++ % queue.length] = t } }
        }
      }
    }
    return true
  }

  const minCost = (dom, i) => { let c = 3; const o = opts[i]; for (let k = 0; k < o.length; k++) if (dom[i] & (1 << k)) c = Math.min(c, tileCost(i, o[k])); return c }
  let nodes = 0, complete = true
  const all = Array.from({ length: n }, (_, i) => i)

  function dfs(dom) {
    if (++nodes > budget) { complete = false; return }
    let lb = 0, pick = -1, pickSize = 9
    for (let i = 0; i < n; i++) {
      lb += minCost(dom, i)
      const size = popBits(dom[i])
      if (size > 1 && size < pickSize) { pick = i; pickSize = size }
    }
    if (lb >= bestCost) return
    if (pick < 0) { // every tile fixed: matched arms everywhere, so it is solved exactly when it is all one piece
      const masks = new Uint8Array(n)
      for (let i = 0; i < n; i++) masks[i] = opts[i][31 - Math.clz32(dom[i])]
      if (flood(level, masks).solved) { best = masks; bestCost = lb }
      return
    }
    const o = opts[pick], ks = []
    for (let k = 0; k < o.length; k++) if (dom[pick] & (1 << k)) ks.push(k)
    ks.sort((a, b) => tileCost(pick, o[a]) - tileCost(pick, o[b]))
    for (const k of ks) {
      const next = Uint8Array.from(dom); next[pick] = 1 << k
      if (propagate(next, [pick])) dfs(next)
      if (!complete) return
    }
  }
  const dom = Uint8Array.from(full)
  if (propagate(dom, all)) dfs(dom)
  return { sol: Uint8Array.from(best), cost: bestCost, complete }
}

const popBits = (v) => { let c = 0; while (v) { v &= v - 1; c++ } return c }

/** Count solutions up to `cap` (tests and tools only). `onFound(masks)` sees each one. */
export function countSolutions(level, cap = 2, budget = 200000, onFound = null) {
  const n = level.w * level.h, opts = options(level)
  let found = 0, nodes = 0
  const fixed = new Uint8Array(n)
  function rec(i) {
    if (found >= cap || ++nodes > budget) return
    if (i === n) { if (flood(level, fixed).solved) { found++; onFound?.(Uint8Array.from(fixed)) } return }
    for (const m of opts[i]) {
      fixed[i] = m
      let ok = true
      // check arms toward already-placed neighbours (west and north, plus wrap partners already placed)
      for (let d = 0; d < 4 && ok; d++) {
        const j = neighbor(level, i, d), arm = (m >> d) & 1
        if (j < 0) { if (arm) ok = false; continue }
        if (j < i || (j === i)) { if (((fixed[j] >> opposite(d)) & 1) !== arm) ok = false }
      }
      if (ok) rec(i + 1)
    }
  }
  rec(0)
  return found
}
