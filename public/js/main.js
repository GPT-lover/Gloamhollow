import { Controller, BINDS, endFrame, onKey, setGameKeysActive } from './input.js';
import { Player } from './player.js';
import { LocalSession, OnlineSession } from './net.js';
import { Scene } from './scene.js';
import { FX } from './fx.js';
import { LOOKS, drawPlayer, drawSlash, drawMob, drawProjectile, drawMaskIcon, drawReviveRing } from './art.js';
import * as audio from './audio.js';
import { PLAYER, MOBS } from '/shared/constants.js';
import { WORLD_W, WORLD_H } from '/shared/map.js';
import { initMenu, showMenu, hideMenu, toast } from './menu.js';

const VW = 1280, VH = 720, STEP = 1 / 60;
const TAU = Math.PI * 2;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let dpr = 1, baseScale = 1;
let scene = null;
let fx = new FX();
let game = null;
let T = 0, last = performance.now();
let idleCam = { x: WORLD_W / 2, y: 700, z: 0.62 };

const TITLE_FONT = '"Cinzel", "Trajan Pro", Georgia, serif';
const BODY_FONT = '"Cormorant Garamond", Georgia, serif';

// ---------- sizing ----------
function resize() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const s = Math.min(ww / VW, wh / VH);
  const cw = Math.floor(VW * s), ch = Math.floor(VH * s);
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
  canvas.width = Math.floor(cw * dpr);
  canvas.height = Math.floor(ch * dpr);
  baseScale = canvas.width / VW;
}
window.addEventListener('resize', resize);
resize();

// ---------- game lifecycle ----------
function beginGame(mode, session, pid = 0) {
  scene = scene || new Scene();
  fx = new FX();
  const players = [new Player(pid, new Controller(BINDS.solo))];
  game = {
    mode, session, players, remotes: new Map(), view: null,
    cam: { x: players[0].x, y: players[0].y - 150, z: 0.92 },
    shake: 0, hitstop: 0, dark: 0, white: 0, acc: 0, lastSend: 0,
    titles: [], roster: [], over: null, seenMobs: new Set(), spawnSfxT: 0, escT: 0,
  };
  game.ctxs = new Map(players.map(p => [p.pid, makeCtx(p)]));
  hideMenu();
  setGameKeysActive(true);
  if (mode === 'local') session.start();
  else addTitle('The Vigil', 'Room ' + session.code, 3.2);
}

function exitToMenu(msg) {
  if (game) game.session.close();
  game = null;
  setGameKeysActive(false);
  history.replaceState(null, '', location.pathname);
  showMenu();
  if (msg) toast(msg);
}

function makeCtx(p) {
  const look = LOOKS[p.pid % LOOKS.length];
  return {
    session: game.session.port(p.pid),
    onJump(p) { audio.play('jump'); fx.dust(p.x, p.y, 3); },
    onDoubleJump(p) {
      audio.play('dj');
      fx.burst(p.x, p.y - 30, 10, { smin: 60, smax: 200, lmin: 0.2, lmax: 0.4, col: look.glow, dir: Math.PI / 2, spread: 1.2, rmin: 1.5, rmax: 3 });
    },
    onDash(p) { audio.play('dash'); fx.dust(p.x, p.y, 5, -p.face); },
    onLand(p, v) { audio.play('land'); fx.dust(p.x, p.y, v > 900 ? 9 : 4); },
    onSlash() { audio.play('slash'); },
    onNailHit(p, m, dir) {
      audio.play('hit');
      const a = dir === 'up' ? -Math.PI / 2 : dir === 'down' ? Math.PI / 2 : p.face > 0 ? 0 : Math.PI;
      const hx = (p.x + m.x) / 2 + (dir === 'side' ? p.face * 20 : 0);
      const hy = dir === 'side' ? p.y - 34 : (m.y - m.h / 2 + p.y - 34) / 2;
      fx.hitSpark(hx, hy, a);
      fx.blood(m.x, m.y - m.h / 2, a, 8);
      game.hitstop = Math.max(game.hitstop, 0.055);
      game.shake = Math.max(game.shake, 4);
    },
    onParry(p, pr) { audio.play('parry'); fx.hitSpark(pr.x, pr.y, p.face > 0 ? 0 : Math.PI); game.hitstop = 0.04; },
    onCast(p) { audio.play('spell'); game.shake = Math.max(game.shake, 3); },
    onFocusStart() { audio.play('focus'); },
    onHeal(p) { audio.play('heal'); fx.heal(p.x, p.y, look.glow); },
    onHurt(p) {
      audio.play('hurt');
      fx.shatter(p.x, p.y - 30);
      game.shake = 13; game.hitstop = 0.13; game.dark = 1;
    },
    onDown(p) {
      audio.play('down');
      fx.shatter(p.x, p.y - 30);
      game.shake = 18; game.hitstop = 0.2; game.dark = 1;
      addTitle('', `${nameOf(p.pid)} has fallen`, 2.4, true);
    },
  };
}

