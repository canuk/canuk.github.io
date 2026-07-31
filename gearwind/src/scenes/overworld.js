// Gearwind — Chapter 1, first half. PLAYABLE.
//
// Wren lands at the skyharbor, walks up to Cogwick Hollow, is given the
// Cogblade by Gaffer Marla, crosses the Windrope, fights his way over the
// terrace and the scrap field, finds the Boiler Key on the rim, unlocks the
// gear-gate and reaches the Boilerworks mouth.
//
// This scene is the wiring: it owns the player, the sword, the HUD, the text
// box and the transitions, and hands them to game/world/overworld.js, which
// owns the map, the interactive objects and the screen graph.
//
// URL params (for the capture tool and for debugging):
//   ?scene=overworld&screen=<id>   start on any screen
//   &stage=N                       force a sky stage 0..4
//   &sword                         start with the Cogblade
//   &key                           start with the Boiler Key
import { TILE, WIDTH, HEIGHT } from '../engine.js';
import { makeSprite } from '../sprites.js';
import { makeItemSprites } from '../game/items.js';
import { makeTileset } from '../game/tileset.js';
import { Player } from '../game/player.js';
import { Melee } from '../game/combat.js';
import { makeEnemySprites } from '../game/enemies.js';
import { HUD } from '../game/hud.js';
import { DialogBox } from '../game/dialog.js';
import { makeNpcSprites, makeVillager, tryTalk } from '../game/npc.js';
import { Transitions, makeHoldPose } from '../game/transition.js';
import { SkyState } from '../game/skystate.js';
import sfx from '../game/sfx.js';
import { quest } from '../game/quest.js';
import { SCREENS, START } from '../game/world/maps-overworld.js';
import {
  Overworld, makeWorldTiles, makeWorldSprites, itemText, quantiseTiles, dirtGrain,
  skirtTiles, ROCK_RAMP,
} from '../game/world/overworld.js';

// ---------------------------------------------------------------------------
// HUD ICONS THIS SCENE OWNS.
//
// hud.js is the SHARED status strip and it is written for a Zelda-shaped game:
// its B-slot picture is a bomb and its third counter is a bomb count. Gearwind
// has no bombs anywhere in Chapter 1. Every one of those pixels is a lie about
// what game you are playing, and the fix belongs HERE, at the call site — the
// integration scene (scenes/game.js) already overrides both and this half-scene
// simply never did, so a capture of the overworld showed a clockwork bomb in
// 100% of frames.
//
// Same two icons, same values as scenes/game.js, so the strip does not change
// under the player when the two halves hand over.
// ---------------------------------------------------------------------------
const PIECE_PAL = { k: '#000000', W: '#f8f8f8', L: '#f87078', R: '#c00000' };
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

// Overworld.doorUnder() probes a box 5px tall at player.y + 18. Keep these in
// step with game/world/overworld.js doorUnder() — doorstep() is only correct
// while they match.
const DOOR_PROBE_DY = 18;
const DOOR_PROBE_H = 5;
const DOORSTEP_MARGIN = 2;
// Live frames after any teleport — a door, or a screen scroll — during which
// no door fires and the door latch cannot re-arm. It covers exactly the window
// where Wren has been PUT somewhere rather than walked there, which is the
// only window in which a positional door can fire without the player asking
// for it. A third of a second; you cannot walk into a door that fast.
const DOOR_LOCK = 20;

/** Centre a sprite in the item box's 16x16 well. `null` = an empty slot. */
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

