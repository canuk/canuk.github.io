// Gearwind enemies: Clockwork Beetle (ground patroller), Gear-Bat (swooper)
// and Steam Slime (hopper). Original steampunk designs at ALttP sprite
// discipline: 16x16, dark colored outlines (never pure black), 3-4 shade
// material ramps, one glow accent (red eye pixels), small ground shadow.
//
// THE OUTLINE IS THE RULE. Measured on real ALttP sprites, the fraction of
// silhouette-edge pixels that are the dark outline colour is 92.9% for the
// blue octorok and 100.0% for the down-facing soldier: an ALttP sprite is
// fully ringed, and any pixel that leaks body colour to the edge dissolves
// into the terrain it stands on. Every sprite in this file is at or above
// that: beetle 100.0% in all twelve poses, slime 100.0%, gear-bat 100.0% in
// all seven.
//
// COVERAGE IS ONLY HALF OF IT — THE RING HAS TO BE DARK. A continuous outline
// in a colour that matches the ground is still invisible. Measured as
// |luminance(edge pixel) - luminance(the terrain it touches)| against the
// grass base #408848 (107.2) and the dirt path #887848 (126.4), and against
// ALttP crops segmented the same way:
//     REF blue octorok / grass     min dL 48.8   0.0% of edge under dL 20
//     REF soldier down / dirt      min dL 52.0   0.0%
//     beetle / gear-bat / slime    min dL 61-86  0.0%
//     steam jet, WAS               min dL  0.7  71-78%   <- Q was #5c6c80
//     steam jet, NOW               min dL 61.0   0.0%    <- Q is  #243040
// Nothing in this file is allowed on a boundary under dL 42.5, which is the
// hardest minimum any ALttP reference crop produced.
//
// COLOR STORY — four hue families that never collide:
//   cogs / treasure  = brass gold (hue ~45)
//   clockwork beetle = ONE dominant hue, oxidised-iron red-orange (hue ~18),
//                      exactly like an ALttP octorok's single saturated mass:
//                      head, carapace AND legs all sit on the same 4-step
//                      ramp. The only non-red pixels are a small cool-steel
//                      winding key and the white specular in each eye.
//   gear-bat         = violet leather wings over a dark iron gear face
//   steam slime      = the steam ramp itself, the same banded blue-grey the
//                      Boilerworks vents and the beetle's jet use, over a
//                      steel relief valve
// No enemy carries a gold ramp, so gold never means both loot and threat.
// The one glow accent, #ff5028, is the eye/pilot-light on every enemy: if
// something on this island glows hot orange, it is looking at you.
//
// ALL THREE ATTACK, AND ALL THREE TELEGRAPH FIRST (STORY.md: "Combat has a
// rhythm: approach, strike, back off. Enemies telegraph."):
//   * beetle: walk -> stop -> WIND (22 frames: braced stance, winding key
//     spinning, hiss puff at the muzzle) -> VENT (a steam jet two tiles along
//     its facing that grows over 3 stages and damages on contact).
//     Striking a winding/venting beetle interrupts the attack.
//   * bat: perch -> CLENCH (12 frames: wings clamped in, eyes flared) ->
//     swoop. The clench is the read: it says which way the dive starts.
//   * slime: breathe -> TENSE (16 frames squashed flat and wide, valve
//     glowing) -> a parabolic hop along the locked line, then a landing
//     squash it cannot cancel. Slow, but it commits.
//
// All three classes implement the hittable protocol used by combat:
//   { x, y, hurtbox, hp, onHit(dir) }
// hurtbox is a world-space {x,y,w,h}. onHit accepts a direction string
// ('up'|'down'|'left'|'right') or an {x,y} vector; it applies knockback,
// invulnerability flicker, and a steam-poof death. While a beetle's jet is
// live its hurtbox is the union of body + jet, so any host that already does
// "body box vs enemy hurtbox" contact damage (overworld.js, dungeon rooms)
// gets hurt by the steam without needing to know about it; `bodybox()` and
// `jetbox()` are there for anything that wants them apart.
//
// Determinism: every random decision goes through engine.rand().

import { makeSprite, flipH } from '../sprites.js';
import SFX from './sfx.js';

// ---------------------------------------------------------------- VOICES ---
//
// THE BESTIARY USED TO BE MUTE. Round 23 ran 300 free-running frames covering
// four beetle steam-vents, three bat dives and three full slime
// telegraph -> hop -> land cycles and logged ZERO audio events, while the
// player's own blade had been measured +6 to +11 dB over the score since round
// 20. You swung, the world answered with nothing.
//
// WHAT EACH CREATURE SAYS, and why that name and not another. Nothing is added
// to the bank (sfx.js is not this file's to edit) — these are authored sounds
// picked for what they actually are, and every one of them is voiced on the
// frame the STATE CHANGES, so the sound is the telegraph rather than a
// decoration laid over it:
//
//   beetle  wind  -> `gear`   "SWITCH SPINS DOWN": a ratchet of clicks with a
//                             spin-down under it. The windup IS a winding key,
//                             and the sound is 0.40 s against a 22-frame
//                             (0.37 s) telegraph, so it ends as the jet starts.
//           vent  -> `steam`  "JET BURST". Literal: this is a steam jet.
//   bat     dive  -> `snuff`  a hard descending air sweep (3400 -> 620 Hz) with
//                             no metal in it — the rush of something dropping
//                             past you. Fired at the launch, i.e. the frame the
//                             clench pays off. (`snuff` is the Cuff killing a
//                             vent in items.js; vents are SteamVent, which only
//                             exists in world/boilerworks.js, so the two never
//                             share a screen.)
//   slime   hop   -> `cuff`   "a valve cracks, compressed air leaves in one
//                             shove" — that is a pressure bladder launching.
//           land  -> `land`   "BOOTS HIT DECK": the landing squash is a weight
//                             arriving, and this is the bank's thud.
//
// NOT the player's blade sounds, and not `poof`/`hit`/`clink`: combat.js owns
// those for the moment steel lands, and doubling them would be two sounds for
// one event.
//
// ROUTING. The bank documents a bare `sfx.play(name)` as the whole required
// integration, and importing it installs `window.__gwSfx`, so the shipped
// hosts (scenes/overworld.js, scenes/game.js, scenes/dungeon.js) already carry
// the channel. A host that wants to own the routing sets `setEnemyVoice(fn)`
// or an `onVoice` on the instance.
//
// THE HOOK IS DELIBERATELY *NOT* CALLED `sfx` OR `onSfx`. combat.js's
// `voicesItself(e)` treats an entity with either of those as one that answers
// the blade for itself (that is how Kettleback avoids a generic `hit` on top of
// its own `clink`), so naming this hook `onSfx` would silently delete the
// beetle's, bat's and slime's HIT and POOF sounds — the round-20 work — as a
// side effect of giving them a voice.
//
// NOTHING HERE OVERRIDES `rand`, `vel`, `poly`, `minGap` OR `steal`. The bank's
// per-sound pitch jitter (gear +/-30 cents, snuff 40, cuff 70, land 80) is what
// keeps four beetles on one screen from fatiguing, its retrigger cooldowns and
// per-sound polyphony caps are what keep them inside the 8-voice budget, and
// play() is documented as always safe to call and to return false when it
// declines. The ONE exception is `steam`, which declares `rand: 0` — it is
// authored for Kettleback, where a set-piece jet firing on a fixed cycle wants
// to be exactly the same sound every time. A beetle is not a set piece and
// there can be three of them, so its vent gets +/-60 cents of jitter of its
// own, drawn from engine.rand() so a replay of the same seed is the same
// sound.
const VENT_JITTER = 60;

let VOICE_HOOK = null;

/**
 * Route every enemy sound through `fn(name, opts)` instead of the global hook.
 * Optional — the default path already reaches the bank.
 * @param {?function(string, object=): *} fn
 */
export function setEnemyVoice(fn) { VOICE_HOOK = typeof fn === 'function' ? fn : null; }

/** Fire one enemy sound. Never throws: audio may not break a fight. */
function voice(ent, name, opts) {
  if (!name) return false;
  try {
    const hook = (ent && typeof ent.onVoice === 'function') ? ent.onVoice : VOICE_HOOK;
    if (hook) return hook(name, opts) !== false;
    if (typeof window !== 'undefined' && window.__gwSfx) return window.__gwSfx(name, opts) !== false;
    return !!SFX.play(name, opts);
  } catch (e) { return false; }
}

// ------------------------------------------------------------- palettes ---

// Clockwork Beetle — one oxidised-iron ramp (E>M>D>K) carries head, shell and
// legs; steel only for the winding key. 9 colors.
export const BEETLE_PAL = {
  o: '#2a1620', // outline — very dark red-brown (never pure black)
  H: '#f8f8f8', // eye specular — same value trick ALttP uses on the octorok
  E: '#f08848', // oxide light (head, lit top of the shell)
  M: '#c85028', // oxide mid (legs, jaw)
  D: '#a83018', // oxide body
  K: '#682014', // oxide dark (shell shadow, leg underside)
  S: '#b0b8c4', // steel light — winding key only
  s: '#78828e', // steel mid
  t: '#3c4450', // steel dark
};

// Gear-Bat — violet leather wings, dark iron gear face. Violet sits a full
// 150 degrees off the beetle's oxide red, so the two enemies never blend.
export const BAT_PAL = {
  o: '#1a1024', // outline — near-black violet
  V: '#96688c', // wing spar (lit leading edge)
  v: '#5a3a5e', // wing membrane
  u: '#38203c', // wing membrane shadow
  G: '#98889c', // iron light
  g: '#645470', // iron mid
  d: '#382c40', // iron dark
  R: '#ff5028', // eye glow
  W: '#f0e4d0', // fang bone
};

// Steam — the same banded grammar the Boilerworks vents use (continuous dark
// outline, two mids, a white core), so a beetle's jet and a dungeon vent read
// as the same substance.
// The outline `Q` is DARK, not merely present. A continuous ring is worth
// nothing if it has no value contrast with the ground it crosses: the old
// #5c6c80 (luminance 105.5) sat 1.7 luminance off the grass base #408848
// (107.2), so 71-78% of the jet's edge adjacencies were under dL 20 and the
// biggest sprite in the game had a photometrically invisible boundary. Every
// clean ALttP creature crop measures 0.0% of its edge under dL 20 with a hard
// minimum of 42.5. #243040 is luminance 46.2: dL 61.0 against grass, 80.2
// against the dirt path #887848 (126.4), and 42.6 against the darkest tile
// this scene puts under a jet, the dark-grass patch #287838 (88.8). It is the
// same value as the slime's outline on purpose — all steam rings the same.
export const STEAM_PAL = {
  Q: '#243040', // outline — deep blue-grey (never pure black)
  v: '#8fa4bc', // shade
  W: '#c2d4e8', // mid
  w: '#f4f6f8', // core
};

