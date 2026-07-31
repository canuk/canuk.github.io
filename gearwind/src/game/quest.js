// Gearwind — Chapter 1 quest state.
//
// One small observable flag store. Everything that has to survive a screen
// change, a room change or a scene swap lives here: what Wren is carrying,
// what he has been told, which bush he already cut, how far the isle has
// fallen. The overworld, the dungeon and the integration scene all talk to
// the SAME instance (`quest`), so nothing has to be threaded through
// constructors.
//
// WHY AN EVENT BUS: the sky stage and the lurch are consequences of story
// beats, not of a timer (STORY.md: "It is not a real timer ... It advances on
// story beats"). So a beat is fired here, and whoever owns the sky (the
// scene) subscribes and reacts. That keeps the flag store free of any
// rendering knowledge and lets the dungeon reuse it verbatim.
//
//   import { quest, BEATS } from './quest.js';
//   quest.on('beat',  (id) => ...);
//   quest.on('lurch', ({ power, frames }) => transitions.lurch({ power, frames }));
//   quest.on('sky',   (stage) => sky.setStage(stage));
//   quest.on('flag',  ({ name, value }) => ...);
//   quest.beat('cogblade');            // advances the sky, fires a lurch

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

/** Initial Chapter 1 state. Anything not listed here is `undefined` = falsy. */
export const DEFAULT_FLAGS = {
  // --- items
  hasCogblade: false,
  hasBoilerKey: false,
  hasBellowsCuff: false,
  hasSecondWind: false,
  // --- people
  talkedToPell: false,
  talkedToMarla: false,
  talkedToTam: false,
  talkedToHesper: false,
  // --- world
  sawFirstLurch: false,
  gateOpen: false,
  leftTheDock: false,
  reachedBoilerworks: false,
  // --- counters
  cogs: 0,
  smallKeys: 0,
  bigKey: false,
  maxHearts: 3,
  halves: 6,            // health in half-hearts (3 hearts = 6)
  heartPieces: 0,       // 4 pieces = one container
  // --- the fall
  skyStage: 0,          // 0..4, indexes skystate.STAGES
  beat: 0,              // highest story beat reached
};

/**
 * Story beats, in order. Each names the sky stage the isle has fallen to by
 * the time the beat fires, and whether the isle lurches on it.
 * `once: true` beats never re-fire.
 */
export const BEATS = {
  // 1. Cold open — Pell's line lands, then the horizon tilts.
  dockLurch:    { n: 1, sky: 1, lurch: { power: 5, frames: 34, dust: 'ground' } },
  // 2. Marla hands over the Cogblade.
  cogblade:     { n: 2, sky: 1, lurch: null },
  // 3. Wren leaves the village for the bridge road.
  traverse:     { n: 3, sky: 2, lurch: { power: 4, frames: 28, dust: 'ground' } },
  // 3b. The Boiler Key turns in the gear-gate.
  gate:         { n: 4, sky: 2, lurch: null },
  // 4. Down the Boilerworks mouth.
  boilerworks:  { n: 5, sky: 3, lurch: { power: 4, frames: 30, dust: 'ceiling' } },
  // 4b. The Bellows Cuff.
  cuff:         { n: 6, sky: 3, lurch: null },
  // 5. The boiler hall door opens.
  bossDoor:     { n: 7, sky: 4, lurch: { power: 5, frames: 32, dust: 'ceiling' } },
  // 6. The shard goes into the cradle.
  shard:        { n: 8, sky: 4, lurch: null },
};

// ---------------------------------------------------------------------------
// Quest
// ---------------------------------------------------------------------------

export class Quest {
  constructor(init = {}) {
    this.flags = { ...DEFAULT_FLAGS, ...init };
    /** Per-object "already done" marks: `${screen}:${kind}:${c},${r}`. */
    this.marks = new Set();
    this._subs = new Map();
    this._fired = new Set();
  }

  // --- flags ----------------------------------------------------------------

  get(name) { return this.flags[name]; }
  has(name) { return !!this.flags[name]; }

  /** Set a flag. Emits `flag` (and a per-name event) only when it changes. */
  set(name, value = true) {
    if (this.flags[name] === value) return value;
    const prev = this.flags[name];
    this.flags[name] = value;
    this.emit('flag', { name, value, prev });
    this.emit(`flag:${name}`, value);
    return value;
  }

  /** Add to a numeric flag (cogs, keys, heart pieces). Returns the new value. */
  add(name, amount) {
    const v = (this.flags[name] || 0) + amount;
    this.flags[name] = v;
    this.emit('flag', { name, value: v, prev: v - amount });
    this.emit(`flag:${name}`, v);
    return v;
  }

  // --- currency / health convenience ---------------------------------------

