# Top Concept International — Website

A fast, static website (plain HTML / CSS / JS — no framework, no database, no server needed).
Built from the design files in `New Website/`.

## Open it

- **Quickest:** double-click `index.html`.
- **Better (matches how it will behave online):** from this folder run `npx serve .` (or `python -m http.server`) and open the address it prints.

## Pages

| Page | File |
|---|---|
| Home (video hero, blogs, projects carousel, culture/careers, leadership, expertise, contact) | `index.html` |
| Expertise (alternating rows + carousel) | `expertise.html` |
| Projects ("View the Work" hero, showcase, filterable grid) + one page per project | `projects.html`, `project-*.html` |
| Blogs + one page per article | `blogs.html`, `blog-*.html` |
| Team · Culture · Careers | `team.html`, `culture.html`, `careers.html` |
| Contact · Privacy · 404 | `contact.html`, `privacy.html`, `404.html` |

The header follows the updated designs: **MENU** (left) opens the slide-in menu, the logo is centred, and the sun/moon icon (right) switches between the **dark** and **light** theme. **Dark is the default** (the "black" designs); the visitor's choice is remembered. To make light the default, change `var t="dark"` to `var t="light"` in the `<script>` inside `page()` in `src/build.mjs` and rebuild.

**Hero video (home page):** `assets/video/hero.mp4` plays on screens ≥ 900px wide. Phones, "reduce motion" and data-saver visitors get the still image (`hero.webp`) with the "From concept to completion" headline instead, so they don't download the 18 MB video. To change the video, replace the file (keep the name); it should have the headline baked in, as the current one does.

## Things to set up before launch (5 minutes)

Open **`src/config.mjs`** and fill in:

1. **`formEndpoint`** *(recommended)* — the contact form and the careers form (with CV upload) post here. Create a free form endpoint at Formspree, Web3Forms or Getform, paste the URL.
   *If left empty, the forms fall back to `contactEmail` (opens the visitor's email app). If both are empty, the forms show a polite "can't send right now" message.*
2. **`contactEmail`** — the company inbox.
3. **`social`** — the real WhatsApp / YouTube / Instagram / Facebook / LinkedIn / Pinterest links (currently point to each network's home page).
4. **`siteUrl`** — the final web address (e.g. `https://www.yourdomain.com`). Enables share previews, canonical links and `sitemap.xml`.
5. **`offices`** — map pin positions/labels if the offices change.

Then rebuild (below).

## Editing content

All text/data lives in **`src/data.mjs`**:

- `projects` — add/edit projects (title, category, image, optional `gallery`). **Titles marked as descriptive placeholders (e.g. "Community Tower") should be replaced with the real project names.**
- `team` — names, roles, photos (`img: null` shows the placeholder avatar).
- `blogs` — articles. **The six sample articles are placeholder copy — replace them with real posts.**
- `expertisePage`, `projectsPage`, `teamLeadership`, `culture`, `careers`, `leadership`, `expertise` — page copy. **On the Expertise carousel, only the "Retails" line comes from the design; the other five short descriptions are placeholders to replace with approved copy.**

After any change to `src/` run, from this folder:

```
node src/build.mjs
```

(needs [Node.js](https://nodejs.org) 18+; no `npm install` required). This regenerates every `.html` file.
Do **not** hand-edit the generated `.html` files — edits there are overwritten on the next build.

## 3D project showcase (home page)

The "Project Showcase" section after Projects is an interactive clay model of the Nawaf Villa ground floor, traced from `NWGF-Model.pdf`. Visitors can rotate it by dragging, zoom with the scroll wheel after clicking into it (or pinch on phones), and switch the roof and room labels on or off.

- The viewer (`assets/js/model3d.js`, three.js bundled in) is about 530 KB. It only downloads when a visitor scrolls near the section.
- The section's text is in the home page block of `src/build.mjs`. The model itself (walls, landscape, colours, labels) is in `src/model3d.mjs`.
- After editing `src/model3d.mjs`, rebuild the bundle from the `src/` folder: `npm install` (only the first time), then `npm run model`. This is the only part of the site that needs `npm`.

## Images

Put optimized `.webp` files in `assets/img/` and refer to them by file name without the extension.
For responsive loading, also add a smaller copy named `name-md.webp` (~800px wide); the build uses it automatically.
Recommended: ≤ 1920px wide, quality ~80.

## Deploying

Upload the whole folder (everything except `src/` and this README is what visitors need) to any static host:
Netlify, Vercel, Cloudflare Pages, GitHub Pages, or a normal web host (cPanel/FTP). `404.html` is picked up automatically by most hosts.

## Structure

```
index.html, projects.html, …        generated pages
assets/css/styles.css               all styles (light + dark themes)
assets/js/main.js                   theme, menu, carousel, filters, lightbox, forms
assets/img/                         optimized images (WebP), logos, icons
assets/video/hero.mp4               home page hero video
assets/fonts/                       self-hosted Montserrat + Inter
src/config.mjs                      site settings (forms, socials, map pins)
src/data.mjs                        content
src/build.mjs                       page generator
```

## Notes

- Fonts are self-hosted, so the site makes no third-party requests except the optional form endpoint and social links.
- The privacy policy is a plain-language starting point — have it reviewed before launch.
- The careers form uses a hidden spam-trap field instead of reCAPTCHA. If you want reCAPTCHA/hCaptcha, most form services (Formspree, Web3Forms) can add it from their dashboard.
