// Gearwind — SAVE AND LOAD, in TWO NAMED FILES.
//
// WHY localStorage AND NOT IndexedDB.
// The whole of a Chapter 1 file is small and flat: the quest flag table, the
// fired beats, the one-shot marks, which screen and where on it, the item
// inventory and the equipped item, hearts and heart pieces, cogs and keys, the
// Boilerworks' visited/cleared room lists, and the sky stage. Measured on a
// real run it serialises to under 2 KB — three orders of magnitude inside the
// ~5 MB localStorage gives an origin, and TWO of them is still under 4 KB.
// IndexedDB buys capacity, indexes and blobs, and charges for them in
// asynchrony: an open request, a transaction, a version-change handler, and a
// load path that can no longer be a synchronous read at the moment the FILE
// SELECT has to decide whether a row says a name or "- EMPTY -". None of that
// is worth anything here, so this is one synchronous getItem and one
// synchronous setItem per slot, both wrapped in try/catch because a browser in
// private mode throws on both.
//
// WHAT A SAVE MUST NEVER DO: break the front end. Every read path below returns
// null rather than throwing — absent key, non-JSON garbage, valid JSON of the
// wrong shape, and a file stamped with a SCHEMA this build does not recognise
// (older OR newer) are all "there is no file in that slot", which makes the row
// read "- EMPTY -" and leaves the OTHER slot completely untouched. A refusal is
// never a crash and never a silent partial load.
//
// TWO SLOTS, EACH WITH A NAME.
// `gearwind.ch1.file1` and `gearwind.ch1.file2`. A slot holds one of exactly
// two things:
//
//   a FRESH file  {v, t, name, fresh:true}      — named at NAME ENTRY, unplayed
//   a PLAYED file {v, t, name, phase, flags...} — everything snapshot() takes
//
// Both are "a file" to the file select (a fresh one draws the starting three
// hearts, which is what ALttP's own new file shows). Only a PLAYED file is
// loadable, so `readSave()` — the function applySave() and saveTick() use —
// still means exactly what it always meant: a payload that can be put back.
//
// THE SCHEMA STAMP IS UNCHANGED AT 1, deliberately. `name` is an ADDED
// OPTIONAL field: a reader that has never heard of it ignores it and loads the
// same chapter it always did, which is the definition of a change that does not
// need a version bump. Bumping would have refused — and so destroyed the value
// of — every file already on a player's machine, for a field that costs six
// characters. What DOES still get refused, exactly as before, is a file whose
// `v` is not 1: older, newer or missing.
//
// MIGRATION. Builds before this one wrote ONE unnamed payload at
// `gearwind.ch1.save`. That file is MOVED into slot 1 (named WREN, after the
// courier who was playing it) the first time this module touches storage, and
// only into an EMPTY slot 1 — a machine that already has two files never loses
// one to a legacy key. If the legacy payload is unreadable it is left exactly
// where it is rather than deleted, because deleting a file we could not parse
// is the one outcome worse than ignoring it.
//
// PUBLIC API:
//   -- the file select --------------------------------------------------------
//   listSlots()               -> [describeSlot(1), describeSlot(2)]
//   describeSlot(i)           -> {slot,name,fresh,playable,place,maxHearts,
//                                 halves,cogs,sky,beat} | null
//   createSlot(i, name)       -> boolean  (NAME ENTRY finished)
//   eraseSlot(i) / clearSave(i) -> boolean  (ERASE confirmed)
//   slotUsed(i)               -> boolean, fresh files included
//   slotName(i)               -> string
//   titleSlots()              -> the rows the front end may show, or null
//   activeSlot() / setActiveSlot(i) / activeName()
//   describeSave()            -> describeSlot() of the slot being played
//   -- the chapter ------------------------------------------------------------
//   hasSave(i)                -> boolean, cheap, safe on a corrupt store
//   readSave(i)               -> validated LOADABLE payload | null
//   writeSave(game, i)        -> boolean          (manual save)
//   autosave(game, reason, i) -> boolean          (quiet, deduped, throttled)
//   applySave(game, data)     -> Promise<boolean> (the load)
//   saveTick(game)            -> called once a frame by GameFlow.update()
//   requestContinue(i)        -> the file select chose a played file
//   currentGame()             -> window.__gwGame, or null

