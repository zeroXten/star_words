'use strict';

/* Pixel art, drawn in code so there are no image files to manage.
   Sprites are rows of characters; each character is a colour in PAL. */

const PAL = {
  k: '#1a1423', h: '#6b3a1f', s: '#f2c29b', o: '#f08a24', d: '#b85c12',
  w: '#f4f4f4', g: '#9aa4b5', b: '#3b2b3f', y: '#ffe81f', c: '#5fd6ff',
  C: '#e9fbff', p: '#3b6fd9', f: '#8ff0ff', r: '#e5484d',
};

const HERO_HEAD = [
  '....kkkkkk......',
  '...khhhhhhk.....',
  '..khhhhhhhhk....',
  '..khhhsssssk....',
  '.khhhsskskssk...',
  '.khhhsssssk.....',
  '.khh.ksssk......',
  '..k..kkwwkk.....',
  '....kowwwwok....',
  '...koowyywook...',
  '...ksowwwwosk...',
  '...ksoooooosk...',
  '....kooooook....',
  '....koodoook....',
];
const HERO_STAND = HERO_HEAD.concat([
  '....kook.kook...',
  '....kook.kook...',
  '....kbbk.kbbk...',
  '....kbbbkkbbbk..',
  '....kkkkkkkkkk..',
]);
const HERO_STEP = HERO_HEAD.concat([
  '....koookoook...',
  '...kook...kook..',
  '..kbbk.....kbbk.',
  '..kbbbk....kbbbk',
  '..kkkkk....kkkkk',
]);

// A boxy little robot: square blue head, yellow eyes, grey body with arms.
const PIP = [
  '.....yy.....',
  '.....kk.....',
  '..kkkkkkkk..',
  '.kcccccccck.',
  '.kcyyccyyck.',
  '.kcykccykck.',
  '.kcccccccck.',
  '..kkkkkkkk..',
  'kgkggggggkgk',
  'kgkgoyoygkgk',
  '.kkggggggkk.',
  '...kkkkkk...',
];

const CRYSTAL = [
  '....k....',
  '...kck...',
  '..kcCck..',
  '.kcCCcpk.',
  'kcCCccppk',
  'kcCcccppk',
  'kcccccppk',
  '.kcccppk.',
  '.kccpppk.',
  '..kcppk..',
  '...kpk...',
  '....k....',
];

const SHIP = [
  '..........kkkkkk............',
  '........kkccccwwk...........',
  '.......kwwcCcwwwwkk.........',
  '..kk..kwwwwwwwwwwwwkkk......',
  '.kookkwwwwwwwwwwwwwwwwkkk...',
  'kooowwwwwwoooooowwwwwwwwwkk.',
  'kooowwwwwwwwwwwwwwwwwwwwgggk',
  '.kookkggggggggggggggggkkkk..',
  '..kk..kkkkkkkkkkkkkkkk......',
  '.......kg.........kg........',
  '......kgk........kgk........',
  '.....kkkkk......kkkkk.......',
];

function sprite(rows, pal = PAL) {
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!pal[ch]) return;
      g.fillStyle = pal[ch];
      g.fillRect(x, y, 1, 1);
    })
  );
  return c;
}

const SPR = {
  hero: [sprite(HERO_STAND), sprite(HERO_STEP)],
  pip: sprite(PIP),
  crystal: sprite(CRYSTAL),
  ship: sprite(SHIP),
};

/* ---------- aliens ----------
   In these, a = main colour, b = its shade, y = accent (eyes, lights); the
   three are set per alien, so one shape can be several different characters. */

