// Gearwind items — THE BELLOWS CUFF, dungeon keys, map and compass.
//
// THE BELLOWS CUFF (STORY.md beat 4): a brass forearm bellows strapped over
// Wren's sleeve. B fires a short-range blast of compressed air. It does no
// damage. What it does is change the VERB of the world:
//
//   * spins GEAR-SWITCHES        — the Boilerworks' lock mechanism
//   * STAGGERS enemies           — armour drops, the enemy reels, blade opens
//   * SNUFFS steam jets ~2s      — timed hazards become passable on demand
//   * SHOVES light crates a tile — geometry becomes editable
//
// Feel: 6 frames of wind-up (the bellows compresses, Wren braces), the blast
// itself lives 14 frames and is ACTIVE on frames 0-8, then 10 frames of
// recovery before it can fire again. The player is body-locked for the first
// 8 frames only, so it never feels sticky.
//
// The puff is authored as a CONE of chunky lobes with a hard outline — no
// alpha, no gradient, four art frames. A SNES compressed-air blast is a solid
// object, not a fade.

import { makeSprite, flipH } from '../sprites.js';
import { drawDialogText } from './dialog.js';

// ---------------------------------------------------------------------------
// Palette — brass fittings, dark leather bellows, cool steam
// ---------------------------------------------------------------------------
export const CUFF_PAL = {
  k: '#1c120a', x: '#0d0a08',
  B: '#e8c65c', b: '#c09a30', z: '#7c6018',
  o: '#9a6a34', O: '#c08f4e', p: '#61411c',
  w: '#f4f6f8', W: '#c8d4e0', v: '#8496ac', Q: '#2b3340',
  t: '#c8ccd4', u: '#8f97a4', y: '#5c6472',
  e: '#d9482b', E: '#8c2c1a',
  g: '#f08828', G: '#f8d048',
  I: '#3a3630', i: '#26231e', J: '#4c463c',
  F: '#3c4450', L: '#4e5866', D: '#22262e',
};

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

// 16x16 HUD icon: the cuff seen three-quarter, bellows folds visible, brass
// nozzle to the right. Reads at 1x as "a thing you wear that blows".
const CUFF_ICON = [
  '................',
  '................',
  '...kkkkkkk......',
  '..kzbbbbbzk.....',
  '.kzbBBBBBbzk....',
  '.kbBzppppzbk....',
  '.kbBzpOOpzbkkk..',
  '.kbBzpOOpzbkBBk.',
  '.kbBzpOOpzbkBBk.',
  '.kbBzppppzbkkk..',
  '.kzbBBBBBbzk....',
  '..kzbbbbbzk.....',
  '...kkkkkkk......',
  '................',
  '................',
  '................',
];

// Dungeon map icon (a folded chart) and compass (a brass needle dial).
const MAP_ICON = [
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kwwWwwWwwWwwwk.',
  '.kwWkkWwwWkkWwk.',
  '.kwkeekWwkeekwk.',
  '.kwWkkWwwWkkWwk.',
  '.kwwWwwWwwWwwwk.',
  '.kwWwwWkkWwwWwk.',
  '.kwwkkwkekwkkwk.',
  '.kwWwwWkkWwwWwk.',
  '.kwwWwwWwwWwwwk.',
  '..kkkkkkkkkkkk..',
  '................',
  '................',
  '................',
];

const COMPASS_ICON = [
  '................',
  '.....kkkkkk.....',
  '...kkzbbbbzkk...',
  '..kzbBBBBBBbzk..',
  '.kzbBwwwwwwBbzk.',
  '.kbBwwwkwwwwBbk.',
  '.kbBwwweewwwBbk.',
  '.kbBwwkeekwwBbk.',
  '.kbBwwweewwwBbk.',
  '.kbBwwwwkwwwBbk.',
  '.kbBwwwwwwwwBbk.',
  '.kzbBwwwwwwBbzk.',
  '..kzbBBBBBBbzk..',
  '...kkzbbbbzkk...',
  '.....kkkkkk.....',
  '................',
];

// Small key + big key, for the item-get pose and the map screen.
const SMALL_KEY = [
  '................',
  '................',
  '....kkkk........',
  '...kzbbzk.......',
  '..kzbkkbzk......',
  '..kbBkkBbk......',
  '..kbBkkBbk......',
  '..kzbkkbzk......',
  '...kzbbzk.......',
  '....kbBk........',
  '....kbBkkk......',
  '....kbBBBk......',
  '....kbBkkk......',
  '....kbBBk.......',
  '.....kkk........',
  '................',
];

