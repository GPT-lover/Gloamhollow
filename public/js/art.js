// Hand-built vector art for the wanderers and the creatures of the hollow.
// Everything is drawn with canvas paths so there are no image assets.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

function oval(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

export const LOOKS = [
  { name: 'Wren', cloak: '#46769a', cloakDark: '#16283a', horn: 'feelers', glow: '170,225,255', ui: '#9fdcff' },
  { name: 'Thistle', cloak: '#9a4658', cloakDark: '#3a1520', horn: 'crest', glow: '255,190,200', ui: '#ffb3c1' },
];

const MASK = '#eef1f4';
const MASK_SHADE = '#b9c1cb';
const INK = '#05070a';

// ---------- wanderers ----------

function drawMask(ctx, hx, hy, look, T, sway) {
  // horns behind the mask
  ctx.fillStyle = MASK;
  ctx.strokeStyle = MASK;
  ctx.lineCap = 'round';
  if (look.horn === 'feelers') {
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(hx - 4, hy - 11);
    ctx.bezierCurveTo(hx - 6, hy - 28, hx - 16, hy - 38, hx - 30, hy - 36 + sway);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(hx - 31, hy - 33 + sway, 3, Math.PI * 1.3, Math.PI * 0.6, true); ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(hx + 5, hy - 12);
    ctx.bezierCurveTo(hx + 4, hy - 32, hx - 4, hy - 46, hx - 17, hy - 48 + sway * 1.3);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(hx - 18, hy - 45 + sway * 1.3, 2.6, Math.PI * 1.3, Math.PI * 0.6, true); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 11);
    ctx.quadraticCurveTo(hx - 8, hy - 36, hx + 12, hy - 44);
    ctx.quadraticCurveTo(hx + 1, hy - 31, hx + 7, hy - 13);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - 12, hy - 5); ctx.lineTo(hx - 22, hy - 12); ctx.lineTo(hx - 12, hy - 11);
    ctx.closePath(); ctx.fill();
  }
  // mask shell
  const g = ctx.createRadialGradient(hx + 5, hy - 7, 2, hx, hy, 20);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, MASK_SHADE);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(hx - 14, hy - 2);
  ctx.bezierCurveTo(hx - 15, hy - 19, hx + 15, hy - 19, hx + 14, hy - 2);
  ctx.bezierCurveTo(hx + 13, hy + 9, hx + 6, hy + 15, hx + 1, hy + 17);
  ctx.bezierCurveTo(hx - 5, hy + 15, hx - 13, hy + 9, hx - 14, hy - 2);
  ctx.fill();
  // eyes
  ctx.fillStyle = INK;
  oval(ctx, hx - 3.5, hy + 2, 3.7, 6.2, 0.1);
  oval(ctx, hx + 7, hy + 2, 3.5, 6.2, -0.12);
}

