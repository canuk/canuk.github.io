// Cogwick Hollow's people, their props, and the talk trigger.
//
// SPRITES: 16x24 like Wren, 3/4 top-down, dark *coloured* outlines (never pure
// black), 3-shade ramps per material, <=15 colours per villager (SNES 4bpp).
// Each villager reads at 16px by SILHOUETTE, and the difference is POSTURE and
// OUTLINE, not palette. Colour cannot carry a cast: four bodies with the same
// row-width profile in four hues are one puppet with four paint jobs, and that
// is exactly what a grayscale conversion exposes. The four profiles here, as
// per-row ink spans measured off the source (see the widths noted inline):
//   Pell    — INVERTED TRAPEZOID. 16 across the shoulders (the only villager
//             who fills the cell), 14 at the ribs, 12 at the belt, feet 12
//             apart. Flat cap whose brim overhangs the head, beard under a
//             moustache, a rope coil on the chest with a real hole in it.
//   Hesper  — PEAR, the exact opposite of Pell. 10 shoulders under a light
//             shoulder-seam row, waist ties, then the apron flaring to a 14px
//             hip and drawing back in over boots that stand 8 apart. Two rows
//             shorter than Pell. Brass spectacles with a nose bridge.
//   Marla   — SEATED AND HUNCHED. No neck row at all: the coat shoulders come
//             up either side of her jaw and swallow it, asymmetrically, which
//             is the one step in the outline nobody else has. Torso 13, then a
//             12px hem, then the CRATE she is sitting on, 16 across for the
//             bottom four rows with her boots hanging over its front face — she
//             is the only villager whose widest row is her lowest. The sling is
//             ONE unbroken diagonal off the far shoulder that fans into a
//             cradle and curves back in at the bottom, and her wrist crosses
//             into it from the left with no red on the outboard side.
//   Tam     — CHILD PROPORTION: a 10px head on a 10px torso, where the adults
//             are 8px heads on 12-16px bodies. Two hands grip the well rim
//             either side of his hips, 2px outboard of the tunic, which is
//             what turns the box into a torso. 21 rows tall to Pell's 23.
//
// IDLE: two frames. Standing villagers breathe with bobHead(), which slides
// the head band down one pixel and lets the neck row get eaten by the collar —
// the same trick the SNES used for parked NPCs. Tam gets two hand-authored leg
// frames because his idle is a real motion, not a breath.
//
// TALK: facingTarget() projects a probe point out of Wren's feet box in his
// facing direction; whichever entity's footprint contains it answers. NPCs turn
// to look at him first (unless they're sitting), then talk.
import { makeSprite, flipH } from '../sprites.js';

// ---------------------------------------------------------------------------
// Sprite authoring helpers
// ---------------------------------------------------------------------------
const W = 16, H = 24;

function grid(rows, pal, name) {
  if (rows.length !== H) throw new Error(`${name}: ${rows.length} rows, want ${H}`);
  rows.forEach((r, i) => {
    if (r.length !== W) throw new Error(`${name} row ${i}: ${r.length} cols, want ${W}`);
    for (const ch of r) {
      if (ch !== '.' && !pal[ch]) throw new Error(`${name} row ${i}: no palette '${ch}'`);
    }
  });
  return makeSprite(rows, pal);
}

// Breathe frame: slide rows [top..bottom] down one pixel. The bottom row of
// the band (a neck / collar row) is absorbed, so the head settles a pixel into
// the shoulders and rises again next frame.
function bobHead(rows, top, bottom) {
  const out = rows.slice();
  for (let i = bottom; i > top; i--) out[i] = rows[i - 1];
  out[top] = '.'.repeat(W);
  return out;
}

// Ground shadow: a DITHERED blob in one flat colour, the way the SNES faked
// translucency. An alpha blob would mint a fresh blended colour for every tile
// it lands on and blow the screen's colour budget.
const SHADOW = makeSprite([
  '..#.#.#...',
  '.#.#.#.#..',
  '..#.#.#...',
], { '#': '#2a2430' });

// One SHARED villager family palette. Every Cogwick face uses the same three
// skin tones, the same outline, the same leather and the same boot black, so
// the whole cast costs a fraction of a full 15-colour slot each — which is how
// a SNES cartridge could afford four people on one screen.
const OUT = '#1e1a22';                    // the single villager outline
const SKIN = { S: '#f0c098', s: '#c08a5c', d: '#8a5c38' };
const LEATHER = { L: '#b07a42', l: '#7a4c22' };
const BOOT = '#2e2620';
const BOOT_HI = '#4a4038';

// ---------------------------------------------------------------------------
// DOCKHAND PELL — widest man on the isle. Brimmed flat cap, beard under a
// moustache, a coil of rope on his chest.
// ---------------------------------------------------------------------------
const PELL_PAL = {
  o: OUT, ...SKIN, K: BOOT,
  C: '#5d86b4', c: '#33547c',            // cap crown / brim
  N: '#c86838', n: '#8e4420',            // rust beard light / dark
  J: '#86b0d4', j: '#5885b0', e: '#345a80', // jersey ramp
  R: '#f0d89c', q: '#a08a4e',            // rope strand light / dark
  T: LEATHER.l, t: BOOT_HI,              // canvas trousers + shade
};

// Pell's silhouette is an INVERTED TRAPEZOID: 16px across the shoulders — the
// full width of the cell, the only villager who fills it — stepping down to 14
// at the ribs and 12 at the belt. That taper is the whole read. A body that is
// the same width from armpit to hip is a rectangle with a head on it, and four
// rectangles is what the last pass shipped.
const PELL_DOWN = [
  '................',
  '...oooooooooo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCCo..',
  '.occcccccccccco.',   // brim, wider than the head
  '..oooooooooooo..',
  '...oSSSSSSSSo...',
  '...oSoSSSSoSo...',
  '...oSnnnnnnSo...',   // moustache
  '...onNNNNNNno...',   // beard
  '....onnnnnno....',
  'oojjjjjjjjjjjjoo',   // 16 — the widest shoulders on the isle
  'oJjjRRRRjjjjjjJo',   // rope coil worn on the chest: a torus with a hole
  'oJjRqooqRjjjjjJo',
  '.oJRqooqRjjjjJo.',   // 14 — ribs
  '.oJqqooqqjjjjJo.',
  '.oSjqqqqjRjjjSo.',   // ...and the strand end hanging off it
  '..oeejjjjjjeeo..',   // 12 — belt
  '..oTTTTooTTTTo..',
  '..oTTTTooTTTTo..',
  '..oTtttooTttto..',
  '..oKKKKooKKKKo..',
  '..oKtttooKttto..',
  '..oooooooooooo..',
];

