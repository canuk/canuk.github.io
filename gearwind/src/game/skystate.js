// The falling-island light: FIVE AUTHORED PALETTES for Chapter 1.
//
// STORY.md's dramatic clock is visual, not a timer: Bellows Isle is sinking the
// whole chapter, so the light past the rim starts clear and goes stage by stage
// until the isle is inside the cloud deck. On real hardware that is one CGRAM
// write — the same tiles, a different palette — so that is exactly how it is
// done here.
//
// THE TABLE IS THE PIECE. `PALETTES` below is a palette STRIP: one row per
// colour the game's art actually uses, five authored columns, one per stage.
// Read a column top to bottom and you are reading that stage's 56-colour
// palette. Read a row left to right and you are reading how that one material
// weathers the fall. Nothing here is a global brightness slider — each stage
// moves hue as well as value, and it moves different materials by different
// amounts:
//
//   0 clear        the art as authored, snapped to the SNES 5-bit grid.
//   1 tilting      the isle drops out of the clean upper air into the haze
//                  that sits on the deck: the light goes WARM and slightly
//                  dusty. Same value as stage 0 (grass val 0.53) — you read
//                  this stage by its OLIVE cast, not by it being darker.
//   2 deepening    the warm light starts to go: value down (0.47), hue still
//                  on the warm side of green.
//   3 deck-rising  the sun is above the deck now and the isle is under it.
//                  Light turns COLD and desaturates hard (sat 0.53 -> 0.38).
//   4 inside-the-deck  diffuse blue-grey cloud light. Grass lands on
//                  #385848 — val 0.35, sat 0.36, i.e. right at the value of
//                  ALttP's darkest measured dominant (#305030, val 0.31) and
//                  LESS saturated than it. The floor is deliberate: the last
//                  act of Chapter 1 plays out here and Wren's teal coat
//                  (#207878 at this stage, val 0.47) has to stay separable
//                  from the ground.
//
// Two rules keep the fall honest:
//   * Every value in the table is on the SNES 5-bit grid (multiples of 8), so
//     no stage — or any interpolated point between two stages — can invent an
//     off-hardware colour.
//   * Colours are REPLACED, never blended over. A 4bpp tile that used lawn
//     green simply uses dusk green instead; pixel counts, dithering and
//     texture density are untouched, which is why a stage-4 screen still
//     measures the same as a stage-0 screen under tools/check-shot.py.
//
// Colours the table does not name (a scene's own interior palette, particle
// greys) fall through to GRADES: a per-stage, per-channel three-point tone
// curve (black point / mid / white point) fitted to that stage's column, so an
// unlisted colour lands where a listed neighbour would.
//
// INTERIORS take the same stages at reduced strength (`INDOOR`): the
// Boilerworks is lit by its own boilers, so the fall cools it without crushing
// it — at stage 4 an interior only travels 60% of the way to the outdoor
// column.
//
// Cloud parallax rides the same number: `drift(band)` returns the horizontal
// offset for a cloud band and the wind scales up as the isle falls (x1 at
// stage 0 -> x3.2 at stage 4), so the deck visibly races past by the time you
// are in it.

