// No `loader` export here on purpose: loader payloads are exported as a
// build-time snapshot keyed by this file's path, so a param'd route's fetch
// 404s in a production build. The screen reads its param and fetches
// `/api/template/examples` instead. See docs/server-guide.md.
export { default } from "@/client/features/server-alpha/ServerAlphaExampleScreen";
