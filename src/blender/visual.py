"""Retail Park, Sharjah: step 3, the visualisation (used by massing.py, `--look visual`).

Dresses the accurate massing in the finishes of the Retail Park material schedule (MATERIAL SHEETS - RETAIL PARK):
  facade   GL reflective double glazing, AL-01 aluminium framing (mullions 50 x 100), AL-02 aluminium entrance canopies,
           PT01 Jotashield "Rusty 1259", PT02 "Dark Stone 7687", PT03 "Lotus 1108" (textured matte paints),
           TC01 terracotta cladding (staggered terracotta panels, the pavilion's upper band), LED signage and screen,
           aluminium copings and C-channel parapet bands (elevation legend, sheets A-200 to A-202);
  ground   TC02 terracotta tiles 60 x 240 on the lower ground (sunken court and plaza), CC01 warm terracotta concrete
           on the seating terraces, ITN01 grey concrete interlock on the upper ground, RP01 red EPDM on the trail through
           the rear landscape (red as in the project's own renders; RP02 blue is the schedule's other track finish),
           SHD01 multi-coloured tinted shade fabric over the market court ("Pazar area").
How the facades are laid out follows the elevations: shopfronts in curtain walls between Lotus piers with Rusty portal
frames and LED signage on the spine (A1, A2), the Games hall's fluted Rusty walls under a dark band with the GAMES and
RETAIL PARK signs, the pavilion's glass ground floor under the terracotta band (C1, C2), food trucks on the promenade.
Trees stand on the tree pits drawn on the plan; the planters are planted; no cars. Golden-hour light.
Everything is built from code: no downloaded models or textures.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Vector

TAU = math.tau
V5 = bpy.app.version >= (5, 0, 0)
rnd = random.Random(20261017)


def B(x, z, y=0.0):
    return (x, -z, y)


def lin(rgb):
    """sRGB 0-255 -> linear RGBA."""
    c = [v / 255 for v in rgb]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


# material schedule colours (sRGB, read from the sheet's swatches)
PT01, PT02, PT03 = (165, 114, 82), (86, 87, 83), (228, 221, 202)
TC02, CC01, ITN01 = (150, 108, 92), (148, 113, 99), (96, 88, 90)
RP01, RP02 = (127, 72, 67), (65, 97, 130)
AL = (44, 45, 47)
SAIL_COLOURS = [(181, 98, 60), (208, 160, 60), (111, 122, 60), (47, 111, 115), (226, 206, 170), (141, 58, 44), (234, 226, 210)]


# ───────── node helpers ─────────
def new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt, nt.nodes.new("ShaderNodeOutputMaterial")


def nd(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items():
        if k.startswith("_"):
            setattr(n, k[1:], v)
        else:
            n.inputs[k.replace("_", " ")].default_value = v
    return n


def L(nt, a, b):
    nt.links.new(a, b)


def mathn(nt, op, a, b=None, c=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            L(nt, v, n.inputs[i])
    return n.outputs[0]


def mix(nt, fac, a, b, blend="MIX"):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, tuple):
            sock.default_value = v
        else:
            L(nt, v, sock)
    return m.outputs[2]


def mixf(nt, fac, a, b):
    m = nt.nodes.new("ShaderNodeMix")
    m.data_type = "FLOAT"
    for sock, v in ((m.inputs[0], fac), (m.inputs[2], a), (m.inputs[3], b)):
        if isinstance(v, (int, float)):
            sock.default_value = v
        else:
            L(nt, v, sock)
    return m.outputs[0]


def ramp(nt, fac, stops):
    r = nt.nodes.new("ShaderNodeValToRGB")
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], lin(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], lin(stops[-1][1])
    for p, c in stops[1:-1]:
        e = els.new(p)
        e.color = lin(c)
    L(nt, fac, r.inputs["Fac"])
    return r.outputs["Color"]


def obj_coords(nt):
    return nd(nt, "ShaderNodeTexCoord").outputs["Object"]  # static geometry sits at the origin: object = world


def noise(nt, v, scale, detail=4.0, rough=0.55):
    n = nd(nt, "ShaderNodeTexNoise", Scale=scale, Detail=detail, Roughness=rough)
    L(nt, v, n.inputs["Vector"])
    return n


def bump(nt, height, strength, dist=0.02, normal=None):
    b = nd(nt, "ShaderNodeBump", Strength=strength, Distance=dist)
    L(nt, height, b.inputs["Height"])
    if normal is not None:
        L(nt, normal, b.inputs["Normal"])
    return b.outputs["Normal"]


def bsdf(nt, out, color, rough=0.8, metal=0.0, normal=None, **kw):
    p = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=rough, Metallic=metal)
    if isinstance(color, tuple):
        p.inputs["Base Color"].default_value = color
    else:
        L(nt, color, p.inputs["Base Color"])
    if normal is not None:
        L(nt, normal, p.inputs["Normal"])
    for k, v in kw.items():
        key = k.replace("_", " ")
        if isinstance(v, (int, float, tuple)):
            p.inputs[key].default_value = v
        else:
            L(nt, v, p.inputs[key])
    L(nt, p.outputs[0], out.inputs["Surface"])
    return p


# ───────── materials ─────────
M = {}


def paint(name, rgb, var=0.06, texture=0.08, rough=0.86):
    """Jotashield textured exterior paint: fine sand texture, a slight cloudiness."""
    m, nt, out = new_mat(name)
    v = obj_coords(nt)
    cloud = noise(nt, v, 0.35, 4)
    lo = tuple(max(0, c * (1 - var)) for c in rgb)
    hi = tuple(min(255, c * (1 + var)) for c in rgb)
    col = ramp(nt, cloud.outputs["Fac"], [(0.3, lo), (0.5, rgb), (0.7, hi)])
    grain = noise(nt, v, 90.0, 2, 0.6)
    bsdf(nt, out, col, rough, normal=bump(nt, grain.outputs["Fac"], texture, 0.004))
    m.diffuse_color = lin(rgb)
    M[name] = m
    return m


def plain(name, rgb, rough=0.6, metal=0.0, coat=0.0):
    m, nt, out = new_mat(name)
    p = bsdf(nt, out, lin(rgb), rough, metal)
    if coat:
        p.inputs["Coat Weight"].default_value = coat
    m.diffuse_color = lin(rgb)
    M[name] = m
    return m


def emit(name, rgb, strength):
    m, nt, out = new_mat(name)
    e = nd(nt, "ShaderNodeEmission", Strength=strength)
    e.inputs["Color"].default_value = lin(rgb)
    L(nt, e.outputs[0], out.inputs["Surface"])
    M[name] = m
    return m


def tiles(name, base, size, row, var, mortar, rough=0.85, herring=False):
    """Paving in a running-bond pattern: brick texture in object space, per-unit tone variation."""
    m, nt, out = new_mat(name)
    v = obj_coords(nt)
    br = nd(nt, "ShaderNodeTexBrick", Scale=1.0, Mortar_Size=0.006 * size / 0.24, Bias=0.0,
            Brick_Width=size, Row_Height=row, _offset=0.5)
    br.offset_frequency = 2
    lo = tuple(max(0, c * (1 - var)) for c in base)
    hi = tuple(min(255, c * (1 + var)) for c in base)
    br.inputs["Color1"].default_value = lin(lo)
    br.inputs["Color2"].default_value = lin(hi)
    br.inputs["Mortar"].default_value = lin(mortar)
    L(nt, v, br.inputs["Vector"])
    big = noise(nt, v, 0.15, 3)
    col = mix(nt, 0.25, br.outputs["Color"], big.outputs["Color"], "OVERLAY")
    bsdf(nt, out, col, rough, normal=bump(nt, br.outputs["Fac"], 0.35, 0.006))
    m.diffuse_color = lin(base)
    M[name] = m
    return m


def build_materials():
    paint("PT01_rusty", PT01)
    paint("PT02_dark_stone", PT02, var=0.04)
    paint("PT03_lotus", PT03, var=0.03)
    plain("AL_framing", AL, 0.35, 0.75)
    plain("coping", (58, 59, 61), 0.4, 0.6)
    plain("roof_membrane", (178, 176, 172), 0.92)
    plain("roof_dark", (86, 86, 88), 0.9)
    plain("roof_units", (176, 178, 178), 0.45, 0.3)
    plain("louvre", (92, 94, 96), 0.5, 0.5)
    plain("door_dark", (38, 38, 40), 0.4, 0.4)
    plain("mast", (238, 238, 234), 0.35, 0.3)
    plain("concrete", (178, 172, 162), 0.85)
    plain("rail", (52, 53, 55), 0.35, 0.7)
    plain("pod_pink", (217, 154, 173), 0.28, coat=0.8)
    plain("pod_white", (241, 239, 234), 0.28, coat=0.8)
    plain("pod_glass", (12, 14, 16), 0.04, coat=1.0)
    plain("awning", (245, 243, 238), 0.7)
    emit("led_sign", (255, 244, 226), 6.0)
    m, nt, out = new_mat("led_panel")
    mg = nd(nt, "ShaderNodeTexMagic", Scale=0.35, Distortion=1.6, _turbulence_depth=3)
    L(nt, obj_coords(nt), mg.inputs["Vector"])
    e = nd(nt, "ShaderNodeEmission", Strength=1.6)
    L(nt, ramp(nt, mg.outputs["Fac"], [(0.0, (30, 20, 40)), (0.4, (200, 90, 60)), (0.7, (240, 190, 120)), (1.0, (90, 150, 190))]), e.inputs["Color"])
    L(nt, e.outputs[0], out.inputs["Surface"])
    M["led_panel"] = m
    plain("sign_board", (30, 30, 32), 0.5, 0.3)

    # Games hall: Rusty paint on vertically fluted panels
    m, nt, out = new_mat("PT01_flutes")
    v = obj_coords(nt)
    sep = nd(nt, "ShaderNodeSeparateXYZ")
    L(nt, v, sep.inputs[0])
    along = mathn(nt, "ADD", sep.outputs["X"], sep.outputs["Y"])
    flutes = mathn(nt, "SINE", mathn(nt, "MULTIPLY", along, TAU / 0.3))
    cloud = noise(nt, v, 0.3, 4)
    col = ramp(nt, cloud.outputs["Fac"], [(0.3, (150, 102, 72)), (0.5, PT01), (0.7, (178, 126, 92))])
    grain = noise(nt, v, 90.0, 2)
    nrm = bump(nt, grain.outputs["Fac"], 0.06, 0.004)
    bsdf(nt, out, col, 0.82, normal=bump(nt, flutes, 0.45, 0.03, nrm))
    m.diffuse_color = lin(PT01)
    M["PT01_flutes"] = m

    # GL: reflective double glazing over a warm-lit interior
    m, nt, out = new_mat("GL_glass")
    v = obj_coords(nt)
    n = noise(nt, v, 0.25, 3, 0.5)
    lit = ramp(nt, n.outputs["Fac"], [(0.35, (16, 13, 11)), (0.55, (120, 86, 52)), (0.7, (255, 206, 140))])
    g = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.03, Metallic=0.15, IOR=1.52)
    g.inputs["Base Color"].default_value = lin((52, 64, 66))
    g.inputs["Coat Weight"].default_value = 1.0
    g.inputs["Emission Strength"].default_value = 0.45
    L(nt, lit, g.inputs["Emission Color"])
    L(nt, g.outputs[0], out.inputs["Surface"])
    m.diffuse_color = lin((52, 64, 66))
    M["GL_glass"] = m

    # TC01 terracotta panels: per-panel tone from object-space cells
    m, nt, out = new_mat("TC01_terracotta")
    v = obj_coords(nt)
    vor = nd(nt, "ShaderNodeTexVoronoi", Scale=1.6)
    L(nt, v, vor.inputs["Vector"])
    sep = nd(nt, "ShaderNodeSeparateColor")
    L(nt, vor.outputs["Color"], sep.inputs[0])
    col = ramp(nt, sep.outputs[0], [(0.0, (176, 92, 62)), (0.35, (204, 118, 80)), (0.7, (224, 146, 104)), (1.0, (196, 108, 72))])
    grain = noise(nt, v, 40.0, 3)
    bsdf(nt, out, col, 0.8, normal=bump(nt, grain.outputs["Fac"], 0.15, 0.004))
    m.diffuse_color = lin((204, 118, 80))
    M["TC01_terracotta"] = m

    # lower-ground and seating paving, upper-ground interlock
    tiles("TC02_tiles", TC02, 0.24, 0.06, 0.1, (110, 86, 76))
    tiles("ITN01_interlock", ITN01, 0.2, 0.1, 0.12, (70, 66, 66))
    m, nt, out = new_mat("CC01_concrete")
    v = obj_coords(nt)
    n = noise(nt, v, 0.6, 5)
    col = ramp(nt, n.outputs["Fac"], [(0.3, (136, 102, 88)), (0.5, CC01), (0.7, (162, 126, 110))])
    grain = noise(nt, v, 60.0, 2)
    bsdf(nt, out, col, 0.9, normal=bump(nt, grain.outputs["Fac"], 0.12, 0.003))
    M["CC01_concrete"] = m

    # SHD01 shade fabric: tinted, translucent in the sun
    for i, c in enumerate(SAIL_COLOURS):
        m, nt, out = new_mat(f"SHD01_fabric_{i}")
        p = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.75)
        p.inputs["Base Color"].default_value = lin(c)
        tr = nd(nt, "ShaderNodeBsdfTranslucent")
        tr.inputs["Color"].default_value = lin(tuple(min(255, int(v * 1.1)) for v in c))
        ms = nd(nt, "ShaderNodeMixShader", Fac=0.35)
        L(nt, p.outputs[0], ms.inputs[1])
        L(nt, tr.outputs[0], ms.inputs[2])
        L(nt, ms.outputs[0], out.inputs["Surface"])
        m.diffuse_color = lin(c)
        M[f"SHD01_fabric_{i}"] = m

    # timber for the market stalls
    m, nt, out = new_mat("timber")
    v = obj_coords(nt)
    wv = nd(nt, "ShaderNodeTexWave", Scale=8.0, Distortion=2.0, Detail=4.0)
    L(nt, v, wv.inputs["Vector"])
    bsdf(nt, out, ramp(nt, wv.outputs["Fac"], [(0.0, (150, 104, 66)), (0.6, (196, 150, 104)), (1.0, (172, 126, 84))]), 0.6)
    M["timber"] = m

    # vegetation
    leaf_img = leaf_atlas()
    for name, tints in (("leaf", [(47, 74, 30), (70, 102, 42), (98, 130, 58), (58, 88, 36)]),
                        ("leaf_olive", [(95, 106, 72), (124, 134, 98), (143, 150, 114), (106, 116, 82)]),
                        ("leaf_shrub", [(52, 80, 36), (78, 110, 48), (110, 128, 62), (64, 96, 42)]),
                        ("leaf_flower", [(79, 95, 43), (199, 111, 140), (224, 184, 90), (98, 114, 47)])):
        m, nt, out = new_mat(name)
        tex = nd(nt, "ShaderNodeTexImage")
        tex.image = leaf_img
        oi = nd(nt, "ShaderNodeObjectInfo")
        v = obj_coords(nt)
        n = noise(nt, v, 0.9, 2)
        fr = mathn(nt, "FRACT", mathn(nt, "ADD", oi.outputs["Random"], n.outputs["Fac"]))
        col = ramp(nt, fr, [(0.0, tints[0]), (0.35, tints[1]), (0.7, tints[2]), (1.0, tints[3])])
        col = mix(nt, 0.6, col, tex.outputs["Color"], "MULTIPLY")
        d = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.6)
        L(nt, col, d.inputs["Base Color"])
        tr = nd(nt, "ShaderNodeBsdfTranslucent")
        L(nt, col, tr.inputs["Color"])
        ms = nd(nt, "ShaderNodeMixShader", Fac=0.25)
        L(nt, d.outputs[0], ms.inputs[1])
        L(nt, tr.outputs[0], ms.inputs[2])
        cut = nd(nt, "ShaderNodeMixShader")
        L(nt, tex.outputs["Alpha"], cut.inputs["Fac"])
        L(nt, nd(nt, "ShaderNodeBsdfTransparent").outputs[0], cut.inputs[1])
        L(nt, ms.outputs[0], cut.inputs[2])
        L(nt, cut.outputs[0], out.inputs["Surface"])
        M[name] = m
    plain("bark", (94, 75, 60), 0.95)
    plain("grass_blades", (168, 150, 98), 0.9)
    plain("grass_green", (110, 128, 64), 0.85)
    plain("agave", (110, 136, 128), 0.7)
    paint("mulch", (92, 74, 56), var=0.15, texture=0.3, rough=1.0)


def leaf_atlas(size=512):
    """Leaf atlas drawn with numpy: overlapping elliptic leaves with a midrib, on transparent."""
    img = np.zeros((size, size, 4), np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    r = random.Random(7)
    for _ in range(46):
        cx, cy = r.uniform(60, size - 60), r.uniform(60, size - 60)
        ang = r.uniform(0, TAU)
        Ln, W = r.uniform(38, 70), r.uniform(15, 26)
        ca, sa = math.cos(ang), math.sin(ang)
        u = (xx - cx) * ca + (yy - cy) * sa
        w = -(xx - cx) * sa + (yy - cy) * ca
        t = np.clip((u + Ln) / (2 * Ln), 0, 1)
        half = W * np.maximum(np.sin(np.pi * t), 0) ** 0.8
        inside = (np.abs(w) < half) & (np.abs(u) < Ln)
        shade = 0.72 + 0.28 * r.random() - 0.18 * (np.abs(w) / (half + 1e-3))
        val = np.where(np.abs(w) < 1.2, 0.95, shade)
        for ch in range(3):
            img[..., ch] = np.where(inside, val, img[..., ch])
        img[..., 3] = np.where(inside, 1.0, img[..., 3])
    im = bpy.data.images.new("leaf_atlas", size, size, alpha=True)
    im.colorspace_settings.name = "Non-Color"
    im.pixels.foreach_set(img[::-1].ravel())
    im.pack()
    return im


def ground_material(plan, zones_path):
    """Site and desert ground in one material: the desert's own colours (the `ground` attribute) outside the plan
    sheet; inside it, the surface classes of site_zones.png in their scheduled finishes, with the drawn lines as road
    markings on asphalt and as joints and kerbs elsewhere; the sheet fades into the desert over its last 12 m."""
    import environment
    m, nt, out = new_mat("site_and_desert_ground")
    gi = plan["ground_image"]
    (gx0, gz0), (gx1, gz1) = gi["min"], gi["max"]
    W, H = gx1 - gx0, gz1 - gz0
    v = obj_coords(nt)
    sep = nd(nt, "ShaderNodeSeparateXYZ")
    L(nt, v, sep.inputs[0])
    u = mathn(nt, "MULTIPLY_ADD", sep.outputs["X"], 1 / W, -gx0 / W)
    vv = mathn(nt, "MULTIPLY_ADD", sep.outputs["Y"], 1 / H, gz1 / H)
    uv = nd(nt, "ShaderNodeCombineXYZ")
    L(nt, u, uv.inputs[0])
    L(nt, vv, uv.inputs[1])
    zt = nd(nt, "ShaderNodeTexImage", _interpolation="Closest", _extension="CLIP")
    zt.image = bpy.data.images.load(zones_path)
    zt.image.colorspace_settings.name = "Non-Color"
    L(nt, uv.outputs[0], zt.inputs["Vector"])
    zs = nd(nt, "ShaderNodeSeparateColor")
    L(nt, zt.outputs["Color"], zs.inputs[0])
    cls = mathn(nt, "ROUND", mathn(nt, "MULTIPLY", zs.outputs[0], 255 / plan["ground_surfaces"].get("scale", 40)))
    line = zs.outputs[1]
    # fade over the sheet's last 12 m
    edge = mathn(nt, "MINIMUM", mathn(nt, "MINIMUM", mathn(nt, "MULTIPLY", u, W), mathn(nt, "MULTIPLY", mathn(nt, "SUBTRACT", 1.0, u), W)),
                 mathn(nt, "MINIMUM", mathn(nt, "MULTIPLY", vv, H), mathn(nt, "MULTIPLY", mathn(nt, "SUBTRACT", 1.0, vv), H)))
    fade = mathn(nt, "MINIMUM", mathn(nt, "MAXIMUM", mathn(nt, "DIVIDE", edge, 12.0), 0.0), 1.0)

    def is_(k):
        return mathn(nt, "MULTIPLY", mathn(nt, "COMPARE", cls, float(k), 0.5), fade)

    # the desert outside: its colours with fine gravel speckle and mottling (as environment.terrain_material)
    attr = nd(nt, "ShaderNodeAttribute", _attribute_name="ground")
    vor = nd(nt, "ShaderNodeTexVoronoi", Scale=5.0)
    L(nt, v, vor.inputs["Vector"])
    mot = noise(nt, v, 0.05, 4)
    var = mathn(nt, "MULTIPLY", mathn(nt, "MULTIPLY_ADD", vor.outputs["Distance"], 0.35, 0.8), mathn(nt, "MULTIPLY_ADD", mot.outputs["Fac"], 0.5, 0.75))
    vc = nd(nt, "ShaderNodeCombineColor")
    for i in range(3):
        L(nt, var, vc.inputs[i])
    col = mix(nt, 1.0, attr.outputs["Color"], vc.outputs[0], "MULTIPLY")
    height = mathn(nt, "MULTIPLY", vor.outputs["Distance"], 1.0)
    cl = environment
    # asphalt: aggregate with tyre wear; markings in white paint
    n1 = noise(nt, v, 0.08, 4)
    asphalt = ramp(nt, n1.outputs["Fac"], [(0.35, (58, 57, 55)), (0.5, (72, 70, 68)), (0.7, (84, 82, 78))])
    asphalt = mix(nt, line, asphalt, lin((226, 226, 218)))
    # upper-ground interlock (ITN01) for paving and pavers, joints darker
    br = nd(nt, "ShaderNodeTexBrick", Scale=1.0, Mortar_Size=0.006, Brick_Width=0.2, Row_Height=0.1, _offset=0.5)
    br.inputs["Color1"].default_value = lin((100, 92, 94))
    br.inputs["Color2"].default_value = lin((124, 116, 116))
    br.inputs["Mortar"].default_value = lin((70, 66, 66))
    L(nt, v, br.inputs["Vector"])
    paving = mix(nt, line, br.outputs["Color"], lin((176, 170, 160)))
    pavers = mix(nt, 0.35, paving, lin((80, 74, 74)), "MULTIPLY")
    sand = mix(nt, line, mix(nt, 1.0, lin(cl.SAND), vc.outputs[0], "MULTIPLY"), lin((178, 160, 128)))
    mulch_n = noise(nt, v, 3.0, 4)
    planting = ramp(nt, mulch_n.outputs["Fac"], [(0.3, (70, 56, 42)), (0.7, (104, 84, 62))])
    epdm = nd(nt, "ShaderNodeTexNoise", Scale=180.0, Detail=1.0)
    L(nt, v, epdm.inputs["Vector"])
    track = mix(nt, 0.2, lin(RP01), epdm.outputs["Color"], "OVERLAY")
    # landscape beds (the sand inside the site boundary): drifts of low green ground cover on warm earth
    cover = noise(nt, v, 0.35, 5, 0.6)
    fine = noise(nt, v, 6.0, 3)
    earth = ramp(nt, fine.outputs["Fac"], [(0.3, (150, 126, 94)), (0.7, (176, 150, 112))])
    green = ramp(nt, fine.outputs["Fac"], [(0.3, (70, 88, 38)), (0.55, (96, 112, 52)), (0.8, (124, 130, 70))])
    cmask = mathn(nt, "SMOOTH_MIN", mathn(nt, "MULTIPLY", mathn(nt, "SUBTRACT", cover.outputs["Fac"], 0.42), 8.0), 1.0, 0.2)
    beds = mix(nt, mathn(nt, "MAXIMUM", cmask, 0.0), earth, green)
    for k, c in ((1, asphalt), (2, paving), (3, pavers), (4, sand), (5, planting), (6, track), (7, beds)):
        col = mix(nt, is_(k), col, c)
    p = nd(nt, "ShaderNodeBsdfPrincipled", Roughness=0.9)
    L(nt, col, p.inputs["Base Color"])
    rough = mixf(nt, mathn(nt, "ADD", is_(1), is_(6)), 0.95, 0.8)  # asphalt and EPDM a little smoother
    L(nt, rough, p.inputs["Roughness"])
    hgt = mixf(nt, mathn(nt, "ADD", is_(2), is_(3)), height, br.outputs["Fac"])
    L(nt, bump(nt, hgt, 0.25, 0.01), p.inputs["Normal"])
    L(nt, p.outputs[0], out.inputs["Surface"])
    m.diffuse_color = lin(cl.SAND)
    return m


# ───────── geometry accumulation: generated pieces merged per material ─────────
class Acc:
    def __init__(self):
        self.parts = {}

    def get(self, mat):
        return self.parts.setdefault(mat, ([], []))

    def quad_box(self, mat, corners_bottom, y0, y1):
        """Prism over a plan quad (4 (x, z) corners) from y0 to y1."""
        V, F = self.get(mat)
        o = len(V)
        for y in (y0, y1):
            for x, z in corners_bottom:
                V.append(B(x, z, y))
        F += [(o, o + 3, o + 2, o + 1), (o + 4, o + 5, o + 6, o + 7)]
        for i in range(4):
            j = (i + 1) % 4
            F.append((o + i, o + j, o + 4 + j, o + 4 + i))

    def flush(self, coll, name):
        obs = []
        for mat, (V, F) in self.parts.items():
            if not F:
                continue
            me = bpy.data.meshes.new(f"{name}_{mat}")
            me.from_pydata(V, [], F)
            me.validate()
            me.update()
            me.materials.append(M[mat])
            ob = bpy.data.objects.new(f"{name}_{mat}", me)
            coll.objects.link(ob)
            obs.append(ob)
        self.parts = {}
        return obs


ACC = Acc()


class Wall:
    """One straight wall of a footprint: a = start, t = unit direction, n = outward normal, length."""

    def __init__(self, a, b, poly):
        self.a, self.b = np.array(a, float), np.array(b, float)
        d = self.b - self.a
        self.length = float(np.linalg.norm(d))
        self.t = d / max(self.length, 1e-9)
        n = np.array([-self.t[1], self.t[0]])
        mid = (self.a + self.b) / 2
        if inside(mid + n * 0.3, poly):
            n = -n
        self.n = n

    def at(self, s, off=0.0):
        return self.a + self.t * s + self.n * off

    def box(self, mat, s0, s1, y0, y1, off0, off1):
        """Box on the wall from s0 to s1 along it, y0 to y1 high, between off0 and off1 out from its face."""
        if s1 - s0 < 1e-3 or y1 - y0 < 1e-3:
            return
        c = [self.at(s0, off0), self.at(s1, off0), self.at(s1, off1), self.at(s0, off1)]
        ACC.quad_box(mat, [tuple(p) for p in c], y0, y1)

    def facing(self):
        """'n', 's', 'e', 'w' or 'd' (diagonal) from the outward normal (plan z points south)."""
        nx, nz = self.n
        if nz < -0.8:
            return "n"
        if nz > 0.8:
            return "s"
        if nx > 0.8:
            return "e"
        if nx < -0.8:
            return "w"
        return "d"


def inside(pt, poly):
    x, z = pt
    hit = False
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0):
            hit = not hit
    return hit


def walls_of(poly):
    return [Wall(a, b, poly) for a, b in zip(poly, poly[1:] + poly[:1]) if math.dist(a, b) > 0.05]


# ───────── facade pieces ─────────
def curtain_wall(w, s0, s1, y0, y1, bay=1.5, transoms=(), off=0.04):
    """GL glazing with AL-01 mullions (50 x 100) and frame."""
    if s1 - s0 < 0.6:
        return
    w.box("GL_glass", s0, s1, y0, y1, off, off + 0.03)
    n = max(1, round((s1 - s0) / bay))
    for k in range(n + 1):
        s = s0 + (s1 - s0) * k / n
        w.box("AL_framing", s - 0.025, s + 0.025, y0, y1, off, off + 0.12)
    for y in (y0, y1) + tuple(transoms):
        w.box("AL_framing", s0, s1, y - 0.04, y + 0.04, off, off + 0.12)


def parapet_band(w, y0, y1, mat="PT02_dark_stone", off=0.0):
    """Aluminium C-channel band at the top of the wall and the 50 mm coping (legend items 09, 10)."""
    w.box(mat, -0.02, w.length + 0.02, y0, y1, off, off + 0.12)
    w.box("coping", -0.04, w.length + 0.04, y1, y1 + 0.06, -0.3, off + 0.16)


def portal(w, s, width, y0, y1, depth=0.35, sign=True):
    """PT01 Rusty portal frame round an entrance, with an LED signage board in its head (items 04, 08)."""
    jamb = 0.55
    w.box("PT01_rusty", s - width / 2 - jamb, s - width / 2, y0, y1, 0.0, depth)
    w.box("PT01_rusty", s + width / 2, s + width / 2 + jamb, y0, y1, 0.0, depth)
    w.box("PT01_rusty", s - width / 2, s + width / 2, y1 - 1.3, y1, 0.0, depth)
    if sign:
        w.box("sign_board", s - width / 2 + 0.2, s + width / 2 - 0.2, y1 - 1.05, y1 - 0.35, depth, depth + 0.04)
        w.box("led_sign", s - width / 2 + 0.45, s + width / 2 - 0.45, y1 - 0.8, y1 - 0.6, depth + 0.04, depth + 0.06)


def canopy(w, s0, s1, y, depth=1.8):
    """AL-02 aluminium entrance canopy."""
    w.box("AL_framing", s0, s1, y, y + 0.2, 0.0, depth)


def shopfronts(w, y_ground, y_glass_top, top, module=7.6, portals=True):
    """Curtain-wall shopfronts between Lotus piers, a Rusty portal in every second bay (elevations A1, A2)."""
    n = max(1, round(w.length / module))
    mod = w.length / n
    for k in range(n):
        s0 = k * mod + 0.45
        s1 = (k + 1) * mod - 0.45
        if s1 - s0 < 1.5:
            continue
        curtain_wall(w, s0, s1, y_ground, y_glass_top, 1.55, transoms=(y_ground + 3.0,))
        if portals and k % 2 == 0 and s1 - s0 > 4:
            portal(w, (s0 + s1) / 2, 2.6, y_ground, min(top - 1.3, y_glass_top + 0.9))


def fins(w, every, y0, y1, mat="PT01_rusty", width=0.3, depth=0.45, start=1.0):
    s = start
    while s < w.length - 0.5:
        w.box(mat, s - width / 2, s + width / 2, y0, y1, 0.0, depth)
        s += every


def text_sign(txt, w, s, y, size, coll):
    """LED letters standing on a wall's face."""
    cu = bpy.data.curves.new("sign_" + txt, "FONT")
    cu.body = txt
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = 0.04
    cu.space_character = 1.15
    ob = bpy.data.objects.new("sign_" + txt, cu)
    p = w.at(s, 0.2)
    ob.location = B(p[0], p[1], y)
    nb = (w.n[0], -w.n[1])
    ob.rotation_euler = (math.pi / 2, 0, math.atan2(nb[0], -nb[1]))
    cu.materials.append(M["led_sign"])
    coll.objects.link(ob)


