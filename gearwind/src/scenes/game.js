// GEARWIND — CHAPTER 1, END TO END.  ?scene=game
//
// This is the chapter. Title -> intro -> the dock -> Cogwick Hollow -> the
// works road -> the Boilerworks -> KETTLEBACK -> the shard in the cradle.
//
// WHAT THIS FILE IS FOR
// Every module in this project was verified in its own demo scene and nothing
// composed them: `index.html` defaults to ?scene=game and ?scene=game did not
// exist. This file is the composition. It owns four things nobody owned:
//
//  1. THE PHASE MACHINE. src/game/gameflow.js holds the sequencing; this file
//     holds the objects. The front end (titlescreen.js's FrontEnd), the
//     overworld half (scenes/overworld.js) and the Boilerworks half
//     (scenes/dungeon.js) are DRIVEN, not reimplemented — both scene files
//     already document integration hooks (`onEnterDungeon`, `{ startRoom,
//     onFinish }`) and this file is the thing that was supposed to use them.
//
//  2. THE HUD. Both scenes drew a correct HUD at correct coordinates and
//     nobody owned their composition, so the strip arrived as scattered
//     furniture: a gauge pinned full and bright over the terrain, an item box
//     holding A LINK TO THE PAST'S BOMB, and a third counter with a bomb icon
//     for a game that has no bombs. hud.js is ref-exact and is not edited —
//     what was missing was one place deciding what goes IN it. That place is
//     `drawHud()` below: one draw call per element, at the measured ALttP
//     origins, drawn once, after the world and the y-sorted entities and
//     before the text window.
//
//  3. THE ITEM-GET. An item pose freezes the scene (`tr.frozen`), and a
//     DialogBox that is still open when one starts stops ticking and hangs
//     half-wiped across the middle of the screen for the whole presentation —
//     which is exactly what happened on the Cogblade, the chapter's defining
//     beat. Guarded here for BOTH halves: see `_guardPose()`.
//
//  4. THE SUBSCREEN. START opened two different screens — the kit above
//     ground, the floor plan below — so half the chapter could not check its
//     cogs and the other half had no map. There is one now, built here
//     because this file owns the HUD whose icons and digits it borrows, and
//     handed to the Boilerworks in place of its own (see makeDungeon).
//
// URL SWITCHES
//   ?scene=game                  the chapter, from the title screen
//   &beat=<name>                 warp: dock village bridge dungeon-b1
//                                dungeon-b4 boss ending
//   &bot=play                    autopilot — drives the real Input through the
//                                title, the INTRO PANELS, above ground and
//                                below, so a capture run walks the whole
//                                chapter without a pair of hands. It presses
//                                A, not START: a driver that only presses the
//                                button which SKIPS the intro is the reason a
//                                crash on the first panel survived every
//                                automated run this project ever made.
//   &debug                       phase / screen / flag readout
//   &mute                        no score

import { WIDTH, HEIGHT } from '../engine.js';
import { FrontEnd } from '../game/titlescreen.js';
import OverworldScene from './overworld.js';
import DungeonScene from './dungeon.js';
import { HUD, drawCounter } from '../game/hud.js';
import { drawDialogText, dialogTextWidth, DialogBox, BOX } from '../game/dialog.js';
import { makeSprite } from '../sprites.js';
import { quest } from '../game/quest.js';
import { SkyState } from '../game/skystate.js';
import sfx from '../game/sfx.js';
import { makeItemSprites } from '../game/items.js';
import { makeCombatSprites } from '../game/combat.js';
import {
  DEATH_IMPACT, DEATH_CARD_DELAY, DEATH_REST_CY, deathFrameIndex,
} from '../game/player-sprites.js';
import { Pickup } from '../game/world/maps-dungeon.js';
import { DPAL } from '../game/world/boilerworks.js';
import {
  GameFlow, PHASE, WARPS, applyWarp, OverworldBot, DungeonNudge,
  SKY_ON_SCREEN, SCREEN_SCENES, singleSfx, guardDialogDraw, drawSkylightOver,
  Subscreen, reinforce, reinforceRoom, Bounty, standClear,
  oneDialogVoice, oneVoiceBox, joinSharedGraph, Ending, questScope,
} from '../game/gameflow.js';

// ---------------------------------------------------------------------------
// THE CRASH THAT MADE THE CHAPTER UNFINISHABLE.
//
// Turning the FIRST intro panel threw inside DialogBox.draw and, because
// engine.js schedules the next requestAnimationFrame AFTER scene.draw(), the
// throw killed the loop for good: a human starting at the title screen was
// hard-frozen about five seconds in and could never reach the chapter at all.
//
// Exactly: DialogBox.close() sets `closing = OPEN_FRAMES` and `node = null` in
// the same statement, so on the first closing frame `closing / OPEN_FRAMES`
// is 1, draw() skips its `if (t < 1)` wipe branch, and walks straight into
// `this._page`, which is null because node is. update() normally decrements
// `closing` before the scene draws, which is why the overworld and the
// Boilerworks never see it — but Intro.update closes the box inside its own
// box.update() on the very frame it then draws.
//
// dialog.js belongs to another piece, so the guard is installed here, on the
// prototype, at module load: every DialogBox in the game — the intro's, the
// overworld's, the Boilerworks', mine — is safe from the moment this scene is
// imported. It changes nothing about a normal frame; see gameflow.js.
// ---------------------------------------------------------------------------
guardDialogDraw(DialogBox);

// ---------------------------------------------------------------------------
// AND THE TEXT BLIP GETS THE CHAPTER'S ONE MIXER.
//
// Same reason, same place, one line later. dialog.js's built-in blip opens an
// AudioContext of its OWN — a raw square wave that never meets the master
// lowpass, the echo bus or the voice stealing everything else in the game lives
// inside. sfx.js already tries to replace it, but it wires the prototype from
// inside a dynamic import, and every DialogBox in the game is constructed
// before that promise resolves; dialog.js's constructor then plants an own
// `sfx` property that shadows the accessor for good. Measured on a real run:
// 30 raw oscillator starts on a private second context inside 6,000 frames.
//
// Installing it HERE, at module load, wins that race — the accessor exists
// before the first box does, so the constructor's assignment goes through its
// setter and no shadow is ever created. See gameflow.oneDialogVoice.
// ---------------------------------------------------------------------------
oneDialogVoice(DialogBox, sfx);

// ---------------------------------------------------------------------------
// HUD PLACEMENT — the single canonical copy.
//
// These are hud.js's own measured ALttP origins (gauge 20,18; item box 38,20;
// counter icons on the y15 baseline with their digits at y24; hearts pinned at
// 161,24 with LIFE centred over a ten-heart span). They are repeated here
// rather than imported because hud.js does not export them, and because THIS
// is the file that is allowed to decide where the strip sits — see the header.
// Verified against refs/overworld-cliff-path-soldiers.png, whose HUD occupies
// the identical cells.
// ---------------------------------------------------------------------------
const HUD_AT = {
  meter: [20, 18],
  box: [38, 20],
  cogs: [67, 15],
  keys: [99, 15],
  pieces: [123, 15],
  hearts: [161, 24],
  digitY: 24,
};

// Third counter icon. ALttP's third slot is bombs; Gearwind has no bombs, so
// the slot carries HEART PIECES — the chapter's one collectable that needs a
// running total. Built to the same grammar as hud.js's cog and key: a closed
// black keyline, one unbroken chroma slug, a lit face above a shaded one and a
// single white glint embedded in the body rather than laid on the outline.
// A shard rather than a lobed heart, so it cannot be confused at 3x with the
// life row eighty pixels to its right.
const PIECE_PAL = {
  k: '#000000',
  W: '#f8f8f8',
  L: '#f87078',   // lit face  — luma 141, above the brightest ground in scene
  R: '#c00000',   // ALttP heart red, hud.js's exact value
};
const PIECE_ICON = [
  '...kk...',
  '..kWLk..',
  '.kLLLRk.',
  'kLLRRRRk',
  'kLRRRRRk',
  '.kRRRRk.',
  '..kRRk..',
  '...kk...',
];

// Hesper's SECOND WIND charm, for the subscreen's kit list: a brass coil
// wound round a red bead. Same grammar as the counter icons — closed keyline,
// one chroma slug, a lit face, one embedded glint.
const CHARM_PAL = {
  k: '#000000', B: '#a8802a', A: '#f4e4a8', R: '#c00000', L: '#f87078',
};
const CHARM_ICON = [
  '..kkkk..',
  '.kBAABk.',
  'kBkRRkBk',
  'kARLLRAk',
  'kARLRRAk',
  'kBkRRkBk',
  '.kBAABk.',
  '..kkkk..',
];

// How far up the harbour road Wren gets before Pell shouts him back down —
// player.y, i.e. four tiles clear of the dock's north edge, which is where
// edgeExit fires (world/overworld.js: `player.y <= -6`). Far enough that it
// reads as being called back rather than as a wall across the road, and low
// enough that the man being called back is not standing behind the HUD's item
// box (hud strip: y < 60). See _gateColdOpen.
const COLD_OPEN_FENCE = 56;

// The screen the Boilerworks arch stands on (maps-overworld.js `mouth`). The
// hatch comes out where it went in — and a run warped straight to `dungeon-b1`
// never stood there at all, so climbing out has to be able to ENTER it, not
// only to restore a position. See ascend / _surface.
const MOUTH_SCREEN = 'mouth';

/** Centre any sprite inside the item box's 16x16 well. */
function wellIcon(img) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  if (img) {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, Math.round((16 - img.width) / 2), Math.round((16 - img.height) / 2));
  }
  return c;
}

