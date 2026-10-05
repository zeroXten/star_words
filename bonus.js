'use strict';

/* Bonus games: a short burst of pure fun between reading challenges.
   No reading, no way to lose; each one ends by itself. They draw on the same
   low-resolution canvas as the planets, and use `view`, `scene`, `store`,
   `sfx` and friends from the other scripts. */

const BONUS_EVERY = 2; // a bonus game after every this many crystals
const BONUS_SECONDS = 20; // how long one lasts...
const BONUS_SECONDS_PER_STAR = 4; // ...plus this for each word she read right first time
const BONUS_ORDER = ['catch', 'zap', 'fly'];
const BONUS_TITLES = { catch: 'Catch the stars!', zap: 'Zap the rocks!', fly: 'Fly through the stars!' };

let bonus = null;

const STAR_SPRITE = sprite(['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '.yy.yy.', 'yy...yy']);

// Starts the next bonus game in the rotation; the promise resolves when it's over.
function playBonus(gold) {
  return new Promise((finished) => {
    const kind = BONUS_ORDER[(store.bonusTurn || 0) % BONUS_ORDER.length];
    store.bonusTurn = (store.bonusTurn || 0) + 1;
    save();
    bonus = { kind, score: 0, left: BONUS_SECONDS + gold * BONUS_SECONDS_PER_STAR, over: false, pointer: null, sparks: [], finished, last: 0 };
    bonus.game = BONUS_GAMES[kind]();
    show('bonus');
    $('bonus-title').textContent = BONUS_TITLES[kind];
    $('bonus-title').hidden = false;
    $('bonus-count').textContent = '0';
    setTimeout(() => bonus && !bonus.over && ($('bonus-title').hidden = true), 2200);
    say('_bonus_' + kind);
    requestAnimationFrame(bonusFrame);
  });
}

function bonusFrame(now) {
  if (!bonus) return;
  const dt = Math.min(0.05, (now - bonus.last) / 1000 || 0);
  bonus.last = now;
  const t = now / 1000;
  const { W, H } = view;

  bonus.left -= dt;
  if (bonus.left <= 0 && !bonus.over) endBonus();
  bonus.game.update(dt, t, W, H);
  bonus.game.draw(g2d, W, H, t);

  for (const s of bonus.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    rect(g2d, s.life > 0.2 ? '#ffe81f' : '#f08a24', s.x, s.y, 2, 2);
  }
  bonus.sparks = bonus.sparks.filter((s) => s.life > 0);
  requestAnimationFrame(bonusFrame);
}

// One more star for the tally, with a puff of sparks where it was caught (screen position).
function bonusScore(x, y) {
  bonus.score++;
  $('bonus-count').textContent = bonus.score;
  sfx.collect(bonus.score);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bonus.sparks.push({ x, y, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.4 });
  }
}

function endBonus() {
  const b = bonus;
  b.over = true;
  store.bonus = (store.bonus || 0) + b.score;
  save();
  hush();
  sfx.fanfare();
  $('bonus-title').textContent = b.score === 1 ? '1 star!' : b.score + ' stars!';
  $('bonus-title').hidden = false;
  setTimeout(() => say('_bonus_done'), 900);
  setTimeout(() => {
    if (b.game.end) b.game.end();
    bonus = null;
    $('bonus-title').hidden = true;
    b.finished();
  }, 3200);
}

// touch or mouse position on the canvas, in its own low-resolution pixels
function bonusPoint(e) {
  return { x: e.clientX / view.k, y: e.clientY / view.k };
}
canvas.addEventListener('pointerdown', (e) => {
  if (!bonus || bonus.over) return;
  unlockAudio();
  bonus.pointer = bonusPoint(e);
  if (bonus.game.tap) bonus.game.tap(bonus.pointer.x, bonus.pointer.y);
});
canvas.addEventListener('pointermove', (e) => {
  // a finger steers only while it's down; a mouse steers just by moving
  if (bonus && !bonus.over && (bonus.pointer || e.pointerType === 'mouse')) bonus.pointer = bonusPoint(e);
});
window.addEventListener('pointerup', (e) => {
  if (bonus && e.pointerType !== 'mouse') bonus.pointer = null;
});

function drawSpace(g, W, H, t, drift) {
  rect(g, '#05060f', 0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const speed = drift * (0.3 + hash(i + 0.4));
    const x = (((hash(i) * W - t * speed) % W) + W) % W;
    rect(g, i % 6 ? '#ffffff' : '#9fd8ff', x, hash(i + 9) * H, i % 9 ? 1 : 2, 1);
  }
}

const BONUS_GAMES = {
  // On the planet: stars fall from the sky, and Nova runs wherever you touch to catch them.
  catch() {
    const sc = scene;
    const stars = [];
    let next = 0.6;
    sc.bonus = true;
    return {
      update(dt, t, W) {
        if (bonus.pointer && !bonus.over) sc.target = clamp(bonus.pointer.x + sc.cam, 10, sc.worldW - 10);
        if (sc.target != null) {
          const dx = sc.target - sc.heroX;
          const step = WALK_SPEED * 1.6 * dt;
          if (Math.abs(dx) <= step) {
            sc.heroX = sc.target;
            sc.target = null;
          } else {
            sc.facing = Math.sign(dx);
            sc.heroX += sc.facing * step;
          }
        }
        sc.pipX += (sc.heroX - sc.facing * 15 - sc.pipX) * Math.min(1, dt * 4);
        sc.groundY = view.H - Math.max(24, Math.round(view.H * 0.28));
        sc.cam = W >= sc.worldW ? (sc.worldW - W) / 2 : clamp(sc.heroX - W / 2, 0, sc.worldW - W);

        next -= dt;
        if (next <= 0 && !bonus.over) {
          next = 0.5 + Math.random() * 0.4;
          stars.push({ x: clamp(sc.cam + 10 + Math.random() * (W - 20), 10, sc.worldW - 10), y: -8, v: 36 + Math.random() * 22 });
        }
        for (const s of stars) {
          s.y += s.v * dt;
          if (s.y > sc.groundY - 26 && s.y < sc.groundY && Math.abs(s.x - sc.heroX) < 12) {
            s.gone = true;
            bonusScore(s.x - sc.cam, s.y);
          } else if (s.y >= sc.groundY) s.gone = true;
        }
        for (let i = stars.length - 1; i >= 0; i--) if (stars[i].gone) stars.splice(i, 1);
      },
      draw(g, W, H, t) {
        drawScene(g, W, H, sc, t, sc.done);
        for (const s of stars) blit(g, STAR_SPRITE, s.x - 3 - Math.round(sc.cam), s.y);
      },
      end() {
        sc.bonus = false;
        sc.target = null;
      },
    };
  },

  // In space: rocks drift across, and a tap on one fires the ship's laser at it.
  zap() {
    const rocks = [];
    const beams = [];
    let next = 0.3;
    return {
      update(dt, t, W, H) {
        next -= dt;
        if (next <= 0 && !bonus.over && rocks.length < 7) {
          next = 0.55 + Math.random() * 0.5;
          const fromLeft = Math.random() < 0.5;
          const r = 6 + Math.floor(Math.random() * 5);
          rocks.push({ x: fromLeft ? -r : W + r, y: 24 + Math.random() * (H - 80), vx: (fromLeft ? 1 : -1) * (12 + Math.random() * 16), vy: (Math.random() - 0.5) * 8, r, seed: Math.random() * 99 });
        }
        for (const rock of rocks) {
          rock.x += rock.vx * dt;
          rock.y += rock.vy * dt;
        }
        for (let i = rocks.length - 1; i >= 0; i--) if (rocks[i].x < -20 || rocks[i].x > W + 20) rocks.splice(i, 1);
        for (const beam of beams) beam.life -= dt;
        while (beams.length && beams[0].life <= 0) beams.shift();
      },
      tap(x, y) {
        // generous: the nearest rock within reach of the fingertip
        const hit = rocks
          .map((rock) => ({ rock, d: Math.hypot(rock.x - x, rock.y - y) - rock.r }))
          .filter((h) => h.d < 10)
          .sort((a, b) => a.d - b.d)[0];
        if (!hit) return;
        rocks.splice(rocks.indexOf(hit.rock), 1);
        beams.push({ x: hit.rock.x, y: hit.rock.y, life: 0.14 });
        sfx.zap();
        bonusScore(hit.rock.x, hit.rock.y);
      },
      draw(g, W, H, t) {
        drawSpace(g, W, H, t, 3);
        disc(g, '#3b2a6b', Math.round(W * 0.8), Math.round(H * 0.18), 14);
        disc(g, '#5a3fa8', Math.round(W * 0.8) - 3, Math.round(H * 0.18) - 3, 9);
        for (const rock of rocks) {
          disc(g, '#4a4038', rock.x + 1, rock.y + 1, rock.r);
          disc(g, '#8a7a68', rock.x, rock.y, rock.r - 1);
          disc(g, '#6a5c4e', rock.x + rock.r * 0.3 * Math.cos(rock.seed), rock.y + rock.r * 0.3 * Math.sin(rock.seed), Math.max(1, Math.floor(rock.r / 3)));
          rect(g, '#b0a090', rock.x - rock.r * 0.5, rock.y - rock.r * 0.5, 2, 2);
        }
        const sx = W / 2;
        const sy = H - 20;
        for (const beam of beams) {
          const steps = Math.ceil(Math.hypot(beam.x - sx, beam.y - sy));
          for (let i = 0; i <= steps; i += 1) rect(g, i % 2 ? '#ffffff' : '#6fe3ff', sx + ((beam.x - sx) * i) / steps, sy + ((beam.y - sy) * i) / steps, 2, 2);
        }
        blit(g, SPR.ship, sx - 14, sy - 4 + Math.round(Math.sin(t * 3)));
      },
    };
  },

  // Flying: the ship follows your finger up and down to scoop up a winding trail of stars.
  fly() {
    const stars = [];
    let next = 0.5;
    let wave = 0;
    let y = view.H / 2;
    return {
      update(dt, t, W, H) {
        const shipX = Math.round(W * 0.28);
        if (bonus.pointer) y += (clamp(bonus.pointer.y, 16, H - 12) - y) * Math.min(1, dt * 7);
        next -= dt;
        if (next <= 0 && !bonus.over) {
          next = 0.26;
          wave += 0.42;
          stars.push({ x: W + 6, y: H / 2 + Math.sin(wave) * H * 0.28 + Math.sin(wave * 2.7) * H * 0.06 });
        }
        for (const s of stars) {
          s.x -= 58 * dt;
          if (Math.abs(s.x - shipX) < 12 && Math.abs(s.y - y) < 11) {
            s.gone = true;
            bonusScore(s.x, s.y);
          }
        }
        for (let i = stars.length - 1; i >= 0; i--) if (stars[i].gone || stars[i].x < -8) stars.splice(i, 1);
      },
      draw(g, W, H, t) {
        const shipX = Math.round(W * 0.28);
        drawSpace(g, W, H, t, 40);
        const px = (((W * 1.6 - t * 9) % (W + 60)) + W + 60) % (W + 60) - 30;
        disc(g, '#2f7d5b', px, Math.round(H * 0.72), 16);
        disc(g, '#3d9a5f', px - 4, Math.round(H * 0.72) - 4, 10);
        for (const s of stars) blit(g, STAR_SPRITE, s.x - 3, s.y - 3);
        const flame = 3 + (Math.floor(t * 14) % 3);
        rect(g, '#ffe81f', shipX - 14 - flame, y - 1, flame, 3);
        rect(g, '#f08a24', shipX - 16 - flame, y, 2, 1);
        blit(g, SPR.ship, shipX - 14, y - 6);
      },
    };
  },
};
