/* End-to-end smoke test of the quiz engine. Run: node scripts/smoke-quiz.mjs */
import {
  buildPracticeSet, buildExamSet, scoreAttempt, recordAttempt,
  levelUnlocked, examUnlocked, progressFor, bankStats, bankSize,
} from "../src/data/quiz/engine.js";
import { PRACTICE_RULES, EXAM_RULES } from "../src/data/quiz/curriculum.js";

const S = "bsc-cs", SUB = "dbms", Y = 2;
let progress = {};
let p = progressFor(progress, S, Y, SUB);
console.log("gate at start -> beginner:", levelUnlocked(p, "beginner"),
  "| intermediate:", levelUnlocked(p, "intermediate"), "| exam:", examUnlocked(p));

const a = buildPracticeSet(S, SUB, "beginner", []);
console.log("set size:", a.questions.length, "| unique:", new Set(a.questions.map(q => q.id)).size, "| recycled:", a.recycled);

const failing = a.questions.map((q, i) => (i < 7 ? q.answer : (q.answer + 1) % 4));
let r = scoreAttempt(a.questions, failing, PRACTICE_RULES);
console.log("failed attempt:", `${r.score}/${r.total}`, "pass:", r.pass, "(mark", r.passMark + ")");
progress = recordAttempt(progress, S, Y, SUB, "beginner", r, a.questions, bankSize(S, SUB, "beginner"));
console.log("still locked after failing -> intermediate:", levelUnlocked(progressFor(progress, S, Y, SUB), "intermediate"));

const b = buildPracticeSet(S, SUB, "beginner", progressFor(progress, S, Y, SUB).levels.beginner.seen);
console.log("retake overlap with previous paper:", b.questions.filter((q) => a.questions.some((x) => x.id === q.id)).length);

for (const lvl of ["beginner", "intermediate", "advanced"]) {
  const s = buildPracticeSet(S, SUB, lvl, progressFor(progress, S, Y, SUB).levels[lvl].seen);
  const res = scoreAttempt(s.questions, s.questions.map((q) => q.answer), PRACTICE_RULES);
  progress = recordAttempt(progress, S, Y, SUB, lvl, res, s.questions, bankSize(S, SUB, lvl));
  console.log(`${lvl}: ${res.score}/${res.total} pass=${res.pass} -> exam unlocked: ${examUnlocked(progressFor(progress, S, Y, SUB))}`);
}

const e = buildExamSet(S, SUB, []);
const partial = e.questions.map((q, i) => (i < 12 ? q.answer : i < 20 ? (q.answer + 1) % 4 : null));
const er = scoreAttempt(e.questions, partial, EXAM_RULES);
console.log("exam size:", e.questions.length, "| unique:", new Set(e.questions.map((q) => q.id)).size,
  "| levels:", [...new Set(e.questions.map((q) => q.level))].sort().join(","));
console.log(`exam scored ${er.score}/${er.total} pass=${er.pass} correct=${er.correct} wrong=${er.wrong} skipped=${er.skipped}`);

const empty = buildPracticeSet("bsc", "physics-1", "beginner", []);
console.log("bsc/physics-1 -> insufficient:", empty.insufficient, "| bank total:", bankStats("bsc", "physics-1").total);