export default class GameScene {
  async init(engine) {
    this.engine = engine;
    const params = engine.params || new URLSearchParams(location.search);
    this.params = params;
    this.debug = params.has('debug');
    this.bot = params.get('bot') || null;
    this.beat = params.get('beat');
    this.quest = quest;

    // --- the fall. ONE SkyState for the whole chapter, owned here, so a
    //     screen change, a phase change or a warp cannot reset it.
    this.sky = new SkyState(0);

    // --- the HUD. One instance, handed to both halves; `draw` is replaced by
    //     ours, which is what makes this file the single owner of the strip.
    this.hud = new HUD({ maxHearts: 3, halves: 6, cogs: 0, keys: 0, bombs: 0, steam: 0 });
    this.hud.draw = (ctx) => this.drawHud(ctx);
    this.pieceIcon = makeSprite(PIECE_ICON, PIECE_PAL);
    this.charmIcon = makeSprite(CHARM_ICON, CHARM_PAL);
    const itemSpr = makeItemSprites();
    this.itemIcons = {
      none: wellIcon(null),
      cogblade: wellIcon(makeCombatSprites().sword.n.img),
      cuff: wellIcon(itemSpr.cuff),
    };

    // ONE SUBSCREEN, BOTH HALVES (see gameflow.Subscreen). It is built here
    // because this is the file that owns the HUD, and the counts on it are
    // drawn with the HUD's OWN icons and digits rather than a second set: the
    // cog and key sprites come straight off `this.hud.sprites`, the numerals
    // out of hud.js's `drawCounter`, and the LIFE row is the HUD's own
    // `drawHearts` handed over as a callback. The Boilerworks' floor plan is
    // the same object below ground — see makeDungeon.
    this.sub = new Subscreen({
      sword: makeCombatSprites().sword.n.img,
      cuff: itemSpr.cuff,
      key: itemSpr.smallKey,
      charm: this.charmIcon,
      cog: this.hud.sprites.cog,
      keyIcon: this.hud.sprites.key,
      piece: this.pieceIcon,
      map: itemSpr.map,
      compass: itemSpr.compass,
      bigKey: itemSpr.bigKey,
      smallKey: itemSpr.smallKey,
    }, (c, x, y) => this.hud.drawHearts(c, x, y));

    // `sawFirstLurch` shipped in the flag table set by nobody. It is the one
    // piece of state that says the player has FELT the fall rather than been
    // told about it, so it is set on the first lurch of the run, whatever
    // fires it, and a later chapter can ask whether he was there for it.
    quest.on('lurch', () => { if (!quest.has('sawFirstLurch')) quest.set('sawFirstLurch', true); });

    this.flow = new GameFlow({ quest, onPhase: (n, p) => this.onPhase(n, p) });
    if (params.has('mute')) this.flow.music.enabled = false;

    this.finished = false;
    this.descending = 0;
    this._bossReward = false;

    // THE ENDING'S OWN WINDOW. The four prose pages of STORY.md's beat 6 — the
    // shard, the rise, the ship and Marla's line — go through this one box,
    // which the sequence drives on its own clock (see gameflow.Ending) rather
    // than waiting on a player to mash A through the payoff of the chapter.
    // No advance arrow: nothing in the ending is waiting for you, and a page
    // cannot be cut below its reading floor by pressing one.
    //
    // THE CARD IS NOT IN HERE. "TO BE CONTINUED / CHAPTER 2 / THE UPPER
    // REACHES" is composed on the whole 256x224 screen — see Ending._drawCard —
    // because the last image of the chapter arriving in the same 168x47 window
    // Dockhand Pell talks out of is the payoff delivered in the furniture of an
    // errand, one layer up from the bug this class was written to fix.
    this.cardBox = oneVoiceBox(new DialogBox());
    this.cardBox._drawArrow = () => { };
    this.endSeq = null;
    this.stillInput = { hit: () => false, down: new Set(), pressed: new Set() };

    // The death set piece (see updateDeath / drawGameOver). ONE card for the
    // whole chapter, above ground and below — see beginDeath().
    this.death = null;
    this.deaths = 0;
    // Frames on which the composition has actually driven the death body.
    // Reported by state() so a probe can prove the set piece ran instead of
    // reading a diff and believing it.
    this.deathFrames = 0;
    this.skyDone = new Set();
    this.sceneDone = new Set();   // the once-only screen beats (SCREEN_SCENES)
    this._pellNag = 0;

    // --- the overworld half is built eagerly: it is where the chapter starts,
    //     and building it here means the handover out of the front end is a
    //     phase flip rather than an async gap with a black screen in it.
    const warp = this.beat && WARPS[this.beat] ? WARPS[this.beat] : null;
    await this.makeOverworld(warp && warp.screen ? warp.screen : null);

    this.front = new FrontEnd({ onStart: () => this.startChapter() });
    this.owBot = new OverworldBot(quest);

    if (warp) {
      if (warp.phase === PHASE.DUNGEON) {
        await this.makeDungeon(warp.room, warp.give);
      }
      applyWarp(quest, this.beat);
      this.sky.jumpTo(warp.sky || 0);
      this.flow.set(warp.phase);
      if (warp.bossDown) this.forceEnding();
      this.hud.snap();
    }

    this.syncHud();
    if (typeof window !== 'undefined') window.__gwGame = this;
  }

  // ------------------------------------------------------------- sub-scenes

  /**
   * The two half-scenes read their own debug switches off `engine.params`, so
   * each gets an engine whose params we control. Everything else (the Input
   * object, the live frame counter, the deterministic RNG) is the real
   * engine's, inherited through the prototype chain.
   */
  subEngine(extra) {
    const e = Object.create(this.engine);
    const p = new URLSearchParams();
    for (const [k, v] of this.params.entries()) p.set(k, v);
    for (const [k, v] of Object.entries(extra || {})) {
      if (v === null || v === undefined) p.delete(k); else p.set(k, v);
    }
    e.params = p;
    e.rand = () => this.engine.rand();
    return e;
  }

  async makeOverworld(screenId) {
    // Everything either half-scene subscribes to the quest store from here on
    // belongs to THIS run of the chapter, and is dropped when the card sends
    // the player back to the title. See gameflow.questScope / _newGame.
    this._scope = questScope(quest);
    this.owEngine = this.subEngine({ screen: screenId, beat: null });
    this.ow = new OverworldScene();
    await this.ow.init(this.owEngine);
    // Take ownership of the two things that must survive a phase change.
    this.ow.sky = this.sky;
    this.ow.hud = this.hud;
    this.ow.onEnterDungeon = () => this.descend();

    // THE DOORSTEP TRAP. `leaveInterior()` puts Wren back ten pixels below the
    // door he came out of, and `doorUnder()` is positional and needs no input:
    // where a building's door box is deeper than that ten pixels — the Hollow's
    // windmill is, its box covering y 126-144 — walking out puts you straight
    // back in, forever, with nothing the player can press to stop it. Measured:
    // villagee -> mill -> villagee -> mill, twenty frames a lap, until the run
    // was killed. Both methods belong to the overworld half; the LOCK belongs
    // here, at the seam, and it is the same rule the Boilerworks portal
    // already uses one function further down that file (`_onPortal`): a door
    // you have just come out of does not work again until you have stepped
    // OFF it. Not a timer — a timer just makes the loop slower. This also
    // makes the Hollow's thornwrack cuttable, which is the chapter's one real
    // gate: the tile you have to stand on to swing at it is inside that door.
    const useDoor = this.ow.useDoor.bind(this.ow);
    this.ow.useDoor = (door) => { if (this._onDoorstep) return; useDoor(door); };
    const leaveInterior = this.ow.leaveInterior.bind(this.ow);
    this.ow.leaveInterior = () => { leaveInterior(); this._onDoorstep = true; };
    this._onDoorstep = false;
    // One copy of every screen-scroll, door, lurch and item fanfare. See
    // gameflow.singleSfx: the overworld hands Transitions an onSfx AND
    // sfx.install() sets window.__gwSfx, and transition.js fires both.
    singleSfx(this.ow.tr);
    oneVoiceBox(this.ow.box);

    // ------------------------------------------------------------------
    // HOW MANY THINGS ARE ON THE ISLE. See gameflow.reinforce.
    //
    // The chapter shipped 11 enemies across 9 outdoor screens and four of
    // those screens in a row had none — which is the one thing that gives the
    // blind test away, because the art passes for 1993 and the walking does
    // not. Population is PACING, not geometry, so it is composed here: the
    // screen spawns its own list first and this tops it up to the quota, on
    // cells taken off the screen's live collision grid.
    //
    // It is hung on `world.enter` rather than on a per-frame check because
    // `scrollTo` snapshots the incoming screen for the scroll IMMEDIATELY
    // after entering it — anything placed a frame later pops into existence in
    // front of the player once the scroll has landed.
    // ------------------------------------------------------------------
    const world = this.ow.world;
    const enterScreen = world.enter.bind(world);
    world.enter = (id, eng) => {
      const s = enterScreen(id, eng);
      // STAND CLEAR OF THE PEOPLE YOU TALK TO. See gameflow.standClear: a
      // villager's footprint started at her boots, so walking DOWN into one
      // parked Wren fourteen pixels inside her and the y-sort then drew her
      // over his whole body — on the Cogblade handover, the beat the chapter
      // is named for. Run on ENTER, after the screen has populated itself and
      // while Wren is still at the edge of the board, so nobody is ever
      // standing where the footprint is about to grow.
      try { standClear(s); } catch (e) { /* never fatal */ }
      try { reinforce(s, { world, quest, player: this.ow.player }); } catch (e) { /* never fatal */ }
      return s;
    };
    // init() already entered the opening screen, before the wrap existed.
    try { standClear(this.ow.world.screen); } catch (e) { /* never fatal */ }
    try {
      reinforce(this.ow.world.screen, { world, quest, player: this.ow.player });
    } catch (e) { /* never fatal */ }

    // A kill is worth a purse, not a coin — see gameflow.Bounty. Without it
    // Hesper's 100-cog charm, and the death rule that spends it, are unreachable.
    this.bounty = new Bounty(4);
    this._popGate = quest.has('hasCogblade');
    return this.ow;
  }

