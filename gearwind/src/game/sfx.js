// Gearwind sound-effect bank — Chapter 1.
//
// Everything here is synthesized in Web Audio in an SPC700 idiom: short,
// hard-shaped envelopes (exponential attack, exponential decay to silence —
// never a slow fade), a handful of band-limited pulse waves, one deterministic
// noise buffer, and a send into the SAME global echo bus the music uses
// (audio.js ChipEngine) so effects sit in the same room as the score.
//
// Nothing here edits audio.js — it borrows the ChipEngine's waves, noise
// buffer, master chain and echo bus.
//
// FIVE RULES THIS FILE ENFORCES ON ITSELF. All five are machine-checked and
// each has its own non-zero exit:
//   node tools/render-sfx.js             rules #2 and #3   (exit 3)
//   node tools/render-sfx.js --mix       rules #1 and #5   (exit 4 / 5)
//   node tools/render-sfx.js --jitter    rule  #4          (exit 3)
//   node tools/render-sfx.js --mix --baseline    the same measurement at the
//                                        round-5 mix, for before/after
//   node tools/render-sfx.js --live      rule  #5, THE WIRING, in the real
//                                        dungeon scene: drives the shipped page
//                                        in headless Chrome and reads the
//                                        score's own channel gains while
//                                        effects fire                (exit 5)
//   node tools/render-sfx.js --levels    rule  #1, THE CONSEQUENCE, in the
//                                        real ?scene=game: taps the live graph
//                                        with a ScriptProcessor (score buses on
//                                        one channel, the effects bus on the
//                                        other) and prints the same dB table
//                                        --mix prints, off audio that came out
//                                        of the game — twice, once as shipped
//                                        and once at the round-5 mix  (exit 6)
//   python3 tools/analyze-sfx.py shots/sfx       per-file duration/peak/decay
//
//   1. EFFECTS SIT ON TOP OF THE SCORE. This is the rule everything else
//      serves. `node tools/render-sfx.js --mix` renders the overworld theme
//      alone, the theme with only the voice stealing, and the theme with 33
//      effects fired at known times through the same ChipEngine, then takes
//      the linear difference (mix - stolenMusic = the effect, exactly) and
//      reports short-term RMS in each effect's 150 ms onset window against the
//      score in the SAME window — TWICE: full band, and through a 2-pole
//      200 Hz highpass, which is the small speaker the SNES was mixed for and
//      every laptop since.
//      THE SPEAKER NUMBER IS THE PASS/FAIL, and that is a deliberate choice
//      rather than the easier one. An effect that only wins full band is
//      winning on bass the player cannot hear — but the converse is just as
//      true, and it took a live measurement to admit it: `swing`, `clink` and
//      `snuff` put 100%, 100% and 99% of their energy above 250 Hz by design,
//      so against a score with a tribass line they can sit 0.2 dB under it
//      full band while standing +5 to +6 dB over it in every speaker a player
//      owns. Failing them for that would be failing them for not having bass
//      the sound is not supposed to have. So: combat, pickup and world effects
//      must land at or above the score THROUGH THE SPEAKER, and full band is
//      still bounded at -3 dB so nothing can hide behind the highpass. UI
//      blips get 6 dB of slack in the 150 ms window (they are shorter than it)
//      and none at all in a window their own length.
//      Two mechanisms get them there, both static or spectral, NEITHER a
//      compressor: MUSIC_TRIM (the score is mixed 7.5 dB lower, once, at
//      registration) and per-sound `steal` = how many music voices the effect
//      takes off the score for its body, the SPC700 driver's actual behaviour.
//      Round 6's broadband master duck is gone; see VOICE STEALING.
//      MEASURED IN THE SHIPPED GAME (`--levels`, ?scene=game, one AudioContext,
//      33 effects x 3 firings each against the real transport, median of the
//      three — live the score is wherever it is, and landing on a bar rest
//      instead of a downbeat is worth several dB):
//        round-5 mix   median -14.3 dB full band, -10.4 dB speaker, 33/33 under
//        as shipped    median  +2.0 dB full band,  +5.9 dB speaker,  0/33 under
//      i.e. +17.1 dB mean through the small speaker, and the worst effect in
//      the bank is now +3.0 dB over the score instead of -18.7 dB under it.
//      Both rows come out of the SAME live page: the second pass untrims the
//      score, puts the bus back to 0.85 and turns the stealing off, so the
//      before is a measurement and not a quotation of an old critique.
//   2. VOICE BUDGET. The SPC700 has 8 voices and the score already eats 5-6.
//      Every entry declares `vox` = its peak simultaneous voice count; the
//      renderer measures the real overlap and fails if the declaration lies
//      or if any effect exceeds MAX_VOX. Live playback holds the whole bank
//      to VOICE_BUDGET concurrent voices, not "8 sounds", and STEALS from the
//      oldest effect rather than refusing the newest — the SPC700 driver's
//      behaviour, and the reason the third cog of a bush drop still sounds.
//   3. THE PUNCH IS AT THE FRONT. A world sound is one gesture, not
//      "creak ... (hole) ... BANG". Non-swell effects must reach 90% of their
//      peak inside 120 ms of the trigger, and no effect may contain a >40 ms
//      near-silent hole before its peak. Both are measured by render-sfx.js on
//      a 3 ms RMS ENVELOPE, not on raw samples: a raw-sample test is satisfied
//      by any noise burst in ~1 ms and therefore checks nothing.
//   4. NOTHING FATIGUES. Repeated effects carry real pitch jitter (`rand`, in
//      cents) and a retrigger cooldown (`minGap`). Jitter reaches NOISE voices
//      too — `noise()` shifts its filter centre by the same cents — so it
//      moves the loudest voice of a noise-dominant effect, not a -16 dB
//      passenger.
//   5. THE FIX IS IN THE GAME, NOT IN THE HARNESS. Round 6 passed rule #1 in
//      the renderer and failed it in the dungeon, because the score plays on a
//      ChipEngine this file had never heard of. Nothing here may depend on
//      being handed the music engine: ChipEngine.prototype.scheduleSong is
//      wrapped so EVERY engine that plays a song registers itself, whatever
//      context it is on, whenever it is built. `--live` fails (exit 5) if the
//      live dungeon's music rig is not registered, not trimmed, and not
//      audibly stolen from when an effect fires, and `--levels` fails (exit 6)
//      if ?scene=game ends up with more than ONE AudioContext or if the effects
//      do not measure over the score coming out of it.
//
// ---------------------------------------------------------------------------
// WIRING IT INTO THE GAME  (API for the integration agent)
// ---------------------------------------------------------------------------
//   import { sfx } from './game/sfx.js';
//
//   sfx.play('cog');            // that is the whole required integration.
//
// ZERO SETUP IS THE SUPPORTED PATH. Importing this module installs
// `window.__gwSfx` (the hook transition.js, items.js, boss-kettleback.js and
// world/*.js already call) and arms a first-gesture unlock, and the bank ADOPTS
// whatever ChipEngine the score is already playing on — gameflow.ChapterMusic
// builds its own AudioContext and never publishes it, and it is still found,
// because ChipEngine.prototype.scheduleSong is wrapped and every engine that
// plays a song registers itself. Verified in the shipped ?scene=game:
// 1 AudioContext, sfx.ctx === the score's ctx (`--levels`).
//
// The explicit entry points, in the order you should prefer them:
//
//   sfx.attach(chipEngine)   share an existing ChipEngine outright — one echo
//                            bus, one master, one context. Returns the bank.
//   sfx.useContext(ctx)      you own the AudioContext but not a ChipEngine:
//                            the bank builds one ON YOUR CONTEXT rather than
//                            opening a second one. Also fine to call before any
//                            music exists — later engines on that context are
//                            picked up automatically.
//   sfx.unlock()             no argument: adopt a registered score engine if
//                            there is one, otherwise create a context. Must run
//                            inside a user gesture; install() already arms this
//                            on the first pointer/key event.
//   sfx.attachDialog(dialog) dialog.js text blips + menu cursor/confirm. Done
//                            automatically via DialogBox.prototype; call it
//                            only if you want an explicit override.
//
// NEVER construct an AudioContext for effects yourself. Two contexts is the
// round-6 defect: the score plays on one and the effects mix against silence on
// the other.
//
// Offline render (tools/render-sfx.js):
//   const bank = new SfxBank(new ChipEngine(offlineCtx));
//   bank.play('cog', { time: 0.05, rand: 0 });
//
// play() is always safe to call: before init, while suspended, over the
// polyphony cap, or with an unknown name — it just returns false.

import { ChipEngine, freq, midi } from './audio.js';

const n = (name) => freq(midi(name)); // 'bb4' -> Hz

// Concurrent voices the whole effects bank may hold. The SPC700's 8 minus the
// score's lead/horn/arp/bass/drums, plus a little slack because effects decay
// past each other rather than sustaining.
export const VOICE_BUDGET = 8;
// No single effect may need more than this at once.
export const MAX_VOX = 5;

// ---------------------------------------------------------------------------
// THE MIX  (rule #1)
// ---------------------------------------------------------------------------
// Effects DO NOT share the music's master gain. They tap into the ChipEngine
// one node later, straight onto `chip.masterLP` — the 9 kHz "gaussian
// interpolation" lowpass that band-limits everything — so they still sound
// like they came off the same chip but their level is not tied to the score's.
//
//   music channel buses -> [TRIM x STEAL] -> chip.master -> chip.masterLP -> out
//   effects        --------------------------------------> chip.masterLP -> out
//   effect echo sends -> chip.echoIn -> ... -> chip.master
//
// TWO numbers put the effects over the score, and NEITHER of them is a
// broadband compressor:
//
//   MUSIC_TRIM  the score is simply MIXED LOWER. Every music channel bus of
//               every ChipEngine that ever schedules a song is scaled by this
//               once, at registration, and never touched again. A static mix
//               decision, the one a music director makes; it is not level-
//               dependent, not triggered, and it does not pump.
//   SFX_BUS     the bank's absolute trim, on top of the per-sound peak-levelling
//               `gain` values (each measured off a rendered WAV).
//
// Round 6 put a gain node across the MUSIC MASTER and pulled it down 5-13 dB
// for the length of every effect. Two things were wrong with that. It was
// installed on the sfx bank's own ChipEngine, which in the shipped game is a
// different AudioContext from the one the score plays on — so it ducked
// silence, and the "as heard" table was a number no player ever got. And it
// was a modern sidechain: correlating the ducked score against the clean one
// gave r = 1.00000 with a 0.004% spectral shift, i.e. one scalar on every
// voice, held 10.8 dB down for 100% of a combat window. Both are gone. See
// VOICE STEALING below for what replaced it.
export const SFX_BUS = 2.42;
// The score, mixed under the effects. 7.5 dB. Applied per CHANNEL BUS, not on
// the master, so the score's own echo sends (which tap the channel bus) come
// down with it and the effects' echo return does not.
export const MUSIC_TRIM_DB = 7.5;
let MUSIC_TRIM = Math.pow(10, -MUSIC_TRIM_DB / 20);
/**
 * Harness only (tools/render-sfx.js --baseline): render the round-5 mix, where
 * the score was untrimmed, so the before/after in the report is a measurement
 * and not a quotation. Applies to rigs registered AFTER the call.
 */
