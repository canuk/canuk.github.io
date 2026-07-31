// Gearwind — SAVE AND LOAD.
//
// WHY localStorage AND NOT IndexedDB.
// The whole of a Chapter 1 file is small and flat: the quest flag table, the
// fired beats, the one-shot marks, which screen and where on it, the item
// inventory and the equipped item, hearts and heart pieces, cogs and keys, the
// Boilerworks' visited/cleared room lists, and the sky stage. Measured on a
// real run it serialises to under 2 KB — three orders of magnitude inside the
// ~5 MB localStorage gives an origin. IndexedDB buys capacity, indexes and
// blobs, and charges for them in asynchrony: an open request, a transaction, a
// version-change handler, and a load path that can no longer be a synchronous
// read at the moment the title screen has to decide whether to draw CONTINUE.
// None of that is worth anything here, so this is one synchronous getItem and
// one synchronous setItem, both wrapped in try/catch because a browser in
// private mode throws on both.
//
// WHAT A SAVE MUST NEVER DO: break the title screen. Every read path below
// returns null rather than throwing — absent key, non-JSON garbage, valid JSON
// of the wrong shape, and a file stamped with a SCHEMA this build does not
// recognise (older OR newer) are all "there is no save", which makes the front
// end behave exactly as it did before this file existed. A refusal is never a
// crash and never a silent partial load.
//
// PUBLIC API (this is what src/scenes/game.js needs, if anything):
//   hasSave()                 -> boolean, cheap, safe on a corrupt store
//   readSave()                -> validated payload | null
//   describeSave()            -> { place, hearts, maxHearts, cogs, sky } | null
//   writeSave(game)           -> boolean          (manual save)
//   autosave(game, reason)    -> boolean          (quiet, deduped, throttled)
//   applySave(game, data)     -> Promise<boolean> (the load)
//   clearSave()               -> void
//   saveTick(game)            -> called once a frame by GameFlow.update()
//   requestContinue()         -> title screen chose CONTINUE
//   currentGame()             -> window.__gwGame, or null
//
// EVERYTHING IN THIS FILE IS ALREADY WIRED from files this piece owns:
// gameflow.js's GameFlow.update() calls saveTick() every frame (autosave beats
// + the SELECT-on-subscreen manual save), and titlescreen.js's FrontEnd asks
// hasSave()/describeSave() and calls requestContinue(). game.js needs no edits
// for any of it — see the note at the bottom of this header.

import { quest, DEFAULT_FLAGS } from './quest.js';

// ---------------------------------------------------------------------------
// The file
// ---------------------------------------------------------------------------

export const SAVE_KEY = 'gearwind.ch1.save';

/**
 * Payload schema version. BUMP THIS whenever the shape below changes in a way
 * an older reader would misread. A file whose `v` is not exactly this number is
 * refused — `readSave()` returns null and the title screen offers a new game —
 * rather than being fed to code that expects different fields. That is the
 * whole point of stamping it: an old save must cost the player a file, never a
 * crash on the first frame of the chapter.
 */
export const SCHEMA = 1;

/** Human-facing names for the save summary line on the title screen. */
const PLACE = {
  dock: 'BELLOWS DOCK',
  dockroad: 'THE HARBOUR ROAD',
  villagew: 'COGWICK HOLLOW',
  villagee: 'COGWICK HOLLOW',
  shop: 'THE TRADING POST',
  home: 'A COTTAGE',
  mill: 'THE WINDMILL',
  bridge: 'THE WINDROPE',
  terrace: 'THE TERRACE',
  scrapfield: 'THE SCRAPFIELD',
  cliffnook: 'THE CLIFF NOOK',
  mouth: 'THE WORKS MOUTH',
};

// ---------------------------------------------------------------------------
// Storage — every entry point survives a hostile store
// ---------------------------------------------------------------------------

function store() {
  try {
    // Safari private mode has a `localStorage` that throws on setItem, so the
    // probe is a real round trip rather than a truthiness check.
    const s = globalThis.localStorage;
    if (!s) return null;
    s.setItem(SAVE_KEY + '.probe', '1');
    s.removeItem(SAVE_KEY + '.probe');
    return s;
  } catch (e) { return null; }
}

