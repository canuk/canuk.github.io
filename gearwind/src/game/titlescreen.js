// Gearwind — TITLE SCREEN.
//
// Everything on this screen is pixel art. Nothing is drawn with ctx.fillText,
// ctx.arc or a CSS gradient. The three things that make a 1993 title screen
// read as a 1993 title screen are all here and all measured:
//
//  1. THE LOGO IS A CHISELLED PLATE, NOT A FONT. Each of the eight letters of
//     GEARWIND is authored as a 26-row mask (LETTERS below). The masks are
//     composited into one word grid and then run through shadeWord(), a bevel
//     pass that lights the plate from above: the first row of every stroke is
//     the cream specular, the second is pale brass, the last two are the
//     undercut, left edges catch light and right edges fall away, and the
//     interior runs a three-stop brass ramp top-to-bottom so the plate is gold
//     at the crown and bronze at the foot. Then a 1px near-black keyline all
//     the way round and a hard drop shadow offset (3,4). That is the whole
//     grammar of a SNES metal logo and it is why it does not read as text.
//
//  2. THE SKY IS ORDERED-DITHERED, NOT A GRADIENT. Seven stops, Bayer 4x4
//     between them (paintSky). A canvas linear-gradient would put 200+ colours
//     on screen and every 16x16 block would be flat; the Bayer weave keeps the
//     working palette at SNES size AND gives every terrain block the ~24%
//     non-base pixel coverage that tools/check-shot.py measures out of the
//     real ALttP screenshots.
//
//  3. IT MOVES IN LAYERS. Four cloud bands at 0.05 / 0.13 / 0.22 / 0.42 px per
//     frame, so over a two-second capture the deck at the bottom slides 50px
//     and the high haze slides 6. The windmill wheel turns one revolution per
//     eight seconds off sixteen pre-rendered sail frames (a four-sail wheel has
//     four-fold symmetry, so sixteen frames of a quarter turn IS a full turn).
//
// Exports: TitleScreen (the screen), FrontEnd (title -> intro -> onStart), and
// the pixel helpers intro.js reuses.
import { makeSprite } from '../sprites.js';
import {
  drawBox, drawDialogText, drawDialogTextCentered, dialogTextWidth,
} from './dialog.js';
import { HUD } from './hud.js';
import { Intro } from './intro.js';
import {
  titleSlots, listSlots, createSlot, eraseSlot, requestContinue, setActiveSlot,
  storeAvailable,
  SLOTS, NAME_MAX,
} from './save.js';

export const W = 256, H = 224;

// ---------------------------------------------------------------------------
// Small deterministic PRNG so the cloudscape is identical in every capture.
// ---------------------------------------------------------------------------
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function surface(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { cv, g };
}

// ---------------------------------------------------------------------------
// Ordered dither. This is the single most important routine on the screen:
// it is what lets a 224-row sky live inside a SNES palette.
// ---------------------------------------------------------------------------
export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Paint a vertically dithered sky. stops = [{y, c}] top to bottom. */
export function paintSky(g, w, h, stops) {
  for (let y = 0; y < h; y++) {
    let i = 0;
    while (i < stops.length - 2 && y >= stops[i + 1].y) i++;
    const a = stops[i], b = stops[i + 1];
    const t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
    const lvl = t * 16;
    for (let x = 0; x < w; x++) {
      g.fillStyle = lvl > BAYER[y & 3][x & 3] ? b.c : a.c;
      g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Cloud bands. A cloud is a run of overlapping half-ellipse lobes sharing one
// baseline; heights are quantised to 2px so the silhouette steps in chunks the
// way a hand-drawn SNES cumulus does instead of feathering into a curve.
// Shading is fixed-depth from the top: crown / light / body+sparse dither /
// shade / hard bottom edge.
// ---------------------------------------------------------------------------
export function makeCloudStrip(sw, sh, o) {
  const { cv, g } = surface(sw, sh);
  const R = rng(o.seed);
  const top = new Int16Array(sw).fill(32767);
  const bot = new Int16Array(sw).fill(-1);
  for (let i = 0; i < o.count; i++) {
    const cw = o.minW + Math.floor(R() * (o.maxW - o.minW));
    const cx = Math.floor(R() * sw);
    const base = o.baseY0 + Math.floor(R() * Math.max(1, o.baseY1 - o.baseY0));
    const lobes = 3 + Math.floor(R() * 3);
    for (let L = 0; L < lobes; L++) {
      const lw = Math.max(6, Math.floor(cw * (0.30 + R() * 0.45)));
      const lh = Math.max(3, Math.floor(o.hMin + R() * (o.hMax - o.hMin)));
      const lx = cx + Math.floor((L / Math.max(1, lobes - 1)) * (cw - lw));
      for (let dx = 0; dx < lw; dx++) {
        const u = (dx - (lw - 1) / 2) / (lw / 2);
        let hgt = Math.round(lh * Math.sqrt(Math.max(0, 1 - u * u)));
        hgt = 2 * Math.round(hgt / 2);
        if (hgt <= 0) continue;
        const X = (((lx + dx) % sw) + sw) % sw;
        if (base - hgt < top[X]) top[X] = base - hgt;
        if (base > bot[X]) bot[X] = base;
      }
    }
  }
  const p = o.pal;
  for (let x = 0; x < sw; x++) {
    const t = top[x], b = bot[x];
    if (b < 0) continue;
    for (let y = Math.max(0, t); y <= Math.min(sh - 1, b); y++) {
      const d = y - t, u = b - y;
      let col;
      if (d === 0) col = p.crown;
      else if (d <= 2) col = p.light;
      else if (u === 0) col = p.edge;
      else if (u <= 2) col = p.shade;
      else col = ((x + y) & 3) === 0 ? p.light : p.body;
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

// ---------------------------------------------------------------------------
// THE LOGO
//
// Eight authored masks, 26 rows tall, stroke weight 5. '#' is plate, '.' is
// air. G/E/A/R/I/N/D are 22 wide, W is 28 (a W that fits a 22 cell is a W with
// no counters left). These are drawn, not generated: the R's leg walks out one
// pixel every three rows, the G's spur bar hangs off the right stem at row 12,
// the A's apex is six pixels wide so the bevel has something to sit on.
// ---------------------------------------------------------------------------
const LETTERS = {
  G: [
    '.....############.....',
    '.....############.....',
    '...################...',
    '..##################..',
    '.#####..........#####.',
    '#####............#####',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####......###########',
    '#####......###########',
    '#####......###########',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####...........######',
    '.#####.........######.',
    '..##################..',
    '...################...',
    '...################...',
    '.....############.....',
  ],
  E: [
    '######################',
    '######################',
    '######################',
    '######################',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#################.....',
    '#################.....',
    '#################.....',
    '#################.....',
    '#################.....',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '#####.................',
    '######################',
    '######################',
    '######################',
    '######################',
  ],
  A: [
    '........######........',
    '.......########.......',
    '......##########......',
    '......##########......',
    '.....#####..#####.....',
    '.....#####..#####.....',
    '....#####....#####....',
    '....#####....#####....',
    '....#####....#####....',
    '...#####......#####...',
    '...#####......#####...',
    '...#####......#####...',
    '..#####........#####..',
    '..#####........#####..',
    '..##################..',
    '..##################..',
    '..##################..',
    '.#####..........#####.',
    '.#####..........#####.',
    '.#####..........#####.',
    '.#####..........#####.',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
  ],
  R: [
    '#################.....',
    '####################..',
    '#####################.',
    '#####...........######',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####...........######',
    '#####################.',
    '####################..',
    '##################....',
    '#####.......######....',
    '#####........######...',
    '#####........######...',
    '#####.........######..',
    '#####.........######..',
    '#####.........######..',
    '#####..........######.',
    '#####..........######.',
    '#####..........######.',
    '#####...........######',
    '#####...........######',
    '#####...........######',
  ],
  W: [
    '#####......######......#####',
    '#####......######......#####',
    '#####......######......#####',
    '#####......######......#####',
    '.#####.....######.....#####.',
    '.#####.....######.....#####.',
    '.#####....########....#####.',
    '.#####....########....#####.',
    '.#####....########....#####.',
    '.#####....########....#####.',
    '..#####...########...#####..',
    '..#####...########...#####..',
    '..#####..##########..#####..',
    '..#####..##########..#####..',
    '..#####..##########..#####..',
    '..#####..##########..#####..',
    '...#####.##########.#####...',
    '...##########..##########...',
    '...##########..##########...',
    '...##########..##########...',
    '...##########..##########...',
    '...##########..##########...',
    '....#########..#########....',
    '....########....########....',
    '....########....########....',
    '.....######......######.....',
  ],
  I: [
    '##############',
    '##############',
    '##############',
    '##############',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '....######....',
    '##############',
    '##############',
    '##############',
    '##############',
  ],
  N: [
    '######...........#####',
    '#######..........#####',
    '#######..........#####',
    '########.........#####',
    '########.........#####',
    '#########........#####',
    '##########.......#####',
    '##########.......#####',
    '#####.#####......#####',
    '#####.#####......#####',
    '#####..#####.....#####',
    '#####...#####....#####',
    '#####...#####....#####',
    '#####....#####...#####',
    '#####....#####...#####',
    '#####.....#####..#####',
    '#####......#####.#####',
    '#####......#####.#####',
    '#####.......##########',
    '#####.......##########',
    '#####........#########',
    '#####.........########',
    '#####.........########',
    '#####..........#######',
    '#####..........#######',
    '#####...........######',
  ],
  D: [
    '#################.....',
    '###################...',
    '####################..',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '#####............#####',
    '####################..',
    '###################...',
    '#################.....',
  ],
};

// Rivets: 2x2 domed studs punched through the plate, two per stem. Local to
// each letter mask; skipped automatically if they land off the plate.
const RIVETS = {
  G: [[2, 7], [2, 17]],
  E: [[1, 6], [1, 18], [16, 1]],
  A: [[2, 21], [16, 21], [9, 14]],
  R: [[1, 6], [1, 18], [15, 21]],
  W: [[1, 6], [23, 6], [11, 2]],
  I: [[4, 9], [4, 18], [1, 1]],
  N: [[1, 6], [17, 19]],
  D: [[1, 6], [1, 18], [16, 12]],
};

// Brass ramp for the plate. Nine values: specular, pale, three body stops,
// two undercut stops, keyline, cast shadow.
const P = {
  HI: '#fff0c0',
  L1: '#f0d47c',
  M0: '#dfae44',
  M1: '#c2902e',
  M2: '#9c7020',
  S1: '#6f4c14',
  S2: '#4a300c',
  OUT: '#1a1208',
  SH: '#1a1208',   // deliberately the keyline value: a separate near-black
                    // for the cast shadow cost a working-palette slot and read
                    // identically at 3x.
};

const WORD = 'GEARWIND';
const KERN = 2;

function buildWordGrid() {
  let w = 0;
  const offs = [];
  for (const ch of WORD) {
    offs.push(w);
    w += Math.max(...LETTERS[ch].map(r => r.length)) + KERN;
  }
  w -= KERN;
  const h = 26;
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(new Uint8Array(w));
  const rivets = [];
  WORD.split('').forEach((ch, i) => {
    const rows = LETTERS[ch];
    for (let y = 0; y < h; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < row.length; x++) if (row[x] === '#') grid[y][offs[i] + x] = 1;
    }
    for (const [rx, ry] of (RIVETS[ch] || [])) rivets.push([offs[i] + rx, ry]);
  });
  return { grid, w, h, rivets };
}

/**
 * Bevel + keyline + drop shadow. Light comes from above and slightly left.
 *   row 0 of a stroke      -> cream specular
 *   row 1                  -> pale brass
 *   last row of a stroke   -> deep undercut
 *   second-to-last         -> undercut
 *   left edge / right edge -> pale / undercut
 *   interior               -> 3-stop vertical brass ramp
 */
function shadeWord({ grid, w, h, rivets }) {
  const PAD = 1, SHX = 3, SHY = 4;
  const { cv, g } = surface(w + PAD * 2 + SHX, h + PAD * 2 + SHY);
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const ink = (x, y) => x >= 0 && y >= 0 && x < w && y < h && grid[y][x] === 1;
  const dil = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ink(x + dx, y + dy)) return true;
    return false;
  };
  // cast shadow (the keyline silhouette, offset)
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (dil(x, y)) px(x + PAD + SHX, y + PAD + SHY, P.SH);
  }
  // keyline
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    if (!ink(x, y) && dil(x, y)) px(x + PAD, y + PAD, P.OUT);
  }
  // face
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink(x, y)) continue;
    let up = 0; while (ink(x, y - 1 - up)) up++;
    let dn = 0; while (ink(x, y + 1 + dn)) dn++;
    let col;
    if (up === 0) col = P.HI;
    else if (up === 1) col = P.L1;
    else if (dn === 0) col = P.S2;
    else if (dn === 1) col = P.S1;
    else if (!ink(x - 1, y)) col = P.L1;
    else if (!ink(x + 1, y)) col = P.S1;
    else if (y < h * 0.30) col = P.M0;
    else if (y < h * 0.64) col = P.M1;
    else col = P.M2;
    px(x + PAD, y + PAD, col);
  }
  // rivets
  for (const [rx, ry] of rivets) {
    if (!ink(rx, ry) || !ink(rx + 1, ry + 1)) continue;
    px(rx + PAD, ry + PAD, P.HI);
    px(rx + 1 + PAD, ry + PAD, P.M0);
    px(rx + PAD, ry + 1 + PAD, P.M2);
    px(rx + 1 + PAD, ry + 1 + PAD, P.S2);
  }
  return cv;
}

