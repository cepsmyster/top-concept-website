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
  const skip = (el) => el.closest("[data-model3d], [data-film], .film-dialog, .menu-overlay, .site-header, .carousel__caption, form");

  /* ───────── Hero ───────── */
  const hero = $(".hero");
  const intro = gsap.timeline({ defaults: { ease: EASE }, paused: true });
  if (hero) {
    const media = $$(".hero__bg, .hero__video", hero);
    const title = $(".hero__title", hero);
    gsap.set(media, { scale: 1.22, transformOrigin: "50% 60%" });
    intro.to(media, { scale: 1, duration: 2.6, ease: "power3.out" }, 0);
    if (title) {
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
      ScrollTrigger.create({
        trigger: film, start: "top top", end: () => "+=" + Math.round((n - 0.65) * window.innerHeight), pin: true, scrub: 0.5, animation: tl,
        onUpdate: (st) => {
          if (bar) bar.style.transform = "scaleX(" + st.progress.toFixed(3) + ")";
          const i = Math.min(n - 1, Math.floor(st.progress * tl.duration() + 0.35));
          if (i !== active) { active = i; film.dispatchEvent(new CustomEvent("film:chapter", { detail: i })); }
        },
      });
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

  /* ───────── Cursor + magnetic controls (mouse only) ───────── */
  if (fine) {
    const cur = document.createElement("div");
    cur.className = "cursor";
    cur.setAttribute("aria-hidden", "true");
    cur.innerHTML = '<span class="cursor__label"></span>';
    document.body.appendChild(cur);
    const label = cur.firstChild;
    const xTo = gsap.quickTo(cur, "x", { duration: 0.45, ease: "power3" });
    const yTo = gsap.quickTo(cur, "y", { duration: 0.45, ease: "power3" });
    window.addEventListener("pointermove", (e) => { xTo(e.clientX); yTo(e.clientY); cur.classList.add("is-on"); }, { passive: true });
    document.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
    const LABELS = [
      [".proj-card, .blog-card, .ex-card, .showcase__media", "View"],
      ["[data-track]", "Drag"],
      ["[data-model-stage] canvas", "Explore"],
      ["[data-film] .film__stack", "Scroll"],
    ];
    document.addEventListener("pointerover", (e) => {
      const t = e.target;
      const hit = LABELS.find(([sel]) => t.closest(sel));
      label.textContent = hit ? hit[1] : "";
      cur.classList.toggle("has-label", !!hit);
      cur.classList.toggle("is-link", !hit && !!t.closest("a, button, [role=button], label, select"));
    });

    $$(".btn, .carousel__nav, .theme-toggle, .menu-toggle, .model__btn").forEach((el) => {
      const mx = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      const my = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
      el.addEventListener("pointermove", (e) => { const r = el.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * 0.3); my((e.clientY - r.top - r.height / 2) * 0.3); });
      el.addEventListener("pointerleave", () => { mx(0); my(0); });
    });
  }

  /* ───────── Page transitions: the curtain drops before leaving, lifts on arrival ───────── */
  const lift = () => {
    if (!curtain) { intro.play(); return; }
    gsap.timeline()
      .to(curtain.querySelector(".curtain__bar"), { scaleX: 1, duration: 0.55, ease: "power2.inOut" })
      .to(curtain.querySelector(".curtain__logo"), { autoAlpha: 0, y: -12, duration: 0.35, ease: "power2.in" }, "-=0.1")
      .to(curtain, { yPercent: -100, duration: 1.05, ease: "expo.inOut", onComplete: () => { curtain.style.visibility = "hidden"; } }, "-=0.15")
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
    gsap.set(curtain.querySelector(".curtain__logo"), { autoAlpha: 0, y: 0 });
    gsap.set(curtain.querySelector(".curtain__bar"), { scaleX: 0 });
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
