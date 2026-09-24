// ─────────────────────────────────────────────────────────────
//  CONTENT — projects, team, blog posts, expertise.
//  Image names refer to files in assets/img (without extension).
//  After editing run:  node src/build.mjs
// ─────────────────────────────────────────────────────────────

// Fields of expertise (home page grid + project filters).
// size: "lg" = wide card, "sm" = small card (matches the design's alternating rows)
export const expertise = [
  { slug: "urban-design", title: "Urban design / development", type: "masterplan", img: "p-alrams-urban-development", size: "lg", alt: "Aerial view of a waterfront urban development with a marina" },
  { slug: "community", title: "Community", darkTitle: "Community buildings", type: "architecture", img: "p-community-tower", size: "lg", alt: "High-rise residential tower rising above a city skyline" },
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
  heroTitle: "Uncover our <em>expertise</em>",
  heroAlt: "Azizi mixed-use building with an arcaded retail podium at dusk",
  heading: "Where every discipline shapes a stronger vision.",
  intro: "At Top Concept International, our expertise moves across architecture, interiors, landscape and master planning. By connecting these fields, we create design solutions that feel complete, purposeful, and deeply considered from concept to completion.",
  // Alternating image / text rows
  rows: [
    { slug: "urban-design", title: "Urban design / development", img: "ex-urban", alt: "Waterfront promenade with people, cafés and a marina",
      text: "We shape places that connect people, movement and purpose. Our urban design and development approach brings together planning, architecture, landscape and community experience to create environments that feel organized, livable and future-ready. From mixed-use districts to residential communities and public spaces, each project is designed with a clear vision for growth, identity, and long-term value." },
    { slug: "community", title: "Community buildings / high-rise development expertise", img: "ex-community", pos: "50% 62%", alt: "Corner of a high-rise development with an arched retail podium",
      text: "We design vertical communities that bring comfort, function, and identity into high-density living. Our expertise in G+30 and above developments focuses on creating buildings that are efficient, elegant, and connected to the urban fabric around them. From residential towers to large-scale community developments like Azizi City of Arabia, each project is shaped to support modern lifestyles, long-term value, and a stronger sense of place." },
    { slug: "malls", title: "Malls", img: "p-shopping-mall", pos: "50% 35%", alt: "Mall atrium with a red lantern-style chandelier",
      text: "We design retail destinations that bring commerce, culture and experience together. Our expertise in malls and lifestyle developments focuses on creating spaces that feel active, welcoming and memorable. Inspired by destinations such as Souk Al Bahar and Dubai Mall, each project is planned to support shopping, dining, leisure and community interaction while creating a strong identity that attracts visitors and adds long-term value." },
    { slug: "master-planning", title: "Masterplan", img: "ex-masterplan", alt: "Night aerial view of a masterplanned resort community",
      text: "We create masterplans that turn land into clear, connected, and meaningful destinations. Our approach brings together urban design, architecture, landscape, mobility, and community needs to shape developments that are practical, future-ready, and visually cohesive. From residential communities to mixed-use districts and large-scale destinations, each masterplan is guided by a strong vision, balanced planning, and long-term development value." },
  ],
  // Carousel of the remaining fields. The Retails line is from the design; the other five are
  // short placeholder lines in the same voice — replace with approved copy.
  carousel: [
    { slug: "retail", title: "Retails", img: "p-retail-center", alt: "Aerial view of a retail park with a solar roof",
      text: "We design retail spaces that connect shopping, dining, and daily experience into vibrant destinations built for people, movement, and long-term commercial value." },
    { slug: "interior-design", title: "Interior design", img: "p-residential-interior", alt: "Living room with floor-to-ceiling windows",
      text: "We design interiors that feel connected, comfortable, and considered in every detail, shaping how people live, work, and gather." },
    { slug: "villas", title: "High-end villas", img: "p-high-end-villa", alt: "Contemporary villa at sunset",
      text: "We design private residences with a considered relationship to light, privacy, and landscape, creating homes with lasting character." },
    { slug: "townhouses", title: "Townhouses", img: "p-townhouses", alt: "Row of modern white townhouses",
      text: "We design townhouse communities that repeat a strong architectural idea with well-proportioned detail, shared spaces, and everyday comfort." },
    { slug: "landscape", title: "Landscape", img: "p-podium-landscape", alt: "Podium landscape with a pool deck",
      text: "We design landscapes that turn outdoor space into an extension of the building, from podium gardens to shaded courtyards and pool decks." },
    { slug: "hospitality", title: "Hospitality", img: "p-wadi-retreat", alt: "Mountain retreat at dusk",
      text: "We design hospitality destinations where architecture, landscape, and atmosphere come together to create memorable guest experiences." },
  ],
};

