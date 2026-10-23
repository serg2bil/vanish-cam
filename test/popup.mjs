// Opens a page with a fake camera, then the extension popup (as a tab), screenshots both popup
// screens and checks the popup can toggle the camera in the page.
// Usage: node test/popup.mjs <chrome.exe> [clip-name]
import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';
import assert from 'assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const [, , chrome, clip = '6-hands-waving'] = process.argv;
const out = f => path.join(root, 'test-out', f);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<video id=v autoplay muted playsinline></video>'); }).listen(8767);

const b = await puppeteer.launch({ executablePath: chrome, headless: true, enableExtensions: true, protocolTimeout: 120000, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', clip + '.mjpeg')}`,
  `--use-file-for-fake-audio-capture=${path.join(root, 'test-clips', clip + '.wav')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));
console.log('extension id', id);

const page = await b.newPage();
page.on('pageerror', e => console.log('page error', e.message));
await page.goto('http://localhost:8767/');
await page.evaluate(async () => { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }); });
console.log('camera on');
await new Promise(r => setTimeout(r, 12000)); // models load

const pop = await b.newPage();
pop.on('pageerror', e => console.log('popup error', e.message));
await pop.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
await pop.goto(`chrome-extension://${id}/popup.html`);
console.log('popup open');
// The popup talks to the active tab; as a tab itself it would talk to itself, so point it at the page.
// (Without the "tabs" permission tab URLs are hidden, so ask every tab and keep the one that answers.)
const pageTab = await pop.evaluate(async () => {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    const ok = await new Promise(r => chrome.tabs.sendMessage(t.id, { cmd: 'status' }, x => { void chrome.runtime.lastError; r(!!x); }));
    if (ok) return t.id;
  }
  return null;
});
assert.ok(pageTab !== null, 'the camera tab answers the popup');
await pop.evaluate(t => { tabId = t; }, pageTab);
await new Promise(r => setTimeout(r, 1000));
await pop.screenshot({ path: out('popup-main.png'), fullPage: true });
const before = await pop.$eval('#where', e => e.textContent);
console.log('status:', before, '|', await pop.$eval('#info', e => e.textContent));
assert.equal(before, 'Камера работает');

await pop.click('#toggle');
await new Promise(r => setTimeout(r, 2500)); // sound hit + fade
const after = await pop.$eval('#where', e => e.textContent);
console.log('after toggle:', after);
assert.equal(after, 'Ты исчез из видео');

// Settings change reaches the page live: switch the gesture mode and read it back from storage.
await pop.select('#mode', 'snap');
const saved = await pop.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.mode))));
assert.equal(saved, 'snap');
await pop.select('#mode', 'meme');

await pop.click('#gear');
await new Promise(r => setTimeout(r, 300));
await pop.screenshot({ path: out('popup-advanced.png'), fullPage: true });
console.log('popup ok');
await b.close();
srv.close();
