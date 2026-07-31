// Enemies demo: a small floating-island arena carrying the whole Chapter 1
// overworld roster — 4 clockwork beetles patrolling (octorok-style walk /
// pause / 90-degree turns, tile collision, and the wind-up + steam-vent
// attack), 2 gear-bats (keese-style perch -> clench -> sine-arc swoop toward
// Wren -> glide -> re-perch) and 2 steam slimes (zol-style breathe -> squash
// telegraph -> committed parabolic hop), with ground shadows under everything
// that leaves the floor. Wren is controllable AND armed: the Cogblade is
// wired in, so `--press a@N` captures the hit flicker, the knockback and the
// three-frame steam-poof death straight out of this scene. Contact with an
// enemy — or with a live steam jet — hurts Wren the same way the overworld
// does it. Fully deterministic under ?seed=N.
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeTileset } from '../game/tileset.js';
import { Tilemap } from '../game/tilemap.js';
import { Player } from '../game/player.js';
import { Melee } from '../game/combat.js';
import { makeEnemySprites, ClockworkBeetle, GearBat, SteamSlime } from '../game/enemies.js';

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

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

// Dark grass patches to break up the lawn.
const DARK = new Set();
for (let c = 9; c <= 12; c++) for (let r = 1; r <= 2; r++) DARK.add(`${c},${r}`);
for (let c = 1; c <= 3; c++) for (let r = 6; r <= 7; r++) DARK.add(`${c},${r}`);

// A dirt road across the isle with a spur south: gives the patrol a lane to
// walk, and keeps the screen as dense as a real ALttP overworld tile.
const PATH = new Set();
for (let c = 1; c <= 12; c++) PATH.add(`${c},4`);
for (let r = 5; r <= 8; r++) PATH.add(`9,${r}`);

