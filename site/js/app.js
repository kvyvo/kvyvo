import { goLive, reduced } from './motion.js';
import { t, apply, setLang, getLang, applyTheme, getTheme, nextTheme } from './i18n.js';
import { createIsland } from './island.js';
import { hero, PROJECTS } from './hero.js';
import { createPager } from './pager.js';

const $ = (id) => document.getElementById(id);
const GH = 'https://github.com/kvyvo';
const KALKA = 'https://kvyvo.github.io/kalka/';

applyTheme();
apply();

const pic = $('heroSvg') ? hero($('heroSvg'), $('heroCap')) : null;

const SECTIONS = [['about', 'islAbout'], ['services', 'islServices'], ['work', 'islWork'], ['contact', 'islContact']].filter(([id]) => $(id));
const THEME_NEXT = { auto: 'dark', dark: 'light', light: 'auto' };
const THEME_LABEL = { auto: 'themeAuto', dark: 'themeDark', light: 'themeLight' };
const jump = (id) => { if ($(id)) pager.toElement($(id)); };
const open = (url) => { location.href = url; };
const LINKS = { telegram: 'https://t.me/kvyvo', instagram: 'https://www.instagram.com/kvyvo_', ranteis: 'https://ranteis.one' };

async function copyDiscord() {
  try { await navigator.clipboard.writeText('kvyvo.'); } catch {  }
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

const SCREENS = ['about', 'services', 'work', 'work-more', 'work-vpn', 'contact'].map($).filter(Boolean);
const pager = createPager({
  screens: () => [0, ...SCREENS.map((el) => el.getBoundingClientRect().top + scrollY)],
  blocked: (e) => island.state === 'palette' || !!e.target.closest?.('input, textarea, select, [contenteditable]:not([contenteditable=false])'),
});
addEventListener('wheel', (e) => { if (island.state === 'palette' && !e.target.closest?.('#palList')) e.preventDefault(); }, { passive: false });
addEventListener('keydown', (e) => { if (island.state === 'palette' && (e.key === 'PageDown' || e.key === 'PageUp')) e.preventDefault(); });
onScroll();

addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') { e.preventDefault(); island.state === 'palette' ? island.idle() : island.palette(); }
});

function switchLang() {
  setLang(getLang() === 'ru' ? 'en' : 'ru');
  pic?.relabel();
}
$('langBtn').addEventListener('click', () => { switchLang(); island.toast(t('toastLang')); });
document.querySelectorAll('[data-copy=discord]').forEach((b) => b.addEventListener('click', async () => island.toast(await copyDiscord())));

const rv = [...document.querySelectorAll('.rv')];
if ('IntersectionObserver' in window && !reduced()) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px' });
  rv.forEach((el) => io.observe(el));
} else rv.forEach((el) => el.classList.add('in'));

requestAnimationFrame(() => requestAnimationFrame(goLive));
