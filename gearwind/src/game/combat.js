// Cogblade melee combat — ALttP-feel sword swing + hittable entities.
//
// SWING: 9 engine frames of body lock playing dedicated per-facing attack
// bodies — (0) wind-up: sword cocked back, weight on the rear foot, body
// high, head counter-leans; (1) lunge: body drops 2px, stance splits wide,
// head leans INTO the strike, sword arm whips across; (last) follow-through:
// body settles, stance closes, arm extended, blade held out.
//
// THE ARC NEVER JUMPS AND NEVER STALLS. Measured blade bearings off the art
// (grip pixel -> farthest steel pixel): E 0, NE 49.4, N 90, NW 139.4, W 180,
// SW 229.4, S(at-camera) 254.1 — rungs alternating 49.4 / 40.6 degrees.
// THREE of the four facings run FOUR poses:
//   down   NW -> W -> SW -> S    40.6 / 49.4 / 24.7
//   left   NE -> N -> NW -> W    40.6 / 49.4 / 40.6   (right is its mirror)
//   up     E  -> NE -> N         49.4 / 40.6
// Left used to run three, and the missing N rung meant 74% of the arc's
// travel happened in ONE frame transition (88.5 deg) and then the blade sat
// still for the last 6 of 8 drawn frames. `POSE_AT` splits the 8 drawn frames
// 2/2/2/2 for the four-pose facings and 2/3/3 for up.
//
// EVERY POSE IS THE SAME SWORD — with one deliberate exception. Cardinal
// grip->tip is 9.00px and diagonal 9.22px (2.4% apart); steel is a 2x7 / 7x2 /
// 5x5 bbox of 12-13 px. Nothing shrinks or grows as the arc turns THROUGH THE
// SCREEN PLANE. The down follow-through is the one pose that points at the
// camera, and it is drawn foreshortened: identical 13 steel px repacked into a
// 3-wide x 5-long wedge measuring 7.28px, which is cos(35 deg) of 9.00 (see
// SW_SD). A blade aimed at the viewer that measured the same length as a blade
// aimed across the screen would be the actual perspective error.
//
// THE ARM IS REAL. Every attack body draws a 2px-wide sleeve that breaks at
// the wrist into a 2x3 block of SKIN — a fist, ALttP-sized (see the spear
// soldier in refs/overworld-cliff-path-soldiers.png at native (112,180):
// a 2px orange forearm running alongside the shaft). The sword's GRIP pixel
// is placed inside that fist, and the fist is then RE-BLITTED on top of the
// sword, so the hand visibly wraps the hilt instead of being erased by it.
// Only the pommel pokes out one side of the fist and the crossguard the
// other — which is what "holding a sword" looks like at 16x24. (The one
// exception is the down follow-through, where the blade points at the
// player's own feet and the pommel is behind the palm; see SW_SD.)
//
// The Cogblade's hilt is deliberately NOT Wren's satchel brass: the grip is
// dark leather, the pommel a single brass pip, and the only brass mass is one
// 5px crossguard bar. It never shares a scanline with the satchel either —
// on the down follow-through the guard sits at y+22, on the boot line, with
// the whole blade below it on the grass.
//
// The sweep always ENDS pointed in the facing direction (ALttP choreography).
// No motion trail: ALttP's normal swing has none.
//
// HITBOX: quarter-arc region in front of the player, active frames 3-6,
// approximated by two generous rects that follow the sweep (diagonal
// quadrant frames 3-4, forward quadrant frames 5-6). One hit per swing
// per entity.
//
// HITTABLE PROTOCOL: an entity is { x, y, hurtbox(), hp, onHit(dir) }, plus
// one OPTIONAL field, `hitstopFrames`. Declaring it means "I am a creature":
// a blow that lowers my hp freezes the swing for that many frames while I
// freeze too (game/enemies.js sets it from HIT.STOP, and freezes itself for
// the same count). Scenery — bushes, pots, grass — leaves it undeclared and
// is still cut through in one weightless motion.
// An entity MAY also return a verdict from onHit — 'hit', 'block' or 'none'
// (world/boilerworks.js's shielded TIN SOLDIER and boss-kettleback.js do) —
// which is what decides whether the blow thuds, rings off brass, or is eaten
// by invulnerability and makes no sound at all. See the audio block below.
//
// The stock reaction (Drone below implements it): knockback 4 px/frame
// decaying linearly over 8 frames, 2-frame white palette flash, ~12 frames
// invuln, and on death an ALttP-style poof — expanding dust ring, 4 art
// frames over 12 engine frames — once the death knockback finishes.
import { makeSprite, flipH } from '../sprites.js';
import { WREN_PAL } from './player-sprites.js';
import SFX from './sfx.js';

// ------------------------------------------------------------- palettes ---

// Cogblade family. Steel ramp + ONE brass bar colour pair + a dark leather
// grip, so the hilt cannot be mistaken for the brass satchel on Wren's hip.
export const SWORD_PAL = {
  o: '#231327', // outline — dark plum, matches Wren
  W: '#f4f7fa', // steel bright
  w: '#b7c8d8', // steel light
  B: '#f6d44e', // brass light — crossguard core / pommel pip
  b: '#c98a24', // brass mid — crossguard tips
  L: '#42261a', // grip leather (much darker than any satchel shade)
};

// Clockwork target-drone family (15-color discipline incl. hazard variant).
const DRONE_PAL = {
  o: '#231327',
  S: '#d8dee4', s: '#8f9aa6', z: '#5a6572',   // tin ramp
  C: '#f2e3b6', c: '#bfa878',                 // cream target ring
  R: '#d9482b', r: '#8c2c1a',                 // red bullseye / hazard shell
  B: '#f6d44e', b: '#c98a24', d: '#7a4f16',   // brass
};

// Poof ramp. The first frame is a solid ball, so it needs a real value step at
// the rim or it reads as a featureless white disc: #cfd8e4 against #f8f8f8 is
// only 8% of value. `g` (#96a2b2, 30% down) carries the rim from there on, and
// frame 0 gets a 1px dark-plum edge — the same outline colour the sprites use.
const POOF_PAL = { W: '#f8f8f8', w: '#cfd8e4', g: '#96a2b2', o: '#231327' };

// ---------------------------------------------------------- sword pixels ---

// Blade NORTH. Bright steel edge left, lit flat right; ONE 5px brass
// crossguard bar; three rows of dark leather grip (the fist covers these);
// a single bright brass pommel pip below.        grip pixel = (3,10)
const SW_N = [
  '...o...',
  '..oWo..',
  '..oWwo.',
  '..oWwo.',
  '..oWwo.',
  '..oWwo.',
  '..oWwo.',
  '..oWwo.',
  'obBBBbo',
  '..oLo..',
  '..oLo..',
  '..oLo..',
  '..oBo..',
  '...o...',
];

// Blade NE (tip top-right, hilt bottom-left). ONE object, ONE length: a
// diagonal of 8 single-pixel steps would reach 11.3px while SW_N reaches
// only 8, i.e. the sword would grow 40% every time the arc passed through a
// diagonal. This is cut to FIVE steel steps so the measured guard-to-tip
// reach is 7.11px against SW_N's 7.00.
//
// The interior is THREE px wide, not two: a 2px-wide horizontal run on a 45
// degree stair is only 1.4px thick perpendicular — thinner than the cardinal
// blade — and it makes every column alternate bright/shade, which reads as a
// zipper when zoomed. At 3px each column runs W,w,w: one solid lit edge on
// the leading side, a shaded flat behind it.
//
// THE HILT RIDES THE DIAGONAL. The steel stair is exactly 45 degrees, but a
// hilt hanging straight DOWN off it pulls the grip point 8 rows below the tip
// while only 5 columns across, so grip->tip measured 58 degrees — the art
// swore 45 and the arc measured 58. The grip is now one step further up the
// blade axis (1,8), which measures 49.4 degrees / 9.22px against the
// cardinal's 90.0 / 9.00 (was 58.0 / 9.43). Guard row 7 disappears under the
// fist; guard row 6 pokes out on the blade side and the pommel pip sits one
// row clear below the fist, same reading as every other pose.
//                                                     grip pixel = (1,8)
const SW_NE = [
  '........o',
  '......oWo',
  '.....oWwo',
  '....oWwwo',
  '...oWwwo.',
  '..oWwwo..',
  '.obBbo...',
  'obBbo....',
  'oLo......',
  'oLo......',
  'oBo......',
  '.o.......',
];

