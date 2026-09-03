#!/usr/bin/env bash
#
# Create a Cognito user pool wired for this template's sign-in methods:
# password, email one-time code (passwordless), and — once you register the
# identity providers at the bottom — Google/Apple through Managed Login.
#
# Where to run it:
#   - locally, with an AWS profile that can call cognito-idp
#     (`AWS_PROFILE=my-admin bash scripts/create-cognito-pool.sh`), or
#   - pasted into CloudShell in the target account/region, which already has
#     credentials and a current AWS CLI.
#
# Needs AWS CLI v2.22+ (`--user-pool-tier`, `--managed-login-version`).
# Everything is a create: run it once per environment. Re-running with the same
# names fails on the domain (globally unique) rather than silently reusing it.
#
# Cost note: EMAIL_OTP and Managed Login v2 are Essentials-tier features, so the
# pool is created as ESSENTIALS — that tier is billed per monthly active user.
# Lite/free-tier pools cannot do email codes.
#
# Configure by env var:
#   POOL_NAME       user pool name                     (default: expo-template)
#   CLIENT_NAME     app client name                    (default: <POOL_NAME>-app)
#   REGION          AWS region                         (default: from your CLI config)
#   DOMAIN_PREFIX   Managed Login prefix, globally unique in the region
#                                                      (default: <POOL_NAME>-<account id>)
#   APP_SCHEME      native deep-link scheme, no "://"  (default: myapp)
#   WEB_ORIGINS     comma-separated web origins        (default: http://localhost:8081)
#   SES_FROM_EMAIL  verified SES sender, e.g. "App <no-reply@example.com>"
#   SES_SOURCE_ARN  ARN of that verified SES identity
#   SKIP_DOMAIN     set to 1 to skip the Managed Login domain (password/email
#                   code only; social sign-in needs the domain)
#
# SES: without SES_FROM_EMAIL + SES_SOURCE_ARN the pool uses Cognito's built-in
# sender, which is capped at 50 emails/day and is not usable beyond development.
# Email codes are emails, so set both before any real traffic.

set -euo pipefail

POOL_NAME="${POOL_NAME:-expo-template}"
CLIENT_NAME="${CLIENT_NAME:-${POOL_NAME}-app}"
APP_SCHEME="${APP_SCHEME:-myapp}"
WEB_ORIGINS="${WEB_ORIGINS:-http://localhost:8081}"
SES_FROM_EMAIL="${SES_FROM_EMAIL:-}"
SES_SOURCE_ARN="${SES_SOURCE_ARN:-}"
SKIP_DOMAIN="${SKIP_DOMAIN:-}"

command -v aws >/dev/null 2>&1 || {
  echo "error: aws CLI not found. Install AWS CLI v2 or run this in CloudShell." >&2
  exit 1
}

REGION="${REGION:-$(aws configure get region || true)}"
if [ -z "$REGION" ]; then
  echo "error: no region. Set REGION=us-east-1 (or configure your AWS CLI)." >&2
  exit 1
fi

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DOMAIN_PREFIX="${DOMAIN_PREFIX:-${POOL_NAME}-${ACCOUNT_ID}}"

# Callback/logout URLs the app can be redirected back to. `<scheme>://` matches
# what client/lib/identity builds on native; the web entries must match the
# origins the browser actually loads (add your production origin here).
CALLBACK_URLS=("${APP_SCHEME}://")
IFS=',' read -r -a WEB_ORIGIN_LIST <<< "$WEB_ORIGINS"
for origin in "${WEB_ORIGIN_LIST[@]}"; do
  origin="$(echo "$origin" | tr -d '[:space:]')"
  [ -n "$origin" ] && CALLBACK_URLS+=("$origin")
done

echo "==> Region:       $REGION"
echo "==> Pool name:    $POOL_NAME"
echo "==> Client name:  $CLIENT_NAME"
echo "==> Callback URLs: ${CALLBACK_URLS[*]}"
echo