def roof_units(poly, top, n, seed):
    r = random.Random(seed)
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    placed = 0
    for _ in range(n * 20):
        if placed >= n:
            break
        x, z = r.uniform(min(xs) + 3, max(xs) - 3), r.uniform(min(zs) + 3, max(zs) - 3)
        if not all(inside(q, poly) for q in ((x - 2, z - 2), (x + 2, z - 2), (x + 2, z + 2), (x - 2, z + 2))):
            continue
        w_, d_ = r.choice([(2.4, 1.4), (3.2, 2.0), (1.6, 1.6), (4.0, 2.2)])
        ACC.quad_box("roof_units", [(x, z), (x + w_, z), (x + w_, z + d_), (x, z + d_)], top, top + r.uniform(0.9, 1.6))
        placed += 1


# ───────── per-building dress ─────────
def dress_buildings(ctx):
    G = ctx["ground_at"]
    for ob, b in ctx["buildings"]:
        kind, poly = b["kind"], [tuple(p) for p in b["pts"]]
        bottom, top = ctx["levels"][kind]
        walls = walls_of(poly)
        wall_mat, roof_mat = "PT03_lotus", "roof_membrane"
        if kind == "spine":
            for w in walls:
                f = w.facing()
                if f == "n" and w.length > 6:
                    shopfronts(w, 0.0, 4.4, top)
                    parapet_band(w, top - 0.6, top)
                elif f == "s":                       # above the corridor roof: dark stone
                    w.box("PT02_dark_stone", -0.02, w.length + 0.02, 2.6, top - 0.6, 0.0, 0.05)
                    parapet_band(w, top - 0.6, top)
                else:
                    parapet_band(w, top - 0.6, top)
            roof_units(poly, top - 1.45, max(2, int(len(poly) * 0.6)), sum(map(ord, b["id"])))
            roof_mat = "roof_dark"
        elif kind == "corridor":
            wall_mat, roof_mat = "PT02_dark_stone", "roof_dark"
            for w in walls:
                if w.facing() in ("s", "e", "w") and w.length > 2:
                    curtain_wall(w, 0.3, w.length - 0.3, bottom, top - 0.35, 1.5, transoms=(bottom + 2.4,))
                w.box("PT02_dark_stone", -0.02, w.length + 0.02, top - 0.35, top, 0.0, 0.14)
        elif kind == "west_wing":              # Rusty walls, anthracite reveals, as the project renders
            wall_mat, roof_mat = "PT01_rusty", "roof_dark"
            for w in walls:
                f = w.facing()
                if f == "e" and w.length > 6:        # onto the sunken market court
                    shopfronts(w, bottom, 2.9, top)
                    w.box("PT01_rusty", -0.02, w.length + 0.02, 3.4, 3.8, 0.0, 0.12)
                elif f == "w":                       # onto the west strip: Rusty fins on Lotus
                    fins(w, 3.2, 0.0, top - 0.6, "AL_framing", 0.22, 0.35)
                    for s in np.arange(2.0, w.length - 3, 9.6):
                        curtain_wall(w, s, s + 3.0, 0.8, 4.2, 1.5)
                elif f == "d" and w.n[0] < 0 and w.length > 8:   # the knuckle's south-west face: the LED screen (item 11)
                    w.box("sign_board", w.length / 2 - 3.4, w.length / 2 + 3.4, 1.0, top - 0.7, 0.0, 0.18)
                    w.box("led_panel", w.length / 2 - 3.1, w.length / 2 + 3.1, 1.3, top - 1.0, 0.18, 0.2)
                elif f == "d" and w.length > 6:      # the lobby faces: curtain panels
                    curtain_wall(w, 0.6, w.length - 0.6, 0.0, 4.6, 1.5, transoms=(3.0,))
                parapet_band(w, top - 0.6, top)
            n = len(poly)
            hx = sum(p[0] for p in poly) / n
            ACC.quad_box("PT02_dark_stone", [(hx - 3, -0.5 + 4), (hx + 1, 3.5), (hx + 1, 9.0), (hx - 3, 9.0)], top, 7.65)  # head room
            roof_units(poly, top - 1.45, 4, 11)
        elif kind == "court_room":
            wall_mat = "PT01_rusty"
            for w in walls:
                if w.facing() == "e":
                    curtain_wall(w, 0.6, w.length - 0.6, bottom + 0.9, bottom + 2.2, 1.2)
                parapet_band(w, top - 0.3, top)
        elif kind == "games_hall":
            wall_mat = "PT01_flutes"
            for w in walls:
                f = w.facing()
                w.box("PT02_dark_stone", -0.05, w.length + 0.05, 6.0, top, 0.0, 0.18)  # the dark top band
                w.box("coping", -0.08, w.length + 0.08, top, top + 0.06, -0.3, 0.22)
                if f == "s":                         # main entrance onto the promenade: glass, canopy, RETAIL PARK
                    curtain_wall(w, 0.8, min(w.length * 0.55, 15.0), 0.0, 5.6, 1.6, transoms=(3.3,))
                    canopy(w, 2.0, 9.0, 3.3, 2.2)
                    text_sign("RETAIL PARK", w, w.length * 0.3, 6.6, 0.85, ctx["coll"])
                elif f == "d":                       # the slanted face onto the plaza: tall glazing, GAMES
                    curtain_wall(w, w.length * 0.08, w.length * 0.42, -1.95, 5.6, 1.8, transoms=(1.6, 3.6))
                    curtain_wall(w, w.length * 0.62, w.length * 0.92, -0.6, 5.6, 1.8, transoms=(3.6,))
                    text_sign("GAMES", w, w.length * 0.52, 6.6, 0.9, ctx["coll"])
                elif f == "w":                       # onto the market court
                    curtain_wall(w, 3.0, w.length - 6.0, bottom, 2.8, 1.6)
            roof_units(poly, 6.0, 6, 31)
        elif kind == "pavilion":
            wall_mat = "PT02_dark_stone"
            dress_pavilion(poly, top)
        elif kind == "west_pavilion":
            for w in walls:
                if w.facing() == "s":                # pump room and LV room: louvred doors (elevation C1)
                    for s in (w.length * 0.2, w.length * 0.55):
                        w.box("louvre", s, s + 3.6, 0.0, 2.8, 0.0, 0.06)
                        for y in np.arange(0.15, 2.8, 0.18):
                            w.box("AL_framing", s, s + 3.6, y, y + 0.05, 0.06, 0.12)
                parapet_band(w, top - 0.35, top)
        elif kind == "wc":
            for w in walls:
                w.box("PT01_rusty", -0.02, w.length + 0.02, 2.4, 2.9, 0.0, 0.08)
                if w.facing() in ("n", "s"):
                    w.box("door_dark", w.length / 2 - 0.6, w.length / 2 + 0.6, 0.0, 2.2, 0.0, 0.05)
                parapet_band(w, top - 0.3, top)
        set_materials(ob, wall_mat, roof_mat)
    for ob in ctx["passages"]:
        set_materials(ob, "PT03_lotus", "roof_dark")


