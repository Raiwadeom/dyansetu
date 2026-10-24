/* ============================================================================
   Dev Hub content — edit this file, nothing else, to update the page.

   Everything marked TODO is a placeholder: replace it with the real name,
   photo, project and link. Photos go in public/devhub/ and are referenced as
   "/devhub/name.jpg" (leave photo empty to show the initials instead).
   ========================================================================== */

/* Your channel. The WhatsApp link opens a chat or a channel — paste the real
   one: a chat is "https://wa.me/91XXXXXXXXXX", a channel is
   "https://whatsapp.com/channel/XXXXXXXX". */
export const SOCIALS = {
  instagram: "https://www.instagram.com/oruim.tech",
  instagramHandle: "@oruim.tech",
  youtube: "https://www.youtube.com/@oruimtech",
  whatsapp: "https://chat.whatsapp.com/LYCicNpEoPaAuZ9bbpLBWq", /* WhatsApp group invite */
};

export const TECHOVA = {
  year: "2025",
  tagline: "The annual college tech festival — projects, code and ideas on one stage.",
  /* Order = podium order: 1st, 2nd, 3rd, then special mentions. */
  winners: [
    { place: "1st", prize: "Winner", name: "TODO · Winner name", klass: "TODO · Class / Year", project: "TODO · Project title", note: "TODO · One line about what they built.", photo: "" },
    { place: "2nd", prize: "Runner-up", name: "TODO · Runner-up name", klass: "TODO · Class / Year", project: "TODO · Project title", note: "TODO · One line about what they built.", photo: "" },
    { place: "3rd", prize: "Second runner-up", name: "TODO · Third place name", klass: "TODO · Class / Year", project: "TODO · Project title", note: "TODO · One line about what they built.", photo: "" },
    { place: "Special", prize: "Best UI", name: "TODO · Name", klass: "TODO · Class / Year", project: "TODO · Project title", note: "TODO · One line about what they built.", photo: "" },
    { place: "Special", prize: "Best idea", name: "TODO · Name", klass: "TODO · Class / Year", project: "TODO · Project title", note: "TODO · One line about what they built.", photo: "" },
  ],
  /* Top-line numbers shown under the winners. Fill in the real ones. */
  stats: [
    { value: "TODO", label: "Participants" },
    { value: "TODO", label: "Projects shown" },
    { value: "TODO", label: "Teams" },
  ],
};

export const TRACKS = [
  { id: "web", code: "01", title: "Web", text: "HTML, CSS, JavaScript and React — build real sites, not just tutorials." },
  { id: "app", code: "02", title: "Apps", text: "Android and cross-platform apps that solve a problem on our own campus." },
  { id: "data", code: "03", title: "Data & AI", text: "Python, data handling and small AI tools that actually run." },
  { id: "game", code: "04", title: "Games & 3D", text: "Three.js, game ideas and interactive visuals." },
];

export const STEPS = [
  { n: "1", title: "Join", text: "Follow the channel and message us on WhatsApp." },
  { n: "2", title: "Learn together", text: "Short sessions and shared notes, at a beginner pace." },
  { n: "3", title: "Build", text: "Pick a small project, team up, and ship it." },
  { n: "4", title: "Show", text: "Present at Techova and get on the winners wall." },
];

/* Upcoming event. Put the real date as "2026-MM-DDTHH:MM" to switch the
   countdown on; leave date empty to show "Date to be announced". */
export const UPCOMING = {
  name: "Technova 2026",
  date: "", /* TODO: e.g. "2026-12-15T10:00" */
  dateText: "Date to be announced", /* TODO: e.g. "15 December 2026" */
  venue: "Chhatrapati Shivajiraje Mahavidyalaya, Udgir",
  text: "The annual college tech festival is back: a bigger stage and more categories. Start building now and show it on the day.",
  highlights: [
    { title: "Project showcase", text: "Demo what you built in front of the whole college." },
    { title: "Coding challenge", text: "Solo and team rounds for every level." },
    { title: "Prizes & certificates", text: "Winners, runners-up and special mentions." },
  ],
  register: "", /* TODO: registration link (Google Form / WhatsApp). Falls back to WhatsApp. */
};

/* Order = card order. Replace each TODO with the real name / photo. */
export const TEAM = [
  { role: "President", name: "Omrushikesh Vijaykumar Raiwade", klass: "TODO · Class / Year", bio: "Leads the hub, plans sessions and represents students.", photo: "/devhub/president.jpg" },
  { role: "Technical Lead", name: "TODO · Technical lead name", klass: "TODO · Class / Year", bio: "Guides projects, reviews code and runs the build sessions.", photo: "" },
  { role: "Social Media Team", name: "TODO · Social media lead", klass: "TODO · Class / Year", bio: "Runs Instagram and WhatsApp, posts updates and event reels.", photo: "" },
];

/* Technical Lead spotlight (the person is TEAM[1]; their name and photo come from there). */
export const LEAD = {
  headline: "How we build projects at Dev Hub",
  lines: [
    "Sessions: TODO day & time",
    "Location: TODO room",
    "Ask me about: React, Python, Git",
  ],
  ring: "BUILD • SHIP • LEARN • SHARE • ",
};

/* About Technova (its own page: /devhub/technova). Edit freely. */
export const ABOUT_TECHNOVA = {
  title: "The college tech festival.",
  text: "Technova is our annual tech festival: one day where students show the projects they built, take on coding challenges and pitch ideas on a real stage. Everyone from beginners to final-year students is welcome.",
  points: [
    { title: "Project showcase", text: "Demo your app, site or gadget to the whole college." },
    { title: "Coding challenge", text: "Solo and team rounds for every level." },
    { title: "Idea pitch", text: "Two minutes to convince the judges." },
    { title: "Prizes", text: "Winners, runners-up and special mentions." },
  ],
};
