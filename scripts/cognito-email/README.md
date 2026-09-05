# Cognito email templates

The HTML and subject files in this folder are what Cognito sends for **every code
email**: sign-up confirmation, email-code sign-in, password reset, attribute
verification (`verification-code.*`), and the invitation for admin-created users
(`invite.*`). Cognito has one template per pool for all code emails, so keep the copy
generic enough to read correctly in each of those situations.

Edit the files, then push them to the pool:

```bash
bun run auth:emails --dry-run   # render with this app's name and validate, no AWS call
bun run auth:emails             # apply to EXPO_PUBLIC_USER_POOL_ID from .env
bun run auth:emails --pool us-east-1_xxx --app-name "Acme"   # any pool, explicit name
```

`scripts/create-cognito-pool.sh` applies them automatically when it creates a pool.

## Placeholders

| Token | Replaced by |
|---|---|
| `{{APP_NAME}}` | `--app-name`, else `EXPO_PUBLIC_APP_NAME` from `.env` (HTML-escaped) |
| `{####}` | the code or temporary password — Cognito fills this in at send time |
| `{username}` | the username, invite template only — filled in by Cognito |

## Constraints Cognito enforces (the test in `scripts/__tests__` checks them)

- Verification body must contain `{####}`; invite body must contain both `{username}`
  and `{####}`.
- Body at most 20,000 characters; subject at most 140 characters, plain text.
- Cognito sends the HTML as-is: inline styles only, table layout, no external CSS or
  scripts. Images are fine but must be absolute `https` URLs.

The rendered body is stored on the user pool (`VerificationMessageTemplate` and
`AdminCreateUserConfig.InviteMessageTemplate`), not in SES. To vary copy per event or
per language, the next step up is Cognito's CustomMessage Lambda trigger; this folder is
the static baseline every pool gets.
