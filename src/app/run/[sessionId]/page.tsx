import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { RunTracker } from "@/components/RunTracker";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: { sessionId: string } }) {
  const session = await prisma.runSession.findUnique({
    where: { id: params.sessionId },
    include: { routeOption: true },
  });
  if (!session) return notFound();

  const geojson = session.routeOption.geojson as any;
  const coordinates: [number, number][] = geojson?.geometry?.coordinates ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{session.routeOption.name}</h1>
        <p className="text-sm text-muted-foreground">Navigation guidance follows your planned route — stay close to the line for the best route adherence.</p>
      </div>
      <RunTracker sessionId={session.id} coordinates={coordinates} totalDistanceKm={session.routeOption.distanceKm} />
    </div>
  );
}