const PELL_UP = [
  '................',
  '...oooooooooo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCCo..',
  '.occcccccccccco.',
  '..oooooooooooo..',
  '...onnnnnnnno...',
  '...onNNNNNNno...',
  '...onNNNNNNno...',
  '...onnnnnnnno...',
  '....onnnnnno....',
  'oojjjjjjjjjjjjoo',
  'oJjjjjjjjjjjjjJo',
  'oJjjjjjRqRjjjjJo',   // the coil showing over his shoulder
  '.oJjjjjqRqjjjJo.',
  '.oJjjjjRqRjjjJo.',
  '.oSjjjjqRqjjjSo.',
  '..oeejjjjjjeeo..',
  '..oTTTTooTTTTo..',
  '..oTTTTooTTTTo..',
  '..oTtttooTttto..',
  '..oKKKKooKKKKo..',
  '..oKtttooKttto..',
  '..oooooooooooo..',
];

const PELL_LEFT = [
  '................',
  '...oooooooooo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCCo..',
  '.occcccccccccco.',
  '..oooooooooooo..',
  '...oSSSSSSSno...',
  '...oSoSSSSnno...',
  '...oSnnnnnnno...',
  '...onNNNNnnno...',
  '....onnnnnno....',
  '.oojjjjjjjjjoo..',   // 13 in profile — a body is narrower side-on
  '.oJjRRRRRjjjJo..',
  '.oJRqooqRjjjJo..',
  '..oJRqooqRjjJo..',   // 12
  '..oJqqooqqjjJo..',
  '..oSqqqqqRjjSo..',
  '...oeejjjjjeo...',   // 10
  '...oTTTToTTTo...',
  '...oTTTToTTTo...',
  '...oTtttoTtto...',
  '...oKKKKoKKKo...',
  '...oKtttoKtto...',
  '...oooooooooo...',
];

// ---------------------------------------------------------------------------
// GAFFER MARLA — seated at the sealed hatch, arm strapped, small white bun
// ---------------------------------------------------------------------------
const MARLA_PAL = {
  o: OUT, ...SKIN, ...LEATHER,
  W: '#f0ece0', w: '#b0a898',               // white hair light / shade
  V: '#a09a5e', v: '#787230',               // oiled canvas coat ramp
  R: '#e0503a', r: '#a02c22',               // sling — her one loud colour
  K: BOOT, k: BOOT_HI,
};

// Marla is HUNCHED and SEATED, and both have to be in the sprite because she
// is never guaranteed a prop to sit on: the scene that owns the Boilerworks
// screen places her, not this file. So she brings her own seat. There is no
// neck row — the coat shoulders come up either side of her jaw at row 8 and
// swallow it, asymmetrically, which is the one step in the outline nobody else
// has — and under the coat hem at rows 19-23 is a low timber crate: its two
// corners show OUTBOARD of her lap at row 19 (you cannot see the corners of a
// box you are standing behind), its lit top edge runs the full 16px at row 20,
// and her boots hang down OVER its front face at rows 21-22 with the timber
// still visible at cols 1, 7-8 and 14 between and beside them. Boots occluding
// the face is the whole proof of depth — the same trick that turned Tam from a
// boy behind a crate into a boy on a well rim.
//
// THE SLING IS ONE CONTINUOUS BAND, AND ITS OUTLINE IS BROKEN BY THE WRIST.
// Both halves of that sentence are load-bearing, because the previous version
// failed on the first: a 2px vertical strap that stopped dead on a 6px
// horizontal bar is an L, and an L with a handle reads as a ladle no matter
// what colour it is. So the strap now never stops. It leaves the far shoulder
// at row 9 (col 12), walks a pixel left per row — 10,11 / 9,10 — and at row 12
// FANS to three pixels (7,8,9) as it becomes the mouth of the cradle. The
// cradle runs 6-9 / 4-9 / 4-9 and then DRAWS BACK IN to 5-8 in the dark red at
// row 16, so the bottom is a curve and the whole shape hangs off the shoulder
// instead of sitting on the belt. Silhouetted in black it is a diagonal that
// swells, which is what a slung arm looks like at 16px.
// The wrist: her hand is on the COAT at row 12 with a pixel of coat between it
// and the strap, and at row 13 it runs straight into the red from the left —
// skin at cols 3-5, red from col 6, coat at col 2. Nothing red is outboard of
// the arm, so you watch it enter the sling instead of finding it already
// inside. A row of coat shade (row 11, cols 3-5) sits over the hand so it
// doesn't melt into the chest.
const MARLA_DOWN = [
  '................',
  '..........oo....',
  '....ooooooWWo...',   // the bun: a small knot, not a chef's hat
  '...oWWWWWWWWo...',
  '...oWWwwwwWWo...',
  '...oWSSSSSSWo...',
  '...oSoSSSSoSo...',
  '...oSSSddSSSo...',
  '..oVoSSssSSoVVo.',   // shoulders come up BESIDE the jaw — no neck
  '..oVVoSSSSoVRVo.',   // the strap starts on the FAR shoulder
  '.oVVVVVVVVRRVo..',   // torso 13 — narrower than the seat below it
  '.oVvvvVVVRRVVo..',   // strap walks a pixel left per row; coat shade under
  '.oVSSsVRRRVvVo..',   // her HAND, on the coat — and the strap FANS OUT here
  '.oVSSsRRRRVvVo..',   // the WRIST crossing into the red from the left
  '.oVvRRRRRRVvVo..',   // the cradle, at its widest
  '.oVvRRRRRrVvVo..',   // its shaded far lip
  '.oVvvrrrrvvvVo..',   // and its bottom, DRAWING BACK IN — a hanging pouch
  '..oVvvvvvvvvVo..',   // coat hem over the seat, 12
  '..oVvvvvvvvvVo..',
  'oLloVvvvvvvVollo',   // the crate's CORNERS, outboard of her lap
  'oLLLLLLLLLLLLLLo',   // its lit top plank — 16, her widest and lowest row
  'oLlovvvoovvvolLo',   // its LEGS at the outer edges; her shins between them
  'oLloKKKooKKKolLo',   // her boots, inboard of the timber and a different
  'oLloooooooooolLo',   // colour, so feet and furniture never swap.
];

