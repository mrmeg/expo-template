# @mrmeg/media-worker

Cloudflare Worker that serves the shared media API at
`cdn.mrmeg.com/api/media/*` so consumer apps (downrangedays, terlo) call one
endpoint instead of each bundling their own Expo API routes.

Private workspace package — never published to npm. All routing, validation, and
error contracts come from `@mrmeg/expo-media/worker`; `src/index.ts` is only
deployment wiring (R2 coordinates from `env`, KV bearer-token auth, CORS).

## URL Contract

Identical to the template's `app/api/media/[action]+api.ts`:

| Route | Methods |
|---|---|
| `/api/media/list` | `GET` (`?mediaType=`, `?prefix=`, `?limit=`, `?cursor=`) |
| `/api/media/getUploadUrl` | `POST` `{ mediaType, contentType, size?, customFilename?, metadata? }` |
| `/api/media/getSignedUrls` | `POST` `{ keys: string[], path? }` |
| `/api/media/delete` | `DELETE` `?key=` (single), `POST` `{ keys: string[] }` (batch) |

`OPTIONS` is answered for known actions. Unknown action → `404 not-found`;
known action with an unsupported method → `405 method-not-allowed`. Every
request needs `Authorization: Bearer <token>`; anything else is
`401 unauthorized`. Missing R2 config returns `503 media-disabled` without
signing anything.

Media types are `avatars` (`users/avatars`), `videos`, `thumbnails`, and
`uploads`, with the same content-type allowlists and size caps as the template's
`server/media/config.ts`.

## Configuration

| Name | Kind | Purpose |
|---|---|---|
| `MEDIA_AUTH` | KV namespace | `token:<token>` → `{"app":"<name>"}` |
| `R2_BUCKET` | var (`wrangler.jsonc`) | R2 bucket name |
| `R2_JURISDICTION_SPECIFIC_URL` | var (`wrangler.jsonc`) | R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | secret | R2 access key |
| `R2_SECRET_ACCESS_KEY` | secret | R2 secret key |

Secrets are never committed — `wrangler.jsonc` holds only the two non-secret
vars plus placeholders that the runbook below replaces.

## Deploy Runbook

Run from `workers/media/`. Deployment is manual and owner-run; there is no CI
deploy.

1. Build the package the Worker imports (from the repo root):

   ```sh
   bun run media:build
   ```

2. Create the auth KV namespace and paste the printed id into
   `wrangler.jsonc` (`kv_namespaces[0].id`):

   ```sh
   bunx wrangler kv namespace create MEDIA_AUTH
   ```

3. Fill in the two vars in `wrangler.jsonc` (`R2_BUCKET`,
   `R2_JURISDICTION_SPECIFIC_URL`), then set the secrets:

   ```sh
   bunx wrangler secret put R2_ACCESS_KEY_ID
   bunx wrangler secret put R2_SECRET_ACCESS_KEY
   ```

4. Provision a per-app token (repeat per consumer app; save the token in that
   app's own secret store — it is not recoverable from KV):

   ```sh
   TOKEN="$(openssl rand -hex 32)"
   bunx wrangler kv key put --binding MEDIA_AUTH "token:$TOKEN" '{"app":"downrangedays"}'
   echo "$TOKEN"
   ```

5. Verify the bundle, then deploy:

   ```sh
   bunx wrangler deploy --dry-run --outdir=dist-check
   bunx wrangler deploy
   ```

6. Smoke the live route:

   ```sh
   # no token -> 401 {"code":"unauthorized",...}
   curl -i "https://cdn.mrmeg.com/api/media/list?mediaType=avatars"

   # valid token -> 200 {"items":[...],"totalCount":n}
   curl -i -H "Authorization: Bearer $TOKEN" \
     "https://cdn.mrmeg.com/api/media/list?mediaType=avatars"

   # unknown action -> 404 {"code":"not-found",...}
   curl -i -H "Authorization: Bearer $TOKEN" "https://cdn.mrmeg.com/api/media/nope"
   ```

The route is path-scoped to `cdn.mrmeg.com/api/media/*`, so anything else
already serving that hostname keeps working.

## Token Operations

```sh
# list issued tokens (keys only; values hold the app metadata)
bunx wrangler kv key list --binding MEDIA_AUTH

# revoke
bunx wrangler kv key delete --binding MEDIA_AUTH "token:<token>"
```

Rotation is manual: add the new token, migrate the consumer app, delete the old
key.

## Local Development

```sh
bun run dev        # wrangler dev (needs the vars/secrets in .dev.vars)
bun run typecheck  # tsc --noEmit against @cloudflare/workers-types
```

`wrangler dev` reads local values from `.dev.vars`, which this directory's
`.gitignore` excludes. Production values only ever go through
`bunx wrangler secret put`.
