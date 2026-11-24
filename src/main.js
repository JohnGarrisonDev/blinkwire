// Blinkwire entry point: app state, screen flow, frame loop, saving. Rules live in src/logic (pure, tested).
import { makeStore, wireChrome } from '../kit/kit.js'
import { generate } from './logic/generate.js'
import { createSession, rotate, undo, togglePin, restart, hint, canRotate, lampCount, snapshot } from './logic/session.js'
import { CHAPTERS, LEVEL_COUNT, PER_CHAPTER, journeyDef, levelLabel, isUnlocked } from './logic/levels.js'
import { dateKey, shiftDay, dailyDef, streakInfo, formatTime, shareText } from './logic/daily.js'
import { starsFor, starThresholds, starString } from './logic/stars.js'
import { defaults, sanitize, recordJourney, totalStars, solvedCount, FREE_MIN, FREE_MAX } from './logic/save.js'
import { BoardView } from './boardview.js'
import { createRenderer, layoutBoard, hitTile, tileCentre } from './render.js'
import { createConfetti } from './fx.js'
import { attachPointer } from './input.js'
import { createUI } from './ui.js'
import { snd } from './audio.js'

const stage = document.getElementById('stage'), canvas = document.getElementById('game'), uiRoot = document.getElementById('ui')
const store = makeStore('blinkwire', defaults())
{ const clean = sanitize(store.data); for (const k of Object.keys(store.data)) delete store.data[k]; Object.assign(store.data, clean) }
const save = store.data
const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
const R = createRenderer(canvas), confetti = createConfetti()
const HEX = '0123456789abcdef'

const app = {
  mode: null, def: null, level: null, session: null, bv: null, view: null,
  cursor: -1, cursorOn: false, pinMode: false, pointer: null,
  celebrateAt: Infinity, cardAt: Infinity, celebrated: false, cardShown: false, result: null,
  chapter: 0, portrait: false, timeText: '', engaged: false, toldPin: false, toldHint: false,
}
const demo = { session: null, bv: null, view: null, nextAt: 0, doneAt: 0 }
const woken = []

// ------------------------------------------------------------------ screens

