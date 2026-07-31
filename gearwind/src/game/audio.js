// SNES-style chiptune audio engine + the Gearwind overworld theme.
//
// Evokes the SPC700 sound: a handful of simple looped timbres (pulse-ish and
// triangle-ish waves built as band-limited PeriodicWaves), fast attack
// envelopes, subtle delayed vibrato, a noise/drum channel, and — crucially —
// a global ~90ms echo send with filtered feedback (SNES games drenched
// everything in it). Works against both AudioContext (live) and
// OfflineAudioContext (WAV rendering via tools/render-audio.js).
//
// Sequencer model: a song is { bpm, channels: [...] }, each channel a list of
// note events [tickStart, midi, durTicks, velocity] (tick = 16th note).
// Scheduling is done wholesale per loop iteration via Web Audio timestamps,
// so playback is sample-accurate in both live and offline contexts.

// ---------------------------------------------------------------------------
// Note utilities
// ---------------------------------------------------------------------------

const SEMIS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

// 'bb2' -> 46, 'f#5' -> 78, 'c4' -> 60
export function midi(name) {
  const m = /^([a-g])([#b]?)(\d)$/.exec(name.toLowerCase());
  if (!m) throw new Error('bad note: ' + name);
  let s = SEMIS[m[1]];
  if (m[2] === '#') s++;
  if (m[2] === 'b') s--;
  return (Number(m[3]) + 1) * 12 + s;
}

export function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

// Parse a melody string into events. Tokens are separated by whitespace;
// '|' barlines are cosmetic. Token: note:durTicks[@vel] or r:durTicks.
//   "bb4:6 c5:2 | d5:4 f5:4@0.7"
export function parseSeq(str, startTick = 0, vel = 1) {
  const events = [];
  let t = startTick;
  for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
    if (!tok) continue;
    const [head, velStr] = tok.split('@');
    const [note, durStr] = head.split(':');
    const dur = durStr ? Number(durStr) : 1;
    if (note !== 'r') events.push([t, midi(note), dur, velStr ? Number(velStr) : vel]);
    t += dur;
  }
  return { events, end: t };
}

// Drum string: one char per tick. k=kick s=snare h=closed hat o=open hat .=rest
export function parseDrums(str, startTick = 0) {
  const events = [];
  const chars = str.replace(/[\s|]/g, '');
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c !== '.') events.push([startTick + i, c, 1, 1]);
  }
  return { events, end: startTick + chars.length };
}

// ---------------------------------------------------------------------------
// ChipEngine — builds the Web Audio graph and schedules songs
// ---------------------------------------------------------------------------