// ---------------------------------------------------------------------------
// SUBTITLE FACE — a second, smaller authored face for "Isles of the Sky".
// Cap height 11, x-height 8, 2px stems, one descender. It is deliberately a
// different letterform from the logo (round bowls, no bevel) so the lockup has
// a display face and a text face instead of one face at two sizes.
// ---------------------------------------------------------------------------
const SUB = {
  'I': ['#######', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '..###..', '#######'],
  's': ['.......', '.......', '.......', '.#####.', '##...##', '##.....', '.####..', '...###.', '.....##', '##...##', '.#####.'],
  'l': ['###.', '###.', '###.', '###.', '###.', '###.', '###.', '###.', '###.', '###.', '####'],
  'e': ['........', '........', '........', '..####..', '.##..##.', '##....##', '########', '##......', '##....##', '.##..##.', '..####..'],
  'o': ['........', '........', '........', '..####..', '.##..##.', '##....##', '##....##', '##....##', '##....##', '.##..##.', '..####..'],
  'f': ['..####', '.##..#', '.##...', '######', '.##...', '.##...', '.##...', '.##...', '.##...', '.##...', '.##...'],
  't': ['......', '.##...', '.##...', '######', '.##...', '.##...', '.##...', '.##...', '.##...', '.##..#', '..####'],
  'h': ['##.....', '##.....', '##.....', '##.###.', '###..##', '##...##', '##...##', '##...##', '##...##', '##...##', '##...##'],
  'S': ['..#####..', '.##...##.', '##.....##', '##.......', '.###.....', '..#####..', '.....###.', '.......##', '##.....##', '.##...##.', '..#####..'],
  'k': ['##......', '##......', '##......', '##...##.', '##..##..', '##.##...', '####....', '##.##...', '##..##..', '##...##.', '##....##'],
  'y': ['........', '........', '........', '##....##', '##....##', '##....##', '.##..##.', '..#####.', '....##..', '....##..', '##..##..', '.####...'],
  ' ': [''],
};
const SUB_W = {};
for (const [ch, rows] of Object.entries(SUB)) SUB_W[ch] = ch === ' ' ? 4 : Math.max(...rows.map(r => r.length));

function subWidth(text) {
  let w = 0;
  for (const ch of text) w += (SUB_W[ch] || 4) + 1;
  return w - 1;
}

/** Draw the subtitle face as a raised plate: keyline, ink, 1px undershade. */
function makeSubtitle(text) {
  const tw = subWidth(text);
  const th = 12;
  const { cv, g } = surface(tw + 2, th + 3);
  const mask = [];
  for (let y = 0; y < th + 1; y++) mask.push(new Uint8Array(tw));
  let cx = 0;
  for (const ch of text) {
    const rows = SUB[ch] || [''];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '#') mask[y][cx + x] = 1;
    }
    cx += (SUB_W[ch] || 4) + 1;
  }
  const ink = (x, y) => x >= 0 && y >= 0 && x < tw && y < mask.length && mask[y][x] === 1;
  const dil = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ink(x + dx, y + dy)) return true;
    return false;
  };
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  for (let y = -1; y <= mask.length; y++) for (let x = -1; x <= tw; x++) {
    if (!ink(x, y) && dil(x, y)) px(x + 1, y + 1, P.OUT);
  }
  for (let y = 0; y < mask.length; y++) for (let x = 0; x < tw; x++) {
    if (!ink(x, y)) continue;
    px(x + 1, y + 1, ink(x, y + 1) ? (y < 4 ? P.HI : '#f4e6c4') : P.M1);
  }
  return cv;
}

