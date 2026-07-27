import { CloudRain, ThermometerSun, CloudOff } from "lucide-react";
import type { WeatherSummary } from "@/lib/types";

export function WeatherBanner({ weather }: { weather: WeatherSummary }) {
  if (weather.source === "unavailable") {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <CloudOff className="h-3.5 w-3.5" /> Weather data unavailable right now
      </div>
    );
  }

  const warnings: string[] = [];
  if (weather.rainWarning) warnings.push("⚠ Rain possible");
  if (weather.heatWarning) warnings.push("⚠ High heat exposure");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md bg-muted px-3 py-2 text-xs">
      {typeof weather.tempC === "number" && (
        <span className="flex items-center gap-1">
          <ThermometerSun className="h-3.5 w-3.5" /> {Math.round(weather.tempC)}°C
        </span>
      )}
      {typeof weather.rainProbability === "number" && (
        <span className="flex items-center gap-1">
          <CloudRain className="h-3.5 w-3.5" /> {weather.rainProbability}% rain chance
        </span>
      )}
      {warnings.length > 0 ? (
        <span className="font-medium text-amber-700">{warnings.join(" · ")}</span>
      ) : (
        <span className="text-muted-foreground">No weather warnings</span>
      )}
    </div>
  );
}