import { quest, DEFAULT_FLAGS } from './quest.js';

// ---------------------------------------------------------------------------
// The files
// ---------------------------------------------------------------------------

/** Pre-slot builds wrote here. Read once, moved into slot 1, then retired. */
export const LEGACY_KEY = 'gearwind.ch1.save';
/** Kept under its old name so existing probes that import it still resolve. */
export const SAVE_KEY = LEGACY_KEY;

/** THE USER ASKED FOR TWO. Everything below is written off this constant. */
export const SLOTS = 2;

/** @param {number} i 1-based slot index */
export function slotKey(i) { return `gearwind.ch1.file${i}`; }

/**
 * Payload schema version. BUMP THIS whenever the shape below changes in a way
 * an older reader would MISREAD — not merely one it would not recognise. A file
 * whose `v` is not exactly this number is refused (the slot reads EMPTY, the
 * other slot is unaffected) rather than being fed to code that expects
 * different fields. An old save must cost the player a file, never a crash on
 * the first frame of the chapter.
 */
export const SCHEMA = 1;

/**
 * SIX CHARACTERS, which is what A Link to the Past allowed.
 *
 * It is also what the box measures out to. The file-select row draws the name
 * in the dialogue face starting at x=44, and the heart row starts at x=150; the
 * widest glyph in that face is 7px ink + 1px gap, so a six-character name can
 * reach 47px and ends at 91 — 59px clear of the hearts, with room for the
 * widest name a player can type and no truncation path to get wrong. NAME ENTRY
 * draws the same six at 2x on a 16px pitch: 96px, centred, inside a 216px
 * panel. Seven would still fit the row and would not fit the doubled display.
 */
export const NAME_MAX = 6;

/** Human-facing names for the place a file was left in. */
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
    s.setItem(LEGACY_KEY + '.probe', '1');
    s.removeItem(LEGACY_KEY + '.probe');
    if (!_migrated) migrate(s);
    return s;
  } catch (e) { return null; }
}

/**
 * THE ONE-FILE BUILD'S SAVE, MOVED RATHER THAN DROPPED.
 *
 * Runs once per page load, from inside store(), so every entry point — the file
 * select, an autosave, a probe — migrates before it reads. Three refusals, all
 * of which leave the legacy key exactly where it is:
 *   - nothing there;
 *   - there but unparseable (a file we cannot read is a file we must not
 *     delete);
 *   - slot 1 already occupied (a machine with two real files never loses one).
 */
