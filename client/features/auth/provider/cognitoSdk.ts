/**
 * Single lazy entry point for the AWS Amplify SDK.
 *
 * Everything Cognito needs from Amplify is imported statically here and
 * re-exported, so `cognitoClient.ts` can reach the whole SDK through one
 * `await import("./cognitoSdk")`.
 *
 * That indirection is load-bearing on web: Metro hoists any module shared by
 * two async chunks into the eagerly `<script>`-loaded `__common` bundle, so a
 * dependency stays lazy only when it has exactly one split point. Importing
 * `aws-amplify`, `aws-amplify/utils`, and `aws-amplify/auth` from three
 * separate `import()` calls created three chunks over one shared graph, which
 * pushed the whole Amplify cluster — `@aws-amplify/core`, `@aws-amplify/auth`
 * and their `rxjs`/`uuid`/`@aws-crypto` deps, 489 kB raw / 103 kB gzip as
 * measured — into `__common`, downloaded before first render by every visitor,
 * including Clerk-only and auth-disabled deploys. Routed through this module it
 * ships as one async chunk that loads only when Cognito is the active provider.
 *
 * Consequence for maintainers: nothing in the eager graph may import this
 * module, and new Amplify APIs belong here rather than in a second
 * `import("aws-amplify/…")` elsewhere. This mirrors how `clerkClient.ts` owns
 * the Clerk cluster (see the doc comment in `AuthProviderGate.tsx`).
 */

import { Amplify } from "aws-amplify";
import { Hub } from "aws-amplify/utils";
// The whole auth namespace: getCurrentUser, fetchAuthSession, signIn, signUp,
// confirmSignUp, autoSignIn, resendSignUpCode, resetPassword,
// confirmResetPassword, signOut.
import * as amplifyAuth from "aws-amplify/auth";

export { Amplify, Hub, amplifyAuth };
