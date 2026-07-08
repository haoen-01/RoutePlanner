"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as turf from "@turf/turf";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatKm, formatMinutes } from "@/lib/utils";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-muted" /> });

interface TrackPoint {
  lat: number;
  lng: number;
  t: number; // ms elapsed since start
}

export function RunTracker({ sessionId, coordinates, totalDistanceKm }: { sessionId: string; coordinates: [number, number][]; totalDistanceKm: number }) {
  const router = useRouter();
  const line = turf.lineString(coordinates);

  const [status, setStatus] = useState<"idle" | "gps" | "simulated" | "finished">("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [current, setCurrent] = useState<{ lat: number; lng: number } | null>(null);
  const track = useRef<TrackPoint[]>([]);
  const startTime = useRef<number>(0);
  const watchId = useRef<number | null>(null);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (simInterval.current) clearInterval(simInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  function startTimer() {
    startTime.current = Date.now();
    timerInterval.current = setInterval(() => setElapsedSec(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
  }

  function startGps() {
    if (!navigator.geolocation) return startSimulated();
    setStatus("gps");
    startTimer();
    let lastPoint: { lat: number; lng: number } | null = null;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrent(point);
        if (lastPoint) {
          const d = turf.distance([lastPoint.lng, lastPoint.lat], [point.lng, point.lat], { units: "kilometers" });
          if (d < 0.3) setDistanceKm((prev) => prev + d); // ignore GPS jumps
        }
        lastPoint = point;
        track.current.push({ ...point, t: Date.now() - startTime.current });
      },
      () => startSimulated(),
      { enableHighAccuracy: true, maximumAge: 2000 }
    );
  }

  /** Animates a marker along the planned route at ~6 min/km — lets the flow
   * be demoed indoors / without real GPS. */
  function startSimulated() {
    setStatus("simulated");
    startTimer();
    const paceMinPerKm = 6;
    const totalMs = totalDistanceKm * paceMinPerKm * 60 * 1000;
    const tickMs = 500;
    let elapsed = 0;
    simInterval.current = setInterval(() => {
      elapsed += tickMs;
      const fraction = Math.min(1, elapsed / totalMs);
      const along = turf.along(line, fraction * totalDistanceKm, { units: "kilometers" });
      const [lng, lat] = along.geometry.coordinates;
      setCurrent({ lat, lng });
      setDistanceKm(fraction * totalDistanceKm);
      track.current.push({ lat, lng, t: elapsed });
      if (fraction >= 1 && simInterval.current) {
        clearInterval(simInterval.current);
      }
    }, tickMs);
  }

  async function finish() {
    setStatus("finished");
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (simInterval.current) clearInterval(simInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);

    const res = await fetch(`/api/runs/sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distanceCompletedKm: distanceKm, elapsedSeconds: elapsedSec, track: track.current }),
    });
    const data = await res.json();
    router.push(`/run/${sessionId}/summary`);
  }

  const remainingKm = Math.max(0, totalDistanceKm - distanceKm);
  const paceMinPerKm = distanceKm > 0 ? elapsedSec / 60 / distanceKm : 0;
  const progressPct = Math.min(100, (distanceKm / totalDistanceKm) * 100);

  return (
    <div className="flex flex-col gap-4">
      <RouteMap coordinates={coordinates} liveMarker={current} className="h-80 w-full overflow-hidden rounded-lg" />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
          <Stat label="Distance" value={formatKm(distanceKm)} />
          <Stat label="Remaining" value={formatKm(remainingKm)} />
          <Stat label="Pace" value={paceMinPerKm > 0 ? `${paceMinPerKm.toFixed(1)} min/km` : "—"} />
          <Stat label="Elapsed" value={formatMinutes(elapsedSec / 60)} />
        </CardContent>
      </Card>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      {status === "idle" && (
        <div className="flex gap-2">
          <Button onClick={startGps}>Start run (use GPS)</Button>
          <Button variant="outline" onClick={startSimulated}>
            Simulate run (demo)
          </Button>
        </div>
      )}
      {(status === "gps" || status === "simulated") && (
        <Button variant="outline" onClick={finish}>
          Finish run
        </Button>
      )}
      {status === "finished" && <p className="text-sm text-muted-foreground">Saving your run…</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
