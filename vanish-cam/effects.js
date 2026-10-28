// How you leave the picture (and come back), styled after video-editor transitions (CapCut and the like).
// Each effect draws the "you" layer (src: a canvas with you cut out on transparent) onto x, which
// already holds the background, at progress p: 0 = fully there, 1 = gone. Appearing runs p backwards.
// Some effects also touch the whole frame (flash, shake, zoom punch); at p = 0 and p = 1 they leave it alone.
// o = { w, h, cx, cy (your chest), t (ms), seed, scratch, scratch2, scratch3 (spare canvases),
//       opt (this effect's settings: see EFFECT_OPTS) }.
// Runs on the call page and in the studio; no DOM here.

// [id, icon (icons.js), name, duration × the "dissolve duration" setting]
const EFFECT_LIST = [
  ['dust', 'dust', 'Disintegrate (Thanos)', 2],
  ['flash', 'zap', 'Flash teleport', 1],
  ['glitch', 'glitch', 'RGB glitch', 1.2],
  ['zoom', 'zoomBlur', 'Zoom punch', 1],
  ['smoke', 'smoke', 'Smoke puff', 1.4],
  ['shatter', 'shatter', 'Glass shatter', 1.6],
  ['dissolve', 'dissolve', 'Soft dissolve', 1],
  ['cut', 'cut', 'Hard cut with a flash', 0.5],
];
const effectDur = id => (EFFECT_LIST.find(e => e[0] === id) ?? EFFECT_LIST[0])[3];

// Each effect's own sliders (besides its duration), editable in the studio under the effect tiles.
const EFFECT_OPTS = {
  dust: [
    { key: 'spread', label: 'How far the dust flies', min: 0.3, max: 2.5, step: 0.05, unit: '×', def: 1 },
    { key: 'grain', label: 'Dust grain size', min: 0.5, max: 2.5, step: 0.1, unit: '×', def: 1 },
  ],
  flash: [
    { key: 'glow', label: 'Flash brightness', min: 0, max: 2, step: 0.05, unit: '×', def: 1 },
    { key: 'hue', label: 'Glow colour', min: 0, max: 360, step: 5, unit: '°', def: 252 },
  ],
  glitch: [
    { key: 'power', label: 'Tear strength', min: 0.2, max: 2.5, step: 0.05, unit: '×', def: 1 },
    { key: 'shake', label: 'Camera shake', min: 0, max: 3, step: 0.1, unit: '×', def: 1 },
  ],
  zoom: [
    { key: 'power', label: 'Punch strength', min: 0.2, max: 2.5, step: 0.05, unit: '×', def: 1 },
  ],
  smoke: [
    { key: 'power', label: 'Smoke density', min: 0.2, max: 2, step: 0.05, unit: '×', def: 1 },
    { key: 'spread', label: 'Cloud size', min: 0.5, max: 2, step: 0.05, unit: '×', def: 1 },
  ],
  shatter: [
    { key: 'pieces', label: 'Number of shards', min: 0.5, max: 2, step: 0.25, unit: '×', def: 1 },
    { key: 'spread', label: 'How far the shards fly', min: 0.3, max: 2.5, step: 0.05, unit: '×', def: 1 },
  ],
  dissolve: [
    { key: 'blur', label: 'Blur', min: 0, max: 3, step: 0.1, unit: '×', def: 1 },
  ],
  cut: [
    { key: 'glow', label: 'Flash brightness', min: 0, max: 1.3, step: 0.05, unit: '×', def: 1 },
  ],
};
// The settings of one effect: its defaults, then what you changed (cfg.fx[id]).
// ms defaults to the base length (cfg.fadeMs) × the effect's own factor.
function effectOpts(id, cfg) {
  const o = { ms: Math.round(cfg.fadeMs * effectDur(id) / 50) * 50 };
  for (const it of EFFECT_OPTS[id] ?? []) o[it.key] = it.def;
  return Object.assign(o, cfg.fx?.[id]);
}

