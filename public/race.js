// Turkey Racer: a tiny low-poly farm kart race, offered after voting when the admin turns it on.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $id = (id) => document.getElementById(id);
const LAPS = 2;
const N = 800; // track samples
const ROAD_HALF = 8;
const CURB = 1.3;
const WALL = ROAD_HALF + 10; // max distance from the centerline
const BEST_KEY = 'turkey-racer-best';
const coarse = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Seeded random so the farm looks the same every time.
let seed = 20261120;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (a) => a[Math.floor(rand() * a.length)];

// ---------- building blocks ----------
const G = {
  sphere: new THREE.SphereGeometry(1, 12, 8),
  ico: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 8),
};
const mats = new Map();
const mat = (color) => {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(color);
};
function part(geo, color, pos, scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(...pos);
  m.scale.set(...(typeof scale === 'number' ? [scale, scale, scale] : scale));
  m.rotation.set(...rot);
  return m;
}

// ---------- drivers (origin at the seat, facing +z) ----------
function buildTurkey() {
  const g = new THREE.Group();
  g.add(part(G.sphere, '#7f4f24', [0, 0.5, 0], [0.62, 0.68, 0.58]));
  g.add(part(G.sphere, '#a0693a', [0, 0.5, 0.28], [0.42, 0.48, 0.32]));
  g.add(part(G.sphere, '#c8a27a', [0, 1.25, 0.25], [0.3, 0.32, 0.3]));
  g.add(part(G.cone, '#f59f00', [0, 1.22, 0.6], [0.09, 0.28, 0.09], [Math.PI / 2, 0, 0]));
  g.add(part(G.sphere, '#e03131', [0, 1.05, 0.5], [0.08, 0.18, 0.08]));
  for (const x of [-0.13, 0.13]) g.add(part(G.sphere, '#1b100b', [x, 1.33, 0.5], 0.05));
  const colors = ['#c92a2a', '#f08c00', '#7f4f24', '#fab005', '#7f4f24', '#f08c00', '#c92a2a'];
  g.userData.wiggle = colors.map((c, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.45, -0.35);
    pivot.rotation.set(-0.35, 0, -1.2 + (i * 2.4) / (colors.length - 1));
    pivot.userData.base = pivot.rotation.z;
    pivot.add(part(G.sphere, c, [0, 0.85, 0], [0.22, 0.85, 0.06]));
    g.add(pivot);
    return pivot;
  });
  return g;
}
function buildPig() {
  const g = new THREE.Group();
  g.add(part(G.sphere, '#f4a6b4', [0, 0.5, 0], [0.6, 0.65, 0.55]));
  g.add(part(G.sphere, '#f7b6c2', [0, 1.2, 0.15], [0.48, 0.45, 0.45]));
  g.add(part(G.cyl, '#e87f95', [0, 1.13, 0.6], [0.2, 0.14, 0.2], [Math.PI / 2, 0, 0]));
  for (const x of [-0.07, 0.07]) g.add(part(G.sphere, '#7d3442', [x, 1.13, 0.68], [0.04, 0.05, 0.03]));
  g.userData.ears = [-1, 1].map((s) => {
    const ear = part(G.cone, '#e87f95', [0.3 * s, 1.6, 0.1], [0.14, 0.28, 0.1], [0, 0, -0.4 * s]);
    ear.userData.base = ear.rotation.z;
    g.add(ear);
    return ear;
  });
  for (const x of [-0.18, 0.18]) g.add(part(G.sphere, '#1b100b', [x, 1.3, 0.52], 0.055));
  return g;
}
function buildSheep() {
  const g = new THREE.Group();
  const puffs = [[0, 0.5, 0], [0.35, 0.55, 0.1], [-0.35, 0.55, 0.1], [0, 0.85, -0.1], [0.3, 0.8, -0.25], [-0.3, 0.8, -0.25], [0, 0.45, -0.3]];
  for (const p of puffs) g.add(part(G.ico, '#f8f4ea', p, 0.4));
  g.add(part(G.sphere, '#3d3532', [0, 1.2, 0.35], [0.27, 0.3, 0.36]));
  g.userData.ears = [-1, 1].map((s) => {
    const ear = part(G.box, '#3d3532', [0.33 * s, 1.27, 0.28], [0.3, 0.08, 0.14], [0, 0, 0.35 * s]);
    ear.userData.base = ear.rotation.z;
    g.add(ear);
    return ear;
  });
  g.add(part(G.ico, '#f8f4ea', [0, 1.48, 0.25], [0.22, 0.18, 0.22]));
  for (const x of [-0.14, 0.14]) {
    g.add(part(G.sphere, '#ffffff', [x, 1.28, 0.6], 0.07));
    g.add(part(G.sphere, '#1b100b', [x, 1.28, 0.66], 0.035));
  }
  return g;
}

// ---------- cars (facing +z) ----------
function wheel(r, w, hub) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ'; // steer (Y) applied after spin (X)
  g.add(part(G.cyl, '#2b2522', [0, 0, 0], [r, w, r], [0, 0, Math.PI / 2]));
  g.add(part(G.cyl, hub, [0, 0, 0], [r * 0.45, w + 0.05, r * 0.45], [0, 0, Math.PI / 2]));
  g.add(part(G.box, '#3d3532', [0, 0, 0], [w + 0.08, r * 1.5, r * 0.22]));
  g.userData.r = r;
  return g;
}
function placeWheels(g, defs) {
  return defs.map(([r, w, hub, x, y, z]) => {
    const wh = wheel(r, w, hub);
    wh.position.set(x, y, z);
    g.add(wh);
    return wh;
  });
}
function buildBuggy() {
  const g = new THREE.Group();
  g.add(part(G.sphere, '#f76707', [0, 1.05, 0], [1.6, 0.95, 2.0]));
  for (const x of [-0.8, 0, 0.8]) g.add(part(G.sphere, '#e8590c', [x, 1.05, 0], [0.5, 0.97, 2.02]));
  g.add(part(G.cyl, '#4a2c17', [0, 1.9, -0.2], [0.75, 0.25, 0.75]));
  g.add(part(G.cyl, '#5c7c2b', [0, 2.05, -1.75], [0.18, 0.9, 0.18], [-0.5, 0, 0]));
  g.add(part(G.sphere, '#7da23a', [0.45, 2.35, -1.95], [0.5, 0.12, 0.3], [0, 0.4, 0]));
  const wheels = placeWheels(g, [
    [0.55, 0.45, '#ffb52e', 1.5, 0.55, 1.2], [0.55, 0.45, '#ffb52e', -1.5, 0.55, 1.2],
    [0.6, 0.5, '#ffb52e', 1.5, 0.6, -1.2], [0.6, 0.5, '#ffb52e', -1.5, 0.6, -1.2],
  ]);
  return { group: g, wheels, front: wheels.slice(0, 2), seat: [0, 1.75, -0.2] };
}
function buildPickup() {
  const g = new THREE.Group();
  g.add(part(G.box, '#c92a2a', [0, 1.0, 0], [2.5, 0.9, 4.6]));
  g.add(part(G.box, '#7d1d10', [0, 0.6, 0], [2.55, 0.25, 4.65]));
  g.add(part(G.box, '#fff3df', [0, 1.0, 2.31], [2.0, 0.45, 0.1]));
  for (const x of [-0.85, 0.85]) g.add(part(G.sphere, '#fff3bf', [x, 1.15, 2.3], 0.18));
  g.add(part(G.box, '#bde0fe', [0, 1.8, 0.95], [2.3, 0.75, 0.1], [-0.35, 0, 0]));
  for (const x of [-1.17, 1.17]) g.add(part(G.box, '#c92a2a', [x, 1.65, -1.3], [0.15, 0.45, 1.9]));
  g.add(part(G.box, '#c92a2a', [0, 1.65, -2.25], [2.5, 0.45, 0.15]));
  g.add(part(G.box, '#e9c46a', [0, 1.85, -1.3], [1.7, 0.8, 1.2]));
  for (const z of [-1.0, -1.6]) g.add(part(G.box, '#b08d3c', [0, 1.85, z], [1.72, 0.82, 0.1]));
  const wheels = placeWheels(g, [
    [0.7, 0.5, '#fff3df', 1.3, 0.7, 1.5], [0.7, 0.5, '#fff3df', -1.3, 0.7, 1.5],
    [0.7, 0.5, '#fff3df', 1.3, 0.7, -1.5], [0.7, 0.5, '#fff3df', -1.3, 0.7, -1.5],
  ]);
  return { group: g, wheels, front: wheels.slice(0, 2), seat: [0, 1.45, 0.1] };
}
function buildTractor() {
  const g = new THREE.Group();
  g.add(part(G.box, '#f2a93b', [0, 1.25, 0.2], [1.4, 0.9, 3.2]));
  g.add(part(G.box, '#f2a93b', [0, 1.75, 0.95], [1.2, 0.9, 1.6]));
  g.add(part(G.box, '#3d3532', [0, 1.7, 1.76], [1.0, 0.7, 0.1]));
  g.add(part(G.cyl, '#3d3532', [0.35, 2.75, 1.25], [0.12, 1.3, 0.12]));
  g.add(part(G.cyl, '#3d3532', [0.35, 3.42, 1.25], [0.18, 0.12, 0.18]));
  for (const x of [-1.25, 1.25]) g.add(part(G.box, '#c92a2a', [x, 2.3, -0.7], [0.75, 0.15, 1.7]));
  g.add(part(G.box, '#c92a2a', [0, 2.1, -1.25], [1.0, 0.9, 0.2]));
  const wheels = placeWheels(g, [
    [0.55, 0.4, '#c92a2a', 0.85, 0.55, 1.35], [0.55, 0.4, '#c92a2a', -0.85, 0.55, 1.35],
    [1.1, 0.7, '#c92a2a', 1.25, 1.1, -0.7], [1.1, 0.7, '#c92a2a', -1.25, 1.1, -0.7],
  ]);
  return { group: g, wheels, front: wheels.slice(0, 2), seat: [0, 1.75, -0.65] };
}

