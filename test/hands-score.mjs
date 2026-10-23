// Prints a timeline of what the gesture logic sees in a landmarks dump (from hands-dump.mjs).
// Usage: node test/hands-score.mjs <dump.json> [more dumps...]
// One character per 1/3 s:  . no hand   ? hand, no pose   V ✌️   F ✊   O ✋   S snap pose
import fs from 'fs';
import vm from 'vm';

const ctx = {};
vm.runInNewContext(['settings.js', 'gestures.js'].map(f => fs.readFileSync(new URL('../vanish-cam/' + f, import.meta.url), 'utf8')).join('\n') +
  ';Object.assign(globalThis, { handPose, isSnapPose })', ctx);
const { handPose, isSnapPose } = ctx;
const CODE = { victory: 'V', fist: 'F', open: 'O' };

for (const file of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const slots = new Map();
  let seen = 0;
  for (const f of d.frames) {
    if (f.hands.length) seen++;
    const k = Math.floor(f.t * 3);
    const c = f.hands.length === 0 ? '.' : f.hands.map(h => isSnapPose(h.lm, h.world) ? 'S' : CODE[handPose(h.lm)] ?? '?').sort().pop();
    // Keep the most informative character in the slot: a pose beats '?', '?' beats '.'.
    const rank = ch => '.?'.indexOf(ch) === -1 ? 2 : '.?'.indexOf(ch);
    if (!slots.has(k) || rank(c) > rank(slots.get(k))) slots.set(k, c);
  }
  const line = [...slots.keys()].sort((a, b) => a - b).map(k => slots.get(k)).join('');
  console.log(`${path(file)}  hand found in ${(100 * seen / d.frames.length).toFixed(0)}% of frames`);
  for (let s = 0; s < line.length; s += 30) console.log(`  ${String(s / 3).padStart(3)}s ${line.slice(s, s + 30)}`);
}
function path(f) { return f.split(/[\\/]/).pop(); }
