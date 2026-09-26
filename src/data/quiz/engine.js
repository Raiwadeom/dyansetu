/* ============================================================================
   DnyanSetu — Quiz engine

   Everything that turns a question bank into a sitting: drawing a paper without
   repeating what the student has already seen, scoring it, and remembering
   which levels have been cleared.

   Questions are authored as compact tuples to keep the banks readable:

     ["Question text?", "option A", "option B", "option C", "option D", 1]

   The last element is the index of the correct option in the authored order.
   Option order is reshuffled per sitting, so the authored index is never what
   the student sees.
   ========================================================================== */

import BANKS from "./banks/index.js";
import { PROGRESS_KEY, subjectKey, blankSubjectProgress } from "./progress.js";
import {
  LEVELS, LEVEL_IDS, PRACTICE_RULES, EXAM_RULES, TARGET_PER_LEVEL,
  streamById, subjectOf,
} from "./curriculum.js";

/* ------------------------------ Bank access ------------------------------ */

/* Raw tuples for one subject and level, or an empty array when nothing is
   authored yet. Never throws — an incomplete bank must not break the page. */
function rawBank(streamId, subjectId, levelId) {
  const bank = BANKS?.[streamId]?.[subjectId]?.[levelId];
  return Array.isArray(bank) ? bank : [];
}

/* Tuple -> the shape the UI renders. `id` is stable across sittings so the
   "already seen" set survives a reload. */
function hydrate(tuple, streamId, subjectId, levelId, index) {
  const [prompt, ...rest] = tuple;
  const answer = rest[rest.length - 1];
  const options = rest.slice(0, rest.length - 1);
  return {
    id: `${streamId}/${subjectId}/${levelId}/${index}`,
    level: levelId,
    prompt,
    options,
    answer,
  };
}

export function questionsFor(streamId, subjectId, levelId) {
  return rawBank(streamId, subjectId, levelId).map((tuple, i) =>
    hydrate(tuple, streamId, subjectId, levelId, i));
}

export function bankSize(streamId, subjectId, levelId) {
  return rawBank(streamId, subjectId, levelId).length;
}

/* Per-level and total counts for a subject, plus how far each level is from the
   100-a-level target. The subject browser shows this so nobody has to guess
   whether a bank is finished. */
export function bankStats(streamId, subjectId) {
  const levels = {};
  let total = 0;
  LEVEL_IDS.forEach((levelId) => {
    const count = bankSize(streamId, subjectId, levelId);
    levels[levelId] = { count, target: TARGET_PER_LEVEL, short: Math.max(0, TARGET_PER_LEVEL - count) };
    total += count;
  });
  return { levels, total, target: TARGET_PER_LEVEL * LEVEL_IDS.length };
}

/* True when a level holds enough questions to serve one full, non-repeating
   practice set. Below this the level cannot be attempted at all. */
export function levelPlayable(streamId, subjectId, levelId) {
  return bankSize(streamId, subjectId, levelId) >= PRACTICE_RULES.questions;
}

export function examPlayable(streamId, subjectId) {
  return bankStats(streamId, subjectId).total >= EXAM_RULES.questions;
}

/* ------------------------------- Shuffling ------------------------------- */

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Reorder the four options and move the answer index with them. */
function shuffleOptions(question) {
  const paired = question.options.map((text, i) => ({ text, correct: i === question.answer }));
  const mixed = shuffle(paired);
  return {
    ...question,
    options: mixed.map((o) => o.text),
    answer: mixed.findIndex((o) => o.correct),
  };
}

/* --------------------------- Drawing a paper ---------------------------- */

/* Pick `count` questions, preferring ones the student has not seen. When the
   unseen pool runs dry the seen pool is reused — but only after every unseen
   question has been served, so retakes stay fresh for as long as the bank
   allows. Returns { questions, recycled } where `recycled` is how many had to
   come from the seen pool. */
function draw(pool, count, seenIds) {
  const seen = new Set(seenIds || []);
  const fresh = shuffle(pool.filter((q) => !seen.has(q.id)));
  const used = shuffle(pool.filter((q) => seen.has(q.id)));
  const picked = [...fresh.slice(0, count)];
  const recycled = Math.max(0, count - picked.length);
  picked.push(...used.slice(0, recycled));
  return { questions: shuffle(picked).map(shuffleOptions), recycled };
}

