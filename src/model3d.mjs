// Interactive 3D reconstruction of Retail Park from the supplied renders and owner corrections.
// Source for assets/js/model3d.js — after editing, rebuild it from src/: `npm install` (once), then `npm run model`.
//
// Laid out by hand from the two aerial renders (1f, 3f) and the street-level views, in metres.
// x runs along the site (west → east), z points from the back of the site (−z, jogging trail and dunes) to the road (+z).
// Textures are CC0 (Poly Haven); the sky is the Poly Haven "Syferfontein 6d clear" HDRI.
//
// Performance: static geometry is merged per material (a few dozen draw calls), shadows are rendered once,
// frames are only drawn while something moves, and resolution adapts to the device.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, BloomEffect } from "postprocessing";

const { Vector2, Vector3, Group, Mesh, BoxGeometry, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial } = THREE;

const P = (x, z) => new Vector2(x, z);
const CONNECTOR_HEIGHT = 9.4; // narrow continuous roof section; the rear road is at ground level

const root = document.querySelector("[data-model3d]");
const BASE = root?.dataset.assets || "assets/model/";
const small = window.matchMedia("(max-width: 760px)").matches;

// ───────── textures & materials ─────────
THREE.Cache.enabled = true;
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);
const tex = (id, map, size, srgb) => {
  const t = texLoader.load(`${BASE}tex/${id}_${map}.webp`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / size, 1 / size);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
/** PBR material from a Poly Haven texture set; UVs across the model are in metres, `size` = metres per tile. */
function pbr(id, { size = 2, arm = false, color = "#ffffff", roughness = 1, normal = 1, ...rest } = {}) {
  const m = new MeshStandardMaterial({ color, roughness, metalness: 0, map: tex(id, "diff", size, true), normalMap: tex(id, "nor", size), normalScale: new Vector2(normal, normal), ...rest });
  if (arm) { const a = tex(id, "arm", size); m.aoMap = a; m.roughnessMap = a; }
  return m;
}
function canvasTex(w, h, paint, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// Keep landscaping and parked cars stable across visits and Blender exports.
let seed = 20261014;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const GREENS = ["#37442b", "#46553a", "#596246", "#687051", "#35452f", "#78815d", "#495740"];
const leafTexture = (flowers) => canvasTex(512, 512, (g, w, h) => {
  for (let i = 0; i < 6200; i++) {
    g.save();
    g.translate(rnd() * w, rnd() * h);
    g.rotate(rnd() * Math.PI * 2);
    g.fillStyle = flowers && rnd() < 0.14 ? pick(["#d98ca6", "#e9c46a", "#c9a1d6", "#f1e3d3"]) : pick(GREENS);
    const l = 7 + rnd() * 9;
    g.beginPath(); g.ellipse(0, 0, l, l * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}, 2);
const frondTexture = () => canvasTex(256, 1024, (g, w, h) => {
  g.lineCap = "round";
  for (let y = h * 0.97; y > h * 0.02; y -= 7) {
    const t = 1 - y / h;
    const len = w * 0.48 * Math.sin(Math.PI * Math.min(1, 0.12 + t));
    for (const side of [-1, 1]) {
      g.strokeStyle = pick(GREENS);
      g.lineWidth = 3 + rnd() * 2;
      g.beginPath(); g.moveTo(w / 2, y);
      g.quadraticCurveTo(w / 2 + side * len * 0.5, y - 10, w / 2 + side * len, y - 26 - rnd() * 14);
      g.stroke();
    }
  }
  g.strokeStyle = "#7b6a45"; g.lineWidth = 5;
  g.beginPath(); g.moveTo(w / 2, h); g.lineTo(w / 2, h * 0.02); g.stroke();
});
// perforated brick screen: staggered bricks with deep shadowed gaps (the pavilion's upper band); one tile = 4.8 m × 2.4 m
const screenTexture = () => canvasTex(512, 256, (g, w, h) => {
  const rows = 8, rh = h / rows, bw = 64, gap = 40;
  g.fillStyle = "#2b211c"; g.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? (bw + gap) / 2 : 0;
    for (let x = -bw; x < w + bw; x += bw + gap) {
      g.fillStyle = pick(["#a4553a", "#b0603f", "#9a4e36", "#b86a47", "#a95b3d"]);
      g.fillRect(x + off, r * rh + 2, bw, rh - 4);
      g.fillStyle = "rgba(255, 220, 190, .12)"; g.fillRect(x + off, r * rh + 2, bw, 3);
    }
    g.fillStyle = "#c9a88f"; g.fillRect(0, r * rh, w, 2); // mortar bed
  }
}, 1);
// terracotta cladding with vertical flutes (Games hall)
const fluteTexture = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = "#a67b68"; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, "#8d6556"); gr.addColorStop(0.4, "#b68c77"); gr.addColorStop(1, "#9e7361");
    g.fillStyle = gr; g.fillRect(x, 0, 16, h);
  }
}, 1 / 3); // 3 m per tile
// warm interior seen through glazing in daylight
const interiorTexture = () => {
  const t = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#f0cf9e"); gr.addColorStop(0.2, "#9c7552"); gr.addColorStop(0.7, "#4a3526"); gr.addColorStop(1, "#7a5a3e");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let x = 40; x < w; x += 120) {
      const d = g.createRadialGradient(x, 18, 0, x, 18, 150);
      d.addColorStop(0, "rgba(255, 228, 180, .9)"); d.addColorStop(1, "rgba(255, 210, 150, 0)");
      g.fillStyle = d; g.fillRect(x - 150, 0, 300, 260);
    }
    g.fillStyle = "rgba(30, 20, 14, .5)";
    for (let i = 0; i < 5; i++) { const x = rnd() * w, bw = 30 + rnd() * 80, bh = 40 + rnd() * 110; g.fillRect(x, h - 70 - bh, bw, bh); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 6, 1 / 4.5);
  return t;
};
const signTexture = (text, color = "#f4efe6", font = "700 92px Montserrat, Arial, sans-serif") => canvasTex(1024, 160, (g, w, h) => {
  g.fillStyle = color; g.font = font; g.textAlign = "center"; g.textBaseline = "middle";
  if ("letterSpacing" in g) g.letterSpacing = "8px";
  g.fillText(text, w / 2, h / 2 + 4);
});

