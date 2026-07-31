// Demo: the five pieces of connective tissue, in sequence, on real Bellows
// Isle screens.
//
//   1. SCREEN SCROLL   Wren walks off the east edge of an inland screen; the
//                      camera slides one full screen, 8px every frame, while
//                      he walks in and both screens keep animating.
//   2. DOOR + STAIRS   the Boilerworks hatch: he walks a full tile down into
//                      the mouth as it fades, and the hatch's far half is
//                      painted over him so the hole takes him. The staircase
//                      back up is ALttP's keep-walking-under-the-fade
//                      variant, same treatment. Beat 7 is the bare fade with
//                      no walk, for comparison.
//   3. ITEM GET        the Bellows Cuff raised overhead in both fists, white
//                      flash, a starburst behind it, sparkles on the brass,
//                      fanfare hook, text box. It runs BEFORE the sky drops:
//                      the hero frame of the piece is not worth having if it
//                      is graded down to dusk.
//   4. SKY STAGES      the isle sinks through five AUTHORED palettes — warm
//                      and hazy first, cold and flat last — plus cloud
//                      parallax that speeds up as it falls. Interiors take
//                      the same stages at reduced strength.
//   5. THE LURCH       an 8-frame vertical jolt + knocked-loose grit (ceiling
//                      dust indoors, dust puffed off the deck outdoors).
//
// The whole run is scripted off a generator so `node tools/capture.js
// transitions --start N` lands on the same frame every time.
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeTileset } from '../game/tileset.js';
import { makeSprite } from '../sprites.js';
import { Tilemap } from '../game/tilemap.js';
import { Player } from '../game/player.js';
import { HUD } from '../game/hud.js';
import { SkyState } from '../game/skystate.js';
import { Transitions } from '../game/transition.js';
// ONE MESSAGE WINDOW IN THE CARTRIDGE. game/dialog.js installs its conversation
// window into Transitions.prototype when it loads (adoptMessageWindow), so the
// item-get announcement is drawn by the same code, at the same 168x47 geometry,
// in the same variable-width mixed-case face as everything else Wren is told.
// Every scene the player can reach already imports dialog.js for its DialogBox;
// this demo scene has no conversation in it, so it says so explicitly. Without
// this line the item-get is the one surface in the build with no window at all.
import '../game/dialog.js';

const COLS = 16, ROWS = 14;

// ===========================================================================
// Screen A — inland: an east-west road with a north spur, fenced strip,
// bush clusters, orchard trees. Wren walks off its east edge.
// ===========================================================================
// Both screens share the isle's south coast so the scroll reads as one place:
// screen A is a straight run of the band, screen B rounds it into the
// southeast corner and the east rim.
const MAP_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  'IIIIIIIIIIIIIIII',
  'IIIIIIIIIIIIIIII',
  'IIIIIIIIIIIIIIII',
  'IIIIIIIIIIIIIIII',
  'UUUUUUUUUUUUUUUU',
  'VVVVVVVVVVVVVVVV',
];

