"""Retail Park, Sharjah: step 1 of the accurate model, the massing.

Every footprint comes from the site setting-out plan (A-091, sheet 02 of 02), traced by
src/blender/plan/trace_plan.py into src/blender/plan/retail_park_plan.json. The drawing itself lies under the
massing at true scale (site_plan.png), so roads, parking bays, kerbs and the jogging trail are exact too.
Heights are not on the plan: HEIGHTS below holds the ones used so far, to be replaced from the sections.

Axes as in retail_park.py: plan x runs west -> east, z from the rear road (-z) to the main road (+z), metres.
Origin: the north-west outer corner of the Games hall. Blender: x east, y north (= -z), z up.

Run with Blender 4.2 or newer, including 5.x (or the `bpy` Python module):
    blender -b --factory-startup -P src/blender/massing.py -- --blend src/blender/RetailPark_massing.blend
    blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/massing
Options: --views 01,06 (subset) --res 1920x1080 --samples 128 --no-lines (skip the edge lines).
In the saved .blend each view is a camera bound to one frame (1-6): Render > Render Animation renders them all.
"""
import argparse
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

if bpy.app.version < (4, 2, 0):
    sys.exit(f"The massing needs Blender 4.2 or newer (found {bpy.app.version_string}).")

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--plan", default=os.path.join(HERE, "plan", "retail_park_plan.json"))
ap.add_argument("--out", default="", help="render the views into this folder")
ap.add_argument("--views", default="", help="subset of views, e.g. 01,06 (default: all)")
ap.add_argument("--res", default="1920x1080")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--no-lines", action="store_true", help="leave out the thin edge lines (Freestyle)")
ap.add_argument("--blend", default="", help="save the scene as a ready-to-render .blend file")
ap.add_argument("--gpu", action="store_true", help="render on the graphics card (OptiX/CUDA/HIP/Metal/oneAPI)")
args = ap.parse_args(argv)
RES = tuple(int(v) for v in args.res.split("x"))

# Heights in metres above the ground. The plan gives none, so these follow the current photoreal scene
# (spine 9.4, west block 10.5, Games hall 10.8, pavilion 9.4) until sections and levels are supplied.
HEIGHTS = {
    "spine": 9.4,          # F&B units facing the rear road
    "passage_clear": 4.5,  # open height under the roof of the two through-passages
    "link": 5.0,           # enclosed links across the mall street
    "west_wing": 10.5,
    "court_room": 3.6,
    "games_hall": 10.8,
    "pavilion": 9.4,
    "west_pavilion": 4.5,
    "wc": 3.6,
    "kiosk": 2.9,          # food containers 2.45 x 6.08 m
    "yard": 3.2,           # rear yard units and the LPG store
    "planter": 0.45,
}

plan = json.load(open(args.plan))


def B(x, z, y=0.0):
    """Plan (x, z) + height y -> Blender coordinates."""
    return (x, -z, y)


# ───────── scene reset ─────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
COLL = scene.collection


def collection(name):
    c = bpy.data.collections.new(name)
    COLL.children.link(c)
    return c


C_BUILD, C_SMALL, C_LAND, C_GROUND, C_CAMS = (collection(n) for n in ("Buildings", "Kiosks & yard", "Planters", "Ground", "Cameras"))


# ───────── materials ─────────
def clay(name, rgb, rough=0.65):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)  # solid view colour
    return m


GROUND = (0.60, 0.59, 0.57)
MAT = {
    "building": clay("massing_white", (0.90, 0.89, 0.87)),
    "small": clay("massing_kiosk", (0.70, 0.66, 0.60)),
    "lpg": clay("massing_lpg", (0.62, 0.24, 0.20)),
    "planter": clay("massing_planter", (0.42, 0.52, 0.38), 0.9),
}


