// Tile map: grid of named tiles + per-tile solidity + solid decor obstacles.
// The tile layer bakes to an offscreen canvas once; decor obstacles are kept
// as y-sortable drawables so scenes can depth-sort them against actors.
// Pixel-level collision queries via boxFree() (used by the player mover).
import { TILE } from '../engine.js';

export class Tilemap {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.names = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.solidGrid = Array.from({ length: rows }, () => Array(cols).fill(false));
    // Optional per-tile PARTIAL solid rect (tile-local px). Lets edge tiles be
    // solid only where the rock art actually is, so walls hug the pixels
    // instead of stopping the player a whole tile early.
    this.partGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    // {img, x, y, rect: {x,y,w,h}|null, baseY} — rect in world px, baseY = sort key
    this.obstacles = [];
  }

  set(c, r, name, solid) {
    this.names[r][c] = name;
    this.solidGrid[r][c] = !!solid;
  }

  // Tile that is walkable except inside rect {x,y,w,h} (tile-local px).
  setPartial(c, r, name, rect) {
    this.names[r][c] = name;
    this.solidGrid[r][c] = false;
    this.partGrid[r][c] = rect;
  }

  // Out of bounds counts as solid.
  isSolid(c, r) {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.solidGrid[r][c];
  }

  addObstacle(img, x, y, rect, baseY) {
    this.obstacles.push({ img, x, y, rect, baseY });
  }

  // True if the axis-aligned box [x, x+w) x [y, y+h) touches no solid tile
  // and no solid obstacle rect. Coordinates may be fractional.
  boxFree(x, y, w, h) {
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.001) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (this.isSolid(c, r)) return false;
        const p = this.partGrid[r][c]; // in bounds: isSolid would have caught OOB
        if (p) {
          const px = c * TILE + p.x, py = r * TILE + p.y;
          if (x < px + p.w && x + w > px && y < py + p.h && y + h > py) return false;
        }
      }
    }
    for (const ob of this.obstacles) {
      const rc = ob.rect;
      if (!rc) continue;
      if (x < rc.x + rc.w && x + w > rc.x && y < rc.y + rc.h && y + h > rc.y) return false;
    }
    return true;
  }

  // Bake the tile layer to an offscreen canvas (tiles = name -> canvas map).
  bake(tiles) {
    const cv = document.createElement('canvas');
    cv.width = this.cols * TILE;
    cv.height = this.rows * TILE;
    const ctx = cv.getContext('2d');
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const name = this.names[r][c];
        if (name && tiles[name]) ctx.drawImage(tiles[name], c * TILE, r * TILE);
      }
    }
    return cv;
  }
}