const actions = {
  journey() {
    snd.click()
    if (!solvedCount(save) && !save.progress.journey) return startJourney(0)
    const first = firstOpenLevel()
    app.chapter = Math.floor((save.progress.journey ? save.progress.journey.level : first) / PER_CHAPTER)
    showLevels()
  },
  levels() { snd.back(); leaveBoard(); app.chapter = app.def && app.mode === 'journey' ? app.def.chapter : app.chapter; showLevels() },
  chapter({ d }) { snd.click(); app.chapter = Math.max(0, Math.min(CHAPTERS.length - 1, app.chapter + Number(d))); showLevels(true) },
  'chapter-go'({ c }) { snd.click(); app.chapter = Number(c); showLevels(true) },
  level({ i }) { snd.click(); startJourney(Number(i)) },
  daily() { snd.click(); startDaily() },
  free() { snd.click(); leaveBoard(); showFree() },
  size({ k, d }) {
    const f = save.free, max = k === 'w' ? maxFreeW() : FREE_MAX
    f[k] = Math.max(FREE_MIN, Math.min(max, f[k] + Number(d))); snd.click(); store.save(); showFree(true)
  },
  opt({ k }) { save.free[k] = !save.free[k]; snd.click(); store.save(); showFree(true) },
  'free-start'() {
    snd.click()
    const f = save.free
    startBoard('free', { seed: (Math.random() * 4294967296) >>> 0, w: Math.min(f.w, maxFreeW()), h: f.h, wrap: f.wrap, lock: f.lock ? 0.1 : 0 })
  },
  'free-resume'() { snd.click(); const p = save.progress.free; if (p) startBoard('free', p.def, p.board) },
  title() { snd.back(); leaveBoard(); showTitle() },
  menu() { if (app.session && !app.session.solved) { snd.click(); openPause() } },
  resume() { snd.click(); ui.closeModal() },
  restart() {
    const s = app.session
    if (!s || s.solved) return
    if (!s.moves) { ui.closeModal(); return }
    snd.click()
    ui.openConfirm({ title: 'Restart this board?', text: 'Every tile goes back to where it started. The clock keeps running.', yes: 'Restart', act: 'restart-yes' })
  },
  'restart-yes'() {
    const s = app.session
    ui.closeModal(); restart(s)
    app.bv = new BoardView(s, performance.now()); snd.undo(); afterChange()
  },
  undo() { doUndo() },
  hint() { doHint() },
  pinmode() { app.pinMode = !app.pinMode; snd.pin(app.pinMode); ui.setTip(app.pinMode ? 'Pin mode: tap a tile to pin or unpin it. Pinned tiles ignore taps.' : app.def.tip); syncTools(); relayout() },
  ccw() { save.settings.ccw = !save.settings.ccw; store.save(); snd.click(); syncTools(); ui.toast(save.settings.ccw ? 'Taps now turn tiles counter-clockwise' : 'Taps now turn tiles clockwise', 1500) },
  timer() {
    save.settings.timer = !save.settings.timer; store.save(); snd.click()
    ui.setTimerVisible(save.settings.timer)
    uiRoot.querySelector('.modal [data-act="timer"]')?.setAttribute('aria-checked', String(save.settings.timer))
    relayout()
  },
  next() {
    snd.click()
    const i = app.def.index + 1
    if (i >= LEVEL_COUNT) { app.chapter = CHAPTERS.length - 1; leaveBoard(); showLevels(); ui.toast('That was the last one. The whole valley is awake!', 3200); return }
    startJourney(i)
  },
  replay() { snd.click(); save.progress.journey = null; startJourney(app.def.index) },
  async copy(_, el) {
    const key = app.def.date, rec = save.daily.history[key]
    if (!rec) return
    const ok = await copyText(shareText(key, rec))
    snd.copy()
    if (el) { el.textContent = ok ? 'Copied!' : 'Copy failed'; setTimeout(() => { if (el.isConnected) el.textContent = 'Copy result' }, 1600) }
  },
}
const ui = createUI(uiRoot, actions)

const firstOpenLevel = () => { for (let i = 0; i < LEVEL_COUNT; i++) if (!(save.journey.stars[i] | 0)) return i; return LEVEL_COUNT - 1 }
const maxFreeW = () => (app.portrait || R.size.w < 620 ? 9 : FREE_MAX)

function showTitle(focus = true) {
  save.last = null; store.save()
  ui.closeModal(); ui.show('title'); relayout()
  const today = dateKey(), d = dailyDef(today), rec = save.daily.history[today], st = streakInfo(save.daily.history, today)
  const solved = solvedCount(save), prog = save.progress.daily
  const streak = st.current ? `${st.current}-day streak` : ''
  ui.setTitle({
    journey: !solved ? `${LEVEL_COUNT} levels in ${CHAPTERS.length} chapters` : solved >= LEVEL_COUNT ? `All ${LEVEL_COUNT} solved · ★ ${totalStars(save)} of ${LEVEL_COUNT * 3}` : `${solved} of ${LEVEL_COUNT} solved · ★ ${totalStars(save)}`,
    daily: rec ? `Solved ${starString(rec.stars)}${streak ? ' · ' + streak : ''}` : prog && prog.date === today && prog.board.moves ? `In progress · ${prog.board.moves} moves` : `Today: ${d.w}×${d.h}${d.wrap ? ' wrap' : ''}${streak ? ' · ' + streak : ' · not played yet'}`,
    free: save.free.solved ? `${save.free.solved} boards solved` : `Any size up to ${maxFreeW()}×${FREE_MAX}`,
  })
  if (focus) ui.focusFirst()
}

function showLevels(keepFocus = false) {
  save.last = null
  ui.closeModal()
  ui.setLevels({ chapter: app.chapter, starList: Array.from({ length: LEVEL_COUNT }, (_, i) => save.journey.stars[i] | 0), total: totalStars(save), resume: save.progress.journey ? save.progress.journey.level : -1 })
  ui.show('levels'); relayout()
  if (!keepFocus) ui.focusFirst()
}

