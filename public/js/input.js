// Keyboard input with per-player binding sets. Edit BINDS to remap keys.

export const BINDS = {
  // One player per keyboard (online and solo), two layouts active at once.
  solo: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['KeyZ', 'Space'], attack: ['KeyX', 'KeyJ'], dash: ['KeyC', 'KeyK'],
    spell: ['KeyV', 'KeyL'], focus: ['ShiftLeft', 'ShiftRight'],
  },
};

export const BIND_LABELS = {
  solo: { move: 'Arrows / WASD', jump: 'Z / Space', attack: 'X / J', dash: 'C / K', spell: 'V / L', focus: 'Shift (hold)' },
};

const held = new Set();
const tapped = new Set();
const listeners = [];
let gameKeysActive = false;

const ALL_GAME_CODES = new Set(Object.values(BINDS).flatMap(b => Object.values(b).flat()));

window.addEventListener('keydown', e => {
  const typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (typing) return;
  if (gameKeysActive && ALL_GAME_CODES.has(e.code)) e.preventDefault();
  if (!e.repeat) {
    tapped.add(e.code);
    for (const fn of listeners) fn(e);
  }
  held.add(e.code);
});
window.addEventListener('keyup', e => { held.delete(e.code); });
window.addEventListener('blur', () => held.clear());

export function setGameKeysActive(v) { gameKeysActive = v; if (!v) held.clear(); }
export function onKey(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); }
export function isHeld(code) { return held.has(code); }

// Call once per rendered frame, after all simulation steps consumed their taps.
export function endFrame() { tapped.clear(); }

export class Controller {
  constructor(binds) {
    this.b = binds;
    this.consumed = new Set();
  }
  // Held this frame (or tapped and released between frames).
  down(a) { return this.b[a].some(c => held.has(c) || tapped.has(c)); }
  // Newly pressed this frame; returns true at most once per frame per action.
  pressed(a) {
    if (this.consumed.has(a)) return false;
    if (this.b[a].some(c => tapped.has(c))) { this.consumed.add(a); return true; }
    return false;
  }
  frame() { this.consumed.clear(); }
  axis() { return (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0); }
}