function drawWings(ctx, k, look) {
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.fillStyle = 'rgba(240,246,252,0.8)';
  for (const s of [1, -1]) {
    ctx.save();
    ctx.translate(-4, -40);
    ctx.rotate(s * (0.5 + (1 - k) * 0.6) - 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-10, -34, -36, -40);
    ctx.quadraticCurveTo(-26, -20, -34, -6);
    ctx.quadraticCurveTo(-18, -6, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawDowned(ctx, look, T) {
  // crumpled cloak and fallen mask, a faint wisp rising
  ctx.fillStyle = look.cloakDark;
  ctx.beginPath(); ctx.ellipse(0, -5, 22, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = look.cloak;
  ctx.beginPath(); ctx.ellipse(-3, -7, 16, 5, 0.05, 0, TAU); ctx.fill();
  ctx.save();
  ctx.translate(16, -9);
  ctx.rotate(1.25);
  ctx.scale(0.8, 0.8);
  drawMask(ctx, 0, 0, look, T, 0);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const k = ((T * 0.5 + i / 3) % 1);
    ctx.fillStyle = `rgba(${look.glow},${0.35 * (1 - k)})`;
    oval(ctx, Math.sin(T * 2 + i * 2) * 6, -14 - k * 50, 4 * (1 - k) + 1, 6 * (1 - k) + 1);
  }
  ctx.restore();
}

// s: render state (see Player.renderState / remote state)
export function drawPlayer(ctx, s, look, T) {
  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.dn) { drawDowned(ctx, look, T); ctx.restore(); return; }
  if (s.iv && Math.floor(T * 18) % 2 === 0) ctx.globalAlpha = 0.35;

  if (s.fc > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = 36 + s.fc * 34;
    const g = ctx.createRadialGradient(0, -36, 4, 0, -36, r);
    g.addColorStop(0, `rgba(${look.glow},${0.25 + s.fc * 0.3})`);
    g.addColorStop(1, `rgba(${look.glow},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(-r, -36 - r, r * 2, r * 2);
    ctx.restore();
  }

  let sx = 1, sy = 1;
  if (!s.og) { const k = clamp(-s.vy / 1100, -0.7, 1); sy = 1 + k * 0.12; sx = 1 - k * 0.08; }
  if (s.landT > 0) { const k = s.landT / 0.13; sy = 1 - 0.17 * k; sx = 1 + 0.15 * k; }
  if (s.ds) { sx = 1.24; sy = 0.86; }
  ctx.scale(s.f * sx, sy);

  const moving = s.og && Math.abs(s.vx) > 20;
  const ph = s.runT * 15;
  const bob = moving ? -Math.abs(Math.sin(ph)) * 2.6 : Math.sin(T * 2.2) * 0.7;

  if (s.djT > 0) drawWings(ctx, s.djT / 0.35, look);

  // legs
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (moving) {
    const a = Math.sin(ph) * 7;
    ctx.moveTo(-4, -10); ctx.lineTo(-4 + a, -1);
    ctx.moveTo(5, -10); ctx.lineTo(5 - a, -1);
  } else if (!s.og) {
    ctx.moveTo(-4, -12); ctx.lineTo(-8, -4);
    ctx.moveTo(5, -12); ctx.lineTo(3, -3);
  } else {
    ctx.moveTo(-4, -10); ctx.lineTo(-5, -1);
    ctx.moveTo(5, -10); ctx.lineTo(6, -1);
  }
  ctx.stroke();

  ctx.save();
  ctx.rotate(s.ds ? 0.16 : moving ? 0.05 : 0);

  // needle on the back while idle
  if (s.atkT > 0.3 && !s.cs) {
    ctx.strokeStyle = '#8f9caa';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-4, -50 + bob); ctx.lineTo(-24, -12 + bob); ctx.stroke();
    ctx.strokeStyle = '#3a2f2a';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(-3, -52 + bob); ctx.lineTo(-1, -56 + bob); ctx.stroke();
  }

  // cloak
  const top = -42 + bob, hem = -7 + bob;
  const air = !s.og ? clamp(s.vy * 0.008, -6, 8) : 0;
  const trail = -Math.min(13, Math.abs(s.vx) * 0.03) - (s.ds ? 8 : 0);
  const flut = moving || !s.og ? 2.2 : 0.6;
  const cg = ctx.createLinearGradient(-16, 0, 16, 0);
  cg.addColorStop(0, look.cloakDark);
  cg.addColorStop(0.7, look.cloak);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-9, top);
  ctx.quadraticCurveTo(-15, top + 14, -17 + trail, hem - air);
  const x0 = -17 + trail, x1 = 15 + trail * 0.4;
  for (let i = 0; i < 4; i++) {
    const xa = lerp(x0, x1, (i + 0.25) / 4), xb = lerp(x0, x1, (i + 0.6) / 4);
    const yy = hem - air * (1 - i / 4);
    ctx.lineTo(xa, yy + 6 + Math.sin(T * 9 + i * 1.7) * flut);
    ctx.lineTo(xb, yy);
  }
  ctx.lineTo(x1, hem);
  ctx.quadraticCurveTo(15, top + 12, 9, top);
  ctx.closePath();
  ctx.fill();
  // collar
  ctx.fillStyle = look.cloakDark;
  ctx.beginPath(); ctx.ellipse(0, top + 2, 11, 4, 0, 0, TAU); ctx.fill();

  // casting arm flourish
  if (s.cs) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${look.glow},0.7)`;
    oval(ctx, 20, -30 + bob, 9, 6);
    ctx.restore();
  }

  const sway = moving ? Math.sin(ph) * 1.5 : Math.sin(T * 1.8) * 1;
  drawMask(ctx, 2, -54 + bob, look, T, sway + (s.og ? 0 : clamp(s.vy * 0.004, -3, 4)));
  ctx.restore();
  ctx.restore();
}

// Crescent slash, world space.
export function drawSlash(ctx, x, y, f, dir, t, look) {
  const D = 0.17;
  if (t > D) return;
  const k = t / D;
  ctx.save();
  ctx.translate(x, y - 34);
  ctx.scale(f, 1);
  if (dir === 'up') { ctx.translate(-4, -26); ctx.rotate(-Math.PI / 2); }
  else if (dir === 'down') { ctx.translate(-4, 32); ctx.rotate(Math.PI / 2); }
  else ctx.translate(6, 0);
  const R = 66, sweep = 1.3;
  const grow = Math.min(1, k * 3.5);
  const a0 = -sweep, a1 = -sweep + sweep * 2 * grow;
  const N = 16;
  ctx.globalAlpha = 1 - k * k;
  const poly = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = lerp(a0, a1, i / N);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R * 0.92);
    }
    for (let i = N; i >= 0; i--) {
      const a = lerp(a0, a1, i / N);
      const th = Math.sin(Math.PI * (i / N)) * 22 * (1 - k * 0.5);
      ctx.lineTo(Math.cos(a) * (R - th), Math.sin(a) * (R - th) * 0.92);
    }
    ctx.closePath();
  };
  ctx.fillStyle = '#ffffff';
  poly(); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(${look.glow},0.6)`;
  ctx.lineWidth = 2;
  poly(); ctx.stroke();
  ctx.restore();
}

export function drawReviveRing(ctx, x, y, p, look) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y - 60, 16, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgb(${look.glow})`;
  ctx.beginPath(); ctx.arc(x, y - 60, 16, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
  ctx.restore();
}

// ---------- creatures ----------

function crawler(ctx, m, T, C) {
  const walk = T * 16 + m.id;
  ctx.strokeStyle = C('#120d0a');
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const lx = -16 + i * 15, sw = Math.sin(walk + i * 2.1) * 5;
    ctx.moveTo(lx, -8); ctx.lineTo(lx + sw, 0);
  }
  ctx.stroke();
  const g = ctx.createLinearGradient(0, -42, 0, -4);
  g.addColorStop(0, '#8a603d');
  g.addColorStop(1, '#3a281c');
  ctx.fillStyle = C(g);
  ctx.beginPath();
  ctx.moveTo(-29, -6);
  ctx.bezierCurveTo(-31, -36, 18, -46, 25, -10);
  ctx.lineTo(25, -5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C('#2a1b12');
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const x = -16 + k * 13;
    ctx.beginPath(); ctx.moveTo(x, -6); ctx.quadraticCurveTo(x - 5, -22, x + 3, -33 + Math.abs(k - 1) * 3); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,215,170,0.28)';
  ctx.beginPath(); ctx.moveTo(-20, -26); ctx.quadraticCurveTo(-6, -38, 10, -32); ctx.stroke();
  ctx.fillStyle = C('#dcd6ca');
  oval(ctx, 23, -14, 9, 8);
  ctx.fillStyle = C(INK);
  oval(ctx, 25.5, -15, 2.3, 3);
  oval(ctx, 20, -14.5, 2, 2.8);
  ctx.strokeStyle = C('#1c1410');
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(29, -9); ctx.quadraticCurveTo(35, -6, 31, -2); ctx.stroke();
}

