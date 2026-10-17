# Retail Park in 3D: rendering

The 3D page (`retail-park-3d.html`) is a fly-round of Retail Park, rendered in Blender from code only (no downloaded models, textures or HDRIs). It moves view to view like [belgradearbor.rs/en/3d](https://belgradearbor.rs/en/3d): the section is pinned and each slice of the page scroll is one of 8 views round the park. Scrolling into the next slice plays a film on to that view, a 2-second glide at 60 fps that eases in and out of every view, and stops exactly on it. Scrolling back plays a reversed copy of the film. The two only swap at a view, where they show the same frame. The pointer leans the picture slightly.

The camera sits low and close (about 25° down, 26 mm lens, horizon in view). Trees are open, branching street trees with loose leaf clumps. The main road stops at the site edges and there is no moving traffic; parked cars stay.

| File | What it is |
|---|---|
| `retail_park.py` | Builds the scene from scratch (layout from `src/model3d.mjs`) and renders the film (`--tour 8 --path 120 --ease --no-traffic`) or saves a .blend file. Blender 4.2 or newer, including 5.x. |
| `RetailPark_day.blend`, `RetailPark_night.blend` | The scene with an earlier tour animation (traffic loops and flights, frames 1–768, long main road). Useful for looking round or test renders; the page uses the film render below. |
| `render_all.bat` / `render_all.sh` | Render the day and night films on the graphics card. |
| `export_tour.mjs` | Turns the renders into the files the page loads (`assets/rp3d/…`). |

Settings: 1600 × 900, 64 samples with denoising, WebP frames, 841 frames per light (7 glides × 120 frames + 1). On an RTX 5070 about 3.3 s per frame, so about 45 minutes for each light.

## Render

From a terminal at the top of the repo (Windows: `render_all.bat`, or use the full path to `blender.exe`):

```
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light day   --tour 8 --path 120 --ease --no-traffic --samples 64 --out renders/day
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light night --tour 8 --path 120 --ease --no-traffic --samples 64 --out renders/night
```

Frames go to `renders/<light>/film/0000.webp` … Finished frames are skipped, so you can stop and start again; `--frames 0,300` renders a subset. To check the framing of the 8 views first: `--tour 8 --clips s0,s1,s2,s3,s4,s5,s6,s7 --still --res 800x450 --samples 32`.

## Export for the site

```
node src/blender/export_tour.mjs renders [path/to/ffmpeg]     # ffmpeg with libx264, libvpx-vp9, libwebp (npx ffmpeg-static works); LIGHTS=day for one light
node src/build.mjs
```

This writes `assets/rp3d/<light>/film.mp4` and `film-rev.mp4` (1600 px, about 7 MB each), `-md` copies at 960 px for phones (about 2.5 MB each), VP9 `.webm` copies for browsers without H.264, `poster.webp` / `poster-md.webp`, and `assets/img/rp3d-og.jpg`. Every view starts a keyframe, so the page can land on any view at once. Don't commit the raw renders. The Day / Night switch on the page appears only once `assets/rp3d/night/` has been exported (then run `node src/build.mjs` again).

## Changing the scene

Edit `retail_park.py`, render, export. The tour camera is `place_tour()` (`TOUR_RX`, `TOUR_RY`, `TOUR_H`, `TOUR_LOOK`, `--lens`); the view names on the page are `VIEWS` in `src/build.mjs`, in the same order. The glide length is `--path` (frames at 60 fps) and must match `data-step` (seconds) in `src/build.mjs` and `STEP` in `export_tour.mjs`. To refresh the .blend files:

```
blender -b --factory-startup -P src/blender/retail_park.py -- --light day   --tour 8 --blend src/blender/RetailPark_day.blend
blender -b --factory-startup -P src/blender/retail_park.py -- --light night --tour 8 --blend src/blender/RetailPark_night.blend
```

Notes on the scene: the connector between the buildings has a plain roof (no parking on it). Behind it runs the rear road at ground level, with a row of parking on its far side.

## Accurate model, step 1: massing from the drawings, in its desert setting

The photoreal scene above was laid out by eye from the renders. The accurate model is being rebuilt in steps from the drawings: first the massing, with footprints traced from the site setting-out plan (A-091, sheet 02 of 02) and levels from the elevations and sections (A-200 to A-306), set in the desert round the site.

| File | What it is |
|---|---|
| `plan/trace_plan.py` | Reads the plan PDF's vector linework and writes the files below. Ordinary Python: `pip install pymupdf shapely pillow numpy scipy`, then `python src/blender/plan/trace_plan.py "<plan>.pdf"`. |
| `plan/retail_park_plan.json` | Every footprint in metres: the retail spine (3 parts, 2 through-passages), the covered mall corridor, the west wing and its corridor, the court room, the Games hall, the pavilion, the pump and LV room, 2 WC blocks, 16 food trucks, 6 yard units (one is the LPG store) and 14 raised planters; and the ground: the sunken market court, tree plaza, terraces and ramp (meshes with heights), their retaining walls and the 2 stairs. |
| `plan/site_ground.png` | The ground surfaces read from the drawing (asphalt, paving, pavers, sand, planting, the jogging trail) with the road markings, 8192 px wide (about 3 cm a pixel), laid at true scale. |
| `plan/site_plan.png` | The drawing itself, for the plain card (`--env plain`). |
| `plan/check_overlay.webp` | The traced footprints drawn over the drawing, for checking. |
| `massing.py` | Builds the massing in Blender (4.2 or newer): white blocks at the section levels, the sunken court and plaza, 7 cameras. `--env desert` (default) or `--env plain`; `--look massing` for the white blocks in the desert (the default, `--look visual`, is step 3 below). |
| `environment.py` | The desert round the site, used by `massing.py`. |
| `RetailPark_massing.blend` | The scene, ready to render (images packed in; saved in Blender 5.1). It is self-contained, so it can be downloaded on its own and saved anywhere. Open it and press Render > Render Animation: frames 1–7 are the 7 views, written to a `renders` folder next to the .blend. Uses the graphics card set in Preferences > System > Cycles Render Devices. |
| `render_massing.bat` | Double-click on Windows: rebuilds the .blend and renders the 7 views on the graphics card into `renders/massing/`. |

**Scale.** The PDF was plotted to fit the sheet, with no scale bar, so the scale was measured from the drawing: 6.3306 PDF points per metre (about 1:448 on A2). Everything agrees with it: parking bays 2.70 × 5.40 m (measured over runs of up to 26 bays), CAD fillet radii of exactly 2, 3, 4, 5 and 6 m, doors 0.90 and 1.00 m, internal stair treads 0.30 m, external steps 0.40 m and accessible-bay zones 1.20 m.

**Accuracy.** Building outlines are the outer wall faces, snapped to the CAD vertices (the PDF stores them to about 2 cm). Food trucks, yard units and planters are read from the drawing automatically, and so are the ground surfaces: the drawing's closed regions are sorted into roads, bays, paving and so on from a few seed points.

**Levels** (`LEVELS` in `massing.py`; datum 0.00 = gate level at the rear road). The buildings stand on the lower ground, FFL −1.95, below the rear road and the promenade (+0.30/+0.45 by the food trucks):

| Block | Bottom | Top | From |
|---|---|---|---|
| Spine (F&B and retail units) | −1.95 | parapet +6.25 (roof SSL +4.80) | sections A-A, B-B, C-C |
| Covered mall corridor, west wing corridor | −1.95 | +2.60 (lower roof SSL +2.35) | sections D-D to I-I |
| West wing | −1.95 | +6.25 (head rooms +7.65) | D-D, E-E |
| Games hall | −1.95 | parapet +7.20 (roof +6.00) | F-F, G-G, H-H |
| Pavilion | −3.00 (basement; FFL +0.45) | parapet +7.20 (roof +6.00) | I-I |
| Pump and LV room | ground | +3.90 | D-D |
| Food trucks | ground | +2.95 | F-F, H-H |
| WC blocks, yard units, court room | ground / −1.95 | +3.90 / +3.20 / +2.60 | not in the sections: assumed |

The market court and the tree plaza are sunk to −1.95, with retaining walls and railings, the plaza's terraces and the ramp beside the pavilion rising to the promenade, and the two 16-riser stairs. The ground outside is kept level at 0.00 (the promenade's +0.30/+0.45 is not modelled).