const plain = (color, roughness = 0.9, extra = {}) => new MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
const foliage = (map, color = "#ffffff") => new MeshStandardMaterial({ color, map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
const sign = (text, color) => new MeshBasicMaterial({ map: signTexture(text, color), transparent: true, depthWrite: false });

const M = {
  stucco: pbr("white_stucco", { size: 3, arm: true, color: "#efe6d8", normal: 0.5 }),
  concrete: pbr("white_stucco", { size: 3, color: "#8d8a86", normal: 0.4 }),
  darkBand: plain("#2c2d30", 0.6),
  roof: pbr("white_stucco", { size: 4, color: "#d4cec6", normal: 0.3 }),
  brick: pbr("red_brick_03", { size: 1.5, color: "#e9b49a" }),
  screen: new MeshStandardMaterial({ map: screenTexture(), side: THREE.DoubleSide, roughness: 0.9 }),
  coping: new MeshStandardMaterial({ color: "#2c2d30", roughness: 0.6, side: THREE.DoubleSide }),
  flutes: new MeshStandardMaterial({ map: fluteTexture(), roughness: 0.75 }),
  terracotta: plain("#a77760", 0.8),
  clay: pbr("floor_klinkers_01", { size: 2.2, arm: true, color: "#e2a58c" }),
  pavers: pbr("concrete_pavers", { size: 1.6, arm: true, color: "#d8d0c4" }),
  deck: pbr("wood_floor_deck", { size: 2.2, arm: true, color: "#c49a72" }),
  timber: pbr("wood_floor_deck", { size: 1.6, color: "#8a603f", roughness: 0.6 }),
  grass: pbr("leafy_grass", { size: 2.5, arm: true, color: "#d2dfae" }),
  asphalt: pbr("asphalt_02", { size: 5, color: "#a59d93", roughness: 0.9 }),
  sand: pbr("sand_01", { size: 9, color: "#dbc7ab", normal: 0.4 }),
  track: plain("#a44c3c", 0.95),
  glass: new MeshStandardMaterial({ color: "#2a2c2f", emissive: "#ffffff", emissiveMap: interiorTexture(), emissiveIntensity: 0.55, roughness: 0.05, metalness: 0.5, envMapIntensity: 1.3 }),
  darkGlass: new MeshStandardMaterial({ color: "#1b2026", roughness: 0.05, metalness: 0.6, envMapIntensity: 1.4 }),
  frame: new MeshStandardMaterial({ color: "#2a2b2d", metalness: 0.7, roughness: 0.35 }),
  line: plain("#f4f1ea", 0.7),
  bark: plain("#6f5a48", 1),
  palmBark: plain("#8a735a", 1),
  leaf: foliage(leafTexture(false)),
  flowers: foliage(leafTexture(true)),
  palmLeaf: foliage(frondTexture(), "#b9c1a2"),
  sail: new MeshStandardMaterial({ color: "#f6f2ea", roughness: 0.85, side: THREE.DoubleSide }),
  pole: new MeshStandardMaterial({ color: "#f1f1ef", metalness: 0.3, roughness: 0.4 }),
  fabric: plain("#ece6db", 1),
  wood: plain("#9a7250", 0.6),
  metal: new MeshStandardMaterial({ color: "#222", metalness: 0.7, roughness: 0.4 }),
  tyre: plain("#141414", 0.8),
  rim: new MeshStandardMaterial({ color: "#bdbdbd", metalness: 1, roughness: 0.25 }),
  chrome: new MeshStandardMaterial({ color: "#d7d7d7", metalness: 1, roughness: 0.12 }),
  carGlass: new MeshPhysicalMaterial({ color: "#0b0f12", metalness: 0.3, roughness: 0.05, clearcoat: 1 }),
  lamp: new MeshBasicMaterial({ color: new THREE.Color("#fff3dc").multiplyScalar(1.5), toneMapped: false }),
  tail: new MeshBasicMaterial({ color: "#b3261e" }),
  podPink: new MeshPhysicalMaterial({ color: "#d99aad", roughness: 0.35, clearcoat: 0.8 }),
  podWhite: new MeshPhysicalMaterial({ color: "#f2f0ec", roughness: 0.35, clearcoat: 0.8 }),
  containers: [plain("#8e908f", 0.8), plain("#b1673f", 0.8), plain("#c9c3b8", 0.8), plain("#6d6f72", 0.8)],
  signGames: sign("GAMES"),
  signSignage: sign("SIGNAGE"),
  signPark: sign("RETAIL PARK"),
};
const PAINTS = ["#1b1c1e", "#b9bcbf", "#eeeeec", "#eeeeec", "#6b6f74", "#2b3a55", "#d9d6cf"].map((c) => new MeshPhysicalMaterial({ color: c, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }));

// ───────── geometry helpers ─────────
const scene = new THREE.Scene();
const model = new Group();
scene.add(model);

function add(geo, material, { cast = true, receive = true, parent = model } = {}) {
  const m = new Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  parent.add(m);
  return m;
}
const pts = (list) => list.map((p) => (p.isVector2 ? p : P(p[0], p[1])));
function slab(points, top, depth, material, opts) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts(points)), { depth, bevelEnabled: false, curveSegments: 12 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, top, 0);
  return add(geo, material, opts);
}
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** Offset an irregular convex footprint, retaining the actual angled edges. */
function offsetPolygon(points, distance) {
  return points.map((point, i) => {
    const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    const incoming = P(point[0] - prev[0], point[1] - prev[1]).normalize();
    const outgoing = P(next[0] - point[0], next[1] - point[1]).normalize();
    const n0 = P(incoming.y, -incoming.x), n1 = P(outgoing.y, -outgoing.x);
    const bisector = n0.clone().add(n1).normalize();
    const shift = bisector.multiplyScalar(distance / bisector.dot(n1));
    return [point[0] + shift.x, point[1] + shift.y];
  });
}
/** Small corner curves on a traced polygon; never substitutes a rectangular footprint. */
function roundedPolygon(points, radius) {
  const outline = [];
  points.forEach((point, i) => {
    const p = P(...point), prev = P(...points[(i + points.length - 1) % points.length]), next = P(...points[(i + 1) % points.length]);
    const cut = Math.min(radius, p.distanceTo(prev) * 0.2, p.distanceTo(next) * 0.2);
    const a = p.clone().add(prev.sub(p).normalize().multiplyScalar(cut));
    const b = p.clone().add(next.sub(p).normalize().multiplyScalar(cut));
    for (let step = 0; step <= 8; step++) {
      const t = step / 8, q = a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(p, 2 * t * (1 - t)).addScaledVector(b, t * t);
      outline.push([q.x, q.y]);
    }
  });
  return outline;
}
/** Rounded rectangle outline (clockwise in plan). */
function roundRect(x0, z0, x1, z1, r, seg = 8) {
  const out = [];
  for (const [cx, cz, a0] of [[x1 - r, z0 + r, -Math.PI / 2], [x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI]]) {
    for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * (Math.PI / 2); out.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]); }
  }
  return out;
}
function metricBox(w, h, d) {
  const g = new BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1]); }
  return g;
}
/** Axis-aligned block from plan corners. */
function block(x0, z0, x1, z1, y0, y1, material, opts) {
  const m = add(metricBox(x1 - x0, y1 - y0, z1 - z0), material, opts);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return m;
}
function along(a, b, { h, t, base, material, extend = t, cast = true }) {
  const len = a.distanceTo(b);
  const m = add(metricBox(len + extend, h, t), material, { cast });
  m.position.set((a.x + b.x) / 2, base + h / 2, (a.y + b.y) / 2);
  m.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return m;
}
function wall(points, { h, t = 0.3, base = 0, material = M.stucco, closed = false, cast = true } = {}) {
  const p = pts(points);
  if (closed) p.push(p[0]);
  for (let i = 0; i < p.length - 1; i++) if (p[i].distanceTo(p[i + 1]) > 0.01) along(p[i], p[i + 1], { h, t, base, material, cast });
}
/** Glazing with slim mullions. */
function glazing(points, y0, y1, material = M.glass, bay = 2) {
  const p = pts(points);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    along(a, b, { h: y1 - y0, t: 0.08, base: y0, material, extend: 0, cast: false });
    const len = a.distanceTo(b), n = Math.max(1, Math.round(len / bay));
    const dir = b.clone().sub(a).normalize().multiplyScalar(0.04);
    for (let k = 0; k <= n; k++) { const c = a.clone().lerp(b, k / n); along(c.clone().sub(dir), c.clone().add(dir), { h: y1 - y0, t: 0.16, base: y0, material: M.frame, extend: 0, cast: false }); }
  }
}
/** Vertical ribbon along a closed plan outline, UVs in metres (for the brick screen). */
function ribbon(list, y0, y1, material, { tileW = 4.8, tileH = 2.4 } = {}) {
  const p = [...pts(list), pts(list)[0]];
  const pos = [], uv = [], idx = [];
  let s = 0;
  p.forEach((v, i) => {
    if (i) s += v.distanceTo(p[i - 1]);
    pos.push(v.x, y0, v.y, v.x, y1, v.y);
    uv.push(s / tileW, 0, s / tileW, (y1 - y0) / tileH);
    if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return add(g, material);
}
function signBoard(material, x, y, z, w, rot = 0) {
  const m = add(new THREE.PlaneGeometry(w, w * 0.156), material, { cast: false, receive: false });
  m.position.set(x, y, z); m.rotation.y = rot; m.renderOrder = 2;
}

// landscape pieces
function bumpy(radius, detail, amount) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (Math.sin(v.x * 3.1) * Math.cos(v.z * 2.7) + Math.sin(v.y * 4.3)) * amount * 0.5 + (rnd() - 0.5) * amount;
    p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
function tree(x, z, s = 1, base = 0.15, material = M.leaf, detail = 2) {
  s *= 1.55;
  const g = new Group();
  const trunk = add(new THREE.CylinderGeometry(0.1 * s, 0.18 * s, 2.4 * s, 6), M.bark, { parent: g });
  trunk.position.y = 1.2 * s;
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, r = (i === 0 ? 0 : 0.9) * s, rr = (0.95 + rnd() * 0.5) * s, y = (2.7 + rnd() * 0.8) * s;
    const c = add(bumpy(rr, detail, 0.3), material, { parent: g });
    c.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    c.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
  g.position.set(x, base, z);
  g.rotation.y = rnd() * 6;
  model.add(g);
}
const frondGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 3, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5, x = p.getX(i) * 1.5;
    p.setXYZ(i, x, Math.abs(x) * 0.45 - t * t * 1.6 + t * 0.4, t * 3.6);
  }
  g.computeVertexNormals();
  return g;
})();
function palm(x, z, h = 7, base = 0.15, s = 1) {
  const g = new Group();
  const lean = (rnd() - 0.5) * 0.15;
  const trunk = add(new THREE.CylinderGeometry(0.2 * s, 0.28 * s, h, 8, 1), M.palmBark, { parent: g });
  trunk.position.y = h / 2; trunk.rotation.z = lean;
  const crown = new Group();
  crown.position.set(-Math.sin(lean) * h * 0.5, h, 0);
  for (let i = 0; i < 14; i++) {
    const f = add(frondGeo, M.palmLeaf, { parent: crown });
    f.rotation.order = "YXZ";
    f.rotation.y = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    f.rotation.x = -0.75 + (i % 3) * 0.3 + rnd() * 0.2;
    f.scale.setScalar((0.8 + rnd() * 0.35) * s);
  }
  g.add(crown);
  g.position.set(x, base, z);
  model.add(g);
}
function shrubs(list, base, material = M.leaf, size = 0.55) {
  for (const [x, z] of list) {
    const r = size * (0.8 + rnd() * 0.5);
    const s = add(bumpy(r, 1, 0.3), material);
    s.position.set(x, base + r * 0.45, z);
    s.rotation.set(rnd() * 3, rnd() * 3, 0);
  }
}
const scatter = (n, x0, x1, z0, z1) => Array.from({ length: n }, () => [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)]);
function car(x, z, rot, y = 0.06) {
  const g = new Group(), paint = pick(PAINTS);
  const suv = rnd() < 0.45;
  const L = suv ? 4.9 : 4.6, W = suv ? 1.95 : 1.85, H = suv ? 1.0 : 0.75;
  const body = add(new RoundedBoxGeometry(L, H, W, 3, 0.26), paint, { parent: g }); body.position.y = 0.38 + H / 2;
  const cab = add(new RoundedBoxGeometry(suv ? 2.9 : 2.1, suv ? 0.68 : 0.52, W - 0.2, 3, 0.2), M.carGlass, { parent: g });
  cab.position.set(suv ? -0.3 : -0.5, 0.38 + H + (suv ? 0.32 : 0.24), 0);
  for (const zz of [-1, 1]) {
    const tl = add(new BoxGeometry(0.05, 0.08, 0.42), M.tail, { parent: g, cast: false }); tl.position.set(-L / 2 - 0.01, suv ? 1.1 : 0.9, zz * (W / 2 - 0.3));
  }
  const wheel = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 14);
  for (const [wx, wz] of [[L / 2 - 0.9, W / 2 - 0.12], [L / 2 - 0.9, -W / 2 + 0.12], [-L / 2 + 0.95, W / 2 - 0.12], [-L / 2 + 0.95, -W / 2 + 0.12]]) {
    const w = add(wheel, M.tyre, { parent: g }); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.38, wz);
  }
  g.position.set(x, y, z);
  g.rotation.y = rot;
  model.add(g);
}
/** Row of parking bays: stall lines across [z0,z1], cars parked in some bays, nose towards `nose` (±1 in z). */
function parkingRow(x0, x1, z0, z1, { y = 0.06, fill = 0.6, nose = -1, skip = () => false } = {}) {
  const bay = 2.7;
  for (let x = x0; x <= x1 + 0.01; x += bay) {
    block(x - 0.06, z0, x + 0.06, z1, y, y + 0.01, M.line, { cast: false });
    const cx = x + bay / 2;
    if (cx < x1 && !skip(cx) && rnd() < fill) car(cx + (rnd() - 0.5) * 0.2, (z0 + z1) / 2 + (rnd() - 0.5) * 0.3, nose < 0 ? Math.PI / 2 : -Math.PI / 2, y);
  }
}
function lampPost(x, z, h = 7, base = 0.15) {
  const p = add(new THREE.CylinderGeometry(0.07, 0.1, h, 8), M.frame); p.position.set(x, base + h / 2, z);
  const hd = add(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), M.frame); hd.position.set(x, base + h, z);
  const l = add(new THREE.CylinderGeometry(0.38, 0.38, 0.02, 16), M.lamp, { cast: false }); l.position.set(x, base + h - 0.06, z);
}

