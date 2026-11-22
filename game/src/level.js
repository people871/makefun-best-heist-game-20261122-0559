// The floor: tile queries, line of sight and reachability for the vault map in config.js.
// Nothing here knows about guards or the thief — it only answers questions about tiles.
import { FIELD, GRID_Y, MAP } from './config.js';

const SOLID_TILES = new Set(['#', 'C', 'D', 'P', 'V']);

export function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= FIELD.cols || row >= FIELD.rows) return '#';
  return MAP[row][col];
}

export function isSolidTile(col, row) {
  return SOLID_TILES.has(tileAt(col, row));
}

export function isShadowTile(col, row) {
  return tileAt(col, row) === ',';
}

export function isHideTile(col, row) {
  return tileAt(col, row) === 'H';
}

export function tileToPixel(col, row) {
  return { x: col * FIELD.tile + FIELD.tile / 2, y: GRID_Y + row * FIELD.tile + FIELD.tile / 2 };
}

export function pixelToTile(x, y) {
  return { col: Math.floor(x / FIELD.tile), row: Math.floor((y - GRID_Y) / FIELD.tile) };
}

// Walkable for the thief and the guards: anything that is not a solid tile.
export function isWalkable(col, row) {
  return !isSolidTile(col, row);
}

// A straight line between two points crosses no solid tile. Steps along the line in
// small increments and tests the tile under each step — the same test the guards use
// for vision and the same test the renderer uses to clip the drawn cones, so what you
// see is exactly what the guards see.
export function lineClear(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tile = pixelToTile(x0 + dx * t, y0 + dy * t);
    if (isSolidTile(tile.col, tile.row)) return false;
  }
  return true;
}

// How far a ray from (x0, y0) in direction (dx, dy) travels before it hits a solid
// tile, capped at maxDistance. Used to clip vision cones at walls.
export function rayDistance(x0, y0, dx, dy, maxDistance) {
  const step = 8;
  for (let d = step; d <= maxDistance; d += step) {
    const tile = pixelToTile(x0 + dx * d, y0 + dy * d);
    if (isSolidTile(tile.col, tile.row)) return d;
  }
  return maxDistance;
}

// Breadth-first reachability over walkable tiles from a tile. The self-test uses it to
// prove the vault, the exit and every loot tile can be reached from the entry.
export function reachableFrom(startCol, startRow) {
  const seen = new Set([`${startCol},${startRow}`]);
  const queue = [[startCol, startRow]];
  while (queue.length > 0) {
    const [col, row] = queue.shift();
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= FIELD.cols || nr >= FIELD.rows) continue;
      if (!isWalkable(nc, nr)) continue;
      const key = `${nc},${nr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nc, nr]);
    }
  }
  return seen;
}

export function findTiles(char) {
  const found = [];
  for (let row = 0; row < FIELD.rows; row += 1) {
    for (let col = 0; col < FIELD.cols; col += 1) {
      if (MAP[row][col] === char) found.push({ col, row });
    }
  }
  return found;
}

// Circle-vs-tile collision: push a circle of `radius` at (x, y) out of solid tiles.
// Returns the corrected position. The radius is slightly smaller than the drawn body
// so corners never snag the thief or a guard on diagonally adjacent walls.
export function collideCircle(x, y, radius) {
  let px = x;
  let py = y;
  const tile = pixelToTile(px, py);
  for (let row = tile.row - 1; row <= tile.row + 1; row += 1) {
    for (let col = tile.col - 1; col <= tile.col + 1; col += 1) {
      if (!isSolidTile(col, row)) continue;
      const left = col * FIELD.tile;
      const top = GRID_Y + row * FIELD.tile;
      const nearestX = Math.max(left, Math.min(px, left + FIELD.tile));
      const nearestY = Math.max(top, Math.min(py, top + FIELD.tile));
      const dx = px - nearestX;
      const dy = py - nearestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= radius * radius) continue;
      if (distSq === 0) {
        py = top - radius;
        continue;
      }
      const dist = Math.sqrt(distSq);
      px = nearestX + (dx / dist) * radius;
      py = nearestY + (dy / dist) * radius;
    }
  }
  return { x: px, y: py };
}
