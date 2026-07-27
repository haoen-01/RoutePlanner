"use client";

import dynamic from "next/dynamic";
import { Sparkles, TrendingUp, Clock, Route as RouteIcon, Mountain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/ui/progress";
import { WeatherBanner } from "@/components/WeatherBanner";
import { FacilityList } from "@/components/FacilityList";
import { formatKm, formatMinutes } from "@/lib/utils";

const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-muted" /> });

const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easy", moderate: "Moderate", hard: "Hard" };

export function RouteCard({
  route,
  rank,
  onStartRun,
  onExportGpx,
}: {
  route: any; // RouteOption (Prisma shape) — geojson/scores/etc as persisted
  rank: number;
  onStartRun?: () => void;
  onExportGpx?: () => void;
}) {
  const coords: [number, number][] = route.geojson?.geometry?.coordinates ?? [];

  return (
    <Card className={rank === 0 ? "border-primary/60 ring-1 ring-primary/20" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            {route.name}
            {rank === 0 && (
              <Badge variant="success" className="gap-1">
                <Sparkles className="h-3 w-3" /> Top match
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {route.source === "synthetic" && (
              <Badge variant="outline" className="border-amber-400 text-amber-600" title="External routing was unavailable for this option — its shape is estimated and may not follow real roads.">
                Estimated shape
              </Badge>
            )}
            <Badge variant="outline">Overall {route.overallScore}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5" /> {formatKm(route.distanceKm)}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{formatMinutes(route.estimatedDurationMin)}</span>
          <span className="flex items-center gap-1"><Mountain className="h-3.5 w-3.5" /> {route.elevationGainM}m gain · {DIFFICULTY_LABEL[route.difficulty]}</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Max incline {route.maxInclinePct}%</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RouteMap
          coordinates={coords}
          hydrationPoints={route.hydrationPoints}
          toiletPoints={route.toiletPoints}
          shelterPoints={route.shelterPoints}
        />

        <WeatherBanner weather={route.weatherSummary} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ScoreBar label="Safety" value={route.safetyScore} />
          <ScoreBar label="Scenery" value={route.sceneryScore} />
          <ScoreBar label="Traffic" value={route.trafficScore} />
          <ScoreBar label="Convenience" value={route.convenienceScore} />
          <ScoreBar label="Shade" value={route.shadeScore} />
          <ScoreBar label="Weather protection" value={route.weatherProtectionScore} />
        </div>

        <FacilityList hydrationPoints={route.hydrationPoints} toiletPoints={route.toiletPoints} shelterPoints={route.shelterPoints} />

        {route.recommendation && (
          <p className="rounded-md bg-primary/5 px-3 py-2 text-sm font-medium text-primary">{route.recommendation}</p>
        )}
        <p className="text-sm text-muted-foreground">{route.explanation}</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {onStartRun && <Button onClick={onStartRun}>Start run</Button>}
          {onExportGpx && (
            <Button variant="outline" onClick={onExportGpx}>
              Export GPX
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