// Screen B — the rim: the island's east coast and south band, the cloud sea
// below, and the sealed Boilerworks hatch on a spur off the road.
const MAP_B = [
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

const CLOUD_TOPS = ['cloud_b', 'cloud_d', 'cloud_a', 'cloud_c', 'cloud_d',
  'cloud_b', 'cloud_c', 'cloud_a', 'cloud_d', 'cloud_b', 'cloud_a', 'cloud_c',
  'cloud_b', 'cloud_d', 'cloud_c', 'cloud_a'];

const rectSet = (set, c0, r0, c1, r1) => {
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set.add(`${c},${r}`);
};

// road: rows 5-6 across, with a spur north at cols 7-8 (screen B) / 9-10 (A)
function roadA() {
  const s = new Set();
  rectSet(s, 0, 5, 15, 6);
  rectSet(s, 9, 0, 10, 4);
  return s;
}
function roadB() {
  const s = new Set();
  rectSet(s, 0, 5, 11, 6);
  rectSet(s, 7, 0, 8, 4);          // spur north, off the top edge toward D
  return s;
}
// Screen D — inland, north of B: the road carries on toward Cogwick Hollow,
// with a westward branch. Reached by walking off B's north edge.
const MAP_D = Array.from({ length: ROWS }, () => '.'.repeat(12) + 'IIIK');
function roadD() {
  const s = new Set();
  rectSet(s, 7, 0, 8, 13);
  rectSet(s, 2, 9, 7, 10);
  return s;
}
function darkD() {
  const s = new Set();
  rectSet(s, 11, 2, 13, 3); rectSet(s, 12, 4, 14, 4);
  rectSet(s, 0, 6, 2, 7); rectSet(s, 0, 8, 1, 8);
  return s;
}
function darkA() {
  const s = new Set();
  rectSet(s, 0, 0, 2, 1); rectSet(s, 0, 2, 1, 2);
  rectSet(s, 13, 1, 14, 2); rectSet(s, 14, 3, 15, 3);
  rectSet(s, 3, 7, 5, 7);
  return s;
}
function darkB() {
  const s = new Set();
  rectSet(s, 0, 0, 1, 1); rectSet(s, 0, 2, 2, 2);
  rectSet(s, 10, 6, 11, 7);
  return s;
}

// [sprite, col, row] — decor baked into the layer; solid ones also become
// obstacles so Wren can't walk through a bush.
const DECOR_A = [
  ['fence', 5, 3], ['fence', 6, 3], ['fence', 7, 3], ['fence', 8, 3],
  ['fence', 11, 3], ['fence', 12, 3], ['fence', 13, 3], ['fence', 14, 3],
  ['fence', 15, 3],
  ['bush', 1, 4], ['bush2', 2, 4], ['bush', 12, 7], ['bush2', 13, 7],
  ['bush', 6, 1],
  ['rock', 0, 7], ['rock_small', 1, 7], ['rock', 15, 1], ['rock_small', 3, 2],
  ['tallgrass', 2, 2], ['tallgrass2', 5, 4], ['tallgrass3', 12, 4],
  ['tallgrass', 8, 7], ['tallgrass2', 4, 7], ['tallgrass3', 14, 4],
  ['tallgrass', 11, 0], ['tallgrass2', 0, 2], ['tallgrass3', 10, 7],
  ['pebbles', 3, 5], ['pebbles', 8, 6], ['pebbles', 13, 5], ['pebbles', 9, 2],
  ['post', 8, 4], ['post', 11, 4],
  ['vent', 6, 7],
];
const DECOR_B = [
  ['fence', 0, 3], ['fence', 1, 3], ['fence', 4, 3], ['fence', 5, 3],
  ['fence', 10, 3], ['fence', 11, 3],
  // The row-7 bush pair used to sit at cols 4-5, immediately east of the
  // hatch, which walled off the only route out of it that does not go back
  // through the mouth. Moved east onto the dark-grass patch at cols 10-11.
  ['bush', 10, 1], ['bush2', 11, 1], ['bush', 10, 7], ['bush2', 11, 7],
  ['rock', 10, 2], ['rock_small', 10, 3], ['rock', 0, 4], ['rock_small', 3, 4],
  ['tallgrass', 4, 0], ['tallgrass2', 1, 4], ['tallgrass3', 9, 4],
  ['tallgrass2', 6, 7], ['tallgrass', 11, 4], ['tallgrass3', 4, 4],
  ['tallgrass', 9, 7], ['tallgrass3', 3, 2],
  ['pebbles', 2, 5], ['pebbles', 6, 6], ['pebbles', 10, 5], ['pebbles', 8, 2],
  ['post', 6, 7], ['post', 9, 7],
  ['vent', 0, 0],
];
const DECOR_D = [
  ['fence', 0, 5], ['fence', 1, 5], ['fence', 2, 5], ['fence', 3, 5],
  ['fence', 4, 5], ['fence', 5, 5],
  ['fence', 10, 5], ['fence', 11, 5], ['fence', 12, 5], ['fence', 13, 5],
  ['fence', 14, 5], ['fence', 15, 5],
  ['bush', 3, 7], ['bush2', 4, 7], ['bush', 11, 8], ['bush2', 12, 8],
  ['bush', 1, 2], ['bush2', 2, 2],
  ['rock', 5, 11], ['rock_small', 6, 12], ['rock', 13, 11],
  ['rock_small', 14, 12], ['rock', 0, 9],
  ['tallgrass', 1, 7], ['tallgrass2', 5, 2], ['tallgrass3', 10, 1],
  ['tallgrass', 13, 6], ['tallgrass2', 3, 12], ['tallgrass3', 9, 11],
  ['tallgrass', 15, 8], ['tallgrass2', 10, 13], ['tallgrass3', 2, 4],
  ['pebbles', 7, 3], ['pebbles', 8, 8], ['pebbles', 7, 12], ['pebbles', 4, 9],
  ['post', 6, 6], ['post', 9, 6],
  ['vent', 14, 2],
];
const TREES_A = [['tree', 4, -24]];
const TREES_B = [['tree2', 176, -16]];
// Brass pipework plumbing screen A's vent down over the rim.
const PIPES_A = [['pipe_v', 96, 128], ['pipe_v', 96, 144], ['pipe_end', 96, 160]];
const PIPES_B = [];
const FLOWERS_A = [
  ['w', 20, 68], ['r', 34, 74], ['w', 132, 22], ['r', 148, 30],
  ['w', 168, 100], ['r', 60, 110], ['w', 100, 20], ['r', 22, 44],
  ['w', 214, 78], ['r', 204, 50], ['w', 84, 44], ['r', 168, 12],
];
const FLOWERS_B = [
  ['w', 24, 22], ['r', 40, 12], ['w', 148, 22], ['r', 168, 30],
  ['w', 60, 74], ['r', 74, 120], ['w', 24, 108], ['r', 130, 116],
  ['w', 104, 20], ['r', 40, 60],
];
const TREES_D = [['tree', -18, 138], ['tree2', 140, 92]];
const FLOWERS_D = [
  ['w', 30, 40], ['r', 44, 52], ['w', 180, 30], ['r', 196, 140],
  ['w', 60, 150], ['r', 24, 120], ['w', 150, 180], ['r', 172, 92],
  ['w', 96, 60], ['r', 112, 190], ['w', 210, 176], ['r', 84, 118],
];

// ===========================================================================
// Screen C — a Boilerworks cellar. Authored here because the dungeon piece
// owns the real tileset; this is just enough riveted plate and copper to
// prove the door/stair transitions against an interior.
// ===========================================================================
const IN_PAL = {
  k: '#151a20', d: '#242c36', f: '#333c48', F: '#404b58', h: '#596878',
  w: '#8794a4', s: '#1d232b', S: '#2e3742', W: '#3f4a58',
  c: '#7a4e28', C: '#a86a38', m: '#4a3018',
  B: '#b8912e', A: '#dcc470', z: '#6a4e18', o: '#0a0d10',
};

function grid(w, h, ch) {
  return Array.from({ length: h }, () => Array(w).fill(ch));
}
const rowsOf = (g) => g.map(r => r.join(''));
function box(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
}

// A tiny deterministic hash so the floor mottle is authored, not random.
const ih = (a, b) => (((a * 374761393 + b * 668265263) ^ 0x5bf03635) >>> 0);

// Riveted plate floor. ALttP dungeon floors carry a LOT of texture (the
// Eastern Palace floor measures 121 non-base px per 16x16 block); a clean
// bevelled plate on its own reads as graph paper, so every tile also gets a
// scatter of grime flecks and wear scratches from a per-variant hash.
function floorTile(variant) {
  const g = grid(16, 16, 'f');
  box(g, 0, 0, 16, 1, 'd'); box(g, 0, 0, 1, 16, 'd');   // seam: top + left
  box(g, 15, 1, 1, 15, 'F'); box(g, 1, 15, 15, 1, 'F'); // bevel: right + bottom
  if (variant % 2 === 0) {
    for (const [rx, ry] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
      box(g, rx, ry, 2, 1, 'h'); box(g, rx, ry + 1, 2, 1, 'k');
    }
  }
  // grime + wear: ~18 flecks, half dark half light, never on the seams
  for (let i = 0; i < 18; i++) {
    const r = ih(variant * 31 + i, i * 7);
    const x = 2 + (r % 12), y = 2 + ((r >> 5) % 12);
    const len = 1 + ((r >> 11) & 1);
    box(g, x, y, Math.min(len + 1, 14 - x + 2), 1, (r >> 13) & 1 ? 'd' : 'F');
  }
  return rowsOf(g);
}

// Floor drain: a brass-lipped grate over the dark.
function grateTile() {
  const g = grid(16, 16, 'f');
  box(g, 0, 0, 16, 1, 'd'); box(g, 0, 0, 1, 16, 'd');
  box(g, 15, 1, 1, 15, 'F'); box(g, 1, 15, 15, 1, 'F');
  box(g, 3, 3, 10, 10, 'z'); box(g, 4, 4, 8, 8, 'o');
  for (let i = 0; i < 4; i++) box(g, 4, 4 + i * 2, 8, 1, 'B');
  box(g, 3, 3, 10, 1, 'A');
  return rowsOf(g);
}

// Wall face — the 16px band you see standing up. Riveted steel plates split
// by pilaster seams, a lit rail along the top, a copper header low down, and
// a hard shadow line where it meets the floor.
function wallFace(pilaster) {
  const g = grid(16, 16, 'S');
  box(g, 0, 0, 16, 1, 'k');
  box(g, 0, 1, 16, 1, 'W');                  // lit top rail
  box(g, 0, 2, 16, 1, 'S');
  for (const x of [3, 11]) { g[4][x] = 'W'; g[5][x] = 'k'; }   // rivets
  box(g, 0, 8, 16, 1, 'k');                  // header shadow
  box(g, 0, 9, 16, 1, 'C');                  // copper header
  box(g, 0, 10, 16, 2, 'c');
  box(g, 0, 12, 16, 1, 'm');
  box(g, 0, 13, 16, 1, 's');
  box(g, 0, 15, 16, 1, 'k');                 // shadow onto the floor
  if (pilaster) {
    box(g, 6, 1, 4, 12, 'W'); box(g, 6, 1, 1, 12, 'w');
    box(g, 9, 1, 1, 12, 's');
    box(g, 6, 8, 4, 5, 'B'); box(g, 6, 9, 4, 1, 'A'); box(g, 6, 12, 4, 1, 'z');
  } else {
    box(g, 7, 1, 1, 7, 's'); box(g, 7, 13, 1, 2, 's');
  }
  return rowsOf(g);
}

// Top of a wall seen from above: dark plate with a lit leading edge.
function wallTop(lit) {
  const g = grid(16, 16, 's');
  box(g, 0, 0, 16, 1, 'k');
  if (lit) box(g, 0, 1, 16, 2, 'S');
  box(g, 0, 15, 16, 1, 'k');
  for (const [x, y] of [[3, 5], [11, 4], [7, 10], [13, 12], [1, 9], [8, 6]]) {
    g[y][x] = 'S'; g[y][(x + 1) % 16] = 'S';
  }
  box(g, 0, 7, 16, 1, 'k');
  return rowsOf(g);
}

// Side wall seen face-on from the side of the room: plate courses with a
// dark inner seam. No horizontal bands — those read as ladder rungs.
function wallSide(flip, pilaster) {
  const g = grid(16, 16, 'S');
  box(g, 0, 0, 2, 16, 'k'); box(g, 2, 0, 1, 16, 's');
  box(g, 3, 0, 1, 16, 'W');
  box(g, 14, 0, 2, 16, 'k'); box(g, 13, 0, 1, 16, 's');
  for (const y of [3, 11]) { g[y][6] = 'W'; g[y + 1][6] = 'k'; }
  box(g, 0, 0, 16, 1, 's');
  if (pilaster) {
    box(g, 5, 0, 6, 16, 'c'); box(g, 5, 0, 1, 16, 'C'); box(g, 10, 0, 1, 16, 'm');
  }
  return flip ? rowsOf(g).map(r => [...r].reverse().join('')) : rowsOf(g);
}

// Staircase up, set into the wall: a dark shaft with brass-nosed treads
// widening toward the camera.
function stairsSprite() {
  const g = grid(32, 48, '.');
  box(g, 0, 0, 32, 30, 'o');
  box(g, 0, 0, 32, 2, 'k');
  box(g, 0, 0, 2, 34, 'k'); box(g, 30, 0, 2, 34, 'k');
  box(g, 2, 2, 1, 32, 'S'); box(g, 29, 2, 1, 32, 'S');
  for (let i = 0; i < 5; i++) {
    const y = 16 + i * 6, inset = 4 - i;
    box(g, 3 + inset, y, 26 - inset * 2, 1, 'A');
    box(g, 3 + inset, y + 1, 26 - inset * 2, 1, 'B');
    box(g, 3 + inset, y + 2, 26 - inset * 2, 2, 'W');
    box(g, 3 + inset, y + 4, 26 - inset * 2, 2, 's');
  }
  box(g, 0, 46, 32, 2, 'k');
  return rowsOf(g);
}

// A copper boiler: riveted cylinder, brass dome, gauge, squat legs. The one
// piece of furniture that says Boilerworks at a glance.
function boilerSprite() {
  const g = grid(32, 44, '.');
  // Cylinder: one smooth copper ramp lit from the upper left, hard dark
  // outline both sides. Two brass hoops only — more than that and the body
  // starts reading as wickerwork instead of sheet metal.
  const shade = (t) => t < 0.05 ? 'k' : t < 0.14 ? 'c' : t < 0.34 ? 'C'
    : t < 0.62 ? 'c' : t < 0.90 ? 'm' : 'k';
  for (let y = 11; y <= 37; y++) {
    for (let x = 4; x <= 27; x++) g[y][x] = shade((x - 4) / 23);
  }
  // Domed lid: brass, flattened ellipse sitting on the barrel mouth.
  for (let y = 4; y <= 11; y++) {
    for (let x = 0; x < 32; x++) {
      if (((x - 16) / 13) ** 2 + ((y - 11.5) / 7.5) ** 2 <= 1)
        g[y][x] = y <= 6 ? 'A' : y <= 9 ? 'B' : 'z';
    }
  }
  box(g, 4, 11, 24, 1, 'k');
  for (const y of [18, 30]) {                            // two hoops
    box(g, 3, y, 26, 1, 'A'); box(g, 3, y + 1, 26, 1, 'B'); box(g, 3, y + 2, 26, 1, 'z');
    box(g, 3, y, 1, 3, 'k'); box(g, 28, y, 1, 3, 'k');
  }
  box(g, 4, 37, 24, 1, 'k');
  box(g, 6, 38, 20, 3, 's'); box(g, 6, 38, 20, 1, 'k');  // plinth
  box(g, 6, 41, 20, 1, 'k');
  // pressure gauge on the belly
  box(g, 17, 22, 8, 6, 'z'); box(g, 18, 23, 6, 4, 'A');
  g[24][20] = 'k'; g[25][21] = 'k'; g[24][21] = 'k';
  // stack rising off the lid
  box(g, 7, 0, 5, 8, 'z'); box(g, 8, 0, 2, 8, 'B'); box(g, 6, 0, 7, 2, 'B');
  return rowsOf(g);
}

// Steam vent, INDOOR. The overworld `vent` sprite carries a grass-green base
// row baked into its bottom two rows — dropping it on the cellar's riveted
// plate left a strip of #4-ish green under both plumes, which a cartridge
// would not ship. So the interior gets its own: a brass-lipped grille sunk
// into the steel floor, in IN_PAL, with nothing green anywhere in it.
function ventIndoorSprite() {
  const g = grid(16, 16, '.');
  box(g, 2, 3, 12, 11, 'k');          // the recess it sits in
  box(g, 3, 4, 10, 9, 's');
  box(g, 3, 4, 10, 1, 'z');           // brass lip, lit
  box(g, 4, 4, 8, 1, 'B');
  box(g, 3, 12, 10, 1, 'm');          // lip, shaded
  for (let i = 0; i < 3; i++) {       // grille bars over the dark
    box(g, 4, 6 + i * 2, 8, 1, 'C');
    box(g, 4, 7 + i * 2, 8, 1, 'o');
  }
  box(g, 4, 5, 8, 1, 'o');
  box(g, 2, 13, 12, 1, 'k');
  return rowsOf(g);
}

// Riveted crate.
function crateSprite() {
  const g = grid(16, 16, 'c');
  box(g, 0, 0, 16, 1, 'k'); box(g, 0, 15, 16, 1, 'k');
  box(g, 0, 0, 1, 16, 'k'); box(g, 15, 0, 1, 16, 'k');
  box(g, 1, 1, 14, 1, 'C'); box(g, 1, 1, 1, 14, 'C');
  box(g, 1, 14, 14, 1, 'm'); box(g, 14, 1, 1, 14, 'm');
  box(g, 2, 7, 12, 2, 'z'); box(g, 2, 7, 12, 1, 'B');
  for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) {
    g[y][x] = 'A'; g[y + 1][x] = 'z';
  }
  return rowsOf(g);
}

