// Extension world: cut the person out of the camera; toggle by gesture, Alt+Shift+H or the popup.
// Heavy per-pixel work happens on a small 384px mask; full-size compositing uses GPU canvas ops.
// Settings come from settings.js (CFG) and change live when the popup saves them.

// Fixed tuning (ponytail: not in the popup; tweak here for unusual cameras/rooms).
// Model and mask tuning lives in ml.js.
const WARMUP = 30;       // skip learning on the first frames: cameras start dark while exposure settles
const MW = 384, MH = 224; // mask size coming back from ml.js

const url = p => chrome.runtime.getURL(p);
const log = (...a) => console.log('%c[Vanish Cam]', 'color:#a0f', ...a);
// MediaPipe prints harmless GL notes as warnings; Chrome lists them as extension "errors".
const warn = console.warn;
console.warn = (...a) => { if (!/gl_context|OpenGL error checking/.test(String(a[0]))) warn(...a); };

// Runtime state of this page (settings are in CFG).
// onFrame / noPanel are set by the studio page, which runs this same pipeline on its own camera.
const S = { hidden: false, gestureInfo: '', captureAt: 0, status: 'loading models…', fps: 0, snapInfo: '', cams: 0, onFrame: null, noPanel: false };
let preSnapAt = -1e9, preSnap2At = -1e9, ui, lastMode = null, custom = [], customKey = '', effectSeed = 1;

// ---------- models: ml.js, in a worker so the video never waits for them ----------
// Changing CFG.device ("Compute") or CFG.segModel loads a new set in a NEW worker while the old
// one keeps serving; when the new one is ready the old worker is closed. (Loading a new set into
// the same worker broke it: the GPU cutout model next to the old WebGPU one aborted the whole
// worker.) A worker that stops answering is restarted. If a page forbids workers, the same engine
// runs inline (then a new set loads in place).
let engine = null, nextEngine = null, mlReady = false, mlKey = null, jobBusy = false, jobAt = 0, lostJobs = 0;
const camHandlers = new Map(); // camera id -> applies a finished job to that camera's pipeline

function mlMessage(m, from) {
  if (from === nextEngine) { // the set being loaded in a new worker
    if (m.type === 'status' && m.ready) { // ready: it takes over, the old worker goes
      const old = engine;
      engine = nextEngine; nextEngine = null;
      old?.kill();
      jobBusy = false; lostJobs = 0;
    } else if (m.type === 'error') {
      S.status = 'load error: ' + m.message;
      nextEngine.kill(); nextEngine = null; mlKey = null; // try again on the next settings change
      return ui?.sync();
    } else if (m.type !== 'status') return;
  } else if (from !== engine) return; // a worker that was already replaced
  if (m.type === 'status') {
    S.status = m.status + (engine?.inline ? ' · main thread' : '');
    if (m.ready) { mlReady = true; from.ready = true; Object.assign(PERF, { n: 0, seg: 0, hands: 0, face: 0, since: performance.now() }); }
  } else if (m.type === 'error') {
    S.status = 'load error: ' + m.message;
  } else if (m.type === 'result') {
    jobBusy = false; lostJobs = 0;
    if (m.error) console.error('[Vanish Cam] models:', m.error);
    else if (!m.skipped) camHandlers.get(m.cam)?.(m);
  }
  ui?.sync();
}

let workersBlocked = false;
function inlineEngine(why) {
  log('running models on the main thread:', why);
  workersBlocked = true;
  const eng = { inline: true, kill() {} };
  const handle = makeMlEngine(m => mlMessage(m, eng));
  eng.post = m => handle(m);
  return eng;
}
// A new model worker (or the inline engine if workers are not allowed here).
function spawnEngine() {
  if (workersBlocked) return inlineEngine('workers are blocked on this page');
  try {
    // Workers must be same-origin, so a tiny blob bootstraps ml.js from the extension.
    // Pages with Trusted Types (Meet) need the script URL to go through a policy.
    // (On the extension's own pages, like the studio, the worker URL can be used directly.)
    const u = JSON.stringify(url('ml.js'));
    const code = `const tt = self.trustedTypes?.createPolicy('vanish-cam', { createScriptURL: s => s });\nimportScripts(tt ? tt.createScriptURL(${u}) : ${u});`;
    const w = location.protocol === 'chrome-extension:' ? new Worker(url('ml.js')) : new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    const eng = { inline: false, post: (m, transfer) => w.postMessage(m, transfer), kill: () => w.terminate() };
    let alive = false;
    w.onmessage = e => { alive = true; mlMessage(e.data, eng); };
    w.onerror = e => {
      if (alive) return console.error('[Vanish Cam] model worker:', e.message);
      e.preventDefault(); // the page didn't let the worker start: run the models here instead
      const inl = inlineEngine(e.message);
      if (engine === eng) engine = inl; else if (nextEngine === eng) nextEngine = inl;
      mlKey = null; mlReady = false; jobBusy = false;
      ensureModels();
    };
    return eng;
  } catch (e) { return inlineEngine(e.message); }
}