// Blade SOUTH — the down follow-through, the one pose in the set that points
// AT the camera. Two earlier attempts failed for opposite reasons:
//   * a 4x3 "foreshortened" stub tucked under a brass bar at HIP height, on
//     the teal coat — read as a second satchel. That failure was PLACEMENT.
//   * a straight copy of SW_N's 2x7 bar hung down the leg — measured full
//     length, but only 3 of its 13 steel px fell past the boot line, so it
//     read as a sword at rest, planted point-down in the grass.
// This one fixes placement AND perspective at once: the steel mass lands on
// the GRASS in front of the boots (10 of 13 px below the ground-contact line,
// none of it against the coat), and it is drawn foreshortened.
//
// FORESHORTENING, done as conserved mass rather than as a shrunken sword.
// The blade holds exactly 13 steel px — the same count as SW_N and one more
// than the diagonals — but redistributed from 2 wide x 7 long into 3 wide x
// 5 long. That is what a blade tilted ~35 deg out of the screen plane does:
// the length projects to cos(35) = 0.82 of 9.00 = 7.4 px (measured 7.28) and
// the flat of the blade turns toward the viewer, so the width goes UP. Same
// object, same steel, different aspect — the down blade and the up blade are
// no longer pixel-identical silhouettes, which is exactly the pair that must
// differ most in a 3/4 view.
//
// The axis is 254 deg, not 270: a blade parked at 270 shares a column band
// with the leg above it and the two dark edges merge at 3x. Leaning it 16 deg
// off the body axis puts clear grass between blade and boot, and reads as a
// swing that has just come round rather than a sword being held.
//
// Point a sword at your own feet and the pommel ends up under your palm, so
// there is no pip to draw: three rows of leather run up into the fist and
// stop.                                                grip pixel = (3,1)
const SW_SD = [
  '..oLo..',
  '..oLo..',
  '..oLo..',
  'obBBBbo',
  '.oWWwo.',
  '.oWWwo.',
  'oWWwo..',
  'oWWwo..',
  'oWo....',
  '.o.....',
];

// The gripping fist, re-blitted OVER the sword: 2px of skin, 3px tall, with
// its own dark edges so it reads proud of the steel.
const FIST = ['oSSo', 'oSSo', 'oSso'];

// ---------------------------------------------------------- drone pixels ---

// 16x16 clockwork target drone: brass propeller (2-frame blur), tin dome
// with a painted shooting-target — cream ring, red bullseye — shaded to the
// lower right. It hovers; shadow is drawn separately at ground level.
const DRONE_BODY = [
  '.......oo.......', // mast
  '......obbo......', // brass cap
  '.....oSSSSo.....',
  '....oSCCCCso....',
  '...oSCCCCCCso...',
  '..oSCCRRRRCcso..',
  '..oSCRRRRRRCso..',
  '..oSCRRrrrRCso..',
  '..osCCrrrrCcso..',
  '...osCcccCcso...',
  '....osccccso....',
  '.....ozsszo.....',
  '......ozzo......',
];
const PROP_A = '...obbBBBbbo....';
const PROP_B = '......oBBo......';

// Hazard dummy: spiked dark-red shell, riveted steel plate center — reads
// "do not touch". Grounded (no propeller), same footprint.
const HAZARD = [
  '.......SS.......',
  '......oSSo......',
  '.....orrrro.....',
  '....orRRRRro....',
  '...orRRRRRRro...',
  '..orRRRRRRRRro..',
  'SsorRRSSSSRRroSs',
  'SsorRRSssSRRroSs',
  '..orrRRRRRRrro..',
  '...orrRRRRrro...',
  '....orrRRrro....',
  '.....orrrro.....',
  '......orro......',
  '......oSSo......',
  '.......SS.......',
];

// ----------------------------------------------------------- poof pixels ---

// Death poof: 4 frames of FAT twin-lobed puffs (ALttP's poof is chunky
// cloud-lobes, never a scatter of single specks). Dense ball -> four fat
// lobes tearing apart -> lobes flung to the corners and greying -> a last
// pair of shreds. Nothing thinner than 2px until the final frame.
const POOF_FRAMES = [
  [
    '................',
    '................',
    '.....ooooo......',
    '....ogwwwgo.....',
    '...ogWWWWWgo....',
    '..ogWWWWWWWgo...',
    '..owWWWWWWWwo...',
    '..owWWWWWWWwo...',
    '..ogWWWWWWWgo...',
    '...ogWWWWWgo....',
    '....ogwwwgo.....',
    '.....ooooo......',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '..wwww....www...',
    '.wWWWWw..wWWWw..',
    '.wWWWWw..wWWWWw.',
    '.wWWWWw...wWWw..',
    '..wWWw....wwww..',
    '................',
    '................',
    '...wWw....wWWw..',
    '..wWWWw..wWWWWw.',
    '.wWWWWw..wWWWWw.',
    '.wWWWWw...wWWw..',
    '..wwww.....ww...',
    '................',
    '................',
    '................',
  ],
  [
    '.gwwg......gwwg.',
    'gwWWwg....gwWWwg',
    'gwWWwg....gwWWwg',
    '.gwwg......gwwg.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.gwwg......gwwg.',
    'gwWWwg....gwWWwg',
    'gwWWwg....gwWWwg',
    '.gwwg......gwwg.',
    '................',
    '................',
  ],
  [
    'gwg..........gwg',
    'wWw..........wWw',
    'gwg..........gwg',
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
    'gwg..........gwg',
    'wWw..........wWw',
    'gwg..........gwg',
  ],
];

// -------------------------------------------------------------- helpers ---

