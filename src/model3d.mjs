// Interactive clay model of Nawaf Villa (ground floor), built from NWGF-Model.pdf.
// Source for assets/js/model3d.js — after editing, rebuild it from src/: `npm install` (once), then `npm run model`.
//
// Everything below is traced from the plan drawing in *plan pixels* (the PDF rendered
// ~1300px wide); P() converts them to metres. Plot ≈ 28.2 m × 37 m → ~18.3 px per metre.
import {
  BoxGeometry, CatmullRomCurve3, CylinderGeometry, DirectionalLight,
  ExtrudeGeometry, NeutralToneMapping, Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshStandardMaterial,
  PCFSoftShadowMap, PerspectiveCamera, Scene, Shape, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const PX = 18.3; // plan pixels per metre
const CX = 661, CZ = 421; // plan centre
const P = (x, z) => new Vector2((x - CX) / PX, (z - CZ) / PX);

const WALL_H = 3.2; // cut height — the model is shown like a sectioned presentation model
const FLOOR = 0.3; // finished floor level
const EXT = 0.3, INT = 0.16; // wall thicknesses (m)

// ───────── clay palette ─────────
const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });
const M = {
  board: mat("#d6cfc3"),
  road: mat("#8f8a83"),
  kerb: mat("#c3bcb0"),
  paving: mat("#dcd4c6"),
  drive: mat("#cbc4b8"),
  floor: mat("#efe9df"),
  wall: mat("#f7f3ec"),
  boundary: mat("#e4dccf"),
  roof: mat("#ebe5da"),
  glass: mat("#a9cbd8", { transparent: true, opacity: 0.45, roughness: 0.2 }),
  lawn: mat("#8eae7c"),
  soft: mat("#a8c297"),
  hard: mat("#c2bdb3"),
  deck: mat("#c9a37c"),
  water: mat("#7fb4ca", { roughness: 0.35 }),
  car: mat("#c98463"),
  carTop: mat("#b37256"),
  line: mat("#9d978d"),
  canopy: mat("#86a870", { flatShading: true }),
  trunk: mat("#9b7b5b"),
  planter: mat("#d9d1c4"),
  step: mat("#ece6dc"),
};

// ───────── geometry helpers ─────────
const scene = new Scene();
const model = new Group();
scene.add(model);

function add(geo, material, { cast = true, receive = true, parent = model } = {}) {
  const m = new Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}

/** Flat slab from a polygon of plan points, top face at `top`, `depth` thick. */
function slab(points, top, depth, material, opts) {
  const shape = new Shape(points.map((p) => (p.isVector2 ? p : P(p[0], p[1]))));
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(Math.PI / 2); // shape y → world z, extrusion → world −y
  geo.translate(0, top, 0);
  return add(geo, material, opts);
}
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
function circle(cx, cz, r, n = 40) {
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cz + r * Math.sin((i / n) * Math.PI * 2)]);
}
/** Points along a rounded rectangle (plan px), clockwise from top-left. */
function roundRect(x0, z0, x1, z1, r, n = 6) {
  const pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); } };
  corner(x0 + r, z0 + r, Math.PI);
  corner(x1 - r, z0 + r, -Math.PI / 2);
  corner(x1 - r, z1 - r, 0);
  corner(x0 + r, z1 - r, Math.PI / 2);
  return pts;
}

/** Wall along a polyline (plan px). */
function wall(points, { h = WALL_H, t = EXT, base = FLOOR, material = M.wall, closed = false } = {}) {
  const pts = points.map(([x, z]) => P(x, z));
  if (closed) pts.push(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    if (len < 0.01) continue;
    const geo = new BoxGeometry(len + t, h, t);
    const m = add(geo, material);
    m.position.set((a.x + b.x) / 2, base + h / 2, (a.y + b.y) / 2);
    m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  }
}
const glass = (points) => {
  wall(points, { h: 0.45, t: 0.2 }); // sill
  wall(points, { h: WALL_H - 0.45, t: 0.06, base: FLOOR + 0.45, material: M.glass });
};

