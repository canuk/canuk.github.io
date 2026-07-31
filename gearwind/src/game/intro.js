// Gearwind — INTRO. Beat 1 of STORY.md, told in four painted panels.
//
// Panels are PIXEL ART, not text on black. Each is composed once at init into
// a 256x224 offscreen buffer and then blitted; only cheap overlays animate
// (the liftstone's glow breathes, panel two's cloud deck drifts, the Carrion
// Wing's propellers turn). The narration rides in the project's own ALttP
// message window — dialog.js's DialogBox, imported, not reimplemented.
//
// Two techniques carry the art:
//
//  MATERIAL RAMPS + ONE LIGHT PASS (panel one). The engine room is painted
//  into two parallel arrays — material id and ramp index — instead of into
//  pixels. A resolve pass then pushes every pixel UP ITS OWN MATERIAL RAMP by
//  an amount that falls off with distance from the liftstone, ordered-dithering
//  the fractional part. So the light pool costs zero extra colours: brass lit
//  by the stone is brass two steps brighter, and the falloff is a Bayer weave
//  between two ramp stops. Three strengths are baked and cycled, which is how
//  the glow breathes without re-resolving 57k pixels a frame.
//
//  AUTHORED MASK + DETERMINISTIC FACET SHADER (the liftstone itself). The gem's
//  silhouette is a hand-authored 26x33 mask; the facets come from a shader that
//  reads each row's span and cuts it into a white spine, two cyan stops and a
//  deep shadow side, with a girdle break two-thirds down. Same grammar as the
//  logo's bevel in titlescreen.js.
//
//   const intro = new Intro({ onDone: () => ... });
//   intro.update(dt, engine); intro.draw(ctx);
//
// START skips the whole sequence. A advances a page.
import { makeSprite } from '../sprites.js';
import { DialogBox } from './dialog.js';
import { surface, rng, paintSky, makeCloudStrip, paintIsland, BAYER, CLOUD, cloudPal } from './titlescreen.js';

const W = 256, H = 224;

// ---------------------------------------------------------------------------
// THE LIFTSTONE. Authored silhouette; facets applied by shader.
// ---------------------------------------------------------------------------
const GEM_MASK = [
  '...........####...........',
  '.........########.........',
  '.......############.......',
  '.....################.....',
  '...####################...',
  '..######################..',
  '.########################.',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '##########################',
  '.########################.',
  '..######################..',
  '...####################...',
  '.....################.....',
  '.......############.......',
  '.........########.........',
  '...........####...........',
];
const GEM_PAL = { k: '#0e2038', W: '#ffffff', C: '#bdf0ff', B: '#5cc0e8', D: '#2a6ba8', d: '#1b4a7c' };

/**
 * Cut a gem out of a silhouette. Facet stops are fractions of each row's own
 * span, so the crown and the pavilion get facets that follow the outline
 * instead of a grid pasted over it. `girdle` is the row where the stone's
 * widest belt sits; below it every stop drops one step darker, which is what
 * makes the bottom half read as the pavilion and not as more crown.
 */
function makeGem(mask, pal, girdle) {
  const h = mask.length, w = mask[0].length;
  const { cv, g } = surface(w, h);
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  for (let y = 0; y < h; y++) {
    const row = mask[y];
    const x0 = row.indexOf('#'), x1 = row.lastIndexOf('#');
    if (x0 < 0) continue;
    const span = x1 - x0 + 1;
    const below = y > girdle;
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / span;
      let c;
      if (x === x0 || x === x1 || y === 0 || y === h - 1 ||
          (mask[y - 1] && mask[y - 1][x] !== '#') || (mask[y + 1] && mask[y + 1][x] !== '#')) {
        c = pal.k;
      } else if (u < 0.11) c = below ? pal.C : pal.W;
      else if (u < 0.30) c = below ? pal.B : pal.C;
      else if (u < 0.52) c = below ? pal.D : pal.B;
      else c = below ? pal.d : pal.D;
      px(x, y, c);
    }
  }
  // specular: a hard 2x5 chip on the upper-left crown, and its little echo
  for (let i = 0; i < 5; i++) px(6 + Math.floor(i / 3), 8 + i, pal.W);
  px(9, 6, pal.W); px(10, 6, pal.W); px(9, 7, pal.C);
  return cv;
}
const STONE = makeGem(GEM_MASK, GEM_PAL, 21);

// A shard of it — what Vane leaves behind, and what hangs in the claw.
const SHARD = makeSprite([
  '..kk....',
  '.kWCk...',
  'kWCBDk..',
  'kCBBDDk.',
  'kCBDDDk.',
  '.kBDDDk.',
  '.kBDDk..',
  '..kDDk..',
  '..kDk...',
  '...k....',
], GEM_PAL);

