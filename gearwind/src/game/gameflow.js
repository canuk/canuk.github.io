// Gearwind — CHAPTER 1 FLOW.
//
// This file is the chapter's spine. `src/scenes/game.js` is the renderer and
// the composer; everything that decides WHAT HAPPENS NEXT lives here:
//
//   * the phase machine        title/intro -> overworld -> Boilerworks -> end
//   * the curtain              the dithered fade played between phases
//   * the score                which of the four themes is playing, and why
//   * the fall                 the ambient lurch clock (beats do the rest)
//   * the debug warp table     ?beat=<name>, so a critic can reach any beat
//   * the autopilot plan       ?bot=play, so the chapter can be walked by a
//                              capture run instead of by a pair of hands
//
// Nothing here draws the world and nothing here owns an entity. It talks to
// the shared `quest` store (src/game/quest.js) and to whatever scene object
// game.js hands it. That keeps the story sequencing readable in one place and
// out of the two 400-to-1000-line scene files it drives.

import { WIDTH, HEIGHT, TILE } from '../engine.js';
import { ClockworkBeetle, GearBat } from './enemies.js';
import { overworldTheme, ChipEngine } from './audio.js';
import { boilerworksTheme, kettlebackTheme } from './world/boilerworks-music.js';
import { DOOR_CELLS } from './world/boilerworks.js';
import {
  drawBox, drawDialogText, drawDialogTextCentered, dialogTextWidth,
} from './dialog.js';
import { drawCounter } from './hud.js';
import {
  writeSave, saveTick, setSaveMenu, resetTick, activeName,
} from './save.js';

// ---------------------------------------------------------------------------
// TWO PATCHES THIS PIECE OWNS ON BEHALF OF MODULES IT MAY NOT EDIT.
//
// Both are one-line structural bugs in files belonging to other pieces, and
// both are invisible in those files' own demo scenes because only the
// COMPOSITION reaches the state that trips them. They are installed from here,
// at the seam, which is the only place that can see them.
// ---------------------------------------------------------------------------

/**
 * FATAL — the reason the chapter could not be finished by a human.
 *
 * `DialogBox.close()` sets `closing = OPEN_FRAMES` and `node = null` together.
 * `DialogBox.draw()` then computes `t = closing / OPEN_FRAMES`, which is
 * exactly 1 on that first frame, so the `if (t < 1)` collapse-wipe branch is
 * skipped and the full-window path dereferences `this._page` — null, because
 * `node` is null. It throws, and engine.js calls requestAnimationFrame AFTER
 * scene.draw(), so the throw kills the game loop permanently.
 *
 * `update()` decrements `closing` before a scene draws, which is why the
 * overworld and the Boilerworks never hit it. `Intro.update` (intro.js) closes
 * the box from inside its own `box.update(input)` on the same frame it draws,
 * so turning the first intro panel hit it every single time — five seconds
 * into a cold boot, on the one path every automated run went around.
 *
 * The guard: when the box is closing with no node, nudge `t` just under 1 so
 * the wipe branch — which is the branch that frame is meant to take — is the
 * branch that runs. `closing` is restored immediately, so the count-down that
 * `update()` owns is untouched, and a box with a live node is not touched at
 * all. No knowledge of OPEN_FRAMES's value is needed, and no frame that
 * worked before renders differently.
 *
 * @param {Function} DialogBoxClass the class from dialog.js
 */
export function guardDialogDraw(DialogBoxClass) {
  const proto = DialogBoxClass && DialogBoxClass.prototype;
  if (!proto || proto.__gwPageGuard) return DialogBoxClass;
  const inner = proto.draw;
  proto.draw = function guardedDraw(ctx) {
    if (!this.node && this.closing > 0) {
      const saved = this.closing;
      this.closing = saved * 0.999;   // t < 1 -> take the collapse-wipe branch
      try { inner.call(this, ctx); } finally { this.closing = saved; }
      return;
    }
    return inner.call(this, ctx);
  };
  proto.__gwPageGuard = true;
  return DialogBoxClass;
}

/**
 * EVERY TRANSITION SOUND PLAYED TWICE, on the same frame.
 *
 * transition.js's `sfx(name)` calls its own `onSfx` hook AND `window.__gwSfx`,
 * with two `if`s rather than an `if / else if`. Both scenes pass `onSfx` and
 * sfx.install() sets `window.__gwSfx`, so every screen scroll, every door,
 * every lurch and the Cogblade fanfare fired two coherent copies: +6 dB and a
 * flanged attack on the chapter's loudest moments.
 *
 * Fixed per instance, from here, with the `else if` the file wanted. Doing it
 * on the instance rather than the prototype means it does not depend on which
 * hook a given Transitions was built with, and a Transitions with no `onSfx`
 * at all (the Boilerworks') keeps its single global path.
 */
export function singleSfx(tr) {
  if (!tr || tr.__gwOneShot) return tr;
  tr.sfx = function oneShot(name) {
    if (this._sfx) this._sfx(name);
    else if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  };
  tr.__gwOneShot = true;
  return tr;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

export const PHASE = {
  FRONT: 'front',        // title screen + the four intro panels
  OVERWORLD: 'overworld',// Bellows Isle: dock, village, the works road
  DUNGEON: 'dungeon',    // the Boilerworks, KETTLEBACK, the ending
  DONE: 'done',          // the chapter card is up and holding
};

// Screens that play the village theme rather than the field theme. The dock
// and the works road are open sky and belong to the big tune; Cogwick Hollow
// and its interiors are small and warm and get the reduced arrangement.
export const VILLAGE_SCREENS = new Set(['villagew', 'villagee', 'shop', 'home', 'mill']);

// ---------------------------------------------------------------------------
// THE DEBUG WARP TABLE.  ?beat=<name>
//
// A boss nobody can reach cannot be judged, so every beat in STORY.md's sheet
// is one URL away. Each entry says which phase to open in, where in it, and
// exactly the flags and inventory the player would genuinely be holding by
// then — a warp that hands you a beat without the state that beat assumes is
// worse than no warp at all.
// ---------------------------------------------------------------------------
export const WARPS = {
  // 1. Cold open. Wren on the dock with a parcel and nothing else.
  dock: {
    phase: PHASE.OVERWORLD, screen: 'dock', sky: 0,
    flags: {},
  },
  // 2. Cogwick Hollow, at Marla's hatch, the cold open already paid off.
  village: {
    phase: PHASE.OVERWORLD, screen: 'villagee', sky: 1,
    beats: ['dockLurch'],
    flags: { talkedToPell: true, cogs: 12 },
  },
  // 3. The traverse: Cogblade in hand, on the Windrope over open sky.
  bridge: {
    phase: PHASE.OVERWORLD, screen: 'bridge', sky: 2,
    beats: ['dockLurch', 'cogblade', 'traverse'],
    flags: { talkedToPell: true, talkedToMarla: true, hasCogblade: true, cogs: 34 },
  },
  // 4. Down the hatch. B1, the vent-timing room.
  'dungeon-b1': {
    phase: PHASE.DUNGEON, room: 'B1', sky: 4,
    beats: ['dockLurch', 'cogblade', 'traverse', 'gate', 'boilerworks'],
    flags: {
      talkedToPell: true, talkedToMarla: true, hasCogblade: true,
      hasBoilerKey: true, gateOpen: true, cogs: 48,
    },
  },
  // 4b. B4 — the Bellows Cuff chest, three tin soldiers standing over it.
  'dungeon-b4': {
    phase: PHASE.DUNGEON, room: 'B4', sky: 4,
    beats: ['dockLurch', 'cogblade', 'traverse', 'gate', 'boilerworks'],
    flags: {
      talkedToPell: true, talkedToMarla: true, hasCogblade: true,
      hasBoilerKey: true, gateOpen: true, cogs: 71,
      dgnMap: true, dgnCompass: true, smallKeys: 0, heartPieces: 1,
    },
    give: 'map',
  },
  // 5. KETTLEBACK. Everything the dungeon would have given you by the door.
  boss: {
    phase: PHASE.DUNGEON, room: 'BOSS', sky: 4,
    beats: ['dockLurch', 'cogblade', 'traverse', 'gate', 'boilerworks', 'cuff', 'bossDoor'],
    flags: {
      talkedToPell: true, talkedToMarla: true, hasCogblade: true,
      hasBoilerKey: true, gateOpen: true, hasBellowsCuff: true,
      dgnMap: true, dgnCompass: true, bigKey: true, smallKeys: 0,
      // STORY.md: three hearts through the chapter, the fourth is the boss's
      // own drop. So the warp arrives at three, not four.
      maxHearts: 3, halves: 6, cogs: 96, heartPieces: 2,
    },
    give: 'cuff,map,bigkey,seen',
  },
  // 6. The ending. The boss is already burst; the shard is on the floor of
  //    the boiler hall and the doors are still shut.
  ending: {
    phase: PHASE.DUNGEON, room: 'BOSS', sky: 4, bossDown: true,
    beats: ['dockLurch', 'cogblade', 'traverse', 'gate', 'boilerworks', 'cuff', 'bossDoor'],
    flags: {
      talkedToPell: true, talkedToMarla: true, hasCogblade: true,
      hasBoilerKey: true, gateOpen: true, hasBellowsCuff: true,
      dgnMap: true, dgnCompass: true, bigKey: true,
      maxHearts: 4, halves: 8, cogs: 96, heartPieces: 2,
    },
    give: 'cuff,map,bigkey,seen',
  },
};

export const WARP_NAMES = Object.keys(WARPS);

// ---------------------------------------------------------------------------
// THE FALL, ABOVE GROUND.
//
// quest.js's beat table pushes the sky to stage 3 on `boilerworks` (the moment
// Wren goes DOWN the mouth) and to stage 4 on `bossDoor` (a sealed hall with a
// ceiling). Both of the stages that sell "we are inside the cloud deck now"
// therefore existed only where there is no sky to see them in: a played
// chapter topped out at stage 2 and the last two fifths of the palette work
// were never once on screen.
//
// So the ladder is pulled forward by two rungs of OVERWORLD state. Nothing is
// skipped and nothing regresses — Quest.beat only raises the stage
// (`b.sky > this.flags.skyStage`), so `boilerworks` and `bossDoor` become
// no-ops and the same five stages arrive in the same order, just where there
// is a horizon to read them against.
//
//   dock 0 -> 1   the cold-open lurch          (beat: dockLurch)
//   bridge 2      the traverse                 (beat: traverse)
//   scrapfield 3  the works road, cloud deck    HERE
//   mouth 4       the causeway to the works     HERE
//
// The push is hung on ARRIVING at a screen rather than on the gear-gate, so
// the whole of the last outdoor screen — walking to the gate, turning the key,
// walking to the stair — happens under the stage it earns, instead of the
// stage ramping for two seconds on the way down the hole.
// ---------------------------------------------------------------------------
export const SKY_ON_SCREEN = {
  // THE COLD OPEN, WHICH WAS OPTIONAL. `dockLurch` — the horizon tilt, the
  // shake, Pell's "That's not weather." and with them the whole of sky stage 1
  // — existed in exactly one place, behind having walked into Pell and pressed
  // A, and nothing gated the dock's north edge. A player who simply walked up
  // the harbour road in the first twenty seconds took stage 0 -> 2 -> 3 -> 4
  // and never saw the inciting incident of Chapter 1. GameScene now holds the
  // dock's exit until Pell has been heard (see _gateColdOpen), and this is the
  // backstop for every other way onto the road: arriving on it at stage 0 is
  // the isle answering, one screen late, rather than not at all.
  dockroad: { stage: 1, lurch: { power: 5, frames: 34, dust: 'ground', count: 20 } },
  scrapfield: { stage: 3, lurch: { power: 4, frames: 26, dust: 'ground', count: 18 } },
  mouth: { stage: 4, lurch: { power: 5, frames: 32, dust: 'ground', count: 22 } },
};

// ---------------------------------------------------------------------------
// THE THIN STRETCH.  terrace -> scrapfield -> cliffnook.
//
// Three screens carrying one bush-maze idea, and the chapter's weakest five
// minutes. World geometry belongs to another piece, but the CHAPTER does not:
// these are the beats that stretch has been missing — the mill turning the
// wrong way, Vane's mark on a wrecked skiff (the only sight of the villain
// before the skylight at the very end), and the empty cradle seen from the rim.
// They fire once, on arrival, when nothing else owns the frame, and each is a
// page or two of the same window every other line in the chapter uses.
// ---------------------------------------------------------------------------
export const SCREEN_SCENES = {
  terrace: {
    lines: [
      'The mill\'s vane is bent\nhard north, and it is\nturning the wrong way.',
      'Marla said the mill feeds\nthe works. Backwards, it is\ndrinking the works dry.',
    ],
  },
  scrapfield: {
    lines: [
      'A courier skiff lies\nnose-down in the scrap.\nIt is not one of Marla\'s.',
      'Someone burned a bird into\nthe tailplane. Wings down,\nover a hook. Carrion.',
    ],
  },
  cliffnook: {
    lines: [
      'From the rim you can see\nclean under the isle: the\ncradle, open and dark.',
      'Under that, cloud deck -\nand it is nearer than it\nwas this morning.',
    ],
    lurch: { power: 3, frames: 22, dust: 'ground', count: 14 },
  },
};

// ---------------------------------------------------------------------------
// ENCOUNTER DENSITY.  The chapter's population, and why it is owned HERE.
//
// MEASURED, before this block existed: 23 placed enemies across 20 spaces —
// eleven of them outdoors, spread over nine screens. dock, dockroad, villagew
// and villagee had none at all, and `bridge` had ONE where the reference
// picture this whole project is shot against — refs/overworld-bridge-link-
// midwalk.png — has FOUR soldiers standing on the span. Four screens in a row
// with nothing on them is the single thing that gives the blind test away: the
// art passes for 1993 and the walking does not, because in 1993 something came
// at you every screen.
//
// The tables live here rather than in maps-overworld.js for two reasons.
// First, ownership: a screen's GEOMETRY is world content and a chapter's
// PACING is not — how hostile the isle is in minute eight is a property of the
// chapter, exactly like the sky ladder twenty lines up. Second, it is a
// TOP-UP, not a list: the quota says how many the screen should be carrying,
// the screen's own `enemies:` array is counted first, and only the shortfall
// is placed. A world builder who adds two beetles to the scrapfield tomorrow
// silently gets two fewer from here and the screen still totals five.
//
// Placement is derived, not authored, for the same reason — hard-coded cells
// would rot the moment a map moves a rock. Cells are chosen from the screen's
// live collision grid, filtered for reachability from where the player is
// about to be standing, and spread by farthest-point sampling, which is
// deterministic: the same screen entered twice populates identically.
// ---------------------------------------------------------------------------

/**
 * How many live enemies a screen should be carrying, INCLUDING its own.
 *
 * The isle turns hostile as it falls; that is the rule the numbers encode.
 *
 *  - `dock` stays empty. It is the cold open, Wren has no blade, and there is
 *    a man on the quay talking. Nothing may compete with him.
 *  - `dockroad` gets two, and they are the reason the Cogblade matters: this
 *    is the one stretch where the player meets something he cannot kill yet,
 *    and walks round it. Beetles only, 0.5 px/frame, entirely outrunnable.
 *  - The Hollow is a SAFE HUB on the way in and a different place on the way
 *    out — both village screens stay clear until Marla has handed over the
 *    blade, then the scrap that the fall has shaken loose is in the lanes.
 *    (ALttP's Kakariko is empty; ALttP's Kakariko is also not sinking.)
 *  - Everything east of the Windrope carries four or five, which is the
 *    density of the cliff-path and bridge references.
 */
export const OW_QUOTA = {
  dock: () => 0,
  dockroad: () => 2,
  villagew: (q) => (q.has('hasCogblade') ? 2 : 0),
  villagee: (q) => (q.has('hasCogblade') ? 3 : 0),
  bridge: () => 4,
  terrace: () => 4,
  scrapfield: () => 5,
  cliffnook: () => 4,
  mouth: () => 4,
};

/**
 * What the top-up may place, per screen, cycled in order.
 *
 * A GEAR-BAT dives; a beetle walks a track. On the Windrope — a 28px walkable
 * band over two miles of air, with a gust every 100 frames — a diving enemy is
 * not difficulty, it is a coin toss, so the span gets beetles and the reference
 * picture's four bodies. Same for the road out of the dock, which the player
 * walks with no weapon at all.
 */
const OW_KINDS = {
  dockroad: ['beetle'],
  villagew: ['beetle'],
  // Beetles only in the Hollow, and not only because a bat over a village
  // square looks wrong: dockroad, villagew and villagee are the three screens
  // that carried NO enemy sprite at all, so every enemy palette put on them is
  // new to the frame. check-shot: villagee goes 88 -> 103 total distinct
  // colours with a beetle AND a bat on it, 95 with beetles alone.
  villagee: ['beetle'],
  bridge: ['beetle'],
  terrace: ['beetle', 'beetle', 'bat'],
  scrapfield: ['beetle', 'bat', 'beetle'],
  cliffnook: ['bat', 'beetle', 'beetle'],
  mouth: ['beetle', 'beetle', 'bat'],
};

// Rows 0-2 sit under the HUD strip (the gauge runs y18-62 and the life row
// y24-32); row 13 is the bottom wall band on every outdoor screen. An enemy
// the player cannot see is not an encounter, and one placed behind the hearts
// is worse than not placed at all. Patrols may still wander up there — so does
// ALttP's — but nothing is ever PUT there.
const POP_ROW0 = 3;
const POP_ROW1 = 12;
// How much room the top-up leaves round the things a screen is FOR.
const CLEAR_ENTRY = 54;    // where the player is about to be standing
const CLEAR_PROP = 26;     // doors, chests, signs, people, the works portal
const CLEAR_SPACING = 40;  // between two placed enemies

/** The cell a walkable box would occupy, free of tiles AND solid decor. */
function cellFree(map, c, r) {
  return map.boxFree(c * TILE + 2, r * TILE + 4, 12, 10);
}

/**
 * Where the player will actually be standing when this screen appears.
 *
 * `Overworld.enter()` runs while the outgoing screen is still scrolling, so
 * `player` still holds the position he LEFT by — off the edge he walked out
 * of. `settle()` puts him back on the opposite edge afterwards. Mirroring here
 * means the top-up knows the arrival point at the only moment it can still act
 * on it, which is before the incoming screen is snapshotted for the scroll.
 */
function arrivalPoint(player) {
  const x = player.x + 8, y = player.y + 19;
  if (y < 8) return { x, y: HEIGHT - 26 };
  if (y > HEIGHT - 8) return { x, y: 22 };
  if (x < 8) return { x: WIDTH - 22, y };
  if (x > WIDTH - 8) return { x: 22, y };
  return { x, y };
}

/** Everything on the screen that an enemy must not be standing on top of. */
function keepClearOf(screen) {
  const pts = [];
  const add = (o, dx = 8, dy = 8) => {
    if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) pts.push([o.x + dx, o.y + dy]);
  };
  for (const d of screen.doors || []) add(d, (d.w || 14) / 2, (d.h || 8) / 2);
  for (const c of screen.chests || []) add(c);
  for (const p of screen.pieces || []) add(p);
  for (const s of screen.signs || []) add(s);
  for (const n of screen.npcs || []) add(n, 8, 10);
  for (const g of screen.gates || []) add(g, 24, 24);
  if (screen.portal) {
    pts.push([screen.portal.x + (screen.portal.w || 16) / 2,
      screen.portal.y + (screen.portal.h || 16) / 2]);
  }
  return pts;
}

/**
 * Cells this screen could carry an enemy on: free, on-camera, clear of the
 * furniture, and — the clause that matters — REACHABLE on foot from where the
 * player arrives. A beetle placed in a rock pocket the player cannot enter is
 * scenery, and a beetle placed on the far side of the Windrope's gap is a
 * beetle that never meets anybody.
 */
