"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useRunFlowStore } from "@/store/runFlowStore";
import {
  DISTANCE_OPTIONS_KM,
  ENVIRONMENT_OPTIONS,
  HYDRATION_OPTIONS,
  LOCATION_FAMILIARITY,
  ROUTE_TYPES,
  SAFETY_OPTIONS,
  SCENERY_OPTIONS,
  SHADE_OPTIONS,
  TERRAIN_OPTIONS,
  TIMING_OPTIONS,
  TOILET_OPTIONS,
  TRAFFIC_OPTIONS,
} from "@/lib/constants";
import type { Environment } from "@/lib/types";
import { LocationSearch } from "@/components/LocationSearch";
import { usePlaces } from "@/lib/usePlaces";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PreferenceForm() {
  const {
    locationFamiliarity, setFamiliarity,
    distanceKm, setDistanceKm,
    routeType, setRouteType,
    endLat, endLabel, setEndLocation,
    preferences, setPreferences, toggleEnvironment,
  } = useRunFlowStore();

  const { places: savedPlaces } = usePlaces();
  const [customDistance, setCustomDistance] = useState("");
  const [useCustomDistance, setUseCustomDistance] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Location familiarity</CardTitle>
          <CardDescription>Helps the AI weigh safety and navigability appropriately — not automatically, only based on this.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            options={LOCATION_FAMILIARITY}
            value={locationFamiliarity}
            onValueChange={(v) => setFamiliarity(v as any)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create run</CardTitle>
          <CardDescription>Distance is the only custom input — everything else is a fixed choice.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Distance">
            <div className="flex flex-wrap gap-2">
              {DISTANCE_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  onClick={() => {
                    setUseCustomDistance(false);
                    setDistanceKm(km);
                  }}
                  className={`h-9 rounded-md border px-3 text-sm ${
                    !useCustomDistance && distanceKm === km ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {km} km
                </button>
              ))}
              <button
                onClick={() => setUseCustomDistance(true)}
                className={`h-9 rounded-md border px-3 text-sm ${useCustomDistance ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"}`}
              >
                Custom
              </button>
              {useCustomDistance && (
                <input
                  type="number"
                  min={1}
                  max={60}
                  placeholder="km"
                  className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm"
                  value={customDistance}
                  onChange={(e) => {
                    setCustomDistance(e.target.value);
                    const km = Number(e.target.value);
                    if (km > 0) setDistanceKm(km);
                  }}
                />
              )}
            </div>
          </Field>

          <Field label="Route type">
            <Select options={ROUTE_TYPES} value={routeType} onValueChange={(v) => setRouteType(v as any)} />
          </Field>

          {routeType === "point_to_point" && (
            <Field label="Destination" hint={endLat != null ? `Ending at ${endLabel}` : "Leave blank and the AI picks a direction for you."}>
              <div className="flex flex-col gap-2">
                {savedPlaces.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {savedPlaces.map((p) => (
                      <button
                        key={p.id}
                        className={`h-8 rounded-full border px-3 text-xs ${
                          endLabel === p.label ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                        }`}
                        onClick={() => setEndLocation(p.lat, p.lng, p.label)}
                        title={p.address ?? undefined}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
                <LocationSearch
                  placeholder="Search destination postal code or building…"
                  onSelect={(lat, lng, label) => setEndLocation(lat, lng, label)}
                />
                {endLat != null && (
                  <button
                    className="h-9 w-fit rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => setEndLocation(null, null)}
                  >
                    Clear (AI chooses)
                  </button>
                )}
              </div>
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Run preferences</CardTitle>
          <CardDescription>All fixed dropdowns/selectable options — converted into route scoring weights, no free text.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Terrain">
            <Select options={TERRAIN_OPTIONS} value={preferences.terrain} onValueChange={(v) => setPreferences({ terrain: v as any })} />
          </Field>
          <Field label="Traffic">
            <Select options={TRAFFIC_OPTIONS} value={preferences.traffic} onValueChange={(v) => setPreferences({ traffic: v as any })} />
          </Field>
          <Field label="Safety">
            <Select options={SAFETY_OPTIONS} value={preferences.safety} onValueChange={(v) => setPreferences({ safety: v as any })} />
          </Field>
          <Field label="Scenery">
            <Select options={SCENERY_OPTIONS} value={preferences.scenery} onValueChange={(v) => setPreferences({ scenery: v as any })} />
          </Field>
          <Field label="Hydration">
            <Select options={HYDRATION_OPTIONS} value={preferences.hydration} onValueChange={(v) => setPreferences({ hydration: v as any })} />
          </Field>
          <Field label="Toilet access">
            <Select options={TOILET_OPTIONS} value={preferences.toilet} onValueChange={(v) => setPreferences({ toilet: v as any })} />
          </Field>
          <Field label="Shade">
            <Select options={SHADE_OPTIONS} value={preferences.shade} onValueChange={(v) => setPreferences({ shade: v as any })} />
          </Field>
          <Field label="Run timing">
            <Select options={TIMING_OPTIONS} value={preferences.timing} onValueChange={(v) => setPreferences({ timing: v as any })} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Environment (select any that apply)">
              <div className="flex flex-wrap gap-2">
                {ENVIRONMENT_OPTIONS.map((opt) => {
                  const selected = preferences.environment.includes(opt.value as Environment);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleEnvironment(opt.value as Environment)}
                      className={`h-9 rounded-full border px-3 text-sm ${
                        selected ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
