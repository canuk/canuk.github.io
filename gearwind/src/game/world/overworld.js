// Gearwind — Bellows Isle overworld: art, screens, and the interactive layer.
//
// This module owns everything the first half of Chapter 1 needs that is not
// already provided by the shared modules:
//
//   * the built world's ART — houses, the shop, the bent-vane windmill, the
//     skyharbor pier and its moored skiff, the rope bridge, the gear-gate,
//     the Boilerworks mouth, crates, pots, chests, scrap heaps.  All of it is
//     original and drawn out of the SAME 15-ish colour families as
//     game/tileset.js, so a house never looks pasted onto the lawn.
//   * a SCREEN model: a 16x14 character grid plus decor lists becomes a
//     Tilemap (collision), two baked canvases (sky and land) and a list of
//     live entities.
//   * the INTERACTIVE layer: bushes that cut, pots that lift and throw,
//     chests, signs, doors into interiors, a locked gear-gate, a heart piece,
//     and the drops that fall out of all of it.
//   * the SCREEN GRAPH: screens sit on an integer grid and connect by edge;
//     walking off an edge asks game/transition.js for its scroll.
//
// ART NOTE — why so much of this is rasterised rather than hand-typed: a
// windmill vane, a gear and a hip roof are all shapes whose PIXELS have to
// stay consistent across four animation frames and three sizes.  Authoring
// them as string grids guarantees a wobble somewhere.  So the silhouettes are
// computed, then shaded on the SNES rules the rest of the game follows: a
// 3-4 step ramp per material, a near-black (#282828) outline, light from the
// upper left, and a 2px dithered contact shadow on the ground.
import { TILE, WIDTH, HEIGHT } from '../../engine.js';
import { makeSprite, makeTiles, flipH } from '../../sprites.js';
import { PAL } from '../tileset.js';
import { Tilemap } from '../tilemap.js';
import { ClockworkBeetle, GearBat, SteamSlime } from '../enemies.js';
import { Sign, SIGN_TEXT } from '../npc.js';

export const COLS = 16, ROWS = 14;

// ---------------------------------------------------------------------------
// Palette. PAL's keys are kept intact (so shared tiles and my sprites share
// their greens, browns, brass and sky); the digits and the free capitals below
// add the built-world materials.
// ---------------------------------------------------------------------------
export const WPAL = {
  ...PAL,
  // Plaster / sandstone wall. Deliberately drawn out of the tileset's own
  // brass-and-earth family (A / N / D / M) instead of a fresh four-step ramp:
  // a screen only gets ~14-22 colours' worth of working palette in ALttP, and
  // a village screen has to spend most of it on grass, path and cliff.
  // Steps 3 and 4 are the ROAD's own olive (#888040) and the cliff's rock-5
  // (#5a4327) rather than two fresh tans. Measured: a village screen was
  // carrying #948046 and #908048, and #6c5330 and #685030, as separate
  // entries 11 and 24 rgb units apart — four working-palette slots buying two
  // materials nobody can tell apart at 3x. A plastered wall on this isle is
  // made of the isle.
  1: '#e8d288', 2: '#c69a5c', 3: '#888040', 4: '#5a4327',
  // copper-tile roof, light -> shadow (3 steps + the wall's shadow tone)
  5: '#e08850', 6: '#b85830', 7: '#8a3a1c', 8: '#8a3a1c',
  // Glass shares the sky's own shade tone: a window is a piece of sky in a
  // wall, and a fourth blue was costing a working-palette slot.
  9: '#4870a4',
  0: '#101018',            // doorway dark / interior black
  // IRON AND STONE SHARE A RAMP. Three greys for steel and three more for
  // masonry is six of a screen's twenty-two working colours spent on "grey".
  // The SNES answer is one grey ramp lit differently, which is what this is.
  i: '#c0c8ba', I: '#8e968e', J: '#525a52',
  K: '#c0c8ba',            // steel highlight (shares the tileset's rock light)
  // Terracotta deliberately shares the copper-roof ramp: one fired-clay
  // family for pots, stacks and tiles keeps the working palette inside
  // ALttP's measured 14-22 colours per screen.
  P: '#e08850', Q: '#b85830', U: '#8a3a1c',
  V: '#58a890',            // verdigris (the skiff's blazon)
  X: '#8a3a1c',            // rust
  Z: '#101018',            // deep shadow
  '!': '#f04858',          // heart light
  '@': '#c02030',          // heart mid
  '#': '#801020',          // heart dark
  // Canopy keyline. PAL.V is the tileset's green-black tree outline, but this
  // file's palette needs V for verdigris, so the same colour gets its own key
  // here — a bush ringed in neutral near-black reads as a decal pasted on the
  // lawn, which is exactly what the tileset already learned about trees.
  '~': '#1c3020',
  '%': '#786858',          // rope / hemp
  '^': '#c69a5c',          // rope light  (shares the wood ramp)
  '&': '#453220',          // rope dark   (shares the rock shadow)
};

// ---------------------------------------------------------------------------
// Raster helpers — a character grid is the canvas, makeSprite is the printer.
// ---------------------------------------------------------------------------
const G = (w, h, ch = '.') => Array.from({ length: h }, () => new Array(w).fill(ch));
const rowsOf = (g) => g.map((r) => r.join(''));
const px = (g, x, y, ch) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = ch;
};
const at = (g, x, y) =>
  (y >= 0 && y < g.length && x >= 0 && x < g[0].length ? g[y][x] : '.');
const box = (g, x, y, w, h, ch) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(g, x + i, y + j, ch);
};
const hspan = (g, x0, x1, y, ch) => { for (let x = x0; x <= x1; x++) px(g, x, y, ch); };
const vspan = (g, x, y0, y1, ch) => { for (let y = y0; y <= y1; y++) px(g, x, y, ch); };

/** Wrap every non-empty pixel in a near-black keyline. */
function outline(g, ch = 'k') {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[0].length; x++) {
      if (g[y][x] !== '.') continue;
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = at(g, x + dx, y + dy);
        if (c !== '.' && c !== ch) { near = true; break; }
      }
      if (near) out[y][x] = ch;
    }
  }
  return out;
}

/** ALttP's dithered ground shadow: two checker rows hugging the base. */
function contactShadow(g, x0, x1, y, deep = 'b') {
  for (let x = x0; x <= x1; x++) {
    if ((x + y) % 2 === 0) px(g, x, y, deep);
    if ((x + y) % 2 === 1) px(g, x, y + 1, deep);
  }
}

// ---------------------------------------------------------------------------
// THE VOID — what you see past the rim of a FLYING island.
//
// THE RULE THIS FILE NOW OBEYS: **empty air must be the emptiest surface on
// screen.** The previous build got that exactly backwards. It painted the void
// as a wall-to-wall 50% Bayer checkerboard between two blues, on the theory
// that a dithered field "measures as textured". It measured, all right: 162
// non-base pixels per 16x16 against ALttP water's 39, 3.3-3.8 colours per
// block against 1.92, and — the tell — 13.9% of its pixels differing from all
// four of their (identical) neighbours, where ALttP water manages 0.2% and
// ALttP GRASS manages 0.7%. On a SNES a 50% stipple across a whole field meant
// one thing: "this surface is see-through". Ours was the noisiest thing in
// frame, so two miles of nothing read as a river.
//
// The rebuild. Four cues, none of them a field dither:
//
//   1. VALUE RECEDES DOWN THE SCREEN, not outward from the rock. You are
//      looking down and out: the top of the gap is the far horizon, hazed and
//      pale; the bottom is the shaft directly under your boots, deep and dark.
//      So the air is FOUR SOLID ZONES keyed to screen y — #5888c0 (val 0.75)
//      at the top down to #283860 (val 0.38) at the bottom, a 0.38 spread
//      against ALttP's flat river at 0.20. Zone edges undulate (three
//      incommensurate sines) so they are never a ruled line, and the joins —
//      and ONLY the joins, the last 16% of each band — carry a dither.
//   2. THE DITHER IS CHUNKY. `bayer2` runs the same ordered matrix on 2x2
//      pixel cells, so every pixel in a dithered join matches at least two of
//      its neighbours. That is what kills the checker-isolation number: a
//      transition still reads as a transition, and no pixel is ever alone.
//   3. THE BRINK IS NOT THE DISTANCE. One flat shadow tone (#202848, darker
//      than any zone) hugs the island silhouette for ~4px solid and dithers
//      out by ~15, and it is drawn OVER the cloud layers — so cloud visibly
//      passes into the isle's shadow as it goes under the rim. This is the cue
//      that turns "blue rectangle" into "hole", and it means the treatment at
//      the brink genuinely differs from the treatment at distance.
//   4. THERE IS WEATHER DOWN THERE, AND IT MOVES. Two cloud decks: a FAR one
//      (compressed 3:1, sitting in the top two thirds, tone #5880b8 against
//      #5888c0 air — almost no contrast, because distance takes contrast
//      before it takes size) and a NEAR one (2:1, bottom half, #486890 body
//      with a #5880b8 sunlit crown against #283860 air — real contrast). The
//      near deck occludes the far one where they overlap. On top of both, a
//      dozen torn wisps RISE and wrap forever: Bellows Isle is falling past
//      them for the whole chapter, and this is the only place you see it.
//
// COVERAGE IS THE BUDGET, AND HERE IS THE HONEST ACCOUNT OF IT. The two decks
// together cover ~8.5% of the void, down from ~25%. Measured on the bridge
// screen against ALttP's water (tools/critic/void-stats.py):
//
//                       ours before   ours now   ALttP water
//   non-base px/16x16      64.4         54.4        24.1
//   MEDIAN block           61           38          0
//   blocks under 32        42%          46%         68%
//   colours per block      3.02         3.08        1.90
//
// The mottle is gone: the median block and the lower quartile are what moved,
// and the lower quartile is now zero — most of the air is genuinely empty.
// What is LEFT of the mean is not cloud. It is the four-zone value ramp and the
// isle's shadow: a 16x16 block that straddles a zone join is half one blue and
// half the next, so it scores ~128 whatever else is in it, and three joins plus
// a shadow edge put 29% of blocks in that state against ALttP's 6%. That is the
// price of the recession cue — the thing that makes this a hole rather than a
// river — and it is not payable out of the cloud budget. ALttP's water is flat
// because a river IS flat.
// ---------------------------------------------------------------------------
export const VOID = {
  // Air, top of the frame (far) to bottom (deep). All on the SNES 5-bit grid.
  // The steps are deliberately UNEVEN — small near the horizon, big down the
  // shaft. Haze compresses value at distance and lets it open up close to,
  // and the widest join is the one the near cloud deck sits on top of.
  z0: '#5890c8',       // horizon haze              val 0.78
  z1: '#4878b0',       //                           val 0.69
  z2: '#385890',       //                           val 0.56
  z3: '#283860',       // the shaft under the isle  val 0.38
  brink: '#202848',    // the isle's shadow on the air, and the cloud under-edge
  // THE CROWN. val 0.88, which is dV 0.50 against the shaft (#283860) and 0.32
  // against the mid air (#385890). Every solid object in the frame carries a
  // #282828 keyline at dV ~0.44 and ALttP's water sparkle runs dV 0.28; a cloud
  // deck sitting at dV 0.16-0.19 against its own air, as this one did, has no
  // edge at all and reads as a sandbar. This is the near deck's hard lit edge.
  cloudHi: '#90b8e0',
  cloudMid: '#5880b8', // far deck body — one flat tone, no edge: that IS distance
  cloudLo: '#486890',  // near deck body
};


const VOID_ZONES = [VOID.z0, VOID.z1, VOID.z2, VOID.z3];

// Ordered dither. A 4x4 Bayer matrix is what a 4bpp machine has instead of a
// gradient.
const BAYER4 = [
  [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5],
];
const bayer = (x, y) => (BAYER4[y & 3][x & 3] + 0.5) / 16;
// CHUNKY dither — the same matrix on 2x2 pixel cells. Per-pixel Bayer at a
// 50% threshold IS a checkerboard, and a checkerboard is the one pattern
// where every pixel differs from all four neighbours; that single fact was
// 70x of our deviation from ALttP's water. On 2x2 cells no pixel is ever
// isolated, horizontal runs never fall below 2, and the join still reads as a
// join at 3x zoom.
const bayer2 = (x, y) => bayer(x >> 1, y >> 1);

const hexRGB = (h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
];

/** Chamfer distance (px) from every pixel to the nearest set pixel of `mask`. */
function distanceField(mask, w, h) {
  const INF = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mask[i] ? 0 : INF;
  const A = 1, B = 1.4142;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (y > 0) {
        if (d[i - w] + A < v) v = d[i - w] + A;
        if (x > 0 && d[i - w - 1] + B < v) v = d[i - w - 1] + B;
        if (x < w - 1 && d[i - w + 1] + B < v) v = d[i - w + 1] + B;
      }
      if (x > 0 && d[i - 1] + A < v) v = d[i - 1] + A;
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (y < h - 1) {
        if (d[i + w] + A < v) v = d[i + w] + A;
        if (x > 0 && d[i + w - 1] + B < v) v = d[i + w - 1] + B;
        if (x < w - 1 && d[i + w + 1] + B < v) v = d[i + w + 1] + B;
      }
      if (x < w - 1 && d[i + 1] + A < v) v = d[i + 1] + A;
      d[i] = v;
    }
  }
  return d;
}

const newCanvas = (w, h) => {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
};

// The isle seen edge-on. ALttP draws a cliff on the left or right of a ledge
// as a WALL extending sideways, and the tileset's own edge tiles do that in
// two pixels. Two pixels is a riverbank. These are the tones the wall is
// continued in for another nine, straight off the tileset's rock ramp, so a
// vertical island edge falls away from you instead of stopping dead.
const WALL_RAMP = ['#6c5330', '#5a4327', '#453220', '#282828'].map(hexRGB);

/**
 * Build the two static per-screen void layers from the land silhouette.
 * @param {Uint8Array} land  WIDTH*HEIGHT, 1 where the island covers the pixel
 * @returns {{base: HTMLCanvasElement, shade: HTMLCanvasElement}}
 */
function buildVoidLayers(land, rock) {
  const W = WIDTH, H = HEIGHT;
  const dist = distanceField(land, W, H);
  // Distance UP to the nearest natural-ground pixel (rock/lawn — never planks,
  // pavers or causeway plate). This is what lets the island's outline STEP: a
  // shelf jutting east for three rows needs rock falling away under it, or it
  // reads as grass cut off with scissors. The bridge deck, the pier and the
  // Boilerworks causeway are excluded by construction, because a rope bridge
  // does not have a cliff under it.
  const du = new Float32Array(W * H).fill(999);
  for (let x = 0; x < W; x++) {
    let run = 999;
    for (let y = 0; y < H; y++) { const i = y * W + x; run = rock[i] ? 0 : run + 1; du[i] = run; }
  }
  // Separate horizontal and vertical reach to land, so the code can tell a
  // SIDE wall (land beside you, sky above and below) from the top or bottom
  // rim, which the tiles already draw properly.
  const dh = new Float32Array(W * H).fill(999);
  const dv = new Float32Array(W * H).fill(999);
  for (let y = 0; y < H; y++) {
    let run = 999;
    for (let x = 0; x < W; x++) { const i = y * W + x; run = land[i] ? 0 : run + 1; if (run < dh[i]) dh[i] = run; }
    run = 999;
    for (let x = W - 1; x >= 0; x--) { const i = y * W + x; run = land[i] ? 0 : run + 1; if (run < dh[i]) dh[i] = run; }
  }
  for (let x = 0; x < W; x++) {
    let run = 999;
    for (let y = 0; y < H; y++) { const i = y * W + x; run = land[i] ? 0 : run + 1; if (run < dv[i]) dv[i] = run; }
    run = 999;
    for (let y = H - 1; y >= 0; y--) { const i = y * W + x; run = land[i] ? 0 : run + 1; if (run < dv[i]) dv[i] = run; }
  }

  const zones = VOID_ZONES.map(hexRGB);
  const NZ = zones.length;
  const brink = hexRGB(VOID.brink);
  const base = newCanvas(W, H), shade = newCanvas(W, H);
  const bc = base.getContext('2d'), sc = shade.getContext('2d');
  const bi = bc.createImageData(W, H), si = sc.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    // The zone boundary for this column set — three incommensurate sines, so
    // the join between two blues is a slow wander across the frame rather
    // than a ruled horizontal line. Amplitude ~13px against 56px bands.
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wob = 7.0 * Math.sin(x / 29 + 0.7)
        + 4.5 * Math.sin(x / 71 - 1.3)
        + 2.0 * Math.sin(x / 11 + 2.2);
      let u = (y + wob) / (H - 1);
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      // Four SOLID zones. The only dithering is in the last 5% of a band, and
      // it is chunky (2x2 cells) — see bayer2. It used to be the last 16%,
      // which on a 56px band is a 9px full-width checker stripe: measured, it
      // read as a THIRD horizontal band across an already-striped screen. Three
      // pixels is a join; nine is a stripe.
      const f = u * NZ;
      let k = Math.floor(f);
      if (k > NZ - 1) k = NZ - 1;
      const fr = f - k;
      if (k < NZ - 1 && fr > 0.95 && bayer2(x, y) < (fr - 0.95) / 0.05) k++;
      let c = zones[k];
      let opaque = true;

      // --- the wall. Land to the side, nothing above or below: this is a
      //     cliff seen edge-on, and it keeps falling for another 9px.
      const wall = dh[i], reachV = dv[i];
      const isSide = wall <= 9.5 && reachV > 11;
      // UNDERHANG: natural ground directly above, open air here. Seven pixels
      // of the same falling rock, so any step in the rim gets an underside.
      const isUnder = !isSide && !land[i] && du[i] > 0 && du[i] <= 7.5;
      const isWall = isSide || isUnder;
      if (isWall) {
        const t = isSide ? (wall - 0.5) / 9 : (du[i] - 0.5) / 7.5;
        const wf = t * (WALL_RAMP.length - 1);
        let wk = Math.floor(wf);
        if (wf - wk > bayer2(x, y + 2) && wk < WALL_RAMP.length - 1) wk++;
        // strata: the same courses the cliff face carries, one step darker
        const course = ((y + ((x * 3) & 3)) % 7) === 0;
        c = WALL_RAMP[course ? Math.min(WALL_RAMP.length - 1, wk + 1) : wk];
        // the last two pixels dither into the air instead of ending on a line
        if (t > 0.72 && bayer2(x + 1, y) > (1 - t) * 3.0) { c = zones[k]; opaque = false; }
      }

      const p = i * 4;
      bi.data[p] = c[0]; bi.data[p + 1] = c[1]; bi.data[p + 2] = c[2]; bi.data[p + 3] = 255;
      // THE BRINK. One flat shadow tone under the rim, solid for 4px and
      // chunky-dithered out by 15, drawn over the cloud decks so weather
      // visibly goes into the isle's shade as it passes beneath. Rock (the
      // wall) is always opaque and keeps its own colour.
      // Kept deliberately TIGHT — solid for 2px, gone by 10. A fat shadow band
      // stops being the isle's shadow and becomes the dominant colour of the
      // sky, which is how the first pass ended up with a dark moat round every
      // rim instead of a bright drop with a shaded lip.
      const d = dist[i];
      const cover = d < 2 ? 1 : 1 - (d - 2) / 6;
      const on = (opaque && isWall)
        || cover >= 1 || (cover > 0 && bayer2(x + 1, y + 1) < cover);
      // A shadow is a RELATIVE darkening, not a fixed colour. Two zone steps
      // down from whatever air it falls on, bottoming out on `brink`. Painting
      // one flat #202848 everywhere put a half-value cliff against the pale
      // horizon band and the rim grew a chequered ribbon round it.
      const sh = (opaque && isWall) ? c
        : (k + 2 <= NZ - 1 ? zones[k + 2] : brink);
      si.data[p] = sh[0]; si.data[p + 1] = sh[1]; si.data[p + 2] = sh[2];
      si.data[p + 3] = on ? 255 : 0;
    }
  }
  bc.putImageData(bi, 0, 0);
  sc.putImageData(si, 0, 0);
  return { base, shade };
}

// Deterministic little PRNG so the cloud fields are identical every run.
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * THE WEATHER, REBUILT AS SHAPES.
 *
 * The previous decks were thresholded noise fields spread over half the frame
 * each. Measured: the void carried 57-64 non-base pixels per 16x16 against
 * ALttP water's 24, and the near deck sat at dV 0.19 against its own air with
 * no edge anywhere — on a screen where every solid object carries a #282828
 * keyline at dV 0.44 and where ALttP's own water SPARKLE runs dV 0.28. Two
 * miles of nothing read as a lagoon with sandbars in it. The excess was all
 * low-contrast mottle: it cost the whole texture budget and bought no reading.
 *
 * So a deck is now THREE BANKS, each two lobes with a gap between them, and
 * each lobe is a silhouette rather than a smear:
 *
 *   thickness(x)   a squared-cosine lens per lobe, taken as a max so two lobes
 *                  merge into one mass instead of stacking into a hump
 *   top(x)         the bank line minus half the thickness, plus three
 *                  incommensurate ripples — a billowing edge, not a lens rim
 *   the near deck  a HARD 1px #90b8e0 crown (dV 0.50 against the shaft air),
 *                  a #486890 body, and a 1px #202848 under-edge, which is the
 *                  same tone as the isle's own shadow on the air. Crown, body,
 *                  shadow: the same three-part reading every solid object in
 *                  this game gets, which is what makes it an object.
 *   the far deck   ONE flat #5880b8 tone, no crown, no under-edge, thinner
 *                  lobes, higher in the frame. Distance takes contrast before
 *                  it takes size, so the far deck is deliberately the thing you
 *                  can barely see.
 *
 * Coverage is ~6% (near) and ~2.5% (far) of the canvas, down from ~16% and ~9%.
 * That is the budget the crown is paid for out of.
 *
 * The canvas is 384 wide and wraps horizontally; vertically it is the screen
 * and does NOT wrap, because the y grading is the depth cue and sliding it
 * would destroy it. Vertical motion is the risers' job (see drawRisers).
 */
// A mass is a CLUSTER of ellipses [cx, cy, rx, ry] unioned per column: the top
// of the silhouette is the highest crest of any ellipse covering that column
// and the bottom is the lowest. Overlapping ellipses of different heights give
// a lumpy cumulus crest; a single lens gives a smooth arc, which is why the
// first attempt still read as a sandbar. `base` flattens the underside onto the
// deck line, because a cloud deck seen from two miles above it is a floor.
const DECKS = {
  far: [
    { base: 34, e: [[90, 30, 32, 3], [118, 27, 24, 4], [60, 31, 18, 2]] },
    { base: 35, e: [[300, 31, 26, 3], [322, 28, 17, 3], [282, 32, 13, 2]] },
    { base: 68, e: [[196, 64, 28, 4], [222, 61, 20, 3], [172, 65, 16, 2]] },
    { base: 69, e: [[24, 65, 22, 3], [44, 63, 15, 2]] },
    { base: 101, e: [[132, 97, 24, 3], [156, 95, 17, 2], [112, 98, 12, 2]] },
    { base: 101, e: [[334, 98, 19, 2], [352, 96, 13, 2]] },
  ],
  near: [
    { base: 129, e: [[30, 128, 19, 7], [52, 123, 15, 10], [72, 129, 13, 6], [13, 130, 9, 4]] },
    { base: 125, e: [[201, 124, 14, 6], [219, 119, 13, 9], [235, 125, 10, 5]] },
    { base: 167, e: [[96, 166, 19, 7], [122, 159, 19, 12], [148, 165, 15, 7], [168, 168, 9, 4]] },
    { base: 163, e: [[292, 163, 15, 6], [310, 157, 14, 10], [328, 164, 11, 5]] },
    { base: 202, e: [[34, 201, 19, 7], [60, 194, 21, 13], [87, 200, 17, 8], [107, 203, 9, 4]] },
    { base: 198, e: [[238, 198, 16, 6], [258, 191, 17, 11], [279, 198, 13, 6]] },
  ],
};

function buildDeck(kind) {
  const w = 384, h = HEIGHT;
  const far = kind === 'far';
  const BODY = hexRGB(far ? VOID.cloudMid : VOID.cloudLo);
  const CROWN = far ? null : hexRGB(VOID.cloudHi);
  // The under-edge is the SAME #282828 keyline every solid object in the game
  // carries. dV 0.22 against the shaft and 0.40 against the mid air, against
  // 0.09 for the shadow tone it replaced — and it costs nothing, because the
  // colour is already on every screen.
  const UNDER = far ? null : hexRGB('#282828');
  const cv = newCanvas(w, h);
  const c = cv.getContext('2d');
  const img = c.createImageData(w, h);
  const put = (x, y, col) => {
    if (y < 0 || y >= h) return;
    const p = (y * w + x) * 4;
    img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2];
    img.data[p + 3] = 255;
  };
  DECKS[kind].forEach((mass, mi) => {
    const ph = mi * 1.9;
    for (let x = 0; x < w; x++) {
      let top = 1e9, bot = -1e9;
      for (const [cx, cy, rx, ry] of mass.e) {
        let dx = x - cx;
        if (dx > w / 2) dx -= w;
        if (dx < -w / 2) dx += w;
        const u = dx / rx;
        if (u <= -1 || u >= 1) continue;
        const q = ry * Math.sqrt(1 - u * u);
        if (cy - q < top) top = cy - q;
        if (cy + q > bot) bot = cy + q;
      }
      if (top > bot) continue;
      // the crest billows: three periods that never line up, so no two masses
      // on the canvas carry the same profile
      top += 1.1 * Math.sin(x / 9 + ph) + 0.7 * Math.sin(x / 23 - ph)
        + 0.5 * Math.sin(x / 4 + ph * 2);
      bot = Math.min(bot, mass.base + 0.8 * Math.sin(x / 19 + ph));
      const t = Math.round(top), b = Math.round(bot);
      if (b < t) continue;
      for (let y = t; y <= b; y++) put(x, y, BODY);
      if (!CROWN) continue;
      put(x, t, CROWN);
      // a second crown pixel only where the mass is deep — a thin scrap of
      // cloud does not get a two-pixel highlight
      if (b - t > 6 && ((x * 3 + mi) % 7) < 5) put(x, t + 1, CROWN);
      if (b - t > 2) put(x, b, UNDER);
    }
  });
  c.putImageData(img, 0, 0);
  return cv;
}

