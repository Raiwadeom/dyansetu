/* ============================================================================
   RaktSetu — signed unsubscribe tokens

   The link in every alert email turns that user's email alerts off without
   signing in. It carries the user id plus an HMAC over it, so nobody can build
   a working link for somebody else's account.
   ========================================================================== */

import crypto from "node:crypto";

import { env } from "./supabaseAdmin.js";

function secret() {
  const value = env("RAKTSETU_UNSUBSCRIBE_SECRET");
  if (!value) throw new Error("RAKTSETU_UNSUBSCRIBE_SECRET is not set.");
  return value;
}

function sign(userId) {
  return crypto.createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url");
}

export function makeUnsubscribeToken(userId) {
  return `${Buffer.from(userId, "utf8").toString("base64url")}.${sign(userId)}`;
}

/* Returns the user id, or null for a malformed or forged token. */
export function readUnsubscribeToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [idPart, signature] = token.split(".");
  let userId;
  try {
    userId = Buffer.from(idPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;

  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature || "");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return userId;
}
