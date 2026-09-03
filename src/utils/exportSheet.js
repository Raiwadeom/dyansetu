/* ============================================================================
   DyanSetu — Spreadsheet export

   Produces a CSV that Excel opens cleanly. The byte-order mark matters: without
   it Excel reads the file as the local codepage and mangles any name with an
   accent or a Devanagari character.
   ========================================================================== */

/* Wraps a value so commas, quotes and newlines survive the round trip. */
function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/* `columns` is [{ header, value }] where value is a function of the row. */
export function toCsv(rows, columns) {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  return [head, ...body].join("\r\n");
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  /* ﻿ is the BOM Excel looks for to pick UTF-8. */
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  /* Give the browser a moment to start the download before revoking. */
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampedName(prefix) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}
