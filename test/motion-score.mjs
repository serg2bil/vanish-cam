// Records a motion gesture from a stretch of a landmark dump (test/hands-dump.mjs) and runs the
// tracker over the whole dump: prints when it fires and how close it got, to tune MOVE_TOL offline.
// Usage: node test/motion-score.mjs <dump.json> <from s> <to s> [tol]
import fs from 'fs';
import vm from 'vm';
const ctx = {};
vm.runInNewContext(['settings.js', 'gestures.js'].map(f => fs.readFileSync(new URL('../vanish-cam/' + f, import.meta.url), 'utf8')).join('\n') +
  ';Object.assign(globalThis, { recordGesture, makeMoveTracker })', ctx);
const [, , file, a, b, tol] = process.argv;
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const frames = d.frames.map(f => ({ lms: f.hands.map(h => h.lm), t: f.t * 1000, face: f.face }));
const g = { ...ctx.recordGesture(frames.filter(f => f.t >= a * 1000 && f.t <= b * 1000)), tol: 0.4, turn: 60, ...(tol && { moveTol: +tol }) };
if (!g.move) { console.log('recorded as a pose (no motion)'); process.exit(); }
console.log(`recorded: ${g.hands} hand(s), ${Math.round(g.move.ms)} ms, size ${g.move.ext.toFixed(2)}, net ${g.move.net.toFixed(2)}, face ${!!g.move.unit}`);
const tr = ctx.makeMoveTracker(g, { cooldownMs: 1500 });
let sec = -1, best = Infinity;
for (const f of frames) {
  if (tr.update(f.lms, f.t, f.face)) console.log(`FIRE at ${(f.t / 1000).toFixed(2)} s`);
  best = Math.min(best, tr.state.dist);
  if (Math.floor(f.t / 1000) !== sec) { if (sec >= 0 && best < 1) process.stdout.write(`${sec}s:${best.toFixed(2)} `); sec = Math.floor(f.t / 1000); best = Infinity; }
}
console.log();