export function setMusicTrim(db) { MUSIC_TRIM = Math.pow(10, -db / 20); }
// The echo sends tap PRE-bus (off each sound's dry node, straight into
// chip.echoIn), so raising the dry bus would otherwise have made the whole
// bank drier by accident. ECHO_COMP puts most of that back — not all of it,
// deliberately, because the transient is what has to read through the score
// and the wash is the score's job.
const ECHO_COMP = 2.04;

// ---------------------------------------------------------------------------
// VOICE STEALING  (rule #1's mechanism)
// ---------------------------------------------------------------------------
// The SPC700 has eight voices. There is no mixer, no ducker and no sidechain
// in a real SNES driver: when an effect needs a voice, the driver TAKES one
// off the music and gives it back when the effect is done. That is why the
// arpeggio drops out of ALttP's overworld theme when you swing the sword, and
// it is a completely different artefact from turning the score down — one
// instrument disappears and the spectrum changes, the rest of the mix does
// not move at all.
//
// So that is what happens here. Every entry declares `steal` = how many music
// voices it occupies. The bank walks the registered rigs' channel buses in
// steal-priority order (filler first, tune last, bass never) and gates that
// many of them to silence for the body of the effect.
//
// MEASURED CONSEQUENCES, against the round-6 master duck, on the same scripts
// the critic used, in the arpeggio section of the theme (bar 9+, because ARP is
// the first channel taken and it is tacet for the opening phrase — measuring
// bars 1-8 flatters this by ~1.5 dB). `node tools/render-sfx.js --mix` prints
// the two PACE lines and fails if either drifts back toward a ducker:
//
//                          round-6 master duck        voice stealing now
//   40 triggers in 3 s     -10.8 dB, 100% of frames   -0.12 dB avg, worst -3.1
//   a sword every 0.45 s   -3.6 dB avg, >9 dB 35%     -0.07 dB avg, worst -2.8
//   correlation w/ clean   r = 1.00000                r = 0.812 (min 0.593)
//   spectral centroid      shifts 0.004%              shifts 62% (max 88%)
//
// That is the difference between turning the score down and taking a voice off
// it: the level barely moves and the timbre changes completely, which is what
// an SPC700 driver sounds like and what a sidechain never sounds like.
const STEAL_ATTACK = 0.005;   // the voice is gone in 5 ms
const STEAL_RELEASE = 0.045;  // and comes back in 45; longer would be a fade
const STEAL_MAX_HOLD = 0.42;
// Taken 12 ms BEFORE the effect's voices: the driver has to have the voice in
// hand before it can key the effect on it.
const STEAL_LEAD = 0.012;
// Which channel goes first. Names come from the song spec (audio.js and
// world/boilerworks-music.js): ARP/TICK are filler figures, PAD is a wash,
// DRUM is percussion, HORN/STAB are harmony, LEAD is the tune. BASS is ranked
// so high it is never reached — losing the root is the one thing that makes a
// score sound broken rather than busy.
const STEAL_RANK = { ARP: 0, TICK: 0, PAD: 1, DRUM: 2, STAB: 3, HORN: 3, LEAD: 6, BASS: 20 };
function stealRank(name) {
  const k = String(name || '').toUpperCase();
  return STEAL_RANK[k] != null ? STEAL_RANK[k] : 4;
}

// ---------------------------------------------------------------------------
// FINDING THE SCORE  (the round-6 defect this file shipped)
// ---------------------------------------------------------------------------
// src/scenes/dungeon.js builds a DungeonMusic, which opens its OWN
// AudioContext and its own ChipEngine per track and publishes nothing. Round 6
// only looked for window.__gwChip, found nothing, built its own engine, and
// spliced its duck into a master that carried no music at all. Measured in the
// live dungeon: 2 AudioContexts, sfx.chip !== rig.chip, rig chip duck absent.
//
// The fix is one wrapper on ChipEngine.prototype.scheduleSong — audio.js is
// not edited, and no music module has to know this file exists. ANY engine
// that schedules a song, on any context, at any time, registers itself here;
// the trim is applied to its channel buses on the spot and every later effect
// steals from it. Late adoption is automatic because registration is driven by
// the music, not by us: DungeonMusic's boss rig is a second ChipEngine built
// minutes into the chapter and it is picked up the instant it starts playing.
const MUSIC_RIGS = [];

function registerMusicRig(chip, song) {
  if (!chip || chip.__gwRig) return chip ? chip.__gwRig : null;
  const buses = chip._buses;
  if (!buses || !buses.length) return null;
  const chans = (song && song.channels) || [];
  const rig = {
    chip,
    ctx: chip.ctx,
    offline: typeof chip.ctx.startRendering === 'function',
    voices: [],
  };
  buses.forEach((node, i) => {
    const spec = chans[i] || {};
    const base = (spec.gain != null ? spec.gain : node.gain.value) * MUSIC_TRIM;
    try { node.gain.value = base; } catch (e) { return; }
    rig.voices.push({
      node, base, name: spec.name || ('CH' + i), rank: stealRank(spec.name),
      t0: 0, from: base, hold: 0, end: -1,
    });
  });
  rig.voices.sort((a, b) => a.rank - b.rank);
  chip.__gwRig = rig;
  MUSIC_RIGS.push(rig);
  // so a bank that has not initialised yet adopts the SCORE's engine rather
  // than opening a second AudioContext
  if (typeof window !== 'undefined' && !window.__gwChip && !rig.offline) window.__gwChip = chip;
  return rig;
}

function hookChipEngine() {
  const P = ChipEngine && ChipEngine.prototype;
  if (!P || P.__gwSfxHooked) return;
  P.__gwSfxHooked = true;
  const orig = P.scheduleSong;
  P.scheduleSong = function (song, t0, loops) {
    const r = orig.call(this, song, t0, loops);
    try { this.__gwSong = song; registerMusicRig(this, song); } catch (e) { /* never break the music */ }
    return r;
  };
}
hookChipEngine();

/** Every music rig the bank knows about. Diagnostics + tools/render-sfx.js. */
export function musicRigs() { return MUSIC_RIGS.slice(); }
// Soft-clip curve on the effects bus. Linear below 0.55, tanh above it, hard
// ceiling 0.893 — an analogue output stage, which is what the SNES actually
// had after its DAC. It exists because voices inside one effect occasionally
// align: `select` renders at peak 0.46 on its own, but at one instant in the
// 40 s mix its noise tick and its lead pulse lined up for TWO SAMPLES at 1.07
// and clipped. That is a click, not level. Below 0.55 the curve is the
// identity; a 0.72 peak comes out at 0.712, i.e. 1.1% down, so nothing in the
// bank is being squashed to get here.
const CLIP_KNEE = 0.55;
function softClipCurve(n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    c[i] = a <= CLIP_KNEE ? x
      : Math.sign(x) * (CLIP_KNEE + (1 - CLIP_KNEE) * Math.tanh((a - CLIP_KNEE) / (1 - CLIP_KNEE)));
  }
  return c;
}
// Live triggers are therefore scheduled a frame ahead instead of 5 ms ahead,
// which also keeps Web Audio from ever being handed a time in the past.
const TRIGGER_LEAD = 0.02;

// ---------------------------------------------------------------------------
// SfxBank — voice primitives + the bank
// ---------------------------------------------------------------------------

export class SfxBank {
  constructor(chip, opts = {}) {
    this.chip = chip;
    this.ctx = chip.ctx;
    this.offline = typeof this.ctx.startRendering === 'function';
    this.volume = opts.volume != null ? opts.volume : 1;

    // Dry bus for all effects. See SFX_BUS: this lands on the ChipEngine's
    // master lowpass, past the music's channel mixer, so nothing that happens
    // to the score can pull an effect down with it.
    this.out = this.ctx.createGain();
    this.out.gain.value = opts.busGain != null ? opts.busGain : SFX_BUS;
    this.limit = this.ctx.createWaveShaper();
    this.limit.curve = softClipCurve();
    this.limit.oversample = '2x';
    this.out.connect(this.limit);
    this.limit.connect(chip.masterLP || chip.master);

    // If this bank was handed the engine the score is already playing on,
    // register it now so the trim lands even if scheduleSong ran before we
    // existed (the harness path, and the live path where music starts first).
    if (chip && chip._buses && !chip.__gwRig) {
      try { registerMusicRig(chip, chip.__gwSong || null); } catch (e) { /* noop */ }
    }

    this._buses = new Map(); // id -> dry gain node
    this._active = [];       // {id, vox, end}
    this._last = new Map();  // id -> last start time
    this._seed = 0x9e3779b9;
    this._n = 0;
    this.log = false;        // renderer sets true to measure voice overlap
    this._log = [];
  }

