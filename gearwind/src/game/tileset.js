// Gearwind terrain tileset — 16x16 tiles + decor sprites, ALttP-style.
// All art original. Authored with makeSprite/makeTiles string grids.
//
// ROCK. Sampled column-by-column out of refs/overworld-cliff-path-soldiers.png
// (x=215, y=83..115): the face is a stack of 16px COURSES, and each course
// reads top-to-bottom as 2px highlight / 6px sunlit shelf / 6px mid body /
// 3px shadow, ending on the near-black outline. Two facts decide everything:
//   * the course lines run PARALLEL TO THE RIM, not parallel to the screen.
//     A vertical wall in the ref (x=89..104) carries vertical bands; a
//     horizontal one (y=147..178) carries horizontal bands. So the courses
//     here are phase-locked to the distance from the grass lid, and the
//     corner gets arcs for free.
//   * the silhouette is a RIBBON. The measured cliff outline scallops with
//     ~2px amplitude on a ~15px period, and the grass edge above it runs on
//     the same slow base line, so the band holds a near-constant width.
// Where the rock meets sky the stack ramps down through four shades into the
// undercut; where it meets grass there is a 2px near-black outline and the
// grass above it darkens for 2px.
//
// PATH. Measured off refs/overworld-eastern-palace-grass-cliffs.png: the dirt
// interior is nearly FLAT — one band of short darker dashes every ~16 rows,
// nothing else. The boundary is CHUNKY: 4px and 8px steps, lobes 8-12px wide,
// with the dark outline sitting on the GRASS side and the dirt left clean.
//
// GRASS. Dark olive base (ALttP's dominant value), sparse lighter mottle
// dashes, very-low-contrast micro-strokes, spiky tuft clusters.
import { makeTiles, makeSprite, flipH } from '../sprites.js';

export const PAL = {
  k: '#282828', // dark outline (not pure black)
  // Lawn. Sampled straight out of refs/overworld-eastern-palace-grass-cliffs:
  // ALttP weaves #408848 and #287838 with #489848 highlight dots.
  g: '#408848', G: '#388038', a: '#489848',
  // dark grass field base + deepest green (tufts, shadows, outlines)
  d: '#287838', b: '#1b5226',
  // leaf greens (bushes, trees, tall grass) — kept a clear step above the
  // lawn so a bush still reads as a bush against #408848
  // Foliage ramp, deliberately WIDE-spaced: #9cd882 188 / #58aa50 135 /
  // #287838 89 / #1c3020 40, steps 53/46/49 against ALttP's 34/39/35. The old
  // #74c266 (160) and #327f3a (96) rungs sat 25 and 7 lum off their
  // neighbours; both were doing gradient smoothing and both are gone.
  l: '#58aa50', H: '#9cd882',
  // canopy outline. ALttP's tree outline is a dark GREEN-black (#202820
  // measured in hyrule-castle-courtyard-rain), not the neutral near-black the
  // rest of the sheet uses — a neutral ring makes a canopy read as a decal.
  V: '#1c3020',
  // olive dirt path
  // (the path's grass-side outline `o` is the same near-black as `k`: two
  // indistinguishable dark values were costing a slot in the working palette)
  p: '#888040', q: '#686028', e: '#a09850', o: '#282828',
  // island rock ramp, light -> dark (tan/olive, 6 steps + k outline).
  // `S` used to be #2f2315 (lum 37) sitting one lum-step off the #282828
  // outline (lum 40) — two indistinguishable darks costing a working-palette
  // slot, exactly like `o` above. Collapsed onto the outline value.
  E: '#ab9358', D: '#948046', C: '#7d6538', M: '#6c5330',
  c: '#5a4327', s: '#453220', S: '#282828',
  // pale olive lip where the grass lid overhangs the rock
  O: '#8a9a5a',
  // Sky. Measured against the refs: ALttP's negative space (water) sits BELOW
  // the land in value — refs/overworld-bridge water mean lum 88.6/94.0 vs
  // grass 111.5. The old #68a4e0 (lum 153) floated 50 lum ABOVE our land mean
  // (103.5) and the void outshone the island. Dropped a full step.
  y: '#4c86c8', Y: '#74aade', u: '#35659c',
  // Cloud sea / steam. The old ramp was #f4f6f8 / #c2d4e8 / #a6bad6 —
  // lum 246/209/183, all crammed into the top quarter of the scale and
  // neutral (sat 0.02), which ALttP never uses at terrain scale: every large
  // bright field in the refs is TINTED and capped (#b0e8b8 lum 210 sat 0.24,
  // #a0e0a8 lum 198 sat 0.29). Re-valued to a blue-tinted ramp whose internal
  // span (199 -> 106, and 78 in shadow) matches the ref water's 70 -> 164.
  // T stays pure white but is now spent only on the 1px sunlit crown line.
  w: '#b0cce8', W: '#7c9cc8', v: '#4870a4', i: '#34508c', T: '#ffffff',
  // rock greys
  r: '#8e968e', R: '#c0c8ba', x: '#525a52',
  // wood
  n: '#996b33', N: '#c69a5c', m: '#63451f',
  // brass. P is verdigris: weathered copper on the shaded flank of a pipe run
  // and in the drip line under a flange. Deliberately far from every green on
  // this sheet in hue (cyan-green, not leaf-green) so it can never be read as
  // an extra rung in the foliage ramp — see the canopy note by SP.tree.
  B: '#c4a03e', A: '#e8d288', z: '#7c5c1e', P: '#4e8f76',
  // flowers
  f: '#f8f8f8', F: '#d84848', h: '#f0c848',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const mod = (v, n) => ((v % n) + n) % n;

function stamp(rows, x0, y0, art) {
  const out = rows.map(r => r.split(''));
  art.forEach((ar, dy) => {
    [...ar].forEach((ch, dx) => { if (ch !== '.') out[y0 + dy][x0 + dx] = ch; });
  });
  return out.map(r => r.join(''));
}

// Compose two textures through a mask. '.' = first, '#' = second; any other
// mask character is emitted literally (outline / fringe colours).
function comb(mask, first, second) {
  return mask.map((mr, y) => [...mr].map((ch, x) =>
    ch === '.' ? first[y][x] : ch === '#' ? second[y][x] : ch).join(''));
}

const flipVM = m => [...m].reverse();
const mirrorM = m => m.map(r => [...r].reverse().join(''));
const transpose = m => Array.from({ length: 16 }, (_, y) =>
  m.map(row => row[y]).join(''));

// Cosine-interpolated profile through control points [[t, v], ...]. Cosine
// (not linear) so silhouettes come out as rounded lumps, not faceted ramps.
function profile(len, pts) {
  const out = new Array(len);
  for (let t = 0; t < len; t++) {
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1][0] <= t) i++;
    const [t0, v0] = pts[i], [t1, v1] = pts[i + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const s = (1 - Math.cos(Math.PI * u)) / 2;
    out[t] = Math.round(v0 + (v1 - v0) * s);
  }
  return out;
}

const GRASS = Array(16).fill('gggggggggggggggg');

// ---------------------------------------------------------------------------
// Lawn: dark olive base, micro-strokes (G, near-invisible), light mottle
// dashes (a), spiky tuft clusters (b).
// ---------------------------------------------------------------------------

const MS = ['G', 'G'];           // 1x2 micro-stroke
const LA = ['a', 'a'];           // 1x2 light mottle dash
// Four tuft glyphs, all splayed blade fans rather than the old block-letter
// shapes — a screen carries a dozen of these and one repeated mark reads as
// a typographic stamp.
const TUFT1 = [
  'b...b.b',
  '.b.b.b.',
  '..bbb..',
];
const TUFT2 = [
  '.b...b',
  'b.b.b.',
  '.bb.b.',
];
const TUFT3 = [
  '..b.b..',
  'b.b.b.b',
  '.bb.bb.',
];
const TUFT4 = [
  'b.b..b',
  '.b.bb.',
  '..b.b.',
];
const CHK = ['b..b', '.bb.'];    // small V check

const put = (rows, list) => list.reduce((r, [art, x, y]) => stamp(r, x, y, art), rows);

const T = {};

T.grass = put(GRASS, [[MS, 3, 2], [MS, 10, 7], [MS, 6, 12], [LA, 13, 4]]);
T.grass2 = put(GRASS, [[MS, 7, 1], [MS, 1, 9], [MS, 12, 12], [LA, 4, 6]]);
T.grass3 = put(GRASS, [[MS, 2, 5], [MS, 11, 3], [LA, 8, 10], [TUFT1, 5, 6]]);
T.grass4 = put(GRASS, [[MS, 9, 13], [MS, 3, 3], [TUFT2, 10, 4], [CHK, 4, 9]]);
T.grass5 = put(GRASS, [[MS, 12, 8], [MS, 5, 1], [TUFT3, 2, 11], [LA, 9, 3]]);
T.grass6 = put(GRASS, [[MS, 1, 4], [MS, 8, 8], [TUFT4, 8, 11], [CHK, 3, 13]]);
T.grass7 = put(GRASS, [[MS, 6, 3], [MS, 13, 10], [TUFT3, 1, 7], [LA, 10, 14]]);
T.grass8 = put(GRASS, [[MS, 11, 6], [MS, 2, 14], [TUFT4, 5, 2], [CHK, 12, 11]]);

// 32x32 lawn field, used wherever generated terrain needs grass pixels.
const GFIELD = [
  ...T.grass.map((r, i) => r + T.grass2[i]),
  ...T.grass3.map((r, i) => r + T.grass5[i]),
];
const grassPx = (x, y) => GFIELD[mod(y, 32)][mod(x, 32)];

