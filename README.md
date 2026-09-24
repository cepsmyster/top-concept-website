# Top Concept International — Website

A fast, static website (plain HTML / CSS / JS — no framework, no database, no server needed).
Built from the design files in `New Website/`.

## Open it

- **Quickest:** double-click `index.html`.
- **Better (matches how it will behave online):** from this folder run `npx serve .` (or `python -m http.server`) and open the address it prints.

## Pages

| Page | File |
|---|---|
| Home (video hero, projects carousel, Retail Park showcase, culture/careers, leadership, expertise, contact) | `index.html` |
| Expertise (alternating rows + carousel) | `expertise.html` |
| Projects ("View the Work" hero, showcase, filterable grid) + one page per project | `projects.html`, `project-*.html` |
| Blogs + one page per article | `blogs.html`, `blog-*.html` |
| Team · Culture · Careers | `team.html`, `culture.html`, `careers.html` |
| Contact · Privacy · 404 | `contact.html`, `privacy.html`, `404.html` |

The header is modelled on thirdway.com. A floating card in the centre holds the logo and the menu button, a **Let’s talk** button on the right goes to the Contact page, and the sun/moon button on the left switches between the **dark** and **light** theme. On phones all of this sits in one full-width card. The menu grows out of the card: the site links set large, then a scrolling strip of the latest blogs (the home page no longer has its own Blogs section), plus a second theme switch. The menu links live in `MENU` and the markup in `header()`, both in `src/build.mjs`. **Dark is the default** (the "black" designs); the visitor's choice is remembered. To make light the default, change `var t="dark"` to `var t="light"` in the `<script>` inside `page()` in `src/build.mjs` and rebuild.

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

## Motion

Every page has scroll-driven animation in the spirit of award-style sites: smooth (inertial) scrolling, a curtain that lifts on arrival and drops between pages, headings that rise line by line, images that unmask and settle from a zoom, bands that open out as they scroll in, parallax, a header that tucks away while scrolling down, and a custom cursor with magnetic buttons (mouse only).

- It lives in `assets/js/motion.js` and uses GSAP, ScrollTrigger, SplitText and Lenis, self-hosted in `assets/js/vendor/` (about 140 KB together).
- Visitors with "reduce motion" switched on get the static site. If the scripts fail to load, the curtain hides itself after 4 seconds.

## Retail Park showcase (home page)

After Projects, the home page shows Retail Park (Sharjah) in two parts, built from the project walkthrough and renders in `Retail Park/`:

1. **The film.** A full-screen section that stays in place while six clips from the walkthrough wipe over each other as you scroll: arrival at dusk, the solar roof from above, the atrium, the brick arcade, the kiosks and the grove. Wide screens get the landscape cuts (`assets/video/retail/d1–d6.mp4`) and phones get the portrait cuts (`m1–m6.mp4`). Only the clip on screen plays, and each clip loads just before it's needed. "Watch the film" opens the full 45-second walkthrough (`film.mp4`, with sound) in a popup.
2. **Interactive 3D.** A golden-hour model of the final design, laid out from the aerial renders: the long retail spine with parking on its roof, the two-storey west block, the shade-sail market court, the terracotta Games hall, the tree plaza with its timber terraces, the pavilion wrapped in a perforated brick screen, the food pods along the promenade, the front parking, the road and cycle track, and the jogging trail running through the dunes behind. Scrolling cranes the camera from street level across the road up to the aerial view. Visitors can drag to rotate, zoom with Ctrl/⌘ + scroll (or pinch on phones), and switch labels on or off.

- The 3D model is built by hand from the renders, so it shows the massing and materials rather than exact dimensions. For an exact match, export the scene from the 3D software as FBX or glTF and it can replace the hand-built model.
- The film clips come from the dusk walkthrough (`Retail Park video.mp4`). The second video (`Retail park.mp4`) isn't used because it has Arabic subtitles burned in and includes stock footage.
- To keep it smooth, the model merges its geometry into a few dozen draw calls, draws shadows once, only renders while something moves, and lowers its resolution on slower devices.
- The viewer (`assets/js/model3d.js`, about 0.9 MB) and its textures and sky (`assets/model/`, about 5 MB) only download when a visitor scrolls near the section. The scroll clips add about 13 MB in total, loaded one at a time. The popup film is about 8 MB and loads only when someone presses play.
- Textures and the sky are CC0 assets from [Poly Haven](https://polyhaven.com).
- The captions and text are in `projectShowcase()` in `src/build.mjs`. The model is in `src/model3d.mjs`. After editing the model, rebuild it from the `src/` folder: `npm install` (only the first time), then `npm run model`. This is the only part of the site that needs `npm`.

## Clients (home page)

After the Retail Park showcase, "In trusted company" shows the client logos in three columns of light tiles that drift upwards on a loop (paused on hover, still for visitors with reduced motion). The logos were cut from `Clients/Logos list.png` into `assets/img/clients/` as transparent WebP files. The copy and the logo list (file, name, size) are in `clients` in `src/data.mjs`; to add a logo, drop a transparent WebP in that folder and add a line to the list.

## Typography

All headings are Inter Medium with −50 tracking (`--track-head: -.05em`), in sentence case. Small titles (cards, names, menu) use `--track-small: -.03em` so they don’t close up. Body text is Inter Regular with −50 tracking too (`--track-body: -.05em`, set once on `body`). Buttons and small labels stay in Montserrat. Write heading copy in sentence case; the CSS never forces capitals on headings.

## Leadership, logo and loader

- **Leadership (Team page):** the two founders side by side, names under them, the letter below. The portraits (`assets/img/leader-*.webp`) are transparent: each person sits in a soft oval of light cut from the photos in `Leadership/`, and a slow-drifting smoke layer (`assets/img/smoke.webp`, used as a mask) is painted in the page colour, so it melts into the dark and the light theme alike. Names, roles and the letter are in `teamLeadership` in `src/data.mjs`.
- **Logo:** the header, menu and loader use the TCI wordmark only (`assets/img/wordmark-*.png`). The footer keeps the full logo with "Architects · Engineers · Designers".
- **Loader:** on a blueprint grid, the wordmark is built up floor by floor behind a gold laser level while a dimension line measures it out in millimetres. It lives in `lift()` in `assets/js/motion.js` and the `.curtain` styles.

## Copy

Site copy follows the web-copywriter skill in `.claude/skills/web-copywriter/`: short sentences, what the client gets, no filler words. Attributed quotes (the CEO quote and the staff voices) are kept exactly as given.

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
assets/js/motion.js                 scroll animation, page transitions, cursor
assets/js/model3d.js                3D showcase (built from src/model3d.mjs)
assets/js/vendor/                   GSAP, ScrollTrigger, SplitText, Lenis
assets/model/                       3D textures, sky lighting
assets/video/retail/                Retail Park film clips + posters
assets/img/                         optimized images (WebP), logos, icons
assets/video/hero.mp4               home page hero video
assets/fonts/                       self-hosted Montserrat + Inter
src/config.mjs                      site settings (forms, socials, map pins)
src/data.mjs                        content
src/build.mjs                       page generator
```

## Notes

- Fonts and scripts are self-hosted, so the site makes no third-party requests except the optional form endpoint and social links.
- The privacy policy is a plain-language starting point — have it reviewed before launch.
- The careers form uses a hidden spam-trap field instead of reCAPTCHA. If you want reCAPTCHA/hCaptcha, most form services (Formspree, Web3Forms) can add it from their dashboard.
