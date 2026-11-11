// Procedurally painted arena: parallax cavern layers, terrain, lights, fog.
import { WORLD_W, WORLD_H, FLOOR_Y, SOLIDS, PLATFORMS, LANTERNS } from '/shared/map.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLayer(factor, scale, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD_W * scale);
  c.height = Math.ceil(WORLD_H * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  draw(g);
  return { canvas: c, factor };
}

// Irregular rock silhouette between two x positions rising from baseY to ~topY.
function rockColumn(g, R, x0, x1, top, bottom, jag) {
  g.beginPath();
  g.moveTo(x0, bottom);
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const y = bottom - (bottom - top) * (i / steps);
    g.lineTo(x0 + (R() - 0.5) * jag + Math.sin(i * 1.3) * jag * 0.4, y);
  }
  for (let i = steps; i >= 0; i--) {
    const y = bottom - (bottom - top) * (i / steps);
    g.lineTo(x1 + (R() - 0.5) * jag + Math.cos(i * 1.1) * jag * 0.4, y);
  }
  g.closePath();
  g.fill();
}

function spire(g, R, x, base, h, w, col, lightCol) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - w / 2, base);
  g.lineTo(x - w * 0.42, base - h * 0.75);
  g.quadraticCurveTo(x - w * 0.55, base - h * 0.86, x, base - h);
  g.quadraticCurveTo(x + w * 0.55, base - h * 0.86, x + w * 0.42, base - h * 0.75);
  g.lineTo(x + w / 2, base);
  g.closePath();
  g.fill();
  // bulb dome near top
  g.beginPath();
  g.ellipse(x, base - h * 0.78, w * 0.62, w * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - 1, base - h - 30, 2, 30);
  // windows
  g.fillStyle = lightCol;
  const n = Math.floor(h / 70);
  for (let i = 0; i < n; i++) {
    if (R() < 0.45) {
      const wy = base - 40 - i * 60 - R() * 20;
      g.globalAlpha = 0.35 + R() * 0.5;
      g.beginPath();
      g.ellipse(x + (R() - 0.5) * w * 0.4, wy, 2.4, 3.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}

function drawSky(g) {
  const R = rng(7);
  const grd = g.createLinearGradient(0, 0, 0, WORLD_H);
  grd.addColorStop(0, '#04070c');
  grd.addColorStop(0.45, '#0c1724');
  grd.addColorStop(1, '#0a131d');
  g.fillStyle = grd;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // distant haze of light from far above
  const haze = g.createRadialGradient(WORLD_W * 0.5, 120, 40, WORLD_W * 0.5, 300, 1100);
  haze.addColorStop(0, 'rgba(70,120,160,0.35)');
  haze.addColorStop(1, 'rgba(70,120,160,0)');
  g.fillStyle = haze;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // far cavern walls
  g.fillStyle = '#0a121b';
  rockColumn(g, R, -100, 280, -50, WORLD_H, 90);
  rockColumn(g, R, WORLD_W - 280, WORLD_W + 100, -50, WORLD_H, 90);
  // the sunken city: spires
  for (let i = 0; i < 26; i++) {
    const x = 200 + R() * (WORLD_W - 400);
    const h = 260 + R() * 520;
    spire(g, R, x, WORLD_H, h, 26 + R() * 34, i % 3 ? '#122030' : '#0f1b29', '#9fdcff');
  }
  // bridges between spires
  g.strokeStyle = '#101c2a';
  g.lineWidth = 6;
  for (let i = 0; i < 6; i++) {
    const y = 520 + R() * 300, x = 300 + R() * 1600;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 150, y + 30, x + 300 + R() * 200, y); g.stroke();
  }
  // low mist
  const mist = g.createLinearGradient(0, 700, 0, WORLD_H);
  mist.addColorStop(0, 'rgba(60,90,120,0)');
  mist.addColorStop(1, 'rgba(60,90,120,0.22)');
  g.fillStyle = mist;
  g.fillRect(0, 700, WORLD_W, WORLD_H - 700);
}

function drawMid(g) {
  const R = rng(21);
  // Great fossil shell, half-buried, center
  const cx = WORLD_W / 2, cy = 820;
  g.fillStyle = '#0f1a26';
  g.beginPath(); g.ellipse(cx, cy, 520, 330, 0, Math.PI, 0); g.fill();
  g.strokeStyle = '#1b2b3c';
  g.lineWidth = 7;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 160, cy + Math.sin(a) * 100);
    g.quadraticCurveTo(cx + Math.cos(a) * 380, cy + Math.sin(a) * 260, cx + Math.cos(a) * 510, cy + Math.sin(a) * 322);
    g.stroke();
  }
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(cx, cy, 520, 330, 0, Math.PI, 0); g.stroke();
  // inner hollow
  g.fillStyle = '#0a121c';
  g.beginPath(); g.ellipse(cx, cy + 10, 150, 95, 0, Math.PI, 0); g.fill();

  // Rock pillars
  g.fillStyle = '#0d1621';
  for (const [x0, x1] of [[120, 300], [560, 660], [1700, 1820], [2080, 2280]]) {
    rockColumn(g, R, x0, x1, 0, WORLD_H, 40);
  }
  // rim light on pillars
  g.strokeStyle = 'rgba(80,120,150,0.18)';
  g.lineWidth = 2;
  for (const x of [125, 565, 1705, 2085]) {
    g.beginPath(); g.moveTo(x, 80);
    for (let y = 80; y < WORLD_H; y += 40) g.lineTo(x + Math.sin(y * 0.05) * 6, y);
    g.stroke();
  }
  // Arches
  g.strokeStyle = '#0d1621';
  g.lineWidth = 34;
  g.beginPath(); g.arc(610, 700, 330, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.beginPath(); g.arc(1760, 700, 330, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // hanging roots
  g.strokeStyle = '#0b131c';
  for (let i = 0; i < 40; i++) {
    const x = R() * WORLD_W, len = 120 + R() * 360;
    g.lineWidth = 2 + R() * 4;
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + (R() - 0.5) * 60, len * 0.4, x + (R() - 0.5) * 80, len * 0.7, x + (R() - 0.5) * 40, len);
    g.stroke();
  }
  const mist = g.createLinearGradient(0, 600, 0, WORLD_H);
  mist.addColorStop(0, 'rgba(80,110,140,0)');
  mist.addColorStop(1, 'rgba(80,110,140,0.12)');
  g.fillStyle = mist;
  g.fillRect(0, 600, WORLD_W, WORLD_H - 600);
}

