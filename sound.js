'use strict';

/* Music and sound effects, synthesised in the browser in the style of a
   90s console: square and triangle waves plus filtered noise. No audio files.
   Uses the AudioContext (`ctx`) and saved settings (`store`) from game.js. */

const MUSIC_VOLUME = 0.08;
const SFX_VOLUME = 0.5;

let musicOut = null;
let sfxOut = null;
let noise = null;
let echo = null;
// where music tracks can send their notes: straight out, through the echo, or through a soft filter
const bus = {};

function initSound() {
  musicOut = ctx.createGain();
  musicOut.gain.value = 0;
  musicOut.connect(ctx.destination);
  sfxOut = ctx.createGain();
  sfxOut.gain.value = SFX_VOLUME;
  sfxOut.connect(ctx.destination);

  bus.dry = musicOut;

  bus.echo = ctx.createGain();
  echo = ctx.createDelay(1.5);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  feedback.gain.value = 0.42;
  wet.gain.value = 0.45;
  bus.echo.connect(musicOut);
  bus.echo.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(musicOut);

  bus.pad = ctx.createBiquadFilter();
  bus.pad.type = 'lowpass';
  bus.pad.frequency.value = 1100;
  bus.pad.connect(musicOut);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  setInterval(scheduleMusic, 60);
}

/* ---------- building blocks ---------- */

const SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitch(name, transpose = 0) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  const midi = SEMITONE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12 + transpose;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// One note. `slideTo` bends the pitch over the note's length. `shape` tunes the
// envelope and tone: attack and release in seconds, hold as a fraction of the
// note, detune in cents (adds a second, slightly sharp voice), vibrato in Hz.
function tone(out, when, hz, dur, wave, vol, slideTo, shape = {}) {
  const attack = shape.attack ?? 0.012;
  const release = shape.release ?? dur * 0.12 + 0.01;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(vol, when + attack);
  amp.gain.setTargetAtTime(0, when + Math.max(attack, dur * (shape.hold ?? 0.7)), release);
  amp.connect(out);
  const end = when + dur + release * 5 + 0.1;
  for (const cents of shape.detune ? [-shape.detune, shape.detune] : [0]) {
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(hz, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    if (shape.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = shape.vibrato;
      depth.gain.value = hz * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(when + 0.15);
      lfo.stop(end);
    }
    osc.connect(amp);
    osc.start(when);
    osc.stop(end);
  }
}

// A burst of noise through a filter whose cutoff sweeps from f0 to f1.
function hiss(out, when, dur, kind, f0, f1, vol) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  src.buffer = noise;
  src.loop = true;
  filter.type = kind;
  filter.frequency.setValueAtTime(f0, when);
  filter.frequency.exponentialRampToValueAtTime(f1, when + dur);
  amp.gain.setValueAtTime(0, when);
  amp.gain.linearRampToValueAtTime(vol, when + Math.min(0.08, dur / 3));
  amp.gain.setTargetAtTime(0, when + dur * 0.75, dur * 0.1 + 0.01);
  src.connect(filter).connect(amp).connect(out);
  src.start(when);
  src.stop(when + dur + 0.4);
}

/* ---------- music ---------- */

const repeat = (pattern, times) => Array(times).fill(pattern).join(' ');

// Notes are "name:beats"; "-" is a rest; "C4+E4+G4:4" is a chord.
// Drum tracks use k (kick) and h (hi-hat).
const BELL = { attack: 0.004, hold: 0.04, release: 0.45 };
const PAD = { attack: 0.9, hold: 0.85, release: 0.6, detune: 9 };