// ---------------------------------------------------------------------------
// THE BOILERWORKS HATCH — a HOLE IN THE GROUND, not an object standing on it.
//
// 32x48. Read top to bottom it is: the lid thrown back beyond the shaft, the
// far rim, then twenty-eight rows of near-black mouth with three ladder rungs
// in it, then the near rim closest to the camera. The mouth is the biggest
// single element by area, which is the whole trick — an entrance reads as an
// entrance because of the dark, not because of the brass around it.
//
// It is drawn in TWO PIECES (see ENTRANCE_SPLIT): everything above row 26 is
// painted OVER the player, everything below is baked into the ground layer.
// So when Wren walks the 16px in, the lid and the top two thirds of the shaft
// cover him and only his boots are left showing in the hole when the screen
// goes black. Drawn as one sprite he would walk in front of the hole he is
// supposed to be climbing into.
// ---------------------------------------------------------------------------
const HATCH_PAL = {
  B: '#c4a03e', A: '#e8d288', z: '#7c5c1e', m: '#63451f',
  k: '#282828', S: '#2f2315', o: '#000000',
  // shaft: a 4-step steel ramp for the side walls, plus two rung values so
  // the ladder can fade with depth instead of being three identical bars.
  p: '#4a5450', q: '#333c39', n: '#1b211f',
  r: '#96a09a', x: '#5c6763',
};
// Sprite row where an entrance stops being scenery and starts being a hole
// the player is inside. Rows above it are painted after the player; rows
// below are baked into the ground. Chosen so that Wren standing on the
// threshold (feet on the near rim) is entirely below the split and fully
// visible, and Wren 16px further in has everything but his boots covered.
const ENTRANCE_SPLIT = 25;
const HATCH_AT = [32, 76];        // screen B, set into the road's west end
const STAIRS_AT = [192, 8];       // cellar, set into the north wall