  async makeDungeon(room, give) {
    this.dgEngine = this.subEngine({ room: room || 'B1', give: give || null, beat: null });
    this.dg = new DungeonScene({
      startRoom: room || 'B1',
      onFinish: () => { this.finished = true; },
      // THE HATCH GOES BOTH WAYS.
      //
      // dungeon.js has documented `onExit` since the day it was written and
      // this call site never passed it — measured, `dg.opts.onExit ===
      // undefined` with `g.ow` alive and well — so _climbOut() fell into its
      // standalone branch, said "The ladder goes up to the hatch. / Marla is
      // waiting at the top." and then shoved Wren back into B1 on 6 of 6
      // attempts. The one line attached to the hatch promised the exact thing
      // the hatch refused, and it orphaned the cog economy with it: a run
      // reaches the Boilerworks mouth with ~100 cogs in its purse and
      // Hesper's 100-cog SECOND WIND charm was permanently behind a door
      // that only opened downwards.
      onExit: () => this.ascend(),
    });

    // ONE TRANSPORT FOR THE CHAPTER, AND IT HAS TO BE SAID BEFORE init() RUNS.
    //
    // The Boilerworks owns a DungeonMusic of its own, and the chapter's score
    // (gameflow.ChapterMusic) already plays the hall theme — so the dungeon's
    // copy is switched off. It used to be switched off AFTER
    // `await this.dg.init(...)`, which is one await too late: init() builds
    // the transport AND calls `_roomMusic` on the starting room, so
    // DungeonMusic.play() had already opened a second AudioContext and
    // committed a two-loop schedule, and nothing ever topped it up OR stopped
    // it because the flag went false a moment later. Measured on a real
    // title-to-dungeon run: 83.5 seconds of a second, unsynchronised copy of
    // the hall theme playing under the first, 4.1 dB LOUDER than it, on its
    // own clock at an arbitrary phase offset.
    //
    // The transport does not exist yet to be switched off — `this.music` is
    // assigned inside init(), a few lines above the `_roomMusic` that starts
    // it — so the assignment itself is what gets intercepted. Same idiom as
    // the drawUI / getRoom / mapUI.draw wraps below: the scene keeps ownership
    // of the object, this file only composes what happens to it.
    //
    // joinSharedGraph is the belt to those braces (see gameflow.js): if this
    // transport is ever switched back on, it adopts the context somebody has
    // already published instead of opening one, whichever subsystem was first.
    let dgMusic = null;
    Object.defineProperty(this.dg, 'music', {
      configurable: true,
      get() { return dgMusic; },
      set(m) {
        dgMusic = m;
        if (!m) return;
        m.enabled = false;
        joinSharedGraph(m);
      },
    });

    await this.dg.init(this.dgEngine);
    this.dg.hud = this.hud;
    singleSfx(this.dg.tr);
    oneVoiceBox(this.dg.dialog);

    // The Boilerworks' thin rooms — B2, B5, B6, B7 (see gameflow.DG_EXTRA).
    // Hung on getRoom's cache miss so it happens ONCE, at construction: a room
    // the player has already cleared must stay cleared, and no arena's win
    // condition may change under it.
    const getRoom = this.dg.getRoom.bind(this.dg);
    this.dg.getRoom = (id) => {
      const fresh = !this.dg.roomCache[id];
      const room = getRoom(id);
      if (fresh) { try { reinforceRoom(room); } catch (e) { /* never fatal */ } }
      return room;
    };
    // init() built the starting room before the wrap existed.
    if (this.dg.cur) { try { reinforceRoom(this.dg.cur); } catch (e) { /* never fatal */ } }

    // ------------------------------------------------------------------
    // THE ENDING IS A SEQUENCE, NOT A TEXT BOX.
    //
    // scenes/dungeon.js reaches the beat correctly — pick up the shard, set
    // `ending`, freeze the room — and then delivers the payoff of the whole
    // chapter as four player-advanced pages in the villager window, followed by
    // a fifth that reads TO BE CONTINUED and never goes away. The world is
    // frozen underneath but nothing SAYS so: the last frame of Chapter 1 is a
    // live-looking gameplay screen with a message box on it and no exit.
    //
    // The staging is the composition's job, so it is done here. `_updEnding` is
    // retired to a no-op on the INSTANCE (dungeon.js belongs to another piece
    // this round and is not edited) and gameflow.Ending drives the beat from
    // GameScene.update instead — which is also the only place with a clock that
    // DungeonScene.update's half-dozen early returns cannot stall.
    // ------------------------------------------------------------------
    this.dg._updEnding = () => { };
    this.dg._drawEndCard = () => { };
    this.endSeq = new Ending({
      dg: this.dg,
      box: this.cardBox,
      sky: this.sky,
      quest,
      sfx: (n) => { try { sfx.play(n); } catch (e) { /* headless */ } },
      fast: !!this.bot,
      onFinish: () => { this.finished = true; },
      onTitle: () => this.returnToTitle(),
    });

    // THE LAST SHOT. The boiler-hall skylight is redrawn with a real airship in
    // it (see gameflow.drawSkylightOver) and the ending drives its light and
    // the ship's crossing. Wrapping drawUI rather than drawing after dg.draw()
    // keeps all of it inside the scene's own frame buffer, so it shakes with
    // the hall's lurches and dims with its fades instead of floating still on
    // top of a moving picture.
    const dgUI = this.dg.drawUI.bind(this.dg);
    this.dg.drawUI = (c) => {
      if (this.dg.ending > 0 && this.dg.cur && this.dg.cur.def.skylight) {
        drawSkylightOver(c, this.dg.ending, this.engine.frame, DPAL,
          this.endSeq ? this.endSeq.skylight() : undefined);
      }
      dgUI(c);
      // The ending goes on LAST — over the boss gauge and the debug line,
      // because a row of orange pips down the edge of the chapter card is the
      // same "nobody owns the composition" defect one layer up.
      if (this.endSeq) this.endSeq.draw(c);
      if (this.death) this.drawGameOver(c);
    };

    // ONE DEATH SCREEN FOR THE CHAPTER. dungeon.js hands the moment over
    // (scenes/dungeon.js `_down`), this file runs the same set piece it runs
    // above ground, and the continue happens when the player answers it.
    this.dg.onDown = (info) => this.beginDeath('dungeon', info);

    // ONE SUBSCREEN. START used to open two different screens: the kit above
    // ground and the floor plan below, so a player in the Boilerworks could
    // not check his cogs, his heart pieces or his life, and a player above
    // ground had no map at all. ALttP's subscreen carries both, so the
    // dungeon's map screen is REPLACED by the same Subscreen object the
    // overworld uses, handed the floor plan as data.
    //
    // The dungeon keeps ownership of the button (scenes/dungeon.js toggles
    // `mapUI.open` and freezes the room behind it, which is correct and is not
    // reimplemented here); all that is taken over is what gets painted. The
    // blink phases ride mapUI's own counter so the cursor, the YOU ARE HERE
    // pip and the footer keep their cadence.
    this.dg.mapUI.draw = (c) => {
      if (!this.dg.mapUI.open) return;
      this.sub.t = this.dg.mapUI.t;
      this.sub.render(c, quest, this.floorPlan());
    };

    // ?bot=play only: supervise the dungeon's own autopilot so a scripted run
    // of the chapter cannot stop dead in B1. See DungeonNudge for why.
    if (this.bot && typeof this.dg._autoplay === 'function') {
      this.nudge = new DungeonNudge(quest);
      const auto = this.dg._autoplay.bind(this.dg);
      this.dg._autoplay = (eng) => {
        if (this.nudge.wants(this.dg)) this.nudge.drive(this.dg, eng);
        else auto(eng);
      };
    }
    return this.dg;
  }

  /** ?beat=ending — the boss is already burst and the shard is on the floor. */
  forceEnding() {
    const d = this.dg;
    if (!d) return;
    d.boss = null;
    d.cur.cleared = true;
    // The hall says "The doors slam. Rule 4 ... NEVER COOL AN OPEN VALVE." on
    // entry, and this warp arrives one frame later with the boss already burst.
    // Drop it: the room is not sealing, nothing is winding itself up, and a
    // capture of the ending should open on the ending.
    if (d.dialog) d.dialog.close();
    d.shard = new Pickup('shard', 120, 92, d.spr.shard);
    // The container that drops with the boss has already been paid out in
    // this warp's flags; do not pay it twice.
    this._bossReward = true;
  }

  // ------------------------------------------------------------------ flow