// ---------------------------------------------------------------------------
// PRESS START — a third face: 9 rows, 2px stems, blocky, all caps.
//
// SIX GLYPHS AND A SPACE, which is exactly the one thing this screen says.
//
// It briefly carried eight more (CONTINUE / NEW GAME), from the round where the
// save file was announced on the title screen itself because it had nowhere
// else to go. It has somewhere else now — the FILE SELECT below — and that
// screen is set in the DIALOGUE face, not in this one, for a reason worth
// writing down: the file select lives inside dialog.js's window, and a panel
// with the chapter's border ramp round it and the title screen's display face
// inside it is two grammars in one box. The chapter has one window and one text
// face; a menu that lives in a window uses them. This face is for the one line
// that stands directly on the cloud deck with nothing around it.
// ---------------------------------------------------------------------------
const BIG = {
  P: ['#######..', '##....##.', '##....##.', '##....##.', '#######..', '##.......', '##.......', '##.......', '##.......'],
  R: ['#######..', '##....##.', '##....##.', '##....##.', '#######..', '##..##...', '##...##..', '##....##.', '##....###'],
  E: ['########.', '##.......', '##.......', '##.......', '######...', '##.......', '##.......', '##.......', '########.'],
  S: ['.######..', '##....##.', '##.......', '###......', '..####...', '.....###.', '.......##', '##....##.', '.######..'],
  T: ['#########', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...'],
  A: ['..#####..', '.##...##.', '##.....##', '##.....##', '#########', '##.....##', '##.....##', '##.....##', '##.....##'],
  ' ': [''],
};
const BIG_W = {};
for (const [ch, rows] of Object.entries(BIG)) {
  BIG_W[ch] = ch === ' ' ? 5 : Math.max(...rows.map(r => r.replace(/\.+$/, '').length));
}

function makeBigCaps(text, fill, edge) {
  let tw = 0;
  for (const ch of text) tw += BIG_W[ch] + 2;
  tw -= 2;
  const th = 9;
  const { cv, g } = surface(tw + 2, th + 3);
  const mask = [];
  for (let y = 0; y < th; y++) mask.push(new Uint8Array(tw));
  let cx = 0;
  for (const ch of text) {
    const rows = BIG[ch] || [''];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) if (rows[y][x] === '#') mask[y][cx + x] = 1;
    }
    cx += BIG_W[ch] + 2;
  }
  const ink = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && mask[y][x] === 1;
  const dil = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ink(x + dx, y + dy)) return true;
    return false;
  };
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  // hard cast shadow one row down so the words sit off the cloud deck
  for (let y = -1; y <= th; y++) for (let x = -1; x <= tw; x++) if (dil(x, y)) px(x + 1, y + 3, '#151b2c');
  for (let y = -1; y <= th; y++) for (let x = -1; x <= tw; x++) if (!ink(x, y) && dil(x, y)) px(x + 1, y + 1, edge);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    if (ink(x, y)) px(x + 1, y + 1, ink(x, y + 1) ? fill : '#c8b070');
  }
  return cv;
}

// ---------------------------------------------------------------------------
// Brass hardware: a rule under the wordmark with a gear cap at each end.
// ---------------------------------------------------------------------------
const GEAR = makeSprite([
  '...kkk...',
  '..kBBAk..',
  'kkkBBAkkk',
  'kBBBBBAAk',
  'kBBmkmAAk',
  'kBBmmmAAk',
  'kkkAAAkkk',
  '..kAAAk..',
  '...kkk...',
], { k: '#1a1208', B: '#f0d47c', A: '#c2902e', m: '#6f4c14' });

function makeRule(len) {
  const { cv, g } = surface(len, 6);
  const bands = ['#1a1208', '#f0d47c', '#c2902e', '#9c7020', '#4a300c', '#101828'];
  for (let y = 0; y < 6; y++) { g.fillStyle = bands[y]; g.fillRect(0, y, len, 1); }
  // rivet run along the rule
  for (let x = 6; x < len - 6; x += 12) {
    g.fillStyle = P.HI; g.fillRect(x, 1, 1, 1);
    g.fillStyle = P.S1; g.fillRect(x + 1, 2, 1, 1);
  }
  // tapered ends
  g.clearRect(0, 0, 2, 1); g.clearRect(len - 2, 0, 2, 1);
  g.clearRect(0, 5, 2, 1); g.clearRect(len - 2, 5, 2, 1);
  return cv;
}

// ---------------------------------------------------------------------------
// WINDMILL. Four sails on a brass hub. Sixteen pre-rendered frames covering a
// quarter turn — which for a four-fold-symmetric wheel is a whole revolution.
// Each sail is a tapered lattice: near-black frame, brass spar edges, a slat
// every third pixel, canvas between.
// ---------------------------------------------------------------------------
function makeSail(size, r, ang) {
  const { cv, g } = surface(size, size);
  const c = (size - 1) / 2;
  const px = (x, y, col) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  };
  const OUTL = '#18110a', FRAME = '#c2902e', SLAT = '#6f4c14';
  // Two cloth values, picked per blade by which way the blade faces. A wheel
  // whose four sails are all one value is a flat asterisk; giving the blades
  // that point down-and-right the shaded canvas is what makes it a wheel.
  const CLOTH_L = '#e2d2a8', CLOTH_D = '#9c8757';
  for (let s = 0; s < 4; s++) {
    const th = ang + s * Math.PI / 2;
    const dx = Math.cos(th), dy = Math.sin(th);
    const nx = -dy, ny = dx;
    const cloth = (dx + dy > 0.1) ? CLOTH_D : CLOTH_L;
    for (let t = 3; t <= r; t += 0.5) {
      const halfw = Math.max(1, Math.round(3.4 * (1 - t / (r * 1.9))));
      for (let u = -halfw - 1; u <= halfw + 1; u++) {
        const X = c + dx * t + nx * u, Y = c + dy * t + ny * u;
        let col;
        if (Math.abs(u) > halfw) col = OUTL;
        else if (Math.abs(u) === halfw) col = FRAME;
        else if (Math.round(t) % 3 === 0) col = SLAT;
        else col = cloth;
        px(X, Y, col);
      }
    }
  }
  // hub
  const hub = [
    '..kkk..',
    '.kBBAk.',
    'kBBAAAk',
    'kBAkAAk',
    'kBAAAAk',
    '.kAAmk.',
    '..kkk..',
  ];
  const hp = { k: '#1a1208', B: '#f0d47c', A: '#c2902e', m: '#6f4c14' };
  for (let y = 0; y < hub.length; y++) for (let x = 0; x < hub[y].length; x++) {
    const ch = hub[y][x];
    if (ch === '.') continue;
    px(c - 3 + x, c - 3 + y, hp[ch]);
  }
  return cv;
}

