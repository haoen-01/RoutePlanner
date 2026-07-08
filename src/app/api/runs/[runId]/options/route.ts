import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { runId: string } }) {
  const run = await prisma.run.findUnique({
    where: { id: params.runId },
    include: { routeOptions: true },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json({ run, routes: run.routeOptions });
}