// Steam Slime — the steam ramp given a body, so the substance the player
// already learned to fear from the vents can also walk at them. Its outline
// is a deep blue-grey: a creature has to ring itself in something much darker
// than the terrain (luminance 46 against the grass base's 107) or it
// dissolves the way a loose steam cloud does.
//
// THE SLIME MUST NOT READ AS A ROCK. It shares a screen with SP.rock and
// SP.rock_small (src/game/tileset.js), and the previous dome scored 0.95 mask
// IoU against SP.rock at 12.8 luminance apart — the same object with a blue
// tint. Two things fix that and both are load-bearing:
//   1. VALUE. The body is carried by `w` #f4f6f8 (lum 245.6) and `W` #c2d4e8
//      (208.9); `v` and `b` only shade the skirt. Mean sprite luminance is
//      151.8-155.6 against the rock's 117.8 — a 34-38 gap, not 12.8.
//   2. HUE. The rock ramp is neutral-to-olive (#c0c8ba, #8e968e, #525a52:
//      green channel highest). Every slime shade is blue (blue channel
//      highest by 20-25). The two ramps share no hue.
export const SLIME_PAL = {
  o: '#243040', // outline — deep blue-grey (never pure black)
  w: '#f4f6f8', // condensation highlight
  W: '#c2d4e8', // steam mid
  v: '#8fa4bc', // steam shade
  b: '#7488a8', // steam deep (skirt underside) — kept off the rock's value
  S: '#b0b8c4', // steel light — relief valve
  t: '#3c4450', // steel dark — valve slot
  R: '#ff5028', // pilot light — the same glow accent every enemy carries
};

// ---------------------------------------------------------------- beetle ---
// THE SILHOUETTE IS CLOSED. This is the rule the whole beetle sheet is built
// around: an ALttP sprite is fully ringed in its dark outline, and any pixel
// that leaks body colour to the edge dissolves into the terrain. Measured as
// "fraction of silhouette-edge pixels (a filled pixel with an empty
// 4-neighbour) that are the outline colour":
//     ALttP soldier, down-facing   100.0%
//     ALttP blue octorok, up       92.9%
//     every sprite below           100.0%  (counting the cell border too)
// Nothing bare touches the grass now. It matters photometrically as well as
// stylistically: the mid oxide `M` (#c85028, luminance 111.3) sits 4.1 off
// the grass base #408848 (107.2), so a bare leg tip separated from the lawn
// by hue alone and vanished in a squint test. Everything on the boundary is
// `o` #2a1620 (luminance 27), 80 below the grass.
//
// Construction that makes that possible:
//   * The carapace lives in columns 3..12 ONLY. Columns 0..2 and 13..15 are
//     leg space, so the shell never reaches the cell border and its outline
//     is never amputated by the 16x16 edge. (The ALttP blue octorok is also
//     exactly 16 wide and pulls its body in for the same reason; its
//     leftmost and rightmost columns are still #282828.)
//   * Every leg is an outline-wrapped wedge — `oMo` / `oMM` cores with `o`
//     above, below and at the tip — never a bare `MK` diagonal. That is also
//     why they read as limbs instead of as serration on the shell.
//   * The head is a lobe behind a collar seam carrying two white specular
//     eyes, the brightest thing on the sprite.
//   * The only steel is one mechanism per view: a T-crank on the shell in
//     profile, exhaust vents at the tail from behind.
// Against the ALttP reference statistics (measured on the blue octorok at
// refs/overworld-eastern-palace-grass-cliffs.png x48-74 y106-132 and the
// down-facing soldier at refs/overworld-cliff-path-soldiers.png x105-122
// y165-197): thin pixels, min(h-run,v-run) <= 2, octoroks 4.2-11.9% —
// ours down/up 7.3-9.5%, profile 5.2-5.3%. Compactness perimeter/sqrt(fill),
// octorok 7.41 / soldier 5.24 — ours 5.86-7.05. Rows with 2+ runs (limbs
// breaking the outline), octorok 5/16 / soldier 1/31 — ours 2-3/16 walking,
// 1-4/16 braced. Colour-region granularity (mean same-colour connected
// region), blue octorok 2.0 / red octorok 4.4 / soldier 4.0 — ours 3.9-4.4.
//
// The scuttle is a THREE-pose cycle on a 12-frame period run as an
// alternating tripod: the left-front / right-mid / left-rear group and its
// complement are one phase apart, and each leg cycles planted-forward ->
// planted-back -> lifted. Aligned per-pose silhouette diff (crop each pose to
// its own bounding box, XOR — translation removed): down 51 / 49 / 48 px of
// ~180 filled, up the same, profile 37 / 39 / 20. Every walk pose fills the
// same 16x16 bounding box, so those numbers are pure shape rather than a
// bbox-alignment artefact.

// DOWN: the view the player stares at. Head at the bottom behind a collar
// seam, elytra split by a 1px suture, tail lobe wagging a column each way.
const BTL_DOWN_A = [
  '.....oooo....ooo',
  '.oo.oooooo...oMo',
  '.oMoMEEDDKoooMo.',
  'oMooMEEDoDKEooo.',
  'ooooMKEDoDKKo...',
  '...oMEDDoDEKo...',
  'ooooKEDDoDKKo...',
  'oMooMEDKoKKDooo.',
  '.oMoKDDDoKDKoMo.',
  '.oooKKKKKKKKooMo',
  '...oMEEDDKKKoooo',
  '...oEKHKKHKEo...',
  '...oEKKEEKKEoooo',
  '.oooMEKEEDKKooMo',
  '.oMoMMooooMMoMo.',
  'ooo.oo....oo.oo.',
];

const BTL_DOWN_B = [
  'ooo...oooo......',
  'oMo..oooooo.....',
  '.oMooEEDDKKooo..',
  '.oooMEEDoDKEoo..',
  '...oMKEDoDKKoo..',
  '...oMEDDoDEKo...',
  '...oKEDDoDKKoooo',
  '...oMEDKoKKDooMo',
  '..ooKDDDoKDKoMo.',
  '..ooKKKKKKKKooo.',
  '..ooMEEDDKKKo...',
  '...oEKHKKHKEo...',
  'ooooEKKEEKKEo...',
  'oMooMEKEEDKKo...',
  '.oMoMMooooMMoo..',
  '.oo.oo....oo.o..',
];

const BTL_DOWN_C = [
  '.......oooo.....',
  '......oooooo.oo.',
  '..ooooEDDKKKoMo.',
  '..ooMEEDoDKEooMo',
  '..ooMKEDoDKKoooo',
  '...oMEDDoDEKo...',
  '...oKEDDoDKKo...',
  '.oooMEDKoKKDo...',
  '.oMoKDDDoKDKoo..',
  'oMooKKKKKKKKoo..',
  'ooooMEEDDKKKoo..',
  '...oEKHKKHKEo...',
  '...oEKKEEKKEo...',
  '...oMEKEEDKKooo.',
  '..ooMMooooMMoMo.',
  '..o.oo....oo.ooo',
];

// UP: the back of the machine. It shares the down view's outline row for row
// — ALttP does exactly this, one silhouette carrying both the gold up-facing
// soldier (x53-71 y42-72) and the dark down-facing one (x105-122 y165-197),
// with only the interior changing — but it is NOT the down view flipped.
// XOR(flipV(DOWN_A), UP_A) = 62 px: the taper, the leg rake and the implied
// top-light all still run the same way as the down view, where a vertical
// flip would have inverted all three. Inside it is a different machine: no
// face, no specular, a hard collar seam high on the body, a 2px elytra split
// against the down view's 1px suture, and steel exhaust vents at the tail.
const BTL_UP_A = [
  '.....oooo....ooo',
  '.oo.oooooo...oMo',
  '.oMoMEEKEEoooMo.',
  'oMooMEEEEKDKooo.',
  'ooooMKEEEDDKo...',
  '...oooooooooo...',
  'ooooMEEooEDKo...',
  'oMooMKDooDKEooo.',
  '.oMoMEDooDKKoMo.',
  '.oooMEKooDEKooMo',
  '...oMDDooDKKoooo',
  '...oKDKooKDKo...',
  '...oKDDooKKKoooo',
  '.oooKDKDDKDKooMo',
  '.oMosSooooSsoMo.',
  'ooo.oo....oo.oo.',
];

const BTL_UP_B = [
  'ooo...oooo......',
  'oMo..oooooo.....',
  '.oMooEEKEEDooo..',
  '.oooMEEEEKDKoo..',
  '...oMKEEEDDKoo..',
  '...oooooooooo...',
  '...oMEEooEDKoooo',
  '...oMKDooDKEooMo',
  '..ooMEDooDKKoMo.',
  '..ooMEKooDEKooo.',
  '..ooMDDooDKKo...',
  '...oKDKooKDKo...',
  'ooooKDDooKKKo...',
  'oMooKDKDDKDKo...',
  '.oMosSooooSsoo..',
  '.oo.oo....oo.o..',
];

const BTL_UP_C = [
  '.......oooo.....',
  '......oooooo.oo.',
  '..ooooEKEEDKoMo.',
  '..ooMEEEEKDKooMo',
  '..ooMKEEEDDKoooo',
  '...oooooooooo...',
  '...oMEEooEDKo...',
  '.oooMKDooDKEo...',
  '.oMoMEDooDKKoo..',
  'oMooMEKooDEKoo..',
  'ooooMDDooDKKoo..',
  '...oKDKooKDKo...',
  '...oKDDooKKKo...',
  '...oKDKDDKDKooo.',
  '..oosSooooSsoMo.',
  '..o.oo....oo.ooo',
];

