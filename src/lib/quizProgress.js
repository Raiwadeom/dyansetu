/* ============================================================================
   DnyanSetu — Quiz progress (Firestore)

   The quiz sits on the public landing page, so it has to work for a visitor
   who is not signed in. Two backends therefore:

     signed in  -> one document per submitted paper under
                   profiles/{uid}/attempts, so progress follows the student to
                   any device
     signed out -> the original localStorage blob, per browser

   Both produce the shape the engine expects:
     progress["<streamId>/<year>/<subjectId>"] = { levels: {...}, exam: {...} }
   ========================================================================== */

import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp,
} from "firebase/firestore";

import { db, isBackendConfigured } from "./firebase.js";
import { LEVEL_IDS } from "../data/quiz/curriculum.js";
import { PROGRESS_KEY, blankSubjectProgress, subjectKey } from "../data/quiz/progress.js";

/* ------------------------------ local store ------------------------------ */

export function loadLocalProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* Private browsing or storage disabled: progress stays in memory only. */
  }
}

/* ---------------------------- remote store ------------------------------- */

/* Folds attempt records into the engine's progress shape.

   `poolSizeFor(streamId, subjectId, stage)` reports how many questions exist,
   so the "seen" list can be cleared once a student has worked through the
   whole bank — the same recycling rule the local engine applies. */
export function foldAttempts(rows, poolSizeFor) {
  const progress = {};

  (rows || []).forEach((row) => {
    const key = subjectKey(row.streamId, row.year, row.subjectId);
    if (!progress[key]) progress[key] = blankSubjectProgress();

    const slot = row.stage === "exam" ? progress[key].exam : progress[key].levels[row.stage];
    if (!slot) return;

    slot.attempts += 1;
    slot.best = Math.max(slot.best, row.score);
    slot.passed = slot.passed || row.passed;
    (row.questionIds || []).forEach((id) => {
      if (!slot.seen.includes(id)) slot.seen.push(id);
    });
  });

  /* Rows arrive newest first, so take lastScore from the first row per stage. */
  const newest = new Map();
  (rows || []).forEach((row) => {
    const id = `${row.streamId}/${row.year}/${row.subjectId}/${row.stage}`;
    if (!newest.has(id)) newest.set(id, row);
  });
  newest.forEach((row) => {
    const key = subjectKey(row.streamId, row.year, row.subjectId);
    const slot = row.stage === "exam" ? progress[key]?.exam : progress[key]?.levels[row.stage];
    if (slot) slot.lastScore = row.score;
  });

  /* Clear an exhausted "seen" list so retakes keep drawing fresh papers. */
  if (typeof poolSizeFor === "function") {
    Object.entries(progress).forEach(([key, subject]) => {
      const [streamId, , subjectId] = key.split("/");
      LEVEL_IDS.forEach((level) => {
        const size = poolSizeFor(streamId, subjectId, level);
        if (size && subject.levels[level].seen.length >= size) subject.levels[level].seen = [];
      });
      const examPool = LEVEL_IDS.reduce((n, l) => n + (poolSizeFor(streamId, subjectId, l) || 0), 0);
      if (examPool && subject.exam.seen.length >= examPool) subject.exam.seen = [];
    });
  }

  return progress;
}

export async function fetchProgress(userId, poolSizeFor) {
  if (!isBackendConfigured || !userId) return {};
  const snapshot = await getDocs(query(
    collection(db, "profiles", userId, "attempts"),
    orderBy("createdAt", "desc"),
    limit(1000),
  ));
  return foldAttempts(snapshot.docs.map((d) => d.data()), poolSizeFor);
}

/* Raw attempts for one account, newest first. The admin desk uses this to show
   who has actually practised; firestore.rules already lets an admin read any
   profile's attempts. Fetched per account rather than as one collectionGroup
   query, because the attempts rule is nested under profiles/{uid} and a group
   query would be denied by it. */
export async function fetchAttempts(userId, max = 500) {
  if (!isBackendConfigured || !userId) return [];
  const snapshot = await getDocs(query(
    collection(db, "profiles", userId, "attempts"),
    orderBy("createdAt", "desc"),
    limit(max),
  ));
  return snapshot.docs.map((d) => {
    const a = d.data();
    return { ...a, at: a.createdAt?.toMillis?.() ?? null };
  });
}

export async function saveAttempt(userId, { streamId, year, subjectId, stage, result, questions }) {
  if (!isBackendConfigured || !userId) return;
  await addDoc(collection(db, "profiles", userId, "attempts"), {
    streamId,
    year: Number(year),
    subjectId,
    stage,
    score: result.score,
    total: result.total,
    passed: result.pass,
    questionIds: questions.map((q) => q.id),
    createdAt: serverTimestamp(),
  });
}
