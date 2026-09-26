import { SPRING } from './spring.js';
import { Springs, morph } from './motion.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);

function score(query, text) {
  const q = query.toLowerCase().replace(/\s+/g, ''), s = text.toLowerCase();
  if (!q) return 0;
  let i = 0, gaps = 0, last = -1;
  for (let j = 0; j < s.length && i < q.length; j++) {
    if (s[j] === q[i]) { if (last >= 0) gaps += j - last - 1; last = j; i++; }
  }
  return i === q.length ? gaps + (s.startsWith(q[0]) ? 0 : 1) : null;
}

export function createIsland({ commands }) {
  const dlg = $('island'), shape = $('islShape'), live = $('live');
  const m = morph(shape, {
    idle: { layer: $('islIdle') },
    toast: { layer: $('islToast') },
    palette: { layer: $('islPal'), radius: 22, light: 1, width: () => Math.min(520, innerWidth - 24) },
  });
  let timer = null, away = false;

  const modal = (on) => {
    if (dlg.open && dlg.matches(':modal') === on) return;
    if (dlg.open) dlg.close();
    on ? dlg.showModal() : dlg.show();
  };
  const go = (state) => { clearTimeout(timer); dlg.classList.toggle('away', away && state === 'idle'); m.to(state); };
  function idle() { modal(false); go('idle'); }
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); idle(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) idle(); });
  const nav = $('islIdle'), thumb = $('navThumb'), links = [...nav.querySelectorAll('a[data-sec]')];
  let current = null;
  const th = new Springs({ x: 0, w: 0, o: 0 }, ({ x, w, o }) => {
    thumb.style.transform = `translateX(${x}px)`;
    thumb.style.width = `${Math.max(0, w)}px`;
    thumb.style.opacity = o;
  });
  function place(animated = true) {
    const a = links.find((l) => l.dataset.sec === current);
    const v = a ? { x: a.offsetLeft, w: a.offsetWidth, o: 1 } : { o: 0 };
    animated ? th.to(v, { x: SPRING.snappy, w: SPRING.snappy, o: SPRING.quick }) : th.set(v);
  }
  function section(id) {
    if (id === current) return;
    current = id;
    links.forEach((l) => l.classList.toggle('on', l.dataset.sec === id));
    if (m.state === 'idle') m.to('idle');
    requestAnimationFrame(() => place());
  }
  new ResizeObserver(() => place(false)).observe(nav);
  $('paletteKey').addEventListener('click', () => palette());
  function hide(on) {
    away = on;
    dlg.classList.toggle('away', on && m.state === 'idle');
  }

  function toast(msg, ms = 1600) {
    if (m.state === 'palette') modal(false);
    $('toastText').textContent = msg;
    live.textContent = msg;
    go('toast');
    timer = setTimeout(idle, ms);
  }
  $('islToast').addEventListener('click', idle);

  const input = $('palInput'), list = $('palList'), hi = $('palHi');
  let items = [], sel = 0;
  const hiSp = new Springs({ y: 0, h: 0, o: 0 }, ({ y, h, o }) => {
    hi.style.transform = `translateY(${y}px)`;
    hi.style.height = `${h}px`;
    hi.style.opacity = o;
  });
  function moveHi(animated = true) {
    const li = list.children[sel];
    if (!li || !items.length) { hiSp.to({ o: 0 }, SPRING.quick); return; }
    const vals = { y: li.offsetTop - list.scrollTop, h: li.offsetHeight, o: 1 };
    animated ? hiSp.to(vals, { y: SPRING.ui, h: SPRING.ui, o: SPRING.quick }) : hiSp.set(vals);
  }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function render() {
    const q = input.value.trim();
    items = commands().map((c) => ({ c, s: score(q, c.title) }))
      .filter((x) => x.s !== null).sort((a, b) => a.s - b.s).map((x) => x.c);
    sel = Math.min(sel, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="pal${i}" aria-selected="${i === sel}"><span>${esc(c.title)}</span>${c.hint ? `<kbd>${esc(c.hint)}</kbd>` : ''}</li>`).join('')
      : `<li class="empty">${esc(t('cmdNothing'))}</li>`;
    input.setAttribute('aria-activedescendant', items.length ? `pal${sel}` : '');
    moveHi(false);
    if (m.state === 'palette') m.to('palette');
  }
  function select(i) {
    sel = Math.max(0, Math.min(items.length - 1, i));
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === sel)));
    input.setAttribute('aria-activedescendant', `pal${sel}`);
    list.children[sel]?.scrollIntoView?.({ block: 'nearest' });
    moveHi();
  }
  function run(i) {
    const c = items[i];
    if (!c) return;
    const res = c.run();
    if (typeof res === 'string') toast(res);
    else idle();
  }
  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { select(sel + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { select(sel - 1); e.preventDefault(); }
    else if (e.key === 'Enter') { run(sel); e.preventDefault(); }
  });
  list.addEventListener('scroll', () => moveHi(false), { passive: true });
  list.addEventListener('pointermove', (e) => { const li = e.target.closest('li[role=option]'); if (li && Number(li.id.slice(3)) !== sel) select(Number(li.id.slice(3))); });
  list.addEventListener('click', (e) => { const li = e.target.closest('li[role=option]'); if (li) run(Number(li.id.slice(3))); });
  function palette() {
    input.value = '';
    input.placeholder = t('palPh');
    sel = 0;
    modal(true);
    render();
    go('palette');
    input.focus();
  }

  dlg.show();
  m.to('idle');
  return { section, hide, toast, palette, idle, get state() { return m.state; } };
}
