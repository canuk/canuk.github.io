// Tiles demo: one full screen (16x14) of a floating-island edge.
// The island's south band and east rim are one continuous authored rock mass
// (see ISLE in game/tileset.js) sliced into tiles, so the strata, the chunky
// silhouette and the rounded corner all read as a single cliff instead of a
// repeating sawtooth. On top: a winding olive path, tile-aligned dark-grass
// fields, fence rows, bush clusters, rocks, tall grass, flowers, brass-banded
// orchard trees and a steam vent plumbed down over the cliff face.
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeTileset, ISLE, CLOUD_DECK } from '../game/tileset.js';

const COLS = 16, ROWS = 14;

// '.' grass (variant auto), I island-edge rock, K sky,
// U cloud-sea tops, V cloud body.
const MAP = [
  '............IIIK',
  '............IIIK',
  '............IIIK',
  '............IIIK',
  '............IIIK',
  '............IIIK',
  '............IIIK',
  '............IIIK',
  'IIIIIIIIIIIIIIIK',
  'IIIIIIIIIIIIIIIK',
  'IIIIIIIIIIIIIIIK',
  'IIIIIIIIIIIIIIIK',
  'UUUUUUUUUUUUUUUU',
  'VVVVVVVVVVVVVVVV',
];

// Path: enters at the north (cols 4-5), bends east along rows 5-6, then runs
// south into the flagstone lookout terrace that sits on the cliff top.
const PATH = new Set();
for (let r = 0; r <= 4; r++) { PATH.add(`4,${r}`); PATH.add(`5,${r}`); }
for (let c = 4; c <= 9; c++) { PATH.add(`${c},5`); PATH.add(`${c},6`); }
PATH.add('8,7'); PATH.add('9,7');

// Dark grass fields: chunky tile-aligned stepped blobs, like the big
// light/dark grass fields around the Eastern Palace.
const DARK = new Set();
function addRect(set, c0, r0, c1, r1) {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set.add(`${c},${r}`);
}
addRect(DARK, 0, 2, 1, 2);
addRect(DARK, 0, 3, 2, 3);
addRect(DARK, 0, 4, 1, 4);
addRect(DARK, 9, 0, 10, 0);
addRect(DARK, 10, 1, 10, 1);

// Decor: [spriteName, col, row]
const DECOR = [
  // Fence row partitions the north strip, with a gateway at the path.
  ['fence', 0, 1], ['fence', 1, 1], ['fence', 2, 1], ['fence', 3, 1],
  ['fence', 6, 1], ['fence', 7, 1], ['fence', 8, 1], ['fence', 9, 1],
  ['fence', 10, 1],
  // Bushes: short rows and singles, never merged blobs.
  ['bush', 2, 2], ['bush2', 3, 2],
  ['bush', 10, 3], ['bush2', 10, 4],
  ['bush', 0, 6],
  ['bush2', 6, 7],
  // Rocks: one cluster + singles.
  ['rock', 0, 0], ['rock_small', 1, 0],
  ['rock', 10, 6], ['rock_small', 11, 7],
  ['rock_small', 1, 4], ['rock_small', 6, 2],
  // Tall-grass tufts scattered through the open runs.
  ['tallgrass', 7, 0], ['tallgrass2', 2, 3], ['tallgrass3', 1, 6],
  ['tallgrass2', 7, 2], ['tallgrass', 10, 2], ['tallgrass3', 4, 7],
  ['tallgrass3', 8, 3], ['tallgrass2', 2, 5], ['tallgrass', 11, 5],
  // Pebbles on the dirt path.
  ['pebbles', 4, 2], ['pebbles', 6, 5], ['pebbles', 8, 6], ['pebbles', 5, 4],
  // Waymarker post at the bend where the path turns east.
  ['post', 6, 4],
];

// Pixel-placed structures. The parapet caps the path spur on the cliff top;
// the steam vent stands at the brink with its base collar on the last of the
// grass, so the brass pipe below it runs down the ROCK and never reads as a
// lamppost standing in a lawn.
// The parapet sits at y=114, not 120: its two rows of contact shadow used to
// land at y=136-137, i.e. BELOW the lawn edge and on top of the cliff face, so
// a stone wall was casting its shadow down the outside of the cliff. Lifted
// clear, the shadow ends at y=131 with the lawn edge at 133.
const BUILT = [['parapet', 128, 114], ['vent', 40, 106]];

// Cloud-sea horizon: one authored 512x32 cumulus deck (buildCloudSea in
// game/tileset.js), periodic in x, scrolled per frame under the island's
// cast shadow — see _drawCloudSea below.