/** Every free cell reachable on foot from (sc,sr). */
function flood(map, sc, sr) {
  const key = (c, r) => r * map.cols + c;
  const seen = new Set([key(sc, sr)]);
  const q = [[sc, sr]];
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= map.cols || nr >= map.rows) continue;
      if (seen.has(key(nc, nr)) || !cellFree(map, nc, nr)) continue;
      seen.add(key(nc, nr));
      q.push([nc, nr]);
    }
  }
  return q;
}

function placeableCells(screen, entry) {
  const map = screen.map;
  const clear = keepClearOf(screen);
  const sc = Math.max(0, Math.min(map.cols - 1, Math.floor(entry.x / TILE)));
  const sr = Math.max(0, Math.min(map.rows - 1, Math.floor(entry.y / TILE)));

  // THE WALK HAS TO START SOMEWHERE THE PLAYER CAN STAND.
  //
  // An arrival point in rock — or in a sealed pocket like the rim nook's, which
  // IS walkable and connects to nothing — floods a handful of cells and the
  // screen then populates with nothing at all, silently. So: flood from the
  // arrival point, flood from the screen's authored spawn, and keep whichever
  // found more ground. Both are candidates rather than a priority order,
  // because on a normal screen change the arrival point is the honest one and
  // on a debug hop the spawn is.
  let cells = cellFree(map, sc, sr) ? flood(map, sc, sr) : [];
  const sp = screen.def && screen.def.spawn;
  const alt = sp
    ? [Math.max(0, Math.min(map.cols - 1, Math.floor((sp.x + 8) / TILE))),
      Math.max(0, Math.min(map.rows - 1, Math.floor((sp.y + 19) / TILE)))]
    : [Math.floor(map.cols / 2), Math.floor(map.rows / 2)];
  if (cells.length < 24 && cellFree(map, alt[0], alt[1])) {
    const other = flood(map, alt[0], alt[1]);
    if (other.length > cells.length) cells = other;
  }
  if (!cells.length) return [];

  const out = [];
  for (const [c, r] of cells) {
    if (r < POP_ROW0 || r > POP_ROW1) continue;
    const px = c * TILE + 8, py = r * TILE + 10;
    if (Math.hypot(px - entry.x, py - entry.y) < CLEAR_ENTRY) continue;
    if (clear.some(([qx, qy]) => Math.hypot(px - qx, py - qy) < CLEAR_PROP)) continue;
    out.push([c, r, px, py]);
  }
  return out;
}

/**
 * THE TOP-UP. Called once per screen entry, from the composition, after the
 * screen has spawned its own.
 *
 * @param {object} screen the live Screen
 * @param {object} o      { world, quest, player }
 * @returns {number} how many were added
 */
export function reinforce(screen, o) {
  const quota = OW_QUOTA[screen.id];
  if (!quota) return 0;
  const want = quota(o.quest) - screen.enemies.length;
  if (want <= 0) return 0;

  const entry = arrivalPoint(o.player);
  const cells = placeableCells(screen, entry);
  if (!cells.length) return 0;

  // Farthest-point sampling, seeded on the cell furthest from the arrival
  // point: the first thing placed is the thing at the far end of the screen,
  // and every one after it is pushed away from the ones already down. No RNG,
  // so the same screen populates the same way every visit and a capture run is
  // reproducible.
  const taken = [];
  let seed = cells[0], seedD = -1;
  for (const cell of cells) {
    const d = Math.hypot(cell[2] - entry.x, cell[3] - entry.y);
    if (d > seedD) { seedD = d; seed = cell; }
  }
  taken.push(seed);
  while (taken.length < want) {
    let best = null, bestD = -1;
    for (const cell of cells) {
      if (taken.includes(cell)) continue;
      let d = Infinity;
      for (const t of taken) d = Math.min(d, Math.hypot(cell[2] - t[2], cell[3] - t[3]));
      if (d > bestD) { bestD = d; best = cell; }
    }
    if (!best || bestD < CLEAR_SPACING) break;
    taken.push(best);
  }

  const kinds = OW_KINDS[screen.id] || ['beetle', 'bat'];
  const start = screen.enemies.length;
  taken.forEach((cell, i) => {
    const kind = kinds[i % kinds.length];
    const ent = makeOverworldEnemy(kind, cell, screen, o.world);
    ent.timer = 30 + (start + i) * 45;
    screen.enemies.push(ent);
  });
  return taken.length;
}

/**
 * One enemy, built exactly the way `Screen.spawnEnemies` builds its own —
 * including the swoop-duration patch, which is the difference between a
 * gear-bat that catches Wren and one he can outwalk in a straight line. Two
 * populations on one screen behaving differently would be a worse defect than
 * the empty screen this replaces.
 */
function makeOverworldEnemy(kind, cell, screen, world) {
  const [c, r] = cell;
  if (kind === 'bat') {
    const bounds = {
      x0: Math.max(16, c * TILE - 56), y0: Math.max(24, r * TILE - 40),
      x1: Math.min(WIDTH - 32, c * TILE + 56), y1: Math.min(HEIGHT - 48, r * TILE + 40),
    };
    const ent = new GearBat(c * TILE, r * TILE, bounds);
    const plan = GearBat.prototype._startSwoop;
    ent._startSwoop = function swoop(engine, target) {
      plan.call(this, engine, target);
      if (this._flight) this._flight.dur = Math.max(26, Math.round(this._flight.dur * 0.62));
    };
    ent.sprites = world.enemySprites;
    ent.kind = 'bat';
    return ent;
  }
  // Beetles patrol along whichever axis has the most room in front of them, so
  // a top-up never puts one nose-first into a wall it will spend the screen
  // grinding against.
  const map = screen.map;
  const run = (dc, dr) => {
    let n = 0;
    while (n < 6 && cellFree(map, c + dc * (n + 1), r + dr * (n + 1))) n++;
    return n;
  };
  const dirs = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
  let dir = 'down', bestRun = -1;
  for (const [name, dc, dr] of dirs) {
    const n = run(dc, dr);
    if (n > bestRun) { bestRun = n; dir = name; }
  }
  const ent = new ClockworkBeetle(c * TILE, r * TILE, dir);
  ent.state = 'walk';
  ent.sprites = world.enemySprites;
  ent.kind = 'beetle';
  return ent;
}

// ---------------------------------------------------------------------------
// THE COG ECONOMY, AND THE PURCHASE THAT COULD NOT BE MADE.
//
// Hesper sells the SECOND WIND charm for 100 cogs and it is the only thing in
// the shop that changes how the chapter plays — it is what spends itself
// instead of a death (see GameScene.checkDeath). MEASURED: an autopilot run
// finished the whole chapter holding THREE cogs. An enemy paid one cog 55% of
// the time; twenty-three enemies is a wallet of about thirteen. The charm was
// unbuyable in any honest run, which means the shop was set dressing and the
// death rule behind it was dead code.
//
// So a kill is worth a PURSE, not a coin: the screen's own drop roll still
// happens, and this adds three more cogs scattered where the body was. With
// the population above, a full clear of the isle pays about a hundred — the
// charm is one thorough overworld away, which is exactly where a 100-cog item
// should sit, and enemies respawn per screen entry (ALttP's rule) so a player
// who wants it early can go and earn it.
// ---------------------------------------------------------------------------
export class Bounty {
  constructor(extra = 3) {
    this.extra = extra;
    this.seen = new Map();
    this.screen = null;
  }

  /** Once a frame, after the overworld has updated. */
  tick(world) {
    const s = world && world.screen;
    if (!s) return;
    if (s.id !== this.screen) { this.screen = s.id; this.seen = new Map(); }
    const live = new Set(s.enemies);
    for (const [e, pos] of this.seen) {
      if (live.has(e)) continue;
      this.seen.delete(e);
      // `updateEnemies` filters the dead out on the frame they die, so an
      // entry that has left the list AND had no health is a kill. A screen
      // change cannot be confused with one: the map is dropped above.
      if (!(e.hp <= 0 || e.dead)) continue;
      for (let i = 0; i < this.extra; i++) {
        world.spawnDrop(pos[0] + 4 + (i - 1) * 7, pos[1] + 6 + (i & 1) * 6, 'cog');
      }
    }
    for (const e of s.enemies) this.seen.set(e, [e.x, e.y]);
  }
}

// ---------------------------------------------------------------------------
// THE BOILERWORKS' OWN THIN ROOMS.
//
// MEASURED: B6 carried nothing but the Riveter, and B7 — the room a scripted
// run spent 25% of its entire playtime inside, because it holds the big key
// behind two latched valves and a crate channel — carried two tin soldiers.
// B2 and B5 were three and one. Added ONCE, when the room is first built, so a
// cleared room stays cleared and no arena's win condition changes: B4's seal
// counts tin soldiers and B6's counts the Riveter, and neither is touched.
//
// Cells are checked against the room's live collision before anything is
// placed, so a block moving in maps-dungeon.js drops the spawn rather than
// burying an enemy in masonry.
// ---------------------------------------------------------------------------
export const DG_EXTRA = {
  // the beetle nest earns the name: the south channel is contested too
  B2: [{ kind: 'beetle', c: 4, r: 11, dir: 'right' }, { kind: 'beetle', c: 12, r: 11, dir: 'left' }],
  // the gauntlet's clock now has something walking through it
  B5: [{ kind: 'beetle', c: 3, r: 11, dir: 'right' }, { kind: 'beetle', c: 12, r: 11, dir: 'left' }],
  // cover works both ways: something on the floor while the arm is firing
  B6: [{ kind: 'beetle', c: 5, r: 11, dir: 'right' }, { kind: 'beetle', c: 10, r: 11, dir: 'left' }],
  // the longest room in the dungeon, and the one carrying the big key
  B7: [{ kind: 'beetle', c: 6, r: 11, dir: 'right' }, { kind: 'tin', c: 10, r: 11, dir: 'left' }],
};

/**
 * @param {object} room a freshly built Boilerworks Room
 * @returns {number} how many were added
 */
