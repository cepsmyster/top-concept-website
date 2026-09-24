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
  const s = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return upper ? s.toUpperCase() : s;
};
const url = (p) => (cfg.siteUrl ? `${cfg.siteUrl}/${p}` : p);

// Display headings: light caps, with the last word dropped onto its own line in bold ("ENGINEERED FOR / SCALE.").
// A short last word ("us", "of") pulls the word before it along. To choose the bold words yourself,
// wrap them in <span class="hb">…</span> in the heading. The look is set in styles.css under "Display headings".
function boldLast(inner) {
  if (/class="hb"/.test(inner)) return inner.replace(/\s*<span class="hb">/, '<br class="hbr"><span class="hb">');
  const parts = inner.split(/(<[^>]+>)/); // odd indexes are tags
  for (let i = parts.length - 1; i >= 0; i -= 2) {
    if (i % 2 || !parts[i].trim()) continue;
    const words = parts[i].trimEnd().split(/(\s+)/);
    const trail = parts[i].slice(parts[i].trimEnd().length);
    let take = 1;
    const before = parts.slice(0, i).join("").replace(/<[^>]+>/g, "").trim();
    if (words[words.length - 1].replace(/[^\p{L}\p{N}]/gu, "").length <= 3 && words.length >= 3 && (words.length > 3 || before)) take = 2;
    const cut = words.length - (take * 2 - 1);
    const lead = words.slice(0, cut).join("").trimEnd();
    const bold = words.slice(cut).join("");
    const hasLight = lead || before;
    parts[i] = `${lead}${hasLight ? '<br class="hbr">' : ""}<span class="hb">${bold}</span>${trail}`;
    return parts.join("");
  }
  return inner;
}
function displayHeadings(html) {
  return html.replace(/<(h[123])(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (all, tag, attrs = "", inner) => {
    const cls = (attrs.match(/class="([^"]*)"/) || [, ""])[1];
    if (/\bfilm__kicker\b/.test(cls) || (tag === "h3" && !/\b(film__title|hd)\b/.test(cls))) return all;
    // theme-specific wording: each variant gets its own bold word
    const body = /class="t-(light|dark)"/.test(inner)
      ? inner.replace(/(<span class="t-(?:light|dark)">)([\s\S]*?)(<\/span>)/g, (m, a, t, b) => a + boldLast(t) + b)
      : boldLast(inner);
    const nextAttrs = /\bhd\b/.test(cls) ? attrs : cls ? attrs.replace(/class="[^"]*"/, `class="${cls} hd"`) : `${attrs} class="hd"`;
    return `<${tag}${nextAttrs}>${body}</${tag}>`;
  });
}

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
  arrowRight: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>`,
};

// ───────────────────────── shared chrome ─────────────────────────
// Menu items come from the "Menu hamburger" design. Culture and Careers live under People (tabs).
const MENU = [
  { label: "Home", href: "index.html", key: "home" },
  { label: "Architecture", href: "projects.html?type=architecture" },
  { label: "Interior", href: "projects.html?type=interior" },
  { label: "Expertise", href: "expertise.html", key: "expertise" },
  { label: "People", href: "team.html", key: "team" },
  { label: "Contact", href: "contact.html", key: "contact" },
  { label: "About", href: "team.html#leadership" },
];

// Floating header (after thirdway.com): theme switch left · logo + menu button in a card, centred · "Let’s talk" right.
// The menu grows out of the card: the same links, set large, then a strip of the latest blogs.
// TCI wordmark only (the full logo with "Architects · Engineers · Designers" stays in the footer)
const brandLogos = (h = "") => `<img class="logo--on-light" src="assets/img/wordmark-dark.png" alt="" width="${META["wordmark-dark"].w}" height="${META["wordmark-dark"].h}"${h}><img class="logo--on-dark" src="assets/img/wordmark-light.png" alt="" width="${META["wordmark-light"].w}" height="${META["wordmark-light"].h}"${h}>`;
const themeToggle = (cls = "") => `<button class="theme-toggle${cls}" type="button" data-theme-toggle aria-label="Switch to light theme" title="Switch theme">
        <span class="theme-toggle__sun">${ICON.sun}</span><span class="theme-toggle__moon">${ICON.moon}</span>
      </button>`;
// `copy` = the second set in the looping strip: hidden from screen readers and keyboard
function menuBlogCard(b, copy = false) {
  return `<li class="menu-blog"${copy ? ' aria-hidden="true"' : ""}><a href="blog-${b.slug}.html"${copy ? ' tabindex="-1"' : ""}>
          <div class="menu-blog__media">${img(b.img, { alt: "", sizes: "240px" })}</div>
          <time datetime="${b.date}">${fmtDate(b.date)}</time>
          <h3>${esc(b.title)}</h3>
        </a></li>`;
}

function header({ solid, current }) {
  const cur = current === "culture" || current === "careers" ? "team" : current;
  return `
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header${solid ? " is-solid" : ""}" id="site-header">
  <div class="site-header__inner">
    <div class="hdr-side hdr-side--left">
      ${themeToggle(" hdr-chip")}
    </div>
    <div class="hdr-card">
      <a class="brand" href="index.html" aria-label="${esc(cfg.siteName)} — home">${brandLogos()}</a>
      <a class="talk-link" href="contact.html">Let’s talk</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-overlay" aria-label="Open menu" data-menu-open>
        <span class="menu-toggle__bars" aria-hidden="true"><i></i><i></i></span>
      </button>
    </div>
    <div class="hdr-side hdr-side--right">
      <a class="talk" href="contact.html"><span class="talk__text">Let’s talk</span><span class="talk__arrow" aria-hidden="true">${ICON.arrowRight}</span></a>
    </div>
  </div>
</header>
<div class="menu-overlay" id="menu-overlay" hidden aria-label="Site menu" role="dialog" aria-modal="true">
  <div class="menu-overlay__backdrop" data-menu-close></div>
  <div class="menu-overlay__panel" data-lenis-prevent>
    <div class="menu-overlay__head">
      <a class="brand" href="index.html" aria-label="${esc(cfg.siteName)} — home">${brandLogos(' loading="lazy"')}</a>
      <div class="menu-overlay__tools">
        ${themeToggle(" menu-overlay__theme")}
        <button class="menu-close" type="button" data-menu-close aria-label="Close menu"><span class="menu-close__x" aria-hidden="true">${ICON.close}</span></button>
      </div>
    </div>
    <nav aria-label="Site menu">
      <ul>${MENU.map((m) => `<li><a href="${m.href}"${m.key && m.key === cur ? ' aria-current="page"' : ""}>${m.label}</a></li>`).join("")}</ul>
    </nav>
    <section class="menu-blogs" aria-labelledby="menu-blogs-title">
      <div class="menu-blogs__head">
        <h2 id="menu-blogs-title"><span class="menu-blogs__dot" aria-hidden="true"></span>Latest blogs</h2>
        <a class="menu-blogs__all" href="blogs.html"${cur === "blogs" ? ' aria-current="page"' : ""}>See all blogs</a>
      </div>
      <div class="menu-blogs__viewport"><ul class="menu-blogs__track">${D.blogs.map((x) => menuBlogCard(x)).join("")}${D.blogs.map((x) => menuBlogCard(x, true)).join("")}</ul></div>
    </section>
    <div class="menu-overlay__foot">
      <small>© TCI ${new Date().getFullYear()}</small>
      <p>From concept to completion</p>
    </div>
  </div>
</div>`;
}

function footer() {
  const cols = [
    ["Menu", [["Team", "team.html"], ["Leadership", "team.html#leadership"], ["Voices", "culture.html#voices"]]],
    ["Projects", [["Architecture", "projects.html?type=architecture"], ["Interiors", "projects.html?type=interior"], ["Landscape", "projects.html?cat=landscape"]]],
    ["Blogs", [["Articles", "blogs.html"], ["Gallery", "projects.html"]]],
    ["Culture", [["Leadership", "team.html#leadership"], ["Unity", "culture.html#life"], ["Culture", "culture.html"]]],
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
    <label class="field"><span class="sr-only">Message</span><textarea name="message" placeholder="Tell us about your project" rows="4" required></textarea></label>
    <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn" type="submit">Send my enquiry</button>
    <p class="form__status" role="status" aria-live="polite"></p>
  </form>`;
}

