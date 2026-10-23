// Compares model speed for each "Compute" / cutout-model setting on one clip.
// Usage: node test/perf.mjs <chrome.exe> [clip=6-hands-waving]
import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const [, , chrome, clip = '6-hands-waving'] = process.argv;
const ext = path.join(root, 'vanish-cam');
// PAGE_CSP=meet: Google Meet's page rules (strict-dynamic, Trusted Types); =noworker: workers forbidden.
const PAGE_CSP = {
  meet: [
    "script-src 'report-sample' 'nonce-t' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; object-src 'none'; base-uri 'self'",
    "script-src 'unsafe-inline' 'unsafe-eval' blob: data: 'self' https://www.gstatic.com",
    "require-trusted-types-for 'script'",
  ],
  noworker: ["worker-src 'none'"],
}[process.env.PAGE_CSP];
const srv = http.createServer((q, r) => {
  r.setHeader('content-type', 'text/html');
  if (PAGE_CSP) r.setHeader('content-security-policy', PAGE_CSP);
  r.end('<video id=v autoplay muted></video><script nonce=t>navigator.mediaDevices.getUserMedia({video:{width:1280,height:720},audio:true}).then(s=>v.srcObject=s)</script>');
}).listen(0); // any free port: other test runs may be using fixed ones
await new Promise(r => srv.once('listening', r));
const port = srv.address().port;

// CASES="gpu:rvm,cpu:simple" picks some; SETTLE=ms waits longer before measuring.
const CASES = (process.env.CASES ?? 'gpu:rvm,cpu:rvm,gpu:simple,cpu:simple').split(',').map(c => c.split(':'));
const SETTLE = +(process.env.SETTLE ?? 5000);
const b = await puppeteer.launch({ executablePath: chrome, headless: true, pipe: true, enableExtensions: true, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', clip + '.mjpeg')}`] });
const id = await b.installExtension(ext);
const popup = await b.newPage();
await popup.goto(`chrome-extension://${id}/popup.html`);
const page = await b.newPage();
if (process.env.VERBOSE) { // page + model worker messages
  const clean = t => t.replace(/%c|color:#a0f/g, '');
  page.on('console', m => console.log('  page:', clean(m.text())));
  page.on('pageerror', e => console.log('  pageerror:', e.message));
  page.on('workercreated', w => w.on('console', m => console.log('  worker:', clean(m.text()))));
}
await page.goto(`http://localhost:${port}/`);
const status = () => popup.evaluate(async port => {
  const me = await chrome.tabs.getCurrent(); // no "tabs" permission: tab URLs are hidden, so pick the other tab
  const tab = (await chrome.tabs.query({})).filter(t => t.id !== me.id).pop();
  return chrome.tabs.sendMessage(tab.id, { cmd: 'status' }).catch(e => ({ error: e.message }));
}, port);

console.log('setting            loaded models                                      cutout  hands  face  runs/s  video fps');
for (const [device, segModel] of CASES) {
  await popup.evaluate(s => new Promise(r => chrome.storage.local.get('settings', x => chrome.storage.local.set({ settings: { ...x.settings, ...s } }, r))),
    { device, segModel, mode: 'meme', gdebug: false });
  let st;
  for (let i = 0; i < 60; i++) { // wait for the new models
    await new Promise(r => setTimeout(r, 1000));
    st = await status();
    if (st?.status && !st.status.startsWith('loading')) break;
  }
  await new Promise(r => setTimeout(r, SETTLE)); // let timings settle
  st = await status();
  const p = st.perf ?? {};
  console.log(`${device} + ${segModel}`.padEnd(19), String(st.status).padEnd(50), String(p.seg).padStart(6), String(p.hands).padStart(6), String(p.face).padStart(5), String(p.jobs).padStart(7), String(st.fps).padStart(10));
}
await b.close();
srv.close();