**The desert** (`environment.py`) is laid out from the satellite view of the plot, north-east of the Al Dhaid interchange: the plan's roads carry on out of the sheet (the rear road to the overpass road and the road by the housing, the collector back into the highway at both ends, the junction road down to the highway); the dual highway curves south-east past the site, with the overpass road, the roundabout road (both bridging it), the loop ramp and the local road along the farms; date-palm farms, walled compounds and housing blocks; the dark gravel plain with pale sand patches, scattered acacia and ghaf trees and shrubs (about 140,000, instanced); low dunes far out; a hazy sky with the sun in the south-west and a fog volume that only closes in over the last kilometres. Positions away from the site are read off the satellite image by eye, so they are approximate; everything on the site follows the drawings.

| View (frame) | Camera |
|---|---|
| 1 | Aerial from across the highway (south), with the desert behind |
| 2 | Aerial from the south-west |
| 3 | Aerial from the south-east |
| 4 | Aerial from the rear (north-west) |
| 5 | From the main road |
| 6 | Eye level in the sunken market court |
| 7 | Straight down over the whole sheet (orthographic), to check the massing against the plan |

To render without opening the .blend: `blender -b --factory-startup -P src/blender/massing.py -- --look massing --gpu --out renders/massing` (`--views 00,06` for a subset, `--samples`, `--res`; `--env plain` for the grey card with edge lines). Building the scene takes about 10 seconds; on a graphics card each view takes well under a minute at 128 samples.

