// Runs the hand model over every frame of a video and saves the landmarks, so gesture logic
// can be tuned offline (node test/hands-score.mjs) without re-running the model.
// Usage: node test/hands-dump.mjs <chrome.exe> <video.mp4> <out.json> [width=640] [every=1] [conf=0.3]
//   every = feed only every Nth frame (simulates the model running slower than the camera)
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const [, , chrome, video, out, width = '640', every = '1', conf = '0.3'] = process.argv;

const page = `<video id=v muted playsinline></video><script type=module>
import { FilesetResolver, HandLandmarker, FaceDetector } from '/vanish-cam/lib/vision_bundle.mjs';
window.run = async (W, every, conf) => {
  const fileset = { wasmLoaderPath: '/vanish-cam/lib/wasm/vision_wasm_internal.js', wasmBinaryPath: '/vanish-cam/lib/wasm/vision_wasm_internal.wasm' };
  const hands = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/vanish-cam/models/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: conf, minHandPresenceConfidence: conf, minTrackingConfidence: conf,
  });
  const faces = await FaceDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: '/vanish-cam/models/face_detector.tflite', delegate: 'GPU' }, runningMode: 'VIDEO',
  });
  v.src = URL.createObjectURL(await (await fetch('/video.mp4')).blob()); // blob: seeking works without HTTP range support
  await new Promise(r => v.onloadedmetadata = r);
  const H = Math.round(W * v.videoHeight / v.videoWidth);
  const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  const frames = [], n = Math.floor(v.duration * 30);
  for (let i = 0; i < n; i += every) {
    v.currentTime = (i + 0.5) / 30;
    await new Promise(r => v.onseeked = r);
    x.drawImage(v, 0, 0, W, H);
    const res = hands.detectForVideo(c, i * 1000 / 30);
    const fb = faces.detectForVideo(c, i * 1000 / 30).detections[0]?.boundingBox;
    const face = fb ? { x: +(fb.originX / W).toFixed(4), y: +(fb.originY / H).toFixed(4), w: +(fb.width / W).toFixed(4), h: +(fb.height / H).toFixed(4) } : null;
    const r3 = p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) });
    frames.push({ i, t: +(i / 30).toFixed(2), face,
      hands: res.landmarks.map((lm, k) => ({ lm: lm.map(r3), world: res.worldLandmarks[k].map(r3), score: +res.handedness[k][0].score.toFixed(3) })) });
  }
  return { W, H, every, conf, frames };
};
window.ready = true;
</script>`;

const srv = http.createServer((q, r) => {
  if (q.url === '/') { r.setHeader('content-type', 'text/html'); return r.end(page); }
  const f = q.url === '/video.mp4' ? video : path.join(root, decodeURIComponent(q.url));
  if (!fs.existsSync(f)) { r.statusCode = 404; return r.end(); }
  const type = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.mp4': 'video/mp4' }[path.extname(f)] ?? 'application/octet-stream';
  r.setHeader('content-type', type);
  fs.createReadStream(f).pipe(r);
}).listen(8766);

const b = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 600000,
  args: ['--enable-unsafe-webgpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto('http://localhost:8766/');
await p.waitForFunction('window.ready');
const t0 = Date.now();
const data = await p.evaluate((w, e, c) => window.run(w, e, c), +width, +every, +conf);
fs.writeFileSync(out, JSON.stringify(data));
console.log(`saved ${data.frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${out}`);
await b.close(); srv.close();
