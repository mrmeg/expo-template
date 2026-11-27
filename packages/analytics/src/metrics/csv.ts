/**
 * RFC 4180 CSV with a UTF-8 byte order mark so spreadsheet apps open it as
 * UTF-8.
 *
 * Fields containing a comma, double quote, CR or LF are quoted with embedded
 * quotes doubled; records end with CRLF. `null` and `undefined` are empty;
 * `Date` values are ISO 8601; objects are JSON; everything else is
 * `String(value)`.
 *
 * Formula-injection guard: a text cell starting with `=`, `+`, `-`, `@`, tab or
 * CR is prefixed with `'`, so a spreadsheet shows it instead of evaluating it.
 * Numbers are never prefixed, so negative amounts stay numeric.
 */

export const CSV_BOM = "﻿";
const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "object") text = JSON.stringify(value);
  else text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

/** Header row from `columns`, then one record per row in column order. */
export function toCsv(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  const lines = [columns.map(csvField).join(",")];
  for (const row of rows) lines.push(columns.map((column) => csvField(row[column])).join(","));
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}
