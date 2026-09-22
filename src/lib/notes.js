/* ============================================================================
   DnyanSetu — Notes library (Firestore + Cloudinary)

   Faculty upload a note as one or more PDFs or images; students browse and
   download. Deleting a note removes the Firestore record, so it disappears
   from the library at once. The Cloudinary assets themselves need the API
   secret to purge, which cannot live in a browser — see cloudinary.js.
   ========================================================================== */

import {
  collection, doc, addDoc, deleteDoc, getDocs, query, where,
  limit, serverTimestamp,
} from "firebase/firestore";

import { db, isBackendConfigured, friendlyError } from "./firebase.js";
import { uploadFiles } from "./cloudinary.js";
import { MAX_NOTE_FILES } from "../data/notes.js";

const COLLECTION = "notes";

function toNote(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    streamId: data.streamId,
    subject: data.subject,
    semester: data.semester,
    title: data.title,
    description: data.description || "",
    files: data.files || [],
    uploadedBy: data.uploadedBy,
    author: data.authorName || "Faculty",
    createdAt: data.createdAt?.toMillis?.() ?? Date.now(),
  };
}

/* Newest first. Sorted here rather than in the query on purpose: pairing a
   where() on one field with an orderBy() on another needs a composite index
   that Firestore never builds automatically, and this project ships no index
   definitions — so those queries failed outright with failed-precondition.
   That is what "Could not load your uploads" was, and it broke browsing a
   branch of the library too. A note list is small; sorting it costs nothing. */
function newestFirst(docs) {
  return docs.map(toNote).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/* Every note in the library. Readable by signed-out students too. */
export async function fetchNotes({ streamId } = {}) {
  if (!isBackendConfigured) return [];
  const clauses = [collection(db, COLLECTION)];
  if (streamId) clauses.push(where("streamId", "==", streamId));
  clauses.push(limit(500));

  const snapshot = await getDocs(query(...clauses));
  return newestFirst(snapshot.docs);
}

/* One teacher's own uploads, for the manage-and-delete list. */
export async function fetchMyNotes(userId) {
  if (!isBackendConfigured || !userId) return [];
  const snapshot = await getDocs(query(
    collection(db, COLLECTION),
    where("uploadedBy", "==", userId),
  ));
  return newestFirst(snapshot.docs);
}

export async function uploadNote({ streamId, subject, semester, title, description, files, author, onProgress }) {
  if (!isBackendConfigured) throw new Error("Uploading notes needs the backend configured.");
  if (!author?.id) throw new Error("You must be signed in to upload notes.");
  if (!files?.length) throw new Error("Attach at least one PDF or image.");
  if (files.length > MAX_NOTE_FILES) throw new Error(`Please attach at most ${MAX_NOTE_FILES} files per note.`);

  const uploaded = await uploadFiles(files, { folder: "dnyansetu/notes", onProgress });

  try {
    const ref = await addDoc(collection(db, COLLECTION), {
      streamId,
      subject: subject.trim(),
      semester,
      title: title.trim(),
      description: (description || "").trim(),
      files: uploaded,
      uploadedBy: author.id,
      authorName: author.name || "Faculty",
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id, streamId, subject: subject.trim(), semester,
      title: title.trim(), description: (description || "").trim(),
      files: uploaded, uploadedBy: author.id,
      author: author.name || "Faculty", createdAt: Date.now(),
    };
  } catch (error) {
    throw new Error(friendlyError(error, "The files uploaded, but the note could not be saved."));
  }
}

/* Removes the note from the library. The rules allow this only for the teacher
   who uploaded it, or an administrator. */
export async function deleteNote(note) {
  if (!isBackendConfigured) return;
  try {
    await deleteDoc(doc(db, COLLECTION, note.id));
  } catch (error) {
    throw new Error(friendlyError(error, "Could not delete the note."));
  }
}
