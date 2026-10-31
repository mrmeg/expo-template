---
status: ready
mode: AFK
base-branch: dev
blocked-by: -
pr: -
---

# Split `@mrmeg/expo-ui` LLM_USAGE.md into per-component docs with a generated index

## Goal
Make the "read the docs before UI work" step cheap. `packages/ui/LLM_USAGE.md` is 70 KB (~17k tokens), and consumers such as fieldnest tell agents to read all of it before any UI task. The change keeps the cross-cutting rules in a short `LLM_USAGE.md`, moves component-specific material into one file per component, and generates the index and the full bundle so nothing drifts. Mantine, Base UI, Expo and Stripe all ship per-page Markdown behind an index for the same reason.

## Context
- `packages/ui/LLM_USAGE.md` (1,107 lines, hand-written) sections:
  - First Rule (5), Stable Import Paths (10), Required App Setup (31–182), Theme And Text Rules (183–322), Screen Layout (323–376);
  - Component Use-Case Index (377–444, one table row per component family, with "Use for" / "Instead of" columns);
  - Component Selection Rules (445–458, many component-specific bullets);
  - Media (459–961, ~500 lines of media components);
  - Minimal Examples (962–1107).
- `packages/ui/llms-full.md` (19 KB) is a separate hand-written "Full Contract". It duplicates setup, theme, layout and catalog material, and has unique `## Notifications` and `## Validation` sections. The roles are inverted: the "concise" file is 3.7× the "full" one. `packages/ui/README.md:8` tells agents to read `llms.txt`, then `LLM_USAGE.md` or `llms-full.md`.
- `packages/ui/llms.txt` (2.4 KB) is the compact index. The `package-agents-section` spec inlines it into consumer AGENTS.md files and lists `docs/components/index.md` when an installed version ships it.
- Exported components: `packages/ui/src/components/index.ts`. `packages/ui/dist/design-system.json` `components` lists 197 entries, including subcomponents.
- Packaging: `packages/ui/package.json` `files` = bin, dist, package.json, README.md, CHANGELOG.md, LLM_USAGE.md, llms.txt, llms-full.md. Changing `files` needs a version bump (AGENTS.md project notes).
- Generated artifacts are wired through `scripts/gen.mjs`: each generator needs a `<name>` and `<name>:check` script, and `bun run gen --check` runs in `verify` and CI.
- The root `scripts/build-llms-full.mjs` concatenates `packages/ui/LLM_USAGE.md` (among others) into `llms-full.txt` (`bun run docs:llms`).
- `packages/lint/lib/contracts.js:132,138` cites `LLM_USAGE.md` for the transparent-sheet path. Keep that content findable and update the comment if it moves.

## Work
1. **Per-component source docs.** Create `packages/ui/docs/components/<Family>.md`, one per component family in the Use-Case Index (e.g. `Item.md` covers `Item`, `ItemGroup` and its parts; `Media*` components may share `Media.md` if that reads better). Each file starts with frontmatter: `components` (exported names covered), `use-for` and `instead-of` (one line each, taken from the index row). Then come that family's rules, the matching Selection Rules bullets, its Media material, and its Minimal Example. Keep each file under ~8 KB. Content is moved, not rewritten; fix only facts you verify are wrong.
2. **Short `LLM_USAGE.md`.**
   - Keep First Rule, Stable Import Paths, Required App Setup, Theme And Text Rules, Screen Layout, the general Selection Rules, and a Use-Case Index whose rows link to `docs/components/<Family>.md`.
   - Fold in `llms-full.md`'s unique Notifications and Validation content, wherever it fits best.
   - Target ≤ 25 KB.
   - The index table is generated between `<!-- component-index:start -->` and `<!-- component-index:end -->` markers.
3. **Generator `scripts/build-ui-docs.mjs`** (`--check` mode). It writes:
   - the index table inside `LLM_USAGE.md`;
   - `packages/ui/docs/components/index.md` (one line per family: name, use-for, link);
   - `packages/ui/llms-full.md`, regenerated as `LLM_USAGE.md` followed by every component doc, under a "GENERATED, do not edit" header.

   It fails when an export from `src/components/index.ts` is in no doc's `components` list, unless it is on a short internal allowlist kept in the script (providers, internals). Register `docs:ui` / `docs:ui:check` in `package.json` and `scripts/gen.mjs`.
4. **Packaging.**
   - Add `docs` to ui `files`, and `docs/components/index.md` to the ui consumer-smoke `requiredDocs` (`scripts/check-package-consumer.mjs`).
   - Bump ui to the next minor.
   - Add a CHANGELOG entry that says where component rules moved.
5. **Pointers.**
   - `packages/ui/llms.txt` lists `docs/components/index.md` and says to open only the components in use. Keep it ≤ 3 KB.
   - Update `packages/ui/README.md:8` and the "Docs" line of the root `llms.txt` to match.
   - Add `packages/ui/docs/components/*.md` to `scripts/build-llms-full.mjs` sources, so root `llms-full.txt` still carries everything, then run `bun run docs:llms`.
   - Update the `contracts.js` comments if their target moved.

## Out of scope
- Rewriting rules or changing component behavior.
- Splitting the media or purchases packages' docs: they are 12 KB and 7 KB.
- A docs CLI such as `expo-ui docs <Component>`.

## Validation
- `bun run gen --check`, then `bun run docs:llms:check`.
- `bun run pkg ui consumer-smoke`
- `bun run verify`
- Size check: `wc -c packages/ui/LLM_USAGE.md` ≤ 25 KB; every `packages/ui/docs/components/*.md` ≤ 8 KB.
- Loss check: every `##`/`###` heading and every Selection Rules bullet from the old `LLM_USAGE.md` (`git show origin/dev:packages/ui/LLM_USAGE.md`) appears in the new `LLM_USAGE.md` or a component doc. Report anything intentionally dropped in the PR.
