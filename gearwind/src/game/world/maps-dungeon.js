// THE BOILERWORKS — room graph, room definitions, and the Room runtime.
//
// Seven rooms plus the boiler-hall boss arena. Every room states a lesson and
// then tests it; there are no corridors.
//
//   B1  entry .......... timed steam vents: hazards have a RHYTHM
//   B2  the nest ....... a locked door and the key that opens it, across a pit
//   B3  map room ....... the map + compass, and the first gear-switch plaque
//   B4  the Cuff ....... 3 tin soldiers, doors slammed; the chest is reachable
//                        from the first frame, so the item lands MID-FIGHT and
//                        the player learns "stagger" against the enemy that
//                        was just beating them
//   B5  gauntlet ....... three gear-switches, one 170-frame window: the Cuff
//                        as a puzzle verb, under a steam-vent timer
//   B6  THE RIVETER .... wall-mounted arm; Cuff chokes its air line, the elbow
//                        drops and the blade gets four windows
//   B7  boiler hall .... two pressure valves behind live steam: snuff, spin,
//                        take the big key. Tin soldiers return — and now they
//                        fold to one blast, which is the payoff
//   BOSS  the cradle ... KETTLEBACK
//
// Map cells (mx,my) drive the ALttP map screen in items.js.

import { TILE } from '../../engine.js';
import {
  makeBoilerworks, buildRoomMap, bakeRoom, DOOR_CELLS, FLOOR_PX,
  SteamVent, GearSwitch, Crate, Chest, Door, TinSoldier, Riveter, DPAL,
  Pillar, PressurePlate,
} from './boilerworks.js';
import { ClockworkBeetle, GearBat, makeEnemySprites } from '../enemies.js';

export const DUNGEON_NAME = 'THE BOILERWORKS';

const px = (c, r) => ({ x: c * TILE, y: r * TILE });

// ---------------------------------------------------------------------------
// Room definitions
// ---------------------------------------------------------------------------

// `blocks` entries are [c, r] or [c, r, w, h] and are SOLID MASONRY — the same
// copper course the room's frame is built from. They are what turns a room
// from a slate box into architecture: corridors you route through, piers that
// break a sightline, alcoves that hide a chest, catwalks that shape a fight.
// Every room below spends 15-25% of its floor on structure.