// PERSPECTIVE, because the previous hatch was a parallel-sided rectangle with
// three evenly-spaced bright bars in it and read as a brass cabinet full of
// shelves. Everything below is built from two rules, both of which say the
// same thing: FAR IS UP AND SMALL.
//
//   1. Nothing has parallel sides. The lid, the brass frame, the opening and
//      the shaft all taper by 4-6px from the near edge (bottom, rows 41-46,
//      where Wren stands) to the far edge (top, row 10). The same rule already
//      governs stairsSprite() above, whose treads widen toward the camera.
//   2. The shaft's black core is a trapezoid 18px wide at the near lip and
//      6px wide at the far one, so the two side walls are visible as wedges
//      that are five pixels of shaded steel down deep and one pixel at the
//      surface. That wedge is the entire difference between "a hole" and "a
//      dark rectangle".
//
// The ladder then rides the taper: two converging stiles, and rungs whose gaps
// run 6,5,4,3,2 and whose widths shrink from 12px to 3px as they recede, each
// one a value darker than the one below it. A ladder in perspective cannot be
// mistaken for shelving; three identical bars at equal spacing always will be.
const HATCH_W = 28, HATCH_H = 48;
const MOUTH_TOP = 14, MOUTH_BOT = 40;
// [row, colour] — gaps 6,5,4,3,2 going up; nearest is brightest.
const RUNGS = [[38, 'r'], [32, 'x'], [27, 'x'], [23, 'q'], [20, 'q']];
const lerp = (a, b, u) => a + (b - a) * u;

function hatchSprite() {
  const g = grid(HATCH_W, HATCH_H, '.');
  const span = (r) => {                       // outer edges of the brass frame
    const u = (r - 10) / 36;
    return [Math.round(lerp(5, 1, u)), Math.round(lerp(22, 26, u))];
  };
  const core = (r) => {                       // edges of the black shaft
    const u = (r - MOUTH_TOP) / (MOUTH_BOT - MOUTH_TOP);
    return [Math.round(lerp(11, 4, u)), Math.round(lerp(16, 23, u))];
  };
  const run = (y, a, b, ch) => { for (let x = a; x <= b; x++) if (g[y]) g[y][x] = ch; };

  // ---- the lid, thrown back beyond the shaft ------------------------------
  // Barely tapered (2px over 9 rows) so it reads as one flat plate seen nearly
  // edge-on rather than as a stepped plinth, with hinge knuckles along its
  // near edge tying it to the frame.
  const LID = ['z', 'A', 'B', 'B', 'B', 'z', 'B', 'm', 'z'];
  for (let r = 0; r <= 8; r++) {
    const L = Math.round(lerp(7, 6, r / 8)), R = Math.round(lerp(21, 22, r / 8));
    run(r, L, R, LID[r]);
    if (r > 0 && r < 8) { g[r][L] = 'z'; g[r][R] = 'z'; }
  }
  for (const c of [9, 14, 19]) { g[3][c] = 'z'; g[4][c] = 'A'; }   // lid rivets
  for (const c of [8, 13, 18]) {                                   // hinges
    g[8][c] = 'B'; g[9][c] = 'B'; g[9][c + 1] = 'z';
  }
  run(9, 5, 7, 'k'); run(9, 20, 22, 'k');                          // cast shadow

  // ---- brass frame + shaft ------------------------------------------------
  for (let r = 10; r <= 46; r++) {
    const [L, R] = span(r);
    run(r, L, R, 'B');
    g[r][L] = 'z'; g[r][R] = 'z';
  }
  // far rim: three courses, brightest on the leading edge
  for (let r = 10; r <= 13; r++) {
    const [L, R] = span(r);
    run(r, L + 1, R - 1, r === 10 ? 'z' : r === 11 ? 'A' : r === 12 ? 'B' : 'z');
  }
  // near rim: the widest, closest, brightest brass on the sprite
  // 'm' appears on the lid underside only. It is one step off 'z' and every
  // extra row of it pushed a shared brass value over check-shot's 0.5% working
  // -palette threshold; the frame reads the same with two brass darks, not
  // three.
  const NEAR = { 41: 'z', 42: 'B', 43: 'A', 44: 'B', 45: 'z', 46: 'k' };
  for (let r = 41; r <= 46; r++) {
    const [L, R] = span(r);
    run(r, L + 1, R - 1, NEAR[r]);
  }
  // bolt lugs poking out of the frame's near corners — the outline is not
  // allowed to be a plain rounded rectangle.
  for (const [bx, by] of [[1, 42], [24, 42]]) {
    run(by, bx, bx + 2, 'z'); run(by + 1, bx, bx + 2, 'A'); run(by + 2, bx, bx + 2, 'z');
  }

  // ---- the mouth: side walls in perspective, black core -------------------
  for (let r = MOUTH_TOP; r <= MOUTH_BOT; r++) {
    const [L, R] = span(r), [cl, cr] = core(r);
    run(r, L + 2, R - 2, 'o');                    // black everything first
    // left wall: lit at the surface, three values deep into the shaft
    for (let x = L + 2; x < cl; x++) {
      const d = (x - (L + 2)) / Math.max(1, cl - (L + 2));
      g[r][x] = d < 0.34 ? 'p' : d < 0.7 ? 'q' : 'n';
    }
    // right wall: same wedge, one step darker — the light is up and left
    for (let x = R - 2; x > cr; x--) {
      const d = ((R - 2) - x) / Math.max(1, (R - 2) - cr);
      g[r][x] = d < 0.34 ? 'q' : 'n';
    }
    g[r][L + 1] = 'k'; g[r][R - 1] = 'k';         // inner lip shadow
  }
  // ---- the ladder ---------------------------------------------------------
  for (let r = 17; r <= 39; r++) {                // stiles, converging upward
    const [cl, cr] = core(r);
    g[r][cl + 1] = r >= 30 ? 'x' : 'q';
    g[r][cr - 1] = r >= 30 ? 'q' : 'n';
  }
  // Rungs stop two pixels short of each stile, so there is black either side
  // of every bar. A bar that runs wall-to-wall is a shelf; a bar slung between
  // two rails is a rung.
  for (const [r, ch] of RUNGS) {
    const [cl, cr] = core(r);
    run(r, cl + 3, cr - 3, ch);
    if (ch === 'r') run(r + 1, cl + 3, cr - 3, 'q');   // the nearest one casts
  }
  return rowsOf(g);
}