// Pixel-perfect clockwise 90-degree rotation (no canvas transform blur).
function rot90(img) {
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

// Where a tracked pixel lands after rot90 / flipH, so the grip point can
// never drift away from the artwork it was measured on.
const rotPt = ([x, y], srcH) => [srcH - 1 - y, x];
const flipPt = ([x, y], w) => [w - 1 - x, y];

// Solid-color silhouette (SNES palette-flash; no alpha blending).
export function whiten(img, color = '#f8f8f8') {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function makeDroneShadow() {
  const c = document.createElement('canvas');
  c.width = 10; c.height = 3;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101410';
  ctx.fillRect(2, 0, 6, 1);
  ctx.fillRect(0, 1, 10, 1);
  ctx.fillRect(2, 2, 6, 1);
  return c;
}

// ------------------------------------------------------- attack bodies ---
//
// Authored here (combat.js owns the swing) on top of copies of Wren's head
// strips, so the hero stays on-model while the ARMS, SHOULDERS, HEAD LEAN
// and BODY HEIGHT all act.
//
// Layout: head strip drawn at (headDx, bob) — a 1px lean that counter-rotates
// on the wind-up and leads on the lunge — then an ATTACK TORSO STRIP over it.
// The torso strip carries THREE blank rows above the normal torso so a raised
// arm can be drawn beside (and in front of) the head without editing the head.
//   screen row of torso strip index i = bob + headRows - 3 + i
// Legs (3 stances) sit at y = 18 under everything.

const DOWN_HEAD = [
  '.....oooooo.....',
  '...ooCCCCCCoo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCco..',
  '..obbbbbbbbbbco.',
  '..obBgbbbbBgbco.',
  '..obggbbbbggbco.',
  '..oHHssssssHHoco',
  '..oHSoSSSSoSHoco',
  '..osSoSSSSoSsoo.',
  '...osSSSSSSso...',
];
const UP_HEAD = [
  '.....oooooo.....',
  '...ooCCCCCCoo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCco..',
  '..obbbbBBbbbbco.',
  '..oCCcCCCCcCCco.',
  '..oCCcCCCCcCco..',
  '.ocoHHHHHHHHHo..',
  '..o.oHHHHHHHHo..',
  '....osssssso....',
];
const LEFT_HEAD = [
  '.....oooooo.....',
  '...ooCCCCCCoo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCco..',
  '.obBgbCCCCCCco..',
  '.obggbCCCCCcco..',
  '.obbbbsHHHHHco..',
  '..oSoSsHHHHHoco.',
  '.oSSoSsHHHHo.o..',
  '..osSSssHHso....',
  '...osSso........',
];

const BLANK = '................';

// --- DOWN: sword arm is the viewer-LEFT arm; far (right) arm answers it ----
//
// FOUR poses, and the TORSO acts in every one of them — not just the arm.
// Two things change per pose in the coat itself:
//   * the near (sword-side) shoulder cap at col 4 of row 3 rides T -> gone
//     -> o -> T, i.e. the shoulder physically drops a row on the lunge and
//     climbs back by the follow-through. A top-down torso twist IS one
//     shoulder dropping on screen while the other holds.
//   * the far arm at col 13 swings against the sword arm: hand LOW (row 6)
//     while the sword is up, hand HIGH (row 5) once the sword is down.
//
// Every pose also carries a teal SLEEVE CUFF on the sword arm, on the side of
// the fist nearer the shoulder — the same tell UP and LEFT use. Without it the
// arm is an unbroken skin column and stops reading as clothed.
//
// 0 wind-up   fist raised clear of the coat beside the head  (1,9)-(2,11)
// 1 lunge     arm driven out level, body dropped 2px         (1,12)-(2,14)
// 2 strike    arm swept down-out, blade on the low diagonal  (1,13)-(2,15)
// 3 follow    arm reaches down-left off the coat, sword down (0,15)-(1,17)
const DOWN_STRIPS = [
  [
    '.oo.............',
    'oSSo............',
    'oSSo............',
    'oSsoTRRRRRReoo..',   // near shoulder UP (trim T on the top row) while the
    'oTToRddtttteoTo.',   // FAR corner is darkened+capped 1px in: far shoulder
    '.oToRttddteeoto.',   // DOWN. The shoulder line tilts; it does not slide.
    '..oottttddeeoSo.',   // far arm hangs LOW (hand at x13, row 6)
    '..ooeetteobboo..',
    '...oeeeeeobdo...',
    '...oeeeeeeeeo...',
  ],
  [
    BLANK,
    '.oo.............',
    'oSSo............',
    'oSSooRRRRRRteo..',   // near shoulder rolls DOWN 1 row (trim -> outline),
    'oSSoTddtttteoTo.',   // and the T trim reappears one row lower
    'oTToRttddteeoto.',   // teal cuff between fist and shoulder
    '.ooottttddeeoSo.',   // far arm still LOW, counter to the sword arm
    '..ooeetteobboo..',
    '...oeeeeeobdo...',
    '...oeeeeeeeeo...',
  ],
  [
    BLANK,
    BLANK,
    '.oo.............',
    'oSSooRRRRRRteo..',   // deepest roll: trim now TWO rows below the top,
    'oSSoRtddttteoTo.',   // and the CHEST FOLD (the dd shadow pair) travels
    'oSsoTtttddeeoSo.',   // one column across the torso with the swing, so
    'oTTotttttddeoo..',   // the plate twists instead of translating
    '..ooeetteobboo..',
    '...oeeeeeobdo...',
    '...oeeeeeeeeo...',
  ],
  [
    BLANK,
    BLANK,
    BLANK,
    '.oooTRRRRRRteo..',   // shoulder cap
    'ottoRddtttteoTo.',   // THE LIMB BENDS. Sleeve leaves the shoulder at x1-2,
    'ttooRttddteeoSo.',   // swings OUT to x0-1, the bright cuff closes it at
    'TToottttddeeoo..',   // y15, then the bare forearm cuts back IN to x1-2
    'oSSoeetteobboo..',   // and the wrist steps in again to x2-3. Column band
    'oSsoeeeeeobdo...',   // 1-2 -> 0-1 -> 1-2 -> 2-3: two direction changes, so
    'oSsoeeeeeeeeo...',   // the arm is a stepped diagonal instead of the
    '.oSSo...........',   // straight 14px column it used to be. The hand lands
  ],                      // at (2,19); crossguard on y22, blade on y23-y27.
];

// --- UP: sword arm is the viewer-RIGHT arm --------------------------------
//
// 0 wind-up   arm out to the side at chest height   fist (13,12)-(14,14)
// 1 lunge     arm swept up and out                  fist (14,11)-(15,13)
// 2 follow    arm punched overhead, blade vertical  fist (14,8)-(15,10)
const UP_STRIPS = [
  [
    BLANK,
    BLANK,
    BLANK,
    '..oTtRRRRRRteo..',
    '.oTottttddteoTTo',
    '.oSottddteeeoSSo',   // far hand pulled HIGH (x2) as the sword cocks
    '.ototddteeeeoSSo',
    '..oobboetteeoSso',
    '...obdoeeeeeoo..',
    '...oeeeeeeeeo...',
    '....oeeeeeeo....',
  ],
  [
    BLANK,
    '..............oo',
    '.............oSS',
    '..oTtRRRRRRteoSS',
    '.oTottttddteooSs',
    '.otottddteeeoTTo',
    '.oSotddteeeeoto.',
    '..oobboetteeoo..',
    '...obdoeeeeeo...',
    '...oeeeeeeeeo...',
    '....oeeeeeeo....',
  ],
  [
    '.............oTT',   // ARM PUNCHED CLEAR OVERHEAD. The fist now sits at
    '.............oTt',   // (14,4) — three rows higher than it used to — so
    '.............oTt',   // the blade tip clears the hat by 4px instead of 1
    '..oTtRRRRRRteoTt',   // and 7 of its 13 steel px are genuinely in front of
    '.oTottttddteoTTo',   // Wren instead of 2. The skin rows travel up with it
    '.otottddteeeoto.',   // (the fist IS the hand, 3 rows, same as before) and
    '.ototddteeeeoSo.',   // the sleeve stretches y7-y10 to reach the shoulder,
    '.oSobboetteeoo..',   // so the pommel pip still lands on teal cuff, never
    '...obdoeeeeeo...',   // on bare forearm.
    '...oeeeeeeeeo...',   // far hand dropped LOW (x2) as the strike lands
    '....oeeeeeeo....',
  ],
];

// --- LEFT profile (RIGHT is the exact mirror) -----------------------------
//
// POSE order (see POSES.left) is wind-up, top, lunge, follow; the strips are
// listed here in the order they were authored, so the TOP strip is index 3.
//   pose 0 wind-up  sword drawn back to the hip, blade cocked up-BEHIND over
//                   the coat and the pack, clear of head    fist (5,14)-(6,16)
//   pose 1 top      arm thrust up-forward, blade VERTICAL in clear air one
//                   column off the leading edge            fist (-1,9)-(0,11)
//   pose 2 lunge    arm whipped forward and high            fist (1,11)-(2,13)
//   pose 3 follow   arm extended, blade level forward       fist (1,13)-(2,15)
const LEFT_STRIPS = [
  [
    BLANK,
    BLANK,
    BLANK,
    '..oRRRRtttoo....',
    '..oRttttttobbo..',
    '.oTotTToteobdbo.',
    '.oTooSSoeeobbo..',
    '.otooSSoeeobbo..',
    '..oeoSsoeeoo....',
    '...oeeeeeeo.....',
  ],
  [
    BLANK,
    'oSSo............',
    'oSSo............',
    'oSsoRRRtttoo....',
    'oTTottttttobbo..',
    '.oTottttteobdbo.',
    '..ooteeeeeobbo..',
    '..ooeeeeeeobbo..',
    '..oeeeeeeeoo....',
    '...oeeeeeeo.....',
  ],
  [
    BLANK,
    BLANK,
    BLANK,
    'oTToRRRtttoo....',
    'oSSottttttobbo..',
    'oSSottttteobdbo.',
    'oSsoteeeeeobbo..',
    '.oooeeeeeeobbo..',
    '..oeeeeeeeoo....',
    '...oeeeeeeo.....',
  ],
  // 1 TOP OF THE ARC (inserted so the swing no longer teleports 88 deg in one
  // frame). The arm is one column further forward and one row higher than the
  // lunge that follows, the torso is mid-rise (bob 1) and the feet are still
  // coiled — so the body acts here too instead of holding the lunge twice.
  [
    'SSo.............',
    'SSo.............',
    'SSo.............',
    'TTooRRRtttoo....',
    'oTtottttttobbo..',
    '.oTottttteobdbo.',
    '..ooteeeeeobbo..',
    '..ooeeeeeeobbo..',
    '..oeeeeeeeoo....',
    '...oeeeeeeo.....',
  ],
];

// --- legs: three stances shared by the head-on facings, three for profile --

const bootCuff = rows => {
  const grid = rows.map(r => [...r]);
  const w = Math.max(...rows.map(r => r.length));
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < grid.length; y++) {
      const ch = grid[y][x];
      if (ch === 'k') { grid[y][x] = 'b'; break; }
      if (ch !== undefined && ch !== '.' && ch !== 'o' && ch !== 'g') break;
    }
  }
  return grid.map(r => r.join(''));
};

