// Audio demo scene: press Enter/Start to play the overworld theme, with a
// live SPC-style channel visualizer (brass-and-rivets sound test panel).
import { ChipEngine, overworldTheme, tickSeconds } from '../game/audio.js';

const COL = {
  bg0: '#101020', bg1: '#181830', panel: '#202848', panelHi: '#303c60',
  brass: '#c8a038', brassHi: '#e8cc70', brassLo: '#806018',
  teal: '#40b0a0', text: '#e8e8d8', dim: '#8890a8',
  bar: '#58c8e8', barHi: '#a8ecf8', led: '#e85850', ledOff: '#402838',
  drum: '#e8a050',
};

export default class AudioScene {
  async init(engine) {
    this.song = overworldTheme();
    this.tickSec = tickSeconds(this.song);
    this.loopSec = this.song.loopTicks * this.tickSec;
    this.started = false;
    this.audioOk = false;
    this.songTime = 0;       // musical clock (secs into song, wraps at loop)
    this.absTime = 0;
    this.actx = null;
    this.chip = null;
    this.analyser = null;
    this.waveBuf = null;
    this._nextLoopAt = 0;    // audio-ctx time the next loop must be scheduled
    this._audioStart = 0;
  }

  _startAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.actx = new AC();
      if (this.actx.state === 'suspended') this.actx.resume();
      this.chip = new ChipEngine(this.actx);
      this.analyser = this.actx.createAnalyser();
      this.analyser.fftSize = 512;
      this.chip.masterLP.connect(this.analyser);
      this.waveBuf = new Uint8Array(this.analyser.fftSize);
      this._audioStart = this.actx.currentTime + 0.08;
      this.chip.scheduleSong(this.song, this._audioStart, 2);
      this._nextLoopAt = this._audioStart + 2 * this.loopSec;
      this.audioOk = true;
    } catch (e) {
      // headless / no-gesture environments: run the visualizer silently
      this.audioOk = false;
    }
  }

  update(dt, engine) {
    if (!this.started && engine.input.hit('start')) {
      this.started = true;
      this._startAudio();
    }
    if (!this.started) return;

    const ct = this.audioOk ? this.actx.currentTime : 0;
    this.liveAudio = this.audioOk && this.actx.state === 'running' && ct > (this._lastCt || 0);
    if (this.liveAudio) {
      // audio clock is really advancing — follow it (never step backwards,
      // headless contexts advance in sporadic chunks)
      this.absTime = Math.max(this.absTime, ct - this._audioStart);
      // keep one loop scheduled ahead of playback
      if (ct > this._nextLoopAt - 1.5) {
        this.chip.scheduleSong(this.song, this._nextLoopAt, 1);
        this._nextLoopAt += this.loopSec;
      }
    } else {
      // no audio device (headless) or suspended: silent visualizer clock
      this.absTime += dt;
    }
    this._lastCt = ct;
    this.songTime = this.absTime % this.loopSec;
  }

  // envelope level for a channel at current song time (from event data)
  _channelState(ch) {
    const tick = this.songTime / this.tickSec;
    let level = 0, note = -1;
    for (const [t, m, dur, vel] of ch.events) {
      if (ch.type === 'noise') {
        const dtT = tick - t;
        if (dtT >= 0 && dtT < 2.2) {
          const l = vel * (1 - dtT / 2.2);
          if (l > level) { level = l; note = m === 'k' ? 30 : m === 's' ? 55 : 80; }
        }
      } else if (tick >= t && tick < t + dur) {
        const secIn = (tick - t) * this.tickSec;
        const env = secIn < 0.01 ? 1 : 0.72 + 0.28 * Math.exp(-secIn / 0.045);
        const l = vel * env;
        if (l > level) { level = l; note = m; }
      }
    }
    return { level, note };
  }

  draw(ctx, engine) {
    const R = Math.round;
    // backdrop
    ctx.fillStyle = COL.bg0;
    ctx.fillRect(0, 0, 256, 224);
    for (let y = 0; y < 224; y += 8) {
      ctx.fillStyle = (y / 8) % 2 ? COL.bg0 : COL.bg1;
      ctx.fillRect(0, y, 256, 8);
    }

    // title plate
    this._plate(ctx, 24, 8, 208, 26);
    ctx.fillStyle = COL.brassHi;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('GEARWIND  SOUND TEST', 68, 13);
    ctx.fillStyle = COL.teal;
    ctx.fillText('~ SKIES OVER GEARWIND ~', 62, 23);

    if (!this.started) {
      ctx.fillStyle = (engine.frame >> 4) % 2 ? COL.text : COL.dim;
      ctx.fillText('PRESS  START', 92, 106);
      ctx.fillStyle = COL.dim;
      ctx.fillText('(ENTER)', 106, 118);
      this._gears(ctx, engine.frame * 0.02);
      return;
    }

    // position readout
    const bar = Math.floor(this.songTime / (this.tickSec * 16));
    const beat = Math.floor((this.songTime / (this.tickSec * 4)) % 4);
    const section = bar < 16 ? 'A' : 'B';
    ctx.fillStyle = COL.text;
    ctx.fillText(`BAR ${String(bar + 1).padStart(2, '0')}/32`, 32, 40);
    ctx.fillText(`SEC ${section}`, 110, 40);
    const live = !!this.liveAudio;
    ctx.fillStyle = live ? COL.teal : COL.led;
    ctx.fillText(live ? 'PLAYING' : 'MUTED', 168, 40);
    // beat lamps
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === beat ? COL.brassHi : COL.ledOff;
      ctx.fillRect(228 - 24 + i * 6 + 12, 41, 4, 4);
    }

    // channel rows
    const names = this.song.channels;
    const top = 54, rowH = 22;
    for (let i = 0; i < names.length; i++) {
      const ch = names[i];
      const y = top + i * rowH;
      const { level, note } = this._channelState(ch);
      this._plate(ctx, 16, y, 224, rowH - 4);
      ctx.fillStyle = COL.brass;
      ctx.fillText(ch.name, 22, y + 5);
      // activity LED
      ctx.fillStyle = level > 0.05 ? COL.led : COL.ledOff;
      ctx.fillRect(60, y + 6, 5, 5);
      // level meter
      const meterW = R(Math.min(1, level) * 74);
      ctx.fillStyle = '#182038';
      ctx.fillRect(70, y + 5, 76, 7);
      if (meterW > 0) {
        ctx.fillStyle = ch.type === 'noise' ? COL.drum : COL.bar;
        ctx.fillRect(71, y + 6, meterW, 5);
        ctx.fillStyle = ch.type === 'noise' ? '#f8d8a0' : COL.barHi;
        ctx.fillRect(71, y + 6, meterW, 1);
      }
      // pitch position (piano-strip 150..232 mapping midi 30..96)
      ctx.fillStyle = '#182038';
      ctx.fillRect(150, y + 5, 84, 7);
      for (let g = 0; g < 84; g += 12) {
        ctx.fillStyle = '#243050';
        ctx.fillRect(150 + g, y + 5, 1, 7);
      }
      if (note >= 0 && level > 0.03) {
        const px = R(150 + Math.max(0, Math.min(1, (note - 30) / 66)) * 80);
        ctx.fillStyle = ch.type === 'noise' ? COL.drum : COL.barHi;
        ctx.fillRect(px, y + 6, 3, 5);
      }
    }

    // waveform strip (live audio) or scanline placeholder
    const wy = top + names.length * rowH + 2;
    this._plate(ctx, 16, wy, 224, 34);
    ctx.fillStyle = COL.dim;
    ctx.fillText('SPC OUT', 22, wy + 3);
    ctx.fillStyle = '#101828';
    ctx.fillRect(22, wy + 13, 212, 16);
    if (this.liveAudio && this.analyser) {
      this.analyser.getByteTimeDomainData(this.waveBuf);
      ctx.fillStyle = COL.teal;
      for (let x = 0; x < 212; x += 2) {
        const v = this.waveBuf[R((x / 212) * this.waveBuf.length)];
        const h = Math.min(8, Math.max(1, R(Math.abs(v - 128) / 8)));
        ctx.fillRect(22 + x, wy + 21 - h, 1, h * 2);
      }
    } else {
      // silent mode: draw activity pulse from summed channel levels
      let sum = 0;
      for (const ch of this.song.channels) sum += this._channelState(ch).level;
      ctx.fillStyle = COL.teal;
      for (let x = 0; x < 212; x += 2) {
        const h = Math.min(8, Math.max(1, R((Math.sin(x * 0.3 + engine.frame * 0.2) * 0.5 + 0.5) * sum * 4)));
        ctx.fillRect(22 + x, wy + 21 - h, 1, h * 2);
      }
    }
  }

  _plate(ctx, x, y, w, h) {
    ctx.fillStyle = COL.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COL.panelHi;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = '#101425';
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
    // corner rivets
    ctx.fillStyle = COL.brassLo;
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + w - 4, y + 2, 2, 2);
    ctx.fillRect(x + 2, y + h - 4, 2, 2);
    ctx.fillRect(x + w - 4, y + h - 4, 2, 2);
  }

  _gears(ctx, a) {
    // two slowly turning brass gears while waiting
    const gear = (cx, cy, r, teeth, ang) => {
      ctx.fillStyle = COL.brassLo;
      for (let i = 0; i < teeth; i++) {
        const t = ang + (i / teeth) * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(t) * r) - 2, Math.round(cy + Math.sin(t) * r) - 2, 4, 4);
      }
      ctx.fillStyle = COL.brass;
      ctx.beginPath();
      // pixel circle via rects
      for (let y = -r + 2; y <= r - 2; y++) {
        const w = Math.floor(Math.sqrt(Math.max(0, (r - 2) * (r - 2) - y * y)));
        ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
      }
      ctx.fillStyle = COL.bg1;
      ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 4, 4);
    };
    gear(78, 160, 14, 10, a);
    gear(178, 160, 14, 10, -a + 0.3);
  }
}
