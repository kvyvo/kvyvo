// The hero picture borrows kalka's idea: a sheet lies on a screen, the screen glows through
// the paper under one part at a time. Here the sheet has four parts: one per kind of work,
// each shown by a real project.
// Each part is a link to its project card.
import { SPRING, fromApple } from './spring.js';
import { Springs, swap, reduced } from './motion.js';
import { t } from './i18n.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.append(e);
  return e;
};
const text = (parent, x, y, s, cls, attrs = {}) => { const e = el('text', { x, y, class: cls, ...attrs }, parent); e.textContent = s; return e; };
const check = (parent, x, y, r = 7) => {
  const g = el('g', { class: 'h-tick', transform: `translate(${x} ${y})` }, parent);
  el('circle', { r }, g);
  el('path', { d: `M${-r * 0.42} ${r * 0.05}l${r * 0.3} ${r * 0.3} ${r * 0.56} ${-r * 0.62}` }, g);
  return g;
};

export const PROJECTS = [
  { id: 'kalka', short: 'hp0' },
  { id: 'nickcheck', short: 'hp1' },
  { id: 'whoami-bot', short: 'hp2' },
  { id: 'books-scraper', short: 'hp3' },
];

/* the four drawings, each in its own 260 × 185 part */
function kalka(g) {
  el('rect', { class: 'h-ink', x: 52, y: 30, width: 156, height: 104, rx: 9 }, g);
  el('path', { class: 'h-ink', d: 'M36 142h188l-10 13H46z' }, g);
  const x0 = 64, y0 = 42, w = 132, h = 80;
  el('rect', { class: 'h-cellhi', x: x0 + w / 3, y: y0, width: w / 3, height: h / 2, rx: 3 }, g);
  const grid = el('g', { class: 'h-red' }, g);
  for (let i = 0; i <= 3; i++) el('line', { x1: x0 + (i * w) / 3, y1: y0, x2: x0 + (i * w) / 3, y2: y0 + h }, grid);
  for (let j = 0; j <= 2; j++) el('line', { x1: x0, y1: y0 + (j * h) / 2, x2: x0 + w, y2: y0 + (j * h) / 2 }, grid);
  el('path', { class: 'h-stem', d: 'M74 116C98 110 122 96 140 80S176 54 190 50' }, g);
  for (const [x, y, r] of [[112, 97, -30], [140, 80, -60], [164, 60, -20], [128, 90, 150]]) {
    el('path', { class: 'h-leaf', d: 'M0 0q8-11 19-9q-4 11-19 9z', transform: `translate(${x} ${y}) rotate(${r})` }, g);
  }
  for (const [x, y] of [[176, 56], [181, 61]]) el('circle', { class: 'h-berry', cx: x, cy: y, r: 3.2 }, g);
}

function nickcheck(g) {
  text(g, 38, 56, 'kvaro', 'h-mono h-big');
  el('rect', { class: 'h-caret', x: 128, y: 34, width: 2.5, height: 28, rx: 1 }, g);
  ['github', 'npm', 'pypi', 't.me'].forEach((s, i) => {
    const y = 88 + i * 23;
    text(g, 40, y + 4, s, 'h-mono h-small');
    el('line', { class: 'h-lead', x1: 92, y1: y, x2: 196, y2: y }, g);
    check(g, 214, y, 7.5);
  });
}

function whoami(g) {
  // the command goes out, the card comes back
  const pill = el('g', { transform: 'translate(176 22)' }, g);
  el('rect', { class: 'h-pill', width: 50, height: 22, rx: 11 }, pill);
  text(pill, 25, 15.5, '/me', 'h-mono h-pilltext', { 'text-anchor': 'middle' });
  const die = el('g', { transform: 'translate(142 20)' }, g);
  el('rect', { class: 'h-ink', width: 24, height: 24, rx: 6.5 }, die);
  for (const [x, y] of [[7.5, 7.5], [12, 12], [16.5, 16.5]]) el('circle', { class: 'h-dot', cx: x, cy: y, r: 2 }, die);
  el('path', { class: 'h-bubble', d: 'M50 54h146a14 14 0 0 1 14 14v70a14 14 0 0 1-14 14H60l-14 12v-12.6A14 14 0 0 1 36 138V68a14 14 0 0 1 14-14z' }, g);
  const rows = [['id', '777 000'], ['lang', 'ru'], ['premium', '—'], ['photo', '1']];
  rows.forEach(([k, v], i) => {
    const y = 72 + i * 22;
    text(g, 50, y + 4, k, 'h-mono h-small h-dim');
    text(g, 196, y + 4, v, 'h-mono h-small', { 'text-anchor': 'end' });
    if (i < rows.length - 1) el('line', { class: 'h-rule', x1: 50, y1: y + 11, x2: 196, y2: y + 11 }, g);
  });
}