const ALIEN_SHAPES = {
  blob: [
    '...y......y...',
    '...k......k...',
    '....k....k....',
    '...kkkkkkkk...',
    '..kaaaaaaaak..',
    '.kaawwaawwaak.',
    '.kaawkaawkaak.',
    '.kaaaaaaaaaak.',
    '.kaaakkkkaaak.',
    '.kaaaaaaaaaak.',
    '..kaaaaaaaak..',
    '..kabaaaabak..',
    '.kaak.kk.kaak.',
    '.kak..kk..kak.',
    '.kk........kk.',
  ],
  robot: [
    '......y.......',
    '......k.......',
    '...kkkkkkkk...',
    '...kaaaaaak...',
    '...kayaayak...',
    '...kaaaaaak...',
    '...kabbbbak...',
    '...kkkkkkkk...',
    '.kkkaaaaaakkk.',
    '.kakaaaaaakak.',
    '.kakayyyaakak.',
    '.kakaaaaaakak.',
    '.kkkaaaaaakkk.',
    '...kkkkkkkk...',
    '...kak..kak...',
    '...kak..kak...',
    '..kkkk..kkkk..',
  ],
  monster: [
    '.kk..........kk.',
    '.kwk........kwk.',
    '..kwkkkkkkkkwk..',
    '..kaaaaaaaaaak..',
    '.kaaaaaaaaaaaak.',
    '.kaawwaaaawwaak.',
    '.kaawkaaaakwaak.',
    '.kaaaaaaaaaaaak.',
    '.kaakwkwkwkwaak.',
    '.kaakkkkkkkkaak.',
    '.kaaaaaaaaaaaak.',
    'kaaaaaaaaaaaaaak',
    'kabaaaaaaaaaabak',
    'kaakaaaaaaaakaak',
    '.kk.kaaaaaak.kk.',
    '....kaak.kaak...',
    '...kbbbk.kbbbk..',
    '...kkkkk.kkkkk..',
  ],
  hood: [
    '....kkkk....',
    '...kaaaak...',
    '..kaaaaaak..',
    '..kakkkkak..',
    '..kakyykak..',
    '..kakkkkak..',
    '..kaakkaak..',
    '.kaaaaaaaak.',
    '.kaaaaaaaak.',
    'kaabaaaabaak',
    'kakbaaaabkak',
    'kk.kaaaak.kk',
    '...kaaaak...',
    '...kaaaak...',
    '..kaaaaaak..',
    '..kaaaaaak..',
    '.kaaaaaaaak.',
    '.kkkkkkkkkk.',
  ],
  slug: [
    '.....kkkkkk.........',
    '...kkaaaaaakk.......',
    '..kaaaaaaaaaak......',
    '.kaawwaaawwaaak.....',
    '.kaawkaaawkaaak.....',
    '.kaaaaaaaaaaaak.....',
    '.kaakkkkkkkaaak.....',
    'kaaaaaaaaaaaaaakk...',
    'kaabbbbbbbbaaaaaakk.',
    'kaaaaaaaaaaaaaaaaaak',
    'kabbbbbbbbbbbaaaaaak',
    '.kaaaaaaaaaaaaaaaak.',
    '..kkkkkkkkkkkkkkkk..',
  ],
  guard: [
    '...kkkkkk...',
    '..kaaaaaak..',
    '.kaaaaaaaak.',
    '.kakkkkkkak.',
    '.kaaakkaaak.',
    '.kaakaakaak.',
    '..kaaaaaak..',
    '..kkkkkkkk..',
    '.kaaaaaaaak.',
    'kaakaaaakaak',
    'kakkayyakkak',
    'kakkaaaakkak',
    'kkkkaaaakkkk',
    '...kkkkkk...',
    '...kakkak...',
    '...kakkak...',
    '...kakkak...',
    '..kkakkakk..',
    '..kkkk.kkkk.',
  ],
  tall: [
    '..kkkkkk..',
    '.kaaaaaak.',
    'kaaaaaaaak',
    'kakkaakkak',
    'kakkaakkak',
    'kaaaaaaaak',
    '.kaakkaak.',
    '..kaaaak..',
    '...kaak...',
    '...kaak...',
    '..kaaaak..',
    '.kaaaaaak.',
    '.kakaakak.',
    '.kakaakak.',
    '.kakaakak.',
    '..kaaaak..',
    '..kakkak..',
    '..kakkak..',
    '.kkak.kakk',
  ],
  squid: [
    '....kkkkkk....',
    '..kkaaaaaakk..',
    '.kaaaaaaaaaak.',
    '.kaawwaawwaak.',
    '.kaawkaakwaak.',
    '.kaaaaaaaaaak.',
    '.kaaaaaaaaaak.',
    '..kaaaaaaaak..',
    '..kakakakaak..',
    '.kak.kak.kak..',
    '.kak.kak.kak..',
    '.kbk.kbk.kbk..',
    '..k...k...k...',
  ],
};

