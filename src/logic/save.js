// Save schema for localStorage key "oddvale:blinkwire". Pure: sanitize() turns anything into a well-formed save.
//
// {
//   v: 1,
//   settings: { timer: bool, ccw: bool },
//   journey:  { stars: [0..3 per level], best: [{ moves, time } | null per level] },
//   daily:    { history: { 'YYYY-MM-DD': { moves, par, time, stars, w, h, wrap } }, bestStreak },
//   free:     { w, h, wrap, lock, solved },
//   progress: { journey: { level, board } | null, daily: { date, board, done } | null, free: { def, board } | null },
//   last:     'journey' | 'daily' | 'free' | null     (mode that was on screen, so a reload drops you back in)
// }
// `board` is a session snapshot (see session.js). It is validated against the regenerated level when loaded.
import { isDateKey } from './daily.js'

export const SAVE_VERSION = 1
export const FREE_MIN = 4, FREE_MAX = 12
const HISTORY_CAP = 400

export const defaults = () => ({
  v: SAVE_VERSION,
  settings: { timer: true, ccw: false },
  journey: { stars: [], best: [] },
  daily: { history: {}, bestStreak: 0 },
  free: { w: 6, h: 6, wrap: false, lock: false, solved: 0 },
  progress: { journey: null, daily: null, free: null },
  last: null,
})

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)
const num = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? v : d)

/** Return a clean save built from whatever was in storage. Never throws. */
export function sanitize(raw) {
  const out = defaults()
  try {
    const r = obj(raw)
    const st = obj(r.settings)
    if (typeof st.timer === 'boolean') out.settings.timer = st.timer
    if (typeof st.ccw === 'boolean') out.settings.ccw = st.ccw

    const j = obj(r.journey)
    if (Array.isArray(j.stars)) out.journey.stars = j.stars.slice(0, 600).map((s) => int(s, 0, 3, 0))
    if (Array.isArray(j.best)) out.journey.best = j.best.slice(0, 600).map((b) => (b && Number.isFinite(b.moves) ? { moves: int(b.moves, 0, 1e6, 0), time: num(b.time) } : null))

    const d = obj(r.daily), hist = obj(d.history)
    const keys = Object.keys(hist).filter((k) => isDateKey(k) && hist[k] && Number.isFinite(hist[k].moves)).sort().slice(-HISTORY_CAP)
    for (const k of keys) {
      const e = hist[k]
      out.daily.history[k] = { moves: int(e.moves, 0, 1e6, 0), par: int(e.par, 0, 1e6, 0), time: num(e.time), stars: int(e.stars, 1, 3, 1), w: int(e.w, 2, 99, 0), h: int(e.h, 2, 99, 0), wrap: !!e.wrap }
    }
    out.daily.bestStreak = int(d.bestStreak, 0, 1e6, 0)

    const f = obj(r.free)
    out.free = { w: int(f.w, FREE_MIN, FREE_MAX, 6), h: int(f.h, FREE_MIN, FREE_MAX, 6), wrap: !!f.wrap, lock: !!f.lock, solved: int(f.solved, 0, 1e9, 0) }

    const p = obj(r.progress)
    const pj = obj(p.journey)
    if (Number.isInteger(pj.level) && pj.level >= 0 && pj.board) out.progress.journey = { level: pj.level, board: pj.board }
    const pd = obj(p.daily)
    if (isDateKey(pd.date) && pd.board) out.progress.daily = { date: pd.date, board: pd.board, done: !!pd.done }
    const pf = obj(p.free), def = obj(pf.def)
    if (pf.board && Number.isFinite(def.seed)) {
      out.progress.free = { def: { seed: def.seed >>> 0, w: int(def.w, FREE_MIN, FREE_MAX, 6), h: int(def.h, FREE_MIN, FREE_MAX, 6), wrap: !!def.wrap, lock: num(def.lock) > 0 ? Math.min(0.3, def.lock) : 0 }, board: pf.board }
    }
    if (r.last === 'journey' || r.last === 'daily' || r.last === 'free') out.last = r.last
  } catch { return defaults() }
  return out
}

/** Record a solved journey level. Returns { stars, newBest } where stars is the best ever. */
export function recordJourney(save, i, moves, time, stars) {
  const j = save.journey
  while (j.stars.length <= i) j.stars.push(0)
  while (j.best.length <= i) j.best.push(null)
  const prev = j.best[i]
  const newBest = !prev || moves < prev.moves || (moves === prev.moves && time < prev.time)
  if (newBest) j.best[i] = { moves, time }
  j.stars[i] = Math.max(j.stars[i], stars)
  return { stars: j.stars[i], newBest, prev }
}

export const totalStars = (save) => save.journey.stars.reduce((a, b) => a + (b | 0), 0)
export const solvedCount = (save) => save.journey.stars.filter((s) => s > 0).length
