'use strict';

const STAR = '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>';
const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const STORE_KEY = 'star-words-v1';
const DRAG_THRESHOLD = 12;

const $ = (id) => document.getElementById(id);
const starSvg = (cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${STAR}</svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
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

let store = { total: 0, best: {} };
try {
  store = Object.assign(store, JSON.parse(localStorage.getItem(STORE_KEY)));
} catch {}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

/* ---------- audio ---------- */

let ctx = null;
let playing = null;
const buffers = new Map();

function unlockAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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

// Resolves when the clip finishes. A clip cut off by a newer one never resolves.
async function say(name) {
  const buffer = await load(name);
  if (playing) {
    playing.onended = null;
    try { playing.stop(); } catch {}
    playing = null;
  }
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
let round = null;
let introPlayed = false;

function show(screen) {
  for (const id of ['home', 'play', 'done']) $(id).hidden = id !== screen;
  $('back').hidden = screen === 'home';
  $('progress').hidden = screen !== 'play';
  renderTotal();
}

function renderTotal(bump) {
  const el = $('total');
  el.innerHTML = `${starSvg()}<span>${store.total}</span>`;
  if (bump) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
}

function renderHome() {
  $('levels').innerHTML = '';
  data.levels.forEach((level, i) => {
    const best = store.best[level.id];
    const btn = document.createElement('button');
    btn.className = 'level';
    btn.innerHTML =
      `<span class="num">${i + 1}</span><span class="name">${level.name}</span>` +
      `<span class="best">${best == null ? level.words[0][0] : `best <b>★ ${best}</b> of ${data.roundSize}`}</span>`;
    btn.addEventListener('click', () => startRound(level));
    $('levels').append(btn);
  });
  show('home');
}

/* ---------- a round ---------- */

function startRound(level) {
  unlockAudio();
  round = {
    level,
    questions: shuffle(level.words).slice(0, data.roundSize),
    index: 0,
    results: [],
  };
  show('play');
  showQuestion();
  if (!introPlayed) {
    introPlayed = true;
    say('_intro');
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
  for (const choice of shuffle([answer, ...others])) {
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
    if (round.locked || drag) return;
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
    say(pick(phraseNames('_retry')));
    return;
  }

  round.locked = true;
  disc.classList.add('gone');
  document.querySelectorAll('.disc').forEach((d) => d !== disc && d.classList.add('out'));
  $('word').classList.add('win');
  round.results[round.index] = round.firstTry;
  if (round.firstTry) {
    store.total++;
    save();
    renderTotal(true);
  }
  renderProgress();

  // The timeout keeps the game moving even if a clip fails to play.
  await Promise.race([
    say(round.answer.toLowerCase()).then(() => say(pick(phraseNames('_praise')))),
    sleep(5000),
  ]);
  await sleep(500);
  if (!round || $('play').hidden) return;

  round.index++;
  if (round.index < round.questions.length) showQuestion();
  else finishRound();
}

function finishRound() {
  const stars = round.results.filter(Boolean).length;
  const id = round.level.id;
  store.best[id] = Math.max(store.best[id] || 0, stars);
  save();

  let n = 0;
  $('done-stars').innerHTML = round.results.map((r) => (r ? `<svg class="star" style="--i:${n++}" viewBox="0 0 24 24">${STAR}</svg>` : starSvg())).join('');
  $('done-text').textContent = `${stars} ${stars === 1 ? 'star' : 'stars'}`;
  show('done');
  if (stars) say('_finished');
}

/* ---------- wiring ---------- */

$('back').addEventListener('click', () => {
  round = null;
  drag = null;
  renderHome();
});
$('to-levels').addEventListener('click', renderHome);
$('again').addEventListener('click', () => startRound(round.level));
document.addEventListener('contextmenu', (e) => e.preventDefault());

fetch('words.json')
  .then((r) => r.json())
  .then((json) => {
    data = json;
    renderHome();
  });