export default class OverworldScene {
  async init(engine) {
    const params = engine.params || new URLSearchParams(location.search);
    this.engine = engine;

    const { tiles, sprites } = makeTileset();
    this.tiles = { ...tiles, ...makeWorldTiles() };
    // TAN IS ONE MATERIAL WITH FOUR RUNGS, and dirt and rock now share all
    // four of them (overworld.js TAN4 / ROCK_RAMP). Measured with a modal-block
    // sampler on #888040 — the measurement check-shot structurally cannot make,
    // because it only samples blocks whose mode is the screen's DOMINANT colour
    // (grass): our tan carried 75.4 non-base px and 5.17 colours per 16x16
    // against ALttP's cliff path at 37.4 / 3.13. Two ramps of three tans each,
    // plus per-pixel scatter in the source tiles, plus a stipple "rut", was the
    // whole gap. Both families snap to the same four tones and take one
    // despeckle pass, which deletes exactly the pixels the sampler counts and
    // no run of two.
    quantiseTiles(this.tiles, (n) => n.startsWith('path'), undefined, dirtGrain, 1);
    quantiseTiles(this.tiles,
      (n) => /^(rim|face|lobe|edge|corner|cse|csw|ce|isle)/.test(n),
      ROCK_RAMP, null, 1);
    // ...AND THE SEAM BETWEEN THE TWO MATERIALS GETS ITS OWN TONES. The tan's
    // texture was in range last pass and its colour count did not move at all
    // (5.45 per #888040-modal block against ALttP's 3.40), because every extra
    // tone was at a boundary: our road's black keyline and the grass's deepest
    // shadow, meeting with nothing in between. ALttP puts #889860 and #586848
    // there — blends that belong to neither ramp. See skirtTiles.
    skirtTiles(this.tiles, (n) => /^path_/.test(n));
    this.sprites = { ...sprites, ...makeWorldSprites() };
    this.npcSprites = makeNpcSprites();

    // --- chapter state ----------------------------------------------------
    quest.reset();
    if (params.has('sword')) quest.set('hasCogblade', true);
    if (params.has('key')) quest.set('hasBoilerKey', true);
    if (params.has('gate')) { quest.set('hasBoilerKey', true); quest.set('gateOpen', true); }
    this.quest = quest;

    // --- shared machinery -------------------------------------------------
    this.sky = new SkyState(0);
    this.tr = new Transitions({
      rand: () => engine.rand(),
      onSfx: (n) => this.sfx(n),
    });
    this.box = new DialogBox();
    this.melee = new Melee();
    this.hold = makeHoldPose();
    this.hud = new HUD({
      maxHearts: quest.get('maxHearts'), halves: quest.get('halves'),
      cogs: 0, keys: 0, bombs: 0, steam: 1,
    });
    // Retire the bomb art the shared HUD ships with (see PIECE_ICON above).
    // The third counter is heart PIECES in this chapter — syncHud() has been
    // assigning quest.heartPieces into hud.bombs all along, so the number was
    // right and only the icon over it was wrong.
    this.hud.sprites.bombMini = makeSprite(PIECE_ICON, PIECE_PAL);
    this._myHud = this.hud;
    const itemSpr = makeItemSprites();
    this.itemIcons = {
      none: wellIcon(null),
      cogblade: wellIcon(this.melee.spr.sword.n.img),
      cuff: wellIcon(itemSpr.cuff),
    };

    // The isle falls on story beats, never on a timer.
    quest.on('sky', (n) => this.sky.setStage(n, { frames: 150 }));
    quest.on('lurch', (o) => this.tr.lurch(o));
    quest.on('health', () => this.syncHud());
    quest.on('heart-container', () => this.syncHud());
    quest.on('flag', () => this.syncHud());
    if (params.has('stage')) {
      const n = Number(params.get('stage'));
      quest.setSky(n);
      this.sky.jumpTo(n);
    }

    // --- the world --------------------------------------------------------
    this.world = new Overworld({
      tiles: this.tiles, sprites: this.sprites, props: this.npcSprites.props,
      quest, screens: SCREENS, engine,
      enemySprites: makeEnemySprites(),
      onSfx: (n) => this.sfx(n),
    });
    this.world.onPopulate = (screen) => this.populate(screen);

    this.player = new Player(START.x, START.y);
    this.player.dir = START.dir;

    const startId = params.get('screen') || START.screen;
    const start = SCREENS[startId] ? startId : START.screen;
    this.world.enter(start, engine);
    if (start !== START.screen) {
      const sp = SCREENS[start].spawn || { x: 120, y: 150, dir: 'down' };
      this.player.x = sp.x; this.player.y = sp.y; this.player.dir = sp.dir || 'down';
      this.world.settle(this.player);
    }
    this.syncHud();

    this.pendingBeat = null;
    this.npcFlags = this.npcFlags || {};
    this.talkedPell = false;
    this.exitDoor = null;
    // Doors start DISARMED and arm the first frame Wren is seen standing off
    // one — so a start position that lands on a doorstep does not open it.
    // See the door block in update().
    this._doorArmed = false;
    this._doorLock = 0;
  }