  // deterministic PRNG so offline renders repeat exactly
  _rnd() {
    this._seed = (this._seed + 0x6d2b79f5) | 0;
    let t = Math.imul(this._seed ^ (this._seed >>> 15), 1 | this._seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // --- voice stealing -------------------------------------------------------
  // Rigs this bank may take voices from. Same-context rigs always (the offline
  // harness, and the live case where the score and the effects ended up on one
  // engine); live rigs on ANY other real AudioContext when we are live too —
  // that is the shipped two-context dungeon, and it is the case round 6 got
  // wrong. Finished OfflineAudioContexts are pruned, so an offline render can
  // never automate a graph that has already been rendered.
  _rigs() {
    const out = [];
    for (let i = MUSIC_RIGS.length - 1; i >= 0; i--) {
      const r = MUSIC_RIGS[i];
      let dead = false;
      try { dead = r.ctx.state === 'closed'; } catch (e) { dead = true; }
      if (dead) { MUSIC_RIGS.splice(i, 1); continue; }
      if (r.ctx === this.ctx) out.push(r);
      else if (!r.offline && !this.offline) out.push(r);
    }
    return out;
  }

  // Two AudioContexts have two clocks. An effect scheduled at `t` on ours has
  // to steal at the same WALL time on theirs, so the offset is re-read on
  // every trigger rather than cached — over a chapter the two hardware clocks
  // drift, and a 20 ms error would put the steal on the wrong side of the
  // transient.
  _clockOffset(ctx) {
    if (ctx === this.ctx) return 0;
    try { return ctx.currentTime - this.ctx.currentTime; } catch (e) { return 0; }
  }

  // Where a stolen channel's gain sits at time t, modelled in JS so
  // overlapping effects compose (the later release wins) instead of fighting
  // each other's ramps on the AudioParam.
  _voiceAt(v, t) {
    if (v.end < 0 || t >= v.end) return v.base;
    if (t <= v.t0) return v.from;
    if (t < v.t0 + STEAL_ATTACK) return v.from * (1 - (t - v.t0) / STEAL_ATTACK);
    if (t < v.t0 + STEAL_ATTACK + v.hold) return 0;
    return v.base * ((t - v.t0 - STEAL_ATTACK - v.hold) / STEAL_RELEASE);
  }

  _takeVoice(v, at, hold) {
    const t = Math.max(0, at - STEAL_LEAD);
    if (v.end >= 0 && t < v.t0) return false; // out-of-order: leave the graph alone
    const from = this._voiceAt(v, t);
    const g = v.node.gain;
    try {
      g.cancelScheduledValues(t);
      g.setValueAtTime(from, t);
      g.linearRampToValueAtTime(0, t + STEAL_ATTACK);
      g.setValueAtTime(0, t + STEAL_ATTACK + hold);
      g.linearRampToValueAtTime(v.base, t + STEAL_ATTACK + hold + STEAL_RELEASE);
    } catch (e) {
      return false;
    }
    v.t0 = t; v.from = from; v.hold = hold;
    v.end = t + STEAL_ATTACK + hold + STEAL_RELEASE;
    return true;
  }

  /**
   * Take `n` music voices for an effect of length `dur` starting at `at` (on
   * THIS bank's clock). Returns how many channel buses were actually gated.
   * Exposed so tools/render-sfx.js can render the score with the stealing and
   * WITHOUT the effects, which is what makes `mix - stolenMusic` equal the
   * effect exactly and the dB table honest.
   */
  steal(n, at, dur) {
    if (!(n > 0)) return 0;
    // the effect holds its voices for its body, not its tail: a 1.4 s boss
    // roar does not own a music channel for 1.4 s, it owns it for the burst
    const hold = STEAL_LEAD + Math.max(0.03, Math.min(STEAL_MAX_HOLD, (dur || 0.12) * 0.55));
    let took = 0;
    for (const rig of this._rigs()) {
      const t = at + this._clockOffset(rig.ctx);
      // never take the last channel: silence is not voice stealing
      const take = Math.min(n, Math.max(0, rig.voices.length - 1));
      for (let i = 0; i < take; i++) if (this._takeVoice(rig.voices[i], t, hold)) took++;
    }
    return took;
  }

  /** The voice steal an effect would apply, with no voices of its own. */
  stealOnly(id, opts = {}) {
    const key = resolve(id);
    const s = key && SOUNDS[key];
    if (!s) return 0;
    const t = opts.time != null ? opts.time : this.ctx.currentTime + 0.005;
    return this.steal(s.steal || 0, t, s.dur);
  }

  /** Live diagnostic: dB the score is currently down, worst channel. */
  stealDepthDb() {
    let worst = 0;
    for (const rig of this._rigs()) {
      for (const v of rig.voices) {
        if (!v.base) continue;
        let g = v.base;
        try { g = v.node.gain.value; } catch (e) { /* noop */ }
        const d = 20 * Math.log10(Math.max(g, 1e-4) / v.base);
        if (d < worst) worst = d;
      }
    }
    return worst;
  }

  /**
   * Live diagnostic: how many of the score's channels are held right now, and
   * how many exist to hold. src/scenes/sfx.js draws this as the STEAL meter —
   * the point being that the number that moves is a COUNT OF CHANNELS, not a
   * level in dB, because that is the mechanism.
   */
  stolenVoices() {
    let held = 0, total = 0;
    for (const rig of this._rigs()) {
      for (const v of rig.voices) {
        if (!v.base) continue;
        total++;
        let g = v.base;
        try { g = v.node.gain.value; } catch (e) { /* noop */ }
        if (g < v.base * 0.5) held++;
      }
    }
    return { held, total };
  }

  // Per-sound bus: dry -> pan -> master, plus a send into the global echo.
  _bus(id) {
    let b = this._buses.get(id);
    if (b) return b;
    const s = SOUNDS[id];
    const ctx = this.ctx;
    const dry = ctx.createGain();
    dry.gain.value = 1;
    const pan = this.chip._pan(s.pan || 0);
    dry.connect(pan);
    pan.connect(this.out);
    if (s.echo) {
      const send = ctx.createGain();
      send.gain.value = s.echo * ECHO_COMP;
      dry.connect(send);
      send.connect(this.chip.echoIn);
    }
    b = dry;
    this._buses.set(id, b);
    return b;
  }

  _osc(wave) {
    const o = this.ctx.createOscillator();
    if (this.chip.waves[wave]) o.setPeriodicWave(this.chip.waves[wave]);
    else o.type = wave;
    return o;
  }

  // Voice-overlap bookkeeping for tools/render-sfx.js. Entries carry the
  // trigger's gate so a stolen effect's voices stop counting when they are
  // stolen, which is what makes the measured `vox` the AUDIBLE voice count.
  _mark(t, dur, bus) { if (this.log) this._log.push([t, t + dur, bus]); }

  // --- voice: pitched -------------------------------------------------------
  // f -> to glide, exponential attack/decay, optional per-voice lowpass and
  // vibrato. Always ends at silence: every effect decays by construction.
  tone(bus, t, p) {
    const ctx = this.ctx;
    const dur = p.dur;
    const vel = Math.max(0.0004, (p.vel != null ? p.vel : 0.3) * this.volume);
    const a = Math.min(p.a != null ? p.a : 0.004, dur * 0.4);
    const hold = Math.min(p.hold || 0, Math.max(0, dur - a - 0.01));
    const o = this._osc(p.wave || 'duty50');
    if (p.detune) o.detune.value = p.detune;
    const fr = o.frequency;
    fr.setValueAtTime(Math.max(16, p.f), t);
    if (p.to) {
      const g0 = t + (p.glideAt || 0);
      const g1 = t + (p.glideEnd != null ? p.glideEnd : dur * (p.glide != null ? p.glide : 1));
      if (p.glideAt) fr.setValueAtTime(Math.max(16, p.f), g0);
      fr.exponentialRampToValueAtTime(Math.max(16, p.to), Math.max(g1, g0 + 0.005));
    }

    let node = o;
    if (p.lp) {
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(p.lp, t);
      if (p.lpTo) flt.frequency.exponentialRampToValueAtTime(Math.max(60, p.lpTo), t + dur);
      if (p.lpQ) flt.Q.value = p.lpQ;
      node.connect(flt);
      node = flt;
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0004, t);
    env.gain.exponentialRampToValueAtTime(vel, t + a);
    if (hold) env.gain.setValueAtTime(vel, t + a + hold);
    env.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    node.connect(env);
    env.connect(bus);

    if (p.vib) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = p.vib;
      const d = ctx.createGain();
      d.gain.setValueAtTime(0, t);
      d.gain.linearRampToValueAtTime(p.vibCents || 20, t + Math.min(0.25, dur * 0.4));
      lfo.connect(d);
      d.connect(o.detune);
      lfo.start(t);
      lfo.stop(t + dur + 0.02);
    }

    o.start(t);
    o.stop(t + dur + 0.02);
    this._mark(t, dur, bus);
    return t + dur;
  }

  // --- voice: filtered noise ------------------------------------------------
  // `detune` (cents) shifts the filter's centre frequency exactly the way it
  // shifts an oscillator's pitch. Without it, rule #4's pitch jitter would only
  // reach the quiet tonal passenger of a noise-dominant effect (swing, cuff,
  // hit, bush ...) and repeats would be near-identical where it matters.
  noise(bus, t, p) {
    const ctx = this.ctx;
    const dur = p.dur;
    const vel = Math.max(0.0004, (p.vel != null ? p.vel : 0.3) * this.volume);
    const a = Math.min(p.a != null ? p.a : 0.003, dur * 0.4);
    const hold = Math.min(p.hold || 0, Math.max(0, dur - a - 0.01));
    const k = p.detune ? Math.pow(2, p.detune / 1200) : 1;
    const src = ctx.createBufferSource();
    src.buffer = this.chip.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = p.type || 'bandpass';
    flt.frequency.setValueAtTime(Math.max(30, p.f * k), t);
    if (p.to) flt.frequency.exponentialRampToValueAtTime(Math.max(30, p.to * k), t + dur);
    if (p.Q != null) flt.Q.value = p.Q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0004, t);
    env.gain.exponentialRampToValueAtTime(vel, t + a);
    if (hold) env.gain.setValueAtTime(vel, t + a + hold);
    env.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    src.connect(flt); flt.connect(env); env.connect(bus);
    // deterministic but non-repeating noise phase per voice
    this._n = (this._n + 1) % 997;
    src.start(t, ((t * 7.137) + this._n * 0.0731) % 0.85);
    src.stop(t + dur + 0.02);
    this._mark(t, dur, bus);
    return t + dur;
  }

  // --- the public trigger ---------------------------------------------------
  // opts: { time, vel, rand (0..1 pitch-jitter scale), detune (cents override),
  //         now (override the clock so the live gate can be tested offline) }
  // Passing `time` bypasses gating entirely (that is the render path). Passing
  // `now` keeps gating on but supplies the clock, which is what lets
  // tools/render-sfx.js measure the cooldown/voice-budget behaviour in an
  // OfflineAudioContext, where currentTime never advances.
  play(id, opts = {}) {
    const key = resolve(id);
    const s = key && SOUNDS[key];
    if (!s) return false;
    const ctx = this.ctx;
    const now = opts.now != null ? opts.now : ctx.currentTime;
    const t = opts.time != null ? opts.time : now + TRIGGER_LEAD;

    // Every trigger gets its own gain between its voices and the sound's bus,
    // so an in-flight effect can actually be CUT when a more important one
    // needs its voices — the SPC700 driver's voice stealing, not a silent
    // refusal that eats the third cog of a bush drop.
    const gate = ctx.createGain();
    gate.gain.value = 1;
    gate.connect(this._bus(key));

    if (opts.time == null) {
      // live-only gating: retrigger cooldown, per-sound copies, voice budget
      const last = this._last.get(key);
      if (last != null && t - last < (s.minGap || 0.03)) return false;
      this._active = this._active.filter((v) => v.end > now && !v.dead);
      const mine = this._active.reduce((c, v) => c + (v.id === key ? 1 : 0), 0);
      if (mine >= (s.poly || 2)) return false;
      let busy = this._active.reduce((c, v) => c + v.vox, 0);
      if (busy + s.vox > VOICE_BUDGET) {
        // steal from the oldest non-priority effect first; a priority sound
        // (boss beat, death, fanfare) may steal from anything.
        const victims = this._active
          .filter((v) => !v.prio || s.prio)
          .sort((a, b) => a.t - b.t);
        for (const v of victims) {
          if (busy + s.vox <= VOICE_BUDGET) break;
          this._steal(v, now);
          busy -= v.vox;
        }
        this._active = this._active.filter((v) => !v.dead);
        if (busy + s.vox > VOICE_BUDGET) return false;
      }
      this._last.set(key, t);
      this._active.push({ id: key, vox: s.vox, prio: !!s.prio, t, end: t + s.dur, gate });
    }

    const randScale = opts.rand != null ? opts.rand : 1;
    const det = opts.detune != null
      ? opts.detune
      : (s.rand ? (this._rnd() * 2 - 1) * s.rand * randScale : 0);

    // Rule #1: take the voices this effect needs off the score before the
    // transient lands. Per-sound, because a dialog blip firing ten times a
    // second takes the arpeggio and nothing else, while Kettleback bursting
    // takes the tune as well.
    if (opts.steal !== false) this.steal(s.steal || 0, t, s.dur);

    s.build(this, gate, t, {
      vel: (opts.vel != null ? opts.vel : 1) * (s.gain != null ? s.gain : 1),
      det,
      n,
    });
    return true;
  }

