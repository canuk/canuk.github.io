// THE BOILERWORKS — dungeon tileset, room chrome, props and dungeon enemies.
//
// Art discipline (SPEC.md / PALETTE.md):
//   * 16x16 tiles, dark COLOURED outlines (#1c120a, a warm near-black — never
//     pure black), 3-4 shade ramps per material, no gradients, no alpha.
//   * Floor is a running-bond steel deck: 32x16 riveted plates, cool blue-grey
//     (#3c4450, the same value/sat neighbourhood as ALttP's #383858 dungeon
//     flagstone), seams on the plate edges, four rivets per plate.
//   * Walls are a COPPER BOILER COURSE. ALttP dungeon walls read as a lit
//     inner band with a distinct top-face and a dark outer band (measure
//     refs/dungeon-boss-helmasaur-king.png: grey relief band inside, near-black
//     band outside). Here the inner ring is a riveted copper course with a
//     bright lip facing the floor and a dark shadow line under it; the outer
//     ring is dark iron ceiling plate.
//   * The vertical wall course is the literal TRANSPOSE of the horizontal one,
//     so a room's frame never breaks rhythm at the corners.
//
// This file owns:  tiles + prop sprites, the room chrome builder, the props
// (steam vent, gear switch, crate, chest, door, plaque, boiler), and the two
// dungeon-only enemies (TIN SOLDIER, THE RIVETER).
// It imports from tilemap.js / sprites.js and NEVER edits shared modules.

import { makeSprite, makeTiles, flipH } from '../../sprites.js';
import { TILE } from '../../engine.js';
import { Tilemap } from '../tilemap.js';
// THE HIT REACTION IS ONE SET OF NUMBERS FOR THE WHOLE GAME. game/enemies.js
// owns them (HIT.STOP / FLASH / KB_T / KB_PEAK); the dungeon's own creatures
// import them rather than carrying a second, softer copy. See the protocol
// block below for why the three helpers are re-declared here.
import { HIT } from '../enemies.js';

// ---------------------------------------------------------------------------
// Palette. Six material families, none over 8 shades:
//   iron ceiling / steel floor / copper wall / brass fittings / steam / heat
// ---------------------------------------------------------------------------
export const DPAL = {
  k: '#1c120a', // warm near-black outline
  x: '#0d0a08', // void (door openings, pits)

  // copper boiler plate — walls
  M: '#7d4f26', T: '#9a6a32', S: '#543214', s: '#38200c', R: '#c99a46',

  // dark iron — ceiling / outer ring
  I: '#3a3630', i: '#26231e', J: '#4c463c',

  // steel deck — floor
  F: '#3c4450', L: '#4e5866', D: '#22262e', P: '#2c323c', V: '#6c7888',

  // brass fittings
  B: '#e8c65c', b: '#c09a30', z: '#7c6018',

  // copper pipework (brighter than the wall so pipes read proud of it)
  c: '#c07840', C: '#e09858', n: '#8a5228', N: '#5a3418',

  // steam (gauge glass / specular)
  w: '#f4f6f8', W: '#c8d4e0', v: '#8496ac', Q: '#2b3340',

  // steam PLUME — cooler than white so it never becomes the brightest thing
  // on screen, and light enough at the edge to dither into the deck.
  q: '#dae6f2', A: '#aec2d8', U: '#7c90ac',

  // cast shadow: what a wall drops onto the deck. ALttP's dungeon shadow band
  // is a flat near-black (measured (24,24,24) over a (56,56,88) floor) — a
  // hard edge, no gradient.
  d: '#1a1e26', f: '#22262e',

  // heat / glow
  g: '#f08828', G: '#f8d048', h: '#c04818',

  // signal green — reserved for "this mechanism is LIVE" (valve caps, plates)
  l: '#68d048', m: '#2c7c24',

  // tin (soldiers, rivets)
  t: '#c8ccd4', u: '#8f97a4', y: '#5c6472',

  // red accent (plumes, eyes, warning paint)
  e: '#d9482b', E: '#8c2c1a',

  // wood (crates, pike shafts)
  o: '#9a6a34', O: '#c08f4e', p: '#61411c',
};

// ---------------------------------------------------------------------------
// String-grid helpers (all pure, all validated)
// ---------------------------------------------------------------------------

function assertGrid(name, rows, w, h) {
  if (h && rows.length !== h) {
    throw new Error(`${name}: ${rows.length} rows, expected ${h}`);
  }
  rows.forEach((r, i) => {
    if (r.length !== w) {
      throw new Error(`${name} row ${i}: ${r.length} cols, expected ${w} ("${r}")`);
    }
  });
  return rows;
}

/** Transpose a square string grid (rows[y][x] -> rows[x][y]). */
function transpose(rows) {
  const n = rows.length;
  const out = [];
  for (let x = 0; x < rows[0].length; x++) {
    let s = '';
    for (let y = 0; y < n; y++) s += rows[y][x];
    out.push(s);
  }
  return out;
}

const flipRows = rows => [...rows].reverse();
const flipCols = rows => rows.map(r => [...r].reverse().join(''));

/** Clockwise 90-degree rotation of a string grid. */
function rot90(rows) {
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let s = '';
    for (let y = h - 1; y >= 0; y--) s += rows[y][x];
    out.push(s);
  }
  return out;
}

/** Overlay `art` onto `rows` at (x0,y0); '.' in art means "leave alone". */
function stamp(rows, x0, y0, art) {
  const g = rows.map(r => [...r]);
  art.forEach((ar, dy) => {
    [...ar].forEach((ch, dx) => {
      if (ch === '.') return;
      const y = y0 + dy, x = x0 + dx;
      if (g[y] && g[y][x] !== undefined) g[y][x] = ch;
    });
  });
  return g.map(r => r.join(''));
}

/** Build a full row from a 24-char left half by mirroring it. */
const mirror = half => half + [...half].reverse().join('');

/** Flip a canvas vertically (pixel-exact, no smoothing). */
export function flipV(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.translate(0, img.height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0);
  return c;
}

/** Solid-colour silhouette of a sprite (SNES palette flash; no alpha). */
export function tint(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// ===========================================================================
// TILES
// ===========================================================================

// --- floor: 32x16 riveted steel plates in a running bond -------------------

const PL_A = [ // left half of a plate: seam down the left edge
  'DDDDDDDDDDDDDDDD',
  'DLLLLLLLLLLLLLLL',
  'DLFFFFFFFFFFFFFF',
  'DLFVVFFFFFFFFFFF',
  'DLFVPFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFVVFFFFFFFFFFF',
  'DLFVPFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DPPPPPPPPPPPPPPP',
];

const PL_B = [ // right half: rivets on the far side, no vertical seam
  'DDDDDDDDDDDDDDDD',
  'LLLLLLLLLLLLLLLL',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFVVFFF',
  'FFFFFFFFFFFVPFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFVVFFF',
  'FFFFFFFFFFFVPFFF',
  'FFFFFFFFFFFFFFFF',
  'FFFFFFFFFFFFFFFF',
  'PPPPPPPPPPPPPPPP',
];

// weld scar + spare bolts — the "worn" plate
const PL_C = stamp(PL_B, 4, 6, [
  'PPPP.',
  '.LL..',
  '..PP.',
]);

// rust bloom — warm dots on the cold deck
const PL_D = stamp(PL_A, 6, 5, [
  '..SS..',
  '.SsSS.',
  'SsssS.',
  '.SSs..',
  '..SS..',
]);

// drain grate: slotted, sunk, with a lit rim
const PL_GRATE = [
  'DDDDDDDDDDDDDDDD',
  'DLLLLLLLLLLLLLLL',
  'DLFFFFFFFFFFFFFF',
  'DLFkkkkkkkkkkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkkkkkkkkkkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkxxkxxkxxkFFF',
  'DLFkkkkkkkkkkFFF',
  'DLFVPFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DPPPPPPPPPPPPPPP',
];

// The steam-vent floor port. ALttP always leaves a hazard's FIXTURE on the
// tile — the plume is the state, the hardware is the object. So this tile
// carries a burnt rust ring scorched into the deck plus the sunk brass
// collar, and it is on screen whether the vent is firing or not.
const PL_VENT = [
  'DDDDDDDDDDDDDDDD',
  'DLLLLLLLLLLLLLLL',
  'DLFFhhhhhhhhFFFF',
  'DLFhhSSSSSSShhFF',
  'DLhhSkkkkkkShhFF',
  'DLhSkzbbbbzkShhF',
  'DLhSkbxxxxbkShhF',
  'DLhSkbxxxxbkShhF',
  'DLhSkzbbbbzkShhF',
  'DLhhSkkkkkkShhFF',
  'DLFhhSSSSSSShhFF',
  'DLFFhhhhhhhhFFFF',
  'DLFFFhhSShhFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DLFFFFFFFFFFFFFF',
  'DPPPPPPPPPPPPPPP',
];

// The nozzle itself, standing proud of the deck so the vent has a silhouette
// even when it is cold. 12x9, drawn every frame at (x+2, y+3).
const VENT_NOZ = [
  '..kkkkkkkk..',
  '.kzbbbbbbzk.',
  'kzbBBBBBBbzk',
  'kbBkxxxxkBbk',
  'kbBxxxxxxBbk',
  'kbBkxxxxkBbk',
  'kzbBBBBBBbzk',
  '.kzbbbbbbzk.',
  '..kkkkkkkk..',
];

// --- ALTERNATE DECKS -------------------------------------------------------
//
// Eastern Palace changes its floor pattern between wings, and a dungeon that
// re-dresses ONE floor eight times reads as one room eight times. The
// Boilerworks gets four decks, one per wing, all in the same steel ramp so the
// palette never grows: the plate (entry), diamond TREAD (the map wing), the
// grated CATWALK (the gauntlet wing) and the brass-bolted HALL plate (the
// boiler hall and the cradle arena).

// Diamond tread-plate: 8px courses of diagonal dashes, alternating direction
// per course. Everything is mod-8 on a 16px tile, so it tiles both ways.
function treadRows(v) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const band = ((y >> 3) & 1) ^ (v ? 1 : 0);
    let s = '';
    for (let x = 0; x < 16; x++) {
      const u = (band ? x + y : x - y + 16) & 7;
      s += u === 0 ? 'V' : u === 1 ? 'P' : 'F';
    }
    rows.push(s);
  }
  for (const y of [0, 8]) rows[y] = 'D'.repeat(16);
  return rows;
}

// Grated catwalk: slotted bands with cross-bars, and it sits a value DARKER
// than the plate because this wing is deeper in the works.
function slatRows(v) {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const m = (y + (v ? 4 : 0)) & 7;
    // 8px slats: a dark slot, the lit top edge of the next slat, base deck,
    // and the shadow it casts. The BASE stays the same steel as every other
    // deck in the dungeon — a wing that swaps the dominant floor colour stops
    // being a different floor and starts being a different game.
    rows.push(m === 0 ? 'D'.repeat(16)
      : m === 1 ? 'L'.repeat(16)
        : m === 7 ? 'P'.repeat(16) : 'F'.repeat(16));
  }
  // two cross-bars, so it reads as a GRID of grating panels, not as stripes
  for (let y = 0; y < 16; y++) {
    let r = rows[y];
    for (const x of [3, 11]) r = r.slice(0, x) + 'P' + r.slice(x + 1);
    rows[y] = r;
  }
  return rows;
}

// Conveyor-gear floor: a toothed belt track. Three phases = it visibly runs.
// BUILT OUT OF THE DECK'S OWN RAMP. The first cut used a separate dark-iron
// ramp (i/I/J) plus a second brass (z) on top of the deck's steel — seven
// colours in a tile that lands half in and half out of a 16px block, and B1
// measured 7.0 distinct colours per 16x16 against ALttP's 2.2-6.6 while every
// other room in the dungeon sat between 4.5 and 6.5. The belt is now the
// deck's own D/L steel with the near-black frame and one brass for the teeth,
// which is four colours; the teeth are what say "conveyor", not the ramp.
function conveyorRows(phase) {
  const rows = [
    'kkkkkkkkkkkkkkkk',
    'DDDDDDDDDDDDDDDD',
    'DLLLLLLLLLLLLLLD',
    'LLLLLLLLLLLLLLLL',
    'kkkkkkkkkkkkkkkk',
    '................', // teeth row (filled below)
    '................',
    'kkkkkkkkkkkkkkkk',
    'LLLLLLLLLLLLLLLL',
    'DLLLLLLLLLLLLLLD',
    'kkkkkkkkkkkkkkkk',
    '................',
    '................',
    'kkkkkkkkkkkkkkkk',
    'LLLLLLLLLLLLLLLL',
    'DDDDDDDDDDDDDDDD',
  ];
  const tooth = (off) => {
    let a = '', b = '';
    for (let x = 0; x < 16; x++) {
      const on = ((x + off) % 4) < 2;
      a += on ? 'b' : 'D';
      b += on ? 'D' : 'k';
    }
    return [a, b];
  };
  const [t1a, t1b] = tooth(phase);
  const [t2a, t2b] = tooth(phase + 2);
  rows[5] = t1a; rows[6] = t1b;
  rows[11] = t2a; rows[12] = t2b;
  return rows;
}

// ---------------------------------------------------------------------------
// INTERIOR STRUCTURE — the thing this dungeon was missing.
//
// ALttP carves a dungeon room with the SAME masonry as its outer wall (Eastern
// Palace: identical green stone inside and out). Measured off
// refs/dungeon-eastern-palace-rolling-ball.png, one block reads as:
//
//   ~10 px of TOP FACE  (brick courses, lit, seen from above)
//    6 px of SOUTH BEVEL (bright lip 200,208,160 / lit 128,168,112 /
//                         mid 64,112,72 x2 / dark 48,80,48 x2 / outline)
//    then a HARD 5 px near-black shadow band dropped onto the floor below.
//
// So a block is a solid with a top and a front, lit from the upper left, and
// the corner genuinely turns. Everything here is generated from a neighbour
// mask so any rectangle, L, pillar row or alcove drawn in maps-dungeon.js
// comes out correctly bevelled without hand-authoring 16 tiles.
// ---------------------------------------------------------------------------

const N_BIT = 1, E_BIT = 2, S_BIT = 4, W_BIT = 8;