def dress_pavilion(poly, top):
    """Glass ground floor (+0.45 to +3.7) under the TC01 terracotta band (+3.9 to +7.2): staggered, tilted panels on a
    dark backing, as on the schedule's TC01 photo; dark soffit and coping (elevation C2)."""
    ring = np.array(poly, float)
    cen = ring.mean(0)
    walls = walls_of(poly)
    for w in walls:
        if w.length > 1.2:
            curtain_wall(w, 0.15, w.length - 0.15, 0.45, 3.7, 1.6, transoms=(2.9,))
        w.box("PT02_dark_stone", -0.02, w.length + 0.02, 3.7, 3.95, -0.1, 0.45)  # soffit band
        w.box("PT02_dark_stone", -0.02, w.length + 0.02, 3.95, top - 0.2, 0.0, 0.05)  # backing wall
    # terracotta panels: rows round the outline, offset 0.35 m out, alternate rows shifted by half a panel
    pts, per = [], []
    loop = list(ring) + [ring[0]]
    seg = [(np.array(a), np.array(b)) for a, b in zip(loop, loop[1:])]
    lengths = [float(np.linalg.norm(b - a)) for a, b in seg]
    perim = sum(lengths)
    pitch = perim / round(perim / 0.62)
    rows = np.arange(4.0, top - 0.35, 0.34)
    for r_i, y in enumerate(rows):
        d = (r_i % 2) * pitch / 2
        while d < perim:
            k, rest = 0, d
            while k < len(seg) - 1 and rest > lengths[k]:
                rest -= lengths[k]
                k += 1
            a, b = seg[k]
            t = (b - a) / max(lengths[k], 1e-9)
            n = np.array([-t[1], t[0]])
            p = a + t * rest
            if inside(tuple(p + n * 0.3), poly):
                n = -n
            p = p + n * 0.38
            w_, h_ = 0.48, 0.26
            tilt = 0.12 if r_i % 2 else -0.08  # panels lean in and out, as in the photo
            c = [p - t * w_ / 2, p + t * w_ / 2, p + t * w_ / 2 + n * 0.03, p - t * w_ / 2 + n * 0.03]
            V, F = ACC.get("TC01_terracotta")
            o = len(V)
            for yy, lean in ((y, 0.0), (y + h_, tilt)):
                for q in c:
                    q2 = q + n * lean
                    V.append(B(q2[0], q2[1], yy))
            F += [(o, o + 3, o + 2, o + 1), (o + 4, o + 5, o + 6, o + 7)]
            for i in range(4):
                j = (i + 1) % 4
                F.append((o + i, o + j, o + 4 + j, o + 4 + i))
            d += pitch
    for w in walls:
        w.box("coping", -0.05, w.length + 0.05, top - 0.2, top + 0.05, -0.2, 0.55)
    roof_units(poly, top - 0.6, 4, 41)


