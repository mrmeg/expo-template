/**
 * The dashboard's HTML shell. Static: the header, the range form, the section
 * tabs (real `#hash` links, so a section is linkable) and one empty section per
 * report, which `script.ts` fills from the query API.
 *
 * Nothing inline: no `<script>` body, no `style` attribute, no `on*` handler,
 * so a host with `script-src 'self'; style-src 'self'` serves it unchanged.
 * The only value interpolated is the host's base path, escaped.
 */

export const DASHBOARD_SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "product", title: "Product" },
  { id: "retention", title: "Retention" },
  { id: "funnels", title: "Funnels" },
  { id: "acquisition", title: "Acquisition" },
  { id: "web", title: "Web" },
  { id: "revenue", title: "Revenue" },
  { id: "events", title: "Events" },
] as const;

const PRESETS = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom" },
] as const;

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** `script-src 'self'` and friends: the page loads its two assets and talks to its own API, nothing else. */
export const DASHBOARD_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

function section(id: string, title: string): string {
  return `<section id="section-${id}" class="section" data-section="${id}" aria-labelledby="h-${id}" hidden>
  <div class="section-head">
    <h2 id="h-${id}">${title}</h2>
    <a class="csv-link" data-csv hidden download>Download CSV</a>
  </div>
  <div class="section-body" data-body></div>
  <ul class="notes" data-notes aria-label="Notes"></ul>
</section>`;
}

/** The page for a server mounted at `basePath` (already normalized: `""` or `/x`). */
export function renderDashboardPage(basePath: string): string {
  const base = escapeHtml(basePath);
  const presets = PRESETS.map(
    (preset) => `<button type="button" class="chip" data-preset="${preset.id}" aria-pressed="false">${preset.label}</button>`,
  ).join("\n        ");
  const tabs = DASHBOARD_SECTIONS.map(
    (s) => `<li><a class="tab" href="#${s.id}" data-tab="${s.id}">${s.title}</a></li>`,
  ).join("\n        ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="same-origin">
<meta name="color-scheme" content="light dark">
<title>Analytics</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${base}/assets/dashboard.css">
<script src="${base}/assets/dashboard.js" defer></script>
</head>
<body data-base="${base}">
<a class="skip-link" href="#main">Skip to the report</a>
<header class="masthead">
  <div class="wrap">
    <p class="eyebrow"><span class="mono" id="app-id">Analytics</span><span class="sep" aria-hidden="true"> · </span><span id="app-zone"></span></p>
    <h1 id="period">Loading the period…</h1>
    <p class="period-compare" id="period-compare"></p>
    <form class="range" id="range-form" aria-label="Date range">
      <div class="chips" role="group" aria-label="Range">
        ${presets}
      </div>
      <div class="custom-range" id="custom-range" hidden>
        <label class="field"><span>From</span><input type="date" name="from" id="range-from" required></label>
        <label class="field"><span>To</span><input type="date" name="to" id="range-to" required></label>
        <button type="submit" class="button">Apply</button>
      </div>
    </form>
  </div>
</header>
<nav class="tabs" aria-label="Sections">
  <div class="wrap">
    <ul class="tab-list">
        ${tabs}
    </ul>
  </div>
</nav>
<div class="wrap">
  <div class="banner" id="banner" role="alert" hidden></div>
</div>
<main id="main" class="wrap" tabindex="-1">
${DASHBOARD_SECTIONS.map((s) => section(s.id, s.title)).join("\n")}
<noscript><p class="state">This dashboard needs JavaScript to load its figures.</p></noscript>
</main>
</body>
</html>
`;
}