// ---------------------------------------------------------------------------
// Floating island. Grass lid, near-black rim, then a rock cone whose profile
// steps in 3-row chunks (an ALttP cliff never has a smooth edge) and whose
// interior carries horizontal courses.
// ---------------------------------------------------------------------------
export function paintIsland(g, o) {
  const R = rng(o.seed);
  const { cx, lidY, halfW, depth } = o;
  const pal = o.pal;
  const jitL = [], jitR = [];
  let jl = 0, jr = 0;
  for (let d = 0; d <= depth; d++) {
    if (d % 3 === 0) { jl = Math.round((R() * 2 - 1) * o.jitter); jr = Math.round((R() * 2 - 1) * o.jitter); }
    jitL[d] = jl; jitR[d] = jr;
  }
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  // Profile. t^1.5 rather than t^2: a squared falloff holds the island almost
  // full width for the first third and then drops, which reads as a flat-
  // bottomed hull. The 1.5 exponent pulls in from the rim immediately and
  // finishes on a point. Widths snap to 2px so the silhouette steps in chunks
  // like an ALttP cliff instead of describing a smooth curve.
  const halfAt = (d) => {
    const t = d / depth;
    return Math.max(1, 2 * Math.round(halfW * (1 - Math.pow(t, 1.5) * 0.97) / 2));
  };
  // rock body
  for (let d = 0; d <= depth; d++) {
    const y = lidY + d;
    const hw = halfAt(d);
    const x0 = cx - hw + jitL[d], x1 = cx + hw + jitR[d];
    for (let x = x0; x <= x1; x++) {
      // Courses, built the way tileset.js measured them off the real ALttP
      // cliff face: a 1px sunlit lip, a shelf, the body, then the shadow the
      // next course down sits in. Period 8. Sun from the upper left, so the
      // left two columns catch the lip colour and the right three fall into
      // the undercut.
      let col;
      const fromL = x - x0, fromR = x1 - x;
      const band = d % 8;
      if (d === depth || fromL === 0 || fromR === 0) col = pal.out;
      else if (fromR <= 2) col = pal.deep;
      else if (fromL <= 1) col = pal.hi;
      else if (band === 0) col = pal.hi;
      else if (band <= 3) col = pal.lit;
      else if (band <= 6) col = pal.mid;
      else col = pal.low;
      px(x, y, col);
    }
  }
  // hanging hardware: chains and a drip-pipe under the rim
  if (o.chains) {
    for (const [hx, hlen] of [[cx - halfW * 0.55, 14], [cx + halfW * 0.3, 19], [cx + halfW * 0.7, 10]]) {
      const X = Math.round(hx);
      const start = lidY + Math.round(depth * 0.45);
      for (let y = start; y < start + hlen; y++) px(X, y, y % 3 === 0 ? pal.out : pal.deep);
    }
  }
  if (!pal.grass) return;
  // The grass lid. It is a BAND, not a dome: a constant 3-row skin of turf all
  // the way to the tips plus a shallow crown in the middle, overhanging the
  // rock by 2px so the island has a lip and a shadow under it the way an ALttP
  // cliff does, and capped top and bottom by the world's dark outline.
  const lidHalf = halfW + 2;
  const SKIN = 3;
  for (let x = cx - lidHalf; x <= cx + lidHalf; x++) {
    const u = (x - cx) / lidHalf;
    const crown = Math.round(4 * Math.sqrt(Math.max(0, 1 - u * u)));
    const top = lidY - SKIN - crown;
    for (let y = top; y < lidY; y++) {
      const d = y - top;
      let col = d === 0 ? pal.grassHi : pal.grass;
      // ALttP grass is textured, never flat: sparse lighter tufts on a weave
      if (d > 0 && ((x * 5 + y * 3) & 7) === 0) col = pal.grassHi;
      else if (d > 1 && ((x * 3 + y * 7) & 5) === 0) col = pal.grassDk || pal.grass;
      px(x, y, col);
    }
    px(x, top - 1, pal.out);
    px(x, lidY, pal.out);
    px(x, lidY + 1, pal.deep);
  }
}

// ---------------------------------------------------------------------------
// TitleScreen
// ---------------------------------------------------------------------------
// Stays BLUE all the way down. An earlier pass warmed the bottom stops toward
// sand and the whole lower half read as a beach instead of a cloud sea.
// Six stops, not seven: each stop that is on screen for long enough costs a
// slot in the >=0.5% working palette that check-shot.py counts, and ALttP
// screens run 14-22.
const SKY_STOPS = [
  { y: 0, c: '#141f4a' },
  { y: 38, c: '#21386f' },
  { y: 80, c: '#2f5b96' },
  { y: 124, c: '#4179b4' },
  { y: 172, c: '#5f9acc' },
  { y: 224, c: '#8ab6da' },
];

// ONE aerial-perspective ramp shared by all four cloud bands. Each band takes
// a different five-stop window of it, so distance is expressed as a slide down
// a single ramp instead of four private palettes — which is both how a SNES
// artist would have to do it and what keeps the working palette in range.
export const CLOUD = [
  '#ffffff', '#e4eef6', '#c6d9ea', '#a6c0da',
  '#87a6c6', '#6b8cb0', '#54749a', '#3f5c82',
];
export const cloudPal = (i) => ({
  crown: CLOUD[i], light: CLOUD[i + 1], body: CLOUD[i + 2],
  shade: CLOUD[i + 3], edge: CLOUD[Math.min(7, i + 4)],
});

const STRIP_W = 384;

// PRESS START sits at 156, on its own, exactly where the critic passed it.
//
// It used to share that band with a CONTINUE / NEW GAME pair, because the save
// file had nowhere else to be announced. It has somewhere else now — a real
// FILE SELECT screen, below — so the title screen is back to the one thing a
// 1993 title screen says, and the front end is the shape A Link to the Past's
// actually was: title, then files, then names.
const PRESS_Y = 156;

export class TitleScreen {
  constructor() {
    this.frame = 0;
    this.build();
  }

  build() {
    // --- static backdrop: sky + far islands ---------------------------------
    const back = surface(W, H);
    paintSky(back.g, W, H, SKY_STOPS);
    // two far isles, near-silhouette, sitting high and small
    const FARPAL = {
      out: '#1c2c52', lit: '#42598a', deep: '#1e2c4c', hi: '#42598a', mid: '#2d4066', low: '#243354',
      grass: '#2d5a52', grassHi: '#42806e', grassDk: '#243354',
    };
    paintIsland(back.g, { cx: 204, lidY: 98, halfW: 16, depth: 14, jitter: 1, seed: 71, pal: FARPAL });
    paintIsland(back.g, { cx: 236, lidY: 76, halfW: 10, depth: 9, jitter: 1, seed: 12, pal: FARPAL });
    this.back = back.cv;

    // --- cloud bands. Counts kept low on purpose: a band that spans the whole
    // 256 with no sky showing through stops reading as clouds and starts
    // reading as a floor. ---------------------------------------------------
    this.haze = makeCloudStrip(STRIP_W, 34, {
      seed: 3, count: 4, minW: 70, maxW: 130, hMin: 4, hMax: 8,
      baseY0: 18, baseY1: 30, pal: cloudPal(4),
    });
    this.far = makeCloudStrip(STRIP_W, 40, {
      seed: 9, count: 5, minW: 60, maxW: 120, hMin: 6, hMax: 13,
      baseY0: 22, baseY1: 36, pal: cloudPal(2),
    });
    this.mid = makeCloudStrip(STRIP_W, 44, {
      seed: 23, count: 5, minW: 70, maxW: 140, hMin: 9, hMax: 17,
      baseY0: 28, baseY1: 42, pal: cloudPal(1),
    });
    this.deck = makeCloudStrip(STRIP_W, 46, {
      seed: 44, count: 8, minW: 70, maxW: 150, hMin: 11, hMax: 20,
      baseY0: 36, baseY1: 45, pal: cloudPal(0),
    });

    // --- main island + windmill ---------------------------------------------
    const isle = surface(W, H);
    paintIsland(isle.g, {
      cx: 44, lidY: 174, halfW: 42, depth: 32, jitter: 3, seed: 5, chains: true,
      pal: {
        // `out` deliberately reuses the logo's keyline value: two
        // indistinguishable near-blacks cost a working-palette slot for
        // nothing, which is the same call tileset.js makes for its path edge.
        out: '#1a1208', lit: '#7d6538', deep: '#241a10',
        hi: '#a08a52', mid: '#5a4327', low: '#3a2a18',
        grass: '#307030', grassHi: '#489848', grassDk: '#256026',
      },
    });
    this.isle = isle.cv;

    this.sailR = 22;
    this.sails = [];
    for (let i = 0; i < 16; i++) this.sails.push(makeSail(this.sailR * 2 + 9, this.sailR, (i / 16) * Math.PI / 2));
    this.mill = this.makeMillTower();

    // --- lockup -------------------------------------------------------------
    this.logo = shadeWord(buildWordGrid());
    this.sub = makeSubtitle('Isles of the Sky');
    this.rule = makeRule(this.logo.width - 30);
    this.press = makeBigCaps('PRESS START', '#f8f8f8', '#1a1208');

    this.logoX = Math.round((W - this.logo.width) / 2);
    this.logoY = 14;
    this.ruleY = this.logoY + 32;
    this.subY = this.ruleY + 10;

    // A courier skiff crossing the middle distance. The right half of the
    // screen was otherwise 90 rows of nothing but cloud.
    this.skiff = makeSprite([
      '........kkkkkkkkkkkk........',
      '....kkkkWWWWWWWWWWWWkkkk....',
      '..kkWWWWWWWWWWWWWWWWWWWWkk..',
      '.kWWWWwwwwwwwwwwwwwwwwWWWWk.',
      'kWWwwwwwwwwwwwwwwwwwwwwwwWWk',
      'kwwvvvvvvvvvvvvvvvvvvvvvvwwk',
      '.kvvvvvvvvvvvvvvvvvvvvvvvvk.',
      '..kkvvvvvvvvvvvvvvvvvvvvkk..',
      '....kkkkvvvvvvvvvvvvkkkk....',
      '........kkkkkkkkkkkk........',
      '..........kbbbbbbk..........',
      '..........kbBBBBbk..........',
      '..........kkkkkkkk..........',
    ], { k: '#1a1208', W: '#c6d9ea', w: '#87a6c6', v: '#54749a', b: '#9c7020', B: '#dfae44' });
    this.skiffX = 168;

    // gulls: three specks that cross the sky on long loops
    this.gulls = [
      { x: 60, y: 118, sp: 0.20 },
      { x: 150, y: 104, sp: 0.15 },
      { x: 210, y: 132, sp: 0.26 },
    ];
  }

