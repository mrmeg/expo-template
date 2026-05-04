export type MediaProblem = {
    kind: "disabled";
    missing?: string[];
    details?: string[];
} | {
    kind: "bad-request";
    code?: string;
    message: string;
} | {
    kind: "unauthorized";
} | {
    kind: "forbidden";
    message: string;
} | {
    kind: "unknown";
    status: number;
    message: string;
};
export declare class MediaError extends Error {
    readonly problem: MediaProblem;
    constructor(problem: MediaProblem);
}
export declare function toMediaError(response: Response): Promise<MediaError>;
export declare function isMediaError(error: unknown): error is MediaError;
export declare function shouldRetryMediaError(failureCount: number, error: unknown): boolean;