def ground_material(img_path):
    m = bpy.data.materials.new("site_plan")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.95
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(img_path)
    tex.image.colorspace_settings.name = "sRGB"
    tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    # light grey card with the drawing's lines at 80 % strength
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.8
    mix.inputs[6].default_value = (*GROUND, 1)
    nt.links.new(tex.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    m.diffuse_color = (*GROUND, 1)
    return m, tex.image


# ───────── geometry ─────────
def prism(name, pts, y0, y1, mat, coll):
    """Vertical extrusion of a plan polygon [(x, z), ...] between heights y0 and y1."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    ring = [Vector(B(x, z)) for x, z in pts]
    area = sum(a.x * b.y - b.x * a.y for a, b in zip(ring, ring[1:] + ring[:1]))
    if area < 0:
        ring.reverse()  # counter-clockwise seen from above
    bot = [bm.verts.new((v.x, v.y, y0)) for v in ring]
    top = [bm.verts.new((v.x, v.y, y1)) for v in ring]
    bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def box(name, x0, z0, x1, z1, y0, y1, mat, coll):
    return prism(name, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1, mat, coll)


H = HEIGHTS
for b in plan["buildings"]:
    prism(b["id"], b["pts"], 0, H[b["kind"]], MAT["building"], C_BUILD)
# the two through-passages in the spine: a walled room across the middle, open recesses under one roof
for i, p in enumerate(plan["passages"]):
    x0, z0, x1, z1 = p["box"]
    rz0, rz1 = p["room_z"]
    box(f"passage_{i + 1}_room", x0, rz0, x1, rz1, 0, H["passage_clear"], MAT["building"], C_BUILD)
    box(f"passage_{i + 1}_roof", x0, z0, x1, z1, H["passage_clear"], H["spine"], MAT["building"], C_BUILD)
for i, k in enumerate(plan["kiosks"]):
    prism(f"kiosk_{i + 1:02d}", k, 0, H["kiosk"], MAT["small"], C_SMALL)
for i, u in enumerate(plan["yard_units"]):
    prism("LPG_store" if u["lpg"] else f"yard_unit_{i + 1}", u["pts"], 0, H["yard"], MAT["lpg" if u["lpg"] else "small"], C_SMALL)
for i, pl in enumerate(plan["planters"]):
    prism(f"planter_{i + 1:02d}", pl, 0, H["planter"], MAT["planter"], C_LAND)

# ground: the drawing at true scale on a light grey card that runs out to the horizon
gi = plan["ground_image"]
gmat, gimg = ground_material(os.path.join(os.path.dirname(args.plan), gi["file"]))
(gx0, gz0), (gx1, gz1) = gi["min"], gi["max"]
me = bpy.data.meshes.new("site_plan")
me.from_pydata([B(gx0, gz1), B(gx1, gz1), B(gx1, gz0), B(gx0, gz0)], [], [(0, 1, 2, 3)])
me.uv_layers.new(name="UVMap")
for loop, uv in zip(me.uv_layers[0].data, ((0, 0), (1, 0), (1, 1), (0, 1))):
    loop.uv = uv
me.materials.append(gmat)
ob = bpy.data.objects.new("site_plan", me)
C_GROUND.objects.link(ob)
paper = clay("paper", GROUND, 0.95)
cx, cz = (gx0 + gx1) / 2, (gz0 + gz1) / 2
me = bpy.data.meshes.new("ground")
S = 3000
me.from_pydata([B(cx - S, cz + S, -0.02), B(cx + S, cz + S, -0.02), B(cx + S, cz - S, -0.02), B(cx - S, cz - S, -0.02)], [], [(0, 1, 2, 3)])
me.materials.append(paper)
C_GROUND.objects.link(bpy.data.objects.new("ground", me))

# ───────── light ─────────
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
bgn = world.node_tree.nodes["Background"]
bgn.inputs["Color"].default_value = (0.72, 0.82, 1.0, 1)
bgn.inputs["Strength"].default_value = 0.35
sun_d = bpy.data.lights.new("sun", "SUN")
sun_d.energy = 6.0
sun_d.angle = math.radians(1.5)
sun_d.color = (1.0, 0.95, 0.88)
sun = bpy.data.objects.new("sun", sun_d)
sun.rotation_euler = (math.radians(48), 0, math.radians(-50))  # afternoon sun from the south-west, 42 degrees up
COLL.objects.link(sun)

# ───────── cameras: one per frame ─────────
VIEWS = [  # name, camera (plan x, plan z, height), target (plan x, plan z, height), lens in mm
    ("01_aerial_south_west", (-105, 128, 88), (12, 10, 0), 35),
    ("02_aerial_south_east", (150, 130, 85), (22, 10, 0), 35),
    ("03_aerial_rear_north_west", (-95, -125, 80), (20, 5, 0), 35),
    ("04_street_main_road", (-30, 100, 12), (-12, 15, 5), 28),
    ("05_eye_level_mall_street", (-38, -2.5, 1.7), (120, -2.5, 4), 24),
]
cams = []
for name, (px, pz, ph), (tx, tz, th), lens in VIEWS:
    cd = bpy.data.cameras.new(name)
    cd.lens, cd.sensor_width = lens, 36
    cam = bpy.data.objects.new(name, cd)
    cam.location = B(px, pz, ph)
    cam.rotation_euler = (Vector(B(tx, tz, th)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cams.append(cam)
# straight down over the whole drawing, orthographic: the check that the massing sits on the plan
cd = bpy.data.cameras.new("06_plan_top")
cd.type = "ORTHO"
cd.ortho_scale = max(gx1 - gx0, (gz1 - gz0) * RES[0] / RES[1]) * 1.01
cam = bpy.data.objects.new("06_plan_top", cd)
cam.location = B(cx, cz, 400)
cams.append(cam)
for i, cam in enumerate(cams):
    C_CAMS.objects.link(cam)
    cam.data.clip_start, cam.data.clip_end = 0.5, 6000
    m = scene.timeline_markers.new(cam.name, frame=i + 1)
    m.camera = cam
scene.camera = cams[0]
scene.frame_start, scene.frame_end = 1, len(cams)

# ───────── render settings ─────────
r = scene.render
r.engine = "CYCLES"
r.resolution_x, r.resolution_y = RES
r.resolution_percentage = 100
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.filepath = "//../../renders/massing/view_"  # the "renders" folder at the top of the repo
cy = scene.cycles
cy.device = "CPU"
if args.gpu:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        gpus = [d for d in prefs.devices if d.type == kind]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == kind
            cy.device = "GPU"
            print("Rendering on", kind, ", ".join(d.name for d in gpus), flush=True)
            break
    if cy.device != "GPU":
        print("No supported graphics card found: rendering on the CPU", flush=True)
HAVE_GPU = cy.device == "GPU"
cy.samples = args.samples
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
cy.use_denoising = True
cy.denoiser = "OPENIMAGEDENOISE"
cy.max_bounces = 4
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.35
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):  # look names differ between Blender versions
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        pass
# thin dark edge lines on the building outlines, as on a card model
r.use_freestyle = not args.no_lines
r.line_thickness_mode = "RELATIVE"
r.line_thickness = 0.9
if not args.no_lines:
    ls = scene.view_layers[0].freestyle_settings.linesets.new("edges")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    ls.select_by_collection = True
    ls.collection = C_BUILD
    ls.linestyle.color = (0.25, 0.24, 0.23)
    ls.linestyle.thickness = 1.0
    scene.view_layers[0].freestyle_settings.crease_angle = math.radians(140)

if args.blend:
    gimg.pack()
    cy.device = "GPU"  # uses the card set in Preferences > System; Blender falls back to the CPU without one
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend), compress=True)
    print("saved", args.blend, flush=True)

if args.out:
    cy.device = "GPU" if HAVE_GPU else "CPU"
    want = {v.strip() for v in args.views.split(",") if v.strip()}
    os.makedirs(args.out, exist_ok=True)
    for i, cam in enumerate(cams):
        if want and cam.name[:2] not in want:
            continue
        scene.frame_set(i + 1)  # the marker on this frame makes it the active camera
        r.filepath = os.path.join(os.path.abspath(args.out), cam.name + ".png")
        bpy.ops.render.render(write_still=True)
        print("rendered", r.filepath, flush=True)
