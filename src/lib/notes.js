/* ============================================================================
   DnyanSetu — Notes library (Supabase + Cloudinary)

   Faculty upload a note as one or more PDFs or images; students browse and
   download. Deleting a note removes the database row, so it disappears from
   the library at once. The Cloudinary assets themselves need the API secret
   to purge, which cannot live in a browser — see cloudinary.js.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";
import { uploadFiles } from "./cloudinary.js";
import { MAX_NOTE_FILES } from "../data/notes.js";

const TABLE = "notes";

function toNote(row) {
  return {
    id: row.id,
    streamId: row.stream_id,
    subject: row.subject,
    semester: row.semester,
    title: row.title,
    description: row.description || "",
    files: row.files || [],
    uploadedBy: row.uploaded_by,
    author: row.author_name || "Faculty",
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

/* Every note in the library, newest first. Readable by signed-out students too. */
export async function fetchNotes({ streamId } = {}) {
  if (!isBackendConfigured) return [];
  let query = supabase.from(TABLE).select("*").order("created_at", { ascending: false }).limit(500);
  if (streamId) query = query.eq("stream_id", streamId);
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error, "Could not load the notes library."));
  return (data || []).map(toNote);
}

/* One teacher's own uploads, for the manage-and-delete list. */
export async function fetchMyNotes(userId) {
  if (!isBackendConfigured || !userId) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error, "Could not load your uploads."));
  return (data || []).map(toNote);
}

export async function uploadNote({ streamId, subject, semester, title, description, files, author, onProgress }) {
  if (!isBackendConfigured) throw new Error("Uploading notes needs the backend configured.");
  if (!author?.id) throw new Error("You must be signed in to upload notes.");
  if (!files?.length) throw new Error("Attach at least one PDF or image.");
  if (files.length > MAX_NOTE_FILES) throw new Error(`Please attach at most ${MAX_NOTE_FILES} files per note.`);

  const uploaded = await uploadFiles(files, { folder: "dnyansetu/notes", onProgress });

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      stream_id: streamId,
      subject: subject.trim(),
      semester,
      title: title.trim(),
      description: (description || "").trim(),
      files: uploaded,
      uploaded_by: author.id,
      author_name: author.name || "Faculty",
    })
    .select("*")
    .single();

  if (error) throw new Error(friendlyError(error, "The files uploaded, but the note could not be saved."));
  return toNote(data);
}

/* Removes the note from the library. The database allows this only for the
   teacher who uploaded it, or the administrator. */
export async function deleteNote(note) {
  if (!isBackendConfigured) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", note.id);
  if (error) throw new Error(friendlyError(error, "Could not delete the note."));
}
