// Turn the tour render into the files the 3D page loads.
//   node src/blender/export_tour.mjs <render dir> [ffmpeg]
// <render dir> holds day/ and night/, each with film/0000.webp … as rendered by
// `retail_park.py --tour 8 --path 120 --ease --no-traffic`: the camera glides from view to view, 2 seconds
// at 60 fps each, easing in and out of every view. Writes to assets/rp3d/<light>/:
//   film.mp4 (forward) and film-rev.mp4 (the same frames backwards, for scrolling up), 1600 px,
//   -md copies at 960 px for phones, VP9 .webm copies for browsers without H.264,
//   poster.webp / poster-md.webp (the first view, shown until the film is ready),
// and assets/img/rp3d-og.jpg. Every view starts a keyframe, so the page can jump to any view at once.
// Needs ffmpeg with libx264, libvpx-vp9 and libwebp (e.g. `npx ffmpeg-static`). LIGHTS=day exports one light.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [src, ffmpeg = "ffmpeg"] = process.argv.slice(2);
if (!src) { console.error("usage: node src/blender/export_tour.mjs <render dir> [ffmpeg]"); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "assets/rp3d");
const STEP = +(process.env.STEP || 120); // frames from one view to the next
const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

for (const light of (process.env.LIGHTS || "day,night").split(",")) {
  const dir = path.join(src, light, "film");
  if (!fs.existsSync(dir)) continue;
  const frames = fs.readdirSync(dir).filter((f) => /^\d{4}\.(webp|png)$/.test(f)).sort();
  const ext = path.extname(frames[0]);
  // the reversed film: the same frames numbered backwards
  const rev = fs.mkdtempSync(path.join(src, ".rev-"));
  frames.forEach((f, i) => fs.copyFileSync(path.join(dir, f), path.join(rev, String(frames.length - 1 - i).padStart(4, "0") + ext)));
  const out = path.join(OUT, light);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const keys = ["-force_key_frames", `expr:eq(mod(n,${STEP}),0)`, "-g", String(STEP)];
  for (const [name, from] of [["film", dir], ["film-rev", rev]]) {
    const input = ["-framerate", "60", "-i", path.join(from, `%04d${ext}`)];
    for (const [sfx, scale, crf, vcrf] of [["", "scale=trunc(iw/2)*2:trunc(ih/2)*2", 27, 40], ["-md", "scale=960:-2", 28, 42]]) {
      const base = path.join(out, name + sfx);
      run([...input, "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-tune", "film", "-crf", String(crf), ...keys, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", base + ".mp4"]);
      run([...input, "-vf", scale, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(vcrf), ...keys, "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", "-pix_fmt", "yuv420p", "-an", base + ".webm"]);
    }
  }
  fs.rmSync(rev, { recursive: true, force: true });
  run(["-i", path.join(dir, frames[0]), "-c:v", "libwebp", "-quality", "78", path.join(out, "poster.webp")]);
  run(["-i", path.join(dir, frames[0]), "-vf", "scale=960:-2", "-c:v", "libwebp", "-quality", "72", path.join(out, "poster-md.webp")]);
  if (light === "day") run(["-i", path.join(dir, frames[0]), "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-q:v", "3", path.join(ROOT, "assets/img/rp3d-og.jpg")]);
  const mb = (f) => (fs.statSync(path.join(out, f)).size / 1e6).toFixed(1);
  console.log(`${light}: ${frames.length} frames; film.mp4 ${mb("film.mp4")} MB + rev ${mb("film-rev.mp4")} MB; phones ${mb("film-md.mp4")} + ${mb("film-rev-md.mp4")} MB`);
}