export const ROOMS = {

  // -- B1 ------------------------------------------------------------- entry
  //
  // LESSON: hazards keep time. The room is a ZIGZAG — two wall stubs offset
  // from each other leave a single 2-tile gap apiece, and a vent bank sits on
  // the far side of each gap. You cannot see the north door from the hatch,
  // and you cannot walk a straight line to it. Bank A fires while bank B
  // rests, so there is always a beat to move on.
  B1: {
    mx: 1, my: 4, entry: true, exit: true,
    floor: 'plate',
    doors: {
      south: { to: null, state: 'open', label: 'up to the hatch' },
      north: { to: 'B2', state: 'open' },
    },
    blocks: [
      [2, 8, 6, 1], [10, 8, 4, 1],   // lower course: gap at c8-9
      [2, 5, 4, 1], [8, 5, 6, 1],    // upper course: gap at c6-7
      [12, 2, 2, 1],                 // NE pier — makes the plaque pocket
      [2, 2, 2, 1], [3, 3, 1, 1],    // the NW alcove: chest at c2r3, floor
      //                                below it at c2r4, bars across c3r4
    ],
    // the belt that carries scrap out of the lower works, running through the
    // zigzag's middle lane: the first thing the player walks on that MOVES
    conveyors: [[2, 6, 12, 1]],
    vents: [
      { c: 8, r: 9, phase: 0 }, { c: 9, r: 9, phase: 75 },
      { c: 6, r: 4, phase: 0 }, { c: 7, r: 4, phase: 75 },
    ],
    // THE CUFF LOOKING BACK. Nothing in the first three rooms could be opened
    // on the way down; this alcove is barred by a gear-switch, so the moment
    // the player has the Cuff the ENTRY room is worth walking back to. Without
    // it the item's promise only ever points forwards.
    // Both fixtures sit at row 3 or lower: rows 0-2 are under the HUD's meter,
    // item box and counters, and a reward the player cannot see is not one.
    switches: [{ c: 2, r: 6, hold: 400, latched: true }],
    cage: { cells: [[3, 4]], chest: { c: 2, r: 3, item: 'cogs' } },
    pillars: [[4, 10], [12, 10]],
    grates: [[5, 11], [13, 2], [2, 11], [13, 11]],
    enemies: [{ kind: 'beetle', c: 11, r: 6, dir: 'left' }],
    plaques: [{
      c: 11, r: 2,
      text: 'BOILERWORKS, LOWER WORKS.\nMIND THE VENTS. THEY KEEP\nTIME BETTER THAN I DO.',
    }],
    gauges: [4, 11],
  },

  // -- B2 ----------------------------------------------------- the beetle nest
  //
  // LESSON: a lock and the key that opens it. A shaft splits the room; the one
  // plate bridge is dead centre. North of it, two masonry shoulders wall the
  // chamber off except through a 4-tile mouth, and the key sits in the far
  // west pocket — so the key is a DETOUR from the locked door, not a pickup on
  // the way to it.
  B2: {
    mx: 1, my: 3, floor: 'plate',
    doors: {
      south: { to: 'B1', state: 'open' },
      north: { to: 'B4', state: 'locked' },
    },
    pits: (() => {
      const out = [];
      for (let c = 2; c <= 13; c++) if (c !== 7 && c !== 8) out.push([c, 7]);
      return out;
    })(),
    blocks: [
      [2, 4, 4, 1], [10, 4, 4, 1],   // shoulders: the chamber mouth is c6-9
      [5, 2, 1, 1], [10, 2, 1, 1],   // piers hanging off the north wall
      [2, 9, 3, 1], [11, 9, 3, 1],   // south approach is a channel
    ],
    enemies: [
      { kind: 'beetle', c: 3, r: 3, dir: 'right' },
      { kind: 'beetle', c: 11, r: 3, dir: 'left' },
      { kind: 'beetle', c: 7, r: 5, dir: 'down' },
    ],
    pickups: [{ kind: 'smallKey', c: 3, r: 2 }],
    pillars: [[6, 10], [9, 10]],
    plaques: [{ c: 12, r: 2, text: 'SMALL KEYS, SMALL LOCKS.\nTHE KEEPER HOLDS THE REST,\nAND THE KEEPER IS ABOVE.' }],
    grates: [[7, 10], [8, 10]],
    gauges: [7, 8],
  },

  // -- B3 --------------------------------------------------------- the map room
  //
  // LESSON: read the room before you walk it. Two piers hang off the north
  // wall to make a proper ALCOVE for the map chest, and a masonry island in
  // the middle means the gear-bats always have something to come round.
  B3: {
    mx: 0, my: 2, floor: 'tread',
    doors: { east: { to: 'B4', state: 'open' } },
    blocks: [
      [6, 2, 1, 3], [9, 2, 1, 3],    // the map alcove: c7-8, r2-4
      [3, 5, 3, 1], [3, 6, 1, 2],    // west L
      [10, 9, 3, 1], [12, 7, 1, 2],  // east L, mirrored and offset
    ],
    chests: [
      { c: 7, r: 2, item: 'map' },
      { c: 12, r: 3, item: 'compass' },
    ],
    enemies: [
      { kind: 'bat', c: 4, r: 9 },
      { kind: 'bat', c: 11, r: 5 },
    ],
    crates: [[6, 7], [8, 9]],
    pillars: [[5, 10], [10, 3]],
    plaques: [{
      c: 3, r: 2,
      text: 'THE WORKS ANSWER TO AIR.\nEVERY GEAR-SWITCH IN HERE\nTURNS ON ONE HARD BLAST.',
    }],
    grates: [[3, 10], [12, 10]],
    gauges: [4, 10],
  },

  // -- B4 ------------------------------------------------------ THE BELLOWS CUFF
  //
  // LESSON: the Cuff, learned against the enemy that is beating you. The chest
  // sits deep in a two-pier alcove at the top of the room and the patrol owns
  // the floor, so the run to the Cuff is a dash through a bottleneck — and the
  // two mid-room piers are the cover you fight from afterwards.
  B4: {
    mx: 1, my: 2, arena: 'tin', floor: 'tread',
    doors: {
      south: { to: 'B2', state: 'open' },
      west: { to: 'B3', state: 'open' },
      east: { to: 'B5', state: 'open' },
    },
    blocks: [
      [6, 2, 1, 2], [9, 2, 1, 2],    // the Cuff alcove: c7-8, r2-3
      [3, 5, 2, 2], [11, 5, 2, 2],   // cover blocks the pikes have to walk round
      [2, 10, 3, 1], [11, 10, 3, 1], // south channel
    ],
    chests: [{ c: 7, r: 2, item: 'cuff' }],
    enemies: [
      { kind: 'tin', c: 3, r: 8, dir: 'right' },
      { kind: 'tin', c: 12, r: 8, dir: 'left' },
      { kind: 'tin', c: 7, r: 9, dir: 'up' },
    ],
    pillars: [[7, 6]],
    grates: [[2, 2], [13, 2]],
    // B3 is a dead end off this room and a first-time player can finish the
    // dungeon without ever opening it. So the west door is SIGNPOSTED, at the
    // one spot every route through B4 walks past.
    plaques: [{
      c: 2, r: 8,
      text: 'CHART ROOM, WEST.\nTAKE THE MAP. IT IS THE ONLY\nONE, SO BRING IT BACK.',
    }],
    gauges: [5, 10],
  },

  // -- B5 ------------------------------------------------------- gear gauntlet
  //
  // LESSON: the Cuff as a LOCK VERB, under a clock. Three switches, a 300
  // frame hold. An inner wall cuts the room in half and the only two ways
  // through it are the vent lanes at c4 and c11 — so the third switch is
  // always on the far side of a hazard you have to read or snuff.
  B5: {
    mx: 2, my: 2, floor: 'slat',
    doors: {
      west: { to: 'B4', state: 'open' },
      north: { to: 'B6', state: 'locked' },
    },
    blocks: [
      [5, 7, 6, 1],                  // the dividing wall: lanes at c2-4, c11-13
      [6, 2, 1, 2], [3, 2, 1, 1],    // north-west alcove wall for the cage
      [11, 2, 3, 1],                 // NE pier
      [6, 10, 1, 1], [9, 10, 1, 1],  // piers flanking the south switch
    ],
    // THE CLOCK. Measured by PLAYING the room (tools/critic/b5clock.js drives
    // the scene's own autopilot and logs every switch's lit frames): the walk
    // south switch -> east vent lane -> NE switch -> NW switch takes 296
    // frames. At the old hold of 300 that is four frames of slack — the route
    // is already tight — but a player who takes it in any other order never
    // finds out, which is what "the clock does not bite" meant.
    //
    // Cage-open frame for the autopilot, by hold: 300 -> 309 (one clean pass,
    // it never learns), 280 -> 573, 260 -> 821, 240 -> 965, 200 -> 4430. The
    // cost of a retry is a second crossing of the vent lanes at c4 and c11,
    // and steam is already the biggest single source of damage in the dungeon
    // — at 260 a full scripted playthrough died twice in this room alone. 280
    // is one failed attempt: enough for the plaque's threat to be true, not
    // enough to turn the puzzle room into a damage room.
    switches: [
      { c: 3, r: 4, hold: 280 },
      { c: 12, r: 4, hold: 280 },
      { c: 7, r: 10, hold: 280 },
    ],
    cage: { cells: [[4, 2], [5, 2]], chest: { c: 4, r: 2, item: 'smallKey' } },
    vents: [
      { c: 4, r: 7, phase: 0, period: 130 },
      { c: 11, r: 7, phase: 65, period: 130 },
    ],
    enemies: [{ kind: 'beetle', c: 8, r: 5, dir: 'left' }],
    conveyors: [[2, 3, 12, 1]],
    crates: [[3, 9], [12, 9]],
    pillars: [[8, 3]],
    plaques: [{ c: 2, r: 2, text: 'THREE SWITCHES, ONE HEAD OF\nPRESSURE. IT BLEEDS OFF IN\nFIVE SECONDS.' }],
    gauges: [7, 8],
  },

  // -- B6 ---------------------------------------------------------- THE RIVETER
  //
  // LESSON: cover. The arm outranges you, so the room gives you four masonry
  // shoulders to break line of fire with — rivets die on solid tiles — and the
  // fight becomes advance / blast / strike / duck.
  B6: {
    mx: 2, my: 1, arena: 'riveter', floor: 'slat',
    doors: {
      south: { to: 'B5', state: 'open' },
      west: { to: 'B7', state: 'open' },
    },
    riveter: { x: 128, y: 40 },
    blocks: [
      [3, 5, 2, 2], [11, 5, 2, 2],   // mid cover
      [5, 9, 2, 1], [9, 9, 2, 1],    // low cover, offset from the mid pair
      [2, 2, 2, 1], [12, 2, 2, 1],   // the arm's own bay
    ],
    grates: [[3, 11], [12, 11]],
    conveyors: [[2, 7, 12, 1]],
    crates: [[7, 8], [8, 8]],
    pillars: [[6, 3], [9, 3]],
    gauges: [4, 11],
  },

  // -- B7 --------------------------------------------------------- boiler hall
  //
  // LESSON: everything the Cuff can do, at once. Two latched valves sit behind
  // live steam — and the west vent NEVER RESTS, so that one has to be snuffed
  // rather than waited out. The big key is caged until both valves are lit AND
  // a crate is blown down the central channel onto the pressure plate.
  B7: {
    mx: 1, my: 1, floor: 'hall',
    doors: {
      east: { to: 'B6', state: 'open' },
      north: { to: 'BOSS', state: 'boss' },
    },
    // The boilers sit at row 3, not row 2: rows 0-2 are where the HUD's steam
    // meter and item box live, and live room content behind the status bar is
    // content the player never sees.
    boilers: [{ c: 2, r: 3 }, { c: 12, r: 3 }],
    conveyors: [[6, 9, 4, 1]],
    blocks: [
      [2, 5, 4, 1], [10, 5, 4, 1],   // machinery bays, boss-door approach at c6-9
      [5, 8, 1, 1], [10, 8, 1, 1],  // piers framing the crate channel
      [2, 11, 2, 1], [12, 11, 2, 1],
    ],
    switches: [
      { c: 3, r: 7, hold: 400, latched: true },
      { c: 12, r: 7, hold: 400, latched: true },
    ],
    vents: [
      // no rest: hiss 6 / jet 54 / period 60. There is no gap to walk through,
      // so this one has to be SNUFFED. It is the room that proves the verb.
      { c: 3, r: 9, phase: 0, period: 60, hiss: 6, jet: 54, relentless: true },
      { c: 12, r: 9, phase: 55, period: 110 },
    ],
    plates: [[7, 10]],
    crates: [[7, 7]],
    cage: { cells: [[4, 3], [5, 3]], chest: { c: 4, r: 3, item: 'bigKey' } },
    enemies: [
      { kind: 'tin', c: 6, r: 6, dir: 'down' },
      { kind: 'tin', c: 9, r: 6, dir: 'down' },
    ],
    // TWO SIGNS, FLANKING THE BOILER-HALL DOOR.
    //
    // Round 21 scanned all 93 player-facing strings in the Boilerworks and found
    // not one in B7 or the BOSS room that names the valve KETTLEBACK's whole
    // fight turns on — which is why bot runs that already knew the answer killed
    // it first try in 5 of 5 seeds while a human reached attempt 11 after 24
    // seconds of zero-damage sword mashing. This is the one thing the dungeon
    // never said out loud.
    //
    // It is said the way the Boilerworks says everything else: as a stamped
    // works rule, phrased as a prohibition, because a prohibition is the oldest
    // way a cartridge tells you what to do. RULE 4 is the verb (cold air into an
    // open valve) and RULE 5, on the arena's own wall, is what the seizure is
    // for (the blade, the cradle). Neither is a tutorial and neither says
    // "KETTLEBACK" — they are maintenance signage that happens to be the answer.
    //
    // Both sit at row 3, in the c6-9 mouth that is the only way to the boss
    // door, so the player walks between them on the way in.
    plaques: [
      {
        c: 6, r: 3,
        text: 'RULE 4. NEVER COOL AN OPEN\nVALVE. COLD AIR SEIZES THE\nWHOLE BOILER SOLID.',
      },
      {
        c: 9, r: 3,
        text: 'THE STONE SITS BELOW THIS\nHALL. IF IT EVER GOES, RUN\nUP. DO NOT COME DOWN HERE.',
      },
    ],
    gauges: [5, 10],
  },

  // -- BOSS -------------------------------------------------------- the cradle
  //
  // A boss arena wants floor, so the structure here is only in the corners —
  // enough to give the charge lanes a shape and to stop the shell-shed spin
  // being a clean circle. The skylight in the north ceiling is the chapter's
  // last shot.
  BOSS: {
    mx: 1, my: 0, arena: 'boss', skylight: true, floor: 'hall',
    doors: { south: { to: 'B7', state: 'open' } },
    cradle: { c: 7, r: 7 },
    blocks: [
      [2, 2, 2, 1], [12, 2, 2, 1],
      [2, 11, 2, 1], [12, 11, 2, 1],
    ],
    vents: [
      { c: 4, r: 4, phase: 0, period: 96 },
      { c: 11, r: 4, phase: 24, period: 96 },
      { c: 4, r: 9, phase: 48, period: 96 },
      { c: 11, r: 9, phase: 72, period: 96 },
    ],
    // RULE 5 — the other half of the answer, on the wall of the room it is for.
    // Bottom-left, against the south wall two tiles clear of the corner pier and
    // three tiles off the door Wren comes in by: on screen from the first frame
    // of the fight, out of the charge lanes, and off the orbit the shell-shed
    // spin rides (centre 128,112 at rx 62 / ry 46 never reaches it).
    plaques: [{
      c: 5, r: 11,
      text: 'RULE 5. A SEIZED BOILER IS\nWORK FOR A BLADE. MIND THE\nCRADLE. IT RUNS WHITE HOT.',
    }],
    gauges: [4, 11],
  },
};

