// No `loader` export here on purpose. Loaders run per request under server
// rendering and a param'd loader is addressable there, but fetching the paired
// API route is the one data path that works on every rendering mode, including
// native and a static (non-server) web export. The screen reads its param and
// fetches `/api/template/examples`. See docs/server-guide.md.
export { default } from "@/client/features/server-alpha/ServerAlphaExampleScreen";