const EFFECTS = (() => {
  const ease = p => p * p * (3 - 2 * p);
  const clamp = v => Math.min(1, Math.max(0, v));
  const bell = p => Math.sin(Math.PI * clamp(p)); // 0 at both ends, 1 in the middle
  // Deterministic noise: the same piece moves the same way on every frame of one transition.
  const rnd = (i, j, seed) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 0.37) * 43758.5453; return v - Math.floor(v); };
  const fit = (c, w, h) => { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c.getContext('2d'); };
  // A copy of you as a flat colour (for colour fringes).
  function tint(c, src, color) {
    const t = fit(c, src.width, src.height);
    t.globalCompositeOperation = 'copy';
    t.drawImage(src, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(0, 0, c.width, c.height);
    t.globalCompositeOperation = 'source-over';
    return c;
  }
  // Redraws the whole frame scaled / shifted (zoom punch, camera shake).
  function reframe(x, o, scale, dx, dy, ghosts = 0) {
    const f = fit(o.scratch3, o.w, o.h);
    f.globalCompositeOperation = 'copy';
    f.drawImage(x.canvas, 0, 0);
    f.globalCompositeOperation = 'source-over';
    x.save();
    for (let i = ghosts; i >= 0; i--) { // extra copies, bigger and fainter: radial blur
      const s = scale * (1 + i * 0.035);
      x.globalAlpha = i ? 0.22 : 1;
      x.setTransform(s, 0, 0, s, o.w / 2 * (1 - s) + dx, o.h / 2 * (1 - s) + dy);
      x.drawImage(o.scratch3, 0, 0);
    }
    x.restore();
  }

  return {
    // Soft dissolve: fades out while going out of focus.
    dissolve(x, src, p, o) {
      x.save();
      x.globalAlpha = 1 - ease(p);
      x.filter = `blur(${(p * o.w / 160 * (o.opt?.blur ?? 1)).toFixed(1)}px)`;
      x.drawImage(src, 0, 0);
      x.restore();
    },

    // Hard cut, hidden behind one bright frame.
    cut(x, src, p, o) {
      if (p < 0.5) x.drawImage(src, 0, 0);
      const f = Math.max(0, 1 - Math.abs(p - 0.5) * 5);
      const a = Math.min(1, 0.75 * f * (o.opt?.glow ?? 1));
      if (a > 0) { x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(0, 0, o.w, o.h); }
    },

    // Thanos snap: a noisy edge sweeps across you, and each bit flies off as dust in your own colours.
    dust(x, src, p, o) {
      const grain = o.opt?.grain ?? 1, spread = o.opt?.spread ?? 1;
      const GW = Math.round(96 / grain), GH = Math.round(54 / grain), L = 0.28, cw = o.w / GW, ch = o.h / GH;
      // When each cell lets go: a sweep from the top left plus noise at two scales.
      const at = (i, j) => {
        const coarse = rnd(Math.floor(i / 8), Math.floor(j / 8), o.seed), fine = rnd(i, j, o.seed + 1);
        return 0.02 + 0.68 * clamp(0.5 * (i / GW * 0.55 + j / GH * 0.45) + 0.3 * coarse + 0.2 * fine);
      };
      const m = fit(o.scratch, GW, GH), img = m.createImageData(GW, GH);
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) img.data[(j * GW + i) * 4 + 3] = 255 * clamp((at(i, j) - p) / 0.03 + 0.5);
      m.putImageData(img, 0, 0);
      const k = fit(o.scratch2, o.w, o.h); // you, minus what already flew off
      k.globalCompositeOperation = 'copy';
      k.drawImage(src, 0, 0);
      k.globalCompositeOperation = 'destination-in';
      k.imageSmoothingEnabled = true;
      k.drawImage(o.scratch, 0, 0, o.w, o.h);
      k.globalCompositeOperation = 'source-over';
      x.drawImage(o.scratch2, 0, 0);
      // Dust: every cell that let go in the last L of the transition, drifting up and to the side.
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const a = (p - at(i, j)) / L;
        if (a <= 0 || a >= 1) continue;
        const r1 = rnd(i, j, o.seed + 2), r2 = rnd(j, i, o.seed + 3), q = 1 - (1 - a) * (1 - a);
        const px = i * cw + q * o.w * (0.12 + 0.25 * r1) * spread + Math.sin(a * 9 + r2 * 6) * cw * 2;
        const py = j * ch - q * o.h * (0.06 + 0.22 * r2) * spread;
        const s = 1 - 0.75 * a;
        x.globalAlpha = 1 - a;
        x.drawImage(src, i * cw, j * ch, cw, ch, px, py, cw * s, ch * s);
      }
      x.globalAlpha = 1;
    },

    // Flash teleport: you squeeze into a glowing beam and vanish in a burst of light.
    flash(x, src, p, o) {
      const k = ease(p), glow = o.opt?.glow ?? 1, hue = o.opt?.hue ?? 252, e = bell(p) * glow;
      x.save();
      x.translate(o.cx, o.cy);
      x.scale(Math.max(0.02, 1 - k), 1 + 0.5 * k);
      x.translate(-o.cx, -o.cy);
      x.filter = `brightness(${(1 + 4 * k).toFixed(2)}) blur(${(k * 6).toFixed(1)}px)`;
      x.globalAlpha = 1 - k ** 4;
      x.drawImage(src, 0, 0);
      x.restore();
      x.save();
      x.globalCompositeOperation = 'screen';
      const g = x.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, o.h * 0.7);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.95 * e)})`);
      g.addColorStop(0.25, `hsla(${hue},100%,83%,${Math.min(1, 0.5 * e)})`);
      g.addColorStop(1, `hsla(${hue},100%,68%,0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, o.w, o.h);
      const bw = o.w * 0.06 * e, b = x.createLinearGradient(o.cx - bw, 0, o.cx + bw, 0);
      b.addColorStop(0, 'rgba(255,255,255,0)');
      b.addColorStop(0.5, `rgba(255,255,255,${Math.min(1, e)})`);
      b.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = b;
      x.fillRect(o.cx - bw, 0, bw * 2, o.h);
      x.restore();
      const white = Math.min(1, bell(p) ** 6 * 0.45 * glow);
      if (white > 0.01) { x.fillStyle = `rgba(255,255,255,${white})`; x.fillRect(0, 0, o.w, o.h); }
    },

    // RGB glitch: colour channels tear apart, slices jump, scanlines, and the camera shakes.
    glitch(x, src, p, o) {
      const k = ease(p), e = bell(p), tick = Math.floor(o.t / 50), pw = o.opt?.power ?? 1, sh = o.opt?.shake ?? 1;
      const off = o.w * 0.025 * e * pw * (1 + rnd(tick, 1, o.seed));
      x.save();
      x.globalCompositeOperation = 'screen';
      x.globalAlpha = 0.85 * (1 - k * k);
      x.drawImage(tint(o.scratch, src, '#ff1f5a'), -off, 0);
      x.drawImage(tint(o.scratch2, src, '#1fe5ff'), off, 0);
      x.restore();
      const rows = 22, th = o.h / rows;
      for (let j = 0; j < rows; j++) {
        const r = rnd(j, tick, o.seed), r2 = rnd(j, 7, o.seed);
        if (r2 < k) continue; // this slice is gone
        const dx = (r - 0.5) * o.w * 0.16 * e * pw * (r > 0.7 ? 1 : 0.15);
        x.drawImage(src, 0, j * th, o.w, th, dx, j * th, o.w, th);
      }
      x.fillStyle = `rgba(0,0,0,${0.22 * e})`; // scanlines
      for (let y = 0; y < o.h; y += 4) x.fillRect(0, y, o.w, 1.5);
      for (let i = 0; i < 6; i++) { // a few bright blocks
        if (rnd(i, tick, o.seed + 5) > e) continue;
        x.fillStyle = ['#ff1f5a', '#1fe5ff', '#ffffff'][i % 3];
        x.globalAlpha = 0.35 * e;
        x.fillRect(rnd(i, tick, o.seed + 6) * o.w, rnd(tick, i, o.seed + 7) * o.h, o.w * 0.15 * rnd(i, 9, tick), o.h * 0.02);
      }
      x.globalAlpha = 1;
      if (e * sh > 0.05) reframe(x, o, 1 + 0.03 * e * sh, (rnd(tick, 2, o.seed) - 0.5) * o.w * 0.03 * e * sh, (rnd(tick, 3, o.seed) - 0.5) * o.h * 0.02 * e * sh);
    },

    // Zoom punch: the camera punches in with a radial blur while you smear outward and fade.
    zoom(x, src, p, o) {
      const k = ease(p), e = bell(p), pw = o.opt?.power ?? 1;
      x.save();
      for (let i = 5; i >= 0; i--) {
        const s = 1 + 0.35 * k * pw + i * 0.05 * e * pw;
        x.globalAlpha = (1 - k) * (i ? 0.2 : 1);
        x.setTransform(s, 0, 0, s, o.cx * (1 - s), o.cy * (1 - s));
        x.drawImage(src, 0, 0);
      }
      x.restore();
      if (e > 0.02) reframe(x, o, 1 + 0.14 * e * pw, 0, 0, 3);
    },

    // Cartoon "poof": puffs of smoke billow out while you blur away behind them.
    smoke(x, src, p, o) {
      const k = ease(p), e = bell(p), pw = o.opt?.power ?? 1, sz = o.opt?.spread ?? 1;
      x.save();
      x.translate(o.cx, o.cy);
      x.scale(1 - 0.15 * k, 1 - 0.15 * k);
      x.translate(-o.cx, -o.cy);
      x.filter = `blur(${(k * 12).toFixed(1)}px) grayscale(${k.toFixed(2)}) brightness(${(1 + 0.6 * k).toFixed(2)})`;
      x.globalAlpha = 1 - k;
      x.drawImage(src, 0, 0);
      x.restore();
      // Many soft, overlapping puffs that merge into one cloud, each drifting out and up as it grows.
      for (let i = 0; i < 40; i++) {
        const r1 = rnd(i, 1, o.seed), r2 = rnd(i, 2, o.seed), r3 = rnd(i, 3, o.seed);
        const spread = (0.5 + 0.9 * k) * sz, ang = r1 * Math.PI * 2;
        const px = o.cx + Math.cos(ang) * o.w * 0.16 * r2 * spread + (r3 - 0.5) * o.w * 0.06;
        const py = o.cy - o.h * 0.12 + Math.sin(ang) * o.h * 0.34 * r2 * spread - k * o.h * (0.05 + 0.1 * r3);
        const rad = o.h * (0.09 + 0.08 * r3) * (0.5 + 1.1 * k) * sz, a = Math.min(1, e * (0.28 + 0.22 * r3) * pw);
        const g = x.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, `rgba(246,246,250,${a})`);
        g.addColorStop(0.5, `rgba(226,226,234,${a * 0.6})`);
        g.addColorStop(1, 'rgba(210,210,222,0)');
        x.fillStyle = g;
        x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
    },

    // Glass shatter: cracks run across you, then the shards fall and spin away.
    shatter(x, src, p, o) {
      const n = o.opt?.pieces ?? 1, fly = o.opt?.spread ?? 1;
      const cols = Math.max(2, Math.round(8 * n)), rows = Math.max(2, Math.round(6 * n)), cw = o.w / cols, ch = o.h / rows;
      const V = (i, j) => [i * cw + (i % cols ? (rnd(i, j, o.seed) - 0.5) * cw * 0.7 : 0), j * ch + (j % rows ? (rnd(j, i, o.seed) - 0.5) * ch * 0.7 : 0)];
      const tris = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
        tris.push([a, b, c], [a, c, d]);
      }
      const k = fit(o.scratch2, o.w, o.h); // you with the cracks drawn on (only where you are)
      k.globalCompositeOperation = 'copy';
      k.drawImage(src, 0, 0);
      k.globalCompositeOperation = 'source-atop';
      k.strokeStyle = `rgba(255,255,255,${0.8 * Math.min(1, p * 10)})`;
      k.lineWidth = Math.max(1, o.w / 600);
      k.beginPath();
      for (const t of tris) { k.moveTo(...t[0]); k.lineTo(...t[1]); k.lineTo(...t[2]); k.closePath(); }
      k.stroke();
      k.globalCompositeOperation = 'source-over';
      tris.forEach((t, n) => {
        const r = rnd(n, 4, o.seed), start = 0.05 + 0.3 * r, q = clamp((p - start) / (1 - start));
        const gx = (t[0][0] + t[1][0] + t[2][0]) / 3, gy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        x.save();
        x.globalAlpha = 1 - q ** 3;
        x.translate(gx + ((gx - o.cx) * 0.6 * q + (r - 0.5) * o.w * 0.1 * q) * fly, gy + q * q * o.h * 1.1 - q * o.h * 0.08 * fly);
        x.rotate(q * (r - 0.5) * 5);
        x.translate(-gx, -gy);
        x.beginPath();
        x.moveTo(...t[0]); x.lineTo(...t[1]); x.lineTo(...t[2]); x.closePath();
        x.clip();
        x.drawImage(o.scratch2, 0, 0);
        x.restore();
      });
      const crack = Math.max(0, 1 - Math.abs(p - 0.08) * 14) * 0.3; // the moment it breaks
      if (crack > 0) { x.fillStyle = `rgba(255,255,255,${crack})`; x.fillRect(0, 0, o.w, o.h); }
    },
  };
})();