  startChapter() {
    if (this.flow.phase !== PHASE.FRONT) return;
    // A second run cannot begin until the rebuild behind the title has landed.
    // It is DEFERRED, never dropped: FrontEnd fires onStart exactly once and
    // then sits in state 'done', so a start that is refused is a black screen
    // for good. See the drain at the top of update().
    if (this._booting || !this.ow || !this.ow.world) { this._wantStart = true; return; }
    // FrontEnd has already faded itself to black, so the chapter opens on the
    // way UP out of that black rather than fading out a second time.
    this.flow.set(PHASE.OVERWORLD);
    this.flow.curtain.start({ out: 0, hold: 0, into: 24 });
  }

  /** The Boilerworks mouth. Wren walks into the arch and the lights go down. */
  descend() {
    if (this.flow.curtain.busy || this.flow.phase !== PHASE.OVERWORLD) return;
    this.descending = 12;
    // `!this.dg` as well as `!this.dgPending`: a run warped straight to
    // `beat=dungeon-b1` builds the Boilerworks in init() and never touches
    // dgPending, so once the hatch worked in both directions this guard let
    // the SECOND descent rebuild the whole dungeon from scratch — cleared
    // arenas, opened cages and broken canisters all back. Measured with
    // tools/critic/bd-hatch.js: canisters left went 3 -> 4 across a round
    // trip. The Boilerworks is built once per chapter.
    if (!this.dgPending && !this.dg) this.dgPending = this.makeDungeon('B1');
    this.flow.go(PHASE.DUNGEON, { out: 30, hold: 12, into: 26 });
  }

  /**
   * UP THE LADDER, out of the Boilerworks and back onto the isle.
   *
   * The mirror of descend(), and deliberately not a rebuild of anything: the
   * DungeonScene object, its room cache (cleared arenas, opened cages, broken
   * canisters) and everything in `quest` (keys, the big key, the map, the
   * Cuff, hearts, cogs) survive untouched, so the state the player walks out
   * with is the state he walks back in with.
   *
   * dungeon.js gets here from inside its OWN fade — _climbOut() calls onExit
   * at full black — so the chapter curtain opens with `out: 0` and only has
   * to come back up. The dungeon's half-played fade is retired in _surface(),
   * on the swap, or it would sit frozen over B1 waiting for a scene that is
   * no longer being updated to finish it.
   */
  ascend() {
    if (this.flow.phase !== PHASE.DUNGEON) return;
    this._surfacing = true;
    if (!this.flow.go(PHASE.OVERWORLD, { out: 0, hold: 10, into: 26 })) {
      // The curtain was somehow already busy. Land him anyway — a hatch that
      // silently does nothing is the bug this whole change is here to fix.
      this.flow.set(PHASE.OVERWORLD);
      this._surface();
    }
  }

  /**
   * Put Wren on the isle, at the foot of the Boilerworks arch.
   *
   * The position is DERIVED from the portal rect the overworld already
   * authors (`screen.portal`, maps-overworld.js) rather than hardcoded, so
   * the two directions can never drift apart: he comes out centred under the
   * arch and one clear tile below its trigger box, which is also exactly far
   * enough that the first frame back does not read as him walking into it
   * again. `world.settle` then does the same job it does for every door in
   * the chapter and pushes him off anything solid he landed on.
   */
  _surface() {
    this._surfacing = false;
    this._surfaced = true;      // the next descend() is a RE-entry, not a build
    const ow = this.ow;
    if (!ow || !ow.world) return;
    if (this.dg && this.dg.tr) this.dg.tr._fx = null;
    if (ow.world.screen.id !== MOUTH_SCREEN) {
      ow.world.enter(MOUTH_SCREEN, this.owEngine);
    }
    const p = ow.world.screen.portal;
    const px = p ? p.x + p.w / 2 - 8 : 204;
    const py = p ? p.y + p.h + 2 : 128;
    ow.player.x = px;
    ow.player.y = py;
    ow.player.dir = 'down';
    ow.player.moving = false;
    ow.player.kbT = 0;
    ow.player.clearDeath();
    ow.world.settle(ow.player);
    ow.lockDoors();
    ow._onPortal = false;
    if (ow.tr) ow.tr._fx = null;
    this.death = null;
    this.syncHud();
  }

  onPhase(next) {
    if (next === PHASE.OVERWORLD && this._surfacing) this._surface();
    if (next === PHASE.DUNGEON) {
      this.descending = 0;
      // Coming back DOWN a hatch the player has already used. The Boilerworks
      // is still the same object with the same room cache; it only needs Wren
      // put back at the foot of B1's ladder. See dungeon.reenterFromHatch.
      if (this._surfaced && this.dg) {
        this._surfaced = false;
        this.dg.reenterFromHatch();
      }
      // The isle keeps falling underground: the sky is already at stage 4 by
      // the time the gear-gate has turned (see _pushSky), and the interior
      // takes the stage at reduced strength (skystate.INDOOR), so the hall
      // cools without going black. Nothing to do but drop the overworld's
      // death card if one was somehow still up.
      this.death = null;
      if (this.ow && this.ow.player) this.ow.player.clearDeath();
    }
  }

  // ---------------------------------------------------------------- update

  update(dt, engine) {
    const input = engine.input;

    // Browsers need a gesture before an AudioContext may make a sound.
    if (!this.kicked && (input.hit('a') || input.hit('b') || input.hit('start')
      || input.hit('up') || input.hit('down') || input.hit('left') || input.hit('right'))) {
      this.kicked = true;
      try { sfx.unlock(); } catch (e) { /* headless capture */ }
      this.flow.music.resume();
    }

    // A start that arrived while the chapter was being rebuilt behind the
    // title screen. See startChapter().
    if (this._wantStart && !this._booting && this.ow && this.ow.world) {
      this._wantStart = false;
      this.startChapter();
    }

    this.flow.update();
    // The isle keeps falling while Wren is underground: `quest.beat` pushes
    // the sky forward from inside the Boilerworks (the boiler-hall door is a
    // stage-4 beat), and only the overworld half ticks the SkyState. Tick it
    // here for every phase it does not own, or the light the chapter comes
    // back up into is the light it went down in.
    if (this.flow.phase !== PHASE.OVERWORLD) this.sky.update();
    this.syncMusic();

    // The curtain owns the frame. The one thing that keeps moving under it is
    // Wren walking into the Boilerworks arch — a door transition where the
    // hero stands still outside the door reads as a cut, not as going in.
    if (this.flow.curtain.busy) {
      if (this.descending > 0 && this.ow) {
        this.descending--;
        const p = this.ow.player;
        p.dir = 'up'; p.moving = true; p.y -= 1.5; p.animDist += 1.5;
      }
      return;
    }

    switch (this.flow.phase) {
      case PHASE.FRONT:
        if (this.bot) this.botFront(engine);
        this.front.update(dt, engine);
        break;

      case PHASE.OVERWORLD:
        if (this.death) { this.updateDeath(dt, input); break; }
        // START opens the subscreen and the subscreen owns the frame — the
        // world holds still under it exactly as it does in the Boilerworks.
        if (this.sub.open) { this.sub.update(input); break; }
        if (input.hit('start') && !this.ow.box.active && !this.ow.tr.busy) {
          this.sub.toggle();
          try { sfx.play('select'); } catch (e) { /* headless */ }
          break;
        }
        if (this.bot) this.owBot.run(this.ow, engine);
        this._gateColdOpen(input);
        this.ow.update(dt, this.owEngine);
        // Off the doorstep: the door works again (see makeOverworld).
        if (this._onDoorstep && !this.ow.tr.busy
          && !this.ow.world.doorUnder(this.ow.player)) this._onDoorstep = false;
        this._guardPose(this.ow.tr, this.ow.box);
        // A kill pays a purse. Runs after the world so it sees the same frame's
        // deaths, and before checkDeath so a last-gasp kill still pays out.
        if (this.bounty) this.bounty.tick(this.ow.world);
        this._repopulate();
        this._drainItems();
        this._pushSky();
        this._screenScene();
        this.checkDeath();
        break;

      case PHASE.DUNGEON: {
        if (!this.dg) break;
        if (this.death) { this.updateDeath(dt, input); break; }
        // THE CHAPTER TAKES THE CONTROLLER OFF YOU. From the frame the shard
        // goes in, nothing the player presses may move Wren, swing the blade,
        // open the subscreen or turn a page — the one press the ending answers
        // is read here and handed to the sequence, and the rest of the input is
        // emptied before the Boilerworks ever sees it. The dungeon's own
        // autopilot is switched off for the same reason: a scripted run must
        // watch the ending, not play through it.
        //
        // The press has to be READ before the clear, or the sequence never
        // hears it — and what it is allowed to do on the other side is the
        // whole subject of gameflow.Ending's header: complete the typewriter,
        // and shorten the beat to its floor. It cannot skip a beat, move a
        // clock, or cost the player the ending.
        const ending = this.endSeq && this.endSeq.running;
        const wantsA = ending
          && (input.hit('a') || input.hit('start') || input.hit('b'));
        if (ending) { input.down.clear(); input.pressed.clear(); }
        this.dg.update(dt, this.dgEngine);
        if (ending) { this.endSeq.step(wantsA); break; }
        // Both halves poll for an empty row, on the same frame boundary. See
        // _dungeonDown(): the Boilerworks' own check lives on one line inside
        // its contact-damage loop, so anything that emptied the row by another
        // route used to leave Wren standing on zero hearts with no death at
        // all — the animation genuinely never ran.
        this.checkDeath();
        this._guardPose(this.dg.tr, this.dg.dialog);
        this._bossDrop();
        this._pumpDeathMsg();
        // The shard is in. dungeon.js has set `ending` and frozen the room;
        // everything after this frame is staged (see gameflow.Ending and
        // makeDungeon). It is started HERE rather than in draw() because
        // engine.stepFrames(n) updates n times and draws once, and a set piece
        // that begins in a draw call is photographed by a batched capture at
        // t=0 with nothing ticked.
        if (this.dg.ending > 0 && this.endSeq && !this.endSeq.running) {
          this.dg.bot = null;
          if (this.dg.dialog && this.dg.dialog.node) this.dg.dialog.close();
          this.endSeq.start();
        }
        break;
      }

      default:
        break;
    }

    this.syncHud();
  }