// ---------------------------------------------------------------------------
// Aeronaut Wren from behind at the rail: sandy hair under the brass goggle
// strap, teal courier coat lit from the upper left, the satchel strap walking
// down across her back one pixel a row, the parcel under her right arm, work
// boots. 28x52 — twice the game sprite, because in a story panel she is the
// subject and not a token on a map.
// ---------------------------------------------------------------------------
const WREN = makeSprite([
  '..........kkkkkkkk..........',
  '........kkhhhhhhhhkk........',
  '.......khhHHHHHHhhjhk.......',
  '......khhHHHHHHHHhhjhk......',
  '.....khHHHHHHHHHHhhjhhk.....',
  '.....khHHHHHHHHHhhhjhhk.....',
  '.....khhHHHHHHHhhhjjhhk.....',
  '....kbbbbbbbbbbbbbbbbbbk....',
  '....kbbbBBbbbbbbbbbbbbbk....',
  '....kbbbbbbbbbbbbbbbbbbk....',
  '.....khhHHHHhhhhjjhhhhk.....',
  '.....khhhHHHhhhhjjhhhhk.....',
  '......khhhhhhhhjjhhhhk......',
  '.......kkhhhhhhhhhhkk.......',
  '.........kkkkkkkkkk.........',
  '......kttttttttttttttk......',
  '....kkttTTTTTTTTTTttttkk....',
  '..kkdttTTTTTTTTTTTTttttddkk.',
  '.kkdttttTTTTTTTTTTttttttddk.',
  'kkdtttttTTTTTTTTTTttttttddkk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdtLLtTTTTTTTTTTttttttttttdk',
  'kdttLLTTTTTTTTTTttttttttttdk',
  'kdtttLLTTTTTTTTTttttttttttdk',
  'kdttttLLTTTTTTTTttttttttttdk',
  'kdttttTLLTTTTTTTttttttttttdk',
  'kdttttTTLLTTTTTTttttttttttdk',
  'kdttttTTTLLTTTTTttttttttttdk',
  'kdttttTTTTLLTTTTttttttttttdk',
  'kdttttTTTTTLLTTTttttttttttdk',
  'kdttttTTTTTTLLTTttttttttttdk',
  'kdttttTTTTTTTLLTttttttttttdk',
  'kdttttTTTTTTTTLLttttttttttdk',
  'kdttttTTTTTTTTTLLtttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kdttttTTTTTTTTTTttttttttttdk',
  'kddddddddddddddddddddddddddk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '.......knnnnk...knnnnk......',
  '.......knnnnk...knnnnk......',
  '.......knnnnk...knnnnk......',
  '.......knnnnk...knnnnk......',
  '.......kllllk...kllllk......',
  '.......kLLLLk...kLLLLk......',
  '......kkLLLLkk.kkLLLLkk.....',
  '......kkkkkkkk.kkkkkkkk.....',
], {
  k: '#181420',
  // Hair needs three values or the head is a dome: base, sunlit crown, and a
  // shadow value for the parting and the strands behind the ear.
  h: '#8a5c28', H: '#c89a4c', j: '#523415',
  // The goggle strap is DARK LEATHER with one brass buckle. Painting the strap
  // in brass put it within two luma steps of the hair and it vanished.
  b: '#3c2a14', B: '#e0b45c',
  t: '#2f7f86', T: '#46a8ae', d: '#1d565e',
  n: '#33291a', l: '#6b4526', L: '#96682f',
  w: '#d8c8a4', W: '#f4ecd4',
});

// The parcel Wren is carrying: brown paper, twine cross, a red wax seal.
const PARCEL = makeSprite([
  'kkkkkkkkkkkkkk',
  'kWWWWWkWWWWWWk',
  'kWWWWWkWWWWWWk',
  'kwwwwwkwwwwwwk',
  'kkkkkkkkkkkkkk',
  'kwwwwwkwwwwwwk',
  'kwwwwSSwwwwwwk',
  'kwwwwSSwwwwwwk',
  'kwwwwwkwwwwwwk',
  'kwwwwwkwwwwwwk',
  'kmmmmmkmmmmmmk',
  'kkkkkkkkkkkkkk',
], { k: '#3a2a18', W: '#e8d8b0', w: '#c8b48c', m: '#9a8460', S: '#a83232' });

// The Carrion Wing's mark: a scavenger with its wings out, stamped in dull red
// on the gasbag. Two reds and a maroon keyline — a brand burned into canvas.
const CARRION_MARK = makeSprite([
  '...............kkrrrrkk...............',
  '...............krrrrrrk...............',
  '...............krrrrrrk...............',
  '...............kkrRRrkk...............',
  '...........kkkkkkrRRrkkkkkk...........',
  '.......kkkkkrrrrrrRRrrrrrrkkkkk.......',
  '...kkkkkrrrrrrrrrrRRrrrrrrrrrrkkkkk...',
  'kkkkrrrrrrrrrrrrrrRRrrrrrrrrrrrrrrkkkk',
  'krrrrrrrrrrrrrrrrrRRrrrrrrrrrrrrrrrrrk',
  'rrrrrrrrrrrrrrrrrrRRrrrrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrrrrRRrrrrrrrrrrrrrrrrrr',
  'rrrrrrrrrkkkkkkkrrRRrrkkkkkkkrrrrrrrrr',
  'krrrrrrrrrkk...krrRRrrk...kkrrrrrrrrrk',
  'kkkrrrrrrrrkk..krrRRrrk..kkrrrrrrrrkkk',
  '..kkkrrrrrrrkk.kkrRRrkk.kkrrrrrrrkkk..',
  '....kkkrrrrrrk..krRRrk..krrrrrrkkk....',
  '......kkkrrrrk..krRRrk..krrrrkkk......',
  '........kkkkkk.kkrRRrkk.kkkkkk........',
  '...............krrRRrrk...............',
  '..............kkrrRRrrkk..............',
  '..............krrrRRrrrk..............',
  '..............kkrrRRrrkk..............',
], { k: '#3c1010', r: '#a83232', R: '#d4604a' });

// Cottage on Bellows Isle: ochre wall, slate gable, one lit window.
const COTTAGE = makeSprite([
  '........kk........',
  '.......kSSk.......',
  '......kSSSSk......',
  '.....kSSSSSSk.....',
  '....kSSSSSSSSk....',
  '...kSSSSSSSSSSk...',
  '..kSSSSSSSSSSSSk..',
  '.kSSSSSSSSSSSSSSk.',
  'kkkkkkkkkkkkkkkkkk',
  '.kwwwwwwwwwwwwwwk.',
  '.kwWWwwwwwwwwWWwk.',
  '.kwWWwwwwwwwwWWwk.',
  '.kwwwwwwwwwwwwwwk.',
  '.kwwwwkdddkwwwwwk.',
  '.kwwwwkdddkwwwwwk.',
  '.kwwwwkdddkwwwwwk.',
  '.kkkkkkkkkkkkkkkk.',
], { k: '#241a10', S: '#4f5a66', w: '#b98c48', W: '#ffd070', d: '#241a10' });