// ───────── sand & dunes ─────────
{
  const S = 3200, N = 180;
  const g = new THREE.PlaneGeometry(S, S, N, N);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.max(Math.abs(x) - 170, (z < 0 ? -z - 115 : z - 120), 0);
    const mask = smoothstep(140, 700, d);
    const ridge = Math.pow(0.5 + 0.5 * Math.sin(x * 0.011 + Math.sin(z * 0.017) * 2.2 + z * 0.004), 2.2);
    const swell = 0.5 + 0.5 * Math.sin(z * 0.006 - x * 0.003);
    pos.setY(i, (ridge * 16 + swell * 10) * mask - 0.02);
    uv.setXY(i, x, z);
  }
  g.computeVertexNormals();
  add(g, M.sand, { cast: false });
}

// ───────── road, jogging track & front verge (south) ─────────
const X0 = -190, X1 = 190;
slab(rect(X0, 58, X1, 72), 0.06, 0.1, M.asphalt, { cast: false });
for (let x = X0; x < X1; x += 9) block(x, 64.9, x + 4.5, 65.1, 0.061, 0.07, M.line, { cast: false });
slab(rect(X0, 72, X1, 73), 0.16, 0.2, M.pavers, { cast: false });
slab(rect(X0, 73, X1, 76.5), 0.1, 0.1, M.track, { cast: false });
slab(rect(X0, 76.5, X1, 92), 0.08, 0.1, M.grass, { cast: false });
for (let x = X0 + 6; x < X1; x += 11 + rnd() * 6) tree(x, 80 + rnd() * 10, 1.6 + rnd() * 0.6, 0.08, M.leaf);
shrubs(scatter(60, X0, X1, 77, 91), 0.08, M.flowers, 0.7);
// planted verge between the parking and the road, with palms and lamp posts
slab(rect(X0, 52, X1, 58), 0.2, 0.2, M.grass, { cast: false });
shrubs(scatter(120, X0, X1, 52.6, 57.4), 0.2, M.flowers, 0.55);
for (let x = -160; x <= 160; x += 32) { palm(x, 55, 7 + rnd() * 2, 0.2); lampPost(x + 16, 55.2, 7, 0.2); }

