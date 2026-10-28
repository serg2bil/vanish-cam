// The studio: your camera through the real pipeline (vanish.js, loaded on this page), the hands
// as the model sees them, recording your own gestures, trying effects and sounds, all settings.
// Shares the global scope with vanish.js: S (page state), CFG (live settings), trigger(), PERF.

const $ = id => document.getElementById(id);
let settings = { ...DEFAULTS };
S.noPanel = true;

let saveTimer;
function save(now = false) {
  clearTimeout(saveTimer);
  const write = () => chrome.storage.local.set({ settings });
  now ? write() : (saveTimer = setTimeout(write, 120)); // sliders fire a lot; batch them
}

// [icon, name, hint]; a hint that is an array is a row of icons (the seal sequence).
const SEQ = ['victory', 'fist', 'palm'];
const MODE_TILES = {
  meme: ['victory', 'Meme', 'flick a V sign at your chest'],
  seals: ['palm', 'Seals, two hands', SEQ],
  seals1: ['victory', 'Seals, one hand', SEQ],
  snap2: ['snap', 'Snap, both hands', 'hands raised'],
  snap: ['snap', 'Snap, one hand', 'hand raised'],
  custom: ['star', 'My gestures', 'recorded below'],
  off: ['pointer', 'Button only', 'or Alt+Shift+H'],
};
const setIcon = (id, name) => { if ($(id).dataset.icon !== name) { $(id).dataset.icon = name; $(id).replaceChildren(icon(name)); } };
drawIcons();

// ---------- camera through the pipeline ----------
let frameInfo = { hands: { landmarks: [] }, face: null }; // the latest model result, for the overlay
S.onFrame = (hands, face, now) => { frameInfo = { hands, face }; recording?.frames.push({ lms: hands.landmarks, t: now, face }); drawOverlay(); };

async function startCamera() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
  } catch (e) {
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }); } // no mic: snap by sound is off
    catch (e2) { $('nocam').hidden = false; $('status').textContent = T('No camera'); return; }
  }
  // Same hand-off as hook.js does on a call page: vanish.js takes the stream and gives back the processed one.
  const box = document.createElement('vanish-cam');
  box.hidden = true;
  const v = document.createElement('video');
  v.srcObject = stream;
  box.append(v);
  document.documentElement.append(box);
  box.dispatchEvent(new Event('vanish-start', { bubbles: true }));
  $('cam').srcObject = new MediaStream(box.lastChild.srcObject.getVideoTracks());
}

