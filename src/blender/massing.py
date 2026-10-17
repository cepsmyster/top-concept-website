"""Retail Park, Sharjah: the accurate model, step by step. Step 1: the massing, in its desert setting; step 3: the
visualisation (src/blender/visual.py: finishes of the material schedule, facades, landscape, shade sails, food trucks).

Footprints come from the site setting-out plan (A-091, sheet 02 of 02), traced by src/blender/plan/trace_plan.py
into src/blender/plan/retail_park_plan.json. Levels come from the elevations and sections (A-200 to A-306): LEVELS
below. The buildings stand on the lower ground (FFL -1.95), sunk below the rear road (gate level 0.00) and the
promenade (+0.30/+0.45); the market court and the tree plaza are sunk to the lower ground too, with retaining walls,
railings, the terraces and the stairs back up.

--look visual (default): the visualisation, in the desert at golden hour. --look massing: the white massing.
--env desert (default): the site's ground surfaces from the plan (asphalt, paving, sand, planting, the jogging trail,
with road markings) in the desert round it, with the roads carrying on, the highway, farms, trees and distant fog
(src/blender/environment.py). --env plain: the drawing itself as a grey card under the massing.

Axes as in retail_park.py: plan x runs west -> east, z from the rear road (-z) to the main road (+z), metres.
Origin: the north-west outer corner of the Games hall. Blender: x east, y north (= -z), z up.

Run with Blender 4.2 or newer, including 5.x (or the `bpy` Python module):
    blender -b --factory-startup -P src/blender/massing.py -- --blend src/blender/RetailPark_massing.blend
    blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/massing
Options: --views 00,06 (subset) --res 1920x1080 --samples 128 --look massing --env plain (white massing on the drawing;
--no-lines: no edge lines on the card).
In the saved .blend each view is a camera bound to one frame (1-7): Render > Render Animation renders them all.
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
sys.path.insert(0, HERE)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--plan", default=os.path.join(HERE, "plan", "retail_park_plan.json"))
ap.add_argument("--env", default="desert", choices=["desert", "plain"])
ap.add_argument("--look", default="visual", choices=["visual", "massing"], help="visual: finishes and landscape (desert only)")
ap.add_argument("--out", default="", help="render the views into this folder")
ap.add_argument("--views", default="", help="subset of views, e.g. 00,06 (default: all)")
ap.add_argument("--res", default="1920x1080")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--no-lines", action="store_true", help="--env plain: leave out the thin edge lines (Freestyle)")
ap.add_argument("--blend", default="", help="save the scene as a ready-to-render .blend file")
ap.add_argument("--gpu", action="store_true", help="render on the graphics card (OptiX/CUDA/HIP/Metal/oneAPI)")
args = ap.parse_args(argv)
RES = tuple(int(v) for v in args.res.split("x"))
DESERT = args.env == "desert"
VISUAL = DESERT and args.look == "visual"

# Levels in metres from the elevations and sections (datum 0.00 = gate level at the rear road): (bottom, top).
# Blocks whose floor is on the promenade (+0.45) start at the ground here (0.00), which is kept level outside.
LEVELS = {
    "spine": (-1.95, 6.25),          # F&B and retail units: FFL -1.95, roof SSL 4.80, parapet 6.25 (A-A, B-B, C-C)
    "passage_room": (-1.95, 4.80),   # the walled room across each through-passage
    "passage_roof": (4.80, 6.25),    # the spine's roof carries on over the passages
    "corridor": (-1.95, 2.60),       # the covered mall corridor: lower roof SSL 2.35, FFL 2.60 (D-D to I-I)
    "west_wing": (-1.95, 6.25),      # roof 4.80, parapet 6.25, head rooms to 7.65 (D-D, E-E)
    "court_room": (-1.95, 2.60),     # small room in the market court: not in the sections, taken at the corridor roof
    "games_hall": (-1.95, 7.20),     # gaming area: FFL -1.95, roof 6.00, parapet 7.20 (F-F, G-G, H-H)
    "pavilion": (-3.00, 7.20),       # FFL +0.45 over a basement at -3.00, roof 6.00, parapet 7.20 (I-I)
    "west_pavilion": (0.00, 3.90),   # pump room, store and LV room: FFL 0.45, roof SSL 3.65, top 3.90 (D-D)
    "wc": (0.00, 3.90),              # WC blocks on the promenade: not in the sections, taken as the pump room
    "kiosk": (0.00, 2.95),           # food trucks 2.45 x 6.08 m on the promenade, top 2.95 (F-F, H-H)
    "yard": (0.00, 3.20),            # rear yard units and the LPG store: not in the sections
}
PLANTER_H = 0.45   # raised planters stand this much above the ground round them
RAILING_H = 1.10   # railings along the top of the retaining walls

plan = json.load(open(args.plan))
PLAN_DIR = os.path.dirname(os.path.abspath(args.plan))


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


C_BUILD, C_SMALL, C_LAND, C_GROUND, C_CAMS = (collection(n) for n in ("Buildings", "Kiosks & yard", "Planters", "Site ground", "Cameras"))


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
    "wall": clay("retaining_wall", (0.74, 0.72, 0.68), 0.85),
}


def plan_card_material(img_path):
    """--env plain: the drawing's lines on a light grey card."""
    m = bpy.data.materials.new("site_plan")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.95
    gi = plan["ground_image"]
    (gx0, gz0), (gx1, gz1) = gi["min"], gi["max"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")  # object coordinates -> 0..1 over the sheet
    mp.inputs["Location"].default_value = (-gx0 / (gx1 - gx0), gz1 / (gz1 - gz0), 0)
    mp.inputs["Scale"].default_value = (1 / (gx1 - gx0), 1 / (gz1 - gz0), 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(img_path)
    tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    nt.links.new(mp.outputs[0], tex.inputs["Vector"])
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


def inside(pt, poly):
    """Point in polygon (plan x, z)."""
    x, z = pt
    hit = False
    for (x0, z0), (x1, z1) in zip(poly, poly[1:] + poly[:1]):
        if (z0 > z) != (z1 > z) and x < x0 + (z - z0) * (x1 - x0) / (z1 - z0):
            hit = not hit
    return hit


GROUND_PLAN = plan["ground"]
FLOORS = [[(p[0], p[1]) for p in f["pts"]] for f in GROUND_PLAN["floors"]]


def ground_at(x, z):
    """Ground height at a plan point: the sunken floors (nearest outline point's height) or 0.00."""
    for f, poly in zip(GROUND_PLAN["floors"], FLOORS):
        if inside((x, z), poly):
            return min(f["pts"], key=lambda p: (p[0] - x) ** 2 + (p[1] - z) ** 2)[2]
    return 0.0


L = LEVELS
BUILT = {"buildings": [], "passages": [], "planters": [], "planter_objs": [], "yard": []}  # handed to visual.py
for b in plan["buildings"]:
    y0, y1 = L[b["kind"]]
    BUILT["buildings"].append((prism(b["id"], b["pts"], y0, y1, MAT["building"], C_BUILD), b))
# the two through-passages in the spine: a walled room across the middle, open to the rear and to the corridor
for i, p in enumerate(plan["passages"]):
    x0, z0, x1, z1 = p["box"]
    rz0, rz1 = p["room_z"]
    BUILT["passages"].append(box(f"passage_{i + 1}_room", x0, rz0, x1, rz1, *L["passage_room"], MAT["building"], C_BUILD))
    BUILT["passages"].append(box(f"passage_{i + 1}_roof", x0, z0, x1, z1, *L["passage_roof"], MAT["building"], C_BUILD))
if not VISUAL:  # the visualisation models the food trucks themselves
    for i, k in enumerate(plan["kiosks"]):
        prism(f"food_truck_{i + 1:02d}", k, *L["kiosk"], MAT["small"], C_SMALL)
for i, u in enumerate(plan["yard_units"]):
    ob = prism("LPG_store" if u["lpg"] else f"yard_unit_{i + 1}", u["pts"], *L["yard"], MAT["lpg" if u["lpg"] else "small"], C_SMALL)
    BUILT["yard"].append((ob, u))
for i, pl in enumerate(plan["planters"]):
    cx, cz = sum(p[0] for p in pl) / len(pl), sum(p[1] for p in pl) / len(pl)
    g = ground_at(cx, cz)
    BUILT["planter_objs"].append(prism(f"planter_{i + 1:02d}", pl, g - 0.5, g + PLANTER_H, MAT["planter"], C_LAND))
    BUILT["planters"].append((pl, g + PLANTER_H))


# ───────── site ground: level outside, sunk to the lower ground in the court and the plaza ─────────
def tri_mesh(name, mesh, mat, coll, attr=None):
    """Mesh from trace_plan.py's triangulation: verts [x, z, height], tris [i, j, k]."""
    me = bpy.data.meshes.new(name)
    me.from_pydata([B(x, z, h) for x, z, h in mesh["verts"]], [], [tuple(t) for t in mesh["tris"]])
    for p in me.polygons:  # face up
        if p.normal.z < 0:
            p.flip()
    me.update()
    me.materials.append(mat)
    if attr:
        ca = me.color_attributes.new("ground", "FLOAT_COLOR", "POINT")
        for d in ca.data:
            d.color = attr
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def site_ground(mat, attr=None):
    tri_mesh("site_ground", GROUND_PLAN["base"], mat, C_GROUND, attr)
    BUILT["floors"] = {f["id"]: tri_mesh(f["id"], f["mesh"], mat, C_GROUND, attr) for f in GROUND_PLAN["floors"]}
    # retaining walls from each sunken floor up to the ground, with a railing above
    me = bpy.data.meshes.new("retaining_walls")
    bm = bmesh.new()
    for (ax, az, ah), (bx, bz, bh) in GROUND_PLAN["walls"]:
        quad = [bm.verts.new(B(ax, az, ah)), bm.verts.new(B(bx, bz, bh)), bm.verts.new(B(bx, bz, 0.0)), bm.verts.new(B(ax, az, 0.0))]
        bm.faces.new(quad)
        if min(ah, bh) < -0.6:
            rail = [bm.verts.new(B(ax, az, 0.0)), bm.verts.new(B(bx, bz, 0.0)), bm.verts.new(B(bx, bz, RAILING_H)), bm.verts.new(B(ax, az, RAILING_H))]
            bm.faces.new(rail)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT["wall"])
    BUILT["walls"] = bpy.data.objects.new("retaining_walls", me)
    C_GROUND.objects.link(BUILT["walls"])
    BUILT["stairs"] = []
    # stairs from the lower ground up to the promenade: solid steps
    for i, st in enumerate(GROUND_PLAN["stairs"]):
        (x0, x1), (z0, z1), n = st["x"], st["z"], st["risers"]
        h0, h1 = st["h"]
        for k in range(n):
            zs = z0 + (z1 - z0) * k / n
            BUILT["stairs"].append(box(f"stair_{i + 1}_{k:02d}", x0, zs, x1, z1, h0 - 0.05, h0 + (h1 - h0) * (k + 1) / n, MAT["wall"], C_GROUND))


gi = plan["ground_image"]
(gx0, gz0), (gx1, gz1) = gi["min"], gi["max"]
cx, cz = (gx0 + gx1) / 2, (gz0 + gz1) / 2
if VISUAL:
    import environment
    import visual
    gmat = visual.ground_material(plan, os.path.join(PLAN_DIR, plan["ground_surfaces"]["zones"]))
    site_ground(gmat, (*environment.srgb(environment.SAND), 1))
    # golden hour: a summer afternoon's low sun from the west-north-west, behind the site from the main road, as in the
    # project's own aerial renders; warm haze in a shallow layer, so the low sun still reaches the site
    environment.build(scene, PLAN_DIR, plan, gmat, fog_color=(0.98, 0.86, 0.70), fog_density=0.0003, fog_height=150,
                      light={"az_deg": 290, "el_deg": 16, "strength": 0.22, "sun_energy": 14.0, "color": (1.0, 0.78, 0.56)})
    visual.build(dict(BUILT, scene=scene, plan=plan, levels=LEVELS, ground_at=ground_at))
elif DESERT:
    import environment
    gmat, gimg = environment.terrain_material(os.path.join(PLAN_DIR, plan["ground_surfaces"]["file"]), gi)
    site_ground(gmat, (*environment.srgb(environment.SAND), 1))
    environment.build(scene, PLAN_DIR, plan, gmat)
else:
    gmat, gimg = plan_card_material(os.path.join(PLAN_DIR, gi["file"]))
    site_ground(gmat)
    paper = clay("paper", GROUND, 0.95)
    S = 3000
    outer = [(cx - S, cz - S), (cx + S, cz - S), (cx + S, cz + S), (cx - S, cz + S)]
    sheet = [(gx0, gz0), (gx1, gz0), (gx1, gz1), (gx0, gz1)]
    tri_mesh("ground", {"verts": [[x, z, -0.02] for x, z in outer + sheet],
                        "tris": [t for i in range(4) for t in ([i, (i + 1) % 4, 4 + (i + 1) % 4], [i, 4 + (i + 1) % 4, 4 + i])]},
             paper, C_GROUND)
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
    ("00_aerial_from_the_highway", (40, 280, 80), (38, -80, 0), 35),  # horizon and haze in the top of the frame
    ("01_aerial_south_west", (-105, 128, 88), (12, 10, 0), 35),
    ("02_aerial_south_east", (150, 130, 85), (22, 10, 0), 35),
    ("03_aerial_rear_north_west", (-95, -125, 80), (20, 5, 0), 35),
    ("04_street_main_road", (-30, 100, 12), (-12, 15, 3), 28),
    ("05_eye_level_market_court", (-14.0, 20.0, -0.25), (-45, 1, 1.0), 24),
]
VIEWS_AFTER_PLAN = [  # visualisation only, after the plan view so the first seven frames stay as they were
    ("07_food_trucks_promenade", (-4.0, 60.0, 4.5), (22, 36, 2.0), 30),   # across the parking to the food trucks
    ("08_spine_shopfronts", (20.0, -18.5, 1.7), (-2, -12.4, 3.2), 26),    # along the spine's north shopfronts
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
cam.location = B(cx, cz, 300)
cams.append(cam)
for name, (px, pz, ph), (tx, tz, th), lens in (VIEWS_AFTER_PLAN if VISUAL else []):
    cd = bpy.data.cameras.new(name)
    cd.lens, cd.sensor_width = lens, 36
    cam = bpy.data.objects.new(name, cd)
    cam.location = B(px, pz, ph)
    cam.rotation_euler = (Vector(B(tx, tz, th)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cams.append(cam)
for i, cam in enumerate(cams):
    C_CAMS.objects.link(cam)
    cam.data.clip_start, cam.data.clip_end = 0.5, 20000
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
r.filepath = "//renders/view_"  # a "renders" folder next to the .blend, wherever it is saved
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
cy.transparent_max_bounces = 16
cy.volume_step_rate = 4.0
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -0.35 if not DESERT else -0.75 if VISUAL else -0.45
if VISUAL:  # eye-level views stand in the low sun's shade: a brighter exposure on their frames (keyframed per view)
    LIFT = {"04": 0.15, "05": 0.65, "07": 0.4, "08": 0.4}
    for i, cam in enumerate(cams):
        scene.view_settings.exposure = -0.75 + LIFT.get(cam.name[:2], 0.0)
        scene.view_settings.keyframe_insert("exposure", frame=i + 1)
    scene.view_settings.exposure = -0.75
for look in ("AgX - Medium High Contrast", "Medium High Contrast"):  # look names differ between Blender versions
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        pass
# thin dark edge lines on the building outlines, as on a card model (plain only: Freestyle loads every tree in the
# desert for its visibility test, which runs out of memory)
LINES = not args.no_lines and not DESERT
r.use_freestyle = LINES
r.line_thickness_mode = "RELATIVE"
r.line_thickness = 0.9
if LINES:
    fs = scene.view_layers[0].freestyle_settings
    for old in list(fs.linesets):  # the default line set's style is not saved with the file
        fs.linesets.remove(old)
    ls = fs.linesets.new("edges")
    ls.select_by_visibility = True
    ls.select_by_edge_types = True
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    ls.select_by_collection = True
    ls.collection = C_BUILD
    style = bpy.data.linestyles.new("edges")
    style.use_fake_user = True  # keeps the style in the saved .blend
    style.color = (0.25, 0.24, 0.23)
    style.thickness = 1.0
    ls.linestyle = style
    fs.crease_angle = math.radians(140)

if args.blend:
    for img in bpy.data.images:
        if img.source == "FILE":
            img.pack()
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
