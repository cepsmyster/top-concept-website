# Top Concept International — Website

A fast, static website (plain HTML / CSS / JS — no framework, no database, no server needed).
Built from the design files in `New Website/`.

## Open it

- **Quickest:** double-click `index.html`.
- **Better (matches how it will behave online):** from this folder run `npx serve .` (or `python -m http.server`) and open the address it prints.

## Pages

| Page | File |
|---|---|
| Home (hero, blogs, projects carousel, culture/careers, leadership, expertise, contact) | `index.html` |
| Projects (filterable) + one page per project | `projects.html`, `project-*.html` |
| Blogs + one page per article | `blogs.html`, `blog-*.html` |
| Team · Culture · Careers | `team.html`, `culture.html`, `careers.html` |
| Contact · Privacy · 404 | `contact.html`, `privacy.html`, `404.html` |

The header has a **light / dark theme switch** (the sun/moon icon). Light is the default; the dark theme follows the "Home Page black" design. The visitor's choice is remembered.

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
- `culture`, `careers`, `leadership`, `expertise` — page copy.

After any change to `src/` run, from this folder:

```
node src/build.mjs
```

(needs [Node.js](https://nodejs.org) 18+; no `npm install` required). This regenerates every `.html` file.
Do **not** hand-edit the generated `.html` files — edits there are overwritten on the next build.

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
assets/fonts/                       self-hosted Montserrat + Inter
src/config.mjs                      site settings (forms, socials, map pins)
src/data.mjs                        content
src/build.mjs                       page generator
```

## Notes

- Fonts are self-hosted, so the site makes no third-party requests except the optional form endpoint and social links.
- The privacy policy is a plain-language starting point — have it reviewed before launch.
- The careers form uses a hidden spam-trap field instead of reCAPTCHA. If you want reCAPTCHA/hCaptcha, most form services (Formspree, Web3Forms) can add it from their dashboard.
