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
  designationMr: "शिष्यवृत्ती समन्वयक",
  photo: null,
  phone: "",
  email: "",
};

export const SCHOLARSHIP_CATEGORIES = [
  { id: "open", name: "Open / General", nameMr: "खुला / सर्वसाधारण", note: "No caste-based reservation claimed.", noteMr: "जातीवर आधारित आरक्षणाचा दावा नाही." },
  { id: "ews", name: "EWS", nameMr: "ईडब्ल्यूएस", note: "Economically Weaker Section, general category.", noteMr: "आर्थिकदृष्ट्या दुर्बल घटक, सर्वसाधारण प्रवर्ग." },
  { id: "obc", name: "OBC", nameMr: "ओबीसी", note: "Other Backward Classes.", noteMr: "इतर मागासवर्गीय." },
  { id: "sbc", name: "SBC", nameMr: "एसबीसी", note: "Special Backward Class.", noteMr: "विशेष मागास प्रवर्ग." },
  { id: "vjnt", name: "VJ / DT (NT-A)", nameMr: "विजा / भज (एनटी-अ)", note: "Vimukta Jati / Denotified Tribes.", noteMr: "विमुक्त जाती / भटक्या जमाती." },
  { id: "nt", name: "NT (B / C / D)", nameMr: "भज (ब / क / ड)", note: "Nomadic Tribes.", noteMr: "भटक्या जमाती." },
  { id: "sc", name: "SC", nameMr: "अनुसूचित जाती", note: "Scheduled Caste.", noteMr: "अनुसूचित जाती." },
  { id: "st", name: "ST", nameMr: "अनुसूचित जमाती", note: "Scheduled Tribe.", noteMr: "अनुसूचित जमाती." },
  { id: "minority", name: "Minority", nameMr: "अल्पसंख्याक", note: "Muslim, Buddhist, Christian, Sikh, Jain, Parsi.", noteMr: "मुस्लिम, बौद्ध, ख्रिश्चन, शीख, जैन, पारशी." },
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

const DOC_MR = {
  aadhaar: "आधार कार्ड (मोबाइल क्रमांकाशी जोडलेले)",
  bank: "बँक पासबुक — खाते विद्यार्थ्याच्या स्वतःच्या नावावर असावे",
  income: "तहसीलदारांकडून उत्पन्नाचा दाखला (चालू आर्थिक वर्ष)",
  caste: "जात प्रमाणपत्र",
  validity: "जात वैधता प्रमाणपत्र",
  nonCreamy: "नॉन-क्रिमीलेयर प्रमाणपत्र (चालू वर्षासाठी वैध)",
  ews: "सक्षम प्राधिकाऱ्याने दिलेले ईडब्ल्यूएस प्रमाणपत्र",
  domicile: "अधिवास / राष्ट्रीयत्व प्रमाणपत्र (महाराष्ट्र)",
  marksheet: "शेवटच्या पात्रता परीक्षेची गुणपत्रिका (१०वी, १२वी आणि पदवी, लागू असल्यास)",
  admission: "चालू वर्षाचा प्रवेश / महाविद्यालयाचे चालू बोनाफाईड प्रमाणपत्र",
  gap: "गॅप प्रमाणपत्र (केवळ शिक्षणात खंड असलेल्या विद्यार्थ्यांसाठी)",
  deathCert: "वडिलांचे मृत्यू प्रमाणपत्र + आईचे उत्पन्न प्रमाणपत्र (वडील हयात नसल्यासच)",
  nonCriminal: "अपराध नसल्याचे प्रमाणपत्र",
  hostel: "वसतिगृह प्रवेशाचा पुरावा (निर्वाह भत्त्यासाठी)",
  hostelAgreement: "वसतिगृह / घरमालकाचा भाडे करार (वसतिगृह प्रवेशाचा पुरावा उपलब्ध नसल्यासच)",
  ration: "रेशन कार्ड",
  minority: "अल्पसंख्याक समुदायाचे स्वयंघोषणापत्र",
  cet: "सीईटी / प्रवेश परीक्षेची गुणपत्रिका (सीईटीद्वारे प्रवेश झाला असल्यास)",
};

export const SCHOLARSHIPS = [
  {
    id: "gov-post-matric-sc",
    name: "Post Matric Scholarship (GOI)",
    nameMr: "पोस्ट मॅट्रिक शिष्यवृत्ती (भारत सरकार)",
    provider: "Social Justice & Special Assistance Dept., Govt. of Maharashtra",
    providerMr: "सामाजिक न्याय व विशेष सहाय्य विभाग, महाराष्ट्र शासन",
    categories: ["sc"],
    amount: "Full tuition + exam fees + maintenance allowance",
    amountMr: "पूर्ण शिक्षण शुल्क + परीक्षा शुल्क + निर्वाह भत्ता",
    window: "Usually August – December",
    windowMr: "साधारणतः ऑगस्ट – डिसेंबर",
    eligibility: "SC students in a recognised post-matric course, family income under ₹2.5 lakh per year.",
    eligibilityMr: "मान्यताप्राप्त पोस्ट मॅट्रिक अभ्यासक्रमातील अनुसूचित जातीचे विद्यार्थी, कौटुंबिक उत्पन्न वार्षिक ₹२.५ लाखांपेक्षा कमी.",
    documents: ["aadhaar", "bank", "income", "caste", "validity", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "tribal-post-matric-st",
    name: "Post Matric Scholarship for ST students",
    nameMr: "अनुसूचित जमाती विद्यार्थ्यांसाठी पोस्ट मॅट्रिक शिष्यवृत्ती",
    provider: "Tribal Development Department, Govt. of Maharashtra",
    providerMr: "आदिवासी विकास विभाग, महाराष्ट्र शासन",
    categories: ["st"],
    amount: "Full tuition + exam fees + maintenance allowance",
    amountMr: "पूर्ण शिक्षण शुल्क + परीक्षा शुल्क + निर्वाह भत्ता",
    window: "Usually August – December",
    windowMr: "साधारणतः ऑगस्ट – डिसेंबर",
    eligibility: "ST students in a recognised post-matric course, family income under ₹2.5 lakh per year.",
    eligibilityMr: "मान्यताप्राप्त पोस्ट मॅट्रिक अभ्यासक्रमातील अनुसूचित जमातीचे विद्यार्थी, कौटुंबिक उत्पन्न वार्षिक ₹२.५ लाखांपेक्षा कमी.",
    documents: ["aadhaar", "bank", "income", "caste", "validity", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "vjnt-obc-sbc-post-matric",
    name: "Post Matric Scholarship (VJNT / OBC / SBC)",
    nameMr: "पोस्ट मॅट्रिक शिष्यवृत्ती (विजा / ओबीसी / एसबीसी)",
    provider: "VJNT, OBC & SBC Welfare Department, Govt. of Maharashtra",
    providerMr: "विजा, ओबीसी व एसबीसी कल्याण विभाग, महाराष्ट्र शासन",
    categories: ["obc", "sbc", "vjnt", "nt"],
    amount: "Tuition + exam fees, plus maintenance for eligible students",
    amountMr: "शिक्षण शुल्क + परीक्षा शुल्क, तसेच पात्र विद्यार्थ्यांसाठी निर्वाह भत्ता",
    window: "Usually August – December",
    windowMr: "साधारणतः ऑगस्ट – डिसेंबर",
    eligibility: "VJNT / OBC / SBC students with a valid non-creamy layer certificate and family income under ₹8 lakh.",
    eligibilityMr: "वैध नॉन-क्रिमीलेयर प्रमाणपत्र असलेले विजा / ओबीसी / एसबीसी विद्यार्थी, कौटुंबिक उत्पन्न ₹८ लाखांपेक्षा कमी.",
    documents: ["aadhaar", "bank", "income", "caste", "nonCreamy", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "rajarshi-shahu-ews",
    name: "Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti",
    nameMr: "राजर्षी छत्रपती शाहू महाराज शिक्षण शुल्क शिष्यवृत्ती",
    provider: "Higher & Technical Education Dept., Govt. of Maharashtra",
    providerMr: "उच्च व तंत्र शिक्षण विभाग, महाराष्ट्र शासन",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt"],
    amount: "100% tuition fee waiver",
    amountMr: "१००% शिक्षण शुल्क माफी",
    window: "Along with admission, usually July – November",
    windowMr: "प्रवेशासोबतच, साधारणतः जुलै – नोव्हेंबर",
    eligibility: "Family income under ₹8 lakh per year, admitted to a professional course through CAP.",
    eligibilityMr: "कौटुंबिक उत्पन्न वार्षिक ₹८ लाखांपेक्षा कमी, सीएपीद्वारे व्यावसायिक अभ्यासक्रमात प्रवेश.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "cet", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "ews-tuition-waiver",
    name: "EWS Tuition Fee Waiver Scheme",
    nameMr: "ईडब्ल्यूएस शिक्षण शुल्क माफी योजना",
    provider: "Govt. of Maharashtra",
    providerMr: "महाराष्ट्र शासन",
    categories: ["open", "ews"],
    amount: "Up to 50% of tuition fees",
    amountMr: "शिक्षण शुल्काच्या ५०% पर्यंत",
    window: "Along with admission",
    windowMr: "प्रवेशासोबतच",
    eligibility: "Open-category students holding a valid EWS certificate, family income under ₹8 lakh per year.",
    eligibilityMr: "वैध ईडब्ल्यूएस प्रमाणपत्र असलेले खुल्या प्रवर्गातील विद्यार्थी, कौटुंबिक उत्पन्न वार्षिक ₹८ लाखांपेक्षा कमी.",
    documents: ["aadhaar", "bank", "ews", "income", "domicile", "marksheet", "admission", "nonCriminal", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "panjabrao-deshmukh",
    name: "Dr. Panjabrao Deshmukh Vasatigruh Nirvah Bhatta",
    nameMr: "डॉ. पंजाबराव देशमुख वसतिगृह निर्वाह भत्ता",
    provider: "Higher & Technical Education Dept., Govt. of Maharashtra",
    providerMr: "उच्च व तंत्र शिक्षण विभाग, महाराष्ट्र शासन",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st"],
    amount: "₹10,000 – ₹30,000 per year hostel maintenance",
    amountMr: "₹१०,००० – ₹३०,००० प्रतिवर्ष वसतिगृह निर्वाह भत्ता",
    window: "Usually August – December",
    windowMr: "साधारणतः ऑगस्ट – डिसेंबर",
    eligibility: "Hostel residents whose parents are registered labourers or landholding farmers; income under ₹8 lakh.",
    eligibilityMr: "ज्यांचे पालक नोंदणीकृत मजूर किंवा जमीनधारक शेतकरी आहेत असे वसतिगृहातील विद्यार्थी; उत्पन्न ₹८ लाखांपेक्षा कमी.",
    documents: ["aadhaar", "bank", "income", "domicile", "hostel", "hostelAgreement", "admission", "ration", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "maulana-azad-minority",
    name: "Scholarship for Minority Community Students",
    nameMr: "अल्पसंख्याक समुदायातील विद्यार्थ्यांसाठी शिष्यवृत्ती",
    provider: "Minority Development Department, Govt. of Maharashtra",
    providerMr: "अल्पसंख्याक विकास विभाग, महाराष्ट्र शासन",
    categories: ["minority"],
    amount: "₹5,000 – ₹25,000 per year",
    amountMr: "₹५,००० – ₹२५,००० प्रतिवर्ष",
    window: "Usually September – January",
    windowMr: "साधारणतः सप्टेंबर – जानेवारी",
    eligibility: "Students from notified minority communities with at least 50% in the previous examination.",
    eligibilityMr: "मागील परीक्षेत किमान ५०% गुण असलेले अधिसूचित अल्पसंख्याक समुदायातील विद्यार्थी.",
    documents: ["aadhaar", "bank", "income", "minority", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "central-sector-merit",
    name: "Central Sector Scheme of Scholarship (Merit)",
    nameMr: "केंद्रीय क्षेत्र शिष्यवृत्ती योजना (गुणवत्ता)",
    provider: "Ministry of Education, Govt. of India",
    providerMr: "शिक्षण मंत्रालय, भारत सरकार",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st", "minority"],
    amount: "₹12,000 per year for graduation",
    amountMr: "पदवीसाठी ₹१२,००० प्रतिवर्ष",
    window: "Usually July – October",
    windowMr: "साधारणतः जुलै – ऑक्टोबर",
    eligibility: "Above the 80th percentile in Class XII, family income under ₹4.5 lakh, pursuing a regular degree.",
    eligibilityMr: "बारावीत ८०व्या पर्सेंटाइलपेक्षा जास्त, कौटुंबिक उत्पन्न ₹४.५ लाखांपेक्षा कमी, नियमित पदवी अभ्यासक्रम.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://scholarships.gov.in/",
  },
  {
    id: "ebc-concession",
    name: "Economically Backward Class (EBC) Concession",
    nameMr: "आर्थिकदृष्ट्या मागास वर्ग (ईबीसी) सवलत",
    provider: "Govt. of Maharashtra",
    providerMr: "महाराष्ट्र शासन",
    categories: ["open", "ews"],
    amount: "Partial tuition fee concession",
    amountMr: "अंशतः शिक्षण शुल्क सवलत",
    window: "Along with admission",
    windowMr: "प्रवेशासोबतच",
    eligibility: "Open-category students with family income under the notified EBC ceiling.",
    eligibilityMr: "अधिसूचित ईबीसी मर्यादेखालील कौटुंबिक उत्पन्न असलेले खुल्या प्रवर्गातील विद्यार्थी.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://mahadbt.maharashtra.gov.in/",
  },
  {
    id: "eklavya-merit",
    name: "Eklavya Scholarship",
    nameMr: "एकलव्य शिष्यवृत्ती",
    provider: "Directorate of Higher Education, Maharashtra",
    providerMr: "उच्च शिक्षण संचालनालय, महाराष्ट्र",
    categories: ["open", "ews", "obc", "sbc", "vjnt", "nt", "sc", "st", "minority"],
    amount: "₹5,000 per year",
    amountMr: "₹५,००० प्रतिवर्ष",
    window: "Usually September – December",
    windowMr: "साधारणतः सप्टेंबर – डिसेंबर",
    eligibility: "At least 60% in the previous year, parents' income under the notified ceiling; merit-based.",
    eligibilityMr: "मागील वर्षी किमान ६०% गुण, पालकांचे उत्पन्न अधिसूचित मर्यादेखाली; गुणवत्तेवर आधारित.",
    documents: ["aadhaar", "bank", "income", "domicile", "marksheet", "admission", "gap", "deathCert"],
    note: "If you have already applied for another scholarship, you cannot apply for this one — the government sanctions only one scholarship per student.",
    noteMr: "जर तुम्ही आधीच दुसऱ्या शिष्यवृत्तीसाठी अर्ज केला असेल, तर तुम्ही यासाठी अर्ज करू शकत नाही — शासन प्रत्येक विद्यार्थ्यास फक्त एकच शिष्यवृत्ती मंजूर करते.",
    portal: "https://dhepune.gov.in/",
  },
];

export function scholarshipsFor(categoryId) {
  return SCHOLARSHIPS.filter((s) => s.categories.includes(categoryId));
}

/* Every distinct document a student in this category will need, in a stable order. */
export function documentsFor(categoryId, lang = "en") {
  const seen = [];
  scholarshipsFor(categoryId).forEach((s) =>
    s.documents.forEach((d) => {
      if (!seen.includes(d)) seen.push(d);
    })
  );
  const dict = lang === "mr" ? DOC_MR : DOC;
  return seen.map((key) => dict[key]).filter(Boolean);
}

export function expandDocuments(keys, lang = "en") {
  const dict = lang === "mr" ? DOC_MR : DOC;
  return keys.map((key) => dict[key]).filter(Boolean);
}
