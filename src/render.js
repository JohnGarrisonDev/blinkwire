// Canvas drawing: paper background, board plate, tiles, wires, eyes. Flat Oddvale print style, all in code.
import { C, fitCanvas } from '../kit/kit.js'
import { DIRS, neighbor, isLooseEnd } from './logic/grid.js'

const COL = {
  paper: C.paper, dot: '#EDE2CC', plate: '#EADDC4', plateWrap: '#D9DAFF',
  tile: '#FFFDF8', tileLit: '#FFF0B3', lock: '#DCCDB0', lockLit: '#F0D88E',
  wire: '#B7ADC4', wireLit: C.yellow, core: '#FFFDF0', dot2: C.orange,
  sleepy: '#E7DFEE', white: '#FFFFFF', ink: C.ink, source: C.blue, pin: C.pink, hint: C.pink, cursor: C.blue, loose: C.pink,
}
const TAU = Math.PI * 2
const frac = (v) => v - Math.floor(v)
const hash01 = (n) => { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296 }

/** Where a level sits inside an area (CSS px): { x0, y0, tile, w, h, margin }. */
export function layoutBoard(level, area) {
  const m = level.wrap ? 0.46 : 0.16
  const tile = Math.max(8, Math.floor(Math.min(area.w / (level.w + 2 * m), area.h / (level.h + 2 * m), 116)))
  return {
    tile, m, w: level.w, h: level.h,
    x0: Math.round(area.x + (area.w - tile * level.w) / 2),
    y0: Math.round(area.y + (area.h - tile * level.h) / 2),
  }
}
/** Tile index under a point, or -1. */
export function hitTile(view, px, py) {
  if (!view) return -1
  const x = Math.floor((px - view.x0) / view.tile), y = Math.floor((py - view.y0) / view.tile)
  return x < 0 || y < 0 || x >= view.w || y >= view.h ? -1 : y * view.w + x
}
export const tileCentre = (view, i) => ({ x: view.x0 + ((i % view.w) + 0.5) * view.tile, y: view.y0 + (((i / view.w) | 0) + 0.5) * view.tile })

