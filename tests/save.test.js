import test from 'node:test'
import assert from 'node:assert/strict'
import { defaults, sanitize, recordJourney, totalStars, solvedCount } from '../src/logic/save.js'

test('sanitize survives anything', () => {
  for (const junk of [undefined, null, 7, 'x', [], { journey: 5, daily: 'no', progress: [1], settings: null, free: { w: 'big' } }]) assert.deepEqual(sanitize(junk), defaults())
})

test('sanitize keeps good data and clamps bad values', () => {
  const s = sanitize({
    settings: { timer: false, ccw: true, extra: 1 },
    journey: { stars: [3, 9, -2, 'x'], best: [{ moves: 5, time: 2.5 }, null, 'bad'] },
    daily: { history: { '2026-11-24': { moves: 41, par: 36, time: 133, stars: 2, w: 8, h: 8 }, nope: { moves: 1 }, '2026-11-23': null }, bestStreak: 4 },
    free: { w: 99, h: 1, wrap: 1, lock: 0, solved: 3 },
    progress: { journey: { level: 4, board: { cur: 'abc' } }, daily: { date: 'yesterday', board: {} }, free: { def: { seed: 5, w: 6, h: 7, wrap: true, lock: 0.1 }, board: { cur: 'x' } } },
    last: 'free',
  })
  assert.deepEqual(s.settings, { timer: false, ccw: true })
  assert.deepEqual(s.journey.stars, [3, 3, 0, 0]); assert.deepEqual(s.journey.best, [{ moves: 5, time: 2.5 }, null, null])
  assert.deepEqual(Object.keys(s.daily.history), ['2026-11-24']); assert.equal(s.daily.bestStreak, 4)
  assert.deepEqual(s.free, { w: 12, h: 4, wrap: true, lock: false, solved: 3 })
  assert.equal(s.progress.journey.level, 4); assert.equal(s.progress.daily, null); assert.equal(s.progress.free.def.w, 6)
  assert.equal(s.last, 'free')
  assert.deepEqual(sanitize(JSON.parse(JSON.stringify(s))), s, 'stable')
})

test('recording journey results keeps the best', () => {
  const s = defaults()
  assert.deepEqual(recordJourney(s, 2, 20, 30, 2), { stars: 2, newBest: true, prev: null })
  assert.equal(recordJourney(s, 2, 25, 10, 1).newBest, false); assert.equal(s.journey.stars[2], 2)
  assert.equal(recordJourney(s, 2, 18, 40, 3).newBest, true); assert.deepEqual(s.journey.best[2], { moves: 18, time: 40 })
  assert.equal(totalStars(s), 3); assert.equal(solvedCount(s), 1); assert.deepEqual(s.journey.stars, [0, 0, 3])
})
