// ─────────────────────────────────────────────────────────────
//  CONTENT — projects, team, blog posts, expertise.
//  Image names refer to files in assets/img (without extension).
//  After editing run:  node src/build.mjs
// ─────────────────────────────────────────────────────────────

// Fields of expertise (home page grid + project filters).
// size: "lg" = wide card, "sm" = small card (matches the design's alternating rows)
// Home "About us" section, right after the hero (layout after madamepolare.com): a lead paragraph on the left,
// two short paragraphs on the right, and a button to the Team page. Written to the web-copywriter skill.
export const about = {
  lead: "Top Concept International (TCI) is a team of architects, engineers and designers. We work from offices in the UAE, India and London. We take projects from the first sketch to handover. One team stays with your project the whole way, so the design you approve is the building you get.",
  paragraphs: [
    "Architecture, interiors, landscape and master planning sit under one roof. Structural and MEP coordination run alongside the design, not after it. That means fewer clashes on site and fewer costly redesigns.",
    "Developers, government entities and brands across the UAE trust us with their work. We design, steer authority approvals and supervise construction. You deal with one team, and nothing gets lost between stages.",
  ],
  cta: "Meet the team",
  href: "team.html",
};

export const expertise = [
  { slug: "urban-design", title: "Urban design / development", type: "masterplan", img: "p-alrams-urban-development", size: "lg", alt: "Aerial view of a waterfront urban development with a marina" },
  { slug: "community", title: "Community", darkTitle: "Community buildings", type: "architecture", img: "ex-community", pos: "50% 62%", size: "lg", alt: "High-rise residential tower rising above a city skyline" },
  { slug: "interior-design", title: "Interior design", type: "interior", img: "p-residential-interior", size: "sm", alt: "Bright living room with a large sofa and floor-to-ceiling windows" },
  { slug: "villas", title: "High-end villas", type: "architecture", img: "p-high-end-villa", size: "sm", alt: "Contemporary luxury villa at sunset" },
  { slug: "townhouses", title: "Townhouses", type: "architecture", img: "p-townhouses", size: "sm", alt: "Row of modern white townhouses" },
  { slug: "malls", title: "Malls", type: "architecture", img: "p-shopping-mall", size: "lg", alt: "Shopping mall atrium with an ornate chandelier and escalators" },
  { slug: "retail", title: "Retails", type: "architecture", img: "p-retail-center", size: "lg", alt: "Aerial view of a retail centre with a solar roof" },
  { slug: "master-planning", title: "Master planning", darkTitle: "Masterplan", type: "masterplan", img: "p-resort-masterplan", size: "sm", alt: "Aerial view of a resort masterplan with lagoon pools" },
  { slug: "landscape", title: "Landscape", type: "masterplan", img: "p-podium-landscape", size: "sm", alt: "Podium landscape with a pool deck and palm trees" },
  { slug: "hospitality", title: "Hospitality", type: "hospitality", img: "p-wadi-retreat", size: "sm", alt: "Mountain retreat resort at dusk" },
];