// Default copy differs per theme (light comps: "Let's Bring Your Vision to Life"; dark comps: "Design Begins…").
// Pass `title`/`text` to use one fixed wording (e.g. the Team page).
function cta({ title, text, tracked = false } = {}) {
  const fixed = title !== undefined;
  const h = fixed
    ? esc(title)
    : `<span class="t-light">Tell us about your project</span><span class="t-dark">Start with a conversation</span>`;
  const p = fixed
    ? esc(text)
    : `<span class="t-light">Send a few lines about your site, brief or idea. Our team will reply with clear next steps.</span><span class="t-dark">Share your idea. We’ll help you shape it into something you can build.</span>`;
  return `
<section class="cta${tracked ? " cta--tracked" : ""}" id="connect" aria-labelledby="cta-title">
  <div class="container cta__grid">
    <div class="cta__copy">
      <h2 id="cta-title">${h}</h2>
      <p>${p}</p>
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
<script>document.documentElement.classList.add("js");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("m");var t="dark";try{var s=localStorage.getItem("tci-theme");if(s==="dark"||s==="light")t=s}catch(e){}document.documentElement.setAttribute("data-theme",t)</script>
<link rel="preload" href="assets/fonts/inter-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin-300-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/inter-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/styles.css?v=${V}">
${head}
</head>
<body${[solid ? "has-solid-header" : "", bodyClass].filter(Boolean).length ? ` class="${[solid ? "has-solid-header" : "", bodyClass].filter(Boolean).join(" ")}"` : ""}>
<div class="curtain" data-curtain aria-hidden="true">
  <div class="curtain__grid"></div>
  <div class="curtain__stage">
    <div class="curtain__mark">
      <img class="curtain__ghost" src="assets/img/wordmark-light.png" alt="" width="${META["wordmark-light"].w}" height="${META["wordmark-light"].h}">
      <img class="curtain__logo" src="assets/img/wordmark-light.png" alt="" width="${META["wordmark-light"].w}" height="${META["wordmark-light"].h}">
      <span class="curtain__level"></span>
    </div>
    <div class="curtain__dim"><span class="curtain__tick"></span><span class="curtain__line"></span><span class="curtain__tick"></span><span class="curtain__count" data-curtain-count>000</span></div>
  </div>
</div>
${header({ solid, current })}
<main id="main">
${displayHeadings(body)}
</main>
${footer()}
<script src="assets/js/vendor/gsap.min.js" defer></script>
<script src="assets/js/vendor/ScrollTrigger.min.js" defer></script>
<script src="assets/js/vendor/SplitText.min.js" defer></script>
<script src="assets/js/vendor/lenis.min.js" defer></script>
<script src="assets/js/main.js?v=${V}" defer></script>
<script src="assets/js/motion.js?v=${V}" defer></script>
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
// Retail Park showcase: a scroll-driven film of the project's walkthrough, then the interactive 3D model.
// Retail Park photos (from the "Retail Park" folder, saved as rp-01…08 in assets/img). pos = focal point for tall phone screens.
const SHOWCASE_CHAPTERS = [
  { img: "rp-01", pos: "50% 50%", title: "Arrival", text: "The Retail Park sign and a shaded forecourt welcome visitors in from the road.", alt: "Entrance forecourt with the Retail Park sign and a terracotta building" },
  { img: "rp-02", pos: "40% 50%", title: "From above", text: "One long retail spine, the market court and the pavilion, set against the dunes.", alt: "Aerial view of the retail park with its market court and pavilion beside the desert" },
  { img: "rp-03", pos: "35% 50%", title: "The retail spine", text: "Shopfronts face a planted car park, with a cycle track along the front.", alt: "Row of shopfronts behind a landscaped car park and a red cycle track" },
  { img: "rp-04", pos: "50% 50%", title: "The market court", text: "White shade sails cover a brick-paved court of market stalls.", alt: "Market stalls under white shade sails on a brick-paved court" },
  { img: "rp-05", pos: "45% 50%", title: "The brick pavilion", text: "A perforated brick screen wraps the pavilion and keeps it cool by day.", alt: "Pavilion wrapped in a perforated brick screen above a glazed ground floor" },
  { img: "rp-06", pos: "50% 50%", title: "The grove", text: "Rows of trees shade a plaza of terraces and seating.", alt: "Tree-shaded plaza with stepped terraces" },
  { img: "rp-07", pos: "60% 50%", title: "Food pods", text: "Food pods line the promenade, with seating in the open air.", alt: "Food pods and outdoor seating along a paved promenade" },
  { img: "rp-08", pos: "55% 50%", title: "The café", text: "A terracotta café opens straight onto the gardens.", alt: "Terracotta café kiosk with a coffee counter beside planting" },
];
function projectShowcase() {
  const n = SHOWCASE_CHAPTERS.length;
  const chapters = SHOWCASE_CHAPTERS.map((c, i) => `
      <figure class="film__chapter" data-chapter="${i}">
        <div class="film__media">${img(c.img, { alt: c.alt, attrs: `style="object-position: ${c.pos}"` })}</div>
        <figcaption class="film__caption"><span class="film__num">${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}</span><strong>${esc(c.title)}</strong><span>${esc(c.text)}</span></figcaption>
      </figure>`).join("");
  return `<section class="feature" id="showcase" aria-labelledby="showcase-title">
  <div class="film" data-film>
    <div class="film__stack">${chapters}
    </div>
    <header class="film__head">
      <h2 id="showcase-title" class="film__kicker">Project showcase</h2>
      <h3 class="film__title">Retail Park</h3>
      <span class="film__tag">Retail &amp; community destination · Sharjah</span>
    </header>
    <div class="film__foot">
      <div class="film__bar" aria-hidden="true"><span data-film-progress></span></div>
    </div>
  </div>

  <div class="showcase3d" data-model3d data-src="assets/js/model3d.js?v=${V}" data-assets="assets/model/">
    <div class="model__stage" data-model-stage>
      <div class="model__labels" data-model-labels></div>
      <p class="model__status model__status--loading" data-model-status>Loading model…</p>
      <p class="model__status model__status--error">Your browser can’t display the 3D model.</p>
      <div class="model__scrim" aria-hidden="true"></div>
      <header class="model__head">
        <span class="model__kicker">Interactive 3D</span>
        <h3 class="hd">Explore the park</h3>
        <span class="model__tag">Scroll to rise over the site · drag to look around · Ctrl + scroll to zoom</span>
      </header>
      <div class="model__foot">
        <p class="model__desc">A 300 m retail spine with parking on its roof, fronted by a shade-sail market, the Games hall, a tree-shaded plaza and a pavilion wrapped in a perforated brick screen, with food pods along the promenade and a jogging trail through the dunes behind.</p>
        <div class="model__controls" role="group" aria-label="Model view">
          <button class="model__btn" type="button" data-model-labels-toggle aria-pressed="true">Labels</button>
          <button class="model__btn model__btn--icon" type="button" data-model-zoom-in aria-label="Zoom in">+</button>
          <button class="model__btn model__btn--icon" type="button" data-model-zoom-out aria-label="Zoom out">−</button>
          <button class="model__btn" type="button" data-model-reset>Reset view</button>
        </div>
      </div>
      <p class="model__hint" data-model-hint>Hold Ctrl (⌘ on Mac) and scroll to zoom · drag to rotate</p>
    </div>
  </div>
</section>`;
}

// Clients: three columns of logo tiles that drift upwards on a loop (each list is doubled so the loop is seamless).
function clientsSection() {
  const C = D.clients;
  const cols = [[], [], []];
  C.logos.forEach((l, i) => cols[i % 3].push(l));
  // columns 1 and 3 move in step, so they need the same number of tiles: pad the short ones by repeating a logo from another column
  const most = Math.max(...cols.map((c) => c.length));
  cols.forEach((c, k) => { for (let j = 0; c.length < most; j++) c.push(cols[(k + 1) % 3][j]); });
  const tile = (l, hidden) => `<li class="clients__tile"><img src="assets/img/clients/${l.file}.webp" alt="${hidden ? "" : esc(l.name)}" width="${l.w}" height="${l.h}" loading="lazy" decoding="async"></li>`;
  const col = (list, k) => `
      <div class="clients__col" style="--dur:44s">
        <ul class="clients__track">${list.map((l) => tile(l)).join("")}${list.map((l) => tile(l, true).replace("<li ", '<li aria-hidden="true" ')).join("")}</ul>
      </div>`;
  return `<section class="clients" id="clients" aria-labelledby="clients-title">
  <div class="container clients__grid">
    <div class="clients__copy">
      <h2 id="clients-title">${esc(C.title)}</h2>
      <p class="reveal">${esc(C.text)}</p>
    </div>
    <div class="clients__wall" role="group" aria-label="Our clients">${cols.map(col).join("")}
    </div>
  </div>
</section>`;
}

// HOME
{
  const hero = META["hero"];
  const featured = D.projects.filter((p) => p.featured);

  const slides = featured
    .map(
      (p, i) => `<li class="slide${i === 0 ? " is-active" : ""}" id="slide-${i}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${featured.length}" data-label="${esc(p.label)}" data-title="${esc(p.title)}" data-href="project-${p.slug}.html">
        <a href="project-${p.slug}.html" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(p.title)} — ${esc(p.label)}">${img(p.img, { alt: p.alt, sizes: "(min-width: 900px) 62vw, 82vw", eager: false })}</a>
      </li>`
    )
    .join("");
  const dots = featured.map((p, i) => `<button type="button" class="dot${i === 0 ? " is-active" : ""}" data-slide="${i}" aria-label="Show ${esc(p.title)}"${i === 0 ? ' aria-current="true"' : ""}></button>`).join("");

  // same cards as the Expertise page; the description and hover image come from its data, matched by slug
  const exBySlug = Object.fromEntries([...D.expertisePage.rows, ...D.expertisePage.carousel].map((c) => [c.slug, c]));
  const expertiseCards = D.expertise
    .map((e) => {
      const x = exBySlug[e.slug];
      // when the home photo is the Expertise page's hover photo, hover shows that page's main photo instead
      const hover = x.hover && x.hover !== e.img ? x.hover : x.img !== e.img ? x.img : null;
      return xpCard({ ...x, title: e.darkTitle || e.title, img: e.img, alt: e.alt, pos: e.pos, hover }, { id: false });
    })
    .join("\n  ");

  page({
    file: "index.html",
    title: cfg.siteName,
    description: cfg.description,
    current: "home",
    head: `<link rel="preload" as="image" href="assets/img/hero-blueprint-md.webp" imagesrcset="assets/img/hero-blueprint-md.webp ${META["hero-blueprint-md"].w}w, assets/img/hero-blueprint.webp ${META["hero-blueprint"].w}w" imagesizes="100vw" fetchpriority="high">
