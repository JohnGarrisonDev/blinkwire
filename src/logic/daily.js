// Daily puzzle: one board per local calendar day, the same for everyone. Pure.
import { makeRng, hashString } from './rng.js'
import { generate } from './generate.js'
import { starString } from './stars.js'

const pad = (n) => String(n).padStart(2, '0')
/** Local calendar date as YYYY-MM-DD. */
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Shift a YYYY-MM-DD key by whole days. */
export function shiftDay(key, days) {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + days, 12))
}
export const isDateKey = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

const PLAIN = [[6, 6], [6, 7], [7, 7], [7, 7], [7, 8], [8, 8], [8, 8], [8, 9]]
const WRAPPED = [[5, 5], [5, 6], [6, 6]]

/** The level definition for a date key. Same date, same puzzle, for everyone. */
export function dailyDef(key) {
  const rng = makeRng(hashString(`blinkwire/daily/${key}`))
  const wrap = rng() < 0.22
  const [w, h] = rng.pick(wrap ? WRAPPED : PLAIN)
  const lock = wrap ? rng.pick([0.1, 0.14]) : rng.pick([0, 0, 0.06, 0.1])
  return { date: key, w, h, wrap, lock, scramble: null, seed: hashString(`blinkwire/daily-board/${key}`) }
}
export const dailyLevel = (key) => generate(dailyDef(key))

/**
 * history: { 'YYYY-MM-DD': { moves, ... } } of solved days.
 * current = run of solved days ending today (or yesterday, if today is not solved yet); best = longest run ever.
 */
export function streakInfo(history, today) {
  const has = (k) => !!(history && history[k])
  let current = 0
  for (let k = has(today) ? today : shiftDay(today, -1); has(k); k = shiftDay(k, -1)) current++
  let best = 0
  for (const k of Object.keys(history || {})) {
    if (!isDateKey(k) || has(shiftDay(k, -1))) continue // only count from the first day of a run
    let run = 0
    for (let j = k; has(j); j = shiftDay(j, 1)) run++
    if (run > best) best = run
  }
  return { current, best: Math.max(best, current) }
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec))
  const m = Math.floor(sec / 60), s = sec % 60
  return m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Spoiler-free result text for the clipboard. */
export function shareText(key, r) {
  const size = `${r.w}x${r.h}${r.wrap ? ' wrap' : ''}`
  return `Blinkwire daily ${key} · ${size} · ${r.moves} moves (par ${r.par}) · ${formatTime(r.time)} · ${starString(r.stars)}\ngames.oddvale.com/blinkwire`
}