/** Adjacency for the map screen. */
export const MAP_ROOMS = Object.fromEntries(Object.entries(ROOMS).map(([id, d]) => [id, {
  mx: d.mx, my: d.my,
  doors: Object.fromEntries(Object.entries(d.doors || {})
    .filter(([, v]) => v.to).map(([k, v]) => [k, v.to])),
}]));

export const BOSS_ROOM = 'BOSS';
export const ENTRY_ROOM = 'B1';

// ---------------------------------------------------------------------------
// Spawn points: where Wren stands when he walks in through a given door.
// ---------------------------------------------------------------------------
export function spawnAt(side) {
  switch (side) {
    case 'north': return { x: 120, y: 30, dir: 'down' };
    case 'south': return { x: 120, y: 168, dir: 'up' };
    case 'west': return { x: 34, y: 96, dir: 'right' };
    case 'east': return { x: 206, y: 96, dir: 'left' };
    default: return { x: 120, y: 120, dir: 'down' };
  }
}

// ---------------------------------------------------------------------------
// Pickups (small key / heart piece lying on the floor)
// ---------------------------------------------------------------------------
export class Pickup {
  constructor(kind, x, y, img) {
    this.kind = kind; this.x = x; this.y = y; this.img = img;
    this.taken = false; this.t = 0;
  }
  get baseY() { return this.y + 16; }
  rect() { return { x: this.x + 2, y: this.y + 4, w: 12, h: 12 }; }
  update() { this.t++; }
  draw(ctx) {
    if (this.taken) return;
    const bob = ((this.t >> 4) & 1) ? -1 : 0;
    ctx.drawImage(this.img, Math.round(this.x), Math.round(this.y) + bob);
  }
}

