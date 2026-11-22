// Scripted self-test for MIDNIGHT VAULT. Runs in the page (?selftest=1) against the
// real world module — no mocks, no DOM beyond the canvas — and reports every check on
// window.__selftest so the capture harness can read it. Each check states its setup
// before it runs, so a failure names the broken rule.
import { FIELD, GUARD_DEFS, LOOT, MAP, NIGHTS, STEP, THIEF } from './config.js';
import { createRandom } from './random.js';
import { findTiles, isWalkable, lineClear, reachableFrom, tileToPixel } from './level.js';
import { createGuard, MODE_CHASE, MODE_PATROL, MODE_SEARCH, MODE_SUSPICIOUS } from './guards.js';
import {
  EVENT_BOX,
  EVENT_CAUGHT,
  EVENT_TIMEOUT,
  EVENT_VAULT,
  EVENT_WIN_NIGHT,
  createWorld,
} from './world.js';

const IDLE = { moveX: 0, moveY: 0, sneak: false, interact: false, throwTo: null };

function run(world, seconds, input = IDLE) {
  let events = 0;
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) events |= world.step(STEP, input);
  return events;
}

function atTile(world, col, row, facing = 0) {
  const p = tileToPixel(col, row);
  world.state.thief.x = p.x;
  world.state.thief.y = p.y;
  world.state.thief.facing = facing;
}

function guardAt(world, index, col, row, facing = 0) {
  const p = tileToPixel(col, row);
  const guard = world.state.guards[index];
  guard.x = p.x;
  guard.y = p.y;
  guard.facing = facing;
  guard.mode = MODE_PATROL;
  guard.suspicion = 0;
  guard.pauseTimer = 99;
  return guard;
}

