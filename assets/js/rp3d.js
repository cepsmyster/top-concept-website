/* Retail Park in 3D (retail-park-3d.html)
   A photoreal orbit rendered in Blender (src/blender/retail_park.py): one image per 6° for day and for night.
   Drag (or the arrow keys / buttons) to turn; the slider blends day into night. At the home view a short
   video loop plays the traffic on the main road. Frames load nearest-first; phones get the 960 px set. */
(() => {
  const root = document.querySelector("[data-rp3d]");
  if (!root) return;
  const N = +root.dataset.frames || 60;
  const HOME = +root.dataset.home || 0;
  const BASE = root.dataset.base || "assets/rp3d/";
  const stage = root.querySelector("[data-rp3d-stage]");
  const canvas = root.querySelector("[data-rp3d-canvas]");
  const ctx = canvas.getContext("2d");
  const range = root.querySelector("[data-rp3d-time]");
  const bar = root.querySelector("[data-rp3d-progress]");
  const hint = root.querySelector("[data-rp3d-hint]");
  const videos = { day: root.querySelector('[data-rp3d-loop="day"]'), night: root.querySelector('[data-rp3d-loop="night"]') };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 900px)").matches;
  const dir = small ? "md/" : "";
  const pad = (i) => String(i).padStart(3, "0");
  const wrap = (i) => ((i % N) + N) % N;

  // ───── frame loading: nearest to the current view first, day before night ─────
  const sets = { day: new Array(N), night: new Array(N) };
  const queue = [];
  let active = 0;
  let loadedDay = 0;
  const order = (from) => {
    const out = [wrap(from)];
    for (let d = 1; out.length < N; d++) out.push(wrap(from + d), wrap(from - d));
    return out.slice(0, N);
  };
  function enqueue(set, list, front) {
    const jobs = list.filter((i) => !sets[set][i]).map((i) => [set, i]);
    if (front) queue.unshift(...jobs); else queue.push(...jobs);
    pump();
  }
  function pump() {
    while (active < 6 && queue.length) {
      const [set, i] = queue.shift();
      if (sets[set][i]) continue;
      const im = new Image();
      im.decoding = "async";
      sets[set][i] = im; // reserve; `ready` flips when decoded
      active++;
      im.onload = () => {
        const done = () => { im.ready = true; active--; if (set === "day") { loadedDay++; progress(); } draw(); pump(); };
        im.decode ? im.decode().then(done, done) : done();
      };
      im.onerror = () => { active--; pump(); };
      im.src = `${BASE}${set}/${dir}f${pad(i)}.webp`;
    }
  }
  function progress() {
    if (!bar) return;
    bar.style.transform = `scaleX(${loadedDay / N})`;
    if (loadedDay === N) root.classList.add("is-loaded");
  }

  // ───── drawing: cover-fit like the poster and the videos ─────
  let pos = HOME; // fractional frame
  let t = 0; // 0 day → 1 night
  function nearest(set, i) {
    for (let d = 0; d < N / 2; d++) {
      for (const k of [wrap(i + d), wrap(i - d)]) if (sets[set][k] && sets[set][k].ready) return sets[set][k];
    }
    return null;
  }
  function size() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    draw();
  }
  function blit(im, alpha) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  let raf = 0;
  function draw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = wrap(Math.round(pos));
      const day = t < 1 ? nearest("day", i) : null;
      const night = t > 0 ? nearest("night", i) : null;
      if (!day && !night) return;
      if (day) blit(day, 1);
      if (night) blit(night, day ? t : 1);
      ctx.globalAlpha = 1;
      root.classList.add("is-live");
      syncLoop();
    });
  }

  // ───── traffic loop at the home view ─────
  let atRest = true;
  let loopsOn = false;
  function syncLoop() {
    const home = wrap(Math.round(pos)) === HOME && atRest && !reduce;
    if (home && !loopsOn) startLoops();
    const ready = videos.day.readyState >= 3 && (t === 0 || videos.night.readyState >= 3);
    root.classList.toggle("show-loop", home && loopsOn && ready);
  }
  function startLoops() {
    loopsOn = true;
    for (const [k, v] of Object.entries(videos)) {
      if (!v.src) {
        v.src = `${BASE}${k}-loop${small ? "-md" : ""}.mp4`;
        v.addEventListener("canplay", syncLoop);
      }
    }
    Promise.all(Object.values(videos).map((v) => v.play().catch(() => {}))).then(() => { videos.night.currentTime = videos.day.currentTime; });
  }
  // keep the night loop in step with the day loop so the blend never doubles a car
  videos.day.addEventListener("timeupdate", () => {
    if (Math.abs(videos.night.currentTime - videos.day.currentTime) > 0.06) videos.night.currentTime = videos.day.currentTime;
  });

  // ───── input: drag with inertia, keys, buttons ─────
  let vel = 0, dragging = false, lastX = 0, lastT = 0, anim = 0;
  const perPx = () => N / (stage.clientWidth * 1.6); // a drag across 1.6 widths turns a full circle
  function settle() {
    cancelAnimationFrame(anim);
    const step = () => {
      if (dragging) return;
      if (Math.abs(vel) > 0.002 && !reduce) {
        pos += vel;
        vel *= 0.93;
        draw();
        anim = requestAnimationFrame(step);
        return;
      }
      vel = 0;
      // close to the home view: glide onto it so the traffic loop can play
      const off = ((pos - HOME) % N + N + N / 2) % N - N / 2;
      if (Math.abs(off) < 2.5 && Math.abs(off) > 0.01) return turnTo(pos - off);
      pos = Math.round(pos);
      atRest = true;
      draw();
    };
    anim = requestAnimationFrame(step);
  }
  function turnTo(target) {
    cancelAnimationFrame(anim);
    const from = pos, d = target - from, t0 = performance.now(), dur = reduce ? 0 : Math.min(900, 120 + Math.abs(d) * 60);
    atRest = false;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      pos = from + d * (1 - Math.pow(1 - k, 3));
      draw();
      if (k < 1) anim = requestAnimationFrame(step);
      else { pos = Math.round(target); atRest = true; draw(); }
    };
    anim = requestAnimationFrame(step);
  }
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true; atRest = false; vel = 0;
    lastX = e.clientX; lastT = performance.now();
    cancelAnimationFrame(anim);
    stage.setPointerCapture(e.pointerId);
    root.classList.add("is-dragging");
    root.classList.remove("show-loop");
    hint && hint.classList.add("is-hidden");
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dp = -(e.clientX - lastX) * perPx();
    pos += dp;
    vel = vel * 0.6 + (dp / Math.max(8, now - lastT)) * 16 * 0.4;
    lastX = e.clientX; lastT = now;
    draw();
  });
  const end = () => { if (!dragging) return; dragging = false; root.classList.remove("is-dragging"); settle(); };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    turnTo(Math.round(pos) + (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 5 : 1));
  });
  root.querySelectorAll("[data-rp3d-turn]").forEach((b) => b.addEventListener("click", () => turnTo(Math.round(pos) + +b.dataset.rp3dTurn * N / 8)));
  range.addEventListener("input", () => {
    t = range.value / 100;
    root.style.setProperty("--night", t);
    if (t > 0) enqueue("night", order(Math.round(pos)), true);
    draw();
  });

  // ───── start ─────
  new ResizeObserver(size).observe(stage);
  enqueue("day", order(HOME));
  // night frames follow once the day set is in (or straight away when the slider moves)
  const lazyNight = () => enqueue("night", order(HOME));
  if ("requestIdleCallback" in window) requestIdleCallback(() => setTimeout(lazyNight, 1500)); else setTimeout(lazyNight, 3000);
})();
