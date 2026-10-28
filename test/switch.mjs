// Switches the cutout model and the compute device back and forth in the studio (also rapidly)
// and checks that each set really loads and keeps answering. Usage: node test/switch.mjs <chrome.exe>
import puppeteer from 'puppeteer-core';
import assert from 'assert/strict';
import path from 'path';
const root = 'D:/MyProjects/vanish-cam', clip = '9-many-gestures';
const wait = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: process.argv[2], headless: true, enableExtensions: true, protocolTimeout: 180000, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', clip + '.mjpeg')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));
const page = await b.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errs = [];
page.on('pageerror', e => { errs.push(e.message); console.log('  PAGE ERROR', e.message); });
page.on('console', m => { const t = m.text().replace(/%c|color:#a0f/g, ''); if (/XNNPACK/.test(t)) return; if (m.type() === 'error' || /Vanish/.test(t)) console.log('  ', m.type(), t.slice(0, 200)); });
await page.goto(`chrome-extension://${id}/studio.html`);
await page.evaluate(() => new Promise(r => chrome.storage.local.set({ settings: { lang: 'en' } }, r)));
await page.reload();
await wait(12000);
const probe = async label => {
  let hands = 0, masks = 0;
  for (let i = 0; i < 30; i++) { await wait(100); if (await page.evaluate(() => frameInfo.hands.landmarks.length)) hands++; }
  const st = await page.evaluate(() => ({ status: S.status, ready: mlReady, perf: PERF.out, dev: $('device').value, seg: $('segModel').value, cfg: CFG.device + '|' + CFG.segModel, toggle: $('toggle').disabled }));
  console.log(label.padEnd(22), st.status, '| jobs/s', st.perf.jobs, '| hands', hands + '/30');
  assert.ok(st.status.startsWith(st.seg === 'rvm' ? 'RVM' : 'simple'), label + ': cutout model ' + st.status);
  assert.ok(st.status.includes(st.dev === 'cpu' ? 'hands CPU' : 'hands GPU'), label + ': device ' + st.status);
  const j0 = await page.evaluate(() => PERF.n); await wait(1500);
  assert.ok(await page.evaluate(() => PERF.n) !== j0 || st.perf.jobs > 0, label + ': models answer');
};
const set = async (k, v) => { await page.select('#' + k, v); };
await probe('start');
for (const [k, v] of [['segModel', 'simple'], ['device', 'cpu'], ['segModel', 'rvm'], ['device', 'auto'], ['segModel', 'simple'], ['segModel', 'rvm']]) {
  await set(k, v); await wait(9000); await probe(`${k}=${v}`);
}
console.log('-- rapid');
await set('device', 'cpu'); await wait(150); await set('device', 'auto'); await wait(150); await set('segModel', 'simple'); await wait(150); await set('segModel', 'rvm');
await wait(12000); await probe('after rapid');
await set('device', 'cpu'); await wait(9000); await probe('cpu again');
assert.equal(errs.length, 0, 'no page errors');
console.log('switch ok');
await b.close();
