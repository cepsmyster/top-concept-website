"""Retail Park, Sharjah: photoreal scene for the 3D page (retail-park-3d.html).

Built entirely from code: no downloaded models, textures or HDRIs. Geometry follows the plan in
src/model3d.mjs (metres; x runs west → east, z from the back of the site (−z) to the road (+z)).
Blender's axes are x east, y north (= −z), z up.

Run with Blender 4.5 (or the `bpy` 4.5 Python module):
    python src/blender/retail_park.py --light day   --orbit 72 --out renders/day
    python src/blender/retail_park.py --light night --orbit 72 --out renders/night
Options: --res 1600x900 --samples 48 --frames 0-71 (subset) --loop 48 (traffic loop at one view) --preview
"""
import argparse
import math
import os
import random
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Euler

# ───────── arguments ─────────
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument("--light", default="day", choices=["day", "night"])
ap.add_argument("--out", default="renders/day")
ap.add_argument("--res", default="1600x900")
ap.add_argument("--samples", type=int, default=48)
ap.add_argument("--orbit", type=int, default=72, help="frames in a full turn")
ap.add_argument("--frames", default="", help="subset of orbit frames, e.g. 0-71 or 0,18,36")
ap.add_argument("--loop", type=int, default=0, help="render a traffic loop of N frames at --at instead of the orbit")
ap.add_argument("--at", type=int, default=0, help="orbit frame for --loop")
ap.add_argument("--blend", default="", help="also save the scene as a .blend file")
ap.add_argument("--threads", type=int, default=0)
args = ap.parse_args(argv)
NIGHT = args.light == "night"
RES = tuple(int(v) for v in args.res.split("x"))

rng = random.Random(20261014)
rnd = rng.random
TAU = math.pi * 2


def B(x, z, y=0.0):
    """Plan (x, z) + height y → Blender coordinates."""
    return (x, -z, y)


# ───────── scene reset ─────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COLL = scene.collection
PROTO = bpy.data.collections.new("prototypes")  # source objects for instancing, never rendered directly
COLL.children.link(PROTO)
bpy.context.view_layer.layer_collection.children["prototypes"].exclude = True


# ───────── materials (procedural Cycles node trees) ─────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def node(nt, kind, **inputs):
    n = nt.nodes.new(kind)
    for k, v in inputs.items():
        if k.startswith("_"):
            setattr(n, k[1:], v)
        elif k.replace("_", " ") in n.inputs:
            n.inputs[k.replace("_", " ")].default_value = v
        else:
            setattr(n, k.lower(), v)  # node properties such as the brick offset
    return n


def link(nt, a, b):
    nt.links.new(a, b)


def hexc(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]  # sRGB → linear
    return (*c, a)


def world_coords(nt):
    tc = node(nt, "ShaderNodeTexCoord")
    return tc.outputs["Object"]  # every static object sits at the origin, so object space = world space