def set_materials(ob, wall, roof):
    me = ob.data
    me.materials.clear()
    me.materials.append(M[wall])
    me.materials.append(M[roof])
    for p in me.polygons:
        p.material_index = 1 if p.normal.z > 0.9 else 0


# ───────── vegetation prototypes (leaf-card trees and shrubs, grass tufts) ─────────
def make_object(name, verts, faces, mat, coll, uvs=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    if uvs:
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", [c for uv in uvs for c in uv])
    if smooth:
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(M[mat])
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def tube(verts, faces, a, b, r0, r1, sides=7):
    d = b - a
    axis = d.normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    w = axis.cross(u)
    o = len(verts)
    for c, r in ((a, r0), (b, r1)):
        for i in range(sides):
            t = i / sides * TAU
            verts.append(tuple(c + (u * math.cos(t) + w * math.sin(t)) * r))
    for i in range(sides):
        j = (i + 1) % sides
        faces.append((o + i, o + j, o + sides + j, o + sides + i))


def leaf_cards(verts, faces, uvs, centre, radii, count, size, rr, up_bias=0.3, shell=0.55):
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


def make_tree(name, seed, height, crown, leaves, parent, leaf_mat="leaf"):
    """Open shade tree: a trunk forking into leaning limbs, twice more, with loose leaf clumps on the twigs."""
    rr = random.Random(seed)
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    tv, tf = [], []
    s = height / 8.0
    fork = height * 0.36
    lean = Vector((rr.uniform(-0.06, 0.06), rr.uniform(-0.06, 0.06), 0)) * height
    top = Vector((lean.x, lean.y, fork))
    tube(tv, tf, Vector((0, 0, -0.2)), top, 0.18 * s, 0.12 * s, 8)
    twigs = []

    def grow(start, direction, length, radius, depth):
        end = start + direction * length
        tube(tv, tf, start, end, radius, radius * 0.62, 6 if depth == 0 else 5)
        if depth == 2:
            twigs.append((end, rr.uniform(0.75, 1.15) * s))
            if rr.random() < 0.7:
                twigs.append((start.lerp(end, rr.uniform(0.45, 0.7)), rr.uniform(0.55, 0.85) * s))
            return
        for k in range(rr.randint(2, 3)):
            spin = k / 3 * TAU + rr.uniform(-0.6, 0.6)
            side = Vector((math.cos(spin), math.sin(spin), 0))
            d = (direction * rr.uniform(0.9, 1.4) + side * rr.uniform(0.45, 0.85) + Vector((0, 0, rr.uniform(0.0, 0.35)))).normalized()
            grow(end, d, length * rr.uniform(0.55, 0.75), radius * 0.62, depth + 1)

    n_limbs = rr.randint(3, 5)
    for i in range(n_limbs):
        a = i / n_limbs * TAU + rr.uniform(-0.45, 0.45)
        d = Vector((math.cos(a) * crown / height * 1.4, math.sin(a) * crown / height * 1.4, rr.uniform(0.75, 1.15))).normalized()
        grow(top, d, height * rr.uniform(0.24, 0.32), 0.1 * s, 0)
    make_object(name + "_wood", tv, tf, "bark", coll, smooth=True)
    lv, lf, luv = [], [], []
    per = max(18, int(leaves / max(1, len(twigs))))
    for tip, r_ in twigs:
        leaf_cards(lv, lf, luv, tip + Vector((0, 0, r_ * 0.15)), (r_, r_, r_ * rr.uniform(0.55, 0.8)), per, 0.5 * s, rr, 0.45, 0.35)
    make_object(name + "_leaves", lv, lf, leaf_mat, coll, luv)
    return coll


def make_shrub(name, seed, r, leaves, leaf_mat, parent):
    rr = random.Random(seed)
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    lv, lf, luv = [], [], []
    leaf_cards(lv, lf, luv, (0, 0, r * 0.45), (r, r, r * 0.55), leaves, r * 0.55, rr, 0.6, 0.3)
    make_object(name, lv, lf, leaf_mat, coll, luv)
    return coll


def make_grass(name, seed, mat, parent, tall=0.9, blades=40):
    rr = random.Random(seed)
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    v, f = [], []
    for _ in range(blades):
        a = rr.uniform(0, TAU)
        h = rr.uniform(0.4, 1.0) * tall
        sp = h * rr.uniform(0.2, 0.55)
        bx, by = math.cos(a) * rr.random() * 0.12, math.sin(a) * rr.random() * 0.12
        wd = 0.025
        o = len(v)
        v += [(bx - math.sin(a) * wd, by + math.cos(a) * wd, 0), (bx + math.sin(a) * wd, by - math.cos(a) * wd, 0),
              (bx + math.cos(a) * sp, by + math.sin(a) * sp, h)]
        f.append((o, o + 1, o + 2))
    make_object(name, v, f, mat, coll)
    return coll


def make_agave(name, seed, parent, size=0.8):
    rr = random.Random(seed)
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    V, F = [], []
    for leaf in range(14):
        ang = leaf / 14 * TAU + rr.uniform(-0.2, 0.2)
        ln = size * rr.uniform(0.7, 1.2)
        o = len(V)
        for step in range(7):
            t = step / 6
            wdt = math.sin(math.pi * t) * ln * 0.12
            r_ = ln * t * t * 0.9
            hgt = ln * math.sin(t * math.pi / 2) * 0.8
            for side in (-1, 1):
                V.append((math.cos(ang) * r_ - math.sin(ang) * wdt * side, math.sin(ang) * r_ + math.cos(ang) * wdt * side, hgt))
        for step in range(6):
            k = o + step * 2
            F.append((k, k + 1, k + 3, k + 2))
    make_object(name, V, F, "agave", coll)
    return coll


def scatter(name, pts, coll_proto, coll):
    """Instance the children of coll_proto on pts [(x, z, y, rot, scale)], picking a child at random."""
    from environment import scatter_object
    pts = np.asarray(pts, float)
    if not len(pts):
        return None
    xyz = np.stack([pts[:, 0], -pts[:, 1], pts[:, 2]], 1)
    n = len(coll_proto.children)
    return scatter_object(name, xyz, pts[:, 3], pts[:, 4], [rnd.randrange(n) for _ in range(len(pts))], coll, coll_proto)


def points_in(poly, spacing, jitter=0.4):
    xs, zs = [p[0] for p in poly], [p[1] for p in poly]
    out = []
    for x in np.arange(min(xs) + spacing / 2, max(xs), spacing):
        for z in np.arange(min(zs) + spacing / 2, max(zs), spacing):
            q = (x + rnd.uniform(-jitter, jitter) * spacing, z + rnd.uniform(-jitter, jitter) * spacing)
            if inside(q, poly):
                out.append(q)
    return out


def landscape(ctx, proto, coll):
    """Trees on the plan's tree pits, planted planters, and the soft landscape of the site's sand areas."""
    G = ctx["ground_at"]
    tree_c = bpy.data.collections.new("shade_trees")
    olive_c = bpy.data.collections.new("olive_trees")
    shrub_c = bpy.data.collections.new("planter_shrubs")
    grass_c = bpy.data.collections.new("grasses")
    for c in (tree_c, olive_c, shrub_c, grass_c):
        proto.children.link(c)
    for i in range(4):
        make_tree(f"shade_tree_{i}", 100 + i, 7.5 + i * 0.6, 3.6 + i * 0.3, 2600, tree_c)
    for i in range(2):
        make_tree(f"olive_tree_{i}", 200 + i, 5.0 + i * 0.6, 3.0, 1600, olive_c, "leaf_olive")
    for i in range(3):
        make_shrub(f"shrub_{i}", 300 + i, 0.55 + i * 0.15, 220, "leaf_shrub", shrub_c)
    make_shrub("shrub_flower", 310, 0.5, 200, "leaf_flower", shrub_c)
    for i in range(2):
        make_grass(f"grass_{i}", 400 + i, "grass_blades", grass_c, 0.9 + 0.3 * i)
    make_grass("grass_green", 410, "grass_green", grass_c, 0.6, 60)
    make_agave("agave", 420, grass_c)

    trees = []
    for x, z in ctx["plan"]["tree_pits"]:
        trees.append((x, z, G(x, z), rnd.uniform(0, TAU), rnd.uniform(0.85, 1.15)))
    scatter("tree_pit_trees", trees, tree_c, coll)
    shrubs, grasses = [], []
    for pl, top in ctx["planters"]:
        for x, z in points_in(pl, 0.9):
            (shrubs if rnd.random() < 0.55 else grasses).append((x, z, top, rnd.uniform(0, TAU), rnd.uniform(0.7, 1.3)))
    sand = ctx["plan"].get("landscape", {})
    olives = [(x, z, 0.0, rnd.uniform(0, TAU), rnd.uniform(0.8, 1.2)) for x, z in sand.get("trees", [])]
    for x, z in sand.get("shrubs", []):
        (shrubs if rnd.random() < 0.5 else grasses).append((x, z, 0.0, rnd.uniform(0, TAU), rnd.uniform(0.7, 1.4)))
    scatter("landscape_trees", olives, olive_c, coll)
    scatter("shrubs", shrubs, shrub_c, coll)
    scatter("grasses", grasses, grass_c, coll)
    print(f"landscape: {len(trees)} pit trees, {len(olives)} landscape trees, {len(shrubs)} shrubs, {len(grasses)} grasses", flush=True)


# ───────── the market court: SHD01 sails on white masts, timber stalls ─────────
def market_court(ctx, coll):
    floor = -1.95
    x0, x1, z0, z1 = -45.0, -3.0, 7.0, 25.5
    nx, nz = 5, 3
    sx, sz = (x1 - x0) / nx, (z1 - z0) / nz
    V, F, mats = [], [], []
    for i in range(nx):
        for j in range(nz):
            cx, cz = x0 + (i + 0.5) * sx, z0 + (j + 0.5) * sz
            hi, lo = floor + 6.4, floor + 4.6
            flip = (i + j) % 2
            hs = [hi, lo, lo, hi] if flip else [lo, hi, hi, lo]
            n = 12
            o = len(V)
            cut = 0.11  # the tensioned edges curve in between the corners, by this share of the sail's size
            for b_ in range(n + 1):
                for a_ in range(n + 1):
                    s_, t_ = a_ / n - 0.5, b_ / n - 0.5
                    s_, t_ = s_ * (1 - 2 * cut * math.cos(math.pi * t_)), t_ * (1 - 2 * cut * math.cos(math.pi * s_))
                    u, v = s_ + 0.5, t_ + 0.5
                    h = hs[0] * (1 - u) * (1 - v) + hs[1] * u * (1 - v) + hs[2] * (1 - u) * v + hs[3] * u * v  # hypar
                    V.append(B(cx + s_ * (sx - 0.3), cz + t_ * (sz - 0.3), h))
            for b_ in range(n):
                for a_ in range(n):
                    k = o + b_ * (n + 1) + a_
                    F.append((k, k + 1, k + n + 2, k + n + 1))
                    mats.append((i * 3 + j * 2) % len(SAIL_COLOURS))
    me = bpy.data.meshes.new("SHD01_sails")
    me.from_pydata(V, [], F)
    for i in range(len(SAIL_COLOURS)):
        me.materials.append(M[f"SHD01_fabric_{i}"])
    me.polygons.foreach_set("material_index", mats)
    me.polygons.foreach_set("use_smooth", [True] * len(F))
    ob = bpy.data.objects.new("SHD01_sails", me)
    ob.modifiers.new("thickness", "SOLIDIFY").thickness = 0.02
    coll.objects.link(ob)
    for i in range(nx + 1):
        for j in range(nz + 1):
            x, z = x0 + i * sx, z0 + j * sz
            ACC.quad_box("mast", [(x - 0.12, z - 0.12), (x + 0.12, z - 0.12), (x + 0.12, z + 0.12), (x - 0.12, z + 0.12)], floor, floor + 6.8)
            ACC.quad_box("concrete", [(x - 0.4, z - 0.4), (x + 0.4, z - 0.4), (x + 0.4, z + 0.4), (x - 0.4, z + 0.4)], floor, floor + 0.05)
    # timber market stalls with pitched roofs (as in the market court view)
    stalls = [(-40.5, 11.0), (-40.5, 17.0), (-34.0, 22.5), (-26.0, 22.5), (-18.0, 22.5), (-10.0, 22.5), (-8.0, 12.0), (-16.0, 12.0)]
    for x, z in stalls:
        w, d, h = 2.2, 1.4, 1.0
        ACC.quad_box("timber", [(x - w / 2, z - d / 2), (x + w / 2, z - d / 2), (x + w / 2, z + d / 2), (x - w / 2, z + d / 2)], floor, floor + h)
        for px, pz in ((x - w / 2, z - d / 2), (x + w / 2, z - d / 2), (x - w / 2, z + d / 2), (x + w / 2, z + d / 2)):
            ACC.quad_box("timber", [(px - 0.04, pz - 0.04), (px + 0.04, pz - 0.04), (px + 0.04, pz + 0.04), (px - 0.04, pz + 0.04)], floor + h, floor + 2.3)
        Vr, Fr = ACC.get("awning")
        o = len(Vr)
        for zz, yy in ((z - d / 2 - 0.2, 2.25), (z, 2.75), (z + d / 2 + 0.2, 2.25)):
            Vr += [B(x - w / 2 - 0.15, zz, floor + yy), B(x + w / 2 + 0.15, zz, floor + yy)]
        Fr += [(o, o + 1, o + 3, o + 2), (o + 2, o + 3, o + 5, o + 4)]


# ───────── food trucks: rounded pods, pink and white, serving hatch towards the promenade ─────────
def food_trucks(ctx, coll):
    for i, k in enumerate(ctx["plan"]["kiosks"]):
        p = np.array(k, float)
        c = p.mean(0)
        e0, e1 = p[1] - p[0], p[3] - p[0]
        if np.linalg.norm(e0) < np.linalg.norm(e1):
            e0, e1 = e1, e0
        Lg, Wd = np.linalg.norm(e0), np.linalg.norm(e1)
        ax = e0 / Lg
        ang = math.atan2(-ax[1], ax[0])
        me = bpy.data.meshes.new(f"food_truck_{i + 1:02d}")
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.scale(bm, vec=(Lg - 0.1, Wd - 0.1, 2.4), verts=bm.verts)
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.35, segments=4, affect="EDGES", profile=0.5)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(M["pod_pink" if i % 2 else "pod_white"])
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        ob = bpy.data.objects.new(f"food_truck_{i + 1:02d}", me)
        ob.location = B(c[0], c[1], 0.55 + 1.2)
        ob.rotation_euler = (0, 0, ang)
        coll.objects.link(ob)
        # window band and serving hatch on the side facing north or west (towards the buildings)
        side = np.array([-ax[1], ax[0]])
        if side[1] > 0.3 or (abs(side[1]) <= 0.3 and side[0] > 0):
            side = -side
        w = Wall(tuple(c - ax * Lg / 2 + side * Wd / 2), tuple(c + ax * Lg / 2 + side * Wd / 2), [tuple(q) for q in p])
        w.box("pod_glass", Lg * 0.2, Lg * 0.8, 1.45, 2.45, -0.06, 0.0)
        for e in (-1, 1):  # the glazed ends
            end = Wall(tuple(c + e * ax * Lg / 2 - side * Wd / 2), tuple(c + e * ax * Lg / 2 + side * Wd / 2), [tuple(q) for q in p])
            end.box("pod_glass", Wd * 0.18, Wd * 0.82, 1.15, 2.55, -0.08, -0.02)
        w.box("awning", Lg * 0.18, Lg * 0.82, 2.55, 2.6, 0.0, 0.9)
        ACC.quad_box("door_dark", [tuple(q) for q in (c - ax * (Lg / 2 - 0.4) - side * (Wd / 2 - 0.3),
                                                      c + ax * (Lg / 2 - 0.4) - side * (Wd / 2 - 0.3),
                                                      c + ax * (Lg / 2 - 0.4) + side * (Wd / 2 - 0.3),
                                                      c - ax * (Lg / 2 - 0.4) + side * (Wd / 2 - 0.3))], 0.0, 0.6)


