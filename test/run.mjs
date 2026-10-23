// Feeds each test clip to Chrome as a fake camera+mic, runs the extension, records its output.
// Usage: node test/run.mjs <chrome.exe> [clip-name-filter]
// Needs puppeteer-core (npm i puppeteer-core) and Chrome for Testing (branded Chrome ignores --load-extension).
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const [, , chrome, filter = '', mode = ''] = process.argv; // mode "debug" records the mask instead
const clipsDir = path.join(root, 'test-clips'), outDir = path.join(root, 'test-out');
fs.mkdirSync(outDir, { recursive: true });

const html = `<video id=v autoplay muted playsinline></video><script>
window.record = async (ms, toggleAt) => {
  const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
  v.srcObject = s;
  await new Promise(r => setTimeout(r, 15000)); // models load (RVM compiles shaders on first run)
  const rec = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 4e6 });
  const chunks = []; rec.ondataavailable = e => chunks.push(e.data); rec.start();
  if (toggleAt >= 0) setTimeout(() => dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyH' })), toggleAt);
  if (toggleAt >= 0 && window.TOGGLE2) setTimeout(() => dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyH' })), window.TOGGLE2);
  await new Promise(r => setTimeout(r, ms)); rec.stop(); await new Promise(r => rec.onstop = r);
  const b = new Uint8Array(await new Blob(chunks).arrayBuffer());
  let s2 = ''; for (let i = 0; i < b.length; i += 0x8000) s2 += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s2);
};</script>`;
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(html); }).listen(8765);

for (const f of fs.readdirSync(clipsDir).filter(f => f.endsWith('.mjpeg') && f.includes(filter))) {
  const name = f.replace('.mjpeg', '');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 90000, args: [
    '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=d3d11',
    `--disable-extensions-except=${path.join(root, 'vanish-cam')}`, `--load-extension=${path.join(root, 'vanish-cam')}`,
    '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
    `--use-file-for-fake-video-capture=${path.join(clipsDir, f)}`,
    `--use-file-for-fake-audio-capture=${path.join(clipsDir, name + '.wav')}`] });
  const p = await b.newPage();
  p.on('console', m => m.text().includes('Vanish') && console.log(`  [${name}]`, m.text().replace(/%c|color:#a0f/g, '')));
  p.on('pageerror', e => console.log(`  [${name}] pageerror`, e.message));
  await p.goto('http://localhost:8765/');
  if (process.env.TOGGLE2) await p.evaluate(ms => { window.TOGGLE2 = ms; }, +process.env.TOGGLE2); // second toggle (appear) for sound tests
  // Snap clip: let the snap detector decide. Others: vanish 1 s into the recording.
  if (mode === 'debug') await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyD' })));
  if (mode === 'gestures') await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { altKey: true, shiftKey: true, code: 'KeyG' })));
  const data = await p.evaluate((ms, t) => window.record(ms, t), +(process.env.REC_MS ?? 8000), name.includes('snap') || mode ? -1 : 1000);
  fs.writeFileSync(path.join(outDir, name + (mode ? '-' + mode : '') + '.webm'), Buffer.from(data, 'base64'));
  await p.screenshot({ path: path.join(outDir, name + (mode ? '-' + mode : '') + '.png') }); // shows the panel too
  console.log('saved', name);
  await b.close();
}
srv.close();
