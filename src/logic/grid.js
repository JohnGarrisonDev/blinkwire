// Grid model: tiles are 4-bit connection masks. Pure, no DOM.
// A "grid" is any object with { w, h, wrap, source }. Tile i sits at x = i % w, y = floor(i / w).

/** Direction index: 0 = north, 1 = east, 2 = south, 3 = west. Bit for direction d is 1 << d. */
export const DIRS = [
  { bit: 1, dx: 0, dy: -1 },
  { bit: 2, dx: 1, dy: 0 },
  { bit: 4, dx: 0, dy: 1 },
  { bit: 8, dx: -1, dy: 0 },
]
export const opposite = (d) => (d + 2) & 3

/** Rotate a mask 90 degrees clockwise (north -> east). */
export const rotCW = (m) => ((m << 1) | (m >> 3)) & 15
export const rotCCW = (m) => ((m >> 1) | ((m & 1) << 3)) & 15
/** Rotate clockwise n times (n may be negative). */
export function rotN(m, n) { n = ((n % 4) + 4) % 4; for (let k = 0; k < n; k++) m = rotCW(m); return m }

export const popcount = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1)

/** 'empty' | 'lamp' | 'straight' | 'corner' | 'tee' | 'cross' */
export function tileKind(m) {
  const c = popcount(m)
  if (c === 0) return 'empty'
  if (c === 1) return 'lamp'
  if (c === 3) return 'tee'
  if (c === 4) return 'cross'
  return m === 5 || m === 10 ? 'straight' : 'corner'
}

/** How many different orientations a tile has: straight 2, cross and empty 1, the rest 4. */
export function orientations(m) {
  const k = tileKind(m)
  return k === 'straight' ? 2 : k === 'cross' || k === 'empty' ? 1 : 4
}

/** Fewest clockwise quarter turns that take `from` to `to` (0..3), or -1 if they are different shapes. */
export function tapsBetween(from, to) {
  let m = from
  for (let k = 0; k < 4; k++) { if (m === to) return k; m = rotCW(m) }
  return -1
}

/** Index of the neighbour of tile i in direction d, or -1 when it is off the board (no wrap). */
export function neighbor(g, i, d) {
  let x = (i % g.w) + DIRS[d].dx, y = ((i / g.w) | 0) + DIRS[d].dy
  if (g.wrap) { x = (x + g.w) % g.w; y = (y + g.h) % g.h }
  else if (x < 0 || y < 0 || x >= g.w || y >= g.h) return -1
  return y * g.w + x
}

/**
 * Flood power out from the source through matched connections.
 * Returns { powered, depth, parent, count, loose, solved, maxDepth }:
 *  - powered[i]  1 if tile i is connected to the source
 *  - depth[i]    steps from the source (-1 if unpowered)
 *  - parent[i]   direction index pointing back toward the source (-1 for the source / unpowered)
 *  - loose       number of wire ends that do not meet a matching wire end
 *  - solved      every tile powered and no loose ends
 */
export function flood(g, masks) {
  const n = g.w * g.h
  const powered = new Uint8Array(n), depth = new Int16Array(n).fill(-1), parent = new Int8Array(n).fill(-1)
  const queue = new Int32Array(n)
  let head = 0, tail = 0, count = 0, loose = 0, maxDepth = 0
  powered[g.source] = 1; depth[g.source] = 0; queue[tail++] = g.source
  while (head < tail) {
    const i = queue[head++]; count++
    if (depth[i] > maxDepth) maxDepth = depth[i]
    for (let d = 0; d < 4; d++) {
      if (!(masks[i] & (1 << d))) continue
      const j = neighbor(g, i, d)
      if (j < 0 || powered[j] || !(masks[j] & (1 << opposite(d)))) continue
      powered[j] = 1; depth[j] = depth[i] + 1; parent[j] = opposite(d); queue[tail++] = j
    }
  }
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < 4; d++) {
      if (!(masks[i] & (1 << d))) continue
      const j = neighbor(g, i, d)
      if (j < 0 || !(masks[j] & (1 << opposite(d)))) loose++
    }
  }
  return { powered, depth, parent, count, loose, maxDepth, solved: count === n && loose === 0 }
}

/** True when arm d of tile i does not meet a matching arm. */
export function isLooseEnd(g, masks, i, d) {
  const j = neighbor(g, i, d)
  return j < 0 || !(masks[j] & (1 << opposite(d)))
}

export const isSolved = (g, masks) => flood(g, masks).solved

/** Sum over tiles of the fewest clockwise taps from `from` to `to`. */
export function parBetween(from, to) {
  let p = 0
  for (let i = 0; i < from.length; i++) { const t = tapsBetween(from[i], to[i]); if (t < 0) return -1; p += t }
  return p
}