export function reinforceRoom(room) {
  const list = DG_EXTRA[room.id];
  if (!list || room._gwPopulated) return 0;
  room._gwPopulated = true;
  let n = 0;
  for (const e of list) {
    if (!cellFree(room.map, e.c, e.r)) continue;
    room._spawnEnemy(e);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// ONE FRAME LANGUAGE.
//
// The chapter grew three: the HUD's gold bevel (ALttP-exact, and it stays),
// the message window's keyline/white/slate bevel, and the dungeon map's plain
// 1px white rounded rect — three different ideas of what a panel is, in one
// game. dialog.js's window is the one with the most work in it, so it is the
// one that wins: this paints its frame ring — the same staircase corners, the
// same four layers — over any panel a module we do not own has already drawn,
// without touching what is inside the panel.
//
// The Boilerworks map screen no longer needs it — the subscreen below draws
// that panel itself now, frame and all — so this is kept for the next module
// that arrives with a panel of its own.
// ---------------------------------------------------------------------------
//
// THE CORNER TICKS. The ring's outer edge is a 3px staircase; a panel drawn
// underneath it with a 2px corner radius (items.js `panel()`) leaves exactly
// two white pixels outside that staircase in each corner — eight pixels of the
// old window surviving as crop marks, which is exactly what the map screen
// measured. The ring therefore carries its own corner blanking: the 5x5
// outside each staircase is painted in `bg` rather than left transparent.
// Both subscreens composite over a full-screen black dim, which is what `bg`
// defaults to; pass null to leave live world art showing through.
// ---------------------------------------------------------------------------
const RING_CACHE = new Map();
export function drawFrameOver(ctx, x, y, w, h, inset = 5, bg = '#000000') {
  const key = `${w}x${h}x${inset}x${bg}`;
  let cv = RING_CACHE.get(key);
  if (!cv) {
    cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    if (bg) {
      g.fillStyle = bg;
      for (const [cx, cy] of [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]) {
        g.fillRect(cx, cy, 5, 5);
      }
    }
    drawBox(g, 0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000000';
    g.fillRect(inset, inset, w - inset * 2, h - inset * 2);
    RING_CACHE.set(key, cv);
  }
  ctx.drawImage(cv, Math.round(x), Math.round(y));
}

// ---------------------------------------------------------------------------
// STANDING CLEAR OF THE PEOPLE YOU TALK TO.
//
// game/npc.js gives a standing villager a footprint that starts 14px down the
// sprite (`{x:2,y:14,w:12,h:20}`), i.e. at the boots. Wren's own feet box is
// y+14..y+24 (game/player.js), so walking DOWN into a villager the stop
// condition is `playerY + 24 == npcY + 14`: his 24px sprite ends fourteen
// pixels inside hers, and because npc.baseY (y+24) is then greater than his
// (y+24, twelve pixels higher up the screen) the y-sort draws her OVER him.
// What the player sees on the Cogblade handover — the beat the chapter is
// named for — is one body with two heads.
//
// The footprint only ever grew DOWNWARD from the boots, so it is a personal
// space from below and from the sides (4px of overlap each, which is right)
// and nothing at all from above. This grows it UPWARD to the shoulders,
// keeping its bottom edge exactly where it was: from the north the stop
// becomes `playerY + 24 == npcY + 2`, and from every other direction not one
// pixel of collision changes.
//
// It is applied here, at the seam, because npc.js and the screen's obstacle
// list belong to other pieces — and because the map keeps a COPY of the
// footprint taken at `addNpc` time, so both have to move together or the
// collision and the talk probe disagree.
// ---------------------------------------------------------------------------
export const NPC_STAND_TOP = 2;

/**
 * @param {object} screen a world Screen, already populated
 * @returns {Array} one {name, from, to} per villager moved (for probes)
 */
export function standClear(screen) {
  if (!screen || screen._standClear) return [];
  screen._standClear = true;
  const moved = [];
  for (const npc of screen.npcs || []) {
    const off = npc.off;
    if (!off || off.y <= NPC_STAND_TOP) continue;
    const was = { x: off.x, y: off.y, w: off.w, h: off.h };
    const old = { x: npc.x + off.x, y: npc.y + off.y, w: off.w, h: off.h };
    off.h = off.y + off.h - NPC_STAND_TOP;   // bottom edge stays put
    off.y = NPC_STAND_TOP;
    for (const ob of (screen.map && screen.map.obstacles) || []) {
      const r = ob.rect;
      if (!r) continue;
      if (r.x === old.x && r.y === old.y && r.w === old.w && r.h === old.h) {
        r.y = npc.y + off.y; r.h = off.h;
      }
    }
    moved.push({ name: npc.name || '?', from: was, to: { ...off } });
  }
  return moved;
}

// ---------------------------------------------------------------------------
// THE SUBSCREEN.  START, in both halves of the chapter.
//
// WHAT IT WAS. START used to open two different screens: above ground a panel
// headed WREN'S KIT that carried an OBJECTIVE TRACKER ("NEXT", with the next
// step of the chapter written out) and a five-segment PROGRESS BAR for the
// fall; below ground, a floor plan with none of the counts on it. So the
// player could read his cogs above ground and not below, read the map below
// and not above — and the two things he could read that no 1993 cartridge
// would ever have shown him were a quest log and a completion meter. A
// subscreen from 1993 is a list of THINGS YOU HAVE. It never tells you what to
// do next, and it never tells you how far through you are.
//
// WHAT IT IS. One screen, both halves, in ALttP's own grammar:
//
//   * an ITEM GRID of wells, the held items lit and the empty ones dark, with
//     a white cursor box the player MOVES, exactly as ALttP moves the cursor
//     over the Y-button grid (see THE B ITEM, below);
//   * the COUNTS under it, drawn with the HUD'S OWN ICONS AND DIGIT FONT
//     (hud.js `drawCounter`, the same italic 8px-advance numerals as the
//     status strip) at the strip's own spacing, and the LIFE row drawn by the
//     HUD itself so it is the same object in both places;
//   * the FLOOR PLAN of the Boilerworks on the right, which is what the
//     dungeon's own START screen drew, with the map/compass/big-key/small-key
//     slots under it — held or not held, which is all a subscreen ever says.
//
// Nothing on it is a verb. `objectiveFor()` and the fall bar are gone.
// ---------------------------------------------------------------------------

export const SUB_PANEL = { x: 20, y: 18, w: 216, h: 188 };

// The panel's furniture, measured once. Left column: the grid, the counts and
// LIFE. Right column: the floor plan and the dungeon items. The divider sits
// between them, as it does on ALttP's own item screen.
const SUB = {
  labelY: 27,           // column headings
  ruleY: 36,            // the rule under them
  divX: 122,            // the vertical divider between the columns
  gridX: 30, gridY: 44, // item wells
  well: 22, pitchX: 28, pitchY: 26, cols: 3,
  nameY: 97,            // the CURSOR's item name, under the grid
  statusY: 107,         // what pressing A on it would do (ON B / A TO EQUIP)
  countY: 118,          // counter icons (digits sit 9 rows under, as in the HUD)
  countX: [30, 62, 86], // cogs / keys / pieces — the HUD's own 0/+32/+56 spacing
  heartX: 30, heartY: 150,
  mapX: 137, mapY: 44,  // floor plan origin
  // MEASURED centre of the right-hand column, for anything centred in it. The
  // column runs x=123..231 — from the pixel after the divider at 122 to the
  // last pixel inside the panel border — so its centre is 177, not the 175
  // that `mapX + 38` had been standing in for. Two pixels does not sound like
  // much: at 175 the 105px 'NO MAP OF THIS PLACE' started at x=123 and its N
  // sat hard against the divider with no gutter at all, while four pixels went
  // spare on the right. 'THE BOILERWORKS' is narrow enough to have hidden the
  // same error.
  mapCx: 177,
  cell: [22, 17], gap: 5,
  dgItemY: 158, dgItemX: 137, dgItemPitch: 24,
  footY: 190,
};

const INK = '#f8f8f8';
const DIM = '#a0a8b8';
const RULE = '#6878a0';
const BRASS = '#c09a30';
const BRASS_LIT = '#e8c65c';
const OFF = '#585c6c';

// ---------------------------------------------------------------------------
// THE B ITEM.  A cursor that is a cursor.
//
// WHAT IT WAS. The grid drew a cursor box and the box was a READOUT:
//
//     const equipped = held.cuff ? 1 : held.cogblade ? 0 : -1;
//
// — the same expression scenes/game.js `syncHud` uses to pick the HUD's item
// art, restated. So the box reported what the game had auto-picked, it always
// preferred the Bellows Cuff the moment the chest in B4 was opened, and the
// arrow keys did nothing at all: a player looking at an inventory screen with
// a highlight on it could neither move the highlight nor choose his B item.
// That is a picture of ALttP's subscreen rather than the thing itself.
//
// WHAT IT IS.
//
//   * ARROWS move the cursor, and it only ever lands on a well the player is
//     actually HOLDING. The two `{img:null, held:false}` wells at the bottom
//     of the grid are padding — a 1993 subscreen saying "there is more of this
//     to find" — and the cursor cannot strand on them, or on an item the
//     chapter has not handed over yet. Left/right walk the grid in reading
//     order; up/down cross to the other row and take the held well nearest the
//     column you left, so no press is ever swallowed with items on screen.
//   * A (the X key) ASSIGNS. The well goes brass, the status line under the
//     grid reads ON B, and the HUD's item box follows on the next frame.
//   * THE NAME FOLLOWS THE CURSOR, not the assignment — that is the whole
//     point of browsing a grid: you read what you are about to pick before you
//     pick it. The line under the name says what pressing A would do.
//   * WHAT MAY SIT ON B is `b: true` below. The BOILER KEY may not (it is a
//     door key: scenes/dungeon.js turns it on contact, exactly as ALttP does
//     with a small key, and an equippable key would be a lie about how it
//     works) and neither may Hesper's SECOND WIND, which spends itself on a
//     death whether it is highlighted or not. Both still take a well, still
//     take the cursor and still name themselves — a subscreen is a list of
//     things you have.
//   * THE CHOICE IS REAL, AND SO IS THE BUTTON. It lives in the quest store as
//     `bItem`, so it survives a screen scroll, a door, the descent, a death and
//     a continue; and B fires WHAT THE PANEL SAYS IS ON B — the Cuff only while
//     the Cuff is on it (`Subscreen._hooks`, clause (e)), the Cogblade only
//     while the Cogblade is (clause (f), `_bSwing`). An assignment that moved
//     an icon and nothing else would be the display-only bug in a new coat; an
//     assignment the panel accepted and the button then ignored would be worse,
//     because it hands the player a silent way to switch their own kit off.
//   * A STILL SWINGS, WHATEVER THE GRID SAYS. The blade is in his hand; ALttP
//     never takes the sword off the sword button either. Putting the Cogblade
//     on B is a trade the player makes with their eyes open — the Cuff comes
//     off the button, and two presses put it back.
//   * A NEW ITEM ARRIVES EQUIPPED, which is ALttP's rule and, here, the thing
//     that keeps the choice from being a trap: pick up the Cuff in B4 and it
//     goes on B whatever was there before.
// ---------------------------------------------------------------------------

/**
 * The kit, in grid order: six wells, three across, the same six the panel has
 * always drawn.
 *
 * `flag` null marks the padding — never held, never lit, never reachable by
 * the cursor. `b` marks what the B button will accept.
 */
export const KIT_SLOTS = [
  { id: 'cogblade', flag: 'hasCogblade', icon: 'sword', name: 'COGBLADE', b: true },
  { id: 'cuff', flag: 'hasBellowsCuff', icon: 'cuff', name: 'BELLOWS CUFF', b: true },
  { id: 'boilerkey', flag: 'hasBoilerKey', icon: 'key', name: 'BOILER KEY', b: false, tag: 'GATE KEY' },
  { id: 'charm', flag: 'hasSecondWind', icon: 'charm', name: 'SECOND WIND', b: false, tag: 'ALWAYS ON' },
  { id: null, flag: null, icon: null, name: '', b: false },
  { id: null, flag: null, icon: null, name: '', b: false },
];

/** The wells the B button will take, by id. */
export const B_SLOTS = new Map(KIT_SLOTS.filter((s) => s.b).map((s) => [s.id, s]));

/**
 * What is on the B button right now.
 *
 * An explicit choice wins as long as the player still holds it; with no
 * choice on record the answer is the one the chapter used to hard-code, so a
 * run that never opens the subscreen behaves exactly as it did before.
 *
 * @param {object} q the quest store
 * @returns {?string} a KIT_SLOTS id, or null for empty hands
 */
export function bItemOf(q) {
  if (!q || typeof q.has !== 'function') return null;
  const want = typeof q.get === 'function' ? q.get('bItem') : null;
  const s = want && B_SLOTS.get(want);
  if (s && q.has(s.flag)) return s.id;
  if (q.has('hasBellowsCuff')) return 'cuff';
  if (q.has('hasCogblade')) return 'cogblade';
  return null;
}

/**
 * Put an item on the B button. Refuses anything the player is not holding and
 * anything the button does not take.
 *
 * @returns {boolean} whether the assignment was accepted
 */
export function setBItem(q, id) {
  const s = q && id && B_SLOTS.get(id);
  if (!s || !q.has(s.flag)) return false;
  q.set('bItem', id);
  return true;
}

export class Subscreen {
  /**
   * @param {object} icons
   *   sword, cuff, key, charm     16px item art for the grid
   *   cog, keyIcon, piece         the HUD's own counter icons
   *   map, compass, bigKey, smallKey   dungeon items
   * @param {Function} [hearts] (ctx,x,y) => void — the HUD's own LIFE row
   */
  constructor(icons = {}, hearts = null) {
    this.icons = icons;
    this.hearts = hearts;
    this.open = false;
    this.t = 0;
    /** Index into KIT_SLOTS. -1 = empty hands, nothing to point at. */
    this.cursor = -1;
    /** The quest store, latched from the last draw — see `_hooks`. */
    this._q = null;
    this._wasOpen = false;
  }

  toggle() {
    this.open = !this.open;
    this.t = 0;
    // ALttP opens the subscreen with the cursor already on the equipped item.
    if (this.open) this.syncCursor();
    return this.open;
  }

  /** @returns {boolean} true while the subscreen still owns the frame. */
  update(input) {
    if (!this.open) return false;
    this.t++;
    if (this.t > 4 && (input.hit('start') || input.hit('b'))) { this.open = false; return false; }
    // The frame START was pressed on is not a frame the cursor reads.
    if (this.t > 1) this.pump(input);
    return true;
  }

  // --- the cursor -----------------------------------------------------------

  /** Is well `i` something the player is actually carrying? */
  _held(q, i) {
    const s = KIT_SLOTS[i];
    return !!(s && s.flag && q && q.has(s.flag));
  }

  /** Put the cursor on the B item; failing that, on the first thing held. */
  syncCursor(q = this._q) {
    if (!q) return -1;
    const b = bItemOf(q);
    let i = KIT_SLOTS.findIndex((s) => s.id && s.id === b && q.has(s.flag));
    if (i < 0) i = KIT_SLOTS.findIndex((s) => s.flag && q.has(s.flag));
    this.cursor = i;
    return i;
  }

  /**
   * One press of one arrow.
   *
   * Left/right walk the whole grid in reading order and wrap, so three items
   * on the top row and one on the bottom is a ring rather than two dead ends.
   * Up/down cross to the OTHER row only — never back to the row you are
   * already on — and take the held well nearest the column you left, which is
   * what makes a sparse 3x2 grid feel like a grid instead of a list.
   *
   * Neither can land on an empty well, so the padding is unreachable.
   *
   * @returns {boolean} whether the cursor actually moved
   */
  moveCursor(dir, q = this._q) {
    if (!q) return false;
    if (this.cursor < 0 || !this._held(q, this.cursor)) return this.syncCursor(q) >= 0;
    const n = KIT_SLOTS.length, cols = SUB.cols, rows = Math.ceil(n / cols);
    const from = this.cursor;
    if (dir === 'left' || dir === 'right') {
      const step = dir === 'right' ? 1 : -1;
      for (let k = 1; k < n; k++) {
        const i = ((from + step * k) % n + n) % n;
        if (this._held(q, i)) { this.cursor = i; break; }
      }
    } else if (dir === 'up' || dir === 'down') {
      const step = dir === 'down' ? 1 : -1;
      const col = from % cols, row = Math.floor(from / cols);
      for (let k = 1; k < rows; k++) {
        const r = ((row + step * k) % rows + rows) % rows;
        let best = -1, bd = Infinity;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (!this._held(q, i)) continue;
          const d = Math.abs(c - col);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) { this.cursor = best; break; }
      }
      // Nothing held on any other row — the chapter puts Cogblade, Cuff and
      // Boiler Key all in row 0, so a player who never buys the charm has an
      // empty row 1 and UP/DOWN would return false and play no sound at all.
      // Fall through to the ring so every arrow moves something.
      if (this.cursor === from) {
        for (let k = 1; k < n; k++) {
          const i = ((from + step * k) % n + n) % n;
          if (this._held(q, i)) { this.cursor = i; break; }
        }
      }
    }
    return this.cursor !== from;
  }

  /**
   * A on the highlighted well. Refuses the wells the B button does not take
   * and says so with the bank's own LOCKED - NO EFFECT sound.
   *
   * @returns {boolean} whether anything was assigned
   */
  assign(q = this._q) {
    const s = KIT_SLOTS[this.cursor];
    if (!q || !s || !s.flag || !q.has(s.flag)) return false;
    if (!s.b) { this._sfx('error'); return false; }
    setBItem(q, s.id);
    this._hooks();
    this._sfx('select');
    return true;
  }

  /**
   * ONE FRAME OF INPUT FOR THE GRID.
   *
   * Public because the two halves of the chapter reach the subscreen through
   * different doors: above ground `update()` runs it, below ground
   * scenes/dungeon.js owns the button and its map UI is wrapped to call this
   * (see `_hooks`, clause (d)). Either way the same method reads the same
   * four arrows and the same A.
   *
   * @param {object} input the engine Input
   * @param {object} [q]   the quest store; defaults to the latched one
   * @returns {boolean} whether the press did anything
   */
  pump(input, q = this._q) {
    if (!input || !q) return false;
    // ONE STEP PER FRAME, whoever calls. `input.hit` does not consume — the
    // engine clears `pressed` at the end of the frame — so a second caller on
    // the same frame would move the cursor twice on one press. That matters
    // the day scenes/game.js wires this explicitly and the seam patch below is
    // still installed: whichever runs first wins and the other is a no-op.
    const f = (typeof window !== 'undefined' && window.__engine && window.__engine.frame) || null;
    if (f !== null) { if (f === this._pumpF) return false; this._pumpF = f; }
    if (this.cursor < 0 || !this._held(q, this.cursor)) this.syncCursor(q);
    let acted = false;
    for (const d of ['left', 'right', 'up', 'down']) {
      if (!input.hit(d)) continue;
      if (this.moveCursor(d, q)) { this._sfx('cursor'); acted = true; }
      break;
    }
    if (input.hit('a') && this.assign(q)) acted = true;
    return acted;
  }

  _sfx(name) {
    try {
      if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
    } catch (e) { /* headless */ }
  }

  // --- the seam -------------------------------------------------------------

  /**
   * THREE THINGS THIS PANEL OWNS THAT LIVE IN FILES IT MAY NOT EDIT, in the
   * idiom the top of this file already uses (see guardDialogDraw, singleSfx):
   * patched per instance, from the one place that can see the whole
   * composition, idempotent, and inert until the player opens the subscreen.
   *
   * A run that never presses START installs nothing and behaves exactly as it
   * did before this class learned to move its cursor.
   *
   * (a) A NEW ITEM ARRIVES EQUIPPED — the Cuff goes on B the moment the chest
   *     in B4 opens, whatever was there before. Without this a player who set
   *     the Cogblade on B in minute three would find the Boilerworks' one
   *     tool inert and no obvious reason why.
   * (b) THE HUD'S ITEM BOX FOLLOWS THE CHOICE. scenes/game.js `syncHud` writes
   *     `hud.sprites.item` from its own cuff-then-cogblade expression on a
   *     dozen events; rather than race it, the slot becomes an accessor whose
   *     setter remembers what the composition wanted and whose getter answers
   *     with what the player picked. No call-order assumption, and the box is
   *     right on the very next frame drawn.
   * (c) The Boilerworks is built LAZILY, so (d) and (e) cannot be installed
   *     when the first subscreen opens above ground. The HUD's own draw — the
   *     one call guaranteed once a frame in both halves — carries the retry.
   * (d) ARROWS AND A, BELOW GROUND. scenes/game.js hands the dungeon's map UI
   *     this panel's `render`, but the dungeon still owns the button and its
   *     `update()` takes no input at all, so the grid was unreachable down
   *     there. Wrapped, it pumps the same cursor the overworld pumps.
   * (e) THE CUFF ONLY FIRES WHEN IT IS ON B. scenes/dungeon.js enables it on
   *     `quest.has('hasBellowsCuff')` alone; leaving that alone would make the
   *     assignment cosmetic, which is the bug this whole block exists to fix.
   * (f) AND THE COGBLADE FIRES WHEN IT IS ON B. game/combat.js swings on `a`
   *     and nothing else, so (e) on its own turned "COGBLADE on B" into a
   *     button that did nothing at all. Both halves, both melees. See
   *     `_bSwing` for why B is not allowed to steal the pot lift.
   */
  _hooks() {
    if (typeof window === 'undefined') return;
    const q = this._q;
    const g = window.__gwGame;
    if (!q || !g) return;

    // (a)
    if (!this._autoEquip && typeof q.on === 'function') {
      this._autoEquip = true;
      q.on('flag:hasBellowsCuff', (v) => { if (v) q.set('bItem', 'cuff'); });
    }

    const h = g.hud;
    // (b)
    if (h && h.sprites && !h.sprites.__gwBItem) {
      const icons = g.itemIcons || {};
      let wanted = h.sprites.item;
      Object.defineProperty(h.sprites, '__gwBItem', { value: true });
      Object.defineProperty(h.sprites, 'item', {
        configurable: true,
        get: () => {
          const id = bItemOf(this._q);
          const ic = id === 'cuff' ? icons.cuff : id === 'cogblade' ? icons.cogblade : icons.none;
          return ic || wanted;
        },
        set: (v) => { wanted = v; },
      });
    }
    // (c)
    if (h && typeof h.draw === 'function' && !h.__gwBPoll) {
      h.__gwBPoll = true;
      const inner = h.draw;
      h.draw = (c) => { this._hooks(); return inner.call(h, c); };
    }
    // (d)
    const mu = g.dg && g.dg.mapUI;
    if (mu && !mu.__gwBCursor) {
      mu.__gwBCursor = true;
      const inner = mu.update.bind(mu);
      mu.update = (...a) => {
        const r = inner(...a);
        if (!mu.open) { this._wasOpen = false; return r; }
        // The frame it opened on is carrying the START that opened it.
        if (!this._wasOpen) { this._wasOpen = true; this.syncCursor(); return r; }
        const inp = g.engine && g.engine.input;
        if (inp) this.pump(inp);
        return r;
      };
    }
    // (e)
    const cf = g.dg && g.dg.cuff;
    if (cf && typeof cf.update === 'function' && !cf.__gwBGate) {
      cf.__gwBGate = true;
      const inner = cf.update.bind(cf);
      cf.update = (input, player, opts) => {
        const o = Object.assign({}, opts);
        if (o.enabled !== false) o.enabled = bItemOf(this._q) === 'cuff';
        return inner(input, player, o);
      };
    }
    // (f) — the counterweight to (e), and the reason this panel can offer the
    //     choice at all. See `_bSwing`.
    for (const sc of [g.ow, g.dg]) {
      const m = sc && sc.melee;
      if (!m || typeof m.update !== 'function' || m.__gwBSwing) continue;
      m.__gwBSwing = true;
      const inner = m.update.bind(m);
      m.update = (input, ...rest) => inner(this._bSwing(input, sc), ...rest);
    }
  }

  /**
   * (f) THE B BUTTON SWINGS THE COGBLADE WHEN THE COGBLADE IS THE THING ON B.
   *
   * game/combat.js fires the blade on `a` and only on `a`, and clause (e) shuts
   * the Cuff off whenever the Cuff is not the item on B. Between them, "put the
   * COGBLADE on B" used to mean "put NOTHING on B": the panel took the press,
   * printed ON B, moved the brass ring and repainted the HUD's item box with
   * the sword, and then handed back a button that made no sound and did no
   * damage — in the BOSS room, a silent way to remove the fight's only answer.
   * No cartridge ever shipped a slot assignment that quietly killed a button.
   *
   * So B carries what the panel says it carries. A still swings, always: the
   * blade is in his hand whatever the grid says, exactly as ALttP never takes
   * the sword off its own button. Choosing the Cogblade for B is therefore a
   * real trade with a real cost — the Cuff comes off the button, which is a
   * loadout the player picked and can pick back in two presses — and never a
   * dead press.
   *
   * WHAT MELEE SEES is the same {hit, held} duck type scenes/dungeon.js's own
   * `maskA()` hands it, with `a` reading pressed for this one call. Nothing
   * else in the frame reads this object, so B does not talk, does not open a
   * chest and does not read a plaque.
   *
   * ABOVE GROUND B ALREADY LIFTS. A press spent on a pot is not a press spent
   * on a swing, and `world.carrying` is set by `tryLift` on the frame it
   * succeeds and before melee runs — so the lift claims the press and the blade
   * stays sheathed. (The frames after that one, the overworld does not call
   * melee at all while he is carrying.)
   */
  _bSwing(input, scene) {
    if (!input || typeof input.hit !== 'function') return input;
    if (bItemOf(this._q) !== 'cogblade') return input;
    if (!input.hit('b')) return input;
    if (scene && scene.world && scene.world.carrying) return input;
    return {
      held: (k) => input.held(k),
      hit: (k) => (k === 'a' ? true : input.hit(k)),
    };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} q     the quest store
   * @param {object} [map] { rooms, bossId, title, current, visited, hasMap,
   *                         hasCompass, keys, bigKey } — the Boilerworks, when
   *                         the player has been down it. Null above ground.
   */
  draw(ctx, q, map) {
    if (!this.open) return;
    this.render(ctx, q, map);
  }

  /**
   * The panel itself, drawn whether or not THIS object is the one holding the
   * button down: below ground scenes/dungeon.js owns `open` and hands the
   * frame over (see scenes/game.js makeDungeon), and one subscreen for the
   * chapter means one place that paints it.
   */
  render(ctx, q, map) {
    // The one place both halves are guaranteed to hand this panel the store.
    // Everything the seam does needs it, so it is latched here and nowhere
    // else — see `_hooks`.
    if (q) this._q = q;
    this._hooks();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const P = SUB_PANEL;
    drawBox(ctx, P.x, P.y, P.w, P.h);

    // --- column headings and the rules that carry them ----------------------
    drawDialogText(ctx, 'ITEMS', SUB.gridX, SUB.labelY, DIM);
    const mapTitle = (map && map.title) || 'THE BOILERWORKS';
    drawDialogTextCentered(ctx, mapTitle, SUB.mapCx, SUB.labelY,
      map && map.hasMap ? DIM : '#585c6c');
    ctx.fillStyle = RULE;
    ctx.fillRect(P.x + 8, SUB.ruleY, P.w - 16, 1);
    ctx.fillStyle = '#3a4258';
    ctx.fillRect(SUB.divX, SUB.ruleY + 6, 1, 142);

    this._grid(ctx, q);
    this._counts(ctx, q);
    this._floor(ctx, q, map);

    // THE FOOTER CARRIES BOTH VERBS THE PANEL HAS. It used to blink one line;
    // it now blinks two halves of the same line, so SELECT is discoverable
    // without a menu bar, a gear or anything else a cartridge never had.
    if (saveMenu.open) {
      drawDialogTextCentered(ctx, 'SELECT  -  SAVE', WIDTH / 2, SUB.footY, '#3a4258');
    } else if ((this.t % 44) < 30) {
      drawDialogTextCentered(ctx, 'SELECT  SAVE      START  CLOSE', WIDTH / 2, SUB.footY, DIM);
    }

    // ...and the save panel sits INSIDE the subscreen, over it, because that is
    // where a 1993 cartridge put it. Drawn here so both halves of the chapter
    // get it from one place: above ground scenes/game.js calls sub.draw(), below
    // ground the Boilerworks' own map button calls sub.render() (see game.js
    // makeDungeon), and this is the line both of them go through.
    saveMenu.draw(ctx);
  }

  // --- what he is carrying --------------------------------------------------

  /**
   * Six wells, three across. Held items are lit and carry their art; the rest
   * are dark and empty, which is how a 1993 subscreen says "not found yet".
   *
   * TWO MARKS, AND THEY MEAN DIFFERENT THINGS — which is the whole difference
   * between this and what it replaced. The WHITE BRACKET is the cursor: where
   * the player is looking, moved by the arrows. The DOUBLE BRASS RING is the
   * B button's item: what he chose, and what the HUD's item box is showing.
   * The name and the line under it follow the BRACKET, so he reads a thing
   * before he takes it.
   */
  _grid(ctx, q) {
    if (this.cursor < 0 || !this._held(q, this.cursor)) this.syncCursor(q);
    const onB = bItemOf(q);

    KIT_SLOTS.forEach((s, i) => {
      const x = SUB.gridX + (i % SUB.cols) * SUB.pitchX;
      const y = SUB.gridY + Math.floor(i / SUB.cols) * SUB.pitchY;
      const held = this._held(q, i);
      const lit = held && s.id === onB;
      this._well(ctx, x, y, held, lit);
      const img = held && s.icon ? this.icons[s.icon] : null;
      if (img) {
        ctx.drawImage(img,
          x + Math.round((SUB.well - img.width) / 2),
          y + Math.round((SUB.well - img.height) / 2));
      }
      if (i === this.cursor) this._cursor(ctx, x, y);
    });

    const s = this.cursor >= 0 ? KIT_SLOTS[this.cursor] : null;
    drawDialogText(ctx, s ? s.name : 'EMPTY HANDS', SUB.gridX, SUB.nameY, s ? INK : OFF);

    // WHAT A IS FOR, WHERE THE PLAYER IS LOOKING. Not a control legend bolted
    // to the panel: one line that changes with the cursor and answers the only
    // question the grid raises.
    let tag = '', col = DIM;
    if (s && s.b) {
      if (s.id === onB) { tag = 'ON B'; col = BRASS_LIT; } else { tag = 'A TO EQUIP'; }
    } else if (s) { tag = s.tag || ''; col = OFF; }
    if (tag) drawDialogText(ctx, tag, SUB.gridX, SUB.statusY, col);
  }

  /**
   * An item well: keyline, bevel, black interior. Dark when nothing is in it,
   * slate when it is held, and a DOUBLE BRASS RING when it is the item on the
   * B button.
   *
   * The B mark had to be readable with the cursor somewhere else on the grid,
   * and colour on its own is not a mark — so it changes the well's SHAPE. A
   * 22px well holds 16px of art centred at +3, which leaves exactly one free
   * interior pixel on each side: not enough for a badge or a corner tick, and
   * a tick drawn against the bevel just reads as a thicker bevel (measured).
   * The keyline, though, is unused — #1e1a22 on black, invisible — so the B
   * item lights it, and the well goes from a 1px border to a 2px one. Bright
   * outside, mid brass inside, no pixel of the icon touched.
   */
  _well(ctx, x, y, held, onB = false) {
    const w = SUB.well;
    ctx.fillStyle = onB ? BRASS_LIT : '#1e1a22';
    ctx.fillRect(x, y, w, w);
    ctx.fillStyle = onB ? BRASS : held ? RULE : '#3a3f4e';
    ctx.fillRect(x + 1, y + 1, w - 2, w - 2);
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 2, y + 2, w - 4, w - 4);
  }

  /** The cursor: a white bracket at the four corners of the well. */
  _cursor(ctx, x, y) {
    const w = SUB.well, x1 = x - 2, y1 = y - 2, s = w + 4;
    ctx.fillStyle = INK;
    for (const [cx, cy, dx, dy] of [
      [x1, y1, 1, 1], [x1 + s - 1, y1, -1, 1],
      [x1, y1 + s - 1, 1, -1], [x1 + s - 1, y1 + s - 1, -1, -1],
    ]) {
      ctx.fillRect(dx > 0 ? cx : cx - 5, cy, 6, 1);
      ctx.fillRect(cx, dy > 0 ? cy : cy - 5, 1, 6);
    }
  }

  // --- what he has counted --------------------------------------------------

  /**
   * The HUD's icons, the HUD's digits, the HUD's spacing — this is the same
   * strip the player reads while walking, moved onto the subscreen, rather
   * than a second way of writing down the same four numbers.
   */
  _counts(ctx, q) {
    const rows = [
      [this.icons.cog, String(Math.min(999, q.get('cogs'))).padStart(3, '0')],
      [this.icons.keyIcon, String(Math.min(99, q.get('smallKeys'))).padStart(2, '0')],
      [this.icons.piece, String(Math.min(99, q.get('heartPieces'))).padStart(2, '0')],
    ];
    rows.forEach(([img, count], i) => {
      const x = SUB.countX[i];
      if (img) {
        ctx.drawImage(img, Math.round(x + (count.length * 8) / 2 - img.width / 2), SUB.countY);
      }
      drawCounter(ctx, count, x, SUB.countY + 9);
    });
    if (this.hearts) this.hearts(ctx, SUB.heartX, SUB.heartY);
  }

  // --- where he has been ----------------------------------------------------

  /**
   * The Boilerworks floor plan: the dungeon's own map screen, moved into the
   * right-hand column so both halves of the chapter carry it. Same cells, same
   * door stubs, same brass boss pip, same blinking YOU ARE HERE.
   */
  _floor(ctx, q, map) {
    const ix = SUB.dgItemX, iy = SUB.dgItemY, ip = SUB.dgItemPitch;
    const dgItems = [
      [this.icons.map, map ? map.hasMap : q.has('dgnMap')],
      [this.icons.compass, map ? map.hasCompass : q.has('dgnCompass')],
      [this.icons.bigKey, map ? map.bigKey : q.has('bigKey')],
    ];
    dgItems.forEach(([img, has], i) => {
      const x = ix + i * ip;
      this._well(ctx, x, iy, has);
      if (has && img) {
        ctx.drawImage(img, x + Math.round((SUB.well - img.width) / 2),
          iy + Math.round((SUB.well - img.height) / 2));
      }
    });
    // small keys ride the last slot with their count beside them, as they do
    // on the dungeon's own screen
    const keys = map ? map.keys : q.get('smallKeys');
    const kx = ix + 3 * ip;
    this._well(ctx, kx, iy, keys > 0);
    if (keys > 0 && this.icons.smallKey) {
      ctx.drawImage(this.icons.smallKey, kx + Math.round((SUB.well - this.icons.smallKey.width) / 2),
        iy + Math.round((SUB.well - this.icons.smallKey.height) / 2));
      drawDialogText(ctx, 'x' + Math.min(9, keys), kx + SUB.well + 2, iy + 8, INK);
    }

    if (!map || !map.rooms) {
      // Above ground, before the hatch: the plan is a blank the same way the
      // dungeon items are — a slot with nothing in it yet.
      drawDialogTextCentered(ctx, 'NOT SURVEYED', SUB.mapCx, 92, '#585c6c');
      return;
    }
    const cw = SUB.cell[0], ch = SUB.cell[1], gap = SUB.gap;
    const cellRect = (r) => ({
      x: SUB.mapX + r.mx * (cw + gap), y: SUB.mapY + r.my * (ch + gap), w: cw, h: ch,
    });
    if (!map.hasMap) {
      const r = map.rooms[map.current];
      drawDialogTextCentered(ctx, 'NO MAP OF THIS PLACE', SUB.mapCx, 70, DIM);
      if (r) { const c = cellRect(r); this._cell(ctx, c, true); this._here(ctx, c); }
      drawDialogTextCentered(ctx, 'YOU ARE HERE', SUB.mapCx, 118, DIM);
      return;
    }
    for (const [id, r] of Object.entries(map.rooms)) {
      const a = cellRect(r);
      for (const [side, to] of Object.entries(r.doors || {})) {
        if (!map.rooms[to]) continue;
        const b = cellRect(map.rooms[to]);
        const both = map.visited.has(id) && map.visited.has(to);
        ctx.fillStyle = both ? '#c09a30' : '#4c463c';
        if (side === 'east') ctx.fillRect(a.x + a.w - 1, a.y + 7, gap + 2, 3);
        if (side === 'west') ctx.fillRect(b.x + b.w - 1, b.y + 7, gap + 2, 3);
        if (side === 'south') ctx.fillRect(a.x + 10, a.y + a.h - 1, 3, gap + 2);
        if (side === 'north') ctx.fillRect(b.x + 10, b.y + b.h - 1, 3, gap + 2);
      }
    }
    for (const [id, r] of Object.entries(map.rooms)) {
      const c = cellRect(r);
      this._cell(ctx, c, map.visited.has(id));
      if (map.hasCompass && id === map.bossId) this._boss(ctx, c);
      if (id === map.current) this._here(ctx, c);
    }
  }

  /** One room cell. Walked rooms are lit steel; unwalked are dark outline. */
  _cell(ctx, c, seen) {
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
    ctx.fillStyle = seen ? '#6c7888' : '#2c323c';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = seen ? '#4e5866' : '#22262e';
    ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }

  /** The boss marker: a brass gear-lock pip, only with the compass. */
  _boss(ctx, c) {
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x + 6, c.y + 4, 10, 9);
    ctx.fillStyle = '#c09a30';
    ctx.fillRect(c.x + 7, c.y + 5, 8, 7);
    ctx.fillStyle = '#e8c65c';
    ctx.fillRect(c.x + 8, c.y + 6, 6, 2);
    ctx.fillStyle = '#d9482b';
    ctx.fillRect(c.x + 10, c.y + 8, 2, 3);
  }

  /** YOU ARE HERE — a blinking pip, drawn over whatever else is in the cell. */
  _here(ctx, c) {
    if ((this.t >> 3) % 2 !== 0) return;
    ctx.fillStyle = '#1c120a';
    ctx.fillRect(c.x + 8, c.y + 4, 6, 9);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(c.x + 9, c.y + 5, 4, 7);
    ctx.fillStyle = '#d9482b';
    ctx.fillRect(c.x + 10, c.y + 6, 2, 5);
  }
}