<link rel="preload" as="image" href="assets/img/hero-md.webp" imagesrcset="assets/img/hero-md.webp 800w, assets/img/hero.webp ${hero.w}w" imagesizes="100vw" fetchpriority="high">`,
    body: `
<section class="hero hero--home hero--compare" data-compare aria-label="From concept to completion">
  <div class="hero__stage">
    <div class="hero__plan">${img("hero-blueprint", { alt: "", cls: "hero__bg hero__bp", eager: true })}</div>
    <div class="hero__done">${img("hero", { alt: "Azizi tower rising against a deep blue sky", cls: "hero__bg", eager: true })}</div>
  </div>
  <div class="hero__shade"></div>
  <div class="hero__split" aria-hidden="true"><span class="hero__tag hero__tag--l">Concept</span><span class="hero__tag hero__tag--r">Completion</span></div>
  <div class="hero__knob" role="slider" tabindex="0" aria-label="Drawing to finished building" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M15 7l5 5-5 5"/></svg></div>
  <h1 class="hero__title">From concept to completion</h1>
  <p class="hero__sheet" aria-hidden="true"><span>Top Concept International</span><span>Sheet A-001 · Elevation</span></p>
  <a class="hero__scroll" href="#about" aria-label="Scroll to content"><span></span></a>
