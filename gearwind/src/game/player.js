// Aeronaut Wren — player controller with ALttP game-feel.
//
// SPEED (documented exactly): WALK_SPEED = 1.5 px per engine frame at 60fps
// on cardinals (= 90 px/s), matching ALttP Link's 0x180 subpixel velocity
// (1.5 px/frame). Diagonals are normalized: 1.5 / sqrt(2) ≈ 1.0607 px/frame
// per axis (≈1.5 px/frame of true travel). Start and stop are INSTANT — no
// acceleration ramp, exactly like the SNES original.
//
// Collision: 12x10 box at the FEET (sprite is 16x24; box sits at offset
// x+2, y+14) so the head overlaps tiles above — classic top-down depth.
// Corner-cutting assist: pushing straight into a tile/obstacle edge while
// overlapping it by <= 4 px slides the player perpendicular around the
// corner at walk speed — core ALttP feel.
//
// Walk animation is distance-driven: it advances 1 anim frame per 6 px of
// actual travel (1.5 px/frame * 4 = the ~15fps ALttP cadence). When input is
// held but travel is blocked by a solid, the cycle keeps advancing at the
// attempted walk speed so Wren steps in place against the wall (ALttP Link
// never statues mid-stride); after 16 consecutive blocked frames he settles
// into a push lean (1px into the wall on horizontal pushes) with scuff dust
// kicked back from the boots. Idle pose returns the moment input stops.
//
// UNSTICK (the mover's last line of defence). The mover itself can never walk
// into a solid, but nothing stops a scene from *placing* the body in one — a
// door landing on a wall tile, a respawn point that drifted, a crate blown
// onto Wren's feet, a bush that regrows around him. Before this existed that
// was a hard softlock with no recovery but a page reload (playtest P0: B4's
// west door landed at (62,96), inside the solid, and 100 frames of held input
// moved Wren 0.00 px). So every frame the mover first asks whether the feet
// box STARTS the frame overlapping solid geometry, and if it does it searches
// outward for the nearest position where the box is free and puts him there.
// It is deliberately impossible for this to fire in normal play: a body that
// is merely pressed flush against a wall is touching, not overlapping (the
// test shrinks the box by UNSTICK_EPS so float dust at a flush stop reads as
// contact), and the mover leaves no other overlapping state behind.
import { makePlayerSprites } from './player-sprites.js';

export const WALK_SPEED = 1.5;                     // px/frame, cardinal
const DIAG_SPEED = WALK_SPEED * Math.SQRT1_2;      // ≈ 1.0607 px/frame per axis
const HB = { x: 2, y: 14, w: 12, h: 10 };          // feet hitbox within 16x24 sprite
const STRIDE_PX = 6;                               // px of travel per walk frame
const ASSIST_PX = 4;                               // corner-cut assist range
const PUSH_DELAY = 16;                             // blocked frames before push pose
const SCUFF_EVERY = 12;                            // frames between dust kicks
// Unstick search: a fine pass at the mover's own 0.5px sub-step resolution out
// to 24px (covers every realistic bad landing), then, only if that finds
// nothing, a coarse 2px pass out to 128px so being sealed inside a thick block
// still ends in a walk rather than a reload.
const UNSTICK_EPS = 0.05;                          // penetration ignored as contact
const UNSTICK_TIERS = [[0.5, 24], [2, 128]];
const UNSTICK_RETRY = 20;                          // frames before re-searching a failure
const _offsetCache = new Map();

// Offsets from the stuck position, sorted nearest-first. Built once per tier.
function escapeOffsets(step, max) {
  const key = step + ':' + max;
  let list = _offsetCache.get(key);
  if (list) return list;
  list = [];
  const n = Math.round(max / step);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      if (!i && !j) continue;
      const dx = i * step, dy = j * step;
      const d = Math.hypot(dx, dy);
      if (d > max) continue;
      list.push({ dx, dy, d });
    }
  }
  list.sort((a, b) => a.d - b.d);
  _offsetCache.set(key, list);
  return list;
}