const CHARACTERS = [
  { id: 'turkey', name: 'Turkey', emoji: '🦃', build: buildTurkey, says: ['Gobble!', 'Gobble gobble!', 'Wheee!', 'Not today, oven!'] },
  { id: 'pig', name: 'Pig', emoji: '🐷', build: buildPig, says: ['Oink!', 'Wee wee wee!', 'Hog wild!', 'Snort!'] },
  { id: 'sheep', name: 'Sheep', emoji: '🐑', build: buildSheep, says: ['Baa!', 'Baaa-zooka!', 'Ewe-hoo!', 'Shear speed!'] },
];
// max: top speed, accel: units/s², turn: rad/s at speed
const CARS = [
  { id: 'buggy', name: 'Pumpkin Buggy', emoji: '🎃', tag: 'Gourd all-rounder', max: 44, accel: 20, turn: 1.95, build: buildBuggy },
  { id: 'pickup', name: 'Red Pickup', emoji: '🛻', tag: 'Zippy & slippery', max: 48, accel: 15, turn: 1.7, build: buildPickup },
  { id: 'tractor', name: 'Hay Tractor', emoji: '🚜', tag: 'Slow & steady', max: 41, accel: 28, turn: 2.3, build: buildTractor },
];

function buildKart(charId, carId) {
  const car = CARS.find((c) => c.id === carId).build();
  const driver = CHARACTERS.find((c) => c.id === charId).build();
  driver.position.set(...car.seat);
  driver.scale.setScalar(1.3); // big-headed and cartoonish
  driver.userData.seatY = car.seat[1];
  car.group.add(driver);
  const root = new THREE.Group();
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.9, 2.7, 1);
  shadow.position.y = 0.12;
  root.add(shadow, car.group);
  return { root, body: car.group, wheels: car.wheels, front: car.front, driver, phase: Math.random() * 10 };
}

// ---------- track ----------
const CTRL = [
  [0, 0], [60, 0], [120, -10], [160, -50], [150, -100], [110, -120], [70, -100], [40, -130],
  [0, -160], [-60, -150], [-110, -110], [-130, -50], [-100, 0], [-60, 20], [-30, 10],
];
const SCALE = 1.25;
const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x * SCALE, 0, z * SCALE)), true, 'centripetal');
const LEN = curve.getLength();
const DS = LEN / N;
const S = curve.getSpacedPoints(N).slice(0, N).map((p, i) => {
  const t = curve.getTangentAt(i / N).setY(0).normalize();
  return { p, t, l: new THREE.Vector3(t.z, 0, -t.x), curv: 0 };
});
for (let i = 0; i < N; i++) {
  const a = S[(i - 8 + N) % N].t;
  const b = S[(i + 8) % N].t;
  S[i].curv = Math.acos(clamp(a.dot(b), -1, 1));
}
const headingOf = (t) => Math.atan2(t.x, t.z);
const spinners = []; // windmill blades
const swayers = []; // scarecrows
const smashables = []; // pumpkins you can bonk
const BOOST_PADS = [150, 430, 640];

function sampleAt(s, lane = 0) {
  const m = ((s % N) + N) % N;
  const i = Math.floor(m);
  const f = m - i;
  const a = S[i];
  const b = S[(i + 1) % N];
  const p = a.p.clone().lerp(b.p, f);
  const l = a.l.clone().lerp(b.l, f).normalize();
  const t = a.t.clone().lerp(b.t, f).normalize();
  return { p: p.addScaledVector(l, lane), t, l };
}

