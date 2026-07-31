// Movement demo: controllable Wren on a floating-island screen with cliff
// edges on all show sides, an olive path, dark-grass patches, bushes, rocks
// and posts as solid y-sorted obstacles. Exercises ALttP movement feel:
// 1.5 px/frame 8-way walk, feet-level collision, corner-cutting assist
// (hold right into the bush row corner, or down into the post corner).
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeTileset } from '../game/tileset.js';
import { Tilemap } from '../game/tilemap.js';
import { Player } from '../game/player.js';

const COLS = 16, ROWS = 14;

// c/N/C north rim + corners, W/E side edges, 4/5/6 + R/F/L + 1/2/3 south
// cliff (rim/face/lobe columns), K sky. '.' = walkable grass/path/dark.
const MAP = [
  'cNNNNNNNNNNNNCKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  'W............EKK',
  '4RRRRRRRRRRRR1KK',
  '5FFFFFFFFFFFF2KK',
  '6LLLLLLLLLLLL3KK',
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
];

// Olive path: a horizontal road across the middle of the meadow.
const PATH = new Set();
for (let c = 2; c <= 11; c++) { PATH.add(`${c},5`); PATH.add(`${c},6`); }

// Dark grass patches.
const DARK = new Set();
for (let c = 1; c <= 3; c++) for (let r = 1; r <= 2; r++) DARK.add(`${c},${r}`);
for (let c = 9; c <= 12; c++) for (let r = 7; r <= 8; r++) DARK.add(`${c},${r}`);