// LEFT: profile — the head lobe is thrust ahead of the shell behind an outline
// notch, with a 2px white eye in a dark socket and a jaw hooking down under
// it. The carapace domes up from the head and rounds off over the last three
// rows. The three visible legs wave reach -> swept -> lifted, one phase apart,
// so at least two are planted in every frame; A plants the front leg forward,
// B lifts the body a pixel with the middle leg tucked, C sweeps it back.
const BTL_LEFT_A = [
  '........ooo.....',
  '........oSSo....',
  '....oooooosSoo..',
  '..oooEMMKMDDKoo.',
  '.oMEEEEEMMDKKKo.',
  '.oEoooEEMKDDKKKo',
  'oEoHHoEEMMDDKDKo',
  'oEoMKoEKMMDDKKKo',
  'oMEoooEEMMDKKKo.',
  'oMMMKMMMMDDDKKo.',
  'ooooooooooooooo.',
  '..oMo.oMo...o...',
  '.oMo...oMo..o...',
  '.oo.....oo......',
  '................',
  '................',
];

const BTL_LEFT_B = [
  '........oooo....',
  '....oooooosSoo..',
  '..oooEMMKMDDKoo.',
  '.oMEEEEEMMDKKKo.',
  '.oEoooEEMKDDKKKo',
  'oEoHHoEEMMDDKDKo',
  'oEoMKoEKMMDDKKKo',
  'oMEoooEEMMDKKKo.',
  'oMMMKMMMMDDDKKo.',
  'oKooooooooooooo.',
  '.oMo...o....oMo.',
  '..oMo..o...oMo..',
  '...oo......oo...',
  '................',
  '................',
  '................',
];

const BTL_LEFT_C = [
  '........ooo.....',
  '........oSSo....',
  '....oooooosSoo..',
  '..oooEMMKMDDKoo.',
  '.oMEEEEEMMDKKKo.',
  '.oEoooEEMKDDKKKo',
  'oEoHHoEEMMDDKDKo',
  'oEoMKoEKMMDDKKKo',
  'oMEoooEEMMDKKKo.',
  'oMMMKMMMMDDDKKo.',
  'ooooooooooooooo.',
  '..o....oMo.oMo..',
  '..o...oMo...oMo.',
  '......oo.....oo.',
  '................',
  '................',
];

// --- windup poses ---------------------------------------------------------
// The telegraph is a DIFFERENT MACHINE, not a walk pose held still. The tail
// hunches three rows shorter, the whole body drops onto its haunches, the head
// plate swells a column wider each side over the front legs, and the tripod
// breaks: all six legs plant as straight wide wedges instead of raking. Same
// bbox-aligned silhouette diff used for the walk cycle, brace vs each walk
// pose: down 82 / 81 / 84, up 82 / 81 / 84, profile 75 / 62 / 73 — against a
// walk-to-walk step of 48-51 (down/up) and 20-39 (profile). The brace is now
// twice the silhouette event an ordinary stride is, which is the entire point
// of a telegraph. The spinning winding key is drawn on top of it.
const BTL_WIND_DOWN = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '.ooooEEDDKKoooo.',
  'oMMoMEDKoDKEoMMo',
  'ooooMKDDoKKKoooo',
  '...oKDDDoKDKo...',
  '...oKKKKKKKKo...',
  '.ooMEEDKDKKKooo.',
  'oMMEKHKKKHKEoMMo',
  'oooEKKEEEKKEoooo',
  '..oMEKEEEDKKo...',
  '.ooMEEEEKDKKooo.',
  'oMMoMMooooMMoMMo',
  'ooo.oo....oo.ooo',
];

const BTL_WIND_UP = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '.ooooEEKEEEoooo.',
  'oMMooooooooooMMo',
  'ooooMEEooEDKoooo',
  '...oMKDooDKEo...',
  '...oMEDooDKKo...',
  '.ooMEDKooDEKooo.',
  'oMMMDDDooKKKoMMo',
  'oooKDKDooKDKoooo',
  '..oKDDDDDKKKo...',
  '.ooKDKDDDKDKooo.',
  'oMMosSooooSsoMMo',
  'ooo.oo....oo.ooo',
];

// Profile brace: the shell squats a row flatter and the tail tucks in two
// columns, the head thrusts down and forward, and a fourth leg swings into
// view as all four plant straight and long. The static T-crank is left OFF
// the shell here: the spinning key overlay is drawn into that gap instead, so
// the profile view telegraphs with the same rotating mechanism as the others.
const BTL_WIND_LEFT = [
  '................',
  '................',
  '................',
  '................',
  '..ooooooooooo...',
  '.ooEMKMMDDKDKo..',
  'oEoooEEMKDDKDo..',
  'oEoHHoEKMMDKKo..',
  'oEoMKoEEMKDDKo..',
  'oMEoooEEMMDKDo..',
  'oMMMKMEMMDKDo...',
  'oKoooooooooo....',
  'oMo.oMo..oMo.ooo',
  'oMo.oMo..oMo.oMo',
  'oMo.oMo..oMo.oMo',
  'ooo.ooo..ooo.ooo',
];

// The winding key, drawn ON TOP of the braced pose and alternated every three
// frames: a 5x5 steel crank that reads as spinning at 1x. Steel is the only
// non-oxide material on the beetle, so the eye goes straight to it.
const KEY_P = [
  '..o..',
  '..S..',
  'oStSo',
  '..S..',
  '..o..',
];
const KEY_X = [
  'o...o',
  '.S.S.',
  '..t..',
  '.S.S.',
  'o...o',
];

// A short hiss at the muzzle in the back half of the windup — the same
// "something is about to come out of there" cue the Boilerworks vents use.
const HISS = [
  '..QQ..',
  '.QvWQ.',
  'QvWWvQ',
  '.QvvQ.',
  '..QQ..',
];

// --------------------------------------------------------------- gear-bat ---
// A dark iron gear for a face — the two top teeth double as ears — with hot
// eyes on the hub, bone fangs under the rim, and broad violet leather wings.
// The three flap poses change the silhouette across the full 16px width
// (raised / spread level / swept below), so the beat is unmissable at 1x.

const BAT_FLAP_UP = [
  '..oo........oo..',
  'ooVo........oVoo',
  'oVvVo......oVvVo',
  '.ovvvo....ovvvo.',
  '.ovuvo....ovuvo.',
  '..ovuvo..ovuvo..',
  '..ovuoGooGouvo..',
  '...ovoGGGGovo...',
  '....oGRddRGo....',
  '....oGddddGo....',
  '.....oddddo.....',
  '.....oWooWo.....',
  '......oooo......',
  '................',
  '................',
  '................',
];

const BAT_FLAP_MID = [
  '................',
  '................',
  '................',
  '................',
  '................',
  'ooooo......ooooo',
  'oVVVVooooooVVVVo',
  'ovvvvoGGGGovvvvo',
  '.ouuoGRddRGouuo.',
  '..oooGddddGooo..',
  '.....oddddo.....',
  '.....oWooWo.....',
  '......oooo......',
  '................',
  '................',
  '................',
];

const BAT_FLAP_DOWN = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '.....oGGGGo.....',
  '..oooGRddRGooo..',
  '.ovuoGddddGouvo.',
  'oVvuuoddddouuvVo',
  'ovuuooWooWoouuvo',
  '.ovo..oooo..ovo.',
  '..oo........oo..',
  '................',
  '................',
];

// Perched: wings folded but HUNCHED — each one peaks a row above the gear
// head and tapers to a 1px tip, so the resting silhouette keeps two shoulder
// spikes with a notch between them and never collapses to a lozenge. THREE
// poses now, cycled slowly, so a resting bat breathes on a three-beat instead
// of a two-beat flicker.
const BAT_PERCH_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '..o..........o..',
  '.oVo.oooooo.oVo.',
  '.oVvooGGGGoovVo.',
  '.ovvoGRddRGovvo.',
  '.ovuoGddddGouvo.',
  '.ouuooddddoouuo.',
  '..oo.oWooWo.oo..',
  '......oooo......',
  '................',
  '................',
  '................',
];

// Pose B is a genuine second pose, not pose A shifted: the head sinks between
// the shoulders (the gear teeth drop a row), the wing peaks pull inward and
// lower, and the membrane wraps further around the body.
const BAT_PERCH_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '...o........o...',
  '..oVo.oooo.oVo..',
  '..oVvoGooGovVo..',
  '.oVvvoGGGGovvVo.',
  '.ovuoGRddRGouvo.',
  '.ouuoGddddGouuo.',
  '..oo.oddddo.oo..',
  '.....oWooWo.....',
  '......oooo......',
  '................',
];

// Pose C is the exhale: the shoulder spikes drop away entirely and the wings
// spread wide and flat against the perch, so the silhouette goes from tall
// and notched to broad and low.
const BAT_PERCH_C = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..o..........o..',
  '.oVo.oooooo.oVo.',
  'oVvvoGGGGGGovvVo',
  'oVuuoGRddRGouuVo',
  '.ouuoGddddGouuo.',
  '..oo.oddddo.oo..',
  '.....oWooWo.....',
  '......oooo......',
  '................',
  '................',
];

// CLENCH — the swoop telegraph. Wings clamp in against the body (the widest
// pose in the perch family becomes the narrowest), the head lifts clear, and
// the eye glow doubles from two pixels to four. Held 12 frames before the
// dive, so the swoop can be read and stepped out of.
const BAT_CLENCH = [
  '................',
  '................',
  '................',
  '................',
  '..oo........oo..',
  '..oVo......oVo..',
  '..oVvoooooovVo..',
  '..oVvoGGGGovVo..',
  '..ovuGRddRGuvo..',
  '..ovuGRddRGuvo..',
  '..ouuoddddouuo..',
  '...oo.oooo.oo...',
  '.....oWooWo.....',
  '......oooo......',
  '................',
  '................',
];