// Dark grass field: low-contrast weave (d base, g dashes) + one light dot.
const DARKG = [
  'gdgdddddgdddgggd',
  'gddgdddgdgdddggd',
  'dddddddgdgdgdgdd',
  'dddgdgdgdggdgddd',
  'gdddddddgdddggdd',
  'ggdggdddddgddddd',
  'gdgddgdddddddggd',
  'ddggdgdddgdgdgdg',
  'dgdddgdddddggddg',
  'dggdgddgdgdgdddd',
  'gdgdddddgdgdgddd',
  'gdggdgddgddgddgd',
  'dddgddgddddgddgg',
  'dgdgdddddggdgddg',
  'ggddgddgdgddgddd',
  'gdgdddggdgdddgdg',
];
T.dk_c = stamp(DARKG, 11, 3, ['aa', 'aa']);

// ---------------------------------------------------------------------------
// Path — olive dirt.
// Interior: flat, with one band of short darker dashes per tile (that is all
// ALttP's dirt has). Edges: slow organic curve, 1px outline, 2px deep-green
// grass shadow outside it.
// ---------------------------------------------------------------------------

const PATH16 = Array(16).fill('pppppppppppppppp');

// One "scatter band": 5 rows of short 1-3px dashes, ALttP dirt grammar.
const SCATTER_A = [
  '......qq....q...',
  '..qqq....qq...qq',
  'q....q......q...',
  '.....qqq..q.....',
  '..q.......qq....',
];
const SCATTER_B = [
  '...q.....qq.....',
  'qq....qq....q.qq',
  '....q......q....',
  '.q.....q..qqq...',
  '......qq......q.',
];

const PATH_TEX = put(PATH16, [[SCATTER_A, 0, 9], [['q'], 3, 2], [['q'], 12, 4]]);
const PATH_TEX2 = put(PATH16, [[SCATTER_B, 0, 2], [['q'], 6, 13], [['q'], 13, 11]]);

// Mask builder. f(x, y) is true inside the region, defined outside 0..15 too.
// Emits '#' clean dirt interior, 'o' near-black outline on the LAWN side of
// the boundary (that is where ALttP puts it — the dirt itself is left clean),
// 'b' one more row of deep-green grass shadow, '.' lawn.
function regionMask(f) {
  const near = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (f(x + dx, y + dy)) return true;
    }
    return false;
  };
  const allIn = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (!f(x + dx, y + dy)) return false;
    }
    return true;
  };
  return Array.from({ length: 16 }, (_, y) =>
    Array.from({ length: 16 }, (_, x) => {
      if (f(x, y)) {
        // Scuffed transition band: a 2px dither of the darker dirt tone just
        // inside the boundary, so the dirt is worn where feet leave it rather
        // than ending on a clean cut. The dark outline still sits on the LAWN
        // side; the dirt keeps no hard edge of its own.
        return !allIn(x, y, 2) && mod(x * 7 + y * 13, 3) === 0 ? 'q' : '#';
      }
      if (near(x, y, 1)) return 'o';
      return near(x, y, 2) ? 'b' : '.';
    }).join(''));
}

const clamp16 = (v) => Math.min(15, Math.max(0, v));
// Straight-edge boundaries: 16-long depth profiles. ALttP's grass/dirt
// boundary steps in 4px and 8px units with 8-12px lobes, and plenty of it is
// dead straight — not a fine comb serration. First == last so any two masks
// abut without a step.
// ONE 16px edge motif — an 8-wide lobe pushed 3px out of the base line — in
// three placements plus a dead-straight run. ALttP's dirt boundary is a small
// set of authored variants of one lobe, not an endless alternation of single
// in/out notches, which is what made ours read as a right-angle staircase.
const EDGE_N = [
  [5, 5, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5, 5, 5],   // the lobe, centred
  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],   // straight run
  [5, 5, 2, 2, 2, 2, 2, 2, 5, 5, 8, 8, 8, 8, 5, 5],   // lobe + lawn notch
  [5, 8, 8, 8, 5, 5, 2, 2, 2, 2, 2, 2, 2, 2, 5, 5],   // notch then the lobe
];
const EDGE_S = EDGE_N.map(d => d.map(v => 15 - v));

const maskN = (d) => regionMask((x, y) => y >= d[clamp16(x)]);
const maskS = (d) => regionMask((x, y) => y <= d[clamp16(x)]);
const maskW = (d) => regionMask((x, y) => x >= d[clamp16(y)]);
const maskE = (d) => regionMask((x, y) => x <= d[clamp16(y)]);

// Convex corner: a real quarter circle (radius 12) broken into 4-2-1 pixel
// steps. The old cosine ramp rendered as an unbroken 45-degree staircase,
// which ALttP essentially never has.
const arcCorner = (R, cy) => Array.from({ length: 16 }, (_, y) => {
  const t = R * R - (y - cy) * (y - cy);
  return t <= 0 ? 99 : Math.round(15 - Math.sqrt(t));
});
const ARC_NW = arcCorner(12, 15);
const ARC_SW = arcCorner(12, 0);
// Concave corner: a rounded lawn lobe hanging over the bend — an arc, not a
// triangle. Radius 6, so where it meets the straight-edge tiles either side
// (whose boundary sits ~5px in) it lands within a pixel instead of leaving a
// 4px wedge sticking into the dirt.
const BITE_NW = Array.from({ length: 16 }, (_, y) => {
  const t = 36 - y * y;
  return t <= 0 ? 0 : Math.round(Math.sqrt(t));
});
const BITE_SW = [...BITE_NW].reverse();

const EDGES_PATH = {
  n: maskN(EDGE_N[0]), n2: maskN(EDGE_N[1]),
  n3: maskN(EDGE_N[2]), n4: maskN(EDGE_N[3]),
  s: maskS(EDGE_S[0]), s2: maskS(EDGE_S[1]),
  s3: maskS(EDGE_S[2]), s4: maskS(EDGE_S[3]),
  w: maskW(EDGE_N[0]), w2: maskW(EDGE_N[1]),
  w3: maskW(EDGE_N[2]), w4: maskW(EDGE_N[3]),
  e: maskE(EDGE_S[0]), e2: maskE(EDGE_S[1]),
  e3: maskE(EDGE_S[2]), e4: maskE(EDGE_S[3]),
  nw: regionMask((x, y) => x >= ARC_NW[clamp16(y)]),
  ne: mirrorM(regionMask((x, y) => x >= ARC_NW[clamp16(y)])),
  sw: regionMask((x, y) => x >= ARC_SW[clamp16(y)]),
  se: mirrorM(regionMask((x, y) => x >= ARC_SW[clamp16(y)])),
  inw: regionMask((x, y) => x >= BITE_NW[clamp16(y)]),
  ine: mirrorM(regionMask((x, y) => x >= BITE_NW[clamp16(y)])),
  isw: regionMask((x, y) => x >= BITE_SW[clamp16(y)]),
  ise: mirrorM(regionMask((x, y) => x >= BITE_SW[clamp16(y)])),
};

// Dark-grass edges: chunky stepped boundary, no outline (the weave just
// stops), like ALttP's light/dark field boundaries.
const mrow = (v) => ('.'.repeat(Math.max(0, v - 1)) + (v > 0 ? 'o' : '') +
  '################').slice(0, 16);
const maskFromN = (d) => Array.from({ length: 16 }, (_, y) =>
  d.map((v) => (y < v - 1 ? '.' : y === v - 1 ? 'o' : '#')).join(''));
const maskFromW = (d) => d.map(mrow);