// ---------------------------------------------------------------------------
// THE SAVE PANEL.  SELECT, on the subscreen, in both halves.
//
// WHAT THIS IS NOT. It is not a pause menu. There is no settings gear, no
// volume slider, no "SAVE GAME" button floating in a modal over the world, and
// no fifth phase in the state machine. A 1993 action-adventure had exactly two
// places it would write to the cartridge's battery: the subscreen, and the
// death screen. This is the first of them.
//
// WHY SELECT. A Link to the Past: press START for the item subscreen, then
// SELECT, and a three-line panel comes up over it — SAVE AND QUIT / SAVE AND
// CONTINUE / QUIT. That is the gesture, verbatim, and it is also the gesture
// that leaves A and the d-pad free for the item cursor the subscreen itself
// owns. src/engine.js already maps Shift to 'select' and nothing else in the
// chapter reads it.
//
// WHERE THE FRAME COMES FROM. dialog.js's own drawBox — the same 1px keyline /
// 2px white / 1px slate bevel / black well that every window in the game is
// made of — and the subscreen's own INK / DIM / RULE values. Nothing new is
// invented for it, because the panel is a smaller copy of the panel it is
// sitting on.
//
// It is a MODULE SINGLETON for the same reason the chapter has one Subscreen:
// one panel, one place that paints it, both halves. save.js drives it (see
// saveTick) and never imports it — the registration below is one-directional,
// so there is no import cycle to fall over.
// ---------------------------------------------------------------------------

// Centred on the subscreen it sits over, in BOTH axes: SUB_PANEL runs
// x 20..236 and y 18..206, so its centre is (128, 112) and a 152x96 panel
// lands at (52, 64). It clears the subscreen's own blinking footer at y 190,
// which keeps saying what the buttons do while the file panel is up.
const SAVE_PANEL = { x: 52, y: 64, w: 152, h: 96 };
const SAVE_ROWS = [
  { label: 'SAVE AND CONTINUE', act: 'save' },
  { label: 'SAVE AND QUIT', act: 'quit' },
  { label: 'RETURN', act: 'back' },
];
const SAVE_ROW_Y = 86;
const SAVE_ROW_PITCH = 15;
const SAVE_TEXT_X = SAVE_PANEL.x + 26;

export class SaveMenu {
  constructor() {
    this.open = false;
    this.i = 0;
    this.t = 0;
    this.msg = null;
    this.msgT = 0;
    /** Frames the panel has actually been driven for — read by probes. */
    this.frames = 0;
  }

  show() {
    this.open = true;
    this.i = 0;
    this.t = 0;
    this.msg = null;
    this.msgT = 0;
    beep('select');
  }

  close() { this.open = false; this.msg = null; this.msgT = 0; }

  /**
   * The panel owns the frame while it is up — saveTick empties the input after
   * this returns, so neither half-scene, neither subscreen and no autopilot
   * sees a press that was meant for this list.
   *
   * @param {object} input engine Input
   * @param {object} game  the GameScene
   */
  update(input, game) {
    if (!this.open) return false;
    this.t++;
    this.frames++;

    // While the result is on screen the list is frozen: a save that answered
    // must be READ before the panel takes another press.
    if (this.msgT > 0) {
      if (--this.msgT === 0 && this.msg !== null) {
        const done = this.msg === SAVED;
        this.msg = null;
        if (done) this.close();
      }
      return true;
    }

    if (input.hit('up')) { this.i = (this.i + SAVE_ROWS.length - 1) % SAVE_ROWS.length; beep('select'); }
    if (input.hit('down')) { this.i = (this.i + 1) % SAVE_ROWS.length; beep('select'); }
    if (input.hit('b') || input.hit('select')) { beep('select'); this.close(); return true; }
    if (input.hit('a') || input.hit('start')) this._choose(game);
    return true;
  }

  _choose(game) {
    const act = SAVE_ROWS[this.i].act;
    if (act === 'back') { beep('select'); this.close(); return; }
    const ok = writeSave(game);
    this.msg = ok ? SAVED : FAILED;
    this.msgT = ok ? 64 : 90;
    beep(ok ? 'secret' : 'error');
    if (ok && act === 'quit') {
      // Straight back to the title, where CONTINUE is now waiting. The
      // subscreen goes with it — the chapter is over for this sitting.
      this.msgT = 0;
      this.close();
      if (game.sub) game.sub.open = false;
      if (game.dg && game.dg.mapUI) game.dg.mapUI.open = false;
      resetTick();
      if (typeof game.returnToTitle === 'function') game.returnToTitle();
    }
  }

  draw(ctx) {
    if (!this.open) return;
    const P = SAVE_PANEL;
    drawBox(ctx, P.x, P.y, P.w, P.h);
    // THE FILE, BY NAME. The player typed it at NAME ENTRY and picked it off
    // the file select; this is the one place in the chapter that is talking
    // about the FILE rather than about Wren, so it is the one place the name
    // belongs. A run that never went through a file select (a `?beat=` warp)
    // has no name and gets the old header.
    let head = 'THE FILE';
    try { head = activeName() || head; } catch (e) { /* never fatal */ }
    drawDialogTextCentered(ctx, head, P.x + P.w / 2, P.y + 10, DIM);
    ctx.fillStyle = RULE;
    ctx.fillRect(P.x + 8, P.y + 20, P.w - 16, 1);

    SAVE_ROWS.forEach((r, n) => {
      const y = SAVE_ROW_Y + n * SAVE_ROW_PITCH;
      const on = n === this.i && this.msgT === 0;
      drawDialogText(ctx, r.label, SAVE_TEXT_X, y, on ? INK : DIM);
      if (on) this._pointer(ctx, SAVE_TEXT_X - 11, y);
    });

    const fy = P.y + P.h - 14;
    if (this.msg) {
      drawDialogTextCentered(ctx, this.msg, P.x + P.w / 2, fy,
        this.msg === SAVED ? '#f0d47c' : '#d9482b');
    } else if ((this.t % 44) < 30) {
      drawDialogTextCentered(ctx, 'B  TO  GO  BACK', P.x + P.w / 2, fy, '#6878a0');
    }
  }

  /** The list cursor: a solid 4x7 chevron, the one shape ALttP points with. */
  _pointer(ctx, x, y) {
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(x - 1, y - 1, 6, 9);
    ctx.fillStyle = INK;
    for (let r = 0; r < 7; r++) {
      const w = r <= 3 ? r + 1 : 7 - r;
      ctx.fillRect(x, y + r, w, 1);
    }
  }
}

const SAVED = 'SAVED.';
const FAILED = 'THIS MACHINE CANNOT SAVE.';

function beep(name) {
  try {
    if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(name);
  } catch (e) { /* headless capture */ }
}

/** The chapter's one save panel. */
export const saveMenu = new SaveMenu();
setSaveMenu(saveMenu);

// ---------------------------------------------------------------------------
// THE CARRION WING, through the boiler-hall skylight.
//
// This is the last image of the chapter — Vane's ship pulling away with the
// liftstone — and maps-dungeon.js draws it as four dark rects that the
// skylight's own grating bars then cover, leaving about a dozen flat black
// pixels drifting right. The title screen's dirigible is an order of magnitude
// better art, and this is the shot that has to carry the ending.
//
// maps-dungeon.js is not ours, so the shaft is REDRAWN over the top during the
// ending only (`ending > 0`): same rectangle, same three-step sky ramp, same
// cloud bands, same grating — and a ship with an envelope, shading, a lit
// crown, a gondola, a tail fin, a turning propeller and a red running light.
// 34x16 against the old 26x9, and drawn UNDER the bars it used to hide behind.
// During the fight the module's own dark version is left completely alone.
// ---------------------------------------------------------------------------

const SHAFT = { x: 80, y: 0, w: 96, h: 23 };

// Envelope cross-section: [inset from left, width] per row, nose to the right.
const HULL = [
  [9, 15], [6, 21], [3, 26], [1, 30], [0, 32], [0, 32], [1, 30], [3, 26], [6, 20],
];

