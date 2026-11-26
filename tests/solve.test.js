// Boards with more than one answer: the win check and the hint accept any of them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { generate } from '../src/logic/generate.js'
import { journeyDef, LEVEL_COUNT } from '../src/logic/levels.js'
import { dailyDef, shiftDay } from '../src/logic/daily.js'
import { flood, tapsBetween } from '../src/logic/grid.js'
import { nearestSolution, countSolutions } from '../src/logic/solve.js'
import { createSession, rotate, hint } from '../src/logic/session.js'

/** A few levels that have a second answer, each with that answer. */
function multiBoards(max = 6) {
  const out = []
  const tryLevel = (lvl) => {
    if (out.length >= max) return
    let alt = null
    countSolutions(lvl, 2, 200000, (m) => { if (!alt && m.some((v, i) => v !== lvl.sol[i])) alt = m })
    if (alt) out.push({ lvl, alt })
  }
  for (let i = 0; i < LEVEL_COUNT; i++) tryLevel(generate(journeyDef(i)))
  for (let k = '2026-11-01', d = 0; d < 60; d++, k = shiftDay(k, 1)) tryLevel(generate(dailyDef(k)))
  return out
}
const boards = multiBoards()

test('some shipped boards really have a second answer (the case this covers)', () => {
  assert.ok(boards.length >= 3, `found ${boards.length}`)
})

test('the nearest solution is the stored one on a fresh board with one answer, and always valid', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 7) {
    const lvl = generate(journeyDef(i)), r = nearestSolution(lvl, lvl.start)
    assert.ok(flood(lvl, r.sol).solved, `level ${i}`)
    if (countSolutions(lvl, 2) === 1) assert.deepEqual([...r.sol], [...lvl.sol])
  }
})

test('a player heading for the other answer is solved by it, and hints never turn its tiles away', () => {
  for (const { lvl, alt } of boards) {
    // Turn every tile to the alternative answer except the last few that differ from the scramble.
    const s = createSession(lvl)
    const todo = []
    for (let i = 0; i < alt.length; i++) if (s.cur[i] !== alt[i]) todo.push(i)
    const left = todo.slice(-2)
    for (const i of todo.slice(0, -2)) for (let k = tapsBetween(s.cur[i], alt[i]); k > 0; k--) rotate(s, i, 1)
    // Follow hints from here: each points at one of the tiles still off the alternative, until solved.
    for (let guard = 0; !s.solved && guard < 20; guard++) {
      const i = hint(s)
      assert.ok(left.includes(i), `hint ${i} fights the alternative answer (left: ${left})`)
      rotate(s, i, 1)
    }
    assert.ok(s.solved)
    assert.ok(s.cur.some((v, i) => v !== lvl.sol[i]), 'solved with the alternative, not the stored answer')
  }
})

test('pins count: the hint prefers the answer that keeps the pinned tiles', () => {
  const { lvl, alt } = boards[0]
  const s = createSession(lvl)
  const diff = []
  for (let i = 0; i < alt.length; i++) if (alt[i] !== lvl.sol[i]) diff.push(i)
  for (const i of diff) { for (let k = tapsBetween(s.cur[i], alt[i]); k > 0; k--) rotate(s, i, 1); s.pinned[i] = 1 }
  const r = nearestSolution(lvl, s.cur, s.pinned)
  for (const i of diff) assert.equal(r.sol[i], alt[i])
})
