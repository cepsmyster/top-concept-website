# Top Concept International — Website

A fast, static website (plain HTML / CSS / JS — no framework, no database, no server needed).
Built from the design files in `New Website/`.

## Open it

- **Quickest:** double-click `index.html`.
- **Better (matches how it will behave online):** from this folder run `npx serve .` (or `python -m http.server`) and open the address it prints.

## Pages

| Page | File |
|---|---|
| Home (full-screen interactive concept → completion hero, about us, projects carousel, Retail Park showcase, culture/careers, leadership, expertise, contact) | `index.html` |
| Expertise (ten fields as big cards, two per row) | `expertise.html` |
| Projects ("View the Work" hero, showcase, filterable grid) + one page per project | `projects.html`, `project-*.html` |
| Blogs + one page per article | `blogs.html`, `blog-*.html` |
| Team · Culture · Careers | `team.html`, `culture.html`, `careers.html` |
| Contact · Privacy · 404 | `contact.html`, `privacy.html`, `404.html` |

The header is modelled on thirdway.com. A floating card in the centre holds the logo and the menu button, a **Let’s talk** button on the right goes to the Contact page, and the sun/moon button on the left switches between the **dark** and **light** theme. On phones all of this sits in one full-width card. The menu grows out of the card: the site links set large, then a scrolling strip of the latest blogs (the home page no longer has its own Blogs section), plus a second theme switch. The menu links live in `MENU` and the markup in `header()`, both in `src/build.mjs`. **Dark is the default** (the "black" designs); the visitor's choice is remembered. To make light the default, change `var t="dark"` to `var t="light"` in the `<script>` inside `page()` in `src/build.mjs` and rebuild.

**Home hero: from concept to completion.** The hero shows the tower as a blueprint drawing on a drafting grid on the left of a vertical line and the finished render on the right. As the page arrives, the drawing builds up from the ground and the render sweeps in until the line sits in the middle. After that the line follows the mouse; on phones visitors drag or tap across the hero; the round handle takes the arrow keys. The headline animates with it: "From Concept To" rises letter by letter, then "Completion" is drafted in outline along a dimension line and fills in solid as the building sweeps in (`draftTitle()` in `assets/js/motion.js`). "Reduce motion" visitors get the line at the middle with no sweep, and without JavaScript the render shows on its own.
- The render is `assets/img/hero.webp`. The drawing (`hero-blueprint.webp` and `hero-blueprint-md.webp`) is linework traced from that render by `src/blueprint.html`. If you change the render, make a new drawing: from this folder run
  `chrome --headless=new --allow-file-access-from-files --dump-dom "file:///<full path>/src/blueprint.html?src=../assets/img/hero.webp&w=1600" > out.txt`
  and save the `data:image/webp;base64,…` text in `out.txt` as `assets/img/hero-blueprint.webp` (and again with `w=900` for `-md`). `lo`/`hi` in the address control how many lines come through (defaults 48 / 160; lower = more lines).
- Markup is in the `index.html` page in `src/build.mjs`, behaviour in `assets/js/main.js` ("Home hero"), styles under "Home hero: concept → completion" in `styles.css`. The previous hero video was removed (it is still in the git history).

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
- `expertisePage` — the Expertise page cards (`rows` then `carousel`, all shown as one grid, two big cards per row after madamepolare.com’s Featured Projects). Each card shows the image, the name on the left and the first sentence of `text` on the right; on hover the `hover` image wipes up over the main one (cards without one zoom slowly) and the sentence runs as a marquee.
- `projectsPage`, `teamLeadership`, `culture`, `careers`, `leadership`, `expertise` — page copy. **On the Expertise cards, only the "Retails" line among the last six comes from the design; the other five short descriptions are placeholders to replace with approved copy.**

After any change to `src/` run, from this folder:

```
node src/build.mjs
```

