import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import logo from "./img/dnyansetu-logo.png";
import collegeLogo from "./img/college-logo.jpg";
import principalPhoto from "./img/principal.jpg";
import heroOne from "../media/slideshow 1.jpeg";
import heroTwo from "../media/slideshow 2.jpeg";
import heroThree from "../media/slideshow 3.jpeg";
/* The quiz carries the whole question bank, so it is split out of the main
   bundle and fetched only when a student actually opens it. */
const QuizPage = lazy(() => import("./quiz/QuizPage"));
const NotesPage = lazy(() => import("./notes/NotesPage"));
const LegalPage = lazy(() => import("./legal/LegalPage"));
import { generateTrackingId } from "./utils/identity";
import { downloadCsv, timestampedName } from "./utils/exportSheet";
import { isBackendConfigured } from "./lib/firebase";
import {
  signUp, signIn, signOut, getSession, onAuthChange, resetPassword,
  fetchProfile, updateProfile, listProfiles, adminUpdateProfile, adminDeleteProfile,
  markNotesOpened,
} from "./lib/profiles";
import { fetchMyNotes, uploadNote, deleteNote } from "./lib/notes";
import { uploadFile } from "./lib/cloudinary";
import { fetchAttempts } from "./lib/quizProgress";
import {
  newSessionId, claimAdminSession, beatAdminSession, releaseAdminSession,
  watchAdminSession, HEARTBEAT_MS,
} from "./lib/adminSession";
import { NOTE_STREAMS, SEMESTERS, ACCEPTED_NOTE_TYPES, formatBytes } from "./data/notes";
import {
  SCHOLARSHIP_CATEGORIES, scholarshipsFor, documentsFor, expandDocuments,
} from "./data/resources";
import { LANG_KEY, LangContext, useLang, makeTr } from "./lib/i18n";
import {
  Mail, Phone, Lock, User, ArrowRight, ArrowLeft, CheckCircle2, Users, Award, Linkedin, GraduationCap,
  Code2, Compass, MessageSquare, LogOut, MapPin, X, Loader2, Target, Shield, ExternalLink,
  FileText, Edit3, Trash2, Ban, Sparkles, BookOpen, ImagePlus, BarChart3,
  Info, Facebook, Instagram, CalendarDays, Search, Droplet, ClipboardList, ListChecks, Coins, HandHeart,
  ScrollText, NotebookPen, Download, ChevronRight, FileDown, AlertTriangle, Newspaper, Megaphone,
  Languages, Menu,
} from "lucide-react";

/* ============================================================================
   DnyanSetu — Career Readiness & Skills Assessment Platform
   Hackathon 2026-27 · Chhatrapati Shivajiraje Mahavidyalaya, Udgir
   ABC Portal Inspired Color Palette & Multi-Color Animations
   ========================================================================== */

/* -------------------------- Host Institution Identity -------------------------- */

/* Official college social accounts. Paste the real URLs here and the footer
   picks them up — nothing else needs changing. */
const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/share/17TjVBVUnr/?mibextid=wwXIfr",
  instagram: "https://www.instagram.com/chh.shivajirajemahavidyalaya?igsi=MTJzdms3am1mZWo0bQ==",
  linkedin: "https://www.linkedin.com/school/shivaji-mahavidyalaya-udgir/",
};

/* The single administrator. The database enforces this too — see admin_email()
   in firestore.rules — so changing it here alone grants nothing. */
const ADMIN_EMAIL = "smuiqac@gmail.com";

/* Used only while the app runs on offline seed data, so that the admin screens
   can be opened before Firebase is connected. It guards nothing real — once
   the keys are in .env.local the password is the one held by Firebase Auth. */
const DEMO_ADMIN_PASSWORD = "pass@123";

/* The principal's message on the landing page.

   The photograph is src/img/principal.jpg — cropped square around the face from
   the original in media/, so the circular frame reads as a portrait. If it is
   ever removed, his initials show in its place and the section still looks
   deliberate. */
const PRINCIPAL = {
  name: "Dr. R. M. Manjre",
  title: "Principal",
  titleMr: "प्राचार्य",
  photo: principalPhoto,
  quote:
    "Education underpins all social progress. Our aim is to harness technology to make learning, assessment and skill growth visible to anyone, anywhere — in a way that is practical, explainable and free to access.",
  quoteMr:
    "शिक्षण हा सर्व सामाजिक प्रगतीचा पाया आहे. अध्ययन, मूल्यमापन आणि कौशल्य विकास कोणालाही, कोठूनही, व्यावहारिक, समजण्यास सोप्या आणि मोफत पद्धतीने उपलब्ध करून देण्यासाठी तंत्रज्ञानाचा वापर करणे हे आमचे ध्येय आहे.",
};

/* The college's own question paper archive. It covers UG and PG across every
   semester and is kept up to date by the college, so the app links to it rather
   than mirroring it. */
const PYQ_OFFICIAL_URL = "https://shivajicollegeudgir.in/previous-question-papers/";

/* Notes and practice tests are for enrolled users: notes are faculty material
   and quiz attempts are recorded against an account. Everything else on the
   landing page — question papers, scholarships, RaktSetu — stays open, so a
   prospective student can still see what the college offers. */
const MEMBERS_ONLY_PAGES = new Set(["notes", "quiz"]);

/* Where the reader was, kept across a refresh. The Firebase session already
   survives a reload; the view did not, so a refresh dropped everyone back on
   the landing page and looked like being signed out. Per-tab (sessionStorage)
   rather than shared, so two tabs do not fight over one another's position. */
const VIEW_KEY = "dnyansetu:view";

/* A restored view still has to be one this account may actually open — a stale
   entry must never hand out a portal the user has no right to. */
function mayOpenView(view, profile) {
  if (!view || view === "auth") return false;
  if (MEMBERS_ONLY_PAGES.has(view)) return Boolean(profile);
  if (view === "profile") return profile?.role === "student";
  if (view === "faculty-portal" || view === "faculty-setup") return profile?.role === "faculty";
  if (view === "admin-portal") return profile?.role === "admin";
  return true;
}

const INSTITUTION = {
  trust: "Kisan Shikshan Prasarak Mandal's",
  trustMr: "किसान शिक्षण प्रसारक मंडळाचे",
  name: "Chhatrapati Shivajiraje Mahavidyalaya, Udgir",
  nameMr: "छत्रपती शिवाजीराजे महाविद्यालय, उदगीर",
  short: "Chhatrapati Shivajiraje Mahavidyalaya",
  shortMr: "छत्रपती शिवाजीराजे महाविद्यालय",
  formerly: "Formerly Shivaji Mahavidyalaya, Udgir",
  formerlyMr: "पूर्वीचे शिवाजी महाविद्यालय, उदगीर",
  place: "Udgir, Dist. Latur, Maharashtra",
  placeMr: "उदगीर, जि. लातूर, महाराष्ट्र",
  affiliation: "Affiliated to SRTM University",
  affiliationMr: "एस.आर.टी.एम. विद्यापीठाशी संलग्न",
  accreditation: "NAAC A+ (3.27)",
  established: "1968",
  website: "https://shivajicollegeudgir.in/",
};

/* --------------------------- External / Partner Links --------------------------- */

/* RaktSetu blood-donation app. Paste the published app link here and the Social
   Services card turns into a live link automatically. */
const RAKTSETU_APP_URL = "";

/* CSM News Desk. Paste the published site link here once it's live and the
   card turns into a live link automatically, same as RaktSetu above. */
const CSM_NEWS_DESK_URL = "https://csmnewsdesk.com/";

/* ---------------------------- Notice Board -----------------------------------
   Homepage "Notices & Announcements" strip, styled like a college/government
   site notice board. status is "live" (green, links to href) or "soon" (amber,
   no link). Add real notices here as they come up. */
const NOTICE_BOARD = [
  {
    id: "csm-news-desk",
    title: "CSM News Desk is live — college announcements, events and press coverage in one feed.",
    titleMr: "सीएसएम न्यूज डेस्क सुरू झाले आहे — महाविद्यालयाच्या सूचना, कार्यक्रम आणि प्रसिद्धी एकाच ठिकाणी.",
    date: "18 Sep 2026",
    status: "live",
    href: CSM_NEWS_DESK_URL,
  },
  {
    id: "raktsetu",
    title: "RaktSetu, our student blood-donation network, is coming soon.",
    titleMr: "रक्तसेतू, आमचे विद्यार्थी रक्तदान नेटवर्क, लवकरच सुरू होत आहे.",
    date: "18 Sep 2026",
    status: "soon",
  },
];

/* ------------------------- Landing Hubs (Study / Career / Social) -------------------------
   One catalog drives three things: the landing hub sections, the nav search index,
   and the deep-link scroll targets. Add an entry here and it shows up in all three. */

const LANDING_HUBS = [
  {
    id: "study",
    label: "Study",
    labelMr: "अभ्यास",
    eyebrow: "Study Hub",
    eyebrowMr: "अभ्यास केंद्र",
    icon: BookOpen,
    title: "Everything you need to actually study, in one place",
    titleMr: "अभ्यासासाठी लागणारे सर्व काही, एकाच ठिकाणी",
    intro:
      "Notes, papers and practice built around your syllabus — so revision starts with the right material instead of a search for it.",
    introMr:
      "तुमच्या अभ्यासक्रमानुसार नोट्स, प्रश्नपत्रिका आणि सराव — त्यामुळे उजळणी शोधण्यात वेळ न घालवता योग्य साहित्यानेच सुरू होते.",
    items: [
      {
        id: "subject-notes",
        name: "Subject-wise Notes",
        nameMr: "विषयनिहाय नोट्स",
        icon: NotebookPen,
        blurb: "Unit-wise notes uploaded by your faculty, sorted by branch, semester and subject.",
        blurbMr: "तुमच्या प्राध्यापकांनी अपलोड केलेल्या युनिटनिहाय नोट्स, शाखा, सत्र आणि विषयानुसार वर्गीकृत.",
        keywords: "notes subject unit chapter syllabus handwritten study material pdf download bsc bca bcom ba",
        page: "notes",
      },
      {
        id: "question-papers",
        name: "Question Papers",
        nameMr: "प्रश्नपत्रिका",
        icon: ScrollText,
        blurb: "Previous-year university papers sorted by subject and semester.",
        blurbMr: "मागील वर्षांच्या विद्यापीठ प्रश्नपत्रिका, विषय आणि सत्रानुसार वर्गीकृत.",
        keywords: "question paper previous year pyq semester exam university srtmun",
        page: "pyq",
      },
      {
        id: "quizzes",
        name: "Quiz & Practice Tests",
        nameMr: "क्विझ आणि सराव चाचण्या",
        icon: ClipboardList,
        blurb:
          "Beginner, Intermediate and Advanced practice sets for your year and branch — clear all three to unlock the final exam.",
        blurbMr:
          "तुमच्या वर्ष आणि शाखेसाठी नवशिक्या, मध्यम आणि प्रगत पातळीचे सराव संच — तिन्ही उत्तीर्ण झाल्यावर अंतिम परीक्षा खुली होते.",
        keywords:
          "quiz quizzes practice test practice set mcq objective multiple choice online test mock exam beginner intermediate advanced level bsc bca bcom computer science",
        page: "quiz",
      },
    ],
  },
  {
    id: "social",
    label: "Social Services",
    labelMr: "सामाजिक सेवा",
    eyebrow: "Social Services",
    eyebrowMr: "सामाजिक सेवा",
    icon: HandHeart,
    title: "Campus support that goes beyond the classroom",
    titleMr: "वर्गाच्या पलीकडे जाणारी विद्यार्थी मदत",
    intro:
      "Student-led service and financial support, so nobody drops off the path for reasons that have nothing to do with ability.",
    introMr:
      "विद्यार्थ्यांनी चालवलेली सेवा आणि आर्थिक मदत, जेणेकरून क्षमतेशिवाय इतर कोणत्याही कारणाने कोणाचीही शिक्षणाची वाट अडू नये.",
    items: [
      {
        id: "raktsetu",
        name: "RaktSetu",
        nameMr: "रक्तसेतू",
        icon: Droplet,
        blurb: "Our student blood-donation network — connect donors to urgent requests.",
        blurbMr: "आमचे विद्यार्थी रक्तदान नेटवर्क — रक्तदात्यांना तातडीच्या गरजांशी जोडते.",
        keywords: "raktsetu blood donation donor rakt setu emergency camp health",
        href: RAKTSETU_APP_URL,
        cta: "Open RaktSetu app",
        ctaMr: "रक्तसेतू अ‍ॅप उघडा",
        pendingNote: "App link coming soon",
        pendingNoteMr: "अ‍ॅपची लिंक लवकरच उपलब्ध होईल",
      },
      {
        id: "csm-news-desk",
        name: "CSM News Desk",
        nameMr: "सीएसएम न्यूज डेस्क",
        icon: Newspaper,
        blurb: "College announcements, events and press coverage in one feed.",
        blurbMr: "महाविद्यालयाच्या सूचना, कार्यक्रम आणि प्रसिद्धी एकाच फीडमध्ये.",
        keywords: "csm news desk announcements events press college updates",
        href: CSM_NEWS_DESK_URL,
        cta: "Open CSM News Desk",
        ctaMr: "सीएसएम न्यूज डेस्क उघडा",
        pendingNote: "Coming soon",
        pendingNoteMr: "लवकरच उपलब्ध होईल",
      },
      {
        id: "scholarships",
        name: "Scholarships",
        nameMr: "शिष्यवृत्ती",
        icon: Coins,
        blurb: "Government and institutional scholarships with eligibility and deadlines.",
        blurbMr: "पात्रता आणि अंतिम तारखांसह शासकीय आणि संस्थात्मक शिष्यवृत्ती.",
        keywords: "scholarship scholarships financial aid fee waiver freeship stipend grant",
        page: "scholarships",
      },
    ],
  },
];

/* Flat index the nav search runs against: the items inside each hub. The hubs
   themselves are deliberately not indexed — "Study" and "Social Services" only
   ever matched as vague section headings and pushed the real destinations down. */
const SEARCH_INDEX = LANDING_HUBS.flatMap((hub) => [
  ...hub.items.map((item) => ({
    key: `${hub.id}-${item.id}`,
    title: item.name,
    subtitle: item.blurb,
    section: hub.label,
    icon: item.icon,
    targetId: `hub-${hub.id}-${item.id}`,
    page: item.page || null,
    haystack: `${item.name} ${item.blurb} ${item.keywords} ${hub.label}`.toLowerCase(),
  })),
]);

function searchLanding(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return SEARCH_INDEX.filter((entry) => terms.every((term) => entry.haystack.includes(term))).slice(0, 8);
}

/* ---------------------------------- Seed Data ---------------------------------- */

/* Hero slideshow — photographs of the college itself, imported from media/ so
   they are bundled and versioned with the build rather than fetched from a
   third party at page load. To swap one, drop the picture in media/, import it
   at the top of this file, and point the entry at it. */
const HERO_SLIDES = [
  { id: 1, image: heroOne, alt: "The Shivaji Mahavidyalaya entrance arch, with NCC cadets lined up along a red carpet for a ceremonial welcome" },
  { id: 2, image: heroTwo, alt: "Faculty members touring the Botany department museum, its cabinets filled with microscopes and glassware" },
  { id: 3, image: heroThree, alt: "A full college auditorium, with guests seated at the front and students filling the hall behind them" },
];

const SEED_USERS = [
  {
    id: "admin-1",
    role: "admin",
    name: "Omrushikesh Vijaykumar Raiwade",
    email: ADMIN_EMAIL,
    qualification: "Platform Administrator",
    university: "SRTM University, Nanded",
    college: INSTITUTION.name,
    status: "active",
    restricted: false,
    joined: Date.now() - 1000 * 60 * 60 * 24 * 90
  },
  {
    id: "fac-1",
    role: "faculty",
    name: "Prof. Rajesh Sharma",
    email: "dr.sharma@arcsas.edu",
    designation: "Associate Professor",
    department: "Physics & Nanotechnology",
    qualification: "Ph.D. in Applied Physics (IIT Bombay)",
    specialization: "Electromagnetism, Quantum Optics",
    orcid: "0000-0002-1825-0097",
    googleScholar: "https://scholar.google.com/citations?user=sample_sharma",
    linkedin: "https://www.linkedin.com/in/prof-rajesh-sharma",
    pfp: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
    university: "SRTM University, Nanded",
    college: "Department of Physics",
    status: "active",
    restricted: false,
    joined: Date.now() - 1000 * 60 * 60 * 24 * 60
  },
  {
    id: "stu-1",
    role: "student",
    name: "Priya Kulkarni",
    email: "student@arcsas.edu",
    degree: "B.Tech",
    branch: "Computer Science & Engineering",
    gradYear: "2026",
    gender: "Female",
    college: INSTITUTION.name,
    university: "SRTM University, Nanded",
    studentIdNum: "CS-2026-104",
    trackingId: "LTR-STU-OM-001",
    status: "active",
    restricted: false,
    achievements: ["DSA Champ", "Fast Thinker"],
    joined: Date.now() - 1000 * 60 * 60 * 24 * 30
  }
];

const GOAL_OPTIONS = [
  "Build technical skills",
  "Prepare for placements",
  "Explore career options",
  "Improve academic performance",
  "Build projects",
  "Prepare for competitive opportunities",
  "Discover interests"
];

const ACADEMIC_STAGE_OPTIONS = ["First Year", "Second Year", "Third Year", "Graduate / Other"];
const DOMAIN_OPTIONS = [
  { label: "Computer Science", interests: ["Programming", "Python", "Web Development", "Data Structures", "AI / ML", "Database Systems"] },
  { label: "Electronics", interests: ["Embedded Systems", "Circuit Design", "Signal Processing", "IoT", "Robotics"] },
  { label: "Physics", interests: ["Electromagnetism", "Research", "Quantum Concepts", "Experimental Methods", "Data Analysis"] },
  { label: "General Engineering", interests: ["Problem Solving", "Projects", "Communication", "Leadership", "Innovation"] },
];
const CAREER_OPTIONS = [
  "Software Developer",
  "Full Stack Developer",
  "Data / AI",
  "Cybersecurity",
  "Research",
  "Entrepreneurship",
  "Higher Studies",
  "Government / Competitive Exams",
  "Not sure yet"
];
const SKILL_CHIPS = [
  "Programming",
  "Web Development",
  "Problem Solving",
  "Databases",
  "AI",
  "Cybersecurity",
  "Communication",
  "Leadership",
  "Project Management",
  "Data Structures",
  "Python",
  "Research"
];

function normalizeStudentProfile(student = {}) {
  return {
    ...student,
    academicStage: student.academicStage || "Second Year",
    mainGoal: student.mainGoal || "Build technical skills",
    domain: student.domain || "Computer Science",
    interests: Array.isArray(student.interests) ? student.interests : [],
    skills: Array.isArray(student.skills) ? student.skills : [],
    careerDirection: student.careerDirection || "Not sure yet",
    learningPreferences: student.learningPreferences || [],
    onboardingCompleted: Boolean(student.onboardingCompleted),
    awardedActivities: student.awardedActivities || {},
  };
}

function buildProfileSummary(student) {
  const normalized = normalizeStudentProfile(student);
  const parts = [];
  if (normalized.domain) parts.push(normalized.domain);
  if (normalized.academicStage) parts.push(normalized.academicStage);
  if (normalized.careerDirection && normalized.careerDirection !== "Not sure yet") parts.push(normalized.careerDirection);
  if (normalized.mainGoal) parts.push(normalized.mainGoal.toLowerCase());
  const domainText = normalized.domain ? `${normalized.domain} student` : "student";
  const goalText = normalized.mainGoal ? `focused on ${normalized.mainGoal.toLowerCase()}` : "focused on growth";
  const careerText = normalized.careerDirection && normalized.careerDirection !== "Not sure yet"
    ? `and exploring ${normalized.careerDirection.toLowerCase()}`
    : "and building clarity on next steps";
  return `${domainText} ${goalText} ${careerText}.`;
}

function generateStudentRecommendations(student) {
  const normalized = normalizeStudentProfile(student);
  const interestSet = new Set([...normalized.interests, ...normalized.skills]);
  const recommendations = [];

  if (normalized.domain === "Computer Science" || interestSet.has("Programming") || interestSet.has("Web Development")) {
    recommendations.push({ id: "dsa-practice", title: "Data Structures Practice", type: "Practice", reason: "Build core problem-solving confidence for placement preparation." });
    recommendations.push({ id: "web-fundamentals", title: "JavaScript Fundamentals", type: "Learning", reason: "Aligns with your web development and internship goals." });
  }

  if (normalized.mainGoal === "Prepare for placements" || normalized.careerDirection !== "Not sure yet") {
    recommendations.push({ id: "placement-readiness", title: "Placement Readiness Sprint", type: "Assessment", reason: "Improves faster decision-making for interviews and problem-solving rounds." });
  }

  if (normalized.mainGoal === "Build projects" || interestSet.has("Project Management")) {
    recommendations.push({ id: "project-idea", title: "Project Milestone Plan", type: "Project", reason: "Helps turn your interests into a real portfolio-ready outcome." });
  }

  if (normalized.domain === "Physics" || interestSet.has("Research")) {
    recommendations.push({ id: "research-ops", title: "Research Methods Review", type: "Learning", reason: "Supports higher-study and applied science pathways." });
  }

  if (recommendations.length === 0) {
    recommendations.push({ id: "starter-roadmap", title: "Skill Foundations", type: "Practice", reason: "A balanced first step for a strong learning foundation." });
  }

  return recommendations.slice(0, 4);
}

function RoleBadge({ role }) {
  const r = (role || "student").toLowerCase();
  const label = r === "admin" ? "ADMIN" : r === "faculty" ? "FACULTY" : "STUDENT";
  return <span className={`role-chip role-${r}`}>{label}</span>;
}

function Field({ label, icon: Icon, ...props }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <span className="field-input-wrap">
        {Icon && <Icon size={16} className="field-icon" />}
        <input className="field-input" {...props} />
      </span>
    </label>
  );
}

