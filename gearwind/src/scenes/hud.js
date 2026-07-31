// HUD demo scene: ALttP-style top bar over a small overworld vignette —
// textured grass, a dirt path, a bush hedge and a stone ledge, so the HUD is
// judged against a screen with real ALttP color density rather than a flat
// green field. A heart drains/refills every ~60 frames so damage states show
// in captures.
import { HUD } from '../game/hud.js';
import { makeTiles } from '../sprites.js';

const PAL = {
  g: '#4f9a48', // grass base
  d: '#3a7c34', // grass dark tufts
  l: '#68b45c', // grass light flecks
  o: '#2c6428', // grass deep shadow
  w: '#e8b840', // flower petals (warm gold — NOT white: a white petal cluster
                // landing under a white counter digit fuses with it, which is
                // why flowers used to be banned from the HUD band entirely)
  y: '#c06818', // flower center

  p: '#a08048', // path base
  q: '#c0a068', // path light
  r: '#786038', // path dark
  s: '#604828', // path pebble shadow

  B: '#287838', // bush mid
  C: '#1c5028', // bush dark
  D: '#68c060', // bush highlight
  E: '#183c1c', // bush outline

  S: '#98a0a0', // stone base
  T: '#c0c8c8', // stone light
  U: '#68706c', // stone shade
  V: '#383c3c', // stone outline

  L: '#84c878', // sun-caught grass blade
  O: '#20501f', // grass root shadow
  P: '#d8c090', // path pebble highlight
  F: '#3c9848', // bush mid-light
  M: '#547048', // moss on stone
  N: '#8090a8', // stone cool reflection

  G: '#2c6c3c', // bush mid-dark (between body and core shadow)
  Y: '#98e088', // bush sun rim
  R: '#8a9498', // stone mid grey
  Z: '#4c3c20', // path deep rut
  i: '#f8e0a0', // flower petal highlight
};

const GRASS_A = [
  '................',
  '..d.......d.....',
  '.ddd..l..ddd....',
  '..O........O....',
  '.......d....L...',
  '..l...ddd....d..',
  '............ddd.',
  '.d...........O..',
  'ddd.....d....l..',
  '.O.....ddd......',
  '........O.......',
  '...d..L....d....',
  '..ddd..l..ddd...',
  '....O......O....',
  '.....d..........',
  '....ddd......l..',
];

const GRASS_B = [
  '................',
  '.....d......l...',
  '....ddd.........',
  '.....O....d.....',
  '.l.......ddd....',
  '....L.....O.....',
  '...d............',
  '..ddd....d..l...',
  '...O....ddd.....',
  '...........O....',
  '.d........d.....',
  'ddd..l...ddd..L.',
  '.O..............',
  '.......d.....O..',
  '..l...ddd...d...',
  '...........ddd..',
];

const GRASS_FLOWER = [
  '................',
  '..d.......d.....',
  '.ddd..l..ddd....',
  '................',
  '......ii........',
  '..l..iyyw....d..',
  '.....wyyw...ddd.',
  '.d....ww........',
  'ddd......O...l..',
  '........O.......',
  '................',
  '...d.......d....',
  '..ddd..l..ddd...',
  '................',
  '.....d..........',
  '....ddd......l..',
];

// Packed dirt path. Base + light scuffs + dark ruts + a few pebbles.
const PATH_A = [
  'pppppppppppppppp',
  'pqqppppprppppppp',
  'pppppprrpppqqppp',
  'pprppPpppppppZps',
  'prrppqqppppppZsr',
  'ppppppppprppqqpp',
  'ppqpppPprrpppppp',
  'sppppppppppppppp',
  'rsPppqqppppZrppp',
  'ppppppPpppprrpps',
  'ppppprppqqppPPsr',
  'ppqqprrppppppppp',
  'pppppppppppppppp',
  'prppppppqqpppppp',
  'rrppqqppppppprpp',
  'pppppppppppppprr',
];

const PATH_B = [
  'ppppqqpppppprppp',
  'ppppppPpppprrpps',
  'prppppqqpppppppr',
  'rrppPppppppqqppp',
  'ppppprppppppppps',
  'ppqqprrpppppppsr',
  'pppppppppppppppp',
  'ppppppprppqqpppp',
  'sppppprrpppPpppp',
  'rsppqqppppppZprp',
  'ppppppppppppprrp',
  'pppprppqqpppppps',
  'pppprrppppppZppr',
  'pqqpppppppppqqpp',
  'pppppppprpppppps',
  'ppppppprrppppppr',
];

