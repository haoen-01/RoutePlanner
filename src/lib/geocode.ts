/** Geocoding: postal code / building / street name -> coordinates.
 * Primary: OneMap (Singapore government, free, no key) — by far the most
 * accurate source for SG postal codes and building names.
 * Fallback: OpenStreetMap Nominatim for anywhere outside Singapore.
 * Both are called server-side (see /api/geocode) to keep proper headers
 * and avoid browser CORS issues. */

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  source: "onemap" | "nominatim";
}

/** Pure parser for OneMap /elastic/search responses (unit-tested). */
export function parseOneMap(data: any): GeocodeResult[] {
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .map((r: any): GeocodeResult | null => {
      const lat = Number(r.LATITUDE);
      const lng = Number(r.LONGITUDE);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const building = r.BUILDING && r.BUILDING !== "NIL" ? r.BUILDING : null;
      const label = [building, r.ADDRESS].filter(Boolean).join(building && r.ADDRESS?.startsWith(building) ? "" : " — ") || r.SEARCHVAL || "Unknown";
      return { label: r.ADDRESS ?? label, lat, lng, source: "onemap" };
    })
    .filter(Boolean)
    .slice(0, 5) as GeocodeResult[];
}

/** Pure parser for Nominatim jsonv2 responses (unit-tested). */
export function parseNominatim(data: any): GeocodeResult[] {
  const results = Array.isArray(data) ? data : [];
  return results
    .map((r: any): GeocodeResult | null => {
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label: r.display_name ?? "Unknown", lat, lng, source: "nominatim" };
    })
    .filter(Boolean)
    .slice(0, 5) as GeocodeResult[];
}

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  // 1. OneMap (Singapore)
  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const parsed = parseOneMap(await res.json());
      if (parsed.length) return parsed;
    }
  } catch {
    // fall through
  }

  // 2. Nominatim (global fallback). Requires a descriptive User-Agent.
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ai-running-route-planner (hackathon demo)" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return parseNominatim(await res.json());
  } catch {
    // no results
  }
  return [];
}