// ---------- overlay: hands, face, what the gesture logic thinks ----------
const ov = $('overlay'), ox = ov.getContext('2d');
const POSE_ICON = { open: 'palm', victory: 'victory', fist: 'fist' };
function drawOverlay() {
  const W = ov.width = ov.clientWidth * devicePixelRatio, H = ov.height = ov.clientHeight * devicePixelRatio;
  ox.clearRect(0, 0, W, H);
  if (!settings.studioTracking || !settings.enabled) { $('handsPill').hidden = true; return; } // tracking overlay switched off
  const { hands, face } = frameInfo;
  const pt = (p, dx = 0, dy = 0) => [p.x * W + dx, p.y * H + dy];
  ox.lineCap = ox.lineJoin = 'round';
  if (face && settings.mode === 'meme') { // the "below the chin" line the meme gesture uses
    ox.strokeStyle = 'rgba(255,255,255,0.35)'; ox.lineWidth = 2 * devicePixelRatio; ox.setLineDash([8, 8]);
    const y = (face.y + face.h * CFG.chestLine) * H;
    ox.beginPath(); ox.moveTo(0, y); ox.lineTo(W, y); ox.stroke();
    ox.setLineDash([]);
    ox.strokeRect(face.x * W, face.y * H, face.w * W, face.h * H);
  }
  hands.landmarks.forEach((lm, k) => {
    const pose = handPose(lm), snap = isSnapPose(lm, hands.worldLandmarks[k]);
    const best = settings.mode === 'custom' ? Math.max(0, ...settings.gestures.map(g => gestureScore(g, g.hands === 2 ? hands.landmarks : [lm]))) : 0;
    const color = best >= 0.5 ? '#3ddc84' : snap ? '#5cf' : pose ? '#8b6dff' : '#ffd166';
    ox.shadowColor = color; ox.shadowBlur = 12 * devicePixelRatio;
    ox.strokeStyle = color; ox.lineWidth = 3 * devicePixelRatio;
    ox.beginPath();
    for (const f of FINGERS) f.forEach((i, j) => ox[j ? 'lineTo' : 'moveTo'](...pt(lm[i])));
    ox.moveTo(...pt(lm[PALM[0]]));
    for (const i of PALM) ox.lineTo(...pt(lm[i]));
    ox.closePath();
    ox.stroke();
    ox.shadowBlur = 0;
    ox.fillStyle = '#fff';
    for (const p of lm) { ox.beginPath(); ox.arc(...pt(p), 3 * devicePixelRatio, 0, 7); ox.fill(); }
    // the pose it counts as, as an icon in a dark badge under the wrist
    const label = snap ? 'snap' : POSE_ICON[pose];
    if (label) {
      const [x, y] = pt(lm[0], 0, 30 * devicePixelRatio), r = 17 * devicePixelRatio;
      ox.fillStyle = 'rgba(10,10,16,0.7)';
      ox.beginPath(); ox.arc(x, y, r, 0, 7); ox.fill();
      drawIconOn(ox, label, x, y, 22 * devicePixelRatio, color);
    }
  });
  if (settings.mode === 'custom') for (const { g, tracker } of custom) { // motion gestures: the travel so far, and what is left
    const { path } = tracker.state;
    if (!g.move?.path) continue;
    const A = 16 / 9, sp = p => [p.x / A * W, p.y * H];
    if (face && g.move.from && (g.zone ?? ZONE_DEF) < ZONE_ANY) { // where it must start (circle) and end (ring), around your face
      const at = q => sp({ x: (face.x + face.w / 2) * A + q.x * face.h, y: face.y + face.h / 2 + q.y * face.h });
      const r = (g.zone ?? ZONE_DEF) * face.h * H;
      ox.lineWidth = 2 * devicePixelRatio; ox.setLineDash([4, 6]);
      ox.strokeStyle = 'rgba(255,209,102,0.8)'; ox.fillStyle = 'rgba(255,209,102,0.08)';
      ox.beginPath(); ox.arc(...at(g.move.from), r, 0, 7); ox.fill(); ox.stroke();
      if (g.move.to) { ox.strokeStyle = 'rgba(61,220,132,0.8)'; ox.beginPath(); ox.arc(...at(g.move.to), r, 0, 7); ox.stroke(); }
      ox.setLineDash([]);
      drawIconOn(ox, g.icon ?? 'star', ...at(g.move.from), 20 * devicePixelRatio, 'rgba(255,209,102,0.9)');
    }
    // the recorded path, dashed: from the start zone if the face is seen, else from where your hand is
    const unit = g.move.unit ? (face?.h ?? g.move.unit) : 1, P = g.move.path;
    const start = face && g.move.from ? { x: (face.x + face.w / 2) * A + g.move.from.x * face.h, y: face.y + face.h / 2 + g.move.from.y * face.h } : path?.[0];
    if (start) {
      const pt = q => sp({ x: start.x + (q[0] - P[0][0]) * unit, y: start.y + (q[1] - P[0][1]) * unit });
      ox.strokeStyle = 'rgba(255,255,255,0.55)'; ox.lineWidth = 3 * devicePixelRatio; ox.setLineDash([6, 8]);
      ox.beginPath(); P.forEach((q, i) => ox[i ? 'lineTo' : 'moveTo'](...pt(q))); ox.stroke(); ox.setLineDash([]);
      const [x2, y2] = pt(P[P.length - 1]), [x1, y1] = pt(P[P.length - 3]);
      const a = Math.atan2(y2 - y1, x2 - x1), r = 12 * devicePixelRatio; // arrow head at the end
      ox.beginPath(); ox.moveTo(x2, y2); ox.lineTo(x2 - r * Math.cos(a - 0.5), y2 - r * Math.sin(a - 0.5)); ox.moveTo(x2, y2); ox.lineTo(x2 - r * Math.cos(a + 0.5), y2 - r * Math.sin(a + 0.5)); ox.stroke();
    }
    if (!path?.length) continue;
    ox.strokeStyle = '#3ddc84'; ox.lineWidth = 4 * devicePixelRatio;
    ox.beginPath(); path.forEach((p, i) => ox[i ? 'lineTo' : 'moveTo'](...sp(p))); ox.stroke();
  }
  const n = hands.landmarks.length;
  $('handsPill').hidden = !n;
  $('handsPill').textContent = n === 1 ? T('1 hand') : `${n} ${T('hands')}`;
}