  makeMillTower() {
    const HGT = 44;
    const { cv, g } = surface(28, HGT);
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    // Stone courses with brass banding — the tower has to be DARKER than the
    // sail cloth or the whole mill flattens into one tan blob.
    const pal = { k: '#18110a', d: '#33291a', m: '#4c3d26', l: '#6c5836', s: '#8b7448', b: '#b98c48' };
    for (let y = 0; y < HGT; y++) {
      const hw = 4 + Math.round(y * 0.14);
      for (let x = -hw; x <= hw; x++) {
        const X = 14 + x;
        let col;
        if (x === -hw || x === hw) col = pal.k;
        else if (x <= -hw + 1) col = pal.s;
        else if (x >= hw - 1) col = pal.d;
        else col = (((x + y * 2) & 5) === 0) ? pal.m : pal.l;
        px(X, y, col);
      }
      // a course line every 6 rows, brass-banded every 18
      if (y % 6 === 0) for (let x = -hw + 1; x < hw; x++) px(14 + x, y, y % 18 === 0 ? pal.b : pal.d);
    }
    // door and window, both blacked out
    for (let y = 32; y < HGT; y++) for (let x = 11; x <= 16; x++) px(x, y, y === 32 || x === 11 || x === 16 ? pal.k : '#0f0b06');
    for (let y = 17; y < 23; y++) for (let x = 12; x <= 15; x++) px(x, y, y === 17 || x === 12 || x === 15 ? pal.k : '#0f0b06');
    return cv;
  }

  update(dt, engine) {
    this.frame++;
    for (const gu of this.gulls) { gu.x += gu.sp; if (gu.x > W + 8) gu.x = -8; }
    this.skiffX -= 0.09;
    if (this.skiffX < -30) this.skiffX = W + 4;
  }

  drawStrip(ctx, img, y, speed) {
    const off = Math.round((this.frame * speed) % STRIP_W);
    ctx.drawImage(img, -off, y);
    ctx.drawImage(img, STRIP_W - off, y);
    if (STRIP_W - off > W) return;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {boolean} [showPress] false while a menu panel stands over the
   *   screen — the file select and name entry keep the whole backdrop alive
   *   behind them (the clouds keep drifting, the mill keeps turning) but a
   *   blinking PRESS START under an opaque panel is a sprite nobody sees.
   */
  draw(ctx, showPress = true) {
    ctx.drawImage(this.back, 0, 0);
    this.drawStrip(ctx, this.haze, 52, 0.05);
    this.drawStrip(ctx, this.far, 92, 0.13);
    ctx.drawImage(this.skiff, Math.round(this.skiffX),
      100 + Math.round(Math.sin(this.frame / 90) * 2));
    this.drawStrip(ctx, this.mid, 126, 0.22);

    // island + windmill
    ctx.drawImage(this.isle, 0, 0);
    ctx.drawImage(this.mill, 30, 130);
    const f = this.sails[Math.floor(this.frame / 30) % 16];
    ctx.drawImage(f, 44 - ((f.width - 1) >> 1), 126 - ((f.height - 1) >> 1));

    // gulls (2px chevrons)
    ctx.fillStyle = '#243a5e';
    for (const gu of this.gulls) {
      const x = Math.round(gu.x), y = Math.round(gu.y + Math.sin((this.frame + gu.x) / 40) * 2);
      const flap = (Math.floor(this.frame / 14) + Math.floor(gu.x)) & 1;
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x - 2, y + (flap ? -1 : 1), 2, 1);
      ctx.fillRect(x + 1, y + (flap ? -1 : 1), 2, 1);
    }

    // foreground cloud deck
    this.drawStrip(ctx, this.deck, 192, 0.42);

    // lockup
    ctx.drawImage(this.logo, this.logoX, this.logoY);
    const rx = Math.round((W - this.rule.width) / 2);
    ctx.drawImage(this.rule, rx, this.ruleY);
    ctx.drawImage(GEAR, rx - 11, this.ruleY - 2);
    ctx.drawImage(GEAR, rx + this.rule.width + 2, this.ruleY - 2);
    ctx.drawImage(this.sub, Math.round((W - this.sub.width) / 2), this.subY);

    // PRESS START at ~1Hz: 36 frames lit, 24 dark
    if (showPress && this.frame % 60 < 36) {
      ctx.drawImage(this.press, Math.round((W - this.press.width) / 2), PRESS_Y);
    }
    drawDialogTextCentered(ctx, '1993 SKYFORGE', W / 2, 208, '#3f5c82', '#e4eef6');
  }
}

// ---------------------------------------------------------------------------
// THE FRAME LANGUAGE THE TWO MENU SCREENS ARE MADE OF
//
// Nothing here is new. `drawBox` is dialog.js's own window — the 1px #1e1a22
// keyline, two rows of #f8f8f8, a #6878a0 slate bevel and a black well, with
// r=3 staircase corners — which is the ramp every panel in this chapter has
// been measured against. INK and DIM are the two ink values the subscreen and
// the SAVE panel already use for "the cursor is on this" and "it is not".
// The heart row is the HUD's own three sprites, taken off a HUD instance rather
// than re-authored, because those seven rows are a byte-for-byte transcription
// of the real thing and there must only ever be one copy of them.
// The text is the dialogue face, which is the only face in the build with
// lowercase — and NAME ENTRY has to offer lowercase.
// ---------------------------------------------------------------------------
const INK = '#f8f8f8';
const DIM = '#6878a0';
const KEYLINE = '#1e1a22';
const WARN = '#d9482b';

let _hudSprites = null;
/** The HUD's own heart sprites. Built once, never a second heart. */
function heartSprites() {
  if (!_hudSprites) _hudSprites = new HUD().sprites;
  return _hudSprites;
}

/**
 * THE STATUS READOUT. In A Link to the Past a file's whole summary is its
 * name and its heart row, so that is what a row draws: `maxHearts` containers,
 * 7px sprites on the HUD's own 8px pitch, filled from `halves`.
 */
function drawHeartRow(ctx, x, y, maxHearts, halves) {
  const s = heartSprites();
  const n = Math.max(1, Math.min(20, maxHearts | 0));
  for (let i = 0; i < n; i++) {
    const rem = (halves | 0) - i * 2;
    ctx.drawImage(rem >= 2 ? s.full : rem === 1 ? s.half : s.empty, x + i * 8, y);
  }
  return n * 8;
}

/**
 * The list cursor: a solid 4x7 chevron on a keyline pad — the same shape and
 * the same two colours the SAVE panel points with, so the chapter has one
 * pointer. It is reproduced here rather than imported because gameflow.js is
 * the chapter's flow machinery (music, bestiary, the Boilerworks' furniture)
 * and the front door must not have to load all of that to draw six pixels.
 */
function drawChevron(ctx, x, y) {
  ctx.fillStyle = KEYLINE;
  ctx.fillRect(x - 1, y - 1, 6, 9);
  ctx.fillStyle = INK;
  for (let r = 0; r < 7; r++) ctx.fillRect(x, y + r, r <= 3 ? r + 1 : 7 - r, 1);
}

/** One sound, through the chapter's one mixer. Never fatal, safe headless. */
function beep(name) {
  try {
    if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  } catch (e) { /* no audio in a capture */ }
}

