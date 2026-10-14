# Retail Park in 3D: rendering

The 3D page (`retail-park-3d.html`) is a fly-round of Retail Park, rendered in Blender from code only (no downloaded models, textures or HDRIs). Scrolling drives the camera directly, as with the 3D model on the home page: the section is pinned, the page's smooth scroll feeds a position, and the camera eases towards it, scrubbing through 169 still frames (24 between each of 8 views round the park, about 2° apart) that are blended into each other on a canvas. Each view holds for a stretch of the scroll. The main road is shown without moving traffic, which keeps the page light; parked cars stay.

The camera sits low and close (about 25° down, 26 mm lens, horizon in view), after the reference [belgradearbor.rs/en/3d](https://belgradearbor.rs/en/3d). Trees are open, branching street trees with loose leaf clumps.

| File | What it is |
|---|---|
| `retail_park.py` | Builds the scene from scratch (layout from `src/model3d.mjs`), renders the scroll path (`--tour 8 --path 24 --no-traffic`) or saves a .blend file. Blender 4.2 or newer, including 5.x. |
| `RetailPark_day.blend`, `RetailPark_night.blend` | The scene with an earlier tour animation (views with traffic loops and flights, frames 1–768). Useful for looking round or test renders; the page uses the path render below. |
| `render_all.bat` / `render_all.sh` | Render the day and night paths on the graphics card. |
| `export_tour.mjs` | Turns the renders into the files the page loads (`assets/rp3d/…`). |

Settings: 1600 × 900, 128 samples with denoising, WebP frames. On an RTX 5070 about 5 s per frame, so about 15 minutes for each light.

## Render

From a terminal at the top of the repo (Windows: `render_all.bat`, or use the full path to `blender.exe`):

```
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light day   --tour 8 --path 24 --no-traffic --samples 128 --out renders/day
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light night --tour 8 --path 24 --no-traffic --samples 128 --out renders/night
```

Frames go to `renders/<light>/path/000.webp` … Finished frames are skipped, so you can stop and start again. To check the framing of the 8 views first: `--tour 8 --clips s0,s1,s2,s3,s4,s5,s6,s7 --still --res 800x450 --samples 32`.

## Export for the site

```
node src/blender/export_tour.mjs renders [path/to/ffmpeg]     # ffmpeg with libwebp (npx ffmpeg-static works); LIGHTS=day for one light
node src/build.mjs
```

This writes `assets/rp3d/<light>/path/000.webp` … (1600 px, about 13 MB for a light), `path/md/` (960 px for phones), `poster.webp` / `poster-md.webp`, and `assets/img/rp3d-og.jpg`. Don't commit the raw renders. The Day / Night switch on the page appears only once `assets/rp3d/night/` has been exported (then run `node src/build.mjs` again).

## Changing the scene

Edit `retail_park.py`, render, export. The tour camera is `place_tour()` (`TOUR_RX`, `TOUR_RY`, `TOUR_H`, `TOUR_LOOK`, `--lens`); the view names on the page are `VIEWS` in `src/build.mjs`, in the same order. How long each view holds is `HOLD` in `assets/js/rp3d.js`. To refresh the .blend files:

```
blender -b --factory-startup -P src/blender/retail_park.py -- --light day   --tour 8 --blend src/blender/RetailPark_day.blend
blender -b --factory-startup -P src/blender/retail_park.py -- --light night --tour 8 --blend src/blender/RetailPark_night.blend
```

Notes on the scene: the connector between the buildings has a plain roof (no parking on it). Behind it runs the rear road at ground level, with a row of parking on its far side.
