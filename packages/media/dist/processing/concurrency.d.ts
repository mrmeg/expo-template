/**
 * Bounded async mapping.
 *
 * Image processing decodes a full-resolution bitmap per asset, so running a
 * 20-photo selection through an unbounded `Promise.all` peaks at 20 concurrent
 * decodes and reliably janks (web) or gets the app killed (native). Results stay
 * in input order regardless of completion order.
 */
export declare function mapWithConcurrency<TInput, TOutput>(items: readonly TInput[], limit: number, worker: (item: TInput, index: number) => Promise<TOutput>): Promise<TOutput[]>;
