import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatKm } from "@/lib/utils";
import { DEMO_USER_ID } from "@/lib/preferences";

// Always fetch fresh — this reads live per-user run history from the DB,
// so it must not be statically pre-rendered at build time.
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const runs = await prisma.run.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      routeOptions: {
        where: { isSelected: true },
        include: { runSessions: { orderBy: { startedAt: "desc" }, take: 1 } },
      },
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Route history</h1>
      {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet — plan your first one from the home page.</p>}

      {runs.map((run) => {
        const selected = run.routeOptions[0];
        const session = selected?.runSessions[0];
        return (
          <Card key={run.id}>
            <CardContent className="flex items-center justify-between pt-5">
              <div>
                <p className="font-medium">{selected?.name ?? "No route selected"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatKm(run.distanceKm)} · {run.routeType.replace("_", " ")} · {new Date(run.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {session && <Badge variant={session.status === "completed" ? "success" : "secondary"}>{session.status.replace("_", " ")}</Badge>}
                {session?.status === "completed" && (
                  <Link href={`/run/${session.id}/summary`} className="text-sm text-primary hover:underline">
                    View
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