// The shaft's two skies. `DECK` is what Bellows Isle can see of the world with
// the liftstone gone — the cloud deck it has fallen into, cold and close.
// `UPPER` is what it can see once the shard has it climbing again. The ending
// LERPS between them, so "It rises. Just enough." is a change of light and not
// a caption: a playtest measured the old version moving skylight luminance by
// 4.5% across the payoff line, which is to say not at all.
const DECK_CLOUD = ['#495364', '#333c4a'];
const UPPER_SKY = ['#4c84c4', '#78aee0', '#a8d0f0', '#d8ecfc'];
const UPPER_CLOUD = ['#e8f4ff', '#b4d8f4'];

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round((pa >> 16 & 255) + ((pb >> 16 & 255) - (pa >> 16 & 255)) * t);
  const g = Math.round((pa >> 8 & 255) + ((pb >> 8 & 255) - (pa >> 8 & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} lit    the dungeon's `ending` counter (frames since the kill)
 * @param {number} frame  engine frame, for the propeller
 * @param {object} pal    boilerworks DPAL (grating + keyline colours)
 * @param {object} [opts] `{ rise, ship }`, both 0..1 — the ENDING drives these
 *   (see class Ending). `rise` walks the sky from the cloud deck back up to
 *   open blue as the isle climbs; `ship` is how far the CARRION WING has got
 *   across the shaft. Omitted, the shot behaves exactly as it did before: full
 *   daylight, ship on the old 220-frame arc.
 */
export function drawSkylightOver(ctx, lit, frame, pal, opts) {
  const { x: X, y: Y, w: W, h: H } = SHAFT;
  const rise = opts && opts.rise !== undefined ? Math.max(0, Math.min(1, opts.rise)) : 1;
  const t = opts && opts.ship !== undefined
    ? Math.max(0, Math.min(1, opts.ship)) : Math.min(1, lit / 220);
  ctx.save();
  ctx.beginPath();
  ctx.rect(X, Y, W, H);
  ctx.clip();

  // --- the sky: three-step ramp, brightest at the horizon end
  const deck = [(pal && pal.d) || '#1a1e26', (pal && pal.Q) || '#2b3340',
    (pal && pal.f) || '#22262e', '#3a4250'];
  const ramp = UPPER_SKY.map((c, i) => mix(deck[i], c, rise));
  const steps = [0, 7, 14, 19];
  steps.forEach((y0, i) => {
    ctx.fillStyle = ramp[i];
    ctx.fillRect(X, Y + y0, W, (steps[i + 1] ?? H) - y0);
  });
  // The bands sink as the isle climbs — six pixels of parallax, which is what
  // makes the light change read as MOVEMENT rather than as a palette swap.
  const drop = Math.round(rise * 6);
  const cloudA = mix(DECK_CLOUD[0], UPPER_CLOUD[0], rise);
  const cloudB = mix(DECK_CLOUD[1], UPPER_CLOUD[1], rise);
  for (const [cx, cy, cw] of [[3, 4, 34], [22, 9, 20], [56, 6, 30], [10, 16, 42], [70, 18, 22]]) {
    ctx.fillStyle = cloudA;
    ctx.fillRect(X + cx, Y + cy + drop, cw, 2);
    ctx.fillStyle = cloudB;
    ctx.fillRect(X + cx + 3, Y + cy + 2 + drop, cw - 6, 1);
  }

  // --- the ship. Tracks the same arc the old blob did, so the beat times the
  //     same; it is simply legible now. It also CLIMBS — it is leaving for the
  //     upper isles — and it never parks: at t=1 it is hard against the far
  //     mullion, still in frame for the card, which is the shot.
  const sx = Math.round(X + 4 + t * (W - 42));
  const sy = Math.round(Y + 3 + Math.sin(lit * 0.05) * 2 - t * 3);

  const K = '#0b0a10';        // keyline / silhouette
  const HULL_D = '#241f30';   // shaded belly
  const HULL_M = '#3a3350';   // midtone
  const HULL_L = '#5c5476';   // crown, catching the sky
  const GLINT = '#8f88a8';

  // tail: a cross fin either side of a thin boom, so the back of the ship is
  // a shape and not a second black block butted against the envelope
  ctx.fillStyle = K;
  ctx.fillRect(sx - 1, sy + 1, 2, 3);      // dorsal fin
  ctx.fillRect(sx - 3, sy + 2, 4, 2);
  ctx.fillRect(sx - 1, sy + 7, 2, 3);      // ventral fin
  ctx.fillRect(sx - 3, sy + 7, 4, 2);
  ctx.fillRect(sx - 3, sy + 4, 4, 3);      // boom
  ctx.fillStyle = HULL_D;
  ctx.fillRect(sx - 2, sy + 5, 3, 1);

  // envelope: keyline pass, then an inset tone pass one pixel in
  HULL.forEach(([off, w], r) => { ctx.fillStyle = K; ctx.fillRect(sx + off, sy + r, w, 1); });
  HULL.forEach(([off, w], r) => {
    if (r === 0 || r === HULL.length - 1) return;
    ctx.fillStyle = r <= 2 ? HULL_L : r <= 5 ? HULL_M : HULL_D;
    ctx.fillRect(sx + off + 1, sy + r, w - 2, 1);
  });
  // one lit crown line and a nose glint: the two marks that make it a BALLOON
  ctx.fillStyle = GLINT;
  ctx.fillRect(sx + 11, sy + 1, 11, 1);
  ctx.fillRect(sx + 27, sy + 3, 2, 1);
  // belted seams down the envelope
  ctx.fillStyle = K;
  ctx.fillRect(sx + 12, sy + 1, 1, 7);
  ctx.fillRect(sx + 21, sy + 1, 1, 7);

  // gondola, slung under the middle
  ctx.fillStyle = K;
  ctx.fillRect(sx + 13, sy + 9, 10, 5);
  ctx.fillStyle = HULL_M;
  ctx.fillRect(sx + 14, sy + 10, 8, 2);
  ctx.fillStyle = '#c8a848';                 // two lit cabin windows
  ctx.fillRect(sx + 15, sy + 11, 2, 1);
  ctx.fillRect(sx + 19, sy + 11, 2, 1);
  ctx.fillStyle = K;                          // struts
  ctx.fillRect(sx + 14, sy + 8, 1, 1);
  ctx.fillRect(sx + 21, sy + 8, 1, 1);

  // propeller at the tail, three-frame turn
  const blade = Math.floor(frame / 3) % 3;
  ctx.fillStyle = K;
  ctx.fillRect(sx - 4, sy + 4, 2, 3);                       // hub, on the boom
  if (blade === 0) ctx.fillRect(sx - 5, sy, 1, 12);          // edge on
  else if (blade === 1) ctx.fillRect(sx - 6, sy + 3, 2, 6);  // half turned
  else ctx.fillRect(sx - 5, sy + 2, 1, 8);

  // red running light on the nose, blinking
  if (Math.floor(frame / 14) % 2 === 0) {
    ctx.fillStyle = '#e04030';
    ctx.fillRect(sx + 30, sy + 4, 2, 2);
  }

  // --- the grating, back on top: the ship is BEHIND the bars, as it was.
  const k = (pal && pal.k) || '#1c120a';
  const I = (pal && pal.I) || '#3a3630';
  ctx.fillStyle = k;
  for (let bx = X + 5; bx < X + W; bx += 10) ctx.fillRect(bx, Y, 3, H);
  ctx.fillRect(X, Y + 13, W, 3);
  ctx.fillStyle = I;
  for (let bx = X + 5; bx < X + W; bx += 10) ctx.fillRect(bx, Y, 1, H);
  ctx.fillRect(X, Y + 13, W, 1);
  ctx.restore();

  // the ledge the shaft is cut into, and its own keyline
  const R = (pal && pal.R) || '#c99a46';
  ctx.fillStyle = R; ctx.fillRect(X - 2, Y + H, W + 4, 1);
  ctx.fillStyle = k; ctx.fillRect(X - 2, Y + H + 1, W + 4, 1);
}

// ---------------------------------------------------------------------------
// THE ENDING.  STORY.md beat 6, staged.
//
// WHAT WAS THERE BEFORE. KETTLEBACK burst, Wren pressed A on the shard, and
// four pages of prose went past in the same window a villager says hello in,
// advanced by the player at whatever speed he mashed A. The last of those pages
// was replaced by a fifth — "TO BE CONTINUED / CHAPTER 2 / THE UPPER REACHES" —
// and the game then held that frame forever: a text box over a boiler hall,
// Wren standing in it with nothing to press. The payoff of the whole chapter
// was delivered in the furniture of an errand.
//
// Everything the beat needs already existed somewhere in the build and none of
// it was being staged. This class is the staging, and it is DATA plus a clock:
//
//   shard    the hall is cold and silent; what is under the boss is named
//   jam      Wren raises the shard — transition.js's own item-hold pose, which
//            is the game's existing grammar for "this object matters"
//   shudder  the isle answers: a big lurch, ceiling grit, the cradle lights
//   rise     the sky in the skylight walks back out of the cloud deck, the
//            clouds sink past, and the score comes back in (endingTheme)
//   ship     the CARRION WING crosses the shaft and climbs away
//   marla    her line, from the hatch above
//   look     no words. Wren, facing up, and the ship. Hold it.
//   card     TO BE CONTINUED, composed on the whole screen over the shot a
//            critic singled out as the one where art, story and framing all
//            land at once — see _drawCard()
//   fade     the hall dithers away UNDER the card; the card is what is left
//   hold     PRESS A -> back to the title screen, the way a cartridge does
//
// It runs itself. A player who does nothing sees the whole thing at its
// authored pace; the bot sees the identical sequence.
//
// AND WHAT A BUTTON DOES TO IT — the defect this class shipped with. Pressing A
// is what this game has trained the player to do for thirty minutes, and the
// first version answered it by teleporting the beat clock to `s.f - 14`. Two
// presses per page (a fast reader, not a masher) cut the five prose beats from
// 1249 frames to 101 — 92% of the ending deleted, Marla's line on screen for a
// third of a second — and, worse, the teleport DESYNCHRONISED the staging that
// the beat clock drives: `rise` snapped 0->1 in one frame so the isle popped
// instead of rising, the second shudder jolt at t=34 was jumped clean over, and
// the CARRION WING was a fifth of the way across the skylight when the card
// landed, so "the ship escapes" read as "a ship arrives".
//
// TWO RULES COME OUT OF THAT, AND THEY ARE THE LOAD-BEARING PART OF THIS FILE:
//
//   1. THE BEAT CLOCK IS NEVER TELEPORTED. `this.t` advances by one per frame,
//      always. A press cannot move it; a press can only shorten where the beat
//      ENDS, and never below the beat's own `min` — a floor set so a page holds
//      long enough to be read (~24 characters a second, the fast end of human)
//      and so a ramp keyed to the beat still completes inside it.
//   2. ANYTHING CONTINUOUS IS DRIVEN BY PROGRESS, NOT BY AUTHORED LENGTHS.
//      `ship` is a fraction of the frames actually spent in the four beats it
//      crosses, so it arrives at 1.0 on the card whatever the player pressed.
//
// So the answer to A is: complete the typewriter this frame (instant, visible,
// what the press is for), and then let the page end at its floor. The chapter
// still takes the controller off you — scenes/game.js empties the input every
// frame the sequence runs — it just no longer punishes you for having hands.
// ---------------------------------------------------------------------------

/** An input that reports nothing pressed — the sequence drives its own box. */
const STILL_INPUT = { hit: () => false, down: new Set(), pressed: new Set() };

export class Ending {
  /**
   * @param {object} o
   * @param {object} o.dg       the live DungeonScene
   * @param {object} o.box      a DialogBox this sequence owns outright
   * @param {object} o.sky      the chapter's SkyState
   * @param {object} o.quest    the quest store
   * @param {Function} o.sfx    play a bank sound by name
   * @param {Function} o.onFinish  called once, when the card goes up
   * @param {Function} o.onTitle   called when the player answers the card
   * @param {boolean} o.fast    ?bot=play — same beats, no waiting for hands
   */
  constructor(o = {}) {
    this.dg = o.dg || null;
    this.box = o.box || null;
    this.sky = o.sky || null;
    this.quest = o.quest || null;
    this.sfx = o.sfx || (() => { });
    this.onFinish = o.onFinish || (() => { });
    this.onTitle = o.onTitle || (() => { });
    this.fast = !!o.fast;

    this.running = false;
    this.i = -1;          // index into SCRIPT
    this.t = 0;           // frames in the current beat
    this.clock = 0;       // frames since the shard was picked up
    this.music = null;    // what syncMusic should be playing right now
    this.rise = 0;        // 0 cloud deck .. 1 open sky
    this.ship = 0;        // 0..1 across the skylight
    this.dim = 0;         // 0..4 dither steps over the hall
    this.prompt = false;  // PRESS A is up
    this.prose = false;   // this beat has a page in the window
    this.left = false;    // onTitle has been called
    this.rush = false;    // the player has asked THIS beat to end at its floor
    this._posed = false;
    this._shipDone = 0;   // frames actually spent in finished CARRION WING beats
    this._dimT = 0;
    this._cardT = 0;      // frames since the card went up (card + fade + hold)
    this._closed = false;
    this._jolt2 = false;
    this._big = null;     // offscreen canvas for the 2x headline
  }

  // Beat, how long it holds, and the FLOOR it may be shortened to by a player
  // who presses A (see the header). Prose beats spend their last 14 frames on
  // the window's own close wipe, so one page never cuts to the next.
  //
  // Every floor is a measurement, not a taste:
  //   shard   68 chars -> 162 reading frames + 14 wipe
  //   shudder 70 chars -> 176 + 14, and it must clear the second jolt at t=34
  //   rise    the SKY RAMP owns this one: 200 frames of climb + 60 to sit in
  //           it, so the isle can never pop
  //   ship    71 chars -> 178 + 14
  //   marla   60 chars -> 151 + 14  (the payoff line STORY.md names; at 60
  //           frames it was 9x faster than anyone can read)
  //   card    the title has to be LOOKED at before it may start dithering out
  //   fade    the dither needs ~90 frames to reach solid black
  static SCRIPT = [
    { n: 'shard', f: 190, prose: true, min: 176 },
    { n: 'jam', f: 150 },
    { n: 'shudder', f: 250, prose: true, min: 190 },
    { n: 'rise', f: 300, prose: true, min: 260 },
    { n: 'ship', f: 250, prose: true, min: 192 },
    { n: 'marla', f: 260, prose: true, min: 165 },
    { n: 'look', f: 150 },
    { n: 'card', f: 280, min: 190 },
    { n: 'fade', f: 170, min: 110 },
    { n: 'hold', f: Infinity },
  ];

  /** The four beats the CARRION WING crosses the skylight over. */
  static SHIP_BEATS = ['rise', 'ship', 'marla', 'look'];

  /** Index of a beat by name. */
  static at(n) { return Ending.SCRIPT.findIndex(s => s.n === n); }

  /** Frames from the shard to the card, at the authored pace. */
  static get TO_CARD() {
    let n = 0;
    for (const s of Ending.SCRIPT) { if (s.n === 'card') break; n += s.f; }
    return n;
  }

  get beat() { return (Ending.SCRIPT[this.i] || {}).n || null; }
  /** True once the card is up: the chapter is over, whatever else is drawn. */
  get carded() { return this.i >= Ending.at('card'); }

  /**
   * Where the CURRENT beat ends, in beat frames. The authored length, unless
   * the player has asked for the page and the beat has a floor to fall back to.
   * Never below `min`, and `min` is never below what the staging inside the
   * beat needs to finish.
   */
  _end(s) {
    if (!s) return Infinity;
    if (this.rush && s.min) return s.min;
    return s.f;
  }

  start() {
    if (this.running || this.i >= 0) return;
    this.running = true;
    this._enter(0);
  }

  /**
   * One frame. Called by scenes/game.js AFTER the dungeon has updated, so it
   * is immune to every early return inside DungeonScene.update — which is the
   * bug that made the old ending's clock stall behind its own dialogue.
   * @param {boolean} wantsA the player pressed A/B/START this frame
   */
  step(wantsA) {
    if (!this.running) return;
    const dg = this.dg;
    if (dg) {
      // The hall stays cold: every jet dead for the whole beat. A white steam
      // column firing through the chapter's last shot is the shot losing.
      if (dg.cur && dg.cur.vents) {
        for (const v of dg.cur.vents) { v.snuff = 999; v.grow = 0; }
      }
      // Wren does not act again in this chapter.
      if (dg.player) {
        dg.player.moving = false;
        dg.player.lock = true;
        dg.player.attackPose = false;
        dg.player.attackIndex = 0;
        dg.player.kbT = 0;
      }
      this.clock++;
      dg.ending = this.clock;              // the counter every other file reads
      if (dg.cur) dg.cur.skylight = this.clock;
    } else {
      this.clock++;
    }

    this.t++;
    this._tick(wantsA);
    if (this.box) this.box.update(STILL_INPUT);

    const s = Ending.SCRIPT[this.i];
    if (!s) return;
    if (this.t >= this._end(s) && this._settled(s)) this._enter(this.i + 1);
  }

  /** A beat may hold past its length if something it started is still running. */
  _settled(s) {
    if (s.n === 'jam') return !(this.dg && this.dg.tr && this.dg.tr.posing);
    if (s.n === 'hold') return false;
    return true;
  }

  _tick(wantsA) {
    const s = Ending.SCRIPT[this.i];
    if (!s) return;

    const end = this._end(s);

    // --- continuous ramps ---------------------------------------------------
    // THE ISLE CLIMBING, seen through the only window in the Boilerworks. The
    // ramp is a fraction of THIS beat's actual end, not of a constant, and it
    // is rate-limited on top of that: if a press shortens the beat under the
    // ramp's feet the sky still walks up at a sky's speed instead of cutting.
    if (s.n === 'rise') {
      const target = Math.min(1, this.t / Math.max(1, end - 60));
      this.rise = Math.min(target, this.rise + 0.01);
    } else if (this.i > Ending.at('rise')) this.rise = 1;

    // THE CARRION WING crosses from the moment the light comes back until the
    // card, and is still in frame when it lands — it is pulling away, not gone.
    //
    // Measured against the frames THE RUN ACTUALLY SPENDS in the four beats it
    // crosses: what has already elapsed, plus what is left of this one, plus
    // the authored length of the ones still to come. That is the fix for a ship
    // that used to arrive at 0.219 on a skipped run, because the old span came
    // off the static Ending.TO_CARD and the run no longer took that long.
    const k = Ending.SHIP_BEATS.indexOf(s.n);
    if (k >= 0) {
      let span = this._shipDone + end;
      for (let j = k + 1; j < Ending.SHIP_BEATS.length; j++) {
        span += Ending.SCRIPT[Ending.at(Ending.SHIP_BEATS[j])].f;
      }
      // Rate-limited for the same reason `rise` is: the span shrinks on the
      // frame a press shortens the beat, and a ship that jumps four pixels
      // sideways to make up the difference is a ship that teleports.
      const target = Math.min(1, (this._shipDone + this.t) / Math.max(1, span));
      this.ship = Math.max(this.ship, Math.min(target, this.ship + 0.006));
    } else if (this.i > Ending.at('look')) this.ship = 1;

    // TWO JOLTS, NOT ONE. transition.js clamps a lurch to at most ten frames
    // of shake whatever `frames` says (`jolt = clamp(frames, 6, 10)`), which is
    // right for the isle dropping and wrong for the isle CATCHING itself: one
    // 10-frame jolt is a stumble, and this beat is a stumble followed by the
    // thing holding. So the shudder is a hard jolt and then, 34 frames later, a
    // smaller one under the settling grit.
    //
    // Fired on CROSSING t=34, not on equalling it. The equality test was a
    // silent casualty of the old skip: the beat could be 22 frames long, so the
    // isle caught itself in one jerk and the second half of the gesture — the
    // part that reads as the thing holding — never happened at all.
    if (s.n === 'shudder' && this.t >= 34 && !this._jolt2 && this.dg && this.dg.tr) {
      this._jolt2 = true;
      this.dg.tr.lurch({ power: 4, frames: 8, dust: 'ceiling', count: 26 });
    }

    // THE HALL GOES, THE CARD STAYS. The card lands over the lit hall and holds
    // there — that is the shot — then the room dithers down under it while the
    // title does not move, and `fade` finishes the job in black.
    if (s.n === 'card') this.dim = this.t < 48 ? 0 : Math.min(2, (this.t - 48) / 70);
    else if (s.n === 'fade' || s.n === 'hold') {
      this.dim = Math.min(4, 2 + (++this._dimT) / 45);
    }

    // --- the window ---------------------------------------------------------
    // A press completes the typewriter this frame — instant, visible, and what
    // the button is actually for. A press after that asks the page to end at
    // its floor; it can never end sooner, and it never moves the clock.
    if (wantsA && s.min) {
      if (s.prose && this.box && this.box.node && !this.box._typed) {
        this.box.shown = this.box._pageChars;
      } else this.rush = true;
    }
    if (s.prose && !this._closed && this.t >= Math.max(1, this._end(s) - 14)) {
      this._closed = true;
      if (this.box) this.box.close();
    }

    // --- the last screen ----------------------------------------------------
    // The card's own clock runs across card + fade + hold, so the title is one
    // continuous object rather than three beats' worth of restarts.
    if (this.i >= Ending.at('card')) this._cardT++;
    if (s.n === 'hold') {
      this.prompt = this.t > 40;
      // A run with nobody at the keyboard still gets back to the title, so a
      // capture cannot deadlock on the last frame of the chapter either.
      const patience = this.fast ? 240 : 2400;
      if (!this.left && this.prompt && (wantsA || this.t > patience)) {
        this.left = true;
        this.onTitle();
      }
    }
  }

  _enter(i) {
    // Bank what this beat actually cost before leaving it: the CARRION WING is
    // measured in frames the run really spent, not frames it was budgeted.
    if (Ending.SHIP_BEATS.includes(this.beat)) this._shipDone += this.t;
    const s = Ending.SCRIPT[i];
    this.i = i;
    this.t = 0;
    this.rush = false;
    this._closed = false;
    if (!s) { this.running = false; return; }
    const dg = this.dg;
    const box = this.box;
    if (box && s.prose) box.close();

    switch (s.n) {
      case 'shard':
        // What is under the boss, and whose fault it is. Vane Skallet is named
        // exactly once in the chapter and this is the line: "all she left
        // behind" had no antecedent anywhere in the player-facing text.
        this.sfx('secret');
        if (box) box.say('Not the liftstone.\nA shard of it - all that\nVane Skallet left behind.');
        break;

      case 'jam':
        // THE ITEM-HOLD POSE, USED FOR ONCE ON THE THING IT IS FOR. White
        // flash, both arms up, sparks, fanfare — the game's own grammar for an
        // object that changes everything, spent here rather than narrated.
        if (dg && dg.player) dg.player.dir = 'up';
        if (dg && dg.tr && typeof dg.tr.getItem === 'function') {
          this._posed = dg.tr.getItem({
            img: dg.spr && dg.spr.shard, player: dg.player, auto: 110,
          });
        }
        break;

      case 'shudder':
        if (dg && dg.cur) dg.cur.cradleGlow = 1;
        if (this.quest) { try { this.quest.beat('shard'); } catch (e) { /* already fired */ } }
        // Transitions.lurch fires the `lurch` cue itself — no second call here.
        if (dg && dg.tr) dg.tr.lurch({ power: 7, frames: 56, dust: 'ceiling', count: 54 });
        if (box) box.say('The shard bites into the cradle.\nThe isle shudders - and\nstops falling.');
        break;

      case 'rise':
        this._shipDone = 0;                    // the WING's clock starts here
        if (dg && dg.tr) dg.tr.lurch({ power: 3, frames: 40, dust: 'ceiling', count: 22 });
        this.sfx('secret');
        this.music = 'ending';                 // the score comes back HERE
        if (this.sky) this.sky.setStage(3, { frames: 200 });
        if (box) box.say('It rises.\nJust enough.');
        break;

      case 'ship':
        if (box) box.say('Through the skylight: a black\nhull pulling away, and the\nrest of the stone with it.');
        break;

      case 'marla':
        if (box) box.say('Marla, from the hatch above:\n"That\'ll hold a week.\nMaybe two."');
        break;

      case 'look':
        // No words. Wren, facing up, and the ship. This is the beat STORY.md
        // ends on and the one the old version did not have at all.
        if (box) box.close();
        if (dg && dg.player) dg.player.dir = 'up';
        break;

      case 'card':
        // NOT A DIALOG BOX. The last image of Chapter 1 used to be the exact
        // 168x47 window Dockhand Pell complains about the weather out of,
        // parked in the bottom quarter of an otherwise black screen: measured
        // on the final frame, 96% of the picture was black, the top 74% of it
        // was empty, and the whole composition sat 85% of the way down. The
        // game already knows better — its own GAME OVER sets type on the
        // SCREEN, centred, with no window at all — so the card is composed the
        // same way here. @see _drawCard
        if (dg) dg._endCard = true;
        if (box) box.close();
        this._cardT = 0;
        this.onFinish();
        break;

      case 'fade':
      case 'hold':
      default:
        break;
    }
  }

  /** What the skylight should look like this frame. @see drawSkylightOver */
  skylight() { return { rise: this.rise, ship: this.ship }; }

  /**
   * The hall dimming away, the card, and the prompt. Drawn from inside the
   * dungeon's own UI pass so it shakes with the lurches and dims with the
   * scene, exactly like the HUD it replaced.
   */
  draw(ctx) {
    if (this.i < 0) return;
    if (this.dim > 0) ditherOver(ctx, this.dim);
    if (this.box) { try { this.box.draw(ctx); } catch (e) { /* close-wipe race */ } }
    if (this.carded) this._drawCard(ctx);
    // Under the card, in the same muted grey the GAME OVER card prompts in:
    // the one thing left in Chapter 1 that answers a button.
    if (this.prompt && (this._cardT % 48) < 30) {
      drawDialogTextCentered(ctx, 'PRESS  A', WIDTH / 2, 178, '#c8b8d8');
    }
  }

  /**
   * THE CHAPTER CARD, composed on the 256x224 screen.
   *
   * Three marks, centred on the frame the way the game's own GAME OVER is:
   *
   *     TO BE CONTINUED     the headline, the chapter's own 7px face blitted
   *                         at 2x so it is a TITLE and not a line of dialogue
   *     ---- * ----         a brass rule, the chapter's dungeon-plaque colour
   *     CHAPTER 2           the promise, small, under the rule
   *     THE UPPER REACHES
   *
   * The block's optical centre sits on y=110 against a screen centre of 112.
   * It goes up over the LIT hall — the skylight, the CARRION WING and the
   * cradle are all still on screen and the room only starts dithering down
   * seventy frames later — so the card lands ON the shot rather than after it.
   *
   * Everything is drawn with a black drop shadow, because for the first two
   * seconds it is type over artwork rather than type over a black well.
   */
  _drawCard(ctx) {
    const cx = WIDTH / 2;
    const a = this._cardT;
    if (a < 6) return;
    // THE MARKS ARRIVE IN READING ORDER, AND THE ROOM DECIDES WHEN. The
    // headline goes up over the lit hall, where it has clear wall above Wren
    // to sit on. The rule and the chapter line wait for the dither: they land
    // across the middle of the room, and drawn over a lit boiler hall they cut
    // straight through Wren and the cradle he just lit. So they come in as the
    // hall goes out, and by the time anyone reads them the picture is theirs.
    this._headline(ctx, 'TO BE CONTINUED', cx, 82);
    if (a > 88) {
      const w = Math.min(58, (a - 88) * 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.round(cx - w), 111, w * 2, 1);
      ctx.fillStyle = '#c8a048';
      ctx.fillRect(Math.round(cx - w), 110, w * 2, 1);
      if (w >= 58) {
        ctx.fillStyle = '#f0d890';
        ctx.fillRect(Math.round(cx) - 1, 109, 3, 1);
        ctx.fillRect(Math.round(cx), 108, 1, 3);
      }
    }
    if (a > 112) {
      drawDialogTextCentered(ctx, 'CHAPTER 2', cx, 122, '#ffffff', '#000000');
    }
    if (a > 128) {
      drawDialogTextCentered(ctx, 'THE UPPER REACHES', cx, 136, '#c8b8d8', '#000000');
    }
  }

  /**
   * The dialogue face at 2x. The glyph table is a bitmap, so the headline is
   * baked once into an offscreen canvas at 1x and blitted with smoothing off:
   * chunky, aligned to the pixel grid, the same letterforms the rest of the
   * chapter is set in. No canvas (a node import, a test) falls back to 1x.
   */
  _headline(ctx, text, cx, y) {
    if (!this._big) {
      try {
        const c = document.createElement('canvas');
        c.width = Math.ceil(dialogTextWidth(text)) + 2;
        c.height = 12;
        const g = c.getContext('2d');
        drawDialogText(g, text, 0, 0, '#ffffff', '#000000');
        this._big = { c, w: c.width, h: c.height };
      } catch (e) { this._big = { c: null }; }
    }
    const b = this._big;
    if (!b || !b.c) {
      drawDialogTextCentered(ctx, text, cx, y + 4, '#ffffff', '#000000');
      return;
    }
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    // b.w carries a pixel of shadow padding; centre the INK, not the canvas.
    ctx.drawImage(b.c, 0, 0, b.w, b.h,
      Math.round(cx - (b.w - 2)), Math.round(y), b.w * 2, b.h * 2);
    ctx.imageSmoothingEnabled = sm;
  }

  /** Probe surface: what beat, how far in, and what is on screen. */
  state() {
    return {
      running: this.running, beat: this.beat, i: this.i, t: this.t,
      clock: this.clock, rise: Number(this.rise.toFixed(3)),
      ship: Number(this.ship.toFixed(3)), dim: Number(this.dim.toFixed(2)),
      music: this.music, card: this.carded, prompt: this.prompt, left: this.left,
      // What the beat will actually run to this frame, and whether a button
      // shortened it — the two numbers a skip probe has to be able to see.
      end: this._end(Ending.SCRIPT[this.i]), rush: this.rush, cardT: this._cardT,
    };
  }
}

/**
 * Remember which quest listeners exist right now; the returned function drops
 * every listener added since.
 *
 * Needed because the chapter can now be played TWICE in one page load — the
 * card returns to the title screen — and both half-scenes subscribe to the
 * quest store in their own `init()` (sky, lurch, health, flag). Rebuilding the
 * overworld without this leaves the dead scene's five listeners wired to the
 * live store forever, so the second run's every lurch is also delivered to a
 * Transitions object nobody draws. One page load, one set of listeners.
 */
export function questScope(quest) {
  const before = new Map();
  if (!quest || !quest._subs) return () => { };
  for (const [k, s] of quest._subs) before.set(k, new Set(s));
  return () => {
    for (const [k, s] of quest._subs) {
      const b = before.get(k);
      for (const fn of [...s]) if (!b || !b.has(fn)) s.delete(fn);
    }
  };
}

/**
 * Push a warp's state into the quest store. Call AFTER the target scene's
 * init(), because src/scenes/overworld.js calls quest.reset() in its own.
 * `beats` are marked as already fired so their lurches do not all go off at
 * once the first time the player crosses a trigger.
 */
export function applyWarp(quest, name) {
  const w = WARPS[name];
  if (!w) return null;
  for (const [k, v] of Object.entries(w.flags || {})) quest.flags[k] = v;
  for (const id of w.beats || []) quest._fired.add(id);
  const beatN = (w.beats || []).length;
  if (beatN) quest.flags.beat = beatN;
  quest.flags.skyStage = w.sky || 0;
  return w;
}

// ---------------------------------------------------------------------------
// Curtain — the fade played between phases.
//
// Ordered dither, no alpha: five baked 256x224 stencils (BAYER < step*4), one
// drawImage each. FrontEnd in titlescreen.js does the same thing with 57,000
// fillRects per frame; blitting a baked stencil is the same picture for a
// thousandth of the work, which matters because this one runs while a live
// scene is still being drawn underneath it.
// ---------------------------------------------------------------------------

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

let STENCILS = null;
function stencils() {
  if (STENCILS) return STENCILS;
  STENCILS = [];
  for (let step = 0; step <= 4; step++) {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const c = cv.getContext('2d');
    c.fillStyle = '#000000';
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (BAYER4[y & 3][x & 3] < step * 4) c.fillRect(x, y, 1, 1);
      }
    }
    STENCILS.push(cv);
  }
  return STENCILS;
}