export class Player {
  constructor(x, y) {
    this.x = x;                 // sprite top-left, float (subpixel position)
    this.y = y;
    this.dir = 'down';
    this.moving = false;
    this.animDist = 0;          // px travelled since walk started
    this.pushFrames = 0;        // consecutive fully-blocked frames
    this.dust = [];             // scuff flecks: {x, y, vx, vy, life}
    this.sprites = makePlayerSprites();
    // --- combat extension state (driven by src/game/combat.js) ---
    this.lock = false;          // true while a sword swing owns the body
    this.attackPose = false;    // draw an attack body instead of the walk cycle
    this.attackBodies = null;   // { dir: [windUp, lunge, ..., followThrough] }
    this.attackIndex = 0;       // which body of that facing's arc to draw
    this.kbX = 0; this.kbY = 0; // knockback unit direction
    this.kbT = 0;               // knockback frames remaining (8 -> 0)
    this.invulnT = 0;           // post-hurt mercy frames (sprite blinks)
    this.flashT = 0;            // red hurt-flash frames
    this._tints = new Map();    // img -> red-tinted img cache
    // --- death state (driven by the composition: see scenes/game.js) ---
    this.dying = false;         // the spin-and-drop set piece owns the body
    this.deathT = 0;            // engine frames since the hearts ran out
    // --- unstick bookkeeping (diagnostics; see unstick()) ---
    this.unstickCount = 0;      // times the body has been pushed out of a solid
    this.unstickPx = 0;         // px of the last push (0 if it has never fired)
    this._unstickWait = 0;      // frames until a failed search is retried
    this._lastMx = 0;           // last frame's actual travel, for tie-breaking
    this._lastMy = 0;
  }

  /**
   * THE HEARTS RAN OUT. Hands the body to player-sprites.js's death set — a
   * spin, a collapse and a landed pose — and takes everything else off it, so
   * no walk frame, attack pose, knockback, mercy blink or hurt tint can draw
   * over the one animation the player is meant to be watching. Idempotent.
   * The owning scene then calls tickDeath() once per frame; see updateDeath()
   * and beginDeath() in scenes/game.js.
   */
  startDeath() {
    if (this.dying) return;
    this.dying = true;
    this.deathT = 0;
    this.lock = true;
    this.moving = false; this.animDist = 0; this.pushFrames = 0;
    this.attackPose = false; this.attackIndex = 0;
    this.kbT = 0; this.flashT = 0; this.invulnT = 0;
    this.dust.length = 0;
  }

  /**
   * Advance the death animation one engine frame. This is driven by the SCENE
   * rather than by update(), because the half that is dying freezes its own
   * world while the card is up (scenes/dungeon.js returns early on deathHold)
   * and update() would never be reached.
   */
  tickDeath() { if (this.dying) this.deathT++; }

  /** Continue: the body goes back to the walk cycle. */
  clearDeath() { this.dying = false; this.deathT = 0; this.lock = false; }

  // Hazard contact: knock Wren back 4 px/frame decaying over 8 frames along
  // (dx,dy), red flash, then invuln blink. Returns false during mercy frames.
  hurt(dx, dy) {
    // A body on the ground cannot be hurt again: a late hit landing during the
    // fall would otherwise queue knockback and a red flash behind the card.
    if (this.dying) return false;
    if (this.invulnT > 0) return false;
    const len = Math.hypot(dx, dy) || 1;
    this.kbX = dx / len; this.kbY = dy / len;
    this.kbT = 8;
    this.invulnT = 50;
    this.flashT = 6;
    return true;
  }

  get baseY() { return this.y + 24; }  // y-sort key: bottom of the feet

  _free(map, x, y) {
    return map.boxFree(x + HB.x, y + HB.y, HB.w, HB.h);
  }

  /**
   * Is the feet box OVERLAPPING solid geometry right now? The box is shrunk by
   * UNSTICK_EPS on every side first, so a body standing flush against a wall —
   * where the box edge and the solid edge are the same coordinate, and float
   * dust can put them a billionth of a pixel the wrong way — reads as contact,
   * not as penetration. Only a real overlap counts as stuck.
   */
  isStuck(map) {
    if (!map || typeof map.boxFree !== 'function') return false;
    const e = UNSTICK_EPS;
    return !map.boxFree(this.x + HB.x + e, this.y + HB.y + e,
                        HB.w - 2 * e, HB.h - 2 * e);
  }

