// Security cameras: fixed, sweeping, and part of the alarm. A camera's cone works
// like a guard's (range + angle + walls) but it does not move, and while it sees the
// thief the alarm meter climbs fast. A power box can switch one off for a while.
import { CAMERA } from './config.js';
import { lineClear, tileToPixel } from './level.js';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createCamera(def, index, night) {
  const pos = tileToPixel(def.tileX, def.tileY);
  return {
    index,
    x: pos.x,
    y: pos.y,
    baseFacing: def.facing,
    facing: def.facing,
    sweepSeconds: CAMERA.sweepSeconds * night.sweep,
    range: CAMERA.range,
    disabledUntil: -1,
    seeing: false,
    flash: 0,
  };
}

// The sweep is a triangle wave: the camera pans left, then right, forever.
export function stepCamera(camera, time) {
  const period = camera.sweepSeconds * 2;
  const phase = (time % period) / camera.sweepSeconds;
  const swing = phase <= 1 ? phase * 2 - 1 : 3 - phase * 2;
  camera.facing = camera.baseFacing + swing * CAMERA.sweepArc;
}

export function cameraSees(camera, thiefX, thiefY, visibility, time) {
  if (time < camera.disabledUntil || visibility <= 0) return false;
  const dx = thiefX - camera.x;
  const dy = thiefY - camera.y;
  const dist = Math.hypot(dx, dy);
  if (dist > camera.range) return false;
  const toThief = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toThief, camera.facing)) > CAMERA.halfAngle) return false;
  return lineClear(camera.x, camera.y, thiefX, thiefY);
}

export function disableCamera(camera, time) {
  camera.disabledUntil = time + CAMERA.disabledSeconds;
  camera.seeing = false;
}

export function isCameraDisabled(camera, time) {
  return time < camera.disabledUntil;
}