function nameOf(pid) {
  if (game.mode === 'local') return game.session.name;
  const n = game.view && game.view.pl[pid] && game.view.pl[pid].nm;
  return n || LOOKS[pid % LOOKS.length].name;
}

function localPlayer(pid) { return game.players.find(p => p.pid === pid); }

function addTitle(text, sub, dur = 3, small = false) {
  game.titles.push({ text, sub, dur, t: 0, small });
}

function onEvent(e) {
  if (!game) return;
  const isLocal = pid => !!localPlayer(pid);
  switch (e.e) {
    case 'start':
      for (const p of game.players) p.respawn();
      game.over = null;
      fx.corpses = [];
      game.titles = [];
      addTitle('The Vigil Begins', game.mode === 'local' ? 'Hold the hollow' : 'Hold the hollow together', 3);
      break;
    case 'wave':
      audio.play('wave');
      if (e.boss) { addTitle('Gravewarden', 'Keeper of the Sunken Graves', 3.6); }
      else addTitle(`Wave ${e.n}`, wavePhrase(e.n), 2.8);
      break;
    case 'clear':
      audio.play('clear');
      addTitle('', `Wave ${e.n} endured`, 2.4, true);
      break;
    case 'mh':
      if (!isLocal(e.by)) {
        audio.play('hit');
        fx.hitSpark(e.x, e.y, e.kx < 0 ? Math.PI : 0);
        fx.blood(e.x, e.y, e.kx < 0 ? Math.PI : 0, 6);
      }
      break;
    case 'md': {
      const def = MOBS[e.ty];
      fx.death({ id: e.id, type: e.ty, x: e.x, y: e.y, face: e.f, w: def.w, h: def.h, s: 'idle', t: 0, vx: 0, vy: 0, ph: 1 });
      if (e.ty === 'boss') {
        audio.play('bossdie');
        game.shake = 24; game.hitstop = 0.35; game.white = 1;
        addTitle('', 'The Gravewarden falls', 3, true);
      } else audio.play('die');
      break;
    }
    case 'cast': if (!isLocal(e.by)) audio.play('spell'); break;
    case 'splat': fx.splat(e.x, e.y, e.k); break;
    case 'revive': {
      const p = localPlayer(e.pid);
      if (p && p.dn) {
        p.revive();
        audio.play('revive');
        fx.heal(p.x, p.y, LOOKS[p.pid % LOOKS.length].glow);
      }
      break;
    }
    case 'over':
      audio.play('over');
      game.over = { n: e.n, k: e.k, t: 0 };
      break;
    case 'roar': audio.play('roar'); game.shake = Math.max(game.shake, e.small ? 6 : 14); break;
    case 'slam': audio.play('slam'); game.shake = Math.max(game.shake, 16); fx.dust(e.x - 60, e.y, 10, -1); fx.dust(e.x + 60, e.y, 10, 1); break;
    case 'thud': audio.play('thud'); game.shake = Math.max(game.shake, e.big ? 14 : 6); fx.dust(e.x, e.y + 30, 6); break;
    case 'swing': audio.play('swing'); break;
    case 'spit': audio.play('spit'); break;
    case 'hop': audio.play('hop'); fx.dust(e.x, e.y, 3); break;
  }
}

const PHRASES = ['The dark stirs', 'They come from the deep', 'Shells crack in the gloom', 'The hollow hungers',
  'Hold the light', 'Echoes in the stone', 'The swarm thickens', 'No dawn reaches here'];
