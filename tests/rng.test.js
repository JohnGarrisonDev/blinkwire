import test from 'node:test'
import assert from 'node:assert/strict'
import { makeRng, hashString } from '../src/logic/rng.js'

test('rng is seeded and stable', () => {
  const r = makeRng(42)
  assert.deepEqual([r(), r(), r()].map((v) => Math.floor(v * 1e6)), [601103, 448290, 852465])
  assert.equal(hashString('blinkwire'), 451003212)
})

test('the logic rng matches the kit rng', async () => {
  // kit.js expects a browser; give it just enough to import.
  globalThis.window ??= { addEventListener() {} }
  const kit = await import('../kit/kit.js')
  for (const seed of [0, 1, 123456789, 4294967295]) {
    const a = makeRng(seed), b = kit.makeRng(seed)
    for (let k = 0; k < 50; k++) assert.equal(a(), b())
    assert.equal(a.int(1000), b.int(1000))
  }
  for (const s of ['', 'a', 'blinkwire/journey/1']) assert.equal(hashString(s), kit.hashString(s))
})