// ---------------------------------------------------------------------------
// Room — the live instance of one screen.
// ---------------------------------------------------------------------------

export class Room {
  /**
   * @param {string} id
   * @param {object} deps { tiles, spr, itemSpr, enemySpr, engine, state }
   */
  constructor(id, deps) {
    this.id = id;
    this.def = ROOMS[id];
    this.spr = deps.spr;
    this.itemSpr = deps.itemSpr;
    this.enemySpr = deps.enemySpr;
    this.engine = deps.engine;
    const def = this.def;

    this.map = buildRoomMap(def);
    // A conveyor that does not MOVE is a painted stripe. Four bakes of the
    // same room, one per belt phase, is cheaper than redrawing tiles over the
    // baked cast shadows every frame — and it keeps the shadow pass honest.
    this.layer = bakeRoom(this.map, deps.tiles);
    this.beltLayers = (def.conveyors && def.conveyors.length)
      ? [0, 1, 2, 3].map(p => bakeRoom(this.map, deps.tiles, p))
      : null;

    // --- doors
    this.doors = {};
    for (const [side, d] of Object.entries(def.doors || {})) {
      this.doors[side] = new Door(side, { state: d.state, to: d.to });
    }

    // --- props
    this.vents = (def.vents || []).map(v => new SteamVent(v.c, v.r, v));
    this.switches = (def.switches || []).map(s => new GearSwitch(s.c, s.r, s));
    this.crates = (def.crates || []).map(([c, r]) => new Crate(c, r));
    this.pillars = (def.pillars || []).map(([c, r]) => new Pillar(c, r));
    this.plates = (def.plates || []).map(([c, r]) => new PressurePlate(c, r));
    this.chests = (def.chests || []).map(ch => new Chest(ch.c, ch.r, ch.item));
    this.pickups = (def.pickups || []).map(p =>
      new Pickup(p.kind, p.c * TILE, p.r * TILE, this.itemSpr.smallKey));
    this.plaques = (def.plaques || []).map(p => ({ ...p, x: p.c * TILE, y: p.r * TILE }));

    // --- caged reward
    this.cage = null;
    if (def.cage) {
      const chest = new Chest(def.cage.chest.c, def.cage.chest.r, def.cage.chest.item);
      this.cage = { cells: def.cage.cells, open: false, chest };
      this.chests.push(chest);
    }

    // --- boilers (solid decor)
    this.boilers = (def.boilers || []).map(b => ({ x: b.c * TILE, y: b.r * TILE }));

    // --- enemies
    this.enemies = [];
    for (const e of def.enemies || []) this._spawnEnemy(e);
    this.riveter = null;
    if (def.riveter) {
      this.riveter = new Riveter(def.riveter);
      this.riveter.spr = this.spr;
    }

    this.cleared = false;
    this.sealed = false;
    this._applyCollision();
  }