function tree(x, z, s = 1) {
  const p = P(x, z);
  const trunk = add(new CylinderGeometry(0.12 * s, 0.16 * s, 1.6 * s, 8), M.trunk);
  trunk.position.set(p.x, 0.15 + 0.8 * s, p.y);
  const top = add(new IcosahedronGeometry(1.25 * s, 1), M.canopy);
  top.position.set(p.x, 0.15 + 2.3 * s, p.y);
  top.rotation.set(x, z, 0);
}

function car(x, z, rot = 0) {
  const p = P(x, z);
  const g = new Group();
  const body = add(new RoundedBoxGeometry(1.85, 0.75, 4.5, 3, 0.28), M.car, { parent: g });
  body.position.y = 0.55;
  const cabin = add(new RoundedBoxGeometry(1.6, 0.6, 2.4, 3, 0.25), M.carTop, { parent: g });
  cabin.position.set(0, 1.1, -0.15);
  g.position.set(p.x, FLOOR - 0.15, p.y);
  g.rotation.y = rot;
  model.add(g);
}

// ───────── site ─────────
// model board, roads and the lane (sikka) behind
slab(rect(360, -45, 962, 915), 0, 0.6, M.board, { cast: false });
slab(rect(360, 800, 962, 915), 0.02, 0.1, M.road, { cast: false });
slab(rect(360, 765, 962, 800), 0.08, 0.1, M.kerb, { cast: false });
slab(rect(360, -45, 962, 72), 0.02, 0.1, M.road, { cast: false });

const plot = [[405, 80], [918, 82], [905, 762], [752, 757], [600, 752], [548, 742], [430, 762]];
slab(plot, 0.08, 0.1, M.paving, { cast: false });

// boundary wall with the vehicle / pedestrian gates on the road and the parking gate on the lane
wall([[810, 81], [405, 80], [430, 762], [548, 742]], { h: 1.6, t: 0.22, base: 0, material: M.boundary });
wall([[752, 757], [905, 762], [918, 82], [905, 82]], { h: 1.6, t: 0.22, base: 0, material: M.boundary });

// front lawn along the lane, driveway, garden
slab(rect(410, 86, 795, 150), 0.14, 0.1, M.lawn, { cast: false });
slab(rect(600, 655, 752, 752), 0.1, 0.1, M.drive, { cast: false });
slab(rect(600, 178, 868, 522), 0.12, 0.1, M.hard, { cast: false });

// timber deck + round deck
slab(rect(602, 180, 700, 362), 0.2, 0.1, M.deck, { cast: false });
slab(circle(668, 360, 45), 0.2, 0.1, M.deck, { cast: false });

// meandering water feature
const riverPath = new CatmullRomCurve3(
  [[688, 222], [730, 238], [765, 262], [745, 292], [778, 318], [756, 348], [726, 376], [738, 408], [712, 442], [722, 476], [704, 516]].map(([x, z]) => new Vector3(x, 0, z))
);
const rp = riverPath.getSpacedPoints(90);
const offset = (d) => rp.map((p, i) => {
  const t = riverPath.getTangentAt(i / (rp.length - 1));
  return [p.x - t.z * d, p.z + t.x * d];
});
slab([...offset(7), ...offset(-7).reverse()], 0.19, 0.1, M.water, { cast: false });

// softscape either side of the stream
slab([...offset(-9).slice(10, 58), [760, 376], [866, 376], [866, 181], [745, 181]], 0.17, 0.1, M.soft, { cast: false });
slab([[710, 455], [745, 452], [752, 470], [752, 520], [714, 520], [718, 488]], 0.17, 0.1, M.soft, { cast: false });

// planter boxes
for (const r of [rect(590, 660, 602, 714), rect(762, 694, 836, 706), rect(818, 742, 870, 753)]) {
  slab(r, 0.75, 0.6, M.planter);
  slab(r, 0.78, 0.05, M.soft, { cast: false });
}