function wavePhrase(n) { return PHRASES[(n - 1) % PHRASES.length]; }

// ---------- online ----------
export async function startOnline(kind, name, code) {
  if (game) return;
  let begun = false;
  const s = new OnlineSession({
    onJoined: m => {
      if (begun) return;
      begun = true;
      history.replaceState(null, '', '?room=' + m.code);
      beginGame('online', s, m.pid);
    },
    onRoster: names => { if (game) { const prev = game.roster; game.roster = names; rosterChanged(prev, names); } },
    onError: msg => { toast(msg); if (!begun) s.close(); },
    onClose: () => { if (game && game.session === s) exitToMenu('Lost connection to the server.'); else if (!begun) toast('Could not reach the server.'); },
    onEvent,
  });
  try { await s.ready; } catch { toast('Could not reach the server.'); return; }
  if (kind === 'create') s.create(name);
  else if (kind === 'join') s.join(code, name);
  else s.quick(name);
}

function rosterChanged(prev, names) {
  for (let i = 0; i < names.length; i++) {
    if (i === game.session.pid) continue;
    if (names[i] && !prev[i]) { addTitle('', `${names[i]} joins the vigil`, 2.4, true); audio.play('revive'); }
    if (!names[i] && prev[i]) { addTitle('', `${prev[i]} has left`, 2.4, true); game.remotes.delete(i); }
  }
}

export function startLocal(name) {
  if (game) return;
  beginGame('local', new LocalSession(onEvent, name));
}

// ---------- keys outside player control ----------
onKey(e => {
  audio.initAudio();
  if (!game) return;
  if (e.code === 'KeyM') { const m = audio.toggleMute(); toast(m ? 'Sound off' : 'Sound on'); }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    const ph = game.view && game.view.ph;
    if (ph === 'lobby' || ph === 'over') { game.session.start(); audio.play('ui'); }
  }
  if (e.code === 'Escape') {
    if (game.escT > 0) exitToMenu();
    else { game.escT = 1.6; toast('Press Esc again to leave'); }
  }
});

// ---------- per-frame ----------
function tick(dt) {
  const g = game;
  g.escT -= dt;
  let view = g.session.getView();
  if (!view) return false;
  g.view = view;
  let stepped = false;

  if (g.hitstop > 0) {
    g.hitstop -= dt;
  } else {
    g.acc = Math.min(g.acc + dt, STEP * 5);
    while (g.acc >= STEP) {
      for (const p of g.players) p.update(STEP, view, g.ctxs.get(p.pid));
      if (g.session.local) {
        for (const p of g.players) g.session.setState(p.pid, p.netState());
        g.session.step(STEP);
        view = g.session.getView();
        g.view = view;
      }
      g.acc -= STEP;
      stepped = true;
      if (g.hitstop > 0) { g.acc = 0; break; }
    }
  }

  if (!g.session.local) {
    const now = performance.now();
    if (now - g.lastSend > 33) { g.lastSend = now; g.session.setState(g.players[0].pid, g.players[0].netState()); }
  }

  updateRemotes(dt);
  ambientFx(dt);
  fx.update(g.hitstop > 0 ? dt * 0.15 : dt);
  updateCamera(dt);
  g.shake = Math.max(0, g.shake - dt * 40);
  g.dark = Math.max(0, g.dark - dt * 1.6);
  g.white = Math.max(0, g.white - dt * 1.2);
  for (const t of g.titles) t.t += dt;
  g.titles = g.titles.filter(t => t.t < t.dur);
  if (g.over) g.over.t += dt;
  return stepped;
}