let _migrated = false;
export function migrate(s) {
  _migrated = true;
  let raw;
  try { raw = s.getItem(LEGACY_KEY); } catch (e) { return false; }
  if (!raw) return false;
  let d;
  try { d = JSON.parse(raw); } catch (e) { return false; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return false;
  let occupied = true;
  try { occupied = !!s.getItem(slotKey(1)); } catch (e) { occupied = true; }
  if (occupied) return false;
  if (typeof d.name !== 'string' || !d.name) d.name = 'WREN';
  d.slot = 1;
  try {
    s.setItem(slotKey(1), JSON.stringify(d));
    s.removeItem(LEGACY_KEY);
  } catch (e) { return false; }
  return true;
}

/** Why the last read refused, for the debug overlay. Never shown to a player. */
export let lastRefusal = null;

/**
 * IS THERE A STORE AT ALL?
 *
 * The difference between "this slot is empty" and "this browser will not let me
 * write anything, ever" — Chrome with all cookies blocked, or Safari private
 * mode. The file select needs it because a refusal to CREATE a file is a dead
 * end otherwise: the row comes back EMPTY, A on it reopens NAME ENTRY, forever.
 * A 1993 cartridge with a dead save battery still let you play.
 */
export function storeAvailable() { return store() !== null; }


function clampSlot(i) {
  const n = Math.round(Number(i));
  return n >= 1 && n <= SLOTS ? n : 1;
}

/**
 * Read and VALIDATE one slot, WITHOUT requiring it to be loadable.
 *
 * Returns a fresh record (named, unplayed) or a played payload; null for no
 * store, no key, non-JSON, a non-object, or a wrong/absent schema stamp.
 * @returns {object|null}
 */
export function readSlot(i) {
  i = clampSlot(i);
  lastRefusal = null;
  const s = store();
  if (!s) { lastRefusal = 'no-storage'; return null; }
  let raw;
  try { raw = s.getItem(slotKey(i)); } catch (e) { lastRefusal = 'read-threw'; return null; }
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
  d.name = cleanName(d.name);
  _nameCache[i] = d.name;
  return d;
}

/** Is this record something applySave() can put back? */
function loadable(d) {
  if (!d) return false;
  if (!d.flags || typeof d.flags !== 'object') { lastRefusal = 'no-flags'; return false; }
  if (d.phase !== 'overworld' && d.phase !== 'dungeon') { lastRefusal = 'bad-phase'; return false; }
  if (d.phase === 'overworld' && (!d.ow || typeof d.ow.screen !== 'string')) {
    lastRefusal = 'no-screen'; return false;
  }
  if (d.phase === 'dungeon' && (!d.dg || typeof d.dg.room !== 'string')) {
    lastRefusal = 'no-room'; return false;
  }
  return true;
}

/**
 * The LOADABLE payload in a slot, or null. Same contract this function has
 * always had — a fresh (named but never played) file answers null here,
 * because there is nothing in it to put back.
 * @param {number} [i] defaults to the slot this sitting is playing
 */
export function readSave(i) {
  const d = readSlot(i === undefined ? _active : i);
  if (!d) return null;
  if (d.fresh) { lastRefusal = 'fresh-file'; return null; }
  return loadable(d) ? d : null;
}

/** Cheap "is there a loadable file". Safe on a corrupt or absent store. */
export function hasSave(i) { return readSave(i) !== null; }

/** Cheap "is there a file at all in that slot", fresh ones included. */
export function slotUsed(i) { return readSlot(i) !== null; }

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Last name seen per slot, so a write never has to invent one. */
const _nameCache = { 1: '', 2: '' };

/** Six characters, no control codes, no surrounding blanks. */
export function cleanName(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, NAME_MAX).trim();
}

export function slotName(i) {
  i = clampSlot(i);
  const d = readSlot(i);
  return (d && d.name) || _nameCache[i] || '';
}

// ---------------------------------------------------------------------------
// The slot the chapter is being played into
// ---------------------------------------------------------------------------

let _active = 1;

/**
 * WHY THIS DEFAULTS TO 1 RATHER THAN TO NOTHING.
 *
 * `?beat=` warps straight past the front end and `?scene=game&save=on` is what
 * the round-trip verification drives; neither goes through the file select, so
 * neither sets a slot. Defaulting to "no slot" would make those runs save
 * nowhere, silently — which is precisely the class of bug this file exists to
 * not have. Slot 1 is where the one-file build's save already lives, so a run
 * that never chose is a run playing the file it would have been playing before
 * slots existed.
 */
export function activeSlot() { return _active; }
export function setActiveSlot(i) {
  _active = clampSlot(i);
  _nameCache[_active] = slotName(_active) || _nameCache[_active] || '';
  return _active;
}

/** The name on the file this sitting is playing — for the SAVE panel header. */
export function activeName() { return slotName(_active); }

// ---------------------------------------------------------------------------
// The file select's view of a slot
// ---------------------------------------------------------------------------

/**
 * ONE ROW OF THE FILE SELECT.
 *
 * ALttP's file select prints the file's NAME and its HEART ROW, and that is the
 * whole status readout — so those are the two fields that matter here. `place`,
 * `cogs` and `beat` come along because the SAVE panel and the debug overlay
 * want them; the row does not draw them.
 *
 * A FRESH file reports the chapter's starting life (DEFAULT_FLAGS: three
 * hearts, six halves) so a just-named file draws three full hearts, exactly as
 * a new ALttP file draws three.
 */