function showFree(keepFocus = false) {
  save.last = null
  const f = save.free, maxW = maxFreeW(), p = save.progress.free
  if (f.w > maxW) f.w = maxW
  ui.closeModal()
  ui.setFree({
    ...f, maxW, maxH: FREE_MAX, min: FREE_MIN,
    resume: p ? `${p.def.w}×${p.def.h}${p.def.wrap ? ' wrap' : ''}` : '',
    note: maxW < FREE_MAX ? 'Boards are at most 9 wide on small screens, so tiles stay easy to tap.' : f.w * f.h >= 100 ? 'Big board. Pin tiles as you go.' : '',
  })
  ui.show('free'); relayout()
  if (!keepFocus) ui.focusFirst()
}

function startJourney(i) {
  if (!isUnlocked(save.journey.stars, i)) return
  const p = save.progress.journey
  startBoard('journey', journeyDef(i), p && p.level === i ? p.board : null)
}

function startDaily() {
  const today = dateKey(), def = dailyDef(today), p = save.progress.daily, rec = save.daily.history[today]
  let board = p && p.date === today ? p.board : null
  if (rec && !(p && p.date === today && p.done)) { // solved earlier but the board state is gone: show the solution
    const lvl = generate(def)
    board = { cur: Array.from(lvl.sol, (m) => HEX[m]).join(''), pins: '', moves: rec.moves, time: rec.time, hinted: false, undo: [] }
  }
  startBoard('daily', def, board)
}

function startBoard(mode, def, board = null) {
  ui.closeModal(); confetti.clear()
  app.mode = mode; app.def = def
  app.level = generate(def)
  app.session = createSession(app.level, board)
  app.bv = new BoardView(app.session, performance.now())
  app.cursor = app.level.source; app.pinMode = false
  app.celebrateAt = app.cardAt = Infinity; app.celebrated = app.cardShown = false; app.result = null; app.timeText = ''
  save.last = mode
  const chips = []
  if (def.wrap) chips.push({ text: 'Wraps', cls: 'blue' })
  if (def.lock) chips.push({ text: 'Bolts' })
  const pretty = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }
  ui.setPlay({
    mode: mode === 'journey' ? `Journey ${levelLabel(def.index)}` : mode === 'daily' ? 'Daily' : 'Free play',
    name: mode === 'journey' ? CHAPTERS[def.chapter].name : mode === 'daily' ? pretty(def.date) : `${def.w}×${def.h} board`,
    par: app.level.par, tip: def.tip || '', chips,
  })
  ui.setTimerVisible(save.settings.timer)
  ui.show('play')
  syncHud(); syncTools(); relayout()
  if (app.session.solved) { // a finished daily, opened again
    const rec = save.daily.history[def.date]
    app.result = { mode, stars: rec ? rec.stars : 1, moves: rec ? rec.moves : app.session.moves, par: rec ? rec.par : app.level.par, time: rec ? rec.time : app.session.time, hinted: false, again: true }
    app.celebrated = app.cardShown = true
    showSolved(false)
  }
  persist()
}

/** Called when leaving the play screen for a menu. */
function leaveBoard() {
  if (app.session) persist()
  app.session = null; app.bv = null; app.view = null; app.pinMode = false
  confetti.clear(); ui.closeModal()
}

function openPause() {
  const items = [{ act: 'resume', label: 'Keep playing', primary: true }, { act: 'restart', label: 'Restart board' }]
  if (app.mode === 'journey') items.push({ act: 'levels', label: 'Level select' })
  if (app.mode === 'free') items.push({ act: 'free', label: 'Change size' })
  items.push({ act: 'title', label: 'Title screen' })
  ui.openPause({ title: 'Paused', timer: save.settings.timer, items })
}

// ------------------------------------------------------------------ playing

function syncHud() {
  const s = app.session
  if (!s) return
  const l = lampCount(s)
  ui.setHud({ moves: s.moves, lit: l.lit, total: l.total, over: s.moves > starThresholds(app.level.par).three })
  const t = formatTime(s.time)
  if (t !== app.timeText) { app.timeText = t; ui.setTime(t) }
}
const syncTools = () => ui.setTools({ pinMode: app.pinMode, ccw: save.settings.ccw, canUndo: !!app.session && app.session.undo.length > 0 && !app.session.solved })

