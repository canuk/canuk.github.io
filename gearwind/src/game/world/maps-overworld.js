// Gearwind — Bellows Isle, Chapter 1 map data.
//
// Nine connected 16x14 screens, authored as character grids so they can be
// read and edited like a level in a text file.  Screens sit on an integer
// grid; walking off an edge scrolls to the neighbour at that coordinate.
//
//        (2,0) cliffnook   (3,0) scrapfield   (4,0) mouth
//   (0,1) villagew  (1,1) villagee  (2,1) bridge  (3,1) terrace
//   (0,2) dockroad
//   (0,3) dock                      + interiors: shop, home
//
// THE ROUTE (STORY.md beats 1-3):
//   dock -> dockroad -> villagew -> villagee -> bridge -> terrace
//        -> scrapfield -> (west spur: cliffnook, key + heart piece)
//        -> mouth
//
// TILE LEGEND
//   .  lawn                     o  lawn that blocks (rarely needed — the
//   dirt roads and dark-grass       building footprints already collide)
//   fields are rect lists, not characters: see `path` and `dark`
//   N  north cliff rim          c  NW corner      C  NE corner
//   W  west island edge         E  east island edge
//   R  south rim (grass lid)    F  cliff face     L  cliff lobe
//   4/5/6  SW corner rim/face/lobe    1/2/3  SE corner rim/face/lobe
//   K  open sky                 U  cloud tops     V  cloud body
//   D  deck planks              p/P/q  pier rail / planks / under-beams
//   b/B/m  rope bridge rail / slats / stringer
//   S  flagstone paving         T  riveted plate causeway
//   H  interior wall  h  interior wall cap  x  interior void
//
// Screen fields: map, path[], dark[], flat[], flatpx[], solids[], built[],
// bushes[], pots[], chests[], signs[], npcs[], enemies[], gates[], hearts[],
// doors[], flowers[], animated[], portal.

// ---------------------------------------------------------------------------
// 1. SKYHARBOR DOCK — the cold open.  Wren is standing on a plank pier out
//    over nothing, his skiff still moored behind him, the isle to the west.
// ---------------------------------------------------------------------------
const dock = {
  id: 'dock',
  name: 'Skyharbor Dock',
  grid: [0, 3],
  // THE SOUTH RIM STEPS TOO. The east and west rims were taken off the ruled
  // line last pass and the south one was left on it: seven screens carried a
  // 256px band of R/F/L at exactly rows 11-13, measuring 1.2-2.0px of spread
  // per tile column against ALttP's 13px. It is the longest silhouette line in
  // the game and the one the void has to prove is floating. Here the quay's
  // underside bites in two tiles at columns 7-8 and hangs out one at 3-5, so
  // sky reaches up into the bottom of the frame in one place and rock reaches
  // down past it in another.
  map: [
    'W.........EKKKKK',
    'W.........EKKKKK',
    'W.........EKKKKK',
    'W.........EKKKKK',
    'W....DDDDDEKKKKK',
    'W....DDDDDpppppp',
    'W....DDDDDPPPPPP',
    'W....DDDDDqqqqqq',
    'W....DDDDDEKKKKK',
    'W......RR.EKKKKK',
    '4RR...RFFR1KKKKK',
    '5FFRRRFLLF2KKKKK',
    '6LLFFFLKKL3KKKKK',
    'UUULLLUUUUUUUUUU',
  ],
  // A lesser isle a long way under the quay, and a hauler further out still.
  // Wren is standing on planks over two miles of air in the first thirty
  // seconds of the game; something has to be down there saying so.
  voidProps: [
    { sprite: 'islet_far', x: 196, y: 186, drift: 0.011, bob: 200 },
    { sprite: 'skiff_far', x: 208, y: 36, drift: 0.05, bob: 120, phase: 0.6 },
    { sprite: 'islet_mid', x: 228, y: 132, drift: 0.010, bob: 240, phase: 1.7 },
    { sprite: 'islet_tiny', x: 198, y: 70, drift: 0.007, bob: 290, phase: 2.9 },
    { sprite: 'skiff_tiny', x: 150, y: 208, drift: 0.028, bob: 160, phase: 1.1 },
  ],
  // The harbour road leaves the quay and climbs away north.
  path: [[2, 0, 3, 9], [4, 5, 4, 6]],
  dark: [[6, 0, 8, 2], [1, 6, 2, 8]],
  built: [
    ['barrel', 90, 52], ['crate', 132, 116], ['crate', 148, 118],
    ['crate', 116, 116],
  ],
  solids: [
    ['bollard', 10, 5], ['bollard', 14, 5],
    ['barrel', 5, 4], ['crate', 6, 4],
    ['rock', 8, 1], ['rock_small', 9, 2],
    ['post', 4, 2], ['post', 1, 5], ['post', 4, 9],
  ],
  flatpx: [
    // Moored clear of the LIFE meter: the skiff is the first thing STORY puts
    // on screen and it was drawn straight through the hearts.
    ['skiff', 176, 34],
    ['kerb_h', 80, 59], ['kerb_h', 96, 59], ['kerb_h', 112, 59],
    ['kerb_h', 128, 59], ['kerb_h', 144, 59],
    ['kerb_h', 80, 144], ['kerb_h', 96, 144], ['kerb_h', 112, 144],
    ['kerb_h', 128, 144], ['kerb_h', 144, 144],
    ['kerb_v', 75, 64], ['kerb_v', 75, 80], ['kerb_v', 75, 96],
    ['kerb_v', 75, 112], ['kerb_v', 75, 128],
  ],
  flat: [
    ['rope_coil', 8, 7], ['rope_coil', 12, 6], ['rope_coil', 6, 5],
    ['tallgrass', 1, 2], ['tallgrass2', 2, 4], ['tallgrass3', 8, 9],
    ['tallgrass', 7, 9], ['tallgrass2', 1, 9], ['tallgrass3', 6, 3],
    ['tallgrass', 9, 4], ['tallgrass2', 3, 12],
    ['pebbles', 2, 3], ['pebbles', 3, 7], ['pebbles', 2, 9], ['pebbles', 12, 6],
  ],
  bushes: [[7, 1], [8, 2], [1, 3], [4, 1], [6, 9], [9, 8], [1, 7], [4, 3]],
  npcs: [{ kind: 'pell', c: 7, r: 5, facing: 'down' }],
  signs: [{
    c: 1, r: 4,
    text: 'SKYHARBOR, COGWICK HOLLOW\nRoad north to the village.\nMind the step.',
  }],
  flowers: [
    ['w', 26, 26], ['r', 36, 34], ['w', 22, 118], ['r', 34, 136],
    ['w', 140, 12], ['r', 132, 22], ['w', 118, 150], ['r', 106, 142],
  ],
  animated: [
    { kind: 'gull', x: 0, y: 24, phase: 0, speed: 0.42, dir: 'right' },
    { kind: 'gull', x: 0, y: 44, phase: 120, speed: 0.31, dir: 'right' },
    { kind: 'gull', x: 0, y: 168, phase: 60, speed: 0.5, dir: 'right' },
  ],
  spawn: { x: 214, y: 92, dir: 'left' },
};

