/* Round "back to top" arrow, bottom-right, on every page of DnyanSetu and
   RaktSetu. Appears once the reader has scrolled down a screen's worth. */

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    /* React skips the re-render when the value is unchanged, so this is cheap. */
    const check = () => setShow(window.scrollY > Math.min(500, window.innerHeight * 0.8));
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      className={`back-to-top ${show ? "is-visible" : ""}`}
      onClick={toTop}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={show ? 0 : -1}
    >
      <ArrowUp size={20} strokeWidth={2.4} />
    </button>
  );
}
