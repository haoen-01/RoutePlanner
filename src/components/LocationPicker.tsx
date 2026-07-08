"use client";

import { useState } from "react";
import { MapPin, LocateFixed, Home, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRunFlowStore } from "@/store/runFlowStore";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/lib/constants";

const PRESETS = [
  { key: "current", label: "Current location", icon: LocateFixed },
  { key: "home", label: "Home", icon: Home },
  { key: "hotel", label: "Hotel", icon: Building2 },
  { key: "custom", label: "Custom starting point", icon: MapPin },
] as const;

export function LocationPicker() {
  const { startLat, startLng, startLabel, setLocation } = useRunFlowStore();
  const [active, setActive] = useState<string>("current");
  const [status, setStatus] = useState<string | null>(null);
  const [custom, setCustom] = useState({ lat: String(startLat), lng: String(startLng) });

  function detectLocation() {
    setActive("current");
    if (!navigator.geolocation) {
      setStatus("Geolocation isn't available in this browser — using the default demo location.");
      setLocation(DEFAULT_LAT, DEFAULT_LNG, "Current location (default)");
      return;
    }
    setStatus("Detecting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(pos.coords.latitude, pos.coords.longitude, "Current location");
        setStatus(null);
      },
      () => {
        setStatus("Couldn't get your location (permission denied) — using the default demo location.");
        setLocation(DEFAULT_LAT, DEFAULT_LNG, "Current location (default)");
      },
      { timeout: 6000 }
    );
  }

  function selectPreset(key: string) {
    setActive(key);
    if (key === "current") return detectLocation();
    if (key === "home") return setLocation(DEFAULT_LAT + 0.01, DEFAULT_LNG - 0.008, "Home");
    if (key === "hotel") return setLocation(DEFAULT_LAT - 0.006, DEFAULT_LNG + 0.012, "Hotel");
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4" /> Starting location
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => selectPreset(p.key)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs transition-colors ${
                active === p.key ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
              }`}
            >
              <p.icon className="h-4 w-4" />
              {p.label}
            </button>
          ))}
        </div>

        {active === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              Latitude
              <input
                className="mt-1 block h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
                value={custom.lat}
                onChange={(e) => setCustom((c) => ({ ...c, lat: e.target.value }))}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Longitude
              <input
                className="mt-1 block h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
                value={custom.lng}
                onChange={(e) => setCustom((c) => ({ ...c, lng: e.target.value }))}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const lat = Number(custom.lat);
                const lng = Number(custom.lng);
                if (!Number.isNaN(lat) && !Number.isNaN(lng)) setLocation(lat, lng, "Custom starting point");
              }}
            >
              Use this point
            </Button>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {status ?? `Using: ${startLabel} (${startLat.toFixed(4)}, ${startLng.toFixed(4)})`}
        </p>
      </CardContent>
    </Card>
  );
}
