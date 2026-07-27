import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DEMO_USER_ID } from "@/lib/preferences";

const placeSchema = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

async function ensureUser() {
  await prisma.user.upsert({ where: { id: DEMO_USER_ID }, update: {}, create: { id: DEMO_USER_ID, name: "Demo Runner" } });
}

export async function GET() {
  try {
    const places = await prisma.savedPlace.findMany({
      where: { userId: DEMO_USER_ID },
      orderBy: [{ label: "asc" }],
    });
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json({ places: [] });
  }
}

export async function POST(req: NextRequest) {
  const parsed = placeSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid place" }, { status: 400 });
  const { label, address, lat, lng } = parsed.data;

  await ensureUser();
  // Same label overwrites (e.g. moving "Home") instead of erroring.
  const place = await prisma.savedPlace.upsert({
    where: { userId_label: { userId: DEMO_USER_ID, label } },
    update: { address, lat, lng },
    create: { userId: DEMO_USER_ID, label, address, lat, lng },
  });
  return NextResponse.json({ place });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.savedPlace.deleteMany({ where: { id, userId: DEMO_USER_ID } });
  return NextResponse.json({ ok: true });
}