function drawNear(g) {
  const R = rng(99);
  g.fillStyle = '#080d14';
  // stalagmites rising behind the floor
  for (let i = 0; i < 18; i++) {
    const x = R() * WORLD_W, h = 120 + R() * 280, w = 40 + R() * 90;
    g.beginPath();
    g.moveTo(x - w / 2, WORLD_H);
    g.quadraticCurveTo(x - w * 0.2, FLOOR_Y - h * 0.4, x + (R() - 0.5) * 20, FLOOR_Y - h);
    g.quadraticCurveTo(x + w * 0.2, FLOOR_Y - h * 0.4, x + w / 2, WORLD_H);
    g.fill();
  }
  // big stalactites
  for (let i = 0; i < 16; i++) {
    const x = R() * WORLD_W, h = 100 + R() * 260, w = 50 + R() * 100;
    g.beginPath();
    g.moveTo(x - w / 2, 0);
    g.quadraticCurveTo(x - w * 0.15, h * 0.6, x, 60 + h);
    g.quadraticCurveTo(x + w * 0.15, h * 0.6, x + w / 2, 0);
    g.fill();
  }
  // skeletal husks / shells lying about
  g.strokeStyle = '#0c131c';
  g.lineWidth = 5;
  for (let i = 0; i < 5; i++) {
    const x = 200 + R() * 2000, y = FLOOR_Y - 10;
    g.beginPath(); g.ellipse(x, y, 60 + R() * 40, 35, 0, Math.PI, 0); g.stroke();
  }
}

function craggyTop(g, R, x0, x1, y, amp) {
  g.moveTo(x0, y);
  for (let x = x0; x <= x1; x += 18) g.lineTo(x, y + (R() - 0.5) * amp);
  g.lineTo(x1, y);
}