const alienSprites = new Map();
function alienSprite(alien) {
  if (!alienSprites.has(alien)) {
    const [a, b, y] = alien.colours;
    alienSprites.set(alien, sprite(ALIEN_SHAPES[alien.shape], { k: PAL.k, w: PAL.w, a, b, y }));
  }
  return alienSprites.get(alien);
}

// `beat` staggers the bobbing between characters; it must not change as the view scrolls
function drawAlien(g, x, y, spr, done, isNext, t, beat) {
  // bobs gently while waiting; hops about once you've talked
  const lift = done ? Math.round(Math.abs(Math.sin(t * 5 + beat)) * 4) : Math.floor(t * 2 + beat) % 2;
  const top = y - spr.height - lift;
  blit(g, spr, x - Math.floor(spr.width / 2), top);
  if (!done) {
    // a speech bubble: it has something to say
    rect(g, PAL.k, x - 7, top - 13, 15, 10);
    rect(g, '#ffffff', x - 6, top - 12, 13, 8);
    rect(g, PAL.k, x - 2, top - 3, 3, 2);
    rect(g, '#ffffff', x - 1, top - 4, 1, 2);
    for (let i = 0; i < 3; i++) rect(g, Math.floor(t * 3) % 3 === i ? '#3b6fd9' : PAL.k, x - 4 + i * 4, top - 9, 1, 2);
  }
  if (isNext) {
    const ay = top - 26 + Math.round(Math.sin(t * 5) * 2);
    for (let r = 0; r < 4; r++) rect(g, '#ffe81f', x - 3 + r, ay + r, 7 - 2 * r, 1);
    rect(g, '#ffe81f', x - 1, ay - 3, 3, 3);
  }
}

/* ---------- helpers ---------- */

// Repeatable "random" number in 0..1 for a given input.
function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function rect(g, color, x, y, w, h) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

function disc(g, color, cx, cy, r) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - w), Math.round(cy + dy), 2 * w + 1, 1);
  }
}

function blit(g, s, x, y, flip) {
  x = Math.round(x);
  y = Math.round(y);
  if (!flip) return g.drawImage(s, x, y);
  g.save();
  g.translate(x + s.width, y);
  g.scale(-1, 1);
  g.drawImage(s, 0, 0);
  g.restore();
}

/* ---------- environments ---------- */

const ENVS = {
  desert: {
    sky: ['#4fb4e6', '#86d0ee', '#f9e2a8', '#f7c887'], sun: '#fff6c2',
    far: ['dunes', '#dba15f'], mid: ['dunes', '#ecc07a'],
    ground: '#f4dba0', dark: '#d2a25c', stone: '#b9774a', deco: ['cactus', 'rock', 'cactus'],
  },
  jungle: {
    sky: ['#1f6f78', '#3aa69b', '#8fd6a8', '#d8f3c0'], sun: '#fdf7c3',
    far: ['round', '#2f7d5b'], mid: ['round', '#3d9a5f'],
    ground: '#5bbf5a', dark: '#2f7d3a', stone: '#8a8a76', deco: ['tree', 'bush', 'tree', 'flower'],
  },
  ice: {
    sky: ['#1b2a5c', '#3b5ba5', '#8fb8e8', '#dff1ff'], sun: '#ffffff',
    far: ['peaks', '#a9c8ee'], mid: ['peaks', '#d5e8fb'],
    ground: '#f4fbff', dark: '#a9c8ee', stone: '#6f8fb5', deco: ['pine', 'rock', 'pine'],
  },
  lava: {
    sky: ['#1a0a14', '#4a1020', '#8a1c1c', '#d9480f'], stars: true,
    far: ['peaks', '#2a1018'], mid: ['peaks', '#45141a'],
    ground: '#3a2228', dark: '#ff7b1c', stone: '#6b474e', deco: ['deadtree', 'rock'],
  },
  ocean: {
    sky: ['#2a7fd0', '#58aee8', '#a6dcf5', '#e8f8ff'], sun: '#fff6c2',
    far: ['sea', '#1f6fb8'], mid: ['dunes', '#f1dfa5'],
    ground: '#f6e9bd', dark: '#d8c489', stone: '#c9a66b', deco: ['palm', 'rock', 'palm', 'bush'],
  },
  moon: {
    sky: ['#05060f', '#05060f', '#0b1030', '#151c48'], stars: true, sun: '#7fb2ff',
    far: ['craters', '#4a4f66'], mid: ['craters', '#6a7088'],
    ground: '#9096ad', dark: '#5c627a', stone: '#c8cce0', deco: ['antenna', 'rock', 'lamp'],
  },
  candy: {
    sky: ['#7b4bd1', '#c86fd8', '#f7a1c8', '#ffe0ec'], sun: '#fff6c2',
    far: ['round', '#e86fa8'], mid: ['round', '#f49ac1'],
    ground: '#ffd1e3', dark: '#f08ab8', stone: '#fff7fb', deco: ['mushroom', 'flower', 'mushroom'],
  },
  meadow: {
    sky: ['#4aa3f0', '#7cc4f7', '#bfe5fb', '#f0fbff'], sun: '#fff6c2',
    far: ['round', '#6cc24a'], mid: ['round', '#8fd65a'],
    ground: '#a6e06a', dark: '#5fae3a', stone: '#b9a58a', deco: ['mushroom', 'flower', 'tree', 'bush'],
  },
  city: {
    sky: ['#0a0d2a', '#1a1f55', '#4a2f7a', '#c8508a'], stars: true,
    far: ['city', '#141a44'], mid: ['city', '#1f2a66'],
    ground: '#4a4f6a', dark: '#2c3050', stone: '#8a90b0', deco: ['lamp', 'antenna', 'lamp'],
  },
};