  // Cut a sounding effect in 20ms. Short enough to free the voices, long
  // enough that it reads as a release rather than a click.
  _steal(v, now) {
    v.dead = true;
    for (const e of this._log) {
      if (e[2] === v.gate && e[1] > now) e[1] = Math.min(e[1], now + 0.02);
    }
    try {
      const g = v.gate.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.exponentialRampToValueAtTime(0.0004, now + 0.02);
    } catch (e) { /* node already finished */ }
  }

  activeVoices() {
    const now = this.ctx.currentTime;
    this._active = this._active.filter((v) => v.end > now && !v.dead);
    return this._active.reduce((c, v) => c + v.vox, 0);
  }

  // Peak simultaneous voice count over everything scheduled since the last
  // reset. Only populated when `log` is true (tools/render-sfx.js).
  maxOverlap() {
    const ev = [];
    for (const [a, b] of this._log) { ev.push([a, 1], [b, -1]); }
    ev.sort((x, y) => (x[0] - y[0]) || (x[1] - y[1]));
    let c = 0, m = 0;
    for (const e of ev) { c += e[1]; if (c > m) m = c; }
    return m;
  }

  resetLog() { this._log = []; }
}

// ---------------------------------------------------------------------------
// THE BANK
// ---------------------------------------------------------------------------
// Each entry:
//   label  <=6 chars, for the sound-test rack
//   cat    combat | pickup | ui | world | boss
//   dur    audible length in seconds (polyphony bookkeeping + render length)
//   vox    PEAK SIMULTANEOUS VOICES — asserted against the real graph by
//          tools/render-sfx.js. Keep <= MAX_VOX.
//   echo   send level into the global SPC echo bus
//   gain   PEAK-LEVELLING TRIM, measured. Every value below was derived from
//          the rendered WAV: gain = targetPeak / measuredPeak, so the bank
//          reaches a deliberate peak instead of wherever the voice velocities
//          happened to land.
//          THE PEAK RANGES THIS FILE USED TO CLAIM WERE NOT TRUE. It said
//          "combat/pickup 0.52-0.68, world 0.42-0.62, UI 0.22-0.46"; the
//          rendered WAVs say combat 0.315-0.789, pickup 0.384-0.649, world
//          0.316-0.689, UI 0.381-0.603, boss 0.417-0.510. Nobody had
//          re-derived them after the round-8 level work. They are not a target
//          any more, because peak is the wrong axis for a bank whose sounds
//          run 0.075 s to 1.46 s — what governs is the level against the
//          score (rule #1), and `node tools/render-sfx.js` now PRINTS the
//          measured per-category range on every run so this comment cannot go
//          stale again.
//          The one peak claim that carries design weight is checked instead:
//          `text` fires on every character of every line in the chapter, so it
//          must peak below every combat sound the player swings (0.487 vs
//          swing 0.789 / hit 0.651 / bush 0.692). render-sfx.js exits 3 if
//          that stops being true.
//   steal  MUSIC VOICES this effect occupies (rule #1). The bank gates that
//          many of the score's channel buses to silence for the effect's body
//          and hands them back. 1 for a dialog blip (it takes the arpeggio and
//          nothing else), 2 for a sword or a pickup, 4-5 for a fanfare or
//          Kettleback bursting, which take the tune too. Ranked by
//          STEAL_RANK; the bass is never reachable.
//   poly   simultaneous copies allowed
//   minGap retrigger cooldown (seconds)
//   rand   +/- cents of pitch jitter on repeats (anti-fatigue)
//   swell  true = this effect is ALLOWED to peak late (rumbles, roars, falls)
//   prio   true = may exceed the voice budget (boss / death / fanfare beats)
//   env    MEASURED display envelope: 32 bins of amplitude^0.5 quantised 0-9
//          over the audible span of the rendered WAV. Regenerate after any
//          change with:  node tools/render-sfx.js && python3 tools/analyze-sfx.py --envs
//   build  the actual synthesis

