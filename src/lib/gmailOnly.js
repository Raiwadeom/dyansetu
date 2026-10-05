/* DnyanSetu accounts use Gmail addresses only (yourname@gmail.com). The same
   rule is enforced by the database (migration 0020), so this check is just
   the quick, friendly message before anything is sent. */

export const GMAIL_ONLY_MESSAGE = "Use a proper Gmail ID only (for example yourname@gmail.com).";

export function isGmail(value) {
  return /^[a-z0-9.+_-]+@gmail\.com$/.test((value || "").trim().toLowerCase());
}