// ------------------------------------------------------------ steam slime ---
// A bladder of condensed steam clamped around a steel relief-valve stack,
// with two pilot lights for eyes and a skirt that hangs off it in drips.
//
// IT IS NOT A DOME, AND THAT IS THE WHOLE POINT. The previous version was a
// perfectly convex 14x10 lump: 0 of 9-12 rows anywhere in the sheet had a
// second run, compactness ran 4.44-4.58 — below BOTH ALttP references — and
// it scored 0.95 mask IoU against SP.rock, the scenery the same scene plants
// three of within 30px of a spawn. A convex grey-blue dome IS a rock.
// Everything below is measured with the identical metric on the identical
// ALttP crops (blue octorok refs/overworld-eastern-palace-grass-cliffs.png
// x46-74 y104-130; down-facing soldier refs/overworld-cliff-path-soldiers.png
// x100-126 y160-200):
//
//                       compactness  rows w/ 2+ runs  IoU(rock)  mean lum
//   REF blue octorok       7.41          5/16            --         --
//   REF soldier down       5.48          4/32            --         --
//   SP.rock (scenery)      4.46          0/10           1.00      117.8
//   was: SLM_IDLE_A        4.58          0/10           0.95      130.6
//   now: SLM_IDLE_A        5.92          2/15           0.53      155.6
//   now: SLM_IDLE_B        5.94          2/15           0.50      154.5
//   now: SLM_TENSE         5.83          2/13           0.53      155.5
//   now: SLM_AIR           6.77          3/15           0.54      151.8
//
// The three things a faceted rock cannot have, all deliberate:
//   * a steel relief-valve stack breaking the crown — a flanged 6px cap over a
//     4px neck, five rows tall, the only hard-edged straight thing on it;
//   * a drip skirt: the bottom two or three rows split into 3-4 separate
//     runs with real gaps between them, which is where the multi-run rows and
//     most of the perimeter come from;
//   * a wobble — IDLE_A leans left (it reaches column 0), IDLE_B slumps and
//     rolls right (it reaches column 15) and its drips land on different
//     columns, so 31 px of silhouette re-form between breaths.
// The outline stays closed: 100% of every pose's silhouette edge is `o`,
// minimum edge dL 61.0 against grass, 80.2 against the dirt path.
// Bbox-aligned silhouette diff: breath 31, tense vs breath 44/49, air vs
// breath 69/60.

const SLM_IDLE_A = [
  '.....oooooo.....',
  '.....oSSSSo.....',
  '......oSSo......',
  '.....oSttSo.....',
  '...oowSSSSwoo...',
  '..owwwwWWwwwwo..',
  '.owwwwWWWWwwwwo.',
  '.owwwWWWWWWwwwo.',
  'owwWWWRWWRWWWwo.',
  'owWWWWWWWWWWWwo.',
  '.owWWWWWWWWWvvo.',
  '..ovWooWWWooWvo.',
  '..obbo.ovvo.obo.',
  '...oo...obo..oo.',
  '.........o......',
  '................',
];

const SLM_IDLE_B = [
  '.....oooooo.....',
  '.....oSSSSo.....',
  '......oSSo......',
  '.....oSttSo.....',
  '....oSSSSSSo....',
  '...owwwwwwwwo...',
  '..owwwwWWwwwwo..',
  '.owwwWWWWWWwwwo.',
  '.owwWWWRWWRWWWwo',
  '.owWWWWWWWWWWWwo',
  '.owWWWWWWWWWWvvo',
  '..ovWooWWWooWWvo',
  '..obWo.ovvo.obvo',
  '...oo...ooo..obo',
  '.............oo.',
  '................',
];

// TENSE — the telegraph. The bladder loses two rows off the top and gains a
// column on each side (16 wide, the widest thing in the roster), the steel
// stack sinks into it, and the skirt splays into four lobes.
const SLM_TENSE = [
  '................',
  '................',
  '.......oo.......',
  '.......oo.......',
  '......oSSo......',
  '.....oSttSo.....',
  '...oowSSSSwoo...',
  '.oowwwwWWwwwwoo.',
  'owwwwwWWWWwwwwwo',
  'owwWWWRWWWWRWWwo',
  'owWWWWWWWWWWWWwo',
  'ovWWWWWWWWWWWWvo',
  'ovWvoWWWvoWWvovo',
  'obbo.ovbo.obo.oo',
  '.oo...oo...o....',
  '................',
];

// AIR — the top of the hop: stretched to 12x15 with the valve stack leading
// and a three-drip tail trailing under it.
const SLM_AIR = [
  '.....oooooo.....',
  '.....oSSSSo.....',
  '......oSSo......',
  '.....oSttSo.....',
  '....owwSSwwo....',
  '...owwwWWwwwo...',
  '..owwWRWWRWwwo..',
  '...owwwWWwwwo...',
  '...owwWWWWwwo...',
  '...owwWWWWwwo...',
  '...owwWWWWwwo...',
  '....owoWWowo....',
  '....oo.oo.oo....',
  '....o..oo..o....',
  '.....o..o..o....',
  '................',
];

// ----------------------------------------------------------- death poof ---

const POOF_PAL = { w: '#f4f6f8', W: '#c2d4e8', o: '#8fa4bc' };
const POOF_1 = [
  '......ww......',
  '....wwwwww....',
  '...wwwwwwww...',
  '...wWwwwwWw...',
  '....WWwwWW....',
  '......WW......',
];
const POOF_2 = [
  '..ww......ww..',
  '.wwww....wwww.',
  '.wWww....wwWw.',
  '..WW..ww..WW..',
  '.....wwww.....',
  '..ww.wWWw.ww..',
  '.wWw..WW..wWw.',
  '..W........W..',
];
const POOF_3 = [
  '.oo...ww...oo.',
  'oWWo.wWWw.oWWo',
  '.oo...WW...oo.',
  '......oo......',
  '..oo......oo..',
  '.oWo......oWo.',
  '..o........o..',
];

// ------------------------------------------------------------- steam jet ---

// A 12x32 column of steam pointed DOWN, in three growth stages. Generated
// from a lobed half-width so the silhouette wobbles the way a real jet does,
// then banded outline / shade / mid / core. The outline is CONTINUOUS and it
// is DARK: a soft-edged white smear reads as alpha, which the SNES could not
// do, and an outline the same luminance as the lawn is no outline at all.
// This is the largest sprite in the game at 12x32 and the only one that deals
// damage on contact, so its boundary is the hitbox the player has to read.
// The near-white core `w` #f4f6f8 is capped to a 2px spine down the axis; the
// body of the jet is carried by the mid `W` #c2d4e8. A 32px column with a
// wide white core was the highest-value object on the screen by a distance
// and read as a water geyser rather than as steam.
const JET_W = 12, JET_L = 32;
export const JET_LEN = [13, 23, 32];   // px of reach per growth stage

// Force every silhouette-edge pixel of a generated shape to the outline
// character. The lobed-half-width generator gets the SIDES right by
// construction but leaves the nozzle lip, the far tip and any row that runs
// out to the cell border banded as `v` — 8-10 px per stage of pale shade
// touching the terrain. Running the same closure rule the hand-drawn sheets
// obey takes the jet from minimum edge dL 34.1 (on the dirt path) to 71.8.
function closeEdges(rows, ochar) {
  const h = rows.length, w = rows[0].length;
  const g = rows.map(r => r.split(''));
  const empty = (y, x) =>
    y < 0 || y >= h || x < 0 || x >= w || rows[y][x] === '.';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === '.') continue;
      if (empty(y - 1, x) || empty(y + 1, x) || empty(y, x - 1) || empty(y, x + 1)) {
        g[y][x] = ochar;
      }
    }
  }
  return g.map(r => r.join(''));
}

function jetRows(stage) {
  const grow = JET_LEN[stage];
  const rows = [];
  for (let y = 0; y < JET_L; y++) {
    if (y >= grow) { rows.push('.'.repeat(JET_W)); continue; }
    const t = y / grow;
    const r = 1.5 + t * 3.9 + Math.sin(y * 0.9) * 0.7;
    let s = '';
    for (let x = 0; x < JET_W; x++) {
      const d = Math.abs(x - 5.5);
      if (d > r + 1) s += '.';
      else if (d > r) s += 'Q';
      else if (d > r - 1.6) s += 'v';
      else if (d > 1.0) s += 'W';
      else s += 'w';
    }
    rows.push(s);
  }
  // The lip at the nozzle and the cap at the far tip are the two edges the
  // player reads to know where the damage box starts and stops.
  return closeEdges(rows, 'Q');
}

// Rotate a rows-array a quarter turn clockwise (used to aim the jet).
function rotCW(rows) {
  const h = rows.length, w = rows[0].length;
  const out = [];
  for (let y = 0; y < w; y++) {
    let s = '';
    for (let x = 0; x < h; x++) s += rows[h - 1 - x][y];
    out.push(s);
  }
  return out;
}
const flipV = (rows) => rows.slice().reverse();

// ----------------------------------------------------------------- build ---

function assert16(name, rows) {
  if (rows.length !== 16) throw new Error(`${name}: ${rows.length} rows`);
  rows.forEach((r, i) => {
    if (r.length !== 16) throw new Error(`${name} row ${i}: len ${r.length}`);
  });
}

// A tapered ellipse, not a slab: the top row is inset 3px and the bottom 4, so
// the shadow narrows away from the sprite's bottom outline instead of merging
// with it into one black mass.
function makeBlobShadow(w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = 3;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101410';
  ctx.fillRect(3, 0, w - 6, 1);
  ctx.fillRect(1, 1, w - 2, 1);
  ctx.fillRect(4, 2, w - 8, 1);
  return c;
}

