'use strict';

/* Bonus games: a short burst of pure fun between reading challenges.
   No reading, no way to lose; each one ends by itself. Every one is played the
   same way: tap the things that are moving. They draw on the same
   low-resolution canvas as the planets, and use `view`, `scene`, `store`,
   `sfx` and friends from the other scripts. */

const BONUS_EVERY = 1; // a bonus game after every this many crystals
const BONUS_SECONDS = 12; // how long one lasts...
const BONUS_SECONDS_PER_STAR = 2; // ...plus this for each word she read right first time
const BONUS_ORDER = ['catch', 'zap', 'lights', 'fly', 'crack', 'drums'];
const BONUS_TITLES = {
  catch: 'Tap the falling stars!',
  zap: 'Tap the rocks to zap them!',
  fly: 'Tap the stars as you fly!',
  lights: 'Light up the stars!',
  crack: 'Crack the rock open!',
  drums: 'Make some music!',
};

let bonus = null;

const STAR_SPRITE = sprite(['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '.yy.yy.', 'yy...yy']);

// Starts the next bonus game in the rotation; the promise resolves when it's over.
function playBonus(gold) {
  return new Promise((finished) => {
    const kind = BONUS_ORDER[(store.bonusTurn || 0) % BONUS_ORDER.length];
    store.bonusTurn = (store.bonusTurn || 0) + 1;
    save();
    bonus = { kind, score: 0, left: BONUS_SECONDS + gold * BONUS_SECONDS_PER_STAR, over: false, sparks: [], finished, last: 0 };
    bonus.game = BONUS_GAMES[kind]();
    show('bonus');
    if (bonus.game.quiet) setMusic(null); // the drums need to be heard
    $('bonus-count').hidden = !!bonus.game.noScore;
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
  $('bonus-title').textContent = b.game.noScore ? 'Lovely music!' : b.score === 1 ? '1 star!' : b.score + ' stars!';
  $('bonus-title').hidden = false;
  setTimeout(() => say(b.game.noScore ? '_bonus_music' : '_bonus_done'), 900);
  setTimeout(() => {
    if (b.game.end) b.game.end();
    bonus = null;
    $('bonus-title').hidden = true;
    b.finished();
  }, 3200);
}

canvas.addEventListener('pointerdown', (e) => {
  if (!bonus || bonus.over) return;
  unlockAudio();
  bonus.game.tap(e.clientX / view.k, e.clientY / view.k);
});

// The nearest thing within a fingertip of the tap, or undefined. `things` have x, y and
// optionally r (their radius); `shift` is how far the view has scrolled.
function tapped(things, x, y, shift = 0) {
  return things
    .map((thing) => ({ thing, d: Math.hypot(thing.x - shift - x, thing.y - y) - (thing.r || 4) }))
    .filter((hit) => hit.d < 12)
    .sort((a, b) => a.d - b.d)[0]?.thing;
}

function drawLine(g, color, x1, y1, x2, y2, gap = 1) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= steps; i += gap) rect(g, color, x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, 1, 1);
}

function drawBeam(g, x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
  for (let i = 0; i <= steps; i++) rect(g, i % 2 ? '#ffffff' : '#6fe3ff', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, 2, 2);
}

function drawSpace(g, W, H, t, drift) {
  rect(g, '#05060f', 0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const speed = drift * (0.3 + hash(i + 0.4));
    const x = (((hash(i) * W - t * speed) % W) + W) % W;
    rect(g, i % 6 ? '#ffffff' : '#9fd8ff', x, hash(i + 9) * H, i % 9 ? 1 : 2, 1);
  }
}

const BONUS_GAMES = {
  // On the planet: stars drift down from the sky; tap one to catch it.
  catch() {
    const sc = scene;
    const stars = [];
    let next = 0.4;
    sc.bonus = true;
    sc.target = null;
    return {
      update(dt, t, W) {
        next -= dt;
        if (next <= 0 && !bonus.over) {
          next = 0.5 + Math.random() * 0.4;
          stars.push({ x: sc.cam + 12 + Math.random() * (W - 24), y: -8, v: 26 + Math.random() * 16, sway: Math.random() * 6 });
        }
        for (const s of stars) s.y += s.v * dt;
        for (let i = stars.length - 1; i >= 0; i--) if (stars[i].y >= sc.groundY) stars.splice(i, 1);
      },
      tap(x, y) {
        const star = tapped(stars, x, y, Math.round(sc.cam));
        if (!star) return;
        stars.splice(stars.indexOf(star), 1);
        bonusScore(star.x - sc.cam, star.y);
      },
      draw(g, W, H, t) {
        drawScene(g, W, H, sc, t, sc.done);
        for (const s of stars) blit(g, STAR_SPRITE, s.x - 3 - Math.round(sc.cam) + Math.round(Math.sin(t * 2 + s.sway)), s.y - 3);
      },
      end() {
        sc.bonus = false;
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
        const rock = tapped(rocks, x, y);
        if (!rock) return;
        rocks.splice(rocks.indexOf(rock), 1);
        beams.push({ x: rock.x, y: rock.y, life: 0.14 });
        sfx.zap();
        bonusScore(rock.x, rock.y);
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
        for (const beam of beams) drawBeam(g, sx, sy, beam.x, beam.y);
        blit(g, SPR.ship, sx - 14, sy - 4 + Math.round(Math.sin(t * 3)));
      },
    };
  },

  // Flying: the ship cruises along while a winding trail of stars streams past; tap them to scoop them up.
  fly() {
    const stars = [];
    const beams = [];
    let next = 0.4;
    let wave = 0;
    const ship = (W, H, t) => ({ x: Math.round(W * 0.25), y: H * 0.5 + Math.sin(t * 1.3) * H * 0.12 });
    let at = { x: 0, y: 0 };
    return {
      update(dt, t, W, H) {
        at = ship(W, H, t);
        next -= dt;
        if (next <= 0 && !bonus.over) {
          next = 0.42;
          wave += 0.5;
          stars.push({ x: W + 6, y: H / 2 + Math.sin(wave) * H * 0.3 + Math.sin(wave * 2.7) * H * 0.06 });
        }
        for (const s of stars) s.x -= 34 * dt;
        for (let i = stars.length - 1; i >= 0; i--) if (stars[i].x < -8) stars.splice(i, 1);
        for (const beam of beams) beam.life -= dt;
        while (beams.length && beams[0].life <= 0) beams.shift();
      },
      tap(x, y) {
        const star = tapped(stars, x, y);
        if (!star) return;
        stars.splice(stars.indexOf(star), 1);
        beams.push({ x: star.x, y: star.y, life: 0.14 });
        bonusScore(star.x, star.y);
      },
      draw(g, W, H, t) {
        drawSpace(g, W, H, t, 40);
        const px = (((W * 1.6 - t * 9) % (W + 60)) + W + 60) % (W + 60) - 30;
        disc(g, '#2f7d5b', px, Math.round(H * 0.74), 16);
        disc(g, '#3d9a5f', px - 4, Math.round(H * 0.74) - 4, 10);
        for (const s of stars) blit(g, STAR_SPRITE, s.x - 3, s.y - 3);
        for (const beam of beams) drawBeam(g, at.x + 10, at.y, beam.x, beam.y);
        const flame = 3 + (Math.floor(t * 14) % 3);
        rect(g, '#ffe81f', at.x - 14 - flame, at.y - 1, flame, 3);
        rect(g, '#f08a24', at.x - 16 - flame, at.y, 2, 1);
        blit(g, SPR.ship, at.x - 14, at.y - 6);
      },
    };
  },

  // Calm: a few dim stars in a dark sky. Tap each to light it; lit neighbours join up,
  // and when they're all lit the picture is complete and a new one appears.
  lights() {
    const pentagram = [0, 2, 4, 1, 3].map((i) => [0.5 + 0.5 * Math.cos(-Math.PI / 2 + (i * Math.PI * 2) / 5), 0.5 + 0.5 * Math.sin(-Math.PI / 2 + (i * Math.PI * 2) / 5)]);
    const PICTURES = [
      [[0.5, 0], [0.85, 0.3], [0.7, 1], [0.3, 1], [0.15, 0.3]], // a crystal
      pentagram, // a star
      [[0.5, 0], [0.75, 0.35], [0.75, 0.8], [0.95, 1], [0.05, 1], [0.25, 0.8], [0.25, 0.35]], // a rocket
      [[0.05, 0.2], [0.3, 0.6], [0.5, 0.1], [0.7, 0.6], [0.95, 0.2], [0.85, 1], [0.15, 1]], // a crown
    ];
    let which = Math.floor(Math.random() * PICTURES.length);
    let points = null;
    let nextAt = 0;
    const lay = (W, H) => {
      const size = Math.min(W, H) * 0.62;
      points = PICTURES[which % PICTURES.length].map(([x, y]) => ({ x: W / 2 + (x - 0.5) * size, y: H * 0.54 + (y - 0.5) * size, r: 5, lit: false }));
    };
    return {
      update(dt, t, W, H) {
        if (!points) lay(W, H);
        if (nextAt && t > nextAt && !bonus.over) {
          nextAt = 0;
          which++;
          lay(W, H);
        }
      },
      tap(x, y) {
        if (!points || nextAt) return;
        const star = tapped(points.filter((p) => !p.lit), x, y);
        if (!star) return;
        star.lit = true;
        bonusScore(star.x, star.y);
        if (points.every((p) => p.lit)) {
          nextAt = performance.now() / 1000 + 1.8;
          sfx.correct();
        }
      },
      draw(g, W, H, t) {
        drawSpace(g, W, H, t, 2);
        if (!points) return;
        points.forEach((a, i) => {
          const b = points[(i + 1) % points.length];
          if (a.lit && b.lit) drawLine(g, nextAt ? '#ffe81f' : '#6fe3ff', a.x, a.y, b.x, b.y, nextAt ? 1 : 3);
        });
        points.forEach((p, i) => {
          if (p.lit) return blit(g, STAR_SPRITE, p.x - 3, p.y - 3);
          const glint = Math.floor(t * 3 + i) % 2 ? '#c8d0f0' : '#7a84b8';
          rect(g, glint, p.x - 1, p.y - 2, 2, 5);
          rect(g, glint, p.x - 2, p.y - 1, 5, 2);
        });
      },
    };
  },

  // A big rock: tap it again and again and the cracks spread until it bursts,
  // scattering crystals to tap. Then another rock arrives.
  crack() {
    const HITS = 6;
    let rock = null;
    let gems = [];
    let shake = 0;
    let wait = 0;
    return {
      update(dt, t, W, H) {
        if (!rock && !gems.length && !bonus.over && (wait -= dt) <= 0) {
          rock = { x: W / 2, y: H * 0.5, r: Math.round(Math.min(W, H) * 0.2), hits: 0, cracks: [] };
        }
        shake = Math.max(0, shake - dt * 30);
        for (const gem of gems) {
          gem.x = clamp(gem.x + gem.vx * dt, 8, W - 8);
          gem.y = clamp(gem.y + gem.vy * dt, 22, H - 14);
          gem.vx *= 1 - Math.min(1, dt * 2.2);
          gem.vy *= 1 - Math.min(1, dt * 2.2);
        }
      },
      tap(x, y) {
        const gem = tapped(gems, x, y);
        if (gem) {
          gems.splice(gems.indexOf(gem), 1);
          bonusScore(gem.x, gem.y);
          if (!gems.length) wait = 0.5;
          return;
        }
        if (!rock || Math.hypot(x - rock.x, y - rock.y) > rock.r + 8) return;
        rock.hits++;
        shake = 5;
        sfx.thud();
        // a jagged crack running outwards from near where it was hit
        let cx = clamp(x - rock.x, -rock.r * 0.5, rock.r * 0.5);
        let cy = clamp(y - rock.y, -rock.r * 0.5, rock.r * 0.5);
        let angle = Math.random() * Math.PI * 2;
        const crack = [[cx, cy]];
        while (Math.hypot(cx, cy) < rock.r - 2 && crack.length < 8) {
          angle += (Math.random() - 0.5) * 1.4;
          cx += Math.cos(angle) * rock.r * 0.28;
          cy += Math.sin(angle) * rock.r * 0.28;
          crack.push([cx, cy]);
        }
        rock.cracks.push(crack);
        for (let i = 0; i < 5; i++) bonus.sparks.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 70, life: 0.3 });
        if (rock.hits < HITS) return;
        sfx.crystal();
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 45 + Math.random() * 45;
          gems.push({ x: rock.x, y: rock.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 6 });
        }
        rock = null;
      },
      draw(g, W, H, t) {
        drawSpace(g, W, H, t, 2);
        if (rock) {
          const x = rock.x + Math.round((Math.random() - 0.5) * shake);
          const y = rock.y + Math.round((Math.random() - 0.5) * shake);
          disc(g, '#3a322c', x, y, rock.r + 1);
          disc(g, '#8a7a68', x, y, rock.r - 1);
          disc(g, '#6a5c4e', x + rock.r * 0.25, y + rock.r * 0.3, Math.round(rock.r * 0.45));
          disc(g, '#a89884', x - rock.r * 0.35, y - rock.r * 0.35, Math.round(rock.r * 0.22));
          for (const crack of rock.cracks) {
            for (let i = 1; i < crack.length; i++) drawLine(g, '#1f1814', x + crack[i - 1][0], y + crack[i - 1][1], x + crack[i][0], y + crack[i][1]);
          }
        }
        gems.forEach((gem, i) => blit(g, SPR.crystal, gem.x - 4, gem.y - 6 + Math.round(Math.sin(t * 4 + i))));
      },
    };
  },

  // No score: six coloured pads that each play a note, and a little band that hops along.
  drums() {
    const NOTES = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
    const COLOURS = ['#e5484d', '#f08a24', '#ffe81f', '#4be07a', '#3fa9ff', '#c77dff'];
    const glow = NOTES.map(() => 0);
    const hops = [0, 0, 0];
    const marks = [];
    let turn = 0;
    const pads = (W, H) => {
      const cols = W > H ? 6 : 3;
      const rows = NOTES.length / cols;
      const w = Math.floor((W - 6) / cols);
      const h = Math.min(w, Math.floor((H * 0.42) / rows));
      const top = H - 8 - rows * h;
      return NOTES.map((_, i) => ({ x: 3 + (i % cols) * w, y: top + Math.floor(i / cols) * h, w: w - 3, h: h - 3 }));
    };
    return {
      quiet: true,
      noScore: true,
      update(dt) {
        glow.forEach((v, i) => (glow[i] = Math.max(0, v - dt * 4)));
        hops.forEach((v, i) => (hops[i] = Math.max(0, v - dt * 28)));
        for (const m of marks) {
          m.y -= 30 * dt;
          m.life -= dt;
        }
        while (marks.length && marks[0].life <= 0) marks.shift();
      },
      tap(x, y) {
        const i = pads(view.W, view.H).findIndex((p) => x >= p.x - 2 && x <= p.x + p.w + 2 && y >= p.y - 2 && y <= p.y + p.h + 2);
        if (i < 0) return;
        const pad = pads(view.W, view.H)[i];
        glow[i] = 1;
        sfx.note(NOTES[i]);
        hops[turn++ % hops.length] = 9;
        marks.push({ x: pad.x + pad.w / 2, y: pad.y - 2, life: 0.8, color: COLOURS[i] });
      },
      draw(g, W, H, t) {
        drawSpace(g, W, H, t, 6);
        const layout = pads(W, H);
        const floor = layout[0].y - 8;
        rect(g, '#2a3566', 0, floor, W, 2);
        const band = [SPR.hero[hops[0] > 2 ? 1 : 0], SPR.pip, alienSprite(scene.level.alien)];
        band.forEach((spr, i) => blit(g, spr, Math.round((W * (i + 1)) / 4 - spr.width / 2), floor - spr.height - Math.round(hops[i]) - (i === 1 ? 5 : 0)));
        layout.forEach((p, i) => {
          rect(g, '#0b0b14', p.x - 1, p.y - 1, p.w + 2, p.h + 2);
          rect(g, glow[i] > 0.4 ? '#ffffff' : shade(COLOURS[i], 0.75 + glow[i] * 0.6), p.x, p.y, p.w, p.h);
          rect(g, shade(COLOURS[i], 0.5), p.x, p.y + p.h - 2, p.w, 2);
        });
        for (const m of marks) rect(g, m.color, m.x - 1, m.y, 3, 3);
      },
    };
  },
};