// ───────── front parking ─────────
slab(rect(-150, 20, 150, 38), 0.06, 0.1, M.asphalt, { cast: false });
slab(rect(72, 38, 150, 52), 0.06, 0.1, M.asphalt, { cast: false });
slab(rect(-150, 38, 28, 52), 0.18, 0.18, M.grass, { cast: false });
shrubs(scatter(70, -148, 26, 39, 51), 0.18, M.flowers, 0.65);
const island = (cx) => ((cx % 40) + 40) % 40 > 34; // a planted island every 40 m
parkingRow(-148, 146, 20.5, 26, { nose: -1, skip: (cx) => island(cx) || (cx > 26 && cx < 72) || (cx > 111 && cx < 125) });
parkingRow(74, 146, 33, 38.5, { nose: 1, skip: island });
slab(rect(74, 38.5, 146, 40.5), 0.18, 0.18, M.grass, { cast: false });
shrubs(scatter(30, 76, 144, 38.8, 40.2), 0.18, M.leaf, 0.45);
parkingRow(74, 146, 40.5, 46, { nose: -1, skip: island });
for (let x = -120; x < 146; x += 40) {
  if (x > 26 && x < 72) continue;
  for (const [z0, z1] of (x < 74 ? [[20.5, 26]] : [[20.5, 26], [33, 38.5], [40.5, 46]])) { slab(rect(x - 5.2, z0, x, z1), 0.2, 0.2, M.grass, { cast: false }); tree(x - 2.6, (z0 + z1) / 2, 1.3, 0.2, M.leaf); }
}

