import { cn } from "@/lib/utils";

export function ScoreBar({ label, value, className }: { label: string; value: number; className?: string }) {
  const color = value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-lime-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