// The second galaxy's planets: familiar landscapes under stranger skies.
Object.assign(ENVS, {
  swamp: { ...ENVS.jungle, sky: ['#2a1244', '#5b2a7a', '#a05aa8', '#e8a8c8'], sun: '#ffd9f5', ground: '#4a9a6a', dark: '#2a6a4a', deco: ['mushroom', 'tree', 'bush', 'mushroom'] },
  dusk: { ...ENVS.desert, sky: ['#1a1040', '#5a2a6a', '#d8605a', '#f7b267'], stars: true, sun: '#ffd9a0', ground: '#e0b070', dark: '#a87840' },
  aurora: { ...ENVS.ice, sky: ['#06122a', '#0f3a4a', '#1f7a6a', '#7fe0b0'], stars: true, sun: '#eafff5' },
  redmoon: { ...ENVS.moon, sun: '#e0603a', far: ['craters', '#5a3a40'], mid: ['craters', '#8a6058'], ground: '#b08a80', dark: '#7a5a55', stone: '#e0c8c0' },
});

function hill(type, x, seed) {
  switch (type) {
    case 'dunes': return 12 + 7 * Math.sin(x * 0.021 + seed) + 3 * Math.sin(x * 0.053 + seed * 2);
    case 'round': return 10 + 12 * Math.abs(Math.sin(x * 0.028 + seed));
    case 'peaks': return 8 + Math.abs(((x * 0.9 + seed * 37) % 46) - 23) * 0.9 + 4 * Math.sin(x * 0.11 + seed);
    case 'city': return 10 + Math.floor(hash(Math.floor(x / 11) + seed * 13) * 26);
    case 'sea': return 9;
    default: return 5 + 2 * Math.sin(x * 0.04 + seed) + (hash(Math.floor(x / 23) + seed) > 0.6 ? 2 : 0);
  }
}

