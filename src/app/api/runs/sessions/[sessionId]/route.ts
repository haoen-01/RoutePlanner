import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  const session = await prisma.runSession.findUnique({
    where: { id: params.sessionId },
    include: { routeOption: { include: { run: true } } },
  });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json({ session });
}
