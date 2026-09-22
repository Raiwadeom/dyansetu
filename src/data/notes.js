/* ============================================================================
   DnyanSetu — Subject-wise notes

   Faculty upload against a stream and semester; students browse the same
   structure. Unlike the quiz, B.A. is included here — notes are for every
   stream the college teaches.
   ========================================================================== */

export const NOTE_STREAMS = [
  { id: "bsc",    name: "B.Sc.",    full: "Bachelor of Science",              blurb: "Physics, Chemistry, Mathematics, Botany and Zoology." },
  { id: "bsc-cs", name: "B.Sc. CS", full: "B.Sc. Computer Science",           blurb: "Programming, systems, databases and networks." },
  { id: "bca",    name: "BCA",      full: "Bachelor of Computer Applications", blurb: "Applied computing, web technology and software practice." },
  { id: "bcom",   name: "B.Com.",   full: "Bachelor of Commerce",             blurb: "Accounting, law, costing, taxation and enterprise." },
  { id: "ba",     name: "B.A.",     full: "Bachelor of Arts",                 blurb: "Languages, history, politics, sociology and economics." },
];

export const SEMESTERS = [
  "Semester I", "Semester II", "Semester III", "Semester IV",
  "Semester V", "Semester VI", "Semester VII", "Semester VIII",
];

export function noteStreamById(id) {
  return NOTE_STREAMS.find((s) => s.id === id) || null;
}

export function noteStreamName(id) {
  return noteStreamById(id)?.name || id;
}

/* Accepted attachments. Handwritten notes are usually photographed, so images
   matter as much as PDFs here. */
export const ACCEPTED_NOTE_TYPES = "application/pdf,image/png,image/jpeg,image/webp";

export const MAX_NOTE_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_NOTE_FILES = 12;

export function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
