// Gloamhollow server: static file host + WebSocket rooms (2 players each).
// The server runs mob/wave simulation per room; players are client-authoritative.
// Memory footprint is tiny (a few KB per room); run with --max-old-space-size=256.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World } from './shared/world.js';
import { TICK_RATE, MAX_PLAYERS } from './shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 300;
const ROOTS = { '/shared/': path.join(__dirname, 'shared'), '/': path.join(__dirname, 'public') };
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json',
};

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(stats())); }
  const prefix = url.startsWith('/shared/') ? '/shared/' : '/';
  const root = ROOTS[prefix];
  let rel = url.slice(prefix.length) || 'index.html';
  const file = path.normalize(path.join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
});

// ---------- rooms ----------
const rooms = new Map(); // code -> room
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function makeCode() {
  for (let tries = 0; tries < 1000; tries++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

function createRoom(isPublic) {
  if (rooms.size >= MAX_ROOMS) return null;
  const code = makeCode();
  if (!code) return null;
  const room = { code, isPublic, world: new World(), slots: new Array(MAX_PLAYERS).fill(null), created: Date.now() };
  rooms.set(code, room);
  return room;
}

function roomCount(room) { return room.slots.filter(Boolean).length; }

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

function broadcastLobby(room) {
  const names = room.slots.map(ws => (ws ? ws.name : null));
  for (const ws of room.slots) send(ws, { t: 'roster', names });
}

function joinRoom(ws, room) {
  const slot = room.slots.indexOf(null);
  if (slot < 0) return send(ws, { t: 'error', msg: 'That room is full.' });
  leaveRoom(ws);
  room.slots[slot] = ws;
  ws.room = room;
  ws.pid = slot;
  room.world.addPlayer(slot, ws.name);
  send(ws, { t: 'joined', code: room.code, pid: slot, phase: room.world.phase });
  broadcastLobby(room);
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  const i = room.slots.indexOf(ws);
  if (i >= 0) room.slots[i] = null;
  room.world.removePlayer(ws.pid);
  ws.room = null;
  if (roomCount(room) === 0) rooms.delete(room.code);
  else broadcastLobby(room);
}

function cleanName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 14) || 'Wanderer';
}

// ---------- websocket ----------
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024, perMessageDeflate: false });

wss.on('connection', ws => {
  ws.name = 'Wanderer';
  ws.room = null;
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const room = ws.room;
    const world = room && room.world;
    switch (msg.t) {
      case 'create': {
        ws.name = cleanName(msg.name);
        const r = createRoom(!!msg.public);
        if (!r) return send(ws, { t: 'error', msg: 'Server is full, try again later.' });
        joinRoom(ws, r);
        break;
      }
      case 'join': {
        ws.name = cleanName(msg.name);
        const r = rooms.get(String(msg.code || '').toUpperCase().trim());
        if (!r) return send(ws, { t: 'error', msg: 'No room with that code.' });
        joinRoom(ws, r);
        break;
      }
      case 'quick': {
        ws.name = cleanName(msg.name);
        let r = null;
        for (const cand of rooms.values()) {
          if (cand.isPublic && roomCount(cand) < MAX_PLAYERS && cand.world.phase !== 'over') { r = cand; break; }
        }
        if (!r) r = createRoom(true);
        if (!r) return send(ws, { t: 'error', msg: 'Server is full, try again later.' });
        joinRoom(ws, r);
        break;
      }
      case 'leave': leaveRoom(ws); break;
      case 'st': if (world) world.setPlayer(ws.pid, sanitizeState(msg.s, ws.name)); break;
      case 'hit': if (world) world.hitMob(ws.pid, msg.id | 0, msg.d, msg.kx); break;
      case 'spell': if (world) world.castSpell(ws.pid, msg.x, msg.y, msg.f); break;
      case 'pop': if (world) world.popProj(msg.id | 0); break;
      case 'start': if (world) world.start(); break;
      case 'ping': send(ws, { t: 'pong', c: msg.c }); break;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => {});
});

// Players are trusted (no anticheat), but keep the shape sane so a bad client can't bloat memory.
const STATE_KEYS = ['x', 'y', 'vx', 'vy', 'f', 'hp', 'lu', 'an', 'ad', 'aq', 'fc', 'ds', 'iv', 'og', 'cs', 'dj'];
function sanitizeState(s, name) {
  if (!s || typeof s !== 'object') return null;
  const out = { nm: name, dn: !!s.dn };
  for (const k of STATE_KEYS) {
    const v = s[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === 'string') out[k] = v.slice(0, 8);
  }
  return out;
}

// ---------- tick ----------
const DT = 1 / TICK_RATE;
setInterval(() => {
  for (const room of rooms.values()) {
    if (roomCount(room) === 0) continue;
    room.world.step(DT);
    const snap = room.world.snapshot();
    snap.t = 'snap';
    snap.ev = room.world.drain();
    const data = JSON.stringify(snap);
    for (const ws of room.slots) send(ws, data);
  }
}, 1000 / TICK_RATE);

// Drop dead connections.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    try { ws.ping(); } catch {}
  }
}, 15000);

function stats() {
  const mem = process.memoryUsage();
  return { rooms: rooms.size, clients: wss.clients.size, rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576) };
}

server.listen(PORT, () => {
  console.log(`Gloamhollow listening on http://localhost:${PORT}`);
});
