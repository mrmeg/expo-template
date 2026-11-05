# Variants

One file per guidance variant. The runner loads every `*.mjs` here (a name
starting with `_` is skipped), sorts by `order`, and runs each against every task.
A file default-exports:

```js
export default {
  id: "D",             // what --variants takes (case-insensitive)
  name: "split-docs",  // short label for tables
  order: 4,
  description: "…",
  async apply({ appDir }) {
    // AGENTS.md (the base) is already in appDir; edit it here. Claude Code loads
    // it as the project guidance. The installed packages are in appDir/node_modules.
  },
};
```

To measure a new guidance shape, add a file; nothing else changes.