function afterChange() {
  syncHud(); syncTools()
  if (app.session.solved && !app.result) onSolved()
  persist()
}

function turn(i, dir) {
  const s = app.session, now = performance.now()
  if (!s || s.solved || ui.modalOpen || i < 0) return
  if (!canRotate(s, i)) {
    app.bv.nope(i, now); snd.nope()
    if (s.pinned[i] && !app.toldPin) { app.toldPin = true; ui.toast('Pinned. Long-press it (or press P) to unpin.') }
    return
  }
  const before = s.flood.count
  rotate(s, i, dir)
  if (!motion.matches) app.bv.spin(i, dir, now)
  app.bv.syncPower(now)
  snd.turn(dir)
  if (s.flood.count < before) snd.dim()
  afterChange()
}

function pin(i) {
  const s = app.session
  if (!s || s.solved || ui.modalOpen || i < 0) return
  const r = togglePin(s, i)
  if (r === null) { app.bv.nope(i, performance.now()); snd.nope(); return }
  app.bv.pinAt[i] = performance.now(); snd.pin(r); persist()
}

function doUndo() {
  const s = app.session
  if (!s || s.solved || ui.modalOpen) return
  const u = undo(s), now = performance.now()
  if (!u) return
  if (!motion.matches) app.bv.spin(u.i, u.dir, now)
  app.bv.syncPower(now); snd.undo(); afterChange()
}

function doHint() {
  const s = app.session
  if (!s || s.solved || ui.modalOpen) return
  const i = hint(s)
  if (i < 0) return
  if (s.pinned[i]) togglePin(s, i)
  app.bv.flashHint(i, performance.now()); snd.hint()
  if (!app.toldHint) { app.toldHint = true; ui.toast('That tile needs turning. Hints cap a level at 2 stars.', 3000) }
  persist()
}

function onSolved() {
  const s = app.session, lvl = app.level, def = app.def
  const res = { mode: app.mode, stars: starsFor(s.moves, lvl.par, s.hinted), moves: s.moves, par: lvl.par, time: s.time, hinted: s.hinted }
  if (app.mode === 'journey') {
    const r = recordJourney(save, def.index, s.moves, s.time, res.stars)
    res.newBest = r.newBest && !!r.prev; res.best = save.journey.best[def.index]
  } else if (app.mode === 'daily') {
    if (!save.daily.history[def.date]) save.daily.history[def.date] = { moves: s.moves, par: lvl.par, time: Math.round(s.time), stars: res.stars, w: lvl.w, h: lvl.h, wrap: lvl.wrap }
    save.daily.bestStreak = Math.max(save.daily.bestStreak, streakInfo(save.daily.history, def.date).best)
  } else save.free.solved++
  app.result = res
  app.celebrateAt = Math.max(performance.now(), app.bv.waveEnd) + 160
  app.cardAt = app.celebrateAt + (motion.matches ? 500 : 1500)
  ui.setTip('')
}

function persist() {
  const s = app.session
  if (!s) { store.save(); return }
  const board = snapshot(s)
  if (app.mode === 'journey') save.progress.journey = s.solved ? null : { level: app.def.index, board }
  else if (app.mode === 'daily') save.progress.daily = { date: app.def.date, board, done: s.solved }
  else save.progress.free = s.solved ? null : { def: { seed: app.def.seed, w: app.def.w, h: app.def.h, wrap: app.def.wrap, lock: app.def.lock }, board }
  store.save()
}

