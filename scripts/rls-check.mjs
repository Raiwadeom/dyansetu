/* ============================================================================
   DnyanSetu — Row Level Security check (run before going live)

   The anon key is public, so one wrong policy would let anyone read every
   donor's blood group and phone number. This script signs in as nobody, as
   user A and as user B, and confirms each can only see what they should.

   Setup (once):
     1. Run both SQL migrations.
     2. Create two throwaway test accounts through the site (sign up), accept
        the terms, and give each a RaktSetu profile with a phone number.
     3. As user A, post one blood request (so there is a contact row to probe).
     4. Put in .env.local:
          RLS_TEST_A_EMAIL=…  RLS_TEST_A_PASSWORD=…
          RLS_TEST_B_EMAIL=…  RLS_TEST_B_PASSWORD=…

   Run from hac/:   node scripts/rls-check.mjs
   Every line should say "ok". Delete the test accounts afterwards.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.local", ".env"]) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

const URL_ = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !ANON) {
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.");
  process.exit(1);
}

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures += 1;
};
const client = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function signedIn(which) {
  const email = process.env[`RLS_TEST_${which}_EMAIL`];
  const password = process.env[`RLS_TEST_${which}_PASSWORD`];
  if (!email || !password) return null;
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${which}: ${error.message}`);
  return { c, id: data.user.id };
}

/* Rows a client can see in a table (0 when refused). */
async function visible(c, table, filter) {
  let q = c.from(table).select("*");
  if (filter) q = filter(q);
  const { data, error } = await q;
  return error ? 0 : (data || []).length;
}

console.log("\nsigned out (anon key only):");
const anon = client();
for (const table of [
  "profiles", "raktsetu_profiles", "blood_requests", "blood_request_contacts",
  "request_responses", "blood_request_reports", "push_subscriptions", "quiz_attempts",
  "admin_sessions", "raktsetu_email_log",
]) {
  check(`cannot read ${table}`, (await visible(anon, table)) === 0);
}
for (const fn of ["raktsetu_push_targets", "raktsetu_email_targets"]) {
  const { error } = await anon.rpc(fn, { p_request_id: "00000000-0000-0000-0000-000000000000" });
  check(`cannot call ${fn}`, Boolean(error));
}
{
  const { error } = await anon.from("blood_requests").insert({ patient_name: "x" });
  check("cannot insert a blood request", Boolean(error));
}
check("can read public notes table (expected)", (await anon.from("notes").select("id").limit(1)).error === null);

const A = await signedIn("A");
const B = await signedIn("B");
if (!A || !B) {
  console.log("\n(skipping signed-in checks — set RLS_TEST_A_* and RLS_TEST_B_* in .env.local)\n");
} else {
  console.log("\nsigned in as B, probing A's data:");
  check("B cannot read A's DnyanSetu profile", (await visible(B.c, "profiles", (q) => q.eq("id", A.id))) === 0);
  check("B cannot read A's RaktSetu profile", (await visible(B.c, "raktsetu_profiles", (q) => q.eq("user_id", A.id))) === 0);
  check("B sees only their own RaktSetu profile", (await visible(B.c, "raktsetu_profiles")) <= 1);
  check("B cannot read A's push subscriptions", (await visible(B.c, "push_subscriptions", (q) => q.eq("user_id", A.id))) === 0);
  check("B cannot read A's quiz attempts", (await visible(B.c, "quiz_attempts", (q) => q.eq("user_id", A.id))) === 0);

  const { data: aRequests } = await A.c.from("blood_requests").select("id").eq("requester_id", A.id).limit(1);
  const reqId = aRequests?.[0]?.id;
  if (!reqId) {
    console.log("  (A has no blood request — post one as A to test contact privacy)");
  } else {
    const { data: already } = await B.c.from("request_responses").select("id").eq("request_id", reqId).eq("responder_id", B.id);
    if (already?.length) {
      console.log("  (B already responded to A's request; contact visibility is expected — use a fresh request)");
    } else {
      check("B cannot read A's contact phone before responding", (await visible(B.c, "blood_request_contacts", (q) => q.eq("request_id", reqId))) === 0);
    }
    check("B cannot list responders to A's request", Boolean((await B.c.rpc("raktsetu_list_responders", { p_request_id: reqId })).error));
    check("B cannot close A's request", Boolean((await B.c.rpc("raktsetu_set_request_status", { p_request_id: reqId, p_status: "cancelled" })).error));
    check("B cannot moderate", Boolean((await B.c.rpc("raktsetu_admin_remove", { p_request_id: reqId, p_reason: "x" })).error));
    check("A can read own contact phone", (await visible(A.c, "blood_request_contacts", (q) => q.eq("request_id", reqId))) === 1);
  }

  console.log("\nprivilege escalation:");
  const { error: roleError } = await B.c.from("profiles").update({ role: "admin" }).eq("id", B.id);
  check("B cannot make themselves admin", Boolean(roleError));
  /* RLS makes a forbidden update touch zero rows rather than error, so check
     the data itself. */
  const { data: before } = await A.c.from("profiles").select("name").eq("id", A.id).single();
  await B.c.from("profiles").update({ name: "rls-check-was-here" }).eq("id", A.id);
  const { data: after } = await A.c.from("profiles").select("name").eq("id", A.id).single();
  check("B cannot edit A's profile", after?.name === before?.name);
  const { error: minorError } = await B.c.from("raktsetu_profiles").update({ age: 16 }).eq("user_id", B.id);
  check("an age under 18 is refused by the database", Boolean(minorError));
}

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) FAILED — do not go live`}\n`);
process.exitCode = failures ? 1 : 0;
