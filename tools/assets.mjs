// Renders PNG icons from site/assets/avatar.jpg and the kalka screenshots for the project card.
// Kalka's screenshots come from a kalka checkout next to this one: KALKA=../kalka node tools/assets.mjs
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = (f) => new URL(`../site/assets/${f}`, import.meta.url).pathname;
const kalka = resolve(process.env.KALKA || '../kalka');
const b = await chromium.launch();
const p = await b.newPage();

// icons are the avatar: round for the tab, square for the home screen (ios rounds it itself)
const ava = (await readFile(out('avatar.jpg'))).toString('base64');
for (const [size, round] of [[64, true], [180, false], [192, true], [512, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${ava}" style="width:${size}px;height:${size}px;object-fit:cover;display:block;border-radius:${round ? '50%' : '0'}"></body>`);
  await p.waitForFunction(() => document.images[0].complete);
  await p.screenshot({ path: out(`icon-${size}.png`), omitBackground: true });
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