// DOWN/UP: narrow rear-weighted -> feet split wide (the lunge) -> closing.
const DU_ATK_BACK = bootCuff([
  '.....oggoggo....',
  '.....oggoggo....',
  '.....okkokko....',
  '....okkkokkko...',
  '....okkkokkko...',
  '.....ooo.ooo....',
]);
const DU_ATK_LUNGE = bootCuff([
  '...oggo..oggo...',
  '...oggo..oggo...',
  '...okko..okko...',
  '..okkko..okkko..',
  '..okkko..okkko..',
  '...ooo....ooo...',
]);
const DU_ATK_SET = bootCuff([
  '....oggooggo....',
  '....oggooggo....',
  '...okkoookko....',
  '..okkkkookkko...',
  '..okkkkookkko...',
  '...oooo..ooo....',
]);

// LEFT profile: rear-weighted coil -> deep forward lunge -> feet together.
const L_ATK_BACK = bootCuff([
  '.....oggggo.....',
  '....ogggggo.....',
  '....oggoggo.....',
  '...okko.okko....',
  '...okkko.okko...',
  '....ooo...oo....',
]);
const L_ATK_LUNGE = bootCuff([
  '.....oggggo.....',
  '....ogggggo.....',
  '...oggo.oggo....',
  '..okko...okko...',
  '.okkkko...okko..',
  '..oooo.....oo...',
]);
const L_ATK_SET = bootCuff([
  '.....oggggo.....',
  '.....oggggo.....',
  '.....okkkko.....',
  '....okkkkko.....',
  '....okkkkko.....',
  '.....ooooo......',
]);

// --------------------------------------------------------- pose tables ---
//
// Per facing, per pose: which strip/legs/bob/head-lean to draw, which sword
// sprite to hang on it, the SCREEN pixel the sword's grip point lands on,
// and the SCREEN top-left of the 2x3 skin fist drawn in the body (which is
// then re-blitted over the sword). grip always sits inside fist.
const POSES = {
  // DOWN sweeps NW -> W -> SW -> S: measured blade bearings 139.4 -> 180 ->
  // 229.4 -> 254.1, i.e. steps of 40.6 / 49.4 / 24.7 degrees. The last step is
  // the smallest on purpose — a swing decelerates into its settle — and it is
  // the only one that also carries a POSITION change big enough to read on its
  // own: the tip travels 8.1px between poses 2 and 3 while the whole blade
  // drops below the ground-contact line.
  //
  // The terminal pose is the one the player sees most (down is the default
  // facing) so it is placed against GRASS, not against Wren: hand at (2,19)
  // hanging off the coat by the boot, crossguard on y22, and all five blade
  // rows on y23-y27 — 10 of 13 steel px past the boot line at y23, versus 3
  // before. Only one steel px touches an occupied body pixel (the boot's
  // bottom outline), and that overlap is deliberate depth: the blade passes IN
  // FRONT of the foot. The tip lands 4px below the sprite, clear of the shadow
  // ellipse's ink (y22-24, x2-13) except where it crosses it, which is again
  // the ground plane doing its job.
  down: [
    { strip: 0, legs: DU_ATK_BACK, bob: 0, lean: 1, sw: 'nw', grip: [1, 10], fist: [1, 9] },
    { strip: 1, legs: DU_ATK_LUNGE, bob: 2, lean: -1, sw: 'w', grip: [1, 13], fist: [1, 12] },
    { strip: 2, legs: DU_ATK_LUNGE, bob: 2, lean: -1, sw: 'sw', grip: [1, 14], fist: [1, 13] },
    { strip: 3, legs: DU_ATK_SET, bob: 1, lean: 0, sw: 'sd', grip: [2, 20], fist: [2, 19] },
  ],
  // UP runs E -> NE -> N at 49.4 / 40.6 deg. The terminal fist is at (14,4),
  // three rows higher than the shoulder-height hold it used to sit at, so the
  // overhead blade actually reaches PAST the hat: 7 of 13 steel px above the
  // sprite instead of 2, tip 4px clear. Down and up no longer draw the same
  // 2x7 bar — the away-blade is long and thin, the at-camera blade is short
  // and wide (see SW_SD).
  up: [
    { strip: 0, legs: DU_ATK_BACK, bob: 0, lean: -1, sw: 'e', grip: [13, 13], fist: [13, 12] },
    { strip: 1, legs: DU_ATK_LUNGE, bob: 2, lean: 1, sw: 'ne', grip: [14, 12], fist: [14, 11] },
    { strip: 2, legs: DU_ATK_SET, bob: 0, lean: 0, sw: 'n', grip: [14, 5], fist: [14, 4] },
  ],
  // LEFT (and its mirror) now runs FOUR poses, NE -> N -> NW -> W: bearings
  // 49.4 -> 90 -> 139.4 -> 180, steps of 40.6 / 49.4 / 40.6 — the same even
  // ladder down uses, instead of the old 88.5-then-31 lurch that spent 74% of
  // the arc in a single frame transition and then held the last pose for 6 of
  // 8 drawn frames. Frames now split 2/2/2/2.
  //
  // The N pose is placed one column OFF the sprite's leading edge (grip x -1),
  // so the vertical blade is in clear air rather than over the goggles and
  // face — the only place a straight-up blade can go on a 16px-wide profile
  // sprite without covering the head. The wind-up grip moved 1px to x6 (still
  // inside the same fist, on its far column) for the same reason: it puts the
  // cocked blade over the coat and the pack instead of clipping the jaw.
  left: [
    { strip: 0, legs: L_ATK_BACK, bob: 0, lean: 1, sw: 'ne', grip: [6, 16], fist: [5, 14] },
    { strip: 3, legs: L_ATK_BACK, bob: 1, lean: 0, sw: 'n', grip: [-1, 10], fist: [-1, 9] },
    { strip: 1, legs: L_ATK_LUNGE, bob: 2, lean: -1, sw: 'nw', grip: [1, 12], fist: [1, 11] },
    { strip: 2, legs: L_ATK_SET, bob: 1, lean: 0, sw: 'w', grip: [1, 14], fist: [1, 13] },
  ],
};
// RIGHT is the exact mirror of LEFT: body flipped, x mirrored about the 16px
// sprite, and MIRRORED sword sprites (not rotated ones — rotation preserves
// chirality, so rot(ne) is not flip(ne) and the hilt would land elsewhere).
const MIRROR_SW = { ne: 'fne', nw: 'fnw', w: 'fw', n: 'fn' };
POSES.right = POSES.left.map(p => ({
  ...p,
  sw: MIRROR_SW[p.sw],
  grip: [15 - p.grip[0], p.grip[1]],
  fist: [14 - p.fist[0], p.fist[1]],   // 2px wide: mirror both columns
}));

