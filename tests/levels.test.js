import test from 'node:test'
import assert from 'node:assert/strict'
import { CHAPTERS, LEVEL_COUNT, PER_CHAPTER, journeyDef, journeyLevel, levelLabel, isUnlocked } from '../src/logic/levels.js'
import { levelHash } from '../src/logic/generate.js'
import { flood } from '../src/logic/grid.js'

// Fingerprints of all 60 shipped Journey levels, in order.
// Every player gets these exact boards, and their stars and in-progress boards are tied to them. If the snapshot test
// fails you changed the generator, the rng, or a shipped row in levels.js. Do NOT just paste in new hashes to make
// it pass, unless you really mean to replace everyone's levels (see AGENTS.md, "Level format and seeds").
const JOURNEY_SNAPSHOT = [
  '8bec8fc5 7cf48ed6 1539555d 125d5900 34915c87 643a7ce6 d0d37138 088988d0 f9c9d178 1c1d5dfa',
  '7d0886f4 4176fc15 5ccc373f 54c50cc8 d470f19f 82f17c42 6b64bbdc db8f1010 7d48c3f8 c98ec2ec',
  '7cb3f5ab 676e1c21 17d3ef55 20a7e01b 5af0d77e ac5b7e3e c492e815 368a71df 8f3d3931 43c4a330',
  '1b9c622f caad128f 71c23061 45327c69 868a107e d351107b 354cd2e0 68555cf3 48f1ff06 5d4179eb',
  '1ac51a1a b0d1d11c b00f99c9 d42b9912 d344193d 9f4ad826 b758ebd8 b59fcc2a 8c54d69c ed65bba4',
  '3752a5b7 340bd425 dbb81fda e837b933 237038ab 7d54a20d c1b4aabd 756efaaf 03e507d1 bf3d23f5',
]

test('journey: 60 levels, 6 chapters of 10, all valid and phone sized', () => {
  assert.equal(CHAPTERS.length, 6); assert.equal(LEVEL_COUNT, 60)
  for (const c of CHAPTERS) assert.equal(c.levels.length, PER_CHAPTER)
  const seeds = new Set()
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const def = journeyDef(i), l = journeyLevel(i)
    assert.ok(def.w <= 9, 'never wider than 9'); assert.ok(def.h >= def.w)
    assert.ok(flood(l, l.sol).solved); assert.ok(!flood(l, l.start).solved); assert.ok(l.par > 0)
    seeds.add(def.seed)
  }
  assert.equal(seeds.size, LEVEL_COUNT)
  assert.equal(levelLabel(0), '1-1'); assert.equal(levelLabel(59), '6-10'); assert.equal(levelLabel(23), '3-4')
})

test('the first three levels are tiny and nearly solved', () => {
  for (let i = 0; i < 3; i++) { const l = journeyLevel(i); assert.ok(l.w * l.h <= 16); assert.ok(l.par <= 12); assert.ok(journeyDef(i).tip) }
})

test('levels unlock one at a time', () => {
  assert.ok(isUnlocked([], 0)); assert.ok(!isUnlocked([], 1)); assert.ok(isUnlocked([2], 1)); assert.ok(!isUnlocked([2, 0], 2))
})

test('journey snapshot: shipped levels never change', () => {
  for (let c = 0; c < JOURNEY_SNAPSHOT.length; c++) {
    const got = Array.from({ length: PER_CHAPTER }, (_, n) => levelHash(journeyLevel(c * PER_CHAPTER + n))).join(' ')
    assert.equal(got, JOURNEY_SNAPSHOT[c], `chapter ${c + 1} changed`)
  }
})