// ── Projects page (from the "Projects Page (black)" design) ──
export const projectsPage = {
  heroTitle: "View the <em>work</em>",
  heroAlt: "Aerial view of a retail park with a solar roof in a desert landscape",
  heading: "Bringing ambitious concepts to life.",
  intro: "From the ground up, Top Concept International is dedicated to creating transformative spaces. We combine honest teamwork with a drive for excellence, turning open landscapes into thriving, purposeful destinations that truly matter.",
  showcase: {
    slug: "retail-park",
    label: "Retail Park",
    text: "Discover our latest landmark development. This expansive retail park merges high-end commercial architecture with forward-thinking design. Featuring an integrated solar-canopy roof and modern, minimalist facades, the complex is built to be a premier destination for both commerce and community. It perfectly encapsulates our commitment to sustainable, large-scale commercial environments that elevate the surrounding landscape.",
  },
};

// ── Clients (home page logo wall). Logos are cut from Clients/Logos list.png into assets/img/clients/ (transparent WebP). ──
export const clients = {
  title: "In trusted company",
  text: "Many of our projects come from clients who return to us time and again: developers, government entities and brands across the UAE. From landmark masterplans and civic buildings to retail and hospitality, our partnerships are built to last well beyond handover.",
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
  { slug: "wadi-retreat", title: "Wadi retreat", label: "Hospitality", cat: "hospitality", type: "hospitality", img: "p-wadi-retreat", alt: "Retreat nestled in a mountain wadi with an infinity pool", featured: true },
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
  "Masterplan": "A masterplanning project shaped by connected public space, movement and a strong sense of place.",
  "Commercial": "A commercial project taken from concept design through to a deliverable, buildable scheme.",
  "Commercial Interior": "An interior fit-out designed around brand, function and the way people move through the space.",
  "Hospitality": "A hospitality project where landscape, architecture and atmosphere are designed together.",
  "Hospitality Masterplan": "A hospitality masterplan balancing guest experience, landscape and phasing.",
  "Villas": "A high-end residence designed for light, privacy and a considered relationship with its setting.",
  "Community Buildings": "A community-scale building designed to serve people with purpose, beauty and function.",
  "Residential": "A residential project resolved for livability, technical performance and commercial practicality.",
  "Townhouses": "A townhouse community that repeats a strong architectural idea with quiet, well-proportioned detail.",
  "Malls": "A retail destination designed around arrival, orientation and a memorable central space.",
  "Retail": "A retail development coordinated across architecture, engineering and authority requirements.",
  "Interior Design": "An interior designed to feel connected, comfortable and considered in every detail.",
  "Landscape": "A landscape scheme that turns outdoor space into an extension of the building.",
};

// CEO quote shown on the home page (the full Leadership section now lives on the Team page: see teamLeadership).
export const leadership = {
  quote: "At Top Concept, we are driven by people who care deeply about design, execution and the lasting impact of the spaces we create.",
  quoteBy: "Ragheed Al Tahhan",
  quoteRole: "CEO / Co-founder",
};

