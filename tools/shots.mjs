// Pictures taken from the real page: the README hero (light and dark) and the social preview.
// The hero picture is shot with Reduce Motion on, so it's the still frame, not a random moment.
import { serve, launch } from './browser.mjs';

const out = (f) => new URL(`../${f}`, import.meta.url).pathname;
const server = await serve(5176);
const pw = await launch();
// the palette key reads ⌘K on a Mac, as most visitors will see it
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

async function shot({ file, width, height, scheme = 'light', clip = 'hero' }) {
  const ctx = await pw.context({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce', locale: 'ru-RU', userAgent: MAC_UA });
  const page = await ctx.newPage();
  await page.goto(server.root, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  const h = clip === 'hero' ? await page.evaluate(() => Math.ceil(document.getElementById('top').getBoundingClientRect().bottom - 24)) : height;
  await page.screenshot({ path: out(file), clip: { x: 0, y: 0, width, height: h } });
  await ctx.close();
  console.log(file);
}

try {
  await shot({ file: 'docs/hero-light.png', width: 1280, height: 900 });
  await shot({ file: 'docs/hero-dark.png', width: 1280, height: 900, scheme: 'dark' });
  await shot({ file: 'site/assets/og.png', width: 1200, height: 630, clip: 'viewport' });
} finally {
  await pw.close();
  server.close();
}