/**
 * D-PAD AUTO-REPEAT.
 *
 * `Input` only reports edges, and a 70-cell character grid navigated one press
 * per cell is a name-entry screen nobody finishes. This gives the four
 * directions the console behaviour: fire on the press, then after a 22-frame
 * hold fire again every 5 frames. Each screen owns one, so leaving a held key
 * on one screen cannot auto-repeat into the screen that replaces it.
 */
class Repeater {
  constructor() { this.key = null; this.t = 0; }
  /** @returns {string|null} a direction to apply this frame */
  read(input) {
    const dirs = ['up', 'down', 'left', 'right'];
    for (const d of dirs) {
      if (input.hit(d)) { this.key = d; this.t = 0; return d; }
    }
    if (this.key && input.held(this.key)) {
      this.t++;
      if (this.t >= 22 && (this.t - 22) % 5 === 0) return this.key;
      return null;
    }
    this.key = null; this.t = 0;
    return null;
  }
}

// ---------------------------------------------------------------------------
// FILE SELECT
//
// Two rows and an ERASE. ALttP's own file select is a list of files showing
// each one's NAME and HEART ROW with a cursor you move up and down, and a strip
// of secondary options along the bottom (copy / erase). Two slots is what was
// asked for, and ERASE is the one secondary option that is not optional: a
// player who fills both files with no way to clear one has a game he cannot
// start again.
//
// GEOMETRY, measured against what is behind it. The panel is 216 wide (the
// subscreen's own width) and runs y 52..202, which starts below the chiselled
// GEARWIND logo (it ends at y=46) and stops above the 1993 SKYFORGE credit at
// y=208. So the title art a critic passed is not covered up — the clouds keep
// drifting, the mill keeps turning and the logo keeps sitting on top of the
// menu, which is what makes this read as the same screen rather than a
// different program.
// ---------------------------------------------------------------------------
const FS = { x: 20, y: 52, w: 216, h: 150 };
const FS_ROW = [84, 122];          // top of each file row (label; name is +12)
const FS_LABEL_X = FS.x + 24;      // 44
const FS_HEART_X = 150;            // 59px clear of a full six-glyph name
const FS_ERASE_Y = 160;
const FS_RULES = [74, 112, 150];
const FS_FOOT_Y = 182;
const ERASE_BOX = { x: 56, y: 88, w: 144, h: 68 };

export class FileSelect {
  /**
   * @param {Array} rows listSlots() output — one entry per slot, null = empty
   * @param {object} [opts] { onPlay(slot,row), onNew(slot), onBack() }
   */
  constructor(rows, opts = {}) {
    this.rows = rows || listSlots();
    this.onPlay = opts.onPlay || (() => {});
    this.onNew = opts.onNew || (() => {});
    this.onBack = opts.onBack || (() => {});
    /** 0..SLOTS-1 = a file row, SLOTS = ERASE. */
    this.sel = 0;
    /** 'pick' | 'erase' | 'confirm' */
    this.mode = 'pick';
    /** In 'confirm': 0 = NO (the safe default), 1 = YES. */
    this.yes = 0;
    this.t = 0;
    this.rep = new Repeater();
  }

  refresh() { this.rows = listSlots(); return this.rows; }

  /** True if any slot holds a file that can actually be loaded. */
  get hasFile() { return this.rows.some((r) => r && r.playable); }
  get anyFile() { return this.rows.some((r) => !!r); }

  get maxSel() { return this.mode === 'pick' ? SLOTS : SLOTS - 1; }

  move(d) {
    const n = this.maxSel + 1;
    this.sel = (this.sel + d + n) % n;
    beep('cursor');
  }

  update(dt, engine) {
    this.t++;
    const input = engine.input;

    if (this.mode === 'confirm') {
      const d = this.rep.read(input);
      if (d === 'up' || d === 'down' || d === 'left' || d === 'right') {
        this.yes = 1 - this.yes; beep('cursor');
      }
      if (input.hit('b')) { beep('cursor'); this.mode = 'erase'; return; }
      if (input.hit('a') || input.hit('start')) {
        if (this.yes) {
          eraseSlot(this.sel + 1);
          this.refresh();
          beep('select');
          // Back to the LIST, not back to the erase cursor. The player has to
          // see the slot go empty, and leaving them hovering in erase mode is
          // one careless A away from losing the other file too.
          this.mode = 'pick';
        } else {
          beep('cursor');
          this.mode = 'erase';
        }
      }
      return;
    }

    const d = this.rep.read(input);
    if (d === 'up') this.move(-1);
    else if (d === 'down') this.move(1);

    if (input.hit('b')) {
      beep('cursor');
      if (this.mode === 'erase') { this.mode = 'pick'; this.sel = SLOTS; }
      else this.onBack();
      return;
    }

    if (!(input.hit('a') || input.hit('start'))) return;

    if (this.mode === 'erase') {
      if (!this.rows[this.sel]) { beep('error'); return; }
      beep('select');
      this.yes = 0;
      this.mode = 'confirm';
      return;
    }

    // 'pick'
    if (this.sel === SLOTS) {
      // ERASE. Refusing when there is nothing to erase is the whole reason the
      // bank has an `error` sound.
      if (!this.anyFile) { beep('error'); return; }
      beep('select');
      this.mode = 'erase';
      this.sel = this.rows.findIndex((r) => !!r);
      return;
    }
    const row = this.rows[this.sel];
    beep('select');
    if (row) this.onPlay(this.sel + 1, row);
    else this.onNew(this.sel + 1);
  }

  draw(ctx) {
    drawBox(ctx, FS.x, FS.y, FS.w, FS.h);

    const head = this.mode === 'pick' ? 'SELECT A FILE' : 'ERASE WHICH FILE';
    drawDialogTextCentered(ctx, head, 128, 62, this.mode === 'pick' ? DIM : WARN);
    ctx.fillStyle = DIM;
    for (const y of FS_RULES) ctx.fillRect(FS.x + 8, y, FS.w - 16, 1);

    for (let i = 0; i < SLOTS; i++) {
      const top = FS_ROW[i];
      const row = this.rows[i];
      const on = this.sel === i && this.mode !== 'confirm';
      const lit = on ? INK : DIM;
      drawDialogText(ctx, `FILE ${i + 1}`, FS_LABEL_X, top, DIM);
      if (!row) {
        drawDialogText(ctx, '-  EMPTY  -', FS_LABEL_X, top + 12, on ? INK : DIM);
      } else {
        drawDialogText(ctx, row.name || '?', FS_LABEL_X, top + 12, lit);
        drawHeartRow(ctx, FS_HEART_X, top + 11, row.maxHearts, row.halves);
      }
      if (on) drawChevron(ctx, FS_LABEL_X - 12, top + 12);
    }

    // ERASE only exists in 'pick'; in 'erase' the cursor is over the files and
    // the header has already said what pressing A will do.
    if (this.mode === 'pick') {
      const on = this.sel === SLOTS;
      const w = dialogTextWidth('ERASE');
      drawDialogTextCentered(ctx, 'ERASE', 128, FS_ERASE_Y, on ? INK : DIM);
      if (on) drawChevron(ctx, Math.round(128 - w / 2) - 12, FS_ERASE_Y);
    }

    if (this.mode === 'confirm') this.drawConfirm(ctx);
    else if ((this.t % 60) < 40) {
      const foot = this.mode === 'pick' ? 'A  TO  CHOOSE' : 'B  TO  GO  BACK';
      drawDialogTextCentered(ctx, foot, 128, FS_FOOT_Y, DIM);
    }
  }

  /**
   * ERASE IS THE ONE IRREVERSIBLE THING ON THIS SCREEN, so it asks, and the
   * cursor starts on NO. The panel is a smaller copy of the panel it is sitting
   * on, exactly as the SAVE menu is a smaller copy of the subscreen.
   */
  drawConfirm(ctx) {
    const P = ERASE_BOX;
    drawBox(ctx, P.x, P.y, P.w, P.h);
    const row = this.rows[this.sel];
    drawDialogTextCentered(ctx, `ERASE FILE ${this.sel + 1}`, 128, P.y + 12, WARN);
    drawDialogTextCentered(ctx, row && row.name ? row.name : '', 128, P.y + 24, INK);
    ['NO', 'YES'].forEach((label, i) => {
      const y = P.y + 40 + i * 14;
      const on = this.yes === i;
      drawDialogText(ctx, label, 118, y, on ? INK : DIM);
      if (on) drawChevron(ctx, 106, y);
    });
  }
}

