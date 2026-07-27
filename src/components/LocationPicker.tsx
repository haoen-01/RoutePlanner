"use client";

import { useState } from "react";
import { Home, LocateFixed, MapPin, Star, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LocationSearch } from "@/components/LocationSearch";
import { useRunFlowStore } from "@/store/runFlowStore";
import { usePlaces } from "@/lib/usePlaces";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/lib/constants";

const SUGGESTED_LABELS = ["Home", "Office", "Gym", "School"];

export function LocationPicker() {
  const { startLat, startLng, startLabel, setLocation } = useRunFlowStore();
  const { places, savePlace, deletePlace } = usePlaces();

  const [active, setActive] = useState<string>("current");
  const [status, setStatus] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  // pending = a search result waiting to be used and/or saved
  const [pending, setPending] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [saveName, setSaveName] = useState("");

  function detectLocation() {
    setActive("current");
    if (!navigator.geolocation) {
      setStatus("Geolocation isn't available in this browser — using the default demo location.");
      setLocation(DEFAULT_LAT, DEFAULT_LNG, "Current location (default)");
      return;
    }
    setStatus("Detecting your location (GPS/Wi-Fi)…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const acc = Math.round(pos.coords.accuracy);
        setLocation(pos.coords.latitude, pos.coords.longitude, "Current location");
        setStatus(
          acc > 250
            ? `Detected with low accuracy (±${acc >= 1000 ? `${(acc / 1000).toFixed(1)}km` : `${acc}m`} — typical for laptops without GPS). For an exact start point, search a place below.`
            : `Detected within ±${acc}m.`
        );
      },
      () => {
        setStatus("Couldn't get your location (permission denied) — using the default demo location.");
        setLocation(DEFAULT_LAT, DEFAULT_LNG, "Current location (default)");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="h-4 w-4" /> Starting location
          </div>
          {places.length > 0 && (
            <button className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setManaging((m) => !m)}>
              {managing ? "Done" : "Manage places"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={detectLocation}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
              active === "current" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            <LocateFixed className="h-4 w-4" /> Current location
          </button>

          {places.map((p) => (
            <span key={p.id} className="relative inline-flex">
              <button
                onClick={() => {
                  setActive(p.id);
                  setLocation(p.lat, p.lng, p.label);
                  setStatus(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  active === p.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                }`}
                title={p.address ?? undefined}
              >
                {p.label === "Home" ? <Home className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                {p.label}
              </button>
              {managing && (
                <button
                  aria-label={`Delete ${p.label}`}
                  onClick={() => deletePlace(p.id)}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-background p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}

          <button
            onClick={() => setActive("search")}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
              active === "search" ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            <MapPin className="h-4 w-4" /> Search a place
          </button>
        </div>

        {active === "search" && (
          <div className="mt-3 flex flex-col gap-2">
            <LocationSearch
              placeholder="Search postal code, building, or street…"
              onSelect={(lat, lng, label) => {
                setLocation(lat, lng, label);
                setPending({ lat, lng, label });
                setSaveName("");
                setStatus(null);
              }}
            />
            {pending && (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">Save this place as:</span>
                {SUGGESTED_LABELS.filter((l) => !places.some((p) => p.label === l)).map((l) => (
                  <button
                    key={l}
                    className="h-7 rounded-full border border-border px-2.5 text-xs hover:bg-muted"
                    onClick={async () => {
                      await savePlace(l, pending.lat, pending.lng, pending.label);
                      setPending(null);
                    }}
                  >
                    {l}
                  </button>
                ))}
                <input
                  className="h-7 w-32 rounded-md border border-border bg-background px-2 text-xs"
                  placeholder="Custom name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && saveName.trim()) {
                      await savePlace(saveName.trim(), pending.lat, pending.lng, pending.label);
                      setPending(null);
                    }
                  }}
                />
                {saveName.trim() && (
                  <button
                    className="h-7 rounded-md border border-primary px-2.5 text-xs text-primary hover:bg-primary/5"
                    onClick={async () => {
                      await savePlace(saveName.trim(), pending.lat, pending.lng, pending.label);
                      setPending(null);
                    }}
                  >
                    Save
                  </button>
                )}
                <button aria-label="Dismiss" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setPending(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {status ?? `Using: ${startLabel} (${startLat.toFixed(4)}, ${startLng.toFixed(4)})`}
        </p>
      </CardContent>
    </Card>
  );
}