function nearestSample(pos, hint) {
  let best = hint;
  let bd = Infinity;
  for (let k = -25; k <= 25; k++) {
    const i = (hint + k + N) % N;
    const d = (pos.x - S[i].p.x) ** 2 + (pos.z - S[i].p.z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

function distToTrack(x, z) {
  let bd = Infinity;
  for (let i = 0; i < N; i += 2) bd = Math.min(bd, (x - S[i].p.x) ** 2 + (z - S[i].p.z) ** 2);
  return Math.sqrt(bd);
}

// ---------- textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const checkerTex = (cols, rows, a = '#1b100b', b = '#fff3df') =>
  canvasTex(cols * 32, rows * 32, (g) => {
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  });

// ---------- world ----------
function buildWorld() {
  const scene = new THREE.Scene();
  const horizon = new THREE.Color('#ffd7a3');
  scene.fog = new THREE.Fog(horizon, 140, 560);

  // Sky dome
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const top = new THREE.Color('#7fb8dd');
  const cols = [];
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp(pos.getY(i) / 500, 0, 1);
    const c = horizon.clone().lerp(top, Math.pow(t, 0.7));
    cols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(38, 32), new THREE.MeshBasicMaterial({ color: '#fff1c9', fog: false }));
  sun.position.set(-520, 150, 420);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  scene.add(new THREE.HemisphereLight('#fff1dc', '#7a5a3a', 1.9));
  const dir = new THREE.DirectionalLight('#ffe0b2', 2.2);
  dir.position.set(-200, 170, 160);
  scene.add(dir);

  // Patchwork fields
  const ground = new THREE.PlaneGeometry(1800, 1800, 45, 45).toNonIndexed();
  ground.rotateX(-Math.PI / 2);
  const fieldCols = ['#b5a642', '#a3a046', '#c2a756', '#9c9a3e', '#b89a4b', '#a9a84f'].map((c) => new THREE.Color(c));
  const gc = [];
  for (let i = 0; i < ground.attributes.position.count; i += 6) {
    const c = pick(fieldCols);
    for (let k = 0; k < 6; k++) gc.push(c.r, c.g, c.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
  scene.add(new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));

  // Road, shoulders, curbs, center line
  const ribbonMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ribbon = (inner, outer, y, colorAt) => {
    const verts = [];
    const colors = [];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const color = colorAt(i);
      if (!color) continue;
      c.set(color);
      const a = S[i];
      const b = S[(i + 1) % N];
      const q = (s, off) => [s.p.x + s.l.x * off, y, s.p.z + s.l.z * off];
      const a0 = q(a, inner), a1 = q(a, outer), b0 = q(b, inner), b1 = q(b, outer);
      verts.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
      for (let k = 0; k < 6; k++) colors.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, ribbonMat));
  };
  const dirt = () => '#9a7448';
  ribbon(ROAD_HALF + CURB, ROAD_HALF + CURB + 3.5, 0.04, dirt);
  ribbon(-ROAD_HALF - CURB - 3.5, -ROAD_HALF - CURB, 0.04, dirt);
  ribbon(-ROAD_HALF, ROAD_HALF, 0.06, (i) => (Math.floor(i / 12) % 2 ? '#5f4b40' : '#5a463b'));
  const curb = (i) => (Math.floor(i / 4) % 2 ? '#c92a2a' : '#fff3df');
  ribbon(ROAD_HALF, ROAD_HALF + CURB, 0.08, curb);
  ribbon(-ROAD_HALF - CURB, -ROAD_HALF, 0.08, curb);
  ribbon(-0.3, 0.3, 0.09, (i) => (Math.floor(i / 8) % 2 ? null : '#f6e4c6'));

  // Start line + arch
  const start = new THREE.Group();
  start.position.copy(S[0].p);
  start.rotation.y = headingOf(S[0].t);
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF * 2, 2.4),
    new THREE.MeshLambertMaterial({ map: checkerTex(14, 2) }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.1;
  start.add(line);
  const span = ROAD_HALF + CURB + 0.8;
  for (const x of [-span, span]) start.add(part(G.cyl, '#7f4f24', [x, 5, 0], [0.35, 10, 0.35]));
  start.add(part(G.box, '#c92a2a', [0, 9.6, 0], [span * 2 + 1.2, 1.9, 0.35]));
  const bannerTex = canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#c92a2a';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < 8; x++) for (let y = 0; y < 5; y++) {
      g.fillStyle = (x + y) % 2 ? '#1b100b' : '#fff3df';
      g.fillRect(x * 16, y * 32, 16, 32);
      g.fillRect(w - 128 + x * 16, y * 32, 16, 32);
    }
    g.fillStyle = '#fff3df';
    g.font = '96px Rye, Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TURKEY RACER', w / 2, h / 2 + 6);
  });
  for (const side of [1, -1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 + 1.2, 1.9), new THREE.MeshBasicMaterial({ map: bannerTex }));
    b.position.set(0, 9.6, 0.19 * side);
    if (side < 0) b.rotation.y = Math.PI;
    start.add(b);
  }
  scene.add(start);

  // Boost pads (orange leaf-pile chevrons)
  const padTex = canvasTex(128, 192, (g, w, h) => {
    g.fillStyle = '#ff6a2b';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ffd43b';
    g.lineWidth = 16;
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const y = 30 + k * 55;
      g.beginPath();
      g.moveTo(22, y);
      g.lineTo(w / 2, y + 36);
      g.lineTo(w - 22, y);
      g.stroke();
    }
  });
  for (const i of BOOST_PADS) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(5, 7.5), new THREE.MeshBasicMaterial({ map: padTex }));
    pad.rotation.set(-Math.PI / 2, 0, 0);
    const holder = new THREE.Group();
    holder.position.copy(S[i].p).setY(0.11);
    holder.rotation.y = headingOf(S[i].t);
    holder.add(pad);
    scene.add(holder);
  }

  // Scenery (merged into a few meshes for speed)
  const deco = new THREE.Group();
  const FALL = ['#d9480f', '#f08c00', '#e8590c', '#c92a2a', '#fab005', '#b5651d'];
  const place = (minD, maxD, tries = 40) => {
    for (let k = 0; k < tries; k++) {
      const x = -330 + rand() * 720;
      const z = -380 + rand() * 520;
      const d = distToTrack(x, z);
      if (d > minD && d < maxD) return [x, z];
    }
    return null;
  };
  for (let n = 0; n < 150; n++) {
    const at = n < 80 ? place(WALL + 5, 50) : place(50, 160); // dense near the road, sparse beyond
    if (!at) continue;
    const s = 0.8 + rand() * 0.9;
    const tree = new THREE.Group();
    tree.position.set(at[0], 0, at[1]);
    tree.scale.setScalar(s);
    tree.add(part(G.cyl, '#6b4226', [0, 1.6, 0], [0.45, 3.2, 0.45]));
    if (rand() < 0.22) {
      tree.add(part(G.cone, '#4d6b3c', [0, 5.2, 0], [2.6, 6.5, 2.6]));
    } else {
      tree.add(part(G.ico, pick(FALL), [0, 5.0, 0], 3.1));
      tree.add(part(G.ico, pick(FALL), [1.2, 4.0, 0.6], 1.9));
    }
    deco.add(tree);
  }
  // Pumpkins along the shoulders
  for (let n = 0; n < 46; n++) {
    const i = 30 + Math.floor(rand() * (N - 60));
    const side = rand() < 0.5 ? -1 : 1;
    const off = side * (ROAD_HALF + CURB + 4 + rand() * 4);
    const p = S[i].p.clone().addScaledVector(S[i].l, off);
    const s = 0.6 + rand() * 0.6;
    deco.add(part(G.sphere, pick(['#f76707', '#fd7e14', '#e8590c']), [p.x, 0.7 * s, p.z], [1.2 * s, 0.85 * s, 1.2 * s]));
    deco.add(part(G.cyl, '#5c7c2b', [p.x, 1.4 * s, p.z], [0.15 * s, 0.5 * s, 0.15 * s]));
  }
  // Round hay bales marking the outside of the tight corners (where the wall is)
  for (let i = 0; i < N; i += 7) {
    if (S[i].curv < 0.55) continue;
    const turnLeft = S[(i + 8) % N].t.dot(S[(i - 8 + N) % N].l) > 0;
    const off = (turnLeft ? -1 : 1) * (WALL + 1.5);
    const p = S[i].p.clone().addScaledVector(S[i].l, off);
    deco.add(part(G.cyl, '#e9c46a', [p.x, 1.3, p.z], [1.3, 2.0, 1.3], [0, headingOf(S[i].t), Math.PI / 2]));
  }
  // Barn + silo in the infield
  for (const [x, z] of [[20, -95], [40, -60], [-20, -80], [-40, -60]].map(([x, z]) => [x * SCALE, z * SCALE])) {
    if (distToTrack(x, z) < 34) continue;
    const barn = new THREE.Group();
    barn.position.set(x, 0, z);
    barn.rotation.y = 0.4;
    barn.add(part(G.box, '#b5371f', [0, 5, 0], [14, 10, 18]));
    barn.add(part(G.cyl, '#5a2a1c', [0, 11.2, 0], [9.6, 18.4, 9.6], [Math.PI / 2, 0, 0]).translateZ(0));
    barn.children[1].geometry = new THREE.CylinderGeometry(1, 1, 1, 3);
    barn.children[1].rotation.set(Math.PI / 2, 0, Math.PI / 2);
    barn.children[1].scale.set(5.2, 18.6, 3.4);
    barn.add(part(G.box, '#fff3df', [0, 3.8, 9.05], [6, 7.6, 0.2]));
    barn.add(part(G.box, '#b5371f', [0, 3.8, 9.1], [5.2, 6.8, 0.2]));
    barn.add(part(G.box, '#fff3df', [0, 3.8, 9.2], [7.4, 0.5, 0.2], [0, 0, 0.9]));
    barn.add(part(G.box, '#fff3df', [0, 3.8, 9.2], [7.4, 0.5, 0.2], [0, 0, -0.9]));
    barn.add(part(G.cyl, '#9aa5ab', [12, 8, -2], [3.2, 16, 3.2]));
    barn.add(part(G.sphere, '#7d8a90', [12, 16, -2], 3.2));
    deco.add(barn);
    break;
  }
  // Distant hills
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + rand() * 0.3;
    const r = 560 + rand() * 120;
    deco.add(part(G.cone, pick(['#b07a45', '#9c6b3c', '#c48b52', '#8d6e3f']), [Math.cos(a) * r, 25, Math.sin(a) * r - 90], [90 + rand() * 70, 60 + rand() * 50, 90 + rand() * 70]));
  }
  bake(deco, scene);

  // Windmill (spinning blades)
  for (const [x, z] of [[-70, -70], [95, -60], [-30, -110], [60, -45]].map(([x, z]) => [x * SCALE, z * SCALE])) {
    if (distToTrack(x, z) < 26) continue;
    const mill = new THREE.Group();
    mill.position.set(x, 0, z);
    mill.rotation.y = Math.atan2(S[0].p.x - x, S[0].p.z - z);
    mill.add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.8, 16, 8), mat('#fff3df')));
    mill.children[0].position.y = 8;
    mill.add(part(G.cone, '#c92a2a', [0, 17.4, 0], [2.6, 3, 2.6]));
    mill.add(part(G.box, '#7f4f24', [0, 3, 2.75], [1.6, 3, 0.2]));
    const blades = new THREE.Group();
    blades.position.set(0, 15, 2.4);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI) / 2;
      arm.add(part(G.box, '#fff3df', [0, 4, 0], [1.6, 7.2, 0.15]));
      arm.add(part(G.box, '#c92a2a', [0, 4, 0.1], [0.3, 7.2, 0.1]));
      blades.add(arm);
    }
    blades.add(part(G.sphere, '#7f4f24', [0, 0, 0.2], 0.7));
    mill.add(blades);
    spinners.push(blades);
    scene.add(mill);
    break;
  }

  // Scarecrows waving at the corners
  let crows = 0;
  for (let i = 60; i < N && crows < 4; i += 37) {
    if (S[i].curv < 0.5) continue;
    const turnLeft = S[(i + 8) % N].t.dot(S[(i - 8 + N) % N].l) > 0;
    const side = turnLeft ? 1 : -1; // inside of the corner
    const p0 = S[i].p.clone().addScaledVector(S[i].l, side * (ROAD_HALF + CURB + 6));
    const crow = new THREE.Group();
    crow.position.copy(p0);
    crow.rotation.y = headingOf(S[i].t) + Math.PI / 2 * -side;
    crow.add(part(G.cyl, '#7f4f24', [0, 2.2, 0], [0.18, 4.4, 0.18]));
    crow.add(part(G.box, '#c92a2a', [0, 3.3, 0], [1.4, 1.6, 0.7]));
    crow.add(part(G.box, '#3b5d3a', [0, 2.35, 0], [1.3, 0.5, 0.65]));
    const arms = part(G.box, '#c92a2a', [0, 3.8, 0], [3.4, 0.35, 0.35]);
    crow.add(arms);
    crow.add(part(G.sphere, '#d9b98a', [0, 4.6, 0], 0.62));
    crow.add(part(G.cyl, '#5a3a22', [0, 5.05, 0], [1.1, 0.12, 1.1]));
    crow.add(part(G.cone, '#5a3a22', [0, 5.5, 0], [0.6, 0.9, 0.6]));
    for (const x of [-0.2, 0.2]) crow.add(part(G.sphere, '#1b100b', [x, 4.7, 0.55], 0.08));
    crow.add(part(G.box, '#1b100b', [0, 4.4, 0.58], [0.4, 0.06, 0.05]));
    crow.userData.arms = arms;
    crow.userData.phase = rand() * 6;
    swayers.push(crow);
    scene.add(crow);
    crows++;
  }

  // Pumpkins sitting near the road edges: drive through them to send them flying.
  for (let n = 0; n < 26; n++) {
    const i = 40 + Math.floor(rand() * (N - 80));
    const side = rand() < 0.5 ? -1 : 1;
    const lateral = side * (ROAD_HALF - 1.2 - rand() * 3.5);
    const home = S[i].p.clone().addScaledVector(S[i].l, lateral);
    const obj = new THREE.Group();
    const size = 0.9 + rand() * 0.35;
    obj.add(part(G.sphere, pick(['#f76707', '#fd7e14', '#e8590c']), [0, 0.85 * size, 0], [1.25 * size, 0.9 * size, 1.25 * size]));
    obj.add(part(G.cyl, '#5c7c2b', [0, 1.75 * size, 0], [0.16, 0.5, 0.16], [0.3, 0, 0.2]));
    obj.position.copy(home);
    obj.rotation.y = rand() * 6;
    scene.add(obj);
    smashables.push({ obj, home, vel: new THREE.Vector3(), spin: new THREE.Vector3(), state: 'idle', t: 0 });
  }

  // Corn rows (instanced)
  const cornSpots = [];
  for (let x = -330; x < -170; x += 4.5) for (let z = -260; z < -40; z += 4.5) {
    if (distToTrack(x, z) > WALL + 5) cornSpots.push([x + rand(), z + rand()]);
  }
  const corn = new THREE.InstancedMesh(new THREE.ConeGeometry(0.6, 4, 5), mat('#d9b44a'), cornSpots.length);
  const m4 = new THREE.Matrix4();
  cornSpots.forEach(([x, z], i) => {
    const h = 0.8 + rand() * 0.5;
    m4.compose(new THREE.Vector3(x, 2 * h, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
    corn.setMatrixAt(i, m4);
  });
  scene.add(corn);

  return scene;
}

// Merge every static mesh of the same color into one draw call.
function bake(group, scene) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  for (const [material, geos] of byMat) scene.add(new THREE.Mesh(mergeGeometries(geos), material));
}

