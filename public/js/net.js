import { World, decodeMobs, decodeProj } from '/shared/world.js';

const INTERP = 0.1; // seconds of interpolation delay for remote entities

function decodeHz(arr) { return arr.map(a => ({ id: a[0], x: a[1], y: a[2], w: a[3], h: a[4], d: a[5] })); }

function viewFromSnap(s) {
  return {
    tm: s.tm, ph: s.ph, pt: s.pt, wv: s.wv, left: s.left, tot: s.tot,
    mobs: decodeMobs(s.m), proj: decodeProj(s.p), hz: decodeHz(s.hz), pl: s.pl, rv: s.rv, k: s.k,
  };
}

// Offline solo play: the world simulates right here in the browser.
export class LocalSession {
  constructor(onEvent, name = 'Wanderer') {
    this.local = true;
    this.onEvent = onEvent;
    this.name = name;
    this.world = new World();
    this.world.addPlayer(0, name);
    this.ping = 0;
  }
  port(pid) {
    const w = this.world;
    return {
      hit: (id, d, kx) => w.hitMob(pid, id, d, kx),
      spell: (x, y, f) => w.castSpell(pid, x, y, f),
      pop: id => w.popProj(id),
    };
  }
  setState(pid, s) { this.world.setPlayer(pid, s); }
  start() { this.world.start(); }
  step(dt) {
    this.world.step(dt);
    for (const e of this.world.drain()) this.onEvent(e);
  }
  getView() { return viewFromSnap(this.world.snapshot()); }
  close() {}
}

// Online co-op over WebSocket. Server owns mobs & waves, we interpolate them.
export class OnlineSession {
  constructor(h) {
    this.local = false;
    this.h = h;
    this.snaps = [];
    this.pending = [];
    this.offset = null;
    this.pid = null;
    this.code = null;
    this.ping = 0;
    this.lastView = null;
    this.ready = new Promise((res, rej) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${proto}://${location.host}`);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('Could not reach the server.'));
    });
    this.ws.onmessage = ev => this.onMessage(ev.data);
    this.ws.onclose = () => { if (!this.closed) h.onClose && h.onClose(); };
    this.pingTimer = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
  }
  send(o) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  create(name) { this.send({ t: 'create', name }); }
  join(code, name) { this.send({ t: 'join', code, name }); }
  quick(name) { this.send({ t: 'quick', name }); }
  start() { this.send({ t: 'start' }); }
  setState(pid, s) { this.send({ t: 'st', s }); }
  port() {
    return {
      hit: (id, d, kx) => this.send({ t: 'hit', id, d, kx }),
      spell: (x, y, f) => this.send({ t: 'spell', x: Math.round(x), y: Math.round(y), f }),
      pop: id => this.send({ t: 'pop', id }),
    };
  }
  close() {
    this.closed = true;
    clearInterval(this.pingTimer);
    try { this.ws.close(); } catch {}
  }

  onMessage(data) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    switch (m.t) {
      case 'joined': this.pid = m.pid; this.code = m.code; this.h.onJoined && this.h.onJoined(m); break;
      case 'roster': this.h.onRoster && this.h.onRoster(m.names); break;
      case 'error': this.h.onError && this.h.onError(m.msg); break;
      case 'pong': this.ping = Math.round(performance.now() - m.c); break;
      case 'snap': {
        const now = performance.now() / 1000;
        const d = m.tm - now;
        this.offset = this.offset === null || d > this.offset || d < this.offset - 1 ? d : this.offset - 0.0004;
        const v = viewFromSnap(m);
        v.mobMap = new Map(v.mobs.map(o => [o.id, o]));
        v.projMap = new Map(v.proj.map(o => [o.id, o]));
        if (this.snaps.length && m.tm < this.snaps[this.snaps.length - 1].tm) this.snaps = []; // world restarted
        this.snaps.push(v);
        if (this.snaps.length > 40) this.snaps.shift();
        for (const e of m.ev) this.pending.push({ tm: m.tm, e });
        break;
      }
    }
  }

  getView() {
    if (!this.snaps.length) return null;
    const rt = performance.now() / 1000 + this.offset - INTERP;
    // fire events whose time has come
    while (this.pending.length && this.pending[0].tm <= rt + 0.001) this.h.onEvent(this.pending.shift().e);
    if (this.pending.length > 200) { for (const p of this.pending.splice(0)) this.h.onEvent(p.e); }

    const S = this.snaps;
    let a = S[0], b = S[S.length - 1];
    if (rt <= a.tm) b = a;
    else {
      for (let i = S.length - 1; i > 0; i--) {
        if (S[i - 1].tm <= rt) { a = S[i - 1]; b = S[i]; break; }
      }
    }
    if (rt >= b.tm) a = b;
    const span = b.tm - a.tm;
    const al = span > 0 ? Math.min(1, Math.max(0, (rt - a.tm) / span)) : 1;
    const lag = Math.max(0, b.tm - rt);
    const L = (p, q) => p + (q - p) * al;

    const mobs = b.mobs.map(mb => {
      const ma = a.mobMap.get(mb.id);
      if (!ma || ma === mb) return mb;
      return { ...mb, x: L(ma.x, mb.x), y: L(ma.y, mb.y), t: ma.s === mb.s ? L(ma.t, mb.t) : Math.max(0, mb.t - lag) };
    });
    const proj = b.proj.map(pb => {
      const pa = a.projMap.get(pb.id);
      if (pa && pa !== pb) return { ...pb, x: L(pa.x, pb.x), y: L(pa.y, pb.y) };
      return { ...pb, x: pb.x - pb.vx * lag, y: pb.y - pb.vy * lag };
    });
    const pl = {};
    for (const k in b.pl) {
      const pb = b.pl[k], pa = a.pl[k];
      pl[k] = pa ? { ...pb, x: L(pa.x, pb.x), y: L(pa.y, pb.y) } : pb;
    }
    const v = { ...b, mobs, proj, pl };
    this.lastView = v;
    return v;
  }
}