function updateRemotes(dt) {
  const g = game;
  for (const k in g.view.pl) {
    const pid = +k;
    if (localPlayer(pid)) continue;
    if (g.mode === 'online' && !g.roster[pid]) continue;
    const s = g.view.pl[k];
    let r = g.remotes.get(pid);
    if (!r) { r = { aq: s.aq, atkT: 99, dj: s.dj, djT: 0, runT: 0, og: s.og, landT: 0 }; g.remotes.set(pid, r); }
    r.atkT += dt;
    r.djT = Math.max(0, r.djT - dt);
    r.landT = Math.max(0, r.landT - dt);
    if (s.aq !== r.aq) { r.aq = s.aq; r.atkT = 0; }
    if (s.dj !== r.dj) { r.dj = s.dj; r.djT = 0.35; }
    if (s.og && !r.og) r.landT = 0.13;
    r.og = s.og;
    if (s.og && Math.abs(s.vx) > 20) r.runT += dt;
    r.state = {
      x: s.x, y: s.y, vx: s.vx || 0, vy: s.vy || 0, f: s.f || 1, og: !!s.og, dn: !!s.dn,
      atkDir: s.ad || 'side', atkT: r.atkT, ds: !!s.ds, fc: s.fc || 0, iv: !!s.iv, cs: !!s.cs,
      landT: r.landT, djT: r.djT, runT: r.runT, hp: s.hp, lu: s.lu,
    };
  }
}

function ambientFx(dt) {
  const g = game;
  const all = allPlayerStates();
  for (const { s, look } of all) {
    if (s.ds) fx.inkTrail(s.x, s.y, s.f);
    if (s.fc > 0 && Math.random() < dt * 40) fx.focusMotes(s.x, s.y, look.glow);
  }
  for (const p of g.view.proj) if (p.k === 'bolt' && Math.random() < 0.8) fx.boltTrail(p);
  for (const m of g.view.mobs) {
    if (m.type === 'boss' && m.ph === 2 && Math.random() < dt * 30) fx.embers(m.x, m.y - 150);
    if (m.s === 'spawn' && !g.seenMobs.has(m.id)) {
      g.seenMobs.add(m.id);
      if (g.spawnSfxT <= 0) { audio.play('spawn'); g.spawnSfxT = 0.25; }
    }
  }
  g.spawnSfxT -= dt;
  if (g.seenMobs.size > 500) g.seenMobs.clear();
}

function allPlayerStates() {
  const out = [];
  if (!game) return out;
  for (const [pid, r] of game.remotes) if (r.state) out.push({ pid, s: r.state, look: LOOKS[pid % LOOKS.length], remote: true });
  for (const p of game.players) out.push({ pid: p.pid, s: p.renderState(), look: LOOKS[p.pid % LOOKS.length], remote: false });
  return out;
}

function updateCamera(dt) {
  const g = game, c = g.cam;
  const p = g.players[0];
  const tx = p.x + p.face * 70, ty = p.y - 130, tz = 0.92;
  const k = Math.min(1, dt * 5);
  c.z += (tz - c.z) * Math.min(1, dt * 3);
  c.x += (tx - c.x) * k;
  c.y += (ty - c.y) * k;
  clampCam(c);
}

function clampCam(c) {
  const hw = VW / (2 * c.z), hh = VH / (2 * c.z);
  c.x = hw * 2 >= WORLD_W ? WORLD_W / 2 : Math.max(hw, Math.min(WORLD_W - hw, c.x));
  c.y = hh * 2 >= WORLD_H ? WORLD_H / 2 : Math.max(hh, Math.min(WORLD_H - hh, c.y));
}