def bistro_set(x, z, y, rot, chairs=4):
    """Square cafe table with chairs round it (white frames, timber seats)."""
    c, s_ = math.cos(rot), math.sin(rot)

    def sq(cx, cz, half_w, half_d, y0, y1, mat, a=0.0):
        ca, sa = math.cos(rot + a), math.sin(rot + a)
        pts = [(cx + ca * u - sa * v, cz + sa * u + ca * v) for u, v in ((-half_w, -half_d), (half_w, -half_d), (half_w, half_d), (-half_w, half_d))]
        ACC.quad_box(mat, pts, y + y0, y + y1)

    sq(x, z, 0.36, 0.36, 0.71, 0.75, "pod_white")
    sq(x, z, 0.03, 0.03, 0.0, 0.71, "rail")
    sq(x, z, 0.22, 0.22, 0.0, 0.02, "rail")
    for k in range(chairs):
        a = k * TAU / 4
        cx, cz = x + math.cos(rot + a) * 0.72, z + math.sin(rot + a) * 0.72
        sq(cx, cz, 0.21, 0.21, 0.43, 0.47, "timber", a)
        for du, dv in ((-0.18, -0.18), (0.18, -0.18), (0.18, 0.18), (-0.18, 0.18)):
            ca, sa = math.cos(rot + a), math.sin(rot + a)
            sq(cx + ca * du - sa * dv, cz + sa * du + ca * dv, 0.015, 0.015, 0.0, 0.43, "rail", a)
        bx, bz = cx + math.cos(rot + a) * 0.2, cz + math.sin(rot + a) * 0.2
        sq(bx, bz, 0.015, 0.2, 0.47, 0.85, "pod_white", a)


