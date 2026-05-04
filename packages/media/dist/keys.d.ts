import { type MediaConfig, type MediaTypeConfig } from "./config";
export interface BuildMediaKeyOptions {
    mediaType: string;
    contentType: string;
    id: string;
    customFilename?: string;
}
export interface ResolvedMediaKey {
    key: string;
    mediaType: string;
}
export declare function sanitizeFilenameBase(input: string): string | null;
export declare function isSafeObjectKey(key: string): boolean;
export declare function joinMediaKey(prefix: string, filename: string): string;
export declare function buildMediaKey(mediaTypeConfig: MediaTypeConfig, options: BuildMediaKeyOptions): string | null;
export declare function mediaTypeForKey(config: MediaConfig, key: string): string | null;
export declare function resolveRequestedKey(config: MediaConfig, key: string, path?: string): ResolvedMediaKey | null;