function gnat(ctx, m, T, C) {
  const tell = m.s === 'tell';
  const shake = tell ? Math.sin(T * 90) * 2 : 0;
  const cy = -18 + Math.sin(T * 8 + m.id) * 2;
  ctx.translate(shake, 0);
  const flap = 0.25 + 0.75 * Math.abs(Math.sin(T * 46 + m.id));
  ctx.fillStyle = 'rgba(205,222,255,0.38)';
  oval(ctx, -5, cy - 15, 13, 7 * flap + 1, -0.45);
  oval(ctx, 5, cy - 14, 11, 6 * flap + 1, 0.35);
  ctx.fillStyle = C('#262b37');
  ctx.beginPath(); ctx.moveTo(-12, cy + 2); ctx.lineTo(-25, cy + 7); ctx.lineTo(-11, cy + 7); ctx.closePath(); ctx.fill();
  const g = ctx.createRadialGradient(-3, cy - 5, 2, 0, cy, 16);
  g.addColorStop(0, '#3d4456');
  g.addColorStop(1, '#171a22');
  ctx.fillStyle = C(g);
  oval(ctx, 0, cy, 15, 13);
  ctx.fillStyle = C('#ddd8cc');
  oval(ctx, 8, cy + 1, 8, 8.5);
  const angry = tell || m.s === 'dive';
  ctx.fillStyle = angry ? C('#ff9a3c') : C(INK);
  oval(ctx, 11, cy, 2.2, 3.2);
  oval(ctx, 6, cy + 0.5, 2, 3);
}