// MARLA FROM BEHIND. She used to have none: `up` was aliased straight to
// `down`, so tryTalk()'s faceToward() would "turn" her to face north and she
// would keep staring out of the screen with her back to the player. An NPC who
// never turns is fine on this hardware — half of Kakariko never turns. An NPC
// whose turn is a visible no-op is a bug the player can see.
//
// Two things make a back view read at 16px, and neither is subtlety: THE FACE
// IS GONE — rows 5-7 are hair and nape shade where the front has skin, eyes and
// a mouth, which alone flips the read — and THE SLING SWAPS SIDES. Facing away,
// her right arm is on OUR right, so the strap now leaves her left shoulder at
// our col 4 and walks a pixel RIGHT per row across her back until it wraps
// around her side at rows 15-16. That is also why this pose is not a mirror of
// the front: from behind you see the STRAP, a diagonal band, and only the edge
// of the cradle past her ribs — the pouch itself is in front of her, hidden.
// The crate, the hem and the boots are unchanged, because she has not moved.
const MARLA_UP = [
  '................',
  '..........oo....',
  '....ooooooWWo...',   // the same bun knot, seen from the back
  '...oWWWWWwwWo...',   // the shadow the bun casts on the crown — the one
  '...oWWWWWWWWo...',   // piece of modelling that says "this is the far side"
  '...oWWWWWWWWo...',   // no face at all: hair all the way down, which is what
  '...oWWwwwwWWo...',   // turns a head round at this size
  '...oWwwwwwwWo...',   // the nape, where the front view has a chin
  '..oVoWwwwwWoVVo.',   // the same asymmetric shoulder step, no jaw between
  '..oVRVoWWWoVVVo.',   // strap over her LEFT shoulder — our left, from behind
  '.oVVRRVVVVVVVo..',
  '.oVvvRRVVVVvVo..',   // and it walks a pixel RIGHT per row, the mirror of
  '.oVvvvRRVVVvVo..',   // the front view's descent
  '.oVvvvvRRVVvVo..',
  '.oVvvvvvRRVvRVo.',   // her slung elbow starts to push the coat out
  '.oVvvvvvvRRRRro.',   // the cradle's edge, wrapping round her ribs
  '.oVvvvvvvvrrrVo.',   // its shade, and then it is in front of her: gone
  '..oVvvvvvvvvVo..',
  '..oVvvvvvvvvVo..',
  'oLloVvvvvvvVollo',   // crate corners, top plank, legs, boots: unchanged —
  'oLLLLLLLLLLLLLLo',   // she is sitting on the same box either way round
  'oLlovvvoovvvolLo',
  'oLloKKKooKKKolLo',
  'oLloooooooooolLo',
];

const MARLA_LEFT = [
  '................',
  '................',
  '.........oo.....',
  '....oooooWWo....',
  '...oWWWWWWWo....',
  '...oWWwwwWWo....',
  '...oWSSSSSWo....',
  '...oSoSSSSWo....',
  '...oSSddSSWo....',
  '..oVoSSsSWoVo...',
  '..oVVoSSSoVRo...',
  '.oVvvvVVVRVo....',
  '.oVSSsVRRRVo....',   // hand on the coat, strap fanning into the cradle
  '.oVSSsRRRRVo....',   // wrist crossing into the red
  '.oVvRRRRRRVo....',
  '.oVvRRRRRrVvo...',
  '.oVvvrrrrvvVo...',
  '..oVvvvvvvVo....',
  '..oVvvvvvvVo....',
  'oLloVvvvvvVollo.',
  'oLLLLLLLLLLLLLo.',
  'olovvvvollllo...',
  'oloKKKKollllo...',
  '.ooooooooooooo..',
];

// ---------------------------------------------------------------------------
// TAM — kid on the well rim, legs swinging
// ---------------------------------------------------------------------------
const TAM_PAL = {
  o: OUT, ...SKIN,
  C: '#5aa06a', c: '#2f6b40',             // moss-green cap
  H: LEATHER.l,                           // hair
  T: '#b0603a', t: '#7a3c22', e: '#4c2414', // rust tunic ramp
  Y: '#e8d060',                           // scarf
  K: '#4a5a6c', k: BOOT,                  // trousers / cuff
  B: LEATHER.L, b: LEATHER.l,             // boots
};

// TAM is a CHILD, which is a proportion problem, not a scale problem. His head
// is 10px across and so is his torso — head as wide as body is the whole trick
// for reading "kid" at 16px. The adults are 8px heads on 12-16px bodies.
//
// The old sprite was a 14x5 rust slab with a flat yellow band across the top
// and no arms anywhere, so it read as a boy standing behind a crate. Two
// changes fix it: HANDS (rows 15-16) gripping the well rim either side of his
// hips, poking 2px outboard of the tunic so the outline stops being a box; and
// the scarf now has a KNOT and a TAIL running down his chest instead of being
// a horizontal bar that reads as the crate's top rail.
const TAM_BASE = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '....oCCCCCCo....',
  '...oCCCCCCCCo...',
  '...occcccccco...',
  '...oHSSSSSSHo...',
  '...oSoSSSSoSo...',
  '...oSSSSSSSSo...',
  '....oSSssSSo....',
  '.....oSSSSo.....',
  '...oYYYYYYYYo...',   // scarf band...
  '...oTTYYTTTTo...',   // ...its knot, off-centre...
  '...oTtYTTTtTo...',   // ...and the tail down his chest
  '.oSSoTYTTTToSSo.',   // HANDS gripping the rim, outboard of the tunic
  '.oSsoTTTTTToSso.',
  '...oeTTTTTTeo...',   // hem: lit centre, not a black slab edge
];

// Two swing frames for the dangling legs (rows 18-23): apart, then together.
// The first row of each carries the outline bridge that closes the tunic hem.
const TAM_LEGS_A = [
  '..oKKoooKKo.....',
  '..oKKo.oKKo.....',
  '..okko.okko.....',
  '..oBBo.oBBo.....',
  '..oBbo.oBbo.....',
  '..oooo.oooo.....',
];
const TAM_LEGS_B = [
  '....oKKoooKKo...',
  '....oKKo.oKKo...',
  '....okko.okko...',
  '....oBBo.oBBo...',
  '....oBbo.oBbo...',
  '....oooo.oooo...',
];

