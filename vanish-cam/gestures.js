// Hand-gesture logic on MediaPipe hand landmarks (21 points, x/y in 0..1). No DOM, so it can be
// checked with node: node test/gestures.test.mjs. Thresholds live in CFG (settings.js), editable in the popup.

const gdist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// [index, middle, ring, pinky]: a finger is out when its tip is clearly farther from the wrist
// than its middle joint. Works at any hand rotation.
function fingersOut(lm) {
  return [[8, 6], [12, 10], [16, 14], [20, 18]].map(([tip, pip]) => gdist(lm[0], lm[tip]) > 1.1 * gdist(lm[0], lm[pip]));
}

// How close the thumb tip is to the middle fingertip, the middle finger's last joint or the index
// tip, in palm lengths, on the picture (aspect-corrected). Small = thumb pressed on those fingers.
// (The 3D world points were tried first: too noisy for a sideways hand; the picture works better.)
function thumbPinch(lm, aspect = 16 / 9) {
  const p = q => ({ x: q.x * aspect, y: q.y });
  const t = p(lm[4]), palm = gdist(p(lm[0]), p(lm[9]));
  return Math.min(...[12, 11, 8].map(j => gdist(t, p(lm[j])))) / palm;
}

function handPose(lm) {
  const [i, m, r, p] = fingersOut(lm);
  if (i && m && r && p) return 'open';
  // A real ✌️ tucks the thumb over ring/pinky; thumb on index/middle is a snap, not a peace sign.
  if (i && m && !r && !p) return thumbPinch(lm) > CFG.snapTouch ? 'victory' : null;
  if (!i && !m && !r && !p) return 'fist';
  return null;
}

const g3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Snap pose: thumb pressed on the middle (or index) finger, and the middle finger lifted away
// from the palm (measured on 3D world points). In a fist the thumb also sits by the middle finger
// in the picture, but the middle fingertip is curled into the palm; "lifted" rules fists out.
// Tuned on two real recordings: all 13 snaps armed, fists never.
function snapMeasures(lm, world) {
  return { touch: thumbPinch(lm), lift: g3(world[12], world[9]) / g3(world[0], world[9]) };
}
// lm: image landmarks, world: 3D world landmarks. Hand must be raised above the desk (not typing).
function isSnapPose(lm, world) {
  const { touch, lift } = snapMeasures(lm, world);
  return lm[0].y < 0.85 && touch < CFG.snapTouch && lift > CFG.snapLift;
}

// A snap sound counts only if the fingers moved: on the first hand frames after the sound the
// snap pose must be gone (thumb flew off the finger, or the hand blurred out of the model's view).
// A hand just held in the pose while you talk or something clicks stays in the pose: dropped.
// sound(now) on a loud click; hands(n, need, now, ms) on every hand frame, n = hands in snap pose.
// Returns 'fire' | 'drop' | null (still waiting).
function makeSnapGate() {
  let at = null;
  return {
    get waiting() { return at !== null; },
    sound(now) { at = now; },
    cancel() { at = null; },
    hands(n, need, now, ms) {
      if (at === null || now < at) return null; // frame from before the sound
      if (now > at + ms) { at = null; return 'drop'; }
      if (n < need) { at = null; return 'fire'; }
      return null;
    },
  };
}

// Meme "teleport": two fingers up (✌️, together or apart) held in front of the chest.
// face = { x, y, w, h } (0..1, top-left corner) from the face model, or null.
// With a face: chest = palm below the chin and roughly in front of you; works at any camera height.
// ponytail: without a face, falls back to a fixed band of the frame (tuned on a desk webcam).
const MEME_CHEST_Y = 0.62;
function isChest(lm, face) {
  const p = lm[9];
  if (!face) return p.y > MEME_CHEST_Y && Math.abs(p.x - 0.5) < 0.3;
  return p.y > face.y + face.h * CFG.chestLine && Math.abs(p.x - (face.x + face.w / 2)) < face.w * 2;
}
function isMemePose(lm, face = null) {
  return handPose(lm) === 'victory' && isChest(lm, face);
}

