// Static site generator — zero dependencies.  Run from the site folder:  node src/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cfg from "./config.mjs";
import * as D from "./data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Image sizes are read straight from the file headers (PNG / WebP) so new images just work.
function dims(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const t = b.toString("ascii", 12, 16);
    if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (t === "VP8L") { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    if (t === "VP8X") return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  }
  throw new Error("Unsupported image format: " + file);
}
const META = {};
for (const dir of ["", "icons"]) {
  const abs = path.join(ROOT, "assets/img", dir);
  for (const f of fs.readdirSync(abs)) {
    const m = f.match(/^(.+)\.(webp|png)$/);
    if (m) META[(dir ? dir + "/" : "") + m[1]] = { ...dims(path.join(abs, f)), ext: m[2] };
  }
}
const V = Date.now().toString(36); // cache-buster for css/js

// ───────────────────────── helpers ─────────────────────────
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (iso, upper = true) => {
  const d = new Date(iso + "T12:00:00Z");
  const s = d.toLocaleDateString("en-US", { month: "long", day: "2-digit", year: "numeric", timeZone: "UTC" });
  return upper ? s.toUpperCase() : s;
};
const url = (p) => (cfg.siteUrl ? `${cfg.siteUrl}/${p}` : p);

function img(name, { alt = "", cls = "", sizes = "100vw", eager = false, attrs = "" } = {}) {
  const m = META[name];
  if (!m) throw new Error(`Unknown image: ${name}`);
  const md = META[name + "-md"];
  const base = `assets/img/${name}.${m.ext}`;
  const srcset = md ? ` srcset="assets/img/${name}-md.${md.ext} ${md.w}w, ${base} ${m.w}w" sizes="${sizes}"` : "";
  return `<img${cls ? ` class="${cls}"` : ""} src="${base}"${srcset} alt="${esc(alt)}" width="${m.w}" height="${m.h}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}${attrs ? " " + attrs : ""}>`;
}

