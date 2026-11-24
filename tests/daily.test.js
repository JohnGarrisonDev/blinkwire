import test from 'node:test'
import assert from 'node:assert/strict'
import { dateKey, shiftDay, dailyDef, dailyLevel, streakInfo, shareText, formatTime, isDateKey } from '../src/logic/daily.js'
import { levelHash } from '../src/logic/generate.js'
import { flood } from '../src/logic/grid.js'

// If the snapshot test fails, the generator, the rng or the daily recipe changed: today's puzzle would no longer
// be the same for a player on the old version and one on the new. See AGENTS.md before touching this.
const DAILY_SNAPSHOT = ['459fb17e', '0d9c5ab3', 'b65625e4']

test('date keys', () => {
  assert.equal(dateKey(new Date(2026, 10, 24, 23, 59)), '2026-11-24')
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05')
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28'); assert.equal(shiftDay('2026-12-31', 1), '2027-01-01'); assert.equal(shiftDay('2024-02-28', 1), '2024-02-29')
  assert.ok(isDateKey('2026-11-24')); assert.ok(!isDateKey('24/11/2026')); assert.ok(!isDateKey(null))
})

test('the same date always gives the same daily, different dates differ', () => {
  assert.deepEqual(dailyDef('2026-11-24'), dailyDef('2026-11-24'))
  assert.equal(levelHash(dailyLevel('2026-11-24')), levelHash(dailyLevel('2026-11-24')))
  const seen = new Set()
  for (let d = 0; d < 120; d++) {
    const key = shiftDay('2026-11-24', d), def = dailyDef(key), l = dailyLevel(key)
    assert.ok(def.w <= 8 && def.h <= 9 && def.w >= 5, 'phone friendly')
    assert.ok(flood(l, l.sol).solved && !flood(l, l.start).solved)
    seen.add(levelHash(l))
  }
  assert.equal(seen.size, 120)
})

test('daily snapshot: dated puzzles never change', () => {
  assert.deepEqual(['2026-11-24', '2026-11-25', '2027-01-01'].map((k) => levelHash(dailyLevel(k))), DAILY_SNAPSHOT)
})

test('streaks', () => {
  const h = { '2026-11-20': 1, '2026-11-21': 1, '2026-11-23': 1, '2026-11-24': 1, '2026-11-10': 1, '2026-11-11': 1, '2026-11-12': 1 }
  assert.deepEqual(streakInfo(h, '2026-11-24'), { current: 2, best: 3 })
  assert.deepEqual(streakInfo(h, '2026-11-25'), { current: 2, best: 3 }, 'yesterday still counts until today is over')
  assert.deepEqual(streakInfo(h, '2026-11-26'), { current: 0, best: 3 })
  assert.deepEqual(streakInfo({}, '2026-11-24'), { current: 0, best: 0 })
  assert.deepEqual(streakInfo(null, '2026-11-24'), { current: 0, best: 0 })
})

test('share text is short and spoiler-free', () => {
  assert.equal(shareText('2026-11-24', { w: 8, h: 8, wrap: false, moves: 41, par: 36, time: 133, stars: 2 }),
    'Blinkwire daily 2026-11-24 · 8x8 · 41 moves (par 36) · 2:13 · ★★☆\ngames.oddvale.com/blinkwire')
  assert.match(shareText('2026-11-24', { w: 5, h: 6, wrap: true, moves: 9, par: 9, time: 5, stars: 3 }), /5x6 wrap · 9 moves \(par 9\) · 0:05 · ★★★/)
  assert.equal(formatTime(3725), '1:02:05')
})