function drawTerrain(g) {
  const R = rng(1234);
  // Solids
  for (const s of SOLIDS) {
    const grd = g.createLinearGradient(0, s.y, 0, s.y + Math.min(s.h, 260));
    grd.addColorStop(0, '#11171f');
    grd.addColorStop(1, '#05070a');
    g.fillStyle = grd;
    g.fillRect(s.x, s.y, s.w, s.h);
  }
  // Floor & shelf tops: craggy rim with a cold highlight + moss
  const tops = [
    [60, WORLD_W - 60, FLOOR_Y], [60, 300, 870], [WORLD_W - 300, WORLD_W - 60, 870],
  ];
  for (const [x0, x1, y] of tops) {
    g.fillStyle = '#0c1118';
    g.beginPath(); craggyTop(g, R, x0, x1, y - 3, 6); g.lineTo(x1, y + 26); g.lineTo(x0, y + 26); g.closePath(); g.fill();
    g.strokeStyle = '#3c5266';
    g.lineWidth = 2.5;
    g.beginPath(); craggyTop(g, R, x0, x1, y - 2, 3); g.stroke();
    // moss & grass
    for (let x = x0 + 6; x < x1 - 6; x += 7 + R() * 12) {
      const h = 6 + R() * 16;
      g.strokeStyle = R() < 0.5 ? '#26402f' : '#34563f';
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (R() - 0.5) * 6, y - h * 0.6, x + (R() - 0.5) * 10, y - h); g.stroke();
    }
    // pebbles & bone shards
    for (let i = 0; i < (x1 - x0) / 90; i++) {
      const x = x0 + R() * (x1 - x0);
      g.fillStyle = R() < 0.3 ? '#8d96a0' : '#1b232d';
      g.beginPath(); g.ellipse(x, y + 4, 3 + R() * 5, 2 + R() * 2, R(), 0, Math.PI * 2); g.fill();
    }
  }
  // shelf faces: vertical cracks
  g.strokeStyle = '#1a222c';
  g.lineWidth = 2;
  for (const s of [SOLIDS[4], SOLIDS[5]]) {
    const edgeX = s === SOLIDS[4] ? s.x + s.w : s.x;
    g.beginPath(); g.moveTo(edgeX, s.y); g.lineTo(edgeX, s.y + s.h); g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = s.x + 20 + R() * (s.w - 40), y = s.y + 20 + R() * 80;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 20, y + 20 + R() * 20); g.stroke();
    }
  }
  // Walls: craggy inner edge
  for (const [x, dir] of [[60, 1], [WORLD_W - 60, -1]]) {
    g.fillStyle = '#0a0e14';
    g.beginPath(); g.moveTo(x - dir * 60, 0);
    for (let y = 0; y <= WORLD_H; y += 30) g.lineTo(x + dir * (R() * 14), y);
    g.lineTo(x - dir * 60, WORLD_H); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(70,95,120,0.5)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let y = 70; y <= FLOOR_Y; y += 30) g.lineTo(x + dir * (2 + R() * 10), y);
    g.stroke();
  }
  // Ceiling stalactites
  g.fillStyle = '#080b10';
  for (let x = 60; x < WORLD_W - 60; x += 30 + R() * 50) {
    const h = 20 + R() * (R() < 0.15 ? 110 : 45), w = 16 + R() * 30;
    g.beginPath(); g.moveTo(x - w / 2, 68); g.quadraticCurveTo(x - w * 0.1, 68 + h * 0.6, x, 68 + h);
    g.quadraticCurveTo(x + w * 0.1, 68 + h * 0.6, x + w / 2, 68); g.fill();
  }
  g.fillRect(60, 60, WORLD_W - 120, 12);

  // Platforms: carved stone slabs with hanging chains
  for (const p of PLATFORMS) {
    const x = p.x, y = p.y, w = p.w, th = 20;
    // chains to ceiling for higher ledges
    if (y < 700) {
      g.strokeStyle = '#151c25';
      g.lineWidth = 3;
      for (const cxp of [x + 22, x + w - 22]) {
        g.setLineDash([7, 4]);
        g.beginPath(); g.moveTo(cxp, 70); g.lineTo(cxp, y); g.stroke();
      }
      g.setLineDash([]);
    }
    // slab body
    const grd = g.createLinearGradient(0, y, 0, y + th + 14);
    grd.addColorStop(0, '#202a36');
    grd.addColorStop(1, '#080b10');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, y + 2);
    g.lineTo(x + w, y + 2);
    g.lineTo(x + w - 8, y + th);
    g.quadraticCurveTo(x + w / 2, y + th + 18, x + 8, y + th);
    g.closePath();
    g.fill();
    // carved rim
    g.strokeStyle = '#52687d';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 2, y + 1); g.lineTo(x + w - 2, y + 1); g.stroke();
    g.strokeStyle = '#2b3846';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 10, y + 9); g.lineTo(x + w - 10, y + 9); g.stroke();
    // ornament: diamond studs
    g.fillStyle = '#3a4a5b';
    for (let sx = x + 24; sx < x + w - 20; sx += 34) {
      g.beginPath(); g.moveTo(sx, y + 9); g.lineTo(sx + 4, y + 13); g.lineTo(sx, y + 17); g.lineTo(sx - 4, y + 13); g.closePath(); g.fill();
    }
    // dangling roots under
    g.strokeStyle = '#121a22';
    g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const rx = x + 15 + R() * (w - 30), len = 10 + R() * 34;
      g.beginPath(); g.moveTo(rx, y + th); g.quadraticCurveTo(rx + 4, y + th + len / 2, rx - 2, y + th + len); g.stroke();
    }
    // moss tufts on top
    for (let mx = x + 6; mx < x + w - 6; mx += 10 + R() * 18) {
      g.strokeStyle = '#2c4a37';
      g.lineWidth = 1.4;
      const h = 4 + R() * 8;
      g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + (R() - 0.5) * 6, y - h); g.stroke();
    }
  }

  // Lantern posts
  for (const L of LANTERNS) {
    const x = L.x, base = L.y, top = base - 96;
    g.strokeStyle = '#1b232c';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, top + 14); g.quadraticCurveTo(x, top, x + 14, top); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 14, top); g.lineTo(x + 14, top + 8); g.stroke();
    // cage
    g.strokeStyle = '#2a3440';
    g.beginPath(); g.ellipse(x + 14, top + 20, 9, 12, 0, 0, Math.PI * 2); g.stroke();
    // feet
    g.fillStyle = '#1b232c';
    g.beginPath(); g.moveTo(x - 10, base); g.lineTo(x, base - 12); g.lineTo(x + 10, base); g.fill();
  }
}