// Exported so the measurement tooling can read the authored grips/fists and
// check the bearings claimed in these comments against the RENDERED pixels.
export { POSES as ATTACK_POSES };

const STRIPS = { down: DOWN_STRIPS, up: UP_STRIPS, left: LEFT_STRIPS, right: LEFT_STRIPS };
const HEADS = { down: DOWN_HEAD, up: UP_HEAD, left: LEFT_HEAD, right: LEFT_HEAD };

function composeAttack(head, strip, legs, bob, lean) {
  for (const r of head.concat(strip, legs)) {
    if (r.length !== 16) throw new Error('attack sprite row not 16 wide: "' + r + '"');
  }
  const c = document.createElement('canvas');
  c.width = 16; c.height = 24;
  const ctx = c.getContext('2d');
  ctx.drawImage(makeSprite(legs, WREN_PAL), 0, 18);
  ctx.drawImage(makeSprite(head, WREN_PAL), lean, bob);
  ctx.drawImage(makeSprite(strip, WREN_PAL), 0, bob + head.length - 3);
  return c;
}

// { down|up|left|right: [windUp, lunge, ..., followThrough] } of 16x24
// canvases. Three entries per facing except down, which has four.
export function makeAttackBodies() {
  const out = {};
  for (const dir of ['down', 'up', 'left']) {
    out[dir] = POSES[dir].map(p =>
      composeAttack(HEADS[dir], STRIPS[dir][p.strip], p.legs, p.bob, p.lean));
  }
  out.right = out.left.map(flipH);
  return out;
}

// ------------------------------------------------------------ sprite set ---

let CACHE = null;
export function makeCombatSprites() {
  if (CACHE) return CACHE;
  // Each sword entry carries its own grip point, tracked through every
  // rotation/flip so it can never fall out of sync with the pixels.
  const n = makeSprite(SW_N, SWORD_PAL), gN = [3, 10];
  const e = rot90(n), gE = rotPt(gN, n.height);
  const s = rot90(e), gS = rotPt(gE, e.height);
  const w = rot90(s), gW = rotPt(gS, s.height);
  const ne = makeSprite(SW_NE, SWORD_PAL), gNE = [1, 8];
  const se = rot90(ne), gSE = rotPt(gNE, ne.height);
  const sw = rot90(se), gSW = rotPt(gSE, se.height);
  const nw = rot90(sw), gNW = rotPt(gSW, sw.height);
  const sd = makeSprite(SW_SD, SWORD_PAL), gSD = [3, 1];

  const sword = {
    n: { img: n, grip: gN }, e: { img: e, grip: gE },
    s: { img: s, grip: gS }, w: { img: w, grip: gW },
    ne: { img: ne, grip: gNE }, se: { img: se, grip: gSE },
    sw: { img: sw, grip: gSW }, nw: { img: nw, grip: gNW },
    sd: { img: sd, grip: gSD },
    fne: { img: flipH(ne), grip: flipPt(gNE, ne.width) },
    fnw: { img: flipH(nw), grip: flipPt(gNW, nw.width) },
    fw: { img: flipH(w), grip: flipPt(gW, w.width) },
    fn: { img: flipH(n), grip: flipPt(gN, n.width) },
  };

  const droneA = makeSprite([PROP_A, ...DRONE_BODY], DRONE_PAL);
  const droneB = makeSprite([PROP_B, ...DRONE_BODY], DRONE_PAL);
  const hazard = makeSprite(HAZARD, DRONE_PAL);
  const fist = makeSprite(FIST, WREN_PAL);
  CACHE = {
    sword,
    fist, fistR: flipH(fist),
    body: makeAttackBodies(),
    drone: [droneA, droneB],
    droneWhite: whiten(droneA),
    hazard,
    hazardWhite: whiten(hazard),
    droneShadow: makeDroneShadow(),
    poof: POOF_FRAMES.map(rows => makeSprite(rows, POOF_PAL)),
    spark: SPARK_FRAMES.map(rows => makeSprite(rows, SPARK_PAL)),
  };
  return CACHE;
}

// -------------------------------------------------------- swing geometry ---

// Hit rects (player-relative): [0] diagonal quadrant (frames 2-4),
// [1] forward quadrant (frames 5-6).
const HITS = {
  right: [{ x: 8, y: -8, w: 20, h: 22 }, { x: 12, y: 4, w: 16, h: 16 }],
  left: [{ x: -12, y: -8, w: 20, h: 22 }, { x: -12, y: 4, w: 16, h: 16 }],
  up: [{ x: 2, y: -12, w: 20, h: 20 }, { x: -2, y: -12, w: 18, h: 16 }],
  down: [{ x: -12, y: 12, w: 20, h: 20 }, { x: -2, y: 14, w: 16, h: 18 }],
};

const SWING_LEN = 9;
// ART AND HITBOX AGREE ON THE FIRST ACTIVE FRAME. Both pose tables still show
// the WIND-UP at t=2 (blade cocked behind the shoulder, outside the quadrant
// the rect covers), and both are LUNGING by t=3 — so the first frame that can
// kill is the first frame whose drawn blade is inside the box. Costs nothing:
// t=2 and t=3 test the identical rect (`t < 5`) and the player is locked in
// place for the whole swing, so no reachable target changes state between them.
const HIT_FIRST = 3, HIT_LAST = 6;