// Path edge (grass above, dirt below) — ragged ALttP-style boundary.
const PATH_TOP = [
  '................',
  '..d.......d.....',
  '.ddd..l..ddd....',
  '................',
  '.....d..........',
  '....ddd......l..',
  '..o..........o..',
  'oopoooooopoooooo',
  'ppppprppppppppqq',
  'pqqppprppppppppp',
  'ppppppppprrppppp',
  'pppqqppppppppspp',
  'prpppppqqppppsrp',
  'rrpppppppppppppp',
  'ppppppprppqqpppp',
  'ppppppprrppppppp',
];

// Vertical grass/dirt boundaries, built by masking a path tile against a grass
// tile along a ragged per-row boundary column (same grammar as PATH_TOP's
// 'oo' shadow row, rotated 90 degrees). Generated rather than hand-typed so
// every row is guaranteed 16 wide.
const EDGE_BOUND = [3, 3, 2, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 2, 3, 3];
function edgeTile(pathRows, grassRows, side) {
  return pathRows.map((prow, y) => {
    const grow = grassRows[y];
    const b = side === 'left' ? EDGE_BOUND[y] : 15 - EDGE_BOUND[y];
    let out = '';
    for (let x = 0; x < 16; x++) {
      const grassSide = side === 'left' ? x < b : x > b;
      out += x === b ? 'o' : grassSide ? grow[x] : prow[x];
    }
    return out;
  });
}
const PATH_LEFT = edgeTile(PATH_A, GRASS_A, 'left');
const PATH_RIGHT = edgeTile(PATH_B, GRASS_B, 'right');

// Bush: chunky round hedge blob, ALttP grammar (dark outline, mid body,
// highlight speckles on the top-left).
const BUSH = [
  '................',
  '................',
  '....EEEEEEEE....',
  '..EEBBYYBBBBEE..',
  '.EBBDBYDBFBBBBE.',
  '.EBDBBBBBDBBGCE.',
  'EBBFBBDBBBBBGCCE',
  'EBDBBBBBBBDBGCCE',
  'EBBBBDBBBFBBGCCE',
  'EBBDBBBBDBBGCCCE',
  'EBBBBBBBBBGCCCCE',
  '.EBBBDBFBBGCCCE.',
  '.EBBBBBBBGCCCCE.',
  '..EECCCCCCCCEE..',
  '....EEEEEEEE....',
  '................',
];

// Stone ledge block — the bottom band, gives the screen a cool grey family.
const STONE = [
  'VVVVVVVVVVVVVVVV',
  'VTTTTTTTTTTTTTTV',
  'VTSSSSSSSSSRRSUV',
  'VTSSSUSSSNSRRSUV',
  'VTSRRSSSSSUSSSUV',
  'VTSRRSSSSSSMMSUV',
  'VTSSSSSSRRSSSSUV',
  'VUUUUUUUUUUUUUUV',
  'VVVVVVVVVVVVVVVV',
  'VTTTTTTTTTTTTTTV',
  'VTSSRRSSUSSNSSUV',
  'VTSSRRSSSSSSSSUV',
  'VTMSUSSSSSRRUSUV',
  'VTSSSSSSSSRRSSUV',
  'VUUUUUUUUUUUUUUV',
  'VVVVVVVVVVVVVVVV',
];

export default class HudScene {
  async init(engine) {
    this.hud = new HUD({ maxHearts: 5, halves: 9, cogs: 123, keys: 2, bombs: 5, steam: 0.7 });
    this.tiles = makeTiles(
      {
        a: GRASS_A, b: GRASS_B, f: GRASS_FLOWER,
        pa: PATH_A, pb: PATH_B, pt: PATH_TOP,
        pl: PATH_LEFT, pr: PATH_RIGHT,
        bush: BUSH, stone: STONE,
      },
      PAL,
    );
    this.t = 0;
    // heart animation: 4.5 -> 4 -> 3.5 -> 4 -> 4.5 ... (in half-hearts)
    this.seq = [9, 8, 7, 8];
    this.seqIdx = 0;
  }