// Solid decor: [sprite, col, row, solid rect (sprite-local px), baseY offset].
// Bush row (8-10,4) sets up the hold-right corner-cut; post (5,7) the
// hold-down one.
const DECOR = [
  ['bush', 8, 4, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 9, 4, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 10, 4, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 2, 7, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 3, 7, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['rock', 5, 2, { x: 1, y: 4, w: 13, h: 9 }, 13],
  ['rock_small', 2, 4, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['rock_small', 11, 3, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['post', 5, 7, { x: 4, y: 0, w: 6, h: 12 }, 13],
  ['post', 11, 1, { x: 4, y: 0, w: 6, h: 12 }, 13],
];

// Flowers: [colorKey, x, y] px — ground decals, non-solid.
const FLOWERS = [
  ['w', 1 * 16 + 6, 3 * 16 + 8], ['r', 2 * 16 + 2, 3 * 16 + 2],
  ['r', 6 * 16 + 4, 2 * 16 + 6], ['w', 7 * 16 + 10, 2 * 16 + 12],
  ['w', 9 * 16 + 4, 1 * 16 + 8], ['r', 10 * 16 + 10, 2 * 16 + 4],
  ['r', 1 * 16 + 8, 7 * 16 + 4], ['w', 2 * 16 + 2, 8 * 16 + 2],
  ['w', 7 * 16 + 6, 8 * 16 + 6], ['r', 12 * 16 + 4, 4 * 16 + 10],
];

export default class MovementScene {
  async init(engine) {
    const { tiles, sprites } = makeTileset();
    this.sprites = sprites;

    this.map = new Tilemap(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.map.set(c, r, this._tileName(c, r), MAP[r][c] !== '.');
      }
    }
    for (const [name, c, r, rect, base] of DECOR) {
      const x = c * TILE, y = r * TILE;
      this.map.addObstacle(sprites[name], x, y,
        { x: x + rect.x, y: y + rect.y, w: rect.w, h: rect.h }, y + base);
    }

    this.skyLayer = this._renderSky(tiles);
    this.landLayer = this.map.bake(tiles);

    // Start on the path, one bush-corner clip to the right, one post-corner
    // clip below (both within the 4px assist window).
    this.player = new Player(72, 61);
  }

  _hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }
  _in(set, c, r) { return set.has(`${c},${r}`); }

  _regionTile(set, prefix, c, r) {
    const grassAt = (cc, rr) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
      MAP[rr][cc] === '.' && !this._in(set, cc, rr);
    const gN = grassAt(c, r - 1), gS = grassAt(c, r + 1);
    const gW = grassAt(c - 1, r), gE = grassAt(c + 1, r);
    if (gN && gW) return `${prefix}_nw`;
    if (gN && gE) return `${prefix}_ne`;
    if (gS && gW) return `${prefix}_sw`;
    if (gS && gE) return `${prefix}_se`;
    if (gN) return `${prefix}_n`;
    if (gS) return `${prefix}_s`;
    if (gW) return `${prefix}_w`;
    if (gE) return `${prefix}_e`;
    return `${prefix}_c`;
  }

  _tileName(c, r) {
    const h = this._hash(c, r);
    switch (MAP[r][c]) {
      case '.':
        if (this._in(PATH, c, r)) return this._regionTile(PATH, 'path', c, r);
        if (this._in(DARK, c, r)) return this._regionTile(DARK, 'dk', c, r);
        return h % 6 === 4 ? 'grass2' : h % 6 === 5 ? 'grass3' : 'grass';
      case 'c': return 'corner_nw';
      case 'N': return 'rim_n';
      case 'C': return 'corner_ne';
      case 'W': return h % 2 ? 'edge_wb' : 'edge_wa';
      case 'E': return h % 2 ? 'edge_eb' : 'edge_ea';
      case 'R': return h % 2 ? 'rim_b' : 'rim_a';
      case 'F': return ['face_a', 'face_b', 'face_c'][(c * 2 + 1) % 3];
      case 'L': return ['lobe_1', 'lobe_2', 'lobe_3', 'lobe_1', 'lobe_3', 'lobe_2'][c % 6];
      case '4': return 'csw_rim';
      case '5': return 'csw_face';
      case '6': return 'csw_lobe';
      case '1': return 'cse_rim';
      case '2': return 'cse_face';
      case '3': return 'cse_lobe';
      default: return null; // K = open sky
    }
  }

  _renderSky(tiles) {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const ctx = cv.getContext('2d');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let name = 'sky';
        if (r === ROWS - 1) name = 'sky_deep';
        else if ((c * 5 + r * 3) % 11 === 3) name = 'sky2';
        ctx.drawImage(tiles[name], c * TILE, r * TILE);
      }
    }
    return cv;
  }

  update(dt, engine) {
    this.player.update(engine.input, this.map);
  }

  draw(ctx, engine) {
    const t = engine.frame;

    // Sky, drifting clouds below the island, then the baked island.
    ctx.drawImage(this.skyLayer, 0, 0);
    const c1 = this.sprites.cloud1, c2 = this.sprites.cloud2;
    ctx.drawImage(c1, Math.round(WIDTH - ((t * 0.12) % (WIDTH + c1.width))), 198);
    ctx.drawImage(c2, Math.round(WIDTH - ((t * 0.08 + 150) % (WIDTH + c2.width))), 182);
    ctx.drawImage(c2, Math.round(WIDTH - ((t * 0.16 + 70) % (WIDTH + c2.width))), 210);
    ctx.drawImage(this.landLayer, 0, 0);

    // Flowers (2-frame petal spin) — ground decals under everything mobile.
    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of FLOWERS) {
      ctx.drawImage(this.sprites[`flower_${color}${sway}`], x, y);
    }

    // Y-sorted entities: solid decor + player, painter's order by baseline.
    const ents = this.map.obstacles.map(ob => ({ baseY: ob.baseY, ob }));
    ents.push({ baseY: this.player.baseY, player: this.player });
    ents.sort((a, b) => a.baseY - b.baseY);
    for (const e of ents) {
      if (e.player) e.player.draw(ctx);
      else ctx.drawImage(e.ob.img, e.ob.x, e.ob.y);
    }
  }
}