// ───────── front promenade & food pods ─────────
slab(rect(-150, 12, 150, 20), 0.16, 0.16, M.pavers, { cast: false });
block(-150, 19.8, 26, 20.1, 0, 0.3, M.concrete, { cast: false });
block(72, 19.8, 150, 20.1, 0, 0.3, M.concrete, { cast: false });
const pods = [[-100, 16], [-82, 16.4], [-58, 18], [-36, 19], [-14, 18], [4, 16], [22, 23], [23, 31], [84, 16], [106, 16]];
pods.forEach(([x, z], i) => {
  const mat = i % 2 ? M.podWhite : M.podPink;
  const b = add(new RoundedBoxGeometry(5, 2.7, 2.5, 4, 0.7), mat); b.position.set(x, 0.3 + 1.35 + 0.25, z); b.rotation.y = (rnd() - 0.5) * 0.2;
  const w = add(new THREE.PlaneGeometry(2.6, 1.1), M.darkGlass, { cast: false }); w.position.set(x, 2.1, z + 1.27); w.rotation.y = b.rotation.y;
  for (let k = 0; k < 3; k++) { // café tables
    const tx = x - 3 + rnd() * 6, tz = z - 3.2 - rnd() * 1.2;
    const t = add(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), M.fabric); t.position.set(tx, 0.9, tz);
    const l = add(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 6), M.metal); l.position.set(tx, 0.52, tz);
    for (const a of [0, Math.PI]) { const c = add(new RoundedBoxGeometry(0.5, 0.8, 0.5, 2, 0.1), M.fabric); c.position.set(tx + Math.cos(a) * 0.75, 0.56, tz + Math.sin(a) * 0.75); }
  }
});
// small terracotta kiosk pavilion on the promenade
block(112, 21, 120, 27, 0.2, 3.4, M.terracotta);
block(111.3, 20.3, 120.7, 27.7, 3.4, 3.8, M.darkBand);
glazing([[113, 27.05], [119, 27.05]], 0.3, 2.9);

// ───────── continuous raised connector, with a separate rear road ─────────
const SP = { x0: -150, x1: 150, z0: -29, z1: -22 };
block(SP.x0, SP.z0, SP.x1, SP.z1, 0, CONNECTOR_HEIGHT - 0.55, M.concrete);
block(SP.x0, SP.z0, SP.x1, SP.z1, CONNECTOR_HEIGHT - 0.55, CONNECTOR_HEIGHT - 0.35, M.roof);
glazing([[SP.x0 + 2, SP.z1 + 0.05], [SP.x1 - 2, SP.z1 + 0.05]], 0.3, 5.7, M.glass, 3);
block(SP.x0, SP.z1 - 0.4, SP.x1, SP.z1 + 0.9, 5.7, 6.3, M.darkBand);
wall([[SP.x0, SP.z0], [SP.x1, SP.z0], [SP.x1, SP.z1], [SP.x0, SP.z1]], { base: CONNECTOR_HEIGHT - 0.35, h: 0.65, t: 0.3, material: M.concrete, closed: true });
// Short offsets in the parapet follow the repeated bays in the aerial references.
for (const x of [-128, -82, -36, 10, 56, 102]) block(x, -30, x + 8, -28.8, CONNECTOR_HEIGHT - 0.35, CONNECTOR_HEIGHT + 0.3, M.concrete);
slab(rect(-190, -53, 192, -30), 0.06, 0.1, M.asphalt, { cast: false });
parkingRow(-146, 146, -38, -32.5, { y: 0.06, nose: 1, fill: 0.38 });
slab(rect(-190, -31.5, 150, -30), 0.16, 0.2, M.pavers, { cast: false });
for (let x = -186; x < 190; x += 9) block(x, -46.1, x + 4.5, -45.9, 0.061, 0.07, M.line, { cast: false });
slab(rect(-190, -61, 192, -53), 0.18, 0.18, M.grass, { cast: false });
shrubs(scatter(70, -188, 190, -60, -54), 0.18, M.flowers, 0.6);
// additional ground-level parking past the east end of the spine
slab(rect(150, -53, 192, 20), 0.06, 0.1, M.asphalt, { cast: false });
for (const [z0, z1, nose] of [[-49, -43.5, -1], [-37.5, -32, 1], [-30, -24.5, -1], [-18.5, -13, 1], [-11, -5.5, -1], [0.5, 6, 1]]) parkingRow(154, 188, z0, z1, { nose, fill: 0.45 });
for (const [z0, z1] of [[-32, -30], [-13, -11]]) { // planted strips between the double rows
  slab(rect(154, z0, 188, z1), 0.18, 0.18, M.grass, { cast: false });
  for (let x = 158; x < 188; x += 10) tree(x, (z0 + z1) / 2, 1.2, 0.18, M.leaf);
}
// storage containers at the west end
[[-178, -48, 0], [-178, -40, 1], [-178, -32, 2], [-166, -48, 3], [-166, -40, 1]].forEach(([x, z, k]) => block(x, z, x + 10, z + 6, 0, 3.2, M.containers[k]));

// ───────── back landscape: jogging trail through planted dunes ─────────
slab(rect(-190, -110, 190, -61), 0.08, 0.1, M.grass, { cast: false });
{
  const path = new THREE.CatmullRomCurve3([[-190, -70], [-130, -78], [-80, -68], [-30, -84], [20, -72], [70, -88], [120, -74], [190, -82]].map(([x, z]) => new Vector3(x, 0, z)));
  const sp = path.getSpacedPoints(220);
  const off = (d) => sp.map((p, i) => { const t = path.getTangentAt(i / (sp.length - 1)); return [p.x - t.z * d, p.z + t.x * d]; });
  slab([...off(1.8), ...off(-1.8).reverse()], 0.12, 0.05, M.track, { cast: false });
}
for (let i = 0; i < 70; i++) { const [x, z] = scatter(1, -185, 185, -108, -64)[0]; if (Math.abs(z + 78 - 8 * Math.sin(x * 0.03)) > 5) tree(x, z, 1.5 + rnd() * 0.9, 0.08, M.leaf); }
shrubs(scatter(160, -188, 188, -108, -62), 0.08, M.flowers, 0.7);