const DECO = {
  cactus(g, x, y) {
    rect(g, '#3f9b4b', x - 1, y - 12, 3, 12);
    rect(g, '#3f9b4b', x - 5, y - 9, 2, 5);
    rect(g, '#3f9b4b', x - 5, y - 5, 4, 2);
    rect(g, '#3f9b4b', x + 4, y - 11, 2, 5);
    rect(g, '#3f9b4b', x + 2, y - 7, 4, 2);
    rect(g, '#2c7038', x + 1, y - 12, 1, 12);
  },
  rock(g, x, y, env) {
    rect(g, env.stone, x - 4, y - 3, 9, 3);
    rect(g, env.stone, x - 3, y - 5, 6, 2);
    rect(g, shade(env.stone, 0.7), x + 1, y - 3, 4, 3);
  },
  tree(g, x, y) {
    rect(g, '#6b4423', x - 1, y - 14, 3, 14);
    disc(g, '#1f6b3a', x - 5, y - 15, 5);
    disc(g, '#1f6b3a', x + 5, y - 15, 5);
    disc(g, '#2e8b47', x, y - 19, 7);
    disc(g, '#49b35f', x - 2, y - 21, 3);
  },
  bush(g, x, y) {
    disc(g, '#2e8b47', x - 3, y - 2, 3);
    disc(g, '#3aa357', x + 2, y - 3, 4);
  },
  pine(g, x, y) {
    rect(g, '#5a3a22', x, y - 4, 2, 4);
    for (let i = 0; i < 3; i++) {
      for (let r = 0; r < 6; r++) rect(g, r < 2 ? '#f4fbff' : '#2b6e5a', x + 1 - r, y - 9 - i * 4 + r, 2 * r, 1);
    }
  },
  deadtree(g, x, y) {
    rect(g, '#1a0c10', x, y - 13, 2, 13);
    rect(g, '#1a0c10', x - 4, y - 10, 4, 1);
    rect(g, '#1a0c10', x - 4, y - 13, 1, 3);
    rect(g, '#1a0c10', x + 2, y - 8, 4, 1);
    rect(g, '#1a0c10', x + 5, y - 12, 1, 4);
  },
  palm(g, x, y) {
    for (let i = 0; i < 15; i++) rect(g, i % 3 ? '#8a5a2b' : '#6b4423', x + Math.round(i * i * 0.02), y - 1 - i, 2, 1);
    const tx = x + 5;
    const ty = y - 16;
    for (let i = 0; i < 7; i++) {
      rect(g, '#2e8b47', tx - i, ty + Math.round(i * i * 0.12), 2, 1);
      rect(g, '#2e8b47', tx + i, ty + Math.round(i * i * 0.12), 2, 1);
      rect(g, '#49b35f', tx - i, ty - 2 + Math.round(i * i * 0.05), 2, 1);
      rect(g, '#49b35f', tx + i, ty - 2 + Math.round(i * i * 0.05), 2, 1);
    }
  },
  antenna(g, x, y, env, t) {
    rect(g, '#c8cce0', x, y - 16, 1, 16);
    rect(g, '#c8cce0', x - 2, y - 13, 5, 1);
    rect(g, Math.floor(t * 2) % 2 ? '#e5484d' : '#6b1d20', x, y - 17, 1, 1);
  },
  lamp(g, x, y) {
    rect(g, '#2c3050', x, y - 14, 1, 14);
    rect(g, '#ffe81f', x - 1, y - 16, 3, 2);
    rect(g, '#fff6c2', x, y - 16, 1, 1);
  },
  mushroom(g, x, y) {
    rect(g, '#fff3df', x - 1, y - 5, 3, 5);
    rect(g, '#e5484d', x - 4, y - 8, 9, 3);
    rect(g, '#e5484d', x - 3, y - 10, 7, 2);
    rect(g, '#ffffff', x - 2, y - 9, 2, 1);
    rect(g, '#ffffff', x + 2, y - 7, 1, 1);
  },
  flower(g, x, y) {
    rect(g, '#2e8b47', x, y - 4, 1, 4);
    rect(g, '#ffe81f', x, y - 6, 1, 1);
    rect(g, '#ff7ab8', x - 1, y - 6, 1, 1);
    rect(g, '#ff7ab8', x + 1, y - 6, 1, 1);
    rect(g, '#ff7ab8', x, y - 7, 1, 1);
    rect(g, '#ff7ab8', x, y - 5, 1, 1);
  },
};