// ---------------------------------------------------------------------------
// THE PALETTE STRIP.  base art colour -> [stage0, 1, 2, 3, 4]
//
// Three deliberate consolidations, all of them 5-bit hygiene: PAL.j (leaf
// dark) is the same colour as PAL.G to within one 5-bit step, PAL.o (path
// outline) the same as PAL.S, and PAL.f/PAL.T are both "white" — the SNES
// cannot express #ffffff at all (max is #f8f8f8). Sharing a row means they
// share a palette entry at every stage instead of drifting apart.
// ---------------------------------------------------------------------------
export const PALETTES = {
  '#282828': ['#282828', '#382820', '#302820', '#282030', '#282030'], // PAL.k  dark outline
  '#408848': ['#408848', '#588840', '#487838', '#406848', '#385848'], // PAL.g  lawn base
  '#388038': ['#388038', '#508030', '#407030', '#386038', '#305040'], // PAL.G  lawn micro-stroke
  '#489848': ['#489848', '#609840', '#508838', '#487848', '#406048'], // PAL.a  lawn mottle
  '#287838': ['#287838', '#387830', '#306830', '#285838', '#285040'], // PAL.d  lawn dark weave
  '#1b5226': ['#185028', '#285820', '#204820', '#204030', '#183830'], // PAL.b  deepest green
  '#58aa50': ['#58a850', '#70a848', '#609840', '#588850', '#487050'], // PAL.l  leaf mid
  '#74c266': ['#78c068', '#90c058', '#78b050', '#709860', '#608060'], // PAL.L  leaf light
  '#9cd882': ['#a0d880', '#b8d070', '#a0c060', '#88b078', '#789070'], // PAL.H  leaf highlight
  '#327f3a': ['#388038', '#508030', '#407030', '#386038', '#305040'], // PAL.j  leaf dark  (= G)
  '#888040': ['#888040', '#a08038', '#887030', '#806040', '#685040'], // PAL.p  path dirt
  '#686028': ['#686028', '#806020', '#705820', '#604830', '#584030'], // PAL.q  path shade
  '#a09850': ['#a09850', '#b89848', '#a08840', '#907850', '#786050'], // PAL.e  path light
  '#2c2a18': ['#302018', '#402810', '#382018', '#302020', '#281828'], // PAL.o  path outline (= S)
  '#ab9358': ['#a89058', '#c09050', '#a88040', '#987058', '#806050'], // PAL.E  rock 1 (lit)
  '#948046': ['#908048', '#b08040', '#987038', '#886048', '#705048'], // PAL.D  rock 2
  '#7d6538': ['#806838', '#986830', '#805830', '#704838', '#604040'], // PAL.C  rock 3
  '#6c5330': ['#685030', '#885828', '#704828', '#684038', '#583838'], // PAL.M  rock 4
  '#5a4327': ['#584028', '#784820', '#604020', '#583030', '#483030'], // PAL.c  rock 5
  '#453220': ['#483020', '#603820', '#503020', '#482828', '#382028'], // PAL.s  rock 6
  '#2f2315': ['#302018', '#402810', '#382018', '#302020', '#281828'], // PAL.S  rock 7 (undercut)
  '#8a9a5a': ['#889858', '#a89850', '#908848', '#807858', '#686858'], // PAL.O  grass lip on rock
  '#8e968e': ['#909890', '#a89878', '#908868', '#807080', '#706078'], // PAL.r  stone grey
  '#c0c8ba': ['#c0c8b8', '#d0c8a0', '#c0b090', '#a8a0a8', '#888898'], // PAL.R  stone grey light
  '#525a52': ['#505850', '#705848', '#585040', '#504050', '#483850'], // PAL.x  stone grey dark
  '#996b33': ['#986830', '#b07030', '#986028', '#885038', '#784838'], // PAL.n  wood
  '#c69a5c': ['#c89860', '#d89850', '#c08848', '#a87858', '#906858'], // PAL.N  wood light
  '#63451f': ['#604820', '#804818', '#684020', '#603028', '#503028'], // PAL.m  wood dark
  '#c4a03e': ['#c0a040', '#d8a038', '#c09030', '#a88040', '#906840'], // PAL.B  brass
  '#e8d288': ['#e8d088', '#f0d078', '#e0c068', '#c0a880', '#a09078'], // PAL.A  brass light
  '#7c5c1e': ['#786020', '#986018', '#805018', '#704828', '#603828'], // PAL.z  brass dark
  '#d84848': ['#d84848', '#e84840', '#d04038', '#b83848', '#983048'], // PAL.F  flower red
  '#f0c848': ['#f0c848', '#f8c840', '#e8b038', '#c8a048', '#a08848'], // PAL.h  flower gold
  // --- sky and the cloud deck: hand-authored, not derived. The deck ramp is
  //     pulled DOWN with the ambient so the bottom strip never ends up the
  //     brightest thing on screen: at stage 4 the cloud body sits at val 0.56
  //     against grass at 0.35 (it was 0.69 against 0.22).
  '#68a4e0': ['#68a8e0', '#78a8d8', '#5088c0', '#3860a0', '#404860'], // PAL.y  sky field
  '#8ec4ee': ['#90c8f0', '#98c0e0', '#70a0d0', '#5078b8', '#505878'], // PAL.Y  sky highlight
  '#4e86c6': ['#5088c8', '#6090c0', '#3868a0', '#284888', '#303848'], // PAL.u  sky shade
  '#ffffff': ['#f8f8f8', '#f8f0e0', '#e8e0c8', '#c0c8d8', '#8890a0'], // PAL.T  cloud highlight
  '#f8f8f8': ['#f8f8f8', '#f8f0e0', '#e8e0c8', '#c0c8d8', '#8890a0'], // PAL.f  white (= T)
  '#f4f6f8': ['#f0f8f8', '#f0e8d8', '#d8d0b8', '#a8b0c0', '#788090'], // PAL.w  cloud body
  '#c2d4e8': ['#c0d0e8', '#d0c8b8', '#b0a890', '#8890a0', '#606878'], // PAL.W  cloud mid
  '#a6bad6': ['#a8b8d8', '#b0a898', '#908870', '#687080', '#485060'], // PAL.v  cloud low
  // --- Aeronaut Wren. Listed so the hero is authored through the fall rather
  //     than falling out of the fallback curve: the coat holds its chroma
  //     (sat 0.82 -> 0.75) while the ground loses two thirds of its, which is
  //     what keeps him readable on stage-4 terrain.
  '#231327': ['#201028', '#381820', '#281820', '#281030', '#201030'], // WREN.o  outline
  '#78ecc0': ['#78f0c0', '#98e8a8', '#80d890', '#70c8b0', '#60a0a0'], // WREN.T  coat light
  '#1db387': ['#20b088', '#30b078', '#28a068', '#209078', '#207878'], // WREN.t  coat mid
  '#0c6350': ['#086050', '#186848', '#185840', '#104850', '#104050'], // WREN.e  coat dark
  '#f6d44e': ['#f8d050', '#f8d048', '#e8c040', '#c8b050', '#a89050'], // WREN.B  brass light
  '#c98a24': ['#c88828', '#d88820', '#c07820', '#b06830', '#905830'], // WREN.b  brass mid
  '#7a4f16': ['#785018', '#985010', '#804818', '#703820', '#603028'], // WREN.d  leather dark
  '#f6c992': ['#f8c890', '#f8c880', '#e8b070', '#c8a088', '#a88880'], // WREN.S  skin
  '#c07848': ['#c07848', '#d07840', '#c06838', '#a85848', '#885048'], // WREN.s  skin shade
  '#a03a2a': ['#a03828', '#b84028', '#a03820', '#902830', '#782830'], // WREN.C  cap light
  '#5f2019': ['#602018', '#782018', '#682018', '#581828', '#501828'], // WREN.c  cap dark
  '#e8923d': ['#e89040', '#f09038', '#e08030', '#c07040', '#a06040'], // WREN.H  hair
  '#8a4526': ['#884828', '#a84820', '#904020', '#803030', '#683030'], // WREN.k  boot
  '#6fa2cc': ['#70a0d0', '#88a0b0', '#7890a0', '#6880b8', '#5868a8'], // WREN.g  trousers
  '#d9482b': ['#d84828', '#e84828', '#d04028', '#b83830', '#983030'], // WREN.R  scarf red
};