// Frame -> pose, indexed by t (0..8; only t = 1..8 are ever drawn), keyed by
// how many poses the facing has. Four-pose facings (down, left, right) run an
// even 2/2/2/2, so no single image hogs the swing and the terminal pose holds
// for 2 drawn frames instead of 3; up's three poses keep the 2/3/3 split.
// Hit frames key off `t`, never off the pose index, so adding left/right's
// fourth pose changed no mechanic: t=3-4 still test the diagonal rect and
// t=5-6 the forward one, and both still land on a drawn blade inside them.
const POSE_AT = {
  3: [0, 0, 0, 1, 1, 1, 2, 2, 2],
  4: [0, 0, 0, 1, 1, 2, 2, 3, 3],
};

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ------------------------------------------------------------------ audio ---
//
// ON A REAL CARTRIDGE THE IMPACT IS 60% SOUND. src/game/sfx.js has shipped
// `swing` (COGBLADE WHOOSH), `hit` (BLADE MEETS HIDE), `clink` (BLADE ON
// BRASS) and `poof` (ENEMY BURSTS) since round 8, authored and passed by its
// own critic — and this file called NONE of them. A round-18 critic
// instrumented the sfx layer and drove a full approach-and-connect on a bridge
// beetle: zero audio events. The only sound in the whole exchange was `hurt`,
// which is Wren being hit. Freeze, white flash, spark, recoil, winded beat —
// the whole ALttP grammar was already here and played in silence.
//
// Routing, in the order it is tried:
//   melee.onSfx(name)   a host that wants to own the routing
//   window.__gwSfx      the hook transition.js / items.js / boss-kettleback.js
//                       already call, and the one src/scenes/dungeon.js
//                       re-wraps around its own sfx import
//   SFX.play(name)      the imported singleton, so the swing has a voice even
//                       in a scene that never imported sfx.js at all. Importing
//                       sfx.js also installs `window.__gwSfx` and arms the
//                       first-gesture unlock, so this branch is a real fallback
//                       and not a second silent module.
//
// NOTHING HERE OVERRIDES `rand`, `detune`, `vel` OR `steal`. The bank's own
// per-sound pitch jitter is what stops a sound the player triggers hundreds of
// times a session from fatiguing (swing +/-90 cents, hit 110, clink 150,
// poof 80), and passing a detune would defeat exactly that. Retrigger
// cooldowns (swing 50 ms, hit/clink 40 ms, poof 50 ms), the per-sound
// polyphony caps (3 each) and the 8-voice budget are likewise the bank's to
// enforce: play() is documented as always safe to call and returns false when
// it declines, so a mashed B button cannot stack nine whooshes.
function emitSfx(name, hook) {
  if (!name) return false;
  try {
    if (hook) { hook(name); return true; }
    if (typeof window !== 'undefined' && window.__gwSfx) return window.__gwSfx(name) !== false;
    return !!SFX.play(name);
  } catch (e) { return false; }   // audio must never break the fight
}

// An entity that owns its own voice is left alone: KETTLEBACK answers the
// blade with `clink` off the shell and `bosshit` into a seized boiler, and a
// generic `hit` layered on top of that would be two sounds for one blow.
function voicesItself(e) {
  return typeof e.sfx === 'function' || typeof e.onSfx === 'function';
}

// Struck-metal returns from the hittable protocol. `none` is NOT here: a blow
// eaten by invulnerability makes no sound in ALttP, it simply does not happen.
// `block` is what world/boilerworks.js's shielded TIN SOLDIER returns when the
// blade lands on the face its shield is covering — the live brass clink.
const DEFLECT = new Set(['block', 'blocked', 'clink', 'deflect', 'parry', 'armor', 'armour']);

// Which sound a landed blow makes. An entity may name its own with `hitSound`;
// otherwise anything that declares itself brass/tin rings instead of thudding.
function hitSoundFor(e) {
  if (typeof e.hitSound === 'string') return e.hitSound;
  return (e.metal || e.brass || e.armored || e.armoured) ? 'clink' : 'hit';
}

// SWORD ON WALL. Top-down collision lives in the FEET plane, so the probe is
// the player's own feet box (mirrors HB in player.js) shoved one third of a
// tile in the facing direction. The swing reaches ~12 px past the sprite edge;
// probing 10 px is contact rather than wishful thinking.
const FEET = { x: 2, y: 14, w: 12, h: 10 };
const WALL_REACH = 10;
const FACE_V = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };

// FINDING THE COLLISION MAP WITHOUT ONE. `melee.update(input, player, ents)`
// is the signature all four shipping call sites use and none of them hands
// over a map, so the supported route is the optional 4th argument (or
// `melee.setMap(room.map)`) — and a feature that only works once somebody else
// changes their file is this project's entire failure history. So the map is
// ALSO taken from the player itself: every scene calls `player.update(input,
// map)` immediately after `melee.update(...)`, and this records the argument
// on the instance as it goes past. One own-property wrapper on the one player
// object handed to this Melee, idempotent, re-armed if the scene swaps the
// player, and it calls straight through — the player's behaviour is untouched.
function armMapSniffer(player) {
  if (!player || player.__gwMapSniff) return;
  const orig = player.update;
  if (typeof orig !== 'function') return;
  try {
    player.__gwMapSniff = 1;
    player.update = function (input, map) {
      if (map && typeof map.boxFree === 'function') this.__gwMap = map;
      return orig.apply(this, arguments);
    };
  } catch (e) { /* frozen player: the explicit map argument still works */ }
}

// ---------------------------------------------------------------- effects ---

// IMPACT SPARK — three frames of hard white struck-metal, drawn at the point
// the blade met the hurtbox and gone in 6 engine frames. It is deliberately
// NOT the poof: a tight 4-point star that opens and shreds, never a cloud, so
// "I hit it" and "I killed it" never read as the same event.
const SPARK_PAL = { W: '#f8f8f8', w: '#cfd8e4', o: '#231327' };
const SPARK_FRAMES = [
  [
    '..........',
    '..........',
    '....o.....',
    '...oWo....',
    '..oWWWo...',
    '...oWo....',
    '....o.....',
    '..........',
    '..........',
    '..........',
  ],
  [
    '....o.....',
    '...oWo....',
    'o.oWWWo.o.',
    '.oWWWWWo..',
    'oWWWWWWWo.',
    '.oWWWWWo..',
    'o.oWWWo.o.',
    '...oWo....',
    '....o.....',
    '..........',
  ],
  [
    'w...o....w',
    '.o.oWo.o..',
    '..o.w.o...',
    'o.w...w.o.',
    '...w.w....',
    'o.w...w.o.',
    '..o.w.o...',
    '.o.oWo.o..',
    'w...o....w',
    '..........',
  ],
];

export class Spark {
  constructor(cx, cy, frames) {
    this.x = cx - 5; this.y = cy - 5;
    this.t = 0;
    this.frames = frames;
  }
  update() { this.t++; }
  get done() { return this.t >= 6; }
  draw(ctx) {
    ctx.drawImage(this.frames[Math.min(2, (this.t / 2) | 0)],
      Math.round(this.x), Math.round(this.y));
  }
}

export class Poof {
  constructor(cx, cy, frames) {
    this.x = cx - 8; this.y = cy - 8;
    this.t = 0;
    this.frames = frames;
  }
  update() { this.t++; }
  get done() { return this.t >= 12; }
  draw(ctx) {
    const f = this.frames[Math.min(3, (this.t / 3) | 0)];
    ctx.drawImage(f, Math.round(this.x), Math.round(this.y));
  }
}

// ------------------------------------------------------------------ sword ---

class Sword {
  constructor(spr) {
    this.spr = spr;
    this.t = -1;                 // -1 idle, else 0..SWING_LEN-1
    this.dir = 'down';
    this._struck = new Set();    // entities already hit this swing
    this._tinked = false;        // wall clink already spent this swing
  }
  get active() { return this.t >= 0; }
  // Drawn frames are t = 1..8, spread evenly over however many poses this
  // facing has so no single image hogs the swing. (Hit rects key off `t`
  // directly, so this is art-only: the mechanics are unchanged.)
  get poseIndex() {
    const map = POSE_AT[POSES[this.dir].length];
    return map[Math.min(map.length - 1, Math.max(0, this.t))];
  }

  start(dir) {
    this.t = 0;
    this.dir = dir;
    this._struck.clear();
    this._tinked = false;
  }

  hitRect(player) {
    if (this.t < HIT_FIRST || this.t > HIT_LAST) return null;
    const r = HITS[this.dir][this.t < 5 ? 0 : 1];
    return { x: player.x + r.x, y: player.y + r.y, w: r.w, h: r.h };
  }

