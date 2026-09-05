#!/usr/bin/env npx tsx
/**
 * Render the Cognito email templates in `scripts/cognito-email/` for this app and
 * store them on a user pool.
 *
 * Usage:
 *   bun run auth:emails [--dry-run] [--pool <userPoolId>] [--app-name "<name>"]
 *                       [--region <region>] [--templates-dir <dir>]
 *
 * Defaults come from `.env`: `EXPO_PUBLIC_USER_POOL_ID` and `EXPO_PUBLIC_APP_NAME`.
 * The region is derived from the pool id (`us-east-1_…`) unless given.
 *
 * Why the update is built the way it is: `update-user-pool` replaces every field it is
 * not given with the default, so this script describes the pool first and sends every
 * updatable field back unchanged, with only the two message templates swapped in. AWS
 * credentials come from the ambient CLI configuration (profile or env vars).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";

export const CODE_PLACEHOLDER = "{####}";
export const USERNAME_PLACEHOLDER = "{username}";
export const MAX_BODY_LENGTH = 20_000;
export const MAX_SUBJECT_LENGTH = 140;

export interface RenderedTemplate {
  subject: string;
  html: string;
}

export interface RenderedEmailTemplates {
  verification: RenderedTemplate;
  invite: RenderedTemplate;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function substitute(template: string, appName: string): string {
  return template.replace(/\{\{APP_NAME\}\}/g, escapeHtml(appName));
}

function readTemplate(dir: string, base: string): RenderedTemplate {
  const html = fs.readFileSync(path.join(dir, `${base}.html`), "utf8");
  const subject = fs.readFileSync(path.join(dir, `${base}.subject.txt`), "utf8").trim();
  return { subject, html };
}

/** Throws with a precise message when a rendered template breaks a Cognito rule. */
export function validateRendered(rendered: RenderedEmailTemplates): void {
  const problems: string[] = [];
  const check = (name: string, t: RenderedTemplate, requireUsername: boolean) => {
    if (!t.html.includes(CODE_PLACEHOLDER)) problems.push(`${name}: body must contain ${CODE_PLACEHOLDER}`);
    if (requireUsername && !t.html.includes(USERNAME_PLACEHOLDER)) {
      problems.push(`${name}: body must contain ${USERNAME_PLACEHOLDER}`);
    }
    if (t.html.length > MAX_BODY_LENGTH) {
      problems.push(`${name}: body is ${t.html.length} chars; Cognito allows ${MAX_BODY_LENGTH}`);
    }
    if (t.subject.length === 0) problems.push(`${name}: subject is empty`);
    if (t.subject.length > MAX_SUBJECT_LENGTH) {
      problems.push(`${name}: subject is ${t.subject.length} chars; Cognito allows ${MAX_SUBJECT_LENGTH}`);
    }
    if (/[<>]/.test(t.subject)) problems.push(`${name}: subject must be plain text`);
    if (/\{\{APP_NAME\}\}/.test(t.html) || /\{\{APP_NAME\}\}/.test(t.subject)) {
      problems.push(`${name}: unreplaced {{APP_NAME}} placeholder`);
    }
  };
  check("verification-code", rendered.verification, false);
  check("invite", rendered.invite, true);
  if (problems.length > 0) throw new Error(problems.join("\n"));
}

export function renderEmailTemplates(appName: string, templatesDir: string): RenderedEmailTemplates {
  const name = appName.trim();
  if (!name) throw new Error("App name is empty; pass --app-name or set EXPO_PUBLIC_APP_NAME in .env");
  const verification = readTemplate(templatesDir, "verification-code");
  const invite = readTemplate(templatesDir, "invite");
  const rendered: RenderedEmailTemplates = {
    verification: { subject: substitute(verification.subject, name), html: substitute(verification.html, name) },
    invite: { subject: substitute(invite.subject, name), html: substitute(invite.html, name) },
  };
  validateRendered(rendered);
  return rendered;
}

/**
 * Fields `update-user-pool` accepts. Anything present on the described pool and listed
 * here is sent back verbatim so the update does not reset it.
 */
export const UPDATABLE_POOL_FIELDS = [
  "Policies",
  "DeletionProtection",
  "LambdaConfig",
  "AutoVerifiedAttributes",
  "SmsVerificationMessage",
  "VerificationMessageTemplate",
  "SmsAuthenticationMessage",
  "UserAttributeUpdateSettings",
  "MfaConfiguration",
  "DeviceConfiguration",
  "EmailConfiguration",
  "SmsConfiguration",
  "UserPoolTags",
  "AdminCreateUserConfig",
  "UserPoolAddOns",
  "AccountRecoverySetting",
  "UserPoolTier",
] as const;

type Json = Record<string, unknown>;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as Json).length === 0;
  return false;
}