// ---------------------------------------------------------------------------
// Shared island palettes. `hi` is the BRIGHT course lip, `lit` the sunlit
// shelf, `mid` the body, `low` the shadow the next course sits in — the order
// paintIsland expects. Getting hi and lit the wrong way round flattens the
// whole cliff, which is exactly what the first pass of this file did.
// ---------------------------------------------------------------------------
const FAR_ISLE = {
  out: '#1c2c52', lit: '#37507e', deep: '#1e2c4c', hi: '#465e8e', mid: '#2d4066', low: '#243354',
  grass: '#2d5a52', grassHi: '#42806e', grassDk: '#243354',
};
const MID_ISLE = {
  out: '#1a1208', lit: '#6b5732', deep: '#1a1208', hi: '#8a7546', mid: '#4f3f27', low: '#3a2d1c',
  grass: '#2b6a30', grassHi: '#3f8b42', grassDk: '#1f4f24',
};
const NEAR_ISLE = {
  out: '#1a1208', lit: '#87703c', deep: '#1a1208', hi: '#b09a5e', mid: '#5a4327', low: '#332618',
  grass: '#307030', grassHi: '#489848', grassDk: '#256026',
};

// A cool blue sky ramp, deliberately the SAME family as the title screen's.
// An early pass warmed the low stops toward sand and every outdoor panel read
// as a beach with a boardwalk on it.
const DAY_SKY = [
  { y: 0, c: '#152449' },
  { y: 40, c: '#223c72' },
  { y: 84, c: '#315f98' },
  { y: 128, c: '#437cb6' },
  { y: 176, c: '#619ecc' },
  { y: 224, c: '#8cb8dc' },
];

function smallSail(size, r, ang, pal) {
  const { cv, g } = surface(size, size);
  const c = (size - 1) / 2;
  const px = (x, y, col) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  };
  for (let s = 0; s < 4; s++) {
    const th = ang + s * Math.PI / 2;
    const dx = Math.cos(th), dy = Math.sin(th);
    const nx = -dy, ny = dx;
    const cloth = (dx + dy > 0.1) ? pal.d : pal.l;
    for (let t = 2; t <= r; t += 0.5) {
      for (let u = -2; u <= 2; u++) {
        px(c + dx * t + nx * u, c + dy * t + ny * u,
          Math.abs(u) === 2 ? pal.k : (Math.round(t) % 3 === 0 ? pal.d : cloth));
      }
    }
  }
  px(c, c, pal.k);
  return cv;
}

// ---------------------------------------------------------------------------
// Panel 1 — THE LIFTSTONE
// ---------------------------------------------------------------------------
const WALL = ['#141020', '#1e1828', '#2b2338', '#382e48', '#463a5c', '#544668', '#665780'];
const FLOOR = ['#161208', '#241d12', '#2f2516', '#3b2f1e', '#4a3a26', '#57462d', '#685338'];
const BRASS = ['#2a1c08', '#4a3212', '#63451a', '#7a5620', '#956a2a', '#b98c48', '#e8c274'];
const IRON = ['#101018', '#1e1828', '#252534', '#33334a', '#414156', '#4e4e66', '#646484'];
const COPPER = ['#221010', '#3d1e18', '#5a3024', '#7a4632', '#9c5f42', '#c07c52', '#dda068'];
const GLASS = ['#0e1a1e', '#16292c', '#22403e', '#2e5852', '#3c7468', '#4e9280', '#6ab29a'];
const RAMPS = [WALL, FLOOR, BRASS, IRON, COPPER, GLASS];

