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
    lenis = new Lenis({ lerp: 0.085, anchors: { offset: -76 }, autoRaf: false });
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
  const skip = (el) => el.closest("[data-model3d], .menu-overlay, .site-header, .carousel__caption, form");

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

    /* images: unmask + settle from a zoom as they scroll in, then drift (parallax) */
    const MEDIA = ".blog-card__media, .proj-card__media, .panel__media, .ex-card__media, .quote-block__media, .showcase__media, .split__media, .voice__media, .leadership__media, .kickstart__media, .ex-row__media, .project__shot, .slide";
    $$(MEDIA).forEach((box) => {
      if (skip(box)) return;
      const imgs = $$("img", box);
      if (!imgs.length) return;
      box.classList.add("m-media");
      const tl = gsap.timeline({ scrollTrigger: { trigger: box, start: "top 98%", end: "top 40%", scrub: 0.8 } });
      tl.fromTo(box, { clipPath: "inset(14% 10% 14% 10%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none" }, 0);
      tl.fromTo(imgs, { "--s": 1.35 }, { "--s": 1.08, ease: "none" }, 0);
      if (box.offsetHeight > window.innerHeight * 0.35) {
        gsap.fromTo(imgs, { "--py": "-5%" }, { "--py": "5%", ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: true } });
      }
    });

    /* full-bleed bands open out from a rounded card */
    $$("main .panel, main .leadership, main .kickstart, main .dark-band, main .quote-block, main .cta").forEach((band) => {
      gsap.fromTo(band, { clipPath: "inset(7% 4% 0% 4% round 36px)" }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: band, start: "top bottom", end: "top 30%", scrub: true } });
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

    /* 3D showcase: pinned on large screens while the roof lifts away */
    const model = $("[data-model3d]");
    if (model) {
      model._scroll = 0;
      const set = (p) => { model._scroll = p; model.style.setProperty("--p", p.toFixed(3)); };
      if (desktop) ScrollTrigger.create({ trigger: model, start: "top top", end: "+=140%", pin: true, scrub: true, onUpdate: (s) => set(s.progress) });
      else ScrollTrigger.create({ trigger: model, start: "top 70%", end: "center 45%", scrub: true, onUpdate: (s) => set(s.progress) });
      const head = $(".model__head", model);
      if (head) {
        gsap.from($$(".model__kicker, .model__head h2", head), { autoAlpha: 0, y: 20, duration: 1, stagger: 0.1, ease: EASE, scrollTrigger: { trigger: model, start: "top 70%", once: true } });
        const name = $(".model__head h3", head);
        if (name) riseLines(name, { trigger: model, start: "top 65%", type: "lines,chars", target: "chars", stagger: 0.035, duration: 1.3 });
      }
      gsap.from($$(".model__foot > *", model), { autoAlpha: 0, y: 30, duration: 1.2, stagger: 0.12, ease: EASE, scrollTrigger: { trigger: model, start: "top 55%", once: true } });
    }

    ScrollTrigger.refresh();
  };

  /* ───────── Header: tucks away on the way down, returns on the way up ───────── */
  if (header) {
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (s) => header.classList.toggle("is-tucked", s.direction === 1 && s.scroll() > 240 && !$("#menu-overlay.is-open")),
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
