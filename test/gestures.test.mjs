// Checks the gesture logic with synthetic hands. Run: node test/gestures.test.mjs
import fs from 'fs';
import vm from 'vm';
import assert from 'assert/strict';

const ctx = {};
vm.runInNewContext(['settings.js', 'gestures.js'].map(f => fs.readFileSync(new URL('../vanish-cam/' + f, import.meta.url), 'utf8')).join('\n') +
  ';Object.assign(globalThis, { handPose, isSnapPose, makeSealTracker, SEALS, isMemePose, makeHoldTracker, soundHit, makeSnapGate, CFG, recordGesture, gestureScore, makeMoveTracker })', ctx);
const { handPose, isSnapPose, makeSealTracker, SEALS, isMemePose, makeHoldTracker, soundHit, makeSnapGate, recordGesture, gestureScore, makeMoveTracker } = ctx;

// Upright hand, wrist at (cx, 0.8). out = [index, middle, ring, pinky]; folded fingers curl back down.
function hand(cx, out, { thumbOnMiddle = false, wristY = 0.8 } = {}) {
  const lm = Array.from({ length: 21 }, () => ({ x: cx, y: wristY }));
  for (let t = 1; t <= 4; t++) lm[t] = { x: cx - 0.04 * t, y: wristY - 0.04 * t }; // thumb to the side
  [5, 9, 13, 17].forEach((mcp, f) => {
    const x = cx - 0.06 + f * 0.04, dy = wristY - 0.8;
    lm[mcp] = { x, y: 0.6 + dy };
    lm[mcp + 1] = { x, y: 0.5 + dy };
    if (out[f]) { lm[mcp + 2] = { x, y: 0.45 + dy }; lm[mcp + 3] = { x, y: 0.4 + dy }; }
    else { lm[mcp + 2] = { x, y: 0.55 + dy }; lm[mcp + 3] = { x, y: 0.62 + dy }; }
  });
  if (thumbOnMiddle) lm[4] = { ...lm[12] };
  return lm;
}
const OPEN = [1, 1, 1, 1], V = [1, 1, 0, 0], FIST = [0, 0, 0, 0];
const two = out => [hand(0.3, out), hand(0.7, out)];

assert.equal(handPose(hand(0.5, OPEN)), 'open');
assert.equal(handPose(hand(0.5, V)), 'victory');
assert.equal(handPose(hand(0.5, FIST)), 'fist');
assert.equal(handPose(hand(0.5, [1, 0, 0, 0])), null);

// Synthetic hands are flat, so the same points serve as image and world landmarks.
const snap = h => isSnapPose(h, h.map(p => ({ ...p, z: 0 })));
assert.ok(snap(hand(0.5, [1, 1, 0, 0], { thumbOnMiddle: true })));
assert.ok(!snap(hand(0.5, OPEN)));
assert.ok(!snap(hand(0.5, [1, 1, 0, 0], { thumbOnMiddle: true, wristY: 0.95 })), 'hand on the desk is not a snap');
assert.ok(!snap(hand(0.5, FIST, { thumbOnMiddle: true })), 'a fist with the thumb on the middle finger is not a snap');
assert.equal(handPose(hand(0.5, V, { thumbOnMiddle: true })), null, 'snap pose (index+middle up, thumb on middle) is not ✌️');

// Full sequence, each seal held for 2 checks.
let s = makeSealTracker(), t = 0, done = false;
for (const out of [V, V, FIST, FIST, OPEN, OPEN]) done = s.update(two(out), t += 100);
assert.ok(done, 'seal sequence completes');
assert.equal(s.step, 0, 'resets after completion');

// Wrong order never completes.
s = makeSealTracker(); done = false;
for (const out of [FIST, FIST, V, V, OPEN, OPEN, OPEN]) done ||= s.update(two(out), t += 100);
assert.ok(!done, 'wrong order does not fire');

// One-frame flicker doesn't count.
s = makeSealTracker();
s.update(two(V), t += 100); s.update(two(OPEN), t += 100); s.update(two(V), t += 100);
assert.equal(s.step, 0, 'a seal must be held');

// Too slow between seals starts over.
s = makeSealTracker();
s.update(two(V), t += 100); s.update(two(V), t += 100);
assert.equal(s.step, 1);
s.update(two(FIST), t += 5000);
assert.equal(s.step, 0, 'timeout resets');

// Only one hand visible: no seal.
s = makeSealTracker();
s.update([hand(0.5, V)], t += 100); s.update([hand(0.5, V)], t += 100);
assert.equal(s.step, 0, 'needs both hands');