// Fires once when the pose has been held for holdMs. Short dropouts (the model missing the hand
// for a frame or two) are forgiven, so the hold doesn't restart. Must be released before it fires again.
// arrive: also require the hand to have "flown in": in the windowMs before the pose started it was
// at least minMove away (frame widths, aspect-corrected) or out of view. Holding ✌️ still never fires.
// After firing, cooldownMs passes before it can fire again.
// opts may be a function returning the options; it is read on every update (live settings).
function makeHoldTracker(test, opts = {}) {
  const read = () => ({ holdMs: 300, graceMs: 250, arrive: null, cooldownMs: 0, aspect: 16 / 9, ...(typeof opts === 'function' ? opts() : opts) });
  let { holdMs, graceMs, arrive, cooldownMs, aspect } = read();
  let since = null, lastOn = -1e9, fired = false, until = -1e9;
  const history = []; // [{ t, pts: [{x, y}] }] palm centres of all hands
  const state = { holding: false, arrival: null };
  const pt = lm => ({ x: lm[9].x * aspect, y: lm[9].y });
  function arrivedFrom(p, t0) {
    let far = 0;
    for (const h of history) {
      if (h.t < t0 - arrive.windowMs || h.t > t0) continue;
      const near = h.pts.length ? Math.min(...h.pts.map(q => Math.hypot(q.x - p.x, q.y - p.y))) : Infinity;
      far = Math.max(far, near);
    }
    return far;
  }
  return {
    state,
    get holding() { return state.holding; },
    reset() { since = null; fired = false; state.holding = false; },
    update(landmarks, now, ...args) {
      ({ holdMs, graceMs, arrive, cooldownMs, aspect } = read());
      const on = landmarks.filter(lm => test(lm, ...args));
      history.push({ t: now, pts: landmarks.map(pt) });
      while (history.length && history[0].t < now - 2000) history.shift();
      if (on.length) lastOn = now;
      else if (now - lastOn > graceMs) { since = null; fired = false; state.holding = false; return false; }
      since ??= now;
      state.holding = !fired;
      if (fired || !on.length || now - since < holdMs) return false; // decide only on a frame that sees the pose
      fired = true; // fire or not, this hold is used up
      state.holding = false;
      if (now < until) return false; // still cooling down: holding through it doesn't fire later
      if (arrive) {
        state.arrival = arrivedFrom(pt(on[0]), since);
        if (state.arrival < arrive.minMove) return false;
      }
      until = now + cooldownMs;
      return true;
    },
  };
}

// "Seals": poses shown one after another. hands = 2: both hands in the pose; hands = 1: any one hand.
// ponytail: fixed sequence; make it editable from the panel if one set isn't enough.
const SEALS = [{ pose: 'victory', label: 'V' }, { pose: 'fist', label: 'fist' }, { pose: 'open', label: 'palm' }];

function makeSealTracker(seals = SEALS, opts = {}) {
  const read = () => ({ hold: 2, gap: 3000, hands: 2, ...(typeof opts === 'function' ? opts() : opts) });
  let { hold, gap, hands } = read();
  let step = 0, hits = 0, lastAt = 0;
  const matches = (lms, pose) => hands === 2
    ? lms.length === 2 && lms.every(lm => handPose(lm) === pose)
    : lms.some(lm => handPose(lm) === pose);
  return {
    labels: seals.map(x => hands === 2 ? x.label + ' ×2' : x.label),
    get step() { return step; },
    reset() { step = hits = 0; },
    // Feed every hand-detection result; returns true once the whole sequence is done.
    update(landmarks, now) {
      ({ hold, gap } = read());
      if (step && now - lastAt > gap) step = 0; // too slow between seals: start over
      const ok = matches(landmarks, seals[step].pose);
      hits = ok ? hits + 1 : 0;
      if (hits < hold) return false; // pose must hold for a few checks, not flicker through
      hits = 0; lastAt = now;
      if (++step < seals.length) return false;
      step = 0;
      return true;
    },
  };
}

// Where a sound "hits": the loudest 20 ms, and where it has faded 30 dB below that (the rest is
// near-silent tail). Times in seconds. Used to time the vanish to the sound.
function soundHit(samples, rate) {
  const win = Math.max(1, Math.round(rate * 0.02)), rms = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    rms.push(Math.sqrt(sum / (end - i)));
  }
  let peak = 0;
  rms.forEach((v, i) => { if (v > rms[peak]) peak = i; });
  let cut = rms.length;
  for (let i = peak; i < rms.length; i++) if (rms[i] < rms[peak] / 31.6) { cut = i + 1; break; }
  return { hit: (peak + 0.5) * win / rate, cut: Math.min(samples.length, cut * win) / rate };
}

