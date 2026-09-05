/**
 * Guards the Cognito email templates in scripts/cognito-email/ against the rules
 * Cognito enforces at update time, so an agent editing the HTML finds out here rather
 * than from a rejected update-user-pool call.
 */

import * as path from "node:path";
import {
  buildUserPoolUpdate,
  CODE_PLACEHOLDER,
  MAX_BODY_LENGTH,
  MAX_SUBJECT_LENGTH,
  parseArgs,
  readEnvFile,
  regionFromPoolId,
  renderEmailTemplates,
  USERNAME_PLACEHOLDER,
  validateRendered,
} from "../apply-cognito-email-templates";

const templatesDir = path.resolve(__dirname, "../cognito-email");

describe("renderEmailTemplates", () => {
  const rendered = renderEmailTemplates("Acme Camera", templatesDir);

  it("substitutes the app name everywhere and leaves no placeholder behind", () => {
    expect(rendered.verification.subject).toBe("Your Acme Camera code");
    expect(rendered.invite.subject).toBe("Your Acme Camera account");
    expect(rendered.verification.html).toContain("Acme Camera");
    expect(rendered.verification.html).not.toContain("{{APP_NAME}}");
    expect(rendered.invite.html).not.toContain("{{APP_NAME}}");
  });

  it("keeps Cognito's own placeholders intact", () => {
    expect(rendered.verification.html).toContain(CODE_PLACEHOLDER);
    expect(rendered.invite.html).toContain(CODE_PLACEHOLDER);
    expect(rendered.invite.html).toContain(USERNAME_PLACEHOLDER);
  });

  it("stays within Cognito's size limits with room to grow", () => {
    expect(rendered.verification.html.length).toBeLessThan(MAX_BODY_LENGTH / 2);
    expect(rendered.invite.html.length).toBeLessThan(MAX_BODY_LENGTH / 2);
    expect(rendered.verification.subject.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
    expect(rendered.invite.subject.length).toBeLessThanOrEqual(MAX_SUBJECT_LENGTH);
  });

  it("HTML-escapes the app name", () => {
    const escaped = renderEmailTemplates("Tom & \"Jerry\" <Co>", templatesDir);
    expect(escaped.verification.html).toContain("Tom &amp; &quot;Jerry&quot; &lt;Co&gt;");
    expect(escaped.verification.html).not.toContain("<Co>");
  });

  it("rejects an empty app name", () => {
    expect(() => renderEmailTemplates("   ", templatesDir)).toThrow(/App name is empty/);
  });
});

describe("validateRendered", () => {
  const good = renderEmailTemplates("Acme", templatesDir);

  it("names every broken rule", () => {
    expect(() =>
      validateRendered({
        verification: { subject: "x".repeat(MAX_SUBJECT_LENGTH + 1), html: "<p>no code</p>" },
        invite: { subject: "<b>html</b>", html: "{####} but no username" },
      }),
    ).toThrow(/verification-code: body must contain \{####\}[\s\S]*subject is 141 chars[\s\S]*invite: body must contain \{username\}[\s\S]*subject must be plain text/);
  });

  it("rejects an oversized body", () => {
    expect(() =>
      validateRendered({
        ...good,
        verification: { ...good.verification, html: good.verification.html + "x".repeat(MAX_BODY_LENGTH) },
      }),
    ).toThrow(/Cognito allows 20000/);
  });
});

describe("buildUserPoolUpdate", () => {
  const rendered = renderEmailTemplates("Acme", templatesDir);
  const pool = {
    Id: "us-east-1_abc",
    Name: "acme",
    Policies: { PasswordPolicy: { MinimumLength: 8 }, SignInPolicy: { AllowedFirstAuthFactors: ["PASSWORD", "EMAIL_OTP"] } },
    DeletionProtection: "ACTIVE",
    LambdaConfig: {},
    AutoVerifiedAttributes: ["email"],
    VerificationMessageTemplate: { DefaultEmailOption: "CONFIRM_WITH_CODE" },
    MfaConfiguration: "OFF",
    EmailConfiguration: { EmailSendingAccount: "DEVELOPER", From: "Acme <no-reply@accounts.example.com>", SourceArn: "arn:aws:ses:us-east-1:1:identity/accounts.example.com" },
    AdminCreateUserConfig: { AllowAdminCreateUserOnly: false, UnusedAccountValidityDays: 7 },
    AccountRecoverySetting: { RecoveryMechanisms: [{ Priority: 1, Name: "verified_email" }] },
    UserPoolTier: "ESSENTIALS",
    // Not updatable; must not leak into the request.
    UsernameAttributes: ["email"],
    EstimatedNumberOfUsers: 3,
    Arn: "arn:aws:cognito-idp:us-east-1:1:userpool/us-east-1_abc",
  };

  const update = buildUserPoolUpdate(pool, rendered);

  it("carries every updatable field through unchanged", () => {
    expect(update.UserPoolId).toBe("us-east-1_abc");
    expect(update.Policies).toEqual(pool.Policies);
    expect(update.EmailConfiguration).toEqual(pool.EmailConfiguration);
    expect(update.UserPoolTier).toBe("ESSENTIALS");
    expect(update.AccountRecoverySetting).toEqual(pool.AccountRecoverySetting);
  });

  it("omits empty and non-updatable fields", () => {
    expect(update).not.toHaveProperty("LambdaConfig");
    expect(update).not.toHaveProperty("UsernameAttributes");
    expect(update).not.toHaveProperty("EstimatedNumberOfUsers");
    expect(update).not.toHaveProperty("Arn");
  });

  it("installs both templates and drops the deprecated validity field", () => {
    const verification = update.VerificationMessageTemplate as Record<string, unknown>;
    expect(verification.DefaultEmailOption).toBe("CONFIRM_WITH_CODE");
    expect(verification.EmailSubject).toBe("Your Acme code");
    expect(verification.EmailMessage).toContain(CODE_PLACEHOLDER);

    const admin = update.AdminCreateUserConfig as Record<string, unknown>;
    expect(admin).not.toHaveProperty("UnusedAccountValidityDays");
    expect(admin.AllowAdminCreateUserOnly).toBe(false);
    const invite = admin.InviteMessageTemplate as Record<string, unknown>;
    expect(invite.EmailSubject).toBe("Your Acme account");
    expect(invite.EmailMessage).toContain(USERNAME_PLACEHOLDER);
  });

  it("does not mutate the described pool", () => {
    expect(pool.AdminCreateUserConfig).toHaveProperty("UnusedAccountValidityDays");
    expect(pool.VerificationMessageTemplate).not.toHaveProperty("EmailSubject");
  });
});

describe("CLI helpers", () => {
  it("parses flags", () => {
    expect(parseArgs(["--dry-run", "--pool", "us-east-1_x", "--app-name", "Acme"])).toEqual({
      dryRun: true,
      pool: "us-east-1_x",
      appName: "Acme",
    });
    expect(() => parseArgs(["--bogus"])).toThrow(/Unknown argument/);
    expect(() => parseArgs(["--pool"])).toThrow(/Missing value/);
  });

  it("derives the region from the pool id", () => {
    expect(regionFromPoolId("us-east-1_MdMJDKWUx")).toBe("us-east-1");
    expect(regionFromPoolId("eu-west-2_abc")).toBe("eu-west-2");
    expect(regionFromPoolId("nonsense")).toBeUndefined();
  });

  it("reads quoted and unquoted .env values and ignores comments", () => {
    const file = path.join(require("node:os").tmpdir(), `env-${process.pid}.test`);
    require("node:fs").writeFileSync(file, "# c\nA=\"x y\"\nB=z\nC='q'\nBROKEN\n");
    expect(readEnvFile(file)).toEqual({ A: "x y", B: "z", C: "q" });
    require("node:fs").rmSync(file);
    expect(readEnvFile(file)).toEqual({});
  });
});