// ---------------------------------------------------------------------------
// 2. DOCK ROAD — the climb.  A fenced dirt lane, a stand of brass-banded
//    trees, and the first bushes worth cutting.
// ---------------------------------------------------------------------------
const dockroad = {
  id: 'dockroad',
  name: 'Harbour Road',
  grid: [0, 2],
  // THE EAST RIM STEPS. Measured: every screen but the dock put its outermost
  // land tile in the SAME column for all fourteen rows — a ruled 224px line,
  // which reads as the edge of a MAP, not the edge of a rock. ALttP's own
  // cliff-path boundary crosses three tile columns (tile-row means 152 -> 199,
  // sd 13px). This one crosses four: a bite at rows 2-4, a shelf at 5-8, a
  // promontory at 9-10. 'C' is the north-east corner tile, which is what caps
  // a shelf that steps OUT as you go down; a shelf that steps IN gets the
  // underhang buildVoidLayers now draws below any natural ground.
  map: [
    'W.........EKKKKK',
    'W.........EKKKKK',
    'W........EKKKKKK',
    'W........EKKKKKK',
    'W........EKKKKKK',
    'W.........NCKKKK',
    'W..........EKKKK',
    'W..........EKKKK',
    'W..........EKKKK',
    'W...........CKKK',
    'W...........EKKK',
    'W.........EKKKKK',
    'W.........EKKKKK',
    'W.........EKKKKK',
  ],
  // THE SCALE LADDER. One prop per screen is a decal; three or four at falling
  // sizes AND falling contrast is a distance. See SPRITE_ROWS.islet_mid.
  voidProps: [
    { sprite: 'islet_far', x: 178, y: 176, drift: 0.013, bob: 200 },
    { sprite: 'skiff_far', x: 214, y: 108, drift: 0.045, bob: 130 },
    { sprite: 'islet_mid', x: 236, y: 44, drift: 0.010, bob: 240, phase: 1.4 },
    { sprite: 'islet_tiny', x: 196, y: 12, drift: 0.007, bob: 280, phase: 2.7 },
    { sprite: 'skiff_tiny', x: 250, y: 142, drift: 0.028, bob: 160, phase: 0.9 },
  ],
  // ONE lane, an S: up the left, a jog right across the middle, up again.
  // Nothing solid stands in it — the fences and rocks border it instead, so
  // the road reads as a road and always walks.
  path: [[2, 10, 3, 13], [2, 9, 6, 10], [5, 4, 6, 9], [4, 3, 6, 4], [4, 0, 5, 3]],
  dark: [[7, 6, 9, 9], [0, 1, 2, 3], [8, 12, 9, 13]],
  solids: [
    ['fence', 7, 8], ['fence', 8, 8], ['fence', 9, 8],
    ['fence', 0, 6], ['fence', 1, 6],
    ['rock', 8, 2], ['rock_small', 9, 3], ['rock', 1, 12], ['rock_small', 0, 13],
    ['rock', 7, 1], ['rock_small', 8, 0],
    ['post', 1, 4], ['post', 1, 9], ['post', 7, 4],
    ['barrel', 7, 5], ['crate', 8, 5], ['crate', 7, 6],
  ],
  built: [['tree', 132, 96], ['tree2', -14, 8], ['tree', 6, 152]],
  flat: [
    ['tallgrass', 0, 4], ['tallgrass2', 1, 7], ['tallgrass3', 8, 7],
    ['tallgrass', 9, 12], ['tallgrass2', 7, 13], ['tallgrass3', 2, 4],
    ['tallgrass', 8, 11], ['tallgrass2', 9, 6], ['tallgrass3', 0, 9],
    ['tallgrass', 4, 13], ['tallgrass2', 7, 0], ['tallgrass3', 9, 0],
    ['pebbles', 2, 12], ['pebbles', 5, 8], ['pebbles', 5, 3], ['pebbles', 3, 9],
    ['pebbles', 4, 1],
  ],
  bushes: [
    [0, 5], [1, 5], [0, 7], [8, 3], [9, 3], [9, 7], [8, 9],
    [1, 11, 'cog'], [7, 12], [8, 13], [3, 7], [3, 6], [2, 8],
    [6, 12], [7, 11], [2, 1], [3, 4],
  ],
  signs: [{
    c: 1, r: 10,
    text: 'COGWICK HOLLOW: north\nSKYHARBOR: behind you\nThe rest of the world: up',
  }],
  flowers: [
    ['w', 20, 20], ['r', 30, 30], ['w', 142, 60], ['r', 150, 74],
    ['w', 26, 200], ['r', 40, 190], ['w', 130, 190], ['r', 122, 178],
  ],
  animated: [{ kind: 'gull', x: 0, y: 30, phase: 40, speed: 0.28, dir: 'right' }],
  spawn: { x: 40, y: 186, dir: 'up' },
};

// ---------------------------------------------------------------------------
// 3. COGWICK HOLLOW, WEST — Hesper's shop, two homes, the well, and Tam.
// ---------------------------------------------------------------------------
const villagew = {
  id: 'villagew',
  name: 'Cogwick Hollow',
  grid: [0, 1],
  map: [
    'cNNNNNNNNNNNNNNN',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'W.........4RR..R',
    'W.........5FFRRF',
    'W.........6LLFFL',
  ],
  // THE LANE BENDS.  It comes up from the harbour, turns east along the front
  // of the shop, dips SOUTH around the well — the well is the reason the road
  // is not straight — and climbs back to leave at the Hollow Green.  Two short
  // aprons run north off it to the two doorsteps, which is what gives the
  // village its depth instead of one road with houses parked behind it.
  path: [
    [4, 8, 5, 13],          // up from the harbour road
    [2, 7, 6, 8],           // west arm, past the shop
    [3, 6, 4, 7],           //   ... and the apron to Hesper's door
    [5, 8, 10, 9],          // the dip around the well
    [9, 7, 15, 8],          // east arm, out to the Green
    [12, 6, 13, 7],         //   ... and the apron to the doorstep
  ],
  dark: [[12, 9, 14, 10], [0, 2, 2, 4], [7, 1, 9, 2], [1, 12, 3, 13]],
  built: [
    ['shop', 32, 26],
    ['house_a', 184, 18],
    ['well', 136, 150],
  ],
  solids: [
    // A fenced kitchen garden hard against the lane's outer kerb, so the road
    // is bordered on both sides instead of dissolving into open lawn.
    ['fence', 8, 5], ['fence', 9, 5], ['fence', 10, 5], ['fence', 11, 5],
    ['post', 8, 6], ['post', 11, 6],
    ['post', 2, 6], ['post', 6, 6], ['post', 6, 9], ['post', 10, 6],
    ['rock', 1, 10], ['rock_small', 2, 10], ['rock', 0, 5],
    ['barrel', 7, 3], ['crate', 8, 3], ['crate', 7, 2],
    ['crate', 14, 4], ['barrel', 15, 4],
    ['barrel', 2, 11], ['crate', 3, 11],
  ],
  flat: [
    ['pebbles', 4, 10], ['pebbles', 4, 12], ['pebbles', 8, 9], ['pebbles', 12, 7],
    ['pebbles', 6, 8], ['pebbles', 10, 8],
    ['tallgrass', 1, 6], ['tallgrass2', 14, 9], ['tallgrass3', 10, 11],
    ['tallgrass', 2, 8], ['tallgrass2', 6, 11], ['tallgrass3', 13, 3],
    ['tallgrass', 11, 12], ['tallgrass2', 7, 11], ['tallgrass3', 3, 1],
    ['tallgrass', 15, 2], ['tallgrass2', 8, 12], ['tallgrass3', 0, 9],
  ],
  bushes: [
    // Clusters, not rows: three or four touching, with a gap, the way a
    // hedge actually grows along a wall.
    [1, 1], [2, 1], [2, 2], [6, 3], [6, 4], [5, 4],
    [1, 7], [1, 8], [0, 8],
    [14, 11], [13, 11], [14, 10], [6, 12], [7, 12], [7, 13], [9, 12],
    [15, 5, 'cog'], [15, 6],
    [12, 10], [3, 10], [2, 12], [10, 3], [10, 4], [11, 3],
  ],
  pots: [[9, 6], [1, 9], [12, 11]],
  npcs: [
    { kind: 'tam', c: 8, r: 8, facing: 'down', px: [132, 160] },
  ],
  signs: [
    { c: 6, r: 6, kind: 'village' },
    { c: 2, r: 5, kind: 'shop' },
  ],
  doors: [
    { building: 'shop', to: 'shop' },
    { building: 'house_a', to: 'home' },
  ],
  flowers: [
    ['w', 18, 30], ['r', 26, 42], ['w', 150, 22], ['r', 162, 30],
    ['w', 100, 180], ['r', 88, 172], ['w', 216, 168], ['r', 228, 158],
    ['w', 66, 154], ['r', 54, 146], ['w', 178, 108], ['r', 190, 118],
  ],
  animated: [
    { kind: 'puff', x: 76, y: 14, phase: 0, period: 108 },
    { kind: 'puff', x: 232, y: 4, phase: 54, period: 108 },
  ],
  spawn: { x: 72, y: 186, dir: 'up' },
};

