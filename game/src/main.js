// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, play, paused, caught, timeout,
// win-night and heist-done.
//
// ?seed=N fixes the random pattern. ?shot=play|start|alarm|win (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot. ?selftest=1 runs the scripted self-test and reports on
// window.__selftest.
import { BEST_KEY, NIGHTS, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BAND_UP,
  EVENT_BOX,
  EVENT_CAUGHT,
  EVENT_COIN,
  EVENT_EXIT_LOCKED,
  EVENT_HEIST_DONE,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_TIMEOUT,
  EVENT_VAULT,
  EVENT_WIN_NIGHT,
  createWorld,
} from './world.js';
import { ACTION_COIN, ACTION_CONFIRM, ACTION_LEVELS, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_HEIST_DONE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TIMEOUT,
  SCREEN_TITLE,
  SCREEN_WIN_NIGHT,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
let screen = SCREEN_TITLE;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, flash: scene.flash, muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runSelftestMode() {
  const result = runSelfTest();
  window.__selftest = result;
  const pre = document.createElement('pre');
  pre.id = 'selftest';
  pre.textContent = `SELFTEST ${result.passed}/${result.total} passed\n` + result.checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'} ${c.name} ${c.detail}`).join('\n');
  document.body.appendChild(pre);
  renderer.draw(world.state, SCREEN_TITLE, { best: 0, flash: 0, muted: false });
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let flash = 0;
  let stepSoundTimer = 0;
  let beepTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startNight(nightIndex) {
    world.reset(nightIndex);
    input.takeThrow();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startDrone();
    announce(`Playing ${NIGHTS[nightIndex].name}. Crack the vault, then reach the exit.`);
  }

  function endNightCaught(timeout) {
    screen = timeout ? SCREEN_TIMEOUT : SCREEN_CAUGHT;
    audio.caught();
    audio.stopDrone();
    announce(timeout ? "Time's up." : 'Caught.');
  }

  function finishHeist() {
    screen = SCREEN_HEIST_DONE;
    audio.win();
    audio.stopDrone();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Heist complete. Total score ${world.state.score}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_VAULT) audio.vault();
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_BOX) audio.box();
    if (events & EVENT_SPOTTED) {
      audio.alarm();
      flash = 0.85;
    }
    if (events & EVENT_BAND_UP) {
      audio.alarm();
      flash = 0.85;
    }
    if (events & EVENT_EXIT_LOCKED) audio.cameraBeep();
    if (events & EVENT_CAUGHT) endNightCaught(false);
    else if (events & EVENT_TIMEOUT) endNightCaught(true);
    else if (events & EVENT_HEIST_DONE) finishHeist();
    else if (events & EVENT_WIN_NIGHT) {
      screen = SCREEN_WIN_NIGHT;
      audio.win();
      announce(`${world.state.lastNight.name} clear.`);
    }
  }

  function step() {
    const move = input.move();
    const throwTarget = input.takeThrow();
    let throwTo = throwTarget;
    if (!throwTo && pendingCoin) {
      const thief = world.state.thief;
      throwTo = { x: thief.x + Math.cos(thief.facing) * 180, y: thief.y + Math.sin(thief.facing) * 180 };
      pendingCoin = false;
    }
    const events = world.step(STEP, {
      moveX: move.x,
      moveY: move.y,
      sneak: input.sneak,
      interact: input.interact,
      throwTo,
    });
    handleEvents(events);
    if (screen === SCREEN_PLAY) {
      if (world.state.thief.moving) {
        stepSoundTimer -= STEP;
        if (stepSoundTimer <= 0) {
          audio.footstep();
          stepSoundTimer = world.state.thief.sneaking ? 0.55 : 0.38;
        }
      }
      const anyCameraSees = world.state.cameras.some((c) => c.seeing);
      if (anyCameraSees) {
        beepTimer -= STEP;
        if (beepTimer <= 0) {
          audio.cameraBeep();
          beepTimer = 0.5;
        }
      }
    }
  }

  let pendingCoin = false;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_COIN) pendingCoin = true;
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      const digit = input.takeDigit();
      if (actions & ACTION_CONFIRM) startNight(0);
      else if (digit !== null && digit >= 1 && digit <= 3) startNight(digit - 1);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startNight(world.state.night);
      } else if (actions & ACTION_LEVELS) {
        screen = SCREEN_TITLE;
        audio.stopDrone();
        announce('Midnight Vault. Press Space or click to start.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startNight(world.state.night);
      } else if (actions & ACTION_LEVELS) {
        screen = SCREEN_TITLE;
        audio.stopDrone();
      }
    } else if (screen === SCREEN_CAUGHT || screen === SCREEN_TIMEOUT) {
      if (actions & ACTION_RESTART) startNight(world.state.night);
      else if (actions & ACTION_LEVELS) {
        screen = SCREEN_TITLE;
        announce('Midnight Vault. Press Space or click to start.');
      }
    } else if (screen === SCREEN_WIN_NIGHT) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        audio.startDrone();
        announce(`Playing ${world.state.nightName}.`);
      }
    } else if (screen === SCREEN_HEIST_DONE) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_TITLE;
        announce('Midnight Vault. Press Space or click to start.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (flash > 0) flash = Math.max(0, flash - 0.016 * 1.1);
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, flash, muted: audio.muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Midnight Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

// A read-only handle for the capture/playtest harness (and for curious players).
window.__mv = { world, get screen() { return screen; } };

if (selftest) runSelftestMode();
else if (shot) runShot(shot);
else runGame();