// ---------- rendering ----------
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!scene) scene = new Scene();
  const cam = game ? { ...game.cam } : idleCam;
  if (!game) {
    idleCam.x = WORLD_W / 2 + Math.sin(T * 0.07) * 380;
    idleCam.y = 640 + Math.sin(T * 0.11) * 50;
    clampCam(idleCam);
  }
  if (game && game.shake > 0) {
    cam.x += (Math.random() - 0.5) * game.shake * 1.4;
    cam.y += (Math.random() - 0.5) * game.shake * 1.4;
  }
  ctx.setTransform(baseScale, 0, 0, baseScale, 0, 0);
  ctx.save();
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cam.x, -cam.y);

  scene.drawBack(ctx, cam);
  scene.drawLightShafts(ctx, T);
  scene.drawTerrain(ctx);
  scene.drawLanterns(ctx, T);
  fx.drawMotes(ctx, T);

  if (game && game.view) {
    const v = game.view;
    fx.drawBack(ctx, T);
    const mobs = [...v.mobs].sort((a, b) => (a.type === 'boss' ? -1 : 0) - (b.type === 'boss' ? -1 : 0));
    for (const m of mobs) drawMob(ctx, m, T);
    for (const p of v.proj) drawProjectile(ctx, p, T, LOOKS);
    const states = allPlayerStates();
    for (const { pid, s, look } of states) {
      drawPlayer(ctx, s, look, T);
      if (s.dn && v.rv[pid]) drawReviveRing(ctx, s.x, s.y, v.rv[pid], look);
      else if (s.dn && states.length > 1) drawDownHint(ctx, s, look);
    }
    for (const { s, look } of states) if (!s.dn) drawSlash(ctx, s.x, s.y, s.f, s.atkDir, s.atkT, look);
    for (const { pid, s, look } of states) drawNameTag(ctx, pid, s, look);
    fx.drawFront(ctx);
  } else {
    fx.update(1 / 60);
  }
  scene.drawFog(ctx, T, cam);
  scene.drawForeground(ctx, cam, T);
  ctx.restore();

  scene.drawVignette(ctx, VW, VH);
  if (game) {
    if (game.dark > 0) { ctx.fillStyle = `rgba(0,0,0,${game.dark * 0.45})`; ctx.fillRect(0, 0, VW, VH); }
    if (game.white > 0) { ctx.fillStyle = `rgba(255,250,240,${game.white * 0.6})`; ctx.fillRect(0, 0, VW, VH); }
    if (game.view) drawHUD();
    else drawCenterText('Waiting for the server…', VH / 2, 26, 0.8);
  }
}

function drawDownHint(ctx, s, look) {
  ctx.save();
  ctx.font = `600 13px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${look.glow},${0.55 + 0.3 * Math.sin(T * 4)})`;
  ctx.fillText('stand near to revive', s.x, s.y - 52);
  ctx.restore();
}

