// THE BOILERWORKS — the playable dungeon scene (STORY.md beats 4-6).
//
// Seven rooms plus the boss arena, wired to the shared modules: Player,
// Melee (Cogblade), HUD, DialogBox, Transitions, Quest. Nothing outside
// src/game/world/, src/game/items.js, src/game/boss-kettleback.js and this
// file is edited — everything else is imported through its public API.
//
// FOR INTEGRATION
//   new DungeonScene({ startRoom, onExit, onFinish })
//   All dungeon state lives in the shared `quest` store (hasBellowsCuff,
//   smallKeys, bigKey, dgnMap, dgnCompass, heartPieces, halves), and the
//   chapter beats `boilerworks` / `cuff` / `bossDoor` / `shard` fire from
//   here, so the overworld scene can subscribe to quest events for the sky
//   stage and the lurch without knowing anything about this file.
//
// URL switches (used by tools/capture.js, which appends its own params):
//   ?scene=dungeon&room=B5      start in a given room
//   &give=cuff,map,keys,bigkey,all,seen   grant items / reveal the map
//   &debug=1                    room + boss + inventory readout
//   &bot=play                   drive the real Input from a reactive
//                               autopilot, so a capture run actually FIGHTS
//                               (it presses the same keys a player would)

import { WIDTH, HEIGHT, TILE } from '../engine.js';
import { Player } from '../game/player.js';
import { Melee } from '../game/combat.js';
import { HUD } from '../game/hud.js';
import { DialogBox, drawDialogText, dialogTextWidth } from '../game/dialog.js';
import { Transitions } from '../game/transition.js';
import { quest } from '../game/quest.js';
import sfx from '../game/sfx.js';
import { ClockworkBeetle, GearBat } from '../game/enemies.js';
import {
  makeBoilerworks, TinSoldier, Riveter, FLOOR_PX, OPPOSITE, DOOR_CELLS, Canister,
} from '../game/world/boilerworks.js';
import {
  ROOMS, MAP_ROOMS, Room, spawnAt, ENTRY_ROOM, BOSS_ROOM, Pickup,
  DUNGEON_NAME, drawCradle,
} from '../game/world/maps-dungeon.js';
import { makeEnemySprites } from '../game/enemies.js';
import {
  BellowsCuff, makeItemSprites, DungeonMapUI, applyDungeonHud,
} from '../game/items.js';
import { Kettleback } from '../game/boss-kettleback.js';
import { DungeonMusic } from '../game/world/boilerworks-music.js';
// THE B BUTTON'S ITEM, from the one place that owns it. Round 28 gave the
// player a real inventory cursor, so what B carries is now a CHOICE and this
// room may no longer assume it. `bItemOf` is the same reader the subscreen,
// the HUD's item box and the Cuff's own enable gate use; `B_SLOTS` is where
// the item's printed name lives. Imported, never restated — a second copy of
// this rule in the boss room is a second copy that can go stale.
// (gameflow.js imports engine/enemies/audio/boilerworks/hud and nothing under
// scenes/, so this edge adds no cycle.)
import { bItemOf, B_SLOTS } from '../game/gameflow.js';

const ARENA = { x: FLOOR_PX.x, y: FLOOR_PX.y, w: FLOOR_PX.w, h: FLOOR_PX.h };

// Live gameplay frames between two rings of the locked-door rebuff while the
// player leans on the door. See _lockRebuff(). 24 f = 0.4 s, comfortably above
// sfx.js's own `error.minGap` of 0.20 s, so every call the throttle lets
// through is a sound the bank actually voices.
const LOCK_SFX_GAP = 24;

// How many times, across a whole visit to the arena, the room will point out
// that the Cuff is not on the button. Once per attempt (re-armed by a death),
// three in total — after that the player has been told, and a boss room that
// keeps saying the same thing is a boss room that is arguing with you.
const SHELL_TELLS = 3;

// ---------------------------------------------------------------------------
// THE HEALTH ECONOMY
// ---------------------------------------------------------------------------
//
// The Boilerworks shipped with ZERO drops. world/overworld.js:4357 rolls
// 55% cog / 17% heart on every kill above ground and there was no equivalent
// below it, and no pots either — so across seven rooms and a boss the only
// heals in the dungeon were B6's heart piece and KETTLEBACK's own phase
// drops. Measured on the shipping autopilot, halves per room:
//
//   B1 4 -> B2 4 -> B4 3 -> B5 2 -> DEATH -> B6 5 -> B7 1 -> DEATH -> DEATH
//   -> BOSS on one half
//
// Deaths on the way to the climax, and because Continue refills to 6/6 the
// cheapest heal in the game was suicide. That is the one un-ALttP thing in
// the build: Eastern Palace is wall-to-wall pots.
//
// AFTER, over six seeds of the same autopilot on the same build with the
// economy switched off and on (tools/critic/bd-econ.js off | on):
//   deaths          9.2 -> 5.2 mean
//   halves at BOSS  2.2 -> 4.8 mean   (1/1/1/3/4/3 -> 6/5/3/4/5/6)
// The remaining deaths are B5's steam gauntlet and B6's Riveter, which are
// room designs three critics signed off; the economy is what changed.
//
// The rates are DELIBERATELY leaner than the overworld's. Above ground a cog
// is the point (Hesper's charm costs 100 of them); down here the point is
// health, and a dungeon that hands out a heart every other kill is a dungeon
// with no attrition at all. So: fewer cogs, a slightly better heart, and the
// ALttP low-health bias — the table gets kinder the closer the row is to
// empty, which is exactly what makes a comeback feel earned rather than
// scripted. See _heartChance.
const KILL_COG = 0.36;      // 36% cog on a dungeon kill (overworld: 55%)...
const KILL_HEART = 0.18;    // ...then 18% heart (overworld: 17%)

// A canister is a bigger promise than a kill — you spent a swing on it
// deliberately — so it pays hearts more often and cogs less.
const POT_COG = 0.28;
const POT_HEART = 0.26;

// WHERE THE CANISTERS STAND — [col, row] or [col, row, loot].
//
// This table lives HERE and not in the room defs on purpose: maps-dungeon.js
// owns the room graph and its lessons, and this file owns what the player
// spends walking through them. Every cell is re-checked against the map the
// room actually builds (see _fitCanisters), so a cell that collides with a
// block, a crate, a pillar or a chest is dropped rather than drawn inside it.
//
// Placement rules used below:
//   - never in a doorway, a vent column, a crate channel or a switch approach
//     (B5's cage is a 280-frame round trip and B7's plate is the big key);
//   - never in the boss arena — KETTLEBACK owns its own drop table, and three
//     critics signed off on that fight exactly as it stands;
//   - spread across the room rather than pooled, so whichever door a hurt
//     player comes in by there is one he can reach without crossing the room.
//
// Every cell below was audited with tools/critic/bd-canisters.js, which
// re-derives the cell from the live room and also checks that Wren can STAND
// somewhere he can swing from: five first-draft cells were dropped for having
// masonry (B1 c3r7, B2 c13r3), a pit (B2 c2r6) or the south wall (B7 r11)
// against the only face the blade could reach them from.
const CANISTERS = {
  // Four in the entry room. B1 is where a player who came down the ladder
  // already hurt lands, and it is the only room he can reach from the hatch
  // without spending a heart to get there.
  B1: [[5, 10], [11, 10], [12, 7], [3, 7]],
  B2: [[13, 2], [5, 10], [2, 5]],
  B3: [[11, 2], [2, 8], [13, 6]],
  B4: [[5, 3], [10, 3], [13, 7]],
  B5: [[2, 10], [10, 9], [5, 10], [8, 4]],
  B6: [[2, 9], [13, 9], [4, 10]],
  // The last stop before the boiler-hall door, so four — but ALL of them east
  // of the crate channel and clear of both vent columns. c7 is left alone on
  // purpose: it is the lane the big-key crate slides down, and c6r6 is where
  // Wren has to stand to blow it there.
  B7: [[10, 10], [8, 4], [10, 6], [6, 10]],
};

// Item-get copy. Three lines maximum and no line over 28 characters — the
// hold-pose box is 208px of 7px glyphs and it does not wrap.
const ITEM_COPY = {
  cuff: ['You got the BELLOWS CUFF!', 'Press B for a blast of air.',
    'Gears spin. Steam dies.'],
  cogs: ['FIFTY COGS.', 'Somebody was saving up.'],
  map: ['A MAP of the Boilerworks.', 'Press START to read it.'],
  compass: ['The COMPASS.', 'It points at whatever is', 'heaviest down here.'],
  smallKey: ['A SMALL KEY.'],
  bigKey: ['The BIG KEY! Brass and warm.', 'Something below still turns.'],
  heartPiece: ['A PIECE OF HEART!'],
};

export default class DungeonScene {
  /**
   * @param {object} opts  integration hooks — all optional:
   *   startRoom  room id to open in (default B1, the hatch landing)
   *   onExit     called when Wren climbs back out of B1's south hatch
   *   onFinish   called once the shard is in the cradle and the chapter's
   *              closing text has been dismissed
   */
  constructor(opts = {}) {
    this.opts = opts;
  }

  async init(engine) {
    this.engine = engine;
    const p = engine.params;

    // --- debug switches
    const give = (p.get('give') || '').split(',').filter(Boolean);
    const all = give.includes('all');
    if (all || give.includes('cuff')) quest.set('hasBellowsCuff', true);
    if (all || give.includes('map')) { quest.set('dgnMap', true); quest.set('dgnCompass', true); }
    if (all || give.includes('keys')) quest.flags.smallKeys = 2;
    if (all || give.includes('bigkey')) quest.set('bigKey', true);
    if (!quest.has('hasCogblade')) quest.set('hasCogblade', true);
    this.bot = p.get('bot') || null;

    // --- shared art
    const bw = makeBoilerworks();
    this.tiles = bw.tiles;
    this.spr = bw.sprites;
    this.itemSpr = makeItemSprites();
    this.enemySpr = makeEnemySprites();

    // --- systems
    this.player = new Player(120, 168);
    this.melee = new Melee();
    this.cuff = new BellowsCuff();
    this.dialog = new DialogBox();
    this.tr = new Transitions({ rand: () => engine.rand() });
    this.hud = new HUD({ maxHearts: quest.get('maxHearts'), halves: quest.get('halves') });
    applyDungeonHud(this.hud, { hasCuff: quest.has('hasBellowsCuff') });
    this.hud.steam = 1;
    this.mapUI = new DungeonMapUI({
      rooms: MAP_ROOMS, title: DUNGEON_NAME, bossId: BOSS_ROOM,
    });

    if (typeof window !== 'undefined') {
      // `opts` is forwarded, not dropped: the bank's play() takes per-trigger
      // { vel, rand, detune } and the enemy voices in game/enemies.js use it to
      // put pitch jitter on `steam`, the one sound in the bank that declares
      // rand: 0. Swallowing the second argument here would silently flatten
      // that back to an identical burst every time.
      window.__gwSfx = (name, opts) => { try { sfx.play(name, opts); } catch (e) { } };
    }

    // --- music. Two tracks: the hall, and KETTLEBACK.
    this.music = new DungeonMusic();
    if (p.has('mute')) this.music.enabled = false;
    quest.on('lurch', (o) => this.tr.lurch({ ...o, dust: 'ceiling' }));

    // --- rooms
    this.roomCache = {};
    this.visited = new Set();
    this.boss = null;
    this.shard = null;
    // The Cuff-off-the-button guard. See _shellTeach for what each one is for.
    this._shellArc = false;        // the blade is inside the chassis this swing
    this._shellRings = 0;          // swings that met the shell, valve or no
    this._shellOpenRings = 0;      // ...of those, ones with the valve OPEN
    this._shellSaid = false;       // said it this attempt
    this._shellTold = 0;           // times said in the whole fight
    this.ending = 0;
    this.deathT = 0;
    // THE GAME OVER. `gameOverT` is what _drawGameOver reads; it is declared
    // here and ticked in update() beside deathT — see _down(). `deathHold` and
    // `onDown` are the composition's hooks: when src/scenes/game.js is driving
    // this scene it owns the card for BOTH halves of the chapter, holds the
    // room frozen while it is up, and calls continueRun() when the player
    // answers it. Standalone (?scene=dungeon) neither is set and the scene
    // runs its own timed card exactly as before.
    this.gameOverT = 0;
    this.deathHold = false;
    this.onDown = null;
    this.deaths = 0;
    // the truthful boss-death note (see _bossDeathWords / _retellDeathCard)
    this._deathNote = null;
    this._cardRetoldFor = -1;
    this.pending = null;
    this.msgQueue = [];
    // LIVE gameplay frames — not engine frames. Ticked in update() after the
    // dialog / transition / death-card guards, so a cooldown measured in it
    // counts the time Wren is actually standing there and not the time the
    // player spent reading a box. The locked-door rebuff is the only user.
    this._tick = 0;

    const rp = p.get('room');
    const startId = (rp && ROOMS[rp]) ? rp : (this.opts.startRoom || ENTRY_ROOM);
    this.enterRoom(startId, 'south', true);
    this.music.play(ROOMS[startId].arena === 'boss' ? 'boss' : 'dungeon');
    if (all || give.includes('seen')) {
      for (const id of Object.keys(ROOMS)) this.visited.add(id);
    }
    quest.beat('boilerworks');

    // buffers used by the screen-scroll
    this.bufA = mkBuf();
    this.bufB = mkBuf();
    this._hidePlayer = false;
  }

