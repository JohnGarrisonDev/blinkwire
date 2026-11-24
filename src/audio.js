// Sound effects, all synthesised through the kit's sfx (shared Oddvale mute state).
import { sfx } from '../kit/kit.js'

// Major pentatonic steps: lamps climb this as more of them wake up.
const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28]
const note = (semi, base = 330) => base * 2 ** (semi / 12)

export const snd = {
  turn(dir = 1) {
    sfx.noise({ dur: 0.035, vol: 0.09, freq: 3200, slide: 900 })
    sfx.tone({ freq: dir > 0 ? 300 : 250, slide: dir > 0 ? 420 : 190, dur: 0.05, type: 'square', vol: 0.05 })
  },
  nope() { sfx.tone({ freq: 140, slide: 105, dur: 0.1, type: 'square', vol: 0.07 }); sfx.noise({ dur: 0.05, vol: 0.05, freq: 500 }) },
  /** frac: share of lamps lit, 0..1. */
  wake(frac) {
    const s = STEPS[Math.max(0, Math.min(STEPS.length - 1, Math.round(frac * (STEPS.length - 1))))]
    sfx.tone({ freq: note(s), dur: 0.2, type: 'triangle', vol: 0.17 })
    sfx.tone({ freq: note(s + 12), dur: 0.09, type: 'sine', vol: 0.06 })
  },
  dim() { sfx.tone({ freq: 240, slide: 150, dur: 0.14, type: 'sine', vol: 0.08 }) },
  pin(on) { sfx.tone({ freq: on ? 620 : 420, slide: on ? 760 : 330, dur: 0.07, type: 'triangle', vol: 0.12 }); if (on) sfx.noise({ dur: 0.03, vol: 0.07, freq: 1800 }) },
  undo() { sfx.tone({ freq: 420, slide: 280, dur: 0.08, type: 'triangle', vol: 0.11 }) },
  hint() { sfx.tune([[660, 0.07], [880, 0.07], [660, 0.09]], { type: 'sine', vol: 0.12 }) },
  click() { sfx.tone({ freq: 520, slide: 640, dur: 0.045, type: 'triangle', vol: 0.09 }) },
  back() { sfx.tone({ freq: 480, slide: 360, dur: 0.05, type: 'triangle', vol: 0.08 }) },
  solve() {
    sfx.tune([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.14], [0, 0.04], [988, 0.1], [1047, 0.28]], { type: 'triangle', vol: 0.17 })
    sfx.tune([[262, 0.2], [330, 0.2], [392, 0.14], [523, 0.36]], { type: 'sine', vol: 0.1 })
    sfx.noise({ dur: 0.5, vol: 0.05, freq: 6000, slide: 1500 })
  },
  star(n) { sfx.tone({ freq: note([7, 12, 16][n] ?? 16, 440), dur: 0.22, type: 'triangle', vol: 0.16 }); sfx.tone({ freq: note(([7, 12, 16][n] ?? 16) + 12, 440), dur: 0.1, type: 'sine', vol: 0.06 }) },
  copy() { sfx.tune([[700, 0.05], [1050, 0.08]], { type: 'sine', vol: 0.11 }) },
}