function ensureModels() {
  if (!S.cams || !CFG.enabled) return;
  const key = `${CFG.device}|${CFG.segModel}`;
  if (key === mlKey && engine) return;
  mlKey = key;
  const load = { cmd: 'load', base: url(''), device: CFG.device, segModel: CFG.segModel };
  if (!engine || engine.inline) { // first load, or no workers: load in place
    engine ??= spawnEngine();
    return engine.post(load);
  }
  nextEngine?.kill(); // settings changed again before it was ready
  nextEngine = spawnEngine();
  nextEngine.post(load);
}

// The model worker stopped answering (a GPU driver hang, a crashed model): start a fresh one.
function restartEngine(why) {
  console.error('[Vanish Cam] models stopped answering, restarting them:', why);
  engine?.kill(); nextEngine?.kill();
  engine = nextEngine = null; mlKey = null; jobBusy = false; lostJobs = 0; // mlReady stays: the last mask keeps you hidden meanwhile
  S.status = 'restarting models…';
  ensureModels();
}

// Speed: average ms per model run and model runs per second, over the last second.
const PERF = { n: 0, seg: 0, hands: 0, face: 0, since: 0, out: { seg: 0, hands: 0, face: 0, jobs: 0 } };
function perfAdd(seg, hands, face) {
  PERF.n++; PERF.seg += seg; PERF.hands += hands; PERF.face += face;
  const now = performance.now(), dt = now - PERF.since;
  if (dt < 1000) return;
  const avg = v => Math.round(v / PERF.n);
  PERF.out = { seg: avg(PERF.seg), hands: avg(PERF.hands), face: avg(PERF.face), jobs: Math.round(PERF.n * 1000 / dt) };
  Object.assign(PERF, { n: 0, seg: 0, hands: 0, face: 0, since: now });
}
const snapLoudness = () => 0.4 - CFG.snapSens / 100 * 0.37; // sens 0..100 -> 0.40..0.03

function applySettings(saved) {
  Object.assign(CFG, DEFAULTS, saved);
  if (CFG.mode !== lastMode) { // new gesture mode: forget half-done gestures
    lastMode = CFG.mode;
    Object.values(trackers).forEach(t => t.reset());
    memeHold.reset();
    S.gestureInfo = '';
  }
  const gk = JSON.stringify(CFG.gestures);
  if (gk !== customKey) { // your own gestures changed: one hold tracker per gesture
    customKey = gk;
    custom = CFG.gestures.map(g => ({ g, tracker: g.move?.path // (a motion from an older version has no path: it counts as a pose)
      ? makeMoveTracker(g, { cooldownMs: 1500 }) // the pose travelling the recorded way
      : makeHoldTracker((lm, all) => gestureScore(g, g.hands === 2 ? all : [lm]) >= 0.5, () => ({ holdMs: g.hold, cooldownMs: 1500 })) }));
  }
  if (!CFG.enabled) { S.hidden = false; S.captureAt = 0; } // switched off: you are back in the picture at once
  if (S.cams) { soundFor(CFG.vanishSound).catch(() => {}); soundFor(CFG.appearSound).catch(() => {}); } // ready before the gesture
  if (mix?.call) mix.call.gain.value = CFG.callVolume;
  if (mix) mix.local.gain.value = CFG.localVolume;
  if (S.cams && CFG.enabled && (CFG.panel || CFG.gdebug)) makePanel();
  ensureModels();
  ui?.sync();
}
// One write per change: two saves at once would both read the old settings and the last one wins.
const saveSettings = patch => chrome.storage.local.get('settings', r => chrome.storage.local.set({ settings: { ...r.settings, ...patch } }));
const saveSetting = (key, value) => saveSettings({ [key]: value });

const toggle = () => { S.hidden = !S.hidden; ui?.sync(); };

// Sound effects. Vanishing starts on the sound's hit; appearing finishes fading in on its hit
// (with "reversed" the hit is at the end). Hit times are found in the audio itself.
// Sounds are mixed into the mic you send (the call hears them) and played on your speakers.
// Sounds are files the user added in the popup: chrome.storage.local 'sounds' = [{ id, name, b64 }].
let mix = null, pending = false;
let sounds = {}; // slot -> Promise<{ fwd, rev, hit, revHit }>