function hopper(ctx, m, T, C) {
  const c = m.s === 'crouch' ? Math.min(1, m.t / 0.32) : 0;
  const air = m.s === 'air';
  const by = -32 + c * 10;
  ctx.strokeStyle = C('#161e12');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (air) { ctx.moveTo(-6, by + 8); ctx.lineTo(-22, by + 14); ctx.lineTo(-32, by + 30); }
  else { ctx.moveTo(-6, by + 8); ctx.lineTo(-20, by - 6 + c * 8); ctx.lineTo(-11, 0); }
  ctx.moveTo(8, by + 8);
  if (air) { ctx.lineTo(16, by + 18); ctx.lineTo(22, by + 26); }
  else { ctx.lineTo(15, by + 20 - c * 4); ctx.lineTo(12, 0); }
  ctx.stroke();
  const g = ctx.createLinearGradient(0, by - 14, 0, by + 12);
  g.addColorStop(0, '#5a7546');
  g.addColorStop(1, '#253219');
  ctx.fillStyle = C(g);
  oval(ctx, 0, by, 17, 13);
  ctx.fillStyle = C('#1d2814');
  for (let i = 0; i < 3; i++) {
    const x = -10 + i * 7;
    ctx.beginPath(); ctx.moveTo(x - 3, by - 10); ctx.lineTo(x - 2, by - 20); ctx.lineTo(x + 3, by - 11); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = C('#e0dbcf');
  oval(ctx, 14, by - 8, 9, 9);
  ctx.strokeStyle = C('#e0dbcf');
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(15, by - 15); ctx.quadraticCurveTo(20, by - 26, 28, by - 27); ctx.stroke();
  ctx.fillStyle = C(INK);
  oval(ctx, 17, by - 8, 2.2, 3.4);
  oval(ctx, 12, by - 7.5, 2, 3.2);
}

function spitter(ctx, m, T, C) {
  const cy = -32 + Math.sin(T * 2 + m.id) * 3;
  const swell = m.s === 'tell' ? 1 + 0.2 * Math.min(1, m.t / 0.55) : m.s === 'rec' ? 1 - 0.12 * (1 - Math.min(1, m.t / 0.3)) : 1;
  ctx.strokeStyle = C('#241a2b');
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = -12 + i * 8, sw = Math.sin(T * 3 + i + m.id) * 6;
    ctx.beginPath(); ctx.moveTo(x, cy + 20); ctx.quadraticCurveTo(x + sw, cy + 34, x - sw * 0.5, cy + 44); ctx.stroke();
  }
  const flap = 0.3 + 0.7 * Math.abs(Math.sin(T * 30 + m.id));
  ctx.fillStyle = 'rgba(205,222,255,0.3)';
  oval(ctx, -8, cy - 26 * swell, 12, 6 * flap + 1, -0.3);
  oval(ctx, 8, cy - 26 * swell, 12, 6 * flap + 1, 0.3);
  const r = 26 * swell;
  const g = ctx.createRadialGradient(-6, cy - 8, 3, 0, cy, r);
  g.addColorStop(0, '#634a70');
  g.addColorStop(1, '#22182a');
  ctx.fillStyle = C(g);
  oval(ctx, 0, cy, r, r * 0.95);
  // glowing pustules
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pulse = 0.6 + 0.4 * Math.sin(T * 4 + m.id);
  for (const [px, py, pr] of [[-12, -6, 4], [-4, 10, 3.5], [-16, 8, 3], [2, -14, 3]]) {
    ctx.fillStyle = `rgba(255,150,60,${0.35 * pulse * swell})`;
    oval(ctx, px * swell, cy + py * swell, pr * 2.2, pr * 2.2);
    ctx.fillStyle = `rgba(255,190,110,${0.9 * pulse})`;
    oval(ctx, px * swell, cy + py * swell, pr, pr);
  }
  ctx.restore();
  ctx.fillStyle = C('#d8d0c8');
  oval(ctx, 19 * swell, cy + 5, 7, 9);
  ctx.fillStyle = C('#1a0f14');
  oval(ctx, 21 * swell, cy + 6, 3.5, 5 + (m.s === 'tell' ? 2 : 0));
  ctx.fillStyle = C('#ddd6cc');
  oval(ctx, 11 * swell, cy - 12, 8, 6);
  ctx.fillStyle = C(INK);
  oval(ctx, 13 * swell, cy - 12, 1.8, 2.6);
  oval(ctx, 9 * swell, cy - 12, 1.8, 2.6);
}

