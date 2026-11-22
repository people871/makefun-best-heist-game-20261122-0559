// MIDNIGHT VAULT's rules and state, with no drawing and no browser in it: the thief,
// the guards, the cameras, the loot, the vault, the alarm meter and the three nights.
// step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sounds, banners) without the world knowing about screens or sound.
import { ALARM, CAMERA, FIELD, GUARD, GUARD_DEFS, CAMERA_DEFS, LOOT, NIGHTS, NIGHT_TIME, SCORE, STEP, THIEF } from './config.js';
import { createCamera, cameraSees, disableCamera, isCameraDisabled, stepCamera } from './cameras.js';
import { createGuard, stepGuard, GUARD_EVENT_CAUGHT, GUARD_EVENT_SPOTTED, MODE_SUSPICIOUS } from './guards.js';
import { collideCircle, findTiles, isHideTile, isShadowTile, isWalkable, pixelToTile, tileToPixel } from './level.js';

export const EVENT_PICKUP = 1;
export const EVENT_VAULT = 2;
export const EVENT_SPOTTED = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN_NIGHT = 16;
export const EVENT_HEIST_DONE = 32;
export const EVENT_TIMEOUT = 64;
export const EVENT_COIN = 128;
export const EVENT_BAND_UP = 256;
export const EVENT_BOX = 512;
export const EVENT_EXIT_LOCKED = 1024;

export function alarmBand(alarm) {
  if (alarm >= ALARM.lockdownAt) return 'lockdown';
  if (alarm >= ALARM.huntedAt) return 'hunted';
  return 'calm';
}

function makeLoot(random) {
  const small = findTiles('*').map((t) => {
    const p = tileToPixel(t.col, t.row);
    return { x: p.x, y: p.y, taken: false, bob: random() * Math.PI * 2 };
  });
  const vaultTile = findTiles('V')[0];
  const vaultPos = tileToPixel(vaultTile.col, vaultTile.row);
  const boxTile = findTiles('B')[0];
  const boxPos = tileToPixel(boxTile.col, boxTile.row);
  const startTile = findTiles('S')[0];
  const startPos = tileToPixel(startTile.col, startTile.row);
  const exitTile = findTiles('E')[0];
  const exitPos = tileToPixel(exitTile.col, exitTile.row);
  return { small, vault: { ...vaultPos, cracked: false, progress: 0 }, box: { ...boxPos }, start: startPos, exit: exitPos };
}

