"use client";

import { useCallback, useEffect, useState } from "react";

export interface SavedPlace {
  id: string;
  label: string;
  address?: string | null;
  lat: number;
  lng: number;
}

/** Client hook for the demo user's saved places (Home, Office, ...). */
export function usePlaces() {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/places");
      const data = await res.json();
      setPlaces(data.places ?? []);
    } catch {
      // offline — keep current list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const savePlace = useCallback(
    async (label: string, lat: number, lng: number, address?: string) => {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, lat, lng, address }),
      });
      if (!res.ok) throw new Error("save failed");
      await refresh();
    },
    [refresh]
  );

  const deletePlace = useCallback(
    async (id: string) => {
      await fetch(`/api/places?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refresh();
    },
    [refresh]
  );

  return { places, loading, savePlace, deletePlace, refresh };
}