export function runSelfTest() {
  const checks = [];
  function check(name, pass, detail = '') {
    checks.push({ name, pass: !!pass, detail: String(detail) });
  }

  // --- The floor ---
  check('mapRowsValid', MAP.length === 21 && MAP.every((r) => r.length === 40), `${MAP.length} rows`);
  const counts = {};
  for (const row of MAP) for (const c of row) counts[c] = (counts[c] || 0) + 1;
  check('mapCounts', counts['*'] === 6 && counts.V === 1 && counts.E === 1 && counts.S === 1 && counts.B === 1 && counts.H === 2, JSON.stringify(counts));
  const start = findTiles('S')[0];
  const reach = reachableFrom(start.col, start.row);
  const vault = findTiles('V')[0];
  const vaultNextTo = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => reach.has(`${vault.col + dc},${vault.row + dr}`));
  check('reachableVault', vaultNextTo, `vault at ${vault.col},${vault.row}`);
  const exit = findTiles('E')[0];
  check('reachableExit', reach.has(`${exit.col},${exit.row}`), `exit at ${exit.col},${exit.row}`);
  check('reachableAllLoot', findTiles('*').every((t) => reach.has(`${t.col},${t.row}`)), '6 loot tiles');
  check(
    'waypointsWalkable',
    GUARD_DEFS.every((def) => def.waypoints.every(([c, r]) => isWalkable(c, r))),
    'all waypoints on floor',
  );
  check(
    'patrolCorridorsClear',
    GUARD_DEFS.every((def) => {
      const pts = def.waypoints.map(([c, r]) => tileToPixel(c, r));
      for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (!lineClear(a.x, a.y, b.x, b.y)) return false;
      }
      return true;
    }),
    'no patrol leg crosses a wall',
  );

  // --- Movement ---
  let world = createWorld(createRandom(42));
  const startX = world.state.thief.x;
  run(world, 0.5, { ...IDLE, moveX: 1 });
  check('thiefMovesRight', world.state.thief.x > startX + 20, `x ${startX} -> ${world.state.thief.x.toFixed(1)}`);
  world = createWorld(createRandom(42));
  const startY = world.state.thief.y;
  run(world, 0.5, { ...IDLE, moveY: -1 });
  check('thiefMovesUp', world.state.thief.y < startY - 20, `y ${startY} -> ${world.state.thief.y.toFixed(1)}`);
  world = createWorld(createRandom(42));
  const walkStart = world.state.thief.x;
  run(world, 1, { ...IDLE, moveX: 1 });
  const walkDist = world.state.thief.x - walkStart;
  world = createWorld(createRandom(42));
  const sneakStart = world.state.thief.x;
  run(world, 1, { ...IDLE, moveX: 1, sneak: true });
  const sneakDist = world.state.thief.x - sneakStart;
  check('sneakSlowerThanWalk', sneakDist > 10 && sneakDist < walkDist * 0.7, `walk ${walkDist.toFixed(0)} vs sneak ${sneakDist.toFixed(0)}`);
  world = createWorld(createRandom(42));
  run(world, 1, { ...IDLE, moveX: -1 });
  check('wallBlocksMovement', world.state.thief.x >= 43 - 0.5, `x ${world.state.thief.x.toFixed(1)} (wall edge 43)`);

  // --- Guards ---
  world = createWorld(createRandom(42));
  const guardStart = { x: world.state.guards[0].x, y: world.state.guards[0].y };
  run(world, 2);
  const guardMoved = Math.hypot(world.state.guards[0].x - guardStart.x, world.state.guards[0].y - guardStart.y);
  check('guardPatrols', guardMoved > 30, `moved ${guardMoved.toFixed(0)} px in 2 s`);

  world = createWorld(createRandom(42));
  guardAt(world, 0, 4, 5, 0);
  atTile(world, 8, 5, 0);
  run(world, 3);
  check('coneDetectsInOpen', world.state.guards[0].suspicion > 0.35, `suspicion ${world.state.guards[0].suspicion.toFixed(2)} after 3 s`);

  world = createWorld(createRandom(42));
  guardAt(world, 0, 6, 6, 0);
  atTile(world, 11, 6, 0);
  run(world, 2);
  check('crateBlocksSight', world.state.guards[0].suspicion === 0, `suspicion ${world.state.guards[0].suspicion.toFixed(2)} behind a crate`);

  world = createWorld(createRandom(42));
  guardAt(world, 0, 4, 7, 0);
  atTile(world, 8, 7, 0);
  run(world, 1.5);
  const openSuspicion = world.state.guards[0].suspicion;
  world = createWorld(createRandom(42));
  guardAt(world, 0, 4, 8, 0);
  atTile(world, 8, 8, 0);
  run(world, 1.5);
  const shadowSuspicion = world.state.guards[0].suspicion;
  check('shadowReducesDetection', shadowSuspicion < openSuspicion * 0.6, `open ${openSuspicion.toFixed(2)} vs shadow ${shadowSuspicion.toFixed(2)}`);

  world = createWorld(createRandom(42));
  guardAt(world, 2, 4, 17, 0);
  atTile(world, 6, 17, 0);
  run(world, 2);
  check('hideHidesThief', world.state.guards[2].suspicion === 0, `suspicion ${world.state.guards[2].suspicion.toFixed(2)} on a vent`);

  // --- Coins and noise ---
  world = createWorld(createRandom(42));
  const before = world.state.coins;
  run(world, 0.1, { ...IDLE, throwTo: { x: world.state.thief.x + 100, y: world.state.thief.y } });
  check('coinThrowSpendsOne', world.state.coins === before - 1 && world.state.flyingCoin !== null, `coins ${before} -> ${world.state.coins}`);
  world = createWorld(createRandom(42));
  atTile(world, 6, 17, 0);
  const knight = guardAt(world, 2, 10, 17, Math.PI);
  knight.pauseTimer = 0;
  let everSuspicious = false;
  run(world, 0.1, { ...IDLE, throwTo: { x: world.state.thief.x + 192, y: world.state.thief.y } });
  for (let i = 0; i < 15; i += 1) {
    run(world, 0.1);
    if (world.state.guards[2].mode === MODE_SUSPICIOUS) everSuspicious = true;
  }
  check('coinDistractsGuard', everSuspicious, 'guard went suspicious at the clink');

  // --- Loot, vault, power ---
  world = createWorld(createRandom(42));
  atTile(world, 6, 2, 0);
  run(world, 0.2);
  check('lootPickupIncrements', world.state.smallTaken === 1 && world.state.score === LOOT.small, `loot ${world.state.smallTaken}, score ${world.state.score}`);
  world = createWorld(createRandom(42));
  atTile(world, 35, 2, 0);
  const vaultEvents = run(world, 2.2, { ...IDLE, interact: true });
  check('vaultCrackGives500', world.state.vaultTaken && world.state.score >= LOOT.vault && (vaultEvents & EVENT_VAULT) !== 0, `vault ${world.state.vaultTaken}, score ${world.state.score}`);
  world = createWorld(createRandom(42));
  atTile(world, 28, 17, 0);
  run(world, 1.7, { ...IDLE, interact: true });
  const disabled = world.state.cameras.some((c) => world.state.time < c.disabledUntil);
  check('powerBoxDisablesCamera', disabled, 'a camera is off after holding E at the box');

  // --- Cameras and alarm ---
  world = createWorld(createRandom(42));
  atTile(world, 19, 10, 0);
  const alarmBefore = world.state.alarm;
  run(world, 3);
  check('cameraRaisesAlarm', world.state.alarm > alarmBefore, `alarm ${alarmBefore} -> ${world.state.alarm.toFixed(1)}`);
  world = createWorld(createRandom(42));
  for (const g of world.state.guards) {
    g.x = 80;
    g.y = 112;
    g.pauseTimer = 99;
    g.mode = MODE_PATROL;
    g.suspicion = 0;
  }
  atTile(world, 36, 19, 0);
  world.state.alarm = 50;
  run(world, 2);
  check('alarmDecays', world.state.alarm < 48, `alarm 50 -> ${world.state.alarm.toFixed(1)} unseen`);
  world = createWorld(createRandom(42));
  world.state.alarm = 75;
  run(world, 0.2);
  check(
    'lockdownSealsExit',
    world.state.band === 'lockdown' && world.state.lockdownUntil > world.state.time && world.state.guards.length === 4,
    `band ${world.state.band}, guards ${world.state.guards.length}`,
  );
  world = createWorld(createRandom(42));
  const guard0 = world.state.guards[0];
  guard0.mode = MODE_CHASE;
  guard0.suspicion = 1;
  world.state.thief.x = guard0.x + 10;
  world.state.thief.y = guard0.y;
  const caughtEvents = run(world, 0.1);
  check('caughtWhenTouched', (caughtEvents & EVENT_CAUGHT) !== 0 && world.state.over, 'touch during chase ends the night');

  // --- Win, lose, nights ---
  world = createWorld(createRandom(42));
  world.state.smallTaken = 4;
  atTile(world, 37, 19, 0);
  const winEvents = run(world, 0.1);
  check('exitWinsWithLoot', (winEvents & EVENT_WIN_NIGHT) !== 0, '4 loot + exit = night clear');
  world = createWorld(createRandom(42));
  atTile(world, 37, 19, 0);
  const blockedEvents = run(world, 0.1);
  check('exitBlockedWithoutLoot', (blockedEvents & EVENT_WIN_NIGHT) === 0 && world.state.message.length > 0, `message: "${world.state.message}"`);
  world = createWorld(createRandom(42));
  world.state.timeLeft = 0.05;
  const timeoutEvents = run(world, 0.2);
  check('timeoutEndsNight', (timeoutEvents & EVENT_TIMEOUT) !== 0 && world.state.over, 'timer at zero ends the night');
  world = createWorld(createRandom(42));
  const g1 = createGuard(GUARD_DEFS[0], 0, NIGHTS[0]);
  const g2 = createGuard(GUARD_DEFS[0], 0, NIGHTS[1]);
  check('night2Faster', g2.speed > g1.speed, `night 1 ${g1.speed} vs night 2 ${g2.speed.toFixed(1)} px/s`);

  // --- Suspicion dynamics ---
  world = createWorld(createRandom(42));
  const drainGuard = world.state.guards[0];
  drainGuard.suspicion = 0.8;
  drainGuard.mode = MODE_PATROL;
  drainGuard.pauseTimer = 99;
  atTile(world, 36, 19, 0);
  run(world, 4);
  check('suspicionDrains', drainGuard.suspicion < 0.1, `suspicion 0.8 -> ${drainGuard.suspicion.toFixed(2)} unseen`);
  world = createWorld(createRandom(42));
  const searchGuard = world.state.guards[0];
  searchGuard.mode = MODE_CHASE;
  searchGuard.suspicion = 1;
  atTile(world, 36, 19, 0);
  run(world, 3.5);
  check('searchAfterLosingSight', searchGuard.mode === MODE_SEARCH, `mode ${searchGuard.mode} after 3.5 s blind`);
  world = createWorld(createRandom(42));
  const coinGuard = world.state.guards[0];
  coinGuard.mode = MODE_PATROL;
  coinGuard.suspicion = 0;
  atTile(world, 6, 17, 0);
  run(world, 0.1, { ...IDLE, throwTo: { x: world.state.thief.x + 192, y: world.state.thief.y } });
  run(world, 2);
  check('noiseNeverAlarmsAlone', world.state.alarm === 0, `alarm ${world.state.alarm} after a coin clink`);

  // --- Determinism and reset ---
  function scripted(seed) {
    const w = createWorld(createRandom(seed));
    run(w, 1, { ...IDLE, moveX: 1 });
    run(w, 1, { ...IDLE, moveX: 1, sneak: true });
    run(w, 0.1, { ...IDLE, throwTo: { x: w.state.thief.x + 100, y: w.state.thief.y } });
    run(w, 2, { ...IDLE, moveY: -1 });
    run(w, 2, { ...IDLE, moveX: -1, moveY: 1 });
    return w.state;
  }
  const a = scripted(42);
  const b = scripted(42);
  check(
    'determinism',
    a.thief.x === b.thief.x && a.thief.y === b.thief.y && a.alarm === b.alarm && a.score === b.score
      && a.guards.every((g, i) => g.x === b.guards[i].x && g.y === b.guards[i].y),
    `thief (${a.thief.x.toFixed(1)}, ${a.thief.y.toFixed(1)}) identical across runs`,
  );
  world = createWorld(createRandom(42));
  world.state.alarm = 60;
  world.state.smallTaken = 3;
  world.state.coins = 1;
  world.reset(0);
  check('restartResets', world.state.alarm === 0 && world.state.smallTaken === 0 && world.state.coins === THIEF.coins && world.state.night === 0, 'fresh night after reset');

  const passed = checks.filter((c) => c.pass).length;
  return { passed, failed: checks.length - passed, total: checks.length, checks };
}
