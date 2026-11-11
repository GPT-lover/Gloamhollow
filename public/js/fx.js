// Particle effects (world space).
import { drawMob } from './art.js';
import { FLOOR_Y, WORLD_W, WORLD_H } from '/shared/map.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const MAX = 900;

export class FX {
  constructor() {
    this.ps = [];
    this.corpses = [];
    this.motes = [];
    for (let i = 0; i < 90; i++) this.motes.push(this.newMote(true));
  }

  newMote(anywhere) {
    return {
      x: rand(60, WORLD_W - 60), y: anywhere ? rand(80, FLOOR_Y) : FLOOR_Y + 10,
      vx: rand(-8, 8), vy: rand(-22, -6), r: rand(1, 2.6), ph: rand(0, TAU), a: rand(0.25, 0.7),
    };
  }

  add(p) {
    if (this.ps.length >= MAX) this.ps.shift();
    p.t = 0;
    p.vx = p.vx || 0;
    p.vy = p.vy || 0;
    this.ps.push(p);
    return p;
  }

  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.dir !== undefined ? o.dir + rand(-o.spread, o.spread) : rand(0, TAU);
      const sp = rand(o.smin ?? 100, o.smax ?? 400);
      this.add({
        k: o.k || 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(o.lmin ?? 0.3, o.lmax ?? 0.7), r: rand(o.rmin ?? 2, o.rmax ?? 4),
        g: o.g ?? 0, drag: o.drag ?? 2, col: o.col || '255,255,255', add: o.add ?? true,
      });
    }
  }

  // ---- presets ----
  hitSpark(x, y, dir) {
    this.burst(x, y, 9, { k: 'streak', dir, spread: 0.9, smin: 400, smax: 900, lmin: 0.08, lmax: 0.18, rmin: 2, rmax: 3, drag: 6 });
    this.add({ k: 'ring', x, y, life: 0.18, r: 10, r2: 46, col: '255,255,255', add: true });
    this.add({ k: 'flash', x, y, life: 0.08, r: 50, col: '255,255,255' });
  }
  blood(x, y, dir, n = 10) {
    this.burst(x, y, n, { k: 'drop', dir: dir ?? -Math.PI / 2, spread: dir === undefined ? Math.PI : 0.8, smin: 120, smax: 460, lmin: 0.5, lmax: 1.0, rmin: 2, rmax: 5, g: 1400, drag: 0.6, col: '255,138,42', add: false });
  }
  dust(x, y, n = 6, dir = 0) {
    for (let i = 0; i < n; i++) {
      this.add({ k: 'puff', x: x + rand(-12, 12), y: y - rand(0, 6), vx: rand(-80, 80) + dir * 90, vy: rand(-60, -10), life: rand(0.35, 0.7), r: rand(6, 12), drag: 3, col: '150,165,180', add: false });
    }
  }
  inkTrail(x, y, f) {
    this.add({ k: 'ink', x: x + rand(-6, 6), y: y - rand(10, 50), vx: -f * rand(20, 80), vy: rand(-20, 20), life: rand(0.25, 0.5), r: rand(8, 16), drag: 3 });
  }
  focusMotes(x, y, glow) {
    const a = rand(0, TAU), d = rand(40, 70);
    this.add({ k: 'dot', x: x + Math.cos(a) * d, y: y - 34 + Math.sin(a) * d, tx: x, ty: y - 34, homing: true, vx: 0, vy: 0, life: 0.45, r: rand(1.5, 3), col: glow, add: true });
  }
  heal(x, y, glow) {
    this.add({ k: 'ring', x, y: y - 34, life: 0.45, r: 10, r2: 90, col: glow, add: true });
    this.burst(x, y - 34, 16, { smin: 80, smax: 260, lmin: 0.4, lmax: 0.8, col: glow, drag: 2.5, rmin: 1.5, rmax: 3.5 });
  }
  shatter(x, y) {
    for (let i = 0; i < 10; i++) {
      this.add({ k: 'shard', x, y, vx: rand(-260, 260), vy: rand(-520, -180), life: rand(0.6, 1.0), r: rand(3, 7), g: 1500, drag: 0.4, rot: rand(0, TAU), vr: rand(-14, 14), col: '235,240,245' });
    }
    this.add({ k: 'ring', x, y, life: 0.35, r: 20, r2: 140, col: '20,20,25', add: false, w: 10 });
  }
  death(m) {
    const cy = m.y - m.h / 2;
    const big = m.type === 'boss';
    this.blood(m.x, cy, undefined, big ? 60 : 16);
    this.burst(m.x, cy, big ? 40 : 12, { k: 'puff', smin: 40, smax: big ? 400 : 180, lmin: 0.4, lmax: 0.9, rmin: 6, rmax: big ? 22 : 12, col: '30,22,18', add: false, drag: 2 });
    this.add({ k: 'ring', x: m.x, y: cy, life: big ? 0.6 : 0.3, r: 10, r2: big ? 260 : 80, col: '255,160,80', add: true });
    this.corpses.push({ m: { ...m, fl: 0, s: m.type === 'boss' ? 'stun' : m.s }, t: 0, vx: (m.face || 1) * -60 + rand(-40, 40), vy: -280, rot: 0, vr: (Math.random() < 0.5 ? -1 : 1) * rand(1.5, 3), life: big ? 2.2 : 1.3 });
  }
  splat(x, y, k) {
    if (k === 'bolt') this.burst(x, y, 14, { smin: 100, smax: 400, lmin: 0.2, lmax: 0.5, col: '200,230,255', drag: 3 });
    else if (k === 'shock') this.dust(x, y + 20, 8);
    else this.burst(x, y, 10, { k: 'drop', smin: 80, smax: 300, lmin: 0.3, lmax: 0.6, g: 1200, col: '255,138,42', add: false, rmin: 2, rmax: 4 });
  }
  boltTrail(p) {
    this.add({ k: 'dot', x: p.x - Math.sign(p.vx) * 30 + rand(-6, 6), y: p.y + rand(-12, 12), vx: -p.vx * 0.05 + rand(-30, 30), vy: rand(-40, 40), life: rand(0.2, 0.45), r: rand(2, 5), col: '210,235,255', add: true, drag: 2 });
  }
  embers(x, y) {
    this.add({ k: 'dot', x: x + rand(-30, 30), y: y + rand(-20, 10), vx: rand(-20, 20), vy: rand(-120, -50), life: rand(0.5, 1), r: rand(1.5, 3), col: '255,140,50', add: true, drag: 0.5 });
  }

  update(dt) {
    for (const p of this.ps) {
      p.t += dt;
      if (p.homing) {
        const k = Math.min(1, p.t / p.life);
        p.x += (p.tx - p.x) * Math.min(1, dt * 8 * (0.4 + k));
        p.y += (p.ty - p.y) * Math.min(1, dt * 8 * (0.4 + k));
        continue;
      }
      const d = Math.exp(-(p.drag || 0) * dt);
      p.vx *= d; p.vy *= d;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.k === 'drop' && p.y > FLOOR_Y - 1 && p.vy > 0) {
        p.y = FLOOR_Y - 1; p.vy = 0; p.vx = 0; p.g = 0; p.k = 'stain'; p.life = p.t + 1.6;
      }
    }
    this.ps = this.ps.filter(p => p.t < p.life);
    for (const c of this.corpses) {
      c.t += dt;
      c.vy += 1500 * dt;
      c.m.x += c.vx * dt;
      c.m.y += c.vy * dt;
      if (c.m.y >= FLOOR_Y) { c.m.y = FLOOR_Y; c.vy *= -0.25; c.vx *= 0.5; c.vr *= 0.4; }
      c.rot += c.vr * dt;
      c.vr *= Math.exp(-2 * dt);
    }
    this.corpses = this.corpses.filter(c => c.t < c.life);
    for (const m of this.motes) {
      m.x += (m.vx + Math.sin(m.ph) * 10) * dt;
      m.y += m.vy * dt;
      m.ph += dt * 0.8;
      if (m.y < 80) Object.assign(m, this.newMote(false));
    }
  }

  drawBack(ctx, T) {
    for (const c of this.corpses) {
      const a = Math.max(0, 1 - Math.max(0, c.t - c.life * 0.5) / (c.life * 0.5));
      drawMob(ctx, c.m, T, { dead: true, alpha: a, rot: c.rot });
    }
    for (const p of this.ps) if (p.k === 'stain' || p.k === 'ink' || p.k === 'puff') this.drawP(ctx, p);
  }

  drawFront(ctx) {
    for (const p of this.ps) if (!(p.k === 'stain' || p.k === 'ink' || p.k === 'puff')) this.drawP(ctx, p);
  }

  drawMotes(ctx, T) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const a = m.a * (0.6 + 0.4 * Math.sin(T * 2 + m.ph * 3));
      ctx.fillStyle = `rgba(180,225,255,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawP(ctx, p) {
    const k = p.t / p.life, a = 1 - k;
    ctx.save();
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    switch (p.k) {
      case 'dot':
        ctx.fillStyle = `rgba(${p.col},${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill();
        break;
      case 'streak': {
        ctx.strokeStyle = `rgba(${p.col},${a})`;
        ctx.lineWidth = p.r;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
        break;
      }
      case 'drop':
        ctx.fillStyle = `rgba(${p.col},${Math.min(1, a * 1.5)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        break;
      case 'stain':
        ctx.fillStyle = `rgba(${p.col},${0.7 * Math.min(1, (p.life - p.t) / 0.8)})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r * 1.8, p.r * 0.5, 0, 0, TAU); ctx.fill();
        break;
      case 'puff':
        ctx.fillStyle = `rgba(${p.col},${0.35 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k), 0, TAU); ctx.fill();
        break;
      case 'ink':
        ctx.fillStyle = `rgba(4,5,8,${0.55 * a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 0.6), 0, TAU); ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = `rgba(${p.col},${a})`;
        ctx.lineWidth = (p.w || 3) * a + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + (p.r2 - p.r) * (1 - (1 - k) * (1 - k)), 0, TAU); ctx.stroke();
        break;
      case 'flash': {
        const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${p.col},${0.8 * a})`);
        g.addColorStop(1, `rgba(${p.col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        break;
      }
      case 'shard':
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${p.col},${a})`;
        ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.5); ctx.lineTo(p.r, -p.r * 0.2); ctx.lineTo(0, p.r); ctx.closePath(); ctx.fill();
        break;
    }
    ctx.restore();
  }
}
