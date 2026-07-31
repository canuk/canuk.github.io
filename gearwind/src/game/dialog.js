// Gearwind conversation layer — ALttP message-window grammar.
//
// ONE WINDOW, AND IT IS THIS ONE. Chapter 1 used to open two: this window for
// conversation and a second, wider, square-cornered, ALL-CAPS monospace box in
// game/transition.js for the item-get — and the player met both 1.8 seconds
// apart, when Marla finishes "It's a tool that argues." and the Cogblade is
// announced. Exporting the pieces was not enough (round 8 did that and the
// seam still shipped), so this module now INSTALLS itself into transition.js:
// see adoptMessageWindow() near the bottom. Every announcement in the chapter —
// cuff, map, compass, keys, heart pieces, cogs, the Cogblade — is drawn by
// drawMessage() at this geometry in this face.
//
// GEOMETRY. A 168x47 window (see BOX), sized to the copy that actually ships.
// Measured over every distinct row the chapter can print — villagers, signs,
// shop, the Boilerworks plaques and the card, 77 rows — the mean is 94.9px
// (65.9% of the measure) and the longest is 144px with zero overflows, so a
// 144px measure is a real measure and not a letterbox. Bottom-anchored at
// y=166 with 16px of playfield under it; it FLIPS to y=64 — BELOW the HUD
// strip, which is 60px deep and painted before the box — when Wren is standing
// low enough that the bottom window would bury him. Short pages are VERTICALLY
// CENTRED in the interior, so a two-word answer sits in the middle of the
// window instead of hanging off its ceiling. The frame is 4px: 1px near-black
// keyline, 2px white, 1px slate bevel, then pure black. The window WIPES open
// vertically over five frames and wipes shut again.
//
// FONT: authored here and VARIABLE WIDTH, which is the single most recognisable
// property of the ALttP dialogue face. Cap height is 7 rows, x-height is 5, so
// capitals stand two full pixels over lowercase and you can read the shape of a
// word without reading the letters. It is CONDENSED — 5-wide capitals over
// 4-wide lowercase bowls — because a 5-wide bowl on a 7-row cap is the modern
// geometric proportion, not the 1992 one. Glyph ink widths run 1px ('i', 'l')
// to 6px ('W'); advance is ink + 1, word space is 3. No drop shadow: white ink
// on a pure black well needs none, and ALttP doesn't use one either.
//
// TYPEWRITER: 45 characters/second. A soft blip fires every third revealed
// non-space character. A dumps the rest of the page; A on a finished page turns
// it. A blinking arrow sits bottom-right while more is coming.
//
// CHOICES: yes/no prompts and the shop menu share one vertical cursor list. If
// the prompt and the choices fit in three rows together the choices sit under
// the last line of prose; if they don't (the shop's three rows) the menu gets
// its own page. Up/down moves a brass arrowhead, A picks, B jumps to the exit
// row of a shop.
//
// The box owns a queue, so callbacks can push more conversation:
//   box.say(['line one', 'second page']);
//   box.ask('Buy it?', ['Yes', 'No'], i => { ... });
//   box.shop('What will it be?', items, { wallet, onExit });
import { makeSprite } from '../sprites.js';
// The item-get announcement lives in game/transition.js, which this module does
// not own. It is the same window, so this module INSTALLS itself into it — see
// the "ONE MESSAGE WINDOW" block at the bottom of the file. The edge is one
// way: transition.js imports engine/hud/sprites/player only, never dialog.js,
// so there is no cycle to resolve.
import { Transitions } from './transition.js';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
// The window is sized to the COPY, not to the screen. Measured through the
// real font metrics over every distinct row the chapter prints (77 of them,
// villagers + signs + shop + plaques + card): mean 94.9px, longest 144px, no
// overflows. A 184px measure left the box 34% full, i.e. a black slab with a
// subtitle in it; 144px of measure puts the mean line at 65.9% of the well.
// HEIGHT is set by the AIR, not by the text. Three rows on an 11px step with a
// 7-row cap and a 2-row descender occupy 31 rows. The 4px frame leaves the
// interior at rows 4..h-5, so h=42 left 34 interior rows: 2 blank above the
// caps and 1 under the descenders, i.e. a comma sitting on the bevel.
// h=47 gives 39 interior rows (4..42) and TOP_PAD=8 spends them 4 ABOVE / 2
// BELOW on the worst case: caps start on row 8 — 4 blank rows above — and the
// deepest descender of a full three-row page lands on row 40, leaving 2 blank
// under it. A last line with no descender (the common case) leaves 4. NOT
// symmetric, and the comment used to claim 4/4; the measured numbers are 4/2
// and 4/4, off a live capture (shots/npcd9-*/, re-measured round 10). The old
// h=42 was 2/1 — a comma sitting on the bevel — which is what this fixed.
export const BOX = { x: 44, y: 166, w: 168, h: 47 };
// TOP is BELOW the HUD, not over it. hud.js paints down to HUD_H = 60 (meter
// 20,18 + 42 tall) and every scene draws the HUD *before* the box, so a box at
// y=16 erases the life meter, the item slot, the counters and the hearts.
// ALttP could flip to the top because its HUD was a strip above the playfield;
// ours is an overlay, so the flipped window starts at 64.
const ANCHOR_Y = { bottom: 166, top: 64 };

const PAD_L = 8;                  // interior left inset for text
const PAD_R = 16;                 // right inset — leaves the arrow its corner
export const TEXT_X = BOX.x + PAD_L;
export const MAX_TEXT_W = BOX.w - PAD_L - PAD_R;   // 144px
const LINE_STEP = 11;             // 7px cap height wants an 11px step, not 13
const LINES = 3;                  // text rows per page
const TOP_PAD = 8;                // first row top, relative to BOX.y (4px of air)
const CHARS_PER_FRAME = 0.75;     // 45 chars/sec at 60Hz
const OPEN_FRAMES = 5;

const INK = '#f8f8f8';
const DIM = '#a0a8b8';

// ---------------------------------------------------------------------------
// Variable-width pixel font.
//
// Nine rows per cell. Capitals and ascenders own rows 0-6 (cap height 7);
// lowercase x-height is rows 2-6 (five rows); descenders reach rows 7-8. Each
// glyph is authored at its true ink width — that is what stops words looking
// laser-cut into a grid. Advance = ink width + 1; SPACE_W is the word gap.
// ---------------------------------------------------------------------------
const SPACE_W = 3;
const GAP = 1;

