// Sound-test scene for the Chapter 1 SFX bank: a brass-plate rack listing
// every effect with its MEASURED envelope, grouped by category, plus a live
// readout of the voice budget and the game-side wiring.
//
//   ARROWS  move the cursor        X  play the selected effect
//   Z       toggle the auto sweep  ENTER  enable audio (browser gesture)
//
// With no input it walks the whole bank on its own, so a capture of the scene
// shows the rack working rather than a static list.
import { sfx, SOUNDS, SFX_IDS, SFX_CATS, VOICE_BUDGET, ALIASES, resolve } from '../game/sfx.js';
import { drawText } from '../game/hud.js';

const COL = {
  bg0: '#101020', bg1: '#181830',
  panel: '#202848', panelHi: '#303c60', panelLo: '#101425',
  slot: '#161c34', slotSel: '#2c3860',
  brass: '#c8a038', brassHi: '#e8cc70', brassLo: '#806018',
  text: '#e8e8d8', dim: '#8890a8', deep: '#586080',
  env: '#58c8e8', envHi: '#a8ecf8', envDim: '#2c5a74',
  led: '#e85850', ledOff: '#402838', teal: '#40b0a0',
};

const CAT_COL = {
  combat: '#e07048', pickup: '#e8cc70', ui: '#40b0a0',
  world: '#58c8e8', boss: '#c868b0',
};

const CAT_TAG = { combat: 'CMB', pickup: 'PCK', ui: 'UI', world: 'WLD', boss: 'BSS' };

const ROWS = 11;                    // rows per column
const ROW_H = 12;
const COLS_X = [5, 87, 169];        // three columns = 33 slots, the whole bank
const COL_W = 82;
const TOP = 36;

// EVERY name the rest of Chapter 1 actually fires. This list is no longer the
// source of truth: `node tools/render-sfx.js` greps them off the call sites in
// src/ on every run and exits 3 if one of them fails to resolve, which
// is the failure play() cannot report — an unknown name is SILENT, not loud, so
// a typo in a module this piece does not own would ship as a missing sound.
//   transition.js         screen-scroll door stairs lurch item-fanfare
//   items.js              steam gear bush hit
//   boss-kettleback.js    clink hit roar steam gear lurch poof
//   world/overworld.js    chest cog gear secret bush poof heart clink swing hurt
//   world/boilerworks.js  clink
//   scenes/dungeon.js     secret hurt text chest key
//   scenes/overworld.js   heart
//   scenes/game.js        heart secret death fall select
// Resolved live through resolve() and shown in the footer, so the bridge is
// visible working instead of being taken on faith. Anything unresolved would
// render red.
const WIRED = [
  ['screen-scroll', 'SCROL'], ['door', 'DOOR'], ['stairs', 'STAIR'],
  ['lurch', 'LURCH'], ['item-fanfare', 'ITEM'], ['steam', 'STEAM'],
  ['gear', 'GEAR'], ['bush', 'BUSH'], ['hit', 'HIT'], ['clink', 'CLINK'],
  ['roar', 'ROAR'], ['poof', 'POOF'], ['chest', 'CHEST'], ['cog', 'COG'],
  ['secret', 'SECRT'], ['heart', 'HEART'], ['swing', 'SWING'],
  ['hurt', 'HURT'], ['text', 'TEXT'], ['key', 'KEY'],
  ['death', 'DEATH'], ['fall', 'FALL'], ['select', 'SELCT'],
];
const BRIDGE_PER_ROW = 4;

export default class SfxScene {
  async init(engine) {
    this.ids = SFX_IDS;
    this.sel = 0;
    this.flash = new Map();     // id -> frames remaining
    this.audioOn = false;
    this.touched = false;
    this.auto = false;
    this.autoT = 0;
    this.autoI = 0;
    this.analyser = null;
    this.wave = null;
    this.bridge = WIRED.map(([nm, tag]) => [tag, resolve(nm)]);
    this.bridgeOk = this.bridge.filter(([, hit]) => hit).length;
    this.aliasCount = Object.keys(ALIASES).length;
    // The SPC700 mechanism, read live off the score's own channel buses:
    // `held` of `total` music channels are currently gated. Round 6's rack
    // drew a DUCK meter in dB, which was the wrong picture of the wrong
    // mechanism — what moves when an effect fires is a COUNT OF CHANNELS.
    this.steal = { held: 0, total: 0 };
    this.stealFade = 0;   // 0..1, decays so a 120 ms take is still visible
  }

