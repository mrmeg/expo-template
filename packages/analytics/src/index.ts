/**
 * Platform-neutral entry: the core tracker and the wire contract. Use `./web`
 * in a browser and `./native` in React Native; both wrap this core.
 */
export { createTracker } from "./client/tracker";
export type {
  EventMap,
  FlushOptions,
  KeyValueStorage,
  TrackArgs,
  Tracker,
  TrackerOptions,
  Transport,
  TransportRequest,
  TransportResponse,
} from "./client/tracker";

export { EVENT_NAME_PATTERN, LIMITS, LINK_CLICK_PARAM, PLATFORMS, RESERVED_EVENTS } from "./shared/wire";
export type {
  IngestResponse,
  Platform,
  ReservedEventName,
  WireAcquisition,
  WireBatch,
  WireContext,
  WireEvent,
} from "./shared/wire";