const DK_N = maskFromN([4, 4, 2, 2, 2, 5, 5, 3, 3, 6, 6, 6, 3, 3, 5, 5]);
const DK_N2 = maskFromN([3, 3, 6, 6, 2, 2, 2, 4, 4, 2, 2, 5, 5, 5, 3, 3]);
const DK_W = maskFromW([4, 4, 2, 2, 5, 5, 5, 3, 3, 6, 6, 3, 3, 4, 4, 2]);
const DK_W2 = maskFromW([6, 6, 3, 3, 2, 2, 5, 5, 2, 2, 4, 4, 6, 6, 2, 2]);
const DK_S = flipVM(maskFromN([5, 5, 2, 2, 4, 4, 6, 6, 3, 3, 2, 2, 5, 5, 3, 3]));
const DK_S2 = flipVM(maskFromN([2, 2, 4, 4, 2, 2, 6, 6, 6, 3, 3, 5, 5, 2, 2, 4]));
const DK_E = mirrorM(maskFromW([3, 3, 5, 5, 2, 2, 4, 4, 4, 6, 6, 2, 2, 5, 5, 3]));
const DK_E2 = mirrorM(maskFromW([5, 5, 2, 2, 6, 6, 3, 3, 2, 2, 5, 5, 4, 4, 2, 2]));
const DK_NW = maskFromW([16, 16, 13, 13, 10, 10, 8, 8, 6, 6, 5, 5, 4, 4, 3, 3]);
const DK_NE = mirrorM(DK_NW);
const DK_SW = flipVM(DK_NW);
const DK_SE = mirrorM(DK_SW);
const DK_INW = maskFromW([5, 5, 3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const DK_INE = mirrorM(DK_INW);
const DK_ISW = flipVM(DK_INW);
const DK_ISE = mirrorM(DK_INW.slice().reverse());

const DK_N3 = maskFromN([2, 2, 5, 5, 5, 3, 3, 6, 6, 4, 4, 2, 2, 3, 3, 5]);
const DK_W3 = maskFromW([5, 5, 3, 3, 6, 6, 2, 2, 4, 4, 5, 5, 3, 3, 6, 6]);
const DK_S3 = flipVM(maskFromN([3, 3, 6, 6, 2, 2, 5, 5, 4, 4, 3, 3, 6, 6, 2, 2]));
const DK_E3 = mirrorM(maskFromW([6, 6, 2, 2, 4, 4, 3, 3, 5, 5, 2, 2, 6, 6, 3, 3]));
const DK_N4 = maskFromN([6, 6, 3, 3, 4, 4, 2, 2, 5, 5, 3, 3, 6, 6, 2, 2]);
const DK_W4 = maskFromW([3, 3, 6, 6, 4, 4, 5, 5, 2, 2, 6, 6, 3, 3, 5, 5]);
const DK_S4 = flipVM(maskFromN([5, 5, 2, 2, 6, 6, 4, 4, 3, 3, 5, 5, 2, 2, 6, 6]));
const DK_E4 = mirrorM(maskFromW([2, 2, 5, 5, 3, 3, 6, 6, 4, 4, 2, 2, 5, 5, 3, 3]));

const EDGES_DK = {
  n: DK_N, n2: DK_N2, n3: DK_N3, n4: DK_N4,
  s: DK_S, s2: DK_S2, s3: DK_S3, s4: DK_S4,
  w: DK_W, w2: DK_W2, w3: DK_W3, w4: DK_W4,
  e: DK_E, e2: DK_E2, e3: DK_E3, e4: DK_E4,
  nw: DK_NW, ne: DK_NE, sw: DK_SW, se: DK_SE,
  inw: DK_INW, ine: DK_INE, isw: DK_ISW, ise: DK_ISE,
};

T.path_c = PATH_TEX;
T.path_c2 = PATH_TEX2;
for (const [suf, mask] of Object.entries(EDGES_PATH)) {
  T[`path_${suf}`] = comb(mask, T.grass, PATH_TEX);
}
for (const [suf, mask] of Object.entries(EDGES_DK)) {
  T[`dk_${suf}`] = comb(mask.map(r => r.replace(/o/g, 'd')), GRASS, DARKG);
}

// ---------------------------------------------------------------------------
// Rock course grammar
// ---------------------------------------------------------------------------

const ROCK = ['E', 'D', 'C', 'M', 'c', 's', 'S', 'k'];   // light -> outline

// THE SCALLOP. Measured off refs/overworld-cliff-path-soldiers.png by dumping
// the darkest row per column of the ridge between two courses, x=204..252,
// y=84..100:
//   94,94,95,95,95,95,95,95,94,94,93,92,91,91,92,93,94,94,95,...
// an EXACT 16px period, 4px peak-to-peak, dwelling 2px at the cusp and 6px at
// the bottom of the arc, repeated verbatim across every course. Re-phased so
// index 0 is the cusp, that is a hand-authored semicircular lobe:
const LOBE = [0, 0, 1, 2, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 2, 1];

// ONE 16px COURSE, transcribed from the same screenshot (native column x=215,
// y=78..114, cross-checked against the 56x40 block at x=200,y=76). Reading
// down from the top of the dark delimiter the ref runs
//   #483828 x2 | #604828 x2 | #887848 x2 | #786038 x4 | #604828 x6
// i.e. a hard 2px dark line, two mid rows, the 2px sunlit lip of the next
// shelf, its sunlit face, then the mid body. Rotated here so index 0 is the
// first row under the rim lip. Values are indices into ROCK.
// PITCH. The ref's course tops sit at y = 83, 97, 111 — a 14px pitch, so a
// 42px face carries THREE distinct strata. A 16px pitch only fits two fat
// bands into the same rim, which is what our 44px face was doing.
const COURSE = [
  1, 1, 1,             // D  sunlit face (ref #786038) — pockets live up here
  2, 2, 2, 2,          // C  mid body    (ref #604828)
  4, 5, 4,             // c s c  hard 3px delimiter (ref #483828, 2-3px)
  2, 2,                // C  mid, under the ledge
  0, 0,                // E  highlight on the lip of the next shelf (#887848)
];

// Danielsson feature transform: for every pixel, the coordinates of the
// nearest seed pixel and the true Euclidean distance to it. We need the
// FEATURE, not just the distance — the scallop is keyed to arc length ALONG
// the rim, which is a property of the nearest grass-boundary point. Taking it
// from the boundary point (rather than from the pixel) means the lobe phase is
// constant along every course normal, so a lobe never shears across the band
// and every course in the stack is in phase, exactly as in the ref.
function featureTransform(seed, GW, GH) {
  const N = GW * GH, INF = 1e9;
  const d = new Float32Array(N);
  const fx = new Int32Array(N), fy = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    if (seed[i]) { d[i] = 0; fx[i] = i % GW; fy[i] = (i / GW) | 0; }
    else { d[i] = INF; fx[i] = -1; fy[i] = -1; }
  }
  const rel = (i, x, y, j) => {
    if (fx[j] < 0) return;
    const dx = x - fx[j], dy = y - fy[j];
    const nd = Math.sqrt(dx * dx + dy * dy);
    if (nd < d[i]) { d[i] = nd; fx[i] = fx[j]; fy[i] = fy[j]; }
  };
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (y > 0) {
        rel(i, x, y, i - GW);
        if (x > 0) rel(i, x, y, i - GW - 1);
        if (x < GW - 1) rel(i, x, y, i - GW + 1);
      }
      if (x > 0) rel(i, x, y, i - 1);
    }
  }
  for (let y = GH - 1; y >= 0; y--) {
    for (let x = GW - 1; x >= 0; x--) {
      const i = y * GW + x;
      if (y < GH - 1) {
        rel(i, x, y, i + GW);
        if (x > 0) rel(i, x, y, i + GW - 1);
        if (x < GW - 1) rel(i, x, y, i + GW + 1);
      }
      if (x < GW - 1) rel(i, x, y, i + 1);
    }
  }
  return { d, fx, fy };
}

const chamfer = (seed, GW, GH) => featureTransform(seed, GW, GH).d;

// Crevice pockets. In the ref there is one 2x2/3x2 pit per 16px lobe, exactly
// one step darker than the sunlit face, sitting in the top rows of the shelf
// (course-local rows 0-2). They are laid out in COURSE-LOCAL space — (arc
// length along the rim, course index) — so every one of them lands inside the
// band it was meant for instead of being culled by an unrelated lattice.
// A TILESHEET HAS A FINITE NUMBER OF FACE TILES. Keying the pit lattice to the
// absolute cell index gave every 16px cell of cliff its own unique pit, so no
// two face tiles on screen were ever the same bitmap — measured 80% of the
// screen's 16x16 blocks unique against 59-75% in the refs. ALttP draws its
// cliff face from a handful of tiles laid side by side, so the pit layout here
// repeats every PIT_CELLS cells: same pit COUNT and same pit SIZES (density is
// measured in range and must not move), just stamped rather than re-rolled.
const PIT_CELLS = 4;
function pocketAt(s, cl, n) {
  const cell = mod(Math.floor(s / 16), PIT_CELLS), t = mod(s, 16);
  const h = ((cell * 374761393 + n * 668265263) ^ 0x5bf03635) >>> 0;
  if (h % 8 === 0) return 0;
  // Cell-LOCAL now: the old form added cell*16 back on and compared against the
  // absolute s, which is what tied the lattice to absolute position.
  const px = 2 + (h % 11);
  const py = (h >> 4) % 3;
  const w = 2 + ((h >> 9) & 1), ht = 2;
  if (t >= px && t < px + w && cl >= py && cl < py + ht) return 1;
  // A second nick, one band lower — the ref pocks the mid body as well as the
  // sunlit shelf, which is why gating pits on a single band lost most of them.
  if ((h >> 20) % 4 === 0) return 0;
  const qx = 1 + ((h >> 12) % 12), qy = 5 + ((h >> 17) % 4);
  return (t >= qx && t < qx + 2 + ((h >> 25) & 1) && cl >= qy && cl < qy + 2)
    ? 2 : 0;
}

// Sparse single-pixel flecks — the ref face is speckled with stray dark dots
// between the pits. Kept thin: the shelves themselves must stay clean or the
// courses stop reading.
function fleckAt(s, cl, n) {
  // Body rows only. A fleck lands one step DARKER than its row, which on the
  // 3px delimiter (course rows 7-9) would instead punch a lighter hole in it —
  // the one thing that would break the delimiter contour's 16px repeat.
  if (!((cl >= 1 && cl <= 6) || cl === 10 || cl === 11)) return false;
  // Periodic in s at 16, for the same reason pocketAt is: a fleck lattice keyed
  // to absolute s makes every face tile a one-off bitmap. Density is unchanged
  // (same 1-in-53 draw over the same (row, course) space) — only the placement
  // now repeats on the tile grid.
  const h = ((mod(s, 16) * 2654435761 + (cl + n * 16) * 40503) ^ 0x9e3779b9) >>> 0;
  return h % 53 === 0;
}