  // Advance one frame; strike any hittable entity in the arc (once each).
  // Returns { stop, sparks }: how many frames the attacker should freeze for
  // and where the blade actually connected. An entity opts into the freeze by
  // declaring `hitstopFrames` (the enemies in game/enemies.js do); bushes,
  // pots and grass do not, so mowing scenery still feels weightless and only
  // hitting a CREATURE stops the swing dead.
  // Is there a solid one third of a tile in front of the blade? The map is
  // optional everywhere in this file: without one the swing simply never
  // tinks, which is what a scene with no collision layer should sound like.
  wallAhead(player, map, ents) {
    if (!map || typeof map.boxFree !== 'function') return false;
    const v = FACE_V[this.dir];
    if (!v) return false;
    const box = {
      x: player.x + FEET.x + v[0] * WALL_REACH,
      y: player.y + FEET.y + v[1] * WALL_REACH,
      w: FEET.w, h: FEET.h,
    };
    try {
      if (map.boxFree(box.x, box.y, box.w, box.h)) return false;
      // A BUSH IS NOT A WALL. Bushes and pots install themselves as collision
      // obstacles, so the solid the probe just found may be foliage the player
      // simply missed — and a hedge that rings like a shield is worse than a
      // hedge that says nothing. Anything in the probe with a body is an
      // entity, and entities answer for themselves.
      //
      // The test is the entity's TILE, not its hurtbox: a pot's hurtbox is the
      // top 10 px of its 16x16 cell while the probe runs along the feet plane
      // at the bottom of it, so hurtbox-only exclusion misses by two pixels and
      // the pot rings like brass.
      for (const e of ents || []) {
        if (e.hp <= 0) continue;
        if (typeof e.hurtbox === 'function' && overlap(box, e.hurtbox())) return false;
        if (typeof e.x === 'number' && typeof e.y === 'number'
            && overlap(box, { x: e.x, y: e.y, w: 16, h: 16 })) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  update(player, ents, map) {
    const rect = this.hitRect(player);
    let stop = 0;
    const sparks = [];
    const sounds = [];   // one entry per audible event this frame
    const kills = [];    // creatures this blow put down; they burst later
    if (rect) {
      const pcx = player.x + 8, pcy = player.y + 16;
      for (const e of ents) {
        if (e.hp <= 0 || this._struck.has(e)) continue;
        const hb = e.hurtbox();
        if (!overlap(rect, hb)) continue;
        this._struck.add(e);
        const dx = hb.x + hb.w / 2 - pcx, dy = hb.y + hb.h / 2 - pcy;
        const len = Math.hypot(dx, dy) || 1;
        const hpBefore = e.hp;
        // The hittable protocol's optional return: 'hit' / 'block' / 'none'
        // (world/boilerworks.js's TIN SOLDIER and boss-kettleback.js speak it;
        // beetles, bats, slimes, bushes and pots return nothing at all).
        const res = e.onHit({ x: dx / len, y: dy / len });
        const verdict = typeof res === 'string' ? res.toLowerCase() : '';
        const landed = e.hp < hpBefore;
        const creature = e.hitstopFrames > 0 || verdict === 'hit';
        // Only a blow that actually landed (not one eaten by invulnerability
        // or a shield) is allowed to freeze the swing.
        // Creatures only, on both counts: a bush must still be cut in one
        // weightless motion, with its own leaves for a reaction.
        if (landed && e.hitstopFrames > 0) {
          stop = Math.max(stop, e.hitstopFrames);
          // Spark on the near edge of the hurtbox, where the steel met it.
          sparks.push([
            Math.max(hb.x, Math.min(hb.x + hb.w, pcx + dx / len * 10)),
            Math.max(hb.y, Math.min(hb.y + hb.h, pcy + dy / len * 10)),
          ]);
        }
        if (voicesItself(e)) continue;   // KETTLEBACK answers for itself
        if (landed && creature) {
          // BLADE MEETS HIDE. This is the sound the whole hit reaction was
          // missing: it lands on the same frame as the freeze, the flash and
          // the spark, because those four ARE one event.
          sounds.push(hitSoundFor(e));
          if (e.hp <= 0) kills.push(e);
        } else if (!landed && DEFLECT.has(verdict)) {
          // BLADE ON BRASS: the shield took it. A ring, never a thud, and no
          // spark — the spark is the hit-confirm and this is its opposite.
          sounds.push('clink');
        }
      }
    }
    // SWORD ON WALL. Tested on the first active frame — the same frame
    // anything in the arc would have been struck — and only when the arc
    // found NOTHING AT ALL, entities included. `_struck`, not `_softHits`:
    // bushes and pots are obstacles in the collision map as well as
    // hittables, so a blade that just cut a hedge would otherwise ring off
    // the hedge's own footprint and the player would hear brass in a bush.
    // Once per swing either way: the blade strikes the stone once, it does
    // not grind along it for four frames.
    if (this.t === HIT_FIRST && !this._tinked && this._struck.size === 0
        && this.wallAhead(player, map, ents)) {
      this._tinked = true;
      sounds.push('clink');
    }
    this.t++;
    if (this.t >= SWING_LEN) this.t = -1;
    return { stop, sparks, sounds, kills };
  }

  // Nothing is drawn behind the body any more: every pose is placed so the
  // blade clears (or deliberately crosses in front of) Wren's silhouette,
  // which is what fixed the "blade hidden for the whole up-swing" bug. Kept
  // so scenes can keep interleaving under/over around the player sprite.
  drawUnder() {}

  // Sword first, then the fist ON TOP of it — the hand wraps the hilt.
  drawOver(ctx, player) {
    if (!this.active) return;
    const p = POSES[this.dir][this.poseIndex];
    const sw = this.spr.sword[p.sw];
    const px = Math.round(player.x), py = Math.round(player.y);
    ctx.drawImage(sw.img, px + p.grip[0] - sw.grip[0], py + p.grip[1] - sw.grip[1]);
    const fistImg = (this.dir === 'right' || this.dir === 'up')
      ? this.spr.fistR : this.spr.fist;
    ctx.drawImage(fistImg, px + p.fist[0] - 1, py + p.fist[1]);
  }
}

// ------------------------------------------------------------- controller ---

// Owns the sword, the effects list, and hazard-contact checks. A scene calls
// update() BEFORE player.update() (so lock lands the same frame), interleaves
// drawUnder/drawOver around the player sprite, and drawFx() on top of all.
export class Melee {
  constructor() {
    this.spr = makeCombatSprites();
    this.sword = new Sword(this.spr);
    this.effects = [];
    this.hitstop = 0;   // frames the swing is frozen on a connect
    this.onSfx = null;  // optional host override; else window.__gwSfx / sfx.js
    this.map = null;    // optional collision map for the sword-on-wall tink
    this._dying = [];   // creatures killed by the blade, waiting to burst
    this._poofGuard = 0;
  }

  /** Hand the controller a collision map so swinging at a wall can tink. */
  setMap(map) { if (map && typeof map.boxFree === 'function') this.map = map; }

  sfx(name) { return emitSfx(name, this.onSfx); }

  // ENEMY BURSTS. Every poof this controller spawns is a puff of steam leaving
  // a machine, so every one of them is voiced. The guard is frames, not the
  // bank's 50 ms retrigger cooldown: a drone dying at the moment the watcher
  // below also spots it dead must be one burst, deterministically, whatever
  // order the host happens to update its entities in.
  spawnPoof(cx, cy) {
    this.effects.push(new Poof(cx, cy, this.spr.poof));
    if (this._poofGuard <= 0) { this._poofGuard = 3; this.sfx('poof'); }
  }
  spawnSpark(cx, cy) { this.effects.push(new Spark(cx, cy, this.spr.spark)); }

  _connect(res, player) {
    for (const [x, y] of res.sparks) this.spawnSpark(x, y);
    if (res.stop > this.hitstop) this.hitstop = res.stop;
    for (const name of res.sounds) this.sfx(name);
    for (const e of res.kills) this._dying.push({ e, t: 0 });
  }

  // THE BURST IS NOT THE BLOW. A killed creature burns white and slides the
  // full recoil BEFORE it bursts (game/enemies.js: state 'die' holds while
  // `kb` is live; Drone below: while `kbT` counts down), so the poof lands
  // 10-14 frames after the hit that caused it. Firing `poof` on the killing
  // blow would put the burst sound on top of `hit` and leave the actual
  // cloud silent. This watches the corpses instead.
  _tickDying() {
    if (this._poofGuard > 0) this._poofGuard--;
    if (!this._dying.length) return;
    const still = [];
    for (const d of this._dying) {
      const e = d.e;
      d.t++;
      const sliding = !!e.kb || e.kbT > 0 || e.stop > 0;
      // `dead` means the poof frames have already finished playing; the 48
      // frame ceiling is a corpse whose host never advanced it at all.
      if (!sliding || e.dead || d.t > 48) {
        if (this._poofGuard <= 0) { this._poofGuard = 3; this.sfx('poof'); }
      } else {
        still.push(d);
      }
    }
    this._dying = still;
  }

  update(input, player, ents, map) {
    armMapSniffer(player);
    this.setMap(map);
    const live = (map && typeof map.boxFree === 'function') ? map
      : (player && player.__gwMap) || this.map;

    this._tickDying();
    for (const fx of this.effects) fx.update();
    this.effects = this.effects.filter(fx => !fx.done);

    // HITSTOP. The swing holds on the frame that connected — the pose, the
    // blade and the player's lock all stay exactly where they were — while
    // the struck creature holds its own matching freeze (enemies.js HIT.STOP).
    // This is the difference between a sword that hits something and a sword
    // that decrements a counter. Only ever entered mid-swing, so the player is
    // never frozen out of a swing that has already ended.
    if (this.hitstop > 0 && this.sword.active) {
      this.hitstop--;
      player.lock = true;
      player.attackPose = true;
      player.attackBodies = this.spr.body;
      player.attackIndex = this.sword.poseIndex;
      return;
    }
    this.hitstop = 0;

    if (this.sword.active) {
      this._connect(this.sword.update(player, ents, live), player);
    } else if (input.hit('a') && player.kbT <= 0) {
      this.sword.start(player.dir);
      // COGBLADE WHOOSH, on the press. The bank's own note: the blade is
      // already moving when the press registers, so the transient belongs at
      // the front of the animation and not three frames into it.
      this.sfx('swing');
      this._connect(this.sword.update(player, ents, live), player);
    }
    player.lock = this.sword.active;
    player.attackPose = this.sword.active;
    // Hand the body its acting frames; player.js picks [dir][index].
    player.attackBodies = this.spr.body;
    player.attackIndex = this.sword.poseIndex;

    // Hazard contact: body box vs hazard hurtbox -> knockback away from it.
    if (player.invulnT <= 0 && player.kbT <= 0) {
      const pb = { x: player.x + 2, y: player.y + 8, w: 12, h: 14 };
      for (const e of ents) {
        if (!e.hazard || e.hp <= 0) continue;
        const hb = e.hurtbox();
        if (!overlap(pb, hb)) continue;
        player.hurt(pb.x + pb.w / 2 - (hb.x + hb.w / 2),
          pb.y + pb.h / 2 - (hb.y + hb.h / 2));
        break;
      }
    }
  }

  drawUnder(ctx, player) { this.sword.drawUnder(ctx, player); }
  drawOver(ctx, player) { this.sword.drawOver(ctx, player); }
  drawFx(ctx) { for (const fx of this.effects) fx.draw(ctx); }
}

// ------------------------------------------------------------------ drone ---

// Training target drone. Implements the hittable protocol; hovers with a
// 1px bob (shadow stays planted at ground level). opts: { hp, hazard,
// respawns, phase }. The hazard variant is grounded and spiky.
export class Drone {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y;
    this.home = { x, y };
    this.maxHp = opts.hp ?? 2;
    this.hp = this.maxHp;
    this.hazard = !!opts.hazard;
    this.respawns = !!opts.respawns;
    this.phase = opts.phase ?? 0;
    this.kbX = 0; this.kbY = 0; this.kbT = 0;
    this.flashT = 0;
    this.invulnT = 0;
    this.respawnT = 0;
    this.stop = 0;
    this.hitstopFrames = 3;   // the dock drones are the first thing the sword
    this.spr = makeCombatSprites();   // ever touches: they hold the impact too
  }

  get baseY() { return this.y + 16; }
  // Alive, or dead but still sliding through the death knockback.
  get visible() { return this.hp > 0 || this.kbT > 0; }

  hurtbox() { return { x: this.x + 1, y: this.y + 3, w: 14, h: 11 }; }

  onHit(dir) {
    if (this.invulnT > 0 || this.hp <= 0) return;
    this.hp--;
    this.kbX = dir.x; this.kbY = dir.y; this.kbT = 8;
    this.invulnT = 12;
    this.stop = this.hitstopFrames;
    // 2-frame white flash on a hit; the killing blow stays white through the
    // whole death slide (ALttP enemies burn white until the poof).
    this.flashT = this.hp <= 0 ? 8 : 2;
  }

  update(map, melee) {
    // The flash counter is latched the same way the enemies' is: it only ever
    // ticks on a frame that actually DREW white, so the 2-frame flash cannot
    // be eaten by a host that calls melee.update() before this one (every
    // scene in this project does, and a critic measured the flash rendering
    // for exactly one frame because of it).
    if (this.flashT > 0 && this._flashDrawn) { this.flashT--; this._flashDrawn = 0; }
    if (this.invulnT > 0) this.invulnT--;
    if (this.stop > 0) { this.stop--; return; }   // hitstop, matching the swing

    if (!this.visible) {
      if (this.respawns && this.respawnT > 0 && --this.respawnT === 0) {
        this.x = this.home.x; this.y = this.home.y;
        this.hp = this.maxHp;
        this.invulnT = 20;
        this.flashT = 0; this._flashDrawn = 0; this.stop = 0;
        melee.spawnPoof(this.x + 8, this.y + 8); // arrival puff
      }
      return;
    }

    if (this.kbT > 0) {
      // 4 px/frame decaying linearly over 8 frames, wall-clipped.
      const sp = 4 * this.kbT / 8;
      this._slide(map, this.kbX * sp, this.kbY * sp);
      this.kbT--;
      if (this.kbT === 0 && this.hp <= 0) {
        melee.spawnPoof(this.x + 8, this.y + 8);
        if (this.respawns) this.respawnT = 120;
      }
    }
  }

  _slide(map, dx, dy) {
    const hb = () => this.hurtbox();
    for (const [axis, amt] of [['x', dx], ['y', dy]]) {
      if (!amt) continue;
      const sign = Math.sign(amt);
      let rem = Math.abs(amt);
      while (rem > 1e-6) {
        const step = Math.min(0.5, rem) * sign;
        const b = hb();
        const nx = axis === 'x' ? b.x + step : b.x;
        const ny = axis === 'y' ? b.y + step : b.y;
        if (!map.boxFree(nx, ny, b.w, b.h)) break;
        if (axis === 'x') this.x += step; else this.y += step;
        rem -= Math.abs(step);
      }
    }
  }

  draw(ctx, frame) {
    if (!this.visible) return;
    const rx = Math.round(this.x), ry = Math.round(this.y);
    ctx.drawImage(this.spr.droneShadow, rx + 3, ry + 15);
    let img;
    const white = this.flashT > 0;
    if (white) this._flashDrawn = 1;
    if (this.hazard) {
      img = white ? this.spr.hazardWhite : this.spr.hazard;
      ctx.drawImage(img, rx, ry);
      return;
    }
    // Hover bob: 1px, ~half-second period; propeller blur alternates fast.
    const b4 = ((frame + this.phase) >> 3) & 3;
    const bob = (b4 === 1 || b4 === 2) ? -1 : 0;
    img = white ? this.spr.droneWhite : this.spr.drone[(frame >> 2) & 1];
    ctx.drawImage(img, rx, ry + bob);
  }
}
