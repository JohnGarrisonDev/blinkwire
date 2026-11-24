// Visual state that sits on top of a session: spin animations, the power wave, wobbles, hint flashes.
// No DOM here; everything takes `now` (ms) so it can be driven by the frame loop.
import { popcount } from './logic/grid.js'

export const SPIN_MS = 160
const WAVE_STEP = 55, WAVE_MAX = 650, WAVE_LEAD = 90

export class BoardView {
  constructor(session, now = 0) {
    const n = session.cur.length
    this.session = session
    this.level = session.level
    this.angFrom = new Float32Array(n)
    this.angStart = new Float64Array(n).fill(-1e9)
    this.litAt = new Float64Array(n).fill(Infinity)
    this.nopeAt = new Float64Array(n).fill(-1e9)
    this.pinAt = new Float64Array(n).fill(-1e9)
    this.isLamp = new Uint8Array(n)
    for (let i = 0; i < n; i++) this.isLamp[i] = i !== this.level.source && popcount(this.level.sol[i]) === 1 ? 1 : 0
    this.wakeQueue = []      // lamps about to open their eye: { t, i }
    this.waveEnd = now
    this.hintIdx = -1; this.hintAt = -1e9
    this.celebrateAt = Infinity
    this.spinning = 0        // number of tiles possibly mid-spin (cheap hint for the renderer)
    this.syncPower(now, true)
  }

  /** Call after the session's power changed. New tiles light up in a wave ordered by distance from the source. */
  syncPower(now, instant = false) {
    const f = this.session.flood, n = this.litAt.length
    let lo = Infinity, hi = 0
    for (let i = 0; i < n; i++) if (f.powered[i] && this.litAt[i] === Infinity) { if (f.depth[i] < lo) lo = f.depth[i]; if (f.depth[i] > hi) hi = f.depth[i] }
    const step = hi > lo ? Math.min(WAVE_STEP, WAVE_MAX / (hi - lo)) : 0
    for (let i = 0; i < n; i++) {
      if (!f.powered[i]) { this.litAt[i] = Infinity; continue }
      if (this.litAt[i] !== Infinity) continue
      if (instant) { this.litAt[i] = -1e9; continue }
      const t = now + WAVE_LEAD + (f.depth[i] - lo) * step
      this.litAt[i] = t
      if (this.isLamp[i]) this.wakeQueue.push({ t, i })
      if (t > this.waveEnd) this.waveEnd = t
    }
    if (this.wakeQueue.length > 1) this.wakeQueue.sort((a, b) => a.t - b.t)
  }

  /** Lamps whose wake-up moment has arrived (and that are still lit). Removes them from the queue. */
  takeWoken(now, out) {
    out.length = 0
    while (this.wakeQueue.length && this.wakeQueue[0].t <= now) {
      const q = this.wakeQueue.shift()
      if (this.litAt[q.i] === q.t) out.push(q.i)
    }
    return out
  }

  /** Start the spin animation for a turn that the session has already applied. */
  spin(i, dir, now) {
    this.angFrom[i] = this.angle(i, now) - dir * Math.PI / 2
    this.angStart[i] = now
  }

  /** Current visual rotation offset of tile i in radians (0 when at rest). */
  angle(i, now) {
    const p = (now - this.angStart[i]) / SPIN_MS
    if (p >= 1) return 0
    if (p <= 0) return this.angFrom[i]
    const q = p - 1, e = 1 + 2.4 * q * q * q + 1.4 * q * q // ease-out with a small overshoot
    return this.angFrom[i] * (1 - e)
  }

  isLit(i, now) { return this.litAt[i] <= now }
  litLamps(now) { let c = 0; for (let i = 0; i < this.litAt.length; i++) if (this.isLamp[i] && this.litAt[i] <= now) c++; return c }
  nope(i, now) { this.nopeAt[i] = now }
  flashHint(i, now) { this.hintIdx = i; this.hintAt = now }
}