// Rasterise a chunk of island: land(x, y) and grass(x, y) are predicates
// valid a little outside the WxH window (padding P). Returns W x H char rows,
// '.' where there is no land.
function buildRock(W, H, { land, grass, ox = 0, oy = 0 }) {
  const P = 10, GW = W + 2 * P, GH = H + 2 * P, N = GW * GH;
  const isLand = new Uint8Array(N), isGrass = new Uint8Array(N);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = gx - P, y = gy - P, i = gy * GW + gx;
      if (!land(x, y)) continue;
      isLand[i] = 1;
      if (grass(x, y)) isGrass[i] = 1;
    }
  }
  const skySeed = new Uint8Array(N), rockSeed = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    skySeed[i] = isLand[i] ? 0 : 1;
    rockSeed[i] = isLand[i] && !isGrass[i] ? 1 : 0;
  }
  const dSky = chamfer(skySeed, GW, GH);
  const { d: dGrass, fx: gfx, fy: gfy } = featureTransform(isGrass, GW, GH);
  const dRock = chamfer(rockSeed, GW, GH);

  return Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => {
      const i = (y + P) * GW + (x + P);
      if (!isLand[i]) return '.';
      const ax = x + ox, ay = y + oy;
      if (isGrass[i]) return dRock[i] < 2.2 ? 'b' : grassPx(ax, ay);
      const ds = dSky[i], dg = dGrass[i];
      if (ds < 1.5) return 'k';                      // outline against sky
      if (dg < 2.6) return 'k';                      // 2px outline under lid
      // Along-rim coordinate. The nearest grass pixel tells us which way the
      // rim runs; a horizontal rim carries the lobe in x, a vertical one in y,
      // so the motif locks to the 16px tile grid in SCREEN space — which is
      // exactly what a tile-based cliff does, and what the ref measures as.
      // The switch happens on the 45-degree diagonal, so a corner STEPS from
      // one course grammar to the other instead of sweeping round.
      const s = Math.abs((x + P) - gfx[i]) < Math.abs((y + P) - gfy[i])
        ? ax : -ay;
      // Course phase, scalloped. The lobe pushes the whole stack deeper, so
      // the rim apron thickens under the belly of each arc exactly as in the
      // ref, and every course below inherits the same 16px scallop, in phase.
      const lip = dg - 2.6, ph = lip - LOBE[mod(s, 16)];
      let idx;
      if (lip < 2.0) {
        idx = 0;                                     // E — 2px lit rim lip
      } else if (ph < 2.0) {
        // Apron between the lip and the first course, flecked with moss where
        // the grass lid overhangs it.
        // Rim-LOCAL and 16-periodic (was keyed to absolute ax/ay, which alone
        // was enough to make every apron tile a unique bitmap).
        if (ds > 4 &&
            (((mod(s, 16) * 92837111) ^ (Math.round(lip) * 689287499)) >>> 0)
              % 17 === 0) {
          return 'O';
        }
        idx = 1;
      } else {
        const q = Math.floor(ph - 2.0);
        const cl = mod(q, COURSE.length), n = Math.floor(q / COURSE.length);
        idx = COURSE[cl];
        const pk = pocketAt(s, cl, n);                      // crevice pits
        if (pk === 1 && idx === 1) idx = 2;
        else if (pk === 2 && idx === 2) idx = 3;
        else if (fleckAt(s, cl, n)) idx = Math.min(4, idx + 1);
      }
      // Undercut: four shades falling into the silhouette, parallel to it.
      if (ds < 2.6) idx = 6;
      else if (ds < 4.6) idx = Math.max(5, idx);
      else if (ds < 6.6) idx = Math.max(4, idx);
      else if (ds < 8.6) idx = Math.max(3, idx);
      return ROCK[idx];
    }).join(''));
}

// ---------------------------------------------------------------------------
// Generic cliff columns (rim / face / lobe) for the non-tiles scenes.
// One 16x48 strip per variant so the courses stay continuous top to bottom.
// Every variant shares its left/right edge values, so any two abut cleanly.
// ---------------------------------------------------------------------------

// Grass bottom row (5 at both ends) and silhouette bottom row (40 at both
// ends, measured from the top of the strip).
const CLIFF_COLS = [
  { ox: 0, gy: [5, 5, 4, 4, 4, 5, 5, 6, 6, 6, 5, 5, 4, 4, 5, 5],
    bot: profile(16, [[0, 40], [4, 42], [8, 43], [12, 42], [15, 40]]) },
  { ox: 17, gy: [5, 4, 4, 5, 6, 6, 6, 5, 5, 4, 4, 4, 5, 5, 5, 5],
    bot: profile(16, [[0, 40], [3, 38], [7, 37], [11, 39], [15, 40]]) },
  { ox: 34, gy: [5, 6, 6, 5, 5, 4, 4, 4, 5, 5, 6, 6, 5, 5, 4, 5],
    bot: profile(16, [[0, 40], [5, 43], [9, 41], [12, 38], [15, 40]]) },
  { ox: 11, gy: [5, 5, 6, 6, 5, 5, 4, 4, 5, 6, 6, 5, 5, 4, 4, 5],
    bot: profile(16, [[0, 40], [4, 38], [8, 42], [12, 43], [15, 40]]) },
  { ox: 29, gy: [5, 4, 5, 5, 6, 6, 5, 5, 4, 4, 5, 5, 6, 5, 5, 5],
    bot: profile(16, [[0, 40], [6, 43], [10, 42], [13, 39], [15, 40]]) },
  { ox: 41, gy: [5, 5, 5, 4, 4, 5, 6, 6, 6, 5, 4, 4, 5, 5, 6, 5],
    bot: profile(16, [[0, 40], [4, 41], [8, 39], [12, 41], [15, 40]]) },
  { ox: 23, gy: [5, 6, 5, 4, 4, 4, 5, 5, 6, 6, 5, 4, 4, 5, 5, 5],
    bot: profile(16, [[0, 40], [5, 37], [9, 38], [13, 42], [15, 40]]) },
];

const cliffStrips = CLIFF_COLS.map(({ ox, gy, bot }) => {
  const rows = buildRock(16, 48, {
    ox, oy: 0,
    land: (x, y) => y <= bot[mod(x, 16)],
    grass: (x, y) => y < gy[mod(x, 16)],
  });
  return [rows.slice(0, 16), rows.slice(16, 32), rows.slice(32, 48)];
});