function showSolved(animate) {
  const r = app.result, def = app.def, t = starThresholds(r.par)
  app.cardShown = true
  const heading = r.again ? 'Solved today' : r.moves < r.par ? 'Under par!' : r.stars === 3 ? (r.moves === r.par ? 'Flawless wiring!' : 'Bright work!') : r.stars === 2 ? 'All eyes open!' : 'Everyone is awake!'
  const lines = [['Moves', `${r.moves}  (par ${r.par})`], ['Time', formatTime(r.time)]]
  const notes = [], buttons = []
  let daily = null, sub = ''
  if (r.hinted) notes.push('You used a hint, so this one tops out at 2 stars.')
  else if (r.stars < 3 && !r.again) notes.push(`3 stars: ${t.three} moves or fewer.${r.stars < 2 ? ` 2 stars: ${t.two}.` : ''}`)
  if (r.mode === 'journey') {
    sub = `Journey ${levelLabel(def.index)} · ${CHAPTERS[def.chapter].name}`
    if (r.newBest) notes.unshift('New best!')
    else if (r.best && (r.best.moves !== r.moves)) lines.push(['Your best', `${r.best.moves} moves`])
    const last = def.index + 1 >= LEVEL_COUNT
    buttons.push({ act: 'next', label: last ? 'Finish' : 'Next level', primary: true }, { act: 'replay', label: 'Replay' }, { act: 'levels', label: 'Levels' })
  } else if (r.mode === 'daily') {
    sub = `Daily · ${def.date}`
    const st = streakInfo(save.daily.history, def.date)
    const days = []
    for (let k = -6; k <= 0; k++) {
      const key = shiftDay(def.date, k), [y, m, d] = key.split('-').map(Number), rec = save.daily.history[key]
      days.push({ letter: 'SMTWTFS'[new Date(y, m - 1, d).getDay()], stars: rec ? rec.stars : 0, today: k === 0 })
    }
    daily = { streak: st.current, best: Math.max(st.best, save.daily.bestStreak), days }
    notes.push('A new puzzle arrives at midnight.')
    buttons.push({ act: 'copy', label: 'Copy result', primary: true }, { act: 'title', label: 'Title' }, { act: 'free', label: 'Free play' })
  } else {
    sub = `Free play · ${def.w}×${def.h}${def.wrap ? ' wrap' : ''}`
    buttons.push({ act: 'free-start', label: 'New board', primary: true }, { act: 'free', label: 'Change size' }, { act: 'title', label: 'Title' })
  }
  ui.openSolved({ heading, sub, stars: r.stars, animate: animate && !motion.matches, lines, notes, daily, buttons })
  if (animate) for (let k = 0; k < r.stars; k++) setTimeout(() => snd.star(k), 380 + k * 260)
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fall through to the old way */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;user-select:text;-webkit-user-select:text'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove()
    return ok
  } catch { return false }
}

// ------------------------------------------------------------------ input

attachPointer(canvas, {
  hit: (x, y) => (ui.screen === 'play' && !ui.modalOpen ? hitTile(app.view, x, y) : -1),
  move(x, y) { app.pointer = x < 0 ? null : { x, y } },
  tap(i, alt) {
    app.cursorOn = false; app.cursor = i
    if (app.pinMode) pin(i)
    else turn(i, alt !== save.settings.ccw ? -1 : 1)
  },
  longPress(i) { app.cursorOn = false; if (navigator.userActivation?.hasBeenActive) { try { navigator.vibrate?.(12) } catch { /* not allowed */ } } pin(i) },
})

document.addEventListener('pointerdown', (e) => { app.engaged = stage.contains(e.target) }, true)
document.addEventListener('focusin', (e) => { if (stage.contains(e.target)) app.engaged = true })