const BIG_KEY = [
  '................',
  '...kkkkkk.......',
  '..kzbbbbzk......',
  '.kzbBkkBbzk.....',
  '.kbBkxxkBbk.....',
  '.kbBkxxkBbk.....',
  '.kzbBkkBbzk.....',
  '..kzbBBbzkkk....',
  '...kbBBbkBBk....',
  '...kbBBbkkkk....',
  '...kbBBBBBk.....',
  '...kbBBbkkkk....',
  '...kbBBbkBBk....',
  '...kzbbzkkkk....',
  '....kkkk........',
  '................',
];

// A purse of COGS — the reward behind B1's gear-switch cage, and the reason
// the Bellows Cuff makes the player walk back to the room they started in.
const COG_PURSE = [
  '................',
  '.......kk.......',
  '....kkkppkkk....',
  '...kpOOooOOpk...',
  '..kpOoooooooOpk.',
  '.kpOookkkkooOpk.',
  '.kpOokzbbzkooOk.',
  '.kpOkzbBBbzkoOk.',
  '.kpOkbBkkBbkoOk.',
  '.kpOkzbBBbzkoOk.',
  '.kpOokzbbzkooOk.',
  '.kpOookkkkooOpk.',
  '..kpOoooooooOpk.',
  '...kppOOOOppk...',
  '....kkkkkkkk....',
  '................',
];

// Heart-in-a-jar style pickup used for the dungeon's heart piece is owned by
// boilerworks.js; nothing to author here.

/**
 * The air blast, as a cone of chunky lobes pointing RIGHT. 28x20, four
 * frames. Generated rather than hand-typed so the cone stays symmetrical and
 * the lobes stay on a consistent beat; every pixel still lands on one of four
 * flat palette entries with a hard outline.
 */
function puffRows(f) {
  const W = 36, H = 22;
  const cx = -6, cy = 10.5;
  const inner = [0, 4, 11, 19][f];
  const outer = [14, 23, 31, 39][f];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let s = '';
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx <= 0) { s += '.'; continue; }
      const d = Math.hypot(dx, dy * 1.25);
      const ang = Math.abs(Math.atan2(dy, dx));
      const spread = 0.60;
      const lobe = Math.sin(y * 1.05 + f * 1.7) * 1.3;
      if (ang > spread || d < inner - 1 || d > outer + lobe) { s += '.'; continue; }
      const e = Math.min(d - (inner - 1), (outer + lobe) - d, (spread - ang) * d * 0.95);
      if (e < 1) { s += 'Q'; continue; }          // hard outline, all round
      // CHEVRONS. A cone shaded only by its distance to the edge is a white
      // lump: it says "something happened here" and nothing about WHERE it is
      // going. Concentric arcs travelling outward plus a bright leading rim
      // give the blast a direction you can read in one frame.
      const band = ((d - inner) / 4.6) % 1;
      if ((outer + lobe) - d < 2.6) s += 'w';     // leading rim, brightest
      else if (band < 0.28) s += 'v';             // the shadow behind each arc
      else if (band < 0.52) s += 'W';
      else s += 'w';
    }
    rows.push(s);
  }
  return rows;
}

