/**
 * Cloudflare Worker entrypoint for the media handlers.
 *
 * `createMediaHandlers` captures its options at creation time, but a Worker only
 * receives `env` inside `fetch(request, env, ctx)`. So handler creation is
 * deferred to the first request and cached per `env` object — `env` is stable
 * for the life of an isolate, which makes a `WeakMap` the right cache.
 *
 * The routing table mirrors the template's `app/api/media/[action]+api.ts` so
 * the URL contract is identical whether the API is served by an Expo API route
 * or by this Worker.
 *
 * Nothing here imports Cloudflare types: `MediaTokenStore` is the minimal
 * structural shape of a KV namespace, so the published package stays free of
 * `@cloudflare/workers-types`.
 */
import { type CreateMediaHandlersOptions } from "../server/handlers";
/** Minimal structural view of a Workers KV namespace (text reads only). */
export interface MediaTokenStore {
    get(key: string): Promise<string | null>;
}
/** Auth object produced by {@link createKvTokenAuthorizer}. */
export interface MediaTokenAuth {
    token: string;
    app: string;
    metadata: Record<string, unknown>;
}
export interface CreateMediaWorkerOptions<TEnv extends object, TAuth = unknown> {
    /**
     * Builds the `createMediaHandlers` options from the Worker `env`. Called once
     * per `env` object; the resulting handlers are cached for that env.
     */
    createOptions: (env: TEnv) => CreateMediaHandlersOptions<TAuth>;
    /** Path prefix the action segment hangs off. Defaults to `/api/media`. */
    basePath?: string;
}
/** Shape assignable to a Worker module `export default`. */
export interface MediaWorker<TEnv extends object> {
    fetch(request: Request, env: TEnv, ctx?: unknown): Promise<Response>;
}
export declare function createMediaWorker<TEnv extends object, TAuth = unknown>(options: CreateMediaWorkerOptions<TEnv, TAuth>): MediaWorker<TEnv>;
/**
 * Bearer-token `authorize` backed by Workers KV.
 *
 * Tokens are stored as `token:<token>` keys whose value is JSON metadata with at
 * least `{ "app": "<name>" }`. Anything missing, unknown, or unparseable yields
 * `null`, which the handlers turn into `401 unauthorized`.
 */
export declare function createKvTokenAuthorizer(kv: MediaTokenStore): (request: Request) => Promise<MediaTokenAuth | null>;
