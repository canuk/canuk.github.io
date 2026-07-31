// Core engine: fixed-timestep loop, input, scene management.
// Internal resolution 256x224 (SNES), integer-scaled by CSS.

export const WIDTH = 256;
export const HEIGHT = 224;
export const TILE = 16;

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set(); // cleared each frame
    const map = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
      x: 'a', X: 'a',           // A button: sword
      z: 'b', Z: 'b',           // B button: item
      Enter: 'start', Shift: 'select',
    };
    addEventListener('keydown', (e) => {
      const k = map[e.key];
      if (!k) return;
      e.preventDefault();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    addEventListener('keyup', (e) => {
      const k = map[e.key];
      if (!k) return;
      this.down.delete(k);
    });
  }
  held(k) { return this.down.has(k); }
  hit(k) { return this.pressed.has(k); }
  endFrame() { this.pressed.clear(); }
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input();
    this.scene = null;
    this.frame = 0;
    this.time = 0;
    this._acc = 0;
    this._last = null;
    // Deterministic mode for capture: ?seed=N fixes RNG, ?freeze=N stops at frame N
    const params = new URLSearchParams(location.search);
    this.params = params;
    this.seed = params.has('seed') ? Number(params.get('seed')) : null;
    this._rng = this.seed ?? 12345;
  }
  // Deterministic PRNG (mulberry32) so captures are reproducible
  rand() {
    this._rng |= 0; this._rng = (this._rng + 0x6D2B79F5) | 0;
    let t = Math.imul(this._rng ^ (this._rng >>> 15), 1 | this._rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  async setScene(scene) {
    this.scene = scene;
    if (scene.init) await scene.init(this);
    // Signal for capture tooling
    window.__sceneReady = true;
  }
  start() {
    const STEP = 1 / 60;
    const tick = (now) => {
      if (this._last === null) this._last = now;
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.25) dt = 0.25;
      this._acc += dt;
      while (this._acc >= STEP) {
        this._acc -= STEP;
        this.frame++;
        this.time += STEP;
        if (this.scene && this.scene.update) this.scene.update(STEP, this);
        this.input.endFrame();
      }
      if (this.scene && this.scene.draw) this.scene.draw(this.ctx, this);
      window.__frame = this.frame;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Step exactly n frames (used by capture tooling via page.evaluate)
  stepFrames(n) {
    const STEP = 1 / 60;
    for (let i = 0; i < n; i++) {
      this.frame++;
      this.time += STEP;
      if (this.scene && this.scene.update) this.scene.update(STEP, this);
      this.input.endFrame();
    }
    if (this.scene && this.scene.draw) this.scene.draw(this.ctx, this);
  }
}