  addCogs(n) {
    const v = Math.max(0, Math.min(999, (this.flags.cogs || 0) + n));
    this.flags.cogs = v;
    this.emit('flag', { name: 'cogs', value: v });
    this.emit('cogs', v);
    return v;
  }

  spendCogs(n) {
    if ((this.flags.cogs || 0) < n) return false;
    this.addCogs(-n);
    return true;
  }

  get maxHalves() { return this.flags.maxHearts * 2; }

  /** Heal in half-hearts; `n` may be fractional hearts * 2. Clamped. */
  heal(halves) {
    const v = Math.min(this.maxHalves, this.flags.halves + halves);
    if (v === this.flags.halves) return false;
    this.flags.halves = v;
    this.emit('health', v);
    return true;
  }

  /** Damage in half-hearts. Returns true if Wren is down. */
  damage(halves) {
    this.flags.halves = Math.max(0, this.flags.halves - halves);
    this.emit('health', this.flags.halves);
    return this.flags.halves <= 0;
  }

  /** Four pieces make a container. Returns true when a heart was gained. */
  addHeartPiece() {
    const p = this.flags.heartPieces + 1;
    if (p >= 4) {
      this.flags.heartPieces = 0;
      this.flags.maxHearts += 1;
      this.flags.halves = this.maxHalves;
      this.emit('heart-container', this.flags.maxHearts);
      this.emit('health', this.flags.halves);
      return true;
    }
    this.flags.heartPieces = p;
    this.emit('heart-piece', p);
    return false;
  }

  /** Whole heart container (boss drop). */
  addHeartContainer() {
    this.flags.maxHearts += 1;
    this.flags.halves = this.maxHalves;
    this.emit('heart-container', this.flags.maxHearts);
    this.emit('health', this.flags.halves);
  }

  // --- one-shot marks (cut bushes, opened chests, smashed pots) -------------

  markKey(screen, kind, c, r) { return `${screen}:${kind}:${c},${r}`; }
  marked(screen, kind, c, r) { return this.marks.has(this.markKey(screen, kind, c, r)); }
  mark(screen, kind, c, r) { this.marks.add(this.markKey(screen, kind, c, r)); }
  unmark(screen, kind, c, r) { this.marks.delete(this.markKey(screen, kind, c, r)); }

  /** Bushes and pots grow back on re-entry; chests and pickups never do. */
  clearRespawnable() {
    for (const k of [...this.marks]) {
      if (k.includes(':bush:') || k.includes(':pot:')) this.marks.delete(k);
    }
  }

  // --- story beats ----------------------------------------------------------

  /**
   * Fire a story beat. Advances `beat`, pushes the sky forward, and asks for a
   * lurch. Safe to call repeatedly — a beat only ever fires once.
   */
  beat(id, opts = {}) {
    const b = BEATS[id];
    if (!b) throw new Error('unknown beat: ' + id);
    if (this._fired.has(id)) return false;
    this._fired.add(id);
    this.flags.beat = Math.max(this.flags.beat, b.n);
    this.emit('beat', id);
    if (b.sky !== undefined && b.sky > this.flags.skyStage) this.setSky(b.sky);
    const l = opts.lurch === undefined ? b.lurch : opts.lurch;
    if (l) this.lurch(l);
    return true;
  }

  beatFired(id) { return this._fired.has(id); }

  setSky(stage) {
    if (stage === this.flags.skyStage) return;
    this.flags.skyStage = stage;
    this.emit('sky', stage);
  }

  /** Shake the isle. The scene decides what that looks like. */
  lurch(opts = {}) {
    this.emit('lurch', { power: 4, frames: 28, dust: 'ground', ...opts });
  }

  // --- events ---------------------------------------------------------------

  on(evt, fn) {
    if (!this._subs.has(evt)) this._subs.set(evt, new Set());
    this._subs.get(evt).add(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) {
    const s = this._subs.get(evt);
    if (s) s.delete(fn);
  }

  emit(evt, payload) {
    const s = this._subs.get(evt);
    if (!s) return;
    for (const fn of [...s]) fn(payload);
  }

  // --- lifecycle ------------------------------------------------------------

  /** Wipe back to the top of the chapter (used by the scene's ?reset param). */
  reset(init = {}) {
    this.flags = { ...DEFAULT_FLAGS, ...init };
    this.marks.clear();
    this._fired.clear();
    this.emit('reset', this.flags);
  }

  /** Plain snapshot — handy for debugging overlays and for the capture tool. */
  snapshot() {
    return { ...this.flags, beats: [...this._fired], marks: this.marks.size };
  }
}

/** The chapter's single store. Import this, not a new Quest. */
export const quest = new Quest();
export default quest;