export function createRenderer(canvas) {
  const g = canvas.getContext('2d')
  let W = 1, H = 1, dpr = 1, pattern = null

  function resize() { ({ w: W, h: H, dpr } = fitCanvas(canvas)); pattern = null; return { w: W, h: H } }
  const base = () => g.setTransform(dpr, 0, 0, dpr, 0, 0)
  const at = (cx, cy, ang = 0, sc = 1) => { const c = Math.cos(ang) * sc * dpr, s = Math.sin(ang) * sc * dpr; g.setTransform(c, s, -s, c, cx * dpr, cy * dpr) }
  function rr(x, y, w, h, r) {
    g.beginPath()
    if (g.roundRect) g.roundRect(x, y, w, h, r)
    else { g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
  }
  const disc = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU) }

  function background() {
    base()
    g.fillStyle = COL.paper; g.fillRect(0, 0, W, H)
    if (!pattern) {
      const p = document.createElement('canvas'); p.width = p.height = 22 * dpr
      const pg = p.getContext('2d'); pg.scale(dpr, dpr); pg.fillStyle = COL.dot; pg.beginPath(); pg.arc(11, 11, 1.4, 0, TAU); pg.fill()
      pattern = g.createPattern(p, 'repeat')
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = pattern; g.fillRect(0, 0, W * dpr, H * dpr); base()
  }

  // ---- eyes
  function lampEye(r, lit, now, i, bv, small) {
    const pop = now - bv.litAt[i]
    if (lit && pop >= 0 && pop < 280) { const k = 1 + 0.4 * Math.sin(Math.PI * pop / 280); r *= k }
    const lw = Math.max(1.5, r * 0.17)
    const h = hash01(i + 17)
    const cel = now - bv.celebrateAt
    const blink = lit && ((cel >= 0 && cel < 170) || (cel > 430 && cel < 560) || frac((now + h * 9000) / (3600 + h * 3400)) < 0.035)
    disc(0, 0, r); g.fillStyle = lit ? COL.white : COL.sleepy; g.fill(); g.lineWidth = lw; g.strokeStyle = COL.ink; g.stroke()
    g.lineCap = 'round'
    if (!lit) { // sleepy: a closed lid, curving down
      g.beginPath(); g.arc(0, -r * 0.22, r * 0.56, Math.PI * 0.16, Math.PI * 0.84); g.lineWidth = Math.max(1.5, r * 0.2); g.stroke()
    } else if (blink) {
      g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(r * 0.6, 0); g.lineWidth = Math.max(1.5, r * 0.2); g.stroke()
    } else {
      const period = 2400 + h * 2600, slot = Math.floor((now + h * 7000) / period)
      const a = hash01(slot * 131 + i) * TAU, mag = hash01(slot * 57 + i * 3) < 0.25 ? 0 : 0.36
      disc(Math.cos(a) * r * mag, Math.sin(a) * r * mag, r * 0.44); g.fillStyle = COL.ink; g.fill()
      if (!small) { disc(Math.cos(a) * r * mag - r * 0.14, Math.sin(a) * r * mag - r * 0.16, r * 0.11); g.fillStyle = COL.white; g.fill() }
    }
  }
  function bigEye(r, now, lookX, lookY, bv) {
    const lw = Math.max(2, r * 0.13)
    const cel = now - bv.celebrateAt
    const blink = (cel >= 0 && cel < 170) || frac(now / 5300) < 0.022
    disc(0, 0, r); g.fillStyle = C.orange; g.fill(); g.lineWidth = lw; g.strokeStyle = COL.ink; g.stroke()
    if (blink) { g.lineCap = 'round'; g.beginPath(); g.moveTo(-r * 0.62, 0); g.lineTo(r * 0.62, 0); g.lineWidth = Math.max(2, r * 0.2); g.stroke(); return }
    const px = lookX * r * 0.44, py = lookY * r * 0.44
    disc(px, py, r * 0.4); g.fillStyle = COL.ink; g.fill()
    disc(px - r * 0.13, py - r * 0.15, r * 0.1); g.fillStyle = COL.paper; g.fill()
  }

  /**
   * Draw one board. opts: { cursor (tile index or -1), look ({x,y} canvas px the Big Eye looks at, or null), reduced (bool) }
   */
  function board(view, bv, now, opts = {}) {
    const { level, session } = bv, { w, h } = level, t = view.tile, f = session.flood, masks = session.cur
    const { x0, y0 } = view, bw = t * w, bh = t * h
    const gap = Math.max(2, Math.round(t * 0.06)), off = Math.max(1.5, t * 0.045)
    const s = t - gap - off, hs = s / 2, rad = t * 0.17, half = t / 2
    const ww = t * 0.2, ol = Math.min(3, Math.max(1.4, t * 0.04)), lw = Math.min(2.5, Math.max(1.2, t * 0.035))

    // plate
    base()
    const pad = t * view.m * (level.wrap ? 0.92 : 0.8), pr = t * 0.24
    g.fillStyle = COL.ink; rr(x0 - pad + 5, y0 - pad + 6, bw + pad * 2, bh + pad * 2, pr); g.fill()
    g.fillStyle = level.wrap ? COL.plateWrap : COL.plate; rr(x0 - pad, y0 - pad, bw + pad * 2, bh + pad * 2, pr); g.fill()
    g.strokeStyle = COL.ink; g.lineWidth = 2.5
    if (level.wrap) g.setLineDash([t * 0.2, t * 0.13])
    g.stroke(); g.setLineDash([])

    // wrap stubs: a wire that leaves one edge pokes out there, and pokes in on the opposite side
    if (level.wrap) {
      const len = t * view.m * 0.6
      g.lineCap = 'round'
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < w * h; i++) {
          const x = i % w, y = (i / w) | 0
          for (let d = 0; d < 4; d++) {
            if (!(masks[i] & (1 << d))) continue
            const out = (d === 0 && y === 0) || (d === 1 && x === w - 1) || (d === 2 && y === h - 1) || (d === 3 && x === 0)
            if (!out) continue
            const lit = bv.litAt[i] <= now, D = DIRS[d]
            const ax = x0 + (x + 0.5) * t + D.dx * half, ay = y0 + (y + 0.5) * t + D.dy * half
            const j = neighbor(level, i, d), jx = j % w, jy = (j / w) | 0
            const bx = x0 + (jx + 0.5) * t - D.dx * half, by = y0 + (jy + 0.5) * t - D.dy * half
            g.beginPath()
            g.moveTo(ax - D.dx * 2, ay - D.dy * 2); g.lineTo(ax + D.dx * len, ay + D.dy * len)
            g.moveTo(bx + D.dx * 2, by + D.dy * 2); g.lineTo(bx - D.dx * len, by - D.dy * len)
            if (pass === 0) { g.strokeStyle = COL.ink; g.lineWidth = ww + ol * 2 } else { g.strokeStyle = lit ? COL.wireLit : COL.wire; g.lineWidth = ww }
            g.stroke()
          }
        }
      }
    }

    const flow = opts.reduced ? 0.25 : now * 0.0011
    const lookAt = opts.look
    const armsOk = [0, 0, 0, 0], armsLoose = [0, 0, 0, 0]

    function wire(mask, i, lit) {
      let nOk = 0, nLoose = 0
      for (let d = 0; d < 4; d++) if (mask & (1 << d)) { if (isLooseEnd(level, masks, i, d)) armsLoose[nLoose++] = d; else armsOk[nOk++] = d }
      const short = half * 0.74
      const trace = (list, n, len) => {
        g.beginPath()
        if (n === 2 && nOk + nLoose === 2) { g.moveTo(DIRS[list[0]].dx * len, DIRS[list[0]].dy * len); g.lineTo(0, 0); g.lineTo(DIRS[list[1]].dx * len, DIRS[list[1]].dy * len) }
        else for (let k = 0; k < n; k++) { g.moveTo(0, 0); g.lineTo(DIRS[list[k]].dx * len, DIRS[list[k]].dy * len) }
      }
      g.lineJoin = 'round'
      const stroke = (style, width) => {
        g.strokeStyle = style; g.lineWidth = width
        if (nOk) { g.lineCap = 'butt'; trace(armsOk, nOk, half); g.stroke() }
        if (nLoose) { g.lineCap = 'round'; trace(armsLoose, nLoose, short); g.stroke() }
      }
      stroke(COL.ink, ww + ol * 2)
      stroke(lit ? COL.wireLit : COL.wire, ww)
      if (!lit) return
      stroke(COL.core, ww * 0.26)
      // pulse dots run away from the source: more than a colour change, so it reads without colour
      const dep = Math.max(0, f.depth[i]), par = f.parent[i]
      g.fillStyle = COL.dot2
      for (let d = 0; d < 4; d++) {
        if (!(mask & (1 << d))) continue
        const D = DIRS[d]
        let pos = -1 // 0 = centre, 0.5 = tile edge
        if (d === par) { const u = frac(flow - dep + 0.5); if (u < 0.5) pos = 0.5 - u }
        else { const u = frac(flow - dep); if (u < 0.5) pos = u }
        if (pos < 0) continue
        if (d !== par && isLooseEnd(level, masks, i, d) && pos * t > short) continue
        disc(D.dx * pos * t, D.dy * pos * t, ww * 0.24); g.fill()
      }
      // a lit wire end that meets nothing gets a little spark, so the last loose ends are easy to find
      if (nLoose) {
        const pulse = opts.reduced ? 1 : 0.85 + 0.25 * Math.sin(now * 0.008 + i)
        for (let k = 0; k < nLoose; k++) {
          const D = DIRS[armsLoose[k]]
          disc(D.dx * short, D.dy * short, ww * 0.42 * pulse); g.fillStyle = COL.loose; g.fill(); g.lineWidth = ol; g.strokeStyle = COL.ink; g.stroke()
        }
      }
    }

    function tile(i) {
      const x = i % w, y = (i / w) | 0, cx = x0 + (x + 0.5) * t, cy = y0 + (y + 0.5) * t
      let ang = bv.angle(i, now), sc = 1
      const np = (now - bv.nopeAt[i]) / 280
      if (np >= 0 && np < 1) ang += Math.sin(np * Math.PI * 3) * (1 - np) * 0.14
      const cb = now - bv.celebrateAt - Math.max(0, f.depth[i]) * 34
      if (cb > 0 && cb < 340) sc += 0.16 * Math.sin(Math.PI * cb / 340)
      const pp = (now - bv.pinAt[i]) / 200
      if (pp >= 0 && pp < 1) sc += 0.08 * Math.sin(Math.PI * pp)
      at(cx, cy, ang, sc)
      const lit = bv.litAt[i] <= now, locked = level.locked[i], src = i === level.source, mask = masks[i]
      // chunky body: ink slab offset down-right, face on top
      g.fillStyle = COL.ink; rr(-hs - off / 2 + off, -hs - off / 2 + off, s, s, rad); g.fill()
      g.fillStyle = src ? COL.source : locked ? (lit ? COL.lockLit : COL.lock) : lit ? COL.tileLit : COL.tile
      rr(-hs - off / 2, -hs - off / 2, s, s, rad); g.fill(); g.lineWidth = lw; g.strokeStyle = COL.ink; g.stroke()
      if (session.pinned[i]) { // pinned: pink inner frame (plus the pin head drawn below)
        const inset = Math.max(2.5, t * 0.07)
        g.lineWidth = Math.max(2, t * 0.05); g.strokeStyle = COL.pin
        rr(-hs - off / 2 + inset, -hs - off / 2 + inset, s - inset * 2, s - inset * 2, Math.max(2, rad - inset)); g.stroke()
      }
      if (locked) { // bolts
        const b = hs * 0.74, br = Math.max(1.3, t * 0.04)
        g.fillStyle = COL.ink
        for (let k = 0; k < 4; k++) { disc((k & 1 ? b : -b) - off / 2, (k & 2 ? b : -b) - off / 2, br); g.fill() }
      }
      wire(mask, i, lit)
      if (src) {
        let lx = 0.54, ly = 0.38
        if (lookAt) { const dx = lookAt.x - cx, dy = lookAt.y - cy, dd = Math.hypot(dx, dy); if (dd > 1) { const k = Math.min(1, dd / (t * 1.5)) / dd; lx = dx * k; ly = dy * k } }
        bigEye(t * 0.34, now, lx, ly, bv)
      } else if (bv.isLamp[i]) lampEye(t * 0.25, lit, now, i, bv, t < 34)
      if (session.pinned[i]) { // pin: stays upright in the top-right corner
        at(cx, cy, 0, sc)
        const px = hs * 0.66 - off / 2, py = -hs * 0.66 - off / 2, r = Math.max(3.2, t * 0.105)
        disc(px + 1, py + 1.5, r); g.fillStyle = COL.ink; g.fill()
        disc(px, py, r); g.fillStyle = COL.pin; g.fill(); g.lineWidth = Math.max(1.2, lw * 0.9); g.strokeStyle = COL.ink; g.stroke()
        disc(px - r * 0.28, py - r * 0.3, r * 0.26); g.fillStyle = COL.white; g.fill()
      }
    }

    // resting tiles first, moving ones on top
    const n = w * h
    let moving = 0
    for (let i = 0; i < n; i++) { if (now - bv.angStart[i] < 200 || now - bv.nopeAt[i] < 280) { moving++; continue } tile(i) }
    if (moving) for (let i = 0; i < n; i++) if (now - bv.angStart[i] < 200 || now - bv.nopeAt[i] < 280) tile(i)

    // hint flash
    const hp = (now - bv.hintAt) / 1700
    if (bv.hintIdx >= 0 && hp >= 0 && hp < 1) {
      const c = tileCentre(view, bv.hintIdx), k = opts.reduced ? 1 : 0.5 + 0.5 * Math.cos(hp * TAU * 3)
      base(); g.globalAlpha = Math.min(1, (1 - hp) * 3)
      const e = t * 0.5 + 2 + k * t * 0.1
      g.lineWidth = Math.max(3, t * 0.09); g.strokeStyle = COL.ink; rr(c.x - e, c.y - e, e * 2, e * 2, rad + 3); g.stroke()
      g.lineWidth = Math.max(2, t * 0.055); g.strokeStyle = COL.hint; g.stroke()
      g.globalAlpha = 1
    }
    // touch / click press: a bold ring that reaches past the fingertip, so you can see which tile is about to turn
    if (opts.press >= 0 && opts.press < n) {
      const c = tileCentre(view, opts.press), e = t * 0.5 + Math.max(3, t * 0.08)
      base(); g.lineJoin = 'round'
      g.fillStyle = 'rgba(255, 201, 60, 0.28)'; rr(c.x - e, c.y - e, e * 2, e * 2, rad + 3); g.fill()
      g.lineWidth = Math.max(5, t * 0.12); g.strokeStyle = COL.ink; g.stroke()
      g.lineWidth = Math.max(3, t * 0.07); g.strokeStyle = C.orange; g.stroke()
    }
    // keyboard cursor
    if (opts.cursor >= 0 && opts.cursor < n) {
      const c = tileCentre(view, opts.cursor), e = t * 0.5 + 1
      base(); g.lineJoin = 'round'
      g.lineWidth = Math.max(4.5, t * 0.1); g.strokeStyle = COL.ink; rr(c.x - e, c.y - e, e * 2, e * 2, rad + 2); g.stroke()
      g.lineWidth = Math.max(2.5, t * 0.06); g.strokeStyle = COL.cursor; g.stroke()
    }
    base()
  }

  function confetti(parts) {
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k]
      if (p.life <= 0) continue
      at(p.x, p.y, p.rot, 1)
      g.globalAlpha = Math.min(1, p.life * 2.5)
      g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6)
      g.strokeStyle = COL.ink; g.lineWidth = 1; g.strokeRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6)
    }
    g.globalAlpha = 1; base()
  }

  return { resize, background, board, confetti, get size() { return { w: W, h: H } } }
}
