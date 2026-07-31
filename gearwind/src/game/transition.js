// Gearwind — connective tissue: screen scrolls, door/stair transitions, the
// island lurch, and the item-get moment. One object owns all of them because
// on the SNES they are all the same thing: the PPU is told to scroll, dim, or
// colour-add the whole screen for a handful of frames while the game logic
// holds still.
//
// WHY PIXEL LUTs AND NOT ALPHA: ALttP fades with INIDISP master brightness
// (16 levels) and flashes with colour-math fixed-colour addition. Both are
// palette-level operations — every colour on screen moves at once, and the
// result is still a 5-bit-per-channel SNES colour. Drawing a translucent
// black rect over the frame is a PC-era approximation that produces
// off-hardware colours and blends sprite edges. So fades here run the frame
// buffer through a 256-entry LUT that quantises back to the 5-bit grid.
//
// TIMINGS (in 60Hz frames):
//   screen scroll   256px over 32f / 224px over 28f — 8 px/frame on BOTH axes,
//                   CONSTANT. A BG scroll register is incremented by a fixed
//                   amount per frame; there is no ease-in, no ease-out.
//   door fade       8f out, 3f black, 8f in
//   staircase       11f walking 16px in under an 8f fade, 4f black, 8f fade-in
//                   over an 11f / 16px walk-out
//   (every scripted walk steps at WALK_SPEED and feeds the same number into
//    animDist, so the legs never out-run or under-run the body — see _step)
//   lurch           8f, single vertical axis, 4 -> 3 -> 2 -> 1 -> 0 px
//   item get        6f white flash, pose held, text box until A
//
// USAGE (a scene drives it):
//   this.tr = new Transitions({ rand: () => engine.rand(), onSfx: name => ... });
//   update(dt, engine) {
//     this.tr.update(engine.input, engine);
//     if (!this.tr.frozen) { ...normal game update... }
//   }
//   draw(ctx, engine) {
//     this.tr.render(ctx, (c) => this.drawWorld(c), { ui: (c) => this.hud.draw(c) });
//   }
// `drawWorld` must skip drawing the player when `tr.posing` is true — the
// item-get moment draws its own pose. `opts.ui` is for the status bar: it is
// painted after the world (so a screen scroll does not drag it along) but
// before the fade LUT (so it dims with everything else), exactly like ALttP's
// separate HUD background layer.
import { WIDTH, HEIGHT } from '../engine.js';
import { makeSprite, flipH } from '../sprites.js';
import { WREN_PAL } from './player-sprites.js';
import { WALK_SPEED } from './player.js';

const BRIGHT_MAX = 15;               // INIDISP has 16 brightness steps

// --------------------------------------------------------------------------
// Frame-buffer LUTs: brightness (0..15) and additive white flash (0..15).
// One 256-entry table per (level, flash) pair, built once and cached.
// --------------------------------------------------------------------------
const lutCache = new Map();
function channelLut(level, flash) {
  const key = level * 16 + flash;
  let t = lutCache.get(key);
  if (!t) {
    t = new Uint8Array(256);
    const m = level / BRIGHT_MAX, add = (flash / BRIGHT_MAX) * 255;
    for (let i = 0; i < 256; i++) {
      const v = i * m + add;
      // snap back onto the SNES 5-bit colour grid
      t[i] = Math.max(0, Math.min(248, Math.round(Math.min(255, v) / 8) * 8));
    }
    lutCache.set(key, t);
  }
  return t;
}