// One-hand mode: a single hand does the whole sequence.
s = makeSealTracker(SEALS, { hands: 1 }); done = false;
for (const out of [V, V, FIST, FIST, OPEN, OPEN]) done = s.update([hand(0.5, out)], t += 100);
assert.ok(done, 'one-hand sequence completes');
assert.equal(s.labels.join(' '), 'V fist palm');

// One-hand mode: the other hand doing something else doesn't block it.
s = makeSealTracker(SEALS, { hands: 1 }); done = false;
for (const out of [V, V, FIST, FIST, OPEN, OPEN]) done = s.update([hand(0.3, out), hand(0.7, [1, 0, 0, 0])], t += 100);
assert.ok(done, 'one-hand sequence ignores the other hand');

// One-hand mode still needs the right order.
s = makeSealTracker(SEALS, { hands: 1 }); done = false;
for (const out of [OPEN, OPEN, FIST, FIST, V, V]) done ||= s.update([hand(0.5, out)], t += 100);
assert.ok(!done, 'one-hand wrong order does not fire');

assert.equal(makeSealTracker().labels.join(' '), 'V ×2 fist ×2 palm ×2');

// Meme pose without a face: fixed chest band of the frame.
assert.ok(isMemePose(hand(0.5, V, { wristY: 0.9 })), '✌️ at chest height');
assert.ok(!isMemePose(hand(0.5, V, { wristY: 0.45 })), '✌️ raised by the face is not the meme pose');
assert.ok(!isMemePose(hand(0.5, OPEN, { wristY: 0.9 })));

// With a face, "chest" is relative to the chin, so camera height doesn't matter.
const faceHigh = { x: 0.4, y: 0.05, w: 0.2, h: 0.25 };  // usual: face near the top of the frame
const faceLow = { x: 0.4, y: 0.45, w: 0.2, h: 0.25 };   // camera above you: face low in the frame
assert.ok(isMemePose(hand(0.5, V, { wristY: 0.8 }), faceHigh), 'palm at 0.6, well below the chin');
assert.ok(!isMemePose(hand(0.5, V, { wristY: 0.5 }), faceHigh), 'palm at face height');
assert.ok(!isMemePose(hand(0.5, V, { wristY: 0.9 }), faceLow), 'palm at 0.7 is head level when the face is low');
assert.ok(!isMemePose(hand(0.05, V, { wristY: 0.8 }), faceHigh), 'far off to the side is not in front of you');

// Hold tracker (no arrival rule): fires once after holdMs, forgives a short dropout, needs a release.
const ht = makeHoldTracker(isMemePose, { holdMs: 300, graceMs: 250 });
const meme = [hand(0.5, V, { wristY: 0.9 })], none = [];
let fires = 0; t = 0;
const feed = (lms, ms, tr = ht) => { for (let e = 0; e < ms; e += 66) if (tr.update(lms, t += 66)) fires++; };
feed(meme, 200);
assert.equal(fires, 0, 'not before holdMs');
feed(none, 130);                   // model misses the hand for two checks
feed(meme, 200);
assert.equal(fires, 1, 'fires after holdMs despite a short dropout');
feed(meme, 1000);
assert.equal(fires, 1, 'holding longer does not fire again');
feed(none, 400);                   // released
feed(meme, 400);
assert.equal(fires, 2, 'fires again after release');
feed(none, 400);
feed(meme, 100); feed(none, 400); feed(meme, 100);
assert.equal(fires, 2, 'short flashes of the pose do not fire');

// Arrival rule: the hand must fly in (or come into view); holding ✌️ at the chest never fires.
const arr = () => makeHoldTracker(isMemePose, { holdMs: 150, graceMs: 250, arrive: { windowMs: 500, minMove: 0.15 }, cooldownMs: 1500 });
const raised = [hand(0.5, OPEN, { wristY: 0.45 })]; // hand up high, not the pose
let a = arr(); fires = 0;
feed(meme, 1500, a);
assert.equal(fires, 0, 'already at the chest: no fire');
feed(raised, 300, a); feed(meme, 300, a);
assert.equal(fires, 1, 'flies down from high up: fires');
assert.ok(a.state.arrival >= 0.15);

a = arr(); fires = 0;
feed(none, 600, a); feed(meme, 300, a);
assert.equal(fires, 1, 'comes into view at the chest: fires');

