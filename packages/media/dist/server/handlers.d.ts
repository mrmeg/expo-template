import { type MediaConfig } from "../config";
type MaybePromise<T> = T | Promise<T>;
export interface MediaPolicyDecision {
    allowed: boolean;
    reason?: string;
    code?: string;
    allowCustomFilename?: boolean;
}
export type MediaPolicyResult = boolean | MediaPolicyDecision | undefined | null;
export interface MediaPolicyCallbacks<TAuth> {
    canUpload?: (context: {
        request: Request;
        auth: TAuth;
        mediaType: string;
        contentType: string;
        size?: number;
        customFilename?: string;
        metadata?: unknown;
    }) => MaybePromise<MediaPolicyResult>;
    canRead?: (context: {
        request: Request;
        auth: TAuth;
        keys: string[];
        mediaTypes: string[];
    }) => MaybePromise<MediaPolicyResult>;
    canList?: (context: {
        request: Request;
        auth: TAuth;
        mediaType?: string;
        prefix?: string;
    }) => MaybePromise<MediaPolicyResult>;
    canDelete?: (context: {
        request: Request;
        auth: TAuth;
        keys: string[];
        mediaTypes: string[];
    }) => MaybePromise<MediaPolicyResult>;
}
export interface MediaEventCallbacks<TAuth> {
    onUploadSigned?: (context: {
        request: Request;
        auth: TAuth;
        key: string;
        mediaType: string;
        contentType: string;
        metadata?: unknown;
    }) => MaybePromise<void>;
    onDeleted?: (context: {
        request: Request;
        auth: TAuth;
        keys: string[];
    }) => MaybePromise<void>;
}
export interface MediaCorsCallbacks {
    getHeaders?: (request: Request) => Record<string, string>;
    getPreflightHeaders?: (request: Request) => Record<string, string>;
}
export interface CreateMediaHandlersOptions<TAuth = unknown> {
    config: MediaConfig | (() => MediaConfig);
    authorize?: (request: Request) => MaybePromise<TAuth | null | undefined>;
    policy?: MediaPolicyCallbacks<TAuth>;
    events?: MediaEventCallbacks<TAuth>;
    cors?: MediaCorsCallbacks;
    idFactory?: () => string;
}
export interface MediaHandlers {
    options: (request: Request) => Promise<Response>;
    getUploadUrl: (request: Request) => Promise<Response>;
    getSignedUrls: (request: Request) => Promise<Response>;
    list: (request: Request) => Promise<Response>;
    deleteOne: (request: Request) => Promise<Response>;
    deleteMany: (request: Request) => Promise<Response>;
}
export declare function resetMediaStorageForTests(): void;
export declare function createMediaHandlers<TAuth = unknown>(options: CreateMediaHandlersOptions<TAuth>): MediaHandlers;
export {};
