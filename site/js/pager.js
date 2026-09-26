import { spring, settleTime, fromApple } from './spring.js';
import { reduced } from './motion.js';

const GLIDE = fromApple(0.55, 0);
const QUIET = 170;
const START = 16;
const EDGE = 2;
const NEAR = 12;

export function createPager({ screens, blocked = () => false }) {
  const root = document.documentElement;
  if (matchMedia('(hover: none), (pointer: coarse)').matches) {
    const toElement = (el) => scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - 72), behavior: reduced() ? 'auto' : 'smooth' });
    document.addEventListener('click', (e) => {
      const a = e.target.closest?.('a[href^="#"]');
      const el = a && a.hash.length > 1 && document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!el) return;
      e.preventDefault();
      toElement(el);
    });
    return { glide: (y) => scrollTo({ top: y, behavior: 'smooth' }), toElement, step() {}, get gliding() { return false; } };
  }
  const maxY = () => root.scrollHeight - innerHeight;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function tops() {
    const m = maxY(), out = [];
    for (const y of screens().sort((a, b) => a - b)) {
      const v = clamp(y, 0, m);
      if (!out.length || v - out.at(-1) > EDGE) out.push(v);
    }
    return out.length ? out : [0];
  }
  const at = (T, y) => { let i = 0; while (i + 1 < T.length && T[i + 1] <= y + EDGE) i++; return i; };
  const bottom = (T, i) => (i + 1 < T.length ? T[i + 1] - innerHeight : maxY());

  function plan(dir, y) {
    const T = tops(), i = at(T, y), b = Math.max(T[i], bottom(T, i)), tall = b > T[i] + EDGE;
    if (dir > 0) {
      if (tall && y < b - EDGE) return { kind: 'inside', to: b };
      return i + 1 < T.length ? { kind: 'page', to: T[i + 1] } : { kind: 'none' };
    }
    if (y > T[i] + EDGE) return tall ? { kind: 'inside', to: T[i] } : { kind: 'page', to: T[i] };
    return i > 0 ? { kind: 'page', to: Math.max(T[i - 1], bottom(T, i - 1)) } : { kind: 'none' };
  }

  let anim = null, lastSet = null;
  const set = (y) => { lastSet = y; scrollTo({ top: y, behavior: 'instant' }); };
  const snap = (on) => { root.style.scrollSnapType = on ? '' : 'none'; };
  const velocity = () => {
    if (!anim) return 0;
    const t = (performance.now() - anim.t0) / 1000;
    return t >= anim.T ? 0 : anim.dist * (anim.p(t + 1e-3) - anim.p(t)) / 1e-3;
  };
  function stop() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; snap(true); } }
  function glide(to) {
    to = clamp(to, 0, maxY());
    const v = velocity(), from = scrollY, dist = to - from;
    stop();
    if (reduced() || Math.abs(dist) < 1) { set(to); return; }
    const p = spring({ ...GLIDE, velocity: v / dist }), T = settleTime(p, 2e-4), t0 = performance.now();
    snap(false);
    anim = { to, dist, p, T, t0, raf: 0 };
    const frame = (now) => {
      if (!anim) return;
      const t = (now - t0) / 1000;
      if (t >= T) { set(to); anim = null; snap(true); return; }
      set(from + dist * p(t));
      anim.raf = requestAnimationFrame(frame);
    };
    anim.raf = requestAnimationFrame(frame);
  }
  const busy = () => anim && Math.abs(anim.to - scrollY) > NEAR;
  addEventListener('scroll', () => { if (anim && lastSet !== null && Math.abs(scrollY - lastSet) > 3) stop(); }, { passive: true });

  function step(dir, size) {
    const y = anim ? anim.to : scrollY, go = plan(dir, y);
    if (go.kind === 'page') glide(go.to);
    else if (go.kind === 'inside') glide(dir > 0 ? Math.min(go.to, y + size) : Math.max(go.to, y - size));
  }

  let last = -Infinity, sum = 0, spent = false, hist = [];
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || blocked(e)) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const dy = e.deltaY * unit, dx = e.deltaX * unit;
    if (Math.abs(dx) > Math.abs(dy) || !dy) return;
    const now = performance.now(), gap = now - last, mag = Math.abs(dy);
    last = now;
    const flick = spent && !busy() && hist.length >= 3 && mag > 20 && mag > 2 * Math.max(...hist.slice(-3));
    if (gap > QUIET || flick) { sum = 0; spent = false; hist = []; }
    hist.push(mag);
    if (hist.length > 6) hist.shift();
    if (busy() || spent) { e.preventDefault(); spent = true; return; }
    const dir = Math.sign(dy), go = plan(dir, scrollY);
    if (go.kind === 'none') return;
    if (go.kind === 'inside') {
      sum = 0;
      if (dir > 0 ? scrollY + dy < go.to - EDGE : scrollY + dy > go.to + EDGE) return;
      e.preventDefault();
      glide(go.to);
      spent = true;
      return;
    }
    e.preventDefault();
    if (Math.sign(sum) !== dir) sum = 0;
    sum += dy;
    if (Math.abs(sum) >= START) { glide(go.to); spent = true; sum = 0; }
  }, { passive: false });

  addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || blocked(e)) return;
    const k = e.key, h = innerHeight;
    if (k === ' ' && e.target.closest?.('button, summary, [role=button], [role=option]')) return;
    if (k === 'PageDown' || (k === ' ' && !e.shiftKey)) step(1, h * 0.85);
    else if (k === 'PageUp' || (k === ' ' && e.shiftKey)) step(-1, h * 0.85);
    else if (k === 'ArrowDown' && !e.shiftKey) step(1, h * 0.3);
    else if (k === 'ArrowUp' && !e.shiftKey) step(-1, h * 0.3);
    else if (k === 'Home') glide(0);
    else if (k === 'End') glide(maxY());
    else return;
    e.preventDefault();
  });

  function toElement(el) {
    const T = tops(), y = el.getBoundingClientRect().top + scrollY, i = at(T, y);
    glide(clamp(y - 80, T[i], Math.max(T[i], bottom(T, i))));
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = a.hash.length > 1 && document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    toElement(el);
    history.replaceState(history.state, '', a.hash);
  });

  let restT = 0, resizeT = 0, onTop = -1, keep = null, width = innerWidth;
  const remember = () => { const T = tops(), i = at(T, scrollY); onTop = Math.abs(T[i] - scrollY) <= EDGE ? i : -1; };
  addEventListener('scroll', () => { clearTimeout(restT); restT = setTimeout(() => { if (!anim && keep === null) remember(); }, 100); }, { passive: true });
  addEventListener('resize', () => {
    if (innerWidth === width) return;
    width = innerWidth;
    keep ??= anim ? at(tops(), anim.to) : onTop;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (keep >= 0 && !anim) { const T = tops(); set(T[Math.min(keep, T.length - 1)]); }
      keep = null;
    }, 150);
  });
  remember();

  return { glide, toElement, step, get gliding() { return !!anim; } };
}