/** Why the last read refused, for the debug overlay. Never shown to a player. */
export let lastRefusal = null;

/**
 * Read and VALIDATE. Returns null for: no store, no key, non-JSON, a non-object,
 * a wrong/absent schema stamp, or a payload missing the fields a load needs.
 * @returns {object|null}
 */
export function readSave() {
  lastRefusal = null;
  const s = store();
  if (!s) { lastRefusal = 'no-storage'; return null; }
  let raw;
  try { raw = s.getItem(SAVE_KEY); } catch (e) { lastRefusal = 'read-threw'; return null; }
  if (!raw) { lastRefusal = 'empty'; return null; }
  let d;
  try { d = JSON.parse(raw); } catch (e) { lastRefusal = 'corrupt-json'; return null; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) { lastRefusal = 'not-an-object'; return null; }
  if (d.v !== SCHEMA) {
    // Older or newer, it is the same answer: this build cannot read it, so it
    // does not pretend to. No half-applied flags, no crash.
    lastRefusal = typeof d.v === 'number'
      ? (d.v < SCHEMA ? 'older-schema' : 'newer-schema') : 'unstamped';
    return null;
  }
  if (!d.flags || typeof d.flags !== 'object') { lastRefusal = 'no-flags'; return null; }
  if (d.phase !== 'overworld' && d.phase !== 'dungeon') { lastRefusal = 'bad-phase'; return null; }
  if (d.phase === 'overworld' && (!d.ow || typeof d.ow.screen !== 'string')) {
    lastRefusal = 'no-screen'; return null;
  }
  if (d.phase === 'dungeon' && (!d.dg || typeof d.dg.room !== 'string')) {
    lastRefusal = 'no-room'; return null;
  }
  return d;
}

/** Cheap "is there a file". Safe on a corrupt or absent store. */
export function hasSave() { return readSave() !== null; }

/** The one-line summary the title screen prints under CONTINUE. */
export function describeSave() {
  const d = readSave();
  if (!d) return null;
  const f = d.flags || {};
  const place = d.phase === 'dungeon'
    ? 'THE BOILERWORKS ' + String((d.dg && d.dg.room) || '')
    : (PLACE[d.ow && d.ow.screen] || 'BELLOWS ISLE');
  return {
    place,
    hearts: Math.max(1, Math.round((f.maxHearts || 3))),
    halves: Math.max(0, f.halves | 0),
    cogs: Math.max(0, f.cogs | 0),
    sky: f.skyStage | 0,
    beat: f.beat | 0,
  };
}

/**
 * The file the TITLE SCREEN should offer, which is not always the file on the
 * machine. `?bot=play` drives the front end by pressing A, so a bot run on a
 * machine with a save would silently pick CONTINUE and every capture of the
 * chapter would start half way through it; `?beat=` warps past the title
 * entirely with a hand-built flag set. Both get PRESS START. `&save=on` forces
 * the file back, which is what the round-trip verification uses.
 */
export function titleFile() {
  try {
    const p = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    if (p.get('save') === 'off') return null;
    if (p.get('save') !== 'on' && (p.has('bot') || p.has('beat'))) return null;
  } catch (e) { /* no location: headless module test */ }
  return describeSave();
}

export function clearSave() {
  const s = store();
  if (!s) return;
  try { s.removeItem(SAVE_KEY); } catch (e) { /* nothing to do */ }
}

// ---------------------------------------------------------------------------
// Snapshot — everything that has to come back
// ---------------------------------------------------------------------------

/**
 * WHAT ACTUALLY NEEDS PERSISTING, read off the live objects.
 *
 * `quest.flags` covers items, counters, hearts, heart pieces, cogs, keys and
 * the sky STAGE; `quest._fired` is what stops a story beat re-firing (and with
 * it a duplicate lurch and a sky rewind); `quest.marks` is every bush already
 * cut and chest already opened. The rest is the composition's: where the player
 * is standing, which half of the chapter he is in, the SkyState's real
 * (fractional, mid-ramp) value, and the Boilerworks' visited/cleared rooms so a
 * cleared arena stays cleared.
 *
 * @param {object} game a GameScene
 * @returns {object|null} null if the game is not in a saveable state
 */
