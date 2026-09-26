/* ============================================================================
   DnyanSetu — Previous-year question papers

   The PDF itself goes to Cloudinary; the record of which paper it is lives in
   the pyq_papers table, keyed so that re-uploading the same year and session
   replaces the entry rather than adding a duplicate.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";
import { uploadFile, downloadUrl } from "./cloudinary.js";

const TABLE = "pyq_papers";

/* One deterministic id per slot, so an upload for the same paper overwrites. */
function paperId({ streamId, subjectId, year, session }) {
  return `${streamId}__${subjectId}__${year}__${session}`.toLowerCase();
}

export async function uploadPaper({ streamId, subjectId, year, session, file, uploadedBy }) {
  if (!isBackendConfigured) throw new Error("Uploads need the backend configured.");
  if (!file) throw new Error("Choose a PDF to upload.");
  if (file.type !== "application/pdf") throw new Error("Question papers must be PDF files.");

  const uploaded = await uploadFile(file, { folder: "dnyansetu/papers" });

  const { error } = await supabase.from(TABLE).upsert({
    id: paperId({ streamId, subjectId, year, session }),
    stream_id: streamId,
    subject_id: subjectId,
    year: Number(year),
    session,
    file: uploaded,
    uploaded_by: uploadedBy || null,
  });
  if (error) throw new Error(friendlyError(error, "The PDF uploaded, but the record could not be saved."));
  return uploaded.url;
}

/* Returns { "<streamId>/<subjectId>/<year>/<session>": url }, the same shape as
   the static PYQ_FILES map, so the two can be merged directly. */
export async function fetchPaperIndex() {
  if (!isBackendConfigured) return {};
  const { data, error } = await supabase.from(TABLE).select("*");
  if (error) return {};
  const index = {};
  (data || []).forEach((p) => {
    index[`${p.stream_id}/${p.subject_id}/${p.year}/${p.session}`] = downloadUrl(p.file);
  });
  return index;
}

export async function deletePaper(paper) {
  if (!isBackendConfigured) return;
  await supabase.from(TABLE).delete().eq("id", paperId(paper));
}
