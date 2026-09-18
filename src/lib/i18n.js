import { createContext, useContext } from "react";

/* Site-wide language switch — "en" | "mr". Only the public landing page, the
   About page and the Scholarships page are translated; every signed-in
   portal stays English, so this never gets threaded past those three. */

export const LANG_KEY = "dyansetu-lang";

export const LangContext = createContext({ lang: "en", setLang: () => {} });

export function useLang() {
  return useContext(LangContext);
}

/* `tr("English copy", "मराठी मजकूर")` — pick the string for the active
   language. Call inside a component via `const { lang } = useLang();`. */
export function makeTr(lang) {
  return (en, mr) => (lang === "mr" ? mr : en);
}