['a', 'b', 'c', 'd'].forEach((n, i) => { T[`rim_${n}`] = cliffStrips[i][0]; });
['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((n, i) => { T[`face_${n}`] = cliffStrips[i][1]; });
[1, 2, 3, 4, 5].forEach((n, i) => { T[`lobe_${n}`] = cliffStrips[i][2]; });

// ---------------------------------------------------------------------------
// Self-contained vertical island edge (movement / combat / enemies scenes):
// grass at the left, thick rock band, bumpy silhouette against sky.
// ---------------------------------------------------------------------------

function vertEdge(gb, coast, ox) {
  return buildRock(16, 16, {
    ox, oy: 0,
    land: (x, y) => x <= coast[mod(y, 16)],
    grass: (x, y) => x < gb[mod(y, 16)],
  });
}
T.edge_ea = vertEdge(
  [2, 2, 2, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 2],
  [14, 14, 13, 13, 13, 14, 15, 15, 14, 13, 12, 13, 14, 14, 14, 14], 5);
T.edge_eb = vertEdge(
  [2, 1, 1, 2, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 2, 2],
  [14, 13, 12, 13, 14, 15, 15, 14, 13, 14, 15, 14, 13, 13, 14, 14], 21);

// SE corner block (32x48): the south band and the east band wrap around a
// rounded point. Generated from the same grammar, so courses carry through.
{
  const coast = profile(48, [[0, 14], [10, 15], [20, 15], [26, 14],
    [32, 12], [37, 9], [41, 5], [44, 1], [47, -3]]);
  const bot = profile(32, [[0, 40], [4, 44], [8, 45], [12, 40],
    [16, 34], [20, 27], [24, 18], [28, 8], [31, -2]]);
  const gy = [5, 5, 4, 3, 1, 0, 0, 0];
  const gx = [2, 2, 2, 2, 1, 0, 0, 0];
  const rows = buildRock(32, 48, {
    ox: 0, oy: 0,
    land: (x, y) => y <= bot[Math.min(31, Math.max(0, x))] &&
      x <= coast[Math.min(47, Math.max(0, y))],
    grass: (x, y) => y < (gy[x] ?? 0) && x < (gx[y] ?? 0),
  });
  const slice = (r0, c0) => rows.slice(r0, r0 + 16).map(r => r.slice(c0, c0 + 16));
  T.cse_rim = slice(0, 0); T.ce_rim = slice(0, 16);
  T.cse_face = slice(16, 0); T.ce_face = slice(16, 16);
  T.cse_lobe = slice(32, 0); T.ce_lobe = slice(32, 16);
}

// North rim: sky above, dark outline, sunlit rock lip, shadow line, grass.
T.rim_n = [
  '................',
  '................',
  'kkkkkkkkkkkkkkkk',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
  'CDDCCCCDDCCCCCDD',
  'bbbbbbbbbbbbbbbb',
  ...GRASS.slice(7, 16),
];

// NE outer corner (movement scenes): north rim arcs into the east edge.
T.corner_ne = [
  '................',
  '................',
  'kkkkkkkk........',
  'DDDDDDDkkk......',
  'DDDDDDDDDkkk....',
  'DDDCCCCCDDDkk...',
  'ssCCCCCCCCDDkk..',
  'gssCCCCCCCCDsk..',
  'ggskCCCCCCcssk..',
  'ggkSsCCCCccsSk..',
  'ggkSsDCCCCcsSSk.',
  'ggkSsDDCCCcssSk.',
  'ggkSsDDCCCcsSSk.',
  'ggkSsDDCCCcsSSk.',
  'ggkSsDDCCCcsSSk.',
  'ggkSsDDCCCcsSSk.',
];

// ---------------------------------------------------------------------------
// The floating island edge used by the tiles scene: one continuous 224x192
// rock mass (map cols 0-13, rows 0-11) sliced into tiles, so the silhouette,
// the strata and the corner are all one authored shape rather than a
// repeating sawtooth.
// ---------------------------------------------------------------------------

export const ISLE = { c0: 0, c1: 14, r0: 0, r1: 11, band: 12, rim: 8 };

// THE RIM IS A STAMP, NOT A CURVE.
//
// Measured on refs/overworld-bridge-link-midwalk.png: the left bank profile
// (x0-60) and the right bank (x172-256) each repeat EXACTLY every 16px — the
// fraction of positions where prof[i] === prof[i+16] is 100% — and the profile
// is literally one 16px lobe stamped over and over. Its flat runs are only 2px
// and 4px long; there is not a single 1px flat run in 60 columns. The vertical
// cliff edge in overworld-cliff-path-soldiers repeats 90% at lag 16 and 85% at
// lag 32, i.e. one lobe with a base step every few cells.
//
// Anything built from cosines whose periods are coprime with 16 (we used 21 and
// 23) mathematically CANNOT do that: the edge drifts, every cycle comes out a
// different shape, and the profile fills up with 1px jitter. So the contour
// here is a piecewise-CONSTANT base — one value per 16px CELL, so every step in
// the silhouette lands on the tile grid — plus one authored 16px lobe.
//
// Run alphabet per lobe is exactly {2px, 4px} with 1px vertical steps, which is
// the ref's alphabet. Amplitude 3 on the rock (the ref bank spans 0..3).
// The B variants are the SAME lobe with its crest one pixel wider — the way a
// tilesheet carries two cliff-edge tiles that share every other pixel, not two
// unrelated squiggles. Two differing positions each, so a variant cell costs
// the exact-16 repeat 2 positions per boundary instead of 16.
const RIM_LOBE = {
  //        0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  rock:    [0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1, 0, 0],  // runs 2,2,4,2,2,2,2
  rockB:   [0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 0, 0],  // runs 2,2,2,4,2,2,2
  // The lawn lid above it is the CALMER of the two contours — measured 2.0 in
  // the ref against the rock's 5.7 — so it rides the SAME phase and the same
  // cell table with a shallower lobe. Same table, same steps, constant band.
  grass:   [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],  // runs 2,4,4,4,2
  grassB:  [0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0],  // runs 4,2,4,4,2
};

// Stamp a contour: `cells[c]` is the base value for the whole of 16px cell c
// (so the base can only step at a multiple of 16), `variant` names the cells
// that carry the second lobe. ALttP repeats the identical lobe five or more
// times running over 84px, so one variant every 5th-6th cell is the right
// density — any denser and the exact-16 repeat collapses.
function stamped(len, cells, variant, lobe, lobeB) {
  return Array.from({ length: len }, (_, t) => {
    const c = Math.min(cells.length - 1, Math.floor(t / 16));
    return cells[c] + (variant.has(c) ? lobeB : lobe)[mod(t, 16)];
  });
}

function buildIsland() {
  const W = 240, H = 192;                 // 15 x 12 cells of 16px
  // South band: the B lobe every 5th cell, and one 3px base step at cell 11.
  // The ref repeats the identical lobe five times running over 84px, so that
  // is the density; the base step is the "next tile down" a map author places.
  const sCells = [178, 178, 178, 178, 178, 178, 178, 178, 178, 178, 178,
    181, 181, 181, 181];
  const sVar = new Set([5, 10]);
  // East band: same grammar, B lobe at cells 4 and 9, base step at cell 8.
  const eCells = [232, 232, 232, 232, 232, 232, 232, 232,
    229, 229, 229, 229];
  const eVar = new Set([4, 9]);
  // Band widths. 44px of face over a 14px course pitch reads as THREE strata,
  // which is what the ref does (course tops at y=83, 97, 111).
  const BAND_S = 44, BAND_E = 30;
  // The rock silhouette and the grass lid come off the SAME cell table and the
  // SAME variant set, so the band holds a constant width and all four contours
  // — rim->sky, grass->rim and the interior course delimiters that hang off the
  // grass distance field — share one 16px phase.
  const by = stamped(W, sCells, sVar, RIM_LOBE.rock, RIM_LOBE.rockB);
  const gy = stamped(W, sCells.map(v => v - BAND_S), sVar,
    RIM_LOBE.grass, RIM_LOBE.grassB);
  const cx = stamped(H, eCells, eVar, RIM_LOBE.rock, RIM_LOBE.rockB);
  const gx = stamped(H, eCells.map(v => v - BAND_E), eVar,
    RIM_LOBE.grass, RIM_LOBE.grassB);
  const at = (arr, i) => arr[Math.min(arr.length - 1, Math.max(0, i))];
  // Rounded SE corner: a quarter arc where the two bands meet, so the point
  // of the island is an arc broken into 4-2-1 steps rather than a spike.
  const rounded = (R) => (x, y, ex, sy) => {
    if (x > ex || y > sy) return false;
    const dx = x - (ex - R), dy = y - (sy - R);
    if (dx <= 0 || dy <= 0) return true;
    return dx * dx + dy * dy <= R * R;
  };
  const landCorner = rounded(24), grassCorner = rounded(20);
  return buildRock(W, H, {
    ox: 0, oy: 0,
    land: (x, y) => landCorner(x, y, at(cx, y), at(by, x)),
    grass: (x, y) => grassCorner(x, y, at(gx, y) - 1, at(gy, x) - 1),
  });
}

{
  const isle = buildIsland();
  for (let r = ISLE.r0; r <= ISLE.r1; r++) {
    for (let c = ISLE.c0; c <= ISLE.c1; c++) {
      if (r < ISLE.rim && c < ISLE.band) continue;   // plain grass up there
      T[`isle_${c}_${r}`] = isle.slice(r * 16, r * 16 + 16)
        .map(row => row.slice(c * 16, c * 16 + 16));
    }
  }
}

// --- Sky + the cloud sea far below the island ---

T.sky = Array(16).fill('yyyyyyyyyyyyyyyy');

T.sky2 = [
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyYYWWYYyyyyyy',
  'yyYYWWWWWWYYyyyy',
  'yyyyYYYYYYyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyYYWYyyyy',
  'yyyyyyyYWWWWYyyy',
  'yyyyyyyyYYYYyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
];

// ---------------------------------------------------------------------------
// Cloud sea. ONE 512x32 field, periodic in x so it can DRIFT under the island
// without a seam — the horizon masses into cumulus lumps instead of repeating
// four profiles, and the deck below carries lens-shaped shelves (lit on top,
// shadowed under) instead of ruled dashes.
//
// VALUES. The whole point of this field is negative space: it has to sit
// BEHIND the island, not in front of it. Measured on the refs, ALttP's water
// spans lum 70 -> 164 with its base tone (92) near the BOTTOM of that range,
// and the whole water field runs ~23 lum DARKER than the grass beside it.
// So the four tones here are
//   T #ffffff 255  1px sunlit crown ONLY (kept under ~1% of the screen)
//   w #b0cce8 199  lit crown         (SPARSE accent)
//   W #7c9cc8 152  the base value    (>= 50% of the band)
//   v #4870a4 106  crevice + the island's cast shadow (~16%)
//   i #34508c  79  the deepest crevices, inside the cast shadow
// internal span 199 -> 106 = 93, against the ref water's 94.
//
// DISTRIBUTION, which matters as much as the values. ALttP's water is not a
// gradient: measured on refs/overworld-bridge-link-midwalk (x0-80, y120-200)
// it is ONE base tone at 57.3% of the band plus ONE shadow at 16.4%, and
// every other colour is under 1.1%. A four-way even split reads as an
// airbrushed haze band, not as water. So the shelf heights are quantised by
// PERCENTILE against the field's own histogram rather than by fixed
// thresholds: whatever the noise does, the shares come out where they are
// authored to be.
const DECK_SHARES = { w: 0.02, W: 0.92, v: 0.04 };   // remainder -> i
// ---------------------------------------------------------------------------

const DECK_W = 512, DECK_H = 32;

function buildCloudSea() {
  const W = DECK_W, H = DECK_H;
  let seed = 0x51ed270b >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Shortest signed distance on the ring, so every mass wraps and the field
  // is genuinely periodic — the deck can scroll forever off one authored strip.
  const wrapDx = (a, b) => {
    let d = a - b;
    if (d > W / 2) d -= W;
    if (d < -W / 2) d += W;
    return d;
  };
  // Overlapping domes of varied radius and height: the horizon masses.
  const ms = [];
  for (let x = 0; x < W;) {
    // Flatter horizon than before: the sky wedge above the cumulus tops used
    // to eat 16% of the deck strip, and that sky is a THIRD large value inside
    // the band the critic measures. Domes 2-6 tall off a base of 6 keep the
    // horizon reading as cloud tops while handing the band back to the deck.
    const r = 9 + Math.floor(rand() * 15), h = 2 + Math.floor(rand() * 5);
    ms.push([x, r, h]);
    x += Math.max(7, r - 3 + Math.floor(rand() * 13));
  }
  const top = new Array(W);
  for (let x = 0; x < W; x++) {
    let t = 6;
    for (const [cx, r, h] of ms) {
      const u = wrapDx(x, cx) / r;
      if (u > -1 && u < 1) t = Math.min(t, 6 - Math.round(h * Math.sqrt(1 - u * u)));
    }
    top[x] = t;
  }
  // The deck seen from above: cumulus cells on a jittered lattice, each lit on
  // its upper-left crown and shaded into its lower-right belly, with the deep
  // crevices between cells falling to the darkest value. That massing is what
  // separates a cloud sea from ruled notebook paper.
  const puffs = [];
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 28; gx++) {
      puffs.push([
        mod(gx * 19 + Math.floor(rand() * 14) - 6, W),
        10 + gy * 8 + Math.floor(rand() * 6),
        9 + Math.floor(rand() * 11), 4 + Math.floor(rand() * 4),
        1.6 + rand() * 1.6,
      ]);
    }
  }
  // The gap between two cells is the FLOOR of the field, not a mid tone: in
  // ALttP's water the trough between two wave shapes falls to the darkest
  // value in the ramp. The floor itself undulates on two long wavelengths
  // (both whole numbers of cycles across the strip, so the field stays
  // periodic), which is what stops every gap from being the same black line:
  // some troughs bottom out in the crevice tone, some in the deepest one.
  const floorAt = (x, y) =>
    0.44 + 0.13 * Math.sin((2 * Math.PI * 5 * x) / W + y * 0.30)
    + 0.09 * Math.sin((2 * Math.PI * 11 * x) / W - y * 0.17);
  const height = (x, y) => {
    let h = floorAt(x, y);
    for (const [cx, cy, rx, ry, amp] of puffs) {
      const u = wrapDx(x, cx) / rx, v = (y - cy) / ry;
      const q = 1 - u * u - v * v;
      if (q <= 0) continue;
      const t = amp * Math.sqrt(q) - v * 0.55 - u * 0.30;
      if (t > h) h = t;
    }
    return h;
  };
  // Quantise by PERCENTILE, not by fixed height thresholds: sort the field's
  // own shelf heights and cut it where DECK_SHARES says, so the deck comes out
  // with one dominant value and sparse accents no matter what the noise does.
  const hs = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (y - top[x] >= 1) hs.push(height(x, y));
  }
  hs.sort((a, b) => b - a);
  const cut = (f) => hs[Math.min(hs.length - 1, Math.floor(hs.length * f))];
  const tw = cut(DECK_SHARES.w);
  const tW = cut(DECK_SHARES.w + DECK_SHARES.W);
  const tv = cut(DECK_SHARES.w + DECK_SHARES.W + DECK_SHARES.v);
  const g = Array.from({ length: H }, () => new Array(W).fill('W'));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = y - top[x];
      if (d < -1) { g[y][x] = 'y'; continue; }
      if (d < 0) { g[y][x] = 'u'; continue; }
      if (d < 1) { g[y][x] = 'w'; continue; }         // 1px lit horizon lip
      const h = height(x, y);
      // A shelf pixel whose neighbour above is not shelf is the lit top of a
      // cell: it keeps a 1px crown of the value above it, so the massing
      // reads as stacked cumulus rather than mottling.
      let ch = h > tw ? 'w' : h > tW ? 'W' : h > tv ? 'v' : 'i';
      if (ch === 'W' && y > 1 && height(x, y - 1) <= tW) ch = 'w';
      g[y][x] = ch;
    }
  }
  // The horizon lip only catches the sun where a dome CRESTS — a continuous
  // white line all the way across would be the brightest object on the screen
  // and would read as an ink outline, which ALttP never draws on terrain.
  for (let x = 0; x < W; x++) {
    let m = 99;
    for (let k = -7; k <= 7; k++) m = Math.min(m, top[mod(x + k, W)]);
    if (top[x] <= m) g[top[x]][x] = 'T';
  }
  // Sun glints. ALttP spends its whitest value on ~1% of a screen and always
  // as short solid DASHES (the flat-water highlight in overworld-bridge), never
  // as a dotted line, so the crown of a body cell gets one 4-6px solid segment
  // and the rest of the run stays body colour.
  for (let y = 2; y < H; y++) {
    let x = 0;
    while (x < W) {
      const lit = (q) => g[y][mod(q, W)] === 'w' && g[y - 1][mod(q, W)] !== 'w'
        && g[y - 1][mod(q, W)] !== 'T';
      if (!lit(x)) { x++; continue; }
      let n = 0;
      while (n < 24 && lit(x + n)) n++;
      if (n >= 5) {
        const len = Math.min(6, n - 2), s0 = x + 1 + mod(x * 5 + y * 3, Math.max(1, n - len - 1));
        for (let k = 0; k < len; k++) g[y][mod(s0 + k, W)] = 'T';
      }
      x += n;
    }
  }
  return g;
}