// trees along the lane and in the garden
for (const x of [436, 486, 580, 682, 735, 776]) tree(x, 160, 0.9);
tree(812, 238, 1.1); tree(846, 318, 0.95); tree(730, 492, 0.8); tree(846, 728, 0.7); tree(520, 732, 0.7);

// open parking on the lane
for (const x of [812, 860, 908]) slab(rect(x - 1, 92, x + 1, 164), 0.15, 0.02, M.line, { cast: false });
car(838, 126); car(884, 126);

// ───────── building ─────────
// footprints (floor slabs) — west wing, garage, east wing
const westWing = [[476, 178], [600, 178], [600, 522], [752, 522], [752, 655], [600, 655], [600, 720], [548, 720], [548, 700], [482, 700],
  ...Array.from({ length: 7 }, (_, i) => { const a = Math.PI / 2 + (i / 6) * (Math.PI / 2); return [482 + 20 * Math.cos(a), 680 + 20 * Math.sin(a)]; }),
  [462, 192], [466, 182]];
const eastWing = roundRect(755, 378, 868, 700, 22);
slab(westWing, FLOOR, FLOOR, M.floor);
slab(eastWing, FLOOR, FLOOR, M.floor);

// west wing exterior
wall([[600, 290], [600, 178], [476, 178], [466, 182], [462, 192], [462, 680]]);
wall(westWing.slice(10, 17).reverse().concat([[482, 700], [548, 700], [548, 720], [560, 720]]));
wall([[588, 720], [600, 720], [600, 655]]);
glass([[600, 298], [600, 512]]);
wall([[600, 512], [600, 522], [752, 522], [752, 655]]);
wall([[600, 545], [600, 655]]);
// garage front beam
const beam = add(new BoxGeometry((752 - 600) / PX, 0.5, 0.3), M.wall);
beam.position.set(P(676, 655).x, FLOOR + WALL_H - 0.25, P(676, 655).y);

// west wing interior: service rooms, guest suite, living, stair hall, stores
const int = (pts) => wall(pts, { t: INT });
int([[462, 290], [520, 290]]); int([[542, 290], [600, 290]]);
int([[500, 178], [500, 262]]); int([[500, 215], [600, 215]]); int([[545, 178], [545, 215]]);
int([[462, 240], [488, 240]]); int([[462, 262], [488, 262]]);
int([[462, 517], [548, 517]]);
int([[470, 522], [508, 522], [508, 556], [470, 556]]); // lift shaft
int([[552, 522], [552, 545]]); int([[552, 570], [552, 655]]);
int([[552, 545], [600, 545]]); int([[552, 598], [600, 598]]); int([[552, 655], [600, 655]]);

// curved feature stair
{
  const c = P(502, 612), steps = 17;
  for (let i = 0; i < steps; i++) {
    const a = Math.PI / 2 + (i / steps) * Math.PI;
    const s = add(new BoxGeometry(1.9, 0.18, 0.55), M.step);
    s.position.set(c.x + Math.cos(a) * 1.35, FLOOR + 0.09 + i * 0.18, c.y + Math.sin(a) * 1.35);
    s.rotation.y = -a;
  }
}

// garage bays + cars
for (const x of [652, 700]) slab(rect(x - 1, 548, x + 1, 650), FLOOR + 0.01, 0.01, M.line, { cast: false });
car(628, 598); car(676, 598); car(724, 598);

// east wing: dining, washrooms, saloon
wall(eastWing.slice(0, 7).concat([[780, 378]]));
glass([[780, 378], [843, 378]]);
wall([[843, 378], ...eastWing.slice(7, 21), [828, 700]]);
wall([[812, 700], ...eastWing.slice(21), [755, 456]]);
glass([[755, 400], [755, 456]]);
int([[755, 462], [790, 462], [790, 520], [755, 520]]);
int([[820, 520], [820, 462], [868, 462]]); int([[820, 520], [868, 520]]);

// roof slabs (toggled)
const roof = new Group();
model.add(roof);
slab(westWing, FLOOR + WALL_H + 0.3, 0.3, M.roof, { parent: roof });
slab(eastWing, FLOOR + WALL_H + 0.3, 0.3, M.roof, { parent: roof });
roof.visible = false;

