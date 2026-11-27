/**
 * Display formatting for report figures, so a dashboard and host apps render
 * them the same way.
 */

import type { RateCell } from "./types";

/** Whole-percent string for a fraction, e.g. 0.274 to `27%`. */
export function formatPercent(rate: number, fractionDigits = 0): string {
  return `${(rate * 100).toFixed(fractionDigits)}%`;
}

/** A `RateCell` as text: the percentage, `Not yet` while its window is open, `No data` when empty. */
export function formatRateCell(cell: RateCell, fractionDigits = 0): string {
  if (cell.status === "not_yet") return "Not yet";
  if (cell.status === "empty" || cell.rate === null) return "No data";
  return formatPercent(cell.rate, fractionDigits);
}

/** Integer cents as currency, e.g. 123456 to `$1,234.56`. */
export function formatCents(cents: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Whole-number count with grouping, e.g. 12345 to `12,345`. */
export function formatCount(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** Seconds as a short duration: `45s`, `3m 05s`, `2h 04m`, `3d 2h`. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "No data";
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Signed change between two figures as a fraction of the earlier one; null without a usable base. */
export function relativeChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return (current - previous) / previous;
}
