// Turn the tour renders into the files the 3D page loads.
//   node src/blender/export_tour.mjs <render dir> [ffmpeg]
// <render dir> holds day/ and night/, each with the scroll path path/000.webp … as rendered by
// `retail_park.py --tour 8 --path 24 --no-traffic`. Writes to assets/rp3d/<light>/:
//   path/000.webp … (the frames the scroll scrubs through, 1600 px) and path/md/ (960 px, phones),
//   poster.webp and poster-md.webp (the first view, shown until the frames arrive),
// and assets/img/rp3d-og.jpg. Needs ffmpeg with libwebp (e.g. `npx ffmpeg-static`).
// Set LIGHTS=day to export one light only.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [src, ffmpeg = "ffmpeg"] = process.argv.slice(2);
if (!src) { console.error("usage: node src/blender/export_tour.mjs <render dir> [ffmpeg]"); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "assets/rp3d");
const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const webp = (from, to, q, scale) => run(["-i", from, ...(scale ? ["-vf", scale] : []), "-c:v", "libwebp", "-quality", String(q), "-compression_level", "6", to]);

for (const light of (process.env.LIGHTS || "day,night").split(",")) {
  const dir = path.join(src, light, "path");
  if (!fs.existsSync(dir)) continue;
  const frames = fs.readdirSync(dir).filter((f) => /^\d{3}\.(webp|png)$/.test(f)).sort();
  const out = path.join(OUT, light);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, "path/md"), { recursive: true });
  for (const f of frames) {
    const name = f.replace(/\.\w+$/, ".webp");
    webp(path.join(dir, f), path.join(out, "path", name), 70);
    webp(path.join(dir, f), path.join(out, "path/md", name), 68, "scale=960:-2");
  }
  webp(path.join(dir, frames[0]), path.join(out, "poster.webp"), 78);
  webp(path.join(dir, frames[0]), path.join(out, "poster-md.webp"), 72, "scale=960:-2");
  if (light === "day") run(["-i", path.join(dir, frames[0]), "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-q:v", "3", path.join(ROOT, "assets/img/rp3d-og.jpg")]);
  const size = (d) => fs.readdirSync(d).reduce((n, f) => n + fs.statSync(path.join(d, f)).size, 0) / 1e6;
  console.log(`${light}: ${frames.length} frames, ${size(path.join(out, "path")).toFixed(1)} MB (1600 px), ${size(path.join(out, "path/md")).toFixed(1)} MB (960 px)`);
}
