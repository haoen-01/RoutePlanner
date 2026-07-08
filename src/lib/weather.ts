import type { LatLng, WeatherSummary } from "./types";

/**
 * Open-Meteo is free and requires no API key, so weather works out of the
 * box. If the request fails for any reason we return a neutral summary
 * rather than breaking route generation.
 */
export async function getWeatherSummary(loc: LatLng): Promise<WeatherSummary> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", loc.lat.toFixed(4));
    url.searchParams.set("longitude", loc.lng.toFixed(4));
    url.searchParams.set("current", "temperature_2m,precipitation");
    url.searchParams.set("hourly", "precipitation_probability");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = await res.json();

    const tempC: number = data?.current?.temperature_2m ?? null;
    const hourlyProbs: number[] = data?.hourly?.precipitation_probability ?? [];
    const rainProbability = hourlyProbs.length
      ? Math.round(hourlyProbs.slice(0, 6).reduce((a: number, b: number) => a + b, 0) / Math.min(6, hourlyProbs.length))
      : null;

    return {
      tempC,
      rainProbability,
      heatWarning: typeof tempC === "number" && tempC >= 32,
      rainWarning: typeof rainProbability === "number" && rainProbability >= 40,
      source: "open-meteo",
    };
  } catch {
    return { tempC: null, rainProbability: null, heatWarning: false, rainWarning: false, source: "unavailable" };
  }
}
