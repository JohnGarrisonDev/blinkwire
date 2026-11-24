// Pointer input on the board canvas: tap, right-click / shift-click, two-finger tap, long-press.
// Reports gestures through callbacks; knows nothing about game rules.

const LONG_MS = 430, MOVE_TOL = 14

/**
 * handlers: { hit(x, y) -> tile index or -1, tap(index, alt), longPress(index), move(x, y) }
 *  - tap alt = true for right-click, shift-click and two-finger tap
 */
export function attachPointer(canvas, handlers) {
  const active = new Map() // pointerId -> { x, y, idx, done, alt, timer }
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const drop = (id) => { const p = active.get(id); if (p) { clearTimeout(p.timer); active.delete(id) } }

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = pos(e)
    handlers.move?.(x, y)
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    const first = active.size === 1 ? active.values().next().value : null
    if (first && e.pointerType === 'touch' && !first.done && performance.now() - first.t < 320) {
      // a second finger: the first finger's tap becomes a counter-clockwise turn; this finger does nothing itself
      for (const p of active.values()) { p.alt = true; clearTimeout(p.timer) }
      active.set(e.pointerId, { x, y, idx: -1, done: true, alt: false, timer: 0, t: 0 })
      return
    }
    const p = { x, y, idx: handlers.hit(x, y), done: false, alt: e.button === 2 || e.shiftKey, timer: 0, t: performance.now() }
    if (p.idx >= 0 && !p.alt) {
      p.timer = setTimeout(() => {
        if (active.get(e.pointerId) !== p || p.done || p.alt) return
        p.done = true
        handlers.longPress?.(p.idx)
      }, LONG_MS)
    }
    active.set(e.pointerId, p)
  })
  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = pos(e)
    if (e.pointerType === 'mouse') handlers.move?.(x, y)
    const p = active.get(e.pointerId)
    if (p && !p.done && Math.hypot(x - p.x, y - p.y) > MOVE_TOL) { p.done = true; clearTimeout(p.timer) }
  })
  canvas.addEventListener('pointerup', (e) => {
    const p = active.get(e.pointerId)
    drop(e.pointerId)
    if (!p || p.done || p.idx < 0) return
    e.preventDefault()
    handlers.tap?.(p.idx, p.alt || e.shiftKey)
  })
  canvas.addEventListener('pointercancel', (e) => drop(e.pointerId))
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') handlers.move?.(-1, -1) })
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
}