export function snapshot(game) {
  if (!game || !game.flow) return null;
  const phase = game.flow.phase;
  if (phase !== 'overworld' && phase !== 'dungeon') return null;
  const q = game.quest || quest;
  const ow = game.ow, dg = game.dg;
  if (phase === 'overworld' && !(ow && ow.world && ow.world.screen)) return null;
  if (phase === 'dungeon' && !(dg && dg.curId)) return null;

  return {
    v: SCHEMA,
    t: Date.now(),
    phase,
    flags: { ...q.flags },
    beats: [...(q._fired || [])],
    marks: [...(q.marks || [])],
    // The SkyState's live value, not the integer stage: the fall ramps over
    // 120 frames and a save taken mid-ramp must not snap the light backwards.
    sky: Number((game.sky ? game.sky.stage : (q.flags.skyStage || 0)).toFixed(3)),
    // WHICH ITEM IS ON THE B BUTTON.
    //
    // The inventory cursor keeps its choice in the flag store as `bItem`
    // (gameflow.bItemOf / setBItem), so it is already inside `flags` above and
    // round-trips for free — which is the right answer and the reason this
    // field is a belt to that braces rather than the mechanism. It is written
    // defensively because that cursor is another piece's work: whichever of
    // `sub.equipped`, `flags.bItem` or nothing exists is what is stored, and a
    // build with none of them re-derives the B item on load exactly as the
    // chapter did before any of this existed.
    equipped: pickEquipped(game, q),
    deaths: game.deaths | 0,
    bossReward: !!game._bossReward,
    skyDone: [...(game.skyDone || [])],
    sceneDone: [...(game.sceneDone || [])],
    ow: ow && ow.world && ow.world.screen ? {
      screen: ow.world.screen.id,
      x: Math.round(ow.player.x),
      y: Math.round(ow.player.y),
      dir: ow.player.dir || 'down',
      // Which outdoor screen an interior door came from, or leaving the shop
      // puts Wren nowhere.
      returnTo: ow.returnTo || null,
    } : null,
    dg: dg && dg.curId ? {
      room: dg.curId,
      x: Math.round(dg.player.x),
      y: Math.round(dg.player.y),
      dir: dg.player.dir || 'down',
      visited: [...(dg.visited || [])],
      cleared: Object.keys(dg.roomCache || {}).filter((id) => dg.roomCache[id].cleared),
    } : null,
  };
}

function pickEquipped(game, q) {
  if (typeof q.flags.bItem === 'string') return q.flags.bItem;
  if (game.sub && typeof game.sub.equipped === 'number') return game.sub.equipped;
  if (typeof q.flags.equipped === 'number') return q.flags.equipped;
  return null;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Manual save. Returns false — and writes nothing — rather than throwing, at
 * every step: no store, nothing worth saving, a quota error.
 */
export function writeSave(game) {
  const s = store();
  if (!s) return false;
  const d = snapshot(game);
  if (!d) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(d));
    lastWrite = { t: d.t, phase: d.phase, reason: 'manual' };
    return true;
  } catch (e) { return false; }
}

/** The last successful write, for the debug overlay and for probes. */
export let lastWrite = null;

// A save is one setItem of ~2 KB; the throttle is not for cost, it is so a beat
// that fires twice on adjacent frames (an item-get inside a room entry) writes
// once.
const AUTOSAVE_GAP = 30;   // frames
let _lastAutoFrame = -1e9;
let _lastKey = null;

/**
 * AUTOSAVE. Quiet — no sound, no flash, nothing on screen. Deduped on a key
 * built from the beats we care about, so it costs one string compare a frame
 * and only touches storage when one of them has actually moved.
 */
export function autosave(game, reason) {
  const s = store();
  if (!s) return false;
  const frame = (game.engine && game.engine.frame) || 0;
  if (frame - _lastAutoFrame < AUTOSAVE_GAP) return false;
  const d = snapshot(game);
  if (!d) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(d));
    _lastAutoFrame = frame;
    lastWrite = { t: d.t, phase: d.phase, reason: reason || 'auto' };
    return true;
  } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