def ramp(nt, fac, stops):
    r = node(nt, "ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], hexc(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], hexc(stops[-1][1])
    for p, c in stops[1:-1]:
        e = els.new(p)
        e.color = hexc(c)
    link(nt, fac, r.inputs["Fac"])
    return r.outputs["Color"]


def noise(nt, vec, scale, detail=4.0, rough=0.55, dist=0.0):
    n = node(nt, "ShaderNodeTexNoise", Scale=scale, Detail=detail, Roughness=rough, Distortion=dist)
    link(nt, vec, n.inputs["Vector"])
    return n


def bump(nt, height, strength=0.2, dist=0.1, normal=None):
    b = node(nt, "ShaderNodeBump", Strength=strength, Distance=dist)
    link(nt, height, b.inputs["Height"])
    if normal is not None:
        link(nt, normal, b.inputs["Normal"])
    return b.outputs["Normal"]


def principled(nt, out, color=None, rough=0.5, metal=0.0, **kw):
    p = node(nt, "ShaderNodeBsdfPrincipled", Roughness=rough, Metallic=metal)
    if isinstance(color, tuple):
        p.inputs["Base Color"].default_value = color
    elif color is not None:
        link(nt, color, p.inputs["Base Color"])
    for k, v in kw.items():
        key = k.replace("_", " ")
        if hasattr(v, "is_linked") or (hasattr(v, "node")):
            link(nt, v, p.inputs[key])
        else:
            p.inputs[key].default_value = v
    link(nt, p.outputs[0], out.inputs["Surface"])
    return p


MATS = {}


def mat_surface(name, base, var=None, rough=0.8, bump_scale=0.0, bump_strength=0.15, noise_scale=0.6, metal=0.0, coat=0.0):
    """Plain surface with large-scale colour variation and fine bump."""
    m, nt, out = new_mat(name)
    v = world_coords(nt)
    col = base
    if var:
        n = noise(nt, v, noise_scale, 6, 0.6)
        col = ramp(nt, n.outputs["Fac"], [(0.3, var[0]), (0.5, base_hex(base)), (0.72, var[1])])
    kw = {}
    if bump_scale:
        nb = noise(nt, v, bump_scale, 8, 0.7)
        kw["Normal"] = bump(nt, nb.outputs["Fac"], bump_strength, 0.05)
    if coat:
        kw["Coat_Weight"] = coat
    p = principled(nt, out, col if not isinstance(col, str) else hexc(col), rough, metal, **kw)
    MATS[name] = m
    return m


def base_hex(c):
    return c if isinstance(c, str) else "#808080"


def build_materials():
    # asphalt: dark aggregate with oil stains and tyre wear
    m, nt, out = new_mat("asphalt")
    v = world_coords(nt)
    n1 = noise(nt, v, 0.08, 4, 0.5)
    n2 = noise(nt, v, 40.0, 2, 0.5)
    vor = node(nt, "ShaderNodeTexVoronoi", Scale=180.0)
    link(nt, v, vor.inputs["Vector"])
    mix = node(nt, "ShaderNodeMix", _data_type="RGBA", _blend_type="OVERLAY", Factor=0.35)
    link(nt, ramp(nt, n1.outputs["Fac"], [(0.35, "#3a3937"), (0.5, "#4a4845"), (0.7, "#575450")]), mix.inputs[6])
    link(nt, n2.outputs["Color"], mix.inputs[7])
    rough = ramp(nt, vor.outputs["Distance"], [(0.0, "#bbbbbb"), (1.0, "#ececec")])
    principled(nt, out, mix.outputs[2], 0.9, Roughness=rough, Normal=bump(nt, vor.outputs["Distance"], 0.25, 0.02))
    MATS["asphalt"] = m

    mat_surface("line", "#ecebe6", rough=0.6)
    mat_surface("stucco", "#ece4d6", ("#e2d8c8", "#f2ece1"), rough=0.85, bump_scale=30, bump_strength=0.08)
    mat_surface("concrete", "#9c978f", ("#8c867e", "#aaa59c"), rough=0.85, bump_scale=25, bump_strength=0.1, noise_scale=0.3)
    mat_surface("curb", "#cfc9bf", ("#c2bbaf", "#ddd8cf"), rough=0.8, bump_scale=20)
    mat_surface("spine", "#4c4d50", ("#434447", "#58595c"), rough=0.7, bump_scale=20, bump_strength=0.06)
    mat_surface("roof", "#b9b4ac", ("#aaa59d", "#c6c1b9"), rough=0.9, bump_scale=15, noise_scale=0.15)
    mat_surface("darkBand", "#2d2e31", rough=0.45, metal=0.3)
    mat_surface("frame", "#26272a", rough=0.35, metal=0.7)
    mat_surface("track", "#a14a3a", ("#934335", "#ad5545"), rough=0.95, bump_scale=60, bump_strength=0.2)
    mat_surface("soil", "#6f5e45", ("#5f4f3a", "#7d6b50"), rough=1.0, bump_scale=10, bump_strength=0.3)
    mat_surface("sail", "#f5f2ec", rough=0.7)
    mat_surface("pole", "#ededeb", rough=0.35, metal=0.4)
    mat_surface("wood", "#8e6748", ("#7b5739", "#a07858"), rough=0.6, bump_scale=4)
    mat_surface("fabric", "#e9e3d8", rough=0.95)
    mat_surface("metal", "#2a2a2a", rough=0.4, metal=0.8)
    mat_surface("tyre", "#151515", rough=0.85)
    mat_surface("rim", "#c3c4c6", rough=0.25, metal=1.0)
    mat_surface("podPink", "#d99aad", rough=0.3, coat=0.8)
    mat_surface("podWhite", "#f1efea", rough=0.3, coat=0.8)
    for i, c in enumerate(["#8f9190", "#b06a44", "#c8c1b6", "#6c6e71"]):
        mat_surface(f"container{i}", c, rough=0.6, metal=0.2, bump_scale=0)

    # pavers: square concrete pavers with joints
    for name, col, a, b, size in (("pavers", "#d8cfc2", "#cfc5b7", "#e2dacf", 0.6), ("clay", "#c9876c", "#b9765c", "#d8977b", 0.4)):
        m, nt, out = new_mat(name)
        v = world_coords(nt)
        br = node(nt, "ShaderNodeTexBrick", Scale=1.0 / size, Mortar_Size=0.015, Bias=0.0, Brick_Width=1.0, Row_Height=0.5 if name == "clay" else 1.0, Offset=0.5)
        br.inputs["Color1"].default_value = hexc(a)
        br.inputs["Color2"].default_value = hexc(b)
        br.inputs["Mortar"].default_value = hexc("#8f877c")
        link(nt, v, br.inputs["Vector"])
        n = noise(nt, v, 0.4, 5)
        mix = node(nt, "ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=0.25)
        link(nt, br.outputs["Color"], mix.inputs[6])
        link(nt, n.outputs["Color"], mix.inputs[7])
        principled(nt, out, mix.outputs[2], 0.85, Normal=bump(nt, br.outputs["Fac"], 0.3, 0.02))
        MATS[name] = m

    # timber deck boards
    m, nt, out = new_mat("deck")
    v = world_coords(nt)
    wv = node(nt, "ShaderNodeTexWave", Scale=6.0, Distortion=1.5, Detail=4, _wave_type="BANDS", _bands_direction="Y")
    link(nt, v, wv.inputs["Vector"])
    principled(nt, out, ramp(nt, wv.outputs["Fac"], [(0.0, "#8a6040"), (0.6, "#b88b62"), (1.0, "#a37a55")]), 0.6, Normal=bump(nt, wv.outputs["Fac"], 0.2, 0.01))
    MATS["deck"] = m

    # sand: warm with wind ripples and dune-scale tone changes
    m, nt, out = new_mat("sand")
    v = world_coords(nt)
    big = noise(nt, v, 0.004, 4, 0.5)
    mid = noise(nt, v, 0.05, 6, 0.6)
    rip = node(nt, "ShaderNodeTexWave", Scale=1.6, Distortion=6.0, Detail=3, Detail_Scale=1.5, _wave_type="BANDS", _bands_direction="X")
    link(nt, v, rip.inputs["Vector"])
    mx = node(nt, "ShaderNodeMix", _data_type="FLOAT", Factor=0.5)
    link(nt, big.outputs["Fac"], mx.inputs[2])
    link(nt, mid.outputs["Fac"], mx.inputs[3])
    col = ramp(nt, mx.outputs[0], [(0.3, "#b8854f"), (0.5, "#cf9f68"), (0.7, "#ddb47f")])
    principled(nt, out, col, 0.95, Normal=bump(nt, rip.outputs["Fac"], 0.35, 0.04))
    MATS["sand"] = m

    # irrigated lawn and ground cover: green with patchy dry areas
    m, nt, out = new_mat("grass")
    v = world_coords(nt)
    n = noise(nt, v, 0.15, 6, 0.65)
    fine = noise(nt, v, 25.0, 3, 0.6)
    col = ramp(nt, n.outputs["Fac"], [(0.3, "#46512c"), (0.5, "#5b6637"), (0.62, "#6f7441"), (0.75, "#8c8656")])
    mix = node(nt, "ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=0.35)
    link(nt, col, mix.inputs[6])
    link(nt, fine.outputs["Color"], mix.inputs[7])
    principled(nt, out, mix.outputs[2], 0.95, Normal=bump(nt, fine.outputs["Fac"], 0.5, 0.02))
    MATS["grass"] = m

    # terracotta brick (the pavilion screen): per-brick tone from a coarse Voronoi cell colour
    m, nt, out = new_mat("brick")
    v = world_coords(nt)
    vor = node(nt, "ShaderNodeTexVoronoi", Scale=2.2)
    link(nt, v, vor.inputs["Vector"])
    sep = node(nt, "ShaderNodeSeparateColor")
    link(nt, vor.outputs["Color"], sep.inputs[0])
    col = ramp(nt, sep.outputs[0], [(0.0, "#8f4a31"), (0.5, "#a85a3b"), (1.0, "#bd7150")])
    fine = noise(nt, v, 30, 6, 0.7)
    principled(nt, out, col, 0.85, Normal=bump(nt, fine.outputs["Fac"], 0.25, 0.01))
    MATS["brick"] = m

    # warm brick for the west block frames
    mat_surface("brickFrame", "#c98d6e", ("#b97c5e", "#d79c7c"), rough=0.85, bump_scale=30, noise_scale=1.5)
    # terracotta cladding with vertical flutes (Games hall)
    m, nt, out = new_mat("flutes")
    v = world_coords(nt)
    sep = node(nt, "ShaderNodeSeparateXYZ")
    link(nt, v, sep.inputs[0])
    add = node(nt, "ShaderNodeMath", _operation="ADD")
    link(nt, sep.outputs[0], add.inputs[0])
    link(nt, sep.outputs[1], add.inputs[1])
    sn = node(nt, "ShaderNodeMath", _operation="SINE")
    mul = node(nt, "ShaderNodeMath", _operation="MULTIPLY", )
    mul.inputs[1].default_value = TAU / 0.3
    link(nt, add.outputs[0], mul.inputs[0])
    link(nt, mul.outputs[0], sn.inputs[0])
    n = noise(nt, v, 0.5, 4)
    col = ramp(nt, n.outputs["Fac"], [(0.35, "#94644f"), (0.5, "#a67660"), (0.7, "#b4846c")])
    principled(nt, out, col, 0.7, Normal=bump(nt, sn.outputs[0], 0.35, 0.03))
    MATS["flutes"] = m

    # facade glass: mirror-like exterior over a warm, softly lit interior
    for name, interior in (("glass", 1.0), ("darkGlass", 0.0)):
        m, nt, out = new_mat(name)
        v = world_coords(nt)
        n = noise(nt, v, 0.35, 3, 0.5)
        sep = node(nt, "ShaderNodeSeparateXYZ")
        link(nt, v, sep.inputs[0])
        lit = ramp(nt, n.outputs["Fac"], [(0.3, "#2a1d14"), (0.55, "#7a5636"), (0.75, "#d9a970")])
        glass = node(nt, "ShaderNodeBsdfPrincipled", Roughness=0.02, Metallic=0.0, IOR=1.52)
        glass.inputs["Base Color"].default_value = hexc("#0d1012")
        glass.inputs["Coat Weight"].default_value = 1.0
        glass.inputs["Specular IOR Level"].default_value = 1.0
        glass.inputs["Emission Strength"].default_value = (3.2 if NIGHT else 0.5) * interior
        link(nt, lit, glass.inputs["Emission Color"])
        link(nt, glass.outputs[0], out.inputs["Surface"])
        MATS[name] = m

    # car paint uses the object colour, so every parked or moving car can differ
    m, nt, out = new_mat("carPaint")
    oi = node(nt, "ShaderNodeObjectInfo")
    principled(nt, out, oi.outputs["Color"], 0.32, 0.4, Coat_Weight=1.0, Coat_Roughness=0.03)
    MATS["carPaint"] = m
    m, nt, out = new_mat("carGlass")
    principled(nt, out, hexc("#07090b"), 0.04, 0.0, Coat_Weight=1.0)
    MATS["carGlass"] = m

    def emitter(name, color, day, night):
        m, nt, out = new_mat(name)
        e = node(nt, "ShaderNodeEmission", Strength=night if NIGHT else day)
        e.inputs["Color"].default_value = hexc(color)
        link(nt, e.outputs[0], out.inputs["Surface"])
        MATS[name] = m

    emitter("headlight", "#fff4e0", 1.5, 60.0)
    emitter("taillight", "#d0201a", 0.6, 25.0)
    mat_surface("lampOff", "#d9dde0", rough=0.1, metal=0.3)
    mat_surface("tailOff", "#5a1512", rough=0.15)
    emitter("lampGlow", "#ffd9a0", 0.3, 80.0)
    emitter("signGlow", "#fff1dc", 0.8, 18.0)
    # a warm-lit wall behind the brick screen: dark by day, glowing through the gaps at night
    m, nt, out = new_mat("screenBack")
    p = principled(nt, out, hexc("#2b1f19"), 0.9)
    p.inputs["Emission Color"].default_value = hexc("#ffb36b")
    p.inputs["Emission Strength"].default_value = 9.0 if NIGHT else 0.0
    MATS["screenBack"] = m

    # foliage: leaf cards with an alpha mask; translucent so the sun glows through
    leaf_img = make_leaf_image()
    for name, tint in (("leaf", ["#3d4d22", "#56652d", "#6e7837", "#4a5a2a"]), ("leafDark", ["#2c3a1c", "#3c4b24", "#4c5a2c", "#334220"]),
                       ("leafFlower", ["#4f5f2b", "#c76f8c", "#e0b85a", "#62722f"]), ("leafOlive", ["#5f6a48", "#7c8662", "#8f9672", "#6a7452"])):
        m, nt, out = new_mat(name)
        tex = node(nt, "ShaderNodeTexImage")
        tex.image = leaf_img
        tex.interpolation = "Linear"
        oi = node(nt, "ShaderNodeObjectInfo")
        v = world_coords(nt)
        n = noise(nt, v, 0.9, 2, 0.5)
        mx = node(nt, "ShaderNodeMath", _operation="ADD")
        link(nt, oi.outputs["Random"], mx.inputs[0])
        link(nt, n.outputs["Fac"], mx.inputs[1])
        fr = node(nt, "ShaderNodeMath", _operation="FRACT")
        link(nt, mx.outputs[0], fr.inputs[0])
        col = ramp(nt, fr.outputs[0], [(0.0, tint[0]), (0.35, tint[1]), (0.7, tint[2]), (1.0, tint[3])])
        mul = node(nt, "ShaderNodeMix", _data_type="RGBA", _blend_type="MULTIPLY", Factor=0.6)
        link(nt, col, mul.inputs[6])
        link(nt, tex.outputs["Color"], mul.inputs[7])
        diff = node(nt, "ShaderNodeBsdfPrincipled", Roughness=0.6)
        diff.inputs["Specular IOR Level"].default_value = 0.35
        link(nt, mul.outputs[2], diff.inputs["Base Color"])
        tr = node(nt, "ShaderNodeBsdfTranslucent")
        link(nt, mul.outputs[2], tr.inputs["Color"])
        mixs = node(nt, "ShaderNodeMixShader", Fac=0.25)
        link(nt, diff.outputs[0], mixs.inputs[1])
        link(nt, tr.outputs[0], mixs.inputs[2])
        transp = node(nt, "ShaderNodeBsdfTransparent")
        alpha = node(nt, "ShaderNodeMixShader")
        link(nt, tex.outputs["Alpha"], alpha.inputs["Fac"])
        link(nt, transp.outputs[0], alpha.inputs[1])
        link(nt, mixs.outputs[0], alpha.inputs[2])
        link(nt, alpha.outputs[0], out.inputs["Surface"])
        MATS[name] = m
    mat_surface("bark", "#5e4b3c", ("#4f3e31", "#6e5a49"), rough=0.95, bump_scale=8, bump_strength=0.4, noise_scale=3)
    mat_surface("dryGrass", "#a8915f", ("#968050", "#b9a170"), rough=0.95)


def make_leaf_image(size=512):
    """Leaf atlas drawn with numpy: ~40 overlapping elliptic leaves with a midrib, on transparent."""
    img = np.zeros((size, size, 4), np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    r = random.Random(7)
    for _ in range(46):
        cx, cy = r.uniform(60, size - 60), r.uniform(60, size - 60)
        ang = r.uniform(0, TAU)
        L, W = r.uniform(38, 70), r.uniform(15, 26)
        ca, sa = math.cos(ang), math.sin(ang)
        u = (xx - cx) * ca + (yy - cy) * sa
        w = -(xx - cx) * sa + (yy - cy) * ca
        t = np.clip((u + L) / (2 * L), 0, 1)
        half = W * np.maximum(np.sin(np.pi * t), 0) ** 0.8
        inside = (np.abs(w) < half) & (np.abs(u) < L)
        shade = 0.72 + 0.28 * r.random() - 0.18 * (np.abs(w) / (half + 1e-3))
        rib = np.abs(w) < 1.2
        val = np.where(rib, 0.95, shade)
        for ch in range(3):
            img[..., ch] = np.where(inside, val, img[..., ch])
        img[..., 3] = np.where(inside, 1.0, img[..., 3])
    # stem lines towards the centre
    im = bpy.data.images.new("leaf_atlas", size, size, alpha=True)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(img[::-1].ravel())
    im.pack()
    return im


# ───────── mesh accumulation: static geometry merged per material ─────────
class Acc:
    def __init__(self):
        self.v, self.f = [], []

    def add(self, verts, faces):
        o = len(self.v)
        self.v.extend(verts)
        self.f.extend([tuple(i + o for i in face) for face in faces])


ACC = {}


def acc(mat):
    return ACC.setdefault(mat, Acc())


def box(mat, x0, z0, x1, z1, y0, y1):
    xa, xb = min(x0, x1), max(x0, x1)
    za, zb = min(z0, z1), max(z0, z1)
    v = [B(xa, za, y0), B(xb, za, y0), B(xb, zb, y0), B(xa, zb, y0), B(xa, za, y1), B(xb, za, y1), B(xb, zb, y1), B(xa, zb, y1)]
    acc(mat).add(v, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])


def obox(mat, cx, cz, length, height, thick, base, angle):
    """Box centred at (cx, cz), long side along `angle` (radians in plan, from +x towards +z)."""
    ca, sa = math.cos(angle), math.sin(angle)
    hl, ht = length / 2, thick / 2
    corners = [(-hl, -ht), (hl, -ht), (hl, ht), (-hl, ht)]
    pts = [(cx + a * ca - b * sa, cz + a * sa + b * ca) for a, b in corners]
    prism(mat, pts, base + height, height)


def signed_area(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2


def prism(mat, pts, top, depth):
    """Extruded plan polygon from top − depth to top."""
    if signed_area(pts) < 0:
        pts = pts[::-1]
    n = len(pts)
    v = [B(x, z, top - depth) for x, z in pts] + [B(x, z, top) for x, z in pts]
    # plan (x, z) counter-clockwise appears clockwise in Blender (y = −z): top face uses reversed order
    faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, n + i, n + j, j))
    acc(mat).add(v, faces)


def rect(x0, z0, x1, z1):
    return [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]


def slab(pts, top, depth, mat):
    prism(mat, pts, top, depth)


def wall(pts, h, t=0.3, base=0.0, mat="stucco", closed=False):
    p = list(pts) + ([pts[0]] if closed else [])
    for a, b in zip(p, p[1:]):
        L = math.dist(a, b)
        if L > 0.01:
            obox(mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + t, h, t, base, math.atan2(b[1] - a[1], b[0] - a[0]))


def glazing(pts, y0, y1, mat="glass", bay=2.0):
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        obox(mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L, y1 - y0, 0.06, y0, ang)
        n = max(1, round(L / bay))
        for k in range(n + 1):
            t = k / n
            obox("frame", a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.09, y1 - y0, 0.16, y0, ang)
        obox("frame", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L, 0.1, 0.18, y0 + (y1 - y0) * 0.78, ang)  # transom


def offset_polygon(points, d):
    out = []
    n = len(points)
    for i, p in enumerate(points):
        pr, nx = points[i - 1], points[(i + 1) % n]
        inc = Vector((p[0] - pr[0], p[1] - pr[1])).normalized()
        og = Vector((nx[0] - p[0], nx[1] - p[1])).normalized()
        n0, n1 = Vector((inc.y, -inc.x)), Vector((og.y, -og.x))
        bis = (n0 + n1).normalized()
        s = bis * (d / bis.dot(n1))
        out.append((p[0] + s.x, p[1] + s.y))
    return out


def rounded_polygon(points, radius, steps=8):
    out = []
    n = len(points)
    for i, p in enumerate(points):
        P, pr, nx = Vector(p), Vector(points[i - 1]), Vector(points[(i + 1) % n])
        cut = min(radius, (P - pr).length * 0.2, (P - nx).length * 0.2)
        a = P + (pr - P).normalized() * cut
        b = P + (nx - P).normalized() * cut
        for s in range(steps + 1):
            t = s / steps
            q = a * (1 - t) ** 2 + P * 2 * t * (1 - t) + b * t * t
            out.append((q.x, q.y))
    return out


def round_rect(x0, z0, x1, z1, r, seg=6):
    out = []
    for cx, cz, a0 in ((x1 - r, z0 + r, -math.pi / 2), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, math.pi / 2), (x0 + r, z0 + r, math.pi)):
        for i in range(seg + 1):
            a = a0 + i / seg * math.pi / 2
            out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out


def make_object(name, verts, faces, mat, smooth=False, parent_coll=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
    if mat:
        me.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    ob = bpy.data.objects.new(name, me)
    (parent_coll or COLL).objects.link(ob)
    return ob


def flush_static():
    for mat, a in ACC.items():
        if a.v:
            make_object("static_" + mat, a.v, a.f, mat)
    ACC.clear()


# ───────── instanced pieces: trees, shrubs, cars ─────────
def proto_collection(name):
    c = bpy.data.collections.new(name)
    PROTO.children.link(c)
    return c


INST = bpy.data.collections.new("instances")
COLL.children.link(INST)


def instance(coll, x, z, y=0.0, rot=0.0, scale=1.0, color=None):
    e = bpy.data.objects.new(coll.name + "_i", None)
    e.instance_type = "COLLECTION"
    e.instance_collection = coll
    e.location = B(x, z, y)
    e.rotation_euler = (0, 0, rot)
    e.scale = (scale, scale, scale)
    INST.objects.link(e)
    return e


def tube(verts, faces, a, b, r0, r1, sides=7):
    """Tapered cylinder from a to b (Vectors)."""
    d = (b - a)
    axis = d.normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    w = axis.cross(u)
    o = len(verts)
    for k, (c, r) in enumerate(((a, r0), (b, r1))):
        for i in range(sides):
            t = i / sides * TAU
            verts.append(tuple(c + (u * math.cos(t) + w * math.sin(t)) * r))
    for i in range(sides):
        j = (i + 1) % sides
        faces.append((o + i, o + j, o + sides + j, o + sides + i))


def leaf_cards(verts, faces, uvs, centre, radii, count, size, rr, up_bias=0.3, shell=0.55):
    """Leaf cards scattered through an ellipsoid crown, denser towards its surface."""
    cx, cy, cz = centre
    for _ in range(count):
        while True:
            p = Vector((rr.uniform(-1, 1), rr.uniform(-1, 1), rr.uniform(-1, 1)))
            if p.length <= 1:
                break
        p = p.normalized() * (shell + (1 - shell) * rr.random() ** 0.5) if p.length > 0 else p
        pos = Vector((cx + p.x * radii[0], cy + p.y * radii[1], cz + p.z * radii[2]))
        nrm = (p + Vector((rr.uniform(-0.6, 0.6), rr.uniform(-0.6, 0.6), up_bias + rr.uniform(-0.5, 0.5)))).normalized()
        ref = Vector((0, 0, 1)) if abs(nrm.z) < 0.95 else Vector((1, 0, 0))
        u = nrm.cross(ref).normalized()
        w = nrm.cross(u)
        rot = rr.uniform(0, TAU)
        u, w = u * math.cos(rot) + w * math.sin(rot), -u * math.sin(rot) + w * math.cos(rot)
        s = size * rr.uniform(0.75, 1.25)
        o = len(verts)
        for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(tuple(pos + (u * a + w * b) * s * 0.5))
        faces.append((o, o + 1, o + 2, o + 3))
        uvs.extend([(0, 0), (1, 0), (1, 1), (0, 1)])


def mesh_with_uv(name, verts, faces, uvs, mat, coll):
    ob = make_object(name, verts, faces, mat, parent_coll=coll)
    me = ob.data
    uvl = me.uv_layers.new(name="UVMap")
    flat = [c for uv in uvs for c in uv]
    uvl.data.foreach_set("uv", flat)
    return ob


def make_tree(name, seed, height, crown, leaves, leaf_mat="leaf", lean=0.08, kind="broad"):
    """Broad-leaf shade tree: tapered trunk, a few limbs and a leaf-card crown."""
    rr = random.Random(seed)
    coll = proto_collection(name)
    tv, tf = [], []
    trunk_h = height * (0.38 if kind == "broad" else 0.55)
    top = Vector((rr.uniform(-lean, lean) * height, rr.uniform(-lean, lean) * height, trunk_h))
    tube(tv, tf, Vector((0, 0, -0.1)), top, 0.11 * height / 6, 0.075 * height / 6, 8)
    crown_c = Vector((top.x, top.y, trunk_h + crown[2] * 0.85))
    limbs = []
    n_limbs = rr.randint(6, 8)
    for i in range(n_limbs):
        a = i / n_limbs * TAU + rr.uniform(-0.35, 0.35)
        end = crown_c + Vector((math.cos(a) * crown[0] * 0.62, math.sin(a) * crown[1] * 0.62, rr.uniform(-0.35, 0.55) * crown[2]))
        tube(tv, tf, top, end, 0.06 * height / 6, 0.02 * height / 6, 6)
        limbs.append(end)
    make_object(name + "_wood", tv, tf, "bark", smooth=True, parent_coll=coll)
    lv, lf, luv = [], [], []
    leaf_cards(lv, lf, luv, crown_c, (crown[0] * 0.8, crown[1] * 0.8, crown[2] * 0.85), int(leaves * 0.3), 0.75 * height / 7, rr)
    for end in limbs:  # overlapping clumps around the limb tips give a layered, irregular canopy
        r_ = rr.uniform(0.45, 0.65)
        leaf_cards(lv, lf, luv, end, (crown[0] * r_, crown[1] * r_, crown[2] * r_ * 0.8), int(leaves * 0.7 / len(limbs)), 0.7 * height / 7, rr, shell=0.45)
    mesh_with_uv(name + "_leaves", lv, lf, luv, leaf_mat, coll)
    return coll


def make_shrub(name, seed, r, leaves, leaf_mat):
    rr = random.Random(seed)
    coll = proto_collection(name)
    lv, lf, luv = [], [], []
    leaf_cards(lv, lf, luv, (0, 0, r * 0.45), (r, r, r * 0.55), leaves, r * 0.55, rr, up_bias=0.6, shell=0.3)
    mesh_with_uv(name + "_leaves", lv, lf, luv, leaf_mat, coll)
    return coll


def make_grass_tuft(name, seed):
    rr = random.Random(seed)
    coll = proto_collection(name)
    v, f = [], []
    for _ in range(40):
        a = rr.uniform(0, TAU)
        h = rr.uniform(0.35, 0.9)
        sp = h * rr.uniform(0.2, 0.55)
        bx, by = math.cos(a) * rr.random() * 0.12, math.sin(a) * rr.random() * 0.12
        wdt = 0.025
        o = len(v)
        v += [(bx - math.sin(a) * wdt, by + math.cos(a) * wdt, 0), (bx + math.sin(a) * wdt, by - math.cos(a) * wdt, 0), (bx + math.cos(a) * sp, by + math.sin(a) * sp, h)]
        f.append((o, o + 1, o + 2))
    make_object(name, v, f, "dryGrass", parent_coll=coll)
    return coll


def make_car(name, kind, lit=True):
    """Saloon / SUV / hatch body lofted from cross-sections, with glasshouse, wheels and lamps."""
    coll = proto_collection(name)
    if kind == "suv":
        L, W, sill, belt, roof, hood_l, deck_l, cab_in = 4.85, 1.95, 0.42, 1.12, 1.78, 0.95, 0.35, 0.10
    elif kind == "hatch":
        L, W, sill, belt, roof, hood_l, deck_l, cab_in = 4.2, 1.8, 0.33, 0.92, 1.48, 0.85, 0.15, 0.12
    else:
        L, W, sill, belt, roof, hood_l, deck_l, cab_in = 4.75, 1.84, 0.32, 0.88, 1.44, 1.15, 0.85, 0.14
    # body: stations along x with (top height, half width); rounded rectangular sections
    stations = [(-L / 2, belt - 0.12, W / 2 - 0.12), (-L / 2 + 0.12, belt - 0.02, W / 2 - 0.03), (-L / 2 + 0.6, belt, W / 2),
                (0, belt, W / 2), (L / 2 - hood_l, belt - 0.02, W / 2), (L / 2 - 0.25, belt - 0.12, W / 2 - 0.03), (L / 2, belt - 0.24, W / 2 - 0.15)]
    v, f = [], []
    ring = 10
    for i, (x, top, hw) in enumerate(stations):
        for k in range(ring):
            t = k / ring * TAU
            cy, cz = math.cos(t), math.sin(t)
            y = hw * (abs(cy) ** 0.35) * (1 if cy >= 0 else -1)
            zc = (sill + top) / 2
            hz = (top - sill) / 2
            z = zc + hz * (abs(cz) ** 0.35) * (1 if cz >= 0 else -1)
            v.append((x, y, z))
        if i:
            o = (i - 1) * ring
            for k in range(ring):
                j = (k + 1) % ring
                f.append((o + k, o + j, o + ring + j, o + ring + k))
    n = len(stations) * ring
    f.append(tuple(range(ring - 1, -1, -1)))
    f.append(tuple(range(n - ring, n)))
    body = make_object(name + "_body", v, f, "carPaint", smooth=True, parent_coll=coll)
    sub = body.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 1
    # glasshouse
    x_rear, x_front = -L / 2 + deck_l, L / 2 - hood_l
    hw0, hw1 = W / 2 - cab_in, W / 2 - cab_in - 0.18
    rl, rf = x_rear + (0.35 if kind != "suv" else 0.12), x_front - 0.55
    gv = [(x_rear, -hw0, belt), (x_front, -hw0, belt), (x_front, hw0, belt), (x_rear, hw0, belt),
          (rl, -hw1, roof), (rf, -hw1, roof), (rf, hw1, roof), (rl, hw1, roof)]
    gf = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    make_object(name + "_glass", gv, gf, "carGlass", parent_coll=coll)
    rv = [(rl + 0.05, -hw1 - 0.01, roof), (rf - 0.05, -hw1 - 0.01, roof), (rf - 0.05, hw1 + 0.01, roof), (rl + 0.05, hw1 + 0.01, roof),
          (rl + 0.05, -hw1 - 0.01, roof + 0.04), (rf - 0.05, -hw1 - 0.01, roof + 0.04), (rf - 0.05, hw1 + 0.01, roof + 0.04), (rl + 0.05, hw1 + 0.01, roof + 0.04)]
    make_object(name + "_roof", rv, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], "carPaint", parent_coll=coll)
    # wheels
    wr = 0.36 if kind != "suv" else 0.4
    tv, tf, rv2, rf2 = [], [], [], []
    for wx in (L / 2 - 0.85, -L / 2 + 0.9):
        for side in (-1, 1):
            c = Vector((wx, side * (W / 2 - 0.13), wr))
            tube(tv, tf, c - Vector((0, 0.13, 0)), c + Vector((0, 0.13, 0)), wr, wr, 16)
            o = len(rv2)
            for i in range(16):
                t = i / 16 * TAU
                rv2.append((c.x + math.cos(t) * wr * 0.62, c.y + side * 0.135, c.z + math.sin(t) * wr * 0.62))
            rf2.append(tuple(range(o, o + 16)))
    make_object(name + "_tyres", tv, tf, "tyre", smooth=True, parent_coll=coll)
    make_object(name + "_rims", rv2, rf2, "rim", parent_coll=coll)
    # lamps (thin quads on the nose and tail)
    hv, hf, tlv, tlf = [], [], [], []
    for side in (-1, 1):
        y0, y1 = side * (W / 2 - 0.42), side * (W / 2 - 0.12)
        o = len(hv)
        hv += [(L / 2 + 0.005, y0, belt - 0.32), (L / 2 + 0.005, y1, belt - 0.32), (L / 2 + 0.005, y1, belt - 0.2), (L / 2 + 0.005, y0, belt - 0.2)]
        hf.append((o, o + 1, o + 2, o + 3))
        o = len(tlv)
        tlv += [(-L / 2 - 0.005, y0, belt - 0.24), (-L / 2 - 0.005, y1, belt - 0.24), (-L / 2 - 0.005, y1, belt - 0.13), (-L / 2 - 0.005, y0, belt - 0.13)]
        tlf.append((o, o + 3, o + 2, o + 1))
    make_object(name + "_head", hv, hf, "headlight" if lit else "lampOff", parent_coll=coll)
    make_object(name + "_tail", tlv, tlf, "taillight" if lit else "tailOff", parent_coll=coll)
    return coll


PAINTS = ["#f2f2f0", "#f2f2f0", "#eeeeec", "#b9bcbf", "#1b1c1e", "#6b6f74", "#2b3a55", "#d9d6cf", "#7a1f1f", "#e8e6e1"]


def car_color():
    return hexc(rng.choice(PAINTS))


# ───────── build the site ─────────
build_materials()

TREES = [make_tree(f"tree{i}", 100 + i, rng.uniform(6.5, 9.0), (rng.uniform(3.0, 3.8), rng.uniform(3.0, 3.8), rng.uniform(2.2, 2.8)), 2600,
                   "leaf" if i % 3 else "leafDark") for i in range(6)]
TREES_OLIVE = [make_tree(f"olive{i}", 200 + i, rng.uniform(4.5, 5.5), (2.2, 2.2, 1.6), 900, "leafOlive", lean=0.12) for i in range(2)]
SHRUBS = [make_shrub(f"shrub{i}", 300 + i, rng.uniform(0.7, 1.1), 260, m) for i, m in enumerate(["leaf", "leafDark", "leafFlower", "leaf", "leafFlower", "leafOlive"])]
TUFTS = [make_grass_tuft(f"tuft{i}", 400 + i) for i in range(3)]
CARS = {k: make_car("car_" + k, k, lit=False) for k in ("sedan", "suv", "hatch")}  # parked
CARS_LIT = {k: make_car("carlit_" + k, k) for k in ("sedan", "suv", "hatch")}  # moving


def tree(x, z, s=1.0, base=0.15):
    instance(rng.choice(TREES), x, z, base, rnd() * TAU, s * rng.uniform(0.85, 1.1))


def olive(x, z, s=1.0, base=0.15):
    instance(rng.choice(TREES_OLIVE), x, z, base, rnd() * TAU, s)


def shrubs(points, base, kind=None, size=1.0):
    for x, z in points:
        coll = SHRUBS[kind] if kind is not None else rng.choice(SHRUBS)
        instance(coll, x, z, base, rnd() * TAU, size * rng.uniform(0.75, 1.25))


def scatter(n, x0, x1, z0, z1):
    return [(x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)) for _ in range(n)]