export class Curtain {
  constructor() {
    this.t = 0;
    this.out = 0; this.hold = 0; this.into = 0;
    this.onSwap = null; this.onDone = null;
    this.running = false;
    this.swapped = false;
  }

  /** True while the world underneath must not run. */
  get busy() { return this.running; }
  /** True once the screen is black enough to change everything behind it. */
  get black() { return this.running && this.t > this.out && this.t <= this.out + this.hold; }

  start({ out = 22, hold = 8, into = 22, onSwap, onDone } = {}) {
    this.t = 0; this.out = out; this.hold = hold; this.into = into;
    this.onSwap = onSwap || null; this.onDone = onDone || null;
    this.running = true; this.swapped = false;
    return true;
  }

  update() {
    if (!this.running) return;
    this.t++;
    if (this.t === this.out + 1 && !this.swapped) {
      this.swapped = true;
      if (this.onSwap) this.onSwap();
    }
    if (this.t > this.out + this.hold + this.into) {
      this.running = false;
      const cb = this.onDone;
      this.onDone = null; this.onSwap = null;
      if (cb) cb();
    }
  }

  /**
   * 0 (clear) .. 4 (solid black).
   *
   * The zero-length-leg cases are spelled out because the chapter uses one:
   * coming out of the front end the screen is ALREADY black (FrontEnd has
   * faded itself), so the curtain is started with `out: 0` and only fades up.
   * The old arithmetic computed `t / out` on the very first frame — 0/0, NaN
   * — which sailed past `if (s <= 0) return` (NaN is not <= 0) and handed
   * `stencils()[NaN]`, i.e. undefined, to drawImage. That throws, and
   * engine.js schedules the next rAF after draw(), so the game loop died
   * exactly there. It only ever bit when a rAF draw happened to land between
   * `curtain.start()` and the next fixed-step update, which is why it was
   * intermittent and why paused capture runs never saw it at all.
   */
  get step() {
    if (!this.running) return 0;
    if (this.out > 0 && this.t <= this.out) {
      return Math.min(4, Math.round((this.t / this.out) * 4));
    }
    if (this.t <= this.out + this.hold) return 4;
    const u = this.into > 0 ? (this.t - this.out - this.hold) / this.into : 1;
    return Math.max(0, Math.min(4, Math.round((1 - u) * 4)));
  }

  draw(ctx) {
    // Clamped, not trusted: nothing in this file may ever be the reason the
    // requestAnimationFrame loop stops.
    const s = Math.round(this.step);
    if (!(s > 0)) return;
    ctx.drawImage(stencils()[Math.min(4, s)], 0, 0);
  }
}

/**
 * One step of the curtain's dither, painted where the caller says rather than
 * over the whole frame at the end of it.
 *
 * The Curtain runs LAST (GameFlow.draw), on top of everything including the
 * chapter card, which is right for a phase change and wrong for the ending:
 * there the world has to go dark UNDER the card while the card stays lit. Same
 * five baked stencils, same ordered dither, no alpha — just called from inside
 * the scene's own UI pass. See class Ending's `fade` beat.
 *
 * @param {number} step 0 (clear) .. 4 (solid black)
 */
export function ditherOver(ctx, step) {
  const s = Math.round(step);
  if (!(s > 0)) return;
  ctx.drawImage(stencils()[Math.min(4, s)], 0, 0);
}

// ---------------------------------------------------------------------------
// The score.
//
// Four cues, one transport. `boilerworksTheme` and `kettlebackTheme` come from
// the dungeon's own music module; the field theme is audio.js's. The VILLAGE
// theme is that same field theme re-arranged rather than a fifth composition:
// drums out, lead pulled back and given more echo, arpeggio up, tempo down a
// sixth. Cogwick Hollow is the same tune heard from indoors, which is what a
// SNES score would have done with the cartridge space it had.
// ---------------------------------------------------------------------------

export function villageTheme() {
  const s = overworldTheme();
  return {
    name: 'Cogwick Hollow',
    bpm: Math.round(s.bpm * 0.82),
    loopTicks: s.loopTicks,
    bars: s.bars,
    channels: s.channels.filter(c => c.name !== 'DRUM').map((c) => {
      if (c.name === 'LEAD') return { ...c, gain: c.gain * 0.60, echo: 0.52 };
      if (c.name === 'HORN') return { ...c, gain: c.gain * 0.48 };
      if (c.name === 'ARP') return { ...c, gain: c.gain * 1.55, echo: 0.34 };
      return { ...c, gain: c.gain * 0.82 };
    }),
  };
}

/**
 * THE ENDING CUE — and why the last forty seconds of Chapter 1 had none.
 *
 * The hall goes deliberately silent the moment KETTLEBACK bursts, and nothing
 * ever turned the score back on: `trackFor` returns null for the whole ending,
 * so the shard, the rise, the ship and the card all played in dead air. A
 * playtester measured it and called it the chapter's best forty seconds spent
 * in silence.
 *
 * The silence is still right — for the shard. What was missing is the cue that
 * comes back in UNDER the isle rising, and it is the field theme again, the way
 * villageTheme is: two thirds the tempo, no drums, the lead carrying it with a
 * long tail and the horn brought forward. The first thing Wren hears after the
 * Boilerworks is the tune he walked in on, slower and in one piece — which is
 * the whole ending in one arrangement decision, and costs no new composition.
 */
export function endingTheme() {
  const s = overworldTheme();
  return {
    name: 'Just Enough',
    bpm: Math.max(40, Math.round(s.bpm * 0.66)),
    loopTicks: s.loopTicks,
    bars: s.bars,
    channels: s.channels.filter(c => c.name !== 'DRUM').map((c) => {
      if (c.name === 'LEAD') return { ...c, gain: c.gain * 0.9, echo: 0.62 };
      if (c.name === 'HORN') return { ...c, gain: c.gain * 1.15, echo: 0.42 };
      if (c.name === 'ARP') return { ...c, gain: c.gain * 0.5, echo: 0.5 };
      return { ...c, gain: c.gain * 0.72 };
    }),
  };
}

const TRACKS = {
  overworld: overworldTheme,
  village: villageTheme,
  dungeon: boilerworksTheme,
  boss: kettlebackTheme,
  ending: endingTheme,
};

// ---------------------------------------------------------------------------
// ONE MIXER FOR THE CHAPTER
//
// A 1993 cartridge had one sound chip. This build had FOUR places that could
// open a Web Audio context — sfx.js, ChapterMusic, DungeonMusic and dialog.js's
// self-contained text blip — and a real title-to-dungeon run opened three of
// them. What follows is the shared plumbing all of them are routed through:
// `findLiveChip` (whose graph is it), `joinHub` (how a second engine joins it),
// `joinSharedGraph` (make a foreign transport adopt it) and `oneDialogVoice`
// (make the text blip stop building its own).
// ---------------------------------------------------------------------------

/**
 * A live ChipEngine somebody else already built on a real (not offline)
 * context, if there is one. sfx.js publishes on `window.__gwChip` from both
 * SfxController.attach() and install(); the older `window.gwChip` /
 * `window.__gwAudio.chip` hooks are honoured too so an integrator that used
 * either of them still gets one graph.
 */
export function findLiveChip() {
  if (typeof window === 'undefined') return null;
  const cands = [window.__gwChip, window.gwChip,
    window.__gwAudio && window.__gwAudio.chip];
  for (const c of cands) {
    if (!c || !c.ctx || !c.master || !c.waves || !c.noiseBuf) continue;
    // never adopt an offline render's graph into the live chapter
    if (typeof c.ctx.startRendering === 'function') continue;
    let dead = false;
    try { dead = c.ctx.state === 'closed'; } catch (e) { dead = true; }
    if (!dead) return c;
  }
  return null;
}

/**
 * Point a second cue's engine at the hub's mixer: its channels land on the
 * hub's master lowpass and its echo sends on the hub's echo bus, so the
 * chapter still has exactly one delay tail and one output stream. `echoIn`
 * is swapped before any bus is built because _channelBus() reads it at
 * bus-creation time.
 */
export function joinHub(chip, hub) {
  if (!chip || !hub || chip === hub) return chip;
  try {
    chip.master.disconnect();
    chip.master.connect(hub.masterLP || hub.master);
    chip.echoIn = hub.echoIn;
  } catch (e) { /* keep its own chain rather than go silent */ }
  return chip;
}

/**
 * MAKE A FOREIGN MUSIC TRANSPORT JOIN THE CHAPTER'S GRAPH.
 *
 * `src/game/world/boilerworks-music.js`'s DungeonMusic is a second transport
 * with the same shape as ChapterMusic and a bare `new AudioContext()` in its
 * `_ctx()`. That file belongs to another piece, so the adoption is installed
 * here, per instance: `_ctx()` takes the published chip's context when there
 * is one, and any rig it then builds is routed into that hub's echo bus and
 * master lowpass. Order-independent — if the dungeon happens to be first, it
 * opens the one context and everybody else adopts IT.
 *
 * This is a safety net, not the main defence: scenes/game.js switches the
 * dungeon's transport off before the scene's first `_roomMusic`, because the
 * chapter's own score already plays the hall theme and a second copy of it is
 * wrong on ANY context. The net matters because the switch-off happened one
 * `await` too late once already, and cost 83 seconds of the hall theme playing
 * against itself at +4 dB.
 *
 * @param {{_ctx:Function,_rig:Function,rigs:Object}} music a DungeonMusic-alike
 */