export function makeEnemySprites() {
  const B = {
    down: [BTL_DOWN_A, BTL_DOWN_B, BTL_DOWN_C],
    up: [BTL_UP_A, BTL_UP_B, BTL_UP_C],
    left: [BTL_LEFT_A, BTL_LEFT_B, BTL_LEFT_C],
  };
  for (const [k, fr] of Object.entries(B)) fr.forEach((f, i) => assert16(`beetle_${k}${i}`, f));
  [BTL_WIND_DOWN, BTL_WIND_UP, BTL_WIND_LEFT]
    .forEach((f, i) => assert16(`beetle_wind${i}`, f));
  [BAT_FLAP_UP, BAT_FLAP_MID, BAT_FLAP_DOWN, BAT_PERCH_A, BAT_PERCH_B,
    BAT_PERCH_C, BAT_CLENCH].forEach((f, i) => assert16(`bat${i}`, f));
  [SLM_IDLE_A, SLM_IDLE_B, SLM_TENSE, SLM_AIR]
    .forEach((f, i) => assert16(`slime${i}`, f));

  const beetle = {
    down: B.down.map(r => makeSprite(r, BEETLE_PAL)),
    up: B.up.map(r => makeSprite(r, BEETLE_PAL)),
    left: B.left.map(r => makeSprite(r, BEETLE_PAL)),
    shadow: makeBlobShadow(12),
    key: [makeSprite(KEY_P, BEETLE_PAL), makeSprite(KEY_X, BEETLE_PAL)],
  };
  beetle.right = beetle.left.map(flipH);
  beetle.wind = {
    down: makeSprite(BTL_WIND_DOWN, BEETLE_PAL),
    up: makeSprite(BTL_WIND_UP, BEETLE_PAL),
    left: makeSprite(BTL_WIND_LEFT, BEETLE_PAL),
  };
  beetle.wind.right = flipH(beetle.wind.left);

  const jetDown = [0, 1, 2].map(jetRows);
  const jet = {
    down: jetDown.map(r => makeSprite(r, STEAM_PAL)),
    up: jetDown.map(r => makeSprite(flipV(r), STEAM_PAL)),
    left: jetDown.map(r => makeSprite(rotCW(r), STEAM_PAL)),
  };
  jet.right = jet.left.map(flipH);
  const hiss = makeSprite(HISS, STEAM_PAL);

  const bat = {
    perch: [BAT_PERCH_A, BAT_PERCH_B, BAT_PERCH_C].map(r => makeSprite(r, BAT_PAL)),
    clench: makeSprite(BAT_CLENCH, BAT_PAL),
    flap: [BAT_FLAP_UP, BAT_FLAP_MID, BAT_FLAP_DOWN].map(r => makeSprite(r, BAT_PAL)),
    shadow: makeBlobShadow(8),
  };

  const slime = {
    idle: [SLM_IDLE_A, SLM_IDLE_B].map(r => makeSprite(r, SLIME_PAL)),
    tense: makeSprite(SLM_TENSE, SLIME_PAL),
    air: makeSprite(SLM_AIR, SLIME_PAL),
    shadow: makeBlobShadow(12),
  };

  // Damage-flash sheets. Only the poses a struck creature can be drawn in
  // need one: a hit drops the beetle out of wind/vent into its recoil, so the
  // braced pose never flashes and the winding key never gets a white twin.
  beetle.white = {
    down: beetle.down.map(i => whitenSprite(i)),
    up: beetle.up.map(i => whitenSprite(i)),
    left: beetle.left.map(i => whitenSprite(i)),
    right: beetle.right.map(i => whitenSprite(i)),
  };
  bat.white = {
    perch: bat.perch.map(i => whitenSprite(i)),
    clench: whitenSprite(bat.clench),
    flap: bat.flap.map(i => whitenSprite(i)),
  };
  slime.white = {
    idle: slime.idle.map(i => whitenSprite(i)),
    tense: whitenSprite(slime.tense),
    air: whitenSprite(slime.air),
  };

  const poof = [POOF_1, POOF_2, POOF_3].map(r => makeSprite(r, POOF_PAL));
  return { beetle, bat, slime, poof, jet, hiss };
}

// ------------------------------------------------------------- behaviors ---

// ------------------------------------------------------- THE HIT REACTION ---
//
// MEASURED BEFORE (bridge beetle, sword hit, frame trace):
//   knockback  1.6 px/frame FLAT for 6 frames = 9.6 px, then it stops dead
//   white flash  none — the beetle had no `flash` field and no white sheet
//   hitstop      none
//   state        'walk' straight through the hit, and the patrol resumes on
//                the very next frame, so the enemy is back in your face
//                before the swing animation has even finished.
// The tin soldiers in B4 (world/boilerworks.js) already do this properly —
// 2.0 px/frame over 8 frames and a 4-count white flash — which is why the
// dungeon reads as a fight and the overworld does not. This block is that
// reaction, tuned up to ALttP proportions and shared by every class in this
// file so no enemy can be wired up without one again.
//
// THREE THINGS HAPPEN ON A CONNECT, IN THIS ORDER:
//   1. HITSTOP (3 frames). Struck creature and swinging player both freeze.
//      This is the whole "the blade hit something solid" read; without it the
//      sword passes through and the enemy simply teleports backwards.
//   2. WHITE FLASH (5 drawn frames, 13 on the killing blow so the corpse
//      burns white for the whole death slide). Palette flash, not alpha —
//      the SNES could not blend, and neither do we.
//   3. RECOIL, decaying linearly from 3.2 px on the first frame to 0.32 on
//      the tenth: 17.6 px over 10 frames, sub-stepped per axis so a recoil
//      into a wall grazes along it instead of being cancelled outright (the
//      old all-or-nothing test threw away the entire frame's recoil if
//      either axis was blocked).
// Then the creature does NOT resume its patrol: it lands in a short pause,
// which is the "back off" beat STORY.md asks for.
export const HIT = {
  STOP: 3,        // hitstop frames (also frozen for the attacker; see combat.js)
  FLASH: 5,       // DRAWN white frames on a non-lethal hit
  KB_T: 10,       // recoil frames
  KB_PEAK: 3.2,   // px on the first recoil frame; linear decay -> 17.6 px total
};

const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const PERP = { up: ['left', 'right'], down: ['left', 'right'], left: ['up', 'down'], right: ['up', 'down'] };
const FLIP = { up: 'down', down: 'up', left: 'right', right: 'left' };

function dirToVec(dir) {
  if (dir && typeof dir === 'object') {
    const d = Math.hypot(dir.x, dir.y) || 1;
    return [dir.x / d, dir.y / d];
  }
  return DIRV[dir] || [0, 1];
}

const irand = (engine, lo, hi) => lo + Math.floor(engine.rand() * (hi - lo + 1));

/** Recoil vector away from the strike. `scale` trims it per class. */
function kbFrom(dir, scale = 1) {
  const [vx, vy] = dirToVec(dir);
  return {
    vx: vx * HIT.KB_PEAK * scale, vy: vy * HIT.KB_PEAK * scale,
    t: HIT.KB_T, n: HIT.KB_T,
  };
}

// One frame of recoil, per axis, in 0.5px steps. `box` is the collision box
// as an offset from (ent.x, ent.y). Returns false when the recoil is spent.
function kbSlide(ent, map, box) {
  const k = ent.kb;
  const decay = k.t / k.n;                       // 1 -> 0.1 over KB_T frames
  for (const axis of ['x', 'y']) {
    const v = (axis === 'x' ? k.vx : k.vy) * decay;
    if (!v) continue;
    const sign = Math.sign(v);
    let rem = Math.abs(v);
    while (rem > 1e-6) {
      const step = Math.min(0.5, rem) * sign;
      const nx = axis === 'x' ? ent.x + step : ent.x;
      const ny = axis === 'y' ? ent.y + step : ent.y;
      if (map && !map.boxFree(nx + box.x, ny + box.y, box.w, box.h)) break;
      ent.x = nx; ent.y = ny;
      rem -= Math.abs(step);
    }
  }
  return --k.t > 0;
}

// THE FLASH IS LATCHED, BECAUSE THE UPDATE ORDER IS NOT OURS TO FIX.
// Every scene in this project calls melee.update() — which is what calls
// onHit() — BEFORE the enemy's own update(), so a naive counter is set and
// decremented inside the same frame and a 2-frame flash renders exactly once.
// (An earlier critic measured precisely that.) These two helpers make the
// counter tick on DRAWN frames instead of on update frames: `flashTick` only
// decrements once a `flashFrame` has actually put white on the screen. The
// flash is therefore exactly N rendered frames whatever order a host calls
// update and draw in, and however many times per frame it calls either.
function flashTick(ent) {
  if (ent.flash > 0 && ent._flashDrawn) { ent.flash--; ent._flashDrawn = 0; }
}
function flashFrame(ent) {
  if (!(ent.flash > 0)) return false;
  ent._flashDrawn = 1;
  return true;
}