const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..##', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  // W is TWO V's sharing a middle apex, and EVERY STROKE IS 1px. The previous
  // W carried a 2px middle block — the only 2px stroke in an otherwise 1px
  // face — which is why it read as a bar floating between two stems. At an odd
  // ink width (7) the apex can be a true single-pixel point: it rises to row 2,
  // runs down the centre column, forks at row 5 and lands on two feet at row 6,
  // while the outer stems step inward onto the same two feet.
  W: ['#.....#', '#.....#', '#..#..#', '#..#..#', '#..#..#', '#.#.#.#', '.#...#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  // LOWERCASE is CONDENSED: the round bowls are 4 wide against 5-wide
  // capitals, which is what gives a 1992 face its narrow, upright colour.
  // A 5-wide bowl on a 7-row cap height is the modern geometric-humanist
  // proportion and reads instantly as a 2010s indie font.
  //
  // 'i' and 'j': STEM ON THE X-HEIGHT (rows 2-6), tittle on row 0 with row 1
  // left clear as the gap. The stem used to start on row 3, one pixel under
  // every other lowercase, so the i's visibly sagged below the m/n shoulders
  // in "mining" and "windmill". The three alternatives that keep the tittle
  // off the cap line were all rendered at 8x and all cost more than they save:
  // a MERGED dot (ink rows 1-6, contiguous) turns "windmill" into "windmlll"
  // and "Illinois" into "Illlnols" — i and l become the same stroke; a 2px
  // FLAG at row 1 reads as a digit ("w1ndm1ll"); a dot INSET one pixel to the
  // left reads as a grave accent ("wìndmìll"). With a clear row 1 between them
  // the dot is unmistakably a tittle, and 'i' is never confusable with 'I',
  // which is 3px wide with two serif bars. 'l' stays a bare stem: a foot serif
  // in a sans face makes "windmill" close up into "windmiu".
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '###.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  j: ['...#', '....', '...#', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#', '#', '#', '#', '#', '#', '#'],
  m: ['.....', '.....', '##.##', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['...', '...', '#.#', '##.', '#..', '#..', '#..'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#..', '.#..', '####', '.#..', '.#..', '.#..', '..##'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '###.'],
  z: ['....', '....', '####', '...#', '.##.', '#...', '####'],

  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],

  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '.', '.', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  "'": ['#', '#'],
  '"': ['#.#', '#.#'],
  '-': ['....', '....', '....', '....', '####'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  ':': ['.', '.', '.', '#', '.', '.', '#'],
  ';': ['..', '..', '..', '.#', '..', '..', '.#', '#.'],
  '(': ['..#', '.#.', '#..', '#..', '#..', '.#.', '..#'],
  ')': ['#..', '.#.', '..#', '..#', '..#', '.#.', '#..'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '&': ['.##..', '#..#.', '#..#.', '.##..', '#..#.', '#...#', '.##.#'],
  '+': ['.....', '.....', '..#..', '..#..', '#####', '..#..', '..#..'],
  '=': ['.....', '.....', '.....', '#####', '.....', '#####'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#.##.', '..##.'],
  '*': ['#.#', '.#.', '###', '.#.', '#.#'],
  '—': ['......', '......', '......', '......', '######'],
};

const WIDTH = {};
for (const [ch, rows] of Object.entries(FONT)) {
  WIDTH[ch] = Math.max(...rows.map(r => r.length));
}

/** Pixel advance of one character (ink + gap). */
function advanceOf(ch) {
  if (ch === ' ') return SPACE_W;
  const w = WIDTH[ch];
  return w == null ? SPACE_W : w + GAP;
}

/** Pixel width of a string as it will be drawn (no trailing gap). */
export function dialogTextWidth(text) {
  let w = 0;
  for (const ch of String(text)) w += advanceOf(ch);
  return Math.max(0, w - GAP);
}

// ---------------------------------------------------------------------------
// THE `128 - n * 3.5` REPAIR.
//
// `128 - text.length * 3.5` is a FIXED-ADVANCE centring formula: it assumes
// every glyph is 7px wide. This face is VARIABLE width (1px 'i', 7px 'W'), so
// the formula is wrong for every string it is used on, and it was used on the
// dungeon map subscreen (game/items.js) for all four of its labels:
//
//   "THE BOILERWORKS"      86px, drawn at 75.5, measured centre 85    -> 9.5 left
//   "NO MAP OF THIS PLACE"105px, drawn at 58,   measured centre 75.5  -> 17.5 left
//   "YOU ARE HERE"         65px, drawn at 86,   measured centre 95.5  -> 9.5 left
//   "START TO CLOSE"       77px, drawn at 79,   measured centre 89.5  -> 10.5 left
//
// — in a panel that is symmetric about x=128, next to a room cell that IS
// centred on 128, under the same START button as gameflow.js's overworld
// subscreen, whose identical "START TO CLOSE" footer is centred by measurement.
// It reads at 1x as a fat right gutter.
//
// WHY THIS IS A FILTER ON THE DRAW AND NOT A WRAPPER ON THE SUBSCREEN: it was a
// wrapper on DungeonMapUI.prototype.draw for one round, and it worked in
// ?scene=dungeon and did nothing in the composed chapter, because
// scenes/game.js does `const mapDraw = this.dg.mapUI.draw.bind(...)` in its
// init and paints its own frame over the panel. Whether that bind happens
// before or after a deferred adoption is a module-loading race, and the player
// only ever sees the composed chapter. A static import of items.js from here to
// win the race is not available: items.js imports this module, and a cycle
// evaluated from the items side throws a TDZ ReferenceError before a frame is
// drawn.
//
// SO THE TEST IS ON THE ARGUMENTS, and it is narrow enough to enumerate. A
// string is re-centred only when it (a) contains NO lowercase, (b) contains a
// space, and (c) arrives at EXACTLY the x the broken formula produces for its
// own length. Every other drawDialogText call in the build was checked against
// all three: gameflow.js's kit panel draws 'COGBLADE' at 56 (formula: 100),
// 'COGS' at 144 (114), 'NEXT' at 32 (114), '- - -' at 56 (110.5); items.js
// draws its key counter as 'x2', which has lowercase. Nothing else can match.
// And a call site that already centres BY MEASUREMENT is a no-op here even if
// it does match, because the value this returns IS the measured centre.
//
// It is written to be deleted: when items.js adds drawDialogTextCentered to the
// import it already has and passes 128, the detector stops matching, the pixels
// are identical, and this function can go.
// ---------------------------------------------------------------------------
function repairFixedAdvance(text, x) {
  const s = String(text);
  if (s.length < 3 || s.indexOf(' ') < 0 || /[a-z]/.test(s)) return x;
  if (Math.abs(x - (128 - s.length * 3.5)) > 0.01) return x;
  return 128 - dialogTextWidth(s) / 2;
}

const fontCache = new Map();  // color -> {char: canvas}
function fontFor(color) {
  let set = fontCache.get(color);
  if (!set) {
    set = {};
    for (const [ch, rows] of Object.entries(FONT)) set[ch] = makeSprite(rows, { '#': color });
    fontCache.set(color, set);
  }
  return set;
}

/**
 * Draw a run of dialogue text with its top-left at (x, y).
 * `shadow` is off by default: white ink on the window's pure-black well needs
 * none. Pass a colour when drawing over artwork instead of the well.
 */
export function drawDialogText(ctx, text, x, y, color = INK, shadow = null) {
  x = Math.round(repairFixedAdvance(text, x)); y = Math.round(y);
  const ink = fontFor(color);
  const sh = shadow ? fontFor(shadow) : null;
  let cx = x;
  for (const ch of String(text)) {
    const glyph = ink[ch];
    if (glyph) {
      if (sh) ctx.drawImage(sh[ch], cx + 1, y + 1);
      ctx.drawImage(glyph, cx, y);
    }
    cx += advanceOf(ch);
  }
  return cx - x - GAP;
}

/** Centre a run of text on `cx`. */
export function drawDialogTextCentered(ctx, text, cx, y, color = INK, shadow = null) {
  return drawDialogText(ctx, text, Math.round(cx - dialogTextWidth(text) / 2), y, color, shadow);
}

// ---------------------------------------------------------------------------
// Word wrap. Measured in PIXELS, because the font is variable width.
// '\n' forces a line break. Each element of a say() array is its own page group
// so authored copy controls where a page turn lands.
// ---------------------------------------------------------------------------
/**
 * TYPOGRAPHY THE COPY DOESN'T HAVE TO KNOW ABOUT.
 *
 * A parenthetical dash in this chapter is authored as a spaced hyphen-minus —
 * "The isle shudders - and stops falling.", "CHAPTER 2 - THE UPPER REACHES" —
 * because that is what a keyboard gives you. The font table has carried a real
 * em dash since it was written and nothing in the chapter ever reached it, so
 * every dash on screen was the same 4px stroke as the hyphen in a compound
 * word. Promoting it HERE rather than in the copy means the authors of the
 * dozen files that queue text never have to type an em dash, and a hyphenated
 * word ("gear-switch", "half-open") is untouched because it has no spaces
 * around it. Applied in wrapLines(), which every path into this window goes
 * through: say(), ask(), shop(), messageLines(), itemPage(), the cards.
 */
export function typeset(text) {
  return String(text).replace(/ +- +/g, ' — ');
}

export function wrapLines(text, maxW = MAX_TEXT_W) {
  const out = [];
  for (const para of typeset(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if (!line.length) { line = word; continue; }
      if (dialogTextWidth(line + ' ' + word) <= maxW) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/**
 * Pull one word down off the previous row when a paragraph ends on a single
 * orphan word. Greedy wrapping at a 144px measure leaves "Marla carried it on
 * her courier / runs." — a five-letter last row under a full one, which in a
 * three-row window reads as a mistake. Moving one word back gives "Marla
 * carried it on her / courier runs.", which is the break she was written with.
 *
 * It works PER PARAGRAPH, and that is the whole reason it is safe to run on
 * conversation. An authored '\n' ends a paragraph, so Marla's "Liftstone's
 * gone. / Cut out clean. / We're falling." is three one-line paragraphs and
 * nothing here can touch it — the staccato survives. Only a paragraph the
 * WRAPPER broke gets rebalanced.
 */
export function unwidow(lines) {
  if (lines.length < 2) return lines;
  const last = lines[lines.length - 1];
  if (last.indexOf(' ') >= 0) return lines;              // already 2+ words
  const prev = lines[lines.length - 2];
  const cut = prev.lastIndexOf(' ');
  if (cut < 0) return lines;
  const moved = prev.slice(cut + 1) + ' ' + last;
  if (dialogTextWidth(moved) > MAX_TEXT_W) return lines;
  return [...lines.slice(0, -2), prev.slice(0, cut), moved];
}

/**
 * ONE TYPESETTER, AND IT KNOWS WHERE THE SENTENCES ARE.
 *
 * Everything that reaches this window comes through here — say(), ask(),
 * shop(), messageLines(), itemPage(), the cards — so it is also where unwidow()
 * reaches conversation. Before it did, every narration page shipped its widows:
 * "...cloud deck for two hundred / years." (25px under 117px), "Wren jams the
 * shard into the / cradle." (27px under 128px), "Every isle in the sky rides a
 * / liftstone." (40px under 120px).
 *
 * A line of authored copy is not a paragraph — it is a ROW the author picked,
 * and rows only survive if they still fit the measure they are drawn at. The
 * Boilerworks plaques were authored for the old 208px item box at "no line over
 * 28 characters", so at 144px all three of B2's rows measured 149-153 and every
 * one of them wrapped: what the player read was "THE KEEPER CARRIES" [A] "THE
 * OTHER / ONE, AND THE KEEPER / IS ABOVE." — the verb severed from its object
 * by a page turn, on a stamped brass plaque.
 *
 * So copy is grouped into CLAUSE BLOCKS: consecutive authored rows up to and
 * including one that ends a sentence. A block is the unit of pagination — it is
 * never split across a page turn if it fits on a page by itself — and inside a
 * block:
 *
 *   * if EVERY authored row still fits the measure, the author's rows are kept
 *     verbatim. "COGWICK HOLLOW / Keep off the windmill vane. / It bites.",
 *     Marla's "Liftstone's gone. / Cut out clean. / We're falling." and Tam's
 *     "Like someone took the heavy / part off it. That is the only / way I can
 *     say it." come out of here byte-identical, because nothing in them is
 *     broken.
 *   * if ANY row OVERFLOWS the measure, that row was already going to wrap, so
 *     the whole block is re-flowed as one paragraph at 144px and unwidowed.
 *     An authored break that the wrapper is about to break again is not a
 *     typesetting decision, it is a leftover from a different box.
 *
 * The two rules together are strictly conservative: output changes only where
 * the old code was already producing a wrap or a mid-clause page break.
 */
const CLAUSE_END = /[.!?:;]["'’”)\]]?$/;

export function clauseBlocks(text) {
  const segs = typeset(text).split('\n').map(s => s.trim()).filter(s => s.length);
  const groups = [];
  let cur = [];
  for (const s of segs) {
    cur.push(s);
    if (CLAUSE_END.test(s)) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups.map((rows) => {
    if (rows.some(s => dialogTextWidth(typeset(s)) > MAX_TEXT_W)) {
      return unwidow(wrapLines(rows.join(' ')));
    }
    const out = [];
    for (const s of rows) for (const l of wrapLines(s)) out.push(l);
    return out;
  });
}

export function wrapCopy(text) {
  const lines = [];
  for (const block of clauseBlocks(text)) for (const l of block) lines.push(l);
  return lines;
}

/**
 * Pages, broken at CLAUSE boundaries wherever the copy allows one.
 * A block that would straddle a page turn is pushed whole onto the next page,
 * so the player never presses A in the middle of a sentence for want of one
 * row. Only a block too long for a page at all is split, and then it is split
 * at its own wrap points.
 */
export function paginate(text, linesPerPage = LINES) {
  const pages = [];
  let page = [];
  for (const block of clauseBlocks(text)) {
    if (page.length && page.length + block.length > linesPerPage &&
        block.length <= linesPerPage) {
      pages.push(page);
      page = [];
    }
    for (const row of block) {
      if (page.length >= linesPerPage) { pages.push(page); page = []; }
      page.push(row);
    }
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [['']];
}

// ---------------------------------------------------------------------------
// Panel frame. Rounded-rect layers painted pixel by pixel so the corners are
// honest SNES staircases, not canvas arcs.
// ---------------------------------------------------------------------------
// Keyline reuses the world's single dark outline colour rather than minting
// a near-identical one just for the window.
const LAYERS = ['#1e1a22', '#f8f8f8', '#f8f8f8', '#6878a0'];
const FILL = '#000000';
const RADIUS = 3;

function inRounded(x, y, w, h, r) {
  const dx = Math.max(r - x, x - (w - 1 - r), 0);
  const dy = Math.max(r - y, y - (h - 1 - r), 0);
  return dx * dx + dy * dy <= r * r;
}

function buildPanel(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let color = null;
      for (let L = 0; L < LAYERS.length; L++) {
        const r = Math.max(RADIUS - L, 1);
        if (!inRounded(x - L, y - L, w - 2 * L, h - 2 * L, r)) break;
        color = LAYERS[L];
      }
      const n = LAYERS.length;
      if (color === LAYERS[n - 1] &&
          inRounded(x - n, y - n, w - 2 * n, h - 2 * n, Math.max(RADIUS - n, 1))) {
        color = FILL;
      }
      if (color) { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return cv;
}

// Blinking page-advance arrow: solid white triangle with a dark underline.
const ARROW = makeSprite([
  'kkkkkkkkk',
  'kWWWWWWWk',
  '.kWWWWWk.',
  '..kWWWk..',
  '...kWk...',
  '....k....',
], { W: '#f8f8f8', k: '#1e1a22' });

// Brass arrowhead cursor for choice lists. It borrows the world's brass ramp
// rather than minting its own, so opening a menu doesn't cost the screen three
// extra colours out of a 4bpp budget.
const CURSOR = makeSprite([
  'kk....',
  'kBk...',
  'kBAk..',
  'kBAAk.',
  'kBAk..',
  'kBk...',
  'kk....',
], { k: '#6e5218', B: '#a8802a', A: '#f4e4a8' });

// Cogs are the currency: an 8x8 brass gear — four corner teeth with the
// background showing through the notches at each edge midpoint, a 2x2 dark hub
// and a white crescent on the upper-left rim. Same construction as the HUD
// counter icon so the two never read as different objects.
const COG = makeSprite([
  '.kk..kk.',
  'kkWWbbkk',
  'kWWbbbbk',
  '.Wbkkbb.',
  '.bbkkbm.',
  'kbbbbmmk',
  'kkbmmmkk',
  '.kk..kk.',
], { k: '#000000', W: '#f8f8f8', b: '#e0b845', m: '#a8802a' });

// ---------------------------------------------------------------------------
// ONE MESSAGE WINDOW FOR THE WHOLE CHAPTER.
//
// A cartridge has exactly one message window. Chapter 1 was shipping two: this
// one, and a second 208x57 square-cornered box in game/transition.js that draws
// its copy with the fixed-advance ALL-CAPS HUD font. The player meets them back
// to back — Marla says "Take this. It's not a sword. / It's a tool that argues."
// and the very next beat announces the Cogblade in a different shape, a
// different bevel and a different typeface. That seam is this module's fault,
// because the frame builder and the text drawer were private.
//
// THEY ARE PUBLIC NOW, AND THIS MODULE NO LONGER WAITS TO BE ADOPTED. Round 8
// exported drawBox/drawMessage/messageLines and asked two other pieces to call
// them; nobody did, and the player saw exactly the same two windows a round
// later. So the adoption happens here, at the bottom of this file:
// `adoptMessageWindow()` overwrites Transitions.prototype._drawTextBox with a
// call into drawMessage(). One module now decides what a message window looks
// like, and it cannot be forgotten by a file that never imports it.
//
// That is a SHIM, and it is written to be deleted. The permanent version is
// three edits in two files this module does not own; when they land, delete
// adoptMessageWindow() and its `import { Transitions }` and nothing else
// changes on screen. Written out exactly, so nobody has to guess:
//
// 1. game/transition.js — delete its local `drawBox()` (line ~261), its local
//    `const BOX = {x:24,y:148,w:208,h:57,top:10,step:14}` (line ~278), its
//    `import { drawText } from './hud.js'`, and the arrow it hand-draws in
//    _drawTextBox. Replace the whole method body with one call:
//
//      import { drawMessage } from './dialog.js';
//      ...
//      _drawTextBox(ctx, lines, t) { drawMessage(ctx, lines, t); }
//
//    drawMessage paints frame + up to three vertically centred rows + the
//    blinking advance arrow, all at MESSAGE_BOX's geometry. Pass t = -1 to
//    suppress the arrow on an auto-advancing box. If some other module still
//    imports transition.js's drawBox, re-export this one instead:
//      export { drawBox } from './dialog.js';
//    — it takes the same (ctx, x, y, w, h) arguments.
//
// 2. game/world/overworld.js — `itemText()` (line ~466) uppercases its copy and
//    strips every glyph the CAPS-only HUD font lacks. Replace its body with
//    `return messageLines(lines);`. This font has lowercase, an apostrophe, a
//    comma and a colon, so "Marla carried it on her courier runs." survives the
//    trip intact and the item-get stops shouting.
//    UNTIL THAT LANDS, the shim undoes what it can: itemPage() below detects
//    multi-line copy with no lowercase letter anywhere in it — which nothing in
//    this game authors, so it can only have come out of itemText() — and puts
//    the sentence case back, item names and people included. What it CANNOT put
//    back is what itemText deleted before this module ever saw the string: the
//    apostrophes, commas and exclamation marks its glyph filter drops, and any
//    fourth line past its three-line cut. Only edit 2 gets those back.
//
// 3. scenes/overworld.js — `giveCogblade()` can then queue its lines in the
//    same voice Marla just spoke in: ['The Cogblade.', 'Marla carried it on',
//    'her courier runs.'] — no manual uppercasing.
//
// GEOMETRY IS NOT NEGOTIABLE HERE: do not re-widen the window to 208 to make
// the item copy fit on fewer rows. 144px of measure is the number the whole
// chapter's copy was written and measured against; at a 184px measure the mean
// longest line drops to 59% of the box and the window reads as a letterbox
// again. Rewrap the item copy to three rows instead — messageLines() does it.
// ---------------------------------------------------------------------------

/** Geometry of the shared window. Same object as BOX — one window, one size. */
export const MESSAGE_BOX = BOX;

const panelCache = new Map();
function panelFor(w, h) {
  const key = w + 'x' + h;
  let p = panelCache.get(key);
  if (!p) { p = buildPanel(w, h); panelCache.set(key, p); }
  return p;
}

/**
 * Paint the window frame: 1px keyline / 2px white / 1px slate bevel / black
 * well, with r=3 staircase corners. Signature-compatible with the drawBox()
 * game/transition.js currently defines, so that one can be deleted outright.
 */
export function drawBox(ctx, x, y, w = BOX.w, h = BOX.h) {
  ctx.drawImage(panelFor(w, h), Math.round(x), Math.round(y));
}

/**
 * Wrap arbitrary copy to the window's real measure and cap it at a page.
 * Drop-in for world/overworld.js's itemText(), minus the mutilation: this font
 * has an apostrophe, a comma, a colon and lowercase, so "It's not a sword."
 * survives the trip.
 */
export function messageLines(text, maxRows = LINES) {
  const out = [];
  for (const chunk of [].concat(text)) {
    for (const line of wrapCopy(chunk)) if (line) out.push(line);
  }
  return out.slice(0, maxRows);
}

/**
 * Draw a complete, static message window — frame, up to three vertically
 * centred rows, and the blinking advance arrow. This is the whole of what the
 * item-get announcement needs, and it is pixel-identical to the conversation
 * window because it IS the conversation window.
 * @param lines  array of pre-wrapped strings (use messageLines()).
 * @param t      a frame counter; drives the arrow blink. Pass -1 for no arrow.
 * @param box    geometry; defaults to the one window.
 * @param align  'left' (prose, the default) or 'center' (a card).
 */
export function drawMessage(ctx, lines, t = 0, box = BOX, align = 'left') {
  drawBox(ctx, box.x, box.y, box.w, box.h);
  const rows = Math.min(LINES, lines.length);
  const off = Math.floor((LINES - rows) * LINE_STEP / 2);
  for (let i = 0; i < rows; i++) {
    const y = box.y + TOP_PAD + off + i * LINE_STEP;
    if (align === 'center') drawDialogTextCentered(ctx, lines[i], box.x + box.w / 2, y);
    else drawDialogText(ctx, lines[i], box.x + PAD_L, y);
  }
  if (t >= 0 && (t % 44) < 30) {
    ctx.drawImage(ARROW, box.x + box.w - 15, box.y + box.h - 11);
  }
}

/**
 * THE CARD. A chapter card, a GAME OVER, a "TO BE CONTINUED" — anything the
 * chapter says to the PLAYER rather than to Wren.
 *
 * It is the same window as everything else, because a cartridge has one
 * message window and a card is not an exception to that; only the setting of
 * the type changes — centred instead of ranged left, and no advance arrow,
 * because there is nothing after it to advance to. Whatever else the ending
 * needs, it does NOT need a second frame style at the same y anchor: the last
 * image of Chapter 1 arriving in a 208x48 square-cornered hairline box after
 * thirty minutes of a 168x47 rounded four-layer one reads as the same object
 * having changed shape.
 *
 * Copy is wrapped through the real metrics, so a caller passes a sentence and
 * never a hand-computed x. THE ONE THING NOT TO DO HERE is `128 - n * 3.5`:
 * that is a fixed-advance assumption in a variable-width face and it puts
 * "CHAPTER 2 — THE UPPER REACHES" 23px left of centre.
 *
 * @param lines  string, '\n'-separated string, or array of strings.
 * @param box    geometry; defaults to the one window (bottom anchor).
 */
export function drawCard(ctx, lines, box = BOX) {
  drawMessage(ctx, messageLines(lines), -1, box, 'center');
}

// ---------------------------------------------------------------------------
// THE SHIM. Everything below here exists to make the item-get announcement use
// the window above without an edit to game/transition.js. Delete it the day
// edits 1-3 land.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE HOUSE STYLE FOR AN ITEM ANNOUNCEMENT — one call, made here.
//
// It used to be made by a heuristic. restoreCase() only fired on copy that was
// entirely capitals AND arrived on two or more rows, which is a description of
// world/overworld.js's itemText() output and of nothing else, so the SAME ITEM
// shipped in two cases ten minutes apart: the overworld Piece of Heart read
// "A Piece of Heart. / 1 of four. Find the rest and / live longer." and the
// dungeon one — one row, so the guard excluded it — read "A PIECE OF HEART!".
// The rest of the kit split the same way: "The Cogblade." and "The Boiler Key."
// against "You got the BELLOWS CUFF!", "The BIG KEY!", "A MAP of the
// Boilerworks.", "The COMPASS.", "A SMALL KEY."
//
// THE CALL: sentence case with the item as a PROPER NOUN — "You got the Bellows
// Cuff!", "A Small Key.", "A Piece of Heart!" That is ALttP's own house style
// ("You got the Hookshot!"), it is the case the chapter's best-written item
// copy is already in, and it is the only setting this face has lowercase for.
// Shouting is reserved for the two things that are literally stamped in
// capitals in the world: a brass sign and a button name (START, A, B).
//
// It applies to ITEM ANNOUNCEMENTS ONLY — itemPage() is the sole caller. Signs,
// plaques and conversation are authored copy and are never re-cased.
// ---------------------------------------------------------------------------

// Names the chapter capitalises, spelled out rather than title-cased by rule,
// so "A Piece of Heart" keeps its lowercase "of". Longest first — "piece of
// heart" has to win before "heart" would.
const PROPER = [
  ['cogwick hollow', 'Cogwick Hollow'], ['piece of heart', 'Piece of Heart'],
  ['bellows cuff', 'Bellows Cuff'], ['second wind', 'Second Wind'],
  ['boiler key', 'Boiler Key'], ['boilerworks', 'Boilerworks'],
  ['small key', 'Small Key'], ['big key', 'Big Key'],
  ['kettleback', 'Kettleback'], ['skyharbor', 'Skyharbor'],
  ['cogblade', 'Cogblade'], ['compass', 'Compass'], ['map', 'Map'],
  ['hesper', 'Hesper'], ['marla', 'Marla'],
  ['wren', 'Wren'], ['pell', 'Pell'], ['tam', 'Tam'],
];

// Words that stay shouted because the player reads them off a controller.
const KEEP_CAPS = new Set(['START', 'SELECT', 'A', 'B', 'X', 'Y', 'L', 'R']);

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Put the house style on an item announcement, however it arrived.
 *
 * Any run of two or more capitals that is not a button name is lowered — which
 * covers a wholly shouted string from itemText() and a single shouted item name
 * inside otherwise sentence-case copy in exactly the same pass — then the item
 * names go back up as proper nouns and sentence starts are restored. Copy that
 * is already in house style ("The Cogblade.", "Gears spin. Steam dies.")
 * contains no such run and comes through untouched.
 */
function houseCase(s) {
  let out = String(s).replace(/\b[A-Z][A-Z'’-]+\b/g,
    w => (KEEP_CAPS.has(w) ? w : w.toLowerCase()));
  for (const [from, to] of PROPER) {
    out = out.replace(new RegExp('\\b' + esc(from) + '\\b', 'g'), to);
  }
  // Button prompts: "press b to shove" -> "press B to shove". A lone letter is
  // only a button when a verb asked you to press it, so the article "a" is safe.
  out = out.replace(/\b(press|hold|tap)\s+([abxylr])\b/g, (m, v, k) => `${v} ${k.toUpperCase()}`);
  out = out.replace(/\bstart\b/g, 'START');
  // First letter of the string and of every sentence after a . ! ? or :
  out = out.replace(/(^|[.!?:]\s+)([a-z])/g, (m, lead, c) => lead + c.toUpperCase());
  return out;
}

/**
 * Rebuild an item-get announcement into rows for THIS window.
 *
 * The copy arrives pre-broken for a 208px box that no longer exists — either
 * authored at "no line over 28 characters" (scenes/dungeon.js) or machine-cut
 * at 23 columns (itemText). Both are the wrong measure here, so the incoming
 * breaks are thrown away and the prose is re-wrapped at 144px. Sentence ends
 * are kept as page-level breaks, because that is where the author meant one:
 * "The Cogblade." stays on its own row above "Marla carried it on her /
 * courier runs.", which is the shape she was written in.
 */
export function itemPage(lines) {
  const paras = [];
  let cur = '';
  for (const raw of [].concat(lines)) {
    for (const part of String(raw).split('\n')) {
      const s = part.trim();
      if (!s) continue;
      cur = cur ? cur + ' ' + s : s;
      if (/[.!?]$/.test(s)) { paras.push(cur); cur = ''; }
    }
  }
  if (cur) paras.push(cur);
  const out = [];
  for (const p of paras) {
    for (const line of unwidow(wrapLines(houseCase(p)))) {
      if (line) out.push(line);
    }
  }
  return out.slice(0, LINES);
}

const itemPageCache = new Map();
function itemPageCached(lines) {
  const key = [].concat(lines).join('');
  let v = itemPageCache.get(key);
  if (!v) { v = itemPage(lines); itemPageCache.set(key, v); }
  return v;
}

/**
 * Install this window as the ONLY message window in the build.
 *
 * WHY A PROTOTYPE OVERWRITE AND NOT A POLITE EXPORT: the export was already
 * there for a whole round and the seam shipped anyway, because the call site is
 * in another piece's file and nothing forced the two to agree. A window is not
 * a per-file decision — it is a property of the cartridge — so this module owns
 * it outright. transition.js keeps every behaviour it had (when the box opens,
 * when it closes, what advances it); only the pixels come from here.
 *
 * The flip rule is the conversation window's rule, unchanged: the box moves
 * above the HUD when Wren is standing where the bottom window would bury him.
 * That matters more here than in conversation, because the item-get holds a
 * pose over Wren's head and the bottom window sits on it.
 *
 * REACH: this runs when dialog.js is loaded, and every path the player can walk
 * loads it — scenes/game.js, scenes/overworld.js and scenes/dungeon.js all
 * import from this module at the top of the file, before a frame is drawn. The
 * one surface it does NOT reach is scenes/transitions.js, that piece's isolated
 * demo scene, which imports transition.js and nothing else; it still shows the
 * old box. Edit 1 above is what fixes that, and it is not this module's to make.
 */
const FLIPPED = { ...BOX, y: ANCHOR_Y.top };
export function adoptMessageWindow(T = Transitions) {
  if (!T || !T.prototype) return false;
  T.prototype._drawTextBox = function _drawTextBox(ctx, lines, t) {
    const p = (this._fx && this._fx.player) || (this.box && this.box.player) || null;
    drawMessage(ctx, itemPageCached(lines), t,
      p && p.y + 28 > ANCHOR_Y.bottom ? FLIPPED : BOX);
  };
  return true;
}

adoptMessageWindow();

// ---------------------------------------------------------------------------
// THE CARDS — the second half of the same shim.
//
// The item-get seam closed the day adoptMessageWindow() shipped. The seam then
// MOVED: the last image of Chapter 1 was scenes/dungeon.js's _drawEndCard(), a
// 208x48 square-cornered box with a single 1px hairline, at the same y=166 the
// message window uses, in the same face, four pages after the player last read
// the real window. Same complaint, one scene later. Its GAME OVER card had the
// same problem in miniature and both of them hand-centred with `128 - n * 3.5`,
// a fixed-advance formula in a variable-width face: measured through the real
// metrics that is 12px left for "TO BE CONTINUED", 23px left for "CHAPTER 2 -
// THE UPPER REACHES" and 7px left for "GAME OVER".
//
// scenes/game.js — the composed chapter — already re-routes the chapter card
// through a DialogBox of its own (`this.dg._drawEndCard = ...` on the INSTANCE),
// so in the shipping chapter the FRAME is already this window; what was left
// was the setting, and say() ranges a title left like a line of Pell's. That
// is handled by copy, not by call site — see isChapterCard() — because the
// card has already moved from dungeon.js to game.js's drawChapterCard() to
// game.js's update() while this piece was being fixed, and a hook on a method
// name lost the race the first time that happened.
//
// adoptCards() covers what neither of those reaches: the standalone
// `?scene=dungeon` ending, and the dungeon's own GAME OVER, which no instance
// override touches and which a player who dies in the Boilerworks still sees.
//
// PERMANENT FIX, three lines in scenes/dungeon.js, after which delete this:
//   import { drawCard, drawDialogTextCentered } from '../game/dialog.js';
//   _drawEndCard(ctx) { if (this.ending < 40) return; drawCard(ctx, CHAPTER_CARD); }
//   ...and in _drawGameOver, replace `128 - 9 * 3.5` with
//   drawDialogTextCentered(ctx, 'GAME OVER', WIDTH / 2, 106).
// The same `128 - n * 3.5` bug was live in game/items.js at four call sites
// (the dungeon map subscreen), 9.5-17.5px left of centre; it is repaired inside
// drawDialogText — see repairFixedAdvance() at the top of the file — and the
// permanent fix there is one word on items.js's existing
// `import { drawDialogText } from './dialog.js'` line plus four call sites
// reading drawDialogTextCentered(ctx, text, 128, y).
// ---------------------------------------------------------------------------

/** The chapter's closing card. Authored here so the card and the window agree. */
export const CHAPTER_CARD = ['TO BE CONTINUED', 'CHAPTER 2', 'THE UPPER REACHES'];

const CARD_KEY = s => String([].concat(s).join(' ')).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const CHAPTER_CARD_KEY = CARD_KEY(CHAPTER_CARD);

/**
 * Is this copy the chapter card rather than a line of dialogue?
 *
 * KEYED TO THE WORDS, NOT TO THE CALL SITE, and that is deliberate. The card
 * has already moved twice: it was scenes/dungeon.js's own 208x48 box, then
 * scenes/game.js's `drawChapterCard()`, and it now goes up from that file's
 * `update()` so a batched capture cannot photograph it half-typed. Every
 * version queues the SAME THREE LINES into a DialogBox, so matching the copy
 * survives the next move; matching a method name did not survive the last one.
 * Punctuation and case are normalised away, so dungeon.js's two-line spelling
 * ("CHAPTER 2 - THE UPPER REACHES") is recognised too.
 *
 * Delete this the day the call site says `box.card(...)` instead of
 * `box.say(...)`; card() is the API, this is only the seatbelt.
 */
function isChapterCard(text) { return CARD_KEY(text) === CHAPTER_CARD_KEY; }

// ---------------------------------------------------------------------------
// ONE FORM OF ATTRIBUTION.
//
// The chapter is unattributed prose — you are looking at the person who is
// talking — except for the two cutscene lines spoken by someone off screen,
// and those settled on "Pell, from the quay:" / "Marla, from the hatch above:"
// with the speech on the row under it. One line never made the move and still
// says `Pell: "...That's not weather."` (scenes/overworld.js), which is a third
// form of the same idea in a chapter that has two.
//
// Normalised here rather than there for the usual reason: the copy is in a file
// this module does not own, and a form of address is a property of the chapter.
// Only the two speakers who HAVE a settled form are rewritten, and only when
// the rest of the line is a quotation. Delete when the call site is edited.
// ---------------------------------------------------------------------------
const SPEAKER_TAG = {
  Pell: 'Pell, from the quay:',
  Marla: 'Marla, from the hatch above:',
};
function attributed(text) {
  return String(text).replace(/^(Pell|Marla):[ \t]+(?=["'“])/,
    (m, who) => SPEAKER_TAG[who] + '\n');
}

/**
 * Install this window as the card frame too.
 * @param T a class (patches the prototype) or a live scene instance.
 */
export function adoptCards(T) {
  const target = T && T.prototype ? T.prototype : T;
  if (!target) return false;
  if (typeof target._drawEndCard === 'function') {
    target._drawEndCard = function _drawEndCard(ctx) {
      if (this.ending < 40) return;
      drawCard(ctx, CHAPTER_CARD);
    };
  }
  if (typeof target._drawGameOver === 'function') {
    // Same set piece as before — the frame still closes in from the top and the
    // bottom over the same 24 frames — with the word centred by measurement.
    target._drawGameOver = function _drawGameOver(ctx) {
      const W = ctx.canvas ? ctx.canvas.width : 256;
      const H = ctx.canvas ? ctx.canvas.height : 224;
      const dim = Math.min(1, (110 - this.gameOverT) / 24);
      const bars = Math.round(dim * 112);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, bars);
      ctx.fillRect(0, H - bars, W, bars);
      if (110 - this.gameOverT > 30) drawDialogTextCentered(ctx, 'GAME OVER', W / 2, 106);
    };
  }
  return true;
}

// Deferred, cache-only adoption. A STATIC import of scenes/dungeon.js from here
// would be a cycle (dungeon.js imports this module at its top), so the module
// is pulled in on a microtask instead — by which time the scene loader has
// already evaluated it and this resolves out of the module cache without
// re-running anything. Guarded to the two scenes that can show a card, so the
// isolated demos never drag the dungeon in.
//
// The map subscreen needs no adoption: its centring is repaired inside
// drawDialogText itself (see repairFixedAdvance), because scenes/game.js binds
// DungeonMapUI.draw onto the instance during its own init and a prototype
// patch loses that race in the one build the player actually plays.
try {
  const scene = new URLSearchParams(location.search).get('scene') || 'game';
  if (scene === 'game' || scene === 'dungeon') {
    import('../scenes/dungeon.js')
      .then(m => adoptCards(m.default))
      .catch(() => { /* scene not in this build — nothing to adopt */ });
  }
} catch (e) { /* no location (node/test) — nothing to adopt */ }

// ---------------------------------------------------------------------------
// Soft blip SFX. Self-contained so the dialog layer never blocks on the music
// engine; scenes may override with setSfx() to route into their own mixer.
// ---------------------------------------------------------------------------
let audioCtx = null;
function blip(freq = 760, dur = 0.028, gain = 0.05) {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp); lp.connect(env); env.connect(audioCtx.destination);
    osc.start(t); osc.stop(t + dur + 0.01);
  } catch (e) { /* headless / no gesture yet — silence is fine */ }
}

// ---------------------------------------------------------------------------
// DialogBox
// ---------------------------------------------------------------------------
export class DialogBox {
  constructor() {
    this.panel = panelFor(BOX.w, BOX.h);
    // Each box owns its own y. BOX stays exported and is kept in sync so
    // nothing that reads it breaks, but two boxes constructed against the same
    // module (scenes/dialog.js, scenes/overworld.js and scenes/dungeon.js each
    // build one) can no longer move each other's window.
    this.y = ANCHOR_Y.bottom;
    this.queue = [];
    this.node = null;
    this.frame = 0;
    this.shown = 0;      // characters revealed on the current page
    this.pageIndex = 0;
    this.cursor = 0;
    this.blipCount = 0;
    this.menu = false;
    this.anchor = 'bottom';
    this.wipe = 0;       // 0..OPEN_FRAMES while opening
    this.closing = 0;    // OPEN_FRAMES..0 while shutting
    this.sfx = { blip, pick: () => blip(1040, 0.05, 0.05), move: () => blip(600, 0.03, 0.045) };
  }

  get active() { return !!this.node || this.closing > 0; }
  /** True once the window is fully open and showing text. */
  get open() { return !!this.node && this.wipe >= OPEN_FRAMES; }

  setSfx(sfx) { this.sfx = { ...this.sfx, ...sfx }; }

  /**
   * Flip the window to the top when the BOTTOM window would actually bury the
   * speaker — not merely when he crosses the screen's midline. The old midline
   * test flipped for anyone standing below y=100, which on this game's overlay
   * HUD meant most conversations blanked the life meter and hearts for no
   * reason. Wren is 24px tall, so he is only in the way once his feet reach
   * the window's top edge.
   * @param y  Wren's on-screen y (sprite top).
   */
  anchorForPlayer(y) {
    if (this.node) return;                 // never move a window mid-sentence
    this.setAnchor(y + 28 > ANCHOR_Y.bottom ? 'top' : 'bottom');
  }

  setAnchor(which) {
    this.anchor = which;
    // ONLY `this.y` moves. BOX/MESSAGE_BOX is the module's stable geometry —
    // it used to be written here too, which meant a conversation that had
    // flipped to the top left the exported box pointing at y=64, and the next
    // module to draw a static message through drawMessage() (the item-get)
    // would put it in the wrong half of the screen for reasons invisible from
    // its own file.
    this.y = ANCHOR_Y[which];
  }

  // --- queueing -------------------------------------------------------------

  /** Queue prose. Accepts a string or an array of strings (one page each). */
  say(text) {
    const chunks = (Array.isArray(text) ? text : [text]).map(attributed);
    // The chapter card is a TITLE, not a line of Pell's — see isChapterCard().
    if (isChapterCard(chunks)) return this.card(chunks.join('\n'));
    const pages = [];
    for (const c of chunks) for (const p of paginate(c)) pages.push(p);
    this._push({ type: 'say', pages });
    return this;
  }

  /**
   * Queue a CARD — a chapter title, a "TO BE CONTINUED", anything the chapter
   * says to the player rather than to Wren. Same window, same wipe, same
   * typewriter; centred, no advance arrow, and it does not dismiss, because
   * this is the last thing in Chapter 1 and nothing should be able to close it.
   *
   * Centring is computed from the FULL line width, not the revealed prefix, so
   * the type appears in place instead of sliding right as it reveals.
   */
  card(text) {
    this._push({ type: 'say', pages: paginate(text), align: 'center', sticky: true });
    return this;
  }

  /** Queue a yes/no style prompt. onPick receives the chosen index. */
  ask(text, choices, onPick) {
    choices = choices || ['Yes', 'No'];
    // The choices hang off the bottom of the prompt when question and answers
    // fit the three rows together — one page, one beat, the way ALttP asks.
    // Only a prompt too long for that gets the choices on a page of their own.
    const lines = wrapCopy(text);
    const inline = lines.length + choices.length <= LINES;
    this._push({
      type: 'ask',
      inline,
      pages: inline ? [lines] : paginate(text, LINES),
      choices,
      onPick,
    });
    return this;
  }

  /**
   * Queue a shop menu.
   * items: [{ name, price, blurb, onBuy }]
   * opts:  { wallet: {cogs}, poor: string, onExit: fn, again: string }
   */
  shop(text, items, opts = {}) {
    this._push({
      type: 'shop',
      inline: false,
      pages: paginate(text),
      items,
      reopen: opts.again || text,
      wallet: opts.wallet || { cogs: 0 },
      poor: opts.poor || 'Come back with more cogs.',
      onExit: opts.onExit,
      exitLabel: opts.exitLabel || 'Nothing today',
    });
    return this;
  }

  /** Simulate an A press — used by scripted/demo playback. */
  press() { this._act(); }

  _push(node) {
    this.queue.push(node);
    if (!this.node) this._advanceNode();
  }

  _advanceNode() {
    const had = !!this.node;
    this.node = this.queue.shift() || null;
    this.pageIndex = 0;
    this.shown = 0;
    this.cursor = 0;
    this.blipCount = 0;
    this.menu = false;
    if (this.node) {
      if (!had) this.wipe = 0;             // fresh window: play the open wipe
      if (this.node.type === 'shop') {
        this.node.rows = this.node.items.map(it => ({ item: it }));
        this.node.rows.push({ exit: true });
      } else if (this.node.type === 'ask') {
        this.node.rows = this.node.choices.map(name => ({ label: name }));
      }
    } else if (had) {
      this.closing = OPEN_FRAMES;
    }
  }

  close() {
    this.queue.length = 0;
    if (this.node) this.closing = OPEN_FRAMES;
    this.node = null;
  }

  // --- state ----------------------------------------------------------------

  get _page() { return this.node ? this.node.pages[this.pageIndex] : null; }
  get _pageChars() {
    const p = this._page;
    return p ? p.reduce((n, l) => n + l.length, 0) : 0;
  }
  get _typed() { return this.shown >= this._pageChars; }
  get _lastPage() { return this.node && this.pageIndex >= this.node.pages.length - 1; }

  /** True when a choice list is on screen and awaiting a pick. */
  get _choosing() {
    if (!this.node || !this.node.rows) return false;
    if (this.node.inline) return this._typed && this._lastPage;
    return this.menu;
  }

  // --- update ---------------------------------------------------------------

  /** Returns true if the box consumed input this frame (scene should idle). */
  update(input) {
    if (this.closing > 0 && !this.node) { this.closing--; return true; }
    if (!this.node) return false;
    this.frame++;

    if (this.wipe < OPEN_FRAMES) { this.wipe++; return true; }

    if (!this.menu && !this._typed) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this._pageChars, this.shown + CHARS_PER_FRAME);
      const after = Math.floor(this.shown);
      if (after > before) {
        const ch = this._charAt(after - 1);
        if (ch && ch !== ' ' && (this.blipCount++ % 3) === 0) this.sfx.blip();
      }
      if (input.hit('a') || input.hit('start')) this.shown = this._pageChars;
      return true;
    }

    if (this._choosing) {
      const rows = this.node.rows.length;
      if (input.hit('up')) { this.cursor = (this.cursor + rows - 1) % rows; this.sfx.move(); }
      if (input.hit('down')) { this.cursor = (this.cursor + 1) % rows; this.sfx.move(); }
      if (input.hit('b') && this.node.type === 'shop') { this.cursor = rows - 1; this.sfx.move(); }
      if (input.hit('a') || input.hit('start')) { this.sfx.pick(); this._choose(); }
      return true;
    }

    if (input.hit('a') || input.hit('start')) this._act();
    return true;
  }

  // One A press on a settled page: dump, turn, open a menu, or close.
  _act() {
    if (!this.node) return;
    if (!this._typed) { this.shown = this._pageChars; return; }
    if (this._choosing) { this.sfx.pick(); this._choose(); return; }
    if (!this._lastPage) {
      this.pageIndex++;
      this.shown = 0;
      this.blipCount = 0;
      return;
    }
    if (this.node.rows && !this.node.inline && !this.menu) { this.menu = true; return; }
    if (this.node.sticky) return;          // a card stays up; nothing dismisses it
    this._advanceNode();
  }

  _choose() {
    const node = this.node;
    if (node.type === 'ask') {
      const pick = this.cursor;
      this._advanceNode();
      if (node.onPick) node.onPick(pick);
      return;
    }
    // shop
    const row = node.rows[this.cursor];
    if (row.exit) {
      this._advanceNode();
      if (node.onExit) node.onExit();
      return;
    }
    const it = row.item;
    if (node.wallet.cogs < it.price) {
      this._advanceNode();
      this.say(node.poor);
      this._reopenShop(node);
      return;
    }
    this._advanceNode();
    this.ask(it.blurb, ['Buy it', 'Leave it'], (pick) => {
      if (pick === 0) {
        node.wallet.cogs -= it.price;
        if (it.onBuy) it.onBuy();
      }
      this._reopenShop(node);
    });
  }

  // Re-enter the same shop menu after a purchase or a refusal.
  _reopenShop(node) {
    this.queue.push({ ...node, rows: null, pages: paginate(node.reopen) });
    if (!this.node) this._advanceNode();
  }

  _charAt(i) {
    const p = this._page;
    let n = 0;
    for (const line of p) {
      if (i < n + line.length) return line[i - n];
      n += line.length;
    }
    return null;
  }

  // --- draw -----------------------------------------------------------------

  /**
   * How many text rows the current page actually occupies, INCLUDING inline
   * choices. Used to centre short pages vertically: a one-line reply sitting
   * on the ceiling of a three-row well is the thing that makes a message
   * window read as a subtitle bar.
   */
  _blockRows() {
    if (!this.node) return LINES;
    if (this.menu) return this.node.rows ? this.node.rows.length : LINES;
    const p = this._page;
    const n = p ? p.length : LINES;
    if (this.node.inline && this.node.rows) return n + this.node.rows.length;
    return n;
  }

  _rowOff() {
    return Math.floor((LINES - Math.min(LINES, this._blockRows())) * LINE_STEP / 2);
  }

  _rowY(i) { return this.y + TOP_PAD + this._rowOff() + i * LINE_STEP; }

  draw(ctx) {
    if (!this.node && this.closing <= 0) return;

    // Vertical wipe: the window grows out of its own centre line over five
    // frames, and collapses back into it on the way out. The rounded top and
    // bottom caps ride the moving edges and one uniform middle row is stretched
    // between them, so the frame is never cut open mid-wipe.
    const t = this.node ? this.wipe / OPEN_FRAMES : this.closing / OPEN_FRAMES;
    if (t < 1) {
      const CAP = 7;
      const hh = Math.max(CAP * 2, Math.round(BOX.h * t));
      const top = Math.round(this.y + (BOX.h - hh) / 2);
      const p = this.panel;
      ctx.drawImage(p, 0, BOX.h >> 1, BOX.w, 1, BOX.x, top + CAP, BOX.w, hh - CAP * 2);
      ctx.drawImage(p, 0, 0, BOX.w, CAP, BOX.x, top, BOX.w, CAP);
      ctx.drawImage(p, 0, BOX.h - CAP, BOX.w, CAP, BOX.x, top + hh - CAP, BOX.w, CAP);
      return;
    }

    ctx.drawImage(this.panel, BOX.x, this.y);

    if (!this.menu) {
      const centred = this.node && this.node.align === 'center';
      let budget = Math.floor(this.shown);
      const page = this._page;
      for (let i = 0; i < page.length; i++) {
        const line = page[i];
        const cut = Math.max(0, Math.min(line.length, budget));
        // A centred row is placed by its FULL width so the reveal types in
        // place instead of walking rightwards a pixel at a time.
        const x = centred
          ? Math.round(BOX.x + BOX.w / 2 - dialogTextWidth(line) / 2)
          : TEXT_X;
        if (cut > 0) drawDialogText(ctx, line.slice(0, cut), x, this._rowY(i));
        budget -= line.length;
        if (budget <= 0) break;
      }
    }

    if (this._choosing) this._drawRows(ctx);
    else if (this._typed) this._drawArrow(ctx);
  }

  _drawArrow(ctx) {
    if (this.node && this.node.sticky) return;   // a card has nothing after it
    if ((this.frame % 44) >= 30) return;
    ctx.drawImage(ARROW, BOX.x + BOX.w - 15, this.y + BOX.h - 11);
  }

  // Choice rows. Inline prompts hang the choices off the bottom of the page;
  // a shop menu owns all three rows.
  //
  // TWO SIGNALS, TWO CHANNELS. Both used to ride one colour: `sel && afford`
  // decided the label AND the price, which meant that with 34 cogs and the
  // cursor on the 100-cog Second Wind there was not one white pixel of text in
  // the window — three dim rows and a blinking arrow. Worse, an unselected
  // affordable row and a selected unaffordable one were the same colour, so
  // "what can I buy" could only be answered by walking the cursor down the
  // list one row at a time. Now:
  //   LABEL  = where the cursor is.        selected -> INK, else DIM.
  //   PRICE  = whether you can pay it.     affordable -> INK, else DIM.
  // Every row therefore answers "can I afford this" at a glance, the selected
  // row is always the brightest label on screen, and a row you cannot afford
  // reads as a bright name with a dim price — the shape of a price tag you
  // have to look away from. No new colours: the window still spends INK and
  // DIM and nothing else.
  _drawRows(ctx) {
    const node = this.node;
    const rows = node.rows;
    // Inline choices hang directly off the last line of prose. With the page
    // vertically centred that means page.length, not LINES - rows.length —
    // otherwise a centred one-line prompt leaves a hole under itself.
    const first = node.inline ? (this._page ? this._page.length : 0) : 0;
    const labelX = TEXT_X + 14;
    for (let i = 0; i < rows.length; i++) {
      const y = this._rowY(first + i);
      const sel = i === this.cursor;
      const row = rows[i];
      const label = row.exit ? node.exitLabel : (row.label || row.item.name);
      drawDialogText(ctx, label, labelX, y, sel ? INK : DIM);
      if (row.item) {
        const afford = node.wallet.cogs >= row.item.price;
        const price = String(row.item.price);
        const px = BOX.x + BOX.w - 22 - dialogTextWidth(price);
        drawDialogText(ctx, price, px, y, afford ? INK : DIM);
        ctx.drawImage(COG, BOX.x + BOX.w - 19, y);
      }
      if (sel && (this.frame % 32) < 24) ctx.drawImage(CURSOR, TEXT_X + 3, y);
    }
  }
}
