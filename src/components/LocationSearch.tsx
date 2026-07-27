"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import type { GeocodeResult } from "@/lib/geocode";

/** Postal code / building / street search box backed by /api/geocode
 * (OneMap for Singapore, Nominatim elsewhere). Debounced as you type. */
export function LocationSearch({
  placeholder = "Postal code or building name…",
  onSelect,
}: {
  placeholder?: string;
  onSelect: (lat: number, lng: number, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // aborted or offline — keep previous results
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          className="h-9 w-full bg-transparent text-sm outline-none"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {open && (
        <div className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-md border border-border bg-background shadow-md">
          {results.length === 0 && !loading && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches — try a postal code or a landmark name.</p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onSelect(r.lat, r.lng, r.label);
                setQuery(r.label);
                setOpen(false);
              }}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