const SONGS = {
  // title and galaxy map: pulsing synth arpeggios under a slow soaring lead
  map: {
    bpm: 112,
    tracks: [
      {
        wave: 'triangle', vol: 0.75, bus: 'echo', shape: { attack: 0.05, hold: 0.8, release: 0.25, vibrato: 5.5 },
        notes: `E5:2 A5:2  G5:1.5 F5:.5 E5:2  G5:3 E5:1  D5:3 -:1
                E5:1 A5:1 C6:2  C6:1.5 B5:.5 A5:2  G5:2 E5:1 G5:1  D5:2 B4:2`,
      },
      {
        wave: 'square', vol: 0.11, bus: 'echo', shape: { hold: 0.3, release: 0.05 },
        notes: [
          'A3:.5 E4:.5 A4:.5 C5:.5 E4:.5 A4:.5 C5:.5 E5:.5', 'F3:.5 C4:.5 F4:.5 A4:.5 C4:.5 F4:.5 A4:.5 C5:.5',
          'C4:.5 E4:.5 G4:.5 C5:.5 E4:.5 G4:.5 C5:.5 E5:.5', 'G3:.5 D4:.5 G4:.5 B4:.5 D4:.5 G4:.5 B4:.5 D5:.5',
          'A3:.5 E4:.5 A4:.5 C5:.5 E4:.5 A4:.5 C5:.5 E5:.5', 'F3:.5 C4:.5 F4:.5 B4:.5 C4:.5 F4:.5 B4:.5 C5:.5',
          'C4:.5 E4:.5 G4:.5 C5:.5 E4:.5 G4:.5 C5:.5 E5:.5', 'G3:.5 D4:.5 G4:.5 B4:.5 D4:.5 G4:.5 B4:.5 D5:.5',
        ].join(' '),
      },
      {
        wave: 'sawtooth', vol: 0.1, bus: 'pad', shape: PAD,
        notes: repeat('A3+C4+E4:4 F3+A3+C4:4 C4+E4+G4:4 G3+B3+D4:4', 2),
      },
      {
        wave: 'triangle', vol: 0.8, bus: 'dry', shape: { hold: 0.5, release: 0.06 },
        notes: [repeat('A2:.5', 8), repeat('F2:.5', 8), repeat('C3:.5', 8), repeat('G2:.5', 8)].join(' ').concat(' ').repeat(2),
      },
      { drums: true, vol: 0.4, notes: repeat('k:.5 h:.5', 32) },
    ],
  },
  // planet surfaces: slow drifting pads with echoing bell notes
  planet: {
    bpm: 72,
    tracks: [
      {
        wave: 'sine', vol: 0.8, bus: 'echo', shape: BELL,
        notes: `B4:2 G4:1 E5:3 -:2  D5:2 B4:1 G5:3 -:2
                E5:1 C5:1 B4:2 A4:2 -:2  D5:2 G4:2 B4:3 -:1`,
      },
      {
        wave: 'triangle', vol: 0.22, bus: 'echo', shape: { attack: 0.03, hold: 0.3, release: 0.3 },
        notes: [
          repeat('C4:1 G4:1 B4:1 E5:1', 2), repeat('E4:1 B4:1 D5:1 G5:1', 2),
          repeat('F4:1 C5:1 E5:1 A5:1', 2), repeat('G4:1 D5:1 B4:1 D5:1', 2),
        ].join(' '),
      },
      {
        wave: 'sawtooth', vol: 0.16, bus: 'pad', shape: { ...PAD, attack: 2 },
        notes: 'C3+G3+B3+E4:8 E3+G3+B3+D4:8 F3+A3+C4+E4:8 G3+B3+D4+E4:8',
      },
    ],
  },
};

const music = { name: null, transpose: 0, events: [], beats: 0, index: 0, loopStart: 0, spb: 0.5 };

function compile(song) {
  const events = [];
  let beats = 0;
  for (const track of song.tracks) {
    let at = 0;
    for (const token of track.notes.trim().split(/\s+/)) {
      const [note, len] = token.split(':');
      const dur = parseFloat(len);
      if (note !== '-') for (const one of note.split('+')) events.push({ at, dur, note: one, track });
      at += dur;
    }
    beats = Math.max(beats, at);
  }
  events.sort((a, b) => a.at - b.at);
  return { events, beats };
}

// `level` scales the volume: 0 is silent (used while words are being read).
function setMusic(name, transpose = 0, level = 1) {
  if (!ctx) return;
  if (name && (music.name !== name || music.transpose !== transpose)) {
    Object.assign(music, compile(SONGS[name]), { name, transpose, index: 0, loopStart: ctx.currentTime + 0.15, spb: 60 / SONGS[name].bpm });
    // echoes fall on a dotted beat, which is what gives the rolling, spacey feel
    echo.delayTime.setTargetAtTime(music.spb * 0.75, ctx.currentTime, 0.05);
  }
  music.level = name ? level : 0;
  musicOut.gain.setTargetAtTime(store.muted ? 0 : MUSIC_VOLUME * music.level, ctx.currentTime, 0.25);
}

function scheduleMusic() {
  if (!music.name || ctx.state !== 'running') return;
  const horizon = ctx.currentTime + 0.25;
  if (music.loopStart + music.beats * music.spb < ctx.currentTime) {
    // fell behind (tab was asleep): start the loop again from now
    music.loopStart = ctx.currentTime + 0.1;
    music.index = 0;
  }
  for (;;) {
    const e = music.events[music.index];
    const when = music.loopStart + e.at * music.spb;
    if (when > horizon) break;
    const dur = e.dur * music.spb;
    if (e.track.drums) {
      if (e.note === 'k') tone(musicOut, when, 120, 0.16, 'sine', e.track.vol * 1.6, 42);
      else hiss(musicOut, when, 0.03, 'highpass', 6000, 5000, e.track.vol * 0.35);
    } else {
      tone(bus[e.track.bus], when, pitch(e.note, music.transpose), dur, e.track.wave, e.track.vol, 0, e.track.shape);
    }
    if (++music.index === music.events.length) {
      music.index = 0;
      music.loopStart += music.beats * music.spb;
    }
  }
}

