/**
 * The dashboard stylesheet, served as `<basePath>/assets/dashboard.css`.
 *
 * One restrained palette as custom properties on `:root` with a dark variant.
 * The three series hues are the first three slots of a palette validated for
 * colour-vision deficiency in both modes; two sit under 3:1 on white, which is
 * why every chart carries a value readout and a data table rather than relying
 * on the line colour. The heat scale is one hue, light to dark (dark to light
 * on the dark surface), and each step sets its own text ink.
 *
 * System fonts only: the page makes no request beyond its own two assets.
 * Raw strings that arrived from the public ingest endpoint (event names,
 * paths, user ids, properties) are set in the monospace face, so wire data
 * always looks like wire data.
 */

export const DASHBOARD_STYLES = String.raw`
:root {
  color-scheme: light;
  --page: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #eef0f3;
  --ink: #191919;
  --ink-2: #5c6067;
  --grid: #e7e7e7;
  --axis: #c2c2c2;
  --border: rgba(11, 11, 11, 0.1);
  --accent: #1b64be;
  --accent-ink: #ffffff;
  --focus: #257de0;
  --s1: #257de0;
  --s2: #f47230;
  --s3: #00b894;
  --negative: #ec4647;
  --up: #006c10;
  --down: #b3261e;
  --h0: #cce3fd; --h1: #b6d5f8; --h2: #9dc8f7; --h3: #84b9f3; --h4: #6aabf1;
  --h5: #519ced; --h6: #338ced; --h7: #257de0; --h8: #1b64be; --h9: #0f4a96;
  --h-ink-low: #191919;
  --h-ink-high: #ffffff;
  --radius: 10px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --page: #0b0b0b;
    --surface: #191919;
    --surface-2: #262626;
    --ink: #efefef;
    --ink-2: #a3a3a3;
    --grid: #303030;
    --axis: #474747;
    --border: rgba(255, 255, 255, 0.1);
    --accent: #6aabf1;
    --accent-ink: #0b0b0b;
    --focus: #6aabf1;
    --s1: #338ced;
    --s2: #e76624;
    --s3: #00a888;
    --negative: #eb6263;
    --up: #53c556;
    --down: #ff8a80;
    --h0: #172a42; --h1: #173459; --h2: #0f4a96; --h3: #1757ac; --h4: #1b64be;
    --h5: #2370cd; --h6: #257de0; --h7: #338ced; --h8: #6aabf1; --h9: #9dc8f7;
    --h-ink-low: #ffffff;
    --h-ink-high: #0b0b0b;
  }
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--page);
  color: var(--ink);
  font: 15px/1.45 var(--font);
  overflow-x: hidden;
}

a { color: var(--accent); }

:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

.wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 16px; }

.mono { font-family: var(--mono); font-size: 0.9em; overflow-wrap: anywhere; word-break: break-word; }
.muted { color: var(--ink-2); }

.sr-only, .skip-link:not(:focus) {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.skip-link:focus { position: absolute; top: 8px; left: 16px; z-index: 20; background: var(--surface); padding: 10px 14px; border-radius: 8px; }

[hidden] { display: none !important; }

/* -- Masthead: the period is the page's subject --------------------------- */

.masthead { padding: 20px 0 14px; }
.eyebrow { margin: 0 0 6px; font-size: 13px; color: var(--ink-2); overflow-wrap: anywhere; }
.eyebrow .mono { color: var(--ink); }
#period { margin: 0; font-size: clamp(24px, 6.4vw, 36px); line-height: 1.15; font-weight: 650; letter-spacing: -0.015em; }
.period-compare { margin: 4px 0 0; font-size: 13.5px; color: var(--ink-2); min-height: 1.45em; }

.range { margin-top: 14px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  min-height: 44px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--border); background: var(--surface); color: var(--ink);
  font: inherit; font-size: 14px; cursor: pointer;
}
.chip:hover { background: var(--surface-2); }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--page); border-color: var(--ink); }

.custom-range { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-top: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--ink-2); min-width: 0; }
.field input {
  min-height: 44px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--surface); color: var(--ink); font: inherit; font-size: 15px; max-width: 100%;
}
.field input::placeholder { color: var(--ink-2); opacity: 1; }
.button {
  min-height: 44px; padding: 0 16px; border-radius: 8px; border: 1px solid transparent;
  background: var(--accent); color: var(--accent-ink); font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer;
}
.button.secondary { background: var(--surface); color: var(--ink); border-color: var(--border); font-weight: 500; }
.button:disabled { opacity: 0.6; cursor: default; }

/* -- Tabs: real links, scrolling inside their own strip on a phone -------- */

.tabs { position: sticky; top: 0; z-index: 5; background: var(--page); border-bottom: 1px solid var(--border); }
.tab-list {
  display: flex; gap: 2px; margin: 0; padding: 0; list-style: none;
  overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.tab-list::-webkit-scrollbar { display: none; }
.tab {
  display: flex; align-items: center; min-height: 48px; padding: 0 12px;
  color: var(--ink-2); text-decoration: none; white-space: nowrap; font-weight: 500;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.tab:hover { color: var(--ink); }
.tab[aria-current="page"] { color: var(--ink); border-bottom-color: var(--s1); }

.banner {
  margin-top: 14px; padding: 12px 14px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--down);
}
.banner p { margin: 0 0 8px; }
.banner p:last-child { margin-bottom: 0; }

/* -- Sections ------------------------------------------------------------- */

main { padding-top: 20px; padding-bottom: 72px; }
main:focus { outline: none; }

.section-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; margin-bottom: 12px; }
.section-head h2 { margin: 0; font-size: 21px; font-weight: 650; letter-spacing: -0.01em; }
.csv-link { display: inline-flex; align-items: center; min-height: 44px; font-size: 14px; }

.section-body { min-width: 0; transition: opacity 0.2s ease; }
.section-body.is-loading { opacity: 0.55; }

.notes { margin: 24px 0 0; padding: 0; list-style: none; font-size: 12.5px; color: var(--ink-2); max-width: 72ch; }
.notes li + li { margin-top: 4px; }

.group-title { margin: 22px 0 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.group-title:first-child { margin-top: 0; }

.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.toolbar-label { font-size: 13px; color: var(--ink-2); margin-right: 4px; }

/* -- Stat tiles ----------------------------------------------------------- */

.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.tile {
  min-width: 0; padding: 12px 14px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border);
}
.tile-label { margin: 0; font-size: 13px; color: var(--ink-2); }
.tile-value { margin: 4px 0 2px; font-size: clamp(20px, 5.6vw, 26px); font-weight: 600; line-height: 1.15; overflow-wrap: anywhere; }
.tile-value.is-state { font-size: 19px; font-weight: 500; color: var(--ink-2); }
.tile-sub, .delta { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-2); }
.delta-up { color: var(--up); }
.delta-down { color: var(--down); }
.delta .muted { color: var(--ink-2); }

/* -- Cards and layout ----------------------------------------------------- */

.card {
  min-width: 0; margin-top: 12px; padding: 14px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border);
}
.card-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; margin-bottom: 8px; }
.card h3 { margin: 0; font-size: 15px; font-weight: 600; }
.card-sub { margin: 0 0 8px; font-size: 12.5px; color: var(--ink-2); }
.card .csv-link { font-size: 13px; }
.cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0 12px; }
@media (min-width: 760px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

/* -- Charts --------------------------------------------------------------- */

.chart { margin: 0; min-width: 0; }
.plot { width: 100%; min-width: 0; }
.plot svg { display: block; touch-action: pan-y; }
.plot svg text, .tick { font-family: var(--font); font-size: 11px; fill: var(--ink-2); font-variant-numeric: tabular-nums; }
.grid-line { stroke: var(--grid); stroke-width: 1; shape-rendering: crispEdges; }
.axis-line { stroke: var(--axis); stroke-width: 1; shape-rendering: crispEdges; }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.line.s1 { stroke: var(--s1); } .line.s2 { stroke: var(--s2); } .line.s3 { stroke: var(--s3); }
.area { stroke: none; fill-opacity: 0.1; }
.area.s1 { fill: var(--s1); } .area.s2 { fill: var(--s2); } .area.s3 { fill: var(--s3); }
.dot { stroke: var(--surface); stroke-width: 2; }
.dot.s1 { fill: var(--s1); } .dot.s2 { fill: var(--s2); } .dot.s3 { fill: var(--s3); }
.crosshair { stroke: var(--axis); stroke-width: 1; }
.is-hidden { visibility: hidden; }

.readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 16px; margin: 0 0 8px; padding: 0; list-style: none; font-size: 13px; }
.readout-date { flex-basis: 100%; font-size: 12px; color: var(--ink-2); }
.readout-item { display: inline-flex; align-items: baseline; gap: 6px; }
.readout-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.readout-name { color: var(--ink-2); }
.key { display: inline-block; flex: none; }
.key-line { width: 14px; height: 2px; border-radius: 1px; align-self: center; }
.key-line.s1 { background: var(--s1); } .key-line.s2 { background: var(--s2); } .key-line.s3 { background: var(--s3); }

details.data { margin-top: 6px; }
details.data > summary { display: flex; align-items: center; min-height: 44px; cursor: pointer; color: var(--accent); font-size: 13.5px; }

/* -- Ranked bars ---------------------------------------------------------- */

.bar-list { margin: 0; padding: 0; list-style: none; }
.bar-row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 12px;
  padding: 7px 0; border-top: 1px solid var(--grid);
}
.bar-row:first-child { border-top: 0; padding-top: 2px; }
.bar-label { min-width: 0; font-size: 13.5px; overflow-wrap: anywhere; word-break: break-word; }
.bar-figure { font-size: 13.5px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.bar-track { display: block; grid-column: 1 / -1; min-width: 0; }
.bar-track svg { display: block; width: 100%; }
.bar-fill { fill: var(--s1); }
.bar-fill.is-negative { fill: var(--negative); }
.bar-sub { grid-column: 1 / -1; font-size: 12.5px; color: var(--ink-2); }
.empty-line { margin: 4px 0; font-size: 13.5px; color: var(--ink-2); }

/* -- Funnels -------------------------------------------------------------- */

.step-number { color: var(--ink-2); font-variant-numeric: tabular-nums; margin-right: 6px; }

/* -- Tables --------------------------------------------------------------- */

/* position: relative keeps the visually hidden (absolutely positioned) labels
   inside scrolled-off cells contained; without it they widen the document. */
.table-wrap { position: relative; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; }
table { border-collapse: collapse; width: 100%; font-size: 13.5px; font-variant-numeric: tabular-nums; }
caption { text-align: left; }
th, td { padding: 8px 10px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--grid); }
th { font-size: 12.5px; font-weight: 600; color: var(--ink-2); white-space: nowrap; }
th:first-child, td:first-child { padding-left: 0; }
th:last-child, td:last-child { padding-right: 0; }
.num { text-align: right; white-space: nowrap; }
td.mono { min-width: 8ch; }
.events-table td { font-size: 13px; }
.events-table .props { min-width: 18ch; max-width: 40ch; color: var(--ink-2); }
.events-table .when { white-space: nowrap; }

/* -- Cohort heat table ---------------------------------------------------- */

table.heat { width: auto; min-width: 100%; border-collapse: separate; border-spacing: 2px; font-size: 12px; }
table.heat th, table.heat td { border: 0; padding: 0; }
table.heat thead th { padding: 0 0 4px; text-align: center; }
table.heat .row-head {
  position: sticky; left: 0; z-index: 1; background: var(--surface);
  padding: 0 10px 0 0; text-align: left; white-space: nowrap; font-weight: 500; color: var(--ink);
}
table.heat .row-head .muted { display: block; font-weight: 400; font-size: 11.5px; }
table.heat .size { padding: 0 8px; text-align: right; color: var(--ink-2); }
.heat-cell { min-width: 44px; height: 36px; text-align: center; vertical-align: middle; border-radius: 4px; }
.heat-0 { background: var(--h0); color: var(--h-ink-low); }
.heat-1 { background: var(--h1); color: var(--h-ink-low); }
.heat-2 { background: var(--h2); color: var(--h-ink-low); }
.heat-3 { background: var(--h3); color: var(--h-ink-low); }
.heat-4 { background: var(--h4); color: var(--h-ink-low); }
.heat-5 { background: var(--h5); color: var(--h-ink-low); }
.heat-6 { background: var(--h6); color: var(--h-ink-low); }
.heat-7 { background: var(--h7); color: var(--h-ink-low); }
.heat-8 { background: var(--h8); color: var(--h-ink-high); }
.heat-9 { background: var(--h9); color: var(--h-ink-high); }
@media (prefers-color-scheme: dark) {
  .heat-6, .heat-7 { color: var(--h-ink-high); }
}
.heat-pending { background: var(--surface-2); color: var(--ink-2); }
.heat-empty { color: var(--ink-2); }
.heat-key { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 10px; font-size: 12px; color: var(--ink-2); }
.heat-ramp { display: inline-flex; align-items: center; gap: 6px; }
.heat-swatches { display: inline-flex; gap: 2px; }
.heat-swatch { display: inline-block; width: 14px; height: 12px; border-radius: 2px; }
.heat-swatch.heat-pending { width: 22px; text-align: center; line-height: 12px; }

/* -- States: loading, empty, not installed, errors ------------------------ */

.state {
  padding: 20px; border-radius: var(--radius);
  background: var(--surface); border: 1px solid var(--border);
}
.state h3 { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
.state p, .state ol { margin: 0 0 10px; color: var(--ink-2); max-width: 68ch; }
.state ol { padding-left: 20px; }
.state li + li { margin-top: 6px; }
.state code, .card code { font-family: var(--mono); font-size: 0.88em; overflow-wrap: anywhere; color: var(--ink); }
.state pre, pre.snippet {
  margin: 0 0 12px; padding: 12px; border-radius: 8px; background: var(--surface-2); color: var(--ink);
  font: 12.5px/1.5 var(--mono); overflow-x: auto; white-space: pre; max-width: 100%;
}
.state-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.loading { margin: 8px 0; color: var(--ink-2); font-size: 14px; }

/* -- Events --------------------------------------------------------------- */

.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 12px; margin-bottom: 12px; }
.filters .field { flex: 1 1 160px; }
.filters .field input { width: 100%; }
.load-more { margin-top: 12px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}

@media print {
  .tabs, .range, .csv-link, .load-more, .filters { display: none !important; }
  .section[hidden] { display: block !important; }
}
`;
