/* ============================================================================
   DyanSetu — Student resource data (PYQ papers + scholarships)

   PLACEHOLDER CONTENT. The structure is final; the values are representative
   examples so the pages are fully functional today. Replace them with the
   verified lists when those are ready — nothing else needs to change.
   ========================================================================== */

/* ------------------------------- PYQ papers ------------------------------- */

/* Sessions the university runs, newest first inside each year. */
export const PYQ_SESSIONS = ["Winter", "Summer"];

/* Years currently on file, newest first. */
export const PYQ_YEARS = [2024, 2023, 2022, 2021];

/* Real PDFs go here as they are digitised, keyed
   "<streamId>/<subjectId>/<year>/<session>". Any paper without an entry falls
   back to a generated placeholder PDF, so every Download button still works.

   Example once a real file exists:
     "bsc-cs/dbms/2024/Winter": "/papers/bsc-cs-dbms-2024-winter.pdf",
*/
export const PYQ_FILES = {};

export const PYQ_STREAMS = [
  {
    id: "bsc",
    name: "B.Sc.",
    full: "Bachelor of Science",
    blurb: "Physics, Chemistry, Mathematics and the life sciences.",
    subjects: [
      { id: "physics", name: "Physics", code: "PHY" },
      { id: "chemistry", name: "Chemistry", code: "CHE" },
      { id: "mathematics", name: "Mathematics", code: "MAT" },
      { id: "botany", name: "Botany", code: "BOT" },
      { id: "zoology", name: "Zoology", code: "ZOO" },
    ],
  },
  {
    id: "bsc-cs",
    name: "B.Sc. CS",
    full: "B.Sc. Computer Science",
    blurb: "Programming, systems, databases and networks.",
    subjects: [
      { id: "c-programming", name: "Programming in C", code: "CS-101" },
      { id: "data-structures", name: "Data Structures", code: "CS-201" },
      { id: "dbms", name: "Database Management Systems", code: "CS-202" },
      { id: "operating-systems", name: "Operating Systems", code: "CS-301" },
      { id: "networks", name: "Computer Networks", code: "CS-302" },
    ],
  },
  {
    id: "bca",
    name: "BCA",
    full: "Bachelor of Computer Applications",
    blurb: "Applied computing, web technology and software practice.",
    subjects: [
      { id: "c-programming", name: "Programming in C", code: "BCA-101" },
      { id: "web-technology", name: "Web Technology", code: "BCA-203" },
      { id: "dbms", name: "Database Management Systems", code: "BCA-204" },
      { id: "java", name: "Java Programming", code: "BCA-301" },
      { id: "software-engineering", name: "Software Engineering", code: "BCA-302" },
    ],
  },
  {
    id: "ba",
    name: "B.A.",
    full: "Bachelor of Arts",
    blurb: "Languages, history, politics and economics.",
    subjects: [
      { id: "english", name: "English Literature", code: "ENG" },
      { id: "marathi", name: "Marathi", code: "MAR" },
      { id: "history", name: "History", code: "HIS" },
      { id: "political-science", name: "Political Science", code: "POL" },
      { id: "economics", name: "Economics", code: "ECO" },
    ],
  },
  {
    id: "bcom",
    name: "B.Com.",
    full: "Bachelor of Commerce",
    blurb: "Accounting, business law, costing and taxation.",
    subjects: [
      { id: "financial-accounting", name: "Financial Accounting", code: "COM-101" },
      { id: "business-economics", name: "Business Economics", code: "COM-102" },
      { id: "business-law", name: "Business Law", code: "COM-201" },
      { id: "cost-accounting", name: "Cost Accounting", code: "COM-301" },
      { id: "taxation", name: "Taxation", code: "COM-302" },
    ],
  },
];

/* Every subject currently carries the same year/session matrix. Papers are
   derived rather than listed one by one so the data stays editable; drop a
   `years` array on a subject to narrow it. */
