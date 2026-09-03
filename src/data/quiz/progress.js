/* ============================================================================
   DyanSetu — Quiz progress shape

   The three helpers here describe how a student's progress is stored. They are
   deliberately kept out of engine.js, which imports every question bank: the
   admin desk reads quiz attempts from the main bundle, and importing them from
   the engine dragged all 11,700 authored questions into the landing page's
   JavaScript. Nothing in this file touches a bank, so it costs a few bytes.
   ========================================================================== */

import { LEVEL_IDS } from "./curriculum.js";

export const PROGRESS_KEY = "dyansetu-quiz-progress-v1";

export function subjectKey(streamId, year, subjectId) {
  return `${streamId}/${year}/${subjectId}`;
}

export function blankLevel() {
  return { attempts: 0, passed: false, best: 0, seen: [], lastScore: null };
}

export function blankSubjectProgress() {
  const levels = {};
  LEVEL_IDS.forEach((id) => { levels[id] = blankLevel(); });
  return { levels, exam: blankLevel() };
}
