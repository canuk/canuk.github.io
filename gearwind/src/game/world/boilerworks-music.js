// THE BOILERWORKS — two SPC-style tracks and the player that runs them.
//
// A twelve-minute Zelda dungeon in silence cannot pass as a lost SNES
// cartridge. audio.js ships the engine and the overworld march; this file adds
// the two tracks the dungeon needs and never edits audio.js.
//
//   boilerworksTheme()  "Under the Bellows" — D minor, 92 BPM, 16 bars.
//                       Slow, patient, mechanical. A clockwork 8th-note tick
//                       runs under everything, the bass chugs like a piston,
//                       and the lead is a sparse descending motif that never
//                       resolves. It is a room full of machines that do not
//                       care whether you live.
//
//   kettlebackTheme()   "The Cradle" — D harmonic minor, 152 BPM, 8 bars.
//                       Same key, same bass figure doubled in speed, lead
//                       pushed up an octave with a raised 7th. The boss theme
//                       is the dungeon theme having a panic attack, which is
//                       how the SNES did it and why the arrival lands.
//
// DungeonMusic is a thin transport: one ChipEngine per track (the engine
// caches its channel buses on first schedule, so tracks must not share one),
// lazy AudioContext creation, and a per-frame top-up so the loop never gaps.

import { ChipEngine, parseSeq, parseDrums, midi } from '../audio.js';

const TPB = 16;   // ticks per bar (16th-note ticks, 4/4)

function melody(bars, vel = 1) {
  const events = [];
  bars.forEach((s, bar) => {
    const { events: ev, end } = parseSeq(s, bar * TPB, vel);
    if (end !== (bar + 1) * TPB) {
      throw new Error(`bar ${bar + 1}: ${end - bar * TPB} ticks (want ${TPB}): ${s}`);
    }
    events.push(...ev);
  });
  return events;
}

function drums(bars) {
  const events = [];
  bars.forEach((s, bar) => {
    const { events: ev, end } = parseDrums(s, bar * TPB);
    if (end !== (bar + 1) * TPB) throw new Error(`drum bar ${bar + 1}: ${end - bar * TPB}`);
    events.push(...ev);
  });
  return events;
}

/** Root-note figure repeated per bar. `pat` is [tickOffset, semitone, vel]. */
function figure(roots, pat, dur = 2, oct = 0) {
  const events = [];
  roots.forEach((root, bar) => {
    const r = midi(root) + oct * 12;
    for (const [t, iv, v] of pat) events.push([bar * TPB + t, r + iv, dur, v]);
  });
  return events;
}

// ---------------------------------------------------------------------------
// "Under the Bellows" — the dungeon track
// ---------------------------------------------------------------------------

const DGN_LEAD = [
  'd4:4 r:2 f4:2 a4:4 r:4',
  'g4:6 f4:2 d4:8',
  'bb3:4 d4:4 f4:6 r:2',
  'c4:4 e4:4 g4:8',
  'd4:4 r:2 f4:2 a4:4 c5:4',
  'bb4:6 a4:2 f4:8',
  'g4:4 bb4:4 d5:6 r:2',
  'a4:8 r:8',
  'd4:2 f4:2 a4:2 d5:2 c5:4 a4:4',
  'bb4:4 a4:4 g4:4 f4:4',
  'd4:4 f4:4 bb4:6 r:2',
  'c5:6 bb4:2 a4:8',
  'g4:4 bb4:4 d5:4 f5:4',
  'e5:6 d5:2 c#5:8',
  'd5:8 a4:4 f4:4',
  'd4:12 r:4',
];

// A long, slow counterline — the hall breathing.
const DGN_PAD = [
  'd3:16', 'd3:16', 'bb2:16', 'c3:16',
  'd3:16', 'f3:16', 'g3:16', 'a3:16',
  'd3:16', 'f3:16', 'bb2:16', 'c3:16',
  'g3:16', 'a3:16', 'd3:8 a3:8', 'd3:16',
];

const DGN_ROOTS = [
  'd2', 'd2', 'bb1', 'c2', 'd2', 'd2', 'g1', 'a1',
  'd2', 'd2', 'bb1', 'c2', 'g1', 'a1', 'd2', 'd2',
];

// piston chug: root root root fifth, twice a bar
const CHUG = [
  [0, 0, 1], [2, 0, 0.72], [4, 0, 0.8], [6, 7, 0.72],
  [8, 0, 0.95], [10, 0, 0.72], [12, 0, 0.8], [14, 7, 0.72],
];

// the works ticking over: an even 8th-note fifth, one octave up, very quiet
const TICK = [
  [0, 12, 0.6], [2, 19, 0.45], [4, 12, 0.55], [6, 19, 0.45],
  [8, 12, 0.6], [10, 19, 0.45], [12, 12, 0.55], [14, 19, 0.45],
];

const DGN_DRUM = (() => {
  const A = 'k..h.h..s..h.h..';
  const B = 'k..h.h..s..hkkss';
  return Array.from({ length: 16 }, (_, i) => ((i + 1) % 8 === 0 ? B : A));
})();