/** Pure: describe-user-pool output → update-user-pool input with the templates applied. */
export function buildUserPoolUpdate(pool: Json, rendered: RenderedEmailTemplates): Json {
  const update: Json = { UserPoolId: pool.Id };
  for (const key of UPDATABLE_POOL_FIELDS) {
    const value = pool[key];
    if (!isEmpty(value)) update[key] = JSON.parse(JSON.stringify(value));
  }

  const verification = { ...((update.VerificationMessageTemplate as Json | undefined) ?? {}) };
  verification.DefaultEmailOption = verification.DefaultEmailOption ?? "CONFIRM_WITH_CODE";
  verification.EmailSubject = rendered.verification.subject;
  verification.EmailMessage = rendered.verification.html;
  update.VerificationMessageTemplate = verification;

  const adminCreate = { ...((update.AdminCreateUserConfig as Json | undefined) ?? {}) };
  // Deprecated twin of Policies.PasswordPolicy.TemporaryPasswordValidityDays; the API
  // rejects requests that carry both.
  delete adminCreate.UnusedAccountValidityDays;
  adminCreate.AllowAdminCreateUserOnly = adminCreate.AllowAdminCreateUserOnly ?? false;
  adminCreate.InviteMessageTemplate = {
    ...((adminCreate.InviteMessageTemplate as Json | undefined) ?? {}),
    EmailSubject: rendered.invite.subject,
    EmailMessage: rendered.invite.html,
  };
  update.AdminCreateUserConfig = adminCreate;

  return update;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliOptions {
  pool?: string;
  appName?: string;
  region?: string;
  templatesDir?: string;
  dryRun: boolean;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      i += 1;
      return value;
    };
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--pool") options.pool = next();
    else if (arg === "--app-name") options.appName = next();
    else if (arg === "--region") options.region = next();
    else if (arg === "--templates-dir") options.templatesDir = next();
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: bun run auth:emails [--dry-run] [--pool <id>] [--app-name \"<name>\"] [--region <region>] [--templates-dir <dir>]",
      );
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

/** Minimal .env reader: KEY=value / KEY="value" lines, no interpolation. */
export function readEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function regionFromPoolId(poolId: string): string | undefined {
  const match = /^([a-z]{2}-[a-z]+-\d)_/.exec(poolId);
  return match?.[1];
}

function aws(args: string[]): string {
  return execFileSync("aws", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const env = readEnvFile(path.join(repoRoot, ".env"));

  const poolId = options.pool ?? env.EXPO_PUBLIC_USER_POOL_ID ?? "";
  const appName = options.appName ?? env.EXPO_PUBLIC_APP_NAME ?? "";
  const templatesDir = options.templatesDir ?? path.join(__dirname, "cognito-email");
  const region = options.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? regionFromPoolId(poolId);

  const rendered = renderEmailTemplates(appName, templatesDir);
  console.log(`Templates render for "${appName.trim()}":`);
  console.log(`  verification subject: ${rendered.verification.subject} (${rendered.verification.html.length} chars)`);
  console.log(`  invite subject:       ${rendered.invite.subject} (${rendered.invite.html.length} chars)`);

  if (options.dryRun) {
    console.log(poolId ? `Dry run: would update pool ${poolId}${region ? ` in ${region}` : ""}.` : "Dry run: no pool configured.");
    return;
  }
  if (!poolId) throw new Error("No pool: pass --pool or set EXPO_PUBLIC_USER_POOL_ID in .env");
  if (!region) throw new Error("No region: pass --region (could not derive it from the pool id)");

  const pool = JSON.parse(
    aws(["cognito-idp", "describe-user-pool", "--region", region, "--user-pool-id", poolId, "--query", "UserPool", "--output", "json"]),
  ) as Json;
  const before = (pool.VerificationMessageTemplate as Json | undefined)?.EmailSubject ?? "(Cognito default)";

  const update = buildUserPoolUpdate(pool, rendered);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cognito-email-")), "update.json");
  fs.writeFileSync(tmp, JSON.stringify(update));
  try {
    aws(["cognito-idp", "update-user-pool", "--region", region, "--cli-input-json", `file://${tmp}`]);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }

  const after = JSON.parse(
    aws([
      "cognito-idp",
      "describe-user-pool",
      "--region",
      region,
      "--user-pool-id",
      poolId,
      "--query",
      "UserPool.{Name:Name,Subject:VerificationMessageTemplate.EmailSubject,Invite:AdminCreateUserConfig.InviteMessageTemplate.EmailSubject}",
      "--output",
      "json",
    ]),
  ) as { Name: string; Subject: string; Invite: string };
  console.log(`Updated ${after.Name} (${poolId}): subject "${before}" -> "${after.Subject}"; invite subject "${after.Invite}".`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
