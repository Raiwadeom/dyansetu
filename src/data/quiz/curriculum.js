/* ============================================================================
   DnyanSetu — Quiz curriculum (SRTM University, NEP 2020)

   Streams offered for practice tests and the final exam. B.A. is deliberately
   excluded: this module serves B.Sc., B.Sc. CS, BCA and B.Com only.

   Year count follows the NEP 2020 structure the university publishes at
   https://srtmun.ac.in/student-corner-syllabi/ — every stream here runs three
   years.

   A bank is addressed as "<streamId>/<subjectId>/<level>", so a subject's
   questions live in exactly one place regardless of which year offers it.
   ========================================================================== */

export const LEVELS = [
  {
    id: "beginner",
    name: "Beginner",
    order: 0,
    blurb: "Definitions, core terms and the facts every paper opens with.",
  },
  {
    id: "intermediate",
    name: "Intermediate",
    order: 1,
    blurb: "Applying the concept — small calculations, comparisons and reasoning.",
  },
  {
    id: "advanced",
    name: "Advanced",
    order: 2,
    blurb: "Analysis, edge cases and the questions that decide the top grades.",
  },
];

export const LEVEL_IDS = LEVELS.map((l) => l.id);

/* Rules the whole quiz module is built around. Change them here, not inline. */
export const PRACTICE_RULES = {
  questions: 15,
  pass: 8,
  marksPerQuestion: 1,
  negativeMarking: 0,
};

export const EXAM_RULES = {
  questions: 30,
  pass: 12,
  marksPerQuestion: 1,
  negativeMarking: 0,
};

/* Target depth per subject: 100 questions a level, 300 a subject. The engine
   works with whatever a bank actually holds and reports any shortfall. */
export const TARGET_PER_LEVEL = 100;
export const TARGET_PER_SUBJECT = TARGET_PER_LEVEL * LEVELS.length;

