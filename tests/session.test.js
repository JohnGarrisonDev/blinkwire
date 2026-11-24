import test from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/logic/generate.js'
import { createSession, rotate, undo, togglePin, restart, hint, tapsLeft, lampCount, snapshot, canRotate } from '../src/logic/session.js'
import { starsFor, starThresholds, starString } from '../src/logic/stars.js'
import { tapsBetween, orientations } from '../src/logic/grid.js'

const level = () => generate({ seed: 77, w: 6, h: 6, lock: 0.12 })
const solve = (s) => { for (let i = 0; i < s.cur.length; i++) for (let k = tapsBetween(s.cur[i], s.level.sol[i]); k > 0; k--) assert.ok(rotate(s, i, 1)) }

test('solving with the stored solution takes exactly par moves', () => {
  const s = createSession(level())
  assert.equal(tapsLeft(s), s.level.par)
  solve(s)
  assert.ok(s.solved); assert.equal(s.moves, s.level.par)
  assert.deepEqual(lampCount(s), { lit: s.level.lamps, total: s.level.lamps })
  assert.equal(rotate(s, 0, 1), false, 'no turning after the solve')
})

test('bolted and pinned tiles do not turn; undo refunds the move', () => {
  const s = createSession(level())
  const bolted = s.level.locked.indexOf(1), free = [...s.level.locked].findIndex((l, i) => !l && orientations(s.cur[i]) > 1)
  assert.equal(rotate(s, bolted, 1), false); assert.equal(togglePin(s, bolted), null)
  const before = s.cur[free]
  assert.ok(rotate(s, free, 1)); assert.ok(rotate(s, free, -1)); assert.equal(s.cur[free], before); assert.equal(s.moves, 2)
  assert.ok(rotate(s, free, 1)); assert.equal(s.moves, 3)
  assert.deepEqual(undo(s), { i: free, dir: -1 }); assert.equal(s.cur[free], before); assert.equal(s.moves, 2)
  assert.equal(togglePin(s, free), true); assert.equal(canRotate(s, free), false); assert.equal(rotate(s, free, 1), false)
  assert.equal(togglePin(s, free), false); assert.ok(rotate(s, free, 1))
  restart(s)
  assert.deepEqual([...s.cur], [...s.level.start]); assert.equal(s.moves, 0); assert.equal(undo(s), null)
})

test('hint points at a wrong tile and marks the session', () => {
  const s = createSession(level())
  const i = hint(s)
  assert.ok(i >= 0 && s.cur[i] !== s.level.sol[i]); assert.ok(s.hinted)
  solve(s); assert.equal(hint(s), -1)
})

test('snapshot round-trips, and junk is ignored', () => {
  const lvl = level(), s = createSession(lvl)
  const free = [...lvl.locked].findIndex((l, i) => !l && orientations(s.cur[i]) > 1)
  rotate(s, free, 1); togglePin(s, free); s.time = 12.34; hint(s)
  const snap = JSON.parse(JSON.stringify(snapshot(s)))
  const r = createSession(lvl, snap)
  assert.deepEqual([...r.cur], [...s.cur]); assert.deepEqual([...r.pinned], [...s.pinned])
  assert.equal(r.moves, 1); assert.equal(r.time, 12.3); assert.ok(r.hinted); assert.deepEqual(r.undo, s.undo)
  togglePin(r, free); assert.ok(undo(r)); assert.deepEqual([...r.cur], [...lvl.start])
  for (const bad of [null, 5, {}, { cur: 'zz' }, { cur: 'f'.repeat(36) }, { cur: snap.cur.slice(1) }, { cur: snap.cur, moves: 'x', undo: 'no', pins: 7 }]) {
    const b = createSession(lvl, bad)
    assert.equal(b.cur.length, 36); assert.ok(Number.isFinite(b.moves))
  }
  // a snapshot from a different level does not fit
  const other = createSession(generate({ seed: 78, w: 6, h: 6 }), snap)
  assert.equal(other.moves, 0)
})

test('star rules', () => {
  assert.deepEqual(starThresholds(40), { three: 44, two: 60 })
  assert.deepEqual(starThresholds(2), { three: 3, two: 6 })
  assert.equal(starsFor(40, 40), 3); assert.equal(starsFor(36, 40), 3); assert.equal(starsFor(44, 40), 3)
  assert.equal(starsFor(45, 40), 2); assert.equal(starsFor(60, 40), 2); assert.equal(starsFor(61, 40), 1)
  assert.equal(starsFor(40, 40, true), 2); assert.equal(starsFor(99, 40, true), 1)
  assert.equal(starString(2), '★★☆')
})