const ICON = {
  user: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.6-4 3.7-6 7.5-6s6.9 2 7.5 6"/></svg>`,
  phone: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h2.8l1.4 4-1.9 1.3a11 11 0 0 0 5.3 5.3l1.3-1.9 4 1.4v2.8a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z"/></svg>`,
  mail: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>`,
};

// ───────────────────────── shared chrome ─────────────────────────
const NAV = [
  { key: "architecture", label: "Architecture", href: "projects.html?type=architecture" },
  { key: "interior", label: "Interior", href: "projects.html?type=interior" },
  { key: "founders", label: "Founders", href: "index.html#leadership" },
  { key: "team", label: "Team", href: "team.html" },
  { key: "careers", label: "Careers", href: "careers.html" },
  { key: "contact", label: "Contact", href: "contact.html" },
];
const MENU = [
  { label: "Home", href: "index.html", key: "home" },
  { label: "Architecture", href: "projects.html?type=architecture" },
  { label: "Interior", href: "projects.html?type=interior" },
  { label: "Expertise", href: "index.html#expertise" },
  { label: "People", href: "team.html", key: "team" },
  { label: "Culture", href: "culture.html", key: "culture" },
  { label: "Careers", href: "careers.html", key: "careers" },
  { label: "Contact", href: "contact.html", key: "contact" },
  { label: "About", href: "index.html#leadership" },
];

function header({ solid, current }) {
  const links = NAV.map((n) => `<a href="${n.href}"${n.key === current ? ' aria-current="page"' : ""}>${n.label}</a>`).join("");
  return `
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header${solid ? " is-solid" : ""}" id="site-header">
  <div class="site-header__inner">
    <a class="brand" href="index.html" aria-label="${esc(cfg.siteName)} — home">
      <img src="assets/img/logo-light.png" alt="" width="${META["logo-light"].w}" height="${META["logo-light"].h}">
    </a>
    <nav class="primary-nav" aria-label="Primary">${links}</nav>
    <div class="header-tools">
      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark theme" title="Switch theme">
        <span class="theme-toggle__sun">${ICON.sun}</span><span class="theme-toggle__moon">${ICON.moon}</span>
      </button>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-overlay" data-menu-open>
        <span class="menu-toggle__bars" aria-hidden="true"><i></i><i></i></span><span>Menu</span>
      </button>
    </div>
  </div>
</header>
<div class="menu-overlay" id="menu-overlay" hidden aria-label="Site menu" role="dialog" aria-modal="true">
  <div class="menu-overlay__backdrop" data-menu-close></div>
  <div class="menu-overlay__panel">
    <button class="menu-close" type="button" data-menu-close><span class="menu-close__x" aria-hidden="true">${ICON.close}</span><span>Menu</span></button>
    <nav aria-label="Site menu">
      <ul>${MENU.map((m) => `<li><a href="${m.href}"${m.key && m.key === current ? ' aria-current="page"' : ""}>${m.label}</a></li>`).join("")}</ul>
    </nav>
    <div class="menu-overlay__foot">
      <small>© TCI ${new Date().getFullYear()}</small>
      <p>From concept<br>to completion</p>
    </div>
  </div>
</div>`;
}

function footer() {
  const cols = [
    ["Menu", [["Team", "team.html"], ["Leadership", "index.html#leadership"], ["Voices", "culture.html#voices"]]],
    ["Projects", [["Architecture", "projects.html?type=architecture"], ["Interiors", "projects.html?type=interior"], ["Landscape", "projects.html?cat=landscape"]]],
    ["Blogs", [["Articles", "blogs.html"], ["Gallery", "projects.html"]]],
    ["Culture", [["Leadership", "index.html#leadership"], ["Unity", "culture.html#life"], ["Culture", "culture.html"]]],
    ["Careers", [["Kickstart", "careers.html#kickstart"], ["Connect", "contact.html"]]],
    ["Contact", [["Get in touch", "contact.html#connect"], ["Offices", "contact.html#offices"]]],
  ];
  const social = Object.entries(cfg.social)
    .filter(([, href]) => href)
    .map(([k, href]) => `<li><a href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${k[0].toUpperCase() + k.slice(1)}"><img src="assets/img/icons/${k}.png" alt="" width="22" height="22" loading="lazy"></a></li>`)
    .join("");
  return `
<footer class="site-footer">
  <div class="container site-footer__grid">
    <nav class="footer-nav" aria-label="Footer">
      ${cols.map(([h, ls]) => `<div><h2>${h}</h2><ul>${ls.map(([l, href]) => `<li><a href="${href}">${l}</a></li>`).join("")}</ul></div>`).join("")}
    </nav>
    <div class="footer-brand">
      <ul class="social">${social}</ul>
      <img class="logo logo--on-light" src="assets/img/logo-dark.png" alt="${esc(cfg.siteName)} — ${esc(cfg.tagline)}" width="${META["logo-dark"].w}" height="${META["logo-dark"].h}" loading="lazy">
      <img class="logo logo--on-dark" src="assets/img/logo-light.png" alt="" width="${META["logo-light"].w}" height="${META["logo-light"].h}" loading="lazy" aria-hidden="true">
      <p class="legal"><a href="privacy.html">Privacy Policy</a><span>© TCI ${new Date().getFullYear()}</span></p>
    </div>
  </div>
</footer>`;
}

function mapFigure({ id } = {}) {
  const m = META["world-map"];
  const pins = cfg.offices.map((o) => `<li class="pin${o.side === "left" ? " pin--left" : ""}" style="--x:${o.x}%;--y:${o.y}%" title="${esc(o.name)}"><span class="pin__head"></span><span class="pin__label">${esc(o.label || o.name)}</span></li>`).join("");
  return `<div class="map"${id ? ` id="${id}"` : ""}>
    <img src="assets/img/world-map.webp" alt="World map with offices in ${cfg.offices.map((o) => esc(o.name)).join(", ")}" width="${m.w}" height="${m.h}" loading="lazy">
    <ul class="map__pins">${pins}</ul>
  </div>`;
}

function formAttrs(kind, subject) {
  return `data-form="${kind}" data-endpoint="${esc(cfg.formEndpoint)}" data-email="${esc(cfg.contactEmail)}" data-subject="${esc(subject)}"`;
}

