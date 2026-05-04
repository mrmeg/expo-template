export interface ThumbnailResult {
    uri: string;
    width: number;
    height: number;
    blob?: Blob;
}
export declare function extractVideoThumbnail(videoUri: string, timeMs?: number): Promise<ThumbnailResult | null>;