  update(dt, engine) {
    this.t++;
    // Chest pickup at t=40: the cog counter is handed +40 in a single frame and
    // has to WALK there (HUD.update rolls it at one unit per two frames, the
    // way ALttP counts a rupee pickup in). Frames 61 and 91 of a standard
    // 6-frame capture land mid-roll, so the behaviour is visible in stills:
    // 123 -> 133 -> 148 -> 163, settled from frame 121 on.
    if (this.t === 40) this.hud.cogs += 40;
    this.hud.update(dt);
    if (this.t % 60 === 0) {
      this.seqIdx = (this.seqIdx + 1) % this.seq.length;
      this.hud.halves = this.seq[this.seqIdx];
    }
    // Steam pressure cycles over 0.15..0.75 with a ~3s period, so a six-frame
    // capture walks the whole range instead of half a slow ramp. The gauge is
    // never pinned at 100%: the black well ABOVE the fill line is the point of
    // the object (the real magic tube sits 12/32 full) and it has to be
    // visible in every frame a critic grabs.
    this.hud.steam = 0.45 + 0.30 * Math.sin(this.t / 28);
  }

  draw(ctx, engine) {
    // grass field (tiles are detail-only; fill the base green underneath)
    ctx.fillStyle = PAL.g;
    ctx.fillRect(0, 0, 256, 224);

    // The HUD band is deliberately laid over THREE different grounds. The
    // vignette used to put the path at ty6-8 and the stone at ty12-13, so the
    // strip was only ever captured over green and proved nothing about the
    // case it is actually at risk in — white digits and metal icons over grey
    // stone and brown dirt. Now, left to right across ty0-3:
    //
    //   grey stone cliff  tx0-4  ty0-3  -> gauge (x20-35), item box (x38-58),
    //                                      cog icon (x75-82) and digit 1 (x67)
    //   green grass       tx5           -> rest of the cog counter
    //   brown dirt spur   tx6-9  ty0-6  -> key (x102-111) + bombs (x127-134)
    //                                      and all four of their digits
    //   green grass       tx10-15       -> LIFE header + heart row (x161-200)
    //
    // The spur is a T-junction into the ty6-8 path, so the screen still reads
    // as an overworld rather than as a test card.
    //
    // Grey was capped at the STONE tile rather than made brighter on purpose:
    // sampled across all ten refs, the dominant colour behind the real HUD
    // band (y10-31) runs luma 71-147, the top end being the Helmasaur room's
    // #909090 floor. Our #98a0a0 stone base is luma 156 — already a shade
    // harsher than anything ALttP asks its own strip to survive.
    //
    // Flowers ARE suppressed for ty<2. A GRASS_FLOWER's petal cluster used to
    // land at x117-120 y20-22 — squarely on the icon baseline y15-22, in the
    // gap between the key and bomb groups — and read at 3x as a fourth counter
    // icon whose digits went missing. Below y32 they are fine and stay in, so
    // the band is still busy.
    for (let ty = 0; ty < 14; ty++) {
      for (let tx = 0; tx < 16; tx++) {
        const n = ((tx * 31 + ty * 17) ^ (tx * ty * 5)) % 13;
        const spur = tx >= 6 && tx <= 9 && ty <= 6;
        let tile;
        if (ty <= 3 && tx <= 4) tile = this.tiles.stone;    // cliff ledge
        else if (spur && tx === 6) tile = this.tiles.pl;    // spur, grass->dirt
        else if (spur && tx === 9) tile = this.tiles.pr;    // spur, dirt->grass
        else if (spur) tile = n % 2 ? this.tiles.pb : this.tiles.pa;
        else if (ty === 6) tile = this.tiles.pt;            // path shoulder
        else if (ty === 7 || ty === 8) tile = n % 2 ? this.tiles.pb : this.tiles.pa;
        else if (n === 6 && ty >= 2) tile = this.tiles.f;
        else tile = n % 2 ? this.tiles.b : this.tiles.a;
        ctx.drawImage(tile, tx * 16, ty * 16);
      }
    }

    // bush hedge along the path's far shoulder (tx9 vacated — it is dirt now)
    for (const tx of [1, 2, 5, 10, 12, 13]) ctx.drawImage(this.tiles.bush, tx * 16, 4 * 16);
    for (const tx of [0, 4, 7, 11, 15]) ctx.drawImage(this.tiles.bush, tx * 16, 10 * 16);

    // stone ledge band across the bottom
    for (let tx = 0; tx < 16; tx++) {
      ctx.drawImage(this.tiles.stone, tx * 16, 12 * 16);
      ctx.drawImage(this.tiles.stone, tx * 16, 13 * 16);
    }

    this.hud.draw(ctx);
  }
}
