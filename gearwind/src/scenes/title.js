// The front door. Title screen -> intro -> onStart.
//
//   node tools/capture.js title --frames 8 --every 20 --out shots/title
//       the title screen holding: clouds drift, the mill turns, PRESS START
//       blinks on a 60-frame cycle (36 lit / 24 dark).
//   node tools/capture.js "title&at=intro" --frames 12 --every 30 --out shots/intro
//       the whole cutscene playing itself, panel to panel.
//   node tools/capture.js "title&at=p2" --frames 1 --out shots/intro
//       one panel, text already typed.
//   node tools/capture.js "title&at=press" --press start@4 --start 60 --frames 6 --every 12
//       proves START actually leaves the title screen.
//
// Integration: `new FrontEnd({ onStart })` is the whole contract. onStart fires
// once, after the intro's last page or a START skip, with the screen already
// faded to black — the game scene can take over on the next frame.
import { FrontEnd, TitleScreen } from '../game/titlescreen.js';
import { Intro } from '../game/intro.js';

export default class TitleScene {
  async init(engine) {
    const at = engine.params.get('at') || '';
    this.mode = at;
    this.started = false;

    if (at.startsWith('p') && at.length === 2) {
      // Single panel, text already on screen — for reading one panel closely.
      this.intro = new Intro({ startPanel: Number(at[1]) || 0, onDone: () => { this.started = true; } });
      this.intro.box.press();
      this.front = null;
    } else if (at === 'intro') {
      this.intro = new Intro({ auto: true, onDone: () => { this.started = true; } });
      this.front = null;
    } else {
      this.front = new FrontEnd({ onStart: () => { this.started = true; } });
      this.intro = null;
    }
  }

  update(dt, engine) {
    if (this.front) this.front.update(dt, engine);
    else if (this.intro) this.intro.update(dt, engine);
  }

  draw(ctx, engine) {
    if (this.front) this.front.draw(ctx);
    else if (this.intro) this.intro.draw(ctx);
    if (this.started && !this.front) {
      // Stand-in for the game handing over, so the demo scene ends on
      // something instead of a black rectangle.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 256, 224);
    }
  }
}

export { FrontEnd, TitleScreen, Intro };
