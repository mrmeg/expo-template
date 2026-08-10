/**
 * Inline blank-screen recovery watchdog, rendered by `app/+html.tsx` as a
 * blocking <head> script so it runs even when the app bundle never executes.
 *
 * Failure class it exists for: the page and every asset load (all 200s), but
 * hydration dies — React 19 discards the server DOM on a hydration error and,
 * if the client re-render then throws too, leaves `#root` permanently empty.
 * The user sees a themed-background blank page that a manual refresh fixes
 * (the retry renders against a warm server and a primed cache). Observed
 * intermittently on cold server starts; never reproducible on demand, which
 * is why the watchdog both self-heals and captures evidence.
 *
 * Behavior contract (kept in sync with `__tests__/blankRecovery.test.ts`):
 *
 * - Buffers the first five `error` / `unhandledrejection` messages from
 *   before the check, so the cause survives the reload.
 * - Checks `#root` once, 4s after `load` (or 15s after script eval if `load`
 *   never fires). "Dead" means no rendered text at all — `innerText` ignores
 *   `<template>` segments and hidden nodes, so a pending Suspense boundary or
 *   the ErrorScreen never count as dead. Every real tree in this app renders
 *   chrome text; a fork whose entry route is legitimately text-free at rest
 *   should relax the check rather than delete it.
 * - Dead + no prior attempt: persist `{at, url, errors}` under the
 *   `blank-screen-recovery` sessionStorage key and reload once.
 * - Dead + prior attempt: log and stay put — a second reload would loop, and
 *   the page is equally debuggable where it is.
 * - Healthy + prior attempt: surface the captured errors as a console
 *   warning, then clear the key so a later, unrelated blank can self-heal.
 * - EVERY dead detection also overwrites `blank-screen-recovery:last` in
 *   localStorage and leaves it there. The session flow above self-clears, so
 *   on a phone (no console open) the evidence would otherwise be gone by the
 *   time anyone looks; this key survives until the next occurrence and can be
 *   read later via remote Web Inspector or
 *   `localStorage.getItem("blank-screen-recovery:last")`.
 *
 * Deliberately ES5-ish and self-contained: it must parse everywhere and touch
 * nothing the bundle owns.
 */
export const BLANK_RECOVERY_STORAGE_KEY = "blank-screen-recovery";

/** Durable copy of the most recent capture — localStorage, never auto-cleared. */
export const BLANK_RECOVERY_LAST_KEY = "blank-screen-recovery:last";

export const BLANK_RECOVERY_SCRIPT = `
(function () {
  try {
    var GUARD_KEY = "${BLANK_RECOVERY_STORAGE_KEY}";
    var captured = [];
    function record(kind, detail) {
      if (captured.length < 5) captured.push(kind + ": " + detail);
    }
    window.addEventListener("error", function (event) {
      record("error", (event && event.message) || String(event));
    });
    window.addEventListener("unhandledrejection", function (event) {
      var reason = event && event.reason;
      record("unhandledrejection", reason && reason.message ? reason.message : String(reason));
    });

    var previous = null;
    try { previous = sessionStorage.getItem(GUARD_KEY); } catch (e) {}

    var checked = false;
    function checkAlive() {
      if (checked) { return; }
      checked = true;
      var root = document.getElementById("root");
      var hasContent = true;
      try { hasContent = !!root && root.innerText.replace(/\\s+/g, "").length > 0; } catch (e) {}
      if (hasContent) {
        if (previous) {
          try {
            console.warn(
              "[blank-screen-recovery] The previous load rendered nothing and was auto-reloaded once. Errors captured before that reload:",
              JSON.parse(previous)
            );
            sessionStorage.removeItem(GUARD_KEY);
          } catch (e) {}
        }
        return;
      }
      var payload = JSON.stringify({ at: new Date().toISOString(), url: location.href, errors: captured });
      try { localStorage.setItem("${BLANK_RECOVERY_LAST_KEY}", payload); } catch (e) {}
      if (previous) {
        console.error("[blank-screen-recovery] Still blank after an automatic reload; not reloading again.", payload);
        return;
      }
      try { sessionStorage.setItem(GUARD_KEY, payload); } catch (e) { return; }
      console.error("[blank-screen-recovery] Nothing rendered after load; reloading once.", payload);
      location.reload();
    }
    window.addEventListener("load", function () { setTimeout(checkAlive, 4000); });
    setTimeout(checkAlive, 15000);
  } catch (e) {}
})();
`;
