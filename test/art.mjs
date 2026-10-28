// Makes the Chrome Web Store pictures: 4 screenshots 1280x800, promo tile 440x280, marquee 1400x560.
// Usage: node test/art.mjs <chrome.exe>   (output: store/img/*.png, 24-bit, no alpha)
// No real person or room in them: the camera picture is a drawn scene (test/art-scene.js) and the
// effects run on it with the extension's own effect code. The studio's hand tracking and motion path
// come from the landmark dump test-out/hands/v6-gestures.json (numbers only, see test/hands-dump.mjs);
// the extension still needs a camera to start, test-clips/9-many-gestures.* (never shown).
import puppeteer from 'puppeteer-core';
import http from 'http';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { execFileSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const img = f => path.join(root, 'store', 'img', f);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));
const clip = '9-many-gestures';

// The goodbye wave and a swipe, recorded offline from the dump; one frame of it for the studio picture.
const ctx = {};
vm.runInNewContext(['vanish-cam/settings.js', 'vanish-cam/gestures.js'].map(read).join('\n') + ';globalThis.rec = recordGesture; globalThis.GD = GESTURE_DEFAULTS;', ctx);
const frames = JSON.parse(read('test-out/hands/v6-gestures.json')).frames.map(f => ({ lms: f.hands.map(h => h.lm), world: f.hands.map(h => h.world), t: f.t * 1000, face: f.face }));
const take = (a, b) => ctx.rec(frames.filter(f => f.t >= a * 1000 && f.t <= b * 1000));
const gestures = [
  { id: 'g1', name: 'Goodbye wave', icon: 'smile', ...ctx.GD, ...take(3.9, 7.3) },
  { id: 'g2', name: 'Swipe away', icon: 'zap', ...ctx.GD, ...take(49.6, 52.3), when: 'vanish' },
];
const now = frames.find(f => f.t >= 4400 && f.lms.length === 1 && f.face);
const trail = frames.filter(f => f.t >= 3950 && f.t <= now.t && f.lms.length === 1).map(f => f.lms[0]);

const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end('<video id=v autoplay muted></video>'); }).listen(8769);
const b = await puppeteer.launch({ executablePath: process.argv[2], headless: true, enableExtensions: true, protocolTimeout: 180000, args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required',
  '--enable-unsafe-webgpu', '--use-angle=d3d11',
  `--use-file-for-fake-video-capture=${path.join(root, 'test-clips', clip + '.mjpeg')}`,
  `--use-file-for-fake-audio-capture=${path.join(root, 'test-clips', clip + '.wav')}`] });
const id = await b.installExtension(path.join(root, 'vanish-cam'));

// ---- effects on the drawn person ----
const cv = await b.newPage();
await cv.setContent('<body style="margin:0"></body>');
for (const f of ['vanish-cam/settings.js', 'vanish-cam/effects.js', 'test/art-scene.js']) await cv.addScriptTag({ content: read(f) });
// how far into each effect: half gone
const AT = { dust: 0.38, flash: 0.32, glitch: 0.45, zoom: 0.4, smoke: 0.38, shatter: 0.4, dissolve: 0.45, cut: 0.42 };
const fx = await cv.evaluate(AT => {
  const W = 1280, H = 720, mk = () => Object.assign(document.createElement('canvas'), { width: W, height: H });
  const bg = mk(), person = mk();
  scene.bg(bg);
  const face = { x: 0.43, y: 0.17, w: 0.14, h: 0.25 };
  scene.person(person, face);
  const o = { w: W, h: H, cx: W / 2, cy: (face.y + face.h * 1.8) * H, t: 1000, seed: 7, scratch: mk(), scratch2: mk(), scratch3: mk() };
  const shot = (id, p) => {
    const c = mk(), x = c.getContext('2d');
    x.drawImage(bg, 0, 0);
    EFFECTS[id](x, person, p, { ...o, opt: effectOpts(id, DEFAULTS) });
    return c.toDataURL();
  };
  const out = { hero: shot('dust', 0.34) };
  for (const [id] of EFFECT_LIST) out[id] = shot(id, AT[id]);
  out.names = Object.fromEntries(EFFECT_LIST.map(e => [e[0], e[2]]));
  return out;
}, AT);

// ---- the studio, with the drawn scene where the camera picture is ----
const st = await b.newPage();
await st.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await st.goto(`chrome-extension://${id}/studio.html`);
await st.evaluate(g => new Promise(r => chrome.storage.local.set({ settings: { lang: 'en', mode: 'custom', gestures: g, effect: 'dust', vanishSound: 'syn:whoosh', appearSound: 'syn:pop' } }, r)), gestures);
await st.reload();
await wait(15000);
await st.evaluate(read('test/art-scene.js'));
await st.evaluate(({ now, trail }) => {
  S.onFrame = null; // the real camera no longer drives the picture
  window.watchHands = () => {}; // nor the gestures
  $('cam').style.visibility = 'hidden';
  const c = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
  $('overlay').before(c);
  scene.bg(c);
  const p = Object.assign(document.createElement('canvas'), { width: 1280, height: 720 });
  scene.person(p, now.face, now.lms[0]);
  c.getContext('2d').drawImage(p, 0, 0);
  frameInfo = { hands: { landmarks: now.lms, worldLandmarks: now.world }, face: now.face };
  const tr = custom[0].tracker;
  tr.reset();
  for (const lm of trail) tr.state.path.push({ ...palmAt([lm]), t: 0 }); // the wave so far, in green
  drawOverlay();
}, { now, trail });
await wait(500);
const studio = await st.screenshot({ encoding: 'base64' });