// ---------------------------------------------------------------------------
// NAME ENTRY
//
// ALttP's grid: capitals, lowercase, digits and a handful of marks, with the
// name building at the top, the d-pad on the grid, A to append, B to delete,
// and END to finish. Same here.
//
// FOURTEEN COLUMNS, FIVE ROWS. Fourteen is what makes the alphabet fall out
// evenly — A..N and O..Z with two marks on the end of the second row, then the
// same shape in lowercase — so no row is a ragged half. 14 x 14px = 196px,
// centred in a 216px panel. The sixth row is the two commands.
//
// The name is drawn at 2x on a 16px pitch, with a rule under every one of the
// six slots and the next one lit, so the box always shows how many characters
// are left. That doubling is why the cap is six and not seven: 6 x 16 = 96px
// centred; a seventh slot pushes the display to 112 and the rules stop lining
// up under the panel's own 8px margins.
// ---------------------------------------------------------------------------
const NE = { x: 20, y: 48, w: 216, h: 154 };
const GRID = [
  'ABCDEFGHIJKLMN',
  'OPQRSTUVWXYZ.-',
  'abcdefghijklmn',
  'opqrstuvwxyz!?',
  "0123456789',& ",
];
const GRID_COLS = 14;
const GRID_X = 30;          // 128 - (14 * 14) / 2
const GRID_Y = 104;
const GRID_PITCH = 14;
const NAME_X = 80;          // 128 - (6 * 16) / 2
const NAME_Y = 68;
const CMD_Y = 170;
const COMMANDS = [
  { label: 'BACK', cx: 92 },
  { label: 'END', cx: 164 },
];

export class NameEntry {
  /**
   * @param {number} slot which file is being named (drawn in the header)
   * @param {object} [opts] { onDone(name), onCancel() }
   */
  constructor(slot, opts = {}) {
    this.slot = slot;
    this.onDone = opts.onDone || (() => {});
    this.onCancel = opts.onCancel || (() => {});
    this.name = '';
    this.r = 0;
    this.c = 0;
    this.cmd = 0;
    this.t = 0;
    this.rep = new Repeater();
    /** Set once so a scratch canvas is not built per glyph per frame. */
    this._big = new Map();
  }

  /** The character under the cursor, or null when the cursor is on a command. */
  get charAt() { return this.r < GRID.length ? GRID[this.r][this.c] : null; }

  move(d) {
    const last = GRID.length;          // the command row's index
    if (d === 'left' || d === 'right') {
      const s = d === 'left' ? -1 : 1;
      if (this.r === last) this.cmd = (this.cmd + s + 2) % 2;
      else this.c = (this.c + s + GRID_COLS) % GRID_COLS;
    } else if (d === 'up') {
      if (this.r === 0) { this.r = last; this.cmd = this.c < 7 ? 0 : 1; }
      else if (this.r === last) { this.r = last - 1; this.c = this.cmd === 0 ? 3 : 10; }
      else this.r--;
    } else if (d === 'down') {
      if (this.r === last - 1) { this.r = last; this.cmd = this.c < 7 ? 0 : 1; }
      else if (this.r === last) this.r = 0;
      else this.r++;
    }
    beep('cursor');
  }

  append(ch) {
    // A leading blank is not a name, and a trailing one is invisible — so the
    // space cell is only live once there is something for it to sit between.
    if (ch === ' ' && !this.name) { beep('error'); return; }
    if (this.name.length >= NAME_MAX) { beep('error'); return; }
    this.name += ch;
    beep('select');
  }

  backspace() {
    if (!this.name) {
      // B on an empty name is the way out. The grid's BACK cell is the
      // backspace; this is the only gesture left that can mean "never mind",
      // and a name-entry screen with no way back is a trap.
      beep('cursor');
      this.onCancel();
      return;
    }
    this.name = this.name.slice(0, -1);
    beep('cursor');
  }

  commit() {
    const nm = this.name.trim();
    if (!nm) { beep('error'); return; }
    beep('select');
    this.onDone(nm);
  }

  update(dt, engine) {
    this.t++;
    const input = engine.input;
    const d = this.rep.read(input);
    if (d) this.move(d);
    if (input.hit('b')) { this.backspace(); return; }
    if (input.hit('start')) { this.commit(); return; }
    if (!input.hit('a')) return;
    if (this.r < GRID.length) this.append(this.charAt);
    else if (this.cmd === 0) this.backspace();
    else this.commit();
  }

  // --- drawing --------------------------------------------------------------

  /** One dialogue-face glyph, rendered once at 1x and blitted at 2x. */
  bigGlyph(ch) {
    let cv = this._big.get(ch);
    if (!cv) {
      const w = Math.max(1, Math.ceil(dialogTextWidth(ch)));
      const src = document.createElement('canvas');
      src.width = w; src.height = 10;
      const sg = src.getContext('2d');
      sg.imageSmoothingEnabled = false;
      drawDialogText(sg, ch, 0, 0, INK);
      cv = document.createElement('canvas');
      cv.width = w * 2; cv.height = 20;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(src, 0, 0, w, 10, 0, 0, w * 2, 20);
      this._big.set(ch, cv);
    }
    return cv;
  }

  draw(ctx) {
    drawBox(ctx, NE.x, NE.y, NE.w, NE.h);
    drawDialogTextCentered(ctx, `NAME FILE ${this.slot}`, 128, 54, DIM);

    // --- the name, building, at the top --------------------------------------
    for (let i = 0; i < NAME_MAX; i++) {
      const x = NAME_X + i * 16;
      const ch = this.name[i];
      if (ch && ch !== ' ') {
        const g = this.bigGlyph(ch);
        ctx.drawImage(g, Math.round(x + (14 - g.width) / 2), NAME_Y);
      }
      // The caret: the rule under the next free slot blinks, every other rule
      // is the panel's slate.
      const next = i === this.name.length;
      ctx.fillStyle = next && (this.t % 40) < 24 ? INK : DIM;
      ctx.fillRect(x + 1, NAME_Y + 22, 12, 1);
    }
    ctx.fillStyle = DIM;
    ctx.fillRect(NE.x + 8, 98, NE.w - 16, 1);

    // --- the grid ------------------------------------------------------------
    for (let r = 0; r < GRID.length; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = GRID[r][c];
        const x = GRID_X + c * GRID_PITCH;
        const y = GRID_Y + r * GRID_PITCH;
        const on = this.r === r && this.c === c;
        if (on) this.cell(ctx, x, y, GRID_PITCH - 1, 11);
        if (ch === ' ') {
          // The space cell has no ink of its own, so it is drawn as the face's
          // own underscore rather than as a second, invented glyph.
          ctx.fillStyle = on ? INK : DIM;
          ctx.fillRect(x + 3, y + 7, 7, 1);
        } else {
          drawDialogText(ctx, ch, x + Math.round((13 - dialogTextWidth(ch)) / 2), y, on ? INK : DIM);
        }
      }
    }

    // --- the two commands ----------------------------------------------------
    COMMANDS.forEach((cmd, i) => {
      const on = this.r === GRID.length && this.cmd === i;
      const w = dialogTextWidth(cmd.label);
      if (on) this.cell(ctx, Math.round(cmd.cx - w / 2) - 4, CMD_Y - 2, w + 8, 11);
      drawDialogTextCentered(ctx, cmd.label, cmd.cx, CMD_Y, on ? INK : DIM);
    });

    if ((this.t % 60) < 40) {
      drawDialogTextCentered(ctx, 'A  ADD    B  DELETE', 128, 188, DIM);
    }
  }

  /** The cursor: a 1px white cell outline, in the panel's own ink. */
  cell(ctx, x, y, w, h) {
    ctx.fillStyle = INK;
    ctx.fillRect(x, y - 2, w, 1);
    ctx.fillRect(x, y + h - 3, w, 1);
    ctx.fillRect(x, y - 2, 1, h);
    ctx.fillRect(x + w - 1, y - 2, 1, h);
  }
}