(needs [Node.js](https://nodejs.org) 18+; no `npm install` required). This regenerates every `.html` file.
Do **not** hand-edit the generated `.html` files — edits there are overwritten on the next build.

## Motion

Every page has scroll-driven animation in the spirit of award-style sites: smooth (inertial) scrolling, a curtain that lifts on arrival and drops between pages, headings that rise line by line, images that unmask and settle from a zoom, bands that open out as they scroll in, parallax, a header that tucks away while scrolling down, a CAD-style drafting cursor (pick box with crosshair arms, faint hairlines across the screen and a live X / Y readout; it snaps to a bracketed marker over links, names the action over cards, and gives way to the normal text cursor in form fields), and magnetic buttons. Mouse only; touch screens keep their normal behaviour.

- It lives in `assets/js/motion.js` and uses GSAP, ScrollTrigger, SplitText and Lenis, self-hosted in `assets/js/vendor/` (about 140 KB together).
- Visitors with "reduce motion" switched on get the static site. If the scripts fail to load, the curtain hides itself after 4 seconds.

## Retail Park showcase (home page)

After Projects, the home page shows Retail Park (Sharjah) in two parts, built from the project walkthrough and renders in `Retail Park/`:

1. **The photo story.** A full-screen section that stays in place while eight renders from the `Retail Park` folder wipe over each other as you scroll: arrival, from above, the retail spine, the market court, the brick pavilion, the grove, the food pods and the café (`assets/img/rp-01…08.webp`, from `22f, 1f, 20f, 6f, 18f, 8f, 12f, 5f`). When scrolling stops half-way through a wipe, the section glides on to the next photo in the direction of travel (or back, if it had barely moved), so it always rests on one whole photo. The captions, photo order and phone focal points (`pos`) are in `SHOWCASE_CHAPTERS` in `src/build.mjs`. To swap a photo, save it as a ~1920px WebP (plus a ~960px `-md` copy) under the same name.
2. **Interactive 3D.** A golden-hour model of the final design, laid out from the aerial renders: the long retail spine with parking on its roof, the two-storey west block, the shade-sail market court, the terracotta Games hall, the tree plaza with its timber terraces, the pavilion wrapped in a perforated brick screen, the food pods along the promenade, the front parking, the road and cycle track, the extra parking past the east end, the flat road along the back of the spine (there is no ramp), and the jogging trail running through the dunes behind. Scrolling cranes the camera from street level across the road up to the aerial view. Visitors can drag to rotate, zoom with Ctrl/⌘ + scroll (or pinch on phones), and switch labels on or off.

- The 3D model is built by hand from the renders, so it shows the massing and materials rather than exact dimensions. For an exact match, export the scene from the 3D software as FBX or glTF and it can replace the hand-built model.
- The two walkthrough videos in `Retail Park/` are no longer used on the site (the earlier clips are in the git history).
- To keep it smooth, the model merges its geometry into a few dozen draw calls, draws shadows once, only renders while something moves, and lowers its resolution on slower devices.
- The viewer (`assets/js/model3d.js`, about 0.9 MB) and its textures and sky (`assets/model/`, about 5 MB) only download when a visitor scrolls near the section. The eight photos add about 2.4 MB on wide screens and 0.8 MB on phones.
- Textures and the sky are CC0 assets from [Poly Haven](https://polyhaven.com).
- The captions and text are in `projectShowcase()` in `src/build.mjs`. The model is in `src/model3d.mjs`. After editing the model, rebuild it from the `src/` folder: `npm install` (only the first time), then `npm run model`. This is the only part of the site that needs `npm`.

## Clients (home page)

After the Retail Park showcase, "In trusted company" shows the client logos in three columns of light tiles that drift upwards on a loop (paused on hover, still for visitors with reduced motion). The logos were cut from `Clients/Logos list.png` into `assets/img/clients/` as transparent WebP files. The copy and the logo list (file, name, size) are in `clients` in `src/data.mjs`; to add a logo, drop a transparent WebP in that folder and add a line to the list.

## Layout

Pages sit in a centred column (`--container`, 1350px) with side margins (`--gutter`). Two sections run end to end instead, and both use the same big cards, two at a time (`xpCard()` in `src/build.mjs`): the Fields of expertise section on the home page and the Expertise page grid. Each card shows the image, the field name on the left and a one-line description on the right that slides right to left on hover while a second image wipes in. The home cards take their description and hover image from `expertisePage` in `src/data.mjs`, matched by slug. The CEO quote no longer appears on the home page.

**Home page order:** the hero fills exactly one screen, so it is all a visitor sees on arrival. Right after it comes **About us** (layout after madamepolare.com): a lead paragraph on the left, two short paragraphs on the right and a “Meet the team” button to the Team page. The copy is in `about` in `src/data.mjs`, written to the web-copywriter skill; it uses only facts already on the site (offices in the UAE, India and London; the disciplines; approvals and site supervision).

## Typography

**Page and section headings** follow daqconsulting.com’s “ENGINEERED FOR / **SCALE.**”: Inter Light (300) with Each Word Capitalised, the last word on its own line in Inter Bold (700), left-aligned, line-height 1 and −30 tracking (`--hd-track: -.03em`). The capitals come from CSS (`text-transform: capitalize`), so keep typing headings in sentence case. The build does this automatically (`displayHeadings()` in `src/build.mjs`), so keep writing headings in sentence case. If the last word is 3 letters or fewer (“with us”), the word before it goes bold too. To pick the bold words yourself, wrap them in `<span class="hb">…</span>`, as in “Life at <span class="hb">Top Concept</span>”. The weights, tracking and line-height are variables under “Display headings” at the end of `styles.css`. Subheads inside articles and the privacy policy, and the menu and footer headings, keep the old style.

Other headings are Inter Medium with −50 tracking (`--track-head: -.05em`), in sentence case. Small titles (cards, names, menu) use `--track-small: -.03em` so they don’t close up. Body text is Inter Regular with −50 tracking too (`--track-body: -.05em`, set once on `body`). Buttons and small labels stay in Montserrat. Write heading copy in sentence case; the CSS never forces capitals on headings.

## Leadership, logo and loader

- **Leadership (Team page):** the two founders side by side, names under them, the letter below. The portraits (`assets/img/founder-*.png`) are the PNG files from `Leadership/Update/`, used as-is. The section sits on a white-grey backdrop (`assets/img/leaders-bg.webp`, from the same folder) that scrolls with the section and looks the same in dark and light mode: its text colours are set in `.leaders` rather than taken from the theme. The portraits are shown as supplied, with no overlay. Names, roles and the letter are in `teamLeadership` in `src/data.mjs`.
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
assets/img/                         optimized images (WebP), logos, icons
assets/fonts/                       self-hosted Montserrat + Inter
src/config.mjs                      site settings (forms, socials, map pins)
src/data.mjs                        content
src/build.mjs                       page generator
```

## Notes

- Fonts and scripts are self-hosted, so the site makes no third-party requests except the optional form endpoint and social links.
- The privacy policy is a plain-language starting point — have it reviewed before launch.
- The careers form uses a hidden spam-trap field instead of reCAPTCHA. If you want reCAPTCHA/hCaptcha, most form services (Formspree, Web3Forms) can add it from their dashboard.
