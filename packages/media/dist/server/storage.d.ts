import type { MediaBucketConfig } from "../config";
export interface MediaStorageObject {
    key: string;
    size: number;
    lastModified: string;
}
export interface MediaStorageListResult {
    items: MediaStorageObject[];
    nextContinuationToken?: string;
}
export interface PresignPutUrlOptions {
    bucket: MediaBucketConfig;
    key: string;
    contentType: string;
    expiresIn: number;
}
export interface PresignGetUrlOptions {
    bucket: MediaBucketConfig;
    key: string;
    expiresIn: number;
}
export interface ListObjectsOptions {
    bucket: MediaBucketConfig;
    prefix?: string;
    maxKeys?: number;
    continuationToken?: string;
}
export interface DeleteObjectOptions {
    bucket: MediaBucketConfig;
    key: string;
}
export declare function resetMediaStorageForTests(): void;
export declare function presignPutUrl(options: PresignPutUrlOptions): Promise<string>;
export declare function presignGetUrl(options: PresignGetUrlOptions): Promise<string>;
export declare function listObjects(options: ListObjectsOptions): Promise<MediaStorageListResult>;
export declare function deleteObject(options: DeleteObjectOptions): Promise<void>;
export declare function getBucketClientCacheKey(bucket: MediaBucketConfig): string;
