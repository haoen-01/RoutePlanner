"use client";

import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LocationPicker } from "@/components/LocationPicker";
import { LOCATION_FAMILIARITY } from "@/lib/constants";
import { useRunFlowStore } from "@/store/runFlowStore";

export default function HomePage() {
  const { locationFamiliarity, setFamiliarity } = useRunFlowStore();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Where should you run today?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us where you're starting from, then we'll build a few personalised route options — not just track a run, but plan the right one.
        </p>
      </div>

      <LocationPicker />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Location familiarity</label>
        <Select options={LOCATION_FAMILIARITY} value={locationFamiliarity} onValueChange={(v) => setFamiliarity(v as any)} />
        <p className="text-xs text-muted-foreground">
          This only adjusts how much weight navigability/lighting get — routes aren't made "safer" automatically just because an area is unfamiliar.
        </p>
      </div>

      <Link href="/create">
        <Button size="lg" className="w-full">
          Create a run
        </Button>
      </Link>
    </div>
  );
}