export const QUIZ_STREAMS = [
  {
    id: "bsc",
    name: "B.Sc.",
    full: "Bachelor of Science",
    blurb: "Physics and Chemistry, across all three years.",
    duration: 3,
    years: [
      {
        year: 1,
        label: "First Year",
        semesters: "Semester I & II",
        subjects: [
          { id: "physics-1", name: "Physics I", topic: "Mechanics & Properties of Matter", code: "BSC-PHY-101" },
          { id: "chemistry-1", name: "Chemistry I", topic: "Inorganic & Physical Fundamentals", code: "BSC-CHE-101" },
        ],
      },
      {
        year: 2,
        label: "Second Year",
        semesters: "Semester III & IV",
        subjects: [
          { id: "physics-2", name: "Physics II", topic: "Thermodynamics, Optics & Waves", code: "BSC-PHY-201" },
          { id: "chemistry-2", name: "Chemistry II", topic: "Organic & Analytical Chemistry", code: "BSC-CHE-201" },
        ],
      },
      {
        year: 3,
        label: "Third Year",
        semesters: "Semester V & VI",
        subjects: [
          { id: "physics-3", name: "Physics III", topic: "Quantum, Nuclear & Solid State", code: "BSC-PHY-301" },
          { id: "chemistry-3", name: "Chemistry III", topic: "Advanced Organic & Spectroscopy", code: "BSC-CHE-301" },
        ],
      },
    ],
  },
  {
    id: "bsc-cs",
    name: "B.Sc. CS",
    full: "B.Sc. Computer Science",
    blurb: "Programming, systems, databases, networks and data science.",
    duration: 3,
    years: [
      {
        year: 1,
        label: "First Year",
        semesters: "Semester I & II",
        subjects: [
          { id: "c-programming", name: "Programming in C", topic: "Structured programming", code: "CS-101" },
          { id: "computer-fundamentals", name: "Computer Fundamentals & Digital Electronics", topic: "Hardware & logic design", code: "CS-102" },
          { id: "discrete-mathematics", name: "Discrete Mathematics", topic: "Logic, sets, relations, graphs", code: "CS-103" },
          { id: "web-design", name: "Web Design Fundamentals", topic: "HTML, CSS and the web stack", code: "CS-104" },
        ],
      },
      {
        year: 2,
        label: "Second Year",
        semesters: "Semester III & IV",
        subjects: [
          { id: "data-structures", name: "Data Structures", topic: "Lists, trees, graphs, hashing", code: "CS-201" },
          { id: "oop-cpp", name: "Object-Oriented Programming with C++", topic: "Classes, inheritance, templates", code: "CS-202" },
          { id: "dbms", name: "Database Management Systems", topic: "Relational model, SQL, normalisation", code: "CS-203" },
          { id: "operating-systems", name: "Operating Systems", topic: "Processes, memory, files", code: "CS-204" },
        ],
      },
      {
        year: 3,
        label: "Third Year",
        semesters: "Semester V & VI",
        subjects: [
          { id: "computer-networks", name: "Computer Networks", topic: "OSI, TCP/IP, routing", code: "CS-301" },
          { id: "software-engineering", name: "Software Engineering", topic: "Process models, testing, quality", code: "CS-302" },
          { id: "python-data-science", name: "Python Programming & Data Science", topic: "Python, NumPy, pandas, statistics", code: "CS-303" },
          { id: "toc-algorithms", name: "Theory of Computation & Algorithms", topic: "Automata, complexity, design techniques", code: "CS-304" },
        ],
      },
    ],
  },
  {
    id: "bca",
    name: "BCA",
    full: "Bachelor of Computer Applications",
    blurb: "Three-year applied computing degree under NEP 2020.",
    duration: 3,
    years: [
      {
        year: 1,
        label: "First Year",
        semesters: "Semester I & II",
        subjects: [
          { id: "c-programming", name: "Programming in C", topic: "Structured programming", code: "BCA-101" },
          { id: "computer-fundamentals", name: "Computer Fundamentals & Digital Logic", topic: "Hardware & Boolean logic", code: "BCA-102" },
          { id: "computing-mathematics", name: "Mathematics for Computing", topic: "Discrete maths & matrices", code: "BCA-103" },
          { id: "web-technology", name: "Web Technology", topic: "HTML, CSS, JavaScript", code: "BCA-104" },
        ],
      },
      {
        year: 2,
        label: "Second Year",
        semesters: "Semester III & IV",
        subjects: [
          { id: "data-structures", name: "Data Structures using C", topic: "Lists, stacks, trees, sorting", code: "BCA-201" },
          { id: "dbms", name: "Database Management Systems", topic: "Relational model, SQL, normalisation", code: "BCA-202" },
          { id: "operating-systems", name: "Operating Systems", topic: "Processes, memory, files", code: "BCA-203" },
          { id: "java-programming", name: "Object-Oriented Programming with Java", topic: "Classes, collections, exceptions", code: "BCA-204" },
        ],
      },
      {
        year: 3,
        label: "Third Year",
        semesters: "Semester V & VI",
        subjects: [
          { id: "computer-networks", name: "Computer Networks", topic: "OSI, TCP/IP, routing", code: "BCA-301" },
          { id: "software-engineering", name: "Software Engineering", topic: "Process models, testing, quality", code: "BCA-302" },
          { id: "python-programming", name: "Python Programming", topic: "Core Python and its libraries", code: "BCA-303" },
          { id: "algorithms", name: "Design & Analysis of Algorithms", topic: "Complexity & design techniques", code: "BCA-304" },
        ],
      },
    ],
  },
  {
    id: "bcom",
    name: "B.Com.",
    full: "Bachelor of Commerce",
    blurb: "Accounting, law, costing, taxation and enterprise.",
    duration: 3,
    years: [
      {
        year: 1,
        label: "First Year",
        semesters: "Semester I & II",
        subjects: [
          { id: "financial-accounting", name: "Financial Accounting", topic: "Journals, ledgers, final accounts", code: "COM-101" },
          { id: "business-economics", name: "Business Economics", topic: "Demand, supply, market structures", code: "COM-102" },
          { id: "business-organisation", name: "Business Organisation & Management", topic: "Forms of business & management functions", code: "COM-103" },
          { id: "business-mathematics", name: "Business Mathematics & Statistics", topic: "Interest, ratios, averages, dispersion", code: "COM-104" },
        ],
      },
      {
        year: 2,
        label: "Second Year",
        semesters: "Semester III & IV",
        subjects: [
          { id: "corporate-accounting", name: "Corporate Accounting", topic: "Shares, debentures, company accounts", code: "COM-201" },
          { id: "business-law", name: "Business Law", topic: "Contract, sale of goods, companies", code: "COM-202" },
          { id: "cost-accounting", name: "Cost Accounting", topic: "Elements of cost, costing methods", code: "COM-203" },
          { id: "banking-insurance", name: "Banking & Insurance", topic: "Banking system, negotiable instruments, insurance", code: "COM-204" },
        ],
      },
      {
        year: 3,
        label: "Third Year",
        semesters: "Semester V & VI",
        subjects: [
          { id: "income-tax-gst", name: "Income Tax & GST", topic: "Heads of income, GST mechanics", code: "COM-301" },
          { id: "auditing", name: "Auditing & Corporate Governance", topic: "Audit process, internal control, governance", code: "COM-302" },
          { id: "management-accounting", name: "Management Accounting", topic: "Ratio, fund flow, budgeting", code: "COM-303" },
          { id: "entrepreneurship", name: "Entrepreneurship Development & E-Commerce", topic: "Venture creation & digital business", code: "COM-304" },
        ],
      },
    ],
  },
];

export function streamById(streamId) {
  return QUIZ_STREAMS.find((s) => s.id === streamId) || null;
}

export function yearOf(streamId, year) {
  const stream = streamById(streamId);
  if (!stream) return null;
  return stream.years.find((y) => y.year === Number(year)) || null;
}

export function subjectsFor(streamId, year) {
  return yearOf(streamId, year)?.subjects || [];
}

export function subjectOf(streamId, year, subjectId) {
  return subjectsFor(streamId, year).find((s) => s.id === subjectId) || null;
}

export function levelById(levelId) {
  return LEVELS.find((l) => l.id === levelId) || null;
}

/* The level a student must clear before `levelId` opens, or null for the first. */
export function previousLevel(levelId) {
  const level = levelById(levelId);
  if (!level || level.order === 0) return null;
  return LEVELS[level.order - 1];
}
