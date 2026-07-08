import { NextRequest, NextResponse } from "next/server";
import { getWeatherSummary } from "@/lib/weather";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }
  const summary = await getWeatherSummary({ lat, lng });
  return NextResponse.json(summary);
}