  // ------------------------------------------------------------------ audio
  sfx(name) {
    try { sfx.play(name); } catch (e) { /* headless capture: no audio */ }
  }

  syncHud() {
    const q = this.quest;
    this.hud.maxHearts = q.get('maxHearts');
    this.hud.halves = q.get('halves');
    this.hud.cogs = q.get('cogs');
    this.hud.keys = q.get('smallKeys');
    this.hud.bombs = q.get('heartPieces');
    // The B slot shows what Wren is actually holding, and is EMPTY before
    // Marla hands the blade over. Same ladder as scenes/game.js.
    this.hud.sprites.item = q.has('hasBellowsCuff') ? this.itemIcons.cuff
      : q.has('hasCogblade') ? this.itemIcons.cogblade
        : this.itemIcons.none;
    // Above ground the meter is the ISLE's boiler pressure, not the Cuff's
    // charge: it falls a notch with every sky stage. Pinned at 1.0 it was a
    // full gauge on a sinking island.
    if (!q.has('hasBellowsCuff')) {
      this.hud.steam = Math.max(0.06, 0.34 - 0.055 * q.get('skyStage'));
    }
  }

  // ------------------------------------------------------------------- NPCs
  populate(screen) {
    const flags = this.npcFlags = this.npcFlags || {};
    const ctx = {
      sprites: this.npcSprites,
      box: this.box,
      flags,
      wallet: {
        get cogs() { return quest.get('cogs'); },
        set cogs(v) { quest.addCogs(v - quest.get('cogs')); },
      },
      onGiveCogblade: () => this.giveCogblade(),
      onBuyHeartJar: () => { quest.heal(99); this.sfx('heart'); },
      onBuySecondWind: () => quest.set('hasSecondWind', true),
    };
    for (const spec of screen.def.npcs || []) {
      const x = spec.px ? spec.px[0] : spec.c * TILE;
      const y = spec.px ? spec.px[1] : spec.r * TILE;
      const npc = makeVillager(spec.kind, x, y, ctx);
      if (spec.facing) npc.facing = spec.facing;
      // Every villager's words live in game/npc.js, which seals them with
      // _sealTalk — an onTalk assigned out here is ignored. Pell's cold-open
      // lines used to be duplicated at this point and never ran. The beat that
      // fires off the back of them (dockLurch) is wired in afterDialog().
      screen.addNpc(npc);
    }
  }

  /**
   * Marla hands over the Cogblade. The announcement is QUEUED, not fired:
   * she is still talking (the give runs out of her yes/no branch, which has
   * two more pages behind it), and starting the item pose on top of a live
   * DialogBox freezes the box mid-wipe for the whole presentation. It goes up
   * the moment she has finished, which is also when it lands hardest.
   */
  giveCogblade() {
    quest.set('hasCogblade', true);
    quest.beat('cogblade');
    this.world.queueItem({
      img: this.melee.spr.sword.n.img,
      lines: ['THE COGBLADE.', 'Marla carried it on',
        'her courier runs.'],
    });
  }

  /** Drain the item queue once nothing else owns the screen. */
  pumpItems() {
    if (!this.world.itemQueue.length) return false;
    if (this.box.active || this.tr.busy) return false;
    const it = this.world.itemQueue.shift();
    this.tr.getItem({ ...it, lines: itemText(it.lines), player: this.player });
    return true;
  }

  // ------------------------------------------------------------- transitions
  scrollTo(dir) {
    const nextId = this.world.neighbour(dir);
    if (!nextId) return;
    const cur = this.snapshot();
    const prev = this.world.screen;
    this.world.enter(nextId, this.engine);
    const next = this.snapshot();
    this.world.screen = prev;                       // hold until the scroll ends
    this.tr.scroll({
      dir, from: cur, to: next, player: this.player,
      onDone: () => {
        this.world.screen = this.world.get(nextId);
        this.world.settle(this.player);
        this.afterScreenChange(nextId);
      },
    });
  }

  /** Nothing Wren was PUT on counts as a door until he steps off it. */
  lockDoors() {
    this._doorArmed = false;
    this._doorLock = DOOR_LOCK;
  }