// Cooldown: a second fly-in right after doesn't fire; holding through the cooldown doesn't either.
feed(raised, 300, a); feed(meme, 300, a);
assert.equal(fires, 1, 'within cooldown: no fire');
feed(meme, 2000, a);
assert.equal(fires, 1, 'holding past the cooldown does not fire late');
feed(raised, 300, a); feed(meme, 300, a);
assert.equal(fires, 2, 'after cooldown: fires again');

// Wiggling a little at the chest is not a fly-in.
a = arr(); fires = 0;
for (let k = 0; k < 10; k++) { feed([hand(0.5, OPEN, { wristY: 0.9 })], 130, a); feed([hand(0.52, V, { wristY: 0.9 })], 200, a); }
assert.equal(fires, 0, 'small moves at the chest do not fire');

// Sound hit: silence, then a burst at 0.2 s that decays; tail cut where it is 30 dB down.
{
  const r = 8000, a = new Float32Array(r * 2);
  for (let i = 0; i < a.length; i++) { const tt = i / r; a[i] = tt < 0.2 ? 0 : Math.sin(i) * Math.exp(-(tt - 0.2) * 3); }
  const { hit, cut } = soundHit(a, r);
  assert.ok(Math.abs(hit - 0.21) < 0.02, `hit at ${hit}`);
  assert.ok(cut > 1.2 && cut < 1.5, `tail cut at ${cut}`);
}

// Snap gate: the pose must break right after the sound.
{
  const g = makeSnapGate();
  g.sound(1000);
  assert.equal(g.hands(0, 1, 990, 300), null, 'frame from before the sound is ignored');
  assert.equal(g.hands(1, 1, 1030, 300), null, 'still in pose: wait');
  assert.equal(g.hands(0, 1, 1060, 300), 'fire', 'pose broke: snap');
  g.sound(2000);
  assert.equal(g.hands(1, 1, 2100, 300), null);
  assert.equal(g.hands(1, 1, 2350, 300), 'drop', 'hand held still through the sound: no snap');
  g.sound(3000);
  assert.equal(g.hands(1, 2, 3050, 300), 'fire', 'two-hand mode: one hand left the pose');
  assert.equal(g.hands(0, 1, 3100, 300), null, 'decided once');
}

// Your own gestures: record ✌️, then it matches ✌️ anywhere (either hand, any size) but not ✋ or ✊.
{
  const g = { ...recordGesture([[hand(0.5, V)], [hand(0.5, V)], [hand(0.5, V)], []]), tol: 0.4, turn: 60 };
  assert.equal(g.hands, 1);
  const scale = (lm, k, dx) => lm.map(p => ({ x: 0.5 + (p.x - 0.5) * k + dx, y: 0.8 + (p.y - 0.8) * k }));
  assert.ok(gestureScore(g, [hand(0.5, V)]) > 0.95, 'same pose');
  assert.ok(gestureScore(g, [scale(hand(0.5, V), 0.6, 0.2)]) > 0.9, 'smaller and elsewhere');
  assert.ok(gestureScore(g, [scale(hand(0.5, V).map(p => ({ x: 1 - p.x, y: p.y })), 1, 0)]) > 0.9, 'the other hand (mirrored)');
  assert.ok(gestureScore(g, [hand(0.5, OPEN)]) < 0.5, 'open hand is not ✌️');
  assert.ok(gestureScore(g, [hand(0.5, FIST)]) < 0.5, 'fist is not ✌️');
  assert.equal(gestureScore(g, []), 0);
  const both = { ...recordGesture([two(OPEN), two(OPEN), [hand(0.5, OPEN)]]), tol: 0.4, turn: 60 };
  assert.equal(both.hands, 2, 'two hands in most frames');
  assert.ok(gestureScore(both, two(OPEN)) > 0.95);
  assert.ok(gestureScore(both, [hand(0.5, OPEN)]) === 0, 'two-hand gesture needs two hands');
}