  /**
   * THE ITEM-GET GUARD — the chapter's defining beat, and the bug that broke it.
   *
   * `Transitions.getItem()` sets `posing`, which makes `tr.frozen` true, and
   * both half-scenes return out of update() while frozen. A DialogBox that is
   * still open at that moment therefore stops being ticked while it carries on
   * being DRAWN, and its five-frame close wipe freezes: an empty black sliver
   * sits across the middle of the screen for the entire presentation of the
   * Cogblade. src/game/world/overworld.js already queues item-gets behind the
   * conversation for the normal path (`queueItem` / `pumpItems`); this closes
   * the remaining race for both halves and for anything a future beat adds —
   * a page still up is shut, and a wipe already running is ticked to
   * completion under the pose instead of being left standing.
   */
  _guardPose(tr, box) {
    if (!tr || !box || !tr.posing) return;
    if (box.node) box.close();
    if (box.closing > 0) box.closing--;
  }

  /** Belt and braces: never leave an announcement sitting in the queue. */
  _drainItems() {
    const w = this.ow.world;
    if (!w.itemQueue.length) return;
    if (this.ow.box.active || this.ow.tr.busy) return;
    this.ow.pumpItems();
  }

  /**
   * THE FALL, WHERE IT CAN BE SEEN. quest.js only reaches sky stage 3 when
   * Wren goes DOWN the Boilerworks mouth and stage 4 behind a sealed hall
   * door, so a played chapter topped out at stage 2 and the two stages that
   * sell the cloud deck were never once on screen. Pulled forward to the two
   * outdoor moments that earn them; see gameflow.SKY_ON_SCREEN. Quest.beat
   * only ever raises the stage, so the later beats become no-ops rather than
   * winding the sky back.
   */
  _pushSky() {
    if (this.ow.tr.busy || this.ow.box.active) return;
    const id = this.ow.world.screen.id;
    const on = SKY_ON_SCREEN[id];
    if (!on || this.skyDone.has(id) || quest.get('skyStage') >= on.stage) return;
    this.skyDone.add(id);
    quest.setSky(on.stage);
    quest.lurch(on.lurch);
  }

  /**
   * THE COLD OPEN IS NOT OPTIONAL ANY MORE.
   *
   * `dockLurch` — the horizon tilt, the shake, Pell's "That's not weather.",
   * and sky stage 1 with them — hung entirely on choosing to walk into Pell
   * and press A. Nothing gated the dock's north edge, so a player could be on
   * the harbour road twenty seconds into Chapter 1 having seen none of it, and
   * the chapter then ran 0 -> 2 -> 3 -> 4 with a fifth of the sky work unused.
   *
   * A soft gate, not a wall: Wren gets as far as the top of the quay ramp and
   * Pell shouts him back down. It costs one conversation, it is over the moment
   * he has been heard, and it is the only place in the chapter that does this.
   */
  _gateColdOpen(input) {
    if (this._pellNag > 0) this._pellNag--;
    if (quest.has('talkedToPell')) return;
    const s = this.ow.world.screen;
    if (!s || s.id !== 'dock') return;
    const p = this.ow.player;
    if (p.y > COLD_OPEN_FENCE) return;
    p.y = COLD_OPEN_FENCE;                    // the road out is shut, gently
    input.down.delete('up'); input.pressed.delete('up');
    if (this.ow.box.active || this.ow.tr.busy || this._pellNag > 0) return;
    this._pellNag = 260;
    p.dir = 'down';
    this.ow.box.say('Pell, from the quay:\n"Oi - courier! Not yet.\nYou want to hear this first."');
  }

  /**
   * THE HOLLOW STOPS BEING SAFE.
   *
   * Cogwick Hollow's quota is gated on the Cogblade (gameflow.OW_QUOTA): the
   * village is a hub on the way in and a different place on the way out. But
   * the blade is handed over IN villagee, which the player has already entered
   * — so a quota that is only read on arrival would never once be true there,
   * and both village screens would measure empty in a linear run. So the
   * moment the gate flips, the screen the player is standing on is topped up:
   * Marla puts a blade in his hands and the first thing he needs it for is in
   * the lane outside. Once, on the first calm frame after the item pose, which
   * is also when the presentation stops covering the screen.
   */
  _repopulate() {
    const blade = quest.has('hasCogblade');
    if (blade === this._popGate || this.ow.tr.busy) return;
    this._popGate = blade;
    try {
      reinforce(this.ow.world.screen, {
        world: this.ow.world, quest, player: this.ow.player,
      });
    } catch (e) { /* never fatal */ }
  }

  /**
   * THE THIN STRETCH GETS ITS BEATS. terrace -> scrapfield -> cliffnook was
   * three screens carrying one bush-maze idea; each now has a moment on
   * arrival (gameflow.SCREEN_SCENES) — the mill turning backwards, Vane's mark
   * on a wrecked skiff, the empty cradle seen from under the rim. Once each,
   * when nothing else owns the frame.
   */
  _screenScene() {
    if (this.ow.tr.busy || this.ow.box.active || this.sub.open) return;
    const id = this.ow.world.screen.id;
    const sc = SCREEN_SCENES[id];
    if (!sc || this.sceneDone.has(id)) return;
    this.sceneDone.add(id);
    if (sc.lurch) quest.lurch(sc.lurch);
    this.ow.box.say(sc.lines);
  }

  /**
   * STORY.md: "4 = a container, so the player ends the chapter at 4 hearts
   * after the boss's drop". The dungeon spawns the shard when KETTLEBACK
   * bursts but never awards the container, so it is awarded here, on the same
   * frame, which is also when the hall goes quiet and it can be read.
   */
  _bossDrop() {
    if (this._bossReward || !this.dg || !this.dg.shard) return;
    this._bossReward = true;
    quest.addHeartContainer();
    try { sfx.play('heart'); } catch (e) { /* headless */ }
  }

  /**
   * DEATH ABOVE GROUND. scenes/dungeon.js has a game over and a continue;
   * scenes/overworld.js has none at all — run out of hearts on the works road
   * and the game simply carries on at zero. Owned here, in the same shape the
   * dungeon uses: a card, then a continue at this screen's spawn with full
   * hearts. Hesper's SECOND WIND charm is what spends itself first, which is
   * the only thing in the chapter that makes the 100-cog purchase real.
   */
  checkDeath() {
    if (this.death) return;
    if (quest.get('halves') > 0) return;
    // The charm is checked BEFORE the phase split. It used to sit below the
    // dungeon branch, so both below-ground death routes returned past it and
    // the one 100-cog purchase in the chapter did nothing in the seven rooms
    // where you actually die. Whichever half we are in owns the presentation;
    // the charm itself does not care.
    const inDungeon = this.flow.phase === PHASE.DUNGEON;
    if (quest.has('hasSecondWind') && (inDungeon ? !!this.dg : !!(this.ow && !this.ow.tr.busy))) {
      quest.set('hasSecondWind', false);
      quest.heal(quest.maxHalves);
      const scene = inDungeon ? this.dg : this.ow;
      if (scene.player) scene.player.invulnT = 90;
      try { sfx.play('secret'); } catch (e) { /* headless */ }
      scene.say
        ? scene.say('The SECOND WIND charm cracks\nin half and gives it back.\nHesper does not do refunds.')
        : scene.box.say('The SECOND WIND charm cracks\nin half and gives it back.\nHesper does not do refunds.');
      return;
    }

    if (inDungeon) { this._dungeonDown(); return; }
    if (!this.ow || this.ow.tr.busy) return;

    const p = this.ow.player;
    p.lock = true; p.moving = false; p.invulnT = 9999; p.kbT = 0;
    p.attackPose = false; p.attackIndex = 0;
    if (this.ow.box.node) this.ow.box.close();
    this.beginDeath('overworld');
  }

  /**
   * THE SAME RULE BELOW GROUND — and the reason the death set piece could be
   * skipped entirely in half the chapter.
   *
   * The Boilerworks only ever notices an empty row from inside
   * `_contactDamage()`: `_down()` is called on the line that took the last
   * half-heart and nowhere else. Anything that empties the row by another
   * route — a scripted hit, a hazard that spends hearts without going through
   * `hurt()`, a beat that costs life — left `halves` at 0 with the world still
   * running. MEASURED, before this existed: a dungeon run whose row was emptied
   * outside `hurt()` read `sprites.death` ZERO times over 110 frames and
   * `sprites.<dir>.idle` 112 times — Wren stood at attention on an empty LIFE
   * row, forever, with no card. The overworld half has always polled for this
   * (see checkDeath above); this is the same poll for the other half.
   *
   * It freezes the room the way dungeon.js's own `_down()` does — `deathHold`
   * and `onDown` are documented there as the composition's hooks — and then
   * hands the moment to the one death screen, so both halves reach the same
   * spin, the same landing and the same letterbox.
   */
  _dungeonDown() {
    const dg = this.dg;
    if (!dg || !dg.player || dg.deathHold || dg.ending > 0 || dg.tr.busy) return;
    dg.deathHold = true;
    dg.deathT = 0;
    dg.gameOverT = 0;                       // the composition's card, not ours
    dg.deaths = (dg.deaths || 0) + 1;
    dg._deaths = dg.deaths;
    if (dg.music) dg.music.play(null);
    const p = dg.player;
    p.lock = true; p.moving = false; p.invulnT = 9999; p.kbT = 0;
    p.attackPose = false; p.attackIndex = 0;
    this.beginDeath('dungeon', {
      room: dg.curId,
      arena: (dg.cur && dg.cur.def && dg.cur.def.arena) || null,
      bossPhase: (dg.boss && !dg.boss.dead) ? dg.boss.phase : 0,
      deaths: dg.deaths,
    });
  }