export function describeSlot(i) {
  i = clampSlot(i);
  const d = readSlot(i);
  if (!d) return null;
  if (d.fresh || !loadable(d)) {
    return {
      slot: i, name: d.name || '', fresh: true, playable: false,
      place: '', maxHearts: DEFAULT_FLAGS.maxHearts, halves: DEFAULT_FLAGS.halves,
      cogs: 0, sky: 0, beat: 0,
    };
  }
  const f = d.flags || {};
  const place = d.phase === 'dungeon'
    ? 'THE BOILERWORKS ' + String((d.dg && d.dg.room) || '')
    : (PLACE[d.ow && d.ow.screen] || 'BELLOWS ISLE');
  return {
    slot: i,
    name: d.name || '',
    fresh: false,
    playable: true,
    place,
    maxHearts: Math.max(1, Math.round(f.maxHearts || 3)),
    halves: Math.max(0, f.halves | 0),
    cogs: Math.max(0, f.cogs | 0),
    sky: f.skyStage | 0,
    beat: f.beat | 0,
  };
}

/** Both rows, in order. Entries are null for "- EMPTY -". */
export function listSlots() {
  const out = [];
  for (let i = 1; i <= SLOTS; i++) out.push(describeSlot(i));
  return out;
}

/** Back-compat: the one-line summary of the slot being played. */
export function describeSave(i) { return describeSlot(i === undefined ? _active : i); }

/**
 * NAME ENTRY finished. Writes a fresh, unplayed, NAMED file into the slot.
 * Refuses a blank name and refuses to overwrite an occupied slot — the file
 * select only ever offers NAME ENTRY on a slot it has already read as empty,
 * so the second guard is belt to that braces.
 */
export function createSlot(i, name) {
  i = clampSlot(i);
  const nm = cleanName(name);
  if (!nm) return false;
  const s = store();
  if (!s) return false;
  if (readSlot(i)) return false;
  try {
    s.setItem(slotKey(i), JSON.stringify({ v: SCHEMA, t: Date.now(), slot: i, name: nm, fresh: true }));
    _nameCache[i] = nm;
    return true;
  } catch (e) { return false; }
}

/**
 * ERASE. Removes ONE slot's key and nothing else — the other slot is not read,
 * not rewritten and not touched.
 */
export function eraseSlot(i) {
  i = clampSlot(i);
  const s = store();
  if (!s) return false;
  try { s.removeItem(slotKey(i)); } catch (e) { return false; }
  _nameCache[i] = '';
  if (_active === i) { _lastKey = null; }
  return true;
}

/** Back-compat name for eraseSlot. */
export function clearSave(i) { return eraseSlot(i === undefined ? _active : i); }

/**
 * WHAT THE FRONT END IS ALLOWED TO SHOW.
 *
 * `?bot=play` drives the front end by pressing A, so a bot run would walk into
 * the file select and sit on an empty row forever; `?beat=` warps past the
 * front end entirely with a hand-built flag set. Both therefore get the
 * pre-slot front door: PRESS START straight into the intro, no files, no
 * autosave. `&save=on` forces the files back, which is what the round-trip
 * verification uses.
 *
 * @returns {Array|null} the two rows, or null for "this run has no file select"
 */
