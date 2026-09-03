/* ============================================================================
   Minimal PDF writer.

   Until the real scanned papers are uploaded, a Download button still has to
   produce a file that actually opens in a PDF reader. This builds a valid
   single-page PDF from scratch — no dependency, a few hundred bytes — carrying
   the paper's details and a note that the scan is pending.

   Once a real URL exists in PYQ_FILES the app links straight to it and this is
   never called.
   ========================================================================== */

/* PDF strings escape backslash and both parens. */
function esc(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/* Latin-1 only: the built-in Helvetica encoding cannot express anything else,
   and a stray multi-byte char would corrupt the stream length. */
function toLatin1(text) {
  return String(text).replace(/[^\x20-\x7E]/g, "-");
}

/**
 * Build a one-page A4 PDF.
 * @param {string} title  heading line
 * @param {string[]} lines  body lines, drawn under the heading
 * @returns {Blob} a PDF blob ready for an object URL
 */
export function buildSimplePdf(title, lines = []) {
  const body = [];
  body.push("BT", "/F1 20 Tf", "60 760 Td", `(${esc(toLatin1(title))}) Tj`, "ET");

  let y = 715;
  lines.forEach((line) => {
    body.push("BT", "/F1 12 Tf", `60 ${y} Td`, `(${esc(toLatin1(line))}) Tj`, "ET");
    y -= 22;
  });

  const content = body.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  /* Assemble while recording each object's byte offset for the xref table. */
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  /* Write as Latin-1 bytes so the recorded offsets match the file exactly. */
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

/** Save a Blob (or a same-origin URL) under a chosen filename. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoke on the next tick — revoking synchronously can cancel the download. */
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
