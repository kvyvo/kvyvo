// Shared by check.mjs and shots.mjs: a static server for site/ and a Chromium that gets its fonts.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';

export const SITE = new URL('../site', import.meta.url).pathname;

export async function serve(port = 5174) {
  const proc = spawn('python3', ['-m', 'http.server', String(port), '-d', SITE, '--bind', '127.0.0.1'], { stdio: 'ignore' });
  const root = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(root); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  return { root, close: () => proc.kill() };
}

// Behind an HTTPS proxy (sandboxes) the browser may not trust the proxy's CA: fetch
// Google Fonts with curl, which reads the system trust, and hand them to the page.
const fontCache = new Map();
async function fonts(ctx) {
  if (!process.env.HTTPS_PROXY) return;
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    const url = route.request().url();
    if (!fontCache.has(url)) {
      const body = execFileSync('curl', ['-sS', '--fail', '-A', route.request().headers()['user-agent'], url], { maxBuffer: 1 << 24 });
      fontCache.set(url, { body, contentType: url.includes('gstatic') ? 'font/woff2' : 'text/css; charset=utf-8' });
    }
    await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, ...fontCache.get(url) });
  });
}

export async function launch() {
  const browser = await chromium.launch();
  return {
    browser,
    async context(opts) { const ctx = await browser.newContext(opts); await fonts(ctx); return ctx; },
    close: () => browser.close(),
  };
}