// ---------- status, the big button ----------
function sync() {
  const pf = PERF.out;
  $('status').textContent = `${S.status} · ${S.fps} fps`;
  $('dot').className = 'dot ' + (S.hidden ? 'hidden' : S.cams ? 'live' : '');
  $('toggleText').textContent = pending ? '…' : T(S.hidden ? 'Appear' : 'Vanish');
  setIcon('toggleIcon', S.hidden ? 'eye' : 'ghost');
  $('toggle').classList.toggle('on', S.hidden);
  $('toggle').classList.toggle('pending', pending);
  $('toggle').disabled = !mlReady || !settings.enabled;
  const left = Math.ceil((S.captureAt - performance.now()) / 1000);
  $('captureText').textContent = S.captureAt ? `${T('Step out of frame…')} ${Math.max(left, 0)}` : T('Remember background');
  $('info').textContent = S.snapInfo || S.gestureInfo || (S.hidden ? T('You are hidden. Do the gesture again or press the button to come back.') : '');
  $('showMask').classList.toggle('on', !!S.debug);
  $('tracking').classList.toggle('on', settings.studioTracking);
  const ms = v => `${Math.round(v)} ms`;
  $('perf').textContent = `${S.status}\n${T('Cutout')} ${ms(pf.seg)} · ${T('Hands')} ${ms(pf.hands)} · ${T('Face')} ${ms(pf.face)} · ${pf.jobs}/s · ${T('video')} ${S.fps} fps`;
  for (const [id, g] of gestureRows) {
    const lms = frameInfo.hands.landmarks;
    let sc = lms.length ? gestureScore(g, lms) : 0;
    if (g.move?.path) sc = Math.max(sc >= 0.5 ? 0.25 : 0, custom.find(c => c.g === g)?.tracker.state.progress ?? 0); // a motion: how close the path is (the pose alone: a quarter)
    g._row.querySelector('.meter i').style.width = `${Math.round(sc * 100)}%`;
    g._row.querySelector('.meterRow b').textContent = `${Math.round(sc * 100)}%`;
    g._row.classList.toggle('hit', sc >= 0.5);
  }
}
setInterval(sync, 150);
$('toggle').addEventListener('click', () => trigger());
$('capture').addEventListener('click', () => { S.captureAt = performance.now() + CFG.captureDelay; });
$('showMask').addEventListener('click', () => { S.debug = !S.debug; });
$('tracking').addEventListener('click', () => { settings.studioTracking = !settings.studioTracking; save(true); drawOverlay(); });
$('enabled').addEventListener('change', () => { settings.enabled = $('enabled').checked; save(true); render(); });
$('turnOn').addEventListener('click', () => { settings.enabled = true; save(true); render(); });

// Shows the chosen effect on you: vanish, then come back.
function demo() {
  if (S.hidden || pending || !mlReady) return;
  trigger();
  setTimeout(() => { if (S.hidden) trigger(); }, fadeMs() + 1400);
}

