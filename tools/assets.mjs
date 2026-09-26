import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const out = (f) => new URL(`../site/assets/${f}`, import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage();

const ava = (await readFile(out('avatar.jpg'))).toString('base64');
for (const [size, round] of [[64, true], [180, false], [192, true], [512, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${ava}" style="width:${size}px;height:${size}px;object-fit:cover;display:block;border-radius:${round ? '50%' : '0'}"></body>`);
  await p.waitForFunction(() => document.images[0].complete);
  await p.screenshot({ path: out(`icon-${size}.png`), omitBackground: true });
}

await b.close();
