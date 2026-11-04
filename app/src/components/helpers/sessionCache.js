// Session memo: shares in-flight promises, keeps successes, evicts failures.
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
