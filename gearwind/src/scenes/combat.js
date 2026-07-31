// Combat demo: a sparring yard on a floating island. Three clockwork target
// drones hover around an olive practice square (the near one respawns after
// a poof); a spiked hazard dummy sits to the west — touching it knocks Wren
// back with a red flash and mercy blink. Press X (engine 'a') to swing the
// Cogblade: 3-pose arc swipe over 9 frames with a white swipe trail.
//
// Also exercises the movement-critique fixes: the west/east island edges use
// PARTIAL solid rects (tilemap.setPartial) so Wren stops against the rock
// pixels, not a tile early; vertical push scuff dust spawns at the boot line.
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeTileset } from '../game/tileset.js';
import { Tilemap } from '../game/tilemap.js';
import { Player } from '../game/player.js';
import { Melee, Drone } from '../game/combat.js';

const COLS = 16, ROWS = 14;

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

// Partial solid rects (tile-local px) for the edge tiles: only the rock band
// blocks, the grass strip on the island side is walkable right up to it.
// edge_ea rock starts at col 6 (eb reaches col 5); flipped west tiles mirror.
const EDGE_RECT = {
  edge_ea: { x: 6, y: 0, w: 10, h: 16 },
  edge_eb: { x: 5, y: 0, w: 11, h: 16 },
  edge_wa: { x: 0, y: 0, w: 10, h: 16 },
  edge_wb: { x: 0, y: 0, w: 11, h: 16 },
};

// Olive practice square in the middle of the yard.
const PATH = new Set();
for (let c = 5; c <= 10; c++) for (let r = 4; r <= 6; r++) PATH.add(`${c},${r}`);

// Dark grass corners.
const DARK = new Set();
for (let c = 10; c <= 12; c++) for (let r = 1; r <= 2; r++) DARK.add(`${c},${r}`);
for (let c = 1; c <= 2; c++) for (let r = 7; r <= 8; r++) DARK.add(`${c},${r}`);

// Solid decor kept to the rim so the yard stays open for knockback.
const DECOR = [
  ['bush', 2, 1, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 3, 1, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['rock', 12, 7, { x: 1, y: 4, w: 13, h: 9 }, 13],
  ['rock_small', 6, 8, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['post', 4, 3, { x: 4, y: 0, w: 6, h: 12 }, 13],
  ['post', 11, 3, { x: 4, y: 0, w: 6, h: 12 }, 13],
];

const FLOWERS = [
  ['w', 1 * 16 + 6, 2 * 16 + 8], ['r', 5 * 16 + 4, 1 * 16 + 6],
  ['r', 8 * 16 + 10, 2 * 16 + 2], ['w', 12 * 16 + 6, 4 * 16 + 10],
  ['w', 4 * 16 + 6, 6 * 16 + 10], ['r', 11 * 16 + 8, 8 * 16 + 4],
  ['w', 8 * 16 + 2, 7 * 16 + 10], ['r', 3 * 16 + 10, 8 * 16 + 8],
];

export default class CombatScene {
  async init(engine) {
    const { tiles, sprites } = makeTileset();
    this.sprites = sprites;

    this.map = new Tilemap(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const name = this._tileName(c, r);
        const part = EDGE_RECT[name];
        if (part) this.map.setPartial(c, r, name, part);
        else this.map.set(c, r, name, MAP[r][c] !== '.');
      }
    }
    for (const [name, c, r, rect, base] of DECOR) {
      const x = c * TILE, y = r * TILE;
      this.map.addObstacle(sprites[name], x, y,
        { x: x + rect.x, y: y + rect.y, w: rect.w, h: rect.h }, y + base);
    }

    this.skyLayer = this._renderSky(tiles);
    this.landLayer = this.map.bake(tiles);

    this.player = new Player(104, 80);
    this.melee = new Melee();
    this.drones = [
      new Drone(140, 76, { respawns: true, phase: 0 }),  // right of Wren
      new Drone(88, 36, { phase: 11 }),                  // north
      new Drone(64, 116, { phase: 23 }),                 // south-west
      new Drone(28, 76, { hazard: true, hp: 3 }),        // spiked hazard, west
    ];
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
    this.melee.update(engine.input, this.player, this.drones);
    this.player.update(engine.input, this.map);
    for (const d of this.drones) d.update(this.map, this.melee);
  }

  draw(ctx, engine) {
    const t = engine.frame;

    ctx.drawImage(this.skyLayer, 0, 0);
    const c1 = this.sprites.cloud1, c2 = this.sprites.cloud2;
    ctx.drawImage(c1, Math.round(WIDTH - ((t * 0.12) % (WIDTH + c1.width))), 198);
    ctx.drawImage(c2, Math.round(WIDTH - ((t * 0.08 + 150) % (WIDTH + c2.width))), 182);
    ctx.drawImage(c2, Math.round(WIDTH - ((t * 0.16 + 70) % (WIDTH + c2.width))), 210);
    ctx.drawImage(this.landLayer, 0, 0);

    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of FLOWERS) {
      ctx.drawImage(this.sprites[`flower_${color}${sway}`], x, y);
    }

    // Y-sorted: decor + drones + player (sword layered around the body).
    const ents = this.map.obstacles.map(ob => ({ baseY: ob.baseY, ob }));
    for (const d of this.drones) {
      if (d.visible) ents.push({ baseY: d.baseY, drone: d });
    }
    ents.push({ baseY: this.player.baseY, player: this.player });
    ents.sort((a, b) => a.baseY - b.baseY);
    for (const e of ents) {
      if (e.player) {
        this.melee.drawUnder(ctx, this.player);
        this.player.draw(ctx);
        this.melee.drawOver(ctx, this.player);
      } else if (e.drone) {
        e.drone.draw(ctx, t);
      } else {
        ctx.drawImage(e.ob.img, e.ob.x, e.ob.y);
      }
    }

    // Poofs render above everything.
    this.melee.drawFx(ctx);
  }
}
