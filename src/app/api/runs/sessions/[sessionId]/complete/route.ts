import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { summarizePreferences } from "@/lib/preferences";

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

/** Naive "AI learns preferences" pass: increments tally counters for every
 * choice made on a completed run, so future runs can surface "you usually
 * prefer X" without any external ML dependency. */
async function learnFromRun(userId: string | null, run: any) {
  if (!userId) return;
  const existing = await prisma.preferenceProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const terrainCounts = bump({ ...(existing.terrainCounts as any) }, run.terrain);
  const trafficCounts = bump({ ...(existing.trafficCounts as any) }, run.traffic);
  const safetyCounts = bump({ ...(existing.safetyCounts as any) }, run.safety);
  const sceneryCounts = bump({ ...(existing.sceneryCounts as any) }, run.scenery);
  const hydrationCounts = bump({ ...(existing.hydrationCounts as any) }, run.hydration);
  const toiletCounts = bump({ ...(existing.toiletCounts as any) }, run.toilet);
  const shadeCounts = bump({ ...(existing.shadeCounts as any) }, run.shade);
  const timingCounts = bump({ ...(existing.timingCounts as any) }, run.timing);

  const environmentCounts = { ...(existing.environmentCounts as any) };
  for (const e of run.environment as string[]) bump(environmentCounts, e);

  await prisma.preferenceProfile.update({
    where: { userId },
    data: {
      terrainCounts,
      trafficCounts,
      safetyCounts,
      sceneryCounts,
      hydrationCounts,
      toiletCounts,
      shadeCounts,
      timingCounts,
      environmentCounts,
      totalRunsCompleted: { increment: 1 },
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const body = (await req.json()) as { distanceCompletedKm: number; elapsedSeconds: number; track?: { lat: number; lng: number; t: number }[] };

  const session = await prisma.runSession.findUnique({
    where: { id: params.sessionId },
    include: { routeOption: { include: { run: true } } },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const avgPace = body.distanceCompletedKm > 0 ? body.elapsedSeconds / 60 / body.distanceCompletedKm : null;

  const updated = await prisma.runSession.update({
    where: { id: params.sessionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      distanceCompletedKm: body.distanceCompletedKm,
      elapsedSeconds: body.elapsedSeconds,
      avgPaceMinPerKm: avgPace ?? undefined,
      track: (body.track ?? []) as any,
    },
  });

  await learnFromRun(session.routeOption.run.userId, session.routeOption.run);

  const profile = session.routeOption.run.userId
    ? await prisma.preferenceProfile.findUnique({ where: { userId: session.routeOption.run.userId } })
    : null;

  return NextResponse.json({ session: updated, learnedPreferences: summarizePreferences(profile) });
}