/* A 15-question practice set for one level. */
export function buildPracticeSet(streamId, subjectId, levelId, seenIds) {
  const pool = questionsFor(streamId, subjectId, levelId);
  if (pool.length < PRACTICE_RULES.questions) {
    return { questions: [], recycled: 0, insufficient: true, available: pool.length };
  }
  return { ...draw(pool, PRACTICE_RULES.questions, seenIds), insufficient: false, available: pool.length };
}

/* The 30-question final exam: an even split across the three levels, topped up
   from whichever level still has room if a bank is short. */
export function buildExamSet(streamId, subjectId, seenIds) {
  const perLevel = Math.floor(EXAM_RULES.questions / LEVEL_IDS.length);
  const picked = [];
  let recycled = 0;

  LEVEL_IDS.forEach((levelId) => {
    const result = draw(questionsFor(streamId, subjectId, levelId), perLevel, seenIds);
    picked.push(...result.questions);
    recycled += result.recycled;
  });

  /* Rounding leftovers plus anything a thin level could not supply. */
  if (picked.length < EXAM_RULES.questions) {
    const taken = new Set(picked.map((q) => q.id));
    const rest = LEVEL_IDS.flatMap((levelId) => questionsFor(streamId, subjectId, levelId))
      .filter((q) => !taken.has(q.id));
    const top = draw(rest, EXAM_RULES.questions - picked.length, seenIds);
    picked.push(...top.questions);
    recycled += top.recycled;
  }

  if (picked.length < EXAM_RULES.questions) {
    return { questions: [], recycled: 0, insufficient: true, available: picked.length };
  }
  return { questions: shuffle(picked), recycled, insufficient: false, available: picked.length };
}

/* -------------------------------- Scoring -------------------------------- */

/* No negative marking anywhere: a wrong or skipped answer is simply 0. */
export function scoreAttempt(questions, responses, rules) {
  const review = questions.map((question, index) => {
    const chosen = responses[index];
    const correct = chosen === question.answer;
    return {
      index,
      question,
      chosen: typeof chosen === "number" ? chosen : null,
      correct,
      skipped: typeof chosen !== "number",
    };
  });
  const score = review.filter((r) => r.correct).length * rules.marksPerQuestion;
  return {
    score,
    total: questions.length * rules.marksPerQuestion,
    pass: score >= rules.pass,
    passMark: rules.pass,
    correct: review.filter((r) => r.correct).length,
    wrong: review.filter((r) => !r.correct && !r.skipped).length,
    skipped: review.filter((r) => r.skipped).length,
    review,
  };
}

/* -------------------------------- Progress -------------------------------- */

export function progressFor(progress, streamId, year, subjectId) {
  return progress?.[subjectKey(streamId, year, subjectId)] || blankSubjectProgress();
}

/* A level is open when it is the first one, or the level before it is passed. */
export function levelUnlocked(subjectProgress, levelId) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return false;
  if (level.order === 0) return true;
  const prior = LEVELS[level.order - 1];
  return Boolean(subjectProgress.levels[prior.id]?.passed);
}

/* The final exam opens only after all three practice levels are cleared. */
export function examUnlocked(subjectProgress) {
  return LEVEL_IDS.every((id) => Boolean(subjectProgress.levels[id]?.passed));
}

export function nextLevelAfter(levelId) {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) return null;
  return LEVELS[level.order + 1] || null;
}

/* Fold one finished sitting into the stored progress. `stage` is a level id or
   "exam". Seen ids accumulate so the next attempt draws different questions;
   once the pool is exhausted the list resets and the cycle starts again. */
export function recordAttempt(progress, streamId, year, subjectId, stage, result, questions, poolSize) {
  const key = subjectKey(streamId, year, subjectId);
  const current = progress?.[key] ? structuredCloneish(progress[key]) : blankSubjectProgress();
  const slot = stage === "exam" ? current.exam : current.levels[stage];
  if (!slot) return progress;

  const seen = new Set(slot.seen);
  questions.forEach((q) => seen.add(q.id));

  slot.attempts += 1;
  slot.lastScore = result.score;
  slot.best = Math.max(slot.best, result.score);
  slot.passed = slot.passed || result.pass;
  /* Pool exhausted — clear the history so retakes keep drawing fresh papers. */
  slot.seen = poolSize && seen.size >= poolSize ? [] : [...seen];

  return { ...(progress || {}), [key]: current };
}

/* structuredClone is not available in every browser this runs on. */
function structuredCloneish(value) {
  return JSON.parse(JSON.stringify(value));
}

export { LEVELS, LEVEL_IDS, PRACTICE_RULES, EXAM_RULES, streamById, subjectOf };
export { PROGRESS_KEY, subjectKey, blankSubjectProgress };