  /**
   * THE ONE DEATH SCREEN. Above ground this file already drew a proper ALttP
   * card; the Boilerworks drew its own, and its own never rendered — the timer
   * it reads was set once and decremented by nobody, so for the whole second
   * half of the chapter dying was a fade to black with no word on it. Both
   * halves come through here now.
   *
   * @param {'overworld'|'dungeon'} where
   * @param {object} [info] from dungeon.js: { room, arena, bossPhase, deaths }
   */
  beginDeath(where, info) {
    if (this.death) return;
    this.deaths++;
    // The music cuts on the frame the hearts run out — ALttP's death is
    // silence first, then the card.
    this.flow.music.play(null);
    try { sfx.play('death'); } catch (e) { /* headless */ }
    // WHAT THE FAILURE MEANS, in words. KETTLEBACK is deliberately forgiving —
    // a continue puts it back at the top of the phase you had reached rather
    // than at full health — but "forgiving" and "unsignalled" are different
    // things, and standing still in the arena used to read as a random fade
    // to black followed by a boss that was somehow whole again.
    let note = null;
    if (info && info.arena === 'boss') {
      note = `KETTLEBACK RECOVERS  -  ATTEMPT ${Math.min(99, this.deaths + 1)}`;
      this._deathMsg = 'KETTLEBACK hauls itself\nupright. Every dent you put\nin it this round is gone.';
    } else if (where === 'dungeon') {
      note = `THE BOILERWORKS  -  ${(info && info.room) || ''}`;
    }
    // HAND THE BODY OVER. The set piece in player-sprites.js — Wren spins,
    // his knees go, he pitches over and lands flat — exists for exactly this
    // moment and nothing used to start it, so the chapter's last image was the
    // hero standing at attention while the letterbox closed over him. The
    // player object owns the animation (Player.startDeath/draw); this file
    // owns the clock (updateDeath) and holds its card back until the fall has
    // landed (drawGameOver).
    const p = where === 'dungeon' ? (this.dg && this.dg.player) : this.ow.player;
    if (p) p.startDeath();
    // WHERE THE CARD WILL CLOSE — see _deathFocusY. Recorded here as the
    // fallback for the frames after the body has been cleared.
    this.death = {
      t: 0, done: false, where, note,
      focusY: p ? Math.round(p.y) + DEATH_REST_CY : Math.round(HEIGHT / 2),
    };
  }

  /**
   * The row the letterbox is aimed at: the middle of the fallen body.
   *
   * Read LIVE rather than pinned at beginDeath, because the body does not
   * always stay where it fell. MEASURED on the Windrope, where the bridge wind
   * keeps pushing: over the 40 frames the bars take to travel, the landed
   * sprite drifts from y 90-102 to y 108-119 — eighteen pixels, most of its
   * own height. An aperture pinned at the spot he died closed a third of the
   * way off him by the end, which is the same defect as centring on the screen
   * only smaller. The drift is 0.45 px/frame, so following it reads as the
   * frame holding on him, not as a moving letterbox.
   *
   * DEATH_REST_CY is the resting body's own vertical centre inside the 16x24
   * box, measured in player-sprites.js from where SETTLE is composed, so this
   * lands on his ribs and not on his feet. Falls back to the middle of the
   * screen if there is somehow no body — a card with no aperture centre is
   * still a card, and the old behaviour is the safe default.
   */
  _deathFocusY() {
    const d = this.death;
    if (!d) return Math.round(HEIGHT / 2);
    const p = d.where === 'dungeon' ? (this.dg && this.dg.player)
      : (this.ow && this.ow.player);
    if (p && p.dying) return Math.round(p.y) + DEATH_REST_CY;
    return d.focusY || Math.round(HEIGHT / 2);
  }

  /**
   * The two bar heights for a given close amount — top first, bottom second.
   * One function so `state()` reports exactly what `drawGameOver()` fills.
   * @param {number} [bars] px of travel per bar; defaults to this frame's
   * @returns {[number, number]}
   */
  _deathBars(bars) {
    if (bars === undefined) {
      const t = (this.death ? this.death.t : 0) - DEATH_CARD_DELAY;
      bars = t < 0 ? 0 : Math.round(Math.min(1, t / 44) * 112);
    }
    const band = HEIGHT - 2 * bars;
    if (band <= 0) {
      // Past the point where the aperture has any height, the screen is black
      // whatever it was centred on; split at the focus so the LAST pixel to go
      // is the body.
      const c = Math.max(0, Math.min(HEIGHT, this._deathFocusY()));
      return [Math.round(c), HEIGHT - Math.round(c)];
    }
    const half = band / 2;
    const c = Math.max(half, Math.min(HEIGHT - half, this._deathFocusY()));
    return [Math.round(c - half), HEIGHT - Math.round(c + half)];
  }

  /**
   * DEATH ABOVE GROUND — the only screen a player sees when they fail, and it
   * was nine characters of body text on black with no prompt and no fanfare.
   *
   * Now: Wren stops dead, the score cuts, the frame closes from the top and
   * the bottom, the word lands at double size with a keyline, and the run
   * waits on the player. A can be pressed as soon as the card is legible; if
   * nobody is at the keyboard it continues itself after eight seconds, so a
   * scripted run cannot deadlock here either.
   */
  updateDeath(dt, input) {
    const d = this.death;
    const wants = input.hit('a') || input.hit('start') || input.hit('b');
    // Nothing the player presses may move Wren while the card is up.
    input.down.clear(); input.pressed.clear();
    // The half that is dying keeps ticking so its fade, its dust and its fx
    // carry on under the card — but with an empty input, so neither half can
    // act on the press that dismissed it.
    if (d.where === 'dungeon') this.dg.update(dt, this.dgEngine);
    else this.ow.update(dt, this.owEngine);
    if (d.done) {
      // Clear once the continue's own fade has taken the screen.
      const tr = d.where === 'dungeon' ? this.dg.tr : this.ow.tr;
      if (!tr.busy && ++d.clear > 8) this.death = null;
      return;
    }
    d.t++;
    // The fall is on ITS OWN clock, not the world's: the Boilerworks freezes
    // its whole room while the card is up (dungeon.js returns early on
    // deathHold), so the animation has to be stepped from here or Wren never
    // moves. Above ground the world does keep ticking, but Player.update()
    // deliberately does not advance deathT either — one owner, one clock.
    const dead = d.where === 'dungeon' ? (this.dg && this.dg.player) : this.ow.player;
    if (dead) {
      // THE ONE ASSERTION THAT KEEPS THIS PIECE ALIVE. This project's standing
      // failure is a module that passes review and is then never called, and
      // this set piece has been the example twice: the frames were authored,
      // the composition had a card, and what the letterbox closed over was the
      // idle pose. If the card is up, the body IS playing the death — whoever
      // else does or does not start it, whichever half we are in, and however
      // the row got to zero. `startDeath()` is idempotent, so this costs one
      // comparison a frame and can never double-trigger.
      if (!dead.dying) dead.startDeath();
      dead.tickDeath();
      this.deathFrames++;
    }
    // He hits the ground on DEATH_IMPACT. The sound used to be at t=54, which
    // was ten frames after the screen had already gone fully black.
    if (d.t === DEATH_IMPACT) { try { sfx.play('fall'); } catch (e) { /* headless */ } }
    // A scripted run has no hands: it must not deadlock here, and it must not
    // sit on the card for eight seconds either. Both windows are measured from
    // the moment the card starts, not from the moment he dies.
    const patience = (this.bot ? 150 : 480) + DEATH_CARD_DELAY;
    if (d.t > 96 + DEATH_CARD_DELAY && (wants || d.t > patience)) {
      d.done = true; d.clear = 0;
      this.respawn();
    }
  }

  /**
   * Continue. Above ground: fade, Wren back at this screen's spawn with a full
   * row. Below: the Boilerworks' own continue, which puts him at the door he
   * came in by and the boss back at the top of its phase — held until now so
   * the card could stay up as long as the player wanted.
   */
  respawn() {
    if (this.death && this.death.where === 'dungeon') {
      this.dg.continueRun();
      if (this.dg.player) this.dg.player.clearDeath();
      this.syncHud();
      this.hud.snap();
      return;
    }
    const p = this.ow.player;
    this.ow.tr.fade({
      out: 16,
      hold: 8,
      into: 16,
      onSwap: () => {
        quest.flags.halves = quest.maxHalves;
        const s = this.ow.world.screen.def.spawn || { x: 120, y: 150, dir: 'down' };
        p.x = s.x; p.y = s.y; p.dir = s.dir || 'down';
        p.clearDeath();
        p.invulnT = 90; p.kbT = 0; p.lock = false;
        p.attackPose = false; p.attackIndex = 0;
        this.ow.world.settle(p);
        this.syncHud();
        this.hud.snap();
      },
    });
  }

