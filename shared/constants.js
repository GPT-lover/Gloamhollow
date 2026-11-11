// Tunables shared by client and server.

export const TICK_RATE = 30;          // server simulation / snapshot rate (Hz)
export const MAX_PLAYERS = 2;

export const PLAYER = {
  w: 30, h: 58,
  maxHp: 5,
  run: 340,
  gravity: 2700,
  maxFall: 1150,
  jumpV: 1110,
  doubleJumpV: 900,
  jumpCut: 0.42,
  coyote: 0.1,
  jumpBuffer: 0.13,
  dashSpeed: 960,
  dashTime: 0.17,
  dashCooldown: 0.5,
  attackCooldown: 0.3,
  attackActive: 0.11,
  pogoV: 820,
  recoil: 240,
  invuln: 1.3,
  hurtStun: 0.28,
  lumenMax: 99,
  lumenPerHit: 11,
  spellCost: 33,
  focusCost: 33,
  focusTime: 0.95,
  reviveHp: 3,
  reviveTime: 2.2,
  reviveRange: 95,
};

export const SPELL = { speed: 1150, w: 76, h: 44, dmg: 3 };

// Mob archetypes. hp is in nail hits (a nail hit deals 1).
export const MOBS = {
  crawler: { w: 56, h: 40, hp: 3, dmg: 1, fly: false, kb: 1.0 },
  gnat:    { w: 40, h: 36, hp: 2, dmg: 1, fly: true,  kb: 1.2 },
  hopper:  { w: 44, h: 54, hp: 4, dmg: 1, fly: false, kb: 0.9 },
  spitter: { w: 62, h: 60, hp: 4, dmg: 1, fly: true,  kb: 0.8 },
  shell:   { w: 96, h: 70, hp: 9, dmg: 1, fly: false, kb: 0.25 },
  boss:    { w: 150, h: 180, hp: 55, dmg: 1, fly: false, kb: 0 },
};
export const MOB_TYPES = Object.keys(MOBS);

export const PROJ = {
  bolt:  { w: SPELL.w, h: SPELL.h },
  glob:  { w: 22, h: 22, dmg: 1 },
  shock: { w: 46, h: 54, dmg: 1 },
};