const CLOUDSEA = buildCloudSea();

// The island's shadow lying across the cloud tops. Every value drops one step
// inside it, with a dithered rim — without this the island reads as pasted on
// a backdrop instead of hanging above a real cloud deck. Sky values are left
// alone so the shadow can be composited over a DRIFTING deck: the horizon
// wanders through the mask, and only cloud pixels darken.
const SHADE_DOWN = { T: 'w', w: 'W', W: 'v', v: 'i', i: 'i', y: 'y', u: 'u' };

// Fixed-in-screen-space mask for that shadow: an ellipse under the island
// footprint with a dithered rim. 256 wide (the screen), not DECK_W.
// SIZE. This mask darkens every value one step, so it is not just a shadow —
// it is the band's SECOND value, and its area IS that value's share. At the
// old 124x26 it covered half the deck and split the base tone straight down
// the middle (34.5% / 34.6%). Sized to ~15% of the band it does what ALttP's
// water shadow does: one base at 57%, one shadow at 16%, nothing else.
function cloudShadowMask(x, y) {
  const u = (x - 96) / 108, v = (y - 1) / 15;
  const r = u * u + v * v;
  if (r > 1.0) return false;
  if (r > 0.72 && mod(x * 3 + y * 5, 3) !== 0) return false;
  return true;
}

// Three strips the scene composites each frame: the deck, the same deck fully
// in shadow, and the (static) mask that decides where the second shows through.
const DECK_ROWS = CLOUDSEA.map(r => r.join(''));
const DECK_DARK_ROWS = CLOUDSEA.map(r => r.map(ch => SHADE_DOWN[ch]).join(''));
const DECK_MASK_ROWS = Array.from({ length: DECK_H }, (_, y) =>
  Array.from({ length: 256 }, (_, x) => (cloudShadowMask(x, y) ? 'k' : '.')).join(''));

export const CLOUD_DECK = { w: DECK_W, h: DECK_H };