// ---------------------------------------------------------------------------
// HESPER — shopkeeper. Four pixels narrower than Pell, apron with real ties.
// ---------------------------------------------------------------------------
const HESPER_PAL = {
  o: OUT, ...SKIN, K: BOOT, k: BOOT_HI,
  H: '#5a4658', G: '#a08fa0',             // hair dark / grey streak
  P: '#a8548a', p: '#7c3c62',             // plum shirt light / shade
  A: '#f0ece0', a: '#c8c2b2',             // apron light / shade
  // The lens is DIM slate-blue, not bright cyan: two bright cyan pixels on a
  // 10px face read as anime irises, not as glass.
  b: '#6e5218', g: '#7d9cbe',             // spectacle rim / lens glass
};

// Hesper's silhouette is a PEAR — the opposite of Pell. Narrow 10px shoulders
// with a light shoulder-seam row on top of them, a waist, then the apron
// flaring to a 14px HIP at rows 16-18 before the hem draws back in over her
// boots. Put her mask next to Pell's and one is wide-at-the-top, the other is
// wide-at-the-bottom; you never have to see the colour.
//
// The spectacles are a BRIDGED band: rim, lens, brass across the nose, lens,
// rim, all on one row. Skin showing between the two lenses is what made them
// read as eyes.
const HESPER_DOWN = [
  '................',
  '................',
  '....oooooooo....',
  '...oHHHHHHHHo...',
  '...oHHGGGGHHo...',
  '...oHSSSSSSHo...',
  '...oSSSSSSSSo...',
  '...obgobbogbo...',   // rim / glass glint / eye / brass nose bridge
  '...oSSSSSSSSo...',
  '...oSSSssSSSo...',
  '....oSSSSSSo....',
  '.....oSSSSo.....',
  '...oPPPPPPPPo...',   // 10 — the shoulder seam
  '...oPpAAAApPo...',
  '...oSpAAAApSo...',   // hands showing at the sides of the bib
  '...oppaAAappo...',   // waist ties, knotted in the middle
  '..opAAAAAAAApo..',   // 12
  '.opAAAaaaaAAApo.',   // 14 — the hip
  '.opAAaaaaaaAApo.',   // patch pocket
  '..opAAAAAAAApo..',   // 12 — hem drawing back in
  '..opaaaaaaaapo..',
  '....oKKooKKo....',   // 8 — feet together. Pell stands 12 wide.
  '....oKkooKko....',
  '....oooooooo....',
];

const HESPER_UP = [
  '................',
  '................',
  '....oooooooo....',
  '...oHHHHHHHHo...',
  '...oHHGGGGHHo...',
  '...oHHHHHHHHo...',
  '...oHHHGGHHHo...',
  '...oHHHGGHHHo...',
  '...oHHHHHHHHo...',
  '....oHHHHHHo....',
  '....oSSSSSSo....',
  '.....oSSSSo.....',
  '...oPPPPPPPPo...',
  '...oPppppppPo...',
  '...oSppppppSo...',
  '...oppaAAappo...',   // the apron bow, seen from behind
  '..opAAAAAAAApo..',
  '.opAaaaaaaaaApo.',
  '.opAaaaaaaaaApo.',
  '..opAAAAAAAApo..',
  '..opaaaaaaaapo..',
  '....oKKooKKo....',
  '....oKkooKko....',
  '....oooooooo....',
];

const HESPER_LEFT = [
  '................',
  '................',
  '....oooooooo....',
  '...oHHHHHHHHo...',
  '...oHHGGGGHHo...',
  '...oHSSSSSSHo...',
  '...oSSSSSSSHo...',
  '...obgobbSHHo...',   // in profile: one lens and the bridge running back
  '...oSSSSSSSHo...',
  '...oSSSSSsHHo...',
  '....oSSSSHo.....',
  '.....oSSSo......',
  '...oPPPPPPo.....',   // 8 in profile
  '...oPpAAApo.....',
  '...oSpAAApo.....',
  '...oppaAapo.....',
  '..opAAAAAApo....',   // 10
  '.opAAaaaaAApo...',   // 12 — the hip
  '.opAAaaaaAApo...',
  '..opAAAAAApo....',
  '..opaaaaaapo....',
  '....oKKoKKo.....',
  '....oKkoKko.....',
  '....oooooo......',
];

// ---------------------------------------------------------------------------
// Props: the draw-well Tam sits on, the sealed hatch, and brass sign plaques.
// ---------------------------------------------------------------------------
const PROP_PAL = {
  o: OUT,
  R: '#b0aa9c', r: '#8a8478', x: '#5e5a50', // stone ramp
  M: '#3a3a44',                             // the dark down the shaft
  B: '#e0b845', b: '#a8802a', z: '#6e5218', // brass ramp
  N: LEATHER.L, n: LEATHER.l,               // timber ramp
  A: '#f4e4a8',                             // brass highlight
};

// Outline every cell that touches air. Used by the procedural props.
function outline(g, w, h) {
  const src = g.map(r => r.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y][x] === '.') continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h ||
            src[ny][nx] === '.') { g[y][x] = 'o'; break; }
      }
    }
  }
}