// --------------------------------------------------------------------------
// Wren's item-raise pose. Authored here (not in player-sprites.js, which this
// piece may not edit) from the same 15-colour WREN_PAL, so it matches the
// walk sheet exactly: the front-facing head, a torso with no side arms, and
// two separate arm sprites raised at the sides. Like ALttP's item raise, the
// pose is WIDER than the 16px walk sprite — the arms are their own OAM tiles
// sticking out past the body.
// --------------------------------------------------------------------------
const HOLD_HEAD = [
  '.....oooooo.....',
  '...ooCCCCCCoo...',
  '..oCCCCCCCCCCo..',
  '..oCCCCCCCCCco..',
  '..obbbbbbbbbbco.',
  '..obBgbbbbBgbco.',
  '..obggbbbbggbco.',
  '..oHHssssssHHoc.',
  '..oHSoSSSSoSHoc.',
  '..osSoSSSSoSsoo.',
  '...osSSSSSSso...',
];
// Torso with the arms removed and the coat widened to fill the shoulders:
// scarf band, satchel strap crossing to the right hip, dark teal hem.
const HOLD_TORSO = [
  '..oTTRRRRRRteo..',
  '..otRddtttteeo..',
  '..otRttddtteeo..',
  '..ottttttddeeo..',
  '..otteetteobbo..',
  '..oteeeeeeobdo..',
  '...oeeeeeeeeo...',
];
// Idle legs, matching the walk sheet's DU_IDLE after its boot-cuff pass.
const HOLD_LEGS = [
  '....oggooggo....',
  '....oggooggo....',
  '....obboobbo....',
  '...obkkookkbo...',
  '...okkkookkko...',
  '....ooo..ooo....',
];
// Viewer-left arm, raised in a V. 16 wide x 29 tall, drawn at (x-9, y-13);
// the mirror goes at (x+10, y-13) — see POSE_LAYOUT, which is now the ONLY
// place those offsets are written down. The previous pass declared armX = -10
// in POSE_LAYOUT and then drew at x-6 and x+11, four pixels apart on one side
// and six on the other, which is how a geometry designed for a three-pixel
// channel shipped with the arm welded to the skull on ten rows out of ten.
//
// THE ONE RULE THIS GEOMETRY EXISTS TO SATISFY: on EVERY row where the head is
// on screen (y+1 .. y+11) plus the shoulder row under it, there must be
// BACKGROUND between the arm's outline and the head's outline — three pixels
// or more, both sides. Measured, per row, on the real capture; the previous
// pass came back as one closed ovoid with the head sitting in a hole inside
// it, which reads as a hood or a horseshoe collar and not as two raised arms.
// ALttP's raise reads instantly because the arms are separate OAM tiles with
// clear air either side of the head for the head's whole height. So the inner
// edge of the arm is PINNED at d-2 for the length of the skull, and everything
// else is built outward from there.
//
// The head's own extremes are d2 on the left and d14 on the right (the goggle
// strap pushes the right side out one), so an inner edge at d-2 / d18 puts
// exactly three background pixels either side. That is why the mirror is not
// drawn at the arithmetic mirror of -9: see POSE_LAYOUT.
//
// Sprite column j maps to screen column x-9+j; write d = j-9 for the offset
// from the body's left edge. Row i maps to screen row y-13+i.
//
//   FIST    i0-5    d 0..5, light SKIN with two dark finger creases. The item
//                   occupies y-24..y-9, so i2-i4 sit ON its darkest three rows:
//                   fingers closed over the treasure. Grip, not levitation.
//   CUFF    i6-7    brass wristband — the arm's one warm accent, and the value
//                   break that stops the hand melting into the sleeve.
//   FOREARM i8-i14  drops OUT one column per row, inner d4 -> d0: a 45-degree
//                   run from the hands above the head down to the elbows
//                   outboard of the shoulders. This is the V.
//   ELBOW   i15-17  outer edge apex at d-8, level with the top of the cap.
//                   Above it the outer edge moves left one px per row; below
//                   it (i18 on) it moves back right. The SIGN of the outer
//                   edge's slope flips here — that is the break in the outline
//                   an elbow makes, and it is what stops the arm reading as
//                   one smooth convex curve from fist to hip.
//   UPPER   i18-26  narrows 6px -> 5px, inner edge pinned at d-2, running down
//                   beside the head with a three-px channel of sky between it
//                   and the skull.
//   SHOULDER i27-28 flares in to d3 and merges into the coat's top rows with
//                   no outline on the inner edge, so arm and torso read as one
//                   body rather than two stuck-together sprites. It starts at
//                   y+14, BELOW the twelve rows the channel is measured over.
const ARM_UP_L = [
  '..........oSSo..',   //  0  knuckles, over the item's collar
  '.........oSSSSo.',   //  1  fist
  '.........osssSo.',   //  2  finger crease   — on the item's dark row 13
  '.........oSSSSo.',   //  3                  — on the item's dark row 14
  '.........osssSo.',   //  4  finger crease   — on the item's dark row 15
  '.........oSSSSo.',   //  5  heel of the hand, just clear of the brass
  '.........oBBBBo.',   //  6  brass wrist cuff, lit
  '........obbbbo..',   //  7  brass wrist cuff, shade
  '.......oTtteeo..',   //  8  forearm, lit down the outer edge
  '.......oTtteeo..',   //  9
  '......oTtteeo...',   // 10
  '.....oTtteeo....',   // 11
  '....oTtteeo.....',   // 12
  '...oTtteeo......',   // 13
  '..oTttteeo......',   // 14  first head row — 4px of sky to the cap
  '.oTttteeo.......',   // 15  ---- elbow: outer apex at d-8 ----
  '.oTtteeo........',   // 16
  '.oTtteeo........',   // 17
  '..oTtteo........',   // 18  outer edge turns back in — the outline breaks
  '..oTtteo........',   // 19
  '...oTteo........',   // 20  upper arm, inner edge pinned at d-2
  '...oTteo........',   // 21
  '...oTteo........',   // 22
  '...oTteo........',   // 23
  '...otteo........',   // 24  light falls off toward the shoulder
  '...otteo........',   // 25
  '...otteo........',   // 26
  '...oTttteee.....',   // 27  shoulder, merging into the coat
  '....oTtteeeee...',   // 28
];

// Where the pieces of the pose go, relative to the player's origin (x, y).
// THIS IS THE ONLY COPY OF THESE NUMBERS — _drawPose reads them, so the export
// and the render cannot drift apart again.
//
// armRX is +10 and not +9 (the exact mirror of armX = -9 about the body's
// centre line at x+7.5) because the head itself is not symmetric about that
// line: the goggle strap pushes its right edge out to d14 against d2 on the
// left. Offsetting the mirrored arm by one pixel makes the BACKGROUND CHANNEL
// symmetric — three px either side of the skull — which is the thing the eye
// actually reads, at the cost of one px of arm placement nobody can see.
export const POSE_LAYOUT = { armX: -9, armY: -13, armRX: 10, itemDY: -24 };
export const POSE_ARM = { w: 16, h: 29 };

let poseCache = null;
export function makeHoldPose() {
  if (poseCache) return poseCache;
  const body = document.createElement('canvas');
  body.width = 16; body.height = 24;
  const bx = body.getContext('2d');
  bx.drawImage(makeSprite(HOLD_LEGS, WREN_PAL), 0, 18);
  bx.drawImage(makeSprite(HOLD_HEAD.concat(HOLD_TORSO), WREN_PAL), 0, 1);
  const armL = makeSprite(ARM_UP_L, WREN_PAL);
  poseCache = { body, armL, armR: flipH(armL) };
  return poseCache;
}