window.addEventListener('keydown', (e) => {
  if (!app.engaged) return
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const onControl = e.target instanceof Element && !!e.target.closest('button, a, input, textarea, select')
  if (e.ctrlKey || e.metaKey || e.altKey) {
    if ((e.ctrlKey || e.metaKey) && k === 'z' && ui.screen === 'play') { e.preventDefault(); doUndo() }
    return
  }
  if (k === 'Escape') {
    if (ui.modalOpen) { if (!app.session || !app.session.solved) { snd.back(); ui.closeModal() } }
    else if (ui.screen === 'play') actions.menu()
    else if (ui.screen !== 'title') actions.title()
    return
  }
  if (ui.screen !== 'play' || ui.modalOpen) { // menus: arrows walk the buttons
    const step = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 0
    if (!step) return
    const scope = ui.modalOpen ? uiRoot.querySelector('.modal') : uiRoot.querySelector(`[data-screen="${ui.screen}"]`)
    const list = [...scope.querySelectorAll('button:not([disabled]):not([hidden])')].filter((b) => b.offsetParent)
    if (!list.length) return
    e.preventDefault()
    const at = list.indexOf(document.activeElement)
    list[(at + step + list.length) % list.length].focus()
    return
  }
  const s = app.session
  if (!s) return
  const dirs = { ArrowUp: [0, -1], w: [0, -1], ArrowRight: [1, 0], d: [1, 0], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0] }
  if (dirs[k]) {
    e.preventDefault()
    const { w, h, wrap } = app.level
    if (app.cursor < 0) app.cursor = app.level.source
    if (app.cursorOn) {
      let x = (app.cursor % w) + dirs[k][0], y = ((app.cursor / w) | 0) + dirs[k][1]
      if (wrap) { x = (x + w) % w; y = (y + h) % h } else { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)) }
      app.cursor = y * w + x
    }
    app.cursorOn = true
    return
  }
  if (k === ' ' || k === 'Enter') {
    if (onControl) return // let the focused button do its thing
    e.preventDefault()
    if (e.repeat) return
    if (!app.cursorOn) { app.cursorOn = true; if (app.cursor < 0) app.cursor = app.level.source; return }
    if (app.pinMode) pin(app.cursor)
    else turn(app.cursor, e.shiftKey !== save.settings.ccw ? -1 : 1)
    return
  }
  if (e.repeat) return
  if (k === 'e') { app.cursorOn = true; turn(app.cursor, 1) }
  else if (k === 'q') { app.cursorOn = true; turn(app.cursor, -1) }
  else if (k === 'z' || k === 'u') doUndo()
  else if (k === 'h') doHint()
  else if (k === 'p') { app.cursorOn = true; pin(app.cursor) }
  else if (k === 'r') actions.restart()
  else if (k === 'm') actions.menu()
})

// ------------------------------------------------------------------ layout + loop

function relayout() {
  const { w, h } = R.resize()
  app.portrait = w < h * 0.95
  stage.classList.toggle('portrait', app.portrait)
  const fs = app.portrait ? Math.min(w / 24, h / 38) : Math.min(w / 62, h / 38)
  uiRoot.style.fontSize = `${Math.max(12, Math.min(18, fs)).toFixed(2)}px`
  if (ui.screen === 'play' && app.session) app.view = layoutBoard(app.level, ui.slot('play', stage))
  if (ui.screen === 'title') { if (!demo.session) newDemo(); demo.view = layoutBoard(demo.session.level, ui.slot('title', stage)) }
}

function newDemo() {
  const a = ui.slot('title', stage), wide = a.w > a.h * 1.35
  const lvl = generate({ seed: (Math.random() * 4294967296) >>> 0, w: wide ? 6 : 5, h: wide ? 4 : 5 })
  demo.session = createSession(lvl)
  demo.bv = new BoardView(demo.session, performance.now())
  demo.view = layoutBoard(lvl, a)
  demo.nextAt = performance.now() + 900; demo.doneAt = 0
}

function updateDemo(now) {
  const s = demo.session
  if (!s) return
  demo.bv.takeWoken(now, woken)
  if (s.solved) {
    if (!demo.doneAt) { demo.doneAt = now; demo.bv.celebrateAt = now + 500 }
    else if (now - demo.doneAt > 3600) newDemo()
    return
  }
  if (now < demo.nextAt) return
  demo.nextAt = now + 430
  const i = hint(s)
  if (i < 0) return
  rotate(s, i, 1)
  if (!motion.matches) demo.bv.spin(i, 1, now)
  demo.bv.syncPower(now)
}