## Accurate model, step 3: the visualisation

`massing.py --look visual` (the default with the desert) dresses the accurate massing in the finishes of the Retail Park material schedule (MATERIAL SHEETS – RETAIL PARK) and the elevations, and plants it. It's built by `visual.py`, from code only (no downloaded models, textures or HDRIs). `--look massing` still gives the white massing of steps 1 and 2.

| Code | Finish (schedule) | Where in the model |
|---|---|---|
| GL | Reflective double glazing | Shopfronts and curtain walls, warm-lit inside |
| AL-01 / AL-02 | Anthracite aluminium framing (mullions 50 × 100) / canopies | Curtain-wall frames, entrance canopies, the west wing's reveals |
| PT01 | Jotashield Rusty 1259 (165, 114, 82) | Shopfront portal frames, the Games hall's fluted walls, the west wing, WC bands |
| PT02 | Dark Stone 7687 (86, 87, 83) | Parapet bands, the Games hall's top band, the corridors, the spine above the corridor roof, the pavilion's soffit |
| PT03 | Lotus 1108 (228, 221, 202) | The spine's shopfront wall, the pump room, the planters |
| TC01 | Terracotta, staggered tilted panels | The pavilion's upper band (elevation C2) |
| TC02 | Terracotta tiles 60 × 240 (150, 108, 92) | Lower ground: the sunken market court and tree plaza |
| CC01 | Warm terracotta concrete (148, 113, 99) | The plaza's seating terraces, the stairs |
| ITN01 | Grey interlock (96, 88, 90) | Upper ground: the plan's paving and pavers, the ramp |
| RP01 | Red EPDM | The trail through the rear landscape |
| SHD01 | Multi-coloured tinted shade fabric | The sails over the market court ("Pazar area") |
| 08 / 11 | LED signage / LED screen (elevation legend) | Shop signs in the portals, RETAIL PARK and GAMES on the Games hall, the screen on the west wing's corner |

**Facades** follow elevations A1/A2 (the spine's north shopfronts: curtain walls, Rusty portals with LED signs, the C-channel parapet band) and C1/C2 (the Games hall's fluted Rusty walls under the dark band with its signs, the pavilion's glass ground floor under the terracotta band, the louvred pump and LV rooms).

**Landscape.** Trees stand on the 82 tree pits drawn on the plan. The 14 raised planters are planted with shrubs and grasses. The plan's sand inside the site boundary is the landscape beds: green ground cover on warm earth, with about 60 trees and 4,100 shrubs and grasses in drifts, kept back from the paths and kerbs (`trace_plan.py` writes the positions to `landscape` in the plan JSON, and the beds as class 7 of `site_zones.png`).

**Market court.** 15 hyperbolic sails (5 × 3, curved tensioned edges, alternating high and low corners at +4.45 and +2.65 over the court floor at −1.95), 24 white masts and 8 timber stalls.

**Promenade.** The 16 food trucks as rounded pink and white pods with glazed ends, a serving hatch and an awning on the side towards the buildings, and 19 café tables by the trucks and in the tree plaza. No cars and no people.

**Light.** A summer afternoon's low sun from the west-north-west (290°, 16° up), warm, behind the site as seen from the main road, as in the project's own aerial renders. The haze is warm and kept to a layer 150 m deep, so the low sun still reaches the site; the far desert still fades out. Eye-level views stand in the buildings' shade, so each view has its own exposure (keyframed on its frame).

Two eye-level views are added after the plan view, so frames 1–7 stay as in step 1:

| View (frame) | Camera |
|---|---|
| 8 | Across the main parking to the food trucks and the Games hall |
| 9 | Along the spine's north shopfronts |

| File | What it is |
|---|---|
| `visual.py` | The finishes, facades, landscape, sails, food trucks and furniture, used by `massing.py` |
| `RetailPark_visual.blend` | The visualisation, ready to render (saved in Blender 5.1, self-contained: its two images are packed in, everything else is procedural). Render > Render Animation renders the 9 views into a `renders` folder next to the .blend. It's set to 128 samples at 1920 × 1080; raise the samples for final stills. |
| `render_visual.bat` | Double-click on Windows: rebuilds the .blend and renders the 9 views at 256 samples on the graphics card into `renders/visual/` |

To render without opening the .blend: `blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/visual` (`--views 05,07` for a subset, `--samples`, `--res`).

**Not in the drawings, so taken from the references or assumed:** the sail layout, sizes and colour order; the stall and café-table positions; the tenant signs (blank LED boards); the food trucks' look (from the reference pods); the west wing in Rusty with anthracite reveals (from the project renders); the trail in red RP01 (the project renders show it red; the schedule also lists a blue RP02 jogging path); tree and shrub species (generic shade trees, olives, shrubs, grasses and agaves).
