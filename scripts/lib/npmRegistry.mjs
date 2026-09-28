/**
 * Just enough of the npm registry protocol for the release tooling: does a
 * package or version exist, and what manifest did a published version ship.
 *
 * Plain `fetch`, no npm CLI: the publish-drift gate runs inside `verify`, which
 * must not depend on npm auth or config. The published manifest is read out of
 * the version's tarball rather than the registry's version document, because
 * the registry strips `files` from that document and `files` is one of the
 * fields the drift gate compares.
 */
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const DEFAULT_REGISTRY = "https://registry.npmjs.org/";

/** No usable answer from the registry: network failure, timeout, or a 5xx/unexpected status. */
export class RegistryUnreachableError extends Error {
  constructor(message) {
    super(message);
    this.name = "RegistryUnreachableError";
  }
}

/** A registry base URL with the trailing slash `new URL(path, base)` needs. */
export function normalizeRegistry(registry = DEFAULT_REGISTRY) {
  return registry.endsWith("/") ? registry : `${registry}/`;
}

/** The registry a package publishes to: `--registry`, else its `publishConfig.registry`, else npm. */
export function registryFor(manifest, override) {
  return normalizeRegistry(override ?? manifest.publishConfig?.registry ?? DEFAULT_REGISTRY);
}

async function get(url, { accept, timeoutMs = 20_000 } = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: accept ? { accept } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error?.cause?.code ?? error?.cause?.message ?? error?.message ?? String(error);
    throw new RegistryUnreachableError(`GET ${url} failed: ${reason}`);
  }
  if (response.status !== 200 && response.status !== 404) {
    throw new RegistryUnreachableError(`GET ${url} answered HTTP ${response.status}`);
  }
  return response;
}

/**
 * The abbreviated packument (every version's `dist` and dependency fields), or
 * `null` when the registry has never heard of the package.
 */
export async function fetchPackument(registry, name, options) {
  const path = encodeURIComponent(name).replace(/^%40/, "@");
  const response = await get(new URL(path, normalizeRegistry(registry)), {
    ...options,
    accept: "application/vnd.npm.install-v1+json",
  });
  if (response.status === 404) return null;
  return response.json();
}

/**
 * The `package.json` a published version shipped, read from its tarball.
 *
 * @param {{ dist: { tarball: string, integrity?: string } }} versionEntry one entry of `packument.versions`
 */
export async function fetchPublishedManifest(versionEntry, options) {
  const url = versionEntry.dist.tarball;
  const response = await get(url, options);
  if (response.status === 404) {
    throw new RegistryUnreachableError(`GET ${url} answered HTTP 404 for a version the packument lists`);
  }
  const tarball = Buffer.from(await response.arrayBuffer());

  const integrity = versionEntry.dist.integrity;
  if (integrity?.startsWith("sha512-")) {
    const actual = `sha512-${createHash("sha512").update(tarball).digest("base64")}`;
    if (actual !== integrity) {
      throw new RegistryUnreachableError(`${url} does not match its published integrity ${integrity}`);
    }
  }

  const entry = readTarEntry(gunzipSync(tarball), (path) => /^[^/]+\/package\.json$/.test(path));
  if (!entry) throw new Error(`${url} has no top-level package.json`);
  return JSON.parse(entry.toString("utf8"));
}

function field(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end === -1 ? bytes.length : end).toString("utf8");
}

function paxPath(body) {
  // Records are "<length> <key>=<value>\n".
  for (const record of body.toString("utf8").split("\n")) {
    const match = /^\d+ path=(.*)$/.exec(record);
    if (match) return match[1];
  }
  return null;
}

/**
 * The body of the first regular file in an (uncompressed) tar archive whose
 * path satisfies `matches`, or `null`. Handles ustar prefixes, pax `path`
 * records, and GNU long names — the shapes npm and Bun tarballs use.
 *
 * @param {Buffer} tar
 * @param {(path: string) => boolean} matches
 */
export function readTarEntry(tar, matches) {
  let offset = 0;
  let longPath = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const size = parseInt(field(header, 124, 12).trim() || "0", 8);
    const type = header[156] === 0 ? "0" : String.fromCharCode(header[156]);
    const body = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === "x") {
      longPath = paxPath(body) ?? longPath;
      continue;
    }
    if (type === "L") {
      longPath = field(body, 0, body.length);
      continue;
    }
    if (type === "g") continue;

    const prefix = field(header, 257, 6).startsWith("ustar") ? field(header, 345, 155) : "";
    const name = field(header, 0, 100);
    const path = longPath ?? (prefix ? `${prefix}/${name}` : name);
    longPath = null;

    if (type === "0" && matches(path)) return body;
  }
  return null;
}