// ---- popup, next to a page that uses the camera ----
const page = await b.newPage();
await page.goto('http://localhost:8769/');
await page.evaluate(async () => { v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }); });
await wait(4000);
const pop = await b.newPage();
await pop.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
await pop.goto(`chrome-extension://${id}/popup.html`);
const tab = await pop.evaluate(async () => {
  for (const t of await chrome.tabs.query({})) {
    if (await new Promise(r => chrome.tabs.sendMessage(t.id, { cmd: 'status' }, x => { void chrome.runtime.lastError; r(!!x); }))) return t.id;
  }
});
await pop.evaluate(t => { tabId = t; }, tab);
await wait(2000);
const popup = await pop.screenshot({ fullPage: true, encoding: 'base64' });

// ---- the pictures ----
const icon = fs.readFileSync(path.join(root, 'vanish-cam/icons/128.png')).toString('base64');
const png = s => `data:image/png;base64,${s}`;
const css = `*{box-sizing:border-box;margin:0}body{font-family:"Segoe UI",system-ui,sans-serif;color:#fff;background:linear-gradient(135deg,#4b2bd6,#8b6dff);overflow:hidden}
h1{font-weight:800;letter-spacing:-.02em}p{opacity:.92}.shot{border-radius:16px;box-shadow:0 18px 50px #0006;display:block}`;
// title on top, a big picture under it
const framed = (title, text, src, w) => `<style>${css}body{width:1280px;height:800px;padding:56px 70px 0;display:flex;flex-direction:column;align-items:center;text-align:center}
h1{font-size:50px;line-height:1.1}p{font-size:23px;margin:14px 0 34px;max-width:1000px;line-height:1.35}</style>
<h1>${title}</h1><p>${text}</p><img class=shot width=${w} src="${src}">`;
// text on the left, a tall picture on the right
const side = (title, text, src) => `<style>${css}body{width:1280px;height:800px;display:flex;align-items:center;justify-content:center;gap:90px;padding:0 90px}
.t{flex:1}.t h1{font-size:58px;line-height:1.1}.t p{font-size:25px;margin-top:22px;line-height:1.4}.shot{height:740px;object-fit:cover;object-position:top}</style>
<div class=t><h1>${title}</h1><p>${text}</p></div><img class=shot width=360 src="${src}">`;
const grid = `<style>${css}body{width:1280px;height:800px;padding:52px 64px 0;text-align:center}h1{font-size:50px}p{font-size:23px;margin:12px 0 30px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:22px 18px}.g img{width:100%;border-radius:12px;box-shadow:0 10px 30px #0005;display:block}
.g b{display:block;font-size:19px;margin-top:9px;font-weight:600}</style>
<h1>8 effects, like in a video editor</h1><p>Each one with its own duration and sliders. Pick one and see it on yourself in the studio.</p>
<div class=g>${Object.keys(AT).map(k => `<div><img src="${fx[k]}"><b>${fx.names[k]}</b></div>`).join('')}</div>`;
const tile = (w, h) => `<style>${css}body{width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${h / 20}px}
img{width:${h * 0.32}px}h1{font-size:${h * 0.14}px}p{font-size:${h * 0.07}px;max-width:${w * 0.8}px}</style>
<img src="${png(icon)}"><h1>Vanish Cam</h1><p>Disappear from your video call with a gesture</p>`;

const make = async (name, w, h, html) => {
  await cv.setViewport({ width: w, height: h });
  await cv.setContent(html);
  await wait(200);
  const raw = img(name + '.raw.png');
  await cv.screenshot({ path: raw });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-pix_fmt', 'rgb24', img(name + '.png')]); // drop alpha
  fs.unlinkSync(raw);
};
for (const f of fs.readdirSync(path.join(root, 'store', 'img'))) if (/^screenshot-\d\.png$/.test(f)) fs.unlinkSync(img(f));
await make('screenshot-1', 1280, 800, framed('Vanish from your video call with a gesture',
  'Turn to dust like the Thanos snap, glitch out or teleport away. Works in Meet, Zoom, Teams and any web call.', fx.hero, 1000));
await make('screenshot-2', 1280, 800, framed('Record your own gesture',
  'Hold a pose or do a motion: wave goodbye, swipe, circle. The studio shows what the camera sees, before the call.', png(studio), 1040));
await make('screenshot-3', 1280, 800, grid);
await make('screenshot-4', 1280, 800, side('On, off, effect and sounds in one click',
  'Built-in sounds or your own files. Everything runs on your computer: no account, nothing is sent anywhere.', png(popup)));
await make('promo-440x280', 440, 280, tile(440, 280));
await make('marquee-1400x560', 1400, 560, tile(1400, 560));
await b.close(); srv.close();
console.log('done');