export const SOUNDS = {

  // === COMBAT ==============================================================

  swing: {
    label: 'SWING', cat: 'combat', desc: 'COGBLADE WHOOSH',
    dur: 0.20, vox: 3, echo: 0.12, gain: 0.750, steal: 2, poly: 3, minGap: 0.05, rand: 90,
    env: '98765433222111122221111110000001',
    build(b, bus, t, o) {
      // The most-pressed button in the game. ONE gesture with ONE transient:
      // the blade is already moving when the press registers, so the loudest
      // instant is at the front and the sound falls away from it. (Round 5
      // measured the old version's peak at frame 3 of a 3-4 frame animation,
      // with a 40 ms hole in front of it — a wind-up before a whoosh is two
      // gestures, and the player only ever heard the second one.)
      b.noise(bus, t, { type: 'bandpass', f: 3400, to: 700, Q: 1.2, dur: 0.150, a: 0.006, vel: 0.72 * o.vel, detune: o.det });
      b.noise(bus, t + 0.008, { type: 'highpass', f: 4400, dur: 0.042, a: 0.003, vel: 0.20 * o.vel, detune: o.det });
      b.tone(bus, t + 0.006, { wave: 'duty50', f: 1500, to: 430, dur: 0.115, a: 0.005, vel: 0.085 * o.vel, detune: o.det, lp: 2600 });
    },
  },

  hit: {
    label: 'HIT', cat: 'combat', desc: 'BLADE MEETS HIDE',
    dur: 0.17, vox: 3, echo: 0.16, gain: 0.707, steal: 2, poly: 3, minGap: 0.04, rand: 110,
    env: '98654332221111132211111110000002',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'lowpass', f: 1800, to: 380, Q: 0.8, dur: 0.13, a: 0.002, vel: 0.36 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 270, to: 74, dur: 0.11, a: 0.002, vel: 0.30 * o.vel, detune: o.det });
      b.noise(bus, t, { type: 'highpass', f: 3800, dur: 0.026, a: 0.001, vel: 0.14 * o.vel, detune: o.det });
    },
  },

  clink: {
    label: 'CLINK', cat: 'combat', desc: 'BLADE ON BRASS',
    dur: 0.20, vox: 3, echo: 0.36, gain: 0.820, steal: 2, poly: 3, minGap: 0.04, rand: 150,
    env: '97544322244322111111222111111001',
    build(b, bus, t, o) {
      // Two inharmonic triangles (ratio 1.97, not 2) = metal, not a chord.
      // One noise tick for the strike. Three voices, no more.
      //
      // gain 0.695 -> 0.820 (+1.4 dB). At 0.695 this rendered at peak 0.489 —
      // the quietest sound the player ever swings, 0.002 above the dialog
      // blip, and 0.0 dB against the score full band in the live game, i.e.
      // both of those margins were coin flips. A parry is a hard bright
      // impact; it should not be the same size as a text tick.
      b.noise(bus, t, { type: 'highpass', f: 5200, dur: 0.018, a: 0.001, vel: 0.24 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'triangle', f: 3080, dur: 0.090, a: 0.001, vel: 0.21 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'triangle', f: 1565, dur: 0.170, a: 0.002, vel: 0.17 * o.vel, detune: o.det + 9 });
    },
  },

  cuff: {
    label: 'CUFF', cat: 'combat', desc: 'BELLOWS CUFF BLAST',
    dur: 0.30, vox: 3, echo: 0.18, gain: 0.589, steal: 2, poly: 3, minGap: 0.09, rand: 70,
    env: '98766554433332333222212111111122',
    build(b, bus, t, o) {
      // The chapter's second verb: a valve cracks, compressed air leaves in
      // one shove. Everything peaks inside 6 ms — it must feel like a punch,
      // because after B4 the player fires it constantly.
      b.noise(bus, t, { type: 'highpass', f: 4600, dur: 0.020, a: 0.0008, vel: 0.26 * o.vel, detune: o.det });
      b.noise(bus, t, { type: 'bandpass', f: 3000, to: 760, Q: 0.85, dur: 0.235, a: 0.0025, vel: 0.50 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 215, to: 68, dur: 0.135, a: 0.0018, vel: 0.26 * o.vel, detune: o.det });
    },
  },

  smash: {
    label: 'SMASH', cat: 'combat', desc: 'POT OR CRATE BREAKS',
    dur: 0.32, vox: 3, echo: 0.22, gain: 0.869, steal: 2, poly: 3, minGap: 0.06, rand: 120,
    env: '97544355444333333222222121111122',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'lowpass', f: 1600, to: 300, Q: 0.8, dur: 0.095, a: 0.0015, vel: 0.40 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 250, to: 88, dur: 0.100, a: 0.0015, vel: 0.24 * o.vel, detune: o.det });
      // shards scatter — starts INSIDE the crack, so there is no hole
      b.noise(bus, t + 0.035, { type: 'bandpass', f: 2600, to: 1500, Q: 1.2, dur: 0.235, a: 0.004, vel: 0.20 * o.vel, detune: o.det });
    },
  },

  bush: {
    label: 'BUSH', cat: 'combat', desc: 'CUT FOLIAGE',
    dur: 0.17, vox: 3, echo: 0.10, gain: 1.539, steal: 2, poly: 3, minGap: 0.04, rand: 140,
    env: '79777565443333222121111111222221',
    build(b, bus, t, o) {
      // rand: 140 now reaches every voice. It used to reach NONE of them: the
      // two loud voices are noise (which had no detune path at all) and the
      // third omitted `detune`, so eight rendered bushes were eight identical
      // bushes on the only axis the declaration promised.
      b.noise(bus, t, { type: 'bandpass', f: 2800, to: 1200, Q: 1.0, dur: 0.14, a: 0.004, vel: 0.28 * o.vel, detune: o.det });
      b.noise(bus, t + 0.008, { type: 'highpass', f: 4200, dur: 0.06, a: 0.002, vel: 0.11 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty50', f: 300, to: 180, dur: 0.08, a: 0.003, vel: 0.07 * o.vel, detune: o.det, lp: 1200 });
    },
  },

  poof: {
    label: 'POOF', cat: 'combat', desc: 'ENEMY BURSTS',
    dur: 0.34, vox: 3, echo: 0.28, gain: 0.851, steal: 2, poly: 3, minGap: 0.05, rand: 80,
    env: '99765544344333222221222211111111',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'highpass', f: 2600, dur: 0.035, a: 0.001, vel: 0.24 * o.vel, detune: o.det });
      b.noise(bus, t, { type: 'bandpass', f: 2900, to: 380, Q: 0.75, dur: 0.29, a: 0.004, vel: 0.36 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty50', f: 880, to: 158, dur: 0.23, a: 0.003, vel: 0.16 * o.vel, detune: o.det, lp: 3200, lpTo: 800 });
    },
  },

  rivet: {
    label: 'RIVET', cat: 'combat', desc: 'THE RIVETER FIRES',
    dur: 0.22, vox: 3, echo: 0.24, gain: 1.522, steal: 2, poly: 3, minGap: 0.07, rand: 130,
    env: '97654433322211322222111111000122',
    build(b, bus, t, o) {
      // pneumatic nailgun: a hard tick, a pitched launch dropping away, and
      // the exhaust of the barrel behind it
      b.noise(bus, t, { type: 'highpass', f: 5000, dur: 0.016, a: 0.0008, vel: 0.24 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty12', f: 1180, to: 330, dur: 0.105, a: 0.0012, vel: 0.26 * o.vel, detune: o.det, lp: 3400 });
      b.noise(bus, t + 0.006, { type: 'bandpass', f: 2500, to: 950, Q: 1.5, dur: 0.155, a: 0.003, vel: 0.20 * o.vel, detune: o.det });
    },
  },

  hurt: {
    label: 'HURT', cat: 'combat', desc: 'WREN TAKES A HIT',
    dur: 0.33, vox: 3, echo: 0.20, gain: 1.118, steal: 3, poly: 1, minGap: 0.20, rand: 40,
    env: '88986765544333333322222211122221',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'lowpass', f: 1100, to: 300, Q: 0.7, dur: 0.10, a: 0.002, vel: 0.28 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty12', f: 520, to: 118, dur: 0.27, a: 0.003, vel: 0.30 * o.vel, detune: o.det, lp: 3000, lpTo: 1100 });
      b.tone(bus, t + 0.008, { wave: 'duty25', f: 392, to: 104, dur: 0.24, a: 0.004, vel: 0.16 * o.vel, detune: o.det - 24, lp: 2400 });
    },
  },

  death: {
    label: 'DEATH', cat: 'combat', desc: 'WREN GOES DOWN',
    dur: 0.86, vox: 4, echo: 0.30, gain: 0.490, steal: 4, poly: 1, minGap: 1.5, rand: 0,
    swell: false, prio: true,
    env: '99898998755443222211117754332222',
    build(b, bus, t, o) {
      // the hit lands first (so it is not a "late" sound), then Wren's two
      // voices slide a minor sixth down and the body settles
      b.noise(bus, t, { type: 'lowpass', f: 1300, to: 300, Q: 0.7, dur: 0.11, a: 0.0018, vel: 0.48 * o.vel });
      b.tone(bus, t, { wave: 'duty12', f: 560, to: 96, dur: 0.56, a: 0.003, hold: 0.16, vel: 0.30 * o.vel, lp: 3000, lpTo: 760 });
      b.tone(bus, t + 0.006, { wave: 'duty25', f: 418, to: 74, dur: 0.54, a: 0.004, hold: 0.14, vel: 0.17 * o.vel, detune: -22, lp: 2400 });
      // the body settles, UNDER the hit — measured on a 150 Hz-highpassed
      // envelope, because a 46 Hz thump a TV cannot reproduce is not a peak
      b.noise(bus, t + 0.545, { type: 'lowpass', f: 420, to: 150, Q: 0.7, dur: 0.24, a: 0.002, vel: 0.15 * o.vel });
      b.tone(bus, t + 0.545, { wave: 'tribass', f: 132, to: 46, dur: 0.28, a: 0.002, vel: 0.21 * o.vel });
    },
  },

  // === PICKUPS =============================================================

  cog: {
    label: 'COG', cat: 'pickup', desc: 'CURRENCY BLIP',
    dur: 0.20, vox: 3, echo: 0.30, gain: 1.146, steal: 2, poly: 3, minGap: 0.035, rand: 45,
    env: '85219865432234322221102211111001',
    build(b, bus, t, o) {
      // grace note into a held bright ping — the shape that reads as "coin"
      b.tone(bus, t, { wave: 'duty25', f: n('b5'), dur: 0.052, a: 0.002, vel: 0.24 * o.vel, detune: o.det, lp: 6800 });
      b.tone(bus, t + 0.044, { wave: 'duty25', f: n('f#6'), dur: 0.135, a: 0.002, vel: 0.29 * o.vel, detune: o.det, lp: 7200 });
      b.tone(bus, t + 0.044, { wave: 'triangle', f: n('f#5'), dur: 0.12, a: 0.003, vel: 0.12 * o.vel, detune: o.det });
    },
  },

  heart: {
    label: 'HEART', cat: 'pickup', desc: 'HEALTH RESTORED',
    dur: 0.28, vox: 3, echo: 0.34, gain: 1.148, steal: 2, poly: 2, minGap: 0.06, rand: 30,
    env: '75321997654334432321112222111111',
    build(b, bus, t, o) {
      b.tone(bus, t, { wave: 'duty50', f: n('a5'), dur: 0.075, a: 0.004, vel: 0.20 * o.vel, detune: o.det, lp: 5000 });
      b.tone(bus, t + 0.06, { wave: 'duty50', f: n('e6'), dur: 0.19, a: 0.005, vel: 0.22 * o.vel, detune: o.det, lp: 5600 });
      b.tone(bus, t + 0.06, { wave: 'triangle', f: n('e5'), dur: 0.18, a: 0.006, vel: 0.12 * o.vel, detune: o.det });
    },
  },

  key: {
    label: 'KEY', cat: 'pickup', desc: 'SMALL KEY GET',
    dur: 0.52, vox: 3, echo: 0.42, gain: 1.691, steal: 3, poly: 2, minGap: 0.20, rand: 20,
    env: '95311774211886654554332222221122',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'highpass', f: 5000, dur: 0.026, a: 0.001, vel: 0.14 * o.vel, detune: o.det });
      const notes = [['f5', 0.00, 0.085], ['bb5', 0.082, 0.085], ['d6', 0.164, 0.33]];
      for (const [nm, off, d] of notes) {
        b.tone(bus, t + off, { wave: 'duty25', f: n(nm), dur: d, a: 0.003, vel: 0.20 * o.vel, detune: o.det, lp: 6400 });
      }
      // one sub-octave body under the landing note only (voice discipline)
      b.tone(bus, t + 0.164, { wave: 'triangle', f: n('d5'), dur: 0.32, a: 0.004, vel: 0.11 * o.vel, detune: o.det });
    },
  },

  chest: {
    label: 'CHEST', cat: 'pickup', desc: 'LID BANGS OPEN',
    dur: 0.46, vox: 3, echo: 0.24, gain: 0.776, steal: 2, poly: 1, minGap: 0.30, rand: 60,
    env: '96544565443222221111114543322221',
    build(b, bus, t, o) {
      // ONE gesture: the latch pops on frame 1 (that is the moment the player
      // pressed A), the hinge scrapes continuously out of the same transient,
      // the lid hits its stop. No hole, no half-second delay, no cave tribass.
      b.noise(bus, t, { type: 'highpass', f: 3200, dur: 0.030, a: 0.0008, vel: 0.36 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 232, to: 132, dur: 0.095, a: 0.0015, vel: 0.22 * o.vel, detune: o.det });
      b.noise(bus, t, { type: 'bandpass', f: 900, to: 2200, Q: 2.8, dur: 0.300, a: 0.004, hold: 0.10, vel: 0.34 * o.vel, detune: o.det });
      b.noise(bus, t + 0.300, { type: 'lowpass', f: 620, to: 240, Q: 0.7, dur: 0.145, a: 0.0018, vel: 0.26 * o.vel, detune: o.det });
      b.tone(bus, t + 0.300, { wave: 'tribass', f: 186, to: 104, dur: 0.155, a: 0.0018, vel: 0.15 * o.vel });
    },
  },

  fanfare: {
    label: 'ITEM', cat: 'pickup', desc: 'ITEM ACQUIRED',
    dur: 1.45, vox: 5, echo: 0.44, gain: 0.597, steal: 4, poly: 1, minGap: 1.0, rand: 0, prio: true,
    env: '74652642753543489999876554332221',
    build(b, bus, t, o) {
      // Bb major, same key as the overworld theme: a four-note run that lands
      // on the fifth, held, with a horn third under it.
      const run = [['bb4', 0.00, 0.10], ['d5', 0.095, 0.10], ['f5', 0.19, 0.10], ['bb5', 0.285, 0.11]];
      for (const [nm, off, d] of run) {
        b.tone(bus, t + off, { wave: 'duty25', f: n(nm), dur: d, a: 0.004, vel: 0.21 * o.vel, lp: 7000 });
        b.tone(bus, t + off, { wave: 'duty12', f: n(nm) / 2, dur: d, a: 0.005, vel: 0.09 * o.vel });
      }
      // lift: c6 then the held f6 resolution
      b.tone(bus, t + 0.40, { wave: 'duty25', f: n('c6'), dur: 0.125, a: 0.004, vel: 0.22 * o.vel, lp: 7000 });
      b.tone(bus, t + 0.40, { wave: 'duty12', f: n('a5'), dur: 0.125, a: 0.006, vel: 0.09 * o.vel });
      b.tone(bus, t + 0.53, { wave: 'duty25', f: n('f6'), dur: 0.86, a: 0.006, hold: 0.14, vel: 0.24 * o.vel, lp: 7400, vib: 5.6, vibCents: 14 });
      b.tone(bus, t + 0.53, { wave: 'duty12', f: n('d6'), dur: 0.82, a: 0.008, hold: 0.10, vel: 0.12 * o.vel, vib: 5.6, vibCents: 14 });
      // bass punctuation + a snare-ish roll flourish
      b.tone(bus, t, { wave: 'tribass', f: n('bb2'), dur: 0.275, a: 0.004, vel: 0.22 * o.vel });
      b.tone(bus, t + 0.285, { wave: 'tribass', f: n('f2'), dur: 0.21, a: 0.004, vel: 0.20 * o.vel });
      b.tone(bus, t + 0.53, { wave: 'tribass', f: n('bb2'), dur: 0.60, a: 0.004, hold: 0.12, vel: 0.24 * o.vel });
      for (let i = 0; i < 4; i++) {
        b.noise(bus, t + 0.415 + i * 0.028, { type: 'bandpass', f: 2000, Q: 0.9, dur: 0.026, a: 0.002, vel: (0.06 + i * 0.022) * o.vel });
      }
      b.noise(bus, t + 0.53, { type: 'highpass', f: 5200, dur: 0.09, a: 0.002, vel: 0.14 * o.vel });
    },
  },

  secret: {
    label: 'SECRET', cat: 'pickup', desc: 'YOU FOUND SOMETHING',
    dur: 1.00, vox: 4, echo: 0.52, gain: 0.582, steal: 4, poly: 1, minGap: 0.8, rand: 0, prio: true,
    env: '74347633564349877776554433322221',
    build(b, bus, t, o) {
      // Original motif: up a fourth, down a step, up a fifth. Bell timbre =
      // triangle body, and only the landing note gets its harmony, so four
      // voices is the ceiling.
      const motif = [['c#5', 0.00, 0.15], ['f#5', 0.105, 0.15], ['e5', 0.21, 0.15], ['b5', 0.315, 0.62]];
      motif.forEach(([nm, off, d], i) => {
        const last = i === motif.length - 1;
        b.tone(bus, t + off, { wave: 'triangle', f: n(nm), dur: d, a: 0.003, vel: (last ? 0.27 : 0.22) * o.vel });
        if (last) {
          b.tone(bus, t + off, { wave: 'duty25', f: n('f#6'), dur: 0.50, a: 0.006, vel: 0.075 * o.vel, lp: 7000 });
          b.tone(bus, t + off, { wave: 'triangle', f: n('f#4'), dur: 0.55, a: 0.006, vel: 0.11 * o.vel });
        } else {
          b.tone(bus, t + off, { wave: 'duty50', f: n(nm) * 2, dur: d * 0.5, a: 0.003, vel: 0.055 * o.vel, lp: 6500 });
        }
      });
    },
  },

  // === UI ==================================================================

  text: {
    label: 'TEXT', cat: 'ui', desc: 'DIALOG REVEAL BLIP',
    dur: 0.075, vox: 2, echo: 0.06, gain: 1.301, steal: 1, poly: 2, minGap: 0.022, rand: 90,
    env: '59999754322111110000000000012222',
    build(b, bus, t, o) {
      // The chapter is delivered through dialog (Pell, Marla, Tam, Hesper), so
      // this is the sound the player hears MOST, and round 5 measured it 23.7
      // dB under the score — inaudible. Measured now IN THE SHIPPED GAME
      // (`--levels`, median of 3 firings against the live transport): +0.8 dB
      // full band, +6.2 dB through the small speaker, +9.0 dB in a window its
      // own length — up 19.5 dB on the -18.7 dB the SAME test measures for the
      // round-5 mix on the same page, rather than quoting the old critique.
      // Most of that came from LENGTH and from the score's trim, not from raw
      // level: 50 ms of tone instead of 30 raises its short-term RMS ~2 dB for
      // free. Its peak stays at 0.487, under every combat sound the player
      // swings, because a blip that fires ten times a second must not be a
      // sword — and render-sfx.js exits 3 if that stops being true.
      b.tone(bus, t, { wave: 'duty50', f: 1240, to: 940, dur: 0.058, a: 0.007, hold: 0.010, vel: 0.21 * o.vel, detune: o.det, lp: 3000 });
      b.tone(bus, t, { wave: 'triangle', f: 620, dur: 0.046, a: 0.006, hold: 0.008, vel: 0.10 * o.vel, detune: o.det });
    },
  },

  cursor: {
    label: 'CURSOR', cat: 'ui', desc: 'MENU MOVE',
    dur: 0.08, vox: 2, echo: 0.14, gain: 1.610, steal: 1, poly: 2, minGap: 0.05, rand: 35,
    env: '97543221110000032111100000000002',
    build(b, bus, t, o) {
      // A MENU BIP IS NOT A TEXT TICK. Round 6 gave these two identical 4 ms
      // envelope shapes (0 8 9 6 3 2 1 1 0 ...) and separated them by pitch
      // alone, which is not how ALttP's differ. `text` is a soft tick with a
      // short plateau; `cursor` is percussive — it is at full level in under a
      // millisecond and it is gone in 70. Measured 2 ms bins from the trigger:
      //   text   0 4 8 9 8 7 6 5 4 4 3 3 ...   (rises over ~8 ms, holds)
      //   cursor 9 8 7 6 5 4 4 3 3 2 2 2 ...   (loudest instant is bin 0)
      b.tone(bus, t, { wave: 'duty50', f: 700, to: 1120, dur: 0.070, a: 0.0007, vel: 0.26 * o.vel, detune: o.det, lp: 4600 });
      b.tone(bus, t, { wave: 'triangle', f: 1400, dur: 0.022, a: 0.0006, vel: 0.10 * o.vel, detune: o.det });
    },
  },

  select: {
    label: 'SELECT', cat: 'ui', desc: 'MENU CONFIRM',
    dur: 0.20, vox: 3, echo: 0.30, gain: 1.560, steal: 2, poly: 2, minGap: 0.08, rand: 25,
    env: '95321198765433222433222211111222',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'highpass', f: 5600, dur: 0.018, a: 0.001, vel: 0.10 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty25', f: n('a5'), dur: 0.055, a: 0.002, vel: 0.19 * o.vel, detune: o.det, lp: 6000 });
      b.tone(bus, t + 0.05, { wave: 'duty25', f: n('e6'), dur: 0.14, a: 0.002, vel: 0.21 * o.vel, detune: o.det, lp: 6600 });
      b.tone(bus, t + 0.05, { wave: 'triangle', f: n('e5'), dur: 0.13, a: 0.004, vel: 0.08 * o.vel, detune: o.det });
    },
  },

  error: {
    label: 'ERROR', cat: 'ui', desc: 'LOCKED - NO EFFECT',
    dur: 0.22, vox: 2, echo: 0.10, gain: 1.829, steal: 2, poly: 1, minGap: 0.20, rand: 15,
    env: '97422110012974321110122110000001',
    build(b, bus, t, o) {
      for (const off of [0, 0.10]) {
        b.tone(bus, t + off, { wave: 'duty12', f: 178, dur: 0.075, a: 0.004, vel: 0.26 * o.vel, detune: o.det, lp: 1500 });
        b.tone(bus, t + off, { wave: 'duty50', f: 89, dur: 0.075, a: 0.004, vel: 0.11 * o.vel, lp: 900 });
      }
    },
  },

  lowhp: {
    label: 'LOWHP', cat: 'ui', desc: 'LOW HEART WARNING',
    dur: 0.14, vox: 2, echo: 0.20, gain: 2.124, steal: 1, poly: 1, minGap: 0.30, rand: 0,
    env: '98754432221111332221111110000022',
    build(b, bus, t, o) {
      b.tone(bus, t, { wave: 'duty50', f: n('a6'), dur: 0.10, a: 0.003, vel: 0.17 * o.vel, lp: 7000 });
      b.tone(bus, t, { wave: 'triangle', f: n('a5'), dur: 0.11, a: 0.004, vel: 0.09 * o.vel });
    },
  },

  scroll: {
    label: 'SCROLL', cat: 'ui', desc: 'SCREEN EDGE CROSSED',
    dur: 0.22, vox: 2, echo: 0.10, gain: 1.908, steal: 1, poly: 1, minGap: 0.35, rand: 60,
    env: '99867554333222222222111111111001',
    build(b, bus, t, o) {
      // Deliberately near-subliminal: this fires every time the camera changes
      // screen, so it is a breath of air, not a swoosh.
      b.noise(bus, t, { type: 'bandpass', f: 420, to: 1300, Q: 0.9, dur: 0.175, a: 0.005, vel: 0.42 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty50', f: 320, to: 560, dur: 0.10, a: 0.005, vel: 0.10 * o.vel, detune: o.det, lp: 1600 });
    },
  },

  // === WORLD ===============================================================

  door: {
    label: 'DOOR', cat: 'world', desc: 'GEAR-GATE OPENS',
    dur: 0.56, vox: 3, echo: 0.26, gain: 0.721, steal: 2, poly: 1, minGap: 0.40, rand: 40,
    env: '96655655655433222111875433322122',
    build(b, bus, t, o) {
      // clank -> continuous grind -> stop. The grind's sustain floor keeps the
      // gesture running: no dead air between the clank and the stop.
      b.noise(bus, t, { type: 'lowpass', f: 900, to: 280, Q: 0.75, dur: 0.10, a: 0.0018, vel: 0.34 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 178, to: 92, dur: 0.125, a: 0.0018, vel: 0.28 * o.vel, detune: o.det });
      b.noise(bus, t + 0.012, { type: 'bandpass', f: 720, to: 2150, Q: 2.4, dur: 0.345, a: 0.010, hold: 0.16, vel: 0.34 * o.vel, detune: o.det });
      b.noise(bus, t + 0.360, { type: 'lowpass', f: 620, to: 200, Q: 0.75, dur: 0.185, a: 0.0018, vel: 0.30 * o.vel, detune: o.det });
      b.tone(bus, t + 0.360, { wave: 'tribass', f: 148, to: 70, dur: 0.195, a: 0.0018, vel: 0.26 * o.vel });
    },
  },

  stairs: {
    label: 'STAIRS', cat: 'world', desc: 'DOWN INTO THE WORKS',
    dur: 0.58, vox: 2, echo: 0.32, gain: 1.006, steal: 2, poly: 1, minGap: 0.50, rand: 50,
    env: '95324428532232853223264222321111',
    build(b, bus, t, o) {
      // four boots on iron treads, descending, each one quieter and lower
      for (let i = 0; i < 4; i++) {
        const at = t + i * 0.125;
        const k = 1 - i * 0.18;
        b.noise(bus, at, { type: 'lowpass', f: 1000 - i * 130, to: 300, Q: 0.8, dur: 0.085, a: 0.0015, vel: 0.30 * k * o.vel, detune: o.det });
        b.tone(bus, at, { wave: 'tribass', f: 184 - i * 20, to: 88 - i * 8, dur: 0.100, a: 0.0015, vel: 0.22 * k * o.vel, detune: o.det });
      }
    },
  },

  steam: {
    label: 'STEAM', cat: 'world', desc: 'JET BURST',
    dur: 0.62, vox: 2, echo: 0.16, gain: 0.573, steal: 1, poly: 2, minGap: 0.15, rand: 0, swell: true,
    env: '78888888998888766655443333222221',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'lowpass', f: 700, to: 300, Q: 0.7, dur: 0.085, a: 0.0025, vel: 0.24 * o.vel });
      b.noise(bus, t, { type: 'bandpass', f: 1700, to: 3600, Q: 0.65, dur: 0.58, a: 0.010, hold: 0.18, vel: 0.32 * o.vel });
      b.noise(bus, t + 0.09, { type: 'bandpass', f: 3400, to: 1300, Q: 1.4, dur: 0.46, a: 0.04, vel: 0.14 * o.vel });
    },
  },

  snuff: {
    label: 'SNUFF', cat: 'world', desc: 'CUFF KILLS A JET',
    dur: 0.30, vox: 2, echo: 0.18, gain: 1.010, steal: 2, poly: 2, minGap: 0.12, rand: 40,
    env: '98776655433333333222222111111211',
    build(b, bus, t, o) {
      // the answer to `steam`: pressure collapses instead of building
      b.noise(bus, t, { type: 'bandpass', f: 3400, to: 620, Q: 0.9, dur: 0.255, a: 0.0025, vel: 0.34 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'duty50', f: 900, to: 190, dur: 0.16, a: 0.003, vel: 0.07 * o.vel, detune: o.det, lp: 2400 });
    },
  },

  gear: {
    label: 'GEAR', cat: 'world', desc: 'SWITCH SPINS DOWN',
    dur: 0.40, vox: 4, echo: 0.22, gain: 0.907, steal: 2, poly: 2, minGap: 0.25, rand: 30,
    env: '95454343434333332322144333221121',
    build(b, bus, t, o) {
      // Gear-switches are the Boilerworks' lock verb, so the "it worked"
      // confirmation has to be the FIRST thing the player hears. Round 5
      // measured the old build peaking 272 ms in — on the settle, not the
      // catch — while the comment claimed the opposite. Now the pawl catch is
      // a clack with a body (noise + tribass, both at t), the ratchet run is
      // shorter, and the settle is deliberately 12 dB under the catch.
      const N = 9;
      let at = 0.036; // the ratchet run starts AFTER the clack, so the catch
                      // keeps the voice count at 4 and owns the transient
      b.noise(bus, t, { type: 'bandpass', f: 2600, Q: 1.2, dur: 0.030, a: 0.0008, vel: 0.46 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 246, to: 128, dur: 0.075, a: 0.0012, vel: 0.28 * o.vel, detune: o.det });
      // continuous whirr: nothing drops out between the catch and the stop
      b.noise(bus, t + 0.004, { type: 'bandpass', f: 460, to: 250, Q: 1.2, dur: 0.335, a: 0.004, hold: 0.15, vel: 0.16 * o.vel, detune: o.det });
      for (let i = 1; i < N; i++) {
        const k = 1 - i / N;
        b.noise(bus, t + at, {
          type: 'bandpass', f: 3000 - i * 130, Q: 1.5, dur: 0.024, a: 0.0008,
          vel: (0.07 + 0.15 * k) * o.vel, detune: o.det,
        });
        at += 0.011 + 0.0022 * i;
      }
      b.noise(bus, t + at + 0.012, { type: 'lowpass', f: 540, to: 190, Q: 0.8, dur: 0.13, a: 0.0018, vel: 0.14 * o.vel });
      b.tone(bus, t + at + 0.012, { wave: 'tribass', f: 216, to: 92, dur: 0.14, a: 0.0018, vel: 0.095 * o.vel, detune: o.det });
    },
  },

  fall: {
    label: 'FALL', cat: 'world', desc: 'OVER THE RIM',
    dur: 1.15, vox: 3, echo: 0.34, gain: 0.485, steal: 4, poly: 1, minGap: 1.0, rand: 0,
    swell: true, prio: true,
    env: '99988888766555444333332222222211',
    build(b, bus, t, o) {
      // The premise of the game is a falling island; this is what the rim
      // costs. Wind past the ears + a doppler whistle dropping two octaves.
      b.noise(bus, t, { type: 'bandpass', f: 1900, to: 380, Q: 0.9, dur: 1.00, a: 0.012, hold: 0.14, vel: 0.32 * o.vel });
      b.tone(bus, t, { wave: 'duty50', f: 940, to: 74, dur: 1.05, a: 0.008, vel: 0.22 * o.vel, lp: 4000, lpTo: 700, vib: 5.8, vibCents: 34 });
      b.tone(bus, t, { wave: 'tribass', f: 210, to: 38, dur: 0.95, a: 0.010, vel: 0.15 * o.vel });
    },
  },

  land: {
    label: 'LAND', cat: 'world', desc: 'BOOTS HIT DECK',
    dur: 0.26, vox: 2, echo: 0.18, gain: 1.117, steal: 2, poly: 2, minGap: 0.10, rand: 80,
    env: '98655433322211332221111111100022',
    build(b, bus, t, o) {
      b.noise(bus, t, { type: 'lowpass', f: 900, to: 240, Q: 0.8, dur: 0.115, a: 0.0015, vel: 0.36 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 172, to: 68, dur: 0.135, a: 0.0015, vel: 0.28 * o.vel, detune: o.det });
    },
  },

  lurch: {
    label: 'LURCH', cat: 'world', desc: 'THE ISLE DROPS',
    dur: 1.45, vox: 4, echo: 0.30, gain: 0.778, steal: 4, poly: 1, minGap: 1.0, rand: 0,
    swell: true, prio: true,
    env: '25667799987776656554433332222221',
    build(b, bus, t, o) {
      // WHERE THIS SOUND LIVES. Round 6 put 92.8% of its energy in 20-60 Hz —
      // an octave below anything else in the game, including the score, which
      // has 0.2% there and 51.2% in 60-120. Through a 200 Hz highpass (a TV,
      // a laptop, a phone) it lost 20.8 dB where the score loses 6.7, so the
      // bank's best sound on paper was its worst in the room: the biggest
      // story beat in Chapter 1 arriving as a faint hiss.
      // The isle dropping is now carried by the two things a small speaker
      // CAN play: hull metal under stress, and a groan. The 60->34 Hz sine is
      // an underlay at -10 dB, there for the players who have a subwoofer.
      b.tone(bus, t, { wave: 'sine', f: 60, to: 34, dur: 1.18, a: 0.09, hold: 0.22, vel: 0.115 * o.vel });
      b.noise(bus, t, { type: 'lowpass', f: 560, to: 200, Q: 0.7, dur: 1.32, a: 0.10, hold: 0.26, vel: 0.34 * o.vel });
      // stressed metal somewhere in the hull — the part a TV speaker can play
      b.noise(bus, t + 0.10, { type: 'bandpass', f: 620, to: 980, Q: 7.0, dur: 0.94, a: 0.11, vel: 0.34 * o.vel });
      b.tone(bus, t + 0.12, { wave: 'triangle', f: 208, to: 124, dur: 0.98, a: 0.10, vel: 0.30 * o.vel, vib: 5.5, vibCents: 45, lp: 1600 });
    },
  },

  // === BOSS ================================================================

  roar: {
    label: 'ROAR', cat: 'boss', desc: 'KETTLEBACK BELLOWS',
    dur: 1.46, vox: 4, echo: 0.34, gain: 0.447, steal: 4, poly: 1, minGap: 1.0, rand: 0,
    swell: true, prio: true,
    env: '68898898998898876555444332222211',
    build(b, bus, t, o) {
      // a boiler with a throat: a low detuned pulse under breath noise, the
      // whole thing closing down through a sweeping lowpass. Same disease as
      // `lurch` and the same cure — round 6 had 62.5% of the boss's signature
      // sound in 20-60 Hz and lost 11.1 dB through a 200 Hz highpass. The
      // throat moved up an octave; the 96->52 Hz tribass is now the underlay
      // rather than the sound.
      b.noise(bus, t, { type: 'highpass', f: 3200, dur: 0.08, a: 0.003, vel: 0.16 * o.vel });
      b.tone(bus, t, { wave: 'duty50', f: 152, to: 88, dur: 1.34, a: 0.05, hold: 0.42, vel: 0.32 * o.vel, lp: 2600, lpTo: 700, vib: 10.5, vibCents: 85 });
      b.tone(bus, t, { wave: 'tribass', f: 96, to: 52, dur: 1.28, a: 0.04, hold: 0.40, vel: 0.13 * o.vel });
      b.noise(bus, t, { type: 'bandpass', f: 900, to: 320, Q: 1.1, dur: 1.32, a: 0.05, hold: 0.34, vel: 0.30 * o.vel });
      // valve chatter riding on top (sequential — one voice at a time)
      for (let i = 0; i < 7; i++) {
        b.noise(bus, t + 0.24 + i * 0.075, { type: 'bandpass', f: 1500, Q: 4, dur: 0.05, a: 0.004, vel: 0.07 * o.vel });
      }
    },
  },

  bosshit: {
    label: 'BHIT', cat: 'boss', desc: 'CRADLE STRUCK',
    dur: 0.38, vox: 4, echo: 0.30, gain: 0.565, steal: 2, poly: 2, minGap: 0.10, rand: 90,
    env: '97766554434433332222222222111111',
    build(b, bus, t, o) {
      // `hit` is a blade in hide; this is a blade in a boiler. Same attack
      // shape, twice the mass, and a plate that rings afterwards.
      b.noise(bus, t, { type: 'highpass', f: 4200, dur: 0.026, a: 0.0008, vel: 0.22 * o.vel, detune: o.det });
      b.noise(bus, t, { type: 'lowpass', f: 1500, to: 300, Q: 0.8, dur: 0.175, a: 0.0015, vel: 0.40 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'tribass', f: 196, to: 60, dur: 0.20, a: 0.0015, vel: 0.32 * o.vel, detune: o.det });
      b.tone(bus, t, { wave: 'triangle', f: 452, dur: 0.30, a: 0.002, vel: 0.15 * o.vel, detune: o.det + 12 });
    },
  },

  bossdown: {
    label: 'BURST', cat: 'boss', desc: 'KETTLEBACK BURSTS',
    dur: 1.42, vox: 4, echo: 0.40, gain: 0.400, steal: 5, poly: 1, minGap: 2.0, rand: 0,
    swell: false, prio: true,
    env: '96654344444355335422143226544322',
    build(b, bus, t, o) {
      // The ending beat: the shell ruptures at frame 1, steam screams out of
      // it, three plates blow off in sequence, and the frame collapses.
      b.noise(bus, t, { type: 'highpass', f: 5000, dur: 0.05, a: 0.001, vel: 0.26 * o.vel });
      b.noise(bus, t, { type: 'lowpass', f: 2200, to: 200, Q: 0.7, dur: 0.50, a: 0.0018, vel: 0.46 * o.vel });
      b.tone(bus, t, { wave: 'tribass', f: 158, to: 40, dur: 0.55, a: 0.002, vel: 0.36 * o.vel });
      // the scream out of the split shell
      b.noise(bus, t + 0.24, { type: 'bandpass', f: 1200, to: 3800, Q: 0.8, dur: 0.52, a: 0.012, hold: 0.14, vel: 0.24 * o.vel });
      // plates letting go
      const pops = [[0.50, 1.0], [0.66, 0.86], [0.84, 0.74]];
      for (const [off, k] of pops) {
        b.noise(bus, t + off, { type: 'lowpass', f: 1100, to: 260, Q: 0.8, dur: 0.14, a: 0.0015, vel: 0.32 * k * o.vel });
        b.tone(bus, t + off, { wave: 'tribass', f: 230 * k, to: 70, dur: 0.15, a: 0.0015, vel: 0.22 * k * o.vel });
      }
      // the frame goes
      b.noise(bus, t + 1.00, { type: 'lowpass', f: 520, to: 110, Q: 0.7, dur: 0.36, a: 0.004, vel: 0.34 * o.vel });
      b.tone(bus, t + 1.00, { wave: 'tribass', f: 112, to: 32, dur: 0.38, a: 0.004, vel: 0.30 * o.vel });
      b.tone(bus, t + 1.00, { wave: 'duty25', f: 300, to: 62, dur: 0.34, a: 0.006, vel: 0.10 * o.vel, lp: 1800, lpTo: 500 });
    },
  },
};

