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
    // walk down so every arrival plays, then a full page
    for (let y = 0; y < 5000; y += 400) { await page.mouse.wheel(0, 400); await page.waitForTimeout(120); }
    await page.waitForTimeout(900);
    ok(await page.locator('.rv:not(.in)').count() === 0, 'everything arrived after scrolling');
    ok((await page.textContent('#islSummary')).trim() === 'контакты', 'island names the section in view');
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
    const clash = await page.evaluate(() => {
      const a = document.querySelector('.brand').getBoundingClientRect(), b = document.getElementById('islShape').getBoundingClientRect(), c = document.querySelector('.top-actions').getBoundingClientRect();
      return a.right > b.left || b.right > c.left ? [a.right, b.left, b.right, c.left].map(Math.round).join(' ') : false;
    });
    ok(!clash, `island doesn't cover the header at ${width}px${clash ? ' (' + clash + ')' : ''}`);
    await snap(page, `phone-${width}`);
    if (width === 390) {
      for (let y = 0; y < 9000; y += 500) { await page.mouse.wheel(0, 500); await page.waitForTimeout(100); }
      await page.waitForTimeout(900);
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
