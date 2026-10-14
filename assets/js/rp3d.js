/* Retail Park in 3D (retail-park-3d.html)
   A fly-round rendered in Blender (src/blender/retail_park.py --tour 8 --path 24 --no-traffic): eight views
   round the park. The scroll drives the camera directly, like the 3D model on the home page: the section is
   pinned, the page's smooth scroll feeds a position, and the camera eases towards it every frame, scrubbing
   through still frames about 2° apart that are blended into each other. Each view holds for a stretch of
   the scroll. The pointer leans the picture slightly. Frames load nearest-first; phones get the 960 px set. */
(() => {
  const root = document.querySelector("[data-rp3d]");
  if (!root) return;
  const N = +root.dataset.stops || 8; // views
  const F = +root.dataset.step || 24; // path frames from one view to the next
  const TOTAL = (N - 1) * F + 1;
  const HOLD = 0.7; // scroll a view holds for, relative to the scroll between two views
  const BASE = root.dataset.base || "assets/rp3d/";
  const pin = root.querySelector(".rp3d__pin");
  const media = root.querySelector("[data-rp3d-media]");
  const canvas = root.querySelector("[data-rp3d-canvas]");
  const ctx = canvas.getContext("2d");
  const dots = [...root.querySelectorAll("[data-rp3d-go]")];
  const nameEl = root.querySelector("[data-rp3d-name]");
  const lightBtns = [...root.querySelectorAll("[data-rp3d-light]")];
  const bar = root.querySelector("[data-rp3d-progress]");
  const hint = root.querySelector("[data-rp3d-hint]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 900px)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = (i) => String(i).padStart(3, "0");
  const smooth = (t) => t * t * (3 - 2 * t);

  let cam = 0;                 // camera position shown, in views (0 … N-1)
  let light = "day", mix = 0;  // 0 day … 1 night, eased
  let dirty = true;

  // ───── path frames: nearest to the camera first ─────
  const sets = { day: new Array(TOTAL), night: new Array(TOTAL) };
  const queue = [];
  let active = 0, loaded = 0, wantedAt = -1, wantNight = false;
  function want(from) { // rebuild the queue round frame `from`: the current light first, then the other
    const c = Math.round(clamp(from, 0, TOTAL - 1));
    if (c === wantedAt) return;
    wantedAt = c;
    const order = [c];
    for (let d = 1; d < TOTAL; d++) { if (c + d < TOTAL) order.push(c + d); if (c - d >= 0) order.push(c - d); }
    const lights = light === "night" ? ["night", "day"] : wantNight ? ["day", "night"] : ["day"];
    queue.length = 0;
    for (const l of lights) for (const i of order) if (!sets[l][i]) queue.push([l, i]);
    pump();
  }
  function pump() {
    while (active < 6 && queue.length) {
      const [l, i] = queue.shift();
      if (sets[l][i]) continue;
      const im = new Image();
      im.decoding = "async";
      sets[l][i] = im;
      active++;
      im.onload = () => {
        const done = () => { im.ready = true; active--; if (l === "day") progress(++loaded); dirty = true; pump(); };
        im.decode ? im.decode().then(done, done) : done();
      };
      im.onerror = () => { active--; pump(); };
      im.src = `${BASE}${l}/path/${small ? "md/" : ""}${pad(i)}.webp`;
    }
  }
  function progress(n) {
    if (bar) bar.style.transform = `scaleX(${n / TOTAL})`;
    if (n >= TOTAL) root.classList.add("is-loaded");
  }
  const ready = (l, i) => (sets[l][i] && sets[l][i].ready ? sets[l][i] : null);
  function nearest(l, i) {
    for (let d = 0; d < TOTAL; d++) {
      const a = ready(l, i - d) || ready(l, i + d);
      if (a) return a;
    }
    return null;
  }

  // ───── drawing: cover-fit, the two neighbouring frames blended ─────
  function size() {
    const r = pin.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    dirty = true;
  }
  function blit(im, alpha) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
  }
  function drawSet(l, f, alpha) {
    const i0 = Math.floor(f), k = f - i0;
    const a = ready(l, i0), b = k > 0.001 ? ready(l, i0 + 1) : null;
    if (a && b) { blit(a, alpha); blit(b, alpha * k); return true; }
    const n = a || nearest(l, Math.round(f));
    if (n) { blit(n, alpha); return true; }
    return false;
  }

  // scroll → position: each view holds for HOLD, then the camera moves on to the next over 1
  function fromScroll() {
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    const x = clamp(-r.top / span, 0, 1) * (N * HOLD + (N - 1));
    const i = Math.min(N - 1, Math.floor(x / (HOLD + 1)));
    return i + smooth(clamp(x - i * (HOLD + 1) - HOLD, 0, 1));
  }
  function scrollFor(view) { // page offset that puts a view in the middle of its hold
    const r = root.getBoundingClientRect();
    const span = Math.max(1, r.height - innerHeight);
    return scrollY + r.top + span * (view * (HOLD + 1) + HOLD / 2) / (N * HOLD + (N - 1));
  }
  function scrollToY(y) {
    if (window.tciLenis) window.tciLenis.scrollTo(y, { duration: 1.2, easing: (x) => 1 - Math.pow(1 - x, 3) });
    else window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }
  let shownView = -1;
  function ui(view) {
    if (view === shownView) return;
    shownView = view;
    dots.forEach((d, i) => d.setAttribute("aria-current", i === view ? "true" : "false"));
    if (nameEl) nameEl.textContent = dots[view] ? dots[view].dataset.name : "";
  }

  // ───── frame loop: ease the camera towards the scroll, like the home page ─────
  let last = performance.now(), visible = true;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (visible) {
      const target = fromScroll();
      const prev = cam, pm = mix;
      cam += (target - cam) * (reduce ? 1 : 1 - Math.exp(-dt * 5));
      if (Math.abs(target - cam) < 0.0005) cam = target;
      const goal = light === "night" ? 1 : 0;
      mix += (goal - mix) * (reduce ? 1 : 1 - Math.exp(-dt * 4));
      if (Math.abs(goal - mix) < 0.002) mix = goal;
      ui(Math.round(cam));
      if (cam !== prev || mix !== pm || dirty) {
        dirty = false;
        const f = cam * F;
        const drewDay = mix < 1 ? drawSet("day", f, 1) : false;
        if (mix > 0) drawSet("night", f, drewDay ? mix : 1);
        ctx.globalAlpha = 1;
        if (drewDay || mix > 0) root.classList.add("is-live");
        want(f);
      }
    }
    requestAnimationFrame(frame);
  }

  // ───── controls ─────
  dots.forEach((d, i) => d.addEventListener("click", () => scrollToY(scrollFor(i))));
  root.querySelectorAll("[data-rp3d-step]").forEach((b) => b.addEventListener("click", () => scrollToY(scrollFor(clamp(Math.round(cam) + +b.dataset.rp3dStep, 0, N - 1)))));
  lightBtns.forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.rp3dLight === light) return;
    light = b.dataset.rp3dLight;
    lightBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    wantedAt = -1;
    want(cam * F);
  }));
  addEventListener("scroll", () => { if (hint && -root.getBoundingClientRect().top > 40) hint.classList.add("is-hidden"); }, { passive: true });

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

  // ───── start ─────
  new ResizeObserver(size).observe(pin);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; dirty = true; }).observe(root);
  cam = fromScroll();
  want(cam * F);
  requestAnimationFrame(frame);
  if (lightBtns.length) {
    const lazyNight = () => { wantNight = true; wantedAt = -1; want(cam * F); };
    if ("requestIdleCallback" in window) requestIdleCallback(() => setTimeout(lazyNight, 4000)); else setTimeout(lazyNight, 6000);
  }
})();