  /**
   * The line that makes a boss failure legible, said once the continue's fade
   * has finished rather than under it.
   */
  _pumpDeathMsg() {
    if (!this._deathMsg || !this.dg) return;
    if (this.dg.tr.busy || this.dg.dialog.active || this.dg.deathHold) return;
    const msg = this._deathMsg;
    this._deathMsg = null;
    this.dg.dialog.say(msg);
  }

  // ----------------------------------------------------------------- audio

  syncMusic() {
    const phase = this.flow.phase;
    let kind = null;
    // The score cuts on the frame the hearts run out and stays cut until the
    // continue: ALttP's death is silence first, then the card.
    if (this.death) { this.flow.music.play(null); return; }
    if (phase === PHASE.DUNGEON && this.dg) {
      const arena = this.dg.cur.def.arena;
      // The hall goes QUIET the moment KETTLEBACK bursts — the silence is what
      // makes the shard land — and it stays quiet through the shard and the
      // shudder. The score comes back UNDER THE ISLE RISING and not before:
      // the sequence owns that cue, because it owns the beat (gameflow.Ending,
      // `endingTheme`). It used to stay null to the last frame of the chapter,
      // so the best forty seconds in it played in dead air.
      if (this.endSeq && this.endSeq.running) {
        this.flow.music.play(this.endSeq.music);
        return;
      }
      kind = (this.dg.ending > 0 || (arena === 'boss' && this.dg.cur.cleared)) ? null
        : (arena === 'boss' ? 'boss' : 'dungeon');
    } else if (phase === PHASE.FRONT) {
      kind = 'overworld';
    } else if (this.ow) {
      kind = this.flow.trackFor({ phase, screenId: this.ow.world.screen.id });
    }
    this.flow.music.play(kind);
  }

  // ------------------------------------------------------------------- HUD

  syncHud() {
    const q = quest;
    const h = this.hud;
    h.maxHearts = q.get('maxHearts');
    // THE ROW THE PLAYER DIED ON. The two halves refilled the life row at
    // different moments: above ground `respawn()` does it inside the fade's
    // onSwap, so the card closes over three EMPTY outlines; below ground
    // scenes/dungeon.js `_down()` does it before it hands the moment over, so
    // a FULL row was painted on the very frame Wren died and held for the 44
    // frames the letterbox takes to close over it — the picture said he was
    // fine while the word said GAME OVER.
    //
    // The composition owns the timing, because the composition owns the card:
    // while the card is up and unanswered the row reads what killed him, which
    // is empty, and the refill becomes visible when the continue takes the
    // screen. (dungeon.js belongs to another piece this round; the one-line
    // change there is to move its `quest.flags.halves = quest.maxHalves` out
    // of `_down()` and into `continueRun()`'s onSwap, which is exactly what
    // respawn() does above ground. This holds either way.)
    h.halves = (this.death && !this.death.done) ? 0 : q.get('halves');
    h.cogs = q.get('cogs');
    h.keys = q.get('smallKeys');
    // THE PRESSURE GAUGE HAS A JOB. hud.js's own transcription note says the
    // real ALttP tube is "the DARKEST thing in the strip: a bold black tube
    // with a little colour pooled in the bottom", 12 rows of 32 in the ref,
    // and warns that a bright full fill means the gauge has inverted. Both
    // half-scenes shipped it pinned at 1.0. So: before the Bellows Cuff it
    // reads the ISLE's own boiler pressure, which falls a notch with every
    // sky stage — a dark tube with a small pool that visibly drains as
    // Bellows Isle sinks. After the Cuff it is the Cuff's charge, which the
    // dungeon already drives, so it is left alone.
    if (!q.has('hasBellowsCuff')) {
      h.steam = Math.max(0.06, 0.34 - 0.055 * this.sky.stage);
    }
    h.sprites.item = q.has('hasBellowsCuff') ? this.itemIcons.cuff
      : q.has('hasCogblade') ? this.itemIcons.cogblade
        : this.itemIcons.none;
    h.update(1 / 60);   // ALttP counters WALK to their new value
  }

  /**
   * The whole status strip, drawn once, at the measured origins. This runs
   * inside `Transitions.render`'s `ui` pass in both half-scenes, i.e. after
   * the world and the y-sorted entities and before the text window, and under
   * the same brightness LUT as everything else — which is where ALttP's HUD
   * lives (its own BG layer: it holds still through a screen change and fades
   * with the rest of the frame).
   */
  drawHud(ctx) {
    const h = this.hud;
    h.drawMeter(ctx, HUD_AT.meter[0], HUD_AT.meter[1]);
    h.drawItemBox(ctx, HUD_AT.box[0], HUD_AT.box[1]);
    h.drawCogs(ctx, HUD_AT.cogs[0], HUD_AT.cogs[1]);
    h.drawKeys(ctx, HUD_AT.keys[0], HUD_AT.keys[1]);
    this.drawPieces(ctx, HUD_AT.pieces[0], HUD_AT.pieces[1]);
    h.drawHearts(ctx, HUD_AT.hearts[0], HUD_AT.hearts[1]);
    // Below ground the card is drawn by the dungeon's wrapped drawUI, after
    // the boss gauge — see makeDungeon.
    if (this.death && this.death.where === 'overworld') this.drawGameOver(ctx);
  }

  /**
   * The Boilerworks, as the subscreen needs it: the floor plan the dungeon's
   * own map screen was built with, plus what the player has found. Null until
   * the hatch has been opened — a subscreen shows what you HAVE, and before
   * the descent the plan is a blank slot exactly like the empty item wells.
   */
  floorPlan() {
    const m = this.dg && this.dg.mapUI;
    if (!m) return null;
    return {
      rooms: m.rooms,
      bossId: m.bossId,
      title: m.title,
      current: this.dg.curId,
      visited: this.dg.visited,
      hasMap: quest.has('dgnMap'),
      hasCompass: quest.has('dgnCompass'),
      keys: quest.get('smallKeys'),
      bigKey: quest.has('bigKey'),
    };
  }

  drawPieces(ctx, x, y) {
    const count = String(Math.min(99, quest.get('heartPieces'))).padStart(2, '0');
    const img = this.pieceIcon;
    ctx.drawImage(img, Math.round(x + (count.length * 8) / 2 - img.width / 2), y);
    drawCounter(ctx, count, x, HUD_AT.digitY);
  }

  /**
   * ALttP's death is a SET PIECE, and this was nine characters of body text on
   * black. Now the frame closes in from the top and the bottom over three
   * quarters of a second, the word lands at double size with a black keyline
   * under it, and a prompt blinks until the player answers it.
   *
   * The double size is done by rendering the 6px dialogue face into a small
   * offscreen canvas and blitting it at 2x with smoothing off — the same
   * letterforms, twice the weight, no second font in the chapter.
   */
  drawGameOver(ctx) {
    // THE CARD WAITS FOR THE FALL. The bars used to start closing on the frame
    // the hearts ran out and were fully black by t=44 — measured against the
    // death animation, that buried the landed pose on the very frame it first
    // appeared. Everything below is unchanged and simply runs on a clock that
    // starts once Wren is on his way down (DEATH_CARD_DELAY = 44, four frames
    // before impact), which leaves the landed pose ~30 clear frames while the
    // bars travel.
    const t = this.death.t - DEATH_CARD_DELAY;
    if (t < 0) return;
    const bars = Math.round(Math.min(1, t / 44) * 112);
    // THE APERTURE CLOSES ON WREN, NOT ON THE MIDDLE OF THE SCREEN.
    //
    // Both bars used to travel from the screen edges toward y=112, so the last
    // thing the card showed was whatever happened to be at the centre of the
    // room. MEASURED in the boss arena, where players actually die
    // repeatedly: Wren goes down at y~179 and the landed pose — the frame this
    // whole set piece exists to deliver — was fully clear for 9 of its frames
    // and was entirely inside the black by t=62, with the closing frame
    // showing an empty stretch of arena wall. The same death on the bridge,
    // where he happens to fall near the middle, got 38. The animation was
    // fine; the frame around it was pointed at the wrong place.
    //
    // So the aperture keeps its HEIGHT (the same 112px of travel per bar, the
    // same 44-frame close — nothing about the pacing changes) and moves its
    // CENTRE onto the body. The clamp does the rest for free: while the
    // aperture is still taller than the screen it can only sit at 112, so the
    // card opens exactly as it always did and then slides onto him as it
    // narrows, which reads as the frame finding him rather than as an
    // off-centre letterbox. `focusY` is fixed at beginDeath() so it cannot
    // drift, and clamping to [half, HEIGHT-half] is what keeps both bars on
    // screen at the map edges — a room whose floor runs to the bottom of the
    // frame gets the aperture pinned there rather than hanging off it.
    const [top, bot] = this._deathBars(bars);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, WIDTH, top);
    ctx.fillRect(0, HEIGHT - bot, WIDTH, bot);
    if (t < 52) return;

    const word = this.bigWord('GAME OVER');
    const x = Math.round((WIDTH - word.width) / 2);
    ctx.drawImage(word, x, 88);
    // A rule under the word, the width of it, so the card has a shape rather
    // than being text floating in a void.
    ctx.fillStyle = '#584860';
    ctx.fillRect(x - 6, 88 + word.height + 5, word.width + 12, 1);

    // WHERE you failed, and — at the boss — that the fight is being reset for
    // you rather than being won by attrition.
    if (this.death.note) {
      drawDialogText(ctx, this.death.note,
        Math.round((WIDTH - dialogTextWidth(this.death.note)) / 2), 118, '#a0a8b8');
    }