// Solid-colour silhouette of a sprite (SNES palette flash: no alpha).
function whitenSprite(img, color = '#f8f8f8') {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return {
    x, y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

// Clockwork Beetle — ALttP octorok-style ground patrol: walk straight,
// pause, turn 90 degrees (occasionally reverse), repeat — and, like the
// octorok, stop to fire. The attack is a steam jet vented two tiles along
// its facing, in front of which sits a 22-frame windup the player can read.
export class ClockworkBeetle {
  constructor(x, y, dir = 'down') {
    this.x = x; this.y = y;           // sprite top-left (16x16)
    this.dir = dir;
    this.hp = 2;
    this.dead = false;
    this.state = 'pause';             // 'walk'|'pause'|'wind'|'vent'|'die'
    this.timer = 0;                   // frames left in state (0 = decide now)
    this.animT = 0;                   // leg-scuttle clock (advances only walking)
    this.windT = 0;                   // windup / vent clock
    this.cool = 90;                   // frames before this beetle may vent
    this.iframes = 0;
    this.kb = null;                   // {vx, vy, t, n} recoil (see kbFrom)
    this.flash = 0;                   // DRAWN white frames left (latched)
    this._flashDrawn = 0;
    this.stop = 0;                    // hitstop frames left
    this.hitstopFrames = HIT.STOP;    // what a connect costs the attacker
    this.sprites = null;              // injected by scene (shared sheet)
  }

  static SPEED = 0.5;                       // px/frame — deliberate tick-tock pace
  static STRIDE = 4;                        // engine frames per scuttle frame
  static HB = { x: 2, y: 6, w: 12, h: 9 };  // feet-level collision box
  static WIND = 22;                         // telegraph frames (~0.37s)
  static VENT = 26;                         // jet frames
  static RANGE = 76;                        // px: will aim a vent at a target
  static LANE = 22;                         // px: how far off-axis it still fires

  /** Body only — what the Cogblade is really aiming at. */
  bodybox() { return { x: this.x + 1, y: this.y + 3, w: 14, h: 12 }; }

  /** Growth stage of the live jet, or -1 when nothing is venting. */
  get jetStage() {
    if (this.state !== 'vent') return -1;
    const t = ClockworkBeetle.VENT - this.timer;   // frames since it fired
    if (t < 2) return -1;                          // valve cracks open
    if (t < 6) return 0;                           // spurt
    if (t < 10) return 1;                          // building
    if (this.timer > 6) return 2;                  // full column
    if (this.timer > 3) return 1;                  // falling off
    return 0;
  }

  /** World-space damage box of the steam, or null. */
  jetbox() {
    const s = this.jetStage;
    if (s < 0) return null;
    const len = JET_LEN[s];
    const x = Math.round(this.x), y = Math.round(this.y);
    switch (this.dir) {
      case 'up': return { x: x + 3, y: y + 1 - len, w: 10, h: len };
      case 'left': return { x: x + 1 - len, y: y + 3, w: len, h: 10 };
      case 'right': return { x: x + 15, y: y + 3, w: len, h: 10 };
      default: return { x: x + 3, y: y + 15, w: 10, h: len };
    }
  }

  // While the jet is live the hurtbox is body + jet, so every host that
  // already checks "player box vs enemy hurtbox" takes steam damage without
  // knowing the beetle can shoot. Hitting it back cancels the vent (see
  // onHit), so the extra reach never becomes a free hit for the player.
  hurtbox() {
    const jb = this.jetbox();
    return jb ? union(this.bodybox(), jb) : this.bodybox();
  }

  get baseY() { return this.y + 16; }

  onHit(dir) {
    if (this.dead || this.state === 'die' || this.iframes > 0) return;
    this.hp -= 1;
    this.iframes = 24;
    this.stop = HIT.STOP;
    this.kb = kbFrom(dir);
    // A struck beetle drops the windup: the mechanism unwinds with a cough,
    // and the pressure it had built is gone for a while.
    if (this.state === 'wind' || this.state === 'vent') this.cool = 120;
    if (this.hp <= 0) {
      // The corpse takes the hit with it: it burns white and slides the full
      // recoil before it bursts, ALttP-style, instead of popping on the spot.
      this.state = 'die'; this.timer = 15;
      this.flash = HIT.STOP + HIT.KB_T;
    } else {
      // A named state, so a trace can see the reaction and so the beetle is
      // not "walking" while it is being thrown backwards.
      this.state = 'hurt'; this.flash = HIT.FLASH;
    }
  }

  _free(map, x, y) {
    const h = ClockworkBeetle.HB;
    return map.boxFree(x + h.x, y + h.y, h.w, h.h);
  }

  // Face a target that is roughly on one of the four axes, so the jet is
  // aimed rather than sprayed. Returns false if the target is out of range.
  _aimAt(target) {
    if (!target) return false;
    const dx = target.x - (this.x + 8), dy = target.y - (this.y + 8);
    if (Math.hypot(dx, dy) > ClockworkBeetle.RANGE) return false;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dy) > ClockworkBeetle.LANE) return false;
      this.dir = dx < 0 ? 'left' : 'right';
    } else {
      if (Math.abs(dx) > ClockworkBeetle.LANE) return false;
      this.dir = dy < 0 ? 'up' : 'down';
    }
    return true;
  }

  update(engine, map, target) {
    if (this.dead) return;
    flashTick(this);
    // Hitstop: the creature is frozen mid-recoil for HIT.STOP frames while the
    // white flash reads. combat.js freezes the swinging player for the same
    // count, so the whole screen holds on the impact.
    if (this.stop > 0) { this.stop--; return; }
    if (this.state === 'die') {
      // Death slide first (white), then the steam poof.
      if (this.kb) {
        if (!kbSlide(this, map, ClockworkBeetle.HB)) { this.kb = null; this.flash = 0; }
        return;
      }
      if (--this.timer <= 0) this.dead = true;
      return;
    }
    if (this.iframes > 0) this.iframes--;
    if (this.cool > 0) this.cool--;
    if (this.kb) {
      if (!kbSlide(this, map, ClockworkBeetle.HB)) {
        this.kb = null;
        // THE BACK-OFF BEAT. It does not step straight back into the player:
        // it lands winded, and it cannot vent for another half second.
        this.state = 'pause';
        this.timer = irand(engine, 14, 26);
        this.cool = Math.max(this.cool, 30);
        this._mustTurn = false;
      }
      return;
    }

    if (this.state === 'wind') {
      // Braced and cranking: no movement, and the key spins on the windT
      // clock so the whole pose is visibly charging.
      this.windT++;
      if (--this.timer <= 0) {
        this.state = 'vent'; this.timer = ClockworkBeetle.VENT;
        // THE RELEASE. Fired on the state change, one frame before jetStage
        // leaves -1, so the burst is heard as the valve opens rather than two
        // frames into a jet that is already hurting the player.
        // vel lifts the jet above its own windup: measured, `gear` peaked
        // +5.0 dB over the score and `steam` -3.9 dB, so the harmless telegraph
        // was 8.9 dB louder than the frame that starts hurting you.
        voice(this, 'steam', { vel: 1.5, detune: (engine.rand() * 2 - 1) * VENT_JITTER });
      }
      return;
    }
    if (this.state === 'vent') {
      this.windT++;
      if (--this.timer <= 0) {
        this.state = 'pause';
        this.timer = irand(engine, 26, 46);
        this.cool = irand(engine, 130, 240);
      }
      return;
    }

    if (this.state === 'walk') {
      const [dx, dy] = DIRV[this.dir];
      const nx = this.x + dx * ClockworkBeetle.SPEED;
      const ny = this.y + dy * ClockworkBeetle.SPEED;
      if (this._free(map, nx, ny)) {
        this.x = nx; this.y = ny;
        this.animT++;
        // A beetle that walks into the player's lane stops and winds up on
        // the spot — the octorok's "stop, turn, spit" beat.
        if (this.cool <= 0 && this._aimAt(target)) {
          this.state = 'wind'; this.timer = ClockworkBeetle.WIND; this.windT = 0;
          voice(this, 'gear');       // THE TELEGRAPH. See VOICES at the top.
          return;
        }
        if (--this.timer <= 0) { this.state = 'pause'; this.timer = irand(engine, 25, 55); }
      } else {
        // Bumped a solid: stop and think, then turn away.
        this.state = 'pause'; this.timer = irand(engine, 18, 40);
        this._mustTurn = true;
      }
    } else { // pause
      // Idle beetles still tick: the mechanism twitches roughly five times a
      // second so a paused enemy never freezes into the scenery.
      this._idle = (this._idle || 0) + 1;
      if (this._idle % 2 === 0) this.animT++;
      if (--this.timer <= 0) {
        // Pressure has to go somewhere: every so often the pause becomes a
        // windup instead of a turn — aimed if the player is in a lane, and
        // straight ahead otherwise, so the beetle still threatens in hosts
        // that never pass it a target.
        if (this.cool <= 0 && (this._aimAt(target) || engine.rand() < 0.45)) {
          this.state = 'wind'; this.timer = ClockworkBeetle.WIND; this.windT = 0;
          voice(this, 'gear');
          return;
        }
        const r = engine.rand();
        const [pa, pb] = PERP[this.dir];
        let next;
        if (this._mustTurn) next = r < 0.5 ? pa : pb;
        else if (r < 0.40) next = pa;
        else if (r < 0.80) next = pb;
        else if (r < 0.92) next = this.dir;      // sometimes keep going
        else next = FLIP[this.dir];              // rarely about-face
        this._mustTurn = false;
        // Don't pick a dead-end heading if we can help it.
        const [dx, dy] = DIRV[next];
        if (!this._free(map, this.x + dx * 2, this.y + dy * 2)) next = FLIP[next];
        this.dir = next;
        this.state = 'walk';
        this.timer = irand(engine, 45, 120);
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const rx = Math.round(this.x), ry = Math.round(this.y);
    const s = this.sprites;
    const frameOf = () =>
      Math.floor(this.animT / ClockworkBeetle.STRIDE) % 3;
    if (this.state === 'die') {
      // Burning white through the death slide, then the poof.
      if (this.kb) {
        flashFrame(this);
        ctx.drawImage(s.beetle.white[this.dir][frameOf()], rx, ry);
        return;
      }
      const i = this.timer > 10 ? 0 : this.timer > 5 ? 1 : 2;
      ctx.drawImage(s.poof[i], rx + 1, ry + 4);
      return;
    }
    // The white damage flash OUTRANKS the invulnerability flicker: a struck
    // enemy that blinked out on the first frame of its own flash would show
    // nothing at all at the moment of impact.
    const white = flashFrame(this);
    if (!white && this.iframes > 0 && (this.iframes >> 1) % 2 === 0) return; // ALttP flicker
    if (white) {
      ctx.drawImage(s.beetle.shadow, rx + 2, ry + 13);
      ctx.drawImage(s.beetle.white[this.dir][frameOf()], rx, ry);
      return;
    }
    const b = s.beetle;
    // The chassis rides clear of the ground on all six legs, so the tapered
    // oval sits under the feet rather than behind the body outline.
    ctx.drawImage(b.shadow, rx + 2, ry + 13);

    if (this.state === 'wind' || this.state === 'vent') {
      // Braced pose + a 1px rattle: the machine is shaking itself apart.
      const shake = this.state === 'wind' && (this.windT >> 1) % 2 === 0 ? 1 : 0;
      const horiz = this.dir === 'left' || this.dir === 'right';
      ctx.drawImage(b.wind[this.dir], rx + (horiz ? 0 : shake), ry + (horiz ? shake : 0));
      // Winding key, spinning on a 3-frame beat.
      const k = b.key[Math.floor(this.windT / 3) & 1];
      // Key sits on the elytra of the braced pose; the profile brace leaves a
      // gap in the shell exactly where the static T-crank would otherwise be.
      const KA = { down: [5, 4], up: [5, 8], left: [7, 5], right: [4, 5] }[this.dir];
      ctx.drawImage(k, rx + KA[0] + (horiz ? 0 : shake), ry + KA[1] + (horiz ? shake : 0));
      if (this.state === 'wind' && this.timer < 12 && (this.windT >> 2) % 2 === 0) {
        // Hiss at the muzzle: the head end of the brace for each facing.
        const H = { down: [5, 14], up: [5, -3], left: [-3, 6], right: [13, 6] }[this.dir];
        ctx.drawImage(s.hiss, rx + H[0], ry + H[1]);
      }
      const st = this.jetStage;
      if (st >= 0) {
        const j = s.jet[this.dir][st];
        const JA = {
          down: [2, 15], up: [2, 1 - JET_L], left: [1 - JET_L, 2], right: [15, 2],
        }[this.dir];
        ctx.drawImage(j, rx + JA[0], ry + JA[1]);
      }
      return;
    }

    // Three-pose cycle on a period of 3 * STRIDE = 12 frames. An odd-factor
    // period matters: a two-pose flip on a power-of-two period can be sampled
    // at an interval that lands on the same pose every time and read as frozen.
    const frame = Math.floor(this.animT / ClockworkBeetle.STRIDE) % 3;
    // Head-on views bob a pixel on the mid pose (the profile art bobs itself).
    const bob = (frame === 1 && (this.dir === 'down' || this.dir === 'up')) ? -1 : 0;
    ctx.drawImage(b[this.dir][frame], rx, ry + bob);
  }
}

// Gear-Bat — ALttP keese-style: perches (breathing, not frozen), clenches as
// a readable telegraph, then swoops toward and past a target point on a
// rising-falling sine arc, glides, and re-perches. Keeps a ground anchor
// (x, y) and a height above it; the shadow stays on the ground below.
export class GearBat {
  constructor(x, y, bounds) {
    this.x = x; this.y = y;           // ground-anchor top-left (16x16 footprint)
    this.height = 0;                  // px above ground anchor
    this.bounds = bounds;             // {x0, y0, x1, y1} world px for anchors
    this.hp = 1;
    this.dead = false;
    this.state = 'perch';             // 'perch' | 'clench' | 'fly' | 'die'
    this.timer = 0;
    this.animT = 0;                   // wingbeat clock — ALWAYS advances
    this.iframes = 0;
    this.kb = null;                   // {vx, vy, t, n} recoil (see kbFrom)
    this.flash = 0;                   // DRAWN white frames left (latched)
    this._flashDrawn = 0;
    this.stop = 0;                    // hitstop frames left
    this.hitstopFrames = HIT.STOP;
    this.sprites = null;
    this._flight = null;              // {sx, sy, tx, ty, dur, t}
    this._aim = null;                 // target snapshot taken at clench time
  }

  static SPEED = 1.1;                 // px/frame along the ground track
  static PEAK = 14;                   // swoop apex height
  static BEAT = 4;                    // engine frames per wing pose
  static CLENCH = 12;                 // telegraph frames before a dive

  hurtbox() {
    return { x: this.x + 3, y: this.y - this.height + 5, w: 10, h: 9 };
  }
  get baseY() { return this.y + 16; }

  // A swatted bat used to lose a hit point and nothing else: no recoil, no
  // flash, no pause — at 1 hp the only thing the player ever saw was the poof
  // appearing where the bat had been. It now takes the blow: freeze, burn
  // white, and get knocked out of the air along the strike.
  onHit(dir) {
    if (this.dead || this.state === 'die' || this.iframes > 0) return;
    this.hp -= 1;
    this.iframes = 20;
    this.stop = HIT.STOP;
    this.kb = kbFrom(dir, 0.9);       // 15.8 px — it is lighter than a beetle
    // Keep the pose it was struck in for the white slide: a bat killed on its
    // perch that switched to the spread flap sheet read as a cloud, not as a
    // dying bat.
    this._hitPose = this.state;
    if (this.hp <= 0) {
      this.state = 'die'; this.timer = 15;
      this.flash = HIT.STOP + HIT.KB_T;
    } else {
      // Knocked off its dive: the flight is dropped and it has to perch and
      // re-telegraph before it can come at the player again.
      this.flash = HIT.FLASH;
      this._flight = null; this._aim = null;
      this.state = 'perch'; this.timer = 46;
    }
  }

  // A KNOCKED BAT IS NOT CLIPPED AGAINST THE GROUND, and that is deliberate.
  // Measured: the scrapfield bat perches at (128,176) — on top of the scrap,
  // where `map.boxFree` is FALSE — so running its recoil through the terrain
  // test produced a knockback vector of (2.82, -0.59) and a movement of
  // 0.00 px, which is the exact defect this whole change exists to kill. It
  // flies over the scenery in every other state; it recoils over it too. The
  // patrol bounds still hold it on the screen.
  _recoil() {
    if (!kbSlide(this, null, null)) this.kb = null;
    this.x = this._clampX(this.x);
    this.y = this._clampY(this.y);
    if (this.height > 0) this.height = Math.max(0, this.height - 2);
  }

  _clampX(v) { return Math.max(this.bounds.x0, Math.min(this.bounds.x1, v)); }
  _clampY(v) { return Math.max(this.bounds.y0, Math.min(this.bounds.y1, v)); }

  // Swoop toward the target and overshoot past it, keese-style.
  _startSwoop(engine, target) {
    const cx = this.x + 8, cy = this.y + 8;
    const t = target || { x: cx, y: cy };
    let dx = t.x - cx, dy = t.y - cy;
    let d = Math.hypot(dx, dy);
    if (d < 8) { dx = engine.rand() - 0.5; dy = engine.rand() - 0.5; d = Math.hypot(dx, dy) || 1; }
    const over = d + 20 + engine.rand() * 28;
    const tx = this._clampX(this.x + (dx / d) * over);
    const ty = this._clampY(this.y + (dy / d) * over);
    const dist = Math.hypot(tx - this.x, ty - this.y);
    this._flight = {
      sx: this.x, sy: this.y, tx, ty,
      dur: Math.max(46, Math.round(dist / GearBat.SPEED)), t: 0,
    };
    this.state = 'fly';
  }

  update(engine, map, target) {
    if (this.dead) return;
    flashTick(this);
    if (this.stop > 0) { this.stop--; return; }
    if (this.state === 'die') {
      if (this.kb) { this._recoil(); if (!this.kb) this.flash = 0; return; }  // white slide
      if (--this.timer <= 0) this.dead = true;
      return;
    }
    if (this.iframes > 0) this.iframes--;
    if (this.kb) { this._recoil(); this.animT++; return; }
    // The wing clock runs in every living state. Perched bats use it for a
    // slow fold/unfold breath; fliers use it for the beat.
    this.animT++;

    if (this.state === 'perch') {
      if (this.timer <= 0) this.timer = irand(engine, 70, 170);
      if (--this.timer <= 0) {
        // Clench first: wings clamp in, eyes flare, then it goes. The dive
        // line is locked in here, so what the player reads is what happens.
        this.state = 'clench';
        this.timer = GearBat.CLENCH;
        this._aim = target ? { x: target.x, y: target.y } : null;
      }
    } else if (this.state === 'clench') {
      if (--this.timer <= 0) {
        // THE DIVE. Voiced here and NOT inside _startSwoop, because that method
        // is also the "I cannot perch in a solid, hop somewhere else" retry at
        // the end of a flight — a housekeeping move with no telegraph in front
        // of it, which would put a dive sound on a frame the player has nothing
        // to read.
        this._startSwoop(engine, this._aim || target);
        voice(this, 'snuff');
      }
    } else { // fly
      const f = this._flight;
      f.t++;
      const p = Math.min(1, f.t / f.dur);
      this.x = f.sx + (f.tx - f.sx) * p;
      this.y = f.sy + (f.ty - f.sy) * p;
      // Sine arc: rise to apex, glide, sink — plus a wingbeat bob locked to
      // the flap so the body visibly lifts on the downstroke.
      this.height = Math.round(
        GearBat.PEAK * Math.sin(Math.PI * p)
        + 1.6 * Math.sin((this.animT / GearBat.BEAT) * Math.PI / 2));
      if (p >= 1) {
        this.height = 0;
        // Refuse to perch inside a solid: hop again to a fresh spot.
        if (!map.boxFree(this.x + 3, this.y + 7, 10, 8)) {
          this._startSwoop(engine, {
            x: this.bounds.x0 + engine.rand() * (this.bounds.x1 - this.bounds.x0) + 8,
            y: this.bounds.y0 + engine.rand() * (this.bounds.y1 - this.bounds.y0) + 8,
          });
        } else {
          this.state = 'perch';
          this.timer = irand(engine, 70, 170);
        }
      }
    }
  }

  // Ground shadow, drawn in the ground pass so fliers cast onto the terrain.
  drawShadow(ctx) {
    if (this.dead || this.state === 'die') return;
    const s = this.sprites.bat;
    ctx.drawImage(s.shadow, Math.round(this.x) + 4, Math.round(this.y) + 12);
  }

  draw(ctx) {
    if (this.dead) return;
    const rx = Math.round(this.x), ry = Math.round(this.y - this.height);
    const flapFrame = () => {
      const seq = [0, 1, 2, 1];
      return seq[Math.floor(this.animT / GearBat.BEAT) & 3];
    };
    const whitePose = (w, st) => (st === 'perch' ? w.perch[(this.animT >> 4) % 3]
      : st === 'clench' ? w.clench : w.flap[flapFrame()]);
    if (this.state === 'die') {
      if (this.kb) {
        flashFrame(this);
        ctx.drawImage(whitePose(this.sprites.bat.white, this._hitPose), rx, ry);
        return;
      }
      const i = this.timer > 10 ? 0 : this.timer > 5 ? 1 : 2;
      ctx.drawImage(this.sprites.poof[i], rx + 1, ry + 2);
      return;
    }
    const white = flashFrame(this);
    if (!white && this.iframes > 0 && (this.iframes >> 1) % 2 === 0) return;
    const s = this.sprites.bat;
    if (white) { ctx.drawImage(whitePose(s.white, this.state), rx, ry); return; }
    if (this.state === 'perch') {
      // slow three-pose breath: ~1/4 second per pose
      ctx.drawImage(s.perch[(this.animT >> 4) % 3], rx, ry);
    } else if (this.state === 'clench') {
      // Coiling: the pose holds while the body creeps a pixel up off the
      // perch, so the telegraph has motion in it as well as a new shape.
      ctx.drawImage(s.clench, rx, ry - (this.timer < 6 ? 1 : 0));
    } else {
      const seq = [0, 1, 2, 1];                    // ping-pong flap
      ctx.drawImage(s.flap[seq[Math.floor(this.animT / GearBat.BEAT) & 3]], rx, ry);
    }
  }
}

// Steam Slime — ALttP zol pacing: sit and breathe, TENSE (a squash the player
// can read and step out of), then commit to one parabolic hop along the line
// that was locked in during the tense. It cannot steer mid-air, so the whole
// fight is about reading the squash. Two hits; hitting it mid-hop still lands.
export class SteamSlime {
  constructor(x, y, bounds) {
    this.x = x; this.y = y;           // sprite top-left (16x16), ground anchor
    this.height = 0;                  // px above the ground anchor
    this.bounds = bounds;             // {x0, y0, x1, y1} world px
    this.hp = 2;
    this.dead = false;
    this.state = 'idle';              // 'idle' | 'tense' | 'hop' | 'land' | 'die'
    this.timer = 0;
    this.animT = 0;                   // breath clock — always advances
    this.iframes = 0;
    this.kb = null;                   // {vx, vy, t, n} recoil (see kbFrom)
    this.flash = 0;                   // DRAWN white frames left (latched)
    this._flashDrawn = 0;
    this.stop = 0;                    // hitstop frames left
    this.hitstopFrames = HIT.STOP;
    this.sprites = null;
    this._hop = null;                 // {sx, sy, tx, ty, dur, t}
  }

  static TENSE = 16;                  // telegraph frames
  static LAND = 10;                   // landing squash — cannot be cancelled
  static REACH = 40;                  // px it covers in one hop
  static MIN_HOP = 12;                // shorter than this reads as a twitch,
                                      // not a hop — never commit to one
  static BEARINGS = 12;               // half-circle steps: 0, ±15° … 180°
  static CONE = 2;                    // ±30° still reads as thrown at the player
  // Rows 6..14 of the cell: the bladder. The steel valve stack on rows 0..5
  // is not hittable and does not hurt — the same way an ALttP soldier's
  // helmet spikes sit outside his box. Grew from h:7 when the sprite gained
  // its crown, so the sword still connects where the creature looks solid.
  static HB = { x: 2, y: 6, w: 12, h: 9 };

  hurtbox() {
    const h = SteamSlime.HB;
    return { x: this.x + h.x, y: this.y - this.height + h.y, w: h.w, h: h.h };
  }
  get baseY() { return this.y + 16; }

  onHit(dir) {
    if (this.dead || this.state === 'die' || this.iframes > 0) return;
    this.hp -= 1;
    this.iframes = 22;
    this.stop = HIT.STOP;
    this.kb = kbFrom(dir, 0.8);       // 14.1 px — a heavy bladder, but it goes
    if (this.hp <= 0) {
      this.state = 'die'; this.timer = 15;
      this.flash = HIT.STOP + HIT.KB_T;
    } else {
      this.flash = HIT.FLASH;
    }
  }

  _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // The longest landing this bearing can actually deliver, or null.
  _reachOn(map, ang, reach) {
    const h = SteamSlime.HB, ca = Math.cos(ang), sa = Math.sin(ang);
    // Rungs below the full reach sit on a fixed 4 px grid, so a long randomised
    // reach tests every distance a short one would have — two launches from the
    // same tile can never disagree about whether a landing exists.
    const rungs = [reach];
    for (let d = Math.floor(reach / 4) * 4; d >= SteamSlime.MIN_HOP; d -= 4) {
      if (d < reach) rungs.push(d);
    }
    for (const d of rungs) {
      const tx = this._clamp(this.x + ca * d, this.bounds.x0, this.bounds.x1);
      const ty = this._clamp(this.y + sa * d, this.bounds.y0, this.bounds.y1);
      // The roaming box clamps rays near an edge; a clamped ray that lands on
      // the creature's own feet is a twitch, so it does not count as a landing.
      const got = Math.hypot(tx - this.x, ty - this.y);
      if (got < SteamSlime.MIN_HOP) continue;
      if (!map.boxFree(tx + h.x, ty + h.y, h.w, h.h)) continue;
      return { tx, ty, got };
    }
    return null;
  }

  // Shortening a blocked arc COLLINEARLY cannot route around geometry — it just
  // walks the landing back onto the creature's own feet. So sweep BEARINGS
  // instead. Inside the aim cone the hop still reads as thrown at Wren, so a
  // cone bearing always beats a wider one; the creature only turns away when
  // the whole cone is walled, and then any landing beats a twitch.
  _bestLanding(map, baseAng, reach) {
    let cone = null, any = null;
    for (let k = 0; k <= SteamSlime.BEARINGS; k++) {
      const dev = k * Math.PI / SteamSlime.BEARINGS;
      const signs = (k === 0 || k === SteamSlime.BEARINGS) ? [1] : [1, -1];
      for (const s of signs) {
        const hit = this._reachOn(map, baseAng + s * dev, reach);
        if (!hit) continue;
        // A turn has to pay for itself in distance: half a reach per radian.
        const value = hit.got - dev * reach * 0.5;
        const cand = { tx: hit.tx, ty: hit.ty, value };
        if (k <= SteamSlime.CONE && (!cone || value > cone.value)) cone = cand;
        if (!any || value > any.value) any = cand;
      }
      // Nothing a turn can buy beats a clean full-reach shot straight ahead, so
      // the open-ground case stays exactly the straight shot it always was.
      if (k === 0 && cone && cone.value >= reach) break;
    }
    return cone || any;
  }

  // Can this creature deliver a hop from where it stands? Asked BEFORE the
  // telegraph, at the guaranteed-minimum reach, so a 16-frame squash is never
  // a promise the launch cannot keep.
  _canHop(map) {
    return this._bestLanding(map, 0, SteamSlime.REACH * 0.7) !== null;
  }

  _launch(engine, map, target) {
    const cx = this.x + 8, cy = this.y + 8;
    let ang;
    if (target) {
      const dx = target.x - cx, dy = target.y - cy;
      ang = Math.hypot(dx, dy) < 4 ? engine.rand() * Math.PI * 2 : Math.atan2(dy, dx);
    } else ang = engine.rand() * Math.PI * 2;
    const reach = SteamSlime.REACH * (0.7 + engine.rand() * 0.6);
    // Belt and braces: retry on exactly the rungs _canHop() cleared before it
    // let the telegraph fire, so a fired telegraph always delivers a hop.
    const pick = this._bestLanding(map, ang, reach)
      || this._bestLanding(map, ang, SteamSlime.REACH * 0.7)
      || this._bestLanding(map, ang, SteamSlime.REACH * 1.3);
    if (!pick) {
      // Walled in on every bearing. Never commit to a landing inside a solid
      // and never fake the hop — sit back down and breathe.
      this._hop = null; this.height = 0;
      this.state = 'idle'; this.timer = irand(engine, 30, 60);
      return false;
    }
    this._hop = { sx: this.x, sy: this.y, tx: pick.tx, ty: pick.ty, dur: 24, t: 0 };
    this.state = 'hop';
    // THE LAUNCH — after the landing has been committed to, so a walled-in
    // slime that sits back down (the `!pick` branch above) is silent. The
    // sound and the arc are the same decision.
    voice(this, 'cuff');
    return true;
  }

  update(engine, map, target) {
    if (this.dead) return;
    flashTick(this);
    if (this.stop > 0) { this.stop--; return; }
    this.animT++;
    if (this.state === 'die') {
      if (this.kb) {
        if (!kbSlide(this, map, SteamSlime.HB)) { this.kb = null; this.flash = 0; }
        return;
      }
      if (--this.timer <= 0) this.dead = true;
      return;
    }
    if (this.iframes > 0) this.iframes--;
    if (this.kb) {
      // Knocked back on the ground; the hop is dropped and re-telegraphed.
      if (this.height > 0) this.height = Math.max(0, this.height - 3);
      if (!kbSlide(this, map, SteamSlime.HB)) {
        this.kb = null;
        this.height = 0; this._hop = null;
        this.state = 'idle'; this.timer = irand(engine, 40, 80);
      }
      return;
    }

    if (this.state === 'idle') {
      if (this.timer <= 0) this.timer = irand(engine, 60, 140);
      if (--this.timer <= 0) {
        // Only promise what the launch can deliver. If every bearing out of
        // here is walled, keep breathing instead of telegraphing into a twitch.
        if (this._canHop(map)) { this.state = 'tense'; this.timer = SteamSlime.TENSE; }
        else this.timer = irand(engine, 20, 40);
      }
    } else if (this.state === 'tense') {
      if (--this.timer <= 0) this._launch(engine, map, target);
    } else if (this.state === 'hop') {
      const f = this._hop;
      f.t++;
      const p = Math.min(1, f.t / f.dur);
      this.x = f.sx + (f.tx - f.sx) * p;
      this.y = f.sy + (f.ty - f.sy) * p;
      this.height = Math.round(11 * Math.sin(Math.PI * p));
      if (p >= 1) {
        this.height = 0;
        this.state = 'land'; this.timer = SteamSlime.LAND;
        voice(this, 'land');       // the squash lands on the same frame
      }
    } else { // land
      if (--this.timer <= 0) { this.state = 'idle'; this.timer = irand(engine, 60, 140); }
    }
  }

  // Ground shadow, drawn in the ground pass so a hopping slime casts onto the
  // terrain — the same trick the gear-bat uses, and the only cue that tells
  // the player where the arc is going to come down.
  drawShadow(ctx) {
    if (this.dead || this.state === 'die') return;
    ctx.drawImage(this.sprites.slime.shadow, Math.round(this.x) + 2, Math.round(this.y) + 13);
  }

  draw(ctx) {
    if (this.dead) return;
    const rx = Math.round(this.x), ry = Math.round(this.y - this.height);
    const s = this.sprites;
    const poseOf = (sheet) => (this.state === 'tense' || this.state === 'land')
      ? sheet.tense : this.state === 'hop' ? sheet.air
        : sheet.idle[(this.animT >> 4) & 1];
    if (this.state === 'die') {
      if (this.kb) {
        flashFrame(this);
        ctx.drawImage(poseOf(s.slime.white), rx, ry);
        return;
      }
      const i = this.timer > 10 ? 0 : this.timer > 5 ? 1 : 2;
      ctx.drawImage(s.poof[i], rx + 1, ry + 4);
      return;
    }
    const white = flashFrame(this);
    if (!white && this.iframes > 0 && (this.iframes >> 1) % 2 === 0) return; // ALttP flicker
    if (white) { ctx.drawImage(poseOf(s.slime.white), rx, ry); return; }
    const sl = s.slime;
    if (this.state === 'tense' || this.state === 'land') {
      // The squash reads at both ends of the hop: wind-up and impact.
      ctx.drawImage(sl.tense, rx, ry);
    } else if (this.state === 'hop') {
      ctx.drawImage(sl.air, rx, ry);
    } else {
      // Slow breath: ~1/3 second per pose, so an idle slime is never frozen.
      ctx.drawImage(sl.idle[(this.animT >> 4) & 1], rx, ry);
    }
  }
}