function shell(ctx, m, T, C) {
  const tell = m.s === 'tell' ? Math.min(1, m.t / 0.7) : 0;
  const charge = m.s === 'charge';
  if (m.s === 'stun') ctx.rotate(Math.sin(T * 30) * 0.04);
  if (tell) { ctx.translate(-tell * 6, 0); ctx.rotate(-0.12 * tell + Math.sin(T * 60) * 0.01 * tell); }
  if (charge) ctx.rotate(0.06);
  const walk = T * (charge ? 30 : 10) + m.id;
  ctx.strokeStyle = C('#0e1216');
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const lx = -32 + i * 20, sw = Math.sin(walk + i * 1.7) * 7;
    ctx.moveTo(lx, -12); ctx.lineTo(lx + sw, 0);
  }
  ctx.stroke();
  // head
  const hx = 44 + (charge ? 4 : 0), hy = -20 + (charge ? 4 : 0);
  ctx.fillStyle = C('#d6d0c5');
  oval(ctx, hx, hy, 13, 11);
  ctx.strokeStyle = C('#d6d0c5');
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(hx + 6, hy - 6); ctx.quadraticCurveTo(hx + 20, hy - 8, hx + 26, hy - 20); ctx.stroke();
  const angry = tell > 0 || charge;
  ctx.fillStyle = angry ? C('#ff8a3c') : C(INK);
  oval(ctx, hx + 5, hy - 1, 2.6, 3.6);
  oval(ctx, hx - 1, hy - 1, 2.4, 3.4);
  // dome
  const g = ctx.createLinearGradient(0, -76, 0, -6);
  g.addColorStop(0, '#617689');
  g.addColorStop(1, '#1b232c');
  ctx.fillStyle = C(g);
  ctx.beginPath();
  ctx.moveTo(-50, -8);
  ctx.bezierCurveTo(-52, -72, 38, -80, 46, -12);
  ctx.lineTo(46, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C('#1a2128');
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 4; k++) {
    const x = -32 + k * 20;
    ctx.beginPath(); ctx.moveTo(x, -8); ctx.quadraticCurveTo(x - 6, -36, x + 4, -60 + Math.abs(k - 1.5) * 8); ctx.stroke();
  }
  ctx.fillStyle = C('#2b3640');
  for (let k = 0; k < 3; k++) {
    const x = -24 + k * 22, y = -62 + Math.abs(k - 1) * 6;
    ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.lineTo(x - 2, y - 16); ctx.lineTo(x + 7, y + 3); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(200,230,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-36, -44); ctx.quadraticCurveTo(-10, -66, 20, -58); ctx.stroke();
}