function contactForm() {
  return `<form class="form form--contact" method="post" novalidate ${formAttrs("contact", "Website enquiry")}>
    <div class="form__row">
      <label class="field field--icon"><span class="sr-only">Name</span><input name="name" type="text" placeholder="Name" autocomplete="name" required>${ICON.user}</label>
      <label class="field field--icon"><span class="sr-only">Phone</span><input name="phone" type="tel" placeholder="+971" autocomplete="tel">${ICON.phone}</label>
      <label class="field field--icon"><span class="sr-only">Email</span><input name="email" type="email" placeholder="Email" autocomplete="email" required>${ICON.mail}</label>
    </div>
    <label class="field"><span class="sr-only">Message</span><textarea name="message" placeholder="Message" rows="4" required></textarea></label>
    <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn" type="submit">Submit</button>
    <p class="form__status" role="status" aria-live="polite"></p>
  </form>`;
}

function cta({ title = "Let’s Bring Your Vision to Life", text = "Connect with Top Concept International to explore innovative and tailored design solutions for your next project. Our team is ready to guide you from concept to completion with professionalism and expertise.", tracked = false } = {}) {
  return `
<section class="cta${tracked ? " cta--tracked" : ""}" id="connect" aria-labelledby="cta-title">
  <div class="container cta__grid">
    <div class="cta__copy">
      <h2 id="cta-title">${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${contactForm()}
    </div>
    <div class="cta__map reveal">${mapFigure()}</div>
  </div>
</section>`;
}

function page({ file, title, description, body, solid = false, current = "", ogImage = "og.jpg", head = "", bodyClass = "" }) {
  const fullTitle = title === cfg.siteName ? `${cfg.siteName} — Architects, Engineers, Designers` : `${title} — ${cfg.siteName}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || cfg.description)}">
<meta name="theme-color" content="#2b2b2b">
${cfg.siteUrl ? `<link rel="canonical" href="${url(file === "index.html" ? "" : file)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description || cfg.description)}">
<meta property="og:image" content="${url("assets/img/" + ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<script>document.documentElement.classList.add("js");try{var t=localStorage.getItem("tci-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<link rel="preload" href="assets/fonts/montserrat-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/styles.css?v=${V}">
${head}
</head>
<body${[solid ? "has-solid-header" : "", bodyClass].filter(Boolean).length ? ` class="${[solid ? "has-solid-header" : "", bodyClass].filter(Boolean).join(" ")}"` : ""}>
${header({ solid, current })}
<main id="main">
${body}
</main>
${footer()}
<script src="assets/js/main.js?v=${V}" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, file), html);
  written.push(file);
}
const written = [];

// ───────────────────────── components ─────────────────────────
function blogCard(b, i = 0) {
  return `<article class="blog-card reveal" style="--d:${i * 80}ms">
    <a class="blog-card__link" href="blog-${b.slug}.html">
      <div class="blog-card__media">${img(b.img, { alt: b.alt, sizes: "(min-width: 900px) 30vw, 90vw" })}</div>
      <time datetime="${b.date}">${fmtDate(b.date)}</time>
      <h3>${esc(b.title)}</h3>
    </a>
  </article>`;
}

function projectCard(p, i = 0) {
  return `<a class="proj-card reveal" style="--d:${(i % 3) * 70}ms" href="project-${p.slug}.html" data-type="${p.type}" data-cat="${p.cat}">
    <div class="proj-card__media">${img(p.img, { alt: p.alt, sizes: "(min-width: 1000px) 30vw, (min-width: 720px) 45vw, 92vw" })}</div>
    <div class="proj-card__meta"><span>${esc(p.label)}</span><h3>${esc(p.title)}</h3></div>
  </a>`;
}

function pageHero({ img: name, alt, title, current, openBand = false }) {
  // openBand: the tabs sit inside a black band that the caller must close with </div>
  return `
<section class="hero hero--page">
  ${img(name, { alt, cls: "hero__bg", eager: true, sizes: "100vw" })}
  <div class="hero__shade"></div>
  <h1 class="hero__title">${title}</h1>
</section>${openBand ? `\n<div class="dark-band">` : ""}
<div class="container">
  <nav class="tabs" aria-label="People sections">
    <a href="team.html"${current === "team" ? ' aria-current="page"' : ""}>Team</a>
    <a href="culture.html"${current === "culture" ? ' aria-current="page"' : ""}>Culture</a>
    <a href="careers.html"${current === "careers" ? ' aria-current="page"' : ""}>Careers</a>
  </nav>
</div>`;
}

