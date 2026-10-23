// Mic-only getUserMedia (separate from the camera call) must carry the sound effect.
// Usage: node test/audio.mjs <chrome.exe>
import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';
import assert from 'assert/strict';

const root = path.resolve(import.meta.dirname, '..');
const chrome = process.argv[2];
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<video id=v autoplay muted></video>'); }).listen(8768);
const b = await puppeteer.launch({ executablePath: chrome, headless: true, enableExtensions: true, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', '6-hands-waving.mjpeg')}`,
  `--use-file-for-fake-audio-capture=${path.join(root, 'test-clips', '6-hands-waving.wav')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));

const pop = await b.newPage();
await pop.goto(`chrome-extension://${id}/popup.html`);
await new Promise(r => setTimeout(r, 1500)); // let the popup finish importing local sounds
await pop.evaluate(async () => { // 1.5 s loud 440 Hz wav as "my sound 1"
  const n = 24000 * 1.5, buf = new ArrayBuffer(44 + n * 2), d = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true);
  d.setUint16(22, 1, true); d.setUint32(24, 24000, true); d.setUint32(28, 48000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
  w(36, 'data'); d.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.sin(i * 2 * Math.PI * 440 / 24000) * 30000, true);
  let bin = ''; new Uint8Array(buf).forEach(x => bin += String.fromCharCode(x));
  await chrome.storage.local.set({ sounds: [{ id: 'mine1', name: 't', b64: btoa(bin) }], seeded: true, settings: { vanishSound: 'mine1', appearSound: 'off', mode: 'off' } });
});

const page = await b.newPage();
await page.goto('http://localhost:8768/');
const peak = await page.evaluate(async () => {
  v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }); // camera call, no audio
  const mic = await navigator.mediaDevices.getUserMedia({ audio: true });                          // separate mic call
  const ac = new AudioContext(), an = ac.createAnalyser();
  ac.createMediaStreamSource(mic).connect(an);
  const buf = new Float32Array(an.fftSize);
  const peak = () => { an.getFloatTimeDomainData(buf); return Math.max(...buf.map(Math.abs)); };
  let before = 0;
  for (let i = 0; i < 20; i++) { before = Math.max(before, peak()); await new Promise(r => setTimeout(r, 25)); }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', code: 'KeyH', altKey: true, shiftKey: true, bubbles: true }));
  let during = 0;
  for (let i = 0; i < 60; i++) { during = Math.max(during, peak()); await new Promise(r => setTimeout(r, 25)); }
  return { before, during };
});
console.log(peak);
assert.ok(peak.during > 0.2 && peak.during > peak.before * 3, 'the effect is in the mic-only stream');
console.log('audio ok');
await b.close(); srv.close();