// ── Expertise page (from the "Expertise (black)" design) ──
export const expertisePage = {
  heroTitle: "Explore our <em>expertise</em>",
  heroAlt: "Azizi mixed-use building with an arcaded retail podium at dusk",
  heading: "One team for every discipline.",
  intro: "Architecture, interiors, landscape and master planning sit under one roof here. Your project stays with one team from the first sketch to handover. Nothing gets lost between stages, and the design holds together.",
  // Expertise cards, two per row (rows first, then the carousel fields). hover = second image shown on hover.
  rows: [
    { slug: "urban-design", title: "Urban design / development", img: "ex-urban", hover: "p-alrams-urban-development", alt: "Waterfront promenade with people, cafés and a marina",
      text: "We plan districts, waterfronts and public spaces that people want to use. Planning, architecture and landscape are designed together, not one after another. The result is a place with a clear identity that keeps its value as it grows." },
    { slug: "community", title: "Community buildings / high-rise development expertise", img: "ex-community", hover: "p-community-tower", pos: "50% 62%", alt: "Corner of a high-rise development with an arched retail podium",
      text: "We design towers of G+30 and above that are efficient to build and good to live in. Layouts, cores and podiums are planned together, so every floor works. Azizi City of Arabia shows what that looks like at community scale." },
    { slug: "malls", title: "Malls", img: "p-shopping-mall", pos: "50% 35%", alt: "Mall atrium with a red lantern-style chandelier",
      text: "We design malls that draw visitors in and keep them there. A clear arrival, easy wayfinding and one memorable central space do the work. We learn from places like Souk Al Bahar and Dubai Mall, then give each destination an identity of its own." },
    { slug: "master-planning", title: "Masterplan", img: "ex-masterplan", hover: "p-resort-masterplan", alt: "Night aerial view of a masterplanned resort community",
      text: "We turn open land into a clear, phased plan. Roads, buildings, landscape and community needs are solved on one drawing. You get a masterplan that investors understand and contractors can build." },
  ],
  // Carousel of the remaining fields.
  carousel: [
    { slug: "retail", title: "Retails", img: "p-retail-center", hover: "rp-01", alt: "Aerial view of a retail park with a solar roof",
      text: "Retail spaces that turn a quick errand into a longer visit, and a longer visit into repeat trade." },
    { slug: "interior-design", title: "Interior design", img: "p-residential-interior", hover: "p-luxury-lounge", alt: "Living room with floor-to-ceiling windows",
      text: "Interiors planned around how people really live and work, then finished with care." },
    { slug: "villas", title: "High-end villas", img: "p-high-end-villa", alt: "Contemporary villa at sunset",
      text: "Private homes shaped by light, privacy and the view, made to feel right for decades." },
    { slug: "townhouses", title: "Townhouses", img: "p-townhouses", alt: "Row of modern white townhouses",
      text: "Townhouse communities built on one strong idea, with good proportions and shared outdoor space." },
    { slug: "landscape", title: "Landscape", img: "p-podium-landscape", hover: "rp-06", alt: "Podium landscape with a pool deck",
      text: "Podium gardens, shaded courtyards and pool decks that make outdoor space usable all year." },
    { slug: "hospitality", title: "Hospitality", img: "p-wadi-retreat", hover: "p-forest-resort", alt: "Mountain retreat at dusk",
      text: "Resorts and retreats where architecture, landscape and atmosphere are designed as one guest experience." },
  ],
};

// ── Projects page (from the "Projects Page (black)" design) ──
export const projectsPage = {
  heroTitle: "View the <em>work</em>",
  heroAlt: "Aerial view of a retail park with a solar roof in a desert landscape",
  heading: "Ambitious ideas, built for real.",
  intro: "From waterfront masterplans to boardroom fit-outs, these are projects we took from first sketch to finished space. Filter by type to find work like yours.",
  showcase: {
    slug: "retail-park",
    label: "Retail Park",
    text: "A retail and community destination in Sharjah. A long solar roof shelters the shops. In front sit a shaded market, a tree-lined plaza and a pavilion wrapped in a brick screen. It gives people a reason to stay: to eat, meet and spend the afternoon, not just to shop.",
  },
};