// ---------- gesture modes and your gestures ----------
function renderModes() {
  $('modes').replaceChildren(...MODES.map(([value]) => {
    const [em, name, hint] = MODE_TILES[value];
    const b = document.createElement('button');
    b.className = 'tile' + (settings.mode === value ? ' on' : '');
    b.innerHTML = `<i class="em"></i><span></span><small></small>`;
    b.children[0].append(icon(em));
    b.children[1].textContent = T(name) + (value === 'custom' ? ` (${settings.gestures.length})` : '');
    if (Array.isArray(hint)) b.children[2].append(...hint.flatMap((n, i) => i ? [icon('arrow', 'dim'), icon(n)] : [icon(n)]));
    else b.children[2].textContent = T(hint);
    b.onclick = () => { settings.mode = value; save(true); renderModes(); };
    return b;
  }));
  $('customBox').hidden = settings.mode !== 'custom';
  // this mode's own sliders, under the tiles
  const group = ADVANCED[MODE_SETTINGS[settings.mode]];
  $('modeOpts').hidden = !group;
  if (group) $('modeOpts').replaceChildren(subHead(MODE_TILES[settings.mode][0], `${T(MODE_TILES[settings.mode][1])}: ${T('settings')}`),
    ...group.map(it => makeSlider(it, () => settings[it.key], v => { settings[it.key] = v; })));
}

const gestureRows = new Map(); // id -> gesture (with ._row)
function renderGestures() {
  gestureRows.clear();
  $('gestureList').replaceChildren(...settings.gestures.map(g => {
    const row = document.createElement('div');
    row.className = 'gest';
    row.innerHTML = `
      <div class="head">
        <details class="ipick"><summary title="${T('Icon')}"></summary><div class="grid"></div></details>
        <input type="text" maxlength="24">
        <i class="em dir" title="${T('Moves this way (as you see yourself)')}"></i>
        <button class="play" title="${T('Record again')}"></button>
        <button class="play" title="${T('Delete')}"></button>
      </div>
      <div class="meterRow"><span>${T('Match')}</span><div class="meter"><i></i></div><b>0%</b></div>
      <div class="opts">
        <div class="slider"><div class="head"><label>${T('Strictness')}</label><output></output></div><input type="range" min="0.2" max="0.7" step="0.01"></div>
        <div class="slider"><div class="head"><label>${T('Hold for')}</label><output></output></div><input type="range" min="0" max="1500" step="50"></div>
        <div class="slider"><div class="head"><label>${T('Allowed tilt')}</label><output></output></div><input type="range" min="15" max="180" step="5"></div>
        <div class="slider mtol"><div class="head"><label>${T('Motion accuracy')}</label><output></output></div><input type="range" min="0.1" max="0.6" step="0.01"></div>
        <div class="slider zone"><div class="head"><label>${T('Place relative to the face')}</label><output></output></div><input type="range" min="0.4" max="3" step="0.1"></div>
        <div class="field"><label>${T('Does')}</label><select class="when"></select></div>
      </div>`;
    const [pick, name, dir, again, del] = row.querySelector('.head').children;
    if (g.move?.path && g.move.net >= 0.6) { // mostly one way: which way, mirrored like the picture
      dir.append(icon('arrow'));
      dir.style.transform = `rotate(${Math.round(Math.atan2(g.move.dy, -g.move.dx) * 180 / Math.PI)}deg)`;
    } else if (g.move?.path) { // comes back (a wave, a circle)
      dir.append(icon('wave'));
      dir.title = T('A motion that comes back (a wave, a circle)');
    } else dir.hidden = true;
    g.icon ??= 'star'; // gestures recorded before icons had an emoji instead
    again.append(icon('redo'));
    del.append(icon('x'));
    const showPick = () => {
      pick.firstElementChild.replaceChildren(icon(g.icon));
      pick.lastElementChild.replaceChildren(...GESTURE_ICONS.map(n => {
        const b = document.createElement('button');
        b.className = n === g.icon ? 'on' : '';
        b.title = n;
        b.append(icon(n));
        b.onclick = () => { g.icon = n; save(true); pick.open = false; showPick(); };
        return b;
      }));
    };
    showPick();
    name.value = g.name;
    name.oninput = () => { g.name = name.value; save(); };
    again.onclick = () => record(g);
    del.onclick = () => { settings.gestures = settings.gestures.filter(x => x !== g); save(true); renderGestures(); renderModes(); };
    const [tol, hold, turn, mtol, zone] = row.querySelectorAll('input[type=range]');
    g.zone ??= ZONE_DEF;
    g.moveTol ??= MOVE_TOL;
    const bind = (input, key, fmt, flip) => {
      const out = input.previousElementSibling.querySelector('output');
      const show = () => { out.value = fmt(g[key]); };
      input.value = flip ? flip.to(g[key]) : g[key];
      show();
      input.oninput = () => { g[key] = flip ? flip.from(+input.value) : +input.value; show(); save(); };
    };
    // Strictness is the tolerance upside down: more to the right = must match more closely.
    bind(tol, 'tol', v => `${Math.round((0.7 - v) / 0.5 * 100)}%`, { to: v => 0.9 - v, from: v => 0.9 - v });
    bind(hold, 'hold', v => `${v} ms`);
    hold.parentElement.hidden = !!g.move?.path; // motion decides, not holding
    // Motion accuracy is the path tolerance upside down: more to the right = the path must match more closely.
    bind(mtol, 'moveTol', v => `${Math.round((0.6 - v) / 0.5 * 100)}%`, { to: v => 0.7 - v, from: v => 0.7 - v });
    mtol.parentElement.hidden = !g.move?.path;
    bind(turn, 'turn', v => `±${v / 2}°`);
    bind(zone, 'zone', v => v >= ZONE_ANY ? T('anywhere') : `±${(+v).toFixed(1)} ${T('face')}`);
    zone.parentElement.hidden = !g.move?.path || !g.move.from; // only motions recorded with your face in view
    const when = row.querySelector('.when');
    when.append(new Option(T('Vanish and appear'), 'both'), new Option(T('Vanish only'), 'vanish'), new Option(T('Appear only'), 'appear'));
    when.value = g.when;
    when.onchange = () => { g.when = when.value; save(true); };
    g._row = row;
    gestureRows.set(g.id, g);
    return row;
  }));
}

