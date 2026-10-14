/* Retail Park in 3D (retail-park-3d.html)
   A fly-round rendered in Blender (src/blender/retail_park.py --tour 8 --path 120 --ease): eight views round
   the park joined by 2-second glides at 60 fps that ease in and out of every view. The section is pinned and
   each slice of the page scroll is one view; scrolling into the next slice plays the film on to that view,
   like the view-to-view moves on belgradearbor.rs/en/3d. Scrolling back plays a reversed copy of the film.
   The two only swap at a view, where they show the same frame, so the switch can't be seen. Every view
   starts a keyframe, so landing on it exactly is instant. The pointer leans the picture slightly. */
(() => {
  const root = document.querySelector("[data-rp3d]");
  if (!root) return;
  const N = +root.dataset.stops || 8; // views
  const STEP = +root.dataset.step || 2; // seconds of film from one view to the next
  const T = (N - 1) * STEP;
  const BASE = root.dataset.base || "assets/rp3d/";
  const media = root.querySelector("[data-rp3d-media]");
  const fwd = root.querySelector('[data-rp3d-film="fwd"]');
  const rev = root.querySelector('[data-rp3d-film="rev"]');
  const snap = root.querySelector("[data-rp3d-snap]");
  const dots = [...root.querySelectorAll("[data-rp3d-go]")];
  const nameEl = root.querySelector("[data-rp3d-name]");
  const lightBtns = [...root.querySelectorAll("[data-rp3d-light]")];
  const bar = root.querySelector("[data-rp3d-progress]");
  const hint = root.querySelector("[data-rp3d-hint]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 900px)").matches;
  const ext = fwd.canPlayType('video/mp4; codecs="avc1.640028"') ? "mp4" : "webm";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const file = (light, name) => `${BASE}${light}/${name}${small ? "-md" : ""}.${ext}`;
  // the middle of the frame a view is on, so a seek always lands on that exact frame (a keyframe)
  const FPS = 60;
  const timeIn = (v, view) => (Math.round((v === fwd ? view * STEP : T - view * STEP) * FPS) + 0.5) / FPS;

  let light = "day";
  let at = 0;      // the view the camera is on (or last passed)
  let target = 0;  // the view the scroll asks for
  let running = false;
  let shown = fwd;

  const ready = (v) => (v.readyState >= 2 ? Promise.resolve() : new Promise((r) => v.addEventListener("loadeddata", r, { once: true })));
  const seek = (v, t) => new Promise((r) => {
    if (Math.abs(v.currentTime - t) < 0.001) return r();
    v.addEventListener("seeked", () => r(), { once: true });
    v.currentTime = t;
  });
  function show(v) {
    if (v === shown) return;
    v.classList.add("is-on");
    shown.classList.remove("is-on");
    shown = v;
  }
  function ui() {
    dots.forEach((d, i) => d.setAttribute("aria-current", i === at ? "true" : "false"));
    if (nameEl) nameEl.textContent = dots[at] ? dots[at].dataset.name : "";
  }

  // ride the film from view to view until the camera is on the view the scroll asks for
  function ride(v, dir) {
    return new Promise((done) => {
      let next = at + dir;
      v.playbackRate = Math.abs(target - at) > 1 ? 2 : 1;
      const tick = () => {
        const pos = v === fwd ? v.currentTime / STEP : (T - v.currentTime) / STEP; // in views
        if ((pos - next) * dir >= -0.002 || v.ended) {
          at = next; ui();
          if ((target - at) * dir > 0) { // the scroll has moved on: keep going
            next = at + dir;
            v.playbackRate = Math.abs(target - at) > 1 ? 2 : 1;
          } else { // land exactly on the view (a keyframe)
            v.pause();
            seek(v, timeIn(v, at)).then(done);
            return;
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  async function go() {
    if (running) return;
    running = true;
    try {
      while (target !== at) {
        if (reduce) { await ready(fwd); await seek(fwd, timeIn(fwd, target)); show(fwd); at = target; ui(); break; }
        const dir = Math.sign(target - at);
        const v = dir > 0 ? fwd : rev;
        await ready(v);
        await seek(v, timeIn(v, at)); // the same frame that is showing now
        show(v);
        await v.play();
        await ride(v, dir);
      }
    } catch (e) {
      root.classList.remove("is-live"); // no video: the poster stays
    } finally {
      running = false;
    }
  }

  // ───── scroll: each slice of the pinned section is one view ─────
  function fromScroll() {
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    return clamp(Math.floor(clamp(-r.top / span, 0, 0.9999) * N), 0, N - 1);
  }
  function scrollFor(view) {
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    return scrollY + r.top + (span * (view + 0.5)) / N;
  }
  function scrollToY(y) {
    if (window.tciLenis) window.tciLenis.scrollTo(y, { duration: 1.2, easing: (x) => 1 - Math.pow(1 - x, 3) });
    else window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }
  function onScroll() {
    if (hint && -root.getBoundingClientRect().top > 40) hint.classList.add("is-hidden");
    const t = fromScroll();
    if (t !== target) { target = t; go(); }
  }
  dots.forEach((d, i) => d.addEventListener("click", () => scrollToY(scrollFor(i))));
  root.querySelectorAll("[data-rp3d-step]").forEach((b) => b.addEventListener("click", () => scrollToY(scrollFor(clamp(target + +b.dataset.rp3dStep, 0, N - 1)))));

  // ───── day / night: fade from a still of the current frame while the other film loads ─────
  lightBtns.forEach((b) => b.addEventListener("click", async () => {
    const l = b.dataset.rp3dLight;
    if (l === light || running) return;
    lightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (snap && shown.readyState >= 2) {
      snap.width = shown.videoWidth; snap.height = shown.videoHeight;
      snap.getContext("2d").drawImage(shown, 0, 0);
      snap.classList.add("is-on");
    }
    light = l;
    fwd.src = file(l, "film"); rev.src = file(l, "film-rev");
    await ready(fwd);
    await seek(fwd, timeIn(fwd, at));
    show(fwd);
    if (snap) snap.classList.remove("is-on");
  }));

  // ───── pointer: the picture leans a little towards it ─────
  if (!reduce && matchMedia("(hover: hover)").matches) {
    let mx = 0, my = 0, cx = 0, cy = 0, raf = 0;
    const lean = () => {
      cx += (mx - cx) * 0.05;
      cy += (my - cy) * 0.05;
      media.style.transform = `translate3d(${(-cx * 1.1).toFixed(3)}%, ${(-cy * 0.8).toFixed(3)}%, 0) scale(1.05)`;
      raf = Math.abs(mx - cx) + Math.abs(my - cy) > 0.0005 ? requestAnimationFrame(lean) : 0;
    };
    root.addEventListener("pointermove", (e) => {
      mx = clamp((e.clientX / innerWidth) * 2 - 1, -1, 1);
      my = clamp((e.clientY / innerHeight) * 2 - 1, -1, 1);
      if (!raf) raf = requestAnimationFrame(lean);
    });
    root.addEventListener("pointerleave", () => { mx = my = 0; if (!raf) raf = requestAnimationFrame(lean); });
  }

  // ───── start: open on the view the page is scrolled to ─────
  if (bar) fwd.addEventListener("progress", () => {
    if (!fwd.duration || !fwd.buffered.length) return;
    const p = fwd.buffered.end(fwd.buffered.length - 1) / fwd.duration;
    bar.style.transform = `scaleX(${p})`;
    if (p > 0.99) root.classList.add("is-loaded");
  });
  fwd.src = file(light, "film");
  rev.src = file(light, "film-rev");
  at = target = fromScroll();
  ui();
  ready(fwd).then(() => seek(fwd, timeIn(fwd, at))).then(() => { root.classList.add("is-live"); go(); });
  addEventListener("scroll", onScroll, { passive: true });
})();
