# Retail Park in 3D: rendering

The 3D page (`retail-park-3d.html`) is a fly-round of Retail Park, by day and by night, rendered in Blender from code only (no downloaded models, textures or HDRIs). Scrolling the page flies the camera between eight views round the park. Traffic on the roads keeps moving the whole time:

- each view has a 2-second traffic loop (`s0` … `s7`, 48 frames);
- neighbouring views are joined by 1-second flights (`t0f` = view 0 → 1, `t1b` = view 1 → 0, …, 24 frames). A flight leaves at the start of the traffic cycle and lands half-way through it, where the player picks up the next view's loop, so cars never stop or run backwards.

The camera sits low and close (about 25° down, 26 mm lens, horizon in view), after the reference [belgradearbor.rs/en/3d](https://belgradearbor.rs/en/3d). Trees are open, branching street trees with loose leaf clumps.

| File | What it is |
|---|---|
| `retail_park.py` | Builds the scene from scratch (layout from `src/model3d.mjs`) and renders the tour (`--tour 8`) or saves a .blend file. Blender 4.2 or newer, including 5.x. |
| `RetailPark_day.blend`, `RetailPark_night.blend` | Ready-to-render scenes: frames 1–768 are the tour clips one after another (the loops s0 … s7, then t0f, t0b, t1f, t1b …). Output: `renders/day/frame_0001.webp` … next to the .blend file. |
| `render_all.bat` / `render_all.sh` | Render the whole tour on the graphics card, straight from `retail_park.py`. |
| `export_tour.mjs` | Turns the renders into the files the page loads (`assets/rp3d/…`). |

Settings: 1600 × 900, 128 samples with denoising, WebP frames. On an RTX 5070: about 6 s per frame, so about 75 minutes for each of day and night (2 × 768 frames).

## Render

From a terminal at the top of the repo (Windows: `render_all.bat`, or use the full path to `blender.exe`):

```
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light day   --tour 8 --samples 128 --out renders/day
blender -b --factory-startup -P src/blender/retail_park.py -- --gpu --format webp --light night --tour 8 --samples 128 --out renders/night
```

Each clip goes in its own folder (`renders/day/s0/000.webp` …). Finished frames are skipped, so you can stop and start again. To check the framing first: add `--clips s0,s1,s2,s3,s4,s5,s6,s7 --still --res 800x450 --samples 32`.

Or open a .blend file and choose **Render → Render Animation** (Cycles on the GPU: Edit → Preferences → System → OptiX). From the command line: `blender -b src/blender/RetailPark_day.blend -a -- --cycles-device OPTIX`.

## Export for the site

```
node src/blender/export_tour.mjs renders [path/to/ffmpeg]     # ffmpeg with libx264, libvpx-vp9, libwebp (npx ffmpeg-static works)
node src/build.mjs
```

This writes `assets/rp3d/{day,night}/` with `s0.mp4` … and `t0f.mp4` … (1600 px), `-md` copies at 960 px for phones, VP9 `.webm` copies for browsers without H.264, a still of each view (`s0.webp`, `s0-md.webp`, used as the poster and with reduced motion) and `assets/img/rp3d-og.jpg`. It also accepts the `frame_0001.webp` … sequence rendered from the .blend files. Don't commit the raw renders. The Day / Night switch on the page appears only once `assets/rp3d/night/` has been exported (then run `node src/build.mjs` again).

## Changing the scene

Edit `retail_park.py`, render, export. The tour camera is `place_tour()` (`TOUR_RX`, `TOUR_RY`, `TOUR_H`, `TOUR_LOOK`, `--lens`); the view names on the page are `VIEWS` in `src/build.mjs`, in the same order. To refresh the .blend files:

```
blender -b --factory-startup -P src/blender/retail_park.py -- --light day   --tour 8 --blend src/blender/RetailPark_day.blend
blender -b --factory-startup -P src/blender/retail_park.py -- --light night --tour 8 --blend src/blender/RetailPark_night.blend
```

Notes on the scene: the connector between the buildings has a plain roof (no parking on it). Behind it runs the rear road at ground level, with a row of parking on its far side.