// One AudioContext for the page: your speakers, plus every mic stream the site asked for
// (a video call and a separate audio call both get the effect).
function getMix() {
  if (mix) return mix;
  const ac = new AudioContext();
  const call = new GainNode(ac, { gain: CFG.callVolume });
  const local = new GainNode(ac, { gain: CFG.localVolume });
  local.connect(ac.destination);
  // Autoplay rules keep audio paused until you click or press a key on the page; until then
  // the mic sent to the call is silent, so resume at the first chance.
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => ac.resume().catch(() => {}), true); // a closed context rejects
  ac.resume();
  return mix = { ac, call, local };
}

function setupMix(mic) {
  const m = getMix();
  const dest = m.ac.createMediaStreamDestination();
  m.ac.createMediaStreamSource(new MediaStream([mic])).connect(dest);
  m.call.connect(dest); // the effect goes into this mic stream
  return dest.stream.getAudioTracks()[0];
}

function loadSound(slot) {
  getMix();
  const built = slot.startsWith('syn:') && SYNTH[slot.slice(4)];
  return sounds[slot] ??= (built ? built(mix.ac.sampleRate) : chrome.storage.local.get('sounds').then(r => {
    const item = (r.sounds ?? []).find(x => x.id === slot);
    if (!item) return null;
    return mix.ac.decodeAudioData(Uint8Array.from(atob(item.b64), c => c.charCodeAt(0)).buffer);
  })).then(fwd => {
    if (!fwd) return null;
    const { hit, cut } = soundHit(fwd.getChannelData(0), fwd.sampleRate);
    const n = Math.max(1, Math.round(cut * fwd.sampleRate)); // drop the near-silent tail before reversing
    const rev = new AudioBuffer({ length: n, sampleRate: fwd.sampleRate, numberOfChannels: fwd.numberOfChannels });
    for (let c = 0; c < fwd.numberOfChannels; c++) rev.getChannelData(c).set(fwd.getChannelData(c).slice(0, n).reverse());
    return { fwd, rev, hit, revHit: cut - hit };
  });
}

// 'sound-id' | 'sound-id:rev' | 'syn:id' | 'syn:id:rev' | 'off' -> { buffer, hit } or null
async function soundFor(choice) {
  const parts = (choice ?? 'off').split(':'), rev = parts.at(-1) === 'rev' && parts.pop();
  const name = parts.join(':');
  if (name === 'off') return null;
  const s = await loadSound(name);
  if (!s) return null; // nothing loaded in this slot: silent
  return rev ? { buffer: s.rev, hit: s.revHit } : { buffer: s.fwd, hit: s.hit };
}

function play(buffer, skip = 0) {
  mix.ac.resume();
  const src = new AudioBufferSourceNode(mix.ac, { buffer });
  src.connect(mix.local);
  if (mix.call) src.connect(mix.call);
  src.start(0, skip);
}

// How long the chosen effect runs (the "dissolve duration" setting × the effect's own length).
const fadeMs = () => effectOpts(CFG.effect, CFG).ms;
const LEAD = 60; // ms between the gesture and the effect starting, at most (unless you set a later offset)

// Every way of vanishing/appearing goes through here. The effect starts right away; the sound is
// started part-way in, so its hit lands where it should (vanish: when the effect starts; appear:
// when you are fully back) instead of making you wait through its build-up.
async function trigger() {
  if (pending || !CFG.enabled) return;
  pending = true;
  ui?.sync();
  const hiding = !S.hidden;
  try {
    const snd = await soundFor(hiding ? CFG.vanishSound : CFG.appearSound);
    if (snd) {
      const at = snd.hit * 1000 + (hiding ? CFG.vanishOffset : CFG.appearOffset - fadeMs()); // the switch, ms after the sound starts
      const skip = Math.max(0, Math.min(at - LEAD, snd.hit * 1000));
      play(snd.buffer, skip / 1000);
      await new Promise(r => setTimeout(r, Math.max(0, at - skip)));
    }
  } catch (e) {
    console.error('[Vanish Cam] sound', e);
  }
  pending = false;
  effectSeed = Math.random() * 1000; // each transition drifts a little differently
  toggle();
}

// The popup talks to the frame that has the camera; other frames stay silent.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!S.cams) return;
  if (msg.cmd === 'toggle') trigger();
  if (msg.cmd === 'captureBg') S.captureAt = performance.now() + CFG.captureDelay;
  reply({ enabled: CFG.enabled, hidden: S.hidden, pending, status: S.status, fps: S.fps, perf: PERF.out,
    captureIn: S.captureAt ? Math.max(0, S.captureAt - performance.now()) : 0, info: S.snapInfo || S.gestureInfo });
});

addEventListener('keydown', e => {
  if (!e.altKey || !e.shiftKey) return;
  if (e.code === 'KeyH') trigger(); // does nothing while the extension is off
  if (e.code === 'KeyD') S.debug = !S.debug; // show the raw mask (white = "you") for tuning
  if (e.code === 'KeyG') saveSetting('gdebug', !CFG.gdebug); // gesture debug on the page panel
}, true);