export const SFX_IDS = Object.keys(SOUNDS);

export const SFX_CATS = ['combat', 'pickup', 'ui', 'world', 'boss'];

// ---------------------------------------------------------------------------
// ALIASES — names other Chapter 1 modules already call
// ---------------------------------------------------------------------------
// EVERY name fired anywhere in the shipping code, collected by grepping the
// call sites (`sfx('x')`, `onSfx('x')`, `window.__gwSfx('x')`) rather than by
// guessing. All 20 resolve; scenes/sfx.js renders the list live so the bridge
// can be seen working:
//
//   src/game/transition.js        screen-scroll door stairs lurch item-fanfare
//   src/game/items.js             steam gear bush hit
//   src/game/boss-kettleback.js   clink hit roar steam gear lurch poof
//   src/game/world/overworld.js   chest cog gear secret bush poof heart clink
//                                 swing hurt
//   src/game/world/boilerworks.js clink
//   src/scenes/dungeon.js         secret hurt text chest key
//   src/scenes/overworld.js       heart
//
// Only 'screen-scroll' and 'item-fanfare' need an alias; the rest are direct
// ids. The remaining entries are the obvious synonyms a scene author reaches
// for first. Anything not in SOUNDS and not here returns false from play(),
// which is silent but never throws.

export const ALIASES = {
  // transitions
  'screen-scroll': 'scroll', 'screenscroll': 'scroll',
  'item-fanfare': 'fanfare', 'itemfanfare': 'fanfare', 'item': 'fanfare',
  'stair': 'stairs', 'staircase': 'stairs',
  'fade': 'door', 'gate': 'door', 'gear-gate': 'door',
  'shake': 'lurch', 'quake': 'lurch', 'groan': 'lurch',
  // combat
  'sword': 'swing', 'slash': 'swing', 'attack': 'swing',
  'sword-hit': 'hit', 'enemy-hit': 'hit',
  'block': 'clink', 'parry': 'clink', 'metal': 'clink',
  'enemy-die': 'poof', 'enemy-death': 'poof', 'die': 'poof',
  'player-hurt': 'hurt', 'damage': 'hurt', 'ouch': 'hurt',
  'player-die': 'death', 'player-death': 'death', 'game-over': 'death',
  'blast': 'cuff', 'bellows': 'cuff', 'bellows-cuff': 'cuff', 'puff': 'cuff',
  'pot': 'smash', 'crate': 'smash', 'jar': 'smash', 'break': 'smash',
  'rivet-fire': 'rivet', 'shoot': 'rivet',
  'grass': 'bush', 'cut': 'bush',
  // pickups
  'coin': 'cog', 'rupee': 'cog', 'money': 'cog',
  'health': 'heart', 'refill': 'heart',
  'small-key': 'key', 'big-key': 'key', 'bigkey': 'key',
  'chest-open': 'chest', 'open': 'chest',
  'heart-piece': 'secret', 'found': 'secret', 'puzzle': 'secret',
  'solved': 'secret', 'reveal': 'secret',
  // ui
  'blip': 'text', 'talk': 'text', 'letter': 'text',
  'menu': 'cursor', 'move': 'cursor',
  'confirm': 'select', 'ok': 'select', 'buy': 'select',
  'locked': 'error', 'deny': 'error', 'nope': 'error',
  'warn': 'lowhp', 'low-health': 'lowhp',
  // world
  'jet': 'steam', 'vent': 'steam',
  'steam-off': 'snuff', 'extinguish': 'snuff',
  'switch': 'gear', 'gear-switch': 'gear', 'spin': 'gear',
  'pit': 'fall', 'rim': 'fall', 'void': 'fall',
  'thud': 'land', 'step-down': 'land', 'ledge': 'land',
  // boss
  'boss-roar': 'roar', 'bellow': 'roar',
  'boss-hit': 'bosshit', 'boss-hurt': 'bosshit',
  'boss-die': 'bossdown', 'boss-death': 'bossdown', 'explode': 'bossdown',
};

