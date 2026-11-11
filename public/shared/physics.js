import { SOLIDS, PLATFORMS } from './map.js';

// Bodies use x = horizontal center, y = feet (bottom edge), w/h = box size.

export function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function bodyBox(b) {
  return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
}

export function boxesTouch(a, b) {
  return overlap(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h);
}

function solidAt(l, t, w, h) {
  for (const s of SOLIDS) if (overlap(l, t, w, h, s.x, s.y, s.w, s.h)) return s;
  return null;
}

// Move a body with collision. opts.platforms: land on one-way ledges.
// Sets b.onGround, b.hitWall (-1/0/1), b.hitCeil.
export function moveBody(b, dt, opts = {}) {
  const usePlat = opts.platforms !== false;
  const dist = Math.max(Math.abs(b.vx * dt), Math.abs(b.vy * dt));
  const steps = Math.max(1, Math.ceil(dist / 16));
  const sdt = dt / steps;
  b.onGround = false;
  b.hitWall = 0;
  b.hitCeil = false;
  for (let i = 0; i < steps; i++) {
    // Horizontal
    b.x += b.vx * sdt;
    let l = b.x - b.w / 2, t = b.y - b.h;
    for (const s of SOLIDS) {
      if (overlap(l, t, b.w, b.h, s.x, s.y, s.w, s.h)) {
        if (b.x < s.x + s.w / 2) { b.x = s.x - b.w / 2 - 0.01; b.hitWall = 1; }
        else { b.x = s.x + s.w + b.w / 2 + 0.01; b.hitWall = -1; }
        l = b.x - b.w / 2;
        b.vx = 0;
      }
    }
    // Vertical
    const prevBottom = b.y;
    b.y += b.vy * sdt;
    l = b.x - b.w / 2; t = b.y - b.h;
    for (const s of SOLIDS) {
      if (overlap(l, t, b.w, b.h, s.x, s.y, s.w, s.h)) {
        if (b.vy >= 0 && prevBottom - 0.5 <= s.y) { b.y = s.y; b.onGround = true; }
        else if (b.vy < 0) { b.y = s.y + s.h + b.h; b.hitCeil = true; }
        else { b.y = s.y; b.onGround = true; }
        b.vy = 0;
        t = b.y - b.h;
      }
    }
    if (usePlat && b.vy >= 0 && !(b.dropT > 0)) {
      for (const p of PLATFORMS) {
        if (prevBottom <= p.y + 0.5 && b.y >= p.y && b.x + b.w / 2 > p.x && b.x - b.w / 2 < p.x + p.w) {
          b.y = p.y; b.vy = 0; b.onGround = true; b.plat = p;
        }
      }
    }
  }
  if (!b.onGround) b.plat = null;
}

// Is there something to stand on at world point (x, y)?
export function groundAt(x, y) {
  if (solidAt(x - 1, y, 2, 2)) return true;
  for (const p of PLATFORMS) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + 8) return true;
  return false;
}

export function pointInSolid(x, y) {
  return !!solidAt(x - 0.5, y - 0.5, 1, 1);
}

export function boxInSolid(l, t, w, h) {
  return !!solidAt(l, t, w, h);
}