  _spawnEnemy(e) {
    const p = px(e.c, e.r);
    if (e.kind === 'beetle') {
      const b = new ClockworkBeetle(p.x, p.y, e.dir || 'down');
      b.sprites = this.enemySpr;
      this.enemies.push(b);
    } else if (e.kind === 'bat') {
      const b = new GearBat(p.x, p.y, {
        x0: FLOOR_PX.x + 4, y0: FLOOR_PX.y + 4,
        x1: FLOOR_PX.x + FLOOR_PX.w - 20, y1: FLOOR_PX.y + FLOOR_PX.h - 20,
      });
      b.sprites = this.enemySpr;
      this.enemies.push(b);
    } else if (e.kind === 'tin') {
      const t = new TinSoldier(p.x, p.y - 6, { dir: e.dir, phase: 20 + this.enemies.length * 25 });
      t.spr = this.spr;
      this.enemies.push(t);
    }
  }

  // --- collision ------------------------------------------------------------

  _applyCollision() {
    // doors: passable only when open
    for (const [side, door] of Object.entries(this.doors)) {
      const pass = door.passable;
      for (const [c, r] of DOOR_CELLS[side].cells) this.map.solidGrid[r][c] = !pass;
    }
    // cage bars
    if (this.cage) {
      for (const [c, r] of this.cage.cells) this.map.solidGrid[r][c] = !this.cage.open;
    }
    // rebuild obstacle list from movable props
    this.map.obstacles.length = 0;
    for (const b of this.boilers) {
      this.map.addObstacle(this.spr.boiler, b.x, b.y,
        { x: b.x + 2, y: b.y + 8, w: 28, h: 30 }, b.y + 40);
    }
    for (const c of this.crates) {
      const r = c.rect();
      this.map.addObstacle(this.spr.crate, c.x, c.y, r, c.y + 16);
    }
    for (const ch of this.chests) {
      if (this.cage && ch === this.cage.chest && !this.cage.open) continue;
      this.map.addObstacle(this.spr.chest, ch.x, ch.y, ch.rect(), ch.y + 16);
    }
    for (const s of this.switches) {
      this.map.addObstacle(null, s.x, s.y, s.rect, s.baseY);
    }
    for (const p of this.pillars) {
      this.map.addObstacle(null, p.x, p.y, p.rect(), p.baseY);
    }
  }

  /** True once every switch is lit and every pressure plate is held down. */
  get puzzleSolved() {
    return this.switches.every(s => s.on) && this.plates.every(p => p.down);
  }

  openDoor(side) {
    const d = this.doors[side];
    if (!d) return false;
    const changed = d.openUp();
    this._applyCollision();
    return changed;
  }

  sealDoors() {
    for (const d of Object.values(this.doors)) d.shut();
    this.sealed = true;
    this._applyCollision();
  }

  unsealDoors() {
    for (const d of Object.values(this.doors)) if (d.state === 'shut') d.openUp();
    this.sealed = false;
    this._applyCollision();
  }

  openCage() {
    if (!this.cage || this.cage.open) return false;
    this.cage.open = true;
    this._applyCollision();
    return true;
  }

  /** Which door Wren is standing in, if any (used to change rooms). */
  doorUnder(player) {
    const bx = player.x + 4, by = player.y + 16, bw = 8, bh = 6;
    for (const [side, d] of Object.entries(this.doors)) {
      if (!d.passable || !d.to) continue;
      const z = DOOR_CELLS[side];
      // the trigger is the OUTER tile of the doorway
      // The trigger has to cover the WHOLE half of the doorway nearest the
      // wall, not a sliver at the very edge: the collision box stops Wren
      // with his feet still inside the passage, and a thin trigger there is
      // one he can stand in front of forever.
      let t;
      if (side === 'north') t = { x: z.x, y: z.y, w: 32, h: 20 };
      else if (side === 'south') t = { x: z.x, y: z.y + 12, w: 32, h: 20 };
      else if (side === 'west') t = { x: z.x, y: z.y, w: 20, h: 32 };
      else t = { x: z.x + 12, y: z.y, w: 20, h: 32 };
      if (bx < t.x + t.w && bx + bw > t.x && by < t.y + t.h && by + bh > t.y) return side;
    }
    return null;
  }

  // --- update ---------------------------------------------------------------