/**
 * PUT THE CHAPTER BACK.
 *
 * Async only because re-entering the Boilerworks may have to build it
 * (`game.makeDungeon` is async). Everything else is synchronous assignment.
 *
 * Order matters: the flag store first (the world reads it while it populates),
 * then the half-scene the player was in, then the phase, then the HUD.
 *
 * @param {object} game a GameScene
 * @param {object} [data] a payload from readSave(); read one if omitted
 * @returns {Promise<boolean>}
 */
export async function applySave(game, data) {
  const d = data || readSave();
  if (!d || !game || !game.flow) return false;
  const q = game.quest || quest;

  // --- the flag store -------------------------------------------------------
  // reset() first so anything the file does not mention goes back to its
  // Chapter 1 default rather than keeping the value the live run had.
  q.reset();
  q.flags = { ...DEFAULT_FLAGS, ...d.flags };
  q.marks = new Set(Array.isArray(d.marks) ? d.marks : []);
  q._fired = new Set(Array.isArray(d.beats) ? d.beats : []);

  // --- the fall -------------------------------------------------------------
  if (game.sky) game.sky.jumpTo(typeof d.sky === 'number' ? d.sky : (q.flags.skyStage || 0));
  if (game.skyDone) { game.skyDone.clear(); for (const k of d.skyDone || []) game.skyDone.add(k); }
  if (game.sceneDone) { game.sceneDone.clear(); for (const k of d.sceneDone || []) game.sceneDone.add(k); }
  game.deaths = d.deaths | 0;
  game._bossReward = !!d.bossReward;

  // --- above ground ---------------------------------------------------------
  const ow = game.ow;
  if (ow && ow.world && d.ow) {
    try {
      if (ow.world.screen.id !== d.ow.screen) ow.world.enter(d.ow.screen, game.owEngine);
      ow.returnTo = d.ow.returnTo || ow.returnTo;
      const p = ow.player;
      p.x = d.ow.x; p.y = d.ow.y; p.dir = d.ow.dir || 'down';
      p.moving = false; p.kbT = 0; p.lock = false; p.invulnT = 0;
      p.attackPose = false; p.attackIndex = 0;
      if (p.clearDeath) p.clearDeath();
      ow.world.settle(p);
      if (ow.lockDoors) ow.lockDoors();
      ow._onPortal = false;
      if (ow.tr) ow.tr._fx = null;
      if (ow.box && ow.box.node) ow.box.close();
    } catch (e) { /* a screen id that no longer exists must not kill the load */ }
  }

  // --- below ground ---------------------------------------------------------
  if (d.phase === 'dungeon' && d.dg) {
    try {
      if (!game.dg) {
        await game.makeDungeon(d.dg.room);
        game.dgPending = Promise.resolve(game.dg);
      }
      const dg = game.dg;
      // Rooms the player had already emptied stay empty, and their doors stay
      // open — otherwise loading into a cleared arena seals you into it.
      for (const id of d.dg.cleared || []) {
        try {
          const r = dg.getRoom(id);
          if (r) { r.cleared = true; if (r.unsealDoors) r.unsealDoors(); }
        } catch (e) { /* an id this build no longer has */ }
      }
      if (dg.curId !== d.dg.room) dg.enterRoom(d.dg.room, 'south', true);
      for (const id of d.dg.visited || []) dg.visited.add(id);
      if (dg.cur && dg.cur.cleared && dg.cur.unsealDoors) dg.cur.unsealDoors();
      const p = dg.player;
      p.x = d.dg.x; p.y = d.dg.y; p.dir = d.dg.dir || 'down';
      p.moving = false; p.kbT = 0; p.lock = false; p.invulnT = 0;
      p.attackPose = false; p.attackIndex = 0;
      if (p.clearDeath) p.clearDeath();
      dg._exitArmed = false;
      dg.deathHold = false;
      if (dg.tr) dg.tr._fx = null;
      // _armRoom says its line on the way in; a load is not a way in.
      if (dg.dialog && dg.dialog.node) dg.dialog.close();
      if (dg.mapUI) dg.mapUI.open = false;
    } catch (e) { return false; }
  }

  // --- the equipped item ----------------------------------------------------
  //
  // `bItem` already came back inside `flags`; the first clause only covers the
  // other two shapes the field may have been written in.
  //
  // The second clause is the one that matters, and it is here at the END of the
  // load rather than up with the flags because it needs the Boilerworks to
  // exist. The subscreen's B-item seam (gameflow.Subscreen._hooks) installs
  // itself lazily, the first time the panel is DRAWN — a deliberate choice by
  // that piece, and the right one for a fresh run, where nobody has chosen
  // anything yet. A load is the exception: the choice was made in a previous
  // sitting and is already in the flag store, so without this the player would
  // continue with the Cogblade on B, an item box showing the Cuff, and the Cuff
  // still firing. MEASURED before this line existed: `bItem` restored to
  // 'cogblade' while `hud.sprites.item` read 'cuff'. Idempotent, guarded, and
  // a no-op on a build whose subscreen has no seam to install.
  if (typeof d.equipped === 'number') {
    q.flags.equipped = d.equipped;
    if (game.sub) game.sub.equipped = d.equipped;
  }
  if (game.sub) {
    try {
      if (typeof game.sub.syncCursor === 'function') game.sub.syncCursor(q);
      if (typeof game.sub._hooks === 'function') { game.sub._q = q; game.sub._hooks(); }
    } catch (e) { /* never fatal */ }
  }

  // --- the phase, and the strip --------------------------------------------
  game.flow.set(d.phase);
  game._surfaced = d.phase === 'overworld' && !!game.dg;
  game.death = null;
  if (game.sub) game.sub.open = false;
  if (game.syncHud) game.syncHud();
  if (game.hud && game.hud.snap) game.hud.snap();
  return true;
}