// The top face: riveted copper boiler plate in a running bond. 8px courses,
// mortar shifted half a brick per course so it never runs as long bands.
// The masonry sits at roughly the FLOOR's value (measured: ALttP's wall top
// face 48,80,48 against a 56,56,88 floor — the wall is a touch darker, and
// the contrast is carried by hue and by the bevel, never by brightness). An
// interior wall lighter than its floor reads as brass railing, not stone.
const BK_TOP = (() => {
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const course = y < 8 ? 0 : 1;
    const yb = y % 8;
    let s = '';
    for (let x = 0; x < 16; x++) {
      // 8px bricks, half-brick offset per course: without vertical mortar
      // every 8 px the top face reads as planking, not masonry
      const xb = (x + course * 4) % 8;
      let ch;
      if (yb === 0) ch = 'k';
      else if (yb === 1) ch = 'M';
      else if (yb === 7) ch = 's';
      else ch = 'S';
      if (xb === 0) ch = 'k';
      else if (xb === 1 && yb !== 0) ch = yb === 7 ? 's' : 'M';
      else if (xb === 7 && yb !== 0 && yb !== 7) ch = 's';
      s += ch;
    }
    rows.push(s);
  }
  // rivet heads near the corners of each brick, so the plate carries texture
  let g = rows;
  for (const [rx, ry] of [[4, 3], [12, 3], [8, 11]]) {
    g = stamp(g, rx, ry, ['Ms', 'ss']);
  }
  return g;
})();

// South face of a block: the 6px bevel that gives it thickness. One bright
// specular row, then a clean fall to the outline — that ramp IS the thickness.
const BK_FACE = [
  'TTTTTTTTTTTTTTTT',
  'MMMMMMMMMMMMMMMM',
  'SSSSSSSSSSSSSSSS',
  'ssssssssssssssss',
  'ssssssssssssssss',
  'kkkkkkkkkkkkkkkk',
];

/** A block tile for a given neighbour mask (bits: N/E/S/W already block). */
function blockTile(mask) {
  let g = BK_TOP;
  // north rim: a dark outline and one row of shade — the far edge of the top
  if (!(mask & N_BIT)) {
    g = stamp(g, 0, 0, ['kkkkkkkkkkkkkkkk', 'ssssssssssssssss']);
  }
  // south: the bevelled front face
  if (!(mask & S_BIT)) g = stamp(g, 0, 10, BK_FACE);
  // west edge catches the light; east edge falls into shade. Both carry the
  // outline, so the corner where the bevel meets a side turns properly.
  if (!(mask & W_BIT)) {
    g = g.map(r => 'kTM' + r.slice(3));
  }
  if (!(mask & E_BIT)) {
    g = g.map(r => r.slice(0, 13) + 'ssk');
  }
  return g;
}

// A free-standing PILLAR reads better as a turned column than as a cube: a
// riveted copper drum with a brass collar and a lit capital. 16 wide x 28
// tall, drawn as a y-sorted obstacle so Wren can walk behind it.
const PILLAR = [
  '..kkkkkkkkkkkk..',
  '.kzzbbbbbbzzzzk.',
  '.kzbbbbbzzzzzzk.',
  '.kzzbbbbzzzzzzk.',
  '..kkkkkkkkkkkk..',
  '..kTMSSSSSsssk..',
  '..kTMSSSSSsssk..',
  '..kTMSSSSSsssk..',
  '..kkkkkkkkkkkk..',
  '..kzzbbbbzzzzk..',
  '..kzbbbbzzzzzk..',
  '..kzzbbbzzzzzk..',
  '..kkkkkkkkkkkk..',
  '..kTMSSSSSsssk..',
  '..kTMSSSSSsssk..',
  '..kTMSSSSSsssk..',
  '..kTMSSSSSsssk..',
  '..kkkkkkkkkkkk..',
  '..kzzbbbbzzzzk..',
  '..kzbbbbzzzzzk..',
  '..kzzbbbzzzzzk..',
  '..kkkkkkkkkkkk..',
  '.kTTMMSSSSSsssk.',
  '.kTMMSSSSSSsssk.',
  '.kTMMSSSSSSsssk.',
  '.kSSSSSSSSSsssk.',
  '.kssssssssssssk.',
  '.kkkkkkkkkkkkkk.',
];

// --- walls ------------------------------------------------------------------

// North inner course. Riveted copper boiler plate laid in a RUNNING BOND:
// each 8px course is one brick per tile, and the vertical mortar shifts by
// half a brick between courses — without that shift the wall reads as long
// unbroken bands (measured against the ref, whose relief band never runs more
// than ~16px without a break). Finished with the bright lip / dark outline
// that faces the floor.
const WL_N = [
  'kkkkkkkkkkkkkkkk',
  'kTTTTTTTTTTTTTTT',
  'kTMMMMMMMMMMMMMS',
  'kTMRbMMMMMMRbMMS',
  'kTMbsMMMMMMbsMMS',
  'kTMMMMMMMMMMMMMS',
  'kSSSSSSSSSSSSSSS',
  'ksssssssssssssss',
  'kkkkkkkkkkkkkkkk',
  'TTTTTTTTkTTTTTTT',
  'MMMMMMMSkTMMMMMM',
  'MMRbMMMSkTMRbMMM',
  'MMbsMMMSkTMbsMMM',
  'ssssssssksssssss',
  'TTTTTTTTTTTTTTTT',
  'kkkkkkkkkkkkkkkk',
];

// Outer ring: dark iron ceiling plate on an 8x8 bond.
const WL_CAP = (() => {
  const plate = [
    'kkkkkkkk',
    'kJJJJJJJ',
    'kJIIIIII',
    'kJIJIIII',
    'kJIIIIII',
    'kJIIIIII',
    'kJIIIIII',
    'kiiiiiii',
  ];
  const rows = [];
  for (let y = 0; y < 16; y++) {
    const p = plate[y % 8];
    rows.push(p + p);
  }
  return rows;
})();

// The inner-edge lip (3 px: shade / bright / outline) as it runs along the
// RIGHT side or the BOTTOM of a tile. Corner tiles stamp it on two sides.
const lipRight = rows => rows.map(r => r.slice(0, 13) + 'sTk');
const lipBottom = rows => [...rows.slice(0, 13), 'ssssssssssssssss',
  'TTTTTTTTTTTTTTTT', 'kkkkkkkkkkkkkkkk'];

// --- copper pipework running along the walls -------------------------------

// A copper pipe run stamped ONTO the dark ceiling plate, so the pipe reads
// proud of the wall instead of replacing it. Brass collars every six rows.
const PIPE_V = (() => {
  const body = 'kNnnccnnNk';
  const colA = 'kzzbbbbzzk';
  const colB = 'kzzzbbzzzk';
  const art = [];
  for (let y = 0; y < 16; y++) {
    art.push(y % 8 === 2 ? colA : y % 8 === 3 ? colB : body);
  }
  return stamp(WL_CAP, 3, 0, art);
})();

const PIPE_H = rot90(PIPE_V);

// --- decorative wall relief (brass gauge plate) ----------------------------

// Stamped onto the north inner course, whose neighbour mask is E|W: the wall
// runs on either side, open sky-side above and floor below.
const WL_GAUGE = stamp(blockTile(E_BIT | W_BIT), 4, 2, [
  'kkkkkkkk',
  'kzbbbbzk',
  'kbBGGBbk',
  'kbGwwGbk',
  'kbBGGBbk',
  'kzbbbbzk',
  'kkkkkkkk',
]);

// --- pit / open shaft (the isle showing through the floor) -----------------

// An open shaft down through the works. A flat black rectangle reads as paint;
// a hole reads as a hole only when you can see its INNER WALLS. The far (north)
// wall catches the light and steps down through the copper ramp into the dark,
// the side walls take a one-shade sliver, and the near rim carries the deck's
// cut edge. Built from a neighbour mask so a run of pit tiles is one shaft.
function pitTile(mask) {
  let g = Array.from({ length: 16 }, () => 'x'.repeat(16));
  if (!(mask & N_BIT)) {
    // the far wall, lit from above and stepping down into the dark
    g = stamp(g, 0, 0, [
      'kkkkkkkkkkkkkkkk',
      'TTTTTTTTTTTTTTTT',
      'MMMMMMMMMMMMMMMM',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'ffffffffffffffff',
      'dddddddddddddddd',
    ]);
  }
  if (!(mask & S_BIT)) {
    g = stamp(g, 0, 13, ['kkkkkkkkkkkkkkkk', 'ssssssssssssssss', 'kkkkkkkkkkkkkkkk']);
  }
  if (!(mask & W_BIT)) g = g.map(r => 'ks' + r.slice(2));
  if (!(mask & E_BIT)) g = g.map(r => r.slice(0, 14) + 'sk');
  return g;
}

// The boiler hall's ceremonial deck: the same plate with BRASS bolts instead
// of steel rivets, so the last two rooms feel like the place the liftstone
// actually lived.
// The brass bolt replaces the steel rivet outright (both of the plate's 'V'
// highlight pixels), so the hall deck costs the screen ONE net palette entry
// rather than three — measured at 6.0 colours per 16x16 block against ALttP's
// 2.2-6.6, where a three-tone bolt measured 7.7 and failed.
const HALL_A = stamp(stamp(PL_A, 3, 3, ['BB', 'PP']), 3, 11, ['BB', 'PP']);
const HALL_B = stamp(stamp(PL_B, 11, 3, ['BB', 'PP']), 11, 11, ['BB', 'PP']);

// A cracked plate — the accent tile for the deep wings, where the isle's fall
// has started to split the deck.
const PL_CRACK = stamp(PL_B, 2, 4, [
  '..P...........',
  '.PDP..........',
  'PDP...........',
  '.PD.PP........',
  '..PDDPDP......',
  '....PDDP......',
  '......PDDPP...',
  '........PDDP..',
]);

const TILE_DEFS = {
  fl_a: PL_A, fl_b: PL_B, fl_c: PL_C, fl_d: PL_D,
  fl_crack: PL_CRACK,
  fl_t0: treadRows(0), fl_t1: treadRows(1),
  fl_s0: slatRows(0), fl_s1: slatRows(1),
  fl_h0: HALL_A, fl_h1: HALL_B,
  fl_grate: PL_GRATE, fl_vent: PL_VENT,
  wl_n: WL_N, wl_cap: WL_CAP, wl_gauge: WL_GAUGE,
  pipe_v: PIPE_V, pipe_h: PIPE_H,
  conv0: conveyorRows(0), conv1: conveyorRows(1),
  conv2: conveyorRows(2), conv3: conveyorRows(3),
};

/**
 * One deck per wing. `a`/`b` are the running-bond pair, `worn` and `rust` are
 * the low-frequency accents that stop a floor reading as wallpaper.
 */
export const FLOOR_STYLES = {
  plate: { a: 'fl_a', b: 'fl_b', worn: 'fl_c', rust: 'fl_d' },
  tread: { a: 'fl_t0', b: 'fl_t1', worn: 'fl_crack', rust: 'fl_d' },
  slat: { a: 'fl_s0', b: 'fl_s1', worn: 'fl_crack', rust: 'fl_c' },
  hall: { a: 'fl_h0', b: 'fl_h1', worn: 'fl_c', rust: 'fl_crack' },
};
for (let m = 0; m < 16; m++) {
  TILE_DEFS['bk_' + m] = blockTile(m);
  TILE_DEFS['pt_' + m] = pitTile(m);
}

// ===========================================================================
// PROP SPRITES
// ===========================================================================

// --- door frame (north): 32 wide x 32 tall, drawn over the wall ring -------
//
// Brass jamb either side, a lintel, and a black passage. Composed from a half
// so the jambs can never drift apart.
// A doorway is a RECESS, not a black rectangle pasted on a wall. Reading down
// the left half: an outline, a lit copper pilaster (jamb), the outline again,
// then the passage's own left wall in shade, then the throat. A brass lintel
// caps the opening, the corridor floor comes forward through three steel
// shades at the near end, and a brass sill plate sits in the threshold.
const DOOR_N = (() => {
  const JAMB = 'kRTMSk';     // cols 0-5: lit pilaster
  const BEV = ['kRRRRk', 'kTTTTk', 'kMMMMk', 'kSSSSk', 'kssssk', 'kkkkkk'];
  const half = [];
  half.push('kkkkkkkkkkkkkkkk');                 // 0  cap outline
  half.push('kzzzzk' + 'zzzzzzzzzz');            // 1  lintel
  half.push('kbbbbk' + 'bbbbbbbbbb');            // 2
  half.push('kBBBBk' + 'BBBBBBBBBB');            // 3
  half.push('kbbbbk' + 'bbbbbbbbbb');            // 4
  half.push('kzzzzk' + 'zzzzzzzzzz');            // 5
  half.push('kkkkkk' + 'kkkkkkkkkk');            // 6  under-lintel outline
  for (let y = 7; y <= 21; y++) {                // the throat
    // a faint dither on the passage wall so the dark is not dead flat
    half.push(JAMB + 'Ss' + (y % 4 === 0 ? 'd' : 'x') + 'xxxxxxx');
  }
  half.push(JAMB + 'Ssffffffff');                // 22 corridor floor, far
  half.push(JAMB + 'Ssdddddddd');                // 23
  half.push(JAMB + 'SsDDDDDDDD');                // 24
  half.push(JAMB + 'SsPPPPPPPP');                // 25
  half.push(JAMB + 'SsFFFFFFFF');                // 26 corridor floor, near
  half.push(BEV[0] + 'kzbbbbbbbb');              // 27 threshold: brass sill
  half.push(BEV[1] + 'kbBBBBBBBB');              // 28
  half.push(BEV[2] + 'kzbbbbbbbb');              // 29
  half.push(BEV[3] + 'kzzzzzzzzz');              // 30
  half.push('kkkkkk' + 'kkkkkkkkkk');            // 31
  return half.map(r => r + [...r].reverse().join(''));
})();

// Iron shutter that fills the passage when the door is shut: slatted plate,
// each slat lit along its top edge, rivets down both stiles.
const SHUTTER = (() => {
  let rows = [];
  for (let y = 0; y < 24; y++) {
    const band = y % 6;
    const ch = band === 0 ? 'k' : band === 1 ? 'J' : band === 5 ? 'i' : 'I';
    rows.push(ch.repeat(20));
  }
  for (let y = 3; y < 24; y += 6) {
    rows = stamp(rows, 0, y, ['.JJ..............JJ.']);
    rows = stamp(rows, 0, y + 1, ['.ii..............ii.']);
  }
  return rows;
})();

