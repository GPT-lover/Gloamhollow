# Gloamhollow

A two-player co-op wave-survival action platformer for the browser, in a hand-drawn
underground-kingdom style. Keyboard only. All art and sound are generated in code
(canvas paths + WebAudio), so there are no asset files.

## Run

```bash
npm install
npm start            # http://localhost:3000  (PORT env var to change)
```

`npm start` caps the Node heap at 256 MB. A room costs a few KB and ~40 KB/s of
snapshot traffic per player, so a 2 GB box has lots of headroom. `GET /health`
reports rooms, clients and memory use. `MAX_ROOMS` (default 300) limits rooms.

If you put it behind a reverse proxy (nginx, Caddy), make sure WebSocket upgrades
are forwarded on the same path as the page.

## Play

- **Quick match** pairs you with anyone waiting; **Create private room** gives a
  4-letter code (the URL `?room=CODE` also works as an invite link).
- **Play solo** is single-player and runs entirely in the browser (no server needed
  for the game itself).
- Press **Enter** in the room to begin. Waves get bigger; every 5th wave is the
  Gravewarden boss.

Controls are the same online and solo:

| Action | Keys |
|---|---|
| Move / aim | Arrows or WASD |
| Jump (double jump in air) | Z / Space |
| Nail (hold up/down to aim) | X / J |
| Dash | C / K |
| Spell | V / L |
| Focus — hold to heal | Shift |

Hits fill your lumen vessel; a spell or a heal costs a third of it. Down-slash in
the air to bounce off enemies. Online, stand beside a fallen partner to revive
them; clearing a wave revives everyone. Hold down + jump to drop through a ledge.
`M` mutes, `Esc` twice leaves.

Key bindings live in `public/js/input.js` (`BINDS`).

## How it's built

- `shared/` — map, physics, tunables and the `World` simulation (mobs, waves,
  projectiles, revives). Runs on the server for online rooms and in the browser
  for solo play.
- `server.js` — static files + WebSocket rooms; steps each room at 30 Hz and
  broadcasts compact snapshots.
- `public/js/` — client: player physics and hit detection (client-authoritative,
  no anticheat by design), interpolation of server entities, procedural art,
  particles, synthesized audio, HUD and menus.
