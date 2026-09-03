import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ArrowLeft, ArrowRight, ChevronRight, GraduationCap, BookOpen, ClipboardList,
  CheckCircle2, XCircle, Lock, RotateCcw, Award, Timer, Layers, Search, Trophy,
  AlertTriangle, ListChecks,
} from "lucide-react";

import {
  QUIZ_STREAMS, LEVELS, PRACTICE_RULES, EXAM_RULES,
  streamById, yearOf, subjectsFor, subjectOf,
} from "../data/quiz/curriculum.js";
import {
  bankStats, bankSize, levelPlayable, examPlayable,
  buildPracticeSet, buildExamSet, scoreAttempt,
  progressFor, blankSubjectProgress, levelUnlocked, examUnlocked,
  nextLevelAfter, recordAttempt,
} from "../data/quiz/engine.js";
import {
  loadLocalProgress, saveLocalProgress, fetchProgress, saveAttempt,
} from "../lib/quizProgress.js";

/* ============================================================================
   DyanSetu — Quiz & Practice Tests

   Flow: year -> branch -> subject -> level -> practice test -> result.

   A student clears Beginner before Intermediate opens, and Intermediate before
   Advanced. Clearing all three unlocks the 30-question final exam. Every stage
   can be retaken as often as the student wants; each retake draws a different
   paper from the subject's bank, and nothing repeats until the bank is spent.
   ========================================================================== */

/* Every stream runs three years, so a fourth-year card would open a branch
   list with nothing in it. */
const YEAR_OPTIONS = [1, 2, 3];

/* -------------------------------- Helpers -------------------------------- */