// ---------- falling leaves ----------
function buildLeaves(scene) {
  const count = 90;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), count);
  const cols = ['#d9480f', '#f08c00', '#fab005', '#c92a2a', '#b5651d'].map((c) => new THREE.Color(c));
  const data = Array.from({ length: count }, (_, i) => {
    leaves.setColorAt(i, cols[i % cols.length]);
    return { x: (rand() - 0.5) * 80, y: rand() * 26, z: (rand() - 0.5) * 80, vy: 1 + rand() * 1.5, spin: rand() * 6, vs: 1 + rand() * 2, sway: rand() * 6 };
  });
  scene.add(leaves);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  return (dt, center, time) => {
    data.forEach((d, i) => {
      d.y -= d.vy * dt;
      d.spin += d.vs * dt;
      if (d.y < 0 || Math.abs(d.x - center.x) > 45 || Math.abs(d.z - center.z) > 45) {
        d.x = center.x + (rand() - 0.5) * 80;
        d.z = center.z + (rand() - 0.5) * 80;
        d.y = 12 + rand() * 16;
      }
      e.set(d.spin, d.spin * 0.7, 0);
      q.setFromEuler(e);
      v.set(d.x + Math.sin(time + d.sway) * 1.2, d.y, d.z);
      m.compose(v, q, one);
      leaves.setMatrixAt(i, m);
    });
    leaves.instanceMatrix.needsUpdate = true;
  };
}

// ---------- particles (boost flames, dirt) ----------
const particles = [];
function buildParticles(scene) {
  const geo = new THREE.IcosahedronGeometry(0.35, 0);
  const colors = ['#ff6a2b', '#ffb52e', '#d9480f', '#fab005', '#9a7448', '#b08d5c'];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(geo, mat(colors[i % colors.length]));
    m.visible = false;
    scene.add(m);
    particles.push({ m, vel: new THREE.Vector3(), life: 0, max: 1, dirt: i % colors.length >= 4 });
  }
}
function emit(pos, heading, kind) {
  const p = particles.find((q) => q.life <= 0 && q.dirt === (kind === 'dirt'));
  if (!p) return;
  const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
  p.m.position.copy(pos).addScaledVector(back, 2.2).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 1.6));
  p.vel.copy(back).multiplyScalar(4 + Math.random() * 4).add(new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3));
  p.max = p.life = kind === 'dirt' ? 0.5 : 0.7;
  p.m.visible = true;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.vel.y -= 6 * dt;
    p.m.position.addScaledVector(p.vel, dt);
    p.m.scale.setScalar(Math.max(0.01, p.life / p.max));
    p.m.rotation.x += dt * 6;
    if (p.life <= 0) p.m.visible = false;
  }
}

// ---------- pumpkins ----------
let pumpkinsSmashed = 0;
function updateSmashables(dt, racers) {
  for (const s of smashables) {
    if (s.state === 'idle') {
      for (const r of racers) {
        const dx = r.pos.x - s.obj.position.x;
        const dz = r.pos.z - s.obj.position.z;
        if (dx * dx + dz * dz < 2.6 * 2.6 && Math.abs(r.speed) > 4) {
          const f = new THREE.Vector3(Math.sin(r.heading), 0, Math.cos(r.heading));
          s.vel.copy(f).multiplyScalar(r.speed * 0.75 + 6).add(new THREE.Vector3((Math.random() - 0.5) * 10, 12 + Math.random() * 8, (Math.random() - 0.5) * 10));
          s.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
          s.state = 'flying';
          s.t = 0;
          if (r.isPlayer) {
            pumpkinsSmashed++;
            player.speed *= 0.94;
            player.bump = 0.25;
            bonk();
            navigator.vibrate?.(20);
            say(pick(['Bonk!', 'Pumpkin pie!', 'Splat!', 'Yoink!', ...myChar().says]));
          }
          break;
        }
      }
    } else if (s.state === 'flying') {
      s.t += dt;
      s.vel.y -= 32 * dt;
      s.obj.position.addScaledVector(s.vel, dt);
      s.obj.rotation.x += s.spin.x * dt;
      s.obj.rotation.y += s.spin.y * dt;
      s.obj.rotation.z += s.spin.z * dt;
      if (s.obj.position.y < 0 && s.vel.y < 0) {
        s.obj.position.y = 0;
        s.vel.y *= -0.45;
        s.vel.x *= 0.7;
        s.vel.z *= 0.7;
        s.spin.multiplyScalar(0.7);
      }
      if (s.t > 3) {
        s.state = 'respawn';
        s.t = 0;
        s.obj.position.copy(s.home);
        s.obj.rotation.set(0, Math.random() * 6, 0);
        s.obj.scale.setScalar(0.01);
      }
    } else if (s.state === 'respawn') {
      s.t += dt;
      if (s.t > 5) {
        const k = Math.min(1, (s.t - 5) * 2.5);
        s.obj.scale.setScalar(Math.max(0.01, k * (1 + Math.sin(k * Math.PI) * 0.3)));
        if (k >= 1) { s.obj.scale.setScalar(1); s.state = 'idle'; }
      }
    }
  }
}

// ---------- speech bubble ----------
let bubbleT = 0;
let bubbleCooldown = 0;
const myChar = () => CHARACTERS.find((c) => c.id === choice.char);
function say(text, force = false) {
  if (!force && bubbleCooldown > 0) return;
  const el = $id('bubble');
  el.textContent = text;
  el.hidden = false;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  bubbleT = 1.3;
  bubbleCooldown = 1.6;
  voice();
}
const headPos = new THREE.Vector3();
function updateBubble(dt) {
  bubbleCooldown -= dt;
  const el = $id('bubble');
  if (bubbleT <= 0) { el.hidden = true; return; }
  bubbleT -= dt;
  headPos.set(player.pos.x, 5.2, player.pos.z).project(raceCam);
  el.style.left = `${((headPos.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - headPos.y) / 2) * innerHeight}px`;
}

// ---------- garage (picker preview) ----------
function buildGarage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a1911');
  scene.add(new THREE.HemisphereLight('#fff1dc', '#3a2418', 2.0));
  const key = new THREE.DirectionalLight('#ffe0b2', 2.4);
  key.position.set(6, 10, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ff6a2b', 1.6);
  rim.position.set(-8, 4, -8);
  scene.add(rim);
  const gingham = canvasTex(256, 256, (g) => {
    g.fillStyle = '#fff3df';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(200,50,31,.55)';
    for (let i = 0; i < 256; i += 32) { g.fillRect(i, 0, 16, 256); g.fillRect(0, i, 256, 16); }
  });
  gingham.wrapS = gingham.wrapT = THREE.RepeatWrapping;
  gingham.repeat.set(3, 3);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 0.5, 48), [
    mat('#7f4f24'),
    new THREE.MeshLambertMaterial({ map: gingham }),
    mat('#7f4f24'),
  ]);
  table.position.y = -0.25;
  scene.add(table);
  const turntable = new THREE.Group();
  scene.add(turntable);
  return { scene, turntable };
}

