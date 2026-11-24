import test from 'node:test'
import assert from 'node:assert/strict'
import { rotCW, rotCCW, rotN, tileKind, orientations, tapsBetween, neighbor, flood, parBetween, isLooseEnd } from '../src/logic/grid.js'

const N = 1, E = 2, S = 4, W = 8

test('rotation turns north to east and back', () => {
  assert.equal(rotCW(N), E); assert.equal(rotCW(W), N); assert.equal(rotCCW(N), W)
  assert.equal(rotCW(N | E), E | S)
  for (let m = 0; m < 16; m++) { assert.equal(rotN(m, 4), m); assert.equal(rotCCW(rotCW(m)), m); assert.equal(rotN(m, -1), rotCCW(m)) }
})

test('tile kinds and how many orientations each has', () => {
  assert.equal(tileKind(N), 'lamp'); assert.equal(tileKind(N | S), 'straight'); assert.equal(tileKind(E | W), 'straight')
  assert.equal(tileKind(N | E), 'corner'); assert.equal(tileKind(N | E | S), 'tee'); assert.equal(tileKind(15), 'cross')
  assert.equal(orientations(N | S), 2); assert.equal(orientations(15), 1); assert.equal(orientations(N), 4)
  assert.equal(orientations(N | W), 4); assert.equal(orientations(N | E | W), 4)
})

test('par respects symmetry: a straight is at most one tap away, a cross none', () => {
  assert.equal(tapsBetween(N, N), 0); assert.equal(tapsBetween(N, W), 3); assert.equal(tapsBetween(W, N), 1)
  assert.equal(tapsBetween(N | S, E | W), 1); assert.equal(tapsBetween(E | W, N | S), 1)
  assert.equal(tapsBetween(15, 15), 0)
  assert.equal(tapsBetween(N | E, N | S), -1) // different shapes
  assert.equal(parBetween([N, N | S, 15, N | E], [W, E | W, 15, N | E]), 3 + 1 + 0 + 0)
  assert.equal(parBetween([N | E | S], [N | E | W]), 3)
})

test('neighbours stop at the edge, or wrap', () => {
  const g = { w: 3, h: 2, wrap: false }, gw = { w: 3, h: 2, wrap: true }
  assert.equal(neighbor(g, 0, 3), -1); assert.equal(neighbor(g, 0, 0), -1); assert.equal(neighbor(g, 0, 1), 1); assert.equal(neighbor(g, 0, 2), 3)
  assert.equal(neighbor(gw, 0, 3), 2); assert.equal(neighbor(gw, 0, 0), 3); assert.equal(neighbor(gw, 5, 1), 3); assert.equal(neighbor(gw, 5, 2), 2)
})

test('power floods through matched connections only', () => {
  // 3x1: source(E) - straight(EW) - lamp(W)
  const g = { w: 3, h: 1, wrap: false, source: 0 }
  let f = flood(g, [E, E | W, W])
  assert.deepEqual([...f.powered], [1, 1, 1]); assert.deepEqual([...f.depth], [0, 1, 2]); assert.equal(f.parent[2], 3); assert.equal(f.loose, 0); assert.ok(f.solved)
  // straight turned: nothing connects; the source's and the lamp's arms and both straight ends are loose
  f = flood(g, [E, N | S, W])
  assert.deepEqual([...f.powered], [1, 0, 0]); assert.equal(f.loose, 4); assert.ok(!f.solved)
  // a one-sided connection does not carry power
  f = flood(g, [E, W, W])
  assert.deepEqual([...f.powered], [1, 1, 0]); assert.ok(!f.solved)
})

test('a wire pointing off the board is a loose end, unless the board wraps', () => {
  const masks = [E | W, E | W, E | W]
  const flat = flood({ w: 3, h: 1, wrap: false, source: 0 }, masks)
  assert.equal(flat.count, 3); assert.equal(flat.loose, 2); assert.ok(!flat.solved)
  assert.ok(isLooseEnd({ w: 3, h: 1, wrap: false }, masks, 0, 3))
  // 3x3 wrap: a lamp on the left edge fed across the edge from the right-hand column
  const g = { w: 3, h: 3, wrap: true, source: 2 }
  const m = [W, 0, E, 0, 0, 0, 0, 0, 0]
  const f = flood(g, m)
  assert.equal(f.powered[0], 1); assert.equal(f.loose, 0); assert.equal(f.count, 2)
  assert.ok(!isLooseEnd(g, m, 0, 3))
  // and vertically: top row feeds the bottom row
  const v = flood({ w: 3, h: 3, wrap: true, source: 1 }, [0, N, 0, 0, 0, 0, 0, S, 0])
  assert.equal(v.powered[7], 1); assert.equal(v.loose, 0)
  assert.equal(flood({ w: 3, h: 3, wrap: false, source: 1 }, [0, N, 0, 0, 0, 0, 0, S, 0]).powered[7], 0)
})

test('everything lit but a loose end left over is not solved', () => {
  const g = { w: 2, h: 2, wrap: false, source: 0 }
  assert.ok(flood(g, [E, W | S, E, N | W]).solved)
  const f = flood(g, [E | N, W | S, E, N | W]) // same, plus one arm pointing off the top
  assert.equal(f.count, 4); assert.equal(f.loose, 1); assert.ok(!f.solved)
  const h = flood(g, [E, W | S, N, N | W]) // bottom-left lamp turned away: unlit, two loose ends
  assert.equal(h.count, 3); assert.equal(h.loose, 2); assert.ok(!h.solved)
})
