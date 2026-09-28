---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/143
---

# Server guide: replace the "cold Metro first request" hydration claim with what was actually observed

## Goal

`docs/server-guide.md` (end of the `useId` section, ≈line 67) states that "the very first request after `expo start` (cold module cache) can hydrate against a differently rendered tree … on any route; a second request is clean". Wave-6 probing shows that is not reproducible as written. Replace the sentence with the verified account so the next person does not chase a cold-cache theory, and give them the recipe and the one captured React diff.

## Context (verified 09-28 on `dev` 76c7dd3, Expo 58.0.0-preview.2, expo-router ~58.0.3, RN 0.88.0-rc.0)

- Six first-request probes were clean (0 console errors, 0 hydration messages, first and second server HTML byte-identical): cold transform cache (`expo start --clear`, 79 s first build) with the `has-seen-onboarding` + `color-scheme` cookies on `/`; cold cache without cookies on `/` in light and in dark (the pre-boot script's scheme path); a fresh dev-server process on a warm cache with cookies; `/settings` and `/auth-demo` with cookies (predecessor, 00:44); `/components/button` (unknown id) warm with cookies.
- One real failure was captured through Metro's console forwarding: the first server render of `/components/button` with cookies, after the same dev server had rendered `/` four times without cookies (onboarding variant, no `TextInput` in the tree). React's message: "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client." The diff sits inside `ExploreScreen` → kit `TextInput` (`packages/ui/src/components/TextInput.tsx`, `WebTextInput`, the `styles.wrapper` View at ≈374): the client rendered the Input Container `<div class="css-view… r-backgroundColor…">`, the DOM at that position held the `<input data-testid="explore-search">` itself, i.e. the server markup lacked the wrapper `<div>` (and the `leftElement` icon). A warm render of the same URL a minute later had the wrapper: `div > div(wrapper) > div(leftElement) > svg … input`.
- Both server and client rendered `ExploreScreen` for that URL (the web tabs layout renders the Explore tab for a `(demos)` route while the lazy gallery chunk is pending), so the mismatch is inside `TextInput`'s first server render, not a route mismatch.
- Playwright's `console` listener did not see the message; only Metro's `Web ERROR` forwarding did. Any future probe must read the Metro log.

## Work

1. In `docs/server-guide.md`, replace the final sentence of the `useId` paragraph ("A separate, dev-only symptom is unrelated to ids: the very first request … warm module graph.") with a short paragraph:
   - dev-only, seen once, not reproducible on demand; the cold-transform-cache theory is ruled out (list the clean probes in one sentence);
   - what the one capture showed (the `TextInput` Input Container `<div>` missing from the server DOM on the first server render of a cookied route after cookie-less renders), with the React message quoted once;
   - how to probe next time: cold `expo start --web --port <p> --max-workers 2`, load a cookie-less route first, then a cookied route that renders a kit `TextInput`, and read the Metro log (not the browser console) for "Hydration failed"; save the document response of the first and second request and diff them;
   - production exports render from a warm module graph and were clean (#136).
   Keep the paragraph under 20 lines; no `/tmp` paths in the repo.
2. Run `bun run docs:llms` and commit the regenerated `llms-full.txt` if it changed.
3. No code, test or CHANGELOG change (package behaviour is untouched).

## Validation

- `bun run docs:versions:check` and `bun run gen --check` pass (docs gates in `bun run verify`); CI green on the PR.
- The paragraph names `packages/ui/src/components/TextInput.tsx` and `client/showcase/lazyGallery.tsx` correctly (both exist on `dev`).

## Out of scope

- Fixing the mismatch (no deterministic repro yet).
- Changing `TextInput` or the showcase.

## Open questions

None.