// ---------------------------------------------------------------------------
// Fallback tone curve for colours the strip does not name. Per channel, a
// quadratic through (0 -> black, 0.5 -> mid, 1 -> white); each stage's mid was
// solved so the curve reproduces that stage's lawn-base entry exactly, which
// makes it agree with the strip everywhere in the midtones. The black point
// stays at 0 on every stage: black has to survive as #000000 so that a tinted
// black and the untinted HUD's black are the same palette entry, not two.
// ---------------------------------------------------------------------------
const GRADES = [
  { black: [0, 0, 0], mid: [127.5, 127.5, 127.5], white: [255, 255, 255] }, // clear
  { black: [0, 0, 0], mid: [159.4, 127.8, 111.7], white: [255, 248, 216] }, // tilting
  { black: [0, 0, 0], mid: [135.6, 112.2,  99.4], white: [240, 232, 200] }, // deepening
  { black: [0, 0, 0], mid: [119.7,  96.8, 124.0], white: [208, 216, 232] }, // deck-rising
  { black: [0, 0, 0], mid: [102.4,  82.0, 120.4], white: [168, 180, 208] }, // inside-the-deck
];

// How far an INTERIOR travels toward the outdoor column. The Boilerworks has
// its own light; the fall cools it, it does not black it out.
const INDOOR = [0, 0.25, 0.40, 0.52, 0.60];