  _enableAudio() {
    const bank = sfx.unlock();
    if (!bank) return;
    this.audioOn = true;
    try {
      const ctx = sfx.ctx;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 256;
      sfx.chip.masterLP.connect(this.analyser);
      this.wave = new Uint8Array(this.analyser.fftSize);
    } catch (e) { this.analyser = null; }
  }

  _trigger(i) {
    const id = this.ids[i];
    this.flash.set(id, Math.max(8, Math.round(SOUNDS[id].dur * 60)));
    // fired through the SAME global bridge transition.js uses, so this scene
    // exercises the shipping path rather than a private one
    if (typeof window !== 'undefined' && window.__gwSfx) window.__gwSfx(id);
    else sfx.play(id);
  }

  update(dt, engine) {
    const inp = engine.input;
    const move = (d) => {
      this.sel = (this.sel + d + this.ids.length) % this.ids.length;
      sfx.play('cursor');
    };
    if (inp.hit('start')) { this._enableAudio(); this.touched = true; }
    if (inp.hit('b')) { this.auto = !this.auto; this.autoT = 0; this.touched = true; }
    // any browsing input takes manual control and stops the idle sweep
    let manual = false;
    if (inp.hit('up')) { move(-1); manual = true; }
    if (inp.hit('down')) { move(1); manual = true; }
    if (inp.hit('left')) { move(-ROWS); manual = true; }
    if (inp.hit('right')) { move(ROWS); manual = true; }
    if (inp.hit('a')) { this._trigger(this.sel); manual = true; }
    if (manual) { this.touched = true; this.auto = false; }

    // idle demo: walk the rack by itself
    if (!this.touched && engine.frame > 45) { this.auto = true; }
    if (this.auto) {
      this.autoT -= dt;
      if (this.autoT <= 0) {
        this.sel = this.autoI % this.ids.length;
        this._trigger(this.sel);
        this.autoT = SOUNDS[this.ids[this.sel]].dur + 0.34;
        this.autoI++;
      }
    }

    for (const [k, v] of this.flash) {
      if (v <= 1) this.flash.delete(k); else this.flash.set(k, v - 1);
    }

    // Live voice-steal reading, straight off the score's channel-bus
    // AudioParams. In this scene there is usually no music scheduled, so
    // `total` is 0 and the meter falls back to the selected effect's declared
    // `steal` while it sounds — the same number, shown honestly as a count.
    const live = this.audioOn && sfx.bank ? sfx.bank.stolenVoices() : { held: 0, total: 0 };
    const cur = SOUNDS[this.ids[this.sel]];
    if (live.total) this.steal = live;
    else this.steal = { held: this.flash.has(this.ids[this.sel]) ? (cur.steal || 0) : 0, total: 0 };
    this.stealFade = Math.max(this.steal.held ? 1 : 0, this.stealFade * 0.88);
  }

