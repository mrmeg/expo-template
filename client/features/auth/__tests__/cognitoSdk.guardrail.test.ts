/**
 * Amplify chunk-shape guardrail for the Cognito provider.
 *
 * Why this file exists
 * -------------------
 * On web, Metro hoists any module shared by two async chunks into the eagerly
 * `<script>`-loaded `__common` bundle, so a dependency stays lazy only when it
 * has exactly one split point. `cognitoClient.ts` used to reach the SDK through
 * three different specifiers — `import("aws-amplify")`,
 * `import("aws-amplify/utils")`, and `import("aws-amplify/auth")` — which share
 * one internal graph, so `@aws-amplify/core` + `@aws-amplify/auth` (~124 kB
 * raw) were hoisted and downloaded before first render by every visitor,
 * including Clerk-only and auth-disabled deploys.
 *
 * `cognitoSdk.ts` is now the single lazy entry point: it imports the SDK
 * statically and re-exports it, and every dynamic import in `cognitoClient.ts`
 * resolves to that one module. This is the same arrangement `clerkClient.ts`
 * uses for the Clerk cluster (see `AuthProviderGate.tsx`).
 *
 * A source check is deliberate. The regression this guards against is invisible
 * to unit tests — it only shows up as a bigger `__common` chunk in a full
 * `expo export -p web`, which is far too slow for CI. Reading the two files is
 * the cheap equivalent.
 *
 * Scope note: the client's runtime behavior is not covered here for the reason
 * `provider.test.ts` records — Jest's transform leaves `import()` native, so
 * every code path behind `await import("./cognitoSdk")` throws
 * "A dynamic import callback was invoked without --experimental-vm-modules".
 * Those flows are exercised in the running app.
 */

import { readFileSync } from "fs";
import { join } from "path";

const PROVIDER_DIR = join(__dirname, "..", "provider");

function read(file: string): string {
  return readFileSync(join(PROVIDER_DIR, file), "utf8");
}

/** Comments describe imports too; only real code decides the chunk graph. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");
}

/**
 * Specifiers of `import(...)` calls that survive to runtime. A type-only
 * `typeof import("…")` is erased by the transform and creates no chunk, so it
 * is excluded.
 */
function runtimeDynamicImports(source: string): string[] {
  return [...stripComments(source).matchAll(/(?<!typeof\s)import\((["'])([^"']+)\1\)/g)]
    .map((m) => m[2]);
}

describe("Cognito SDK single split point", () => {
  const client = read("cognitoClient.ts");

  it("routes every dynamic import in cognitoClient through ./cognitoSdk", () => {
    const specifiers = runtimeDynamicImports(client);
    expect(specifiers.length).toBeGreaterThan(0);
    expect([...new Set(specifiers)]).toEqual(["./cognitoSdk"]);
  });

  it("never imports an aws-amplify entry point at runtime from cognitoClient", () => {
    // Two specifiers under `aws-amplify` would be two chunks over one shared
    // graph, which is what pushed Amplify into `__common`.
    expect(runtimeDynamicImports(client).filter((s) => s.startsWith("aws-amplify"))).toEqual([]);
  });

  it("has no static aws-amplify import in cognitoClient", () => {
    // A static import would drag the SDK into whatever chunk holds the client.
    expect(stripComments(client)).not.toMatch(/^import\s[^;]*from\s+["']aws-amplify/m);
  });

  it("exposes the SDK surface the client needs from cognitoSdk", () => {
    const sdk = read("cognitoSdk.ts");
    expect(sdk).toMatch(/import\s+\{\s*Amplify\s*\}\s+from\s+"aws-amplify"/);
    expect(sdk).toMatch(/import\s+\{\s*Hub\s*\}\s+from\s+"aws-amplify\/utils"/);
    expect(sdk).toMatch(/import\s+\*\s+as\s+amplifyAuth\s+from\s+"aws-amplify\/auth"/);
    expect(sdk).toMatch(/export\s+\{\s*Amplify,\s*Hub,\s*amplifyAuth\s*\}/);
  });

  it("keeps cognitoSdk out of the eager graph (only cognitoClient imports it)", () => {
    // A second importer — especially a statically reachable one — would either
    // hoist Amplify into `__common` or pull it into the eager bundle outright.
    const importers = [
      "index.ts",
      "types.ts",
      "clerkClient.ts",
      "AuthProviderGate.tsx",
      "ClerkProviderBoundary.tsx",
    ].filter((file) => stripComments(read(file)).includes("cognitoSdk"));
    expect(importers).toEqual([]);
  });
});
