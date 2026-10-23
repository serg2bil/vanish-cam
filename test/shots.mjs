// Real chrome://extensions screenshots (Russian UI) with the extension loaded, for the README.
import puppeteer from 'puppeteer-core';
import path from 'path';
const root = path.resolve(import.meta.dirname, '..');
const chrome = process.argv[2];
const b = await puppeteer.launch({ executablePath: chrome, headless: false, pipe: true, enableExtensions: true,
  defaultViewport: { width: 1100, height: 640 }, args: ['--lang=ru', '--window-size=1100,720', '--accept-lang=ru'] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));
const p = await b.newPage();
await p.goto('chrome://extensions');
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({ path: path.join(root, 'docs/img/raw1.png') });
// developer mode toggle lives in shadow DOM
await p.evaluate(() => document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click());
await new Promise(r => setTimeout(r, 800));
await p.screenshot({ path: path.join(root, 'docs/img/raw2.png') });
const pop = await b.newPage();
await pop.setViewport({ width: 420, height: 640, deviceScaleFactor: 2 });
await pop.goto(`chrome-extension://${id}/popup.html`);
await new Promise(r => setTimeout(r, 800));
await pop.screenshot({ path: path.join(root, 'docs/img/popup.png') });
await b.close();
