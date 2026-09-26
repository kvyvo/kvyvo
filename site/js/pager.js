// Screen by screen. The page is a stack of screens (hero, 01, 02, 03, 03 more, 04); one wheel or trackpad
// gesture, one key press or one link moves exactly one of them, and the page glides there on a spring.
//
// css scroll-snap was tried first: `mandatory` pulls a gentle trackpad scroll back where it started, and a hard
// flick can fly past a screen. so with a mouse or a trackpad the page is driven from here:
//  - a gesture turns the page as soon as it has travelled START px, then everything else it sends is swallowed:
//    during the glide, and after it until the wheel goes quiet for QUIET ms (trackpad inertia keeps sending
//    events for a second or more) or a new flick clearly out-pushes the dying inertia;
//  - a screen taller than the window (a phone, a small laptop) scrolls natively inside; only a gesture that
//    starts at its bottom (or top) turns the page, and inertia stops at its edge instead of spilling over;
//  - keys: page down / space / arrow down and their opposites move a screen (or a step inside a tall one),
//    home and end go to the ends; links to #anchors glide with the same spring.
// on touch-first devices (phones, tablets) swipes are left to the browser, with `scroll-snap-type: y mandatory`
// in site.css: native momentum, rubber-banding and the collapsing address bar stay intact, which a script
// could only fake by cancelling touchmove; there the complaint about gentle trackpad scrolls doesn't apply.
import { spring, settleTime, fromApple } from './spring.js';
import { reduced } from './motion.js';

const GLIDE = fromApple(0.55, 0); // no bounce: the page never runs past the screen it lands on
const QUIET = 170; // ms of wheel silence that end a gesture
const START = 16; // px a gesture travels before it turns the page: a stray nudge doesn't
const EDGE = 2; // px: this close to a screen's edge is on it
const NEAR = 12; // px left of a glide: close enough that a new gesture may start the next one

export function createPager({ screens, blocked = () => false }) {
  const root = document.documentElement;
  const maxY = () => root.scrollHeight - innerHeight;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** screen tops, clamped to what can be scrolled, in order, without duplicates */
  function tops() {
    const m = maxY(), out = [];
    for (const y of screens().sort((a, b) => a - b)) {
      const v = clamp(y, 0, m);
      if (!out.length || v - out.at(-1) > EDGE) out.push(v);
    }
    return out.length ? out : [0];
  }
  const at = (T, y) => { let i = 0; while (i + 1 < T.length && T[i + 1] <= y + EDGE) i++; return i; };
  /** the scroll position where screen i's bottom meets the window's bottom (≤ its top when it fits) */
  const bottom = (T, i) => (i + 1 < T.length ? T[i + 1] - innerHeight : maxY());

  /**
   * Where a move from y in direction dir goes: `inside` a tall screen up to `to` (its edge),
   * a `page` turn to `to`, or `none` at the ends of the page.
   */
  function plan(dir, y) {
    const T = tops(), i = at(T, y), b = Math.max(T[i], bottom(T, i)), tall = b > T[i] + EDGE;
    if (dir > 0) {
      if (tall && y < b - EDGE) return { kind: 'inside', to: b };
      return i + 1 < T.length ? { kind: 'page', to: T[i + 1] } : { kind: 'none' };
    }
    if (y > T[i] + EDGE) return tall ? { kind: 'inside', to: T[i] } : { kind: 'page', to: T[i] };
    return i > 0 ? { kind: 'page', to: Math.max(T[i - 1], bottom(T, i - 1)) } : { kind: 'none' };
  }

  /* ---------- the glide: scrollTop on a critically damped spring, retargetable ---------- */
  let anim = null, lastSet = null;
  const set = (y) => { lastSet = y; scrollTo({ top: y, behavior: 'instant' }); };
  // on touch screens css snapping would grab every intermediate frame: it's off while gliding
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
  // someone else moved the page mid-glide (the scrollbar, find in page): let them
  addEventListener('scroll', () => { if (anim && lastSet !== null && Math.abs(scrollY - lastSet) > 3) stop(); }, { passive: true });

  /** one step in a direction: a screen, or `size` px inside a tall one; from where a running glide is heading */
  function step(dir, size) {
    const y = anim ? anim.to : scrollY, go = plan(dir, y);
    if (go.kind === 'page') glide(go.to);
    else if (go.kind === 'inside') glide(dir > 0 ? Math.min(go.to, y + size) : Math.max(go.to, y - size));
  }

  /* ---------- wheel and trackpad ---------- */
  let last = -Infinity, sum = 0, spent = false, hist = [];
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || blocked(e)) return; // pinch zoom, the palette, fields
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
    const dy = e.deltaY * unit, dx = e.deltaX * unit;
    if (Math.abs(dx) > Math.abs(dy) || !dy) return; // sideways: a code sample scrolling
    const now = performance.now(), gap = now - last, mag = Math.abs(dy);
    last = now;
    // a new gesture: after a pause, or a flick that pushes much harder than the inertia still coming in
    const flick = spent && !busy() && hist.length >= 3 && mag > 20 && mag > 2 * Math.max(...hist.slice(-3));
    if (gap > QUIET || flick) { sum = 0; spent = false; hist = []; }
    hist.push(mag);
    if (hist.length > 6) hist.shift();
    if (busy() || spent) { e.preventDefault(); spent = true; return; }
    const dir = Math.sign(dy), go = plan(dir, scrollY);
    if (go.kind === 'none') return;
    if (go.kind === 'inside') {
      sum = 0;
      if (dir > 0 ? scrollY + dy < go.to - EDGE : scrollY + dy > go.to + EDGE) return; // plain scrolling
      e.preventDefault(); // this one would spill into the next screen: stop at the edge, the gesture is over
      glide(go.to);
      spent = true;
      return;
    }
    e.preventDefault();
    if (Math.sign(sum) !== dir) sum = 0;
    sum += dy;
    if (Math.abs(sum) >= START) { glide(go.to); spent = true; sum = 0; }
  }, { passive: false });

  /* ---------- keys ---------- */
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

  /* ---------- links to #anchors ---------- */
  /** The screen an element lives on; inside a tall screen, as close to the element as the screen allows. */
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

  /* ---------- a resized window keeps the screen it was on ---------- */
  let restT = 0, resizeT = 0, onTop = -1, keep = null;
  const remember = () => { const T = tops(), i = at(T, scrollY); onTop = Math.abs(T[i] - scrollY) <= EDGE ? i : -1; };
  addEventListener('scroll', () => { clearTimeout(restT); restT = setTimeout(() => { if (!anim && keep === null) remember(); }, 100); }, { passive: true });
  addEventListener('resize', () => {
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