  /**
   * NEAREST-FREE-CELL ESCAPE. If the body starts a frame inside a solid, walk
   * the offsets outward (nearest first) and take the smallest displacement
   * that puts the whole feet box in the clear. Among candidates at the same
   * distance the one pointing most along (prefX, prefY) wins — the direction
   * the player is holding, else the way they were last travelling, else the
   * way they are facing — so a door landing pushes you ON into the room you
   * were entering rather than back out through the door you came from.
   *
   * Returns true if it moved the body. Safe to call from a scene right after
   * placing the player (`player.unstick(map)`), which is cheaper than waiting
   * a frame for update() to do it.
   */
  unstick(map, prefX = 0, prefY = 0) {
    if (!this.isStuck(map)) { this._unstickWait = 0; return false; }
    if (this._unstickWait > 0) { this._unstickWait--; return false; }
    // Tie-break direction: held input, else last travel, else facing.
    let ux = prefX, uy = prefY;
    if (!ux && !uy) { ux = this._lastMx; uy = this._lastMy; }
    if (!ux && !uy) {
      ux = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0;
      uy = this.dir === 'up' ? -1 : this.dir === 'down' ? 1 : 0;
    }
    const plen = Math.hypot(ux, uy);
    if (plen) { ux /= plen; uy /= plen; }

    for (const [step, max] of UNSTICK_TIERS) {
      let best = null, bestD = Infinity, bestScore = -Infinity;
      for (const o of escapeOffsets(step, max)) {
        if (o.d > bestD + 1e-6) break;          // past the nearest ring: done
        if (!this._free(map, this.x + o.dx, this.y + o.dy)) continue;
        const score = plen ? (o.dx * ux + o.dy * uy) / o.d : 0;
        if (!best || o.d < bestD - 1e-6 || score > bestScore + 1e-9) {
          best = o; bestD = o.d; bestScore = score;
        }
      }
      if (!best) continue;
      this.x += best.dx; this.y += best.dy;
      this.unstickCount++;
      this.unstickPx = bestD;
      this._unstickWait = 0;
      // The escape is a placement, not a step: it must not feed the walk
      // cycle, the push lean or the scuff dust.
      this.pushFrames = 0;
      return true;
    }
    // Sealed in with no free footing anywhere in range (should be impossible;
    // it would mean the room has none). Back off so the search does not run
    // every frame, and try again in case the geometry opens.
    this._unstickWait = UNSTICK_RETRY;
    return false;
  }

  update(input, map) {
    // Scuff dust ages every frame, walking or not.
    for (const d of this.dust) { d.x += d.vx; d.y += d.vy; d.life--; }
    this.dust = this.dust.filter(d => d.life > 0);

    // Dead: nothing moves him and nothing else animates. deathT is advanced by
    // the scene (tickDeath), not here, so a frozen world still plays the fall.
    if (this.dying) {
      this.moving = false; this.animDist = 0; this.pushFrames = 0;
      return;
    }

    if (this.invulnT > 0) this.invulnT--;
    if (this.flashT > 0) this.flashT--;

    // Held direction, read before anything else so the unstick can break ties
    // toward where the player is trying to go.
    const dx = (input && input.held('right') ? 1 : 0) - (input && input.held('left') ? 1 : 0);
    const dy = (input && input.held('down') ? 1 : 0) - (input && input.held('up') ? 1 : 0);

    // FIRST: if a spawn, a door landing, a blown crate or a regrown bush has
    // left the feet box inside a solid, push out to the nearest free footing.
    // Skipped while a scene owns the body (lock/dying) — a cutscene may be
    // standing Wren somewhere deliberate, and a locked body cannot walk out of
    // it anyway; the escape then happens on the first frame control returns.
    if (!this.lock) this.unstick(map, dx, dy);

    // Hurt knockback overrides everything: 4 px/frame decaying linearly over
    // 8 frames, wall-clipped via the same sub-step mover.
    if (this.kbT > 0) {
      const sp = 4 * this.kbT / 8;
      this._mvx = 0; this._mvy = 0;
      if (this.kbX) this._moveAxis('x', this.kbX * sp, map, false);
      if (this.kbY) this._moveAxis('y', this.kbY * sp, map, false);
      this.kbT--;
      this.moving = false; this.animDist = 0; this.pushFrames = 0;
      return;
    }

    // Sword swing lock: body frozen mid-swing (combat.js sets/clears this).
    if (this.lock) {
      this.moving = false; this.animDist = 0; this.pushFrames = 0;
      return;
    }

    this.moving = !!(dx || dy);

    if (!this.moving) {
      this.animDist = 0;        // idle: pose resets, cycle restarts next walk
      this.pushFrames = 0;
      return;
    }

    // Facing: keep current dir if it is still one of the pressed components
    // (ALttP holds facing through diagonals); otherwise horizontal wins.
    const active = [];
    if (dx < 0) active.push('left');
    if (dx > 0) active.push('right');
    if (dy < 0) active.push('up');
    if (dy > 0) active.push('down');
    if (!active.includes(this.dir)) this.dir = active[0];

    const speed = dx && dy ? DIAG_SPEED : WALK_SPEED;
    this._mvx = 0; this._mvy = 0;   // travel vector this frame (for anim)
    if (dx) this._moveAxis('x', dx * speed, map, dy === 0);
    if (dy) this._moveAxis('y', dy * speed, map, dx === 0);

    const travelled = Math.hypot(this._mvx, this._mvy);
    if (travelled > 0.05) {
      this.animDist += travelled;
      this.pushFrames = 0;
      this._lastMx = this._mvx; this._lastMy = this._mvy;
    } else {
      // Fully blocked by a solid: keep the walk cycle stepping in place at
      // the attempted speed (ALttP Link keeps marching against walls), and
      // after PUSH_DELAY frames settle into the push lean + boot scuff.
      this.animDist += WALK_SPEED;
      this.pushFrames++;
      if (this.pushFrames >= PUSH_DELAY &&
          (this.pushFrames - PUSH_DELAY) % SCUFF_EVERY === 0) {
        this._spawnScuff();
      }
    }
  }

