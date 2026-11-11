// Arena layout, shared by server (mob AI/physics) and client (player physics, rendering).
// Coordinates: x right, y down. Solids are full rectangles; platforms are one-way ledges.

export const WORLD_W = 2400;
export const WORLD_H = 1200;
export const FLOOR_Y = 1000;

export const SOLIDS = [
  { x: 0, y: FLOOR_Y, w: WORLD_W, h: WORLD_H - FLOOR_Y }, // floor
  { x: 0, y: 0, w: WORLD_W, h: 70 },                       // ceiling
  { x: 0, y: 0, w: 60, h: WORLD_H },                       // left wall
  { x: WORLD_W - 60, y: 0, w: 60, h: WORLD_H },            // right wall
  { x: 60, y: 870, w: 240, h: 130 },                       // left raised shelf
  { x: WORLD_W - 300, y: 870, w: 240, h: 130 },            // right raised shelf
];

// One-way platforms: you can jump up through them and stand on top.
export const PLATFORMS = [
  { x: 400, y: 790, w: 220 },
  { x: 1780, y: 790, w: 220 },
  { x: 740, y: 650, w: 260 },
  { x: 1400, y: 650, w: 260 },
  { x: 1070, y: 500, w: 260 },
  { x: 120, y: 590, w: 200 },
  { x: 2080, y: 590, w: 200 },
  { x: 500, y: 420, w: 200 },
  { x: 1700, y: 420, w: 200 },
];

export const PLAYER_SPAWNS = [
  { x: 1050, y: FLOOR_Y },
  { x: 1350, y: FLOOR_Y },
];

// Where flying mobs emerge (ceiling cracks / dark hollows).
export const AIR_SPAWNS = [
  { x: 300, y: 230 }, { x: 800, y: 260 }, { x: 1200, y: 190 },
  { x: 1600, y: 260 }, { x: 2100, y: 230 },
];

// Where ground mobs burrow up. Ledge tops included.
export const GROUND_SPAWNS = [
  { x: 180, y: 870 }, { x: 2220, y: 870 },
  { x: 420, y: FLOOR_Y }, { x: 700, y: FLOOR_Y }, { x: 980, y: FLOOR_Y },
  { x: 1420, y: FLOOR_Y }, { x: 1700, y: FLOOR_Y }, { x: 1980, y: FLOOR_Y },
];

// Decorative lantern posts (client-only visuals, but kept here so layout lives in one place).
export const LANTERNS = [
  { x: 360, y: FLOOR_Y }, { x: 1200, y: 500 }, { x: 2040, y: FLOOR_Y },
  { x: 870, y: 650 }, { x: 1530, y: 650 },
];