function paintRoom() {
  const mat = new Uint8Array(W * H);
  const idx = new Uint8Array(W * H);
  const set = (x, y, m, i) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    mat[y * W + x] = m; idx[y * W + x] = i;
  };
  const rect = (x, y, w, h, m, i) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, m, i);
  };

  const FLOORY = 154;
  // riveted back wall
  rect(0, 0, W, FLOORY, 0, 1);
  for (let x = 0; x < W; x += 32) rect(x, 0, 1, FLOORY, 0, 0);
  for (let y = 0; y < FLOORY; y += 26) {
    rect(0, y, W, 1, 0, 0);
    for (let x = 4; x < W; x += 8) set(x, y - 1, 0, 2);
  }

  // pipe runs across the top
  const pipe = (y, h, m) => {
    for (let x = 0; x < W; x++) {
      set(x, y, 3, 0);
      set(x, y + 1, m, 6);
      for (let k = 2; k < h - 1; k++) set(x, y + k, m, k === 2 ? 5 : k === 3 ? 4 : 3);
      set(x, y + h - 1, 3, 1);
    }
    for (let x = 10; x < W; x += 46) rect(x, y - 1, 4, h + 2, m, 4);
  };
  pipe(10, 9, 2);
  pipe(26, 7, 4);   // copper run, so the ceiling is not one alloy

  // vertical downpipes at the sides
  for (const cx of [16, 240]) {
    for (let y = 34; y < FLOORY; y++) {
      set(cx - 4, y, 3, 0); set(cx + 4, y, 3, 0);
      set(cx - 3, y, 2, 6); set(cx - 2, y, 2, 5);
      for (let k = -1; k <= 2; k++) set(cx + k, y, 2, 3);
      set(cx + 3, y, 2, 2);
      // rust bleeding out of the joints
      if (((x2 => 0)(0), (y % 34) > 26)) set(cx + 3, y, 4, 2);
    }
    for (let y = 46; y < FLOORY; y += 34) rect(cx - 5, y, 11, 4, 4, 4);
  }

  // a valve wheel on the left wall, spoked, with its stem
  const VX = 48, VY = 62;
  for (let a = 0; a < 200; a++) {
    const th = (a / 200) * Math.PI * 2;
    for (let rr = 15; rr <= 17; rr++) set(VX + Math.cos(th) * rr, VY + Math.sin(th) * rr, 4, rr === 15 ? 6 : 4);
  }
  for (let s = 0; s < 4; s++) {
    const th = s * Math.PI / 2 + 0.4;
    for (let t = 0; t < 16; t++) set(VX + Math.cos(th) * t, VY + Math.sin(th) * t, 4, 4);
  }
  rect(VX - 3, VY - 3, 7, 7, 4, 6);
  rect(VX - 2, VY + 17, 5, 22, 2, 3);
  rect(VX - 5, VY + 38, 11, 5, 2, 4);

  // a pressure gauge on the right wall
  const GX = 210, GY = 58;
  for (let a = 0; a < 200; a++) {
    const th = (a / 200) * Math.PI * 2;
    for (let rr = 11; rr <= 13; rr++) set(GX + Math.cos(th) * rr, GY + Math.sin(th) * rr, 2, rr === 11 ? 4 : 3);
  }
  for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
    if (x * x + y * y <= 100) set(GX + x, GY + y, 5, x + y < -4 ? 5 : x + y > 6 ? 2 : 3);
  }
  for (let t = 0; t < 9; t++) set(GX + t * 0.7, GY - t * 0.72, 0, 0);
  rect(GX - 2, GY + 13, 5, 24, 2, 2);

  // hanging chain, left of centre
  for (let y = 36; y < 104; y += 4) {
    set(84, y, 3, 2); set(85, y, 3, 1);
    set(84, y + 1, 3, 0); set(85, y + 1, 3, 2);
    set(84, y + 2, 3, 1); set(85, y + 2, 3, 2);
  }
  rect(80, 104, 10, 7, 3, 1);
  rect(81, 105, 8, 2, 3, 2);

  // stamped brass plaque
  rect(160, 92, 34, 16, 4, 1);
  rect(161, 93, 32, 14, 4, 4);
  rect(162, 94, 30, 1, 4, 6);
  rect(162, 106, 30, 1, 4, 2);
  for (let i = 0; i < 5; i++) rect(165 + i * 6, 98, 4, 6, 4, 0);

  // floor plates
  rect(0, FLOORY, W, H - FLOORY, 1, 1);
  for (let y = FLOORY; y < H; y += 12) rect(0, y, W, 1, 1, 0);
  for (let x = 0; x < W; x += 24) rect(x, FLOORY, 1, H - FLOORY, 1, 0);
  for (let y = FLOORY + 6; y < H; y += 12) for (let x = 12; x < W; x += 24) set(x, y, 1, 3);

  // THE CRADLE — a brass claw grown out of a riveted drum
  const CX = 128, DRUM = 138;
  for (let y = DRUM; y < DRUM + 22; y++) {
    const hw = 26 + Math.round((y - DRUM) * 0.5);
    for (let x = CX - hw; x <= CX + hw; x++) {
      const f = x - (CX - hw);
      let i;
      if (x === CX - hw || x === CX + hw) i = 0;
      else if (f <= 3) i = 4;
      else if (x > CX + hw - 5) i = 1;
      else i = ((y - DRUM) % 6 === 0) ? 1 : 3;
      set(x, y, 2, i);
    }
  }
  const claw = (x0, bend, x1, yTop, wide) => {
    for (let t = 0; t <= 1.0001; t += 0.008) {
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * bend + t * t * x1;
      const y = DRUM - t * (DRUM - yTop);
      const hw = wide - t * (wide * 0.45);
      for (let k = -Math.ceil(hw) - 1; k <= Math.ceil(hw) + 1; k++) {
        const i = Math.abs(k) > hw ? 0 : (k < -hw + 2 ? 4 : k > hw - 2 ? 1 : 3);
        set(Math.round(x + k), Math.round(y), 2, i);
      }
    }
  };
  claw(CX - 34, CX - 48, CX - 17, 88, 4);
  claw(CX + 34, CX + 48, CX + 17, 88, 4);
  claw(CX, CX - 2, CX, 84, 5);
  return { mat, idx };
}

