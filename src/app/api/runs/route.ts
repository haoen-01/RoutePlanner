import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Route history — most recent runs with their selected route + session. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? undefined;

  const runs = await prisma.run.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      routeOptions: {
        where: { isSelected: true },
        include: { runSessions: { orderBy: { startedAt: "desc" }, take: 1 } },
      },
    },
  });

  return NextResponse.json({ runs });
}