export function papersFor(stream, subject) {
  const years = subject.years || PYQ_YEARS;
  const out = [];
  years.forEach((year) => {
    PYQ_SESSIONS.forEach((session) => {
      out.push({
        id: `${year}-${session}`,
        year,
        session,
        url: PYQ_FILES[`${stream.id}/${subject.id}/${year}/${session}`] || null,
      });
    });
  });
  return out;
}

/* ------------------------------ Scholarships ------------------------------ */

/* Who a student should contact with scholarship questions. Placeholder — swap
   in the real name, designation and photo (import it like principalPhoto in
   App.jsx and set `photo` below) as soon as they're confirmed. */
export const SCHOLARSHIP_CONTACT = {
  name: "To be added",
  designation: "Scholarship Coordinator",
  photo: null,
  phone: "",
  email: "",
};

export const SCHOLARSHIP_CATEGORIES = [
  { id: "open", name: "Open / General", note: "No caste-based reservation claimed." },
  { id: "ews", name: "EWS", note: "Economically Weaker Section, general category." },
  { id: "obc", name: "OBC", note: "Other Backward Classes." },
  { id: "sbc", name: "SBC", note: "Special Backward Class." },
  { id: "vjnt", name: "VJ / DT (NT-A)", note: "Vimukta Jati / Denotified Tribes." },
  { id: "nt", name: "NT (B / C / D)", note: "Nomadic Tribes." },
  { id: "sc", name: "SC", note: "Scheduled Caste." },
  { id: "st", name: "ST", note: "Scheduled Tribe." },
  { id: "minority", name: "Minority", note: "Muslim, Buddhist, Christian, Sikh, Jain, Parsi." },
];

/* Document shorthand, expanded on the page. */
const DOC = {
  aadhaar: "Aadhaar card (linked to your mobile number)",
  bank: "Bank passbook — account must be in the student's own name",
  income: "Income certificate from the Tehsildar (current financial year)",
  caste: "Caste certificate",
  validity: "Caste validity certificate",
  nonCreamy: "Non-creamy layer certificate (valid for the current year)",
  ews: "EWS certificate issued by the competent authority",
  domicile: "Domicile / nationality certificate (Maharashtra)",
  marksheet: "Marksheet of the last qualifying examination (10th, 12th and UG, as applicable)",
  admission: "Current-year admission / College current bonafide certificate",
  gap: "Gap certificate (only for gap students, i.e. a break in education)",
  deathCert: "Father's death certificate + mother's income certificate (only if the father is not alive)",
  nonCriminal: "Non-criminal certificate",
  hostel: "Hostel admission proof (for maintenance allowance)",
  hostelAgreement: "Hostel / house-owner rent agreement (only if hostel admission proof is not available)",
  ration: "Ration card",
  minority: "Self-declaration of minority community",
  cet: "CET / entrance score card (where admission was through CET)",
};