def parked_car(x, z, rot, y=0.06):
    kind = rng.choice(["sedan", "sedan", "suv", "suv", "hatch"])
    e = instance(CARS[kind], x, z, y, rot)
    e.color = car_color()
    return e


def parking_row(x0, x1, z0, z1, y=0.06, fill=0.6, nose=-1, skip=lambda cx: False):
    bay = 2.7
    x = x0
    while x <= x1 + 0.01:
        box("line", x - 0.06, z0, x + 0.06, z1, y, y + 0.012)
        cx = x + bay / 2
        if cx < x1 and not skip(cx) and rnd() < fill:
            # nose towards −z means the car's +x axis points to −z in plan → Blender +y
            parked_car(cx + (rnd() - 0.5) * 0.2, (z0 + z1) / 2 + (rnd() - 0.5) * 0.3, (math.pi / 2 if nose < 0 else -math.pi / 2) + (rnd() - 0.5) * 0.05, y)
        x += bay


LIGHTS = []


def lamp_post(x, z, h=7.5, base=0.15, arm=1.2, facing=-1):
    obox("frame", x, z, 0.16, h, 0.16, base, 0)
    obox("frame", x, z + facing * arm / 2, 0.12, 0.1, arm, base + h - 0.1, 0)
    box("frame", x - 0.25, z + facing * arm - 0.18, x + 0.25, z + facing * arm + 0.18, base + h - 0.2, base + h)
    box("lampGlow", x - 0.2, z + facing * arm - 0.13, x + 0.2, z + facing * arm + 0.13, base + h - 0.23, base + h - 0.2)
    LIGHTS.append(("street", B(x, z + facing * arm, base + h - 0.35)))