// ---------------------------------------------------------------------------
// Stage descriptors — name, the sky/cloud ramp pulled out of the strip for
// scenes that need the colours directly (fillSky, backdrops), and the wind.
// ---------------------------------------------------------------------------
const RAMP_KEYS = {
  sky: '#68a4e0', skyHi: '#8ec4ee', skyLo: '#4e86c6',
  cloudHi: '#ffffff', cloud: '#f4f6f8', cloudMid: '#c2d4e8', cloudLo: '#a6bad6',
};
export const SKY_BASE = { ...RAMP_KEYS };

export const STAGE_NAMES = ['clear', 'tilting', 'deepening', 'deck-rising', 'inside-the-deck'];
export const STAGE_COUNT = STAGE_NAMES.length;

/** The five stages as objects, for anything that wants to read the table. */
export const STAGES = STAGE_NAMES.map((name, i) => {
  const s = { name, index: i, indoor: INDOOR[i] };
  for (const [k, base] of Object.entries(RAMP_KEYS)) s[k] = PALETTES[base][i];
  s.grass = PALETTES['#408848'][i];
  return s;
});

// --------------------------------------------------------------------- util --

const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const q5 = (v) => Math.max(0, Math.min(248, Math.round(v / 8) * 8)); // SNES 5bpc
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(v => q5(v).toString(16).padStart(2, '0')).join('');
const lerp = (a, b, t) => a + (b - a) * t;
const pack = (r, g, b) => (r << 16) | (g << 8) | b;

// Pre-pack the strip once: base packed rgb -> five packed rgb columns.
const STRIP = new Map();
for (const [base, cols] of Object.entries(PALETTES)) {
  STRIP.set(pack(...hexToRgb(base)), cols.map(c => hexToRgb(c)));
}

