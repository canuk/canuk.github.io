// The front door. Title screen -> FILE SELECT -> (NAME ENTRY) -> intro -> onStart.
//
//   node tools/capture.js title --frames 8 --every 20 --out shots/title
//       the title screen holding: clouds drift, the mill turns, PRESS START
//       blinks on a 60-frame cycle (36 lit / 24 dark).
//   node tools/capture.js "title&at=files" --frames 4 --every 20 --out shots/files
//       the FILE SELECT as it stands on this machine's real localStorage.
//   node tools/capture.js "title&at=files&demo=1" --frames 1 --out shots/files
//       the FILE SELECT with two invented files in it — for looking at the row
//       layout without having to play the chapter twice first.
//   node tools/capture.js "title&at=name" --frames 1 --out shots/name
//       NAME ENTRY, cursor on A, empty name.
//   node tools/capture.js "title&at=press" --press start@4 --start 60 --frames 6 --every 12
//       proves START actually leaves the title screen.
//   node tools/capture.js "title&at=intro" --frames 12 --every 30 --out shots/intro
//       the whole cutscene playing itself, panel to panel.
//   node tools/capture.js "title&at=p2" --frames 1 --out shots/intro
//       one panel, text already typed.
//
// Integration: `new FrontEnd({ onStart })` is the whole contract. onStart fires
// once, after the intro's last page or a CONTINUE, with the screen already
// faded to black — the game scene can take over on the next frame.
import { FrontEnd, TitleScreen, FileSelect, NameEntry } from '../game/titlescreen.js';
import { Intro } from '../game/intro.js';

/** Two invented rows, so `&demo=1` can show the populated layout. */
const DEMO_ROWS = [
  { slot: 1, name: 'WREN', fresh: false, playable: true, place: 'THE WINDROPE', maxHearts: 3, halves: 5, cogs: 42, sky: 2, beat: 3 },
  { slot: 2, name: 'Pell', fresh: true, playable: false, place: '', maxHearts: 3, halves: 6, cogs: 0, sky: 0, beat: 0 },
];

export default class TitleScene {
  async init(engine) {
    const at = engine.params.get('at') || '';
    this.mode = at;
    this.started = false;
    this.intro = null;
    this.front = null;

    if (at.startsWith('p') && at.length === 2) {
      // Single panel, text already on screen — for reading one panel closely.
      this.intro = new Intro({ startPanel: Number(at[1]) || 0, onDone: () => { this.started = true; } });
      this.intro.box.press();
    } else if (at === 'intro') {
      this.intro = new Intro({ auto: true, onDone: () => { this.started = true; } });
    } else {
      const demo = engine.params.get('demo') === '1' ? DEMO_ROWS : undefined;
      this.front = new FrontEnd({
        onStart: () => { this.started = true; },
        ...(demo ? { slots: demo } : {}),
      });
      // Park the capture directly on the screen being photographed. Both are
      // reached by pressing START and then A in the real front end; jumping
      // there is only so a one-frame capture does not have to script it.
      if (at === 'files' && this.front.files) this.front.state = 'files';
      if (at === 'name' && this.front.files) {
        this.front.nameFile(1);
        this.front.wipe = null;
        this.front.state = 'name';
      }
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

export { FrontEnd, TitleScreen, FileSelect, NameEntry, Intro };
