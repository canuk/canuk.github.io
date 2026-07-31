// Cogwick Hollow — the conversation demo. A dressed village patch with all
// four Chapter 1 villagers, the draw-well, the sealed Boilerworks hatch and
// three stamped-brass signs. Wren walks up to someone and presses A.
//
// EVERY ENTRY POINT DRIVES ITSELF. `at` picks who is talking, parks Wren where
// that conversation happens, and starts it on frame 4, paging forward on a
// fixed cadence — so a bare
//   node tools/capture.js "dialog&at=tam" --frames 6 --every 78 --out shots/x
// shows six of Tam's pages, with no --hold/--press choreography to get wrong.
// (It used to need `--hold left --press a@50`, and a capture whose approach
// missed by a tile silently produced six frames of grass and looked like a
// pass.) Wren still walks and talks under manual input; the script only fires
// if nothing has been pressed.
//
//   at = pell | tam | marla | hesper | sign | shop | low | card | plaque
//        (default: pell)
//   `low` parks him at the bottom of the screen to prove the window flips to
//   the top half rather than burying him.
//   `shop` opens Hesper's counter on frame 1.
//   `card` puts the chapter card up on frame 1 — the SAME window, centred and
//   arrowless — so the last image of Chapter 1 can be captured and measured
//   against a conversation page in one strip without playing to the ending.
//   `plaque` reads the three Boilerworks brass plaques (B1, B2, B5) through
//   this window. Their copy was authored at 28 characters a row for the old
//   208px item box, so every row of B2 measured 149-153 against a 144px
//   measure; this is where you photograph the clause-block pagination that
//   stops "THE KEEPER CARRIES" being severed from "THE OTHER ONE" by a page
//   turn. It is the world agent's copy, read through our typesetter.
import { TILE } from '../engine.js';
import { makeTileset } from '../game/tileset.js';
import { Tilemap } from '../game/tilemap.js';
import { Player } from '../game/player.js';
import { DialogBox, CHAPTER_CARD } from '../game/dialog.js';
import { makeNpcSprites, makeVillager, makeSign, tryTalk } from '../game/npc.js';

const COLS = 16, ROWS = 14;

// The three Boilerworks plaques, copied verbatim from world/maps-dungeon.js
// (B1, B2, B5) so `at=plaque` reads exactly what the dungeon reads. Kept as a
// literal rather than an import: maps-dungeon.js belongs to the world agent and
// this demo must not reach into a dungeon map table to draw a village.
const PLAQUE_TEXT = [
  'BOILERWORKS - LOWER WORKS.\nMIND THE VENTS. THEY KEEP\nTIME BETTER THAN I DO.',
  'SMALL KEYS TURN SMALL LOCKS.\nTHE KEEPER CARRIES THE OTHER\nONE, AND THE KEEPER IS ABOVE.',
  'THREE VALVES, ONE PRESSURE.\nTHE WORKS WILL NOT WAIT FOR\nA SLOW COURIER.',
];

// Dirt road across the hollow plus the spur north past Pell.
const PATH = new Set();
for (let c = 0; c < COLS; c++) PATH.add(`${c},6`);
for (let r = 1; r <= 5; r++) PATH.add(`7,${r}`);
// Worn dirt aprons where the village actually stands: the well plaza and
// the hard-packed ring around the Boilerworks hatch.
for (let c = 1; c <= 3; c++) for (let r = 2; r <= 4; r++) PATH.add(`${c},${r}`);
for (let c = 11; c <= 13; c++) for (let r = 4; r <= 5; r++) PATH.add(`${c},${r}`);

// Shade patches so the lawn is not one flat green.
const DARK = new Set();
for (let c = 10; c <= 12; c++) for (let r = 8; r <= 10; r++) DARK.add(`${c},${r}`);
for (let c = 0; c <= 2; c++) for (let r = 10; r <= 12; r++) DARK.add(`${c},${r}`);
for (let c = 3; c <= 5; c++) for (let r = 1; r <= 2; r++) DARK.add(`${c},${r}`);