// ---------- app ----------
const canvas = $id('game');
let renderer;
let world, garage, updateLeaves;
const raceCam = new THREE.PerspectiveCamera(70, 1, 0.5, 2000);
const garageCam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

let mode = 'select'; // select | countdown | race | done
const choice = { char: 'turkey', car: 'buggy' };
let player = null;
let ais = [];
let raceTime = 0;
let countT = 0;
let lastCount = '';
let maxLapShown = 0;
let orbit = 0;
let preview = null;
let audio = null;
const input = { left: false, right: false, gas: false, rev: false };
const REV_MAX = 14; // reverse top speed
let hintShown = false;
let lastPlace = 4;
let beepT = 0;
const touches = new Map();

main();

async function main() {
  // The admin can switch the game off.
  try {
    const cfg = await api('/api/ballot');
    // Admins (key saved from the admin page) can preview it even while it's off.
    const isAdmin = getKey() && (await api('/api/admin/state', { key: getKey() }).then(() => true, () => false));
    if (!cfg.game && !isAdmin) return showMsg('🦃', 'Turkey Racer is parked', "The game isn't on right now. Thanks for voting!");
  } catch {}

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return showMsg('🥵', 'No 3D here', "This browser can't run the game. Thanks for voting!");
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  try { await document.fonts.load('96px Rye'); } catch {}

  world = buildWorld();
  updateLeaves = buildLeaves(world);
  buildParticles(world);
  garage = buildGarage();

  buildPicker();
  showSelect();
  addEventListener('resize', resize);
  resize();
  bindInput();

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt, now / 1000);
  });
}

function showMsg(emoji, title, text) {
  const el = $id('msg');
  el.innerHTML = `<div class="card"><div class="big-emoji">${emoji}</div><h2>${esc(title)}</h2><p>${esc(text)}</p>
    <div class="actions"><a class="btn btn-fire" style="width:auto;text-decoration:none" href="/">← Back to ballot</a></div></div>`;
  el.hidden = false;
  $id('back').hidden = true;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  // Keep a similar horizontal view on phones (portrait) and laptops.
  const vfov = (2 * Math.atan(Math.tan((78 * Math.PI) / 360) / aspect) * 180) / Math.PI;
  raceCam.fov = clamp(vfov, 55, 80);
  raceCam.aspect = aspect;
  raceCam.updateProjectionMatrix();
  garageCam.aspect = aspect;
  garageCam.fov = aspect < 1 ? 50 : 36;
  // Shift the picker preview up so it sits above the bottom sheet.
  const sheet = $id('select');
  const side = !sheet.hidden && sheet.offsetWidth < w * 0.7 && sheet.offsetHeight > h * 0.8; // landscape side panel
  if (sheet.hidden) garageCam.clearViewOffset();
  else if (side) garageCam.setViewOffset(w, h, sheet.offsetWidth / 2, 0, w, h); // center the kart in the space left of the panel
  else garageCam.setViewOffset(w, h, 0, Math.max(0, sheet.offsetHeight / 2 - 30), w, h);
  garageCam.updateProjectionMatrix();
}

// ---------- picker ----------
function buildPicker() {
  $id('chars').innerHTML = CHARACTERS.map(
    (c) => `<button class="choice" role="radio" data-char="${c.id}" aria-checked="${c.id === choice.char}"><span class="e">${c.emoji}</span>${c.name}</button>`,
  ).join('');
  $id('cars').innerHTML = CARS.map(
    (c) => `<button class="choice" role="radio" data-car="${c.id}" aria-checked="${c.id === choice.car}"><span class="e">${c.emoji}</span>${c.name}<span class="tag">${c.tag}</span></button>`,
  ).join('');
  document.querySelectorAll('[data-char]').forEach((b) => b.addEventListener('click', () => { unlockAudio(); tap(); choice.char = b.dataset.char; syncPicker(); navigator.vibrate?.(8); }));
  document.querySelectorAll('[data-car]').forEach((b) => b.addEventListener('click', () => { unlockAudio(); tap(); choice.car = b.dataset.car; syncPicker(); navigator.vibrate?.(8); }));
  $id('go').addEventListener('click', startRace);
  $id('key-hint').textContent = coarse ? 'Left thumb steers · right thumb is gas and reverse' : '← → steer · ↑ gas · ↓ brake / reverse · Enter to start';
}

