// The screenshot scenes behind ?shot=play|start|alarm|win. Each one stages a scene by
// setting the real world's state directly — positions, modes, suspicion, alarm — so the
// frame is exactly what a real game looks like at that moment, and the same seed always
// gives the same frame. Nothing here is a mock: the renderer draws the live state.
import { tileToPixel } from './level.js';
import { MODE_CHASE, MODE_PATROL, MODE_SUSPICIOUS } from './guards.js';
import { SCREEN_HEIST_DONE, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function placeGuard(guard, col, row, facing, mode, suspicion) {
  const p = tileToPixel(col, row);
  guard.x = p.x;
  guard.y = p.y;
  guard.facing = facing;
  guard.mode = mode;
  guard.suspicion = suspicion;
  guard.lastKnown = { x: p.x, y: p.y };
  guard.pauseTimer = 0;
}

function placeThief(world, col, row, facing) {
  const p = tileToPixel(col, row);
  world.state.thief.x = p.x;
  world.state.thief.y = p.y;
  world.state.thief.facing = facing;
  world.state.thief.sneaking = true;
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the best score
 * to show, and a red-flash strength (0 for none).
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset(0);
  state.time = 7.3;

  if (name === 'start') {
    return { screen: SCREEN_TITLE, best: 0, flash: 0 };
  }

  if (name === 'win') {
    world.buildNight(2);
    state.time = 12.0;
    state.nightsCleared = 3;
    state.score = 2840;
    state.nightScore = 940;
    state.smallTaken = 6;
    state.vaultTaken = true;
    state.spottedTotal = 0;
    state.spottedThisNight = false;
    for (const item of state.loot.small) item.taken = true;
    state.loot.vault.cracked = true;
    state.won = true;
    return { screen: SCREEN_HEIST_DONE, best: 2840, flash: 0 };
  }

  if (name === 'alarm') {
    state.time = 12.0;
    state.alarm = 82;
    state.band = 'lockdown';
    state.lockdownUntil = state.time + 3;
    placeThief(world, 16, 10, Math.PI);
    placeGuard(state.guards[0], 13, 10, 0, MODE_CHASE, 1);
    state.guards[0].lastKnown = { x: state.thief.x, y: state.thief.y };
    placeGuard(state.guards[1], 28, 8, Math.PI, MODE_SUSPICIOUS, 0.55);
    placeGuard(state.guards[2], 10, 16, Math.PI / 2, MODE_PATROL, 0.1);
    state.cameras[0].facing = 2.6;
    state.cameras[1].facing = Math.PI;
    state.cameras[1].seeing = true;
    state.smallTaken = 3;
    state.loot.small[0].taken = true;
    state.loot.small[1].taken = true;
    state.loot.small[2].taken = true;
    state.score = 300;
    return { screen: SCREEN_PLAY, best: 0, flash: 0.9 };
  }

  // The money shot: mid-heist, everything in one frame — the room, three guards with
  // cones, two sweeping cameras, the glowing vault, loot on the floor, the alarm meter
  // mid-rise in amber, the HUD and the minimap.
  state.time = 7.3;
  state.alarm = 45;
  state.band = 'hunted';
  placeThief(world, 13, 10, 0);
  placeGuard(state.guards[0], 9, 8, 0, MODE_PATROL, 0.3);
  placeGuard(state.guards[1], 30, 6, Math.PI / 2, MODE_PATROL, 0);
  placeGuard(state.guards[2], 14, 16, Math.PI, MODE_PATROL, 0.12);
  state.cameras[0].facing = 2.6;
  state.cameras[1].facing = Math.PI;
  state.loot.small[0].taken = true;
  state.loot.small[1].taken = true;
  state.smallTaken = 2;
  state.score = 200;
  return { screen: SCREEN_PLAY, best: 0, flash: 0 };
}