export const SCHOLARSHIPS = [
  {
    id: "gov-post-matric-sc",
    name: "Post Matric Scholarship (GOI)",
    provider: "Social Justice & Special Assistance Dept., Govt. of Maharashtra",
    categories: ["sc"],
    amount: "Full tuition + exam fees + maintenance allowance",
    window: "Usually August – December",
    eligibility: "SC students in a recognised post-matric course, family income under ₹2.5 lakh per year.",
    documents: ["aadhaar", "bank", "income", "caste", "validity", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "tribal-post-matric-st",
    name: "Post Matric Scholarship for ST students",
    provider: "Tribal Development Department, Govt. of Maharashtra",
    categories: ["st"],
    amount: "Full tuition + exam fees + maintenance allowance",
    window: "Usually August – December",
    eligibility: "ST students in a recognised post-matric course, family income under ₹2.5 lakh per year.",
    documents: ["aadhaar", "bank", "income", "caste", "validity", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "vjnt-obc-sbc-post-matric",
    name: "Post Matric Scholarship (VJNT / OBC / SBC)",
    provider: "VJNT, OBC & SBC Welfare Department, Govt. of Maharashtra",
    categories: ["obc", "sbc", "vjnt", "nt"],
    amount: "Tuition + exam fees, plus maintenance for eligible students",
    window: "Usually August – December",
    eligibility: "VJNT / OBC / SBC students with a valid non-creamy layer certificate and family income under ₹8 lakh.",
    documents: ["aadhaar", "bank", "income", "caste", "nonCreamy", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "rajarshi-shahu-ews",
    name: "Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti",
    provider: "Higher & Technical Education Dept., Govt. of Maharashtra",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt"],
    amount: "100% tuition fee waiver",
    window: "Along with admission, usually July – November",
    eligibility: "Family income under ₹8 lakh per year, admitted to a professional course through CAP.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "cet", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "ews-tuition-waiver",
    name: "EWS Tuition Fee Waiver Scheme",
    provider: "Govt. of Maharashtra",
    categories: ["open", "ews"],
    amount: "Up to 50% of tuition fees",
    window: "Along with admission",
    eligibility: "Open-category students holding a valid EWS certificate, family income under ₹8 lakh per year.",
    documents: ["aadhaar", "bank", "ews", "income", "domicile", "marksheet", "admission", "nonCriminal", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "panjabrao-deshmukh",
    name: "Dr. Panjabrao Deshmukh Vasatigruh Nirvah Bhatta",
    provider: "Higher & Technical Education Dept., Govt. of Maharashtra",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st"],
    amount: "₹10,000 – ₹30,000 per year hostel maintenance",
    window: "Usually August – December",
    eligibility: "Hostel residents whose parents are registered labourers or landholding farmers; income under ₹8 lakh.",
    documents: ["aadhaar", "bank", "income", "domicile", "hostel", "hostelAgreement", "admission", "ration", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "maulana-azad-minority",
    name: "Scholarship for Minority Community Students",
    provider: "Minority Development Department, Govt. of Maharashtra",
    categories: ["minority"],
    amount: "₹5,000 – ₹25,000 per year",
    window: "Usually September – January",
    eligibility: "Students from notified minority communities with at least 50% in the previous examination.",
    documents: ["aadhaar", "bank", "income", "minority", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "central-sector-merit",
    name: "Central Sector Scheme of Scholarship (Merit)",
    provider: "Ministry of Education, Govt. of India",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st", "minority"],
    amount: "₹12,000 per year for graduation",
    window: "Usually July – October",
    eligibility: "Above the 80th percentile in Class XII, family income under ₹4.5 lakh, pursuing a regular degree.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://scholarships.gov.in/",
  },
  {
    id: "ebc-concession",
    name: "Economically Backward Class (EBC) Concession",
    provider: "Govt. of Maharashtra",
    categories: ["open", "ews"],
    amount: "Partial tuition fee concession",
    window: "Along with admission",
    eligibility: "Open-category students with family income under the notified EBC ceiling.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "eklavya-merit",
    name: "Eklavya Scholarship",
    provider: "Directorate of Higher Education, Maharashtra",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st", "minority"],
    amount: "₹5,000 per year",
    window: "Usually September – December",
    eligibility: "At least 60% in the previous year, parents' income under the notified ceiling; merit-based.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    portal: "https://dhepune.gov.in/",
  },
];

export function scholarshipsFor(categoryId) {
  return SCHOLARSHIPS.filter((s) => s.categories.includes(categoryId));
}

/* Every distinct document a student in this category will need, in a stable order. */
export function documentsFor(categoryId) {
  const seen = [];
  scholarshipsFor(categoryId).forEach((s) =>
    s.documents.forEach((d) => {
      if (!seen.includes(d)) seen.push(d);
    })
  );
  return seen.map((key) => DOC[key]).filter(Boolean);
}

export function expandDocuments(keys) {
  return keys.map((key) => DOC[key]).filter(Boolean);
}