function syncPicker() {
  document.querySelectorAll('[data-char]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.char === choice.char)));
  document.querySelectorAll('[data-car]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.car === choice.car)));
  if (preview) garage.turntable.remove(preview.root);
  preview = buildKart(choice.char, choice.car);
  preview.root.children[0].visible = false; // no blob shadow on the table
  garage.turntable.add(preview.root);
}

function showSelect() {
  mode = 'select';
  $id('select').hidden = false;
  $id('logo').hidden = false;
  $id('back').hidden = false;
  $id('quit').hidden = true;
  $id('hud').hidden = true;
  $id('touch').hidden = true;
  $id('results').hidden = true;
  $id('bubble').hidden = true;
  stopEngine();
  clearTouches();
  syncPicker();
  resize();
}

// ---------- race setup ----------
function startRace() {
  unlockAudio();
  tap();
  clearTouches();
  for (const r of [player, ...ais]) if (r) world.remove(r.kart.root);
  $id('select').hidden = true;
  $id('logo').hidden = true;
  $id('back').hidden = true;
  $id('quit').hidden = false;
  $id('results').hidden = true;
  $id('hud').hidden = false;
  $id('touch').hidden = !coarse;
  // First race: show which thumb does what until they get going.
  $id('touch-hint').classList.toggle('show', coarse && !hintShown);
  resize();

  const car = CARS.find((c) => c.id === choice.car);
  const others = CHARACTERS.filter((c) => c.id !== choice.char).map((c) => c.id);
  // Starting grid: two by two behind the line; you start third.
  const grid = [[-7, 3.5], [-7, -3.5], [-15, 3.5], [-15, -3.5]];
  const roster = [others[0], others[1], choice.char];
  const aiCars = ['buggy', 'pickup', 'tractor'].sort(() => Math.random() - 0.5);
  const bases = [40.5, 39, 37.5].sort(() => Math.random() - 0.5);
  const playerSlot = 2;
  const aiSlots = [0, 1, 3];

  const ps = sampleAt(grid[playerSlot][0], grid[playerSlot][1]);
  player = {
    kart: buildKart(choice.char, choice.car),
    car,
    pos: ps.p.clone(),
    heading: headingOf(ps.t),
    speed: 0,
    steer: 0,
    idx: Math.round(((grid[playerSlot][0] % N) + N) % N),
    progress: grid[playerSlot][0],
    lateral: grid[playerSlot][1],
    boost: 0,
    finished: false,
    finishTime: 0,
    bump: 0,
  };
  world.add(player.kart.root);

  ais = aiSlots.map((slot, k) => {
    const r = {
      kart: buildKart(roster[k], aiCars[k]),
      s: grid[slot][0],
      lane: grid[slot][1],
      laneTarget: grid[slot][1],
      laneTimer: 1 + Math.random() * 2,
      speed: 0,
      base: bases[k] + Math.random(),
      finished: false,
      finishTime: 0,
      pos: new THREE.Vector3(),
      heading: 0,
      steerVis: 0,
      laneVel: 0,
    };
    placeAI(r, 0);
    world.add(r.kart.root);
    return r;
  });

  raceTime = 0;
  pumpkinsSmashed = 0;
  maxLapShown = 0;
  countT = 3.2;
  lastCount = '';
  mode = 'countdown';
  syncKart(player.kart, player.pos, player.heading, 0, 0, 0);
  // Start the camera high and swoop down behind the kart.
  const f = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  raceCam.position.copy(player.pos).addScaledVector(f, -30).setY(26);
  camHeading = player.heading;
  raceCam.lookAt(player.pos);
  lastPlace = 4;
  startEngine();
}

// ---------- per-frame ----------
function frame(dt, time) {
  if (mode === 'select') {
    garage.turntable.rotation.y += dt * 0.6;
    if (preview) animateDriver(preview, 10, Math.sin(time * 1.3) * 0.6);
    // Back the camera off until a ~9-unit-wide kart fits the screen width.
    // Also fit ~5.5 units of height into the space above the bottom sheet.
    const tanV = Math.tan((garageCam.fov * Math.PI) / 360);
    const sh = $id('select');
    const side = sh.offsetWidth < innerWidth * 0.7 && sh.offsetHeight > innerHeight * 0.8;
    const above = side ? 0.85 : clamp(1 - sh.offsetHeight / innerHeight, 0.25, 1);
    const across = side ? clamp(1 - sh.offsetWidth / innerWidth, 0.3, 1) : 1;
    const dist = clamp(Math.max(9 / (2 * tanV * garageCam.aspect * across), 5.5 / (2 * tanV * above)), 9, 30);
    garageCam.position.set(0, 1.3 + dist * 0.33, dist);
    garageCam.lookAt(0, 1.3, 0);
    renderer.render(garage.scene, garageCam);
    return;
  }

  if (mode === 'countdown') {
    countT -= dt;
    const label = countT > 2.2 ? '3' : countT > 1.2 ? '2' : countT > 0.2 ? '1' : 'GO!';
    if (label !== lastCount) {
      lastCount = label;
      const el = $id('count');
      el.textContent = label;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      blip(label === 'GO!' ? 880 : 440, label === 'GO!' ? 0.5 : 0.18, 'square', 0.07);
      if (label === 'GO!') blip(1320, 0.45, 'triangle', 0.05, 0.05);
    }
    if (countT <= 0) {
      mode = 'race';
      say(myChar().says[0], true);
      setTimeout(() => { $id('touch-hint').classList.remove('show'); hintShown = true; }, 3500);
    }
  }

  const racing = mode === 'race' || mode === 'done';
  if (racing) raceTime += dt; // keeps running after you finish so the AI get real times
  updatePlayer(dt, racing);
  for (const ai of ais) updateAI(ai, dt, racing);
  separateAIs();
  collide();
  updateSmashables(dt, [
    { pos: player.pos, speed: player.speed, heading: player.heading, isPlayer: true },
    ...ais.map((a) => ({ pos: a.pos, speed: a.speed, heading: a.heading })),
  ]);
  if (player.boost > 0) { emit(player.pos, player.heading, 'boost'); emit(player.pos, player.heading, 'boost'); }
  if (Math.abs(player.lateral) > ROAD_HALF + CURB && player.speed > 12 && Math.random() < 0.7) emit(player.pos, player.heading, 'dirt');
  updateParticles(dt);
  const offroad = Math.abs(player.lateral) > ROAD_HALF + CURB;
  // Engine: idles during the countdown (rev it with GAS!), follows speed in the race.
  updateEngine(mode === 'countdown' ? (input.gas ? 34 : 4) : player.speed, offroad, player.boost > 0);
  if (player.speed < -0.5) {
    beepT -= dt;
    if (beepT <= 0) { blip(1150, 0.16, 'square', 0.035); beepT = 0.55; } // backing-up beeper
  } else beepT = 0;
  for (const b of spinners) b.rotation.z -= dt * 1.2;
  for (const c of swayers) c.userData.arms.rotation.z = Math.sin(time * 3 + c.userData.phase) * 0.35;
  updateCamera(dt);
  updateHud();
  updateBubble(dt);
  updateLeaves(dt, player.pos, time);
  renderer.render(world, raceCam);
}

function steerInput() {
  return (input.left ? 1 : 0) - (input.right ? 1 : 0);
}

function updatePlayer(dt, racing) {
  const p = player;
  const c = p.car;
  let steerTarget = 0;
  let gas = 0;
  let brake = false;

  if (p.finished) {
    // Autopilot cruise after the finish line.
    const ahead = sampleAt(p.idx + 10, 0);
    const want = Math.atan2(ahead.p.x - p.pos.x, ahead.p.z - p.pos.z);
    steerTarget = clamp(wrapAngle(want - p.heading) * 2.5, -1, 1);
    gas = p.speed < 22 ? 1 : 0;
  } else if (racing) {
    // Left thumb steers; right thumb holds GAS (forward) or REV (brake, then reverse).
    steerTarget = steerInput();
    brake = input.rev;
    gas = input.gas && !input.rev ? 1 : 0;
  }

  const off = Math.abs(p.lateral) > ROAD_HALF + CURB * 0.6;
  let max = c.max * (off ? 0.68 : 1);
  if (p.boost > 0) { max *= 1.3; p.boost -= dt; }
  if (brake) {
    if (p.speed > 0.5) p.speed -= 40 * dt; // brake first…
    else p.speed = Math.max(-REV_MAX, p.speed - 16 * dt); // …then back up
  } else if (gas) {
    if (p.speed < 0) p.speed = Math.min(0, p.speed + 40 * dt);
    else if (p.speed < max) p.speed += c.accel * dt * (p.boost > 0 ? 2 : 1);
  }
  if (p.speed > max) p.speed -= (off ? 45 : 16) * dt;
  if (!gas && !brake) {
    const drag = 9 * dt; // coast to a stop
    p.speed = Math.abs(p.speed) <= drag ? 0 : p.speed - Math.sign(p.speed) * drag;
  }

  // Ease into the turn so quick taps make small corrections, long holds make big turns.
  p.steer += (steerTarget - p.steer) * Math.min(1, dt * (steerTarget === 0 ? 10 : 5));
  const grip = Math.min(1, Math.abs(p.speed) / 12);
  p.heading += p.steer * c.turn * grip * dt * (p.speed < 0 ? -1 : 1); // steering flips in reverse, like a real car

  // Steering assist: with no thumb on the steering buttons, the kart gently follows the
  // road at its current lane. Corners still need steering at speed.
  if (racing && !p.finished && p.speed > 5 && Math.abs(p.steer) < 0.15) {
    const lane = clamp(p.lateral, -ROAD_HALF + 1.5, ROAD_HALF - 1.5);
    const ahead = sampleAt(p.idx + 12, lane);
    const err = wrapAngle(Math.atan2(ahead.p.x - p.pos.x, ahead.p.z - p.pos.z) - p.heading);
    p.heading += clamp(err, -0.5, 0.5) * 1.6 * grip * dt;
  }
  p.pos.x += Math.sin(p.heading) * p.speed * dt;
  p.pos.z += Math.cos(p.heading) * p.speed * dt;

  const prev = p.idx;
  p.idx = nearestSample(p.pos, p.idx);
  const s = S[p.idx];
  p.lateral = (p.pos.x - s.p.x) * s.l.x + (p.pos.z - s.p.z) * s.l.z;
  if (Math.abs(p.lateral) > WALL) {
    const over = Math.abs(p.lateral) - WALL;
    const sign = Math.sign(p.lateral);
    p.pos.x -= s.l.x * over * sign;
    p.pos.z -= s.l.z * over * sign;
    p.lateral = WALL * sign;
    // Hay-bale bumpers: lose a little speed and get turned back toward the road.
    p.speed *= 1 - Math.min(1, dt * 1.5);
    p.heading += clamp(wrapAngle(headingOf(s.t) - p.heading), -1, 1) * Math.min(1, dt * 5);
    if (p.bump <= 0) { navigator.vibrate?.(15); thud(); }
    p.bump = 0.25;
  }
  let d = p.idx - prev;
  if (d < -N / 2) d += N;
  if (d > N / 2) d -= N;
  p.progress += d;

  // Boost pads
  for (const pad of BOOST_PADS) {
    const di = Math.min(Math.abs(p.idx - pad), N - Math.abs(p.idx - pad));
    if (di <= 3 && Math.abs(p.lateral) < 2.8 && p.boost <= 0.6) {
      p.boost = 1.2;
      p.speed = Math.max(p.speed, c.max * 1.2);
      blip(300, 0.35, 'sawtooth', 0.05);
      blip(600, 0.3, 'sawtooth', 0.04, 0.08);
      noise(0.5, 0.12, 2500, 'highpass');
      navigator.vibrate?.(25);
      say(pick(['Zoom!', 'Leaf boost!', 'Hold onto your feathers!', ...myChar().says]));
    }
  }

  if (!p.finished && p.progress >= LAPS * N) {
    p.finished = true;
    p.finishTime = raceTime;
    saveRace();
    mode = 'done';
    orbit = p.heading + Math.PI;
    banner('FINISH!');
    say(place() === 1 ? pick(['Winner winner, no turkey dinner!', 'Champion!', 'Yee-haw!']) : pick(['Phew!', 'Good race!', 'Next time!']), true);
    blip(523, 0.15, 'triangle', 0.1);
    blip(659, 0.15, 'triangle', 0.1, 0.13);
    blip(784, 0.4, 'triangle', 0.1, 0.26);
    cheer();
    navigator.vibrate?.([30, 60, 30]);
    setTimeout(showResults, 1600);
  }

  p.bump = Math.max(0, p.bump - dt);
  syncKart(p.kart, p.pos, p.heading, p.speed, p.steer, dt, p.bump);
}

function placeAI(ai, dt) {
  const at = sampleAt(ai.s, ai.lane);
  ai.pos.copy(at.p);
  const newHeading = headingOf(at.t) + (ai.laneVel || 0) * 0.02;
  ai.steerVis += ((newHeading - ai.heading) / Math.max(dt, 0.001) * 0.15 - ai.steerVis) * Math.min(1, dt * 5);
  ai.heading = newHeading;
}

function updateAI(ai, dt, racing) {
  if (racing) {
    const i = Math.floor(((ai.s % N) + N) % N);
    let curv = 0;
    for (let k = 4; k <= 22; k += 3) curv = Math.max(curv, S[(i + k) % N].curv);
    let target = Math.min(ai.base, 50 / Math.max(curv, 0.01));
    // Gentle catch-up: keeps the pack close so every race stays interesting.
    const gap = player.progress - ai.s;
    target *= 1 + clamp(gap / 1100, -0.08, 0.1);
    if (ai.finished) target = 24;
    ai.speed += clamp(target - ai.speed, -28 * dt, 15 * dt);
    ai.s += (ai.speed * dt) / DS;

    ai.laneTimer -= dt;
    if (ai.laneTimer <= 0) {
      ai.laneTimer = 1.5 + Math.random() * 2.5;
      ai.laneTarget = (Math.random() - 0.5) * 9;
    }
    const prevLane = ai.lane;
    ai.lane += (ai.laneTarget - ai.lane) * Math.min(1, dt * 0.9);
    ai.laneVel = (ai.lane - prevLane) / Math.max(dt, 0.001);

    if (!ai.finished && ai.s >= LAPS * N) {
      ai.finished = true;
      ai.finishTime = raceTime;
    }
  }
  placeAI(ai, dt);
  syncKart(ai.kart, ai.pos, ai.heading, ai.speed, clamp(-ai.laneVel * 0.25, -1, 1), dt, 0);
}

function separateAIs() {
  for (let a = 0; a < ais.length; a++) for (let b = a + 1; b < ais.length; b++) {
    const A = ais[a];
    const B = ais[b];
    if (Math.abs(A.s - B.s) * DS < 5 && Math.abs(A.lane - B.lane) < 3.2) {
      const dir = A.lane >= B.lane ? 1 : -1;
      A.laneTarget = clamp(A.lane + dir * 2, -5, 5);
      B.laneTarget = clamp(B.lane - dir * 2, -5, 5);
    }
  }
}

function collide() {
  const p = player;
  for (const ai of ais) {
    const dx = p.pos.x - ai.pos.x;
    const dz = p.pos.z - ai.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.001 && d < 3) {
      const push = 3 - d;
      p.pos.x += (dx / d) * push;
      p.pos.z += (dz / d) * push;
      p.speed *= 0.97;
      ai.speed *= 0.985;
      p.bump = 0.2;
      if (Math.abs(p.speed) > 10 && bubbleCooldown <= 0) { honk(); say(pick(['Beep beep!', 'Scooch!', 'Watch it!', 'Coming through!'])); }
      ai.laneTarget = clamp(ai.lane - Math.sign((dx * S[p.idx].l.x + dz * S[p.idx].l.z) || 1) * 2.5, -5, 5);
    }
  }
}

function syncKart(k, pos, heading, speed, steer, dt, bump = 0) {
  k.root.position.set(pos.x, 0.06, pos.z);
  k.root.rotation.y = heading;
  const t = performance.now() / 1000;
  k.body.position.y = Math.sin(t * 18 + pos.x) * 0.03 * Math.min(1, speed / 20) + Math.sin(t * 40) * bump * 0.3;
  k.body.rotation.z = -steer * 0.07;
  for (const w of k.wheels) w.rotation.x += (speed * dt) / w.userData.r;
  for (const w of k.front) w.rotation.y = steer * 0.4;
  k.body.scale.y = 1 - bump * 0.35; // squash on bumps
  animateDriver(k, speed, steer);
}

// Bobbing heads, leaning into turns, wiggly tail feathers, flappy ears.
function animateDriver(k, speed, steer) {
  const d = k.driver;
  const t = performance.now() / 1000 + k.phase;
  const sp = Math.min(1, speed / 25);
  d.position.y = d.userData.seatY + Math.abs(Math.sin(t * 9)) * 0.14 * (0.3 + sp);
  d.rotation.z = Math.sin(t * 4) * 0.08 + steer * 0.18;
  d.rotation.x = -sp * 0.12;
  d.userData.wiggle?.forEach((pv, i) => { pv.rotation.z = pv.userData.base + Math.sin(t * 14 + i * 0.7) * 0.08 * (0.5 + sp); });
  d.userData.ears?.forEach((e, i) => { e.rotation.z = e.userData.base + Math.sin(t * 16 + i * 2) * 0.3 * (0.4 + sp); });
}

const camLook = new THREE.Vector3();
let camHeading = 0;
function updateCamera(dt) {
  const p = player;
  const portrait = raceCam.aspect < 0.9;
  if (mode === 'done') {
    orbit += dt * 0.45;
    const want = new THREE.Vector3(p.pos.x + Math.sin(orbit) * 10, 4.5, p.pos.z + Math.cos(orbit) * 10);
    raceCam.position.lerp(want, 1 - Math.exp(-dt * 2));
    camLook.lerp(new THREE.Vector3(p.pos.x, 1.6, p.pos.z), 1 - Math.exp(-dt * 4));
  } else {
    // Chase cam stays locked a fixed distance behind the kart (only the turning is
    // smoothed), easing back just a little as you speed up.
    camHeading += wrapAngle(p.heading - camHeading) * Math.min(1, dt * 7);
    const f = new THREE.Vector3(Math.sin(camHeading), 0, Math.cos(camHeading));
    const pull = clamp(Math.abs(p.speed) / 48, 0, 1) * 1.5;
    const dist = (portrait ? 12 : 9.5) + pull;
    const height = (portrait ? 5.8 : 4.3) + pull * 0.3;
    const want = p.pos.clone().addScaledVector(f, -dist).setY(height);
    if (mode === 'countdown') raceCam.position.lerp(want, 1 - Math.exp(-dt * 2.2)); // opening swoop
    else raceCam.position.copy(want); // locked on: no lag at speed
    camLook.copy(p.pos).addScaledVector(f, 7).setY(1.6);
  }
  raceCam.lookAt(camLook);
}

// ---------- HUD + results ----------
const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th');
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function place() {
  const p = player;
  let ahead = 0;
  for (const ai of ais) {
    if (ai.finished && (!p.finished || ai.finishTime < p.finishTime)) ahead++;
    else if (!ai.finished && !p.finished && ai.s > p.progress) ahead++;
  }
  return ahead + 1;
}
const hudCache = {};
function setText(id, text) {
  if (hudCache[id] !== text) { hudCache[id] = text; $id(id).textContent = text; }
}
function updateHud() {
  const lap = clamp(Math.floor(player.progress / N) + 1, 1, LAPS);
  setText('h-lap', `${lap}/${LAPS}`);
  const pl = place();
  setText('h-place', ordinal(pl));
  if (mode === 'race' && pl < lastPlace) {
    blip(660, 0.08, 'triangle', 0.07);
    blip(990, 0.14, 'triangle', 0.07, 0.07);
    const chip = $id('h-place-chip');
    chip.classList.remove('up');
    void chip.offsetWidth;
    chip.classList.add('up');
  }
  lastPlace = pl;
  const tStr = fmt(player.finished ? player.finishTime : raceTime);
  if (hudCache['h-time'] !== tStr) {
    hudCache['h-time'] = tStr;
    $id('h-time').innerHTML = [...tStr].map((ch) => `<span${/\d/.test(ch) ? '' : ' class="sep"'}>${ch}</span>`).join('');
  }
  if (mode === 'race' && lap > maxLapShown) {
    if (maxLapShown > 0) {
      banner(lap === LAPS ? 'Final lap!' : `Lap ${lap}`);
      [784, 988, 1175].forEach((f, i) => blip(f, 0.22, 'triangle', 0.08, i * 0.11));
    }
    maxLapShown = lap;
  }
}
function banner(text) {
  const el = $id('banner');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

// ---------- saved race times ----------
const NAME_KEY = 'turkey-racer-name';
let lastSave = null; // Promise<{id, token}> for the race just finished
function saveRace() {
  lastSave = api('/api/race', {
    method: 'POST',
    body: { time: player.finishTime, place: place(), char: choice.char, car: choice.car, pumpkins: pumpkinsSmashed },
  }).catch(() => null);
}
async function submitName(ev) {
  ev.preventDefault();
  const input = $id('racer-name');
  const msg = $id('name-msg');
  const btn = $id('name-save');
  const name = input.value.trim();
  if (!name) { msg.textContent = 'Type a name first!'; input.focus(); return; }
  btn.disabled = true;
  msg.textContent = 'Saving…';
  try {
    const saved = await lastSave;
    if (!saved) throw new Error('This race could not be saved.');
    await api(`/api/race/${saved.id}/name`, { method: 'POST', body: { token: saved.token, name } });
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    input.blur();
    input.disabled = true;
    btn.textContent = '✓';
    msg.textContent = `Saved! ${name} is on the board 🏁`;
    tap();
  } catch (e) {
    btn.disabled = false;
    msg.textContent = e.message || 'Could not save. Try again?';
  }
}

function savedName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

function showResults() {
  const pl = place();
  const time = player.finishTime;
  let best = null;
  try { best = parseFloat(localStorage.getItem(BEST_KEY)) || null; } catch {}
  const newBest = !best || time < best;
  if (newBest) { try { localStorage.setItem(BEST_KEY, String(time)); } catch {} }
  const lines = {
    1: ['🏆', 'Champion of the farm!'],
    2: ['🥈', 'So close! Great driving.'],
    3: ['🥉', 'On the podium!'],
    4: ['🐢', 'Slow and steady… mostly slow.'],
  };
  const [emoji, line] = lines[pl];
  const el = $id('results');
  el.innerHTML = `
    <div class="card">
      <div class="big-emoji">${emoji}</div>
      <div class="place-big">${ordinal(pl)} place</div>
      <p>${line}</p>
      <div class="times">
        <div>Time<b>${fmt(time)}</b></div>
        <div>Best<b>${fmt(newBest ? time : best)}</b></div>
      </div>
      ${newBest ? '<p class="new-best">New personal best! 🔥</p>' : ''}
      <p>🎃 Pumpkins bonked: <b>${pumpkinsSmashed}</b></p>
      <form class="name-form" id="name-form" autocomplete="off">
        <label for="racer-name">Put your name on the leaderboard</label>
        <div class="name-row">
          <input id="racer-name" maxlength="24" placeholder="Your name" enterkeyhint="done" autocapitalize="words" spellcheck="false" value="${esc(savedName())}">
          <button class="btn btn-fire" id="name-save" type="submit">Save</button>
        </div>
        <p class="name-msg" id="name-msg" aria-live="polite"></p>
      </form>
      <div class="stack">
        <button class="btn btn-fire" id="again">🏁 Race again</button>
        <div class="row2">
          <button class="btn btn-ghost" id="change">Change racer</button>
          <a class="btn btn-ghost" href="/">← Ballot</a>
        </div>
      </div>
    </div>`;
  el.hidden = false;
  $id('hud').hidden = true;
  $id('touch').hidden = true;
  $id('quit').hidden = true;
  $id('bubble').hidden = true;
  clearTouches();
  stopEngine();
  if (pl === 1) [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, i === 4 ? 0.6 : 0.14, 'square', 0.05, i * 0.1));
  $id('again').addEventListener('click', startRace);
  $id('change').addEventListener('click', () => { tap(); showSelect(); });
  $id('name-form').addEventListener('submit', submitName);
  if (pl === 1) confetti({ duration: 2500, amount: 140 });
}

// ---------- input ----------
const CLUSTERS = { L: ['c-left', 'c-right'], R: ['c-rev', 'c-gas'] };
function clearTouches() {
  touches.clear();
  input.left = input.right = input.gas = input.rev = false;
  document.querySelectorAll('.ctl.on').forEach((el) => el.classList.remove('on'));
}
function bindInput() {
  const keys = {
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'rev', s: 'rev', S: 'rev', ' ': 'rev',
  };
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea')) return; // typing a name
    if (e.key === 'Enter') {
      if (mode === 'select') startRace();
      else if (!$id('results').hidden) startRace();
      return;
    }
    if (keys[e.key]) { input[keys[e.key]] = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { if (!e.target.closest?.('input, textarea') && keys[e.key]) input[keys[e.key]] = false; });
  addEventListener('blur', clearTouches);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTouches(); });

  // Each finger maps to the nearest control on its half of the screen, so thumbs
  // don't have to land exactly on a button, and sliding between ◀ and ▶ works.
  const zone = $id('touch');
  const controlAt = (x) => {
    const ids = CLUSTERS[x < innerWidth / 2 ? 'L' : 'R'];
    let best = ids[0];
    let bd = Infinity;
    for (const id of ids) {
      const r = $id(id).getBoundingClientRect();
      const d = Math.abs(x - (r.left + r.width / 2));
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  };
  const sync = () => {
    const on = new Set(touches.values());
    input.left = on.has('c-left');
    input.right = on.has('c-right');
    input.gas = on.has('c-gas');
    input.rev = on.has('c-rev');
    for (const id of ['c-left', 'c-right', 'c-gas', 'c-rev']) $id(id).classList.toggle('on', on.has(id));
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { zone.setPointerCapture(e.pointerId); } catch {}
    touches.set(e.pointerId, controlAt(e.clientX));
    navigator.vibrate?.(6);
    sync();
  });
  zone.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    const id = controlAt(e.clientX);
    if (id !== touches.get(e.pointerId)) { touches.set(e.pointerId, id); navigator.vibrate?.(4); sync(); }
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    zone.addEventListener(ev, (e) => { touches.delete(e.pointerId); sync(); });
  }
  zone.addEventListener('contextmenu', (e) => e.preventDefault());

  $id('quit').addEventListener('click', () => { tap(); showSelect(); });
  const muteBtn = $id('mute');
  const showMute = () => {
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  };
  showMute();
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch {}
    unlockAudio();
    if (master) master.gain.value = muted ? 0 : 1;
    showMute();
    tap();
  });

  // No pinch-zoom, double-tap zoom, or rubber-band scrolling while playing.
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.sheet, .results, .race-msg')) e.preventDefault();
  }, { passive: false });
}