export function createWorld(random) {
  const state = {
    night: 0,
    nightName: NIGHTS[0].name,
    time: 0,
    timeLeft: NIGHT_TIME,
    alarm: 0,
    band: 'calm',
    lockdownUntil: -1,
    reinforcement: null,
    thief: { x: 0, y: 0, facing: 0, sneaking: false, moving: false, stepTimer: 0 },
    guards: [],
    cameras: [],
    loot: null,
    smallTaken: 0,
    vaultTaken: false,
    coins: THIEF.coins,
    flyingCoin: null,
    score: 0,
    nightScore: 0,
    spottedThisNight: false,
    spottedTotal: 0,
    nightsCleared: 0,
    lastNight: null,
    particles: [],
    message: '',
    messageUntil: -1,
    interactTarget: null,
    interactProgress: 0,
    over: false,
    won: false,
  };

  function buildNight(nightIndex) {
    const night = NIGHTS[nightIndex];
    state.night = nightIndex;
    state.nightName = night.name;
    state.time = 0;
    state.timeLeft = NIGHT_TIME;
    state.alarm = 0;
    state.band = 'calm';
    state.lockdownUntil = -1;
    state.reinforcement = null;
    state.loot = makeLoot(random);
    state.thief.x = state.loot.start.x;
    state.thief.y = state.loot.start.y;
    state.thief.facing = 0;
    state.thief.sneaking = false;
    state.thief.moving = false;
    state.guards = GUARD_DEFS.map((def, i) => createGuard(def, i, night));
    state.cameras = CAMERA_DEFS.map((def, i) => createCamera(def, i, night));
    state.smallTaken = 0;
    state.vaultTaken = false;
    state.coins = THIEF.coins;
    state.flyingCoin = null;
    state.nightScore = 0;
    state.spottedThisNight = false;
    state.particles = [];
    state.message = '';
    state.messageUntil = -1;
    state.interactTarget = null;
    state.interactProgress = 0;
    state.over = false;
    state.won = false;
  }

  function reset(nightIndex = 0) {
    state.score = 0;
    state.nightsCleared = 0;
    state.spottedTotal = 0;
    buildNight(nightIndex);
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 40 + random() * 90;
      state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.5 + random() * 0.3, maxLife: 0.8, color });
    }
  }

  function thiefVisibility() {
    const tile = pixelToTile(state.thief.x, state.thief.y);
    if (isHideTile(tile.col, tile.row)) return 0;
    if (isShadowTile(tile.col, tile.row)) return THIEF.shadowVisibility;
    return state.thief.sneaking ? THIEF.sneakVisibility : 1;
  }

  function thiefHidden() {
    const tile = pixelToTile(state.thief.x, state.thief.y);
    return isHideTile(tile.col, tile.row);
  }

  // One fixed step. `input` is { moveX, moveY, sneak, interact, throwTo }.
  // The step is sub-stepped at <= 1/30 s so a slow frame can never tunnel the thief
  // through a wall or past a guard.
  function step(dt, input) {
    let events = 0;
    let remaining = dt;
    while (remaining > 0) {
      const slice = Math.min(remaining, 1 / 30);
      events |= stepSlice(slice, input);
      remaining -= slice;
      if (state.over || state.won || (events & EVENT_WIN_NIGHT)) break;
    }
    return events;
  }

  function stepSlice(dt, input) {
    let events = 0;
    const night = NIGHTS[state.night];
    state.time += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.over = true;
      return events | EVENT_TIMEOUT;
    }

    const thief = state.thief;
    const speed = input.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    const mag = Math.hypot(input.moveX, input.moveY);
    thief.sneaking = input.sneak;
    thief.moving = mag > 0.1;
    if (thief.moving) {
      const nx = input.moveX / (mag || 1);
      const ny = input.moveY / (mag || 1);
      thief.facing = Math.atan2(ny, nx);
      const moved = collideCircle(thief.x + nx * speed * dt, thief.y + ny * speed * dt, THIEF.radius);
      thief.x = moved.x;
      thief.y = moved.y;
      // Footsteps: walking is loud enough for a nearby guard to hear, sneaking is not.
      thief.stepTimer -= dt;
      if (thief.stepTimer <= 0) {
        thief.stepTimer = THIEF.stepInterval;
        state.noises.push({ x: thief.x, y: thief.y, radius: input.sneak ? THIEF.sneakNoise : THIEF.walkNoise });
      }
    }

    // Coin toss: click (or F) throws one of three coins at the pointer. It flies, lands
    // with a clink, and the nearest guard in earshot goes to look — a noise, never an alarm.
    if (input.throwTo && state.coins > 0 && !state.flyingCoin) {
      const dx = input.throwTo.x - thief.x;
      const dy = input.throwTo.y - thief.y;
      const dist = Math.min(Math.hypot(dx, dy), THIEF.coinRange);
      const angle = Math.atan2(dy, dx);
      state.coins -= 1;
      state.flyingCoin = { sx: thief.x, sy: thief.y, x: thief.x, y: thief.y, tx: thief.x + Math.cos(angle) * dist, ty: thief.y + Math.sin(angle) * dist, t: 0, duration: Math.max(0.15, dist / 520) };
      events |= EVENT_COIN;
    }
    if (state.flyingCoin) {
      const coin = state.flyingCoin;
      coin.t += dt;
      const k = Math.min(1, coin.t / coin.duration);
      coin.x = coin.sx + (coin.tx - coin.sx) * k;
      coin.y = coin.sy + (coin.ty - coin.sy) * k;
      if (k >= 1) {
        state.noises.push({ x: coin.x, y: coin.y, radius: THIEF.coinNoise });
        state.flyingCoin = null;
      }
    }

    // Small loot: walk over it to pocket it.
    for (const item of state.loot.small) {
      if (item.taken) continue;
      if (Math.hypot(item.x - thief.x, item.y - thief.y) < THIEF.radius + 14) {
        item.taken = true;
        state.smallTaken += 1;
        state.nightScore += LOOT.small;
        state.score += LOOT.small;
        burst(item.x, item.y, '#ffd94d', 10);
        events |= EVENT_PICKUP;
      }
    }

    // Hold E at the vault to crack it (2 s) or at the power box to cut a camera (1.5 s).
    const vaultDist = Math.hypot(state.loot.vault.x - thief.x, state.loot.vault.y - thief.y);
    const boxDist = Math.hypot(state.loot.box.x - thief.x, state.loot.box.y - thief.y);
    let target = null;
    if (!state.loot.vault.cracked && vaultDist < THIEF.interactRange + 22) target = 'vault';
    else if (boxDist < THIEF.interactRange) target = 'box';
    if (input.interact && target) {
      if (state.interactTarget !== target) {
        state.interactTarget = target;
        state.interactProgress = 0;
      }
      state.interactProgress += dt / (target === 'vault' ? THIEF.vaultHold : THIEF.boxHold);
      if (state.interactProgress >= 1) {
        if (target === 'vault') {
          state.loot.vault.cracked = true;
          state.vaultTaken = true;
          state.nightScore += LOOT.vault;
          state.score += LOOT.vault;
          burst(state.loot.vault.x, state.loot.vault.y, '#f2c94c', 18);
          events |= EVENT_VAULT;
        } else {
          let nearest = null;
          let nearestDist = Infinity;
          for (const camera of state.cameras) {
            const d = Math.hypot(camera.x - thief.x, camera.y - thief.y);
            if (d < nearestDist) {
              nearestDist = d;
              nearest = camera;
            }
          }
          if (nearest && nearestDist < 560) {
            disableCamera(nearest, state.time);
            events |= EVENT_BOX;
          }
        }
        state.interactTarget = null;
        state.interactProgress = 0;
      }
    } else {
      state.interactTarget = null;
      state.interactProgress = 0;
    }

    // The exit: open only with the vault loot or four small loot — and never while the
    // alarm has the doors sealed.
    const exitDist = Math.hypot(state.loot.exit.x - thief.x, state.loot.exit.y - thief.y);
    const exitSealed = state.time < state.lockdownUntil;
    if (exitDist < 26) {
      if (exitSealed) {
        if (state.time > state.messageUntil) {
          state.message = 'EXIT SEALED — wait out the lockdown';
          state.messageUntil = state.time + 2;
        }
      } else if (state.vaultTaken || state.smallTaken >= LOOT.needSmall) {
        const timeBonus = Math.round(state.timeLeft) * SCORE.timeBonusPerSecond;
        state.nightScore += timeBonus;
        state.score += timeBonus;
        if (!state.spottedThisNight) {
          state.nightScore += SCORE.ghostBonus;
          state.score += SCORE.ghostBonus;
        }
        state.nightsCleared += 1;
        // Keep the cleared night's numbers: buildNight wipes the live ones.
        state.lastNight = {
          name: NIGHTS[state.night].name,
          nightScore: state.nightScore,
          loot: state.smallTaken + (state.vaultTaken ? 1 : 0),
          spotted: state.spottedThisNight,
          nextName: state.night + 1 < NIGHTS.length ? NIGHTS[state.night + 1].name : '',
        };
        if (state.night >= NIGHTS.length - 1) {
          state.won = true;
          return events | EVENT_HEIST_DONE;
        }
        buildNight(state.night + 1);
        return events | EVENT_WIN_NIGHT;
      } else if (state.time > state.messageUntil) {
        state.message = `Need the vault loot or ${LOOT.needSmall} loot — you have ${state.smallTaken}`;
        state.messageUntil = state.time + 2;
        events |= EVENT_EXIT_LOCKED;
      }
    }

    // Cameras sweep and watch; while one sees the thief the alarm climbs fast.
    let anyoneSees = false;
    for (const camera of state.cameras) {
      stepCamera(camera, state.time);
      camera.seeing = cameraSees(camera, thief.x, thief.y, thiefVisibility(), state.time);
      if (camera.seeing) {
        anyoneSees = true;
        state.alarm = Math.min(100, state.alarm + CAMERA.alarmPerSecond * dt);
        camera.flash = 0.2;
      } else if (camera.flash > 0) {
        camera.flash -= dt;
      }
    }

    // Guards patrol, suspect, chase and search. A full suspicion radios the alarm.
    const hidden = thiefHidden();
    const visibility = thiefVisibility();
    const ctx = {
      time: state.time,
      thiefX: thief.x,
      thiefY: thief.y,
      thiefVisibility: visibility,
      thiefHidden: hidden,
      noises: state.noises,
      night,
      anyoneSees,
      speedScale: state.band === 'hunted' || state.band === 'lockdown' ? GUARD.huntedSpeed : 1,
    };
    for (const guard of state.guards) {
      const guardEvents = stepGuard(guard, dt, ctx);
      if (guardEvents & GUARD_EVENT_SPOTTED) {
        state.alarm = Math.min(100, state.alarm + ALARM.spotAdd);
        state.spottedThisNight = true;
        state.spottedTotal += 1;
        events |= EVENT_SPOTTED;
        // Radio: guards in earshot turn toward the thief's last-known spot.
        for (const other of state.guards) {
          if (other === guard) continue;
          if (Math.hypot(other.x - guard.x, other.y - guard.y) < GUARD.radioRadius) {
            other.mode = MODE_SUSPICIOUS;
            other.investigate = { x: thief.x, y: thief.y, until: state.time + 4 };
          }
        }
      }
      if (guardEvents & GUARD_EVENT_CAUGHT) {
        state.over = true;
        return events | EVENT_CAUGHT;
      }
    }
    anyoneSees = ctx.anyoneSees;
    state.noises = [];

    // The alarm decays when nobody sees the thief at all.
    if (!anyoneSees) {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * night.decay * dt);
    }

    // Bands: hunted guards move faster; lockdown seals the exit and calls a fourth guard.
    const band = alarmBand(state.alarm);
    if (band !== state.band) {
      const order = { calm: 0, hunted: 1, lockdown: 2 };
      if (order[band] > order[state.band]) events |= EVENT_BAND_UP;
      state.band = band;
      if (band === 'lockdown') {
        state.lockdownUntil = state.time + ALARM.lockdownSeconds;
        if (!state.reinforcement) {
          const start = tileToPixel(2, 19);
          const extra = createGuard(
            { name: 'Rook-2', color: '#e86a4b', waypoints: [[2, 19], [10, 19], [10, 16], [2, 16]] },
            3,
            night,
          );
          extra.x = start.x;
          extra.y = start.y;
          state.guards.push(extra);
          state.reinforcement = extra;
        }
      }
    }

    // Particles fade out.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    return events;
  }

  state.noises = [];
  reset(0);
  return { state, reset, step, buildNight };
}