const paras = (arr, cls = "") => arr.map((t) => `<p${cls ? ` class="${cls}"` : ""}>${esc(t)}</p>`).join("");

// ───────────────────────── pages ─────────────────────────
// HOME
{
  const hero = META["hero"];
  const featured = D.projects.filter((p) => p.featured);
  const blogs3 = D.blogs.slice(0, 3);
  const L = D.leadership;

  const slides = featured
    .map(
      (p, i) => `<li class="slide${i === 0 ? " is-active" : ""}" id="slide-${i}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${featured.length}" data-label="${esc(p.label)}" data-title="${esc(p.title)}" data-href="project-${p.slug}.html">
        <a href="project-${p.slug}.html" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(p.title)} — ${esc(p.label)}">${img(p.img, { alt: p.alt, sizes: "(min-width: 900px) 62vw, 82vw", eager: false })}</a>
      </li>`
    )
    .join("");
  const dots = featured.map((p, i) => `<button type="button" class="dot${i === 0 ? " is-active" : ""}" data-slide="${i}" aria-label="Show ${esc(p.title)}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("");

  const expertiseCards = D.expertise
    .map(
      (e, i) => `<a class="ex-card ex-card--${e.size} reveal" style="--d:${(i % 3) * 70}ms" href="projects.html?cat=${e.slug}">
      <div class="ex-card__media">${img(e.img, { alt: e.alt, sizes: e.size === "lg" ? "(min-width: 900px) 46vw, 92vw" : "(min-width: 900px) 30vw, 92vw" })}</div>
      <h3><span class="t-light">${esc(e.title)}</span><span class="t-dark">${esc(e.darkTitle || e.title)}</span></h3>
    </a>`
    )
    .join("");

  page({
    file: "index.html",
    title: cfg.siteName,
    description: cfg.description,
    current: "home",
    head: `<link rel="preload" as="image" href="assets/img/hero-md.webp" imagesrcset="assets/img/hero-md.webp 800w, assets/img/hero.webp ${hero.w}w" imagesizes="100vw" fetchpriority="high">`,
    body: `
<section class="hero hero--home">
  ${img("hero", { alt: "Azizi tower rising against a deep blue sky", cls: "hero__bg", eager: true })}
  <div class="hero__shade"></div>
  <h1 class="hero__title">From <em>concept</em> to <em>completion</em></h1>
  <a class="hero__scroll" href="#blogs" aria-label="Scroll to content"><span></span></a>
</section>

<section class="section" id="blogs" aria-labelledby="blogs-title">
  <div class="container">
    <div class="section__head"><h2 id="blogs-title">Blogs</h2><a class="link-caps" href="blogs.html">See all blogs</a></div>
    <div class="cards cards--3">${blogs3.map(blogCard).join("")}</div>
  </div>
</section>

<div class="container"><hr class="rule"></div>

<section class="section section--projects" id="projects" aria-labelledby="projects-title">
  <div class="container">
    <div class="section__head"><h2 id="projects-title">Projects</h2><a class="link-caps" href="projects.html">See all projects</a></div>
  </div>
  <div class="carousel" data-carousel aria-roledescription="carousel" aria-label="Featured projects">
    <ul class="carousel__track" data-track>${slides}</ul>
    <button class="carousel__nav carousel__nav--prev" type="button" data-prev aria-label="Previous project">${ICON.arrow}</button>
    <button class="carousel__nav carousel__nav--next" type="button" data-next aria-label="Next project">${ICON.arrow}</button>
    <div class="carousel__caption" aria-live="polite">
      <span class="carousel__label" data-cap-label>${esc(featured[0].label)}</span>
      <a class="carousel__title" data-cap-title href="project-${featured[0].slug}.html">${esc(featured[0].title)}</a>
    </div>
    <div class="carousel__dots" role="group" aria-label="Choose project">${dots}</div>
  </div>
</section>

<section class="panel" id="culture-careers" aria-label="Culture and careers">
  <div class="container panel__grid">
    <article class="panel__item reveal">
      <h2><a href="culture.html">Culture</a></h2>
      <a class="panel__media" href="culture.html" tabindex="-1" aria-hidden="true">${img("culture-meeting", { alt: "", sizes: "(min-width: 900px) 45vw, 92vw" })}</a>
      <p>Our culture comes from the heart at Top Concept International, where we stand together, work with honesty and give our best to create spaces that truly matter.</p>
    </article>
    <article class="panel__item reveal" style="--d:100ms">
      <h2><a href="careers.html">Careers</a></h2>
      <a class="panel__media" href="careers.html" tabindex="-1" aria-hidden="true">${img("careers-office", { alt: "", sizes: "(min-width: 900px) 45vw, 92vw" })}</a>
      <p>Our careers begin with opportunity at Top Concept International, where we grow together, welcome ambition and support people to build meaningful futures that truly matter.</p>
    </article>
  </div>
</section>

<section class="quote-block dark-only" aria-label="Words from our CEO">
  <div class="container quote-block__grid">
    <div class="quote-block__media reveal">${img("ceo-desk", { alt: "Ragheed Al Tahhan reviewing drawings at his desk", sizes: "(min-width: 900px) 30vw, 70vw" })}</div>
    <figure class="quote-block__text reveal">
      <blockquote><p>“${esc(L.quote)}”</p></blockquote>
      <figcaption>${esc(L.quoteBy)} - <span>${esc(L.quoteRole)}</span></figcaption>
    </figure>
  </div>
</section>

<section class="leadership" id="leadership" aria-labelledby="lead-title">
  <div class="container leadership__grid">
    <h2 id="lead-title" class="leadership__title">Leadership</h2>
    <div class="leadership__text reveal">
      ${paras(L.paragraphs)}
      <ul class="signatures">${L.people.map((p) => `<li><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></li>`).join("")}</ul>
    </div>
    <div class="leadership__media reveal">${img("founders", { alt: "Nawaf Al Falasi and Engr. Ragheed Al-Tahhan", sizes: "(min-width: 900px) 40vw, 90vw" })}</div>
  </div>
</section>

<section class="section section--expertise" id="expertise" aria-labelledby="ex-title">
  <div class="container">
    <h2 id="ex-title" class="section__title"><span class="t-light">Fields of Expertise</span><span class="t-dark">Our Expertise</span></h2>
    <p class="section__lead dark-only">Our culture comes from the heart at Top Concept International, where we stand together, work with honesty and give our best to create spaces that truly matter.</p>
    <div class="ex-grid">${expertiseCards}</div>
  </div>
</section>

${cta()}`,
  });
}

// PROJECTS INDEX
{
  const chips = [{ slug: "all", label: "All" }, ...D.projectTypes]
    .map((t, i) => `<button type="button" class="chip${i === 0 ? " is-active" : ""}" data-filter="${t.slug}" aria-pressed="${i === 0}">${t.label}</button>`)
    .join("");
  page({
    file: "projects.html",
    title: "Projects",
    description: "Selected architecture, interior, masterplan and hospitality projects by Top Concept International.",
    solid: true,
    body: `
<section class="page-head container">
  <h1>Projects</h1>
  <div class="chips" role="group" aria-label="Filter projects" data-chips>${chips}</div>
  <p class="filter-note" data-filter-note hidden></p>
</section>
<section class="container proj-grid" data-projects>
  ${D.projects.map(projectCard).join("")}
</section>
<p class="container empty" data-empty hidden>No projects match this filter yet.</p>
${cta()}`,
  });
}

// PROJECT DETAIL
for (const p of D.projects) {
  const gallery = p.gallery ? [p.img, ...p.gallery] : [p.img];
  const meta = META[p.img];
  const related = [...D.projects.filter((x) => x.slug !== p.slug && x.type === p.type), ...D.projects.filter((x) => x.slug !== p.slug && x.type !== p.type)].slice(0, 3);
  const idx = D.projects.findIndex((x) => x.slug === p.slug);
  const next = D.projects[(idx + 1) % D.projects.length];
  const tall = meta.h > meta.w * 1.15;
  const typeLabel = D.projectTypes.find((t) => t.slug === p.type)?.label;
  page({
    file: `project-${p.slug}.html`,
    title: p.title,
    description: `${p.title} — ${p.label} project by Top Concept International. ${D.labelBlurbs[p.label] || ""}`.trim(),
    solid: true,
    ogImage: `${p.img}-md.webp`,
    body: `
<article class="project">
  <header class="container project__head">
    <p class="crumbs"><a href="projects.html">Projects</a><span aria-hidden="true">/</span><a href="projects.html?type=${p.type}">${esc(typeLabel)}</a></p>
    <p class="project__label">${esc(p.label)}</p>
    <h1>${esc(p.title)}</h1>
    <p class="project__blurb">${esc(D.labelBlurbs[p.label] || "")}</p>
  </header>
  <div class="container">
    <div class="project__gallery${gallery.length > 1 ? " project__gallery--multi" : ""}${tall ? " is-tall" : ""}">
      ${gallery
        .map((g, i) => {
          const alt = i === 0 ? p.alt : `${p.title} — view ${i + 1}`;
          return `<a class="project__shot${i === 0 ? " project__shot--lead" : ""}" href="assets/img/${g}.webp" data-lightbox data-caption="${esc(p.title)}">${img(g, { alt, eager: i === 0, sizes: i === 0 ? "(min-width: 1000px) 1200px, 96vw" : "(min-width: 900px) 30vw, 92vw" })}</a>`;
        })
        .join("")}
    </div>
    <nav class="project__pager" aria-label="Project navigation">
      <a href="projects.html">← All projects</a>
      <a href="project-${next.slug}.html">Next: ${esc(next.title)} →</a>
    </nav>
  </div>
  <section class="section container">
    <div class="section__head"><h2>More Projects</h2><a class="link-caps" href="projects.html">See all projects</a></div>
    <div class="proj-grid proj-grid--3">${related.map(projectCard).join("")}</div>
  </section>
</article>
${cta()}`,
  });
}

// BLOGS INDEX
page({
  file: "blogs.html",
  title: "Blogs",
  description: "Thoughts on architecture, interior design, engineering coordination and delivery from Top Concept International.",
  solid: true,
  body: `
<section class="page-head container"><h1>Blogs</h1></section>
<section class="container"><div class="cards cards--3 cards--wrap">${D.blogs.map(blogCard).join("")}</div></section>
${cta()}`,
});

// BLOG POSTS
for (const b of D.blogs) {
  const others = D.blogs.filter((x) => x.slug !== b.slug).slice(0, 3);
  page({
    file: `blog-${b.slug}.html`,
    title: b.title,
    description: b.excerpt,
    solid: true,
    ogImage: `${b.img}-md.webp`,
    body: `
<article class="post">
  <header class="container container--narrow post__head">
    <p class="crumbs"><a href="blogs.html">Blogs</a></p>
    <time datetime="${b.date}">${fmtDate(b.date)}</time>
    <h1>${esc(b.title)}</h1>
  </header>
  <div class="container container--narrow"><figure class="post__cover">${img(b.img, { alt: b.alt, eager: true, sizes: "(min-width: 900px) 900px, 92vw" })}</figure></div>
  <div class="container container--narrow prose">${paras(b.body)}</div>
  <section class="section container">
    <div class="section__head"><h2>More Reading</h2><a class="link-caps" href="blogs.html">See all blogs</a></div>
    <div class="cards cards--3">${others.map(blogCard).join("")}</div>
  </section>
</article>
${cta()}`,
  });
}

// TEAM
page({
  file: "team.html",
  title: "Meet the Team",
  description: "Meet the architects, engineers and designers behind Top Concept International.",
  current: "team",
  body: `
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>Team</em>", current: "team", openBand: true })}
  <section class="leadership leadership--flip" id="leadership" aria-labelledby="team-lead-title">
    <div class="container leadership__grid">
      <h2 id="team-lead-title" class="leadership__title">Leadership</h2>
      <div class="leadership__text reveal">
        ${paras(D.teamLeadership.paragraphs)}
        <ul class="signatures">${D.teamLeadership.people.map((p) => `<li><strong>${esc(p.name)}</strong><span>${esc(p.role)}</span></li>`).join("")}</ul>
      </div>
      <div class="leadership__media reveal">${img("founders", { alt: "Nawaf Al Falasi and Engr. Ragheed Al-Tahhan", sizes: "(min-width: 900px) 40vw, 90vw" })}</div>
    </div>
  </section>
</div>
<section class="container team" aria-label="Team members">
  <ul class="team-grid">
    ${D.team
      .map(
        (m, i) => `<li class="member reveal" style="--d:${(i % 3) * 70}ms">
      <div class="member__media${m.img ? "" : " is-placeholder"}">${img(m.img || "t-placeholder", { alt: m.img ? `Portrait of ${m.name}` : "", sizes: "(min-width: 900px) 25vw, 45vw" })}</div>
      <p class="member__role">${esc(m.role)}</p>
      <h3 class="member__name">${esc(m.name)}</h3>
    </li>`
      )
      .join("")}
  </ul>
</section>
${cta({ title: "Design Begins With a Conversation.", text: "Share your vision with us. We’ll help shape it into something real.", tracked: true })}`,
});

// CULTURE
{
  const C = D.culture;
  page({
    file: "culture.html",
    title: "Culture",
    description: "Life at Top Concept International: a culture built on trust, respect and genuinely caring for one another.",
    current: "culture",
    body: `
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>Team</em>", current: "culture" })}
<div class="container culture">
  <figure class="wide-shot reveal">${img("culture-hero", { alt: "Colleagues in conversation on a leather sofa", sizes: "(min-width: 1000px) 1350px, 96vw" })}</figure>
  <div class="prose prose--lg reveal">${paras(C.intro)}</div>
  <hr class="rule">
  <section id="life" class="split reveal" aria-labelledby="life-title">
    <h2 id="life-title" class="split__title">Life at Top Concept</h2>
    <div class="split__media">${img("culture-life", { alt: "Two colleagues discussing a drawing", sizes: "(min-width: 900px) 45vw, 92vw" })}</div>
    <div class="prose prose--lg split__text">${paras(C.life)}</div>
  </section>
  <hr class="rule">
  <section class="split reveal" aria-labelledby="thrive-title">
    <h2 id="thrive-title" class="split__title">A Place Where People Thrive</h2>
    <div class="split__media split__media--stack">
      ${img("culture-place", { alt: "Open-plan studio with plants and a foosball table", sizes: "(min-width: 900px) 45vw, 92vw" })}
      ${img("culture-roundtable", { alt: "Team meeting around a round table", sizes: "(min-width: 900px) 45vw, 92vw" })}
    </div>
    <div class="prose prose--lg split__text">${paras(C.thrive)}</div>
  </section>
  <hr class="rule">
  <section id="voices" class="voices" aria-labelledby="voices-title">
    <h2 id="voices-title">Voices from our Team</h2>
    ${C.voices
      .map(
        (v) => `<figure class="voice reveal">
      <div class="voice__media">${img(v.img, { alt: `Portrait of ${v.name}`, sizes: "(min-width: 900px) 30vw, 60vw" })}</div>
      <blockquote><p>“${esc(v.quote)}”</p><figcaption>${esc(v.name)} - <span>${esc(v.role)}</span></figcaption></blockquote>
    </figure>`
      )
      .join("")}
  </section>
</div>
${cta()}`,
  });
}

// CAREERS
page({
  file: "careers.html",
  title: "Careers",
  description: "Build inspiring spaces and a rewarding future at Top Concept International. Send us your CV.",
  current: "careers",
  body: `
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>Team</em>", current: "careers" })}
<div class="container careers">
  <figure class="wide-shot wide-shot--tall reveal">${img("careers-team", { alt: "Colleagues gathered around a long table of drawings, seen from above", sizes: "(min-width: 1000px) 1350px, 96vw" })}</figure>
  <p class="prose prose--lg reveal">${esc(D.careers.intro)}</p>
</div>
<section class="kickstart" id="kickstart" aria-labelledby="kick-title">
  <div class="container kickstart__grid">
    <div class="kickstart__copy">
      <h2 id="kick-title">Kickstart Your Journey With Us</h2>
      <p>Connect with Top Concept International and discover thoughtful design solutions tailored to your vision. Our team is here to guide you from concept to completion with creativity, precision, and trusted expertise.</p>
      <form class="form form--careers" method="post" enctype="multipart/form-data" novalidate ${formAttrs("careers", "Career application")}>
        <label class="line-field"><span>Full Name:</span><input name="name" type="text" placeholder="Enter your full name..." autocomplete="name" required></label>
        <label class="line-field"><span>Position:</span><input name="position" type="text" placeholder="Enter your desired position..." required></label>
        <label class="line-field line-field--file"><span>CV:</span>
          <input name="cv" type="file" accept=".pdf,.doc,.docx" required>
          <em data-file-name>Upload… (PDF or Word, max 5 MB)</em>
        </label>
        <label class="check"><input type="checkbox" name="emirati" value="yes"><span>I am Emirati</span></label>
        <label class="line-field"><span>Email:</span><input name="email" type="email" placeholder="Enter your email..." autocomplete="email" required></label>
        <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn--light" type="submit">Submit</button>
        <p class="form__status" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="kickstart__media reveal">${img("careers-kickstart", { alt: "Two colleagues reviewing plans in the studio", sizes: "(min-width: 900px) 40vw, 92vw" })}</div>
  </div>
</section>
${cta()}`,
});

// CONTACT
page({
  file: "contact.html",
  title: "Contact Us",
  description: "Contact Top Concept International — offices serving clients across the UAE, India and London.",
  solid: true,
  current: "contact",
  body: `
<section class="contact-intro container">
  <h1>Contact Us</h1>
  <div id="offices" class="reveal">${mapFigure()}</div>
  <p class="prose prose--lg">Top Concept International connects clients across the UAE, India and London, bringing creative expertise and trusted support across every stage of the journey. Wherever your project begins, our team is ready to turn ideas into meaningful spaces with quality, care and precision.</p>
  ${cfg.contactEmail || cfg.whatsapp ? `<p class="contact-direct">${cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : ""}${cfg.whatsapp ? `<a href="https://wa.me/${esc(cfg.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}</p>` : ""}
</section>
${cta()}`,
});

// PRIVACY
page({
  file: "privacy.html",
  title: "Privacy Policy",
  description: "How Top Concept International handles the information you send us.",
  solid: true,
  body: `
<section class="page-head container container--narrow"><h1>Privacy Policy</h1></section>
<div class="container container--narrow prose prose--legal">
  <p><em>Last updated: ${fmtDate(new Date().toISOString().slice(0, 10), false)}</em></p>
  <p>Top Concept International (“we”, “us”) respects your privacy. This page explains what information this website collects and how it is used.</p>
  <h2>Information you send us</h2>
  <p>When you use the contact or careers forms we receive the details you enter — such as your name, phone number, email address, message and, for job applications, your CV and desired position. We use this information only to respond to your enquiry or to consider your application.</p>
  <h2>How we use and share it</h2>
  <p>We do not sell your personal information. We may share it with service providers that help us operate the website or handle email and form submissions, and only for those purposes. We keep enquiries and applications only for as long as needed for the purpose they were sent, unless the law requires otherwise.</p>
  <h2>Cookies and local storage</h2>
  <p>This website does not use advertising or tracking cookies. Your browser may store a small preference (for example, your light or dark theme choice) on your own device so the site can remember it.</p>
  <h2>Third-party links</h2>
  <p>Links to social networks and other sites are provided for convenience. Those sites have their own privacy practices, which we do not control.</p>
  <h2>Your choices</h2>
  <p>You can ask us to access, correct or delete the personal information you have sent us by contacting us through the <a href="contact.html">contact page</a>.</p>
  <h2>Changes</h2>
  <p>We may update this policy from time to time. The date above shows when it was last changed.</p>
</div>`,
});

// 404
page({
  file: "404.html",
  title: "Page not found",
  description: "The page you are looking for could not be found.",
  solid: true,
  body: `
<section class="notfound container">
  <p class="notfound__code">404</p>
  <h1>This page has moved, or never existed.</h1>
  <p>Let’s get you back to the work.</p>
  <p class="notfound__links"><a class="btn" href="index.html">Back to home</a><a class="btn btn--ghost" href="projects.html">View projects</a></p>
</section>`,
});

// robots + sitemap
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\n${cfg.siteUrl ? `Sitemap: ${cfg.siteUrl}/sitemap.xml\n` : ""}`);
if (cfg.siteUrl) {
  const urls = written.filter((f) => f !== "404.html");
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((f) => `  <url><loc>${cfg.siteUrl}/${f === "index.html" ? "" : f}</loc></url>`).join("\n")}\n</urlset>\n`
  );
}

console.log(`Built ${written.length} pages: ${written.join(", ")}`);