/** Resolve the room at one light strength into a finished canvas. */
function bakeRoom(room, strength) {
  const { cv, g } = surface(W, H);
  const LX = 128, LY = 76;
  const img = g.createImageData(W, H);
  const d = img.data;
  const cache = new Map();
  const rgb = (hex) => {
    let v = cache.get(hex);
    if (!v) { v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; cache.set(hex, v); }
    return v;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const dist = Math.hypot(x - LX, (y - LY) * 1.12);
      let lift = strength - dist / 27;
      if (lift < 0) lift = 0;
      let n = Math.floor(lift);
      if (BAYER[y & 3][x & 3] < (lift - n) * 16) n++;
      const ramp = RAMPS[room.mat[p]];
      const c = rgb(ramp[Math.min(ramp.length - 1, room.idx[p] + n)]);
      d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; d[p * 4 + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// ---------------------------------------------------------------------------
// Panel 2 — THE ISLES
// ---------------------------------------------------------------------------
function panelIsles() {
  const { cv, g } = surface(W, H);
  paintSky(g, W, H, DAY_SKY);
  g.drawImage(makeCloudStrip(W, 34, {
    seed: 6, count: 4, minW: 70, maxW: 130, hMin: 4, hMax: 8, baseY0: 20, baseY1: 30,
    pal: { crown: CLOUD[4], light: CLOUD[5], body: CLOUD[5], shade: CLOUD[6], edge: CLOUD[6] },
  }), 0, 30);

  paintIsland(g, { cx: 30, lidY: 62, halfW: 13, depth: 12, jitter: 1, seed: 91, pal: FAR_ISLE });
  paintIsland(g, { cx: 228, lidY: 46, halfW: 10, depth: 9, jitter: 1, seed: 33, pal: FAR_ISLE });
  paintIsland(g, { cx: 208, lidY: 92, halfW: 30, depth: 23, jitter: 2, seed: 17, pal: MID_ISLE });

  g.drawImage(makeCloudStrip(W, 32, {
    seed: 14, count: 4, minW: 60, maxW: 120, hMin: 6, hMax: 12, baseY0: 18, baseY1: 28, pal: cloudPal(2),
  }), 0, 96);

  // rope-lift: a cable from Bellows' rim up to the mid isle, with a car on it
  for (let t = 0; t <= 1; t += 0.004) {
    const x = Math.round(162 + 46 * t);
    const y = Math.round(102 - 14 * t + Math.sin(t * Math.PI) * 6);
    g.fillStyle = '#1a1208'; g.fillRect(x, y, 1, 1);
    if (t > 0.02 && t < 0.98) g.fillRect(x, y + 1, 1, 1);
  }
  g.fillStyle = '#1a1208'; g.fillRect(182, 100, 11, 11);
  g.fillStyle = '#7a5620'; g.fillRect(183, 101, 9, 9);
  g.fillStyle = '#dfae54'; g.fillRect(183, 101, 9, 1);
  g.fillStyle = '#0e0a06'; g.fillRect(185, 104, 5, 5);

  // BELLOWS ISLE
  paintIsland(g, { cx: 96, lidY: 112, halfW: 72, depth: 44, jitter: 4, seed: 5, pal: NEAR_ISLE, chains: true });
  g.drawImage(COTTAGE, 42, 94);
  g.drawImage(COTTAGE, 66, 96);
  g.drawImage(COTTAGE, 104, 95);
  // windmill on the high ground
  const millPal = { k: '#1a1208', d: '#9c8757', l: '#e2d2a8' };
  for (let y = 0; y < 26; y++) {
    const hw = 4 + Math.round(y * 0.12);
    for (let x = -hw; x <= hw; x++) {
      g.fillStyle = (x === -hw || x === hw) ? millPal.k : (x < 0 ? '#8b7448' : '#4c3d26');
      g.fillRect(140 + x, 88 + y, 1, 1);
    }
    if (y % 6 === 0) for (let x = -hw + 1; x < hw; x++) { g.fillStyle = '#33291a'; g.fillRect(140 + x, 88 + y, 1, 1); }
  }
  g.drawImage(smallSail(29, 13, 0.5, millPal), 140 - 14, 84 - 14);

  // a courier skiff crossing high up
  g.drawImage(makeSprite([
    '....kkkkkkkk....',
    '..kkWWWWWWWWkk..',
    '.kWWwwwwwwwwWWk.',
    'kWwwwwwwwwwwwwWk',
    'kwvvvvvvvvvvvvwk',
    '.kvvvvvvvvvvvvk.',
    '..kkvvvvvvvvkk..',
    '....kkkkkkkk....',
    '......kbbk......',
    '.....kbBBbk.....',
    '.....kkkkkk.....',
  ], { k: '#1a1208', W: CLOUD[2], w: CLOUD[4], v: CLOUD[5], b: '#7a5620', B: '#dfae54' }), 44, 40);
  return cv;
}

// ---------------------------------------------------------------------------
// Panel 3 — THE COURIER
// ---------------------------------------------------------------------------
function panelCourier() {
  const { cv, g } = surface(W, H);
  paintSky(g, W, H, DAY_SKY);
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const woodA = '#8a6a3e', woodB = '#a8813f', woodC = '#6b4f2c', woodK = '#28200f';

  g.drawImage(makeCloudStrip(W, 34, {
    seed: 77, count: 4, minW: 60, maxW: 130, hMin: 5, hMax: 11, baseY0: 20, baseY1: 30, pal: cloudPal(3),
  }), 0, 26);
  paintIsland(g, { cx: 212, lidY: 52, halfW: 24, depth: 18, jitter: 2, seed: 8, pal: FAR_ISLE });
  paintIsland(g, { cx: 46, lidY: 40, halfW: 12, depth: 10, jitter: 1, seed: 44, pal: FAR_ISLE });
  g.drawImage(makeCloudStrip(W, 38, {
    seed: 78, count: 6, minW: 70, maxW: 140, hMin: 9, hMax: 16, baseY0: 24, baseY1: 36, pal: cloudPal(0),
  }), 0, 74);

  // --- the moored skiff, port side on ------------------------------------
  // Gasbag, rigging, hull, stern prop ring. Built in that order so the ropes
  // pass behind the hull and the ring reads as hardware bolted to the transom.
  const SBX = 44, SBY = 56;                                 // gasbag centre
  for (let yy = -9; yy <= 9; yy++) {
    const hw = Math.round(34 * Math.sqrt(Math.max(0, 1 - (yy / 9) ** 2)));
    for (let x = -hw; x <= hw; x++) {
      px(SBX + x, SBY + yy, Math.abs(x) === hw || Math.abs(yy) === 9 ? woodK
        : yy < -5 ? CLOUD[0] : yy < -1 ? CLOUD[1] : yy < 4 ? CLOUD[3] : CLOUD[4]);
    }
  }
  for (const rx of [-22, 0, 22]) {
    for (let yy = 0; yy < 20; yy++) px(SBX + rx + Math.round(yy * rx / -90), SBY + 9 + yy, woodK);
  }
  const HX = 14, HY0 = 86;
  for (let yy = 0; yy < 24; yy++) {
    const inset = Math.round(yy * yy * 0.045);
    for (let x = inset; x < 62 - inset; x++) {
      px(HX + x, HY0 + yy, yy === 0 || x === inset || x === 61 - inset ? woodK
        : yy < 3 ? '#dfae54' : yy > 19 ? '#3a2a18' : ((yy & 3) === 0 ? '#ab7c34' : '#7a5620'));
    }
  }
  for (let a2 = 0; a2 < 110; a2++) {
    const th = (a2 / 110) * Math.PI * 2;
    px(Math.round(86 + Math.cos(th) * 12), Math.round(98 + Math.sin(th) * 12), woodK);
    px(Math.round(86 + Math.cos(th) * 11), Math.round(98 + Math.sin(th) * 11), '#ab7c34');
  }
  for (let b2 = 0; b2 < 3; b2++) {
    const th = b2 * Math.PI * 2 / 3 + 0.5;
    for (let t = 0; t < 11; t += 0.5) {
      px(Math.round(86 + Math.cos(th) * t), Math.round(98 + Math.sin(th) * t), '#7a5620');
      px(Math.round(86 + Math.cos(th) * t), Math.round(99 + Math.sin(th) * t), woodK);
    }
  }
  px(86, 98, '#dfae54');
  for (let x = 72; x < 86; x++) px(x, 98, woodK);

  // --- the dock: boards running away from the camera. Only the bottom third
  // of the frame: an earlier pass gave the planking half the panel and the
  // shot read as a boardwalk instead of a skyharbor. ----------------------
  const DECK = 112;
  let y = DECK, step = 4;
  while (y < H) {
    for (let yy = y; yy < y + step && yy < H; yy++) {
      for (let x = 0; x < W; x++) {
        const grain = ((x * 7 + yy * 3) & 15) === 0;
        px(x, yy, yy === y ? woodK : yy === y + 1 ? woodB : yy === y + step - 1 ? woodC : (grain ? woodC : woodA));
      }
    }
    y += step; step += 2;
  }
  g.fillStyle = woodC; g.fillRect(0, DECK - 4, W, 2);
  g.fillStyle = woodK; g.fillRect(0, DECK - 2, W, 2);

  // --- mooring posts and a sagging rope -----------------------------------
  const post = (x, top, h, w) => {
    for (let yy = top; yy < top + h; yy++) for (let k = 0; k < w; k++) {
      px(x + k, yy, k === 0 || k === w - 1 ? woodK : (k < 2 ? '#c09250' : (k > w - 3 ? '#5b4326' : woodA)));
    }
    g.fillStyle = woodK; g.fillRect(x - 2, top, w + 4, 2);
    g.fillStyle = '#c09250'; g.fillRect(x - 2, top + 1, w + 4, 1);
  };
  post(96, 72, 42, 11);
  post(230, 76, 38, 10);
  for (let t = 0; t <= 1; t += 0.004) {
    const x = Math.round(102 + 132 * t);
    const yy = Math.round(76 + Math.sin(t * Math.PI) * 11);
    px(x, yy, '#3a2a18'); px(x, yy - 1, '#b09062');
  }

  // --- crate and rope coil ------------------------------------------------
  for (let yy = 0; yy < 26; yy++) for (let x = 0; x < 30; x++) {
    const X = 190 + x, Y = 84 + yy;
    let c = '#a8813f';
    if (x === 0 || x === 29 || yy === 0 || yy === 25) c = woodK;
    else if (x < 3 || yy < 3) c = '#c09250';
    else if (x > 26 || yy > 22) c = woodC;
    else if (Math.abs(x - yy * 1.15) < 2) c = woodC;
    px(X, Y, c);
  }
  for (let r = 0; r < 3; r++) for (let a2 = 0; a2 < 72; a2++) {
    const th = (a2 / 72) * Math.PI * 2;
    px(Math.round(46 + Math.cos(th) * (5 + r * 3)), Math.round(136 + Math.sin(th) * (2 + r * 1.7)),
      a2 < 36 ? '#b09062' : woodC);
  }

  // --- Wren, standing on the boards looking out ---------------------------
  for (let x = -15; x <= 15; x++) {
    const h = Math.round(4 * Math.sqrt(Math.max(0, 1 - (x / 15) ** 2)));
    for (let k = -h; k <= h; k++) if (((x + k) & 1) === 0) px(147 + x, 144 + k, '#5a432a');
  }
  g.drawImage(WREN, 133, 92);
  g.drawImage(PARCEL, 158, 116);

  for (const [gx, gy] of [[104, 22], [122, 14], [178, 28], [194, 20]]) {
    g.fillStyle = '#1e2c4c';
    g.fillRect(gx, gy, 1, 1); g.fillRect(gx - 2, gy - 1, 2, 1); g.fillRect(gx + 1, gy - 1, 2, 1);
  }
  return cv;
}

// ---------------------------------------------------------------------------
// Panel 4 — THE CARRION WING
// ---------------------------------------------------------------------------
function panelCarrion() {
  const { cv, g } = surface(W, H);
  paintSky(g, W, H, [
    { y: 0, c: '#120e24' },
    { y: 40, c: '#1e1838' },
    { y: 84, c: '#33234a' },
    { y: 124, c: '#5a3450' },
    { y: 164, c: '#8a4a4a' },
    { y: 224, c: '#b06a44' },
  ]);
  g.drawImage(makeCloudStrip(W, 44, {
    seed: 101, count: 6, minW: 60, maxW: 140, hMin: 8, hMax: 18, baseY0: 26, baseY1: 40,
    pal: { crown: '#6b5470', light: '#5a4560', body: '#4a374f', shade: '#4a374f', edge: '#2c1f31' },
  }), 0, 96);

  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const K = '#0d0a16', RIM = '#7a6f9c', RIM2 = '#463f66', BODY = '#171226', RIB = '#251e3c';

  // --- gasbag --------------------------------------------------------------
  const GX = 148, GY = 40, GW = 104, GH = 28;
  for (let x = GX - GW; x <= GX + GW; x++) {
    const u = (x - GX) / GW;
    const hh = Math.round(GH * Math.sqrt(Math.max(0, 1 - u * u * u * u)));
    if (hh <= 0) continue;
    for (let y = GY - hh; y <= GY + hh; y++) {
      const d = y - (GY - hh), b = (GY + hh) - y;
      let c = BODY;
      if (d === 0 || b === 0) c = K;
      else if (d === 1) c = RIM;
      else if (d <= 3) c = RIM2;
      else if (b <= 2) c = K;
      else if ((y % 9) === 0) c = RIB;          // seam between fabric panels
      else if (((x * 3 + y * 5) & 7) === 0) c = RIB;   // canvas weave
      px(x, y, c);
    }
  }
  for (let x = GX - GW + 12; x < GX + GW; x += 18) {
    const u = (x - GX) / GW;
    const hh = Math.round(GH * Math.sqrt(Math.max(0, 1 - u * u * u * u)));
    for (let y = GY - hh + 2; y < GY + hh - 1; y++) px(x, y, RIB);
  }
  g.drawImage(CARRION_MARK, GX - 19, GY - 11);

  // --- hull ----------------------------------------------------------------
  const HY = 74;
  for (let y = 0; y < 30; y++) {
    const t = y / 29;
    const hw = Math.round(70 - t * t * 44);
    for (let x = -hw; x <= hw; x++) {
      let c = BODY;
      if (y === 0 || y === 29 || x === -hw || x === hw) c = K;
      else if (y === 1) c = RIM;
      else if (y <= 3) c = RIM2;
      else if (y > 23) c = K;
      else if ((y % 7) === 0) c = RIB;
      else if (((x * 5 + y * 3) & 7) === 0) c = RIB;   // riveted plate
      px(GX + x + 4, HY + y, c);
    }
  }
  // lit portholes along the hull
  for (let i = 0; i < 6; i++) {
    const x = GX - 48 + i * 20;
    px(x, HY + 10, '#ffcf78'); px(x + 1, HY + 10, '#c88a30');
    px(x, HY + 11, '#c88a30'); px(x + 1, HY + 11, '#7a5220');
  }
  // stern fins and the bowsprit
  for (let y = 0; y < 26; y++) for (let x = 0; x < 24 - y; x++) px(GX + 76 + x, 56 + y, x === 23 - y ? K : BODY);
  for (let x = 0; x < 22; x++) px(GX - 62 - x, HY + 8 + Math.round(x * 0.14), x < 4 ? RIM2 : K);

  // --- crane arm, chain, claw, and the shard ------------------------------
  const AX = GX - 58;
  for (let x = 0; x < 46; x++) {
    const yy = 88 + Math.round(x * 0.30);
    px(AX - x, yy, K); px(AX - x, yy + 1, RIM2); px(AX - x, yy + 2, K);
  }
  const CLX = AX - 44, CLY = 100;
  for (let x = -3; x <= 3; x++) for (let y = -4; y <= 4; y++) px(CLX + x, CLY + y, Math.abs(x) === 3 || Math.abs(y) === 4 ? K : RIM2);
  for (let y = CLY + 5; y < CLY + 36; y += 4) {
    px(CLX, y, RIM2); px(CLX + 1, y, K);
    px(CLX, y + 1, K); px(CLX + 1, y + 1, RIM2);
    px(CLX, y + 2, RIM2); px(CLX + 1, y + 2, K);
  }
  // the claw: two hooked jaws closed around the shard
  for (let y = 0; y < 14; y++) {
    const spread = Math.round(11 - y * 0.5);
    for (const sd of [-1, 1]) {
      for (let t = 0; t < 6; t++) {
        px(CLX + sd * (spread - t) + (sd > 0 ? 1 : 0), CLY + 36 + y,
          t === 0 || t === 5 || y === 13 ? K : t < 3 ? RIM : RIM2);
      }
    }
  }
  for (let x = -10; x <= 11; x++) px(CLX + x, CLY + 35, K);
  for (let x = -9; x <= 10; x++) px(CLX + x, CLY + 34, RIM2);
  g.drawImage(SHARD, CLX - 3, CLY + 40);

  // --- Bellows Isle rim, tilting, in the bottom-left -----------------------
  for (let x = -14; x < 168; x++) {
    const lid = 144 + Math.round(x * 0.17);
    for (let y = lid; y < H; y++) {
      const d = y - lid;
      let c;
      if (d === 0) c = '#2c4a2a';
      else if (d === 1) c = '#22401f';
      else if (d < 4) c = ((x + d) & 3) === 0 ? '#2c4a2a' : '#1a3218';
      else if (d < 6) c = '#0f130c';
      else c = ((d % 8) < 2) ? '#3a2c20' : ((d % 8) < 5 ? '#2e231a' : ((d % 8) < 7 ? '#1f1811' : '#14100b'));
      px(x, y, c);
    }
  }
  // lit windows on the falling isle, and a leaning windmill
  // a windmill leaning with the isle, its sails stopped
  for (let y = 0; y < 40; y++) {
    const hw = 3 + Math.round(y * 0.11);
    const lean = Math.round((40 - y) * 0.17);
    for (let x = -hw; x <= hw; x++) {
      px(104 + x + lean, 152 - 40 + y + Math.round(104 * 0.17),
        (x === -hw || x === hw) ? '#14100b' : (x < 0 ? '#3a3226' : '#1f1811'));
    }
  }
  for (let b = 0; b < 4; b++) {
    const th = b * Math.PI / 2 + 0.6;
    for (let t = 2; t < 15; t += 0.5) for (let u = -2; u <= 2; u++) {
      px(Math.round(111 + Math.cos(th) * t - Math.sin(th) * u),
        Math.round(130 + Math.sin(th) * t + Math.cos(th) * u),
        Math.abs(u) === 2 ? '#14100b' : '#2e231a');
    }
  }
  for (const [wx, wy] of [[10, 150], [18, 152], [88, 168], [96, 170], [124, 174]]) {
    px(wx, wy, '#ffcf78'); px(wx + 1, wy, '#ffcf78');
    px(wx, wy + 1, '#c88a30'); px(wx + 1, wy + 1, '#c88a30');
  }
  return cv;
}

// ---------------------------------------------------------------------------
// Narration. Terse, warm, a little wry — STORY.md's voice. One or two pages a
// panel; nobody makes speeches.
// ---------------------------------------------------------------------------
const SCRIPT = [
  ['Every isle in the sky rides a liftstone.\nCut one out, and the sky lets go.'],
  ['Bellows Isle has hung over the cloud deck for two hundred years.',
    'Windmills. Boilers. Four hundred souls, and one bent weathervane.'],
  ['Aeronaut Wren has flown courier for three weeks.',
    'One parcel for the engine-keeper. One signature. Home before dark.'],
  // "By the time Wren reached the dock, the island had already begun to fall"
  // is a narrative template with no subject doing anything: the clause hands
  // the sentence to the island and Wren arrives as a timestamp. She acts now —
  // she moors, dry parcel, signature ready, three weeks into the job and doing
  // it properly — and the fall is stated flat underneath her, already six hours
  // old. It also picks the courier's checklist back up off panel three.
  ['At dawn a black ship put down over the Boilerworks.',
    'Wren moored at noon, parcel dry, signature ready. The isle had been falling six hours.'],
];

const XFADE = 18;

export class Intro {
  constructor(opts = {}) {
    this.onDone = opts.onDone || (() => {});
    this.auto = !!opts.auto;
    this.panel = Math.max(0, Math.min(3, opts.startPanel || 0));
    this.frame = 0;
    this.autoClock = 0;
    this.wipe = 0;
    this.finished = false;

    const room = paintRoom();
    // three light strengths, cycled: the glow breathes without re-resolving
    // 57k pixels every frame
    this.glow = [bakeRoom(room, 3.3), bakeRoom(room, 3.7), bakeRoom(room, 4.1)];
    this.panels = [this.glow[1], panelIsles(), panelCourier(), panelCarrion()];

    this.deck = makeCloudStrip(320, 42, {
      seed: 51, count: 7, minW: 70, maxW: 150, hMin: 11, hMax: 20, baseY0: 32, baseY1: 41, pal: cloudPal(0),
    });
    this.props = [];
    for (let i = 0; i < 6; i++) this.props.push(this.makeProp(i / 6));

    this.box = new DialogBox();
    this.box.setAnchor('bottom');
    this.box.say(SCRIPT[this.panel]);
  }

  // A three-blade prop seen edge-on: each blade foreshortens into a lens as it
  // turns, which is all it takes to read as spinning at this size.
  makeProp(phase) {
    // A propeller seen almost edge-on. The disc is a tall narrow ellipse
    // (rx 4, ry 11), so a blade's tip travels a long way vertically and barely
    // any horizontally — which is exactly what foreshortening looks like and
    // what makes three static blades read as one spinning disc. The first
    // version of this fed the blade LENGTH into y and the blade WIDTH into x,
    // so every blade came out a vertical bar no matter what angle it was at.
    const { cv, g } = surface(25, 25);
    const cx = 12, cy = 12;
    for (let b = 0; b < 3; b++) {
      const th = phase * Math.PI * 2 + b * (Math.PI * 2 / 3);
      const tx = Math.cos(th) * 7, ty = Math.sin(th) * 11;
      for (let t = 0.15; t <= 1; t += 0.04) {
        const x = cx + tx * t, y = cy + ty * t;
        const wdt = 1 + Math.abs(Math.sin(th)) * 1.4 * (1 - t * 0.5);
        for (let k = -wdt; k <= wdt; k++) {
          g.fillStyle = Math.abs(k) > wdt - 1 ? '#0d0a16' : '#5a5280';
          g.fillRect(Math.round(x + k), Math.round(y), 1, 1);
        }
      }
    }
    g.fillStyle = '#0d0a16'; g.fillRect(cx - 2, cy - 2, 5, 5);
    g.fillStyle = '#463f66'; g.fillRect(cx - 1, cy - 1, 3, 3);
    return cv;
  }

  skip() {
    if (this.finished) return;
    this.finished = true;
    this.box.close();
    this.onDone();
  }

  update(dt, engine) {
    this.frame++;
    if (this.finished) return;
    const input = engine.input;
    if (input.hit('start')) { this.skip(); return; }

    if (this.wipe > 0) { this.wipe--; return; }

    if (this.auto) {
      // Capture / attract mode: turn the page on a timer so a strip of frames
      // walks the whole sequence without a human at the keyboard.
      if (++this.autoClock > 100) { this.autoClock = 0; this.box.press(); }
    }
    this.box.update(input);

    if (!this.box.active) {
      if (this.panel >= SCRIPT.length - 1) { this.finished = true; this.onDone(); return; }
      this.panel++;
      this.wipe = XFADE;
      this.autoClock = 0;
      this.box.say(SCRIPT[this.panel]);
    }
  }

  draw(ctx) {
    const p = this.panel;
    if (p === 0) {
      const cyc = [0, 1, 2, 1];
      ctx.drawImage(this.glow[cyc[Math.floor(this.frame / 26) % 4]], 0, 0);
      ctx.drawImage(STONE, 115, 60 + Math.round(Math.sin(this.frame / 40) * 2));
    } else {
      ctx.drawImage(this.panels[p], 0, 0);
    }

    if (p === 1) {
      const off = Math.round((this.frame * 0.28) % 320);
      ctx.drawImage(this.deck, -off, 186);
      ctx.drawImage(this.deck, 320 - off, 186);
    } else if (p === 3) {
      ctx.fillStyle = '#0d0a16';
      ctx.fillRect(216, 76, 22, 3); ctx.fillRect(216, 102, 22, 3);
      ctx.fillStyle = '#463f66';
      ctx.fillRect(216, 77, 21, 1); ctx.fillRect(216, 103, 21, 1);
      const f = this.props[Math.floor(this.frame / 4) % 6];
      ctx.drawImage(f, 224, 66);
      ctx.drawImage(f, 224, 92);
    }

    // Not once the sequence is over: DialogBox.close() leaves node null with
    // closing still at OPEN_FRAMES, and its draw() walks straight past the
    // wipe branch into a null page. dialog.js is not ours to patch, so the
    // window simply stops being drawn the moment the intro is done.
    if (!this.finished) this.box.draw(ctx);

    if (this.wipe > 0) {
      const step = Math.round((this.wipe / XFADE) * 4);
      ctx.fillStyle = '#000';
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (BAYER[y & 3][x & 3] < step * 4) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}