  // Two dust flecks at the contact edge of the feet box, drifting back away
  // from the wall being pushed. Vertical pushes spawn at the VISIBLE boot
  // line (y+22, where the soles sit on screen), not the feet-box top — the
  // box top is hidden behind the torso, so dust there never showed. Flecks
  // sit at the outer boot edges (±5) so they clear the sprite silhouette.
  _spawnScuff() {
    const bx = this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0;
    const by = this.dir === 'up' ? -1 : this.dir === 'down' ? 1 : 0;
    const cx = this.x + HB.x + HB.w / 2;
    const ex = bx === 0 ? cx : bx < 0 ? this.x + HB.x : this.x + HB.x + HB.w - 1;
    const ey = by === 0 ? this.y + HB.y + HB.h - 2 : this.y + 22;
    for (const s of [-1, 1]) {
      this.dust.push({
        x: ex + (bx ? 0 : s * 5),
        y: ey + (by ? 0 : s * 2),
        // Vertical pushes: flecks fan OUTWARD past the boots (never up behind
        // the torso); up-pushes drift down so they emerge below the soles.
        vx: -bx * 0.35 + (by ? s * 0.4 : 0),
        vy: bx ? -0.05 + s * 0.2 : (by < 0 ? 0.3 : -0.1),
        life: 12,
      });
    }
  }

  // Move along one axis in 0.5px sub-steps, stopping at solids. `assist`
  // is true only when this is the sole movement axis: on a block, probe
  // whether shifting <= 4px perpendicular clears the corner, and slide
  // that way instead.
  _moveAxis(axis, amt, map, assist) {
    const sign = Math.sign(amt);
    let remaining = Math.abs(amt);
    while (remaining > 1e-6) {
      const step = Math.min(0.5, remaining) * sign;
      const nx = axis === 'x' ? this.x + step : this.x;
      const ny = axis === 'y' ? this.y + step : this.y;
      if (this._free(map, nx, ny)) {
        if (axis === 'x') this._mvx += step; else this._mvy += step;
        this.x = nx; this.y = ny;
        remaining -= Math.abs(step);
      } else {
        // Assist gets only the UNSPENT movement budget this frame, so axis
        // travel + perpendicular slide never exceeds walk speed combined.
        if (assist) this._cornerAssist(axis, sign, map, remaining);
        return;
      }
    }
  }

