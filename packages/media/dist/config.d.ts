export type MediaProvider = "s3" | "r2";
export interface MediaBucketCredentials {
    accessKeyId?: string;
    secretAccessKey?: string;
}
export interface MediaBucketConfig {
    provider: MediaProvider;
    bucket?: string;
    endpoint?: string;
    region?: string;
    forcePathStyle?: boolean;
    credentials: MediaBucketCredentials;
}
export interface MediaTypeConfig<TBucket extends string = string> {
    bucket: TBucket;
    prefix: string;
    allowedContentTypes: readonly string[];
    maxBytes?: number;
    uploadExpiresInSeconds?: number;
    readExpiresInSeconds?: number;
}
export interface MediaConfig<TBuckets extends Record<string, MediaBucketConfig> = Record<string, MediaBucketConfig>, TMediaTypes extends Record<string, MediaTypeConfig<Extract<keyof TBuckets, string>>> = Record<string, MediaTypeConfig<Extract<keyof TBuckets, string>>>> {
    buckets: TBuckets;
    mediaTypes: TMediaTypes;
    disabled?: {
        missing?: string[];
        details?: string[];
    };
}
export type MediaTypeName<TConfig extends MediaConfig> = Extract<keyof TConfig["mediaTypes"], string>;
export interface MediaConfigValidation {
    valid: boolean;
    missing: string[];
    errors: string[];
}
export declare const DEFAULT_CONTENT_TYPE_EXTENSIONS: Record<string, string>;
export declare function createMediaConfig<const TConfig extends MediaConfig>(config: TConfig): TConfig;
export declare function isBlank(value: unknown): boolean;
export declare function normalizeMediaPrefix(prefix: string): string;
export declare function resolveContentTypeExtension(contentType: string): string | null;
export declare function getMediaTypeNames(config: MediaConfig): string[];
export declare function validateMediaConfig(config: MediaConfig): MediaConfigValidation;
export declare function getMediaTypeConfig(config: MediaConfig, mediaType: string): MediaTypeConfig | null;
export declare function getBucketConfig(config: MediaConfig, mediaType: string): MediaBucketConfig | null;
export declare function isAllowedContentType(settings: MediaTypeConfig, contentType: string): boolean;
