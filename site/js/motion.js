import { spring, settleTime, SPRING } from './spring.js';

const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
export const reduced = () => mq.matches;
let live = false;
export const goLive = () => { live = true; };
const now = () => performance.now() / 1000;
const isPreset = (o) => o && typeof o.stiffness === 'number';

const easings = new Map();
export function easing(preset = SPRING.snappy) {
  const key = `${preset.stiffness}|${preset.damping}`;
  if (!easings.has(key)) {
    const p = spring(preset), T = settleTime(p, 2e-3), pts = [];
    for (let i = 0; i <= 40; i++) pts.push(+p((T * i) / 40).toFixed(4));
    easings.set(key, { easing: `linear(${pts.join(',')})`, duration: Math.round(T * 1000) });
  }
  return easings.get(key);
}

export class Springs {
  constructor(values, onFrame) {
    this.k = {};
    for (const [key, v] of Object.entries(values)) this.k[key] = { from: v, to: v, t0: 0, p: null, T: 0 };
    this.onFrame = onFrame;
    this.raf = 0;
    this.tick = this.tick.bind(this);
    this.kick();
  }
  value(key, t = now()) {
    const s = this.k[key];
    if (!s.p || t - s.t0 >= s.T) return s.to;
    return s.from + (s.to - s.from) * s.p(t - s.t0);
  }
  velocity(key, t = now()) {
    const s = this.k[key];
    if (!s.p || t - s.t0 >= s.T) return 0;
    const dt = t - s.t0;
    return ((s.to - s.from) * (s.p(dt + 1e-3) - s.p(dt))) / 1e-3;
  }
  get values() { const t = now(), o = {}; for (const key in this.k) o[key] = this.value(key, t); return o; }
  to(targets, preset = SPRING.smooth) {
    const t = now();
    for (const [key, target] of Object.entries(targets)) {
      const s = this.k[key] ??= { from: target, to: target, t0: 0, p: null, T: 0 };
      const cur = this.value(key, t), vel = this.velocity(key, t), d = target - cur;
      if (reduced() || (Math.abs(d) < 1e-4 && Math.abs(vel) < 1e-3)) { Object.assign(s, { from: target, to: target, p: null }); continue; }
      const pr = isPreset(preset) ? preset : preset[key] ?? preset.default ?? SPRING.smooth;
      const p = spring({ ...pr, velocity: vel / d });
      Object.assign(s, { from: cur, to: target, t0: t, p, T: settleTime(p) });
    }
    reduced() ? this.now() : this.kick();
    return this;
  }
  set(values) {
    for (const [key, v] of Object.entries(values)) this.k[key] = { from: v, to: v, t0: 0, p: null, T: 0 };
    this.now();
    return this;
  }
  now() { cancelAnimationFrame(this.raf); this.raf = 0; this.tick(); }
  kick() { if (!this.raf) this.raf = requestAnimationFrame(this.tick); }
  tick() {
    this.raf = 0;
    const t = now();
    let active = false;
    for (const key in this.k) { const s = this.k[key]; if (s.p && t - s.t0 < s.T) active = true; else s.p = null; }
    this.onFrame(this.values);
    if (active) this.kick();
  }
}

export function swap(el, text, dir = 1) {
  text = String(text);
  if (el.textContent === text) return;
  const visible = el.isConnected && el.offsetParent !== null && el.textContent !== '';
  if (!live || reduced() || !visible || !el.animate) { el.textContent = text; return; }
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const ghost = el.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    margin: '0', pointerEvents: 'none', zIndex: '70', font: cs.font, color: cs.color, letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign, whiteSpace: 'nowrap', overflow: 'visible', display: 'block', padding: cs.padding, boxSizing: cs.boxSizing,
  });
  document.body.append(ghost);
  const off = `${0.35 * dir}em`;
  ghost.animate([
    { opacity: 1, filter: 'blur(0)', transform: 'none' },
    { opacity: 0, filter: 'blur(5px)', transform: `translateY(calc(-1 * ${off}))` },
  ], { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' }).onfinish = () => ghost.remove();
  el.textContent = text;
  const e = easing(SPRING.ui);
  el.animate([
    { opacity: 0, filter: 'blur(5px)', transform: `translateY(${off})` },
    { opacity: 1, filter: 'blur(0)', transform: 'none' },
  ], { duration: e.duration, easing: e.easing, delay: 50, fill: 'backwards' });
}

function crossfade(from, to) {
  if (from && from !== to) {
    from.setAttribute('inert', '');
    if (reduced() || !from.animate) from.style.opacity = 0;
    else from.animate([{ opacity: 1, filter: 'blur(0)', scale: 1 }, { opacity: 0, filter: 'blur(6px)', scale: 0.97 }],
      { duration: 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  }
  if (to) {
    to.removeAttribute('inert');
    to.getAnimations?.().forEach((a) => a.cancel());
    to.style.opacity = 1;
    if (!reduced() && to.animate && from !== to) {
      const e = easing(SPRING.ui);
      to.animate([{ opacity: 0, filter: 'blur(6px)', scale: 0.97 }, { opacity: 1, filter: 'blur(0)', scale: 1 }],
        { duration: e.duration, easing: e.easing, delay: 70, fill: 'backwards' });
    }
  }
}

let probe = null;
function rgb(color) {
  if (!probe) { probe = document.createElement('i'); probe.style.display = 'none'; document.body.append(probe); }
  probe.style.color = '';
  probe.style.color = color.trim();
  return (getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
}

export function morph(shape, states, { dark = '--island', light = '--surface' } = {}) {
  let cur = null;
  const layers = Object.values(states).map((s) => s.layer);
  layers.forEach((l) => { l.style.opacity = 0; l.setAttribute('inert', ''); });
  const colours = () => {
    const cs = getComputedStyle(shape);
    return [rgb(cs.getPropertyValue(dark) || '#000'), rgb(cs.getPropertyValue(light) || '#fff')];
  };
  let pal = null;
  const sp = new Springs({ w: 0, h: 0, r: 0, light: 0 }, (v) => {
    pal ||= colours();
    const [a, b] = pal, k = Math.min(1, Math.max(0, v.light));
    shape.style.width = `${Math.max(0, v.w)}px`;
    shape.style.height = `${Math.max(0, v.h)}px`;
    shape.style.borderRadius = `${Math.max(0, v.r)}px`;
    shape.style.backgroundColor = `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * k)).join(',')})`;
  });
  function size(st) {
    const l = st.layer;
    if (st.width) l.style.width = `${typeof st.width === 'function' ? st.width() : st.width}px`;
    return { w: l.offsetWidth, h: l.offsetHeight };
  }
  const api = {
    get state() { return cur; },
    to(name, preset = { w: SPRING.snappy, h: SPRING.snappy, r: SPRING.snappy, light: SPRING.ui }) {
      const st = states[name], prev = cur && states[cur];
      pal = colours();
      const { w, h } = size(st);
      const r = st.radius ?? h / 2;
      if (!cur) sp.set({ w, h, r, light: st.light ?? 0 });
      else sp.to({ w, h, r, light: st.light ?? 0 }, preset);
      if (name !== cur) crossfade(prev?.layer, st.layer);
      cur = name;
      shape.dataset.state = name;
      return api;
    },
  };
  const ro = new ResizeObserver((entries) => {
    if (cur && entries.some((e) => e.target === states[cur].layer)) api.to(cur);
  });
  layers.forEach((l) => ro.observe(l));
  return api;
}