// 32x40 draw-well: a timber crossbar on two posts, a rope and bucket hanging
// off the near end, an elliptical stone ring shaded round its circumference
// (light on the north-west arc, dark on the south-east) over a coursed shaft.
// Tam sits on the front rim and is drawn after, so he occludes the mouth the
// way a kid would.
const WELL = (() => {
  const W = 32, H = 40;
  const g = Array.from({ length: H }, () => new Array(W).fill('.'));
  const put = (x, y, ch) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = ch; };
  const rect = (x0, y0, x1, y1, ch) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, ch);
  };

  // --- shaft: coursed stone, lit from the north-west -----------------------
  for (let y = 22; y <= 37; y++) {
    const inset = y > 35 ? 1 : 0;
    for (let x = 4 + inset; x <= 27 - inset; x++) {
      const t = (x - 4) / 23;
      let ch = t < 0.26 ? 'R' : t < 0.62 ? 'r' : 'x';
      if (y > 34) ch = t < 0.26 ? 'r' : 'x';
      const course = Math.floor((y - 22) / 4);
      if ((y - 22) % 4 === 3 || (x + (course % 2 ? 4 : 0)) % 8 === 0) ch = 'x';
      put(x, y, ch);
    }
  }

  // --- posts and crossbar --------------------------------------------------
  for (const px of [4, 25]) {
    rect(px, 3, px + 1, 20, 'N');
    rect(px + 2, 3, px + 2, 20, 'n');
  }
  rect(3, 0, 28, 1, 'N');
  rect(3, 2, 28, 3, 'n');
  rect(4, 4, 6, 4, 'b');             // brass straps at the joints
  rect(25, 4, 27, 4, 'b');

  // --- rope and bucket, hung off the near end of the bar --------------------
  rect(12, 4, 12, 6, 'A');
  rect(13, 5, 13, 6, 'b');
  rect(10, 6, 15, 6, 'z');           // the bail
  rect(9, 7, 15, 13, 'N');           // staves
  rect(9, 7, 15, 7, 'M');            // the dark inside the bucket
  rect(11, 8, 11, 13, 'n');
  rect(14, 8, 14, 13, 'n');
  rect(9, 9, 15, 9, 'b');            // brass hoops
  rect(9, 13, 15, 13, 'z');
  rect(10, 14, 14, 14, 'n');

  // --- stone ring ----------------------------------------------------------
  // Shading follows the angle round the ring, not a flat diagonal, so the rim
  // reads as a torus with volume rather than a light half and a dark half.
  const CX = 15.5, CY = 24, RX = 14, RY = 6.5;
  const LIGHT = -2.30;               // the light comes from up and to the left
  for (let y = 16; y <= 32; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - CX) / RX, dy = (y - CY) / RY;
      if (dx * dx + dy * dy > 1.0) continue;
      // The mouth gets its own, much tighter ellipse so the ring keeps real
      // width on the north and south lips instead of thinning to a hairline.
      const mx = (x - CX) / 9.2, my = (y - CY - 0.6) / 3.5;
      const m = mx * mx + my * my;
      if (m < 0.70) { put(x, y, 'o'); continue; }        // the dark, going down
      if (m < 1.0) { put(x, y, y < CY ? 'M' : 'o'); continue; }  // far inner wall
      const nl = Math.cos(Math.atan2(dy, dx) - LIGHT);
      put(x, y, nl > 0.45 ? 'R' : nl > -0.35 ? 'r' : 'x');
      // Brass band bolted round the front lip.
      if (y >= CY + 2 && m > 1.6) put(x, y, nl < -0.85 ? 'z' : 'B');
      else if (y >= CY + 1 && m > 2.1) put(x, y, 'b');
    }
  }

  outline(g, W, H);
  return g.map(r => r.join(''));
})();

// 32x20 sealed Boilerworks hatch, lying FLUSH in the ground: a rounded-square
// brass plate (foreshortened, wider than tall) inside a stone kerb, with eight
// rivets and a locking wheel. Superellipse masks keep the corners chunky.
const HATCH = (() => {
  const W = 32, H = 20;
  const g = Array.from({ length: H }, () => new Array(W).fill('.'));
  const CX = 15.5, CY = 9.5;
  const se = (x, y, rx, ry) => Math.pow(Math.abs(x - CX) / rx, 3) +
                               Math.pow(Math.abs(y - CY) / ry, 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (se(x, y, 15.5, 9.5) > 1) continue;
      const lit = (x - CX) / 15.5 + (y - CY) / 9.5;
      if (se(x, y, 13.2, 7.9) > 1) g[y][x] = lit < 0 ? 'R' : 'r';   // stone kerb
      else if (se(x, y, 11.8, 6.7) > 1) g[y][x] = 'x';              // kerb shadow
      else g[y][x] = lit < -0.7 ? 'x' : lit < 0.5 ? 'M' : 'o';      // iron plate
    }
  }
  for (const [rx, ry] of [[-8, -4], [-3, -5], [3, -5], [8, -4],
                          [-8, 4], [-3, 5], [3, 5], [8, 4]]) {
    const x = Math.round(CX + rx), y = Math.round(CY + ry);
    if (g[y] && g[y][x] !== '.') {
      g[y][x] = 'B';
      if (g[y + 1] && g[y + 1][x] !== '.') g[y + 1][x] = 'z';
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x - CX) / 8.2, dy = (y - CY) / 5.0;
      const d = dx * dx + dy * dy;
      if (d > 1.0) continue;
      const ax = Math.abs(x - CX), ay = Math.abs(y - CY);
      if (d > 0.55) g[y][x] = y > CY ? 'z' : 'B';
      else if (ax <= 1.6 && ay <= 1.1) g[y][x] = 'A';
      else if ((ay <= 0.6 && ax <= 8) || (ax <= 1.1 && ay <= 5)) {
        g[y][x] = (y > CY || x > CX) ? 'b' : 'B';
      }
    }
  }
  outline(g, W, H);
  return g.map(r => r.join(''));
})();

// 16x22 stamped-brass plaque on a timber post: bright bevelled border, darker
// field, three rows of struck lettering, a rivet in each corner.
const SIGN = [
  '..oooooooooooo..',
  '.oBBBBBBBBBBBBo.',
  '.oBAbbbbbbbbABo.',
  '.oBbbbbbbbbbbBo.',
  '.oBbzzzzzzzzbBo.',
  '.oBbbbbbbbbbbBo.',
  '.oBbzzzzzzbbbBo.',
  '.oBbbbbbbbbbbBo.',
  '.oBbzzzzzzzbbBo.',
  '.oBAbbbbbbbbABo.',
  '.oBBBBBBBBBBBBo.',
  '..oooooooooooo..',
  '......oNNo......',
  '......oNno......',
  '......oNno......',
  '......onno......',
  '.....oonnoo.....',
  '.....oxxxxo.....',
  '......oooo......',
  '................',
  '................',
  '................',
];