// ── Clients (home page logo wall). Logos are cut from Clients/Logos list.png into assets/img/clients/ (transparent WebP). ──
export const clients = {
  title: "In trusted company",
  text: "Developers, government entities and brands across the UAE trust us with their projects. From masterplans and civic buildings to retail and hospitality, we design, coordinate and supervise each one through to handover.",
  logos: [
    { file: "emaar", name: "Emaar", w: 400, h: 98 },
    { file: "eagle-hills", name: "Eagle Hills", w: 153, h: 220 },
    { file: "dubai-police", name: "Dubai Police", w: 400, h: 155 },
    { file: "asq-holding", name: "ASQ Holding", w: 392, h: 220 },
    { file: "albatha", name: "Al Batha", w: 231, h: 220 },
    { file: "azizi", name: "Azizi Developments", w: 400, h: 118 },
    { file: "ecbd", name: "Emirates Council for Balanced Development", w: 400, h: 105 },
    { file: "durres", name: "Durres", w: 400, h: 96 },
    { file: "nshama", name: "Nshama", w: 400, h: 59 },
    { file: "dubai-courts", name: "Dubai Courts", w: 240, h: 220 },
    { file: "edge-etimad", name: "EDGE Etimad", w: 394, h: 220 },
    { file: "ministry-of-defence", name: "UAE Ministry of Defence", w: 250, h: 220 },
    { file: "wasl", name: "wasl", w: 400, h: 162 },
    { file: "rox", name: "ROX", w: 400, h: 89 },
    { file: "gargash", name: "Gargash", w: 212, h: 216 },
    { file: "dubai-civil-defence", name: "Dubai Civil Defence", w: 381, h: 220 },
    { file: "detailing-xperts", name: "The Detailing Xperts", w: 400, h: 88 },
  ],
};

export const projectTypes = [
  { slug: "architecture", label: "Architecture" },
  { slug: "interior", label: "Interior" },
  { slug: "masterplan", label: "Masterplan & Landscape" },
  { slug: "hospitality", label: "Hospitality" },
];

// Project titles that were not in the design files are descriptive placeholders —
// replace with the real project names when you have them.
export const projects = [
  { slug: "alrams-urban-development", title: "Alrams Urban Development", label: "Masterplan", cat: "urban-design", type: "masterplan", img: "p-alrams-urban-development", alt: "Aerial view of the Alrams waterfront urban development", featured: true },
  { slug: "azizi-city-of-arabia", title: "Azizi City of Arabia", label: "Commercial", cat: "community", type: "architecture", img: "p-azizi-city-of-arabia", alt: "Azizi City of Arabia towers with sculpted white façade fins", featured: true },
  { slug: "al-manara-center", title: "Al Manara Center", label: "Commercial", cat: "interior-design", type: "interior", img: "p-al-manara-center", alt: "Boardroom interior with a long dark table and glass partitions", featured: true },
  { slug: "wadi-retreat", title: "Wadi retreat", label: "Hospitality", cat: "hospitality", type: "hospitality", img: "p-wadi-retreat", alt: "Retreat set in a mountain wadi with an infinity pool", featured: true },
  { slug: "rox-showroom", title: "Rox Showroom", label: "Commercial Interior", cat: "interior-design", type: "interior", img: "p-rox-reception", alt: "Rox showroom reception desk", gallery: ["p-rox-showroom-1", "p-rox-showroom-2", "p-rox-showroom-3", "p-rox-showroom-4", "p-rox-showroom-5", "p-automotive-showroom"], featured: true },
  { slug: "high-end-villa", title: "High-end villa", label: "Villas", cat: "villas", type: "architecture", img: "p-high-end-villa", alt: "Two-storey contemporary villa glowing at sunset", featured: true },
  { slug: "community-tower", title: "Community tower", label: "Community Buildings", cat: "community", type: "architecture", img: "p-community-tower", alt: "Slender residential tower with horizontal balcony bands" },
  { slug: "mid-rise-residential", title: "Mid-rise residential", label: "Residential", cat: "community", type: "architecture", img: "p-mid-rise-residential", alt: "Mid-rise residential building with palms and mountains behind" },
  { slug: "waterfront-residences", title: "Waterfront residences", label: "Residential", cat: "community", type: "architecture", img: "p-waterfront-residences", alt: "Residential blocks along a waterfront promenade at dusk" },
  { slug: "boutique-mid-rise", title: "Boutique mid-rise", label: "Residential", cat: "community", type: "architecture", img: "p-boutique-mid-rise", alt: "Five-storey residential building with stone cladding" },
  { slug: "townhouses", title: "Townhouse community", label: "Townhouses", cat: "townhouses", type: "architecture", img: "p-townhouses", alt: "Rows of modern white townhouses with dark gates" },
  { slug: "shopping-mall", title: "Shopping mall", label: "Malls", cat: "malls", type: "architecture", img: "p-shopping-mall", alt: "Mall atrium with a red lantern-style chandelier" },
  { slug: "retail-park", title: "Retail Park", label: "Retail", cat: "retail", type: "architecture", img: "p-retail-center", alt: "Retail centre seen from above with a solar-panel roof" },
  { slug: "residential-interior", title: "Residential interior", label: "Interior Design", cat: "interior-design", type: "interior", img: "p-residential-interior", alt: "Living room with a modern pendant light and garden views" },
  { slug: "luxury-lounge", title: "Luxury lounge", label: "Interior Design", cat: "interior-design", type: "interior", img: "p-luxury-lounge", alt: "Double-height lounge with sculptural pendant lighting" },
  { slug: "executive-boardroom", title: "Executive boardroom", label: "Commercial Interior", cat: "interior-design", type: "interior", img: "p-executive-boardroom", alt: "Executive boardroom with a long oval table" },
  { slug: "reception-lobby", title: "Reception lobby", label: "Commercial Interior", cat: "interior-design", type: "interior", img: "p-reception-lobby", alt: "Reception lobby with a circular desk and ring pendant lights" },
  { slug: "resort-masterplan", title: "Resort masterplan", label: "Masterplan", cat: "master-planning", type: "masterplan", img: "p-resort-masterplan", alt: "Aerial view of a resort masterplan with lagoon pools" },
  { slug: "podium-landscape", title: "Podium landscape", label: "Landscape", cat: "landscape", type: "masterplan", img: "p-podium-landscape", alt: "Landscaped podium with a pool, decking and palms" },
  { slug: "forest-resort", title: "Forest resort concept", label: "Hospitality Masterplan", cat: "hospitality", type: "hospitality", img: "p-forest-resort", alt: "Night aerial view of a forest resort concept design" },
];