// ───────── west retail block: two storeys, cream stucco with brick-framed bays ─────────
{
  const x0 = -150, x1 = -106, z0 = -22, z1 = 8, H = 10.5;
  block(x0, z0, x1, z1, 0, H, M.stucco);
  block(x0 - 0.3, z0, x1 + 0.3, z1 + 0.3, H, H + 0.8, M.darkBand);
  for (let x = x0 + 3; x < x1 - 4; x += 8) { // brick frames around full-height glazing
    block(x, z1, x + 0.9, z1 + 0.9, 0, H - 0.6, M.brick);
    block(x + 5.1, z1, x + 6, z1 + 0.9, 0, H - 0.6, M.brick);
    block(x, z1, x + 6, z1 + 0.9, H - 1.5, H - 0.6, M.brick);
    glazing([[x + 0.9, z1 + 0.2], [x + 5.1, z1 + 0.2]], 0.2, H - 1.5, M.glass, 1.4);
  }
  glazing([[x1 + 0.05, z0 + 2], [x1 + 0.05, z1 - 2]], 0.2, 4.4); // ground floor to the court
  glazing([[x1 + 0.05, z0 + 2], [x1 + 0.05, z1 - 2]], 5.4, 9.2);
  signBoard(M.signSignage, (x0 + x1) / 2 + 6, H - 1.05, z1 + 0.95, 9);
  block(x0 + 6, z0 + 6, x0 + 16, z0 + 14, H + 0.8, H + 3, M.concrete); // rooftop plant room
  slab(roundRect(x0 - 8, z1 + 1, x0 + 2, 20, 4, 6), 0.9, 0.9, M.concrete); // raised corner planter
  shrubs(scatter(18, x0 - 7, x0 + 1, z1 + 2, 19), 0.9, M.flowers, 0.6);
}

// ───────── shade-sail market court ─────────
{
  const x0 = -106, x1 = -58, z0 = -22, z1 = 12;
  slab(rect(x0, z0, x1, z1), 0.2, 0.2, M.clay, { cast: false });
  const sailGeo = (h) => {
    const g = new THREE.PlaneGeometry(1, 1, 8, 8);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, v = p.getZ(i) + 0.5;
      p.setY(i, h[0] * (1 - u) * (1 - v) + h[1] * u * (1 - v) + h[2] * (1 - u) * v + h[3] * u * v);
    }
    g.computeVertexNormals();
    return g;
  };
  const S = 8.6;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
    const cx = x0 + 5 + i * (S + 0.6) + S / 2, cz = z0 + 4 + j * (S + 1.4) + S / 2;
    const hi = 6.6, lo = 4.4, flip = (i + j) % 2;
    const s = add(sailGeo(flip ? [hi, lo, lo, hi] : [lo, hi, hi, lo]), M.sail);
    s.position.set(cx, 0.2, cz); s.scale.set(S, 1, S);
    for (const [dx, dz, h] of [[-1, -1, flip ? hi : lo], [1, 1, flip ? hi : lo]]) {
      const pl = add(new THREE.CylinderGeometry(0.12, 0.14, h + 0.4, 10), M.pole); pl.position.set(cx + dx * S / 2, 0.2 + (h + 0.4) / 2, cz + dz * S / 2);
    }
  }
  // market stalls: timber counters under little white canopies
  for (let i = 0; i < 8; i++) {
    const x = x0 + 8 + (i % 4) * 10.5, z = i < 4 ? -8 : 2;
    block(x, z, x + 3.4, z + 1.6, 0.2, 1.3, M.timber);
    block(x - 0.2, z - 0.2, x + 3.6, z + 1.8, 2.6, 2.75, M.fabric);
    for (const [dx, dz] of [[0, 0], [3.4, 0], [0, 1.6], [3.4, 1.6]]) block(x + dx - 0.04, z + dz - 0.04, x + dx + 0.04, z + dz + 0.04, 1.3, 2.6, M.wood, { cast: false });
  }
  for (const x of [-100, -64]) for (const z of [-17, 7]) { slab(roundRect(x - 2.2, z - 2.2, x + 2.2, z + 2.2, 1.2, 4), 0.7, 0.5, M.concrete); shrubs(scatter(4, x - 1.5, x + 1.5, z - 1.5, z + 1.5), 0.7, M.leaf, 0.6); }
}

// ───────── Games hall: skewed four-sided footprint and shallow recessed roof ─────────
{
  const H = 10.8;
  const outline = [[-58, -22], [-14, -22], [-10, 14], [-52, 18]];
  const inset = outline.map(([x, z]) => [-33 + (x + 33) * 0.977, -2 + (z + 2) * 0.977]);
  slab(outline, H - 0.85, H - 0.85, M.flutes);
  slab(inset, H - 0.72, 0.22, M.roof);
  wall(outline, { base: H - 0.85, h: 0.85, t: 0.32, material: M.darkBand, closed: true });
  glazing([[-58.12, -21], [-52.12, 18.12], [-39, 16.86]], 0.2, H - 1, M.glass, 2.1);
  glazing([[-21, 15.15], [-9.88, 14.1], [-13.88, -21]], 0.2, H - 1, M.glass, 2.1);
  signBoard(M.signGames, -30, H - 0.4, 16.3, 8, Math.atan2(4,42));
}
// ───────── tree plaza: stepped timber terraces under a grove ─────────
{
  const x0 = -14, x1 = 26, z0 = -22, z1 = 12;
  slab(rect(x0, z0, x1, z1), 0.2, 0.2, M.clay, { cast: false });
  slab(rect(x0 + 4, z0 + 12, x1 - 6, z1 - 2), 0.8, 0.6, M.deck);
  slab(rect(x0 + 7, z0 + 14, x1 - 9, z1 - 5), 1.4, 0.6, M.deck);
  for (let k = 0; k < 4; k++) wall([[x0 + 4, z1 - 2 + k * 0.05], [x0 + 10 + k * 4, z1 - 2 + k * 0.05]], { base: 0.8, h: 1.0, t: 0.05, material: M.frame, cast: false }); // ramp rails
  for (let i = 0; i < 9; i++) { // café tables on the terrace
    const tx = x0 + 9 + (i % 3) * 6, tz = z0 + 16 + Math.floor(i / 3) * 4.5, y = 1.4;
    const t = add(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), M.fabric); t.position.set(tx, y + 0.75, tz);
    for (const a of [0, 2.1, 4.2]) { const c = add(new RoundedBoxGeometry(0.5, 0.8, 0.5, 2, 0.1), M.fabric); c.position.set(tx + Math.cos(a) * 0.8, y + 0.4, tz + Math.sin(a) * 0.8); }
  }
  for (let i = 0; i < 16; i++) tree(x0 + 22 + rnd() * 18, z0 + 2 + rnd() * 26, 2.1 + rnd() * 0.6, 0.2);
  shrubs(scatter(26, x0 + 1, x1 - 1, z0 + 1, z0 + 10), 0.2, M.flowers, 0.7);
}

