/**
 * In-memory idempotency cache for Stripe webhook event IDs.
 *
 * Stripe delivers the same event more than once in a variety of
 * conditions (network retries, dashboard replay). The webhook handler
 * MUST be idempotent; this cache is a fast short-circuit so the same
 * event id is not fanned out twice in a row.
 *
 * For production deployments that run more than one server instance,
 * this cache is NOT sufficient on its own — replace with a shared
 * store (Redis, Postgres unique index) in the bootstrap spec. The
 * contract (`wasProcessed(id)` / `markProcessed(id)`) stays the same.
 */

export interface IdempotencyStore {
  wasProcessed(id: string): Promise<boolean>;
  markProcessed(id: string): Promise<void>;
}

export interface MemoryIdempotencyStoreOptions {
  maxEntries?: number;
}

export function createMemoryIdempotencyStore(
  options: MemoryIdempotencyStoreOptions = {},
): IdempotencyStore {
  const maxEntries = options.maxEntries ?? 5000;
  const seen = new Set<string>();
  const order: string[] = [];

  return {
    async wasProcessed(id: string) {
      return seen.has(id);
    },
    async markProcessed(id: string) {
      if (seen.has(id)) return;
      seen.add(id);
      order.push(id);
      while (order.length > maxEntries) {
        const evicted = order.shift();
        if (evicted) seen.delete(evicted);
      }
    },
  };
}
