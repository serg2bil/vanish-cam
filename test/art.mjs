// Makes the Chrome Web Store pictures: 3 screenshots 1280x800, promo tile 440x280, marquee 1400x560.
// Usage: node test/art.mjs <chrome.exe>   (output: store/img/*.png, 24-bit, no alpha)
import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const img = f => path.join(root, 'store', 'img', f);
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<video id=v autoplay muted></video>'); }).listen(8769);
const b = await puppeteer.launch({ executablePath: process.argv[2], headless: true, enableExtensions: true, protocolTimeout: 120000, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', '6-hands-waving.mjpeg')}`,
  `--use-file-for-fake-audio-capture=${path.join(root, 'test-clips', '6-hands-waving.wav')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));
const page = await b.newPage();
await page.goto('http://localhost:8769/');
await page.evaluate(async () => { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }); });
await new Promise(r => setTimeout(r, 12000));

const pop = await b.newPage();
await pop.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
await pop.goto(`chrome-extension://${id}/popup.html`);
const tab = await pop.evaluate(async () => {
  for (const t of await chrome.tabs.query({})) {
    if (await new Promise(r => chrome.tabs.sendMessage(t.id, { cmd: 'status' }, x => { void chrome.runtime.lastError; r(!!x); }))) return t.id;
  }
});
await pop.evaluate(t => { tabId = t; }, tab);
await new Promise(r => setTimeout(r, 1500));
const shot = async () => (await pop.screenshot({ fullPage: true, encoding: 'base64' }));
const main = await shot();
await pop.click('#gear');
await new Promise(r => setTimeout(r, 300));
const adv = await shot();
await pop.evaluate(() => scrollTo(0, 0));

const icon = fs.readFileSync(path.join(root, 'vanish-cam/icons/128.png')).toString('base64');
const css = `*{box-sizing:border-box;margin:0}body{font-family:"Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#4b2bd6,#8b6dff);overflow:hidden}
h1{font-weight:800;letter-spacing:-.02em}p{opacity:.9}.pop{border-radius:14px;box-shadow:0 18px 50px #0006;height:740px;object-fit:cover;object-position:top}`;
const shotPage = (title, text, png) => `<style>${css}body{width:1280px;height:800px;display:flex;align-items:center;justify-content:center;gap:90px;padding:0 90px}
.t{flex:1}.t h1{font-size:60px;line-height:1.1}.t p{font-size:26px;margin-top:22px;line-height:1.4}</style>
<div class=t><h1>${title}</h1><p>${text}</p></div><img class=pop width=360 src="data:image/png;base64,${png}">`;
const list = ['✌️ at the chest (the meme)', 'Hand seals ✌️ → ✊ → ✋', 'Finger snap', 'Button or Alt+Shift+H'];
const gesturePage = `<style>${css}body{width:1280px;height:800px;padding:90px}h1{font-size:60px}ul{list-style:none;padding:0;margin-top:50px}
li{font-size:40px;background:#fff2;border-radius:18px;padding:22px 32px;margin-bottom:22px;max-width:760px}</style>
<h1>Vanish with a gesture</h1><ul>${list.map(x => `<li>${x}</li>`).join('')}</ul>`;
const tile = (w, h) => `<style>${css}body{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${h / 20}px}
img{width:${h * 0.32}px}h1{font-size:${h * 0.14}px}p{font-size:${h * 0.07}px;max-width:${w * 0.8}px}</style>
<img src="data:image/png;base64,${icon}"><h1>Vanish Cam</h1><p>Disappear from your video call with a gesture</p>`;

const cv = await b.newPage();
const make = async (name, w, h, html) => {
  await cv.setViewport({ width: w, height: h });
  await cv.setContent(html);
  const raw = img(name + '.raw.png');
  await cv.screenshot({ path: raw });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-pix_fmt', 'rgb24', img(name + '.png')]); // drop alpha
  fs.unlinkSync(raw);
};
await make('screenshot-1', 1280, 800, shotPage('Pick a gesture and sounds', 'Simple settings for every day.', main));
await make('screenshot-2', 1280, 800, gesturePage);
await make('screenshot-3', 1280, 800, shotPage('Fine-tune everything', 'Timings, thresholds, GPU or CPU, fast or high-quality cutout.', adv));
await make('promo-440x280', 440, 280, tile(440, 280));
await make('marquee-1400x560', 1400, 560, tile(1400, 560));
await b.close(); srv.close();
console.log('done');