export class ChipEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.waves = this._buildWaves();
    this.noiseBuf = this._buildNoise();

    // Master chain: gain -> gentle lowpass (SNES gaussian-interp softness)
    this.master = ctx.createGain();
    this.master.gain.value = 1.25;
    this.masterLP = ctx.createBiquadFilter();
    this.masterLP.type = 'lowpass';
    this.masterLP.frequency.value = 9000;
    this.master.connect(this.masterLP);
    this.masterLP.connect(ctx.destination);

    // Global echo bus: ~90ms delay, filtered feedback — the SPC700 wash.
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.09;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const fbLP = ctx.createBiquadFilter();
    fbLP.type = 'lowpass';
    fbLP.frequency.value = 4200;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.55;
    this.echoIn.connect(delay);
    delay.connect(fbLP);
    fbLP.connect(fb);
    fb.connect(delay);
    delay.connect(echoOut);
    // echo slightly right-of-center for width
    const echoPan = this._pan(0.2);
    echoOut.connect(echoPan);
    echoPan.connect(this.master);

    this.channels = []; // built per song by scheduleSong
  }

  _pan(v) {
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = v;
      return p;
    }
    return this.ctx.createGain(); // mono fallback
  }

  _buildWaves() {
    const ctx = this.ctx, N = 32;
    const pulse = (duty) => {
      const real = new Float32Array(N), imag = new Float32Array(N);
      for (let n = 1; n < N; n++) imag[n] = (2 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
      return ctx.createPeriodicWave(real, imag);
    };
    // triangle-ish bass with a little 2nd-harmonic growl (SNES bass samples
    // were rarely pure triangles)
    const real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n += 2) {
      imag[n] = (8 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 ? -1 : 1);
    }
    imag[2] = 0.18; imag[3] += 0.10;
    return {
      duty12: pulse(0.125),
      duty25: pulse(0.25),
      duty50: pulse(0.5),
      tribass: ctx.createPeriodicWave(real, imag),
    };
  }

  _buildNoise() {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr, sr);
    const d = buf.getChannelData(0);
    let x = 0x12345;
    for (let i = 0; i < d.length; i++) {
      // cheap LCG white noise (deterministic across renders)
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (x / 0x3fffffff) - 1;
    }
    return buf;
  }

  _channelBus(spec) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = spec.gain;
    const pan = this._pan(spec.pan || 0);
    out.connect(pan);
    pan.connect(this.master);
    const send = ctx.createGain();
    send.gain.value = spec.echo != null ? spec.echo : 0.25;
    out.connect(send);
    send.connect(this.echoIn);
    return out;
  }

  // Melodic voice: osc + envelope + optional delayed vibrato.
  playNote(bus, spec, time, m, durSec, vel) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.waves[spec.wave]);
    osc.frequency.value = freq(m);

    const env = ctx.createGain();
    const A = 0.006, sus = 0.72, decayTau = 0.045, relTau = 0.028;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(vel, time + A);
    env.gain.setTargetAtTime(vel * sus, time + A, decayTau);
    const end = time + Math.max(durSec - 0.012, 0.03);
    env.gain.setTargetAtTime(0, end, relTau);

    osc.connect(env);
    env.connect(bus);
    osc.start(time);
    osc.stop(end + relTau * 5);

    // Subtle delayed vibrato on held notes (classic SPC lead treatment)
    if (spec.vib && durSec > 0.30) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.6;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, time);
      depth.gain.setValueAtTime(0, time + 0.16);
      depth.gain.linearRampToValueAtTime(11, time + 0.38); // cents
      lfo.connect(depth);
      depth.connect(osc.detune);
      lfo.start(time);
      lfo.stop(end + relTau * 5);
    }
  }

  playDrum(bus, time, type, vel) {
    const ctx = this.ctx;
    if (type === 'k') {
      // kick: sine pitch-drop + click
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(52, time + 0.09);
      const env = ctx.createGain();
      env.gain.setValueAtTime(vel * 1.1, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
      osc.connect(env); env.connect(bus);
      osc.start(time); osc.stop(time + 0.18);
      this._noiseHit(bus, time, vel * 0.4, 'highpass', 3000, 0.015);
    } else if (type === 's') {
      // snare: bandpassed noise + short 190Hz body
      this._noiseHit(bus, time, vel * 0.9, 'bandpass', 1900, 0.10);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, time);
      const env = ctx.createGain();
      env.gain.setValueAtTime(vel * 0.5, time);
      env.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
      osc.connect(env); env.connect(bus);
      osc.start(time); osc.stop(time + 0.09);
    } else if (type === 'h') {
      this._noiseHit(bus, time, vel * 0.42, 'highpass', 6500, 0.035);
    } else if (type === 'o') {
      this._noiseHit(bus, time, vel * 0.5, 'highpass', 5800, 0.16);
    }
  }

  _noiseHit(bus, time, vel, filterType, f, decay) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.value = f;
    if (filterType === 'bandpass') flt.Q.value = 0.9;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + decay);
    src.connect(flt); flt.connect(env); env.connect(bus);
    src.start(time, (time * 7.137) % 0.5); // deterministic noise phase
    src.stop(time + decay + 0.02);
  }

  // Schedule `loops` full passes of the song starting at audio time t0.
  // Returns seconds per loop.
  scheduleSong(song, t0, loops = 1) {
    const tickSec = 60 / song.bpm / 4; // tick = 16th
    const loopSec = song.loopTicks * tickSec;
    if (!this._buses) {
      this._buses = song.channels.map((ch) => this._channelBus(ch));
    }
    for (let L = 0; L < loops; L++) {
      const base = t0 + L * loopSec;
      song.channels.forEach((ch, i) => {
        const bus = this._buses[i];
        for (const [tick, m, dur, vel] of ch.events) {
          const t = base + tick * tickSec;
          if (ch.type === 'noise') this.playDrum(bus, t, m, vel);
          else this.playNote(bus, ch, t, m, dur * tickSec, vel);
        }
      });
    }
    return loopSec;
  }
}

// ---------------------------------------------------------------------------
// Composition helpers
// ---------------------------------------------------------------------------

const TPB = 16; // ticks per bar (4/4, 16th-note ticks)

// Join per-bar melody strings into one event list.
function melody(barStrings, vel = 1) {
  const events = [];
  barStrings.forEach((s, bar) => {
    const { events: ev, end } = parseSeq(s, bar * TPB, vel);
    if (end !== (bar + 1) * TPB) {
      throw new Error(`bar ${bar + 1} has ${end - bar * TPB} ticks (want ${TPB}): ${s}`);
    }
    events.push(...ev);
  });
  return events;
}