// A gesture with motion: ✌️ swept to the right (in the camera picture) fires only when swept that way again.
{
  const still = { ...recordGesture(Array.from({ length: 20 }, (_, i) => ({ lms: [hand(0.5, V)], t: i * 50 }))), tol: 0.4, turn: 60 };
  assert.equal(still.move, null, 'no travel = a pose, not a motion');
  const sweep = (from, to, n = 20) => Array.from({ length: n }, (_, i) => ({ lms: [hand(from + (to - from) * i / (n - 1), V)], t: i * 50 }));
  const g = { ...recordGesture(sweep(0.3, 0.7)), tol: 0.4, turn: 60 };
  assert.ok(g.move && g.move.dx > 0.99 && g.move.net > 0.9 && g.move.path.length === 24, 'swept right');
  const run = (frames, gg = g) => { const tr = makeMoveTracker(gg, { cooldownMs: 1500 }); return frames.map(f => tr.update(f.lms, f.t, f.face ?? null)).filter(Boolean).length; };
  assert.equal(run(sweep(0.3, 0.7)), 1, 'the same sweep fires once');
  assert.equal(run(sweep(0.25, 0.75, 14)), 1, 'a bit faster and longer still fires');
  assert.equal(run(sweep(0.7, 0.3)), 0, 'the other way does not');
  assert.equal(run(Array.from({ length: 20 }, (_, i) => ({ lms: [hand(0.5, V)], t: i * 50 }))), 0, 'holding still does not');
  assert.equal(run(sweep(0.3, 0.7).map(f => ({ ...f, lms: [hand(f.lms[0][0].x, OPEN)] }))), 0, 'the wrong pose swept right does not');
  assert.equal(run([...sweep(0.3, 0.7), ...sweep(0.3, 0.7).map(f => ({ ...f, t: f.t + 3000 }))]), 2, 'again after the cooldown');

  // A wave ("ciao"): there and back. Start and end are the same place, so only the path tells it apart.
  const wave = (n = 30, t0 = 0, dt = 50) => Array.from({ length: n }, (_, i) => ({ lms: [hand(0.5 + 0.2 * Math.sin(i / (n - 1) * Math.PI * 2), OPEN)], t: t0 + i * dt }));
  const w = { ...recordGesture(wave()), tol: 0.4, turn: 60 };
  assert.ok(w.move && w.move.net < 0.2, 'a wave is a motion that comes back');
  assert.equal(run(wave(), w), 1, 'waving again fires');
  assert.equal(run(wave(22, 0, 50), w), 1, 'a quicker wave fires too');
  assert.equal(run(sweep(0.3, 0.7).map(f => ({ ...f, lms: [hand(f.lms[0][0].x, OPEN)] })), w), 0, 'a one-way swipe is not a wave');
  assert.equal(run(Array.from({ length: 30 }, (_, i) => ({ lms: [hand(0.5, OPEN)], t: i * 50 })), w), 0, 'a raised still palm is not a wave');
}

// A motion recorded with the face in view: matched relative to the face, at any distance from the camera.
{
  const FACE = { x: 0.45, y: 0.1, w: 0.1, h: 0.2 };
  const sweep = (from, to, face = FACE, n = 20) => Array.from({ length: n }, (_, i) => ({ lms: [hand(from + (to - from) * i / (n - 1), V)], t: i * 50, face }));
  const g = { ...recordGesture(sweep(0.3, 0.7)), tol: 0.4, turn: 60 };
  assert.ok(g.move.from && g.move.to && g.move.unit === 0.2, 'start, end and size relative to the face');
  const run = (frames, gg = g) => { const tr = makeMoveTracker(gg, { cooldownMs: 1500 }); return frames.map(f => tr.update(f.lms, f.t, f.face)).filter(Boolean).length; };
  assert.equal(run(sweep(0.3, 0.7)), 1, 'same place, same way');
  assert.equal(run(sweep(0.3, 0.7, { ...FACE, x: 0.05 })), 0, 'same move, but the face is elsewhere: it started in another place relative to you');
  // further from the camera: you and the move are half the size (around the wrist line)
  const half = f => ({ ...f, lms: f.lms.map(lm => lm.map(q => ({ x: 0.5 + (q.x - 0.5) * 0.5, y: 0.8 + (q.y - 0.8) * 0.5 }))), face: { x: 0.5 + (FACE.x - 0.5) * 0.5, y: 0.8 + (FACE.y - 0.8) * 0.5, w: FACE.w / 2, h: FACE.h / 2 } });
  assert.equal(run(sweep(0.3, 0.7).map(half)), 1, 'further from the camera still fires');
  assert.equal(run(sweep(0.3, 0.7, { ...FACE, x: 0.05 }).map(f => ({ ...f, face: null }))), 1, 'no face now: the path only');
  assert.equal(run(sweep(0.3, 0.7, { ...FACE, x: 0.05 }), { ...g, zone: 3 }), 1, 'zone "anywhere" ignores the place');
}

assert.equal(SEALS.length, 3);
console.log('gestures: all checks passed');
