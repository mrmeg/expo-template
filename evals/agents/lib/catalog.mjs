/**
 * What the matrix is made of: the tasks under `evals/agents/tasks/` and the
 * variants under `evals/agents/variants/`, both discovered from the directory
 * so adding one is adding a file.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const EVALS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const TASKS_DIR = join(EVALS_DIR, "tasks");
const VARIANTS_DIR = join(EVALS_DIR, "variants");

/**
 * @typedef {{ id: string, dir: string, order: number, title: string, prompt: string, check: string }} Task
 * @returns {Task[]} in `task.json` order
 */
export function loadTasks() {
  return readdirSync(TASKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = join(TASKS_DIR, entry.name);
      const meta = JSON.parse(readFileSync(join(dir, "task.json"), "utf8"));
      return {
        id: entry.name,
        dir,
        order: meta.order,
        title: meta.title,
        prompt: readFileSync(join(dir, "prompt.md"), "utf8").trim(),
        check: join(dir, "check.mjs"),
      };
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * @typedef {{ id: string, name: string, order: number, description: string, apply: (context: { appDir: string }) => Promise<void> }} Variant
 * @returns {Promise<Variant[]>} in `order`
 */
export async function loadVariants() {
  const files = readdirSync(VARIANTS_DIR).filter((file) => file.endsWith(".mjs") && !file.startsWith("_"));
  const variants = [];
  for (const file of files) {
    const { default: variant } = await import(pathToFileURL(join(VARIANTS_DIR, file)).href);
    variants.push(variant);
  }
  return variants.sort((a, b) => a.order - b.order);
}

/**
 * Pick items by id (case-insensitive) or name, in catalog order; no selector keeps all.
 *
 * @template {{ id: string, name?: string }} T
 */
export function select(items, selector, what) {
  if (!selector) return items;
  const wanted = selector.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  const unknown = wanted.filter((value) => !items.some((item) => item.id.toLowerCase() === value || item.name?.toLowerCase() === value));
  if (unknown.length > 0) {
    throw new Error(`Unknown ${what} ${unknown.join(", ")}. Choose from: ${items.map((item) => item.id).join(", ")}`);
  }
  return items.filter((item) => wanted.includes(item.id.toLowerCase()) || (item.name && wanted.includes(item.name.toLowerCase())));
}

export const hasTaskFixtures = (task, kind) => existsSync(join(task.dir, "fixtures", kind));
