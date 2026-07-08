import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { runId, routeOptionId } = (await req.json()) as { runId: string; routeOptionId: string };
  if (!runId || !routeOptionId) return NextResponse.json({ error: "runId and routeOptionId required" }, { status: 400 });

  await prisma.$transaction([
    prisma.routeOption.updateMany({ where: { runId }, data: { isSelected: false } }),
    prisma.routeOption.update({ where: { id: routeOptionId }, data: { isSelected: true } }),
  ]);

  const session = await prisma.runSession.create({
    data: { routeOptionId, status: "in_progress" },
  });

  return NextResponse.json({ sessionId: session.id });
}