let last = performance.now(), raf = 0, frames = 0
function frame() {
  raf = requestAnimationFrame(frame)
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (++frames % 45 === 0) { const r = canvas.getBoundingClientRect(); if (Math.round(r.width) !== R.size.w || Math.round(r.height) !== R.size.h) relayout() }
  R.background()
  if (ui.screen === 'title') {
    updateDemo(now)
    if (demo.session && demo.view) R.board(demo.view, demo.bv, now, { cursor: -1, look: null, reduced: motion.matches })
    return
  }
  const s = app.session
  if (ui.screen !== 'play' || !s || !app.view) return
  if (!s.solved && !ui.modalOpen && (s.moves > 0 || s.time > 0)) { s.time += dt; syncHudTime() }
  // lamps waking up: a rising blip for each
  const woke = app.bv.takeWoken(now, woken)
  if (woke.length) { const lit = app.bv.litLamps(now), total = Math.max(1, app.level.lamps); for (let k = 0; k < woke.length; k++) snd.wake((lit - woke.length + k + 1) / total) }
  if (!app.celebrated && now >= app.celebrateAt) {
    app.celebrated = true; app.bv.celebrateAt = now; snd.solve()
    if (!motion.matches) {
      const c = tileCentre(app.view, app.level.source)
      confetti.burst(c.x, c.y, 46, 1.25)
      let shown = 0
      for (let i = 0; i < s.cur.length && shown < 9; i++) if (app.bv.isLamp[i] && (i * 7 + shown) % 2 === 0) { const p = tileCentre(app.view, i); confetti.burst(p.x, p.y, 10, 0.8); shown++ }
    }
  }
  if (!app.cardShown && now >= app.cardAt) showSolved(true)
  R.board(app.view, app.bv, now, { cursor: app.cursorOn && !s.solved ? app.cursor : -1, look: app.pointer, reduced: motion.matches })
  if (confetti.update(dt)) R.confetti(confetti.parts)
}
function syncHudTime() { const t = formatTime(app.session.time); if (t !== app.timeText) { app.timeText = t; ui.setTime(t) } }

document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(raf)
  if (document.hidden) { if (app.session) persist() } else { last = performance.now(); raf = requestAnimationFrame(frame) }
})
window.addEventListener('pagehide', () => { if (app.session) persist() })
setInterval(() => { if (app.session && !app.session.solved && !document.hidden && app.session.time > 0) persist() }, 5000)
{ const ro = new ResizeObserver(relayout); ro.observe(stage); for (const el of uiRoot.querySelectorAll('[data-slot]')) ro.observe(el) }
document.addEventListener('fullscreenchange', relayout)
document.fonts?.ready.then(relayout)

// ------------------------------------------------------------------ boot

wireChrome({ stage })
{
  const today = dateKey(), p = save.progress
  if (save.last === 'journey' && p.journey && p.journey.level < LEVEL_COUNT) startJourney(p.journey.level)
  else if (save.last === 'daily' && p.daily && p.daily.date === today && !p.daily.done) startDaily()
  else if (save.last === 'free' && p.free) startBoard('free', p.free.def, p.free.board)
  // No auto-focus on a fresh page load: arrow keys should scroll the page until the player touches the game.
  if (ui.screen !== 'play') showTitle(false)
  else app.engaged = true // dropped straight back into a board: keys work at once
}
raf = requestAnimationFrame(frame)

// Debug hook for automated play-testing: only with ?debug in the URL.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    app, save, store, ui, actions, turn, pin,
    /** Tap every tile into its solved orientation, leaving `leave` tiles untouched. */
    solve(leave = 0) {
      const s = app.session
      if (!s) return 0
      const wrong = []
      for (let i = 0; i < s.cur.length; i++) if (s.cur[i] !== s.level.sol[i]) wrong.push(i)
      for (const i of wrong.slice(0, Math.max(0, wrong.length - leave))) for (let k = 0; k < 4 && s.cur[i] !== s.level.sol[i]; k++) turn(i, 1)
      return wrong.length
    },
    /** Client coordinates of the centre of tile i, for synthetic pointer events. */
    tilePoint(i) { const c = tileCentre(app.view, i), r = canvas.getBoundingClientRect(); return { x: r.left + c.x, y: r.top + c.y } },
    state() { const s = app.session; return s ? { screen: ui.screen, mode: app.mode, moves: s.moves, par: app.level.par, solved: s.solved, time: s.time, w: app.level.w, h: app.level.h, tile: app.view && app.view.tile, modal: ui.modalOpen } : { screen: ui.screen } },
  }
}
