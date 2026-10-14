/* Retail Park in 3D (retail-park-3d.html)
   A fly-round rendered in Blender (src/blender/retail_park.py --tour 8): eight views round the park.
   Scrolling the page flies the camera from view to view. The traffic never stops: a 2-second loop plays at
   each view, and a 1-second flight joins neighbouring views, landing half-way into the next view's loop,
   so cars keep driving forward whichever way you scroll. The pointer drifts the picture slightly.
   Clips are fetched as blobs, nearest views first, so each flight starts at once; phones get the 960 px set. */
(() => {
  const root = document.querySelector("[data-rp3d]");
  if (!root) return;
  const N = +root.dataset.stops || 8;
  const BASE = root.dataset.base || "assets/rp3d/";
  const LAND = 1; // seconds into a stop's loop where a flight from a neighbour lands
  const media = root.querySelector("[data-rp3d-media]");
  const vids = [...root.querySelectorAll("[data-rp3d-video]")];
  const poster = root.querySelector("[data-rp3d-poster]");
  const dots = [...root.querySelectorAll("[data-rp3d-go]")];
  const nameEl = root.querySelector("[data-rp3d-name]");
  const lightBtns = [...root.querySelectorAll("[data-rp3d-light]")];
  const bar = root.querySelector("[data-rp3d-progress]");
  const hint = root.querySelector("[data-rp3d-hint]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 900px)").matches;
  const sfx = small ? "-md" : "";
  const ext = vids[0].canPlayType('video/mp4; codecs="avc1.640028"') ? "mp4" : "webm";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const once = (el, ev) => new Promise((res, rej) => {
    const ok = () => { el.removeEventListener("error", bad); res(); };
    const bad = () => { el.removeEventListener(ev, ok); rej(new Error("video")); };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });

  // ───── clips: fetched as blobs, nearest to the current view first ─────
  const cache = new Map(); // "day/t3f" → Promise<object URL>
  const waiting = [];
  let active = 0, loadedDay = 0;
  const total = N * 3;
  const fileOf = (light, name) => `${BASE}${light}/${name}${sfx}.${ext}`;
  function queue(light, from) {
    for (let d = 0; d <= N; d++) for (const i of d ? [from + d, from - d] : [from]) {
      if (i < 0 || i >= N) continue;
      enqueue(light, `s${i}`);
      if (i < N - 1) enqueue(light, `t${i}f`);
      if (i > 0) enqueue(light, `t${i}b`);
    }
    pump();
  }
  function enqueue(light, name) {
    const key = `${light}/${name}`;
    if (cache.has(key)) return;
    let start;
    // a failed fetch falls back to streaming the file itself
    const p = new Promise((r) => (start = r)).then(() =>
      fetch(fileOf(light, name)).then((r) => (r.ok ? r.blob() : Promise.reject())).then((b) => URL.createObjectURL(b), () => fileOf(light, name))
        .finally(() => { active--; if (light === "day") progress(++loadedDay); pump(); }));
    p.start = start;
    cache.set(key, p);
    waiting.push(p);
  }
  function pump() {
    while (active < 2 && waiting.length) { const p = waiting.shift(); p.started = true; active++; p.start(); }
  }
  function clip(light, name) { // needed now: jump the queue
    enqueue(light, name);
    const p = cache.get(`${light}/${name}`);
    if (!p.started) { waiting.splice(waiting.indexOf(p), 1); p.started = true; active++; p.start(); }
    return p;
  }
  function progress(n) {
    if (!bar) return;
    bar.style.transform = `scaleX(${Math.min(1, n / total)})`;
    if (n >= total) root.classList.add("is-loaded");
  }

  // ───── two stacked video layers: the new clip fades in over the old one ─────
  let top = -1;
  const other = () => vids[top === 0 ? 1 : 0];
  async function load(v, url, t, loop) {
    v.loop = loop;
    v.playbackRate = 1;
    if (v.dataset.src !== url) { v.dataset.src = url; v.src = url; await once(v, "loadeddata"); }
    if (Math.abs(v.currentTime - t) > 0.01) { const p = once(v, "seeked"); v.currentTime = t; await p; }
  }
  async function swap(v, ms) {
    const old = vids[top];
    top = vids.indexOf(v);
    v.style.transition = ms ? `opacity ${ms}ms linear` : "none";
    v.style.zIndex = 2;
    if (old && old !== v) old.style.zIndex = 1;
    v.getBoundingClientRect();
    v.classList.add("is-on");
    root.classList.add("is-live");
    await sleep(ms + 40);
    if (old && old !== v && vids[top] !== old) { old.style.transition = "none"; old.classList.remove("is-on"); old.pause(); }
  }

  // ───── state: the view shown (`at`), the view the scroll asks for (`target`), day or night ─────
  let at = 0, target = 0, light = "day", shown = null, running = false;
  const names = dots.map((d) => d.dataset.name);
  function ui() {
    dots.forEach((d, i) => d.setAttribute("aria-current", i === at ? "true" : "false"));
    if (nameEl) nameEl.textContent = names[at] || "";
  }
  function setPoster(i) {
    if (!poster) return;
    const b = `${BASE}${light}/s${i}`;
    poster.srcset = `${b}-md.webp 960w, ${b}.webp 1600w`;
  }
  async function start() {
    const v = vids[0];
    await load(v, await clip(light, `s${at}`), 0, true);
    await v.play();
    shown = light;
    await swap(v, 400);
  }
  async function fly() {
    const dir = Math.sign(target - at), from = at, to = at + dir;
    const v = other(), cur = vids[top];
    await load(v, await clip(light, `t${from}${dir > 0 ? "f" : "b"}`), 0, false);
    v.playbackRate = Math.abs(target - at) > 1 ? 1.7 : 1; // hurry through views the scroll has already passed
    // A flight starts where the traffic loop starts. When the loop is about to come round, wait for it:
    // the cars then carry straight on into the flight. Otherwise a quick fade covers the jump.
    let fade = 260;
    if (cur && cur.loop && cur.duration) {
      const left = cur.duration - cur.currentTime;
      if (left < 0.45) { await sleep(Math.max(0, left * 1000 - 25)); fade = 80; }
    }
    const ended = once(v, "ended");
    await v.play();
    at = to; ui();
    await swap(v, fade);
    shown = light;
    if (at !== target) return ended.catch(() => {});
    // land: the next view's loop waits, paused at the moment the flight ends, in the other layer
    const lv = other();
    await load(lv, await clip(light, `s${at}`), LAND, true);
    await ended.catch(() => {});
    await lv.play();
    await swap(lv, 0);
  }
  async function relight() { // same view, other light: fade across at the same moment of the loop
    const cur = vids[top], v = other(), l = light;
    await load(v, await clip(l, `s${at}`), 0, true);
    const p = once(v, "seeked");
    v.currentTime = (cur.currentTime + 0.06) % cur.duration;
    await p;
    await v.play();
    shown = l;
    await swap(v, 700);
  }
  async function kick() {
    if (running || reduce) return;
    running = true;
    try {
      if (shown === null) await start();
      while (at !== target || shown !== light) {
        if (at !== target) await fly(); else await relight();
      }
    } catch (e) {
      root.classList.add("is-still"); // no video: the stills take over
      vids.forEach((v) => v.pause());
      at = target; ui(); setPoster(at);
    } finally {
      running = false;
    }
  }

  // ───── scroll: the section is tall and the picture stays pinned; each slice of it is one view ─────
  function onScroll() {
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const p = clamp(-r.top / span, 0, 0.9999);
    const t = Math.floor(p * N);
    if (-r.top > 40 && hint) hint.classList.add("is-hidden");
    if (t === target) return;
    target = t;
    if (reduce || root.classList.contains("is-still")) { at = t; ui(); setPoster(t); return; }
    queue(light, t);
    kick();
  }
  function go(i) {
    i = clamp(i, 0, N - 1);
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    window.scrollTo({ top: scrollY + r.top + span * (i + 0.5) / N, behavior: reduce ? "auto" : "smooth" });
  }
  dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
  root.querySelectorAll("[data-rp3d-step]").forEach((b) => b.addEventListener("click", () => go(target + +b.dataset.rp3dStep)));
  lightBtns.forEach((b) => b.addEventListener("click", () => {
    const l = b.dataset.rp3dLight;
    if (l === light) return;
    light = l;
    lightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    root.classList.toggle("is-night", l === "night");
    if (reduce || root.classList.contains("is-still")) { setPoster(at); return; }
    queue(l, at);
    kick();
  }));

  // ───── pointer drift: the picture leans a little towards the pointer ─────
  let mx = 0, my = 0, cx = 0, cy = 0, raf = 0;
  const drift = () => {
    cx += (mx - cx) * 0.06;
    cy += (my - cy) * 0.06;
    media.style.transform = `translate3d(${(-cx * 1.6).toFixed(3)}%, ${(-cy * 1.2).toFixed(3)}%, 0) scale(1.07)`;
    raf = Math.abs(mx - cx) + Math.abs(my - cy) > 0.0005 ? requestAnimationFrame(drift) : 0;
  };
  if (!reduce && matchMedia("(hover: hover)").matches) {
    root.addEventListener("pointermove", (e) => {
      mx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
      my = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      if (!raf) raf = requestAnimationFrame(drift);
    });
    root.addEventListener("pointerleave", () => { mx = my = 0; if (!raf) raf = requestAnimationFrame(drift); });
  }

  // ───── start: pause while the section is off screen ─────
  ui();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
  if (reduce) { root.classList.add("is-still"); return; }
  queue("day", target);
  kick();
  new IntersectionObserver(([e]) => {
    const v = vids[top];
    if (!v || root.classList.contains("is-still")) return;
    if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
  }).observe(root);
  if (!lightBtns.length) return; // no night set yet
  const lazyNight = () => queue("night", target);
  if ("requestIdleCallback" in window) requestIdleCallback(() => setTimeout(lazyNight, 4000)); else setTimeout(lazyNight, 6000);
})();