function bossPose(m) {
  const t = m.t;
  switch (m.s) {
    case 'swTell': return { a: lerp(0.9, -2.3, Math.min(1, t / 0.4)), crouch: 8, lean: -0.08 };
    case 'swipe': return { a: lerp(-2.3, 1.5, Math.min(1, t / 0.12)), crouch: 4, lean: 0.12, trail: true };
    case 'lpTell': return { a: lerp(0.9, -1.8, Math.min(1, t / 0.4)), crouch: 18, lean: 0.05 };
    case 'leap': return { a: m.vy < 0 ? -2.4 : lerp(-2.4, 1.3, clamp((m.vy) / 900, 0, 1)), crouch: -6, lean: 0 };
    case 'chTell': return { a: 2.6, crouch: 12, lean: 0.22, shake: true };
    case 'charge': return { a: 2.7, crouch: 6, lean: 0.3 };
    case 'stun': return { a: 1.7, crouch: 14, lean: -0.2, dizzy: true };
    case 'summon': return { a: -1.9, crouch: -2, lean: -0.15 };
    case 'rec': return { a: 1.4, crouch: 6, lean: 0.05 };
    default: return { a: 1.05, crouch: 0, lean: 0 };
  }
}

function boss(ctx, m, T, C) {
  const P = bossPose(m);
  const moving = Math.abs(m.vx) > 20 && m.s !== 'leap';
  const step = moving ? Math.sin(T * (m.s === 'charge' ? 18 : 7)) : 0;
  if (P.shake) ctx.translate(Math.sin(T * 70) * 2, 0);
  if (P.dizzy) ctx.rotate(Math.sin(T * 8) * 0.03);
  const cr = P.crouch;
  // legs
  ctx.strokeStyle = C('#14171d');
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-28, -66 + cr); ctx.lineTo(-34 + step * 10, -4);
  ctx.moveTo(26, -66 + cr); ctx.lineTo(32 - step * 10, -4);
  ctx.stroke();
  ctx.fillStyle = C('#2a303a');
  oval(ctx, -34 + step * 10, -6, 16, 7);
  oval(ctx, 32 - step * 10, -6, 16, 7);

  ctx.save();
  ctx.translate(0, -70 + cr);
  ctx.rotate(P.lean);
  // tattered mantle behind
  ctx.fillStyle = C('#14161c');
  ctx.beginPath();
  ctx.moveTo(-40, -78);
  ctx.quadraticCurveTo(-82, -40, -78 - Math.abs(m.vx) * 0.03, 30);
  for (let i = 0; i < 5; i++) {
    const x = -78 + i * 14;
    ctx.lineTo(x + 5, 18 + Math.sin(T * 5 + i) * 3); ctx.lineTo(x + 10, 34 + Math.sin(T * 4 + i * 2) * 4);
  }
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  // torso armour
  const g = ctx.createLinearGradient(0, -90, 0, 20);
  g.addColorStop(0, '#5b6577');
  g.addColorStop(1, '#171a21');
  ctx.fillStyle = C(g);
  oval(ctx, 0, -30, 58, 56);
  ctx.strokeStyle = C('#20252e');
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath(); ctx.ellipse(0, -30 + k * 6, 58 - k * 4, 56 - k * 12, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  ctx.fillStyle = C('#8a93a3');
  ctx.beginPath(); ctx.moveTo(-20, -6); ctx.quadraticCurveTo(0, 30, 24, -6); ctx.quadraticCurveTo(2, 4, -20, -6); ctx.fill();
  ctx.strokeStyle = 'rgba(210,230,255,0.22)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -30, 50, Math.PI * 1.15, Math.PI * 1.6); ctx.stroke();

  // head & horns
  const hx = 30, hy = -86;
  ctx.fillStyle = C('#dcd5c8');
  ctx.beginPath();
  ctx.moveTo(hx - 14, hy - 14);
  ctx.bezierCurveTo(hx - 30, hy - 50, hx - 64, hy - 62, hx - 84, hy - 56);
  ctx.bezierCurveTo(hx - 58, hy - 48, hx - 34, hy - 30, hx - 4, hy - 8);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 4, hy - 18);
  ctx.bezierCurveTo(hx + 4, hy - 52, hx - 20, hy - 76, hx - 38, hy - 82);
  ctx.bezierCurveTo(hx - 20, hy - 62, hx - 8, hy - 40, hx + 14, hy - 12);
  ctx.closePath(); ctx.fill();
  const mg = ctx.createRadialGradient(hx + 6, hy - 6, 3, hx, hy, 32);
  mg.addColorStop(0, '#f4efe5');
  mg.addColorStop(1, '#a9a197');
  ctx.fillStyle = C(mg);
  ctx.beginPath();
  ctx.moveTo(hx - 24, hy - 4);
  ctx.bezierCurveTo(hx - 24, hy - 32, hx + 26, hy - 32, hx + 26, hy - 4);
  ctx.bezierCurveTo(hx + 24, hy + 14, hx + 10, hy + 26, hx + 2, hy + 28);
  ctx.bezierCurveTo(hx - 8, hy + 24, hx - 22, hy + 14, hx - 24, hy - 4);
  ctx.fill();
  // glowing eyes
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const eg = m.ph === 2 ? 1 : 0.65;
  ctx.fillStyle = `rgba(255,120,40,${0.45 * eg})`;
  oval(ctx, hx - 4, hy + 2, 12, 10);
  oval(ctx, hx + 12, hy + 2, 11, 10);
  ctx.restore();
  ctx.fillStyle = C(INK);
  oval(ctx, hx - 5, hy + 2, 5, 8, 0.25);
  oval(ctx, hx + 12, hy + 2, 4.6, 8, -0.25);
  ctx.fillStyle = `rgba(255,150,60,${eg})`;
  oval(ctx, hx - 4, hy + 4, 2, 3);
  oval(ctx, hx + 11, hy + 4, 2, 3);

  // arm + great maul
  ctx.save();
  ctx.translate(18, -44);
  if (P.trail) {
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - Math.min(1, m.t / 0.22));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 150, -2.0, P.a);
    ctx.arc(0, 0, 105, P.a, -2.0, true);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.rotate(P.a);
  ctx.strokeStyle = C('#3a2c22');
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(118, 0); ctx.stroke();
  ctx.fillStyle = C('#3c4350');
  ctx.beginPath();
  ctx.moveTo(104, -26); ctx.lineTo(150, -22); ctx.lineTo(156, 0); ctx.lineTo(150, 22); ctx.lineTo(104, 26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C('#606a7a');
  ctx.fillRect(108, -24, 6, 48);
  ctx.fillStyle = C('#2a2f38');
  for (const sy of [-26, 26]) {
    ctx.beginPath(); ctx.moveTo(116, sy); ctx.lineTo(126, sy + Math.sign(sy) * 14); ctx.lineTo(136, sy); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = C('#1d2026');
  oval(ctx, 0, 0, 16, 14);
  ctx.restore();
  ctx.restore();
}

const DRAW = { crawler, gnat, hopper, spitter, shell, boss };
const SPAWN_DUR = { boss: 1.6 };

export function drawMob(ctx, m, T, opt = {}) {
  ctx.save();
  ctx.translate(m.x, m.y);
  let alpha = 1, scale = 1;
  if (m.s === 'spawn') {
    const dur = SPAWN_DUR[m.type] || 0.95;
    const k = clamp(m.t / dur, 0, 1);
    drawSpawnPortal(ctx, m, k, T);
    if (k < 0.55) { ctx.restore(); return; }
    alpha = (k - 0.55) / 0.45;
    scale = 0.6 + 0.4 * alpha;
  }
  if (opt.dead) {
    alpha = opt.alpha;
    ctx.rotate(opt.rot || 0);
  }
  ctx.globalAlpha = alpha;
  ctx.scale(m.face * scale, scale);
  const flash = m.fl && !opt.dead;
  const C = flash ? () => '#ffffff' : opt.dead ? c => (typeof c === 'string' ? shade(c) : '#2a2a30') : c => c;
  DRAW[m.type](ctx, m, T, C);
  ctx.restore();
}

function shade(c) {
  // darken & desaturate a hex colour for corpses
  if (c[0] !== '#' || c.length !== 7) return c;
  const n = parseInt(c.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const l = (r + g + b) / 3;
  const f = v => Math.round(lerp(v, l, 0.6) * 0.45);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawSpawnPortal(ctx, m, k, T) {
  const cy = -m.h / 2;
  const R = (m.type === 'boss' ? 120 : 46) * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5) * (k > 0.85 ? (1 - (k - 0.85) / 0.15) * 0.6 + 0.4 : 1);
  const g = ctx.createRadialGradient(0, cy, 2, 0, cy, R + 4);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(0.7, 'rgba(10,6,4,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, cy, R + 4, 0, TAU); ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = T * 4 + i * 2.1;
    ctx.strokeStyle = `rgba(255,140,60,${0.5 * (1 - k * 0.5)})`;
    ctx.beginPath(); ctx.arc(0, cy, R * (0.5 + i * 0.18), a, a + 1.4); ctx.stroke();
  }
  ctx.restore();
}

// ---------- projectiles ----------
export function drawProjectile(ctx, p, T, looks) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.k === 'bolt') {
    const look = looks[p.o] || looks[0];
    const d = p.vx < 0 ? -1 : 1;
    ctx.scale(d, 1);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(10, 0, 2, 0, 0, 52);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, `rgba(${look.glow},0.55)`);
    g.addColorStop(1, `rgba(${look.glow},0)`);
    ctx.fillStyle = g;
    oval(ctx, -8, 0, 56, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.quadraticCurveTo(10, -16, -30 - Math.sin(T * 30) * 6, -8);
    ctx.quadraticCurveTo(-14, 0, -30 + Math.sin(T * 30) * 6, 8);
    ctx.quadraticCurveTo(10, 16, 26, 0);
    ctx.fill();
  } else if (p.k === 'glob') {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 24);
    g.addColorStop(0, 'rgba(255,190,90,0.9)');
    g.addColorStop(1, 'rgba(255,110,30,0)');
    ctx.fillStyle = g;
    oval(ctx, 0, 0, 24, 24);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ff8a2a';
    const sq = 1 + Math.sin(T * 20 + p.id) * 0.12;
    oval(ctx, 0, 0, 9 * sq, 9 / sq);
    ctx.fillStyle = '#3a1a08';
    oval(ctx, 2, 1, 3.5, 3.5);
  } else if (p.k === 'shock') {
    const d = p.vx < 0 ? -1 : 1;
    ctx.scale(d, 1);
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.8 + Math.sin(T * 40 + p.id) * 0.2;
    ctx.fillStyle = `rgba(255,170,90,${0.5 * fl})`;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.quadraticCurveTo(4, -70 * fl, 22, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,240,210,${0.85 * fl})`;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.quadraticCurveTo(8, -46 * fl, 18, 0);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- HUD icons ----------
export function drawMaskIcon(ctx, x, y, s, full, look, crack) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-10, -2);
  ctx.bezierCurveTo(-11, -15, 11, -15, 10, -2);
  ctx.bezierCurveTo(9, 7, 4, 11, 0, 13);
  ctx.bezierCurveTo(-4, 11, -9, 7, -10, -2);
  if (full) {
    const g = ctx.createRadialGradient(3, -5, 1, 0, 0, 15);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#bfc6cf');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = INK;
    oval(ctx, -3.5, 1, 2.6, 4.4, 0.1);
    oval(ctx, 3.8, 1, 2.5, 4.4, -0.1);
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,210,220,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}