// ---------- your own gestures: a recorded hand shape, matched live ----------
// A shape is the 20 landmarks after the wrist, relative to the wrist, in palm lengths (wrist ->
// middle-finger base) and turned so the palm points up, aspect-corrected: the same pose anywhere
// in the frame, at any distance or tilt, gives the same numbers. The tilt is kept separately
// (shape.angle, degrees, 0 = fingers up), so 👍 and 👎 stay different.
function handShape(lm, aspect = 16 / 9) {
  const x0 = lm[0].x * aspect, y0 = lm[0].y;
  const dx = lm[9].x * aspect - x0, dy = lm[9].y - y0;
  const s = Math.hypot(dx, dy) || 1e-6, c = -dy / s, n = dx / s; // rotate so (dx, dy) -> (0, -1)
  const out = [];
  for (let i = 1; i < 21; i++) {
    const x = (lm[i].x * aspect - x0) / s, y = (lm[i].y - y0) / s;
    out.push(c * x - n * y, n * x + c * y);
  }
  out.angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  return out;
}

// Distance between two shapes, in palm lengths: half the mean point distance, half the worst
// point, so one finger in the wrong place counts even though 19 points agree. The other hand
// (mirror image) counts too. Tuned on a recording of 12 poses: a repeat of the same pose is
// usually < 0.3 away, the nearest different pose > 0.5.
function shapeDist(a, b) {
  const one = s => {
    let d = 0, mx = 0;
    for (let i = 0; i < a.length; i += 2) {
      const v = Math.hypot(s * a[i] - b[i], a[i + 1] - b[i + 1]);
      d += v;
      if (v > mx) mx = v;
    }
    return d / a.length + mx / 2;
  };
  return Math.min(one(1), one(-1));
}
const angleDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

// One recorded gesture: { shapes: [{ pts, angle }] (1 or 2 hands), tol (palm lengths), turn (degrees) }.
// How well the hands in the frame match it: 0 = no match … 1 = exact; it fires at >= 0.5.
function gestureScore(g, landmarks, aspect = 16 / 9) {
  const shapes = landmarks.map(lm => handShape(lm, aspect));
  const one = (s, t) => {
    const d = shapeDist(s, t.pts) / g.tol + Math.max(0, angleDiff(s.angle, t.angle) - g.turn / 2) / g.turn;
    return Math.max(0, 1 - d / 2);
  };
  if (g.shapes.length === 1) return Math.max(0, ...shapes.map(s => one(s, g.shapes[0])));
  if (shapes.length < 2) return 0;
  const [a, b] = g.shapes, [p, q] = shapes;
  return Math.max(Math.min(one(p, a), one(q, b)), Math.min(one(p, b), one(q, a)));
}

// Palm centre of the hands in a frame (aspect-corrected: 1 = the frame height), and the same
// point relative to the face, in face heights, so "started at my chin" survives moving the camera.
const palmAt = (lms, aspect = 16 / 9) => ({
  x: lms.reduce((s, lm) => s + (lm[0].x + lm[9].x) / 2 * aspect, 0) / lms.length,
  y: lms.reduce((s, lm) => s + (lm[0].y + lm[9].y) / 2, 0) / lms.length,
});
const byFace = (p, f, aspect = 16 / 9) => ({ x: (p.x - (f.x + f.w / 2) * aspect) / f.h, y: (p.y - (f.y + f.h / 2)) / f.h });
const ZONE_DEF = 1.2, ZONE_ANY = 3; // how far (face heights) a motion may start/end from the recorded spot; ANY = off
const MOVE_MIN = 0.15;  // the hand must cover this much (frame heights) while recording to count as a motion
const MOVE_N = 24;      // points a motion path is compared at
const MOVE_TOL = 0.3;   // default: how different the path may be (share of its size)

