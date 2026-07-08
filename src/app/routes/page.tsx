"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RouteCard } from "@/components/RouteCard";
import { useRunFlowStore } from "@/store/runFlowStore";

export default function RoutesPage() {
  const router = useRouter();
  const { runId, routes, setSessionId } = useRunFlowStore();

  if (!runId || !routes.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">No routes generated yet.</p>
        <Link href="/create">
          <Button>Create a run</Button>
        </Link>
      </div>
    );
  }

  async function startRun(routeOptionId: string) {
    const res = await fetch("/api/runs/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, routeOptionId }),
    });
    const data = await res.json();
    setSessionId(data.sessionId);
    router.push(`/run/${data.sessionId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Compare your routes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ranked by overall match to your preferences. Pick one to start running, or export it for later.</p>
      </div>

      <div className="flex flex-col gap-5">
        {routes.map((route: any, i: number) => (
          <RouteCard
            key={route.id}
            route={route}
            rank={i}
            onStartRun={() => startRun(route.id)}
            onExportGpx={() => window.open(`/api/export/gpx/${route.id}`, "_blank")}
          />
        ))}
      </div>

      <Link href="/create" className="self-start">
        <Button variant="ghost" size="sm">
          ← Modify preferences
        </Button>
      </Link>
    </div>
  );
}
