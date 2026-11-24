// Seeded random numbers for the pure logic modules.
// This is a byte-for-byte copy of makeRng / hashString from kit/kit.js. The kit touches `window` when imported,
// so the logic (which also runs under `node --test`) keeps its own copy. tests/rng.test.js checks the two agree.
// NEVER change this: every Journey level and every Daily puzzle is derived from it.

/** mulberry32. rng() -> [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0
  const rng = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  rng.int = (n) => Math.floor(rng() * n)
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)]
  rng.range = (lo, hi) => lo + rng() * (hi - lo)
  return rng
}

/** FNV-1a, 32 bit. */
export const hashString = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