// Brass padlock hung on a shut door.
const PADLOCK = [
  '..kkkk..',
  '.kzbbzk.',
  'kzk..kzk',
  'kb k  bk',
  'kkkkkkkk',
  'kzbbbbzk',
  'kbBBBBbk',
  'kbBkkBbk',
  'kbBkkBbk',
  'kbBBkBbk',
  'kzbbbbzk',
  '.kkkkkk.',
].map(r => r.replace(/ /g, '.'));

// The boss door's lock: a brass gear-wheel with a keyhole hub.
const BIG_LOCK = [
  '...kkkk...kkkk...',
  '..kzbbzk.kzbbzk..',
  '.kkzbbzkkkzbbzkk.',
  'kzbbbbbbbbbbbbbzk',
  'kbBBBBBBBBBBBBBbk',
  'kbBBkkkkkkkkkBBbk',
  'kbBkzzbbbbzzkkBbk',
  'kbBkzbBGGBbzkkBbk',
  'kbBkzbGwwGbzkkBbk',
  'kbBkzbBGGBbzkkBbk',
  'kbBkzzbbbbzzkkBbk',
  'kbBBkkkkkkkkkBBbk',
  'kbBBBBBBBBBBBBBbk',
  'kzbbbbbbbbbbbbbzk',
  '.kkzbbzkkkzbbzkk.',
  '..kzbbzk.kzbbzk..',
  '...kkkk...kkkk...',
];

// --- chest (ALttP proportions: 16x16, lid + body + brass clasp) ------------

// Wooden box, brass corner bands, a brass lock plate dead centre. Wood is the
// mass and brass only the trim, so a chest never reads as another brass fitting.
const CHEST_SHUT = [
  '................',
  '..kkkkkkkkkkkk..',
  '.kiJJJJJJJJJJik.',
  '.kJIOOOOOOOOIJk.',
  '.kJIOooooooOIJk.',
  '.kiIOooooooOIik.',
  '.kkkkkkkkkkkkkk.',
  '.kiJppppppppJik.',
  '.kJIooozzoooIJk.',
  '.kJIoozBBzooIJk.',
  '.kJIoozBBzooIJk.',
  '.kJIooozzoooIJk.',
  '.kiIOooooooOIik.',
  '.kiJJJJJJJJJJik.',
  '..kkkkkkkkkkkk..',
  '................',
];

const CHEST_OPEN = [
  '................',
  '................',
  '................',
  '..kkkkkkkkkkkk..',
  '.kiJJJJJJJJJJik.',
  '.kJIppppppppIJk.',
  '.kkkkkkkkkkkkkk.',
  '.kxxxxxxxxxxxxk.',
  '.kxxxxxxxxxxxxk.',
  '.kJIOooooooOIJk.',
  '.kJIooozzoooIJk.',
  '.kJIooozzoooIJk.',
  '.kiIOooooooOIik.',
  '.kiJJJJJJJJJJik.',
  '..kkkkkkkkkkkk..',
  '................',
];

// --- gear switch: a brass gear on a short post; three spin phases ----------

// The gear-switch is the dungeon's LOCK VERB, so it must not share the brass
// ramp with chests, plaques and doorframes: its body is bright COPPER (a much
// hotter orange than the wall's brown or the brass fittings' yellow) and its
// hub carries a VALVE CAP that is deep red when the switch is off and burning
// green-white when it is lit. Teeth are square and occupy a full half-pitch —
// eight of them, so it reads as a gear and not as a flower.
function gearRows(phase, lit) {
  const R = 5.9, RT = 7.4, RH = 2.7;
  const rows = [];
  for (let y = 0; y < 14; y++) {
    let s = '';
    for (let x = 0; x < 14; x++) {
      const dx = x - 6.5, dy = y - 6.5;
      const d = Math.hypot(dx, dy);
      let a = Math.atan2(dy, dx) + phase * (Math.PI / 12) + Math.PI / 16;
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      // 16 equal sectors, every other one is a tooth -> square teeth
      const tooth = Math.floor(a / (Math.PI * 2) * 16) % 2 === 0;
      // square, not round: teeth are clipped by the max-norm so their tips
      // come out flat instead of pointed
      const box = Math.max(Math.abs(dx), Math.abs(dy)) * 0.86 + d * 0.16;
      const lim = tooth ? RT : R;
      const dd = tooth ? Math.max(box, d * 0.82) : d;
      if (dd > lim + 0.85) { s += '.'; continue; }
      if (dd > lim - 0.35) { s += 'k'; continue; }
      if (d < RH) {
        // the valve cap in the hub
        if (d < 1.9) s += lit ? 'w' : 'e';
        else s += lit ? 'l' : 'E';
        continue;
      }
      if (d < RH + 0.9) { s += 'k'; continue; }
      const li = (-dx - dy) / (d || 1);
      if (lit) s += li > 0.45 ? 'G' : li > -0.4 ? 'g' : 'h';
      else s += li > 0.45 ? 'C' : li > -0.4 ? 'c' : 'n';
    }
    rows.push(s);
  }
  return rows;
}

function gearSwitchRows(phase, lit) {
  // 16x24: gear on a riveted iron post with a rust-stained base plate
  const base = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....kkkkkk.....',
    '.....kIJJIk.....',
    '.....kIJJIk.....',
    '....kkIJJIkk....',
    '...kiIIJJIIik...',
    '..kkIJJJJJJIkk..',
    '..kiIIIIIIIIik..',
    '..kkkkkkkkkkkk..',
    '...hSSSSSSSSh...',
  ];
  return stamp(base, 1, 1, gearRows(phase, lit));
}

// --- light crate (shoved by the Cuff) --------------------------------------

const CRATE = [
  'kkkkkkkkkkkkkkkk',
  'kJJJJkOOOOkJJJJk',
  'kJIIJkOooOkJIIJk',
  'kJJJJkOooOkJJJJk',
  'kkkkkkkkkkkkkkkk',
  'kOOOOOOOOOOOOOOk',
  'kOooooooooooooOk',
  'kOooooooooooooOk',
  'kppppppppppppppk',
  'kOOOOOOOOOOOOOOk',
  'kOooooooooooooOk',
  'kOooooooooooooOk',
  'kkkkkkkkkkkkkkkk',
  'kJJJJkOOOOkJJJJk',
  'kJIIJkOooOkJIIJk',
  'kkkkkkkkkkkkkkkk',
];

// --- steam canister (the Boilerworks' pot) ---------------------------------
//
// EASTERN PALACE IS WALL-TO-WALL POTS. The Boilerworks shipped with none, and
// the arithmetic of that is in the room ladder: seven rooms and a boss with
// exactly one heal in them, so the cheapest heal in the game was dying.
//
// A dungeon that is all copper plate and brass fittings does not get clay
// jars. This is a pressure canister off the same rack the boiler stacks came
// from: brass lid, copper barrel, one brass hoop round the belly, and it
// bursts in a puff of steam because everything down here does.
const CANISTER = [
  '................',
  '....kkkkkkkk....',
  '...kBBBBBBBBk...',
  '...kzbbbbbbzk...',
  '...kkcccccckk...',
  '..kCCccccccnnk..',
  '.kCCcccccccnnNk.',
  '.kCcccccccccnNk.',
  '.kCcccccccccnNk.',
  '.kBBBBBBBBBBBBk.',
  '.kzbbbbbbbbbbzk.',
  '.kCcccccccccnNk.',
  '.kCcccccccccnNk.',
  '..kCcccccccnNk..',
  '...kknnnnnnkk...',
  '..dd.dd.dd.dd...',
];

// A LOOSE COG. The overworld's kill drop, restruck in the dungeon's own
// brass so it reads against a steel deck instead of grass.
const COG_DROP = [
  '................',
  '................',
  '......k..k......',
  '.....kBkkBk.....',
  '...kkkBBBBkkk...',
  '...kBBBBBBBBk...',
  '..kkBBbbbbBBkk..',
  '..kBBBb..bBBBk..',
  '..kBBBb..bBBBk..',
  '..kkBBbbbbBBkk..',
  '...kBBBBBBBBk...',
  '...kkkBBBBkkk...',
  '.....kBkkBk.....',
  '......k..k......',
  '................',
  '................',
];

// --- pressure plate (the Cuff's crate verb finally has a job) ---------------
//
// A sunk iron plate with a signal lamp in the middle: RED when nothing is on
// it, GREEN when a crate is. Sunk into the deck, so it never reads as a chest.
function plateRows(down) {
  const lamp = down ? 'l' : 'e';
  const rim = down ? 'm' : 'E';
  return [
    '................',
    '.kkkkkkkkkkkkkk.',
    'kdiiiiiiiiiiiidk',
    'kiIJJJJJJJJJJIik',
    'kiJI' + rim.repeat(8) + 'IJik',
    'kiJI' + rim + lamp.repeat(6) + rim + 'IJik',
    'kiJI' + rim + lamp.repeat(6) + rim + 'IJik',
    'kiJI' + rim + lamp.repeat(6) + rim + 'IJik',
    'kiJI' + rim + lamp.repeat(6) + rim + 'IJik',
    'kiJI' + rim + lamp.repeat(6) + rim + 'IJik',
    'kiJI' + rim.repeat(8) + 'IJik',
    'kiIJJJJJJJJJJIik',
    'kdiiiiiiiiiiiidk',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ];
}

// --- brass plaque (the dungeon's stamped signage) --------------------------

const PLAQUE = [
  '................',
  '..kkkkkkkkkkkk..',
  '.kzzzzzzzzzzzzk.',
  '.kzbbbbbbbbbbzk.',
  '.kzbBBBBBBBBbzk.',
  '.kzbBzzzzzzBbzk.',
  '.kzbBzBBBBzBbzk.',
  '.kzbBzBzzBzBbzk.',
  '.kzbBzBBBBzBbzk.',
  '.kzbBzzzzzzBbzk.',
  '.kzbBBBBBBBBbzk.',
  '.kzbbbbbbbbbbzk.',
  '.kzzzzzzzzzzzzk.',
  '..kkkkkkkkkkkk..',
  '...PPPPPPPPPP...',
  '................',
];

// --- boiler tank (B7 set dressing): 32 wide x 40 tall ----------------------

const BOILER = (() => {
  const half = [
    '.....kkkkkkkkkkk',
    '...kkzzzzzzzzzzz',
    '..kzzbbbbbbbbbbb',
    '.kzbbbbbbbbbbbbb',
    '.kzbbkkkkkkkkkkk',
    'kzbbkkNNNNNNNNNN',
    'kzbkkNccccccccCC',
    'kzbkNcccccccccCC',
    'kzbkNcccccccccCC',
    'kzbkNccccccccCCC',
    'kzbkNccccccccCCC',
    'kzbkNcckkkkkkkkk',
    'kzbkNcckzzbbbbbb',
    'kzbkNcckzbBGGGGG',
    'kzbkNcckzbGwwwww',
    'kzbkNcckzbBGGGGG',
    'kzbkNcckzzbbbbbb',
    'kzbkNcckkkkkkkkk',
    'kzbkNcccccccccCC',
    'kzbkNcccccccccCC',
    'kzbkNccccccccCCC',
    'kzbkNcckkkkkkkkk',
    'kzbkNcckNNNNNNNN',
    'kzbkNcckNccccccc',
    'kzbkNcckNccccccc',
    'kzbkNcckNccccccc',
    'kzbkNcckkkkkkkkk',
    'kzbkNccccccccCCC',
    'kzbkNccccccccCCC',
    'kzbkNcccccccccCC',
    'kzbkNcccccccccCC',
    'kzbkkNNNNNNNNNNN',
    'kzbbkkkkkkkkkkkk',
    'kzzbbbbbbbbbbbbb',
    'kkzzzzzzzzzzzzzz',
    '.kkkkkkkkkkkkkkk',
    '..kIIIIIIIIIIIII',
    '..kiiiiiiiiiiiii',
    '..kkkkkkkkkkkkkk',
    '...PPPPPPPPPPPPP',
  ];
  return half.map(r => r + [...r].reverse().join(''));
})();

// --- steam jet: chunky SNES column of steam, 16 wide, 3 heights ------------

function steamJetRows(stage) {
  // A 16x48 column of steam, four growth stages. Generated from a lobed
  // half-width so the silhouette wobbles the way a real jet does. The SNES
  // could not do alpha, so translucency is DITHER: the outer fringe is a
  // checker of dark rim pixels and holes, and the core is chequered between
  // its two brightest shades. The ramp is pulled toward pale blue so the
  // plume is never the brightest object on the screen.
  const H = 48, W = 16;
  const rows = Array.from({ length: H }, () => '.'.repeat(W));
  const top = [42, 28, 14, 0][stage];
  for (let y = top; y < H; y++) {
    const t = (y - top) / Math.max(1, H - top);
    const r = 1.8 + t * 5.2 + Math.sin(y * 0.8) * 0.9;
    let s = '';
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x - 7.5);
      const chk = ((x + y) & 1) === 0;
      if (d > r + 1.4) s += '.';
      else if (d > r + 0.1) s += chk ? 'Q' : '.';       // dithered fringe
      else if (d > r - 1.1) s += 'U';
      else if (d > r - 2.7) s += 'A';
      else s += chk ? 'q' : 'A';                        // dithered core
    }
    rows[y] = s;
  }
  return rows;
}

// A short hiss puff — the vent's telegraph before it fires.
const HISS = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......QQ........',
  '.....QUAQ..QQ...',
  '....QUAAUQQUAQ..',
  '....QUAAUQQUAQ..',
];

// --- rivet projectile + spark ---------------------------------------------

const RIVET = [
  '.kkkk.',
  'kBBBBk',
  'kBbbBk',
  'kzbbzk',
  'kzzzzk',
  '.kkkk.',
];

const SPARK_A = [
  '..k..',
  '.kGk.',
  'kGwGk',
  '.kGk.',
  '..k..',
];
const SPARK_B = [
  'G...G',
  '.G.G.',
  '..w..',
  '.G.G.',
  'G...G',
];

// --- recovery heart --------------------------------------------------------
//
// KETTLEBACK drops one of these on each phase change. A three-heart player
// who has learned the fight but is one contact hit down should be allowed to
// finish it; STORY asks for "beatable on the second or third try", not for a
// war of attrition.
const HEART = [
  '................',
  '................',
  '...kkk..kkk.....',
  '..kEeEkkEeEk....',
  '.kEewweEeeeEk...',
  '.kEwwweeeeeEk...',
  '.kEwweeeeeeEk...',
  '.kEeeeeeeeeEk...',
  '..kEeeeeeeEk....',
  '..kEeeeeeeEk....',
  '...kEeeeeEk.....',
  '....kEeeEk......',
  '.....kEeEk......',
  '......kEk.......',
  '.......k........',
  '................',
];

