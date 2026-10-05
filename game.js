'use strict';

const STAR = '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const STORE_KEY = 'star-words-v2';
const DRAG_THRESHOLD = 12;
const ZONES = 3;
const WALK_SPEED = 60;
const HYPERSPACE_MS = 2600;
const COLLECT_AFTER = 6000; // ms before an untapped crystal collects itself

const $ = (id) => document.getElementById(id);
const starSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${STAR}</svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Works through every phrase of a kind (praise, retry) in a shuffled order before
// any comes round again, and never says the same one twice running.
const phraseQueues = {};
let lastPhrase = null;
function nextPhrase(prefix) {
  const queue = (phraseQueues[prefix] ||= []);
  if (!queue.length) queue.push(...shuffle(Object.keys(data.phrases).filter((k) => k.startsWith(prefix))));
  if (queue.length > 1 && queue[queue.length - 1] === lastPhrase) queue.unshift(queue.pop());
  return (lastPhrase = queue.pop());
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- saved progress ---------- */

let store = { crystals: {}, at: {}, galaxy: 'words', muted: false };
try {
  store = Object.assign(store, JSON.parse(localStorage.getItem(STORE_KEY)));
} catch {}
if (typeof store.at !== 'object' || !store.at) store.at = { words: store.at }; // older saves held one planet

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

const crystalsFor = (level) => (store.crystals[level.id] || Array(ZONES).fill(false)).slice();

/* ---------- audio ---------- */

// The clip for a word is its lowercase letters; for a sentence, "s-" and its words joined by dashes.
function clip(text) {
  const name = text.toLowerCase();
  return /\s/.test(text) ? 's-' + name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : name.replace(/[^a-z]/g, '');
}

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

const GALAXIES = { words: 'Crystal Galaxy', talk: 'Chatter Galaxy' };
const levelsIn = (galaxy) => (galaxy === 'talk' ? data.talk : data.levels);
const allLevels = () => [...data.levels, ...data.talk];
const seedOf = (level) => allLevels().indexOf(level) + 1;
let cur = 'title';
let scene = null;
let round = null;
let tapExplained = false;
let talkExplained = false;

// each planet plays its tune in a different key
const PLANET_KEYS = [0, 2, -3, 5, -2, 3];

function show(screen) {
  cur = screen;
  for (const id of ['title', 'story', 'map', 'planet', 'play', 'bonus']) $(id).hidden = id !== screen;
  const onPlanet = screen === 'planet' || screen === 'play';
  $('scene').hidden = !onPlanet && screen !== 'bonus';
  $('back').hidden = !onPlanet && screen !== 'bonus';
  $('progress').hidden = screen !== 'play';
  $('label').hidden = screen !== 'planet' && screen !== 'map';
  // once something on this planet is finished, offer to play it all again
  $('redo').hidden = screen !== 'planet' || !scene.done.some(Boolean);
  $('total').hidden = screen === 'title' || screen === 'story';
  renderTotal();
  // quiet while words are being read out, soft under the story narration
  if (screen === 'play') setMusic(null);
  else if (screen === 'bonus') setMusic('map', 7);
  else if (screen === 'planet') setMusic('planet', PLANET_KEYS[scene.seed % PLANET_KEYS.length]);
  else setMusic('map', store.galaxy === 'talk' ? 5 : 0, screen === 'story' ? 0.3 : 1);
  $('hyper').hidden = screen !== 'map';
  if (onPlanet && !raf) raf = requestAnimationFrame(frame);
}

function renderTotal(bump) {
  const have = allLevels().reduce((n, level) => n + crystalsFor(level).filter(Boolean).length, 0);
  const el = $('total');
  // crystals from reading, and (once there are any) stars from the bonus games
  el.innerHTML = `<i class="gem on"></i><span>${have}</span>` + (store.bonus ? `${starSvg('bonus-star')}<span class="bonus-total">${store.bonus}</span>` : '');
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
const galaxyPictures = {};

function renderMap() {
  scene = null;
  const box = $('planets');
  const s = Math.max(3, Math.ceil(innerWidth / MAP.W), Math.ceil(innerHeight / MAP.H));
  box.style.width = MAP.W * s + 'px';
  box.style.height = MAP.H * s + 'px';
  const levels = levelsIn(store.galaxy);
  if (!galaxyPictures[store.galaxy]) {
    const byId = Object.fromEntries(levels.map((l) => [l.id, l]));
    const routes = levels.filter((l) => l.from).map((l) => [byId[l.from].at, l.at]);
    galaxyPictures[store.galaxy] = galaxyPicture(MAP.W, MAP.H, routes, GALAXY_LOOKS[store.galaxy]);
    galaxyPictures[store.galaxy].className = 'galaxy';
  }
  box.querySelectorAll('.planet, .galaxy').forEach((n) => n.remove());
  box.prepend(galaxyPictures[store.galaxy]);
  levels.forEach((level, i) => {
    const got = crystalsFor(level);
    const size = (20 + ((i * 5) % 9)) * s;
    const btn = document.createElement('button');
    btn.className = 'planet' + (got.every(Boolean) ? ' complete' : '');
    btn.dataset.id = level.id;
    btn.style.left = level.at[0] * s + 'px';
    btn.style.top = level.at[1] * s - size / 2 + 'px';
    const globe = planetSprite(ENVS[level.env], seedOf(level));
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
  $('label').textContent = GALAXIES[store.galaxy];
  const other = store.galaxy === 'talk' ? 'words' : 'talk';
  $('hyper').textContent = 'To the ' + GALAXIES[other];
  $('hyper').onclick = () => hyperspace(other);
  show('map');
  const here = box.querySelector(`[data-id="${store.at[store.galaxy]}"]`) || box.querySelector('.planet');
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
  const already = store.at[store.galaxy] === level.id;
  if (!already) sfx.fly();
  moveShip(btn, true);
  store.at[store.galaxy] = level.id;
  save();
  setTimeout(() => zoomInto(level, btn), already ? 150 : 1000);
}

// The jump between galaxies: stars stretch into streaks, the screen whites out, and you arrive.
function hyperspace(to) {
  if (flying) return;
  unlockAudio();
  flying = true;
  setMusic(null);
  sfx.hyper();
  const warp = $('warp');
  const sky = document.createElement('canvas');
  sky.width = view.W;
  sky.height = view.H;
  sky.className = 'hyperspace';
  const g = sky.getContext('2d');
  warp.style.background = '#05060f';
  warp.style.opacity = 1;
  warp.replaceChildren(sky);
  warp.hidden = false;
  const began = performance.now();
  (function tick(now) {
    const p = Math.min(1, (now - began) / HYPERSPACE_MS);
    drawHyperspace(g, view.W, view.H, p);
    if (p < 1) return requestAnimationFrame(tick);
    store.galaxy = to;
    save();
    flying = false;
    renderMap();
    warp.style.background = '#ffffff';
    warp.replaceChildren();
    warp.style.opacity = 0;
    setTimeout(() => (warp.hidden = true), 450);
  })(began);
}

// The planet swells to fill the screen, then gives way to its sky as the ship comes in to land.
function zoomInto(level, btn) {
  const from = btn.querySelector('.globe').getBoundingClientRect();
  const warp = $('warp');
  const globe = planetSprite(ENVS[level.env], seedOf(level));
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
    seed: seedOf(level),
    shipX: 40,
    // where the ship can set down: on arrival, and past the last door to collect Nova
    pads: [40, 470],
    places: [150, 270, 390],
    worldW: 530,
    heroX: 66,
    pipX: 52,
    facing: 1,
    target: null,
    goal: null,
    cam: 0,
    groundY: 0,
    // which places are finished. A planet that's already complete starts afresh, so it can be played again.
    done: crystalsFor(level).every(Boolean) ? Array(ZONES).fill(false) : crystalsFor(level),
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
  } else if (sc.phase === 'pickup') {
    sc.altitude = Math.min(1, sc.altitude + dt / 1.6);
    if (sc.altitude === 1 && sc.target == null) takeOff();
  }
  if (cur === 'planet' && sc.target != null && sc.phase !== 'landing' && sc.phase !== 'leaving') {
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
    drawScene(g2d, view.W, view.H, sc, now / 1000, sc.done);
  }
  raf = requestAnimationFrame(frame);
}

// Planet finished: the ship flies itself over to the far side and Nova walks on to meet it.
function pickUp() {
  scene.shipX = scene.pads[1];
  scene.altitude = 0;
  scene.phase = 'pickup';
  scene.goal = null;
  scene.target = scene.shipX - 24;
  sfx.land();
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
  const got = scene.done;
  let place = scene.places.findIndex((p, i) => !got[i] && Math.abs(x - p) < 22);
  // the yellow arrow at the screen edge means "next door is that way": tapping it goes all the way there
  const next = got.indexOf(false);
  if (place < 0 && next >= 0) {
    const sx = e.clientX / view.k;
    const sy = e.clientY / view.k;
    const doorAt = scene.places[next] - scene.cam;
    const onArrow = (doorAt > view.W - 8 && sx > view.W - 26) || (doorAt < 8 && sx < 26);
    if (onArrow && sy > scene.groundY - 62 && sy < scene.groundY - 8) place = next;
  }
  if (place >= 0) {
    scene.goal = place;
    scene.target = scene.places[place] - 16;
  } else if (Math.abs(x - scene.shipX) < 24) {
    scene.goal = 'ship';
    scene.target = scene.shipX + 26;
  } else {
    scene.goal = null;
    scene.target = clamp(x, 10, scene.worldW - 10);
    // an unfinished door or alien on the way stops her there instead of letting her walk past
    const dir = Math.sign(scene.target - scene.heroX);
    const onTheWay = scene.places
      .map((p, i) => ({ i, stop: p - 16 }))
      .filter(({ i, stop }) => !got[i] && (stop - scene.heroX) * dir > 1 && (scene.target - stop) * dir >= 0)
      .sort((a, b) => (a.stop - b.stop) * dir)[0];
    if (onTheWay) {
      scene.goal = onTheWay.i;
      scene.target = onTheWay.stop;
    }
  }
});

/* ---------- a word door ---------- */

function zoneWords(level, zone) {
  const n = level.words.length;
  return level.words.slice(Math.round((zone * n) / ZONES), Math.round(((zone + 1) * n) / ZONES));
}

// Each door plays one of four games. A planet's three doors are all different,
// and which three a planet gets shifts along from one planet to the next.
const FORMATS = ['listen', 'find', 'missing', 'build'];
const BUILD_MAX_LETTERS = 5;

function formatFor(level, zone) {
  const i = data.levels.indexOf(level);
  const format = FORMATS[(i + zone) % FORMATS.length];
  const short = zoneWords(level, zone).every(([word]) => word.length <= BUILD_MAX_LETTERS);
  // spelling out long words is too hard: use the game this planet would otherwise skip
  return format === 'build' && !short ? FORMATS[(i + ZONES) % FORMATS.length] : format;
}

function startZone(zone) {
  scene.facing = 1;
  // on a chatter planet this is a conversation with an alien, taken in order
  const alien = scene.level.aliens && scene.level.aliens[zone];
  const questions = alien ? alien.lines.map((line) => line.say) : shuffle(zoneWords(scene.level, zone));
  // Deal the right answer's position evenly (left, middle, right) so it can't keep landing in one spot.
  const slots = questions.flatMap((_, i) => (i % 3 ? [] : shuffle([0, 1, 2])));
  const format = alien ? 'talk' : formatFor(scene.level, zone);
  const mine = (round = { zone, format, alien, questions, slots, index: 0, results: [] });
  show('play');
  showQuestion();
  sfx.chirp();
  // the talking instructions are long, so they're only given once per visit
  const explain = format !== 'talk' || !talkExplained;
  if (format === 'talk') talkExplained = true;
  const intro = sleep(500).then(() => explain && cur === 'play' && round === mine && say('_door_' + format));
  intro.then(() => sayWord(mine, 0));
}

// What Pip says out loud for the current question: the word itself in most games,
// nothing in the drag game (the word is only written), and Pip's side of a conversation.
function prompt(r) {
  if (r.format === 'listen') return null;
  return clip(r.format === 'talk' ? r.alien.lines[r.index].pip : r.answer);
}

// Says it, unless the player has already moved on.
function sayWord(r, index) {
  if (r.format === 'talk') return; // Pip's line is read by tapping, not spoken
  if (cur !== 'play' || round !== r || r.index !== index || r.locked || !prompt(r)) return;
  return say(prompt(r));
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
  Object.assign(round, { answer, firstTry: true, locked: false });
  renderProgress();
  load(clip(answer));

  $('play').dataset.format = round.format;
  $('hear').hidden = round.format === 'listen';
  $('word').className = 'word';
  $('options').innerHTML = '';
  $('options').classList.remove('dragged');
  GAMES[round.format](answer, others);

  const mine = round;
  const index = round.index;
  if (index > 0) sleep(300).then(() => sayWord(mine, index));
}

// A speech bubble: who is talking, and their sentence with every word tappable to hear it.
function showBubble(who, picture, sentence) {
  const bubble = $('word');
  bubble.className = 'word sentence';
  bubble.innerHTML = '';
  $('zone').dataset.who = who;
  picture.className = 'who';
  const line = document.createElement('div');
  line.className = 'line';
  for (const word of sentence.split(' ')) {
    load(clip(word));
    const w = document.createElement('button');
    w.className = 'w';
    w.textContent = word;
    w.addEventListener('click', () => {
      if (!round || round.locked || w.classList.contains('later')) return;
      say(clip(word));
      light(w, 900);
    });
    line.append(w);
  }
  bubble.append(picture, line);
  return [...line.children];
}

// Draws the eye to the word that should be tapped next.
function nudge(el) {
  el.classList.remove('nudge');
  void el.offsetWidth;
  el.classList.add('nudge');
}

function light(el, ms) {
  el.classList.add('lit');
  setTimeout(() => el.classList.remove('lit'), ms);
}

// The shortcut for Pip's turn (the Pip button): the whole line is read aloud with each word
// lighting up roughly as it's said, then the alien answers. Timed from the clip's length, so it carries on even if
// the speech is cut short by a tap.
async function pipTurn(r, index) {
  const current = () => cur === 'play' && round === r && r.index === index && !r.locked && !r.replied;
  if (!current()) return;
  const buffer = await load(prompt(r));
  if (!current()) return;
  const ms = buffer ? buffer.duration * 1000 : 1500;
  const words = [...document.querySelectorAll('#word .w')];
  const letters = words.reduce((n, w) => n + w.textContent.length + 1, 0);
  let at = 0;
  for (const w of words) {
    const share = ((w.textContent.length + 1) / letters) * ms;
    setTimeout(() => current() && w.isConnected && light(w, share), at);
    at += share;
  }
  say(prompt(r));
  setTimeout(() => current() && reply(r), ms + 700);
}

function reply(r) {
  r.replied = true;
  const picture = alienSprite(r.alien).cloneNode();
  picture.getContext('2d').drawImage(alienSprite(r.alien), 0, 0);
  showBubble('alien', picture, r.answer);
  $('zone').classList.remove('arrive');
  void $('zone').offsetWidth;
  $('zone').classList.add('arrive');
  sfx.alien();
  for (const choice of dealChoices(r.answer, r.questions[r.index].slice(1))) $('options').append(makeDisc(choice));
}

function showTiles(letters) {
  const word = $('word');
  word.style.setProperty('--n', Math.max(letters.length, 3));
  word.innerHTML = letters.map((ch, i) => `<div class="tile${ch ? '' : ' blank'}" style="--i:${i}">${ch || ''}</div>`).join('');
  return [...word.children];
}

function keyTile(letter, onTap) {
  const key = document.createElement('button');
  key.className = 'tile key';
  key.textContent = letter;
  key.addEventListener('click', () => round && !round.locked && onTap(key));
  return key;
}

// Puts the right answer at this question's dealt position among the wrong ones.
function dealChoices(right, wrong) {
  const choices = shuffle(wrong);
  choices.splice(round.slots[round.index], 0, right);
  return choices;
}

const GAMES = {
  // the word is written; three sound buttons, drag the right one onto it
  listen(answer, others) {
    showTiles([...answer]);
    for (const choice of dealChoices(answer, others)) {
      load(clip(choice));
      $('options').append(makeDisc(choice));
    }
  },

  // A conversation. Pip's line is written but not spoken: she reads it by tapping each word
  // in turn to hear it. After the last word the alien's written reply takes its place, with
  // three spoken sentences to choose from. (The Pip button reads the whole line instead.)
  talk(answer, others) {
    const r = round;
    const index = round.index;
    r.replied = false;
    const words = showBubble('pip', sprite(PIP), r.alien.lines[index].pip);
    load(prompt(r));
    for (const choice of [answer, ...others]) load(clip(choice));

    let upTo = 0;
    words.forEach((w, i) => w.classList.add(i ? 'later' : 'next'));
    words.forEach((w, i) =>
      w.addEventListener('click', () => {
        if (round !== r || r.replied || r.locked) return;
        if (i > upTo) return nudge(words[upTo]);
        if (i < upTo) return;
        w.classList.replace('next', 'read');
        if (++upTo < words.length) return words[upTo].classList.replace('later', 'next');
        // that was the last word: let it finish being said, then the alien answers
        load(clip(w.textContent)).then((buffer) =>
          setTimeout(() => cur === 'play' && round === r && r.index === index && !r.replied && reply(r), (buffer ? buffer.duration * 1000 : 600) + 500)
        );
      })
    );
  },

  // the word is spoken; three written words, tap the right one
  find(answer, others) {
    const options = $('options');
    options.style.setProperty('--n', Math.max(5, answer.length, ...others.map((o) => o.length)));
    for (const choice of dealChoices(answer, others)) {
      const card = document.createElement('button');
      card.className = 'card';
      card.textContent = choice;
      card.addEventListener('click', () => {
        if (!round || round.locked) return;
        if (choice !== answer) return miss(card, true);
        card.classList.add('right');
        win();
      });
      options.append(card);
    }
  },

  // the word is spoken and written with one letter missing; tap the letter
  missing(answer, others) {
    const word = answer.toLowerCase();
    const rivals = shuffle(others.map((o) => o.toLowerCase()).filter((o) => o.length === word.length));
    // hide a letter that tells this word apart from a near-miss, when there is one
    const telling = rivals.map((o) => [...word].flatMap((ch, i) => (ch === o[i] ? [] : [i]))).find((spots) => spots.length);
    const at = telling ? pick(telling) : Math.floor(Math.random() * word.length);
    const right = word[at];
    const wrong = [...new Set(rivals.map((o) => o[at]).filter((ch) => ch !== right))];
    const spare = shuffle([...('aeiou'.includes(right) ? 'aeiou' : 'bcdfghjklmnprstvw')]);
    while (wrong.length < 2) {
      const ch = spare.pop();
      if (ch !== right && !wrong.includes(ch)) wrong.push(ch);
    }

    const tiles = showTiles([...word].map((ch, i) => (i === at ? '' : ch)));
    for (const letter of dealChoices(right, wrong.slice(0, 2))) {
      $('options').append(
        keyTile(letter, (key) => {
          if (letter !== right) return miss(key, true);
          tiles[at].textContent = right;
          tiles[at].classList.remove('blank');
          key.classList.add('used');
          win();
        })
      );
    }
  },

  // the word is spoken; its letters are jumbled, tap them in order
  build(answer) {
    const word = [...answer.toLowerCase()];
    const tiles = showTiles(word.map(() => ''));
    let jumbled = shuffle(word);
    while (word.length > 1 && new Set(word).size > 1 && jumbled.join('') === word.join('')) jumbled = shuffle(word);
    let placed = 0;
    $('options').style.setProperty('--n', Math.max(word.length, 3));
    for (const letter of jumbled) {
      $('options').append(
        keyTile(letter, (key) => {
          if (letter !== word[placed]) return miss(key, false);
          tiles[placed].textContent = letter;
          tiles[placed].classList.remove('blank');
          key.classList.add('used');
          sfx.place(placed);
          if (++placed === word.length) win();
        })
      );
    }
  },
};

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
  $('options').classList.add('dragged'); // she's got the idea: put the hint arrows away
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
  await say(clip(choice));
  disc.classList.remove('speaking');
}

function choose(disc, choice) {
  if (choice !== round.answer) {
    disc.style.transform = '';
    return miss(disc, true);
  }
  disc.classList.add('gone');
  document.querySelectorAll('.disc').forEach((d) => d !== disc && d.classList.add('out'));
  win();
}

// A wrong pick. `rule` it out (greyed, can't be picked again) or just shake it.
function miss(el, rule) {
  const mine = round;
  const index = round.index;
  round.firstTry = false;
  el.classList.remove('wrong');
  void el.offsetWidth;
  el.classList.add('wrong');
  if (rule) el.classList.add('out');
  hush();
  sfx.wrong();
  sleep(450)
    .then(() => round === mine && round.index === index && !round.locked && say(nextPhrase('_retry')))
    .then((spoke) => spoke !== false && mine.format !== 'talk' && sayWord(mine, index));
}

// Little squares flying outwards from a point.
function burst(cx, cy, size, count, color) {
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('i');
    spark.className = 'spark';
    spark.style.left = cx + 'px';
    spark.style.top = cy + 'px';
    if (color) spark.style.background = color;
    document.body.append(spark);
    const angle = (i / count) * Math.PI * 2;
    const reach = size * (0.7 + (i % 3) * 0.2);
    spark
      .animate(
        [{ transform: 'translate(-50%, -50%)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(angle) * reach}px), calc(-50% + ${Math.sin(angle) * reach}px))`, opacity: 0 }],
        { duration: 650, delay: 120, easing: 'ease-out', fill: 'both' }
      )
      .finished.then(() => spark.remove());
  }
}

// A big star bursts out over the word, then flies up to its place in the row at the top.
// Gold for a first-try answer, silver otherwise.
function flyStar(gold) {
  const from = (document.querySelector('.card.right') || $('zone')).getBoundingClientRect();
  const to = $('progress').children[round.index].getBoundingClientRect();
  const size = Math.min(innerWidth * 0.45, innerHeight * 0.32, 240);
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;

  burst(cx, cy, size, 12);

  const star = document.createElement('div');
  star.className = 'fly-star' + (gold ? '' : ' silver');
  star.innerHTML = starSvg();
  star.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px`;
  document.body.append(star);
  const land = `translate(${to.left + to.width / 2 - cx}px, ${to.top + to.height / 2 - cy}px) scale(${to.width / size}) rotate(360deg)`;
  star
    .animate(
      [
        { transform: 'scale(0) rotate(-120deg)', offset: 0 },
        { transform: 'scale(1.25) rotate(0deg)', offset: 0.22 },
        { transform: 'scale(1) rotate(0deg)', offset: 0.32 },
        { transform: 'scale(1) rotate(0deg)', offset: 0.6 },
        { transform: land, offset: 1 },
      ],
      { duration: 1400, easing: 'ease-in-out', fill: 'forwards' }
    )
    .finished.then(() => {
      star.remove();
      if (round && cur === 'play') renderProgress();
    });
}

async function win() {
  const mine = round;
  round.locked = true;
  $('word').classList.add('win');
  round.results[round.index] = round.firstTry;
  flyStar(round.firstTry);
  hush();
  sfx.correct();
  await sleep(400);

  // Pip reads the answer back. In a conversation, praise waits for the final line so the chat keeps moving.
  const praise = round.format !== 'talk' || round.index === round.questions.length - 1;
  // The timeout keeps the game moving even if a clip fails to play.
  await Promise.race([say(clip(round.answer)).then(() => praise && say(nextPhrase('_praise'))), sleep(8000)]);
  await sleep(500);
  if (round !== mine || cur !== 'play') return;

  round.index++;
  if (round.index < round.questions.length) showQuestion();
  else finishZone();
}

async function finishZone() {
  const level = scene.level;
  const got = crystalsFor(level);
  got[round.zone] = true;
  store.crystals[level.id] = got;
  save();
  scene.done[round.zone] = true;
  const planetDone = scene.done.every(Boolean);

  // The crystal appears and waits to be tapped; after a few seconds it collects itself.
  const art = $('reward-art');
  art.getAnimations().forEach((anim) => anim.cancel()); // undo the last crystal's flight
  art.classList.remove('taken');
  $('reward-text').textContent = 'Tap the crystal!';
  $('reward').hidden = false;
  sfx.appear();
  if (!tapExplained) {
    tapExplained = true;
    sleep(500).then(() => say('_tap'));
  }
  const waiting = new AbortController();
  await Promise.race([
    new Promise((tapped) => art.addEventListener('pointerdown', tapped, { once: true, signal: waiting.signal })),
    sleep(COLLECT_AFTER),
  ]);
  waiting.abort();

  // it flies up to the crystal counter
  hush();
  sfx.crystal();
  const from = art.getBoundingClientRect();
  const to = $('total').getBoundingClientRect();
  art.classList.add('taken');
  // a flash, a ring and a shower of sparks as it's grabbed, then it swells and shoots off
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  $('reward').animate([{ backgroundColor: '#dff6ff' }, { backgroundColor: '#05060fe6' }], { duration: 350, easing: 'ease-out' });
  burst(cx, cy, from.height * 1.1, 18, '#6fe3ff');
  burst(cx, cy, from.height * 0.6, 9, '#ffffff');
  const ring = document.createElement('i');
  ring.className = 'ring';
  ring.style.left = cx + 'px';
  ring.style.top = cy + 'px';
  document.body.append(ring);
  ring.animate([{ transform: 'translate(-50%, -50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(4)', opacity: 0 }], { duration: 600, easing: 'ease-out' }).finished.then(() => ring.remove());
  const land = `translate(${to.left + to.width / 2 - cx}px, ${to.top + to.height / 2 - cy}px) scale(.12) rotate(360deg)`;
  art.animate(
    [
      { transform: 'scale(1)', opacity: 1, offset: 0 },
      { transform: 'scale(1.45)', opacity: 1, offset: 0.18 },
      { transform: 'scale(1.3)', opacity: 1, offset: 0.4 },
      { transform: land, opacity: 1, offset: 0.97 },
      { transform: land, opacity: 0, offset: 1 },
    ],
    { duration: 950, easing: 'ease-in-out', fill: 'forwards' }
  );
  $('reward-text').textContent = planetDone ? 'Planet complete!' : 'Crystal found!';
  await sleep(950);
  renderTotal(true);
  if (planetDone) {
    sfx.fanfare();
    await sleep(1900);
  }
  await Promise.race([say('_crystal').then(() => (planetDone ? say('_planetdone') : null)), sleep(10000)]);
  await sleep(500);
  $('reward').hidden = true;
  const gold = round.results.filter(Boolean).length;
  round = null;
  if (!scene) return;
  // every so often, a bonus game before carrying on
  store.sinceBonus = (store.sinceBonus || 0) + 1;
  if (store.sinceBonus >= BONUS_EVERY) {
    store.sinceBonus = 0;
    await playBonus(gold);
    if (!scene) return;
  }
  show('planet');
  if (planetDone) pickUp();
}

/* ---------- wiring ---------- */

$('back').addEventListener('click', () => {
  hush();
  sfx.click();
  if (bonus) return void (bonus.left = 0); // skip the rest of a bonus game
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
  // Pip tells the story every time; the button below it skips ahead
  show('story');
  sfx.chirp();
  sleep(600).then(() => cur === 'story' && say('_story'));
});

$('go').addEventListener('click', () => {
  hush();
  sfx.click();
  renderMap();
});

// Closes this planet's doors again (or resets its aliens) so everything can be replayed.
// Crystals already earned are kept.
$('redo').addEventListener('click', () => {
  if (cur !== 'planet' || !scene || scene.phase) return;
  sfx.click();
  scene.done = Array(ZONES).fill(false);
  scene.goal = scene.target = null;
  $('redo').hidden = true;
});

$('mute').addEventListener('click', () => {
  unlockAudio();
  store.muted = !store.muted;
  save();
  applyMute();
  sfx.click();
});

$('hear').addEventListener('click', () => {
  if (!round || round.locked) return;
  unlockAudio();
  if (round.format === 'talk' && !round.replied) return pipTurn(round, round.index);
  if (prompt(round)) say(prompt(round));
});

document.addEventListener('pointerdown', () => unlockAudio(), true);
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
    $('hear').prepend(sprite(PIP));
    applyMute();
    // Browsers only allow sound after a first tap or click. Get everything ready now so the
    // theme starts at once where that's already allowed, and on the first touch anywhere otherwise.
    try {
      unlockAudio();
    } catch {}
    show('title');
  });
