// A drawn stand-in for the camera picture in the store pictures: a soft blurred background and a
// cartoon person in headphones (no real person, no real room). Evaluated in a page by test/art.mjs.
// window.scene = { bg(canvas), person(canvas, face, hand?) }
//   face: { x, y, w, h } (0..1, like the face detector's box); hand: 21 landmarks (0..1) to draw a raised hand.
window.scene = (() => {
  function bg(c) {
    const x = c.getContext('2d'), W = c.width, H = c.height;
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ece6fb'); g.addColorStop(1, '#f7efe7');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save();
    x.filter = `blur(${Math.round(W / 22)}px)`;
    for (const [px, py, r, col] of [[0.12, 0.25, 0.22, '#cbbcff'], [0.85, 0.2, 0.2, '#ffd9c7'], [0.75, 0.85, 0.25, '#bfe4ff'], [0.2, 0.9, 0.2, '#ffe7b8'], [0.5, 0.05, 0.16, '#e3d6ff']]) {
      x.fillStyle = col; x.beginPath(); x.arc(px * W, py * H, r * W, 0, 7); x.fill();
    }
    x.restore();
    // soft light bars, like a blurred window
    x.save(); x.globalAlpha = 0.35; x.filter = `blur(${Math.round(W / 60)}px)`; x.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) x.fillRect(W * (0.06 + i * 0.07), H * 0.12, W * 0.05, H * 0.5);
    x.restore();
  }

  const SKIN = '#f2c4a2', SKIN_D = '#e2a983', HAIR = '#2d2433', HOOD = '#6d4aff', HOOD_D = '#5434d6';
  function person(c, face, hand) {
    const x = c.getContext('2d'), W = c.width, H = c.height;
    const cx = (face.x + face.w / 2) * W, cy = (face.y + face.h / 2) * H, r = face.h * H * 0.5;
    x.lineCap = x.lineJoin = 'round';
    // hoodie
    const top = cy + r * 1.55, sw = r * 2.9;
    const hg = x.createLinearGradient(0, top, 0, H);
    hg.addColorStop(0, HOOD); hg.addColorStop(1, HOOD_D);
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(cx - sw, H + 10);
    x.bezierCurveTo(cx - sw, top + r * 0.6, cx - sw * 0.75, top, cx - r * 0.7, top - r * 0.05);
    x.lineTo(cx + r * 0.7, top - r * 0.05);
    x.bezierCurveTo(cx + sw * 0.75, top, cx + sw, top + r * 0.6, cx + sw, H + 10);
    x.closePath(); x.fill();
    // neck and collar
    x.fillStyle = SKIN_D;
    x.fillRect(cx - r * 0.38, cy + r * 0.6, r * 0.76, r * 1.05);
    x.fillStyle = HOOD_D;
    x.beginPath(); x.moveTo(cx - r * 0.75, top - r * 0.05); x.quadraticCurveTo(cx, top + r * 0.75, cx + r * 0.75, top - r * 0.05); x.quadraticCurveTo(cx, top + r * 0.35, cx - r * 0.75, top - r * 0.05); x.fill();
    x.strokeStyle = '#efe9ff'; x.lineWidth = r * 0.07; // hoodie strings
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * r * 0.3, top + r * 0.2); x.lineTo(cx + s * r * 0.36, top + r * 1.25); x.stroke(); }
    // ears, head
    x.fillStyle = SKIN;
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * r * 0.86, cy + r * 0.08, r * 0.17, r * 0.24, 0, 0, 7); x.fill(); }
    x.beginPath(); x.ellipse(cx, cy, r * 0.84, r * 1.02, 0, 0, 7); x.fill();
    // hair
    x.fillStyle = HAIR;
    x.beginPath();
    x.ellipse(cx, cy - r * 0.42, r * 0.92, r * 0.72, 0, Math.PI, 0);
    x.quadraticCurveTo(cx + r * 0.5, cy - r * 0.62, cx - r * 0.2, cy - r * 0.48);
    x.quadraticCurveTo(cx - r * 0.75, cy - r * 0.35, cx - r * 0.92, cy - r * 0.1);
    x.closePath(); x.fill();
    // face
    x.fillStyle = HAIR;
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * r * 0.33, cy + r * 0.05, r * 0.075, r * 0.11, 0, 0, 7); x.fill(); }
    x.strokeStyle = HAIR; x.lineWidth = r * 0.06;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * r * 0.2, cy - r * 0.2); x.quadraticCurveTo(cx + s * r * 0.34, cy - r * 0.27, cx + s * r * 0.48, cy - r * 0.18); x.stroke(); }
    x.strokeStyle = '#a5524a'; x.lineWidth = r * 0.07;
    x.beginPath(); x.arc(cx, cy + r * 0.3, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
    x.fillStyle = 'rgba(240,120,120,0.25)';
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * r * 0.52, cy + r * 0.3, r * 0.14, r * 0.09, 0, 0, 7); x.fill(); }
    // headphones
    x.strokeStyle = '#2a2a33'; x.lineWidth = r * 0.16;
    x.beginPath(); x.ellipse(cx, cy - r * 0.05, r * 0.98, r * 1.12, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
    for (const s of [-1, 1]) {
      x.fillStyle = '#2a2a33'; x.beginPath(); x.roundRect(cx + s * r * 0.92 - r * 0.17, cy - r * 0.18, r * 0.34, r * 0.56, r * 0.14); x.fill();
      x.fillStyle = '#8b6dff'; x.beginPath(); x.roundRect(cx + s * r * 0.92 - r * 0.09, cy - r * 0.08, r * 0.18, r * 0.36, r * 0.08); x.fill();
    }
    if (hand) drawHand(x, hand, W, H, cx, top, sw);
  }

  // A raised hand along real landmarks: sleeve from the shoulder to the wrist, palm, fingers.
  function drawHand(x, lm, W, H, cx, top, sw) {
    const P = i => [lm[i].x * W, lm[i].y * H];
    const palm = Math.hypot(P(9)[0] - P(0)[0], P(9)[1] - P(0)[1]);
    const side = P(0)[0] < cx ? -1 : 1;
    const sh = [cx + side * sw * 0.72, top + palm * 0.9];
    x.strokeStyle = HOOD; x.lineWidth = palm * 0.75;
    x.beginPath(); x.moveTo(...sh); x.quadraticCurveTo(sh[0] + side * palm * 0.4, (sh[1] + P(0)[1]) / 2, P(0)[0], P(0)[1] + palm * 0.25); x.stroke();
    x.fillStyle = SKIN; x.strokeStyle = SKIN;
    x.beginPath(); for (const [k, i] of [0, 1, 5, 9, 13, 17].entries()) x[k ? 'lineTo' : 'moveTo'](...P(i)); x.closePath();
    x.lineWidth = palm * 0.3; x.stroke(); x.fill();
    x.lineWidth = palm * 0.24;
    for (const f of [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]) {
      x.beginPath(); f.forEach((i, k) => x[k ? 'lineTo' : 'moveTo'](...P(i))); x.stroke();
    }
  }
  return { bg, person };
})();