// Brass pipe run down the cliff face, drawn after the terrain.
// Brass downpipe going over the rim, well clear of the vent so the two never
// stack into one lamppost silhouette. The flanged cap sits on the brink.
// Moved out to x=184, near the point of the island: a 16px-wide downpipe in
// the middle of the south face blanked out 16 columns of BOTH interior course
// delimiters and of the lawn edge, which is the one stretch of contour the eye
// (and every measurement) reads across. On the last cell before the corner it
// hangs on the same face and covers nothing that has to repeat.
const PIPES = [
  ['pipe_cap', 184, 130], ['pipe_v', 184, 146], ['pipe_end', 184, 162],
];

// Tall anchors: brass-banded orchard trees, 4x4 tiles. [sprite, px, py].
const TREES = [
  ['tree', 96, 0],
  ['tree2', -18, 62],
];

// Flowers: [colorKey, x, y] in pixels, placed in small clusters.
const FLOWERS = [
  ['w', 36, 6], ['r', 52, 10], ['w', 148, 4], ['r', 168, 6],
  ['w', 164, 42], ['r', 168, 84], ['w', 58, 90], ['r', 60, 74],
  ['w', 86, 120], ['r', 120, 118], ['w', 26, 46], ['r', 8, 44],
];

export default class TilesScene {
  async init(engine) {
    const { tiles, sprites } = makeTileset();
    this.tiles = tiles;
    this.sprites = sprites;
    this.skyLayer = this._renderSky();
    this.landLayer = this._renderLand();
    this.deckCv = this._scratch();
    this.shadowCv = this._scratch();
  }

