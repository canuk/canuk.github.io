// KETTLEBACK — the Boilerworks boss.
//
// A cart-sized clockwork beetle with a boiler for an abdomen, welded around
// the liftstone's empty cradle. 48x40 facing down; the other three facings are
// pixel-exact flips and rotations of the same art, so the silhouette can never
// drift between headings.
//
// THE LOOP (it is one idea, taught in phase 1 and then squeezed):
//   1. It rears, its back valve glows, and it CHARGES in a straight line.
//   2. It hits the wall and stalls, venting: the valve is OPEN for ~90 frames.
//   3. A Bellows Cuff blast into the open valve chokes it — it seizes with the
//      cradle exposed and white-hot, and that is when the Cogblade works.
//      Nothing else hurts it. The blade rings off the shell.
//   4. THE COLLAR COOLS AFTER TWO STRIKES. You get two hits per seize and then
//      it shrugs the blade off and gets back on its legs. Nine seizes to kill
//      it, which is what stops the whole fight being three of anything.
//
// PHASES (STORY.md beat 5). Each phase runs a SCRIPTED OPENING ROTATION and
// then draws from that phase's pool, so a phase is several decisions long and
// the attack it advertises is guaranteed to be seen, not rolled for:
//   1  hp 18-13  charge, charge, charge. One verb, taught clean.
//   2  hp 12-7   spin sweep (always, first thing) / CINDERS (a rake of coals
//                spat along the floor toward you — dodge them or Cuff them
//                out, the same verb the room's steam vents answer to) /
//                charge. Sheds its plates and calls two beetles on entry.
//   3  hp  6-0   overheats: floor glows, arena jets on a fast cycle, it
//                charges TWICE, and it roots itself to sweep four STEAM
//                LANCES around the arena — the gap between them rotates and
//                you have to rotate with it.
//
// Every attack telegraphs for at least 34 frames before it can hurt you, and
// every hazard it puts on the floor cooks for another 34 before it bites.
//
// Death: freeze, white flash, an expanding explosion sequence walked outward
// from the body over 90 frames, and then the shard revealed in the wreck.

import { makeSprite, flipH } from '../sprites.js';
import { Blast, makeBoilerworks, flipV } from './world/boilerworks.js';
import { ClockworkBeetle } from './enemies.js';
// The BELLOWS CUFF's own palette — imported rather than copied, because the
// point of the valve cue is that it is painted in the item's colour and has to
// stay that way if items.js ever repaints it. (No cycle: items.js pulls only
// sprites.js and dialog.js.)
import { CUFF_PAL } from './items.js';

// ---------------------------------------------------------------------------
// Palette
//
// THE RULE THAT DECIDED IT: the dungeon's walls are copper (#7d4f26 / #9a6a32)
// and the deck is blue-grey steel (#3c4450). A boss painted in either of those
// families disappears into the room at the exact moment it should be the only
// thing you can look at. Helmasaur King solves the same problem by putting a
// periwinkle-blue mask on a blood-red body over a khaki floor — three hue
// families, none of them the room's.
//
// So KETTLEBACK is BLACKENED IRON with a green-black oxide cast (nothing else
// in the Boilerworks is that dark or that cold-green), banded with BRASS hoops
// (the brightest thing on screen), lit from inside by an ORANGE firebox seen
// through flank grilles, with VERDIGRIS on the head plate and the cradle
// collar. Five families, and every one of them separates from both the wall
// and the floor.
// ---------------------------------------------------------------------------
// ROUND-11 RELIGHT. The old chassis was "blackened iron": #131f1e / #22343a /
// #3a5a58, i.e. V 0.12–0.35, standing on a deck of #3c4450 at V 0.31. Measured
// on the boss's own ink (screenshot with the boss, screenshot with `boss=null`,
// diff): 45% of it sat below V 0.15, only 28% above V 0.45, median dE to the
// deck palette 7.9. Helmasaur King on the same measurement is 5% / 63% / 29.2.
// Half the boss was the same value as the floor it stood on.
//
// So the chassis is now VERDIGRIS PATINA — every step of its ramp lives ABOVE
// the deck's value, and its hue is green where the deck is blue-grey and the
// walls are copper. Near-black is now reserved for the true outer silhouette:
// every interior seam, panel gap and housing line uses `n`, a mid-dark green
// that still reads as a line but is not a hole.
const BPAL = {
  // TRUE OUTLINE ONLY — the outer silhouette, nothing else. Measured off the
  // reference: Helmasaur King's keyline is #272424, V 0.153, NOT black. A SNES
  // sprite keylines in a very dark TINT of its own family; ours was #120c0a at
  // V 0.086, which is darker than anything in the reference boss at all.
  k: '#13341c',
  x: '#12302a',  // void: the chimney throat, the floor of the empty socket

  n: '#12452a',  // INTERIOR LINEWORK: seams, panel gaps, housings.  V 0.26

  // verdigris-patina chassis, five steps, all of them above the deck's V 0.31
  q: '#2f6050', i: '#438870', I: '#5cac88', J: '#84cca4', j: '#c8f0d8',

  // the FACE PLATE — a cold periwinkle alloy. The one part of the machine
  // that is neither green, brass nor fire, exactly the job Helmasaur King's
  // blue mask does over its red body.
  V: '#b8c4fc', U: '#6474c8', M: '#39408c',

  // brass — boiler hoops, rivets, cradle ring, the valve. The high note.
  B: '#ffe490', b: '#e09c28', z: '#8a6410',

  // the firebox
  E: '#a8301a', e: '#e85a2c', g: '#ff9430', G: '#ffe05c', w: '#ffffff',
  r: '#6e2410',  // the coldest step of the shed form's fire ramp

  // steam + steel (vent plume, speculars)
  W: '#c8d4e0', v: '#8496ac',

  // scorch — where the boiler has burnt its own plating
  h: '#c46424',
};

// ---------------------------------------------------------------------------
// THE HIT FLASH IS A PALETTE CYCLE, NOT A FILL.
//
// The old flash drew `tint(body, '#f8f8f8')` — a solid white silhouette with
// zero internal detail, for six frames, on every blade hit and every phase
// change. ALttP never does that: a struck boss keeps every seam, rivet and
// eye, and it is the PALETTE that jumps. (Watch Helmasaur King take a bomb:
// the mask stays a mask.)
//
// So FPAL is BPAL with every ramp walked to the top of its own family — the
// verdigris goes to white-mint, the brass to white-gold, the firebox to
// white — while `k` and `n` stay dark enough to hold every line. Structure
// survives; only the temperature changes.
const FPAL = {
  k: '#2c5c3a', x: '#3f6a5e',
  n: '#4e9c68',
  q: '#9ce0bc', i: '#bcf0d4', I: '#d8ffe8', J: '#f0fff8', j: '#ffffff',
  V: '#ffffff', U: '#dce4ff', M: '#96a4f0',
  B: '#ffffff', b: '#fff2c4', z: '#f0cc6c',
  E: '#ff9430', e: '#ffbe68', g: '#ffe05c', G: '#fff8d0', w: '#ffffff',
  r: '#e85a2c',
  W: '#ffffff', v: '#dce6f2',
  h: '#ffcc88',
};

// ALttP's Helmasaur King measures ~70x64 on a 256x224 screen. A cart-sized
// boss has to fill the arena the same way.
const W = 64, H = 60;

// ---------------------------------------------------------------------------
// Body generator
//
// The carapace is a superellipse so the outline is a DOME with no straight
// walls (the same silhouette rule the clockwork beetle follows), banded into
// plate courses and lit from the upper left. Features are then stamped on:
// eyes, mandibles, the cradle, the back valve, and the leg sockets.
// ---------------------------------------------------------------------------

function blank() { return Array.from({ length: H }, () => '.'.repeat(W)); }

/** Bounds-safe single-pixel write. Works on ANY string grid, not just the
 *  64x60 body, so the sub-arts below can be built with the same helpers. */
function put(grid, x, y, ch) {
  if (y < 0 || y >= grid.length) return;
  const row = grid[y];
  if (x < 0 || x >= row.length) return;
  grid[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

function stampArt(grid, x0, y0, art) {
  art.forEach((r, dy) => [...r].forEach((ch, dx) => {
    if (ch !== '.') put(grid, x0 + dx, y0 + dy, ch);
  }));
}

// The chassis is a BOILER: a wide, low superellipse drum (no straight walls —
// the same silhouette rule the small clockwork beetle follows) with a separate
// HEAD LOBE pushed clear of it at the front. The chimney breaks the top of
// that outline and six jointed legs break the sides, so the silhouette alone
// says "machine with a stack on it" at 1x.
function drum(x, y, shrink) {
  const nx = (x - 31.5) / (26 - shrink), ny = (y - 24) / (20 - shrink);
  return Math.pow(Math.abs(nx), 2.8) + Math.pow(Math.abs(ny), 2.4);
}
function headLobe(x, y, shrink) {
  const hx = (x - 31.5) / (15 - shrink * 0.6), hy = (y - 49) / (11 - shrink * 0.4);
  return Math.pow(Math.abs(hx), 2.2) + Math.pow(Math.abs(hy), 2.2);
}
function shellField(x, y, shrink) {
  return Math.min(drum(x, y, shrink), headLobe(x, y, shrink));
}

// ---------------------------------------------------------------------------
// Limbs. Six legs, each a real three-part limb — coxa at the chassis, a BRASS
// KNEE, a tibia angled back down, and a two-toed foot planted on the deck.
// Rasterised from a joint chain rather than typed as art so the two walking
// poses can differ by a few pixels at the knee without redrawing anything.
// ---------------------------------------------------------------------------

/** Chain of joints for the LEFT side; the right side is mirrored in x. */
const LEGS = [
  // [coxa, knee, foot] for the rear, middle and front legs
  [[16, 12], [5, 8], [3, 2]],
  [[12, 26], [2, 25], [1, 36]],
  [[16, 40], [5, 46], [4, 56]],
];
/** Pose B lifts the alternating tripod: knees kick out, feet step forward. */
const LEG_STEP = [[0, -2], [1, 3], [0, 2]];

function disc(g, cx, cy, r, ch) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      put(g, Math.round(cx) + dx, Math.round(cy) + dy, ch);
    }
  }
}

/** Thick tapered segment with a lit upper-left edge. */
function bone(g, a, b, r0, r1, core, lit) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) * 2 + 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const r = r0 + (r1 - r0) * t;
    disc(g, x, y, r + 0.9, 'k');
  }
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    const r = r0 + (r1 - r0) * t;
    disc(g, x, y, r, core);
    if (lit) disc(g, x - 0.6, y - 0.7, r - 1.1, lit);
  }
}

function stampLegs(g, poseB, shed) {
  const core = shed ? 'i' : 'I';
  const lit = shed ? 'I' : 'J';
  for (let side = 0; side < 2; side++) {
    LEGS.forEach((chain, li) => {
      const st = poseB ? LEG_STEP[li] : [0, 0];
      const pts = chain.map(([x, y], i) => {
        const px = i === 0 ? x : x + st[0];
        const py = i === 0 ? y : y + st[1];
        return side ? [W - 1 - px, py] : [px, py];
      });
      bone(g, pts[0], pts[1], 2.6, 2.0, core, lit);   // femur
      bone(g, pts[1], pts[2], 2.0, 1.4, core, lit);   // tibia
      // the knee: a brass pin cap, the joint you can actually see
      disc(g, pts[1][0], pts[1][1], 2.6, 'k');
      disc(g, pts[1][0], pts[1][1], 1.7, 'b');
      put(g, Math.round(pts[1][0]), Math.round(pts[1][1]) - 1, 'B');
      // the foot: a planted pad with the claw carrying on past it
      const [kx, ky] = pts[1], [fx, fy] = pts[2];
      const len = Math.hypot(fx - kx, fy - ky) || 1;
      const ux = (fx - kx) / len, uy = (fy - ky) / len;
      disc(g, fx, fy, 2.4, 'k');
      disc(g, fx, fy, 1.5, 'i');
      put(g, Math.round(fx - 1), Math.round(fy - 1), 'J');
      put(g, Math.round(fx + ux), Math.round(fy + uy), 'b');
      put(g, Math.round(fx + ux * 2), Math.round(fy + uy * 2), 'k');
    });
  }
}

// ---------------------------------------------------------------------------
// Stamped features
// ---------------------------------------------------------------------------

const mirror = half => half.map(r => r + [...r].reverse().join(''));

// The CHIMNEY: a riveted stack rising off the boiler's rear with a flared
// brass cap. It sticks out past the drum, which is what stops the outline
// reading as a disc. The cap is the valve, and the valve is the Cuff target.
function chimneyArt(state) {
  // state 0 shut / 1 the venting tell (it glows) / 2 blown open
  const blown = state === 2, hot = state === 1;
  // THE TELL. The rear telegraph's whole read is this cap going from cold
  // brass to white-hot, so the hot state is pushed all the way to WHITE over
  // orange — the relit brass (#e09c28) is warm enough that gold-over-orange
  // would have been a weaker signal than the pre-relight sprite's.
  const C1 = blown ? 'z' : hot ? 'G' : 'B';    // cap, lit
  const C2 = blown ? 'k' : hot ? 'e' : 'b';    // cap, shade
  // `k` only where the stack breaks the sky; every line INSIDE the stack is
  // `n`, so the chimney is a shape and not a black bar on the drum.
  const half = [
    '..kkkkk',
    '.kz' + C2 + C1 + C1 + C1,
    '.kz' + C2 + C1 + C1 + C1,
    '.knz' + C2 + C2 + C2,
    '...kz' + C2 + C2,
    '...kiIJ',
    '...kiIJ',
    '...kiIJ',
    '...kiIJ',
    '...kiIJ',
    '..knIJj',
    '..kz' + C2 + 'BB',
    '..kzbbb',
    '..knnnn',
  ];
  const g = mirror(half);
  // the throat, seen down the stack: shut brass wheel / glowing / blown open
  const throat = blown ? ['xxxxxx', 'xEgexE']
    : hot ? ['GgwwgG', 'gGwwGg'] : ['zbBBbz', 'kzbbzk'];
  stampArt(g, 4, 1, throat);
  // rivets down the stack
  for (const y of [6, 8]) { put(g, 5, y, 'j'); put(g, 8, y, 'j'); }
  return g;
}