// ---------------------------------------------------------------------------
// 4. COGWICK HOLLOW, EAST — the windmill with the bent vane, the sealed
//    Boilerworks hatch, Gaffer Marla, and a house whose owner already ran.
//    The east way out is under thornwrack: until Marla gives up the Cogblade
//    there is nothing here that will cut it, and that is the gate.
// ---------------------------------------------------------------------------
const villagee = {
  id: 'villagee',
  name: 'The Hollow Green',
  grid: [1, 1],
  map: [
    'NNNNNNNNNNNNNNNN',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    'R...............',
    'FR..........RR..',
    'LFRRRR...RRRFFRR',
    'KLFFFFRRRFFFLLFF',
    'KKLLLLFFFLLLKKLL',
  ],
  // In low from the village, a spur south to the hatch where Marla is sitting,
  // then a climb north-east past the mill and out to the Windrope. The road
  // changes row twice, so no screen edge sees a full-width band.
  // Two tiles wide the whole way, with ONE step in it at the sixth column:
  // a three-tile-wide band across the middle of the screen is a stripe, not
  // a road, however many rectangles it is made of.
  path: [
    [0, 7, 6, 8],           // in from Cogwick Hollow, low
    [6, 6, 15, 7],          // step up and run east to the rope
    [4, 8, 5, 10],          // the spur down to the Boilerworks hatch
    [5, 9, 9, 10],          //   ... and its apron, where Marla is sitting
  ],
  // The SW shade was over the hollow; the chest in it has to be spottable
  // from the spur, so the rect stops short of the pocket.
  dark: [[2, 9, 2, 9], [12, 2, 15, 3], [8, 4, 10, 5], [13, 8, 15, 9]],
  built: [
    ['house_locked', 28, 44],
    ['house_c', 104, 4],
    // THE MILL MOVED DOWN 36px. ALttP never parks a landmark under the LIFE
    // text, and the bent vane — the one silhouette on this screen that STORY
    // asks the player to read — was drawn straight through the hearts. The
    // vane now starts at y=38, clear of the whole meter.
    ['windmill', 196, 50],
    ['hatch', 124, 142],
    // THE FIRST LESSON, AND IT IS TEN PIXELS FROM MARLA. These two stones
    // close a hollow off the Boilerworks spur — the same spur she is sitting
    // on when she hands over the Cogblade. They are in PIXELS so they sit
    // BELOW the entry road rather than in it. The only side of the hollow that
    // is not stone or rim is the pair of bushes at (3,9)/(3,10), and the chest
    // behind them is in view from the spur the whole way down. So the very
    // first thing the new blade is pointed at teaches that a bush is a DOOR —
    // before the Thornwrack, which only teaches that a bush comes down, and
    // long before the rim nook makes the chapter depend on it.
    ['rock', 16, 140], ['rock', 32, 140],
  ],
  solids: [
    ['post', 9, 5], ['post', 11, 8], ['post', 4, 6],
    ['rock', 13, 8], ['rock_small', 12, 9],
    ['crate', 1, 1], ['barrel', 2, 1], ['crate', 1, 2],
    ['fence', 6, 4], ['fence', 7, 4], ['fence', 8, 4],
    ['vent', 3, 11],
    ['crate', 11, 3], ['barrel', 12, 3],
    ['rock', 0, 4], ['rock_small', 1, 5],
  ],
  flat: [
    ['pebbles', 4, 7], ['pebbles', 8, 7], ['pebbles', 6, 10], ['pebbles', 12, 6],
    ['pebbles', 2, 8], ['pebbles', 7, 11],
    ['tallgrass', 1, 8], ['tallgrass2', 5, 10], ['tallgrass3', 9, 2],
    ['tallgrass', 14, 5], ['tallgrass2', 11, 10], ['tallgrass3', 3, 8],
    ['tallgrass', 6, 1], ['tallgrass2', 15, 5], ['tallgrass3', 8, 10],
    ['tallgrass', 12, 1], ['tallgrass2', 2, 3],
  ],
  bushes: [
    [1, 4], [1, 3], [2, 3],
    [3, 9], [3, 10],                  // the door into the hollow (see solids)
    [11, 9], [12, 8], [12, 9], [6, 2, 'cog'],
    [10, 10], [5, 5], [4, 5],
    // THORNWRACK. It seals the east edge: four screens of overworld sit behind
    // it and nothing in the village will cut it. This is why you go and talk
    // to Marla, and it is the only gate in the first half that is made of the
    // thing it teaches.
    //
    // IT IS NOT A WALL ANY MORE. The first build ran column 15 from row 0 to
    // row 10 and hung four bushes off column 14, which gave the mass a ruled
    // left edge 176px tall — so it read as impassable scenery rather than as
    // a row of cuttable objects, on the one screen where reading it wrong
    // costs you the chapter. Column 15 still seals (it has to), but the FACE
    // the player walks up to now steps between columns 12 and 15 and has two
    // notches in it that let you walk in one tile and find out for yourself
    // that the way through is not a gap. One bush stands alone in the road a
    // few tiles short of it, so the affordance is taught before it is tested.
    //
    //   cols   12 13 14 15
    //   row 0   .  .  #  #
    //   row 1   .  #  #  #
    //   row 2   .  .  .  #   <- notch
    //   row 3   .  .  #  #
    //   row 4   #  #  #  #
    //   row 5   .  #  #  #
    //   row 6   .  .  #  #
    //   row 7   .  .  .  #   <- notch, and the road runs into it
    //   row 8   .  .  .  #   <- notch
    //   row 9   .  .  #  #
    [15, 0, 'none'], [15, 1, 'none'], [15, 2, 'none'], [15, 3, 'none'],
    [15, 4, 'none'], [15, 5, 'none'], [15, 6, 'none'], [15, 7, 'none'],
    [15, 8, 'none'], [15, 9, 'none'],
    [14, 0, 'none'], [14, 1, 'none'], [14, 3, 'none'], [14, 4, 'none'],
    [14, 5, 'none'], [14, 6, 'none'], [14, 9, 'none'],
    [13, 1, 'none'], [13, 4, 'none'], [13, 5, 'none'],
    [12, 4, 'none'],
    // the lone bush in the road, and one out on the north lawn: two bushes
    // standing clear of anything else, so a bush reads as a THING before the
    // player meets sixteen of them fused into a hedge.
    [11, 6], [12, 1],
  ],
  pots: [[10, 8], [11, 10], [2, 6]],
  chests: [{
    c: 2, r: 10, give: 'cogs:35',
    text: 'Thirty-five cogs in a jam jar.\nA gull feather on top, and\nthe count scratched in the lid.',
  }],
  npcs: [{ kind: 'marla', c: 6, r: 9, facing: 'down', px: [104, 132] }],
  signs: [
    { c: 10, r: 9, kind: 'hatch' },
    {
      c: 12, r: 7,
      text: 'THE WINDROPE ROAD\nThornwrack has taken it.\nBring something with an edge.',
    },
  ],
  notices: [
    {
      px: [28, 88, 56, 22],
      text: ['The door is boarded from\nthe inside. Whoever lived\nhere left in a hurry.',
        'CHALKED ON THE DOOR\n"Home when the isle stops\nfalling. Holt."'],
    },
    {
      px: [104, 60, 60, 20],
      text: 'The parish store. Empty\nshelves and a smell of\ncold machine oil.',
    },
  ],
  flowers: [
    ['w', 26, 26], ['r', 38, 18], ['w', 200, 172], ['r', 214, 162],
    ['w', 78, 166], ['r', 66, 176], ['w', 154, 40], ['r', 146, 52],
    ['w', 234, 120], ['r', 226, 132],
  ],
  animated: [
    { kind: 'vanes', x: 191, y: 38, sprite: 'vanes', speed: 8 },
    { kind: 'puff', x: 146, y: 128, phase: 20, period: 132 },
    { kind: 'puff', x: 108, y: -8, phase: 66, period: 132 },
  ],
  doors: [
    { building: 'windmill', to: 'mill' },
  ],
  spawn: { x: 8, y: 120, dir: 'right' },
};

