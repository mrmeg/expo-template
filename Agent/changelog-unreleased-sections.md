---
status: in-review
mode: AFK
base-branch: dev
blocked-by: -
pr: https://github.com/mrmeg/expo-template/pull/138
---

# One `### Changed` section under `## [Unreleased]`

## Goal
`packages/ui/CHANGELOG.md` → `## [Unreleased]` has two `### Changed` headings (one after `### Added`, a second after `### Documentation`), so the release notes for 0.28.0 would list "Changed" twice. Merge the second block's bullets into the first section; no wording changes.

## Context
Headings today: `### Added` (line 8), `### Changed` (176), `### Fixed` (329), `### Documentation` (532), `### Changed` (554), then `## [0.27.1]` (562). The trailing block holds the `exports` / `@mrmeg/source` condition bullet(s).

## Work
Move every bullet under the second `### Changed` to the end of the first `### Changed` section (before `### Fixed`), delete the empty heading, keep one blank line between sections.

## Validation
`grep -n "^### " packages/ui/CHANGELOG.md` shows each heading once under Unreleased; `bun run docs:versions:check` and `bun run gen --check` unchanged (CHANGELOG is not generated). CI.

## Out of scope
Bullet wording; other releases' sections.

## Open questions
None.