export function joinSharedGraph(music) {
  if (!music || music.__gwShared || typeof music._ctx !== 'function') return music;
  music.__gwShared = true;
  const ownCtx = music._ctx.bind(music);
  music._ctx = function sharedCtx() {
    if (this.ctx) return this.ctx;
    const shared = findLiveChip();
    if (shared) { this.hub = shared; this.ctx = shared.ctx; return this.ctx; }
    return ownCtx();
  };
  if (typeof music._rig !== 'function') return music;
  const ownRig = music._rig.bind(music);
  music._rig = function sharedRig(kind) {
    const had = this.rigs && this.rigs[kind];
    const rig = ownRig(kind);
    // _ctx() ran inside ownRig and set `hub` if it adopted somebody's graph.
    if (rig && !had && this.hub && rig.chip !== this.hub) joinHub(rig.chip, this.hub);
    return rig;
  };
  return music;
}

/**
 * ONE VOICE FOR THE TEXT BLIP.
 *
 * `src/game/dialog.js` ships a self-contained blip: a raw square oscillator on
 * its OWN AudioContext, straight into `destination`. No 9 kHz master lowpass,
 * no echo bus, no voice stealing, a different clock — and it is how every line
 * Pell, Marla, Tam and Hesper speak actually sounds.
 *
 * sfx.js already tries to swap it, by defining an `sfx` accessor on
 * DialogBox.prototype — but it does that inside `import('./dialog.js').then()`,
 * asynchronously, and every DialogBox in the game is constructed before that
 * promise resolves. dialog.js's constructor then runs `this.sfx = { blip, … }`,
 * which on a prototype with no accessor yet creates an OWN DATA PROPERTY that
 * shadows the accessor permanently. Measured: 30 raw oscillator starts on a
 * private second context in the first 6,000 frames of a real chapter.
 *
 * Fixed by winning the race instead of running it. This is called at module
 * load from scenes/game.js — synchronously, before any scene exists — so the
 * accessor is already on the prototype when the constructor assigns, the
 * assignment goes through the SETTER, and no own property is ever created.
 * Instances that somehow predate the wiring are repaired by `oneVoiceBox()`.
 *
 * A scene that deliberately calls `setSfx()` still wins: the wrapper marks the
 * instance and the getter hands back its object. If the bank is not up yet
 * (headless capture, no gesture), the getter falls back to dialog.js's own
 * blip, so nothing that worked before goes silent.
 *
 * @param {Function} DialogBoxClass the class from dialog.js
 * @param {{dialogSfx:Function}} bank the sfx controller (src/game/sfx.js)
 */
export function oneDialogVoice(DialogBoxClass, bank) {
  const proto = DialogBoxClass && DialogBoxClass.prototype;
  if (!proto || proto.__gwOneVoice) return DialogBoxClass;
  // sfx.js's own async wiring got there first: leave its accessor alone.
  if (Object.getOwnPropertyDescriptor(proto, 'sfx')) return DialogBoxClass;
  const setSfx = proto.setSfx;
  if (typeof setSfx === 'function') {
    // The flag goes up AFTER the call, not before: dialog.js's setSfx merges
    // over `this.sfx`, so letting the getter answer with the bank first means a
    // scene that overrides only `blip` keeps `pick` and `move` on the chapter's
    // mixer instead of silently falling back to the raw oscillator.
    proto.setSfx = function markedSetSfx(s) {
      const r = setSfx.call(this, s);
      this.__gwSfxOverride = true;
      return r;
    };
  }
  Object.defineProperty(proto, 'sfx', {
    configurable: true,
    get() {
      if (this.__gwSfxOverride) return this.__gwSfxOwn;
      let voice = null;
      try { voice = bank && bank.dialogSfx ? bank.dialogSfx() : null; } catch (e) { voice = null; }
      return voice || this.__gwSfxOwn;
    },
    set(v) { this.__gwSfxOwn = v; },
  });
  proto.__gwOneVoice = true;
  return DialogBoxClass;
}

/**
 * Repair one DialogBox that was built before `oneDialogVoice` ran: move its own
 * `sfx` data property out of the way and back in through the setter, so the
 * prototype accessor takes over and its original object stays as the fallback.
 * No-op on a box that never had one.
 */
export function oneVoiceBox(box) {
  if (!box || !Object.prototype.hasOwnProperty.call(box, 'sfx')) return box;
  const own = box.sfx;
  delete box.sfx;
  box.sfx = own;      // through the accessor's setter -> __gwSfxOwn
  return box;
}

/**
 * THE WHOLE CHAPTER GETS ONE AUDIO GRAPH. The SPC700 had a single mixer; this
 * is the piece of the illusion that is architecturally rather than
 * cosmetically wrong when it breaks, and it broke: sfx.js opened its context
 * from scenes/game.js on the first button, then _ctx() did a bare
 * `new AudioContext()` on the same frame, so the effects never touched the
 * score's echo bus or master lowpass and the player heard the SUM of two
 * independent output streams.
 *
 * The rule now is order-independent: whichever subsystem initialises first
 * owns the mixer and publishes its ChipEngine on `window.__gwChip`, and the
 * other JOINS it. `_ctx()` adopts that context; `_rig()` plays the first cue
 * on that very engine, and later cues get their own ChipEngine — scheduleSong
 * caches its channel buses on the first call, so two songs on one engine
 * would play through each other's mixer — routed back into the hub's echo bus
 * and master lowpass, which keeps it one output stream either way.
 */
export class ChapterMusic {
  constructor() {
    this.ctx = null;
    /** The engine that owns the master chain and the echo bus for everybody. */
    this.hub = null;
    this.rigs = {};
    this.cur = null;
    this.enabled = true;
  }

  /** @see findLiveChip — kept as a method so subclasses can widen the search. */
  _sharedChip() { return findLiveChip(); }

  _ctx() {
    if (this.ctx) return this.ctx;
    // Join the graph that already exists before opening one of our own.
    const shared = this._sharedChip();
    if (shared) { this.hub = shared; this.ctx = shared.ctx; return this.ctx; }
    const AC = (typeof window !== 'undefined')
      && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { this.enabled = false; return null; }
    try { this.ctx = new AC(); } catch (e) { this.enabled = false; return null; }
    return this.ctx;
  }

  /** @see joinHub */
  _joinHub(chip, hub) { return joinHub(chip, hub); }

  _rig(kind) {
    if (this.rigs[kind]) return this.rigs[kind];
    const ctx = this._ctx();
    if (!ctx || !TRACKS[kind]) return null;
    let chip;
    if (!this.hub) {
      // Nothing was published: we are first, so we become the hub and say so.
      chip = new ChipEngine(ctx);
      this.hub = chip;
    } else if (!this.hub._buses) {
      // The hub exists but no song has claimed its channel buses — play the
      // score ON it, so the effects and the score are literally one engine.
      chip = this.hub;
    } else {
      chip = new ChipEngine(ctx);
      this._joinHub(chip, this.hub);
    }
    const rig = { chip, song: TRACKS[kind](), loopSec: 0, nextAt: 0, hub: chip === this.hub };
    this.rigs[kind] = rig;
    this.publish();
    return rig;
  }

  /** Let sfx.js share this graph so effects duck the score instead of fighting it. */
  publish() {
    if (typeof window === 'undefined') return;
    const chip = this.hub || (Object.values(this.rigs)[0] || {}).chip;
    if (chip && !window.__gwChip) window.__gwChip = chip;
  }

  resume() {
    const c = this.ctx;
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* needs a gesture */ } }
  }

  /** @param {'overworld'|'village'|'dungeon'|'boss'|null} kind */
  play(kind) {
    if (!this.enabled || kind === this.cur) return;
    try {
      this.stop();
      this.cur = kind;
      if (!kind) return;
      const ctx = this._ctx();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const rig = this._rig(kind);
      if (!rig) return;
      const t0 = ctx.currentTime + 0.06;
      rig.loopSec = rig.chip.scheduleSong(rig.song, t0, 2);
      rig.nextAt = t0 + rig.loopSec * 2;
      this.publish();
    } catch (e) { this.enabled = false; }
  }

  /** Top the schedule up so the loop never gaps. Once a frame. */
  update() {
    if (!this.enabled || !this.cur || !this.ctx) return;
    try {
      const rig = this.rigs[this.cur];
      if (!rig || !rig.loopSec) return;
      if (this.ctx.currentTime > rig.nextAt - rig.loopSec) {
        rig.chip.scheduleSong(rig.song, rig.nextAt, 1);
        rig.nextAt += rig.loopSec;
      }
    } catch (e) { this.enabled = false; }
  }

  stop() {
    if (!this.ctx) { this.cur = null; return; }
    for (const kind of Object.keys(this.rigs)) {
      const rig = this.rigs[kind];
      try {
        if (rig.hub) {
          // The hub's master carries the effects' echo tail as well as the
          // score. Cutting it here is what would take the whole chapter's
          // audio down with the cue, so silence the SCORE's own channel buses
          // and leave the mixer standing. `_buses` stays set, which is also
          // what routes the next cue onto its own engine.
          for (const b of (rig.chip._buses || [])) { try { b.disconnect(); } catch (e) { /* gone */ } }
        } else {
          rig.chip.master.disconnect();
        }
      } catch (e) { /* context already gone */ }
      delete this.rigs[kind];
    }
    this.cur = null;
  }
}

// ---------------------------------------------------------------------------
// GameFlow — the phase machine and the dramatic clock.
// ---------------------------------------------------------------------------

// STORY.md: "Every few minutes the island lurches." Beats carry most of them
// (five of the eight in quest.js fire one); this is the clock that keeps the
// isle moving while the player is exploring between beats. It resets whenever
// a beat fires its own lurch so the two never land on top of each other.
const AMBIENT_LURCH = 60 * 118;   // ~2 minutes

/**
 * The composition, for the one call a frame that save/load needs.
 *
 * GameScene publishes itself as `window.__gwGame` at the end of init() — the
 * handle the capture tool and every critic probe in this project already read
 * — so the flow can reach it without scenes/game.js having to hand it over. If
 * a future edit to that file prefers an explicit wire, set `flow.game = this`
 * in its constructor and this falls out of use with nothing else to change.
 */
function currentGameScene() {
  return (typeof window !== 'undefined' && window.__gwGame) || null;
}

export class GameFlow {
  /**
   * @param {object} o
   *   quest    the shared Quest store
   *   onPhase  (next, prev) => void — called at full black, swap scenes here
   */
  constructor(o = {}) {
    this.quest = o.quest;
    this.onPhase = o.onPhase || (() => { });
    this.phase = PHASE.FRONT;
    this.curtain = new Curtain();
    this.music = new ChapterMusic();
    this.lurchClock = 0;
    this.beats = [];
    this.indoor = false;
    this.warp = null;

    if (this.quest) {
      this.quest.on('beat', (id) => {
        this.beats.push(id);
        this.lurchClock = 0;      // a beat lurch resets the ambient clock
      });
    }
  }

  /** Fade out, swap the phase at black, fade back in. */
  go(next, opts = {}) {
    if (next === this.phase || this.curtain.busy) return false;
    const prev = this.phase;
    return this.curtain.start({
      out: opts.out ?? 24, hold: opts.hold ?? 10, into: opts.into ?? 24,
      onSwap: () => {
        this.phase = next;
        this.indoor = next === PHASE.DUNGEON;
        this.onPhase(next, prev);
      },
      onDone: opts.onDone,
    });
  }

  /** Jump with no fade (used by ?beat= at boot). */
  set(next) {
    this.phase = next;
    this.indoor = next === PHASE.DUNGEON;
  }

  /** The cue this moment of the chapter wants. */
  trackFor({ phase, screenId, roomArena, ending }) {
    if (ending) return null;
    if (phase === PHASE.DUNGEON) return roomArena === 'boss' ? 'boss' : 'dungeon';
    if (phase === PHASE.FRONT) return 'overworld';
    return VILLAGE_SCREENS.has(screenId) ? 'village' : 'overworld';
  }

  update() {
    this.curtain.update();
    this.music.update();
    // SAVE AND LOAD, from the one call a frame the chapter already makes.
    //
    // GameScene.update() calls flow.update() before it switches on the phase
    // and before either half-scene sees the frame, which is exactly where the
    // SELECT press for the save panel has to be read and consumed. It is also
    // where the deferred CONTINUE from the title screen is drained and where
    // the autosave beat key is compared — see save.js saveTick(), which is
    // three string reads on an ordinary frame. Hung here rather than on
    // scenes/game.js so save/load needed no edit to a file another piece owns.
    try { saveTick(this.game || currentGameScene()); } catch (e) { /* never fatal */ }
    if (this.curtain.busy) return;
    if (this.phase === PHASE.FRONT) return;
    if (++this.lurchClock >= AMBIENT_LURCH) {
      this.lurchClock = 0;
      this.quest.lurch({
        power: 2, frames: 8,
        dust: this.indoor ? 'ceiling' : 'ground',
        count: this.indoor ? 22 : 16,
      });
    }
  }

  draw(ctx) { this.curtain.draw(ctx); }
}

// ---------------------------------------------------------------------------
// THE AUTOPILOT.  ?bot=play
//
// src/scenes/dungeon.js ships a reactive autopilot that fights its way through
// the Boilerworks by writing into the real Input object. It has no counterpart
// above ground, so the chapter could never be walked end to end by a capture
// run — which is how "the chain breaks somewhere in the middle" stays
// invisible. This is that counterpart: a per-screen script, driven by the same
// breadth-first router the dungeon bot uses, pressing the same keys a player
// would press.
//
// It is data, not cleverness. Each screen lists what has to happen on it; the
// interpreter below handles approach, facing, dialogue and edges.
// ---------------------------------------------------------------------------

/**
 * Steps:
 *   { go:[fx, fy] }        walk until the FEET are within `slack` of a point
 *   { talk: 'Name' }       walk under a named NPC, face it, press A, read it out
 *   { cut: [c, r], from }  stand beside a bush tile and swing until it is gone
 *   { chest: [c, r], from} stand at a chest tile and press A (default: below)
 *   { gate: [c, r], from } stand at the gear-gate and press A (default: west)
 *   { exit: 'right' }      leave the board in a direction
 *   { portal: [fx, fy] }   walk onto the Boilerworks stair
 *   { timeout: n }         frames before the step gives up (default 1100)
 *
 * `from` is the side Wren stands on: 'east' | 'west' | 'north' | 'south'.
 * Coordinates are FEET positions (player.x + 8, player.y + 19), which is the
 * point every collision and interaction test in the game is written against.
 */
export const OW_PLAN = {
  // Beat 1. Pell complains about the weather; the isle answers him.
  dock: [{ talk: 'Pell' }, { go: [44, 150] }, { exit: 'up', timeout: 1800 }],
  dockroad: [{ go: [44, 60] }, { exit: 'up', timeout: 1600 }],
  // Beat 2. The village: Tam saw the ship, Marla gives up the Cogblade.
  villagew: [{ talk: 'Tam' }, { go: [204, 120] }, { exit: 'right', timeout: 1600 }],
  // The THORNWRACK across villagee's east edge is the chapter's one honest
  // gate: four screens of overworld sit behind it and nothing but the
  // Cogblade cuts it. So the route out of the Hollow is two swings, not a
  // walk — which is also the proof that Marla's gift is load-bearing.
  // THE THORNWRACK IS CUT AT ROW 5, ABOVE THE MILL DOOR.
  // The windmill moved to (196,50) and its door box now measures x 214-224,
  // y 108-130 — which is exactly the tile you have to stand on to swing at the
  // thornwrack at row 6 from the west. Standing there puts Wren inside the
  // mill instead of cutting, and (before the doorstep lock in scenes/game.js)
  // walking out put him straight back on it: villagee -> mill -> villagee,
  // twenty frames a lap, forever. Row 5 is cut from ABOVE the door instead,
  // and the second bush from the tile the first one vacated.
  villagee: [
    { talk: 'Marla' },
    { go: [190, 72] },
    { cut: [14, 5], from: 'north', timeout: 1500 },
    { cut: [15, 5], stand: [232, 90], face: 'right', timeout: 1500 },
    { exit: 'right', timeout: 1600 },
  ],
  // Beat 3. The traverse.
  bridge: [{ go: [230, 104] }, { exit: 'right', timeout: 1600 }],
  terrace: [{ go: [86, 150] }, { go: [86, 40] }, { exit: 'up', timeout: 1600 }],
  scrapfield: (q) => (q.has('hasBoilerKey')
    ? [{ go: [92, 96] }, { exit: 'right', timeout: 1600 }]
    : [{ go: [92, 96] }, { exit: 'left', timeout: 1600 }]),
  // The rim nook: cut the stopper bush, take the Boiler Key, go back.
  // The Boiler Key sits in a pocket walled by rock on three sides with a
  // single bush stopping the gap in the north wall — so the approach is from
  // ABOVE, and the chest is opened from inside the pocket.
  cliffnook: [
    { go: [92, 60] },
    { cut: [2, 5], from: 'north', timeout: 1400 },
    // Opened from the gap the bush was stopping: the chest itself fills the
    // only cell inside the pocket, so there is nowhere to stand below it.
    { chest: [2, 6], from: 'north', timeout: 1400 },
    { go: [96, 92] }, { exit: 'right', timeout: 1600 },
  ],
  // The gear-gate, then down the mouth.
  // The gear-gate is a 48x48 object whose INTERACT rect sits low on its face
  // (y+26..y+42), so the key turns from the causeway floor beside it, not
  // from the middle of its gears.
  mouth: [
    { gate: [5, 5], stand: [72, 112], face: 'right', timeout: 1400 },
    { go: [150, 104] },
    { portal: [212, 106], timeout: 2400 },
  ],
  // Interiors have no neighbours: the way out is the doorway on the bottom
  // row. Listed so a stray doorstep is a two-second detour and not a loop.
  shop: [{ talk: 'Hesper' }, { go: [128, 212] }],
  home: [{ go: [128, 212] }],
  mill: [{ go: [128, 212] }],
};

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// Screens whose only way out is the doorway on the bottom row.
const INTERIORS = new Set(['shop', 'home', 'mill']);
// Where to stand relative to a tile, and which way to face from there.
const FROM = {
  east: [22, 2, 'left'],
  west: [-22, 2, 'right'],
  north: [0, -20, 'down'],
  south: [0, 24, 'up'],
};

/**
 * Breadth-first route over a 16x14 collision grid; returns the next waypoint
 * to steer at. Identical in spirit to scenes/dungeon.js's `_nav` — a
 * straight-line probe cannot round the village's houses or the rim nook's
 * rock pocket, and a probe that cannot reach a screen's contents proves
 * nothing about whether the screen works.
 */
export function navStep(map, feetX, feetY, tx, ty) {
  const W = map.cols, H = map.rows;
  const free = (c, r) => map.boxFree(c * TILE + 2, r * TILE + 4, 12, 10);
  const sc = Math.max(0, Math.min(W - 1, Math.floor(feetX / TILE)));
  const sr = Math.max(0, Math.min(H - 1, Math.floor(feetY / TILE)));
  const key = (c, r) => r * W + c;
  const prev = new Map([[key(sc, sr), null]]);
  const q = [[sc, sr]];
  let best = [sc, sr];
  let bestD = Math.hypot(sc * TILE + 8 - tx, sr * TILE + 8 - ty);
  for (let i = 0; i < q.length; i++) {
    const [c, r] = q[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
      if (prev.has(key(nc, nr)) || !free(nc, nr)) continue;
      prev.set(key(nc, nr), [c, r]);
      q.push([nc, nr]);
      const d = Math.hypot(nc * TILE + 8 - tx, nr * TILE + 8 - ty);
      if (d < bestD) { bestD = d; best = [nc, nr]; }
    }
  }
  if (best[0] === sc && best[1] === sr) return { x: tx, y: ty };
  let cur = best, pv = prev.get(key(best[0], best[1]));
  while (pv && !(pv[0] === sc && pv[1] === sr)) { cur = pv; pv = prev.get(key(pv[0], pv[1])); }
  return { x: cur[0] * TILE + 8, y: cur[1] * TILE + 10 };
}

