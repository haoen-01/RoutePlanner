import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatKm, formatMinutes } from "@/lib/utils";
import { summarizePreferences } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function RunSummaryPage({ params }: { params: { sessionId: string } }) {
  const session = await prisma.runSession.findUnique({
    where: { id: params.sessionId },
    include: { routeOption: { include: { run: true } } },
  });
  if (!session) return notFound();

  const userId = session.routeOption.run.userId;
  const profile = userId ? await prisma.preferenceProfile.findUnique({ where: { userId } }) : null;
  const learned = summarizePreferences(profile);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Run complete</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{session.routeOption.name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Distance" value={formatKm(session.distanceCompletedKm)} />
          <Stat label="Pace" value={session.avgPaceMinPerKm ? `${session.avgPaceMinPerKm.toFixed(1)} min/km` : "—"} />
          <Stat label="Elevation gain" value={`${session.routeOption.elevationGainM}m`} />
          <Stat label="Time" value={formatMinutes(session.elapsedSeconds / 60)} />
        </CardContent>
      </Card>

      {learned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>You usually prefer</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {learned.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Based on {profile?.totalRunsCompleted ?? 1} completed run{(profile?.totalRunsCompleted ?? 1) === 1 ? "" : "s"}. Future recommendations improve automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Link href="/create">
          <Button>Plan another run</Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">View history</Button>
        </Link>
      </div>
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