// ---------------------------------------------------------------------------
// The frame tick — autosave beats, and the manual save on the subscreen
// ---------------------------------------------------------------------------

/** GameScene publishes itself here at the end of init(). */
export function currentGame() {
  return (typeof window !== 'undefined' && window.__gwGame) || null;
}

let _pendingContinue = false;

/** Called by the title screen when the player chooses CONTINUE. */
export function requestContinue() { _pendingContinue = true; }
export function continuePending() { return _pendingContinue; }

// THE SAVE MENU IS INJECTED, NOT IMPORTED. gameflow.js already imports this
// file; importing its SaveMenu back would make a cycle, and a cycle whose
// exports are `const` is a temporal-dead-zone crash waiting for whichever
// module the bundler decides to evaluate second. So the panel — which is pure
// drawing and belongs next to the subscreen it sits inside — registers itself
// here at module load and this file only ever calls it.
let _menu = null;
export function setSaveMenu(m) { _menu = m; }
export function getSaveMenu() { return _menu; }

/**
 * AUTOSAVE IS OFF FOR RUNS THAT ARE NOT A PLAYTHROUGH.
 *
 * `?beat=` warps in with a hand-built flag set and `?bot=play` drives the whole
 * chapter in a few thousand frames; either one silently overwriting a real
 * player's file is worse than having no autosave at all. `&save=on` forces it
 * back on, which is what the verification run uses.
 */
function autosaveAllowed(game) {
  if (!game || !game.params) return true;
  if (game.params.get('save') === 'off') return false;
  if (game.params.get('save') === 'on') return true;
  return !(game.params.has('beat') || game.params.has('bot'));
}

/**
 * The beat key. A save happens when THIS string changes, which is exactly the
 * list the brief asks for: a screen change, an item-get, a dungeon room entry,
 * a boss defeat — plus keys and hearts-max, which are the other two things a
 * player would be furious to lose.
 */
function beatKey(game, q) {
  const f = q.flags;
  const where = game.flow.phase === 'dungeon'
    ? 'D:' + (game.dg ? game.dg.curId : '?')
    : 'O:' + (game.ow && game.ow.world && game.ow.world.screen ? game.ow.world.screen.id : '?');
  const cleared = game.dg && game.dg.cur && game.dg.cur.cleared ? 1 : 0;
  return [
    where,
    f.hasCogblade ? 1 : 0, f.hasBellowsCuff ? 1 : 0, f.hasBoilerKey ? 1 : 0,
    f.hasSecondWind ? 1 : 0, f.bigKey ? 1 : 0, f.dgnMap ? 1 : 0, f.dgnCompass ? 1 : 0,
    f.smallKeys | 0, f.maxHearts | 0, f.heartPieces | 0, f.beat | 0,
    game.deaths | 0, cleared,
  ].join('|');
}

