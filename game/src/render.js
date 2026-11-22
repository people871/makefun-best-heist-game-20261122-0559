// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. Vision cones are drawn from the same raycast the guards use to see,
// so a cone never claims sight through a wall. The renderer reads state, never mutates it.
import { ALARM, CAMERA, FIELD, FONT, GRID_Y, GUARD, LOOT, NIGHTS, PALETTE, THIEF } from './config.js';
import { isHideTile, isShadowTile, isSolidTile, pixelToTile, rayDistance, tileAt, tileToPixel } from './level.js';
import { MODE_CHASE, MODE_SUSPICIOUS } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_TIMEOUT = 'timeout';
export const SCREEN_WIN_NIGHT = 'win-night';
export const SCREEN_HEIST_DONE = 'heist-done';

const CONE_RAYS = 13;
const MINIMAP = { width: 208, height: 116, margin: 12 };

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function coneFan(x, y, facing, halfAngle, range, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    for (let i = 0; i < CONE_RAYS; i += 1) {
      const angle = facing - halfAngle + (2 * halfAngle * i) / (CONE_RAYS - 1);
      const dist = rayDistance(x, y, Math.cos(angle), Math.sin(angle), range);
      context.lineTo(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist);
    }
    context.closePath();
    context.fill();
  }

  function drawFloor(state) {
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        const x = col * FIELD.tile;
        const y = GRID_Y + row * FIELD.tile;
        const tile = tileAt(col, row);
        if (tile === '#') {
          context.fillStyle = PALETTE.wall;
          context.fillRect(x, y, FIELD.tile, FIELD.tile);
          context.fillStyle = PALETTE.wallTop;
          context.fillRect(x, y, FIELD.tile, 4);
          continue;
        }
        context.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt;
        context.fillRect(x, y, FIELD.tile, FIELD.tile);
        if (tile === ',') {
          context.fillStyle = PALETTE.shadowFloor;
          context.fillRect(x, y, FIELD.tile, FIELD.tile);
        } else if (tile === 'H') {
          context.fillStyle = PALETTE.hide;
          context.fillRect(x + 3, y + 3, FIELD.tile - 6, FIELD.tile - 6);
          context.fillStyle = '#2f4a2f';
          context.fillRect(x + 8, y + 8, FIELD.tile - 16, FIELD.tile - 16);
        }
        if (tile === 'C') {
          context.fillStyle = PALETTE.crate;
          context.fillRect(x + 2, y + 2, FIELD.tile - 4, FIELD.tile - 4);
          context.strokeStyle = PALETTE.crateEdge;
          context.lineWidth = 2;
          context.strokeRect(x + 2, y + 2, FIELD.tile - 4, FIELD.tile - 4);
          context.beginPath();
          context.moveTo(x + 2, y + 2);
          context.lineTo(x + FIELD.tile - 2, y + FIELD.tile - 2);
          context.moveTo(x + FIELD.tile - 2, y + 2);
          context.lineTo(x + 2, y + FIELD.tile - 2);
          context.stroke();
        } else if (tile === 'D') {
          context.fillStyle = PALETTE.desk;
          context.fillRect(x + 2, y + 4, FIELD.tile - 4, FIELD.tile - 8);
          context.fillStyle = '#6b4d7a';
          context.fillRect(x + 6, y + 8, FIELD.tile - 12, FIELD.tile - 16);
        } else if (tile === 'P') {
          context.fillStyle = PALETTE.pillar;
          context.beginPath();
          context.arc(x + FIELD.tile / 2, y + FIELD.tile / 2, 13, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#4a5878';
          context.beginPath();
          context.arc(x + FIELD.tile / 2, y + FIELD.tile / 2, 8, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  function drawVaultAndExit(state) {
    const vault = state.loot.vault;
    const glow = vault.cracked ? 0.9 : 0.55 + 0.25 * Math.sin(state.time * 3);
    context.save();
    context.globalAlpha = glow;
    context.fillStyle = PALETTE.vault;
    context.beginPath();
    context.arc(vault.x, vault.y, 26, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.fillStyle = PALETTE.vaultDoor;
    context.fillRect(vault.x - 15, vault.y - 15, 30, 30);
    context.strokeStyle = PALETTE.vault;
    context.lineWidth = 3;
    context.strokeRect(vault.x - 15, vault.y - 15, 30, 30);
    context.beginPath();
    context.arc(vault.x, vault.y, 7, 0, Math.PI * 2);
    context.stroke();
    text(vault.cracked ? 'OPEN' : 'VAULT', vault.x, vault.y - 26, 13, PALETTE.vault, 'center');

    const exit = state.loot.exit;
    const sealed = state.time < state.lockdownUntil;
    context.save();
    context.globalAlpha = sealed ? 0.35 : 0.6 + 0.25 * Math.sin(state.time * 3);
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x - 18, exit.y - 18, 36, 36);
    context.restore();
    context.strokeStyle = sealed ? PALETTE.alarmLockdown : PALETTE.exit;
    context.lineWidth = 3;
    context.strokeRect(exit.x - 18, exit.y - 18, 36, 36);
    text(sealed ? 'SEALED' : 'EXIT', exit.x, exit.y - 26, 13, sealed ? PALETTE.alarmLockdown : PALETTE.exit, 'center');

    const box = state.loot.box;
    context.fillStyle = PALETTE.powerBox;
    context.fillRect(box.x - 10, box.y - 10, 20, 20);
    context.fillStyle = '#11141b';
    context.font = 'bold 16px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('⚡', box.x, box.y + 1);
    text('POWER', box.x, box.y - 16, 11, PALETTE.powerBox, 'center');
  }

  function drawLoot(state) {
    for (const item of state.loot.small) {
      if (item.taken) continue;
      const bob = Math.sin(state.time * 2.5 + item.bob) * 3;
      context.save();
      context.globalAlpha = 0.5;
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(item.x, item.y + 4, 12, 0, Math.PI * 2);
      context.fill();
      context.restore();
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.moveTo(item.x, item.y - 10 + bob);
      context.lineTo(item.x + 8, item.y + bob);
      context.lineTo(item.x, item.y + 10 + bob);
      context.lineTo(item.x - 8, item.y + bob);
      context.closePath();
      context.fill();
      context.fillStyle = '#fff7cc';
      context.beginPath();
      context.moveTo(item.x, item.y - 5 + bob);
      context.lineTo(item.x + 3, item.y + bob);
      context.lineTo(item.x, item.y + 5 + bob);
      context.lineTo(item.x - 3, item.y + bob);
      context.closePath();
      context.fill();
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      if (state.time < camera.disabledUntil) continue;
      const fill = camera.seeing ? 'rgba(229, 83, 75, 0.30)' : PALETTE.coneCamera;
      coneFan(camera.x, camera.y, camera.facing, CAMERA.halfAngle, camera.range, fill);
    }
    for (const guard of state.guards) {
      let fill = PALETTE.cone;
      if (guard.mode === MODE_CHASE) fill = PALETTE.coneChase;
      else if (guard.mode === MODE_SUSPICIOUS) fill = 'rgba(242, 169, 59, 0.24)';
      coneFan(guard.x, guard.y, guard.facing, GUARD.halfAngle, GUARD.range, fill);
    }
  }

  function drawEntities(state) {
    for (const camera of state.cameras) {
      const disabled = state.time < camera.disabledUntil;
      context.fillStyle = disabled ? '#555c6e' : camera.seeing ? '#e5534b' : PALETTE.camera;
      context.beginPath();
      context.arc(camera.x, camera.y, 10, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.facing) * 4, camera.y + Math.sin(camera.facing) * 4, 4, 0, Math.PI * 2);
      context.fill();
      if (disabled) {
        text('OFF', camera.x, camera.y - 16, 11, '#9aa3b5', 'center');
      } else if (camera.seeing) {
        text('!', camera.x, camera.y - 16, 18, '#e5534b', 'center');
      }
    }

    for (const guard of state.guards) {
      context.fillStyle = guard.color;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius + 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#11141b';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.facing) * 6, guard.y + Math.sin(guard.facing) * 6, 5, 0, Math.PI * 2);
      context.fill();
      // Suspicion arc over the guard's head.
      if (guard.suspicion > 0.02) {
        context.strokeStyle = guard.suspicion >= 1 ? '#e5534b' : '#f2a93b';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(guard.x, guard.y, GUARD.radius + 8, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        context.stroke();
      }
      if (guard.mode === MODE_CHASE) text('!', guard.x, guard.y - 26, 22, '#e5534b', 'center');
      else if (guard.mode === MODE_SUSPICIOUS) text('?', guard.x, guard.y - 26, 22, '#f2a93b', 'center');
      text(guard.name, guard.x, guard.y + 28, 11, PALETTE.muted, 'center');
    }

    const thief = state.thief;
    const hidden = isHideTile(pixelToTile(thief.x, thief.y).col, pixelToTile(thief.x, thief.y).row);
    context.save();
    if (hidden) context.globalAlpha = 0.55;
    context.fillStyle = thief.sneaking ? PALETTE.thiefSneak : PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0a0c12';
    context.beginPath();
    context.arc(thief.x + Math.cos(thief.facing) * 5, thief.y + Math.sin(thief.facing) * 5, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    if (thief.sneaking) text('sneaking', thief.x, thief.y - 20, 11, PALETTE.thiefSneak, 'center');
    if (state.interactTarget) {
      context.strokeStyle = PALETTE.vault;
      context.lineWidth = 4;
      context.beginPath();
      context.arc(thief.x, thief.y, THIEF.radius + 9, -Math.PI / 2, -Math.PI / 2 + state.interactProgress * Math.PI * 2);
      context.stroke();
      text(state.interactTarget === 'vault' ? 'CRACKING…' : 'CUTTING POWER…', thief.x, thief.y - 32, 12, PALETTE.vault, 'center');
    }

    if (state.flyingCoin) {
      context.fillStyle = PALETTE.loot;
      context.beginPath();
      context.arc(state.flyingCoin.x, state.flyingCoin.y, 6, 0, Math.PI * 2);
      context.fill();
    }

    for (const p of state.particles) {
      context.save();
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, 3, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function drawHud(state) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, FIELD.hudHeight);
    context.fillStyle = '#2a3040';
    context.fillRect(0, FIELD.hudHeight - 2, FIELD.width, 2);

    text(state.nightName, 16, 19, 15, PALETTE.text, 'left', 'middle');
    const objective = state.vaultTaken
      ? 'Vault cracked — reach the EXIT'
      : `Crack the VAULT or pocket ${LOOT.needSmall} loot, then reach the EXIT`;
    text(objective, 16, 37, 12, PALETTE.muted, 'left', 'middle');

    // The alarm meter: always visible, top centre, with its band.
    const barX = FIELD.width / 2 - 150;
    const barY = 12;
    const barW = 300;
    const barH = 18;
    const bandColor = state.band === 'lockdown' ? PALETTE.alarmLockdown : state.band === 'hunted' ? PALETTE.alarmHunted : PALETTE.alarmCalm;
    context.fillStyle = '#11141b';
    context.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    context.fillStyle = '#2a3040';
    context.fillRect(barX, barY, barW, barH);
    context.fillStyle = bandColor;
    context.fillRect(barX, barY, (barW * state.alarm) / 100, barH);
    context.strokeStyle = bandColor;
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barW, barH);
    text(`ALARM ${Math.round(state.alarm)}`, FIELD.width / 2, barY + barH / 2 + 1, 13, '#ffffff', 'center', 'middle');
    text(state.band.toUpperCase(), FIELD.width / 2, barY + barH + 13, 11, bandColor, 'center', 'middle');

    const right = FIELD.width - 16;
    text(`LOOT ${state.smallTaken + (state.vaultTaken ? 1 : 0)}/${LOOT.smallCount + 1}`, right, 18, 15, PALETTE.loot, 'right', 'middle');
    text(`COINS ${state.coins}   ⏱ ${formatTime(state.timeLeft)}   ★ ${state.score}`, right, 38, 13, PALETTE.text, 'right', 'middle');

    if (state.time < state.messageUntil && state.message) {
      context.fillStyle = 'rgba(10, 12, 18, 0.85)';
      const w = context.measureText(state.message).width + 32;
      context.fillRect((FIELD.width - w) / 2, FIELD.height - 44, w, 30);
      text(state.message, FIELD.width / 2, FIELD.height - 24, 15, PALETTE.text, 'center', 'middle');
    }
  }

  function drawMinimap(state) {
    const x0 = FIELD.width - MINIMAP.width - MINIMAP.margin;
    const y0 = FIELD.height - MINIMAP.height - MINIMAP.margin;
    const sx = MINIMAP.width / FIELD.width;
    const sy = MINIMAP.height / FIELD.height;
    context.fillStyle = PALETTE.minimapBg;
    context.fillRect(x0 - 4, y0 - 4, MINIMAP.width + 8, MINIMAP.height + 8);
    context.strokeStyle = '#3a4152';
    context.lineWidth = 1;
    context.strokeRect(x0 - 4, y0 - 4, MINIMAP.width + 8, MINIMAP.height + 8);
    for (let row = 0; row < FIELD.rows; row += 1) {
      for (let col = 0; col < FIELD.cols; col += 1) {
        if (!isSolidTile(col, row)) continue;
        context.fillStyle = '#4a5266';
        context.fillRect(x0 + col * FIELD.tile * sx, y0 + (GRID_Y + row * FIELD.tile) * sy, FIELD.tile * sx + 0.5, FIELD.tile * sy + 0.5);
      }
    }
    for (const item of state.loot.small) {
      if (item.taken) continue;
      context.fillStyle = PALETTE.loot;
      context.fillRect(x0 + item.x * sx - 1.5, y0 + item.y * sy - 1.5, 3, 3);
    }
    context.fillStyle = PALETTE.vault;
    context.fillRect(x0 + state.loot.vault.x * sx - 2, y0 + state.loot.vault.y * sy - 2, 4, 4);
    context.fillStyle = PALETTE.exit;
    context.fillRect(x0 + state.loot.exit.x * sx - 2, y0 + state.loot.exit.y * sy - 2, 4, 4);
    for (const guard of state.guards) {
      context.fillStyle = guard.mode === MODE_CHASE ? '#e5534b' : guard.color;
      context.beginPath();
      context.arc(x0 + guard.x * sx, y0 + guard.y * sy, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x0 + state.thief.x * sx, y0 + state.thief.y * sy, 3, 0, Math.PI * 2);
    context.fill();
    text('MAP', x0, y0 - 6, 10, PALETTE.muted, 'left');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.78)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || '#3a4152';
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center');
    lines.forEach((line, i) => {
      text(line.text, FIELD.width / 2, y + 130 + i * lineHeight, line.size || 20, line.color || PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 20, PALETTE.loot, 'center');
  }

  function ratingText(state) {
    if (state.spottedTotal === 0) return 'GHOST — never spotted';
    if (state.spottedTotal <= 2) return 'SHADOW — spotted, never caught';
    return 'LOUD — the whole house knows';
  }

  /** Paint one frame: the room, then the HUD, the minimap and the screen panel. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawCones(state);
    drawVaultAndExit(state);
    drawLoot(state);
    drawEntities(state);
    if (screen !== SCREEN_TITLE) drawHud(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawMinimap(state);
    if (screen === SCREEN_PLAY && state.guards.some((g) => g.mode === MODE_CHASE)) {
      context.fillStyle = 'rgba(229, 83, 75, 0.9)';
      const bw = 420;
      context.fillRect((FIELD.width - bw) / 2, 56, bw, 30);
      text('SPOTTED! — break line of sight!', FIELD.width / 2, 77, 16, '#ffffff', 'center', 'middle');
    }

    if (ui.flash > 0) {
      context.fillStyle = `rgba(229, 83, 75, ${ui.flash * 0.22})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    if (screen === SCREEN_TITLE) {
      const lines = [
        { text: 'Slip past 3 guards and 2 sweeping cameras. Crack the vault.', size: 20 },
        { text: 'Pocket the loot. Reach the EXIT before the alarm locks it down.', size: 20 },
        { text: '', size: 20 },
        { text: 'NIGHT 1  The Quiet Gallery  ·  NIGHT 2  The Double Shift  ·  NIGHT 3  The Lockdown Crew', size: 16, color: PALETTE.text },
        { text: 'WASD / arrows move · SHIFT sneak · E crack vault / cut power · Click or F throw a coin', size: 16 },
        { text: 'P pause · R restart · M mute · 1/2/3 pick a night', size: 16 },
        { text: `Best heist: ${ui.best} points`, size: 16, color: PALETTE.loot },
      ];
      drawPanel('MIDNIGHT VAULT', lines, 'Press Space or click to start the heist');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', [{ text: 'The guards are waiting. The vault is not going anywhere.' }], 'Press P to keep sneaking');
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel(
        'CAUGHT!',
        [
          { text: `A guard laid hands on you in ${state.nightName}.`, size: 20 },
          { text: `Loot kept: ${state.smallTaken + (state.vaultTaken ? 1 : 0)} of ${LOOT.smallCount + 1} · Score ${state.score}`, size: 18 },
        ],
        'Press R to try this night again',
        PALETTE.alarmLockdown,
      );
    } else if (screen === SCREEN_TIMEOUT) {
      drawPanel(
        "TIME'S UP",
        [
          { text: `The night ended with you still inside ${state.nightName}.`, size: 20 },
          { text: `Loot kept: ${state.smallTaken + (state.vaultTaken ? 1 : 0)} of ${LOOT.smallCount + 1} · Score ${state.score}`, size: 18 },
        ],
        'Press R to try this night again',
        PALETTE.alarmLockdown,
      );
    } else if (screen === SCREEN_WIN_NIGHT) {
      const last = state.lastNight || { name: state.nightName, nightScore: state.nightScore, loot: 0, spotted: state.spottedThisNight, nextName: '' };
      drawPanel(
        `${last.name} — CLEAR!`,
        [
          { text: `Loot ${last.loot} of ${LOOT.smallCount + 1} · Night score ${last.nightScore}`, size: 20 },
          { text: last.spotted ? 'Spotted — no ghost bonus this night.' : 'GHOST — never spotted. +500 bonus.', size: 18, color: last.spotted ? PALETTE.muted : PALETTE.loot },
          { text: last.nextName ? `Next: ${last.nextName}` : '', size: 18 },
        ],
        'Press Space for the next night',
        PALETTE.alarmCalm,
      );
    } else if (screen === SCREEN_HEIST_DONE) {
      drawPanel(
        'HEIST COMPLETE',
        [
          { text: 'All three nights. The vault is empty and you are gone.', size: 20 },
          { text: `Total score ${state.score} · ${ratingText(state)}`, size: 20, color: PALETTE.loot },
          { text: `Best heist: ${ui.best} points`, size: 18 },
        ],
        'Press Space to run it back from Night 1',
        PALETTE.alarmCalm,
      );
    }

    if (ui.muted) text('MUTED (M)', FIELD.width - 16, FIELD.height - MINIMAP.height - 34, 12, PALETTE.muted, 'right');
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField: (px, py, rectW, rectH) => {
    const scaleX = FIELD.width / rectW;
    const scaleY = FIELD.height / rectH;
    const scale = Math.min(scaleX, scaleY);
    const ox = (rectW - FIELD.width * scale) / 2;
    const oy = (rectH - FIELD.height * scale) / 2;
    const fx = (px - ox) / scale;
    const fy = (py - oy) / scale;
    if (fx < 0 || fy < 0 || fx > FIELD.width || fy > FIELD.height) return null;
    return { x: fx, y: fy };
  } };
}