// THE CHAPTER ITEM — the Bellows Cuff. Original art.
//
// The previous version was sixteen rows of dark-brown-and-gold horizontal
// stripes inside a rounded rectangle: one shape idea (a box), one value band,
// and a silhouette that could equally have been a crate or a stack of
// pancakes. ALttP item sprites are readable as a black shape on white — the
// bow's curve, the hookshot's chain — so this one is built from a silhouette
// first: a NOZZLE, a narrow throat, and a flared cuff. Narrow-wide-narrow-wide
// top to bottom, with the throat and bell breaking clear of the cuff's block.
//
// The value range is deliberately violent: the bore is #120c08 (luma 0.06) and
// the bell rim is #fdf3c8 (luma 0.96), against the old sprite's 0.29-0.86.
// The bottom three rows are the darkest thing on the sprite ON PURPOSE — that
// is where Wren's light-skinned fists close on it, and a fist drawn over brass
// of its own value disappears.
const CUFF_PAL = {
  o: '#120c08',   // outline / the bore
  m: '#3a2410',   // leather bellows fold
  z: '#6a4e18',   // brass shadow
  C: '#a06a30',   // copper
  B: '#c99a34',   // brass
  A: '#e6cc72',   // brass light
  W: '#fdf3c8',   // rim highlight
};
// ASYMMETRY IS DELIBERATE. A nozzle centred on the top turns the sprite into a
// chalice — bell, stem, foot — and a trophy is no more a Bellows Cuff than a
// crate was. So the nozzle rises off the LEFT shoulder and a pressure knob
// sits on the right: the outline is an L with a lump on it, which is machinery.
//
// AND IT IS A GAUNTLET, WITH THE CUFF OPEN. The previous pass put nine of
// sixteen rows into an unbroken 14-16 px rectangle with ZERO interior negative
// space: black on white it was a box with a chimney, and in colour it read as a
// brass throne or a table lamp. Value work was never the problem (luma spread
// 13-241, which is excellent) — the SHAPE was. Every ALttP item carries a hole
// or a hard concavity: the bow's string gap, the hookshot's hook, the lamp's
// handle loop, and the Power Glove, which is the closest cousin this item has.
// So the sprite says what the copy says — "a fist of wind in a brass sleeve":
//
//   rows 0-7   a clenched brass FIST. Three knuckles across the top with two
//              notches cut between them, finger seams a pixel wide, a thumb
//              that exists on the LEFT ONLY, and a wrist that narrows to 8px —
//              a waist, which is the strongest silhouette event a 16x16 has.
//   rows 8-13  the CUFF, flared wider than the fist, with its mouth drawn as
//              TRANSPARENT pixels: the world — and during the item-get, the
//              burst's pale core — is visible straight THROUGH the sprite.
//   row 6-7    a pressure vent stub on the RIGHT only, so the outline cannot be
//              mistaken for a symmetrical object.
//
// The bottom three rows stay the darkest thing on the sprite ON PURPOSE — that
// is where Wren's light-skinned fists close on it, and a fist drawn over brass
// of its own value disappears. Those fists cover rows 11-15 at the corners, so
// the cuff mouth sits at rows 9-11 where it survives into the hero frame.
const CUFF = [
  '..oo.oo.oo......',   //  0  three knuckles — two notches in the outline
  '.oBAooBAooBAo...',   //  1
  '.oBAABBAABBAAo..',   //  2  fingers, the seams between them 1px dark
  'ooWBAABBAABBAo..',   //  3
  'oBAWBAAAAAAABo..',   //  4  ---- the thumb, on the LEFT only ---------------
  'oBAAWBAAAAAABo..',   //  5
  'ooBAAWBAAAABo.oo',   //  6  ...against the pressure vent on the RIGHT only
  '..ooWBAAAABooBWo',   //  7  the wrist narrows: a waist in the silhouette
  '.oWAAAAAAAAAABWo',   //  8  the cuff flares out under it
  'oWAz........zABo',   //  9  ---- THE CUFF MOUTH: you see through it --------
  'oBAz........zABo',   // 10
  'oBAzz......zzABo',   // 11
  'oWAzzzzzzzzzzAWo',   // 12  the far inside wall, in shadow
  'oWAAAAAAAAAAAAWo',   // 13  the cuff lip, brightest brass on the sprite
  '.ozmmBAAAABmmzo.',   // 14  ---- darkest rows: the fists close here --------
  '..oooooooooooo..',   // 15  foot, stepped in 2px either side
];

// ===========================================================================

