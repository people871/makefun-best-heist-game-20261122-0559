// Guard AI: a five-state finite machine (patrol, suspicious, investigate, chase,
// search) with graduated suspicion, raycast vision and positional hearing.
// A guard never sees through a wall and never alarms on a noise alone — a noise only
// makes it suspicious and sends it to look.
import { FIELD, GRID_Y, GUARD, THIEF } from './config.js';
import { isWalkable, lineClear, tileToPixel } from './level.js';

export const MODE_PATROL = 'patrol';
export const MODE_SUSPICIOUS = 'suspicious';
export const MODE_CHASE = 'chase';
export const MODE_SEARCH = 'search';

export const GUARD_EVENT_SPOTTED = 1;
export const GUARD_EVENT_CAUGHT = 2;

function angleTo(x0, y0, x1, y1) {
  return Math.atan2(y1 - y0, x1 - x0);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.facing = Math.atan2(dy, dx);
  return dist - step < 2;
}

export function createGuard(def, index, night) {
  const points = def.waypoints.map(([col, row]) => tileToPixel(col, row));
  const start = points[0];
  return {
    name: def.name,
    color: def.color,
    index,
    x: start.x,
    y: start.y,
    facing: 0,
    mode: MODE_PATROL,
    suspicion: 0,
    waypoints: points,
    waypointIndex: 1,
    pauseTimer: 0,
    scanPhase: index * 2.1,
    lastKnown: { x: start.x, y: start.y },
    lastSeen: -99,
    loseTimer: 0,
    searchTimer: 0,
    searchAngle: 0,
    investigate: null,
    speed: GUARD.patrolSpeed * night.speed,
    chaseSpeed: GUARD.chaseSpeed * night.speed,
    spotted: false,
  };
}

// One visibility test: range, cone angle and a clear line past the walls — all three,
// or the guard does not see the thief. `visibility` is the thief's 0..1 exposure
// (1 standing in light, less sneaking / in shadow, 0 hidden).
export function guardSees(guard, thiefX, thiefY, visibility, rangeScale) {
  if (visibility <= 0) return false;
  const dx = thiefX - guard.x;
  const dy = thiefY - guard.y;
  const dist = Math.hypot(dx, dy);
  const range = GUARD.range * rangeScale * (0.55 + 0.45 * visibility);
  if (dist > range) return false;
  const toThief = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toThief, guard.facing)) > GUARD.halfAngle) return false;
  return lineClear(guard.x, guard.y, thiefX, thiefY);
}

// How fast suspicion fills at this distance: ~1.2 s point-blank, ~3 s at max range.
function fillRate(dist, range, visibility, nightFill) {
  const t = Math.min(1, dist / range);
  const base = GUARD.fillPointBlank + (GUARD.fillMaxRange - GUARD.fillPointBlank) * t;
  return base * visibility * nightFill;
}