/** Canonical id for a name (direct id, alias, or null). */
export function resolve(name) {
  if (!name) return null;
  if (SOUNDS[name]) return name;
  const k = String(name).toLowerCase();
  if (SOUNDS[k]) return k;
  return ALIASES[k] || null;
}

// ---------------------------------------------------------------------------
// Module singleton — what the rest of the game talks to
// ---------------------------------------------------------------------------

// Events that count as "the player has interacted", after which a browser will
// let an AudioContext make sound.
const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

// A ChipEngine somebody else already built, if there is one. One context and
// one echo bus is still the better graph, so a REGISTERED MUSIC RIG is the
// first candidate — that is the engine the score is actually playing on, and
// it is registered by the scheduleSong hook whether or not its owner ever
// published it anywhere. (Voice stealing works across contexts, so this is an
// optimisation now, not the mechanism. Round 6 depended on it and shipped
// silent ducking when it failed.)
function findSharedChip() {
  if (typeof window === 'undefined') return null;
  const live = MUSIC_RIGS.filter((r) => !r.offline);
  const cands = [live.length ? live[live.length - 1].chip : null,
    window.__gwChip, window.gwChip,
    window.__gwAudio && window.__gwAudio.chip];
  for (const c of cands) {
    if (c && c.ctx && c.master && c.waves && c.noiseBuf) return c;
  }
  return null;
}