function drawNameTag(ctx, pid, s, look) {
  if (s.dn || game.mode === 'local') return;
  ctx.save();
  ctx.font = `600 13px ${BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = `rgba(${look.glow},0.65)`;
  ctx.fillText(nameOf(pid), s.x, s.y - 112);
  ctx.restore();
}

function drawHUD() {
  const g = game, v = g.view;
  const slots = [];
  const me = g.players[0];
  slots.push({ pid: me.pid, hp: me.hp, lu: me.lu, dn: me.dn, name: nameOf(me.pid) + (g.mode === 'online' ? ' (you)' : '') });
  for (const [pid, r] of g.remotes) if (r.state && g.roster[pid]) slots.push({ pid, hp: r.state.hp ?? 0, lu: r.state.lu ?? 0, dn: r.state.dn, name: nameOf(pid) });
  slots.forEach((s, i) => drawPlayerHud(s, i === 0 ? 'left' : 'right', v.k ? v.k[s.pid] || 0 : 0));

  // wave info
  ctx.save();
  ctx.textAlign = 'center';
  if (v.ph === 'wave') {
    ctx.font = `700 22px ${TITLE_FONT}`;
    ctx.fillStyle = 'rgba(230,236,242,0.9)';
    ctx.fillText(`WAVE ${v.wv}`, VW / 2, 40);
    ctx.font = `600 16px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(200,210,220,0.7)';
    ctx.fillText(`${v.left} remain`, VW / 2, 62);
  } else if (v.ph === 'inter') {
    ctx.font = `600 17px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(200,215,230,0.8)';
    ctx.fillText(`Next wave in ${Math.ceil(v.pt)}`, VW / 2, 44);
  }
  ctx.restore();

  // boss bar
  const boss = v.mobs.find(m => m.type === 'boss' && m.s !== 'spawn');
  if (boss) {
    const w = 560, x = (VW - w) / 2, y = VH - 54;
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,10,0.75)';
    ctx.fillRect(x - 3, y - 3, w + 6, 14);
    ctx.fillStyle = boss.ph === 2 ? '#e0622a' : '#c9cfd8';
    ctx.fillRect(x, y, w * Math.max(0, boss.hp / boss.mh), 8);
    ctx.font = `700 16px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,236,242,0.9)';
    ctx.fillText('GRAVEWARDEN', VW / 2, y - 10);
    ctx.restore();
  }

  for (const t of g.titles) drawTitle(t);

  if (v.ph === 'lobby') drawLobby();
  if (g.over || v.ph === 'over') drawGameOver();

  if (g.mode === 'online') drawPartnerArrow();

  ctx.save();
  ctx.font = `600 12px ${BODY_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(180,195,210,0.45)';
  const bits = [];
  if (g.mode === 'online') bits.push(`room ${g.session.code}`, `${g.session.ping} ms`);
  bits.push(audio.isMuted() ? 'muted (M)' : 'M: mute', 'Esc: leave');
  ctx.fillText(bits.join('  ·  '), VW - 14, VH - 12);
  ctx.restore();
}

function drawPlayerHud(s, side, kills) {
  const look = LOOKS[s.pid % LOOKS.length];
  const right = side === 'right';
  const vx = right ? VW - 56 : 56, vy = 54;
  ctx.save();
  // lumen vessel
  ctx.fillStyle = 'rgba(4,6,9,0.85)';
  ctx.beginPath(); ctx.arc(vx, vy, 30, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(vx, vy, 26, 0, TAU); ctx.clip();
  const lvl = vy + 26 - 52 * (s.lu / PLAYER.lumenMax);
  const gr = ctx.createLinearGradient(0, vy - 26, 0, vy + 26);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(1, `rgb(${look.glow})`);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(vx - 30, vy + 30);
  for (let x = -30; x <= 30; x += 4) ctx.lineTo(vx + x, lvl + Math.sin(T * 3 + x * 0.2) * 2);
  ctx.lineTo(vx + 30, vy + 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = s.lu >= PLAYER.spellCost ? `rgba(${look.glow},0.95)` : 'rgba(200,210,220,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(vx, vy, 29, 0, TAU); ctx.stroke();
  // ornament horns on vessel
  ctx.strokeStyle = 'rgba(220,228,236,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const d = right ? -1 : 1;
  ctx.moveTo(vx + d * 22, vy - 20); ctx.quadraticCurveTo(vx + d * 40, vy - 36, vx + d * 58, vy - 30);
  ctx.stroke();
  // masks
  for (let i = 0; i < PLAYER.maxHp; i++) {
    const mx = right ? vx - 58 - i * 28 : vx + 58 + i * 28;
    drawMaskIcon(ctx, mx, vy - 6, 1.05, i < s.hp && !s.dn, look);
  }
  ctx.font = `600 15px ${BODY_FONT}`;
  ctx.textAlign = right ? 'right' : 'left';
  ctx.fillStyle = `rgba(${look.glow},0.9)`;
  const nx = right ? vx - 46 : vx + 46;
  ctx.fillText(s.dn ? `${s.name} — fallen` : s.name, nx, vy + 26);
  ctx.fillStyle = 'rgba(200,210,220,0.55)';
  ctx.font = `600 13px ${BODY_FONT}`;
  ctx.fillText(`${kills} slain`, nx, vy + 43);
  ctx.restore();
}

function drawTitle(t) {
  const fin = 0.5, fout = 0.9;
  const a = Math.min(1, t.t / fin, (t.dur - t.t) / fout);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  const y = t.small ? VH * 0.3 : VH * 0.36;
  if (t.text) {
    ctx.font = `700 58px ${TITLE_FONT}`;
    ctx.fillStyle = '#eef2f6';
    ctx.shadowColor = 'rgba(160,210,255,0.5)';
    ctx.shadowBlur = 24;
    ctx.fillText(t.text.toUpperCase(), VW / 2, y);
    ctx.shadowBlur = 0;
    // flourish
    const w = Math.min(380, 120 + t.t * 600);
    ctx.strokeStyle = 'rgba(230,236,242,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(VW / 2 - w, y + 22); ctx.quadraticCurveTo(VW / 2 - w / 2, y + 14, VW / 2 - 12, y + 22);
    ctx.moveTo(VW / 2 + w, y + 22); ctx.quadraticCurveTo(VW / 2 + w / 2, y + 14, VW / 2 + 12, y + 22);
    ctx.stroke();
    ctx.fillStyle = '#eef2f6';
    ctx.beginPath(); ctx.moveTo(VW / 2, y + 15); ctx.lineTo(VW / 2 + 7, y + 22); ctx.lineTo(VW / 2, y + 29); ctx.lineTo(VW / 2 - 7, y + 22); ctx.fill();
  }
  if (t.sub) {
    ctx.font = `italic 600 ${t.text ? 22 : 26}px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(210,222,234,0.9)';
    ctx.fillText(t.sub, VW / 2, y + (t.text ? 58 : 0));
  }
  ctx.restore();
}