# ---------------------------------------------------------------------------
# 1. User pool
#
# SignInPolicy.AllowedFirstAuthFactors is what makes the choice-based USER_AUTH
# flow offer email codes: PASSWORD keeps the password form working, EMAIL_OTP is
# what `signInWithEmailCode` asks for as its preferred challenge. Email is both
# the username and an auto-verified attribute, so the code can be delivered to
# the address the user typed.
#
# The password policy must never be stricter than the app's client-side
# validation — SignUpForm checks length >= 8 and nothing else, so the pool
# checks the same or users pass the form and then fail at Cognito.
# ---------------------------------------------------------------------------
EMAIL_CONFIG=(--email-configuration "EmailSendingAccount=COGNITO_DEFAULT")
if [ -n "$SES_FROM_EMAIL" ] && [ -n "$SES_SOURCE_ARN" ]; then
  EMAIL_CONFIG=(--email-configuration \
    "EmailSendingAccount=DEVELOPER,From=${SES_FROM_EMAIL},SourceArn=${SES_SOURCE_ARN}")
else
  echo "!! No SES_FROM_EMAIL/SES_SOURCE_ARN: using Cognito's 50 emails/day sender (dev only)."
  echo
fi

echo "==> Creating user pool..."
POOL_ID="$(aws cognito-idp create-user-pool \
  --region "$REGION" \
  --pool-name "$POOL_NAME" \
  --user-pool-tier ESSENTIALS \
  --username-attributes email \
  --auto-verified-attributes email \
  --mfa-configuration OFF \
  --deletion-protection ACTIVE \
  --username-configuration CaseSensitive=false \
  --account-recovery-setting 'RecoveryMechanisms=[{Priority=1,Name=verified_email}]' \
  --admin-create-user-config "AllowAdminCreateUserOnly=false" \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": false,
      "RequireLowercase": false,
      "RequireNumbers": false,
      "RequireSymbols": false
    },
    "SignInPolicy": {
      "AllowedFirstAuthFactors": ["PASSWORD", "EMAIL_OTP"]
    }
  }' \
  "${EMAIL_CONFIG[@]}" \
  --query 'UserPool.Id' --output text)"
echo "    $POOL_ID"

# ---------------------------------------------------------------------------
# 2. Managed Login domain (required for social sign-in only)
#
# `--managed-login-version 2` selects the branding-designer hosted UI, and a
# v2 domain needs a branding style to exist before the pages render — the
# create-managed-login-branding call below asks for Cognito's defaults.
# ---------------------------------------------------------------------------
COGNITO_DOMAIN=""
if [ -n "$SKIP_DOMAIN" ]; then
  echo "==> Skipping Managed Login domain (SKIP_DOMAIN set); social sign-in stays off."
else
  echo "==> Creating Managed Login domain '$DOMAIN_PREFIX'..."
  aws cognito-idp create-user-pool-domain \
    --region "$REGION" \
    --user-pool-id "$POOL_ID" \
    --domain "$DOMAIN_PREFIX" \
    --managed-login-version 2 >/dev/null
  COGNITO_DOMAIN="${DOMAIN_PREFIX}.auth.${REGION}.amazoncognito.com"
  echo "    $COGNITO_DOMAIN"
fi

# ---------------------------------------------------------------------------
# 3. App client
#
# ALLOW_USER_AUTH is the choice-based flow the email-code path uses;
# ALLOW_USER_SRP_AUTH keeps password sign-in, ALLOW_REFRESH_TOKEN_AUTH keeps
# sessions alive. No client secret: the app is a public client. The 365-day
# refresh token is deliberate — sessions that survive a year instead of
# logging users out weekly.
# ---------------------------------------------------------------------------
echo "==> Creating app client..."
CLIENT_ARGS=(
  --region "$REGION"
  --user-pool-id "$POOL_ID"
  --client-name "$CLIENT_NAME"
  --no-generate-secret
  --explicit-auth-flows ALLOW_USER_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
  --supported-identity-providers COGNITO
  --prevent-user-existence-errors ENABLED
  --enable-token-revocation
  --refresh-token-validity 365
  --access-token-validity 60
  --id-token-validity 60
  --token-validity-units "AccessToken=minutes,IdToken=minutes,RefreshToken=days"
)
if [ -n "$COGNITO_DOMAIN" ]; then
  CLIENT_ARGS+=(
    --callback-urls "${CALLBACK_URLS[@]}"
    --logout-urls "${CALLBACK_URLS[@]}"
    --allowed-o-auth-flows code
    --allowed-o-auth-scopes openid email profile
    --allowed-o-auth-flows-user-pool-client
  )