// How often the hand model runs and how often it finds a hand (shown in gesture debug).
const HS = { checks: 0, found: 0, trail: '', since: 0, rate: 0, pct: 0 };
function handStats(result, now) {
  HS.checks++;
  if (result.landmarks.length) HS.found++;
  const lm = result.landmarks[0];
  HS.trail += !lm ? '.' : isSnapPose(lm, result.worldLandmarks[0]) ? 'S' : ({ victory: 'V', fist: 'F', open: 'O' })[handPose(lm)] ?? '?';
  if (now - HS.since < 1000) return;
  HS.rate = Math.round(HS.checks * 1000 / (now - HS.since || 1));
  HS.pct = Math.round(100 * HS.found / (HS.checks || 1));
  if (CFG.gdebug) log(`hands: ${HS.rate}/s, found in ${HS.pct}%  ${HS.trail}`);
  Object.assign(HS, { checks: 0, found: 0, trail: '', since: now });
}

// Gesture modes: 'seals' / 'seals1' (pose sequence, two hands / one hand), 'snap2' (both hands snap), 'snap' (one hand), 'off'.
// Meme: ✌️ must fly in to the chest (or come into view there), held briefly; then a pause so the
// hand still at the chest after vanishing doesn't bring you straight back.
const memeHold = makeHoldTracker(isMemePose, () => ({
  holdMs: CFG.memeHold, graceMs: 250, arrive: { windowMs: 500, minMove: CFG.memeArrive }, cooldownMs: CFG.memeCooldown,
}));
const trackers = {
  seals: makeSealTracker(SEALS, () => ({ hands: 2, gap: CFG.sealGap })),
  seals1: makeSealTracker(SEALS, () => ({ hands: 1, gap: CFG.sealGap })),
};
// Settings load after the trackers exist (applySettings resets them on a mode change).
chrome.storage.local.get('settings', r => applySettings(r.settings));
chrome.storage.onChanged.addListener(ch => {
  if (ch.settings) applySettings(ch.settings.newValue);
  if (ch.sounds) sounds = {}; // the list changed
});
let snap1Hits = 0, snap2Hits = 0;
const snapGate = makeSnapGate();
function watchHands(result, now, face) {
  const lms = result.landmarks;
  if (CFG.mode === 'custom') { // your own gestures, each with its own tracker and its own job
    let best = 0, label = '';
    for (const { g, tracker } of custom) {
      const fired = tracker.update(lms, now, g.move?.path ? face : lms);
      const sc = lms.length ? gestureScore(g, lms) : 0;
      if (sc > best) { best = sc; label = g.name; }
      if (fired && (g.when === 'both' || (g.when === 'vanish') === !S.hidden)) trigger();
    }
    S.gestureInfo = best >= 0.5 ? `${label} ${Math.round(best * 100)}%` : '';
    return;
  }
  if (CFG.mode === 'meme') {
    if (memeHold.update(lms, now, face)) trigger();
    S.gestureInfo = memeHold.holding ? 'V…' : '';
    return;
  }
  const seals = trackers[CFG.mode];
  if (seals) {
    const done = seals.update(lms, now);
    S.gestureInfo = seals.step ? 'seals: ' + seals.labels.map((l, i) => i < seals.step ? '✓' : l).join(' · ') : '';
    if (done) trigger();
    return;
  }
  // Snap pose held for two checks, not a one-frame flicker; the sound check reads these times.
  const n = lms.filter((lm, k) => isSnapPose(lm, result.worldLandmarks[k])).length;
  snap1Hits = n >= 1 ? snap1Hits + 1 : 0;
  snap2Hits = n >= 2 ? snap2Hits + 1 : 0;
  if (snap1Hits >= 2) preSnapAt = now;
  if (snap2Hits >= 2) preSnap2At = now;
  const r = snapGate.hands(n, CFG.mode === 'snap2' ? 2 : 1, now, CFG.snapRelease);
  if (r) snapSays(r === 'fire' ? 'fingers moved ✓' : 'hand held still: ignored');
  if (r === 'fire') trigger();
}
function snapSays(info) {
  S.snapInfo = info;
  log('snap?', info);
  setTimeout(() => { if (S.snapInfo === info) S.snapInfo = ''; }, 2500);
}

