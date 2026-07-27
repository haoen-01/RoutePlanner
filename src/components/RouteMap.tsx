"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { FacilityPoint } from "@/lib/types";

interface RouteMapProps {
  coordinates: [number, number][]; // [lng, lat]
  hydrationPoints?: FacilityPoint[];
  toiletPoints?: FacilityPoint[];
  shelterPoints?: FacilityPoint[];
  liveMarker?: { lat: number; lng: number } | null;
  className?: string;
}

export default function RouteMap({ coordinates, hydrationPoints = [], toiletPoints = [], shelterPoints = [], liveMarker, className }: RouteMapProps) {
  const latLngs = useMemo<[number, number][]>(() => coordinates.map(([lng, lat]) => [lat, lng]), [coordinates]);
  const center = latLngs[Math.floor(latLngs.length / 2)] ?? latLngs[0] ?? [1.3048, 103.8318];

  return (
    <div className={className ?? "h-72 w-full overflow-hidden rounded-lg"}>
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {latLngs.length > 1 && <Polyline positions={latLngs} pathOptions={{ color: "#2563eb", weight: 4 }} />}

        {hydrationPoints
          .filter((p) => p.lat && p.lng)
          .map((p, i) => (
            <CircleMarker key={`h-${i}`} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: "#0891b2", fillColor: "#22d3ee", fillOpacity: 1 }}>
              <Tooltip>💧 {p.name} (km {p.km})</Tooltip>
            </CircleMarker>
          ))}
        {toiletPoints
          .filter((p) => p.lat && p.lng)
          .map((p, i) => (
            <CircleMarker key={`t-${i}`} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: "#7c3aed", fillColor: "#a78bfa", fillOpacity: 1 }}>
              <Tooltip>🚻 {p.name} (km {p.km})</Tooltip>
            </CircleMarker>
          ))}
        {shelterPoints
          .filter((p) => p.lat && p.lng)
          .map((p, i) => (
            <CircleMarker key={`s-${i}`} center={[p.lat, p.lng]} radius={6} pathOptions={{ color: "#ea580c", fillColor: "#fb923c", fillOpacity: 1 }}>
              <Tooltip>⛱ {p.name} (km {p.km})</Tooltip>
            </CircleMarker>
          ))}

        {liveMarker && (
          <CircleMarker center={[liveMarker.lat, liveMarker.lng]} radius={8} pathOptions={{ color: "#16a34a", fillColor: "#4ade80", fillOpacity: 1 }}>
            <Tooltip permanent>You</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
