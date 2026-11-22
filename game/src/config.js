// MIDNIGHT VAULT — every tuning number, colour and the hand-built floor in one place.
// The playfield is a fixed 1280x720 logical area. A 48 px HUD band sits on top; below it
// a 40 x 21 tile grid of 32 px tiles (40*32 = 1280, 48 + 21*32 = 720).
// Map legend: # wall | . floor | , shadow floor | C crate | D desk | P pillar
//             V vault | E exit | S start | B power box | * small loot | H hiding vent

export const FIELD = { width: 1280, height: 720, hudHeight: 48, tile: 32, cols: 40, rows: 21 };
export const GRID_Y = FIELD.hudHeight;
export const STEP = 1 / 60;
export const NIGHT_TIME = 300;
export const BEST_KEY = 'midnight-vault.best';

export const MAP = [
  '########################################',
  '#..............................#########',
  '#.....*........................#....V.##',
  '#..............................#......##',
  '#.................DD...........###.#####',
  '#.............*........................#',
  '#.......CC................D............#',
  '#......................................#',
  '#....,,,,,............*................#',
  '#....,,,,,....................H........#',
  '#.............P........................#',
  '#.....D.................C..............#',
  '#.................................*....#',
  '#.........*...........P................#',
  '#.....................,,,,*,...........#',
  '#...........C.........,,,,,,..P........#',
  '#................................C.....#',
  '#.....H.,,,,,...............B.....D....#',
  '#......................................#',
  '#.S..................................E.#',
  '########################################',
];

export const THIEF = {
  radius: 11,
  walkSpeed: 150,
  sneakSpeed: 78,
  sneakVisibility: 0.55,
  shadowVisibility: 0.25,
  hideRadius: 46,
  walkNoise: 52,
  sneakNoise: 16,
  stepInterval: 0.42,
  coins: 3,
  coinRange: 230,
  coinNoise: 165,
  vaultHold: 2.0,
  boxHold: 1.5,
  interactRange: 46,
};

export const GUARD = {
  radius: 12,
  range: 212,
  halfAngle: 0.785,
  patrolSpeed: 56,
  chaseSpeed: 138,
  searchSpeed: 82,
  investigateSpeed: 96,
  pauseAtWaypoint: 1.4,
  suspiciousAt: 0.35,
  fillPointBlank: 1 / 1.2,
  fillMaxRange: 1 / 3.0,
  drain: 0.25,
  memory: 4.0,
  loseSight: 3.0,
  searchTime: 6.0,
  catchDistance: 26,
  radioRadius: 320,
  huntedSpeed: 1.2,
};

export const CAMERA = {
  range: 205,
  halfAngle: 0.44,
  sweepArc: 0.61,
  sweepSeconds: 3.0,
  alarmPerSecond: 8,
  disabledSeconds: 12,
};

export const ALARM = {
  spotAdd: 25,
  decay: 2.0,
  huntedAt: 40,
  lockdownAt: 70,
  lockdownSeconds: 5,
};

export const LOOT = { small: 100, vault: 500, needSmall: 4, smallCount: 6 };
export const SCORE = { timeBonusPerSecond: 5, ghostBonus: 500 };

export const NIGHTS = [
  { name: 'Night 1 — The Quiet Gallery', speed: 1.0, fill: 1.0, sweep: 1.0, decay: 1.0, range: 1.0 },
  { name: 'Night 2 — The Double Shift', speed: 1.25, fill: 1.3, sweep: 0.8, decay: 0.75, range: 1.05 },
  { name: 'Night 3 — The Lockdown Crew', speed: 1.5, fill: 1.6, sweep: 0.63, decay: 0.5, range: 1.1 },
];

export const GUARD_DEFS = [
  { name: 'Rook', color: '#e8b34b', waypoints: [[4, 5], [20, 5], [20, 14], [4, 14]] },
  { name: 'Bishop', color: '#7fb3e8', waypoints: [[28, 2], [28, 8], [36, 8], [36, 5], [30, 5], [30, 2]] },
  { name: 'Knight', color: '#b78ae8', waypoints: [[4, 17], [20, 17], [20, 12], [4, 12]] },
];

export const CAMERA_DEFS = [
  { tileX: 29.5, tileY: 2, facing: 2.6 },
  { tileX: 15, tileY: 10, facing: 0.0 },
];

export const PALETTE = {
  backdrop: '#0a0c12',
  floor: '#232833',
  floorAlt: '#20242e',
  shadowFloor: '#141824',
  wall: '#3a4152',
  wallTop: '#4a5266',
  crate: '#6b5232',
  crateEdge: '#8a6d42',
  desk: '#4d3a5e',
  pillar: '#39415a',
  vault: '#f2c94c',
  vaultDoor: '#8a6d1f',
  exit: '#3ddc84',
  start: '#4fc3f7',
  powerBox: '#e8e34b',
  loot: '#ffd94d',
  thief: '#4fc3f7',
  thiefSneak: '#7fd4ff',
  guard: '#e5534b',
  camera: '#e8e34b',
  cone: 'rgba(232, 179, 75, 0.20)',
  coneChase: 'rgba(229, 83, 75, 0.28)',
  coneCamera: 'rgba(232, 227, 75, 0.16)',
  hud: 'rgba(10, 12, 18, 0.92)',
  panel: '#171b26',
  text: '#eef1f5',
  muted: '#9aa3b5',
  alarmCalm: '#3ddc84',
  alarmHunted: '#f2a93b',
  alarmLockdown: '#e5534b',
  minimapBg: 'rgba(10, 12, 18, 0.88)',
  hide: '#1d2b1d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
