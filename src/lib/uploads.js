/* ============================================================================
   DnyanSetu — Previous-year question papers

   The PDF itself goes to Cloudinary; the record of which paper it is lives in
   Firestore, keyed so that re-uploading the same year and session replaces the
   entry rather than adding a duplicate.
   ========================================================================== */

import { collection, doc, setDoc, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";

import { db, isBackendConfigured, friendlyError } from "./firebase.js";
import { uploadFile, downloadUrl } from "./cloudinary.js";

const COLLECTION = "pyqPapers";

/* One deterministic id per slot, so an upload for the same paper overwrites. */
function paperId({ streamId, subjectId, year, session }) {
  return `${streamId}__${subjectId}__${year}__${session}`.toLowerCase();
}

export async function uploadPaper({ streamId, subjectId, year, session, file, uploadedBy }) {
  if (!isBackendConfigured) throw new Error("Uploads need the backend configured.");
  if (!file) throw new Error("Choose a PDF to upload.");
  if (file.type !== "application/pdf") throw new Error("Question papers must be PDF files.");

  const uploaded = await uploadFile(file, { folder: "dnyansetu/papers" });

  try {
    const id = paperId({ streamId, subjectId, year, session });
    await setDoc(doc(db, COLLECTION, id), {
      streamId,
      subjectId,
      year: Number(year),
      session,
      file: uploaded,
      uploadedBy: uploadedBy || null,
      createdAt: serverTimestamp(),
    });
    return uploaded.url;
  } catch (error) {
    throw new Error(friendlyError(error, "The PDF uploaded, but the record could not be saved."));
  }
}

/* Returns { "<streamId>/<subjectId>/<year>/<session>": url }, the same shape as
   the static PYQ_FILES map, so the two can be merged directly. */
export async function fetchPaperIndex() {
  if (!isBackendConfigured) return {};
  try {
    const snapshot = await getDocs(collection(db, COLLECTION));
    const index = {};
    snapshot.docs.forEach((d) => {
      const p = d.data();
      index[`${p.streamId}/${p.subjectId}/${p.year}/${p.session}`] = downloadUrl(p.file);
    });
    return index;
  } catch {
    return {};
  }
}

export async function deletePaper(paper) {
  if (!isBackendConfigured) return;
  await deleteDoc(doc(db, COLLECTION, paperId(paper)));
}