// --- heart piece (Riveter drop) -------------------------------------------

const HEART_PIECE = [
  '................',
  '................',
  '.....kkkk.......',
  '....kEeeEk......',
  '...kEeewwEk.....',
  '..kEeeewwwEk....',
  '..kEeeeewwwk....',
  '..kEeeeeewwk....',
  '..kEeeeeeewk....',
  '...kEeeeeewk....',
  '....kEeeeewk....',
  '.....kEeeewk....',
  '......kEeewk....',
  '.......kEewk....',
  '........kkk.....',
  '................',
];

// --- the liftstone shard (the ending beat) --------------------------------

const SHARD = [
  '................',
  '.......kk.......',
  '......kGGk......',
  '.....kGwwGk.....',
  '....kGwwwwGk....',
  '....kGwwwwGk....',
  '...kGwwwwwwGk...',
  '...kGwGwwGwGk...',
  '...kGwwwwwwGk...',
  '....kGwwwwGk....',
  '....kgGwwGgk....',
  '.....kggggk.....',
  '......kggk......',
  '.......kk.......',
  '................',
  '................',
];

// ===========================================================================
// TIN SOLDIER — art
// ===========================================================================

// The soldier's MASS is a brass breastplate, not bare tin: a pale tin figure
// on a blue-grey deck vanishes, and reads as steam. So the torso is the
// dungeon's brass ramp (the loudest colour in the room after the walls), the
// helmet keeps the light tin, and a red plume tops the silhouette.
const TIN_DOWN = [
  '......kkkk......',
  '.....keeeek.....',
  '....kkeeeekk....',
  '....kttttttk....',
  '...kttttttttk...',
  '...ktuuuuuutk...',
  '...kykkkkkkyk...',
  '..kkuttttttukk..',
  '.kutkzbbbbzktuk.',
  '.kutkbBBBBbktuk.',
  '.kutkbBzzBbktuk.',
  '.kuykbBzzBbkyuk.',
  '.kkkkzbbbbzkkkk.',
  '..kkuuuuuuuukk..',
  '....kuuuuuuk....',
  '....kkkkkkkk....',
];

const TIN_UP = [
  '......kkkk......',
  '.....keeeek.....',
  '....kkeeeekk....',
  '....kttttttk....',
  '...kttttttttk...',
  '...kuuuuuuuuk...',
  '...kyuuuuuuyk...',
  '..kkuuuuuuuukk..',
  '.kutkzbbbbzktuk.',
  '.kutkbBkkBbktuk.',
  '.kutkbkBBkbktuk.',
  '.kuykbBkkBbkyuk.',
  '.kkkkzbbbbzkkkk.',
  '..kkuuuuuuuukk..',
  '....kuuuuuuk....',
  '....kkkkkkkk....',
];

const TIN_LEFT = [
  '.....kkkk.......',
  '....keeeek......',
  '...kkeeeekk.....',
  '...kttttttk.....',
  '..kttttttttk....',
  '..ktuuuuuutk....',
  '..kykkuuuuuk....',
  '.kkutttttuukk...',
  'kutkzbbbbzkutk..',
  'kutkbBBBBbkutk..',
  'kutkbBzzBbkutk..',
  'kuykbBzzBbkyuk..',
  'kkkkzbbbbzkkkk..',
  '.kkuuuuuuuukk...',
  '...kuuuuuuk.....',
  '...kkkkkkkk.....',
];

const TIN_LEGS_A = [
  '...kuuk.kuuk....',
  '...kuuk.kuuk....',
  '...kyuk.kyuk....',
  '..kkyykkkyykk...',
  '..kyyyk.kyyyk...',
  '...kkk...kkk....',
];

const TIN_LEGS_B = [
  '...kuuk..kuuk...',
  '..kuuuk..kuuk...',
  '..kyyuk..kyuk...',
  '.kkyykk.kkyykk..',
  '.kyyyk...kyyyk..',
  '..kkk.....kkk...',
];

// The pike: 4x16 pointing up. Rotated/flipped for the other facings.
const PIKE_UP = [
  '.kk.',
  'kBBk',
  'kBBk',
  'kBBk',
  'kBBk',
  '.kk.',
  '.kk.',
  'kopk',
  'kopk',
  'kopk',
  'kopk',
  'kopk',
  'kopk',
  'kopk',
  'kopk',
  '.kk.',
];

// Blob shadow shared by dungeon actors.
function blobShadow(w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = 4;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#171a20';
  ctx.fillRect(3, 0, w - 6, 1);
  ctx.fillRect(1, 1, w - 2, 2);
  ctx.fillRect(3, 3, w - 6, 1);
  return c;
}

// ===========================================================================
// THE RIVETER — art (bone-chain arm: mount + links + elbow + gun)
// ===========================================================================

const RIV_MOUNT = (() => {
  const half = [
    'kkkkkkkkkkkkkkkk',
    'kzzzzzzzzzzzzzzz',
    'kzbbbbbbbbbbbbbb',
    'kzbBBBBBBBBBBBBB',
    'kzbBkkkkkkkkkkkk',
    'kzbBkzzbbbbbbbbb',
    'kzbBkzbBBBBBBBBB',
    'kzbBkzbBkkkkkkkk',
    'kzbBkzbBkNNNNNNN',
    'kzbBkzbBkNccccCC',
    'kzbBkzbBkNccccCC',
    'kzbBkzbBkNccccCC',
    'kzbBkzbBkkkkkkkk',
    'kzbBkzbBBBBBBBBB',
    'kzbBkzzbbbbbbbbb',
    'kzbBkkkkkkkkkkkk',
    'kzbbbbbbbbbbbbbb',
    'kzzzzzzzzzzzzzzz',
    'kkkkkkkkkkkkkkkk',
    '.PPPPPPPPPPPPPPP',
  ];
  return half.map(r => r + [...r].reverse().join(''));
})();

const RIV_LINK = [
  '.kkkkkk.',
  'kzbbbbzk',
  'kbBBBBbk',
  'kbBzzBbk',
  'kbBzzBbk',
  'kbBBBBbk',
  'kzbbbbzk',
  '.kkkkkk.',
];

const RIV_ELBOW = [
  '..kkkkkk..',
  '.kzbbbbzk.',
  'kzbBBBBbzk',
  'kbBBggBBbk',
  'kbBgGGgBbk',
  'kbBgGGgBbk',
  'kbBBggBBbk',
  'kzbBBBBbzk',
  '.kzbbbbzk.',
  '..kkkkkk..',
];

// elbow when the arm is staggered — the glow is out, the joint hangs open
const RIV_ELBOW_OPEN = [
  '..kkkkkk..',
  '.kzzzzzzk.',
  'kzzkkkkzzk',
  'kzkxxxxkzk',
  'kzkxeexkzk',
  'kzkxeexkzk',
  'kzkxxxxkzk',
  'kzzkkkkzzk',
  '.kzzzzzzk.',
  '..kkkkkk..',
];

const RIV_GUN = [
  '..kkkkkkkk..',
  '.kzbbbbbbzk.',
  'kzbBBBBBBbzk',
  'kbBBzzzzBBbk',
  'kbBzkkkkzBbk',
  'kbBzkxxkzBbk',
  'kbBzkxxkzBbk',
  'kbBzkkkkzBbk',
  'kbBBzzzzBBbk',
  'kzbBBBBBBbzk',
  '.kzbbbbbbzk.',
  '..kkkkkkkk..',
];

// ===========================================================================
// SPRITE BUILD
// ===========================================================================

let CACHE = null;

export function makeBoilerworks() {
  if (CACHE) return CACHE;

  for (const [name, rows] of Object.entries(TILE_DEFS)) assertGrid(name, rows, 16, 16);
  assertGrid('door_n', DOOR_N, 32, 32);
  assertGrid('big_lock', BIG_LOCK, 17, 17);
  assertGrid('chest_shut', CHEST_SHUT, 16, 16);
  assertGrid('chest_open', CHEST_OPEN, 16, 16);
  assertGrid('crate', CRATE, 16, 16);
  assertGrid('canister', CANISTER, 16, 16);
  assertGrid('cog_drop', COG_DROP, 16, 16);
  assertGrid('plaque', PLAQUE, 16, 16);
  assertGrid('pillar', PILLAR, 16, 28);
  assertGrid('vent_noz', VENT_NOZ, 12, 9);
  [false, true].forEach((d, i) => assertGrid('plate' + i, plateRows(d), 16, 16));
  assertGrid('boiler', BOILER, 32, 40);
  assertGrid('riv_mount', RIV_MOUNT, 32, 20);
  [TIN_DOWN, TIN_UP, TIN_LEFT].forEach((g, i) => assertGrid('tin' + i, g, 16, 16));
  [TIN_LEGS_A, TIN_LEGS_B].forEach((g, i) => assertGrid('tinlegs' + i, g, 16, 6));
  [0, 1, 2, 3].forEach(n => assertGrid('jet' + n, steamJetRows(n), 16, 48));

  // --- tiles, with the derived wall ring -----------------------------------
  const tiles = makeTiles(TILE_DEFS, DPAL);
  const T = rows => makeSprite(rows, DPAL);

  const sprites = {
    door_n: T(DOOR_N),
    door_s: flipV(T(DOOR_N)),
    door_w: T(rot90(rot90(rot90(DOOR_N)))),
    door_e: T(rot90(DOOR_N)),
    shutter: T(assertGrid('shutter', SHUTTER, 20, 24)),
    shutter_v: T(rot90(SHUTTER)),
    padlock: T(PADLOCK),
    big_lock: T(BIG_LOCK),
    chest: T(CHEST_SHUT),
    chest_open: T(CHEST_OPEN),
    crate: T(CRATE),
    canister: T(CANISTER),
    cog_drop: T(COG_DROP),
    plaque: T(PLAQUE),
    boiler: T(BOILER),
    pillar: T(PILLAR),
    vent_noz: T(VENT_NOZ),
    plate: [T(plateRows(false)), T(plateRows(true))],
    rivet: T(RIVET),
    spark: [T(SPARK_A), T(SPARK_B)],
    heart_piece: T(HEART_PIECE),
    heart: T(HEART),
    shard: T(SHARD),
    hiss: T(HISS),
    jet: [0, 1, 2, 3].map(n => T(steamJetRows(n))),
    gear: [0, 1, 2].map(p => T(gearSwitchRows(p, false))),
    gear_lit: [0, 1, 2].map(p => T(gearSwitchRows(p, true))),
    shadow16: blobShadow(12),
    shadow20: blobShadow(16),
    riv_mount: T(RIV_MOUNT),
    riv_link: T(RIV_LINK),
    riv_elbow: T(RIV_ELBOW),
    riv_elbow_open: T(RIV_ELBOW_OPEN),
    riv_gun: T(RIV_GUN),
    tin: {
      down: T(TIN_DOWN), up: T(TIN_UP), left: T(TIN_LEFT), right: flipH(T(TIN_LEFT)),
      legs: [T(TIN_LEGS_A), T(TIN_LEGS_B)],
      pike_up: T(PIKE_UP),
      pike_down: flipV(T(PIKE_UP)),
      pike_left: T(rot90(rot90(rot90(PIKE_UP)))),
      pike_right: T(rot90(PIKE_UP)),
    },
  };
  // THE WHOLE CREATURE FLASHES, NOT ITS TORSO. A struck soldier drawn with a
  // white body over its own brown legs and a brass pike reads as a costume
  // change; enemies.js whitens the entire silhouette, which is what a SNES
  // palette flash physically was. Legs and pike get white twins too.
  sprites.tin.white = {
    down: tint(sprites.tin.down, '#f8f8f8'),
    up: tint(sprites.tin.up, '#f8f8f8'),
    left: tint(sprites.tin.left, '#f8f8f8'),
    right: tint(sprites.tin.right, '#f8f8f8'),
    legs: [tint(sprites.tin.legs[0], '#f8f8f8'), tint(sprites.tin.legs[1], '#f8f8f8')],
    pike_up: tint(sprites.tin.pike_up, '#f8f8f8'),
    pike_down: tint(sprites.tin.pike_down, '#f8f8f8'),
    pike_left: tint(sprites.tin.pike_left, '#f8f8f8'),
    pike_right: tint(sprites.tin.pike_right, '#f8f8f8'),
  };

  CACHE = { tiles, sprites };
  return CACHE;
}

// ===========================================================================
// ROOM CHROME
//
// Every Boilerworks room is one screen: 16x14 tiles. Two rings of wall
// (dark cap outside, copper course inside) frame a 12x10 steel deck.
// ===========================================================================

export const ROOM_COLS = 16, ROOM_ROWS = 14;
export const FLOOR_C0 = 2, FLOOR_C1 = 13, FLOOR_R0 = 2, FLOOR_R1 = 11;
/** Floor rectangle in world pixels. */
export const FLOOR_PX = {
  x: FLOOR_C0 * TILE, y: FLOOR_R0 * TILE,
  w: (FLOOR_C1 - FLOOR_C0 + 1) * TILE, h: (FLOOR_R1 - FLOOR_R0 + 1) * TILE,
};

/** Door openings, in tile coords, per side. Each is 2 tiles wide/tall. */
export const DOOR_CELLS = {
  north: { cells: [[7, 0], [8, 0], [7, 1], [8, 1]], x: 7 * TILE, y: 0, w: 32, h: 32 },
  south: { cells: [[7, 12], [8, 12], [7, 13], [8, 13]], x: 7 * TILE, y: 12 * TILE, w: 32, h: 32 },
  west: { cells: [[0, 6], [0, 7], [1, 6], [1, 7]], x: 0, y: 6 * TILE, w: 32, h: 32 },
  east: { cells: [[14, 6], [14, 7], [15, 6], [15, 7]], x: 14 * TILE, y: 6 * TILE, w: 32, h: 32 },
};

export const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

const hash = (c, r) => ((c * 73856093) ^ (r * 19349663) ^ 0x9e37) >>> 0;

/**
 * Build the Tilemap for a room.
 * @param {object} def  room definition (see maps-dungeon.js)
 * @returns {{map: Tilemap, floorNames: string[][]}}
 */