  afterScreenChange(id) {
    this.lockDoors();
    if (id === 'bridge') quest.beat('traverse');
    if (id === 'mouth') quest.set('reachedBoilerworks', true);
    if (id === 'dockroad') quest.set('leftTheDock', true);
  }

  /** Render the current screen (no player) into an offscreen canvas. */
  snapshot() {
    const cv = document.createElement('canvas');
    cv.width = WIDTH; cv.height = HEIGHT;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    this.drawWorld(c, false);
    return cv;
  }

  /**
   * Into a house: remember the doorstep so the way out lands back on it.
   *
   * THE STEP BACK IS DERIVED FROM THE TRIGGER, NEVER HARDCODED. `doorUnder()`
   * is positional and needs no input: it probes a 5px-tall box at player.y+18
   * (game/world/overworld.js), so a doorstep only clears the door it came from
   * when `player.y + 18 >= door.box.y + door.box.h`. The old `player.y + 10`
   * was written for an 8px trigger; every building's doorTrigger is 22px tall,
   * so the recorded doorstep landed back INSIDE the trigger and the door
   * re-fired the instant the fade ended. Measured on the real in-game round
   * trip (tools/critic/r17-doors6.js): shop 2 bounces, home 2, and the WINDMILL
   * 10 bounces and never escaped — a roach motel holding a heart piece and a
   * 20-cog chest. scenes/game.js patches over it with an `_onDoorstep` latch,
   * but the bug is here, in the scene that records the coordinate.
   */
  useDoor(door) {
    const dest = SCREENS[door.to];
    if (!dest) return;
    const step = this.doorstep(door);
    this.returnTo = { screen: this.world.screen.id, ...step };
    this.tr.fade({
      onSwap: () => {
        this.world.enter(door.to, this.engine);
        const s = dest.spawn || { x: 120, y: 150, dir: 'down' };
        this.player.x = s.x; this.player.y = s.y;
        this.player.dir = s.dir || 'down';
        this.world.settle(this.player);
        this.lockDoors();
      },
    });
  }

  /**
   * Where Wren stands when he comes back out of `door` — clear of the trigger
   * he used, and on ground he can actually stand on.
   *
   * Two candidates, both derived from the trigger box, never hardcoded:
   *   south — probe below the trigger's bottom edge (the usual cottage front);
   *   north — probe above its top edge.
   * The windmill needs the second one. Its arch opens onto a rock at (13,8)
   * and the Thornwrack: measured with tools/critic/r18-millobs.js, the only
   * standable ground in the door column is the 3px slot at x 210-212 ABOVE the
   * trigger, so a southern doorstep is not merely inside the trigger, it does
   * not exist. settle() would then spiral Wren back into the arch, which is
   * why simply lengthening the step still measured 10 bounces.
   */
  doorstep(door) {
    const b = door.box;
    const x = this.player.x;
    const below = Math.min(HEIGHT - 24,
      Math.max(this.player.y + 10, b.y + b.h + DOORSTEP_MARGIN - DOOR_PROBE_DY));
    const above = Math.max(0, b.y - DOORSTEP_MARGIN - DOOR_PROBE_DY - DOOR_PROBE_H);
    for (const [y, dir] of [[below, 'down'], [above, 'up']]) {
      if (this.doorstepClear(x, y, door)) return { x, y, dir };
    }
    return { x, y: below, dir: 'down' };
  }

  /** Standable, and outside `door`'s trigger. */
  doorstepClear(x, y, door) {
    const map = this.world.screen.map;
    if (!this.player._free(map, x, y)) return false;
    const b = door.box;
    const px = x + 4, py = y + DOOR_PROBE_DY;
    return !(px < b.x + b.w && px + 8 > b.x && py < b.y + b.h && py + DOOR_PROBE_H > b.y);
  }

  /** Back out onto the doorstep. */
  leaveInterior() {
    const back = this.returnTo || this.world.screen.def.from;
    if (!back) return;
    this.tr.fade({
      onSwap: () => {
        this.world.enter(back.screen, this.engine);
        this.player.x = back.x; this.player.y = back.y;
        this.player.dir = back.dir || 'down';
        this.world.settle(this.player);
        this.lockDoors();
      },
    });
  }