// Paint detected hands as thick finger strokes + filled palm onto a mask canvas.
// The segmentation model misses thin raised hands; the hand model doesn't.
const FINGERS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [0, 17, 18, 19, 20]];
const PALM = [0, 1, 5, 9, 13, 17];
function paintHands(x, result, scale) {
  const W = x.canvas.width, H = x.canvas.height;
  x.lineCap = x.lineJoin = 'round';
  x.strokeStyle = x.fillStyle = '#fff';
  for (const lm of result.landmarks) {
    const p = i => [lm[i].x * W, lm[i].y * H];
    x.lineWidth = scale * Math.hypot((lm[0].x - lm[9].x) * W, (lm[0].y - lm[9].y) * H);
    x.beginPath();
    for (const f of FINGERS) f.forEach((i, k) => x[k ? 'lineTo' : 'moveTo'](...p(i)));
    x.moveTo(...p(PALM[0]));
    for (const i of PALM) x.lineTo(...p(i));
    x.closePath();
    x.fill();
    x.stroke();
  }
}

function listenForSnap(mic) {
  const ac = new AudioContext();
  const an = new AnalyserNode(ac, { fftSize: 1024 });
  ac.createMediaStreamSource(new MediaStream([mic]))
    .connect(new BiquadFilterNode(ac, { type: 'highpass', frequency: 2500 })) // snaps are sharp clicks
    .connect(an);
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => ac.resume().catch(() => {}), true); // a closed context rejects
  const buf = new Float32Array(an.fftSize);
  let noise = 0.01, lastSnap = 0;
  const timer = setInterval(() => {
    if (mic.readyState === 'ended') { clearInterval(timer); ac.close(); return; }
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (const x of buf) if (Math.abs(x) > peak) peak = Math.abs(x);
    const now = performance.now();
    if (CFG.enabled && (CFG.mode === 'snap' || CFG.mode === 'snap2') && peak > snapLoudness() && peak > noise * 6 && now - lastSnap > 800) {
      const two = CFG.mode === 'snap2';
      const handOk = now - (two ? preSnap2At : preSnapAt) < CFG.snapWindow;
      snapSays(`sound ${peak.toFixed(2)}, ${handOk ? (two ? 'both hands ✓' : 'hand ✓') : (two ? 'need both hands' : 'no hand seen')}`);
      if (handOk) { // the hand frames decide (watchHands); no frames at all = no snap
        lastSnap = now;
        snapGate.sound(now);
        setTimeout(() => { if (snapGate.waiting) { snapGate.cancel(); snapSays('no hand frames after the sound'); } }, CFG.snapRelease + 1000);
      }
    }
    noise = noise * 0.95 + peak * 0.05;
  }, 20);
}

const canvas = (w = 1, h = 1, read = false) => {
  const c = new OffscreenCanvas(w, h);
  return [c, c.getContext('2d', { willReadFrequently: read })];
};

// A call with only the mic (Meet asks for camera and mic separately): same mix, no video.
document.addEventListener('vanish-audio', e => {
  const box = e.target;
  const outA = document.createElement('video');
  outA.srcObject = new MediaStream([setupMix(box.firstChild.srcObject.getAudioTracks()[0])]);
  box.append(outA);
  box.dispatchEvent(new Event('vanish-audio-ready'));
});