  // ---------------------------------------------------------------- rooms ---

  getRoom(id) {
    if (!this.roomCache[id]) {
      const room = new Room(id, {
        tiles: this.tiles, spr: this.spr, itemSpr: this.itemSpr,
        enemySpr: this.enemySpr, engine: this.engine,
      });
      this._fitCanisters(room);
      this.roomCache[id] = room;
    }
    return this.roomCache[id];
  }

  // ------------------------------------------------------------ canisters ---

  /**
   * Stand this room's canisters up, and teach the room to collide with them
   * and to y-sort them.
   *
   * Done by COMPOSITION rather than by editing the room defs: maps-dungeon.js
   * owns the room graph. Room._applyCollision rebuilds `map.obstacles` from
   * scratch every time a door rolls, a cage opens or a crate slides, so the
   * canister footprints have to be re-added on the far side of it — otherwise
   * they evaporate the first time B7's cage opens and the player walks
   * through a canister that is still on screen.
   *
   * Runs ONCE, on the cache miss, so a room the player has cleared stays
   * cleared: canisters do not come back when you walk in again. ALttP does
   * respawn its pots, but ALttP is also not a seven-room corridor with a
   * charm shop at the top — respawning them here would turn the entry room
   * into a heart farm and cost the dungeon its attrition.
   */
  _fitCanisters(room) {
    room.canisters = [];
    for (const [c, r, loot] of CANISTERS[room.id] || []) {
      // The map is the authority, not this file's arithmetic. A cell that is
      // masonry, a pit, a crate, a pillar, a chest or a boiler is skipped.
      if (room.map.isSolid(c, r)) continue;
      const k = new Canister(c, r, loot);
      const b = k.rect();
      if (!room.map.boxFree(b.x, b.y, b.w, b.h)) continue;
      // NEVER IN A STEAM COLUMN. A heal you have to walk through the hazard to
      // reach is not a heal, it is bait — measured: B7's first-draft cells at
      // c5r10 and c2r7 sat one and two tiles off the relentless west vent and
      // the autopilot bled 35 half-hearts in that room chasing them, up from
      // 19 with no canisters at all. A jet is 48px tall, so the exclusion is
      // the vent's own column plus one either side, three rows up and one
      // down.
      if ((room.vents || []).some(v => Math.abs(c - v.c) <= 1
        && r >= v.r - 3 && r <= v.r + 1)) continue;
      k.onBreak = (o) => this._breakCanister(room, o);
      room.canisters.push(k);
    }
    const applyCollision = room._applyCollision.bind(room);
    room._applyCollision = () => { applyCollision(); this._canisterSolids(room); };
    const sortables = room.sortables.bind(room);
    room.sortables = () => {
      const out = sortables();
      for (const k of room.canisters) {
        if (!k.dead) out.push({ baseY: k.baseY, draw: cx => k.draw(cx, this.spr) });
      }
      return out;
    };
    room._applyCollision();
  }

  _canisterSolids(room) {
    for (const k of room.canisters || []) {
      if (k.dead) continue;
      // img null: the map only carries the footprint. The art goes through
      // sortables() so a canister depth-sorts against Wren like every other
      // waist-high prop in the room.
      room.map.addObstacle(null, k.x, k.y, k.rect(), k.baseY);
    }
  }

  _breakCanister(room, k) {
    room._applyCollision();                     // the footprint goes with it
    this.melee.spawnPoof(k.x + 8, k.y + 8);     // puff + the bank's `poof`
    this._rollLoot(room, k.x, k.y + 2, k.loot);
  }

  /**
   * ALttP's under-the-pot table, with ALttP's low-health bias on the heart.
   * A player on one heart is the player the table is FOR; a player on a full
   * row does not need it and would only be taught that hearts are litter.
   */
  _heartChance(base) {
    const halves = quest.get('halves');
    const max = Math.max(2, quest.get('maxHearts') * 2);
    if (halves <= 2) return base * 2;
    if (halves <= max / 2) return base * 1.5;
    return base;
  }

  _rollLoot(room, x, y, loot) {
    const rnd = this.engine ? this.engine.rand() : Math.random();
    let kind = null;
    if (loot === 'cog') kind = 'cog';
    else if (loot === 'heart') kind = 'heart';
    else if (loot === 'none') kind = null;
    else if (rnd < POT_COG) kind = 'cog';
    else if (rnd < POT_COG + this._heartChance(POT_HEART)) kind = 'heart';
    if (kind) this._dropAt(room, x, y, kind);
  }

  /**
   * A drop on the floor. Clamped into the play area: a beetle killed against
   * the north wall used to be able to leave its heart under the masonry,
   * which is a heal the player can see and never reach.
   */
  _dropAt(room, x, y, kind) {
    const img = kind === 'cog' ? this.spr.cog_drop : this.spr.heart;
    const cx = Math.max(FLOOR_PX.x, Math.min(FLOOR_PX.x + FLOOR_PX.w - 16, x));
    const cy = Math.max(FLOOR_PX.y, Math.min(FLOOR_PX.y + FLOOR_PX.h - 16, y));
    room.pickups.push(new Pickup(kind, Math.round(cx), Math.round(cy), img));
    return true;
  }

  /**
   * A KILL PAYS. `list` is the enemy array as it stood BEFORE Room.update ran
   * — Room.update filters its dead out on the same frame it kills them, so a
   * watcher that reads room.enemies afterwards sees an empty seat and never
   * knows anybody was in it.
   *
   * The boss arena is exempt: KETTLEBACK has its own drop table with its own
   * low-health bias, its escorts are spawned by the fight rather than placed
   * by the room, and three critics signed the fight off as it stands.
   */
  // ---------------------------------------------------- autopilot helpers ---

  /**
   * The nearest canister the autopilot should go and break, or null.
   *
   * `_botSkip` is a patience budget, not a rule of the game: a target the
   * nav mesh cannot actually walk to is abandoned after 240 live frames so
   * the room never stalls on a heal. Nothing a PLAYER can do is affected.
   */
  _botCanister(room, pcx, pcy, reach) {
    const ks = (room.canisters || []).filter(k => !k.dead && !k._botSkip
      && Math.hypot(k.x + 8 - pcx, k.y + 8 - pcy) < reach);
    if (!ks.length) return null;
    ks.sort((a, b) => Math.hypot(a.x - pcx, a.y - pcy) - Math.hypot(b.x - pcx, b.y - pcy));
    const k = ks[0];
    if (this._botCan !== k) { this._botCan = k; this._botCanT = 0; }
    if (++this._botCanT > 240) { k._botSkip = true; this._botCan = null; return null; }
    return k;
  }

