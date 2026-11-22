// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, pause, restart, mute, coin) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// A click on the canvas throws a coin at the pointer; the loop converts the pixel
// to playfield coordinates.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_COIN = 16;
export const ACTION_LEVELS = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const COIN_KEY = new Set(['KeyF']);
const LEVELS = new Set(['KeyL', 'Digit1', 'Digit2', 'Digit3']);

export function createInput(canvas, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let interact = false;
  let actions = 0;
  let throwTo = null;
  let digit = null;

  function keyDown(event) {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (SNEAK.has(event.code)) sneak = true;
    else if (INTERACT.has(event.code)) interact = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (COIN_KEY.has(event.code)) {
      if (!event.repeat) actions |= ACTION_COIN;
    } else if (LEVELS.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_LEVELS;
        if (event.code === 'Digit1') digit = 1;
        else if (event.code === 'Digit2') digit = 2;
        else if (event.code === 'Digit3') digit = 3;
      }
    } else return;
    event.preventDefault();
  }

  function keyUp(event) {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (SNEAK.has(event.code)) sneak = false;
    else if (INTERACT.has(event.code)) interact = false;
  }

  // A key released while the tab is hidden never sends keyup: let go of everything.
  function blur() {
    up = false;
    down = false;
    left = false;
    right = false;
    sneak = false;
    interact = false;
  }

  function pointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    if (point) throwTo = point;
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointerDown);

  return {
    // Steering: -1, 0 or 1 on each axis, from the held keys.
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    get sneak() {
      return sneak;
    },
    get interact() {
      return interact;
    },
    // The one-shot presses since the last call, as ACTION_* flags.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // A coin target the player clicked, or null. Taken once by the loop.
    takeThrow() {
      const target = throwTo;
      throwTo = null;
      return target;
    },
    // The night digit (1, 2 or 3) pressed since the last call, or null.
    takeDigit() {
      const d = digit;
      digit = null;
      return d;
    },
    // The last clicked point, for the coin key (F throws at the pointer's last spot).
    lastThrow() {
      return throwTo;
    },
    setThrow(point) {
      throwTo = point;
    },
  };
}