document.addEventListener('vanish-start', e => {
  const box = e.target;
  const src = box.firstChild.srcObject;
  const [cam] = src.getVideoTracks(), [mic] = src.getAudioTracks();

  const gen = new MediaStreamTrackGenerator({ kind: 'video' });
  const outV = document.createElement('video');
  outV.srcObject = new MediaStream(mic ? [gen, setupMix(mic)] : [gen]);
  box.append(outV);
  box.dispatchEvent(new Event('vanish-ready'));
  if (mic) listenForSnap(mic);
  S.cams++;
  if (CFG.panel || CFG.gdebug) makePanel();

  ensureModels();

  const camId = S.cams + ':' + performance.now(); // id for this camera's jobs
  const [hideM, hctx] = canvas(MW, MH);   // alpha = how much to replace with background
  const [learnM, lctx] = canvas(MW, MH);  // alpha = safe to learn as background
  const [out, octx] = canvas(), [bg, bctx] = canvas(), [tmp, tctx] = canvas();
  const [person, pctx] = canvas(), [scratch] = canvas(), [scratch2] = canvas(), [scratch3] = canvas(); // you, cut out, and spare canvases for the effect
  let cx = 0, cy = 0;
  const [jobFrame, jctx] = canvas(), [learnTmp, ltctx] = canvas(); // the frame the current mask belongs to
  const levels = Array.from({ length: 6 }, () => canvas()); // pyramid for filling never-seen spots
  let w = 0, h = 0;
  let haveMask = false, fade = 0, total = 0, frames = 0, lastFps = performance.now(), lastAt = 0;

  // Push-pull fill: shrink the learned background step by step, then paste each coarser level
  // under the finer one. Holes get the colours around them instead of black or streaks.
  function filledBackground() {
    let prev = bg;
    for (const [c, x] of levels) { x.globalCompositeOperation = 'copy'; x.drawImage(prev, 0, 0, c.width, c.height); prev = c; }
    for (let k = levels.length - 2; k >= 0; k--) {
      const [c, x] = levels[k];
      x.globalCompositeOperation = 'destination-over';
      x.drawImage(levels[k + 1][0], 0, 0, c.width, c.height);
      // Half-transparent spots would let you show through. Drawing a level under itself
      // pushes alpha toward 1 while keeping the colour right.
      for (let i = 0; i < 4; i++) x.drawImage(c, 0, 0);
    }
    return levels[0][0];
  }

  // A finished job from ml.js: gestures, the masks, and learning the background from the job's frame.
  camHandlers.set(camId, m => {
    if (!w) return;
    perfAdd(m.perf.seg, m.perf.hands, m.perf.face);
    const hands = m.hands;
    hands.face = m.face; // for the gesture debug view
    if (CFG.mode !== 'off') watchHands(hands, m.now, m.face);
    handStats(hands, m.now);
    if (CFG.gdebug) ui?.showHands(hands);
    S.onFrame?.(hands, m.face, m.now);
    if (m.face) { cx = (m.face.x + m.face.w / 2) * w; cy = (m.face.y + m.face.h * 1.8) * h; } // effects centre: your chest
    hctx.putImageData(new ImageData(m.hide, MW, MH), 0, 0);
    lctx.putImageData(new ImageData(m.learn, MW, MH), 0, 0);
    paintHands(hctx, hands, 1.3); // a bit wider than the hand: covers fingers moving between masks
    lctx.globalCompositeOperation = 'destination-out'; // never learn a hand into the background
    paintHands(lctx, hands, 1.8);
    lctx.globalCompositeOperation = 'source-over';

    if (++total > WARMUP && !S.captureAt) { // learn what's behind you, only where you clearly aren't
      ltctx.globalCompositeOperation = 'copy';
      ltctx.drawImage(jobFrame, 0, 0);
      ltctx.globalCompositeOperation = 'destination-in';
      ltctx.filter = `blur(${Math.round(w / 200)}px)`; // soft learn edges: no staircase in the background
      ltctx.drawImage(learnM, 0, 0, w, h);
      ltctx.filter = 'none';
      bctx.globalAlpha = 0.5; // blend, so one bad mask can't stamp itself in
      bctx.drawImage(learnTmp, 0, 0);
      bctx.globalAlpha = 1;
    }
    haveMask = true;
  });

  new MediaStreamTrackProcessor({ track: cam }).readable.pipeThrough(new TransformStream({
    async transform(frame, ctl) {
      if (!CFG.enabled) { fade = 0; haveMask = false; return ctl.enqueue(frame); } // switched off: the camera goes out untouched
      if (!mlReady) return ctl.enqueue(frame); // pass through until models are ready
      try { compose(frame, ctl); } catch (e) { // never let a drawing error end the camera track
        console.error('[Vanish Cam] frame', e);
        ctl.enqueue(frame);
      }
    },
  })).pipeTo(gen.writable).catch(e => console.error('[Vanish Cam] pipeline stopped', e)).finally(() => { S.cams--; camHandlers.delete(camId); });

  function compose(frame, ctl) {
      const now = performance.now();
      if (++frames, now - lastFps > 1000) { S.fps = Math.round(frames * 1000 / (now - lastFps)); frames = 0; lastFps = now; }

      if (frame.displayWidth !== w || frame.displayHeight !== h) {
        w = frame.displayWidth; h = frame.displayHeight;
        for (const c of [out, bg, tmp, jobFrame, learnTmp, person]) { c.width = w; c.height = h; }
        cx = w / 2; cy = h / 2;
        levels.forEach(([c], k) => { c.width = Math.max(1, w >> (k + 3)); c.height = Math.max(1, h >> (k + 3)); });
      }

      // The models run in the worker on the newest frame; every camera frame is composited with
      // the latest finished mask, so video keeps full fps and the mask lags by a frame or two.
      if (jobBusy && now - jobAt > 3000) { // a lost job (worker hiccup) must not stall the mask
        jobBusy = false;
        if (engine?.ready && ++lostJobs >= 2) restartEngine('no answer for 6 s'); // and a dead worker is replaced
      }
      if (!jobBusy) {
        jobBusy = true; jobAt = now;
        jctx.drawImage(frame, 0, 0, w, h); // learning must use THIS frame, not a newer one the mask doesn't match
        const copy = frame.clone();
        if (engine) engine.post({ cmd: 'job', cam: camId, now, frame: copy }, [copy]); else copy.close();
      }
      if (!haveMask) return ctl.enqueue(frame);
      const step = Math.min(1, (now - lastAt) / fadeMs()); // the effect takes fadeMs(), whatever the fps
      lastAt = now;
      fade = S.hidden ? Math.min(1, fade + step) : Math.max(0, fade - step);

      if (S.captureAt && now >= S.captureAt) { // "remember background": take the whole frame
        bctx.globalCompositeOperation = 'copy';
        bctx.drawImage(frame, 0, 0, w, h);
        bctx.globalCompositeOperation = 'source-over';
        S.captureAt = 0;
      }

      octx.drawImage(frame, 0, 0, w, h);
      if (fade > 0.01) {
        const blur = `blur(${Math.round(w / 200)}px)`; // feather the small mask: no staircase edges
        if (fade < 0.99) { // mid-transition: keep a copy of you for the effect to play with
          pctx.globalCompositeOperation = 'copy';
          pctx.drawImage(frame, 0, 0, w, h);
          pctx.globalCompositeOperation = 'destination-in';
          pctx.filter = blur;
          pctx.drawImage(hideM, 0, 0, w, h);
          pctx.filter = 'none';
        }
        tctx.globalCompositeOperation = 'copy';
        tctx.drawImage(filledBackground(), 0, 0, w, h);
        tctx.globalCompositeOperation = 'source-over';
        tctx.drawImage(bg, 0, 0);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.filter = blur;
        tctx.drawImage(hideM, 0, 0, w, h);
        tctx.filter = 'none';
        octx.drawImage(tmp, 0, 0); // you are gone; the effect draws you back at the current progress
        if (fade < 0.99) (EFFECTS[CFG.effect] ?? EFFECTS.dissolve)(octx, person, fade, { w, h, cx, cy, t: now, seed: effectSeed, scratch, scratch2, scratch3, opt: effectOpts(CFG.effect, CFG) });
        octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over'; octx.filter = 'none';
      }
      if (S.debug) { // white = what gets hidden (body mask + painted hands)
        octx.fillStyle = '#000';
        octx.fillRect(0, 0, w, h);
        octx.drawImage(hideM, 0, 0, w, h);
      }
      ctl.enqueue(new VideoFrame(out, { timestamp: frame.timestamp }));
      frame.close();
  }
});