/**
 * ONE CALL A FRAME, from GameFlow.update(). Does three things, all cheap:
 *
 *  1. drains a CONTINUE that the title screen asked for, once the chapter has
 *     actually been handed the phase (startChapter() can defer);
 *  2. reads SELECT while a subscreen is open and opens the save menu — ALttP's
 *     own gesture, and see gameflow.SaveMenu for why it is not a pause menu;
 *  3. compares the beat key and autosaves when it has moved.
 */
export function saveTick(game) {
  if (!game || !game.flow) return;
  const q = game.quest || quest;
  const phase = game.flow.phase;

  // 1. THE DEFERRED CONTINUE.
  //
  // The title screen cannot load: startChapter() may defer the handover while
  // the overworld is still being built, and a save in the Boilerworks has to
  // wait on an async makeDungeon(). So the choice is recorded and drained here,
  // on the first frame the chapter is actually holding the phase — and the
  // curtain is held BLACK across the load, because a frame of the dock showing
  // through before the file lands is the worst possible first impression of a
  // save system.
  if (_pendingContinue) {
    if (phase !== 'front' && !game._booting && game.ow && game.ow.world) {
      _pendingContinue = false;
      const d = readSave();
      if (!d) return;
      const c = game.flow.curtain;
      c.start({ out: 0, hold: 240, into: 26 });
      applySave(game, d)
        .then(() => { if (c.running) c.t = Math.max(c.t, c.out + c.hold); })
        .catch(() => { if (c.running) c.t = Math.max(c.t, c.out + c.hold); });
      resetTick();
    }
    return;
  }

  // Back at the title — between runs. Forget the beat key, so the first key of
  // the NEXT run counts as the run starting rather than as a beat: without
  // this, choosing NEW GAME after a chapter card would overwrite the finished
  // file on the very first screen the player walked onto, before he had done
  // anything worth recording.
  if (phase !== 'overworld' && phase !== 'dungeon') { _lastKey = null; return; }

  // 2. SELECT on the subscreen. GameFlow.update() runs before GameScene's own
  //    phase switch and before dungeon.js sees the frame, so the press is read
  //    and CONSUMED here — the menu owns the frame while it is up.
  const menu = _menu;
  const subOpen = !!((game.sub && game.sub.open)
    || (game.dg && game.dg.mapUI && game.dg.mapUI.open));
  const input = game.engine && game.engine.input;
  if (menu && input) {
    if (menu.open) {
      menu.update(input, game);
      input.down.clear(); input.pressed.clear();
      if (!subOpen) menu.open = false;
      return;
    }
    if (subOpen && input.hit('select')) {
      input.pressed.delete('select');
      input.down.delete('select');
      menu.show();
      return;
    }
  }

  // 3. the autosave beats
  if (!autosaveAllowed(game)) return;
  if (game.death || game.flow.curtain.busy) return;
  if (game.endSeq && game.endSeq.running) return;
  if ((q.flags.halves | 0) <= 0) return;
  const key = beatKey(game, q);
  if (key === _lastKey) return;
  const first = _lastKey === null;
  _lastKey = key;
  // The very first key of a run is not a beat, it is just the run starting.
  if (first) return;
  // If the throttle refuses this write, un-latch the key so the beat is retried
  // on a later frame. Latching before the throttle answered meant any beat
  // landing inside the 30-frame window was dropped for good — measured, a small
  // key taken 8 frames after an autosave never reached the file at all.
  if (!autosave(game, 'beat')) _lastKey = null;
}

/** Wipe the tick's memory — called when the chapter restarts from the title. */
export function resetTick() { _lastKey = null; _lastAutoFrame = -1e9; }

export default {
  SAVE_KEY, SCHEMA, hasSave, readSave, describeSave, writeSave, autosave,
  applySave, clearSave, snapshot, saveTick, resetTick, requestContinue,
  currentGame, setSaveMenu, getSaveMenu,
};