fi

CLIENT_ID="$(aws cognito-idp create-user-pool-client "${CLIENT_ARGS[@]}" \
  --query 'UserPoolClient.ClientId' --output text)"
echo "    $CLIENT_ID"

if [ -n "$COGNITO_DOMAIN" ]; then
  echo "==> Applying Cognito's default Managed Login branding..."
  aws cognito-idp create-managed-login-branding \
    --region "$REGION" \
    --user-pool-id "$POOL_ID" \
    --client-id "$CLIENT_ID" \
    --use-cognito-provided-values >/dev/null
fi

# ---------------------------------------------------------------------------
# 4. Identity providers — operator step, credentials come from Google/Apple
#
# Uncomment and fill in, then re-attach the providers to the client (step 5).
# The provider *names* matter: Amplify's `signInWithRedirect({ provider })`
# sends "Google" and "SignInWithApple", which is what this template's
# `EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS=google,apple` maps to.
#
# Google (Cloud console → Credentials → OAuth client, type "Web application";
# authorized redirect URI: https://<domain>/oauth2/idpresponse):
#
# aws cognito-idp create-identity-provider \
#   --region "$REGION" \
#   --user-pool-id "$POOL_ID" \
#   --provider-name Google \
#   --provider-type Google \
#   --provider-details \
#     client_id=<GOOGLE_CLIENT_ID>,client_secret=<GOOGLE_CLIENT_SECRET>,authorize_scopes="openid email profile" \
#   --attribute-mapping email=email,email_verified=email_verified,username=sub
#
# Apple (developer.apple.com → a Services ID with "Sign in with Apple", a
# private key, and https://<domain>/oauth2/idpresponse as the return URL):
#
# aws cognito-idp create-identity-provider \
#   --region "$REGION" \
#   --user-pool-id "$POOL_ID" \
#   --provider-name SignInWithApple \
#   --provider-type SignInWithApple \
#   --provider-details \
#     client_id=<APPLE_SERVICES_ID>,team_id=<APPLE_TEAM_ID>,key_id=<APPLE_KEY_ID>,private_key="$(cat AuthKey_XXXXXXXX.p8)",authorize_scopes="email name" \
#   --attribute-mapping email=email,email_verified=email_verified,username=sub
#
# ---------------------------------------------------------------------------
# 5. Let the client use them
#
# update-user-pool-client replaces the whole client configuration, so pass the
# OAuth settings again alongside the new provider list:
#
# aws cognito-idp update-user-pool-client \
#   --region "$REGION" \
#   --user-pool-id "$POOL_ID" \
#   --client-id "$CLIENT_ID" \
#   --supported-identity-providers COGNITO Google SignInWithApple \
#   --explicit-auth-flows ALLOW_USER_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
#   --callback-urls "${CALLBACK_URLS[*]}" \
#   --logout-urls "${CALLBACK_URLS[*]}" \
#   --allowed-o-auth-flows code \
#   --allowed-o-auth-scopes openid email profile \
#   --allowed-o-auth-flows-user-pool-client \
#   --prevent-user-existence-errors ENABLED
# ---------------------------------------------------------------------------

cat <<EOF

Done. Add to .env:

EXPO_PUBLIC_AUTH_PROVIDER="cognito"
EXPO_PUBLIC_USER_POOL_ID="$POOL_ID"
EXPO_PUBLIC_USER_POOL_CLIENT_ID="$CLIENT_ID"
EXPO_PUBLIC_COGNITO_DOMAIN="$COGNITO_DOMAIN"
EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS=""

Password and email-code sign-in work now. Fill
EXPO_PUBLIC_AUTH_SOCIAL_PROVIDERS with "google", "apple", or "google,apple"
only after steps 4 and 5 above — and on native, run a dev build, since
signInWithRedirect needs the autolinked @aws-amplify/rtn-web-browser module.
EOF