def furniture(ctx):
    """Cafe tables by the food trucks, on the serving side, and in the sunken tree plaza between the trees."""
    plan, G = ctx["plan"], ctx["ground_at"]
    pits = np.array(plan["tree_pits"], float)
    blocked = [[tuple(p) for p in k] for k in plan["kiosks"]] + [[tuple(p) for p in pl] for pl, _ in ctx["planters"]]
    blocked += [[tuple(p) for p in b["pts"]] for _, b in ctx["buildings"]]

    def free(x, z, r=1.3):
        if len(pits) and np.min(np.hypot(pits[:, 0] - x, pits[:, 1] - z)) < r + 0.9:
            return False
        return not any(inside((x + dx, z + dz), poly) for poly in blocked for dx, dz in ((-r, 0), (r, 0), (0, -r), (0, r), (0, 0)))

    n = 0
    for i, k in enumerate(plan["kiosks"]):
        p = np.array(k, float)
        c = p.mean(0)
        e0, e1 = p[1] - p[0], p[3] - p[0]
        if np.linalg.norm(e0) < np.linalg.norm(e1):
            e0, e1 = e1, e0
        ax = e0 / np.linalg.norm(e0)
        side = np.array([-ax[1], ax[0]])
        if side[1] > 0.3 or (abs(side[1]) <= 0.3 and side[0] > 0):
            side = -side
        for along in (-1.6, 1.6):
            q = c + side * (np.linalg.norm(e1) / 2 + 2.4) + ax * along
            if rnd.random() < 0.8 and free(*q):
                bistro_set(q[0], q[1], G(*q), rnd.uniform(0, TAU))
                n += 1
    plaza = next(f for f in plan["ground"]["floors"] if f["id"] == "tree_plaza")
    poly = [(p[0], p[1]) for p in plaza["pts"]]
    for x, z in points_in(poly, 3.6, 0.25):
        if rnd.random() < 0.55 and free(x, z) and all(inside(q, poly) for q in ((x - 1.3, z), (x + 1.3, z), (x, z - 1.3), (x, z + 1.3))):
            bistro_set(x, z, G(x, z), rnd.uniform(0, TAU))
            n += 1
    print(f"furniture: {n} cafe tables", flush=True)