// FIREBOX GRILLE — a slotted window in each flank with the fire behind it.
// This is the single detail that makes the chassis read as a boiler and not
// as a shell: you can see the fire that drives it.
function grilleArt(shed, flare) {
  // FLARE 1..3 is the `stoke` wind-up: the draught doors come off the bay and
  // the fire stands up in it. This is one of the two reads the round-12 critic
  // proved did not exist — `stoke` and `spinup` were byte-identical, so two
  // attacks with different answers gave the player nothing for 44 frames.
  // The grille is where the cinders literally come from, so it is where the
  // cinder tell belongs.
  if (flare) {
    if (flare === 1) {
      // the doors crack: the bars are still there but the fire is through them
      return [
        '.hhhhhhhhh.',
        'hEggggggghE',
        'hgGwGwGwGgh',
        'hgwwwwwwwgh',
        'hGwwwwwwwGh',
        'hgwwwwwwwgh',
        'hgGwGwGwGgh',
        'hEggggggghE',
        '.hhhhhhhhh.',
      ];
    }
    if (flare === 2) {
      // wide open and blowing out past the frame
      return [
        'hEgggggggEh',
        'EgGwwwwwGgE',
        'ggwwwwwwwgg',
        'gwwwwwwwwwg',
        'wwwwwwwwwww',
        'gwwwwwwwwwg',
        'ggwwwwwwwgg',
        'EgGwwwwwGgE',
        'hEgggggggEh',
      ];
    }
    // flare 3: the bay is a hole into the firebox — but the bars are still in
    // there as ghosts, because a plain white rectangle is a missing sprite,
    // not a furnace.
    return [
      'EgGwGwGwGgE',
      'gGwwwwwwwGg',
      'GwwGwGwGwwG',
      'wwwwwwwwwww',
      'GwwwwwwwwwG',
      'wwwwwwwwwww',
      'GwwGwGwGwwG',
      'gGwwwwwwwGg',
      'EgGwGwGwGgE',
    ];
  }
  if (shed) {
    // plates gone: the bay is open furnace with the frame burnt back
    return [
      '.nnnnnnnnn.',
      'nhhhhhhhhhn',
      'nEgGwwGgEen',
      'ngGwwwwGgen',
      'nGwwwwwwGgn',
      'ngGwwwwGgen',
      'nEgGwwGgEen',
      'nhhhhhhhhhn',
      '.nnnnnnnnn.',
    ];
  }
  // The grille sits INSIDE the flank, so its frame is interior linework (`n`)
  // and the bars between the slots are dark brass (`z`) — not eleven columns
  // of near-black punched through the middle of the chassis.
  return [
    '.nnnnnnnnn.',
    'nzbbbbbbbzn',
    'nbzgzgzgzbn',
    'nbGgGgGgGbn',
    'nbGgGgGgGbn',
    'nbegegegebn',
    'nbzezezezbn',
    'nzbbbbbbbzn',
    '.nnnnnnnnn.',
  ];
}

/**
 * The CRADLE: the liftstone's empty socket, welded into KETTLEBACK's back.
 * A brass ring on a scorched weld collar with four clamp arms and nothing in
 * it. When the boiler seizes the socket runs white-hot — that is the read
 * that says "hit HERE".
 */
function cradleArt(exposed) {
  const CW = 26, CH = 22, out = [];
  for (let y = 0; y < CH; y++) {
    let s = '';
    for (let x = 0; x < CW; x++) {
      const nx = (x - (CW - 1) / 2) / ((CW - 1) / 2);
      const ny = (y - (CH - 1) / 2) / ((CH - 1) / 2);
      const d = Math.pow(Math.abs(nx), 2.4) + Math.pow(Math.abs(ny), 2.4);
      let ch = '.';
      if (d > 1.05) ch = '.';
      else if (d > 0.94) ch = 'h';                    // weld scorch on the plating
      else if (d > 0.84) ch = 'n';                    // seated into the plating
      else if (d > 0.70) ch = ny < -0.1 ? 'B' : 'b';  // collar, lit from above
      else if (d > 0.56) ch = ny < -0.1 ? 'b' : 'z';
      else if (d > 0.46) ch = 'z';                    // the inner lip of the ring
      // the BOWL. A socket has walls: the far (north) wall catches the light,
      // the throat falls away, the near rim comes back up.
      else if (exposed) ch = d > 0.30 ? 'G' : d > 0.12 ? 'w' : 'G';
      else if (ny < -0.02) ch = d > 0.26 ? 'J' : d > 0.12 ? 'I' : 'i';
      else ch = d > 0.30 ? 'i' : d > 0.14 ? 'q' : 'x';
      s += ch;
    }
    out.push(s);
  }
  // THE BEZEL SPECULAR. The one white note on the gauge face — the reference
  // boss puts the same near-white arc across the top of its helm, and it is
  // what stops a ring of brass reading as a flat washer.
  for (const [bx, by] of [[7, 2], [8, 2], [9, 2], [10, 1], [11, 1], [12, 1],
    [5, 3], [6, 3], [13, 1], [14, 1], [15, 2], [16, 2]]) {
    if (out[by] && out[by][bx] === 'B') put(out, bx, by, 'w');
  }
  // four clamp arms reaching in over the socket, holding nothing
  const claw = (cx, cy, dx, dy) => {
    for (let i = 0; i < 3; i++) {
      put(out, cx + dx * i, cy + dy * i, i === 0 ? 'B' : 'b');
      put(out, cx + dx * i - dy, cy + dy * i - dx, 'k');
      put(out, cx + dx * i + dy, cy + dy * i + dx, 'k');
    }
  };
  claw(12, 5, 0, 1); claw(13, 16, 0, -1);
  claw(6, 10, 1, 0); claw(19, 11, -1, 0);
  // the claws are stamped with `k` cheeks by claw(); inside a brass ring that
  // is interior linework, so walk them back to `n`
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) if (out[y][x] === 'k') put(out, x, y, 'n');
  }
  // weld beads where the ring is fused to the plating
  for (const [bx, by] of [[3, 4], [22, 4], [2, 16], [23, 16]]) {
    put(out, bx, by, 'b'); put(out, bx + 1, by, 'B');
    put(out, bx, by + 1, 'h'); put(out, bx + 1, by + 1, 'z');
  }
  return out;
}

// The HEAD: a verdigris face plate over the iron lobe, two furnace eyes with
// white speculars, and a stamped brass brow. Mirrored from a half so the face
// can never go crooked.
const FACE = mirror([
  '...kkkkkkkk.',
  '.kMUUUUUUUUU',
  'kMUVVVVVVVVV',
  'kMUMMMMMMMVV',
  'kMUMEEEEEMVV',
  'kMUMEeeeeEMV',
  'kMUMEegwwEMV',
  'kMUMEeeeeEMV',
  'kMUMMEEEEMMV',
  'kMUVMMMMMMVV',
  'kMUVVVVVVVVV',
  '.kMUUUUUUUUU',
  '..kkkkkkkkkk',
]);

// The BROW: a brass plate bolted across the head, above the eyes.
const BROW = mirror([
  'nnnnnnnnn',
  'nzbbbbbbb',
  'nzbBBBBBB',
  'nnzbbbbbb',
]);

// MANDIBLES: pincers rooted INSIDE the head lobe and hooking forward past it,
// brass at the tip. Rooted rather than floated — a jaw that starts in open air
// beside the head reads as a dropped sprite, not a jaw.
const MAND_R = [
  'kk......',
  'kUn.....',
  'kUVk....',
  '.kUVk...',
  '.kUVUk..',
  '..kzbBk.',
  '..kzbk..',
  '...kk...',
];
const MAND_L = MAND_R.map(r => [...r].reverse().join(''));

// ---------------------------------------------------------------------------
// The chassis itself
// ---------------------------------------------------------------------------

/** Lay one riveted BRASS HOOP across the drum at row y. */
function hoop(g, y, shrink) {
  // The hoop lies ON the drum, so the lines that bound it are interior
  // linework. Two rows of near-black run the full 52px width of the chassis
  // twice over — that alone was ~190 of the old sprite's 883 black pixels.
  const band = ['n', 'B', 'b', 'z', 'n'];
  for (let x = 0; x < W; x++) {
    for (let dy = 0; dy < band.length; dy++) {
      const yy = y - 1 + dy;
      if (shellField(x, yy, shrink) > 0.88) continue;
      put(g, x, yy, band[dy]);
    }
  }
  // rivets sunk into the plate just under the hoop
  for (let x = 5; x < W - 4; x += 7) {
    if (shellField(x, y + 5, shrink) > 0.70) continue;
    put(g, x, y + 5, 'j'); put(g, x, y + 6, 'q');
  }
}

function bodyRows(shed) {
  const g = blank();
  const shrink = shed ? 1 : 0;
  // Plated, the bays are blackened iron. Shed, the plates are gone and the
  // bays ARE the firebox — same shape, opposite temperature.
  const ramp = shed
    ? ['G', 'g', 'e', 'E', 'r']
    : ['j', 'J', 'I', 'i', 'q'];

  // THE LIGHT. The old thresholds put the whole right half of a top-down drum
  // into the darkest step — on a 52px-wide chassis that is ~390 pixels, 13% of
  // the sprite, in one flat near-black tone. The bands are re-cut so the drum
  // rolls light-to-dark across five steps instead of two, which is what makes
  // a cylinder read as a cylinder.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = shellField(x, y, shrink);
      if (d > 1) continue;
      if (d > 0.88) { put(g, x, y, 'k'); continue; }
      // the hard arc where the head lobe is pushed clear of the drum — an
      // interior seam between two of the machine's own parts, not a silhouette
      const bF = drum(x, y, shrink);
      if (headLobe(x, y, shrink) < 0.88 && bF > 0.82 && bF < 1.4) {
        put(g, x, y, 'n'); continue;
      }
      const nx = (x - 24) / 18, ny = (y - 18) / 16;
      const lit = (-nx * 0.55 - ny * 1.0);
      let idx;
      if (lit > 0.58) idx = 0;
      else if (lit > 0.10) idx = 1;
      else if (lit > -0.42) idx = 2;
      else if (lit > -1.00) idx = 3;
      else idx = 4;
      put(g, x, y, ramp[idx]);
    }
  }
  // THE CROWN SPECULAR — a hard near-white lip along the upper-left arc, the
  // same mark the reference boss puts across the top of its helm. Widened from
  // the old 0.45 cut: the specular is what tells you the drum is metal.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = shellField(x, y, shrink);
      if (d <= 0.66 || d > 0.88) continue;
      const nx = (x - 24) / 18, ny = (y - 18) / 16;
      if ((-nx * 0.55 - ny * 1.0) > 0.20) put(g, x, y, shed ? 'G' : 'j');
    }
  }
  // vertical plate seams: the drum is built from staves, not cast in one piece.
  // A groove is a dark line with a lit line beside it, and neither of them is
  // black — a black stave line on a lit drum reads as a crack right through.
  for (const sx of [12, 20, 43, 51]) {
    for (let y = 0; y < H; y++) {
      if (shellField(sx, y, shrink) > 0.78) continue;
      put(g, sx, y, shed ? 'E' : 'n');
      if (shellField(sx + 1, y, shrink) <= 0.78) put(g, sx + 1, y, shed ? 'g' : 'J');
    }
  }
  // the boiler hoops, top and bottom of the drum, with the cradle between them
  hoop(g, 9, shrink);
  hoop(g, 39, shrink);
  // scorch bloom where the chimney meets the plating
  for (const [sx, sy] of [[24, 6], [38, 6], [28, 4], [34, 4]]) {
    if (shellField(sx, sy, shrink) > 0.7) continue;
    put(g, sx, sy, 'h'); put(g, sx + 1, sy, 'h'); put(g, sx, sy + 1, 'E');
  }
  return g;
}

// ---------------------------------------------------------------------------
// THE TWO WIND-UP DRESSES
//
// Round 12 measured the thing round 11 did not: not "does an attack differ
// from idle" but "can you tell WHICH attack is coming". `spinup` and `stoke`
// came back byte-identical on every frame where their shudder jitter aligned
// — 0 differing pixels out of a 6720-pixel boss box — and both played the same
// `gear` cue. Two of phase 2's three attacks were information-free for their
// whole 44-frame commitment window.
//
// The fix has to be legible at 1x from across the arena, so each dress is a
// different COLOUR FAMILY doing a different KIND of motion:
//
//   stoke  = HEAT.    The firebox stands up. The grilles blow open, the stave
//                     seams glow through the plating, and a belt of the drum
//                     around the firebox line cooks from verdigris to white.
//                     Orange/white, static, growing.
//   spinup = MOTION.  The legs wind. Brass streak arcs whip round the chassis,
//                     the six knee pins ring bright, and four ticks chase
//                     round the cradle bezel. Brass/steel-white, rotating.
//
// A player who has seen each once never confuses them: one gets hotter in
// place, the other spins.
// ---------------------------------------------------------------------------