function drawCenterText(s, y, size, alpha, font = BODY_FONT) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 ${size}px ${font}`;
  ctx.fillStyle = `rgba(225,232,240,${alpha})`;
  ctx.fillText(s, VW / 2, y);
  ctx.restore();
}

function drawLobby() {
  const g = game;
  ctx.save();
  const y = VH - 150;
  ctx.fillStyle = 'rgba(3,5,8,0.55)';
  ctx.fillRect(0, y - 46, VW, 120);
  ctx.restore();
  if (g.mode === 'online') {
    const partner = g.roster.some((n, i) => n && i !== g.session.pid);
    drawCenterText(`ROOM  ${g.session.code}`, y - 10, 30, 0.95, TITLE_FONT);
    drawCenterText(partner ? 'Your partner is here. Press Enter to begin the vigil.' : `Waiting for a partner — share the code or this page's link. Press Enter to begin alone.`, y + 22, 19, 0.85);
    drawCenterText('Move: Arrows/WASD · Jump: Z/Space · Nail: X/J · Dash: C/K · Spell: V/L · Focus (heal): hold Shift', y + 50, 15, 0.55);
  } else {
    drawCenterText('Press Enter to begin', y + 10, 22, 0.9);
  }
}

function drawGameOver() {
  const g = game;
  const t = g.over ? g.over.t : 2;
  const a = Math.min(1, t / 1.5);
  ctx.save();
  ctx.fillStyle = `rgba(2,3,5,${0.7 * a})`;
  ctx.fillRect(0, 0, VW, VH);
  ctx.globalAlpha = a;
  drawCenterText('YOUR LIGHT FADES', VH * 0.38, 56, 1, TITLE_FONT);
  const n = g.over ? g.over.n : g.view.wv;
  drawCenterText(`The vigil held until wave ${n}`, VH * 0.38 + 52, 24, 0.85);
  const k = (g.over && g.over.k) || g.view.k || {};
  const parts = Object.keys(k).map(pid => `${nameOf(+pid)}: ${k[pid]} slain`);
  drawCenterText(parts.join('     '), VH * 0.38 + 90, 19, 0.7);
  if (t > 1.2) drawCenterText('Press Enter to rise again  ·  Esc to leave', VH * 0.38 + 150, 20, 0.6 + 0.3 * Math.sin(T * 3));
  ctx.restore();
}

function drawPartnerArrow() {
  const g = game, c = g.cam;
  for (const [pid, r] of g.remotes) {
    if (!r.state || !g.roster[pid]) continue;
    const s = r.state;
    const sx = (s.x - c.x) * c.z + VW / 2, sy = (s.y - 40 - c.y) * c.z + VH / 2;
    if (sx > 0 && sx < VW && sy > 0 && sy < VH) continue;
    const ex = Math.max(30, Math.min(VW - 30, sx)), ey = Math.max(110, Math.min(VH - 40, sy));
    const ang = Math.atan2(sy - ey, sx - ex);
    const look = LOOKS[pid % LOOKS.length];
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(${look.glow},${s.dn ? 0.5 + 0.4 * Math.sin(T * 6) : 0.8})`;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ---------- main loop ----------
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  let consumed = true;
  if (game) consumed = tick(dt) || !game;
  render();
  if (consumed) {
    endFrame();
    if (game) for (const p of game.players) p.ctrl.frame();
  }
}

initMenu({ startOnline, startLocal });
// Debugging aids: inspect state, and advance frames manually (useful in throttled background tabs).
window.__gh = () => game;
window.__fx = () => fx;
window.__advance = (n = 1, dt = 1 / 60) => {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    T += dt;
    let consumed = true;
    if (game) consumed = tick(dt) || !game;
    if (consumed) { endFrame(); if (game) for (const p of game.players) p.ctrl.frame(); }
  }
  const t1 = performance.now();
  render();
  return { simMsPerFrame: +((t1 - t0) / n).toFixed(3), renderMs: +(performance.now() - t1).toFixed(2) };
};
requestAnimationFrame(frame);