function books(g, rowsLabel) {
  el('rect', { class: 'h-ink', x: 34, y: 20, width: 192, height: 124, rx: 10 }, g);
  el('path', { class: 'h-head', d: 'M34 30a10 10 0 0 1 10-10h172a10 10 0 0 1 10 10v14H34z' }, g);
  text(g, 44, 36, 'title', 'h-mono h-tiny h-dim');
  text(g, 148, 36, 'price', 'h-mono h-tiny h-dim');
  for (const x of [140, 192]) el('line', { class: 'h-rule', x1: x, y1: 20, x2: x, y2: 144 }, g);
  const prices = ['51.77', '53.74', '50.10', '47.82'];
  [74, 58, 82, 64].forEach((w, i) => {
    const y = 44 + i * 25;
    el('line', { class: 'h-rule', x1: 34, y1: y, x2: 226, y2: y }, g);
    el('rect', { class: 'h-bar', x: 44, y: y + 10, width: w, height: 5.5, rx: 2.75 }, g);
    text(g, 148, y + 16.5, `£${prices[i]}`, 'h-mono h-tiny');
    check(g, 209, y + 12.5, 5.5);
  });
  return text(g, 130, 168, rowsLabel, 'h-mono h-small h-dim', { 'text-anchor': 'middle' });
}

