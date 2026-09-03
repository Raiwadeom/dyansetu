/* Validates every question bank: shape, depth and duplicates, and then checks
   that every subject in the curriculum actually resolves to a full bank
   through the registry.

   That second pass is the important one. Walking the bank files alone reported
   "39 banks complete" at a moment when four of them were not imported in
   banks/index.js at all, so the app served those subjects zero questions while
   this script said everything was fine. A bank nobody can reach is not a bank.

   Run with: node scripts/check-quiz-banks.mjs                             */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("../src/data/quiz/banks/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LEVELS = ["beginner", "intermediate", "advanced"];
const TARGET = 100;

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return entry.endsWith(".js") && entry !== "index.js" ? [full] : [];
  });
}

const files = walk(ROOT).sort();
let problems = 0;
let authored = 0;
const rows = [];

for (const file of files) {
  const mod = await import(pathToFileURL(file).href);
  const bank = mod.default || mod;
  const name = relative(ROOT, file).replace(/\\/g, "/").replace(/\.js$/, "");
  const counts = {};
  const prompts = new Map();

  for (const level of LEVELS) {
    const list = bank[level];
    if (!Array.isArray(list)) {
      console.log(`FAIL ${name}: missing "${level}" export`);
      problems += 1;
      counts[level] = 0;
      continue;
    }
    counts[level] = list.length;
    authored += list.length;

    list.forEach((tuple, i) => {
      const where = `${name} ${level}[${i}]`;
      if (!Array.isArray(tuple) || tuple.length !== 6) {
        console.log(`FAIL ${where}: expected 6 elements, got ${tuple?.length}`);
        problems += 1;
        return;
      }
      const [prompt, a, b, c, d, answer] = tuple;
      if (typeof prompt !== "string" || !prompt.trim()) {
        console.log(`FAIL ${where}: empty prompt`);
        problems += 1;
      }
      for (const [n, opt] of [a, b, c, d].entries()) {
        if (typeof opt !== "string" || !opt.trim()) {
          console.log(`FAIL ${where}: option ${n} is empty`);
          problems += 1;
        }
      }
      if (new Set([a, b, c, d]).size !== 4) {
        console.log(`FAIL ${where}: duplicate options`);
        problems += 1;
      }
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) {
        console.log(`FAIL ${where}: answer index ${answer} out of range`);
        problems += 1;
      }
      const key = prompt.trim().toLowerCase();
      if (prompts.has(key)) {
        console.log(`FAIL ${where}: duplicate prompt, also at ${prompts.get(key)}`);
        problems += 1;
      } else {
        prompts.set(key, where);
      }
    });

    if (list.length < TARGET) {
      console.log(`SHORT ${name} ${level}: ${list.length}/${TARGET}`);
    }
  }

  const total = LEVELS.reduce((n, l) => n + counts[l], 0);
  rows.push({ name, total, ...counts });
}

/* ---- registry pass: what the running app would actually serve ---- */

const { QUIZ_STREAMS } = await import(
  new URL("../src/data/quiz/curriculum.js", import.meta.url).href);
const { bankStats } = await import(
  new URL("../src/data/quiz/engine.js", import.meta.url).href);

let wired = 0;
let served = 0;

for (const stream of QUIZ_STREAMS) {
  for (const year of stream.years) {
    for (const subject of year.subjects) {
      const stats = bankStats(stream.id, subject.id);
      served += stats.total;
      wired += 1;

      const thin = LEVELS.filter((l) => stats.levels[l].count < TARGET);
      if (stats.total === 0) {
        console.log(
          `FAIL ${stream.id}/${subject.id} (${subject.name}, year ${year.year}): ` +
          "resolves to an empty bank — check the import and the entry in banks/index.js");
        problems += 1;
      } else if (thin.length) {
        console.log(`SHORT ${stream.id}/${subject.id}: ` +
          thin.map((l) => `${l} ${stats.levels[l].count}/${TARGET}`).join(", "));
      }
    }
  }
}

const complete = rows.filter((r) => r.total >= TARGET * 3).length;
console.log("");
console.log(`bank files:   ${rows.length}`);
console.log(`complete:     ${complete} at ${TARGET * 3}/subject`);
console.log(`authored:     ${authored} questions`);
console.log(`curriculum:   ${wired} subjects wired, ${served} questions reachable`);
console.log(`problems:     ${problems}`);
process.exit(problems ? 1 : 0);