</section>

<section class="about" id="about" aria-label="About us">
  <p class="about__lead">${esc(D.about.lead)}</p>
  <div class="about__more">${D.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  <a class="about__btn" href="${D.about.href}"><span class="about__label">${esc(D.about.cta)}</span><span class="about__arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>
</section>


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

${projectShowcase()}

${clientsSection()}

<section class="panel" id="culture-careers" aria-label="Culture and careers">
  <div class="container panel__grid">
    <article class="panel__item reveal">
      <h2><a href="culture.html">Culture</a></h2>
      <a class="panel__media" href="culture.html" tabindex="-1" aria-hidden="true">${img("culture-meeting", { alt: "", sizes: "(min-width: 900px) 45vw, 92vw" })}</a>
      <p>One team that stands together, works honestly and gives its best to every project.</p>
    </article>
    <article class="panel__item reveal" style="--d:100ms">
      <h2><a href="careers.html">Careers</a></h2>
      <a class="panel__media" href="careers.html" tabindex="-1" aria-hidden="true">${img("careers-office", { alt: "", sizes: "(min-width: 900px) 45vw, 92vw" })}</a>
      <p>Grow with a team that backs your ambition and trusts you with real projects.</p>
    </article>
  </div>
</section>

<section class="section section--expertise" id="expertise" aria-labelledby="ex-title">
  <div class="section__head xp-head">
    <div>
      <h2 id="ex-title" class="section__title">Field of expertise</h2>
      <p class="section__lead">Ten fields, one team. Pick a field to see the work.</p>
    </div>
    <a class="link-caps" href="expertise.html">Explore our expertise</a>
  </div>
  <div class="xp-grid xp-grid--home">
  ${expertiseCards}
  </div>
</section>

${cta()}`,
  });
}

// Full-height hero with a centred title (no tabs) — used by Projects and Expertise.
function simpleHero({ img: name, alt, title }) {
  return `
<section class="hero hero--home">
  ${img(name, { alt, cls: "hero__bg", eager: true })}
  <div class="hero__shade"></div>
  <h1 class="hero__title">${title}</h1>
  <a class="hero__scroll" href="#intro" aria-label="Scroll to content"><span></span></a>
</section>`;
}

// PROJECTS INDEX
{
  const P = D.projectsPage;
  const show = D.projects.find((p) => p.slug === P.showcase.slug);
  const chips = [{ slug: "all", label: "All" }, ...D.projectTypes]
    .map((t, i) => `<button type="button" class="chip${i === 0 ? " is-active" : ""}" data-filter="${t.slug}" aria-pressed="${i === 0}">${t.label}</button>`)
    .join("");
  page({
    file: "projects.html",
    title: "Projects",
    description: "Selected architecture, interior, masterplan and hospitality projects by Top Concept International.",
    body: `
${simpleHero({ img: "hero-projects", alt: P.heroAlt, title: P.heroTitle })}
<section class="intro container" id="intro">
  <h2>${esc(P.heading)}</h2>
  <p>${esc(P.intro)}</p>
</section>
<section class="showcase container" aria-labelledby="showcase-title">
  <a class="showcase__media reveal" href="project-${show.slug}.html" aria-label="${esc(show.title)}">${img(show.img, { alt: show.alt, sizes: "(min-width: 900px) 40vw, 92vw" })}</a>
  <div class="showcase__text reveal">
    <h2 id="showcase-title">Project showcase</h2>
    <p class="showcase__label">${esc(P.showcase.label)}</p>
    <p>${esc(P.showcase.text)}</p>
    <a class="link-caps" href="project-${show.slug}.html">View project</a>
  </div>
</section>
<section class="container projects-all" id="all-projects" aria-label="All projects">
  <div class="chips" role="group" aria-label="Filter projects" data-chips>${chips}</div>
  <p class="filter-note" data-filter-note hidden></p>
  <div class="proj-grid" data-projects>
    ${D.projects.map(projectCard).join("")}
  </div>
  <p class="empty" data-empty hidden>No projects match this filter yet.</p>
</section>
${cta()}`,
  });
}

// Expertise card, used on the Expertise page and in the home "Fields of expertise" section. Two big cards per row
// (after madamepolare.com's Featured Projects): image, then the name on the left and a one-line description on the
// right that runs right to left as a marquee on hover. A second image (hover) wipes in over the first.
function xpCard(c, { id = true } = {}) {
  const line = c.text.split(/(?<=\.)\s/)[0];
  const media = img(c.img, { alt: c.alt, sizes: "(min-width: 700px) 49vw, 96vw", attrs: `style="object-position:${c.pos || "50% 50%"}"` });
  const alt = c.hover ? img(c.hover, { alt: "", sizes: "(min-width: 700px) 49vw, 96vw", attrs: 'class="xp__alt" aria-hidden="true"' }) : "";
  return `<article class="xp reveal${c.hover ? "" : " xp--zoom"}"${id ? ` id="${c.slug}"` : ""}>
    <a class="xp__link" href="projects.html?cat=${c.slug}">
      <div class="xp__media">${media}${alt}</div>
      <div class="xp__meta">
        <h3 class="xp__title">${esc(c.title)}</h3>
        <p class="xp__desc" style="--dur:${Math.max(6, Math.round(line.length * 0.11))}s"><span class="xp__run"><span>${esc(line)}</span><span aria-hidden="true">${esc(line)}</span></span></p>
      </div>
    </a>
  </article>`;
}

// EXPERTISE
{
  const E = D.expertisePage;
  const cards = [...E.rows, ...E.carousel].map((c) => xpCard(c)).join("\n  ");
  page({
    file: "expertise.html",
    title: "Expertise",
    description: "Urban design, community buildings, malls, masterplanning, retail, interiors, villas, townhouses, landscape and hospitality — the fields of expertise at Top Concept International.",
    current: "expertise",
    body: `
${simpleHero({ img: "hero-expertise", alt: E.heroAlt, title: E.heroTitle })}
<section class="intro container" id="intro">
  <h2>${esc(E.heading)}</h2>
  <p>${esc(E.intro)}</p>
</section>
<section class="xp-grid" aria-label="Fields of expertise">
  ${cards}
</section>
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
    <div class="section__head"><h2>More projects</h2><a class="link-caps" href="projects.html">See all projects</a></div>
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
    <div class="section__head"><h2>More reading</h2><a class="link-caps" href="blogs.html">See all blogs</a></div>
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
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>team</em>", current: "team" })}
<section class="leaders" id="leadership" aria-labelledby="team-lead-title">
  <div class="container">
    <h2 id="team-lead-title" class="leaders__title">Leadership</h2>
    <div class="leaders__people">
      ${D.teamLeadership.people.map((p, i) => `<figure class="leader reveal" style="--d:${i * 120}ms">
        <div class="leader__media">${img(p.img, { alt: `Portrait of ${p.name}`, sizes: "(min-width: 900px) 360px, 44vw" })}</div>
        <figcaption><strong class="leader__name">${esc(p.name)}</strong><span class="leader__role">${esc(p.role)}</span></figcaption>
      </figure>`).join("")}
    </div>
    <div class="leaders__text reveal">${paras(D.teamLeadership.paragraphs)}</div>
  </div>
</section>
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
${cta({ title: "Start with a conversation", text: "Share your idea. We’ll help you shape it into something you can build.", tracked: true })}`,
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
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>team</em>", current: "culture" })}
<div class="container culture">
  <figure class="wide-shot reveal">${img("culture-hero", { alt: "Colleagues in conversation on a leather sofa", sizes: "(min-width: 1000px) 1350px, 96vw" })}</figure>
  <div class="prose prose--lg reveal">${paras(C.intro)}</div>
  <hr class="rule">
  <section id="life" class="split reveal" aria-labelledby="life-title">
    <h2 id="life-title" class="split__title">Life at <span class="hb">Top Concept</span></h2>
    <div class="split__media">${img("culture-life", { alt: "Two colleagues discussing a drawing", sizes: "(min-width: 900px) 45vw, 92vw" })}</div>
    <div class="prose prose--lg split__text">${paras(C.life)}</div>
  </section>
  <hr class="rule">
  <section class="split reveal" aria-labelledby="thrive-title">
    <h2 id="thrive-title" class="split__title">A place where people thrive</h2>
    <div class="split__media split__media--stack">
      ${img("culture-place", { alt: "Open-plan studio with plants and a foosball table", sizes: "(min-width: 900px) 45vw, 92vw" })}
      ${img("culture-roundtable", { alt: "Team meeting around a round table", sizes: "(min-width: 900px) 45vw, 92vw" })}
    </div>
    <div class="prose prose--lg split__text">${paras(C.thrive)}</div>
  </section>
  <hr class="rule">
  <section id="voices" class="voices" aria-labelledby="voices-title">
    <h2 id="voices-title">Voices from our team</h2>
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
  description: "Join the architects, engineers and designers at Top Concept International. Send us your CV.",
  current: "careers",
  body: `
${pageHero({ img: "team-hero", alt: "Two colleagues reviewing drawings together", title: "Meet the <em>team</em>", current: "careers" })}
<div class="container careers">
  <figure class="wide-shot wide-shot--tall reveal">${img("careers-team", { alt: "Colleagues gathered around a long table of drawings, seen from above", sizes: "(min-width: 1000px) 1350px, 96vw" })}</figure>
  <p class="prose prose--lg reveal">${esc(D.careers.intro)}</p>
</div>
<section class="kickstart" id="kickstart" aria-labelledby="kick-title">
  <div class="container kickstart__grid">
    <div class="kickstart__copy">
      <h2 id="kick-title">Kickstart your journey with us</h2>
      <p>Send your CV and the role you want. If your skills match an opening, our HR team will contact you.</p>
      <form class="form form--careers" method="post" enctype="multipart/form-data" novalidate ${formAttrs("careers", "Career application")}>
        <label class="line-field"><span>Full Name:</span><input name="name" type="text" placeholder="Your full name" autocomplete="name" required></label>
        <label class="line-field"><span>Position:</span><input name="position" type="text" placeholder="The role you want" required></label>
        <label class="line-field line-field--file"><span>CV:</span>
          <input name="cv" type="file" accept=".pdf,.doc,.docx" required>
          <em data-file-name>Upload… (PDF or Word, max 5 MB)</em>
        </label>
        <label class="check"><input type="checkbox" name="emirati" value="yes"><span>I am Emirati</span></label>
        <label class="line-field"><span>Email:</span><input name="email" type="email" placeholder="Your email address" autocomplete="email" required></label>
        <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn--light" type="submit">Send my application</button>
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
  title: "Contact us",
  description: "Contact Top Concept International — offices serving clients across the UAE, India and London.",
  solid: true,
  current: "contact",
  body: `
<section class="contact-intro container">
  <h1>Contact us</h1>
  <div id="offices" class="reveal">${mapFigure()}</div>
  <p class="prose prose--lg">We work with clients across the UAE, India and London. Tell us where your project is and what you need. One team will guide it from the first idea to handover.</p>
  ${cfg.contactEmail || cfg.whatsapp ? `<p class="contact-direct">${cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : ""}${cfg.whatsapp ? `<a href="https://wa.me/${esc(cfg.whatsapp)}" target="_blank" rel="noopener noreferrer">WhatsApp</a>` : ""}</p>` : ""}
</section>
${cta()}`,
});

// PRIVACY
page({
  file: "privacy.html",
  title: "Privacy policy",
  description: "How Top Concept International handles the information you send us.",
  solid: true,
  body: `
<section class="page-head container container--narrow"><h1>Privacy policy</h1></section>
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

// remove stale generated pages (e.g. after renaming or deleting a project / article)
for (const f of fs.readdirSync(ROOT)) {
  if (/^(project|blog)-.+\.html$/.test(f) && !written.includes(f)) { fs.unlinkSync(path.join(ROOT, f)); console.log("Removed stale page:", f); }
}

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