export function boilerworksTheme() {
  return {
    name: 'Under the Bellows',
    bpm: 92,
    loopTicks: 16 * TPB,
    bars: 16,
    channels: [
      { name: 'LEAD', wave: 'duty12', gain: 0.20, pan: -0.10, echo: 0.50, vib: true, events: melody(DGN_LEAD, 0.9) },
      { name: 'PAD', wave: 'duty50', gain: 0.055, pan: 0.24, echo: 0.55, vib: true, events: melody(DGN_PAD, 0.55) },
      { name: 'TICK', wave: 'duty25', gain: 0.055, pan: 0.34, echo: 0.20, events: figure(DGN_ROOTS, TICK) },
      { name: 'BASS', wave: 'tribass', gain: 0.30, pan: -0.04, echo: 0.10, events: figure(DGN_ROOTS, CHUG) },
      { name: 'DRUM', type: 'noise', gain: 0.22, pan: 0.05, echo: 0.20, events: drums(DGN_DRUM) },
    ],
  };
}

// ---------------------------------------------------------------------------
// "The Cradle" — KETTLEBACK
// ---------------------------------------------------------------------------

const BOSS_LEAD = [
  'd5:2 d5:2 eb5:2 d5:2 a4:4 d5:4',
  'c5:2 bb4:2 a4:2 g4:2 f4:8',
  'd5:2 d5:2 f5:2 d5:2 c#5:4 d5:4',
  'a5:4 g5:4 f5:4 e5:4',
  'd5:2 a4:2 d5:2 f5:2 e5:4 c#5:4',
  'd5:8 r:2 a4:2 bb4:2 c5:2',
  'd5:2 eb5:2 e5:2 f5:2 g5:4 a5:4',
  'bb5:4 a5:4 d5:8',
];

const BOSS_STAB = [
  'd4:2 r:2 d4:2 r:2 f4:4 a4:4',
  'f4:2 r:2 f4:2 r:2 c4:8',
  'd4:2 r:2 d4:2 r:2 a4:4 c#5:4',
  'a4:4 g4:4 f4:4 e4:4',
  'd4:2 r:2 a4:2 r:2 f4:4 a4:4',
  'd4:8 bb3:4 c4:4',
  'd4:2 r:2 f4:2 r:2 a4:4 c#5:4',
  'd5:4 c#5:4 d5:8',
];

const BOSS_ROOTS = ['d2', 'f2', 'd2', 'a1', 'd2', 'bb1', 'g1', 'a1'];

// driving 16ths — the same chug as the dungeon, doubled
const DRIVE = (() => {
  const out = [];
  for (let t = 0; t < 16; t++) out.push([t, (t % 8 === 6) ? 7 : 0, t % 4 === 0 ? 1 : 0.7]);
  return out;
})();

const BOSS_DRUM = (() => {
  const A = 'kkh.s.h.kkh.s.hh';
  const B = 'kkh.s.h.kkssssss';
  return Array.from({ length: 8 }, (_, i) => (i === 7 ? B : A));
})();

export function kettlebackTheme() {
  return {
    name: 'The Cradle',
    bpm: 152,
    loopTicks: 8 * TPB,
    bars: 8,
    channels: [
      { name: 'LEAD', wave: 'duty25', gain: 0.24, pan: -0.14, echo: 0.36, vib: true, events: melody(BOSS_LEAD, 1) },
      { name: 'STAB', wave: 'duty12', gain: 0.14, pan: 0.20, echo: 0.34, events: melody(BOSS_STAB, 0.85) },
      { name: 'BASS', wave: 'tribass', gain: 0.32, pan: 0, echo: 0.08, events: figure(BOSS_ROOTS, DRIVE, 1) },
      { name: 'DRUM', type: 'noise', gain: 0.30, pan: 0.06, echo: 0.14, events: drums(BOSS_DRUM) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const TRACKS = { dungeon: boilerworksTheme, boss: kettlebackTheme };

export class DungeonMusic {
  constructor() {
    this.ctx = null;
    this.rigs = {};        // kind -> { chip, song, loopSec, nextAt }
    this.cur = null;
    this.enabled = true;
  }

  _ctx() {
    if (this.ctx) return this.ctx;
    const AC = (typeof window !== 'undefined')
      && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { this.enabled = false; return null; }
    this.ctx = new AC();
    return this.ctx;
  }

  _rig(kind) {
    if (this.rigs[kind]) return this.rigs[kind];
    const ctx = this._ctx();
    if (!ctx) return null;
    // one ChipEngine per track: scheduleSong caches its channel buses on the
    // first call, so two songs sharing an engine would play through each
    // other's mixer
    const rig = { chip: new ChipEngine(ctx), song: TRACKS[kind](), loopSec: 0, nextAt: 0 };
    this.rigs[kind] = rig;
    return rig;
  }

  /** @param {'dungeon'|'boss'|null} kind */
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
    } catch (e) { this.enabled = false; }
  }

  /** Top up the schedule so the loop never gaps. Call once a frame. */
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
    try {
      // cut the master of every rig, then rebuild it on the next play
      for (const kind of Object.keys(this.rigs)) {
        const rig = this.rigs[kind];
        rig.chip.master.disconnect();
        delete this.rigs[kind];
      }
    } catch (e) { /* context already torn down */ }
    this.cur = null;
  }
}