function drawDoor(g, x, y, env, done, isNext, t, beat) {
  const stone = env.stone;
  rect(g, stone, x - 11, y - 24, 22, 24);
  rect(g, shade(stone, 0.75), x + 7, y - 24, 4, 24);
  rect(g, stone, x - 13, y - 28, 26, 4);
  rect(g, shade(stone, 1.2), x - 13, y - 28, 26, 1);
  rect(g, shade(stone, 0.55), x - 8, y - 20, 16, 20);
  if (done) {
    rect(g, '#05060f', x - 7, y - 19, 14, 19);
    blit(g, SPR.crystal, x - 4, y - 44 + Math.sin(t * 3 + beat) * 2);
  } else {
    const glow = Math.floor(t * 3) % 2 ? '#6fe3ff' : '#b8f3ff';
    rect(g, '#0c2244', x - 7, y - 19, 14, 19);
    rect(g, glow, x - 7, y - 19, 14, 1);
    rect(g, glow, x - 7, y - 19, 1, 19);
    rect(g, glow, x + 6, y - 19, 1, 19);
    // three little glyphs on the door
    for (let i = 0; i < 3; i++) rect(g, '#ffe81f', x - 4 + i * 3, y - 12, 2, 3);
  }
  if (isNext) {
    const ay = y - (done ? 56 : 40) + Math.round(Math.sin(t * 5) * 2);
    for (let r = 0; r < 4; r++) rect(g, '#ffe81f', x - 3 + r, ay + r, 7 - 2 * r, 1);
    rect(g, '#ffe81f', x - 1, ay - 3, 3, 3);
  }
}

/* ---------- a planet surface ---------- */

function drawScene(g, W, H, sc, t, crystals) {
  const env = sc.env;
  const cam = Math.round(sc.cam);
  const gy = sc.groundY;

  const band = Math.ceil(gy / env.sky.length);
  env.sky.forEach((color, i) => {
    rect(g, color, 0, i * band, W, band + 1);
    // dithered edge between bands
    if (i) for (let x = i % 2; x < W; x += 2) rect(g, color, x, i * band - 1, 1, 1);
  });

  if (env.stars) {
    for (let i = 0; i < 50; i++) {
      if (hash(i * 3.3 + Math.floor(t * 2 + i)) < 0.15) continue;
      rect(g, '#ffffff', hash(i) * W, hash(i + 99) * gy * 0.8, 1, 1);
    }
  }
  if (env.sun) {
    disc(g, env.sun, Math.round(W * 0.74), Math.round(gy * 0.24), 8);
    if (env.stars) disc(g, shade(env.sun, 0.6), Math.round(W * 0.74) + 3, Math.round(gy * 0.24) + 2, 5);
  }

  [[env.far, 0.25, 10], [env.mid, 0.5, 0]].forEach(([[type, color], speed, lift], layer) => {
    for (let x = 0; x < W; x++) {
      const wx = Math.floor(x + cam * speed);
      const top = Math.round(gy - lift - hill(type, wx, sc.seed + layer * 5));
      rect(g, color, x, top, 1, gy - top);
      if (type === 'city' && wx % 3 === 1) {
        for (let yy = top + 2; yy < gy - 2; yy += 4) if (hash(wx * 7.7 + yy) > 0.55) rect(g, '#ffe9a0', x, yy, 1, 2);
      }
      if (type === 'sea' && hash(wx + Math.floor(t * 2)) > 0.93) rect(g, '#bfe5fb', x, top + 2 + (wx % 5), 2, 1);
    }
  });

  rect(g, env.ground, 0, gy, W, H - gy);
  rect(g, shade(env.ground, 1.12), 0, gy, W, 1);
  for (let x = 0; x < W; x++) {
    const wx = x + cam;
    if (hash(wx * 3.1) > 0.9) rect(g, env.dark, x, gy + 3 + Math.floor(hash(wx) * (H - gy - 4)), 2, 1);
  }

  for (let wx = 14; wx < sc.worldW; wx += 30) {
    const dx = wx + Math.floor(hash(wx + sc.seed) * 16);
    if (sc.pads.some((p) => Math.abs(dx - p) < 26) || sc.places.some((p) => Math.abs(dx - p) < 20)) continue;
    const kind = env.deco[Math.floor(hash(wx * 1.7 + sc.seed) * env.deco.length)];
    if (dx - cam > -20 && dx - cam < W + 20) DECO[kind](g, dx - cam, gy + 1, env, t);
  }

  const lift = Math.round((1 - sc.altitude) * (1 - sc.altitude) * (gy + 30));
  blit(g, SPR.ship, sc.shipX - 14 - cam, gy - 11 - lift);
  if (sc.altitude < 1) {
    const flame = 3 + (Math.floor(t * 14) % 3);
    for (const fx of [-6, 5]) {
      rect(g, '#ffe81f', sc.shipX + fx - cam, gy - lift, 3, flame);
      rect(g, '#f08a24', sc.shipX + fx - cam, gy - lift + flame, 3, 2);
    }
  }

  const next = crystals.indexOf(false);
  const idle = sc.target == null && !sc.phase && !sc.bonus;
  sc.places.forEach((p, i) => {
    const pointed = i === next && idle;
    if (sc.level.aliens) drawAlien(g, p - cam, gy + 1, alienSprite(sc.level.aliens[i]), crystals[i], pointed, t, i);
    else drawDoor(g, p - cam, gy + 1, env, crystals[i], pointed, t, i);
  });

  // the next door is off-screen: point the way
  if (next >= 0 && idle) {
    const px = sc.places[next] - cam;
    const dir = px > W - 8 ? 1 : px < 8 ? -1 : 0;
    const ax = (dir > 0 ? W - 9 : 8) + dir * (Math.floor(t * 3) % 2);
    if (dir) for (let r = 0; r < 5; r++) rect(g, '#ffe81f', ax - dir * r - (dir < 0 ? 1 : 0), gy - 34 - r, 2, 2 * r + 1);
  }

  if (sc.phase === 'landing' || sc.phase === 'leaving') return; // Nova and Pip are aboard

  const bob = Math.round(Math.sin(t * 4) * 2);
  blit(g, SPR.pip, sc.pipX - 6 - cam, gy - 27 + bob, sc.facing < 0);
  rect(g, Math.floor(t * 12) % 2 ? '#8ff0ff' : '#5fd6ff', sc.pipX - 2 - cam, gy - 15 + bob, 4, 2);

  const step = sc.target != null && Math.floor(t * 7) % 2 ? 1 : 0;
  blit(g, SPR.hero[step], sc.heroX - 8 - cam, gy - 18, sc.facing < 0);
}