  draw(ctx, engine) {
    // riveted backdrop
    for (let y = 0; y < 224; y += 8) {
      ctx.fillStyle = (y / 8) % 2 ? COL.bg0 : COL.bg1;
      ctx.fillRect(0, y, 256, 8);
    }

    // --- header ------------------------------------------------------------
    this._plate(ctx, 5, 4, 246, 18);
    drawText(ctx, 'GEARWIND SOUND EFFECT BANK', 20, 8, COL.brassHi, COL.panelLo);
    drawText(ctx, String(this.ids.length), 186, 8, COL.teal, COL.panelLo);
    drawText(ctx, 'FX', 200, 8, COL.dim, COL.panelLo);
    drawText(ctx, String(this.aliasCount), 218, 8, COL.teal, COL.panelLo);
    drawText(ctx, 'AL', 236, 8, COL.dim, COL.panelLo);

    // category key (abbreviated: the meters to its right earn the space)
    let kx = 7;
    for (const cat of SFX_CATS) {
      ctx.fillStyle = CAT_COL[cat];
      ctx.fillRect(kx, 26, 3, 3);
      kx += 5;
      const tag = CAT_TAG[cat];
      drawText(ctx, tag, kx, 24, COL.deep, null);
      kx += tag.length * 6 + 3;
    }
    // live voice-budget meter (the constraint this bank is built around) and
    // the STEAL meter: music channels currently taken off the score, which is
    // the mechanism that puts effects over it
    const used = this.audioOn ? Math.min(VOICE_BUDGET, sfx.voices()) : 0;
    drawText(ctx, 'VOX', 136, 24, COL.deep, null);
    for (let i = 0; i < VOICE_BUDGET; i++) {
      ctx.fillStyle = i < used ? COL.teal : COL.ledOff;
      ctx.fillRect(158 + i * 4, 25, 3, 5);
    }
    drawText(ctx, 'STEAL', 192, 24, COL.deep, null);
    const slots = Math.max(5, this.steal.total);
    for (let i = 0; i < 5; i++) {
      const on = i < Math.min(5, Math.round(this.steal.held * 5 / slots) || this.steal.held);
      ctx.fillStyle = on ? COL.brass : COL.ledOff;
      ctx.fillRect(226 + i * 5, 25, 4, 5);
    }

    // --- the rack ----------------------------------------------------------
    for (let i = 0; i < this.ids.length; i++) {
      const id = this.ids[i];
      const s = SOUNDS[id];
      const c = Math.floor(i / ROWS), r = i % ROWS;
      const x = COLS_X[c], y = TOP + r * ROW_H;
      const on = this.flash.has(id);
      const sel = i === this.sel;

      ctx.fillStyle = sel ? COL.slotSel : COL.slot;
      ctx.fillRect(x, y, COL_W, ROW_H - 1);
      if (sel) {
        ctx.fillStyle = COL.deep;
        ctx.fillRect(x, y, COL_W, 1);
        ctx.fillRect(x, y + ROW_H - 2, COL_W, 1);
      }

      // cursor / activity lamp
      if (sel) {
        ctx.fillStyle = (engine.frame >> 3) % 2 ? COL.brassHi : COL.brass;
        ctx.fillRect(x + 1, y + 4, 1, 4);
        ctx.fillRect(x + 2, y + 5, 1, 2);
      }
      ctx.fillStyle = on ? COL.led : COL.ledOff;
      ctx.fillRect(x + 4, y + 5, 3, 3);

      drawText(ctx, s.label, x + 9, y + 1, (on || sel) ? COL.text : COL.dim, COL.panelLo);

      this._env(ctx, x + 46, y + 1, 30, 9, s,
        on ? 1 - this.flash.get(id) / Math.max(8, Math.round(s.dur * 60)) : -1);

      ctx.fillStyle = CAT_COL[s.cat];
      ctx.fillRect(x + 78, y + 1, 3, 9);
      ctx.fillStyle = COL.panelLo;
      ctx.fillRect(x + 78, y + 9, 3, 1);
    }

    // --- selected detail: description, stats, and the envelope full size ----
    const s = SOUNDS[this.ids[this.sel]];
    this._plate(ctx, 5, 170, 246, 26);
    drawText(ctx, s.desc.slice(0, 18), 10, 173, COL.text, COL.panelLo);
    // the number that fixed the mix: MUSIC CHANNELS this effect takes off the
    // score for its body (1 for a blip, 2 for a sword, 4-5 for a fanfare)
    drawText(ctx, `STEAL ${s.steal || 0}CH`, 124, 173,
      (s.steal || 0) >= 4 ? COL.brassHi : COL.teal, COL.panelLo);
    drawText(ctx, s.cat, 10, 184, CAT_COL[s.cat], COL.panelLo);
    drawText(ctx, `${s.dur.toFixed(2)}S`, 52, 184, COL.dim, COL.panelLo);
    drawText(ctx, `V${s.vox}`, 92, 184, s.vox >= 5 ? COL.brass : COL.dim, COL.panelLo);
    drawText(ctx, `E${Math.round(s.echo * 100)}`, 110, 184, COL.dim, COL.panelLo);
    drawText(ctx, `G${Math.round((s.gain || 1) * 100)}`, 140, 184, COL.dim, COL.panelLo);
    this._env(ctx, 188, 173, 58, 20, s,
      this.flash.has(this.ids[this.sel])
        ? 1 - this.flash.get(this.ids[this.sel]) / Math.max(8, Math.round(s.dur * 60))
        : -1);

    // --- footer: controls, the transition.js bridge, scope ------------------
    this._plate(ctx, 5, 196, 246, 25);
    if (!this.audioOn) {
      ctx.fillStyle = (engine.frame >> 4) % 2 ? COL.brassHi : COL.brass;
      ctx.fillRect(10, 199, 3, 8);
      drawText(ctx, 'PRESS START FOR AUDIO', 17, 199, COL.text, COL.panelLo);
    } else {
      drawText(ctx, 'X PLAY', 10, 199, COL.brassHi, COL.panelLo);
      drawText(ctx, 'Z AUTO', 52, 199, this.auto ? COL.teal : COL.dim, COL.panelLo);
      drawText(ctx, 'ARROWS', 94, 199, COL.dim, COL.panelLo);
    }
    // every name the rest of Chapter 1 fires, resolved live through the bridge;
    // five at a time so all 20 pass under the eye, red if any fails to resolve
    let bx = 10;
    drawText(ctx, `WIRED ${this.bridgeOk} OK`, bx, 210,
      this.bridgeOk === this.bridge.length ? COL.teal : COL.led, null);
    bx += 74;
    const page = Math.floor(engine.frame / 45) % Math.ceil(this.bridge.length / BRIDGE_PER_ROW);
    for (let i = 0; i < BRIDGE_PER_ROW; i++) {
      const row = this.bridge[page * BRIDGE_PER_ROW + i];
      if (!row) break;
      drawText(ctx, row[1] ? row[0] : row[0] + '!', bx, 210, row[1] ? COL.dim : COL.led, null);
      bx += 40;
    }

    // output scope
    ctx.fillStyle = '#101828';
    ctx.fillRect(152, 198, 94, 10);
    if (this.analyser && this.wave) {
      this.analyser.getByteTimeDomainData(this.wave);
      ctx.fillStyle = COL.env;
      for (let px = 0; px < 94; px += 1) {
        const v = this.wave[Math.round((px / 94) * (this.wave.length - 1))];
        const h = Math.min(5, Math.max(1, Math.round(Math.abs(v - 128) / 10)));
        ctx.fillRect(152 + px, 203 - h, 1, h * 2);
      }
    } else {
      // silent mode: pulse the scope from whatever is currently flashing
      let lvl = 0;
      for (const [id, f] of this.flash) {
        lvl = Math.max(lvl, f / Math.max(8, Math.round(SOUNDS[id].dur * 60)));
      }
      ctx.fillStyle = COL.envDim;
      for (let px = 0; px < 94; px += 1) {
        const h = Math.max(1, Math.round(Math.abs(Math.sin(px * 0.42 + engine.frame * 0.3)) * lvl * 5));
        ctx.fillRect(152 + px, 203 - h, 1, h * 2);
      }
    }
  }