/** The colour table in force at a (fractional) stage. */
function stageAt(v) {
  const c = Math.max(0, Math.min(STAGE_COUNT - 1, v));
  const i = Math.floor(c), j = Math.min(STAGE_COUNT - 1, i + 1), t = c - i;
  const out = { name: STAGE_NAMES[t < 0.5 ? i : j], index: c, i, j, t };
  for (const [k, base] of Object.entries(RAMP_KEYS)) {
    const a = hexToRgb(PALETTES[base][i]), b = hexToRgb(PALETTES[base][j]);
    out[k] = rgbToHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  const A = GRADES[i], B = GRADES[j];
  out.grade = {
    black: A.black.map((v2, n) => lerp(v2, B.black[n], t)),
    mid: A.mid.map((v2, n) => lerp(v2, B.mid[n], t)),
    white: A.white.map((v2, n) => lerp(v2, B.white[n], t)),
  };
  out.indoor = lerp(INDOOR[i], INDOOR[j], t);
  return out;
}

// Quadratic through (0,black) (0.5,mid) (1,white), evaluated at t in 0..1.
const tone = (b, m, w, t) => b * (2 * t - 1) * (t - 1) + m * 4 * t * (1 - t) + w * t * (2 * t - 1);

// ---------------------------------------------------------------------------
// SkyState
// ---------------------------------------------------------------------------
export class SkyState {
  constructor(stage = 0) {
    this.value = stage;       // current (fractional) stage
    this.target = stage;      // where we are heading
    this.rate = 0;            // stages per frame
    this._luts = new Map();   // key -> Object(packedRGB -> packedRGB)
    this._tints = new Map();  // source canvas -> {key, out}
    this._drift = [0, 0, 0, 0];
    // Per-band base wind, px/frame at stage 0. Nearer bands run faster.
    this.bandSpeed = [0.20, 0.13, 0.085, 0.055];
  }

  // --------------------------------------------------------------- staging --

  /** Snap to a stage with no interpolation. */
  jumpTo(n) {
    this.value = this.target = Math.max(0, Math.min(STAGE_COUNT - 1, n));
    this.rate = 0;
  }

  /** Glide to a stage over `frames` engine frames (default ~2s). */
  setStage(n, { frames = 120 } = {}) {
    this.target = Math.max(0, Math.min(STAGE_COUNT - 1, n));
    const d = Math.abs(this.target - this.value);
    this.rate = frames > 0 && d > 0 ? d / frames : Infinity;
  }

  /** Next stage on a story beat. Returns the new target. */
  advance(opts) {
    this.setStage(Math.floor(this.value + 1.0001), opts);
    return this.target;
  }

  get stage() { return this.value; }
  /** Name of the stage currently in force (see STAGE_NAMES). */
  get stageName() { return this.colors().name; }
  get settled() { return this.value === this.target; }
  /** 0 at the top of the chapter, 1 when the isle is in the cloud deck. */
  get fall() { return this.value / (STAGE_COUNT - 1); }
  /** Wind multiplier — clouds race past as the isle drops. */
  get windScale() { return 1 + 2.2 * this.fall; }

  update() {
    if (this.value !== this.target) {
      const d = this.target - this.value;
      const step = Math.min(Math.abs(d), this.rate);
      this.value += Math.sign(d) * step;
      if (Math.abs(this.target - this.value) < 1e-4) this.value = this.target;
    }
    const w = this.windScale;
    for (let i = 0; i < this._drift.length; i++) this._drift[i] += this.bandSpeed[i] * w;
  }

  /** Horizontal scroll offset (px, growing) for cloud band 0..3. */
  drift(band = 0) { return this._drift[band % this._drift.length]; }

  // --------------------------------------------------------------- colours --

  /** Interpolated colour table for the current stage. */
  colors() {
    const b = this._bucket();
    if (!this._colorCache || this._colorBucket !== b) {
      this._colorBucket = b;
      this._colorCache = stageAt(b / 8);
    }
    return this._colorCache;
  }

  /** Shift one arbitrary colour into this stage (sprites, particles, rects). */
  shade(hex, indoor = false) {
    const [r, g, b] = hexToRgb(hex);
    const p = this._mapPacked(pack(r, g, b), indoor);
    return rgbToHex((p >> 16) & 255, (p >> 8) & 255, p & 255);
  }

  /** A whole authored palette ({char: '#rrggbb'}) remapped for this stage. */
  paletteFor(pal, indoor = false) {
    const out = {};
    for (const [k, v] of Object.entries(pal)) out[k] = this.shade(v, indoor);
    return out;
  }

  /** Map one hex through the stage. */
  mapHex(hex, indoor = false) { return this.shade(hex, indoor); }

  // Stage quantised to 1/8 of a stage: 33 possible palettes across the
  // chapter, finer than the eye can follow and it keeps the caches tiny.
  _bucket() { return Math.round(this.value * 8); }

  _lut(indoor) {
    const b = this._bucket();
    const key = b * 2 + (indoor ? 1 : 0);
    let lut = this._luts.get(key);
    if (!lut) {
      lut = Object.create(null);
      const c = stageAt(b / 8);
      const mix = indoor ? c.indoor : 1;
      for (const [src, cols] of STRIP) {
        const A = cols[c.i], B = cols[c.j];
        const sr = (src >> 16) & 255, sg = (src >> 8) & 255, sb = src & 255;
        const dr = lerp(A[0], B[0], c.t), dg = lerp(A[1], B[1], c.t), db = lerp(A[2], B[2], c.t);
        lut[src] = pack(q5(lerp(sr, dr, mix)), q5(lerp(sg, dg, mix)), q5(lerp(sb, db, mix)));
      }
      lut.__c = c;
      lut.__mix = mix;
      this._luts.set(key, lut);
      if (this._luts.size > 48) {                 // never unbounded
        const first = this._luts.keys().next().value;
        if (first !== key) this._luts.delete(first);
      }
    }
    return lut;
  }

  _mapPacked(key, indoor) {
    const lut = this._lut(indoor);
    let v = lut[key];
    if (v !== undefined) return v;
    const { grade } = lut.__c;
    const mix = lut.__mix;
    const r = (key >> 16) & 255, g = (key >> 8) & 255, b = key & 255;
    // Unlisted colour: the stage's tone curve. A curve rather than a multiply
    // because a linear x0.6 halves every DIFFERENCE too, so the 8-16 value
    // gaps that carry ALttP's tile texture collapse onto one 5-bit step and
    // the ground measures flat once it gets dark. This curve keeps its slope
    // near 1 through the midtones, so texture survives the whole fall.
    const ch = (i, v2) => lerp(v2, tone(grade.black[i], grade.mid[i], grade.white[i], v2 / 255), mix);
    v = pack(q5(ch(0, r)), q5(ch(1, g)), q5(ch(2, b)));
    lut[key] = v;
    return v;
  }

  _remap(imgData, indoor) {
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const v = this._mapPacked(pack(d[i], d[i + 1], d[i + 2]), indoor);
      d[i] = (v >> 16) & 255; d[i + 1] = (v >> 8) & 255; d[i + 2] = v & 255;
    }
  }

  /**
   * Recolour a baked layer for the current stage. Result is cached per source
   * canvas and only rebuilt when the stage bucket changes, so calling this
   * every frame costs one drawImage.
   *
   * @param {boolean} indoor  interior art — takes the stage at reduced
   *        strength (see INDOOR), so the Boilerworks cools without going black.
   */
  tint(src, indoor = false) {
    const key = this._bucket() * 2 + (indoor ? 1 : 0);
    let ent = this._tints.get(src);
    if (ent && ent.key === key) return ent.out;
    if (!ent) {
      const cv = document.createElement('canvas');
      cv.width = src.width; cv.height = src.height;
      ent = { key: -1, out: cv, ctx: cv.getContext('2d') };
      this._tints.set(src, ent);
    }
    ent.ctx.clearRect(0, 0, src.width, src.height);
    ent.ctx.drawImage(src, 0, 0);
    const img = ent.ctx.getImageData(0, 0, src.width, src.height);
    this._remap(img, indoor);
    ent.ctx.putImageData(img, 0, 0);
    ent.key = key;
    return ent.out;
  }

  /**
   * Recolour a TRANSIENT canvas (e.g. an actor composited fresh each frame).
   * No caching — pass small canvases only. Returns a shared scratch canvas,
   * so blit the result before calling again.
   */
  tintFrame(src, indoor = false) {
    if (!this._scratch) this._scratch = document.createElement('canvas');
    const cv = this._scratch;
    if (cv.width !== src.width || cv.height !== src.height) {
      cv.width = src.width; cv.height = src.height;
    }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(src, 0, 0);
    const img = c.getImageData(0, 0, cv.width, cv.height);
    this._remap(img, indoor);
    c.putImageData(img, 0, 0);
    return cv;
  }

  /** Forget cached recolours of a layer the scene has re-baked. */
  invalidate(src) { if (src) this._tints.delete(src); else this._tints.clear(); }

  /**
   * Convenience: flat sky fill for scenes that paint sky with fillRect
   * rather than tiles.
   */
  fillSky(ctx, x, y, w, h) {
    ctx.fillStyle = this.colors().sky;
    ctx.fillRect(x, y, w, h);
  }
}