export class OverworldBot {
  constructor(quest) {
    this.quest = quest;
    this.screenId = null;
    this.steps = [];
    this.i = 0;
    this.t = 0;
    this.stuck = 0;
    this.unstick = 0;
    this.udir = 'down';
    this.last = { x: 0, y: 0 };
    this.sawBox = false;
    this.pushOff = 0;
    // See the combat rule in run(): an enemy the blade cannot finish must not
    // be allowed to hold the probe still for the rest of the run.
    this.foe = null;
    this.foeT = 0;
    this.giveUp = new Set();
  }

  _load(id) {
    if (id !== this.screenId) {
      // OFF THE DOORSTEP FIRST. leaveInterior() puts Wren back ten pixels
      // below the door he came out of, which is still inside the door's own
      // trigger box for a couple of frames — so a plan that immediately steers
      // north (villagee's does: Marla's hatch is above the mill door) walks
      // straight back in, comes straight out, and the run ping-pongs
      // villagee <-> mill forever. A player takes a step down. So does this.
      if (INTERIORS.has(this.screenId) && !INTERIORS.has(id)) this.pushOff = 45;
      this.screenId = id;
      const plan = OW_PLAN[id];
      this.steps = typeof plan === 'function' ? plan(this.quest) : (plan || []);
      this.i = 0; this.t = 0; this.sawBox = false;
      this.foe = null; this.foeT = 0; this.giveUp = new Set();
      return;
    }
    // A plan that ran out without leaving the screen starts again. Its
    // one-shot steps (a cut bush, an opened chest, a turned gate) test quest
    // marks and fall straight through, so the retry costs a frame and the
    // probe cannot deadlock on a single mistimed waypoint.
    if (this.steps.length && this.i >= this.steps.length) {
      this.i = 0; this.t = 0; this.sawBox = false;
    }
  }

  get done() { return this.i >= this.steps.length; }

  /**
   * Drive one frame. `s` is the OverworldScene-like object game.js hands over:
   * { world, player, box, melee, quest }. Writes straight into engine.input,
   * exactly as a keyboard would.
   */
  run(s, engine) {
    const inp = engine.input;
    inp.down.clear();
    const press = (k) => { inp.down.add(k); inp.pressed.add(k); };
    const hold = (k) => inp.down.add(k);
    const f = engine.frame;

    // The window and the transitions own the frame; answer them and wait.
    if (s.box.active) {
      this.sawBox = true;              // a talk/chest/gate step actually landed
      const node = s.box.node;
      // A shop menu would otherwise buy heart jars until the wallet is empty.
      if (node && node.type === 'shop' && s.box.menu) { if (f % 10 === 0) press('b'); return; }
      if (f % 9 === 0) press('a');
      return;
    }
    if (s.tr.busy) { if (f % 20 === 0) press('a'); return; }

    const screen = s.world.screen;
    this._load(screen.id);
    if (this.pushOff > 0) { this.pushOff--; hold('down'); return; }
    const p = s.player;
    const fx = p.x + 8, fy = p.y + 19;

    // Unstick: a probe wedged on a fence post proves nothing.
    if (Math.abs(p.x - this.last.x) < 0.4 && Math.abs(p.y - this.last.y) < 0.4) this.stuck++;
    else { this.stuck = 0; this.last.x = p.x; this.last.y = p.y; }
    // WEDGED IN THE SCRUB. The rim nook's thicket can close around the probe
    // completely: every neighbouring cell of the tile it is standing on holds
    // a bush, the breadth-first router finds no free cell to route through, and
    // it shuffles against the same hedge until the step times out — which is
    // how the Boiler Key went unfetched and the run looped scrapfield ->
    // cliffnook -> scrapfield forever. A player holding a blade cuts. So does
    // this, in whatever direction it is trying to leave in.
    if (this.unstick > 0) {
      this.unstick--;
      hold(this.udir);
      if (this.quest.has('hasCogblade') && this.unstick % 12 === 0) press('a');
      return;
    }
    if (this.stuck > 70) {
      this.stuck = 0; this.unstick = 26;
      this.udir = ['left', 'right', 'up', 'down'][Math.floor(engine.rand() * 4)];
      hold(this.udir);
      return;
    }

    const goTo = (tx, ty, slack = 4) => {
      const w = navStep(screen.map, fx, fy, tx, ty);
      if (w.x - fx > slack) hold('right'); else if (fx - w.x > slack) hold('left');
      if (w.y - fy > slack) hold('down'); else if (fy - w.y > slack) hold('up');
    };
    const face = (tx, ty) => {
      const dx = tx - fx, dy = ty - fy;
      if (Math.abs(dx) > Math.abs(dy)) hold(dx > 0 ? 'right' : 'left');
      else hold(dy > 0 ? 'down' : 'up');
    };
    const near = (tx, ty, r) => Math.hypot(tx - fx, ty - fy) <= r;

    // Anything with a hurtbox inside a blade's length gets dealt with first —
    // but on a CLOCK.
    //
    // The rim nook's gear-bat flies a patrol that keeps it inside a blade's
    // length of the rock pocket and above the arc of the swing, and an
    // unconditional "fight what is near you" rule meant the probe stood at
    // (205,128) swinging at it for four thousand frames, gave up on the Boiler
    // Key by timeout, walked out, came back and did it again: five laps of
    // scrapfield -> cliffnook -> scrapfield and the chapter never reached the
    // gear-gate. A player would simply walk past it. So an enemy that has not
    // gone down in three seconds of swinging is written off for this visit,
    // and the plan gets its legs back.
    if (this.quest.has('hasCogblade')) {
      const e = screen.enemies.find(x => !x.dead && x.hp > 0 && !this.giveUp.has(x)
        && Math.hypot(x.x + 8 - fx, x.y + 12 - fy) < 26);
      if (e !== this.foe) { this.foe = e || null; this.foeT = 0; }
      if (e) {
        if (++this.foeT > 180) { this.giveUp.add(e); this.foe = null; this.foeT = 0; }
        else { face(e.x + 8, e.y + 12); if (f % 12 === 0) press('a'); return; }
      }
    }

    const step = this.steps[this.i];
    if (!step) return;                            // plan exhausted: hold still

    const next = () => { this.i++; this.t = 0; this.sawBox = false; };

    // EVERY step is on a clock. A probe that can silently wait forever on one
    // unreachable waypoint reports "the chapter stalls in the village" when
    // what actually happened is that the bot's own arithmetic was wrong, and
    // that is the most expensive kind of false negative there is.
    this.t++;
    if (this.t > (step.timeout || 1100)) { next(); return; }

    if (step.go) {
      const [tx, ty] = step.go;
      if (near(tx, ty, 7)) { next(); return; }
      goTo(tx, ty);
      return;
    }

    if (step.talk) {
      const npc = screen.npcs.find(n => n.name === step.talk);
      if (!npc || this.sawBox) { next(); return; }
      // Villagers are solid (Screen.addNpc puts their footprint in the map),
      // so walking straight AT one parks Wren against it at exactly the
      // distance facingTarget() probes from. No stand-point arithmetic.
      const cx = npc.x + 8, cy = npc.y + 20;
      if (Math.hypot(cx - fx, cy - fy) > 22) { goTo(cx, cy, 3); return; }
      // ALTERNATE THE FACING. facingTarget() probes ONE point out of the feet
      // box along the current heading, and a villager approached corner-on
      // (Marla is 10px right and 11px down from where the router parks Wren)
      // lands that probe a pixel outside her footprint on the axis a simple
      // "face the bigger delta" rule picks — so the probe presses A forever
      // beside a woman it is not quite pointing at. Trying both axes turns a
      // one-pixel arithmetic accident into a non-issue.
      const dx = cx - fx, dy = cy - fy;
      const h = dx > 0 ? 'right' : 'left';
      const v = dy > 0 ? 'down' : 'up';
      const primary = Math.abs(dx) > Math.abs(dy) ? h : v;
      hold((Math.floor(this.t / 16) & 1) ? (primary === h ? v : h) : primary);
      if (f % 9 === 0) press('a');
      return;
    }

    // Stand-beside-a-tile-and-press: bushes, chests and the gear-gate all use
    // the same approach, only the side and the "am I done?" test differ.
    const beside = (cell, dflt, done, period) => {
      if (done()) { next(); return; }
      const [c, r] = cell;
      const [ox, oy, facing] = FROM[step.from || dflt];
      const tx = step.stand ? step.stand[0] : c * TILE + 8 + ox;
      const ty = step.stand ? step.stand[1] : r * TILE + 10 + oy;
      if (Math.hypot(tx - fx, ty - fy) > 9) { goTo(tx, ty, 4); return; }
      hold(step.face || facing);
      if (f % period === 0) press('a');
    };

    if (step.cut) {
      beside(step.cut, 'east',
        () => this.quest.marked(screen.id, 'bush', step.cut[0], step.cut[1]), 12);
      return;
    }
    if (step.chest) {
      beside(step.chest, 'south',
        () => this.quest.marked(screen.id, 'chest', step.chest[0], step.chest[1]), 14);
      return;
    }
    if (step.gate) {
      beside(step.gate, 'west', () => this.quest.has('gateOpen'), 14);
      return;
    }

    if (step.portal) {
      const [tx, ty] = step.portal;
      goTo(tx, ty, 2);
      return;
    }

    if (step.exit) {
      const [dx, dy] = DIRV[step.exit];
      const tx = dx ? (dx > 0 ? WIDTH + 10 : -10) : fx;
      const ty = dy ? (dy > 0 ? HEIGHT + 10 : -10) : fy;
      goTo(Math.max(-10, Math.min(WIDTH + 10, tx)), Math.max(-10, Math.min(HEIGHT + 10, ty)), 2);
      // Press into the edge once we are on it — edgeExit wants the key held
      // at the threshold, and the router stops steering once it runs out of
      // free cells to route through.
      const atEdge = dx > 0 ? fx > WIDTH - 26 : dx < 0 ? fx < 26
        : dy > 0 ? fy > HEIGHT - 30 : fy < 30;
      if (atEdge) hold(step.exit);
      return;
    }

    next();
  }
}

// ---------------------------------------------------------------------------
// DUNGEON NUDGE — a supervisor over scenes/dungeon.js's own autopilot.
//
// That autopilot fights, solves and routes well: given ?room=B2 it walks
// B2 -> B4 -> B5 -> B6 -> B7 unaided. It cannot clear B1, the first room of
// the chapter's dungeon, and the reason is structural rather than a mistake:
// its steam rule backs out of any tile within twelve pixels of a live jet, and
// B1's only route north is a TWO-TILE gap with a vent in each of those two
// tiles firing on opposite phases. There is never a moment when neither tile
// is "dangerous" by that test, so a probe that respects the rule can never
// cross — while a player just walks through the cold one. A bot-driven run of
// the chapter therefore stops in the first dungeon room.
//
// scenes/dungeon.js is not ours to edit, so this sits on top of it: when a
// room has held the probe for twenty-five seconds with nothing sealed and
// nothing left to fight, it takes the sticks for a few seconds and walks the
// shortest legal route to the onward door, jets and all. Hearts refill on a
// continue; a probe that cannot leave room one proves nothing about the seven
// rooms behind it.
// ---------------------------------------------------------------------------

const STALL_FRAMES = 1500;   // ~25 s in one room
const DRIVE_FRAMES = 900;    // ~15 s of taking the wheel
// When the ONLY way on is a lock the room's own autopilot has no rule for —
// B7's caged big key is the case — the duty cycle above spends three frames
// waiting for every one it works, and a run can sit in one room for two
// minutes doing almost nothing. A room with an outstanding lock and no open
// onward door gets the wheel sooner and keeps it longer.
const LOCK_STALL = 600;      // ~10 s of letting the room try first
const LOCK_DRIVE = 1800;     // ~30 s of working the lock

export class DungeonNudge {
  constructor(quest) {
    this.quest = quest;
    this.room = null;
    this.stall = 0;
    this.left = 0;
    // Crate-shove supervision. B7's plate sits diagonally from its crate, and
    // a single-axis shove pushes the crate to the end of ONE lane and then
    // keeps blasting it into the wall it is already against, forever — which
    // is exactly how an unseeded run of the chapter parked in B7 for eleven
    // thousand frames. So the shove watches the crate: if it has not moved
    // while being blasted, the other axis is tried instead.
    this.crateAt = null;
    this.crateStill = 0;
    this.axisFlip = false;
  }

  /**
   * The door this nudge would steer at: one that is legal to open AND leads
   * somewhere the run has not been. That last clause is what keeps the nudge
   * honest. B7's only unlocked door goes BACK to B6 until the big key is out
   * of its cage, so a nudge that just took the nearest open door would drag
   * the probe out of the room it is trying to solve, once every twenty-five
   * seconds, forever.
   */
  _target(dg) {
    const room = dg.cur, q = this.quest;
    for (const side of ['north', 'east', 'west', 'south']) {
      const d = room.doors[side];
      if (!d || !d.to || d.state === 'shut') continue;
      if (d.state === 'locked' && q.get('smallKeys') <= 0) continue;
      if (d.state === 'boss' && !q.has('bigKey')) continue;
      if (dg.visited && dg.visited.has(d.to)) continue;
      const z = DOOR_CELLS[side];
      return side === 'north' ? [z.x + 16, z.y + 2]
        : side === 'south' ? [z.x + 16, z.y + 30]
          : side === 'west' ? [z.x + 2, z.y + 16] : [z.x + 30, z.y + 16];
    }
    return null;
  }

  /**
   * The room's outstanding lock, when there is no onward door to walk to.
   * B7 is the case this exists for: its only open door goes back the way you
   * came until the caged big key is free, and the same steam rule that stops
   * the probe in B1 pins it in front of B7's RELENTLESS vent — the one the
   * room is built to teach you to snuff — pressing B at a jet that has no
   * rest cycle instead of ever reaching the gear-switch behind it.
   */
  _puzzle(dg) {
    const room = dg.cur;
    if (!room.cage) return null;
    // THE CAGE IS OPEN AND NOBODY TAKES THE PRIZE. B7's big key is in a CHEST
    // inside the cage, not lying on the floor, so opening the bars is only
    // half the job — and the moment the bars went the old test bailed out
    // (`cage.open` -> no puzzle), the nudge stood down, and the dungeon's own
    // autopilot has no rule for a chest it did not walk into. An unseeded run
    // parked in B7 with the cage open and the key still shut for seventeen
    // thousand frames. So the chest is part of the puzzle until it is open.
    if (room.cage.open) {
      const ch = room.cage.chest;
      return (ch && !ch.open) ? { kind: 'chest', obj: ch } : null;
    }
    const off = (room.switches || []).filter(s => !s.on);
    if (off.length) return { kind: 'switch', obj: off[0] };
    const plate = (room.plates || []).find(pl => !pl.down);
    if (plate && room.crates && room.crates.length) {
      let best = null, bd = 1e9;
      for (const c of room.crates) {
        const d = Math.hypot(c.x - plate.x, c.y - plate.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) return { kind: 'crate', obj: best, plate };
    }
    return null;
  }

  /** True when this frame's input should come from here instead. */
  wants(dg) {
    if (!dg || !dg.cur) return false;
    if (dg.curId !== this.room) {
      this.room = dg.curId; this.stall = 0; this.left = 0;
      this.crateAt = null; this.crateStill = 0; this.axisFlip = false;
    }
    if (dg.dialog.active || dg.tr.busy || dg.mapUI.open || dg.deathT > 0 || dg.deathHold) return false;
    const room = dg.cur;
    // Set pieces get all the time they want: a sealed arena and the boiler
    // hall are meant to hold you, and steering out of them would be lying.
    if (room.sealed || room.def.arena === 'boss') { this.stall = 0; this.left = 0; return false; }
    const target = this._target(dg);
    const puzzle = this._puzzle(dg);
    if (!target && !puzzle) { this.stall = 0; this.left = 0; return false; }
    if (this.left > 0) { this.left--; return true; }
    const locked = !target && !!puzzle;
    if (++this.stall >= (locked ? LOCK_STALL : STALL_FRAMES)) {
      this.stall = 0;
      this.left = locked ? LOCK_DRIVE : DRIVE_FRAMES;
      return true;
    }
    return false;
  }

  /** Walk to the onward door, or work the lock that is keeping it shut. */
  drive(dg, engine) {
    const inp = engine.input;
    inp.down.clear();
    const p = dg.player;
    const fx = p.x + 8, fy = p.y + 19;
    const hold = (k) => inp.down.add(k);
    const press = (k) => { inp.down.add(k); inp.pressed.add(k); };
    const goTo = (tx, ty, slack = 2) => {
      const w = navStep(dg.cur.map, fx, fy, tx, ty);
      if (w.x - fx > slack) hold('right'); else if (fx - w.x > slack) hold('left');
      if (w.y - fy > slack) hold('down'); else if (fy - w.y > slack) hold('up');
    };
    const face = (tx, ty) => {
      const dx = tx - fx, dy = ty - fy;
      if (Math.abs(dx) > Math.abs(dy)) hold(dx > 0 ? 'right' : 'left');
      else hold(dy > 0 ? 'down' : 'up');
    };

    const target = this._target(dg);
    if (target) {
      goTo(target[0], target[1]);
      if (engine.frame % 22 === 0) press('a');
      return;
    }

    const pz = this._puzzle(dg);
    if (!pz) return;
    if (pz.kind === 'chest') {
      // Stand on the tile below the chest, face it, press A. Same approach
      // the overworld plan uses for the Boiler Key.
      const ch = pz.obj;
      const tx = ch.x + 8, ty = ch.y + 30;
      if (Math.hypot(tx - fx, ty - fy) > 8) { goTo(tx, ty); return; }
      hold('up');
      if (engine.frame % 14 === 0) press('a');
      return;
    }
    if (pz.kind === 'switch') {
      // Stand under the gear-switch and blast it. The Cuff is the verb.
      const g = pz.obj;
      const tx = g.x + 8, ty = g.y + 36;
      if (Math.hypot(tx - fx, ty - fy) > 9) { goTo(tx, ty); return; }
      hold('up');
      if (engine.frame % 10 === 0) press('b');
      return;
    }
    // Crate onto plate: line up on the far side of the crate along whichever
    // axis the plate lies on, then blow it down the channel.
    //
    // B7's plate is DIAGONAL from its crate, so one axis is never enough: the
    // crate reaches the end of its lane, the dominant axis stays the same
    // because the remaining offset on it is still the larger one, and the
    // shove goes on hammering a crate that is already against a wall. Watch
    // the crate; when a shove stops moving it, take the other axis.
    const c = pz.obj, pl = pz.plate;
    const cx = c.x + 8, cy = c.y + 8;
    if (!this.crateAt || Math.hypot(cx - this.crateAt[0], cy - this.crateAt[1]) > 2) {
      this.crateAt = [cx, cy];
      this.crateStill = 0;
    } else if (++this.crateStill > 150) {
      this.crateStill = 0;
      this.axisFlip = !this.axisFlip;
    }

    const ax = (pl.x + 8) - cx, ay = (pl.y + 8) - cy;
    let horiz = Math.abs(ax) > Math.abs(ay);
    if (this.axisFlip) horiz = !horiz;
    // A flip onto an axis that is already lined up would shove the crate off
    // the plate's row again, so only flip while there is somewhere to go.
    if (horiz && Math.abs(ax) < 6) horiz = false;
    else if (!horiz && Math.abs(ay) < 6) horiz = true;

    const [ux, uy] = horiz ? [Math.sign(ax) || 1, 0] : [0, Math.sign(ay) || 1];
    const tx = cx - ux * 26, ty = cy - uy * 26 + 6;
    if (Math.hypot(tx - fx, ty - fy) > 10) { goTo(tx, ty); return; }
    face(cx, cy);
    if (engine.frame % 12 === 0) press('b');
  }
}