function formatClock(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function streamsOfferingYear(year) {
  return QUIZ_STREAMS.filter((s) => s.duration >= year);
}

/* ============================== The page ============================== */

export default function QuizPage({ onBack, user }) {
  const [year, setYear] = useState(null);
  const [streamId, setStreamId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [stage, setStage] = useState(null);          /* level id or "exam" */
  const [sitting, setSitting] = useState(null);       /* live paper, or null */
  const [result, setResult] = useState(null);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState({});
  const [syncing, setSyncing] = useState(true);

  const userId = user?.id || null;

  const stream = streamId ? streamById(streamId) : null;
  const yearBlock = stream && year ? yearOf(streamId, year) : null;
  const subject = stream && year && subjectId ? subjectOf(streamId, year, subjectId) : null;
  const subjectProgress = useMemo(
    () => (stream && subject ? progressFor(progress, streamId, year, subjectId) : blankSubjectProgress()),
    [progress, streamId, year, subjectId, stream, subject],
  );

  /* Signed in, progress lives in the database and follows the student to any
     device. Signed out, the quiz still works from this browser's storage. */
  useEffect(() => {
    let active = true;
    (async () => {
      setSyncing(true);
      if (!userId) {
        if (active) { setProgress(loadLocalProgress()); setSyncing(false); }
        return;
      }
      try {
        const remote = await fetchProgress(userId, bankSize);
        if (active) setProgress(remote);
      } catch (err) {
        console.error("Could not load quiz progress", err);
        if (active) setProgress(loadLocalProgress());
      } finally {
        if (active) setSyncing(false);
      }
    })();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId && !syncing) saveLocalProgress(progress);
  }, [progress, userId, syncing]);

  /* Screen changes should always start at the top of the page. */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [year, streamId, subjectId, stage, sitting ? sitting.id : null, result ? result.id : null]);

  const resetToYear = () => {
    setYear(null); setStreamId(null); setSubjectId(null);
    setStage(null); setSitting(null); setResult(null); setQuery("");
  };
  const resetToStream = () => {
    setStreamId(null); setSubjectId(null); setStage(null); setSitting(null); setResult(null); setQuery("");
  };
  const resetToSubject = () => {
    setSubjectId(null); setStage(null); setSitting(null); setResult(null); setQuery("");
  };
  const resetToLevels = () => {
    setStage(null); setSitting(null); setResult(null);
  };

  /* The header Back button unwinds one stage at a time — sitting -> levels ->
     subject -> branch -> year — and only leaves the quiz once there is nothing
     left to step back through. Jumping straight out from four levels deep was
     the old behaviour and it lost the whole selection. */
  const stepBack = () => {
    if (sitting || result || stage) { resetToLevels(); return; }
    if (subjectId) { setSubjectId(null); setQuery(""); return; }
    if (streamId) { setStreamId(null); setQuery(""); return; }
    if (year) { setYear(null); setQuery(""); return; }
    onBack();
  };

  /* ------------------------- Starting a sitting ------------------------- */

  const startSitting = (nextStage) => {
    const isExam = nextStage === "exam";
    const slot = isExam ? subjectProgress.exam : subjectProgress.levels[nextStage];
    const built = isExam
      ? buildExamSet(streamId, subjectId, slot.seen)
      : buildPracticeSet(streamId, subjectId, nextStage, slot.seen);

    if (built.insufficient) return;

    setStage(nextStage);
    setResult(null);
    setSitting({
      id: `${nextStage}-${Date.now()}`,
      stage: nextStage,
      rules: isExam ? EXAM_RULES : PRACTICE_RULES,
      questions: built.questions,
      responses: new Array(built.questions.length).fill(null),
      current: 0,
      recycled: built.recycled,
      startedAt: Date.now(),
    });
  };

  const answerCurrent = (optionIndex) => {
    setSitting((s) => {
      if (!s) return s;
      const responses = [...s.responses];
      /* Tapping the chosen option again clears it — nothing is negatively marked. */
      responses[s.current] = responses[s.current] === optionIndex ? null : optionIndex;
      return { ...s, responses };
    });
  };

  const goToQuestion = (index) => {
    setSitting((s) => (s ? { ...s, current: Math.max(0, Math.min(index, s.questions.length - 1)) } : s));
  };

  const submitSitting = () => {
    if (!sitting) return;
    const scored = scoreAttempt(sitting.questions, sitting.responses, sitting.rules);
    const poolSize = sitting.stage === "exam"
      ? bankStats(streamId, subjectId).total
      : bankSize(streamId, subjectId, sitting.stage);

    setProgress((prev) => recordAttempt(prev, streamId, year, subjectId, sitting.stage, scored, sitting.questions, poolSize));

    /* The result is shown immediately; the write is allowed to settle behind
       it so a slow network never blocks the student's score. */
    if (userId) {
      saveAttempt(userId, {
        streamId, year, subjectId, stage: sitting.stage,
        result: scored, questions: sitting.questions,
      }).catch((err) => console.error("Could not save attempt", err));
    }
    setResult({
      id: sitting.id,
      stage: sitting.stage,
      rules: sitting.rules,
      elapsed: Math.round((Date.now() - sitting.startedAt) / 1000),
      ...scored,
    });
    setSitting(null);
  };

  /* -------------------------------- Render -------------------------------- */

  return (
    <main className="quiz-page">
      <div className="quiz-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={stepBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="quiz-head-copy">
          <p className="section-eyebrow"><ClipboardList size={14} /> Quiz &amp; Practice Tests</p>
          <h1 className="quiz-title">Practise level by level, then sit the exam</h1>
          <p className="quiz-sub">
            Built on the SRTM University NEP 2020 syllabus. Choose your year and branch, work
            through Beginner, Intermediate and Advanced practice sets, then unlock the final exam.
          </p>
        </div>
        <div className="quiz-rulebar">
          <span><ListChecks size={14} /> Practice: {PRACTICE_RULES.questions} questions · pass {PRACTICE_RULES.pass}</span>
          <span><Award size={14} /> Exam: {EXAM_RULES.questions} questions · pass {EXAM_RULES.pass}</span>
          <span><CheckCircle2 size={14} /> 1 mark each · no negative marking</span>
          <span><RotateCcw size={14} /> Unlimited retakes · fresh questions each time</span>
        </div>
      </div>

      {!userId && (
        <p className="quiz-note">
          <AlertTriangle size={14} />
          You are not signed in, so progress is saved only in this browser. Log in to keep your
          results across devices.
        </p>
      )}

      <QuizCrumbs
        year={year}
        stream={stream}
        subject={subject}
        stage={stage}
        sitting={sitting}
        onYear={resetToYear}
        onStream={resetToStream}
        onSubject={resetToSubject}
        onLevels={resetToLevels}
      />

      {/* Stage 1 — year */}
      {!year && <YearPicker onPick={setYear} />}

      {/* Stage 2 — branch */}
      {year && !stream && <StreamPicker year={year} onPick={setStreamId} progress={progress} />}

      {/* Stage 3 — subject */}
      {year && stream && !subject && (
        <SubjectPicker
          stream={stream}
          yearBlock={yearBlock}
          year={year}
          query={query}
          setQuery={setQuery}
          progress={progress}
          onPick={setSubjectId}
        />
      )}

      {/* Stage 4 — level menu */}
      {subject && !sitting && !result && (
        <LevelPicker
          streamId={streamId}
          subject={subject}
          subjectProgress={subjectProgress}
          onStart={startSitting}
        />
      )}

      {/* Stage 5 — the paper */}
      {sitting && (
        <SittingView
          sitting={sitting}
          subject={subject}
          onAnswer={answerCurrent}
          onGoTo={goToQuestion}
          onSubmit={submitSitting}
          onAbandon={resetToLevels}
        />
      )}

      {/* Stage 6 — result */}
      {result && (
        <ResultView
          result={result}
          subject={subject}
          subjectProgress={subjectProgress}
          streamId={streamId}
          subjectId={subjectId}
          onRetake={() => startSitting(result.stage)}
          onNext={(nextStage) => startSitting(nextStage)}
          onLevels={resetToLevels}
        />
      )}
    </main>
  );
}

