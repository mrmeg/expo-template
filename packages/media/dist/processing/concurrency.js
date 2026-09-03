/**
 * Bounded async mapping.
 *
 * Image processing decodes a full-resolution bitmap per asset, so running a
 * 20-photo selection through an unbounded `Promise.all` peaks at 20 concurrent
 * decodes and reliably janks (web) or gets the app killed (native). Results stay
 * in input order regardless of completion order.
 */
export async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    if (items.length === 0)
        return results;
    const bound = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
    let nextIndex = 0;
    async function run() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await worker(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: bound }, run));
    return results;
}
