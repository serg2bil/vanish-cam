// Real chrome://extensions screenshots (English UI) with red numbered marks, for the README.
// Usage: node test/shots.mjs <chrome.exe>
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import os from 'os';
const root = path.resolve(import.meta.dirname, '..');
const out = n => path.join(root, 'docs/img', n);
// Chrome picks its UI language from the OS; a fresh profile with app_locale forces English.
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'vc-en-'));
fs.writeFileSync(path.join(profile, 'Local State'), JSON.stringify({ intl: { app_locale: 'en-US' } }));
const b = await puppeteer.launch({ executablePath: chrome(), headless: false, userDataDir: profile, pipe: true, enableExtensions: true,
  defaultViewport: { width: 1100, height: 520 }, args: ['--lang=en-US', '--accept-lang=en-US', '--window-size=1100,620'] });
function chrome() { return process.argv[2]; }
const id = await b.installExtension(path.join(root, 'vanish-cam'));
const p = await b.newPage();
await p.goto('chrome://extensions');
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1500);
// Draws a numbered red frame around each element found by `find` (runs in the page, can pierce shadow roots).
const mark = (...finders) => p.evaluate(src => {
  const sr = e => e.shadowRoot, m = document.querySelector('extensions-manager');
  const dev = () => sr(sr(m).querySelector('extensions-toolbar')).querySelector('#devMode');
  const load = () => sr(sr(m).querySelector('extensions-toolbar')).querySelector('#loadUnpacked');
  const item = () => sr(sr(m).querySelector('extensions-item-list')).querySelector('extensions-item');
  const tog = () => sr(item()).querySelector('#enableToggle');
  const f = { dev, load, item, tog };
  document.querySelectorAll('.mk').forEach(e => e.remove());
  src.forEach((k, i) => {
    const r = f[k]().getBoundingClientRect(), d = document.createElement('div');
    d.className = 'mk';
    d.style.cssText = `position:fixed;z-index:99999;pointer-events:none;border:4px solid #ff2828;border-radius:8px;left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width}px;height:${r.height}px`;
    const n = document.createElement('b');
    n.textContent = i + 1;
    n.style.cssText = 'position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:#ff2828;color:#fff;font:700 18px Arial;text-align:center;line-height:28px';
    d.append(n);
    document.body.append(d);
  });
}, finders);
await mark('dev');
await p.screenshot({ path: out('step2-devmode.png') });
await p.evaluate(() => document.querySelector('extensions-manager').shadowRoot.querySelector('extensions-toolbar').shadowRoot.querySelector('#devMode').click());
await wait(800);
await mark('load');
await p.screenshot({ path: out('step3-load.png') });
await mark('item', 'tog');
await p.screenshot({ path: out('step4-done.png') });
await b.close();