// Foreground grass/fern silhouettes (parallax > 1), drawn live.
function makeForeground() {
  const R = rng(555);
  const clumps = [];
  for (let i = 0; i < 26; i++) {
    const blades = [];
    const n = 4 + Math.floor(R() * 6);
    for (let j = 0; j < n; j++) blades.push({ a: (R() - 0.5) * 1.4, h: 22 + R() * 55, w: 4 + R() * 7, ph: R() * 6 });
    clumps.push({ x: -300 + R() * (WORLD_W + 600), y: FLOOR_Y + 70 + R() * 50, blades });
  }
  const vines = [];
  for (let i = 0; i < 14; i++) vines.push({ x: -200 + R() * (WORLD_W + 400), len: 80 + R() * 200, ph: R() * 6, w: 3 + R() * 4 });
  return { clumps, vines };
}

export class Scene {
  constructor() {
    this.layers = [
      makeLayer(0.12, 0.4, drawSky),
      makeLayer(0.4, 0.5, drawMid),
      makeLayer(0.72, 0.5, drawNear),
    ];
    this.terrain = makeLayer(1, 1, drawTerrain);
    this.fg = makeForeground();
    this.vignette = null;
    this.shafts = [
      { x: 520, w: 120, sk: 260 }, { x: 1150, w: 170, sk: 200 }, { x: 1800, w: 110, sk: -240 }, { x: 2150, w: 90, sk: -180 },
    ];
  }

