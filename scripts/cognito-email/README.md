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
- Cognito sends the HTML as-is: inline styles for the light baseline, table layout, no
  external CSS or scripts. The one `<style>` block in `<head>` is a
  `prefers-color-scheme: dark` layer that clients honouring it apply on top; clients
  that strip it still get the complete light email. Images are fine but must be
  absolute `https` URLs.

## Design

The templates are the email-shaped version of the `@mrmeg/expo-ui` theme, so a code
email reads as the same product as the sign-in card that asked for it. When the theme
changes, update these values by hand (email HTML cannot import the tokens):

| Email | Theme token | Light | Dark |
|---|---|---|---|
| Page background | `surfaceSunken` | `#fafafa` | `#09090b` |
| Card fill / border | `card` / `border` | `#ffffff` / `#e4e4e7` | `#18181b` / `#27272a` |
| Code and details panel | `muted` / `border` (`borderStrong` in dark) | `#f4f4f5` / `#e4e4e7` | `#27272a` / `#3f3f46` |
| Title, code, values | `foreground` | `#09090b` | `#f4f4f5` |
| Body copy | `textDim` | `#52525b` | `#b0b0b8` |
| Eyebrow, labels, hint | `gray500` | `#71717a` | `#a1a1aa` |
| Footer | `gray400` | `#a1a1aa` | `#71717a` |

Spacing follows the density tokens: `sectionSpacing`/`screenPadding` (24/16) around
the card, `dialogPadding` (20) inside it, `spacing.md` (16) between blocks,
`rowPaddingY`/`rowPaddingX` (10/16) for the invite's detail rows. Radii are
`radiusLg` (14) for the card and `radiusMd` (12) for the inset panel, matching `Card`
and `TextInput`. Type is Inter with the system stack as fallback: 12px/600 uppercase
eyebrow, 20px/600 title, 14px body, 13px hint, 12px footer; the code is 28px
monospace with 0.2em tracking, which keeps an 8-digit code inside the card on a
320px-wide screen.

The rendered body is stored on the user pool (`VerificationMessageTemplate` and
`AdminCreateUserConfig.InviteMessageTemplate`), not in SES. To vary copy per event or
per language, the next step up is Cognito's CustomMessage Lambda trigger; this folder is
the static baseline every pool gets.