// --------------------------------------------------------------------------
// The radiating flash behind a raised item. ALttP paints a starburst of light
// under the held treasure — sixteen spokes, alternately long and short, that
// trade places every eight frames so the star seems to turn without any of it
// actually rotating (a rotating sprite is not something the PPU does for free).
// Solid pixels, three values, no alpha and no gradient: the ramp is by radius,
// white at the hub through pale gold to brass at the tips.
// --------------------------------------------------------------------------
// Two values, not three: a white core and a brass tip. A third mid-tone the
// same cream as the item's own highlight turned the rays into visual noise
// exactly where they crossed the treasure.
const BURST_RAMP = ['#f8f8f8', '#f8c840'];
const CORE_PALE = '#f8f0c0';
const CORE_R = 13;          // outer edge of the pale corona behind the item
const RAY_R0 = CORE_R;      // rays start where the corona ends
function drawBurst(ctx, cx, cy, t, hole = 9) {
  const swap = (t >> 3) & 1;
  // THE CORE FIRST. A previous pass drew sixteen spokes starting at r=11 with
  // nothing behind the item, so the hub was entirely hidden by the treasure and
  // what was left on screen was 125 white splinters lying across the fence
  // rails — bright litter, not light. ALttP's item burst is a dense radial star
  // with a visible bright core, so there is now a solid pale CORONA behind the
  // item: white to r=11, cream to r=13, and the rays leave from its edge
  // instead of from empty air five pixels off the brass.
  //
  // It is an ANNULUS, r=9..13, not a filled disc. Two rejected passes: a filled
  // white disc put a hot core immediately behind a sprite whose own highlights
  // are #fdf3c8 and the treasure dissolved into its own halo; punching the
  // item's 16x16 square out of that disc fixed the item but left a rectangular
  // frame of light around it, which reads as a picture frame and not as glare.
  // A ring is round from every angle, its inner edge is hidden behind the item
  // exactly where the item is, and the transparent holes in the sprite still
  // show world through — so the treasure stays crisp inside a hard round glow.
  for (let dy = -CORE_R; dy <= CORE_R; dy++) {
    const half = Math.floor(Math.sqrt(CORE_R * CORE_R - dy * dy));
    // Half-width of the ring's hole on this row; -1 when the row misses it.
    const inner = Math.abs(dy) < hole
      ? Math.floor(Math.sqrt(hole * hole - dy * dy)) : -1;
    for (let dx = -half; dx <= half; dx++) {
      if (inner >= 0 && dx >= -inner && dx <= inner) { dx = inner; continue; }
      const r2 = dx * dx + dy * dy;
      ctx.fillStyle = r2 < 132 ? BURST_RAMP[0] : CORE_PALE;
      ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
  for (let i = 0; i < 16; i++) {
    // Offset by half a step so no spoke is exactly vertical or horizontal: an
    // upright spoke over an upright item reads as a chimney, not as light.
    const a = (i + 0.5) * Math.PI / 8;
    const ca = Math.cos(a), sa = Math.sin(a);
    const len = ((i & 1) === swap) ? 26 : 19;
    for (let r = RAY_R0; r <= len; r++) {
      const k = (r - RAY_R0) / (len - RAY_R0);
      ctx.fillStyle = k < 0.5 ? BURST_RAMP[0] : BURST_RAMP[1];
      const px = cx + ca * r, py = cy + sa * r;
      // Spokes are THREE pixels across where they leave the core, two in the
      // middle and one at the tip, so a ray reads as a wedge of light coming
      // off the disc. One-pixel spokes all the way out read as spider legs.
      const wide = k < 0.45 ? [-1, 0, 1] : k < 0.75 ? [0, 1] : [0];
      for (const o of wide) {
        ctx.fillRect(Math.round(px - sa * o), Math.round(py + ca * o), 1, 1);
      }
    }
  }
}

// --------------------------------------------------------------------------
// Sparkle: ALttP's four-point item twinkle. A plus of 1px arms around a 2x2
// core, no alpha — it pops open and shuts again over 8-13 frames. Fast: the
// whole point is a busy glitter on the item, not three lazy stars.
// --------------------------------------------------------------------------
const SPARK_COLORS = ['#f8f8f8', '#f8f0c0', '#f8d858'];
function drawSpark(ctx, x, y, size, color) {
  if (size <= 0) return;
  ctx.fillStyle = color;
  const r = size;
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  if (size >= 2) {
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 1, 1);
  }
}

// --------------------------------------------------------------------------
// THE MESSAGE WINDOW IS NOT DEFINED HERE ANY MORE.
//
// It used to be: a 208x57 square-cornered box in the HUD's monospace ALL-CAPS
// face, while game/dialog.js drew conversation in a 168x42 rounded window in a
// variable-width mixed-case face — and the player met both, 1.8 seconds apart,
// when Marla stops talking and the item is announced. Two message windows is a
// cartridge-level defect, not a per-file preference, so this file no longer has
// an opinion: `_drawTextBox` below is a thin seam that dialog.js overwrites via
// its adoptMessageWindow(), and every announcement in the chapter is painted by
// dialog.js's drawMessage() at dialog.js's geometry in dialog.js's font.
//
// WHY A SEAM AND NOT A PLAIN `import { drawMessage } from './dialog.js'`:
// dialog.js imports THIS module (it needs the class to patch), so a static
// import back would close a cycle, and whichever of the two an entry point
// happened to name first would hit the other's temporal dead zone and throw.
// The seam has no such ordering problem, and the lazy import below makes it
// self-healing: if some scene ever reaches an item-get without dialog.js in its
// module graph, the first frame that wants a window pulls dialog.js in, which
// installs itself, and the window is there from the next frame on.
// --------------------------------------------------------------------------
let dialogPending = false;
function ensureDialog() {
  if (dialogPending) return;
  dialogPending = true;
  import('./dialog.js').catch(() => { /* no window is better than a crash */ });
}

// --------------------------------------------------------------------------
export class Transitions {
  /**
   * @param {object} opts
   * @param {() => number} opts.rand  deterministic RNG (engine.rand)
   * @param {(name: string) => void} opts.onSfx  sound hook; also fires
   *        window.__gwSfx(name) so the audio piece can plug in globally.
   */
  constructor(opts = {}) {
    this.rand = opts.rand || Math.random;
    this._sfx = opts.onSfx || null;
    // Optional per-actor post-filter, e.g. skystate.tintFrame — lets the
    // player and the item pose sit under the same ambient light as the world
    // during scrolls and the item-get, which the scene composites itself.
    this.filter = opts.filter || null;
    // (x, y) -> boolean: is this world pixel standable ground? Ground-lurch
    // dust is only spawned where this says yes, so grit never puffs off the
    // cliff face or out of the open sky column. Scenes that never lurch
    // outdoors can leave it null. Overridable per call: lurch({ walkable }).
    this.walkable = opts.walkable || null;
    this.brightness = BRIGHT_MAX;   // 0..15, INIDISP
    this.flash = 0;                 // 0..15, additive white
    this.shakeX = 0; this.shakeY = 0;
    this.posing = false;            // item-get owns the player sprite
    this.dust = [];
    this.box = null;                // {lines, onDone, auto}
    this._fx = null;                // current exclusive effect
    this._lurch = null;
    this._buf = document.createElement('canvas');
    this._buf.width = WIDTH; this._buf.height = HEIGHT;
    this._bctx = this._buf.getContext('2d', { alpha: false });
    this._bctx.imageSmoothingEnabled = false;
    this._snapA = this._mkCanvas();
    this._snapB = this._mkCanvas();
  }

  _mkCanvas() {
    const c = document.createElement('canvas');
    c.width = WIDTH; c.height = HEIGHT;
    c.getContext('2d').imageSmoothingEnabled = false;
    return c;
  }

  sfx(name) {
    if (this._sfx) this._sfx(name);
    if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  }

  /** Any exclusive effect running (scroll / fade / stairs / item / text). */
  get busy() { return !!this._fx || !!this.box; }
  /** The scene must not run gameplay logic this frame. */
  get frozen() { return !!this._fx || !!this.box; }
  /** Screen shake offset for scenes that composite themselves. */
  get shake() { return { x: this.shakeX, y: this.shakeY }; }

  // =========================================================== screen scroll

  /**
   * ALttP overworld screen change: the camera slides one full screen while
   * the player walks in from the opposite edge.
   *
   * `from` / `to` may be canvases OR draw functions. Pass FUNCTIONS if you
   * can: they are re-run every frame of the slide, so steam plumes, flowers
   * and cloud parallax keep animating across the join. A canvas is a frozen
   * snapshot and a prominent animated element visibly stops dead for half a
   * second and then snaps back.
   *
   * @param {'left'|'right'|'up'|'down'} dir
   * @param {object} player  Player instance; its x/y are advanced across the
   *        seam and rebased into the new screen's coordinates on completion.
   */
  scroll({ dir, from, to, player, onDone, frames, walkIn }) {
    if (this._fx) return false;
    if (!['left', 'right', 'up', 'down'].includes(dir)) return false;
    const horiz = dir === 'left' || dir === 'right';
    const span = horiz ? WIDTH : HEIGHT;
    const dur = frames ?? (horiz ? 32 : 28);   // 8 px/frame on both axes
    this._blit(this._snapA, from);
    this._blit(this._snapB, to);
    const sx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const sy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    this._fx = {
      kind: 'scroll', t: 0, dur, span, sx, sy, player, onDone,
      // He walks in at WALK_SPEED — his own speed — for the whole slide, not
      // at some fraction of it chosen to land on a tidy pixel count. 32 frames
      // x 1.5 = 48px of walk under 256px of camera.
      walkIn: walkIn ?? WALK_SPEED * dur, walked: 0,
      px0: player ? player.x : 0, py0: player ? player.y : 0,
      fromFn: typeof from === 'function' ? from : null,
      toFn: typeof to === 'function' ? to : null,
    };
    if (player) { player.moving = true; player.dir = dir; }
    this.sfx('screen-scroll');
    return true;
  }

  _blit(dst, src) {
    const c = dst.getContext('2d');
    c.clearRect(0, 0, WIDTH, HEIGHT);
    if (typeof src === 'function') src(c);
    else if (src) c.drawImage(src, 0, 0);
  }

  // ============================================================== door fades

  /**
   * Cave / door: fade to black, swap the room, fade back in.
   *
   * Pass `player` + `dir` and he keeps walking INTO the doorway for the whole
   * fade-out — 16px by default, a full tile, so the mouth has taken him
   * before the screen is black. A door transition where the hero stands still
   * outside the door while the lights go down reads as a cut, not as going
   * in. (The scene still has to paint the doorway's upper half over him.)
   *
   * @param {Function} onSwap called once at full black — change the room here.
   */
  fade({ out = 8, hold = 3, into = 8, onSwap, onDone, player, dir, dist = 16 } = {}) {
    if (this._fx) return false;
    this._fx = {
      kind: 'fade', t: 0, out, hold, into, onSwap, onDone, swapped: false,
      player, dir, dist, walked: 0,
    };
    if (player && dir) { player.dir = dir; player.moving = true; }
    this.sfx('door');
    return true;
  }

  /**
   * ALttP's staircase variant: the player keeps walking into the stairs while
   * the screen dims, then walks off them as it comes back up. Requires the
   * scene to leave the player alone (tr.frozen) for the duration.
   *
   * WALK DISTANCE IS THE WHOLE POINT: 16px in, a full tile, so the stairwell
   * (or the hatch, or the cave mouth) has swallowed him before the screen
   * goes black. Half a tile leaves him standing at the foot of the stairs in
   * plain sight while the lights go out, which reads as a scene change rather
   * than as entering anything. The scene must also draw the entrance's upper
   * half OVER the player, or he walks in front of the hole he is entering.
   *
   * @param {'up'|'down'|'left'|'right'} dir  direction Wren walks the stairs
   */
  stairs({ dir = 'up', player, onSwap, onDone, exitDir, dist = 16 } = {}) {
    if (this._fx) return false;
    this._fx = {
      kind: 'stairs', t: 0, dir, exitDir: exitDir || dir, player, onSwap, onDone,
      inF: 11, out: 8, hold: 4, into: 8, outF: 11, dist, swapped: false,
      walkedIn: 0, walkedOut: 0,
    };
    if (player) { player.dir = dir; player.moving = true; }
    this.sfx('stairs');
    return true;
  }

  // ================================================================== lurch

  /**
   * THE LURCH — the isle drops a notch. A JOLT, not a wobble.
   *
   * Everything about this is deliberately blunt. One axis: the island drops,
   * so the screen moves vertically and only vertically. Cross-fading a second
   * axis on a different period draws an ellipse, which is the signature of a
   * modern camera-shake and reads instantly as not-SNES. Eight frames: peak
   * on frame 0, one pixel off the amplitude every two frames, gone by frame 8
   * (4,4,-3,-3,2,2,-1,-1). And the exposed edge is filled by repeating the
   * frame's own edge row, not with black — a BG scroll nudge on real hardware
   * shows more of the tilemap, never a black bar pumping around the screen.
   *
   * @param {number} power   peak offset in px (SNES shakes are 2-4)
   * @param {number} frames  shake duration; clamped to 6-10, because longer
   *        than that stops being a jolt no matter what the caller wants.
   * @param {'ceiling'|'ground'|'none'} dust  the grit knocked loose; its
   *        lifetime is independent and outlasts the shake.
   */
  lurch({ power = 4, frames = 8, dust = 'ceiling', count = 64, walkable } = {}) {
    const jolt = Math.max(6, Math.min(10, Math.round(frames)));
    this._lurch = { t: 0, power: Math.max(2, Math.min(5, power)), frames: jolt };
    if (dust !== 'none') this._spawnDust(dust, count, walkable || this.walkable);
    this.sfx('lurch');
  }

  /**
   * The grit a lurch knocks loose.
   *
   * SIZE AND COUNT ARE THE POINT. A previous pass drifted 24 single pixels
   * upward at 0.2 px/frame and the whole effect measured under 300 changed
   * pixels a frame — below anything you would notice next to flowers swaying.
   * ALttP quake debris is chunky: 2x2 crumbs and short 1x3 / 3x1 streaks, tens
   * of them, moving fast enough to blur. So:
   *
   *   ceiling  falls, accelerating, 2x2 crumbs and 1x3 vertical streaks.
   *   ground   PUFFS: each crumb is thrown up and outward at 1-2 px/frame and
   *            pulled back down by gravity, so it draws a short arc and lands.
   *            That is what "dust kicked off the deck" looks like; a column of
   *            single pixels rising at a fifth of a pixel a frame is not.
   *
   * AND GROUND DUST NEEDS GROUND UNDER IT. The previous pass picked x anywhere
   * in [0,256) and y anywhere in [34,162) with no reference to the tilemap, so
   * on a rim screen 52% of the crumbs measured off the walkable deck: warm tan
   * grit puffing off the cliff face, the open sky column and the cloud sea, in
   * mid-air over a three-thousand-foot drop. `walkable(x, y)` — supplied by the
   * scene, which is the only thing that knows where the deck is — rejects those
   * spawn points. Ceiling grit is exempt: it falls from a roof, and the roof is
   * over the whole room.
   */
  _spawnDust(kind, count, walkable) {
    for (let i = 0; i < count; i++) {
      const big = this.rand();
      if (kind === 'ceiling') {
        // Spawned across a tall band that starts ABOVE the screen, so the
        // grit keeps arriving for a second or so instead of all at once.
        this.dust.push({
          x: this.rand() * WIDTH,
          y: -44 + this.rand() * 80,
          vx: (this.rand() - 0.5) * 0.3,
          vy: 0.7 + this.rand() * 1.3,
          g: 0.035,
          sway: this.rand() * 6.283, swayAmp: 0.16,
          life: 60 + Math.floor(this.rand() * 60), max: 120,
          w: big < 0.34 ? 2 : 1, h: big < 0.34 ? 2 : big < 0.66 ? 3 : 1,
          pal: 0,
        });
      } else {
        // A puff: thrown up and out, gravity wins after ~10 frames.
        const spd = 1.1 + this.rand() * 1.0;
        const ang = -Math.PI / 2 + (this.rand() - 0.5) * 1.9;
        // Rejection-sample a spawn point that is actually ON the deck. Eight
        // tries, then the crumb is dropped rather than placed over the sky —
        // a thinner cloud is a cheaper mistake than dust falling off a cliff.
        let px = 0, py = 0, ok = !walkable;
        for (let n = 0; n < 8 && !ok; n++) {
          px = this.rand() * WIDTH;
          py = 34 + this.rand() * (HEIGHT - 96);
          ok = walkable(px, py);
        }
        if (!ok) continue;
        if (!walkable) { px = this.rand() * WIDTH; py = 34 + this.rand() * (HEIGHT - 96); }
        this.dust.push({
          x: px,
          y: py,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          g: 0.13,
          sway: 0, swayAmp: 0,
          life: 22 + Math.floor(this.rand() * 16), max: 38,
          w: big < 0.4 ? 2 : big < 0.7 ? 3 : 1, h: big < 0.4 ? 2 : 1,
          pal: 1,
        });
      }
    }
  }

  // =============================================================== item get

  /**
   * ALttP's item hold: white flash, Wren raises the item overhead with both
   * arms while sparkles pop around it, a fanfare fires, and a text box
   * announces it. Advanced with A (or automatically if `auto` frames given).
   *
   * @param {HTMLCanvasElement} img  16x16 item sprite (optional)
   * @param {string[]} lines         text box copy
   */
  getItem({ img, lines = [], player, onDone, auto = 0 } = {}) {
    if (this._fx) return false;
    this._fx = { kind: 'item', t: 0, img, lines, player, onDone, auto, sparks: [], boxed: false };
    this.posing = true;
    this.flash = 0;
    this.sfx('item-fanfare');
    return true;
  }

  /** Standalone text box (no item). Ignored while another effect owns the
   *  screen — a scroll or a fade is never a good time to start talking. */
  message(lines, { onDone, auto = 0 } = {}) {
    if (this._fx) return false;
    this.box = { lines, onDone, auto, t: 0 };
    return true;
  }

  // ================================================================= update

  update(input, engine) {
    // --- dust always ages, lurch or not
    for (const d of this.dust) {
      d.sway += 0.24;
      d.x += d.vx + Math.sin(d.sway) * d.swayAmp;
      d.y += d.vy;
      d.vy += d.g;                // ceiling grit accelerates; a puff arcs back
      d.life--;
    }
    if (this.dust.length) this.dust = this.dust.filter(d => d.life > 0);

    // --- lurch (independent of the exclusive effects: the isle can drop
    //     mid-conversation). Single axis, 2-frame sign period, linear decay.
    if (this._lurch) {
      const L = this._lurch;
      const amp = Math.max(0, Math.round(L.power * (1 - L.t / L.frames)));
      this.shakeY = (Math.floor(L.t / 2) % 2) ? -amp : amp;
      this.shakeX = 0;
      if (++L.t >= L.frames) { this._lurch = null; this.shakeX = this.shakeY = 0; }
    }

    // --- text box (standalone)
    if (!this._fx && this.box) {
      this.box.t++;
      const done = (input && input.hit && input.hit('a') && this.box.t > 6) ||
        (this.box.auto && this.box.t >= this.box.auto);
      if (done) { const cb = this.box.onDone; this.box = null; if (cb) cb(); }
      return;
    }

    const f = this._fx;
    if (!f) return;
    if (f.kind === 'scroll') this._updScroll(f);
    else if (f.kind === 'fade') this._updFade(f);
    else if (f.kind === 'stairs') this._updStairs(f);
    else if (f.kind === 'item') this._updItem(f, input);
  }

  _finish(f) {
    this._fx = null;
    if (f.onDone) f.onDone();
  }

  /**
   * Move the player one frame of a scripted walk and advance the walk cycle by
   * EXACTLY the distance travelled.
   *
   * player.js advances one walk frame per STRIDE_PX of `animDist`, so if a
   * transition moves the body at one rate and bumps animDist at another, the
   * legs and the ground disagree and he moonwalks. Every scripted walk in this
   * file therefore steps at WALK_SPEED — the same 1.5 px/frame the player gets
   * under his own control — and feeds that same number into animDist. The
   * body-to-leg ratio is 1.000 in a scroll, a fade and a staircase alike.
   *
   * @param {number} remain  px still owed; the last step is clamped to it so a
   *        16px walk-in lands on exactly 16px.
   * @returns {number} px actually moved this frame
   */
  _step(p, dir, remain) {
    if (!p) return 0;
    const amt = Math.min(WALK_SPEED, Math.max(0, remain));
    if (amt <= 0) { p.moving = false; return 0; }
    p.x += (dir === 'left' ? -1 : dir === 'right' ? 1 : 0) * amt;
    p.y += (dir === 'up' ? -1 : dir === 'down' ? 1 : 0) * amt;
    p.moving = true;
    p.animDist += amt;          // 1:1 with the body — no foot slide
    return amt;
  }

  _updScroll(f) {
    f.t++;
    // LINEAR. A BG scroll register gets the same increment every frame; any
    // ease is a modern camera move and shows up as a 60% velocity swing
    // between the ends and the middle of the slide.
    f.off = f.span * Math.min(1, f.t / f.dur);
    if (f.player) {
      const dir = f.sx < 0 ? 'left' : f.sx > 0 ? 'right' : f.sy < 0 ? 'up' : 'down';
      f.walked += this._step(f.player, dir, f.walkIn - f.walked);
    }
    if (f.t >= f.dur) {
      if (f.player) {
        // Rebase into the new screen's coordinates.
        f.player.x -= f.sx * WIDTH;
        f.player.y -= f.sy * HEIGHT;
        f.player.moving = false;
        f.player.animDist = 0;
      }
      this._finish(f);
    }
  }

  _updFade(f) {
    f.t++;
    const { out, hold, into } = f;
    // The walk-in runs at WALK_SPEED across the fade AND the black hold: 16px
    // at 1.5 px/frame is 11 frames, which is exactly out(8) + hold(3). Forcing
    // the whole tile into the 8 visible frames would mean 2.0 px/frame — a
    // third faster than he can walk — and the legs would visibly under-run the
    // body. The two frames that spill past the fade happen at brightness 0, so
    // they cost nothing on screen and keep the cadence honest.
    // The room swap therefore moves to the LAST black frame instead of the
    // first; all three are identically black, so nothing changes on screen.
    if (f.t <= out) {
      this.brightness = Math.round(BRIGHT_MAX * (1 - f.t / out));
      if (f.player && f.dir) f.walked += this._step(f.player, f.dir, f.dist - f.walked);
    } else if (f.t <= out + hold) {
      this.brightness = 0;
      if (f.player && f.dir && f.t < out + hold) {
        f.walked += this._step(f.player, f.dir, f.dist - f.walked);
      }
      if (f.t >= out + hold) {
        if (f.player) { f.player.moving = false; f.player.animDist = 0; }
        if (!f.swapped) { f.swapped = true; if (f.onSwap) f.onSwap(); }
      }
    } else if (f.t <= out + hold + into) {
      this.brightness = Math.round(BRIGHT_MAX * (f.t - out - hold) / into);
    } else {
      this.brightness = BRIGHT_MAX;
      this._finish(f);
    }
  }

  _updStairs(f) {
    f.t++;
    const { inF, out, hold, into, outF } = f;
    const p = f.player;
    // inF/outF are 11 frames, not 12, because 16px at WALK_SPEED is 10.67 —
    // eleven frames of 1.5 covers the tile with the last step clamped, and
    // animDist tracks the body exactly (see _step).
    if (f.t <= inF) {
      f.walkedIn += this._step(p, f.dir, f.dist - f.walkedIn);
      const s = inF - out;                       // dim over the last `out`
      this.brightness = f.t <= s ? BRIGHT_MAX
        : Math.round(BRIGHT_MAX * (1 - (f.t - s) / out));
    } else if (f.t <= inF + hold) {
      this.brightness = 0;
      if (p) { p.moving = false; p.animDist = 0; }
      if (!f.swapped) { f.swapped = true; if (f.onSwap) f.onSwap(); }
    } else if (f.t <= inF + hold + outF) {
      const u = f.t - inF - hold;
      f.walkedOut += this._step(p, f.exitDir, f.dist - f.walkedOut);
      this.brightness = u <= into ? Math.round(BRIGHT_MAX * u / into) : BRIGHT_MAX;
    } else {
      this.brightness = BRIGHT_MAX;
      if (p) { p.moving = false; p.animDist = 0; }
      this._finish(f);
    }
  }

  _updItem(f, input) {
    f.t++;
    // 6-frame additive white flash: 3 up, 3 down (colour-math fixed colour).
    if (f.t <= 3) this.flash = Math.round(BRIGHT_MAX * f.t / 3);
    else if (f.t <= 6) this.flash = Math.round(BRIGHT_MAX * (6 - f.t) / 3);
    else this.flash = 0;

    // Sparkles pop ON the item — the offsets below are measured from the
    // item's own centre, so the cloud sits over the brass instead of hovering
    // in the air above it. Fast and plural: a new one every other frame, up
    // to ten alive, each open-and-shut inside 8-13 frames, so four or five
    // are twinkling at any moment and none of them lingers.
    if (f.t % 3 === 0 && f.sparks.length < 6) {
      f.sparks.push({
        // +/-9 and +/-8 from the item's centre: inside its own 16x16 footprint
        // and the halo ring, so the glitter is ON the brass.
        x: (this.rand() - 0.5) * 18,
        y: (this.rand() - 0.5) * 16,
        t: 0, life: 8 + Math.floor(this.rand() * 6),
        c: SPARK_COLORS[Math.floor(this.rand() * SPARK_COLORS.length)],
      });
    }
    for (const s of f.sparks) s.t++;
    f.sparks = f.sparks.filter(s => s.t < s.life);

    if (f.t === 12 && f.lines.length) f.boxed = true;
    // The box (or, with no copy, the raised pose) holds until A — or until
    // `auto` frames, which is what the capture tool drives.
    const held = f.boxed ? f.t - 12 : f.t;
    const pressed = input && input.hit && input.hit('a') && held > 8;
    const timedOut = f.auto ? held >= f.auto : (!f.lines.length && held >= 120);
    if (pressed || timedOut) f.closing = f.closing ?? f.t;
    if (f.closing && f.t >= f.closing + 10) {
      this.posing = false;
      this._finish(f);
    }
  }

  // ================================================================= render

  /**
   * Composite the frame. `drawWorld(ctx)` must paint the live scene at 0,0.
   * The transition decides whether the world is drawn at all (a scroll paints
   * the two screens either side of the seam), applies the brightness/flash
   * LUT, offsets for the shake, and puts the text box on top untouched.
   */
  render(ctx, drawWorld, opts = {}) {
    const f = this._fx;
    const shaking = this.shakeX !== 0 || this.shakeY !== 0;
    const dimming = this.brightness !== BRIGHT_MAX || this.flash > 0;
    const b = this._bctx;

    // --- 1. paint the world into the work buffer
    if (f && f.kind === 'scroll') {
      // Repaint both screens every frame when the scene gave us draw
      // functions: everything on both sides of the seam keeps animating
      // through the slide, which is what stops the join reading as two
      // photographs sliding past each other.
      if (f.fromFn) this._blit(this._snapA, f.fromFn);
      if (f.toFn) this._blit(this._snapB, f.toFn);
      const off = Math.round(f.off || 0);
      b.drawImage(this._snapA, -f.sx * off, -f.sy * off);
      b.drawImage(this._snapB, f.sx * (WIDTH - off), f.sy * (HEIGHT - off));
      if (f.player) {
        b.save();
        b.translate(-f.sx * off, -f.sy * off);
        this._actor(b, Math.round(f.player.x) - 12, Math.round(f.player.y) - 8,
          40, 44, (c) => f.player.draw(c));
        b.restore();
      }
    } else {
      drawWorld(b);
    }

    // --- 2. world-space overlays: dust, then the item pose (both get lit by
    //        the flash, like real sprites would)
    if (this.dust.length) this._drawDust(b);
    if (this.posing && f && f.kind === 'item') this._drawPose(b, f);

    // --- 2b. status bar / UI that must NOT scroll with the world but MUST
    //         dim with it (ALttP's HUD lives on its own BG layer: it holds
    //         still through a screen change and fades with everything else).
    if (opts.ui) opts.ui(b);

    // --- 3. brightness / flash LUT over the whole frame
    if (dimming) {
      const img = b.getImageData(0, 0, WIDTH, HEIGHT);
      const t = channelLut(this.brightness, this.flash);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = t[d[i]]; d[i + 1] = t[d[i + 1]]; d[i + 2] = t[d[i + 2]];
      }
      b.putImageData(img, 0, 0);
    }

    // --- 4. blit, offset by the shake. The strip the shake exposes is filled
    //        by repeating the frame's own edge row/column — a scroll-register
    //        nudge reveals more tilemap, it does not reveal a black bar.
    if (shaking) {
      const dx = this.shakeX, dy = this.shakeY;
      ctx.drawImage(this._buf, dx, dy);
      if (dy > 0) ctx.drawImage(this._buf, 0, 0, WIDTH, 1, dx, 0, WIDTH, dy);
      else if (dy < 0) ctx.drawImage(this._buf, 0, HEIGHT - 1, WIDTH, 1, dx, HEIGHT + dy, WIDTH, -dy);
      if (dx > 0) ctx.drawImage(this._buf, 0, 0, 1, HEIGHT, 0, dy, dx, HEIGHT);
      else if (dx < 0) ctx.drawImage(this._buf, WIDTH - 1, 0, 1, HEIGHT, WIDTH + dx, dy, -dx, HEIGHT);
    } else {
      ctx.drawImage(this._buf, 0, 0);
    }

    // --- 5. UI: text boxes ride above the fade, as ALttP's do
    if (f && f.kind === 'item' && f.boxed && !f.closing) this._drawTextBox(ctx, f.lines, f.t);
    else if (this.box) this._drawTextBox(ctx, this.box.lines, this.box.t);
  }

  // Two 3-step ramps, no alpha: grey mill grit indoors, warm deck dust out.
  // Each crumb steps DOWN the ramp as it ages, so a cloud is never one flat
  // colour — the same trick the tile art uses for tufts.
  static DUST_RAMP = [
    ['#d8d0b8', '#9a9078', '#5e5a48'],   // 0 ceiling: pale mortar grit
    ['#c8a878', '#96774c', '#5e4a30'],   // 1 ground: warm earth
  ];

  _drawDust(ctx) {
    for (const d of this.dust) {
      const x = Math.round(d.x), y = Math.round(d.y);
      const k = d.life / d.max;
      const ramp = Transitions.DUST_RAMP[d.pal];
      ctx.fillStyle = k > 0.62 ? ramp[0] : k > 0.3 ? ramp[1] : ramp[2];
      ctx.fillRect(x, y, d.w, d.h);
    }
  }

  // Render an actor through the optional ambient filter. `fn` draws in world
  // coordinates; the scratch canvas is a window onto that space.
  _actor(ctx, ox, oy, w, h, fn) {
    if (!this.filter) { fn(ctx); return; }
    if (!this._scratch) this._scratch = document.createElement('canvas');
    const s = this._scratch;
    if (s.width !== w || s.height !== h) { s.width = w; s.height = h; }
    const c = s.getContext('2d');
    c.clearRect(0, 0, w, h);
    c.save(); c.translate(-ox, -oy);
    fn(c);
    c.restore();
    ctx.drawImage(this.filter(s), ox, oy);
  }

  _drawPose(ctx, f) {
    const p = f.player;
    if (!p) return;
    const pose = makeHoldPose();
    const x = Math.round(p.x), y = Math.round(p.y);
    // iy = y-24 puts the item's bottom row at y-9 and the cap's top row is at
    // y+1: NINE rows of air between the treasure and his head, crossed only by
    // the raised arms. The old y-18 left three, which is why it read as a box
    // balanced on his scalp.
    const L = POSE_LAYOUT;
    const ix = x, iy = y + L.itemDY;
    // The burst and the sparkles are drawn OUTSIDE `_actor`, i.e. outside the
    // ambient tint. Wren and the brass are lit by whatever light the isle has
    // left; the flash is a light SOURCE, and grading a light source down to
    // dusk is how you end up with a treasure moment you cannot see. On the
    // hardware this is the same distinction as sprite palette vs colour math.
    drawBurst(ctx, ix + 8, iy + 8, f.t);
    this._actor(ctx, x - 28, y - 48, 72, 84, (c) => {
      c.drawImage(p.sprites.shadow, x + 2, y + 20);
      c.drawImage(pose.body, x, y);
      if (f.img) c.drawImage(f.img, ix + 8 - f.img.width / 2, iy);
      // Arms LAST: the fists close over the item's lower corners. Offsets come
      // from POSE_LAYOUT, never from literals here — that split is what let the
      // declared three-pixel channel ship as a zero-pixel one.
      c.drawImage(pose.armL, x + L.armX, y + L.armY);
      c.drawImage(pose.armR, x + L.armRX, y + L.armY);
    });
    for (const s of f.sparks) {
      // 1 -> 3 -> 2 -> 1 over the life: opens on the second frame and is
      // shutting again by the sixth.
      const k = s.t / s.life;
      const size = k < 0.18 ? 1 : k < 0.45 ? 3 : k < 0.75 ? 2 : 1;
      drawSpark(ctx, Math.round(ix + 8 + s.x), Math.round(iy + 8 + s.y), size, s.c);
    }
  }

  /**
   * The seam. dialog.js replaces this method outright with the conversation
   * window's renderer, so the item-get announcement is drawn by the same code,
   * at the same geometry, in the same face as everything else Wren is ever
   * told. Until that module has loaded there is nothing here to draw — see the
   * block above; ensureDialog() makes that state last at most a frame.
   */
  // eslint-disable-next-line no-unused-vars
  _drawTextBox(ctx, lines, t) { ensureDialog(); }
}