// Under heat every ramp walks ONE STEP, never straight to white: five steps of
// verdigris become five steps of fire, five steps of fire become five hotter
// steps. Slamming the top three to '#ffffff' filled the drum with a flat white
// oval — the same "solid silhouette" mistake the old hit flash made, just in a
// different state.
const HEAT_MAP = {
  j: 'w', J: 'G', I: 'g', i: 'e', q: 'E',            // verdigris chassis -> fire
  G: 'w', g: 'G', e: 'g', E: 'e', r: 'E',            // shed firebox chassis, +1
  n: 'E', h: 'g',                                    // interior linework, scorch
  B: 'w', b: 'G', z: 'g',                            // brass hoops and rivets
  W: 'w', v: 'G',
};

/**
 * `stoke`: cook a belt of the chassis around the firebox line.
 * @param {string[]} g     the composed body
 * @param {number} flare   1..3, the wind-up's build
 * @param {number} shrink  shed shrink, so the wash follows the silhouette
 */
function heatWash(g, flare, shrink) {
  // The grilles sit at rows 22..30; the belt opens outward from that line as
  // the draught builds, and at full flare it has climbed to the hoops.
  const half = 3 + flare * 4;
  for (let y = 0; y < H; y++) {
    const dy = Math.abs(y - 26);
    if (dy > half) continue;
    for (let x = 0; x < W; x++) {
      const ch = g[y][x];
      if (ch === '.' || ch === 'k' || ch === 'x') continue;   // keep the keyline
      if (shellField(x, y, shrink) > 0.9) continue;           // chassis only
      // The belt is DITHERED at its edge — a hard-edged band of hot colour
      // across a drum reads as a stripe painted on, not as metal glowing.
      if (dy > half - 3 && ((x + y) & 1)) continue;
      const hot = HEAT_MAP[ch];
      if (hot) put(g, x, y, hot);
    }
  }
  // the stave seams carry the fire the length of the drum, well past the belt
  for (const sx of [12, 20, 43, 51]) {
    for (let y = 0; y < H; y++) {
      if (shellField(sx, y, shrink) > 0.78) continue;
      if (flare < 3 && ((y + sx) & 3) === 0) continue;
      put(g, sx, y, flare > 1 ? 'G' : 'E');
      if (shellField(sx + 1, y, shrink) <= 0.78) put(g, sx + 1, y, flare > 1 ? 'w' : 'g');
    }
  }
  // embers loose in the draught, over the plating — the coals are coming
  if (flare > 1) {
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399 + flare;
      const r = 12 + ((i * 7 + flare * 3) % 18);
      const x = Math.round(31.5 + Math.cos(a) * r * 1.25);
      const y = Math.round(26 + Math.sin(a) * r * 0.8);
      if (shellField(x, y, shrink) > 0.88) continue;
      put(g, x, y, (i & 1) ? 'w' : 'G');
    }
  }
}

/**
 * `spinup`: brass streaks whipping round the chassis, knee pins lit, four
 * ticks chasing round the cradle bezel. `k` (0..3) rotates the whole rig.
 */
function spinDress(g, k, legPose) {
  const TAU = Math.PI * 2;
  const roll = k * (TAU / 16);
  // --- four motion arcs, at the drum's diagonals so they never cross the
  //     chimney (whose cap going white-hot is the CHARGE tell) and the
  //     silhouette stays readable. They pass OVER the legs — a blur that stops
  //     dead at a shin is not a blur.
  for (let arm = 0; arm < 4; arm++) {
    const a0 = roll + arm * (TAU / 4) + 0.52;
    for (let s = 0; s <= 30; s++) {
      const t = s / 30;
      const a = a0 + t * 0.86;
      // leading tip is the bright note; the tail falls off to dark brass
      const ch = t > 0.82 ? 'w' : t > 0.58 ? 'B' : t > 0.28 ? 'b' : 'z';
      const dim = ch === 'w' ? 'B' : ch === 'B' ? 'b' : 'z';
      for (const rr of [0, 1, 2]) {
        const x = Math.round(31.5 + Math.cos(a) * (31 - rr * 2.2));
        const y = Math.round(25 + Math.sin(a) * (26 - rr * 1.8));
        if (y < 1) continue;
        // the streak passes BEHIND the machine, never over the chassis
        if (shellField(x, y, 0) <= 0.94) continue;
        put(g, x, y, rr === 0 ? ch : dim);
      }
    }
  }
  // --- the six knee pins spun up: a bright ring with a chasing comet head
  for (let side = 0; side < 2; side++) {
    LEGS.forEach((chain, li) => {
      const st = legPose ? LEG_STEP[li] : [0, 0];
      const kx0 = chain[1][0] + st[0], ky0 = chain[1][1] + st[1];
      const kx = side ? W - 1 - kx0 : kx0;
      for (let i = 0; i < 12; i++) {
        const a = roll * 2 + i * (TAU / 12);
        for (const rr of [3.2, 4.6]) {
          const x = Math.round(kx + Math.cos(a) * rr);
          const y = Math.round(ky0 + Math.sin(a) * rr * 0.9);
          put(g, x, y, rr > 4 ? ((i & 1) ? 'B' : 'z') : ((i & 1) ? 'w' : 'b'));
        }
      }
      // the comet head, one bright blob leading the ring round
      const ah = roll * 2 + 0.4;
      disc(g, kx + Math.cos(ah) * 4.6, ky0 + Math.sin(ah) * 4.1, 1.6, 'w');
      put(g, Math.round(kx), Math.round(ky0), 'w');
    });
  }
  // --- four ticks chasing round the cradle bezel (cradle is stamped at 19,17
  //     and is 26x22, so its centre is 32,28)
  for (let i = 0; i < 4; i++) {
    const a = -roll * 3 + i * (TAU / 4);
    for (const rr of [8.5, 10]) {
      const x = Math.round(32 + Math.cos(a) * rr);
      const y = Math.round(28 + Math.sin(a) * rr * 0.85);
      put(g, x, y, rr > 9 ? 'w' : 'B');
    }
  }
}

/**
 * @param {boolean} shed   phase 2+: the plates are off and the boiler shows
 * @param {number}  valve  0 shut / 1 venting tell / 2 blown open / 3 SEIZED —
 *                         chimney shut but the cradle white-hot, which is the
 *                         only state in which the Cogblade does anything
 * @param {boolean} legPose alternating tripod
 * @param {?{kind:string,k:number}} wind  the wind-up dress, if any
 */
function composeBody(shed, valve, legPose, wind) {
  const seized = valve === 3;
  const shrink = shed ? 1 : 0;
  const stoke = wind && wind.kind === 'stoke' ? wind.k + 1 : 0;
  const g = blank();
  // legs first, then the chassis over their roots, so nothing floats
  stampLegs(g, legPose, shed);
  const shell = bodyRows(shed);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = shell[y][x];
      if (ch !== '.') put(g, x, y, ch);
    }
  }
  // flank grilles: the fire inside the boiler
  stampArt(g, 6, 22, grilleArt(shed, stoke));
  stampArt(g, W - 17, 22, grilleArt(shed, stoke));
  // the head
  stampArt(g, 20, 42, FACE);
  stampArt(g, 23, 39, BROW);
  stampArt(g, 16, 52, MAND_L);
  stampArt(g, W - 24, 52, MAND_R);
  // the empty cradle, welded into the back
  stampArt(g, 19, 17, cradleArt(valve === 2 || seized));
  // the chimney, breaking the top of the silhouette. NOTE the wind-up dresses
  // deliberately leave the stack alone: the cap going white-hot is the CHARGE
  // tell, and it is the one telegraph the round-12 critic scored as working.
  stampArt(g, 25, 0, chimneyArt(seized ? 0 : valve));
  if (stoke) heatWash(g, stoke, shrink);
  if (wind && wind.kind === 'spin') spinDress(g, wind.k, legPose);
  return g;
}

let CACHE = null;

/** One string grid -> the four headings, as pixel-exact flips and rotations. */
function facings(grid, pal) {
  const down = makeSprite(grid, pal);
  const left = rotate90(rotate90(rotate90(down)));
  return { down, up: flipV(down), left, right: flipH(left) };
}

// How many animation steps each wind-up dress has. SPIN rotates (4 steps, one
// full turn every 16 frames at 4 frames a step). STOKE builds (3 steps across
// the 46-frame tell, so the fire is visibly standing up, not blinking).
export const SPIN_STEPS = 4, STOKE_STEPS = 3;

export function makeKettlebackSprites() {
  if (CACHE) return CACHE;
  const body = [], flash = [];
  for (let shed = 0; shed < 2; shed++) {
    body[shed] = []; flash[shed] = [];
    for (let v = 0; v < 4; v++) {
      body[shed][v] = []; flash[shed][v] = [];
      for (let leg = 0; leg < 2; leg++) {
        // ONE grid, TWO palettes: the flash is the same drawing, cycled hot.
        const grid = composeBody(!!shed, v, !!leg);
        body[shed][v][leg] = facings(grid, BPAL);
        flash[shed][v][leg] = facings(grid, FPAL);
      }
    }
  }
  // The wind-up dresses. Only phases 2 and 3 use them and both are shed, but
  // both plate states are built so the fight can never ask for one that is
  // missing.
  const spin = [], stoke = [];
  for (let shed = 0; shed < 2; shed++) {
    spin[shed] = [];
    for (let k = 0; k < SPIN_STEPS; k++) {
      spin[shed][k] = facings(composeBody(!!shed, 0, !!(k & 1), { kind: 'spin', k }), BPAL);
    }
    stoke[shed] = [];
    for (let k = 0; k < STOKE_STEPS; k++) {
      stoke[shed][k] = facings(composeBody(!!shed, 0, !!(k & 1), { kind: 'stoke', k }), BPAL);
    }
  }
  CACHE = { body, flash, spin, stoke, dungeon: makeBoilerworks().sprites };
  return CACHE;
}

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

// ---------------------------------------------------------------------------
// The fight
// ---------------------------------------------------------------------------

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// ---------------------------------------------------------------------------
// CINDERS — phase 2's second threat.
//
// The firebox spits a rake of coals along the deck. Each one lies there
// cooking (a scorch bloom that brightens to white) for 34 frames and then
// blows a column of fire for another 34. Two answers, and the second one is
// the reason this attack exists: a Bellows Cuff blast puts a coal out, which
// is the SAME verb the room's steam vents taught, aimed at a moving problem
// instead of a fixed one.
//
// Duck-typed to match the room's steam vents (`x`, `y`, `snuffOut()`), so
// items.js's Cuff can act on them through the path it already has.
// ---------------------------------------------------------------------------

const CIN_WARN = 34, CIN_BURN = 34, CIN_FADE = 14;

export class Cinder {
  constructor(x, y, delay = 0) {
    this.cx = x; this.cy = y;
    this.t = -delay;
    this.dead = false;
    this.snuffed = false;
  }
  get x() { return Math.round(this.cx) - 8; }
  get y() { return Math.round(this.cy) - 8; }
  get live() { return this.t >= 0 && !this.dead && !this.snuffed; }
  get dangerous() {
    return !this.snuffed && this.t >= CIN_WARN && this.t < CIN_WARN + CIN_BURN;
  }
  hurtbox() { return { x: this.cx - 6, y: this.cy - 8, w: 12, h: 15 }; }
  /** The Cuff's answer. Returns true when the blast actually did something. */
  snuffOut() {
    if (this.dead || this.snuffed || this.t >= CIN_WARN + CIN_BURN) return false;
    this.snuffed = true;
    this.t = CIN_WARN + CIN_BURN;
    return true;
  }
  update() {
    this.t++;
    if (this.t > CIN_WARN + CIN_BURN + CIN_FADE) this.dead = true;
  }

  /**
   * The coal on the deck — drawn under everything, with the floor.
   *
   * DITHERED, never a filled rectangle. A solid dark block on the steel deck
   * reads as a hole in the floor, which is the one thing this must not say:
   * the player has to see something LYING ON the plate and getting hotter.
   */
  drawFloor(ctx, frame) {
    if (this.t < 0 || this.dead) return;
    const x = Math.round(this.cx), y = Math.round(this.cy);
    const scorch = (r, near, far) => {
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r - 2; xx <= r + 2; xx++) {
          const d = (xx * xx) / ((r + 2) * (r + 2)) + (yy * yy) / (r * r || 1);
          if (d > 1) continue;
          if (d > 0.46 && ((xx + yy) & 1)) continue;
          ctx.fillStyle = d > 0.46 ? far : near;
          ctx.fillRect(x + xx, y + yy, 1, 1);
        }
      }
    };
    if (this.t < CIN_WARN) {
      const p = this.t / CIN_WARN;
      scorch(3 + Math.round(p * 3), '#4a2410', '#33190e');
      // A RING OF CRACKS opening outward — this is the tell that says how big
      // the column is going to be, and it has to be legible with an arena jet
      // hissing over the top of it.
      const arm = p > 0.62 ? '#ffd84c' : p > 0.34 ? '#f88828' : '#8c2416';
      const rr = 2.5 + p * 5;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.7854 + 0.39;
        ctx.fillStyle = arm;
        ctx.fillRect(x + Math.round(Math.cos(a) * rr) - (i & 1 ? 0 : 1),
          y + Math.round(Math.sin(a) * rr * 0.72), i & 1 ? 1 : 2, 1);
      }
      // the coal itself, cooking dull red -> white
      const hot = p > 0.74 ? '#ffffff' : p > 0.46 ? '#ffd84c' : p > 0.2 ? '#f88828' : '#e04a2a';
      ctx.fillStyle = '#8c2416';
      ctx.fillRect(x - 3, y - 2, 7, 5);
      ctx.fillStyle = hot;
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillRect(x - 3, y - 1, 7, 3);
      if (p > 0.66 && (frame & 2)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 4, y - 1, 9, 3);
        ctx.fillRect(x - 1, y - 4, 3, 9);
      }
      return;
    }
    scorch(6, '#4a2410', '#2a140c');
  }

  /** The column of fire — drawn over the world, like the vents' jets. */
  drawOver(ctx, frame) {
    if (this.dead || this.t < CIN_WARN) return;
    const x = Math.round(this.cx), y = Math.round(this.cy);
    const n = this.t - CIN_WARN;
    if (this.snuffed) {
      // a fat grey puff where the fire should have been — the Cuff's receipt
      const k = Math.min(CIN_FADE, this.t - (CIN_WARN + CIN_BURN));
      const r = 4 + k;
      if (k > CIN_FADE - 1) return;
      ctx.fillStyle = k > 7 ? '#8496ac' : '#c8d4e0';
      ctx.fillRect(x - r, y - 3 - (r >> 1), r * 2, r);
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(x - (r >> 1), y - 2 - (r >> 2), r, r >> 1);
      return;
    }
    if (n >= CIN_BURN) return;
    const g = n < 5 ? n / 5 : n > CIN_BURN - 8 ? (CIN_BURN - n) / 8 : 1;
    const h = Math.max(3, Math.round(5 + g * 26));
    const w = 4 + g * 7;
    // a white-hot pool at the base so the column has a foot on the plate
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - Math.round(w / 2), y + 2, Math.round(w), 2);
    ctx.fillStyle = '#ffd84c';
    ctx.fillRect(x - Math.round(w / 2) - 1, y + 4, Math.round(w) + 2, 1);
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const ww = Math.max(1, Math.round(w * (1 - t * 0.58)));
      const jit = t > 0.4 ? ((frame + i * 3) % 5) - 2 : 0;
      ctx.fillStyle = t < 0.2 ? '#ffffff' : t < 0.46 ? '#ffd84c'
        : t < 0.74 ? '#f88828' : '#e04a2a';
      ctx.fillRect(x - (ww >> 1) + jit, y + 3 - i, ww, 1);
      // dark edge on the flame's right so it does not blow out into a blob
      if (ww > 3) {
        ctx.fillStyle = '#8c2416';
        ctx.fillRect(x - (ww >> 1) + jit + ww - 1, y + 3 - i, 1, 1);
      }
    }
    // sparks off the top
    if ((frame & 3) === 0) {
      ctx.fillStyle = '#ffd84c';
      ctx.fillRect(x + (((frame >> 2) % 5) - 2), y + 1 - h - 2, 1, 2);
    }
  }
}