// ───────── the brick-screen pavilion: rounded box, glass ground floor, perforated brick band ─────────
{
  const x0 = 30, x1 = 73, z0 = -22, z1 = 36, r = 1.6;
  const footprint = [[30, -22], [64, -22], [73, 32], [34, 36]];
  const ring = (d) => roundedPolygon(offsetPolygon(footprint, d), Math.max(0.2, r + d));
  const outline = ring(0);
  const inset = ring(-1.2);
  slab(rect(26, -22, 78, 44), 0.17, 0.17, M.pavers, { cast: false });
  slab(outline, 0.3, 0.3, M.concrete, { cast: false });
  // recessed glass ground floor with mullions
  const loop = [...inset, inset[0]];
  glazing(loop, 0.3, 4.2, M.glass, 2.6);
  // Open staggered masonry follows the rounded perimeter; openings cast real shadows.
  const edgeLengths = outline.map((p, i) => Math.hypot(outline[(i + 1) % outline.length][0] - p[0], outline[(i + 1) % outline.length][1] - p[1]));
  const perimeter = edgeLengths.reduce((a, b) => a + b, 0);
  const pitch = perimeter / Math.round(perimeter / 0.72);
  for (let row = 0; row < 17; row++) for (let distance = (row % 2) * pitch / 2; distance < perimeter; distance += pitch) {
    let segment = 0, d = distance;
    while (d > edgeLengths[segment] && segment < edgeLengths.length - 1) d -= edgeLengths[segment++];
    const a = outline[segment], b = outline[(segment + 1) % outline.length], t = d / edgeLengths[segment];
    const brick = add(metricBox(pitch * 0.64, 0.23, 0.24), M.terracotta);
    brick.position.set(THREE.MathUtils.lerp(a[0], b[0], t), 4.35 + row * 0.285, THREE.MathUtils.lerp(a[1], b[1], t));
    brick.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  slab(outline, 4.3, 0.3, M.darkBand); // soffit / first-floor edge
  slab(ring(-0.4), 9.15, 0.25, M.roof);
  ribbon(ring(0.15), 9.2, 9.5, M.coping);
  ribbon(ring(-0.2), 9.2, 9.5, M.coping);
  for (let x = x0 + 4; x < x1; x += 11) { slab(roundRect(x - 2, z1 + 2, x + 2, z1 + 5, 1, 4), 0.7, 0.5, M.concrete); tree(x, z1 + 3.5, 1.2, 0.7); }
}
// east court between pavilion and the spine end
slab(rect(68, -22, 150, 12), 0.18, 0.18, M.pavers, { cast: false });
slab(roundRect(110, -12, 138, 4, 6, 6), 0.7, 0.6, M.grass);
shrubs(scatter(40, 112, 136, -10, 2), 0.7, M.flowers, 0.7);
for (const [x, z] of [[108, -16], [140, -14], [104, 6], [142, 6]]) palm(x, z, 7.5, 0.2);

// ───────── merge static geometry by material ─────────
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.renderOrder}`;
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, order: o.renderOrder, geos: [] });
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(o.matrixWorld);
    buckets.get(key).geos.push(g);
  });
  const out = new Group();
  for (const { material, cast, order, geos } of buckets.values()) {
    const m = new Mesh(mergeGeometries(geos), material);
    m.castShadow = cast; m.receiveShadow = true; m.renderOrder = order;
    m.matrixAutoUpdate = false;
    out.add(m);
  }
  return out;
}
const merged = mergeStatic(model);
scene.remove(model);
scene.add(merged);

// ───────── viewer ─────────
// [text, x, z, y, visible from, to] — the story range is the scroll progress (0 street level → 1 aerial)
const LABELS = [
  ["Brick-screen pavilion", 49, 34, 11.5, 0, 1],
  ["Games hall", -33, 16, 12.8, 0, 1],
  ["Food pods", -20, 16, 4.6, 0, 0.55],
  ["Shade-sail market", -82, -5, 8.5, 0.3, 1],
  ["Tree plaza", 14, -8, 10.5, 0.3, 1],
  ["Connecting roof", -80, -25, CONNECTOR_HEIGHT + 2, 0.45, 1],
  ["Jogging trail", -30, -84, 2.5, 0.6, 1],
  ["Additional parking", 171, -22, 3, 0.45, 1],
  ["Rear road", 110, -45, 2.5, 0.6, 1],
];
const ease = (t) => t * t * (3 - 2 * t);
const lerp = THREE.MathUtils.lerp;

function mount() {
  const stage = root.querySelector("[data-model-stage]");
  const status = root.querySelector("[data-model-status]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: "high-performance" });
  } catch (e) {
    root.classList.add("is-unsupported");
    return;
  }
  let dpr = Math.min(window.devicePixelRatio, small ? 1 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // the scene is static: shadows are drawn once
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.prepend(renderer.domElement);

  // golden hour: low warm sun from the south-west, clear sky for fill and reflections
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader(manager).load(`${BASE}sky.hdr`, (hdr) => {
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = hdr;
  });
  scene.environmentIntensity = 0.7;
  scene.backgroundIntensity = 0.9;
  scene.backgroundRotation.y = 1.2;
  scene.environmentRotation.y = 1.2;
  scene.fog = new THREE.Fog("#efd6b4", 320, 1900);
  scene.add(new THREE.HemisphereLight("#d6dfeb", "#ac967e", 0.85));
  const sun = new THREE.DirectionalLight("#ffe0bc", 3.3);
  sun.position.set(-170, 62, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 2048 : 4096, small ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 130, bottom: -130, near: 10, far: 520 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06; sun.shadow.radius = 3;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [new BloomEffect({ intensity: 0.12, luminanceThreshold: 1.1, luminanceSmoothing: 0.15, mipmapBlur: true, radius: 0.6 }),
    new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new VignetteEffect({ offset: 0.4, darkness: 0.18 })];
  composer.addPass(new EffectPass(camera, ...effects));
  if (!small) composer.addPass(new EffectPass(camera, new SMAAEffect()));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 480;
  controls.minPolarAngle = 0.1;
  controls.maxPolarAngle = 1.5;
  controls.enableZoom = false;
  renderer.domElement.style.touchAction = "pan-y";
  controls.addEventListener("change", () => { controls.target.clamp(new Vector3(-150, 0, -90), new Vector3(150, 20, 70)); dirty = true; });

  // scroll story: across the road at street level (like the front renders) → craning up into the aerial view
  const shot = (e) => {
    const t = new Vector3(lerp(10, -18, e), lerp(7, 0, e), lerp(2, -6, e));
    const narrow = Math.min(1.9, Math.max(1, 1.5 / (camera.aspect || 1)));
    const sph = new THREE.Spherical(lerp(120, 230, e) * narrow, lerp(1.44, 0.86, ease(e)), lerp(0.18, 0.62, e));
    return { target: t, pos: t.clone().add(new Vector3().setFromSpherical(sph)) };
  };
  let userMoved = false, dirty = true;
  const goTo = (e, instant) => {
    const s = shot(e);
    if (instant) { camera.position.copy(s.pos); controls.target.copy(s.target); }
    return s;
  };

  // The page always scrolls: the wheel only zooms with Ctrl/⌘ held (trackpad pinch sends Ctrl too).
  // Runs in the capture phase, before OrbitControls' own wheel handler on the canvas; touch pinch keeps zooming.
  const hint = root.querySelector("[data-model-hint]");
  let hintShown = 0;
  stage.addEventListener("wheel", (e) => {
    controls.enableZoom = e.ctrlKey || e.metaKey;
    if (controls.enableZoom) userMoved = true;
    else if (hint && performance.now() - hintShown > 8000) {
      hintShown = performance.now();
      hint.classList.add("is-nudge");
      clearTimeout(hint._t); hint._t = setTimeout(() => hint.classList.remove("is-nudge"), 1600);
    }
  }, { capture: true, passive: true });
  stage.addEventListener("pointerdown", () => { controls.enableZoom = true; });
  controls.addEventListener("start", () => { userMoved = true; });
  const zoomBy = (k) => {
    userMoved = true;
    const d = camera.position.clone().sub(controls.target).multiplyScalar(k);
    const len = THREE.MathUtils.clamp(d.length(), controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(d.setLength(len));
    dirty = true;
  };
  root.querySelector("[data-model-zoom-in]")?.addEventListener("click", () => zoomBy(0.8));
  root.querySelector("[data-model-zoom-out]")?.addEventListener("click", () => zoomBy(1.25));

  const labelWrap = root.querySelector("[data-model-labels]");
  const labels = LABELS.map(([text, x, z, y, from, to]) => {
    const el = document.createElement("span");
    el.className = "model__label"; el.textContent = text;
    labelWrap?.appendChild(el);
    return { el, pos: new Vector3(x, y, z), from, to };
  });
  let storyE = 0;
  const v = new Vector3();
  const placeLabels = () => {
    if (!labelWrap || labelWrap.hidden) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const l of labels) {
      v.copy(l.pos).project(camera);
      const inStory = userMoved || (storyE >= l.from && storyE <= l.to);
      const on = inStory && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      l.el.style.visibility = on ? "" : "hidden";
      l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    }
  };
  const labelBtn = root.querySelector("[data-model-labels-toggle]");
  labelBtn?.addEventListener("click", () => {
    labelWrap.hidden = !labelWrap.hidden;
    labelBtn.setAttribute("aria-pressed", String(!labelWrap.hidden));
    dirty = true;
  });
  root.querySelector("[data-model-reset]")?.addEventListener("click", () => { userMoved = false; dirty = true; });

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    dirty = true;
  };
  new ResizeObserver(resize).observe(stage);
  resize();
  goTo(root._scroll ?? 0, true);
  controls.update();

  // adaptive resolution: step down while frames are slow
  let slowFrames = 0;
  const clock = new THREE.Clock();
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!userMoved) {
      storyE = reduceMotion ? 0 : root._scroll ?? 0;
      const s = goTo(storyE);
      const k = Math.min(1, dt * 4);
      if (camera.position.distanceToSquared(s.pos) > 1e-3 || controls.target.distanceToSquared(s.target) > 1e-3) {
        camera.position.lerp(s.pos, k); controls.target.lerp(s.target, k); dirty = true;
      }
    }
    controls.update();
    if (!dirty) return;
    dirty = false;
    composer.render(dt);
    placeLabels();
    if (dt > 0.034) { if (++slowFrames > 20 && dpr > 0.7) { dpr = Math.max(0.7, dpr * 0.8); renderer.setPixelRatio(dpr); resize(); slowFrames = 0; } } else slowFrames = Math.max(0, slowFrames - 1);
  };

  let visible = false, ready = false;
  const run = () => { renderer.setAnimationLoop(visible && ready ? frame : null); if (visible) { clock.getDelta(); dirty = true; } };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; run(); }).observe(stage);
  manager.onProgress = (_, done, total) => { if (status) status.textContent = `Loading model ${Math.round((done / total) * 100)}%`; };
  manager.onLoad = () => {
    ready = true;
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
    run();
    root.classList.add("is-ready");
  };
  root._view = { camera, controls };
}

if (root) mount();