    if (t > 96 && Math.floor(t / 22) % 2 === 0) {
      const p = 'PRESS  A  TO  CONTINUE';
      drawDialogText(ctx, p, Math.round((WIDTH - dialogTextWidth(p)) / 2), 138, '#c8b8d8');
    }
  }

  /** The dialogue face at 2x, cached per string. Nearest-neighbour only. */
  bigWord(text) {
    this._big = this._big || {};
    if (this._big[text]) return this._big[text];
    const w = Math.ceil(dialogTextWidth(text)) + 2;
    const src = document.createElement('canvas');
    src.width = w; src.height = 10;
    drawDialogText(src.getContext('2d'), text, 1, 1);
    const out = document.createElement('canvas');
    out.width = w * 2; out.height = 20;
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0, w, 10, 0, 0, w * 2, 20);
    this._big[text] = out;
    return out;
  }

  /**
   * WHAT COMES AFTER THE CARD.
   *
   * A 1993 cartridge does not stop. Chapter 1 held its last frame forever with
   * nothing on screen that answered a button, which is the one state a console
   * game may never be in — the player cannot tell a finished chapter from a
   * hung one. So the card blinks PRESS A (gameflow.Ending's `hold` beat) and
   * this is the answer: the curtain takes the screen, the chapter is rebuilt
   * from the top, and the title screen comes back up. Press START again and it
   * is a new game, not the old one with every flag still set.
   *
   * The rebuild happens under the curtain's black, and the front end is what
   * gives it time: makeOverworld() is a few frames of work and the title screen
   * sits for seconds before anybody can start. `_booting` is the interlock —
   * FrontEnd's onStart cannot hand the phase to a half-built overworld.
   */
  returnToTitle() {
    if (this._booting) return;
    this._booting = true;
    this.flow.curtain.start({
      out: 40,
      hold: 26,
      into: 30,
      onSwap: () => {
        try { this._newGame(); } catch (e) { this._booting = false; }
      },
    });
  }

  /** Wipe the chapter back to the top. Runs at the curtain's blackest frame. */
  _newGame() {
    this.flow.music.play(null);
    this.flow.set(PHASE.FRONT);
    this.flow.beats.length = 0;
    this.flow.lurchClock = 0;

    // Drop the finished run whole: the Boilerworks, its ending, the death card
    // and the two halves' quest subscriptions (see gameflow.questScope — the
    // chapter can be played twice in one page load now, and five listeners per
    // scene per run is a leak that shows up as duplicated lurches).
    if (this._scope) { try { this._scope(); } catch (e) { /* never fatal */ } }
    this.endSeq = null;
    this.dg = null;
    this.dgPending = null;
    this.dgEngine = null;
    this.nudge = null;
    this.death = null;
    this.deaths = 0;
    this.deathFrames = 0;
    this.finished = false;
    this._bossReward = false;
    this._deathMsg = null;
    this._onDoorstep = false;
    this._pellNag = 0;
    this.skyDone.clear();
    this.sceneDone.clear();
    this.cardBox.close();
    this.cardBox.closing = 0;
    this.sub.open = false;
    this.sky.jumpTo(0);
    quest.reset();

    // The overworld half is rebuilt in the background. Nothing draws it until
    // the player answers the title screen, and `_booting` holds that door.
    this.owReady = this.makeOverworld(null)
      .then(() => { this._booting = false; this.syncHud(); this.hud.snap(); })
      .catch(() => { this._booting = false; });
    // BACK TO THE FILE SELECT, NOT TO A DEAD TITLE. The chapter that just ended
    // is a file — it was autosaved at the boss and it is sitting in a slot — so
    // the screen that comes up after the card is the one that lists it. A 1993
    // cartridge that dropped you on PRESS START after a finished game and made
    // you press through the logo again to see your own save would be the wrong
    // answer. `startAt` falls back to the title on runs with no file select
    // (?bot=play, ?beat=), so the autopilot's loop is unchanged.
    this.front = new FrontEnd({ onStart: () => this.startChapter(), startAt: 'files' });
    this.syncHud();
    this.hud.snap();
  }

  // ------------------------------------------------------------------ draw

  draw(ctx, engine) {
    switch (this.flow.phase) {
      case PHASE.FRONT:
        this.front.draw(ctx);
        break;
      case PHASE.OVERWORLD:
        // world -> y-sorted entities -> HUD (inside the ui pass) -> text box
        this.ow.draw(ctx, this.owEngine);
        // ...and START over the top of all of it, carrying the same floor plan
        // the Boilerworks' own START carries. The plan is only assembled on the
        // frames the panel is actually up: this runs 60 times a second.
        if (this.sub.open) this.sub.draw(ctx, quest, this.floorPlan());
        break;
      case PHASE.DUNGEON:
        if (this.dg) this.dg.draw(ctx, this.dgEngine);
        else { ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
        break;
      default:
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
    this.flow.draw(ctx);
    if (this.debug) this.drawDebug(ctx);
  }

  drawDebug(ctx) {
    const q = quest;
    const lines = [
      `${this.flow.phase} ${this.state().where} beat=${q.get('beat')} sky=${this.sky.stage.toFixed(2)}`,
      `blade=${q.has('hasCogblade') ? 1 : 0} key=${q.has('hasBoilerKey') ? 1 : 0} cuff=${q.has('hasBellowsCuff') ? 1 : 0}`
      + ` sk=${q.get('smallKeys')} big=${q.has('bigKey') ? 1 : 0} hp=${q.get('halves')}/${q.maxHalves} cogs=${q.get('cogs')}`,
    ];
    ctx.font = '8px monospace';
    lines.forEach((l, i) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(2, 202 + i * 9, l.length * 5 + 2, 9);
      ctx.fillStyle = '#8f8';
      ctx.fillText(l, 3, 209 + i * 9);
    });
  }

  // ---------------------------------------------------------------- probes

  /** Whichever half's player object owns the body right now. */
  _deathBody() {
    if (this.flow.phase === PHASE.DUNGEON) return this.dg && this.dg.player;
    return this.ow && this.ow.player;
  }

  /** Read by tools and by the puppeteer probe: window.__gwGame.state(). */
  state() {
    const phase = this.flow.phase;
    const where = phase === PHASE.OVERWORLD && this.ow ? this.ow.world.screen.id
      : phase === PHASE.DUNGEON && this.dg ? this.dg.curId
        : this.front ? this.front.state : '-';
    return {
      phase,
      where,
      finished: this.finished,
      curtain: this.flow.curtain.busy,
      music: this.flow.music.cur,
      sky: Number(this.sky.stage.toFixed(3)),
      beats: this.flow.beats.slice(),
      flags: quest.snapshot(),
      boss: this.dg && this.dg.boss
        ? { hp: this.dg.boss.hp, phase: this.dg.boss.phase } : null,
      shard: !!(this.dg && this.dg.shard),
      dead: !!this.death,
      deathT: this.death ? this.death.t : 0,
      deaths: this.deaths,
      // The letterbox, so a probe can check WHAT the card closes on rather
      // than only that it closed: the row it is aimed at, and the two bar
      // heights actually being filled this frame.
      deathFocusY: this.death ? this._deathFocusY() : -1,
      deathBars: this.death ? this._deathBars() : null,
      // The set piece, from the composition's side: how many frames it has
      // driven the body for, whether the body agrees it is dying, and which of
      // the twelve poses is up. deathFrameIndex() is imported, so reading this
      // does NOT touch sprites.death and cannot flatter a read count.
      deathFrames: this.deathFrames,
      dying: !!(this._deathBody() && this._deathBody().dying),
      deathPose: this._deathBody() && this._deathBody().dying
        ? deathFrameIndex(this._deathBody().deathT) : -1,
      sub: !!((this.sub && this.sub.open) || (this.dg && this.dg.mapUI && this.dg.mapUI.open)),
      card: !!(this.dg && this.dg._endCard),
      // The closing sequence, beat by beat, so a probe can prove the chapter
      // ENDED rather than only that it stopped. @see gameflow.Ending.state
      ending: this.endSeq ? this.endSeq.state() : null,
      booting: !!this._booting,
      dialog: !!(phase === PHASE.OVERWORLD ? (this.ow && this.ow.box.active)
        : (this.dg && this.dg.dialog.active)),
      posing: !!(phase === PHASE.OVERWORLD ? (this.ow && this.ow.tr.posing)
        : (this.dg && this.dg.tr.posing)),
    };
  }

  /**
   * ?bot=play on the front end.
   *
   * This used to press START and nothing else, and that is precisely why the
   * crash that made the chapter unfinishable survived every automated run:
   * START skips the whole intro in one hit (Intro.update calls skip()), so no
   * capture ever turned an intro PAGE — which is the only place in the game
   * that reached the state dialog.js threw on. A driver that only presses the
   * button which skips the content is not testing the content.
   *
   * So the bot now plays the front end the way a person does: A through the
   * title, then A through every intro panel, twice per panel (once to finish
   * the typewriter, once to turn the page), and START only as a late fallback
   * so a stalled run still gets to the dock.
   */
  botFront(engine) {
    const inp = engine.input;
    inp.down.clear();
    const f = engine.frame;
    if (this.front.state === 'intro') {
      if (f % 24 === 0) { inp.down.add('a'); inp.pressed.add('a'); }
      return;
    }
    if (f % 22 === 0) { inp.down.add('a'); inp.pressed.add('a'); }
    if (f > 900 && f % 60 === 0) { inp.down.add('start'); inp.pressed.add('start'); }
  }
}