// ---------------------------------------------------------------------------
// STEAM LANCES — phase 3's second threat.
//
// It roots itself, jams the chimney and lets go through four leg sockets at
// once: four beams sweeping around it. The gap between them is a quarter turn
// wide and it MOVES, so the answer is not "leave the lane", it is "keep
// circling with the gap" — a different kind of reading from every other
// attack in the fight.
// ---------------------------------------------------------------------------

// SWEEP SPEED IS SET BY WREN'S LEGS, not by taste. He walks 1.5px/frame; at
// the ~78px standoff the gap invites, 0.0115 rad/frame is 0.90px/frame of
// tangential travel, so holding the gap costs 60% of his speed and leaves him
// room to correct. The first cut ran at 0.0185 — 1.44px/frame, 96% of walk
// speed — which is not a dodge, it is a treadmill you lose on any error.
// ROUND-22, playtest P0 #3(d) asked for phase 3 softened "by one lance
// rotation". IT WAS TRIED AND IT MEASURED WORSE, so 210 stays. At LANCE_SPIN
// the gap turns 0.0115 rad/frame, so 210 frames is 2.415 rad — one and a half
// of the quarter-turns the four-armed fan is spaced at — and cutting it to 176
// takes one of those rotations off. Eight seeds at lag 16
// (tools/critic/c15-bossbot.js), phase-3 half-hearts lost:
//     210:  6 6 6 5 5 6 5 5  = 44
//     176:  5 8 6 6 6 5 6 5  = 47
// Phase 3 got 3% shorter and 7% MORE expensive, for the reason `dangerous`
// documents two screens down: the boss is ROOTED and harmless to touch for the
// whole sweep, so lance frames are the cheapest frames in the phase. Shortening
// them only buys the player more charges, cinders and arena jets. The softening
// that phase 3 actually wanted went in elsewhere — see _ventWindow().
const LANCE_WIND = 44, LANCE_LIVE = 210, LANCE_SPIN = 0.0115, LANCE_ARMS = 4;
const LANCE_R0 = 32, LANCE_R1 = 108, LANCE_STEP = 8;

// ---------------------------------------------------------------------------
// BLOWDOWN — the recovery frames on the way OUT of a safe window.
//
// ROUND-25, the final playtest: "phase 2 is a difficulty cliff about 100 ms of
// human reaction time wide." Reproduced with tools/critic/bt22-naive.js
// --mode reader (the bot whose policy is a literal transcription of the
// dungeon's own plaques — a player who read and understood everything), swept
// across reaction latencies:
//
//     lag  6 (100 ms)  1 attempt,  10-11 half-hearts lost
//     lag 12 (200 ms)  1 attempt,  11-14
//     lag 18 (300 ms)  2-4 attempts, 16-33
//     lag 20 (333 ms)  NEVER, 3/3 seeds, 16-18 deaths, ~147 half-hearts
//
// tools/critic/bb-diag.js attributes every one of those half-hearts to the
// boss's state on the frame it landed, and the single largest source in the
// whole fight was not an attack. It was the frame a SAFE WINDOW CLOSED:
//
//     16  boss-body  [2|seized -> 2|idle]  @d<30
//     14  boss-body  [1|seized -> 1|idle]  @d<30
//     11  boss-body  [2|vent   -> 2|idle]  @d<30
//
// 41 of ~110 half-hearts — 37% of all damage taken — on the exact two windows
// `dangerous` goes out of its way to make safe, because the fight ORDERS the
// player to stand inside the body box during them (Cuff the chimney, then
// slash the cradle from on top of it) and then flips the box live under their
// feet with zero frames of grace. A player with 100 ms of reaction steps off
// in time. A player with 333 ms does not, and there is nothing on screen that
// could have told them the frame was coming. That is not difficulty; that is
// the coin flip the critic measured, and it is charged on the one input the
// whole fight is teaching.
//
// So the boiler BLOWS DOWN before it gets back on its legs: 34 frames — the
// fight's own telegraph floor, the same number every attack in the file gets
// before it is allowed to bite — in which it judders, dumps steam out of its
// skirt at deck level, and cannot hurt you by touch. It is drawn (see
// _drawBlowdown) and it is audible, so it is a read and not a mercy.
//
// ROUND-26 CORRECTION, and it matters. The paragraph that used to stand here
// claimed the blowdown "costs a fast player nothing… not one hit point is
// added". That was reasoning, not measurement, and the measurement says the
// opposite: at lag 8 (133 ms) `boss-body [N|seized -> N|idle]` was the single
// largest damage entry on every seed, 5-8 half-hearts a run, and a flat
// 34-frame immunity refunds all of it. The learner bot went from a median of
// two attempts to ten first-try clears out of ten. STORY.md asks for "beatable
// on the second or third try"; that is a miss on the easy side.
//
// THE BLOWDOWN FRAMES STAY, AND ROUND 26 MADE THEM LONGER — 44, not 34.
//
// Round 26 tried four ways of making these frames cost the fast player
// something and every one of them charged the slow player instead; the numbers
// are in _dropHeart(), because the knob that finally worked was the heart drop
// and not this one. What is worth recording here is the asymmetry those failed
// attempts exposed. Cutting the window to nothing — grace only until Wren is
// clear of the chassis — cost the 333 ms reader bot everything, 7/3/11/10
// attempts to NEVER on both seeds tried, and cost the 133 ms learner about one
// half-heart. These frames are worth an order of magnitude more to a slow
// player than to a fast one: a fast player is off the chassis inside five of
// them and the rest are spare.
//
// So they run the other way now. 44 is what a player reacting at 300+ ms needs
// to read the steam, turn, and clear the box before the shell goes live, and it
// is the only lever in the file that hands time to exactly the player the
// round-25 cliff was about.
//
// THE NUMBER IS 44 AND NOT 48 OR 52, and the sweep is worth writing down so the
// next round does not re-derive it the expensive way. Reader bot, five seeds,
// attempts to the kill:
//
//              100ms      200ms        300ms        400ms          500ms
//   34 (was)   1 1 1 1 1  2 1 2 1 1    3 2 2 3 1    3 3 2 2 2      -
//   44         1 1 1 1 1  2 1 2 1 1    3 3 3 3 3    3 3 2 2 2      4 11 1 6 21
//   52         1 1 1 1 1  2 1 1 1 1    1 1 2 2 1    4 5 3 3 5      9 7 5 10 14
//
// 52 is the tempting one — it is the only value in the sweep that gets the
// learner bot's median at 133 ms to the 2 STORY.md asks for, and it makes 300 ms
// comfortable rather than exactly-on-the-line. It is also the value that breaks
// the far end: 400 ms goes to 4/5/3/3/5 and the "beatable on the second or third
// try" band, which runs 100-400 ms at 44, stops at 300. Round 25's whole finding
// was about the WIDTH of that band, so the band wins.
//
// One more thing about this sweep. The two latencies NOT divisible by 6 — 333
// and 367 ms — jump around violently between neighbouring values of this one
// constant (48 is the worst of the four at both and the best at neither),
// because at those lags the probe bot's `f % 6` cuff gate and `f % 3` swing gate
// alias and it presses B about a third as often as it does anywhere else. What
// moves there is the beat frequency between the boiler's cadence and the bot's
// decision period, not the fight. Tune on 6/12/18/24/30; report 20/22; do not
// tune on 20/22.
const RECOVER = 44;

// THE ONE HEALTH GATE ON THE RECOVERY HEART: the ALttP last-heart bias. A seize
// taken on one heart or less always coughs one out, and nothing else does.
//
// Not negotiable downward — measured at 333 ms of reaction lag, moving it from
// 2 to 1 took the reader bot from 7/3/11/10 attempts to NEVER on three seeds
// out of three, 16-18 deaths apiece. This threshold IS the difficulty tail; it
// is the only thing standing between a slow player and the die-retry-die
// spiral, and every round that has touched it has regretted it.
const DROP_AT = 2;

// ---------------------------------------------------------------------------
// THE ROTATION.
//
// Each phase runs its script from the top and then draws from its pool. The
// script exists so the phase's IDEAS ARE GUARANTEED TO HAPPEN and to happen in
// a readable order — phase 2 opens with the spin every single time, phase 3
// shows a double charge before it roots itself for the lances — and the pool
// exists so a player who stalls does not get a metronome.
//
// It also spaces the seizes out. Only `charge`, `charge2` and `spin` end in an
// open valve, so a phase is several decisions long even when the player Cuffs
// every window it offers.
// ---------------------------------------------------------------------------
// Measured (tools/critic/bossline.js, five seeds): with phase 2 scripted
// spin/cinder/charge/charge/cinder/spin, a phase that lasts about five
// decisions showed its advertised SPIN exactly 1.2 times per run, because both
// spins sat at the ends of the script. Phase 3 showed its LANCE 1.2 times for
// the same reason. Each phase's signature attack is now inside the first four
// entries twice over, so the thing the phase is FOR is what the phase is made
// of, not a garnish on either end of it.
const PHASE_SCRIPT = {
  1: ['charge', 'charge', 'charge'],
  2: ['spin', 'cinder', 'charge', 'spin', 'cinder', 'charge'],
  3: ['charge2', 'lance', 'cinder', 'lance', 'charge2', 'lance'],
};
const PHASE_POOL = {
  1: ['charge'],
  2: ['spin', 'cinder', 'charge'],
  3: ['lance', 'charge2', 'cinder'],
};

export const KETTLEBACK_MAX_HP = 18;

export class Kettleback {
  /** @param {object} opts { cx, cy, arena:{x,y,w,h}, onSfx, onLurch } */
  constructor(opts = {}) {
    this.cx = opts.cx ?? 128;
    this.cy = opts.cy ?? 92;
    this.arena = opts.arena || { x: 32, y: 32, w: 192, h: 160 };
    this.spr = makeKettlebackSprites();
    this.hp = KETTLEBACK_MAX_HP;
    this.maxHp = KETTLEBACK_MAX_HP;
    this.dir = 'down';
    this.state = 'wake';
    this.timer = 70;
    this.valve = 0;               // 0 closed, 1 venting tell, 2 blown open
    this.shed = false;
    this.stalled = 0;
    this.recover = 0;             // blowdown frames after a safe window shuts
    this.iframes = 0;
    this.flash = 0;
    this.legT = 0;
    this.shudder = 0;
    this.windT = 0;               // frames into the current wind-up dress
    this.charges = 0;
    this.chargeRun = 0;           // px travelled this lunge (arms the wall test)
    this.chargeMin = 20;
    this.spinT = 0;
    this.spinAngle = 0;
    this.seizeHits = 0;           // Cogblade hits taken in THIS seize (max 2)
    this.seizes = 0;              // seizes survived (paces the heart drops)
    this.cycle = 0;               // attacks chosen since this phase began
    this._lastKind = null;        // no attack twice running out of the pool
    this._phaseSeen = 1;
    this.embers = [];             // live cinders on the deck
    this.lance = null;            // { t, base } while the steam fan is up
    this.lanceDir = 1;
    this._recalled = false;       // phase 3 has wound the escorts down
    this._recall = false;         // ...and the room has not been told yet
    this.blasts = [];
    this.spawn = [];              // beetles requested by phase 2
    this.drops = [];              // recovery hearts requested on a phase change
    // HAS THE PLAYER EVER DONE IT? Set by the first successful hitByCuff() and
    // never cleared again — not by a phase change, not by resetToPhaseTop(),
    // because a player who has choked the stack once has learned the fight and
    // must not be re-taught. Everything the teaching does hangs off this, so a
    // player who knows the answer plays the fight the round-21 critic verified,
    // frame for frame, from their second seize onwards. See _ventWindow() and
    // _drawValveCue().
    this.taught = false;
    this.dieT = -1;
    this.dead = false;
    this.beaten = false;          // death animation finished
    this.onSfx = opts.onSfx || null;
    this.onLurch = opts.onLurch || null;
    this.onHealth = opts.onHealth || null;   // Wren's half-hearts, for the drop bias
    this.overheat = 0;            // 0..1 floor glow in phase 3
  }