// ---------------------------------------------------------------------------
// Sprite factory
// ---------------------------------------------------------------------------
export function makeNpcSprites() {
  const pellDown = grid(PELL_DOWN, PELL_PAL, 'pell.down');
  const pellUp = grid(PELL_UP, PELL_PAL, 'pell.up');
  const pellLeft = grid(PELL_LEFT, PELL_PAL, 'pell.left');
  const pell = {
    down: [pellDown, grid(bobHead(PELL_DOWN, 1, 10), PELL_PAL, 'pell.down.b')],
    up: [pellUp, grid(bobHead(PELL_UP, 1, 10), PELL_PAL, 'pell.up.b')],
    left: [pellLeft, grid(bobHead(PELL_LEFT, 1, 10), PELL_PAL, 'pell.left.b')],
  };
  pell.right = pell.left.map(flipH);

  const hesDown = grid(HESPER_DOWN, HESPER_PAL, 'hesper.down');
  const hesUp = grid(HESPER_UP, HESPER_PAL, 'hesper.up');
  const hesLeft = grid(HESPER_LEFT, HESPER_PAL, 'hesper.left');
  const hesper = {
    down: [hesDown, grid(bobHead(HESPER_DOWN, 2, 11), HESPER_PAL, 'hesper.down.b')],
    up: [hesUp, grid(bobHead(HESPER_UP, 2, 11), HESPER_PAL, 'hesper.up.b')],
    left: [hesLeft, grid(bobHead(HESPER_LEFT, 2, 11), HESPER_PAL, 'hesper.left.b')],
  };
  hesper.right = hesper.left.map(flipH);

  const marlaDown = [
    grid(MARLA_DOWN, MARLA_PAL, 'marla.down'),
    grid(bobHead(MARLA_DOWN, 1, 7), MARLA_PAL, 'marla.down.b'),
  ];
  const marlaLeft = [
    grid(MARLA_LEFT, MARLA_PAL, 'marla.left'),
    grid(bobHead(MARLA_LEFT, 1, 8), MARLA_PAL, 'marla.left.b'),
  ];
  const marlaUp = [
    grid(MARLA_UP, MARLA_PAL, 'marla.up'),
    grid(bobHead(MARLA_UP, 1, 7), MARLA_PAL, 'marla.up.b'),
  ];
  // `up` used to be `marlaDown`, which made her the one NPC in the village
  // whose turn-to-face did nothing at all.
  const marla = { down: marlaDown, left: marlaLeft, up: marlaUp, right: marlaLeft.map(flipH) };

  const tamA = grid(TAM_BASE.concat(TAM_LEGS_A), TAM_PAL, 'tam.a');
  const tamB = grid(TAM_BASE.concat(TAM_LEGS_B), TAM_PAL, 'tam.b');
  const tam = { down: [tamA, tamB], up: [tamA, tamB], left: [tamA, tamB], right: [tamA, tamB] };

  const props = {
    well: makeSprite(WELL, PROP_PAL),
    sign: makeSprite(SIGN, PROP_PAL),
    hatch: makeSprite(HATCH, PROP_PAL),
  };
  return { pell, hesper, marla, tam, props, shadow: SHADOW };
}

// ---------------------------------------------------------------------------
// NPC entity
// ---------------------------------------------------------------------------
export class NPC {
  /**
   * @param {object} o
   *   x, y      sprite top-left in world px
   *   sprites   { down:[a,b], up:[a,b], left:[a,b], right:[a,b] }
   *   facing    initial direction
   *   lines     string | string[] spoken on a plain talk
   *   onTalk    (npc, box) => void — overrides `lines` when present
   *   canonical true when onTalk is THIS FILE'S authored Chapter 1 copy: the
   *             property then ignores plain assignment (see below)
   *   fixed     true for seated NPCs: they do not turn to face Wren
   *   period    frames per idle frame (default 34)
   *   rect      collision footprint offsets {x,y,w,h} within the sprite
   *   shadow    false to skip the ground shadow (seated NPCs on props)
   */
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.sprites = o.sprites;
    this.facing = o.facing || 'down';
    this.lines = o.lines;
    this.onTalk = o.onTalk;
    if (o.canonical && o.onTalk) this._sealTalk(o.onTalk);
    this.fixed = !!o.fixed;
    this.period = o.period || 34;
    this.phase = o.phase || 0;
    this.name = o.name || '';
    // Footprint doubles as "personal space": it reaches ~6px below the boots
    // so Wren halts a stride short instead of standing inside the villager.
    const r = o.rect || { x: 2, y: 14, w: 12, h: 20 };
    this.off = r;
    this.sortY = o.sortY != null ? o.sortY : 24;
    this.shadow = o.shadow !== false;
    this.frame = 0;
  }

  get rect() {
    return { x: this.x + this.off.x, y: this.y + this.off.y, w: this.off.w, h: this.off.h };
  }
  get baseY() { return this.y + this.sortY; }

  update(engine) {
    this.frame = Math.floor((engine.frame + this.phase) / this.period) % 2;
  }

  faceToward(px, py) {
    if (this.fixed) return;
    const cx = this.x + 8, cy = this.y + 16;
    const dx = px - cx, dy = py - cy;
    this.facing = Math.abs(dx) > Math.abs(dy)
      ? (dx < 0 ? 'left' : 'right')
      : (dy < 0 ? 'up' : 'down');
  }

  /**
   * ONE VERSION OF A CHARACTER'S COPY.
   *
   * Chapter 1 was shipping two Pells. This file authored "Put my mug down twice
   * today. / Twice it walked east." and a scene re-authored a weaker cold open
   * on top of it with a bare `npc.onTalk = ...`, on the stale grounds that this
   * file shipped him with an empty onTalk. Two versions of one character's
   * first line is worse than either version, and the one the player got was the
   * one nobody was reviewing.
   *
   * So a villager built by makeVillager() carries SEALED copy: `onTalk` becomes
   * an accessor that returns the authored function and quietly drops plain
   * assignment (it does not throw — a TypeError in a module that only wanted to
   * customise dialogue would take the whole page down). The discarded function
   * is kept on `_rejectedTalk` so this is inspectable rather than spooky.
   *
   * A scene that genuinely needs different copy — a later beat, a different
   * island, a test — calls `npc.setTalk(fn)`, which replaces it outright. That
   * is an explicit, greppable act; `npc.onTalk = fn` is an accident.
   *
   * AND IT SAYS SO OUT LOUD. A seal that swallows an assignment silently is a
   * booby trap: the next scene to customise a villager's copy gets no error, no
   * warning and no test, just a line that does not appear in the game. The
   * setter therefore warns once per NPC, naming the character and the method to
   * use instead, so the failure arrives in the console the first time it is run
   * rather than in a critique three rounds later.
   */
  _sealTalk(fn) {
    let current = fn;
    Object.defineProperty(this, 'onTalk', {
      configurable: true,
      enumerable: true,
      get: () => current,
      set: (v) => {
        this._rejectedTalk = v;
        if (!this._warnedTalk) {
          this._warnedTalk = true;
          const who = this.name || 'villager';
          console.warn(
            `npc: \`${who}.onTalk = fn\` was DROPPED — ${who} ships sealed copy ` +
            `authored in game/npc.js. Use ${who}.setTalk(fn) to replace it on ` +
            `purpose, or delete the assignment. (Rejected fn kept on _rejectedTalk.)`);
        }
      },
    });
    this.setTalk = (v) => { current = v; this._rejectedTalk = null; return this; };
  }

  /** Replace this NPC's talk handler, sealed copy included. */
  setTalk(fn) { this.onTalk = fn; return this; }

  talk(box) {
    if (this.onTalk) this.onTalk(this, box);
    else if (this.lines) box.say(this.lines);
  }

  draw(ctx) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.shadow) ctx.drawImage(SHADOW, x + 3, y + 21);
    const set = this.sprites[this.facing] || this.sprites.down;
    ctx.drawImage(set[this.frame], x, y);
  }
}