def yard_units(ctx):
    cols = ["louvre", "PT01_rusty", "pod_white", "louvre", "PT01_rusty"]
    for i, (ob, u) in enumerate(ctx["yard"]):
        set_materials(ob, "PT01_rusty" if u["lpg"] else cols[i % len(cols)], "roof_units")


def site_finishes(ctx):
    """Lower-ground paving in the sunken court and plaza (TC02), CC01 on the terraces, ITN01 on the ramp; walls and
    stairs in concrete with dark railings; planters in Lotus with mulch tops."""
    for fid, ob in ctx["floors"].items():
        mat = {"market_court": "TC02_tiles", "tree_plaza": "TC02_tiles", "plaza_terraces": "CC01_concrete", "ramp": "ITN01_interlock"}[fid]
        ob.data.materials.clear()
        ob.data.materials.append(M[mat])
    for ob in ctx["stairs"]:
        ob.data.materials.clear()
        ob.data.materials.append(M["CC01_concrete"])
    w = ctx["walls"]
    w.data.materials.clear()
    w.data.materials.append(M["concrete"])
    w.data.materials.append(M["rail"])
    for p in w.data.polygons:  # railings: the parts above the ground
        p.material_index = 1 if p.center.z > 0.05 else 0
    for ob in ctx["planter_objs"]:
        set_materials(ob, "PT03_lotus", "mulch")


def build(ctx):
    """ctx: scene, plan, coll, buildings [(object, plan building)], passages, planters [(outline, top)], planter_objs,
    yard [(object, unit)], floors {id: object}, walls, stairs, levels, ground_at."""
    build_materials()
    coll = bpy.data.collections.new("Visualisation")
    ctx["scene"].collection.children.link(coll)
    ctx["coll"] = coll
    proto = bpy.data.collections.new("visual_prototypes")
    ctx["scene"].collection.children.link(proto)
    bpy.context.view_layer.layer_collection.children[proto.name].exclude = True
    dress_buildings(ctx)
    market_court(ctx, coll)
    food_trucks(ctx, coll)
    furniture(ctx)
    yard_units(ctx)
    site_finishes(ctx)
    landscape(ctx, proto, coll)
    ACC.flush(coll, "facade")