  // --- geometry -------------------------------------------------------------

  get horiz() { return this.dir === 'left' || this.dir === 'right'; }
  get halfW() { return this.horiz ? H / 2 : W / 2; }
  get halfH() { return this.horiz ? W / 2 : H / 2; }
  get baseY() { return this.cy + this.halfH; }

  /**
   * Body box — contact damage and wall collision. Deliberately inset well
   * inside the silhouette: the legs and the chimney are part of the picture,
   * not part of the hitbox, and a boss whose spindly legs bite is a boss the
   * player learns to hate rather than to read.
   */
  bodybox() {
    const ix = this.horiz ? 12 : 11, iy = this.horiz ? 11 : 12;
    return {
      x: this.cx - this.halfW + ix, y: this.cy - this.halfH + iy,
      w: this.halfW * 2 - ix * 2, h: this.halfH * 2 - iy * 2,
    };
  }

  /**
   * The cradle: what the Cogblade can actually reach, and only when seized.
   *
   * Reaches most of the way to the chassis edge ON PURPOSE. The box used to be
   * 32x28 on a 64x60 body, which meant the only place the blade connected was
   * a spot where the boss is drawn straight over Wren — the fight was telling
   * you to stand exactly where you become invisible. From the rim the swing
   * arc now lands, and the room sorts him above the boiler while it is seized.
   */
  hurtbox() {
    if (this.stalled <= 0) return { x: this.cx - 3, y: this.cy - 3, w: 6, h: 6 };
    return { x: this.cx - 27, y: this.cy - 25, w: 54, h: 50 };
  }

  /**
   * The open chimney valve on its back — the Cuff target. Generous on
   * purpose: the Cuff's reach is short, the window is 90 frames, and a boss
   * that punishes half a pixel of aim is a boss nobody beats on the third try.
   */
  blastbox() {
    const [dx, dy] = DIRV[this.dir];
    return {
      x: this.cx - dx * 24 - 18, y: this.cy - dy * 24 - 18, w: 36, h: 36,
    };
  }

  /**
   * IS THE ONE OPENING IN THIS BOSS OPEN RIGHT NOW?
   *
   * The exact precondition `hitByCuff()` tests, published under a name, so the
   * room can ask "is the answer available this frame?" without restating the
   * condition and without drifting from it. scenes/dungeon.js reads it to know
   * when a Cogblade swing at the shell is a swing the player could not have
   * won with — see `_shellTeach`, the line that stopped the fight being silent
   * about a Cuff that is not on the button.
   */
  get valveOpen() {
    return this.dieT < 0 && this.valve === 2 && this.stalled <= 0;
  }

  get phase() {
    const t = this.maxHp / 3;
    return this.hp > t * 2 ? 1 : this.hp > t ? 2 : 3;
  }
  get vulnerable() { return this.stalled > 0; }
  /** The blade only bites twice per seize; after that the collar has cooled. */
  get bladeBites() { return this.stalled > 0 && this.seizeHits < 2; }

  /**
   * Does touching it hurt right now?
   *
   * NOT while it is SEIZED, and not while it is VENTING. Those are the two
   * windows the whole fight asks the player to stand next to it — one to Cuff
   * the chimney, one to slash the cradle — and body damage there punishes the
   * exact input the design is teaching. (Measured: this alone took a scripted
   * three-heart run from thirteen deaths to two.)
   */
  get dangerous() {
    // ...NOR while the steam LANCES are up, for the same reason. It is ROOTED
    // for those 210 frames and everything it has is going out through the leg
    // sockets; the beams are the attack, the shell is furniture. The sweep
    // asks the player to orbit inside 80px tracking a moving gap, so a shell
    // that bites on the way past is taxing the exact input the attack teaches.
    // Measured (tools/critic/bd-bossbot2.js): plain body contact during the
    // lance was the LARGEST single damage source in phase 3 — more than the
    // beams themselves — at 11, 12 and 38 half-hearts across three seeds.
    // ...NOR for the RECOVER frames after either of those windows shuts. See
    // the BLOWDOWN note above RECOVER: the frame `stalled` hit zero and the
    // frame the vent timer ran out were between them the largest single damage
    // source in the fight, and both of them charged the player for standing
    // exactly where the fight told them to stand.
    //
    // ROUND 26 TRIED ENDING THIS ON POSITION instead of on the clock — grace
    // until Wren is clear of the chassis, then live — on the theory that it
    // would charge the player who dives straight back in and nobody else. It
    // measured WORSE, and worse in the direction that matters: at 333 ms the
    // reader bot went from 7/3/11/10 attempts to NEVER on both seeds tried, 13
    // to 16 deaths and ~120 half-hearts, i.e. all the way back to the round-25
    // cliff. The 34 frames were not paying for the transition frame alone; they
    // were paying for the whole REPOSITION, and a slow player needs every one
    // of them. The margin the fast player owes came off the recovery drop
    // instead — see the seize block in update(), which reads the player's
    // hearts and not the clock.
    return this.dieT < 0 && !this.vulnerable && this.recover <= 0
      && this.state !== 'vent' && this.state !== 'lance';
  }

  sfx(name) {
    if (this.onSfx) this.onSfx(name);
    else if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  }

  // --- damage ---------------------------------------------------------------