// ---------- on-page control panel ----------
const CSS = `
.p{font:13px system-ui,sans-serif;background:#202124ee;color:#e8eaed;border-radius:12px;width:220px;box-shadow:0 4px 16px #0006;overflow:hidden}
header{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;cursor:move;user-select:none;font-weight:600;background:#3c4043}
.body{display:flex;flex-direction:column;gap:8px;padding:10px}
.body[hidden]{display:none}
button{font:inherit;border:0;border-radius:8px;padding:8px;cursor:pointer;background:#3c4043;color:inherit}
button:hover{background:#5f6368}
button:focus-visible,input:focus-visible{outline:2px solid #8ab4f8;outline-offset:2px}
.main{background:#8ab4f8;color:#202124;font-weight:600}
.main.on{background:#f28b82}
.min{padding:0 8px;background:none}
label{display:flex;align-items:center;gap:6px}
small{color:#9aa0a6;min-height:2.4em}
.dbg canvas{width:100%;background:#000;border-radius:8px;display:block}
.dbg pre{margin:4px 0 0;font:11px/1.4 ui-monospace,monospace;white-space:pre-wrap}
.dbg[hidden]{display:none}
.brand{display:flex;align-items:center;gap:6px}
.ico{width:16px;height:16px;fill:none;stroke:#c9b8ff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`;

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function makePanel() {
  if (ui || S.noPanel) return;
  const host = el('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px';
  const root = host.attachShadow({ mode: 'closed' });
  const mainBtn = el('button', { className: 'main', onclick: trigger });
  const bgBtn = el('button', { title: 'Press, then step out of the frame', onclick: () => { S.captureAt = performance.now() + CFG.captureDelay; } });
  const status = el('small', { role: 'status' });
  const sketch = el('canvas', { width: 400, height: 225 });
  const notes = el('pre');
  const dbg = el('div', { className: 'dbg', hidden: true }, sketch, notes);
  const body = el('div', { className: 'body' }, mainBtn, bgBtn, dbg, status);
  const min = el('button', { className: 'min', textContent: '–', title: 'Minimize', onclick: () => { body.hidden = !body.hidden; } });
  const close = el('button', { className: 'min', textContent: '×', title: 'Hide the panel (bring it back from the extension popup)',
    onclick: () => { // hide now; saving can fail after an extension update (context gone) and must not keep it open
      CFG.panel = CFG.gdebug = false; host.hidden = true;
      try { saveSettings({ panel: false, gdebug: false }); } catch {}
    } });
  const head = el('header', {}, el('span', { className: 'brand' }, icon('ghost'), 'Vanish Cam'), el('span', {}, min, close));

  head.onpointerdown = e => {
    if (e.target.tagName === 'BUTTON') return;
    head.setPointerCapture(e.pointerId);
    const r = host.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.onpointermove = m => Object.assign(host.style, { left: m.clientX - dx + 'px', top: m.clientY - dy + 'px', right: 'auto', bottom: 'auto' });
    head.onpointerup = () => { head.onpointermove = null; };
  };

  root.append(el('style', { textContent: CSS }), el('div', { className: 'p' }, head, body));
  document.documentElement.append(host);
  const POSE = { open: 'palm', victory: 'victory', fist: 'fist' };
  ui = {
    // Gesture debug: hands as the model sees them (mirrored like your self-view) + what each one counts as.
    showHands(result) {
      const x = sketch.getContext('2d'), W = sketch.width, H = sketch.height;
      x.clearRect(0, 0, W, H);
      x.lineWidth = 3; x.lineCap = x.lineJoin = 'round'; x.font = 'bold 16px system-ui';
      const lines = [`hands in frame: ${result.landmarks.length} · hand model ${HS.rate}/s, finds in ${HS.pct}%`];
      const seals = trackers[CFG.mode];
      if (seals) lines.push(`waiting for: ${seals.labels[seals.step]} (seal ${seals.step + 1}/${seals.labels.length})`);
      const f = result.face;
      if (f) { // face box + the "below the chin" line the meme gesture uses
        x.strokeStyle = '#888';
        x.strokeRect((1 - f.x - f.w) * W, f.y * H, f.w * W, f.h * H);
        x.setLineDash([6, 6]);
        x.beginPath(); x.moveTo(0, (f.y + f.h * CFG.chestLine) * H); x.lineTo(W, (f.y + f.h * CFG.chestLine) * H); x.stroke();
        x.setLineDash([]);
      }
      if (CFG.mode === 'meme') {
        const a = memeHold.state.arrival;
        lines.push(`face ${f ? '✓' : '✗'} · hand flew in: ${a === null ? '—' : a === Infinity ? 'appeared in frame ✓' : `${a.toFixed(2)} ${a >= CFG.memeArrive ? '✓' : `✗ (need ≥ ${CFG.memeArrive}, faster)`}`}`);
      }
      result.landmarks.forEach((lm, k) => {
        const pose = handPose(lm), snap = isSnapPose(lm, result.worldLandmarks[k]), memeOk = isMemePose(lm, result.face);
        const pt = i => [(1 - lm[i].x) * W, lm[i].y * H];
        x.strokeStyle = snap ? '#5cf' : pose ? '#5f5' : '#fc3';
        x.beginPath();
        for (const f of FINGERS) f.forEach((i, j) => x[j ? 'lineTo' : 'moveTo'](...pt(i)));
        x.moveTo(...pt(PALM[0]));
        for (const i of PALM) x.lineTo(...pt(i));
        x.stroke();
        x.fillStyle = '#fff';
        x.fillText(String(k + 1), ...pt(0));
        // I=index M=middle R=ring P=pinky; dot = finger folded
        const fingers = fingersOut(lm).map((o, i) => o ? 'IMRP'[i] : '·').join('');
        const { touch, lift } = snapMeasures(lm, result.worldLandmarks[k]);
        lines.push(`hand ${k + 1}: ${snap ? 'snap pose' : POSE[pose] ?? '— no shape'}  fingers ${fingers}${pose === 'victory' ? (memeOk ? '  at chest ✓' : `  at chest ✗ (${result.face ? 'lower than the chin' : 'no face seen: lower than ' + MEME_CHEST_Y}, now ${lm[9].y.toFixed(2)})`) : ''}`,
          `   snap ${snap ? '✓' : '✗'}  touch ${touch.toFixed(2)} (< ${CFG.snapTouch}), middle raised ${lift.toFixed(2)} (> ${CFG.snapLift})${lm[0].y >= 0.85 ? ', hand low' : ''}`);
      });
      notes.textContent = lines.join('\n');
    },
    sync() {
      host.hidden = !CFG.enabled || !(CFG.panel || CFG.gdebug);
      dbg.hidden = !CFG.gdebug;
      mainBtn.textContent = pending ? '…' : S.hidden ? 'Appear' : 'Vanish';
      mainBtn.classList.toggle('on', S.hidden);
      const left = Math.ceil((S.captureAt - performance.now()) / 1000);
      bgBtn.textContent = S.captureAt ? `Step out of frame… ${Math.max(left, 0)}` : 'Remember background';
      const pf = PERF.out;
      status.textContent = `${S.status} · ${S.fps} fps · cutout ${pf.seg} ms, hands ${pf.hands}, face ${pf.face}, ${pf.jobs}/s${S.snapInfo ? ' · ' + S.snapInfo : ''}${S.gestureInfo ? ' · ' + S.gestureInfo : ''}`;
    },
  };
  setInterval(() => ui.sync(), 300);
  ui.sync();
}