/**
 * Expand `def.blocks` — the room's INTERIOR ARCHITECTURE. Each entry is
 * either [c, r] for a single cell or [c, r, w, h] for a rectangle. These are
 * the same masonry as the outer wall, so a room is CARVED rather than
 * decorated: corridors, pockets, alcoves, catwalks and sightline breaks.
 */
export function blockCells(def) {
  return rectCells(def.blocks);
}

/** [c,r] or [c,r,w,h] entries -> a Set of "c,r" keys. */
export function rectCells(list) {
  const out = new Set();
  for (const b of list || []) {
    const [c, r, w = 1, h = 1] = b;
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) out.add(`${x},${y}`);
  }
  return out;
}

/**
 * Build the Tilemap for a room.
 * @param {object} def  room definition (see maps-dungeon.js)
 */
export function buildRoomMap(def) {
  const map = new Tilemap(ROOM_COLS, ROOM_ROWS);
  const pits = new Set((def.pits || []).map(([c, r]) => `${c},${r}`));
  const vents = new Set((def.vents || []).map(v => `${v.c},${v.r}`));
  const grates = new Set((def.grates || []).map(([c, r]) => `${c},${r}`));
  const blocks = blockCells(def);
  const conv = rectCells(def.conveyors);
  const style = FLOOR_STYLES[def.floor] || FLOOR_STYLES.plate;

  // A cell counts as "masonry" for edge-bevel purposes if it is an interior
  // block OR part of the room's wall ring — that is what makes an inner wall
  // that grows out of the frame read as one continuous structure.
  const isMasonry = (c, r) => {
    if (c < FLOOR_C0 || c > FLOOR_C1 || r < FLOOR_R0 || r > FLOOR_R1) {
      // the inner ring is masonry; the outer ceiling ring is not
      return c >= FLOOR_C0 - 1 && c <= FLOOR_C1 + 1
        && r >= FLOOR_R0 - 1 && r <= FLOOR_R1 + 1;
    }
    return blocks.has(`${c},${r}`);
  };
  const isPit = (c, r) => pits.has(`${c},${r}`);

  const maskAt = (c, r, fn) =>
    (fn(c, r - 1) ? N_BIT : 0) | (fn(c + 1, r) ? E_BIT : 0) |
    (fn(c, r + 1) ? S_BIT : 0) | (fn(c - 1, r) ? W_BIT : 0);

  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const inFloor = c >= FLOOR_C0 && c <= FLOOR_C1 && r >= FLOOR_R0 && r <= FLOOR_R1;
      if (inFloor) {
        const key = `${c},${r}`;
        if (blocks.has(key)) { map.set(c, r, 'bk_' + maskAt(c, r, isMasonry), true); continue; }
        if (pits.has(key)) { map.set(c, r, 'pt_' + maskAt(c, r, isPit), true); continue; }
        if (vents.has(key)) { map.set(c, r, 'fl_vent', false); continue; }
        if (grates.has(key)) { map.set(c, r, 'fl_grate', false); continue; }
        if (conv.has(key)) { map.set(c, r, 'conv0', false); continue; }
        const h = hash(c, r);
        let name = ((c + (r & 1)) & 1) ? style.b : style.a;
        if (h % 17 === 3) name = style.worn;
        else if (h % 23 === 5) name = style.rust;
        map.set(c, r, name, false);
        continue;
      }
      map.set(c, r, wallTileName(c, r, def, isMasonry, maskAt), true);
    }
  }

  // Carve the door openings that exist and are passable.
  for (const [side, d] of Object.entries(def.doors || {})) {
    const cells = DOOR_CELLS[side].cells;
    for (const [c, r] of cells) {
      map.names[r][c] = ((c + (r & 1)) & 1) ? style.b : style.a;
      map.solidGrid[r][c] = true;   // opened later by the room controller
    }
  }
  map._blocks = blocks;
  map._conveyors = conv;
  return map;
}

/** Which wall tile belongs at (c,r). Pipes decorate the outer ring. */
function wallTileName(c, r, def, isMasonry, maskAt) {
  const N = FLOOR_R0 - 1, S = FLOOR_R1 + 1, W = FLOOR_C0 - 1, E = FLOOR_C1 + 1;
  // inner ring: the SAME block masonry the interior structure uses, so the
  // frame and the architecture inside it are one material and the corner turns
  if (r >= N && r <= S && c >= W && c <= E) {
    if (r === N && c > W && c < E && (def.gauges || []).includes(c)) return 'wl_gauge';
    return 'bk_' + maskAt(c, r, isMasonry);
  }
  // outer ring: pipe runs on the verticals, plain cap elsewhere
  if (c === 0 || c === ROOM_COLS - 1) {
    return (r >= 2 && r <= 11) ? 'pipe_v' : 'wl_cap';
  }
  if (r === 0 || r === ROOM_ROWS - 1) {
    return (c >= 3 && c <= 12) ? 'pipe_h' : 'wl_cap';
  }
  return 'wl_cap';
}

/**
 * Bake the tile layer AND the cast shadows.
 *
 * ALttP's dungeon walls drop a hard, flat near-black band onto the floor
 * (measured 5-8 px, no gradient, no dither) under a consistent upper-left
 * light. Without it nothing on screen has thickness. Doing it as a bake pass
 * rather than as tile variants means any block shape a room invents gets its
 * shadow for free, including the doorway thresholds.
 */
export function bakeRoom(map, tiles, convPhase = 0) {
  if (convPhase && map._conveyors && map._conveyors.size) {
    for (const key of map._conveyors) {
      const [c, r] = key.split(',').map(Number);
      map.names[r][c] = 'conv' + convPhase;
    }
  }
  const cv = map.bake(tiles);
  if (convPhase && map._conveyors) {
    for (const key of map._conveyors) {
      const [c, r] = key.split(',').map(Number);
      map.names[r][c] = 'conv0';
    }
  }
  const ctx = cv.getContext('2d');
  const solid = (c, r) => {
    if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return true;
    const n = map.names[r][c];
    return !!n && (n.startsWith('bk_') || n.startsWith('wl_') || n === 'pipe_v'
      || n === 'pipe_h' || n === 'wl_cap');
  };
  const shadeable = (c, r) => {
    if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
    const n = map.names[r][c];
    return !!n && (n.startsWith('fl_') || n.startsWith('conv'));
  };
  ctx.fillStyle = DPAL.d;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (!shadeable(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const up = solid(c, r - 1), left = solid(c - 1, r);
      if (up) ctx.fillRect(x, y, TILE, 5);
      if (left) ctx.fillRect(x, y + (up ? 5 : 0), 4, TILE - (up ? 5 : 0));
      // the inside corner where two shadows meet gets one extra pixel, which
      // is what stops the L-join reading as two unrelated bars
      if (!up && !left && solid(c - 1, r - 1)) ctx.fillRect(x, y, 4, 5);
    }
  }
  return cv;
}

// ===========================================================================
// PROPS
// ===========================================================================

/**
 * A timed steam vent. Cycle: dormant -> hiss (telegraph) -> jet -> dormant.
 * The Bellows Cuff snuffs it for `SNUFF` frames (STORY: about two seconds).
 */
export class SteamVent {
  constructor(c, r, opts = {}) {
    this.c = c; this.r = r;
    this.x = c * TILE; this.y = r * TILE;
    this.period = opts.period ?? 150;
    this.phase = opts.phase ?? 0;
    this.jetFrames = opts.jet ?? 54;
    this.hissFrames = opts.hiss ?? 30;
    this.t = this.phase % this.period;
    this.snuff = 0;
    this.grow = 0;
  }

  static SNUFF = 120;   // ~2 seconds

  /** 'off' | 'hiss' | 'jet' */
  get state() {
    if (this.snuff > 0) return 'off';
    if (this.t < this.hissFrames) return 'hiss';
    if (this.t < this.hissFrames + this.jetFrames) return 'jet';
    return 'off';
  }

  get dangerous() { return this.state === 'jet' && this.grow >= 2; }

  /** World-space damage box — as tall as the column has actually grown. */
  hurtbox() {
    const h = [6, 22, 36, 48][Math.min(3, Math.floor(this.grow))];
    return { x: this.x + 3, y: this.y + 16 - h, w: 10, h };
  }

  snuffOut() {
    if (this.snuff > 0) return false;
    this.snuff = SteamVent.SNUFF;
    this.grow = 0;
    return true;
  }

  update() {
    if (this.snuff > 0) {
      this.snuff--;
      if (this.snuff === 0) this.t = 0;   // restart the cycle cleanly
      this.grow = 0;
      return;
    }
    this.t = (this.t + 1) % this.period;
    const s = this.state;
    if (s === 'jet') this.grow = Math.min(3, this.grow + 0.5);
    else this.grow = Math.max(0, this.grow - 1);
  }

  /**
   * The HARDWARE. Always on screen, drawn with the ground: a vent you cannot
   * see when it is cold is a hazard that erupts out of bare floor. The plume
   * is the state; this is the object.
   */
  drawFixture(ctx, spr) {
    ctx.drawImage(spr.vent_noz, this.x + 2, this.y + 3);
    if (this.snuff > 0) {
      // snuffed: a dead-cold cap, so "I killed this for two seconds" reads
      ctx.fillStyle = DPAL.d;
      ctx.fillRect(this.x + 5, this.y + 6, 6, 4);
    }
  }

  draw(ctx, spr) {
    const s = this.state;
    if (s === 'hiss') {
      // Telegraph: a small puff that pops on a 6-frame beat.
      if ((this.t >> 2) & 1) ctx.drawImage(spr.hiss, this.x, this.y - 8);
      return;
    }
    if (s !== 'jet') return;
    const n = Math.min(3, Math.floor(this.grow));
    ctx.drawImage(spr.jet[n], this.x, this.y - 32);
  }
}

/**
 * A free-standing pillar. Solid at the base only, so Wren walks BEHIND its
 * capital — which is what makes a pillar row break a sightline instead of
 * just being a wall with gaps.
 */
export class Pillar {
  constructor(c, r) {
    this.x = c * TILE; this.y = r * TILE - 12;   // 28 tall, base on the tile
  }
  get baseY() { return this.y + 28; }
  rect() { return { x: this.x + 2, y: this.y + 16, w: 12, h: 11 }; }
  draw(ctx, spr) { ctx.drawImage(spr.pillar, this.x, this.y); }
}

/**
 * A pressure plate. Only a CRATE holds it down — which is the room that
 * finally makes the Cuff's fourth verb load-bearing.
 */
export class PressurePlate {
  constructor(c, r) {
    this.c = c; this.r = r;
    this.x = c * TILE; this.y = r * TILE;
    this.down = false;
  }
  rect() { return { x: this.x + 2, y: this.y + 2, w: 12, h: 12 }; }
  /** @param {Crate[]} crates */
  update(crates) {
    const r = this.rect();
    this.down = crates.some(cr => {
      const b = cr.rect();
      return Math.abs((b.x + b.w / 2) - (r.x + r.w / 2)) < 9
        && Math.abs((b.y + b.h / 2) - (r.y + r.h / 2)) < 9;
    });
    return this.down;
  }
  draw(ctx, spr) { ctx.drawImage(spr.plate[this.down ? 1 : 0], this.x, this.y); }
}

/** A brass gear-switch. The Cuff spins it; it holds for `hold` frames. */
export class GearSwitch {
  constructor(c, r, opts = {}) {
    this.c = c; this.r = r;
    this.x = c * TILE; this.y = r * TILE - 8;   // post is 24 tall
    this.hold = opts.hold ?? 240;
    this.latched = !!opts.latched;   // latched switches never time out
    this.on = false;
    this.timer = 0;
    this.spin = 0;                   // spin animation frames
    this.rect = { x: this.x + 3, y: this.y + 16, w: 10, h: 8 };
  }

  get baseY() { return this.y + 24; }
  /** Blast target box — generous, so aiming is forgiving. */
  blastbox() { return { x: this.x, y: this.y, w: 16, h: 24 }; }

  hitByCuff() {
    this.spin = 40;
    if (this.on && this.latched) return false;
    this.on = true;
    this.timer = this.hold;
    return true;
  }

  update() {
    if (this.spin > 0) this.spin--;
    if (this.on && !this.latched && this.timer > 0 && --this.timer === 0) this.on = false;
  }

  draw(ctx, spr, frame) {
    const set = this.on ? spr.gear_lit : spr.gear;
    const idx = this.spin > 0 ? (frame >> 1) % 3 : (this.on ? (frame >> 4) % 3 : 0);
    ctx.drawImage(set[idx], this.x, this.y);
  }
}

/** A light crate. The Cuff shoves it a whole tile; the blade cannot. */
export class Crate {
  constructor(c, r) {
    this.x = c * TILE; this.y = r * TILE;
    this.slide = null;   // {dx, dy, t}
  }
  get baseY() { return this.y + 16; }
  rect() { return { x: this.x + 1, y: this.y + 4, w: 14, h: 11 }; }
  blastbox() { return { x: this.x, y: this.y, w: 16, h: 16 }; }

  shove(dx, dy, map) {
    if (this.slide) return false;
    const nx = this.x + dx * TILE, ny = this.y + dy * TILE;
    if (!map.boxFree(nx + 1, ny + 4, 14, 11)) return false;
    this.slide = { dx, dy, t: 16, x0: this.x, y0: this.y };
    return true;
  }

  update() {
    if (!this.slide) return;
    const s = this.slide;
    s.t--;
    const p = 1 - s.t / 16;
    this.x = s.x0 + s.dx * TILE * p;
    this.y = s.y0 + s.dy * TILE * p;
    if (s.t <= 0) {
      this.x = s.x0 + s.dx * TILE;
      this.y = s.y0 + s.dy * TILE;
      this.slide = null;
    }
  }

  draw(ctx, spr) {
    ctx.drawImage(spr.crate, Math.round(this.x), Math.round(this.y));
  }
}

/**
 * A STEAM CANISTER — the Boilerworks' pot.
 *
 * It speaks the hittable protocol the Cogblade already knows (`hp`,
 * `hurtbox()`, `onHit()`) and deliberately does NOT declare `hitstopFrames`:
 * combat.js freezes the swing only for creatures, so mowing a canister stays
 * weightless and the freeze keeps meaning "you hit something that is alive".
 * It is also a collision obstacle, which is why combat.js's `wallAhead` probe
 * excludes anything in the hittable list — a canister must never ring like a
 * wall.
 *
 * Placement lives in scenes/dungeon.js (CANISTERS), not in the room defs: the
 * room graph belongs to maps-dungeon.js and the health economy belongs to the
 * scene that spends it.
 */