/* ---------- planets on the galaxy map ---------- */

function planetSprite(env, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const cols = [env.ground, env.mid[1], env.far[1], env.dark, env.mid[1]];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = x - 15.5;
      const dy = y - 15.5;
      if (dx * dx + dy * dy > 15.2 * 15.2) continue;
      const b = Math.floor((y + 2.5 * Math.sin(x * 0.45 + seed) + 2 * hash(Math.floor(x / 3) + y * 9 + seed)) / 4.5 + seed);
      const light = (dx * 0.6 + dy * 0.8) / 15;
      const dim = light > 0.5 || (light > 0.2 && (x + y) % 2) ? 0.55 : light < -0.6 && (x + y) % 2 ? 1.25 : 1;
      g.fillStyle = shade(cols[b % cols.length], dim);
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// Hero, droid and ship together, for the title and story screens.
function castPicture() {
  const c = document.createElement('canvas');
  c.width = 62;
  c.height = 24;
  const g = c.getContext('2d');
  blit(g, SPR.ship, 0, 10);
  blit(g, SPR.hero[0], 32, 5);
  blit(g, SPR.pip, 49, 2);
  rect(g, '#5fd6ff', 53, 14, 4, 2);
  return c;
}

/* ---------- the galaxy behind the map ---------- */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function smoothNoise(x, y, size, seed) {
  const xi = Math.floor(x / size);
  const yi = Math.floor(y / size);
  const fx = x / size - xi;
  const fy = y / size - yi;
  const h = (a, b) => hash(a * 57.3 + b * 131.7 + seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const bottom = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return top + (bottom - top) * sy;
}

const GALAXY_LOOKS = {
  // blue and purple spiral with a golden core
  words: {
    clouds: [['#05060f', '#0f0d2e', '#1c1450', '#2e1a6b'], ['#05060f', '#081a33', '#0c2c4f', '#124368']],
    core: ['#fff3c9', '#c9a9ff', '#5a3fa8'],
    inner: ['#fff6c9', '#ffd27a', '#ffffff'],
    outer: ['#cfe6ff', '#8fb2ff', '#4a5aa8', '#4a5aa8'],
    arms: 2, twist: 0.042, squash: 0.85,
  },
  // green and amber, four tight arms, a hot pink core
  talk: {
    clouds: [['#060a06', '#0f2416', '#1a4226', '#2a6234'], ['#0a0603', '#2a1506', '#52260a', '#80400c']],
    core: ['#ffffff', '#ff9ad8', '#b0308a'],
    inner: ['#ffe0f4', '#ff9ad8', '#ffffff'],
    outer: ['#d8ffc8', '#9fe07a', '#4a8a3a', '#e0a040'],
    arms: 4, twist: 0.075, squash: 0.6,
  },
};

// routes: pairs of [x, y] points to join with dotted lines
function galaxyPicture(W, H, routes, look) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const cx = W / 2;
  const cy = H / 2;
  const [purple, teal] = look.clouds;

  // dithered nebula clouds, brightest around the middle
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dither = BAYER[(y % 4) * 4 + (x % 4)] / 16;
      const d = Math.hypot(x - cx, (y - cy) / look.squash * 0.72);
      const cloud = 0.6 * smoothNoise(x, y, 48, 1) + 0.4 * smoothNoise(x, y, 19, 2);
      const level = clampInt((cloud * 0.8 + Math.max(0, 1 - d / 95) * 0.45) * 4 - 1.3 + dither, 0, 3);
      const core = 1.5 - d / 16 + dither * 0.5;
      g.fillStyle = core > 1.25 ? look.core[0] : core > 1 ? look.core[1] : core > 0.7 ? look.core[2] : (smoothNoise(x, y, 60, 9) > 0.55 ? teal : purple)[level];
      g.fillRect(x, y, 1, 1);
    }
  }

  // two spiral arms of stars
  const { inner, outer } = look;
  for (let i = 0; i < 1500; i++) {
    const r = Math.pow(hash(i), 0.7) * 140;
    const spread = (hash(i + 0.3) + hash(i + 0.6) + hash(i + 0.9) - 1.5) * 0.7;
    const a = r * look.twist + ((i % look.arms) / look.arms) * Math.PI * 2 + spread;
    const tones = r < 45 ? inner : outer;
    rect(g, tones[Math.floor(hash(i + 0.5) * tones.length)], cx + Math.cos(a) * r, cy + Math.sin(a) * r * look.squash, 1, 1);
  }
  for (let i = 0; i < 260; i++) rect(g, hash(i + 7.7) > 0.8 ? '#ffffff' : '#6f7fc0', hash(i * 1.3) * W, hash(i * 2.9) * H, 1, 1);

  for (const [[x1, y1], [x2, y2]] of routes) {
    const steps = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 6);
    for (let i = 3; i < steps - 2; i++) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const y = y1 + ((y2 - y1) * i) / steps;
      rect(g, '#05060f', x - 1, y - 1, 4, 4);
      rect(g, '#6fe3ff', x, y, 2, 2);
    }
  }
  return c;
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

/* ---------- hyperspace ---------- */

// One frame of the jump between galaxies; p runs from 0 to 1.
function drawHyperspace(g, W, H, p) {
  const cx = W / 2;
  const cy = H / 2;
  const far = Math.hypot(cx, cy);
  const rush = p * p;
  rect(g, '#05060f', 0, 0, W, H);
  for (let i = 0; i < 150; i++) {
    const angle = hash(i) * Math.PI * 2;
    const speed = 0.5 + hash(i + 0.2);
    const head = ((2 + hash(i + 0.5) * far + p * 40 * speed + rush * far * 3 * speed) % far) + 2;
    const tail = 1 + rush * 70 * speed;
    const color = i % 5 ? '#ffffff' : i % 2 ? '#9fd8ff' : '#c9a9ff';
    for (let r = Math.max(2, head - tail); r <= head; r += 1) rect(g, color, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1, 1);
  }
  // the screen whites out as it arrives
  if (p > 0.82) {
    g.globalAlpha = (p - 0.82) / 0.18;
    rect(g, '#ffffff', 0, 0, W, H);
    g.globalAlpha = 1;
  }
}