  /**
   * PUT THE PUZZLE BLOCKS BACK. ALttP resets a room's shoveable blocks every
   * time you walk into it, and it does that because a shoved block is the one
   * piece of room state a player can put somewhere unrecoverable.
   *
   * Measured in B7: a crate ends one tile right and one tile below the
   * pressure plate, and it can never come back — the spot you would have to
   * stand in to push it up is off the bottom of the room. A scripted
   * playthrough parked there for 12,000 frames. The big key, the boss door
   * and the last third of the chapter are behind that plate.
   */
  resetCrates() {
    (this.def.crates || []).forEach(([c, r], i) => {
      const k = this.crates[i];
      if (!k) return;
      k.x = c * TILE; k.y = r * TILE; k.slide = null;
    });
    for (const p of this.plates) p.update(this.crates);
  }

  update(engine, player, melee) {
    for (const v of this.vents) v.update();
    for (const s of this.switches) s.update();
    for (const c of this.crates) c.update();
    // A door is only walkable once its 18-frame roll-up has FINISHED, so the
    // collision grid has to be re-applied on the frame the animation ends —
    // opening a door and baking collision in the same frame bakes it shut.
    let doorChanged = false;
    for (const d of Object.values(this.doors)) {
      const was = d.passable;
      d.update();
      if (d.passable !== was) doorChanged = true;
    }
    if (doorChanged) this._applyCollision();
    for (const p of this.pickups) p.update();
    let moved = false;
    for (const c of this.crates) if (c.slide) moved = true;
    if (moved) this._applyCollision();
    for (const p of this.plates) p.update(this.crates);

    // EVERY enemy gets the target. ClockworkBeetle.update's third argument is
    // what _aimAt() reads, and dropping it here is why the beetle's whole
    // "stop, turn, spit at Wren's lane" behaviour never ran in the shipping
    // game: with no target _aimAt() returns false on the first line, the walk
    // branch can never wind up at all, and the pause branch falls through to
    // its `engine.rand() < 0.45` fallback and fires in whatever direction the
    // beetle happened to be facing. The room read as three beetles venting at
    // the walls. `bodyC` is the centre of the box _contactDamage actually
    // tests (dungeon.js: p.x+3,p.y+9,10x13), so a jet aimed at it connects.
    const bodyC = { x: player.x + 8, y: player.y + 15 };
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e instanceof GearBat) e.update(engine, this.map, { x: player.x + 8, y: player.y + 12 });
      else if (e instanceof TinSoldier) e.update(engine, this.map, player);
      else e.update(engine, this.map, bodyC);
    }
    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.riveter) this.riveter.update(engine, player, this.map);
  }

  get enemiesAlive() { return this.enemies.filter(e => !e.dead && e.hp > 0).length; }

  // --- draw -----------------------------------------------------------------

  drawGround(ctx) {
    if (this.beltLayers) {
      ctx.drawImage(this.beltLayers[(this.engine.frame >> 3) & 3], 0, 0);
    } else {
      ctx.drawImage(this.layer, 0, 0);
    }
    if (this.def.skylight) drawSkylight(ctx, this.skylight || 0, this.engine.frame);
    if (this.def.cradle) {
      drawCradle(ctx, this.def.cradle.c * TILE, this.def.cradle.r * TILE, this.cradleGlow || 0);
    }
    for (const p of this.plates) p.draw(ctx, this.spr);
    // the vent HARDWARE is part of the room, on screen whether it is firing
    // or not; only the plume is state
    for (const v of this.vents) v.drawFixture(ctx, this.spr);
    for (const g of this.switches) g.draw(ctx, this.spr, this.engine.frame);
    for (const p of this.plaques) ctx.drawImage(this.spr.plaque, p.x, p.y);
    for (const e of this.enemies) if (e.drawShadow) e.drawShadow(ctx);
  }

  /** Everything that y-sorts with the player. */
  sortables() {
    const out = [];
    for (const b of this.boilers) out.push({ baseY: b.y + 40, draw: c => c.drawImage(this.spr.boiler, b.x, b.y) });
    for (const p of this.pillars) out.push({ baseY: p.baseY, draw: cx => p.draw(cx, this.spr) });
    for (const c of this.crates) out.push({ baseY: c.baseY, draw: cx => c.draw(cx, this.spr) });
    // A caged chest still DRAWS — the bars go over it in drawOver(). An empty
    // barred alcove is a locked door with no prize behind it, and nobody comes
    // back for that.
    for (const ch of this.chests) {
      out.push({ baseY: ch.baseY, draw: cx => ch.draw(cx, this.spr) });
    }
    for (const p of this.pickups) {
      if (!p.taken) out.push({ baseY: p.baseY, draw: cx => p.draw(cx) });
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      out.push({ baseY: e.baseY, draw: cx => e.draw(cx, this.engine.frame) });
    }
    return out;
  }

  /** Doors, jets, bars and the Riveter all draw over the actors. */
  drawOver(ctx) {
    for (const d of Object.values(this.doors)) d.draw(ctx, this.spr);
    if (this.cage && !this.cage.open) drawBars(ctx, this.cage.cells);
    if (this.riveter) this.riveter.draw(ctx, this.engine.frame);
    for (const v of this.vents) v.draw(ctx, this.spr);
  }
}

// ---------------------------------------------------------------------------
// Small painted set pieces
// ---------------------------------------------------------------------------

