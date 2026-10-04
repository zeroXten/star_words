'use strict';

const STAR = '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const STORE_KEY = 'star-words-v2';
const DRAG_THRESHOLD = 12;
const ZONES = 3;
const WALK_SPEED = 60;

const $ = (id) => document.getElementById(id);
const starSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${STAR}</svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const phraseNames = (prefix) => Object.keys(data.phrases).filter((k) => k.startsWith(prefix));

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- saved progress ---------- */

let store = { crystals: {}, seenStory: false, at: null, muted: false };
try {
  store = Object.assign(store, JSON.parse(localStorage.getItem(STORE_KEY)));
} catch {}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

const crystalsFor = (level) => (store.crystals[level.id] || Array(ZONES).fill(false)).slice();

/* ---------- audio ---------- */

let ctx = null;
let playing = null;
const buffers = new Map();

function unlockAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    initSound();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function load(name) {
  if (!buffers.has(name)) {
    buffers.set(
      name,
      fetch(`audio/${encodeURIComponent(name)}.m4a`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
        .then((b) => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
        .catch((e) => (console.warn('audio missing:', name, e), null))
    );
  }
  return buffers.get(name);
}

function hush() {
  if (!playing) return;
  playing.onended = null;
  try { playing.stop(); } catch {}
  playing = null;
}

// Resolves when the clip finishes. A clip cut off by a newer one never resolves.
async function say(name) {
  const buffer = await load(name);
  hush();
  if (!buffer) return;
  return new Promise((done) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = done;
    playing = src;
    src.start();
  });
}

/* ---------- screens ---------- */

let data = null;
let cur = 'title';
let scene = null;
let round = null;
let doorExplained = false;

// each planet plays its tune in a different key
const PLANET_KEYS = [0, 2, -3, 5, -2, 3];

function show(screen) {
  cur = screen;
  for (const id of ['title', 'story', 'map', 'planet', 'play']) $(id).hidden = id !== screen;
  const onPlanet = screen === 'planet' || screen === 'play';
  $('scene').hidden = !onPlanet;
  $('back').hidden = !onPlanet;
  $('progress').hidden = screen !== 'play';
  $('label').hidden = screen !== 'planet' && screen !== 'map';
  $('total').hidden = screen === 'title' || screen === 'story';
  renderTotal();
  // quiet while words are being read out, soft under the story narration
  if (screen === 'play') setMusic(null);
  else if (screen === 'planet') setMusic('planet', PLANET_KEYS[scene.seed % PLANET_KEYS.length]);
  else setMusic('map', 0, screen === 'story' ? 0.3 : 1);
  if (onPlanet && !raf) raf = requestAnimationFrame(frame);
}

function renderTotal(bump) {
  const have = data.levels.reduce((n, level) => n + crystalsFor(level).filter(Boolean).length, 0);
  const el = $('total');
  el.innerHTML = `<i class="gem on"></i><span>${have}</span>`;
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

/* ---------- galaxy map ---------- */

let flying = false;

// The map is drawn on a 240 x 300 grid; each level's "at" is a spot on it.
const MAP = { W: 240, H: 300 };
let galaxy = null;

function renderMap() {
  scene = null;
  const box = $('planets');
  const s = Math.max(3, Math.ceil(innerWidth / MAP.W), Math.ceil(innerHeight / MAP.H));
  box.style.width = MAP.W * s + 'px';
  box.style.height = MAP.H * s + 'px';
  if (!galaxy) {
    const byId = Object.fromEntries(data.levels.map((l) => [l.id, l]));
    galaxy = galaxyPicture(MAP.W, MAP.H, data.levels.filter((l) => l.from).map((l) => [byId[l.from].at, l.at]));
    galaxy.className = 'galaxy';
    box.prepend(galaxy);
  }
  box.querySelectorAll('.planet').forEach((n) => n.remove());
  data.levels.forEach((level, i) => {
    const got = crystalsFor(level);
    const size = (20 + ((i * 5) % 9)) * s;
    const btn = document.createElement('button');
    btn.className = 'planet' + (got.every(Boolean) ? ' complete' : '');
    btn.dataset.id = level.id;
    btn.style.left = level.at[0] * s + 'px';
    btn.style.top = level.at[1] * s - size / 2 + 'px';
    const globe = planetSprite(ENVS[level.env], i + 1);
    globe.className = 'globe';
    globe.style.width = globe.style.height = size + 'px';
    btn.append(globe);
    btn.insertAdjacentHTML(
      'beforeend',
      `<span class="pname">${level.planet}</span><span class="pdesc">${level.name}</span>` +
        `<span class="gems">${got.map((g) => `<i class="gem${g ? ' on' : ''}"></i>`).join('')}</span>`
    );
    btn.addEventListener('click', () => flyTo(level, btn));
    box.append(btn);
  });
  $('label').textContent = 'Galaxy map';
  show('map');
  const here = box.querySelector(`[data-id="${store.at}"]`) || box.querySelector('.planet');
  moveShip(here, false);
  $('map').scrollTo(here.offsetLeft - $('map').clientWidth / 2, here.offsetTop - $('map').clientHeight / 2 + 40);
}

function moveShip(btn, animate) {
  const ship = $('ship');
  const size = btn.querySelector('.globe').offsetWidth;
  ship.style.transition = animate ? 'transform .9s ease-in-out' : 'none';
  ship.style.transform = `translate(${btn.offsetLeft + size * 0.15}px, ${btn.offsetTop - 10}px)`;
}

function flyTo(level, btn) {
  if (flying) return;
  unlockAudio();
  flying = true;
  const already = store.at === level.id;
  if (!already) sfx.fly();
  moveShip(btn, true);
  store.at = level.id;
  save();
  setTimeout(() => zoomInto(level, btn), already ? 150 : 1000);
}

// The planet swells to fill the screen, then gives way to its sky as the ship comes in to land.
function zoomInto(level, btn) {
  const from = btn.querySelector('.globe').getBoundingClientRect();
  const warp = $('warp');
  const globe = planetSprite(ENVS[level.env], data.levels.indexOf(level) + 1);
  Object.assign(globe.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  warp.style.background = 'transparent';
  warp.style.opacity = 1;
  warp.replaceChildren(globe);
  warp.hidden = false;
  void globe.offsetWidth;
  sfx.zoom();
  const dx = innerWidth / 2 - (from.left + from.width / 2);
  const dy = innerHeight / 2 - (from.top + from.height / 2);
  globe.style.transform = `translate(${dx}px, ${dy}px) scale(${(2.6 * Math.max(innerWidth, innerHeight)) / from.width})`;
  setTimeout(() => {
    warp.style.background = ENVS[level.env].sky[0];
    warp.replaceChildren();
    flying = false;
    enterPlanet(level);
    warp.style.opacity = 0;
    setTimeout(() => (warp.hidden = true), 450);
  }, 900);
}

/* ---------- walking around a planet ---------- */

const canvas = $('scene');
const g2d = canvas.getContext('2d');
const view = { k: 3, W: 0, H: 0 };
let raf = 0;
let last = 0;

function resize() {
  view.k = Math.max(2, Math.round(Math.min(innerWidth, innerHeight) / 130));
  view.W = Math.ceil(innerWidth / view.k);
  view.H = Math.ceil(innerHeight / view.k);
  canvas.width = view.W;
  canvas.height = view.H;
  canvas.style.width = view.W * view.k + 'px';
  canvas.style.height = view.H * view.k + 'px';
  g2d.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

function enterPlanet(level) {
  scene = {
    level,
    env: ENVS[level.env],
    seed: data.levels.indexOf(level) + 1,
    shipX: 40,
    places: [150, 270, 390],
    worldW: 450,
    heroX: 66,
    pipX: 52,
    facing: 1,
    target: null,
    goal: null,
    cam: 0,
    groundY: 0,
    // the ship's descent: 0 is high above, 1 is on the ground
    phase: 'landing',
    altitude: 0,
  };
  $('label').textContent = level.planet;
  show('planet');
  sfx.land();
}

function frame(now) {
  if (!scene || (cur !== 'planet' && cur !== 'play')) {
    raf = 0;
    return;
  }
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  const sc = scene;
  if (sc.phase === 'landing') {
    sc.altitude = Math.min(1, sc.altitude + dt / 1.6);
    if (sc.altitude === 1) sc.phase = null;
  } else if (sc.phase === 'leaving') {
    sc.altitude = Math.max(0, sc.altitude - dt / 1.1);
    if (sc.altitude === 0) renderMap();
  } else if (cur === 'planet' && sc.target != null) {
    const dx = sc.target - sc.heroX;
    if (Math.abs(dx) <= WALK_SPEED * dt) {
      sc.heroX = sc.target;
      sc.target = null;
      arrive();
    } else {
      sc.facing = Math.sign(dx);
      sc.heroX += sc.facing * WALK_SPEED * dt;
      const foot = Math.floor((now / 1000) * 7) % 2;
      if (foot !== sc.foot) sfx.step();
      sc.foot = foot;
    }
  }
  if (scene === sc) {
    sc.pipX += (sc.heroX - sc.facing * 15 - sc.pipX) * Math.min(1, dt * 4);
    sc.groundY = view.H - Math.max(24, Math.round(view.H * 0.28));
    sc.cam = view.W >= sc.worldW ? (sc.worldW - view.W) / 2 : clamp(sc.heroX - view.W / 2, 0, sc.worldW - view.W);
    drawScene(g2d, view.W, view.H, sc, now / 1000, crystalsFor(sc.level));
  }
  raf = requestAnimationFrame(frame);
}

function takeOff() {
  scene.target = null;
  scene.phase = 'leaving';
  sfx.takeoff();
}

function arrive() {
  const goal = scene.goal;
  scene.goal = null;
  if (goal === 'ship') takeOff();
  else if (goal != null) startZone(goal);
}

canvas.addEventListener('pointerdown', (e) => {
  if (cur !== 'planet' || !scene || scene.phase) return;
  unlockAudio();
  const x = e.clientX / view.k + scene.cam;
  // a door that has already given up its crystal is just scenery
  const got = crystalsFor(scene.level);
  const place = scene.places.findIndex((p, i) => !got[i] && Math.abs(x - p) < 22);
  if (place >= 0) {
    scene.goal = place;
    scene.target = scene.places[place] - 16;
  } else if (Math.abs(x - scene.shipX) < 24) {
    scene.goal = 'ship';
    scene.target = scene.shipX + 26;
  } else {
    scene.goal = null;
    scene.target = clamp(x, 10, scene.worldW - 10);
  }
});

/* ---------- a word door ---------- */

function zoneWords(level, zone) {
  const n = level.words.length;
  return level.words.slice(Math.round((zone * n) / ZONES), Math.round(((zone + 1) * n) / ZONES));
}

function startZone(zone) {
  scene.facing = 1;
  const questions = shuffle(zoneWords(scene.level, zone));
  // Deal the right answer's position evenly (left, middle, right) so it can't keep landing in one spot.
  const slots = questions.flatMap((_, i) => (i % 3 ? [] : shuffle([0, 1, 2])));
  round = { zone, questions, slots, index: 0, results: [] };
  show('play');
  showQuestion();
  sfx.chirp();
  if (!doorExplained) {
    doorExplained = true;
    sleep(500).then(() => cur === 'play' && say('_door'));
  }
}

function renderProgress() {
  $('progress').innerHTML = round.questions
    .map((_, i) => {
      const r = round.results[i];
      return starSvg('pip ' + (r === true ? 'star' : r === false ? 'plain' : i === round.index ? 'now' : ''));
    })
    .join('');
}

function showQuestion() {
  const [answer, ...others] = round.questions[round.index];
  round.answer = answer;
  round.firstTry = true;
  round.locked = false;
  renderProgress();

  const word = $('word');
  word.className = 'word';
  word.style.setProperty('--n', Math.max(answer.length, 3));
  word.innerHTML = [...answer].map((ch, i) => `<div class="tile" style="--i:${i}"><span>${ch}</span></div>`).join('');

  const options = $('options');
  options.innerHTML = '';
  const choices = shuffle(others);
  choices.splice(round.slots[round.index], 0, answer);
  for (const choice of choices) {
    load(choice.toLowerCase());
    options.append(makeDisc(choice));
  }
}

function makeDisc(choice) {
  const disc = document.createElement('button');
  disc.className = 'disc';
  disc.setAttribute('aria-label', 'Listen');
  disc.innerHTML = SPEAKER;
  disc.addEventListener('pointerdown', (e) => {
    if (!round || round.locked || drag) return;
    unlockAudio();
    drag = { disc, choice, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  });
  return disc;
}

// One drag at a time, tracked on the window so a release is never missed
// even if the pointer leaves the button.
let drag = null;

window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.pointerType === 'mouse' && e.buttons === 0) return endDrag(true);
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  drag.moved = true;
  drag.disc.classList.add('dragging');
  drag.disc.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
  $('zone').classList.toggle('over', overZone(drag.disc));
});
window.addEventListener('pointerup', (e) => drag && e.pointerId === drag.id && endDrag(true));
window.addEventListener('pointercancel', (e) => drag && e.pointerId === drag.id && endDrag(false));

function endDrag(released) {
  const { disc, choice, moved } = drag;
  drag = null;
  const dropped = released && moved && overZone(disc);
  $('zone').classList.remove('over');
  disc.classList.remove('dragging');
  if (dropped) return choose(disc, choice);
  disc.style.transform = '';
  if (released && !moved) listen(disc, choice);
}

// Generous on purpose: touching the word's frame at all counts as a drop.
function overZone(disc) {
  const d = disc.getBoundingClientRect();
  const z = $('zone').getBoundingClientRect();
  return d.right > z.left && d.left < z.right && d.bottom > z.top && d.top < z.bottom;
}

async function listen(disc, choice) {
  document.querySelectorAll('.disc.speaking').forEach((d) => d.classList.remove('speaking'));
  disc.classList.add('speaking');
  await say(choice.toLowerCase());
  disc.classList.remove('speaking');
}

async function choose(disc, choice) {
  if (choice !== round.answer) {
    round.firstTry = false;
    disc.style.transform = '';
    disc.classList.add('wrong', 'out');
    hush();
    sfx.wrong();
    sleep(450).then(() => say(pick(phraseNames('_retry'))));
    return;
  }

  const mine = round;
  round.locked = true;
  disc.classList.add('gone');
  document.querySelectorAll('.disc').forEach((d) => d !== disc && d.classList.add('out'));
  $('word').classList.add('win');
  round.results[round.index] = round.firstTry;
  renderProgress();
  hush();
  sfx.correct();
  await sleep(400);

  // The timeout keeps the game moving even if a clip fails to play.
  await Promise.race([
    say(round.answer.toLowerCase()).then(() => say(pick(phraseNames('_praise')))),
    sleep(5000),
  ]);
  await sleep(500);
  if (round !== mine || cur !== 'play') return;

  round.index++;
  if (round.index < round.questions.length) showQuestion();
  else finishZone();
}

async function finishZone() {
  const level = scene.level;
  const got = crystalsFor(level);
  const wasComplete = got.every(Boolean);
  got[round.zone] = true;
  store.crystals[level.id] = got;
  save();
  renderTotal(true);

  const planetDone = got.every(Boolean) && !wasComplete;
  $('reward-text').textContent = planetDone ? 'Planet complete!' : 'Crystal found!';
  $('reward').hidden = false;
  sfx.crystal();
  if (planetDone) sleep(900).then(sfx.fanfare);
  await sleep(planetDone ? 2700 : 900);
  await Promise.race([say('_crystal').then(() => (planetDone ? say('_planetdone') : null)), sleep(10000)]);
  await sleep(700);
  $('reward').hidden = true;
  round = null;
  if (scene) show('planet');
}

/* ---------- wiring ---------- */

$('back').addEventListener('click', () => {
  hush();
  sfx.click();
  drag = null;
  if (cur === 'play') {
    round = null;
    show('planet');
  } else if (scene && !scene.phase) {
    takeOff();
  }
});

$('start').addEventListener('click', () => {
  unlockAudio();
  sfx.click();
  if (store.seenStory) return renderMap();
  show('story');
  say('_story');
});

$('go').addEventListener('click', () => {
  hush();
  sfx.click();
  store.seenStory = true;
  save();
  renderMap();
});

$('mute').addEventListener('click', () => {
  unlockAudio();
  store.muted = !store.muted;
  save();
  applyMute();
  sfx.click();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

function mount(id, picture) {
  picture.id = id;
  $(id).replaceWith(picture);
}

fetch('words.json')
  .then((r) => r.json())
  .then((json) => {
    data = json;
    mount('title-art', castPicture());
    mount('story-art', castPicture());
    mount('ship', sprite(SHIP));
    mount('reward-art', sprite(CRYSTAL));
    applyMute();
    show('title');
  });