function drums(barStrings) {
  const events = [];
  barStrings.forEach((s, bar) => {
    const { events: ev, end } = parseDrums(s, bar * TPB);
    if (end !== (bar + 1) * TPB) {
      throw new Error(`drum bar ${bar + 1} has ${end - bar * TPB} ticks: ${s}`);
    }
    events.push(...ev);
  });
  return events;
}

// ---------------------------------------------------------------------------
// THE OVERWORLD THEME — "Skies over Gearwind"
// ---------------------------------------------------------------------------
// Heroic adventure march, Bb major, 116 BPM, 32 bars (A: 1-16, B: 17-32),
// loops seamlessly. Five channels:
//   lead      pulse 25%  — soaring melody
//   horns     pulse 12.5% — harmony line / sustained counterline
//   arp       pulse 50%  — 8th-note broken fifths (clockwork shimmer)
//   bass      tri+growl  — chugging machinery eighths
//   drums     noise      — march kit with fills
//
// Chord plan (one per bar unless split):
//  A: Bb Bb Eb Bb | F Gm Eb/F Bb | Bb Bb Eb Bb | Gm Eb Cm/F Bb
//  B: Gm Eb Cm D  | Gm Eb Cm  D  | Eb F  Gm  F | Eb Cm F  F

const LEAD = [
  // A section — first phrase: bold rising statement
  'bb4:6 c5:2 d5:4 f5:4',
  'g5:2 f5:2 d5:2 c5:2 d5:8',
  'eb5:6 f5:2 g5:8',
  'f5:4 d5:4 bb4:8',
  'c5:6 d5:2 e5:4 f5:4',
  'g5:4 f5:4 d5:4 bb4:4',
  'eb5:4 g5:4 f5:4 a4:4',
  'bb4:12 r:4',
  // second phrase: restate, cadence differently
  'bb4:6 c5:2 d5:4 f5:4',
  'g5:2 f5:2 d5:2 c5:2 d5:8',
  'g5:6 f5:2 eb5:4 c5:4',
  'd5:6 c5:2 bb4:8',
  'g4:4 bb4:4 d5:4 g5:4',
  'g5:4 f5:4 eb5:4 bb4:4',
  'c5:4 d5:4 eb5:2 d5:2 c5:2 a4:2',
  'bb4:8 r:2 f4:2 bb4:2 d5:2',
  // B section — darker, machinery minor; climbs to a climax
  'g5:6 d5:2 bb4:4 d5:4',
  'eb5:6 bb4:2 g4:4 bb4:4',
  'c5:4 eb5:4 g5:4 f5:2 eb5:2',
  'd5:8 a4:4 f#5:4',
  'g5:6 a5:2 bb5:4 a5:4',
  'g5:4 eb5:4 bb4:4 g4:4',
  'c5:2 d5:2 eb5:2 f5:2 g5:8',
  'a5:4 f#5:4 d5:4 c5:4',
  // B second half — hope returns, rising sequence back to the loop
  'bb4:6 c5:2 d5:4 eb5:4',
  'c5:6 d5:2 e5:4 f5:4',
  'd5:4 g5:4 bb5:4 a5:2 g5:2',
  'a5:4 f5:4 c5:4 a4:4',
  'g5:6 f5:2 eb5:4 g5:4',
  'g5:4 eb5:4 c5:4 eb5:4',
  'f5:8 eb5:4 d5:4',
  'c5:4 d5:2 e5:2 f5:4 a5:4',
];

const HORNS = [
  // A: sustained horn thirds under the lead (half notes)
  'd4:8 f4:8', 'bb4:8 f4:8', 'g4:8 bb4:8', 'f4:8 d4:8',
  'a4:8 c5:8', 'bb4:8 g4:8', 'g4:8 c5:8', 'd4:8 f4:8',
  'd4:8 f4:8', 'bb4:8 f4:8', 'bb4:8 g4:8', 'f4:8 d4:8',
  'bb3:8 d4:8', 'eb4:8 g4:8', 'c4:8 f4:8', 'd4:8 f4:8',
  // B: long counterline (whole notes, vibrato does the work)
  'd4:16', 'eb4:16', 'eb4:16', 'd4:16',
  'd4:16', 'eb4:16', 'c4:16', 'f#4:16',
  'g4:16', 'a4:16', 'bb4:16', 'a4:16',
  'g4:16', 'eb4:16', 'f4:16', 'c4:8 f4:8',
];