export function stepGuard(guard, dt, ctx) {
  let events = 0;
  const now = ctx.time;
  const range = GUARD.range * ctx.night.range;
  const scale = ctx.speedScale ?? 1;
  // Hidden in a vent: a guard only spots the thief if it is almost on top of it.
  let seen;
  if (ctx.thiefHidden) {
    const dx = ctx.thiefX - guard.x;
    const dy = ctx.thiefY - guard.y;
    const d = Math.hypot(dx, dy);
    seen = d <= THIEF.hideRadius
      && Math.abs(angleDiff(Math.atan2(dy, dx), guard.facing)) <= GUARD.halfAngle
      && lineClear(guard.x, guard.y, ctx.thiefX, ctx.thiefY);
  } else {
    seen = guardSees(guard, ctx.thiefX, ctx.thiefY, ctx.thiefVisibility, ctx.night.range);
  }
  if (seen) ctx.anyoneSees = true;
  const distToThief = Math.hypot(ctx.thiefX - guard.x, ctx.thiefY - guard.y);

  if (seen) {
    guard.suspicion = Math.min(1, guard.suspicion + fillRate(distToThief, range, ctx.thiefVisibility, ctx.night.fill) * dt);
    guard.lastKnown = { x: ctx.thiefX, y: ctx.thiefY };
    guard.lastSeen = now;
    guard.loseTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - GUARD.drain * dt);
    if (guard.mode === MODE_CHASE) guard.loseTimer += dt;
  }

  // Hearing: a noise inside earshot (halved through a wall) turns the guard toward it.
  // Noise alone never raises the alarm and never starts a chase.
  if (guard.mode === MODE_PATROL || guard.mode === MODE_SUSPICIOUS) {
    for (const noise of ctx.noises) {
      const d = Math.hypot(noise.x - guard.x, noise.y - guard.y);
      const blocked = !lineClear(guard.x, guard.y, noise.x, noise.y);
      const reach = blocked ? noise.radius * 0.5 : noise.radius;
      if (d <= reach) {
        guard.investigate = { x: noise.x, y: noise.y, until: now + 4 };
        guard.mode = MODE_SUSPICIOUS;
        break;
      }
    }
  }

  if (guard.suspicion >= 1 && guard.mode !== MODE_CHASE) {
    guard.mode = MODE_CHASE;
    guard.loseTimer = 0;
    if (!guard.spotted) {
      guard.spotted = true;
      events |= GUARD_EVENT_SPOTTED;
    }
  } else if (guard.suspicion >= GUARD.suspiciousAt && guard.mode === MODE_PATROL) {
    guard.mode = MODE_SUSPICIOUS;
  }

  switch (guard.mode) {
    case MODE_PATROL: {
      guard.spotted = false;
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        // Scan slowly left and right while standing at a post.
        guard.facing += Math.sin(now * 0.9 + guard.scanPhase) * 0.35 * dt;
        break;
      }
      const target = guard.waypoints[guard.waypointIndex];
      const arrived = moveToward(guard, target.x, target.y, guard.speed * scale, dt);
      if (arrived) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = GUARD.pauseAtWaypoint;
      }
      break;
    }
    case MODE_SUSPICIOUS: {
      const target = guard.investigate ?? guard.lastKnown;
      const arrived = moveToward(guard, target.x, target.y, GUARD.investigateSpeed * ctx.night.speed * scale, dt);
      if (arrived || (guard.investigate && now > guard.investigate.until)) {
        guard.investigate = null;
        if (guard.suspicion < GUARD.suspiciousAt) {
          guard.mode = MODE_PATROL;
        } else {
          guard.searchTimer = GUARD.searchTime;
          guard.searchAngle = 0;
          guard.mode = MODE_SEARCH;
        }
      }
      break;
    }
    case MODE_CHASE: {
      moveToward(guard, ctx.thiefX, ctx.thiefY, guard.chaseSpeed * scale, dt);
      if (distToThief < GUARD.catchDistance) events |= GUARD_EVENT_CAUGHT;
      if (guard.loseTimer >= GUARD.loseSight) {
        guard.mode = MODE_SEARCH;
        guard.searchTimer = GUARD.searchTime;
        guard.searchAngle = 0;
      }
      break;
    }
    case MODE_SEARCH: {
      guard.searchTimer -= dt;
      guard.searchAngle += dt * 0.9;
      const tx = guard.lastKnown.x + Math.cos(guard.searchAngle) * 64;
      const ty = guard.lastKnown.y + Math.sin(guard.searchAngle) * 64;
      const tile = { col: Math.floor(tx / FIELD.tile), row: Math.floor((ty - GRID_Y) / FIELD.tile) };
      if (isWalkable(tile.col, tile.row)) moveToward(guard, tx, ty, GUARD.searchSpeed * ctx.night.speed * scale, dt);
      guard.facing += dt * 1.4;
      if (guard.searchTimer <= 0) {
        guard.mode = MODE_PATROL;
        guard.suspicion = 0;
        // Walk back to the nearest waypoint instead of cutting across the room.
        let best = 0;
        let bestDist = Infinity;
        guard.waypoints.forEach((p, i) => {
          const d = Math.hypot(p.x - guard.x, p.y - guard.y);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        guard.waypointIndex = best;
      }
      break;
    }
    default:
      break;
  }

  return events;
}
