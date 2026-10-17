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
| `massing.py` | Builds the massing in Blender (4.2 or newer): white blocks at the section levels, the sunken court and plaza, 7 cameras. `--env desert` (default) or `--env plain`. |
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

To render without opening the .blend: `blender -b --factory-startup -P src/blender/massing.py -- --gpu --out renders/massing` (`--views 00,06` for a subset, `--samples`, `--res`; `--env plain` for the grey card with edge lines). Building the scene takes about 10 seconds; on a graphics card each view takes well under a minute at 128 samples.