// Countdown, then ~1.5 s of frames while you hold the pose; the median shape becomes the gesture.
let recording = null;
async function record(existing = null) {
  if (recording || !mlReady) return;
  const rec = $('rec'), bar = $('ringBar'), count = $('count'), say = $('say');
  rec.hidden = false;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const ring = p => { bar.style.strokeDashoffset = 276.5 * (1 - p); };
  say.textContent = T('Get ready…');
  for (const n of [3, 2, 1]) { count.textContent = n; count.style.animation = 'none'; void count.offsetWidth; count.style.animation = ''; ring(0); await wait(1000); }
  count.replaceChildren(icon('palm'));
  say.textContent = T('Hold the gesture, or move it!');
  recording = { frames: [] };
  const t0 = performance.now(), dur = 3000; // long enough for a wave; the still bits are trimmed
  while (performance.now() - t0 < dur) { ring((performance.now() - t0) / dur); await wait(50); }
  const g = recordGesture(recording.frames);
  recording = null;
  rec.hidden = true;
  if (!g) return banner(T('No hand seen. Step back so the whole hand is in the picture and try again.'), 3500);
  if (existing) Object.assign(existing, g);
  else settings.gestures.push({ id: 'g' + Date.now(), name: `${T('Gesture')} ${settings.gestures.length + 1}`, icon: GESTURE_ICONS[settings.gestures.length % GESTURE_ICONS.length], ...GESTURE_DEFAULTS, ...g });
  settings.mode = 'custom';
  save(true);
  renderModes(); renderGestures();
  banner(g.move ? (g.move.net < 0.6 ? T('Got it, a motion that comes back! Do it again to try.') : T('Got it, with the motion! Do it again to try.')) : g.hands === 2 ? T('Got it, both hands! Try it now.') : T('Got it! Try it now.'), 2500);
}
$('record').addEventListener('click', () => record());