// ---------------------------------------------------------------------------
// 5. THE WINDROPE — two cliff heads and eight tiles of nothing between them.
//    The set-piece is the WIND: it comes up the shaft in gusts, the planks
//    swing under you, and the crossing is the first time the game asks you to
//    keep walking while the ground argues.  The lone beetle waits on open
//    grass on the far side, which is a safe place to learn a fight.
// ---------------------------------------------------------------------------
const bridge = {
  id: 'bridge',
  name: 'The Windrope',
  grid: [2, 1],
  // Both cliff heads bite back from the gap above and below the span, and step
  // out again on a capped corner ('C' east-facing, 'c' west-facing) at the two
  // rows that carry the bridge's anchor posts. The span itself is untouched:
  // the deck's two end tiles have to stay where the stringers are.
  map: [
    'NNNEKKKKKKKKWNNN',
    '...EKKKKKKKKW...',
    '..EKKKKKKKKKKW..',
    '..EKKKKKKKKKKW..',
    '...CKKKKKKKKc...',
    '...DbbbbbbbbD...',
    '...DBBBBBBBBD...',
    '...DmmmmmmmmD...',
    '..EKKKKKKKKKKW..',
    '..EKKKKKKKKKKW..',
    '...CKKKKKKKKc.RR',
    '.RR1KKKKKKKK4RFF',
    'RFF2KKKKKKKK5FLL',
    'FLL3KKKKKKKK6LKK',
  ],
  sway: [64, 80, 128, 48],
  // The gust: a shove every three and a half seconds, telegraphed by the rope
  // starting to swing. It comes up the shaft and blows ACROSS the span
  // (`axis: 'y'`), so it walks you into the hand-rope rather than hurrying you
  // along the crossing. It cannot kill you. The walkable band between the
  // ropes is 28px; a full slug moves you about 19 of them.
  wind: { period: 100, warn: 24, push: 36, power: 0.75, axis: 'y' },
  // A lesser isle turning far below the span, and a hauler further out. The
  // gap has to have SCALE in it or eight tiles of blue is just a river.
  voidProps: [
    { sprite: 'islet_far', x: 90, y: 152, drift: 0.014, bob: 210 },
    { sprite: 'skiff_far', x: 128, y: 40, drift: 0.055, bob: 90, phase: 1.2 },
    { sprite: 'islet_mid', x: 152, y: 58, drift: 0.010, bob: 250, phase: 0.4 },
    { sprite: 'islet_tiny', x: 172, y: 18, drift: 0.007, bob: 300, phase: 1.9 },
    { sprite: 'skiff_tiny', x: 76, y: 136, drift: 0.030, bob: 170, phase: 2.5 },
  ],
  path: [[0, 5, 2, 7], [13, 5, 15, 7], [13, 3, 15, 5]],
  dark: [[0, 1, 1, 3], [13, 8, 14, 9]],
  solids: [
    ['post', 2, 4], ['post', 1, 8], ['post', 13, 4], ['post', 14, 8],
    ['rock', 0, 9], ['rock_small', 1, 10], ['rock', 15, 10],
    ['barrel', 0, 10], ['crate', 14, 10],
    ['rope_coil', 0, 6],
  ],
  flat: [
    ['pebbles', 1, 5], ['pebbles', 14, 7],
    ['tallgrass', 0, 3], ['tallgrass2', 2, 10], ['tallgrass3', 15, 8],
    ['tallgrass', 13, 10], ['tallgrass2', 1, 1], ['tallgrass3', 14, 2],
  ],
  bushes: [[0, 8], [1, 9], [1, 2], [1, 3], [15, 9], [13, 10], [14, 2, 'cog']],
  // ONE beetle, on flat open grass three tiles wide, with the bridge behind
  // you and nothing to back into. This is where the approach-strike-back-off
  // rhythm is meant to be learned.
  enemies: [{ kind: 'beetle', c: 14, r: 6, dir: 'left' }],
  signs: [{
    c: 1, r: 4,
    text: 'THE WINDROPE\nOne at a time.\nSixty feet, and it swings.',
  }],
  flowers: [
    ['w', 8, 24], ['r', 20, 34], ['w', 232, 30], ['r', 244, 42],
    ['w', 14, 168], ['r', 226, 168],
  ],
  animated: [
    { kind: 'gull', x: 0, y: 60, phase: 0, speed: 0.38, dir: 'right' },
    { kind: 'gull', x: 0, y: 140, phase: 90, speed: 0.26, dir: 'right' },
  ],
  spawn: { x: 8, y: 96, dir: 'right' },
};

// ---------------------------------------------------------------------------
// 6. THE PUMP TERRACE — a flagstone apron laid round a pumping mill, cut into
//    a rough oval so the paving has a silhouette instead of being a grey
//    rectangle.  Two beetles patrol it: the first time you fight more than one.
// ---------------------------------------------------------------------------
const terrace = {
  id: 'terrace',
  name: 'Pump Terrace',
  grid: [3, 1],
  // The east rim crosses three tile columns: a shelf out at rows 2-4, a bite in
  // at 7-8, the widest shelf at 9-10. 'C' caps a shelf that steps out; a shelf
  // that steps in gets the rock underhang.
  map: [
    '...........EKKKK',
    '....SSSS...EKKKK',
    '...SSSSSSS..CKKK',
    '..SSSSSSSSS.EKKK',
    '..SSSSSSSSS.EKKK',
    '..SSSSSSSSSEKKKK',
    '...SSSSSSSSEKKKK',
    '...SSSSSS.EKKKKK',
    '....SSSS..EKKKKK',
    '...........NCKKK',
    '.......RR...EKKK',
    'RRR...RFFRR1KKKK',
    'FFFRRRFLLFF2KKKK',
    'LLLFFFLKKLL3KKKK',
  ],
  voidProps: [
    { sprite: 'skiff_far', x: 210, y: 150, drift: 0.04, bob: 140 },
    { sprite: 'islet_far', x: 228, y: 58, drift: 0.013, bob: 200, phase: 0.7 },
    { sprite: 'islet_mid', x: 192, y: 110, drift: 0.010, bob: 240, phase: 2.2 },
    { sprite: 'islet_tiny', x: 244, y: 14, drift: 0.007, bob: 290, phase: 1.1 },
  ],
  // In along the rim, up onto the terrace by its west lip, off the north lip
  // toward the scrap field. The road never crosses the paving in a straight
  // line — the mill is in the way, which is the point of the mill.
  path: [[0, 5, 2, 7], [0, 7, 2, 9], [3, 9, 6, 10], [4, 10, 6, 13], [4, 0, 6, 1]],
  // The NW shade used to cover cols 0-2 rows 1-2, which is exactly where the
  // cache chest now sits. A chest the player is meant to spot from the road
  // does not get parked in the one shadow on the screen.
  dark: [[8, 9, 10, 11], [1, 1, 2, 1], [12, 6, 12, 6]],
  built: [['windmill_small', 130, 32]],
  solids: [
    ['vent', 10, 6], ['post', 2, 8], ['post', 10, 1],
    ['rock', 1, 10], ['rock_small', 2, 11], ['rock', 8, 12],
    ['rock', 0, 0], ['rock_small', 1, 1],
    ['crate', 3, 2], ['barrel', 3, 3], ['crate', 2, 2],
    ['fence', 0, 9], ['fence', 1, 9], ['fence', 2, 9],
    ['barrel', 9, 10], ['crate', 10, 10],
    ['scrap2f', 9, 2], ['scrap1f', 10, 2],
  ],
  flat: [
    ['pebbles', 3, 8], ['pebbles', 5, 11], ['pebbles', 5, 1],
    ['tallgrass', 0, 4], ['tallgrass2', 1, 12], ['tallgrass3', 9, 9],
    ['tallgrass', 2, 0], ['tallgrass2', 9, 9], ['tallgrass3', 7, 11],
    ['tallgrass', 7, 9], ['tallgrass2', 0, 6], ['tallgrass3', 3, 12],
  ],
  bushes: [
    // (0,2) is the cache below; (0,4)/(1,4) are its stopper — see chests.
    [0, 4], [1, 4],
    [1, 2], [1, 3], [0, 11], [1, 11], [9, 11], [10, 9], [7, 0, 'cog'],
    [10, 10], [2, 12], [3, 11], [11, 2], [11, 3], [11, 4],
  ],
  pots: [[3, 6], [7, 2], [9, 7], [8, 4]],
  chests: [
    // THE SECOND REHEARSAL. Two screens before the Boiler Key asks the same
    // question for keeps, the sentence is put to the player again where
    // getting it wrong costs nothing: walk up the west strip off the road and
    // there is a chest three tiles ahead of you, in plain sight, with two
    // bushes across the way in and rock on every other side. Cut, walk, open.
    // Same grammar as the Hollow's cache and the same grammar the rim nook is
    // written in — green is the way through, grey is not.
    {
      c: 0, r: 2, give: 'cogs:50',
      text: 'Fifty cogs in oilcloth, corked\ninto a pipe end. Somebody\nplanned to need it.',
    },
    // The other one is round the far side of the mill from the road: you have
    // to walk the terrace to see it.
    { c: 8, r: 5, give: 'cogs:20', text: 'Twenty cogs and a wage\ndocket. The docket says forty.' },
  ],
  enemies: [
    { kind: 'beetle', c: 5, r: 6, dir: 'left' },
    { kind: 'beetle', c: 8, r: 3, dir: 'down' },
    // THE STEAM SLIME STARTS AT THE VENT. It is the one creature on the isle
    // that is not machinery, and the fiction has to say where it came from:
    // this one sits on the paving right beside the terrace's steam vent at
    // (10,6), so the first one the player ever meets is standing in the thing
    // it is made of. Where it starts is NOT a leash — it roams the screen the
    // way the beetles do, because a creature that
    // cannot follow you is scenery: at 40px a hop with 60-140 idle frames
    // between them it averages 0.4 px/frame against Wren's 1.5, so it can lean
    // at you without ever cornering you.
    { kind: 'slime', c: 9, r: 6 },
  ],
  signs: [{
    c: 2, r: 5,
    text: 'PUMP TERRACE\nKeep the paving clear.\nThe mill turns without asking.',
  }],
  // The pump house draws a black doorway, so it has to answer when you walk
  // into it and press the button. Every drawn door on the isle now does.
  notices: [{
    px: [144, 74, 16, 18],
    text: ['The pump house is padlocked\nand humming. Whatever is in\nthere is still working.',
      'A BRASS TAG ON THE LOCK\n"COGWICK PUMP No.1.\nKey with the keeper."'],
  }],
  flowers: [
    ['w', 16, 26], ['r', 26, 16], ['w', 168, 150], ['r', 180, 160],
    ['w', 30, 190], ['r', 44, 178], ['w', 8, 118], ['r', 150, 20],
  ],
  animated: [
    // the wheel turns on the gantry bolted to the pump house's ridge
    { kind: 'vanes', x: 135, y: 21, sprite: 'vanes_small', speed: 6 },
    { kind: 'puff', x: 158, y: 40, phase: 0, period: 96 },
  ],
  spawn: { x: 8, y: 96, dir: 'right' },
};