  // ------------------------------------------------------------------ update
  update(dt, engine) {
    const input = engine.input;
    this.sky.update();
    // ALttP never SNAPS a counter — pick up a 50-cog chest and the number
    // walks up one unit at a time with a tick per unit, which is most of what
    // makes a chest feel like a reward. hud.update() is what does the walking
    // and this scene never called it, so every counter here jumped.
    // ONLY when this scene owns the strip: scenes/game.js swaps its own shared
    // HUD in after init() and ticks it itself, and two ticks a frame would roll
    // the counters at double speed in the integrated build.
    if (this.hud === this._myHud) this.hud.update(1 / 60);
    this.tr.update(input, engine);
    if (this.tr.frozen) return;

    const screen = this.world.screen;
    for (const n of screen.npcs) n.update(engine);

    // The text box owns input while it is up.
    if (this.box.active) { this.box.update(input); this.afterDialog(); return; }

    const carrying = !!this.world.carrying;
    let consumed = false;

    // Action button: talk / read / open / unlock, else swing.
    if (!this.melee.sword.active && input.hit('a')) {
      consumed = tryTalk(this.player, this.world.talkables(), input, this.box);
      if (!consumed) consumed = this.world.tryAction(this.player, this.box, this.tr);
    }
    // Item button: lift a pot, or throw the one already overhead.
    if (input.hit('b')) {
      if (carrying) this.world.throwCarried(this.player);
      else this.world.tryLift(this.player);
    }

    if (!consumed && !carrying && quest.has('hasCogblade')) {
      this.melee.update(input, this.player, this.world.swordTargets());
    } else {
      this.player.lock = false;
      this.player.attackPose = false;
    }

    this.player.update(input, screen.map);
    // The north rim's collision only covers the top 7px of its tile, so Wren
    // can stand with his head 8px off the top of the screen. Where there is a
    // screen above, edgeExit fires at exactly this line; where there is not,
    // this is the fence.
    if (this.player.y < -6) this.player.y = -6;
    // A DEAD EDGE IS A FENCE, NOT A CLIFF TO HANG OFF. Where no screen sits
    // beyond an edge, the four thresholds above still let Wren push a couple
    // of pixels past the frame and get his sprite sliced by it — 2px walking
    // east off the dock's quay, 6px walking north out of the rim nook. The
    // sprite is 16x24 drawn at (x,y); these are its four walls.
    if (!this.world.neighbour('up') && this.player.y < 0) this.player.y = 0;
    if (!this.world.neighbour('left') && this.player.x < 0) this.player.x = 0;
    if (!this.world.neighbour('right') && this.player.x > WIDTH - 16) {
      this.player.x = WIDTH - 16;
    }
    if (!this.world.neighbour('down') && this.player.y > HEIGHT - 24) {
      this.player.y = HEIGHT - 24;
    }
    this.world.update(engine, this.player);
    this.world.updateEnemies(engine, this.player);
    this.world.collectDrops(this.player);
    this.world.collectPieces(this.player, this.box, this.tr);
    this.syncHud();
    this.afterDialog();

    if (this.tr.busy) return;

    // Leaving the board.
    //
    // A DOOR IS AN EDGE TRIGGER, NOT A LEVEL ONE. doorUnder() is positional
    // and needs no input, so a door that fires whenever Wren is standing in it
    // fires on EVERY frame he is standing in it — which is what made the
    // building round trip a ping-pong. `_onPortal` twenty lines down has
    // always got this right; the door never did.
    //
    // The step-back alone cannot fix the windmill, and it is worth writing
    // down why, because it looks like it should. That arch is entered walking
    // DOWN off the Hollow road, and the mill floor is left walking DOWN too
    // (its exit is on the interior's bottom row) — so the same held key that
    // takes you out walks you back in. There are 28px of standable ground
    // north of the arch, hemmed by the Thornwrack at (13,5), so no doorstep is
    // far enough away to outrun a held direction. Measured with
    // tools/critic/r18-millobs.js and r18-millfree.js.
    //
    // So: a door fires on the frame Wren WALKS ONTO it, and re-arms only when
    // he is standing off it — plus a DOOR_LOCK window after any teleport, so a
    // trigger he was PUT on never counts as a trigger he walked onto. The lock
    // is what separates the two cases a frame count cannot: the mill floor's
    // spawn is 3px above its own exit, so "walked down onto the exit from the
    // spawn" and "was dropped on the exit by the door" are the same pixels.
    //
    // It also means an arrival tile that happens to sit on a doorstep can no
    // longer swallow you the moment the scroll lands — villagee's east edge
    // does exactly that (arrive from the Windrope at (210,102) and the mill
    // ate you 16 frames later, with no input at all).
    const door = this.world.doorUnder(this.player);
    if (this._doorLock > 0) { this._doorLock--; this._doorArmed = false; }
    else if (!door) this._doorArmed = true;
    else if (this._doorArmed) {
      this._doorArmed = false;
      this.lockDoors();
      if (door.kind === 'exit') this.leaveInterior();
      else this.useDoor(door);
      return;
    }

    // The Boilerworks mouth. The dungeon piece takes over from here; until it
    // is wired in, say so and step Wren back off the stair.
    const portal = this.world.portalUnder(this.player);
    if (!portal) this._onPortal = false;
    else if (!this._onPortal) {
      this._onPortal = true;
      quest.beat('boilerworks');
      if (this.onEnterDungeon) { this.onEnterDungeon(portal); return; }
      this.box.say([
        'The stair goes down into the\nsteam. Somewhere under it,\nthe liftstone is missing.',
      ]);
      this.player.y += 12;
      return;
    }

    const dir = this.world.edgeExit(this.player, input);
    if (dir) this.scrollTo(dir);
  }