  /**
   * The Cogblade. Rings off the shell unless the boiler is seized — and even
   * seized it only bites TWICE. The collar cools, the boiler shrugs the blade
   * off and gets back on its legs.
   *
   * This cap is the whole reason the fight has a shape. Uncapped, a seize was
   * worth four hits, twelve hit points was three seizes, and each of the three
   * phases lived and died inside a single stagger window: everything phase 2
   * and 3 had to say got said once, in one 240-frame breath, and then the
   * fight was over. Two per seize means nine seizes and twelve attack
   * decisions, which is enough room for a phase to actually be a phase.
   */
  onHit() {
    if (this.dead || this.dieT >= 0) return 'none';
    if (!this.bladeBites) {
      if (this.iframes > 0) return 'none';
      this.iframes = 12;
      this.sfx('clink');
      return 'block';
    }
    if (this.iframes > 0) return 'none';
    this.hp--;
    this.seizeHits++;
    this.iframes = 14;
    this.flash = 6;
    // `hit` is the blade in a drone's hide. This is the blade in a seized
    // BOILER, and the bank has the sound for it: `bosshit` is the same
    // attack shape with twice the mass and a plate ringing afterwards.
    this.sfx('bosshit');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dieT = 0;
      this.state = 'die';
      this.stalled = 0;
      this.embers.length = 0;
      this.lance = null;
      this.sfx('roar');
      return 'hit';
    }
    // second bite: the collar cools and it starts hauling itself upright
    if (this.seizeHits >= 2) {
      this.stalled = Math.min(this.stalled, 24);
      this.sfx('clink');
    }
    return 'hit';
  }

  /**
   * HOW LONG THE VALVE HANGS OPEN.
   *
   * The window is the only part of this fight a player can act on, and until
   * they have found it once it is also the only part of the fight that can
   * TEACH. So it stays open for at least 210 frames — 3.5 seconds, twice the
   * shipped 112 — while `taught` is false, and drops to the verified 112 / 80 /
   * 128 the frame after the first successful blast.
   *
   * This is the shape of the change on purpose: it costs a player who knows the
   * answer nothing (they cuff inside the first second either way, and every
   * window after their first is the number round 21 measured), and it gives a
   * player who does not one long, loud, repeated invitation instead of eight
   * separate 1.9-second ones. Measured before: every window 112 frames, and a
   * naive bot mashing B once every four seconds never got in, 10-12 deaths in
   * 24,000 frames across three seeds.
   */
  _ventWindow(base) { return this.taught ? base : Math.max(210, base); }

  /** The Bellows Cuff. Only the OPEN valve answers it. */
  hitByCuff() {
    if (this.dead || this.dieT >= 0) return false;
    if (this.valve !== 2 || this.stalled > 0) return false;
    this.taught = true;
    this.stalled = 104;
    this.seizeHits = 0;
    this.valve = 0;
    this.state = 'seized';
    this.timer = 104;
    this.sfx('steam');
    return true;
  }

  /**
   * Put it back on the top of the phase the player had reached. The room calls
   * this on a continue: you keep the phase you earned and lose the chip
   * damage, so KETTLEBACK cannot be ground down by dying at it.
   */
  resetToPhaseTop() {
    const t = this.maxHp / 3;
    this.hp = this.phase === 1 ? this.maxHp : this.phase === 2 ? t * 2 : t;
    this.state = 'idle'; this.timer = 60;
    this.valve = 0; this.stalled = 0; this.recover = 0; this.seizeHits = 0;
    this.charges = 0; this.lance = null; this.cycle = 0; this.seizes = 0;
    this.windT = 0; this._lastKind = null;
    this.embers.length = 0;
    this._phaseSeen = this.phase;
    this.cx = this.arena.x + this.arena.w / 2;
    this.cy = this.arena.y + 42;
  }

  // --- brain ----------------------------------------------------------------

  _faceToward(player) {
    const dx = (player.x + 8) - this.cx, dy = (player.y + 14) - this.cy;
    this.dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  _clamp() {
    const a = this.arena;
    this.cx = Math.max(a.x + this.halfW, Math.min(a.x + a.w - this.halfW, this.cx));
    this.cy = Math.max(a.y + this.halfH, Math.min(a.y + a.h - this.halfH, this.cy));
  }

  /** Clear runway between the chassis edge and the wall, in one direction. */
  _wallDist(dir) {
    const a = this.arena, [dx, dy] = DIRV[dir || this.dir];
    if (dx < 0) return this.cx - (a.x + this.halfW);
    if (dx > 0) return (a.x + a.w - this.halfW) - this.cx;
    if (dy < 0) return this.cy - (a.y + this.halfH);
    return (a.y + a.h - this.halfH) - this.cy;
  }

  /**
   * Touching the wall IT IS HEADED FOR. The old version tested all four edges
   * at once, so a boss parked against the right wall that charged DOWNWARD
   * ended its lunge on the first frame: a 46-frame telegraph paying off with
   * three pixels of movement, roughly one charge in four.
   */
  _atWall(dir) { return this._wallDist(dir) <= 0.5; }

  update(engine, player) {
    for (const b of this.blasts) b.update();
    this.blasts = this.blasts.filter(b => !b.done);
    if (this.flash > 0) this.flash--;
    if (this.iframes > 0) this.iframes--;
    if (this.shudder > 0) this.shudder--;
    // the blowdown: it is still off its legs and still dumping steam, so it
    // judders the whole way through and the shell cannot bite
    if (this.recover > 0) {
      this.recover--;
      if ((this.recover & 7) < 3) this.shudder = 2;
    }
    this.overheat = this.phase === 3 && this.dieT < 0
      ? Math.min(1, this.overheat + 0.02) : Math.max(0, this.overheat - 0.03);

    for (const c of this.embers) c.update();
    if (this.embers.length) this.embers = this.embers.filter(c => !c.dead);

    if (this.dieT >= 0) { this._die(); return; }

    // A new phase starts its scripted rotation from the top, so phase 2 always
    // opens with the spin sweep and phase 3 always shows its steam lances.
    // These used to be dice rolls taken at most twice a fight; measured over
    // four seeds, half of all players never saw phase 2's advertised attack.
    if (this.phase !== this._phaseSeen) { this._phaseSeen = this.phase; this.cycle = 0; }

    if (this.stalled > 0) {
      this.stalled--;
      // it is not a statue while it is choking: the legs twitch, the stack
      // rattles, and past the second blade hit it starts hauling itself up
      if ((this.stalled & 3) === 0) this.legT++;
      if (this.seizeHits >= 2 && (this.stalled & 7) < 3) this.shudder = 2;
      if (this.stalled === 0) {
        this.state = 'idle'; this.timer = 40;
        this._blowdown();
        this.seizes++;
        // THE FIREBOX ONLY COUGHS FOR A PLAYER WHO IS ACTUALLY DOWN.
        //
        // History, because the number has moved twice and both moves were
        // measurements. Round 11 dropped a recovery heart on EVERY seize in
        // phases 2 and 3, because at the time `spin` and `cinder` had no drawn
        // wind-up and the healing was quietly paying for attacks the player
        // could not see coming. Round 12 measured what that cost: twelve
        // autopilot runs across three latencies, ZERO boss deaths, twenty-three
        // half-hearts healed inside one 133-second fight. The tells exist now,
        // so it came down to every OTHER seize, with one exception — a seize
        // taken on one heart or less always coughed one out, the ALttP
        // drop-table bias that keeps a fight tense instead of punishing and
        // breaks the die-retry-die spiral.
        //
        // ROUND 26 took the every-other-seize half away and left the exception
        // standing on its own, and this is the whole of it now: KETTLEBACK
        // feeds the player who is one heart from the floor and nobody else.
        //
        // Why: the blowdown above stopped the fight charging a heart for
        // reaction time, which was right, but it refunded the 133 ms player
        // too, and the fight lost its teeth — ten first-try clears out of ten
        // where STORY.md asks for "the second or third try". Measured at lag 8
        // (tools/critic/zz-bb27-diag.js, five seeds), the unconditional half of
        // this rule was handing a bot that never fell past the middle of its
        // row three to four hearts a fight — six to eight half-hearts of
        // healing against six to nine of damage, i.e. the entire margin, given
        // to the player who had the least use for it.
        //
        // It is the right knob because it is the only one in the fight that
        // reads the PLAYER instead of the clock. Take it off a healthy player
        // and a healthy player is the only one who notices: at 333 ms the bot
        // is at or under one heart for most of the fight, so it now gets a
        // heart on EVERY seize where it used to get one on every second, and
        // the difficulty tail the exception was written for gets more help
        // rather than less. Skill pays for it; latency does not.
        const hh = this.onHealth ? this.onHealth() : 0;
        if (hh <= DROP_AT && this.hp > 0) this._dropHeart();
      }
      return;
    }

    switch (this.state) {
      case 'wake':
        // it winds itself up: shudder, valve puffs, then the fight starts
        this.shudder = 2;
        if (--this.timer <= 0) { this.state = 'idle'; this.timer = 46; }
        break;

      case 'idle': {
        this.legT++;
        // It shuffles toward Wren so it never parks in a corner — but it
        // KEEPS ITS DISTANCE. A cart-sized boss that homes at 0.35px/frame
        // and bites on contact does not menace you, it pins you against the
        // masonry and chips you to death between attacks; measured, plain
        // body contact during idle was 14 of the 19 hearts a scripted run
        // lost. Outside 58px it closes, inside 42px it backs off, and in
        // between it just watches you.
        const dx = (player.x + 8) - this.cx, dy = (player.y + 14) - this.cy;
        const d = Math.hypot(dx, dy) || 1;
        const push = d > 58 ? 0.4 : d < 42 ? -0.7 : 0;
        if (push) {
          this.cx += (dx / d) * push;
          this.cy += (dy / d) * push;
        }
        this._clamp();
        this._faceToward(player);
        // It does not start swinging at you while it is still hauling itself
        // upright. Belt and braces: every path into `idle` already sets a
        // timer longer than RECOVER, so this has never fired in measurement —
        // it is here so a future shorter timer cannot quietly reintroduce an
        // attack that begins inside the frames the player was promised.
        if (--this.timer <= 0) {
          if (this.recover > 0) this.timer = this.recover;
          else this._choose(engine, player);
        }
        break;
      }

      case 'rear': {
        // THE TELL: it rocks back, the valve lights, dust shakes off.
        // It also BACKS OFF the wall it is about to charge. A boss parked
        // flush against that wall has no runway, and a lunge with no runway
        // is a telegraph that pays nothing.
        this.valve = 1;
        this.shudder = 2;
        // the heading LOCKS with a third of the tell still to run, so the last
        // frames are pure runway and a late re-aim can never leave the lunge
        // with nowhere to go
        if (this.timer > 16) this._faceToward(player);
        {
          const gap = this._wallDist(this.dir);
          if (gap < 50) {
            const [bx, by] = DIRV[this.dir];
            const back = gap < 20 ? 2.2 : 1.4;
            this.cx -= bx * back; this.cy -= by * back;
            this._clamp();
          }
        }
        if (--this.timer <= 0) {
          this.state = 'charge';
          this.timer = 120;
          this.chargeRun = 0;
          // never demand more distance than the arena can give, or a cornered
          // boiler grinds the masonry for two seconds
          this.chargeMin = Math.min(22, Math.max(0, this._wallDist(this.dir) - 3));
        }
        break;
      }

      case 'charge': {
        const [dx, dy] = DIRV[this.dir];
        const sp = this.phase === 3 ? 3.3 : 2.7;
        this.cx += dx * sp; this.cy += dy * sp;
        this.chargeRun += sp;
        this.legT += 3;
        this._clamp();
        const slam = this.chargeRun >= this.chargeMin && this._atWall(this.dir);
        if (slam || --this.timer <= 0) {
          this.sfx('lurch');
          if (this.onLurch) this.onLurch();
          this.charges--;
          if (this.charges > 0) { this.state = 'rear'; this.timer = 30; }
          else { this.state = 'vent'; this.timer = this._ventWindow(112); this.valve = 2; }
        }
        break;
      }

      case 'vent':
        // THE WINDOW: the valve hangs open and steam pours out of it.
        // It keeps ticking over while it does — this used to zero legT, and
        // the result was 73% of the window's frames byte-identical to the one
        // before, i.e. two seconds of a dead machine, three times a fight.
        this.valve = 2;
        if ((this.timer & 1) === 0) this.legT++;
        if (this.timer % 5 < 2) this.shudder = 2;
        if (this.timer % 18 === 0) this.sfx('steam');
        if (--this.timer <= 0) {
          this.valve = 0;
          this.state = 'idle';
          this.timer = 40;
          this._blowdown();
        }
        break;

      case 'seized':
        // handled by this.stalled above; kept for readability
        this.state = 'idle';
        break;

      case 'spinup':
        // It does NOT judder here — it winds. The chassis holds still while the
        // leg gearing spools up, which is the opposite read from `stoke`'s
        // judder-and-glow, and it is half of why the two tells no longer look
        // alike even before the art is drawn.
        this.shudder = 0;
        this.windT++;
        this.legT += 2;
        if (--this.timer <= 0) {
          this.state = 'spin';
          this.timer = 118;
          const a = this.arena;
          this.spinAngle = Math.atan2(this.cy - (a.y + a.h / 2), this.cx - (a.x + a.w / 2));
        }
        break;

      case 'spin': {
        // a sweep around the arena centre — a moving wall, but a slow one
        const a = this.arena;
        this.spinAngle += 0.040;
        const rx = 62, ry = 46;
        this.cx = a.x + a.w / 2 + Math.cos(this.spinAngle) * rx;
        this.cy = a.y + a.h / 2 + Math.sin(this.spinAngle) * ry;
        this.legT += 3;
        this.windT++;
        this.dir = Math.abs(Math.cos(this.spinAngle + 1.57)) > Math.abs(Math.sin(this.spinAngle + 1.57))
          ? (Math.cos(this.spinAngle + 1.57) > 0 ? 'right' : 'left')
          : (Math.sin(this.spinAngle + 1.57) > 0 ? 'down' : 'up');
        this._clamp();
        // THE PUNISH FOR THE SWEEP, AND WHY IT IS 128 AND NOT 80.
        //
        // This was the shortest window in the fight and it opens from the
        // worst place in the arena. The sweep runs the chassis round an ellipse
        // 62x46 off the arena centre, which on a 192x160 floor is the RIM; the
        // player's answer to a moving wall they cannot outwalk (it travels
        // ~2.2 px/frame, Wren does 1.5) is to break outward and let it go past,
        // so the frame the valve opens they are as far from it as this room
        // allows — up to ~150 px, 100 frames of walking before a blast is even
        // in range.
        //
        // Measured (tools/critic/bb-diag.js, which tags every vent window with
        // what opened it and whether the player got in), reader bot:
        //     lag 12   after-spin  2 CUFFED / 0 MISSED
        //     lag 18   after-spin  1 CUFFED / 2 MISSED
        //     lag 20   after-spin  3 CUFFED / 15 MISSED   (17%)
        //              after-charge 12 CUFFED / 5 MISSED  (71%)
        //              after-lance  100%
        // So past ~300 ms of reaction, phase 2's SIGNATURE ATTACK PAID NOTHING.
        // The player dodged the sweep correctly, walked at the valve, and
        // watched it shut in their face — while the two escort beetles and the
        // coals kept chipping. That is the other half of the round-25 cliff:
        // not "phase 2 hits harder", but "phase 2 stops being winnable",
        // because the only thing that moves the hp bar is out of reach.
        //
        // 128 is the LANCE's number, and it is the lance's argument: that
        // window is the widest in the fight precisely because it opens with
        // the boss rooted at the centre and the player orbiting at 80 px. The
        // spin ends with a longer walk than that, so it gets at least as long
        // a walk to make it in. It costs a fast player nothing — hitByCuff()
        // ends the window the frame it lands, so every frame added here is a
        // frame only a late player ever sees.
        if (--this.timer <= 0) { this.state = 'vent'; this.timer = this._ventWindow(128); this.valve = 2; }
        break;
      }

      case 'stoke':
        // THE TELL for the cinders: it hunkers, the grilles blow open and the
        // whole chassis judders before a single coal is on the floor. The
        // grilles are DRAWN now (see heatWash / grilleArt flare) — this comment
        // promised art that round 12 proved was never rendered.
        this.shudder = (this.timer & 3) < 2 ? 2 : 0;
        this.windT++;
        this.legT++;
        this._faceToward(player);
        if (--this.timer <= 0) {
          this._plantCinders(engine, player);
          this.state = 'idle';
          this.timer = 78;
          this.sfx('land');   // the coals hit the plate; `poof` opened the tell
        }
        break;

      case 'lancewind': {
        // It STOMPS TO THE MIDDLE and plants itself. Rooting where it happens
        // to be standing puts two of the four beams through the masonry — the
        // sweep only reads as a sweep from the centre of the floor.
        const a = this.arena;
        const tx = a.x + a.w / 2, ty = a.y + a.h / 2;
        const dx = tx - this.cx, dy = ty - this.cy;
        const dd = Math.hypot(dx, dy);
        if (dd > 2) {
          const sp = Math.min(2.4, dd);
          this.cx += (dx / dd) * sp; this.cy += (dy / dd) * sp;
          this.legT += 2;
        }
        this._clamp();
        this.shudder = (this.timer & 3) < 2 ? 2 : 0;
        this.legT++;
        this.lance.t = LANCE_WIND - this.timer;
        // re-aim on the last frame of the tell, AFTER the walk, so the sweep
        // still opens with Wren standing in a gap
        if (this.timer === 1) {
          this.lance.base = Math.atan2((player.y + 14) - this.cy, (player.x + 8) - this.cx)
            + Math.PI / LANCE_ARMS;
        }
        if (--this.timer <= 0) {
          this.state = 'lance';
          this.timer = LANCE_LIVE;
          this.sfx('steam');
        }
        break;
      }

      case 'lance':
        this.lance.t = LANCE_WIND + (LANCE_LIVE - this.timer);
        this.lance.base += LANCE_SPIN * this.lanceDir;
        // rooted and straining: the legs brace and the whole chassis rattles
        this.legT += 2;
        this.shudder = 2;
        if (this.timer % 30 === 0) this.sfx('steam');
        if (--this.timer <= 0) {
          this.lance = null;
          // BLOWDOWN. Four lances for 210 frames empties the boiler, and the
          // chimney hangs open at the end of it.
          //
          // This is what makes phase 3 a DIFFERENT fight rather than a longer
          // one. Phase 1 is dodge-the-lane-then-punish; phase 2 is
          // reposition-or-snuff-then-punish; without this, phase 3's own
          // signature attack paid nothing at all — only `charge2` opened a
          // valve, so a third of phase 3's decisions were pure survival and
          // measured phase 3 ran 2.6x longer than phase 1 with every death in
          // the fight inside it. Now the lance sweep is answered the way it is
          // built: you ride the gap all the way round, and the reward is the
          // widest Cuff window in the fight.
          this.state = 'vent';
          this.timer = this._ventWindow(128);
          this.valve = 2;
          this.sfx('steam');
        }
        break;
    }

    // THERE IS NO PHASE-CHANGE HEART ANY MORE, AND THAT IS THE ROUND-26 FIX.
    //
    // Phases 2 and 3 each used to cough one out of the firebox on the frame the
    // bar crossed. See _dropHeart() for the four louder ideas that were tried
    // first and measured worse; the reason taking these two away is the one
    // that worked is that a phase-change heart was a PER-FIGHT quantity and not
    // a per-second one — the counter behind it never rewound on a continue, so
    // those four half-hearts were worth four half-hearts to a run that clears
    // the whole bar in one attempt and four half-hearts to a run that takes
    // fourteen: the entire remaining margin of the first, and 3% of the second.
    //
    // Measured at lag 8 (tools/critic/zz-bb27-diag.js, ten seeds) the learner
    // bot was taking 7-9 half-hearts a run against a three-heart row and being
    // healed 6-8 of them, finishing every single seed with half a heart still
    // showing. It was not surviving the fight, it was being carried through it.
    // At 300-370 ms the same four half-hearts are lost in the noise of a
    // hundred-and-twenty-half-heart grind, and the player who is genuinely in
    // trouble is caught by DROP_AT instead — which pays per seize, and therefore
    // pays most exactly when the run is going worst.
    //
    // It is the better read as well. The plates coming off, the escorts
    // arriving, the lances winding up: those are the fight's turns to speak, and
    // a free heart landing on the frame it escalates reads as an apology for
    // the escalation.

    // Phase 3 entry: it pulls the power back out of its escorts to feed the
    // lances. The hall goes quiet except for the boiler — and it means the
    // beetles summoned two minutes ago are not still pecking at you through
    // an attack that already asks for your whole attention.
    if (!this._recalled && this.phase >= 3) {
      this._recalled = true;
      this._recall = true;
      this.flash = 18;
      this.sfx('roar');
    }

    // Phase 2 entry: shed the plates and call for help. Once only.
    if (!this.shed && this.phase >= 2) {
      this.shed = true;
      this.flash = 20;
      this.sfx('roar');
      for (let i = 0; i < 8; i++) {
        this.blasts.push(new Blast(this.cx + (i % 2 ? 18 : -18), this.cy + (i < 4 ? -14 : 14), i * 3));
      }
      const spots = [[this.cx - 54, this.cy + 30], [this.cx + 42, this.cy + 30]];
      for (const [sx, sy] of spots) {
        const b = new ClockworkBeetle(
          Math.max(this.arena.x + 4, Math.min(this.arena.x + this.arena.w - 20, sx)),
          Math.max(this.arena.y + 4, Math.min(this.arena.y + this.arena.h - 20, sy)),
          'down');
        this.spawn.push(b);
      }
    }
  }

  // --- the rotation ---------------------------------------------------------

  /** Pick and start the next attack. Called once per idle→attack decision. */
  _choose(engine, player) {
    const ph = this.phase;
    const script = PHASE_SCRIPT[ph], pool = PHASE_POOL[ph];
    const n = this.cycle++;
    let kind;
    if (n < script.length) {
      kind = script[n];
    } else {
      // NO ATTACK TWICE IN A ROW once the script has run out. A blind draw
      // means the pool sometimes serves the same attack three and four times
      // running, and in phase 3 that attack is the 210-frame LANCE sweep:
      // measured across three seeds, the one seed whose rolls clumped drew
      // nine lances where the others drew two, lost 11 half-hearts to them,
      // and was the only seed of the three that died at all. A boss that can
      // roll the same wall of steam four times is not harder, it is a dice
      // game — and the phase pools exist to make a phase feel like a phase.
      const pick = pool.filter(k => k !== this._lastKind);
      const from = pick.length ? pick : pool;
      kind = from[Math.min(from.length - 1, Math.floor(engine.rand() * from.length))];
    }
    this._lastKind = kind;
    this._begin(kind, engine, player);
    return kind;
  }

  _begin(kind, engine, player) {
    this.windT = 0;
    switch (kind) {
      case 'charge':
      case 'charge2':
        this.state = 'rear';
        this.timer = this.phase === 3 ? 36 : 46;
        this.charges = kind === 'charge2' ? 2 : 1;
        this.sfx('steam');
        break;
      // ONE CUE PER ATTACK. `spin` and `cinder` both opened on `gear`, so in
      // phase 2 the audio said the same word for two attacks with different
      // answers. Gearing is what the spin actually is, so the spin keeps it;
      // the cinders are a firebox whump, which is what `poof` sounds like.
      case 'spin':
        this.state = 'spinup'; this.timer = 44; this.sfx('gear');
        break;
      case 'cinder':
        this.state = 'stoke'; this.timer = 46; this.sfx('poof');
        break;
      case 'lance': {
        this.state = 'lancewind';
        this.timer = LANCE_WIND;
        // start the arms so Wren is standing in a GAP, then rotate. The attack
        // is about tracking the gap, not about an unfair opening frame.
        const a = Math.atan2((player.y + 14) - this.cy, (player.x + 8) - this.cx);
        this.lance = { t: 0, base: a + Math.PI / LANCE_ARMS };
        this.lanceDir = engine.rand() < 0.5 ? -1 : 1;
        this.sfx('steam');
        break;
      }
      default:
        this.state = 'idle'; this.timer = 40;
    }
  }

  /**
   * Spit a rake of coals along the floor. Phase 2 lays one line straight at
   * Wren — the same lane-reading the charge taught, but the lane is on fire
   * and it arrives in sequence. Phase 3 lays three, fanned, so stepping
   * sideways is not automatically the answer.
   */
  _plantCinders(engine, player) {
    const base = Math.atan2((player.y + 14) - this.cy, (player.x + 8) - this.cx);
    const rays = this.phase >= 3 ? [[0, 0], [-0.46, 16], [0.46, 32]] : [[0, 0]];
    const n = this.phase >= 3 ? 5 : 6;
    const a = this.arena;
    for (const [off, delay] of rays) {
      const ang = base + off;
      for (let i = 0; i < n; i++) {
        const r = 40 + i * 21;
        const x = this.cx + Math.cos(ang) * r;
        const y = this.cy + Math.sin(ang) * r * 0.88;
        if (x < a.x + 6 || x > a.x + a.w - 6 || y < a.y + 6 || y > a.y + a.h - 6) break;
        this.embers.push(new Cinder(x, y, delay + i * 7));
      }
    }
  }

  // --- hazards the room has to know about -----------------------------------

  /** Cinders the Bellows Cuff can put out. Duck-typed as steam vents. */
  cuffTargets() {
    return this.dieT >= 0 ? [] : this.embers.filter(c => c.live);
  }

  /** Sample boxes along the four live steam lances. */
  lanceBoxes() {
    if (!this.lance || this.lance.t < LANCE_WIND || this.dieT >= 0) return [];
    const out = [];
    for (let k = 0; k < LANCE_ARMS; k++) {
      const a = this.lance.base + k * (Math.PI * 2 / LANCE_ARMS);
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let r = LANCE_R0; r <= LANCE_R1; r += LANCE_STEP) {
        out.push({
          x: this.cx + ca * r - 5, y: this.cy + sa * r * 0.86 - 5, w: 10, h: 10,
        });
      }
    }
    return out;
  }

  /** Everything of the boss's that hurts on contact besides the body itself. */
  hazardBoxes() {
    return this.cinderBoxes().concat(this.lanceBoxes());
  }

  /** Just the fire columns, so the room can attribute the damage they do. */
  cinderBoxes() {
    if (this.dieT >= 0) return [];
    const out = [];
    for (const c of this.embers) if (c.dangerous) out.push(c.hurtbox());
    return out;
  }

  _die() {
    this.dieT++;
    const t = this.dieT;
    if (t < 44) {                       // freeze and flash
      this.flash = 2;
      this.shudder = 2;
      return;
    }
    // ONE AUTHORED DEATH, NOT NINETEEN COPIES OF A PUFF. This used to fire
    // `roar` on frame 44 and then `poof` on every 4th frame after it — 19
    // triggers of a 0.28 s drone-death puff inside 1.3 s, which the voice
    // stealer flattens into one continuous wash with no build, no climax and
    // no collapse. `bossdown` is the sound written for this exact beat: 1.42 s
    // of rupture (0.00) -> the scream out of the split shell (0.24) -> three
    // plates letting go (0.50 / 0.66 / 0.84) -> the frame going (1.00). It is
    // `prio` and `poly: 1`, so it plays once, in full, over everything.
    //
    // Frames line up: 44 + 60*1.42 = 129, three frames past `beaten`, so the
    // last thing heard is the frame collapsing under the fade.
    if (t === 44) this.sfx('bossdown');
    // expanding explosion sequence, walked outward from the body
    if (t >= 44 && t < 120 && (t - 44) % 4 === 0) {
      const n = (t - 44) / 4;
      const r = 3 + n * 1.5;
      const a = n * 2.1;
      for (const k of [0, 1, 2]) {
        const ang = a + k * 2.09;
        this.blasts.push(new Blast(
          this.cx + Math.cos(ang) * r, this.cy + Math.sin(ang) * r * 0.75, k));
      }
    }
    if (t === 120) this.dead = true;
    if (t > 126 && this.blasts.length === 0) this.beaten = true;
  }

  /**
   * Phase 3: wind down whatever it summoned, in a puff of firebox blast each.
   * Returns true the frame it happens so the room can react.
   */
  recallEscorts(enemies) {
    if (!this._recall) return false;
    this._recall = false;
    for (const e of enemies) {
      if (e.dead) continue;
      e.hp = 0; e.dead = true;
      this.blasts.push(new Blast(e.x + 8, e.y + 10, 0));
    }
    return true;
  }

  /**
   * A RECOVERY HEART OUT OF THE FIREBOX.
   *
   * ROUND 26's LOG, because this is where four failed ideas ended up and the
   * next round should not spend its budget re-running them. The problem: the
   * BLOWDOWN (see RECOVER) correctly stopped the fight charging a half-heart
   * for reaction time, but a flat 34-frame immunity refunds the 133 ms player
   * as well as the 333 ms one, and the fast player was the only one who could
   * not afford to be refunded — the learner bot went to ten first-try clears
   * out of ten where STORY.md asks for "the second or third try". The margin
   * had to come back from something that reads SKILL rather than the clock.
   *
   * Measured, at 300-370 ms this fight is an attrition war and recovery hearts
   * are the ammunition, so every idea that thinned the healing shot the wrong
   * player (reader bot, tools/critic/zz-bb27-sweep.js, three to five seeds):
   *
   *   ending the blowdown grace on POSITION — safe until Wren is clear of the
   *     chassis, live the moment she is off it — 333 ms went from 7/3/11/10
   *     attempts to NEVER on both seeds tried, 13-16 deaths, ~120 half-hearts.
   *     The 34 frames were never paying for the transition frame; they were
   *     paying for the whole reposition.
   *   a blowdown PUSH, throwing Wren clear instead of shielding her: at 367 ms
   *     the share of deaths inside phases 1-2 — the round-25 cliff's own
   *     measure — went from 12% to 45%. Seven frames in which she cannot steer,
   *     ten times an attempt, is not a mercy at that latency.
   *   DROP_AT from 2 to 1: NEVER on three seeds of three at 333 ms.
   *   a per-attempt CAP of two recovery hearts: phases 1-2 took 40% of deaths
   *     at 367 ms against 12% without it. A player dying every thirty seconds
   *     needs three hearts an attempt more than a player clearing the whole bar
   *     in one attempt needs four.
   *
   * WHAT WORKED is in the phase block a few screens up: the two phase-change
   * hearts are gone and the last-heart rule below is the whole of the fight's
   * healing. A phase-change heart was a PER-FIGHT quantity, spent once whatever
   * happened afterwards, so it was worth four half-hearts to a run that clears
   * the bar in one attempt and four half-hearts to a run that takes fourteen —
   * most of the first run's remaining margin and 3% of the second's. Skill pays
   * for it; latency does not notice.
   */
  _dropHeart() {
    const a = this.arena;
    this.drops.push({
      kind: 'heart',
      x: Math.max(a.x + 8, Math.min(a.x + a.w - 24, this.cx - 8)),
      y: Math.max(a.y + 8, Math.min(a.y + a.h - 24, this.cy + 34)),
    });
  }

  /**
   * BLOWDOWN. Start the recovery frames and make them a read, not a mercy:
   * the skirt dumps steam at deck level all the way round the chassis and the
   * whole machine judders back onto its legs. Called on the two frames a safe
   * window shuts — the end of a seize and the end of a vent — which
   * bb-diag.js measured as the largest single damage source in the fight.
   *
   * `steam` is the same cue the vent itself opens and closes on, which is the
   * point: the sound the player has learned to mean "the valve is doing
   * something" is what tells them the window is over.
   *
   */
  _blowdown() {
    if (this.dieT >= 0 || this.dead) return;
    this.recover = RECOVER;
    this.shudder = 2;
    // four puffs round the skirt, on the deck line rather than the back, so it
    // cannot be mistaken for the chimney plume the Cuff answers to
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + 0.79;
      this.blasts.push(new Blast(
        this.cx + Math.cos(a) * 24, this.cy + Math.sin(a) * 17 + 12, i * 2));
    }
    this.sfx('steam');
  }

  /** Beetles the fight wants spawned; the room takes them and clears this. */
  takeSpawns() { const s = this.spawn; this.spawn = []; return s; }

  /** Recovery hearts the fight wants dropped. */
  takeDrops() { const d = this.drops; this.drops = []; return d; }

  // --- draw -----------------------------------------------------------------

  draw(ctx, frame) {
    if (this.dead) {
      for (const b of this.blasts) b.draw(ctx);
      return;
    }
    const legPose = (Math.floor(this.legT / 7) & 1);
    // SEIZED is its own sprite: chimney shut, cradle white-hot. The old code
    // keyed the glow off `valve`, and hitByCuff() zeroes the valve — so the
    // cradle went cold on the exact frame the Cogblade started working.
    const si = this.shed ? 1 : 0;
    const vi = this.vulnerable ? 3 : this.valve;
    let img;
    if (this.flash > 0 && this.flash % 3 !== 0) {
      // PALETTE CYCLE, not a fill: every seam, rivet, eye and grille survives
      // the flash. A boss that becomes a white blob for six frames on every
      // blade hit is a boss you cannot read at the exact moment you are
      // standing on top of it.
      img = this.spr.flash[si][vi][legPose][this.dir];
    } else if (this.state === 'spinup' || this.state === 'spin') {
      // THE SPIN TELL — brass streaks whipping round the chassis, on a 16-frame
      // rotation, so it reads as something turning up to speed. It CARRIES ON
      // through the sweep itself: a machine that stops looking like it is
      // spinning the instant it starts spinning reads as two different props.
      const k = (this.windT >> 2) % SPIN_STEPS;
      img = this.spr.spin[si][k][this.dir];
    } else if (this.state === 'stoke') {
      // THE CINDER TELL — the firebox stands up in three steps across the tell.
      const k = Math.min(STOKE_STEPS - 1, Math.floor(this.windT / 15));
      img = this.spr.stoke[si][k][this.dir];
    } else {
      img = this.spr.body[si][vi][legPose][this.dir];
    }
    const sx = Math.round(this.cx - img.width / 2)
      + (this.shudder > 0 ? ((frame & 1) ? 1 : -1) : 0);
    const sy = Math.round(this.cy - img.height / 2);

    // shadow: a tapered blob that stays INSIDE the chassis silhouette, so it
    // never reads as a black bar sticking out of the beetle
    // A DITHERED ELLIPSE that stays inside the chassis silhouette. A hard
    // black bar poking out past the body on both sides is the single most
    // obvious tell that a sprite was pasted onto a floor.
    const sw = img.width, sh = img.height;
    const scx = sx + sw / 2, scy = sy + sh - 5;
    const rx = sw * 0.36, ry = 5.5;
    for (let yy = -6; yy <= 6; yy++) {
      for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
        const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
        if (d > 1) continue;
        // solid core, dithered rim — the SNES shadow blob exactly
        if (d > 0.55 && (((xx + yy) & 1) === 0)) continue;
        ctx.fillStyle = d > 0.55 ? '#2a303a' : '#1e222b';
        ctx.fillRect(Math.round(scx + xx), Math.round(scy + yy), 1, 1);
      }
    }

    if (this.iframes > 0 && !this.vulnerable && (this.iframes >> 1) % 2 === 0) {
      // blink on a blocked hit, but never vanish entirely
    } else {
      ctx.drawImage(img, sx, sy);
    }

    this._drawWindupFx(ctx, frame);

    // the seized read: sparks jump off the white-hot cradle. The glow itself
    // is IN the sprite now, so this only has to say "still burning".
    if (this.vulnerable) {
      const cxr = Math.round(this.cx), cyr = Math.round(this.cy);
      for (let i = 0; i < 3; i++) {
        const a = (frame * 0.21 + i * 2.09);
        const r = 9 + ((frame + i * 5) % 12);
        ctx.fillStyle = r > 15 ? '#f88828' : '#ffd84c';
        ctx.fillRect(cxr + Math.round(Math.cos(a) * r), cyr + Math.round(Math.sin(a) * r * 0.8), 2, 2);
      }
    }

    // vent plume out of the open chimney
    if (this.valve === 2 && this.dieT < 0) {
      const [dx, dy] = DIRV[this.dir];
      const px = Math.round(this.cx - dx * 29), py = Math.round(this.cy - dy * 27);
      const n = (frame >> 2) % 3;
      ctx.fillStyle = '#c8d4e0';
      ctx.fillRect(px - 5 - n, py - 5 - n, 10 + n * 2, 10 + n * 2);
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(px - 3 - n, py - 3 - n, 6 + n * 2, 6 + n * 2);
      ctx.fillStyle = '#2b3340';
      ctx.fillRect(px - 5 - n, py - 6 - n, 10 + n * 2, 1);
      ctx.fillRect(px - 5 - n, py + 5 + n, 10 + n * 2, 1);
    }

    this._drawValveCue(ctx, frame);
    this._drawBlowdown(ctx, frame);

    for (const b of this.blasts) b.draw(ctx);
  }

  /**
   * THE BLOWDOWN SKIRT — what the recovery frames look like.
   *
   * A boss that stops hurting you for half a second and shows nothing for it
   * is a cheat the player cannot learn from; it has to be as legible as the
   * white-hot cradle that says "hit here". So the boiler dumps its pressure
   * out along the DECK: low steam creeping outward from under the chassis,
   * thinning as it goes, with the dark bar under each puff the same trick the
   * chimney plume uses to stop white-on-white from dissolving.
   *
   * It reads DOWN and OUTWARD, at floor level. The vent plume reads UP and
   * BACKWARD off the chimney, and the seize sparks read as a ring on the back.
   * Three windows, three directions of motion, none of them confusable — and
   * this one carries the sentence the fight never said before: "it is getting
   * back up; move."
   */
  _drawBlowdown(ctx, frame) {
    if (this.recover <= 0 || this.dieT >= 0) return;
    const t = RECOVER - this.recover;         // 0..RECOVER-1, the puff's age
    const g = Math.min(1, this.recover / 10); // fades out as it runs out
    const cx = Math.round(this.cx), by = Math.round(this.cy + this.halfH - 6);
    const spread = 10 + t * 0.9;
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4) + 0.39;
      const w = Math.max(2, Math.round((7 - i % 3) * g));
      const x = cx + Math.round(Math.cos(a) * spread);
      const y = by + Math.round(Math.sin(a) * spread * 0.34) - ((frame + i * 3) % 3);
      ctx.fillStyle = '#2b3340';
      ctx.fillRect(x - (w >> 1), y - 1, w, 1);
      ctx.fillStyle = (i + (frame >> 2)) & 1 ? '#c8d4e0' : '#f4f6f8';
      ctx.fillRect(x - (w >> 1), y, w, Math.max(1, w >> 1));
    }
  }

  /**
   * THE VALVE, MARKED IN THE CUFF'S OWN BRASS.
   *
   * Playtest P0 #3(b). The chimney cap going white-hot is a good telegraph for
   * the CHARGE, and the plume is a good read for "it is venting" — but neither
   * of them says which BUTTON, and the fight has exactly one answer. So while
   * the valve is open, four brackets close on it in the two brass values the
   * Bellows Cuff itself is drawn in (CUFF_PAL.B / CUFF_PAL.b — the same gold as
   * the cuff on Wren's wrist and the item box icon), sitting on the blastbox:
   * the box the blast actually has to overlap, not a decorative spot near it.
   *
   * It is LOUD until the player has done it once and quiet forever after —
   * thicker arms, wider throw, faster blink — because a reticle that keeps
   * shouting at a player who solved the fight four seizes ago is a reticle they
   * learn to hate. After the first cuff it is a thin, slow pulse: still a mark,
   * no longer a lesson.
   *
   * Every stroke carries a dark keyline (CUFF_PAL.k) because the thing it is
   * drawn on top of is a white steam plume.
   */
  _drawValveCue(ctx, frame) {
    if (this.valve !== 2 || this.dieT >= 0 || this.stalled > 0) return;
    const bb = this.blastbox();
    const cx = Math.round(bb.x + bb.w / 2), cy = Math.round(bb.y + bb.h / 2);
    const loud = !this.taught;
    // the brackets breathe inward and back out; the throw is wider and the
    // stroke heavier while it is still teaching
    const cyc = loud ? 26 : 40;
    const swing = loud ? 3 : 1.5;
    const r = Math.round((loud ? 14 : 11) + Math.sin((frame % cyc) / cyc * Math.PI * 2) * swing);
    const len = loud ? 7 : 4;
    const th = loud ? 2 : 1;
    const gold = ((frame >> (loud ? 2 : 4)) & 1) ? CUFF_PAL.B : CUFF_PAL.b;
    const bar = (x, y, w, h) => {
      ctx.fillStyle = CUFF_PAL.k;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = gold;
      ctx.fillRect(x, y, w, h);
    };
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = cx + sx * r, y = cy + sy * r;
        // each corner is an L with its elbow on the ring and both arms pointing
        // in at the valve
        bar(sx > 0 ? x - len + 1 : x, sy > 0 ? y - th + 1 : y, len, th);
        bar(sx > 0 ? x - th + 1 : x, sy > 0 ? y - len + 1 : y, th, len);
      }
    }
  }

  /**
   * Hazard art that belongs UNDER the cast: the coals lying on the deck and
   * the scorch they leave. Called by the room in the floor pass.
   */
  drawFloorFx(ctx, frame) {
    for (const c of this.embers) c.drawFloor(ctx, frame);
  }

  /**
   * Hazard art that belongs OVER everything: fire columns and steam lances.
   * Called by the room after the sorted entity pass — steam that a player can
   * stand in front of does not read as steam.
   */
  drawFx(ctx, frame) {
    this._drawLances(ctx, frame);
    for (const c of this.embers) c.drawOver(ctx, frame);
  }

  /**
   * The half of each wind-up tell that lives OFF the sprite: the deck effects.
   *
   * The sprite dresses say what is happening INSIDE the machine; these say what
   * it is doing to the room, and they are what carries the read at a distance
   * when the boss is small on screen and half behind a steam plume.
   *
   *   spinup/spin : grit dragged round the chassis in a ring, plus two skid
   *                 arcs on the deck. Pale steel, ROTATING.
   *   stoke       : embers lifting off the grilles and a scorch ring cooking
   *                 outward from under it. Orange/white, RISING.
   *
   * Different colour family, different direction of motion, so the two tells
   * cannot be confused even at a glance.
   */
  _drawWindupFx(ctx, frame) {
    if (this.dieT >= 0) return;
    const cx = Math.round(this.cx), cy = Math.round(this.cy);
    if (this.state === 'spinup' || this.state === 'spin') {
      const t = this.windT;
      const spool = Math.min(1, t / 30);
      for (let i = 0; i < 14; i++) {
        const a = t * 0.16 + i * 0.4488;
        const r = 34 + (i % 3) * 7 + spool * 8;
        const x = cx + Math.round(Math.cos(a) * r);
        const y = cy + Math.round(Math.sin(a) * r * 0.7);
        ctx.fillStyle = (i & 1) ? '#c8d4e0' : '#8496ac';
        ctx.fillRect(x, y, 2, 1);
        if (i % 3 === 0) {
          ctx.fillStyle = '#ffe490';
          ctx.fillRect(x + 1, y - 1, 1, 1);
        }
      }
      // two skid arcs scraped into the deck under the legs
      for (const side of [-1, 1]) {
        for (let s = 0; s < 16; s++) {
          const a = t * 0.16 + side * 1.2 + s * 0.06;
          const x = cx + Math.round(Math.cos(a) * 30);
          const y = cy + Math.round(Math.sin(a) * 22) + 16;
          if ((s + frame) & 1) continue;
          ctx.fillStyle = '#5a6472';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      return;
    }
    if (this.state === 'stoke') {
      const t = this.windT;
      const heat = Math.min(1, t / 34);
      // embers lifting off both grilles
      for (let i = 0; i < 16; i++) {
        const lane = (i & 1) ? 1 : -1;
        const ph = (t * 1.6 + i * 9) % 40;
        const y = cy - 4 - ph * 0.7;
        const x = cx + lane * (20 + ((i * 5) % 7)) + Math.round(Math.sin(ph * 0.24) * 3);
        ctx.fillStyle = ph < 14 ? '#ffffff' : ph < 26 ? '#ffd84c' : '#e04a2a';
        ctx.fillRect(x, Math.round(y), 1, ph < 20 ? 2 : 1);
      }
      // the scorch ring cooking outward from under the firebox
      const rr = 20 + heat * 16;
      for (let i = 0; i < 28; i++) {
        const a = i * 0.2244 + 0.2;
        const x = cx + Math.round(Math.cos(a) * rr);
        const y = cy + Math.round(Math.sin(a) * rr * 0.62) + 10;
        if ((i + (frame >> 1)) % 3 === 0) continue;
        ctx.fillStyle = heat > 0.66 ? '#f88828' : heat > 0.33 ? '#8c2416' : '#4a2410';
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }

  _drawLances(ctx, frame) {
    const L = this.lance;
    if (!L || this.dieT >= 0) return;
    const winding = L.t < LANCE_WIND;
    const p = winding ? L.t / LANCE_WIND : 1;
    for (let k = 0; k < LANCE_ARMS; k++) {
      const a = L.base + k * (Math.PI * 2 / LANCE_ARMS);
      const ca = Math.cos(a), sa = Math.sin(a);
      // THE WHISTLE STARTS AT LENGTH. Measured (tools/critic/bd-tele4.js): with
      // reach ramping from LANCE_R0 the first ten frames of the tell drew one
      // or two dithered pips, so `lance` and `charge` differed by 28 px on
      // frames 0-10 — a quarter of the commitment window with nothing on it.
      // The four guide lines are now half-length on frame ONE and grow from
      // there, which is the tell doing its job.
      const reach = winding ? LANCE_R0 + (LANCE_R1 - LANCE_R0) * (0.30 + p * 0.34) : LANCE_R1;
      for (let r = LANCE_R0; r <= reach; r += 4) {
        const t = (r - LANCE_R0) / (LANCE_R1 - LANCE_R0);
        const x = Math.round(this.cx + ca * r);
        const y = Math.round(this.cy + sa * r * 0.86);
        if (winding) {
          // the whistle: a pale guide line, no bite in it yet. It STAYS
          // dashed (a solid beam would read as already live) but the dashes
          // close up and brighten as the pressure builds, so the four lines
          // are legible from the first frame of the tell instead of the
          // eleventh.
          if ((r + (frame >> 1)) % 8 < (p > 0.45 ? 2 : 3)) continue;
          ctx.fillStyle = p > 0.7 ? '#f4f6f8' : p > 0.35 ? '#c8d4e0' : '#8496ac';
          ctx.fillRect(x - 1, y - 1, 3, 2);
          continue;
        }
        // live: a chunky segmented beam, hot white at the socket, boiling
        // steel-blue steam by the time it reaches the wall
        const w = Math.max(2, Math.round(7 - t * 3));
        const puff = ((frame >> 1) + (r >> 2)) % 3;
        ctx.fillStyle = t < 0.16 ? '#ffffff' : t < 0.42 ? '#f4f6f8' : '#c8d4e0';
        ctx.fillRect(x - (w >> 1), y - (w >> 1), w, w);
        ctx.fillStyle = '#8496ac';
        ctx.fillRect(x - (w >> 1) - (puff === 0 ? 1 : 0), y + (w >> 1) - 1,
          w + (puff === 0 ? 1 : 0), 1);
        if (puff === 2) {
          ctx.fillStyle = '#2b3340';
          ctx.fillRect(x - (w >> 1), y - (w >> 1) - 1, w, 1);
        }
      }
      // the socket flare where the beam leaves the chassis. It is lit through
      // the WIND-UP too — four sockets glowing at the corners of the boiler is
      // the fastest possible read for "it is about to open all four at once".
      const x = Math.round(this.cx + ca * LANCE_R0);
      const y = Math.round(this.cy + sa * LANCE_R0 * 0.86);
      if (winding) {
        ctx.fillStyle = p > 0.6 ? '#ffd84c' : '#c8d4e0';
        ctx.fillRect(x - 2, y - 1, 4, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, y, 2, 1);
      } else {
        ctx.fillStyle = (frame & 2) ? '#ffffff' : '#ffd84c';
        ctx.fillRect(x - 3, y - 2, 6, 4);
      }
    }
  }

  /** The phase-3 floor glow, drawn under everything by the room. */
  drawFloorGlow(ctx, arena, frame) {
    if (this.overheat <= 0) return;
    const a = arena;
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.09);
    const step = 8;
    ctx.fillStyle = this.overheat * pulse > 0.55 ? '#5a2f18' : '#472414';
    for (let y = a.y; y < a.y + a.h; y += step) {
      for (let x = a.x + ((y / step) & 1 ? step / 2 : 0); x < a.x + a.w; x += step) {
        ctx.fillRect(x, y + 3, 3, 2);
      }
    }
  }
}
