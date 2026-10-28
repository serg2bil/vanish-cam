// Opens the studio page with a fake camera (a test clip), records a gesture, tries an effect,
// screenshots along the way and fails on page errors.
// Usage: node test/studio.mjs <chrome.exe> [clip=9-many-gestures]
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const [, , chrome, clip = '9-many-gestures'] = process.argv;
const out = f => path.join(root, 'test-out', f);
fs.mkdirSync(out(''), { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

const b = await puppeteer.launch({ executablePath: chrome, headless: true, enableExtensions: true, protocolTimeout: 120000, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', clip + '.mjpeg')}`,
  `--use-file-for-fake-audio-capture=${path.join(root, 'test-clips', clip + '.wav')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));
const errors = [];
const page = await b.newPage();
await page.setViewport({ width: 1280, height: 860 });
page.on('pageerror', e => { errors.push(e.message); console.log('page error', e.message); });
page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log('console error', m.text()); } else if (m.text().includes('Vanish')) console.log(' ', m.text().replace(/%c|color:#a0f/g, '')); });
await page.goto(`chrome-extension://${id}/studio.html`);
await page.evaluate(() => new Promise(r => chrome.storage.local.set({ settings: { lang: 'en' } }, r))); // English screenshots for the README
await page.reload();
await wait(15000); // models load
await page.screenshot({ path: out('studio-1-live.png') });
const status = await page.$eval('#status', e => e.textContent);
console.log('status:', status);
assert.ok(/RVM|simple/.test(status), 'models loaded');
assert.ok(!await page.$eval('#toggle', e => e.disabled), 'vanish button enabled');

// Record a gesture: the clip shows hands most of the time.
await page.click('#modes .tile:nth-child(6)'); // "My gestures"
await page.click('#record');
await wait(2000);
await page.screenshot({ path: out('studio-2-recording.png') });
await page.waitForSelector('#rec', { hidden: true, timeout: 15000 }); // countdown + recording
await wait(500);
await page.screenshot({ path: out('studio-3-recorded.png') });
await page.screenshot({ path: path.join(root, 'docs/img/studio.png'), clip: { x: 0, y: 0, width: 1280, height: 860 } });
await page.click('.ipick summary'); // icon picker for the gesture
await wait(300);
await page.screenshot({ path: out('studio-3b-iconpick.png'), clip: { x: 800, y: 380, width: 480, height: 330 } });
await page.click('.ipick .grid button:nth-child(7)'); // heart
assert.equal(await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.gestures[0].icon)))), 'heart', 'icon saved');
const n = await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.gestures.length))));
console.log('gestures saved:', n);
assert.equal(n, 1, 'one gesture recorded');
assert.equal(await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.mode)))), 'custom');

// Speed: from the trigger to the effect starting, with a sound whose hit comes 0.4 s in.
await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => chrome.storage.local.set({ settings: { ...x.settings, vanishSound: 'syn:whoosh', appearSound: 'syn:pop' } }, r))));
await wait(500);
const lag = await page.evaluate(async () => {
  const t0 = performance.now();
  trigger();
  while (!S.hidden) await new Promise(r => setTimeout(r, 5));
  const ms = performance.now() - t0;
  await new Promise(r => setTimeout(r, fadeMs() + 300));
  trigger();
  while (S.hidden || pending) await new Promise(r => setTimeout(r, 5));
  return ms;
});
console.log(`gesture -> effect starts: ${Math.round(lag)} ms`);
assert.ok(lag < 200, 'the effect starts right away');
await wait(1500);

// Every effect, mid-way: screenshots at a quarter, half and three quarters of its run.
const stage = { x: 24, y: 66, width: 774, height: 436 };
const fx = await page.evaluate(() => EFFECT_LIST.map(e => [e[0], effectOpts(e[0], CFG).ms]));
for (const [i, [id, ms]] of fx.entries()) {
  await page.evaluate(id => new Promise(r => chrome.storage.local.get('settings', x => chrome.storage.local.set({ settings: { ...x.settings, effect: id } }, r))), id);
  await wait(300);
  const t0 = await page.evaluate(() => { trigger(); return performance.now(); });
  for (const q of [0.25, 0.5, 0.75]) {
    await page.evaluate((t, d) => new Promise(r => setTimeout(r, Math.max(0, t + 60 + d - performance.now()))), t0, ms * q);
    await page.screenshot({ path: out(`fx-${i}-${id}-${q * 100}.png`), clip: stage });
  }
  await wait(ms + 300);
  await page.evaluate(() => trigger());
  await wait(ms + 800);
}
const fxErrors = errors.length;