/** Iron bars over a caged alcove. */
function drawBars(ctx, cells) {
  for (const [c, r] of cells) {
    const x = c * TILE, y = r * TILE;
    ctx.fillStyle = DPAL.k;
    ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = DPAL.I;
    for (let i = 1; i < 16; i += 5) ctx.fillRect(x + i, y, 3, 16);
    ctx.fillStyle = DPAL.J;
    for (let i = 1; i < 16; i += 5) ctx.fillRect(x + i, y, 1, 16);
    ctx.fillStyle = DPAL.i;
    ctx.fillRect(x, y + 3, 16, 1);
    ctx.fillRect(x, y + 12, 16, 1);
  }
}

/**
 * The empty liftstone cradle sunk into the boss-room floor.
 *
 * A socket has to have WALLS or it is a painted black rectangle. Reading in
 * from the deck: a scorched rim, a brass collar, then the shaft's far (north)
 * inner wall stepping down through the brass ramp into the dark, side walls
 * one shade each, and the near rim catching the deck's cut edge.
 */
export function drawCradle(ctx, x, y, glow = 0) {
  const X = x - 8, Y = y - 6, W = 32, H = 30;
  // scorch ring burnt into the deck around the socket
  ctx.fillStyle = DPAL.h;
  ctx.fillRect(X - 2, Y - 1, W + 4, H + 3);
  ctx.fillStyle = DPAL.k;
  ctx.fillRect(X, Y, W, H);
  // brass collar
  ctx.fillStyle = DPAL.z; ctx.fillRect(X + 1, Y + 1, W - 2, H - 2);
  ctx.fillStyle = DPAL.b; ctx.fillRect(X + 2, Y + 2, W - 4, H - 4);
  ctx.fillStyle = DPAL.B; ctx.fillRect(X + 2, Y + 2, W - 4, 2);
  ctx.fillStyle = DPAL.z; ctx.fillRect(X + 2, Y + H - 4, W - 4, 2);
  // the shaft
  const ix = X + 5, iy = Y + 5, iw = W - 10, ih = H - 10;
  ctx.fillStyle = DPAL.k; ctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
  ctx.fillStyle = glow > 0 ? DPAL.g : DPAL.x;
  ctx.fillRect(ix, iy, iw, ih);
  if (glow <= 0) {
    // far wall lit, side walls one shade, near rim a cut edge
    ctx.fillStyle = DPAL.S; ctx.fillRect(ix, iy, iw, 3);
    ctx.fillStyle = DPAL.s; ctx.fillRect(ix, iy + 3, iw, 2);
    ctx.fillStyle = DPAL.s; ctx.fillRect(ix, iy, 2, ih); ctx.fillRect(ix + iw - 2, iy, 2, ih);
    ctx.fillStyle = DPAL.d; ctx.fillRect(ix + 2, iy + 5, iw - 4, ih - 7);
    ctx.fillStyle = DPAL.S; ctx.fillRect(ix, iy + ih - 2, iw, 2);
  } else {
    ctx.fillStyle = DPAL.G; ctx.fillRect(ix + 2, iy + 2, iw - 4, ih - 4);
    ctx.fillStyle = DPAL.w; ctx.fillRect(ix + 5, iy + 5, iw - 10, ih - 10);
  }
  // four clamp arms with nothing to hold
  const arm = (ax, ay, w, h) => {
    ctx.fillStyle = DPAL.k; ctx.fillRect(ax - 1, ay - 1, w + 2, h + 2);
    ctx.fillStyle = DPAL.b; ctx.fillRect(ax, ay, w, h);
    ctx.fillStyle = DPAL.B; ctx.fillRect(ax, ay, w, 1);
  };
  arm(X - 3, Y + 12, 4, 6);
  arm(X + W - 1, Y + 12, 4, 6);
  arm(X + 13, Y - 3, 6, 4);
  arm(X + 13, Y + H - 1, 6, 4);
}

/**
 * The boiler hall's SKYLIGHT — a grated shaft in the north ceiling. It is the
 * only daylight in the dungeon, so it is on screen the whole fight; when the
 * shard goes into the cradle it opens to bright sky, and the CARRION WING
 * crosses it. The chapter's last beat is shown, not narrated.
 *
 * @param {number} lit 0 = shut and dim, 1..N = the ending, counting frames
 */
