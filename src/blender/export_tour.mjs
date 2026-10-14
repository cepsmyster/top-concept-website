// Turn the tour renders into the files the 3D page loads.
//   node src/blender/export_tour.mjs <render dir> [ffmpeg]
// <render dir> holds day/ and night/, each with one folder of frames per clip (s0/000.webp …, t0f/000.webp …),
// as written by `retail_park.py --tour 8`. Writes to assets/rp3d/<light>/:
//   s0.mp4 … (2-second traffic loop at each stop), t0f.mp4 / t0b.mp4 … (1-second flight to the next / previous stop),
//   each also as -md (960 px, phones) and as VP9 .webm for browsers without H.264,
//   plus s0.webp … (first frame of each stop, 1600 px and -md) for the poster and reduced motion,
// and assets/img/rp3d-og.jpg. Needs ffmpeg with libx264, libvpx-vp9 and libwebp (e.g. `npx ffmpeg-static`).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [src, ffmpeg = "ffmpeg"] = process.argv.slice(2);
if (!src) { console.error("usage: node src/blender/export_tour.mjs <render dir> [ffmpeg]"); process.exit(1); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "assets/rp3d");
const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

// Renders from RetailPark_*.blend (Render Animation) come as one sequence frame_0001 … in the order of
// tour_clips() in retail_park.py: the loops s0 … s7 (48 frames each), then t0f, t0b, t1f, t1b … (24 each).
// Split them into clip folders first.
const STOPS = +(process.env.STOPS || 8), LOOP = +(process.env.LOOP || 48), FLIGHT = +(process.env.FLIGHT || 24);
function splitSequence(dir) {
  const seq = fs.readdirSync(dir).filter((f) => /^frame_\d+\.(webp|png)$/.test(f)).sort();
  if (!seq.length) return dir;
  const order = [...Array.from({ length: STOPS }, (_, i) => [`s${i}`, LOOP]), ...Array.from({ length: STOPS }, (_, i) => [[`t${i}f`, FLIGHT], [`t${i}b`, FLIGHT]]).flat()];
  const tmp = fs.mkdtempSync(path.join(src, ".split-"));
  let n = 0;
  for (const [clip, count] of order) {
    fs.mkdirSync(path.join(tmp, clip));
    for (let k = 0; k < count && n < seq.length; k++, n++) fs.copyFileSync(path.join(dir, seq[n]), path.join(tmp, clip, `${String(k).padStart(3, "0")}${path.extname(seq[n])}`));
  }
  return tmp;
}

let dayDir = null;
const LIGHTS = (process.env.LIGHTS || "day,night").split(","); // e.g. LIGHTS=day while night is still rendering
for (const light of LIGHTS) {
  if (!fs.existsSync(path.join(src, light))) continue;
  const dir = splitSequence(path.join(src, light));
  if (light === "day") dayDir = dir;
  const out = path.join(OUT, light);
  fs.mkdirSync(out, { recursive: true });
  for (const clip of fs.readdirSync(dir).filter((d) => /^(s\d+|t\d+[fb])$/.test(d)).sort()) {
    const frames = fs.readdirSync(path.join(dir, clip)).filter((f) => /^\d{3}\.(webp|png)$/.test(f)).sort();
    if (!frames.length) continue;
    const ext = path.extname(frames[0]);
    const input = ["-framerate", "24", "-i", path.join(dir, clip, `%03d${ext}`)];
    const flight = clip.startsWith("t");
    // One keyframe per clip: the static camera of a loop compresses to a quarter of the size, with no visible
    // loss at these settings. The page holds the clips in memory, so seeking into one stays instant.
    const gop = String(frames.length);
    for (const [sfx, scale, crf, vcrf] of [["", "scale=trunc(iw/2)*2:trunc(ih/2)*2", flight ? 26 : 24, flight ? 38 : 36], ["-md", "scale=960:-2", flight ? 28 : 26, flight ? 40 : 38]]) {
      const base = path.join(out, clip + sfx);
      run([...input, "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-tune", "film", "-crf", String(crf), "-g", gop, "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", base + ".mp4"]);
      run([...input, "-vf", scale, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(vcrf), "-g", gop, "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", "-an", base + ".webm"]);
      if (!flight) run(["-i", path.join(dir, clip, frames[0]), "-vf", scale, "-c:v", "libwebp", "-quality", sfx ? "72" : "78", base + ".webp"]);
    }
    console.log(light, clip, frames.length, "frames");
  }
}
const og = dayDir && fs.readdirSync(path.join(dayDir, "s0")).map((f) => path.join(dayDir, "s0", f)).sort()[0];
if (og) run(["-i", og, "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-q:v", "3", path.join(ROOT, "assets/img/rp3d-og.jpg")]);
for (const light of ["day", "night"]) {
  const d = path.join(OUT, light);
  if (!fs.existsSync(d)) continue;
  const bytes = fs.readdirSync(d).reduce((n, f) => n + (fs.statSync(path.join(d, f)).isFile() ? fs.statSync(path.join(d, f)).size : 0), 0);
  console.log(`${light}: ${(bytes / 1e6).toFixed(1)} MB`);
}
for (const f of fs.readdirSync(src)) if (f.startsWith(".split-")) fs.rmSync(path.join(src, f), { recursive: true, force: true });