// [sprite, col, row, collision rect (tile-local), baseY offset]
const DECOR = [
  ['fence', 0, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 1, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 2, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 3, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 4, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 5, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 9, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 10, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['fence', 11, 0, { x: 2, y: 4, w: 12, h: 6 }, 11],
  ['bush', 5, 2, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 5, 3, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 9, 3, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 9, 4, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 2, 8, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 3, 8, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 13, 10, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 14, 10, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush', 6, 11, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['bush2', 7, 11, { x: 1, y: 2, w: 14, h: 12 }, 14],
  ['rock', 0, 4, { x: 1, y: 4, w: 13, h: 9 }, 13],
  ['rock_small', 6, 9, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['rock_small', 15, 8, { x: 4, y: 7, w: 8, h: 6 }, 13],
  ['post', 10, 7, { x: 4, y: 0, w: 6, h: 12 }, 13],
  ['post', 13, 7, { x: 4, y: 0, w: 6, h: 12 }, 13],
  ['post', 4, 5, { x: 4, y: 0, w: 6, h: 12 }, 13],
  // A brass steam main runs across the south of the hollow and turns up to a
  // vent — this is a sky isle held up by machinery, and the lower lawn was
  // otherwise a green field with nothing in it.
  ['pipe_cap', 4, 12, { x: 2, y: 5, w: 12, h: 8 }, 13],
  ['pipe_h', 5, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_h', 6, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_h', 7, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_h', 8, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_h', 9, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_h', 10, 12, { x: 0, y: 5, w: 16, h: 8 }, 13],
  ['pipe_end', 11, 12, { x: 0, y: 5, w: 14, h: 8 }, 13],
  ['pipe_v', 11, 11, { x: 4, y: 0, w: 8, h: 16 }, 13],
  ['vent', 11, 10, { x: 3, y: 4, w: 10, h: 10 }, 14],
];

// Flat ground detail is scattered by the tile hash rather than hand-placed:
// a quarter of the lawn tiles carry a grass tuft and a third of the road
// tiles carry grit, which is what keeps the 16x16 texture density inside the
// measured ALttP band across the whole screen instead of only near decor.
const TUFTS = ['tallgrass', 'tallgrass2', 'tallgrass3'];

const FLOWERS = [
  ['w', 4 * 16 + 4, 9 * 16 + 6], ['r', 11 * 16 + 2, 4 * 16 + 10],
  ['w', 8 * 16 + 10, 12 * 16 + 2], ['r', 1 * 16 + 8, 8 * 16 + 12],
  ['w', 13 * 16 + 4, 4 * 16 + 4], ['r', 5 * 16 + 12, 10 * 16 + 8],
  ['r', 2 * 16 + 6, 2 * 16 + 2], ['w', 10 * 16 + 12, 8 * 16 + 8],
  ['r', 14 * 16 + 2, 11 * 16 + 4], ['w', 6 * 16 + 6, 4 * 16 + 12],
];

// Where Wren stands for each scripted approach (a --hold walk from here stops
// him exactly in talking range).
const STARTS = {
  pell: [112, 78],
  tam: [64, 36],      // approached from the east (--hold left) so Wren ends
                      // up beside the well instead of standing in front of it
  marla: [168, 132],
  hesper: [88, 100],  // approached from the east with --hold left, so the
                      // capture also proves she turns to face Wren
  shop: [56, 116],
  sign: [144, 138],
  low: [120, 144],    // walk RIGHT to the steam-main plaque (--hold right):
                      // Wren ends up standing where the bottom window would
                      // bury him, so the window must flip to the top half
  default: [112, 78],
};

export default class DialogScene {
  async init(engine) {
    const { tiles, sprites } = makeTileset();
    this.sprites = sprites;
    this.npcArt = makeNpcSprites();

    this.map = new Tilemap(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) this.map.set(c, r, this._tileName(c, r), false);
    }
    for (const [name, c, r, rect, base] of DECOR) {
      const x = c * TILE, y = r * TILE;
      this.map.addObstacle(sprites[name], x, y,
        { x: x + rect.x, y: y + rect.y, w: rect.w, h: rect.h }, y + base);
    }
    // A big tree frames the north-east corner (64x64, partly off-screen).
    this.map.addObstacle(sprites.tree, 190, -8,
      { x: 202, y: 36, w: 40, h: 18 }, 54);

    // Scatter ground detail on the baked layer so it costs nothing per frame.
    this.landLayer = this.map.bake(tiles);
    const lc = this.landLayer.getContext('2d');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h = this._hash(c, r);
        if (this._in(PATH, c, r)) {
          if (h % 3 === 0) lc.drawImage(sprites.pebbles, c * TILE, r * TILE);
        } else if (!this._in(DARK, c, r) && h % 4 === 1) {
          lc.drawImage(sprites[TUFTS[h % 3]], c * TILE, r * TILE);
        }
      }
    }

    // --- props ---------------------------------------------------------
    // The well is 32x40 (crossbar, posts, bucket, ring, shaft). Its baseY sits
    // just above Tam's so he, on the front rim, always draws over the mouth.
    const P = this.npcArt.props;
    this.props = [
      { img: P.well, x: 24, y: 14, baseY: 46, rect: { x: 28, y: 38, w: 24, h: 13 } },
      { img: P.hatch, x: 184, y: 78, baseY: 92, rect: { x: 187, y: 82, w: 26, h: 14 } },
    ];
    for (const p of this.props) this.map.obstacles.push({ img: null, rect: p.rect, baseY: p.baseY });

    // --- conversation --------------------------------------------------
    this.box = new DialogBox();
    this.wallet = { cogs: 45 };   // enough for the jar, short of the charm
    this.flags = {};
    const ctx = { sprites: this.npcArt, box: this.box, wallet: this.wallet, flags: this.flags };

    this.npcs = [
      makeVillager('pell', 112, 24, ctx),
      makeVillager('tam', 38, 26, ctx),
      makeVillager('marla', 168, 84, ctx),
      makeVillager('hesper', 56, 92, ctx),
    ];
    this.signs = [
      makeSign('village', 144, 88, ctx),
      makeSign('hatch', 216, 84, ctx),
      makeSign('shop', 32, 98, ctx),
      makeSign('pipes', 152, 148, ctx),
    ];
    this.talkables = [...this.npcs, ...this.signs];
    for (const e of this.talkables) {
      this.map.obstacles.push({ img: null, rect: e.rect, baseY: e.baseY });
    }

    const at = engine.params.get('at') || 'default';
    const [sx, sy] = STARTS[at] || STARTS.default;
    this.player = new Player(sx, sy);
    this.player.dir = 'up';

    // The shop demo skips straight into Hesper's counter on frame 1.
    if (at === 'shop') this.npcs[3].talk(this.box);
    // The card demo puts the chapter's closing card up on frame 1.
    if (at === 'card') this.box.card(CHAPTER_CARD.join('\n'));
    // The plaque demo reads the Boilerworks brass, verbatim from the dungeon.
    if (at === 'plaque') this.box.say(PLAQUE_TEXT);

    // Who the scripted capture talks to. `low` and `sign` walk into a plaque
    // rather than a person; everything else is a villager.
    const [pell, tam, marla, hesper] = this.npcs;
    const [signVillage, , , signPipes] = this.signs;
    this.demoTarget = {
      pell, tam, marla, hesper, sign: signVillage, low: signPipes,
      shop: hesper, default: pell,
    }[at] || null;
    // `shop` and `card` have already opened the window on frame 1, so the
    // script only pages them forward; everything else starts its own.
    this.demoOpens = at !== 'shop' && at !== 'card' && at !== 'plaque';
    if (at === 'plaque') this.demoTarget = this.signs[0];   // script pages it on
    this.demo = 0;
  }

  // ---- tiles ----------------------------------------------------------
  _hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }
  _in(set, c, r) { return set.has(`${c},${r}`); }

  _regionTile(set, prefix, c, r) {
    const grassAt = (cc, rr) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
      !this._in(DARK, cc, rr) && !this._in(PATH, cc, rr);
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

  // Same lawn weave as the tileset demo: every grass tile is mottled and
  // about half carry a tuft, with a guaranteed tuft fringe along dark-grass
  // boundaries. Keeps the 16x16 texture density inside the measured ALttP
  // band instead of leaving big untouched expanses.
  _grassName(c, r) {
    const h = this._hash(c, r);
    return ['grass3', 'grass4', 'grass5', 'grass6', 'grass7', 'grass8'][h % 6];
  }

  _tileName(c, r) {
    if (this._in(PATH, c, r)) return this._regionTile(PATH, 'path', c, r);
    if (this._in(DARK, c, r)) return this._regionTile(DARK, 'dk', c, r);
    return this._grassName(c, r);
  }

  // ---- loop -----------------------------------------------------------
  update(dt, engine) {
    for (const n of this.npcs) n.update(engine);

    if (this.demo >= 0) this._demo(engine);

    if (this.box.active) {
      this.box.update(engine.input);
      this.player.moving = false;
      return;
    }
    // tryTalk consumes the A press when a conversation starts; the player's
    // own A handling (the sword) must not also fire this frame.
    const talked = tryTalk(this.player, this.talkables, engine.input, this.box);
    if (talked) { this.player.moving = false; return; }
    this.player.update(engine.input, this.map);
  }

  // Scripted playback. Starts the `at` conversation on frame 4 and turns the
  // page every 78 frames — a beat longer than the longest page takes to type at
  // 45cps, so a capture at --every 78 lands one frame per page with the text
  // finished. Any real input hands control straight back to the player.
  _demo(engine) {
    const f = engine.frame;
    const t = this.demoTarget;
    if (!t) { this.demo = -1; return; }
    if (engine.input.down.size) { this.demo = -1; return; }
    if (f === 4 && this.demoOpens) {
      this.box.anchorForPlayer(this.player.y);
      t.facing = 'down';
      t.talk(this.box);
    } else if (f > 4 && (f - 4) % 78 === 0) {
      this.box.press();
    }
  }

  draw(ctx, engine) {
    const t = engine.frame;
    ctx.drawImage(this.landLayer, 0, 0);

    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of FLOWERS) {
      ctx.drawImage(this.sprites[`flower_${color}${sway}`], x, y);
    }

    // Y-sorted pass: decor, props, signs, villagers, Wren.
    const ents = [];
    for (const ob of this.map.obstacles) {
      if (ob.img) ents.push({ baseY: ob.baseY, draw: c2 => c2.drawImage(ob.img, ob.x, ob.y) });
    }
    for (const p of this.props) {
      ents.push({ baseY: p.baseY, draw: c2 => c2.drawImage(p.img, p.x, p.y) });
    }
    for (const e of this.talkables) ents.push({ baseY: e.baseY, draw: c2 => e.draw(c2) });
    ents.push({ baseY: this.player.baseY, draw: c2 => this.player.draw(c2) });
    ents.sort((a, b) => a.baseY - b.baseY);
    for (const e of ents) e.draw(ctx);

    this.box.draw(ctx);
  }
}
