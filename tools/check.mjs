// Opens the site in Chromium and checks what a visitor would notice: script errors,
// broken links to local files, horizontal scroll on a phone, the ⌘K palette, the language
// switch, the 404 page. SHOTS=dir also saves screenshots of each state for a look.
import { mkdir } from 'node:fs/promises';
import { serve, launch, SITE as site } from './browser.mjs';

const server = await serve(5174), ROOT = server.root;
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const pw = await launch();
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; };

async function open({ path = '/', width = 1440, height = 900, scheme = 'light', lang = 'ru', motion = 'no-preference' } = {}) {
  const ctx = await pw.context({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: motion, locale: lang === 'ru' ? 'ru-RU' : 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('response', (r) => r.url().startsWith(ROOT) && r.status() >= 400 && !r.url().includes('/nope') && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(ROOT + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return { page, ctx, errors };
}
const snap = async (page, name, opts = {}) => shots && page.screenshot({ path: `${shots}/${name}.png`, ...opts });
// the page turns one screen per gesture (js/pager.js): wheel, wait for the glide and for the wheel to go quiet
const SCREENS = ['top', 'about', 'services', 'work', 'work-more', 'work-vpn', 'contact'];
const screenTops = (page) => page.evaluate((ids) => ids.map((id) => Math.min(document.documentElement.scrollHeight - innerHeight, id === 'top' ? 0 : document.getElementById(id).getBoundingClientRect().top + scrollY)), SCREENS);
const y = (page) => page.evaluate(() => scrollY);
const nav = (page) => page.getAttribute('#islIdle a.on', 'data-sec');
async function wheelDown(page, dy = 400, { settle = 900 } = {}) { await page.mouse.wheel(0, dy); await page.waitForTimeout(settle); }
// a trackpad flick: a quick ramp, then a second and more of inertia that slowly dies out
async function flick(page, dir = 1) {
  const ds = [3, 8, 18, 34, 52];
  for (let v = 60; v >= 1; v *= 0.94) ds.push(Math.round(v));
  for (const d of ds) { await page.mouse.wheel(0, d * dir); await page.waitForTimeout(16); }
  await page.waitForTimeout(900);
}
// every gesture until the page stops moving; returns how many it took
async function walk(page, { dy = 400, settle = 900, max = 60 } = {}) {
  let n = 0, before;
  do { before = await y(page); await wheelDown(page, dy, { settle }); n++; } while (Math.abs(await y(page) - before) > 1 && n < max);
  return n;
}

try {
  // desktop, light, Russian
  {
    const { page, ctx, errors } = await open();
    ok(await page.title() === 'kvyvo — боты, парсеры и сайты', 'title in Russian');
    ok(await page.locator('#heroSvg .h-part').count() === 4, 'hero has four parts');
    ok(await page.locator('#p-kalka, #p-nickcheck, #p-whoami-bot, #p-books-scraper').count() === 4, 'four project cards, one per hero part');
    const caps = await page.evaluate(() => [...document.querySelectorAll('main *, header.top *')].filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && /[A-ZА-ЯЁ]/.test(n.textContent))).map((e) => e.textContent.trim().slice(0, 40)));
    ok(caps.length === 0, `all copy is lowercase${caps.length ? ': ' + caps.join(' | ') : ''}`);
    ok(await page.locator('img.ava').first().evaluate((i) => i.complete && i.naturalWidth > 0), 'avatar loads');
    await snap(page, 'desktop-light');
    // screen by screen: one gesture, one screen, landing exactly on its top
    await page.mouse.move(720, 450);
    const tops = await screenTops(page);
    ok(tops.every((t, i) => !i || t - tops[i - 1] === 900), `each screen fits 1440×900 (${tops.map((t, i) => i && t - tops[i - 1]).slice(1).join(', ')})`);
    await wheelDown(page, 100);
    ok(Math.abs(await y(page) - tops[1]) <= 2, `one wheel notch: hero → 01, on its top (${await y(page)} vs ${tops[1]})`);
    await flick(page);
    ok(Math.abs(await y(page) - tops[2]) <= 2, `one long trackpad flick with inertia: exactly one screen, 01 → 02 (${await y(page)} vs ${tops[2]})`);
    await flick(page);
    ok(Math.abs(await y(page) - tops[3]) <= 2 && await nav(page) === 'work', `next flick: 03, nav marks 03 (${await y(page)}, ${await nav(page)})`);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[4]) <= 2 && await nav(page) === 'work', `page down: 03 more, nav still marks 03 (${await y(page)}, ${await nav(page)})`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[5]) <= 2 && await nav(page) === 'work', `arrow down: 03 vpn, nav still marks 03 (${await y(page)}, ${await nav(page)})`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[6]) <= 2 && await nav(page) === 'contact', `arrow down: 04 (${await y(page)}, ${await nav(page)})`);
    await wheelDown(page, 400);
    ok(Math.abs(await y(page) - tops[6]) <= 2, 'at the last screen a wheel goes nowhere');
    await flick(page, -1);
    ok(Math.abs(await y(page) - tops[5]) <= 2, `flick up: back one screen (${await y(page)} vs ${tops[5]})`);
    await page.keyboard.press('Shift+Space');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[4]) <= 2, 'shift space: back one more');
    await page.keyboard.press('Home');
    await page.waitForTimeout(900);
    ok(await y(page) <= 2, 'home: back to the top');
    await page.click('.hero-cta a[href="#services"]');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[2]) <= 2, 'hero button glides to 02');
    await page.click('#islIdle a[data-sec=work]');
    await page.waitForTimeout(900);
    ok(Math.abs(await y(page) - tops[3]) <= 2, 'nav link glides to 03');
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(400);
    await page.mouse.wheel(0, 400);
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(700);
    ok(Math.abs(await y(page) - tops[3]) <= 2, 'with the palette open the page stays put');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.keyboard.press('End');
    await page.waitForTimeout(900);
    await page.keyboard.press('Home');
    await page.waitForTimeout(900);
    // walk down so every arrival plays, then a full page
    await walk(page);
    ok(await page.locator('.rv:not(.in)').count() === 0, 'everything arrived after scrolling');
    ok((await page.getAttribute('#islIdle a.on', 'data-sec')) === 'contact', 'nav marks the section in view');
    ok(await page.evaluate(() => document.querySelector('.top').classList.contains('gone') && !document.getElementById('island').classList.contains('away')), 'scrolled down: header gone, nav shown');
    await snap(page, 'desktop-light-full', { fullPage: true });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(600);
    // ⌘K palette
    await page.keyboard.press('Control+KeyK');
    await page.waitForTimeout(500);
    ok(await page.locator('#islShape').getAttribute('data-state') === 'palette', 'Ctrl K opens the palette');
    await page.keyboard.type('nick');
    await page.waitForTimeout(400);
    ok((await page.locator('#palList li').first().textContent()).includes('nickcheck'), 'palette finds nickcheck');
    await snap(page, 'desktop-palette');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    ok(await page.locator('#islShape').getAttribute('data-state') === 'idle', 'Esc closes the palette');
    // language
    await page.click('#langBtn');
    await page.waitForTimeout(700);
    ok(await page.locator('html').getAttribute('lang') === 'en', 'language button switches to English');
    ok((await page.textContent('h1')).trim() === 'bots, scrapers and websites', 'headline in English');
    ok((await page.textContent('#heroCap')).match(/websites|scripts|bots|scrapers/), 'hero caption follows the language');
    await page.reload({ waitUntil: 'networkidle' });
    ok(await page.locator('html').getAttribute('lang') === 'en', 'language is remembered');
    ok(errors.length === 0, `no errors on the page${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // desktop, dark, English
  {
    const { page, ctx, errors } = await open({ scheme: 'dark', lang: 'en' });
    ok(await page.locator('html').getAttribute('lang') === 'en', 'English browser gets English');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(bg === 'rgb(14, 14, 13)', `dark canvas (${bg})`);
    await snap(page, 'desktop-dark');
    await page.locator('#p-kalka').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    ok(await page.locator('.shot-dark').isVisible() && !(await page.locator('.shot-light').isVisible()), 'dark screenshot of kalka in dark mode');
    await snap(page, 'desktop-dark-full', { fullPage: true });
    ok(errors.length === 0, `no errors in dark${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // phone
  for (const width of [320, 390]) {
    const { page, ctx, errors } = await open({ width, height: 844 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(over <= 0, `no horizontal scroll at ${width}px (${over})`);
    ok(await page.evaluate(() => document.getElementById('island').classList.contains('away')), `at the top the nav waits, header shows (${width}px)`);
    await page.evaluate(() => document.getElementById('services').scrollIntoView());
    await page.waitForTimeout(900);
    const fit = await page.evaluate(() => { const r = document.getElementById('islShape').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
    ok(fit, `nav fits the screen at ${width}px`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(700);
    await snap(page, `phone-${width}`);
    if (width === 390) {
      // screens taller than the phone scroll inside, then the page turns: all the way down
      const n = await walk(page, { dy: 500, settle: 450 });
      const end = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
      ok(end, `phone: the wheel reaches the bottom through tall screens (${n} gestures)`);
      ok((await nav(page)) === 'contact', 'phone: nav marks 04 at the bottom');
      await snap(page, 'phone-390-full', { fullPage: true });
    }
    ok(errors.length === 0, `no errors at ${width}px${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // reduced motion: a still picture, nothing hidden
  {
    const { page, ctx, errors } = await open({ motion: 'reduce' });
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.rv')].filter((e) => getComputedStyle(e).opacity !== '1').length);
    ok(hidden === 0, 'reduced motion: nothing waits to arrive');
    ok(errors.length === 0, `no errors with reduced motion${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
  // 404 at a nested path: absolute URLs must still load
  {
    const ctx = await pw.context({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => r.url().startsWith(ROOT) && r.status() >= 400 && !r.url().includes('/nope/') && errors.push(`${r.status()} ${r.url()}`));
    await page.route(`${ROOT}/nope/deeper`, (route) => route.fulfill({ path: `${site}/404.html`, status: 404, contentType: 'text/html' }));
    await page.goto(`${ROOT}/nope/deeper`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(236, 234, 228)', '404 page is styled');
    ok((await page.textContent('h1')).trim().length > 0, '404 page has a headline');
    await snap(page, '404');
    ok(errors.length === 0, `no errors on 404${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }
} finally {
  await pw.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : '\nall good');
process.exit(failed ? 1 : 0);
