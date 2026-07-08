import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRouteCandidates } from "@/lib/routing";
import type { CreateRunRequest } from "@/lib/types";
import { DEMO_USER_ID } from "@/lib/preferences";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateRunRequest;

    if (!body || typeof body.startLat !== "number" || typeof body.startLng !== "number" || !body.distanceKm || !body.routeType || !body.preferences) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const candidates = await generateRouteCandidates(body);

    // Default to a shared demo user (no auth in this MVP) so preference
    // learning has somewhere to accumulate across runs in the same browser.
    const userId = body.userId ?? DEMO_USER_ID;
    await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, name: "Demo Runner" } });

    const run = await prisma.run.create({
      data: {
        userId,
        startLat: body.startLat,
        startLng: body.startLng,
        startLabel: body.startLabel,
        locationFamiliarity: body.locationFamiliarity,
        distanceKm: body.distanceKm,
        routeType: body.routeType,
        terrain: body.preferences.terrain,
        environment: body.preferences.environment,
        traffic: body.preferences.traffic,
        safety: body.preferences.safety,
        scenery: body.preferences.scenery,
        hydration: body.preferences.hydration,
        toilet: body.preferences.toilet,
        shade: body.preferences.shade,
        timing: body.preferences.timing,
        routeOptions: {
          create: candidates.map((c) => ({
            name: c.name,
            geojson: c.geojson as any,
            distanceKm: c.distanceKm,
            estimatedDurationMin: c.estimatedDurationMin,
            routeType: c.routeType,
            elevationGainM: c.terrain.elevationGainM,
            highestPointM: c.terrain.highestPointM,
            maxInclinePct: c.terrain.maxInclinePct,
            difficulty: c.terrain.difficulty,
            safetyScore: c.scores.safetyScore,
            sceneryScore: c.scores.sceneryScore,
            trafficScore: c.scores.trafficScore,
            convenienceScore: c.scores.convenienceScore,
            shadeScore: c.scores.shadeScore,
            weatherProtectionScore: c.scores.weatherProtectionScore,
            overallScore: c.scores.overallScore,
            hydrationPoints: c.hydrationPoints as any,
            toiletPoints: c.toiletPoints as any,
            shelterPoints: c.shelterPoints as any,
            weatherSummary: c.weatherSummary as any,
            explanation: c.explanation,
            recommendation: c.recommendation,
          })),
        },
      },
      include: { routeOptions: true },
    });

    return NextResponse.json({ runId: run.id, routes: run.routeOptions });
  } catch (err) {
    console.error("route generation failed", err);
    return NextResponse.json({ error: "Failed to generate routes" }, { status: 500 });
  }
}
