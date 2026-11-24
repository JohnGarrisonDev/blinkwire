// DOM overlays inside the stage: title, level select, free-play setup, HUD, toolbar, modals, toasts.
// Pure view code: it renders what main.js tells it and reports clicks through `actions[name](dataset)`.
import { CHAPTERS, PER_CHAPTER, isUnlocked, levelLabel, journeyDef } from './logic/levels.js'

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
export const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  hint: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
  pin: svg('<path d="M12 16v6"/><path d="M8 3h8l-1 6 3 4v3H6v-3l3-4-1-6z"/>'),
  cw: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  ccw: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>'),
  restart: svg('<path d="M4 11a8 8 0 0 1 14-4.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 13a8 8 0 0 1-14 4.3L4 15"/><path d="M4 20v-5h5"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  minus: svg('<path d="M6 12h12"/>'),
  plus: svg('<path d="M6 12h12M12 6v12"/>'),
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const stars = (n, cls = '') => `<span class="stars ${cls}" aria-label="${n} of 3 stars">${[0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}">★</i>`).join('')}</span>`

export function createUI(root, actions) {
  root.innerHTML = `
  <section class="screen title" data-screen="title">
    <div class="title-head">
      <span class="eyebrow">An Oddvale wiring puzzle</span>
      <h2 class="wordmark">Blink<em>wire</em></h2>
      <p class="howto">Turn the tiles. Wire every sleepy eye back to the Big Eye.</p>
    </div>
    <div class="slot" data-slot="title"></div>
    <nav class="title-menu">
      <button class="bigbtn orange" data-act="journey"><b>Journey</b><span data-f="t-journey"></span></button>
      <button class="bigbtn yellow" data-act="daily"><b>Daily</b><span data-f="t-daily"></span></button>
      <button class="bigbtn mint" data-act="free"><b>Free play</b><span data-f="t-free"></span></button>
    </nav>
  </section>

  <section class="screen levels" data-screen="levels" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Journey</h2>
      <span class="total" data-f="l-total"></span>
    </header>
    <div class="chapter">
      <button class="iconbtn" data-act="chapter" data-d="-1" aria-label="Previous chapter">${ICON.back}</button>
      <div class="chapter-name"><span class="eyebrow" data-f="l-chno"></span><strong data-f="l-chname"></strong><span class="blurb" data-f="l-blurb"></span></div>
      <button class="iconbtn" data-act="chapter" data-d="1" aria-label="Next chapter">${ICON.next}</button>
    </div>
    <div class="level-grid" data-f="l-grid"></div>
    <div class="dots" data-f="l-dots"></div>
  </section>

  <section class="screen free" data-screen="free" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Free play</h2>
      <span class="total" data-f="f-total"></span>
    </header>
    <div class="free-body">
      <div class="stepper"><span class="lbl">Wide</span><button class="iconbtn" data-act="size" data-k="w" data-d="-1" aria-label="Narrower">${ICON.minus}</button><b data-f="f-w">6</b><button class="iconbtn" data-act="size" data-k="w" data-d="1" aria-label="Wider">${ICON.plus}</button></div>
      <div class="stepper"><span class="lbl">Tall</span><button class="iconbtn" data-act="size" data-k="h" data-d="-1" aria-label="Shorter">${ICON.minus}</button><b data-f="f-h">6</b><button class="iconbtn" data-act="size" data-k="h" data-d="1" aria-label="Taller">${ICON.plus}</button></div>
      <div class="switches">
        <button class="switch" data-act="opt" data-k="wrap" role="switch" aria-checked="false"><i></i><span><b>Wrap edges</b><small>Wires loop round the board. Harder.</small></span></button>
        <button class="switch" data-act="opt" data-k="lock" role="switch" aria-checked="false"><i></i><span><b>Bolted tiles</b><small>A few fixed anchors. Kinder.</small></span></button>
      </div>
      <p class="note" data-f="f-note"></p>
      <div class="row">
        <button class="btn primary" data-act="free-start">New board</button>
        <button class="btn" data-act="free-resume" data-f="f-resume" hidden>Continue</button>
      </div>
    </div>
  </section>

  <section class="play" data-screen="play" hidden>
    <div class="hud">
      <div class="hud-top">
        <button class="iconbtn" data-act="menu" aria-label="Menu" title="Menu (Esc)">${ICON.menu}</button>
        <div class="lv"><div class="lv-top"><span class="eyebrow" data-f="p-mode"></span><span class="chips" data-f="p-chips"></span></div><strong data-f="p-name"></strong></div>
      </div>
      <div class="stats">
        <div class="stat"><b data-f="p-moves">0</b><span><em>moves · </em>par <i data-f="p-par">0</i></span></div>
        <div class="stat"><b data-f="p-lamps">0/0</b><span>eyes lit</span></div>
        <div class="stat time" data-f="p-timebox"><b data-f="p-time">0:00</b><span>time</span></div>
      </div>
      <p class="tip" data-f="p-tip" hidden></p>
    </div>
    <div class="slot" data-slot="play"></div>
    <div class="tools">
      <button class="tool" data-act="undo" title="Undo (Z)">${ICON.undo}<span>Undo</span></button>
      <button class="tool" data-act="hint" title="Hint (H)">${ICON.hint}<span>Hint</span></button>
      <button class="tool" data-act="pinmode" aria-pressed="false" title="Pin mode: tap tiles to pin them (P pins the selected tile)">${ICON.pin}<span>Pin</span></button>
      <button class="tool" data-act="ccw" aria-pressed="false" title="Turn direction"><span class="ico" data-f="p-dir">${ICON.cw}</span><span>Turn</span></button>
      <button class="tool" data-act="restart" title="Restart (R)">${ICON.restart}<span>Restart</span></button>
    </div>
  </section>

  <div class="modal" data-f="modal" hidden><div class="sheet" role="dialog" aria-modal="true" data-f="sheet"></div></div>
  <div class="toast" data-f="toast" role="status" aria-live="polite" hidden></div>`

  const f = (name) => root.querySelector(`[data-f="${name}"]`)
  const screens = [...root.querySelectorAll('[data-screen]')]
  let current = 'title', toastTimer = 0

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || el.disabled || !root.contains(el)) return
    // a mouse click leaves focus on the button; give it back so Space keeps turning tiles
    if (e.detail > 0 && current === 'play' && !el.closest('.modal')) el.blur()
    actions[el.dataset.act]?.(el.dataset, el)
  })

  const ui = {
    get screen() { return current },
    show(name) {
      current = name
      for (const s of screens) s.hidden = s.dataset.screen !== name
    },
    focusFirst() {
      const scope = !f('modal').hidden ? f('sheet') : screens.find((s) => !s.hidden)
      const el = scope?.querySelector('.btn.primary:not([hidden]), .bigbtn, .lvl.next, .lvl:not([disabled])')
      el?.focus({ preventScroll: true })
    },
    /** Rect of a board slot relative to the stage, in CSS px. */
    slot(name, stage) {
      const el = root.querySelector(`[data-slot="${name}"]`), a = el.getBoundingClientRect(), b = stage.getBoundingClientRect()
      return { x: a.left - b.left - stage.clientLeft, y: a.top - b.top - stage.clientTop, w: a.width, h: a.height }
    },

    setTitle({ journey, daily, free }) { f('t-journey').textContent = journey; f('t-daily').textContent = daily; f('t-free').textContent = free },

    setLevels({ chapter, starList, total, resume }) {
      const ch = CHAPTERS[chapter]
      f('l-total').innerHTML = `<i class="star">★</i> ${total} / ${CHAPTERS.length * PER_CHAPTER * 3}`
      f('l-chno').textContent = `Chapter ${chapter + 1} of ${CHAPTERS.length}`
      f('l-chname').textContent = ch.name
      f('l-blurb').textContent = ch.blurb
      const firstOpen = starList.findIndex((s, i) => !s && isUnlocked(starList, i))
      let html = ''
      for (let n = 0; n < PER_CHAPTER; n++) {
        const i = chapter * PER_CHAPTER + n, open = isUnlocked(starList, i), def = journeyDef(i), st = starList[i] | 0
        const cls = ['lvl', st ? 'done' : '', i === firstOpen ? 'next' : '', open ? '' : 'locked'].join(' ')
        html += `<button class="${cls}" data-act="level" data-i="${i}" ${open ? '' : 'disabled'} aria-label="Level ${levelLabel(i)}, ${def.w} by ${def.h}${def.wrap ? ', wrap' : ''}${open ? `, ${st} stars` : ', locked'}">`
          + (open ? `<b>${n + 1}</b>${stars(st)}<small>${def.w}×${def.h}${def.wrap ? ' ∞' : ''}${i === resume ? ' · …' : ''}</small>` : `${ICON.lock}<small>${def.w}×${def.h}</small>`) + '</button>'
      }
      f('l-grid').innerHTML = html
      f('l-dots').innerHTML = CHAPTERS.map((_, c) => `<button class="${c === chapter ? 'on' : ''}" data-act="chapter-go" data-c="${c}" aria-label="Chapter ${c + 1}"></button>`).join('')
      const [prev, next] = root.querySelectorAll('.chapter > .iconbtn')
      prev.disabled = chapter === 0; next.disabled = chapter === CHAPTERS.length - 1
    },

    setFree({ w, h, wrap, lock, solved, maxW, maxH, min, resume, note }) {
      f('f-w').textContent = w; f('f-h').textContent = h
      f('f-total').textContent = solved ? `${solved} solved` : ''
      for (const b of root.querySelectorAll('.free .stepper .iconbtn')) {
        const v = b.dataset.k === 'w' ? w : h, max = b.dataset.k === 'w' ? maxW : maxH
        b.disabled = b.dataset.d === '1' ? v >= max : v <= min
      }
      for (const b of root.querySelectorAll('.free .switch')) b.setAttribute('aria-checked', String(b.dataset.k === 'wrap' ? wrap : lock))
      f('f-note').textContent = note || ''
      const r = f('f-resume'); r.hidden = !resume; if (resume) r.textContent = `Continue ${resume}`
    },

    setPlay({ mode, name, par, tip, chips }) {
      f('p-mode').textContent = mode; f('p-name').textContent = name; f('p-par').textContent = par
      f('p-chips').innerHTML = (chips || []).map((c) => `<span class="tag ${c.cls || ''}">${esc(c.text)}</span>`).join('')
      ui.setTip(tip)
    },
    setTip(tip) { const t = f('p-tip'); t.hidden = !tip; t.textContent = tip || '' },
    setHud({ moves, lit, total, over }) {
      const m = f('p-moves'); m.textContent = moves; m.classList.toggle('over', !!over)
      f('p-lamps').textContent = `${lit}/${total}`
      root.querySelector('.stats').classList.toggle('tight', String(moves).length + f('p-par').textContent.length > 4)
    },
    setTime(text) { f('p-time').textContent = text },
    setTimerVisible(on) { f('p-timebox').hidden = !on },
    setTools({ pinMode, ccw, canUndo }) {
      const q = (a) => root.querySelector(`.tools [data-act="${a}"]`)
      q('pinmode').setAttribute('aria-pressed', String(!!pinMode))
      q('ccw').setAttribute('aria-pressed', String(!!ccw))
      f('p-dir').innerHTML = ccw ? ICON.ccw : ICON.cw
      q('undo').disabled = !canUndo
    },

    get modalOpen() { return !f('modal').hidden },
    closeModal() { f('modal').hidden = true; f('sheet').innerHTML = ''; f('modal').className = 'modal' },
    openModal(html, cls = '') { f('sheet').innerHTML = html; f('modal').className = `modal ${cls}`; f('modal').hidden = false; ui.focusFirst() },

    openPause({ title, timer, items }) {
      ui.openModal(`
        <h3>${esc(title)}</h3>
        <div class="col">${items.map((b) => `<button class="btn ${b.primary ? 'primary' : ''}" data-act="${b.act}">${esc(b.label)}</button>`).join('')}</div>
        <button class="switch" data-act="timer" role="switch" aria-checked="${timer}"><i></i><span><b>Show timer</b><small>Hide it for a calmer game.</small></span></button>
        <p class="keys"><kbd>Space</kbd> turn · <kbd>Shift</kbd>+<kbd>Space</kbd> turn back · <kbd>Z</kbd> undo · <kbd>H</kbd> hint · <kbd>P</kbd> pin</p>`, 'pause')
    },
    openConfirm({ title, text, yes, act }) {
      ui.openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="row"><button class="btn primary" data-act="${act}">${esc(yes)}</button><button class="btn" data-act="resume">Keep going</button></div>`, 'confirm')
    },
    /** d: { heading, sub, stars, animate, lines: [[label, value]], notes: [text], daily: { streak, best, days: [{ letter, stars, today }] }, buttons: [{ act, label, primary }] } */
    openSolved(d) {
      const daily = d.daily ? `
        <div class="streak"><div><b>${d.daily.streak}</b><span>day streak</span></div><div><b>${d.daily.best}</b><span>best</span></div></div>
        <div class="days">${d.daily.days.map((x) => `<div class="day ${x.stars ? 'on' : ''} ${x.today ? 'today' : ''}"><span>${x.letter}</span><i>${x.stars ? '★'.repeat(x.stars) : '·'}</i></div>`).join('')}</div>` : ''
      ui.openModal(`
        <span class="eyebrow">${esc(d.sub)}</span>
        <h3>${esc(d.heading)}</h3>
        ${stars(d.stars, d.animate ? 'big pop' : 'big')}
        <dl class="result">${d.lines.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${d.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
        ${daily}
        <div class="row">${d.buttons.map((b) => `<button class="btn ${b.primary ? 'primary' : 'small'}" data-act="${b.act}">${esc(b.label)}</button>`).join('')}</div>`, 'solved')
    },

    toast(text, ms = 2200) {
      const t = f('toast'); t.textContent = text; t.hidden = false
      t.classList.remove('in'); void t.offsetWidth; t.classList.add('in')
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true }, ms)
    },
  }
  return ui
}