def parking_planter(x, z, w, d, with_tree=False):
    corners = [(x - w / 2, z - d / 2), (x + w * 0.34, z - d / 2), (x + w / 2, z + d * 0.28), (x - w * 0.36, z + d / 2)]
    outer = rounded_polygon(corners, min(w, d) * 0.2, 4)
    inner = rounded_polygon(offset_polygon(corners, -0.24), min(w, d) * 0.15, 4)
    slab(outer, 0.58, 0.5, "curb")
    slab(inner, 0.6, 0.12, "soil")
    for _ in range(int(w * d * 0.25)):
        instance(rng.choice(TUFTS), x + (rnd() - 0.5) * (w - 1.2), z + (rnd() - 0.5) * (d - 1.2), 0.6, rnd() * TAU, rng.uniform(0.7, 1.1))
    shrubs([(x - w * 0.18, z - d * 0.16), (x + w * 0.12, z + d * 0.2)], 0.6, None, 0.9)
    if with_tree:
        tree(x - w * 0.16, z - d * 0.08, 0.9, 0.6)


# sand and dunes all around the site
def terrain():
    S, N = 3600, 560
    v, f = [], []

    def ss(a, b, x):
        t = min(1, max(0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    for j in range(N + 1):
        for i in range(N + 1):
            x = -S / 2 + S * i / N
            z = -S / 2 + S * j / N
            d = max(abs(x) - 205, (-z - 115) if z < 0 else (z - 125), 0)
            if 55 < z < 80:  # keep the main road corridor flat all the way out
                d = 0
            mask = ss(8, 160, d)
            warp = math.sin(z * 0.0071 + x * 0.0023) * 2.1 + math.sin(z * 0.019 - x * 0.0061) * 0.7 + math.sin(x * 0.0043 + 2.0) * 1.1
            u = x * 0.0105 + z * 0.0035 + warp
            saw = u - math.floor(u)
            crest = 0.74 + 0.12 * math.sin(z * 0.013 + x * 0.004)
            dune = ss(0.0, crest, saw) * (1 - ss(crest, 1.0, saw))  # slow rise, quick drop at the crest
            amp = 11 + 9 * math.sin(z * 0.0043 + 1.3) * math.cos(x * 0.0029 + 0.4) + 4 * math.sin(x * 0.011 - z * 0.008)
            ridge = dune * amp / 16
            swell = 0.5 + 0.5 * math.sin(z * 0.006 - x * 0.003)
            sh = math.sin(x * 0.041 + z * 0.027) * math.cos(z * 0.039) * 1.2
            big = (0.5 + 0.5 * math.sin(x * 0.0021 + z * 0.0013)) * 28 * ss(250, 900, d)
            v.append(B(x, z, (ridge * 16 + swell * 10 + sh + big) * mask - 0.03))
    for j in range(N):
        for i in range(N):
            a = j * (N + 1) + i
            f.append((a, a + 1, a + N + 2, a + N + 1))
    ob = make_object("terrain", v, f, "sand", smooth=True)
    return ob


terrain()

# ── main road along the front (extends into the desert), verge, jogging track
X0, X1 = -190, 190
RX0, RX1 = -1700, 1700
slab(rect(RX0, 58, RX1, 72), 0.06, 0.12, "asphalt")
x = RX0
while x < RX1:
    box("line", x, 64.88, x + 4.5, 65.12, 0.06, 0.072)
    x += 9
for zz in (58.35, 71.65):
    box("line", RX0, zz - 0.08, RX1, zz + 0.08, 0.06, 0.072)
slab(rect(RX0, 57.6, RX1, 58), 0.2, 0.2, "curb")
slab(rect(RX0, 72, RX1, 72.4), 0.2, 0.2, "curb")
slab(rect(X0, 72.4, X1, 73), 0.16, 0.2, "pavers")
slab(rect(X0, 73, X1, 76.5), 0.1, 0.1, "track")
slab(rect(X0, 76.5, X1, 92), 0.08, 0.1, "grass")
x = X0 + 6
while x < X1:
    tree(x, 80 + rnd() * 10, 1.0 + rnd() * 0.3, 0.08)
    x += 11 + rnd() * 6
shrubs(scatter(220, X0, X1, 77, 91), 0.08, None, 1.0)
for x in range(-179, 182, 9):
    tree(x, 85 + (rnd() - 0.5) * 4, 0.95 + rnd() * 0.3, 0.08)
# planted verge between the parking and the road
slab(rect(X0, 52, X1, 57.6), 0.2, 0.2, "grass")
shrubs(scatter(320, X0, X1, 52.6, 57.2), 0.2, None, 0.9)
x = -181
while x < 184:
    tree(x, 55 + (rnd() - 0.5) * 1.2, 0.85 + rnd() * 0.25, 0.2)
    x += 8 + rnd() * 3
for x in range(-176, 177, 32):
    lamp_post(x, 57.0, 8.5, 0.2, 1.6, 1)
for x in list(range(-1690, -190, 48)) + list(range(206, 1700, 48)):  # street lights along the road in the desert
    lamp_post(x, 57.6, 9, 0.06, 1.6, 1)

# ── front parking
slab(rect(-150, 20, 150, 38), 0.06, 0.1, "asphalt")
slab(rect(72, 38, 150, 52), 0.06, 0.1, "asphalt")
slab(rect(-150, 38, 28, 52), 0.18, 0.18, "grass")
shrubs(scatter(80, -148, 26, 39, 51), 0.18, None, 1.0)
for x in range(-140, 26, 14):
    tree(x + rnd() * 4, 45 + (rnd() - 0.5) * 5, 0.8, 0.18)
island = lambda cx: ((cx % 40) + 40) % 40 > 34
parking_row(-148, 146, 20.5, 26, nose=-1, skip=lambda cx: island(cx) or 111 < cx < 125)
parking_row(74, 146, 33, 38.5, nose=1, skip=island)
slab(rect(74, 38.5, 146, 40.5), 0.18, 0.18, "grass")
shrubs(scatter(30, 76, 144, 38.8, 40.2), 0.18, 0, 0.6)
parking_row(74, 146, 40.5, 46, nose=-1, skip=island)
for x in range(-120, 146, 40):
    if 26 < x < 72:
        continue
    for z0, z1 in ([(20.5, 26)] if x < 74 else [(20.5, 26), (33, 38.5), (40.5, 46)]):
        parking_planter(x - 2.6, (z0 + z1) / 2, 4.8, z1 - z0, True)
for x in range(-140, 150, 36):
    lamp_post(x, 29.0, 8, 0.06, 0.3, 1)

# ── front promenade and food pods
slab(rect(-150, 12, 78, 20), 0.16, 0.16, "pavers")
slab(rect(78, 16, 150, 20), 0.16, 0.16, "pavers")
box("curb", -150, 19.8, 26, 20.1, 0, 0.3)
box("curb", 72, 19.8, 150, 20.1, 0, 0.3)
POD = proto_collection("pod")
POD_W = proto_collection("podW")
for coll, mat in ((POD, "podPink"), (POD_W, "podWhite")):
    bpy.ops.mesh.primitive_cube_add(size=1)
    c = bpy.context.active_object
    for cc in c.users_collection:
        cc.objects.unlink(c)
    coll.objects.link(c)
    c.scale = (5, 2.5, 2.7)
    c.location = (0, 0, 0.3 + 1.35)
    bev = c.modifiers.new("bev", "BEVEL")
    bev.width, bev.segments = 0.12, 4
    c.data.materials.append(MATS[mat])
    w = make_object("podwin", [(-1.3, -1.27, 1.6), (1.3, -1.27, 1.6), (1.3, -1.27, 2.7), (-1.3, -1.27, 2.7)], [(0, 1, 2, 3)], "glass", parent_coll=coll)
for i, (x, z) in enumerate([(-100, 16), (-82, 16.4), (-58, 18), (-36, 19), (-14, 18), (4, 16), (22, 16), (84, 17), (106, 17)]):
    instance(POD_W if i % 2 else POD, x, z, 0.0, (rnd() - 0.5) * 0.2)
    for k in range(3):  # café tables
        tx, tz = x - 3 + rnd() * 6, z - 3.2 - rnd() * 1.2
        obox("fabric", tx, tz, 0.9, 0.05, 0.9, 0.86, 0)
        obox("metal", tx, tz, 0.08, 0.7, 0.08, 0.16, 0)
        for a in (0, math.pi):
            obox("fabric", tx + math.cos(a) * 0.75, tz + math.sin(a) * 0.75, 0.45, 0.85, 0.45, 0.16, 0)
# small terracotta kiosk
box("flutes", 112, 21, 120, 27, 0.2, 3.4)
box("darkBand", 111.3, 20.3, 120.7, 27.7, 3.4, 3.8)
glazing([(113, 27.05), (119, 27.05)], 0.3, 2.9)

# ── continuous raised connector (the spine) with a separate rear road
CH = 9.4
SP = dict(x0=-150, x1=73, z0=-29, z1=-22)
box("spine", SP["x0"], SP["z0"], SP["x1"], SP["z1"], 0, CH - 0.55)
box("roof", SP["x0"], SP["z0"], SP["x1"], SP["z1"], CH - 0.55, CH - 0.35)
glazing([(SP["x0"] + 2, SP["z1"] + 0.05), (SP["x1"] - 2, SP["z1"] + 0.05)], 0.3, 5.7, "glass", 3)
box("darkBand", SP["x0"], SP["z1"] - 0.4, SP["x1"], SP["z1"] + 0.9, 5.7, 6.3)
wall([(SP["x0"], SP["z0"]), (SP["x1"], SP["z0"]), (SP["x1"], SP["z1"]), (SP["x0"], SP["z1"])], 0.65, 0.3, CH - 0.35, "spine", True)
for x in (-128, -82, -36, 10, 56):
    box("spine", x, -30, x + 8, -28.8, CH - 0.35, CH + 0.3)
# The spine's roof is a plain roof (no parking). Behind it: the rear road at ground level, then a parking row.
slab(rect(-190, -53, 192, -30), 0.06, 0.1, "asphalt")
parking_row(-146, 146, -51.5, -46, nose=-1, fill=0.62)
slab(rect(-190, -31.5, 73, -30), 0.16, 0.2, "pavers")
for x in range(-186, 190, 9):
    box("line", x, -40.12, x + 4.5, -39.88, 0.06, 0.072)
slab(rect(-190, -61, 192, -53), 0.18, 0.18, "grass")
shrubs(scatter(200, -188, 190, -60, -54), 0.18, None, 1.0)
for x in range(-180, 190, 30):
    lamp_post(x, -53.5, 8, 0.18, 1.2, -1)
# additional ground-level parking past the east end
slab(rect(150, -53, 192, 20), 0.06, 0.1, "asphalt")
for z0, z1, nose in ((-49, -43.5, -1), (-37.5, -32, 1), (-30, -24.5, -1), (-18.5, -13, 1), (-11, -5.5, -1), (0.5, 6, 1)):
    parking_row(154, 188, z0, z1, nose=nose, fill=0.45)
for z0, z1 in ((-32, -30), (-13, -11)):
    slab(rect(154, z0, 188, z1), 0.18, 0.18, "grass")
    for x in range(158, 188, 10):
        tree(x, (z0 + z1) / 2, 0.8, 0.18)
# storage containers at the west end
for x, z, k in ((-178, -48, 0), (-178, -40, 1), (-178, -32, 2), (-166, -48, 3), (-166, -40, 1)):
    box(f"container{k}", x, z, x + 10, z + 6, 0, 3.2)

# ── back landscape: jogging trail through planted dunes
slab(rect(-190, -110, 190, -61), 0.08, 0.1, "grass")


def catmull(points, n):
    out = []
    P = [points[0]] + points + [points[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = (Vector(p) for p in P[i - 1:i + 3])
        for s in range(n):
            t = s / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(Vector(points[-1]))
    return out


path = catmull([(-190, -70), (-130, -78), (-80, -68), (-30, -84), (20, -72), (70, -88), (120, -74), (190, -82)], 24)
for a, b in zip(path, path[1:]):
    d = (b - a)
    obox("track", (a.x + b.x) / 2, (a.y + b.y) / 2, d.length + 0.3, 0.06, 3.6, 0.08, math.atan2(d.y, d.x))
for i in range(80):
    x, z = scatter(1, -185, 185, -108, -64)[0]
    if abs(z + 78 - 8 * math.sin(x * 0.03)) > 5:
        (olive if rnd() < 0.3 else tree)(x, z, 0.9 + rnd() * 0.5, 0.08)
shrubs(scatter(420, -188, 188, -108, -62), 0.08, None, 1.1)
for _ in range(260):  # desert grass and scrub on the dunes beyond the site
    x, z = rng.uniform(-420, 420), rng.uniform(-420, 260)
    if abs(x) < 200 and -115 < z < 125:
        continue
    instance(rng.choice(TUFTS), x, z, -0.05, rnd() * TAU, rng.uniform(1.0, 2.2))

# ── west retail block: two storeys, cream stucco with brick-framed bays
x0, x1, z0, z1, H = -150, -106, -22, 8, 10.5
box("stucco", x0, z0, x1, z1, 0, H)
box("darkBand", x0 - 0.3, z0, x1 + 0.3, z1 + 0.3, H, H + 0.8)
x = x0 + 3
while x < x1 - 4:
    box("brickFrame", x, z1, x + 0.9, z1 + 0.9, 0, H - 0.6)
    box("brickFrame", x + 5.1, z1, x + 6, z1 + 0.9, 0, H - 0.6)
    box("brickFrame", x, z1, x + 6, z1 + 0.9, H - 1.5, H - 0.6)
    glazing([(x + 0.9, z1 + 0.2), (x + 5.1, z1 + 0.2)], 0.2, H - 1.5, "glass", 1.4)
    x += 8
glazing([(x1 + 0.05, z0 + 2), (x1 + 0.05, z1 - 2)], 0.2, 4.4)
glazing([(x1 + 0.05, z0 + 2), (x1 + 0.05, z1 - 2)], 5.4, 9.2)
box("concrete", x0 + 6, z0 + 6, x0 + 16, z0 + 14, H + 0.8, H + 3)
slab(round_rect(x0 - 8, z1 + 1, x0 + 2, 20, 4, 6), 0.9, 0.9, "curb")
shrubs(scatter(14, x0 - 7, x0 + 1, z1 + 2, 19), 0.9, None, 1.0)


def text_sign(txt, x, y, z, size, rot=0.0, mat="signGlow", extrude=0.04):
    cu = bpy.data.curves.new("sign_" + txt, "FONT")
    cu.body = txt
    cu.size = size
    cu.align_x = "CENTER"
    cu.extrude = extrude
    cu.space_character = 1.15
    ob = bpy.data.objects.new("sign_" + txt, cu)
    ob.location = B(x, z, y)
    ob.rotation_euler = (math.pi / 2, 0, rot)
    cu.materials.append(MATS[mat])
    COLL.objects.link(ob)
    return ob


text_sign("SIGNAGE", (x0 + x1) / 2 + 6, H - 1.3, z1 + 0.96, 1.1)

# ── shade-sail market court
x0, x1, z0, z1 = -106, -58, -22, 12
slab(rect(x0, z0, x1, z1), 0.2, 0.2, "clay")
sv, sf = [], []
S = 8.6
for i in range(5):
    for j in range(3):
        cx, cz = x0 + 5 + i * (S + 0.6) + S / 2, z0 + 4 + j * (S + 1.4) + S / 2
        hi, lo, flip = 6.6, 4.4, (i + j) % 2
        hs = [hi, lo, lo, hi] if flip else [lo, hi, hi, lo]  # corners (−,−) (+,−) (−,+) (+,+)
        n = 8
        o = len(sv)
        for b_ in range(n + 1):
            for a_ in range(n + 1):
                u, v_ = a_ / n, b_ / n
                h = hs[0] * (1 - u) * (1 - v_) + hs[1] * u * (1 - v_) + hs[2] * (1 - u) * v_ + hs[3] * u * v_
                sag = -0.25 * math.sin(math.pi * u) * math.sin(math.pi * v_)
                sv.append(B(cx + (u - 0.5) * S, cz + (v_ - 0.5) * S, 0.2 + h + sag))
        for b_ in range(n):
            for a_ in range(n):
                k = o + b_ * (n + 1) + a_
                sf.append((k, k + 1, k + n + 2, k + n + 1))
        for dx, dz, h in ((-1, -1, hs[0]), (1, 1, hs[3])):
            obox("pole", cx + dx * S / 2, cz + dz * S / 2, 0.24, h + 0.6, 0.24, 0.2, 0)
sail = make_object("sails", sv, sf, "sail", smooth=True)
sail.modifiers.new("solid", "SOLIDIFY").thickness = 0.03
for i in range(8):
    x, z = x0 + 8 + (i % 4) * 10.5, (-8 if i < 4 else 2)
    box("wood", x, z, x + 3.4, z + 1.6, 0.2, 1.3)
    box("fabric", x - 0.2, z - 0.2, x + 3.6, z + 1.8, 2.6, 2.75)
    for dx, dz in ((0, 0), (3.4, 0), (0, 1.6), (3.4, 1.6)):
        box("wood", x + dx - 0.04, z + dz - 0.04, x + dx + 0.04, z + dz + 0.04, 1.3, 2.6)
for x in (-100, -64):
    for z in (-17, 7):
        slab(round_rect(x - 2.2, z - 2.2, x + 2.2, z + 2.2, 1.2, 4), 0.7, 0.5, "curb")
        shrubs(scatter(3, x - 1.3, x + 1.3, z - 1.3, z + 1.3), 0.7, None, 1.0)
        LIGHTS.append(("court", B(x, z, 4.0)))

# ── Games hall: skewed footprint, terracotta flutes
H = 10.8
outline = [(-58, -22), (-14, -22), (-10, 14), (-52, 18)]
inset = [(-33 + (x + 33) * 0.977, -2 + (z + 2) * 0.977) for x, z in outline]
slab(outline, H - 0.85, H - 0.85, "flutes")
slab(inset, H - 0.72, 0.22, "roof")
wall(outline, 0.85, 0.32, H - 0.85, "darkBand", True)
glazing([(-58.12, -21), (-52.12, 18.12), (-39, 16.86)], 0.2, H - 1, "glass", 2.1)
glazing([(-21, 15.15), (-9.88, 14.1), (-13.88, -21)], 0.2, H - 1, "glass", 2.1)
text_sign("GAMES", -30, H - 0.75, 16.36 + 0.05, 1.3, -math.atan2(4, 42))

# ── tree plaza: stepped timber terraces under a grove
x0, x1, z0, z1 = -14, 26, -22, 12
slab(rect(x0, z0, x1, z1), 0.2, 0.2, "clay")
slab(rect(x0 + 4, z0 + 12, x1 - 6, z1 - 2), 0.8, 0.6, "deck")
slab(rect(x0 + 7, z0 + 14, x1 - 9, z1 - 5), 1.4, 0.6, "deck")
for i in range(9):
    tx, tz = x0 + 9 + (i % 3) * 6, z0 + 16 + (i // 3) * 4.5
    obox("fabric", tx, tz, 1.0, 0.05, 1.0, 2.1, 0)
    for a in (0, 2.1, 4.2):
        obox("fabric", tx + math.cos(a) * 0.8, tz + math.sin(a) * 0.8, 0.45, 0.8, 0.45, 1.4, 0)
for i in range(16):
    tree(x0 + 22 + rnd() * 18, z0 + 2 + rnd() * 26, 1.25 + rnd() * 0.3, 0.2)
    LIGHTS.append(("plaza", B(x0 + 22 + rnd() * 18, z0 + 2 + rnd() * 26, 0.6))) if i % 4 == 0 else None
shrubs(scatter(26, x0 + 1, x1 - 1, z0 + 1, z0 + 10), 0.2, None, 1.0)

# ── the brick-screen pavilion: rounded box, glass ground floor, open brick band
footprint = [(30, -22), (64, -22), (73, 14), (34, 18)]
ring_ = lambda d: rounded_polygon(offset_polygon(footprint, d), max(0.2, 1.6 + d))
outl = ring_(0)
inner = ring_(-1.2)
slab(rect(26, -22, 78, 20), 0.17, 0.17, "pavers")
slab(outl, 0.3, 0.3, "curb")
glazing(inner + [inner[0]], 0.3, 4.2, "glass", 2.6)
back = ring_(-0.75)
for a, b in zip(back, back[1:] + back[:1]):  # lit wall behind the screen
    L = math.dist(a, b)
    if L > 0.01:
        obox("screenBack", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + 0.1, 4.9, 0.1, 4.3, math.atan2(b[1] - a[1], b[0] - a[0]))
edges = [math.dist(outl[i], outl[(i + 1) % len(outl)]) for i in range(len(outl))]
per = sum(edges)
pitch = per / round(per / 0.72)
for row in range(17):
    dist = (row % 2) * pitch / 2
    while dist < per:
        seg, d = 0, dist
        while d > edges[seg] and seg < len(edges) - 1:
            d -= edges[seg]
            seg += 1
        a, b = outl[seg], outl[(seg + 1) % len(outl)]
        t = d / edges[seg]
        obox("brick", a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, pitch * 0.64, 0.23, 0.24, 4.35 + row * 0.285 - 0.115, math.atan2(b[1] - a[1], b[0] - a[0]))
        dist += pitch
slab(outl, 4.3, 0.3, "darkBand")
slab(ring_(-0.4), 9.15, 0.25, "roof")
for d in (0.15, -0.2):
    r_ = ring_(d)
    for a, b in zip(r_, r_[1:] + r_[:1]):
        L = math.dist(a, b)
        if L > 0.01:
            obox("darkBand", (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L + 0.05, 0.3, 0.08, 9.2, math.atan2(b[1] - a[1], b[0] - a[0]))
x = 34
while x < 73:
    slab(round_rect(x - 1.5, 17.8, x + 1.5, 19.6, 0.6, 4), 0.7, 0.5, "curb")
    tree(x, 18.7, 0.7, 0.7)
    x += 11
text_sign("RETAIL PARK", 51.5, 10.2, 16.6, 1.6, -math.atan2(4, 39))

# eastern parking court
slab(rect(78, -30.5, 150, 16), 0.06, 0.1, "asphalt")
for z0, z1, nose in ((-25, -19.5, -1), (-12.5, -7, 1), (-5, 0.5, -1), (7.5, 13, 1)):
    parking_row(80, 148, z0, z1, nose=nose, fill=0.48, skip=lambda cx: 112 < cx < 119)
slab(rect(80, -7, 148, -5), 0.2, 0.2, "grass")
shrubs(scatter(30, 81, 147, -6.8, -5.2), 0.2, 0, 0.6)
for x in (88, 115, 141):
    tree(x, -6, 0.8, 0.2)
for z in (-22, -10, -2, 10):
    parking_planter(115.5, z, 5.1, 5.1)
parking_planter(76, -18, 4.3, 7.8)
parking_planter(145, 17.7, 6.5, 3.3)

# rooftop plant on the flat roofs
def roof_units(x0, x1, z0, z1, y, n):
    for _ in range(n):
        cx, cz = rng.uniform(x0, x1), rng.uniform(z0, z1)
        w, d = rng.choice([(2.4, 1.4), (3.2, 2.0), (1.6, 1.6), (4.5, 2.2)])
        box("concrete", cx, cz, cx + w, cz + d, y, y + rng.uniform(0.9, 1.8))
        box("metal", cx + 0.2, cz + 0.2, cx + w - 0.2, cz + d - 0.2, y, y + 0.05)


roof_units(-48, -22, -18, 8, H - 0.5, 14)        # Games hall
roof_units(36, 62, -18, 10, 9.15, 12)           # pavilion
roof_units(-146, -112, -20, 4, 11.3, 8)         # west block
for x in range(-46, -18, 7):                    # skylights over the Games hall
    box("glass", x, -12, x + 4, -10, H - 0.5, H - 0.2)
    box("glass", x, 0, x + 4, 2, H - 0.5, H - 0.2)


flush_static()

# ───────── traffic on the main road ─────────
# Four lanes; cars wrap along a 2.4 km stretch. `phase` (0..1) moves every car one spacing forward,
# so phase 0 and 1 are identical: orbit frames and traffic loops repeat seamlessly.
LANES = [  # (z, direction, spacing, offset)
    (59.9, 1, 30.0, 0.0), (63.2, 1, 38.0, 11.0),
    (66.8, -1, 33.0, 6.0), (70.1, -1, 42.0, 19.0),
]
TRAFFIC_LEN = 1600.0
MOVING = []
for z, direction, spacing, off in LANES:
    n = int(TRAFFIC_LEN / spacing)
    for k in range(n):
        kind = rng.choice(["sedan", "sedan", "suv", "suv", "hatch"])
        e = instance(CARS_LIT[kind], 0, z, 0.06, 0 if direction > 0 else math.pi)
        e.color = car_color()
        jitter = rng.uniform(-0.3, 0.3) * spacing
        MOVING.append((e, z, direction, spacing, k * spacing + off + jitter, n * spacing))


def set_traffic(phase):
    for e, z, direction, spacing, base, span in MOVING:
        s = (base + phase * spacing) % span - span / 2
        x = s * direction
        e.location = B(x, z, 0.06)
        hide = abs(x) > 760
        e.hide_render = hide
        for ch in e.children:
            ch.hide_render = hide


# ───────── lighting & world ─────────
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
wn = world.node_tree
wn.nodes.clear()
wout = wn.nodes.new("ShaderNodeOutputWorld")
sky = wn.nodes.new("ShaderNodeTexSky")
sky.sky_type = "NISHITA"
sky.sun_disc = False  # the sun lamp is the only sun (a visible disc would double the light)
sky.air_density = 1.0
sky.dust_density = 1.4  # desert haze
sky.ozone_density = 1.0
SUN_EL = 22
SUN_AZ = math.radians(255)  # afternoon sun from the west-south-west: rakes across the front and the dunes
if NIGHT:
    sky.sun_elevation = math.radians(-9)
    sky.sun_disc = False
else:
    sky.sun_elevation = math.radians(SUN_EL)
sky.sun_rotation = SUN_AZ
bg = wn.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.0 if NIGHT else 0.55
wn.links.new(sky.outputs[0], bg.inputs[0])
if NIGHT:  # deep blue night sky with a faint glow on the horizon
    grad = wn.nodes.new("ShaderNodeTexCoord")
    sep = wn.nodes.new("ShaderNodeSeparateXYZ")
    wn.links.new(grad.outputs["Generated"], sep.inputs[0])
    r = wn.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = 0.48, (0.035, 0.045, 0.08, 1)
    els[1].position, els[1].color = 0.75, (0.003, 0.006, 0.018, 1)
    wn.links.new(sep.outputs["Z"], r.inputs["Fac"])
    bg2 = wn.nodes.new("ShaderNodeBackground")
    bg2.inputs["Strength"].default_value = 1.6
    wn.links.new(r.outputs[0], bg2.inputs[0])
    wn.links.new(bg2.outputs[0], wout.inputs[0])
else:
    wn.links.new(bg.outputs[0], wout.inputs[0])


def add_light(name, kind, loc, energy, color, size=0.3, rot=None, spot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind in ("POINT", "SPOT"):
        ld.shadow_soft_size = size
    if kind == "AREA":
        ld.size = size
    if spot:
        ld.spot_size, ld.spot_blend = spot
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    COLL.objects.link(ob)
    return ob


sun_dir = Euler((0, math.radians(90 - (32 if not NIGHT else 40)), SUN_AZ + math.pi), "XYZ")
if NIGHT:
    add_light("moon", "SUN", (0, 0, 100), 0.02, (0.55, 0.66, 1.0), rot=(math.radians(40), 0, SUN_AZ + 1.4))
    warm = (1.0, 0.78, 0.52)
    for kind, loc in LIGHTS:
        if kind == "street":
            add_light("lamp", "SPOT", loc, 5000, warm, 0.25, (0, 0, 0), (math.radians(130), 0.6))
        elif kind == "court":
            add_light("court", "POINT", loc, 900, warm, 0.5)
        else:
            add_light("uplight", "SPOT", loc, 700, warm, 0.2, (0, 0, 0), (math.radians(50), 0.6))
    # interiors spill light onto the promenade and the court
    for x in range(-145, 70, 12):
        add_light("spill", "AREA", B(x, -21, 4.2), 1800, warm, 4, (math.radians(-90), 0, 0))
    for x in range(-148, -106, 8):
        add_light("spill", "AREA", B(x + 3, 9.2, 5), 1100, warm, 4, (math.radians(-90), 0, 0))
    ring_l = ring_(-1.5)
    for i in range(0, len(ring_l), 3):  # pavilion glows from inside
        x, z = ring_l[i]
        add_light("pav", "POINT", B(x, z, 2.5), 450, warm, 0.6)
        add_light("pavS", "POINT", B(x, z, 6.5), 500, (1.0, 0.7, 0.42), 0.6)
    for x in (-50, -30, -14):
        add_light("games", "AREA", B(x, 14.5, 6), 2500, warm, 6, (math.radians(-90), 0, 0))
else:
    add_light("sun", "SUN", (0, 0, 100), 4.2, (1.0, 0.86, 0.70), rot=(math.radians(90 - 32), 0, SUN_AZ + math.pi / 2 - math.pi / 2))
    bpy.data.objects["sun"].data.angle = math.radians(0.6)
    # point the sun along the sky's sun direction
    az = SUN_AZ
    el = math.radians(SUN_EL)
    d = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))  # towards the sun (Nishita: rotation from +y clockwise)
    bpy.data.objects["sun"].rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()

# headlights for moving cars at night: two spots per car is costly; one forward spot per car near the site
if NIGHT:
    for e, z, direction, *_ in MOVING:
        l = add_light("head", "SPOT", (0, 0, 0), 900, (1.0, 0.93, 0.8), 0.15, None, (math.radians(55), 0.4))
        l.parent = e
        l.location = (2.6, 0, 0.7)
        l.rotation_euler = (0, math.radians(90 + 6), 0)
        e["light"] = l.name
        tl = add_light("tail", "POINT", (0, 0, 0), 20, (1.0, 0.1, 0.06), 0.2)
        tl.parent = e
        tl.location = (-2.6, 0, 0.75)

# ───────── camera & render settings ─────────
cam_d = bpy.data.cameras.new("cam")
cam_d.lens = 32
cam_d.sensor_width = 36
cam_d.clip_start = 1
cam_d.clip_end = 6000
cam = bpy.data.objects.new("cam", cam_d)
COLL.objects.link(cam)
scene.camera = cam
TARGET = Vector(B(0, 5, 0))
ORBIT_R, ORBIT_H = 225.0, 78.0


def place_camera(frame, total):
    # frame 0 looks at the park from the road (south-west), turning clockwise when seen from above
    a = math.radians(-112) - frame / total * TAU
    pos = TARGET + Vector((math.cos(a) * ORBIT_R, math.sin(a) * ORBIT_R, ORBIT_H))
    cam.location = pos
    cam.rotation_euler = (TARGET + Vector((0, 0, 22)) - pos).to_track_quat("-Z", "Y").to_euler()


r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = RES
r.resolution_percentage = 100
r.film_transparent = False
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.image_settings.color_depth = "8"
if args.threads:
    r.threads_mode = "FIXED"
    r.threads = args.threads
cy = scene.cycles
cy.device = "CPU"
cy.samples = args.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"
cy.seed = 7  # fixed noise pattern: static parts stay identical between frames (no shimmer in loops)
cy.max_bounces = 6
cy.diffuse_bounces = 3
cy.glossy_bounces = 3
cy.transparent_max_bounces = 12
cy.transmission_bounces = 2
cy.caustics_reflective = cy.caustics_refractive = False
cy.blur_glossy = 1.0
cy.sample_clamp_indirect = 8.0
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast" if not NIGHT else "AgX - Base Contrast"
scene.view_settings.exposure = -0.35 if not NIGHT else 1.0
r.use_persistent_data = True

# aerial haze from the mist pass
vl = scene.view_layers[0]
vl.use_pass_mist = True
world.mist_settings.start = 350
world.mist_settings.depth = 2600
world.mist_settings.falloff = "QUADRATIC"
scene.use_nodes = True
ct = scene.node_tree
ct.nodes.clear()
rl = ct.nodes.new("CompositorNodeRLayers")
comp = ct.nodes.new("CompositorNodeComposite")
mix = ct.nodes.new("CompositorNodeMixRGB")
mix.blend_type = "MIX"
mix.inputs[2].default_value = (0.80, 0.75, 0.67, 1) if not NIGHT else (0.012, 0.016, 0.03, 1)
mul = ct.nodes.new("CompositorNodeMath")
mul.operation = "MULTIPLY"
mul.inputs[1].default_value = 0.28 if not NIGHT else 0.7
ct.links.new(rl.outputs["Mist"], mul.inputs[0])
ct.links.new(mul.outputs[0], mix.inputs[0])
ct.links.new(rl.outputs["Image"], mix.inputs[1])
glare = ct.nodes.new("CompositorNodeGlare")
glare.glare_type = "FOG_GLOW"
glare.quality = "MEDIUM"
glare.threshold = 1.0 if not NIGHT else 0.8
glare.size = 7
ct.links.new(mix.outputs[0], glare.inputs[0])
ct.links.new(glare.outputs[0], comp.inputs[0])

if args.blend:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))

os.makedirs(args.out, exist_ok=True)


def frames_list(spec, total):
    if not spec:
        return list(range(total))
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out += list(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


if args.loop:
    place_camera(args.at, args.orbit)
    todo = frames_list(args.frames, args.loop)
    for i in todo:
        path = os.path.join(args.out, f"l{args.at:03d}_{i:03d}.png")
        if os.path.exists(path):
            continue
        set_traffic(i / args.loop)
        r.filepath = path
        bpy.ops.render.render(write_still=True)
        print("wrote", path, flush=True)
else:
    for i in frames_list(args.frames, args.orbit):
        path = os.path.join(args.out, f"f{i:03d}.png")
        if os.path.exists(path):
            continue
        place_camera(i, args.orbit)
        set_traffic((i * 3 / args.orbit) % 1.0)  # three spacings per turn: cars drive on as you rotate
        r.filepath = path
        bpy.ops.render.render(write_still=True)
        print("wrote", path, flush=True)