export function titleSlots() {
  try {
    const p = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    if (p.get('save') === 'off') return null;
    // `bot` is unconditional: the autopilot presses A and nothing else, so it
    // cannot type a name, and a bot run parked on an empty file row is a run
    // that never reaches the chapter. `&save=on` still turns AUTOSAVE back on
    // for it (see autosaveAllowed) — which is what a round-trip probe needs —
    // it just does not ask the bot to read a menu.
    if (p.has('bot')) return null;
    if (p.get('save') !== 'on' && p.has('beat')) return null;
  } catch (e) { /* no location: headless module test */ }
  return listSlots();
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
    // `name` and `slot` are stamped in by the writer (writeSave/autosave), the
    // only place that knows which file this run belongs to.
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
 * Stamp the file's identity onto a snapshot. The name is read back out of the
 * slot rather than carried in a variable, so a save can never rename a file: it
 * writes back whatever NAME ENTRY put there, and only falls through to the
 * cache if the slot has somehow been erased under a running game.
 */
function stamp(d, i) {
  d.slot = i;
  d.name = slotName(i) || _nameCache[i] || '';
  return d;
}

/**
 * Manual save. Returns false — and writes nothing — rather than throwing, at
 * every step: no store, nothing worth saving, a quota error.
 * @param {number} [i] slot; defaults to the one this sitting is playing
 */
export function writeSave(game, i) {
  i = clampSlot(i === undefined ? _active : i);
  const s = store();
  if (!s) return false;
  const d = snapshot(game);
  if (!d) return false;
  stamp(d, i);
  try {
    s.setItem(slotKey(i), JSON.stringify(d));
    lastWrite = { t: d.t, phase: d.phase, reason: 'manual', slot: i, name: d.name };
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
export function autosave(game, reason, i) {
  i = clampSlot(i === undefined ? _active : i);
  const s = store();
  if (!s) return false;
  const frame = (game.engine && game.engine.frame) || 0;
  if (frame - _lastAutoFrame < AUTOSAVE_GAP) return false;
  const d = snapshot(game);
  if (!d) return false;
  stamp(d, i);
  try {
    s.setItem(slotKey(i), JSON.stringify(d));
    _lastAutoFrame = frame;
    lastWrite = { t: d.t, phase: d.phase, reason: reason || 'auto', slot: i, name: d.name };
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
let _pendingSlot = 1;

/**
 * Called by the FILE SELECT when the player chooses a played file.
 * @param {number} [slot]
 */
export function requestContinue(slot) {
  if (slot !== undefined) setActiveSlot(slot);
  _pendingSlot = _active;
  _pendingContinue = true;
}
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
 *
 * The active slot is IN the key: switching files inside one page load (finish a
 * chapter, come back to the file select, pick the other file) must count as a
 * beat, or the first thing that happens in file 2 is compared against file 1's
 * key and dropped.
 */
function beatKey(game, q) {
  const f = q.flags;
  const where = game.flow.phase === 'dungeon'
    ? 'D:' + (game.dg ? game.dg.curId : '?')
    : 'O:' + (game.ow && game.ow.world && game.ow.world.screen ? game.ow.world.screen.id : '?');
  const cleared = game.dg && game.dg.cur && game.dg.cur.cleared ? 1 : 0;
  return [
    'S' + _active,
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
 *  1. drains a CONTINUE that the file select asked for, once the chapter has
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
  // The file select cannot load: startChapter() may defer the handover while
  // the overworld is still being built, and a save in the Boilerworks has to
  // wait on an async makeDungeon(). So the choice is recorded and drained here,
  // on the first frame the chapter is actually holding the phase — and the
  // curtain is held BLACK across the load, because a frame of the dock showing
  // through before the file lands is the worst possible first impression of a
  // save system.
  if (_pendingContinue) {
    if (phase !== 'front' && !game._booting && game.ow && game.ow.world) {
      _pendingContinue = false;
      const d = readSave(_pendingSlot);
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

  // Back at the front end — between runs. Forget the beat key, so the first key
  // of the NEXT run counts as the run starting rather than as a beat: without
  // this, choosing a fresh file after a chapter card would overwrite it on the
  // very first screen the player walked onto, before he had done anything worth
  // recording.
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

const API = {
  SAVE_KEY, LEGACY_KEY, SLOTS, SCHEMA, NAME_MAX, slotKey,
  hasSave, slotUsed, readSave, readSlot, describeSave, describeSlot, listSlots,
  titleSlots, createSlot, eraseSlot, clearSave, slotName, cleanName,
  activeSlot, setActiveSlot, activeName,
  writeSave, autosave, applySave, snapshot, saveTick, resetTick,
  requestContinue, continuePending, currentGame, setSaveMenu, getSaveMenu,
  get lastRefusal() { return lastRefusal; },
  get lastWrite() { return lastWrite; },
};

// Published for probes and the debug overlay. Read-only from the game's side.
try { if (typeof window !== 'undefined') window.__gwSave = API; } catch (e) { /* headless */ }

export default API;