export class Canister {
  constructor(c, r, loot) {
    this.c = c; this.r = r;
    this.x = c * TILE; this.y = r * TILE;
    this.loot = loot || 'maybe';
    this.hp = 1;
    this.dead = false;
    this.obstacle = null;
    this.onBreak = null;
  }
  get baseY() { return this.y + 15; }
  // The top two thirds of the cell: the blade reaches the barrel, not the
  // shadow it casts on the deck.
  hurtbox() { return { x: this.x + 2, y: this.y + 2, w: 12, h: 12 }; }
  // What Wren walks into. Shallower than the sprite so he can stand in front
  // of one and swing without the footprint pushing him out of blade reach.
  rect() { return { x: this.x + 2, y: this.y + 6, w: 12, h: 9 }; }

  onHit() {
    if (this.hp <= 0) return;
    this.hp = 0;
    this.dead = true;
    if (this.onBreak) this.onBreak(this);
  }

  draw(ctx, spr) {
    if (this.dead) return;
    ctx.drawImage(spr.canister, this.x, this.y);
  }
}

/** A treasure chest. Opens on A when Wren stands below it facing up. */
export class Chest {
  constructor(c, r, item) {
    this.x = c * TILE; this.y = r * TILE;
    this.item = item;
    this.open = false;
  }
  get baseY() { return this.y + 16; }
  rect() { return { x: this.x + 1, y: this.y + 2, w: 14, h: 13 }; }
  draw(ctx, spr) {
    ctx.drawImage(this.open ? spr.chest_open : spr.chest, this.x, this.y);
  }
}

/**
 * A door in one wall of a room. States: 'open' | 'shut' | 'locked' | 'boss'.
 * Shut doors slam behind Wren for a fight and open when it is won.
 */
export class Door {
  constructor(side, opts = {}) {
    this.side = side;
    this.state = opts.state || 'open';
    this.to = opts.to || null;
    this.anim = 0;               // opening animation frames
    const d = DOOR_CELLS[side];
    this.x = d.x; this.y = d.y; this.w = d.w; this.h = d.h;
  }

  get passable() { return this.state === 'open' && this.anim === 0; }

  openUp() {
    if (this.state === 'open') return false;
    this.state = 'open';
    this.anim = 18;
    return true;
  }
  shut() { if (this.state === 'open') this.state = 'shut'; }

  update() { if (this.anim > 0) this.anim--; }

  /**
   * Jamb first, then the iron shutter. The shutter retracts INTO the jamb it
   * is hinged on over the 18-frame open, so a door visibly rolls away rather
   * than blinking out. Locks ride on the closed shutter.
   */
  draw(ctx, spr) {
    const key = { north: 'door_n', south: 'door_s', east: 'door_e', west: 'door_w' }[this.side];
    ctx.drawImage(spr[key], this.x, this.y);
    if (this.state === 'open' && this.anim === 0) return;

    const p = this.anim > 0 ? this.anim / 18 : 1;   // 1 = fully shut
    const full = 24;
    const vis = Math.max(0, Math.round(full * p));
    if (vis > 0) {
      if (this.side === 'north') {
        ctx.drawImage(spr.shutter, 0, 0, 20, vis, this.x + 6, this.y + 6, 20, vis);
      } else if (this.side === 'south') {
        ctx.drawImage(spr.shutter, 0, full - vis, 20, vis,
          this.x + 6, this.y + 26 - vis, 20, vis);
      } else if (this.side === 'west') {
        ctx.drawImage(spr.shutter_v, 0, 0, vis, 20, this.x + 6, this.y + 6, vis, 20);
      } else {
        ctx.drawImage(spr.shutter_v, full - vis, 0, vis, 20,
          this.x + 26 - vis, this.y + 6, vis, 20);
      }
    }
    if (this.anim > 0) return;
    if (this.state === 'locked') ctx.drawImage(spr.padlock, this.x + 12, this.y + 10);
    if (this.state === 'boss') ctx.drawImage(spr.big_lock, this.x + 8, this.y + 8);
  }
}

// ===========================================================================
// TIN SOLDIER
//
// Wind-up infantry. Marches a fixed beat, halts, RAISES the pike (a clear
// 24-frame telegraph with a brass glint), then thrusts it 14px. Its front is
// a riveted shield: the Cogblade CLANGS off the facing it is looking at, so
// the fight is about getting behind it — or, once Wren has the Cuff, about
// blasting it into a stagger and hitting it while it is spun round.
// ===========================================================================

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const RIGHT_OF = { up: 'right', right: 'down', down: 'left', left: 'up' };

// ------------------------------------------------- THE HIT REACTION (shared) ---
//
// MEASURED BEFORE (tools/critic/bd18-tin.js, B4, open face, one swing):
//   knockback  2.00 px/frame FLAT for 8 frames = 16.0 px, then it stops dead
//   white flash  2 drawn frames (the old `flash % 3` strobe on a 4-count)
//   hitstop      none, on either side — `hitstopFrames` was UNDEFINED, so
//                combat.js:1115 never froze the swing and never struck a spark
//   state        'march' straight through the hit and straight out the far side
// game/enemies.js measures 3.20 px/frame decaying over 17.60 px in 10 frames,
// a 5-frame LATCHED white flash, walk -> hurt -> pause, and 3 frames of hitstop
// on both sides. The tin soldier is the melee that guards the Bellows Cuff; it
// must not read softer than a bridge beetle. It now runs the same protocol,
// off the same HIT constants.
//
// The four helpers below are byte-for-byte the enemies.js ones. They are
// module-private THERE and this piece does not own that file, so they are
// re-declared rather than re-invented — every TUNING NUMBER still comes from
// the imported HIT, which is the thing that must never fork.
function dirToVec(dir) {
  if (dir && typeof dir === 'object') {
    const d = Math.hypot(dir.x, dir.y) || 1;
    return [dir.x / d, dir.y / d];
  }
  return DIRV[dir] || [0, 1];
}

/** Recoil VECTOR away from the strike, decaying over HIT.KB_T frames. */
function kbFrom(dir, scale = 1) {
  const [vx, vy] = dirToVec(dir);
  return {
    vx: vx * HIT.KB_PEAK * scale, vy: vy * HIT.KB_PEAK * scale,
    t: HIT.KB_T, n: HIT.KB_T,
  };
}

// One frame of recoil, per axis, in 0.5px steps, so a recoil into a wall grazes
// along it instead of throwing the whole frame away. Returns false when spent.
function kbSlide(ent, map, box) {
  const k = ent.kb;
  const decay = k.t / k.n;
  for (const axis of ['x', 'y']) {
    const v = (axis === 'x' ? k.vx : k.vy) * decay;
    if (!v) continue;
    const sign = Math.sign(v);
    let rem = Math.abs(v);
    while (rem > 1e-6) {
      const step = Math.min(0.5, rem) * sign;
      const nx = axis === 'x' ? ent.x + step : ent.x;
      const ny = axis === 'y' ? ent.y + step : ent.y;
      if (map && !map.boxFree(nx + box.x, ny + box.y, box.w, box.h)) break;
      ent.x = nx; ent.y = ny;
      rem -= Math.abs(step);
    }
  }
  return --k.t > 0;
}

// THE FLASH IS LATCHED. Every scene calls melee.update() — which calls onHit()
// — BEFORE the enemy's own update(), so a plain counter is set and decremented
// inside one frame and renders once. These tick the counter on DRAWN frames:
// the flash is exactly N rendered frames whatever order the host runs in.
function flashTick(ent) {
  if (ent.flash > 0 && ent._flashDrawn) { ent.flash--; ent._flashDrawn = 0; }
}
function flashFrame(ent) {
  if (!(ent.flash > 0)) return false;
  ent._flashDrawn = 1;
  return true;
}

// ---------------------------------------------------------------- VOICES ---
//
// The dungeon's creatures were as mute as the overworld's: the only sound in
// this whole file was the Riveter's `rivet`, so three tin soldiers could march
// a player down and stab him without making a noise. What they say now, and
// why these names:
//
//   raise   -> `clink`  "BLADE ON BRASS": two inharmonic triangles over a noise
//                       tick — struck brass, which is exactly what the raise
//                       pose IS (the pike lifts and the brass catches the
//                       light). It is the same family as the ring the shield
//                       already makes when it turns the Cogblade aside, and
//                       that is the point: brass is what a tin soldier sounds
//                       like, whichever end of it you are at.
//   thrust  -> `land`   "BOOTS HIT DECK". The front foot slams as the pike
//                       goes out; a dull weighted thud on the exact frame
//                       spearbox() becomes dangerous is the cue to move.
//
// Fired on the STATE CHANGE, so `raise` is heard at the top of the 26-frame
// telegraph and `thrust` at the top of the 14-frame lunge — a ting, then a
// half-second of nothing, then a THUD. Nothing overrides the bank's pitch
// jitter (clink +/-150 cents, land 80), its retrigger cooldowns or its
// polyphony caps: B4 puts THREE of these in one room, and letting the bank
// decline the third simultaneous ring is how it stays inside the voice budget.
//
// Routing is `window.__gwSfx`, the hook this file already used for the
// Riveter's `rivet` (now routed through here too, so the dungeon has ONE
// channel): every shipping host of the Boilerworks — scenes/dungeon.js and
// scenes/game.js — imports sfx.js, and importing it installs that hook and
// arms the first-gesture unlock. A host that wants to own the routing sets
// `onVoice` on the instance, the same shape game/enemies.js accepts.
//
// The hook is NOT called `sfx`/`onSfx` on purpose — combat.js's voicesItself()
// reads either of those as "this entity answers the blade itself" and would
// stop playing the tin soldier's own hit and deflect sounds.
function voice(ent, name, opts) {
  if (!name) return false;
  try {
    if (ent && typeof ent.onVoice === 'function') return ent.onVoice(name, opts) !== false;
    if (typeof window !== 'undefined' && window.__gwSfx) return window.__gwSfx(name, opts) !== false;
  } catch (e) { /* audio must never break the fight */ }
  return false;
}

