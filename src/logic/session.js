// One board in play: current rotations, pins, moves, undo, hints. Pure, no DOM, no clock.
import { rotN, orientations, flood, tapsBetween, popcount } from './grid.js'
import { solutionDepth } from './generate.js'

const UNDO_CAP = 600

/** Start (or, given `saved` from snapshot(), resume) a session on a generated level. */
export function createSession(level, saved = null) {
  const n = level.w * level.h
  const s = {
    level, cur: Uint8Array.from(level.start), pinned: new Uint8Array(n),
    moves: 0, time: 0, hinted: false, undo: [], solved: false, flood: null,
  }
  if (saved) restore(s, saved)
  refresh(s)
  return s
}

function refresh(s) { s.flood = flood(s.level, s.cur); s.solved = s.flood.solved }

/** Can the player turn tile i right now? */
export function canRotate(s, i) {
  return !s.solved && i >= 0 && i < s.cur.length && !s.level.locked[i] && !s.pinned[i] && orientations(s.cur[i]) > 1
}

/** Turn tile i a quarter turn (dir 1 = clockwise, -1 = counter-clockwise). Returns true if it turned. */
export function rotate(s, i, dir = 1) {
  if (!canRotate(s, i)) return false
  s.cur[i] = rotN(s.cur[i], dir)
  s.moves++
  s.undo.push(dir > 0 ? i + 1 : -(i + 1))
  if (s.undo.length > UNDO_CAP) s.undo.shift()
  refresh(s)
  return true
}

/** Take back the last turn (the move is refunded). Returns { i, dir } of the turn that was applied, or null. */
export function undo(s) {
  if (s.solved || !s.undo.length) return null
  const u = s.undo.pop(), i = Math.abs(u) - 1, dir = u > 0 ? -1 : 1
  s.cur[i] = rotN(s.cur[i], dir)
  s.moves = Math.max(0, s.moves - 1)
  refresh(s)
  return { i, dir }
}

/** Pin or unpin tile i. Bolted tiles cannot be pinned. Returns the new pinned state, or null if nothing changed. */
export function togglePin(s, i) {
  if (s.solved || i < 0 || i >= s.cur.length || s.level.locked[i]) return null
  s.pinned[i] = s.pinned[i] ? 0 : 1
  return !!s.pinned[i]
}

/** Back to the starting scramble. Time keeps running; a used hint stays used. */
export function restart(s) {
  s.cur.set(s.level.start); s.pinned.fill(0); s.moves = 0; s.undo.length = 0
  refresh(s)
}

/**
 * Pick one tile that is not in its solved orientation, nearest the source first. Marks the session as hinted.
 * Returns the tile index, or -1 if every tile already matches.
 */
export function hint(s) {
  if (s.solved) return -1
  const depth = solutionDepth(s.level)
  let best = -1
  for (let i = 0; i < s.cur.length; i++) {
    if (s.cur[i] === s.level.sol[i]) continue
    if (best < 0 || depth[i] < depth[best]) best = i
  }
  if (best >= 0) s.hinted = true
  return best
}

/** Fewest clockwise taps still needed to reach the stored solution. */
export function tapsLeft(s) {
  let t = 0
  for (let i = 0; i < s.cur.length; i++) t += tapsBetween(s.cur[i], s.level.sol[i])
  return t
}

/** How many lamps are lit, out of how many. */
export function lampCount(s) {
  let lit = 0
  for (let i = 0; i < s.cur.length; i++) if (i !== s.level.source && popcount(s.cur[i]) === 1 && s.flood.powered[i]) lit++
  return { lit, total: s.level.lamps }
}

const HEX = '0123456789abcdef'
/** Plain-JSON snapshot of a session for localStorage. */
export function snapshot(s) {
  let cur = '', pins = ''
  for (let i = 0; i < s.cur.length; i++) { cur += HEX[s.cur[i]]; pins += s.pinned[i] ? '1' : '0' }
  return { cur, pins, moves: s.moves, time: Math.round(s.time * 10) / 10, hinted: s.hinted, undo: s.undo.slice(-UNDO_CAP) }
}

/** Apply a snapshot if (and only if) it fits this level. Bad data is ignored, never thrown. */
function restore(s, saved) {
  try {
    const n = s.cur.length
    if (!saved || typeof saved.cur !== 'string' || saved.cur.length !== n) return false
    const cur = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const m = HEX.indexOf(saved.cur[i])
      if (m < 0 || tapsBetween(m, s.level.sol[i]) < 0) return false // not a rotation of this level's tile
      if (s.level.locked[i] && m !== s.level.sol[i]) return false
      cur[i] = m
    }
    s.cur.set(cur)
    if (typeof saved.pins === 'string' && saved.pins.length === n) for (let i = 0; i < n; i++) s.pinned[i] = saved.pins[i] === '1' && !s.level.locked[i] ? 1 : 0
    s.moves = Number.isFinite(saved.moves) && saved.moves >= 0 ? Math.floor(saved.moves) : 0
    s.time = Number.isFinite(saved.time) && saved.time >= 0 ? saved.time : 0
    s.hinted = !!saved.hinted
    s.undo = Array.isArray(saved.undo) ? saved.undo.filter((u) => Number.isInteger(u) && u !== 0 && Math.abs(u) <= n).slice(-UNDO_CAP) : []
    return true
  } catch { return false }
}
