/**
 * The dashboard's browser code, served as `<basePath>/assets/dashboard.js`.
 *
 * Kept as a string of plain ES2020 so it ships with no build step and runs
 * under `script-src 'self'`. Inside the `String.raw` template there are no
 * backticks and no dollar-brace sequences, so the source below is exactly what
 * the browser receives; `__tests__/dashboard.test.ts` parses it and runs it
 * against fixtures in jsdom, since nothing else checks it.
 *
 * Rules the code follows:
 * - DOM is built with `createElement`, `createElementNS` and `textContent`
 *   only. Event names, paths, referrers, UTM values and channels come from
 *   the public ingest endpoint and are attacker-controlled; they never reach
 *   an HTML parser.
 * - No inline styles: dimensions are SVG attributes, colour is classes.
 * - No request but its own API, and no storage but the chosen range and tab.
 * - A `RateCell` that is `not_yet` or `empty` reads "Not yet" / "No data",
 *   never 0%.
 * - The formatters mirror `src/metrics/format.ts`.
 */

export const DASHBOARD_SCRIPT = String.raw`(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var STORAGE_KEY = "expo-analytics:dashboard";
  var DAY_MS = 86400000;
  var SECTIONS = ["overview", "product", "retention", "funnels", "acquisition", "web", "revenue", "events"];
  var PRESETS = ["7d", "30d", "90d", "month", "last_month", "custom"];
  var SERIES = ["s1", "s2", "s3"];
  var EVENTS_PAGE = 100;

  var state = {
    base: "",
    meta: null,
    range: { preset: "30d", from: "", to: "" },
    tab: "overview",
    audience: "all",
    retentionMode: "",
    eventFilters: { name: "", user: "" },
    cache: {},
    seq: {},
    draws: {},
    stopped: null
  };

  // -- DOM -----------------------------------------------------------------

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        node.setAttribute(name, String(attrs[name]));
      });
    }
    return node;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined || child === false) continue;
      if (Array.isArray(child)) {
        for (var j = 0; j < child.length; j++) append(parent, child[j]);
      } else {
        parent.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      }
    }
    return parent;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function code(text) {
    return el("code", null, text);
  }

  function srOnly(text) {
    return el("span", "sr-only", text);
  }

  function hiddenFromReaders(node) {
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function button(label, onClick, className) {
    var node = el("button", className || "button", label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function chip(label, pressed, onClick) {
    var node = button(label, onClick, "chip");
    node.setAttribute("aria-pressed", pressed ? "true" : "false");
    return node;
  }

  function byId(id) {
    return document.getElementById(id);
  }

  // -- Formatting (mirrors src/metrics/format.ts) --------------------------

  var countFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  var compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  var moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var moneyCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

  function fmtCount(value) {
    return typeof value === "number" && isFinite(value) ? countFormat.format(value) : "No data";
  }

  function fmtCents(cents) {
    return typeof cents === "number" && isFinite(cents) ? moneyFormat.format(cents / 100) : "No data";
  }

  function fmtSignedCents(cents) {
    if (cents === 0) return fmtCents(0);
    return (cents > 0 ? "+" : "\u2212") + fmtCents(Math.abs(cents));
  }

  function fmtPercent(rate, digits) {
    return (rate * 100).toFixed(digits === undefined ? 0 : digits) + "%";
  }

  function rateText(cell, digits) {
    if (!cell) return "No data";
    if (cell.status === "not_yet") return "Not yet";
    if (cell.status === "empty" || cell.rate === null || cell.rate === undefined) return "No data";
    return fmtPercent(cell.rate, digits);
  }

  function isMeasured(cell) {
    return !!cell && cell.status === "measured" && typeof cell.rate === "number";
  }

  function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined || !isFinite(seconds)) return "No data";
    var total = Math.max(0, Math.round(seconds));
    if (total < 60) return total + "s";
    var minutes = Math.floor(total / 60);
    if (minutes < 60) return minutes + "m " + String(total % 60).padStart(2, "0") + "s";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h " + String(minutes % 60).padStart(2, "0") + "m";
    return Math.floor(hours / 24) + "d " + (hours % 24) + "h";
  }

  function fmtDecimal(value, digits) {
    return value === null || value === undefined || !isFinite(value) ? "No data" : value.toFixed(digits);
  }

  function axisCount(max) {
    return function (value) {
      return max >= 10000 ? compactFormat.format(value) : countFormat.format(value);
    };
  }

  function axisCents(max) {
    return function (value) {
      if (max >= 1000000) return moneyCompact.format(value / 100);
      return max >= 10000 ? "$" + countFormat.format(Math.round(value / 100)) : fmtCents(value);
    };
  }

  // -- Dates ---------------------------------------------------------------

  var ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

  function dayMs(iso) {
    var match = ISO_DAY.exec(iso || "");
    return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : NaN;
  }

  function isoDay(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function validDay(iso) {
    var ms = dayMs(iso);
    return !isNaN(ms) && isoDay(ms) === iso;
  }

  function addDays(iso, days) {
    return isoDay(dayMs(iso) + days * DAY_MS);
  }

  function daysInclusive(from, to) {
    return Math.round((dayMs(to) - dayMs(from)) / DAY_MS) + 1;
  }

  var dayFormats = {};

  function dayFormat(key, options) {
    if (!dayFormats[key]) {
      options.timeZone = "UTC";
      dayFormats[key] = new Intl.DateTimeFormat("en-US", options);
    }
    return dayFormats[key];
  }

  function fmtDay(iso) {
    return dayFormat("md", { month: "short", day: "numeric" }).format(new Date(dayMs(iso)));
  }

  function fmtDayYear(iso) {
    return dayFormat("mdy", { month: "short", day: "numeric", year: "numeric" }).format(new Date(dayMs(iso)));
  }

  function fmtRange(from, to) {
    if (from === to) return fmtDayYear(from);
    return (from.slice(0, 4) === to.slice(0, 4) ? fmtDay(from) : fmtDayYear(from)) + " \u2013 " + fmtDayYear(to);
  }

  var instantFormat = null;

  function fmtInstant(iso) {
    if (!instantFormat) {
      var options = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" };
      try {
        options.timeZone = state.meta.timezone;
        instantFormat = new Intl.DateTimeFormat("en-US", options);
      } catch (error) {
        options.timeZone = "UTC";
        instantFormat = new Intl.DateTimeFormat("en-US", options);
      }
    }
    // Postgres sends microseconds; not every engine parses more than three digits.
    var date = new Date(String(iso).replace(/(\.\d{3})\d+/, "$1"));
    return isNaN(date.getTime()) ? String(iso) : instantFormat.format(date);
  }

  function presetRange(preset, today) {
    var monthStart = today.slice(0, 8) + "01";
    if (preset === "7d") return { from: addDays(today, -6), to: today };
    if (preset === "90d") return { from: addDays(today, -89), to: today };
    if (preset === "month") return { from: monthStart, to: today };
    if (preset === "last_month") {
      var lastDay = addDays(monthStart, -1);
      return { from: lastDay.slice(0, 8) + "01", to: lastDay };
    }
    return { from: addDays(today, -29), to: today };
  }

  function previousRange(range) {
    var days = daysInclusive(range.from, range.to);
    return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
  }

  // -- Saved view and URL --------------------------------------------------

  function loadSaved() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var saved = raw ? JSON.parse(raw) : null;
      return saved && typeof saved === "object" ? saved : null;
    } catch (error) {
      return null;
    }
  }

  function save() {
    try {
      var value = { preset: state.range.preset, tab: state.tab };
      if (state.range.preset === "custom") {
        value.from = state.range.from;
        value.to = state.range.to;
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      // Private windows and blocked storage: the view simply is not remembered.
    }
  }

  function writeUrl() {
    var params = new URLSearchParams(window.location.search);
    params.delete("range");
    params.delete("from");
    params.delete("to");
    if (state.range.preset === "custom") {
      params.set("from", state.range.from);
      params.set("to", state.range.to);
    } else {
      params.set("range", state.range.preset);
    }
    if (state.retentionMode) params.set("mode", state.retentionMode);
    else params.delete("mode");
    var query = params.toString();
    var url = window.location.pathname + (query ? "?" + query : "") + "#" + state.tab;
    try {
      window.history.replaceState(null, "", url);
    } catch (error) {
      // Sandboxed frames can refuse; the view still works.
    }
  }

  function initialRange(today) {
    var params = new URLSearchParams(window.location.search);
    var from = params.get("from");
    var to = params.get("to");
    if (validDay(from) && validDay(to) && from <= to) return { preset: "custom", from: from, to: to };
    var preset = params.get("range");
    var saved = loadSaved();
    if (!preset && saved && PRESETS.indexOf(saved.preset) !== -1) {
      if (saved.preset === "custom" && validDay(saved.from) && validDay(saved.to) && saved.from <= saved.to) {
        return { preset: "custom", from: saved.from, to: saved.to };
      }
      preset = saved.preset;
    }
    if (PRESETS.indexOf(preset) === -1 || preset === "custom") preset = "30d";
    var range = presetRange(preset, today);
    return { preset: preset, from: range.from, to: range.to };
  }

  function initialTab() {
    var hash = window.location.hash.replace(/^#/, "");
    if (SECTIONS.indexOf(hash) !== -1) return hash;
    var saved = loadSaved();
    return saved && SECTIONS.indexOf(saved.tab) !== -1 ? saved.tab : "overview";
  }

  // -- API -----------------------------------------------------------------

  function ApiError(kind, status, message) {
    this.kind = kind;
    this.status = status;
    this.message = message;
  }

  function queryString(params) {
    var search = new URLSearchParams();
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
    });
    var text = search.toString();
    return text ? "?" + text : "";
  }

  function apiUrl(path, params) {
    return state.base + "/api/" + path + queryString(params || {});
  }

  function api(path, params) {
    return window.fetch(apiUrl(path, params), {
      headers: { accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      // Admin routes answer 404 when the admin check fails: the session ended.
      if (response.status === 404) throw new ApiError("signed_out", 404, "");
      var type = response.headers.get("content-type") || "";
      if (type.indexOf("application/json") === -1) {
        throw new ApiError(response.redirected ? "signed_out" : "error", response.status, "The server answered with something other than report data (HTTP " + response.status + ").");
      }
      return response.json().then(function (body) {
        if (response.status === 409) throw new ApiError("not_installed", 409, "");
        if (response.status === 400) throw new ApiError("bad_request", 400, body && body.error ? String(body.error) : "The request was not accepted.");
        if (!response.ok) throw new ApiError("error", response.status, "The server could not build this report (HTTP " + response.status + ").");
        return body;
      });
    }, function () {
      throw new ApiError("network", 0, "The server could not be reached. Check the connection.");
    });
  }

  function rangeParams(extra) {
    var params = { from: state.range.from, to: state.range.to };
    if (extra) Object.keys(extra).forEach(function (key) { params[key] = extra[key]; });
    return params;
  }

  function csvUrl(report, extra) {
    var params = rangeParams(extra);
    params.format = "csv";
    return apiUrl(report, params);
  }

  function csvLink(report, extra, label) {
    var link = el("a", "csv-link", label || "Download CSV");
    link.href = csvUrl(report, extra);
    link.setAttribute("download", "");
    return link;
  }

  // -- Building blocks -----------------------------------------------------

  function card(title, sub, headExtra) {
    var node = el("div", "card");
    var head = el("div", "card-head");
    append(head, el("h3", null, title), headExtra || null);
    node.appendChild(head);
    if (sub) node.appendChild(el("p", "card-sub", sub));
    return node;
  }

  function groupTitle(text) {
    return el("h3", "group-title", text);
  }

  function tiles(list) {
    var grid = el("div", "tiles");
    append(grid, list);
    return grid;
  }

  /** options: { state: true when the value is a state word, delta: node, sub: text } */
  function tile(label, value, options) {
    options = options || {};
    var node = el("div", "tile");
    append(node, el("p", "tile-label", label), el("p", "tile-value" + (options.state ? " is-state" : ""), value));
    if (options.delta) node.appendChild(options.delta);
    if (options.sub) node.appendChild(el("p", "tile-sub", options.sub));
    return node;
  }

  function rateTile(label, cell, sub, delta) {
    return tile(label, rateText(cell, cell && cell.rate !== null && cell.rate < 0.1 ? 1 : 0), { state: !isMeasured(cell), sub: sub, delta: delta });
  }

  /**
   * Change against the previous period. Null previous: nothing to compare.
   * Colour follows direction and whether up is good, with an arrow and words
   * so it never rests on colour alone.
   */
  function delta(current, previous, upIsGood) {
    if (previous === null || previous === undefined || typeof current !== "number") return null;
    var node = el("p", "delta");
    if (previous === 0) {
      if (current === 0) node.textContent = "No change from the previous period";
      else {
        node.className = "delta " + (upIsGood === false ? "delta-down" : "delta-up");
        append(node, hiddenFromReaders(el("span", null, "\u25B2 ")), "Up from 0", el("span", "muted", " in the previous period"));
      }
      return node;
    }
    var change = (current - previous) / Math.abs(previous);
    if (Math.abs(change) < 0.005) {
      node.textContent = "No change from the previous period";
      return node;
    }
    var up = change > 0;
    var good = upIsGood === false ? !up : up;
    node.className = "delta " + (good ? "delta-up" : "delta-down");
    append(
      node,
      hiddenFromReaders(el("span", null, up ? "\u25B2 " : "\u25BC ")),
      srOnly(up ? "Up " : "Down "),
      fmtPercent(Math.abs(change), Math.abs(change) < 0.1 ? 1 : 0),
      el("span", "muted", " vs previous period")
    );
    return node;
  }

  function rateDelta(current, previous, upIsGood) {
    if (!isMeasured(current) || !isMeasured(previous)) return null;
    var points = (current.rate - previous.rate) * 100;
    var node = el("p", "delta");
    if (Math.abs(points) < 0.05) {
      node.textContent = "No change from the previous period";
      return node;
    }
    var up = points > 0;
    var good = upIsGood === false ? !up : up;
    node.className = "delta " + (good ? "delta-up" : "delta-down");
    append(
      node,
      hiddenFromReaders(el("span", null, up ? "\u25B2 " : "\u25BC ")),
      srOnly(up ? "Up " : "Down "),
      Math.abs(points).toFixed(1) + " pts",
      el("span", "muted", " vs previous period")
    );
    return node;
  }

  function statePanel(title, paragraphs, options) {
    options = options || {};
    var node = el("div", "state");
    node.appendChild(el("h3", null, title));
    (paragraphs || []).forEach(function (paragraph) {
      node.appendChild(typeof paragraph === "string" ? el("p", null, paragraph) : paragraph);
    });
    if (options.snippet) node.appendChild(el("pre", "snippet", options.snippet));
    if (options.actions && options.actions.length) {
      var row = el("div", "state-actions");
      append(row, options.actions);
      node.appendChild(row);
    }
    return node;
  }

  function paragraph() {
    var node = el("p");
    append.apply(null, [node].concat(Array.prototype.slice.call(arguments)));
    return node;
  }

  function simpleTable(columns, rows, className, caption) {
    var wrap = el("div", "table-wrap");
    var table = el("table", className || null);
    if (caption) table.appendChild(el("caption", "sr-only", caption));
    var head = el("thead");
    var headRow = el("tr");
    columns.forEach(function (column) {
      var th = el("th", column.num ? "num" : null, column.label);
      th.scope = "col";
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    var body = el("tbody");
    rows.forEach(function (row) {
      body.appendChild(tableRow(columns, row));
    });
    append(table, head, body);
    wrap.appendChild(table);
    return wrap;
  }

  function tableRow(columns, row) {
    var tr = el("tr");
    columns.forEach(function (column, index) {
      var value = row[index];
      var cell = el(index === 0 && column.rowHeader ? "th" : "td", (column.num ? "num " : "") + (column.mono ? "mono " : "") + (column.className || ""));
      if (index === 0 && column.rowHeader) cell.scope = "row";
      if (value !== null && typeof value === "object" && value.nodeType) cell.appendChild(value);
      else cell.textContent = value === null || value === undefined ? "\u2014" : String(value);
      tr.appendChild(cell);
    });
    return tr;
  }

  // -- Charts --------------------------------------------------------------

  /** Steps of 1, 2 or 5 times a power of ten, never below 1 (every series here is whole numbers). */
  function niceScale(max) {
    // Nothing to scale: a single baseline, rather than an axis of made-up steps.
    if (!(max > 0)) return { max: 1, ticks: [0] };
    var raw = max / 4;
    var power = Math.pow(10, Math.floor(Math.log10(raw)));
    var fraction = raw / power;
    var step = Math.max(1, (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power);
    var top = Math.ceil(max / step) * step;
    var ticks = [];
    for (var value = 0; value <= top + step / 2; value += step) ticks.push(value);
    return { max: top, ticks: ticks };
  }

  function chartSummary(options) {
    var dates = options.dates;
    var last = dates.length - 1;
    if (last < 0) return options.label;
    var parts = options.series.map(function (series) {
      return series.name + " " + options.format(series.values[last]);
    });
    var first = options.series[0];
    var peak = 0;
    first.values.forEach(function (value, index) {
      if (value > first.values[peak]) peak = index;
    });
    return options.label + ". On " + fmtDayYear(dates[last]) + ": " + parts.join(", ") + ". Highest " + first.name + ": " +
      options.format(first.values[peak]) + " on " + fmtDayYear(dates[peak]) + ". The table below lists every day.";
  }

  function dataDetails(options) {
    var details = el("details", "data");
    details.appendChild(el("summary", null, "Show the numbers"));
    var columns = [{ label: "Date", rowHeader: true }].concat(options.series.map(function (series) {
      return { label: series.name, num: true };
    }));
    var rows = options.dates.map(function (date, index) {
      return [fmtDayYear(date)].concat(options.series.map(function (series) {
        return options.format(series.values[index]);
      }));
    });
    details.appendChild(simpleTable(columns, rows, null, options.label));
    return details;
  }

  /**
   * A line chart over days: one axis, 2px lines, a crosshair that snaps to the
   * nearest day, and a readout above that doubles as the legend (values
   * lead, names follow). Drawn once the section is visible, and again on
   * resize, at the container's real width so text keeps its size.
   */
  function lineChart(options) {
    var figure = el("figure", "chart");
    var readout = el("ul", "readout");
    var plot = el("div", "plot");
    var dates = options.dates;
    var dateNode = el("li", "readout-date");
    readout.appendChild(dateNode);
    var valueNodes = options.series.map(function (series, index) {
      var item = el("li", "readout-item");
      var value = el("span", "readout-value");
      append(item, hiddenFromReaders(el("span", "key key-line " + SERIES[index])), value, el("span", "readout-name", series.name));
      readout.appendChild(item);
      return value;
    });
    function setReadout(index) {
      if (!dates.length) return;
      dateNode.textContent = fmtDayYear(dates[index]);
      options.series.forEach(function (series, i) {
        valueNodes[i].textContent = options.format(series.values[index]);
      });
    }
    setReadout(dates.length - 1);
    append(figure, readout, plot, dataDetails(options));
    queueDraw(function () {
      drawLines(plot, options, setReadout);
    });
    return figure;
  }

  function drawLines(plot, options, setReadout) {
    clear(plot);
    var dates = options.dates;
    var count = dates.length;
    if (!count) return;
    // A hidden or detached container measures 0; otherwise draw at the real width so text keeps its size.
    var width = plot.clientWidth > 0 ? plot.clientWidth : 320;
    var height = options.height || 180;
    var max = 0;
    options.series.forEach(function (series) {
      series.values.forEach(function (value) {
        if (value > max) max = value;
      });
    });
    var scale = niceScale(max);
    var tickFormat = (options.axis || axisCount)(scale.max);
    var tickLabels = scale.ticks.map(tickFormat);
    var widest = tickLabels.reduce(function (most, label) { return Math.max(most, label.length); }, 1);
    var margin = { top: 8, right: 8, bottom: 24, left: Math.min(64, 10 + widest * 6.5) };
    var innerWidth = width - margin.left - margin.right;
    var innerHeight = height - margin.top - margin.bottom;
    function x(index) {
      return margin.left + (count === 1 ? innerWidth / 2 : (index * innerWidth) / (count - 1));
    }
    function y(value) {
      return margin.top + innerHeight - (value / scale.max) * innerHeight;
    }
    var root = svg("svg", {
      width: width,
      height: height,
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      tabindex: 0,
      "aria-label": chartSummary(options)
    });

    scale.ticks.forEach(function (tick, index) {
      var ty = Math.round(y(tick)) + 0.5;
      root.appendChild(svg("line", { x1: margin.left, x2: width - margin.right, y1: ty, y2: ty, class: index === 0 ? "axis-line" : "grid-line" }));
      var label = svg("text", { x: margin.left - 6, y: ty, dy: "0.32em", "text-anchor": "end", class: "tick" });
      label.textContent = tickLabels[index];
      root.appendChild(label);
    });

    var slots = Math.max(2, Math.floor(innerWidth / 72));
    var step = Math.max(1, Math.ceil(count / slots));
    var labelled = [];
    for (var i = 0; i < count; i += step) labelled.push(i);
    if (count > 1) {
      if (count - 1 - labelled[labelled.length - 1] < step / 2 && labelled.length > 1) labelled[labelled.length - 1] = count - 1;
      else if (labelled[labelled.length - 1] !== count - 1) labelled.push(count - 1);
    }
    labelled.forEach(function (index, position) {
      var anchor = count === 1 ? "middle" : position === 0 ? "start" : index === count - 1 ? "end" : "middle";
      var label = svg("text", { x: x(index), y: height - 6, "text-anchor": anchor, class: "tick" });
      label.textContent = fmtDay(dates[index]);
      root.appendChild(label);
    });

    options.series.forEach(function (series, index) {
      var path = series.values.map(function (value, i) {
        return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(value || 0).toFixed(1);
      }).join(" ");
      if (options.area && options.series.length === 1 && count > 1) {
        root.appendChild(svg("path", {
          d: path + " L" + x(count - 1).toFixed(1) + " " + y(0).toFixed(1) + " L" + x(0).toFixed(1) + " " + y(0).toFixed(1) + " Z",
          class: "area " + SERIES[index]
        }));
      }
      if (count > 1) root.appendChild(svg("path", { d: path, class: "line " + SERIES[index] }));
      if (count === 1 || options.markers) {
        series.values.forEach(function (value, i) {
          root.appendChild(svg("circle", { cx: x(i), cy: y(value || 0), r: 4, class: "dot " + SERIES[index] }));
        });
      }
    });

    var cross = svg("g", { class: "is-hidden" });
    var line = svg("line", { x1: 0, x2: 0, y1: margin.top, y2: margin.top + innerHeight, class: "crosshair" });
    cross.appendChild(line);
    var dots = options.series.map(function (series, index) {
      var dot = svg("circle", { cx: 0, cy: 0, r: 4, class: "dot " + SERIES[index] });
      cross.appendChild(dot);
      return dot;
    });
    root.appendChild(cross);

    var current = count - 1;
    function moveTo(index) {
      current = Math.max(0, Math.min(count - 1, index));
      var cx = x(current);
      line.setAttribute("x1", String(cx));
      line.setAttribute("x2", String(cx));
      dots.forEach(function (dot, i) {
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", String(y(options.series[i].values[current] || 0)));
      });
      cross.setAttribute("class", "");
      setReadout(current);
    }
    function hide() {
      cross.setAttribute("class", "is-hidden");
      setReadout(count - 1);
    }
    root.addEventListener("pointermove", function (event) {
      var box = root.getBoundingClientRect();
      var px = event.clientX - box.left;
      moveTo(count === 1 ? 0 : Math.round(((px - margin.left) / innerWidth) * (count - 1)));
    });
    root.addEventListener("pointerleave", function (event) {
      // A finger lifting leaves the last value it touched on screen.
      if (event.pointerType === "mouse") hide();
    });
    root.addEventListener("focus", function () { moveTo(current); });
    root.addEventListener("blur", hide);
    root.addEventListener("keydown", function (event) {
      var next = event.key === "ArrowLeft" ? current - 1 : event.key === "ArrowRight" ? current + 1 :
        event.key === "Home" ? 0 : event.key === "End" ? count - 1 : null;
      if (next === null) return;
      event.preventDefault();
      moveTo(next);
    });
    plot.appendChild(root);
  }

  function barSvg(share, negative) {
    var pct = Math.max(0, Math.min(1, share || 0)) * 100;
    var root = svg("svg", { width: "100%", height: 8, focusable: "false" });
    if (pct > 0) {
      var cls = negative ? "bar-fill is-negative" : "bar-fill";
      root.appendChild(svg("rect", { x: 0, y: 0, width: pct.toFixed(2) + "%", height: 8, rx: 4, class: cls }));
      // Square at the baseline, rounded at the value end.
      root.appendChild(svg("rect", { x: 0, y: 0, width: Math.min(pct, 1.5).toFixed(2) + "%", height: 8, class: cls }));
    }
    return root;
  }

  /** rows: { label, value, figure, sub, mono, missing } ranked largest first by the caller. */
  function barList(rows, emptyText) {
    if (!rows.length) return el("p", "empty-line", emptyText || "Nothing in this period.");
    var max = rows.reduce(function (most, row) { return Math.max(most, row.value); }, 0);
    var list = el("ol", "bar-list");
    rows.forEach(function (row) {
      var item = el("li", "bar-row");
      var track = hiddenFromReaders(el("span", "bar-track"));
      track.appendChild(barSvg(max > 0 ? row.value / max : 0, row.negative));
      append(
        item,
        el("span", "bar-label" + (row.mono ? " mono" : "") + (row.missing ? " muted" : ""), row.label),
        el("span", "bar-figure", row.figure),
        track
      );
      if (row.sub) item.appendChild(el("span", "bar-sub", row.sub));
      list.appendChild(item);
    });
    return list;
  }

  /** Signed values around a centre line: gains right in blue, losses left in red. */
  function divergingList(rows) {
    var max = rows.reduce(function (most, row) { return Math.max(most, Math.abs(row.value)); }, 0);
    var list = el("ol", "bar-list");
    rows.forEach(function (row) {
      var item = el("li", "bar-row");
      var track = hiddenFromReaders(el("span", "bar-track"));
      var root = svg("svg", { width: "100%", height: 10, focusable: "false" });
      root.appendChild(svg("line", { x1: "50%", x2: "50%", y1: 0, y2: 10, class: "axis-line" }));
      var half = max > 0 ? (Math.abs(row.value) / max) * 50 : 0;
      if (half > 0) {
        root.appendChild(svg("rect", {
          x: (row.value >= 0 ? 50 : 50 - half).toFixed(2) + "%",
          y: 1,
          width: half.toFixed(2) + "%",
          height: 8,
          rx: 2,
          class: row.value >= 0 ? "bar-fill" : "bar-fill is-negative"
        }));
      }
      track.appendChild(root);
      append(item, el("span", "bar-label", row.label), el("span", "bar-figure", row.figure), track);
      list.appendChild(item);
    });
    return list;
  }

  function queueDraw(fn) {
    (state.draws[state.drawing] = state.draws[state.drawing] || []).push(fn);
  }

  function runDraws(id) {
    (state.draws[id] || []).forEach(function (fn) {
      try {
        fn();
      } catch (error) {
        // One chart failing to draw must not blank the section.
      }
    });
  }

  // -- Shared pieces -------------------------------------------------------

  function audienceToggle(onChange) {
    var row = el("div", "toolbar");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Who counts as active");
    append(row, el("span", "toolbar-label", "Active users:"),
      chip("Everyone", state.audience === "all", function () { setAudience("all", onChange); }),
      chip("Signed in", state.audience === "signed_in", function () { setAudience("signed_in", onChange); }));
    return row;
  }

  function setAudience(value, rerender) {
    if (state.audience === value) return;
    state.audience = value;
    rerender();
  }

  function modeWords(mode, day) {
    if (mode === "on") return "active on day " + day;
    if (mode === "on_or_after") return "active on day " + day + " or later";
    return "active on days " + day + "\u2013" + (day + 6);
  }

  function retentionSub(headline) {
    var cell = headline.cell;
    if (cell.status === "measured") {
      return fmtCount(cell.numerator) + " of " + fmtCount(cell.denominator) + " users" +
        (headline.pending ? " \u00B7 " + fmtCount(headline.pending) + " still inside the window" : "");
    }
    if (cell.status === "not_yet") return fmtCount(headline.pending) + " users still inside the window";
    return "No users first seen in this period";
  }

  function retentionTiles(headlines) {
    return tiles(headlines.map(function (headline) {
      return rateTile("Day " + headline.day + " retention", headline.cell, modeWords(headline.mode, headline.day) + ". " + retentionSub(headline));
    }));
  }

  function inlineCode(parts) {
    var node = el("p");
    parts.forEach(function (part) {
      node.appendChild(part && part.code ? code(part.code) : document.createTextNode(String(part)));
    });
    return node;
  }

  function ingestUrl() {
    return window.location.origin + state.base + "/e";
  }

  // -- Overview ------------------------------------------------------------

  function renderOverview(body, report, rerender) {
    var active = report.active_users[state.audience];
    var nothing = report.active_users.all.mau.current === 0 && report.new_users.current === 0 &&
      report.web.visitors.current === 0 && report.revenue.mrr_cents.current === 0 &&
      report.revenue.gross_cents.current === 0 && report.revenue.active_subscriptions.current === 0;
    if (nothing) {
      var steps = el("ol");
      append(steps,
        append(el("li"), "Send events from the app or site with ", code("createNativeTracker"), " or ", code("createWebTracker"), ", endpoint ", code(ingestUrl()), "."),
        append(el("li"), "Tell the server who signed up: ", code("server.identify(userId, { createdAt })"), " when an account is created."),
        append(el("li"), "Record purchases from your billing webhook with ", code("server.recordRevenueEvents(rows)"), "."));
      body.appendChild(statePanel("Nothing recorded in this period", [
        "Figures appear here as soon as your app sends events. On a new install, these three calls bring in the first numbers:",
        steps,
        "Already sending events? They may fall outside this range."
      ], { actions: state.range.preset === "90d" ? [] : [button("Show the last 90 days", function () { setPreset("90d"); }, "button secondary")] }));
      return;
    }
    body.appendChild(audienceToggle(rerender));
    body.appendChild(groupTitle("Active users on " + fmtDayYear(report.range.to)));
    body.appendChild(tiles([
      tile("Daily active", fmtCount(active.dau.current), { delta: delta(active.dau.current, active.dau.previous) }),
      tile("Weekly active", fmtCount(active.wau.current), { delta: delta(active.wau.current, active.wau.previous) }),
      tile("Monthly active", fmtCount(active.mau.current), { delta: delta(active.mau.current, active.mau.previous) })
    ]));
    body.appendChild(groupTitle("Growth"));
    body.appendChild(tiles([
      tile("New users", fmtCount(report.new_users.current), { delta: delta(report.new_users.current, report.new_users.previous) }),
      tile("Web visitors", fmtCount(report.web.visitors.current), { delta: delta(report.web.visitors.current, report.web.visitors.previous) }),
      tile("Pageviews", fmtCount(report.web.pageviews.current), { delta: delta(report.web.pageviews.current, report.web.pageviews.previous) })
    ]));
    body.appendChild(groupTitle("Revenue"));
    var revenue = report.revenue;
    body.appendChild(tiles([
      tile("MRR", fmtCents(revenue.mrr_cents.current), { delta: delta(revenue.mrr_cents.current, revenue.mrr_cents.previous), sub: "At the end of the period" }),
      tile("Active subscriptions", fmtCount(revenue.active_subscriptions.current), { delta: delta(revenue.active_subscriptions.current, revenue.active_subscriptions.previous) }),
      tile("Gross revenue", fmtCents(revenue.gross_cents.current), { delta: delta(revenue.gross_cents.current, revenue.gross_cents.previous) }),
      tile("Net revenue", fmtCents(revenue.net_cents.current), { delta: delta(revenue.net_cents.current, revenue.net_cents.previous), sub: "After refunds" })
    ]));
    if (report.retention.length) {
      body.appendChild(groupTitle("Retention of users first seen in this period"));
      body.appendChild(retentionTiles(report.retention));
    }
  }

  // -- Product -------------------------------------------------------------

  function renderProduct(body, report, rerender) {
    var variant = report.active_users[state.audience];
    var dates = variant.series.map(function (point) { return point.date; });
    body.appendChild(audienceToggle(rerender));
    var activeCard = card("Active users", state.audience === "all" ? "Everyone, including devices that never signed in." : "Users on events that carried a user id.");
    activeCard.appendChild(lineChart({
      label: "Active users per day",
      dates: dates,
      format: fmtCount,
      series: [
        { name: "Daily", values: variant.series.map(function (p) { return p.dau; }) },
        { name: "Weekly", values: variant.series.map(function (p) { return p.wau; }) },
        { name: "Monthly", values: variant.series.map(function (p) { return p.mau; }) }
      ]
    }));
    body.appendChild(activeCard);

    var list = [
      rateTile("Stickiness", variant.stickiness, "Average daily active users \u00F7 monthly active users on the last day"),
      tile("New users", fmtCount(report.new_users.total), { sub: "First seen in this period" })
    ];
    var activation = report.activation;
    if (activation) {
      list.push(rateTile("Activation", activation.rate,
        fmtCount(activation.activated) + " of " + fmtCount(activation.signups - activation.pending) + " sign-ups did " + activation.event +
        " within " + activation.within_days + " days" + (activation.pending ? " \u00B7 " + fmtCount(activation.pending) + " still inside the window" : "")));
    }
    body.appendChild(groupTitle("This period"));
    body.appendChild(tiles(list));

    var newCard = card("New users per day", "Users first seen on each day.");
    newCard.appendChild(lineChart({
      label: "New users per day",
      dates: report.new_users.series.map(function (d) { return d.date; }),
      format: fmtCount,
      area: true,
      series: [{ name: "New users", values: report.new_users.series.map(function (d) { return d.count; }) }]
    }));
    body.appendChild(newCard);

    if (!activation) {
      var setup = card("Activation", null);
      setup.appendChild(paragraph("Activation is not set up. Name the event that means a new user got value, and the rate appears here and in Acquisition:"));
      setup.appendChild(el("pre", "snippet", "createAnalyticsServer({\n  // ...\n  metrics: { activation: { event: \"project_created\", withinDays: 7 } },\n})"));
      body.appendChild(setup);
    }
  }

  // -- Retention -----------------------------------------------------------

  var MODES = [
    { id: "", label: "Default" },
    { id: "on", label: "On day N" },
    { id: "on_or_after", label: "Day N or later" },
    { id: "bracket", label: "Days N to N+6" }
  ];

  function heatClass(rate) {
    return "heat-" + Math.max(0, Math.min(9, Math.floor(rate * 10)));
  }

  function heatTable(weekly) {
    var wrap = el("div", "table-wrap");
    var table = el("table", "heat");
    table.appendChild(el("caption", "sr-only", "Weekly retention: the share of each weekly sign-up cohort active in each week after first seen"));
    var head = el("thead");
    var headRow = el("tr");
    var corner = el("th", "row-head", "Cohort");
    corner.scope = "col";
    var sizeHead = el("th", "size", "Users");
    sizeHead.scope = "col";
    append(headRow, corner, sizeHead);
    var weeks = weekly.length ? weekly[0].weeks.length : 13;
    for (var w = 0; w < weeks; w++) {
      var th = el("th", null, "W" + w);
      th.scope = "col";
      th.title = "Week " + w + " after first seen";
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    var body = el("tbody");
    weekly.forEach(function (cohort) {
      var row = el("tr");
      var label = el("th", "row-head");
      label.scope = "row";
      append(label, cohort.label, el("span", "muted", fmtDay(cohort.start)));
      append(row, label, el("td", "size num", fmtCount(cohort.size)));
      cohort.weeks.forEach(function (cell, week) {
        var td;
        if (cell.status === "measured") {
          td = el("td", "heat-cell " + heatClass(cell.rate), fmtPercent(cell.rate));
          td.title = "Week " + week + ": " + fmtCount(cell.numerator) + " of " + fmtCount(cell.denominator) + " users";
        } else if (cell.status === "not_yet") {
          td = el("td", "heat-cell heat-pending");
          append(td, hiddenFromReaders(el("span", null, "\u2026")), srOnly("Not yet"));
          td.title = "Week " + week + ": not over yet";
        } else {
          td = el("td", "heat-cell heat-empty");
          append(td, hiddenFromReaders(el("span", null, "\u2013")), srOnly("No data"));
        }
        row.appendChild(td);
      });
      body.appendChild(row);
    });
    append(table, head, body);
    wrap.appendChild(table);
    return wrap;
  }

  function heatKey() {
    var key = el("div", "heat-key");
    var ramp = el("span", "heat-ramp");
    var swatches = hiddenFromReaders(el("span", "heat-swatches"));
    for (var i = 0; i < 10; i++) swatches.appendChild(el("span", "heat-swatch heat-" + i));
    append(ramp, "0%", swatches, "100%");
    var pending = el("span", "heat-ramp");
    append(pending, hiddenFromReaders(el("span", "heat-swatch heat-pending", "\u2026")), "Week not over yet");
    append(key, ramp, pending);
    return key;
  }

  function renderRetention(body, report) {
    var row = el("div", "toolbar");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Retention counted as");
    row.appendChild(el("span", "toolbar-label", "Count as:"));
    MODES.forEach(function (mode) {
      row.appendChild(chip(mode.label, state.retentionMode === mode.id, function () {
        if (state.retentionMode === mode.id) return;
        state.retentionMode = mode.id;
        writeUrl();
        loadSection("retention");
      }));
    });
    body.appendChild(row);

    var anyone = report.weekly.some(function (c) { return c.size > 0; }) || report.cohorts.some(function (c) { return c.size > 0; });
    if (!anyone) {
      body.appendChild(statePanel("No sign-ups to follow yet", [
        inlineCode(["Retention follows users from the day they were first seen. Users appear once the server knows them: call ", { code: "server.identify(userId, { createdAt })" }, " at sign-up, or send events with a signed-in user."])
      ]));
      return;
    }
    body.appendChild(retentionTiles(report.headline));

    var weekly = card("Weekly cohorts", "Users first seen in each week, and the share active in each week after. A week still running is marked rather than counted.");
    weekly.appendChild(heatTable(report.weekly));
    weekly.appendChild(heatKey());
    body.appendChild(weekly);

    var daily = card("Daily cohorts", "One row per day of the period.");
    var details = el("details", "data");
    details.appendChild(el("summary", null, "Show the daily cohorts"));
    var columns = [{ label: "First seen", rowHeader: true }, { label: "Users", num: true }].concat(report.days.map(function (day) {
      return { label: "Day " + day, num: true };
    }));
    details.appendChild(simpleTable(columns, report.cohorts.map(function (cohort) {
      return [fmtDayYear(cohort.cohort), fmtCount(cohort.size)].concat(cohort.cells.map(function (cell) {
        return rateText(cell.cell);
      }));
    }), null, "Daily cohorts"));
    daily.appendChild(details);
    body.appendChild(daily);
  }

  // -- Funnels -------------------------------------------------------------

  var FUNNEL_SNIPPET = "createAnalyticsServer({\n  // ...\n  metrics: {\n    funnels: [\n      { key: \"onboarding\", name: \"Onboarding\", steps: [\"signup_started\", \"profile_completed\", \"project_created\"], windowDays: 7 },\n    ],\n  },\n})";

  function renderFunnels(body, report) {
    if (!report.funnels.length) {
      body.appendChild(statePanel("No funnels configured", [
        "A funnel is an ordered list of events. Add one to the server config and its steps appear here with counts, conversion and the time between steps:"
      ], { snippet: FUNNEL_SNIPPET }));
      return;
    }
    report.funnels.forEach(function (funnel) {
      var node = card(funnel.name, "Steps in order, within " + funnel.window_days + " days of the first." +
        (funnel.open ? " " + fmtCount(funnel.open) + " still inside their window and may finish later steps." : ""));
      var entered = funnel.steps.length ? funnel.steps[0].actors : 0;
      if (!entered) {
        node.appendChild(el("p", "empty-line", "Nobody entered this funnel in the period."));
      } else {
        node.appendChild(barList(funnel.steps.map(function (step, index) {
          var sub;
          if (index === 0) sub = "Entered the funnel";
          else {
            sub = rateText(step.from_first) + " of entrants \u00B7 " + rateText(step.from_previous) + " of the step before";
            if (step.median_seconds_from_previous !== null) sub += " \u00B7 median " + fmtDuration(step.median_seconds_from_previous) + " later";
          }
          return { label: (index + 1) + ". " + step.step, value: step.actors, figure: fmtCount(step.actors), sub: sub, mono: true };
        })));
      }
      body.appendChild(node);
    });
  }

  // -- Acquisition ---------------------------------------------------------

  function renderAcquisition(body, report) {
    var channels = card("Channels", "Link clicks in the period, and what the users who signed up in it went on to do.");
    if (!report.channels.length) {
      channels.appendChild(el("p", "empty-line", "No sign-ups or link clicks in this period."));
    } else {
      var activationOff = report.channels.every(function (row) { return row.activated === null; });
      channels.appendChild(simpleTable([
        { label: "Channel", mono: true, rowHeader: true },
        { label: "Link clicks", num: true },
        { label: "Sign-ups", num: true },
        { label: "Activated", num: true },
        { label: "Trial started", num: true },
        { label: "Paid", num: true }
      ], report.channels.map(function (row) {
        return [row.channel, fmtCount(row.link_clicks), fmtCount(row.signups), row.activated === null ? null : fmtCount(row.activated), fmtCount(row.trial_started), fmtCount(row.paid)];
      }), null, "Channels"));
      if (activationOff) channels.appendChild(el("p", "card-sub", "Activated shows \u2014 because no activation event is configured."));
    }
    body.appendChild(channels);

    var grid = el("div", "cards");
    var platforms = card("Sign-ups by platform", null);
    platforms.appendChild(barList(report.signups_by_platform.map(function (row) {
      return { label: row.key, value: row.count, figure: fmtCount(row.count), mono: true };
    }), "No sign-ups in this period."));
    grid.appendChild(platforms);
    var clicks = card("Link clicks by channel", state.meta && !state.meta.links ? "Tracked links are not configured (the links option)." : null);
    clicks.appendChild(barList(report.link_clicks_by_channel.map(function (row) {
      return { label: row.key, value: row.count, figure: fmtCount(row.count), mono: true };
    }), "No link clicks in this period."));
    grid.appendChild(clicks);
    body.appendChild(grid);
  }

  // -- Web -----------------------------------------------------------------

  var BREAKDOWNS = [
    { id: "pages", label: "Pages", missing: "(no path)" },
    { id: "entry_pages", label: "Entry pages", missing: "(no path)" },
    { id: "exit_pages", label: "Exit pages", missing: "(no path)" },
    { id: "referrers", label: "Referrers", missing: "(none)" },
    { id: "utm_sources", label: "UTM sources", missing: "(none)" },
    { id: "utm_campaigns", label: "UTM campaigns", missing: "(none)" },
    { id: "devices", label: "Devices", missing: "(unknown)" },
    { id: "browsers", label: "Browsers", missing: "(unknown)" },
    { id: "os", label: "Operating systems", missing: "(unknown)" },
    { id: "countries", label: "Countries", missing: "(unknown)" }
  ];

  function renderWeb(body, report) {
    var totals = report.totals;
    var previous = report.previous;
    if (totals.visits === 0 && previous.visits === 0) {
      body.appendChild(statePanel("No web traffic in this period", [
        inlineCode(["Web figures come from sessions the web tracker opens. Add ", { code: "createWebTracker({ endpoint: \"" + ingestUrl() + "\" })" }, " to your site and pageviews start arriving."])
      ]));
      return;
    }
    body.appendChild(tiles([
      tile("Visitors", fmtCount(totals.visitors), { delta: delta(totals.visitors, previous.visitors) }),
      tile("Visits", fmtCount(totals.visits), { delta: delta(totals.visits, previous.visits) }),
      tile("Pageviews", fmtCount(totals.pageviews), { delta: delta(totals.pageviews, previous.pageviews) }),
      tile("Views per visit", fmtDecimal(totals.views_per_visit, 1), {
        state: totals.views_per_visit === null,
        delta: totals.views_per_visit === null || previous.views_per_visit === null ? null : delta(totals.views_per_visit, previous.views_per_visit)
      }),
      rateTile("Bounce rate", totals.bounce_rate, "One page or less, no other events", rateDelta(totals.bounce_rate, previous.bounce_rate, false)),
      tile("Average visit", fmtDuration(totals.avg_visit_seconds), {
        state: totals.avg_visit_seconds === null,
        delta: totals.avg_visit_seconds === null || previous.avg_visit_seconds === null ? null : delta(totals.avg_visit_seconds, previous.avg_visit_seconds)
      })
    ]));
    var trend = card("Traffic per day", "Previous period: " + fmtRange(previous.range.from, previous.range.to) + ".");
    trend.appendChild(lineChart({
      label: "Web traffic per day",
      dates: report.series.map(function (p) { return p.date; }),
      format: fmtCount,
      series: [
        // Visits are left off the plot: they track visitors so closely that the
        // two lines cover each other. The Visits tile above carries the total.
        { name: "Visitors", values: report.series.map(function (p) { return p.visitors; }) },
        { name: "Pageviews", values: report.series.map(function (p) { return p.pageviews; }) }
      ]
    }));
    body.appendChild(trend);

    var grid = el("div", "cards");
    BREAKDOWNS.forEach(function (breakdown) {
      var rows = report.breakdowns[breakdown.id] || [];
      var node = card(breakdown.label, null, rows.length ? csvLink("web", { table: breakdown.id }, "CSV") : null);
      node.appendChild(barList(rows.map(function (row) {
        return {
          label: row.key === null ? breakdown.missing : row.key,
          missing: row.key === null,
          mono: row.key !== null && breakdown.id !== "devices" && breakdown.id !== "browsers" && breakdown.id !== "os",
          value: row.visitors,
          figure: fmtCount(row.visitors) + (row.visitors === 1 ? " visitor" : " visitors"),
          sub: fmtCount(row.pageviews) + (row.pageviews === 1 ? " pageview" : " pageviews")
        };
      }), "Nothing recorded in this period."));
      grid.appendChild(node);
    });
    body.appendChild(grid);
  }

  // -- Revenue -------------------------------------------------------------

  var EVENT_TYPE_LABELS = {
    trial_started: "Trials started",
    trial_converted: "Trials converted",
    purchased: "Purchases",
    renewed: "Renewals",
    cancel_scheduled: "Cancellations scheduled",
    uncanceled: "Cancellations undone",
    expired: "Expirations",
    billing_issue: "Billing issues",
    refunded: "Refunds",
    refund_reversed: "Refunds reversed",
    product_changed: "Plan changes",
    reactivated: "Reactivations"
  };

  function renderRevenue(body, report) {
    var counts = report.event_counts || {};
    var anyEvents = Object.keys(counts).some(function (key) { return counts[key] > 0; });
    var mrr = report.mrr;
    if (!anyEvents && mrr.current_cents === 0 && mrr.at_range_start_cents === 0 && report.subscriptions.active_trials === 0) {
      body.appendChild(statePanel("No revenue recorded", [
        inlineCode(["Revenue comes from the ledger your billing webhook writes. Send each purchase, renewal, refund and cancellation with ", { code: "server.recordRevenueEvents(rows)" }, "; a ", { code: "@mrmeg/expo-purchases" }, " ledger row fits as is."])
      ]));
      return;
    }
    var trials = report.trial_conversion;
    var churn = report.churn;
    body.appendChild(groupTitle("Recurring revenue"));
    body.appendChild(tiles([
      tile("MRR", fmtCents(mrr.current_cents), { delta: delta(mrr.current_cents, mrr.at_range_start_cents), sub: "At the end of the period, against its start" }),
      tile("Net new MRR", fmtSignedCents(mrr.movements.net_new_cents), { sub: "New + expansion \u2212 contraction \u2212 churned" }),
      tile("Active subscriptions", fmtCount(report.subscriptions.active_paid), { delta: delta(report.subscriptions.active_paid, report.subscriptions.paid_at_range_start), sub: "Paying at the end of the period" }),
      tile("Active trials", fmtCount(report.subscriptions.active_trials), { sub: "At the end of the period" })
    ]));
    body.appendChild(groupTitle("Conversion and churn"));
    body.appendChild(tiles([
      rateTile("Trial conversion", trials.cell, fmtCount(trials.converted) + " of " + fmtCount(trials.started) + " trials started" +
        (trials.pending ? " \u00B7 " + fmtCount(trials.pending) + " still running" : "")),
      rateTile("Customer churn", churn.customer, fmtCount(churn.customer.numerator) + " of " + fmtCount(churn.customer.denominator) + " paying at the start stopped"),
      rateTile("Revenue churn", churn.revenue, fmtCents(churn.revenue.numerator) + " of " + fmtCents(churn.revenue.denominator) + " MRR lost")
    ]));
    body.appendChild(groupTitle("Revenue in the period"));
    body.appendChild(tiles([
      tile("Gross revenue", fmtCents(report.revenue.gross_cents)),
      tile("Refunds", fmtCents(report.revenue.refunds_cents)),
      tile("Net revenue", fmtCents(report.revenue.net_cents), { sub: "Gross minus refunds" })
    ]));

    var movements = card("MRR movements", "From the start of the period to its end.");
    movements.appendChild(divergingList([
      { label: "New", value: mrr.movements.new_cents, figure: fmtSignedCents(mrr.movements.new_cents) },
      { label: "Expansion", value: mrr.movements.expansion_cents, figure: fmtSignedCents(mrr.movements.expansion_cents) },
      { label: "Contraction", value: -mrr.movements.contraction_cents, figure: fmtSignedCents(-mrr.movements.contraction_cents) },
      { label: "Churned", value: -mrr.movements.churned_cents, figure: fmtSignedCents(-mrr.movements.churned_cents) },
      { label: "Net new", value: mrr.movements.net_new_cents, figure: fmtSignedCents(mrr.movements.net_new_cents) }
    ]));
    var grid = el("div", "cards");
    grid.appendChild(movements);

    var monthEnds = card("MRR at month ends", null);
    if (mrr.month_ends.length >= 2) {
      monthEnds.appendChild(lineChart({
        label: "MRR at each month end",
        dates: mrr.month_ends.map(function (p) { return p.date; }),
        format: fmtCents,
        axis: axisCents,
        markers: true,
        series: [{ name: "MRR", values: mrr.month_ends.map(function (p) { return p.mrr_cents; }) }]
      }));
    } else if (mrr.month_ends.length === 1) {
      monthEnds.appendChild(simpleTable([{ label: "Month end", rowHeader: true }, { label: "MRR", num: true }],
        [[fmtDayYear(mrr.month_ends[0].date), fmtCents(mrr.month_ends[0].mrr_cents)]], null, "MRR at month ends"));
    } else {
      monthEnds.appendChild(el("p", "empty-line", "No month ends in this period. Pick a longer range to see MRR month by month."));
    }
    grid.appendChild(monthEnds);

    var ledger = card("Ledger events", "Rows recorded in the period, by type.", csvLink("revenue", { table: "event_counts" }, "CSV"));
    ledger.appendChild(simpleTable([{ label: "Event", rowHeader: true }, { label: "Count", num: true }], Object.keys(EVENT_TYPE_LABELS).map(function (key) {
      return [EVENT_TYPE_LABELS[key], fmtCount(counts[key] || 0)];
    }), null, "Ledger events by type"));
    grid.appendChild(ledger);

    var reasons = card("Cancellations by reason", null);
    reasons.appendChild(barList(report.cancellations_by_reason.map(function (row) {
      return { label: row.key, value: row.count, figure: fmtCount(row.count), mono: true };
    }), "No cancellations scheduled in this period."));
    grid.appendChild(reasons);
    body.appendChild(grid);
  }

  // -- Events --------------------------------------------------------------

  var EVENT_COLUMNS = [
    { label: "Time", className: "when" },
    { label: "Event", mono: true },
    { label: "User", mono: true },
    { label: "Platform" },
    { label: "Path", mono: true },
    { label: "Properties", mono: true, className: "props" }
  ];

  function eventCells(event) {
    var who = event.user_id ? event.user_id : event.anonymous_id ? "anon " + event.anonymous_id : null;
    var props = null;
    if (event.properties && typeof event.properties === "object") {
      var json = JSON.stringify(event.properties);
      props = el("span", null, json.length > 160 ? json.slice(0, 159) + "\u2026" : json);
      if (json.length > 160) props.title = json;
    }
    return [fmtInstant(event.occurred_at), event.name, who, event.platform, event.path, props];
  }

  function renderEvents(body, page) {
    var filters = state.eventFilters;
    var form = el("form", "filters");
    form.setAttribute("role", "search");
    form.setAttribute("aria-label", "Filter events");
    function field(label, name, value, placeholder) {
      var wrap = el("label", "field");
      var input = el("input");
      input.name = name;
      input.value = value;
      input.placeholder = placeholder;
      input.autocomplete = "off";
      input.spellcheck = false;
      append(wrap, el("span", null, label), input);
      return wrap;
    }
    append(form,
      field("Event name", "name", filters.name, "e.g. project_created"),
      field("User id", "user", filters.user, "exact id"),
      append(el("div", "state-actions"), el("button", "button", "Filter"),
        button("Clear", function () {
          state.eventFilters = { name: "", user: "" };
          loadSection("events");
        }, "button secondary")));
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      state.eventFilters = { name: form.elements.namedItem("name").value.trim(), user: form.elements.namedItem("user").value.trim() };
      loadSection("events");
    });
    body.appendChild(form);

    if (!page.events.length) {
      body.appendChild(el("p", "empty-line", filters.name || filters.user ? "No events match these filters in this period." : "No events in this period."));
      return;
    }
    var wrap = simpleTable(EVENT_COLUMNS, page.events.map(eventCells), "events-table", "Raw events, newest first");
    body.appendChild(wrap);
    var tbody = wrap.querySelector("tbody");
    var status = el("p", "card-sub", "");
    status.setAttribute("aria-live", "polite");
    var next = page.next_before;
    var more = button("Load more", function () {
      more.disabled = true;
      more.textContent = "Loading\u2026";
      api("events", rangeParams({ name: filters.name, user: filters.user, limit: EVENTS_PAGE, before: next })).then(function (older) {
        older.events.forEach(function (event) { tbody.appendChild(tableRow(EVENT_COLUMNS, eventCells(event))); });
        next = older.next_before;
        status.textContent = "Loaded " + older.events.length + " more.";
        more.disabled = false;
        more.textContent = "Load more";
        if (!next) more.hidden = true;
      }, function (error) {
        if (error.kind === "signed_out") return signedOut();
        more.disabled = false;
        more.textContent = "Try loading more again";
        status.textContent = error.message || "Loading more failed.";
      });
    }, "button secondary load-more");
    if (!next) more.hidden = true;
    append(body, more, status);
  }

  // -- Sections ------------------------------------------------------------

  var DEFS = {
    overview: { load: function () { return api("overview", rangeParams()); }, csv: function () { return csvUrl("overview"); }, render: renderOverview },
    product: { load: function () { return api("product", rangeParams()); }, csv: function () { return csvUrl("product"); }, render: renderProduct },
    retention: {
      key: function () { return state.retentionMode; },
      load: function () { return api("retention", rangeParams({ mode: state.retentionMode })); },
      csv: function () { return csvUrl("retention", { mode: state.retentionMode }); },
      render: renderRetention
    },
    funnels: {
      load: function () { return api("funnels", rangeParams()); },
      csv: function (data) { return data.funnels.length ? csvUrl("funnels") : null; },
      render: renderFunnels
    },
    acquisition: { load: function () { return api("acquisition", rangeParams()); }, csv: function () { return csvUrl("acquisition"); }, render: renderAcquisition },
    web: { load: function () { return api("web", rangeParams()); }, csv: function () { return csvUrl("web"); }, render: renderWeb },
    revenue: { load: function () { return api("revenue", rangeParams()); }, csv: function () { return csvUrl("revenue"); }, render: renderRevenue },
    events: {
      key: function () { return state.eventFilters.name + "|" + state.eventFilters.user; },
      load: function () { return api("events", rangeParams({ name: state.eventFilters.name, user: state.eventFilters.user, limit: EVENTS_PAGE })); },
      csv: function () { return csvUrl("events", { name: state.eventFilters.name, user: state.eventFilters.user }); },
      render: renderEvents
    }
  };

  function sectionNode(id) {
    return byId("section-" + id);
  }

  function part(id, name) {
    return sectionNode(id).querySelector("[data-" + name + "]");
  }

  function cacheKey(id) {
    var def = DEFS[id];
    return id + "|" + state.range.from + "|" + state.range.to + "|" + (def.key ? def.key() : "");
  }

  function render(id, data) {
    var body = part(id, "body");
    clear(body);
    body.classList.remove("is-loading");
    body.removeAttribute("aria-busy");
    state.draws[id] = [];
    state.drawing = id;
    DEFS[id].render(body, data, function () { render(id, data); });
    var notes = part(id, "notes");
    clear(notes);
    (data.notes || []).forEach(function (note) { notes.appendChild(el("li", null, note)); });
    var link = part(id, "csv");
    var href = DEFS[id].csv(data);
    if (href) {
      link.href = href;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
    if (!sectionNode(id).hidden) runDraws(id);
  }

  function renderProblem(id, error) {
    var body = part(id, "body");
    clear(body);
    body.classList.remove("is-loading");
    body.removeAttribute("aria-busy");
    clear(part(id, "notes"));
    part(id, "csv").hidden = true;
    var title = document.getElementById("h-" + id).textContent;
    if (error.kind === "signed_out") {
      signedOut();
      body.appendChild(signedOutPanel());
    } else if (error.kind === "not_installed") {
      body.appendChild(notInstalledPanel());
    } else if (error.kind === "bad_request") {
      body.appendChild(statePanel("This range can\u2019t be shown", [error.message], {
        actions: [button("Show the last 30 days", function () { setPreset("30d"); })]
      }));
    } else {
      body.appendChild(statePanel(title + " didn\u2019t load", [error.message || "Something went wrong while loading."], {
        actions: [button("Try again", function () { loadSection(id, true); })]
      }));
    }
  }

  function signedOutPanel() {
    return statePanel("You\u2019re signed out", ["The server no longer recognises this session as an admin, so it is not sending figures. Sign in again, then reload this page."], {
      actions: [button("Reload", function () { window.location.reload(); })]
    });
  }

  function notInstalledPanel() {
    return statePanel("The analytics tables aren\u2019t installed", [
      inlineCode(["Nothing can be counted until the tables exist. Run ", { code: "npx expo-analytics install" }, " against the database, or call ", { code: "await server.install()" }, " when the server boots, then reload this page."])
    ], { actions: [button("Reload", function () { window.location.reload(); })] });
  }

  function signedOut() {
    if (state.stopped === "signed_out") return;
    state.stopped = "signed_out";
    var banner = byId("banner");
    clear(banner);
    append(banner, el("p", null, "Your admin session has ended. Sign in again, then reload this page to keep reading."),
      button("Reload", function () { window.location.reload(); }));
    banner.hidden = false;
  }

  function loadSection(id, force) {
    var body = part(id, "body");
    if (state.stopped === "signed_out") {
      clear(body);
      body.appendChild(signedOutPanel());
      return;
    }
    if (state.stopped === "not_installed") {
      clear(body);
      body.appendChild(notInstalledPanel());
      return;
    }
    var key = cacheKey(id);
    if (!force && state.cache[key]) {
      render(id, state.cache[key]);
      return;
    }
    var seq = (state.seq[id] || 0) + 1;
    state.seq[id] = seq;
    if (body.firstChild) {
      // Refetch keeps the frame: the previous figures stay, dimmed.
      body.classList.add("is-loading");
    } else {
      body.appendChild(el("p", "loading", "Loading\u2026"));
    }
    body.setAttribute("aria-busy", "true");
    DEFS[id].load().then(function (data) {
      if (state.seq[id] !== seq) return;
      state.cache[key] = data;
      render(id, data);
    }, function (error) {
      if (state.seq[id] !== seq) return;
      if (error.kind === "not_installed") state.stopped = "not_installed";
      renderProblem(id, error instanceof ApiError ? error : new ApiError("error", 0, "Something went wrong while showing this section."));
    });
  }

  // On a phone the tab strip scrolls sideways, so a tab opened from a link or a
  // reload can be off screen. Centre it in the strip; scrollIntoView would also
  // move the page vertically.
  function revealTab(link) {
    var strip = link.closest ? link.closest(".tab-list") : null;
    if (!strip || !link.getBoundingClientRect) return;
    var box = link.getBoundingClientRect();
    var frame = strip.getBoundingClientRect();
    if (box.left >= frame.left && box.right <= frame.right) return;
    strip.scrollLeft += box.left - frame.left - (frame.width - box.width) / 2;
  }

  function showSection(id) {
    state.tab = id;
    SECTIONS.forEach(function (name) {
      sectionNode(name).hidden = name !== id;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-tab]"), function (link) {
      if (link.getAttribute("data-tab") === id) {
        link.setAttribute("aria-current", "page");
        revealTab(link);
      } else link.removeAttribute("aria-current");
    });
    save();
    loadSection(id);
  }

  // -- Range ---------------------------------------------------------------

  function updatePeriod() {
    var range = state.range;
    byId("period").textContent = fmtRange(range.from, range.to);
    var previous = previousRange(range);
    var days = daysInclusive(range.from, range.to);
    byId("period-compare").textContent = days + (days === 1 ? " day" : " days") + " \u00B7 compared with " + fmtRange(previous.from, previous.to);
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (node) {
      node.setAttribute("aria-pressed", node.getAttribute("data-preset") === range.preset ? "true" : "false");
    });
    byId("range-from").value = range.from;
    byId("range-to").value = range.to;
    byId("range-from").max = state.meta.today;
    byId("range-to").max = state.meta.today;
    byId("custom-range").hidden = range.preset !== "custom";
  }

  function applyRange(range) {
    state.range = range;
    state.cache = {};
    updatePeriod();
    writeUrl();
    save();
    loadSection(state.tab);
  }

  function setPreset(preset) {
    var range = presetRange(preset, state.meta.today);
    applyRange({ preset: preset, from: range.from, to: range.to });
  }

  function bindRange() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (node) {
      node.addEventListener("click", function () {
        var preset = node.getAttribute("data-preset");
        if (!state.meta) return;
        if (preset === "custom") {
          state.range.preset = "custom";
          updatePeriod();
          byId("range-from").focus();
          return;
        }
        setPreset(preset);
      });
    });
    byId("range-form").addEventListener("submit", function (event) {
      event.preventDefault();
      if (!state.meta) return;
      var from = byId("range-from").value;
      var to = byId("range-to").value;
      if (!validDay(from) || !validDay(to)) return;
      if (to < from) {
        var swap = from;
        from = to;
        to = swap;
      }
      applyRange({ preset: "custom", from: from, to: to });
    });
  }

  // -- Start ---------------------------------------------------------------

  function onHash() {
    var id = window.location.hash.replace(/^#/, "");
    if (SECTIONS.indexOf(id) !== -1 && id !== state.tab) {
      showSection(id);
      writeUrl();
    }
  }

  var resizeTimer = null;
  var lastWidth = 0;

  function onResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var width = document.documentElement.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      runDraws(state.tab);
    }, 150);
  }

  function showMeta(meta) {
    state.meta = meta;
    byId("app-id").textContent = meta.appId;
    byId("app-zone").textContent = meta.timezone;
    document.title = "Analytics \u00B7 " + meta.appId;
    var mode = new URLSearchParams(window.location.search).get("mode");
    if (mode === "on" || mode === "on_or_after" || mode === "bracket") state.retentionMode = mode;
    state.range = initialRange(meta.today);
    state.tab = initialTab();
    if (!meta.install.installed || meta.install.pending.length) state.stopped = "not_installed";
    clear(part(state.tab, "body"));
    updatePeriod();
    writeUrl();
    showSection(state.tab);
  }

  function start() {
    var body = document.body;
    state.base = body.getAttribute("data-base") || "";
    lastWidth = document.documentElement.clientWidth;
    bindRange();
    window.addEventListener("hashchange", onHash);
    window.addEventListener("resize", onResize);
    // Until the meta arrives, the active tab still shows where things stand.
    state.tab = initialTab();
    SECTIONS.forEach(function (name) { sectionNode(name).hidden = name !== state.tab; });
    var first = part(state.tab, "body");
    first.appendChild(el("p", "loading", "Loading\u2026"));
    api("meta").then(showMeta, function (error) {
      clear(first);
      if (error.kind === "signed_out") {
        signedOut();
        first.appendChild(signedOutPanel());
        return;
      }
      byId("period").textContent = "Analytics";
      first.appendChild(statePanel("The dashboard didn\u2019t load", [error.message || "Something went wrong while loading."], {
        actions: [button("Try again", function () { window.location.reload(); })]
      }));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;