  drawBack(ctx, cam) {
    for (const L of this.layers) {
      const ox = (cam.x - WORLD_W / 2) * (1 - L.factor);
      const oy = (cam.y - WORLD_H / 2) * (1 - L.factor);
      ctx.drawImage(L.canvas, ox, oy, WORLD_W, WORLD_H);
    }
  }

  drawLightShafts(ctx, T) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.shafts.length; i++) {
      const s = this.shafts[i];
      const a = 0.05 + 0.025 * Math.sin(T * 0.6 + i * 1.7);
      const grd = ctx.createLinearGradient(0, 70, 0, FLOOR_Y);
      grd.addColorStop(0, `rgba(170,215,255,${a * 1.6})`);
      grd.addColorStop(1, 'rgba(170,215,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(s.x, 70); ctx.lineTo(s.x + s.w, 70);
      ctx.lineTo(s.x + s.w * 2.2 + s.sk, FLOOR_Y); ctx.lineTo(s.x + s.sk, FLOOR_Y);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  drawTerrain(ctx) { ctx.drawImage(this.terrain.canvas, 0, 0, WORLD_W, WORLD_H); }

  drawLanterns(ctx, T) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LANTERNS.length; i++) {
      const L = LANTERNS[i];
      const x = L.x + 14, y = L.y - 76;
      const p = 0.85 + 0.15 * Math.sin(T * 2.3 + i * 2) + 0.05 * Math.sin(T * 13 + i);
      const r = 190 * p;
      const grd = ctx.createRadialGradient(x, y, 2, x, y, r);
      grd.addColorStop(0, 'rgba(190,240,255,0.55)');
      grd.addColorStop(0.15, 'rgba(140,210,255,0.22)');
      grd.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      // fluttering bug inside
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.arc(x + Math.sin(T * 5 + i) * 3, y + Math.cos(T * 7 + i) * 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFog(ctx, T, cam) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = FLOOR_Y - 90 - i * 30;
      const off = ((T * (12 + i * 7)) % 800) - 400;
      const grd = ctx.createLinearGradient(0, y - 80, 0, y + 100);
      grd.addColorStop(0, 'rgba(120,150,180,0)');
      grd.addColorStop(0.5, `rgba(120,150,180,${0.045 + i * 0.01})`);
      grd.addColorStop(1, 'rgba(120,150,180,0)');
      ctx.fillStyle = grd;
      for (let k = -1; k < 4; k++) {
        const x = k * 800 + off + i * 230;
        ctx.beginPath();
        ctx.ellipse(x, y, 520, 70, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawForeground(ctx, cam, T) {
    const f = 1.22;
    const ox = (cam.x - WORLD_W / 2) * (1 - f);
    const oy = (cam.y - WORLD_H / 2) * (1 - f) * 0.5;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = '#020305';
    for (const c of this.fg.clumps) {
      for (const b of c.blades) {
        const sway = Math.sin(T * 1.2 + b.ph + c.x * 0.01) * 0.08;
        const a = b.a + sway;
        const tx = c.x + Math.sin(a) * b.h, ty = c.y - Math.cos(a) * b.h;
        ctx.beginPath();
        ctx.moveTo(c.x - b.w / 2, c.y + 20);
        ctx.quadraticCurveTo(c.x + Math.sin(a) * b.h * 0.4 - b.w, c.y - b.h * 0.5, tx, ty);
        ctx.quadraticCurveTo(c.x + Math.sin(a) * b.h * 0.4 + b.w, c.y - b.h * 0.5, c.x + b.w / 2, c.y + 20);
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#020305';
    for (const v of this.fg.vines) {
      ctx.lineWidth = v.w;
      const sw = Math.sin(T * 0.8 + v.ph) * 12;
      ctx.beginPath();
      ctx.moveTo(v.x, -40);
      ctx.quadraticCurveTo(v.x + sw, v.len * 0.5, v.x + sw * 1.5, v.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVignette(ctx, W, H) {
    if (!this.vignette || this.vignette.width !== W) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H / 2, H * 0.95);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.72)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      this.vignette = c;
    }
    ctx.drawImage(this.vignette, 0, 0);
  }
}
