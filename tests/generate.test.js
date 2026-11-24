import test from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/logic/generate.js'
import { flood, popcount, tapsBetween, orientations, rotN } from '../src/logic/grid.js'

const SIZES = [[2, 2], [3, 3], [4, 4], [4, 7], [6, 6], [9, 11], [12, 12], [12, 4]]

function checkLevel(def) {
  const l = generate(def), n = l.w * l.h, tag = JSON.stringify(def)
  // the stored solution is one connected spanning tree: all powered, no loose ends, exactly n - 1 links (so no loops)
  const f = flood(l, l.sol)
  assert.ok(f.solved, `solution not solved ${tag}`)
  let ends = 0
  for (const m of l.sol) { assert.ok(m > 0, `empty tile ${tag}`); ends += popcount(m) }
  assert.equal(ends / 2, n - 1, `not a tree ${tag}`)
  // the scramble is the same shapes turned, never already solved, and bolted tiles are in place
  assert.ok(!flood(l, l.start).solved, `pre-solved ${tag}`)
  let par = 0
  for (let i = 0; i < n; i++) {
    const t = tapsBetween(l.start[i], l.sol[i])
    assert.ok(t >= 0, `shape changed ${tag}`)
    if (l.locked[i]) assert.equal(t, 0, `bolted tile is wrong ${tag}`)
    par += t
  }
  assert.equal(l.par, par)
  assert.ok(l.par > 0)
  // applying the stored solution wins
  const cur = Uint8Array.from(l.start)
  for (let i = 0; i < n; i++) cur[i] = rotN(cur[i], tapsBetween(cur[i], l.sol[i]))
  assert.ok(flood(l, cur).solved)
  return l
}

test('generator: spanning tree, never pre-solved, solution wins (many seeds, sizes, wrap, bolts)', () => {
  let count = 0
  for (const [w, h] of SIZES) for (const wrap of [false, true]) for (const lock of [0, 0.15]) {
    if (wrap && (w < 3 || h < 3)) continue
    for (let s = 0; s < 40; s++) { checkLevel({ seed: s * 2654435761 + w * 31 + h, w, h, wrap, lock }); count++ }
  }
  assert.ok(count > 1000)
})

test('generator is deterministic', () => {
  const a = generate({ seed: 12345, w: 7, h: 8, wrap: true, lock: 0.1 }), b = generate({ seed: 12345, w: 7, h: 8, wrap: true, lock: 0.1 })
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.sol, generate({ seed: 12346, w: 7, h: 8, wrap: true, lock: 0.1 }).sol)
})

test('tutorial scramble turns only that many tiles', () => {
  for (let s = 0; s < 50; s++) {
    const l = checkLevel({ seed: s, w: 4, h: 4, scramble: 2 })
    let off = 0
    for (let i = 0; i < 16; i++) if (l.start[i] !== l.sol[i]) off++
    assert.ok(off >= 1 && off <= 2)
  }
})

test('bolt share is respected', () => {
  const l = generate({ seed: 9, w: 8, h: 8, lock: 0.125 })
  assert.equal(l.locked.reduce((a, b) => a + b, 0), 8)
})

test('scrambled tiles are in the solved orientation about as often as chance', () => {
  let same = 0, expected = 0
  for (let s = 0; s < 200; s++) {
    const l = generate({ seed: s * 7919 + 3, w: 8, h: 8 })
    for (let i = 0; i < 64; i++) { const o = orientations(l.sol[i]); if (o === 1) continue; expected += 1 / o; if (l.start[i] === l.sol[i]) same++ }
  }
  assert.ok(Math.abs(same - expected) / expected < 0.06, `${same} vs ${expected}`)
})

test('boards have a pleasant mix: lamps, runs and branches', () => {
  const kinds = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let n = 0
  for (let s = 0; s < 100; s++) for (const m of generate({ seed: s + 1000, w: 8, h: 8 }).sol) { kinds[popcount(m)]++; n++ }
  assert.ok(kinds[1] / n > 0.15 && kinds[1] / n < 0.35, 'lamps')
  assert.ok(kinds[2] / n > 0.4, 'runs')
  assert.ok(kinds[3] / n > 0.1, 'branches')
  assert.ok(kinds[4] / n < 0.03, 'crosses are rare')
})