function SelectField({ label, icon: Icon, options, ...props }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      <span className="field-input-wrap">
        {Icon && <Icon size={16} className="field-icon" />}
        <select className="field-input" {...props}>
          {options.map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

function BrandLogo({ variant = "mark", className = "", alt = "DnyanSetu logo" }) {
  return (
    <span className={`brand-logo-frame brand-logo-frame--${variant} ${className}`.trim()}>
      <img src={logo} alt={alt} className="brand-logo-image" draggable={false} />
    </span>
  );
}

/* Host-institution emblem. The source crest sits on a white plate, so it is framed
   in a white chip that reads cleanly on both light surfaces and the navy shells. */
function CollegeCrest({ size = 34, className = "" }) {
  return (
    <span
      className={`college-crest ${className}`.trim()}
      style={{ width: size, height: size, flex: `0 0 ${size}px` }}
    >
      <img src={collegeLogo} alt={`${INSTITUTION.name} emblem`} draggable={false} />
    </span>
  );
}

/* Crest + institution name, used in the landing banner, auth panel and footer.
   `tr` is optional — pages outside the three translated views (see lib/i18n.js)
   simply omit it and get the English copy, same as before. */
function InstitutionLockup({ size = 34, tone = "light", showMeta = true, className = "", tr }) {
  const t = tr || ((en) => en);
  return (
    <span className={`institution-lockup institution-lockup--${tone} ${className}`.trim()}>
      <CollegeCrest size={size} />
      <span className="institution-lockup-copy">
        <small className="institution-trust">{t(INSTITUTION.trust, INSTITUTION.trustMr)}</small>
        <strong className="institution-name">{t(INSTITUTION.name, INSTITUTION.nameMr)}</strong>
        {showMeta && (
          <small className="institution-meta">
            {t(INSTITUTION.place, INSTITUTION.placeMr)} · {t(INSTITUTION.affiliation, INSTITUTION.affiliationMr)}
          </small>
        )}
      </span>
    </span>
  );
}

/* =============================== VIEW: Landing Page ============================== */

function Landing({ goAuth, onOpenAbout, onOpenPage }) {
  const { lang, setLang } = useLang();
  const tr = makeTr(lang);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchWrapRef = useRef(null);
  const searchResults = searchLanding(searchQuery);

  /* Nav floats free of the top edge once the page has scrolled past the
     identity strip, the way ux4g.gov.in's nav condenses on scroll. */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Jump to a hub card, then flash it so the eye lands in the right place. */
  const scrollToCard = (targetId) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(targetId);
    window.setTimeout(() => setHighlightId((current) => (current === targetId ? null : current)), 2400);
  };

  const goToSearchResult = (result) => {
    setSearchOpen(false);
    setSearchQuery("");
    /* Items that own a full page open it; everything else scrolls to its card. */
    if (result.page) onOpenPage(result.page);
    else scrollToCard(result.targetId);
  };

  /* Close the suggestion panel on any click outside the search field. */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const onPointerDown = (event) => {
      if (!searchWrapRef.current?.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev === HERO_SLIDES.length - 1 ? 0 : prev + 1));
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="alison-landing">
      <div className="landing-bg-mesh" aria-hidden="true">
        <span className="landing-orb landing-orb-1" />
        <span className="landing-orb landing-orb-2" />
        <span className="landing-orb landing-orb-3" />
      </div>

      <div className={`nav-topstrip ${isScrolled ? "is-collapsed" : ""}`}>
        <span className="nav-topstrip-text">
          <span className="nav-topstrip-trust">{tr(INSTITUTION.trust, INSTITUTION.trustMr)}</span>
          <span className="nav-topstrip-dot" aria-hidden="true" />
          <span className="nav-topstrip-name">{tr(INSTITUTION.name, INSTITUTION.nameMr)}</span>
        </span>
      </div>

      <nav className={`nav-marketing anim-nav-enter ${isScrolled ? "is-floating" : ""}`}>
        <div className="nav-gov-brand">
          <CollegeCrest size={38} />
          <span className="landing-brand-divider" aria-hidden="true" />
          <div className="brand brand-logo-inline landing-brand-wrap" aria-label="DnyanSetu brand">
            <BrandLogo variant="nav" />
            <div className="landing-brand-copy">
              <span className="landing-brand-name">DnyanSetu</span>
              <span className="landing-brand-tag">connecting futures</span>
            </div>
          </div>
        </div>

        <div className="nav-lang-switch" role="group" aria-label="Choose language / भाषा निवडा">
          <button
            type="button"
            className={`nav-lang-btn ${lang === "en" ? "is-active" : ""}`}
            onClick={() => setLang("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`nav-lang-btn ${lang === "mr" ? "is-active" : ""}`}
            onClick={() => setLang("mr")}
          >
            मराठी
          </button>
        </div>

        <button
          type="button"
          className="nav-menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileMenuOpen((v) => !v)}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={`nav-collapse ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="nav-search" ref={searchWrapRef}>
          <div className={`nav-search-field ${searchOpen && searchResults.length ? "is-open" : ""}`}>
            <Search size={16} className="nav-search-icon" />
            <input
              type="text"
              className="nav-search-input"
              placeholder={tr("What do you want to search for?", "तुम्हाला काय शोधायचे आहे?")}
              aria-label="Search notes, papers, careers and services"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
                if (e.key === "Enter" && searchResults.length) goToSearchResult(searchResults[0]);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="nav-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="nav-search-panel" role="listbox">
              {searchResults.length ? (
                searchResults.map((result) => {
                  const ResultIcon = result.icon;
                  return (
                    <button
                      key={result.key}
                      type="button"
                      className="nav-search-result"
                      role="option"
                      onClick={() => goToSearchResult(result)}
                    >
                      <span className="nav-search-result-icon"><ResultIcon size={15} /></span>
                      <span className="nav-search-result-copy">
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                      <span className="nav-search-result-tag">{result.section}</span>
                    </button>
                  );
                })
              ) : (
                <div className="nav-search-empty">
                  {tr(
                    `No match for "${searchQuery.trim()}". Try notes, PDFs, quizzes, scholarships or exams.`,
                    `"${searchQuery.trim()}" साठी काहीही सापडले नाही. नोट्स, पीडीएफ, क्विझ, शिष्यवृत्ती किंवा परीक्षा शोधून पहा.`,
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="nav-actions">
          <button type="button" className="nav-staff-link" onClick={() => { setMobileMenuOpen(false); goAuth("login", "staff"); }}>
            <Shield size={13} /> <span>{tr("Staff Login", "कर्मचारी लॉगिन")}</span>
          </button>
          <button className="btn btn-primary" onClick={() => { setMobileMenuOpen(false); goAuth("login"); }}>{tr("Log in", "लॉग इन")}</button>
        </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero hero-alison">
        <div className="hero-welcome anim-fade-up">
          <span className="hero-welcome-eyebrow">
            <Sparkles size={13} /> {tr("Your gateway to learning", "अध्ययनाचे प्रवेशद्वार")}
          </span>
          <h1 className="hero-welcome-title">
            {tr("Welcome to ", "आपले स्वागत आहे ")}
            <span className="hero-welcome-brand">DnyanSetu</span>
          </h1>
          <span className="hero-welcome-rule" aria-hidden="true" />
        </div>

        <div className="hero-slider anim-fade-up anim-delay-1">
          <div className="hero-slider-frame">
            {HERO_SLIDES.map((slide, index) => (
              <img
                key={slide.id}
                src={slide.image}
                alt={slide.alt}
                className={`hero-slide ${index === activeHeroSlide ? "is-active" : ""}`}
                draggable={false}
              />
            ))}

            <div className="hero-slider-caption">
              <span className="hero-slider-caption-count">
                {String(activeHeroSlide + 1).padStart(2, "0")} / {String(HERO_SLIDES.length).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="hero-slider-dots">
            {HERO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`hero-slider-dot ${index === activeHeroSlide ? "is-active" : ""}`}
                aria-label={`Show image ${index + 1}`}
                onClick={() => setActiveHeroSlide(index)}
              />
            ))}
          </div>
        </div>

        <div className="hero-actions anim-fade-up anim-delay-3">
          <button className="btn btn-primary btn-lg" onClick={() => goAuth("signup")}>
            {tr("Get Started", "सुरुवात करा")} <ArrowRight size={18} />
          </button>
        </div>
      </header>

      {/* Notice Board — government/college-site style announcements */}
      <section className="section section-notice-board anim-fade-up">
        <div className="notice-board">
          <div className="notice-board-head">
            <Megaphone size={16} />
            <h2>{tr("Notices & Announcements", "सूचना आणि घोषणा")}</h2>
          </div>
          <div className="notice-board-list">
            {NOTICE_BOARD.map((item) => {
              const Row = item.href ? "a" : "div";
              return (
                <Row
                  className="notice-item"
                  key={item.id}
                  {...(item.href ? { href: item.href, target: "_blank", rel: "noreferrer" } : {})}
                >
                  <span className={`notice-status notice-status--${item.status}`}>
                    {item.status === "live" ? tr("Live", "सुरू") : tr("Coming soon", "लवकरच")}
                  </span>
                  <span className="notice-item-body">
                    <span className="notice-item-title">{tr(item.title, item.titleMr)}</span>
                    <span className="notice-item-date">{item.date}</span>
                  </span>
                  {item.href && <ExternalLink size={14} className="notice-item-arrow" />}
                </Row>
              );
            })}
          </div>
        </div>
      </section>

      {/* Study · Career · Social Services hubs — also the targets of the nav search */}
      {LANDING_HUBS.map((hub) => {
        const HubIcon = hub.icon;
        const isScheme = hub.id === "social";
        return (
          <section
            className={`section section-hub section-hub--${hub.id} ${highlightId === `hub-${hub.id}` ? "is-highlighted" : ""}`}
            id={`hub-${hub.id}`}
            key={hub.id}
          >
            <div className="hub-header">
              <p className="section-eyebrow"><HubIcon size={14} /> {tr(hub.eyebrow, hub.eyebrowMr)}</p>
              <h2 className="section-title hub-title">{tr(hub.title, hub.titleMr)}</h2>
              <p className="hub-intro">{tr(hub.intro, hub.introMr)}</p>
            </div>

            <div className={isScheme ? "service-list" : "hub-grid"}>
              {hub.items.map((item, index) => {
                const ItemIcon = item.icon;
                const cardId = `hub-${hub.id}-${item.id}`;
                const isLive = Boolean(item.href);
                const btnClass = isScheme ? "service-row-btn" : "hub-card-link";
                const openLabel = tr("Open", "उघडा");
                const action = item.page ? (
                  <button className={btnClass} type="button" onClick={() => onOpenPage(item.page)}>
                    {openLabel} <ArrowRight size={14} />
                  </button>
                ) : item.href !== undefined ? (
                  isLive ? (
                    <a className={btnClass} href={item.href} target="_blank" rel="noreferrer">
                      {tr(item.cta, item.ctaMr) || openLabel} <ExternalLink size={14} />
                    </a>
                  ) : (
                    <span className={isScheme ? "service-row-pending" : "hub-card-pending"}>
                      {tr(item.pendingNote, item.pendingNoteMr) || tr("Coming soon", "लवकरच")}
                    </span>
                  )
                ) : (
                  <button className={btnClass} type="button" onClick={() => goAuth("signup")}>
                    {openLabel} <ArrowRight size={14} />
                  </button>
                );

                return isScheme ? (
                  <article
                    className={`service-row ${highlightId === cardId ? "is-highlighted" : ""}`}
                    id={cardId}
                    key={item.id}
                  >
                    <span className="service-row-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="service-row-icon"><ItemIcon size={18} /></span>
                    <div className="service-row-body">
                      <h3>{tr(item.name, item.nameMr)}</h3>
                      <p>{tr(item.blurb, item.blurbMr)}</p>
                    </div>
                    <div className="service-row-action">{action}</div>
                  </article>
                ) : (
                  <article
                    className={`hub-card ${highlightId === cardId ? "is-highlighted" : ""}`}
                    id={cardId}
                    key={item.id}
                  >
                    <div className="hub-card-icon"><ItemIcon size={20} /></div>
                    <div className="hub-card-body">
                      <h3>{tr(item.name, item.nameMr)}</h3>
                      <p>{tr(item.blurb, item.blurbMr)}</p>
                      {action}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="section section-story">
        <div className="story-shell">
          {/* The photograph leads, with the message beside it. */}
          <figure className="principal-figure">
            {PRINCIPAL.photo ? (
              <img src={PRINCIPAL.photo} alt={`${PRINCIPAL.name}, ${PRINCIPAL.title}`} className="principal-photo" />
            ) : (
              <div className="principal-photo principal-photo-initials" aria-hidden="true">
                {PRINCIPAL.name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("")}
              </div>
            )}
            <figcaption className="principal-caption">
              <strong>{PRINCIPAL.name}</strong>
              <span>{tr(PRINCIPAL.title, PRINCIPAL.titleMr)}</span>
              <small>{tr(INSTITUTION.short, INSTITUTION.shortMr)}</small>
            </figcaption>
          </figure>

          <div className="story-copy">
            <div className="story-badge">
              <Sparkles size={14} /> {tr("From the Principal", "प्राचार्यांकडून")}
            </div>
            <blockquote className="principal-quote">
              <span className="principal-mark" aria-hidden="true">&ldquo;</span>
              <p>{tr(PRINCIPAL.quote, PRINCIPAL.quoteMr)}</p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Professional Functional Footer with Social Links */}
      <footer className="site-footer">
        <div className="site-footer-glow" aria-hidden="true" />

        <div className="site-footer-inner">
          {/* Identity: the platform, then the institution behind it. */}
          <div className="footer-identity">
            <div className="footer-brand">
              <BrandLogo variant="footer" />
              <div className="footer-brand-copy">
                <span className="footer-brand-name">DnyanSetu</span>
                <span className="footer-brand-slogan">connecting futures</span>
              </div>
            </div>

            <div className="footer-college">
              <CollegeCrest size={46} />
              <div className="footer-college-copy">
                <small>{tr(INSTITUTION.trust, INSTITUTION.trustMr)}</small>
                <strong>{tr(INSTITUTION.name, INSTITUTION.nameMr)}</strong>
                <small>{tr(INSTITUTION.affiliation, INSTITUTION.affiliationMr)} · {INSTITUTION.accreditation}</small>
              </div>
            </div>
          </div>

          <div className="footer-columns">
            <nav className="footer-col" aria-label="Support">
              <h4>{tr("Support", "सहाय्य")}</h4>
              <button type="button" className="footer-link" onClick={onOpenAbout}>{tr("About DnyanSetu", "डायनसेतू विषयी")}</button>
              <button type="button" className="footer-link" onClick={() => onOpenPage("privacy")}>{tr("Privacy Policy", "गोपनीयता धोरण")}</button>
              <button type="button" className="footer-link" onClick={() => onOpenPage("terms")}>{tr("Terms of Service", "सेवा अटी")}</button>
            </nav>

            <address className="footer-col">
              <h4>{tr("Contact", "संपर्क")}</h4>
              <a href="mailto:smuiqac@gmail.com" className="footer-link">
                <Mail size={14} /> smuiqac@gmail.com
              </a>
              <a href="tel:+919850757663" className="footer-link">
                <Phone size={14} /> +91 98507 57663
              </a>
              <a href={INSTITUTION.website} target="_blank" rel="noopener noreferrer" className="footer-link">
                <ExternalLink size={14} /> shivajicollegeudgir.in
              </a>
              <span className="footer-link is-static">
                <MapPin size={14} /> {tr(INSTITUTION.place, INSTITUTION.placeMr)}
              </span>
            </address>

            <div className="footer-col">
              <h4>{tr("Connect & Social", "जोडा आणि सोशल")}</h4>
              {/* Paste the real accounts into SOCIAL_LINKS near the top of this file. */}
              <div className="footer-socials">
                <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" className="footer-social social-fb" aria-label="Facebook">
                  <Facebook size={17} /><span>Facebook</span>
                </a>
                <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" className="footer-social social-ig" aria-label="Instagram">
                  <Instagram size={17} /><span>Instagram</span>
                </a>
                <a href={SOCIAL_LINKS.linkedin} target="_blank" rel="noreferrer" className="footer-social social-li" aria-label="LinkedIn">
                  <Linkedin size={17} /><span>LinkedIn</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="site-footer-bar">
          <span>{tr(
            `DnyanSetu · ${INSTITUTION.name}. All rights reserved.`,
            `डायनसेतू · ${INSTITUTION.nameMr}. सर्व हक्क राखीव.`,
          )}</span>
          <span className="footer-author">
            {tr("Built by", "यांनी तयार केले")}{" "}
            <a
              href="https://portfolio-zeta-one-nhmx6ncw7b.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-author-link"
              title="View portfolio"
            >
              <strong>Omrushikesh Vijaykumar Raiwade</strong> <ExternalLink size={12} className="footer-author-link-icon" />
            </a>
          </span>
        </div>
      </footer>

      {/* Footer Info Modals */}
    </div>
  );
}

/* =============================== VIEW: About Page ============================== */

function AboutPage({ onBack }) {
  const { lang } = useLang();
  const tr = makeTr(lang);
  return (
    <div className="about-page-shell">
      <div className="about-page-hero">
        <button className="btn btn-ghost about-page-back" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> {tr("Back to Home", "मुख्यपृष्ठावर परत जा")}
        </button>

        <div className="about-page-hero-grid">
          <div className="about-page-copy">
            <p className="section-eyebrow"><Info size={14} /> {tr("About DnyanSetu", "डायनसेतू विषयी")}</p>
            <h1>{tr(
              "Everything a student needs to revise, in one place — put there by their own faculty.",
              "विद्यार्थ्याला उजळणीसाठी लागणारे सर्व काही एका ठिकाणी — त्यांच्याच प्राध्यापकांनी तिथे ठेवलेले.",
            )}</h1>
            <p>
              {tr(
                "DnyanSetu brings a college's study material and self-assessment into one place: subject notes uploaded by faculty, previous-year question papers, level-based practice tests, and the scholarship information students most often miss.",
                "डायनसेतू महाविद्यालयाचे अभ्यास साहित्य आणि स्वयं-मूल्यमापन एकाच ठिकाणी आणते: प्राध्यापकांनी अपलोड केलेल्या विषय नोट्स, मागील वर्षांचे प्रश्नपत्रिका, स्तरानुसार सराव चाचण्या, आणि विद्यार्थ्यांना बहुधा चुकणारी शिष्यवृत्तीची माहिती.",
              )}
            </p>
            <div className="about-page-pill-row">
              <span className="badge-pill">{tr("Subject notes", "विषय नोट्स")}</span>
              <span className="badge-pill">{tr("Practice tests", "सराव चाचण्या")}</span>
              <span className="badge-pill">{tr("Question papers", "प्रश्नपत्रिका")}</span>
            </div>
          </div>

          <div className="about-page-visual-card">
            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=900" alt="Students and faculty using DnyanSetu together" />
            <div className="about-page-visual-caption">
              {tr(
                "Notes, papers and practice built around the SRTM University NEP 2020 syllabus.",
                "एस.आर.टी.एम. विद्यापीठाच्या एनईपी २०२० अभ्यासक्रमाभोवती तयार केलेल्या नोट्स, प्रश्नपत्रिका आणि सराव.",
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="about-page-section">
        <div className="about-page-card-grid">
          <article className="about-page-card">
            <div className="about-page-icon"><GraduationCap size={18} /></div>
            <h3>{tr("For students", "विद्यार्थ्यांसाठी")}</h3>
            <p>{tr(
              "Download notes and past papers for your branch and semester, then test yourself with practice sets that get harder as you clear each level.",
              "तुमच्या शाखा आणि सत्रासाठी नोट्स व मागील प्रश्नपत्रिका डाउनलोड करा, नंतर प्रत्येक स्तर पार केल्यावर अधिक कठीण होणाऱ्या सराव संचांसह स्वतःची चाचणी घ्या.",
            )}</p>
          </article>
          <article className="about-page-card">
            <div className="about-page-icon"><Users size={18} /></div>
            <h3>{tr("For faculty", "प्राध्यापकांसाठी")}</h3>
            <p>{tr(
              "Share notes with your class in a few clicks — PDFs or photographs of handwritten pages — and withdraw anything you upload by mistake.",
              "काही क्लिकमध्ये तुमच्या वर्गासोबत नोट्स शेअर करा — पीडीएफ किंवा हाताने लिहिलेल्या पानांचे फोटो — आणि चुकून अपलोड केलेले काहीही मागे घ्या.",
            )}</p>
          </article>
          <article className="about-page-card">
            <div className="about-page-icon"><BarChart3 size={18} /></div>
            <h3>{tr("For institutions", "संस्थांसाठी")}</h3>
            <p>{tr(
              "See every student and faculty account in one directory, export the register to a spreadsheet, and control access when you need to.",
              "प्रत्येक विद्यार्थी आणि प्राध्यापक खाते एका निर्देशिकेत पहा, नोंदवही स्प्रेडशीटमध्ये निर्यात करा, आणि आवश्यकतेनुसार प्रवेश नियंत्रित करा.",
            )}</p>
          </article>
        </div>
      </section>

      <section className="about-page-section">
        <div className="about-page-flow-card">
          <div className="about-page-flow-head">
            <p className="section-eyebrow"><Compass size={14} /> {tr("How DnyanSetu works", "डायनसेतू कसे कार्य करते")}</p>
            <h2>{tr("From signing up to sitting the exam, in four steps.", "नोंदणीपासून परीक्षा देण्यापर्यंत, चार टप्प्यांत.")}</h2>
          </div>

          <div className="about-page-flow-steps">
            <div className="about-page-flow-step">
              <div className="about-page-flow-icon"><User size={18} /></div>
              <h3>{tr("1. Create your account", "१. तुमचे खाते तयार करा")}</h3>
              <p>{tr(
                "Sign up as a student or as a member of faculty. It takes an email address and a password — nothing else.",
                "विद्यार्थी किंवा प्राध्यापक म्हणून नोंदणी करा. यासाठी फक्त ईमेल पत्ता आणि पासवर्ड लागतो — आणखी काही नाही.",
              )}</p>
            </div>
            <div className="about-page-flow-arrow">→</div>
            <div className="about-page-flow-step">
              <div className="about-page-flow-icon"><BookOpen size={18} /></div>
              <h3>{tr("2. Open your subject", "२. तुमचा विषय उघडा")}</h3>
              <p>{tr(
                "Notes and question papers uploaded by your own teachers, filed by stream, semester and subject.",
                "तुमच्याच शिक्षकांनी अपलोड केलेल्या नोट्स आणि प्रश्नपत्रिका, शाखा, सत्र आणि विषयानुसार वर्गीकृत.",
              )}</p>
            </div>
            <div className="about-page-flow-arrow">→</div>
            <div className="about-page-flow-step">
              <div className="about-page-flow-icon"><Target size={18} /></div>
              <h3>{tr("3. Practise by level", "३. स्तरानुसार सराव करा")}</h3>
              <p>{tr(
                "Work through Beginner, Intermediate and Advanced sets of fifteen questions, then unlock the final exam.",
                "नवशिक्या, मध्यम आणि प्रगत अशा पंधरा प्रश्नांच्या संचांतून जा, नंतर अंतिम परीक्षा अनलॉक करा.",
              )}</p>
            </div>
            <div className="about-page-flow-arrow">→</div>
            <div className="about-page-flow-step">
              <div className="about-page-flow-icon"><CheckCircle2 size={18} /></div>
              <h3>{tr("4. Keep your record", "४. तुमची नोंद जपून ठेवा")}</h3>
              <p>{tr(
                "Every attempt is saved to your profile, so you can see how you did and retake anything as often as you like.",
                "प्रत्येक प्रयत्न तुमच्या प्रोफाइलमध्ये जतन केला जातो, त्यामुळे तुम्ही कसे केले हे पाहू शकता आणि हवे तितक्या वेळा पुन्हा देऊ शकता.",
              )}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-page-section">
        <div className="about-page-flow-card">
          <div className="about-page-flow-head">
            <p className="section-eyebrow"><MessageSquare size={14} /> {tr("Frequently asked questions", "वारंवार विचारले जाणारे प्रश्न")}</p>
            <h2>{tr("Everything students and faculty tend to ask.", "विद्यार्थी आणि प्राध्यापक सहसा विचारतात ते सर्व काही.")}</h2>
          </div>

          <div className="faq-list">
            <details className="faq-item">
              <summary>{tr("Is DnyanSetu free to use?", "डायनसेतू वापरण्यासाठी मोफत आहे का?")}</summary>
              <p>{tr(
                "Yes. It is free for students and faculty of the college. There is no payment step and no card is ever asked for.",
                "होय. महाविद्यालयाच्या विद्यार्थी आणि प्राध्यापकांसाठी हे मोफत आहे. कोणतीही पेमेंट पायरी नाही आणि कधीही कार्ड मागितले जात नाही.",
              )}</p>
            </details>
            <details className="faq-item">
              <summary>{tr("Who can use the platform?", "हे व्यासपीठ कोण वापरू शकते?")}</summary>
              <p>{tr(
                "Any student of the college can sign up and start straight away. Faculty accounts can additionally upload notes and question papers, and an administrator looks after accounts.",
                "महाविद्यालयातील कोणताही विद्यार्थी नोंदणी करून लगेच सुरुवात करू शकतो. प्राध्यापक खाती अतिरिक्त नोट्स आणि प्रश्नपत्रिका अपलोड करू शकतात, आणि प्रशासक खात्यांची देखभाल करतो.",
              )}</p>
            </details>
            <details className="faq-item">
              <summary>{tr("Where do the notes and question papers come from?", "नोट्स आणि प्रश्नपत्रिका कोठून येतात?")}</summary>
              <p>{tr(
                "Your own teachers upload them. Nothing here is scraped or bought in — a file appears in the library because a member of the faculty put it there, under their name.",
                "तुमचेच शिक्षक त्या अपलोड करतात. येथे काहीही परस्पर गोळा केलेले किंवा विकत घेतलेले नाही — एखादी फाईल ग्रंथालयात दिसते कारण एका प्राध्यापकाने ती त्यांच्या नावाने तिथे ठेवली आहे.",
              )}</p>
            </details>
            <details className="faq-item">
              <summary>{tr("How do the practice tests work?", "सराव चाचण्या कशा काम करतात?")}</summary>
              <p>{tr(
                "A practice set is fifteen questions and you pass at eight. The final exam is thirty questions and you pass at twelve. Every question is worth one mark, nothing is deducted for a wrong answer, and you can retake as often as you like — the questions are drawn fresh each time.",
                "सराव संचात पंधरा प्रश्न असतात आणि आठ गुणांवर तुम्ही उत्तीर्ण होता. अंतिम परीक्षेत तीस प्रश्न असतात आणि बारा गुणांवर उत्तीर्ण होता. प्रत्येक प्रश्नाला एक गुण असतो, चुकीच्या उत्तरासाठी काहीही वजा केले जात नाही, आणि तुम्ही हवे तितक्या वेळा पुन्हा देऊ शकता — दर वेळी प्रश्न नव्याने निवडले जातात.",
              )}</p>
            </details>
            <details className="faq-item">
              <summary>{tr("Which syllabus are the questions based on?", "प्रश्न कोणत्या अभ्यासक्रमावर आधारित आहेत?")}</summary>
              <p>{tr(
                "The SRTM University NEP 2020 syllabus, organised by year and branch across B.Sc., B.Sc. Computer Science, BCA and B.Com. A few subject banks are still being written, and any that is not ready yet says so on the card rather than showing you an empty test.",
                "एस.आर.टी.एम. विद्यापीठाचा एनईपी २०२० अभ्यासक्रम, बी.एस्सी., बी.एस्सी. कॉम्प्युटर सायन्स, बीसीए आणि बी.कॉम. मध्ये वर्ष व शाखेनुसार वर्गीकृत. काही विषय बँक अजून तयार होत आहेत, आणि जी तयार नाही ती रिकामी चाचणी दाखवण्याऐवजी कार्डवर तसे स्पष्ट सांगते.",
              )}</p>
            </details>
            <details className="faq-item">
              <summary>{tr("Is my work saved if I sign in somewhere else?", "मी दुसरीकडे साइन इन केल्यास माझे काम जतन राहते का?")}</summary>
              <p>{tr(
                "Yes. Attempts are stored against your account, not the device, so your record follows you to any browser you sign in from.",
                "होय. प्रयत्न तुमच्या खात्याविरुद्ध साठवले जातात, डिव्हाइसविरुद्ध नाही, त्यामुळे तुम्ही ज्या कोणत्याही ब्राउझरवरून साइन इन कराल तिथे तुमची नोंद येते.",
              )}</p>
            </details>
          </div>
        </div>
      </section>

      <section className="about-page-section about-page-cta">
        <h2>{tr("Everything for your semester, in one place.", "तुमच्या सत्रासाठी सर्व काही, एका ठिकाणी.")}</h2>
        <p>{tr(
          "Your teachers' notes, the college's past papers, and practice tests for your own syllabus — free, and open to every student here.",
          "तुमच्या शिक्षकांच्या नोट्स, महाविद्यालयाच्या मागील प्रश्नपत्रिका, आणि तुमच्याच अभ्यासक्रमासाठी सराव चाचण्या — मोफत, आणि येथील प्रत्येक विद्यार्थ्यासाठी खुल्या.",
        )}</p>
        <button className="btn btn-primary" type="button" onClick={onBack}>{tr("Return to landing page", "मुख्यपृष्ठावर परत जा")}</button>
      </section>
    </div>
  );
}

/* =============================== VIEW: Auth Screen ============================== */

function AuthScreen({ mode, setMode, onSubmit, goLanding, roleScope = "student" }) {
  const isStaffScope = roleScope === "staff";
  const [selectedRole, setSelectedRole] = useState(isStaffScope ? "faculty" : "student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const localHostUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  /* Accounts are keyed on the email address alone. Phone sign-in was removed,
     so there is nothing to disambiguate here beyond trimming and casing. */
  const normalizeEmail = (value) => (value || "").trim().toLowerCase();
  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (submitting) return;

    if (mode === "signup") {
      const needsName = selectedRole !== "admin";
      if ((needsName && !name.trim()) || !email.trim() || !password || !confirmPassword) {
        setError(needsName
          ? "Please fill in your name, email address, password, and confirm password."
          : "Please fill in your email address, password, and confirm password.");
        return;
      }
      if (password.length < 6) {
        setError("Password should be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please re-enter them.");
        return;
      }
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
      setSubmitting(true);
      try {
        const result = await onSubmit({
          mode: "signup",
          role: selectedRole,
          name: name.trim(),
          email: normalizedEmail,
          password,
        });
        if (result?.success) {
          setSuccessMessage(result.message || "Sign up successful! Please sign in.");
          setPassword("");
          setConfirmPassword("");
        } else {
          setError(result?.message || "Unable to create account right now.");
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      setError("Please enter your registered email address and password.");
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (selectedRole === "admin" && normalizedEmail !== ADMIN_EMAIL) {
      setError("This email is not authorised for administrator access.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({
        mode: "login",
        role: selectedRole,
        name: name.trim() || normalizedEmail.split("@")[0] || `${selectedRole} user`,
        email: normalizedEmail,
        password,
      });
      if (!result?.success) {
        setError(result?.message || "No matching account found. Please sign up first.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* Works the same way for a student, faculty or admin account — Firebase
     Auth does not care which, so there is nothing role-specific to ask here. */
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setResetError("");
    if (resetSubmitting) return;

    const normalizedEmail = normalizeEmail(resetEmail);
    if (!isValidEmail(normalizedEmail)) {
      setResetError("Please enter a valid email address.");
      return;
    }
    setResetSubmitting(true);
    try {
      const result = await resetPassword({ email: normalizedEmail });
      if (result?.success) {
        setResetSent(true);
      } else {
        setResetError(result?.message || "Could not send the reset email right now.");
      }
    } finally {
      setResetSubmitting(false);
    }
  };

  const closeForgotMode = () => {
    setForgotMode(false);
    setResetError("");
    setResetSent(false);
    setResetEmail("");
  };

  return (
    <div className="auth-screen">
      <div className="auth-brand-panel">
        <div onClick={goLanding} style={{ cursor: "pointer" }}>
          <InstitutionLockup size={64} tone="dark" className="auth-brand-institution" />
        </div>
      </div>

      <div className="auth-form-panel">
        <button type="button" className="auth-back-link" onClick={goLanding}>
          <ArrowLeft size={15} /> Back
        </button>
        {forgotMode ? (
          <>
            <div className="auth-heading">
              <h2 className="auth-title">Reset your password</h2>
              <p className="auth-sub">
                Works for student, faculty and admin accounts alike — enter the email you signed
                up with and we will send a reset link.
              </p>
            </div>

            {resetError && <div className="form-error">{resetError}</div>}

            {resetSent ? (
              <div className="form-success">
                <CheckCircle2 size={15} />
                <span>If an account exists for <strong>{normalizeEmail(resetEmail)}</strong>, a reset link is on its way. Check your inbox (and spam folder).</span>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit}>
                <Field label="Registered Email" icon={Mail} type="email" autoComplete="email" placeholder="name@arcsas.edu" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} disabled={resetSubmitting}>
                  {resetSubmitting ? (
                    <><Loader2 size={16} className="spin" /> Sending reset link…</>
                  ) : (
                    <>Send reset link <ArrowRight size={16} /></>
                  )}
                </button>
              </form>
            )}

            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={closeForgotMode}>
              Back to login
            </button>
          </>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === "login" ? "auth-tab-active" : ""}`} onClick={() => setMode("login")}>Log in</button>
              <button className={`auth-tab ${mode === "signup" ? "auth-tab-active" : ""}`} onClick={() => { setMode("signup"); if (selectedRole === "admin") setSelectedRole("student"); }}>Sign up</button>
            </div>

            <div className="auth-heading">
              <h2 className="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p className="auth-sub">
                {mode === "login"
                  ? "Sign in with your registered email address."
                  : "Register with your name, email address, and password to begin."}
              </p>
              {mode === "login" && (
                <p className="auth-host-note">Local host: <strong>{localHostUrl}</strong></p>
              )}
            </div>

            <div className="role-selector-wrap">
              {isStaffScope ? (
                <>
                  <div className="role-divider"><span>Staff sign-in</span></div>
                  <div className="role-selector-staff">
                    <button type="button" className={`role-tab ${selectedRole === "faculty" ? "role-tab-active" : ""}`} onClick={() => setSelectedRole("faculty")}>
                      <NotebookPen size={16} /> Faculty
                    </button>
                    {/* Administration is a single fixed account, so it is never a signup option. */}
                    {mode === "login" && (
                      <button type="button" className={`role-tab ${selectedRole === "admin" ? "role-tab-active" : ""}`} onClick={() => setSelectedRole("admin")}>
                        <Shield size={16} /> Admin
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="role-current-chip">
                  <GraduationCap size={16} /> Student {mode === "login" ? "sign-in" : "sign-up"}
                </div>
              )}
            </div>

            {error && <div className="form-error">{error}</div>}
            {successMessage && <div className="form-success"><CheckCircle2 size={15} /> <span>{successMessage}</span></div>}

            <form onSubmit={handleSubmit}>
              {mode === "signup" && selectedRole !== "admin" && (
                <Field label="Full Name" icon={User} type="text" placeholder="Enter your full name" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              <Field label={mode === "signup" ? "Email" : "Registered Email"} icon={Mail} type="email" autoComplete="email" placeholder="name@arcsas.edu" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Field label="Password" icon={Lock} type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              {mode === "signup" && (
                <Field label="Confirm Password" icon={Lock} type={showPassword ? "text" : "password"} placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              )}

              {mode === "login" && (
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => { setForgotMode(true); setResetEmail(email); }}
                >
                  Forgot password?
                </button>
              )}

              <div style={{ marginTop: 12, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="show-password-toggle"
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <label htmlFor="show-password-toggle" style={{ cursor: "pointer", userSelect: "none" }}>
                  Show password
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} disabled={submitting}>
                {submitting ? (
                  <><Loader2 size={16} className="spin" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
                ) : (
                  <>{mode === "login" ? `Log in as ${selectedRole.toUpperCase()}` : `Register as ${selectedRole.toUpperCase()}`} <ArrowRight size={16} /></>
                )}
              </button>

              {mode === "signup" && (
                <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setMode("login")}>
                  Already registered? Go to login
                </button>
              )}
            </form>
          </>
        )}

      </div>
    </div>
  );
}

/* =============================== VIEW: Faculty Setup ============================== */

function FacultyProfileSetup({ profile, onComplete }) {
  const [form, setForm] = useState({
    name: profile.name || "",
    designation: profile.designation || "Associate Professor",
    department: profile.department || "School of Physical Sciences",
    qualification: profile.qualification || "Ph.D. in Physics (IIT Bombay)",
    specialization: profile.specialization || "Electromagnetism, Quantum Mechanics",
    orcid: profile.orcid || "",
    googleScholar: profile.googleScholar || "",
    linkedin: profile.linkedin || "",
    college: profile.college || "Department of Physics",
    university: profile.university || "SRTM University, Nanded",
    city: profile.city || "Udgir"
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onComplete(form);
  };

  return (
    <div className="wizard-screen">
      <div className="card wizard-card">
        <h2 className="wizard-title"><NotebookPen size={24} /> Complete Faculty Profile</h2>
        <p className="wizard-sub">Setup research links, profile avatar, and credentials</p>

        <form onSubmit={handleSubmit}>
          <Field label="Full Name" icon={User} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="two-col">
            <SelectField label="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} options={["Professor", "Associate Professor", "Assistant Professor"]} />
            <Field label="Department" icon={GraduationCap} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
          </div>
          <Field label="Qualifications" icon={Award} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} required />
          <Field label="Specializations" icon={Sparkles} value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} required />
          
          <div className="two-col">
            <Field label="LinkedIn Profile URL (optional)" icon={Linkedin} value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
            <Field label="ORCID iD (optional)" icon={ExternalLink} value={form.orcid} onChange={(e) => setForm({ ...form, orcid: e.target.value })} />
          </div>
          <Field label="Google Scholar Link (optional)" icon={ExternalLink} value={form.googleScholar} onChange={(e) => setForm({ ...form, googleScholar: e.target.value })} />
          <SelectField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} options={["Udgir", "Latur", "Parbhani", "Hingoli", "Nanded"]} />

          <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 20 }}>
            Enter Faculty Studio <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}


/* =============================== VIEW: Question Papers ============================== */

/* Stream -> subject -> paper. Kept as one page with three stages so the flow
   reads the same on a phone as on a desktop. */
function PyqPage({ onBack }) {
  return (
    <main className="resource-page pyq-page">
      <div className="resource-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="resource-head-copy">
          <p className="section-eyebrow"><ScrollText size={14} /> Previous Year Questions</p>
          <h1 className="resource-title">Previous year question papers</h1>
          <p className="resource-sub">
            The college publishes every paper itself, sorted by course, year and semester. That
            is the authoritative set, so this page sends you straight to it rather than keeping
            a second copy that would fall behind.
          </p>
        </div>
      </div>

      <a
        className="pyq-official"
        href={PYQ_OFFICIAL_URL}
        target="_blank"
        rel="noreferrer noopener"
      >
        <span className="pyq-official-icon"><ScrollText size={26} /></span>
        <span className="pyq-official-copy">
          <strong>Open the college question paper archive</strong>
          <small>
            B.A., B.Com., B.Sc., M.A., M.Sc. and M.Com. — every semester, on the official
            {" "}{INSTITUTION.short} website.
          </small>
          <span className="pyq-official-host">shivajicollegeudgir.in</span>
        </span>
        <ExternalLink size={18} className="pyq-official-arrow" />
      </a>
    </main>
  );
}

/* =============================== VIEW: Scholarships ============================== */

function ScholarshipsPage({ onBack, onRegisterBack }) {
  const { lang } = useLang();
  const tr = makeTr(lang);
  const [categoryId, setCategoryId] = useState(null);
  const [openDocs, setOpenDocs] = useState(null);
  const [showAllDocs, setShowAllDocs] = useState(false);

  const category = SCHOLARSHIP_CATEGORIES.find((c) => c.id === categoryId) || null;
  const matches = category ? scholarshipsFor(category.id) : [];
  const allDocs = category ? documentsFor(category.id, lang) : [];

  /* Closes the documents panel first, then the category, and only then
     reports it had nothing left to unwind — true/false rather than calling
     onBack() itself, since this same function is also handed to the
     hardware-back handler, which needs to know whether the gesture was
     actually absorbed before it decides what to do next. */
  const stepBack = () => {
    if (openDocs) { setOpenDocs(null); return true; }
    if (showAllDocs) { setShowAllDocs(false); return true; }
    if (categoryId) { setCategoryId(null); return true; }
    return false;
  };
  const handleBackClick = () => { if (!stepBack()) onBack(); };

  /* Same undo the on-screen Back button does, but for the hardware/gesture
     back too — see the note in App() by registerPageBack. */
  useEffect(() => {
    onRegisterBack?.(() => stepBack());
    return () => onRegisterBack?.(null);
  });

  return (
    <main className="resource-page">
      <div className="resource-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleBackClick}>
          <ArrowLeft size={16} /> {tr("Back", "मागे")}
        </button>
        <div className="resource-head-copy">
          <p className="section-eyebrow"><Coins size={14} /> {tr("Scholarships", "शिष्यवृत्ती")}</p>
          <h1 className="resource-title">{tr("Find the scholarships you can actually apply for", "तुम्ही प्रत्यक्षात अर्ज करू शकता अशा शिष्यवृत्ती शोधा")}</h1>
          <p className="resource-sub">
            {tr(
              "Choose the category on your certificate. You will see only the schemes open to that category, with the documents each one asks for.",
              "तुमच्या प्रमाणपत्रावरील प्रवर्ग निवडा. तुम्हाला फक्त त्या प्रवर्गासाठी खुल्या असलेल्या योजना दिसतील, प्रत्येकीसाठी आवश्यक कागदपत्रांसह.",
            )}
          </p>
        </div>
      </div>

      <p className="resource-note">
        <Info size={15} />
        <span>
          {tr(
            "Scheme details are indicative and pending verification against the current government notifications. Always confirm amounts and deadlines on the official portal before applying.",
            "योजनेचा तपशील सूचक असून सध्याच्या शासकीय अधिसूचनांनुसार पडताळणी प्रलंबित आहे. अर्ज करण्यापूर्वी नेहमी अधिकृत पोर्टलवर रक्कम व अंतिम तारखांची खात्री करा.",
          )}
        </span>
      </p>

      <div className="category-row" role="group" aria-label="Select your category">
        {SCHOLARSHIP_CATEGORIES.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`category-chip ${categoryId === item.id ? "is-active" : ""}`}
            onClick={() => { setCategoryId(item.id); setOpenDocs(null); setShowAllDocs(false); }}
          >
            {tr(item.name, item.nameMr)}
          </button>
        ))}
      </div>

      {!category && (
        <p className="resource-empty">{tr("Select your category above to see the schemes open to you.", "तुमच्यासाठी खुल्या असलेल्या योजना पाहण्यासाठी वरील प्रवर्ग निवडा.")}</p>
      )}

      {category && (
        <>
          <div className="category-summary">
            <div>
              <h2>{tr(category.name, category.nameMr)}</h2>
              <p>{tr(category.note, category.noteMr)}</p>
            </div>
            <span className="category-count">
              {tr(
                `${matches.length} scheme${matches.length === 1 ? "" : "s"} available`,
                `${matches.length} योजना उपलब्ध`,
              )}
            </span>
          </div>

          <p className="scheme-note scheme-note--global">
            <Info size={13} /> {tr(
              "Only one scholarship can be sanctioned by the government — if you have already applied for one, you cannot apply for another.",
              "शासनाकडून फक्त एकच शिष्यवृत्ती मंजूर केली जाऊ शकते — जर तुम्ही आधीच एकासाठी अर्ज केला असेल, तर तुम्ही दुसऱ्यासाठी अर्ज करू शकत नाही.",
            )}
          </p>

          <div className="scheme-list">
            {matches.map((scheme) => {
              const isOpen = openDocs === scheme.id;
              return (
                <article className="scheme-card" key={scheme.id}>
                  <div className="scheme-head">
                    <h3>{tr(scheme.name, scheme.nameMr)}</h3>
                    <span className="scheme-amount">{tr(scheme.amount, scheme.amountMr)}</span>
                  </div>
                  <p className="scheme-provider">{tr(scheme.provider, scheme.providerMr)}</p>
                  <p className="scheme-eligibility">{tr(scheme.eligibility, scheme.eligibilityMr)}</p>

                  <div className="scheme-meta">
                    <span><CalendarDays size={14} /> {tr(scheme.window, scheme.windowMr)}</span>
                    <span><ListChecks size={14} /> {tr(`${scheme.documents.length} documents`, `${scheme.documents.length} कागदपत्रे`)}</span>
                  </div>

                  <div className="scheme-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      aria-expanded={isOpen}
                      onClick={() => setOpenDocs(isOpen ? null : scheme.id)}
                    >
                      <ListChecks size={15} /> {isOpen
                        ? tr("Click here to hide documents", "कागदपत्रे लपवण्यासाठी येथे क्लिक करा")
                        : tr("Click here for documents required", "आवश्यक कागदपत्रांसाठी येथे क्लिक करा")}
                    </button>
                    <a className="btn btn-primary btn-sm" href={scheme.portal} target="_blank" rel="noreferrer">
                      {tr("Apply on portal", "पोर्टलवर अर्ज करा")} <ExternalLink size={14} />
                    </a>
                  </div>

                  {isOpen && (
                    <ul className="doc-list">
                      {expandDocuments(scheme.documents, lang).map((doc) => (
                        <li key={doc}><CheckCircle2 size={15} /> {doc}</li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>

          {allDocs.length > 0 && (
            <section className="doc-summary">
              <h2><FileDown size={18} /> {tr("Everything you may be asked for", "तुम्हाला जे काही विचारले जाऊ शकते")}</h2>
              <p>
                {tr(
                  `Across all ${matches.length} schemes open to ${category.name}. Keep scans of these ready before you start an application.`,
                  `${category.nameMr} साठी खुल्या असलेल्या सर्व ${matches.length} योजनांमध्ये. अर्ज सुरू करण्यापूर्वी यांचे स्कॅन तयार ठेवा.`,
                )}
              </p>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                aria-expanded={showAllDocs}
                onClick={() => setShowAllDocs((v) => !v)}
              >
                <ListChecks size={15} /> {showAllDocs
                  ? tr("Click here to hide the full list", "संपूर्ण यादी लपवण्यासाठी येथे क्लिक करा")
                  : tr(`Click here for all ${allDocs.length} documents`, `सर्व ${allDocs.length} कागदपत्रांसाठी येथे क्लिक करा`)}
              </button>
              {showAllDocs && (
                <ul className="doc-list doc-list--two">
                  {allDocs.map((doc) => (
                    <li key={doc}><CheckCircle2 size={15} /> {doc}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

/* =============================== VIEW: Student Profile ============================== */

function StudentProfile({ profile, onSaveProfile }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    name: profile.name || "",
    degree: profile.degree || "B.Tech",
    branch: profile.branch || "Computer Science & Engineering",
    college: profile.college || "",
    university: profile.university || "SRTM University, Nanded",
    gradYear: profile.gradYear || "2026",
    studentIdNum: profile.studentIdNum || "",
    about: profile.about || "",
    skills: (profile.skills || []).join(", ")
  });

  useEffect(() => {
    setDraft({
      name: profile.name || "",
      degree: profile.degree || "B.Tech",
      branch: profile.branch || "Computer Science & Engineering",
      college: profile.college || "",
      university: profile.university || "SRTM University, Nanded",
      gradYear: profile.gradYear || "2026",
      studentIdNum: profile.studentIdNum || "",
      about: profile.about || "",
      skills: (profile.skills || []).join(", ")
    });
  }, [profile]);

  const initials = (profile.name || "Student")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const skills = profile.skills?.length
    ? profile.skills
    : ["Computer Science", "Programming", "Problem Solving", "Python", "C", "Data Structures", "Web Development"];

  return (
    <main className="profile-page">
      <section className="profile-header-card">
        <div className="profile-cover">
          <div className="profile-cover-grid" />
        </div>

        <div className="profile-header-content">
          {/* Initials rather than an uploaded photo — students do not upload images. */}
          <div className="profile-avatar-wrap">
            <div className="profile-avatar profile-avatar-initials">{initials || "ST"}</div>
            <span className="profile-online-dot" title="Active" />
          </div>

          <div className="profile-main-info">
            <div className="profile-title-row">
              <div className="profile-title-copy">
                <div className="profile-name-line">
                  <h1>{profile.name || "Student"}</h1>
                  <span className="verified-badge"><CheckCircle2 size={14} /> Verified Student</span>
                </div>
                <p className="profile-headline">
                  {profile.degree || "Student"} · {profile.branch || "Computer Science"}
                </p>
                <p className="profile-institution">
                  <GraduationCap size={15} /> {profile.college || "College not added"}
                </p>
                <p className="profile-location">
                  <MapPin size={14} /> {profile.university || "SRTM University, Nanded"}
                </p>
              </div>

              <RoleBadge role="student" />
            </div>

            <div className="profile-metrics-row">
              <span className="profile-metric"><Award size={14} /> {profile.achievements?.length || 0} Achievements</span>
            </div>

            <div className="profile-actions">
              <button type="button" className="btn btn-primary" onClick={() => setIsEditing(true)}>
                <Edit3 size={16} /> Edit Profile
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-layout">
        <div className="profile-main-column">
          {isEditing && (
            <section className="profile-card">
              <div className="profile-card-heading">
                <div>
                  <span className="profile-section-kicker">EDIT</span>
                  <h2>Update Profile</h2>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setIsEditing(false)}><X size={16} /></button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const normalizedSkills = draft.skills
                  .split(",")
                  .map((skill) => skill.trim())
                  .filter(Boolean);

                onSaveProfile({
                  ...profile,
                  ...draft,
                  skills: normalizedSkills.length ? normalizedSkills : []
                });
                setIsEditing(false);
              }}>
                <div className="two-col">
                  <Field label="Full Name" icon={User} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <Field label="Student ID / Roll Number" icon={FileText} value={draft.studentIdNum} onChange={(e) => setDraft({ ...draft, studentIdNum: e.target.value })} />
                </div>
                <div className="two-col">
                  <Field label="Degree" icon={GraduationCap} value={draft.degree} onChange={(e) => setDraft({ ...draft, degree: e.target.value })} />
                  <Field label="Branch" icon={Code2} value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value })} />
                </div>
                <div className="two-col">
                  <Field label="College" icon={GraduationCap} value={draft.college} onChange={(e) => setDraft({ ...draft, college: e.target.value })} />
                  <Field label="University" icon={Compass} value={draft.university} onChange={(e) => setDraft({ ...draft, university: e.target.value })} />
                </div>
                <div className="two-col">
                  <Field label="Graduation Year" icon={CalendarDays} value={draft.gradYear} onChange={(e) => setDraft({ ...draft, gradYear: e.target.value })} />
                  <Field label="Skills (comma separated)" icon={Code2} value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} />
                </div>
                <Field label="About" icon={Info} value={draft.about} onChange={(e) => setDraft({ ...draft, about: e.target.value })} />
                <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }}>Save Changes</button>
              </form>
            </section>
          )}

          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <span className="profile-section-kicker">PROFILE</span>
                <h2>About</h2>
              </div>
              <Edit3 size={17} />
            </div>
            <p className="profile-about">
              {profile.about || "Computer science student building academic foundations, practical skills, and career readiness through DnyanSetu."}
            </p>
          </section>

          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <span className="profile-section-kicker">ACADEMICS</span>
                <h2>Education</h2>
              </div>
              <GraduationCap size={18} />
            </div>

            <div className="education-row">
              <div className="education-logo"><GraduationCap size={22} /></div>
              <div className="education-copy">
                <h3>{profile.college || "College not added"}</h3>
                <p>{profile.degree || "Degree"} · {profile.branch || "Major not added"}</p>
                <span>{profile.university || "SRTM University, Nanded"}</span>
                {profile.gradYear && <small>Expected graduation · {profile.gradYear}</small>}
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="profile-card-heading">
              <div>
                <span className="profile-section-kicker">CAPABILITIES</span>
                <h2>Skills</h2>
              </div>
              <Code2 size={18} />
            </div>
            <div className="skills-list">
              {skills.map((skill) => <span key={skill} className="skill-pill">{skill}</span>)}
            </div>
          </section>

        </div>

      </div>
    </main>
  );
}

/* =============================== VIEW: Faculty Portal (Redesigned Profile & Videos) ============================== */

function FacultyPortal({ profile, onSaveProfile }) {
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [uploadError, setUploadError] = useState("");

  /* Profile photograph. The field was stored and edited but never displayed or
     captured, so every teacher showed the same grey silhouette. */
  const [pfpBusy, setPfpBusy] = useState(false);
  const [pfpError, setPfpError] = useState("");
  const pfpInputRef = useRef(null);

  const facultyInitials = (profile.name || "Faculty")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handlePfpPick = async (event) => {
    const file = event.target.files?.[0];
    /* Clear it straight away, so choosing the same file twice fires again. */
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPfpError("Choose an image — a JPG, PNG or WebP.");
      return;
    }

    setPfpBusy(true);
    setPfpError("");
    try {
      const uploaded = await uploadFile(file, { folder: "dnyansetu/avatars" });
      await onSaveProfile({ ...profile, pfp: uploaded.url });
    } catch (err) {
      setPfpError(err.message || "Could not upload that photo.");
    } finally {
      setPfpBusy(false);
    }
  };

  const removePfp = async () => {
    setPfpError("");
    try {
      await onSaveProfile({ ...profile, pfp: "" });
    } catch (err) {
      setPfpError(err.message || "Could not remove the photo.");
    }
  };

  /* The teacher's own uploads, so they can withdraw one later. */
  const [myNotes, setMyNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  /* Note composer */
  const [nStream, setNStream] = useState("bsc-cs");
  const [nSemester, setNSemester] = useState(SEMESTERS[0]);
  const [nSubject, setNSubject] = useState("");
  const [nTitle, setNTitle] = useState("");
  const [nDesc, setNDesc] = useState("");
  const [nFiles, setNFiles] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(null);

  const refreshMyNotes = async () => {
    setNotesLoading(true);
    try {
      setMyNotes(await fetchMyNotes(profile.id));
      setNotesError("");
    } catch (err) {
      setNotesError("Could not load your uploads.");
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => { refreshMyNotes(); /* eslint-disable-next-line */ }, [profile.id]);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: profile.name || "",
    designation: profile.designation || "Associate Professor",
    department: profile.department || "School of Physical Sciences",
    qualification: profile.qualification || "Ph.D. in Physics (IIT Bombay)",
    specialization: profile.specialization || "Electromagnetism, Quantum Mechanics",
    orcid: profile.orcid || "",
    googleScholar: profile.googleScholar || "",
    linkedin: profile.linkedin || "",
    pfp: profile.pfp || "",
    college: profile.college || "",
    university: profile.university || "SRTM University, Nanded"
  });

  useEffect(() => {
    setProfileForm({
      name: profile.name || "",
      designation: profile.designation || "Associate Professor",
      department: profile.department || "School of Physical Sciences",
      qualification: profile.qualification || "Ph.D. in Physics (IIT Bombay)",
      specialization: profile.specialization || "Electromagnetism, Quantum Mechanics",
      orcid: profile.orcid || "",
      googleScholar: profile.googleScholar || "",
      linkedin: profile.linkedin || "",
      pfp: profile.pfp || "",
      college: profile.college || "",
      university: profile.university || "SRTM University, Nanded"
    });
  }, [profile]);


  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!nTitle.trim() || !nSubject.trim() || !nFiles.length || publishing) return;

    setPublishing(true);
    setUploadError("");
    setProgress({ pct: 0, index: 1, total: nFiles.length });
    try {
      await uploadNote({
        streamId: nStream,
        subject: nSubject,
        semester: nSemester,
        title: nTitle,
        description: nDesc,
        files: nFiles,
        author: profile,
        onProgress: (pct, index, total) => setProgress({ pct, index, total }),
      });
      setShowNotesModal(false);
      setNSubject(""); setNTitle(""); setNDesc(""); setNFiles([]);
      await refreshMyNotes();
    } catch (err) {
      setUploadError(err.message || "Could not upload these notes.");
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  };

  /* Removes the row and every stored file, so the note disappears from the
     student library as well. */
  const handleNoteDelete = async (note) => {
    setDeletingId(note.id);
    setNotesError("");
    try {
      await deleteNote(note);
      setMyNotes((prev) => prev.filter((n) => n.id !== note.id));
      setConfirmDelete(null);
    } catch (err) {
      setNotesError(err.message || "Could not delete that note.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="dash-grid">
      {/* Organized Faculty Profile Header Card */}
      <div className="card faculty-profile-hero" style={{ gridColumn: "1 / -1" }}>
        <div className="fac-hero-cover" />
        <div className="fac-hero-main">
          <div className="fac-pfp-wrap">
            <button
              type="button"
              className="fac-pfp-button"
              onClick={() => pfpInputRef.current?.click()}
              disabled={pfpBusy}
              title={profile.pfp ? "Change your photo" : "Add a photo"}
              aria-label={profile.pfp ? "Change your profile photo" : "Add a profile photo"}
            >
              {profile.pfp ? (
                <img src={profile.pfp} alt={`${profile.name || "Faculty"} profile photograph`} className="fac-pfp-large" />
              ) : (
                <div className="fac-pfp-placeholder">
                  {facultyInitials || <User size={36} />}
                </div>
              )}
              <span className="fac-pfp-edit" aria-hidden="true">
                {pfpBusy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
              </span>
            </button>

            <input
              ref={pfpInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={handlePfpPick}
            />

            {profile.pfp && !pfpBusy && (
              <button type="button" className="fac-pfp-remove" onClick={removePfp}>
                Remove photo
              </button>
            )}
            {pfpError && <p className="fac-pfp-error">{pfpError}</p>}
          </div>

          <div className="fac-info">
            <div className="fac-name-row">
              <h2 className="dash-name">{profile.name}</h2>
              <RoleBadge role="faculty" />
            </div>
            <p className="fac-designation-meta">{profile.designation} · {profile.department}</p>
            <p className="fac-institution-meta"><GraduationCap size={14} /> {profile.college || "Department of Physics"} · {profile.university || "SRTM University, Nanded"}</p>
            
            {/* Properly Arranged Social & Research Links Grid */}
            <div className="fac-social-grid">
              {profile.linkedin && (
                <a href={profile.linkedin} target="_blank" rel="noreferrer" className="social-badge social-badge-li">
                  <Linkedin size={13} /> LinkedIn Profile <ExternalLink size={11} />
                </a>
              )}
              {profile.orcid && (
                <a href={`https://orcid.org/${profile.orcid}`} target="_blank" rel="noreferrer" className="social-badge social-badge-orcid">
                  <ExternalLink size={13} /> ORCID: {profile.orcid}
                </a>
              )}
              {profile.googleScholar && (
                <a href={profile.googleScholar} target="_blank" rel="noreferrer" className="social-badge social-badge-scholar">
                  <GraduationCap size={13} /> Google Scholar <ExternalLink size={11} />
                </a>
              )}
              <span className="social-badge social-badge-email">
                <Mail size={13} /> {profile.email}
              </span>
              {profile.trackingId && (
                <span className="social-badge social-badge-scholar">
                  <Shield size={13} /> ID: {profile.trackingId}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="fac-hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setShowNotesModal(true)}>
            <NotebookPen size={18} /> Upload Notes
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => setShowProfileEditor((prev) => !prev)}>
            <Edit3 size={18} /> Edit Profile
          </button>
        </div>
      </div>

      {showProfileEditor && (
        <section className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="profile-card-heading">
            <div>
              <span className="profile-section-kicker">EDIT</span>
              <h2>Update Faculty Profile</h2>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowProfileEditor(false)}><X size={16} /></button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            onSaveProfile({ ...profile, ...profileForm });
            setShowProfileEditor(false);
          }}>
            <div className="two-col">
              <Field label="Full Name" icon={User} value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
              <Field label="Department" icon={GraduationCap} value={profileForm.department} onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })} />
            </div>
            <div className="two-col">
              <SelectField label="Designation" value={profileForm.designation} onChange={(e) => setProfileForm({ ...profileForm, designation: e.target.value })} options={["Professor", "Associate Professor", "Assistant Professor"]} />
              <Field label="College" icon={GraduationCap} value={profileForm.college} onChange={(e) => setProfileForm({ ...profileForm, college: e.target.value })} />
            </div>
            <Field label="Qualifications" icon={Award} value={profileForm.qualification} onChange={(e) => setProfileForm({ ...profileForm, qualification: e.target.value })} />
            <Field label="Specializations" icon={Sparkles} value={profileForm.specialization} onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })} />
            <div className="two-col">
              <Field label="LinkedIn Profile URL" icon={Linkedin} value={profileForm.linkedin} onChange={(e) => setProfileForm({ ...profileForm, linkedin: e.target.value })} />
              <Field label="ORCID iD" icon={ExternalLink} value={profileForm.orcid} onChange={(e) => setProfileForm({ ...profileForm, orcid: e.target.value })} />
            </div>
            <div className="two-col">
              <Field label="Google Scholar Link" icon={ExternalLink} value={profileForm.googleScholar} onChange={(e) => setProfileForm({ ...profileForm, googleScholar: e.target.value })} />
              <Field label="University" icon={Compass} value={profileForm.university} onChange={(e) => setProfileForm({ ...profileForm, university: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }}>Save Faculty Profile</button>
          </form>
        </section>
      )}

      <div className="dash-modules">
        <h3 className="dash-section-title">
          <NotebookPen size={20} /> My Uploaded Notes ({myNotes.length})
        </h3>

        {notesError && <p className="upload-error">{notesError}</p>}

        {notesLoading ? (
          <p className="notes-loading"><Loader2 size={18} className="spin" /> Loading your uploads…</p>
        ) : myNotes.length === 0 ? (
          <p className="resource-empty">
            You have not uploaded any notes yet. Use <strong>Upload Notes</strong> above and they
            will appear for students straight away.
          </p>
        ) : (
          <div className="notes-list">
            {myNotes.map((note) => (
              <article className="note-card" key={note.id}>
                <div className="note-card-head">
                  <h3>{note.title}</h3>
                  <span className="note-sem">{note.semester}</span>
                </div>
                {note.description && <p className="note-desc">{note.description}</p>}
                <div className="note-meta">
                  <span><BookOpen size={13} /> {note.subject}</span>
                  <span className="note-stream-tag">
                    {NOTE_STREAMS.find((st) => st.id === note.streamId)?.name || note.streamId}
                  </span>
                  <span>{note.files.length} file{note.files.length === 1 ? "" : "s"}</span>
                </div>

                <div className="note-files">
                  {note.files.map((file) => (
                    <a key={file.publicId || file.url} className="note-file" href={file.url} target="_blank" rel="noreferrer">
                      <FileText size={15} />
                      <span className="note-file-name">{file.name}</span>
                      <span className="note-file-size">{formatBytes(file.size)}</span>
                    </a>
                  ))}
                </div>

                <div className="note-actions">
                  {confirmDelete === note.id ? (
                    <>
                      <span className="note-confirm">Delete this note for everyone?</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setConfirmDelete(null)}
                        disabled={deletingId === note.id}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-danger"
                        onClick={() => handleNoteDelete(note)}
                        disabled={deletingId === note.id}
                      >
                        {deletingId === note.id
                          ? <><Loader2 size={13} className="spin" /> Deleting…</>
                          : <><Trash2 size={13} /> Delete</>}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-xs btn-outline" onClick={() => setConfirmDelete(note.id)}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showNotesModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Upload Notes</h3>
              <button className="btn btn-ghost" onClick={() => setShowNotesModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleNoteSubmit}>
              <Field
                label="Title or Unit Name"
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
                placeholder="e.g. Unit 3 — Normalisation and Keys"
                required
              />
              <SelectField
                label="Branch / Class"
                value={nStream}
                onChange={(e) => setNStream(e.target.value)}
                options={NOTE_STREAMS.map((st) => ({ value: st.id, label: st.name }))}
              />
              <SelectField
                label="Semester"
                value={nSemester}
                onChange={(e) => setNSemester(e.target.value)}
                options={SEMESTERS}
              />
              <Field
                label="Subject"
                icon={BookOpen}
                value={nSubject}
                onChange={(e) => setNSubject(e.target.value)}
                placeholder="e.g. Database Management Systems"
                required
              />
              <Field
                label="Short Description (optional)"
                value={nDesc}
                onChange={(e) => setNDesc(e.target.value)}
                placeholder="What these notes cover..."
              />

              <label className="field-label" style={{ marginTop: 12, display: "block" }}>
                PDF or Images
              </label>
              <label className="note-dropzone">
                <ImagePlus size={20} />
                <span>
                  {nFiles.length
                    ? `${nFiles.length} file${nFiles.length === 1 ? "" : "s"} selected`
                    : "Choose PDFs or photos of handwritten notes"}
                </span>
                <input
                  type="file"
                  accept={ACCEPTED_NOTE_TYPES}
                  multiple
                  hidden
                  onChange={(e) => setNFiles(Array.from(e.target.files || []))}
                />
              </label>

              {nFiles.length > 0 && (
                <ul className="note-file-preview">
                  {nFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`}>
                      <FileText size={13} /> {f.name} <em>{formatBytes(f.size)}</em>
                    </li>
                  ))}
                </ul>
              )}

              {progress && (
                <div className="upload-progress">
                  <div className="upload-progress-bar">
                    <span style={{ width: progress.pct + "%" }} />
                  </div>
                  <small>
                    Uploading file {progress.index} of {progress.total} — {progress.pct}%
                  </small>
                </div>
              )}

              {uploadError && <p className="upload-error" style={{ marginTop: 12 }}>{uploadError}</p>}

              <p className="modal-note-info">
                <Info size={12} /> Uploaded notes appear immediately under Subject-wise Notes for
                students in this branch.
              </p>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowNotesModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={publishing || !nFiles.length}>
                  {publishing ? <><Loader2 size={15} className="spin" /> Uploading…</> : "Publish Notes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================== VIEW: Admin Portal ============================== */

function AdminPortal({ users, onUpdateUser, onDeleteUser }) {
  const [search, setSearch] = useState("");

  /* Quiz participation. Loaded on demand: it is one read per account, so it
     should not be paid for on every visit to the desk. */
  const [activity, setActivity] = useState(null);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState("");

  const loadActivity = async () => {
    setActivityBusy(true);
    setActivityError("");
    try {
      const targets = users.filter((u) => u.role !== "admin");
      const entries = await Promise.all(targets.map(async (u) => {
        const rows = await fetchAttempts(u.id);
        const exams = rows.filter((r) => r.stage === "exam");
        return [u.id, {
          attempts: rows.length,
          practice: rows.length - exams.length,
          exams: exams.length,
          examsPassed: exams.filter((r) => r.passed).length,
          subjects: new Set(rows.map((r) => r.subjectId)).size,
          last: rows.reduce((acc, r) => (r.at && r.at > acc ? r.at : acc), 0),
        }];
      }));
      setActivity(Object.fromEntries(entries));
    } catch (err) {
      setActivityError(err?.message || "Could not read quiz activity.");
    } finally {
      setActivityBusy(false);
    }
  };

  const term = search.trim().toLowerCase();
  const matches = (u) =>
    !term || `${u.name} ${u.email} ${u.city || ""}`.toLowerCase().includes(term);

  /* Each role gets its own table. Mixing them made it hard to answer the two
     questions an administrator actually has: who are my students, and who are
     my teaching staff. */
  const students = users.filter((u) => u.role === "student" && matches(u));
  const faculty = users.filter((u) => u.role === "faculty" && matches(u));
  const admins = users.filter((u) => u.role === "admin" && matches(u));

  const activeUsers = users.filter((u) => !u.restricted).length;
  const blockedUsers = users.filter((u) => u.restricted).length;

  const exportColumns = [
    { header: "Name", value: (u) => u.name },
    { header: "Email", value: (u) => u.email },
    { header: "Phone", value: (u) => u.phone || "" },
    { header: "Role", value: (u) => (u.role || "").toUpperCase() },
    { header: "City", value: (u) => u.city || "" },
    { header: "College", value: (u) => u.college || "" },
    { header: "Degree", value: (u) => u.degree || "" },
    { header: "Branch", value: (u) => u.branch || u.department || "" },
    { header: "Status", value: (u) => (u.restricted ? "RESTRICTED" : "ACTIVE") },
    { header: "Joined", value: (u) => (u.joined ? new Date(u.joined).toLocaleDateString("en-IN") : "") },
  ];

  const exportRows = (rows, label) =>
    downloadCsv(timestampedName(`dnyansetu-${label}`), rows, exportColumns);

  /* One stacked card per account rather than a wide table. A six-column grid
     forced sideways scrolling and read as landscape even on a desktop; a
     column of cards reads top-to-bottom at every width, and gives each account
     room for its notes and quiz activity. */
  const renderPeople = (rows, label) => (
    <div className="admin-people">
      {rows.map((u) => {
        const a = activity?.[u.id];
        return (
          <article className="admin-person" key={u.id}>
            <header className="admin-person-head">
              <div className="admin-person-id">
                <strong>{u.name || "—"}</strong>
                <span className="admin-person-email">{u.email}</span>
              </div>
              <div className="admin-person-tags">
                <RoleBadge role={u.role} />
                <span className={`status-tag ${u.restricted ? "status-blocked" : "status-active"}`}>
                  {u.restricted ? "RESTRICTED" : "ACTIVE"}
                </span>
              </div>
            </header>

            <dl className="admin-person-facts">
              <div>
                <dt>City</dt>
                <dd>{u.city || "—"}</dd>
              </div>
              <div>
                <dt>Subject notes</dt>
                <dd>
                  {u.notesLastOpenedAt
                    ? `Opened ${new Date(u.notesLastOpenedAt).toLocaleDateString("en-IN")}`
                    : "Not opened yet"}
                </dd>
              </div>
              <div>
                <dt>Quiz practice</dt>
                <dd>{activity ? `${a ? a.practice : 0} attempt${(a?.practice ?? 0) === 1 ? "" : "s"}` : "Not loaded"}</dd>
              </div>
              <div>
                <dt>Final exam</dt>
                <dd>
                  {!activity
                    ? "Not loaded"
                    : a && a.exams
                      ? `${a.examsPassed} passed of ${a.exams}`
                      : "Not attempted"}
                </dd>
              </div>
              <div>
                <dt>Subjects covered</dt>
                <dd>{activity ? (a ? a.subjects : 0) : "Not loaded"}</dd>
              </div>
              <div>
                <dt>Last quiz attempt</dt>
                <dd>
                  {!activity
                    ? "Not loaded"
                    : a && a.last
                      ? new Date(a.last).toLocaleDateString("en-IN")
                      : "—"}
                </dd>
              </div>
            </dl>

            <footer className="admin-person-actions">
              <button
                type="button"
                className="btn btn-xs btn-outline"
                aria-label={u.restricted ? `Unblock ${u.name}` : `Block ${u.name}`}
                onClick={() => onUpdateUser({ ...u, restricted: !u.restricted })}
              >
                <Ban size={12} /> {u.restricted ? "Unblock" : "Block"}
              </button>
              {u.role !== "admin" && (
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  aria-label={`Delete ${u.name}`}
                  onClick={() => onDeleteUser(u.id)}
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </footer>
          </article>
        );
      })}

      {rows.length === 0 && (
        <p className="resource-empty" style={{ margin: "6px 0 2px" }}>
          {term ? `No ${label} match “${search.trim()}”.` : `No ${label} yet.`}
        </p>
      )}
    </div>
  );

  const section = (title, rows, label, Icon) => (
    <div className="card" style={{ gridColumn: "1 / -1" }}>
      <div className="admin-section-head">
        <h3><Icon size={18} /> {title} ({rows.length})</h3>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => exportRows(rows, label)}
          disabled={rows.length === 0}
        >
          <FileDown size={15} /> Export to Excel
        </button>
      </div>
      {renderPeople(rows, label)}
    </div>
  );

  return (
    <div className="dash-grid">
      <div style={{ gridColumn: "1 / -1" }} className="card">
        <div>
          <h3><Shield size={20} /> User Directory &amp; Access Control Desk</h3>
          <p className="dash-meta">Monitor accounts and keep the platform secure.</p>
        </div>

        <div className="admin-stat-row">
          {[
            { label: "Total accounts", value: users.length, tone: "total" },
            { label: "Students", value: users.filter((u) => u.role === "student").length },
            { label: "Faculty", value: users.filter((u) => u.role === "faculty").length },
            { label: "Active", value: activeUsers, tone: "ok" },
            { label: "Restricted", value: blockedUsers, tone: blockedUsers ? "warn" : undefined },
          ].map((stat) => (
            <div key={stat.label} className={`admin-stat${stat.tone ? ` admin-stat--${stat.tone}` : ""}`}>
              <span className="admin-stat-label">{stat.label}</span>
              <strong className="admin-stat-value">{stat.value}</strong>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", maxWidth: 420 }}>
            <span style={{ display: "block", fontSize: 12, marginBottom: 6, color: "var(--muted)" }}>Search all accounts</span>
            <input
              className="field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or city"
              aria-label="Search users"
            />
          </label>

          <div className="admin-activity-bar">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={loadActivity}
              disabled={activityBusy || users.length === 0}
            >
              {activityBusy
                ? <><Loader2 size={15} className="spin" /> Reading attempts…</>
                : <><BarChart3 size={15} /> {activity ? "Refresh quiz activity" : "Load quiz activity"}</>}
            </button>
            <span className="admin-activity-hint">
              {activityError
                ? activityError
                : activity
                  ? "Quiz figures below are live."
                  : "Attempts are stored per account — load them to fill in the quiz rows."}
            </span>
          </div>
        </div>
      </div>

      {section("Students", students, "students", GraduationCap)}
      {section("Faculty", faculty, "faculty", NotebookPen)}

      {admins.length > 0 && section("Administrator", admins, "administrators", Shield)}
    </div>
  );
}

/* =============================== Top Nav Bar ============================== */

function TopNavApp({ view, go, onLogout, user }) {
  const hasFullName = Boolean(user.name && user.name.trim().includes(" "));
  const initials = hasFullName
    ? (user.name || "User")
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  const isStudent = user.role === "student";

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <button className="app-brand" type="button" onClick={() => go(isStudent ? "profile" : user.role === "faculty" ? "faculty-portal" : "admin-portal")}>
          <span className="app-brand-mark">
            <BrandLogo variant="mark" />
          </span>
          <span>DnyanSetu</span>
          <span className="app-brand-divider" aria-hidden="true" />
          <span className="app-brand-college">{INSTITUTION.short}</span>
        </button>

        {/* Signing in used to be a one-way door: the header offered nothing but
            the account's own portal, so a student had no route back to the
            notes library, the practice tests or the landing page short of the
            browser's back button. Every destination the account may open is
            listed here instead. */}
        <nav className="app-navigation" aria-label="Application navigation">
          <button type="button" className="app-nav-item" onClick={() => go("landing")}>
            Home
          </button>

          {isStudent && (
            <button type="button" className={`app-nav-item ${view === "profile" ? "active" : ""}`} onClick={() => go("profile")}>
              Profile
            </button>
          )}

          {user.role === "faculty" && (
            <button type="button" className={`app-nav-item ${view === "faculty-portal" ? "active" : ""}`} onClick={() => go("faculty-portal")}>
              Faculty Studio
            </button>
          )}

          {user.role === "admin" && (
            <button type="button" className={`app-nav-item ${view === "admin-portal" ? "active" : ""}`} onClick={() => go("admin-portal")}>
              Admin Control Desk
            </button>
          )}

          <button type="button" className={`app-nav-item ${view === "notes" ? "active" : ""}`} onClick={() => go("notes")}>
            Subject Notes
          </button>

          {isStudent && (
            <button type="button" className={`app-nav-item ${view === "quiz" ? "active" : ""}`} onClick={() => go("quiz")}>
              Quiz &amp; Practice
            </button>
          )}

          <button type="button" className={`app-nav-item ${view === "pyq" ? "active" : ""}`} onClick={() => go("pyq")}>
            Question Papers
          </button>

          <button type="button" className={`app-nav-item ${view === "scholarships" ? "active" : ""}`} onClick={() => go("scholarships")}>
            Scholarships
          </button>
        </nav>

        <div className="app-header-right">
          {/* No menu for any role: the only destination it ever held was the
              user's own space, which the navigation already covers, so the
              avatar is a badge and sign-out sits beside it. */}
          <button
            type="button"
            className="header-profile-button"
            onClick={() => isStudent && go("profile")}
            disabled={!isStudent}
            title={isStudent ? "Open profile" : user.role}
          >
            <span className="header-avatar">
              {user.pfp
                ? <img src={user.pfp} alt="" className="header-avatar-img" />
                : hasFullName ? initials : <User size={15} />}
            </span>
            <span className="header-user-info">
              <strong>{user.name || "User"}</strong>
              <small>{user.role}</small>
            </span>
          </button>

          <button type="button" className="header-logout" onClick={onLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

/* ===================================== App Root ===================================== */

export default function App() {
  const [view, setView] = useState("landing");
  const [authMode, setAuthMode] = useState("login");
  /* Which side of the door the auth screen opens on: the header's own Log in /
     Get Started always mean a student, while "Staff Login" in the nav is the
     only way to reach the Faculty / Admin tabs. */
  const [authRoleScope, setAuthRoleScope] = useState("student");
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState("");
  /* The members-only page a signed-out visitor tried to open, so signing in
     takes them there instead of dumping them on their profile. */
  const [pendingPage, setPendingPage] = useState(null);
  /* "idle" | "checking" | "held" | "denied" — the administrator desk opens in
     one window at a time. */
  const [adminLock, setAdminLock] = useState("idle");
  const adminSessionRef = useRef(null);

  /* Language for the public-facing pages (landing, about, scholarships).
     The picker is asked again on every genuine page load — opening the site
     fresh (a shared/bookmarked link, a new tab) or an actual refresh (F5 /
     pull-to-refresh) — never a one-time thing. This effect's empty deps
     array already means it only runs once per real browser page load (there
     is no client-side router keeping App mounted across a navigation away
     from the site), so no navigation-type check is needed to tell "fresh
     load" apart from a tab switch — a plain tab switch never remounts App
     in the first place. An earlier version gated this on the Navigation
     Timing API reporting a "reload", which meant opening the site via a
     link (type "navigate") skipped the picker whenever a language was
     already saved from a previous visit — only F5 actually triggered it. */
  const [lang, setLangState] = useState("en");
  const [askLang, setAskLang] = useState(true);
  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch { /* storage blocked */ }
    if (saved === "en" || saved === "mr") setLangState(saved);
  }, []);
  const setLang = (value) => {
    setLangState(value);
    setAskLang(false);
    try { localStorage.setItem(LANG_KEY, value); } catch { /* storage blocked */ }
  };

  /* With no backend keys the app still runs, on the original seed data, so
     the interface can be worked on before the backend exists. Accounts,
     uploads and cross-device progress are the parts that need the real thing. */
  const demoMode = !isBackendConfigured;

  /* The browser's own history is the single source of truth for navigation —
     no parallel in-app stack to fall out of sync with it. navigateTo pushes a
     real entry, so the hardware/gesture back button and every in-app "Back"
     button (which both funnel through goBack) land on exactly the same
     screen the browser back button would. replaceView is for transitions
     where the previous screen should never come back (auth, after logout,
     after a session gets forced out) — it swaps the current entry instead of
     adding one.

     A page with its own internal drill-down (year -> subject -> level, for
     instance) registers a step-back function via registerPageBack; when one
     is registered it gets first refusal on every back gesture, and the
     top-level view only actually changes once that function has nothing left
     to unwind. */
  const pageBackRef = useRef(null);
  const registerPageBack = useCallback((fn) => { pageBackRef.current = fn; }, []);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const navigateTo = (next) => {
    window.history.pushState({ view: next }, "");
    setView(next);
    window.scrollTo(0, 0);
  };
  const replaceView = (next) => {
    window.history.replaceState({ view: next }, "");
    setView(next);
  };
  /* This is the onBack a page falls through to once its own stepBack (the
     one registered in pageBackRef) has nothing left to unwind — so it must
     never consult pageBackRef itself, or a page whose stepBack ends by
     calling onBack() would call straight back into itself forever. Hardware
     back is the only caller that needs the pageBackRef check, and it makes
     that check directly in the popstate handler below. */
  const goBack = () => {
    window.history.back();
  };

  const redirectUser = (u) => {
    if (!u) return;
    /* Straight back to whatever they were trying to open before signing in. */
    if (pendingPage) {
      const target = pendingPage;
      setPendingPage(null);
      setNotice("");
      replaceView(target);
      return;
    }
    if (u.role === "admin") replaceView("admin-portal");
    else if (u.role === "faculty") replaceView(u.qualification ? "faculty-portal" : "faculty-setup");
    else replaceView("profile");
  };

  /* Pulls the signed-in user's profile, and for an admin the user directory
     too. Returns the profile so callers can redirect. */
  const loadForSession = useCallback(async (session) => {
    if (!session?.user) {
      setCurrentUser(null);
      setUsers([]);
      return null;
    }
    try {
      const profile = await fetchProfile(session.user.id);
      if (!profile) return null;

      if (profile.restricted || profile.status === "deleted") {
        await signOut();
        setCurrentUser(null);
        setNotice("This account has been restricted. Please contact the administrator.");
        return null;
      }

      const full = normalizeStudentProfile(profile);
      setCurrentUser(full);
      if (full.role === "admin") {
        /* A denied directory read used to be swallowed here, so a broken admin
           profile looked identical to a platform with no users on it. Say what
           actually happened instead. */
        try {
          setUsers(await listProfiles());
        } catch (e) {
          console.error(e);
          setUsers([]);
          setNotice(
            "Signed in as administrator, but the user directory could not be read. " +
            "Check that this account's profile document has status 'active' and restricted 'false'.",
          );
        }
      }
      return full;
    } catch (err) {
      console.error("Could not load profile", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (demoMode) {
        setUsers(SEED_USERS);
        setBooting(false);
        return;
      }
      const session = await getSession();
      if (!active) return;
      const profile = await loadForSession(session);
      if (!active) return;
      try {
        const saved = sessionStorage.getItem(VIEW_KEY);
        if (mayOpenView(saved, profile)) replaceView(saved);
      } catch { /* storage blocked — start on the landing page */ }
      if (active) setBooting(false);
    })();
    return () => { active = false; };
  }, [demoMode, loadForSession]);

  /* Remembers the current page so a refresh returns to it. The auth screen is
     never stored: coming back to a login form you already completed is worse
     than coming back to the landing page. */
  useEffect(() => {
    if (booting) return;
    try {
      if (view === "auth") sessionStorage.removeItem(VIEW_KEY);
      else sessionStorage.setItem(VIEW_KEY, view);
    } catch { /* private mode or storage disabled — refresh just loses the spot */ }
  }, [view, booting]);

  /* Establishes the very first history entry once, then answers every
     hardware/gesture/browser back press from here on. A page's own
     registered step-back (see pageBackRef above) gets first refusal — it
     returns true if it unwound something locally and false once it has
     nothing left, so this never has to guess whether the gesture was
     actually handled. When it has nothing left, the entry the browser landed
     on names the view to show — read from event.state rather than
     re-deriving it, so this never needs to re-subscribe (and never
     re-pushes) on every view change. */
  useEffect(() => {
    window.history.replaceState({ view: "landing" }, "");
    const onPop = (e) => {
      if (pageBackRef.current?.()) {
        /* The physical back was absorbed by the page's own drill-down, so put
           the entry back — the browser's stack depth still has to match, and
           the top-level view never actually changed. */
        window.history.pushState({ view: viewRef.current }, "");
        return;
      }
      setView(e.state?.view || "landing");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* Keeps this tab honest when the session ends elsewhere or a token expires. */
  useEffect(() => {
    if (demoMode) return undefined;
    return onAuthChange((session) => {
      if (!session) {
        setCurrentUser(null);
        setUsers([]);
        /* Staying put when the auth screen is already open: signup ends its own
           session on purpose, and bouncing to the landing page there would wipe
           the "sign up successful" confirmation before it could be read. */
        if (viewRef.current !== "auth") replaceView("landing");
      }
    });
  }, [demoMode]);

  /* Claims the single administrator session for this window, and keeps it while
     the account stays signed in. A second window finds the lock held and is
     refused; if this one dies without releasing, the heartbeat stops and the
     lock goes stale so the next window can take over. */
  useEffect(() => {
    if (demoMode || currentUser?.role !== "admin") {
      setAdminLock("idle");
      return undefined;
    }

    let cancelled = false;
    const sessionId = newSessionId();
    adminSessionRef.current = sessionId;
    setAdminLock("checking");

    let beat;
    let unwatch = () => {};

    (async () => {
      const result = await claimAdminSession(currentUser.id, sessionId);
      if (cancelled) return;

      if (!result.ok) {
        setAdminLock("denied");
        return;
      }

      setAdminLock("held");
      beat = setInterval(() => beatAdminSession(currentUser.id, sessionId), HEARTBEAT_MS);
      /* Covers the race where two windows both saw an empty lock and both wrote:
         whichever write landed second owns it, and the other steps down. */
      unwatch = watchAdminSession(sessionId, () => {
        if (!cancelled) setAdminLock("denied");
      });
    })();

    /* A closed tab releases immediately rather than waiting out the TTL. */
    const onLeave = () => releaseAdminSession(sessionId);
    window.addEventListener("pagehide", onLeave);

    return () => {
      cancelled = true;
      clearInterval(beat);
      unwatch();
      window.removeEventListener("pagehide", onLeave);
      releaseAdminSession(sessionId);
      adminSessionRef.current = null;
    };
  }, [currentUser?.role, currentUser?.id, demoMode]);

  /* Stamps the account when it opens the notes library, so the admin desk can
     show who has actually used it. Fire-and-forget; failure never blocks reading. */
  useEffect(() => {
    if (demoMode || view !== "notes" || !currentUser?.id) return;
    markNotesOpened(currentUser.id);
  }, [view, currentUser?.id, demoMode]);

  /* Catches the cases the click guard cannot: a session that expired while the
     page was open, or the back button landing on a members-only view. */
  useEffect(() => {
    if (booting) return;
    if (MEMBERS_ONLY_PAGES.has(view) && !currentUser) {
      setPendingPage(view);
      setAuthMode("login");
      setNotice("Please sign in with your registered email and password to open this.");
      replaceView("auth");
    }
  }, [view, currentUser, booting]);

  /* First-run setup for a new account: tracking id and profile summary. */
  const seedNewProfile = async (profile) => {
    const trackingId = profile.trackingId
      || generateTrackingId({ name: profile.name, city: profile.city, role: profile.role, existingUsers: [] });
    const patch = { ...profile, trackingId };
    if (profile.role === "student") {
      patch.summary = buildProfileSummary(patch);
      patch.recommendations = generateStudentRecommendations(patch);
    }
    try { await updateProfile(profile.id, patch); } catch (e) { console.error(e); }
  };

  const handleAuthSubmit = async (creds) => {
    const email = (creds.email || "").trim().toLowerCase();

    if (demoMode) {
      const existing = users.find((u) => u.email && u.email.toLowerCase() === email);
      if (creds.mode === "signup") {
        if (existing) return { success: false, message: "An account with this email already exists. Please log in instead." };
        const newUser = normalizeStudentProfile({
          id: "user-" + Date.now(), role: creds.role, name: creds.name, email,
          phone: "", status: "active", restricted: false, joined: Date.now(),
        });
        setUsers([...users, newUser]);
        setAuthMode("login");
        return { success: true, message: "Sign up successful! Please sign in with your email and password." };
      }
      if (!existing) return { success: false, message: "No account found for that email. Please sign up first." };
      if (existing.role === "admin" && creds.password !== DEMO_ADMIN_PASSWORD) {
        return { success: false, message: "Incorrect password." };
      }
      const full = normalizeStudentProfile(existing);
      setCurrentUser(full);
      redirectUser(full);
      return { success: true, message: "Login successful." };
    }

    if (!email) {
      return { success: false, message: "Please use your registered email address to continue." };
    }

    if (creds.mode === "signup") {
      const result = await signUp({ name: creds.name, email, password: creds.password, role: creds.role });
      if (!result.success) return result;
      if (result.needsConfirmation) {
        setAuthMode("login");
        return result;
      }
      /* Firebase signs the new account in automatically. Seed the profile while
         that session is still live, then end it: signing in is a deliberate
         second step, so the user sees the confirmation and logs in themselves. */
      try {
        const profile = await loadForSession(await getSession());
        if (profile) await seedNewProfile(profile);
      } catch (err) {
        console.error(err);
      }
      await signOut();
      setCurrentUser(null);
      setAuthMode("login");
      return { success: true, message: "Sign up successful! Please sign in with your email and password." };
    }

    const result = await signIn({ email, password: creds.password });
    if (!result.success) return result;
    const profile = await loadForSession(await getSession());
    if (!profile) return { success: false, message: "Signed in, but your profile could not be loaded. Please try again." };
    redirectUser(profile);
    return { success: true, message: "Login successful." };
  };

  const handleFacultySetupComplete = async (data) => {
    const trackingId = currentUser?.trackingId
      || generateTrackingId({ name: data.name, city: data.city, role: "faculty", existingUsers: [] });
    const updated = { ...currentUser, ...data, trackingId };
    setCurrentUser(updated);
    if (!demoMode) {
      try { await updateProfile(updated.id, updated); } catch (e) { setNotice("Could not save your details."); }
    }
    replaceView("faculty-portal");
  };

  const handleProfileEdit = async (updatedU) => {
    setCurrentUser(updatedU);
    if (demoMode) {
      setUsers(users.map((u) => (u.id === updatedU.id ? updatedU : u)));
      return;
    }
    try {
      const saved = await updateProfile(updatedU.id, updatedU);
      if (saved) {
        setCurrentUser(normalizeStudentProfile(saved));
      }
    } catch (err) {
      setNotice("Could not save your profile changes.");
    }
  };

  const handleUpdateUser = async (updatedU) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedU.id ? updatedU : u)));
    if (demoMode) return;
    try {
      await adminUpdateProfile(updatedU);
      setUsers(await listProfiles());
    } catch (err) {
      setNotice("Could not update that account.");
    }
  };

  const handleDeleteUser = async (userId) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (demoMode) return;
    try {
      await adminDeleteProfile(userId);
    } catch (err) {
      setNotice("Could not remove that account.");
      try { setUsers(await listProfiles()); } catch (e) { console.error(e); }
    }
  };

  const logout = async () => {
    if (!demoMode) await signOut();
    setCurrentUser(null);
    setUsers([]);
    setPendingPage(null);
    try { sessionStorage.removeItem(VIEW_KEY); } catch { /* ignore */ }
    replaceView("landing");
  };

  /* Members-only pages bounce to the login tab instead of opening. Checked here
     rather than only on the card, so a deep link or a back-button jump lands in
     the same place. */
  const openPage = (page) => {
    if (MEMBERS_ONLY_PAGES.has(page) && !currentUser) {
      setPendingPage(page);
      setAuthMode("login");
      setNotice("Please sign in with your registered email and password to open this.");
      navigateTo("auth");
      return;
    }
    navigateTo(page);
  };

  if (booting) {
    return (
      <div className="arcsas">
        <Styles />
        <div className="boot-screen"><Loader2 size={20} className="spin" /> Loading DnyanSetu Platform…</div>
      </div>
    );
  }

  /* The header carries the only navigation a signed-in account has, so it rides
     along on every page reached from it — not just the three portals. It needs
     a user to render, so a signed-out visitor on an open page still sees none. */
  const isAppView = Boolean(currentUser)
    && ["profile", "faculty-portal", "admin-portal", "notes", "quiz", "pyq", "scholarships"].includes(view);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
    <div className="arcsas">
      <Styles />

      {askLang && <LanguagePicker onChoose={setLang} />}

      {/* Without backend keys the app runs on seed data, which is easy to miss
          until a signup silently fails to persist. Say so plainly. */}
      {demoMode && view === "landing" && (
        <div className="app-notice app-notice--setup" role="status">
          <AlertTriangle size={15} />
          <span>
            Running on offline demo data — accounts and uploads are not saved yet.
            Add your Firebase and Cloudinary keys to <code>.env.local</code> to switch it on. See SETUP.md.
          </span>
        </div>
      )}

      {/* Backend problems surface here rather than in a silent console log. */}
      {notice && (
        <div className="app-notice" role="status">
          <AlertTriangle size={15} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {isAppView && (
        <TopNavApp
          view={view}
          go={navigateTo}
          onLogout={logout}
          user={currentUser}
        />
      )}

      {view === "landing" && (
        <Landing
          goAuth={(m, scope) => { setAuthMode(m); setAuthRoleScope(scope || "student"); navigateTo("auth"); }}
          onOpenAbout={() => navigateTo("about")}
          onOpenPage={openPage}
        />
      )}
      {view === "about" && <AboutPage onBack={goBack} />}
      {view === "pyq" && <PyqPage onBack={goBack} />}
      {(view === "privacy" || view === "terms") && (
        <Suspense fallback={<div className="boot-screen"><Loader2 size={20} className="spin" /> Loading…</div>}>
          <LegalPage kind={view} onBack={goBack} />
        </Suspense>
      )}
      {view === "notes" && currentUser && (
        <Suspense fallback={<div className="boot-screen"><Loader2 size={20} className="spin" /> Loading notes…</div>}>
          <NotesPage onBack={goBack} onRegisterBack={registerPageBack} />
        </Suspense>
      )}
      {view === "quiz" && currentUser && (
        <Suspense fallback={<div className="boot-screen"><Loader2 size={20} className="spin" /> Loading practice tests…</div>}>
          <QuizPage onBack={goBack} onRegisterBack={registerPageBack} user={currentUser} />
        </Suspense>
      )}
      {view === "scholarships" && <ScholarshipsPage onBack={goBack} onRegisterBack={registerPageBack} />}
      {view === "auth" && (
        <AuthScreen mode={authMode} setMode={setAuthMode} roleScope={authRoleScope} onSubmit={handleAuthSubmit} goLanding={() => replaceView("landing")} />
      )}
      {view === "faculty-setup" && <FacultyProfileSetup profile={currentUser} onComplete={handleFacultySetupComplete} />}
      {view === "profile" && currentUser?.role === "student" && (
        <StudentProfile profile={currentUser} onSaveProfile={handleProfileEdit} />
      )}
      {view === "faculty-portal" && (
        <FacultyPortal profile={currentUser} onSaveProfile={handleProfileEdit} />
      )}
      {view === "admin-portal" && adminLock === "denied" && (
        <main className="resource-page pyq-page">
          <div className="resource-head">
            <div className="resource-head-copy">
              <p className="section-eyebrow"><Shield size={14} /> Access denied</p>
              <h1 className="resource-title">The administrator desk is open elsewhere</h1>
              <p className="resource-sub">
                This account may be used in one window at a time. Close the other tab, window
                or device that has it open, then try again — the session is released as soon as
                that window closes.
              </p>
            </div>
          </div>
          <div className="admin-denied">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </main>
      )}
      {view === "admin-portal" && adminLock === "checking" && (
        <div className="boot-screen"><Loader2 size={20} className="spin" /> Checking administrator session…</div>
      )}
      {view === "admin-portal" && (adminLock === "held" || adminLock === "idle") && (
        <AdminPortal users={users} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />
      )}
    </div>
    </LangContext.Provider>
  );
}

/* =============================== Language Picker ============================== */

function LanguagePicker({ onChoose }) {
  return (
    <div className="lang-picker-overlay" role="dialog" aria-modal="true" aria-label="Choose your language">
      <div className="lang-picker-card">
        <div className="lang-picker-icon"><Languages size={22} /></div>
        <h2 className="lang-picker-title">
          <span>Choose your language</span>
          <span>आपली भाषा निवडा</span>
        </h2>
        <p className="lang-picker-sub">
          <span>You can change this anytime from the navigation bar.</span>
          <span>तुम्ही ही भाषा नेव्हिगेशन बारमधून केव्हाही बदलू शकता.</span>
        </p>
        <div className="lang-picker-actions">
          <button type="button" className="btn btn-primary lang-picker-btn" onClick={() => onChoose("en")}>
            English
          </button>
          <button type="button" className="btn btn-outline lang-picker-btn" onClick={() => onChoose("mr")}>
            मराठी
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================================== Styles =================================== */

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

      .arcsas {
        --abc-navy: #0B1E2E;
        --abc-navy-light: #162E44;
        --abc-saffron: #E65100;
        --abc-saffron-hover: #D84315;
        --abc-saffron-bg: #FFF7ED;
        --abc-blue: #1D4ED8;
        --abc-cyan: #0284C7;
        --abc-emerald: #059669;
        --abc-purple: #8B5CF6;
        --abc-rose: #DC2626;

        --bg-canvas: #F8FAFC;
        --bg-card: #FFFFFF;
        --bg-card-hover: #F8FAFC;
        --border-light: #E2E8F0;
        --border-strong: #CBD5E1;

        --text-dark: #0F172A;
        --text-subtle: #334155;
        --text-muted: #64748B;

        --radius: 12px;
        --radius-sm: 8px;
        --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.05);
        --shadow-md: 0 4px 12px -2px rgba(15, 23, 42, 0.08);
        --shadow-lg: 0 12px 28px -6px rgba(15, 23, 42, 0.12);

        background: var(--bg-canvas);
        color: var(--text-dark);
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        min-height: 100vh;
        font-size: 15px;
        line-height: 1.5;
      }
      .arcsas * { box-sizing: border-box; }
      .arcsas h1, .arcsas h2, .arcsas h3, .arcsas h4 { font-family: 'Space Grotesk', system-ui, sans-serif; margin: 0; letter-spacing: -0.02em; color: var(--text-dark); }
      .arcsas p { margin: 0; }
      .arcsas button { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; cursor: pointer; }

      /* ================= Multi-Color Animations ================= */

      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes textGradientWave {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes multiColorGlowIcon {
        0% { color: #E65100; filter: drop-shadow(0 0 6px rgba(230, 81, 0, 0.5)); }
        25% { color: #0284C7; filter: drop-shadow(0 0 6px rgba(2, 132, 199, 0.5)); }
        50% { color: #059669; filter: drop-shadow(0 0 6px rgba(5, 150, 105, 0.5)); }
        75% { color: #8B5CF6; filter: drop-shadow(0 0 6px rgba(139, 92, 246, 0.5)); }
        100% { color: #E65100; filter: drop-shadow(0 0 6px rgba(230, 81, 0, 0.5)); }
      }

      @keyframes multiColorBorderCycle {
        0% { border-color: #E65100; box-shadow: 0 4px 15px rgba(230, 81, 0, 0.18); }
        25% { border-color: #0284C7; box-shadow: 0 4px 15px rgba(2, 132, 199, 0.18); }
        50% { border-color: #059669; box-shadow: 0 4px 15px rgba(5, 150, 105, 0.18); }
        75% { border-color: #8B5CF6; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.18); }
        100% { border-color: #E65100; box-shadow: 0 4px 15px rgba(230, 81, 0, 0.18); }
      }

      .brand-bg {
        display: inline-block;
        padding: 6px 12px;
        border-radius: 999px;
        color: #ffffff;
        background: linear-gradient(90deg, #E65100 0%, #0284C7 33%, #059669 66%, #8B5CF6 100%);
        background-size: 300% 100%;
        animation: gradientShift 6s linear infinite;
        box-shadow: 0 6px 18px rgba(15,23,42,0.08);
        font-weight: 700;
      }

      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

      @keyframes fadeUpIn {
        from { opacity: 0; transform: translateY(28px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes navEnter {
        from { opacity: 0; transform: translateY(-14px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes floatSoft {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }

      @keyframes orbDrift {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
        50% { transform: translate(18px, -22px) scale(1.08); opacity: 0.75; }
      }

      @keyframes tagShimmer {
        0%, 100% { opacity: 0.85; letter-spacing: 0.12em; }
        50% { opacity: 1; letter-spacing: 0.16em; }
      }

      @keyframes sectionReveal {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes bannerShimmer {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }

      .anim-fade-up { animation: fadeUpIn 0.75s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .anim-delay-1 { animation-delay: 0.08s; }
      .anim-delay-2 { animation-delay: 0.16s; }
      .anim-delay-3 { animation-delay: 0.24s; }
      .anim-delay-4 { animation-delay: 0.32s; }
      .anim-delay-5 { animation-delay: 0.42s; }
      .anim-nav-enter { animation: navEnter 0.65s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 0.05s; }
      .anim-float { animation: floatSoft 6s ease-in-out infinite; animation-delay: 0.6s; }
      .anim-section-reveal { animation: sectionReveal 0.85s cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 0.35s; }

      @media (prefers-reduced-motion: reduce) {
        .anim-fade-up, .anim-nav-enter, .anim-float, .anim-section-reveal, .brand-logo-frame, .pulse-icon, .landing-orb, .stream-box, .landing-brand-tag {
          animation: none !important;
        }
      }

      .pulse-icon { animation: multiColorGlowIcon 4s ease-in-out infinite; }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }


      .alison-landing {
        position: relative;
        /* NOT overflow:hidden — that establishes this as .nav-marketing's
           nearest scrolling ancestor and silently breaks position:sticky
           (the nav stops pinning and just scrolls away with the page).
           .landing-bg-mesh below already clips the decorative orbs on its
           own, so nothing here actually needs the clipping. */
      }
      .landing-bg-mesh {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
      }
      .landing-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(60px);
        animation: orbDrift 14s ease-in-out infinite;
      }
      .landing-orb-1 {
        width: 420px;
        height: 420px;
        top: -120px;
        right: -80px;
        background: radial-gradient(circle, rgba(29, 78, 216, 0.18), transparent 70%);
      }
      .landing-orb-2 {
        width: 360px;
        height: 360px;
        bottom: 10%;
        left: -100px;
        background: radial-gradient(circle, rgba(230, 81, 0, 0.12), transparent 70%);
        animation-delay: -4s;
      }
      .landing-orb-3 {
        width: 280px;
        height: 280px;
        top: 42%;
        left: 45%;
        background: radial-gradient(circle, rgba(5, 150, 105, 0.10), transparent 70%);
        animation-delay: -8s;
      }
      .alison-landing > *:not(.landing-bg-mesh) {
        position: relative;
        z-index: 1;
      }
      /* The rule above outranks .nav-marketing on specificity, which would drop the
         nav (and its search dropdown) behind the hero AND silently downgrade its
         position:sticky back to relative — the actual reason the nav never
         stuck to the top while scrolling. Restore both here. */
      .alison-landing > .nav-marketing { position: sticky; z-index: 60; }
      
      .nav-marketing {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 10px 28px;
        background: #FFFFFF;
        position: sticky;
        top: 0;
        z-index: 50;
        border-bottom: 3px solid var(--abc-navy, #0B1E2E);
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.06);
        margin: 0;
        border-radius: 0;
        transition: box-shadow 0.3s ease, top 0.3s ease, margin 0.3s ease, border-radius 0.3s ease;
      }
      /* Once the identity strip above has folded away on scroll, the nav
         detaches from the very top edge and reads as a floating bar. */
      .nav-marketing.is-floating {
        top: 12px;
        margin: 0 16px;
        border-radius: 14px;
        border-bottom: none;
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
      }
      .nav-gov-brand {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
        flex: 0 1 auto;
      }
      /* Slim identity strip above the main nav — carries the college's full
         legal name, the way a government site's top bar carries "Government
         of India", so the crest in the row below doesn't have to. A tricolor
         hairline on top gives it the same civic, official read as the rest
         of the government-style header. */
      .nav-topstrip {
        position: relative;
        display: flex; align-items: center; justify-content: center; gap: 10px;
        background: linear-gradient(90deg, #0B1E2E 0%, #143753 50%, #0B1E2E 100%);
        padding: 7px 20px;
        text-align: center;
        overflow: hidden;
        max-height: 40px;
        opacity: 1;
        transition: max-height 0.32s ease, padding 0.32s ease, opacity 0.24s ease;
      }
      /* Folds away once the page scrolls, so the nav below can float free of
         the top edge the way ux4g.gov.in's condenses on scroll. */
      .nav-topstrip.is-collapsed {
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
      }
      .nav-topstrip::before {
        content: "";
        position: absolute; top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(90deg, #E65100 0%, #E65100 33%, #FFFFFF 33%, #FFFFFF 66%, #059669 66%, #059669 100%);
      }
      .nav-topstrip-text {
        font-size: 11.5px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .nav-topstrip-trust { color: #FFB74D; }
      .nav-topstrip-name { color: #FFFFFF; font-weight: 700; margin-left: 6px; }
      .nav-topstrip-dot {
        display: inline-block;
        width: 4px; height: 4px; margin: 0 2px;
        border-radius: 50%;
        background: #4CAF7D;
        vertical-align: middle;
      }
      .nav-marketing .brand, .nav-app .brand {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        font-weight: 800;
        font-size: 22px;
        cursor: pointer;
        color: var(--abc-navy);
        letter-spacing: -0.03em;
        line-height: 1;
      }
      .brand-logo-inline { display: inline-flex; align-items: center; gap: 12px; }
      .landing-brand-wrap {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }

      .brand-logo-frame {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 14px;
        background: linear-gradient(145deg, #0B1E2E 0%, #1a3650 100%);
        border: 1px solid rgba(255, 255, 255, 0.10);
        box-shadow: 0 4px 16px rgba(11, 30, 46, 0.18);
      }
      /* The mark is itself a circular badge, so these variants drop the plate
         and let the logo stand on its own. */
      .brand-logo-frame--mark,
      .brand-logo-frame--nav,
      .brand-logo-frame--footer {
        width: 48px;
        height: 48px;
        padding: 0;
        border-radius: 50%;
        background: transparent;
        border: 0;
        animation: none;
      }
      .brand-logo-frame--full {
        width: min(128px, 45%);
        aspect-ratio: 1 / 1;
        padding: 14px 16px;
        border-radius: 20px;
        background: linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      }
      .brand-logo-image {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
        image-rendering: -webkit-optimize-contrast;
        pointer-events: none;
        user-select: none;
      }
      /* The mark used to be scaled to 145% inside an overflow-hidden frame, which
         cropped the wordmark. Contain it instead so the whole logo stays visible. */
      .brand-logo-frame--mark .brand-logo-image,
      .brand-logo-frame--nav .brand-logo-image,
      .brand-logo-frame--footer .brand-logo-image {
        width: 100%;
        height: 100%;
        object-position: center;
        transform: none;
      }

      /* This page is one short message and one link, so it is centred on the
         page rather than hugging the left edge like the multi-column resource
         pages. Scoped to .pyq-page: Notes and Scholarships share these classes
         and must stay left-aligned. */
      .pyq-page .resource-head { align-items: stretch; }
      .pyq-page .resource-head > .btn { align-self: flex-start; }
      .pyq-page .resource-head-copy { max-width: 720px; margin-inline: auto; text-align: center; }
      .pyq-page .resource-head .section-eyebrow { justify-content: center; }

      /* The question paper page is a single outbound link, so it is given the
         weight of a card rather than a line of blue text. */
      .pyq-official {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 14px;
        max-width: 560px;
        margin: 32px auto 0;
        padding: 30px 28px;
        border: 1px solid var(--border-light);
        border-radius: var(--radius-md);
        background: #FFFFFF;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.07);
        text-decoration: none;
        color: inherit;
        transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
      }
      .pyq-official:hover {
        border-color: var(--abc-blue);
        box-shadow: 0 14px 32px rgba(15, 23, 42, 0.12);
        transform: translateY(-2px);
      }
      .pyq-official-icon {
        flex: 0 0 52px;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: #EFF6FF;
        color: var(--abc-blue);
      }
      .pyq-official-copy { display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0; }
      .pyq-official-copy strong { font-size: 16px; color: var(--text-strong); }
      .pyq-official-copy small { font-size: 13px; line-height: 1.6; color: var(--text-muted); }
      .pyq-official-host {
        font-size: 12px;
        font-weight: 600;
        color: var(--abc-blue);
        letter-spacing: 0.01em;
      }
      .pyq-official-arrow { flex: 0 0 auto; color: var(--text-muted); }
      .pyq-official:hover .pyq-official-arrow { color: var(--abc-blue); }
      @media (max-width: 640px) {
        .pyq-official { padding: 24px 20px; }
      }

      /* ---------------------- Admin control desk ---------------------- */
      .admin-stat-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-top: 18px;
      }
      .admin-stat {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        border: 1px solid var(--border-light);
        border-left: 3px solid var(--border-strong);
        border-radius: var(--radius-sm);
        background: #FFFFFF;
      }
      .admin-stat--total { border-left-color: var(--abc-blue); background: #F8FAFF; }
      .admin-stat--ok { border-left-color: #16A34A; }
      .admin-stat--warn { border-left-color: #DC2626; }
      .admin-stat-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .admin-stat-value {
        font-size: 26px;
        font-weight: 700;
        line-height: 1;
        color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif;
      }

      .admin-denied { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 26px; }

      .admin-activity-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 14px;
      }
      .admin-activity-hint { font-size: 12.5px; color: var(--text-muted); }

      /* One column of account cards. Deliberately not a table: the desk is read
         top-to-bottom on a phone and on a desktop alike, and each account needs
         room for its notes and quiz figures. */
      .admin-people { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
      .admin-person {
        border: 1px solid var(--border-light);
        border-left: 3px solid var(--abc-blue);
        border-radius: var(--radius-sm);
        background: #FFFFFF;
        padding: 16px 18px;
      }
      .admin-person-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-light);
      }
      .admin-person-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .admin-person-id strong { font-size: 15px; color: var(--text-strong); }
      .admin-person-email { font-size: 12.5px; color: var(--text-muted); word-break: break-all; }
      .admin-person-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

      .admin-person-facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px 18px;
        margin: 14px 0 0;
      }
      .admin-person-facts dt {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 3px;
      }
      .admin-person-facts dd { margin: 0; font-size: 13.5px; color: var(--text-strong); font-weight: 600; }

      .admin-person-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--border-light);
      }

      @media (max-width: 640px) {
        .admin-person { padding: 14px; }
        .admin-person-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
      }

      /* ================= Host Institution Crest & Lockup ================= */
      .college-crest {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 50%;
        background: #FFFFFF;
        border: 1px solid rgba(11, 30, 46, 0.12);
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.14);
      }
      .college-crest img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
      }
      .college-crest--banner { border-color: rgba(255, 255, 255, 0.55); }
      .college-crest--nav,
      .college-crest--appbar { box-shadow: 0 2px 6px rgba(15, 23, 42, 0.10); }

      .institution-lockup {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .institution-lockup-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .institution-trust {
        font-family: 'JetBrains Mono', monospace;
        font-size: 9px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.72;
      }
      .institution-name {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.35;
      }
      .institution-meta {
        font-size: 10px;
        line-height: 1.45;
        opacity: 0.68;
      }
      .institution-lockup--light { color: var(--abc-navy); }
      .institution-lockup--dark { color: rgba(255, 255, 255, 0.94); }

      .landing-brand-divider,
      .app-brand-divider {
        width: 1px;
        align-self: stretch;
        min-height: 26px;
        margin: 0 2px;
        background: rgba(11, 30, 46, 0.14);
      }
      .app-brand-college {
        font-family: 'Space Grotesk', 'Plus Jakarta Sans', system-ui, sans-serif;
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1.25;
        letter-spacing: 0.005em;
        color: var(--abc-navy);
        max-width: 260px;
        text-align: left;
      }

      .footer-institution {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
      }
      .footer-institution-copy {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .footer-institution-copy strong { font-size: 12px; color: #FFFFFF; line-height: 1.4; }
      .footer-institution-copy small { font-size: 10px; color: rgba(255, 255, 255, 0.62); line-height: 1.45; }

      /* Sole brand element on the login panel now, so it centres itself. */
      .auth-brand-institution {
        flex-direction: column;
        justify-content: center;
        text-align: center;
      }
      .auth-brand-institution .institution-lockup-copy { align-items: center; }
      .brand-logo-frame--full .brand-logo-image {
        width: 118%;
        height: 118%;
        object-position: center 18%;
        filter: contrast(1.1) saturate(1.08) drop-shadow(0 8px 18px rgba(0,0,0,0.35));
      }
      .app-brand-mark .brand-logo-frame {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        padding: 0;
        animation: none;
        box-shadow: none;
      }
      .app-brand-mark .brand-logo-image {
        width: 100%;
        height: 100%;
        object-position: center;
      }

      .landing-brand-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        line-height: 1;
        gap: 5px;
      }
      .landing-brand-name {
        font-size: clamp(1.2rem, 1.95vw, 2.1rem);
        font-weight: 900;
        letter-spacing: -0.06em;
        background: linear-gradient(135deg, #0f172a 0%, #1D4ED8 50%, #0f172a 100%);
        background-size: 200% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: textGradientWave 6s ease infinite;
        font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
      }
      .landing-brand-tag {
        font-size: 0.62rem;
        letter-spacing: 0.12em;
        text-transform: lowercase;
        color: #0284C7;
        font-weight: 700;
        font-family: 'Segoe UI', 'Inter', 'Arial', sans-serif;
        margin-left: 2px;
        animation: tagShimmer 3s ease-in-out infinite;
      }
      .brand-accent {
        background: linear-gradient(90deg, #E65100, #0284C7, #059669, #8B5CF6);
        background-size: 220% 220%;
        animation: textGradientWave 4s ease infinite;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 900;
      }
      .brand-dot { color: var(--abc-saffron); animation: multiColorGlowIcon 3s infinite; font-weight: 900; }

      /* Hero Section */
      .hero-alison { display: grid; grid-template-columns: 1fr; gap: 28px; justify-items: center; align-items: center; padding: 72px 48px 72px; max-width: 1200px; margin: 0 auto; position: relative; }

      .hero-welcome { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
      .hero-welcome-eyebrow {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 14px;
        border-radius: 999px;
        background: rgba(230, 81, 0, 0.1);
        color: var(--abc-saffron);
        font-size: 12px; font-weight: 700;
        letter-spacing: 0.04em; text-transform: uppercase;
        animation: heroWelcomeIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .hero-welcome-title {
        font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        font-size: clamp(1.8rem, 4vw, 3rem);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--abc-navy);
        animation: heroWelcomeIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        animation-delay: 0.08s;
      }
      /* A static gradient fill (no animated background-position) — animating
         a background-clip:text layer can cause a visible solid-color flash
         while the compositor catches up in some Chromium builds. */
      .hero-welcome-brand {
        background: linear-gradient(90deg, #E65100 0%, #0284C7 55%, #8B5CF6 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .hero-welcome-rule {
        display: block;
        width: 84px; height: 4px;
        border-radius: 999px;
        background: linear-gradient(90deg, #E65100, #0284C7, #059669, #8B5CF6);
        animation: heroWelcomeIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        animation-delay: 0.16s;
      }
      @keyframes heroWelcomeIn {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .hero-accent { 
        background: linear-gradient(90deg, #E65100, #0284C7, #059669, #8B5CF6, #E65100);
        background-size: 300% 300%;
        animation: textGradientWave 5s ease infinite;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .hero-slider { width: 100%; max-width: 1140px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
      .hero-slider-frame {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 4px;
        overflow: hidden;
        background: #0F172A;
        border: 1px solid rgba(15, 23, 42, 0.22);
      }
      .hero-slide {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: scale(1.02);
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      .hero-slide.is-active { opacity: 1; transform: scale(1); }
      /* Official photo-gallery style counter strip, like a PIB/gov.in press gallery */
      .hero-slider-caption {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding: 8px 16px;
        background: linear-gradient(0deg, rgba(11,30,46,0.94), rgba(11,30,46,0.8));
        border-top: 3px solid var(--abc-saffron);
      }
      .hero-slider-caption-count {
        flex: 0 0 auto;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        color: var(--abc-saffron);
        white-space: nowrap;
      }
      .hero-slider-dots { display: flex; justify-content: center; gap: 6px; }
      .hero-slider-dot {
        width: 18px; height: 4px; padding: 0;
        border-radius: 2px; border: 0;
        background: rgba(15, 23, 42, 0.22);
        cursor: pointer;
        transition: width 0.25s ease, background 0.25s ease;
      }
      .hero-slider-dot.is-active { width: 30px; background: var(--abc-saffron); }
      .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; justify-content: center; }

      .about-page-shell { padding: 32px 24px 64px; max-width: 1200px; margin: 0 auto; }
      .about-page-hero {
        background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(241,245,249,0.97));
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 28px;
        padding: 28px;
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        margin-bottom: 24px;
      }
      .about-page-back { margin-bottom: 20px; }
      .about-page-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 24px; align-items: center; }
      .about-page-copy h1 { font-size: 34px; line-height: 1.2; margin: 0 0 12px; color: var(--abc-navy); font-family: 'Space Grotesk', sans-serif; }
      .about-page-copy p { color: var(--text-subtle); font-size: 15px; line-height: 1.75; margin: 0 0 16px; }
      .about-page-pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
      .about-page-visual-card { border-radius: 20px; overflow: hidden; border: 1px solid rgba(15,23,42,0.08); box-shadow: var(--shadow-md); background: #FFFFFF; }
      .about-page-visual-card img { width: 100%; height: 320px; object-fit: cover; display: block; }
      .about-page-visual-caption { padding: 12px 14px; font-size: 13px; color: var(--text-subtle); background: #FFFFFF; }
      .about-page-section { margin-bottom: 24px; }
      .about-page-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      .about-page-card {
        background: #FFFFFF;
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 18px;
        padding: 20px;
        box-shadow: var(--shadow-sm);
      }
      .about-page-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        color: #FFFFFF;
        background: linear-gradient(135deg, #1D4ED8, #E65100);
        margin-bottom: 12px;
      }
      .about-page-card h3 { margin: 0 0 8px; font-size: 18px; color: var(--abc-navy); }
      .about-page-card p { margin: 0; font-size: 13px; line-height: 1.7; color: var(--text-subtle); }
      .about-page-flow-card {
        background: #FFFFFF;
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 24px;
        padding: 24px;
        box-shadow: var(--shadow-sm);
      }
      .about-page-flow-head { margin-bottom: 18px; }
      .about-page-flow-head h2 { font-size: 24px; margin: 6px 0 0; color: var(--abc-navy); }
      .about-page-flow-steps { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; align-items: center; }
      .about-page-flow-step {
        background: linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%);
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 16px;
        padding: 14px;
        min-height: 150px;
      }
      .about-page-flow-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #FFFFFF; background: linear-gradient(135deg, #0F766E, #2563EB); margin-bottom: 10px; }
      .about-page-flow-step h3 { margin: 0 0 6px; font-size: 15px; color: var(--abc-navy); }
      .about-page-flow-step p { margin: 0; font-size: 12px; line-height: 1.6; color: var(--text-subtle); }
      .about-page-flow-arrow { font-size: 22px; color: var(--abc-blue); text-align: center; font-weight: 700; }
      .faq-list { display: grid; gap: 14px; }
      .faq-item {
        border: 1px solid rgba(15,23,42,0.08);
        border-radius: 16px;
        padding: 16px 18px;
        background: linear-gradient(180deg, #F8FBFF 0%, #FFFFFF 100%);
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
      }
      .faq-item summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        cursor: pointer;
        font-weight: 700;
        color: var(--abc-navy);
        list-style: none;
        font-size: 15px;
        line-height: 1.5;
      }
      .faq-item summary::after {
        content: "+";
        font-size: 18px;
        color: var(--abc-blue);
        font-weight: 700;
        flex-shrink: 0;
      }
      .faq-item[open] summary::after {
        content: "–";
      }
      .faq-item summary::-webkit-details-marker { display: none; }
      .faq-item p {
        margin: 10px 0 0;
        font-size: 14px;
        line-height: 1.8;
        color: var(--text-subtle);
        padding-right: 8px;
      }
      .about-page-cta {
        background: linear-gradient(135deg, #0B1E2E 0%, #162E44 100%);
        border-radius: 24px;
        padding: 24px;
        text-align: center;
        color: #FFFFFF;
      }
      .about-page-cta h2 { margin: 0 0 8px; font-size: 24px; }
      .about-page-cta p { margin: 0 0 16px; color: rgba(255,255,255,0.8); }

      /* Stats Banner */
      .stats-banner { background: #FFFFFF; border-y: 1px solid var(--border-light); padding: 36px 48px; }
      .stats-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; text-align: center; }
      
      .stat-num { 
        font-size: 36px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; 
        background: linear-gradient(90deg, #E65100, #0284C7, #059669, #8B5CF6);
        background-size: 200% 200%;
        animation: textGradientWave 4s ease infinite;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .stat-desc { font-size: 13px; color: var(--text-subtle); margin-top: 4px; display: block; }

      /* Specialization Cards (3-column layout) */
      .section { padding: 56px 48px; max-width: 1200px; margin: 0 auto; text-align: center; }
      .section-alt { background: #F1F5F9; border-y: 1px solid var(--border-light); }
      .section-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--abc-blue); margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600; }
      .section-title { font-size: 28px; font-weight: 700; margin-bottom: 24px; color: var(--abc-navy); text-align: center; font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; }
      /* Notice Board — GIGW/UX4G-style official announcement strip: flat,
         bordered, square-cornered, with a tricolor-style saffron rule under
         the navy header instead of soft shadows and pill badges. */
      .section-notice-board { padding-top: 8px; padding-bottom: 8px; }
      .notice-board {
        max-width: 900px;
        margin: 0 auto;
        border: 1px solid rgba(15,23,42,0.18);
        border-radius: 4px;
        overflow: hidden;
        background: #FFFFFF;
      }
      .notice-board-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 11px 18px;
        background: var(--abc-navy);
        color: #FFFFFF;
        border-bottom: 3px solid var(--abc-saffron);
      }
      .notice-board-head h2 {
        margin: 0;
        font-size: 13.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #FFFFFF;
      }
      .notice-board-list { display: flex; flex-direction: column; }
      .notice-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        text-align: left;
        text-decoration: none;
        border-bottom: 1px solid rgba(15,23,42,0.1);
        transition: background 0.15s ease;
      }
      .notice-item:nth-child(even) { background: #F8FAFC; }
      .notice-item:last-child { border-bottom: none; }
      a.notice-item:hover { background: var(--abc-saffron-bg); }
      .notice-status {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        font-size: 10.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 4px 9px 4px 7px;
        border-radius: 3px;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .notice-status--live { background: #DCFCE7; color: #15803D; border-color: #15803D33; }
      .notice-status--live::before {
        content: "";
        width: 6px; height: 6px;
        margin-right: 6px;
        border-radius: 50%;
        background: #22C55E;
        animation: liveDotPulse 1.4s ease-in-out infinite;
      }
      .notice-status--soon { background: #FEF3C7; color: #92400E; border-color: #92400E33; }
      @keyframes liveDotPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      .notice-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
      .notice-item-title { font-size: 13.5px; line-height: 1.5; color: var(--abc-navy); font-weight: 600; }
      .notice-item-date {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10.5px;
        color: var(--text-muted);
      }
      .notice-item-arrow { flex: 0 0 auto; color: var(--abc-saffron); }

      /* Social Services — official numbered service list (renamed service-*
         to avoid clashing with the Scholarships page's own .scheme-list). */
      .service-list {
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(15,23,42,0.18);
        border-radius: 4px;
        overflow: hidden;
        background: #FFFFFF;
      }
      .service-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px 20px;
        text-align: left;
        border-bottom: 1px solid rgba(15,23,42,0.1);
        border-left: 3px solid transparent;
        transition: border-color 0.15s ease, background 0.15s ease;
        scroll-margin-top: 110px;
      }
      .service-row:nth-child(even) { background: #F8FAFC; }
      .service-row:last-child { border-bottom: none; }
      .service-row:hover { border-left-color: var(--abc-saffron); background: var(--abc-saffron-bg); }
      .service-row-index {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 3px;
        background: var(--abc-navy);
        color: #FFFFFF;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
      }
      .service-row-icon {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 4px;
        border: 1px solid rgba(15,23,42,0.14);
        background: #FFFFFF;
        color: var(--abc-navy);
      }
      .service-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .service-row-body h3 { font-size: 15.5px; font-weight: 700; color: var(--text-dark); line-height: 1.35; }
      .service-row-body p { font-size: 13px; line-height: 1.6; color: var(--text-muted); }
      .service-row-action { flex: 0 0 auto; }
      .service-row-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 3px;
        border: 1.5px solid var(--abc-navy);
        background: var(--abc-navy);
        color: #FFFFFF;
        font-family: inherit;
        font-size: 12.5px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease;
      }
      .service-row-btn:hover { background: var(--abc-navy-light); }
      .service-row-pending {
        display: inline-flex;
        padding: 7px 14px;
        border-radius: 3px;
        border: 1.5px dashed rgba(15,23,42,0.3);
        font-size: 11.5px;
        font-weight: 700;
        color: var(--text-muted);
        white-space: nowrap;
      }
      .service-row.is-highlighted { animation: searchFlash 2.4s ease-out; }

      .stream-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: stretch; justify-items: center; margin-top: 8px; }

      .section-story { padding-top: 20px; }

      /* Principal's message: portrait beside the quote, stacking on mobile. */
      .principal-figure {
        display: flex; flex-direction: column; align-items: center; gap: 14px;
        margin: 0; flex: 0 0 auto;
      }
      .principal-photo {
        width: 158px; height: 158px; border-radius: 50%; object-fit: cover;
        border: 4px solid #FFFFFF;
        box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
      }
      .principal-photo-initials {
        display: grid; place-items: center;
        background: linear-gradient(140deg, var(--abc-navy), var(--abc-blue));
        color: #FFFFFF;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 44px; font-weight: 700; letter-spacing: 0.02em;
      }
      .principal-caption { display: flex; flex-direction: column; gap: 2px; text-align: center; }
      .principal-caption strong {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 16px; font-weight: 700; color: var(--abc-navy);
      }
      .principal-caption span { font-size: 13px; font-weight: 600; color: var(--abc-saffron); }
      .principal-caption small { font-size: 11.5px; color: var(--text-muted); }

      .principal-quote { position: relative; margin: 0; padding-left: 34px; }
      .principal-mark {
        position: absolute; left: -2px; top: -14px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 62px; line-height: 1; color: var(--abc-saffron); opacity: 0.35;
      }
      .principal-quote p {
        font-size: clamp(15px, 1.6vw, 18px); line-height: 1.75;
        color: var(--text-subtle); font-style: italic;
      }
      .story-shell {
        background: linear-gradient(135deg, #F8FAFC 0%, #EEF2FF 55%, #E0F2FE 100%);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 32px;
        padding: 36px 38px;
        color: var(--abc-navy);
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        justify-items: start;
        text-align: left;
        gap: 40px;
        align-items: center;
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.12);
        position: relative;
        overflow: hidden;
      }
      .story-shell::before {
        content: "";
        position: absolute;
        inset: auto -15px -40px auto;
        width: 280px;
        height: 280px;
        background: radial-gradient(circle, rgba(230,81,0,0.16), transparent 70%);
        pointer-events: none;
      }
      .story-shell::after {
        content: "";
        position: absolute;
        inset: -20px auto auto -20px;
        width: 220px;
        height: 220px;
        background: radial-gradient(circle, rgba(29,78,216,0.12), transparent 70%);
        pointer-events: none;
      }
      .story-copy { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 820px; }
      .story-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.2);
        color: var(--abc-saffron);
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        width: fit-content;
      }
      .story-title { margin: 0; color: var(--abc-navy); text-align: left; font-size: 30px; line-height: 1.2; }
      .story-quote-block {
        padding: 16px 18px;
        border-left: 3px solid #F59E0B;
        background: rgba(255,255,255,0.8);
        border-radius: 16px;
      }
      .story-quote { font-size: 17px; line-height: 1.8; color: var(--text-subtle); font-weight: 500; margin: 0; }
      .story-subtext { font-size: 15px; line-height: 1.7; color: var(--text-muted); max-width: 630px; margin: 0; }
      .stream-box { 
        width: 100%;
        max-width: 340px;
        background: linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%);
        border: 1px solid var(--border-light); 
        border-top: 4px solid var(--abc-navy); 
        border-radius: var(--radius); 
        padding: 24px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease; box-shadow: var(--shadow-sm); text-align: left; align-items: flex-start;
      }
      .stream-box:hover { 
        transform: translateY(-6px);
        border-color: rgba(29, 78, 216, 0.25);
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
        background: linear-gradient(180deg, #FFFFFF 0%, #F0F7FF 100%);
      }
      .stream-box-icon { color: var(--abc-navy); transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), color 0.3s ease; }
      .stream-box:hover .stream-box-icon { transform: scale(1.12) translateY(-2px); color: #1D4ED8; }
      .stream-box-featured { 
        border-top-color: var(--abc-saffron); 
        background: linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 100%);
      }

      .badge-pill { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: var(--abc-navy); background: #E2E8F0; padding: 4px 10px; border-radius: 999px; width: fit-content; margin-top: auto; font-weight: 600; }
      .badge-pill-featured { 
        color: #FFFFFF; 
        background: linear-gradient(90deg, #E65100, #0284C7, #059669);
        background-size: 200% 200%;
        animation: gradientShift 4s ease infinite;
        font-weight: 600; 
      }

      .three-col { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
      .tier-card { 
        background: #FFFFFF; 
        border: 1px solid var(--border-light); 
        border-radius: var(--radius); 
        padding: 26px; box-shadow: var(--shadow-sm); 
        transition: all 0.3s ease;
      }
      .tier-card:hover {
        transform: translateY(-4px);
        animation: multiColorBorderCycle 4s infinite;
      }
      .testimonial-text { font-size: 14px; color: var(--text-subtle); font-style: italic; line-height: 1.6; margin-bottom: 16px; }
      .testimonial-author { font-size: 13px; color: var(--abc-navy); font-weight: 600; display: block; }

      /* ================= Button Design System ================= */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.2;
        padding: 10px 20px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-decoration: none;
        white-space: nowrap;
        user-select: none;
      }
      .btn:active {
        transform: scale(0.98);
      }
      .btn-primary {
        background: linear-gradient(135deg, var(--abc-saffron) 0%, var(--abc-saffron-hover) 100%);
        color: #FFFFFF;
        box-shadow: 0 4px 14px rgba(230, 81, 0, 0.25);
      }
      .btn-primary:hover {
        background: linear-gradient(135deg, var(--abc-saffron-hover) 0%, #BF360C 100%);
        box-shadow: 0 6px 18px rgba(230, 81, 0, 0.35);
        transform: translateY(-1px);
      }
      .btn-outline {
        background: #FFFFFF;
        border: 1px solid var(--border-strong);
        color: var(--text-dark);
        box-shadow: var(--shadow-sm);
      }
      .btn-outline:hover {
        border-color: var(--abc-navy);
        color: var(--abc-navy);
        background: #F8FAFC;
        transform: translateY(-1px);
      }
      .btn-ghost {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-subtle);
      }
      .btn-ghost:hover {
        background: #F1F5F9;
        color: var(--abc-navy);
      }
      .btn-xs { padding: 5px 10px; font-size: 12px; border-radius: 6px; }
      .btn-sm { padding: 7px 14px; font-size: 13px; border-radius: 6px; }
      .btn-lg { padding: 13px 26px; font-size: 15px; font-weight: 700; border-radius: var(--radius-sm); }
      .btn-block { width: 100%; display: flex; }

      /* Footer Four Columns with Social Buttons */
      /* ================================ Site footer ================================ */

      .site-footer {
        position: relative; overflow: hidden;
        margin-top: 72px; padding: 64px 24px 0;
        background:
          radial-gradient(1200px 400px at 12% -10%, rgba(29, 78, 216, 0.28), transparent 60%),
          linear-gradient(160deg, #0B1E2E 0%, #102B40 55%, #0B1E2E 100%);
        color: rgba(255, 255, 255, 0.78);
      }
      /* A warm bloom in the corner so the block does not read as a flat slab. */
      .site-footer-glow {
        position: absolute; right: -140px; top: -120px;
        width: 460px; height: 460px; border-radius: 50%;
        background: radial-gradient(circle, rgba(230, 81, 0, 0.22), transparent 68%);
        pointer-events: none;
      }

      .site-footer-inner {
        position: relative; z-index: 1;
        max-width: 1180px; margin: 0 auto;
        display: grid; grid-template-columns: minmax(280px, 1fr) minmax(0, 1.55fr);
        gap: 56px; align-items: start;
      }

      /* ------------------------------- identity ------------------------------- */
      .footer-identity { display: flex; flex-direction: column; gap: 22px; }
      /* Centred at every width so the mark and wordmark sit directly above the
         college card on desktop and tablet as well as on a phone, then eased a
         little left of true centre. The nudge is dropped on phones, where the
         column is narrow enough that it would read as misaligned. */
      .footer-brand { display: flex; align-items: center; justify-content: center; gap: 13px; }
      @media (min-width: 641px) {
        .footer-brand { transform: translateX(-22px); }
      }
      .footer-brand img, .footer-brand svg { height: 42px; width: auto; }
      .footer-brand-copy { display: flex; flex-direction: column; line-height: 1.25; }
      .footer-brand-name {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em;
      }
      .footer-brand-slogan {
        font-size: 12.5px; letter-spacing: 0.09em; text-transform: lowercase;
        color: var(--abc-saffron);
      }

      .footer-college {
        display: flex; align-items: center; gap: 14px;
        padding: 16px 18px; border-radius: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.09);
        backdrop-filter: blur(6px);
      }
      .footer-college-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .footer-college-copy small { font-size: 11.5px; color: rgba(255, 255, 255, 0.6); line-height: 1.4; }
      .footer-college-copy strong {
        font-size: 14.5px; font-weight: 700; color: #FFFFFF; line-height: 1.35;
      }

      /* -------------------------------- columns -------------------------------- */
      .footer-columns {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 36px 28px;
      }
      .footer-col { display: flex; flex-direction: column; gap: 11px; font-style: normal; }
      .footer-col h4 {
        margin-bottom: 3px; color: #FFFFFF;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px; font-weight: 700;
        letter-spacing: 0.1em; text-transform: uppercase;
      }

      .footer-link {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 0; border: 0; background: none; cursor: pointer;
        color: rgba(255, 255, 255, 0.74);
        font-family: inherit; font-size: 13.5px; text-align: left; text-decoration: none;
        transition: color 0.18s ease, transform 0.18s ease;
      }
      .footer-link:hover { color: #FFFFFF; transform: translateX(3px); }
      .footer-link.is-static { cursor: default; }
      .footer-link.is-static:hover { color: rgba(255, 255, 255, 0.74); transform: none; }
      .footer-link svg { flex: 0 0 auto; color: var(--abc-saffron); opacity: 0.9; }

      /* -------------------------------- socials -------------------------------- */
      .footer-socials { display: flex; flex-direction: column; gap: 9px; }
      .footer-social {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 10px 14px; border-radius: 11px; text-decoration: none;
        background: rgba(255, 255, 255, 0.055);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.85);
        font-size: 13.5px; font-weight: 600;
        transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
      }
      .footer-social:hover { transform: translateY(-2px); color: #FFFFFF; }
      .footer-social.social-fb:hover { background: rgba(24, 119, 242, 0.22); border-color: rgba(24, 119, 242, 0.55); }
      .footer-social.social-ig:hover { background: rgba(214, 41, 118, 0.22); border-color: rgba(214, 41, 118, 0.55); }
      .footer-social.social-li:hover { background: rgba(10, 102, 194, 0.22); border-color: rgba(10, 102, 194, 0.55); }

      /* ------------------------------- bottom bar ------------------------------ */
      .site-footer-bar {
        position: relative; z-index: 1;
        max-width: 1180px; margin: 52px auto 0; padding: 20px 0 26px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex; align-items: center; justify-content: space-between;
        gap: 14px; flex-wrap: wrap;
        font-size: 12.5px; color: rgba(255, 255, 255, 0.55);
      }
      .footer-author { display: inline-flex; align-items: center; gap: 6px; }
      .footer-author strong {
        color: #FFFFFF; font-weight: 600;
        background: linear-gradient(90deg, var(--abc-saffron), #FFB74D);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .footer-author-link { display: inline-flex; align-items: center; gap: 4px; text-decoration: none; border-bottom: 1px dashed rgba(255, 255, 255, 0.35); transition: border-color 0.15s ease; }
      .footer-author-link:hover { border-color: var(--abc-saffron); }
      .footer-author-link-icon { color: var(--abc-saffron); opacity: 0.85; flex: 0 0 auto; }

      @media (max-width: 900px) {
        .site-footer-inner { grid-template-columns: 1fr; gap: 40px; }
      }
      @media (max-width: 640px) {
        .site-footer { padding: 48px 18px 0; margin-top: 52px; }
        .footer-columns { grid-template-columns: 1fr; gap: 30px; }
        /* The copyright / author line stacks and centres rather than hugging the
           left edge on a narrow screen. */
        .site-footer-bar {
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          gap: 10px;
          margin-top: 38px;
        }
      }


      /* ================= Auth Screen & Log in Options ================= */
      .auth-screen { display: grid; grid-template-columns: 0.95fr 1.05fr; min-height: 100vh; background: #FFFFFF; }
      .auth-brand-panel {
        background: linear-gradient(135deg, #0B1E2E 0%, #162E44 50%, #0F2537 100%);
        color: #FFFFFF; padding: 48px; display: flex; flex-direction: column; justify-content: center; 
        border-right: 4px solid transparent;
        border-image: linear-gradient(180deg, #E65100, #0284C7, #059669, #8B5CF6) 1;
      }
      .auth-brand-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        gap: 14px;
      }
      .auth-brand-text-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 7px;
      }
      .auth-brand-name {
        font-size: clamp(2rem, 3.4vw, 3.4rem);
        line-height: 1.02;
        letter-spacing: -0.035em;
        font-weight: 800;
        color: #FFFFFF;
        font-family: 'Space Grotesk', 'Segoe UI', 'Inter', system-ui, sans-serif;
      }
      /* Tracked-out uppercase carries a trailing letter-space after the last glyph,
         which drags centred text visually left. The negative margin cancels it. */
      .auth-brand-slogan {
        font-size: clamp(0.6rem, 0.8vw, 0.78rem);
        letter-spacing: 0.22em;
        margin-right: -0.22em;
        text-transform: uppercase;
        color: #C7DCFA;
        font-weight: 600;
        opacity: 0.92;
        font-family: 'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif;
      }
      .auth-brand-campus {
        margin-top: 12px;
        opacity: 0.75;
        font-size: 13px;
        text-align: center;
      }
      .nav-actions { display: flex; align-items: center; gap: 8px; }
      .nav-lang-switch {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 999px;
        background: #EEF2F6;
        border: 1px solid rgba(15, 23, 42, 0.08);
        flex: 0 0 auto;
      }
      .nav-lang-btn {
        border: none;
        background: transparent;
        padding: 7px 13px;
        border-radius: 999px;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.01em;
        color: var(--text-subtle);
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      }
      .nav-lang-btn:hover { color: var(--abc-navy); }
      .nav-lang-btn.is-active {
        background: linear-gradient(135deg, var(--abc-saffron) 0%, #FF8F3D 100%);
        color: #FFFFFF;
        box-shadow: 0 3px 10px rgba(230, 81, 0, 0.32);
      }
      /* Hamburger toggle + collapsible group: invisible plumbing on desktop
         (search and actions sit inline exactly as before via display:contents),
         becomes a real dropdown panel once .nav-menu-toggle appears — see the
         <=900px rules below. */
      .nav-menu-toggle {
        display: none;
        align-items: center; justify-content: center;
        width: 40px; height: 40px; flex: 0 0 auto;
        border: 1px solid var(--border-strong, rgba(15,23,42,0.14));
        border-radius: 10px;
        background: #FFFFFF;
        color: var(--abc-navy);
        cursor: pointer;
      }
      .nav-collapse { display: contents; }
      .nav-staff-link {
        display: inline-flex; align-items: center; gap: 6px;
        border: 1px solid var(--border-strong); background: #FFFFFF; cursor: pointer;
        padding: 8px 12px; border-radius: var(--radius-sm);
        font-family: inherit; font-size: 12.5px; font-weight: 600;
        color: var(--text-subtle); white-space: nowrap;
      }
      .nav-staff-link:hover { color: var(--abc-navy); border-color: var(--abc-navy); background: #F8FAFC; }
      .nav-staff-link svg { flex: 0 0 auto; color: var(--abc-blue); }

      /* --------------------------- Nav search --------------------------- */
      .nav-search {
        position: relative;
        flex: 1 1 420px;
        max-width: 520px;
        min-width: 220px;
        margin: 0 20px;
      }
      .nav-search-field {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 42px;
        padding: 0 12px 0 14px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        background: rgba(255, 255, 255, 0.94);
        box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      }
      .nav-search-field:focus-within {
        border-color: var(--abc-navy);
        background: #FFFFFF;
        box-shadow: 0 0 0 3px rgba(11, 30, 46, 0.10);
      }
      .nav-search-field.is-open { border-bottom-left-radius: 14px; border-bottom-right-radius: 14px; }
      .nav-search-icon { color: var(--text-muted); flex-shrink: 0; }
      .nav-search-input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: none;
        background: transparent;
        font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
        font-size: 13.5px;
        color: var(--text-dark);
      }
      .nav-search-input::placeholder { color: var(--text-muted); opacity: 0.85; }
      .nav-search-clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        border: 0;
        border-radius: 50%;
        background: rgba(15, 23, 42, 0.06);
        color: var(--text-muted);
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .nav-search-clear:hover { background: rgba(15, 23, 42, 0.12); color: var(--text-dark); }

      .nav-search-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 60;
        max-height: 384px;
        overflow-y: auto;
        padding: 6px;
        border-radius: 16px;
        border: 1px solid rgba(15, 23, 42, 0.10);
        background: #FFFFFF;
        box-shadow: 0 18px 44px rgba(15, 23, 42, 0.16);
        animation: searchPanelIn 0.16s ease-out;
      }
      @keyframes searchPanelIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .nav-search-result {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 12px;
        border: 0;
        border-radius: 12px;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .nav-search-result:hover { background: rgba(11, 30, 46, 0.05); }
      .nav-search-result-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        border-radius: 10px;
        background: rgba(11, 30, 46, 0.07);
        color: var(--abc-navy);
      }
      .nav-search-result-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .nav-search-result-copy strong {
        font-size: 13.5px;
        font-weight: 700;
        color: var(--text-dark);
        line-height: 1.3;
      }
      .nav-search-result-copy small {
        font-size: 11.5px;
        color: var(--text-muted);
        line-height: 1.4;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .nav-search-result-tag {
        flex-shrink: 0;
        padding: 4px 9px;
        border-radius: 999px;
        background: rgba(11, 30, 46, 0.06);
        font-family: 'JetBrains Mono', monospace;
        font-size: 9.5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .nav-search-empty {
        padding: 16px 14px;
        font-size: 12.5px;
        line-height: 1.6;
        color: var(--text-muted);
      }

      /* ------------------ Study / Career / Social hubs ------------------ */
      .section-hub { scroll-margin-top: 96px; }
      .section-hub--career { background: #F1F5F9; }
      .hub-header { max-width: 760px; margin: 0 auto 28px; }
      .hub-title { margin-bottom: 10px; }
      .hub-intro { font-size: 15px; line-height: 1.75; color: var(--text-muted); }

      .hub-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(258px, 1fr));
        gap: 18px;
      }
      .hub-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 20px 20px 22px;
        text-align: left;
        border-radius: 4px;
        border: 1px solid rgba(15, 23, 42, 0.18);
        border-top: 3px solid var(--abc-navy);
        background: #FFFFFF;
        scroll-margin-top: 110px;
        transition: border-top-color 0.15s ease, background 0.15s ease;
      }
      .hub-card:hover {
        border-top-color: var(--abc-saffron);
        background: var(--abc-saffron-bg);
      }
      .hub-card-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        margin-bottom: 4px;
        border-radius: 4px;
        background: var(--abc-navy);
        color: #FFFFFF;
      }
      .hub-card-body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
      .hub-card h3 { font-size: 16.5px; font-weight: 700; color: var(--text-dark); line-height: 1.35; }
      .hub-card p { font-size: 13.5px; line-height: 1.65; color: var(--text-muted); flex: 1; }
      .hub-card-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        padding: 0;
        border: 0;
        background: none;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        color: var(--abc-navy);
        text-decoration: none;
        cursor: pointer;
        transition: color 0.15s ease;
      }
      .hub-card-link:hover { color: var(--abc-saffron-hover); text-decoration: underline; }
      .hub-card-pending {
        margin-top: 6px;
        padding: 5px 10px;
        border-radius: 3px;
        border: 1.5px dashed rgba(15,23,42,0.3);
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text-muted);
      }

      /* Flash the card or section the search jumped to. */
      .hub-card.is-highlighted,
      .section-hub.is-highlighted .hub-header {
        animation: searchFlash 2.4s ease-out;
      }
      @keyframes searchFlash {
        0%, 100% { box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05); }
        12%, 60% { box-shadow: 0 0 0 3px rgba(11, 30, 46, 0.28), 0 16px 34px rgba(15, 23, 42, 0.14); }
      }
      .footer-brand-header {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }
      .footer-brand-text-wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        line-height: 1;
        gap: 4px;
        min-width: 0;
      }
      .footer-brand-name {
        font-size: 1.5rem;
        line-height: 0.95;
        letter-spacing: -0.06em;
        font-weight: 900;
        color: #FFFFFF;
        font-family: 'Segoe UI', 'Inter', 'Arial', sans-serif;
        white-space: nowrap;
      }
      .footer-brand-slogan {
        font-size: 0.6rem;
        letter-spacing: 0.12em;
        text-transform: lowercase;
        color: #D7E7FF;
        font-weight: 700;
        opacity: 0.95;
        font-family: 'Segoe UI', 'Inter', 'Arial', sans-serif;
        white-space: nowrap;
      }
      .auth-form-panel { display: flex; flex-direction: column; justify-content: center; padding: 56px; max-width: 480px; margin: 0 auto; width: 100%; }
      .auth-tabs { display: flex; gap: 6px; background: #F1F5F9; padding: 4px; border-radius: var(--radius-sm); margin-bottom: 24px; width: fit-content; border: 1px solid var(--border-light); }
      .auth-tab { border: none; background: transparent; padding: 8px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; color: var(--text-muted); transition: all 0.2s ease; cursor: pointer; }
      .auth-tab-active { 
        background: linear-gradient(135deg, #0B1E2E 0%, #162E44 100%);
        color: #FFFFFF; font-weight: 600; box-shadow: var(--shadow-sm); 
      }
      .auth-back-link {
        display: inline-flex; align-items: center; gap: 6px; width: fit-content;
        border: 0; background: transparent; cursor: pointer; padding: 0;
        margin-bottom: 18px; font-family: inherit; font-size: 13px; font-weight: 600;
        color: var(--text-muted);
      }
      .auth-back-link:hover { color: var(--abc-navy); }
      .auth-forgot-link {
        display: block; margin-top: 8px; border: 0; background: transparent; cursor: pointer;
        padding: 0; font-family: inherit; font-size: 12.5px; font-weight: 600;
        color: var(--abc-blue); text-align: right; width: 100%;
      }
      .auth-forgot-link:hover { text-decoration: underline; }
      /* Heading, sub-copy and host note share one left edge and one rhythm,
         so the block stays aligned whether or not the host note is rendered. */
      .auth-heading { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; text-align: left; }
      .auth-heading > * { margin: 0; }
      .auth-title { font-size: 28px; line-height: 1.25; color: var(--abc-navy); letter-spacing: -0.02em; }
      .auth-sub { color: var(--text-muted); font-size: 14px; line-height: 1.65; max-width: 42ch; }
      .auth-host-note { font-size: 12.5px; line-height: 1.5; color: var(--abc-blue); word-break: break-all; }

      .role-selector-wrap { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
      .role-selector-staff { display: flex; gap: 10px; }
      .role-divider { display: flex; align-items: center; gap: 10px; color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
      .role-divider::before, .role-divider::after { content: ""; flex: 1; height: 1px; background: var(--border-light); }
      .role-current-chip {
        display: inline-flex; align-items: center; gap: 8px; width: fit-content;
        padding: 9px 14px; border-radius: var(--radius-sm);
        background: rgba(29, 78, 216, 0.07); border: 1px solid rgba(29, 78, 216, 0.18);
        color: var(--abc-navy); font-size: 13px; font-weight: 600;
      }
      .role-tab {
        flex: 1; 
        border: 1.5px solid var(--border-strong); 
        background: #FFFFFF; 
        padding: 11px 12px; 
        border-radius: var(--radius-sm); 
        font-size: 13px; 
        font-weight: 600; 
        display: inline-flex; 
        align-items: center; 
        justify-content: center; 
        gap: 8px; 
        color: var(--text-subtle); 
        transition: all 0.25s ease; 
        cursor: pointer; 
      }
      .role-tab:hover {
        border-color: var(--abc-navy);
        color: var(--abc-navy);
        background: #F8FAFC;
      }
      .role-tab-active { 
        border-color: var(--abc-navy); 
        background: var(--abc-navy); 
        color: #FFFFFF; 
        font-weight: 700; 
        box-shadow: 0 4px 12px rgba(11, 30, 46, 0.2);
      }

      .auth-divider {
        display: flex;
        align-items: center;
        text-align: center;
        margin: 16px 0;
        color: var(--text-muted);
      }
      .auth-divider::before, .auth-divider::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--border-light);
      }
      .auth-divider span {
        padding: 0 12px;
        font-size: 12px;
        color: var(--text-muted);
        font-family: 'JetBrains Mono', monospace;
      }

      .form-error {
        background: #FEF2F2;
        border: 1px solid rgba(220, 38, 38, 0.3);
        color: #DC2626;
        padding: 10px 14px;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 16px;
      }
      /* The signup confirmation, which has to survive the switch to the login
         tab — so it reads as a result, not as an error. */
      .form-success {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #F0FDF4;
        border: 1px solid rgba(22, 163, 74, 0.3);
        color: #15803D;
        padding: 10px 14px;
        border-radius: var(--radius-sm);
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 16px;
      }

      /* Form Fields */
      .field { display: block; margin-bottom: 16px; }
      .field-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-subtle); }
      .field-input-wrap { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 0 14px; background: #FFFFFF; transition: all 0.2s; }
      .field-icon { color: var(--text-muted); flex-shrink: 0; }
      .field-input { border: none; outline: none; padding: 12px 0; font-size: 14px; width: 100%; background: transparent; color: var(--text-dark); font-family: 'Plus Jakarta Sans', sans-serif; }
      .field-input-wrap:focus-within { border-color: var(--abc-navy); box-shadow: 0 0 0 2px rgba(11, 30, 46, 0.1); }

      /* Form Fields */
      .field { display: block; margin-bottom: 16px; }
      .field-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-subtle); }
      .field-input-wrap { display: flex; align-items: center; gap: 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); padding: 0 14px; background: #FFFFFF; transition: all 0.2s; }
      .field-icon { color: var(--text-muted); flex-shrink: 0; }
      .field-input { border: none; outline: none; padding: 12px 0; font-size: 14px; width: 100%; background: transparent; color: var(--text-dark); font-family: 'Plus Jakarta Sans', sans-serif; }
      .field-input-wrap:focus-within { border-color: var(--abc-navy); box-shadow: 0 0 0 2px rgba(11, 30, 46, 0.1); }

      /* Wizard / Setup Flow */
      .wizard-screen {
        width: min(100%, 1180px);
        margin: 0 auto;
        min-height: calc(100vh - 68px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px 72px;
      }
      .wizard-card {
        width: min(100%, 880px);
        background: #FFFFFF;
        border: 1px solid var(--border-light);
        border-top: 4px solid var(--abc-navy);
        border-radius: var(--radius);
        padding: 30px 28px;
        box-shadow: var(--shadow-md);
      }
      .wizard-card .wizard-title {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wizard-card .wizard-sub {
        margin: 8px 0 0;
        color: var(--text-muted);
        line-height: 1.6;
      }

      /* Dashboard */
      .dash-grid { max-width: 1120px; margin: 0 auto; padding: 36px 24px 80px; display: grid; grid-template-columns: 2.2fr 1fr; gap: 24px; align-items: start; }
      .card { background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow-sm); }
      .dash-name { font-size: 28px; color: var(--abc-navy); margin: 0; }
      .dash-meta { color: var(--text-muted); font-size: 13px; margin-top: 4px; }

      .dash-modules { grid-column: 1 / -1; }
      .dash-section-title { font-size: 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; color: var(--abc-navy); }
      .module-grid-three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
      
      .module-card { 
        background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
        border: 1px solid var(--border-light);
        border-top: 4px solid var(--abc-navy);
        border-radius: 16px;
        padding: 20px 18px 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        transition: all 0.25s;
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.04);
        height: 100%;
        justify-content: space-between;
      }
      .module-active:hover { 
        animation: multiColorBorderCycle 3s infinite;
        transform: translateY(-3px);
        box-shadow: 0 18px 34px rgba(15, 23, 42, 0.08);
      }
      .module-card h4 {
        margin: 0;
        font-size: 1.05rem;
        color: var(--abc-navy);
      }
      .module-card p {
        margin: 0;
        color: var(--text-subtle);
        line-height: 1.5;
        font-size: 13px;
      }

      /* Organized Faculty Profile Layout */
      .faculty-profile-hero { display: flex; flex-direction: column; gap: 16px; border-top: 4px solid var(--abc-navy); }
      .fac-hero-cover { min-height: 120px; border-radius: 14px; background: linear-gradient(135deg,#0B1E2E,#1D4ED8,#059669); position: relative; overflow: hidden; display: flex; align-items: flex-start; justify-content: flex-end; padding: 14px; }
      .fac-hero-main { display: flex; gap: 20px; align-items: flex-start; flex: 1; min-width: 280px; }
      .fac-pfp-wrap { display: flex; flex-direction: column; align-items: center; gap: 7px; flex-shrink: 0; }
      .fac-pfp-button { position: relative; border: 0; background: transparent; padding: 0; cursor: pointer; display: block; }
      .fac-pfp-button:disabled { cursor: progress; opacity: .75; }
      .fac-pfp-large { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid var(--abc-navy); box-shadow: var(--shadow-md); flex-shrink: 0; }
      .fac-pfp-placeholder { width: 88px; height: 88px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; color: var(--abc-navy); border: 2px dashed var(--border-strong); flex-shrink: 0; font-size: 27px; font-weight: 700; letter-spacing: .5px; }
      /* The camera chip is the only affordance saying the portrait is editable. */
      .fac-pfp-edit {
        position: absolute;
        right: -2px;
        bottom: -2px;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--abc-saffron);
        color: #fff;
        border: 2px solid #fff;
        box-shadow: 0 2px 8px rgba(15,23,42,.2);
      }
      .fac-pfp-button:hover .fac-pfp-edit { background: var(--abc-saffron-hover); }
      .fac-pfp-remove { border: 0; background: transparent; padding: 0; font-size: 11.5px; font-weight: 600; color: var(--text-muted); text-decoration: underline; }
      .fac-pfp-remove:hover { color: var(--abc-rose); }
      .fac-pfp-error { margin: 0; max-width: 150px; text-align: center; font-size: 11.5px; line-height: 1.5; color: var(--abc-rose); }
      .fac-info { display: flex; flex-direction: column; gap: 4px; flex: 1; }
      .fac-name-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .fac-designation-meta { font-size: 14px; font-weight: 600; color: var(--abc-navy); margin-top: 2px; }
      .fac-institution-meta { font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 2px; }
      
      .fac-social-grid { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; align-items: center; }
      .fac-hero-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
      .social-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 999px; text-decoration: none; transition: all 0.2s ease; box-shadow: var(--shadow-sm); }
      .social-badge-li { background: #E0F2FE; color: #0369A1; border: 1px solid rgba(3, 105, 161, 0.25); }
      .social-badge-li:hover { background: #0A66C2; color: #FFFFFF; transform: translateY(-1px); }
      .social-badge-orcid { background: #ECFDF5; color: #047857; border: 1px solid rgba(4, 120, 87, 0.25); }
      .social-badge-orcid:hover { background: #047857; color: #FFFFFF; transform: translateY(-1px); }
      .social-badge-scholar { background: #FEF3C7; color: #B45309; border: 1px solid rgba(180, 83, 9, 0.25); }
      .social-badge-scholar:hover { background: #B45309; color: #FFFFFF; transform: translateY(-1px); }
      .social-badge-email { background: #F1F5F9; color: var(--text-subtle); border: 1px solid var(--border-strong); }


      /* Language picker — blocking, shown on every fresh page load (see
         App()'s askLang state). Sits above everything else, including the
         sticky nav. */
      .lang-picker-overlay {
        position: fixed; inset: 0; z-index: 300;
        background: rgba(11, 30, 46, 0.62);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
      }
      .lang-picker-card {
        background: #FFFFFF;
        border-top: 4px solid var(--abc-saffron);
        border-radius: var(--radius);
        width: 100%; max-width: 440px;
        padding: 36px 32px 32px;
        box-shadow: var(--shadow-lg);
        text-align: center;
      }
      .lang-picker-icon {
        width: 52px; height: 52px; margin: 0 auto 20px;
        border-radius: 50%;
        background: rgba(29, 78, 216, 0.1);
        color: var(--abc-blue, #1D4ED8);
        display: flex; align-items: center; justify-content: center;
      }
      .lang-picker-title { display: flex; flex-direction: column; gap: 10px; font-size: 20px; font-weight: 700; color: var(--abc-navy); line-height: 1.4; margin: 0 0 18px; }
      .lang-picker-title span:last-child { font-size: 19px; }
      .lang-picker-sub { display: flex; flex-direction: column; gap: 8px; font-size: 13.5px; color: var(--text-subtle); line-height: 1.6; margin: 0 0 36px; }
      .lang-picker-actions { display: flex; gap: 14px; justify-content: center; }
      .lang-picker-btn { flex: 1; max-width: 160px; }

      /* Modals & Tables */
      .modal-overlay { position: fixed; inset: 0; background: rgba(11, 30, 46, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px; }
      .modal-card { background: #FFFFFF; border: 1px solid var(--border-light); border-top: 4px solid var(--abc-saffron); width: 100%; max-width: 500px; border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow-lg); }
      .modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 12px; color: var(--abc-navy); }
      .modal-body-scroll { max-height: 300px; overflow-y: auto; color: var(--text-subtle); font-size: 14px; line-height: 1.6; }

      /* Wide tables scroll inside their own box rather than widening the page. */
      .table-scroll { width: 100%; overflow-x: auto; margin-top: 16px; -webkit-overflow-scrolling: touch; }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

      /* ================================================================
         DnyanSetu LAYOUT REPAIR / APP SHELL
         These rules intentionally come last so they override legacy
         dashboard styles without breaking the other views.
         ================================================================ */

      .app-header {
        position: sticky;
        top: 0;
        z-index: 80;
        height: 68px;
        width: 100%;
        background: #FFFFFF;
        border-bottom: 1px solid var(--border-light);
        box-shadow: 0 2px 12px rgba(15,23,42,.06);
      }
      .app-header-inner {
        width: min(1280px, 100%);
        height: 100%;
        margin: 0 auto;
        padding: 0 28px;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 28px;
      }
      .app-brand {
        border: 0;
        background: transparent;
        padding: 0;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif;
        font-size: 21px;
        font-weight: 700;
        white-space: nowrap;
      }
      .app-brand-mark {
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        overflow: hidden;
        background: transparent;
        border: 0;
        box-shadow: none;
        padding: 0;
      }
      /* The bar now lists every destination the account can reach, which is more
         than fits on a narrow laptop. It scrolls sideways rather than pushing
         the sign-out button off the edge. */
      .app-navigation {
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .app-navigation::-webkit-scrollbar { display: none; }
      .app-nav-item {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border: 0;
        background: transparent;
        padding: 0 12px;
        min-height: 44px;
        color: var(--text-muted);
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .app-nav-item:hover { color: var(--abc-navy); background: #F8FAFC; }
      .app-nav-item.active { color: var(--abc-navy); font-weight: 700; }
      .app-nav-item.active::after {
        content: '';
        position: absolute;
        left: 8px;
        right: 8px;
        bottom: 0;
        height: 3px;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(90deg,#E65100,#0284C7,#059669,#8B5CF6);
      }
      .app-header-right {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        min-width: 0;
      }
      .header-profile-button {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        border: 0;
        background: transparent;
        padding: 5px 10px;
        border-radius: 10px;
        min-width: 0;
        min-height: 38px;
      }
      .header-profile-button:not(:disabled):hover { background: #F8FAFC; }
      .header-profile-button:disabled { cursor: default; opacity: 1; }
      .header-profile-button { cursor: pointer; }
      .header-avatar {
        width: 34px;
        height: 34px;
        flex: 0 0 34px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #E0F2FE;
        color: #0369A1;
        font-size: 11px;
        font-weight: 800;
        overflow: hidden;
      }
      .header-avatar-img { width: 100%; height: 100%; object-fit: cover; }
      .header-user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        min-width: 0;
        line-height: 1.15;
      }
      .header-user-info strong {
        max-width: 135px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
        color: var(--text-dark);
      }
      .header-user-info small { margin-top: 3px; font-size: 10px; color: var(--text-muted); text-transform: capitalize; }
      .header-logout {
        width: 38px;
        height: 38px;
        border: 1px solid var(--border-light);
        background: #FFFFFF;
        color: var(--text-muted);
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .header-logout:hover { color: #DC2626; background: #FEF2F2; border-color: #FCA5A5; }
      .role-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 999px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border: 1px solid transparent;
      }
      .role-student { background: #E0F2FE; color: #0369A1; border-color: #BAE6FD; }
      .role-faculty { background: #ECFDF5; color: #047857; border-color: #A7F3D0; }
      .role-admin { background: #FFF7ED; color: #B45309; border-color: #FED7AA; }

      .profile-page {
        width: min(1180px, calc(100% - 48px));
        margin: 0 auto;
        padding: 28px 0 80px;
      }
      .profile-header-card {
        overflow: hidden;
        background: #FFFFFF;
        border: 1px solid var(--border-light);
        border-radius: 14px;
        box-shadow: var(--shadow-sm);
      }
      .profile-cover {
        position: relative;
        height: 185px;
        overflow: visible;
        background:
          radial-gradient(circle at 15% 25%,rgba(230,81,0,.55),transparent 34%),
          radial-gradient(circle at 65% 40%,rgba(2,132,199,.55),transparent 37%),
          radial-gradient(circle at 90% 5%,rgba(139,92,246,.55),transparent 34%),
          #0B1E2E;
      }
      .profile-cover-edit {
        position: absolute;
        top: 14px;
        right: 14px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 0;
        background: rgba(255,255,255,0.92);
        color: var(--abc-navy);
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: var(--shadow-sm);
      }
      .profile-cover-grid {
        position: absolute;
        inset: 0;
        opacity: .18;
        background-image: linear-gradient(45deg,rgba(255,255,255,.3) 1px,transparent 1px);
        background-size: 24px 24px;
      }
      .profile-header-content {
        display: flex;
        gap: 26px;
        padding: 0 30px 28px;
      }
      /* Hug the avatar: the online dot is anchored to this box, so letting it
         stretch to the row (or to full width once the header stacks) flings the
         dot to the far edge. */
      .profile-avatar-wrap { position: relative; flex: 0 0 auto; align-self: flex-start; width: max-content; margin-top: -68px; z-index: 2; }
      .profile-avatar-button { border: 0; background: transparent; padding: 0; cursor: pointer; position: relative; }
      .media-action-menu {
        position: absolute;
        z-index: 12;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px;
        min-width: 174px;
        background: #FFFFFF;
        border: 1px solid var(--border-light);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
      }
      .media-action-menu-cover {
        top: 56px;
        right: 12px;
      }
      .media-action-menu-avatar {
        left: 8px;
        top: 142px;
      }
      .media-action-menu button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 0;
        background: #F8FAFC;
        color: var(--text-subtle);
        padding: 9px 12px;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        text-align: left;
      }
      .media-action-menu button:hover { background: #E0F2FE; color: var(--abc-navy); }
      .profile-avatar {
        width: 138px;
        height: 138px;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        border: 5px solid #FFFFFF;
        box-shadow: 0 6px 20px rgba(15,23,42,.16);
      }
      .profile-avatar-edit {
        position: absolute;
        right: 8px;
        bottom: 8px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #FFFFFF;
        color: var(--abc-navy);
        box-shadow: 0 6px 16px rgba(15,23,42,.18);
      }
      .profile-avatar-initials {
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg,#0B1E2E,#1D4ED8,#8B5CF6);
        color: #FFFFFF;
        font-family: 'JetBrains Mono', monospace;
        font-size: 30px;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
        box-shadow: inset 0 0 0 2px rgba(255,255,255,0.2);
      }
      .profile-online-dot {
        position: absolute;
        right: 9px;
        bottom: 10px;
        width: 15px;
        height: 15px;
        border: 3px solid #FFFFFF;
        border-radius: 50%;
        background: #10B981;
      }
      .profile-main-info { min-width: 0; flex: 1; padding-top: 20px; }
      .profile-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .profile-name-line { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
      .profile-name-line h1 { font-size: 30px; line-height: 1.1; color: var(--abc-navy); }
      .verified-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 9px;
        border-radius: 999px;
        background: #ECFDF5;
        border: 1px solid #A7F3D0;
        color: #047857;
        font-size: 10px;
        font-weight: 700;
      }
      .profile-headline { margin-top: 8px !important; font-size: 14px; color: var(--text-subtle); }
      .profile-institution,
      .profile-location { margin-top: 8px !important; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
      .profile-metrics-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
      .profile-metric { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #F8FAFC; border: 1px solid var(--border-light); color: var(--text-subtle); font-size: 11px; font-weight: 600; }
      .profile-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
      .profile-layout { display: grid; grid-template-columns: minmax(0,1fr); gap: 20px; align-items: start; margin-top: 20px; }
      .profile-main-column { min-width: 0; display: flex; flex-direction: column; gap: 20px; }
      .profile-card { background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 12px; padding: 22px; box-shadow: var(--shadow-sm); }
      .profile-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; color: var(--abc-navy); }
      .profile-card-heading h2 { margin-top: 3px; font-size: 18px; }
      .profile-card-heading > svg { color: var(--text-muted); flex: 0 0 auto; }
      .profile-section-kicker { display: block; font-family: 'JetBrains Mono',monospace; font-size: 9px; letter-spacing: .08em; color: var(--abc-saffron); font-weight: 700; }
      .profile-about { font-size: 14px; line-height: 1.7; color: var(--text-subtle); }
      .education-row { display: flex; gap: 14px; align-items: flex-start; }
      .education-logo { width: 46px; height: 46px; flex: 0 0 46px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: #EFF6FF; color: #2563EB; }
      .education-copy { min-width: 0; }
      .education-copy h3 { font-size: 15px; }
      .education-copy p { margin-top: 4px !important; font-size: 13px; color: var(--text-subtle); }
      .education-copy span, .education-copy small { display: block; margin-top: 4px; font-size: 12px; color: var(--text-muted); }
      .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
        margin-bottom: 8px;
      }
      .skill-pill {
        padding: 12px 18px;
        border: 1px solid var(--border-light);
        border-radius: 14px;
        background: #F8FAFC;
        color: var(--text-subtle);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
        min-height: 52px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        transition: all 0.2s ease;
      }
      .skill-pill:hover {
        border-color: rgba(11, 30, 46, 0.2);
        background: #F1F5F9;
        transform: translateY(-1px);
      }
      .skill-pill-active {
        background: linear-gradient(135deg, rgba(2,132,199,0.12), rgba(230,81,0,0.08));
        color: var(--abc-navy);
        border-color: rgba(11, 30, 46, 0.22);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
      }
      .profile-empty-state { display: flex; align-items: center; gap: 9px; padding: 12px; border-radius: 9px; background: #F8FAFC; color: var(--text-muted); font-size: 12px; line-height: 1.5; }
      .readiness-empty { flex-direction: column; align-items: stretch; text-align: center; }
      .readiness-empty svg { align-self: center; color: var(--abc-saffron); }
      .readiness-empty p { margin: 0 !important; }

      /* Dashboard alignment */
      .dash-grid { width: min(1180px, calc(100% - 48px)); max-width: none; margin: 0 auto; padding: 28px 0 80px; grid-template-columns: minmax(0,1fr) 320px; gap: 20px; }
      .dash-modules { min-width: 0; }
      /* Grid/flex children default to min-width:auto, so one wide child (the admin
         user table) can push the whole page wider than the viewport. */
      .dash-grid > *, .profile-layout > *, .dash-side > * { min-width: 0; }
      .table-scroll { max-width: 100%; min-width: 0; }
      .module-grid-three { grid-template-columns: repeat(3,minmax(0,1fr)); }
      .module-card { min-width: 0; min-height: 145px; }
      .faculty-profile-hero { width: 100%; min-width: 0; }
      .fac-hero-main { min-width: 0; }
      .fac-info { min-width: 0; }
      .fac-social-grid { max-width: 100%; }
      .video-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }

      .btn:disabled { cursor: not-allowed; opacity: .5; }


      /* ================================================================
         RESPONSIVE SYSTEM
         One place for every breakpoint, ordered widest -> narrowest so
         later rules win. Targets: laptop 1120, tablet 900,
         large phone 640, phone 480, small phone 380.
         ================================================================ */

      /* --- Foundations that apply at every width --- */
      .dnyansetu { overflow-x: clip; }
      .dnyansetu img, .dnyansetu svg { max-width: 100%; }
      .dnyansetu :where(button, a, input, select, textarea) { -webkit-tap-highlight-color: rgba(29, 78, 216, 0.12); }

      @media (hover: none) and (pointer: coarse) {
        /* Touch targets: nothing interactive smaller than a fingertip. */
        .dnyansetu :where(.btn, .app-nav-item, .auth-tab, .role-tab, .hub-card-link, .header-logout) {
          min-height: 44px;
        }
        .hero-slider-dot { height: 12px; width: 12px; }
        .hero-slider-dot.is-active { width: 26px; }
        /* iOS zooms the page when a focused input is under 16px. */
        .dnyansetu :where(input, select, textarea) { font-size: 16px; }
        .dnyansetu :where(.btn, .stream-box, .hub-card, .app-nav-item) { touch-action: manipulation; }
      }

      /* ---------------------------- <= 1120px ---------------------------- */
      @media (max-width: 1120px) {
        .section { padding: 52px 32px; }
        .hero-alison { padding: 56px 32px 60px; }
        .footer-cols-four { grid-template-columns: 1.4fr repeat(3, 1fr); gap: 24px 20px; }
        .footer-social-block { grid-column: 2 / -1; justify-self: start; }
        .about-page-flow-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
        .about-page-flow-arrow { display: none; }
        .dash-grid { width: min(1180px, calc(100% - 40px)); grid-template-columns: minmax(0,1fr) 300px; }
        .profile-page { width: min(1180px, calc(100% - 40px)); }
      }

      /* ---------------------------- <= 900px (tablet) -------------------- */
      @media (max-width: 900px) {
        .section { padding: 46px 26px; }
        .section-title { font-size: 25px; }
        .hero-alison { padding: 40px 26px 48px; gap: 22px; }
        .hero-slider { max-width: 100%; }

        .three-col, .stats-grid, .about-page-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .stream-cards-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
        .about-page-hero-grid { grid-template-columns: 1fr; }
        .story-shell { grid-template-columns: 1fr; padding: 28px 24px; }
        /* The shell sets justify-items:start for the two-column layout; once it
           collapses to one column that leaves the portrait stuck to the left. */
        .story-shell .principal-figure { justify-self: center; }
        .video-grid, .module-grid-three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .two-col { grid-template-columns: 1fr; }

        /* Marketing nav collapses to brand + hamburger; search and actions
           move into a dropdown panel opened by the hamburger (see App() /
           Landing()'s mobileMenuOpen state). Stays position:sticky from the
           base rule below 900px too — the .relative override here used to
           kill the sticky-on-scroll behavior on phones/tablets. */
        .nav-marketing { padding: 12px 20px; }
        .nav-gov-brand { min-width: 0; flex: 1 1 auto; }
        .landing-brand-wrap { min-width: 0; flex: 0 1 auto; }
        .landing-brand-copy { min-width: 0; overflow: hidden; }
        .nav-topstrip-text { font-size: 10.5px; }
        .nav-menu-toggle { display: inline-flex; }
        .nav-collapse { display: none; }
        .nav-collapse.is-open {
          display: flex; flex-direction: column; gap: 14px; align-items: stretch;
          position: absolute; top: 100%; left: 0; right: 0;
          margin-top: 1px;
          background: #FFFFFF;
          padding: 16px 20px 20px;
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.12);
          border-bottom: 3px solid var(--abc-navy);
          max-height: 80vh;
          overflow-y: auto;
        }
        /* .nav-search's desktop flex-basis (420px) is a WIDTH in the normal
           row layout, but flex-basis tracks the main axis — which is height
           once the dropdown switches to flex-direction:column. Left alone it
           reserves ~420px of vertical space after the search field. Reset it
           to content-sized here. */
        .nav-collapse.is-open .nav-search { flex: 0 0 auto; width: 100%; max-width: 100%; margin: 0; }
        .nav-collapse.is-open .nav-actions { flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 10px; }
        .nav-collapse.is-open .nav-staff-link,
        .nav-collapse.is-open .nav-actions .btn { width: 100%; justify-content: center; }

        /* App shell: nav drops to its own scrollable row under the brand. */
        .app-header { height: auto; }
        .app-header-inner { min-height: 60px; grid-template-columns: auto 1fr auto; padding: 0 18px; gap: 12px; }
        .app-navigation { grid-column: 1 / -1; grid-row: 2; height: 46px; justify-content: flex-start; overflow-x: auto; scrollbar-width: none; border-top: 1px solid var(--border-light); }
        .app-navigation::-webkit-scrollbar { display: none; }
        .app-nav-item { height: 46px; flex: 0 0 auto; }
        .header-user-info { display: none; }
        .profile-layout, .dash-grid { grid-template-columns: 1fr; }
        .dash-grid, .profile-page { width: min(100% - 32px, 1180px); padding-top: 18px; }
      }

      /* ---------------------------- <= 640px (large phone) --------------- */
      @media (max-width: 640px) {
        .section { padding: 38px 18px; }
        .section-title { font-size: 22px; line-height: 1.25; margin-bottom: 18px; }
        .section-eyebrow { font-size: 11px; }

        /* Marketing nav — the college's full name lives in .nav-topstrip
           above, so this row only has to fit the crest, the DnyanSetu
           wordmark, the language switch and the hamburger. */
        .nav-marketing { padding: 10px 14px; gap: 8px; }
        .nav-gov-brand { gap: 8px; min-width: 0; flex: 0 1 auto; }
        .landing-brand-wrap { min-width: 0; }
        .landing-brand-name { font-size: 19px; }
        .landing-brand-tag { font-size: 9px; }
        .landing-brand-divider { display: none; }
        .brand-logo-frame--nav { width: 36px; height: 36px; }
        .nav-lang-switch { flex: 0 0 auto; gap: 3px; }
        .nav-lang-btn { padding: 6px 10px; font-size: 11.5px; }
        .nav-actions { gap: 6px; justify-content: flex-end; }
        .nav-actions .btn { padding: 9px 14px; font-size: 13px; min-height: 38px; }
        .nav-search-panel { max-height: 60vh; overflow-y: auto; }

        .hero-alison { padding: 24px 16px 34px; gap: 18px; }
        .hero-slider-caption { padding: 6px 12px; }
        .hero-actions { flex-direction: column; width: 100%; }
        .hero-actions .btn-lg { width: 100%; justify-content: center; }

        .three-col, .stats-grid, .stream-cards-grid, .hub-grid,
        .video-grid, .module-grid-three, .about-page-card-grid,
        .about-page-flow-steps, .footer-cols-four { grid-template-columns: 1fr; }
        .footer-social-block { grid-column: auto; }
        .stream-box { padding: 18px 16px; border-radius: 16px; }

        /* Landscape list rows instead of tall portrait cards, so Notes /
           PYQ / Quiz (and every other hub grid) take far less scrolling. */
        .hub-card { flex-direction: row; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 4px; border-top: 1px solid rgba(15, 23, 42, 0.18); border-left: 3px solid var(--abc-navy); }
        .hub-card-icon { width: 40px; height: 40px; margin-bottom: 0; }
        .hub-card-body { gap: 3px; }
        .hub-card h3 { font-size: 15px; }
        .hub-card p { font-size: 12.5px; line-height: 1.5; }
        .hub-card-link { margin-top: 4px; }
        .hub-card:hover { border-left-color: var(--abc-saffron); }

        .notice-board-head h2 { font-size: 13px; }
        .notice-item { flex-wrap: wrap; padding: 14px 16px; gap: 8px; }
        .notice-item-title { font-size: 13px; }

        .service-row { flex-wrap: wrap; padding: 14px 16px; gap: 10px; }
        .service-row-index { display: none; }
        .service-row-icon { width: 36px; height: 36px; }
        .service-row-action { width: 100%; }
        .service-row-btn, .service-row-pending { width: 100%; justify-content: center; }

        .story-shell { padding: 24px 18px; gap: 18px; }
        .story-title { font-size: 22px; }
        .story-quote { font-size: 15px; }

        /* Principal's message: a compact inline header instead of a tall stack. */
        .principal-figure { flex-direction: row; align-items: center; gap: 12px; }
        .principal-photo, .principal-photo-initials { width: 64px; height: 64px; border-width: 3px; font-size: 22px; }
        .principal-caption { align-items: flex-start; text-align: left; }
        .story-copy { align-items: flex-start; text-align: left; gap: 8px; }
        .principal-quote { padding-left: 22px; }
        .principal-mark { font-size: 42px; top: -10px; }
        .principal-quote p { font-size: 14px; line-height: 1.6; }
        .announcement-loop-shell { padding: 12px; }
        .announcement-card { min-width: 240px; min-height: auto; }

        /* Login: brand panel becomes a compact header above the form. */
        .auth-screen { grid-template-columns: 1fr; min-height: 100dvh; }
        .auth-brand-panel {
          padding: 26px 20px 22px;
          border-right: none;
          border-bottom: 4px solid transparent;
          border-image: linear-gradient(90deg, #E65100, #0284C7, #059669, #8B5CF6) 1;
        }
        .auth-brand-header { gap: 10px; }
        .auth-brand-panel .brand-logo-frame--full { width: 92px; }
        .auth-brand-institution { margin-top: 16px; }
        .institution-name { font-size: 12px; }
        .institution-meta { font-size: 9.5px; }
        .auth-form-panel { padding: 26px 18px calc(34px + env(safe-area-inset-bottom)); max-width: 100%; }
        .auth-tabs { width: 100%; }
        .auth-tab { flex: 1; text-align: center; }
        .auth-title { font-size: 23px; }
        .auth-sub { font-size: 13px; }
        .role-tab { justify-content: center; padding: 9px 6px; font-size: 12px; min-height: 38px; }

        /* App shell */
        .app-header-inner { padding: 8px 14px; gap: 10px; }
        .app-brand { font-size: 17px; gap: 8px; }
        .app-brand-mark { width: 30px; height: 30px; }
        .app-brand-divider { display: none; }
        .app-brand-college { display: none; }
        .app-header-right { gap: 4px; }
        .header-logout { width: 38px; height: 38px; }
        .dash-grid, .profile-page { width: calc(100% - 24px); padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
        .profile-card { padding: 18px 16px; }
        .profile-cover { height: 130px; }
        .profile-header-content { display: block; padding: 0 16px 20px; }
        .profile-avatar-wrap { margin-top: -52px; }
        .profile-avatar { width: 100px; height: 100px; }
        .profile-main-info { padding-top: 14px; }
        .profile-title-row { display: block; }
        .profile-title-row > .role-chip { margin-top: 10px; }
        .profile-name-line { flex-wrap: wrap; }
        .profile-name-line h1 { font-size: 23px; }
        .profile-metrics-row { flex-wrap: wrap; gap: 8px; }
        .profile-metric { font-size: 11px; }
        .profile-actions { flex-direction: column; }
        .profile-actions .btn { width: 100%; justify-content: center; }
        .education-row { gap: 12px; }
        .wizard-screen { padding: 20px 14px 60px; }
        .wizard-card { padding: 20px 16px; }
        .modal-card { width: calc(100vw - 28px); max-height: 88dvh; }
      }

      /* ---------------------------- <= 480px (phone) --------------------- */
      @media (max-width: 480px) {
        .section { padding: 32px 14px; }
        .hero-alison { padding: 18px 12px 28px; }
        .nav-marketing { padding: 9px 12px; }
        .landing-brand-tag { display: none; }
        .nav-actions .btn { padding: 8px 12px; font-size: 12.5px; min-height: 36px; }
        .nav-staff-link { padding: 6px 8px; font-size: 11.5px; }
        .brand-logo-frame--nav { width: 36px; height: 36px; }
        .story-shell { padding: 20px 14px; }
        .story-title { font-size: 20px; }
        .story-quote { font-size: 14px; }
        .auth-brand-panel { padding: 22px 16px 18px; }
        .auth-brand-panel .brand-logo-frame--full { width: 80px; }
        .auth-form-panel { padding: 22px 14px calc(30px + env(safe-area-inset-bottom)); }
        .role-tab { font-size: 11px; gap: 4px; }
        .dash-grid, .profile-page { width: calc(100% - 18px); }
        .profile-card { padding: 16px 14px; }
        .profile-avatar { width: 88px; height: 88px; }
        .profile-avatar-wrap { margin-top: -46px; }
        .profile-name-line h1 { font-size: 21px; }
        .app-brand span { font-size: 16px; }
        .footer-cols-four { gap: 20px; }
      }

      /* ---------------------------- <= 380px (small phone) --------------- */
      @media (max-width: 380px) {
        .section { padding: 28px 12px; }
        .section-title { font-size: 20px; }
        .nav-actions { width: 100%; margin-left: 0; }
        .nav-actions .btn { flex: 1 1 0; justify-content: center; }
        .role-selector-staff { flex-direction: column; }
        .profile-metrics-row { flex-direction: column; align-items: flex-start; }
      }

      /* --- Short landscape phones: keep the login panel from eating the screen --- */
      @media (max-height: 520px) and (orientation: landscape) and (max-width: 900px) {
        .auth-brand-panel { padding: 16px; }
        .auth-brand-panel .brand-logo-frame--full { width: 64px; }
        .auth-brand-institution { margin-top: 10px; }
      }

      /* --- Portal specifics that only misbehave once things stack --- */
      @media (max-width: 640px) {
        /* Faculty hero: avatar over the name instead of a cramped two-column row. */
        .fac-hero-main { flex-direction: column; align-items: flex-start; gap: 14px; min-width: 0; }
        .fac-pfp-large, .fac-pfp-placeholder { width: 92px; height: 92px; }
        .fac-info h1, .fac-info h2 { font-size: 22px; }
        .fac-hero-cover { min-height: 100px; padding: 10px; }

        /* Admin desk */
        .table-scroll { border: 1px solid var(--border-light); border-radius: 12px; }

        /* Any card heading with a button cluster on the right. */
        .profile-card-heading { flex-wrap: wrap; gap: 10px; }

        /* Modals fill the phone rather than floating in a tiny box. */
        .modal-overlay { padding: 12px; align-items: flex-end; }
        .modal-card { width: 100%; max-height: 86dvh; overflow-y: auto; border-radius: 18px 18px 12px 12px; }
      }

      /* ================================================================
         RESOURCE PAGES (question papers + scholarships)
         ================================================================ */
      .resource-page { width: min(1080px, calc(100% - 48px)); margin: 0 auto; padding: 30px 0 90px; }
      .resource-head { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
      .resource-head-copy { max-width: 720px; }
      .resource-head .section-eyebrow { justify-content: flex-start; }
      .resource-title { font-size: clamp(24px, 3vw, 32px); font-weight: 700; color: var(--abc-navy); font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; line-height: 1.2; }
      .resource-sub { margin-top: 10px; color: var(--text-subtle); font-size: 15px; line-height: 1.65; }

      .resource-note {
        display: flex; gap: 10px; align-items: flex-start;
        margin-top: 20px; padding: 12px 14px;
        background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px;
        color: #9A4E00; font-size: 13px; line-height: 1.55;
      }
      .resource-note svg { flex: 0 0 auto; margin-top: 1px; }

      .scholarship-contact {
        display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
        margin-top: 16px; padding: 18px 20px;
        background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px;
      }
      .scholarship-contact-avatar {
        width: 68px; height: 68px; border-radius: 50%; overflow: hidden; flex: 0 0 auto;
        display: flex; align-items: center; justify-content: center;
        background: var(--abc-blue); color: #fff;
      }
      .scholarship-contact-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .scholarship-contact-body { min-width: 0; }
      .scholarship-contact-label { font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
      .scholarship-contact-name { margin-top: 4px; font-size: 19px; font-weight: 700; color: var(--abc-navy); }
      .scholarship-contact-role { margin-top: 2px; font-size: 14.5px; color: var(--text-subtle); }
      .scholarship-contact-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; font-size: 13.5px; color: var(--text-muted); }
      .scholarship-contact-meta span { display: inline-flex; align-items: center; gap: 6px; }

      /* Breadcrumb */
      .crumbs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 22px 0 16px; }
      .crumb {
        border: 0; background: transparent; padding: 4px 2px;
        font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
        color: var(--abc-blue); cursor: pointer;
      }
      .crumb.is-current { color: var(--text-muted); cursor: default; }
      .crumb-sep { color: #CBD5E1; flex: 0 0 auto; }

      /* Stream / subject cards */
      .resource-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(232px, 1fr)); gap: 16px; }
      .resource-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
        text-align: left; padding: 20px 18px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 14px;
        box-shadow: var(--shadow-sm); cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .resource-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: rgba(29, 78, 216, 0.28); }
      .resource-card-icon {
        width: 38px; height: 38px; border-radius: 10px; margin-bottom: 4px;
        display: inline-flex; align-items: center; justify-content: center;
        background: #EFF6FF; color: var(--abc-blue);
      }
      .resource-card h3 { font-size: 17px; color: var(--abc-navy); }
      .resource-card-full { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
      .resource-card p { font-size: 13px; color: var(--text-subtle); line-height: 1.55; }
      .resource-card-meta {
        margin-top: auto; padding-top: 12px;
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12.5px; font-weight: 600; color: var(--abc-blue);
      }

      .resource-empty { margin-top: 24px; padding: 16px; color: var(--text-muted); font-size: 14px; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 12px; }

      /* Toolbar: subject search + session filter */
      .resource-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 18px; }
      .resource-search {
        display: flex; align-items: center; gap: 8px;
        padding: 0 14px; height: 44px; min-width: 260px; flex: 1 1 260px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 999px;
        color: var(--text-muted);
      }
      .resource-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: 14px; color: var(--text-dark); font-family: inherit; }

      .chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .chip {
        height: 38px; padding: 0 16px; border-radius: 999px;
        border: 1px solid var(--border-light); background: #FFFFFF;
        font-size: 13px; font-weight: 600; color: var(--text-subtle); cursor: pointer;
        transition: all 0.18s ease;
      }
      .chip:hover { border-color: rgba(29, 78, 216, 0.3); color: var(--abc-navy); }
      .chip.is-active { background: var(--abc-navy); border-color: var(--abc-navy); color: #FFFFFF; }

      /* Paper rows */
      .paper-list { display: flex; flex-direction: column; gap: 10px; }
      .paper-row {
        display: grid; grid-template-columns: 62px 92px minmax(0, 1fr) auto auto;
        align-items: center; gap: 14px;
        padding: 14px 16px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 12px;
        box-shadow: var(--shadow-sm);
      }
      .paper-year { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: var(--abc-navy); }
      .paper-session {
        justify-self: start; padding: 4px 10px; border-radius: 999px;
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
      }
      .paper-session--winter { background: #EFF6FF; color: #1D4ED8; }
      .paper-session--summer { background: #FFF7ED; color: #C2410C; }
      .paper-name { display: flex; flex-direction: column; gap: 2px; font-size: 14px; font-weight: 600; color: var(--abc-navy); min-width: 0; }
      .paper-name small { font-size: 11.5px; font-weight: 500; color: var(--text-muted); }
      .paper-status { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
      .paper-status.is-live { color: var(--abc-emerald); font-weight: 600; }
      .paper-download { white-space: nowrap; }

      /* Scholarships */
      .category-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 4px; }
      .category-chip {
        padding: 9px 16px; border-radius: 999px;
        border: 1px solid var(--border-light); background: #FFFFFF;
        font-size: 13px; font-weight: 600; color: var(--text-subtle); cursor: pointer;
        transition: all 0.18s ease;
      }
      .category-chip:hover { border-color: rgba(29, 78, 216, 0.32); color: var(--abc-navy); }
      .category-chip.is-active { background: var(--abc-navy); border-color: var(--abc-navy); color: #FFFFFF; }

      .category-summary {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        margin: 26px 0 16px; padding: 16px 18px;
        background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 14px;
      }
      .category-summary h2 { font-size: 19px; color: var(--abc-navy); }
      .category-summary p { margin-top: 4px; font-size: 13px; color: var(--text-muted); }
      .category-count {
        padding: 6px 12px; border-radius: 999px; background: #EFF6FF;
        font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 700; color: var(--abc-blue);
        white-space: nowrap;
      }

      .scheme-list { display: flex; flex-direction: column; gap: 14px; }
      .scheme-card {
        padding: 20px; background: #FFFFFF;
        border: 1px solid var(--border-light); border-left: 4px solid var(--abc-saffron);
        border-radius: 14px; box-shadow: var(--shadow-sm);
      }
      .scheme-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
      .scheme-head h3 { font-size: 17px; color: var(--abc-navy); line-height: 1.35; }
      .scheme-amount {
        padding: 5px 11px; border-radius: 999px; background: #ECFDF5;
        color: var(--abc-emerald); font-size: 12px; font-weight: 700; white-space: nowrap;
      }
      .scheme-provider { margin-top: 6px; font-size: 12.5px; color: var(--text-muted); }
      .scheme-eligibility { margin-top: 10px; font-size: 13.5px; color: var(--text-subtle); line-height: 1.6; }
      .scheme-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 12.5px; color: var(--text-muted); }
      .scheme-meta span { display: inline-flex; align-items: center; gap: 6px; }
      .scheme-note {
        display: flex; gap: 10px; align-items: flex-start;
        margin-top: 12px; padding: 14px 16px;
        background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px;
        color: #9A4E00; font-size: 13px; line-height: 1.7;
      }
      .scheme-note svg { flex: 0 0 auto; margin-top: 2px; }
      .scheme-note--global { margin: 20px 0 20px; }
      .scheme-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }

      .doc-list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-light); list-style: none; }
      .doc-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 13.5px; color: var(--text-subtle); line-height: 1.6; }
      .doc-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--abc-emerald); }
      .doc-list--two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; }

      .doc-summary { margin-top: 26px; padding: 22px; background: #F8FAFC; border: 1px solid var(--border-light); border-radius: 14px; }
      .doc-summary h2 { display: flex; align-items: center; gap: 8px; font-size: 18px; color: var(--abc-navy); }
      .doc-summary > p { margin-top: 6px; font-size: 13px; color: var(--text-muted); }
      .doc-summary > .btn { margin-top: 14px; }

      @media (max-width: 900px) {
        .resource-page { width: min(100% - 32px, 1080px); }
        .doc-list--two { grid-template-columns: 1fr; }
      }

      @media (max-width: 640px) {
        .resource-page { width: calc(100% - 24px); padding: 20px 0 calc(70px + env(safe-area-inset-bottom)); }
        .resource-sub { font-size: 14px; }
        .resource-grid { grid-template-columns: 1fr; }
        .resource-card { padding: 16px; }
        .resource-search { min-width: 0; flex: 1 1 100%; }
        .chip { height: 40px; padding: 0 13px; font-size: 12.5px; }

        /* Paper rows restack: year + session on one line, then title, then the
           download button full width so it stays an easy tap target. */
        .paper-row {
          grid-template-columns: auto auto 1fr;
          grid-template-areas:
            "year session status"
            "name name name"
            "dl dl dl";
          gap: 8px 10px; padding: 14px;
        }
        .paper-year { grid-area: year; font-size: 15px; }
        .paper-session { grid-area: session; }
        .paper-status { grid-area: status; justify-self: end; }
        .paper-name { grid-area: name; }
        .paper-download { grid-area: dl; width: 100%; justify-content: center; margin-top: 4px; }

        .resource-page { width: calc(100% - 32px); }
        .resource-head { gap: 14px; }
        .resource-head-copy { display: flex; flex-direction: column; gap: 6px; }
        .resource-note { margin-top: 22px; }
        .scholarship-contact { margin-top: 18px; }
        .category-row { margin: 24px 0 16px; }
        .resource-empty { margin-top: 12px; }
        .category-summary { padding: 16px; margin-top: 22px; flex-direction: column; align-items: flex-start; gap: 8px; }
        .scheme-note--global { margin: 20px 0 6px; }
        .scheme-list { gap: 18px; margin-top: 6px; }
        .scheme-card { padding: 18px 16px; }
        .scheme-head { gap: 10px; }
        .scheme-actions .btn { flex: 1 1 100%; justify-content: center; }
        .doc-summary { margin-top: 30px; padding: 18px 16px; }
        .doc-summary > .btn { width: 100%; justify-content: center; }
        .doc-list--two { grid-template-columns: 1fr; }
      }

      /* ------------------------- Backend status messages ------------------------- */

      .app-notice {
        position: fixed;
        top: calc(80px + env(safe-area-inset-top, 0px));
        left: 50%; transform: translateX(-50%); z-index: 200;
        display: flex; align-items: center; gap: 10px;
        width: min(440px, calc(100% - 24px)); max-width: calc(100% - 24px);
        box-sizing: border-box; padding: 11px 14px;
        background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px;
        box-shadow: var(--shadow-md); color: #9A4E00; font-size: 13.5px; line-height: 1.5;
        animation: noticeIn 0.2s ease-out;
      }
      @keyframes noticeIn { from { opacity: 0; transform: translate(-50%, -8px); } }
      .app-notice svg:first-child { flex: 0 0 auto; }
      .app-notice span { flex: 1; }
      .app-notice button {
        flex: 0 0 auto; display: grid; place-items: center;
        width: 22px; height: 22px; border: 0; border-radius: 6px;
        background: rgba(154, 78, 0, 0.1); color: inherit; cursor: pointer;
      }
      .app-notice button:hover { background: rgba(154, 78, 0, 0.2); }
      .app-notice--setup { width: min(640px, calc(100% - 24px)); max-width: calc(100% - 24px); }
      @media (max-width: 640px) {
        .app-notice { top: calc(72px + env(safe-area-inset-top, 0px)); font-size: 13px; padding: 10px 12px; }
      }
      .app-notice--setup code {
        padding: 1px 5px; border-radius: 5px;
        background: rgba(154, 78, 0, 0.12);
        font-family: 'JetBrains Mono', monospace; font-size: 12px;
      }

      .upload-error {
        margin: 0 0 8px; padding: 8px 11px; border-radius: 9px;
        background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25);
        color: #991B1B; font-size: 12.5px; line-height: 1.45;
      }

      /* --------------------------- Privacy / Terms pages -------------------------- */

      .legal-page { width: min(820px, calc(100% - 48px)); margin: 0 auto; padding: 30px 0 90px; }
      .legal-body { margin-top: 30px; }
      .legal-section { margin-bottom: 30px; }
      .legal-section h2 {
        display: flex; align-items: baseline; gap: 11px;
        margin-bottom: 10px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 18px; font-weight: 700; color: var(--abc-navy);
      }
      .legal-number {
        flex: 0 0 auto;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px; font-weight: 600; color: var(--abc-saffron);
      }
      .legal-section p {
        margin-bottom: 12px; padding-left: 33px;
        font-size: 14.5px; line-height: 1.75; color: var(--text-subtle);
      }
      .legal-section p:last-child { margin-bottom: 0; }

      .legal-contact {
        margin-top: 36px; padding: 20px 22px; border-radius: 14px;
        background: rgba(29, 78, 216, 0.05); border: 1px solid rgba(29, 78, 216, 0.16);
      }
      .legal-contact h2 {
        display: flex; align-items: center; gap: 9px; margin-bottom: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 16px; font-weight: 700; color: var(--abc-navy);
      }
      .legal-contact p { font-size: 14px; line-height: 1.7; color: var(--text-subtle); }
      .legal-contact a { color: var(--abc-blue); font-weight: 600; }

      /* Section headings for the split admin directory. */
      .admin-section-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 14px; flex-wrap: wrap; margin-bottom: 14px;
      }
      .admin-section-head h3 { display: flex; align-items: center; gap: 9px; }

      @media (max-width: 640px) {
        .legal-page { width: calc(100% - 24px); padding: 20px 0 70px; }
        .legal-section p { padding-left: 0; font-size: 14px; }
        .admin-section-head .btn { width: 100%; justify-content: center; }
      }

      /* ------------------------------ Notes library ------------------------------ */

      .notes-loading {
        display: flex; align-items: center; gap: 9px; padding: 28px 0;
        color: var(--text-muted); font-size: 14px;
      }
      .is-empty-card { border-style: dashed; }

      .notes-groups { display: flex; flex-direction: column; gap: 28px; }
      .notes-subject {
        display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
        margin-bottom: 12px; padding-bottom: 8px;
        border-bottom: 1px solid var(--border-light);
        font-family: 'Space Grotesk', sans-serif;
        font-size: 17px; font-weight: 700; color: var(--abc-navy);
      }
      .notes-subject span {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11.5px; font-weight: 600; color: var(--text-muted);
      }

      .notes-list { display: flex; flex-direction: column; gap: 12px; }
      .note-card {
        padding: 18px 20px; border-radius: 14px;
        background: #FFFFFF; border: 1px solid var(--border-light);
        box-shadow: var(--shadow-sm);
      }
      .note-card-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 12px; flex-wrap: wrap;
      }
      .note-card-head h3 { font-size: 15.5px; font-weight: 700; color: var(--abc-navy); line-height: 1.4; }
      .note-sem {
        flex: 0 0 auto; padding: 3px 10px; border-radius: 999px;
        background: rgba(29, 78, 216, 0.08); color: var(--abc-blue);
        font-size: 11.5px; font-weight: 700;
      }
      .note-desc { margin-top: 6px; font-size: 13.5px; color: var(--text-muted); line-height: 1.6; }
      .note-meta {
        display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 10px;
        font-size: 12.5px; color: var(--text-muted);
      }
      .note-meta span { display: inline-flex; align-items: center; gap: 5px; }
      .note-stream-tag {
        padding: 2px 9px; border-radius: 999px;
        background: rgba(230, 81, 0, 0.09); color: var(--abc-saffron); font-weight: 700; font-size: 11.5px;
      }

      .note-files { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
      .note-file {
        display: flex; align-items: center; gap: 9px;
        padding: 9px 12px; border-radius: 10px; text-decoration: none;
        background: #F8FAFC; border: 1px solid var(--border-light);
        color: var(--text-subtle); font-size: 13px;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .note-file:hover { background: #F1F5F9; border-color: rgba(29, 78, 216, 0.3); color: var(--abc-blue); }
      .note-file-name {
        flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .note-file-size {
        flex: 0 0 auto; font-family: 'JetBrains Mono', monospace;
        font-size: 11px; color: var(--text-muted);
      }

      .note-actions {
        display: flex; align-items: center; justify-content: flex-end;
        gap: 8px; flex-wrap: wrap; margin-top: 14px;
        padding-top: 12px; border-top: 1px dashed var(--border-light);
      }
      .note-confirm { margin-right: auto; font-size: 12.5px; color: #991B1B; font-weight: 600; }
      .btn-danger {
        background: var(--abc-rose); color: #FFFFFF; border: 1px solid var(--abc-rose);
      }
      .btn-danger:hover { background: #B91C1C; border-color: #B91C1C; }

      /* Upload composer */
      .note-dropzone {
        display: flex; align-items: center; gap: 10px; cursor: pointer;
        margin-top: 6px; padding: 16px 14px; border-radius: 12px;
        background: rgba(29, 78, 216, 0.04);
        border: 1.5px dashed rgba(29, 78, 216, 0.35);
        color: var(--abc-blue); font-size: 13.5px; font-weight: 600;
      }
      .note-dropzone:hover { background: rgba(29, 78, 216, 0.08); border-color: var(--abc-blue); }
      .note-file-preview {
        list-style: none; margin: 10px 0 0; display: flex; flex-direction: column; gap: 5px;
      }
      .note-file-preview li {
        display: flex; align-items: center; gap: 7px;
        font-size: 12.5px; color: var(--text-muted);
      }
      .upload-progress { margin-top: 14px; }
      .upload-progress-bar {
        height: 6px; border-radius: 999px; overflow: hidden;
        background: rgba(29, 78, 216, 0.12);
      }
      .upload-progress-bar span {
        display: block; height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, var(--abc-blue), var(--abc-cyan));
        transition: width 0.2s ease;
      }
      .upload-progress small {
        display: block; margin-top: 6px;
        font-size: 12px; color: var(--text-muted);
      }

      .note-file-preview em {
        margin-left: auto; font-style: normal;
        font-family: 'JetBrains Mono', monospace; font-size: 11px;
      }

      @media (max-width: 640px) {
        .note-card { padding: 15px 16px; }
        .note-actions { justify-content: stretch; }
        .note-confirm { margin-right: 0; flex: 1 1 100%; }
      }

      /* Download button plus the faculty-only PDF upload control. */
      .paper-actions { display: inline-flex; align-items: center; gap: 8px; }
      .paper-upload {
        display: grid; place-items: center; width: 34px; height: 34px;
        border-radius: 9px; cursor: pointer;
        background: rgba(29, 78, 216, 0.08); border: 1px solid rgba(29, 78, 216, 0.2);
        color: var(--abc-blue); flex: 0 0 auto;
      }
      .paper-upload:hover { background: rgba(29, 78, 216, 0.16); }

      /* ============================ Quiz & practice tests ============================ */

      .quiz-page { width: min(1080px, calc(100% - 48px)); margin: 0 auto; padding: 30px 0 90px; }
      .quiz-head { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; }
      .quiz-head-copy { max-width: 760px; }
      .quiz-head .section-eyebrow { justify-content: flex-start; }
      .quiz-title {
        font-size: clamp(24px, 3vw, 32px); font-weight: 700; color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; line-height: 1.2;
      }
      .quiz-sub { margin-top: 10px; color: var(--text-subtle); font-size: 15px; line-height: 1.65; }

      /* The four standing rules, always visible so nobody has to ask. */
      .quiz-rulebar { display: flex; flex-wrap: wrap; gap: 8px; }
      .quiz-rulebar span {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 11px; border-radius: 999px;
        background: rgba(29, 78, 216, 0.07); border: 1px solid rgba(29, 78, 216, 0.16);
        color: var(--abc-navy); font-size: 12.5px; font-weight: 600;
      }
      .quiz-rulebar svg { color: var(--abc-blue); flex: 0 0 auto; }

      .quiz-stage-title {
        margin: 6px 0 18px; font-size: 19px; font-weight: 700; color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif;
      }
      .quiz-stage-title small { font-weight: 500; color: var(--text-muted); font-size: 14px; }

      .quiz-note {
        display: flex; gap: 9px; align-items: flex-start;
        margin-top: 20px; padding: 12px 14px;
        background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px;
        color: #9A4E00; font-size: 13px; line-height: 1.55;
      }
      .quiz-note svg { flex: 0 0 auto; margin-top: 1px; }

      /* ----------------------------- Selection cards ----------------------------- */

      .quiz-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 16px; }
      .quiz-grid--years { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
      .quiz-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
        text-align: left; padding: 20px 18px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 14px;
        box-shadow: var(--shadow-sm); cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      }
      .quiz-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: rgba(29, 78, 216, 0.28); }
      .quiz-card h3 { font-size: 15.5px; font-weight: 700; color: var(--abc-navy); }
      .quiz-card p { font-size: 13px; color: var(--text-muted); line-height: 1.55; }
      .quiz-card-full { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--abc-blue); }
      .quiz-card-icon {
        width: 38px; height: 38px; border-radius: 10px; margin-bottom: 4px;
        display: grid; place-items: center;
        background: rgba(29, 78, 216, 0.09); color: var(--abc-blue);
      }
      .quiz-card-meta {
        display: inline-flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 10px;
        font-size: 12.5px; font-weight: 600; color: var(--abc-saffron);
      }
      .quiz-card-cleared { font-style: normal; color: var(--abc-emerald); }
      .quiz-card-pending { font-style: normal; color: var(--text-muted); font-weight: 500; }
      .quiz-card.is-thin { border-style: dashed; }
      .quiz-year-num {
        display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px;
        background: var(--abc-navy); color: #FFFFFF;
        font-family: 'Space Grotesk', sans-serif; font-size: 19px; font-weight: 700;
      }

      /* Three dots per subject card: one per level, filled once cleared. */
      .quiz-level-pips { display: flex; gap: 5px; margin-top: 8px; }
      .pip { width: 20px; height: 5px; border-radius: 999px; background: var(--border-strong); }
      .pip.is-done { background: var(--abc-emerald); }
      .pip--exam { width: 10px; background: var(--border-strong); }
      .pip--exam.is-done { background: var(--abc-saffron); }

      /* ------------------------------- Level menu ------------------------------- */

      .quiz-subject-head {
        display: flex; align-items: flex-start; justify-content: space-between;
        gap: 16px; flex-wrap: wrap; margin-bottom: 8px;
      }
      .quiz-subject-head .quiz-stage-title { margin-bottom: 4px; }
      .quiz-subject-topic { font-size: 13px; color: var(--text-muted); }
      .quiz-bank-tally {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 13px; border-radius: 12px;
        background: #FFFFFF; border: 1px solid var(--border-light);
        font-size: 13px; color: var(--text-subtle);
      }
      .quiz-bank-tally strong { color: var(--abc-navy); }
      .quiz-bank-tally svg { color: var(--abc-blue); }

      .quiz-levels { display: flex; flex-direction: column; gap: 12px; margin-top: 18px; }
      .quiz-level {
        display: grid; grid-template-columns: 46px 1fr auto; align-items: center; gap: 16px;
        padding: 18px 20px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-radius: 14px;
        box-shadow: var(--shadow-sm);
      }
      .quiz-level.is-passed { border-color: rgba(5, 150, 105, 0.35); background: #F6FEFB; }
      .quiz-level.is-locked { opacity: 0.72; background: #FBFCFD; }
      .quiz-level--exam { border-color: rgba(230, 81, 0, 0.28); }
      .quiz-level--exam.is-passed { border-color: rgba(230, 81, 0, 0.5); background: #FFFBF6; }
      .quiz-level-rank {
        display: grid; place-items: center; width: 46px; height: 46px; border-radius: 12px;
        background: rgba(29, 78, 216, 0.09); color: var(--abc-blue);
        font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 700;
      }
      .quiz-level.is-passed .quiz-level-rank { background: rgba(5, 150, 105, 0.12); color: var(--abc-emerald); }
      .quiz-level--exam .quiz-level-rank { background: rgba(230, 81, 0, 0.1); color: var(--abc-saffron); }
      .quiz-level-copy h3 {
        display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
        font-size: 16px; font-weight: 700; color: var(--abc-navy);
      }
      .quiz-level-copy p { margin-top: 5px; font-size: 13.5px; color: var(--text-muted); line-height: 1.55; }
      .quiz-level-facts { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--text-subtle); }
      .quiz-level-blocked {
        display: inline-flex; align-items: center; text-align: right;
        max-width: 210px; font-size: 12.5px; color: var(--text-muted); line-height: 1.45;
      }
      .quiz-tag {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
      }
      .quiz-tag--pass { background: rgba(5, 150, 105, 0.12); color: var(--abc-emerald); }
      .quiz-tag--lock { background: rgba(100, 116, 139, 0.12); color: var(--text-muted); }

      /* ------------------------------- The paper ------------------------------- */

      .quiz-sitting { margin-top: 8px; }
      .quiz-sitting-bar {
        display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        padding: 14px 18px; border-radius: 14px 14px 0 0;
        background: var(--abc-navy); color: #FFFFFF;
      }
      .quiz-sitting-id strong { display: block; font-size: 15px; font-weight: 700; }
      .quiz-sitting-id small { font-size: 12px; opacity: 0.72; }
      .quiz-sitting-stats { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12.5px; }
      .quiz-sitting-stats span { display: inline-flex; align-items: center; gap: 6px; }
      .quiz-sitting-nomark {
        padding: 4px 10px; border-radius: 999px;
        background: rgba(255, 255, 255, 0.14); font-weight: 600;
      }
      .quiz-progressbar { height: 4px; background: rgba(11, 30, 46, 0.1); overflow: hidden; }
      .quiz-progressbar span { display: block; height: 100%; background: var(--abc-saffron); transition: width 0.25s ease; }

      .quiz-sitting-body {
        display: grid; grid-template-columns: 1fr 216px; gap: 0;
        background: #FFFFFF; border: 1px solid var(--border-light); border-top: 0;
        border-radius: 0 0 14px 14px; overflow: hidden;
      }
      .quiz-question { padding: 26px 24px; }
      .quiz-question-num {
        font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 600;
        color: var(--abc-blue); text-transform: uppercase; letter-spacing: 0.06em;
      }
      .quiz-question-text {
        margin: 10px 0 20px; font-size: 17.5px; font-weight: 600; line-height: 1.5;
        color: var(--text-dark);
      }
      .quiz-options { display: flex; flex-direction: column; gap: 10px; }
      .quiz-option {
        display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
        padding: 13px 15px; border-radius: 12px; cursor: pointer;
        background: #FFFFFF; border: 1.5px solid var(--border-light);
        font-size: 14.5px; color: var(--text-subtle); font-family: inherit;
        transition: border-color 0.15s ease, background 0.15s ease;
      }
      .quiz-option:hover { border-color: rgba(29, 78, 216, 0.4); background: #F8FAFF; }
      .quiz-option.is-chosen { border-color: var(--abc-blue); background: rgba(29, 78, 216, 0.06); color: var(--text-dark); }
      .quiz-option-key {
        display: grid; place-items: center; flex: 0 0 auto; width: 26px; height: 26px;
        border-radius: 8px; background: rgba(15, 23, 42, 0.06);
        font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: var(--text-muted);
      }
      .quiz-option.is-chosen .quiz-option-key { background: var(--abc-blue); color: #FFFFFF; }
      .quiz-option-text { flex: 1; line-height: 1.45; }
      .quiz-nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 24px; }

      .quiz-palette {
        padding: 22px 18px; border-left: 1px solid var(--border-light); background: #FBFCFD;
        display: flex; flex-direction: column; gap: 12px;
      }
      .quiz-palette-title {
        font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted);
      }
      .quiz-palette-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
      .quiz-palette-cell {
        aspect-ratio: 1; display: grid; place-items: center; cursor: pointer;
        border-radius: 8px; border: 1px solid var(--border-light); background: #FFFFFF;
        font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: var(--text-muted);
      }
      .quiz-palette-cell.is-answered { background: rgba(5, 150, 105, 0.12); border-color: rgba(5, 150, 105, 0.35); color: var(--abc-emerald); }
      .quiz-palette-cell.is-current { outline: 2px solid var(--abc-blue); outline-offset: 1px; color: var(--abc-blue); }
      .quiz-palette-submit { width: 100%; justify-content: center; margin-top: 4px; }
      .quiz-palette-quit {
        border: 0; background: transparent; cursor: pointer; padding: 2px;
        font-family: inherit; font-size: 12px; color: var(--text-muted); text-decoration: underline;
      }

      .quiz-confirm {
        position: fixed; inset: 0; z-index: 120; display: grid; place-items: center;
        padding: 20px; background: rgba(11, 30, 46, 0.5);
      }
      .quiz-confirm-card {
        width: min(420px, 100%); padding: 24px;
        background: #FFFFFF; border-radius: 16px; box-shadow: var(--shadow-lg);
      }
      .quiz-confirm-card h3 { font-size: 18px; font-weight: 700; color: var(--abc-navy); }
      .quiz-confirm-card p { margin-top: 8px; font-size: 14px; color: var(--text-subtle); line-height: 1.6; }
      .quiz-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

      /* -------------------------------- Result -------------------------------- */

      .quiz-result { margin-top: 8px; }
      .quiz-result-head {
        display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 18px;
        padding: 24px; border-radius: 16px; border: 1px solid var(--border-light); background: #FFFFFF;
      }
      .quiz-result-head.is-pass { border-color: rgba(5, 150, 105, 0.4); background: #F4FDF9; }
      .quiz-result-head.is-fail { border-color: rgba(230, 81, 0, 0.35); background: #FFFAF5; }
      .quiz-result-badge {
        display: grid; place-items: center; width: 58px; height: 58px; border-radius: 16px;
      }
      .is-pass .quiz-result-badge { background: rgba(5, 150, 105, 0.14); color: var(--abc-emerald); }
      .is-fail .quiz-result-badge { background: rgba(230, 81, 0, 0.12); color: var(--abc-saffron); }
      .quiz-result-stage {
        font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
      }
      .quiz-result-copy h2 {
        margin: 4px 0 6px; font-size: 24px; font-weight: 700; color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif;
      }
      .quiz-result-line { font-size: 14px; color: var(--text-subtle); line-height: 1.6; }
      .quiz-result-score { text-align: right; font-family: 'Space Grotesk', sans-serif; }
      .quiz-result-score strong { display: block; font-size: 38px; font-weight: 700; color: var(--abc-navy); line-height: 1; }
      .quiz-result-score span { font-size: 13px; color: var(--text-muted); }

      .quiz-result-stats {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px;
      }
      .quiz-result-stats div {
        padding: 14px; border-radius: 12px; text-align: center;
        background: #FFFFFF; border: 1px solid var(--border-light);
      }
      .quiz-result-stats strong {
        display: block; font-family: 'Space Grotesk', sans-serif; font-size: 20px;
        font-weight: 700; color: var(--abc-navy);
      }
      .quiz-result-stats span { font-size: 12px; color: var(--text-muted); }
      .quiz-result-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }

      .quiz-review-title {
        margin: 32px 0 14px; font-size: 17px; font-weight: 700; color: var(--abc-navy);
        font-family: 'Space Grotesk', sans-serif;
      }
      .quiz-review { display: flex; flex-direction: column; gap: 12px; list-style: none; }
      .quiz-review-item {
        padding: 18px 20px; border-radius: 14px;
        background: #FFFFFF; border: 1px solid var(--border-light); border-left-width: 4px;
      }
      .quiz-review-item.is-correct { border-left-color: var(--abc-emerald); }
      .quiz-review-item.is-wrong { border-left-color: var(--abc-rose); }
      .quiz-review-item.is-skipped { border-left-color: var(--border-strong); }
      .quiz-review-head { display: flex; gap: 10px; align-items: flex-start; }
      .quiz-review-icon { flex: 0 0 auto; margin-top: 2px; }
      .is-correct .quiz-review-icon { color: var(--abc-emerald); }
      .is-wrong .quiz-review-icon, .is-skipped .quiz-review-icon { color: var(--abc-rose); }
      .quiz-review-q { font-size: 14.5px; font-weight: 600; color: var(--text-dark); line-height: 1.5; }
      .quiz-review-options { display: flex; flex-direction: column; gap: 6px; margin: 12px 0 0; list-style: none; }
      .quiz-review-options li {
        display: flex; align-items: center; gap: 9px; padding: 8px 11px; border-radius: 9px;
        font-size: 13.5px; color: var(--text-subtle); background: #F8FAFC;
      }
      .quiz-review-options li.is-answer { background: rgba(5, 150, 105, 0.1); color: #065F46; font-weight: 600; }
      .quiz-review-options li.is-chosen-wrong { background: rgba(220, 38, 38, 0.08); color: #991B1B; }
      .quiz-review-options em {
        margin-left: auto; font-style: normal; font-size: 11px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;
      }
      .quiz-review-key {
        display: grid; place-items: center; flex: 0 0 auto; width: 22px; height: 22px; border-radius: 6px;
        background: rgba(15, 23, 42, 0.06);
        font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;
      }
      .quiz-review-note { margin-top: 8px; font-size: 12.5px; color: var(--text-muted); font-style: italic; }

      @media (max-width: 900px) {
        /* The question palette moves under the paper rather than beside it. */
        .quiz-sitting-body { grid-template-columns: 1fr; }
        .quiz-palette { border-left: 0; border-top: 1px solid var(--border-light); }
        .quiz-palette-grid { grid-template-columns: repeat(10, 1fr); }
      }

      @media (max-width: 640px) {
        .quiz-page { width: calc(100% - 24px); padding: 20px 0 calc(70px + env(safe-area-inset-bottom)); }
        .quiz-sub { font-size: 14px; }
        .quiz-grid, .quiz-grid--years { grid-template-columns: 1fr; }
        .quiz-card { padding: 16px; }

        /* Level rows restack: badge + title, then copy, then a full-width action. */
        .quiz-level { grid-template-columns: 40px 1fr; gap: 12px; padding: 16px; }
        .quiz-level-rank { width: 40px; height: 40px; font-size: 16px; }
        .quiz-level-action { grid-column: 1 / -1; }
        .quiz-level-action .btn { width: 100%; justify-content: center; }
        .quiz-level-blocked { max-width: none; text-align: left; }

        .quiz-question { padding: 20px 16px; }
        .quiz-question-text { font-size: 16px; }
        .quiz-option { padding: 12px 13px; font-size: 14px; }
        .quiz-nav .btn { flex: 1; justify-content: center; }
        .quiz-palette-grid { grid-template-columns: repeat(8, 1fr); }

        .quiz-result-head { grid-template-columns: auto 1fr; padding: 18px; }
        .quiz-result-score { grid-column: 1 / -1; text-align: left; }
        .quiz-result-stats { grid-template-columns: repeat(2, 1fr); }
        .quiz-result-actions .btn { flex: 1 1 100%; justify-content: center; }
        .quiz-review-options em { margin-left: 0; }
      }

    `}</style>
  );
}