// Short, neutral summaries used on project pages (keyed by `label`).
export const labelBlurbs = {
  "Masterplan": "A masterplan built around connected public space, easy movement and a clear sense of place.",
  "Commercial": "A commercial project taken from first concept to a buildable, approved design.",
  "Commercial Interior": "A fit-out designed around the brand and the way people move through the space.",
  "Hospitality": "A hospitality project where landscape, architecture and atmosphere are designed together.",
  "Hospitality Masterplan": "A hospitality masterplan that balances guest experience, landscape and phased delivery.",
  "Villas": "A private home designed for light, privacy and a strong connection to its setting.",
  "Community Buildings": "A community building designed around the people who use it every day.",
  "Residential": "A residential building that works for the people who live in it, the contractor who builds it and the budget.",
  "Townhouses": "A townhouse community built on one strong idea, repeated with care.",
  "Malls": "A retail destination planned around arrival, wayfinding and one memorable central space.",
  "Retail": "A retail development coordinated across architecture, engineering and authority approvals.",
  "Interior Design": "An interior planned around daily use, then finished with care in every detail.",
  "Landscape": "A landscape that turns outdoor space into a usable part of the building.",
};

// CEO quote: no longer shown on the home page (removed); kept here in case it is used again.
export const leadership = {
  quote: "At Top Concept, we are driven by people who care deeply about design, execution and the lasting impact of the spaces we create.",
  quoteBy: "Ragheed Al Tahhan",
  quoteRole: "CEO / Co-founder",
};

// Leadership copy used on the Team page (from the "Team" design). The home page uses `leadership` above.
export const teamLeadership = {
  paragraphs: [
    "At Top Concept, we design spaces that feel good to live in, work in and visit.",
    "Our work goes beyond buildings. We start with people: who will use a space, and what they need from it. From architecture and interiors to engineering coordination and site supervision, one team brings the ideas, the technical knowledge and the care.",
    "We have grown through trust, hard work and strong relationships with our clients and partners. Every project has taught us something, and each one makes the next design better.",
    "Thank you to everyone who has been part of our journey. Together, we will keep creating spaces built with purpose, integrity and lasting value.",
  ],
  people: [
    { name: "Nawaf Al Falasi", role: "Founder", img: "founder-nawaf" },
    { name: "Engr. Ragheed Al-Tahhan", role: "CEO & Co-Founder", img: "founder-ragheed" },
  ],
};