class SfxController {
  constructor() {
    this.bank = null;
    this.chip = null;
    this.ctx = null;
    this.enabled = true;
    this._volume = 1;
  }

  // Share the music engine's graph (preferred: one echo bus, one master).
  attach(chip) {
    if (this.bank && this.chip === chip) return this.bank;
    this.chip = chip;
    this.ctx = chip.ctx;
    this.bank = new SfxBank(chip, { volume: this._volume });
    if (typeof window !== 'undefined' && !window.__gwChip) window.__gwChip = chip;
    this.install();
    return this.bank;
  }

  /**
   * Build the bank on an AudioContext SOMEBODY ELSE OWNS. For an integrator
   * who has a context but no ChipEngine: this guarantees the effects and the
   * score end up on one context and one echo bus without anyone having to hand
   * over an engine. If a ChipEngine has already been registered on that
   * context (the score started first), that engine is adopted rather than a
   * second one being built on top of it.
   * @param {BaseAudioContext} ctx
   * @returns {SfxBank|null}
   */
  useContext(ctx) {
    if (!ctx) return this.bank;
    if (this.bank && this.ctx === ctx) return this.bank;
    try {
      const mine = MUSIC_RIGS.filter((r) => r.ctx === ctx && !r.offline);
      if (mine.length) return this.attach(mine[mine.length - 1].chip);
      if (ctx.state === 'suspended') ctx.resume();
      return this.attach(new ChipEngine(ctx));
    } catch (e) {
      return null;
    }
  }

  /**
   * Init. ADOPTS the ChipEngine the score is playing on if there is one (so
   * the effects share its echo bus and master); otherwise builds its own and
   * publishes it, so a music module loading later adopts OURS instead of
   * opening a second AudioContext. Either way the voice stealing finds the
   * score — that is rule #5's whole point. Safe to call repeatedly.
   */
  unlock() {
    if (this.bank) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.bank;
    }
    try {
      const shared = findSharedChip();
      if (shared) return this.attach(shared);
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return this.attach(new ChipEngine(ctx));
    } catch (e) {
      return null;
    }
  }

  /**
   * Publish the global hook src/game/transition.js already calls
   * (`window.__gwSfx(name)`), plus `window.gwSfx` for anything else that
   * wants the controller without an import. Runs automatically on import and
   * again on attach(); harmless to call by hand.
   *
   * ALSO ARMS THE FIRST-GESTURE UNLOCK. This is not decoration: as shipped,
   * src/scenes/dungeon.js and src/scenes/overworld.js import this module and
   * call sfx.play(...) but never call attach() or unlock(), so `this.bank` was
   * null and every play() in the actual game returned false. Those files are
   * not mine to edit, so the bank initialises itself on the first pointer or
   * key event — which is also the gesture browsers require before an
   * AudioContext may make sound.
   */
  install() {
    if (typeof window === 'undefined') return this;
    window.__gwSfx = (name, opts) => this.play(name, opts);
    window.gwSfx = this;
    if (this.chip) window.__gwChip = this.chip;
    this._arm();
    this._wireDialog();
    return this;
  }

  _arm() {
    if (this._armed || typeof window.addEventListener !== 'function') return;
    this._armed = true;
    const go = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        for (const ev of GESTURES) window.removeEventListener(ev, go, true);
      }
    };
    for (const ev of GESTURES) {
      try { window.addEventListener(ev, go, { capture: true, passive: true }); } catch (e) { /* older API */ }
    }
  }

  /**
   * Route src/game/dialog.js's text blip through the bank.
   *
   * dialog.js ships with a self-contained blip: a raw square oscillator on its
   * OWN AudioContext, straight into destination. It never passes the chip's
   * 9 kHz master lowpass, never reaches the echo bus, and never ducks the
   * score — and since neither shipping scene calls dialog.setSfx(), that raw
   * oscillator is how the whole chapter's text sounds. STORY.md delivers Pell,
   * Marla, Tam and Hesper through that blip.
   *
   * dialog.js is not mine to edit, so the swap happens here: `sfx` becomes an
   * accessor on DialogBox.prototype that returns the bank's {text, select,
   * cursor} unless a scene has explicitly called setSfx(), in which case the
   * scene wins. Entirely reversible, and a failure anywhere leaves dialog.js's
   * own blip in place.
   */
  _wireDialog() {
    // dialog.js builds sprites at module scope and therefore needs a DOM;
    // the import is dynamic and guarded so sfx.js still loads under node.
    if (this._dialogWired || typeof document === 'undefined') return;
    this._dialogWired = true;
    const self = this;
    import('./dialog.js').then((mod) => {
      const proto = mod && mod.DialogBox && mod.DialogBox.prototype;
      if (!proto || Object.getOwnPropertyDescriptor(proto, 'sfx')) return;
      const setSfx = proto.setSfx;
      if (typeof setSfx === 'function') {
        proto.setSfx = function (s) { this.__gwSfxOverride = true; return setSfx.call(this, s); };
      }
      Object.defineProperty(proto, 'sfx', {
        configurable: true,
        get() { return this.__gwSfxOverride ? this.__gwSfxOwn : self.dialogSfx(); },
        set(v) { this.__gwSfxOwn = v; },
      });
    }).catch(() => { /* leave dialog.js's own blip alone */ });
  }

  /**
   * The { blip, pick, move } shape src/game/dialog.js expects from setSfx() —
   * replaces its built-in bare-oscillator blip with the bank's `text`,
   * `select` and `cursor`.
   */
  dialogSfx() {
    if (!this._dialogSfx) {
      this._dialogSfx = {
        blip: () => this.play('text'),
        pick: () => this.play('select'),
        move: () => this.play('cursor'),
      };
    }
    return this._dialogSfx;
  }

  /** dialog.setSfx(sfx.dialogSfx()) in one call. */
  attachDialog(dialog) {
    if (dialog && typeof dialog.setSfx === 'function') dialog.setSfx(this.dialogSfx());
    return dialog;
  }

  get volume() { return this._volume; }
  set volume(v) {
    this._volume = v;
    if (this.bank) this.bank.volume = v;
  }

  play(id, opts) {
    if (!this.enabled) return false;
    // Lazy init: a scene that only ever calls sfx.play() still gets sound.
    if (!this.bank && !this.unlock()) return false;
    if (this.ctx && this.ctx.state === 'suspended') {
      try { this.ctx.resume(); } catch (e) { /* needs a gesture */ }
      return false;
    }
    try {
      return this.bank.play(id, opts);
    } catch (e) {
      return false;
    }
  }

  has(id) { return !!resolve(id); }
  voices() { return this.bank ? this.bank.activeVoices() : 0; }
  info(id) { return SOUNDS[resolve(id)]; }
  list() { return SFX_IDS; }
}

export const sfx = new SfxController();

// Importing the bank is enough to give transition.js its sound.
sfx.install();

export default sfx;
