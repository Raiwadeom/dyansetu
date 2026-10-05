/* ============================================================================
   DnyanSetu — previous year question papers uploaded by faculty

   Same pattern as notes.js: the files go to Cloudinary (folder
   dnyansetu/papers, signed by /api/sign-upload for approved faculty and the
   administrator), the record goes to pyq_papers. Anyone can read the list.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";
import { uploadFiles } from "./cloudinary.js";

const TABLE = "pyq_papers";
export const PAPER_SESSIONS = ["Summer", "Winter"];
export const MAX_PAPER_FILES = 6;

function toPaper(row) {
  return {
    id: row.id,
    streamId: row.stream_id,
    subject: row.subject || "",
    semester: row.semester || "",
    year: row.year,
    session: row.session,
    files: Array.isArray(row.file) ? row.file : row.file ? [row.file] : [],
    uploadedBy: row.uploaded_by,
    author: row.author_name || "Faculty",
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

export async function fetchPapers({ streamId } = {}) {
  if (!isBackendConfigured) return [];
  let query = supabase.from(TABLE).select("*").order("year", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (streamId) query = query.eq("stream_id", streamId);
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error, "Could not load the question papers."));
  return (data || []).map(toPaper);
}

export async function fetchMyPapers(userId) {
  if (!isBackendConfigured || !userId) return [];
  const { data, error } = await supabase.from(TABLE).select("*").eq("uploaded_by", userId).order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error, "Could not load your question papers."));
  return (data || []).map(toPaper);
}

export async function uploadPaper({ streamId, subject, semester, year, session, files, author, onProgress }) {
  if (!isBackendConfigured) throw new Error("Uploading papers needs the backend configured.");
  if (!author?.id) throw new Error("You must be signed in to upload papers.");
  if (!files?.length) throw new Error("Attach the paper as a PDF or photos.");
  if (files.length > MAX_PAPER_FILES) throw new Error(`Please attach at most ${MAX_PAPER_FILES} files per paper.`);

  const uploaded = await uploadFiles(files, { folder: "dnyansetu/papers", onProgress });
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      stream_id: streamId,
      subject: subject.trim(),
      semester,
      year: Number(year),
      session,
      file: uploaded,
      uploaded_by: author.id,
      author_name: author.name || "Faculty",
    })
    .select("*")
    .single();
  if (error) throw new Error(friendlyError(error, "The files uploaded, but the paper could not be saved."));
  return toPaper(data);
}

export async function deletePaper(paper) {
  if (!isBackendConfigured) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", paper.id);
  if (error) throw new Error(friendlyError(error, "Could not delete the paper."));
}
