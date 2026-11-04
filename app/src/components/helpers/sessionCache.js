/**
 * Session-lifetime request memo: concurrent callers share the in-flight
 * promise, a fulfilled result is kept until the page reloads, and a rejection
 * is evicted so the next call requests again.
 *
 * @template T
 * @param {Map<unknown, Promise<T>>} cache
 * @param {unknown} key
 * @param {() => Promise<T>} load
 * @returns {Promise<T>}
 */
export const cachedRequest = (cache, key, load) => {
  const cached = cache.get(key);
  if (cached) return cached;

  const request = load().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, request);
  return request;
};
