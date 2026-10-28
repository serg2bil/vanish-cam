// Line icons for the UI (24×24, stroke 2, round caps): path data only, so the same icon works as
// inline SVG in the pages and as a Path2D on canvas. Names in FILLED are drawn filled.
// <i data-icon="name"></i> in HTML is filled in by drawIcons(); icon(name) makes one in code.

const ICONS = {
  // hand poses (drawn for this extension: the usual icon sets have no ✌️ / ✊ / snap)
  palm: 'M7 12h10v4a5 5 0 0 1-10 0z M8 12V6 M11 12V3.5 M14 12V4 M17 12V7 M7 15l-3-3.5',
  victory: 'M7 12h10v4a5 5 0 0 1-10 0z M9.5 12L8 3.5 M13.5 12L15 3.5 M10 16h4',
  fist: 'M6 11a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z M10 9v3 M14 9v3 M6 14h6',
  snap: 'M5 12h10v4a5 5 0 0 1-10 0z M7 12V5 M10 12V9a2 2 0 0 1 4 0v3 M5 15l-2.5-3 M18 6l2.5-2.5 M19 10h3 M16 3.5V1',
  thumbsUp: 'M7 10v11 M15 5.9L14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z',
  // app
  power: 'M12 2v9 M18.4 6.6a9 9 0 1 1-12.8 0',
  ghost: 'M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z M9 10h.01 M15 10h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  video: 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M16 10l6-3.5v11L16 14',
  cameraOff: 'M2 2l20 20 M7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14 M9.5 4h5L17 7h3a2 2 0 0 1 2 2v7.5 M14.1 14.1a3 3 0 0 1-4.2-4.2',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M21 15l-5-5L5 21 M9 8.5h.01',
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18 M12 8h4 M12 12h5 M12 16h4',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z M5 3v4 M3 5h4',
  volume: 'M11 5L6 9H2v6h4l5 4z M15.5 8.5a5 5 0 0 1 0 7 M19 5a10 10 0 0 1 0 14',
  sliders: 'M4 21v-7 M4 10V3 M12 21v-9 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  pointer: 'M9 9l5 12 1.8-5.2L21 14z M7.2 2.2L8 5.1 M5.1 8l-2.9-.8 M14 4.1L12 6 M6 12l-1.9 2',
  rec: 'M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  play: 'M7 4.5l12.5 7.5L7 19.5z',
  x: 'M18 6L6 18 M6 6l12 12',
  redo: 'M3 12a9 9 0 1 0 2.6-6.4L3 8 M3 3v5h5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  wave: 'M2 12c2-5 4-5 6 0s4 5 6 0 4-5 6 0 M18 9l2 3 2-3',
  check: 'M20 6L9 17l-5-5',
  // effects
  dissolve: 'M3 8h10a3 3 0 1 0-3-3 M3 12h15a3 3 0 1 1-3 3 M3 16h7',
  dust: 'M3 18h2.5v2.5H3z M8.5 14h2.5v2.5H8.5z M14 9.5h2.5V12H14z M19 4h2.5v2.5H19z M10 19h2v2h-2z M16 15h2v2h-2z M4 11h2v2H4z M10 6h1.5v1.5H10z',
  glitch: 'M3 6h12 M8 10h13 M3 14h10 M9 18h12',
  zoomBlur: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9L7 7 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  smoke: 'M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z',
  shatter: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 11L7 3 M11 11l10-3 M11 11l4 10 M11 11L3 15 M11 11l-3 10',
  cut: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  // picks for your own gestures
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9z',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.5 2.8 2.5 2.8z',
  crown: 'M2 20h20 M3 7l5 5 4-7 4 7 5-5-2 11H5z',
  music: 'M9 18V5l12-2v13 M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M18 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  smile: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M8 14s1.5 2 4 2 4-2 4-2 M9 9h.01 M15 9h.01',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z',
};
const FILLED = new Set(['rec', 'play']);
// Icons you can pick for a recorded gesture.
const GESTURE_ICONS = ['star', 'victory', 'palm', 'fist', 'snap', 'thumbsUp', 'heart', 'zap', 'flame', 'crown', 'music', 'smile', 'moon', 'ghost', 'sparkles'];

function icon(name, cls = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ico${FILLED.has(name) ? ' filled' : ''}${cls ? ' ' + cls : ''}`);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name] ?? ICONS.star);
  svg.append(p);
  return svg;
}

function drawIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.replaceChildren(icon(el.dataset.icon));
}

// Same icon on a canvas, centred at (x, y), size px wide.
function drawIconOn(ctx, name, x, y, size, color) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = color;
  const p = new Path2D(ICONS[name]);
  FILLED.has(name) ? ctx.fill(p) : ctx.stroke(p);
  ctx.restore();
}
