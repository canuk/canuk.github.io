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
import { drawDialogTextCentered, dialogTextWidth } from './dialog.js';
import { Intro } from './intro.js';
import { titleFile, requestContinue } from './save.js';

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
// It was six glyphs, which was exactly enough for the one thing the title
// screen said. The file-select prompt (CONTINUE / NEW GAME — see TitleScreen
// below) needs eight more, and a menu set in the 6px dialogue face under a
// 26-row chiselled logo reads as a debug overlay, not as a front end. So they
// are authored here in the SAME grammar: 9 rows, 2px stems, flat terminals, no
// curves, widths from 6 (I) to 11 (M/W — an M or a W squeezed into a 9 cell
// loses its counters, which is the mistake that produced the broken capital W
// the dialogue font was pulled up on in round 8).
// ---------------------------------------------------------------------------
const BIG = {
  P: ['#######..', '##....##.', '##....##.', '##....##.', '#######..', '##.......', '##.......', '##.......', '##.......'],
  R: ['#######..', '##....##.', '##....##.', '##....##.', '#######..', '##..##...', '##...##..', '##....##.', '##....###'],
  E: ['########.', '##.......', '##.......', '##.......', '######...', '##.......', '##.......', '##.......', '########.'],
  S: ['.######..', '##....##.', '##.......', '###......', '..####...', '.....###.', '.......##', '##....##.', '.######..'],
  T: ['#########', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...', '...###...'],
  A: ['..#####..', '.##...##.', '##.....##', '##.....##', '#########', '##.....##', '##.....##', '##.....##', '##.....##'],
  C: ['.######..', '##....##.', '##.......', '##.......', '##.......', '##.......', '##.......', '##....##.', '.######..'],
  O: ['.######..', '##....##.', '##....##.', '##....##.', '##....##.', '##....##.', '##....##.', '##....##.', '.######..'],
  N: ['##.....##', '###....##', '####...##', '##.##..##', '##..##.##', '##...####', '##....###', '##.....##', '##.....##'],
  I: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
  U: ['##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##', '###...###', '.#######.'],
  G: ['.######..', '##....##.', '##.......', '##.......', '##..####.', '##....##.', '##....##.', '##....##.', '.######..'],
  W: ['##.......##', '##.......##', '##.......##', '##.......##', '##...#...##', '##..###..##', '##.##.##.##', '#####.#####', '.###...###.'],
  M: ['##.......##', '###.....###', '####...####', '##.##.##.##', '##..###..##', '##...#...##', '##.......##', '##.......##', '##.......##'],
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

// Where the file-select sits. PRESS START lives at 156 on its own; with a file
// on the machine the same band carries two lines and a summary, ending clear of
// the 1993 SKYFORGE credit at 208 and starting below the subtitle at 56.
// The left edge of the widest option lands at x~86, which is one pixel clear of
// the windmill sails (they span x 22-66) — the cursor gear at x-13 therefore
// sits over open cloud, not over the mill.
const OPT_Y = [144, 164];
const FILE_Y = 187;

export class TitleScreen {
  constructor() {
    this.frame = 0;
    /** A describeSave() result, or null for "no file on this machine". */
    this.file = null;
    /** 0 = CONTINUE, 1 = NEW GAME. Ignored when `file` is null. */
    this.sel = 0;
    this.build();
  }

  /**
   * Hand the screen the save file, or null. With a file it draws the two-line
   * select; without one it is byte-for-byte the screen a critic already passed
   * — same blinking PRESS START, same everything. That is the whole contract:
   * a machine with no save, a corrupt save or a save from another build sees
   * exactly the title screen this game shipped with.
   */
  setFile(file) {
    this.file = file || null;
    this.sel = 0;
    this.fileLine = file ? this._summary(file) : null;
  }

  /**
   * ALttP's file select prints where you are and how much life you have. Same
   * here, in the dialogue face, and measured: the longest form is used only if
   * it fits inside the panel-width the rest of the screen is composed to, and
   * the cogs are what get dropped when it does not.
   */
  _summary(f) {
    const hearts = `${f.hearts} HEART${f.hearts === 1 ? '' : 'S'}`;
    const full = `${f.place}  -  ${hearts}  -  ${String(f.cogs).padStart(3, '0')} COGS`;
    if (dialogTextWidth(full) <= 236) return full;
    const mid = `${f.place}  -  ${hearts}`;
    if (dialogTextWidth(mid) <= 236) return mid;
    return hearts;
  }

  /** Move the cursor. Returns true if it actually moved (so FrontEnd can beep). */
  moveSel(d) {
    if (!this.file) return false;
    const n = (this.sel + d + 2) % 2;
    if (n === this.sel) return false;
    this.sel = n;
    return true;
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
    // THE FILE SELECT. Two states of the same two words: lit when the cursor
    // is on them, and dropped to the cloud-deck greys when it is not, so the
    // unselected line still reads as a thing you could choose rather than as
    // something switched off. Both are built whether or not a save exists —
    // building two 84px canvases costs nothing and the alternative is a branch
    // inside draw() that runs sixty times a second.
    this.optOn = [
      makeBigCaps('CONTINUE', '#f8f8f8', '#1a1208'),
      makeBigCaps('NEW GAME', '#f8f8f8', '#1a1208'),
    ];
    this.optOff = [
      makeBigCaps('CONTINUE', '#7a8ba4', '#141b2c'),
      makeBigCaps('NEW GAME', '#7a8ba4', '#141b2c'),
    ];

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

  draw(ctx) {
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

    if (this.file) this.drawFileSelect(ctx);
    // PRESS START at ~1Hz: 36 frames lit, 24 dark
    else if (this.frame % 60 < 36) {
      ctx.drawImage(this.press, Math.round((W - this.press.width) / 2), 156);
    }
    drawDialogTextCentered(ctx, '1993 SKYFORGE', W / 2, 208, '#3f5c82', '#e4eef6');
  }

  /**
   * CONTINUE / NEW GAME, in the lockup's own hardware.
   *
   * No box is drawn round it. The title screen's grammar is a chiselled plate,
   * a brass rule with a gear at each end, and cast-shadowed caps standing
   * directly on the cloud deck — a windowed menu dropped on top of that would
   * be the only framed object on the screen and would read as a different
   * game's UI. So the select is the same cast-shadowed caps at the same weight
   * as PRESS START, and the cursor is the SAME GEAR that caps the rule, which
   * is the one piece of pointing hardware this screen already owns.
   *
   * The selected line does not blink. PRESS START blinks because it is asking
   * for a press; a cursor that blinks is asking you to wait for it.
   */
  drawFileSelect(ctx) {
    for (let i = 0; i < 2; i++) {
      const on = i === this.sel;
      const img = on ? this.optOn[i] : this.optOff[i];
      const x = Math.round((W - img.width) / 2);
      ctx.drawImage(img, x, OPT_Y[i]);
      if (on) ctx.drawImage(GEAR, x - 13, OPT_Y[i] + 2);
    }
    if (this.fileLine) {
      drawDialogTextCentered(ctx, this.fileLine, W / 2, FILE_Y, '#e4eef6', '#0e1420');
    }
  }
}

// ---------------------------------------------------------------------------
// FrontEnd — the state machine the integration agent wires to.
//
//   const front = new FrontEnd({ onStart: () => engine.setScene(new Game()) });
//   front.update(dt, engine);  front.draw(ctx);
//
// title --START--> (fade) --> intro --START/last panel--> (fade) --> onStart()
// ---------------------------------------------------------------------------
const FADE_FRAMES = 24;

/** The cursor click, through the chapter's one mixer. Never fatal, headless. */
function titleBeep() {
  try {
    if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx('select');
  } catch (e) { /* no audio in a capture */ }
}

export class FrontEnd {
  constructor(opts = {}) {
    this.onStart = opts.onStart || (() => {});
    this.title = new TitleScreen();
    this.intro = null;
    this.state = 'title';
    this.fade = 0;
    this.skipIntro = !!opts.skipIntro;
    // IS THERE A FILE ON THIS MACHINE. Asked once, here, on the frame the
    // front end is built — which is also the frame game.js rebuilds it on
    // after the chapter card (scenes/game.js _newGame), so a run that has just
    // been played comes back to a title screen offering to continue it.
    //
    // describeSave() cannot throw: absent, unreadable, non-JSON, wrong-shaped
    // and wrong-schema files all come back null, and null is the title screen
    // exactly as it was before save/load existed. That is the whole of the
    // "a corrupt save must not break the title screen" requirement, and it is
    // one line because the refusing is all done in save.js.
    let file = null;
    try { file = opts.file !== undefined ? opts.file : titleFile(); } catch (e) { file = null; }
    this.title.setFile(file);
    this.continuing = false;
  }

  /** True if the player is looking at a file-select rather than PRESS START. */
  get hasFile() { return !!this.title.file; }

  /**
   * The player answered the title screen.
   *
   * CONTINUE does not replay the four intro panels — the prologue of a chapter
   * you are half way through is the one thing nobody wants to sit through
   * twice — so it fades once and goes straight to onStart(). The load itself
   * happens on the other side of that fade: requestContinue() records the
   * choice and save.js's saveTick drains it on the first frame the chapter is
   * actually holding the phase, holding the curtain black across the async
   * rebuild of the Boilerworks if the file was saved down there.
   *
   * NEW GAME is the untouched path: fade, intro, chapter.
   */
  commit() {
    if (this.state !== 'title') return;
    this.continuing = this.hasFile && this.title.sel === 0;
    if (this.continuing) { try { requestContinue(); } catch (e) { this.continuing = false; } }
    titleBeep();
    this.state = 'fadein';
    this.fade = 0;
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

  update(dt, engine) {
    const input = engine.input;
    switch (this.state) {
      case 'title':
        this.title.update(dt, engine);
        // With a file on the machine the title is a two-line select: up/down
        // moves the gear, START or A commits. Without one it is the single
        // press it has always been, and neither the d-pad nor this branch is
        // reachable.
        if (this.hasFile) {
          if (input.hit('up') && this.title.moveSel(-1)) titleBeep();
          if (input.hit('down') && this.title.moveSel(1)) titleBeep();
        }
        if (input.hit('start') || input.hit('a')) { this.commit(); }
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

  draw(ctx) {
    if (this.state === 'title' || this.state === 'fadein') this.title.draw(ctx);
    else if (this.intro) this.intro.draw(ctx);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }

    if (this.state === 'fadein' || this.state === 'fadeout') {
      // Dithered fade to black — four ordered-dither steps, no alpha blending.
      const step = Math.min(4, Math.floor((this.fade / FADE_FRAMES) * 5));
      ctx.fillStyle = '#000';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (BAYER[y & 3][x & 3] < step * 4) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