// A timed path [{ x, y, t }] sampled at n evenly spaced times.
function resample(path, n = MOVE_N) {
  const t0 = path[0].t, t1 = path[path.length - 1].t, out = [];
  for (let i = 0, j = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * i / (n - 1);
    while (j < path.length - 2 && path[j + 1].t < t) j++;
    const a = path[j], b = path[j + 1] ?? a, k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    out.push([a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]);
  }
  return out;
}
// Shift a path so its centre is at 0, and divide by unit.
function centred(pts, unit) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(p => [(p[0] - cx) / unit, (p[1] - cy) / unit]);
}
// Which way the path heads at each point (unit vector, 0 where it is still).
function heading(pts) {
  return pts.map((_, i) => {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return l > 1e-6 ? [(q[0] - p[0]) / l, (q[1] - p[1]) / l] : [0, 0];
  });
}
// Dynamic time warping: the mean distance between two paths when either may go faster or slower
// in places (a wave done a bit quicker at the start still lines up). Each point also carries the
// way it heads (weight w), so going right and coming back left is not the same as just going right.
function dtw(a, b, w) {
  const n = a.length, m = b.length, D = new Float64Array(n * m), L = new Uint16Array(n * m);
  const ha = heading(a), hb = heading(b);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const d = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1], (ha[i][0] - hb[j][0]) * w, (ha[i][1] - hb[j][1]) * w);
    if (!i && !j) { D[0] = d; L[0] = 1; continue; }
    let best = Infinity, k = -1;
    for (const q of [i && j ? (i - 1) * m + j - 1 : -1, i ? (i - 1) * m + j : -1, j ? i * m + j - 1 : -1]) if (q >= 0 && D[q] < best) { best = D[q]; k = q; }
    D[i * m + j] = best + d; L[i * m + j] = L[k] + 1;
  }
  return D[n * m - 1] / L[n * m - 1];
}

// Builds a gesture from recorded frames: each is the landmarks of the hands seen in that frame,
// or { lms, t, face } when the time and the face box are known too. Keeps the frames with the
// most common hand count and takes the per-point median, so a shaky frame or a half-formed pose
// doesn't pull the template. If the hand moved while recording (a swipe, a goodbye wave, a circle),
// the gesture also gets move: the whole path of the palm, and then only fires when the pose makes
// that path again:
//   move = { path: [[x, y]] (MOVE_N points, centred, in face heights or frame heights), ext (its size),
//            ms, unit (face height when recorded, or null), dx, dy (net direction), net (net travel / size),
//            from?, to? (where it started and ended, relative to the face) }
// Returns null if no hand was seen.
function recordGesture(frames, aspect = 16 / 9) {
  const all = frames.map(f => Array.isArray(f) ? { lms: f, t: 0 } : f);
  const seen = all.filter(f => f.lms.length);
  if (!seen.length) return null;
  const hands = seen.filter(f => f.lms.length === 2).length > seen.length / 2 ? 2 : 1;
  const kept = seen.filter(f => f.lms.length === hands);
  const used = kept.map(f => [...f.lms].sort((a, b) => a[0].x - b[0].x).map(lm => handShape(lm, aspect)));
  const med = v => { v = [...v].sort((a, b) => a - b); return v[v.length >> 1]; };
  const shapes = Array.from({ length: hands }, (_, k) => ({
    pts: used[0][k].map((_, i) => med(used.map(f => f[k][i]))),
    angle: med(used.map(f => f[k].angle)),
  }));
  return { hands, shapes, move: recordMove(kept, aspect) };
}

function recordMove(kept, aspect) {
  if (kept.length < 4 || !kept.some(f => f.t)) return null;
  // palm path, lightly smoothed (median of 3) so landmark jitter doesn't count as motion
  const raw = kept.map(f => ({ ...palmAt(f.lms, aspect), t: f.t, face: f.face }));
  const m3 = (i, k) => [raw[Math.max(0, i - 1)][k], raw[i][k], raw[Math.min(raw.length - 1, i + 1)][k]].sort((a, b) => a - b)[1];
  let path = raw.map((p, i) => ({ ...p, x: m3(i, 'x'), y: m3(i, 'y') }));
  const size = ps => Math.max(Math.max(...ps.map(p => p.x)) - Math.min(...ps.map(p => p.x)), Math.max(...ps.map(p => p.y)) - Math.min(...ps.map(p => p.y)));
  const ext0 = size(path);
  if (ext0 < MOVE_MIN) return null; // held still: a pose, not a motion
  // trim the still bits before the motion starts and after it ends
  const still = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < ext0 * 0.03; // barely moved since the last frame
  let a = 0, b = path.length - 1;
  while (a < b - 3 && still(path[a], path[a + 1])) a++;
  while (b > a + 3 && still(path[b - 1], path[b])) b--;
  path = path.slice(a, b + 1);
  const faces = path.filter(p => p.face).map(p => p.face.h).sort((x, y) => x - y);
  const unit = faces.length > path.length / 2 ? faces[faces.length >> 1] : null;
  const pts = centred(resample(path), unit ?? 1);
  const s = path[0], e = path[path.length - 1], net = Math.hypot(e.x - s.x, e.y - s.y);
  const move = {
    path: pts, ext: size(pts.map(([x, y]) => ({ x, y }))), ms: Math.max(300, e.t - s.t), unit,
    dx: net ? (e.x - s.x) / net : 0, dy: net ? (e.y - s.y) / net : 0, net: net / ext0,
  };
  const f0 = path.find(p => p.face)?.face, f1 = [...path].reverse().find(p => p.face)?.face;
  if (unit && f0 && f1) Object.assign(move, { from: byFace(s, f0, aspect), to: byFace(e, f1, aspect) });
  return move;
}