export const team = [
  { name: "Maria Gomez", role: "Head of Department (Engineering & Architecture)", img: "t-maria-corazon" },
  { name: "Lobna Elsawy", role: "Head of Department (Interior)", img: "t-lobna-elsawy" },
  { name: "Mohammad Yousseff", role: "Group HR Manager", img: "t-mohammad-yousseff" },
  { name: "Rola Ayman", role: "Project Manager (Interior)", img: "t-rola-ayman" },
  { name: "Marcelino Cruz", role: "Senior Architect", img: "t-marcelino-cruz" },
  { name: "Mohammed Faizan", role: "Architect", img: "t-mohammed-faizan" },
  { name: "Mai Gendeil", role: "Structural Engineer", img: null },
  { name: "Shahd Allazkani", role: "Design Architect", img: "t-shahd-allazkani" },
  { name: "Amin", role: "Design Architect", img: null },
  { name: "Rama Qabbani", role: "Interior Designer", img: "t-rama-qabbani" },
  { name: "Toranj Majid", role: "Interior Designer", img: "t-toranj-majid" },
  { name: "Ahmed Ali", role: "Site Engineer", img: "t-ahmed-ali" },
  { name: "Yorgo", role: "Site Engineer", img: null },
  { name: "Kousai Alhaji", role: "Senior Estimator / Quantity Surveyor", img: "t-kousai-alhaji" },
  { name: "Mohamed Hamza", role: "Quantity Surveyor Engineer", img: "t-mohamed-hamza" },
  { name: "Muhammad Sharafat", role: "M.E.P. Engineer", img: "t-muhammad-sharafat" },
  { name: "Shayeebuddin Khilji", role: "Document Controller", img: "t-shayeebuddin-khilji" },
  { name: "Saifullah Abdulla", role: "Document Controller", img: null },
  { name: "Carl Serafin", role: "Media Department", img: null },
  { name: "Arya Akhil", role: "Admin / Receptionist", img: "t-arya-akhil" },
];

export const culture = {
  intro: [
    "Our culture is built on trust, respect and real care for one another.",
    "We do our best work when people feel supported and valued. We work as one team, celebrate wins together and face problems honestly.",
    "Great spaces matter to us. So do the friendships we make while building them.",
  ],
  life: [
    "From the first sketch to the final handover, we work through every stage together.",
    "We share ideas openly, solve problems as a team and mark every milestone, big or small.",
    "Busy days and tight deadlines are easier when you trust the people next to you. That trust is what keeps our work strong.",
  ],
  thrive: [
    "Our studio runs on kindness and respect. People do their best work when they feel valued.",
    "Everyone is welcome here, and every idea gets heard. We work hard, help each other through challenges and celebrate progress together.",
    "A quick break, a friendly game or a good coffee goes a long way. When people are happy and trusted, it shows in the work.",
  ],
  voices: [
    { quote: "Leading the Engineering & Architecture Department at Top Concept International has been a truly rewarding journey. Every project gives us the opportunity to shape spaces that inspire people, improve everyday experiences, and leave a lasting impact through thoughtful design, collaboration, and innovation.", name: "Maria Gomez", role: "Head of Department (Engineering & Architecture)", img: "voice-maria" },
    { quote: "Being part of the Interior Design Department at Top Concept International means creating spaces that people feel connected to, comfortable in, and proud of. It’s a journey shaped by creativity, care, and a team that brings passion into every detail.", name: "Lobna Elsawy", role: "Head of Department (Interiors)", img: "voice-lobna" },
  ],
};

export const careers = {
  intro: "A career here means real projects, real responsibility and a team that helps you grow. We look for people who value teamwork, care about the craft and want to build spaces that matter.",
};