// ───────── renderer / camera / controls ─────────
const LABELS = [
  ["Family living & dining", 530, 400],
  ["Guest bedroom", 550, 252],
  ["Dining", 811, 420],
  ["Garage", 676, 600],
  ["Courtyard garden", 790, 300],
];

export function mount(root) {
  const stage = root.querySelector("[data-model-stage]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    root.classList.add("is-unsupported");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  scene.add(new HemisphereLight("#ffffff", "#b6ab9a", 1.6));
  const sun = new DirectionalLight("#fff4e6", 2.6);
  sun.position.set(-22, 38, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 34, bottom: -34, near: 1, far: 110 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const camera = new PerspectiveCamera(32, 1, 0.5, 400);
  const home = { pos: new Vector3(30, 52, 56), target: new Vector3(0, 0, 2) };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 110;
  controls.maxPolarAngle = 1.38;
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.55;
  // one-finger vertical swipes keep scrolling the page; horizontal swipes orbit, pinch zooms
  renderer.domElement.style.touchAction = "pan-y";

  const resetView = () => {
    camera.position.copy(home.pos);
    controls.target.copy(home.target);
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    if (aspect < 1.2) camera.position.multiplyScalar(Math.min(1.6, 0.95 / aspect + 0.15)); // fit narrow screens
    controls.update();
  };

  // scroll-wheel only zooms once the visitor has clicked into the model
  let engaged = false;
  const hint = root.querySelector("[data-model-hint]");
  stage.addEventListener("pointerdown", () => { engaged = true; controls.autoRotate = false; stage.classList.add("is-engaged"); });
  stage.addEventListener("pointerleave", () => { engaged = false; stage.classList.remove("is-engaged"); });
  stage.addEventListener("wheel", (e) => { if (!engaged) { e.stopPropagation(); hint?.classList.add("is-nudge"); setTimeout(() => hint?.classList.remove("is-nudge"), 1200); } }, { capture: true });

  // keep panning near the model
  controls.addEventListener("change", () => { controls.target.clamp(new Vector3(-16, 0, -20), new Vector3(16, 4, 20)); });

  // labels
  const labelWrap = root.querySelector("[data-model-labels]");
  const labels = LABELS.map(([text, x, z]) => {
    const el = document.createElement("span");
    el.className = "model__label";
    el.textContent = text;
    labelWrap?.appendChild(el);
    const p = P(x, z);
    return { el, pos: new Vector3(p.x, FLOOR + 1.2, p.y) };
  });
  const v = new Vector3();
  const placeLabels = () => {
    if (!labelWrap || labelWrap.hidden) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const l of labels) {
      v.copy(l.pos);
      if (roof.visible) v.y = FLOOR + WALL_H + 0.8;
      v.project(camera);
      const on = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.opacity = on ? "" : "0";
      l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  };

  // buttons
  const roofBtn = root.querySelector("[data-model-roof]");
  roofBtn?.addEventListener("click", () => {
    roof.visible = !roof.visible;
    roofBtn.setAttribute("aria-pressed", String(roof.visible));
  });
  const labelBtn = root.querySelector("[data-model-labels-toggle]");
  labelBtn?.addEventListener("click", () => {
    labelWrap.hidden = !labelWrap.hidden;
    labelBtn.setAttribute("aria-pressed", String(!labelWrap.hidden));
  });
  root.querySelector("[data-model-reset]")?.addEventListener("click", () => {
    resetView();
    controls.autoRotate = !reduceMotion;
  });

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  resetView();

  const frame = () => {
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  };
  // only animate while the model is on screen
  new IntersectionObserver(([e]) => renderer.setAnimationLoop(e.isIntersecting ? frame : null)).observe(stage);
  frame();
  root._view = { camera, controls, roof };
  root.classList.add("is-ready");
}

const root = document.querySelector("[data-model3d]");
if (root) mount(root);