  // Measured envelope (32 bins baked out of the rendered WAV by
  // tools/analyze-sfx.py --envs), drawn as bars; `head` 0..1 sweeps a
  // playhead across it while the effect is sounding.
  _env(ctx, x, y, w, h, s, head) {
    ctx.fillStyle = '#0c1020';
    ctx.fillRect(x, y, w, h);
    const e = s.env, nb = e.length;
    for (let px = 0; px < w; px++) {
      const b = Math.min(nb - 1, Math.floor((px / w) * nb));
      const v = (e.charCodeAt(b) - 48) / 9;
      const bars = Math.round(v * (h - 1));
      const live = head >= 0 && px / (w - 1) <= head;
      if (bars > 0) {
        ctx.fillStyle = live ? COL.env : COL.envDim;
        ctx.fillRect(x + px, y + h - bars, 1, bars);
        ctx.fillStyle = live ? COL.envHi : COL.env;
        ctx.fillRect(x + px, y + h - bars, 1, 1);
      }
    }
    if (head >= 0 && head <= 1) {
      ctx.fillStyle = COL.brassHi;
      ctx.fillRect(x + Math.round(head * (w - 1)), y, 1, h);
    }
  }

  _plate(ctx, x, y, w, h) {
    ctx.fillStyle = COL.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COL.panelHi;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = COL.panelLo;
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = COL.brassLo;
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + w - 4, y + 2, 2, 2);
    ctx.fillRect(x + 2, y + h - 4, 2, 2);
    ctx.fillRect(x + w - 4, y + h - 4, 2, 2);
  }
}