// Tracker for a gesture with motion. Keeps the palm path of the last ~2x the recorded time (the
// hand that best matches the pose); on every frame compares the last 0.6...1.6x the recorded time
// of it with the recorded path (dtw, after centring and scaling by your face height, so it works
// nearer to or further from the camera). Fires when it is closer than g.moveTol (share of the
// path's size), the pose showed clearly at least once in it, and (face seen) it started and ended
// near where it did relative to the face (g.zone face heights; >= ZONE_ANY = anywhere).
// state.path is the palm path (for the studio overlay), state.progress 0..1 how close it is.
function makeMoveTracker(g, opts = {}) {
  const read = () => ({ cooldownMs: 1500, aspect: 16 / 9, ...(typeof opts === 'function' ? opts() : opts) });
  const path = [], state = { path, progress: 0, dist: Infinity };
  const M = g.move, SPANS = [0.6, 0.75, 0.9, 1.1, 1.3, 1.6];
  let until = -1e9;
  const clear = () => { path.length = 0; state.progress = 0; state.dist = Infinity; };
  return {
    state,
    reset: clear,
    update(landmarks, now, face) {
      const { cooldownMs, aspect } = read();
      let lms = landmarks;
      if (g.hands === 1 && landmarks.length > 1) { // follow the same hand: the one nearest the path so far (else the best pose)
        const last = path[path.length - 1];
        lms = [landmarks.reduce((p, q) => last
          ? (Math.hypot(palmAt([q], aspect).x - last.x, palmAt([q], aspect).y - last.y) < Math.hypot(palmAt([p], aspect).x - last.x, palmAt([p], aspect).y - last.y) ? q : p)
          : (gestureScore(g, [q], aspect) > gestureScore(g, [p], aspect) ? q : p))];
      }
      if (lms.length < g.hands) { // hand gone: a short gap is forgiven
        if (path.length && now - path[path.length - 1].t > 300) clear();
        return false;
      }
      path.push({ ...palmAt(lms, aspect), t: now, face, ok: gestureScore(g, lms, aspect) >= 0.5 });
      while (path[0].t < now - 2 * M.ms) path.shift();
      const tol = g.moveTol ?? MOVE_TOL, zone = g.zone ?? ZONE_DEF;
      const unit = M.unit ? (face?.h ?? M.unit) : 1;
      let best = Infinity, hit = null;
      for (const k of SPANS) {
        const t0 = now - k * M.ms;
        if (path[0].t > t0 + 80) continue; // not that much path yet
        const win = path.filter(p => p.t >= t0);
        // A moving hand turns and blurs, so the pose only has to show clearly somewhere in it; the path decides.
        if (win.length < 5 || !win.some(p => p.ok)) continue;
        const pts = centred(resample(win), unit);
        const big = Math.max(Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])));
        if (big < M.ext * 0.5) continue; // the hand barely moved: not this motion, however still it is
        const d = dtw(pts, M.path, M.ext * 0.25) / M.ext;
        if (d < best) { best = d; hit = win; }
      }
      state.dist = best;
      state.progress = Number.isFinite(best) ? Math.max(0, Math.min(1, 1 - (best - tol) / tol)) : 0;
      if (!hit || best > tol) return false;
      if (M.from && zone < ZONE_ANY) { // where it started and ended, relative to the face
        const off = (q, want) => { const s = byFace(q, q.face, aspect); return Math.hypot(s.x - want.x, s.y - want.y); };
        const s = hit[0], e = hit[hit.length - 1];
        if ((s.face && off(s, M.from) > zone) || (e.face && off(e, M.to) > zone)) return false;
      }
      clear();
      if (now < until) return false;
      until = now + cooldownMs;
      return true;
    },
  };
}