/**
 * Periodic multi-octave value noise on a torus, normalised to 0..1.
 * Octaves are [cellX, cellY, amplitude] — anisotropic, because a cloud deck
 * seen from above is all horizontal shear and the masses have to be wider
 * than they are tall or they read as bubbles.
 */
function periodicNoise(w, h, octaves, seed) {
  const rnd = lcg(seed);
  const out = new Float32Array(w * h);
  let total = 0;
  for (const [cellX, cellY, amp] of octaves) {
    const gw = Math.max(1, Math.round(w / cellX)), gh = Math.max(1, Math.round(h / cellY));
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const sw = w / gw, sh = h / gh;
    for (let y = 0; y < h; y++) {
      const fy = y / sh, y0 = Math.floor(fy) % gh, y1 = (y0 + 1) % gh;
      const ty = (1 - Math.cos(Math.PI * (fy - Math.floor(fy)))) / 2;
      for (let x = 0; x < w; x++) {
        const fx = x / sw, x0 = Math.floor(fx) % gw, x1 = (x0 + 1) % gw;
        const tx = (1 - Math.cos(Math.PI * (fx - Math.floor(fx)))) / 2;
        const a = g[y0 * gw + x0] + (g[y0 * gw + x1] - g[y0 * gw + x0]) * tx;
        const b = g[y1 * gw + x0] + (g[y1 * gw + x1] - g[y1 * gw + x0]) * tx;
        out[y * w + x] += (a + (b - a) * ty) * amp;
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/**
 * THE RISERS. Fourteen torn wisps that climb the frame and wrap forever.
 *
 * They are the only thing in the void with VERTICAL motion, and they carry the
 * premise: the isle is falling for the whole chapter, so everything hanging in
 * the air outside it goes UP past the rim. They are also what crosses the gap
 * on the Windrope — a span of blue with something drifting through the middle
 * of it has air in it; a span of blue with nothing in it is a wall.
 *
 * Drawn at runtime rather than baked, so a wisp can take its tone from the
 * depth zone it is currently passing through: near-invisible against the pale
 * horizon at the top, bright against the dark shaft at the bottom. 14 wisps
 * averaging 22px of 1px line is under 0.15% of the frame.
 */
const RISERS = (() => {
  const rnd = lcg(0x7ab41d09);
  const out = [];
  for (let i = 0; i < 14; i++) {
    // A torn ribbon, authored once: a solid core with one or two detached
    // scraps trailing off each end. A ruled dashed line reads as a scratch on
    // the film; a core with scraps reads as cloud coming apart in shear.
    const core = 7 + Math.round(rnd() * 15);
    const segs = [];
    let cx = 0;
    if (rnd() < 0.6) { segs.push([cx, 1 + Math.round(rnd() * 2)]); cx += 4 + Math.round(rnd() * 3); }
    segs.push([cx, core]);
    cx += core + 2 + Math.round(rnd() * 4);
    if (rnd() < 0.7) segs.push([cx, 2 + Math.round(rnd() * 4)]);
    out.push({
      x: Math.round(rnd() * WIDTH),
      y: Math.round(rnd() * (HEIGHT + 44)),
      segs,
      spd: 0.09 + rnd() * 0.17,
      // a second row under the fat part of the core, on about half of them
      belly: rnd() < 0.5 ? [2 + Math.round(rnd() * 3), Math.max(2, core >> 1)] : null,
    });
  }
  return out;
})();

/**
 * AERIAL PERSPECTIVE. A lesser isle two miles down is not the same colours as
 * one under your boots: the air between eats its chroma and drags its value
 * toward the haze. Anything drawn INTO the void gets mixed toward the middle
 * air tone and re-snapped to the SNES 5-bit grid, which also collapses its
 * ramp — a far islet ends up carrying three or four colours instead of eight,
 * which is exactly what you want a distant object to cost.
 */
// EVERYTHING THAT HANGS IN THE DROP IS PAINTED OUT OF FOUR COLOURS. Five
// sprites at three haze levels used to arrive with their own ramps, because
// hazed() mixed toward the air and re-snapped to the 5-bit grid — five
// different sets of near-identical blues, which is exactly the "colour budget
// is ~1.7-2x ALttP" finding in miniature. Now every far object snaps to these
// four after hazing, so the haze level chooses WHICH of the four an islet
// still reaches rather than inventing new ones: the 24px islet uses all four,
// the 10px one collapses onto the middle two, and the tiny hauler is nearly a
// single smudge. Size and contrast fall off together and cost nothing.
// ...and all four sit ON the SNES 5-bit grid. #38446c / #546488 / #4c7860 did
// not: a 4bpp machine cannot address a channel that is not a multiple of 8, so
// three of the four tones two miles down were colours no SNES could make.
const FAR_PAL = ['#202848', '#384068', '#586888', '#487860'].map(hexRGB);

/** Snap a hex to the SNES 5-bit-per-channel grid. */
function snap5(hex) {
  const [r, g, b] = hexRGB(hex);
  const q = (v) => Math.min(248, Math.round(v / 8) * 8);
  return `#${[q(r), q(g), q(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function hazed(img, t) {
  const cv = newCanvas(img.width, img.height);
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, cv.width, cv.height);
  const d = id.data;
  const air = hexRGB(VOID.z2);
  const mix = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    for (let k = 0; k < 3; k++) mix[k] = d[i + k] + (air[k] - d[i + k]) * t;
    let best = FAR_PAL[0], bd = 1e9;
    for (const c of FAR_PAL) {
      const q = (mix[0] - c[0]) ** 2 + (mix[1] - c[1]) ** 2 + (mix[2] - c[2]) ** 2;
      if (q < bd) { bd = q; best = c; }
    }
    d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2];
  }
  c.putImageData(id, 0, 0);
  return cv;
}

let VOID_FIELDS = null;
export function voidFields() {
  if (!VOID_FIELDS) VOID_FIELDS = { far: buildDeck('far'), near: buildDeck('near') };
  return VOID_FIELDS;
}

// ---------------------------------------------------------------------------
// ITEM-GET COPY. game/transition.js draws its announcement box with the HUD
// font: one unwrapped line per array entry, at most three, starting 12px in,
// and that font has letters, digits, space, hyphen, full stop and colon and
// NOTHING else. A line with an apostrophe in it loses the apostrophe; a line
// over ~28 characters runs off the right edge of the screen. So every string
// that goes to getItem() comes through here first — it is pre-wrapped to the
// box, stripped to the glyphs that exist, and capped at three lines.
//
// This is deliberately an ADAPTER on our side rather than a change to the
// transition module: the box is theirs, the copy is ours.
// ---------------------------------------------------------------------------
// 23 characters. game/transition.js draws the announcement in the HUD font at
// 6px/char in a 208px window (~30 fit); game/dialog.js now exports a richer
// window measured at 144px (~24 fit) and transition.js is expected to move
// onto it. 23 is inside BOTH, so the copy cannot break when it does.
const ITEM_COLS = 23;
const GLYPH_OK = /[A-Z0-9 .:-]/;

export function itemText(lines) {
  const out = [];
  for (const raw of [].concat(lines)) {
    for (const para of String(raw).split('\n')) {
      const clean = [...para.toUpperCase()].filter((c) => GLYPH_OK.test(c)).join('')
        .replace(/\s+/g, ' ').trim();
      if (!clean) continue;
      let line = '';
      for (const word of clean.split(' ')) {
        if (!line) { line = word; continue; }
        if (line.length + 1 + word.length <= ITEM_COLS) line += ' ' + word;
        else { out.push(line); line = word; }
      }
      if (line) out.push(line);
    }
  }
  return out.slice(0, 3);
}

const segDist = (px_, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy || 1;
  let t = ((px_ - ax) * vx + (py - ay) * vy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px_ - (ax + vx * t), py - (ay + vy * t));
};

// ---------------------------------------------------------------------------
// TILES — the surfaces the shared tileset does not carry: pier decking, the
// rope bridge, and the flagstone terrace.
// ---------------------------------------------------------------------------

// Weathered deck boards. Four 4px planks per tile: a 1px sunlit top edge, two
// rows of body, a 1px seam. Every plank gets its own tone off a 4-step wood
// ramp so a run of tiles reads as separate boards rather than one slab, and
// the butt-joints stagger tile to tile (a real deck never lines its ends up).
function plankTile(seed) {
  const g = G(16, 16, 'n');
  const TONE = ['n', 'N', 'n', 'm'];
  for (let p = 0; p < 4; p++) {
    const y0 = p * 4;
    const tone = TONE[(p + seed) % 4];
    for (let y = y0; y < y0 + 4; y++) {
      for (let x = 0; x < 16; x++) {
        let c = tone;
        if (y === y0) c = tone === 'm' ? 'n' : 'N';       // lit plank crown
        if (y === y0 + 3) c = 'z';                        // shadow under it
        // grain: short 1-2px streaks along the board
        if (y === y0 + 1 && (x * 5 + p * 7 + seed * 3) % 9 === 0) c = tone === 'N' ? 'n' : 'm';
        if (y === y0 + 2 && (x * 3 + p * 11 + seed) % 13 === 0) c = 'm';
        g[y][x] = c;
      }
    }
    hspan(g, 0, 15, y0 + 3, 'm');                         // seam
    // butt joint: one plank per tile ends inside it
    const jx = (p * 5 + seed * 3) % 16;
    if ((p + seed) % 3 === 0) vspan(g, jx, y0, y0 + 3, 'm');
  }
  // iron nail heads on the joist lines
  for (const x of [2, 13]) {
    for (let p = 0; p < 4; p++) {
      if ((p + x + seed) % 2) continue;
      px(g, x, p * 4 + 1, 'z');
      px(g, x + 1, p * 4 + 1, 'N');
    }
  }
  return g;
}

/**
 * INTERIOR floorboards. Same wood, half the contrast: a pier is meant to read
 * as separate weathered planks over a drop, a room's floor is meant to sit
 * still under the furniture. Wide 8px boards, a 1px seam, sparse knots.
 */
function floorTile(seed) {
  const g = G(16, 16, 'n');
  for (let p = 0; p < 2; p++) {
    const y0 = p * 8;
    const light = ((p + seed) % 3) === 0;
    for (let y = y0; y < y0 + 8; y++) {
      for (let x = 0; x < 16; x++) {
        let c = light ? 'N' : 'n';
        if (y === y0) c = 'N';                            // board crown
        if ((x * 7 + y * 5 + seed * 3) % 29 === 0) c = light ? 'n' : 'N';
        g[y][x] = c;
      }
    }
    hspan(g, 0, 15, y0 + 7, 'm');                          // the seam
    // one knot per board, and the nails at the joist line
    const kx = (seed * 5 + p * 9) % 13 + 1;
    px(g, kx, y0 + 3, 'm'); px(g, kx + 1, y0 + 3, 'm'); px(g, kx, y0 + 4, 'm');
    px(g, kx + 1, y0 + 2, 'z');
    if ((p + seed) % 2 === 0) { px(g, 3, y0 + 1, 'z'); px(g, 12, y0 + 5, 'z'); }
    // butt joint on some boards
    if ((p + seed) % 4 === 1) vspan(g, (seed * 7 + p * 3) % 15, y0, y0 + 6, 'm');
  }
  return g;
}

/**
 * A cottage floor: the same boards, laid the other way.
 *
 * Measured: shop and home came out 77% pixel-identical because both were a
 * grey ashlar band over the identical plank field, and furniture only ever
 * covers a third of a room. A floor is the largest single surface in an
 * interior, so turning the boards through ninety degrees separates the two
 * rooms further than any amount of extra furniture would — and it is what a
 * real shopfront and a real cottage do anyway: a shop boards ACROSS the front
 * so the customers walk along the grain, a house boards front-to-back.
 */
function floorTileV(seed) {
  const g = G(16, 16, 'n');
  for (let p = 0; p < 2; p++) {
    const x0 = p * 8;
    const light = ((p + seed) % 3) === 0;
    for (let x = x0; x < x0 + 8; x++) {
      for (let y = 0; y < 16; y++) {
        let c = light ? 'N' : 'n';
        if (x === x0) c = 'N';                             // board edge in the light
        if ((x * 5 + y * 7 + seed * 3) % 29 === 0) c = light ? 'n' : 'N';
        g[y][x] = c;
      }
    }
    vspan(g, x0 + 7, 0, 15, 'm');                          // the seam
    const ky = (seed * 5 + p * 9) % 13 + 1;
    px(g, x0 + 3, ky, 'm'); px(g, x0 + 3, ky + 1, 'm'); px(g, x0 + 4, ky, 'm');
    px(g, x0 + 2, ky + 1, 'z');
    if ((p + seed) % 2 === 0) { px(g, x0 + 1, 3, 'z'); px(g, x0 + 5, 12, 'z'); }
    if ((p + seed) % 4 === 1) hspan(g, x0, x0 + 6, (seed * 7 + p * 3) % 15, 'm');
  }
  return g;
}

/** Pier plank tile carrying sky above (north rail) or below (under-beams). */
function pierTile(kind, seed) {
  const g = plankTile(seed);
  // NOTE: sky is left TRANSPARENT ('.'), never painted. Everything that is
  // not island has to let the void layers through, or the depth ramp and the
  // drifting cloud fields stop at the plank line.
  if (kind === 'n') {
    // open air, then the top rail: a beam and posts, sitting on the deck edge
    box(g, 0, 0, 16, 5, '.');
    for (let x = 0; x < 16; x++) if ((x + seed) % 8 === 3) vspan(g, x, 1, 4, 'm');
    hspan(g, 0, 15, 5, 'k');
    hspan(g, 0, 15, 4, 'N');
  } else if (kind === 's') {
    // deck, then the under-structure hanging into the drop
    hspan(g, 0, 15, 11, 'k');
    box(g, 0, 12, 16, 4, '.');
    for (let x = 0; x < 16; x++) if ((x + seed) % 6 === 2) vspan(g, x, 12, 14, 'm');
    hspan(g, 0, 15, 12, 'm');
  }
  return g;
}

/**
 * Rope-bridge tile.  The decking is CONTINUOUS across the three rows — the
 * slats run north-south (perpendicular to the walk), so a stack of three
 * tiles reads as one span rather than three ladders.  Only the outer rows
 * carry the hand-ropes and the sky.
 */
function bridgeTile(kind, seed) {
  const g = G(16, 16, '.');
  const deckTop = kind === 'n' ? 6 : 0;
  const deckBot = kind === 's' ? 11 : 15;
  for (let x = 0; x < 16; x++) {
    // 3px slat, 1px shadow gap
    const phase = (x + seed * 2) % 4;
    const tone = phase === 0 ? 'N' : phase === 3 ? 'z' : 'n';
    for (let y = deckTop; y <= deckBot; y++) g[y][x] = tone;
  }
  // the two stringers the slats are lashed to
  for (const sy of [deckTop + 1, deckBot - 1]) {
    if (sy < deckTop || sy > deckBot) continue;
    for (let x = 0; x < 16; x++) px(g, x, sy, x % 4 === 3 ? 'm' : 'z');
  }
  if (kind === 'n') {
    hspan(g, 0, 15, deckTop, 'N');                 // lit edge of the decking
    hspan(g, 0, 15, deckTop - 1, 'k');
    // hand-rope arcing above, with lashings dropping to the deck
    for (let x = 0; x < 16; x++) {
      const yy = 1 + Math.round(1.4 * Math.sin((x + seed * 4) / 3.4));
      px(g, x, yy, '^');
      px(g, x, yy + 1, '%');
      if ((x + seed) % 4 === 0) vspan(g, x, yy + 2, deckTop - 2, '&');
    }
  } else if (kind === 's') {
    hspan(g, 0, 15, deckBot, 'm');
    hspan(g, 0, 15, deckBot + 1, 'k');
    for (let x = 0; x < 16; x++) {
      const yy = 14 - Math.round(1.2 * Math.sin((x + seed * 2) / 3.1));
      px(g, x, yy, '%');
      px(g, x, yy - 1, '^');
      if ((x + seed) % 4 === 2) vspan(g, x, deckBot + 2, yy - 2, '&');
    }
  }
  return g;
}

/**
 * Flagstone paving.  The first pass drew one 16x16 slab per tile with a joint
 * on its top and left edge, which produces a PERFECT GRID with unbroken 16px
 * seams — a spreadsheet, not a terrace.  Real paving is laid in courses: the
 * horizontal joints run through, the vertical ones stagger course to course,
 * and a third of the slabs are double-width so the stagger never settles into
 * a checker.  `jx` is where (or whether) this tile carries a vertical joint;
 * the caller picks it off the tile coordinate so neighbours agree.
 */
function paverTile(jx, seed) {
  const g = G(16, 16, 'r');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c = 'r';
      if ((x * 5 + y * 7 + seed * 11) % 17 === 0) c = 'x';
      if ((x * 3 + y * 11 + seed * 5) % 23 === 0) c = 'R';
      g[y][x] = c;
    }
  }
  hspan(g, 0, 15, 0, 'S');                       // the through course joint
  hspan(g, 0, 15, 1, 'R');                       // slab crown catches the sun
  hspan(g, 0, 15, 15, 'x');                      // and falls away at the foot
  if (jx >= 0) {
    vspan(g, jx, 0, 15, 'S');
    if (jx < 15) vspan(g, jx + 1, 1, 15, 'R');
  }
  // Wear: chipped corners, a hairline crack, moss in the joints. Each one is
  // keyed to the seed so a given tile always weathers the same way.
  if (seed % 4 === 0) { px(g, 13, 2, 'x'); px(g, 14, 2, 'x'); px(g, 14, 3, 'x'); }
  if (seed % 4 === 1) { px(g, 2, 12, 'x'); px(g, 3, 13, 'x'); px(g, 2, 13, 'x'); }
  if (seed % 4 === 2) {
    for (let k = 0; k < 7; k++) px(g, 4 + k, 5 + ((k * 3) % 3), 'x');
  }
  for (let i = 0; i < 2 + (seed % 3); i++) {
    px(g, (seed * 5 + i * 7) % 15 + 1, 0, 'j');
    if (jx >= 0 && i === 0) px(g, jx, (seed * 3 + 4) % 14 + 1, 'j');
  }
  return g;
}

/** Rivet-plate walkway for the Boilerworks approach. */
function plateTile(seed) {
  const g = G(16, 16, 'I');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c = 'I';
      if ((x * 5 + y * 3 + seed * 7) % 19 === 0) c = 'i';
      if ((x * 7 + y * 11 + seed) % 47 === 0) c = 'J';
      g[y][x] = c;
    }
  }
  hspan(g, 0, 15, 0, 'J');
  vspan(g, 0, 0, 15, 'J');
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
    px(g, x, y, 'i'); px(g, x + 1, y, 'K');
    px(g, x, y + 1, 'J'); px(g, x + 1, y + 1, 'I');
  }
  return g;
}

/**
 * Interior wall: coursed grey ashlar, so it can never be confused with the
 * plank floor below it.  `cap` is the top course, carrying the dark ceiling
 * beam; the bottom course carries a wooden skirting where the floor meets it.
 */
function wallTile(kind) {
  const g = G(16, 16, 'r');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let c = 'r';
      if (y % 8 < 2) c = 'R';                                  // lit block top
      if (y % 8 > 5) c = 'x';                                  // shaded base
      if ((x * 7 + y * 5) % 19 === 0) c = 'x';
      if ((x * 3 + y * 13) % 29 === 0) c = 'R';
      g[y][x] = c;
    }
  }
  // block joints, staggered course to course
  for (const y of [0, 8]) hspan(g, 0, 15, y, 'S');
  vspan(g, 0, 0, 7, 'S');
  vspan(g, 8, 8, 15, 'S');
  if (kind === 'cap') {
    hspan(g, 0, 15, 0, 'Z'); hspan(g, 0, 15, 1, 'Z');
    hspan(g, 0, 15, 2, 'S'); hspan(g, 0, 15, 3, 'x');
    hspan(g, 0, 15, 4, 'r');
  } else if (kind === 'win') {
    // A window, its reveal cut back into the coursed stone, with a brass
    // casement and the daylight that puts a pool on the boards below.
    box(g, 1, 2, 14, 11, 'S');
    box(g, 2, 3, 12, 9, 'x');
    box(g, 3, 4, 10, 7, '9');
    for (let y = 4; y < 11; y++) {
      for (let x = 3; x < 13; x++) {
        if (x - 3 + (10 - y) < 5) px(g, x, y, 'K');
        else if ((x * 3 + y * 5) % 9 === 0) px(g, x, y, 'u');
      }
    }
    vspan(g, 8, 4, 10, 'B');
    hspan(g, 3, 12, 7, 'B');
    hspan(g, 1, 14, 12, 'A');                  // sill, catching the light
    hspan(g, 1, 14, 13, 'z');
    hspan(g, 0, 15, 14, 'r');
    hspan(g, 0, 15, 15, 'x');
  } else if (kind === 'base') {
    // wooden skirting + a brass pipe run, steampunk cottage
    hspan(g, 0, 15, 10, 'k');
    hspan(g, 0, 15, 11, 'N'); hspan(g, 0, 15, 12, 'n');
    hspan(g, 0, 15, 13, 'm'); hspan(g, 0, 15, 14, 'z');
    hspan(g, 0, 15, 15, 'k');
    for (let x = 2; x < 16; x += 5) { px(g, x, 12, 'z'); px(g, x, 13, 'z'); }
  }
  return g;
}

// ---------------------------------------------------------------------------
// MATERIAL QUANTISER.
//
// Measured complaint: the dirt road carried 7.0-7.3 distinct colours per 16x16
// against ALttP's 4.0, as per-pixel speckle — noise standing in for texture.
// Rather than re-author tiles another agent owns, every tile of a given family
// is snapped to a short authored ramp on the way into the tile map. Anything
// already on the ramp is untouched, so grass keeps its weave and only the
// in-between speckle collapses. Then a directional rut is stamped into the
// road interior, because a road that people walk down has a grain.
// ---------------------------------------------------------------------------
// ONE tan family, FOUR tones, shared by the dirt road AND the island rock.
// Measured against ALttP with a modal-colour block sampler (check-shot cannot
// see tan surfaces — it only samples blocks whose mode is the screen's
// dominant colour, i.e. grass): our #888040-modal blocks carried 75.4 non-base
// pixels and 5.17 colours per 16x16 against ALttP's cliff path at 37.4 / 3.13
// and its desert at 57.0 / 3.38. Twice the texture, 1.6x the colours. Two
// separate three-step tan ramps — one for dirt, one for rock — were half of
// that on their own, so they are now the SAME four rungs.
const TAN4 = ['#453220', '#686028', '#888040', '#a09850'];
const DIRT_RAMP = ['#282828', ...TAN4,
  '#408848', '#388038', '#489848', '#287838', '#1b5226', '#8a9a5a'];
export const ROCK_RAMP = ['#282828', ...TAN4,
  '#8a9a5a', '#408848', '#388038', '#489848', '#287838', '#1b5226'];

/**
 * Kill single-pixel speckle. A pixel that matches none of its four neighbours
 * is noise on a 4bpp machine, not texture — and it is what the block sampler
 * counts. One pass collapses it into whichever neighbour tone is commonest.
 */
function despeckle(d, w, h) {
  const key = (i) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  const src = new Uint8ClampedArray(d);
  const k = (i) => (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] === 0) continue;
      const me = k(i);
      const n = [];
      if (x > 0) n.push(i - 4);
      if (x < w - 1) n.push(i + 4);
      if (y > 0) n.push(i - w * 4);
      if (y < h - 1) n.push(i + w * 4);
      const same = n.filter((j) => src[j + 3] !== 0 && k(j) === me);
      if (same.length) continue;
      const tally = new Map();
      for (const j of n) {
        if (src[j + 3] === 0) continue;
        tally.set(k(j), (tally.get(k(j)) || 0) + 1);
      }
      let bestK = null, bestN = 0;
      for (const [c, cnt] of tally) if (cnt > bestN) { bestN = cnt; bestK = c; }
      if (bestK === null) continue;
      d[i] = (bestK >> 16) & 255; d[i + 1] = (bestK >> 8) & 255; d[i + 2] = bestK & 255;
      void key;
    }
  }
}

export function quantiseTiles(tiles, test, ramp = DIRT_RAMP, grain = null, thin = 0) {
  const cols = ramp.map(hexRGB);
  for (const [name, img] of Object.entries(tiles)) {
    if (!test(name)) continue;
    const cv = newCanvas(img.width, img.height);
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    const id = c.getImageData(0, 0, cv.width, cv.height);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      let best = 0, bd = 1e9;
      for (let k = 0; k < cols.length; k++) {
        const dr = d[i] - cols[k][0], dg = d[i + 1] - cols[k][1], db = d[i + 2] - cols[k][2];
        const q = dr * dr + dg * dg + db * db;
        if (q < bd) { bd = q; best = k; }
      }
      d[i] = cols[best][0]; d[i + 1] = cols[best][1]; d[i + 2] = cols[best][2];
    }
    for (let p = 0; p < thin; p++) despeckle(d, cv.width, cv.height);
    c.putImageData(id, 0, 0);
    if (grain) grain(c, name, cv.width, cv.height);
    tiles[name] = cv;
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// THE SKIRT — a transition tone where grass meets tan.
//
// Texture density on our tan surfaces was fixed last pass (49.5 non-base px
// per 16x16 against ALttP's two tan refs at 43.9). The COLOUR count did not
// move at all: 5.45 tones per #888040-modal block against ALttP's 3.40, and
// the excess was not spread evenly. At >=85% purity our blocks are 2-3
// colours, identical to the reference. Every one of the extra tones lives at a
// MATERIAL BOUNDARY, and the reason is that we had no transition tone at all:
// full-strength grass butted straight against full-strength tan, so both
// ramps met at the seam and a boundary block carried the ends of BOTH.
//
// Measured on the boundary blocks themselves (50-78% tan, tools/critic
// tail sampler), what ALttP puts there and what we put there:
//
//   ALttP cliff path   #889860 73%   #b8c088 68%   #282828 67%   #586848 45%
//   ALttP desert       #b8c088 74%   #686028 67%   #889860 67%   #706830 39%
//   ours               #686028 100%  #282828 95%   #185028 94%   #408848 94%
//
// #889860 and #586848 are DEDICATED pale-olive blends that sit between tan and
// grass — neither ramp owns them. Ours were the road's keyline and the grass's
// own deepest shadow: two of the highest-contrast tones in the tileset, laid
// against each other, at every kerb on the isle.
//
// So: the 1px keyline becomes the pale olive, the deep-green shadow behind it
// becomes the dark olive, and inside two pixels of the seam both ramps drop to
// their base tone — no road grain, no grass tufts, nothing but the four rungs
// of the transition. Blocks that used to carry six or seven tones carry four.
// ---------------------------------------------------------------------------
// ONE tone, not two. ALttP's cliff path uses #889860 AND #586848 at a seam,
// but it can afford both: it is an arid screen whose scrub is already olive,
// so neither tone is a new working-palette entry. Ours is a green island, so
// each one costs a slot on a screen that is already over ALttP's 13-18. The
// dark olive alone does the whole job — it replaces BOTH the black keyline and
// the deep-green shadow behind it, so a boundary block that used to carry six
// tones carries three: tan, kerb, grass.
const SKIRT_HI = [0x58, 0x68, 0x48];    // the kerb, on the tan side of the seam
const SKIRT_LO = [0x58, 0x68, 0x48];    // ...and on the grass side
const SKIRT_TAN = [0x88, 0x80, 0x40];
const SKIRT_GRASS = [0x40, 0x88, 0x48];

/**
 * Re-cut the grass/tan seam in every tile `test` accepts.
 * Runs after quantiseTiles, so the tan family is already down to four rungs.
 */
export function skirtTiles(tiles, test) {
  for (const [name, img] of Object.entries(tiles)) {
    if (!test(name)) continue;
    const w = img.width, h = img.height;
    const cv = newCanvas(w, h);
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    const id = c.getImageData(0, 0, w, h);
    const d = id.data;
    const N = w * h;
    const R = new Uint8Array(N), G = new Uint8Array(N), B = new Uint8Array(N);
    const A = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; A[i] = d[i * 4 + 3];
    }
    // Tan is the olive family the road and the rock share; grass is anything
    // whose green channel genuinely leads. Black keylines are neither.
    const isTan = (i) => A[i] && G[i] <= R[i] + 24 && R[i] > 48;
    const isGreen = (i) => A[i] && G[i] > R[i] + 24 && G[i] > B[i] + 24;
    const isDark = (i) => A[i] && R[i] < 56 && G[i] < 64 && B[i] < 64;
    let anyTan = false, anyGreen = false;
    for (let i = 0; i < N; i++) { if (isTan(i)) anyTan = true; else if (isGreen(i)) anyGreen = true; }
    if (!anyTan || !anyGreen) continue;             // not a seam tile

    const near = (i, pred, rad) => {
      const x = i % w, y = (i / w) | 0;
      for (let dy = -rad; dy <= rad; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          if (pred(yy * w + xx)) return true;
        }
      }
      return false;
    };
    const out = new Int8Array(N);                    // 0 keep, 1 hi, 2 lo, 3 tan, 4 grass
    // 1. the keyline, wherever it separates the two materials, becomes the lip
    for (let i = 0; i < N; i++) if (isDark(i) && near(i, isTan, 1)) out[i] = 1;
    // 2. the deep-green shadow immediately outside it becomes the dark olive,
    //    and so does any green that touches tan with no keyline between them
    for (let i = 0; i < N; i++) {
      if (out[i] || !isGreen(i)) continue;
      if (near(i, (j) => out[j] === 1, 1) || near(i, isTan, 1)) out[i] = 2;
    }
    // 3. two pixels either side of the seam, both ramps drop to base
    for (let i = 0; i < N; i++) {
      if (out[i]) continue;
      const seam = near(i, (j) => out[j] === 1 || out[j] === 2, 3);
      if (!seam) continue;
      if (isTan(i)) out[i] = 3;
      else if (isGreen(i)) out[i] = 4;
    }
    const COLS = [null, SKIRT_HI, SKIRT_LO, SKIRT_TAN, SKIRT_GRASS];
    for (let i = 0; i < N; i++) {
      const k = out[i]; if (!k) continue;
      const col = COLS[k];
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2];
    }
    c.putImageData(id, 0, 0);
    tiles[name] = cv;
  }
  return tiles;
}

/**
 * THIN THE ROAD, THEN CUT ONE RUT IN IT.
 *
 * The dirt tiles arrive from game/tileset.js carrying a five-row "scatter band"
 * of 1-3px dashes in the dark tan. Measured on our own village screen against
 * ALttP's cliff path with a modal-block sampler: that band is 7.2% of every
 * road pixel where ALttP's own dark tan is 1.71%. It is not texture at that
 * density, it is grain — four times too much of it — and it was the single
 * biggest line item in the tan budget.
 *
 * So: keep one dash in three (a deterministic comb, so the survivors are the
 * same every run and still land in short runs rather than singletons), then
 * stamp ONE wheel rut at the same x in both interior tiles, so it runs the
 * length of the road instead of dancing tile to tile.
 */
export function dirtGrain(ctx, name, w, h) {
  if (!/^path/.test(name)) return;
  const interior = /^path_(c|c2)$/.test(name);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i] !== 0x68 || d[i + 1] !== 0x60 || d[i + 2] !== 0x28) continue;
      // ALL of it goes on the EDGE tiles. The kerb is where the colour budget
      // was being spent: #686028 was in 100% of our boundary blocks against
      // 28% of ALttP's cliff path, and a dash of dark tan two pixels from the
      // grass line is not grain, it is a fifth tone in the one place that can
      // least afford one. The dashes survive in the road's interior, which is
      // where ALttP keeps its own.
      if (interior && (x * 5 + y * 7) % 3 === 0) continue;      // this one stays
      d[i] = 0x88; d[i + 1] = 0x80; d[i + 2] = 0x40;
    }
  }
  ctx.putImageData(id, 0, 0);
  if (!interior) return;
  const seed = name === 'path_c2' ? 1 : 0;
  ctx.fillStyle = '#686028';
  let y = 0;
  while (y < h) {
    const run = 2 + ((y * 7 + seed * 5) % 3);
    const gap = 4 + ((y * 3 + seed) % 4);
    ctx.fillRect(6, y, 1, Math.min(run, h - y));
    y += run + gap;
  }
  // The gravel catch-light is GONE. Five pixels of #a09850 per interior tile
  // put a fifth tone into 45% of every tan block on the isle for 1230 pixels
  // in nine screens — the worst colour-per-pixel rate in the tileset. The
  // road's pale tone is the kerb now (#889860), where it does work: it is the
  // transition, not a sparkle.
}

export function makeWorldTiles() {
  const defs = {};
  defs.iwall = wallTile('mid');
  defs.iwall_cap = wallTile('cap');
  defs.iwall_base = wallTile('base');
  defs.iwall_win = wallTile('win');
  defs.void = G(16, 16, '0');
  defs.floor = floorTile(0);
  defs.floor2 = floorTile(1);
  defs.floor3 = floorTile(2);
  defs.floorv = floorTileV(0);
  defs.floorv2 = floorTileV(1);
  defs.floorv3 = floorTileV(2);
  defs.deck = plankTile(0);
  defs.deck2 = plankTile(2);
  defs.deck3 = plankTile(1);
  defs.pier_n = pierTile('n', 0);
  defs.pier_n2 = pierTile('n', 2);
  defs.pier_c = plankTile(1);
  defs.pier_s = pierTile('s', 0);
  defs.pier_s2 = pierTile('s', 3);
  defs.brg_n = bridgeTile('n', 0);
  defs.brg_n2 = bridgeTile('n', 1);
  defs.brg_c = bridgeTile('c', 0);
  defs.brg_c2 = bridgeTile('c', 2);
  defs.brg_s = bridgeTile('s', 0);
  defs.brg_s2 = bridgeTile('s', 1);
  // Running bond: a vertical joint at x=0, at x=8, or none at all (a slab
  // two tiles wide). Twelve tiles is enough that the eye never finds the
  // period.
  [-1, 0, 8].forEach((jx, i) => {
    for (let d = 0; d < 4; d++) defs[`paver_${i}${d}`] = paverTile(jx, d + i * 4);
  });
  defs.plate = plateTile(0);
  defs.plate2 = plateTile(1);
  const out = {};
  for (const [k, v] of Object.entries(defs)) out[k] = makeSprite(rowsOf(v), WPAL);
  // THE COTTAGE WALL. Same coursed grid, a different material: the grey ashlar
  // ramp is swapped for lime plaster over a timber frame, so a house does not
  // have the shop's masonry and the shop does not have the mill's. Building it
  // by re-printing the SAME character grid through a second palette is the
  // whole trick — one 4bpp tile, two CGRAM rows, which is exactly how a SNES
  // would have paid for it.
  // Cream lime over a timber lattice. The body and the 'lit course' tone are
  // deliberately the SAME entry — plaster has no courses — so what survives
  // of the ashlar grid is the frame, which is what half-timbering looks
  // like. It also puts the wall a clear two value steps above the floor;
  // the first attempt used the floor's own wood ramp and the two surfaces
  // ran together across the skirting line.
  const PLASTER = { ...WPAL, r: WPAL[1], R: WPAL[1], x: WPAL[2], S: WPAL.n };
  out.iwall_p = makeSprite(rowsOf(defs.iwall), PLASTER);
  out.iwall_pcap = makeSprite(rowsOf(defs.iwall_cap), PLASTER);
  out.iwall_pbase = makeSprite(rowsOf(defs.iwall_base), PLASTER);
  out.iwall_pwin = makeSprite(rowsOf(defs.iwall_win), PLASTER);
  return out;
}

// ---------------------------------------------------------------------------
// BUILDINGS
// ---------------------------------------------------------------------------

/**
 * A Cogwick Hollow cottage: plastered wall on a stone plinth under a steep
 * copper-tile hip roof with overhanging eaves, and (usually) a boiler stack.
 * The doorway is a black arch — ALttP's doors are holes, not doors.
 */
function makeHouse(o = {}) {
  const w = o.w || 64;
  const wallH = o.wallH || 30;
  const roofH = o.roofH || 26;
  const top = o.stack ? 12 : 2;                 // headroom for the stack
  const h = top + roofH + wallH;
  const g = G(w, h + 2);
  const roofY = top;
  const wallY = top + roofH;
  const R = o.roof || ['5', '6', '7', '8'];
  const A = o.wall || ['1', '2', '3', '4'];

  // --- boiler stack (behind the roof) -------------------------------------
  if (o.stack) {
    const sx = o.stack;
    box(g, sx, 0, 7, roofY + 8, 'X');
    vspan(g, sx, 0, roofY + 8, 'Q');
    vspan(g, sx + 6, 0, roofY + 8, 'U');
    box(g, sx - 1, 0, 9, 3, 'B');
    hspan(g, sx - 1, sx + 7, 0, 'A');
    hspan(g, sx - 1, sx + 7, 2, 'z');
    for (let y = 4; y < roofY + 8; y += 5) hspan(g, sx, sx + 6, y, 'z');
  }

  // --- roof ----------------------------------------------------------------
  const topIn = Math.max(4, Math.floor(w / 2) - 8);
  for (let j = 0; j < roofH; j++) {
    const t = j / (roofH - 1);
    const inset = Math.round(topIn + (-2 - topIn) * t);
    const x0 = inset, x1 = w - 1 - inset;
    const course = Math.floor(j / 5);
    for (let x = x0; x <= x1; x++) {
      let c = R[1];
      if (j < 2) c = R[0];                                    // ridge cap
      else if (j % 5 === 0) c = R[2];                          // course line
      else if (j % 5 === 1) c = R[0];                          // sunlit tile top
      // shingle stagger
      if ((x + course * 3) % 7 === 0 && j % 5 !== 0) c = R[2];
      // right-hand fall-off
      if (x > x1 - 3) c = R[2];
      if (x < x0 + 2 && j > 3) c = R[0];
      px(g, x, roofY + j, c);
    }
    if (j >= roofH - 2) {                                      // eaves shadow
      for (let x = x0; x <= x1; x++) px(g, x, roofY + j, j === roofH - 1 ? R[3] : R[2]);
    }
  }
  // ridge highlight
  hspan(g, topIn + 1, w - 2 - topIn, roofY, R[0]);

  // --- wall ----------------------------------------------------------------
  const wx0 = 3, wx1 = w - 4;
  for (let j = 0; j < wallH; j++) {
    const y = wallY + j;
    for (let x = wx0; x <= wx1; x++) {
      let c = A[1];
      if (j < 2) c = A[3];                                    // under-eave shade
      else if (j < 4) c = A[0];
      else if (x < wx0 + 2) c = A[0];
      else if (x > wx1 - 2) c = A[2];
      if ((x * 5 + j * 7) % 23 === 0) c = A[2];               // plaster speckle
      if (j >= wallH - 5) c = j >= wallH - 4 ? A[3] : A[2];   // stone plinth
      px(g, x, y, c);
    }
    if (j === wallH - 5) hspan(g, wx0, wx1, y, A[2]);
  }
  // plinth stones
  for (let x = wx0; x <= wx1; x += 6) vspan(g, x, wallY + wallH - 4, wallY + wallH - 1, A[3]);

  // --- windows -------------------------------------------------------------
  for (const [wxp, wyp] of (o.windows || [])) {
    const x = wxp, y = wallY + wyp;
    box(g, x - 1, y - 1, 14, 12, A[3]);
    box(g, x, y, 12, 10, '9');
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 12; i++) {
        if (i + j < 6) px(g, x + i, y + j, 'K');              // glazing glint
        else if ((i * 3 + j * 5) % 11 === 0) px(g, x + i, y + j, 'u');
      }
    }
    vspan(g, x + 5, y, y + 9, A[3]);
    hspan(g, x, x + 11, y + 4, A[3]);
    hspan(g, x - 2, x + 12, y + 10, A[3]);                     // sill
    hspan(g, x - 2, x + 12, y + 11, A[2]);
  }

  // --- door ----------------------------------------------------------------
  const dw = 14;
  const dx = o.doorX !== undefined ? o.doorX : Math.round((w - dw) / 2);
  const dh = 20;
  const dy = h - dh;
  if (o.door !== false) {
    box(g, dx - 2, dy - 3, dw + 4, dh + 3, A[3]);              // stone surround
    box(g, dx - 1, dy - 2, dw + 2, dh + 2, A[2]);
    box(g, dx, dy, dw, dh, '0');
    // rounded arch head
    px(g, dx, dy, A[2]); px(g, dx + dw - 1, dy, A[2]);
    px(g, dx + 1, dy, A[3]); px(g, dx + dw - 2, dy, A[3]);
    // threshold stone
    hspan(g, dx - 2, dx + dw + 1, h - 1, A[3]);
    if (o.boarded) {
      for (let k = 0; k < 3; k++) {
        const y = dy + 3 + k * 6;
        for (let x = dx - 2; x < dx + dw + 2; x++) {
          px(g, x, y, 'N'); px(g, x, y + 1, 'n'); px(g, x, y + 2, 'm');
        }
        px(g, dx, y + 1, 'z'); px(g, dx + dw - 1, y + 1, 'z');
      }
    } else {
      // lamp over the door
      px(g, dx + Math.floor(dw / 2), dy - 4, 'A');
    }
  }

  // --- awning + hanging sign (the shop) ------------------------------------
  if (o.awning) {
    const ay = wallY + 6;
    for (let x = 1; x < w - 1; x++) {
      const c = Math.floor((x + 1) / 4) % 2 ? 'F' : '1';
      px(g, x, ay, 'k');
      px(g, x, ay + 1, c);
      px(g, x, ay + 2, c);
      px(g, x, ay + 3, c === 'F' ? '7' : '2');
      if (x % 4 === 0) px(g, x, ay + 4, 'k');
    }
    hspan(g, 1, w - 2, ay + 4, 'k');
  }
  if (o.sign) {
    const sx = o.sign;
    hspan(g, sx, sx + 9, wallY + 12, 'z');
    vspan(g, sx + 4, wallY + 12, wallY + 14, 'z');
    box(g, sx, wallY + 15, 10, 9, 'n');
    box(g, sx + 1, wallY + 16, 8, 7, 'N');
    // a heart in a jar
    box(g, sx + 3, wallY + 18, 4, 4, '@');
    px(g, sx + 3, wallY + 18, '!'); px(g, sx + 6, wallY + 18, '!');
    px(g, sx + 4, wallY + 21, '#'); px(g, sx + 5, wallY + 21, '#');
    box(g, sx + 2, wallY + 17, 6, 1, 'W');
  }

  const out = outline(g, 'k');
  contactShadow(out, 2, w - 3, h, 'b');
  return rowsOf(out);
}

/**
 * The windmill: a battered stone drum on a brass collar, its cap turned into
 * the wind.  The vanes are separate (they turn) — see makeVanes.
 */
function makeWindmillTower(w = 46, h = 82) {
  const g = G(w, h + 2);
  const cx = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const half = Math.round(9 + 10 * t);          // tapers wider toward the base
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const d = (x - cx) / half;
      let c = 'r';
      if (d < -0.55) c = 'R';
      else if (d > 0.5) c = 'x';
      if ((x * 7 + y * 5) % 17 === 0) c = 'x';
      if ((x * 3 + y * 11) % 29 === 0) c = 'R';
      px(g, x, y, c);
    }
    // masonry courses
    if (y % 7 === 0) {
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) px(g, x, y, 'S');
    }
  }
  // brass collars
  for (const y of [16, 46]) {
    const t = y / (h - 1);
    const half = Math.round(9 + 10 * t) + 1;
    for (let j = 0; j < 4; j++) {
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        px(g, x, y + j, j === 0 ? 'A' : j === 3 ? 'z' : 'B');
      }
    }
  }
  // cap: a dark copper dome over the head of the drum
  for (let j = 0; j < 12; j++) {
    const half = Math.round(11 * Math.sqrt(Math.max(0, 1 - ((11 - j) / 12) ** 2))) + 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const d = (x - cx) / (half || 1);
      px(g, x, j, d < -0.4 ? '5' : d > 0.45 ? '7' : '6');
    }
  }
  hspan(g, Math.round(cx - 13), Math.round(cx + 13), 12, '8');
  // hub boss the vanes turn on
  box(g, Math.round(cx - 3), 13, 7, 7, 'z');
  box(g, Math.round(cx - 2), 14, 5, 5, 'B');
  px(g, Math.round(cx - 1), 15, 'A');
  // door
  const dx = Math.round(cx - 6);
  box(g, dx - 1, h - 21, 14, 21, 'S');
  box(g, dx, h - 20, 12, 20, '0');
  px(g, dx + 10, h - 10, 'B');
  // little window
  box(g, Math.round(cx - 3), 30, 7, 8, 'S');
  box(g, Math.round(cx - 2), 31, 5, 6, '9');
  px(g, Math.round(cx - 2), 31, 'K'); px(g, Math.round(cx - 1), 31, 'K');
  const out = outline(g, 'k');
  contactShadow(out, 2, w - 3, h, 'b');
  return rowsOf(out);
}

/**
 * THE BOILERWORKS HATCH — the sealed way down, and the goal of the whole act.
 *
 * It shipped as a 16px lozenge with a white pip on it, from the shared props
 * sheet, and at 8x it could not be identified: it read as a dead fish behind
 * the bushes with Marla sitting on it. This is 28x20 and states, in order:
 *
 *   a squared stone kerb set into the lawn      (the tan rock ramp)
 *   an iron lid inside it, riveted round the rim (the one grey ramp)
 *   a raised brass wheel-handle across its face  (brass, the isle's machine
 *                                                 colour, so it reads as a
 *                                                 THING YOU TURN)
 *   a chain over the wheel and a padlock on it   (STORY: it is sealed, and the
 *                                                 whole first act is about
 *                                                 getting it open)
 *   two vent slots breathing at the top edge     (there is a works under it)
 *
 * Every colour is one the screen is already paying for.
 */
function makeHatch(w = 28, h = 20) {
  const g = G(w, h);
  // 1. the kerb: a chamfered stone frame set into the lawn
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
      if (dx + dy * 1.6 < 4) continue;
      px(g, x, y, y < 4 ? '3' : '4');
    }
  }
  // 2. the lid, inset in it, with a dark seam all the way round
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x), dy = Math.min(y, h - 1 - y);
      if (dx < 4 || dy < 3) continue;
      px(g, x, y, (dx === 4 || dy === 3) ? 'J' : 'I');
    }
  }
  hspan(g, 5, w - 6, 3, 'i');                       // sun on the lid's near lip
  // 3. rivets, top and bottom, so the lid reads as plate and not as a hole
  for (let x = 6; x < w - 6; x += 4) {
    px(g, x, 5, 'i'); px(g, x, 6, 'J');
    px(g, x, h - 6, 'i'); px(g, x, h - 5, 'J');
  }
  // 4. THE WHEEL. A ring with four spokes is the one shape that says "turn
  //    me", and brass is this isle's machine colour.
  const cx = (w - 1) / 2, cy = (h - 1) / 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x - cx) / 6.2, v = (y - cy) / 4.3;
      const d = Math.hypot(u, v);
      // A CLOSED KEYLINE ROUND THE WHEEL. Every other object in this frame is
      // ringed in the outline colour (the kerb, the lid, the padlock — see
      // outline() below), but the wheel was brass straight onto grey plate, so
      // its top-left and bottom-right arcs — where brass and plate are closest
      // in value — smeared into the lid. One ring of 'k' and the wheel sits ON
      // the hatch instead of in it. Costs no palette slot: 'k' is already the
      // outline every other pixel of this sprite uses.
      if (d > 1.18) continue;
      if (d > 1.06) { px(g, x, y, 'k'); continue; }
      if (d > 0.76) { px(g, x, y, (x - cx) + (y - cy) * 1.4 < -3 ? 'A' : 'B'); continue; }
      // four thin spokes and a boss
      if (d < 0.26) { px(g, x, y, 'z'); continue; }
      if (Math.abs(y - cy) < 0.6 || Math.abs(x - cx) < 1.1) px(g, x, y, 'B');
    }
  }
  // 5. the hasp and the padlock: it is SEALED, and opening it is the act
  const lx = w - 10;
  px(g, lx + 1, 4, 'z'); px(g, lx, 5, 'z'); px(g, lx + 2, 5, 'z');
  box(g, lx - 1, 6, 5, 5, 'B');
  hspan(g, lx - 1, lx + 3, 6, 'A');
  px(g, lx + 1, 8, 'z'); px(g, lx + 1, 9, 'z');
  const out = outline(g, 'k');
  contactShadow(out, 4, w - 5, h - 1, 'b');
  return rowsOf(out);
}

/**
 * FOUR SAILS ON A HUB, ONE OF THEM BROKEN.
 *
 * The old version measured a distance-to-centreline field and shaded it by
 * threshold, which gives four fat lozenges with rounded ends: a straw cross.
 * A windmill sail is not a lozenge. It is a FRAME — a brass leading spar, a
 * thinner trailing spar, and ribbed canvas stretched between them — and the
 * reading depends entirely on those two hard parallel edges.
 *
 * So every arm is rasterised in its OWN frame: `t` runs along the spar and `s`
 * across it, and the profile across `s` is authored once:
 *
 *     s = -1..0   leading spar, brass, with a catch-light every fifth pixel
 *     s =  1..cw  canvas, with a dark rib every third pixel of `t`
 *     s =  cw+1   trailing spar, dark brass
 *
 * THE BENT ONE (STORY.md: "a windmill with a bent vane") kinks at 52% out,
 * nearly a radian off true, and past the kink the canvas is gone — ribs and one
 * torn strip, with two pixels of snapped spar still pointing the way the arm
 * used to go. That stub is what makes the bend read as damage rather than as a
 * design; without it the eye takes the kink for a curve.
 */
function makeVanes(size, theta, bent = 0) {
  const g = G(size, size);
  const c = (size - 1) / 2;
  const R = size / 2 - 2;
  const big = size >= 44;
  const cw = big ? 4 : 2;                     // canvas width across the spar
  const ribEvery = big ? 3 : 5;               // a 30px wheel cannot carry a
                                              // rib every three pixels: it
                                              // stops being a blade and starts
                                              // being a ladder
  const hub = big ? 4.6 : 3.4;
  // [ox, oy, dirX, dirY, length, torn]
  const arms = [];
  const stubs = [];
  for (let i = 0; i < 4; i++) {
    const a = theta + (i * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const r0 = hub - 0.5;
    if (i === bent) {
      const L1 = R * 0.52;
      arms.push([c + ca * r0, c + sa * r0, ca, sa, L1 - r0, false]);
      const a2 = a + 0.95;                    // the kink
      arms.push([c + ca * L1, c + sa * L1, Math.cos(a2), Math.sin(a2), R * 0.44, true]);
      // the snapped end of the original spar, still pointing true
      stubs.push([c + ca * L1, c + sa * L1, ca, sa, big ? 4 : 2]);
    } else {
      arms.push([c + ca * r0, c + sa * r0, ca, sa, R - r0, false]);
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      for (const [ox, oy, dx, dy, L, torn] of arms) {
        const vx = x - ox, vy = y - oy;
        const t = vx * dx + vy * dy;
        if (t < -0.5 || t > L) continue;
        const s = -vx * dy + vy * dx;
        const si = Math.round(s), ti = Math.round(t);
        let ch = null;
        if (si >= -1 && si <= 0) ch = (ti % 5 === 0) ? 'A' : 'B';        // leading spar
        else if (si >= 1 && si <= cw) {
          if (ti % ribEvery === 0) ch = 'n';                             // rib
          else if (!torn) ch = ((ti + si) % 7 === 0) ? '2' : '1';
          else if (si === 1) ch = '2';                                   // one torn strip
        } else if (si === cw + 1) ch = 'z';                              // trailing spar
        if (ch) { px(g, x, y, ch); break; }
      }
    }
  }
  for (const [ox, oy, dx, dy, L] of stubs) {
    for (let k = 0; k <= L; k++) px(g, Math.round(ox + dx * k), Math.round(oy + dy * k), 'z');
  }
  // hub
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      if (d <= hub) px(g, x, y, d <= hub * 0.48 ? 'z' : 'B');
      if (d > hub * 0.74 && d <= hub && (x + y) % 3 === 0) px(g, x, y, 'A');
    }
  }
  return rowsOf(outline(g, 'k'));
}

/** Interlocking-gear silhouette used by the gate, the mouth and scrap heaps. */
function gearRows(size, teeth, phase, pal) {
  const g = G(size, size);
  const c = (size - 1) / 2;
  const R = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const tooth = Math.cos(teeth * (a - phase)) > 0.25;
      const rim = tooth ? R : R - 2.4;
      if (d > rim) continue;
      let ch = pal[1];
      if (d < 2.2) ch = pal[2];                 // bore
      else if (d < 3.6) ch = pal[0];            // hub
      else if (d > rim - 1.4) ch = pal[2];      // tooth shadow
      else if (dx + dy < -4) ch = pal[0];       // upper-left light
      // spokes
      const sp = Math.abs(Math.cos(3 * (a - phase)));
      if (d > 4.4 && d < rim - 2.4 && sp < 0.72) ch = pal[3] || pal[2];
      px(g, x, y, ch);
    }
  }
  return g;
}

/** The locked gear-gate: two meshed gears in an iron frame across the road. */
function makeGate(open = false) {
  const w = 48, h = 44;
  const g = G(w, h + 2);
  // frame posts
  for (const x0 of [0, w - 7]) {
    box(g, x0, 0, 7, h, 'I');
    vspan(g, x0, 0, h - 1, 'i');
    vspan(g, x0 + 6, 0, h - 1, 'J');
    for (let y = 3; y < h; y += 7) { px(g, x0 + 2, y, 'K'); px(g, x0 + 4, y, 'J'); }
    box(g, x0 - 1, 0, 9, 4, 'J');
    hspan(g, x0 - 1, x0 + 7, 0, 'i');
  }
  // lintel
  box(g, 0, 0, w, 5, 'I');
  hspan(g, 0, w - 1, 0, 'i');
  hspan(g, 0, w - 1, 4, 'J');
  for (let x = 3; x < w; x += 6) { px(g, x, 2, 'K'); px(g, x + 1, 2, 'J'); }

  if (!open) {
    // vertical bars first, so the gears read as sitting IN FRONT of the gate
    for (let x = 9; x < w - 8; x += 6) {
      for (let y = 5; y < h - 1; y++) px(g, x, y, 'J');
      for (let y = 5; y < h - 1; y++) px(g, x + 1, y, 'I');
    }
    hspan(g, 8, w - 9, Math.round(h / 2), 'I');
    // two meshed gears, each outlined on its own so the teeth interlock
    // visibly instead of fusing into one brass smear
    const gA = outline(gearRows(26, 9, 0.0, ['A', 'B', 'z', 'z']), 'k');
    const gB = outline(gearRows(24, 8, Math.PI / 8, ['B', 'z', 'k', 'k']), 'k');
    stampRows(g, rowsOf(gB), 20, 16);
    stampRows(g, rowsOf(gA), 2, 12);
  } else {
    // retracted: the gears have wound up into the lintel
    const gA = outline(gearRows(16, 8, 0.2, ['A', 'B', 'z', 'z']), 'k');
    stampRows(g, rowsOf(gA), 5, 1);
    stampRows(g, rowsOf(gA), w - 21, 1);
    for (let x = 9; x < w - 8; x += 6) { px(g, x, 5, 'J'); px(g, x, 6, 'I'); }
  }
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h, 'b');
  return rowsOf(out);
}

function stampRows(g, rws, x0, y0) {
  rws.forEach((row, j) => {
    [...row].forEach((ch, i) => { if (ch !== '.') px(g, x0 + i, y0 + j, ch); });
  });
}

/**
 * The Boilerworks mouth: a riveted brass arch bolted into the isle with a
 * stair falling away into the dark, steam bleeding from the shoulder vents.
 */
function makeMouth() {
  const w = 72, h = 56;
  const g = G(w, h + 2);
  const cx = (w - 1) / 2;
  // stone shoulders
  for (let y = 10; y < h; y++) {
    const t = (y - 10) / (h - 11);
    const half = Math.round(20 + 14 * t);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      let c = 'r';
      if (x < cx - half + 4) c = 'R';
      else if (x > cx + half - 4) c = 'x';
      if ((x * 7 + y * 5) % 19 === 0) c = 'x';
      px(g, x, y, c);
    }
    if (y % 8 === 2) {
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) px(g, x, y, 'S');
    }
  }
  // brass arch: a semicircular head on two straight jambs
  const SPRING = 28, RO = 22, RI = 18;
  const archAt = (x, y) => {
    const dx = Math.abs(x - cx);
    if (y < SPRING) {
      const d = Math.hypot(x - cx, (y - SPRING) * 1.05);
      return d <= RO && d >= RI ? 1 : d < RI ? 2 : 0;
    }
    if (dx <= RO && dx >= RI) return 1;
    return dx < RI ? 2 : 0;
  };
  for (let y = SPRING - RO; y < h - 2; y++) {
    for (let x = 0; x < w; x++) {
      const a = archAt(x, y);
      if (a === 1) px(g, x, y, x < cx - 6 ? 'A' : x > cx + 8 ? 'z' : 'B');
      else if (a === 2) px(g, x, y, '0');
    }
  }
  for (let k = 0; k < 5; k++) {
    const y = h - 6 - k * 4;
    const half = 15 - k * 2;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      px(g, x, y, 'I');
      px(g, x, y + 1, 'J');
      px(g, x, y - 1, k % 2 ? 'J' : 'i');
    }
  }
  // rivets round the arch head
  for (let a = -1.45; a <= 1.45; a += 0.20) {
    const x = Math.round(cx + Math.sin(a) * 20);
    const y = Math.round(SPRING - Math.cos(a) * 19);
    if (y < 2) continue;
    px(g, x, y, 'A'); px(g, x + 1, y, 'z');
  }
  // shoulder vents
  for (const sx of [6, w - 14]) {
    box(g, sx, 16, 8, 12, 'X');
    box(g, sx + 1, 17, 6, 10, 'Q');
    for (let y = 18; y < 27; y += 3) hspan(g, sx + 1, sx + 6, y, 'U');
    box(g, sx - 1, 14, 10, 3, 'B');
    hspan(g, sx - 1, sx + 8, 14, 'A');
  }
  const out = outline(g, 'k');
  contactShadow(out, 4, w - 5, h, 'b');
  return rowsOf(out);
}

// ---------------------------------------------------------------------------
// INTERIOR FURNITURE.
//
// A shopkeeper with nothing visible to sell is not a shop, it is a room with a
// man in it. These are the things that make an interior read: stock on
// shelves, a lit window, a rug, a stove that is doing something. All of it is
// drawn out of the same wood / brass / terracotta ramps the outside world
// uses, so an interior is the same island seen from inside.
// ---------------------------------------------------------------------------

/** A two-tier shelf unit of stock: jars, bottles, tins, a coil of belt. */
function makeShelf(w = 48) {
  const h = 30;
  const g = G(w, h + 2);
  box(g, 0, 0, w, h, 'z');                          // dark backboard
  for (let y = 1; y < h - 1; y += 3) hspan(g, 1, w - 2, y, 'm');
  const board = (y) => {
    hspan(g, 0, w - 1, y, 'N');
    hspan(g, 0, w - 1, y + 1, 'n');
    hspan(g, 0, w - 1, y + 2, 'm');
    for (let x = 2; x < w - 2; x += 9) px(g, x, y + 2, 'z');
  };
  // Stock, sat ON each board and drawn before it so the board occludes feet.
  const jar = (x, y, body, cap, fill) => {
    box(g, x, y + 2, 5, 6, body);
    px(g, x, y + 2, cap); px(g, x + 4, y + 2, cap);
    box(g, x + 1, y + 4, 3, 3, fill);
    hspan(g, x, x + 4, y + 1, cap);
    px(g, x, y + 7, 'k'); px(g, x + 4, y + 7, 'k');
  };
  const tin = (x, y) => {
    box(g, x, y + 3, 6, 5, 'I');
    hspan(g, x, x + 5, y + 3, 'K');
    hspan(g, x, x + 5, y + 7, 'J');
    px(g, x + 2, y + 5, 'B');
  };
  const bottle = (x, y) => {
    box(g, x + 1, y + 1, 2, 3, '9');
    box(g, x, y + 4, 4, 4, '9');
    px(g, x, y + 4, 'K'); px(g, x + 1, y + 1, 'K');
    hspan(g, x, x + 3, y, 'z');
  };
  for (const y0 of [4, 18]) {
    let x = 3;
    let n = 0;
    while (x < w - 7) {
      const kind = (n + (y0 >> 3)) % 4;
      if (kind === 0) jar(x, y0, 'P', 'U', '@');
      else if (kind === 1) tin(x, y0);
      else if (kind === 2) bottle(x, y0);
      else jar(x, y0, 'Q', 'z', 'l');
      x += 8 + ((n * 3) % 3);
      n++;
    }
    board(y0 + 8);
  }
  // side stiles
  vspan(g, 0, 0, h - 1, 'm'); vspan(g, w - 1, 0, h - 1, 'm');
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h, 'b');
  return rowsOf(out);
}

/** A woven rug. Flat: it goes down before anything walks on it. */
function makeRug(w = 64, h = 40) {
  const g = G(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y);
      const e = Math.min(ex / 2, ey / 1.4);
      let c = 'X';
      if (e < 1) c = 'z';
      else if (e < 2.2) c = 'B';
      else if (e < 3.5) c = 'U';
      else {
        // the field: a lozenge lattice in two reds and a brass thread
        const u = ((x * 2 + y * 3) % 14), v = ((x * 3 - y * 2 + 40) % 14);
        c = (u < 3 || v < 3) ? 'Q' : 'X';
        if (u === 6 && v === 6) c = 'B';
      }
      g[y][x] = c;
    }
  }
  // fringes on the short ends
  for (let x = 1; x < w - 1; x += 2) {
    px(g, x, 0, 'A'); px(g, x, h - 1, 'A');
  }
  return rowsOf(g);
}

/** A pot-bellied stove, lit. Its flue runs up into the wall. */
function makeStove() {
  const g = G(22, 34);
  box(g, 8, 0, 6, 12, 'J');                     // flue
  vspan(g, 8, 0, 11, 'I'); vspan(g, 13, 0, 11, 'Z');
  box(g, 6, 10, 10, 4, 'I');
  for (let y = 12; y < 30; y++) {
    const t = (y - 12) / 17;
    const half = Math.round(5 + 5 * Math.sin(Math.PI * t));
    for (let x = 11 - half; x <= 10 + half; x++) {
      const d = (x - 10.5) / half;
      px(g, x, y, d < -0.45 ? 'i' : d > 0.45 ? 'J' : 'I');
    }
  }
  box(g, 6, 18, 9, 7, 'Z');                     // firebox
  box(g, 7, 19, 7, 5, 'X');
  box(g, 8, 20, 5, 3, 'h');
  px(g, 9, 21, 'A'); px(g, 11, 22, 'A');
  hspan(g, 4, 17, 30, 'J');                     // feet
  px(g, 5, 31, 'J'); px(g, 16, 31, 'J');
  const out = outline(g, 'k');
  contactShadow(out, 4, 17, 32, 'b');
  return rowsOf(out);
}

// ---------------------------------------------------------------------------
// FURNITURE THAT MAKES A ROOM A PARTICULAR ROOM.
//
// Measured complaint: home, mill and shop were 75-80% pixel-identical, with the
// same brick band, the same rug, the same stove and the same crate / barrel /
// pot / sack vocabulary — furnished, but out of one storeroom. There was no
// bed, no table, no chair, no hearth anywhere on the isle, and the mill floor
// of a PUMP HOUSE had no millstone, no shaft and no gear train, in a game whose
// entire fiction is machines.
//
// So each room now gets its own large furniture, and — the cheaper and louder
// half of the fix — its own FLOOR: the mill is laid on the riveted plate the
// Boilerworks causeway uses, not on the same planks as the shop.
// ---------------------------------------------------------------------------

/** A bed: turned posts, straw mattress, a wool blanket with a woven stripe. */
function makeBed(w = 26, h = 40) {
  const g = G(w, h + 2);
  const r = w - 1;
  box(g, 2, 0, w - 4, 9, 'n');                       // headboard
  hspan(g, 2, r - 2, 0, 'N');
  hspan(g, 2, r - 2, 8, 'm');
  for (let x = 5; x < w - 5; x += 4) vspan(g, x, 2, 7, 'm');
  box(g, 0, 0, 3, h, 'm'); box(g, r - 2, 0, 3, h, 'm');   // posts
  vspan(g, 0, 0, h - 1, 'n'); vspan(g, r, 0, h - 1, 'z');
  for (let y = 4; y < h; y += 9) { hspan(g, 0, 2, y, 'N'); hspan(g, r - 2, r, y, 'n'); }
  box(g, 3, 9, w - 6, h - 12, '1');                  // linen
  for (let y = 10; y < h - 4; y++) {
    px(g, 3, y, '2'); px(g, w - 4, y, '2');
    if ((y * 3) % 7 === 0) px(g, w - 5, y, '2');
  }
  box(g, 4, 10, w - 8, 7, '1');                      // pillow
  hspan(g, 4, w - 5, 10, 'f'); hspan(g, 4, w - 5, 16, '2');
  box(g, 3, 18, w - 6, h - 22, 'Q');                 // the wool blanket
  hspan(g, 3, w - 4, 18, 'P');
  for (let y = 21; y < h - 5; y += 5) { hspan(g, 3, w - 4, y, 'U'); hspan(g, 3, w - 4, y + 1, 'P'); }
  hspan(g, 3, w - 4, h - 5, 'U');
  box(g, 2, h - 4, w - 4, 4, 'n');                   // footboard
  hspan(g, 2, r - 2, h - 4, 'N'); hspan(g, 2, r - 2, h - 1, 'm');
  const out = outline(g, 'k');
  contactShadow(out, 1, r - 1, h + 1, 'b');
  return rowsOf(out);
}

/** A plank table, with somebody's supper still on it. */
function makeTable(w = 34, h = 26) {
  const g = G(w, h + 2);
  const top = 13;
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < w; x++) {
      let c = (y >> 2) % 2 ? 'n' : 'N';
      if (y % 4 === 3) c = 'm';
      if ((x * 5 + y * 3) % 23 === 0) c = 'm';
      px(g, x, y, c);
    }
  }
  hspan(g, 0, w - 1, 0, 'N');
  hspan(g, 0, w - 1, top - 1, 'z');
  for (const lx of [2, w - 6]) {                     // legs
    box(g, lx, top, 4, h - top, 'm');
    vspan(g, lx, top, h - 1, 'n');
    vspan(g, lx + 3, top, h - 1, 'z');
  }
  box(g, w - 13, 2, 6, 5, 'i');                      // a plate
  box(g, w - 12, 3, 4, 3, 'K');
  box(g, 6, 1, 4, 8, 'z');                           // a brass candlestick
  box(g, 7, 2, 2, 6, 'B'); px(g, 7, 2, 'A');
  px(g, 8, 0, 'h'); px(g, 7, 0, 'f');
  box(g, 14, 4, 5, 4, 'Q'); px(g, 15, 4, 'P');       // a clay cup
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h + 1, 'b');
  return rowsOf(out);
}

/** A ladder-back chair. */
function makeChair(w = 13, h = 22) {
  const g = G(w, h + 2);
  vspan(g, 1, 0, 13, 'n'); vspan(g, 2, 0, 13, 'm');
  vspan(g, w - 3, 0, 13, 'n'); vspan(g, w - 2, 0, 13, 'z');
  for (const y of [1, 5, 9]) { hspan(g, 1, w - 2, y, 'N'); hspan(g, 1, w - 2, y + 1, 'm'); }
  box(g, 0, 13, w, 4, 'n');                          // seat
  hspan(g, 0, w - 1, 13, 'N'); hspan(g, 0, w - 1, 16, 'z');
  box(g, 1, 17, 2, h - 17, 'm'); box(g, w - 3, 17, 2, h - 17, 'm');
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h + 1, 'b');
  return rowsOf(out);
}

/** A stone hearth with a fire in it, and a mantel to put things on. */
function makeHearth(w = 36, h = 34) {
  const g = G(w, h + 2);
  // Coursed rubble, laid in a running bond: the vertical joints stagger course
  // to course, which is what stops a stack of horizontal bands reading as a
  // radiator (it did, measurably, in the first cut of this sprite).
  for (let y = 4; y < h; y++) {
    const course = Math.floor((y - 4) / 6);
    for (let x = 0; x < w; x++) {
      let c = 'r';
      if ((y - 4) % 6 < 1) c = 'R';                       // block crown
      else if ((y - 4) % 6 > 4) c = 'x';                  // its shaded base
      if ((x * 7 + y * 5) % 17 === 0) c = 'x';
      if ((x * 3 + y * 13) % 23 === 0) c = 'R';
      px(g, x, y, c);
      if ((x + course * 5) % 11 === 0) px(g, x, y, 'S');  // the staggered joint
    }
    if ((y - 4) % 6 === 0) hspan(g, 0, w - 1, y, 'S');
  }
  box(g, 1, 0, w - 2, 5, 'n');                       // the mantel
  hspan(g, 1, w - 2, 0, 'N'); hspan(g, 1, w - 2, 4, 'z');
  hspan(g, 0, w - 1, 5, 'k');
  // the firebox: a round arch, so it is plainly a fireplace and not a doorway
  const cx = (w - 1) / 2, fy = 12, fw = 11;
  for (let y = fy; y < h - 2; y++) {
    for (let x = Math.round(cx - fw); x <= Math.round(cx + fw); x++) {
      const ay = fy + fw;
      if (y < ay && Math.hypot(x - cx, (y - ay) * 1.15) > fw) continue;
      px(g, x, y, '0');
    }
  }
  // fire: three tones and a white core, on the same ramp the stove uses
  for (let i = 0; i < 22; i++) {
    const x = Math.round(cx - 8 + (i * 5) % 17);
    const tall = 3 + ((i * 7) % 6);
    for (let j = 0; j < tall; j++) {
      const y = h - 4 - j;
      px(g, x, y, j > tall - 2 ? 'h' : 'F');
    }
  }
  hspan(g, Math.round(cx - 8), Math.round(cx + 8), h - 3, 'h');
  hspan(g, Math.round(cx - 5), Math.round(cx + 5), h - 4, 'A');
  for (let x = Math.round(cx - 9); x <= Math.round(cx + 9); x += 3) px(g, x, h - 3, 'X');
  // a kettle on the fire-dog, brass, because this is that kind of house
  box(g, Math.round(cx + 4), h - 12, 7, 6, 'z');
  box(g, Math.round(cx + 5), h - 11, 5, 4, 'B');
  px(g, Math.round(cx + 6), h - 11, 'A');
  px(g, Math.round(cx + 4), h - 13, 'B'); px(g, Math.round(cx + 8), h - 13, 'B');
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h + 1, 'b');
  return rowsOf(out);
}

/** A dresser: two panelled doors, brass handles, crockery on the top. */
function makeDresser(w = 24, h = 34) {
  const g = G(w, h + 2);
  box(g, 0, 4, w, h - 4, 'n');
  hspan(g, 0, w - 1, 4, 'N'); hspan(g, 0, w - 1, 5, 'N');
  vspan(g, 0, 4, h - 1, 'N'); vspan(g, w - 1, 4, h - 1, 'z');
  hspan(g, 0, w - 1, h - 1, 'm');
  const half = (w - 5) >> 1;
  for (const dx of [2, 3 + half]) {
    box(g, dx, 8, half, h - 12, 'm');
    box(g, dx + 1, 9, half - 2, h - 14, 'n');
    hspan(g, dx + 1, dx + half - 2, 9, 'N');
  }
  px(g, 2 + half - 2, h >> 1, 'B'); px(g, 4 + half, h >> 1, 'B');
  px(g, 2 + half - 2, (h >> 1) + 1, 'z'); px(g, 4 + half, (h >> 1) + 1, 'z');
  // plates stood on edge along the top
  for (const cx of [5, 12, 19]) {
    for (let y = 0; y < 4; y++) {
      const half2 = Math.round(3 * Math.sqrt(Math.max(0, 1 - ((3 - y) / 4) ** 2)));
      for (let x = cx - half2; x <= cx + half2; x++) px(g, x, y, x < cx ? 'i' : 'I');
    }
  }
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h + 1, 'b');
  return rowsOf(out);
}

/** The millstone in its wooden tun, with the spindle coming up through it. */
function makeMillstone(w = 36, h = 34) {
  const g = G(w, h + 2);
  const cx = (w - 1) / 2, cy = 16, rx = 16, ry = 12;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d > 1.0) continue;
      // Warm grit, on the ISLAND'S rock ramp — not the grey stone ramp, which
      // on this floor is the same #8e968e as the riveted plate it sits on and
      // made the stone vanish into the deck.
      let c = 'D';
      if (d > 0.86) c = 'C';                                 // the tun's rim shadow
      else if (y - cy < -(ry * 0.45)) c = 'E';               // sunlit face
      if ((x * 5 + y * 7) % 23 === 0) c = 'C';
      if ((x * 3 + y * 11) % 31 === 0) c = 'E';
      px(g, x, y, c);
    }
  }
  // The dressing furrows: short grooves cut OUTWARD from the eye, stopping
  // well short of the rim. Run them the whole radius and the stone stops being
  // a stone and becomes a cartwheel — which is exactly what the first cut of
  // this sprite drew.
  for (let a = 0; a < 6; a++) {
    const th = a * Math.PI / 3 + 0.35;
    for (let t = 5; t < 11; t++) {
      const fx = Math.round(cx + Math.cos(th) * t * 1.05);
      const fy = Math.round(cy + Math.sin(th) * t * 0.78);
      px(g, fx, fy, 'M');
      px(g, fx, fy + 1, 'E');
    }
  }
  // wooden tun round the stone
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / (rx + 2), (y - cy) / (ry + 2));
      if (d > 1.0 || at(g, x, y) !== '.') continue;
      px(g, x, y, y < cy ? 'N' : (y > cy + ry * 0.6 ? 'm' : 'n'));
    }
  }
  // brass hoop and the iron spindle out of the eye
  for (let x = 0; x < w; x++) {
    const d = Math.abs((x - cx) / (rx + 1));
    if (d > 1) continue;
    const yy = Math.round(cy + (ry + 1) * Math.sqrt(Math.max(0, 1 - d * d)));
    px(g, x, yy, 'B'); px(g, x, yy - 1, 'z');
  }
  box(g, Math.round(cx - 3), cy - 4, 7, 8, 'J');
  box(g, Math.round(cx - 2), cy - 3, 5, 6, '0');
  box(g, Math.round(cx - 1), cy - 12, 3, 10, 'I');
  vspan(g, Math.round(cx - 1), cy - 12, cy - 3, 'i');
  // flour dust round the foot
  for (let x = 3; x < w - 3; x += 2) px(g, x, h - 1, (x >> 1) % 2 ? '1' : 'f');
  const out = outline(g, 'k');
  contactShadow(out, 2, w - 3, h + 1, 'b');
  return rowsOf(out);
}

/** The gear train off the pump shaft: three meshed wheels on brass bearings. */
function makeGearTrain(w = 50, h = 30) {
  const g = G(w, h + 2);
  box(g, 0, 4, w, 5, 'J');                                  // the bearing rail
  hspan(g, 0, w - 1, 4, 'I'); hspan(g, 0, w - 1, 8, 'k');
  for (let x = 3; x < w; x += 7) { px(g, x, 6, 'K'); px(g, x + 1, 6, 'J'); }
  const wheels = [[22, 11, 2, 0.0], [17, 8, 21, 0.35], [20, 10, 34, 0.7]];
  for (const [size, teeth, x0, ph] of wheels) {
    const gr = outline(gearRows(size, teeth, ph, ['A', 'B', 'z', 'z']), 'k');
    stampRows(g, rowsOf(gr), x0, 9);
  }
  box(g, 0, h - 5, w, 5, 'J');                              // the bedplate
  hspan(g, 0, w - 1, h - 5, 'I');
  for (let x = 2; x < w; x += 9) { px(g, x, h - 3, 'K'); px(g, x + 1, h - 3, 'J'); }
  const out = outline(g, 'k');
  contactShadow(out, 1, w - 2, h + 1, 'b');
  return rowsOf(out);
}

/** The hopper over the stone: a plank funnel on a brass chute. */
function makeHopper(w = 22, h = 30) {
  const g = G(w, h + 2);
  for (let y = 0; y < h - 8; y++) {
    const t = y / (h - 9);
    const half = Math.round((w / 2 - 1) * (1 - 0.62 * t));
    for (let x = Math.round(w / 2 - half); x <= Math.round(w / 2 + half - 1); x++) {
      let c = 'n';
      if (x < w / 2 - half + 3) c = 'N';
      else if (x > w / 2 + half - 4) c = 'm';
      if ((x + y * 3) % 9 === 0) c = 'm';
      px(g, x, y, c);
    }
  }
  hspan(g, 1, w - 2, 0, 'N');
  hspan(g, 2, w - 3, 1, 'z');
  box(g, 3, 2, w - 6, 3, '1');                               // grain in the top
  for (let y = 3; y < h - 10; y += 6) {                       // iron straps
    hspan(g, Math.round(w / 2 - 8), Math.round(w / 2 + 7), y, 'J');
  }
  box(g, Math.round(w / 2 - 3), h - 9, 6, 9, 'z');            // the brass chute
  box(g, Math.round(w / 2 - 2), h - 8, 4, 7, 'B');
  px(g, Math.round(w / 2 - 2), h - 8, 'A');
  return rowsOf(outline(g, 'k'));
}

/** A rack of the shop's stock: jars on two brass rails. */
function makeJarRack(w = 40, h = 30) {
  const g = G(w, h + 2);
  for (const y of [12, h - 2]) {
    hspan(g, 0, w - 1, y, 'A'); hspan(g, 0, w - 1, y + 1, 'B');
    hspan(g, 0, w - 1, y + 2, 'z');
  }
  vspan(g, 0, 0, h + 1, 'B'); vspan(g, w - 1, 0, h + 1, 'z');
  const jar = (x0, y0, tone, cap) => {
    box(g, x0, y0, 8, 10, tone);
    hspan(g, x0, x0 + 7, y0, cap);
    vspan(g, x0, y0, y0 + 9, cap);
    hspan(g, x0 + 1, x0 + 6, y0 - 1, 'z');
    hspan(g, x0 + 2, x0 + 5, y0 - 2, 'B');
    px(g, x0 + 1, y0 + 2, 'f');
  };
  jar(3, 2, '@', '!'); jar(13, 2, 'h', 'A'); jar(23, 2, 'V', 'i'); jar(31, 3, '9', 'u');
  jar(4, 15, 'h', 'A'); jar(15, 15, '@', '!'); jar(26, 15, '1', 'f');
  return rowsOf(outline(g, 'k'));
}

/** A brass lantern on a chain. Hangs above head height; drawn flat. */
function makeLamp() {
  const g = G(12, 26);
  for (let y = 0; y < 8; y++) px(g, 6, y, y % 2 ? 'z' : 'B');
  box(g, 3, 8, 6, 3, 'B');
  hspan(g, 3, 8, 8, 'A');
  box(g, 2, 11, 8, 9, 'h');
  box(g, 3, 12, 6, 7, 'f');
  vspan(g, 2, 11, 19, 'B'); vspan(g, 9, 11, 19, 'z');
  hspan(g, 2, 9, 20, 'B');
  hspan(g, 3, 8, 21, 'z');
  return rowsOf(outline(g, 'k'));
}

/**
 * The pool of daylight a window throws on the plank floor. Dithered, two
 * steps up the wood ramp, sheared like a real cast rectangle.
 */
function makeLightPool(w = 34, h = 30) {
  const g = G(w, h);
  for (let y = 0; y < h; y++) {
    const x0 = Math.round(y * 0.45), x1 = x0 + w - 12;
    for (let x = x0; x <= x1 && x < w; x++) {
      const edge = x < x0 + 3 || x > x1 - 3 || y < 3 || y > h - 4;
      if (edge && (x + y) % 2) continue;
      g[y][x] = (x + y) % 5 === 0 ? '1' : 'N';
    }
  }
  return rowsOf(g);
}

/** A sack of something, slumped. */
const SACK_ROWS = [
  '................',
  '.....kkkkk......',
  '....k%%^%%k.....',
  '...k%^^^^%%k....',
  '..k1^^^^^^1k....',
  '..k11^^^^11k....',
  '.k111^^^^111k...',
  '.k1111^^1111k...',
  '.k11111111111k..',
  'k1111111111111k.',
  'k12111111111121k',
  'k12211111112221k',
  'k12222111222221k',
  '.k2222222222k...',
  '..kkkkkkkkkk....',
  '..bb.bb.bb.bb...',
];

/** A moored sky-skiff: gasbag, gondola, prop, mooring line. */
function makeSkiff() {
  const w = 56, h = 44;
  const g = G(w, h);
  // envelope
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - 26) / 25, dy = (y - 12) / 12;
      if (dx * dx + dy * dy > 1) continue;
      let c = 'N';
      if (y < 6) c = '1';
      else if (y > 16) c = 'm';
      if (x > 40) c = y < 10 ? 'N' : 'm';
      if ((x + y) % 9 === 0 && y > 6 && y < 17) c = 'n';
      px(g, x, y, c);
    }
  }
  // envelope bands + teal blazon
  for (const bx of [10, 26, 40]) vspan(g, bx, 1, 21, 'z');
  box(g, 20, 8, 10, 7, 'V');
  box(g, 22, 10, 6, 3, 'A');
  // fins
  box(g, 48, 4, 7, 3, 'm'); box(g, 48, 16, 7, 3, 'm');
  // gondola
  box(g, 12, 24, 30, 12, 'n');
  hspan(g, 12, 41, 24, 'N');
  hspan(g, 12, 41, 35, 'm');
  for (let x = 14; x < 40; x += 5) { px(g, x, 27, 'z'); px(g, x, 32, 'z'); }
  box(g, 16, 27, 7, 5, '9'); box(g, 27, 27, 7, 5, '9');
  px(g, 16, 27, 'K'); px(g, 27, 27, 'K');
  // rigging
  for (const x of [14, 22, 32, 40]) vspan(g, x, 20, 24, '&');
  // propeller at the stern
  vspan(g, 44, 26, 34, 'z');
  box(g, 42, 29, 5, 3, 'B');
  for (let y = 22; y < 39; y++) px(g, 46 + ((y % 2) ? 1 : 0), y, 'i');
  // mooring line dropping to the deck
  for (let y = 36; y < h; y++) px(g, 12 - Math.floor((y - 36) / 3), y, '%');
  return rowsOf(outline(g, 'k'));
}

// ---------------------------------------------------------------------------
// SMALL PROPS
// ---------------------------------------------------------------------------

const SPRITE_ROWS = {};

SPRITE_ROWS.chest = [
  '................',
  '...kkkkkkkkkk...',
  '..kAAAAAAAAAAk..',
  '.kABBBBBBBBBBAk.',
  '.kABzzzzzzzzBAk.',
  '.kABzAAAAAAzBAk.',
  '.kkkkkkkkkkkkkk.',
  '.knNNNNNNNNNNnk.',
  '.knNnnnnnnnnNnk.',
  '.knNnzzzzzznNnk.',
  '.knNnzAAAAznNnk.',
  '.knNnzzzzzznNnk.',
  '.knNnnnnnnnnNnk.',
  '.kmmmmmmmmmmmmk.',
  '..kkkkkkkkkkkk..',
  '..bb.bb.bb.bb...',
];

SPRITE_ROWS.chest_open = [
  '...kkkkkkkkkk...',
  '..kzzzzzzzzzzk..',
  '..kz00000000zk..',
  '..kz00000000zk..',
  '.kAAAAAAAAAAAAk.',
  '.kABBBBBBBBBBAk.',
  '.kkkkkkkkkkkkkk.',
  '.knN00000000Nnk.',
  '.knN00000000Nnk.',
  '.knNnnnnnnnnNnk.',
  '.knNnzzzzzznNnk.',
  '.knNnzAAAAznNnk.',
  '.knNnnnnnnnnNnk.',
  '.kmmmmmmmmmmmmk.',
  '..kkkkkkkkkkkk..',
  '..bb.bb.bb.bb...',
];

// Fired-clay jar: wide lip, pinched neck, swollen belly, foot ring. The
// highlight sits upper-left and the shadow falls to the lower-right, matching
// the light direction every other prop on the isle uses.
SPRITE_ROWS.pot = [
  '................',
  '....kkkkkkkk....',
  '...kPPQQQQQUk...',
  '...kQQQQQQQUk...',
  '...kkQQQQQQkk...',
  '..kPPQQQQQQUUk..',
  '.kPPQQQQQQQQUUk.',
  '.kPQQQQQQQQQUUk.',
  'kPPQQQQQQQQQQUUk',
  'kPQQQQQQQQQQQUUk',
  'kPQQQQQQQQQQQUUk',
  '.kQQQQQQQQQQUUk.',
  '.kQQQQQQQQQUUUk.',
  '..kkQQQQQQQUkk..',
  '....kkkkkkkk....',
  '..bb.bb.bb.bb...',
];

SPRITE_ROWS.crate = [
  '................',
  '.kkkkkkkkkkkkkk.',
  '.kNNNNNNNNNNNNk.',
  '.kNnnnnnnnnnnNk.',
  '.kNnNnmmmmnNnNk.',
  '.kNnmNnmmnNmnNk.',
  '.kNnmmNnnNmmnNk.',
  '.kNnmmmNNmmmnNk.',
  '.kNnmmNnnNmmnNk.',
  '.kNnmNnmmnNmnNk.',
  '.kNnNnmmmmnNnNk.',
  '.kNnnnnnnnnnnNk.',
  '.kNNNNNNNNNNNNk.',
  '.kmmmmmmmmmmmmk.',
  '.kkkkkkkkkkkkkk.',
  '..bb.bb.bb.bb...',
];

SPRITE_ROWS.barrel = [
  '................',
  '...kkkkkkkkkk...',
  '..kNNNNNNNNNNk..',
  '..kNnnnnnnnnNk..',
  '.kzzzzzzzzzzzzk.',
  '.kBAAAAAAAAAABk.',
  '.kzzzzzzzzzzzzk.',
  '.kNnnnnnnnnnnNk.',
  '.kNnmnnnnnnmnNk.',
  '.kNnmnnnnnnmnNk.',
  '.kzzzzzzzzzzzzk.',
  '.kBAAAAAAAAAABk.',
  '.kzzzzzzzzzzzzk.',
  '..kNnnnnnnnnNk..',
  '...kkkkkkkkkk...',
  '..bb.bb.bb.bb...',
];

SPRITE_ROWS.bollard = [
  '................',
  '................',
  '.....kkkkk......',
  '....kIiiiIk.....',
  '....kIiiiIk.....',
  '....kJIIIJk.....',
  '.%%%%kIiIk%%%%..',
  '%^^^&kIiIk&^^^%.',
  '.&&&&kIiIk&&&&..',
  '.....kIiIk......',
  '....kJIIIJk.....',
  '....kJIIIJk.....',
  '...kJJIIIJJk....',
  '...kkkkkkkkk....',
  '..bb.bb.bb......',
  '................',
];

// Fascia boards: the edge of a deck, with the joist ends showing under it.
SPRITE_ROWS.kerb_h = [
  'kkkkkkkkkkkkkkkk',
  'kNNNNNNNNNNNNNNk',
  'knnnnnnnnnnnnnnk',
  'kmzmmzmmzmmzmmmk',
  'kkkkkkkkkkkkkkkk',
];

SPRITE_ROWS.kerb_v = [
  'kkkkk',
  'kNnmk',
  'kNnmk',
  'kNnzk',
  'kNnmk',
  'kNnmk',
  'kNnzk',
  'kNnmk',
  'kNnmk',
  'kNnzk',
  'kNnmk',
  'kNnmk',
  'kNnzk',
  'kNnmk',
  'kNnmk',
  'kkkkk',
];

// Shop counter: a plank top on a boarded front, brass-edged.
SPRITE_ROWS.counter = [
  'kkkkkkkkkkkkkkkk',
  'kAAAAAAAAAAAAAAk',
  'kNNNNNNNNNNNNNNk',
  'knnnnnnnnnnnnnnk',
  'kzzzzzzzzzzzzzzk',
  'kNnmNnmNnmNnmNnk',
  'knmNnmNnmNnmNnmk',
  'kNnmNnmNnmNnmNnk',
  'knmNnmNnmNnmNnmk',
  'kNnmNnmNnmNnmNnk',
  'knmNnmNnmNnmNnmk',
  'kzzzzzzzzzzzzzzk',
  'kmmmmmmmmmmmmmmk',
  'kkkkkkkkkkkkkkkk',
  '.bb.bb.bb.bb.bb.',
  '................',
];

SPRITE_ROWS.rope_coil = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....k%%%%k......',
  '..k%^^%%^^%k....',
  '.k%^&&%%&&^%k...',
  '.k%^%k..k%^%k...',
  '.k%^&&%%&&^%k...',
  '..k%^^%%^^%k....',
  '....kk%%kk......',
  '...bb.bb.bb.....',
  '................',
  '................',
];

SPRITE_ROWS.heart_piece = [
  '................',
  '.....f....f.....',
  '..f..kkkkkk..f..',
  '....k!!@@!!k....',
  '...k!!@@@@!!k...',
  '..k!!@@@@@@!!k..',
  '..k!@@@@@@@@!k..',
  'f.k@@@@@@@@@@k.f',
  '..k@@@#@@#@@@k..',
  '..k#@@###@@#k...',
  '...k#@@#@@#k....',
  '....k#@@@#k.....',
  '.....k#@#k......',
  '..f...k#k....f..',
  '.......k........',
  '..bb.bb.bb......',
];

// A LESSER ISLE, seen a long way down. Nothing else on the screen makes the
// point as fast: an object with grass on top and rock underneath, hanging in
// the middle of the blue, cannot be read as anything floating on water.
// Drawn small and in the darkest end of the rock and leaf ramps, because
// distance takes value and chroma before it takes detail.
SPRITE_ROWS.islet_far = [
  '.........dddddd.........',
  '.......bddddddddb.......',
  '.....kbdddddddddddbk....',
  '....kcccccccccccccck....',
  '....kcsccccssccccsck....',
  '.....ksscccsscccssk.....',
  '......kssssssssssk......',
  '.......kSsssssSsk.......',
  '........kSsssSk.........',
  '.........kSssk..........',
  '..........kSk...........',
  '...........k............',
];

// THE SCALE LADDER. A two-mile drop needs more than one object in it: one
// islet at one size is a decal, three at 24 / 16 / 10 pixels wide — each hazed
// harder than the last, so size and contrast fall off together — is a distance.
// Every sky-facing screen now carries three to five of these.
SPRITE_ROWS.islet_mid = [
  '.....dddddd.....',
  '...bdddddddddb..',
  '..kcccccccccck..',
  '..kcsccccsccck..',
  '...ksssssssk....',
  '....kSsssSk.....',
  '......kSsk......',
  '.......kk.......',
];

SPRITE_ROWS.islet_tiny = [
  '...dddd...',
  '.kddddddk.',
  '.kcccccck.',
  '..ksssssk.',
  '...kSssk..',
  '....kkk...',
];

// A hauler on the shipping lane, four islands over. Two tones and eleven
// pixels of it: any more and it stops being far away.
SPRITE_ROWS.skiff_far = [
  '..kkkkkk..',
  '.kSSssSSk.',
  'kSssssssSk',
  '.kSssssSk.',
  '..kkSSkk..',
  '....kk....',
  '...kSSk...',
  '....kk....',
];

SPRITE_ROWS.skiff_tiny = [
  '.kkkk.',
  'kSssSk',
  '.kSSk.',
  '..kk..',
];

SPRITE_ROWS.cog_drop = [
  '..kkkk..',
  '.kABBAk.',
  'kABzzBAk',
  'kBzkkzBk',
  'kBzkkzBk',
  'kABzzBAk',
  '.kABBAk.',
  '..kkkk..',
];

SPRITE_ROWS.heart_drop = [
  '.kk..kk.',
  'k!!kk!!k',
  'k!@@@@!k',
  'k@@@@@@k',
  '.k@@@@k.',
  '..k@@k..',
  '...kk...',
  '........',
];

SPRITE_ROWS.key_item = [
  '................',
  '.....kkkk.......',
  '....kAAAAk......',
  '...kABzzBAk.....',
  '...kAz..zAk.....',
  '...kAz..zAk.....',
  '...kABzzBAk.....',
  '....kABBAk......',
  '.....kBBk.......',
  '.....kBBk.......',
  '.....kABk.......',
  '.....kBBkkk.....',
  '.....kABBBk.....',
  '.....kBkkkk.....',
  '.....kABBk......',
  '.....kkkk.......',
];

// Leaf burst when a bush is cut — four frames, spreading and thinning.
function leafFrames() {
  const out = [];
  const pts = [
    [8, 8], [4, 6], [12, 6], [6, 11], [11, 11], [2, 9], [14, 9], [8, 3], [8, 13],
  ];
  for (let f = 0; f < 4; f++) {
    const g = G(16, 16);
    const spread = 1 + f * 0.8;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const x = Math.round(8 + (x0 - 8) * spread);
      const y = Math.round(8 + (y0 - 8) * spread) + f;
      const c = f < 2 ? 'L' : f < 3 ? 'l' : 'j';
      px(g, x, y, c);
      if (f < 3) { px(g, x + 1, y, c); px(g, x, y + 1, 'j'); }
    }
    out.push(rowsOf(g));
  }
  return out;
}

// ---------------------------------------------------------------------------
// SCRUB THAT MERGES.
//
// Measured complaint: inside a vegetation mass, ALttP's Kakariko hedges show
// 1.1-1.8 px of base grass between neighbouring bushes. Ours showed 3.5-7.5 —
// because every bush was one lozenge centred in its cell with its own outline
// on all four sides, so thirty-six of them read as wallpaper instead of as one
// thicket. (The grid was NOT the problem: ALttP's bushes are grid-snapped too.)
//
// So a bush is no longer one sprite. It is sixteen: one per combination of
// which SIDES have another bush against them. A closed side gets the scalloped
// rim, the dark keyline and — at the bottom — the contact shadow. An OPEN side
// runs the leaf flat to the tile border with no rim at all, so it fuses with
// whatever is next to it. A run of five therefore has ONE lit crown along its
// top, ONE dark base line under it, and no interior seams: a single silhouette,
// which is what a hedge is.
// ---------------------------------------------------------------------------
const BUSH_WOB = [0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1];

function makeBushTile(mask, seed) {
  const openN = mask & 1, openE = mask & 2, openS = mask & 4, openW = mask & 8;
  const w = (i, s) => BUSH_WOB[(i + s) & 15];
  const topIn = (x) => 1 + w(x, seed) + w(x * 3, seed + 6);   // 1..3
  const botIn = (x) => 3 + w(x, seed * 3 + 5);                // 3..4 (room for the shadow)
  const lftIn = (y) => w(y, seed * 5 + 2) + w(y * 3, seed);   // 0..2
  const rgtIn = (y) => w(y, seed * 7 + 9) + w(y * 3, seed + 4);
  const g = G(16, 16, '.');
  const leaf = (x, y) => {
    if (x < 0 || x > 15 || y < 0 || y > 15) return false;
    const t = openN ? -1 : topIn(x);
    const b = openS ? 16 : 15 - botIn(x);
    const l = openW ? -1 : lftIn(y);
    const r = openE ? 16 : 15 - rgtIn(y);
    if (y < t || y > b || x < l || x > r) return false;
    // round only the CLOSED corners — an open corner has to stay square or
    // the run develops a pinhole of grass at every junction
    if (!openN && !openW && x + y < 3) return false;
    if (!openN && !openE && (15 - x) + y < 3) return false;
    if (!openS && !openW && x + (15 - y) < 5) return false;
    if (!openS && !openE && (15 - x) + (15 - y) < 5) return false;
    return true;
  };
  // A neighbouring tile supplies leaf across an open edge, so the crown and
  // base logic has to treat "off this tile, on an open side" as still leafy.
  const solid = (x, y) => {
    if (y < 0) return !!openN;
    if (y > 15) return !!openS;
    if (x < 0) return !!openW;
    if (x > 15) return !!openE;
    return leaf(x, y);
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!leaf(x, y)) continue;
      // Interior: leaf CLUMPS. Two overlapping low-period hashes make lobes
      // of body green separated by dark seams, which is what a bush is; a
      // single modulus makes diagonal corduroy, which is what the first cut
      // of this function made.
      const lobe = ((x + 2 * (y & 1)) >> 2) * 5 + (y >> 2) * 3 + seed;
      const h = (x * 5 + y * 7 + seed * 11) % 23;
      let c = (lobe % 3 === 1) ? 'd' : 'l';
      if (h < 3) c = 'b';
      else if (h > 20 && x + y < 12) c = 'H';        // sunward speckle, sparse
      if (!solid(x, y + 1)) c = 'b';                 // the dark base line
      else if (!solid(x, y + 2)) c = 'd';
      if (!solid(x, y - 1)) c = 'H';                 // the lit crown, 1px
      if (!solid(x - 1, y) && !openW) c = y < 6 ? 'H' : 'd';
      if (!solid(x + 1, y) && !openE) c = y > 3 ? 'd' : 'l';
      g[y][x] = c;
    }
  }
  // keyline on the closed sides only
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (g[y][x] !== '.') continue;
      let near = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (leaf(x + dx, y + dy)) { near = true; break; }
      }
      if (near) g[y][x] = '~';
    }
  }
  if (!openS) {
    // the ground shadow, dithered like every other contact shadow on the isle
    for (let x = 2; x < 14; x++) {
      const base = 15 - botIn(x);
      for (let j = 2; j <= 3; j++) {
        const yy = base + j;
        if (yy > 15 || g[yy][x] !== '.') continue;
        if ((x + yy + seed) % 2 === 0) g[yy][x] = 'b';
      }
    }
  }
  return rowsOf(g);
}

/**
 * SCRAP THAT LOOKS LIKE SCRAP.
 *
 * The first pass drew a grey lump, a grey cone and a white striped stack —
 * read, correctly, as a rock, a rock and a radiator, on the one screen the
 * fiction calls a tip. There was no rust, no brass, no verdigris and no broken
 * MACHINE anywhere in the silhouette, so the authored intent in the map data
 * ("the ridge of junk that halves the field") never survived into the image.
 *
 * Three pieces of dead machinery, each with a silhouette you can name from
 * across the screen, all drawn out of the same rust ramp (the terracotta /
 * copper-roof family, #e08850 -> #b85830 -> #8a3a1c) plus the iron greys, the
 * brass ramp and one verdigris weep. No new colours.
 */
function scrapRows(kind) {
  const g = G(16, 16);
  if (kind === 0) {
    // A BURST BOILER DRUM on its side: a horizontal capsule with the riveted
    // end plate toward you and the seam torn open along the shoulder.
    for (let y = 3; y <= 12; y++) {
      for (let x = 1; x <= 14; x++) {
        const cy = 7.5;
        const inside = x < 5 ? Math.hypot(x - 5, y - cy) <= 4.6
          : x > 10 ? Math.hypot(x - 10, y - cy) <= 4.6
            : Math.abs(y - cy) <= 4.6;
        if (!inside) continue;
        let c = 'Q';                                   // rust body
        if (y <= 4) c = 'P';                           // catch-light along the top
        else if (y >= 11) c = 'X';                     // shadowed belly
        if ((x * 3 + y * 7) % 11 === 0) c = 'X';       // pitting
        if (x <= 6) {                                  // the end plate
          c = y <= 4 || y >= 11 ? 'I' : 'i';
          if (x === 6) c = 'J';
        }
        px(g, x, y, c);
      }
    }
    // the end plate: a ring of rivets round a dished centre, so it reads as a
    // machined face rather than as a grey half-circle
    for (const [x, y] of [[3, 4], [5, 5], [5, 10], [3, 11], [2, 6], [2, 9]]) {
      px(g, x, y, 'K'); px(g, x, y + 1, 'J');
    }
    box(g, 3, 6, 3, 4, 'J'); box(g, 3, 6, 2, 3, 'I');
    // the tear: a ragged split with the steel curled back off both lips
    for (const [x, y0, y1] of [[10, 4, 6], [11, 4, 8], [12, 5, 7]]) {
      vspan(g, x, y0, y1, '0');
    }
    px(g, 9, 4, 'K'); px(g, 9, 5, 'i'); px(g, 13, 6, 'P'); px(g, 12, 8, 'K');
    // brass drain cock under the belly, long gone green
    px(g, 7, 12, 'z'); px(g, 8, 12, 'B'); px(g, 8, 13, 'z'); px(g, 7, 13, 'V');
  } else if (kind === 1) {
    // A FLYWHEEL off the pumps, stood on edge where it rolled to a stop. A
    // RING with four spokes and open sky between them — the hole through the
    // middle is the whole reason this reads as a machine and not a boulder.
    const cx = 7.5, cy = 8.0, R = 7.2;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - cx, dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        let c = null;
        if (d > R - 2.0) c = (dx + dy < -4 ? 'Q' : (dx + dy > 5 ? 'U' : 'X'));  // rim
        else if (d <= 2.2) c = d <= 1.1 ? 'A' : 'B';                            // brass hub
        else if (Math.abs(dx) <= 0.6 || Math.abs(dy) <= 0.6) c = dx + dy < 0 ? 'Q' : 'U';
        if (c) px(g, x, y, c);
      }
    }
    // two teeth bitten out of the rim, and a verdigris weep off the boss
    for (const [x, y] of [[1, 6], [1, 7], [2, 5], [13, 10], [14, 9], [12, 12]]) px(g, x, y, '.');
    px(g, 8, 10, 'V'); px(g, 9, 11, 'V'); px(g, 6, 5, 'V');
    // the grit bank it has settled into, which is also what stops it rolling
    hspan(g, 2, 12, 14, 'X'); px(g, 4, 14, 'U'); px(g, 10, 14, 'U');
    px(g, 3, 13, 'X'); px(g, 12, 13, 'X');
  } else {
    // A STACK OF CUT PIPE, mouths toward you: three gauges, iron rings round
    // black bores, with a verdigris copper elbow slung over the top of them.
    const bore = (cx, cy, r, ramp) => {
      for (let y = Math.ceil(cy - r); y <= Math.floor(cy + r); y++) {
        for (let x = Math.ceil(cx - r); x <= Math.floor(cx + r); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r) continue;
          px(g, x, y, d <= r - 1.6 ? '0'
            : (x + y < cx + cy - 0.5 ? ramp[0]
              : (x + y > cx + cy + 1.5 ? ramp[2] : ramp[1])));
        }
      }
    };
    // two of the three have gone over to rust; one is still bright steel
    bore(4.5, 10.5, 4.4, ['P', 'Q', 'X']);
    bore(11.5, 10.5, 3.6, ['i', 'I', 'J']);
    bore(8, 5.5, 3.4, ['Q', 'X', 'U']);
    // the elbow: copper gone green, lit on its shoulder
    for (const [x, y] of [[12, 2], [13, 2], [14, 3], [14, 4], [14, 5], [13, 6],
      [12, 6], [11, 6], [13, 3], [13, 4], [13, 5], [12, 3]]) px(g, x, y, 'V');
    px(g, 12, 2, 'i'); px(g, 13, 2, 'i');
    px(g, 1, 7, 'X'); px(g, 15, 8, 'X'); px(g, 7, 13, 'U');
  }
  const out = outline(g, 'k');
  contactShadow(out, 2, 13, 14, 'b');
  return rowsOf(out);
}

/**
 * THE PUMP HOUSE on the terrace.
 *
 * It used to be `makeWindmillTower` at 60% scale, which at that size lost its
 * roof, its plinth and its arch and drew a raw black door quad straight onto
 * the same grey brick as the paving it stands on — at 3x it read as a hole in
 * the floor with sticks laid over it. This is a BUILDING: copper pitched roof
 * with an eave shadow, a plastered body one clear value step off the flagstone
 * under it, a stone plinth, an arched brass-cased doorway with a step, and a
 * gantry on the ridge for the wheel to turn on.
 */
function makePumpHouse(w = 40, h = 50) {
  const g = G(w, h + 2);
  const cx = (w - 1) / 2;
  const wallY = 26, roofY = 12;

  // --- gantry: a short brass mast the wheel is hung off ---------------------
  box(g, Math.round(cx - 2), 4, 5, 10, 'z');
  vspan(g, Math.round(cx - 2), 4, 13, 'B');
  box(g, Math.round(cx - 4), 8, 9, 3, 'z');
  hspan(g, Math.round(cx - 4), Math.round(cx + 4), 8, 'B');
  box(g, Math.round(cx - 3), 2, 7, 4, 'z');           // the hub boss
  box(g, Math.round(cx - 2), 3, 5, 2, 'B');
  px(g, Math.round(cx - 1), 3, 'A');

  // --- roof: a copper pitch with a 2px eave overhang ------------------------
  for (let y = roofY; y < wallY; y++) {
    const t = (y - roofY) / (wallY - roofY);
    const half = Math.round(4 + (w / 2 - 1) * t);
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const d = (x - cx) / (half || 1);
      let c = d < -0.35 ? '5' : d > 0.4 ? '7' : '6';
      if ((y - roofY) % 3 === 0 && (x + y) % 2 === 0) c = d < 0 ? '6' : '7';
      px(g, x, y, c);
    }
    if (y === roofY) hspan(g, Math.round(cx - half), Math.round(cx + half), y, '5');
  }
  hspan(g, 1, w - 2, wallY - 1, '8');                 // the eave, in shadow
  hspan(g, 2, w - 3, wallY, 'k');                     // and the line it casts

  // --- wall: plaster on a stone plinth --------------------------------------
  const wx0 = 3, wx1 = w - 4;
  for (let y = wallY + 1; y < h - 6; y++) {
    for (let x = wx0; x <= wx1; x++) {
      let c = '2';
      if (x < wx0 + 3) c = '1';                       // lit jamb
      else if (x > wx1 - 3) c = '3';
      if ((x * 5 + y * 7) % 19 === 0) c = '3';
      px(g, x, y, c);
    }
  }
  for (let y = h - 6; y < h; y++) {                   // plinth
    for (let x = wx0 - 1; x <= wx1 + 1; x++) {
      px(g, x, y, y === h - 6 ? 'R' : ((x + y) % 7 === 0 ? 'x' : 'r'));
    }
  }
  // brass band with a pressure gauge, so it reads as machinery not a shed
  hspan(g, wx0, wx1, wallY + 3, 'A');
  hspan(g, wx0, wx1, wallY + 4, 'B');
  hspan(g, wx0, wx1, wallY + 5, 'z');
  box(g, wx1 - 6, wallY + 7, 5, 5, 'z');
  box(g, wx1 - 5, wallY + 8, 3, 3, 'i');
  px(g, wx1 - 4, wallY + 9, 'F');

  // --- the door: an ARCH, cased in brass, with a step ----------------------
  const dw = 12, dx = Math.round(cx - dw / 2), dTop = wallY + 8, dBot = h - 1;
  for (let y = dTop; y <= dBot; y++) {
    for (let x = dx; x < dx + dw; x++) {
      // the arch head: round the top two rows off
      const r = (dw - 1) / 2, ay = dTop + r;
      if (y < ay && Math.hypot(x - (dx + r), (y - ay) * 1.05) > r) continue;
      px(g, x, y, '0');
    }
  }
  // brass casing round the opening, one pixel proud of the plaster
  for (let y = dTop - 1; y <= dBot; y++) {
    for (let x = dx - 1; x <= dx + dw; x++) {
      if (at(g, x, y) === '0') continue;
      let touch = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]]) {
        if (at(g, x + ox, y + oy) === '0') { touch = true; break; }
      }
      if (touch) px(g, x, y, y < dTop + 4 ? 'A' : (x < cx ? 'B' : 'z'));
    }
  }
  // the dark inside the arch is not flat: a shut plank door, padlocked
  box(g, dx + 1, dTop + 5, dw - 2, dBot - dTop - 4, 'm');
  for (let x = dx + 1; x < dx + dw - 1; x += 3) vspan(g, x, dTop + 5, dBot - 1, 'n');
  hspan(g, dx + 1, dx + dw - 2, dTop + 7, 'z');
  px(g, Math.round(cx), dTop + 10, 'A'); px(g, Math.round(cx) + 1, dTop + 10, 'B');
  // and a stone step out of it, so the door sits ON something
  hspan(g, dx - 2, dx + dw + 1, h - 1, 'R');
  hspan(g, dx - 1, dx + dw, h, 'r');

  const out = outline(g, 'k');
  contactShadow(out, 2, w - 3, h + 1, 'b');
  return rowsOf(out);
}

// A gull for the dock (two frames — up-stroke, down-stroke).
const GULL = [
  ['.kk......kk.', 'kffk....kffk', '.kffkkkkffk.', '..kkffffkk..', '....kkkk....'],
  ['............', '.....kk.....', '.kkkkffkkkk.', 'kffffffffffk', '.kkkkkkkkkk.'],
];

/** Steam puff frames for the mouth vents and the boiler stacks. */
function puffRows(f) {
  const g = G(16, 16);
  const r = 3 + f * 1.6;
  const cy = 11 - f * 2.4;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 8, (y - cy) * 1.25);
      if (d > r) continue;
      const c = f >= 3 ? ((x + y) % 2 ? 'v' : 'W') : (d < r - 1.6 ? 'w' : 'W');
      px(g, x, y, c);
    }
  }
  return rowsOf(g);
}

// ---------------------------------------------------------------------------
// Sprite factory
// ---------------------------------------------------------------------------

/** The five buildings of Cogwick Hollow. */
export const HOUSES = {
  house_a: { w: 64, wallH: 30, roofH: 26, windows: [[8, 8], [42, 8]], stack: 48 },
  house_b: { w: 52, wallH: 28, roofH: 22, windows: [[7, 7]], doorX: 19 },
  // The parish store. It used to be drawn with three windows, a chimney and
  // NO door at all — a house with nothing to draw, on the screen the whole act
  // is pointing at. It has a door now, boarded like the house next to it,
  // which is also what the notice pinned to it already said: empty shelves,
  // cold machine oil, nobody home. `boarded` draws planks across the opening,
  // so the doorway is a shape without being a way in.
  house_c: {
    w: 60, wallH: 32, roofH: 24, windows: [[6, 6], [44, 6]],
    stack: 8, doorX: 25, boarded: true,
  },
  house_locked: {
    w: 56, wallH: 28, roofH: 24, windows: [[8, 8], [34, 8]], boarded: true,
  },
  shop: {
    w: 64, wallH: 34, roofH: 24, windows: [[6, 20]], awning: true, sign: 46,
    stack: 52,
  },
};

let SPR_CACHE = null;

export function makeWorldSprites() {
  if (SPR_CACHE) return SPR_CACHE;
  const s = {};
  for (const [k, rws] of Object.entries(SPRITE_ROWS)) s[k] = makeSprite(rws, WPAL);

  // Houses: the sprite AND its collision footprint come out of the same
  // geometry, so the wall band and the walk-in doorway can never drift apart.
  for (const [name, o] of Object.entries(HOUSES)) {
    s[name] = makeSprite(makeHouse(o), WPAL);
    const top = o.stack ? 12 : 2;
    const h = top + (o.roofH || 26) + (o.wallH || 30);
    const dx = o.doorX !== undefined ? o.doorX : Math.round((o.w - 14) / 2);
    FOOTPRINT[name] = {
      x: 4, y: h - 18, w: o.w - 8, h: 18, base: h,
      door: (o.door === false || o.boarded) ? null : { x: dx - 2, w: 18 },
      // Generous on purpose: the trigger is the whole depth of the doorway
      // arch, so walking at the door works rather than standing on one exact
      // scanline in front of it.
      doorTrigger: { x: dx + 1, y: h - 24, w: 12, h: 22 },
    };
  }
  s.shelf = makeSprite(makeShelf(48), WPAL);
  s.shelf_s = makeSprite(makeShelf(32), WPAL);
  s.rug = makeSprite(makeRug(64, 40), WPAL);
  s.rug_s = makeSprite(makeRug(48, 32), WPAL);
  s.stove = makeSprite(makeStove(), WPAL);
  s.bed = makeSprite(makeBed(), WPAL);
  s.table = makeSprite(makeTable(), WPAL);
  s.chair = makeSprite(makeChair(), WPAL);
  s.chairR = flipH(s.chair);
  s.hearth = makeSprite(makeHearth(), WPAL);
  s.dresser = makeSprite(makeDresser(), WPAL);
  s.millstone = makeSprite(makeMillstone(), WPAL);
  s.geartrain = makeSprite(makeGearTrain(), WPAL);
  s.hopper = makeSprite(makeHopper(), WPAL);
  s.jarrack = makeSprite(makeJarRack(), WPAL);
  s.lamp = makeSprite(makeLamp(), WPAL);
  s.lightpool = makeSprite(makeLightPool(34, 30), WPAL);
  // The same cast rectangle on METAL. The mill floor is riveted plate, and
  // daylight on plate is a pale grey patch, not a warm tan one.
  s.lightpool_i = makeSprite(makeLightPool(34, 30), { ...WPAL, N: '#c0c8ba', 1: '#8e968e' });
  s.sack = makeSprite(SACK_ROWS, WPAL);
  s.windmill = makeSprite(makeWindmillTower(46, 82), WPAL);
  s.windmill_small = makeSprite(makePumpHouse(40, 50), WPAL);
  s.vanes = [0, 1, 2, 3].map((i) =>
    makeSprite(makeVanes(56, (i * Math.PI) / 8, 3), WPAL));
  // The pump wheel is 30px, not 40: a wheel as wide as the building it is
  // bolted to reads as a windmill with a shed under it rather than as a pump
  // house with a wheel on top.
  // The PUMP wheel is not broken — only the mill's vane is, and that is a
  // STORY beat, not a decoration. `bent: -1` gives four sound sails.
  s.vanes_small = [0, 1, 2, 3].map((i) =>
    makeSprite(makeVanes(30, (i * Math.PI) / 8 + 0.3, -1), WPAL));
  s.hatch = makeSprite(makeHatch(), WPAL);
  s.gate = makeSprite(makeGate(false), WPAL);
  s.gate_open = makeSprite(makeGate(true), WPAL);
  s.mouth = makeSprite(makeMouth(), WPAL);
  s.skiff = makeSprite(makeSkiff(), WPAL);
  s.scrap1 = makeSprite(scrapRows(0), WPAL);
  s.scrap2 = makeSprite(scrapRows(1), WPAL);
  s.scrap3 = makeSprite(scrapRows(2), WPAL);
  // Three heap silhouettes on an exact tile lattice is wallpaper, and the
  // scrap field is nine tenths heaps. Mirroring costs nothing — no new colours,
  // the same 16px footprint — and doubles the vocabulary, so a run of six never
  // repeats a shape twice in a row.
  s.scrap1f = flipH(s.scrap1);
  s.scrap2f = flipH(s.scrap2);
  s.scrap3f = flipH(s.scrap3);
  s.leaves = leafFrames().map((r) => makeSprite(r, WPAL));
  s.puff = [0, 1, 2, 3].map((f) => makeSprite(puffRows(f), WPAL));
  s.gull = GULL.map((r) => makeSprite(r, WPAL));
  s.gullL = s.gull.map(flipH);
  // Everything that hangs IN the drop goes through the haze. The islet's lawn
  // was arriving at #287838 — full village green, two miles down, against
  // #283860 air; it read as a sprite pasted on the sky rather than as an
  // object seen through four thousand feet of it.
  // Size and contrast fall off TOGETHER: the 24px islet keeps most of its
  // ramp, the 16px one loses half of it into the air, the 10px one is barely
  // more than a dark smudge with a lid.
  s.islet_far = hazed(s.islet_far, 0.42);
  s.islet_mid = hazed(s.islet_mid, 0.60);
  s.islet_tiny = hazed(s.islet_tiny, 0.76);
  s.skiff_far = hazed(s.skiff_far, 0.56);
  s.skiff_tiny = hazed(s.skiff_tiny, 0.78);
  // Sixteen bushes, one per open-edge combination, in two hatches so a long
  // run still varies. `bush`/`bush2` (the fully-closed pair) keep their names
  // because everything else in the file already asks for them.
  for (let m = 0; m < 16; m++) {
    s[`bushm${m}`] = makeSprite(makeBushTile(m, 0), WPAL);
    s[`bushm${m}b`] = makeSprite(makeBushTile(m, 3), WPAL);
  }
  s.bush = s.bushm0;
  s.bush2 = s.bushm0b;
  SPR_CACHE = s;
  return s;
}

// ---------------------------------------------------------------------------
// Default collision footprints, in sprite-local pixels. `baseY` is the
// y-sort key measured from the sprite's top.
// ---------------------------------------------------------------------------
export const FOOTPRINT = {
  bush: { x: 1, y: 3, w: 14, h: 11, base: 15 },
  bush2: { x: 1, y: 3, w: 14, h: 11, base: 15 },
  rock: { x: 1, y: 4, w: 14, h: 10, base: 14 },
  rock_small: { x: 3, y: 6, w: 10, h: 7, base: 14 },
  post: { x: 4, y: 2, w: 8, h: 12, base: 15 },
  fence: { x: 0, y: 4, w: 16, h: 7, base: 12 },
  vent: { x: 2, y: 6, w: 12, h: 12, base: 20 },
  tree: { x: 20, y: 40, w: 24, h: 18, base: 60 },
  tree2: { x: 20, y: 40, w: 24, h: 18, base: 60 },
  crate: { x: 1, y: 2, w: 14, h: 12, base: 15 },
  barrel: { x: 1, y: 2, w: 14, h: 12, base: 15 },
  bollard: { x: 4, y: 4, w: 8, h: 9, base: 14 },
  rope_coil: null,
  counter: { x: 0, y: 1, w: 16, h: 12, base: 14 },
  chest: { x: 1, y: 3, w: 14, h: 11, base: 15 },
  pot: { x: 2, y: 3, w: 12, h: 11, base: 15 },
  scrap1: { x: 1, y: 4, w: 14, h: 10, base: 15 },
  scrap2: { x: 1, y: 5, w: 14, h: 9, base: 15 },
  scrap3: { x: 2, y: 5, w: 12, h: 9, base: 15 },
  scrap1f: { x: 1, y: 4, w: 14, h: 10, base: 15 },
  scrap2f: { x: 1, y: 5, w: 14, h: 9, base: 15 },
  scrap3f: { x: 2, y: 5, w: 12, h: 9, base: 15 },
  well: { x: 1, y: 8, w: 14, h: 12, base: 22 },
  // The hatch is 28x20 now (see makeHatch): a kerbed iron lid you can read.
  hatch: { x: 2, y: 8, w: 24, h: 10, base: 19 },
  sign: { x: 1, y: 10, w: 14, h: 8, base: 20 },
  // Houses are filled in by makeWorldSprites() from the same numbers that
  // build the art (see HOUSES).
  shelf: { x: 0, y: 20, w: 48, h: 10, base: 30 },
  shelf_s: { x: 0, y: 20, w: 32, h: 10, base: 30 },
  stove: { x: 3, y: 20, w: 16, h: 12, base: 32 },
  // Interior furniture. Every collider hugs the piece's own footprint on the
  // FLOOR, not its silhouette, so Wren walks behind a headboard and a mantel
  // the way he walks behind a roof.
  bed: { x: 0, y: 8, w: 26, h: 32, base: 40 },
  table: { x: 0, y: 12, w: 34, h: 14, base: 26 },
  chair: { x: 0, y: 12, w: 13, h: 10, base: 22 },
  chairR: { x: 0, y: 12, w: 13, h: 10, base: 22 },
  hearth: { x: 0, y: 20, w: 36, h: 14, base: 34 },
  dresser: { x: 0, y: 16, w: 24, h: 18, base: 34 },
  millstone: { x: 2, y: 10, w: 32, h: 24, base: 34 },
  geartrain: { x: 0, y: 14, w: 50, h: 16, base: 30 },
  hopper: { x: 4, y: 18, w: 14, h: 12, base: 30 },
  jarrack: { x: 0, y: 16, w: 40, h: 14, base: 30 },
  sack: { x: 2, y: 6, w: 12, h: 8, base: 15 },
  rug: null, rug_s: null, lamp: null, lightpool: null, lightpool_i: null,
  // The mill is a building you can walk into, so its wall band carries a
  // doorway hole exactly like the cottages do.
  windmill: {
    x: 6, y: 60, w: 34, h: 22, base: 82,
    door: { x: 16, w: 14 }, doorTrigger: { x: 18, y: 58, w: 10, h: 22 },
  },
  // The pump house is padlocked (see the terrace notice), so the whole
  // body collides — but only the body: the roof overhangs it and Wren
  // walks behind the eaves the way he does past every other roof here.
  windmill_small: { x: 3, y: 32, w: 34, h: 19, base: 51 },
  // The gate spans the WHOLE causeway height: a rect that only covered the
  // painted gears would let Wren squeeze past the bottom of it.
  gate: { x: 0, y: 0, w: 48, h: 48, base: 44 },
  // The mouth's arch is a hole you walk into, so its footprint is split
  // either side of the opening.
  mouth: { x: 6, y: 34, w: 60, h: 22, base: 56, door: { x: 17, w: 38 } },
  skiff: null,
};

// ---------------------------------------------------------------------------
// Interactive entities. Everything here implements the same tiny protocol the
// rest of the game already speaks:
//   baseY      — y-sort key
//   draw(ctx)  — paint at world position
//   rect       — talk/interact footprint (NPC-compatible)
//   hurtbox()/onHit()/hp — hittable by the Cogblade (bushes, pots)
// ---------------------------------------------------------------------------

class WorldObject {
  constructor(o) {
    this.x = o.x; this.y = o.y;
    this.screen = o.screen;
    this.c = o.c; this.r = o.r;
    this.dead = false;
  }
  get baseY() { return this.y + 16; }
  get rect() { return { x: this.x + 1, y: this.y + 4, w: 14, h: 11 }; }
  update() {}
  faceToward() {}
  draw() {}
}

/** A bush. Cut by the Cogblade; sometimes something is under it. */
export class Bush extends WorldObject {
  constructor(o) {
    super(o);
    this.img = o.img;
    this.hp = 1;
    this.loot = o.loot || 'maybe';
    this.obstacle = null;
  }
  hurtbox() { return { x: this.x + 2, y: this.y + 4, w: 12, h: 10 }; }
  get baseY() { return this.y + 15; }
  onHit() {
    if (this.hp <= 0) return;
    this.hp = 0;
    this.dead = true;
    if (this.onCut) this.onCut(this);
  }
  draw(ctx, frame, tint) { if (!this.dead) ctx.drawImage(tint ? tint(this.img) : this.img, this.x, this.y); }
}

/** A liftable pot. Throw it and it bursts. */
export class Pot extends WorldObject {
  constructor(o) {
    super(o);
    this.img = o.img;
    this.hp = 1;
    this.loot = o.loot || 'maybe';
  }
  hurtbox() { return { x: this.x + 2, y: this.y + 4, w: 12, h: 10 }; }
  get baseY() { return this.y + 15; }
  onHit() {
    if (this.hp <= 0) return;
    this.hp = 0;
    this.dead = true;
    if (this.onBreak) this.onBreak(this);
  }
  draw(ctx, frame, tint) { if (!this.dead) ctx.drawImage(tint ? tint(this.img) : this.img, this.x, this.y); }
}

/** A thrown pot, arcing away from Wren until it finds something to hit. */
export class ThrownPot {
  constructor(x, y, vx, vy, img) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.img = img; this.h = 14; this.vh = 1.1; this.done = false;
    this.life = 60;
  }
  get baseY() { return this.y + 16; }
  update(map) {
    this.x += this.vx; this.y += this.vy;
    this.h += this.vh; this.vh -= 0.22;
    if (--this.life <= 0) this.done = true;
    if (this.h <= 0) this.done = true;
    if (!map.boxFree(this.x + 3, this.y + 6, 10, 8)) this.done = true;
    if (this.x < -8 || this.x > WIDTH - 8 || this.y < -8 || this.y > HEIGHT - 8) {
      this.done = true;
    }
  }
  draw(ctx, frame, tint) {
    ctx.drawImage(tint ? tint(this.img) : this.img,
      Math.round(this.x), Math.round(this.y - this.h));
  }
}

/** A treasure chest. Opens with the action button. */
export class Chest extends WorldObject {
  constructor(o) {
    super(o);
    this.closed = o.closed; this.open = o.open;
    this.give = o.give; this.text = o.text;
    this.opened = !!o.opened;
  }
  get baseY() { return this.y + 15; }
  get rect() { return { x: this.x + 1, y: this.y + 6, w: 14, h: 9 }; }
  draw(ctx, frame, tint) {
    const img = this.opened ? this.open : this.closed;
    ctx.drawImage(tint ? tint(img) : img, this.x, this.y);
  }
}

/** The gear-gate. Needs the Boiler Key. */
export class GearGate extends WorldObject {
  constructor(o) {
    super(o);
    this.closed = o.closed; this.openImg = o.openImg;
    this.open = !!o.open;
    this.spin = 0;
  }
  get baseY() { return this.y + 44; }
  get rect() { return { x: this.x + 4, y: this.y + 26, w: 40, h: 16 }; }
  update() { if (this.spin > 0) this.spin--; }
  draw(ctx, frame, tint) {
    const img = this.open ? this.openImg : this.closed;
    const j = this.spin > 0 ? ((this.spin >> 1) & 1) : 0;
    ctx.drawImage(tint ? tint(img) : img, this.x + j, this.y);
  }
}

/** A piece of heart, sitting where somebody had to work to find it. */
export class HeartPiece extends WorldObject {
  constructor(o) { super(o); this.img = o.img; this.taken = !!o.taken; }
  get baseY() { return this.y + 15; }
  draw(ctx, frame, tint) {
    if (this.taken) return;
    const bob = Math.sin(frame / 16) > 0 ? 0 : 1;
    ctx.drawImage(tint ? tint(this.img) : this.img, this.x, this.y - bob);
  }
}

/** A cog or a heart, bouncing once and then waiting to be walked over. */
export class Drop {
  constructor(x, y, kind, img) {
    this.x = x; this.y = y; this.kind = kind; this.img = img;
    this.h = 6; this.vh = 1.4; this.life = 460; this.done = false;
    this.vx = 0; this.vy = 0;
  }
  get baseY() { return this.y + 8; }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vx *= 0.9; this.vy *= 0.9;
    this.h += this.vh; this.vh -= 0.22;
    if (this.h < 0) { this.h = 0; this.vh = -this.vh * 0.32; if (this.vh < 0.4) this.vh = 0; }
    if (--this.life <= 0) this.done = true;
  }
  get box() { return { x: this.x, y: this.y - this.h, w: 8, h: 8 }; }
  draw(ctx, frame, tint) {
    if (this.life < 90 && (frame >> 2) % 2) return;         // blink out
    ctx.drawImage(tint ? tint(this.img) : this.img,
      Math.round(this.x), Math.round(this.y - this.h));
  }
}

/** A doorway into an interior (or out of one). */
export class Doorway {
  constructor(o) {
    this.x = o.x; this.y = o.y; this.w = o.w || 14; this.h = o.h || 8;
    this.to = o.to; this.spawn = o.spawn; this.locked = o.locked;
    this.kind = o.kind || 'door';
  }
  get box() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
}

/**
 * An invisible thing to press A at: a boarded door, a shuttered storehouse,
 * the base of the mill. STORY.md's locked house is only a story beat if the
 * game answers when you try the handle — a drawn doorway that does nothing
 * when you walk into it and press the button is a painted flat.
 * Answers the same talk() protocol as an NPC or a sign.
 */
export class Notice {
  constructor(o) {
    this.x = o.x; this.y = o.y; this.w = o.w; this.h = o.h;
    this.lines = o.lines;
    this.facing = 'down';
    this.fixed = true;
    this.name = o.name || 'notice';
  }
  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  get baseY() { return this.y + this.h; }
  update() {}
  faceToward() {}
  talk(box) { box.say(this.lines); }
  draw() {}
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Off the ground this frame, so it draws ABOVE the y-sorted ground pass
 * instead of inside it. Keyed on the state name, not the kind: 'fly' belongs
 * to the gear-bat and 'hop' to the steam slime, and no other creature on the
 * isle uses either word.
 */
const airborne = (e) => e.state === 'fly' || e.state === 'hop';

// ---------------------------------------------------------------------------
// Screen — one 16x14 board, built from the data in maps-overworld.js.
// ---------------------------------------------------------------------------

// Fully blocked map characters.
const TILE_SOLID = new Set([
  'K', 'U', 'V',                 // sky and the cloud sea
  'F', 'L', 'c', 'C',            // cliff face, lobe, north corners
  'E', 'W',                      // island side edges — kept whole-tile so
                                 // two screens' borders always line up
  '1', '2', '3', '4', '5', '6',  // the SE / SW corner blocks
  'o',                           // authored blocker that still draws as lawn
  'H', 'h', 'j', 'v', 'x',       // interior walls and void
]);

// PARTIALLY blocked characters: the art on these tiles is only rock over PART
// of the tile, so the collision rect hugs the pixels. This is what lets Wren
// stand on the last few pixels of the grass lid with the drop right under his
// boots — ALttP's rims are walkable to the edge, and a whole-tile wall there
// reads as an invisible fence.
const TILE_PARTIAL = {
  N: { x: 0, y: 0, w: 16, h: 7 },     // north rim: sky + rock lip above grass
  R: { x: 0, y: 5, w: 16, h: 11 },    // south rim: grass lid, rock below
  p: { x: 0, y: 0, w: 16, h: 6 },     // pier rail
  q: { x: 0, y: 12, w: 16, h: 4 },    // pier under-beams
  b: { x: 0, y: 0, w: 16, h: 6 },     // bridge hand-rope
  m: { x: 0, y: 12, w: 16, h: 4 },    // bridge stringer
};

/**
 * Do two screens actually share walkable ground along the edge between them?
 * Pure map-grid arithmetic — no Screen has to be built to answer it, so
 * neighbour() can ask about a board that has never been visited.
 */
const MEET_CACHE = new Map();
function edgesMeet(a, b, dir) {
  if (!a || !b || !a.map || !b.map) return false;
  const key = `${a.id}>${b.id}:${dir}`;
  if (MEET_CACHE.has(key)) return MEET_CACHE.get(key);
  // A partial tile is standable-on if its solid band leaves room for the
  // player's feet box (10px deep) on the far side of the edge.
  const open = (def, c, r) => {
    const ch = def.map[r][c];
    if (TILE_SOLID.has(ch)) return false;
    const p = TILE_PARTIAL[ch];
    return !p || p.h <= 8;
  };
  let meet = false;
  if (dir === 'up' || dir === 'down') {
    const ra = dir === 'up' ? 0 : ROWS - 1;
    const rb = dir === 'up' ? ROWS - 1 : 0;
    for (let c = 0; c < COLS && !meet; c++) meet = open(a, c, ra) && open(b, c, rb);
  } else {
    const ca = dir === 'left' ? 0 : COLS - 1;
    const cb = dir === 'left' ? COLS - 1 : 0;
    for (let r = 0; r < ROWS && !meet; r++) meet = open(a, ca, r) && open(b, cb, r);
  }
  MEET_CACHE.set(key, meet);
  return meet;
}

export class Screen {
  /**
   * @param {object} def   screen data (see maps-overworld.js)
   * @param {object} ctx   { tiles, sprites, world, props, quest }
   */
  constructor(def, ctx) {
    this.def = def;
    this.id = def.id;
    this.ctx = ctx;
    this.path = new Set();
    this.dark = new Set();
    this.regions = {};
    for (const [c0, r0, c1, r1] of def.path || []) this._rect(this.path, c0, r0, c1, r1);
    for (const [c0, r0, c1, r1] of def.dark || []) this._rect(this.dark, c0, r0, c1, r1);
    this.build();
  }

  _rect(set, c0, r0, c1, r1) {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set.add(`${c},${r}`);
  }
  _hash(c, r) { return (c * 31 + r * 17 + ((c * r * 7) | 0)) >>> 0; }
  _in(set, c, r) { return set.has(`${c},${r}`); }

  ch(c, r) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return 'K';
    return this.def.map[r][c];
  }

  /** Plain lawn: walkable ground with no overlay region on it. */
  _lawnAt(c, r) {
    const ch = this.ch(c, r);
    return (ch === '.' || ch === 'E' || ch === 'W' || ch === 'R' || ch === 'N') &&
      !this._in(this.path, c, r) && !this._in(this.dark, c, r);
  }

  _grassName(c, r) {
    const h = this._hash(c, r);
    const nearDark = this._in(this.dark, c - 1, r) || this._in(this.dark, c + 1, r) ||
      this._in(this.dark, c, r - 1) || this._in(this.dark, c, r + 1);
    if (nearDark) return ['grass3', 'grass4', 'grass5', 'grass6', 'grass7', 'grass8'][h % 6];
    switch (h % 8) {
      case 1: return 'grass3';
      case 3: return 'grass4';
      case 5: return h % 16 < 8 ? 'grass5' : 'grass7';
      case 7: return h % 16 < 8 ? 'grass6' : 'grass8';
      default: return h % 16 < 8 ? 'grass' : 'grass2';
    }
  }

  _regionTile(set, prefix, c, r) {
    const gAt = (cc, rr) => this._lawnAt(cc, rr) && !this._in(set, cc, rr);
    const gN = gAt(c, r - 1), gS = gAt(c, r + 1);
    const gW = gAt(c - 1, r), gE = gAt(c + 1, r);
    const v = ['', '2', '3'][this._hash(c, r) % 3];
    if (gN && gW) return `${prefix}_nw`;
    if (gN && gE) return `${prefix}_ne`;
    if (gS && gW) return `${prefix}_sw`;
    if (gS && gE) return `${prefix}_se`;
    if (gN) return `${prefix}_n${v}`;
    if (gS) return `${prefix}_s${v}`;
    if (gW) return `${prefix}_w${v}`;
    if (gE) return `${prefix}_e${v}`;
    if (gAt(c - 1, r - 1)) return `${prefix}_inw`;
    if (gAt(c + 1, r - 1)) return `${prefix}_ine`;
    if (gAt(c - 1, r + 1)) return `${prefix}_isw`;
    if (gAt(c + 1, r + 1)) return `${prefix}_ise`;
    return prefix === 'path' && (c + r) % 2 ? 'path_c2' : `${prefix}_c`;
  }

  tileName(c, r) {
    const ch = this.ch(c, r);
    const h = this._hash(c, r);
    switch (ch) {
      case '.': case 'o':
        if (this._in(this.path, c, r)) return this._regionTile(this.path, 'path', c, r);
        if (this._in(this.dark, c, r)) return this._regionTile(this.dark, 'dk', c, r);
        return this._grassName(c, r);
      case 'N': return 'rim_n';
      case 'c': return 'corner_nw';
      case 'C': return 'corner_ne';
      case 'W': return h % 2 ? 'edge_wb' : 'edge_wa';
      case 'E': return h % 2 ? 'edge_eb' : 'edge_ea';
      case 'R': return h % 2 ? 'rim_b' : 'rim_a';
      case 'F': return ['face_a', 'face_b', 'face_c', 'face_d'][(c * 2 + 1) % 4];
      case 'L': return ['lobe_1', 'lobe_2', 'lobe_3', 'lobe_1', 'lobe_3', 'lobe_2'][c % 6];
      case '4': return 'csw_rim';
      case '5': return 'csw_face';
      case '6': return 'csw_lobe';
      case '1': return 'cse_rim';
      case '2': return 'cse_face';
      case '3': return 'cse_lobe';
      // U / V used to bake a STATIC cloud sea into the land layer, which is
      // exactly the "flat surface with a beach" the void overhaul exists to
      // kill. They are void now: solid to walk into, drawn by the drifting
      // cloud fields like every other piece of open air on the isle.
      case 'U': case 'V': return null;
      // --- built surfaces
      case 'D':
        if (!this.def.interior) return ['deck', 'deck2', 'deck3'][h % 3];
        return this.def.floor === 'v'
          ? ['floorv', 'floorv2', 'floorv3'][h % 3]
          : ['floor', 'floor2', 'floor3'][h % 3];
      case 'p': return h % 2 ? 'pier_n2' : 'pier_n';
      case 'P': return 'pier_c';
      case 'q': return h % 2 ? 'pier_s2' : 'pier_s';
      case 'b': return h % 2 ? 'brg_n2' : 'brg_n';
      case 'B': return h % 2 ? 'brg_c2' : 'brg_c';
      case 'm': return h % 2 ? 'brg_s2' : 'brg_s';
      case 'S': {
        // Courses run through horizontally; the vertical joint staggers by
        // row and drops out entirely on about a third of the slabs.
        const j = (this._hash(c * 7 + r * 3, r) % 3);
        return `paver_${j}${h % 4}`;
      }
      case 'T': return h % 2 ? 'plate' : 'plate2';
      // --- interiors
      // Wall MATERIAL is a screen property, not a map character, so switching a
      // room from ashlar to plaster can never change what is solid.
      case 'H': return this.def.wall === 'plaster' ? 'iwall_p' : 'iwall';
      case 'h': return this.def.wall === 'plaster' ? 'iwall_pcap' : 'iwall_cap';
      case 'j': return this.def.wall === 'plaster' ? 'iwall_pbase' : 'iwall_base';
      case 'v': return this.def.wall === 'plaster' ? 'iwall_pwin' : 'iwall_win';
      case 'x': return 'void';
      default: return null;      // 'K' — open sky
    }
  }

  solidAt(c, r) { return TILE_SOLID.has(this.ch(c, r)); }

  build() {
    const { tiles, sprites, props } = this.ctx;
    const def = this.def;
    const map = new Tilemap(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.ch(c, r);
        const name = this.tileName(c, r);
        const part = TILE_PARTIAL[ch];
        if (part && !TILE_SOLID.has(ch)) map.setPartial(c, r, name, part);
        else map.set(c, r, name, TILE_SOLID.has(ch));
      }
    }
    this.map = map;

    // --- baked layers ------------------------------------------------------
    const land = map.bake(tiles);
    const lc = land.getContext('2d');
    for (const [name, c, r] of def.flat || []) {
      const img = sprites[name] || props[name];
      if (img) lc.drawImage(img, c * TILE, r * TILE);
    }
    for (const [name, x, y] of def.flatpx || []) {
      const img = sprites[name] || props[name];
      if (img) lc.drawImage(img, x, y);
    }
    // The bridge deck is cut out of the land layer so it can SWAY: it is
    // eight tiles of plank slung over two miles of air and it has no business
    // being nailed to the background.
    if (def.sway) {
      const [sx, sy, sw, sh] = def.sway;
      this.swayLayer = newCanvas(sw, sh);
      this.swayLayer.getContext('2d').drawImage(land, sx, sy, sw, sh, 0, 0, sw, sh);
      this.swayRect = { x: sx, y: sy, w: sw, h: sh };
      lc.clearRect(sx, sy, sw, sh);
    }
    this.landLayer = land;

    // --- the void ----------------------------------------------------------
    // Built FROM the land layer's own alpha, so the depth ramp and the isle's
    // shadow follow the rock silhouette pixel for pixel.
    if (!def.interior) {
      const px = lc.getImageData(0, 0, WIDTH, HEIGHT).data;
      const mask = new Uint8Array(WIDTH * HEIGHT);
      for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 0 ? 1 : 0;
      if (this.swayRect) {                    // the deck still casts its shade
        const { x, y, w, h } = this.swayRect;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) mask[(y + j) * WIDTH + x + i] = 1;
        }
      }
      // NATURAL GROUND ONLY: lawn, rim, edge and corner tiles. Anything built —
      // planks, pier, bridge, pavers, causeway plate — is excluded, so the
      // underhang in buildVoidLayers never grows a cliff under a rope bridge.
      const rockMask = new Uint8Array(WIDTH * HEIGHT);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!/[.oNRWEcC123456]/.test(this.ch(c, r))) continue;
          for (let j = 0; j < TILE; j++) {
            const row = (r * TILE + j) * WIDTH + c * TILE;
            for (let i = 0; i < TILE; i++) rockMask[row + i] = mask[row + i];
          }
        }
      }
      const layers = buildVoidLayers(mask, rockMask);
      this.voidBase = layers.base;
      this.voidShade = layers.shade;
    }

    // --- solid decor -------------------------------------------------------
    const addObstacle = (name, x, y) => {
      const img = sprites[name] || props[name];
      if (!img) return;
      const f = FOOTPRINT[name];
      if (!f) { map.addObstacle(img, x, y, null, y + img.height); return; }
      if (f.door) {
        // Two wall segments with a walk-in gap between them: the doorway is a
        // hole in the collision, exactly as ALttP's house fronts are.
        const lw = f.door.x - f.x;
        const rx = f.door.x + f.door.w, rw = (f.x + f.w) - rx;
        map.addObstacle(img, x, y,
          lw > 0 ? { x: x + f.x, y: y + f.y, w: lw, h: f.h } : null, y + f.base);
        if (rw > 0) {
          map.addObstacle(null, x, y,
            { x: x + rx, y: y + f.y, w: rw, h: f.h }, y + f.base);
        }
        return;
      }
      map.addObstacle(img, x, y,
        { x: x + f.x, y: y + f.y, w: f.w, h: f.h }, y + f.base);
    };
    for (const [name, c, r] of def.solids || []) addObstacle(name, c * TILE, r * TILE);
    for (const [name, x, y] of def.built || []) addObstacle(name, x, y);

    // --- live entities -----------------------------------------------------
    this.entities = [];       // talk / interact targets (NPC-compatible)
    this.hittables = [];      // Cogblade targets
    this.enemies = [];
    this.drops = [];
    this.effects = [];
    this.doors = [];
    this.gates = [];
    this.chests = [];
    this.pieces = [];
    this.signs = [];
    this.notices = [];
    this.npcs = [];
    this.portal = null;
    this.built = def.built || [];
    this.animated = def.animated || [];
    this.spawnObjects();
  }

  /**
   * Which of the sixteen bush tiles this cell wants: one bit per side that has
   * another living bush against it. Runs fuse into a single silhouette; a
   * lone bush still gets its rim on all four sides.
   */
  bushSprite(c, r) {
    const at = (cc, rr) => (this.bushAt.has(`${cc},${rr}`) ? 1 : 0);
    const m = at(c, r - 1) | (at(c + 1, r) << 1) | (at(c, r + 1) << 2) | (at(c - 1, r) << 3);
    return `bushm${m}${(c * 3 + r * 5) % 2 ? 'b' : ''}`;
  }

  /** Re-cut every surviving bush's art after one of them has been removed. */
  refreshBushes() {
    if (!this.bushAt) return;
    for (const e of this.entities) {
      if (!(e instanceof Bush) || e.dead) continue;
      e.img = this.ctx.sprites[this.bushSprite(e.c, e.r)] || e.img;
    }
  }

  /** Bushes, pots, chests, the gate and the heart piece. */
  spawnObjects() {
    const { sprites, quest, world } = this.ctx;
    const def = this.def;
    const id = this.id;
    // The live bush set, so a bush's ART knows which of its sides has another
    // bush against it (see makeBushTile). Cut bushes are already gone from
    // this set, and refreshBushes() re-derives it the moment one is cut.
    this.bushAt = new Set();
    for (const [c, r] of def.bushes || []) {
      if (!quest.marked(id, 'bush', c, r)) this.bushAt.add(`${c},${r}`);
    }
    for (const b of def.bushes || []) {
      const [c, r, loot] = b;
      if (quest.marked(id, 'bush', c, r)) continue;
      const bush = new Bush({
        screen: id, c, r, x: c * TILE, y: r * TILE, loot,
        img: sprites[this.bushSprite(c, r)],
      });
      bush.onCut = (o) => world.onBushCut(this, o);
      bush.obstacle = { img: bush.img, x: bush.x, y: bush.y, rect: null, baseY: bush.baseY };
      const f = FOOTPRINT.bush;
      bush.obstacle.rect = { x: bush.x + f.x, y: bush.y + f.y, w: f.w, h: f.h };
      bush.obstacle.img = null;                  // the entity draws itself
      this.map.obstacles.push(bush.obstacle);
      this.hittables.push(bush);
      this.entities.push(bush);
    }
    for (const p of def.pots || []) {
      const [c, r, loot] = p;
      if (quest.marked(id, 'pot', c, r)) continue;
      const pot = new Pot({
        screen: id, c, r, x: c * TILE, y: r * TILE, loot, img: sprites.pot,
      });
      pot.onBreak = (o) => world.onPotBreak(this, o);
      const f = FOOTPRINT.pot;
      pot.obstacle = {
        img: null, x: pot.x, y: pot.y,
        rect: { x: pot.x + f.x, y: pot.y + f.y, w: f.w, h: f.h }, baseY: pot.baseY,
      };
      this.map.obstacles.push(pot.obstacle);
      this.hittables.push(pot);
      this.entities.push(pot);
    }
    for (const ch of def.chests || []) {
      const chest = new Chest({
        screen: id, c: ch.c, r: ch.r, x: ch.c * TILE, y: ch.r * TILE,
        closed: sprites.chest, open: sprites.chest_open,
        give: ch.give, text: ch.text,
        opened: quest.marked(id, 'chest', ch.c, ch.r),
      });
      const f = FOOTPRINT.chest;
      this.map.obstacles.push({
        img: null, x: chest.x, y: chest.y,
        rect: { x: chest.x + f.x, y: chest.y + f.y, w: f.w, h: f.h }, baseY: chest.baseY,
      });
      this.chests.push(chest);
      this.entities.push(chest);
    }
    for (const g of def.gates || []) {
      const gate = new GearGate({
        screen: id, c: g.c, r: g.r, x: g.c * TILE, y: g.r * TILE,
        closed: sprites.gate, openImg: sprites.gate_open,
        open: quest.has('gateOpen'),
      });
      const f = FOOTPRINT.gate;
      gate.obstacle = {
        img: null, x: gate.x, y: gate.y,
        rect: { x: gate.x + f.x, y: gate.y + f.y, w: f.w, h: f.h }, baseY: gate.baseY,
      };
      if (!gate.open) this.map.obstacles.push(gate.obstacle);
      this.gates.push(gate);
      this.entities.push(gate);
    }
    for (const p of def.hearts || []) {
      if (quest.marked(id, 'heart', p.c, p.r)) continue;
      const hp = new HeartPiece({
        screen: id, c: p.c, r: p.r, x: p.c * TILE, y: p.r * TILE,
        img: sprites.heart_piece,
      });
      this.pieces.push(hp);
    }
    for (const d of def.doors || []) {
      let x, y, w = d.w || 14, h = d.h || 8;
      if (d.building) {
        // Derived straight off the building's own geometry, so the trigger
        // can never end up a few pixels off the painted arch.
        const b = (def.built || []).find((e) => e[0] === d.building);
        const f = FOOTPRINT[d.building];
        if (!b || !f || !f.doorTrigger) continue;
        x = b[1] + f.doorTrigger.x; y = b[2] + f.doorTrigger.y;
        w = f.doorTrigger.w; h = f.doorTrigger.h;
      } else if (d.px) {
        x = d.px[0]; y = d.px[1];
      } else {
        x = d.c * TILE + (d.dx ?? 1); y = d.r * TILE + (d.dy ?? 8);
      }
      this.doors.push(new Doorway({ x, y, w, h, to: d.to, spawn: d.spawn, kind: d.kind }));
    }
    // Stamped brass plaques. Signs answer the same talk() protocol as NPCs.
    for (const sg of def.signs || []) {
      const sign = new Sign({
        name: sg.kind || 'sign',
        x: sg.px ? sg.px[0] : sg.c * TILE,
        y: sg.px ? sg.px[1] : sg.r * TILE,
        img: this.ctx.props.sign,
        lines: sg.text || SIGN_TEXT[sg.kind] || 'The letters have worn off.',
      });
      const f = FOOTPRINT.sign;
      this.map.addObstacle(null, sign.x, sign.y,
        { x: sign.x + f.x, y: sign.y + f.y, w: f.w, h: f.h }, sign.y + f.base);
      this.entities.push(sign);
      this.signs.push(sign);
    }
    for (const n of def.notices || []) {
      const [x, y, w, h] = n.px;
      this.notices.push(new Notice({ x, y, w, h, lines: n.text, name: n.kind }));
    }
    if (def.portal) {
      this.portal = { ...def.portal };
    }
  }

  /**
   * NPCs are built by the scene (they need the live DialogBox), then handed
   * back here so they y-sort and collide with everything else.
   */
  addNpc(npc) {
    this.npcs.push(npc);
    this.entities.push(npc);
    const r = npc.rect;
    this.map.addObstacle(null, npc.x, npc.y,
      { x: r.x, y: r.y, w: r.w, h: r.h }, npc.baseY);
    return npc;
  }

  /** Enemies are (re)spawned every time the screen is entered. */
  spawnEnemies(engine, enemySprites) {
    this.enemies = [];
    const bounds = { x0: 16, y0: 24, x1: WIDTH - 32, y1: HEIGHT - 48 };
    (this.def.enemies || []).forEach((e, i) => {
      let ent;
      if (e.kind === 'bat') {
        ent = new GearBat(e.c * TILE, e.r * TILE, e.bounds || bounds);
        ent.timer = 30 + i * 45;
        // THE BAT HAS TO BE FASTER THAN WREN. Measured: it dived at 1.1 px/f
        // against his 1.5, so a player who simply held one direction was never
        // caught by anything on the isle and the whole traverse cost half a
        // heart out of three. game/enemies.js reads GearBat.SPEED off the class
        // by name, so it cannot be tuned per instance from outside — but the
        // flight it plans is a {dur} we own the moment it is planned. Shorten
        // it and the same authored arc, the same 12-frame clench telegraph and
        // the same overshoot land at ~1.8 px/f. The tell stays readable; the
        // dodge stops being free.
        const plan = GearBat.prototype._startSwoop;
        ent._startSwoop = function swoop(engine, target) {
          plan.call(this, engine, target);
          if (this._flight) this._flight.dur = Math.max(26, Math.round(this._flight.dur * 0.62));
        };
      } else if (e.kind === 'slime') {
        // THE THIRD CREATURE. SteamSlime was authored, critic-verified and
        // then spawned nowhere but the demo scene, so nine outdoor screens
        // carried two enemies where three exist. It needs no tuning here — it
        // already takes a target and hops at it — only a bounds box, so a
        // slime that lives by a vent stays by its vent instead of chasing Wren
        // across the whole board. Its update() signature is the same
        // (engine, map, target) the other two use.
        ent = new SteamSlime(e.c * TILE, e.r * TILE, e.bounds || bounds);
        // Offset the breath clocks so two slimes on one screen never squash in
        // unison — the telegraph is the encounter, and two of them in lockstep
        // reads as one animation played twice.
        ent.timer = 34 + i * 37;
      } else {
        ent = new ClockworkBeetle(e.c * TILE, e.r * TILE, e.dir || 'down');
        ent.state = 'walk';
        ent.timer = 40 + i * 45;
      }
      ent.sprites = enemySprites;
      ent.kind = e.kind || 'beetle';
      this.enemies.push(ent);
    });
  }

  removeObstacle(ob) {
    const i = this.map.obstacles.indexOf(ob);
    if (i >= 0) this.map.obstacles.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// Overworld — the screen graph and the interactive layer.
// ---------------------------------------------------------------------------

export class Overworld {
  /**
   * @param {object} o
   *   tiles     tileset tiles (makeTileset().tiles) + world tiles merged in
   *   sprites   tileset sprites + world sprites merged in
   *   props     npc.js props (well / sign / hatch)
   *   quest     the Quest store
   *   screens   { id: def }
   *   engine    Engine (for rand / frame)
   *   onSfx     (name) => void
   */
  constructor(o) {
    this.tiles = o.tiles;
    this.sprites = o.sprites;
    this.props = o.props || {};
    this.quest = o.quest;
    this.defs = o.screens;
    this.engine = o.engine;
    this.onSfx = o.onSfx || (() => {});
    this.enemySprites = o.enemySprites;
    this.cache = new Map();
    this.grid = new Map();
    for (const def of Object.values(this.defs)) {
      if (def.grid) this.grid.set(def.grid.join(','), def.id);
    }
    this.screen = null;
    /**
     * THE STAGE LIGHT, and why every drawable goes through it.
     *
     * The baked land layer was being tinted for the sky stage and everything
     * standing ON it — houses, the windmill, crates, bushes, pots, chests,
     * signs, flowers, steam — was not. Two consequences, both measured:
     *
     *  1. A screen carried TWO of every material colour, the tinted terrain
     *     copy and the untinted sprite copy, one 5-bit step apart and
     *     indistinguishable to the eye. That is the whole of the "colour count
     *     is consistently over budget, always in the too-many direction"
     *     finding: a village screen was spending eight working-palette slots
     *     on four browns.
     *  2. Worse than the count: at stage 3 the ground would go cold and blue
     *     and the cottages would still be sitting in stage-0 noon light. The
     *     isle is falling for the whole chapter; the buildings have to fall
     *     with it.
     *
     * SkyState.tint() caches per source canvas and only rebuilds when the
     * stage bucket moves, so this is one cache lookup per sprite per frame.
     */
    this.sky = null;
    this.drops = [];
    this.effects = [];
    this.thrown = [];
    this.carrying = null;
    /** Item announcements waiting for the text box to shut. */
    this.itemQueue = [];
  }

  // --- screens -------------------------------------------------------------

  get(id) {
    let s = this.cache.get(id);
    if (!s) {
      const def = this.defs[id];
      if (!def) throw new Error('no such screen: ' + id);
      s = new Screen(def, {
        tiles: this.tiles, sprites: this.sprites, props: this.props,
        quest: this.quest, world: this,
      });
      this.cache.set(id, s);
    }
    return s;
  }

  /** Drop a cached screen so its objects rebuild from quest state. */
  invalidate(id) { this.cache.delete(id); }

  enter(id, engine) {
    const s = this.get(id);
    this.screen = s;
    // NPCs need the live dialog box, so the scene builds them; do it once per
    // screen instance (screens are cached so a return visit keeps its people).
    if (!s._populated) {
      s._populated = true;
      if (this.onPopulate) this.onPopulate(s);
    }
    s.spawnEnemies(engine || this.engine, this.enemySprites);
    this.drops = [];
    this.thrown = [];
    this.effects = [];
    this.carrying = null;
    if (this.onEnterScreen) this.onEnterScreen(s);
    return s;
  }

  /**
   * Never leave Wren standing inside a solid after a screen change or a door.
   * Spirals out from where he landed for the nearest legal footing.
   */
  settle(player) {
    const map = this.screen.map;
    const free = (x, y) => player._free(map, x, y);
    if (free(player.x, player.y)) return;
    let best = null, bd = Infinity;
    for (let y = -12; y <= HEIGHT - 24; y += 2) {
      for (let x = -2; x <= WIDTH - 14; x += 2) {
        if (!free(x, y)) continue;
        const d = (x - player.x) ** 2 + (y - player.y) ** 2;
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    if (best) { player.x = best[0]; player.y = best[1]; }
  }

  /**
   * The screen at `dir`, or null.
   *
   * A screen used to advertise a neighbour purely because one sat at that
   * coordinate. `bridge` claimed an `up` and `cliffnook` a `down` even though
   * bridge's north edge is cliff rim and cliffnook's south edge is the lobe of
   * the isle — two dead links in the graph. Harmless while the up-threshold
   * was -13.4 (nobody could ever reach it); the moment that was aligned with
   * the other three edges they became live, and walking up off the Windrope
   * would have dumped Wren inside cliffnook's south rim for settle() to spiral
   * him out of.
   *
   * So a link exists only where the two screens actually MEET: some column
   * (or row) where the tile on this edge and the tile on the neighbour's
   * facing edge are both walkable. Data-driven, so a map edit can never leave
   * a stale exit behind.
   */
  neighbour(dir) {
    const def = this.screen.def;
    const g = def.grid;
    if (!g) return null;
    const d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    const id = this.grid.get([g[0] + d[0], g[1] + d[1]].join(',')) || null;
    if (!id) return null;
    return edgesMeet(def, this.defs[id], dir) ? id : null;
  }

  /**
   * Has Wren walked into the edge of the board? Returns the direction if the
   * neighbouring screen exists and he is pressed against that edge.
   */
  edgeExit(player, input) {
    if (player.kbT > 0 || player.lock) return null;
    const checks = [
      // All four thresholds put roughly the same amount of Wren past the
      // edge. The old up-threshold was -13.4, which parked him with his head
      // and shoulders clipped off the top of the screen waiting for a scroll
      // that only fired six pixels later.
      ['right', input.held('right'), player.x >= WIDTH - 15],
      ['left', input.held('left'), player.x <= -1.4],
      ['down', input.held('down'), player.y >= HEIGHT - 25],
      ['up', input.held('up'), player.y <= -6],
    ];
    for (const [dir, held, at_] of checks) {
      if (held && at_ && this.neighbour(dir)) return dir;
    }
    return null;
  }

  // --- interaction ---------------------------------------------------------

  /** Objects that answer the action button (chests, gates) plus signs/NPCs. */
  actionTargets() {
    return [...this.screen.chests, ...this.screen.gates];
  }

  /** Everything on this screen that answers the A button with words. */
  talkables() {
    return [...this.screen.npcs, ...this.screen.signs, ...this.screen.notices];
  }

  /**
   * Handle the action button against a chest / gate. Returns true if it was
   * consumed. `talkables` already handled by npc.tryTalk before this.
   */
  tryAction(player, box, tr) {
    const target = this._facing(player, [...this.screen.chests, ...this.screen.gates]);
    if (!target) return false;
    if (target instanceof Chest) return this.openChest(target, box, tr, player);
    if (target instanceof GearGate) return this.tryGate(target, box);
    return false;
  }

  _facing(player, list, reach = 8) {
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = D[player.dir] || D.down;
    const cx = player.x + 8, cy = player.y + 19;
    const px_ = cx + dx * (6 + reach), py = cy + dy * (5 + reach);
    let best = null, bd = 1e9;
    for (const e of list) {
      const r = e.rect;
      if (px_ < r.x - 5 || px_ > r.x + r.w + 5) continue;
      if (py < r.y - 7 || py > r.y + r.h + 7) continue;
      const d = Math.hypot(e.x + 8 - cx, e.y + 12 - cy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  /**
   * Queue an item-get. NEVER call transition.getItem() straight from here:
   * the announcement pose freezes the scene, and if a DialogBox is still open
   * when it starts, the box stops ticking and hangs half-wiped across the
   * middle of the screen for the whole presentation. The scene drains this
   * queue only once the conversation has actually finished.
   */
  queueItem(spec) {
    this.itemQueue.push({ ...spec, lines: itemText(spec.lines) });
  }

  openChest(chest, box, tr, player) {
    if (chest.opened) {
      // NOT "somebody was here first" — you were. Re-reading the cliffnook
      // chest thirty seconds after taking the Boiler Key out of it used to
      // tell you a stranger had beaten you to it.
      box.say('Empty. You had it out of\nhere already.');
      return true;
    }
    chest.opened = true;
    this.quest.mark(this.screen.id, 'chest', chest.c, chest.r);
    this.onSfx('chest');
    const give = chest.give || 'cogs:20';
    if (give === 'boilerKey') {
      this.quest.set('hasBoilerKey', true);
      this.queueItem({
        img: this.sprites.key_item,
        lines: ['THE BOILER KEY.', 'It turns the gear-gate',
          'on the works road.'],
      });
    } else if (give.startsWith('cogs:')) {
      const n = parseInt(give.slice(5), 10);
      this.quest.addCogs(n);
      this.onSfx('cog');
      box.say(chest.text || `${n} cogs. Somebody's rent.`);
    } else if (give === 'heartPiece') {
      this.grantHeartPiece(box, tr, player);
    } else {
      box.say(chest.text || 'Dust and a dead spring.');
    }
    return true;
  }

  tryGate(gate, box) {
    if (gate.open) return false;
    if (!this.quest.has('hasBoilerKey')) {
      box.say(['The gear-gate. Two teeth\nlocked into the road.',
        'There is a keyway. There is\nno key in it.']);
      return true;
    }
    gate.open = true;
    gate.spin = 30;
    this.screen.removeObstacle(gate.obstacle);
    this.quest.set('gateOpen', true);
    this.quest.beat('gate');
    this.onSfx('gear');
    box.say('The key turns. The teeth\nwind back into the posts.');
    return true;
  }

  grantHeartPiece(box, tr, player) {
    const full = this.quest.addHeartPiece();
    this.onSfx('secret');
    this.queueItem({
      img: this.sprites.heart_piece,
      lines: full
        ? ['A PIECE OF HEART.', 'Four pieces make a',
          'whole heart. Earned.']
        : ['A PIECE OF HEART.',
          `${this.quest.get('heartPieces')} of four. Find the`,
          'rest and live longer.'],
    });
  }

  // --- bushes, pots, drops -------------------------------------------------

  onBushCut(screen, bush) {
    this.quest.mark(screen.id, 'bush', bush.c, bush.r);
    screen.removeObstacle(bush.obstacle);
    // Cutting one bush out of a hedge re-opens its neighbours' rims: the run
    // has to close the hole it just grew, or the gap reads as a rendering bug.
    if (screen.bushAt) { screen.bushAt.delete(`${bush.c},${bush.r}`); screen.refreshBushes(); }
    this.onSfx('bush');
    this.effects.push({ x: bush.x, y: bush.y, t: 0, kind: 'leaves' });
    this.rollLoot(bush.x + 4, bush.y + 6, bush.loot);
  }

  onPotBreak(screen, pot) {
    this.quest.mark(screen.id, 'pot', pot.c, pot.r);
    screen.removeObstacle(pot.obstacle);
    this.onSfx('poof');
    this.effects.push({ x: pot.x, y: pot.y, t: 0, kind: 'leaves' });
    this.rollLoot(pot.x + 4, pot.y + 6, pot.loot);
  }

  /** ALttP's under-the-bush table: mostly nothing, sometimes a cog, rarely a heart. */
  rollLoot(x, y, loot) {
    const rnd = this.engine ? this.engine.rand() : Math.random();
    let kind = null;
    if (loot === 'cog') kind = 'cog';
    else if (loot === 'heart') kind = 'heart';
    else if (loot === 'none') kind = null;
    else if (rnd < 0.42) kind = 'cog';
    else if (rnd < 0.55) kind = 'heart';
    if (!kind) return;
    this.spawnDrop(x, y, kind);
  }

  spawnDrop(x, y, kind) {
    const img = kind === 'cog' ? this.sprites.cog_drop : this.sprites.heart_drop;
    const d = new Drop(x, y, kind, img);
    this.drops.push(d);
    return d;
  }

  /** Walked-over pickups. Returns a list of what was collected this frame. */
  collectDrops(player) {
    const pb = { x: player.x + 2, y: player.y + 12, w: 12, h: 12 };
    const got = [];
    for (const d of this.drops) {
      if (d.done) continue;
      if (!overlaps(pb, d.box)) continue;
      d.done = true;
      got.push(d.kind);
      if (d.kind === 'cog') { this.quest.addCogs(1); this.onSfx('cog'); }
      else { this.quest.heal(2); this.onSfx('heart'); }
    }
    this.drops = this.drops.filter((d) => !d.done);
    return got;
  }

  /** Heart pieces are picked up by walking onto them. */
  collectPieces(player, box, tr) {
    const pb = { x: player.x + 2, y: player.y + 12, w: 12, h: 12 };
    for (const p of this.screen.pieces) {
      if (p.taken) continue;
      // Generous: a piece of heart at the back of a bush maze is the reward
      // for the walk, not a pixel-hunt. The pickup covers the whole tile plus
      // a couple of pixels of slack on every side.
      if (!overlaps(pb, { x: p.x - 3, y: p.y - 1, w: 22, h: 22 })) continue;
      p.taken = true;
      this.quest.mark(this.screen.id, 'heart', p.c, p.r);
      this.grantHeartPiece(box, tr, player);
      return true;
    }
    return false;
  }

  // --- carrying ------------------------------------------------------------

  tryLift(player) {
    if (this.carrying) return false;
    const pot = this._facing(player, this.screen.entities.filter((e) => e instanceof Pot), 4);
    if (!pot) return false;
    pot.dead = true;
    this.quest.mark(this.screen.id, 'pot', pot.c, pot.r);
    this.screen.removeObstacle(pot.obstacle);
    const i = this.screen.hittables.indexOf(pot);
    if (i >= 0) this.screen.hittables.splice(i, 1);
    this.carrying = { kind: 'pot', img: this.sprites.pot, loot: pot.loot, t: 0 };
    this.onSfx('clink');
    return true;
  }

  throwCarried(player) {
    if (!this.carrying) return false;
    const D = { up: [0, -1.7], down: [0, 1.7], left: [-2.1, 0], right: [2.1, 0] };
    const [vx, vy] = D[player.dir] || D.down;
    const t = new ThrownPot(player.x, player.y + 4, vx, vy, this.carrying.img);
    t.loot = this.carrying.loot;
    this.thrown.push(t);
    this.carrying = null;
    this.onSfx('swing');
    return true;
  }

  // --- per-frame -----------------------------------------------------------

  /**
   * THE WINDROPE'S GUST. STORY.md sells the crossing as a set-piece and the
   * first build delivered a four-second corridor. Air comes up the shaft in
   * slugs: the rope starts swinging (the warning), then for three quarters of
   * a second it SHOVES, hard enough to walk you into the hand-rope but never
   * hard enough to kill you. It is the one place in the first half where the
   * ground is an opponent.
   */
  updateWind(engine, player) {
    const w = this.screen.def.wind;
    if (!w) { this.gust = null; return; }
    if (!this.gust) this.gust = { t: 0, dir: 1, power: 0, blowing: false };
    const g = this.gust;
    g.t++;
    const phase = g.t % w.period;
    // THE SLUGS ALTERNATE. A random direction meant two gusts in a row could
    // both blow you into the rope you were already against, and the measured
    // result was a 3.5px total displacement across the whole crossing — the
    // wind was decoration. Up, then down, then up: the deck rocks, and every
    // slug has the full 28px band to move you through.
    if (phase === 0) g.dir = -g.dir;
    if (phase < w.warn) {
      g.power = 0.35 * (phase / w.warn);                 // the rope takes it up
      g.blowing = false;
    } else if (phase < w.warn + w.push) {
      const u = (phase - w.warn) / w.push;
      g.power = Math.sin(Math.PI * u);                   // the slug itself
      g.blowing = true;
      // ACROSS the span, not along it. The Windrope runs east-west, so a gust
      // that shoved on X just made the crossing marginally faster or slower
      // and never touched you; the shaft wind comes up under the planks and
      // walks you sideways into the hand-rope, which is the whole point of
      // the set-piece. `axis` keeps the old behaviour available for a span
      // laid the other way round.
      const push = g.dir * w.power * g.power;
      const ax = w.axis || 'y';
      const nx = player ? player.x + (ax === 'x' ? push : 0) : 0;
      const ny = player ? player.y + (ax === 'y' ? push : 0) : 0;
      if (player && !player.lock && player._free(this.screen.map, nx, ny)) {
        player.x = nx; player.y = ny;
      }
    } else {
      g.power = Math.max(0, g.power - 0.05);
      g.blowing = false;
    }
  }

  /**
   * Streaks of driven air, drawn over the span while a gust is running. They
   * run ALONG the push, so the picture and the shove agree: on the Windrope
   * that is a column of vertical strokes climbing or falling across the gap.
   */
  drawWind(ctx, engine) {
    const g = this.gust;
    if (!g || g.power < 0.18) return;
    const w = this.screen.def.wind || {};
    const t = engine.frame;
    const c = g.power > 0.7 ? '#b0cce8' : '#7c9cc8';
    ctx.fillStyle = this.sky ? this.sky.shade(c) : c;
    const horiz = (w.axis || 'y') === 'x';
    for (let i = 0; i < 11; i++) {
      const len = 7 + ((i * 13) % 18) + Math.round(g.power * 14);
      if (horiz) {
        const y = 26 + ((i * 47 + ((t * 3) % 23)) % 168);
        const x = ((t * (3.2 + (i % 3)) * g.dir) + i * 61) % (WIDTH + 80) - 40;
        ctx.fillRect(Math.round(g.dir > 0 ? x : WIDTH - x), y, len, 1);
      } else {
        const x = 14 + ((i * 53 + ((t * 2) % 17)) % 232);
        const span = HEIGHT + 80;
        const y = ((t * (2.6 + (i % 3)) * g.dir) + i * 43) % span - 40;
        ctx.fillRect(x, Math.round(g.dir > 0 ? y : HEIGHT - y), 1, len);
      }
    }
  }

  update(engine, player) {
    const s = this.screen;
    this.updateWind(engine, player);
    for (const g of s.gates) g.update();
    for (const d of this.drops) d.update();
    this.drops = this.drops.filter((d) => !d.done);
    for (const t of this.thrown) {
      t.update(s.map);
      if (t.done) {
        this.effects.push({ x: t.x, y: t.y - t.h, t: 0, kind: 'leaves' });
        this.onSfx('poof');
        this.rollLoot(t.x + 4, t.y, t.loot);
      }
    }
    this.thrown = this.thrown.filter((t) => !t.done);
    for (const fx of this.effects) fx.t++;
    this.effects = this.effects.filter((fx) => fx.t < 16);
    if (this.carrying) this.carrying.t++;
  }

  /** Enemy patrol + contact damage. Returns true if Wren was hurt. */
  updateEnemies(engine, player) {
    const s = this.screen;
    const target = { x: player.x + 8, y: player.y + 16 };
    let hurt = false;
    for (const e of s.enemies) {
      if (e.dead) continue;
      // EVERY enemy gets the target. The beetle's update() signature is
      // (engine, map, target) exactly like the bat's, and without the third
      // argument its _aimAt() returns false every frame — the "walk into the
      // player's lane, brace, vent" beat never fires and the windup points
      // wherever the patrol happened to be heading. Do not special-case a kind
      // here again: if a kind ignores the target it just drops the argument.
      e.update(engine, s.map, target);
    }
    // deaths -> drops
    for (const e of s.enemies) {
      if (e.dead && !e._looted) {
        e._looted = true;
        const rnd = engine.rand();
        if (rnd < 0.55) this.spawnDrop(e.x + 4, e.y + 6, 'cog');
        else if (rnd < 0.72) this.spawnDrop(e.x + 4, e.y + 6, 'heart');
      }
    }
    if (player.invulnT <= 0 && player.kbT <= 0) {
      const pb = { x: player.x + 3, y: player.y + 9, w: 10, h: 13 };
      for (const e of s.enemies) {
        if (e.dead || e.hp <= 0 || e.state === 'die') continue;
        const hb = e.hurtbox();
        if (!overlaps(pb, hb)) continue;
        if (player.hurt(pb.x + pb.w / 2 - (hb.x + hb.w / 2),
          pb.y + pb.h / 2 - (hb.y + hb.h / 2))) {
          this.quest.damage(1);
          this.onSfx('hurt');
          hurt = true;
        }
        break;
      }
    }
    s.enemies = s.enemies.filter((e) => !e.dead);
    return hurt;
  }

  /** Everything the Cogblade can strike on this screen. */
  swordTargets() {
    return [...this.screen.hittables.filter((h) => !h.dead),
      ...this.screen.enemies.filter((e) => !e.dead)];
  }

  // --- doors ---------------------------------------------------------------

  doorUnder(player) {
    const pb = { x: player.x + 4, y: player.y + 18, w: 8, h: 5 };
    for (const d of this.screen.doors) if (overlaps(pb, d.box)) return d;
    return null;
  }

  /** The Boilerworks mouth (or any authored dungeon entrance). */
  portalUnder(player) {
    const p = this.screen.portal;
    if (!p) return null;
    const pb = { x: player.x + 4, y: player.y + 16, w: 8, h: 8 };
    return overlaps(pb, p) ? p : null;
  }

  // --- drawing -------------------------------------------------------------

  /**
   * Put an authored sprite into the stage's light. Returns the source canvas
   * untouched when no SkyState is wired up (unit tests, the tile demo).
   */
  tint(img) {
    if (!img || !this.sky) return img;
    return this.sky.tint(img, !!(this.screen && this.screen.def.interior));
  }

  /**
   * A drawing context that puts everything blitted through it into the stage's
   * light. NPCs, enemies and Wren live in other modules and paint themselves
   * with several drawImage calls at hand-tuned offsets; rather than reach into
   * three files to thread a palette through, the palette is applied at the
   * canvas boundary. Everything else on the context passes straight through.
   */
  tintCtx(ctx) {
    if (!this.sky || !ctx) return ctx;
    if (this._tctxSrc === ctx && this._tctx) return this._tctx;
    const world = this;
    this._tctxSrc = ctx;
    this._tctx = new Proxy(ctx, {
      get(t, k) {
        if (k === 'drawImage') {
          return (img, ...rest) => t.drawImage(world.tint(img), ...rest);
        }
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
      set(t, k, v) { t[k] = v; return true; },
    });
    return this._tctx;
  }

  /** The whole board minus the actors the scene owns. */
  drawTerrain(ctx, engine, sky) {
    const s = this.screen;
    const frame = engine.frame;
    this.sky = sky || null;
    if (s.def.interior) {
      ctx.fillStyle = sky ? sky.shade('#101018', true) : '#101018';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.drawImage(sky ? sky.tint(s.landLayer, true) : s.landLayer, 0, 0);
      return;
    }
    // 1. the air itself: four solid depth zones, pale at the horizon and dark
    //    down the shaft
    ctx.drawImage(sky ? sky.tint(s.voidBase) : s.voidBase, 0, 0);
    // 2. the weather. Far deck first (slow, low contrast, high in the frame),
    //    then the lesser isles and traffic, then the near deck — which
    //    OCCLUDES both, and is the parallax.
    const f = voidFields();
    const wind = sky ? sky.windScale : 1;
    this._wrapX(ctx, sky ? sky.tint(f.far) : f.far, frame * 0.075 * wind);
    for (const p of s.def.voidProps || []) {
      const img = this.sprites[p.sprite];
      if (!img) continue;
      const dx = Math.round(p.x - frame * (p.drift || 0.02) * wind) % (WIDTH + 96);
      ctx.drawImage(sky ? sky.tint(img) : img,
        dx < -80 ? dx + WIDTH + 96 : dx,
        Math.round(p.y + Math.sin(frame / (p.bob || 180) + (p.phase || 0)) * 1.5));
    }
    this._wrapX(ctx, sky ? sky.tint(f.near) : f.near, frame * 0.20 * wind);
    // 3. the risers, climbing past a falling island
    this.drawRisers(ctx, frame, wind, sky);
    // 4. the isle's own shadow, laid back over the cloud that just drifted
    //    under it. Without this the isle floats ON the clouds instead of over
    //    a hole in them.
    ctx.drawImage(sky ? sky.tint(s.voidShade) : s.voidShade, 0, 0);
    // 5. the island
    ctx.drawImage(sky ? sky.tint(s.landLayer) : s.landLayer, 0, 0);
    // 6. the rope bridge, swinging on its own
    if (s.swayLayer) {
      const r = s.swayRect;
      const img = sky ? sky.tint(s.swayLayer) : s.swayLayer;
      ctx.drawImage(img, r.x, r.y + this.swayOffset(frame));
    }
  }

  /**
   * Torn wisps climbing the frame. Their tone is chosen from the depth zone
   * they are passing through, so one wisp fades toward the haze as it rises
   * and the whole field reads as recession rather than as confetti.
   */
  drawRisers(ctx, frame, wind, sky) {
    const span = HEIGHT + 44;
    // Snapped: the sky stage's LUT interpolates, so a wisp tone came back off
    // the 5-bit grid and put two colours on screen a SNES could not address.
    const shade = (hex) => snap5(sky ? sky.shade(hex) : hex);
    // Two tones, both already spent on the decks: a wisp near the horizon is
    // barely off the pale air, one down the shaft is the deck's own crown tone
    // against the darkest blue on the screen. A third, brighter entry bought
    // 0.2% of the frame and a whole palette slot.
    const TONE = [
      shade(VOID.cloudMid),
      shade(VOID.cloudHi),
      shade(VOID.cloudHi),
    ];
    for (const r of RISERS) {
      let y = (r.y - frame * r.spd * wind) % span;
      if (y < 0) y += span;
      y -= 22;
      if (y < -2 || y >= HEIGHT) continue;
      ctx.fillStyle = TONE[y < HEIGHT * 0.34 ? 0 : y < HEIGHT * 0.66 ? 1 : 2];
      for (const [dx, w] of r.segs) ctx.fillRect((r.x + dx) % WIDTH, y, w, 1);
      if (r.belly && y + 1 < HEIGHT) {
        ctx.fillRect((r.x + r.belly[0]) % WIDTH, y + 1, r.belly[1], 1);
      }
    }
  }

  /** How far the Windrope is hanging below its pegs this frame (0..2 px). */
  swayOffset(frame) {
    const idle = Math.sin(frame / 23) * 1.4;
    const g = this.gust;
    if (!g) return Math.round(1 + idle);
    // The planks are what the air hits first, so the deck leans INTO the slug
    // and carries the swing all the way through it: STORY.md wants the ground
    // to argue, and a rope bridge that shifts two pixels is not arguing.
    return Math.round(1 + idle * (1 - g.power * 0.5) + g.dir * g.power * 3.4);
  }

  /**
   * Blit a cloud deck, wrapping HORIZONTALLY only. The vertical axis of a deck
   * carries its depth grading — where in the frame it is allowed to exist and
   * how much contrast it has there — so scrolling it vertically would slide
   * the near deck up into the horizon. Vertical motion belongs to the risers.
   */
  _wrapX(ctx, img, ox) {
    const w = img.width;
    const x0 = -(((ox % w) + w) % w);
    for (let x = x0; x < WIDTH; x += w) ctx.drawImage(img, Math.round(x), 0);
  }

  /** Flat animated decoration that belongs UNDER the actors. */
  drawGround(ctx, engine) {
    const s = this.screen;
    const t = engine.frame;
    const sway = (t % 60) < 30 ? '1' : '2';
    for (const [color, x, y] of s.def.flowers || []) {
      const img = this.sprites[`flower_${color}${sway}`];
      if (img) ctx.drawImage(this.tint(img), x, y);
    }
    const tc = this.tintCtx(ctx);
    // Anything that leaves the ground casts onto the terrain BEFORE anything
    // stands on it. Asking for drawShadow instead of naming a kind is the
    // point: the gear-bat and the steam slime both have one, the beetle does
    // not, and the next flyer will not need this line edited.
    for (const b of s.enemies) if (b.drawShadow) b.drawShadow(tc);
  }

  /** Y-sortable drawables from the world (decor, objects, enemies). */
  drawables(engine) {
    const s = this.screen;
    const out = [];
    const tint = (img) => this.tint(img);
    for (const ob of s.map.obstacles) {
      if (ob.img) out.push({ baseY: ob.baseY, draw: (c) => c.drawImage(tint(ob.img), ob.x, ob.y) });
    }
    for (const e of s.entities) {
      if (e.dead || e.taken) continue;
      if (e instanceof Bush || e instanceof Pot || e instanceof Chest || e instanceof GearGate) {
        out.push({ baseY: e.baseY, draw: (c) => e.draw(c, engine.frame, tint) });
      }
    }
    // Signs come from game/npc.js and draw themselves untinted; their art is
    // ours, so blit it here rather than reach into their module.
    for (const sg of s.signs) {
      out.push({
        baseY: sg.baseY,
        draw: (c) => c.drawImage(tint(sg.img), Math.round(sg.x), Math.round(sg.y)),
      });
    }
    for (const n of s.npcs) out.push({ baseY: n.baseY, draw: (c) => n.draw(this.tintCtx(c)) });
    for (const p of s.pieces) {
      if (!p.taken) out.push({ baseY: p.baseY, draw: (c) => p.draw(c, engine.frame, tint) });
    }
    for (const d of this.drops) {
      out.push({ baseY: d.baseY, draw: (c) => d.draw(c, engine.frame, tint) });
    }
    for (const t of this.thrown) {
      out.push({ baseY: t.baseY, draw: (c) => t.draw(c, engine.frame, tint) });
    }
    for (const e of s.enemies) {
      if (e.dead) continue;
      if (airborne(e)) continue;
      out.push({ baseY: e.baseY, draw: (c) => e.draw(this.tintCtx(c)) });
    }
    return out;
  }

  /** Airborne + effect passes, drawn above everything on the ground. */
  drawOver(ctx, engine) {
    const s = this.screen;
    this.drawWind(ctx, engine);
    for (const e of s.enemies) if (airborne(e)) e.draw(this.tintCtx(ctx));
    for (const fx of this.effects) {
      const img = this.sprites.leaves[Math.min(3, fx.t >> 2)];
      if (img) ctx.drawImage(this.tint(img), Math.round(fx.x), Math.round(fx.y));
    }
    // animated structures: windmill vanes, steam puffs, gulls
    for (const a of s.animated || []) {
      if (a.kind === 'vanes') {
        const set = this.sprites[a.sprite || 'vanes'];
        ctx.drawImage(this.tint(set[Math.floor(engine.frame / (a.speed || 7)) % 4]), a.x, a.y);
      } else if (a.kind === 'puff') {
        const f = Math.floor(((engine.frame + (a.phase || 0)) % (a.period || 96)) / 24);
        if (f < 4) ctx.drawImage(this.tint(this.sprites.puff[f]), a.x, a.y - f * 3);
      } else if (a.kind === 'gull') {
        const t = engine.frame * (a.speed || 0.35) + (a.phase || 0);
        const x = a.x + ((t | 0) % (WIDTH + 40)) - 20;
        const y = a.y + Math.round(Math.sin(t / 26) * 5);
        const set = (a.dir === 'left') ? this.sprites.gullL : this.sprites.gull;
        ctx.drawImage(this.tint(set[(Math.floor(t / 7) & 1)]), Math.round(x), y);
      }
    }
  }
}

export default Overworld;