export class TinSoldier {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;              // 16x22 sprite top-left
    this.dir = opts.dir || 'down';
    this.hp = opts.hp ?? 3;
    this.dead = false;
    // march | halt | raise | thrust | recover | hurt | pause | stagger | die
    this.state = 'march';
    this.timer = opts.phase ?? 40;
    this.animT = 0;
    this.iframes = 0;
    this.flash = 0;                      // DRAWN white frames left (latched)
    this._flashDrawn = 0;
    this.kb = null;                      // {vx, vy, t, n} recoil (see kbFrom)
    this.stop = 0;                       // hitstop frames left
    this.hitstopFrames = HIT.STOP;       // what a connect costs the attacker
    this.thrust = 0;                     // px the pike is extended
    this.spr = null;
    this.route = opts.route || null;     // optional [dir, frames] loop
    this.routeI = 0;
  }

  static SPEED = 0.5;
  static HB = { x: 3, y: 12, w: 10, h: 9 };

  get baseY() { return this.y + 22; }
  hurtbox() { return { x: this.x + 2, y: this.y + 3, w: 12, h: 15 }; }
  /** Damage box in front while thrusting. */
  spearbox() {
    if (this.thrust <= 2) return null;
    const [dx, dy] = DIRV[this.dir];
    const cx = this.x + 8 + dx * (10 + this.thrust);
    const cy = this.y + 11 + dy * (10 + this.thrust);
    return { x: cx - 4, y: cy - 4, w: 8, h: 8 };
  }
  get hazard() { return this.state === 'thrust'; }

  /** Which facings are armoured. The shield covers the way it is looking. */
  shielded(fromDir) { return !this.staggered && fromDir === this.dir; }
  get staggered() { return this.state === 'stagger'; }

  onHit(dir) {
    if (this.dead || this.state === 'die' || this.iframes > 0) return 'none';
    // Work out which side the blow came from.
    let vx = 0, vy = 0;
    if (dir && typeof dir === 'object') { vx = dir.x; vy = dir.y; }
    else { [vx, vy] = DIRV[dir] || [0, 1]; }
    // DEGENERATE VECTOR (HANDOFF, "carried-forward findings"). combat.js builds
    // `dir` from hurtbox-centre minus player-centre; if those land on exactly
    // the same point in BOTH axes it hands over {0,0}, dirToVec's `hypot || 1`
    // turns that into a zero recoil, and the fix everyone just made comes
    // undone on the one unguarded path. Vanishingly unlikely, never zero.
    // The fallback shoves it along its OWN facing, which lands the blow on the
    // face behind the shield: standing dead centre on a tin soldier means you
    // are inside its guard, and a directionless blow must not quietly become a
    // block. Any fixed choice is arbitrary; this one is at least never free.
    if (!vx && !vy) [vx, vy] = DIRV[this.dir] || [0, 1];
    // The attack travels along (vx,vy); it lands on the face opposite it.
    const face = Math.abs(vx) > Math.abs(vy)
      ? (vx > 0 ? 'left' : 'right')
      : (vy > 0 ? 'up' : 'down');
    if (this.shielded(face)) {
      // BLADE ON BRASS. No flash, no hitstop — combat.js only freezes a swing
      // that actually landed — just a shove, so the ring reads as deflection.
      this.iframes = 10;
      this.kb = kbFrom({ x: vx, y: vy }, 0.45);   // 7.9 px, a quarter of a hit
      return 'block';
    }
    this.hp--;
    this.iframes = 22;
    this.stop = HIT.STOP;                          // it freezes with the blade
    this.kb = kbFrom({ x: vx, y: vy });            // 3.20 px/f -> 17.6 px / 10 f
    this.thrust = 0;                               // the pike drops when it's hit
    if (this.hp <= 0) {
      // The corpse takes the hit with it: it burns white and slides the full
      // recoil before it bursts, ALttP-style, instead of popping on the spot.
      this.state = 'die'; this.timer = 16;
      this.flash = HIT.STOP + HIT.KB_T;
    } else {
      this.flash = HIT.FLASH;
      // A STAGGERED soldier stays staggered: the spun-round window is the
      // Cuff's whole reward and a hit must not cut it short. Otherwise a named
      // state, so a trace can see the reaction and so it is not "marching"
      // while it is being thrown backwards.
      if (this.state !== 'stagger') { this.state = 'hurt'; this.timer = 0; }
    }
    return 'hit';
  }

  /** The Bellows Cuff spins it around and leaves it reeling. */
  hitByCuff(dx, dy) {
    if (this.dead || this.state === 'die') return false;
    this.state = 'stagger';
    this.timer = 110;
    this.thrust = 0;
    // 2.4 x the blade's recoil: 42 px of skid, the same total the flat
    // 2.4 px/frame x 9 frames used to give, now on the decaying curve every
    // other creature recoils on.
    this.kb = kbFrom({ x: dx, y: dy }, 2.4);
    // spun round: it now faces away from the blast
    this.dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return true;
  }

  _free(map, x, y) {
    const h = TinSoldier.HB;
    return map.boxFree(x + h.x, y + h.y, h.w, h.h);
  }

  update(engine, map, player) {
    if (this.dead) return;
    flashTick(this);
    // HITSTOP. Frozen mid-recoil for HIT.STOP frames while the white flash
    // reads; combat.js freezes the swinging player for the same count off
    // `hitstopFrames`, so the whole screen holds on the impact.
    if (this.stop > 0) { this.stop--; return; }
    if (this.state === 'die') {
      // Death slide first (white), then the shower of sparks. combat.js's
      // _tickDying watches `kb`/`stop` and holds the poof until this clears.
      if (this.kb) {
        if (!kbSlide(this, map, TinSoldier.HB)) { this.kb = null; this.flash = 0; this.timer = 16; }
        return;
      }
      if (--this.timer <= 0) this.dead = true;
      return;
    }
    if (this.iframes > 0) this.iframes--;
    if (this.kb) {
      if (!kbSlide(this, map, TinSoldier.HB)) {
        this.kb = null;
        // THE BACK-OFF BEAT. It does not march straight back into the player:
        // it lands winded with the pike down. A stagger keeps its own clock.
        if (this.state === 'hurt') {
          this.state = 'pause';
          this.timer = 16 + Math.floor(engine.rand() * 14);
          this.thrust = 0;
        }
      }
      return;
    }

    const pcx = player.x + 8, pcy = player.y + 16;
    const cx = this.x + 8, cy = this.y + 11;
    const dist = Math.hypot(pcx - cx, pcy - cy);

    switch (this.state) {
      case 'stagger':
        this.animT += 2;
        if (--this.timer <= 0) { this.state = 'march'; this.timer = 40; }
        break;

      // Winded, pike down. The half-second the recoil bought the player.
      case 'pause':
        this.animT = 0;
        if (--this.timer <= 0) {
          this.state = 'march';
          this.timer = 40 + Math.floor(engine.rand() * 40);
        }
        break;

      case 'march': {
        this.animT++;
        const [dx, dy] = DIRV[this.dir];
        const nx = this.x + dx * TinSoldier.SPEED, ny = this.y + dy * TinSoldier.SPEED;
        if (this._free(map, nx, ny)) { this.x = nx; this.y = ny; }
        else this.timer = 0;
        // Turn to face Wren and attack if he is in the lane in front.
        if (dist < 30 && this._facingPlayer(pcx, pcy)) {
          this.state = 'raise'; this.timer = 26;
          voice(this, 'clink');            // THE TELEGRAPH. See VOICES above.
          break;
        }
        if (--this.timer <= 0) { this.state = 'halt'; this.timer = 22; }
        break;
      }

      case 'halt':
        this.animT = 0;
        if (--this.timer <= 0) {
          if (dist < 38) {
            this.dir = Math.abs(pcx - cx) > Math.abs(pcy - cy)
              ? (pcx > cx ? 'right' : 'left') : (pcy > cy ? 'down' : 'up');
            this.state = 'raise'; this.timer = 26;
            voice(this, 'clink');
          } else {
            this.dir = this.route
              ? this._nextRouteDir()
              : (engine.rand() < 0.5 ? RIGHT_OF[this.dir] : RIGHT_OF[RIGHT_OF[RIGHT_OF[this.dir]]]);
            this.state = 'march';
            this.timer = 50 + Math.floor(engine.rand() * 60);
          }
        }
        break;

      case 'raise':
        // telegraph: the pike lifts, the brass catches the light
        this.thrust = -Math.round(6 * (1 - this.timer / 24));
        if (--this.timer <= 0) {
          this.state = 'thrust'; this.timer = 14;
          voice(this, 'land');             // the boot slams as the pike goes out
        }
        break;

      case 'thrust': {
        const p = 1 - this.timer / 14;
        this.thrust = Math.round(16 * Math.sin(Math.min(1, p * 1.6) * Math.PI / 2));
        if (--this.timer <= 0) { this.state = 'recover'; this.timer = 38; }
        break;
      }

      case 'recover':
        this.thrust = Math.round(16 * (this.timer / 38));
        if (--this.timer <= 0) {
          this.thrust = 0;
          this.state = 'march';
          this.timer = 60 + Math.floor(engine.rand() * 50);
        }
        break;
    }
  }

  _nextRouteDir() {
    this.routeI = (this.routeI + 1) % this.route.length;
    return this.route[this.routeI];
  }

  _facingPlayer(pcx, pcy) {
    const [dx, dy] = DIRV[this.dir];
    const rx = pcx - (this.x + 8), ry = pcy - (this.y + 11);
    return (rx * dx + ry * dy) > 6 && Math.abs(rx * dy - ry * dx) < 14;
  }

  draw(ctx, frame) {
    if (this.dead) return;
    const s = this.spr;
    const rx = Math.round(this.x), ry = Math.round(this.y);
    // The burst only replaces the body once the corpse has finished sliding —
    // while `kb` is live it is still a tin soldier, burning white.
    if (this.state === 'die' && !this.kb) {
      const i = Math.min(2, Math.floor((16 - this.timer) / 5));
      ctx.drawImage(s.spark[i % 2], rx + 3 + (i * 2), ry + 4);
      ctx.drawImage(s.spark[(i + 1) % 2], rx + 8 - i, ry + 12);
      return;
    }
    // The white damage flash OUTRANKS the invulnerability flicker: a blinked-out
    // frame draws nothing, so it would also eat a frame of the flash it is
    // supposed to be showing (and flashFrame below would never latch).
    if (this.iframes > 0 && (this.iframes >> 1) % 2 === 0 && this.flash <= 0) return;
    ctx.drawImage(s.shadow16, rx + 2, ry + 19);
    // Latched ONCE per drawn frame — flashFrame() is what advances the counter,
    // so body, legs and pike must all read the same answer.
    const white = flashFrame(this);

    // pike, behind the body on up-facing, in front otherwise
    const drawPike = () => {
      const t = this.thrust;
      const key = 'pike_' + this.dir;
      const img = white ? s.tin.white[key] : s.tin[key];
      let px = rx, py = ry;
      if (this.dir === 'up') { px = rx + 11; py = ry - 6 - t; }
      else if (this.dir === 'down') { px = rx + 1; py = ry + 8 + t; }
      else if (this.dir === 'left') { px = rx - 12 - t; py = ry + 7; }
      else { px = rx + 12 + t; py = ry + 7; }
      ctx.drawImage(img, Math.round(px), Math.round(py));
    };

    if (this.dir === 'up') drawPike();
    // Solid for the whole flash, not a %3 strobe: the old strobe measured TWO
    // drawn white frames off the canvas where enemies.js measures five.
    const body = white ? s.tin.white[this.dir] : s.tin[this.dir];
    const bob = this.state === 'stagger' ? ((frame >> 1) & 1) : 0;
    const legF = (Math.floor(this.animT / 7) & 1);
    const legs = white ? s.tin.white.legs[legF] : s.tin.legs[legF];
    ctx.drawImage(legs, rx + bob, ry + 16);
    ctx.drawImage(body, rx + bob, ry);
    if (this.dir !== 'up') drawPike();
    // stagger: three loose sparks orbit the helmet
    if (this.state === 'stagger') {
      const a = frame * 0.22;
      for (let i = 0; i < 3; i++) {
        const t = a + i * 2.1;
        ctx.drawImage(s.spark[(frame >> 2) & 1],
          Math.round(rx + 6 + Math.cos(t) * 8), Math.round(ry - 3 + Math.sin(t) * 3));
      }
    }
  }
}

// ===========================================================================
// THE RIVETER — miniboss (B6)
//
// A wall-mounted clockwork arm. Two bones, drawn as a chain of brass links
// solved with 2-bone IK so the arm genuinely articulates; a glowing ELBOW is
// the joint that drives it, and a rivet gun on the end.
//
// Loop:  TRACK (the gun follows Wren) -> AIM (30 frames, the elbow flares and
// the gun kicks back) -> FIRE 3 rivets -> RESET. Steel plates cover the elbow
// while the arm is powered: the Cogblade rings off it. A Cuff blast into the
// arm chokes its air line — the elbow slumps to the floor and hangs OPEN for
// 130 frames, and that is the only window the blade can use.
// ===========================================================================

export class Riveter {
  constructor(opts = {}) {
    this.sx = opts.x ?? 128;    // shoulder pivot
    this.sy = opts.y ?? 36;
    this.upper = 46;
    this.fore = 40;
    this.hand = { x: this.sx, y: this.sy + 70 };
    this.elbow = { x: this.sx, y: this.sy + 46 };
    this.hp = 6;
    this.dead = false;
    this.state = 'track';
    this.timer = 70;
    this.iframes = 0;
    this.flash = 0;                    // DRAWN white frames left (latched)
    this._flashDrawn = 0;
    this.stop = 0;                     // hitstop frames left
    this.hitstopFrames = HIT.STOP;     // what a connect costs the attacker
    this.stagger = 0;
    this.staggerHits = 0;   // blade hits taken in THIS stagger (max 2)
    this.cuffCool = 0;      // frames before another blast can choke it
    this.rivets = [];
    this.spr = null;
    this.dieT = 0;
    this.shots = 0;
    // --- the three things that make standing still wrong (see update) ---
    this.mark = null;       // where Wren stood while the arm was down
    this.still = 0;         // consecutive frames Wren has not moved
    this.volley = 0;        // which volley this is; mirrors the fan
    this._lpx = 0; this._lpy = 0;
    // probe counters
    this.punishShots = 0; this.fanShots = 0; this.rushes = 0;
  }

  static RIVET_COOL = 150;   // frames of Cuff immunity after a stagger
  static FAN = [0, -0.19, 0.19, 0];   // per-shot angular offset, radians

  get baseY() { return 999; }   // always drawn last within the room
  get vulnerable() { return this.stagger > 0; }

  /** The elbow is the weak point; blast box covers the whole arm. */
  hurtbox() { return { x: this.elbow.x - 7, y: this.elbow.y - 7, w: 14, h: 14 }; }
  blastbox() {
    const x0 = Math.min(this.sx, this.elbow.x, this.hand.x) - 10;
    const x1 = Math.max(this.sx, this.elbow.x, this.hand.x) + 10;
    const y0 = this.sy - 6, y1 = Math.max(this.elbow.y, this.hand.y) + 10;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * TWO HITS PER STAGGER, then the elbow armour reseats and the blade rings
   * off it — the same rule KETTLEBACK's cradle collar follows, for the same
   * reason. A 108-frame stagger is five swings, and at four hit points that
   * made the whole miniboss ONE stagger: measured, an autopilot that stood
   * under the arm and blasted killed it in 288 frames, four and a half
   * seconds, having seen its aim-and-fire cycle once. Six hit points at two
   * per stagger is three full advance / blast / strike / duck cycles, which
   * is the thing B6 exists to teach.
   */
  onHit(dir) {
    if (this.dead || this.state === 'die' || this.iframes > 0) return 'none';
    if (!this.vulnerable || this.staggerHits >= 2) { this.iframes = 12; return 'block'; }
    this.hp--;
    this.staggerHits++;
    this.iframes = 20;
    // Same protocol as the tin soldier: the arm has no recoil (it is bolted to
    // the wall) but a blow that lands still freezes the blade and burns white.
    this.stop = HIT.STOP;
    this.flash = this.hp <= 0 ? 40 : HIT.FLASH;
    if (this.hp <= 0) { this.state = 'die'; this.dieT = 0; }
    // second bite: the arm hauls itself back up early
    else if (this.staggerHits >= 2) this.stagger = Math.min(this.stagger, 26);
    return 'hit';
  }

  /**
   * IT BRACES AFTER EVERY STAGGER. Without this cooldown the Cuff's own
   * 30-frame cycle is shorter than the stagger, so a player who simply stands
   * under the arm and blasts on a metronome re-chokes it the frame it stands
   * up and it NEVER FIRES A RIVET: measured, a full kill in which the arm
   * spent 249 frames staggered, 74 tracking and zero aiming. B6's lesson is
   * cover, and a boss that never shoots teaches nothing about cover.
   *
   * 66 frames was ONE track-and-aim and it did not land: round 14 measured a
   * bot parked on a single tile tapping B every 10 frames killing the arm in
   * 653-881 frames taking ZERO half-hearts at four latencies, because 66
   * frames expires DURING the aim and the next blast lands before the gun
   * ever fires. RIVET_COOL is now the whole cycle — punish (20) + track (34)
   * + aim (30) + four shots (39) = 123 frames — so between any two staggers
   * the arm gets a complete volley off and the duck has to happen once per
   * hit pair. It expires nine frames inside the reset, so the metronome is
   * still the right idea; it just cannot run unbroken.
   */
  hitByCuff() {
    if (this.dead || this.state === 'die') return false;
    if (this.stagger > 0 || this.cuffCool > 0) return false;
    this.stagger = 108;
    this.staggerHits = 0;
    this.state = 'stagger';
    this.timer = 108;
    return true;
  }

  _solve(tx, ty) {
    // 2-bone IK from the shoulder to (tx,ty); elbow bends to the LEFT so the
    // arm always reads as one shape rather than snapping between solutions.
    // The target is clamped to the room first: an arm bolted to the north
    // wall that reaches ABOVE it is not a pose, it is a bug with a sprite.
    tx = Math.max(28, Math.min(228, tx));
    ty = Math.max(this.sy + 26, Math.min(184, ty));
    const dx = tx - this.sx, dy = ty - this.sy;
    let d = Math.hypot(dx, dy);
    const max = this.upper + this.fore - 1;
    const min = Math.abs(this.upper - this.fore) + 1;
    d = Math.max(min, Math.min(max, d));
    const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
    const hx = this.sx + ux * d, hy = this.sy + uy * d;
    const a = (this.upper * this.upper - this.fore * this.fore + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.upper * this.upper - a * a));
    // perpendicular, biased so the elbow kicks out to the right of the reach
    const px = -uy, py = ux;
    this.hand = { x: hx, y: hy };
    this.elbow = { x: this.sx + ux * a + px * h, y: this.sy + uy * a + py * h };
  }