// ---------- sound ----------
const MUTE_KEY = 'turkey-racer-muted';
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();
let master = null;
let noiseBuf = null;
let engine = null;
function unlockAudio() {
  try {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      master = audio.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(audio.destination);
      noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    audio.resume();
  } catch {}
}
// Filtered white noise burst: thuds, splats, whooshes, crowds.
function noise(dur, vol, freq, type = 'lowpass', when = 0, attack = 0.005) {
  if (!audio) return;
  const t = audio.currentTime + when;
  const src = audio.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = audio.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = audio.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}
const tap = () => blip(1000, 0.04, 'triangle', 0.05);
const thud = () => { noise(0.18, 0.35, 180); blip(70, 0.16, 'sine', 0.18); };
const honk = () => { blip(392, 0.16, 'square', 0.045); blip(494, 0.16, 'square', 0.045); };
const cheer = () => { noise(2.2, 0.09, 1400, 'bandpass', 0.1, 0.4); noise(1.6, 0.05, 2600, 'bandpass', 0.3, 0.3); };

// Engine hum (two detuned oscillators through a low-pass) + an off-road rumble.
function startEngine() {
  if (!audio || engine) return;
  const o1 = audio.createOscillator();
  const o2 = audio.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  const f = audio.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const g = audio.createGain();
  g.gain.value = 0;
  o1.connect(f);
  o2.connect(f);
  f.connect(g).connect(master);
  const n = audio.createBufferSource();
  n.buffer = noiseBuf;
  n.loop = true;
  const nf = audio.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 350;
  const ng = audio.createGain();
  ng.gain.value = 0;
  n.connect(nf).connect(ng).connect(master);
  o1.start();
  o2.start();
  n.start();
  engine = { o1, o2, f, g, n, ng };
}
function updateEngine(speed, offroad, boosting) {
  if (!engine) return;
  const t = audio.currentTime;
  const sp = Math.abs(speed);
  const freq = 46 + sp * 2.3 + (boosting ? 30 : 0);
  engine.o1.frequency.setTargetAtTime(freq, t, 0.06);
  engine.o2.frequency.setTargetAtTime(freq * 0.501, t, 0.06);
  engine.f.frequency.setTargetAtTime(380 + sp * 22, t, 0.1);
  engine.g.gain.setTargetAtTime(0.03 + Math.min(sp, 50) * 0.0007, t, 0.1);
  engine.ng.gain.setTargetAtTime(offroad && sp > 8 ? 0.16 : 0, t, 0.05);
}
function stopEngine() {
  if (!engine) return;
  const e = engine;
  engine = null;
  const t = audio.currentTime;
  e.g.gain.setTargetAtTime(0, t, 0.08);
  e.ng.gain.setTargetAtTime(0, t, 0.05);
  setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.n.stop(); } catch {} }, 500);
}
function blip(freq, dur, type = 'triangle', vol = 0.08, when = 0) {
  if (!audio) return;
  const t = audio.currentTime + when;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function bonk() {
  blip(180, 0.12, 'square', 0.08);
  blip(90, 0.18, 'sine', 0.12, 0.03);
  noise(0.25, 0.25, 900, 'bandpass', 0.02); // splat
}
function voice() {
  if (!audio) return;
  const id = choice.char;
  const t0 = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.connect(g).connect(master);
  if (id === 'turkey') {
    o.type = 'square';
    for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(k % 2 ? 380 : 560, t0 + k * 0.05);
    g.gain.setValueAtTime(0.05, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
    o.start(t0); o.stop(t0 + 0.34);
  } else if (id === 'pig') {
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, t0);
    o.frequency.exponentialRampToValueAtTime(140, t0 + 0.22);
    g.gain.setValueAtTime(0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.start(t0); o.stop(t0 + 0.27);
  } else {
    o.type = 'triangle';
    o.frequency.setValueAtTime(430, t0);
    const lfo = audio.createOscillator();
    const lg = audio.createGain();
    lfo.frequency.value = 22;
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    lfo.start(t0); lfo.stop(t0 + 0.56);
    o.start(t0); o.stop(t0 + 0.56);
  }
}

let simT = 0;
// Debug handle for testing in the browser console.
window.__race = { S, N, LAPS, get player() { return player; }, get ais() { return ais; }, get mode() { return mode; }, get pumpkins() { return pumpkinsSmashed; }, input, startRace, raceCam, step(dt, n = 1) { for (let i = 0; i < n; i++) frame(dt, (simT += dt)); }, get world() { return world; }, get renderer() { return renderer; } };