// ---------------------------------------------------------------------------
// FrontEnd — the state machine the integration agent wires to.
//
//   const front = new FrontEnd({ onStart: () => engine.setScene(new Game()) });
//   front.update(dt, engine);  front.draw(ctx);
//
// THE FRONT DOOR A LINK TO THE PAST ACTUALLY HAD:
//
//   title --START--> (wipe) --> FILE SELECT
//     ...on a played file  --> (fade) --------------------------> onStart()
//     ...on a fresh file   --> (fade) --> intro --> (fade) -----> onStart()
//     ...on an empty file  --> (wipe) --> NAME ENTRY --> (wipe) --> FILE SELECT
//
// A named file is CREATED at the end of NAME ENTRY and the player is put back
// on the file select with the cursor on it, which is the real thing's own
// order: you name a file, you see it in the list, then you choose it. It also
// means the very first thing a new player does after typing a name is watch it
// appear in a slot — the one moment that teaches what the slots are for.
//
// CONTINUE does not replay the four intro panels: the prologue of a chapter you
// are half way through is the one thing nobody wants to sit through twice. The
// load happens on the other side of the fade — requestContinue(slot) records
// the choice and save.js's saveTick drains it on the first frame the chapter is
// actually holding the phase, holding the curtain black across the async
// rebuild of the Boilerworks if the file was saved down there.
//
// WHEN THERE IS NO FILE SELECT AT ALL. `?bot=play` and `?beat=` get the
// pre-slot front door — PRESS START, intro, chapter (see save.titleSlots for
// why). Every existing capture of the title and the intro therefore still
// captures exactly what it captured before, and the autopilot still plays the
// chapter end to end without a menu it cannot read.
// ---------------------------------------------------------------------------
const FADE_FRAMES = 24;
/** Half of a wipe: out over WIPE_HALF frames, then back in over WIPE_HALF. */
const WIPE_HALF = 12;

export class FrontEnd {
  constructor(opts = {}) {
    this.onStart = opts.onStart || (() => {});
    this.title = new TitleScreen();
    this.intro = null;
    this.fade = 0;
    this.skipIntro = !!opts.skipIntro;
    this.continuing = false;
    this.wipe = null;

    // ARE THERE FILES ON THIS MACHINE. Asked once, here, on the frame the front
    // end is built — which is also the frame game.js rebuilds it on after the
    // chapter card (scenes/game.js _newGame), so a run that has just been
    // played comes straight back to a file select listing it.
    //
    // titleSlots() cannot throw: absent, unreadable, non-JSON, wrong-shaped and
    // wrong-schema files all come back as a null ROW, and a null row is
    // "- EMPTY -". A corrupt file 2 costs the player file 2 and nothing else —
    // file 1 still lists, still loads, and the screen still draws.
    let rows = null;
    try { rows = opts.slots !== undefined ? opts.slots : titleSlots(); } catch (e) { rows = null; }
    this.files = !!rows;
    this.select = this.files ? new FileSelect(rows, {
      onPlay: (slot, row) => this.choose(slot, row),
      onNew: (slot) => this.nameFile(slot),
      onBack: () => this.startWipe('title'),
    }) : null;
    this.name = null;

    // `startAt: 'files'` is what the ENDING comes back to: A on the last card
    // returns the player to the FILE SELECT, not to a dead title. It falls back
    // to the title on a run that has no file select to come back to.
    this.state = (opts.startAt === 'files' && this.files) ? 'files' : 'title';
  }

  /** True if any slot holds a file that can actually be loaded. */
  get hasFile() { return !!(this.select && this.select.hasFile); }

  // --- transitions ----------------------------------------------------------

  /**
   * A dithered cross-wipe between two front-end screens: down to black over
   * WIPE_HALF frames on the screen being left, back up over WIPE_HALF on the
   * screen being entered. Same four-step ordered dither the fade to the chapter
   * uses — no alpha, no gradient.
   */
  startWipe(to) {
    this.wipe = { t: 0, from: this.state, to };
    this.state = 'wipe';
  }

  /** The player answered the title screen. */
  commit() {
    if (this.state !== 'title') return;
    beep('select');
    if (this.files) { this.startWipe('files'); return; }
    // No file select on this run: the old single-press path, untouched.
    this.continuing = false;
    this.state = 'fadein';
    this.fade = 0;
  }

  /** A file was chosen on the file select. */
  choose(slot, row) {
    setActiveSlot(slot);
    this.continuing = false;
    if (row && row.playable) {
      try { requestContinue(slot); this.continuing = true; } catch (e) { this.continuing = false; }
    }
    this.state = 'fadein';
    this.fade = 0;
  }

  /** An empty slot was chosen: go and name it. */
  nameFile(slot) {
    this.name = new NameEntry(slot, {
      onDone: (nm) => {
        const made = createSlot(slot, nm);
        // A CARTRIDGE WITH A DEAD BATTERY STILL PLAYS. If the browser refuses
        // storage outright (cookies blocked, Safari private mode) the write
        // fails, the row comes back EMPTY, and A on it reopens NAME ENTRY —
        // measured, six rounds of that never reached the chapter. So when
        // there is no store at all, fall through into the chapter as an
        // unsaved session instead of back to a menu with no exit.
        if (!made && !storeAvailable()) { this.choose(slot, null); return; }
        this.backToFiles(slot - 1);
      },
      onCancel: () => this.backToFiles(slot - 1),
    });
    this.startWipe('name');
  }

  /** Re-read the slots and put the cursor on `sel`, then wipe back to them. */
  backToFiles(sel) {
    this.select.refresh();
    this.select.sel = Math.max(0, Math.min(SLOTS, sel | 0));
    this.select.mode = 'pick';
    this.name = null;
    this.startWipe('files');
  }

  /** Jump straight into the intro (used by captures and by a "skip title"). */
  beginIntro() {
    this.intro = new Intro({ onDone: () => this.finish() });
    this.state = 'intro';
    this.fade = 0;
  }

  finish() {
    if (this.state === 'done') return;
    this.state = 'fadeout';
    this.fade = 0;
  }

  // --- frame ----------------------------------------------------------------

  update(dt, engine) {
    const input = engine.input;
    switch (this.state) {
      case 'title':
        this.title.update(dt, engine);
        if (input.hit('start') || input.hit('a')) this.commit();
        break;
      case 'wipe':
        // The backdrop keeps living through the wipe — the clouds do not stop
        // drifting because a menu is changing.
        this.title.update(dt, engine);
        if (++this.wipe.t >= WIPE_HALF * 2) {
          this.state = this.wipe.to;
          this.wipe = null;
        }
        break;
      case 'files':
        this.title.update(dt, engine);
        this.select.update(dt, engine);
        break;
      case 'name':
        this.title.update(dt, engine);
        this.name.update(dt, engine);
        break;
      case 'fadein':
        this.title.update(dt, engine);
        if (++this.fade >= FADE_FRAMES) {
          if (this.skipIntro || this.continuing) { this.state = 'done'; this.onStart(); }
          else this.beginIntro();
        }
        break;
      case 'intro':
        this.intro.update(dt, engine);
        break;
      case 'fadeout':
        if (++this.fade >= FADE_FRAMES) { this.state = 'done'; this.onStart(); }
        break;
    }
  }

  /** Paint one of the three front-end screens, without any transition on it. */
  drawScreen(ctx, which) {
    switch (which) {
      case 'files':
        this.title.draw(ctx, false);
        if (this.select) this.select.draw(ctx);
        break;
      case 'name':
        this.title.draw(ctx, false);
        if (this.name) this.name.draw(ctx);
        break;
      default:
        this.title.draw(ctx, true);
    }
  }

  /** The four-step ordered dither to black. `k` is 0 (clear) to 1 (black). */
  dither(ctx, k) {
    const step = Math.min(4, Math.floor(Math.max(0, k) * 5));
    if (step <= 0) return;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (BAYER[y & 3][x & 3] < step * 4) ctx.fillRect(x, y, 1, 1);
    }
  }

  draw(ctx) {
    if (this.state === 'wipe') {
      const w = this.wipe;
      const first = w.t < WIPE_HALF;
      this.drawScreen(ctx, first ? w.from : w.to);
      this.dither(ctx, first ? w.t / WIPE_HALF : (WIPE_HALF * 2 - w.t) / WIPE_HALF);
      return;
    }

    if (this.state === 'title' || this.state === 'files' || this.state === 'name'
      || this.state === 'fadein') {
      // `fadein` fades out whichever screen the player answered on.
      this.drawScreen(ctx, this.state === 'fadein' ? this.fadeFrom() : this.state);
    } else if (this.intro) this.intro.draw(ctx);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }

    if (this.state === 'fadein' || this.state === 'fadeout') {
      this.dither(ctx, this.fade / FADE_FRAMES);
    }
  }

  /** Which screen `fadein` is fading OUT — the file select, or the title. */
  fadeFrom() { return this.files ? 'files' : 'title'; }
}
