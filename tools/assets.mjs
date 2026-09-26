// Renders PNG icons from site/assets/icon.svg and the kalka screenshots for the project card.
// Kalka's screenshots come from a kalka checkout next to this one: KALKA=../kalka node tools/assets.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = (f) => new URL(`../site/assets/${f}`, import.meta.url).pathname;
const kalka = resolve(process.env.KALKA || '../kalka');
const b = await chromium.launch();
const p = await b.newPage();

const icon = await readFile(out('icon.svg'), 'utf8');
for (const s of [180, 192, 512]) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(`<body style="margin:0">${icon.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`);
  await p.screenshot({ path: out(`icon-${s}.png`), omitBackground: true });
}

// 2880 × 1800 → 1600 × 1000 JPEG
await p.setViewportSize({ width: 1600, height: 1000 });
for (const [src, dst] of [['setup.png', 'kalka-light.jpg'], ['setup-dark-en.png', 'kalka-dark.jpg']]) {
  const data = (await readFile(`${kalka}/docs/${src}`)).toString('base64');
  await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${data}" style="width:1600px;height:1000px;display:block"></body>`);
  await p.waitForFunction(() => document.images[0].complete);
  await p.screenshot({ path: out(dst), type: 'jpeg', quality: 84 });
}
await b.close();