// A readable stamped-brass plaque. Same talk interface as an NPC.
export class Sign {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.img = o.img;
    this.lines = o.lines;
    this.name = o.name || 'sign';
    this.off = o.rect || { x: 1, y: 12, w: 14, h: 20 };
    this.facing = 'down';
    this.fixed = true;
  }
  get rect() {
    return { x: this.x + this.off.x, y: this.y + this.off.y, w: this.off.w, h: this.off.h };
  }
  get baseY() { return this.y + 21; }
  update() {}
  faceToward() {}
  talk(box) { box.say(this.lines); }
  draw(ctx) { ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y)); }
}

// ---------------------------------------------------------------------------
// Talk trigger: probe a point out of Wren's feet box along his facing.
// Player feet box is x+2,y+14 12x10 (see game/player.js).
// ---------------------------------------------------------------------------
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function facingTarget(player, entities, reach = 10) {
  const [dx, dy] = DIRS[player.dir] || DIRS.down;
  const cx = player.x + 8;
  const cy = player.y + 19;                       // centre of the feet box
  const px = cx + dx * (6 + reach);
  const py = cy + dy * (5 + reach);
  let best = null, bestD = Infinity;
  for (const e of entities) {
    const r = e.rect;
    const hit = px >= r.x - 4 && px <= r.x + r.w + 4 &&
                py >= r.y - 6 && py <= r.y + r.h + 6;
    if (!hit) continue;
    const d = Math.hypot(e.x + 8 - cx, e.y + 16 - cy);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/**
 * Standard talk check. Call before the player update; if it returns true the
 * scene MUST skip the player's own A-button handling this frame, or the sword
 * will swing into the conversation.
 */
export function tryTalk(player, entities, input, box) {
  if (box.active) return false;
  if (!input.hit('a')) return false;
  const target = facingTarget(player, entities);
  if (!target) return false;
  box.anchorForPlayer(player.y);
  target.faceToward(player.x + 8, player.y + 16);
  target.talk(box);
  return true;
}

// ---------------------------------------------------------------------------
// CHAPTER 1 — Cogwick Hollow. The copy.
// Voice per STORY.md: terse, warm, wry. One thing on each person's mind.
//
// EVERY '\n' HERE IS A TYPESETTING DECISION, measured against dialog.js's real
// font metrics at MAX_TEXT_W = 144. The rule: a hard break may not fall inside
// a noun phrase when a longer break measurably fits. Four used to —
// "Everyone on this rock is / packing." (105px, when the whole clause is 142),
// "Cash only. The isle is / falling." (88 vs 119, since rewritten), "Not my /
// fault." (110 vs 137) and "It had a / bird" (119 vs 138) — a determiner
// orphaned from its
// noun is what makes a window read as a subtitle track. They are joined now.
// What stays broken stays broken on purpose: Marla's "Liftstone's gone. / Cut
// out clean. / We're falling." is three sentences and three beats, Tam's "A
// mug." is a punchline on its own row, and "She's at the / hatch" survives
// because the joined line measures 145 and the measure is 144.
// ---------------------------------------------------------------------------

// FOUR SIGNS, FOUR SHAPES. All four used to land the same setup-and-reversal
// ("The ladder is old. / So are you.", "Open. / Knock only if it isn't.", "If
// it sings, walk away. / If it screams, run.", "Keep off the windmill vane. /
// It bites."), which made the whole isle's signage read as one writer doing a
// bit four times. Now the village plate is a parish inventory, the hatch is a
// count of rungs, the shop is stock, and the steam main is an instruction with
// a number in it. Same information, four rhythms.
export const SIGN_TEXT = {
  village:
    'COGWICK HOLLOW\n' +
    'Four hundred souls, one well,\n' +
    'one windmill vane still bent.',
  hatch:
    'BOILERWORKS. KEEPERS ONLY.\n' +
    'Forty rungs down. Three of them\n' +
    'have gone soft.',
  shop:
    "HESPER'S\n" +
    'Jars, charms, wire, lamp oil.\n' +
    'Walk in. The bell is broken.',
  pipes:
    'STEAM MAIN\n' +
    'Singing is normal. Screaming\n' +
    'means you have four seconds.',
};

/**
 * Build one of the Chapter 1 villagers, wired to a DialogBox.
 * @param kind  'pell' | 'marla' | 'tam' | 'hesper'
 * @param x,y   world position of the 16x24 sprite
 * @param ctx   { sprites, box, wallet, flags, onGiveCogblade }
 */
export function makeVillager(kind, x, y, ctx) {
  const S = ctx.sprites;
  const flags = ctx.flags || (ctx.flags = {});
  const box = ctx.box;

  if (kind === 'pell') {
    return new NPC({
      name: 'Pell', canonical: true, x, y, sprites: S.pell, facing: 'down', period: 38, phase: 7,
      // PELL CIRCLES. He used to land the cast's house joke twice in one
      // conversation ("Twice today. / Twice it walked east." and then "Still
      // leaning. / Still not weather."), which is the same two-beat reversal
      // Marla, Hesper and all four signs were built on. He is a bored man on a
      // quiet dock, so he wanders off his own point and comes back to it: he
      // starts a rope in the first speech, finishes it in the second, and ends
      // up back at the mug either way. Nothing lands. That is the joke.
      onTalk: () => {
        if (!flags.pell) {
          flags.pell = true;
          box.say([
            'Put my mug down to coil a rope.\nCame back and the mug had gone\neast without me.',
            "Go find Marla. She's at the\nhatch, being unpleasant.",
          ]);
        } else {
          box.say("Rope's coiled now. Deck's gone\nover twice more since. I've\nstopped putting the mug down.");
        }
      },
    });
  }

  if (kind === 'marla') {
    return new NPC({
      name: 'Marla', canonical: true, x, y, sprites: S.marla, facing: 'down', fixed: true,
      period: 46, phase: 20, rect: { x: 1, y: 14, w: 14, h: 20 },
      // MARLA CLIPS. Her sentences get shorter as she runs out of patience,
      // and none of them balance against another. The repeat line used to be
      // "Can't lift my arm. / Can't lift the isle. / Go on, then." — a matched
      // pair with a tag, the same figure Pell and Hesper were both landing.
      // She has a wrenched shoulder and wants Wren down the hatch, so she gets
      // three sentences and each one is shorter than the last.
      onTalk: () => {
        if (!flags.cogblade) {
          flags.cogblade = true;
          box.say([
            "Liftstone's gone.\nCut out clean.\nWe're falling.",
            "Shoulder's wrenched.\nI can't make the ladder.\nSo you are.",
            "Take this. It's not a sword.\nIt's a tool that argues.",
          ]);
          box.ask('Know how to swing it?', ['I do', 'Not really'], (pick) => {
            if (pick === 0) box.say('Good. Lie to me later.');
            else box.say("Point the sharp end away.\nYou'll pick up the rest.");
            box.say('Down the hatch, courier.\nMind the steam.');
            if (ctx.onGiveCogblade) ctx.onGiveCogblade();
          });
        } else {
          box.say("You're still up here.\nThe hatch is under my boot. Go.");
        }
      },
    });
  }

  if (kind === 'tam') {
    return new NPC({
      name: 'Tam', canonical: true, x, y, sprites: S.tam, facing: 'down', fixed: true,
      period: 22, phase: 3, shadow: false, rect: { x: 2, y: 10, w: 12, h: 24 }, sortY: 24,
      // TAM IS THE ONE WHO CANNOT LAND IT. Tam went first, and the rest of the
      // cast has since come off the house two-beat reversal behind him: Pell
      // circles, Marla clips, Hesper lists, and the four signs each carry their
      // own rhythm. Four people sharing one joke shape read as one writer being
      // clever rather than four residents. Tam is nine. He runs on, he
      // doubles back to correct himself, and the good line is already gone by
      // the time he reaches for it. His copy also runs 107-137px against the
      // 144px measure, so his pages fill the window instead of floating in it.
      //
      // HE IS ALSO NO LONGER THE LONGEST SPEECH IN THE CHAPTER. He was four
      // pages and eleven rows — more than Marla, who is handing over the sword
      // the chapter is named for — and the third page was Tam talking ABOUT a
      // joke he had made two pages earlier. A running-on child is a voice; a
      // child annotating his own material is a writer. One page of ship, one
      // question, one answer: three pages, seven rows, and the doubling-back
      // moved into the line where it does work — he corrects a detail of what
      // he saw, not the quality of his own delivery.
      onTalk: () => {
        if (!flags.tam) {
          box.say('Black ship at dawn. It had a bird\non the front, painted, wings out.');
          box.ask('It went up. Not out. Up.\nNobody believes me. Do you?',
            ['I believe you', 'You dreamt it'], (pick) => {
              flags.tam = true;
              if (pick === 0) {
                flags.tamFriend = true;
                box.say('Like someone took the heavy\npart off it. That is the only\nway I can say it.');
              } else {
                box.say("Fine. Pell's mug walked east\nand you all believed that.\nA mug.");
              }
            });
        } else if (flags.tamFriend) {
          box.say('The bird was white. I think.\nIt was dark out. It was a bird.');
        } else {
          box.say("Go and look at the sky, then.\nIt's the same sky. Not my fault.");
        }
      },
    });
  }

  if (kind === 'hesper') {
    const wallet = ctx.wallet || { cogs: 0 };
    const items = [
      {
        name: 'Heart Jar', price: 30,
        blurb: "Don't ask whose they were.",
        onBuy: () => {
          box.say('There. Try to keep them.');
          if (ctx.onBuyHeartJar) ctx.onBuyHeartJar();
        },
      },
      {
        name: 'Second Wind', price: 100,
        // Was "Saves your life once. Once." — the cast's house reversal again,
        // in a shopkeeper's mouth. Hesper does not do turns; she quotes you
        // what a thing does and what it costs, in that order.
        blurb: 'Stops one killing blow, then\nburns out. Hundred cogs.',
        onBuy: () => {
          box.say("Pinned it on straight? Good.\nDon't test it on purpose.");
          if (ctx.onBuySecondWind) ctx.onBuySecondWind();
        },
      },
    ];
    return new NPC({
      name: 'Hesper', canonical: true, x, y, sprites: S.hesper, facing: 'down', period: 42, phase: 13,
      onTalk: () => {
        if (!flags.hesper) {
          flags.hesper = true;
          flags.beetleHint = true;
          box.say([
            'Everyone on this rock is packing.\nYou\'re shopping.\nI like you already.',
            'One thing free, then: those\nclockwork beetles hate wind.\nDon\'t ask how I know.',
          ]);
        }
        // HESPER LISTS. Her greeting used to be "The isle is falling. / My
        // prices aren't." — the same figure Pell and Marla were both landing.
        // She runs a shop: she names the stock, names the terms, and then says
        // flat out that she is the one holding the price. "A falling isle
        // doesn't move a price" handed the sentence to the isle; SHE is the one
        // not discounting, so she says so.
        box.shop("What'll it be? Jar, charm,\ncash in hand. I don't discount\nfor a falling isle.", items, {
          wallet,
          again: 'Anything else?\nWhile the shelf lasts.',
          exitLabel: 'Nothing today',
          poor: "Come back with the cogs.\nI'll be here. Probably.",
          // NOT "Mind the steam." — that is Marla's goodbye, four minutes
          // earlier, and two residents of one village signing off with the
          // same three words is the seam where a cast becomes one writer.
          // Hesper's exit is a shopkeeper's: it points back at her stock.
          onExit: () => box.say('Off you go, then.\nTry not to need the jar.'),
        });
      },
    });
  }

  throw new Error('unknown villager: ' + kind);
}

export function makeSign(kind, x, y, ctx) {
  return new Sign({
    name: kind, x, y, img: ctx.sprites.props.sign, lines: SIGN_TEXT[kind],
  });
}