export default class TransitionsScene {
  async init(engine) {
    const { tiles, sprites } = makeTileset();
    this.tiles = tiles;
    this.sprites = sprites;
    this.engine = engine;

    this.inTiles = {
      floor: [0, 1, 2, 3].map(v => makeSprite(floorTile(v), IN_PAL)),
      grate: makeSprite(grateTile(), IN_PAL),
      wface: makeSprite(wallFace(false), IN_PAL),
      wpil: makeSprite(wallFace(true), IN_PAL),
      wtop: makeSprite(wallTop(false), IN_PAL),
      wtopLit: makeSprite(wallTop(true), IN_PAL),
      wleft: makeSprite(wallSide(false, false), IN_PAL),
      wleftPil: makeSprite(wallSide(false, true), IN_PAL),
      wright: makeSprite(wallSide(true, false), IN_PAL),
      wrightPil: makeSprite(wallSide(true, true), IN_PAL),
    };
    this.stairs = makeSprite(stairsSprite(), IN_PAL);
    this.boiler = makeSprite(boilerSprite(), IN_PAL);
    this.crate = makeSprite(crateSprite(), IN_PAL);
    this.hatch = makeSprite(hatchSprite(), HATCH_PAL);
    this.cuff = makeSprite(CUFF, CUFF_PAL);
    this.ventIn = makeSprite(ventIndoorSprite(), IN_PAL);

    this.sky = new SkyState(0);
    this.tr = new Transitions({
      rand: () => engine.rand(),
      filter: (cv) => this.sky.tintFrame(cv),
      onSfx: (name) => { this.lastSfx = name; },
      // Ground-lurch grit is only allowed to puff off ground. On the rim screen
      // half the deck is cliff face, open sky column and cloud sea, and the
      // previous pass spawned there — warm tan crumbs arcing in mid-air over a
      // three-thousand-foot drop. The tilemap already knows: everything the
      // player cannot stand on is a solid tile.
      walkable: (x, y) => {
        const m = this.room && this.room.map;
        if (!m) return true;
        return !m.isSolid(Math.floor(x / TILE), Math.floor(y / TILE));
      },
    });
    this.hud = new HUD({ maxHearts: 3, halves: 6, cogs: 24, keys: 0, bombs: 0, steam: 0.55 });

    this.rooms = {
      a: this.buildOverworld(MAP_A, roadA(), darkA(), DECOR_A, TREES_A, FLOWERS_A, PIPES_A, 'straight'),
      b: this.buildOverworld(MAP_B, roadB(), darkB(), DECOR_B, TREES_B, FLOWERS_B, PIPES_B, 'corner'),
      c: this.buildCellar(),
      d: this.buildOverworld(MAP_D, roadD(), darkD(), DECOR_D, TREES_D, FLOWERS_D, PIPES_B, 'east'),
    };
    this.room = this.rooms.a;

    this.player = new Player(196, 84);
    this.player.dir = 'right';

    this.hold = null;              // scripted direction
    this.script = this.beats();
    this.step = this.script.next().value;
    this.stepT = 0;
    this.input = {
      held: (k) => this.hold === k || this.engine.input.held(k),
      hit: (k) => this.engine.input.hit(k),
    };
  }

  // ---------------------------------------------------------------- build --

  hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }
  inSet(set, c, r) { return set.has(`${c},${r}`); }

  grassName(map, dark, c, r) {
    const h = this.hash(c, r);
    const near = this.inSet(dark, c - 1, r) || this.inSet(dark, c + 1, r) ||
      this.inSet(dark, c, r - 1) || this.inSet(dark, c, r + 1);
    if (near) return ['grass3', 'grass4', 'grass5', 'grass6'][h % 4];
    switch (h % 8) {
      case 1: return 'grass3';
      case 3: return 'grass4';
      case 5: return 'grass5';
      case 7: return 'grass6';
      default: return h % 16 < 8 ? 'grass' : 'grass2';
    }
  }

  regionTile(map, set, prefix, c, r) {
    const grassAt = (cc, rr) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS &&
      (map[rr][cc] === '.' || map[rr][cc] === 'I') && !this.inSet(set, cc, rr);
    const gN = grassAt(c, r - 1), gS = grassAt(c, r + 1);
    const gW = grassAt(c - 1, r), gE = grassAt(c + 1, r);
    const v = (c + r) % 2 ? '2' : '';
    if (gN && gW) return `${prefix}_nw`;
    if (gN && gE) return `${prefix}_ne`;
    if (gS && gW) return `${prefix}_sw`;
    if (gS && gE) return `${prefix}_se`;
    if (gN) return `${prefix}_n${v}`;
    if (gS) return `${prefix}_s${v}`;
    if (gW) return `${prefix}_w${v}`;
    if (gE) return `${prefix}_e${v}`;
    if (grassAt(c - 1, r - 1)) return `${prefix}_inw`;
    if (grassAt(c + 1, r - 1)) return `${prefix}_ine`;
    if (grassAt(c - 1, r + 1)) return `${prefix}_isw`;
    if (grassAt(c + 1, r + 1)) return `${prefix}_ise`;
    return prefix === 'path' && (c + r) % 2 ? 'path_c2' : `${prefix}_c`;
  }

  buildOverworld(map, road, dark, decor, trees, flowers, pipes, mode) {
    const rim = mode === 'corner';
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const ctx = cv.getContext('2d');
    const skyCv = document.createElement('canvas');
    skyCv.width = WIDTH; skyCv.height = HEIGHT;
    const sctx = skyCv.getContext('2d');
    const tmap = new Tilemap(COLS, ROWS);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let name = 'sky';
        if ((c * 5 + r * 3) % 11 === 3) name = 'sky2';
        sctx.drawImage(this.tiles[name], c * TILE, r * TILE);
        const ch = map[r][c];
        let tile = null, solid = false;
        if (ch === '.') {
          tile = this.inSet(road, c, r) ? this.regionTile(map, road, 'path', c, r)
            : this.inSet(dark, c, r) ? this.regionTile(map, dark, 'dk', c, r)
              : this.grassName(map, dark, c, r);
        } else if (ch === 'I') {
          // The authored island is one 240x192 rock mass: cols 0-11 are a
          // straight south coast, cols 12-14 round into the southeast corner
          // and run up the east rim. A screen showing more coast than that
          // repeats another stretch of the SAME rock rather than tiling one
          // sawtooth: 'straight' shifts 8 cols west (their silhouettes meet
          // within 4px), 'east' wraps the rim every 8 rows — rows 8-11 are
          // where the rock turns the corner, so a straight rim must not use
          // them.
          const bc = mode === 'straight' && c >= 12 ? c - 8 : c;
          const br = mode === 'east' ? r % 8 : r;
          tile = `isle_${bc}_${br}`;
          solid = true;
        } else if (ch === 'U') { tile = CLOUD_TOPS[c]; solid = true; }
        else if (ch === 'V') { tile = 'cloud_mid'; solid = true; }
        else { solid = true; }                                  // 'K' open sky
        if (tile && this.tiles[tile]) ctx.drawImage(this.tiles[tile], c * TILE, r * TILE);
        tmap.set(c, r, tile, solid);
      }
    }
    for (const [name, x, y] of trees) {
      ctx.drawImage(this.sprites[name], x, y);
      tmap.addObstacle(null, x, y, { x: x + 14, y: y + 30, w: 36, h: 28 }, y + 58);
    }
    for (const [name, c, r] of decor) {
      ctx.drawImage(this.sprites[name], c * TILE, r * TILE);
      if (/^(bush|rock|post|vent)/.test(name)) {
        tmap.addObstacle(null, c * TILE, r * TILE,
          { x: c * TILE + 2, y: r * TILE + 4, w: 12, h: 11 }, r * TILE + 16);
      }
    }
    for (const [name, x, y] of pipes) ctx.drawImage(this.sprites[name], x, y);
    // The Boilerworks hatch: the mouth is a hole in the ground, so only its
    // NEAR half is baked into the layer. The far half goes on `over`, which
    // is painted after the player — that is what swallows him on the way in.
    const over = [];
    if (rim) {
      this.bakeEntrance(ctx, this.hatch, HATCH_AT[0], HATCH_AT[1]);
      over.push([this.hatch, HATCH_AT[0], HATCH_AT[1]]);
    }
    const vents = decor.filter(d => d[0] === 'vent').map(d => [d[1] * TILE, d[2] * TILE]);
    return { kind: 'over', layer: cv, sky: skyCv, map: tmap, flowers, rim, vents, over };
  }

  /** Bake the near (below-split) half of an entrance sprite into a layer. */
  bakeEntrance(ctx, spr, x, y) {
    const h = spr.height - ENTRANCE_SPLIT;
    ctx.drawImage(spr, 0, ENTRANCE_SPLIT, spr.width, h, x, y + ENTRANCE_SPLIT, spr.width, h);
  }

  /** Draw the far (above-split) half of an entrance sprite, over the player. */
  drawEntranceOver(ctx, spr, x, y, indoor) {
    const img = this.sky.tint(spr, indoor);
    ctx.drawImage(img, 0, 0, spr.width, ENTRANCE_SPLIT, x, y, spr.width, ENTRANCE_SPLIT);
  }

  buildCellar() {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const ctx = cv.getContext('2d');
    const tmap = new Tilemap(COLS, ROWS);
    const GRATES = new Set(['4,4', '11,9']);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const h = this.hash(c, r);
        let img = this.inTiles.floor[h % 4], solid = false;
        if (r === 0) { img = this.inTiles.wtop; solid = true; }
        else if (r === 1) {
          img = (c % 5 === 2) ? this.inTiles.wpil : this.inTiles.wface; solid = true;
        } else if (r === 12) { img = this.inTiles.wtopLit; solid = true; }
        else if (r === 13) { img = this.inTiles.wtop; solid = true; }
        else if (c === 0) {
          img = (r % 4 === 3) ? this.inTiles.wleftPil : this.inTiles.wleft; solid = true;
        } else if (c === 15) {
          img = (r % 4 === 3) ? this.inTiles.wrightPil : this.inTiles.wright; solid = true;
        } else if (GRATES.has(`${c},${r}`)) img = this.inTiles.grate;
        ctx.drawImage(img, c * TILE, r * TILE);
        tmap.set(c, r, 'in', solid);
      }
    }
    // Stairs up, set into the north wall; the shaft is solid, the foot
    // walkable. Same two-piece treatment as the hatch: the dark upper shaft
    // is painted over Wren so the stairwell takes him.
    this.bakeEntrance(ctx, this.stairs, STAIRS_AT[0], STAIRS_AT[1]);
    for (let c = 12; c <= 13; c++) for (let r = 0; r <= 2; r++) tmap.set(c, r, 'in', true);
    // Pipework: risers down the wall face, a header along it.
    for (const x of [40, 152]) {
      ctx.drawImage(this.sprites.pipe_v, x, 16);
      ctx.drawImage(this.sprites.pipe_cap, x, 2);
    }
    ctx.drawImage(this.sprites.pipe_h, 88, 20);
    ctx.drawImage(this.sprites.pipe_h, 104, 20);
    ctx.drawImage(this.sprites.pipe_end, 120, 20);
    // Furniture: the boiler and a stack of crates.
    ctx.drawImage(this.boiler, 48, 36);
    tmap.addObstacle(null, 48, 36, { x: 51, y: 60, w: 26, h: 22 }, 80);
    ctx.drawImage(this.crate, 128, 48);
    ctx.drawImage(this.crate, 144, 48);
    ctx.drawImage(this.crate, 136, 32);
    tmap.addObstacle(null, 128, 48, { x: 128, y: 48, w: 32, h: 16 }, 64);
    // Steam main running across the floor from the boiler to the east wall.
    for (let x = 80; x < 176; x += 16) ctx.drawImage(this.sprites.pipe_h, x, 104);
    ctx.drawImage(this.sprites.pipe_end, 176, 104);
    tmap.addObstacle(null, 80, 104, { x: 80, y: 106, w: 112, h: 12 }, 118);
    ctx.drawImage(this.ventIn, 64, 160);
    ctx.drawImage(this.ventIn, 176, 128);
    tmap.addObstacle(null, 64, 160, { x: 66, y: 164, w: 12, h: 11 }, 176);
    tmap.addObstacle(null, 176, 128, { x: 178, y: 132, w: 12, h: 11 }, 144);
    return {
      kind: 'in', layer: cv, sky: null, map: tmap, indoor: true,
      vents: [[64, 160], [176, 128]],
      over: [[this.stairs, STAIRS_AT[0], STAIRS_AT[1]]],
    };
  }

  // ---------------------------------------------------------------- script --

  * beats() {
    const P = this.player;
    yield ['wait', 24];

    // 1 — SCREEN SCROLL -----------------------------------------------------
    // `from`/`to` are FUNCTIONS, not snapshots, so both screens keep animating
    // while the camera slides (see Transitions.scroll).
    yield ['walk', 'right', () => P.x >= 240];
    this.tr.scroll({
      dir: 'right', player: P,        // walk-in rate defaults to WALK_SPEED
      from: (c) => this.paintScreen(c, this.rooms.a),
      to: (c) => this.paintScreen(c, this.rooms.b),
      onDone: () => { this.room = this.rooms.b; },
    });
    yield ['busy'];
    yield ['wait', 16];

    // 2 — DOOR: down the Boilerworks hatch ----------------------------------
    // The fade walks him a full tile into the mouth while it dims, and the
    // hatch's far half is painted over him, so the hole takes him.
    yield ['walk', 'down', () => P.y >= 101];
    yield ['walk', 'right', () => P.x >= 38];
    this.tr.fade({
      player: P, dir: 'up', dist: 16,
      onSwap: () => { this.room = this.rooms.c; P.x = 116; P.y = 140; P.dir = 'down'; },
    });
    yield ['busy'];
    yield ['wait', 26];

    // ...and a lurch while we are under the deck, with ceiling grit
    this.tr.lurch({ power: 4, frames: 8, dust: 'ceiling', count: 72 });
    yield ['wait', 78];

    // 2b — STAIRCASE back up ------------------------------------------------
    yield ['walk', 'right', () => P.x >= 200];
    yield ['walk', 'up', () => P.y <= 34];
    this.tr.stairs({
      dir: 'up', exitDir: 'down', player: P, dist: 16,
      onSwap: () => { this.room = this.rooms.b; P.x = 38; P.y = 85; },
    });
    yield ['busy'];

    // 3 — OUT OF THE HATCH --------------------------------------------------
    // EAST FIRST, then north. He has just stepped DOWN out of the hatch onto
    // its near lip; walking north here would march him straight back into the
    // mouth he just climbed out of, which undercuts the whole transition. So
    // he clears the hatch's 28px footprint eastward before he turns up onto
    // the road.
    yield ['walk', 'right', () => P.x >= 84];
    yield ['walk', 'up', () => P.y <= 86];
    yield ['wait', 20];

    // 4 — ITEM GET ----------------------------------------------------------
    // Before the sky goes, not after. The raised item is the one hero frame in
    // the piece and it is worth nothing graded down to stage-4 dusk; ALttP's
    // item hold is always the brightest thing on the screen. The burst behind
    // it is drawn outside the ambient tint for the same reason.
    // Authored in sentence case, at this window's measure. The copy used to be
    // SHOUTED and hand-broken for a 208px box that no longer exists; dialog.js
    // has a shim that puts the case back, but the shim is for copy this file
    // does not own. This file owns this copy, so it is simply written right.
    this.tr.getItem({
      img: this.cuff, player: P, auto: 170,
      lines: ['You got the Bellows Cuff.', 'A fist of wind in a brass sleeve.',
        'Press B to shove.'],
    });
    yield ['busy'];
    yield ['wait', 30];

    // 5 — THE SKY GOES ------------------------------------------------------
    // East along the road while the isle drops through all five palettes.
    this.sky.setStage(1, { frames: 70 });
    yield ['walk', 'right', () => P.x >= 148];
    yield ['wait', 56];
    this.sky.setStage(2, { frames: 70 });
    yield ['wait', 90];
    this.sky.setStage(3, { frames: 70 });
    yield ['walk', 'right', () => P.x >= 168];
    yield ['wait', 70];
    this.sky.setStage(4, { frames: 80 });
    yield ['wait', 96];

    // 6 — THE LURCH ---------------------------------------------------------
    // 8 frames, one axis, 4 -> 3 -> 2 -> 1 -> 0. The dust outlives it by a
    // second; the jolt itself is over before you can focus on it.
    this.tr.lurch({ power: 4, frames: 8, dust: 'ground', count: 64 });
    yield ['wait', 66];

    // 7 — SCREEN SCROLL, VERTICAL -------------------------------------------
    // Same hardware scroll on the other axis: 224px in 28 frames, so the
    // pixels-per-frame rate is identical to the horizontal slide's 256/32.
    yield ['walk', 'left', () => P.x <= 124];
    yield ['walk', 'up', () => P.y <= -10];
    this.tr.scroll({
      dir: 'up', player: P,
      from: (c) => this.paintScreen(c, this.rooms.b),
      to: (c) => this.paintScreen(c, this.rooms.d),
      onDone: () => { this.room = this.rooms.d; },
    });
    yield ['busy'];
    yield ['walk', 'up', () => P.y <= 150];
    yield ['wait', 40];

    // 8 — PLAIN DOOR FADE, at the bottom of the fall ------------------------
    // No walk-in this time: the bare 8/3/8 fade, and it lands in the
    // Boilerworks at stage 4 to show what `indoor` does. The interior only
    // travels 60% of the way to the outdoor column, so the isle's fall reads
    // on the plate floor without dropping it into the black the sky is in.
    this.tr.fade({
      onSwap: () => { this.room = this.rooms.c; P.x = 116; P.y = 140; P.dir = 'down'; },
    });
    yield ['busy'];
    yield ['wait', 200];
  }

  runScript() {
    if (!this.step) return;
    const [kind, a, b] = this.step;
    let done = false;
    this.hold = null;
    if (kind === 'wait') done = ++this.stepT >= a;
    else if (kind === 'busy') done = !this.tr.busy && this.stepT++ > 0;
    else if (kind === 'walk') { this.hold = a; done = b(); }
    if (done) {
      this.hold = null;
      this.stepT = 0;
      const n = this.script.next();
      this.step = n.done ? null : n.value;
    }
  }

  // ---------------------------------------------------------------- update --

  update(dt, engine) {
    this.tr.update(engine.input, engine);
    this.sky.update();
    if (this.tr.frozen) return;
    this.runScript();
    this.player.update(this.input, this.room.map);
  }

  // ------------------------------------------------------------------ draw --

  // Paint one screen's GROUND (no player, no HUD, no over-layer).
  //
  // `room.indoor` routes the whole interior through the reduced stage grade:
  // the Boilerworks is lit by its own boilers, so the isle's fall cools it
  // without dropping the floor into near-black along with the sky.
  paint(ctx, room) {
    const t = this.engine.frame;
    const din = !!room.indoor;
    if (room.sky) {
      ctx.drawImage(this.sky.tint(room.sky), 0, 0);
      // Cloud banks drifting below the rim. The wind scales with the fall,
      // so by stage 4 the deck is racing past.
      const c1 = this.sky.tint(this.sprites.cloud1);
      const c2 = this.sky.tint(this.sprites.cloud2);
      const w1 = c1.width + WIDTH, w2 = c2.width + WIDTH;
      const at = (band, phase, w) =>
        Math.round(WIDTH - ((this.sky.drift(band) + phase) % w));
      ctx.drawImage(c1, at(0, 0, w1), 178);
      ctx.drawImage(c2, at(1, 140, w2), 150);
      ctx.drawImage(c2, at(0, 60, w2), 164);
      ctx.drawImage(c2, at(3, 260, w2), 40);
      ctx.drawImage(c1, at(2, 190, w1), 88);
    }
    ctx.drawImage(this.sky.tint(room.layer, din), 0, 0);
    if (room.kind === 'over') {
      const sway = (t % 60) < 30 ? '1' : '2';
      for (const [color, x, y] of room.flowers)
        ctx.drawImage(this.sky.tint(this.sprites[`flower_${color}${sway}`]), x, y);
    }
    for (const [vx, vy] of room.vents) this.plume(ctx, vx, vy, t + vx, din);
  }

  /** Everything painted AFTER the player: the far half of any entrance. */
  drawOver(ctx, room) {
    if (!room.over) return;
    for (const [spr, x, y] of room.over)
      this.drawEntranceOver(ctx, spr, x, y, !!room.indoor);
  }

  /** Ground + over-layer with nothing between: what a scroll slides. */
  paintScreen(ctx, room) {
    this.paint(ctx, room);
    this.drawOver(ctx, room);
  }

  plume(ctx, x, y, t, indoor) {
    for (const off of [0, 36]) {
      const cyc = (t + off) % 72;
      const phase = Math.floor(cyc / 24);
      const rise = Math.floor((cyc % 24) / 8);
      ctx.drawImage(this.sky.tint(this.sprites[`steam${phase + 1}`], indoor),
        x + (off ? 2 : 0), y - 6 - phase * 5 - rise);
    }
  }

  drawWorld(ctx) {
    this.paint(ctx, this.room);
    if (!this.tr.posing) {
      const p = this.player;
      const ox = Math.round(p.x) - 12, oy = Math.round(p.y) - 8;
      if (!this._pbuf) {
        this._pbuf = document.createElement('canvas');
        this._pbuf.width = 40; this._pbuf.height = 44;
      }
      const c = this._pbuf.getContext('2d');
      c.clearRect(0, 0, 40, 44);
      c.save(); c.translate(-ox, -oy); p.draw(c); c.restore();
      ctx.drawImage(this.sky.tintFrame(this._pbuf, !!this.room.indoor), ox, oy);
    }
    this.drawOver(ctx, this.room);
  }

  draw(ctx, engine) {
    this.tr.render(ctx, (c) => this.drawWorld(c), { ui: (c) => this.hud.draw(c) });
  }
}