let bannerTimer;
function banner(text, ms) {
  $('banner').textContent = text;
  $('banner').hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { $('banner').hidden = true; }, ms);
}

// ---------- effects ----------
function renderEffects() {
  $('effects').replaceChildren(...EFFECT_LIST.map(([value, em, name]) => {
    const b = document.createElement('button');
    b.className = 'tile' + (settings.effect === value ? ' on' : '');
    b.innerHTML = `<i class="em"></i><span></span>`;
    b.children[0].append(icon(em));
    b.children[1].textContent = T(name);
    b.onclick = () => { settings.effect = value; save(true); renderEffects(); };
    return b;
  }));
  // the selected effect's own settings: duration plus its sliders; letting go of a slider replays it
  const id = settings.effect, [, em, name] = EFFECT_LIST.find(e => e[0] === id);
  const get = k => effectOpts(id, settings)[k];
  const set = (k, v) => { settings.fx = { ...settings.fx, [id]: { ...settings.fx?.[id], [k]: v } }; };
  const replay = Object.assign(document.createElement('button'), { className: 'secondary', title: T('Play the effect') });
  replay.append(icon('play'), T('Replay'));
  replay.onclick = () => demo();
  const reset = Object.assign(document.createElement('button'), { className: 'secondary', title: T('Reset this effect') });
  reset.append(icon('redo'));
  reset.onclick = () => { const fx = { ...settings.fx }; delete fx[id]; settings.fx = fx; save(true); renderEffects(); };
  const head = subHead(em, `${T(name)}: ${T('settings')}`);
  head.append(replay, reset);
  const items = [{ key: 'ms', label: 'Duration', min: 100, max: 4000, step: 50, unit: 'ms' }, ...(EFFECT_OPTS[id] ?? [])];
  $('effectOpts').replaceChildren(head, ...items.map(it => makeSlider(it, () => get(it.key), v => set(it.key, v), demo)));
}

// ---------- sounds ----------
function renderSounds() {
  for (const id of ['vanishSound', 'appearSound']) settings[id] = fillSoundSelect($(id), settings[id]);
  $('soundList').replaceChildren(...soundFiles.map(s => {
    const row = Object.assign(document.createElement('div'), { className: 'row sound' });
    const name = Object.assign(document.createElement('span'), { textContent: s.name });
    const play = Object.assign(document.createElement('button'), { className: 'play', title: T('Play') });
    const del = Object.assign(document.createElement('button'), { className: 'play', title: T('Delete') });
    play.append(icon('play'));
    del.append(icon('x'));
    play.onclick = () => previewSound(s.id, settings.localVolume);
    del.onclick = async () => { if (!await saveSoundFiles(soundFiles.filter(x => x.id !== s.id))) return; renderSounds(); save(true); };
    row.append(name, play, del);
    return row;
  }));
}
for (const id of ['vanishSound', 'appearSound']) $(id).addEventListener('change', () => { settings[id] = $(id).value; save(true); });
for (const b of document.querySelectorAll('.play[data-for]')) b.addEventListener('click', () => previewSound($(b.dataset.for).value, settings.localVolume));
$('addSound').addEventListener('change', async () => {
  const { added, tooBig } = await readSoundFiles($('addSound').files);
  $('addSound').value = '';
  $('soundErr').textContent = tooBig.length ? `${tooBig.join(', ')}: ${T('over 3 MB')}` : '';
  if (added.length && !await saveSoundFiles([...soundFiles, ...added])) $('soundErr').textContent = T('Out of space, delete some sounds');
  renderSounds();
});

