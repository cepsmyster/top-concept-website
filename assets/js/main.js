/* Top Concept International — site behaviour (no dependencies) */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── Theme (light / dark) ───────── */
  const themeBtn = $("[data-theme-toggle]");
  const syncThemeLabel = () => {
    if (!themeBtn) return;
    const dark = root.getAttribute("data-theme") === "dark";
    themeBtn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  syncThemeLabel();
  themeBtn?.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("tci-theme", next); } catch (e) { /* storage unavailable */ }
    syncThemeLabel();
  });

  /* ───────── Header: solid once scrolled ───────── */
  const header = $("#site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* Highlight the menu link that matches the current ?type= filter */
  (() => {
    const here = location.pathname.split("/").pop() || "index.html";
    if (here !== "projects.html") return;
    const type = new URLSearchParams(location.search).get("type");
    $$(".menu-overlay nav a").forEach((a) => {
      const u = new URL(a.href, location.href);
      if (u.pathname.endsWith("projects.html") && type && u.searchParams.get("type") === type) a.setAttribute("aria-current", "page");
    });
  })();

  /* ───────── Slide-in menu ───────── */
  const overlay = $("#menu-overlay");
  const openBtn = $("[data-menu-open]");
  if (overlay && openBtn) {
    let lastFocus = null;
    const focusables = () => $$("a[href], button:not([disabled])", overlay.querySelector(".menu-overlay__panel"));
    const openMenu = () => {
      lastFocus = document.activeElement;
      overlay.hidden = false;
      void overlay.offsetWidth; // let the browser register the initial state so the transition runs
      overlay.classList.add("is-open");
      openBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      $(".menu-close", overlay)?.focus({ preventScroll: true });
    };
    const closeMenu = () => {
      if (overlay.hidden) return;
      overlay.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      setTimeout(() => { if (!overlay.classList.contains("is-open")) overlay.hidden = true; }, reduceMotion ? 0 : 480);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    openBtn.addEventListener("click", openMenu);
    $$("[data-menu-close]", overlay).forEach((el) => el.addEventListener("click", closeMenu));
    $$("nav a", overlay).forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (overlay.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); closeMenu(); }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ───────── Home hero video ───────── */
  (() => {
    const hero = $("[data-hero-video]");
    const video = hero && $(".hero__video", hero);
    if (!video) return;
    const conn = navigator.connection || {};
    const allowed = window.matchMedia("(min-width: 900px)").matches && !reduceMotion && !conn.saveData && !/2g/.test(conn.effectiveType || "");
    if (!allowed) return; // phones / reduced motion / data saver keep the still image
    const start = () => {
      video.addEventListener("playing", () => hero.classList.add("has-video"), { once: true });
      video.src = hero.dataset.heroVideo;
      const p = video.play();
      if (p && p.catch) p.catch(() => { /* autoplay blocked: the still image stays */ });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(([e]) => { if (e.isIntersecting) video.play().catch(() => {}); else video.pause(); }).observe(hero);
      }
    };
    if (document.readyState === "complete") setTimeout(start, 300);
    else window.addEventListener("load", () => setTimeout(start, 300), { once: true });
  })();

  /* ───────── Scroll reveal ───────── */
  (() => {
    const els = $$(".reveal");
    if (!els.length) return;
    if (!("IntersectionObserver" in window) || reduceMotion) { els.forEach((e) => e.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((e) => io.observe(e));
  })();

  /* ───────── Projects carousel ───────── */
  $$("[data-carousel]").forEach((carousel) => {
    const track = $("[data-track]", carousel);
    const slides = Array.from(track.children);
    const dots = $$(".dot", carousel);
    const label = $("[data-cap-label]", carousel);
    const title = $("[data-cap-title]", carousel);
    let active = 0, ticking = false, dragged = false;

    const nearest = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bd = Infinity;
      slides.forEach((s, i) => { const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      slides.forEach((s, k) => { s.classList.toggle("is-active", k === i); const a = $("a", s); if (a) a.tabIndex = k === i ? 0 : -1; });
      dots.forEach((d, k) => { d.classList.toggle("is-active", k === i); if (k === i) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      const s = slides[i];
      label.textContent = s.dataset.label;
      title.textContent = s.dataset.title;
      title.href = s.dataset.href;
    };
    const goTo = (i, smooth = true) => {
      const n = slides.length;
      i = (i + n) % n;
      const s = slides[i];
      track.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - track.clientWidth / 2, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
      setActive(i);
    };
    track.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { setActive(nearest()); ticking = false; });
    }, { passive: true });
    $("[data-prev]", carousel)?.addEventListener("click", () => goTo(active - 1));
    $("[data-next]", carousel)?.addEventListener("click", () => goTo(active + 1));
    dots.forEach((d) => d.addEventListener("click", () => goTo(Number(d.dataset.slide))));
    carousel.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(active + 1); $("a", slides[active])?.focus({ preventScroll: true }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(active - 1); $("a", slides[active])?.focus({ preventScroll: true }); }
    });
    // click a faded neighbour → bring it to the centre instead of following the link
    slides.forEach((s, i) => $("a", s)?.addEventListener("click", (e) => { if (dragged) { e.preventDefault(); return; } if (i !== active) { e.preventDefault(); goTo(i); } }));

    // mouse drag (touch already scrolls natively)
    let down = false, startX = 0, startLeft = 0;
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; dragged = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { dragged = true; track.classList.add("is-dragging"); }
      if (dragged) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (dragged) { track.classList.remove("is-dragging"); goTo(nearest()); setTimeout(() => { dragged = false; }, 0); }
    });
    window.addEventListener("resize", () => goTo(active, false));
  });

  /* ───────── Projects page: filters (?type= / ?cat=) ───────── */
  (() => {
    const grid = $("[data-projects]");
    if (!grid) return;
    const cards = $$(".proj-card", grid);
    const chips = $$("[data-chips] .chip");
    const note = $("[data-filter-note]");
    const empty = $("[data-empty]");
    const params = new URLSearchParams(location.search);
    let type = params.get("type") || "all";
    let cat = params.get("cat") || "";
    if (!chips.some((c) => c.dataset.filter === type)) type = "all";

    const pretty = (s) => s.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
    const apply = (push) => {
      let shown = 0;
      cards.forEach((c) => {
        const ok = (!cat || c.dataset.cat === cat) && (type === "all" || c.dataset.type === type);
        c.hidden = !ok;
        if (ok) shown++;
      });
      chips.forEach((c) => { const on = c.dataset.filter === type; c.classList.toggle("is-active", on); c.setAttribute("aria-pressed", String(on)); });
      if (empty) empty.hidden = shown > 0;
      if (note) {
        if (cat) {
          note.hidden = false;
          note.innerHTML = "";
          note.append(`Showing ${pretty(cat)} projects · `);
          const a = document.createElement("a");
          a.href = "projects.html"; a.textContent = "Show all"; a.style.textDecoration = "underline";
          a.addEventListener("click", (e) => { e.preventDefault(); cat = ""; type = "all"; apply(true); });
          note.append(a);
        } else note.hidden = true;
      }
      if (push) {
        const p = new URLSearchParams();
        if (type !== "all") p.set("type", type);
        if (cat) p.set("cat", cat);
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
      }
    };
    chips.forEach((c) => c.addEventListener("click", () => { type = c.dataset.filter; cat = ""; apply(true); }));
    apply(false);
    // arriving from a filter link (menu, footer, expertise): jump straight to the grid
    if (type !== "all" || cat) {
      const target = $("#all-projects");
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "instant" }));
    }
  })();

  /* ───────── Lightbox (project galleries) ───────── */
  (() => {
    const shots = $$("[data-lightbox]");
    if (!shots.length) return;
    const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    const lb = document.createElement("div");
    lb.className = "lightbox"; lb.hidden = true;
    lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Image viewer");
    lb.innerHTML = `<button class="lightbox__btn lightbox__close" type="button" aria-label="Close">${svg("M5 5l14 14M19 5 5 19")}</button>
      <button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous image">${svg("m9 5 7 7-7 7")}</button>
      <img alt=""><button class="lightbox__btn lightbox__next" type="button" aria-label="Next image">${svg("m9 5 7 7-7 7")}</button>
      <p class="lightbox__count" aria-live="polite"></p>`;
    document.body.append(lb);
    const image = $("img", lb), count = $(".lightbox__count", lb), prev = $(".lightbox__prev", lb), next = $(".lightbox__next", lb), close = $(".lightbox__close", lb);
    let idx = 0, lastFocus = null;
    const show = (i) => {
      idx = (i + shots.length) % shots.length;
      const a = shots[idx];
      image.src = a.href;
      image.alt = $("img", a)?.alt || "";
      count.textContent = shots.length > 1 ? `${idx + 1} / ${shots.length}` : "";
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false; void lb.offsetWidth; lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
      prev.hidden = next.hidden = shots.length < 2;
      close.focus();
    };
    const shut = () => {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      setTimeout(() => { lb.hidden = true; image.removeAttribute("src"); }, reduceMotion ? 0 : 300);
      lastFocus?.focus?.({ preventScroll: true });
    };
    shots.forEach((a, i) => a.addEventListener("click", (e) => { e.preventDefault(); open(i); }));
    close.addEventListener("click", shut);
    prev.addEventListener("click", () => show(idx - 1));
    next.addEventListener("click", () => show(idx + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) shut(); });
    document.addEventListener("keydown", (e) => {
      if (lb.hidden) return;
      if (e.key === "Escape") shut();
      if (e.key === "ArrowLeft" && shots.length > 1) show(idx - 1);
      if (e.key === "ArrowRight" && shots.length > 1) show(idx + 1);
      if (e.key === "Tab") { const f = [close, prev, next].filter((b) => !b.hidden); const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
    });
  })();

  /* ───────── Forms ───────── */
  const MAX_CV = 5 * 1024 * 1024;
  $$("form[data-form]").forEach((form) => {
    const kind = form.dataset.form;
    const status = $(".form__status", form);
    const submit = $("button[type=submit]", form);
    const fileInput = $("input[type=file]", form);
    const fileLabel = $("[data-file-name]", form);
    const say = (msg, ok) => { status.textContent = msg; status.classList.toggle("is-ok", !!ok); status.classList.toggle("is-error", ok === false); };
    const wrap = (el) => el.closest(".field, .line-field");

    fileInput?.addEventListener("change", () => {
      const f = fileInput.files[0];
      const box = wrap(fileInput);
      box.classList.toggle("has-file", !!f);
      fileLabel.textContent = f ? f.name : "Upload… (PDF or Word, max 5 MB)";
    });
    $$("input, textarea", form).forEach((el) => el.addEventListener("input", () => { wrap(el)?.classList.remove("has-error"); el.removeAttribute("aria-invalid"); }));

    const validate = () => {
      const bad = [];
      $$("input, textarea", form).forEach((el) => {
        if (el.classList.contains("hp") || el.type === "checkbox") return;
        let ok = true;
        const v = el.type === "file" ? el.files[0] : el.value.trim();
        if (el.required && !v) ok = false;
        if (ok && el.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) ok = false;
        if (ok && el.name === "message" && v.length < 5) ok = false;
        if (ok && el.type === "file" && v) {
          if (!/\.(pdf|docx?)$/i.test(v.name) || v.size > MAX_CV) ok = false;
        }
        wrap(el)?.classList.toggle("has-error", !ok);
        if (!ok) { el.setAttribute("aria-invalid", "true"); bad.push(el); } else el.removeAttribute("aria-invalid");
      });
      return bad;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      say("");
      const bad = validate();
      if (bad.length) {
        const f = bad[0];
        const msg = f.type === "file" ? "Please attach your CV as a PDF or Word file under 5 MB." : "Please check the highlighted fields.";
        say(msg, false);
        f.focus();
        return;
      }
      if ($(".hp", form).value) { say("Thank you — we’ll be in touch.", true); form.reset(); return; } // bot trap

      const endpoint = form.dataset.endpoint, email = form.dataset.email;
      const original = submit.textContent;
      submit.disabled = true; submit.textContent = "Sending…";
      try {
        if (endpoint) {
          const fd = new FormData(form);
          fd.delete("_gotcha");
          fd.append("_subject", form.dataset.subject || "Website form");
          const res = await fetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } });
          if (!res.ok) throw new Error("HTTP " + res.status);
          say(kind === "careers" ? "Thank you — your application has been received." : "Thank you — your message has been sent. We’ll be in touch soon.", true);
          form.reset();
          if (fileLabel) { fileLabel.textContent = "Upload… (PDF or Word, max 5 MB)"; wrap(fileInput)?.classList.remove("has-file"); }
        } else if (email) {
          const fd = new FormData(form);
          const lines = [];
          for (const [k, v] of fd.entries()) { if (k === "_gotcha" || v instanceof File) continue; if (v) lines.push(`${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`); }
          if (kind === "careers") lines.push("", "(Please attach your CV to this email.)");
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(form.dataset.subject || "Website form")}&body=${encodeURIComponent(lines.join("\n"))}`;
          say(kind === "careers" ? "Your email app should open with your details — please attach your CV and send." : "Your email app should open with your message ready to send.", true);
        } else {
          console.warn("[TCI] Form not connected: set formEndpoint or contactEmail in src/config.mjs and rebuild.");
          say("Sorry — we can’t send messages from this form right now. Please try again later.", false);
        }
      } catch (err) {
        say("Something went wrong sending your message. Please try again in a moment.", false);
      } finally {
        submit.disabled = false; submit.textContent = original;
      }
    });
  });

  /* ───────── Project showcase film: landscape or portrait cut, only the chapter on screen plays ───────── */
  const film = $("[data-film]");
  if (film) {
    const landscape = window.matchMedia("(min-aspect-ratio: 1/1)");
    const vids = $$(".film__chapter video", film);
    const pick = (v, key) => (key ? v.dataset[key + (landscape.matches ? "D" : "M")] : v.dataset[landscape.matches ? "d" : "m"]);
    const load = (i) => {
      const v = vids[i];
      if (!v) return;
      if (!v.poster) v.poster = pick(v, "poster");
      if (!v.getAttribute("src")) v.src = pick(v, "");
    };
    let current = -1, onScreen = false;
    const show = (i) => {
      current = i;
      [i, i + 1].forEach(load);
      vids.forEach((v, k) => {
        if (k === i && onScreen && !reduceMotion) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else v.pause();
      });
    };
    vids.slice(0, 2).forEach((v) => { v.poster = pick(v, "poster"); });
    film.addEventListener("film:chapter", (e) => { if (e.detail !== current) show(e.detail); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([en]) => {
        onScreen = en.isIntersecting;
        if (onScreen) vids.forEach((v) => { if (!v.poster) v.poster = pick(v, "poster"); });
        show(current < 0 ? 0 : current);
      }, { rootMargin: "200px 0px" }).observe(film);
      // stacked layout (reduced motion / no motion layer): the chapter in view plays
      const io = new IntersectionObserver((entries) => {
        if (film.dataset.pinned) return;
        entries.forEach((en) => { if (en.isIntersecting) show(Number(en.target.dataset.chapter)); });
      }, { threshold: 0.55 });
      $$(".film__chapter", film).forEach((c) => io.observe(c));
    }
    landscape.addEventListener?.("change", () => {
      vids.forEach((v) => { if (v.poster) v.poster = pick(v, "poster"); if (v.getAttribute("src")) v.src = pick(v, ""); });
      if (current >= 0) show(current);
    });
  }
  const dialog = $("[data-film-dialog]");
  if (dialog && dialog.showModal) {
    const v = $("video", dialog);
    $$("[data-film-open]").forEach((b) => b.addEventListener("click", () => {
      if (!v.getAttribute("src")) v.src = v.dataset.src;
      dialog.showModal();
      window.tciLenis?.stop();
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    }));
    $("[data-film-close]", dialog)?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { v.pause(); window.tciLenis?.start(); });
  } else $$("[data-film-open]").forEach((b) => { b.hidden = true; });

  /* ───────── 3D project model: load the (large) viewer only when it nears the screen ───────── */
  const model = $("[data-model3d]");
  if (model) {
    const load = () => {
      const s = document.createElement("script");
      s.src = model.dataset.src;
      s.async = true;
      s.onerror = () => model.classList.add("is-unsupported");
      document.body.appendChild(s);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); } }, { rootMargin: "600px 0px" });
      io.observe(model);
    } else load();
  }
})();