/* ------------------------------ Breadcrumbs ------------------------------ */

function QuizCrumbs({ year, stream, subject, stage, sitting, onYear, onStream, onSubject, onLevels }) {
  const stageName = stage === "exam" ? "Final exam" : LEVELS.find((l) => l.id === stage)?.name;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <button type="button" className={`crumb ${!year ? "is-current" : ""}`} onClick={onYear}>Year</button>
      {year && (
        <>
          <ChevronRight size={14} className="crumb-sep" />
          <button type="button" className={`crumb ${!stream ? "is-current" : ""}`} onClick={onStream}>
            Year {year}
          </button>
        </>
      )}
      {stream && (
        <>
          <ChevronRight size={14} className="crumb-sep" />
          <button type="button" className={`crumb ${!subject ? "is-current" : ""}`} onClick={onSubject}>
            {stream.name}
          </button>
        </>
      )}
      {subject && (
        <>
          <ChevronRight size={14} className="crumb-sep" />
          <button type="button" className={`crumb ${!stage ? "is-current" : ""}`} onClick={onLevels}>
            {subject.name}
          </button>
        </>
      )}
      {stage && (
        <>
          <ChevronRight size={14} className="crumb-sep" />
          <span className="crumb is-current">{sitting ? `${stageName} — in progress` : stageName}</span>
        </>
      )}
    </nav>
  );
}

/* ------------------------------ Stage 1: year ------------------------------ */

