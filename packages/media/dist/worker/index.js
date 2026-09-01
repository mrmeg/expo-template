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
import { createMediaHandlers, } from "../server/handlers.js";
const DEFAULT_BASE_PATH = "/api/media";
export function createMediaWorker(options) {
    const basePath = normalizeBasePath(options.basePath ?? DEFAULT_BASE_PATH);
    const cache = new WeakMap();
    function getRouter(env) {
        const cached = cache.get(env);
        if (cached)
            return cached;
        const handlerOptions = options.createOptions(env);
        const handlers = createMediaHandlers(handlerOptions);
        const router = {
            handlers,
            routes: buildRoutes(handlers),
            ...(handlerOptions.cors ? { cors: handlerOptions.cors } : {}),
        };
        cache.set(env, router);
        return router;
    }
    return {
        async fetch(request, env) {
            const router = getRouter(env);
            const action = resolveAction(new URL(request.url).pathname, basePath);
            const route = action ? router.routes[action] : undefined;
            if (!route) {
                return problem(request, router.cors, 404, "not-found", "Unknown media action");
            }
            if (request.method === "OPTIONS") {
                return router.handlers.options(request);
            }
            const handler = route[request.method];
            if (!handler) {
                return problem(request, router.cors, 405, "method-not-allowed", `${request.method} is not supported for this media action`);
            }
            return handler(request);
        },
    };
}
/**
 * Bearer-token `authorize` backed by Workers KV.
 *
 * Tokens are stored as `token:<token>` keys whose value is JSON metadata with at
 * least `{ "app": "<name>" }`. Anything missing, unknown, or unparseable yields
 * `null`, which the handlers turn into `401 unauthorized`.
 */
export function createKvTokenAuthorizer(kv) {
    return async function authorizeToken(request) {
        const token = readBearerToken(request);
        if (!token)
            return null;
        const raw = await kv.get(`token:${token}`);
        if (raw === null || raw === undefined)
            return null;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            console.warn("Media worker: stored token metadata is not valid JSON; rejecting request.");
            return null;
        }
        if (!isRecord(parsed) || typeof parsed.app !== "string" || parsed.app.trim() === "") {
            console.warn("Media worker: stored token metadata has no app field; rejecting request.");
            return null;
        }
        return { token, app: parsed.app, metadata: parsed };
    };
}
function buildRoutes(handlers) {
    return {
        list: { GET: handlers.list },
        getUploadUrl: { POST: handlers.getUploadUrl },
        getSignedUrls: { POST: handlers.getSignedUrls },
        delete: { DELETE: handlers.deleteOne, POST: handlers.deleteMany },
    };
}
function normalizeBasePath(basePath) {
    const trimmed = basePath.trim().replace(/\/+$/, "");
    if (!trimmed)
        return "";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
/** `${basePath}/{action}` and nothing deeper; anything else is not a route. */
function resolveAction(pathname, basePath) {
    const prefix = `${basePath}/`;
    if (!pathname.startsWith(prefix))
        return null;
    const action = pathname.slice(prefix.length);
    if (!action || action.includes("/"))
        return null;
    return action;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readBearerToken(request) {
    const header = request.headers.get("Authorization");
    if (!header)
        return null;
    const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
    return match?.[1] ?? null;
}
function problem(request, cors, status, code, message) {
    return new Response(JSON.stringify({ code, message }), {
        status,
        headers: { "Content-Type": "application/json", ...(cors?.getHeaders?.(request) ?? {}) },
    });
}