  _hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }

  _in(set, c, r) { return set.has(`${c},${r}`); }

  // Every lawn tile is mottled; ~half also carry a dark tuft mark, so no
  // 3x3-tile expanse goes untouched. Tiles hugging a dark-grass field
  // always get a tuft — an organic fringe along the weave boundary.
  _grassName(c, r) {
    const h = this._hash(c, r);
    const nearDark =
      this._in(DARK, c - 1, r) || this._in(DARK, c + 1, r) ||
      this._in(DARK, c, r - 1) || this._in(DARK, c, r + 1);
    if (nearDark) {
      return ['grass3', 'grass4', 'grass5', 'grass6', 'grass7', 'grass8'][h % 6];
    }
    switch (h % 8) {
      case 1: return 'grass3';
      case 3: return 'grass4';
      case 5: return h % 16 < 8 ? 'grass5' : 'grass7';
      case 7: return h % 16 < 8 ? 'grass6' : 'grass8';
      default: return h % 16 < 8 ? 'grass' : 'grass2';
    }
  }

  // Edge chooser for a region set (path or dark patch) against grass:
  // rounded outer corners, edges, and concave inner corners (grass bites
  // overhanging the region at bends / notches).
  _regionTile(set, prefix, c, r) {
    // The island-edge tiles ('I') carry grass on their upper part, so they
    // count as lawn for edge-picking — a path can run right up to the rim.
    const grassAt = (cc, rr) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
      (MAP[rr][cc] === '.' || MAP[rr][cc] === 'I') && !this._in(set, cc, rr);
    const gN = grassAt(c, r - 1), gS = grassAt(c, r + 1);
    const gW = grassAt(c - 1, r), gE = grassAt(c + 1, r);
    // Three authored masks per straight edge (an 8px bulge, a 4px lawn
    // notch, and a dead-straight run), mixed by hash — so the boundary
    // steps in chunks like a trodden path, not a repeating comb.
    const v = ['', '2', '3', '4'][this._hash(c, r) % 4];
    if (gN && gW) return `${prefix}_nw`;
    if (gN && gE) return `${prefix}_ne`;
    if (gS && gW) return `${prefix}_sw`;
    if (gS && gE) return `${prefix}_se`;
    if (gN) return `${prefix}_n${v}`;
    if (gS) return `${prefix}_s${v}`;
    if (gW) return `${prefix}_w${v}`;
    if (gE) return `${prefix}_e${v}`;
    // Interior tile: check diagonals for a concave (inner) corner.
    if (grassAt(c - 1, r - 1)) return `${prefix}_inw`;
    if (grassAt(c + 1, r - 1)) return `${prefix}_ine`;
    if (grassAt(c - 1, r + 1)) return `${prefix}_isw`;
    if (grassAt(c + 1, r + 1)) return `${prefix}_ise`;
    return prefix === 'path' && (c + r) % 2 ? 'path_c2' : `${prefix}_c`;
  }

  _tileName(c, r) {
    const ch = MAP[r][c];
    switch (ch) {
      case '.':
        if (this._in(PATH, c, r)) return this._regionTile(PATH, 'path', c, r);
        if (this._in(DARK, c, r)) return this._regionTile(DARK, 'dk', c, r);
        return this._grassName(c, r);
      case 'I': return `isle_${c}_${r}`;
      // 'U'/'V' (the cloud sea) are not tiles any more — the deck is one
      // periodic 512x32 strip composited per frame in draw(), so it drifts.
      default: return null; // 'K' sky
    }
  }

  // The cloud sea, drifting. Two 256x32 scratch canvases: `deck` gets the
  // periodic strip drawn twice (wrapped) at the current offset; `shadow` gets
  // the one-step-darker copy of the same strip, then keeps only the pixels
  // inside the island's cast-shadow mask, which is fixed in SCREEN space
  // while the clouds slide underneath it.
  _scratch() {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = CLOUD_DECK.h;
    return cv;
  }

  _drawCloudSea(ctx, t) {
    const { w: dw, h: dh } = CLOUD_DECK;
    const off = Math.floor(t * 0.2) % dw;   // ~12 px/s, a slow tide
    const paint = (c, img) => {
      const g = c.getContext('2d');
      g.clearRect(0, 0, WIDTH, dh);
      g.drawImage(img, -off, 0);
      if (off > dw - WIDTH) g.drawImage(img, dw - off, 0);
    };
    paint(this.deckCv, this.sprites.cloud_deck);
    paint(this.shadowCv, this.sprites.cloud_deck_dark);
    const sg = this.shadowCv.getContext('2d');
    sg.globalCompositeOperation = 'destination-in';
    sg.drawImage(this.sprites.cloud_deck_mask, 0, 0);
    sg.globalCompositeOperation = 'source-over';
    this.deckCv.getContext('2d').drawImage(this.shadowCv, 0, 0);
    ctx.drawImage(this.deckCv, 0, HEIGHT - dh);
  }

  _renderSky() {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const ctx = cv.getContext('2d');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let name = 'sky';
        if ((c * 5 + r * 3) % 11 === 3) name = 'sky2';
        ctx.drawImage(this.tiles[name], c * TILE, r * TILE);
      }
    }
    return cv;
  }

  _renderLand() {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const ctx = cv.getContext('2d');
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const name = this._tileName(c, r);
        if (name) ctx.drawImage(this.tiles[name], c * TILE, r * TILE);
      }
    }
    for (const [name, x, y] of BUILT) {
      ctx.drawImage(this.sprites[name], x, y);
    }
    for (const [name, c, r] of DECOR) {
      ctx.drawImage(this.sprites[name], c * TILE, r * TILE);
    }
    for (const [name, x, y] of TREES) {
      ctx.drawImage(this.sprites[name], x, y);
    }
    for (const [name, x, y] of PIPES) {
      ctx.drawImage(this.sprites[name], x, y);
    }
    return cv;
  }

  update(dt, engine) {}

  draw(ctx, engine) {
    const t = engine.frame;

    // 1. Sky base.
    ctx.drawImage(this.skyLayer, 0, 0);

    // 2. Drifting clouds (land + cloud sea draw over them: they pass below).
    const w1 = this.sprites.cloud1.width, w2 = this.sprites.cloud2.width;
    const x1 = Math.round(WIDTH - ((t * 0.12) % (WIDTH + w1)));
    const x2 = Math.round(WIDTH - ((t * 0.07 + 140) % (WIDTH + w2)));
    const x3 = Math.round(WIDTH - ((t * 0.18 + 60) % (WIDTH + w2)));
    const x4 = Math.round(WIDTH - ((t * 0.09 + 260) % (WIDTH + w1)));
    ctx.drawImage(this.sprites.cloud1, x1, 178);
    ctx.drawImage(this.sprites.cloud2, x2, 150);
    ctx.drawImage(this.sprites.cloud2, x3, 164);
    ctx.drawImage(this.sprites.cloud2, x4, 40);

    // 3. The cloud sea, drifting under its fixed island shadow.
    this._drawCloudSea(ctx, t);

    // 4. Island terrain + baked decor.
    ctx.drawImage(this.landLayer, 0, 0);

    // 5. Flowers (2-frame petal spin).
    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of FLOWERS) {
      ctx.drawImage(this.sprites[`flower_${color}${sway}`], x, y);
    }

    // 6. Steam plume — anchored to the grate at the top of the vent stack and
    // growing upward, so it never detaches into a stray cloud on the lawn.
    const phase = Math.floor((t % 72) / 24);
    ctx.drawImage(this.sprites[`steam${phase + 1}`], 40, 92);
  }
}
