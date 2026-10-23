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
const SEALS = [{ pose: 'victory', emoji: '✌️' }, { pose: 'fist', emoji: '✊' }, { pose: 'open', emoji: '✋' }];

function makeSealTracker(seals = SEALS, opts = {}) {
  const read = () => ({ hold: 2, gap: 3000, hands: 2, ...(typeof opts === 'function' ? opts() : opts) });
  let { hold, gap, hands } = read();
  let step = 0, hits = 0, lastAt = 0;
  const matches = (lms, pose) => hands === 2
    ? lms.length === 2 && lms.every(lm => handPose(lm) === pose)
    : lms.some(lm => handPose(lm) === pose);
  return {
    labels: seals.map(x => x.emoji.repeat(hands)),
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