// Sample editorial content — replace with real articles. `body` is an array of paragraphs.
export const blogs = [
  {
    slug: "from-concept-to-completion",
    title: "From concept to completion: keeping one team behind every project",
    date: "2026-06-23",
    img: "b-engineers",
    alt: "Two colleagues reviewing drawings on site",
    excerpt: "Why the best projects keep the same team from the first sketch to the final handover.",
    body: [
      "A project rarely fails because of a single bad decision. More often, it drifts: an idea that was clear on day one becomes diluted as it passes through hands that were never part of the original conversation.",
      "That is why we organise our work around continuity. The people who shape the concept stay close to the project as it moves into engineering coordination, authority approvals and supervision on site, so the reasoning behind each decision travels with the drawings.",
      "For clients, that continuity shows up as fewer surprises and faster answers. For our team, it means seeing the idea all the way through to the finished space, which is what makes the work worth doing.",
    ],
  },
  {
    slug: "designing-for-light-and-climate",
    title: "Designing for light, shade and climate",
    date: "2026-06-16",
    img: "b-atrium",
    alt: "Person walking through a bright glazed atrium holding plans",
    excerpt: "Good façades start with the sun. Here is how orientation, shading and materials keep buildings comfortable.",
    body: [
      "In a hot climate, the façade is a piece of environmental equipment as much as an architectural gesture. Where it sits, how deep it is and what it is made of decide how much heat enters the building before a single mechanical system switches on.",
      "We test orientation and shading early, when changing course is cheap. Deep balconies, fins and recessed glazing do double duty: they give a building its rhythm and they keep interiors bright without the glare.",
      "The result is architecture that looks considered from the street and feels calm from the inside.",
    ],
  },
  {
    slug: "coordination-is-design",
    title: "Coordination is part of design",
    date: "2026-06-04",
    img: "b-blueprint",
    alt: "Architect leaning over a large set of drawings",
    excerpt: "Architecture, structure and services work best when they are solved together, not one after another.",
    body: [
      "It is tempting to treat coordination as the tidy-up phase that happens after the creative work. In practice, the most elegant solutions are usually found when architects, structural engineers and MEP engineers are solving the same problem at the same time.",
      "Sharing a single model, agreeing clear ceiling and riser zones early, and reviewing clashes as they appear keeps the design intent intact while making the building simpler to build.",
      "It is a quiet discipline, but it is the difference between a drawing that looks good and a building that does.",
    ],
  },
  {
    slug: "interiors-that-feel-connected",
    title: "Interiors that feel connected to their setting",
    date: "2026-05-21",
    img: "b-landscape",
    alt: "Landscaper laying turf in front of a villa",
    excerpt: "The best interiors keep talking to the landscape and the architecture around them.",
    body: [
      "An interior is never a separate project. It inherits the light, views and proportions of the architecture and, when it is done well, extends them.",
      "We start from the way a space will be used and the sightlines that matter, then choose materials and lighting to support those moments rather than compete with them.",
      "When the inside and outside agree with each other, a home or workplace feels effortless.",
    ],
  },
  {
    slug: "what-happens-on-site",
    title: "What happens on site is part of the design story",
    date: "2026-05-07",
    img: "b-site",
    alt: "Concrete structure under construction",
    excerpt: "Site supervision closes the gap between the drawings and the finished building.",
    body: [
      "Drawings describe intent; a site delivers reality. The gap between the two is where quality is won or lost.",
      "Regular supervision, clear communication with contractors and a habit of solving problems on the spot keep that gap small. It also feeds lessons back into the studio so the next set of drawings is better than the last.",
      "Seeing a structure rise from the ground is a good reminder of why precision at the design stage matters so much.",
    ],
  },
  {
    slug: "spaces-that-serve-people",
    title: "Spaces that serve people",
    date: "2026-04-23",
    img: "b-walkthrough",
    alt: "Colleagues inspecting a finished interior",
    excerpt: "Purpose, beauty and function: the three questions we ask of every space.",
    body: [
      "Before we talk about form, we ask three simple questions. Who is this space for? How should it feel? And how will it work every day?",
      "Purpose keeps the design honest, beauty gives it presence, and function makes it last. A space that answers all three tends to age well.",
      "It is a simple test, and one we come back to at every stage of a project.",
    ],
  },
];
