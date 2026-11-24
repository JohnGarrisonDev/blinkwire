// Star rules. Pure.
// Par is the fewest clockwise taps that solve the board. A counter-clockwise turn also costs one move,
// so careful players can finish under par.

/** Most moves that still earn three / two stars. */
export function starThresholds(par) {
  return { three: par + Math.max(1, Math.floor(par * 0.1)), two: par + Math.max(4, Math.ceil(par * 0.5)) }
}

/** 3 = at or near par, 2 = within half again, 1 = solved. A hint caps the level at 2 stars. */
export function starsFor(moves, par, hinted = false) {
  const t = starThresholds(par)
  const s = moves <= t.three ? 3 : moves <= t.two ? 2 : 1
  return hinted ? Math.min(s, 2) : s
}

export const starString = (n) => '★'.repeat(n) + '☆'.repeat(3 - n)