export function drawSkylight(ctx, lit, frame) {
  // 24 px tall: it stops clear of the inner wall's 6px bevel, so the wall
  // still visibly has a bottom edge and the shaft reads as cut through the
  // ceiling above it.
  const X = 5 * TILE, Y = 0, W = 6 * TILE, H = 23;
  ctx.fillStyle = DPAL.k;
  ctx.fillRect(X - 2, Y, W + 4, H + 4);
  ctx.fillStyle = DPAL.z;
  ctx.fillRect(X - 1, Y, W + 2, H + 2);

  // THE SKY. A flat wash crossed by even 4px stripes reads as a venetian
  // blind, which is exactly what the last shot of the chapter must not read
  // as. So: a three-step vertical ramp (deepest at the top of the shaft,
  // brightest at the horizon end) plus soft cloud BANDS at irregular heights
  // and irregular lengths — the two things that make a stripe read as weather.
  const ramp = lit > 0
    ? ['#4c84c4', '#78aee0', '#a8d0f0', '#d8ecfc']
    : [DPAL.d, DPAL.Q, DPAL.f, '#3a4250'];
  const steps = [0, 7, 14, 19];
  steps.forEach((y0, i) => {
    ctx.fillStyle = ramp[i];
    ctx.fillRect(X, Y + y0, W, (steps[i + 1] ?? H) - y0);
  });
  // cloud bands: uneven widths, offset from the value steps so they never
  // line up into a grid
  const clouds = [[3, 4, 34], [22, 9, 20], [56, 6, 30], [10, 16, 42], [70, 18, 22]];
  for (const [cx, cy, cw] of clouds) {
    ctx.fillStyle = lit > 0 ? '#e8f4ff' : '#495364';
    ctx.fillRect(X + cx, Y + cy, cw, 2);
    ctx.fillStyle = lit > 0 ? '#b4d8f4' : '#333c4a';
    ctx.fillRect(X + cx + 3, Y + cy + 2, cw - 6, 1);
  }

  // ---------------------------------------------------------------------
  // THE CARRION WING pulling away — the last image of the chapter.
  //
  // This used to be four dark rects, of which the shaft's own grating then
  // covered all but about an 8x4 lozenge with one red pixel: at 1x it read as
  // a fly on the window. The skylight is 24 of the screen's 224 rows and a
  // third of its width is mullion, so the ship has to carry the whole shot on
  // its own. It is now 34x15 with an envelope drawn as a real cross-section,
  // three hull values plus a lit crown, a slung gondola with two windows, a
  // cross tail fin, a turning propeller and a red running light.
  // ---------------------------------------------------------------------
  if (lit > 0) {
    const t = Math.min(1, lit / 220);
    const sx = Math.round(X + 3 + t * (W - 44));
    const sy = Math.round(Y + 1 + Math.sin(lit * 0.05) * 2 - t * 1);

    const K = DPAL.x;          // keyline / silhouette
    const HD = '#241f30';      // shaded belly
    const HM = '#3a3350';      // midtone
    const HL = '#5c5476';      // crown, catching the sky
    const GL = '#8f88a8';      // glint

    // tail: a cross fin either side of a thin boom, so the back of the ship
    // is a shape and not a second black block butted onto the envelope
    ctx.fillStyle = K;
    ctx.fillRect(sx - 1, sy + 1, 2, 3);
    ctx.fillRect(sx - 3, sy + 2, 4, 2);
    ctx.fillRect(sx - 1, sy + 7, 2, 3);
    ctx.fillRect(sx - 3, sy + 7, 4, 2);
    ctx.fillRect(sx - 3, sy + 4, 4, 3);
    ctx.fillStyle = HD;
    ctx.fillRect(sx - 2, sy + 5, 3, 1);

    // envelope: [inset, width] per row, nose to the right — keyline pass,
    // then a tone pass one pixel inside it
    const hull = [[9, 15], [6, 21], [3, 26], [1, 30], [0, 32], [0, 32],
      [1, 30], [3, 26], [6, 20]];
    hull.forEach(([off, w], r) => { ctx.fillStyle = K; ctx.fillRect(sx + off, sy + r, w, 1); });
    hull.forEach(([off, w], r) => {
      if (r === 0 || r === hull.length - 1) return;
      ctx.fillStyle = r <= 2 ? HL : r <= 5 ? HM : HD;
      ctx.fillRect(sx + off + 1, sy + r, w - 2, 1);
    });
    ctx.fillStyle = GL;
    ctx.fillRect(sx + 11, sy + 1, 11, 1);      // the lit crown line
    ctx.fillRect(sx + 27, sy + 3, 2, 1);       // nose glint
    ctx.fillStyle = K;
    ctx.fillRect(sx + 12, sy + 1, 1, 7);       // belted seams
    ctx.fillRect(sx + 21, sy + 1, 1, 7);

    // gondola, slung under the middle
    ctx.fillStyle = K;
    ctx.fillRect(sx + 13, sy + 9, 10, 5);
    ctx.fillStyle = HM;
    ctx.fillRect(sx + 14, sy + 10, 8, 2);
    ctx.fillStyle = DPAL.B;                    // two lit cabin windows
    ctx.fillRect(sx + 15, sy + 11, 2, 1);
    ctx.fillRect(sx + 19, sy + 11, 2, 1);
    ctx.fillStyle = HD;
    ctx.fillRect(sx + 14, sy + 12, 8, 1);

    // propeller on the nose, turning
    ctx.fillStyle = K;
    ctx.fillRect(sx + 31, sy + 3, 1, 3);
    const blade = (Math.floor(lit / 3) & 1);
    ctx.fillStyle = GL;
    if (blade) ctx.fillRect(sx + 32, sy + 2, 1, 5);
    else { ctx.fillRect(sx + 32, sy + 4, 1, 1); ctx.fillRect(sx + 31, sy + 4, 2, 1); }

    // the running light on the tail — the one warm pixel on a cold ship
    ctx.fillStyle = DPAL.e;
    ctx.fillRect(sx - 2, sy + 2, 2, 1);
    ctx.fillStyle = DPAL.g;
    ctx.fillRect(sx - 2, sy + 3, 1, 1);
  }
  // the grating bars, always
  ctx.fillStyle = DPAL.k;
  for (let x = X + 5; x < X + W; x += 10) ctx.fillRect(x, Y, 3, H);
  ctx.fillRect(X, Y + 13, W, 3);
  ctx.fillStyle = DPAL.I;
  for (let x = X + 5; x < X + W; x += 10) ctx.fillRect(x, Y, 1, H);
  ctx.fillRect(X, Y + 13, W, 1);
  // the ledge the shaft is cut into
  ctx.fillStyle = DPAL.R; ctx.fillRect(X - 2, Y + H, W + 4, 1);
  ctx.fillStyle = DPAL.k; ctx.fillRect(X - 2, Y + H + 1, W + 4, 1);
}

export { makeBoilerworks, makeEnemySprites };