export function hero(svg, caption) {
  const W = 600, H = 430, sx = 40, sy = 30, sw = 520, sh = 370;
  const COLS = 2, ROWS = 2, cw = sw / COLS, ch = sh / ROWS, PAD = 14, N = PROJECTS.length;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // the screen under the paper: seen faintly through the sheet, it lights one part
  const screen = el('rect', { class: 'h-screen', rx: 16, width: cw + 2 * PAD, height: ch + 2 * PAD }, svg);
  el('rect', { class: 'h-sheet', x: sx, y: sy, width: sw, height: sh, rx: 4 }, svg);

  const draw = [kalka, nickcheck, whoami, books];
  let rowsText = null;
  const parts = PROJECTS.map((p, n) => {
    const a = el('a', { href: `#p-${p.id}`, class: 'h-part', 'aria-label': p.id }, svg);
    a.dataset.n = n;
    el('rect', { class: 'h-hit', x: sx + (n % COLS) * cw, y: sy + Math.floor(n / COLS) * ch, width: cw, height: ch }, a);
    const g = el('g', { class: 'h-art', transform: `translate(${sx + (n % COLS) * cw} ${sy + Math.floor(n / COLS) * ch})` }, a);
    const r = draw[n](g, t('hRows'));
    if (r) rowsText = r;
    return { a, g };
  });

  const grid = el('g', { class: 'h-grid' }, svg);
  for (let i = 0; i <= COLS; i++) el('line', { x1: sx + i * cw, y1: sy, x2: sx + i * cw, y2: sy + sh }, grid);
  for (let j = 0; j <= ROWS; j++) el('line', { x1: sx, y1: sy + j * ch, x2: sx + sw, y2: sy + j * ch }, grid);
  const frame = el('rect', { class: 'h-frame', rx: 12, width: cw - 8, height: ch - 8 }, svg);
  const checks = PROJECTS.map((_, n) => {
    const g = el('g', { class: 'h-check', transform: `translate(${sx + (n % COLS + 1) * cw - 18} ${sy + Math.floor(n / COLS) * ch + 18})` }, svg);
    const inner = el('g', {}, g);
    el('circle', { r: 11 }, inner);
    el('path', { d: 'M-4.5 0.5l3 3 6-6.5' }, inner);
    return inner;
  });

  const pos = (n) => ({ x: sx + (n % COLS) * cw, y: sy + Math.floor(n / COLS) * ch });
  const sp = new Springs({ ...pos(0), glow: 1 }, ({ x, y, glow }) => {
    screen.setAttribute('x', x - PAD); screen.setAttribute('y', y - PAD);
    screen.style.opacity = 0.05 + 0.1 * glow;
    frame.setAttribute('x', x + 4); frame.setAttribute('y', y + 4);
  });
  // each part: lit (1), traced and done (0.55, pencil grey) or waiting (0.22)
  const lit = new Springs(Object.fromEntries(parts.flatMap((_, n) => [[`o${n}`, n ? 0.22 : 1], [`c${n}`, 0]])), (v) => {
    parts.forEach((p, n) => { p.g.style.opacity = v[`o${n}`]; });
    checks.forEach((c, n) => {
      const s = Math.max(0, v[`c${n}`]);
      c.setAttribute('transform', `scale(${s})`);
      c.style.opacity = Math.min(1, s);
    });
  });

  let cur = 0;
  const say = (n) => caption && swap(caption, t('heroPart', { name: PROJECTS[n].id, svc: t(`sv${n}`), n: n + 1, N }));
  const mark = (n, done) => parts.forEach((p, i) => p.g.classList.toggle('done', i !== n && done.has(i)));
  function focus(n, done) {
    cur = n;
    const p = pos(n);
    say(n);
    sp.to(p, SPRING.smooth);
    sp.to({ glow: 0.4 }, SPRING.quick);
    lit.to(Object.fromEntries(parts.map((_, i) => [`o${i}`, i === n ? 1 : done.has(i) ? 0.55 : 0.22])), SPRING.smooth);
    mark(n, done);
  }
  if (caption) caption.textContent = t('heroPart', { name: PROJECTS[0].id, svc: t('sv0'), n: 1, N });

  const api = {
    /** Language changed: redraw the words inside the picture. */
    relabel() {
      if (rowsText) rowsText.textContent = t('hRows');
      if (caption) caption.textContent = t('heroPart', { name: PROJECTS[cur].id, svc: t(`sv${cur}`), n: cur + 1, N });
    },
  };

  if (reduced()) { // a still that tells the same story
    focus(1, new Set([0]));
    lit.set({ c0: 1 });
    sp.set({ ...pos(1), glow: 1 });
    return api;
  }

  // the loop: move → glow → check → next; hovering a part takes the frame there
  let n = 0, timer = 0, running = false, done = new Set(), hold = false;
  const step = () => {
    if (!running || hold) return;
    focus(n, done);
    timer = setTimeout(() => {
      sp.to({ glow: 1 }, SPRING.ui);
      timer = setTimeout(() => {
        lit.to({ [`c${n}`]: 1 }, fromApple(0.4, 0.12));
        done.add(n);
        timer = setTimeout(() => {
          n++;
          if (n < N) return step();
          timer = setTimeout(() => { // all four seen: lift the checks and start again
            lit.to(Object.fromEntries(checks.map((_, i) => [`c${i}`, 0])), SPRING.smooth);
            done = new Set();
            n = 0;
            timer = setTimeout(step, 450);
          }, 1100);
        }, 900);
      }, 700);
    }, 520);
  };
  const play = (on) => {
    if (on === running) return;
    running = on;
    clearTimeout(timer);
    if (on) step();
  };
  parts.forEach(({ a }, i) => {
    const enter = () => { hold = true; clearTimeout(timer); focus(i, done); sp.to({ glow: 1 }, SPRING.ui); };
    const leave = () => { hold = false; n = i; clearTimeout(timer); if (running) timer = setTimeout(step, 900); };
    a.addEventListener('pointerenter', enter);
    a.addEventListener('focus', enter);
    a.addEventListener('pointerleave', leave);
    a.addEventListener('blur', leave);
  });
  const io = new IntersectionObserver(([e]) => play(e.isIntersecting && !document.hidden), { threshold: 0.2 });
  io.observe(svg);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) play(false);
    else { const r = svg.getBoundingClientRect(); play(r.bottom > 0 && r.top < innerHeight); }
  });
  return api;
}
