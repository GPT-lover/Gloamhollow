// Authoritative mob/wave simulation. Runs on the server for online play and
// in the browser for local (same keyboard) play. Players are simulated by their
// own client and only *reported* here (for mob targeting, revives, game over).

import { MOBS, MOB_TYPES, PROJ, SPELL, PLAYER } from './constants.js';
import { moveBody, groundAt, overlap, boxInSolid } from './physics.js';
import { AIR_SPAWNS, GROUND_SPAWNS, WORLD_W, FLOOR_Y, PLAYER_SPAWNS } from './map.js';

export const STATES = ['spawn', 'idle', 'walk', 'tell', 'dive', 'rec', 'crouch', 'air',
  'charge', 'stun', 'swTell', 'swipe', 'lpTell', 'leap', 'chTell', 'summon'];
const SI = Object.fromEntries(STATES.map((s, i) => [s, i]));
export const PROJ_TYPES = ['bolt', 'glob', 'shock'];

const rand = (a, b) => a + Math.random() * (b - a);
const sign = v => (v < 0 ? -1 : 1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const GRAV = 2400;
const GLOB_G = 1100;

export class World {
  constructor() {
    this.players = new Map();
    this.time = 0;
    this.reset();
  }

  reset() {
    this.mobs = [];
    this.proj = [];
    this.nextId = 1;
    this.wave = 0;
    this.phase = 'lobby';
    this.phaseT = 0;
    this.queue = [];
    this.spawnT = 0;
    this.maxAlive = 6;
    this.waveTotal = 0;
    this.events = [];
    this.kills = {};
    for (const pid of this.players.keys()) this.kills[pid] = 0;
    this.revive = {};
    this.reviveLock = {};
  }

  ev(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }

  addPlayer(pid, name = '') {
    const sp = PLAYER_SPAWNS[pid % PLAYER_SPAWNS.length];
    this.players.set(pid, { x: sp.x, y: sp.y, vx: 0, vy: 0, f: 1, hp: PLAYER.maxHp, dn: false, nm: name });
    this.kills[pid] = this.kills[pid] || 0;
  }

  removePlayer(pid) {
    this.players.delete(pid);
    delete this.revive[pid];
  }

  setPlayer(pid, s) {
    const p = this.players.get(pid);
    if (p && s && typeof s === 'object') Object.assign(p, s);
  }

  start() {
    if (this.phase !== 'lobby' && this.phase !== 'over') return;
    this.reset();
    this.phase = 'inter';
    this.phaseT = 3.5;
    // Clients learn about the restart a moment later; until they report back,
    // treat everyone as standing so we don't instantly declare game over again.
    for (const [pid, p] of this.players) { p.dn = false; p.hp = PLAYER.maxHp; this.reviveLock[pid] = 2; }
    this.ev({ e: 'start' });
  }

  livingPlayers() {
    const out = [];
    for (const [pid, p] of this.players) if (!p.dn) out.push({ pid, p });
    return out;
  }

  nearestPlayer(m) {
    let best = null, bd = Infinity;
    for (const { p } of this.livingPlayers()) {
      const d = Math.hypot(p.x - m.x, (p.y - 30) - (m.y - m.h / 2));
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---------- waves ----------
  buildWave(n) {
    const list = [];
    const boss = n % 5 === 0;
    if (boss) {
      list.push('boss');
      const adds = 2 + Math.floor(n / 5);
      for (let i = 0; i < adds; i++) list.push(i % 2 ? 'gnat' : 'crawler');
      this.maxAlive = 3 + Math.floor(n / 5);
    } else {
      const count = Math.min(36, 4 + Math.floor(n * 2.2));
      const pool = [['crawler', 4], ['gnat', 3]];
      if (n >= 2) pool.push(['hopper', 3]);
      if (n >= 3) pool.push(['spitter', 2]);
      if (n >= 4) pool.push(['shell', 1.4 + n * 0.08]);
      const total = pool.reduce((a, b) => a + b[1], 0);
      for (let i = 0; i < count; i++) {
        let r = Math.random() * total;
        for (const [t, w] of pool) { r -= w; if (r <= 0) { list.push(t); break; } }
        if (list.length <= i) list.push('crawler');
      }
      this.maxAlive = Math.min(14, 4 + Math.ceil(n * 0.9));
    }
    this.queue = list;
    this.waveTotal = list.length;
    this.spawnT = 0.4;
    return boss;
  }

  hpScale() {
    const n = Math.max(1, this.players.size);
    return (1 + 0.08 * (this.wave - 1)) * (1 + 0.3 * (n - 1));
  }

  spawnMob(type, at) {
    const def = MOBS[type];
    let pos = at;
    if (!pos) {
      const living = this.livingPlayers().map(o => o.p);
      const far = s => living.every(p => Math.hypot(p.x - s.x, p.y - s.y) > 300);
      if (type === 'boss') {
        const avg = living.length ? living.reduce((a, p) => a + p.x, 0) / living.length : WORLD_W / 2;
        pos = { x: avg < WORLD_W / 2 ? 1800 : 600, y: FLOOR_Y };
      } else {
        const pool = def.fly ? AIR_SPAWNS : GROUND_SPAWNS;
        const ok = pool.filter(far);
        const s = (ok.length ? ok : pool)[Math.floor(Math.random() * (ok.length || pool.length))];
        pos = { x: s.x + rand(-40, 40), y: s.y };
      }
    }
    const scale = type === 'boss' ? this.hpScale() * 1.1 : this.hpScale();
    const hp = Math.ceil(def.hp * scale);
    const m = {
      id: this.nextId++, type, x: pos.x, y: pos.y, w: def.w, h: def.h,
      vx: 0, vy: 0, hp, mh: hp, face: Math.random() < 0.5 ? -1 : 1,
      s: 'spawn', t: 0, fl: 0, kbT: 0, kbx: 0, onGround: false, hitWall: 0,
      next: rand(1, 2.5), side: Math.random() < 0.5 ? -1 : 1, turnT: 0, hz: null, ph: 1, did: false,
    };
    this.mobs.push(m);
    return m;
  }

  setState(m, s) { m.s = s; m.t = 0; m.did = false; }

  // ---------- player-driven actions ----------
  hitMob(pid, id, dmg, kx) {
    const m = this.mobs.find(o => o.id === id);
    if (!m) return;
    dmg = clamp(Number(dmg) || 1, 1, 5);
    this.damageMob(m, dmg, pid, clamp(Number(kx) || 0, -1, 1));
    this.mobs = this.mobs.filter(o => !o.dead);
  }

  damageMob(m, dmg, pid, kx) {
    if (m.s === 'spawn' || m.dead) return;
    m.hp -= dmg;
    m.fl = 0.14;
    const kb = MOBS[m.type].kb;
    if (kb > 0 && kx) {
      m.kbx = kx * 430 * kb;
      m.kbT = 0.14;
      if (MOBS[m.type].fly) m.vy = -80;
    }
    this.ev({ e: 'mh', id: m.id, by: pid, x: Math.round(m.x), y: Math.round(m.y - m.h / 2), kx });
    if (m.hp <= 0) {
      m.dead = true;
      if (pid in this.kills) this.kills[pid]++;
      this.ev({ e: 'md', id: m.id, ty: m.type, x: Math.round(m.x), y: Math.round(m.y), f: m.face, by: pid });
    }
  }

  castSpell(pid, x, y, dir) {
    const d = dir < 0 ? -1 : 1;
    this.proj.push({ id: this.nextId++, k: 'bolt', x: +x || 0, y: +y || 0, vx: d * SPELL.speed, vy: 0, w: PROJ.bolt.w, h: PROJ.bolt.h, o: pid, life: 1.6, hit: new Set() });
    this.ev({ e: 'cast', by: pid, x: Math.round(x), y: Math.round(y), f: d });
  }

  popProj(id) {
    const p = this.proj.find(o => o.id === id);
    if (p && p.o === 'm') {
      p.dead = true;
      this.ev({ e: 'splat', x: Math.round(p.x), y: Math.round(p.y), k: p.k });
    }
  }

  // ---------- simulation ----------
  step(dt) {
    this.time += dt;
    for (const pid in this.reviveLock) this.reviveLock[pid] -= dt;

    if (this.phase === 'inter') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.wave++;
        const boss = this.buildWave(this.wave);
        this.phase = 'wave';
        this.ev({ e: 'wave', n: this.wave, boss });
      }
    } else if (this.phase === 'wave') {
      this.spawnT -= dt;
      if (this.queue.length && this.spawnT <= 0 && this.mobs.length < this.maxAlive) {
        this.spawnMob(this.queue.shift());
        this.spawnT = rand(0.35, 1.0) * Math.max(0.5, 1 - this.wave * 0.03);
      }
      if (!this.queue.length && !this.mobs.length) {
        this.ev({ e: 'clear', n: this.wave });
        this.phase = 'inter';
        this.phaseT = 6;
        for (const [pid, p] of this.players) {
          if (p.dn) { this.ev({ e: 'revive', pid }); this.reviveLock[pid] = 1.5; p.dn = false; }
        }
      }
    }

    if ((this.phase === 'wave' || this.phase === 'inter') && this.players.size > 0) {
      let allDown = true;
      for (const [pid, p] of this.players) if (!p.dn || this.reviveLock[pid] > 0) allDown = false;
      if (allDown) {
        this.phase = 'over';
        this.ev({ e: 'over', n: this.wave, k: { ...this.kills } });
      }
    }

    this.updateRevives(dt);
    for (const m of this.mobs) this.updateMob(m, dt);
    this.updateProjectiles(dt);
    this.mobs = this.mobs.filter(m => !m.dead);
    this.proj = this.proj.filter(p => !p.dead);
  }

  updateRevives(dt) {
    for (const [pid, p] of this.players) {
      if (!p.dn || this.phase === 'over' || this.reviveLock[pid] > 0) { this.revive[pid] = 0; continue; }
      let helped = false;
      for (const [qid, q] of this.players) {
        if (qid !== pid && !q.dn && Math.abs(q.x - p.x) < PLAYER.reviveRange && Math.abs(q.y - p.y) < 120) helped = true;
      }
      const v = (this.revive[pid] || 0) + (helped ? dt : -dt * 0.5);
      this.revive[pid] = Math.max(0, v);
      if (this.revive[pid] >= PLAYER.reviveTime) {
        this.revive[pid] = 0;
        this.reviveLock[pid] = 1.5;
        p.dn = false;
        this.ev({ e: 'revive', pid });
      }
    }
  }

  updateMob(m, dt) {
    m.t += dt;
    m.fl = Math.max(0, m.fl - dt);
    m.turnT -= dt;
    const def = MOBS[m.type];
    if (m.s === 'spawn') {
      if (m.t >= (m.type === 'boss' ? 1.6 : 0.95)) {
        this.setState(m, m.type === 'shell' ? 'walk' : 'idle');
        if (m.type === 'boss') this.ev({ e: 'roar', x: Math.round(m.x), y: Math.round(m.y) });
      }
      return;
    }
    const tg = this.nearestPlayer(m);
    const ai = this['ai_' + m.type];
    if (ai) ai.call(this, m, dt, tg);

    if (m.kbT > 0) { m.kbT -= dt; m.vx = m.kbx; }

    if (def.fly) {
      moveBody(m, dt, { platforms: false });
    } else {
      m.vy = Math.min(m.vy + GRAV * dt, 1200);
      moveBody(m, dt, { platforms: m.type !== 'boss' });
    }
    // Safety: never leave the arena.
    m.x = clamp(m.x, 60 + m.w / 2, WORLD_W - 60 - m.w / 2);
    if (m.y > FLOOR_Y) m.y = FLOOR_Y;
  }

  // Ground walkers: turn at walls & ledge edges.
  walkerTurn(m, tg, chaseRange) {
    if (tg && m.turnT <= 0 && Math.abs(tg.x - m.x) > 24 && Math.abs(tg.x - m.x) < chaseRange && Math.abs(tg.y - m.y) < 260) {
      m.face = sign(tg.x - m.x);
    }
    if (m.onGround) {
      const edge = !groundAt(m.x + m.face * (m.w / 2 + 6), m.y + 2);
      if (m.hitWall === m.face || edge) { m.face *= -1; m.turnT = 1.2; }
    }
  }

  ai_crawler(m, dt, tg) {
    const spd = Math.min(175, 85 + this.wave * 4);
    this.walkerTurn(m, tg, 700);
    m.vx = m.face * spd;
  }

  ai_gnat(m, dt, tg) {
    const T = this.time;
    if (m.s === 'idle') {
      let dx, dy;
      if (tg) {
        dx = tg.x + m.side * 150 + Math.sin(T * 1.3 + m.id) * 60 - m.x;
        dy = tg.y - 160 + Math.sin(T * 2.1 + m.id) * 35 - m.y;
      } else {
        dx = Math.sin(T * 0.5 + m.id) * 200; dy = 350 - m.y;
      }
      m.vx += (dx * 4 - m.vx * 2.6) * dt;
      m.vy += (dy * 4 - m.vy * 2.6) * dt;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > 270) { m.vx *= 270 / sp; m.vy *= 270 / sp; }
      m.face = tg ? sign(tg.x - m.x) : sign(m.vx);
      if (tg && m.t > m.next && Math.hypot(tg.x - m.x, tg.y - m.y) < 560) this.setState(m, 'tell');
    } else if (m.s === 'tell') {
      m.vx *= 0.86; m.vy *= 0.86;
      if (tg) m.face = sign(tg.x - m.x);
      if (m.t > 0.45) {
        this.setState(m, 'dive');
        const ty = tg ? tg.y - 28 : m.y + 200, tx = tg ? tg.x : m.x;
        const d = Math.hypot(tx - m.x, ty - (m.y - m.h / 2)) || 1;
        const sp = 600 + Math.min(200, this.wave * 12);
        m.vx = (tx - m.x) / d * sp; m.vy = (ty - (m.y - m.h / 2)) / d * sp;
      }
    } else if (m.s === 'dive') {
      if (m.t > 0.6 || m.hitWall || m.hitCeil || m.onGround) this.setState(m, 'rec');
    } else if (m.s === 'rec') {
      m.vx *= 0.9; m.vy = m.vy * 0.9 - 30 * dt * 60;
      if (m.t > 0.5) { this.setState(m, 'idle'); m.next = rand(1.6, 3.2); m.side = Math.random() < 0.5 ? -1 : 1; }
    }
  }

  ai_hopper(m, dt, tg) {
    if (m.s === 'idle') {
      if (m.onGround) m.vx = 0;
      if (tg) m.face = sign(tg.x - m.x);
      if (tg && m.onGround && m.t > m.next) this.setState(m, 'crouch');
    } else if (m.s === 'crouch') {
      m.vx = 0;
      if (m.t > 0.32) {
        const dx = tg ? tg.x - m.x : m.face * 200;
        const up = tg ? clamp(m.y - tg.y, 0, 320) : 0;
        m.vx = clamp(dx * 1.25, -560, 560);
        m.vy = -(820 + up * 1.35);
        m.face = sign(dx);
        this.setState(m, 'air');
        this.ev({ e: 'hop', x: Math.round(m.x), y: Math.round(m.y) });
      }
    } else if (m.s === 'air') {
      if (m.onGround && m.t > 0.1) { this.setState(m, 'idle'); m.vx = 0; m.next = rand(0.45, 1.2); }
    }
  }

  ai_spitter(m, dt, tg) {
    const T = this.time;
    const steer = (tx, ty, max) => {
      m.vx += ((tx - m.x) * 3 - m.vx * 2.4) * dt;
      m.vy += ((ty - m.y) * 3 - m.vy * 2.4) * dt;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > max) { m.vx *= max / sp; m.vy *= max / sp; }
    };
    if (tg) {
      let tx = tg.x + m.side * 330;
      if (tx < 140 || tx > WORLD_W - 140) { m.side *= -1; tx = tg.x + m.side * 330; }
      const ty = clamp(tg.y - 240, 180, 820) + Math.sin(T * 1.7 + m.id) * 25;
      const slow = m.s === 'tell' ? 30 : 170;
      steer(tx, ty, slow);
      m.face = sign(tg.x - m.x);
    } else {
      steer(m.x + Math.sin(T * 0.4 + m.id) * 80, 360, 90);
    }
    if (m.s === 'idle') {
      if (tg && m.t > m.next) this.setState(m, 'tell');
    } else if (m.s === 'tell') {
      if (m.t > 0.55 && tg) {
        const sx = m.x + m.face * 18, sy = m.y - 26;
        for (let k = -1; k <= 1; k++) {
          const Tm = 0.85 + k * 0.13;
          const dx = tg.x - sx, dy = (tg.y - 26) - sy;
          this.proj.push({
            id: this.nextId++, k: 'glob', x: sx, y: sy, vx: dx / Tm, vy: dy / Tm - 0.5 * GLOB_G * Tm,
            w: PROJ.glob.w, h: PROJ.glob.h, o: 'm', life: 3, dmg: 1,
          });
        }
        this.ev({ e: 'spit', x: Math.round(sx), y: Math.round(sy) });
        this.setState(m, 'rec');
      } else if (m.t > 0.55) this.setState(m, 'idle');
    } else if (m.s === 'rec') {
      if (m.t > 0.6) { this.setState(m, 'idle'); m.next = rand(2.2, 3.4); }
    }
  }

  ai_shell(m, dt, tg) {
    if (m.s === 'walk' || m.s === 'idle') {
      this.walkerTurn(m, tg, 900);
      m.vx = m.face * 58;
      if (tg && m.t > 1.3 && Math.abs(tg.y - m.y) < 150 && Math.abs(tg.x - m.x) < 640 && sign(tg.x - m.x) === m.face) {
        this.setState(m, 'tell');
      }
    } else if (m.s === 'tell') {
      m.vx = 0;
      if (m.t > 0.7) this.setState(m, 'charge');
    } else if (m.s === 'charge') {
      m.vx = m.face * (640 + Math.min(160, this.wave * 8));
      const edge = m.onGround && !groundAt(m.x + m.face * (m.w / 2 + 10), m.y + 2);
      if (m.hitWall === m.face) {
        this.setState(m, 'stun'); m.vx = 0;
        this.ev({ e: 'thud', x: Math.round(m.x + m.face * m.w / 2), y: Math.round(m.y - 30) });
      } else if (edge || m.t > 1.8) { this.setState(m, 'walk'); m.vx = 0; }
    } else if (m.s === 'stun') {
      m.vx = 0;
      if (m.t > 1.1) { this.setState(m, 'walk'); m.face *= -1; }
    }
  }

  ai_boss(m, dt, tg) {
    const ph = m.hp < m.mh * 0.5 ? 2 : 1;
    if (ph !== m.ph) { m.ph = ph; this.ev({ e: 'roar', x: Math.round(m.x), y: Math.round(m.y) }); }
    const fast = ph === 2;
    const dx = tg ? tg.x - m.x : 0;
    switch (m.s) {
      case 'idle':
        if (tg) m.face = sign(dx);
        m.vx = tg && Math.abs(dx) > 120 ? m.face * (fast ? 120 : 80) : 0;
        if (m.t > (fast ? 0.55 : 1.0) && tg) {
          if (Math.abs(dx) < 250 && Math.abs(tg.y - m.y) < 220) this.setState(m, 'swTell');
          else {
            const r = Math.random();
            if (fast && r < 0.25 && this.mobs.length < 7) this.setState(m, 'summon');
            else if (r < 0.62) this.setState(m, 'lpTell');
            else this.setState(m, 'chTell');
          }
        }
        break;
      case 'swTell':
        m.vx = 0;
        if (m.t > (fast ? 0.42 : 0.55)) this.setState(m, 'swipe');
        break;
      case 'swipe': {
        m.vx = m.face * 120;
        const w = 240, h = 170;
        m.hz = { x: Math.round(m.face > 0 ? m.x - 20 : m.x - w + 20), y: Math.round(m.y - h), w, h, d: 2 };
        if (!m.did) { m.did = true; this.ev({ e: 'swing', x: Math.round(m.x), y: Math.round(m.y) }); }
        if (m.t > 0.22) { m.hz = null; this.setState(m, 'rec'); }
        break;
      }
      case 'lpTell':
        m.vx = 0;
        if (tg) m.face = sign(dx);
        if (m.t > (fast ? 0.42 : 0.55)) {
          const T = 1.0;
          m.vx = clamp(dx / T, -820, 820);
          m.vy = -1250;
          this.setState(m, 'leap');
        }
        break;
      case 'leap':
        if (m.onGround && m.t > 0.15) {
          m.vx = 0;
          this.ev({ e: 'slam', x: Math.round(m.x), y: Math.round(m.y) });
          const sp = fast ? 700 : 560;
          for (const d of [-1, 1]) {
            this.proj.push({ id: this.nextId++, k: 'shock', x: m.x + d * 70, y: FLOOR_Y, vx: d * sp, vy: 0, w: PROJ.shock.w, h: PROJ.shock.h, o: 'm', life: 2.6, dmg: 1 });
          }
          this.setState(m, 'rec');
        }
        break;
      case 'chTell':
        m.vx = 0;
        if (tg) m.face = sign(dx);
        if (m.t > (fast ? 0.55 : 0.75)) this.setState(m, 'charge');
        break;
      case 'charge':
        m.vx = m.face * (fast ? 900 : 780);
        if (m.hitWall === m.face) {
          this.setState(m, 'stun'); m.vx = 0;
          this.ev({ e: 'thud', x: Math.round(m.x + m.face * m.w / 2), y: Math.round(m.y - 60), big: 1 });
        } else if (m.t > 2.4) this.setState(m, 'rec');
        break;
      case 'stun':
        m.vx = 0;
        if (m.t > 1.3) { this.setState(m, 'idle'); }
        break;
      case 'summon':
        m.vx = 0;
        if (m.t > 0.5 && !m.did) {
          m.did = true;
          for (const d of [-1, 1]) this.spawnMob('gnat', { x: clamp(m.x + d * 140, 150, WORLD_W - 150), y: m.y - 230 });
          this.ev({ e: 'roar', x: Math.round(m.x), y: Math.round(m.y), small: 1 });
        }
        if (m.t > 0.95) this.setState(m, 'rec');
        break;
      case 'rec':
      default:
        m.vx = 0;
        m.hz = null;
        if (m.t > (fast ? 0.45 : 0.75)) this.setState(m, 'idle');
    }
  }

  updateProjectiles(dt) {
    for (const p of this.proj) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.k === 'glob') p.vy += GLOB_G * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const l = p.x - p.w / 2, t = p.y - p.h / 2;
      if (p.k === 'shock') {
        if (boxInSolid(l, FLOOR_Y - p.h, p.w, p.h - 2)) { p.dead = true; this.ev({ e: 'splat', x: Math.round(p.x), y: FLOOR_Y - 20, k: 'shock' }); }
        continue;
      }
      if (boxInSolid(l + p.w * 0.3, t + p.h * 0.3, p.w * 0.4, p.h * 0.4)) {
        p.dead = true;
        this.ev({ e: 'splat', x: Math.round(p.x), y: Math.round(p.y), k: p.k });
        continue;
      }
      if (p.k === 'bolt') {
        for (const m of this.mobs) {
          if (m.dead || m.s === 'spawn' || p.hit.has(m.id)) continue;
          if (overlap(l, t, p.w, p.h, m.x - m.w / 2, m.y - m.h, m.w, m.h)) {
            p.hit.add(m.id);
            this.damageMob(m, SPELL.dmg, p.o, sign(p.vx));
          }
        }
      }
    }
  }

  // ---------- network ----------
  snapshot() {
    const r = v => Math.round(v);
    const hz = [];
    const m = this.mobs.map(o => {
      if (o.hz) hz.push([o.id, o.hz.x, o.hz.y, o.hz.w, o.hz.h, o.hz.d]);
      return [o.id, MOB_TYPES.indexOf(o.type), r(o.x), r(o.y), r(o.vx), r(o.vy), o.face, SI[o.s], r(o.t * 100), o.fl > 0 ? 1 : 0, o.hp, o.mh, o.ph];
    });
    const p = this.proj.map(o => [o.id, PROJ_TYPES.indexOf(o.k), r(o.x), r(o.y), r(o.vx), r(o.vy), o.o === 'm' ? -1 : o.o]);
    const pl = {};
    for (const [pid, s] of this.players) pl[pid] = s;
    const rv = {};
    for (const pid in this.revive) if (this.revive[pid] > 0) rv[pid] = +(this.revive[pid] / PLAYER.reviveTime).toFixed(2);
    return {
      tm: +this.time.toFixed(3), ph: this.phase, pt: +this.phaseT.toFixed(2), wv: this.wave,
      left: this.queue.length + this.mobs.length, tot: this.waveTotal,
      m, hz, p, pl, rv, k: this.kills,
    };
  }
}

// Decode a snapshot's compact arrays into objects (used by clients).
export function decodeMobs(arr) {
  return arr.map(a => ({
    id: a[0], type: MOB_TYPES[a[1]], x: a[2], y: a[3], vx: a[4], vy: a[5], face: a[6],
    s: STATES[a[7]], t: a[8] / 100, fl: a[9], hp: a[10], mh: a[11], ph: a[12],
    w: MOBS[MOB_TYPES[a[1]]].w, h: MOBS[MOB_TYPES[a[1]]].h,
  }));
}

export function decodeProj(arr) {
  return arr.map(a => ({
    id: a[0], k: PROJ_TYPES[a[1]], x: a[2], y: a[3], vx: a[4], vy: a[5], o: a[6] === -1 ? 'm' : a[6],
    w: PROJ[PROJ_TYPES[a[1]]].w, h: PROJ[PROJ_TYPES[a[1]]].h,
  }));
}