// Cloud-sea top row. Four profiles that all meet the neighbouring tile at
// y=6, so the horizon can wander instead of repeating one sawtooth.
T.cloud_a = [
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyuwwuyyyyyy',
  'yyyyyuwTTwuyyyyy',
  'yyyyuwTTTTwuyyyy',
  'yyyuwTTTTTTwuyyy',
  'wwwwwTTTTTTwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwvwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwWWwwwwwwWWwww',
  'WWvwwWWWWWWvwwWW',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

T.cloud_b = [
  'yyyyyyyyyyyyyyyy',
  'yyyyyuwwwwuyyyyy',
  'yyyuwTTTTTTwuyyy',
  'yyuwTTTTTTTTwuyy',
  'yuwTTTTTTTTTTwuy',
  'ywTTTTTTTTTTTTwy',
  'wwwTTTTTTTTTTwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwWWvwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwWWwwwwwwwWWwww',
  'WvwwWWWWWWWvwwWW',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

T.cloud_c = [
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyuuyyy',
  'yyyyyyyyyyuwwuyy',
  'wwwwwwwwwwwTTwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwWWvwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwWWwwwwwwWWww',
  'WWvwwwWWWWWvwwWW',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

T.cloud_d = [
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyyyyyyyyyyyyyy',
  'yyyuuyyyyyyuuyyy',
  'yyuwwuyyyyuwwuyy',
  'yyuwTwuyyuwTTwuy',
  'wwwwTwwwwwwTTwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwvWWww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwWWwwwwWWwwwwww',
  'WvwwWWWvwwWWWWWW',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

T.cloud_mid = [
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'Wwwwwwwvvwwwwwww',
  'vWWWWWWwwWWWWWWv',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwWWwwwwwwWWwww',
  'WWWvvWWWWWWvvWWW',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'Wwwwwwwvvwwwwwww',
  'vWWWWWWwwWWWWWWv',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

T.sky_deep = T.cloud_a; // kept for older scenes

// ---------------------------------------------------------------------------
// Decor sprites (transparent backgrounds, drawn over terrain)
// ---------------------------------------------------------------------------

const SP = {};

// Cloud-sea strips (built above): the drifting deck, the same deck one value
// step down, and the island's cast-shadow mask that is fixed in screen space.
SP.cloud_deck = DECK_ROWS;
SP.cloud_deck_dark = DECK_DARK_ROWS;
SP.cloud_deck_mask = DECK_MASK_ROWS;

// Bushes: clustered leaf scallops — three top clumps with speckle
// highlights upper-left, dark seams between clumps, scalloped notched
// bottom, dithered shadow row. Two variants.
// Bushes: one continuous scalloped dome (the old split crown read as a
// heart), speckle highlights upper-left, dark leaf seams, notched bottom and
// a dithered contact shadow like the trees have.
// A tall round crown: the highlight rim runs along the upper-LEFT lip (sun is
// upper-left everywhere on this sheet) and the interior hatch is its own
// pattern, not shared with bush2.
SP.bush = [
  '................',
  '....kkkkkkkk....',
  '..kkHHHlllllkk..',
  '.kHHHlllllllllk.',
  '.kHHllldllllllk.',
  'kHHllldllldllllk',
  'kHllldllllldlllk',
  'klllldllldlllllk',
  'kldllldllldlldlk',
  'kdlldlldlldllllk',
  '.kdlldlldlldllk.',
  '.kddlldlldldllk.',
  '..kdldlddldllk..',
  '..kkdkkddkkkk...',
  '.bbbbbbbbbbbb...',
  '..bbbbbbbbbb....',
];

// A squatter, wider bush with a notched crown, one leaf lobe pushed left and
// a coarser interior hatch — same family, plainly not the same drawing.
SP.bush2 = [
  '................',
  '................',
  '..kkkkk...kkkk..',
  '.kHHlllkkkllllk.',
  'kHHllllllllldllk',
  'kHllldllllldlllk',
  'klllldllllldlllk',
  'klldlllllldllllk',
  'kldllldllldllllk',
  'kdllldlldlllldlk',
  'kdllldlldlldlllk',
  '.kdlldlldlldllk.',
  '..kddlddldlddk..',
  '...kkdkkkdkkk...',
  '..bbbbbbbbbbb...',
  '...bbbbbbbbb....',
];

// Tall-grass tufts: spiky blade clusters, ALttP field grass. Two shapes so a
// screenful of them never reads as one repeated glyph.
SP.tallgrass = [
  '................',
  '................',
  '................',
  '..b..b...b..b...',
  '..lb.b...bl.b...',
  '.bllbb.b.blbb.b.',
  '.dblbbd..dblbbd.',
  '..dbbd....dbbd..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

SP.tallgrass2 = [
  '................',
  '................',
  '................',
  '................',
  '.....b....b..b..',
  '..b..bl..bl.bb..',
  '.bl.blb..blbbb..',
  'bbldblbd.dbbbld.',
  '.dbbbd....dbbd..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

SP.tallgrass3 = [
  '................',
  '................',
  '................',
  '.b..b...........',
  '.blb.b......b...',
  'bblbbl....b.bl..',
  '.dbbbd...bllbbd.',
  '..dbd.....dbbd..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// Faceted chunky rock: flat lit top plane, mid sides with vertical
// creases, dark base, angular silhouette.
SP.rock = [
  '................',
  '................',
  '....kkkkkk......',
  '..kkRRRRRRk.....',
  '.kRRRRRRRRRk....',
  '.kRRRRRRRRRrk...',
  'kRrRRRRrrrrrrk..',
  'krrrrxrrrxrrrk..',
  'krrxxrrrrxxrrk..',
  'kxrrxrrrrxrxxk..',
  '.kxxxxxxxxxxk...',
  '..kkkkkkkkkk....',
  '................',
  '................',
  '................',
  '................',
];

SP.rock_small = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkRRRRk.....',
  '....kRRRRrrk....',
  '....kRrrxrrk....',
  '....krxxrxxk....',
  '.....kxxxxk.....',
  '.....kkkkkk.....',
  '................',
  '................',
  '................',
  '................',
];

// Path pebbles: a few small soft stones for dirt tiles (no hard outline).
SP.pebbles = [
  '................',
  '................',
  '................',
  '...ee...........',
  '...qq...........',
  '................',
  '................',
  '..........ee....',
  '..........qq....',
  '................',
  '................',
  '....eq..........',
  '....qq..........',
  '................',
  '................',
  '................',
];

SP.post = [
  '.....kkkk.......',
  '....kNNNmk......',
  '....kNnnmk......',
  '....kNnnmk......',
  '....kNnnmk......',
  '....kNnnmk......',
  '....kmnnmk......',
  '....kNnnmk......',
  '....kNnnmk......',
  '....kNnnmk......',
  '....kmnmmk......',
  '....kkkkkk......',
  '...bbbbbbbb.....',
  '....bbbbbb......',
  '................',
  '................',
];

SP.fence = [
  '..kkk......kkk..',
  '..kNmk....kNmk..',
  '..kNmk....kNmk..',
  '..kNmk....kNmk..',
  'kkkNmkkkkkkNmkkk',
  'NNkNmkNNNNkNmkNN',
  'nnkNmknnnnkNmknn',
  'mmkNmkmmmmkNmkmm',
  'kkkNmkkkkkkNmkkk',
  '..kNmk....kNmk..',
  'kkkNmkkkkkkNmkkk',
  'NNkNmkNNNNkNmkNN',
  'mmkNmkmmmmkNmkmm',
  '..kkkk....kkkk..',
  '.bbbbbb..bbbbbb.',
  '..bbbb....bbbb..',
];

// Verdigris streaks down the shaded flank, heaviest just under the coupling
// band at rows 7-8 where water sits.
SP.pipe_v = [
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzPk....',
  '....kABBBzzk....',
  '....kABBBPzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kzBBBBzk....',
  '....kAzzzzAk....',
  '....kABBBPPk....',
  '....kABBBzPk....',
  '....kABBBzzk....',
  '....kABBBPzk....',
  '....kABBBzzk....',
  '....kABBBzPk....',
  '....kABBBzzk....',
];

SP.pipe_h = [
  '................',
  '................',
  '................',
  '................',
  'kkkkkkkkkkkkkkkk',
  'AAAAAAAzAAAAAAAA',
  'BBBBBBBABBBBBBBB',
  'BBBBBBBzBBBBBBBB',
  'zBBBBBBzBBBBBBBz',
  'zzzzzzzAzzzzzzzz',
  'kkkkkkkkkkkkkkkk',
  '................',
  '................',
  '................',
  '................',
  '................',
];

SP.pipe_cap = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '...kkkkkkkkkk...',
  '..kAABBBBBzzAk..',
  '..kzzPzzzzPzzk..',
  '...kkABBBzzkk...',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
];

SP.pipe_end = [
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kABBBzzk....',
  '....kzzzzzzk....',
  '...kkkkkkkkkk...',
  '...kzBBBBBBzk...',
  '...kkkkkkkkkk...',
  '................',
  '................',
];

// Steam vent: a squat riveted stack STANDING ON the ground — flared base
// collar, dark ground line, dithered contact shadow — with the grate at the
// top so the plume leaves from the nozzle instead of floating above it.
SP.vent = [
  '................',
  '...kkkkkkkkkk...',
  '..kzBBBBBBBBzk..',
  '..kAzzzzzzzzAk..',
  '..kzkkkkkkkkzk..',
  '..kzkzBzzBzkzk..',
  '..kzkkkkkkkkzk..',
  '...kABBBBBBAk...',
  '...kzBBzzBBzk...',
  '...kABBBBBBAk...',
  '..kkzBBzzBBzkk..',
  '.kzABBBBBBBBAzk.',
  '.kzzzzzzzzzzzzk.',
  '.kkkkkkkkkkkkkk.',
  '..bbbbbbbbbbbb..',
  '...b.bbbbbb.b...',
];

SP.steam1 = [
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
  '.....wwww.......',
  '....wWwwWw......',
  '.....wwww.......',
  '................',
];

SP.steam2 = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....wwwww.......',
  '...wwwwwww......',
  '...wWwwwWw......',
  '....wwwwww......',
  '.....wwww.......',
  '.....wwww.......',
  '....wWwwWw......',
  '.....wwww.......',
  '................',
];

SP.steam3 = [
  '...wwwwwww......',
  '..wwwwwwwww.....',
  '..wWwwwwwWw.....',
  '..wwwwwwwww.....',
  '...wwwwwww......',
  '.....www........',
  '.....wwww.......',
  '....wwwwww......',
  '....wWwwWw......',
  '.....wwwww......',
  '......wwww......',
  '.....wwww.......',
  '.....wwww.......',
  '....wWwwWw......',
  '.....wwww.......',
  '................',
];

// Cliff-top parapet: a low stone wall capping the path spur, so the spur ends
// at a destination instead of a point in the middle of a field — and the
// screen gets one built anchor with a second elevation in it. 48x18: a strip
// of sunlit top surface, the seam, then the block-coursed front face.
function makeParapet(W) {
  const rows = [];
  const line = (f) => Array.from({ length: W }, (_, x) => f(x)).join('');
  const cap = (ch) => line(x => (x === 0 || x === W - 1) ? '.' : 'k');
  const joint = (x, off) => mod(x + off, 13) === 12;
  rows.push(cap());
  // Top surface: light, with the block joints carried up onto it.
  rows.push(line(x => x < 1 || x >= W - 1 ? 'k' : joint(x, 3) ? 'r' : 'R'));
  rows.push(line(x => x < 1 || x >= W - 1 ? 'k' : joint(x, 3) ? 'r' : 'R'));
  rows.push(line(x => x < 1 || x >= W - 1 ? 'k' : joint(x, 3) ? 'x' : 'r'));
  rows.push(line(x => x < 1 || x >= W - 1 ? 'k' : 'x'));       // top/front seam
  // Front face: two courses of blocks, lit along each block's top edge.
  for (let y = 0; y < 10; y++) {
    const course = y < 5 ? 0 : 1;
    const off = course ? 9 : 3;
    const top = (y % 5) === 0;
    const bot = (y % 5) === 4;
    rows.push(line(x => {
      if (x < 1 || x >= W - 1) return 'k';
      if (joint(x, off)) return 'x';
      return top ? 'R' : bot ? 'x' : 'r';
    }));
  }
  rows.push(cap());
  rows.push(line(x => (x === 0 || x >= W - 1) ? '.' : 'b'));
  rows.push(line(x => (x < 2 || x >= W - 2) ? '.' : 'b'));
  return rows;
}
SP.parapet = makeParapet(40);

SP.flower_w1 = [
  '..ff....',
  '..ff....',
  'ffhhff..',
  'ffhhff..',
  '..ff....',
  '..ff....',
  '........',
  '........',
];
SP.flower_w2 = [
  'ff..ff..',
  'ff..ff..',
  '..hh....',
  '..hh....',
  'ff..ff..',
  'ff..ff..',
  '........',
  '........',
];
SP.flower_r1 = [
  '..FF....',
  '..FF....',
  'FFhhFF..',
  'FFhhFF..',
  '..FF....',
  '..FF....',
  '........',
  '........',
];
SP.flower_r2 = [
  'FF..FF..',
  'FF..FF..',
  '..hh....',
  '..hh....',
  'FF..FF..',
  'FF..FF..',
  '........',
  '........',
];

// ---------------------------------------------------------------------------
// Big tree: 4x4 tiles (64x64). A wide canopy built from a dozen overlapping
// clumps, so the silhouette is lumpy rather than a lollipop; every clump is
// lit on its crown and dark under its belly, with a hard dark seam wherever
// two clumps meet. The bottom third of the canopy is under-canopy shadow.
// Speckle highlights sit in 2x2 clusters on the sunlit crowns. Trunk is
// stout, knotted, root-flared, and banded with riveted brass (sky-isle sap
// pressure) rather than segmented like bamboo.
// ---------------------------------------------------------------------------

// Clustered rounded blobs on a jittered lattice — used to break smooth
// shading into chunky pixel-art clusters.
function blobAt(x, y, cell, seed) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(x / cell) + dx, cy = Math.floor(y / cell) + dy;
      const h = ((cx * 374761393 + cy * 668265263) ^ seed) >>> 0;
      if (h % 5 < 2) continue;
      const px = cx * cell + (h % cell), py = cy * cell + ((h >> 5) % cell);
      const rx = 2 + ((h >> 10) % 3), ry = 1 + ((h >> 13) % 3);
      const a = (x - px) / (rx + 0.5), b = (y - py) / (ry + 0.5);
      if (a * a + b * b <= 1) return true;
    }
  }
  return false;
}

// Short dark seam strokes inside a canopy: 3-5px dashes on a jittered lattice.
// ALttP canopies are read as CLUSTERS of leaf lumps, and what separates one
// lump from the next is a stroke, not a gradient.
function seamAt(x, y, seed) {
  const cx = Math.floor(x / 9), cy = Math.floor(y / 8);
  const h = ((cx * 374761393 + cy * 668265263) ^ seed) >>> 0;
  if (h % 3 === 0) return false;
  const px = cx * 9 + (h % 6), py = cy * 8 + ((h >> 4) % 6);
  const len = 3 + ((h >> 9) % 3);
  return y === py + (((h >> 12) & 1) && x > px + 1 ? 1 : 0) &&
    x >= px && x < px + len;
}

function makeTreeRows(clumps, seed, trunkX) {
  const W = 64, H = 64;
  const g = Array.from({ length: H }, () => new Array(W).fill('.'));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let d1 = 9, d2 = 9, best = null;
      for (const cl of clumps) {
        const dx = x - cl[0], dy = (y - cl[1]) * 1.15;
        const d = Math.sqrt(dx * dx + dy * dy) / cl[2];
        if (d < d1) { d2 = d1; d1 = d; best = cl; } else if (d < d2) { d2 = d; }
      }
      // Scalloped perimeter: the canopy edge steps in and out in 5-7px leaf
      // lumps, so the silhouette is a cluster of lumps, not a smooth balloon.
      if (d1 > 1 + (blobAt(x, y, 7, seed ^ 0x51a7) ? 0.14 : -0.065)) continue;
      // Sun from the upper left: each mass keeps a lit crown and a dark
      // belly, and the whole canopy sinks into shadow toward the trunk.
      let t = (y - best[1]) / best[2] * 1.25
        + (x - best[0]) / best[2] * 0.30
        + (y - 2) / H * 1.15 - 0.20;
      // Quantise to five leaf greens, but dither each boundary with rounded
      // leaf clusters — a smooth ramp is what makes a canopy look airbrushed.
      const lvf = (t + 0.62) / 0.40;
      let lv = Math.floor(lvf);
      const frac = lvf - lv;
      if (frac > (blobAt(x, y, 6, seed ^ 0x9e37) ? 0.28 : 0.82)) lv += 1;
      // Hard dark seam wherever two masses meet, and a deep under-canopy
      // shadow: without those a canopy reads as one soft pillow.
      if (d2 - d1 < 0.16) lv = Math.max(lv, d2 - d1 < 0.07 ? 4 : 3);
      // Seam strokes between leaf lumps inside each mass.
      if (seamAt(x, y, seed ^ 0x3d17)) lv = Math.max(lv, 3);
      if (y > 42) lv += 1;
      if (y > 50) lv += 1;
      lv = Math.max(0, Math.min(4, lv));
      // Five leaf greens. The deepest one is V #1c3020 (lum 40), NOT the
      // #1b5226 used for grass shadow (lum 60): measured on the refs, ALttP's
      // foliage floor is #282828 (lum 40) in every canopy sample, and a 60-lum
      // floor is exactly what makes a canopy read soft instead of lumpy.
      // THREE leaf greens plus the H speckle, not five. The old ramp ran
      // #74C266 160 / #58AA50 135 / #327F3A 96 / #287838 89 / #1C3020 40 —
      // steps of 25, 39, 7 and 49. The 7 and the 25 were pure gradient
      // smoothing, and a smoothed ramp is exactly what makes a canopy lobe
      // read soft instead of stamped. ALttP's grass ramp steps 34/39/35 with
      // no in-betweens; this one is 188 / 135 / 89 / 40, i.e. 53/46/49.
      // Levels are still 0-4 so the seam and under-canopy rules below keep
      // pointing at the rung they were authored for.
      let ch = 'llddV'[lv];
      // Clustered speckle highlights on the sunlit crowns.
      if (lv <= 1 && blobAt(x, y, 7, seed ^ 0x2545) && t < -0.28) ch = 'H';
      g[y][x] = ch;
    }
  }
  // Outline: 1px on top and sides, 2px along the underside so the canopy sits
  // over its own shadow instead of floating. Dark GREEN, not near-black.
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) {
      if (g[y][x] === '.' || g[y][x] === 'V') continue;
      let edge = false, under = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || g[ny][nx] === '.') {
          edge = true; if (dy === 1) under = true;
        }
      }
      if (edge) {
        g[y][x] = 'V';
        // Second row along the underside only, in the deep leaf green, so the
        // canopy sits over its own shadow without a fat black rind.
        if (under && y > 0 && g[y - 1][x] !== '.' && g[y - 1][x] !== 'V') {
          g[y - 1][x] = 'b';
        }
      }
    }
  }
  let out = g.map(r => r.join(''));
  // Slimmer knotted trunk: 10px of wood inside a 1px outline, knotholes, a
  // narrow riveted brass sap-tap (two rows, inset from the outline so it
  // reads as a band clamped round the bole, not a mail slot), root flare.
  const trunk = [
    'kmmmnnnmmk',   // top of the bole sits in the canopy's own shadow, so it
    'kmnnnnnnmk',   // grows out of the mass instead of being pasted onto it
    'kNnmmnnnmk',
    'kNnmmnnnmk',
    'kNnnnnmmmk',
    'kzBzzzzBzk',
    'kzABBBBAzk',
    'kNnnnnnnmk',
    'kNnnmnnnmk',
    'kNnnmnnnmk',
    'kNnnnnnnmk',
    'kNnnnnnnmk',
  ];
  trunk.forEach((tr, i) => { out = stamp(out, trunkX, 46 + i, [tr]); });
  out = stamp(out, trunkX - 2, 58, ['kNNnnnnnnnnmmk']);
  out = stamp(out, trunkX - 3, 59, ['kNNnnnnnnnnnnmmk']);
  out = stamp(out, trunkX - 3, 60, ['kkkkkkkkkkkkkkkk']);
  // Dithered contact shadow, wider than the roots and 3 rows deep.
  out = stamp(out, trunkX - 7, 61, ['bbbbbbbbbbbbbbbbbbbbbbbb']);
  out = stamp(out, trunkX - 5, 62, ['.bbbbbbbbbbbbbbbbbbb.']);
  out = stamp(out, trunkX - 1, 63, ['.bbbbbbbbbbbb.']);
  return out;
}
// Two trees with genuinely different masses, not one shape and its mirror:
// different clump counts, different crown heights, different trunk offsets and
// different leaf seeds, so a screen carrying both never reads as a stamp.
SP.tree = makeTreeRows(
  [[31, 14, 17], [12, 24, 14], [50, 24, 14], [21, 38, 16], [43, 38, 16]],
  0x1111, 27);