// Solid decor gives the beetles corners to bump and turn at.
const DECOR = [
  ['rock', 4, 2, { x: 1, y: 4, w: 13, h: 9 }, 13],
  ['rock_small', 11, 5, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['bush', 6, 6, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 7, 6, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 6, 7, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['post', 2, 2, { x: 4, y: 0, w: 6, h: 12 }, 13],
  ['rock_small', 12, 7, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['fence', 10, 1, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 11, 1, { x: 2, y: 4, w: 12, h: 6 }, 11],
];

// Flat ground detail — drawn under everything, never blocks a patrol.
const GROUND = [
  ['tallgrass', 1, 1], ['tallgrass', 5, 2], ['tallgrass', 3, 8],
  ['tallgrass', 11, 3], ['tallgrass', 8, 8], ['tallgrass', 12, 2],
  // loose grit reads as road wear, so it stays on the dirt
  ['pebbles', 3, 4], ['pebbles', 7, 4], ['pebbles', 12, 4], ['pebbles', 9, 7],
];

const FLOWERS = [
  ['w', 1 * 16 + 6, 2 * 16 + 4], ['r', 5 * 16 + 2, 1 * 16 + 8],
  ['r', 11 * 16 + 6, 6 * 16 + 2], ['w', 7 * 16 + 8, 8 * 16 + 10],
  ['w', 3 * 16 + 10, 8 * 16 + 2], ['r', 7 * 16 + 2, 2 * 16 + 12],
];

export default class EnemiesScene {
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

    this.player = new Player(60, 100);
    this.melee = new Melee();

    this.enemySprites = makeEnemySprites();
    const bounds = { x0: 20, y0: 20, x1: 12 * 16, y1: 8 * 16 };
    // Four beetles, one on each heading, all walking straight away — so a
    // single capture shows every facing's gait rather than a parked machine.
    this.beetles = [
      new ClockworkBeetle(9 * 16, 4 * 16, 'left'),
      new ClockworkBeetle(3 * 16, 1 * 16 + 8, 'down'),
      new ClockworkBeetle(2 * 16, 8 * 16, 'right'),
      new ClockworkBeetle(5 * 16, 7 * 16 + 8, 'up'),
    ];
    // Staggered walk timers: the four patrols never reach their pause phase
    // together, so no capture window can catch the whole screen parked.
    const STAGGER = [40, 85, 130, 175];
    this.beetles.forEach((b, i) => { b.state = 'walk'; b.timer = STAGGER[i]; });
    // A beetle is born with `cool = 90` and re-arms at 130-240 after each
    // vent, so the headline attack fell outside a standard 12-frame /
    // every-10 capture window entirely. One beetle starts already armed, so
    // the wind-up and the steam column are visible in the default capture.
    this.beetles[0].cool = 0;
    this.beetles[2].cool = 30;
    // Perches sit on plain grass — dark-grass patches (cols 9-12 rows 1-2 and
    // cols 1-3 rows 6-7) swallow the plum wings — and the initial perch timers
    // are staggered so at least one bat is airborne in any capture window.
    this.bats = [
      new GearBat(6 * 16 + 8, 2 * 16, bounds),
      new GearBat(8 * 16, 5 * 16, bounds),
    ];
    this.bats[0].timer = 25;
    this.bats[1].timer = 100;
    // Two steam slimes on the open lawn, offset in phase so one is squashing
    // into its telegraph while the other is mid-arc in any capture window.
    this.slimes = [
      new SteamSlime(2 * 16, 5 * 16, bounds),
      new SteamSlime(11 * 16, 2 * 16, bounds),
    ];
    this.slimes[0].timer = 30;
    this.slimes[1].timer = 95;
    for (const e of [...this.beetles, ...this.bats, ...this.slimes]) {
      e.sprites = this.enemySprites;
    }
  }

  _hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }
  _in(set, c, r) { return set.has(`${c},${r}`); }

  _regionTile(set, prefix, c, r) {
    // "grass" means plain lawn: not this region, and not the other overlay
    // region either, so a path edge never tries to blend into dark grass.
    const grassAt = (cc, rr) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
      MAP[rr][cc] === '.' && !this._in(DARK, cc, rr) && !this._in(PATH, cc, rr);
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
    const live = [...this.beetles, ...this.bats, ...this.slimes].filter(e => !e.dead);
    // Sword first (it locks the body the same frame), then movement.
    this.melee.update(engine.input, this.player, live);
    this.player.update(engine.input, this.map);

    const target = { x: this.player.x + 8, y: this.player.y + 16 };
    for (const b of this.beetles) b.update(engine, this.map, target);
    for (const b of this.bats) b.update(engine, this.map, target);
    for (const b of this.slimes) b.update(engine, this.map, target);

    // Contact damage, exactly as overworld.js does it: player body box vs the
    // enemy hurtbox — which for a venting beetle includes its steam column.
    if (this.player.invulnT <= 0 && this.player.kbT <= 0) {
      const pb = { x: this.player.x + 3, y: this.player.y + 9, w: 10, h: 13 };
      for (const e of live) {
        if (e.hp <= 0 || e.state === 'die') continue;
        const hb = e.hurtbox();
        if (!overlaps(pb, hb)) continue;
        if (this.player.hurt(pb.x + pb.w / 2 - (hb.x + hb.w / 2),
          pb.y + pb.h / 2 - (hb.y + hb.h / 2))) {
          this.melee.spawnPoof(pb.x + pb.w / 2, pb.y + pb.h / 2);
        }
        break;
      }
    }
    // Dead enemies leave the roster once their poof has played out.
    this.beetles = this.beetles.filter(e => !e.dead);
    this.bats = this.bats.filter(e => !e.dead);
    this.slimes = this.slimes.filter(e => !e.dead);
  }

  draw(ctx, engine) {
    const t = engine.frame;

    ctx.drawImage(this.skyLayer, 0, 0);
    const c1 = this.sprites.cloud1, c2 = this.sprites.cloud2;
    ctx.drawImage(c1, Math.round(WIDTH - ((t * 0.12) % (WIDTH + c1.width))), 198);
    ctx.drawImage(c2, Math.round(WIDTH - ((t * 0.08 + 150) % (WIDTH + c2.width))), 182);
    ctx.drawImage(this.landLayer, 0, 0);

    for (const [name, c, r] of GROUND) {
      ctx.drawImage(this.sprites[name], c * TILE, r * TILE);
    }

    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of FLOWERS) {
      ctx.drawImage(this.sprites[`flower_${color}${sway}`], x, y);
    }

    // Airborne shadows land on the terrain before anything stands on it —
    // for a hopping slime the shadow is the only cue to where the arc ends.
    for (const b of this.bats) b.drawShadow(ctx);
    for (const b of this.slimes) b.drawShadow(ctx);

    // Y-sorted ground pass: decor, player, beetles, and perched bats.
    const ents = this.map.obstacles.map(ob => ({ baseY: ob.baseY, ob }));
    ents.push({
      baseY: this.player.baseY,
      draw: c => {
        this.melee.drawUnder(c, this.player);
        this.player.draw(c);
        this.melee.drawOver(c, this.player);
      },
    });
    for (const b of this.beetles) ents.push({ baseY: b.baseY, draw: c => b.draw(c) });
    for (const b of this.slimes) {
      if (b.state !== 'hop') ents.push({ baseY: b.baseY, draw: c => b.draw(c) });
    }
    for (const b of this.bats) {
      if (b.state !== 'fly') ents.push({ baseY: b.baseY, draw: c => b.draw(c) });
    }
    ents.sort((a, b) => a.baseY - b.baseY);
    for (const e of ents) {
      if (e.draw) e.draw(ctx);
      else ctx.drawImage(e.ob.img, e.ob.x, e.ob.y);
    }

    // Anything off the ground renders above the ground scene.
    for (const b of this.bats) if (b.state === 'fly') b.draw(ctx);
    for (const b of this.slimes) if (b.state === 'hop') b.draw(ctx);

    // Sword sparks / hurt poofs on top of everything.
    this.melee.drawFx(ctx);
  }
}