function YearPicker({ onPick }) {
  return (
    <>
      <h2 className="quiz-stage-title">Which year are you in?</h2>
      <div className="quiz-grid quiz-grid--years">
        {YEAR_OPTIONS.map((y) => {
          const streams = streamsOfferingYear(y);
          return (
            <button type="button" className="quiz-card quiz-card--year" key={y} onClick={() => onPick(y)}>
              <span className="quiz-year-num">{y}</span>
              <h3>{["First", "Second", "Third", "Fourth"][y - 1]} Year</h3>
              <p>{streams.map((s) => s.name).join(" · ")}</p>
              <span className="quiz-card-meta">
                {streams.length} {streams.length === 1 ? "branch" : "branches"} <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ----------------------------- Stage 2: branch ----------------------------- */

function StreamPicker({ year, onPick, progress }) {
  const streams = streamsOfferingYear(year);
  return (
    <>
      <h2 className="quiz-stage-title">Choose your branch</h2>
      <div className="quiz-grid">
        {streams.map((stream) => {
          const subjects = subjectsFor(stream.id, year);
          const cleared = subjects.filter((s) => {
            const p = progressFor(progress, stream.id, year, s.id);
            return examUnlocked(p);
          }).length;
          /* A stream whose banks are still being written should say so up front
             rather than letting a student walk into three locked levels. */
          const questions = subjects.reduce((n, s) => n + bankStats(stream.id, s.id).total, 0);
          return (
            <button
              type="button"
              className={`quiz-card ${questions === 0 ? "is-thin" : ""}`}
              key={stream.id}
              onClick={() => onPick(stream.id)}
            >
              <span className="quiz-card-icon"><GraduationCap size={20} /></span>
              <h3>{stream.name}</h3>
              <p className="quiz-card-full">{stream.full}</p>
              <p>{stream.blurb}</p>
              <span className="quiz-card-meta">
                {subjects.length} subjects
                {questions === 0
                  ? <em className="quiz-card-pending">· question bank in preparation</em>
                  : cleared > 0 && <em className="quiz-card-cleared">· {cleared} cleared</em>}
                <ArrowRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---------------------------- Stage 3: subject ---------------------------- */

function SubjectPicker({ stream, yearBlock, year, query, setQuery, progress, onPick }) {
  const subjects = yearBlock?.subjects || [];
  const term = query.trim().toLowerCase();
  const shown = term
    ? subjects.filter((s) => `${s.name} ${s.topic} ${s.code}`.toLowerCase().includes(term))
    : subjects;

  return (
    <>
      <h2 className="quiz-stage-title">
        {stream.name} · {yearBlock?.label}
        {yearBlock?.semesters && <small> ({yearBlock.semesters})</small>}
      </h2>

      <div className="resource-toolbar">
        <div className="resource-search">
          <Search size={16} />
          <input
            type="text"
            value={query}
            placeholder={`Search subjects in ${stream.name} year ${year}`}
            aria-label="Search subjects"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {shown.length ? (
        <div className="quiz-grid">
          {shown.map((subject) => {
            const stats = bankStats(stream.id, subject.id);
            const p = progressFor(progress, stream.id, year, subject.id);
            const passed = LEVELS.filter((l) => p.levels[l.id]?.passed).length;
            const ready = LEVELS.every((l) => levelPlayable(stream.id, subject.id, l.id));
            return (
              <button
                type="button"
                className={`quiz-card ${!ready ? "is-thin" : ""}`}
                key={subject.id}
                onClick={() => onPick(subject.id)}
              >
                <span className="quiz-card-icon"><BookOpen size={20} /></span>
                <h3>{subject.name}</h3>
                <p className="quiz-card-full">{subject.code}</p>
                <p>{subject.topic}</p>
                <div className="quiz-level-pips" aria-hidden="true">
                  {LEVELS.map((l) => (
                    <span key={l.id} className={`pip ${p.levels[l.id]?.passed ? "is-done" : ""}`} />
                  ))}
                  {p.exam?.passed && <span className="pip pip--exam is-done" />}
                </div>
                <span className="quiz-card-meta">
                  {stats.total} questions
                  {passed > 0 && <em className="quiz-card-cleared">· {passed}/3 levels cleared</em>}
                  <ArrowRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="resource-empty">No subject matches “{query.trim()}”.</p>
      )}
    </>
  );
}

/* ----------------------------- Stage 4: levels ----------------------------- */

function LevelPicker({ streamId, subject, subjectProgress, onStart }) {
  const stats = bankStats(streamId, subject.id);
  const examOpen = examUnlocked(subjectProgress);
  const examReady = examPlayable(streamId, subject.id);

  return (
    <>
      <div className="quiz-subject-head">
        <div>
          <h2 className="quiz-stage-title">{subject.name}</h2>
          <p className="quiz-subject-topic">{subject.topic} · {subject.code}</p>
        </div>
        <div className="quiz-bank-tally">
          <Layers size={15} />
          <span><strong>{stats.total}</strong> questions in this bank</span>
        </div>
      </div>

      <div className="quiz-levels">
        {LEVELS.map((level) => {
          const slot = subjectProgress.levels[level.id];
          const unlocked = levelUnlocked(subjectProgress, level.id);
          const ready = levelPlayable(streamId, subject.id, level.id);
          const count = stats.levels[level.id].count;
          const blocker = !unlocked
            ? `Clear ${LEVELS[level.order - 1].name} first`
            : !ready
              ? `Bank in preparation — ${count}/${PRACTICE_RULES.questions} questions ready`
              : null;

          return (
            <article className={`quiz-level ${slot.passed ? "is-passed" : ""} ${blocker ? "is-locked" : ""}`} key={level.id}>
              <div className="quiz-level-rank">{level.order + 1}</div>
              <div className="quiz-level-copy">
                <h3>
                  {level.name}
                  {slot.passed && <span className="quiz-tag quiz-tag--pass"><CheckCircle2 size={13} /> Cleared</span>}
                  {blocker && !slot.passed && <span className="quiz-tag quiz-tag--lock"><Lock size={13} /> Locked</span>}
                </h3>
                <p>{level.blurb}</p>
                <p className="quiz-level-facts">
                  {PRACTICE_RULES.questions} questions · pass mark {PRACTICE_RULES.pass} ·
                  {" "}{count} in the bank
                  {slot.attempts > 0 && ` · ${slot.attempts} attempt${slot.attempts === 1 ? "" : "s"}, best ${slot.best}/${PRACTICE_RULES.questions}`}
                </p>
              </div>
              <div className="quiz-level-action">
                {blocker ? (
                  <span className="quiz-level-blocked">{blocker}</span>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onStart(level.id)}>
                    {slot.attempts > 0 ? (slot.passed ? "Practise again" : "Retake test") : "Start practice test"}
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </article>
          );
        })}

        <article className={`quiz-level quiz-level--exam ${subjectProgress.exam.passed ? "is-passed" : ""} ${!examOpen || !examReady ? "is-locked" : ""}`}>
          <div className="quiz-level-rank"><Trophy size={18} /></div>
          <div className="quiz-level-copy">
            <h3>
              Final Exam
              {subjectProgress.exam.passed && <span className="quiz-tag quiz-tag--pass"><CheckCircle2 size={13} /> Passed</span>}
              {(!examOpen || !examReady) && <span className="quiz-tag quiz-tag--lock"><Lock size={13} /> Locked</span>}
            </h3>
            <p>The graded paper. Questions are drawn evenly from all three levels.</p>
            <p className="quiz-level-facts">
              {EXAM_RULES.questions} questions · 1 mark each · pass mark {EXAM_RULES.pass} · no negative marking
              {subjectProgress.exam.attempts > 0 && ` · best ${subjectProgress.exam.best}/${EXAM_RULES.questions}`}
            </p>
          </div>
          <div className="quiz-level-action">
            {!examOpen ? (
              <span className="quiz-level-blocked">Clear all three practice levels first</span>
            ) : !examReady ? (
              <span className="quiz-level-blocked">Bank in preparation</span>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onStart("exam")}>
                {subjectProgress.exam.attempts > 0 ? "Sit the exam again" : "Start final exam"} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

/* ---------------------------- Stage 5: the paper ---------------------------- */

function SittingView({ sitting, subject, onAnswer, onGoTo, onSubmit, onAbandon }) {
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const tick = useRef(null);

  useEffect(() => {
    tick.current = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(tick.current);
  }, [sitting.id]);

  const total = sitting.questions.length;
  const question = sitting.questions[sitting.current];
  const answered = sitting.responses.filter((r) => r !== null).length;
  const isExam = sitting.stage === "exam";
  const stageName = isExam ? "Final Exam" : `${LEVELS.find((l) => l.id === sitting.stage)?.name} practice set`;

  return (
    <section className="quiz-sitting">
      <header className="quiz-sitting-bar">
        <div className="quiz-sitting-id">
          <strong>{stageName}</strong>
          <small>{subject.name} · {subject.code}</small>
        </div>
        <div className="quiz-sitting-stats">
          <span><Timer size={14} /> {formatClock(elapsed)}</span>
          <span><ListChecks size={14} /> {answered}/{total} answered</span>
          <span className="quiz-sitting-nomark">No negative marking</span>
        </div>
      </header>

      <div className="quiz-progressbar" aria-hidden="true">
        <span style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <div className="quiz-sitting-body">
        <div className="quiz-question">
          <p className="quiz-question-num">Question {sitting.current + 1} of {total}</p>
          <h3 className="quiz-question-text">{question.prompt}</h3>

          <div className="quiz-options" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, i) => {
              const chosen = sitting.responses[sitting.current] === i;
              return (
                <button
                  type="button"
                  key={i}
                  role="radio"
                  aria-checked={chosen}
                  className={`quiz-option ${chosen ? "is-chosen" : ""}`}
                  onClick={() => onAnswer(i)}
                >
                  <span className="quiz-option-key">{["A", "B", "C", "D"][i]}</span>
                  <span className="quiz-option-text">{option}</span>
                </button>
              );
            })}
          </div>

          <div className="quiz-nav">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={sitting.current === 0}
              onClick={() => onGoTo(sitting.current - 1)}
            >
              <ArrowLeft size={15} /> Previous
            </button>
            {sitting.current < total - 1 ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onGoTo(sitting.current + 1)}>
                Next <ArrowRight size={15} />
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirming(true)}>
                Submit paper <CheckCircle2 size={15} />
              </button>
            )}
          </div>
        </div>

        <aside className="quiz-palette">
          <p className="quiz-palette-title">Questions</p>
          <div className="quiz-palette-grid">
            {sitting.questions.map((q, i) => (
              <button
                type="button"
                key={q.id}
                className={`quiz-palette-cell ${i === sitting.current ? "is-current" : ""} ${sitting.responses[i] !== null ? "is-answered" : ""}`}
                onClick={() => onGoTo(i)}
                aria-label={`Go to question ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-sm quiz-palette-submit" onClick={() => setConfirming(true)}>
            Submit paper
          </button>
          <button type="button" className="quiz-palette-quit" onClick={onAbandon}>
            Leave without submitting
          </button>
        </aside>
      </div>

      {confirming && (
        <div className="quiz-confirm" role="dialog" aria-modal="true">
          <div className="quiz-confirm-card">
            <h3>Submit this paper?</h3>
            <p>
              You have answered <strong>{answered}</strong> of {total} questions.
              {answered < total && " Unanswered questions score zero — there is no negative marking, so a guess costs nothing."}
            </p>
            <div className="quiz-confirm-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
                Keep working
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit}>
                Submit now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ----------------------------- Stage 6: result ----------------------------- */

function ResultView({ result, subject, subjectProgress, streamId, subjectId, onRetake, onNext, onLevels }) {
  const isExam = result.stage === "exam";
  const stageName = isExam ? "Final Exam" : `${LEVELS.find((l) => l.id === result.stage)?.name} practice set`;
  const next = isExam ? null : nextLevelAfter(result.stage);
  const nextReady = next ? levelPlayable(streamId, subjectId, next.id) : false;
  const examOpen = examUnlocked(subjectProgress);
  const percent = Math.round((result.score / result.total) * 100);

  return (
    <section className="quiz-result">
      <div className={`quiz-result-head ${result.pass ? "is-pass" : "is-fail"}`}>
        <div className="quiz-result-badge">
          {result.pass ? <CheckCircle2 size={28} /> : <RotateCcw size={28} />}
        </div>
        <div className="quiz-result-copy">
          <p className="quiz-result-stage">{stageName} · {subject.name}</p>
          <h2>{result.pass ? "Passed" : "Not cleared yet"}</h2>
          <p className="quiz-result-line">
            You scored <strong>{result.score}</strong> out of {result.total} ({percent}%).
            {" "}The pass mark is {result.passMark}.
            {!result.pass && ` You need ${result.passMark - result.score} more correct answer${result.passMark - result.score === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="quiz-result-score">
          <strong>{result.score}</strong>
          <span>/ {result.total}</span>
        </div>
      </div>

      <div className="quiz-result-stats">
        <div><strong>{result.correct}</strong><span>Correct</span></div>
        <div><strong>{result.wrong}</strong><span>Wrong</span></div>
        <div><strong>{result.skipped}</strong><span>Skipped</span></div>
        <div><strong>{formatClock(result.elapsed)}</strong><span>Time taken</span></div>
      </div>

      <div className="quiz-result-actions">
        {result.pass ? (
          <>
            {next && nextReady && (
              <button type="button" className="btn btn-primary" onClick={() => onNext(next.id)}>
                Start {next.name} practice <ArrowRight size={16} />
              </button>
            )}
            {!next && !isExam && examOpen && (
              <button type="button" className="btn btn-primary" onClick={() => onNext("exam")}>
                Sit the final exam <Trophy size={16} />
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onRetake}>
              <RotateCcw size={16} /> Practise this level again
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onRetake}>
            <RotateCcw size={16} /> Retake with a fresh set
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onLevels}>
          Back to levels
        </button>
      </div>

      {!result.pass && (
        <p className="quiz-note">
          <AlertTriangle size={14} />
          Retake as many times as you like — every attempt draws a different paper, and the level
          only opens the next one once you reach {result.passMark} out of {result.total}.
        </p>
      )}

      <h3 className="quiz-review-title">Answer review</h3>
      <ol className="quiz-review">
        {result.review.map((item) => (
          <li key={item.question.id} className={`quiz-review-item ${item.correct ? "is-correct" : item.skipped ? "is-skipped" : "is-wrong"}`}>
            <div className="quiz-review-head">
              <span className="quiz-review-icon">
                {item.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              </span>
              <p className="quiz-review-q">{item.question.prompt}</p>
            </div>
            <ul className="quiz-review-options">
              {item.question.options.map((option, i) => {
                const isAnswer = i === item.question.answer;
                const isChosen = i === item.chosen;
                return (
                  <li
                    key={i}
                    className={`${isAnswer ? "is-answer" : ""} ${isChosen && !isAnswer ? "is-chosen-wrong" : ""}`}
                  >
                    <span className="quiz-review-key">{["A", "B", "C", "D"][i]}</span>
                    {option}
                    {isAnswer && <em>Correct answer</em>}
                    {isChosen && !isAnswer && <em>Your answer</em>}
                  </li>
                );
              })}
            </ul>
            {item.skipped && <p className="quiz-review-note">You skipped this question.</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
