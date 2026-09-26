// ─────────────────────────────────────────────────────────────
//  SITE SETTINGS — edit these, then run:  node src/build.mjs
// ─────────────────────────────────────────────────────────────
export default {
  siteName: "Top Concept International",
  tagline: "Architects . Engineers . Designers",
  description:
    "Top Concept International is a multidisciplinary consultancy of architects, engineers and designers delivering projects from concept to completion.",

  // Public URL of the finished site, e.g. "https://www.yourdomain.com" (no trailing slash).
  // Used for social-share links and sitemap.xml. Update it if the address changes.
  siteUrl: "https://cepsmyster.github.io/top-concept-website",

  // ── Forms ────────────────────────────────────────────────
  // Option A (recommended): a form-handling endpoint such as Formspree / Web3Forms / Getform.
  //   Paste the endpoint URL here and both forms will POST to it (the CV upload is included).
  formEndpoint: "",
  // Option B: an email address. If no endpoint is set, the contact form opens the visitor's
  //   email app pre-filled to this address.
  contactEmail: "",
  // Optional: WhatsApp number in international format, digits only (e.g. "971501234567").
  whatsapp: "",

  // ── Social links (footer). Replace with the real company pages. ──
  social: {
    whatsapp: "https://wa.me/",
    youtube: "https://www.youtube.com/",
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    linkedin: "https://www.linkedin.com/",
    pinterest: "https://www.pinterest.com/",
  },
};