  update(engine, player, room) {
    if (this.dead) return;
    for (const r of this.rivets) r.update(room);
    this.rivets = this.rivets.filter(r => !r.dead);
    flashTick(this);
    // Hitstop, matching the swing. The rivets already in the air keep flying —
    // freezing them would read as a pause, not as an impact.
    if (this.stop > 0) { this.stop--; return; }
    if (this.iframes > 0) this.iframes--;
    if (this.cuffCool > 0) this.cuffCool--;

    if (this.state === 'die') {
      this.dieT++;
      // the arm folds up against the mount
      const t = Math.min(1, this.dieT / 70);
      this._solve(this.sx + Math.sin(this.dieT * 0.4) * (10 * (1 - t)),
        this.sy + 74 - 60 * t);
      if (this.dieT > 110) this.dead = true;
      return;
    }

    const pcx = player.x + 8, pcy = player.y + 14;

    // STANDING STILL IS A DECISION THE ROOM GETS TO ANSWER. `still` counts
    // frames in which Wren's centre moved less than a third of a pixel; the
    // track window collapses once he has held one tile for half a second, so
    // the reward for parking under the arm is that the gun stops leading and
    // just shoots. A player who keeps walking gets the full 60-frame lead-in.
    const moved = Math.hypot(pcx - this._lpx, pcy - this._lpy);
    this._lpx = pcx; this._lpy = pcy;
    if (moved < 0.34) this.still++; else this.still = 0;

    if (this.stagger > 0) {
      this.stagger--;
      // limp: the arm hangs, the elbow sags to the deck and swings slightly
      const sway = Math.sin(this.stagger * 0.09) * 12;
      this._solve(this.sx + sway, this.sy + 78);
      // It remembers the tile you struck it from. Everything after this is
      // aimed there, not at you — so the punish is escapable, but only by
      // moving, which is the one thing the round-14 bot never had to do.
      this.mark = { x: pcx, y: pcy };
      if (this.stagger === 0) {
        this.state = 'punish'; this.timer = 20; this.cuffCool = Riveter.RIVET_COOL;
      }
      return;
    }

    switch (this.state) {
      // THE STAND-UP SHOT. The arm snaps off the deck and puts two rivets
      // into the spot it was struck from, 20 frames after the elbow lifts.
      // This is the whole answer to "parked on one tile tapping B": the
      // frame you win the stagger is the frame that tile becomes the target.
      case 'punish': {
        const m = this.mark || { x: pcx, y: pcy };
        const k = 1 - this.timer / 20;
        const cur = this.hand;
        // haul up out of the limp pose toward the mark
        this._solve(cur.x + (m.x - cur.x) * (0.10 + k * 0.22),
          cur.y + ((m.y - 30) - cur.y) * (0.10 + k * 0.22));
        if (--this.timer <= 0) {
          const dx = m.x - this.hand.x, dy = m.y - this.hand.y;
          const a0 = Math.atan2(dy, dx);
          for (const off of [-0.17, 0.17]) {
            this.rivets.push(new Rivet(this.hand.x - 3, this.hand.y - 3,
              Math.cos(a0 + off) * 2.3, Math.sin(a0 + off) * 2.3));
          }
          this.punishShots += 2;
          this._fireSfx();
          this.state = 'track'; this.timer = 34;
        }
        break;
      }
      case 'track': {
        // the gun leads Wren, capped so it never snaps
        const tx = Math.max(48, Math.min(208, pcx));
        const ty = Math.max(this.sy + 40, Math.min(180, pcy - 26));
        const cur = this.hand;
        this._solve(cur.x + (tx - cur.x) * 0.06, cur.y + (ty - cur.y) * 0.06);
        // parked: cut the lead-in short and go straight to the telegraph
        if (this.still >= 30 && this.timer > 10) { this.timer = 10; this.rushes++; }
        if (--this.timer <= 0) {
          this.state = 'aim'; this.timer = 30; this.shots = 0; this.volley++;
          this.aimFrom = { x: this.hand.x, y: this.hand.y };
        }
        break;
      }
      case 'aim': {
        // Telegraph: the arm cocks back 8px and the elbow flares.
        //
        // THE COCK-BACK IS ABSOLUTE, NOT INTEGRATED. This used to read
        // `_solve(hand.x, hand.y - back * 0.4)` — a DELTA applied to the pose
        // it produced last frame — so a 30-frame aim did not cock back 8px,
        // it walked the hand ~60px up the screen and left it there. One
        // volley per fight hid it; the moment the arm survives long enough to
        // aim ten times (which is the whole point of RIVET_COOL) the hand
        // climbs out of the room, blastbox() inverts to a NEGATIVE height so
        // the Cuff can never reach it again, and every rivet spawns above y=0
        // and dies against the off-map solid on its first step. Measured
        // before the fix: hand at (126,-41), blastbox h = -28, 44 rivets
        // fired and none within 36px of a pinned Wren. Anchor to the pose the
        // aim STARTED from and the tell is the 8px it always claimed to be.
        const from = this.aimFrom || this.hand;
        const back = Math.sin((1 - this.timer / 30) * Math.PI) * 8;
        this._solve(from.x, from.y - back);
        if (--this.timer <= 0) { this.state = 'fire'; this.timer = 0; }
        break;
      }
      case 'fire': {
        if (this.timer <= 0) {
          // FOUR LANES, NOT ONE. Every shot used to be aimed dead at Wren's
          // centre, which means one sidestep clears the whole volley and the
          // room's cover never has to be used. The volley is a fan around the
          // live aim — centre, then wide either side, then centre again —
          // and the fan MIRRORS on alternate volleys, so the lane that was
          // safe last time is the one that is covered now.
          const mir = (this.volley & 1) ? -1 : 1;
          const off = Riveter.FAN[this.shots % Riveter.FAN.length] * mir;
          const dx = pcx - this.hand.x, dy = pcy - this.hand.y;
          const a0 = Math.atan2(dy, dx) + off;
          this.rivets.push(new Rivet(this.hand.x - 3, this.hand.y - 3,
            Math.cos(a0) * 2.3, Math.sin(a0) * 2.3));
          if (off !== 0) this.fanShots++;
          this.shots++;
          this.timer = 13;
          this._fireSfx();
        } else this.timer--;
        if (this.shots >= 4) { this.state = 'reset'; this.timer = 36; }
        break;
      }
      case 'reset':
        if (--this.timer <= 0) { this.state = 'track'; this.timer = 48 + Math.floor(engine.rand() * 34); }
        break;
    }
  }

  /**
   * `clink` is the bank's PARRY — a blade turned aside. This is a pneumatic
   * nailgun, and `rivet` is the sound written for it, caption and all
   * ("THE RIVETER FIRES"). It was one of nine authored effects no shipping
   * module could reach.
   */
  _fireSfx() { voice(this, 'rivet'); }

  draw(ctx, frame) {
    const s = this.spr;
    if (this.dead) {
      // the wrecked mount stays bolted to the wall, dark and still
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tintCache(s.riv_mount, '#3a2c1c'), this.sx - 16, this.sy - 14);
      ctx.restore();
      return;
    }
    // mount
    ctx.drawImage(s.riv_mount, this.sx - 16, this.sy - 14);
    // Bones drawn as SOLID tubes: a per-pixel march along the bone laying a
    // 7px perpendicular run — outline / bright / mid / mid / dark / outline.
    // Brass knuckle links are then blitted every 8px so the limb still reads
    // as clockwork rather than as a hose.
    drawBone(ctx, this.sx, this.sy, this.elbow.x, this.elbow.y);
    drawBone(ctx, this.elbow.x, this.elbow.y, this.hand.x, this.hand.y);
    // shoulder knuckle, so the arm has a joint where it leaves the mount
    ctx.drawImage(s.riv_link, this.sx - 4, this.sy - 4);
    // elbow
    let elbow = this.vulnerable ? s.riv_elbow_open : s.riv_elbow;
    if (flashFrame(this)) elbow = tintCache(elbow, '#f8f8f8');
    if (!(this.iframes > 0 && !this.vulnerable && (this.iframes >> 1) % 2 === 0)) {
      ctx.drawImage(elbow, Math.round(this.elbow.x) - 5, Math.round(this.elbow.y) - 5);
    }
    // gun
    ctx.drawImage(s.riv_gun, Math.round(this.hand.x) - 6, Math.round(this.hand.y) - 6);
    // aim flare — the stand-up shot gets one too, or it is an unsignalled hit
    if ((this.state === 'aim' || this.state === 'punish') && ((frame >> 2) & 1)) {
      ctx.drawImage(s.spark[(frame >> 1) & 1],
        Math.round(this.hand.x) - 2, Math.round(this.hand.y) + 6);
    }
    // and the mark itself is drawn on the deck while the arm is down, so the
    // tile it is about to shoot is visible for the whole 108-frame stagger
    if (this.mark && (this.stagger > 0 || this.state === 'punish')) {
      // Corner ticks OUTSIDE a 16px sprite: the one moment the mark matters
      // most is the moment Wren is still standing on it, so it cannot be a
      // reticle he covers up.
      const mx = Math.round(this.mark.x), my = Math.round(this.mark.y);
      ctx.fillStyle = ((frame >> 3) & 1) ? '#f8d048' : '#c04818';
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = mx + sx * 10, cy = my + sy * 11;
        ctx.fillRect(cx - (sx > 0 ? 3 : 0), cy, 4, 1);
        ctx.fillRect(cx, cy - (sy > 0 ? 3 : 0), 1, 4);
      }
    }
    if (this.state === 'die') {
      for (let i = 0; i < 3; i++) {
        const a = this.dieT * 0.3 + i * 2.1;
        ctx.drawImage(s.spark[(this.dieT >> 2) & 1],
          Math.round(this.elbow.x + Math.cos(a) * (6 + this.dieT * 0.2)),
          Math.round(this.elbow.y + Math.sin(a) * (6 + this.dieT * 0.2)));
      }
    }
    for (const r of this.rivets) r.draw(ctx, s);
  }
}

// A solid brass tube from (ax,ay) to (bx,by): every step lays one
// perpendicular 8px run, so the limb keeps a dark outline, a bright top edge
// and a shaded underside at any angle. A brighter COLLAR band every 12px
// segments the tube, which is what makes it read as clockwork linkage rather
// than as a hose. Integer coordinates only — no rotation, no smoothing.
const BONE_RAMP = ['#1c120a', '#c09a30', '#e8c65c', '#c09a30', '#c09a30',
  '#7c6018', '#4a3810', '#1c120a'];
const COLLAR_RAMP = ['#1c120a', '#e8c65c', '#f4e08c', '#e8c65c', '#c09a30',
  '#c09a30', '#7c6018', '#1c120a'];
export function drawBone(ctx, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / d, uy = dy / d;
  const px = -uy, py = ux;                       // perpendicular
  const steps = Math.ceil(d * 2);      // half-pixel march: no diagonal gaps
  // pass 1: a solid outline body one pixel wider than the tube, so the dark
  // edge is continuous at every angle instead of dotting along the diagonal
  ctx.fillStyle = BONE_RAMP[0];
  for (let i = 0; i <= steps; i++) {
    const cx = ax + ux * i * 0.5, cy = ay + uy * i * 0.5;
    for (let o = -4.5; o <= 4.5; o += 0.5) {
      ctx.fillRect(Math.round(cx + px * o), Math.round(cy + py * o), 1, 1);
    }
  }
  // pass 2: the lit tube inside it, with a brass collar every 12 px
  for (let i = 0; i <= steps; i++) {
    const cx = ax + ux * i * 0.5, cy = ay + uy * i * 0.5;
    const collar = i > 8 && i < steps - 6 && (i % 24) < 4;
    const ramp = collar ? COLLAR_RAMP : BONE_RAMP;
    for (let j = 1; j < 7; j++) {
      const o = j - 3.5;
      ctx.fillStyle = ramp[j];
      ctx.fillRect(Math.round(cx + px * o), Math.round(cy + py * o), 1, 1);
    }
  }
}

const _tints = new Map();
function tintCache(img, color) {
  const key = img;
  let t = _tints.get(key);
  if (!t) { t = tint(img, color); _tints.set(key, t); }
  return t;
}

export class Rivet {
  constructor(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dead = false; this.life = 200;
  }
  hurtbox() { return { x: this.x, y: this.y, w: 6, h: 6 }; }
  update(map) {
    this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) this.dead = true;
    if (map && !map.boxFree(this.x + 1, this.y + 1, 4, 4)) this.dead = true;
  }
  draw(ctx, spr) { ctx.drawImage(spr.rivet, Math.round(this.x), Math.round(this.y)); }
}

// ===========================================================================
// Small shared FX
// ===========================================================================

/** ALttP-style expanding explosion ring used by the boss death. */
export class Blast {
  constructor(x, y, delay = 0) {
    this.x = x; this.y = y; this.t = -delay;
  }
  get done() { return this.t > 17; }
  update() { this.t++; }
  draw(ctx) {
    if (this.t < 0) return;
    const n = this.t;
    // ALttP's boss burst is a CLUSTER of small round pops, not one balloon:
    // ~14px across at its widest, white-hot for three frames, then gold, then
    // a dull copper ember before it goes.
    const r = 1.5 + n * 0.62;
    const cols = n < 4 ? ['#f8f8f8', '#f8d048'] : n < 10 ? ['#f8d048', '#f08828'] : ['#f08828', '#c04818'];
    ctx.fillStyle = cols[0];
    ctx.fillRect(Math.round(this.x - r), Math.round(this.y - r / 2), Math.round(r * 2), Math.round(r));
    ctx.fillRect(Math.round(this.x - r / 2), Math.round(this.y - r), Math.round(r), Math.round(r * 2));
    ctx.fillStyle = cols[1];
    const q = r * 0.7;
    ctx.fillRect(Math.round(this.x - q), Math.round(this.y - q / 2), Math.round(q * 2), Math.round(q));
    ctx.fillRect(Math.round(this.x - q / 2), Math.round(this.y - q), Math.round(q), Math.round(q * 2));
  }
}