/** Pixel-exact clockwise rotation of a canvas. */
function rotate90(img) {
  const w = img.width, h = img.height;
  const src = img.getContext('2d').getImageData(0, 0, w, h);
  const c = document.createElement('canvas');
  c.width = h; c.height = w;
  const ctx = c.getContext('2d');
  const out = ctx.createImageData(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = (x * h + (h - 1 - y)) * 4;
      for (let k = 0; k < 4; k++) out.data[di + k] = src.data[si + k];
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

let SPR = null;
export function makeItemSprites() {
  if (SPR) return SPR;
  const S = rows => makeSprite(rows, CUFF_PAL);
  const right = [0, 1, 2, 3].map(f => S(puffRows(f)));
  SPR = {
    cuff: S(CUFF_ICON),
    map: S(MAP_ICON),
    compass: S(COMPASS_ICON),
    smallKey: S(SMALL_KEY),
    bigKey: S(BIG_KEY),
    cogs: S(COG_PURSE),
    puff: {
      right,
      left: right.map(flipH),
      down: right.map(rotate90),
      up: right.map(i => rotate90(rotate90(rotate90(i)))),
    },
  };
  return SPR;
}

// ---------------------------------------------------------------------------
// The Cuff controller
// ---------------------------------------------------------------------------

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const WINDUP = 6;      // frames the bellows compresses before the blast
const BLAST = 14;      // frames the puff is on screen
const ACTIVE = 9;      // of those, how many carry the effect
const RECOVER = 10;    // frames after the blast before B works again

export class BellowsCuff {
  constructor() {
    this.spr = makeItemSprites();
    this.t = -1;            // -1 idle; 0..WINDUP-1 wind-up; then blast
    this.dir = 'down';
    this.cool = 0;
    this.hit = new Set();   // things already blasted this swing
    this.onSfx = null;
  }

  get windingUp() { return this.t >= 0 && this.t < WINDUP; }
  get blasting() { return this.t >= WINDUP; }
  get active() { return this.t >= 0; }
  /** Body lock: the wind-up plus the first frames of the blast. */
  get locks() { return this.t >= 0 && this.t < WINDUP + 8; }

  sfx(name) {
    if (this.onSfx) this.onSfx(name);
    else if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  }

  /** The blast rectangle in world space, or null when it is not live. */
  box(player) {
    if (!this.blasting) return null;
    const f = this.t - WINDUP;
    if (f >= ACTIVE) return null;
    const [dx, dy] = DIRV[this.dir];
    // Reach matches the art (36px of cone). The old 32px box made aiming at
    // KETTLEBACK's chimney fussy in a way the fight was never about.
    const reach = 14 + Math.min(26, f * 3.6);      // the cone grows outward
    const cx = player.x + 8, cy = player.y + 15;
    if (dx) {
      return {
        x: dx > 0 ? cx + 4 : cx - 4 - reach, y: cy - 12,
        w: reach, h: 24,
      };
    }
    return {
      x: cx - 12, y: dy > 0 ? cy + 2 : cy - 2 - reach,
      w: 24, h: reach,
    };
  }

  /**
   * Fire if B was pressed. `player` is body-locked while `locks` is true —
   * the scene must check that BEFORE calling player.update().
   */
  update(input, player, opts = {}) {
    if (this.cool > 0) this.cool--;
    if (this.t >= 0) {
      this.t++;
      // THE B BUTTON MUST CLICK. `steam` is the ROOM's hazard jet — a 0.62 s
      // swell whose energy arrives 118 ms after the trigger — and firing it
      // here put a swell on the chapter's primary action button and gave the
      // Cuff the same voice as the thing it is used to switch OFF. `cuff` is
      // the sound written for this frame: everything peaks inside 6 ms.
      if (this.t === WINDUP) this.sfx('cuff');
      if (this.t >= WINDUP + BLAST) { this.t = -1; this.cool = RECOVER; this.hit.clear(); }
      return;
    }
    if (opts.enabled === false) return;
    if (this.cool > 0) return;
    if (!input.hit('b')) return;
    this.t = 0;
    this.dir = player.dir;
    this.hit.clear();
  }

  /**
   * Apply the blast to everything it touches. Call once per frame after
   * update(). `targets` supplies the four things the Cuff can act on.
   *
   * @param {object} t  { switches, enemies, crates, vents, map, onEvent }
   */
  apply(player, t) {
    const box = this.box(player);
    if (!box) return;
    const [dx, dy] = DIRV[this.dir];
    const ev = t.onEvent || (() => { });

    for (const g of t.switches || []) {
      if (this.hit.has(g) || !overlap(box, g.blastbox())) continue;
      this.hit.add(g);
      if (g.hitByCuff()) { this.sfx('gear'); ev('switch', g); }
    }
    for (const c of t.crates || []) {
      if (this.hit.has(c) || !overlap(box, c.blastbox())) continue;
      this.hit.add(c);
      // A loaded crate skidding a whole tile over boiler-deck plate is mass
      // and scatter, not the grass swish `bush` was written for (its caption
      // is "GRASS CUT", and there is no grass underground). `smash` is the
      // bank's crate sound: a 250->88 Hz thump with shards behind it.
      if (c.shove(dx, dy, t.map)) { this.sfx('smash'); ev('crate', c); }
    }
    for (const v of t.vents || []) {
      if (this.hit.has(v)) continue;
      const vb = { x: v.x, y: v.y - 8, w: 16, h: 24 };
      if (!overlap(box, vb)) continue;
      this.hit.add(v);
      // `snuff` is literally captioned "CUFF KILLS A JET" — pressure
      // collapsing, the answer to `steam` rather than another copy of it.
      // Firing `steam` here meant one press at a vent played `steam` twice
      // (blast + snuff), so the jet going out sounded like a jet coming on.
      if (v.snuffOut()) { this.sfx('snuff'); ev('vent', v); }
    }
    for (const e of t.enemies || []) {
      if (this.hit.has(e) || e.dead || e.hp <= 0) continue;
      const hb = e.blastbox ? e.blastbox() : e.hurtbox();
      if (!overlap(box, hb)) continue;
      this.hit.add(e);
      if (e.hitByCuff && e.hitByCuff(dx, dy)) { this.sfx('hit'); ev('stagger', e); }
    }
  }

  /** The puff, drawn over the world (never behind the player). */
  draw(ctx, player) {
    if (!this.blasting) return;
    const f = this.t - WINDUP;
    const idx = Math.min(3, Math.floor(f / 3.5));
    const img = this.spr.puff[this.dir][idx];
    const cx = Math.round(player.x) + 8, cy = Math.round(player.y) + 15;
    let x = cx, y = cy;
    if (this.dir === 'right') { x = cx + 2; y = cy - 11; }
    else if (this.dir === 'left') { x = cx - 2 - img.width; y = cy - 11; }
    else if (this.dir === 'down') { x = cx - 11; y = cy + 1; }
    else { x = cx - 11; y = cy - 1 - img.height; }
    ctx.drawImage(img, x, y);
  }

  /**
   * The cuff worn on Wren's arm, drawn over the body so the item is visible
   * in the world and not only in the HUD. 4x4 brass block at the wrist.
   */
  drawWorn(ctx, player) {
    const px = Math.round(player.x), py = Math.round(player.y);
    const brace = this.windingUp ? 1 : 0;
    const pos = {
      down: [2, 14], up: [11, 14], left: [1, 13], right: [11, 13],
    }[player.dir] || [2, 14];
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(px + pos[0] - 1, py + pos[1] - 1 - brace, 5, 5);
    ctx.fillStyle = '#e8c65c';
    ctx.fillRect(px + pos[0], py + pos[1] - brace, 3, 3);
    ctx.fillStyle = '#7c6018';
    ctx.fillRect(px + pos[0] + 2, py + pos[1] + 2 - brace, 1, 1);
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------------------------------------------------------------------------
// Dungeon map / compass screen
//
// ALttP's map screen: a dark panel, the dungeon's rooms as filled cells with
// the corridors between them drawn as short links, YOUR room flashing, and —
// once the compass is found — the boss room marked.
// ---------------------------------------------------------------------------

const CELL_W = 22, CELL_H = 17, GAP = 5;

export class DungeonMapUI {
  /**
   * @param {object} opts  { rooms: {id: {mx,my,doors}}, title, bossId }
   */
  constructor(opts) {
    this.rooms = opts.rooms;
    this.title = opts.title || 'THE BOILERWORKS';
    this.bossId = opts.bossId || null;
    this.spr = makeItemSprites();
    this.open = false;
    this.t = 0;
    const xs = Object.values(this.rooms).map(r => r.mx);
    const ys = Object.values(this.rooms).map(r => r.my);
    this.cols = Math.max(...xs) + 1;
    this.rows = Math.max(...ys) + 1;
    this.w = this.cols * (CELL_W + GAP) - GAP;
    this.h = this.rows * (CELL_H + GAP) - GAP;
    this.x = Math.round((256 - this.w) / 2);
    this.y = 62;
  }

  toggle() { this.open = !this.open; this.t = 0; return this.open; }

  update() { if (this.open) this.t++; }

  cellRect(room) {
    return {
      x: this.x + room.mx * (CELL_W + GAP),
      y: this.y + room.my * (CELL_H + GAP),
      w: CELL_W, h: CELL_H,
    };
  }

  /**
   * @param {object} state { current, visited:Set, hasMap, hasCompass, keys,
   *                         bigKey }
   */
  draw(ctx, state) {
    if (!this.open) return;
    // full-screen dim, then the ALttP panel
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 224);

    panel(ctx, 20, 18, 216, 188);
    drawDialogText(ctx, this.title, 128 - this.title.length * 3.5, 30);

    if (!state.hasMap) {
      // No map: ALttP still shows you the room you are standing in, so you
      // always have SOMETHING to orient by.
      drawDialogText(ctx, 'NO MAP OF THIS PLACE', 128 - 20 * 3.5, 96);
      const r = this.rooms[state.current];
      if (r) {
        const c = this.cellRect(r);
        this._cell(ctx, c, true);
        this._here(ctx, c);
      }
      drawDialogText(ctx, 'YOU ARE HERE', 128 - 12 * 3.5, 140);
    } else {
      // THE WHOLE FLOOR PLAN. The map item in ALttP reveals the dungeon's
      // SHAPE — every room and every door between them — and the compass then
      // marks the boss. Drawing only the rooms you have already walked through
      // makes the map a memory aid for something you already know, which is
      // why the old screen read as a scatter of unconnected grey squares.
      for (const [id, r] of Object.entries(this.rooms)) {
        const a = this.cellRect(r);
        for (const [side, to] of Object.entries(r.doors || {})) {
          if (!this.rooms[to]) continue;
          const b = this.cellRect(this.rooms[to]);
          const both = state.visited.has(id) && state.visited.has(to);
          ctx.fillStyle = both ? '#c09a30' : '#4c463c';
          if (side === 'east') ctx.fillRect(a.x + a.w - 1, a.y + 7, GAP + 2, 3);
          if (side === 'west') ctx.fillRect(b.x + b.w - 1, b.y + 7, GAP + 2, 3);
          if (side === 'south') ctx.fillRect(a.x + 10, a.y + a.h - 1, 3, GAP + 2);
          if (side === 'north') ctx.fillRect(b.x + 10, b.y + b.h - 1, 3, GAP + 2);
        }
      }
      for (const [id, r] of Object.entries(this.rooms)) {
        const c = this.cellRect(r);
        this._cell(ctx, c, state.visited.has(id));
        if (state.hasCompass && id === this.bossId) this._boss(ctx, c);
        if (id === state.current) this._here(ctx, c);
      }
    }

    // inventory strip along the bottom of the panel
    let ix = 40;
    const iy = 168;
    if (state.hasMap) { ctx.drawImage(this.spr.map, ix, iy); ix += 22; }
    if (state.hasCompass) { ctx.drawImage(this.spr.compass, ix, iy); ix += 22; }
    if (state.bigKey) { ctx.drawImage(this.spr.bigKey, ix, iy); ix += 22; }
    if (state.keys > 0) {
      ctx.drawImage(this.spr.smallKey, ix, iy);
      drawDialogText(ctx, 'x' + state.keys, ix + 16, iy + 5);
    }
    drawDialogText(ctx, 'START TO CLOSE', 128 - 14 * 3.5, 192);
  }

  /** One room cell. Walked rooms are lit steel; unwalked are dark outline. */
  _cell(ctx, c, seen) {
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    if (!seen) {
      ctx.fillStyle = '#2c323c';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#22262e';
      ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      return;
    }
    ctx.fillStyle = '#6c7888';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#4e5866';
    ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }

  /** The boss marker: a brass gear-lock pip, only with the compass. */
  _boss(ctx, c) {
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x + 6, c.y + 4, 10, 9);
    ctx.fillStyle = '#c09a30';
    ctx.fillRect(c.x + 7, c.y + 5, 8, 7);
    ctx.fillStyle = '#e8c65c';
    ctx.fillRect(c.x + 8, c.y + 6, 6, 2);
    ctx.fillStyle = '#d9482b';
    ctx.fillRect(c.x + 10, c.y + 8, 2, 3);
  }

  /** YOU ARE HERE — a blinking pip, drawn over whatever else is in the cell. */
  _here(ctx, c) {
    if ((this.t >> 3) % 2 !== 0) return;
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x + 8, c.y + 4, 6, 9);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(c.x + 9, c.y + 5, 4, 7);
    ctx.fillStyle = '#d9482b';
    ctx.fillRect(c.x + 10, c.y + 6, 2, 5);
  }
}

/** ALttP text-box panel: white keyline, dark bevel, black well. */
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#181820';
  ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
  ctx.fillRect(x + 2, y + 3, w - 4, h - 6);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 4, y + 3, w - 8, h - 6);
  ctx.fillRect(x + 3, y + 4, w - 6, h - 8);
}

// ---------------------------------------------------------------------------
// HUD adapter — swaps the shared HUD's item box to the Cuff and retires the
// bomb counter (Gearwind has no bombs). Adapters live HERE so hud.js is
// never edited.
// ---------------------------------------------------------------------------

export function applyDungeonHud(hud, { hasCuff = false } = {}) {
  const spr = makeItemSprites();
  hud.sprites.item = hasCuff ? spr.cuff : blankItem();
  hud.drawBombs = () => { };
  return hud;
}

let BLANK = null;
function blankItem() {
  if (!BLANK) {
    BLANK = document.createElement('canvas');
    BLANK.width = 16; BLANK.height = 16;
  }
  return BLANK;
}