// ---------- fine tuning ----------
const fmt = (v, unit) => unit === 'ms' ? `${Math.round(v)} ms`
  : unit === '%' ? `${Math.round(v)}%`
  : unit === '×' ? `${(+v).toFixed(2)}×`
  : unit === '×face' ? `${(+v).toFixed(2)} ${T('face')}`
  : unit === '°' ? `${Math.round(v)}°`
  : (+v).toFixed(2);

for (const [id, list] of [['device', DEVICES], ['segModel', SEG_MODELS]]) {
  $(id).append(...list.map(([value, text]) => new Option(text, value)));
  $(id).addEventListener('change', () => { settings[id] = $(id).value; save(true); });
}
for (const id of ['panel', 'gdebug']) $(id).addEventListener('change', () => { settings[id] = $(id).checked; save(true); });

// One slider; get/set read and write the value, done (optional) runs when you let go.
function makeSlider(it, get, set, done) {
  const el = document.createElement('div');
  el.className = 'slider';
  const input = Object.assign(document.createElement('input'), { type: 'range', min: it.min, max: it.max, step: it.step, value: get() });
  const out = document.createElement('output');
  out.value = fmt(get(), it.unit);
  const label = Object.assign(document.createElement('label'), { textContent: T(it.label) });
  const head = document.createElement('div');
  head.className = 'head';
  head.append(label, out);
  el.append(head, input);
  if (it.hint) el.append(Object.assign(document.createElement('p'), { className: 'muted', textContent: T(it.hint) }));
  input.setAttribute('aria-label', T(it.label));
  input.addEventListener('input', () => { set(+input.value); out.value = fmt(input.value, it.unit); save(); });
  if (done) input.addEventListener('change', () => done());
  return el;
}
// Heading of a settings box: icon + title.
function subHead(em, text) {
  const h = document.createElement('h3');
  h.append(icon(em), Object.assign(document.createElement('span'), { textContent: text }));
  return h;
}
function renderOpts() {
  $('soundOpts').replaceChildren(subHead('sliders', T('Timing and volume')), ...ADVANCED.sound.map(it => makeSlider(it, () => settings[it.key], v => { settings[it.key] = v; })));
  $('advGroups').replaceChildren(...ADVANCED.general.map(it => makeSlider(it, () => settings[it.key], v => { settings[it.key] = v; })));
}

$('reset').addEventListener('click', () => {
  const { enabled, mode, gestures, effect, vanishSound, appearSound, lang } = settings; // keep your choices and gestures
  settings = { ...DEFAULTS, enabled, mode, gestures, effect, vanishSound, appearSound, lang };
  save(true);
  render();
});

function render() {
  if (!EFFECT_LIST.some(e => e[0] === settings.effect)) settings.effect = DEFAULTS.effect; // an effect from an older version
  renderModes(); renderGestures(); renderEffects(); renderSounds();
  $('enabled').checked = settings.enabled;
  $('enabledText').textContent = T(settings.enabled ? 'On' : 'Off');
  $('offcard').hidden = settings.enabled;
  document.body.classList.toggle('off', !settings.enabled);
  drawOverlay();
  for (const id of ['device', 'segModel']) $(id).value = settings[id];
  for (const id of ['panel', 'gdebug']) $(id).checked = settings[id];
  renderOpts();
}

function setLang(lang) {
  LANG = lang;
  $('lang').textContent = lang.toUpperCase();
  localize();
  render();
}
$('lang').addEventListener('click', () => { settings.lang = LANG === 'ru' ? 'en' : 'ru'; setLang(settings.lang); save(true); });

chrome.storage.local.get('settings', async r => {
  settings = { ...DEFAULTS, ...r.settings };
  await loadSoundFiles();
  setLang(settings.lang || (navigator.language.startsWith('ru') ? 'ru' : 'en'));
  startCamera();
});
chrome.storage.onChanged.addListener(ch => { // the popup may change things while the studio is open
  if (ch.settings && JSON.stringify(ch.settings.newValue) !== JSON.stringify(settings)) { settings = { ...DEFAULTS, ...ch.settings.newValue }; render(); }
});
addEventListener('resize', drawOverlay);