  /** Beats that fire off the back of a conversation. */
  afterDialog() {
    this.pumpItems();
    if (this.npcFlags.pell && !this.talkedPell && !this.box.active) {
      this.talkedPell = true;
      quest.set('talkedToPell', true);
      quest.beat('dockLurch');
      // The horizon tilts, a crate slides, the gulls go up. Then Pell, flat:
      this.box.say('Pell: "...That\'s not weather."');
    }
    if (this.npcFlags.tam) quest.set('talkedToTam', true);
    if (this.npcFlags.hesper) quest.set('talkedToHesper', true);
    if (this.npcFlags.cogblade) quest.set('talkedToMarla', true);
  }

  // -------------------------------------------------------------------- draw
  draw(ctx, engine) {
    this.tr.render(ctx, (c) => this.drawWorld(c, true), {
      ui: (c) => this.hud.draw(c),
    });
    this.drawDialog(ctx);
  }

  // The dialog window stays "active" for a few frames while its close wipe
  // plays, and on the first of those frames it has no page to render. That is
  // the box module's business, not ours — guard so a shut text box can never
  // take the frame down with it.
  drawDialog(ctx) {
    if (!this.box.active) return;
    if (this.box.node) { this.box.draw(ctx); return; }
    try { this.box.draw(ctx); } catch (e) { /* mid-wipe, nothing to paint */ }
  }

  drawWorld(ctx, withPlayer) {
    const engine = this.engine;
    const world = this.world;
    world.drawTerrain(ctx, engine, this.sky);
    world.drawGround(ctx, engine);

    const list = world.drawables(engine);
    if (withPlayer && !this.tr.posing) {
      list.push({ baseY: this.player.baseY, draw: (c) => this.drawPlayer(c) });
    }
    list.sort((a, b) => a.baseY - b.baseY);
    for (const d of list) d.draw(ctx);

    world.drawOver(ctx, engine);
    // Wren and the Cogblade take the stage light like everything else: the
    // isle is falling and the hero cannot be the one thing still lit at noon.
    // skystate.js authors his whole ramp by hand for exactly this reason.
    if (withPlayer && !this.tr.posing) this.melee.drawOver(world.tintCtx(ctx), this.player);
    this.melee.drawFx(ctx);
  }

  /** Wren, or Wren holding a pot over his head. */
  drawPlayer(ctx0) {
    const p = this.player;
    const ctx = this.world.tintCtx(ctx0);
    const carry = this.world.carrying;
    if (!carry) { p.draw(ctx); return; }
    const x = Math.round(p.x), y = Math.round(p.y);
    ctx.drawImage(p.sprites.shadow, x + 2, y + 20);
    ctx.drawImage(this.hold.body, x, y);
    ctx.drawImage(this.hold.armL, x - 2, y - 2);
    ctx.drawImage(this.hold.armR, x + 14, y - 2);
    ctx.drawImage(carry.img, x, y - 14);
  }
}
