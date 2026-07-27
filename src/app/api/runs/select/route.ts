import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/preferences";

/** Behavioural preference learning: when the user picks one of the 3
 * candidates, record how the chosen route's scores differ from the average
 * of the options they skipped. Over time this reveals what users actually
 * choose (e.g. consistently the shadier or more scenic option), which is a
 * far stronger signal than the form inputs they typed in. */
async function learnFromChoice(runId: string, chosenId: string) {
  const run = await prisma.run.findUnique({ where: { id: runId }, include: { routeOptions: true } });
  if (!run) return;
  const chosen = run.routeOptions.find((o: any) => o.id === chosenId);
  const skipped = run.routeOptions.filter((o: any) => o.id !== chosenId);
  if (!chosen || skipped.length === 0) return;

  const dims = [
    ["shade", "shadeScore"],
    ["scenery", "sceneryScore"],
    ["safety", "safetyScore"],
    ["traffic", "trafficScore"],
    ["convenience", "convenienceScore"],
    ["elevationGain", "elevationGainM"],
  ] as const;

  const userId = run.userId ?? DEMO_USER_ID;
  const profile = await prisma.preferenceProfile.upsert({ where: { userId }, create: { userId }, update: {} });
  const signals: Record<string, { sum: number; n: number }> = { ...(profile.choiceSignals as any) };

  for (const [key, field] of dims) {
    const skippedAvg = skipped.reduce((a: number, o: any) => a + (o[field] ?? 0), 0) / skipped.length;
    const delta = ((chosen as any)[field] ?? 0) - skippedAvg;
    const prev = signals[key] ?? { sum: 0, n: 0 };
    signals[key] = { sum: prev.sum + delta, n: prev.n + 1 };
  }

  await prisma.preferenceProfile.update({ where: { userId }, data: { choiceSignals: signals } });
}

export async function POST(req: NextRequest) {
  const { runId, routeOptionId } = (await req.json()) as { runId: string; routeOptionId: string };
  if (!runId || !routeOptionId) return NextResponse.json({ error: "runId and routeOptionId required" }, { status: 400 });

  await prisma.$transaction([
    prisma.routeOption.updateMany({ where: { runId }, data: { isSelected: false } }),
    prisma.routeOption.update({ where: { id: routeOptionId }, data: { isSelected: true } }),
  ]);

  // Best-effort: never block starting a run on the learning write.
  try {
    await learnFromChoice(runId, routeOptionId);
  } catch (e) {
    console.error("choice learning failed", e);
  }

  const session = await prisma.runSession.create({
    data: { routeOptionId, status: "in_progress" },
  });

  return NextResponse.json({ sessionId: session.id });
}