SP.tree2 = makeTreeRows(
  [[26, 11, 15], [45, 17, 13], [11, 27, 16], [52, 31, 12],
    [28, 33, 18], [17, 42, 13]],
  0x7ae3, 24);

SP.cloud1 = [
  '.............wwwwww.....................',
  '..........wwwwwwwwww....................',
  '......wwwwwwwwwwwwwwww.......wwww.......',
  '...wwwwwwwwwwwwwwwwwwwww...wwwwwwww.....',
  '..wwwwwwwwwwwwwwwwwwwwwww.wwwwwwwwww....',
  '.wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww..',
  'wwwwWWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww.',
  'WwwWWWWwwwwwWWwwwwwwwwWWwwwwwwwwwwwWWW.',
  'WWWWWWWWWwwWWWWWwwwwWWWWWWWwwWWWWWWWWW.',
  '.WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW...',
  '...WWWWWW..WWWWWWWWWW....WWWWWWWW.......',
  '........................................',
];

SP.cloud2 = [
  '........wwww............',
  '.....wwwwwwwww..........',
  '...wwwwwwwwwwwww.wwww...',
  '..wwwwwwwwwwwwwwwwwwww..',
  '.wwWWwwwwwwwwwwwwwwwWW..',
  'WWWWWWWwwWWWWwwwWWWWWWW.',
  '.WWWWWWWWWWWWWWWWWWWW...',
  '...WWWW...WWWWWWWW......',
];

// ---------------------------------------------------------------------------

function assertTiles(defs) {
  for (const [name, rows] of Object.entries(defs)) {
    if (rows.length !== 16) throw new Error(`tile ${name}: ${rows.length} rows`);
    rows.forEach((r, i) => {
      if (r.length !== 16) throw new Error(`tile ${name} row ${i}: len ${r.length}`);
    });
  }
}

export function makeTileset() {
  assertTiles(T);
  const tiles = makeTiles(T, PAL);
  // Mirrored tiles derived from authored ones (west/NW variants).
  tiles.edge_wa = flipH(tiles.edge_ea);
  tiles.edge_wb = flipH(tiles.edge_eb);
  tiles.corner_nw = flipH(tiles.corner_ne);
  tiles.csw_rim = flipH(tiles.cse_rim);
  tiles.csw_face = flipH(tiles.cse_face);
  tiles.csw_lobe = flipH(tiles.cse_lobe);
  tiles.cw_rim = flipH(tiles.ce_rim);
  tiles.cw_face = flipH(tiles.ce_face);
  tiles.cw_lobe = flipH(tiles.ce_lobe);

  const sprites = {};
  for (const [name, rows] of Object.entries(SP)) sprites[name] = makeSprite(rows, PAL);
  return { tiles, sprites };
}