/* ---------- sound effects ---------- */

function effect(play) {
  return (...args) => {
    if (!ctx || store.muted) return;
    play(ctx.currentTime + 0.01, ...args);
  };
}

const sfx = {
  click: effect((t) => tone(sfxOut, t, 660, 0.07, 'square', 0.2, 990)),
  // the ship crossing the map
  fly: effect((t) => hiss(sfxOut, t, 0.9, 'bandpass', 300, 2200, 0.5)),
  // diving towards a planet
  zoom: effect((t) => {
    tone(sfxOut, t, 160, 0.9, 'triangle', 0.35, 1500);
    hiss(sfxOut, t, 0.9, 'bandpass', 500, 4000, 0.25);
  }),
  // the jump between galaxies: a long rising roar, then a boom on arrival
  hyper: effect((t) => {
    hiss(sfxOut, t, 2.5, 'bandpass', 200, 5000, 0.6);
    tone(sfxOut, t, 70, 2.5, 'sawtooth', 0.18, 900);
    tone(sfxOut, t + 2.5, 140, 0.5, 'sine', 0.9, 35);
    hiss(sfxOut, t + 2.5, 0.6, 'lowpass', 3000, 200, 0.6);
  }),
  land: effect((t) => {
    hiss(sfxOut, t, 1.6, 'lowpass', 1400, 160, 0.7);
    tone(sfxOut, t + 1.55, 110, 0.25, 'sine', 0.8, 40);
  }),
  takeoff: effect((t) => hiss(sfxOut, t, 1.1, 'lowpass', 160, 1800, 0.7)),
  step: effect((t) => tone(sfxOut, t, 190, 0.04, 'square', 0.06, 140)),
  // an alien piping up: a low wobble
  alien: effect((t) => {
    tone(sfxOut, t, 220, 0.12, 'sawtooth', 0.14, 330);
    tone(sfxOut, t + 0.11, 330, 0.16, 'sawtooth', 0.14, 180);
  }),
  // Pip's excited bleeping at a door
  chirp: effect((t) => {
    for (let i = 0; i < 5; i++) tone(sfxOut, t + i * 0.075, 900 + Math.random() * 1600, 0.06, 'square', 0.14, 900 + Math.random() * 1600);
  }),
  // a letter dropping into place; each one a step higher
  place: effect((t, step) => tone(sfxOut, t, pitch('C5', step * 2), 0.1, 'square', 0.16)),
  // collecting a star in a bonus game; the note climbs as the tally grows
  collect: effect((t, n) => tone(sfxOut, t, pitch('C5', (n % 8) * 2), 0.09, 'square', 0.16)),
  // the ship's laser
  zap: effect((t) => {
    tone(sfxOut, t, 1500, 0.16, 'sawtooth', 0.2, 180);
    hiss(sfxOut, t + 0.05, 0.2, 'lowpass', 2500, 300, 0.4);
  }),
  correct: effect((t) => ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(sfxOut, t + i * 0.08, pitch(n), 0.12, 'square', 0.2))),
  wrong: effect((t) => {
    tone(sfxOut, t, 220, 0.16, 'triangle', 0.45, 170);
    tone(sfxOut, t + 0.15, 165, 0.25, 'triangle', 0.45, 120);
  }),
  // a crystal appearing, waiting to be collected
  appear: effect((t) => {
    tone(sfxOut, t, pitch('E6'), 0.15, 'sine', 0.3);
    tone(sfxOut, t + 0.12, pitch('B6'), 0.4, 'sine', 0.3);
  }),
  crystal: effect((t) => {
    ['E5', 'G5', 'B5', 'E6', 'G6', 'B6', 'E7'].forEach((n, i) => tone(sfxOut, t + i * 0.07, pitch(n), 0.25, 'sine', 0.3));
    tone(sfxOut, t + 0.5, pitch('E6'), 0.6, 'triangle', 0.25);
  }),
  fanfare: effect((t) => {
    [['G4', 0, 0.15], ['C5', 0.15, 0.15], ['E5', 0.3, 0.15], ['G5', 0.45, 0.4], ['E5', 0.85, 0.15], ['G5', 1.0, 0.8]].forEach(([n, at, dur]) => {
      tone(sfxOut, t + at, pitch(n), dur, 'square', 0.22);
      tone(sfxOut, t + at, pitch(n, -12), dur, 'triangle', 0.3);
    });
  }),
};

function applyMute() {
  if (ctx) musicOut.gain.setTargetAtTime(store.muted ? 0 : MUSIC_VOLUME * (music.level || 0), ctx.currentTime, 0.1);
  document.getElementById('mute').classList.toggle('off', !!store.muted);
}

// Don't keep playing when the tab or phone screen is hidden.
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});
