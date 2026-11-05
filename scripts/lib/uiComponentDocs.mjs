/**
 * Shared by `scripts/build-ui-docs.mjs` (the ui component-docs generator) and
 * `scripts/build-llms-full.mjs` (the root LLM bundle): how a
 * `packages/ui/docs/components/<Family>.md` file is read, and how its
 * frontmatter reaches a bundle that strips the `---` block.
 */

export const FRONTMATTER_KEYS = new Set(["components", "also", "use-for", "instead-of"]);

/**
 * Strict frontmatter: `---`, `key: value` lines, `---`. A value is a
 * double-quoted string (JSON escapes) or a one-line `[A, B]` list, so the block
 * is valid YAML and renders as a table on GitHub.
 *
 * @param {string} text
 * @param {string} label used in problem messages
 * @param {string[]} problems problems are pushed here
 * @returns {{ data: Record<string, string | string[]>, body: string }}
 */
export function parseFrontmatter(text, label, problems) {
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    problems.push(`${label}: must start with a "---" frontmatter block`);
    return { data: {}, body: text };
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) {
    problems.push(`${label}: frontmatter is not closed by a "---" line`);
    return { data: {}, body: text };
  }
  const data = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([a-z-]+): (.*)$/.exec(line);
    if (!match) {
      problems.push(`${label}: cannot read frontmatter line ${JSON.stringify(line)}`);
      continue;
    }
    const [, key, raw] = match;
    if (!FRONTMATTER_KEYS.has(key)) {
      problems.push(`${label}: unknown frontmatter key "${key}" (allowed: ${[...FRONTMATTER_KEYS].join(", ")})`);
      continue;
    }
    if (key in data) {
      problems.push(`${label}: frontmatter key "${key}" appears twice`);
      continue;
    }
    if (raw.startsWith("[") && raw.endsWith("]")) {
      data[key] = raw
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (raw.startsWith('"')) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        problems.push(`${label}: "${key}" is not a valid double-quoted string`);
      }
    } else {
      problems.push(`${label}: "${key}" must be a double-quoted string or a [list]`);
    }
  }
  return { data, body: lines.slice(end + 1).join("\n").replace(/^\n+/, "") };
}

/**
 * A family doc as a bundle carries it: the doc without its `---` block, with
 * the frontmatter facts (every exported name, use-for, instead-of) restated as
 * three lines under the `# <Family>` heading, so a bundle loses none of them.
 *
 * @param {string} text the whole doc, frontmatter included
 * @param {string} label used in error messages
 * @returns {string}
 */
export function renderDocForBundle(text, label) {
  const problems = [];
  const { data, body } = parseFrontmatter(text, label, problems);
  const newline = body.indexOf("\n");
  if (problems.length > 0 || !body.startsWith("# ") || newline === -1) {
    throw new Error(`${label}: cannot render for a bundle: ${problems.join("; ") || "no \"# <Family>\" heading"}`);
  }
  const meta = [
    `- Components: ${(data.components ?? []).map((name) => `\`${name}\``).join(", ")}`,
    `- Use for: ${data["use-for"] ?? ""}`,
    ...(data["instead-of"] ? [`- Instead of: ${data["instead-of"]}`] : []),
  ];
  return `${body.slice(0, newline)}\n\n${meta.join("\n")}${body.slice(newline).trimEnd()}`;
}
