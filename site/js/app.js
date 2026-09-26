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

/* ---------- the island: section name, scroll ring, ⌘K ---------- */
const SECTIONS = [['top', 'islTop'], ['about', 'islAbout'], ['services', 'islServices'], ['work', 'islWork'], ['contact', 'islContact']].filter(([id]) => $(id));
let section = SECTIONS[0]?.[1] ?? 'islTop';
const THEME_NEXT = { auto: 'dark', dark: 'light', light: 'auto' };
const THEME_LABEL = { auto: 'themeAuto', dark: 'themeDark', light: 'themeLight' };
const jump = (id) => $(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });
const open = (url) => { location.href = url; };
const LINKS = { telegram: 'https://t.me/kvyvo', instagram: 'https://www.instagram.com/kvyvo_', ranteis: 'https://ranteis.one' };

async function copyDiscord() {
  try { await navigator.clipboard.writeText('kvyvo'); } catch { /* no clipboard: the handle is on screen anyway */ }
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
  ...SECTIONS.slice(1).map(([id, key]) => ({ title: t('cmdGo', { name: t(key) }), run: () => jump(id) })),
  { title: t('cmdLang'), run: () => { switchLang(); return t('toastLang'); } },
  { title: t('cmdTheme', { mode: t(THEME_LABEL[THEME_NEXT[getTheme()]]) }), run: () => t('cmdTheme', { mode: t(THEME_LABEL[nextTheme()]) }) },
];
const island = createIsland({ commands });
$('paletteKey').textContent = MAC ? '⌘k' : 'ctrl k';
island.summary(t(document.body.dataset.page === '404' ? 'nfEyebrow' : section));

if (SECTIONS.length) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      section = SECTIONS.find(([id]) => id === e.target.id)[1];
      island.summary(t(section));
    }
  }, { rootMargin: '-40% 0px -55% 0px' });
  SECTIONS.forEach(([id]) => io.observe($(id)));
}

let rafScroll = 0;
const onScroll = () => {
  rafScroll = 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  island.progress(max > 0 ? scrollY / max : 1);
  document.querySelector('.top').classList.toggle('scrolled', scrollY > 4);
};
addEventListener('scroll', () => { rafScroll ||= requestAnimationFrame(onScroll); }, { passive: true });
addEventListener('resize', onScroll, { passive: true });
onScroll();

addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') { e.preventDefault(); island.state === 'palette' ? island.idle() : island.palette(); }
});

/* ---------- language ---------- */
function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  pic?.relabel();
  island.summary(t(document.body.dataset.page === '404' ? 'nfEyebrow' : section));
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
