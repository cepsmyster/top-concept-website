/* Top Concept International — motion layer.
   Smooth scrolling (Lenis) + scroll-driven animation (GSAP, ScrollTrigger, SplitText), all self-hosted in assets/js/vendor/.
   Visitors who ask for reduced motion get the plain, static site. */
(() => {
  "use strict";
  const root = document.documentElement;
  const curtain = document.querySelector("[data-curtain]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { gsap, ScrollTrigger, SplitText, Lenis } = window;
  if (curtain) curtain.style.animation = "none"; // JS is alive: cancel the CSS failsafe
  if (reduce || !gsap || !ScrollTrigger) { curtain?.remove(); root.classList.remove("m"); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  root.classList.add("has-motion");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const desktop = window.matchMedia("(min-width: 900px)").matches;
  const EASE = "expo.out";

  /* ───────── Smooth scroll ───────── */
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.1, anchors: { offset: -76 }, autoRaf: false });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    const overlay = $("#menu-overlay");
    if (overlay) new MutationObserver(() => (overlay.classList.contains("is-open") ? lenis.stop() : lenis.start())).observe(overlay, { attributes: true, attributeFilter: ["class"] });
    window.tciLenis = lenis;
  }

  /* ───────── Helpers ───────── */
  // Split into masked lines that slide up; the split is undone afterwards so theme / resize changes reflow normally.
  const riseLines = (el, { trigger = el, start = "top 88%", delay = 0, stagger = 0.09, duration = 1.25, type = "lines", target = "lines" } = {}) => {
    if (!SplitText || !el.textContent.trim()) return null;
    let split;
    split = SplitText.create(el, {
      type, mask: "lines", linesClass: "m-line", aria: "auto",
      onSplit(self) {
        return gsap.from(self[target], {
          yPercent: 110, duration, delay, stagger, ease: EASE,
          scrollTrigger: trigger ? { trigger, start, once: true } : undefined,
          onComplete: () => split && split.revert(),
        });
      },
    });
    return split;
  };
  const skip = (el) => el.closest("[data-model3d], [data-film], .menu-overlay, .site-header, .carousel__caption, form");

  // Home hero headline: the light words rise letter by letter; the bold word is drafted in outline along a
  // dimension line, then fills in solid as the finished building sweeps in behind it.
  const draftTitle = (title) => {
    const bold = $(".hb", title), br = $("br.hbr", title);
    if (!SplitText || !bold || !br) return null;
    // bake the capitals into the text: CSS "capitalize" would capitalise every letter once they are split apart
    const walk = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    for (let t; (t = walk.nextNode()); ) t.nodeValue = t.nodeValue.replace(/(^|\s)(\p{L})/gu, (m, a, c) => a + c.toUpperCase());
    title.style.textTransform = "none";
    const light = document.createElement("span");
    light.className = "hl";
    while (title.firstChild !== br) light.appendChild(title.firstChild);
    title.insertBefore(light, br);
    bold.dataset.text = bold.textContent;
    const dim = document.createElement("span");
    dim.className = "hero__dim";
    dim.setAttribute("aria-hidden", "true");
    bold.appendChild(dim);
    title.classList.add("is-draft");
    gsap.set(title, { autoAlpha: 1 });
    gsap.set(bold, { "--draw": "0%", "--fill": "0%" });
    const split = SplitText.create(light, { type: "words,chars", mask: "words" });
    return gsap.timeline()
      .from(split.chars, { yPercent: 110, duration: 1.1, stagger: 0.03, ease: EASE }, 0)
      .to(bold, { "--draw": "100%", duration: 1.2, ease: "power2.inOut" }, 0.45)
      .to(bold, { "--fill": "100%", duration: 1.3, ease: "power2.inOut" }, 1.7)
      .to(dim, { autoAlpha: 0.35, duration: 0.8, ease: "none" }, 2.9)
      .add(() => { split.revert(); title.classList.remove("is-draft"); });
  };

  // Pinned, scrubbed sections that move in steps (the showcase photos): when scrolling stops
  // between two steps, glide on to the next one in the direction of travel (or back, if it had barely moved),
  // so the section always rests on one whole step. dur() = timeline length in steps; last = index of the final step.
  const lockSteps = (st, dur, last) => {
    let dir = 1, idle = 0, snapping = false, lastY = window.scrollY;
    const snap = () => {
      if (!st.isActive || snapping) return;
      const t = st.progress * dur();
      if (t >= last) return;
      const base = Math.floor(t), f = t - base;
      if (f < 0.01 || f > 0.99) return;
      const to = dir > 0 ? (f > 0.15 ? base + 1 : base) : (f < 0.85 ? base : base + 1);
      const y = st.start + (to / dur()) * (st.end - st.start);
      snapping = true;
      const done = () => { snapping = false; };
      setTimeout(done, 1200); // in case the visitor interrupts the glide
      if (lenis) lenis.scrollTo(y, { duration: 0.9, easing: (x) => 1 - Math.pow(1 - x, 3), onComplete: done });
      else window.scrollTo({ top: y, behavior: "smooth" });
    };
    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastY) dir = y > lastY ? 1 : -1;
      lastY = y;
      if (snapping) return;
      clearTimeout(idle);
      idle = setTimeout(snap, 180);
    };
    if (lenis) lenis.on("scroll", onScroll);
    else window.addEventListener("scroll", onScroll, { passive: true });
  };

  /* ───────── Hero ───────── */
  const hero = $(".hero");
  const intro = gsap.timeline({ defaults: { ease: EASE }, paused: true });
  if (hero) {
    const media = $$(".hero__bg", hero);
    const title = $(".hero__title", hero);
    gsap.set(media, { scale: 1.22, transformOrigin: "50% 60%" });
    intro.to(media, { scale: 1, duration: 2.6, ease: "power3.out" }, 0);
    const drafted = title && hero.matches(".hero--compare") && draftTitle(title);
    if (drafted) intro.add(drafted, 0.35);
    else if (title) {
      gsap.set(title, { autoAlpha: 1 });
      const split = SplitText && SplitText.create(title, { type: "lines,words", mask: "lines", aria: "auto" });
      if (split) intro.from(split.words, { yPercent: 115, duration: 1.5, stagger: 0.07, onComplete: () => split.revert() }, 0.35);
    }
    const scroll = $(".hero__scroll", hero);
    if (scroll) intro.from(scroll, { autoAlpha: 0, y: 20, duration: 1 }, 1.1);
    // parallax out
    gsap.to(media, { yPercent: 18, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
    if (title) gsap.to(title, { yPercent: -45, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "70% top", scrub: true } });
  }
  intro.add(() => document.dispatchEvent(new Event("tci:intro")), 0.2); // home hero: start drawing
  const header = $("#site-header");
  if (header) intro.from(header.children, { yPercent: -120, autoAlpha: 0, duration: 1.2, stagger: 0.08 }, 0.5);

  /* ───────── Headings & copy ───────── */
  const run = () => {
    $$("main h1, main h2, main .split__title, main .project h1").forEach((el) => {
      if (skip(el) || el.classList.contains("hero__title") || el._m) return;
      el._m = true;
      if (el.querySelector(".t-light, .t-dark, img")) { // theme-specific wording: animate the block, not the lines
        gsap.from(el, { yPercent: 40, autoAlpha: 0, duration: 1.2, ease: EASE, scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      } else riseLines(el);
    });
    $$("main p, main blockquote").forEach((el) => {
      if (skip(el) || el._m || el.closest(".reveal, .hero, .proj-card, .blog-card, .ex-card, .chips") || el.textContent.trim().length < 70) return;
      el._m = true;
      riseLines(el, { stagger: 0.05, duration: 1.1, start: "top 92%" });
    });
    $$("main .section__head .link-caps, main .crumbs, main time").forEach((el) => {
      if (skip(el)) return;
      gsap.from(el, { autoAlpha: 0, y: 16, duration: 1, ease: EASE, scrollTrigger: { trigger: el, start: "top 94%", once: true } });
    });

    /* cards & blocks that used the CSS reveal */
    gsap.set(".reveal", { autoAlpha: 0, y: 70 });
    ScrollTrigger.batch(".reveal", {
      start: "top 92%", once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.3, stagger: 0.12, ease: EASE, overwrite: true, clearProps: "transform,opacity,visibility" }),
    });

    /* images: unmask and settle from a zoom as they scroll in (played once, not tied to every scroll frame) */
    const MEDIA = ".blog-card__media, .proj-card__media, .panel__media, .ex-card__media, .quote-block__media, .showcase__media, .split__media, .voice__media, .leadership__media, .kickstart__media, .ex-row__media, .project__shot, .slide";
    $$(MEDIA).forEach((box) => {
      if (skip(box)) return;
      const imgs = $("img", box);
      if (!imgs.length) return;
      box.classList.add("m-media");
      const st = { trigger: box, start: "top 90%", once: true };
      gsap.fromTo(box, { clipPath: "inset(12% 8% 12% 8%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.out", scrollTrigger: st, clearProps: "clipPath" });
      gsap.fromTo(imgs, { "--s": 1.3 }, { "--s": 1, duration: 2, ease: "expo.out", scrollTrigger: st });
    });

    /* full-bleed bands open out from a rounded card */
    $$("main .panel, main .leadership, main .kickstart, main .dark-band, main .quote-block, main .cta").forEach((band) => {
      gsap.fromTo(band, { clipPath: "inset(6% 4% 0% 4% round 36px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", duration: 1.6, ease: "expo.out", clearProps: "clipPath", scrollTrigger: { trigger: band, start: "top 85%", once: true } });
    });

    /* rules draw across */
    $$("main .rule").forEach((r) => gsap.from(r, { scaleX: 0, transformOrigin: "0 50%", duration: 1.6, ease: "expo.inOut", scrollTrigger: { trigger: r, start: "top 92%", once: true } }));

    /* projects carousel slides in from the right */
    $$("[data-carousel]").forEach((c) => {
      gsap.from($$(".slide", c), { x: () => window.innerWidth * 0.35, duration: 1.6, stagger: 0.1, ease: EASE, scrollTrigger: { trigger: c, start: "top 85%", once: true }, clearProps: "transform" });
    });

    /* footer rises from underneath the page */
    const foot = $(".site-footer__grid");
    if (foot) gsap.from(foot, { yPercent: -25, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ".site-footer", start: "top bottom", end: "bottom bottom", scrub: true } });

    /* Projects row (after bloom3d.studio): full screen and pinned; the featured projects move right to left as you
       scroll, so each project arrives from the right and passes through the middle. At rest the cards sit flat in a
       straight row; as soon as the row moves it bends into a deep, clean U: the top edges of the cards follow a curve
       (the middle card lowest), each card is tilted square to that curve and spaced evenly along it, so the gaps stay
       open and the cards fan apart rather than overlap. The U holds for as long as the scrolling goes on and eases back
       flat a moment after it stops. Each photo drifts a little inside its card as it moves. */
    const orbit = $("[data-orbit]");
    if (orbit) {
      const ring = $("[data-orbit-ring]", orbit);
      const items = $$(".orbit__item", orbit), n = items.length;
      const bar = $("[data-orbit-progress]", orbit);
      const GAP = 0.08, DEPTH = 0.2; // gap as a share of the card width; how steep the U is (per card width)
      orbit.classList.add("is-3d");
      let cw = 0, W = 0;
      const size = () => { cw = ring.offsetWidth; W = cw * (1 + GAP); };
      size();
      window.addEventListener("resize", size);
      const from = -0.8; // in cards: while the section scrolls in, the first project comes in from just right of the middle
      const clamp = (v, a) => Math.max(-a, Math.min(a, v));
      // the point on the curve y = k·x² that lies a distance s along it from the bottom (Newton's method on the arc length)
      const along = (s, k) => {
        if (k < 1e-7) return s;
        let x = s;
        for (let j = 0; j < 5; j++) {
          const q = Math.sqrt(1 + 4 * k * k * x * x);
          x -= (x * q / 2 + Math.asinh(2 * k * x) / (4 * k) - s) / q;
        }
        return x;
      };
      let target = from, pos = from, bend = 0, moved = -1;
      const frame = (time) => {
        pos += (target - pos) * 0.07; // smooth follow, no overshoot
        if (Math.abs(target - pos) < 1e-4) pos = target;
        if (Math.abs(target - pos) > 0.002) moved = time;
        // 0 = flat row, 1 = full U: bends in while moving, stays bent through the gaps between scroll steps,
        // and flattens only once the row has been still for a moment
        const want = time - moved < 0.35 ? 1 : 0;
        bend += (want - bend) * (want ? 0.06 : 0.035);
        const k = (DEPTH / cw) * bend;
        for (let i = 0; i < n; i++) {
          const d = i - pos; // 0 = in the middle, positive = to the right
          const px = along(d * W, k), py = -k * px * px;
          const tilt = Math.atan(-2 * k * px) * 180 / Math.PI;
          const it = items[i].style;
          it.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
          it.setProperty("--px", (clamp(d, 1.5) * 4).toFixed(2) + "%");
          it.pointerEvents = Math.abs(d) < 3 ? "" : "none";
        }
      };
      frame(0);
      // pinned for as long as it takes the whole row to pass through the middle
      const pin = ScrollTrigger.create({
        trigger: orbit, start: "top top", end: () => "+=" + Math.round((n - 1) * window.innerHeight * 0.8), pin: true,
        onUpdate: (st) => { target = st.progress * (n - 1); if (bar) bar.style.transform = "scaleX(" + st.progress.toFixed(3) + ")"; },
      });
      ScrollTrigger.create({ trigger: orbit, start: "top 80%", end: "top top", onUpdate: (st) => { if (!pin.isActive) target = from * (1 - st.progress); } });
      // the animation only runs while the section is on screen
      ScrollTrigger.create({ trigger: orbit, start: "top bottom", end: () => pin.end + window.innerHeight, onToggle: (st) => (st.isActive ? gsap.ticker.add(frame) : gsap.ticker.remove(frame)) });
    }

    /* Project page photos: pinned; the main image and the other photos sit in one row that slides from right to left as you scroll down */
    const hs = $("[data-hshots]");
    if (hs) {
      const track = $("[data-hshots-track]", hs), bar = $("[data-hshots-progress]", hs);
      hs.classList.add("is-live");
      const dist = () => Math.max(0, track.scrollWidth - hs.clientWidth);
      gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: { trigger: hs, start: "center center", end: () => "+=" + Math.max(1, dist()), pin: true, scrub: 0.6, invalidateOnRefresh: true,
          onUpdate: (st) => { if (bar) bar.style.transform = "scaleX(" + st.progress.toFixed(3) + ")"; } },
      });
    }

    /* Project showcase film: pinned; each chapter wipes up over the last as you scroll */
    const film = $("[data-film]");
    if (film) {
      film.dataset.pinned = "1";
      const ch = $$(".film__chapter", film), n = ch.length;
      const bar = $("[data-film-progress]", film);
      const tl = gsap.timeline({ defaults: { ease: "none" } });
      ch.forEach((c, i) => {
        if (!i) return;
        const at = i - 1, prev = ch[i - 1];
        tl.fromTo(c, { yPercent: 100 }, { yPercent: 0, duration: 1 }, at)
          .fromTo($(".film__media", c), { yPercent: -60 }, { yPercent: 0, duration: 1 }, at)
          .to($(".film__media", prev), { yPercent: 10, scale: 1.25, duration: 1 }, at)
          .to($(".film__caption", prev), { autoAlpha: 0, y: -30, duration: 0.3 }, at)
          .fromTo($(".film__caption", c), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.7);
      });
      tl.to({}, { duration: 0.35 }); // linger on the last chapter
      let active = 0;
      const st = ScrollTrigger.create({
        trigger: film, start: "top top", end: () => "+=" + Math.round((n - 0.65) * window.innerHeight), pin: true, scrub: 0.5, animation: tl,
        onUpdate: (st) => {
          if (bar) bar.style.transform = "scaleX(" + st.progress.toFixed(3) + ")";
          const i = Math.min(n - 1, Math.floor(st.progress * tl.duration() + 0.35));
          if (i !== active) { active = i; film.dispatchEvent(new CustomEvent("film:chapter", { detail: i })); }
        },
      });

      lockSteps(st, () => tl.duration(), n - 1);
      const head = $(".film__head", film);
      if (head) {
        gsap.from($$(".film__kicker, .film__tag", head), { autoAlpha: 0, y: 20, duration: 1, stagger: 0.15, ease: EASE, scrollTrigger: { trigger: film, start: "top 75%", once: true } });
        const title = $(".film__title", head);
        if (title) riseLines(title, { trigger: film, start: "top 70%", type: "lines,chars", target: "chars", stagger: 0.04, duration: 1.4 });
      }
      gsap.from($$(".film__foot > *", film), { autoAlpha: 0, y: 30, duration: 1.2, stagger: 0.12, ease: EASE, scrollTrigger: { trigger: film, start: "top 55%", once: true } });
    }

    /* 3D: pinned while the camera cranes from the street up over the courtyard */
    const model = $("[data-model3d]");
    if (model) {
      model._scroll = 0;
      const set = (p) => { model._scroll = p; };
      if (desktop) ScrollTrigger.create({ trigger: model, start: "top top", end: "+=150%", pin: true, scrub: true, onUpdate: (st) => set(st.progress) });
      else ScrollTrigger.create({ trigger: model, start: "top 60%", end: "bottom 40%", scrub: true, onUpdate: (st) => set(st.progress) });
      const head = $(".model__head", model);
      if (head) {
        gsap.from($$(".model__kicker, .model__tag", head), { autoAlpha: 0, y: 20, duration: 1, stagger: 0.1, ease: EASE, scrollTrigger: { trigger: model, start: "top 70%", once: true } });
        const name = $(".model__head h3", head);
        if (name) riseLines(name, { trigger: model, start: "top 65%", type: "lines,chars", target: "chars", stagger: 0.035, duration: 1.3 });
      }
      gsap.from($$(".model__foot > *", model), { autoAlpha: 0, y: 30, duration: 1.2, stagger: 0.12, ease: EASE, scrollTrigger: { trigger: model, start: "top 55%", once: true } });
    }

    ScrollTrigger.refresh();
  };

  /* ───────── Header: tucks away on the way down, returns on the way up ───────── */
  if (header) {
    const menu = $("#menu-overlay");
    let tucked = false;
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (st) => {
        const t = st.direction === 1 && st.scroll() > 240 && !(menu && menu.classList.contains("is-open"));
        if (t !== tucked) { tucked = t; header.classList.toggle("is-tucked", t); }
      },
    });
  }

  /* ───────── CAD cursor + magnetic controls (mouse only) ─────────
     A drafting crosshair: pick box with short arms, faint hairlines across the screen and a live X / Y readout.
     Over links and buttons it snaps to a bracketed marker; over cards etc. the tag names the action. */
  if (fine) {
    const cad = document.createElement("div");
    cad.className = "cad";
    cad.setAttribute("aria-hidden", "true");
    cad.innerHTML = '<span class="cad__h"></span><span class="cad__v"></span><div class="cad__pt"><span class="cad__arm cad__arm--x"></span><span class="cad__arm cad__arm--y"></span><span class="cad__box"></span><span class="cad__tag"></span></div>';
    document.body.appendChild(cad);
    document.documentElement.classList.add("has-cad");
    const [h, v, pt] = cad.children;
    const tag = pt.querySelector(".cad__tag");
    let x = -100, y = -100, raf = 0, word = "";
    const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
    const draw = () => {
      raf = 0;
      pt.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
      h.style.transform = "translate3d(0, " + y + "px, 0)";
      v.style.transform = "translate3d(" + x + "px, 0, 0)";
      tag.textContent = word || "X " + pad(x) + "  Y " + pad(y + window.scrollY);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(draw); };
    window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cad.classList.add("is-on"); queue(); }, { passive: true });
    window.addEventListener("scroll", queue, { passive: true });
    document.addEventListener("pointerleave", () => cad.classList.remove("is-on"));
    const LABELS = [
      [".proj-card, .blog-card, .ex-card, .xp__media, .orbit__card, .showcase__media, .menu-blog", "View"],
      ["[data-track]", "Drag"],
      ["[data-model-stage] canvas", "Explore"],
      ["[data-film] .film__stack", "Scroll"],
    ];
    document.addEventListener("pointerover", (e) => {
      const t = e.target;
      const text = !!t.closest("input:not([type=checkbox]):not([type=file]), textarea, select, [contenteditable]");
      const hit = !text && LABELS.find(([sel]) => t.closest(sel));
      word = hit ? hit[1] : "";
      cad.classList.toggle("is-text", text);
      cad.classList.toggle("has-label", !!hit);
      cad.classList.toggle("is-link", !text && !hit && !!t.closest("a, button, [role=button], label, select"));
      queue();
    });
    document.addEventListener("pointerdown", () => cad.classList.add("is-down"));
    document.addEventListener("pointerup", () => cad.classList.remove("is-down"));

    $$(".btn, .carousel__nav, .hdr-chip, .menu-toggle, .talk, .model__btn").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const my = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.3); });
      el.addEventListener("pointerleave", () => { mx(0); my(0); });
    });
  }

  /* ───────── Page transitions: the curtain drops before leaving, lifts on arrival ───────── */
  // Loader: the wordmark rises floor by floor behind a laser level while the dimension line counts up in millimetres.
  const count = curtain?.querySelector("[data-curtain-count]");
  const build = { p: 0 };
  const setP = () => { curtain.style.setProperty("--p", build.p.toFixed(4)); if (count) count.textContent = String(Math.round(build.p * 12000)).padStart(5, "0"); };
  const lift = () => {
    if (!curtain) { intro.play(); return; }
    build.p = 0; setP();
    gsap.timeline()
      .from(curtain.querySelector(".curtain__grid"), { autoAlpha: 0, scale: 1.08, duration: 0.9, ease: "power2.out" }, 0)
      .to(build, { p: 1, duration: 1.35, ease: "power3.inOut", onUpdate: setP }, 0.1)
      .to(curtain.querySelector(".curtain__stage"), { autoAlpha: 0, y: -24, duration: 0.45, ease: "power2.in" }, "+=0.12")
      .to(curtain, { yPercent: -100, duration: 1.05, ease: "expo.inOut", onComplete: () => { curtain.style.visibility = "hidden"; } }, "-=0.2")
      .add(() => intro.play(), "-=0.7");
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || !curtain || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== "_self") return;
    if (a.hasAttribute("download") || a.closest(".carousel__track")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/(\.html|\/)$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // same page (hash links)
    e.preventDefault();
    gsap.killTweensOf(curtain);
    gsap.set(curtain, { visibility: "visible", yPercent: 100 });
    gsap.set(curtain.querySelector(".curtain__stage"), { autoAlpha: 0, y: 0 });
    gsap.to(curtain, { yPercent: 0, duration: 0.75, ease: "expo.inOut", onComplete: () => { location.href = url.href; } });
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted && curtain) { gsap.set(curtain, { visibility: "hidden" }); } });

  /* ───────── Go ───────── */
  const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
  fontsReady.then(() => {
    run();
    lift();
  });
})();