  /** Walk to a face of `k` the room will let Wren stand on, then swing. */
  _botSwing(k, room, pcx, pcy, f, navTo, face, press) {
    const kx = k.x + 8, ky = k.y + 8;
    // Below-and-up is the ALttP default, but B1's middle lane, B2's pit rim
    // and B7's south wall each have masonry against one face of a canister,
    // and a bot that only knows one approach walks into it forever.
    const stands = [[kx, ky + 18], [kx - 18, ky + 2], [kx + 18, ky + 2], [kx, ky - 14]]
      .filter(([sx, sy]) => room.map.boxFree(sx - 6, sy - 2, 12, 10));
    if (!stands.length) { k._botSkip = true; return false; }
    stands.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcy)
      - Math.hypot(b[0] - pcx, b[1] - pcy));
    const [sx, sy] = stands[0];
    if (Math.hypot(sx - pcx, sy - pcy) > 11) { navTo(sx, sy, 2); return true; }
    face(kx, ky);
    if (f % 11 === 0) press('a');
    return true;
  }

  _killDrops(room, list) {
    if (room.def.arena === 'boss') return;
    for (const e of list) {
      if (!e || !e.dead || e._looted) continue;
      e._looted = true;
      const rnd = this.engine.rand();
      if (rnd < KILL_COG) this._dropAt(room, e.x + 4, e.y + 6, 'cog');
      else if (rnd < KILL_COG + this._heartChance(KILL_HEART)) {
        this._dropAt(room, e.x + 4, e.y + 6, 'heart');
      }
    }
  }

  enterRoom(id, fromSide, instant) {
    const room = this.getRoom(id);
    this.cur = room;
    this.curId = id;
    this.visited.add(id);
    const sp = spawnAt(fromSide);
    if (instant) {
      this.player.x = sp.x; this.player.y = sp.y; this.player.dir = sp.dir;
    }
    this._armRoom(room);
    this._roomMusic(room);
    return { room, sp };
  }

  /** Arena rooms slam their doors and start their set piece. */
  _armRoom(room) {
    const def = room.def;
    // A crate-onto-plate puzzle that has NOT been solved resets when the
    // player walks back in — the ALttP rule, and the escape hatch for a crate
    // shoved somewhere it can never come back from. See Room.resetCrates().
    if (room.plates.length && room.crates.length
      && (!room.cage || !room.cage.open)) room.resetCrates();
    if (def.arena === 'tin' && !room.cleared && !room.sealed) {
      room.sealDoors();
      this.say('The doors slam. Three tin soldiers wind themselves up.');
    }
    if (def.arena === 'riveter' && !room.cleared && !room.sealed) {
      room.sealDoors();
    }
    if (def.arena === 'boss' && !room.cleared) {
      room.sealDoors();
      // THE ONE LINE THE CLIMAX WAS MISSING. The tin room says what it is when
      // its doors slam; the boiler hall said nothing at all, and a player who
      // walked past the rule stamped by the door had no second chance at it.
      // This is not a tutorial: it is the same sentence the wall already
      // carries, quoted back at the moment it becomes actionable.
      this.say(this._bossDoorWords());
      this.music.play('boss');
      if (!this.boss) {
        this.boss = new Kettleback({
          cx: 128, cy: 74, arena: ARENA,
          onSfx: (n) => { if (window.__gwSfx) window.__gwSfx(n); },
          onLurch: () => this.tr.lurch({ power: 3, frames: 18, dust: 'ceiling', count: 14 }),
          // The fight's drop table needs to know how Wren is doing — see
          // Kettleback._dropHeart's low-health bias, which is the ALttP rule.
          onHealth: () => quest.get('halves'),
        });
      }
    }
  }

  // ------------------------------------------------- what is on the button ---
  //
  // ROUND 28 MADE THE B BUTTON A CHOICE, AND THE BOSS ROOM WAS THE ONE ROOM
  // THAT COULD NOT SURVIVE IT.
  //
  // KETTLEBACK takes damage only while `stalled > 0`, and the only thing in
  // the chapter that stalls it is a Cuff blast into an open valve. Once the
  // inventory cursor shipped, a player could put the COGBLADE on B — the
  // obvious pick; it is the weapon — and walk through that door into a fight
  // with no answer in it. Measured by round 28's own critic: blade on B, cuff
  // false, swung true. The blade rang, the boiler shrugged, and the room said
  // nothing at all.
  //
  // The fix is NOT to take the choice back. Auto-equipping over the player's
  // pick, or a modal refusing to open the door, would both be a 2020s answer
  // to a 1993 problem — and the discovery curve three critics signed off on
  // (the fight is a READ, not an execution test) has to survive intact. What
  // the room owed the player was a SENTENCE. Two of them, in the game's own
  // furniture, both of which read the live assignment rather than assuming it:
  //
  //   1. THE DOOR LINE names what B is carrying, at the moment the doors slam.
  //   2. THE SHELL LINE fires the first time the blade rings off KETTLEBACK
  //      while the valve was open — i.e. the first swing the player could not
  //      possibly have won with — and names the tool that is not on the button.
  //
  // Neither says "you cannot win", neither explains the solve (Rule 4 on the
  // wall already carries the verb, and has since round 21), and neither moves
  // the player's item. A run with the Cuff on B — which is every bot run and
  // every player who never opened the subscreen, since `bItemOf` falls back to
  // the Cuff — sees exactly one extra clause on a line it was already reading.

  /** The B item's id, live. Null above an empty hand. */
  _bItem() { return bItemOf(quest); }

  /** What that item is CALLED, in the subscreen's own words. */
  _bItemName() {
    const s = B_SLOTS.get(this._bItem());
    return s ? s.name : null;
  }

  /**
   * The line the doors slam on.
   *
   * Rule 4 is untouched — it is the sentence round 21 added and the playtest
   * verified, and it is still the first thing said, on its own page, wrapped
   * to the same three rows it always wrapped to. What follows it is one clause
   * of inventory, phrased as an observation about Wren's own hand.
   *
   * THE NEWLINE IS LOAD-BEARING. dialog.js `clauseBlocks` splits on it before
   * it wraps, and `paginate` pushes a whole block onto the next page rather
   * than straddle a turn — so the break falls between the two sentences
   * instead of after "B carries the", which is where greedy filling put it.
   */
  _bossDoorWords() {
    const rule = 'The doors slam. Rule 4, on the wall behind you: NEVER COOL AN OPEN VALVE.';
    if (!quest.has('hasBellowsCuff')) return rule;
    // The correctly-equipped player says nothing extra. The clause used to fire
    // here too, and measured it pushed the line onto a SECOND page — an extra A
    // press and a loadout readout landing on the frame the doors slam, for the
    // player who did nothing wrong. Only the mis-equipped branch needs to speak.
    if (this._bItem() === 'cuff') return rule;
    const name = this._bItemName();
    return name
      ? `${rule}\nB carries the ${name}. The CUFF is in the pack.`
      : `${rule}\nB carries nothing. The CUFF is in the pack.`;
  }

  /**
   * THE BLADE RINGS AND THE BOILER SHRUGS — say so, once.
   *
   * Fires on the first swing whose arc is inside KETTLEBACK's chassis while
   * the valve is OPEN (`Kettleback.valveOpen`, the exact precondition
   * `hitByCuff` tests) and the Cuff is not on the button. That frame is the
   * one unambiguous moment in the fight: the answer was on offer, the player
   * reached for it with the wrong hand, and the game used to be silent.
   *
   * A SWING AT A SHUT VALVE ALSO COUNTS, four of them. A player who never
   * happens to swing inside the window would otherwise never be told — so the
   * fourth ring off the shell says the same thing. Four, not one, because
   * ringing the shell once with the valve shut is a normal thing to do while
   * learning the fight and the room should not lecture a player who is reading
   * it correctly.
   *
   * IT WAITS FOR THE SWING TO FINISH. The box freezes the room (see update),
   * so opening one mid-arc would freeze Wren in a held pose; the latch is set
   * during the arc and spent on the first frame the blade is down.
   *
   * TOLD AT MOST THREE TIMES, and re-armed only by a DEATH (continueRun). A
   * player who dies still mis-equipped is a player the message did not reach,
   * and the game-over card is the natural place for it to come round again;
   * a player who fixed their loadout never sees it a second time, because the
   * whole test is gated on the Cuff being off B.
   */
  _shellTeach(room) {
    const b = this.boss;
    if (!b || b.dead || b.dieT >= 0 || room.def.arena !== 'boss') return;
    // Not holding it yet, or holding it on the button: nothing to say, and the
    // arc latch resets so a swap mid-fight starts the count clean.
    if (!quest.has('hasBellowsCuff') || this._bItem() === 'cuff') {
      this._shellArc = false;
      return;
    }
    if (this._shellTold >= SHELL_TELLS || this._shellSaid) return;

    const sw = this.melee && this.melee.sword;
    const arc = sw && sw.active ? sw.hitRect(this.player) : null;
    if (arc && overlap(arc, b.bodybox())) {
      // one count per swing, not per active frame
      if (!this._shellArc) {
        this._shellArc = true;
        this._shellRings++;
        if (b.valveOpen) this._shellOpenRings++;
      }
      return;
    }
    this._shellArc = false;
    if (sw && sw.active) return;              // blade still out; wait for it
    if (this._shellOpenRings < 1 && this._shellRings < 4) return;

    this._shellSaid = true;
    this._shellTold++;
    // One page, three rows: the observation, then what is on the button. Same
    // "B carries the X" phrasing the door used, so the two lines read as one
    // voice noticing the same thing twice.
    const name = this._bItemName();
    this.say(name
      ? `The blade rings off the shell. B carries the ${name}, not the BELLOWS CUFF.`
      : 'The blade rings off the shell.\nB carries nothing. The BELLOWS CUFF is in the pack.');
  }

  /** Walking back into an ordinary room puts the hall theme back on. */
  _roomMusic(room) {
    if (this.ending > 0) return;
    this.music.play(room.def.arena === 'boss' && !room.cleared ? 'boss' : 'dungeon');
  }

  say(text) { this.dialog.say(text); }

  // --------------------------------------------------------------- update ---

  update(dt, engine) {
    const input = engine.input;
    if (this.bot) this._botStep(engine);
    this.music.update();
    if (!this._audioKicked && (input.hit('a') || input.hit('b') || input.hit('start'))) {
      this._audioKicked = true;
      const c = this.music.ctx;
      if (c && c.state === 'suspended') { const q = c.resume(); if (q && q.catch) q.catch(() => { }); }
    }

    this.tr.update(input, engine);
    this.mapUI.update();

    // The map screen and the transitions both own the frame exclusively.
    if (this.mapUI.open) {
      if (input.hit('start') || input.hit('b')) this.mapUI.toggle();
      return;
    }
    if (this.tr.frozen) return;
    if (this.dialog.active) {
      const consumed = this.dialog.update(input);
      // dialog.js keeps `active` true through its 5-frame close wipe; the
      // world is only frozen while a real page is up, so the wipe plays over
      // live gameplay exactly as ALttP's does. But the A press that CLOSED
      // the box must not fall through and re-read the same plaque on the very
      // next line — that loop is unbreakable from inside the game.
      if (this.dialog.node || consumed) return;
    }
    if (this.ending > 0) { this._updEnding(input); return; }
    // The composition's game over is up: the room is frozen until it calls
    // continueRun(). Nothing here may tick, least of all the boss.
    if (this.deathHold) { this._retellDeathCard(); return; }
    if (this.deathT > 0) {
      this.deathT--;
      // THE CARD HAS TO COUNT. gameOverT was set to 110 by _down() and
      // decremented by nobody, so _drawGameOver's `dim = (110 - t) / 24` was
      // 0 on every frame of every death and its word was gated on
      // `110 - t > 30` — the letterbox and the word could never render, in a
      // half of the chapter that is nothing but places to die. It rides
      // deathT now, which is the clock that was always doing the counting.
      this.gameOverT = this.deathT;
      if (this.deathT === 0) { this.gameOverT = 0; this._roomMusic(this.cur); }
      return;
    }

    if (input.hit('start')) { this.mapUI.toggle(); return; }

    this._tick++;
    const room = this.cur;

    // --- interaction BEFORE combat -----------------------------------------
    // A is both "open this" and "swing". The chest/plaque check runs first
    // and, when it consumes the press, the Cogblade is handed an input that
    // reports A as unpressed for this frame — otherwise the swing always
    // wins the race and no chest in the dungeon can ever be opened.
    const consumed = this._interact(input, room);
    const combatInput = consumed ? maskA(input) : input;

    // --- Cogblade + Bellows Cuff -------------------------------------------
    const hittables = this._hittables(room);
    this.melee.update(combatInput, this.player, hittables);
    this.cuff.update(input, this.player, { enabled: quest.has('hasBellowsCuff') });
    // KETTLEBACK's cinders answer to the Cuff through the same duck type the
    // room's steam vents use, so phase 2's new threat has the dungeon's own
    // verb as its answer rather than a new button.
    const cuffVents = this.boss && this.boss.cuffTargets().length
      ? room.vents.concat(this.boss.cuffTargets()) : room.vents;
    this.cuff.apply(this.player, {
      switches: room.switches, crates: room.crates, vents: cuffVents,
      enemies: this._blastables(room), map: room.map,
      onEvent: (kind) => { if (kind === 'switch') this._checkPuzzles(room); },
    });

    // --- player ------------------------------------------------------------
    const locked = this.cuff.locks;
    if (locked) { this.player.lock = true; this.player.attackPose = false; }
    this.player.update(input, room.map);
    if (locked) this.player.lock = false;

    // --- world -------------------------------------------------------------
    this._doorAssist(input, room);
    // The list Room.update is about to filter its corpses out of. See
    // _killDrops: this is the only frame on which a kill is still visible.
    const standing = room.enemies;
    room.update(engine, this.player, this.melee);
    this._killDrops(room, standing);
    if (room.def.arena === 'boss') this._arenaVents(room);
    if (this.boss && room.def.arena === 'boss') this._updBoss(engine, room);
    this._checkPuzzles(room);
    this._contactDamage(room);
    this._doorways(room);
    this._arenaProgress(room);
    this._syncHud();
  }

  _hittables(room) {
    const out = room.enemies.filter(e => !e.dead);
    if (room.riveter && !room.riveter.dead) out.push(room.riveter);
    if (this.boss && !this.boss.dead && room.def.arena === 'boss') out.push(this.boss);
    // Canisters are hittables, not scenery: combat.js only rings its
    // sword-on-wall clink when the arc found NOTHING, and it excludes
    // anything in this list — so a canister struck by the blade bursts
    // instead of sounding like masonry.
    for (const k of room.canisters || []) if (!k.dead) out.push(k);
    return out;
  }

  _blastables(room) {
    const out = room.enemies.filter(e => !e.dead && e.hitByCuff);
    if (room.riveter && !room.riveter.dead) out.push(room.riveter);
    if (this.boss && !this.boss.dead && room.def.arena === 'boss') out.push(this.boss);
    return out;
  }

  // --------------------------------------------------------------- puzzles ---

  _checkPuzzles(room) {
    if (!room.cage || room.cage.open) return;
    if (!room.switches.length && !room.plates.length) return;
    if (room.puzzleSolved) {
      room.openCage();
      this.tr.lurch({ power: 2, frames: 14, dust: 'ceiling', count: 10 });
      if (window.__gwSfx) window.__gwSfx('secret');
    }
  }

  _arenaProgress(room) {
    const def = room.def;
    if (def.arena === 'tin' && room.sealed && room.enemiesAlive === 0) {
      room.cleared = true;
      room.unsealDoors();
      if (window.__gwSfx) window.__gwSfx('secret');
      this.say('The soldiers wind down. The doors give.');
    }
    if (def.arena === 'riveter' && room.sealed && room.riveter && room.riveter.dead) {
      room.cleared = true;
      room.unsealDoors();
      if (window.__gwSfx) window.__gwSfx('secret');
      if (!room._dropped) {
        room._dropped = true;
        room.pickups.push(new Pickup('heartPiece', 120, 96, this.spr.heart_piece));
      }
    }
    if (def.arena === 'boss' && this.boss && this.boss.beaten && !room.cleared) {
      room.cleared = true;
      // The doors STAY SHUT. Walking out of the boss room the instant the
      // boss dies skips the whole chapter ending; the hall only opens once
      // the shard is in the cradle.
      // Everything KETTLEBACK called down dies with it — the hall goes quiet
      // before the shard is revealed, which is what makes the beat land.
      for (const e of room.enemies) { e.hp = 0; e.dead = true; }
      room.enemies.length = 0;
      this.shard = new Pickup('shard', this.boss.cx - 8, this.boss.cy - 4, this.spr.shard);
      this.boss = null;
      this.music.play(null);
      if (window.__gwSfx) window.__gwSfx('secret');
    }
  }

  /**
   * The arena's own vents stay COLD until KETTLEBACK overheats in phase 3.
   *
   * This used to live inside _updBoss — which is skipped the moment
   * _arenaProgress nulls out `this.boss`, so from the frame the boss died the
   * four arena jets ran free and the chapter's closing walk to the shard cost
   * up to three hearts. The rule belongs to the ROOM, not to the boss.
   */
  _arenaVents(room) {
    const b = this.boss;
    // ...and they go cold again while the steam LANCES are up, OR while there
    // are coals on the deck. ONE BOILER, ONE OUTLET: whatever KETTLEBACK is
    // pushing through its leg sockets or its firebox is not also coming up
    // through the floor. Two independent hazard grids at once is not a read,
    // it is a coin flip — measured on the seed that punished it hardest
    // (tools/critic/bd-bossbot2.js, seed 1 lag 6), phase 3 was losing 6 half-
    // hearts to arena jets and 3 to coals on top of 11 to the lances, and it
    // was the only seed of three that died at all.
    const hot = !!b && b.phase === 3 && b.dieT < 0 && this.ending === 0
      && !b.lance && b.embers.length === 0;
    if (hot) return;
    for (const v of room.vents) { v.t = 0; v.grow = 0; v.snuff = 2; }
  }

  _updBoss(engine, room) {
    const b = this.boss;
    b.update(engine, this.player);
    // Runs on the boss's own tick, after melee.update has advanced the arc for
    // this frame, so the rect it reads is the one that was live.
    this._shellTeach(room);
    // THE ESCORTS RUN OFF THE SAME BOILER. While KETTLEBACK is choking, they
    // stall mid-step — no walking, and any steam jet they had cracked open
    // shuts. Phase 2's two beetles are ranged (a clockwork beetle vents at
    // anything inside 76px) and measured as the single largest source of
    // damage in the fight; letting them shoot into the one window the whole
    // fight is built around was taxing the player for doing the right thing.
    if (b.stalled > 0) {
      for (const e of room.enemies) {
        if (e.dead || e.hp <= 0) continue;
        if (e.state === 'vent' || e.state === 'wind') { e.state = 'pause'; e.cool = 60; }
        e.timer = Math.max(e.timer || 0, 6);
      }
    }
    b.recallEscorts(room.enemies);
    for (const beetle of b.takeSpawns()) {
      beetle.sprites = this.enemySpr;
      room.enemies.push(beetle);
    }
    for (const drop of b.takeDrops()) {
      room.pickups.push(new Pickup(drop.kind, drop.x, drop.y,
        drop.kind === 'heart' ? this.spr.heart : this.spr.heart_piece));
    }
  }

  // -------------------------------------------------------------- contact ---

  _contactDamage(room) {
    const p = this.player;
    if (p.invulnT > 0 || p.kbT > 0) return;
    const pb = { x: p.x + 3, y: p.y + 9, w: 10, h: 13 };
    // `src` is bookkeeping for the critic probes only: it answers "what is
    // actually taking the player's hearts in this phase?" with a count instead
    // of a guess. tools/critic/bossline.js prints it per phase.
    const hurt = (box, half = 1, src = 'other') => {
      const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
      if (!overlap(pb, box)) return false;
      if (!p.hurt(pb.x + 5 - cx, pb.y + 6 - cy)) return false;
      quest.damage(half);
      this.hurtBy = this.hurtBy || {};
      {
        const ph = (this.boss && !this.boss.dead) ? this.boss.phase : 0;
        const k = ph + '|' + src;
        this.hurtBy[k] = (this.hurtBy[k] || 0) + half;
      }
      if (window.__gwSfx) window.__gwSfx('hurt');
      if (quest.get('halves') <= 0) this._down();
      return true;
    };

    for (const e of room.enemies) {
      if (e.dead || e.hp <= 0) continue;
      if (e instanceof TinSoldier) {
        const sb = e.spearbox();
        if (sb && hurt(sb, 1, 'soldier-spear')) return;
        if (e.state !== 'stagger' && hurt(e.hurtbox(), 1, 'soldier')) return;
        continue;
      }
      if (hurt(e.hurtbox(), 1, 'enemy')) return;
    }
    for (const v of room.vents) {
      if (!v.dangerous) continue;
      if (hurt(v.hurtbox(), 1, 'room-vent')) return;
    }
    if (room.riveter) {
      for (const r of room.riveter.rivets) if (hurt(r.hurtbox(), 1, 'rivet')) return;
    }
    if (this.boss && !this.boss.dead) {
      // fire columns and steam lances bite whether or not the body does
      for (const hb of this.boss.cinderBoxes()) if (hurt(hb, 1, 'cinder')) return;
      for (const hb of this.boss.lanceBoxes()) if (hurt(hb, 1, 'lance')) return;
      if (this.boss.dangerous && hurt(this.boss.bodybox(), 1, 'boss-body')) return;
    }
  }

  _down() {
    // A GAME OVER card, then a continue at the door Wren came in by with full
    // hearts. The cost is paid by the boss: it goes back to the TOP OF THE
    // PHASE you had reached, not to hp+3. You keep the phase you earned and
    // lose every point of chip damage, so KETTLEBACK cannot be won by dying
    // at it repeatedly — it has to be learned.
    //
    // WHO DRAWS THE CARD. Standalone, this scene does: deathT counts and
    // gameOverT rides it (see update). Composed, src/scenes/game.js does — it
    // already owns a full ALttP death above ground (letterbox, the word at 2x,
    // a rule, a blinking prompt, waits on the player) and the chapter shipped
    // TWO death screens with the one covering its entire second half invisible.
    // So the composition is handed the moment, the room is frozen behind the
    // card, and the continue below waits for it.
    this.deaths = (this.deaths || 0) + 1;
    // counters the critic probes read (tools/critic/bossline.js): total
    // deaths, and which phase of the boss each one happened in
    this._deaths = this.deaths;
    this._deathsByPhase = this._deathsByPhase || {};
    this._deathsByRoom = this._deathsByRoom || {};
    {
      const ph = (this.boss && !this.boss.dead) ? this.boss.phase : 0;
      this._deathsByPhase[ph] = (this._deathsByPhase[ph] || 0) + 1;
      const id = this.cur ? this.cur.id : '?';
      this._deathsByRoom[id] = (this._deathsByRoom[id] || 0) + 1;
    }
    this.music.play(null);
    // THE ROW STAYS EMPTY UNTIL THE CONTINUE. The refill used to happen right
    // here, one line above onDown() — so the composition's death card opened
    // over a FULL LIFE row on the frame Wren died and held it for the ~44
    // frames the letterbox takes to close (measured at the boss: t=10 showed
    // three full red hearts). The overworld half has always refilled inside
    // respawn()'s onSwap; this is the same seam and it now reads the same.
    // See continueRun().

    const words = this._bossDeathWords();
    this._deathNote = words ? words.note : null;

    if (this.onDown) {
      this.deathHold = true;
      this.deathT = 0;
      this.gameOverT = 0;                   // the composition's card, not ours
      this.onDown({
        room: this.curId,
        arena: this.cur.def.arena || null,
        bossPhase: (this.boss && !this.boss.dead) ? this.boss.phase : 0,
        deaths: this.deaths,
      });
      this._retellDeathCard();
      return;
    }
    this.deathT = 110;
    this.gameOverT = 110;
    this.continueRun();
  }

  /**
   * WHAT A BOSS DEATH ACTUALLY COSTS, in words, from the room that owns the
   * fact rather than from whoever happens to be drawing the card.
   *
   * The card shipped reading "KETTLEBACK RECOVERS - ATTEMPT N", with a
   * follow-up line that said "Every dent you put in it this round is gone."
   * That is false, and it is false in the direction that does the most damage:
   * continueRun() calls Kettleback.resetToPhaseTop(), which puts it back at the
   * TOP OF THE PHASE YOU REACHED, not at full health. Measured
   * (tools/critic/bt22-naive.js, --mode curious, seed 2): eleven deaths at boss
   * hp 8,10,8,4,2,4,6,2,2,6,4 — every one of those below 12 came back at 12,
   * and every one below 6 came back at 6. Two thirds of eighteen hit points can
   * be banked and kept. The player was being told their retries were worthless
   * on the exact screen where they most needed the opposite.
   *
   * Phase 1 is the one case where nothing carries, and it is also the case
   * where the player has not worked the fight out yet — so that card spends its
   * second line on the answer instead.
   *
   * The replacement headline then overshot in the other direction — "KEEPS ITS
   * DAMAGE" is false for the same reason "every dent is gone" was: the boiler
   * keeps the ROUND, not the hit points inside it. See the note below.
   */
  _bossDeathWords() {
    const b = this.boss;
    if (!b || b.dead || !this.cur || this.cur.def.arena !== 'boss') return null;
    const kept = b.phase > 1;
    const n = Math.min(99, (this.deaths || 0) + 1);
    return {
      kept,
      // "KEEPS ITS DAMAGE" WAS THE ONE SHIPPED SENTENCE A PLAYER COULD CHECK
      // AND FIND FALSE. It does not keep the damage: resetToPhaseTop() hands
      // back every hit point you took inside the phase you died in. Measured
      // in the shipped fight — a phase-2 death at boss hp 9 returns it at 12,
      // a phase-3 death at hp 2 returns it at 6 — so up to 5 hp, about two and
      // a half seizes of work, comes back under a line saying none of it does.
      // What Kettleback actually keeps is the PHASE: it winds itself back to
      // the top of the round you reached and no further, which is the thing
      // the headline now says. The line below it was already exact and is
      // untouched.
      note: kept ? `KETTLEBACK REWINDS THIS ROUND  -  TRY ${n}`
        : `KETTLEBACK IS UNMARKED  -  TRY ${n}`,
      // Authored to three lines that each fit dialog.js's measure, so neither
      // ever page-breaks onto an orphan (checked with paginate()).
      msg: kept
        ? 'KETTLEBACK winds itself up.\nThe plates stay off. You start\nwhere you got to, not the top.'
        : 'KETTLEBACK winds itself up,\nunmarked. Only cold air in an\nopen valve gets in.',
    };
  }

  /**
   * Hand those words to the composition's card.
   *
   * src/scenes/game.js owns the ONE death screen for both halves of the chapter
   * and writes the boss's note itself (beginDeath, `info.arena === 'boss'`). It
   * has no hook for the room to supply one, and this round does not own that
   * file — so the correction goes through `window.__gwGame`, the reference that
   * file already publishes for exactly this kind of reach-in. Idempotent per
   * death, and a no-op standalone (where _drawGameOver below prints the same
   * note under GAME OVER). When game.js grows a hook, delete this and pass
   * `note` / `msg` in the onDown payload instead.
   */
  _retellDeathCard() {
    // keyed on the death index, not a flag: src/scenes/game.js has a SECOND
    // entry into the death screen (_dungeonDown, the poll for a row emptied
    // outside hurt()) that never runs _down(), and a boolean would latch after
    // the first one and leave every later card uncorrected.
    if (this._cardRetoldFor === this.deaths) return;
    const g = (typeof window !== 'undefined') ? window.__gwGame : null;
    if (!g || !g.death || g.death.where !== 'dungeon') return;
    const w = this._bossDeathWords();
    this._cardRetoldFor = this.deaths;
    if (!w) return;
    g.death.note = w.note;
    g._deathMsg = w.msg;
    this._deathNote = w.note;
  }

  /**
   * The continue itself: back to the door Wren came in by, full row of hearts,
   * and the boss at the top of the phase it was in. Split out of _down() so
   * the composition can hold its game-over card up for as long as the player
   * wants before any of it happens.
   */
  continueRun() {
    this.deathHold = false;
    const sp = spawnAt('south');
    const b = this.boss;
    this.tr.fade({
      onSwap: () => {
        // Behind the fade, with the card already gone: exactly where the
        // overworld's respawn() puts it.
        quest.flags.halves = quest.maxHalves;   // a continue restores full hearts
        this.player.x = sp.x; this.player.y = sp.y; this.player.dir = sp.dir;
        this.player.invulnT = 90;
        this.player.attackPose = false; this.player.attackIndex = 0;
        this.player.lock = false; this.player.kbT = 0;
        if (b && !b.dead) b.resetToPhaseTop();
        // A death re-arms the Cuff-off-the-button line for one more attempt
        // (capped at SHELL_TELLS). The counts start over with the fight.
        this._shellSaid = false;
        this._shellArc = false;
        this._shellRings = 0;
        this._shellOpenRings = 0;
        this._roomMusic(this.cur);
      },
    });
  }

  // ------------------------------------------------------------ interaction ---

  /** Returns true when the A press was spent on a chest or a plaque. */
  _interact(input, room) {
    if (!input.hit('a') || this.melee.sword.active) return false;
    const p = this.player;
    const reach = { x: p.x + 2, y: p.y + 6, w: 12, h: 18 };
    // chests: stand below one and press A
    for (const ch of room.chests) {
      if (ch.open) continue;
      if (room.cage && ch === room.cage.chest && !room.cage.open) continue;
      if (!overlap(reach, { x: ch.x - 3, y: ch.y, w: 22, h: 30 })) continue;
      if (p.dir !== 'up') continue;
      ch.open = true;
      this._giveItem(ch.item);
      return true;
    }
    for (const q of room.plaques) {
      if (!overlap(reach, { x: q.x - 4, y: q.y, w: 24, h: 26 })) continue;
      if (p.dir !== 'up') continue;
      this.dialog.say(q.text);
      if (window.__gwSfx) window.__gwSfx('text');
      return true;
    }
    return false;
  }

  _giveItem(item) {
    const spr = this.itemSpr;
    // A recovery heart is a PICKUP, not a treasure: no fanfare, no pose, no
    // three lines of text in the middle of a boss fight.
    if (item === 'heart') {
      quest.heal(2);
      if (window.__gwSfx) window.__gwSfx('heart');
      return;
    }
    // A single cog off a kill or out of a canister. Same rule: a pickup is
    // not a treasure. The overworld pays 1 per drop and so does this, so the
    // 100 cogs Hesper wants mean the same thing on both sides of the hatch.
    if (item === 'cog') {
      quest.addCogs(1);
      if (window.__gwSfx) window.__gwSfx('cog');
      return;
    }
    const img = {
      cuff: spr.cuff, map: spr.map, compass: spr.compass,
      smallKey: spr.smallKey, bigKey: spr.bigKey, cogs: spr.cogs,
      heartPiece: this.spr.heart_piece, shard: this.spr.shard,
    }[item] || spr.smallKey;
    if (item === 'cogs') quest.add('cogs', 50);
    if (item === 'cuff') {
      quest.set('hasBellowsCuff', true);
      applyDungeonHud(this.hud, { hasCuff: true });
      quest.beat('cuff');
    } else if (item === 'map') quest.set('dgnMap', true);
    else if (item === 'compass') quest.set('dgnCompass', true);
    else if (item === 'smallKey') quest.add('smallKeys', 1);
    else if (item === 'bigKey') quest.set('bigKey', true);
    else if (item === 'heartPiece') quest.addHeartPiece();
    if (window.__gwSfx) window.__gwSfx('chest');
    this.tr.getItem({
      img, lines: ITEM_COPY[item] || [], player: this.player,
      auto: this.bot ? 40 : 0,
    });
  }

  /**
   * DOORWAY ENTRY ASSIST. ALttP slides Link into a door mouth: hold toward a
   * doorway you are nearly lined up with and the game finishes the alignment
   * for you. Without it a player who walks north one tile off centre jams
   * against the wall forever with no idea why nothing happens.
   */
  _doorAssist(input, room) {
    if (this.tr.busy || this.cuff.locks) return;
    const p = this.player;
    const fx = p.x + 8, fy = p.y + 19;              // feet centre
    const free = (x, y) => room.map.boxFree(x + 2, y + 14, 12, 10);
    for (const [side, d] of Object.entries(room.doors)) {
      if (!d.passable || !d.to) continue;
      const z = DOOR_CELLS[side];
      if (side === 'north' || side === 'south') {
        if (!input.held(side === 'north' ? 'up' : 'down')) continue;
        // only inside the approach band, so it never fights normal walking
        if (side === 'north' ? fy > z.y + 60 : fy < z.y - 26) continue;
        const cx = z.x + 16, dx = cx - fx;
        if (Math.abs(dx) > 15 || Math.abs(dx) < 0.6) continue;
        const step = Math.sign(dx) * Math.min(0.75, Math.abs(dx));
        if (free(p.x + step, p.y)) p.x += step;
        return;
      }
      if (!input.held(side === 'west' ? 'left' : 'right')) continue;
      if (side === 'west' ? fx > z.x + 60 : fx < z.x - 26) continue;
      const cy = z.y + 22, dy = cy - fy;
      if (Math.abs(dy) > 15 || Math.abs(dy) < 0.6) continue;
      const step = Math.sign(dy) * Math.min(0.75, Math.abs(dy));
      if (free(p.x, p.y + step)) p.y += step;
      return;
    }
  }

  // --------------------------------------------------------------- doorways ---

  /**
   * A LOCKED DOOR HAS TO ANSWER — this is the most important piece of
   * navigational feedback an ALttP-shaped dungeon has, and it was silent.
   *
   * MEASURED BEFORE (tools/critic/bd18-locked.js, B2 north, smallKeys=0):
   *   approach 1  textbox=true   sounds=[]
   *   approach 2  textbox=false  sounds=[]
   *   approach 3  textbox=false  sounds=[]
   *   400-frame sustained push: 0 sounds of any kind.
   * `door._told` was a permanent one-shot, so from the second bump onwards the
   * door gave NO feedback at all, and `error` — the bank's authored
   * "LOCKED - NO EFFECT" voice, reachable through the `locked` alias — was one
   * of the three sounds nothing in the game could reach.
   *
   * Now: the sound fires on every bump, throttled to LOCK_SFX_GAP live frames
   * (the bank's own `error.minGap` is 0.20 s, so this is the visible half of
   * the same rule); the sentence comes back on every FRESH approach, because
   * `_nagArm` is cleared while Wren is against the door and set again the
   * moment he steps off it. Leaning on the door therefore rings without
   * re-opening the box in your face, and walking back a room later tells you
   * what it wants all over again.
   */
  _lockRebuff(door, msg) {
    const fresh = door._nagArm !== false;
    if (fresh || this._tick - (door._nagT ?? -9999) >= LOCK_SFX_GAP) {
      door._nagT = this._tick;
      if (window.__gwSfx) window.__gwSfx('locked');   // sfx.js: -> `error`
    }
    if (fresh) this.say(msg);
    door._nagArm = false;
  }

  _doorways(room) {
    if (this.tr.busy) return;
    // Locked / boss doors turn when Wren walks into them holding the key.
    for (const [side, door] of Object.entries(room.doors)) {
      if (door.state !== 'locked' && door.state !== 'boss') continue;
      const z = DOOR_CELLS[side];
      const near = {
        x: z.x - 6, y: z.y - 6, w: z.w + 12, h: z.h + 12,
      };
      const pb = { x: this.player.x + 3, y: this.player.y + 12, w: 10, h: 12 };
      // Stepping off the door RE-ARMS it, so the next approach speaks again.
      if (!overlap(pb, near)) { door._nagArm = true; continue; }
      if (door.state === 'locked') {
        if (quest.get('smallKeys') > 0) {
          quest.add('smallKeys', -1);
          room.openDoor(side);
          if (window.__gwSfx) window.__gwSfx('key');
          this.say('The small key turns. The lock drops.');
        } else {
          this._lockRebuff(door, 'A brass lock, stamped with a cog. It wants a small key.');
        }
      } else if (door.state === 'boss') {
        if (quest.has('bigKey')) {
          room.openDoor(side);
          if (window.__gwSfx) window.__gwSfx('key');
          quest.beat('bossDoor');
          this.say('The big key bites. Something under the floor stops turning.');
        } else {
          this._lockRebuff(door, 'The boiler-hall door. The lock is the size of your head.');
        }
      }
      return;
    }

    // Pickups on the floor
    const pb = { x: this.player.x + 3, y: this.player.y + 12, w: 10, h: 10 };
    for (const pk of room.pickups) {
      if (pk.taken || !overlap(pb, pk.rect())) continue;
      pk.taken = true;
      this._giveItem(pk.kind);
      return;
    }
    if (this.shard && !this.shard.taken && overlap(pb, this.shard.rect())) {
      this.shard.taken = true;
      this.ending = 1;
      this._endStep = 0;
      return;
    }

    // B1's SOUTH HATCH — the way back up to Marla and Hesper's shop. `onExit`
    // was documented and never called: the south door's `to` is null, and
    // Room.doorUnder() skips any door without a destination, so the exit was
    // unreachable by construction and the Boilerworks had no way out.
    if (room.def.exit && room.doors.south && room.doors.south.passable) {
      const z = DOOR_CELLS.south;
      const pb2 = { x: this.player.x + 4, y: this.player.y + 16, w: 8, h: 6 };
      if (overlap(pb2, { x: z.x, y: z.y + 8, w: 32, h: 24 })) { this._climbOut(); return; }
    }

    // Room change
    const side = room.doorUnder(this.player);
    if (!side) { this._exitArmed = true; return; }
    const to = room.doors[side].to;
    if (!to) return;
    this._changeRoom(side, to);
  }

  /**
   * Leave the dungeon by the entry hatch. Armed only after Wren has stepped
   * off the doorway once, so walking in on frame one does not fire it.
   */
  _climbOut() {
    if (!this._exitArmed) return;
    this._exitArmed = false;
    if (this.opts.onExit) {
      this.tr.fade({ onSwap: () => this.opts.onExit(quest) });
      return;
    }
    // Standalone (capture runs, the room browser): say so and push Wren back
    // in, rather than silently doing nothing.
    this.say('The ladder goes up to the hatch.\nMarla is waiting at the top.');
    this.player.y -= 14;         // step back INTO the room, not deeper in
  }

  /**
   * BACK DOWN THE LADDER.
   *
   * Everything the Boilerworks knows is already here — `roomCache` holds the
   * cleared arenas, the opened cages and the broken canisters, and the keys,
   * the map and the Cuff live in `quest` — so coming back in is not a rebuild.
   * It is putting Wren at the foot of the ladder and nothing else.
   *
   * `_exitArmed` is cleared so the frame he lands on cannot be read as him
   * walking into the hatch he has just come down; the south trigger starts at
   * y=200 and the spawn is at y=168, so he has to take a real step to leave
   * again.
   */
  reenterFromHatch() {
    if (this.tr) this.tr._fx = null;   // no half-played fade from the way out
    this.enterRoom(ENTRY_ROOM, 'south', true);
    this._exitArmed = false;
    this.player.kbT = 0;
    this.player.invulnT = 0;
    this.player.moving = false;
    this.player.attackPose = false;
    this.player.attackIndex = 0;
  }

  _changeRoom(side, toId) {
    const dir = { north: 'up', south: 'down', west: 'left', east: 'right' }[side];
    const fromSide = OPPOSITE[side];
    const sp = spawnAt(fromSide);

    // paint the screen we are leaving (without Wren — the scroll draws him)
    this._hidePlayer = true;
    this.bufA.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT);
    this.drawWorld(this.bufA.getContext('2d'));
    this._hidePlayer = false;

    const { room } = this.enterRoom(toId, fromSide, false);
    // place Wren on the INCOMING screen, offset back by one screen so the
    // transition's rebase lands him exactly on the spawn tile
    const sx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const sy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    this.player.x = sp.x - sx * 20 + sx * WIDTH;
    this.player.y = sp.y - sy * 20 + sy * HEIGHT;
    this.player.dir = sp.dir;
    this.player.attackPose = false;
    this.player.attackIndex = 0;
    this.player.kbT = 0;

    this._hidePlayer = true;
    this.bufB.getContext('2d').clearRect(0, 0, WIDTH, HEIGHT);
    this.drawWorld(this.bufB.getContext('2d'));
    this._hidePlayer = false;

    this.tr.scroll({
      dir, from: this.bufA, to: this.bufB, player: this.player,
      onDone: () => { this.player.moving = false; },
    });
  }

  // ---------------------------------------------------------------- ending ---

  _updEnding(input) {
    // The hall goes quiet and cold: every jet in the arena dies the moment
    // the shard is picked up. White steam columns firing through the
    // chapter's last beat is the beat losing.
    for (const v of this.cur.vents) { v.snuff = 999; v.grow = 0; }
    this.cur.skylight = this.ending;   // drives the sky and the CARRION WING
    this.ending++;

    if (this.dialog.active) { this.dialog.update(input); return; }
    if (this._endStep === 0) {
      this._endStep = 1;
      this.cur.cradleGlow = 1;          // the shard goes in; the socket lights
      quest.beat('shard');
      this.tr.lurch({ power: 6, frames: 40, dust: 'ceiling', count: 40 });
      if (window.__gwSfx) window.__gwSfx('secret');
      // The last page used to read TO BE CONTINUED / CHAPTER 2 and then the
      // card printed the same two lines forty frames later. The box hands off
      // to the card now; only one of them says it.
      this.dialog.say([
        'Not the liftstone. A shard of it.\nAll she left behind.',
        'Wren jams the shard into the cradle.',
        'The isle shudders - and stops falling.\nIt rises. Just enough.',
        'Marla, from the hatch above:\n"That\'ll hold a week. Maybe two."',
      ]);
      return;
    }
    if (this._endStep === 1) {
      this._endStep = 2;
      this._endCard = true;       // the chapter card, held over the world
      if (this.opts.onFinish && !this._finished) {
        this._finished = true;
        this.opts.onFinish(quest);
      }
    }
  }

  /** The chapter card. ALttP holds its title over the scene; so do we. */
  _drawEndCard(ctx) {
    const t = this.ending;
    if (t < 40) return;
    // The card sits LOW. The skylight, the CARRION WING crossing it and the
    // lit cradle are the shot; a letterbox over the top of the screen would
    // cover the exact thing the chapter has been building to.
    const y0 = 166;
    ctx.fillStyle = '#000000';
    ctx.fillRect(24, y0, 208, 48);
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(24, y0, 208, 1);
    ctx.fillRect(24, y0 + 47, 208, 1);
    ctx.fillRect(24, y0, 1, 48);
    ctx.fillRect(231, y0, 1, 48);
    const lines = ['TO BE CONTINUED', 'CHAPTER 2 - THE UPPER REACHES'];
    lines.forEach((l, i) => drawDialogText(ctx, l, 128 - l.length * 3.5, y0 + 12 + i * 18));
  }

  /** ALttP's game over: the screen dims, one word, then a continue. */
  _drawGameOver(ctx) {
    const t = this.gameOverT;
    const dim = Math.min(1, (110 - t) / 24);
    ctx.fillStyle = '#000000';
    const bars = Math.round(dim * 112);
    ctx.fillRect(0, 0, WIDTH, bars);
    ctx.fillRect(0, HEIGHT - bars, WIDTH, bars);
    if (110 - t > 30) drawDialogText(ctx, 'GAME OVER', 128 - 9 * 3.5, 106);
    // ...and what the failure cost, when it was the boss. See _bossDeathWords.
    if (110 - t > 30 && this._deathNote) {
      drawDialogText(ctx, this._deathNote,
        Math.round((WIDTH - dialogTextWidth(this._deathNote)) / 2), 122, '#a0a8b8');
    }
  }

  _syncHud() {
    // The gauge is the CUFF'S PRESSURE: full when the bellows is charged,
    // dumped on a blast, refilling over the recovery. It gives the meter a
    // job instead of sitting decoratively full.
    this.hud.steam = quest.has('hasBellowsCuff')
      ? (this.cuff.active ? 0 : 1 - this.cuff.cool / 10)
      : 1;
    this.hud.maxHearts = quest.get('maxHearts');
    this.hud.halves = quest.get('halves');
    this.hud.cogs = quest.get('cogs');
    this.hud.keys = quest.get('smallKeys');
  }

  // ------------------------------------------------------------------ draw ---

  draw(ctx, engine) {
    this.tr.render(ctx, (c) => this.drawWorld(c), { ui: (c) => this.drawUI(c) });
    this.mapUI.draw(ctx, {
      current: this.curId,
      visited: this.visited,
      hasMap: quest.has('dgnMap'),
      hasCompass: quest.has('dgnCompass'),
      keys: quest.get('smallKeys'),
      bigKey: quest.has('bigKey'),
    });
    this._drawDialog(ctx);
  }

  /**
   * dialog.js reports `active` through its close wipe but its text pass still
   * dereferences the page it just dropped on the first closing frame. Guard
   * it here rather than editing a module another piece owns.
   */
  _drawDialog(ctx) {
    const d = this.dialog;
    if (!d.active) return;
    try { d.draw(ctx); } catch (e) { /* close-wipe page race */ }
  }

  drawWorld(ctx) {
    const room = this.cur;
    const frame = this.engine.frame;
    ctx.fillStyle = '#0d0a08';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    room.drawGround(ctx);
    if (this.boss && room.def.arena === 'boss') {
      this.boss.drawFloorGlow(ctx, ARENA, frame);
      this.boss.drawFloorFx(ctx, frame);
    }

    const ents = room.sortables();
    if (this.shard && !this.shard.taken) {
      ents.push({ baseY: this.shard.baseY, draw: c => this.shard.draw(c) });
    }
    if (this.boss && room.def.arena === 'boss') {
      // WHILE IT IS SEIZED, WREN SORTS ABOVE IT. The cradle is dead centre of
      // a 64x60 chassis, so for the whole damage window his centre is inside
      // the boss footprint and the boiler was drawn straight over him — the
      // fight was pointing at the one spot where you cannot see yourself
      // swing. Seized, the boiler is on the floor; drawing it under the cast
      // is both readable and true.
      const bkey = this.boss.vulnerable ? -1e4 : this.boss.baseY;
      ents.push({ baseY: bkey, draw: c => this.boss.draw(c, frame) });
    }
    if (!this._hidePlayer && !this.tr.posing) {
      ents.push({ baseY: this.player.baseY, player: true });
    }
    ents.sort((a, b) => a.baseY - b.baseY);
    for (const e of ents) {
      if (e.player) {
        // combat.js gives DOWN four swing poses and the other facings three,
        // and both transition.js (screen scroll) and our own respawn rewrite
        // player.dir. Clamp the pose index to whatever this facing actually
        // has, or a swing interrupted by a teleport draws an undefined frame.
        const bodies = this.player.attackBodies;
        if (this.player.attackPose && bodies && bodies[this.player.dir]) {
          const n = bodies[this.player.dir].length;
          if (this.player.attackIndex >= n) this.player.attackIndex = n - 1;
        }
        this.melee.drawUnder(ctx, this.player);
        this.player.draw(ctx);
        this.melee.drawOver(ctx, this.player);
        if (quest.has('hasBellowsCuff')) this.cuff.drawWorn(ctx, this.player);
      } else e.draw(ctx);
    }
    room.drawOver(ctx);
    if (this.boss && room.def.arena === 'boss') this.boss.drawFx(ctx, frame);
    if (!this._hidePlayer) this.cuff.draw(ctx, this.player);
    this.melee.drawFx(ctx);
  }

  drawUI(ctx) {
    // The closing shot is the skylight, the CARRION WING crossing it and the
    // lit cradle. ALttP drops its status bar for its ending and so does this:
    // a cog counter over the last image of the chapter is the beat losing.
    if (this.ending === 0) this.hud.draw(ctx);
    if (this._endCard) this._drawEndCard(ctx);
    if (this.boss && !this.boss.dead) this._drawBossBar(ctx);
    // LAST: a row of boss pips down the side of a GAME OVER is the card
    // losing an argument with the furniture.
    if (this.gameOverT > 0) this._drawGameOver(ctx);
    if (this.engine.params.has('debug')) this._drawDebug(ctx);
  }

  /** ALttP-style boss gauge: a stack of pips down the right-hand edge. */
  _drawBossBar(ctx) {
    const b = this.boss;
    // eighteen pips at six pixels would run off the bottom of the screen
    const h = b.maxHp > 14 ? 5 : 6;
    const x = 244, y = 52;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 1, y - 1, 8, b.maxHp * h + 2);
    for (let i = 0; i < b.maxHp; i++) {
      const on = (b.maxHp - i) <= b.hp;
      ctx.fillStyle = on ? (b.phase === 3 ? '#f08828' : '#d9482b') : '#3a3630';
      ctx.fillRect(x, y + i * h, 6, h - 1);
      if (on) { ctx.fillStyle = '#f8d048'; ctx.fillRect(x, y + i * h, 6, 1); }
    }
  }

  _drawDebug(ctx) {
    const b = this.boss, r = this.cur.riveter;
    const lines = [
      `room ${this.curId} en=${this.cur.enemiesAlive} seal=${this.cur.sealed ? 1 : 0}` +
      (this.cur.switches.length ? ` sw=${this.cur.switches.map(s => s.on ? 1 : 0).join('')}` : '') +
      (this.cur.cage ? ` cage=${this.cur.cage.open ? 1 : 0}` : ''),
      b ? `boss hp=${b.hp} ph=${b.phase}.${b.cycle} ${b.state} v=${b.valve} st=${b.stalled}/${b.seizeHits} cin=${b.embers.length}` : '',
      r ? `riv hp=${r.hp} ${r.state} stag=${r.stagger}` : '',
      `keys=${quest.get('smallKeys')} big=${quest.has('bigKey') ? 1 : 0} cuff=${quest.has('hasBellowsCuff') ? 1 : 0} hp=${quest.get('halves')}`,
      `p ${Math.round(this.player.x)},${Math.round(this.player.y)} tr=${this.tr.busy ? 1 : 0} pk=${this.cur.pickups.filter(k => !k.taken).length}`,
    ].filter(Boolean);
    ctx.font = '8px monospace';
    lines.forEach((l, i) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(2, 194 + i * 8, l.length * 5 + 2, 8);
      ctx.fillStyle = '#8f8';
      ctx.fillText(l, 3, 201 + i * 8);
    });
  }

  // --------------------------------------------------------------- autopilot ---
  //
  // Writes into the SAME Input object the keyboard writes into, so a capture
  // run exercises the real controller, the real combat and the real boss.
  // It is deliberately dumb: approach, strike, back off — the rhythm the
  // design asks a human for.

  /**
   * Breadth-first route over the room's 16x14 collision grid, returning the
   * point the autopilot should steer at next. A straight-line probe cannot
   * cross B2's pit (it walks into the shaft and stops) and cannot round B4's
   * alcove piers — and a probe that cannot reach a room's contents proves
   * nothing about whether the room works.
   */
  _nav(room, p, tx, ty) {
    const map = room.map;
    const W = map.cols, H = map.rows;
    const free = (c, r) => map.boxFree(c * TILE + 2, r * TILE + 4, 12, 10);
    const sc = Math.max(0, Math.min(W - 1, Math.floor((p.x + 8) / TILE)));
    const sr = Math.max(0, Math.min(H - 1, Math.floor((p.y + 19) / TILE)));
    const key = (c, r) => r * W + c;
    const prev = new Map();
    prev.set(key(sc, sr), null);
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

  /**
   * REACTION TIME. `&botlag=N` makes the autopilot re-decide only every N
   * frames and hold whatever it last chose in between.
   *
   * Without it the bot reads the boss's state on the frame it changes and is
   * therefore a perfect player: it proves the fight is FAIR (every attack has
   * an answer) but says nothing about whether it is HARD. A human sees a
   * telegraph, decides, and moves; six frames is 100 ms, which is roughly a
   * fast human. Running the same fight at several lags is how "beatable on
   * the second or third try" gets a number instead of an opinion.
   */
  _botStep(engine) {
    const lag = parseInt(this.engine.params.get('botlag') || '1', 10) || 1;
    if (lag <= 1 || engine.frame % lag === 0 || !this._botKeys) {
      this._autoplay(engine);
      this._botKeys = [...engine.input.down];
      this._botTaps = [...engine.input.pressed];
      return;
    }
    const inp = engine.input;
    inp.down.clear();
    for (const k of this._botKeys) inp.down.add(k);
    // a tap is a tap: repeating a press every frame would make the bot swing
    // and blast far more often than a human holding the same stick could
    this._botTaps = [];
  }

  _autoplay(engine) {
    const inp = engine.input;
    inp.down.clear();
    const press = (k) => { inp.down.add(k); inp.pressed.add(k); };
    const hold = (k) => inp.down.add(k);
    const f = engine.frame;

    /**
     * WHAT THE BOT IS DOING THIS FRAME, as a label.
     *
     * The boss branches below each correspond to a read the fight asks a
     * human for. Tagging them turns "does the fight play differently in each
     * phase?" into a measurement rather than an argument: tools/critic/
     * bossline.js runs the fight on several seeds and prints the frame share
     * of every label PER PHASE. If phases 1, 2 and 3 came out with the same
     * histogram, the phases would be three cycles of one verb and the boss
     * would need redesigning, not re-tuning.
     */
    const act = (name) => {
      this.botAct = name;
      if (!this.botTally) this.botTally = {};
      const ph = (this.boss && !this.boss.dead) ? this.boss.phase : 0;
      const k = ph + '|' + name;
      this.botTally[k] = (this.botTally[k] || 0) + 1;
    };

    if (this.dialog.active || this.tr.busy || this.mapUI.open) {
      if (f % 24 === 0) press('a');
      return;
    }
    const room = this.cur;
    const p = this.player;
    const pcx = p.x + 8, pcy = p.y + 16;

    // UNSTICK. A scripted probe that wedges itself on a pillar corner tests
    // nothing.
    //
    // The per-frame test this used to run — "has Wren moved less than 0.4px
    // since last frame?" — cannot see the deadlock that actually happens. A
    // bot oscillating one pixel between two waypoints moves 1.0px every frame
    // and never trips it: measured, a full run parked at x=65/66 in B7 from
    // f11000 to f30000, alternating left and right forever, and the whole
    // boss half of the dungeon went unverified. The test is now a WINDOW: if
    // the net displacement over the last 90 frames is under 8px, he is stuck
    // no matter how busy his legs are.
    this._trail = this._trail || { x: p.x, y: p.y, t: 0 };
    const tr = this._trail;
    if (++tr.t >= 90) {
      const moved = Math.hypot(p.x - tr.x, p.y - tr.y);
      tr.t = 0; tr.x = p.x; tr.y = p.y;
      if (moved < 8) this._unstick = 40;
    }
    if (this._unstick > 0) {
      this._unstick--;
      // walk a quarter-circle rather than one fixed heading: a single random
      // direction re-picks into the same wall about a quarter of the time
      if (this._unstick % 20 === 19) {
        this._udir = ['left', 'right', 'up', 'down'][Math.floor(engine.rand() * 4)];
      }
      hold(this._udir || 'down');
      return;
    }

    const goTo = (tx, ty, slack = 3) => {
      if (tx - pcx > slack) hold('right');
      else if (pcx - tx > slack) hold('left');
      if (ty - pcy > slack) hold('down');
      else if (pcy - ty > slack) hold('up');
    };
    const navTo = (tx, ty, slack = 3) => {
      const w = this._nav(this.cur, p, tx, ty);
      goTo(w.x, w.y, slack);
    };
    const face = (tx, ty) => {
      const dx = tx - pcx, dy = ty - pcy;
      if (Math.abs(dx) > Math.abs(dy)) hold(dx > 0 ? 'right' : 'left');
      else hold(dy > 0 ? 'down' : 'up');
    };

    // --- boss
    //
    // One branch per thing KETTLEBACK can be doing, in priority order. Every
    // branch here corresponds to a read the design asks a HUMAN for — leave
    // the charge lane, ride the gap between the steam lances, step off a coal
    // or blow it out, stand in the middle of the spin's ring, Cuff the open
    // valve, swing up into the cradle from the rim. If the autopilot needs a
    // branch the player would not, that is a fight bug, not a bot bug.
    if (this.boss && !this.boss.dead) {
      const b = this.boss;
      const d = Math.hypot(b.cx - pcx, b.cy - pcy);
      const A = ARENA;
      const acx = A.x + A.w / 2, acy = A.y + A.h / 2;
      const clampX = (v) => Math.max(A.x + 12, Math.min(A.x + A.w - 12, v));
      const clampY = (v) => Math.max(A.y + 14, Math.min(A.y + A.h - 14, v));
      const goSafe = (tx, ty, slack = 2) => goTo(clampX(tx), clampY(ty), slack);
      /**
       * Back off to radius R — but AROUND the arena, not straight out from it.
       * Straight out gets clamped to nothing when the boiler is parked against
       * a wall, which is exactly where it parks after every charge, and the
       * bot then stood inside it taking contact damage between attacks.
       */
      const standOff = (R) => {
        const a0 = Math.atan2(pcy - b.cy, pcx - b.cx);
        let best = null, bs = -1;
        for (let i = 0; i < 12; i++) {
          const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.52;
          const tx = clampX(b.cx + Math.cos(a) * R);
          const ty = clampY(b.cy + Math.sin(a) * R * 0.9);
          const s = Math.hypot(tx - b.cx, ty - b.cy) - i * 1.5;
          if (s > bs) { bs = s; best = [tx, ty]; }
        }
        goTo(best[0], best[1], 4);
      };

      // STEAM LANCES — ride the middle of the gap and let it carry you round.
      if (b.lance) {
        const seg = Math.PI / 2;
        const lead = b.lance.t >= 44 ? b.lanceDir * 0.34 : 0;
        // Score every gap at two standoffs AFTER clamping to the arena — the
        // gap that looks safest in open space is often the one the masonry
        // will not let you stand in, and chasing it walks you into a beam.
        let best = null, bs = -1e9;
        for (let k = 0; k < 4; k++) {
          const t = b.lance.base + (k + 0.5) * seg + lead;
          for (const R of [78, 60]) {
            const tx = clampX(b.cx + Math.cos(t) * R);
            const ty = clampY(b.cy + Math.sin(t) * R * 0.86);
            const aa = Math.atan2((ty - b.cy) / 0.86, tx - b.cx);
            let rel = (aa - b.lance.base) % seg;
            if (rel < 0) rel += seg;
            const clear = Math.min(rel, seg - rel);
            if (Math.hypot(tx - b.cx, (ty - b.cy) / 0.86) < 46) continue;
            const s = clear * 70 - Math.hypot(tx - pcx, ty - pcy) * 0.3;
            if (s > bs) { bs = s; best = [tx, ty]; }
          }
        }
        act('ride-lance-gap');
        if (best) goTo(best[0], best[1], 2); else standOff(78);
        return;
      }
      // phase 3's arena jets run hot: never stand in a column that is firing
      for (const v of room.vents) {
        if (!v.dangerous && v.state !== 'jet') continue;
        const hb = v.hurtbox();
        if (pcx > hb.x - 13 && pcx < hb.x + hb.w + 13
          && pcy > hb.y - 11 && pcy < hb.y + hb.h + 11) {
          act('dodge-arena-jet');
          goSafe(pcx + (pcx < hb.x + hb.w / 2 ? -36 : 36), pcy, 1);
          return;
        }
      }
      // hurt and there is a heart on the deck: TAKE IT. The fight drops one
      // every second seize precisely so this is a real option.
      if (quest.get('halves') <= 4 && !b.vulnerable && b.state !== 'charge') {
        const hk = room.pickups.find(k => !k.taken && k.kind === 'heart');
        if (hk) { act('take-heart'); goSafe(hk.x + 8, hk.y + 8, 2); return; }
      }
      // ITS BEETLES. Measured over four seeds at a 67 ms reaction: the escorts
      // were the single largest source of damage in the whole fight — 35 of
      // phase 2's 72 half-hearts — because this branch only fired inside 22px,
      // i.e. after the beetle had already reached him. No player waits that
      // long. It now engages at 38px whenever the boiler itself is idle, and
      // opens with the Cuff, which is the verb the dungeon spent seven rooms
      // teaching: stagger it, then cut it down.
      {
        const quiet = b.state === 'idle' || b.state === 'wake' || b.state === 'stoke';
        const reach = quiet ? 38 : 22;
        const e = room.enemies.find(x => !x.dead && x.hp > 0
          && Math.hypot(x.x + 8 - pcx, x.y + 10 - pcy) < reach);
        if (e && !b.vulnerable) {
          act('kill-escort');
          const ed = Math.hypot(e.x + 8 - pcx, e.y + 10 - pcy);
          face(e.x + 8, e.y + 10);
          // CLOSE AND CUT. The escorts are ranged — a clockwork beetle vents
          // a steam jet at anything inside 76px — so standing off them is the
          // worst of the three options. Measured over four seeds at a 67 ms
          // reaction, escort damage was 63 half-hearts standing and blasting
          // (the Cuff does not stagger a beetle, and its wind-up roots Wren),
          // 51 half-hearts closing while blasting, and 42 closing and cutting.
          if (ed > 15) goSafe(e.x + 8, e.y + 10, 2);
          else if (f % 13 === 0) press('a');
          return;
        }
      }

      // CINDERS — blow out the one in front of you, or get off it.
      {
        let near = null, nd = 1e9;
        for (const c of b.embers) {
          if (!c.live) continue;
          const dd = Math.hypot(c.cx - pcx, c.cy - pcy);
          if (dd < nd) { nd = dd; near = c; }
        }
        if (near && nd < 26) {
          if (quest.has('hasBellowsCuff') && nd > 12) {
            act('snuff-cinder');
            face(near.cx, near.cy);
            if (f % 12 === 0) press('b');
            return;
          }
          act('flee-cinder');
          goSafe(pcx + (pcx - near.cx) * 3, pcy + (pcy - near.cy) * 3, 1);
          return;
        }
      }

      if (b.vulnerable) {
        // stand OFF the chassis and swing up into the cradle — the rim reach
        // the enlarged hurtbox exists for
        if (b.seizeHits >= 2) { act('collar-cooled'); standOff(74); return; }
        if (d < 46) { act('slash-cradle'); face(b.cx, b.cy); if (f % 11 === 0) press('a'); return; }
        // Take the NEAREST striking spot the arena allows. Marching round to a
        // fixed one burned 57 of the window's 103 frames walking — the window
        // is short enough that where you already stand has to count.
        const cands = [[b.cx, b.cy + 40], [b.cx, b.cy - 34],
          [b.cx - 36, b.cy], [b.cx + 36, b.cy]];
        let spot = null, sd = 1e9;
        for (const [tx, ty] of cands) {
          if (tx < A.x + 10 || tx > A.x + A.w - 10) continue;
          if (ty < A.y + 12 || ty > A.y + A.h - 12) continue;
          const dd = Math.hypot(tx - pcx, ty - pcy);
          if (dd < sd) { sd = dd; spot = [tx, ty]; }
        }
        act('close-on-cradle');
        if (spot) goTo(spot[0], spot[1], 2); else goSafe(b.cx, b.cy + 40, 2);
        return;
      }
      if (b.valve === 2) {
        // stand BEHIND the chimney, off the chassis, and blast along its axis.
        // 26px behind the centre — where this used to aim — is inside a 64px
        // boiler, so the bot spent the whole vent window standing in the body
        // and ate it the instant the window closed.
        const vx = b.cx - dirV(b.dir)[0] * 46, vy = b.cy - dirV(b.dir)[1] * 46;
        if (Math.hypot(vx - pcx, vy - pcy) > 16) { act('line-up-valve'); goSafe(vx, vy, 3); }
        else { act('cuff-valve'); face(b.cx, b.cy); if (f % 9 === 0) press('b'); }
        return;
      }
      // THE SPIN — its ring has a hole in the middle. Stand in it.
      if (b.state === 'spin') { act('centre-of-spin'); goSafe(acx, acy, 2); return; }
      if (b.state === 'charge' || b.state === 'rear') {
        // step out of the lane, perpendicular, and far enough out that a 64px
        // chassis clears you. Prefer the side you are on; take the other if
        // this one has no room.
        const [dx] = dirV(b.dir);
        const pick = (mid, lo, hi, on) => {
          const s = on ? -1 : 1;
          return (s < 0 ? mid - lo : hi - mid) >= 48 ? mid + s * 48 : mid - s * 48;
        };
        act('leave-charge-lane');
        if (dx) goSafe(pcx, pick(b.cy, A.y + 14, A.y + A.h - 14, pcy < b.cy), 2);
        else goSafe(pick(b.cx, A.x + 14, A.x + A.w - 14, pcx < b.cx), pcy, 2);
        return;
      }
      // (jet check runs earlier now)
      for (const v of room.vents) {
        if (!v.dangerous && v.state !== 'jet') continue;
        const hb = v.hurtbox();
        if (pcx > hb.x - 14 && pcx < hb.x + hb.w + 14
          && pcy > hb.y - 12 && pcy < hb.y + hb.h + 12) {
          act('dodge-arena-jet');
          goSafe(pcx + (pcx < hb.x + hb.w / 2 ? -40 : 40), pcy, 1);
          return;
        }
      }
      // otherwise: keep a charge's length of daylight between you and it
      act('stand-off');
      standOff(76);
      return;
    }

    // --- THE RIVETER
    //
    // DO NOT CHASE THE ELBOW. The old policy walked at `elbow + 26px` and
    // blasted when it got within 30. The elbow is not a position, it is the
    // output of a 2-bone IK solve whose target is `Wren - 26px`: every step
    // toward it moves it, and the solution flips the elbow 35px sideways when
    // the arm folds. Measured over a full B6 fight, that policy spent 218 of
    // 7559 frames inside its own trigger radius, fired the Cuff TWICE, and
    // took two minutes to land four hits.
    //
    // A player stands UNDER the arm — at the shoulder's column, below its
    // reach — and blasts straight up. That spot is fixed, so it converges.
    if (room.riveter && !room.riveter.dead) {
      const r = room.riveter;
      if (r.vulnerable) {
        // the arm hangs limp near the deck: walk to the elbow and cut it.
        // The swing rides the BLADE's readiness for the same reason the blast
        // rides the Cuff's: `f % 11 === 0` sampled every 12 frames coincides
        // once per 132, so at botlag 12 the arm was choked 3124 frames in one
        // run and lost 6 hit points to it. Ask whether the sword is free.
        act('cut-the-elbow');
        if (Math.hypot(r.elbow.x - pcx, r.elbow.y - pcy) > 18) goTo(r.elbow.x, r.elbow.y + 14, 2);
        else { face(r.elbow.x, r.elbow.y); if (!this.melee.sword.active) press('a'); }
        return;
      }
      const armY = Math.max(r.elbow.y, r.hand.y);
      const ty = Math.max(70, Math.min(172, armY + 28));
      // THE B PRESS RIDES THE CUFF, NOT THE FRAME COUNTER. `f % 30 === 3` is
      // only ever true on an ODD frame, so at any botlag that is even the
      // policy is never evaluated on a frame that can fire and the autopilot
      // pressed B exactly ZERO times in 12,000 frames — the round-14 "bot=play
      // stalls in B6 at botlag > 1" report, in one line. Ask the Cuff and the
      // arm whether the choke is available instead; that is true for a whole
      // window, so it survives being sampled every 2, 6, 12 or 20 frames.
      //
      // CHOKING BEATS DUCKING. Order matters: a stagger cancels the volley
      // outright, so when the air line is open the blast is always the better
      // answer than a sidestep, and the duck below only runs while the arm is
      // braced (cuffCool > 0) and there is nothing to be done about it.
      if (r.cuffCool <= 0 && Math.abs(pcx - r.sx) < 12) {
        act('choke-the-arm');
        hold('up');
        if (this.cuff.cool <= 0 && !this.cuff.active) press('b');
        return;
      }
      // DUCK THE VOLLEY. The arm now fans four lanes and puts a two-rivet
      // spread on the tile it was struck from the instant it stands back up,
      // so "walk to the shoulder column and metronome" is no longer a policy
      // — it is a way to get shot. Step out of the path of anything whose
      // closing line passes within 8px of Wren inside the next 16 frames,
      // perpendicular to the rivet, which is the shortest way out.
      {
        let worst = null, wt = 1e9;
        for (const rv of r.rivets) {
          const rx = rv.x + 3, ry = rv.y + 3;
          const dx = pcx - rx, dy = pcy - ry;
          const sp = rv.vx * rv.vx + rv.vy * rv.vy;
          if (sp <= 0) continue;
          const t = (dx * rv.vx + dy * rv.vy) / sp;      // closest-approach time
          if (t < 0 || t > 16) continue;
          const mx = rx + rv.vx * t, my = ry + rv.vy * t;
          if (Math.hypot(mx - pcx, my - pcy) > 8) continue;
          if (t < wt) { wt = t; worst = rv; }
        }
        if (worst) {
          act('duck-rivet');
          // perpendicular, away from the side the rivet is closing on
          const px2 = -worst.vy, py2 = worst.vx;
          const s = ((pcx - worst.x) * px2 + (pcy - worst.y) * py2) >= 0 ? 1 : -1;
          goTo(Math.max(26, Math.min(230, pcx + px2 * s * 22)),
            Math.max(30, Math.min(178, pcy + py2 * s * 22)), 1);
          return;
        }
      }
      act('under-the-arm');
      goTo(r.sx, ty, 3);
      return;
    }

    // --- anything within a pike's length gets dealt with first, sealed room
    // or not: walking a puzzle route through a live patrol is how a bot (and
    // a player) bleeds out.
    {
      const e = room.enemies.find(x => !x.dead && x.hp > 0
        && Math.hypot(x.x + 8 - pcx, x.y + 10 - pcy) < 30);
      if (e) {
        const ex = e.x + 8, ey = e.y + 10;
        if (quest.has('hasBellowsCuff') && !e.staggered) {
          face(ex, ey); if (f % 18 === 0) press('b'); return;
        }
        face(ex, ey); if (f % 13 === 0) press('a'); return;
      }
    }

    // --- GET OUT OF THE LANE. A winding-up ClockworkBeetle is a steam vent
    // with legs: 22 frames of braced telegraph, then a 26-frame jet ~30px
    // down the axis it is facing. The room-vent branch below has always
    // stepped out of a live column; nothing did the same for a beetle,
    // because until the target was wired at the call site the beetle never
    // aimed one at Wren and the case could not arise.
    //
    // IT RUNS LATE AND IT RUNS SECOND. Placed above the melee branch and
    // armed for the whole 22-frame windup, this livelocked B1: at botlag 12
    // the bot spent 20,000 frames sidestepping a beetle it was never allowed
    // to turn round and kill, and seed 2 never left the entry room. Sidestep
    // only once the jet is imminent (last 12 frames of the windup) or live,
    // and only after "kill the thing next to you" has had its say.
    for (const e of room.enemies) {
      if (e.dead || e.hp <= 0 || !e.dir) continue;
      const live = e.state === 'vent' || (e.state === 'wind' && e.timer <= 12);
      if (!live) continue;
      const ex = e.x + 8, ey = e.y + 8;
      const dx = pcx - ex, dy = pcy - ey;
      const vert = e.dir === 'up' || e.dir === 'down';
      const along = e.dir === 'up' ? -dy : e.dir === 'down' ? dy : e.dir === 'left' ? -dx : dx;
      const off = vert ? Math.abs(dx) : Math.abs(dy);
      if (along < -6 || along > 48 || off > 14) continue;
      act('leave-jet-lane');
      if (vert) goTo(pcx + (dx >= 0 ? 26 : -26), pcy, 1);
      else goTo(pcx, pcy + (dy >= 0 ? 26 : -26), 1);
      return;
    }

    // --- do not stand in a live jet. Without the Cuff the only answer to a
    // vent is the beat, so back out of its column and wait.
    for (const v of room.vents) {
      if (!v.dangerous && v.state !== 'jet') continue;
      const hb = v.hurtbox();
      if (pcx > hb.x - 12 && pcx < hb.x + hb.w + 12
        && pcy > hb.y - 10 && pcy < hb.y + hb.h + 10) {
        hold(pcx < hb.x + hb.w / 2 ? 'left' : 'right');
        return;
      }
    }

    // --- live steam in the way: SNUFF it. B7's west vent has no rest cycle,
    // so this is not an optimisation, it is the only way through.
    if (quest.has('hasBellowsCuff')) {
      for (const v of room.vents) {
        if (v.state === 'off') continue;
        const vx = v.x + 8, vy = v.y + 8;
        const d = Math.hypot(vx - pcx, vy - pcy);
        if (d > 12 && d < 34) { face(vx, vy); if (f % 10 === 0) press('b'); return; }
      }
    }

    // --- the shard in the wreck. Without this the probe fights KETTLEBACK,
    // wins, and then wanders the arena forever, so nothing downstream of the
    // kill — the cradle, the skylight, the chapter card — is ever verified.
    if (this.shard && !this.shard.taken) {
      navTo(this.shard.x + 8, this.shard.y + 12, 1);
      return;
    }

    // --- anything lying on the floor (the small key in B2 is a DETOUR, and
    // a probe that never detours never proves the room)
    const pk = room.pickups.find(k => !k.taken);
    if (pk) { navTo(pk.x + 8, pk.y + 14, 2); return; }

    // --- ONE HIT FROM DEAD. This is the only case that outranks the room's
    // own work: a player on half a heart standing in B5's gear gauntlet does
    // not finish the route, he goes and finds something to break. Kept on a
    // short leash (a canister across the room is not an option at this point)
    // and on the same patience budget as the branch below.
    if (quest.get('halves') <= 1) {
      const k = this._botCanister(room, pcx, pcy, 120);
      if (k) { act('last-ditch-heal'); if (this._botSwing(k, room, pcx, pcy, f, navTo, face, press)) return; }
    }

    // --- gear-switch rooms. Gated on actually HOLDING the Cuff: B1's alcove
    // is a backtrack reward, and a probe that stands under a switch it cannot
    // spin, pressing B into a steam vent, never leaves the entry room.
    const off = quest.has('hasBellowsCuff') ? room.switches.filter(s => !s.on) : [];
    if (room.cage && !room.cage.open && off.length) {
      off.sort((a, b) => Math.hypot(a.x - pcx, a.y - pcy) - Math.hypot(b.x - pcx, b.y - pcy));
      const g = off[0];
      const tx = g.x + 8, ty = g.y + 30;
      if (Math.hypot(tx - pcx, ty - pcy) > 14) navTo(tx, ty);
      else { hold('up'); if (f % 8 === 0) press('b'); }
      return;
    }
    // --- crate onto a pressure plate (also a Cuff verb)
    if (quest.has('hasBellowsCuff') && room.cage && !room.cage.open
      && room.plates.some(pl => !pl.down)) {
      const plate = room.plates.find(pl => !pl.down);
      const px2 = plate.x + 8, py2 = plate.y + 8;
      let best = null, bd = 1e9;
      for (const c of room.crates) {
        const d = Math.hypot(c.x + 8 - px2, c.y + 8 - py2);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && !best.slide) {
        // A crate is SOLID: walking straight at the spot you want to blast
        // from just jams into it. Route out to a lane beside the crate first,
        // run down that lane, then step back in behind it.
        const cx2 = best.x + 8, cy2 = best.y + 8;
        const ax = px2 - cx2, ay = py2 - cy2;
        // PICK AN AXIS YOU CAN ACTUALLY STAND BEHIND. The old rule was
        // "whichever gap is bigger", which on an exactly diagonal offset
        // (B7, crate one tile right and one tile below the plate) chose the
        // vertical push — and the spot you have to stand in for that is 26px
        // off the bottom of the room. The bot pushed once, could not push
        // again, and parked there. Score both axes and drop any whose
        // standing spot is outside the floor or inside masonry.
        const cands = [];
        if (Math.abs(ax) >= 8) cands.push([Math.sign(ax), 0, Math.abs(ax)]);
        if (Math.abs(ay) >= 8) cands.push([0, Math.sign(ay), Math.abs(ay)]);
        const standOk = (sx, sy) => sx > 20 && sx < WIDTH - 20 && sy > 24
          && sy < HEIGHT - 24 && room.map.boxFree(sx - 6, sy - 4, 12, 10);
        const usable = cands.filter(([qx, qy]) =>
          standOk(cx2 - qx * 22, cy2 - qy * 22 + 4));
        const pickAxis = (usable.length ? usable : cands)
          .sort((a, b) => b[2] - a[2])[0] || [Math.sign(ax) || 1, 0, 0];
        const [ux, uy] = pickAxis;
        const tx = cx2 - ux * 22, ty = cy2 - uy * 22 + 4;
        const lane = uy !== 0
          ? { x: cx2 + (cx2 > 128 ? -30 : 30), y: ty }
          : { x: tx, y: cy2 + (cy2 > 112 ? -30 : 30) };
        const onAxis = uy !== 0 ? Math.abs(pcx - cx2) < 14 : Math.abs(pcy - cy2) < 14;
        const past = uy !== 0
          ? (uy > 0 ? pcy > ty + 6 : pcy < ty - 6)
          : (ux > 0 ? pcx > tx + 6 : pcx < tx - 6);
        // a crate you are touching is a crate you can never reach the exact
        // centre of, so aim at a BAND, not a point
        const inRange = uy !== 0
          ? Math.abs(pcx - cx2) < 11 && Math.abs(pcy - ty) < 16
          : Math.abs(pcy - cy2) < 11 && Math.abs(pcx - tx) < 16;
        if (inRange) { face(cx2, cy2); if (f % 14 === 0) press('b'); return; }
        if (past && onAxis) { navTo(lane.x, pcy, 2); return; }  // step out
        if (past) { navTo(lane.x, lane.y, 2); return; }         // run the lane
        navTo(tx, ty, 2);
        return;
      }
    }

    // --- A CANISTER IS A HEAL YOU HAVE TO GO AND GET.
    //
    // Opportunistic, and it runs AFTER the room's own work rather than before
    // it. Placed above the gear-switch branch this cost B5 its 280-frame
    // window — the bot broke off mid-route for a heal, the pressure bled, and
    // one seed died five times in that room alone. Progress first, healing
    // second, exactly like a player who knows the pots will still be there
    // when the cage opens. The genuinely-about-to-die case is the branch
    // further up, and it is the only one allowed to outrank the room.
    if (quest.get('halves') < quest.get('maxHearts') * 2) {
      const k = this._botCanister(room, pcx, pcy,
        quest.get('halves') <= 2 ? 1e9 : 44);
      if (k) {
        act('crack-a-canister');
        if (this._botSwing(k, room, pcx, pcy, f, navTo, face, press)) return;
      }
    }


    // Chests open from BELOW, and a chest is a solid obstacle: walking
    // straight at one from above just jams into it. Come round the side
    // first, then step up into it.
    const approach = (ch) => {
      // Mirror the real interaction band rather than aiming at a point: the
      // chest is solid, so the point the bot wants is one it can never quite
      // stand on, and a distance test there deadlocks.
      const aligned = Math.abs(pcx - (ch.x + 8)) < 9
        && pcy > ch.y + 10 && pcy < ch.y + 36;
      if (aligned) { hold('up'); if (f % 14 === 0) press('a'); return; }
      if (pcy < ch.y + 20) { navTo(ch.x + 30, ch.y + 42, 2); return; }
      navTo(ch.x + 8, ch.y + 26, 2);
    };
    for (const ch of room.chests) {
      if (ch.open) continue;
      if (room.cage && ch === room.cage.chest && !room.cage.open) continue;
      approach(ch);
      return;
    }
    // sealed arena: fight
    if (room.sealed && room.enemiesAlive > 0) {
      const e = room.enemies.find(x => !x.dead && x.hp > 0);
      const ex = e.x + 8, ey = e.y + 10;
      const d = Math.hypot(ex - pcx, ey - pcy);
      // Cuff first: it drops the shield. Without it, come round the back —
      // a tin soldier's front is armoured and the blade just rings off it.
      if (quest.has('hasBellowsCuff') && !e.staggered && d < 32) {
        face(ex, ey); if (f % 20 === 0) press('b'); return;
      }
      if (e.dir && !e.staggered) {
        const [bx, by] = dirV(e.dir);
        const tx = ex - bx * 20, ty = ey - by * 20;
        if (Math.hypot(tx - pcx, ty - pcy) > 9) { goTo(tx, ty); return; }
      } else if (d > 16) { goTo(ex, ey); return; }
      face(ex, ey);
      if (f % 13 === 0) press('a');
      return;
    }
    // otherwise: head for an onward door
    const order = ['north', 'east', 'west', 'south'];
    for (const side of order) {
      const dd = room.doors[side];
      if (!dd || !dd.to) continue;
      if (dd.state === 'shut') continue;
      if (dd.state === 'locked' && quest.get('smallKeys') <= 0) continue;
      if (dd.state === 'boss' && !quest.has('bigKey')) continue;
      const z = DOOR_CELLS[side];
      const t = side === 'north' ? [z.x + 16, z.y + 2]
        : side === 'south' ? [z.x + 16, z.y + 30]
          : side === 'west' ? [z.x + 2, z.y + 16] : [z.x + 30, z.y + 16];
      navTo(t[0], t[1], 1);
      return;
    }
  }
}

/** Wrap an Input so the A button reads as unpressed for one frame. */
function maskA(input) {
  return {
    held: (k) => input.held(k),
    hit: (k) => (k === 'a' ? false : input.hit(k)),
  };
}

function dirV(d) {
  return { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[d] || [0, 1];
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function mkBuf() {
  const c = document.createElement('canvas');
  c.width = WIDTH; c.height = HEIGHT;
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}
