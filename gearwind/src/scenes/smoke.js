// Engine smoke test: checkerboard + moving square, proves loop/capture work.
export default class SmokeScene {
  async init(engine) { this.x = 0; }
  update(dt, engine) { this.x = (this.x + 1) % 256; }
  draw(ctx, engine) {
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3a5a3a' : '#4a6a4a';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    ctx.fillStyle = '#c04040';
    ctx.fillRect(Math.round(this.x), 104, 16, 16);
  }
}
