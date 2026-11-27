/** Test doubles shared by the client, web and native tracker tests. */
import type { KeyValueStorage, Transport, TransportRequest, TransportResponse } from "../tracker";
import type { WireBatch } from "../../shared/wire";

export interface SentRequest {
  request: TransportRequest;
  batch: WireBatch;
}

export interface FakeTransport {
  transport: Transport;
  sent: SentRequest[];
  /** Answers every following request until changed. */
  respond(answer: number | Error | ((request: TransportRequest) => Promise<TransportResponse>)): void;
  /** Holds every following request until the returned resolvers are called. */
  hold(): { release(status?: number): void; fail(error?: Error): void }[];
  names(index?: number): string[];
}

export function fakeTransport(): FakeTransport {
  const sent: SentRequest[] = [];
  let answer: (request: TransportRequest) => Promise<TransportResponse> = () =>
    Promise.resolve({ status: 200 });
  const held: { release(status?: number): void; fail(error?: Error): void }[] = [];
  let holding = false;

  const transport: Transport = (request) => {
    sent.push({ request, batch: JSON.parse(request.body) as WireBatch });
    if (holding) {
      return new Promise<TransportResponse>((resolve, reject) => {
        held.push({
          release: (status = 200) => resolve({ status }),
          fail: (error = new Error("network down")) => reject(error),
        });
      });
    }
    return answer(request);
  };

  return {
    transport,
    sent,
    respond: (next) => {
      holding = false;
      if (typeof next === "number") answer = () => Promise.resolve({ status: next });
      else if (next instanceof Error) answer = () => Promise.reject(next);
      else answer = next;
    },
    hold: () => {
      holding = true;
      return held;
    },
    names: (index) => {
      const batches = index === undefined ? sent : [sent[index]!];
      return batches.flatMap((entry) => entry.batch.events.map((event) => event.name));
    },
  };
}

export interface FakeStorage extends KeyValueStorage {
  data: Map<string, string>;
  getItem: jest.Mock<Promise<string | null>, [string]>;
  setItem: jest.Mock<Promise<void>, [string, string]>;
  removeItem: jest.Mock<Promise<void>, [string]>;
}

export function fakeStorage(initial: Record<string, string> = {}): FakeStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

/** Deterministic ids: "id-1", "id-2", ... */
export function sequentialIds(prefix = "id"): () => string {
  let next = 0;
  return () => `${prefix}-${++next}`;
}

/** Lets pending promise continuations run without moving fake time. */
export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}