// ---------------------------------------------------------------------------
// 7. THE SCRAP FIELD — everything the Boilerworks ever spat out, stacked in
//    heaps.  You come up from the terrace into an open yard where a SINGLE
//    gear-bat is circling: the bat gets a screen to itself before it is ever
//    asked to share one with beetles.  The heaps split the field in two; the
//    beetles are on the far side of them.
// ---------------------------------------------------------------------------
const scrapfield = {
  id: 'scrapfield',
  name: 'The Scrap Field',
  grid: [3, 0],
  // The north rim is a whole tile of OPEN SKY above the lip, not the eight
  // pixels the rim tile carries on its own: this was the one screen of nine
  // with no visible drop anywhere in frame, on a sky island.
  // BOTH TOP CORNERS ARE GONE. The rim used to run dead straight from column 0
  // to column 15 and the field behind it was a perfect rectangle; now it opens
  // out in three steps at each end, which is what puts real sky on the one
  // screen that had almost none and gives the tip its own silhouette.
  map: [
    'KKKKKKKKKKKKKKKK',
    'KKKNNNKKKKNNNKKK',
    'KKN...NNNN...NKK',
    'KN............NK',
    'N..............N',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  voidProps: [
    { sprite: 'skiff_far', x: 150, y: 2, drift: 0.05, bob: 150 },
    { sprite: 'islet_mid', x: 34, y: 6, drift: 0.009, bob: 250, phase: 1.6 },
    { sprite: 'islet_tiny', x: 216, y: 10, drift: 0.007, bob: 290, phase: 0.3 },
  ],
  // The fork the sign talks about: up from the terrace, then west to the rim
  // or east to the works. The junction is a widened apron, not a crossroads.
  path: [[5, 8, 6, 13], [4, 6, 9, 8], [0, 5, 5, 6], [9, 5, 15, 6]],
  dark: [[9, 3, 12, 4], [1, 9, 4, 12], [12, 9, 14, 11]],
  solids: [
    ['rock', 0, 8], ['rock_small', 1, 7], ['rock', 12, 4],
    ['rock', 7, 12], ['rock_small', 8, 11],
    ['barrel', 7, 10], ['crate', 8, 10],
    ['post', 4, 4], ['post', 9, 4], ['post', 13, 4],
    ['barrel', 4, 3], ['crate', 5, 3],
    ['fence', 13, 7], ['fence', 14, 7], ['fence', 15, 7],
  ],
  // THE HEAPS COME OFF THE TILE GRID. Every scrap heap used to sit on an exact
  // 16px lattice, which is what turned the lower-right quadrant into wallpaper:
  // the same three sprites stamped in a rectangle. `built` takes PIXEL
  // coordinates, so the same heaps now land 2-5px off the grid in both axes and
  // pile into each other. Every offset is small enough that no gap between two
  // footprints reaches the player's 12x10 feet box, so nothing that was walled
  // is walkable now.
  built: [
    // the tip by the works gate
    ['scrap1', 129, 35], ['scrap2f', 147, 30], ['scrap3', 142, 49],
    ['scrap1f', 164, 36],
    // the west heap
    ['scrap2', 30, 163], ['scrap1f', 51, 158], ['scrap3f', 34, 179],
    ['scrap1', 13, 176],
    // the east heap
    ['scrap1f', 195, 162], ['scrap3', 210, 145], ['scrap2f', 211, 161],
    // the ridge of junk that halves the field: the bat's yard is south of it
    ['scrap2f', 30, 131], ['scrap1', 51, 126], ['scrap3f', 130, 145],
    ['scrap1f', 147, 140], ['scrap2', 163, 146], ['scrap3', 179, 163],
    // THE SOUTH-EAST LIP. This used to be a BARRICADE: two rows of five at a
    // 15-17px pitch, nearest-neighbour mean 17.2px with sd 2.3 — a CV of 0.13,
    // which is a lattice, not a scatter — and it walled off a pocket with
    // nothing in it. It is three heaps now, of four, three and three, each
    // piled into itself with real overlaps, with two walkable gaps between
    // them; and the lip they used to seal has a chest on it, so the gaps lead
    // somewhere and the heaps read as spoil rather than as fence.
    // Spacing inside a heap is deliberately UNEVEN as well: two pieces almost
    // on top of each other and a third thrown 16px clear reads as tipping;
    // three pieces at a constant 11px reads as a fill loop with a smaller
    // period. Nearest-neighbour CV across all 27 props on the screen: 0.25,
    // against 0.13 for the lattice this replaced.
    ['scrap2', 170, 185], ['scrap1f', 176, 189], ['scrap3', 183, 199],
    ['scrap1', 168, 203],
    ['scrap1', 213, 190], ['scrap3f', 218, 200], ['scrap2', 207, 208],
    ['scrap2f', 239, 192], ['scrap3', 244, 197], ['scrap1', 233, 209],
  ],
  flat: [
    ['pebbles', 2, 5], ['pebbles', 9, 6], ['pebbles', 5, 10], ['pebbles', 5, 12],
    ['pebbles', 12, 5], ['pebbles', 6, 7],
    ['tallgrass', 4, 2], ['tallgrass2', 13, 6], ['tallgrass3', 3, 7],
    ['tallgrass', 10, 8], ['tallgrass2', 14, 5], ['tallgrass3', 8, 12],
    ['tallgrass', 3, 3], ['tallgrass2', 9, 10], ['tallgrass3', 11, 4],
    ['tallgrass', 6, 3], ['tallgrass2', 4, 13], ['tallgrass3', 0, 12],
  ],
  bushes: [
    [1, 6], [2, 6], [2, 5], [13, 6], [14, 6], [14, 5], [3, 2, 'cog'],
    [9, 12], [10, 12], [10, 11], [2, 7], [11, 7], [3, 12], [4, 11],
    [15, 8], [14, 9], [8, 13], [9, 13], [6, 3], [7, 3], [6, 4],
  ],
  pots: [[6, 3], [7, 3], [10, 10], [4, 9]],
  // The south-east lip is fenced off at the top and thorned off at the side,
  // and until now it held nothing at all — a walled pocket with no reason to
  // exist. Cut your way in and there is something in it.
  chests: [{
    c: 14, r: 11, give: 'cogs:40',
    text: 'Forty cogs in a tool roll.\nEvery loop full except the\none that held the spanner.',
  }],
  enemies: [
    // one bat, alone, in the yard you walk into
    { kind: 'bat', c: 8, r: 11, bounds: { x0: 48, y0: 144, x1: 200, y1: 208 } },
    // the beetles are past the ridge
    { kind: 'beetle', c: 3, r: 4, dir: 'right' },
    { kind: 'beetle', c: 11, r: 4, dir: 'left' },
    // TWO SLIMES IN THE SPOIL, one at each end of the field, off the bat's
    // yard so no pocket has to answer two different fights at once. This is
    // the screen where the isle's machinery has been tipped out to rot, and a
    // thing that condenses out of a leaking pipe belongs in it more than
    // another walking beetle would. They are also the reason the field reads
    // differently from the terrace: three kinds on one board. Start cells come
    // off the real free-cell map (tools/critic/r18-slimecells.js) — the north
    // pocket under the tip by the works gate, and the clear corridor along
    // row 8 between the ridge and the east heap.
    { kind: 'slime', c: 8, r: 3 },
    { kind: 'slime', c: 11, r: 8 },
  ],
  signs: [{
    c: 7, r: 7,
    text: 'SCRAP FIELD\nWest: the rim. Nothing there.\nEast: the works. Gate is locked.',
  }],
  flowers: [
    ['w', 22, 100], ['r', 34, 110], ['w', 214, 118], ['r', 226, 128],
    ['w', 120, 60], ['r', 132, 70],
  ],
  animated: [
    { kind: 'puff', x: 130, y: 30, phase: 30, period: 120 },
    // something crossing the strip of sky over the rim, so the one screen
    // with barely any void still has something moving in what it has
    { kind: 'gull', x: 0, y: 2, phase: 0, speed: 0.4, dir: 'right' },
  ],
  spawn: { x: 88, y: 180, dir: 'up' },
};

// ---------------------------------------------------------------------------
// 8. THE RIM NOOK — the sign says there is nothing here, which is how you
//    know there is.  The Boiler Key sits in a rock pocket stoppered by one
//    bush; the piece of heart is walled into the thicket on the brink, three
//    staggered hedgerows deep, where you cannot see it from the path.
// ---------------------------------------------------------------------------
const cliffnook = {
  id: 'cliffnook',
  name: 'The Rim Nook',
  grid: [2, 0],
  // A BITE OUT OF THE WEST RIM. Two tiles deep at rows 2-3, one at row 9;
  // 'c' and 'N' cap the tiles the rim steps back OUT over, and the rock
  // underhang carries the tiles it steps back IN under.
  map: [
    'cNNNNNNNNNNNNNNN',
    'W...............',
    'KKW.............',
    'KKW.............',
    'cN..............',
    'W...............',
    'W...............',
    'W...............',
    'W...............',
    'KW..............',
    'cRRR............',
    '4FFFRRRR..RRRRRR',
    '5LLLFFFFRRFFFFFF',
    '6KKKLLLLFFLLLLLL',
  ],
  // The rim nook shows barely a tile of sky, so its ladder is two of the
  // smallest objects on the isle, in the two notches that show any.
  voidProps: [
    { sprite: 'islet_tiny', x: 14, y: 38, drift: 0.008, bob: 240, phase: 0.5 },
    { sprite: 'skiff_tiny', x: 4, y: 150, drift: 0.026, bob: 280, phase: 2.0 },
  ],
  path: [[6, 5, 15, 6], [5, 2, 6, 6], [3, 2, 6, 3]],
  dark: [[1, 1, 3, 1], [9, 8, 12, 10], [12, 1, 14, 2]],
  // The rock pocket that holds the Boiler Key, and NOTHING else on a lattice.
  // The west side used to be twelve rocks and three pots on a strict two-tile
  // grid — a fill loop, not a rim. `built` is pixel coordinates, so the pocket
  // walls now sit 3-6px off the grid and lean into each other, and the loose
  // rock elsewhere comes in groups of two and three with real gaps between.
  solids: [
    ['post', 9, 1], ['post', 7, 4],
  ],
  built: [
    // THE POCKET IS A GREY RING WITH A GREEN DOOR IN IT. It used to be a rock
    // ring with the bushes tucked into its NORTH-WEST shoulder, one tile off
    // the line the road actually ends on — so the first cut a player made,
    // standing at the end of the road facing down, opened onto the ROCK at
    // tile (3,5) and read as a dead end. A playtester lost a whole session to
    // that: he could see the chest, cut once, hit stone, and concluded the
    // pocket had no entrance. It has one, and it is now the only thing on this
    // face that is not stone: column 3 runs bush, bush, chest, straight down
    // from where the road stops, and every other tile round the pocket is
    // grey. The rock that used to sit at (3,5) is gone (see bushes below).
    ['rock', 20, 82],
    ['rock', 67, 82], ['rock', 65, 98], ['rock', 68, 113],
    ['rock', 19, 130], ['rock', 34, 126], ['rock', 50, 131],
    // The south-east corner stone. Without it the pit's own east wall stops a
    // tile short of the thicket and the chest can be opened from OUTSIDE, by a
    // player standing in the gap and pressing A through the rock — which makes
    // the two bushes decoration.
    ['rock', 66, 128], ['rock', 34, 142],
    // the rim, in twos
    ['rock', 132, 50], ['rock_small', 148, 62],
    ['rock', 244, 18], ['rock_small', 232, 30],
    ['barrel', 66, 19], ['crate', 99, 15],
  ],
  // THE THICKET.  Written out as a little map so it can be READ: '#' is a
  // bush, '.' is a way through, and the heart piece sits in the pocket the
  // bottom row closes.  Nothing lines up row to row, so it reads as scrub
  // that grew over the rim rather than three rows of a spreadsheet.
  //
  //   cols   5  6  7  8  9 10 11 12 13 14 15
  //   row 7  #  #  .  .  #  #  #  .  .  #  #
  //   row 8  #  .  .  #  #  .  .  .  #  #  .
  //   row 9  .  .  #  #  .  .  #  #  #  .  #
  //   row10  #  #  #  .  .  #  #  #  <3 #  #
  bushes: [
    // THE DOOR. The road dies at tile (3,3); face down from there and these
    // are the next two tiles, with the chest in plain sight behind them the
    // whole time. Two cuts, one heading, no corner to turn — the old route
    // was cut-down, cut-west, cut-down and the second leg was invisible from
    // where you made the first cut. (2,4)/(2,5) are kept as a second way in
    // for anyone who works round to the west.
    [3, 4], [3, 5, 'none'],                               // the door
    [2, 4], [2, 5, 'none'],                               // the side way in
    [5, 7], [6, 7], [9, 7], [10, 7], [11, 7], [14, 7], [15, 7],
    [5, 8], [8, 8], [9, 8], [13, 8], [14, 8],
    [7, 9], [8, 9], [11, 9], [12, 9], [13, 9], [15, 9],
    [5, 10], [6, 10], [7, 10], [10, 10], [11, 10], [12, 10], [14, 10], [15, 10],
    // the shelf by the path
    [1, 1], [2, 1], [3, 1, 'cog'], [15, 2], [13, 1],
    [7, 2], [8, 2],
  ],
  // Both pots moved off column 3: the door column is the one thing on this
  // face the player is meant to walk straight down, and a pot standing in it
  // is one more object to mistake for a wall.
  pots: [[1, 7], [2, 7], [5, 1]],
  // The nook held the Boiler Key and the piece of heart and NOTHING that
  // objected. One beetle stands in the mouth of the rock pocket, so getting
  // the key costs a fight; one gear-bat works the rim above the thicket, so
  // the heart piece does too.
  enemies: [
    { kind: 'beetle', c: 5, r: 4, dir: 'down' },
    { kind: 'bat', c: 11, r: 8, bounds: { x0: 80, y0: 96, x1: 232, y1: 168 } },
  ],
  // AT THE BOTTOM OF THE DOOR COLUMN, not beside it. The chest used to sit at
  // (2,6), one column west of the two bushes that open the pocket, so a player
  // who cut straight down from the end of the road was never looking at it
  // while they swung. It is now dead ahead of the first cut and stays in view
  // for both of them.
  chests: [{ c: 3, r: 7, give: 'boilerKey' }],
  hearts: [{ c: 13, r: 10 }],
  flat: [
    ['pebbles', 11, 2], ['pebbles', 13, 2], ['pebbles', 6, 4],
    ['tallgrass', 5, 4], ['tallgrass2', 9, 0], ['tallgrass3', 2, 9],
    ['tallgrass', 12, 1], ['tallgrass2', 6, 3], ['tallgrass3', 14, 11],
    ['tallgrass', 6, 8], ['tallgrass2', 7, 11], ['tallgrass3', 1, 6],
  ],
  signs: [
    {
      c: 10, r: 1,
      text: 'RIM PATH. NO FENCE.\nWalk it on the inside.\nSomeone hid something here.',
    },
    // The second half of the hook, stood where the road stops and the pocket
    // starts. The first sign says something is hidden; this one says which
    // side of the pit was never stone. It does not say "press A" — the player
    // has already cut the Thornwrack shut across the Windrope road to get
    // this far, so the verb is known and only the target needs naming.
    {
      c: 4, r: 4,
      text: 'SPOIL PIT\nWalled with rock on three\nsides. The fourth grew over.',
    },
  ],
  flowers: [
    ['w', 26, 20], ['r', 38, 30], ['w', 200, 40], ['r', 212, 30],
    ['w', 60, 178], ['r', 74, 168],
  ],
  animated: [{ kind: 'gull', x: 0, y: 176, phase: 20, speed: 0.33, dir: 'right' }],
  spawn: { x: 220, y: 88, dir: 'left' },
};

// ---------------------------------------------------------------------------
// 9. THE BOILERWORKS MOUTH — a riveted causeway over open sky, a gear-gate
//    across it, and the arch itself breathing steam at the far end.
// ---------------------------------------------------------------------------
const mouth = {
  id: 'mouth',
  name: 'Boilerworks Mouth',
  grid: [4, 0],
  // The shaft the causeway crosses is not a slot: it opens out above and below
  // the plate, and the two heads step back over it on capped corners.
  map: [
    'NNNNNEKKKKWNNNNN',
    '......CKKKW.....',
    '....EKKKKKKW....',
    '....EKKKKKKW....',
    '.....CKKKKc.....',
    '.....TTTTTT.....',
    '.....TTTTTT.....',
    '.....TTTTTT.....',
    '.....EKKKKW.....',
    '....EKKKKKKW....',
    '.....CKKKKc...RR',
    '..RR1KKKKKK4RRFF',
    'RRFF2KKKKKK5FFLL',
    'FFLL3KKKKKK6LLKK',
  ],
  voidProps: [
    { sprite: 'islet_far', x: 118, y: 160, drift: 0.012, bob: 190 },
    { sprite: 'skiff_far', x: 122, y: 30, drift: 0.06, bob: 110, phase: 2.1 },
    { sprite: 'islet_mid', x: 96, y: 74, drift: 0.010, bob: 240, phase: 1.3 },
    { sprite: 'islet_tiny', x: 140, y: 12, drift: 0.007, bob: 290, phase: 2.6 },
    { sprite: 'skiff_tiny', x: 100, y: 192, drift: 0.030, bob: 160, phase: 0.2 },
  ],
  path: [[0, 5, 4, 7], [11, 5, 13, 7], [1, 7, 3, 9], [13, 3, 15, 5]],
  dark: [[1, 1, 3, 3], [12, 9, 14, 10]],
  built: [
    ['mouth', 176, 48],
    ['pipe_h', 192, 24], ['pipe_h', 208, 24], ['pipe_cap', 224, 24],
  ],
  solids: [
    ['post', 4, 4], ['post', 4, 8], ['post', 11, 4], ['post', 11, 8],
    // The west lip is the ARRIVAL corridor from the scrap field: nothing
    // uncuttable stands in the band the scroll drops Wren into.
    ['rock', 0, 4], ['rock_small', 1, 2], ['rock', 15, 2],
    ['barrel', 2, 1], ['crate', 1, 1], ['crate', 2, 9],
    ['scrap1f', 13, 3], ['scrap2', 14, 3], ['scrap3f', 13, 1],
  ],
  gates: [{ c: 5, r: 5 }],
  flat: [
    ['pebbles', 2, 5], ['pebbles', 12, 7],
    ['tallgrass', 0, 3], ['tallgrass2', 3, 10], ['tallgrass3', 15, 5],
    ['tallgrass', 13, 10], ['tallgrass2', 1, 2],
  ],
  bushes: [[0, 10], [1, 10], [2, 2], [15, 8], [14, 9], [3, 1, 'cog']],
  // The causeway is a three-tile corridor with a two-mile drop either side, so
  // the beetle standing at the far end of it is the one enemy on the isle you
  // cannot simply outwalk: its jet owns the middle lane the whole crossing.
  enemies: [
    { kind: 'beetle', c: 2, r: 9, dir: 'up' },
    { kind: 'bat', c: 1, r: 3 },
    { kind: 'beetle', c: 9, r: 6, dir: 'left' },
    // The last thing between the causeway and the stair, on the east landing
    // where the arch is breathing steam over your head (the two `puff`s
    // below). It can hop the last plates of the causeway but not onto the
    // stair, so it argues with the crossing without owning it.
    // Bounded to the east head only. With no bounds it hops the whole
    // causeway and lands inside the closed gear-gate's 48x48 collider
    // (measured: 2 of 24 hops, tools/critic/r18-slime.js). The other three
    // slimes roam their whole screen; this one has a hole in the isle and a
    // shut gate either side of it, so it gets a leash.
    { kind: 'slime', c: 11, r: 7, bounds: { x0: 144, y0: 80, x1: 224, y1: 128 } },
  ],
  signs: [{
    c: 3, r: 4, kind: 'hatch',
  }],
  portal: { x: 194, y: 92, w: 36, h: 34, to: 'boilerworks' },
  flowers: [
    ['w', 10, 26], ['r', 22, 36], ['w', 236, 30], ['r', 226, 44],
    ['w', 16, 172], ['r', 232, 174],
  ],
  animated: [
    { kind: 'puff', x: 178, y: 54, phase: 0, period: 84 },
    { kind: 'puff', x: 230, y: 54, phase: 42, period: 84 },
    { kind: 'gull', x: 0, y: 150, phase: 10, speed: 0.3, dir: 'right' },
  ],
  spawn: { x: 24, y: 92, dir: 'right' },
};

// ---------------------------------------------------------------------------
// INTERIORS.  Same 16x14 board; a coursed ashlar wall band at the top, plank
// floor below, and a doorway gap on the bottom row that leads back out.
//
// The first pass shipped rooms whose dominant colour was the black surround
// and whose texture measured an order of magnitude under the ALttP floor: a
// wall, a floor, four pots.  These are DRESSED — stock on shelves, a lit
// window throwing a pool on the boards, a rug, a stove, hanging lamps.  A
// shopkeeper has to have something to sell.
// ---------------------------------------------------------------------------
const shopInterior = {
  id: 'shop',
  name: "Hesper's",
  interior: true,
  from: { screen: 'villagew', x: 57, y: 62, dir: 'down' },
  // FULL BLEED. A one-tile black surround was 25% of the screen and the
  // single most-used colour in the room. ALttP fills its interiors.
  map: [
    'hhhhhhhhhhhhhhhh',
    'HHHHHHHHHHHHHHHH',
    'HHHHHvHHHHvHHHHH',
    'HHHHHHHHHHHHHHHH',
    'jjjjjjjjjjjjjjjj',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  // Daylight falls in from the shopfront window and lands on the boards; the
  // rug sits where a customer stands.
  flatpx: [
    ['lightpool', 74, 76], ['rug_s', 100, 150],
  ],
  built: [
    ['shelf', 26, 34], ['shelf_s', 190, 34],
    ['lamp', 74, 26], ['lamp', 170, 26],
    // `built` is PIXEL coordinates; `solids` below is tile coordinates.
    ['jarrack', 14, 74], ['jarrack', 178, 74],
  ],
  // The counter: a run of plank tops Wren talks over, with the stock behind.
  // The RACK is what makes this a shop rather than a room with a counter in
  // it: two rails of jars, in the game's own heart red and brass gold, at eye
  // height behind the till. Hesper now visibly has something to sell.
  solids: [
    ['counter', 3, 7], ['counter', 4, 7], ['counter', 5, 7], ['counter', 6, 7],
    ['counter', 9, 7], ['counter', 10, 7], ['counter', 11, 7], ['counter', 12, 7],
    ['sack', 1, 10], ['sack', 2, 11], ['sack', 1, 12],
    ['barrel', 13, 10], ['crate', 14, 11],
    ['crate', 12, 11], ['barrel', 3, 5], ['crate', 12, 5],
  ],
  pots: [[13, 9], [5, 11], [6, 12]],
  npcs: [{ kind: 'hesper', c: 7, r: 5, facing: 'down', px: [116, 88] }],
  signs: [{
    c: 9, r: 10,
    text: 'A CHALKED BOARD\n"Jar 30 cogs. Charm 100.\nNo credit. Not even now."',
  }],
  doors: [{ c: 7, r: 13, dx: 0, dy: 2, w: 32, h: 12, to: 'villagew', kind: 'exit' }],
  spawn: { x: 120, y: 184, dir: 'up' },
};

const homeInterior = {
  id: 'home',
  name: 'A Home',
  interior: true,
  // A cottage, not a shopfront: lime plaster over a timber frame, and the
  // boards run front-to-back.
  wall: 'plaster',
  floor: 'v',
  from: { screen: 'villagew', x: 185, y: 68, dir: 'down' },
  // FULL BLEED. A one-tile black surround was 25% of the screen and the
  // single most-used colour in the room. ALttP fills its interiors.
  map: [
    'hhhhhhhhhhhhhhhh',
    'HHHHHHHHHHHHHHHH',
    'HHHHHvHHHHvHHHHH',
    'HHHHHHHHHHHHHHHH',
    'jjjjjjjjjjjjjjjj',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
    'DDDDDDDDDDDDDDDD',
  ],
  flatpx: [['lightpool', 74, 76], ['rug', 84, 148]],
  built: [
    ['shelf_s', 22, 34], ['lamp', 128, 26],
    ['bed', 6, 84], ['hearth', 200, 72],
    ['table', 94, 108], ['chair', 80, 112], ['chairR', 132, 112],
    ['dresser', 148, 76],
  ],
  // SOMEBODY LIVED HERE. A bed under the window, a table laid for one with two
  // chairs at it, a dresser with the plates still stood on edge, and a hearth
  // that is still lit — the note pinned to the table says they went up to
  // Thistlecap, and the room has to look like they left in the middle of the
  // week rather than like a storeroom with a rug in it.
  solids: [
    ['crate', 1, 6], ['barrel', 14, 12],
    ['sack', 13, 11], ['barrel', 3, 5],
  ],
  pots: [[4, 12], [11, 6], [1, 11]],
  chests: [{ c: 9, r: 7, give: 'cogs:30', text: 'Thirty cogs in a jar marked\nRENT. Paid up to the day\nthey left.' }],
  signs: [{
    c: 4, r: 7,
    text: 'A NOTE, PINNED TO THE TABLE\n"Gone up to Thistlecap.\nTake the pots. Yours, B."',
  }],
  doors: [{ c: 7, r: 13, dx: 0, dy: 2, w: 32, h: 12, to: 'villagew', kind: 'exit' }],
  spawn: { x: 120, y: 184, dir: 'up' },
};

// The mill floor. STORY.md's locked-house-for-later is a promise; the mill is
// the payment now — one room, one working machine, and the reason the isle's
// pumps still run with the liftstone gone.
const millInterior = {
  id: 'mill',
  name: 'The Mill Floor',
  interior: true,
  from: { screen: 'villagee', x: 213, y: 86, dir: 'down' },
  // THE FLOOR IS THE POINT. A pump house does not stand on the shop's planks;
  // it stands on riveted plate, the same causeway plate the Boilerworks
  // approach is laid with. One character in the map does more to separate this
  // room from the other two than any amount of furniture would.
  map: [
    'hhhhhhhhhhhhhhhh',
    'HHHHHHHHHHHHHHHH',
    'HHHHvHHHHHHHHHHH',
    'HHHHHHHHHHHHHHHH',
    'jjjjjjjjjjjjjjjj',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTT',
  ],
  flatpx: [['lightpool_i', 58, 76], ['rug_s', 168, 168]],
  built: [
    ['lamp', 120, 26], ['lamp', 216, 26], ['shelf_s', 40, 34],
    ['millstone', 86, 100], ['hopper', 93, 72], ['geartrain', 18, 132],
  ],
  // The machine the whole village is still living off: the stone, the hopper
  // feeding it, and the gear train off the pump shaft driving the lot.
  solids: [
    ['sack', 12, 10], ['sack', 13, 11], ['sack', 11, 12],
    ['barrel', 12, 6], ['crate', 11, 6], ['crate', 12, 5], ['crate', 14, 12],
    ['barrel', 1, 6], ['crate', 1, 7],
    ['scrap3', 14, 8],
  ],
  pots: [[6, 12], [10, 8], [5, 6], [14, 9]],
  chests: [{ c: 5, r: 7, give: 'cogs:20', text: 'Twenty cogs behind the spare\nvane. A new vane costs sixty.' }],
  // STORY.md's second overworld heart piece. It is down the blind side of the
  // gear train, in the corner of a room most players will walk past entirely —
  // the mill is optional and the mill's back wall is optional twice over.
  hearts: [{ c: 1, r: 11 }],
  signs: [{
    c: 9, r: 7,
    text: 'A BRASS PLAQUE\n"COGWICK PUMP No.2. Keeps\nthe cisterns off the rock."',
  }],
  doors: [{ c: 7, r: 13, dx: 0, dy: 2, w: 32, h: 12, to: 'villagee', kind: 'exit' }],
  spawn: { x: 120, y: 184, dir: 'up' },
};

// ---------------------------------------------------------------------------

export const SCREENS = {
  dock, dockroad, villagew, villagee, bridge, terrace, scrapfield, cliffnook,
  mouth, shop: shopInterior, home: homeInterior, mill: millInterior,
};

export const START = { screen: 'dock', x: 214, y: 92, dir: 'left' };

/** Walk order of the chapter's first half — used by the capture route. */
export const ROUTE = [
  'dock', 'dockroad', 'villagew', 'villagee', 'bridge', 'terrace',
  'scrapfield', 'cliffnook', 'mouth',
];

export default SCREENS;
