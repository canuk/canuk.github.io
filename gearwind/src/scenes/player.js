// Demo scene for the hero spritesheet: four Wrens walking in place facing
// each direction (animated), plus one idle, on ALttP-style tufted grass —
// and, since the sheet carries a DEATH SET PIECE as well as a walk cycle, one
// Wren dying on a loop above them and the whole 12-frame death laid out as a
// strip below, held on its own per-frame durations. A demo scene that only
// shows the walk cycle is how a death animation ends up shipping unseen.
import { WIDTH, HEIGHT } from '../engine.js';
import { makeSprite } from '../sprites.js';
import { makePlayerSprites, DEATH_LENGTH } from '../game/player-sprites.js';

const ANIM_RATE = 4; // engine frames per walk frame (15fps, ALttP tempo)
const DEATH_LOOP = DEATH_LENGTH + 60; // fall, lie there a second, start again

const TUFT = [
  'd..d..d',
  'd..d..d',
  '.d.d.d.',
];

export default class PlayerScene {
  async init(engine) {
    this.spr = makePlayerSprites();
    this.tuft = makeSprite(TUFT, { d: '#2e6e2e' });
    this.t = 0;
  }
  update(dt, engine) {
    this.t++;
  }
  draw(ctx, engine) {
    ctx.fillStyle = '#3f8f3f';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // sparse deterministic grass tufts (hash of cell coords, no RNG drift)
    for (let cy = 0; cy < HEIGHT; cy += 16) {
      for (let cx = 0; cx < WIDTH; cx += 16) {
        const h = ((cx * 7 + cy * 13) ^ (cx >> 2)) % 23;
        if (h === 3) ctx.drawImage(this.tuft, cx + 4, cy + 6);
        else if (h === 11) ctx.drawImage(this.tuft, cx + 7, cy + 2);
      }
    }

    const frame = Math.floor(this.t / ANIM_RATE) % 6;
    const y = 96;
    const walkers = [
      ['down', 40],
      ['up', 80],
      ['left', 120],
      ['right', 160],
    ];
    for (const [dir, x] of walkers) {
      this.drawWren(ctx, this.spr[dir].walk[frame], x, y);
    }
    // idle Wren
    this.drawWren(ctx, this.spr.down.idle, 200, y);

    // THE DEATH, PLAYING. Same call the game makes: index the flat frame list
    // by engine frames elapsed and draw it where a walk frame would go.
    const d = this.spr.death;
    const dt = this.t % DEATH_LOOP;
    this.drawWren(ctx, d.frames[d.indexAt(dt)], 120, 32);

    // THE DEATH, LAID OUT. All twelve frames in play order: eight of spin,
    // the buckle, the pitch, then the landed pair — so one screenshot shows
    // the whole set piece and the height ladder running through it.
    for (let i = 0; i < d.frames.length; i++) {
      this.drawWren(ctx, d.frames[i], 8 + i * 20, 168);
    }
  }
  drawWren(ctx, img, x, y) {
    // shadow blitted at +2,+20 (same as game/player.js); its ink is baked
    // into canvas rows 2-4 so it lands under the boot soles at y+22..y+24
    ctx.drawImage(this.spr.shadow, Math.round(x + 2), Math.round(y + 20));
    ctx.drawImage(img, Math.round(x), Math.round(y));
  }
}