// Leadership copy used on the Team page (from the "Team" design). The home page uses `leadership` above.
export const teamLeadership = {
  paragraphs: [
    "At Top Concept, we design spaces that feel good to live in, work in, and experience.",
    "Our work goes beyond buildings. It is about understanding people, their needs, and the way each space should serve them. From architecture and interiors to engineering coordination and project supervision, we bring creativity, technical knowledge, and care into every project.",
    "Over the years, we have grown through trust, hard work, and strong relationships with our clients and partners. Every project has helped us learn, improve, and deliver designs that are both beautiful and practical.",
    "We are grateful to everyone who has been part of our journey. Together, we continue to create meaningful spaces built with purpose, integrity, and lasting value.",
  ],
  people: [
    { name: "Nawaf Al Falasi", role: "Founder" },
    { name: "Engr. Ragheed Al-Tahhan", role: "CEO & Co-Founder" },
  ],
};

export const team = [
  { name: "Maria Corazon", role: "Head of Department (Architecture)", img: "t-maria-corazon" },
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
    "Our culture comes from the heart and is built on trust, respect, and genuinely caring for one another.",
    "At Top Concept International, we believe the best work happens when people feel supported, valued and inspired to grow together. We work as one team, celebrate every win together, and face every challenge with honesty and commitment.",
    "For us, it’s not just about creating great spaces, it’s about building meaningful relationships and enjoying the journey along the way.",
  ],
  life: [
    "From the first brainstorming session to the final project handover, we enjoy every part of the journey together.",
    "We share ideas openly, solve challenges as a team, celebrate every milestone along the way, big or small and share a few smiles along the way.",
    "We support one another through busy days, tight deadlines, and new opportunities, always knowing that great work happens when people work together with trust, energy and a shared sense of purpose.",
  ],
  thrive: [
    "Our work environment is built on kindness, respect and the belief that people do their best when they feel valued and supported.",
    "We’ve created a place where everyone is welcomed, ideas are heard and teamwork comes naturally. It’s a space where we work hard, help one another through challenges, celebrate progress together and never forget to enjoy the journey.",
    "We also believe that a quick break, a friendly game or a good coffee can go a long way in recharging the mind and bringing people together. When people feel happy, trusted and inspired, great things happen.",
  ],
  voices: [
    { quote: "Leading the Architecture Department at Top Concept International has been a truly rewarding journey. Every project gives us the opportunity to shape spaces that inspire people, improve everyday experiences, and leave a lasting impact through thoughtful design, collaboration, and innovation.", name: "Maria Corazon", role: "Head of Department (Architecture)", img: "voice-maria" },
    { quote: "Being part of the Interior Design Department at Top Concept International means creating spaces that people feel connected to, comfortable in, and proud of. It’s a journey shaped by creativity, care, and a team that brings passion into every detail.", name: "Lobna Elsawy", role: "Head of Department (Interiors)", img: "voice-lobna" },
  ],
};

export const careers = {
  intro: "A career at Top Concept International is more than a job, it’s a chance to grow, create, and be part of something meaningful. We’re always looking for passionate people who value teamwork, creativity, and excellence, and who want to build inspiring spaces while building a rewarding future for themselves.",
};

// Sample editorial content — replace with real articles. `body` is an array of paragraphs.
export const blogs = [
  {
    slug: "from-concept-to-completion",
    title: "From concept to completion: keeping one team behind every project",
    date: "2026-06-23",
    img: "b-engineers",
    alt: "Two colleagues reviewing drawings on site",
    excerpt: "Why the strongest projects are carried by the same people from the first sketch to the final handover.",
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
    excerpt: "Good façades start with the sun: how orientation, shading and materials shape comfortable buildings.",
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
    excerpt: "Architecture, structure and services have to be resolved together — not one after the other.",
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
    excerpt: "The best interiors keep a conversation going with the landscape and the architecture around them.",
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
    excerpt: "Site supervision closes the loop between drawings and the finished building.",
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
