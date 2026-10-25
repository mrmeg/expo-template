import type { MediaUploadOptions, MediaUploadResult } from "../../client";
import type { PickedMediaAsset } from "../../picker/types";
import type { ProcessAssetOptions, ProcessedUpload } from "../../processing/processAsset";
import { createUploadQueueRunner } from "../runner";
import type { UploadQueueItem, UploadQueueOptions } from "../types";

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-settled promise run its continuations. */
export async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function makeAsset(id: string, overrides: Partial<PickedMediaAsset> = {}): PickedMediaAsset {
  return {
    id,
    uri: `file:///${id}.jpg`,
    fileName: `${id}.jpg`,
    contentType: "image/jpeg",
    kind: "image",
    width: 100,
    height: 100,
    ...overrides,
  };
}

export function makeProcessed(overrides: Partial<ProcessedUpload> = {}): ProcessedUpload {
  return {
    kind: "image",
    uri: "file:///processed.jpg",
    contentType: "image/jpeg",
    width: 100,
    height: 100,
    size: 1234,
    applied: ["encode:image/jpeg"],
    originalSize: 5000,
    overBudget: false,
    ...overrides,
  };
}

export const ALLOWLIST = {
  image: ["image/jpeg", "image/png"],
  video: ["video/mp4"],
} as const;

export interface ProcessCall {
  options: ProcessAssetOptions;
  result: Deferred<ProcessedUpload>;
}

export interface UploadCall {
  options: MediaUploadOptions<string>;
  result: Deferred<MediaUploadResult>;
}

/**
 * A runner whose `processAsset` and `upload` wait on promises the test settles,
 * so ordering is explicit and nothing depends on timers.
 */
export function createHarness(overrides: Partial<UploadQueueOptions<string>> = {}) {
  const processCalls: ProcessCall[] = [];
  const uploadCalls: UploadCall[] = [];

  const options: UploadQueueOptions<string> = {
    allowlist: ALLOWLIST,
    resolve: () => ({ mediaType: "uploads", compression: null }),
    processAsset: jest.fn((processOptions: ProcessAssetOptions) => {
      const result = deferred<ProcessedUpload>();
      processCalls.push({ options: processOptions, result });
      return result.promise;
    }),
    upload: jest.fn((uploadOptions: MediaUploadOptions<string>) => {
      const result = deferred<MediaUploadResult>();
      uploadCalls.push({ options: uploadOptions, result });
      return result.promise;
    }),
    ...overrides,
  };

  const runner = createUploadQueueRunner<string>(() => options);

  const find = (id: string): UploadQueueItem => {
    const item = runner.getItems().find((candidate) => candidate.id === id);
    if (!item) throw new Error(`No queue item ${id}`);
    return item;
  };

  const uploaded = (key: string): MediaUploadResult => ({
    key,
    uploadUrl: `https://bucket.example/${key}`,
    expiresAt: "2030-01-01T00:00:00Z",
  });

  return { runner, options, processCalls, uploadCalls, find, uploaded };
}

export function statuses(items: readonly UploadQueueItem[]): Record<string, string> {
  return Object.fromEntries(items.map((item) => [item.id, item.status]));
}
