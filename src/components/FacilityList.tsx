import { Droplets, Bath, Umbrella } from "lucide-react";
import type { FacilityPoint } from "@/lib/types";

function List({ icon: Icon, label, points }: { icon: any; label: string; points: FacilityPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <ul className="flex flex-col gap-0.5 text-sm">
        {points.map((p, i) => (
          <li key={i} className="flex justify-between gap-2 text-muted-foreground">
            <span>km {p.km}</span>
            <span className="truncate text-right">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FacilityList({
  hydrationPoints,
  toiletPoints,
  shelterPoints,
}: {
  hydrationPoints: FacilityPoint[];
  toiletPoints: FacilityPoint[];
  shelterPoints: FacilityPoint[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <List icon={Droplets} label="Hydration" points={hydrationPoints} />
      <List icon={Bath} label="Toilets" points={toiletPoints} />
      <List icon={Umbrella} label="Shelter & weather protection" points={shelterPoints} />
    </div>
  );
}
