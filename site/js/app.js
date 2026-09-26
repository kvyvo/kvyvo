// kvyvo.github.io — one page, no build step. Same design system and motion as kalka.
import { goLive, reduced } from './motion.js';
import { t, apply, setLang, getLang, applyTheme, getTheme, nextTheme } from './i18n.js';
import { createIsland } from './island.js';
import { hero, PROJECTS } from './hero.js';

const $ = (id) => document.getElementById(id);
const GH = 'https://github.com/kvyvo';
const KALKA = 'https://kvyvo.github.io/kalka/';
const MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

applyTheme();
apply();

const pic = $('heroSvg') ? hero($('heroSvg'), $('heroCap')) : null;

/* ---------- the island: section nav, ⌘k ---------- */
const SECTIONS = [['about', 'islAbout'], ['services', 'islServices'], ['work', 'islWork'], ['contact', 'islContact']].filter(([id]) => $(id));
const THEME_NEXT = { auto: 'dark', dark: 'light', light: 'auto' };
const THEME_LABEL = { auto: 'themeAuto', dark: 'themeDark', light: 'themeLight' };
const jump = (id) => $(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
const open = (url) => { location.href = url; };
const LINKS = { telegram: 'https://t.me/kvyvo', instagram: 'https://www.instagram.com/kvyvo_', ranteis: 'https://ranteis.one' };

async function copyDiscord() {
  try { await navigator.clipboard.writeText('kvyvo.'); } catch { /* no clipboard: the handle is on screen anyway */ }
  return t('copied');
}

const commands = () => [
  { title: t('cmdTelegram'), hint: '↗', run: () => open(LINKS.telegram) },
  { title: t('cmdDiscord'), run: () => { copyDiscord(); return t('copied'); } },
  { title: t('cmdInstagram'), run: () => open(LINKS.instagram) },
  { title: t('cmdRanteis'), run: () => open(LINKS.ranteis) },
  { title: t('cmdOpenKalka'), run: () => open(KALKA) },
  ...PROJECTS.map(({ id }) => ({ title: t('cmdRepo', { name: id }), run: () => open(`${GH}/${id}`) })),
  { title: t('cmdProfile'), run: () => open(GH) },
  ...SECTIONS.map(([id, key]) => ({ title: t('cmdGo', { name: t(key) }), run: () => jump(id) })),
  { title: t('cmdLang'), run: () => { switchLang(); return t('toastLang'); } },
  { title: t('cmdTheme', { mode: t(THEME_LABEL[THEME_NEXT[getTheme()]]) }), run: () => t('cmdTheme', { mode: t(THEME_LABEL[nextTheme()]) }) },
];
const island = createIsland({ commands });
$('paletteKey').textContent = MAC ? '⌘k' : 'ctrl k';

// the header lives at the top; scroll down and it slides away, the section nav takes its place.
// the section in view is the last one whose top has passed 45% of the screen; at the very bottom it's the last one.
let rafScroll = 0;
const top = document.querySelector('.top');
const onScroll = () => {
  rafScroll = 0;
  const past = scrollY > 80;
  top.classList.toggle('gone', past);
  island.hide(!past);
  if (!SECTIONS.length) return;
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  let cur = null;
  for (const [id] of SECTIONS) if ($(id).getBoundingClientRect().top <= innerHeight * 0.45) cur = id;
  island.section(atEnd ? SECTIONS.at(-1)[0] : cur);
};
addEventListener('scroll', () => { rafScroll ||= requestAnimationFrame(onScroll); }, { passive: true });

// one section per screen. css scroll-snap pulls a gentle wheel or trackpad scroll back where it started,
// so the page settles itself: when scrolling stops near a section's start, it glides the rest of the way.
// inside a section taller than the screen nothing happens.
if (SECTIONS.length) {
  const stops = () => [0, ...SECTIONS.map(([id]) => $(id).getBoundingClientRect().top + scrollY)];
  let idle = 0, settling = false;
  const settle = () => {
    if (settling) { settling = false; return; }
    if (island.state === 'palette') return;
    const near = stops().map((y) => y - scrollY).filter((d) => Math.abs(d) > 2 && Math.abs(d) < innerHeight * 0.22);
    if (!near.length) return;
    const d = near.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    settling = true;
    scrollBy({ top: d, behavior: reduced() ? 'auto' : 'smooth' });
  };
  addEventListener('scroll', () => { clearTimeout(idle); idle = setTimeout(settle, 160); }, { passive: true });
}
onScroll();

addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') { e.preventDefault(); island.state === 'palette' ? island.idle() : island.palette(); }
});

/* ---------- language ---------- */
function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  pic?.relabel();
}
$('langBtn').addEventListener('click', () => { switchLang(); island.toast(t('toastLang')); });
document.querySelectorAll('[data-copy=discord]').forEach((b) => b.addEventListener('click', async () => island.toast(await copyDiscord())));

/* ---------- things arrive as they scroll in: fade, rise, unblur ---------- */
const rv = [...document.querySelectorAll('.rv')];
if ('IntersectionObserver' in window && !reduced()) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  rv.forEach((el) => io.observe(el));
} else rv.forEach((el) => el.classList.add('in'));

// nothing animates until the first screen is on
requestAnimationFrame(() => requestAnimationFrame(goLive));