// Chords for generated channels: [bassRootNote, ...] split bars are arrays.
const CHORDS = [
  'bb2', 'bb2', 'eb3', 'bb2', 'f2', 'g2', ['eb3', 'f2'], 'bb2',
  'bb2', 'bb2', 'eb3', 'bb2', 'g2', 'eb3', ['c3', 'f2'], 'bb2',
  'g2', 'eb3', 'c3', 'd3', 'g2', 'eb3', 'c3', 'd3',
  'eb3', 'f2', 'g2', 'f2', 'eb3', 'c3', 'f2', 'f2',
];

// Chugging machinery bass: root-root-fifth pattern in eighths.
function bassEvents() {
  const events = [];
  const half = [[0, 0], [2, 0], [4, 7], [6, 0]]; // chug: root root fifth root
  // hand-written walk bars at phrase ends
  const overrides = {
    15: 'bb2:2 bb2:2 f3:2 bb2:2 d3:2 c3:2 bb2:2 a2:2',   // -> Gm (B section)
    23: 'd3:2 d3:2 a2:2 d3:2 f#2:2 a2:2 c3:2 d3:2',      // -> Eb
    31: 'f2:2 f2:2 c3:2 f2:2 f2:2 g2:2 a2:2 a2:2',       // -> Bb (loop!)
  };
  CHORDS.forEach((c, bar) => {
    if (overrides[bar] !== undefined) {
      events.push(...parseSeq(overrides[bar], bar * TPB, 0.95).events);
      return;
    }
    const chords = Array.isArray(c) ? c : [c, c];
    chords.forEach((root, h) => {
      const r = midi(root);
      for (const [t, iv] of half) {
        const tick = bar * TPB + h * 8 + t;
        // accent the downbeat of each half, like a piston stroke
        events.push([tick, r + iv, 2, t === 0 ? 1 : 0.78]);
      }
    });
  });
  return events;
}

// Clockwork arpeggio: broken fifths+octave in eighths (no 3rds — the horns
// carry the color, this is the ticking machinery).
function arpEvents() {
  const events = [];
  const pat = [0, 7, 12, 7];
  CHORDS.forEach((c, bar) => {
    if (bar < 8) return; // tacet for the opening phrase — enters at bar 9
    const chords = Array.isArray(c) ? c : [c, c];
    chords.forEach((root, h) => {
      const r = midi(root) + 12;
      for (let i = 0; i < 4; i++) {
        events.push([bar * TPB + h * 8 + i * 2, r + pat[i], 2, 0.85]);
      }
    });
  });
  return events;
}

function drumBars() {
  const N = 'k.h.s.h.k.h.s.h.';   // straight march
  const F1 = 'k.h.s.h.k.h.ssss';  // small fill
  const F2 = 'k.h.s.h.k.ssssss';  // big fill
  const B = 'k.h.s.h.kkh.s.o.';   // B section: busier, open hat push
  const bars = [];
  for (let i = 0; i < 32; i++) {
    const bar1 = i + 1;
    if (bar1 === 16 || bar1 === 32) bars.push(F2);
    else if (bar1 === 8 || bar1 === 24) bars.push(F1);
    else if (bar1 > 16) bars.push(B);
    else bars.push(N);
  }
  return bars;
}

export function overworldTheme() {
  // B-section climax (bars 21-24): push the lead a little harder
  const lead = melody(LEAD, 0.95).map(([t, m, d, v]) =>
    (t >= 20 * TPB && t < 24 * TPB) ? [t, m, d, Math.min(1, v * 1.12)] : [t, m, d, v]);
  return {
    name: 'Skies over Gearwind',
    bpm: 116,
    loopTicks: 32 * TPB,
    bars: 32,
    channels: [
      { name: 'LEAD', wave: 'duty25', gain: 0.26, pan: -0.12, echo: 0.40, vib: true, events: lead },
      { name: 'HORN', wave: 'duty12', gain: 0.15, pan: 0.18, echo: 0.42, vib: true, events: melody(HORNS, 0.9) },
      { name: 'ARP', wave: 'duty50', gain: 0.085, pan: 0.30, echo: 0.28, events: arpEvents() },
      { name: 'BASS', wave: 'tribass', gain: 0.30, pan: -0.05, echo: 0.10, events: bassEvents() },
      { name: 'DRUM', type: 'noise', gain: 0.30, pan: 0.06, echo: 0.16, events: drums(drumBars()) },
    ],
  };
}

// Seconds per tick for a song (16th note)
export function tickSeconds(song) { return 60 / song.bpm / 4; }
