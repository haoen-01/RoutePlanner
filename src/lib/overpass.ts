/** Shared Overpass client with an in-memory TTL cache so one route
 * generation (3 candidates) issues a single corridor query instead of
 * 9+ near-identical ones, and repeated generations from the same spot
 * reuse the cached result instead of hammering the public API. */

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  data: any;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(query: string): string {
  return query;
}

/** Round a bbox to a coarse grid so nearby route candidates share a cache
 * entry instead of each producing a unique bbox string. */
export function roundBbox(bbox: [number, number, number, number], step = 0.01): [number, number, number, number] {
  const floor = (n: number) => Math.floor(n / step) * step;
  const ceil = (n: number) => Math.ceil(n / step) * step;
  return [floor(bbox[0]), floor(bbox[1]), ceil(bbox[2]), ceil(bbox[3])];
}

export async function overpassQuery(query: string, timeoutMs = 8000): Promise<any> {
  const key = cacheKey(query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`overpass ${res.status}`);
  const data = await res.json();
  cache.set(key, { at: Date.now(), data });
  // basic cache hygiene
  if (cache.size > 50) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  return data;
}