  _cornerAssist(axis, sign, map, budget) {
    if (budget <= 1e-6) return;
    // Find, per side, the smallest perpendicular shift (0.25px resolution,
    // up to ASSIST_PX) that clears a 1px advance on the blocked axis; keep
    // the closer corner.
    let best = null;
    for (const side of [-1, 1]) {
      for (let k = 0.25; k <= ASSIST_PX; k += 0.25) {
        const px = axis === 'x' ? this.x + sign : this.x + side * k;
        const py = axis === 'x' ? this.y + side * k : this.y + sign;
        if (this._free(map, px, py)) {
          if (!best || k < best.k) best = { side, k };
          break;
        }
      }
    }
    if (!best) return;
    // Slide toward the corner in sub-steps, clamped to the exact clearance
    // (no overshoot past the opening — no lingering subpixel offset) AND to
    // the remaining budget (never faster than walk speed).
    const max = Math.min(budget, best.k);
    let slid = 0;
    while (slid < max - 1e-6) {
      const step = Math.min(0.5, max - slid);
      const sx = axis === 'x' ? this.x : this.x + step * best.side;
      const sy = axis === 'x' ? this.y + step * best.side : this.y;
      if (!this._free(map, sx, sy)) return;
      if (axis === 'x') this._mvy += step * best.side;
      else this._mvx += step * best.side;
      this.x = sx; this.y = sy;
      slid += step;
    }
  }

  draw(ctx) {
    const rx = Math.round(this.x), ry = Math.round(this.y);
    // Scuff dust under everything (ground-level flecks).
    for (const d of this.dust) {
      ctx.fillStyle = d.life > 6 ? '#e7dcc0' : '#b9ad8d';
      ctx.fillRect(Math.round(d.x), Math.round(d.y), d.life > 8 ? 2 : 1, 1);
    }
    ctx.drawImage(this.sprites.shadow, rx + 2, ry + 20);
    // DEATH owns the body from the frame the hearts run out: the spin, the
    // collapse and the landed pose out of player-sprites.js, at the same
    // origin as any walk frame and over the same ground shadow. It is drawn
    // BEFORE the attack/walk/idle branch and returns, so nothing below can put
    // the idle pose back under the letterbox — which is exactly what the whole
    // chapter used to close on.
    if (this.dying) {
      const d = this.sprites.death;
      ctx.drawImage(d.frames[d.indexAt(this.deathT)], rx, ry);
      return;
    }
    const set = this.sprites[this.dir];
    // Attack: play the dedicated swing bodies supplied by combat.js (wind-up
    // -> lunge -> ... -> follow-through), never a frozen walk frame. Facings
    // carry different pose counts (down runs four), so index blind.
    // Facings carry different pose counts (down/left/right run four, up three)
    // and a scene can rewrite dir mid-swing (screen scroll, respawn), so the
    // index is clamped to the facing actually being drawn — otherwise an
    // interrupted swing indexes past the end and draws undefined.
    const set2 = this.attackBodies && this.attackBodies[this.dir];
    let img = this.attackPose && set2
      ? set2[Math.min(this.attackIndex, set2.length - 1)]
      : this.moving
        ? set.walk[Math.floor(this.animDist / STRIDE_PX) % 6]
        : set.idle;
    if (this.flashT > 0) {
      // 2-on/1-off red damage flash (palette-swap style, no alpha).
      if (this.flashT % 3 !== 0) img = this._tint(img);
    } else if (this.invulnT > 0 && ((this.invulnT >> 1) & 1)) {
      return; // mercy blink: body skipped every other 2 frames, shadow stays
    }
    // Push lean: after a sustained push, the body shifts 1px into the wall
    // on horizontal pushes (shadow stays planted). Vertical pushes keep the
    // in-place march + dust only, since a 1px y-shift reads as sinking.
    const ox = this.pushFrames >= PUSH_DELAY
      ? (this.dir === 'left' ? -1 : this.dir === 'right' ? 1 : 0)
      : 0;
    ctx.drawImage(img, rx + ox, ry);
  }

  // Solid-red silhouette of a body frame (SNES palette-flash damage read).
  _tint(img) {
    let t = this._tints.get(img);
    if (!t) {
      t = document.createElement('canvas');
      t.width = img.width; t.height = img.height;
      const c = t.getContext('2d');
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = '#e04838';
      c.fillRect(0, 0, t.width, t.height);
      this._tints.set(img, t);
    }
    return t;
  }
}
