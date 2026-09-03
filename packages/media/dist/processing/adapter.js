/**
 * The platform seam.
 *
 * Everything platform-specific about image processing is reachable through this
 * one interface: probe, sniff, HEIC decode, encode, measure, release. The
 * orchestrator and the ladder are then plain functions that can be tested on
 * either platform's behaviour with a fake adapter — which matters here because
 * Metro's `.native.ts` resolution means a test process only ever sees one of the
 * two real implementations.
 */
export {};