// Settings live with their owner: the selected effect's sliders under the effect tiles,
// the mode's sliders under the gesture tiles, sound timing in the sounds card.
await page.evaluate(() => { settings.effect = 'glitch'; save(true); render(); });
await wait(400);
const effectSliders = await page.$$eval('#effectOpts .slider label', ls => ls.map(l => l.textContent));
console.log('glitch settings:', effectSliders.join(' | '));
assert.deepEqual(effectSliders, ['Duration', 'Tear strength', 'Camera shake']);
const shake = (await page.$$('#effectOpts input[type=range]'))[2];
await shake.evaluate(i => { i.value = 2.5; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); });
await wait(800);
const saved = await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.fx))));
assert.equal(saved.glitch.shake, 2.5, 'per-effect setting saved');
assert.equal(await page.evaluate(() => effectOpts('dust', CFG).spread), 1, 'other effects keep their own');
await page.evaluate(() => { settings.mode = 'snap'; save(true); render(); });
await wait(300);
assert.ok(!await page.$eval('#modeOpts', e => e.hidden) && (await page.$eval('#modeOpts', e => e.textContent)).includes('Snap sound sensitivity'), 'snap settings under the tiles');
await page.evaluate(() => { settings.mode = 'custom'; save(true); render(); });
await wait(300);
assert.ok(await page.$eval('#modeOpts', e => e.hidden), 'no mode box for my gestures');
assert.ok((await page.$eval('#soundOpts', e => e.textContent)).includes('Volume in the call'), 'volume in the sounds card');
await wait(2500);
await page.evaluate(() => document.querySelector('#effectOpts').scrollIntoView());
await (await page.$('#effectOpts')).screenshot({ path: out('studio-effect-opts.png') });

// Tracking overlay switch.
await page.click('#tracking');
await wait(400);
assert.equal(await page.evaluate(() => new Promise(r => chrome.storage.local.get('settings', x => r(x.settings.studioTracking)))), false, 'tracking off saved');
await page.screenshot({ path: out('studio-6-no-tracking.png'), clip: stage });
await page.click('#tracking');

// Main switch: off = the camera goes out untouched and the gesture can't fire.
await page.click('label.power');
await wait(800);
const off = await page.evaluate(() => ({ enabled: CFG.enabled, card: !document.getElementById('offcard').hidden, btn: document.getElementById('toggle').disabled }));
console.log('switched off:', off);
assert.deepEqual(off, { enabled: false, card: true, btn: true });
await page.evaluate(() => trigger());
await wait(500);
assert.equal(await page.evaluate(() => S.hidden), false, 'no vanishing while off');
await page.screenshot({ path: out('studio-7-off.png') });
await page.click('#turnOn');
await wait(800);
assert.equal(await page.evaluate(() => CFG.enabled), true, 'back on');
console.log('effects drew without errors:', fxErrors === 0);

// Popup next to it: shows the custom gesture count.
const pop = await b.newPage();
pop.on('pageerror', e => { errors.push(e.message); console.log('popup error', e.message); });
await pop.setViewport({ width: 340, height: 640, deviceScaleFactor: 2 });
await pop.goto(`chrome-extension://${id}/popup.html`);
await wait(800);
await pop.screenshot({ path: out('popup-main.png'), fullPage: true });
await pop.screenshot({ path: path.join(root, 'docs/img/popup.png'), fullPage: true });
console.log('popup mode hint:', await pop.$eval('#modeHint', e => e.textContent));
assert.equal(errors.length, 0, 'no page errors: ' + errors.join(' | '));
console.log('studio ok');
await b.close();
